"""Iteration 5 - i18n chat language tests.

Validates that POST /api/chat respects the `lang` parameter and replies in
the requested language for all 3 avatars (sofia/maya/aria).
"""
import os
import re
import pytest
import requests

BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "https://career-app-enhance.preview.emergentagent.com").rstrip("/")
URL = lambda p: f"{BASE}/api{p}"
LONG = 60

# Romanian: diacritics or distinctive function words
RO_HINT = re.compile(r"[ăâîșțĂÂÎȘȚ]|\b(sunt|pentru|tău|astăzi|salut|bună|cum|să|și|este)\b", re.IGNORECASE)
# English: very common function words that are extremely unlikely in Romanian
EN_HINT = re.compile(r"\b(the|you|your|hello|hi|what|how|are|today|let'?s|I'?m|I am|tell me)\b", re.IGNORECASE)


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _post_chat(s, avatar, lang=None, user_id=None, message=""):
    payload = {"avatar": avatar, "message": message, "user_id": user_id or f"TEST_lang_{avatar}_{lang or 'def'}"}
    if lang is not None:
        payload["lang"] = lang
    r = s.post(URL("/chat"), json=payload, timeout=LONG)
    assert r.status_code == 200, f"chat status {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert "reply" in body and isinstance(body["reply"], str) and body["reply"].strip()
    assert "session_id" in body
    return body


@pytest.mark.parametrize("avatar", ["sofia", "maya", "aria"])
def test_chat_english_intro(s, avatar):
    body = _post_chat(s, avatar, lang="English", user_id=f"TEST_lang_en_{avatar}")
    reply = body["reply"]
    assert EN_HINT.search(reply), f"Expected English hint words in: {reply!r}"
    # Should NOT contain Romanian diacritics
    assert not re.search(r"[ăâîșțĂÂÎȘȚ]", reply), f"Found RO diacritics in EN reply: {reply!r}"


@pytest.mark.parametrize("avatar", ["sofia", "maya", "aria"])
def test_chat_romanian_intro(s, avatar):
    body = _post_chat(s, avatar, lang="Romanian", user_id=f"TEST_lang_ro_{avatar}")
    reply = body["reply"]
    assert RO_HINT.search(reply), f"Expected RO hint in: {reply!r}"


def test_chat_default_lang_is_english(s):
    body = _post_chat(s, "sofia", lang=None, user_id="TEST_lang_default")
    reply = body["reply"]
    assert EN_HINT.search(reply), f"Default lang should be English, got: {reply!r}"


def test_chat_romanian_user_message(s):
    """User sends Romanian text; reply must remain in Romanian when lang=Romanian."""
    sess = _post_chat(s, "maya", lang="Romanian", user_id="TEST_lang_ro_followup")
    sid = sess["session_id"]
    r = requests.post(URL("/chat"), json={
        "avatar": "maya",
        "message": "Caut un job de inginer software în Londra.",
        "user_id": "TEST_lang_ro_followup",
        "session_id": sid,
        "lang": "Romanian",
    }, timeout=LONG)
    assert r.status_code == 200
    reply = r.json()["reply"]
    assert RO_HINT.search(reply), f"Expected RO follow-up reply: {reply!r}"
