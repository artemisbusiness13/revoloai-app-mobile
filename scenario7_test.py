"""Scenario 7 only: Webhook enrichment for login-required Stripe checkout."""
import os
import sys
import uuid
import time
import json
import requests

BASE = "https://bilingual-ai-coach-1.preview.emergentagent.com/api"


def _ok(msg):
    print(f"  ✓ {msg}")


def _fail(msg):
    print(f"  ✗ {msg}")
    raise AssertionError(msg)


def main():
    print("Scenario 7 — Webhook enrichment (single handler @ line ~843)")
    print("=" * 70)

    # ----- Step 1: Signup fresh user -----
    ts = int(time.time())
    rand = uuid.uuid4().hex[:8]
    email = f"webhook_t_{ts}_{rand}@example.com"
    password = "ValidPass123!"
    name = "Aanya Sharma"

    print("\n[1] Signup fresh user")
    r = requests.post(f"{BASE}/auth/signup", json={
        "name": name,
        "email": email,
        "password": password,
    }, timeout=30)
    if r.status_code != 200:
        _fail(f"signup status {r.status_code}: {r.text}")
    sj = r.json()
    user_id = sj["user"]["user_id"]
    user_email = sj["user"]["email"]
    _ok(f"user_id={user_id}, email={user_email}")
    assert user_id.startswith("u_"), "user_id must start with u_"

    # ----- Step 2: Create checkout -----
    print("\n[2] POST /payments/checkout (jobs-3, maya)")
    payload = {
        "user_id": user_id,
        "user_email": user_email,
        "item_id": "jobs-3",
        "success_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel",
        "avatar_id": "maya",
        "return_path": "/chat?avatar=maya",
    }
    r = requests.post(f"{BASE}/payments/checkout", json=payload, timeout=30)
    if r.status_code != 200:
        _fail(f"checkout status {r.status_code}: {r.text}")
    cj = r.json()
    purchase_id = cj["purchase_id"]
    session_id = cj["session_id"]
    _ok(f"purchase_id={purchase_id}")
    _ok(f"session_id={session_id}")
    _ok(f"amount={cj.get('amount')} {cj.get('currency')}")

    # ----- Step 3: Confirm pending row exists -----
    print("\n[3] Confirm purchase row is pending pre-webhook")
    r = requests.get(f"{BASE}/purchases", params={"user_id": user_id}, timeout=30)
    if r.status_code != 200:
        _fail(f"purchases list status {r.status_code}")
    rows = r.json()
    row = next((x for x in rows if x.get("id") == purchase_id), None)
    if not row:
        _fail(f"purchase row {purchase_id} not found in {len(rows)} rows for user")
    _ok(f"found pending row status={row.get('status')}, paid_via_webhook={row.get('paid_via_webhook')}")
    assert row.get("status") == "pending", f"expected pending, got {row.get('status')}"
    assert row.get("paid_via_webhook") in (None, False), "paid_via_webhook should not be set yet"

    # ----- Step 4: Fire synthetic webhook -----
    event_id = f"evt_test_{uuid.uuid4().hex[:16]}"
    print(f"\n[4] POST /payments/webhook (event_id={event_id})")
    webhook_payload = {
        "id": event_id,
        "type": "checkout.session.completed",
        "livemode": False,
        "data": {
            "object": {
                "id": session_id,
                "payment_status": "paid",
                "amount_total": 399,
                "currency": "gbp",
                "metadata": {
                    "purchase_id": purchase_id,
                    "user_id": user_id,
                    "item_id": "jobs-3",
                    "avatar": "maya",
                },
            }
        },
    }
    r = requests.post(
        f"{BASE}/payments/webhook",
        data=json.dumps(webhook_payload),
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    if r.status_code != 200:
        _fail(f"webhook status {r.status_code}: {r.text}")
    body = r.json()
    _ok(f"webhook 200: {body}")
    assert body.get("received") is True, "expected received:true"
    # First call should NOT be idempotent
    assert not body.get("idempotent"), "first webhook call should not be idempotent"
    assert body.get("event_id") == event_id, f"event_id mismatch: {body.get('event_id')} vs {event_id}"

    # ----- Step 5: Inspect purchase row for enrichment -----
    print("\n[5] GET /purchases — verify enrichment")
    r = requests.get(f"{BASE}/purchases", params={"user_id": user_id}, timeout=30)
    rows = r.json()
    row = next((x for x in rows if x.get("id") == purchase_id), None)
    if not row:
        _fail("purchase row missing after webhook")
    print(f"   row keys: {sorted(row.keys())}")
    print(f"   status={row.get('status')}")
    print(f"   paid_at={row.get('paid_at')}")
    print(f"   paid_via_webhook={row.get('paid_via_webhook')}")
    print(f"   stripe_event_id={row.get('stripe_event_id')}")

    assert row.get("status") == "paid", f"expected status=paid, got {row.get('status')}"
    _ok("status=paid")
    paid_at = row.get("paid_at")
    assert paid_at, f"paid_at missing (got {paid_at})"
    _ok(f"paid_at set: {paid_at}")
    assert row.get("paid_via_webhook") is True, f"paid_via_webhook expected True, got {row.get('paid_via_webhook')}"
    _ok("paid_via_webhook == True")
    assert row.get("stripe_event_id") == event_id, f"stripe_event_id expected {event_id}, got {row.get('stripe_event_id')}"
    _ok(f"stripe_event_id == {event_id}")

    # ----- Step 6: Idempotency -----
    print("\n[6] Replay same webhook payload — expect idempotent:true")
    r = requests.post(
        f"{BASE}/payments/webhook",
        data=json.dumps(webhook_payload),
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    if r.status_code != 200:
        _fail(f"replay webhook status {r.status_code}: {r.text}")
    body2 = r.json()
    print(f"   replay body: {body2}")
    assert body2.get("received") is True
    assert body2.get("idempotent") is True, f"expected idempotent:true on replay, got {body2}"
    _ok("idempotent:true on replay")

    # Confirm row unchanged
    r = requests.get(f"{BASE}/purchases", params={"user_id": user_id}, timeout=30)
    row2 = next((x for x in r.json() if x.get("id") == purchase_id), None)
    assert row2.get("status") == "paid"
    assert row2.get("stripe_event_id") == event_id
    assert row2.get("paid_via_webhook") is True
    assert row2.get("paid_at") == row.get("paid_at"), "paid_at should be unchanged on replay"
    _ok("row state unchanged on replay (paid_at, stripe_event_id, paid_via_webhook all stable)")

    print("\n" + "=" * 70)
    print("SCENARIO 7 — PASS (all 6 steps)")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"\nFAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {e!r}")
        sys.exit(2)
