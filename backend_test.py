"""
Backend test suite — Login-required Stripe checkout + enriched metadata
Tests /api/payments/checkout against public ingress URL.
"""
import os
import time
import json
import uuid
import requests
from pathlib import Path
from pymongo import MongoClient

# Load EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env
ENV_PATH = Path("/app/frontend/.env")
BACKEND_URL = None
for line in ENV_PATH.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BACKEND_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
        break

assert BACKEND_URL, "EXPO_PUBLIC_BACKEND_URL missing in /app/frontend/.env"
BASE = BACKEND_URL.rstrip("/") + "/api"

# Load MONGO_URL from /app/backend/.env for direct DB verification
BACK_ENV = Path("/app/backend/.env")
MONGO_URL = None
DB_NAME = None
for line in BACK_ENV.read_text().splitlines():
    if line.startswith("MONGO_URL="):
        MONGO_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
    if line.startswith("DB_NAME="):
        DB_NAME = line.split("=", 1)[1].strip().strip('"').strip("'")

if not DB_NAME:
    DB_NAME = "test_database"

mongo = MongoClient(MONGO_URL) if MONGO_URL else None
db = mongo[DB_NAME] if mongo else None

TIMEOUT = 60

results = []


def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    results.append((name, ok, detail))
    print(f"[{status}] {name}: {detail[:300]}")


def signup_random():
    """Create a fresh user via /api/auth/signup. Returns dict with user_id, email, token, name."""
    ts = int(time.time() * 1000)
    rand = uuid.uuid4().hex[:8]
    email = f"checkout_test_{ts}_{rand}@example.com"
    payload = {
        "name": "Priya Patel",
        "email": email,
        "password": "ValidPass123!",
    }
    r = requests.post(f"{BASE}/auth/signup", json=payload, timeout=TIMEOUT)
    r.raise_for_status()
    j = r.json()
    return {
        "user_id": j["user"]["user_id"],
        "email": j["user"]["email"],
        "name": j["user"]["name"],
        "token": j["token"],
    }


SUCCESS_URL = "https://bilingual-ai-coach-1.preview.emergentagent.com/checkout/success?sid={CHECKOUT_SESSION_ID}"
CANCEL_URL = "https://bilingual-ai-coach-1.preview.emergentagent.com/checkout/cancel"


# ---------------- Scenario 1: missing user_id ----------------
def test_1_missing_user_id():
    body = {
        "user_id": "",
        "item_id": "jobs-3",
        "success_url": SUCCESS_URL,
        "cancel_url": CANCEL_URL,
    }
    r = requests.post(f"{BASE}/payments/checkout", json=body, timeout=TIMEOUT)
    ok = r.status_code == 401
    try:
        detail = r.json().get("detail", "")
    except Exception:
        detail = r.text
    ok = ok and (detail == "login_required")
    record("1. Missing user_id => 401 login_required",
           ok, f"status={r.status_code} detail={detail!r}")


# ---------------- Scenario 2: guest prefix g_ ----------------
def test_2_guest_id():
    body = {
        "user_id": "g_" + uuid.uuid4().hex[:12],
        "item_id": "jobs-3",
        "success_url": SUCCESS_URL,
        "cancel_url": CANCEL_URL,
    }
    r = requests.post(f"{BASE}/payments/checkout", json=body, timeout=TIMEOUT)
    try:
        detail = r.json().get("detail", "")
    except Exception:
        detail = r.text
    ok = (r.status_code == 401) and (detail == "login_required")
    record("2. Guest user_id (g_*) => 401 login_required",
           ok, f"status={r.status_code} detail={detail!r}")


# ---------------- Scenario 3: unknown u_ user ----------------
def test_3_unknown_user():
    body = {
        "user_id": "u_does_not_exist_" + uuid.uuid4().hex[:8],
        "item_id": "jobs-3",
        "success_url": SUCCESS_URL,
        "cancel_url": CANCEL_URL,
    }
    r = requests.post(f"{BASE}/payments/checkout", json=body, timeout=TIMEOUT)
    try:
        detail = r.json().get("detail", "")
    except Exception:
        detail = r.text
    ok = (r.status_code == 401) and (detail == "login_required")
    record("3. Unknown u_ user_id => 401 login_required",
           ok, f"status={r.status_code} detail={detail!r}")


# ---------------- Scenario 8: unknown item_id => 404 ----------------
def test_8_unknown_item():
    user = signup_random()
    body = {
        "user_id": user["user_id"],
        "user_email": user["email"],
        "item_id": "no-such-item-zzz",
        "success_url": SUCCESS_URL,
        "cancel_url": CANCEL_URL,
    }
    r = requests.post(f"{BASE}/payments/checkout", json=body, timeout=TIMEOUT)
    try:
        detail = r.json().get("detail", "")
    except Exception:
        detail = r.text
    ok = (r.status_code == 404) and ("Unknown item" in detail or "unknown" in detail.lower())
    record("8. Unknown item_id => 404",
           ok, f"status={r.status_code} detail={detail!r}")


# Test missing email — happens when user has no email AND request omits.
# But /api/auth/signup always sets email. So we simulate: insert a user row
# with email="" directly into DB OR rely on stripping email from DB.
def test_email_required():
    # Direct DB write: create a user without an email
    if db is None:
        record("Email required scenario (skipped, no DB access)", True, "no MONGO_URL")
        return
    uid = "u_no_email_" + uuid.uuid4().hex[:8]
    db.users.insert_one({
        "user_id": uid,
        "email": "",
        "name": "No Email",
        "password_hash": "x",
    })
    try:
        body = {
            "user_id": uid,
            "item_id": "jobs-3",
            "success_url": SUCCESS_URL,
            "cancel_url": CANCEL_URL,
        }
        r = requests.post(f"{BASE}/payments/checkout", json=body, timeout=TIMEOUT)
        try:
            detail = r.json().get("detail", "")
        except Exception:
            detail = r.text
        ok = (r.status_code == 400) and (detail == "email_required")
        record("Email required: user has no email & request omits => 400 email_required",
               ok, f"status={r.status_code} detail={detail!r}")
    finally:
        db.users.delete_one({"user_id": uid})


# ---------------- Scenario 4: happy path ----------------
HAPPY_PATH_STATE = {}

def test_4_happy_path():
    user = signup_random()
    HAPPY_PATH_STATE["user"] = user
    body = {
        "user_id": user["user_id"],
        "user_email": user["email"],
        "item_id": "jobs-3",
        "success_url": SUCCESS_URL,
        "cancel_url": CANCEL_URL,
        "avatar_id": "maya",
        "return_path": "/chat?avatar=maya",
        "service_id": "jobs-3",  # extra field — server may ignore
    }
    r = requests.post(f"{BASE}/payments/checkout", json=body, timeout=TIMEOUT)
    ok = r.status_code == 200
    if not ok:
        record("4a. Happy path POST /payments/checkout => 200",
               False, f"status={r.status_code} body={r.text[:400]}")
        return
    j = r.json()
    HAPPY_PATH_STATE["resp"] = j

    # Verify response shape
    required_keys = {"purchase_id", "session_id", "url", "amount", "currency"}
    has_keys = required_keys.issubset(set(j.keys()))
    record("4a. Happy path response shape (purchase_id, session_id, url, amount, currency)",
           has_keys, f"keys={list(j.keys())}")

    # Verify amount == 399 (jobs-3) and currency == gbp
    amt_ok = j.get("amount") == 399 and (j.get("currency") or "").lower() == "gbp"
    record("4b. Happy path amount=399 currency=gbp", amt_ok,
           f"amount={j.get('amount')} currency={j.get('currency')}")

    # Verify DB row
    if db is not None:
        time.sleep(0.3)
        row = db.purchases.find_one({"stripe_session_id": j["session_id"]})
        HAPPY_PATH_STATE["db_row"] = row
        if not row:
            record("4c. DB purchases row created", False, "no row found")
            return
        checks = {
            "user_id": row.get("user_id") == user["user_id"],
            "user_id starts u_": row.get("user_id", "").startswith("u_"),
            "user_email (lowercased)": row.get("user_email") == user["email"].lower(),
            "user_name": row.get("user_name") == user["name"],
            "avatar_id": row.get("avatar_id") == "maya",
            "item_id": row.get("item_id") == "jobs-3",
            "service_id": row.get("service_id") == "jobs-3",
            "return_path": row.get("return_path") == "/chat?avatar=maya",
            "status pending": row.get("status") == "pending",
        }
        all_ok = all(checks.values())
        failed = [k for k, v in checks.items() if not v]
        record("4c. DB purchases row enriched fields", all_ok,
               f"checks={checks} failed={failed} row_keys={sorted(row.keys())}")


# ---------------- Scenario 5: explicit user_email overrides DB email ----------------
def test_5_explicit_email_override():
    user = signup_random()
    override_email = f"OVERRIDE_{uuid.uuid4().hex[:6]}@Example.com"
    body = {
        "user_id": user["user_id"],
        "user_email": override_email,
        "item_id": "itv-basic",
        "success_url": SUCCESS_URL,
        "cancel_url": CANCEL_URL,
    }
    r = requests.post(f"{BASE}/payments/checkout", json=body, timeout=TIMEOUT)
    if r.status_code != 200:
        record("5. Explicit user_email override => 200", False,
               f"status={r.status_code} body={r.text[:300]}")
        return
    j = r.json()
    if db is None:
        record("5. Explicit user_email override (no DB)", True, "skipped DB check")
        return
    row = db.purchases.find_one({"stripe_session_id": j["session_id"]})
    ok = bool(row) and row.get("user_email") == override_email.lower()
    record("5. user_email request value (lowercased) overrides DB email",
           ok, f"row.user_email={row.get('user_email') if row else None} expected={override_email.lower()}")


# ---------------- Scenario 6: return_path stored ----------------
def test_6_return_path_stored():
    user = signup_random()
    rp = "/chat?avatar=sofia&intent=interview"
    body = {
        "user_id": user["user_id"],
        "user_email": user["email"],
        "item_id": "itv-standard",
        "success_url": SUCCESS_URL,
        "cancel_url": CANCEL_URL,
        "return_path": rp,
    }
    r = requests.post(f"{BASE}/payments/checkout", json=body, timeout=TIMEOUT)
    if r.status_code != 200:
        record("6. return_path stored => 200", False, f"status={r.status_code}")
        return
    j = r.json()
    if db is None:
        record("6. return_path stored (no DB)", True, "skipped")
        return
    row = db.purchases.find_one({"stripe_session_id": j["session_id"]})
    ok = bool(row) and row.get("return_path") == rp
    record("6. return_path stored on purchases row",
           ok, f"row.return_path={row.get('return_path') if row else None!r}")


# ---------------- Scenario 7: webhook flips pending -> paid (idempotent) ----------------
def test_7_webhook_idempotent():
    if "resp" not in HAPPY_PATH_STATE or "db_row" not in HAPPY_PATH_STATE:
        record("7. Webhook idempotency", False, "happy path not available")
        return
    session_id = HAPPY_PATH_STATE["resp"]["session_id"]
    purchase_id = HAPPY_PATH_STATE["resp"]["purchase_id"]
    event_id = f"evt_test_{uuid.uuid4().hex[:16]}"

    # Synthetic Stripe checkout.session.completed payload
    payload = {
        "id": event_id,
        "object": "event",
        "type": "checkout.session.completed",
        "livemode": False,
        "data": {
            "object": {
                "id": session_id,
                "object": "checkout.session",
                "payment_status": "paid",
                "status": "complete",
                "amount_total": 399,
                "currency": "gbp",
                "metadata": {
                    "purchase_id": purchase_id,
                    "user_id": HAPPY_PATH_STATE["user"]["user_id"],
                    "user_email": HAPPY_PATH_STATE["user"]["email"],
                    "item_id": "jobs-3",
                    "service_id": "jobs-3",
                    "avatar": "maya",
                    "avatar_id": "maya",
                    "kind": "service",
                    "return_path": "/chat?avatar=maya",
                },
            }
        },
    }
    raw = json.dumps(payload).encode("utf-8")
    # Without a valid signature this may bounce. Send with empty sig header.
    headers = {
        "Content-Type": "application/json",
        "Stripe-Signature": "t=0,v1=test",
    }
    r = requests.post(f"{BASE}/payments/webhook", data=raw, headers=headers, timeout=TIMEOUT)
    webhook_status = r.status_code
    webhook_body = r.text[:300]

    # Inspect DB row regardless of HTTP code
    time.sleep(0.5)
    row = db.purchases.find_one({"stripe_session_id": session_id}) if db is not None else None
    if not row:
        record("7. Webhook idempotency — DB row found", False,
               f"webhook_status={webhook_status} body={webhook_body}")
        return
    is_paid = row.get("status") == "paid"
    has_paid_at = bool(row.get("paid_at"))
    has_via_webhook = row.get("paid_via_webhook") is True
    has_event_id = bool(row.get("stripe_event_id"))
    ok = is_paid and has_paid_at and has_via_webhook and has_event_id
    record(
        "7. Webhook flips pending->paid w/ paid_via_webhook=true & stripe_event_id captured",
        ok,
        f"webhook_status={webhook_status} body={webhook_body} status={row.get('status')!r} "
        f"paid_at={row.get('paid_at')!r} paid_via_webhook={row.get('paid_via_webhook')!r} "
        f"stripe_event_id={row.get('stripe_event_id')!r}",
    )

    # Idempotency: send the same event again, row should stay paid (no errors)
    r2 = requests.post(f"{BASE}/payments/webhook", data=raw, headers=headers, timeout=TIMEOUT)
    time.sleep(0.3)
    row2 = db.purchases.find_one({"stripe_session_id": session_id}) if db is not None else None
    idempotent_ok = (
        row2 and row2.get("status") == "paid"
        and row2.get("stripe_event_id") == row.get("stripe_event_id")
    )
    record("7b. Webhook is idempotent (replay leaves row unchanged)",
           bool(idempotent_ok),
           f"replay_status={r2.status_code} status={row2.get('status') if row2 else None}")


# ---------------- main ----------------
def main():
    print(f"BASE={BASE}")
    print(f"DB_NAME={DB_NAME} mongo_connected={db is not None}")
    print("-" * 80)

    test_1_missing_user_id()
    test_2_guest_id()
    test_3_unknown_user()
    test_email_required()
    test_4_happy_path()
    test_5_explicit_email_override()
    test_6_return_path_stored()
    test_8_unknown_item()
    test_7_webhook_idempotent()

    print("\n" + "=" * 80)
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"SUMMARY: {passed}/{total} passed")
    for name, ok, _ in results:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
