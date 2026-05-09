# RevoloAI - Career Spark Mobile App

## Overview
Premium mobile-first re-implementation of revoloai (career-spark-ai) Lovable web app in Expo React Native.
Three AI career assistants (Maya, Sofia, Aria) help users find jobs, practice interviews, and plan careers.

## Key Features
- Hero with avatar trio, gradient backdrop, scroll-to-services CTA
- Language selector (8 languages, persisted in component state)
- Trust & Safety grid — each card opens an info modal
- Three service rails (Maya/Sofia/Aria) with 9 paid services and three Smart Bundles
- Conversation demo wired to live chat (Sofia)
- Sticky bottom nav: avatar pills + dynamic primary CTA ("Start with X")
- Per-avatar chat modal (`/chat`) with scripted contextual replies, suggestions, typing dots, mic permission, send
- Checkout modal (`/checkout`) with item summary, Stripe/PayPal selector, simulated pay → success → "Start session" → opens chat
- Account section: Sign in/out (AsyncStorage), Purchases & Saved jobs tabs (live MongoDB-backed)
- Final CTA, footer

## Backend Endpoints
- `GET /api/` — health
- `GET /api/avatars/{maya|sofia|aria}` — PNG (404 for unknown)
- `POST /api/chat` — `{avatar, message, history}` → `{reply, suggestions[]}`
- `POST /api/purchases`, `GET /api/purchases?user_id=`
- `POST /api/saved-jobs`, `GET /api/saved-jobs?user_id=`, `DELETE /api/saved-jobs/{id}?user_id=`
- `POST /api/status`, `GET /api/status` (placeholder)

## Tech Stack
- Expo SDK 54, expo-router (file-based + modal screens)
- expo-linear-gradient, expo-blur, expo-haptics
- @react-native-async-storage/async-storage (guest user_id + name)
- @expo/vector-icons (Ionicons)
- FastAPI + Motor (MongoDB)

## Notes
- Cross-platform Avatar component renders native `<img>` on web for reliable rendering; `Image` on native.
- Guest user_id auto-generated and persisted on first launch.
- Chat replies are scripted per-persona on the backend (no external LLM yet; can swap in Emergent LLM key later).
- Payment is simulated end-to-end (records purchase in DB; no real card processing).
