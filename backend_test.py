"""
Backend tests for /api/demo/seed and /api/demo/reset endpoints.
Tests scenarios (a)-(g) from the review request.
"""
import requests
import uuid
import sys

# Public ingress URL from frontend EXPO_PUBLIC_BACKEND_URL
BASE_URL = "https://bilingual-ai-coach-1.preview.emergentagent.com"
API = f"{BASE_URL}/api"

results = []


def record(name: str, ok: bool, msg: str = ""):
    results.append((name, ok, msg))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {msg}")


def test_a_seed():
    user_id = f"demo_test_{uuid.uuid4()}"
    r = requests.post(f"{API}/demo/seed", json={"user_id": user_id}, timeout=30)
    if r.status_code != 200:
        record("(a) seed status 200", False, f"status={r.status_code} body={r.text}")
        return None
    data = r.json()
    ok = data.get("ok") is True and data.get("saved_jobs") == 3 and data.get("purchases") == 2
    record("(a) seed returns ok=true with counts {saved_jobs:3, purchases:2}", ok, f"resp={data}")
    return user_id


def test_b_saved_jobs(user_id: str):
    r = requests.get(f"{API}/saved-jobs", params={"user_id": user_id}, timeout=30)
    if r.status_code != 200:
        record("(b) GET saved-jobs status 200", False, f"status={r.status_code} body={r.text}")
        return
    rows = r.json()
    if not isinstance(rows, list) or len(rows) != 3:
        record("(b) saved-jobs returns 3 rows", False, f"count={len(rows) if isinstance(rows, list) else 'NA'}")
        return
    expected_titles = {"Senior Product Designer", "Customer Success Manager", "Data Analyst"}
    titles = {row.get("title") for row in rows}
    all_have_fields = all(("title" in row and "company" in row and "location" in row) for row in rows)
    all_demo = all(row.get("is_demo") is True for row in rows)
    titles_ok = titles == expected_titles
    ok = all_have_fields and all_demo and titles_ok
    record(
        "(b) saved-jobs has 3 rows w/ title,company,location,is_demo:true & seeded titles",
        ok,
        f"titles={titles}, all_have_fields={all_have_fields}, all_demo={all_demo}",
    )


def test_c_purchases(user_id: str):
    r = requests.get(f"{API}/purchases", params={"user_id": user_id}, timeout=30)
    if r.status_code != 200:
        record("(c) GET purchases status 200", False, f"status={r.status_code} body={r.text}")
        return
    rows = r.json()
    if not isinstance(rows, list) or len(rows) != 2:
        record("(c) purchases returns 2 rows", False, f"count={len(rows) if isinstance(rows, list) else 'NA'}")
        return
    statuses = {row.get("status") for row in rows}
    currencies = {row.get("currency") for row in rows}
    amounts = sorted([row.get("amount") for row in rows])
    avatars = {row.get("avatar") for row in rows}
    ok = (
        statuses == {"paid"}
        and currencies == {"gbp"}
        and amounts == [699, 899]
        and avatars == {"sofia", "maya"}
    )
    record(
        "(c) purchases status=paid, currency=gbp, amounts [699,899], avatars sofia+maya",
        ok,
        f"statuses={statuses} currencies={currencies} amounts={amounts} avatars={avatars}",
    )


def test_d_idempotency(user_id: str):
    r = requests.post(f"{API}/demo/seed", json={"user_id": user_id}, timeout=30)
    if r.status_code != 200:
        record("(d) seed (2nd) status 200", False, f"status={r.status_code} body={r.text}")
        return
    data = r.json()
    ok1 = data.get("ok") is True and data.get("saved_jobs") == 3 and data.get("purchases") == 2
    record("(d) 2nd seed returns same counts", ok1, f"resp={data}")

    sj = requests.get(f"{API}/saved-jobs", params={"user_id": user_id}, timeout=30).json()
    pu = requests.get(f"{API}/purchases", params={"user_id": user_id}, timeout=30).json()
    ok2 = isinstance(sj, list) and len(sj) == 3 and isinstance(pu, list) and len(pu) == 2
    record(
        "(d) idempotent: counts still 3 & 2 (NOT 6 & 4)",
        ok2,
        f"saved_jobs_count={len(sj) if isinstance(sj, list) else 'NA'} purchases_count={len(pu) if isinstance(pu, list) else 'NA'}",
    )


def test_e_reset(user_id: str):
    r = requests.post(f"{API}/demo/reset", json={"user_id": user_id}, timeout=30)
    if r.status_code != 200:
        record("(e) reset status 200", False, f"status={r.status_code} body={r.text}")
        return
    data = r.json()
    ok1 = (
        data.get("ok") is True
        and data.get("purchases_removed", 0) >= 2
        and data.get("saved_jobs_removed", 0) >= 3
    )
    record("(e) reset returns ok=true w/ purchases_removed>=2 & saved_jobs_removed>=3", ok1, f"resp={data}")

    sj = requests.get(f"{API}/saved-jobs", params={"user_id": user_id}, timeout=30).json()
    pu = requests.get(f"{API}/purchases", params={"user_id": user_id}, timeout=30).json()
    ok2 = isinstance(sj, list) and len(sj) == 0 and isinstance(pu, list) and len(pu) == 0
    record(
        "(e) after reset, saved-jobs and purchases return 0 rows",
        ok2,
        f"saved_jobs_count={len(sj) if isinstance(sj, list) else 'NA'} purchases_count={len(pu) if isinstance(pu, list) else 'NA'}",
    )


def test_f_validation():
    r1 = requests.post(f"{API}/demo/seed", json={}, timeout=30)
    record("(f) seed with empty body returns 400", r1.status_code == 400, f"status={r1.status_code} body={r1.text[:200]}")

    r2 = requests.post(f"{API}/demo/reset", json={}, timeout=30)
    record("(f) reset with empty body returns 400", r2.status_code == 400, f"status={r2.status_code} body={r2.text[:200]}")


def test_g_isolation():
    user_id = "demo_iso_A"

    # Cleanup any prior state
    requests.post(f"{API}/demo/reset", json={"user_id": user_id}, timeout=30)
    # Also remove any leftover non-demo manual jobs from prior runs
    leftover = requests.get(f"{API}/saved-jobs", params={"user_id": user_id}, timeout=30).json()
    if isinstance(leftover, list):
        for row in leftover:
            try:
                requests.delete(f"{API}/saved-jobs/{row['id']}", params={"user_id": user_id}, timeout=30)
            except Exception:
                pass

    # Seed demo rows
    r_seed = requests.post(f"{API}/demo/seed", json={"user_id": user_id}, timeout=30)
    if r_seed.status_code != 200:
        record("(g) initial seed", False, f"status={r_seed.status_code}")
        return

    # Manually save a non-demo job
    r_manual = requests.post(
        f"{API}/saved-jobs",
        json={"user_id": user_id, "title": "My real job", "company": "X"},
        timeout=30,
    )
    if r_manual.status_code != 200:
        record("(g) manual save-job", False, f"status={r_manual.status_code} body={r_manual.text}")
        return
    manual_job = r_manual.json()
    is_demo_on_manual = manual_job.get("is_demo")

    sj_before = requests.get(f"{API}/saved-jobs", params={"user_id": user_id}, timeout=30).json()
    if len(sj_before) != 4:
        record("(g) saved-jobs count before reset == 4", False, f"count={len(sj_before)}")

    # Reset
    r_reset = requests.post(f"{API}/demo/reset", json={"user_id": user_id}, timeout=30)
    if r_reset.status_code != 200:
        record("(g) reset for demo_iso_A", False, f"status={r_reset.status_code}")
        return

    sj_after = requests.get(f"{API}/saved-jobs", params={"user_id": user_id}, timeout=30).json()
    titles = [row.get("title") for row in sj_after]
    has_real = "My real job" in titles
    demo_titles = {"Senior Product Designer", "Customer Success Manager", "Data Analyst"}
    no_demo = all(t not in demo_titles for t in titles)
    ok = has_real and no_demo and len(sj_after) == 1
    record(
        "(g) after reset, manual 'My real job' remains; demo jobs gone",
        ok,
        f"titles_after={titles} is_demo_on_manual={is_demo_on_manual}",
    )

    # Cleanup
    for row in sj_after:
        try:
            requests.delete(f"{API}/saved-jobs/{row['id']}", params={"user_id": user_id}, timeout=30)
        except Exception:
            pass


def main():
    print(f"Testing against: {API}\n")

    user_id = test_a_seed()
    if user_id:
        test_b_saved_jobs(user_id)
        test_c_purchases(user_id)
        test_d_idempotency(user_id)
        test_e_reset(user_id)
    test_f_validation()
    test_g_isolation()

    print("\n=========== SUMMARY ===========")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    for name, ok, msg in results:
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name}")
    print(f"\nTotal: {passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
