"""RevoloAI backend API tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://career-app-enhance.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# Health
def test_root(s):
    r = s.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert r.json().get("message") == "Hello World"


# Avatars
@pytest.mark.parametrize("name", ["maya", "sofia", "aria"])
def test_avatar_image(s, name):
    r = s.get(f"{BASE_URL}/api/avatars/{name}")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/png")
    assert len(r.content) > 100


def test_avatar_unknown(s):
    r = s.get(f"{BASE_URL}/api/avatars/unknown")
    assert r.status_code == 404


# Chat
@pytest.mark.parametrize("avatar", ["maya", "sofia", "aria"])
def test_chat_each(s, avatar):
    r = s.post(f"{BASE_URL}/api/chat", json={"avatar": avatar, "message": "hi", "history": []})
    assert r.status_code == 200, r.text
    j = r.json()
    assert "reply" in j and isinstance(j["reply"], str) and len(j["reply"]) > 0
    assert "suggestions" in j and isinstance(j["suggestions"], list) and len(j["suggestions"]) >= 1


def test_chat_unknown_404(s):
    r = s.post(f"{BASE_URL}/api/chat", json={"avatar": "ghost", "message": "hi", "history": []})
    assert r.status_code == 404


# Purchases
def test_purchase_create_and_get(s):
    uid = "TEST_user_purchase"
    payload = {
        "user_id": uid,
        "avatar": "maya",
        "item_id": "jobs-3",
        "item_title": "TEST_3 jobs",
        "price": "£3.99",
        "kind": "service",
    }
    r = s.post(f"{BASE_URL}/api/purchases", json=payload)
    assert r.status_code == 200, r.text
    created = r.json()
    assert created["user_id"] == uid
    assert created["item_title"] == payload["item_title"]
    assert created["status"] == "paid"
    assert "id" in created
    assert "_id" not in created

    g = s.get(f"{BASE_URL}/api/purchases", params={"user_id": uid})
    assert g.status_code == 200
    arr = g.json()
    assert any(p["id"] == created["id"] for p in arr)


# Saved jobs CRUD
def test_saved_jobs_flow(s):
    uid = "TEST_user_saved"
    payload = {"user_id": uid, "title": "TEST_Backend Engineer", "company": "Acme", "location": "Remote"}
    r = s.post(f"{BASE_URL}/api/saved-jobs", json=payload)
    assert r.status_code == 200, r.text
    j = r.json()
    job_id = j["id"]
    assert j["title"] == payload["title"]
    assert "_id" not in j

    g = s.get(f"{BASE_URL}/api/saved-jobs", params={"user_id": uid})
    assert g.status_code == 200
    assert any(x["id"] == job_id for x in g.json())

    d = s.delete(f"{BASE_URL}/api/saved-jobs/{job_id}", params={"user_id": uid})
    assert d.status_code == 200
    assert d.json().get("deleted") == 1

    g2 = s.get(f"{BASE_URL}/api/saved-jobs", params={"user_id": uid})
    assert not any(x["id"] == job_id for x in g2.json())
