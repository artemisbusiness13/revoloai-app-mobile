from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------------- Models ----------------
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class ChatMessage(BaseModel):
    role: str  # 'user' | 'ai'
    content: str


class ChatRequest(BaseModel):
    avatar: str  # maya | sofia | aria
    message: str
    history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    suggestions: List[str] = []


class PurchaseCreate(BaseModel):
    user_id: str
    avatar: str
    item_id: str
    item_title: str
    price: str
    kind: str = "service"  # service | bundle


class Purchase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    avatar: str
    item_id: str
    item_title: str
    price: str
    kind: str
    status: str = "paid"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SavedJobCreate(BaseModel):
    user_id: str
    title: str
    company: str = ""
    location: str = ""


class SavedJob(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    company: str
    location: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    obj = StatusCheck(**input.dict())
    await db.status_checks.insert_one(obj.dict())
    return obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    rows = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    return [StatusCheck(**r) for r in rows]


# Avatars
ASSETS_DIR = ROOT_DIR.parent / "frontend" / "assets" / "images"


@api_router.get("/avatars/{name}")
async def get_avatar(name: str):
    safe = {"maya", "sofia", "aria"}
    if name not in safe:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return FileResponse(str(ASSETS_DIR / f"avatar-{name}.png"), media_type="image/png")


# Chat (scripted contextual replies — feels alive)
PERSONAS: Dict[str, Dict[str, Any]] = {
    "maya": {
        "name": "Maya",
        "role": "Job Finder",
        "intro": [
            "Hi, I'm Maya. Tell me your role and city, and I'll line up matched jobs.",
            "Hey! What kind of role are you targeting next?",
        ],
        "general": [
            "Got it. Anything you want me to filter for — remote, salary band, seniority?",
            "Nice. Want me to focus on full-time, contract, or both?",
            "I can shortlist 3, 5, or 10 roles — which sounds right today?",
        ],
        "suggestions": [
            "Find product roles in London",
            "Remote senior engineer",
            "Show me 5 graduate roles",
        ],
    },
    "sofia": {
        "name": "Sofia",
        "role": "Interview Coach",
        "intro": [
            "Hey, I'm Sofia. Let's run a real mock interview — what role are we prepping for?",
            "Hi! Which interview is coming up? I'll tailor the questions.",
        ],
        "general": [
            "Good. Tell me about a project you're proud of.",
            "Nice — what was the hardest trade-off?",
            "Walk me through a time you disagreed with a teammate. What happened?",
            "How did you measure success on that project?",
        ],
        "suggestions": [
            "Run a 6-question mock",
            "Tougher behavioural questions",
            "Score my last answer",
        ],
    },
    "aria": {
        "name": "Aria",
        "role": "Career Coach",
        "intro": [
            "Hi, I'm Aria. Where do you want to be 12 months from now?",
            "Hey — share your CV highlights and I'll map your next move.",
        ],
        "general": [
            "Great. Which two skills feel like the biggest gaps right now?",
            "Let's break this into a 30-day plan. What's week one for you?",
            "If we doubled your impact, what would that look like in your current role?",
        ],
        "suggestions": [
            "Build a 12-month plan",
            "Review my CV bullets",
            "What skills should I learn next?",
        ],
    },
}


@api_router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    persona = PERSONAS.get(req.avatar.lower())
    if not persona:
        raise HTTPException(status_code=404, detail="Unknown avatar")
    msg = (req.message or "").strip().lower()
    is_first = len(req.history) == 0
    if is_first and not msg:
        reply = random.choice(persona["intro"])
    elif "price" in msg or "cost" in msg or "£" in msg:
        reply = "We're pay-per-use, no subscription. Tap a card on the home screen to see options."
    elif "thanks" in msg or "thank you" in msg:
        reply = "Anytime. Want to keep going?"
    elif "?" in msg and len(msg) < 80:
        reply = random.choice(persona["general"])
    else:
        reply = random.choice(persona["general"])
    return ChatResponse(reply=reply, suggestions=persona["suggestions"])


# Purchases (mock pay flow — records purchase, no real card)
@api_router.post("/purchases", response_model=Purchase)
async def create_purchase(input: PurchaseCreate):
    obj = Purchase(**input.dict())
    await db.purchases.insert_one(obj.dict())
    return obj


@api_router.get("/purchases", response_model=List[Purchase])
async def list_purchases(user_id: str):
    rows = await db.purchases.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Purchase(**r) for r in rows]


# Saved jobs
@api_router.post("/saved-jobs", response_model=SavedJob)
async def save_job(input: SavedJobCreate):
    obj = SavedJob(**input.dict())
    await db.saved_jobs.insert_one(obj.dict())
    return obj


@api_router.get("/saved-jobs", response_model=List[SavedJob])
async def list_saved_jobs(user_id: str):
    rows = await db.saved_jobs.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [SavedJob(**r) for r in rows]


@api_router.delete("/saved-jobs/{job_id}")
async def delete_saved_job(job_id: str, user_id: str):
    res = await db.saved_jobs.delete_one({"id": job_id, "user_id": user_id})
    return {"deleted": res.deleted_count}


# include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
