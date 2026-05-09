"""Iteration 3 backend regression tests.

Covers: root, avatars, real Claude chat sessions, profile extract+CRUD,
job matching, adaptive interview start/answer/finish, Stripe checkout creation
and status, voice status/tts gating, saved-jobs and purchases.
"""
import os
import time
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get(
    "EXPO_BACKEND_URL"
) or "https://career-app-enhance.preview.emergentagent.com"
BASE = BASE.rstrip("/")
URL = lambda p: f"{BASE}/api{p}"

USER = "TEST_iter3_user"
LONG_TIMEOUT = 60  # LLM calls can take 3-7s
SHORT_TIMEOUT = 15


@pytest.fixture(scope="session")
def s():
    return requests.Session()


# ---------------- Root + avatars ----------------
def test_root_hello(s):
    r = s.get(URL("/"), timeout=SHORT_TIMEOUT)
    assert r.status_code == 200
    assert r.json().get("message") == "Hello World"


@pytest.mark.parametrize("name", ["maya", "sofia", "aria"])
def test_avatar_ok(s, name):
    r = s.get(URL(f"/avatars/{name}"), timeout=SHORT_TIMEOUT)
    assert r.status_code == 200
    assert "image/png" in r.headers.get("content-type", "")
    assert len(r.content) > 1000


def test_avatar_unknown_404(s):
    r = s.get(URL("/avatars/zzz"), timeout=SHORT_TIMEOUT)
    assert r.status_code == 404


# ---------------- Chat (Claude) ----------------
@pytest.fixture(scope="session")
def chat_session(s):
    payload = {
        "avatar": "sofia",
        "message": "I'd like to prep for a senior PM interview",
        "user_id": USER,
    }
    r = s.post(URL("/chat"), json=payload, timeout=LONG_TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("session_id")
    assert isinstance(data.get("reply"), str) and len(data["reply"]) > 10
    assert isinstance(data.get("suggestions"), list) and len(data["suggestions"]) >= 1
    return data["session_id"]


def test_chat_continues_session(s, chat_session):
    r = s.post(
        URL("/chat"),
        json={
            "avatar": "sofia",
            "message": "Focus on stakeholder management questions please.",
            "session_id": chat_session,
            "user_id": USER,
        },
        timeout=LONG_TIMEOUT,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["session_id"] == chat_session
    assert len(body["reply"]) > 5


def test_chat_get_session_history(s, chat_session):
    r = s.get(URL(f"/chat/{chat_session}"), timeout=SHORT_TIMEOUT)
    assert r.status_code == 200
    sess = r.json()
    assert sess["session_id"] == chat_session
    assert isinstance(sess.get("history"), list)
    # At least 4 messages (2 user, 2 ai) after two POSTs
    assert len(sess["history"]) >= 4
    roles = [m["role"] for m in sess["history"]]
    assert "user" in roles and "ai" in roles


def test_chat_unknown_avatar_404(s):
    r = s.post(URL("/chat"), json={"avatar": "ghost", "message": "hi"}, timeout=SHORT_TIMEOUT)
    assert r.status_code == 404


# ---------------- Profile ----------------
def test_profile_extract_then_get(s):
    r = s.post(
        URL("/profile/extract"),
        json={
            "user_id": USER,
            "transcript": (
                "I want a senior product manager role in London, remote-friendly, "
                "around £80k. I know Figma, analytics, B2B SaaS."
            ),
        },
        timeout=LONG_TIMEOUT,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "error" not in data, f"extract returned error: {data}"
    assert data.get("user_id") == USER
    assert data.get("target_role")
    # GET back
    r2 = s.get(URL(f"/profile/{USER}"), timeout=SHORT_TIMEOUT)
    assert r2.status_code == 200
    p = r2.json()
    assert p["user_id"] == USER
    assert p.get("target_role")


def test_profile_put_persists(s):
    body = {
        "user_id": USER,
        "target_role": "Senior Product Manager",
        "seniority": "senior",
        "location": "London",
        "remote": "remote",
        "salary_min": 80000,
        "salary_max": 110000,
        "skills": ["Figma", "analytics", "B2B SaaS"],
        "industries": ["SaaS"],
        "must_haves": ["remote"],
        "nice_to_haves": [],
        "summary": "Senior PM with B2B SaaS experience.",
    }
    r = s.put(URL(f"/profile/{USER}"), json=body, timeout=SHORT_TIMEOUT)
    assert r.status_code == 200
    out = r.json()
    assert out["target_role"] == "Senior Product Manager"
    assert out["seniority"] == "senior"
    # GET should reflect
    r2 = s.get(URL(f"/profile/{USER}"), timeout=SHORT_TIMEOUT)
    g = r2.json()
    assert g["target_role"] == "Senior Product Manager"
    assert g["salary_min"] == 80000


# ---------------- Jobs ----------------
def test_jobs_match(s):
    r = s.post(URL("/jobs/match"), json={"user_id": USER, "limit": 5}, timeout=SHORT_TIMEOUT)
    assert r.status_code == 200
    body = r.json()
    assert "profile" in body and "matches" in body
    matches = body["matches"]
    assert isinstance(matches, list) and len(matches) > 0
    for m in matches:
        assert 0 <= m["match_score"] <= 100
    scores = [m["match_score"] for m in matches]
    assert scores == sorted(scores, reverse=True)


# ---------------- Interview ----------------
@pytest.fixture(scope="session")
def interview_id(s):
    r = s.post(
        URL("/interview/start"),
        json={
            "user_id": USER,
            "role": "Product Manager",
            "seniority": "senior",
            "style": "behavioural",
            "total_questions": 3,
        },
        timeout=LONG_TIMEOUT,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["interview_id"]
    assert body["current"] == 1
    assert body["total"] == 3
    q = body["question"]
    assert q.get("question")
    assert q.get("category")
    assert q.get("difficulty")
    return body["interview_id"]


def test_interview_full_flow(s, interview_id):
    star_answer = (
        "Situation: At Northwind, our checkout had a 38% drop-off. "
        "Task: As lead PM I needed to lift conversion by 10% in one quarter. "
        "Action: I ran 6 user interviews, partnered with design on a 2-step flow, "
        "ran an A/B test, and aligned legal and CS on copy. "
        "Result: We lifted conversion by 14% and revenue by £420k QoQ."
    )
    last_score = None
    final_summary = None
    for i in range(3):
        r = s.post(
            URL("/interview/answer"),
            json={"interview_id": interview_id, "answer": star_answer},
            timeout=LONG_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "score" in body
        sc = body["score"]
        for k in ["star_coverage", "clarity", "confidence", "content_depth", "structure"]:
            assert k in sc, f"missing key {k} in score: {sc}"
            assert 0 <= sc[k] <= 100
        if i < 2:
            assert body["done"] is False
            assert body["next_question"]["question"]
        else:
            assert body["done"] is True
            assert "summary" in body
            summary = body["summary"]
            for k in ["overall", "verdict", "summary", "top_strengths", "top_improvements", "next_steps"]:
                assert k in summary, f"missing summary key {k}"
            final_summary = summary
        last_score = sc
    assert last_score is not None
    assert final_summary is not None


def test_interview_get_persisted(s, interview_id):
    r = s.get(URL(f"/interview/{interview_id}"), timeout=SHORT_TIMEOUT)
    assert r.status_code == 200
    itv = r.json()
    assert itv["interview_id"] == interview_id
    assert itv["status"] == "completed"
    assert len(itv["scores"]) == 3
    assert "summary" in itv


# ---------------- Stripe payments ----------------
@pytest.fixture(scope="session")
def checkout(s):
    r = s.post(
        URL("/payments/checkout"),
        json={
            "user_id": USER,
            "item_id": "itv-standard",
            "success_url": "https://career-app-enhance.preview.emergentagent.com/success",
            "cancel_url": "https://career-app-enhance.preview.emergentagent.com/cancel",
        },
        timeout=LONG_TIMEOUT,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["url"].startswith("https://checkout.stripe.com")
    assert body["session_id"]
    assert body["amount"] == 899
    assert body["currency"] == "gbp"
    assert body["purchase_id"]
    return body


def test_checkout_unknown_item_404(s):
    r = s.post(
        URL("/payments/checkout"),
        json={
            "user_id": USER,
            "item_id": "no-such-item",
            "success_url": "https://x/y",
            "cancel_url": "https://x/z",
        },
        timeout=SHORT_TIMEOUT,
    )
    assert r.status_code == 404


def test_payments_status(s, checkout):
    sid = checkout["session_id"]
    r = s.get(URL(f"/payments/status/{sid}"), timeout=LONG_TIMEOUT)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["session_id"] == sid
    # Either real Stripe (unpaid/paid) or DB fallback (pending/paid)
    assert body.get("payment_status") in {"unpaid", "paid", "pending"}, body
    # purchase doc must be embedded
    assert body.get("purchase") is not None
    assert body["purchase"]["stripe_session_id"] == sid


def test_payments_status_unknown_404(s):
    r = s.get(URL("/payments/status/cs_test_nonexistent_xyz_123"), timeout=LONG_TIMEOUT)
    assert r.status_code == 404


def test_payments_confirm_marks_paid(s, checkout):
    sid = checkout["session_id"]
    # Confirm
    r = s.post(URL(f"/payments/confirm/{sid}"), timeout=SHORT_TIMEOUT)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["purchase"]["status"] == "paid"
    # Status should now reflect paid via DB fallback (or real Stripe)
    r2 = s.get(URL(f"/payments/status/{sid}"), timeout=LONG_TIMEOUT)
    assert r2.status_code == 200
    s2 = r2.json()
    assert s2.get("payment_status") == "paid", s2
    assert s2.get("status") in {"complete", "paid"}, s2


def test_payments_confirm_unknown_404(s):
    r = s.post(URL("/payments/confirm/cs_test_does_not_exist_zzz"), timeout=SHORT_TIMEOUT)
    assert r.status_code == 404


# ---------------- Voice ----------------
def test_voice_status(s):
    r = s.get(URL("/voice/status"), timeout=SHORT_TIMEOUT)
    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is False
    voices = body["voices"]
    assert "maya" in voices and "sofia" in voices and "aria" in voices


def test_voice_tts_disabled_501(s):
    r = s.post(URL("/voice/tts"), json={"avatar": "sofia", "text": "hi"}, timeout=SHORT_TIMEOUT)
    assert r.status_code == 501


# ---------------- Saved jobs + purchases ----------------
def test_saved_jobs_crud(s):
    r = s.post(
        URL("/saved-jobs"),
        json={"user_id": USER, "title": "TEST_PM Role", "company": "TEST_Co", "location": "London"},
        timeout=SHORT_TIMEOUT,
    )
    assert r.status_code == 200
    obj = r.json()
    job_id = obj["id"]
    # list
    r2 = s.get(URL("/saved-jobs"), params={"user_id": USER}, timeout=SHORT_TIMEOUT)
    assert r2.status_code == 200
    items = r2.json()
    assert any(j["id"] == job_id for j in items)
    # delete
    r3 = s.delete(URL(f"/saved-jobs/{job_id}"), params={"user_id": USER}, timeout=SHORT_TIMEOUT)
    assert r3.status_code == 200 and r3.json()["deleted"] == 1


def test_purchases_lists_pending(s, checkout):
    r = s.get(URL("/purchases"), params={"user_id": USER}, timeout=SHORT_TIMEOUT)
    assert r.status_code == 200
    rows = r.json()
    assert any(p["stripe_session_id"] == checkout["session_id"] for p in rows)
    p = next(p for p in rows if p["stripe_session_id"] == checkout["session_id"])
    assert p["item_id"] == "itv-standard"
    assert p["amount"] == 899
    assert "_id" not in p
