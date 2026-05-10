"""
Backend test suite — Multilingual chat language directive
Tests /api/chat against public ingress URL for 6 languages.
"""
import os
import sys
import time
import json
import re
import requests
from pathlib import Path

# Load EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env
ENV_PATH = Path("/app/frontend/.env")
BACKEND_URL = None
for line in ENV_PATH.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BACKEND_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
        break

assert BACKEND_URL, "EXPO_PUBLIC_BACKEND_URL missing in /app/frontend/.env"
BASE = BACKEND_URL.rstrip("/") + "/api"

USER_ID = "u_lang_test_1"
TIMEOUT = 90

# Markers
POLISH_CHARS = set("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ")
POLISH_WORDS = ["tak", "nie", "praca", "rozmow", "dziękuj", "twoj", "masz", "jesteś", "pytanie",
                "cześć", "witaj", "rozmowy", "przygotować", "pomóc", "mogę"]
SPANISH_CHARS = set("ñÑ¿¡áéíóúÁÉÍÓÚ")
SPANISH_WORDS = ["trabajo", "buscar", "perfil", "hola", "puede", "experiencia",
                 "cuál", "qué", "para", "senior", "producto"]
ROMANIAN_CHARS = set("ăâîșțĂÂÎȘȚşţŞŢ")
ROMANIAN_WORDS = ["salut", "bună", "caut", "experiență", "tău", "pentru", "este", "sunt", "tine"]


def gurmukhi_count(s):
    return sum(1 for ch in s if 0x0A00 <= ord(ch) <= 0x0A7F)


def arabic_count(s):
    return sum(1 for ch in s if 0x0600 <= ord(ch) <= 0x06FF)


def has_any_char(s, chars):
    return any(ch in chars for ch in s)


def has_any_word(s, words):
    low = s.lower()
    return [w for w in words if w.lower() in low]


def is_english_dominated(s):
    low = " " + s.lower() + " "
    has_english_connectors = (" the " in low) or (" and " in low)
    return has_english_connectors


def post_chat(body):
    url = f"{BASE}/chat"
    r = requests.post(url, json=body, timeout=TIMEOUT)
    return url, r


def log_scenario(num, name, url, body, status, reply, markers_found, markers_missing, verdict):
    body_logged = dict(body)
    if "message" in body_logged and len(body_logged["message"]) > 60:
        body_logged["message"] = body_logged["message"][:60] + "..."
    print(f"\n{'='*70}")
    print(f"SCENARIO {num}: {name}")
    print(f"URL: {url}")
    print(f"BODY: {json.dumps(body_logged, ensure_ascii=False)}")
    print(f"HTTP STATUS: {status}")
    print(f"REPLY (first 300 chars): {reply[:300]}")
    print(f"MARKERS FOUND: {markers_found}")
    print(f"MARKERS MISSING: {markers_missing}")
    print(f"VERDICT: {verdict}")


results = []


def run_scenario_1():
    body = {"avatar": "sofia",
            "message": "Hello, can you help me prepare for a frontend interview?",
            "user_id": USER_ID,
            "lang": "Polish"}
    url, r = post_chat(body)
    ok = r.status_code == 200
    reply = ""
    found = []
    missing = []
    verdict = "FAIL"
    if ok:
        reply = r.json().get("reply", "")
        char_found = [ch for ch in POLISH_CHARS if ch in reply]
        word_found = has_any_word(reply, POLISH_WORDS)
        if char_found:
            found.append(f"polish_chars={char_found[:6]}")
        if word_found:
            found.append(f"polish_words={word_found}")
        eng_dom = is_english_dominated(reply)
        has_polish_marker = bool(char_found or word_found)
        if not has_polish_marker:
            missing.append("no polish chars/words")
        if eng_dom and not has_polish_marker:
            verdict = "FAIL (english-dominated, no polish markers)"
        elif has_polish_marker:
            verdict = "PASS"
        else:
            verdict = "FAIL (no polish markers)"
    log_scenario(1, "POLISH (sofia)", url, body, r.status_code, reply, found, missing, verdict)
    results.append(("1 Polish", verdict.startswith("PASS")))


def run_scenario_2():
    body = {"avatar": "maya",
            "message": "I'm looking for a senior product role.",
            "user_id": USER_ID,
            "lang": "Spanish"}
    url, r = post_chat(body)
    reply = ""
    found = []
    missing = []
    verdict = "FAIL"
    if r.status_code == 200:
        reply = r.json().get("reply", "")
        char_found = [ch for ch in SPANISH_CHARS if ch in reply]
        word_found = has_any_word(reply, SPANISH_WORDS)
        if char_found:
            found.append(f"spanish_chars={char_found[:6]}")
        if word_found:
            found.append(f"spanish_words={word_found}")
        eng_dom = is_english_dominated(reply)
        has_marker = bool(char_found or word_found)
        if not has_marker:
            missing.append("no spanish chars/words")
        if eng_dom and not has_marker:
            verdict = "FAIL (english-dominated)"
        elif has_marker:
            verdict = "PASS"
        else:
            verdict = "FAIL (no markers)"
    log_scenario(2, "SPANISH (maya)", url, body, r.status_code, reply, found, missing, verdict)
    results.append(("2 Spanish", verdict.startswith("PASS")))


def run_scenario_3():
    body = {"avatar": "aria",
            "message": "What should I learn next?",
            "user_id": USER_ID,
            "lang": "Punjabi"}
    url, r = post_chat(body)
    reply = ""
    found = []
    missing = []
    verdict = "FAIL"
    if r.status_code == 200:
        reply = r.json().get("reply", "")
        gc = gurmukhi_count(reply)
        found.append(f"gurmukhi_codepoint_count={gc}")
        if gc > 5:
            verdict = "PASS"
        else:
            missing.append(f"gurmukhi count {gc} <= 5")
            verdict = "FAIL"
    log_scenario(3, "PUNJABI (aria)", url, body, r.status_code, reply, found, missing, verdict)
    results.append(("3 Punjabi", verdict.startswith("PASS")))


def run_scenario_4():
    body = {"avatar": "sofia",
            "message": "I need to prepare for an interview.",
            "user_id": USER_ID,
            "lang": "Urdu"}
    url, r = post_chat(body)
    reply = ""
    found = []
    missing = []
    verdict = "FAIL"
    if r.status_code == 200:
        reply = r.json().get("reply", "")
        ac = arabic_count(reply)
        found.append(f"arabic_codepoint_count={ac}")
        if ac > 10:
            verdict = "PASS"
        else:
            missing.append(f"arabic count {ac} <= 10")
            verdict = "FAIL"
    log_scenario(4, "URDU (sofia)", url, body, r.status_code, reply, found, missing, verdict)
    results.append(("4 Urdu", verdict.startswith("PASS")))


def run_scenario_5():
    body = {"avatar": "sofia",
            "message": "Hi, can you help?",
            "user_id": USER_ID,
            "lang": "English"}
    url, r = post_chat(body)
    reply = ""
    found = []
    missing = []
    verdict = "FAIL"
    if r.status_code == 200:
        reply = r.json().get("reply", "")
        polish_chars = [ch for ch in POLISH_CHARS if ch in reply]
        spanish_chars = [ch for ch in SPANISH_CHARS if ch in reply]
        gc = gurmukhi_count(reply)
        ac = arabic_count(reply)
        ascii_letters = sum(1 for ch in reply if ch.isascii() and ch.isalpha())
        total_letters = sum(1 for ch in reply if ch.isalpha())
        ratio = ascii_letters / max(1, total_letters)
        found.append(f"ascii_letter_ratio={ratio:.2f}")
        problems = []
        if polish_chars:
            problems.append(f"polish_chars={polish_chars}")
        if spanish_chars:
            problems.append(f"spanish_chars={spanish_chars}")
        if gc > 0:
            problems.append(f"gurmukhi={gc}")
        if ac > 0:
            problems.append(f"arabic={ac}")
        if ratio < 0.9:
            problems.append(f"low ascii ratio={ratio:.2f}")
        if problems:
            missing.extend(problems)
            verdict = "FAIL"
        else:
            verdict = "PASS"
    log_scenario(5, "ENGLISH REGRESSION (sofia)", url, body, r.status_code, reply, found, missing, verdict)
    results.append(("5 English", verdict.startswith("PASS")))


def run_scenario_6():
    body = {"avatar": "maya",
            "message": "Caut un job ca product manager.",
            "user_id": USER_ID,
            "lang": "Romanian"}
    url, r = post_chat(body)
    reply = ""
    found = []
    missing = []
    verdict = "FAIL"
    if r.status_code == 200:
        reply = r.json().get("reply", "")
        char_found = [ch for ch in ROMANIAN_CHARS if ch in reply]
        word_found = has_any_word(reply, ROMANIAN_WORDS)
        if char_found:
            found.append(f"ro_chars={char_found[:6]}")
        if word_found:
            found.append(f"ro_words={word_found}")
        has_marker = bool(char_found or word_found)
        if has_marker:
            verdict = "PASS"
        else:
            missing.append("no romanian chars/words")
            verdict = "FAIL"
    log_scenario(6, "ROMANIAN REGRESSION (maya)", url, body, r.status_code, reply, found, missing, verdict)
    results.append(("6 Romanian", verdict.startswith("PASS")))


def run_scenario_7():
    body = {"avatar": "sofia",
            "message": "Hello.",
            "user_id": USER_ID + "_default"}  # no lang
    url, r = post_chat(body)
    reply = ""
    found = []
    missing = []
    verdict = "FAIL"
    if r.status_code == 200:
        reply = r.json().get("reply", "")
        polish_chars = [ch for ch in POLISH_CHARS if ch in reply]
        spanish_chars = [ch for ch in SPANISH_CHARS if ch in reply]
        gc = gurmukhi_count(reply)
        ac = arabic_count(reply)
        ascii_letters = sum(1 for ch in reply if ch.isascii() and ch.isalpha())
        total_letters = sum(1 for ch in reply if ch.isalpha())
        ratio = ascii_letters / max(1, total_letters)
        found.append(f"ascii_letter_ratio={ratio:.2f}")
        problems = []
        if polish_chars:
            problems.append(f"polish_chars={polish_chars}")
        if spanish_chars:
            problems.append(f"spanish_chars={spanish_chars}")
        if gc > 0:
            problems.append(f"gurmukhi={gc}")
        if ac > 0:
            problems.append(f"arabic={ac}")
        if ratio < 0.9:
            problems.append(f"low ascii ratio={ratio:.2f}")
        if problems:
            missing.extend(problems)
            verdict = "FAIL"
        else:
            verdict = "PASS"
    log_scenario(7, "DEFAULT no lang (sofia)", url, body, r.status_code, reply, found, missing, verdict)
    results.append(("7 Default", verdict.startswith("PASS")))


def run_scenario_8():
    # Multi-turn Polish
    body1 = {"avatar": "sofia",
             "message": "Cześć! Chcę przygotować się do rozmowy o pracę.",
             "user_id": USER_ID + "_mt",
             "lang": "Polish"}
    url, r1 = post_chat(body1)
    reply1 = ""
    sid = None
    found1 = []
    missing1 = []
    verdict1 = "FAIL"
    if r1.status_code == 200:
        j = r1.json()
        sid = j.get("session_id")
        reply1 = j.get("reply", "")
        char_found = [ch for ch in POLISH_CHARS if ch in reply1]
        word_found = has_any_word(reply1, POLISH_WORDS)
        if char_found:
            found1.append(f"pl_chars={char_found[:6]}")
        if word_found:
            found1.append(f"pl_words={word_found}")
        if char_found or word_found:
            verdict1 = "PASS"
        else:
            missing1.append("no polish markers")
    log_scenario("8a", "MULTI-TURN POLISH (turn 1)", url, body1, r1.status_code, reply1, found1, missing1, verdict1)

    # Turn 2 — use same session_id
    body2 = {"avatar": "sofia",
             "message": "Jakie pytania mogą paść podczas rozmowy technicznej?",
             "user_id": USER_ID + "_mt",
             "lang": "Polish",
             "session_id": sid}
    reply2 = ""
    found2 = []
    missing2 = []
    verdict2 = "FAIL"
    if sid:
        url2, r2 = post_chat(body2)
        if r2.status_code == 200:
            j2 = r2.json()
            sid2 = j2.get("session_id")
            reply2 = j2.get("reply", "")
            session_match = (sid2 == sid)
            char_found = [ch for ch in POLISH_CHARS if ch in reply2]
            word_found = has_any_word(reply2, POLISH_WORDS)
            if char_found:
                found2.append(f"pl_chars={char_found[:6]}")
            if word_found:
                found2.append(f"pl_words={word_found}")
            if session_match:
                found2.append("session_id_persisted")
            else:
                missing2.append(f"session_id_changed: {sid}->{sid2}")
            if (char_found or word_found) and session_match:
                verdict2 = "PASS"
            elif not (char_found or word_found):
                missing2.append("no polish markers")
        log_scenario("8b", "MULTI-TURN POLISH (turn 2 same session)", url2, body2, r2.status_code, reply2, found2, missing2, verdict2)
    else:
        log_scenario("8b", "MULTI-TURN POLISH (turn 2)", "n/a", body2, "skipped", "", [], ["no session_id from turn 1"], "FAIL")

    overall = verdict1.startswith("PASS") and verdict2.startswith("PASS")
    results.append(("8 Multi-turn Polish", overall))


def main():
    print(f"Public BASE: {BASE}")
    print(f"USER_ID: {USER_ID}\n")
    scenarios = [
        ("1", run_scenario_1),
        ("2", run_scenario_2),
        ("3", run_scenario_3),
        ("4", run_scenario_4),
        ("5", run_scenario_5),
        ("6", run_scenario_6),
        ("7", run_scenario_7),
        ("8", run_scenario_8),
    ]
    for num, fn in scenarios:
        try:
            fn()
        except Exception as e:
            print(f"\nSCENARIO {num} raised exception: {e}")
            results.append((f"{num} (exception)", False))

    passed = sum(1 for _, ok in results if ok)
    failed = len(results) - passed
    print("\n" + "=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)
    for name, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] Scenario {name}")
    print(f"\nTOTAL: {passed} PASSED / {failed} FAILED out of {len(results)}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
