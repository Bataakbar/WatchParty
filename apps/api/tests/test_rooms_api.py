import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.room_service import reset_room_service


@pytest.fixture()
def client():
    reset_room_service()
    with TestClient(app) as c:
        yield c


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert isinstance(body["serverTime"], int)


def test_create_room(client):
    res = client.post("/api/rooms", json={"username": "Bata"})
    assert res.status_code == 200
    body = res.json()
    assert len(body["code"]) == 6
    assert body["role"] == "HOST"
    assert body["token"]


def test_get_room_info(client):
    created = client.post("/api/rooms", json={"username": "Bata"}).json()
    res = client.get(f"/api/rooms/{created['code']}")
    assert res.status_code == 200
    body = res.json()
    assert body["exists"] is True
    assert body["participants"] == 1
    assert body["hasMedia"] is False
    assert body["hostUsername"] == "Bata"


def test_get_unknown_room(client):
    res = client.get("/api/rooms/ZZZZZZ")
    assert res.status_code == 404


def test_get_bad_code_format(client):
    res = client.get("/api/rooms/nope")
    assert res.status_code == 400


def test_create_room_rejects_long_username(client):
    res = client.post("/api/rooms", json={"username": "x" * 31})
    assert res.status_code == 422
