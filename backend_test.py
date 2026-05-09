"""
Backend tests for bilingual EN+RO interview & chat flows.
Tests focus only on the new `lang` plumbing per review request.
"""
import os
import re
import sys
import json
import requests
from pathlib import Path

# Read base URL from frontend .env
FRONTEND_ENV = Path("/app/frontend/.env")
BASE = None
for ln in FRONTEND_ENV.read_text().splitlines():
    if ln.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE = ln.split("=", 1)[1].strip().strip('"')
        break
if not BASE:
    print("ERROR: EXPO_PUBLIC_BACKEND_URL not found in /app/frontend/.env")
    sys.exit(1)

API = f"{BASE}/api"
print(f"Testing against: {API}")
print("=" * 80)

# Romanian-specific characters or common Romanian words used to detect language
RO_CHARS = re.compile(r"[ăâîșțĂÂÎȘȚşţȘŢ]")
RO_WORDS = re.compile(
    r"\b(și|sau|este|ești|sunt|cu|despre|tu|tine|tine|pentru|spune-mi|povestește|"
    r"experiență|proiect|echipă|rol|cum|ce|de ce|la|prin|într-o|într-un|dvs|"
    r"dumneavoastră|vă|vă rog|mă|cel|cea|nostru|noastră|aceasta|această|acesta|"
    r"redesign|înscrieri|ai|am|are|fost|face|faci|despre|poți|vorbește|punct)\b",
    re.IGNORECASE,
)
EN_ONLY_WORDS = re.compile(
    r"\b(the|and|you|your|please|tell|about|with|that|this|have|will|would|could|should)\b",
    re.IGNORECASE,
)


def looks_romanian(text: str) -> bool:
    """Heuristic: text has Romanian diacritics or Romanian words and not predominantly English."""
    if not text:
        return False
    has_ro_chars = bool(RO_CHARS.search(text))
    has_ro_words = len(RO_WORDS.findall(text)) >= 2
    en_count = len(EN_ONLY_WORDS.findall(text))
    # If it has clear RO diacritics, that's strongest signal
    if has_ro_chars:
        return True
    # Or RO words present and english density is low
    if has_ro_words and en_count <= 2:
        return True
    return False


def looks_english(text: str) -> bool:
    if not text:
        return False
    # No RO diacritics and contains some EN words
    if RO_CHARS.search(text):
        return False
    if len(EN_ONLY_WORDS.findall(text)) >= 2:
        return True
    return False


results = []


def record(name: str, ok: bool, details: str = ""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}")
    if details:
        for line in details.splitlines():
            print(f"        {line}")
    results.append((name, ok, details))


# ---------------------------------------------------------------------------
# 1a. POST /api/interview/start  lang=English
# ---------------------------------------------------------------------------
print("\n--- 1a. /api/interview/start (lang=English) ---")
payload_en = {
    "user_id": "t1",
    "role": "Software Engineer",
    "seniority": "mid",
    "style": "behavioural",
    "total_questions": 3,
    "lang": "English",
}
try:
    r = requests.post(f"{API}/interview/start", json=payload_en, timeout=60)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    if r.status_code != 200:
        record("interview/start EN status 200", False, f"status={r.status_code}, body={body}")
    else:
        ok = True
        msgs = []
        if "interview_id" not in body:
            ok = False
            msgs.append("missing interview_id")
        if body.get("current") != 1:
            ok = False
            msgs.append(f"current={body.get('current')} (expected 1)")
        if body.get("total") != 3:
            ok = False
            msgs.append(f"total={body.get('total')} (expected 3)")
        q = (body.get("question") or {}).get("question") or ""
        if not q:
            ok = False
            msgs.append("missing question.question")
        if q and looks_romanian(q):
            ok = False
            msgs.append(f"question looks Romanian, expected English: {q!r}")
        if q and not looks_english(q):
            # not necessarily a hard fail, but warn
            msgs.append(f"WARN: question may not look clearly English: {q!r}")
        record(
            "interview/start EN returns English question + interview_id + current=1 total=3",
            ok,
            "\n".join(msgs) + ("\nQ=" + q if q else ""),
        )
        EN_INTERVIEW_ID = body.get("interview_id")
except Exception as e:
    record("interview/start EN", False, f"exception: {e}")
    EN_INTERVIEW_ID = None

# ---------------------------------------------------------------------------
# 1b. POST /api/interview/start  lang=Romanian
# ---------------------------------------------------------------------------
print("\n--- 1b. /api/interview/start (lang=Romanian) ---")
payload_ro = dict(payload_en)
payload_ro["lang"] = "Romanian"
RO_INTERVIEW_ID = None
RO_FIRST_Q = ""
try:
    r = requests.post(f"{API}/interview/start", json=payload_ro, timeout=60)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    if r.status_code != 200:
        record("interview/start RO status 200", False, f"status={r.status_code}, body={body}")
    else:
        ok = True
        msgs = []
        if "interview_id" not in body:
            ok = False
            msgs.append("missing interview_id")
        if body.get("current") != 1 or body.get("total") != 3:
            ok = False
            msgs.append(f"current/total wrong: current={body.get('current')} total={body.get('total')}")
        q_obj = body.get("question") or {}
        q = q_obj.get("question") or ""
        if not q:
            ok = False
            msgs.append("missing question.question")
        if q and not looks_romanian(q):
            ok = False
            msgs.append(f"question does NOT look Romanian: {q!r}")
        # categories/difficulty must remain English keys
        cat = q_obj.get("category") or ""
        diff = q_obj.get("difficulty") or ""
        if diff and diff.lower() not in {"easy", "medium", "hard"}:
            msgs.append(f"WARN: difficulty not English key: {diff!r}")
        if cat and cat.lower() not in {
            "behavioural", "behavioral", "technical", "motivation", "leadership",
            "problem-solving", "communication", "mixed", "situational", "values",
            "culture", "system-design", "coding", "design",
        }:
            msgs.append(f"INFO: category={cat!r}")
        record(
            "interview/start RO returns Romanian question + EN category/difficulty keys",
            ok,
            "\n".join(msgs) + f"\nQ={q!r}\ncategory={cat!r} difficulty={diff!r}",
        )
        RO_INTERVIEW_ID = body.get("interview_id")
        RO_FIRST_Q = q
except Exception as e:
    record("interview/start RO", False, f"exception: {e}")

# ---------------------------------------------------------------------------
# 2. POST /api/interview/answer  for the Romanian interview
# ---------------------------------------------------------------------------
print("\n--- 2. /api/interview/answer (Romanian) ---")
if RO_INTERVIEW_ID:
    ans_payload = {
        "interview_id": RO_INTERVIEW_ID,
        "answer": "Am condus o redesign care a dublat înscrierile. Echipa a fost formată din 4 ingineri și un designer; am stabilit obiective săptămânale și am livrat în 6 săptămâni.",
    }
    try:
        r = requests.post(f"{API}/interview/answer", json=ans_payload, timeout=90)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
        if r.status_code != 200:
            record("interview/answer RO status 200", False, f"status={r.status_code}, body={body}")
        else:
            ok = True
            msgs = []
            score = body.get("score") or {}
            # numeric fields
            numeric_fields = ["star_coverage", "clarity", "confidence", "content_depth", "structure"]
            for f in numeric_fields:
                v = score.get(f)
                if not isinstance(v, (int, float)):
                    ok = False
                    msgs.append(f"score.{f} not numeric: {v!r}")
                elif not (0 <= v <= 100):
                    ok = False
                    msgs.append(f"score.{f}={v} out of 0-100")
            # text fields in Romanian
            feedback = score.get("feedback") or ""
            if not feedback:
                ok = False
                msgs.append("score.feedback missing")
            elif not looks_romanian(feedback):
                ok = False
                msgs.append(f"score.feedback NOT Romanian: {feedback!r}")
            strengths = score.get("strengths") or []
            improvements = score.get("improvements") or []
            if strengths:
                if not all(isinstance(s, str) for s in strengths):
                    msgs.append(f"strengths not all strings: {strengths!r}")
                else:
                    if not any(looks_romanian(s) for s in strengths):
                        msgs.append(f"WARN: strengths may not look Romanian: {strengths!r}")
            if improvements:
                if not all(isinstance(s, str) for s in improvements):
                    msgs.append(f"improvements not all strings: {improvements!r}")
                else:
                    if not any(looks_romanian(s) for s in improvements):
                        msgs.append(f"WARN: improvements may not look Romanian: {improvements!r}")
            # done flag
            done = body.get("done")
            if done is not False:
                ok = False
                msgs.append(f"expected done=False (mid-interview), got done={done!r}")
            # next_question in Romanian
            nq = (body.get("next_question") or {}).get("question") or ""
            if not nq:
                ok = False
                msgs.append("next_question.question missing")
            elif not looks_romanian(nq):
                ok = False
                msgs.append(f"next_question NOT Romanian: {nq!r}")
            record(
                "interview/answer RO returns RO score+feedback, done=False, RO next_question",
                ok,
                "\n".join(msgs) + f"\nfeedback={feedback!r}\nstrengths={strengths!r}\nimprovements={improvements!r}\nnext_q={nq!r}\nscores={ {k: score.get(k) for k in numeric_fields} }",
            )
    except Exception as e:
        record("interview/answer RO", False, f"exception: {e}")
else:
    record("interview/answer RO", False, "skipped: no RO interview_id from previous step")

# ---------------------------------------------------------------------------
# 3. POST /api/chat  Sofia avatar  lang=Romanian
# ---------------------------------------------------------------------------
print("\n--- 3. /api/chat (Sofia, lang=Romanian) ---")
chat_payload = {
    "avatar": "sofia",
    "message": "Salut! Cum mă pot pregăti pentru un interviu comportamental?",
    "user_id": "t1",
    "lang": "Romanian",
}
try:
    r = requests.post(f"{API}/chat", json=chat_payload, timeout=60)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    if r.status_code != 200:
        record("chat Sofia RO status 200", False, f"status={r.status_code}, body={body}")
    else:
        ok = True
        msgs = []
        reply = body.get("reply") or ""
        if not reply:
            ok = False
            msgs.append("reply missing")
        elif not looks_romanian(reply):
            ok = False
            msgs.append(f"reply NOT Romanian: {reply!r}")
        if "session_id" not in body:
            ok = False
            msgs.append("missing session_id")
        record("chat Sofia RO returns Romanian reply", ok, "\n".join(msgs) + f"\nreply={reply!r}")
except Exception as e:
    record("chat Sofia RO", False, f"exception: {e}")

# ---------------------------------------------------------------------------
# 4. Regression: interview/start WITHOUT lang must default to English
# ---------------------------------------------------------------------------
print("\n--- 4a. /api/interview/start regression (no lang field) ---")
payload_no_lang = {
    "user_id": "t_reg",
    "role": "Software Engineer",
    "seniority": "mid",
    "style": "behavioural",
    "total_questions": 2,
}
REG_INTERVIEW_ID = None
try:
    r = requests.post(f"{API}/interview/start", json=payload_no_lang, timeout=60)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    if r.status_code != 200:
        record("interview/start (no lang) status 200", False, f"status={r.status_code}, body={body}")
    else:
        ok = True
        msgs = []
        if "interview_id" not in body:
            ok = False
            msgs.append("missing interview_id")
        q = (body.get("question") or {}).get("question") or ""
        if not q:
            ok = False
            msgs.append("missing question.question")
        if q and looks_romanian(q):
            ok = False
            msgs.append(f"default question looks Romanian, expected English: {q!r}")
        record(
            "interview/start regression no-lang defaults to English",
            ok,
            "\n".join(msgs) + f"\nQ={q!r}",
        )
        REG_INTERVIEW_ID = body.get("interview_id")
except Exception as e:
    record("interview/start regression", False, f"exception: {e}")

# Also test interview/answer without lang on the regression interview
print("\n--- 4b. /api/interview/answer regression (no lang field) ---")
if REG_INTERVIEW_ID:
    try:
        r = requests.post(
            f"{API}/interview/answer",
            json={"interview_id": REG_INTERVIEW_ID, "answer": "I led a redesign that doubled signups."},
            timeout=90,
        )
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
        if r.status_code != 200:
            record("interview/answer (no lang) status 200", False, f"status={r.status_code}, body={body}")
        else:
            ok = True
            msgs = []
            score = body.get("score") or {}
            if not isinstance(score.get("clarity"), (int, float)):
                ok = False
                msgs.append(f"score.clarity not numeric: {score.get('clarity')!r}")
            feedback = score.get("feedback") or ""
            if feedback and looks_romanian(feedback):
                ok = False
                msgs.append(f"feedback unexpectedly Romanian for default-EN flow: {feedback!r}")
            record(
                "interview/answer regression no-lang stays English",
                ok,
                "\n".join(msgs) + f"\nfeedback={feedback!r}",
            )
    except Exception as e:
        record("interview/answer regression", False, f"exception: {e}")
else:
    record("interview/answer regression", False, "skipped: no regression interview_id")

# ---------------------------------------------------------------------------
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
for name, ok, _ in results:
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
print(f"\n{passed}/{total} passed")
sys.exit(0 if passed == total else 1)
