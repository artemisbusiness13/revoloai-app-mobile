"""Backend tests for the new auth + profile + personalisation endpoints.

Run: python /app/backend_test.py
Targets the public ingress URL from EXPO_PUBLIC_BACKEND_URL.
"""
from __future__ import annotations
import os
import sys
import uuid
import json
import time
import requests
from typing import Any, Dict, List, Tuple

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://bilingual-ai-coach-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

results: List[Tuple[str, bool, str]] = []


def record(name: str, passed: bool, detail: str = ""):
    results.append((name, passed, detail))
    flag = "PASS" if passed else "FAIL"
    print(f"[{flag}] {name}  {('- ' + detail) if detail else ''}")


def post(path, json_body=None, headers=None, timeout=60):
    return requests.post(f"{API}{path}", json=json_body, headers=headers or {}, timeout=timeout)


def get(path, params=None, headers=None, timeout=60):
    return requests.get(f"{API}{path}", params=params, headers=headers or {}, timeout=timeout)


def put(path, json_body=None, headers=None, timeout=60):
    return requests.put(f"{API}{path}", json=json_body, headers=headers or {}, timeout=timeout)


# Shared state
state: Dict[str, Any] = {}


def t1_signup_valid():
    email = f"p_{uuid.uuid4().hex[:10]}@example.com"
    body = {"name": "Priya Sharma", "email": email, "password": "Secret123!"}
    r = post("/auth/signup", body)
    ok = r.status_code == 200
    if not ok:
        record("1. signup valid", False, f"status={r.status_code} body={r.text[:200]}")
        return
    j = r.json()
    checks = [
        j.get("ok") is True,
        bool(j.get("token")),
        isinstance(j.get("user"), dict),
        j.get("user", {}).get("user_id", "").startswith("u_"),
        j.get("user", {}).get("email") == email.lower(),
        j.get("user", {}).get("name") == "Priya Sharma",
        j.get("profile_completed") is False,
    ]
    if all(checks):
        state["email"] = email
        state["password"] = "Secret123!"
        state["token"] = j["token"]
        state["user_id"] = j["user"]["user_id"]
        record("1. signup valid", True, f"user_id={state['user_id']}")
    else:
        record("1. signup valid", False, f"checks={checks} body={j}")


def t2_signup_duplicate():
    body = {"name": "Priya Again", "email": state["email"], "password": "Secret123!"}
    r = post("/auth/signup", body)
    ok = r.status_code == 409
    detail = ""
    try:
        detail = r.json().get("detail", "")
    except Exception:
        pass
    record("2. signup duplicate email -> 409", ok and "already" in detail.lower(),
           f"status={r.status_code} detail={detail}")


def t3a_short_password():
    email = f"p_{uuid.uuid4().hex[:10]}@example.com"
    r = post("/auth/signup", {"name": "X Y", "email": email, "password": "abc"})
    detail = ""
    try:
        detail = r.json().get("detail", "")
    except Exception:
        pass
    record("3a. short password -> 400", r.status_code == 400 and "6" in detail,
           f"status={r.status_code} detail={detail}")


def t3b_missing_fields():
    # empty name
    r1 = post("/auth/signup", {"name": "", "email": f"p_{uuid.uuid4().hex[:10]}@example.com", "password": "Secret123!"})
    # empty email
    r2 = post("/auth/signup", {"name": "Bob", "email": "", "password": "Secret123!"})
    ok = r1.status_code == 400 and r2.status_code == 400
    record("3b. empty name or email -> 400", ok,
           f"empty_name={r1.status_code} empty_email={r2.status_code}")


def t3c_invalid_email():
    r = post("/auth/signup", {"name": "Bob", "email": "notanemail", "password": "Secret123!"})
    detail = ""
    try:
        detail = r.json().get("detail", "")
    except Exception:
        pass
    record("3c. invalid email -> 400", r.status_code == 400 and "email" in detail.lower(),
           f"status={r.status_code} detail={detail}")


def t4a_login_correct():
    r = post("/auth/login", {"email": state["email"], "password": state["password"]})
    ok = r.status_code == 200
    if not ok:
        record("4a. login correct -> 200", False, f"status={r.status_code} body={r.text[:200]}")
        return
    j = r.json()
    new_token = j.get("token")
    cond = bool(new_token) and new_token != state["token"] and j.get("user", {}).get("user_id") == state["user_id"]
    if cond:
        state["login_token"] = new_token
        record("4a. login correct -> 200", True, f"new token issued (different from signup token)")
    else:
        record("4a. login correct -> 200", False, f"body={j}")


def t4b_login_wrong_password():
    r = post("/auth/login", {"email": state["email"], "password": "wrong-pass!"})
    detail = ""
    try:
        detail = r.json().get("detail", "")
    except Exception:
        pass
    record("4b. login wrong pwd -> 401", r.status_code == 401 and "invalid" in detail.lower(),
           f"status={r.status_code} detail={detail}")


def t4c_login_unknown():
    r = post("/auth/login", {"email": f"nobody_{uuid.uuid4().hex[:6]}@example.com", "password": "Secret123!"})
    record("4c. login unknown email -> 401", r.status_code == 401, f"status={r.status_code}")


def t5a_me_valid():
    r = get("/auth/me", headers={"Authorization": f"Bearer {state['token']}"})
    ok = r.status_code == 200
    if not ok:
        record("5a. /auth/me valid bearer -> 200", False, f"status={r.status_code} body={r.text[:200]}")
        return
    j = r.json()
    user = j.get("user") or {}
    cond = (
        user.get("user_id") == state["user_id"]
        and "password_hash" not in user
        and isinstance(j.get("profile"), dict)
        and j.get("profile_completed") is False
    )
    record("5a. /auth/me valid bearer -> 200", cond,
           f"keys={list(j.keys())} user_keys={list(user.keys())} profile_completed={j.get('profile_completed')}")


def t5b_me_bad_token():
    r = get("/auth/me", headers={"Authorization": "Bearer not-a-real-token-zzzz"})
    record("5b. /auth/me bad token -> 401", r.status_code == 401, f"status={r.status_code}")


def t5c_me_no_header():
    r = get("/auth/me")
    record("5c. /auth/me no header -> 401", r.status_code == 401, f"status={r.status_code}")


def t6_logout_then_me():
    r1 = post("/auth/logout", json_body={}, headers={"Authorization": f"Bearer {state['token']}"})
    if r1.status_code != 200:
        record("6. logout invalidates token", False, f"logout status={r1.status_code}")
        return
    r2 = get("/auth/me", headers={"Authorization": f"Bearer {state['token']}"})
    record("6. logout invalidates token", r2.status_code == 401,
           f"logout=200, /me-after-logout status={r2.status_code}")


def t7_profile_put_get():
    # We've logged out of state['token']. Use login_token from t4a.
    full_profile = {
        "target_role": "Senior Product Designer",
        "seniority": "senior",
        "years_experience": 7,
        "location": "London",
        "remote": "hybrid",
        "salary_min": 70000,
        "salary_max": 95000,
        "skills": ["Figma", "React", "Design Systems"],
        "languages": ["English", "Romanian"],
        "qualifications": ["BSc CS"],
        "education": "UCL",
        "experience_summary": "Led design at two SaaS startups, scaled DS to 60+ components.",
        "industries": ["SaaS", "Fintech"],
        "industries_avoid": ["Gambling"],
        "strengths": ["Leadership", "Cross-functional comms"],
        "weaknesses": ["Public speaking"],
        "availability": "4 weeks",
        "cv_text": "Senior Product Designer with 7 years experience in SaaS...",
        "cv_filename": "cv.pdf",
        "notes": "Open to mentorship roles.",
        "must_haves": ["Remote", "Strong DS culture"],
        "nice_to_haves": ["Equity"],
        "summary": "Design leader who blends systems thinking with shipping velocity.",
    }
    uid = state["user_id"]
    r = put(f"/profile/{uid}", full_profile)
    if r.status_code != 200:
        record("7. PUT profile (23 fields)", False, f"PUT status={r.status_code} body={r.text[:200]}")
        return
    saved = r.json()
    keys_match = all(saved.get(k) == v for k, v in full_profile.items())
    if not keys_match:
        diffs = [k for k, v in full_profile.items() if saved.get(k) != v]
        record("7. PUT profile (23 fields)", False, f"missing/mismatched fields: {diffs}")
        return
    # also check completed=True since target_role set
    if not saved.get("completed"):
        record("7. PUT profile (23 fields)", False, "completed flag not set true")
        return

    # Now GET it back
    rg = get(f"/profile/{uid}")
    if rg.status_code != 200:
        record("7. PUT profile (23 fields) - GET", False, f"GET status={rg.status_code}")
        return
    fetched = rg.json()
    diffs = [k for k, v in full_profile.items() if fetched.get(k) != v]
    record("7. PUT + GET profile (23 fields persist)", len(diffs) == 0,
           f"persistence diffs={diffs}")


def t8_me_profile_completed_true():
    # Use the login_token from t4a since signup token was revoked in t6
    r = get("/auth/me", headers={"Authorization": f"Bearer {state['login_token']}"})
    if r.status_code != 200:
        record("8. /auth/me profile_completed=true after PUT", False, f"status={r.status_code}")
        return
    j = r.json()
    record("8. /auth/me profile_completed=true after PUT", j.get("profile_completed") is True,
           f"profile_completed={j.get('profile_completed')} target_role={j.get('profile', {}).get('target_role')}")


def _reply_personalised(reply: str) -> bool:
    if not isinstance(reply, str) or len(reply) <= 20:
        return False
    needles = ["design", "Figma", "Senior Product Designer", "Leadership", "Product Designer", "product design"]
    rl = reply.lower()
    return any(n.lower() in rl for n in needles)


def t9_chat_personalised():
    uid = state["user_id"]
    for avatar in ("sofia", "aria"):
        r = post("/chat", {"avatar": avatar, "user_id": uid, "message": "Where should I focus this week?"}, timeout=120)
        if r.status_code != 200:
            record(f"9. /chat personalised ({avatar})", False, f"status={r.status_code} body={r.text[:200]}")
            continue
        j = r.json()
        reply = j.get("reply", "")
        ok = _reply_personalised(reply)
        record(f"9. /chat personalised ({avatar})", ok,
               f"len={len(reply)} sample={reply[:160]!r}")


def t10_interview_start():
    uid = state["user_id"]
    body = {
        "user_id": uid,
        "role": "Senior Product Designer",
        "seniority": "senior",
        "style": "behavioural",
        "total_questions": 8,
        "lang": "English",
    }
    r = post("/interview/start", body, timeout=120)
    if r.status_code != 200:
        record("10. /interview/start personalised", False, f"status={r.status_code} body={r.text[:200]}")
        return
    j = r.json()
    qtext = (j.get("question") or {}).get("question", "")
    fallback_substr = "Tell me about yourself"
    cond = (
        len(qtext) > 20
        and j.get("current") == 1
        and j.get("total") <= 8
        and j.get("total") == 3   # basic tier cap
        and j.get("tier") == "basic"
        and fallback_substr.lower() not in qtext.lower()
    )
    record("10. /interview/start personalised, basic-cap=3, no generic fallback", cond,
           f"tier={j.get('tier')} total={j.get('total')} current={j.get('current')} qlen={len(qtext)} q={qtext[:160]!r}")


def t11a_tier_basic():
    uid = state["user_id"]
    r = get("/account/tier", params={"user_id": uid, "avatar": "sofia"})
    if r.status_code != 200:
        record("11a. /account/tier basic", False, f"status={r.status_code}")
        return
    j = r.json()
    cond = j.get("tier") == "basic" and (j.get("limits") or {}).get("interview_questions") == 3
    record("11a. /account/tier no purchases -> basic, iq=3", cond, f"body={j}")


def t11b_tier_after_demo_seed():
    demo_uid = f"demo_user_{uuid.uuid4().hex[:8]}"
    r = post("/demo/seed", {"user_id": demo_uid}, timeout=60)
    if r.status_code != 200:
        record("11b. demo seed for tier test", False, f"seed status={r.status_code} body={r.text[:200]}")
        return
    state["demo_uid"] = demo_uid

    # sofia -> standard, iq=5
    r1 = get("/account/tier", params={"user_id": demo_uid, "avatar": "sofia"})
    j1 = r1.json() if r1.status_code == 200 else {}
    cond1 = r1.status_code == 200 and j1.get("tier") == "standard" and (j1.get("limits") or {}).get("interview_questions") == 5

    # maya -> standard, job_matches=5
    r2 = get("/account/tier", params={"user_id": demo_uid, "avatar": "maya"})
    j2 = r2.json() if r2.status_code == 200 else {}
    cond2 = r2.status_code == 200 and j2.get("tier") == "standard" and (j2.get("limits") or {}).get("job_matches") == 5

    record("11b. /account/tier after demo/seed (sofia=standard,iq=5)", cond1, f"sofia={j1}")
    record("11b. /account/tier after demo/seed (maya=standard,jm=5)", cond2, f"maya={j2}")

    # cleanup
    try:
        post("/demo/reset", {"user_id": demo_uid}, timeout=30)
    except Exception:
        pass


def t12_jobs_match_regression():
    uid = state["user_id"]
    r = post("/jobs/match", {"user_id": uid, "limit": 5}, timeout=120)
    if r.status_code != 200:
        record("12. /jobs/match regression", False, f"status={r.status_code} body={r.text[:200]}")
        return
    j = r.json()
    matches = j.get("matches") or []
    cond = isinstance(matches, list) and len(matches) >= 1
    record("12. /jobs/match regression with new ProfileIn schema", cond,
           f"matches_count={len(matches)} live={j.get('live')}")


def main():
    print(f"BASE: {BASE}")
    t1_signup_valid()
    if "user_id" not in state:
        print("Aborting — signup failed.")
        return summarise()
    t2_signup_duplicate()
    t3a_short_password()
    t3b_missing_fields()
    t3c_invalid_email()
    t4a_login_correct()
    t4b_login_wrong_password()
    t4c_login_unknown()
    t5a_me_valid()
    t5b_me_bad_token()
    t5c_me_no_header()
    t6_logout_then_me()
    t7_profile_put_get()
    t8_me_profile_completed_true()
    t9_chat_personalised()
    t10_interview_start()
    t11a_tier_basic()
    t11b_tier_after_demo_seed()
    t12_jobs_match_regression()
    summarise()


def summarise():
    passed = sum(1 for _, p, _ in results if p)
    total = len(results)
    print()
    print(f"==== RESULTS: {passed}/{total} passed ====")
    for name, p, detail in results:
        flag = "PASS" if p else "FAIL"
        print(f"  [{flag}] {name}" + (f"  -- {detail}" if not p else ""))
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
