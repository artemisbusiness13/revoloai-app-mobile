"""LLM service abstraction. Uses Emergent universal key for Claude (chat) and GPT (structured)."""
from __future__ import annotations
import os
import json
import logging
from typing import List, Dict, Any, Optional
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY", "")

CLAUDE_MODEL = ("anthropic", "claude-sonnet-4-5-20250929")
OPENAI_MODEL = ("openai", "gpt-4o-mini")
HAIKU_MODEL = ("anthropic", "claude-haiku-4-5-20251001")


def _new_chat(session_id: str, system_prompt: str, provider_model: tuple = CLAUDE_MODEL) -> LlmChat:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_prompt,
    ).with_model(*provider_model)
    return chat


async def claude_chat(
    session_id: str,
    system_prompt: str,
    history: List[Dict[str, str]],
    latest_user_message: str,
) -> str:
    """Send a single user message and return Claude's reply.
    The library maintains its own internal history per LlmChat instance,
    so we re-seed by sending all prior messages in order before the new one
    only when there's no prior conversation in this process. Since we create
    a fresh LlmChat per request, we instead build a single composite user
    message that includes any unsent context. For simplicity and reliability,
    we serialise prior history into the system prompt as a compact transcript
    and send only the latest user message.
    """
    if not EMERGENT_LLM_KEY:
        return "(LLM key missing — please configure EMERGENT_LLM_KEY)"
    transcript = ""
    for m in history[-12:]:
        role = "User" if m.get("role") == "user" else "Assistant"
        transcript += f"\n{role}: {m.get('content', '').strip()}"
    sys = system_prompt + (
        f"\n\nConversation so far (most recent last):{transcript}\n\nContinue the conversation naturally."
        if transcript
        else ""
    )
    chat = _new_chat(session_id, sys, CLAUDE_MODEL)
    try:
        reply = await chat.send_message(UserMessage(text=latest_user_message))
        return (reply or "").strip()
    except Exception as e:
        logger.exception("Claude chat error")
        return f"(I had trouble generating a reply right now. Please try again.)"


async def openai_json(
    session_id: str,
    system_prompt: str,
    user_prompt: str,
) -> Dict[str, Any]:
    """Use GPT to return a strict JSON object. We instruct the model and parse defensively."""
    if not EMERGENT_LLM_KEY:
        return {"error": "LLM key missing"}
    sys = (
        system_prompt
        + "\n\nYou MUST respond with a single valid JSON object only — no prose, no markdown fences."
    )
    chat = _new_chat(session_id, sys, OPENAI_MODEL)
    try:
        raw = await chat.send_message(UserMessage(text=user_prompt))
        text = (raw or "").strip()
        # Strip ``` fences if any
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
            text = text.strip()
        # Try to find the first { ... } JSON block
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("OpenAI returned non-JSON: %s", raw[:200] if 'raw' in locals() else "")
        return {"error": "invalid_json", "raw": raw if 'raw' in locals() else ""}
    except Exception as e:
        logger.exception("OpenAI error")
        return {"error": str(e)}
