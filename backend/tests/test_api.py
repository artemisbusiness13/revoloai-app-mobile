"""Backend API tests for revoloai career app"""
import os
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://career-app-enhance.preview.emergentagent.com"
).rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# Root endpoint
class TestRoot:
    def test_root_returns_hello_world(self, api):
        r = api.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("message") == "Hello World"


# Avatar endpoints
class TestAvatars:
    @pytest.mark.parametrize("name", ["maya", "sofia", "aria"])
    def test_avatar_returns_png(self, api, name):
        r = api.get(f"{BASE_URL}/api/avatars/{name}", timeout=15)
        assert r.status_code == 200, f"{name} returned {r.status_code}"
        assert "image/png" in r.headers.get("content-type", "")
        # PNG signature check
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n", f"{name} not a valid PNG"
        assert len(r.content) > 1000, f"{name} avatar too small"

    def test_invalid_avatar_name(self, api):
        r = api.get(f"{BASE_URL}/api/avatars/unknown", timeout=10)
        # Returns 200 with error JSON (not ideal but expected)
        assert r.status_code in (200, 404)


# Status check basic
class TestStatus:
    def test_status_get(self, api):
        r = api.get(f"{BASE_URL}/api/status", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
