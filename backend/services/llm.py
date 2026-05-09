"""LLM service abstraction. Uses Emergent universal key for Claude (chat) and GPT (structured)."""
from __future__ import annotations
import os
import json
import logging
from typing import List, Dict, Any, Optional
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()

CLAUDE_MODEL = ("anthropic", "claude-sonnet-4-5-20250929")
OPENAI_MODEL = ("openai", "gpt-4o-mini")
HAIKU_MODEL = ("anthropic", "claude-haiku-4-5-20251001")

# Direct Anthropic SDK model name (used only when ANTHROPIC_API_KEY is provided).
DIRECT_CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

_anthropic_client = None
def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None and ANTHROPIC_API_KEY:
        try:
            from anthropic import AsyncAnthropic  # imported lazily
            _anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        except Exception as e:
            logger.exception("Failed to init Anthropic client: %s", e)
            _anthropic_client = None
    return _anthropic_client


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

    Routing:
      - If ANTHROPIC_API_KEY is set -> use Anthropic SDK directly (production path).
      - Else -> fall back to Emergent universal key.
    """
    transcript = ""
    for m in history[-12:]:
        role = "User" if m.get("role") == "user" else "Assistant"
        transcript += f"\n{role}: {m.get('content', '').strip()}"
    sys_with_history = system_prompt + (
        f"\n\nConversation so far (most recent last):{transcript}\n\nContinue the conversation naturally."
        if transcript
        else ""
    )

    # ---- Direct Anthropic path ----
    client = _get_anthropic_client()
    if client is not None:
        try:
            msg = await client.messages.create(
                model=DIRECT_CLAUDE_MODEL,
                max_tokens=1024,
                system=sys_with_history,
                messages=[{"role": "user", "content": latest_user_message}],
            )
            parts = [b.text for b in (msg.content or []) if getattr(b, "type", None) == "text"]
            return ("".join(parts) or "").strip() or "(empty reply)"
        except Exception as e:
            logger.exception("Direct Anthropic chat error, falling back to Emergent: %s", e)
            # fall through to Emergent fallback

    # ---- Emergent fallback ----
    if not EMERGENT_LLM_KEY:
        return "(LLM key missing — please configure ANTHROPIC_API_KEY or EMERGENT_LLM_KEY)"
    chat = _new_chat(session_id, sys_with_history, CLAUDE_MODEL)
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
