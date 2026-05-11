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


def _resolve_stripe_key() -> str:
    """Resolve the Stripe API key. Accepts either STRIPE_API_KEY (legacy)
    or STRIPE_SECRET_KEY (Stripe's own naming). A LIVE key (sk_live_*) wins
    over a test/sandbox key (sk_test_emergent) when both are set, so the
    presence of the Emergent sandbox key never accidentally overrides a real
    live key the operator has configured."""
    a = (os.environ.get("STRIPE_API_KEY") or "").strip()
    b = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    # Prefer a real Stripe key (live or proper test) over the Emergent sandbox.
    candidates = [k for k in (a, b) if k]
    real = next((k for k in candidates if k.startswith(("sk_live_", "sk_test_")) and "emergent" not in k), None)
    if real:
        return real
    # Otherwise, return whichever is set (may be the Emergent sandbox).
    return a or b


def _stripe_mode_label(api_key: str) -> str:
    if not api_key:
        return "missing"
    if api_key.startswith("sk_live_"):
        return "live"
    if "sk_test_emergent" in api_key:
        return "emergent_sandbox"
    if api_key.startswith("sk_test_"):
        return "test"
    return "unknown"


def _get_stripe(request: Request) -> StripeCheckout:
    """Return a fresh StripeCheckout instance using whichever key the operator
    has configured (STRIPE_API_KEY or STRIPE_SECRET_KEY). The library routes
    through the Emergent proxy ONLY when the key literally contains
    'sk_test_emergent'."""
    api_key = _resolve_stripe_key()
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
    # New: required for logged-in payments. The frontend must send these when
    # the user has an authenticated session. The backend rejects anonymous
    # (guest_id `g_...`) payments below.
    user_email: Optional[str] = None
    avatar_id: Optional[str] = None
    return_path: Optional[str] = None
    chat_path: Optional[str] = None


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

    # If exactly ONE critical search field is missing, prepend a deterministic
    # instruction so the model asks for that single missing field by name.
    if profile:
        critical = {
            "target_role": "target_role (the job title they want)",
            "location": "location (which city, country, or 'remote')",
            "remote": "work setup (remote, hybrid, or onsite)",
        }
        missing = []
        for k, label in critical.items():
            v = profile.get(k)
            if not v or (isinstance(v, str) and not v.strip()) or v in ("unknown", "any"):
                missing.append((k, label))
        if len(missing) == 1:
            mk, ml = missing[0]
            base_system += (
                f"\n\nMISSING ONE FIELD: The user's profile is complete except for {ml}. "
                f"In your next reply, ask ONLY for {mk} in one short, friendly sentence. "
                f"Do not ask about any other field. Do not summarise the rest of the profile."
            )
        elif len(missing) == 0 and avatar == "maya":
            base_system += (
                "\n\nALL CORE FIELDS ARE FILLED. If the user asks to start a search, "
                "confirm in one short sentence that you'll search using their saved "
                "target_role, location and work setup. Do not re-ask any field."
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


@api_router.get("/profile/me")
async def get_profile_me(authorization: Optional[str] = Header(default=None)):
    """Return the saved profile for the currently logged-in user.
    Authentication via Bearer token. Returns the FULL profile so the avatar
    chat / paid job search can render an accurate context summary.
    Note: this route is registered BEFORE the dynamic /profile/{user_id}
    route below so FastAPI doesn't match "me" as a user_id.
    """
    user = await auth_svc.user_from_token(db, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="not authenticated")
    p = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not p:
        p = {"user_id": user["user_id"], "completed": False}
    p.pop("updated_at", None)
    return {
        "ok": True,
        "user": {"user_id": user["user_id"], "email": user.get("email", ""), "name": user.get("name", "")},
        "profile": p,
        "profile_completed": bool(p.get("completed")),
    }


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
    result = await jobs_svc.search(profile, limit=req.limit)
    # Backwards-compatible: surface matches at the top level so older clients
    # keep working, plus the new fields (`status`, `query`, `where`, `count`).
    return {
        "profile": profile,
        "matches": result.get("matches", []),
        "status": result.get("status", "ok"),
        "query": result.get("query", ""),
        "where": result.get("where", ""),
        "count": result.get("count", 0),
        "live": jobs_svc.adzuna_enabled(),
    }


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

    # --- REQUIRE LOGGED-IN USER (no anonymous payments) ---
    # A registered user_id starts with `u_`. Guest ids start with `g_`.
    uid = (body.user_id or "").strip()
    if not uid or not uid.startswith("u_"):
        raise HTTPException(status_code=401, detail="login_required")

    # Resolve user from DB to confirm they exist and capture canonical email.
    user_row = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
    if not user_row:
        raise HTTPException(status_code=401, detail="login_required")

    user_email = (body.user_email or user_row.get("email") or "").strip().lower()
    if not user_email or "@" not in user_email:
        raise HTTPException(status_code=400, detail="email_required")
    user_name = user_row.get("name") or ""
    avatar_id = (body.avatar_id or item.get("avatar") or "").strip().lower() or None
    return_path = (body.return_path or body.chat_path or "").strip() or None

    sc = _get_stripe(request)
    purchase_id = str(uuid.uuid4())
    # Stripe metadata: keep keys flat & string-typed (Stripe spec). Webhook reads
    # these to identify which user/service the payment belongs to.
    metadata: Dict[str, str] = {
        "purchase_id": purchase_id,
        "user_id": uid,
        "user_email": user_email,
        "item_id": body.item_id,
        "service_id": body.item_id,
        "avatar": item["avatar"],
        "avatar_id": avatar_id or item["avatar"],
        "kind": item["kind"],
    }
    if return_path:
        metadata["return_path"] = return_path[:200]  # Stripe caps metadata values at 500

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
        "user_id": uid,
        "user_email": user_email,
        "user_name": user_name,
        "avatar": item["avatar"],
        "avatar_id": metadata["avatar_id"],
        "item_id": body.item_id,
        "service_id": body.item_id,
        "item_title": item["title"],
        "amount": item["amount"],
        "currency": item["currency"],
        "kind": item["kind"],
        "status": "pending",
        "return_path": return_path,
        "stripe_session_id": sess.session_id,
        "stripe_url": sess.url,
        "created_at": now_utc(),
    }
    await db.purchases.insert_one(purchase.copy())
    return {
        "purchase_id": purchase_id,
        "session_id": sess.session_id,
        "url": sess.url,
        "amount": item["amount"],
        "currency": item["currency"],
    }


@api_router.get("/payments/status/{session_id}")
async def payments_status(session_id: str, request: Request):
    """Return payment status. Tries Stripe first; falls back to our local
    DB record (updated by webhook OR /payments/confirm)."""
    purchase = await db.purchases.find_one({"stripe_session_id": session_id}, {"_id": 0})
    use_emergent_sandbox = "sk_test_emergent" in _resolve_stripe_key()
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


# ---------------- Stripe webhook ----------------
import stripe as _stripe_sdk  # official Stripe SDK for signature verification


@api_router.post("/payments/webhook")
async def stripe_webhook(request: Request):
    """Stripe webhook endpoint. Verifies signature, then handles
    checkout.session.completed and checkout.session.async_payment_succeeded
    events to mark the matching purchase as paid. Idempotent — every event
    is recorded in the `stripe_events` collection by event_id.
    """
    raw_body = await request.body()
    sig_header = request.headers.get("Stripe-Signature") or request.headers.get("stripe-signature") or ""
    webhook_secret = (os.environ.get("STRIPE_WEBHOOK_SECRET") or "").strip()

    # 1) Verify signature when a webhook secret is configured. In sandbox /
    # local dev where no secret is set we still parse the JSON body so
    # /_handle_checkout_session_paid runs and the audit fields are written.
    # In production set STRIPE_WEBHOOK_SECRET to enable strict verification.
    if webhook_secret:
        try:
            event = _stripe_sdk.Webhook.construct_event(
                payload=raw_body,
                sig_header=sig_header,
                secret=webhook_secret,
            )
        except _stripe_sdk.error.SignatureVerificationError as e:
            log.warning("Stripe webhook bad signature: %s", e)
            raise HTTPException(status_code=400, detail="Invalid signature")
        except ValueError as e:
            log.warning("Stripe webhook bad payload: %s", e)
            raise HTTPException(status_code=400, detail="Invalid payload")
    else:
        # No secret configured — accept the raw JSON. This path is for sandbox
        # / proxy-driven flows only. Log loudly so this never lands in prod.
        log.warning("Stripe webhook accepted UNVERIFIED (no STRIPE_WEBHOOK_SECRET set)")
        try:
            import json as _json
            event = _json.loads(raw_body or b"{}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    event_id = event.get("id") or ""
    event_type = event.get("type") or ""
    livemode = bool(event.get("livemode"))

    # 2) Idempotency — we have already processed this event_id, ack and stop
    if event_id:
        existing = await db.stripe_events.find_one({"event_id": event_id}, {"_id": 0, "status": 1})
        if existing and existing.get("status") == "processed":
            return {"received": True, "idempotent": True, "event_id": event_id}
        # Insert a "received" marker now so concurrent retries are deduped
        try:
            await db.stripe_events.insert_one({
                "event_id": event_id,
                "type": event_type,
                "livemode": livemode,
                "status": "received",
                "received_at": now_utc(),
            })
        except Exception:
            # Duplicate insert (unique index). Another worker is processing it.
            return {"received": True, "idempotent": True, "event_id": event_id}

    # 3) Dispatch to handler
    try:
        if event_type in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
            await _handle_checkout_session_paid(event["data"]["object"], event_id)
        else:
            # Unhandled event types are still acknowledged so Stripe stops retrying
            log.info("Stripe webhook: ignored event type %s (id=%s)", event_type, event_id)
    except Exception as e:
        log.exception("Stripe webhook handler error for %s (%s): %s", event_id, event_type, e)
        # Mark as failed so Stripe retries it
        if event_id:
            await db.stripe_events.update_one(
                {"event_id": event_id},
                {"$set": {"status": "failed", "error": str(e)[:500], "failed_at": now_utc()}},
            )
        raise HTTPException(status_code=500, detail="Handler error — Stripe will retry")

    if event_id:
        await db.stripe_events.update_one(
            {"event_id": event_id},
            {"$set": {"status": "processed", "processed_at": now_utc()}},
        )

    return {"received": True, "event_id": event_id, "type": event_type}


async def _handle_checkout_session_paid(session: Dict[str, Any], event_id: str) -> None:
    """Mark the matching purchase row as paid and (implicitly) unlock the tier.
    Tier resolution happens at read time in services/personalization.active_tier()
    by reading the user's most recent paid purchase per avatar — so simply
    flipping `status` to "paid" with the timestamp is enough.
    """
    session_id = session.get("id") or ""
    if not session_id:
        log.warning("Webhook session missing id; event=%s", event_id)
        return

    payment_status = session.get("payment_status") or ""  # 'paid', 'unpaid', 'no_payment_required'
    if payment_status not in ("paid", "no_payment_required"):
        log.info("Webhook session %s payment_status=%s — not marking paid", session_id, payment_status)
        return

    metadata = session.get("metadata") or {}
    # Locate the purchase row. Prefer the stripe_session_id we stored at create time.
    purchase = await db.purchases.find_one({"stripe_session_id": session_id})
    if not purchase:
        # Fallback: try by metadata.purchase_id (in case the row was created differently)
        pid = metadata.get("purchase_id")
        if pid:
            purchase = await db.purchases.find_one({"id": pid})

    if not purchase:
        log.warning("Webhook: no purchase row found for session_id=%s (event=%s)", session_id, event_id)
        return

    # Idempotent on the row itself — only flip from non-paid to paid
    if purchase.get("status") == "paid":
        return

    update = {
        "status": "paid",
        "paid_at": now_utc(),
        "paid_via_webhook": True,
        "stripe_event_id": event_id,
    }
    # Capture additional metadata if missing on the row
    if not purchase.get("amount") and session.get("amount_total"):
        update["amount"] = int(session["amount_total"])
    if not purchase.get("currency") and session.get("currency"):
        update["currency"] = str(session["currency"]).lower()

    await db.purchases.update_one(
        {"_id": purchase["_id"]},
        {"$set": update},
    )
    log.info(
        "Webhook: purchase %s marked PAID (user=%s, item=%s, avatar=%s, event=%s)",
        purchase.get("id"), purchase.get("user_id"), purchase.get("item_id"),
        purchase.get("avatar"), event_id,
    )


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
    # Stripe — check which key the CHECKOUT CODE actually uses (not just presence)
    checkout_key = _resolve_stripe_key()
    raw_api = (os.environ.get("STRIPE_API_KEY") or "").strip()
    raw_secret = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    stripe_mode = _stripe_mode_label(checkout_key)
    stripe_webhook = (os.environ.get("STRIPE_WEBHOOK_SECRET") or "").strip()

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
        "stripe_secret_key_present": bool(checkout_key),
        "stripe_api_key_var_present": bool(raw_api),
        "stripe_secret_key_var_present": bool(raw_secret),
        "stripe_mode": stripe_mode,
        "stripe_checkout_enabled": bool(checkout_key),
        "stripe_checkout_routes_through_emergent_sandbox": (stripe_mode == "emergent_sandbox"),
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

# ---------------- CORS ----------------
# Reads `CORS_ORIGINS` from env (comma-separated). Falls back to a sensible
# default list that already includes the production domain. The regex
# additionally permits any *.revoloai.com, any *.netlify.app preview, any
# *.preview.emergentagent.com dev preview, and any localhost:* port — so
# Netlify deploy previews and the Emergent dev preview keep working.
_DEFAULT_CORS = ",".join([
    "https://revoloai.com",
    "https://www.revoloai.com",
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:19006",
    "http://localhost:19000",
])
_cors_env = (os.environ.get("CORS_ORIGINS") or _DEFAULT_CORS).strip()
CORS_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"^(https?://localhost(:\d+)?|https://([a-z0-9-]+\.)?revoloai\.com|https://[a-z0-9-]+\.netlify\.app|https://[a-z0-9-]+\.preview\.emergentagent\.com|https://[a-z0-9-]+\.emergent\.host|https://[a-z0-9-]+\.emergentagent\.com)$",
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["Content-Disposition"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()


@app.on_event("startup")
async def _ensure_indexes():
    """Create the indexes needed for idempotent webhook processing and fast
    lookups. Safe to call repeatedly — `create_index` is a no-op if it already
    exists with the same definition."""
    try:
        await db.stripe_events.create_index("event_id", unique=True, name="uniq_event_id")
        await db.purchases.create_index("stripe_session_id", name="purchases_stripe_session_id")
        await db.purchases.create_index([("user_id", 1), ("avatar", 1), ("status", 1), ("paid_at", -1)],
                                        name="purchases_tier_lookup")
        await db.users.create_index("email", unique=True, name="users_email")
        await db.sessions.create_index("token", unique=True, name="sessions_token")
        await db.profiles.create_index("user_id", unique=True, name="profiles_user_id")
    except Exception as e:
        log.warning("Index creation warning: %s", e)
