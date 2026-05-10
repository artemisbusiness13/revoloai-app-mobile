from fastapi import FastAPI, APIRouter, HTTPException, Request, Header
from fastapi.responses import FileResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

# Load env BEFORE importing services that read os.environ
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from services import llm as llm_svc
from services import personas as P
from services import jobs as jobs_svc
from services import voice as voice_svc
from services import auth as auth_svc
from services import personalization as personal_svc
from services import catalog as catalog_svc

# Stripe via emergentintegrations
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)


# ---------------- Setup ----------------
mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")
log = logging.getLogger("revoloai")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

stripe_checkout: Optional[StripeCheckout] = None


def _get_stripe(request: Request) -> StripeCheckout:
    """Return a fresh StripeCheckout instance — its __init__ ensures
    stripe.api_base points to the Emergent proxy when using sk_test_emergent.
    """
    api_key = os.environ.get("STRIPE_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    host = request.headers.get("origin") or str(request.base_url).rstrip("/")
    return StripeCheckout(api_key=api_key, webhook_url=f"{host}/api/payments/webhook")


# ---------------- Models ----------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class StatusCheckCreate(BaseModel):
    client_name: str


class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=now_utc)


class ChatMessage(BaseModel):
    role: str  # 'user' | 'ai'
    content: str


class ChatRequest(BaseModel):
    avatar: str
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    lang: Optional[str] = "English"


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    suggestions: List[str] = []


class ProfileIn(BaseModel):
    user_id: Optional[str] = None
    target_role: str = ""
    seniority: str = "unknown"
    years_experience: int = 0
    location: str = ""
    remote: str = "any"
    salary_min: int = 0
    salary_max: int = 0
    skills: List[str] = []
    languages: List[str] = []
    qualifications: List[str] = []
    education: str = ""
    experience_summary: str = ""
    industries: List[str] = []
    industries_avoid: List[str] = []
    must_haves: List[str] = []
    nice_to_haves: List[str] = []
    strengths: List[str] = []
    weaknesses: List[str] = []
    availability: str = ""
    cv_text: str = ""
    cv_filename: str = ""
    notes: str = ""
    summary: str = ""


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class JobMatchRequest(BaseModel):
    user_id: str
    limit: int = 10


class InterviewStartRequest(BaseModel):
    user_id: str
    role: str = "Generalist"
    seniority: str = "mid"
    style: str = "behavioural"   # behavioural | technical | mixed
    total_questions: int = 6
    lang: Optional[str] = "English"


class InterviewAnswerRequest(BaseModel):
    interview_id: str
    answer: str
    lang: Optional[str] = "English"


class CheckoutCreateRequest(BaseModel):
    user_id: str
    item_id: str
    success_url: str
    cancel_url: str


# ---------------- Routes: status + avatars ----------------
@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    obj = StatusCheck(**input.dict())
    await db.status_checks.insert_one(obj.dict())
    return obj


@api_router.get("/status", response_model=List[StatusCheck])
async def list_status_checks():
    rows = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    return [StatusCheck(**r) for r in rows]


ASSETS_DIR = ROOT_DIR.parent / "frontend" / "assets" / "images"


@api_router.get("/avatars/{name}")
async def get_avatar(name: str):
    if name not in {"maya", "sofia", "aria"}:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return FileResponse(str(ASSETS_DIR / f"avatar-{name}.png"), media_type="image/png")


# ---------------- Chat (Claude-powered, persistent sessions) ----------------
@api_router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    avatar = req.avatar.lower()
    if avatar not in P.PERSONAS:
        raise HTTPException(status_code=404, detail="Unknown avatar")
    persona = P.PERSONAS[avatar]
    session_id = req.session_id or str(uuid.uuid4())
    lang = (req.lang or "English").strip() or "English"
    lang_directive = (
        f"\n\nLANGUAGE: Reply ONLY in {lang}. The user may speak any language; "
        f"detect it but always respond in {lang}. Keep names and product terms in their original form."
    )

    # load history
    sess = await db.chat_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not sess:
        sess = {
            "session_id": session_id,
            "user_id": req.user_id or "guest",
            "avatar": avatar,
            "history": [],
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        await db.chat_sessions.insert_one(sess.copy())

    history: List[Dict[str, str]] = list(sess.get("history") or [])

    # Personalisation: pull profile + active package tier
    profile = None
    if req.user_id:
        profile = await db.profiles.find_one({"user_id": req.user_id}, {"_id": 0})
    tier = await personal_svc.active_tier(db, req.user_id or "", avatar)

    base_system = personal_svc.build_personal_system(
        persona["system"], profile, avatar, tier, lang_directive
    )

    # Empty message = generate intro
    if not req.message.strip() and not history:
        intro_system = base_system + (
            "\nGreet the user by name (if provided in the profile) with one warm sentence and "
            "ask one focused opening question that builds on their target_role and skills. "
            "If the profile is empty, ask a single high-leverage question to learn the most."
        )
        reply = await llm_svc.claude_chat(
            session_id=session_id,
            system_prompt=intro_system,
            history=[],
            latest_user_message="Begin the conversation now.",
        )
        history.append({"role": "ai", "content": reply})
    else:
        history.append({"role": "user", "content": req.message.strip()})
        reply = await llm_svc.claude_chat(
            session_id=session_id,
            system_prompt=base_system,
            history=history,
            latest_user_message=req.message.strip(),
        )
        history.append({"role": "ai", "content": reply})

    await db.chat_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"history": history, "updated_at": now_utc(), "avatar": avatar}},
    )

    suggestions_map = {
        "maya": ["Find product roles in London", "Remote senior engineer", "Show me 5 graduate roles"],
        "sofia": ["Run a 6-question mock", "Tougher behavioural questions", "Score my last answer"],
        "aria": ["Build a 12-month plan", "Review my CV bullets", "What skills should I learn next?"],
    }
    return ChatResponse(session_id=session_id, reply=reply, suggestions=suggestions_map[avatar])


@api_router.get("/chat/{session_id}")
async def get_chat_session(session_id: str):
    sess = await db.chat_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return sess


# ---------------- Profile (extract via GPT, persist) ----------------
@api_router.post("/profile/extract")
async def extract_profile_from_session(payload: Dict[str, Any]):
    """payload: {session_id} OR {transcript: str}, plus user_id"""
    user_id = payload.get("user_id") or "guest"
    transcript = payload.get("transcript")
    session_id = payload.get("session_id")
    if session_id and not transcript:
        sess = await db.chat_sessions.find_one({"session_id": session_id}, {"_id": 0})
        if sess:
            transcript = "\n".join(
                f"{m['role'].upper()}: {m['content']}" for m in sess.get("history") or []
            )
    if not transcript:
        return {"error": "no transcript"}
    extracted = await llm_svc.openai_json(
        session_id=f"profile_{user_id}",
        system_prompt=P.PROFILE_EXTRACTION_PROMPT,
        user_prompt=transcript[-4000:],
    )
    if "error" in extracted:
        return extracted
    extracted["user_id"] = user_id
    extracted["updated_at"] = now_utc()
    await db.profiles.update_one({"user_id": user_id}, {"$set": extracted}, upsert=True)
    extracted.pop("updated_at", None)
    return extracted


@api_router.get("/profile/{user_id}")
async def get_profile(user_id: str):
    p = await db.profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not p:
        return {"user_id": user_id, "target_role": "", "seniority": "unknown", "skills": []}
    p.pop("updated_at", None)
    return p


@api_router.put("/profile/{user_id}")
async def upsert_profile(user_id: str, body: ProfileIn):
    data = body.dict()
    data["user_id"] = user_id
    data["updated_at"] = now_utc()
    # Mark profile as completed if target_role is set
    data["completed"] = bool(data.get("target_role", "").strip())
    await db.profiles.update_one({"user_id": user_id}, {"$set": data}, upsert=True)
    # Also sync the user record's display name when first/last bits become known via cv_text — kept minimal here
    data.pop("updated_at", None)
    return data


# ---------------- Auth: signup / login / me ----------------
def _norm_email(e: str) -> str:
    return (e or "").strip().lower()


@api_router.post("/auth/signup")
async def auth_signup(body: SignupRequest):
    name = (body.name or "").strip()
    email = _norm_email(body.email)
    pwd = (body.password or "")
    if not name or not email or not pwd:
        raise HTTPException(status_code=400, detail="name, email and password are required")
    if len(pwd) < 6:
        raise HTTPException(status_code=400, detail="password must be at least 6 characters")
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="invalid email")
    existing = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1})
    if existing:
        raise HTTPException(status_code=409, detail="email already registered")
    user_id = f"u_{uuid.uuid4().hex[:14]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "password_hash": auth_svc.hash_password(pwd),
        "created_at": now_utc(),
    }
    await db.users.insert_one(user_doc)
    # Seed an empty profile so personalisation has a row to upsert into
    await db.profiles.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "name": name, "completed": False, "updated_at": now_utc()}},
        upsert=True,
    )
    token = auth_svc.new_token()
    await db.sessions.insert_one(
        {"token": token, "user_id": user_id, "created_at": now_utc()}
    )
    return {
        "ok": True,
        "token": token,
        "user": {"user_id": user_id, "email": email, "name": name},
        "profile_completed": False,
    }


@api_router.post("/auth/login")
async def auth_login(body: LoginRequest):
    email = _norm_email(body.email)
    pwd = body.password or ""
    if not email or not pwd:
        raise HTTPException(status_code=400, detail="email and password are required")
    user = await db.users.find_one({"email": email})
    if not user or not auth_svc.verify_password(pwd, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="invalid email or password")
    token = auth_svc.new_token()
    await db.sessions.insert_one(
        {"token": token, "user_id": user["user_id"], "created_at": now_utc()}
    )
    profile = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0, "completed": 1})
    return {
        "ok": True,
        "token": token,
        "user": {"user_id": user["user_id"], "email": user["email"], "name": user.get("name", "")},
        "profile_completed": bool(profile and profile.get("completed")),
    }


@api_router.get("/auth/me")
async def auth_me(authorization: Optional[str] = Header(default=None)):
    user = await auth_svc.user_from_token(db, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="not authenticated")
    profile = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    user.pop("password_hash", None)
    return {"user": user, "profile": profile or {}, "profile_completed": bool(profile and profile.get("completed"))}


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(default=None)):
    if authorization:
        token = authorization[7:].strip() if authorization.startswith("Bearer ") else authorization.strip()
        if token:
            await db.sessions.delete_many({"token": token})
    return {"ok": True}


# ---------------- Active package tier (debug / UI) ----------------
@api_router.get("/account/tier")
async def get_account_tier(user_id: str, avatar: str = "sofia"):
    tier = await personal_svc.active_tier(db, user_id, avatar)
    return {"tier": tier, "limits": personal_svc.tier_limits(tier)}


# ---------------- Jobs (Maya) ----------------
@api_router.post("/jobs/match")
async def match_jobs(req: JobMatchRequest):
    profile = await db.profiles.find_one({"user_id": req.user_id}, {"_id": 0}) or {}
    matches = await jobs_svc.search(profile, limit=req.limit)
    return {"profile": profile, "matches": matches, "live": jobs_svc.adzuna_enabled()}


# ---------------- Interview (Sofia adaptive) ----------------
@api_router.post("/interview/start")
async def interview_start(req: InterviewStartRequest):
    interview_id = str(uuid.uuid4())
    lang = (req.lang or "English").strip() or "English"
    lang_dir = f"\nReturn the question text in {lang}. Categories/difficulty stay in English keys."
    # Pull profile + tier so questions are personalised and respect package depth
    profile = await db.profiles.find_one({"user_id": req.user_id}, {"_id": 0}) if req.user_id else None
    tier = await personal_svc.active_tier(db, req.user_id or "", "sofia")
    tier_q_cap = personal_svc.tier_limits(tier)["interview_questions"]
    total_questions = min(req.total_questions, tier_q_cap)
    profile_ctx = personal_svc.profile_block(profile)
    qjson = await llm_svc.openai_json(
        session_id=f"itv_{interview_id}",
        system_prompt=(
            "You generate adaptive, role-specific interview questions tailored to the candidate's "
            "profile. Reference their target_role, skills, and experience. Avoid generic openers."
            + profile_ctx + lang_dir
        ),
        user_prompt=P.INTERVIEW_QUESTION_PROMPT.format(
            role=req.role, seniority=req.seniority, style=req.style, q_num=1, total=total_questions
        ) + "\nThere is no previous answer yet. Open with a focused question that lands on a "
            "specific dimension of the candidate's target_role and seniority — NOT a generic 'tell me about yourself'.",
    )
    if "error" in qjson:
        qjson = {"question": "Tell me about yourself and what brought you to this role.", "category": "motivation", "difficulty": "easy"}
    doc = {
        "interview_id": interview_id,
        "user_id": req.user_id,
        "role": req.role,
        "seniority": req.seniority,
        "style": req.style,
        "lang": lang,
        "tier": tier,
        "total": total_questions,
        "current": 1,
        "questions": [qjson],
        "answers": [],
        "scores": [],
        "created_at": now_utc(),
        "status": "in_progress",
    }
    await db.interviews.insert_one(doc.copy())
    return {"interview_id": interview_id, "question": qjson, "current": 1, "total": total_questions, "tier": tier}


@api_router.post("/interview/answer")
async def interview_answer(req: InterviewAnswerRequest):
    itv = await db.interviews.find_one({"interview_id": req.interview_id}, {"_id": 0})
    if not itv:
        raise HTTPException(status_code=404, detail="Interview not found")
    current = itv["current"]
    questions = itv["questions"]
    answers = list(itv["answers"]) + [req.answer]
    last_q = questions[current - 1]["question"] if questions else ""
    lang = itv.get("lang") or (req.lang or "English") or "English"
    lang_dir = f"\nWrite ALL string fields (feedback, strengths[], improvements[]) in {lang}; numeric scores stay numeric."
    # Score the answer (GPT JSON)
    sjson = await llm_svc.openai_json(
        session_id=f"itv_{req.interview_id}_score_{current}",
        system_prompt="You score interview answers with structured rubrics." + lang_dir,
        user_prompt=P.ANSWER_SCORING_PROMPT.format(
            role=itv["role"], seniority=itv["seniority"], question=last_q, answer=req.answer
        ),
    )
    if "error" in sjson:
        sjson = {"star_coverage": 50, "clarity": 50, "confidence": 50, "content_depth": 50, "structure": 50, "feedback": "Try to add a clearer structure and concrete result.", "strengths": [], "improvements": ["Add a measurable result"]}
    scores = list(itv["scores"]) + [sjson]
    if current >= itv["total"]:
        # finish: produce summary
        summary = await llm_svc.openai_json(
            session_id=f"itv_{req.interview_id}_summary",
            system_prompt="You produce a structured interview summary." + f"\nWrite all string fields (summary, top_strengths[], top_improvements[], next_steps[]) in {lang}. Verdict MUST stay in English (one of: 'Excellent','Strong','Promising','Needs work').",
            user_prompt=P.INTERVIEW_SUMMARY_PROMPT.format(role=itv["role"], seniority=itv["seniority"])
            + f"\nScores: {scores}",
        )
        if "error" in summary:
            avg = sum((s.get("star_coverage", 0) + s.get("clarity", 0) + s.get("confidence", 0) + s.get("content_depth", 0) + s.get("structure", 0)) / 5 for s in scores) / max(1, len(scores))
            summary = {
                "overall": int(avg),
                "verdict": "Promising" if avg >= 60 else "Needs work",
                "summary": "Your answers covered the key areas; tighten structure and add metrics.",
                "top_strengths": [],
                "top_improvements": ["Add measurable outcomes"],
                "next_steps": ["Practice STAR", "Prepare 3 stories", "Record yourself"],
            }
        await db.interviews.update_one(
            {"interview_id": req.interview_id},
            {"$set": {"answers": answers, "scores": scores, "summary": summary, "status": "completed", "updated_at": now_utc()}},
        )
        return {"done": True, "score": sjson, "summary": summary}
    # otherwise, generate next question that ADAPTS to the latest answer
    next_n = current + 1
    nq = await llm_svc.openai_json(
        session_id=f"itv_{req.interview_id}_q_{next_n}",
        system_prompt="You generate adaptive interview questions based on the previous answer." + f"\nReturn the question text in {lang}.",
        user_prompt=P.INTERVIEW_QUESTION_PROMPT.format(
            role=itv["role"], seniority=itv["seniority"], style=itv["style"], q_num=next_n, total=itv["total"]
        ) + f"\nPrevious question: '{last_q}'\nPrevious answer: '{req.answer}'",
    )
    if "error" in nq:
        nq = {"question": "Walk me through a project you owned end to end.", "category": "behavioural", "difficulty": "medium"}
    questions = list(questions) + [nq]
    await db.interviews.update_one(
        {"interview_id": req.interview_id},
        {"$set": {"answers": answers, "scores": scores, "questions": questions, "current": next_n, "updated_at": now_utc()}},
    )
    return {"done": False, "score": sjson, "next_question": nq, "current": next_n, "total": itv["total"]}


@api_router.get("/interview/{interview_id}")
async def interview_get(interview_id: str):
    itv = await db.interviews.find_one({"interview_id": interview_id}, {"_id": 0})
    if not itv:
        raise HTTPException(status_code=404, detail="Interview not found")
    return itv


# ---------------- Saved jobs (kept) ----------------
class SavedJobCreate(BaseModel):
    user_id: str
    title: str
    company: str = ""
    location: str = ""


@api_router.post("/saved-jobs")
async def save_job(input: SavedJobCreate):
    obj = {"id": str(uuid.uuid4()), **input.dict(), "created_at": now_utc()}
    await db.saved_jobs.insert_one(obj.copy())
    return obj


@api_router.get("/saved-jobs")
async def list_saved_jobs(user_id: str):
    rows = await db.saved_jobs.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return rows


@api_router.delete("/saved-jobs/{job_id}")
async def delete_saved_job(job_id: str, user_id: str):
    res = await db.saved_jobs.delete_one({"id": job_id, "user_id": user_id})
    return {"deleted": res.deleted_count}


# ---------------- Payments (Stripe via emergentintegrations) ----------------
@api_router.post("/payments/checkout")
async def payments_checkout(body: CheckoutCreateRequest, request: Request):
    item = catalog_svc.get(body.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Unknown item")
    sc = _get_stripe(request)
    purchase_id = str(uuid.uuid4())
    metadata = {
        "purchase_id": purchase_id,
        "user_id": body.user_id,
        "item_id": body.item_id,
        "avatar": item["avatar"],
        "kind": item["kind"],
    }
    sess_req = CheckoutSessionRequest(
        amount=item["amount"] / 100.0,
        currency=item["currency"],
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata=metadata,
    )
    sess = await sc.create_checkout_session(sess_req)
    purchase = {
        "id": purchase_id,
        "user_id": body.user_id,
        "avatar": item["avatar"],
        "item_id": body.item_id,
        "item_title": item["title"],
        "amount": item["amount"],
        "currency": item["currency"],
        "kind": item["kind"],
        "status": "pending",
        "stripe_session_id": sess.session_id,
        "stripe_url": sess.url,
        "created_at": now_utc(),
    }
    await db.purchases.insert_one(purchase.copy())
    return {"purchase_id": purchase_id, "session_id": sess.session_id, "url": sess.url, "amount": item["amount"], "currency": item["currency"]}


@api_router.get("/payments/status/{session_id}")
async def payments_status(session_id: str, request: Request):
    """Return payment status. Tries Stripe first; falls back to our local
    DB record (updated by webhook OR /payments/confirm)."""
    purchase = await db.purchases.find_one({"stripe_session_id": session_id}, {"_id": 0})
    use_emergent_sandbox = "sk_test_emergent" in os.environ.get("STRIPE_API_KEY", "")
    if not use_emergent_sandbox:
        try:
            sc = _get_stripe(request)
            st = await sc.get_checkout_status(session_id)
            new_status = "paid" if st.payment_status == "paid" else ("expired" if st.status == "expired" else "pending")
            if purchase and purchase.get("status") != new_status and new_status == "paid":
                await db.purchases.update_one(
                    {"stripe_session_id": session_id},
                    {"$set": {"status": "paid", "paid_at": now_utc()}},
                )
                purchase["status"] = "paid"
            return {
                "session_id": session_id,
                "status": st.status,
                "payment_status": st.payment_status,
                "amount_total": st.amount_total,
                "currency": st.currency,
                "purchase": purchase,
            }
        except Exception as e:
            log.info("Stripe status fallback to DB for %s: %s", session_id, e)
    # Sandbox or proxy unavailable: read from DB
    if not purchase:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "status": "complete" if purchase.get("status") == "paid" else "open",
        "payment_status": purchase.get("status") or "pending",
        "amount_total": purchase.get("amount"),
        "currency": purchase.get("currency"),
        "purchase": purchase,
        "via": "db",
    }


@api_router.post("/payments/confirm/{session_id}")
async def payments_confirm(session_id: str):
    """Marks a purchase as paid based on the Stripe success-redirect URL.
    Stripe redirects to success_url ONLY on successful payment, so this is
    safe enough for the Emergent sandbox where the read API is unavailable.
    For real production, prefer the webhook (/api/payments/webhook).
    """
    purchase = await db.purchases.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if purchase.get("status") != "paid":
        await db.purchases.update_one(
            {"stripe_session_id": session_id},
            {"$set": {"status": "paid", "paid_at": now_utc()}},
        )
        purchase["status"] = "paid"
    return {"ok": True, "purchase": purchase}


@api_router.post("/payments/webhook")
async def payments_webhook(request: Request):
    sc = _get_stripe(request)
    sig = request.headers.get("stripe-signature", "")
    body = await request.body()
    try:
        evt = await sc.handle_webhook(body, sig)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {e}")
    if evt.session_id and (evt.payment_status == "paid"):
        await db.purchases.update_one(
            {"stripe_session_id": evt.session_id},
            {"$set": {"status": "paid", "paid_at": now_utc()}},
        )
    return {"received": True}


@api_router.get("/purchases")
async def list_purchases(user_id: str):
    rows = await db.purchases.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return rows


# ---------------- Voice (clean integration layer) ----------------
@api_router.get("/voice/status")
async def voice_status():
    return {"enabled": voice_svc.is_enabled(), "voices": voice_svc.VOICE_IDS}


# ---------------- Demo / Preview seeding ----------------
@api_router.post("/demo/seed")
async def demo_seed(payload: Dict[str, Any]):
    """Seed sample purchases and saved jobs for a given user_id so the
    preview/demo experience showcases the full account flow without
    going through real payments. Idempotent: clears prior demo rows first.
    """
    user_id = (payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    # Wipe any prior demo rows for this user so seed is idempotent
    await db.purchases.delete_many({"user_id": user_id, "is_demo": True})
    await db.saved_jobs.delete_many({"user_id": user_id, "is_demo": True})

    # Sample saved jobs
    sample_jobs = [
        {"id": str(uuid.uuid4()), "user_id": user_id, "title": "Senior Product Designer", "company": "Northwind Labs", "location": "Remote · UK", "is_demo": True, "created_at": now_utc()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "title": "Customer Success Manager", "company": "Brightline", "location": "London, UK", "is_demo": True, "created_at": now_utc()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "title": "Data Analyst", "company": "Helix Health", "location": "Hybrid · Manchester", "is_demo": True, "created_at": now_utc()},
    ]
    await db.saved_jobs.insert_many([j.copy() for j in sample_jobs])

    # Sample paid purchases
    sample_purchases = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "avatar": "sofia",
            "item_id": "itv-standard",
            "item_title": "Interview Sim · Standard",
            "amount": 899,
            "currency": "gbp",
            "kind": "service",
            "status": "paid",
            "stripe_session_id": f"demo_{uuid.uuid4()}",
            "stripe_url": "",
            "is_demo": True,
            "created_at": now_utc(),
            "paid_at": now_utc(),
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "avatar": "maya",
            "item_id": "jobs-5",
            "item_title": "Job Finder · 5 roles",
            "amount": 699,
            "currency": "gbp",
            "kind": "service",
            "status": "paid",
            "stripe_session_id": f"demo_{uuid.uuid4()}",
            "stripe_url": "",
            "is_demo": True,
            "created_at": now_utc(),
            "paid_at": now_utc(),
        },
    ]
    await db.purchases.insert_many([p.copy() for p in sample_purchases])

    return {"ok": True, "saved_jobs": len(sample_jobs), "purchases": len(sample_purchases)}


@api_router.post("/demo/reset")
async def demo_reset(payload: Dict[str, Any]):
    """Remove all demo-tagged rows for a given user_id."""
    user_id = (payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    p = await db.purchases.delete_many({"user_id": user_id, "is_demo": True})
    j = await db.saved_jobs.delete_many({"user_id": user_id, "is_demo": True})
    return {"ok": True, "purchases_removed": p.deleted_count, "saved_jobs_removed": j.deleted_count}


@api_router.post("/voice/tts")
async def voice_tts(payload: Dict[str, Any]):
    avatar = (payload.get("avatar") or "sofia").lower()
    text = payload.get("text") or ""
    if not voice_svc.is_enabled():
        raise HTTPException(status_code=501, detail="Voice not configured")
    audio = await voice_svc.tts(text, avatar)
    return Response(content=audio, media_type="audio/mpeg")


# ---------------- Integration status (for deploy diagnostics) ----------------
@api_router.get("/integrations/status")
async def integrations_status():
    """Quick health check showing which optional integrations are configured.
    Safe to expose — returns booleans only, never the key values."""
    return {
        "anthropic_direct": bool(os.environ.get("ANTHROPIC_API_KEY", "").strip()),
        "emergent_llm": bool(os.environ.get("EMERGENT_LLM_KEY", "").strip()),
        "adzuna_live": jobs_svc.adzuna_enabled(),
        "stripe": bool(os.environ.get("STRIPE_API_KEY", "").strip()),
        "voice": voice_svc.is_enabled(),
    }


@api_router.get("/health/integrations")
async def health_integrations():
    """Safe integration health endpoint — returns ONLY booleans and short
    non-secret labels (e.g. 'live'/'test'/'missing'). Never exposes any key
    value. Use this to verify which integrations are wired in production."""
    anth_key = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()
    em_key = (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
    adz_id = (os.environ.get("ADZUNA_APP_ID") or "").strip()
    adz_key = (os.environ.get("ADZUNA_APP_KEY") or "").strip()
    # Stripe key may be set under either name in the wild; honour both
    stripe_key = (
        os.environ.get("STRIPE_API_KEY")
        or os.environ.get("STRIPE_SECRET_KEY")
        or ""
    ).strip()
    stripe_webhook = (os.environ.get("STRIPE_WEBHOOK_SECRET") or "").strip()

    if stripe_key.startswith("sk_live_"):
        stripe_mode = "live"
    elif stripe_key.startswith("sk_test_"):
        stripe_mode = "test"
    elif stripe_key:
        stripe_mode = "unknown"
    else:
        stripe_mode = "missing"

    backend_env = (os.environ.get("BACKEND_ENV")
                   or os.environ.get("ENVIRONMENT")
                   or ("production" if os.environ.get("EMERGENT_DEPLOYMENT") else "development"))

    return {
        # Anthropic
        "anthropic_key_present": bool(anth_key),
        "anthropic_direct_enabled": bool(anth_key),  # direct path activates iff key set
        "emergent_llm_present": bool(em_key),
        "llm_provider_active": (
            "anthropic_direct" if anth_key else ("emergent_fallback" if em_key else "none")
        ),
        # Adzuna
        "adzuna_keys_present": bool(adz_id and adz_key),
        "adzuna_live_enabled": jobs_svc.adzuna_enabled(),
        "adzuna_country": (os.environ.get("ADZUNA_COUNTRY") or "gb"),
        # Stripe
        "stripe_secret_key_present": bool(stripe_key),
        "stripe_mode": stripe_mode,
        "stripe_checkout_enabled": bool(stripe_key),
        "stripe_webhook_secret_present": bool(stripe_webhook),
        "stripe_webhook_enabled": bool(stripe_webhook),
        # Voice
        "voice_enabled": voice_svc.is_enabled(),
        # Environment / backend identity
        "backend_env": backend_env,
        "backend_host": (os.environ.get("HOSTNAME") or "")[:32],
        "production_backend_url_used": (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or ""),
    }


# ---------------- Wire up app ----------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://revoloai.com",
        "https://www.revoloai.com",
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:19006",
        "http://localhost:19000",
    ],
    # Allow any subdomain of revoloai.com, any *.netlify.app preview, any
    # *.preview.emergentagent.com dev preview, and any localhost:* port.
    allow_origin_regex=r"^(https?://localhost(:\d+)?|https://([a-z0-9-]+\.)?revoloai\.com|https://[a-z0-9-]+\.netlify\.app|https://[a-z0-9-]+\.preview\.emergentagent\.com|https://[a-z0-9-]+\.emergent\.host|https://[a-z0-9-]+\.emergentagent\.com)$",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()
