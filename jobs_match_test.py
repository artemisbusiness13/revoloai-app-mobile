"""Test the updated POST /api/jobs/match endpoint.

Per review request:
  - Response now includes top-level: status, query, where, count + existing profile, matches, live
  - When Adzuna keys ARE configured: curated demo pool NEVER returned; live or structured error
  - _normalise_adzuna_job returns `contract_time`
  - Safe logging: never logs ADZUNA_APP_KEY / ADZUNA_APP_ID values

NOTE: The review request states Adzuna keys ARE configured in this env, but
/api/health/integrations and /app/backend/.env confirm both ADZUNA_APP_ID and
ADZUNA_APP_KEY are EMPTY here. We test what we can and report this clearly.
"""
import os
import time
import uuid
import json
import requests

BASE = "https://bilingual-ai-coach-1.preview.emergentagent.com/api"

DEMO_TITLES = {"Principal Engineer", "Lead Marketing Strategist", "Product Designer"}

results = []


def record(name, passed, detail=""):
    flag = "✅" if passed else "❌"
    print(f"{flag} {name}{(' — ' + detail) if detail else ''}")
    results.append((name, passed, detail))


def signup_user():
    suffix = uuid.uuid4().hex[:8]
    email = f"jobsmatch_{int(time.time())}_{suffix}@example.com"
    body = {"name": "Priya Sharma", "email": email, "password": "ValidPass123!"}
    r = requests.post(f"{BASE}/auth/signup", json=body, timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    return j["user"]["user_id"], j["token"], email


def put_profile(user_id, **overrides):
    body = {
        "target_role": "Software Engineer",
        "location": "London",
        "remote": "hybrid",
        "salary_min": 50000,
        "salary_max": 80000,
        "skills": ["Python", "React", "AWS"],
        "seniority": "senior",
    }
    body.update(overrides)
    r = requests.put(f"{BASE}/profile/{user_id}", json=body, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def test_health():
    r = requests.get(f"{BASE}/health/integrations", timeout=15)
    j = r.json()
    print("integrations:", json.dumps({k: j[k] for k in ("adzuna_keys_present", "adzuna_live_enabled", "adzuna_country")}, indent=2))
    return bool(j.get("adzuna_live_enabled"))


def main():
    adz_live = test_health()
    print(f"Adzuna live enabled in this env: {adz_live}\n")

    # (1) Signup + profile
    user_id, token, email = signup_user()
    put_profile(user_id)
    print(f"User: {user_id} / {email}")

    # (2) Happy path: POST /api/jobs/match
    r = requests.post(f"{BASE}/jobs/match", json={"user_id": user_id, "limit": 5}, timeout=30)
    record("HTTP 200 on /jobs/match (happy path)", r.status_code == 200, f"status={r.status_code}")
    if r.status_code != 200:
        print(r.text[:500])
        return
    body = r.json()

    print("\nResponse keys:", sorted(body.keys()))
    print("status:", body.get("status"))
    print("query:", body.get("query"))
    print("where:", body.get("where"))
    print("count:", body.get("count"))
    print("live:", body.get("live"))
    print("len(matches):", len(body.get("matches") or []))

    # Regression: matches + profile still at top level
    record("Top-level field: profile present", "profile" in body)
    record("Top-level field: matches present (list)", isinstance(body.get("matches"), list))
    # New fields
    record("Top-level field: status present", "status" in body)
    record("Top-level field: query present", "query" in body)
    record("Top-level field: where present", "where" in body)
    record("Top-level field: count present", "count" in body)
    record("Top-level field: live present (bool)", isinstance(body.get("live"), bool))

    if adz_live:
        # Tests requested by review
        record("response.live === true", body.get("live") is True, f"actual={body.get('live')}")
        record("response.status === 'ok'", body.get("status") == "ok", f"actual={body.get('status')}")
        q = body.get("query") or ""
        record("response.query has value (likely 'Software Engineer')",
               isinstance(q, str) and len(q) > 0,
               f"actual={q!r}")
        record("response.where == 'London'", body.get("where") == "London", f"actual={body.get('where')!r}")
        record("response.count is positive int",
               isinstance(body.get("count"), int) and body.get("count") > 0,
               f"actual={body.get('count')!r}")
        m = body.get("matches") or []
        record("response.matches non-empty list length<=5",
               isinstance(m, list) and 1 <= len(m) <= 5,
               f"len={len(m)}")
        # Validate match shape
        if m:
            for i, j in enumerate(m):
                required = {"id", "title", "company", "location", "match_score"}
                missing = required - set(j.keys())
                record(f"match[{i}] has {sorted(required)}",
                       not missing,
                       f"missing={sorted(missing)}" if missing else "")
                record(f"match[{i}] source == 'adzuna'",
                       j.get("source") == "adzuna",
                       f"actual={j.get('source')!r}")
                # url and contract_time should be present (may be empty string)
                record(f"match[{i}] has 'url' key", "url" in j, f"value={(j.get('url') or '')[:60]!r}")
                record(f"match[{i}] has 'contract_time' key",
                       "contract_time" in j,
                       f"value={j.get('contract_time')!r}")
            # No demo titles
            titles = [(j.get("title") or "").strip() for j in m]
            collisions = [t for t in titles if t in DEMO_TITLES]
            record("NO match titles collide with old demo curated titles",
                   not collisions,
                   f"collisions={collisions}")
            print("Returned titles:")
            for t in titles:
                print(f"  - {t}")
    else:
        # Adzuna NOT configured — record discrepancy and verify dev fallback shape
        print("\n⚠️  ADZUNA KEYS NOT CONFIGURED IN THIS ENV — cannot test live behavior.")
        print("    The review request's premise that keys ARE set is FALSE here.")
        record("response.live === false (no Adzuna keys present)",
               body.get("live") is False,
               f"actual={body.get('live')}")
        record("response.status === 'demo' (dev fallback)",
               body.get("status") == "demo",
               f"actual={body.get('status')!r}")
        record("matches is a non-empty list (curated pool fallback)",
               isinstance(body.get("matches"), list) and len(body.get("matches")) > 0,
               f"len={len(body.get('matches') or [])}")

    # (3) Broken profile likely returning 0 hits
    print("\n--- Broken profile scenario (target_role=garbage, location=Mars) ---")
    user_id2, _, _ = signup_user()
    put_profile(user_id2, target_role="zzzzzzzzzzzz unlikely role yz123", location="Mars",
                skills=[], seniority="unknown")
    r2 = requests.post(f"{BASE}/jobs/match", json={"user_id": user_id2, "limit": 5}, timeout=30)
    record("HTTP 200 on broken-profile /jobs/match", r2.status_code == 200, f"status={r2.status_code}")
    if r2.status_code == 200:
        b2 = r2.json()
        print("Response:", {k: b2.get(k) for k in ("status", "query", "where", "count", "live")})
        print("len(matches):", len(b2.get("matches") or []))
        if adz_live:
            record("Broken: status in ('no_results','error')",
                   b2.get("status") in ("no_results", "error"),
                   f"actual={b2.get('status')!r}")
            record("Broken: matches === []", b2.get("matches") == [], f"len={len(b2.get('matches') or [])}")
            record("Broken: count === 0", b2.get("count") == 0, f"actual={b2.get('count')!r}")
        else:
            # In dev fallback mode the curated pool still returns matches (the demo pool),
            # but the new fields should still be wired
            record("Broken: response shape still includes status/query/where/count",
                   all(k in b2 for k in ("status", "query", "where", "count")))
            print("   (with Adzuna keys present, expected status='no_results' and matches=[])")

    # (4) Safe logging — verify ADZUNA_APP_KEY / ADZUNA_APP_ID never appear in logs
    print("\n--- Safe logging check ---")
    # Read .env to learn exact values
    adz_id = adz_key = ""
    try:
        with open("/app/backend/.env") as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("ADZUNA_APP_ID="):
                    adz_id = line.split("=", 1)[1].strip().strip('"').strip("'")
                elif line.startswith("ADZUNA_APP_KEY="):
                    adz_key = line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception as e:
        print("Could not read .env:", e)

    print(f"ADZUNA_APP_ID set? {'yes' if adz_id else 'NO (empty)'}")
    print(f"ADZUNA_APP_KEY set? {'yes' if adz_key else 'NO (empty)'}")

    # Read backend logs
    log_paths = [
        "/var/log/supervisor/backend.err.log",
        "/var/log/supervisor/backend.out.log",
    ]
    combined = ""
    for p in log_paths:
        try:
            with open(p) as fh:
                lines = fh.readlines()[-300:]
                combined += "".join(lines)
        except Exception as e:
            print(f"Could not read {p}: {e}")

    if adz_id:
        record("ADZUNA_APP_ID value NEVER appears in backend logs",
               adz_id not in combined,
               "found in logs!" if adz_id in combined else "")
    else:
        print("   (skipping ADZUNA_APP_ID grep — value is empty)")
    if adz_key:
        record("ADZUNA_APP_KEY value NEVER appears in backend logs",
               adz_key not in combined,
               "found in logs!" if adz_key in combined else "")
    else:
        print("   (skipping ADZUNA_APP_KEY grep — value is empty)")

    # Check the expected log line shape appears (only if Adzuna is enabled)
    if adz_live:
        good_phrases = ["Adzuna search OK", "Adzuna search FAILED"]
        has_log = any(p in combined for p in good_phrases)
        record("Backend logs contain 'Adzuna search OK' or 'Adzuna search FAILED' line",
               has_log,
               "no Adzuna search log line found" if not has_log else "")

    # Summary
    print("\n========== SUMMARY ==========")
    p = sum(1 for _, ok, _ in results if ok)
    f = sum(1 for _, ok, _ in results if not ok)
    print(f"PASS: {p}  FAIL: {f}")
    for name, ok, detail in results:
        if not ok:
            print(f"  ❌ {name} — {detail}")


if __name__ == "__main__":
    main()
