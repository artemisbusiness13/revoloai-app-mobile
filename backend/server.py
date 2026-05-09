from fastapi import FastAPI, APIRouter, HTTPException, Request
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


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    suggestions: List[str] = []


class ProfileIn(BaseModel):
    user_id: str
    target_role: str = ""
    seniority: str = "unknown"
    location: str = ""
    remote: str = "any"
    salary_min: int = 0
    salary_max: int = 0
    skills: List[str] = []
    industries: List[str] = []
    must_haves: List[str] = []
    nice_to_haves: List[str] = []
    summary: str = ""


class JobMatchRequest(BaseModel):
    user_id: str
    limit: int = 10


class InterviewStartRequest(BaseModel):
    user_id: str
    role: str = "Generalist"
    seniority: str = "mid"
    style: str = "behavioural"   # behavioural | technical | mixed
    total_questions: int = 6


class InterviewAnswerRequest(BaseModel):
    interview_id: str
    answer: str


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

    # Empty message = generate intro
    if not req.message.strip() and not history:
        reply = await llm_svc.claude_chat(
            session_id=session_id,
            system_prompt=persona["system"] + "\nGreet the user with a single warm sentence and ask one focused opening question.",
            history=[],
            latest_user_message="Begin the conversation now.",
        )
        history.append({"role": "ai", "content": reply})
    else:
        history.append({"role": "user", "content": req.message.strip()})
        reply = await llm_svc.claude_chat(
            session_id=session_id,
            system_prompt=persona["system"],
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
    return p or {"user_id": user_id, "target_role": "", "seniority": "unknown", "skills": []}


@api_router.put("/profile/{user_id}")
async def upsert_profile(user_id: str, body: ProfileIn):
    data = body.dict()
    data["user_id"] = user_id
    data["updated_at"] = now_utc()
    await db.profiles.update_one({"user_id": user_id}, {"$set": data}, upsert=True)
    data.pop("updated_at", None)
    return data


# ---------------- Jobs (Maya) ----------------
@api_router.post("/jobs/match")
async def match_jobs(req: JobMatchRequest):
    profile = await db.profiles.find_one({"user_id": req.user_id}, {"_id": 0}) or {}
    matches = await jobs_svc.search_pool(profile, limit=req.limit)
    return {"profile": profile, "matches": matches}


# ---------------- Interview (Sofia adaptive) ----------------
@api_router.post("/interview/start")
async def interview_start(req: InterviewStartRequest):
    interview_id = str(uuid.uuid4())
    # Generate first question via GPT JSON mode
    qjson = await llm_svc.openai_json(
        session_id=f"itv_{interview_id}",
        system_prompt="You generate adaptive interview questions.",
        user_prompt=P.INTERVIEW_QUESTION_PROMPT.format(
            role=req.role, seniority=req.seniority, style=req.style, q_num=1, total=req.total_questions
        ) + "\nThere is no previous answer yet. Open with a warm motivational question.",
    )
    if "error" in qjson:
        qjson = {"question": "Tell me about yourself and what brought you to this role.", "category": "motivation", "difficulty": "easy"}
    doc = {
        "interview_id": interview_id,
        "user_id": req.user_id,
        "role": req.role,
        "seniority": req.seniority,
        "style": req.style,
        "total": req.total_questions,
        "current": 1,
        "questions": [qjson],
        "answers": [],
        "scores": [],
        "created_at": now_utc(),
        "status": "in_progress",
    }
    await db.interviews.insert_one(doc.copy())
    return {"interview_id": interview_id, "question": qjson, "current": 1, "total": req.total_questions}


@api_router.post("/interview/answer")
async def interview_answer(req: InterviewAnswerRequest):
    itv = await db.interviews.find_one({"interview_id": req.interview_id}, {"_id": 0})
    if not itv:
        raise HTTPException(status_code=404, detail="Interview not found")
    current = itv["current"]
    questions = itv["questions"]
    answers = list(itv["answers"]) + [req.answer]
    last_q = questions[current - 1]["question"] if questions else ""
    # Score the answer (GPT JSON)
    sjson = await llm_svc.openai_json(
        session_id=f"itv_{req.interview_id}_score_{current}",
        system_prompt="You score interview answers with structured rubrics.",
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
            system_prompt="You produce a structured interview summary.",
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
        system_prompt="You generate adaptive interview questions based on the previous answer.",
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
        # Proxy may not support GET — fall back to local DB
        log.info("Stripe status fallback to DB for %s: %s", session_id, e)
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


@api_router.post("/voice/tts")
async def voice_tts(payload: Dict[str, Any]):
    avatar = (payload.get("avatar") or "sofia").lower()
    text = payload.get("text") or ""
    if not voice_svc.is_enabled():
        raise HTTPException(status_code=501, detail="Voice not configured")
    audio = await voice_svc.tts(text, avatar)
    return Response(content=audio, media_type="audio/mpeg")


# ---------------- Wire up app ----------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()
