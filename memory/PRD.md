# RevoloAI - Career Spark Mobile App

## Overview
Premium mobile-first AI career platform built on Expo + FastAPI.
Three persona avatars (Maya, Sofia, Aria) deliver Job Finding, adaptive
Interview Coaching, and Career Coaching — all powered by real LLMs.

## Intelligence Stack
- **Claude Sonnet 4.5** (via Emergent universal LLM key) — chat with all
  three personas, persistent per-session history in MongoDB.
- **OpenAI gpt-4o-mini** (via Emergent universal LLM key) — strict-JSON
  structured tasks: profile extraction, adaptive interview question
  generation, 5-axis answer scoring, end-of-interview summary.
- **Job-matching service** (`backend/services/jobs.py`) — typed integration
  layer with heuristic ranker (role keyword overlap + seniority alignment +
  remote preference + skills overlap + salary alignment). Curated 10-job
  pool today; swap `search_pool` for an Adzuna/Reed client without changing
  call sites.
- **Voice service** (`backend/services/voice.py`) — clean ElevenLabs stub
  with per-persona voice IDs; `GET /api/voice/status`, `POST /api/voice/tts`
  return 501 until `ELEVENLABS_API_KEY` is set.

## API Surface
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/` | health |
| GET | `/api/avatars/{name}` | avatar PNG |
| POST | `/api/chat` | Claude chat (`{avatar, message, session_id?, user_id?}` → `{session_id, reply, suggestions}`) |
| GET | `/api/chat/{session_id}` | persisted session |
| POST | `/api/profile/extract` | extract structured profile from session/transcript |
| GET / PUT | `/api/profile/{user_id}` | read / upsert profile |
| POST | `/api/jobs/match` | scored matches for the user's profile |
| POST | `/api/interview/start` | create adaptive interview |
| POST | `/api/interview/answer` | score answer + next adaptive question (or summary if last) |
| GET | `/api/interview/{id}` | interview state with scores |
| POST | `/api/payments/checkout` | create Stripe Checkout session (server-priced via catalog) |
| GET | `/api/payments/status/{id}` | resilient status (Stripe with DB fallback) |
| POST | `/api/payments/confirm/{id}` | mark paid from success-url redirect (Emergent sandbox) |
| POST | `/api/payments/webhook` | Stripe webhook handler |
| GET | `/api/voice/status` / POST `/api/voice/tts` | voice integration layer |
| GET / POST / DELETE | `/api/saved-jobs` | per-user saved jobs |
| GET | `/api/purchases?user_id=` | per-user purchase history |

## Frontend Routes
- `/` (`index.tsx`) — full marketing surface, sticky CTA, account
- `/chat` — modal chat with persona; "Find jobs" / "Start interview" CTA
- `/jobs` — Maya's matched jobs with score, save, "Get prep" → Aria
- `/interview` — adaptive Sofia interview with progress and last-answer feedback
- `/results` — radar chart + verdict + summary + next steps
- `/checkout` — Stripe Checkout redirect with status polling and confirm-on-return

## Tech Stack
- Expo SDK 54, expo-router (file-based + modal screens)
- expo-linear-gradient, expo-blur, expo-haptics, react-native-svg
- @react-native-async-storage/async-storage (guest user_id + name)
- @expo/vector-icons (Ionicons)
- FastAPI + Motor (MongoDB) + emergentintegrations (LLM + Stripe)

## Environment
`/app/backend/.env`
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
EMERGENT_LLM_KEY=...
STRIPE_API_KEY=sk_test_emergent
# ELEVENLABS_API_KEY= (optional, enables /api/voice/* endpoints)
```

## Notes
- Stripe `sk_test_emergent` routes through Emergent proxy. Proxy's
  read-side returns 404, so `/payments/status` falls back to local DB and
  payments are confirmed via `/payments/confirm/{session_id}` triggered by
  the success-URL redirect parameters (`?paid=1&session={CHECKOUT_SESSION_ID}`).
- Catalog is the **single source of truth for prices** (`services/catalog.py`).
  Frontend only sends `item_id`; price is resolved server-side for security.
