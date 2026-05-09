"""Voice integration layer. Currently a clean stub for ElevenLabs.
Drop in `ELEVENLABS_API_KEY` in env to enable. All endpoints return 501 until then.
"""
from __future__ import annotations
import os
from typing import Optional

ELEVENLABS_API_KEY: Optional[str] = os.getenv("ELEVENLABS_API_KEY")

# Default voice IDs per persona — placeholder slugs; users can override later.
VOICE_IDS = {
    "maya": "EXAVITQu4vr4xnSDxMaL",   # Bella (warm, friendly female)
    "sofia": "21m00Tcm4TlvDq8ikWAM",  # Rachel (clear, professional)
    "aria": "AZnzlk1XvdvUeBnXmlld",   # Domi (calm, encouraging)
}


def is_enabled() -> bool:
    return bool(ELEVENLABS_API_KEY)


async def tts(text: str, avatar: str) -> bytes:
    """Synthesize speech for an avatar persona. Raises if not configured."""
    if not is_enabled():
        raise RuntimeError("ElevenLabs not configured. Set ELEVENLABS_API_KEY.")
    import httpx  # local import so tests don't require it
    voice_id = VOICE_IDS.get(avatar, VOICE_IDS["sofia"])
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "accept": "audio/mpeg",
        "content-type": "application/json",
    }
    body = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {"stability": 0.4, "similarity_boost": 0.75, "style": 0.2},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, json=body, headers=headers)
        r.raise_for_status()
        return r.content


async def stt(audio_bytes: bytes) -> str:
    """Speech-to-text. Stub — to be wired to ElevenLabs / Whisper when key is present."""
    if not is_enabled():
        raise RuntimeError("Voice STT not configured.")
    raise NotImplementedError("STT pipeline not yet wired.")
