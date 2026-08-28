import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.room_service import reset_room_service


class Sock:
    def __init__(self, client: TestClient) -> None:
        self._cm = client.websocket_connect("/ws")
        self.ws = self._cm.__enter__()

    def send(self, payload: dict) -> None:
        self.ws.send_json(payload)

    def recv(self) -> dict:
        return self.ws.receive_json()

    def close(self) -> None:
        self._cm.__exit__(None, None, None)


@pytest.fixture()
def client():
    reset_room_service()
    with TestClient(app) as c:
        yield c


def setup_room(client) -> tuple[dict, Sock]:
    created = client.post("/api/rooms", json={"username": "Bata"}).json()
    host = Sock(client)
    host.send(
        {
            "type": "JOIN_ROOM",
            "code": created["code"],
            "username": "Bata",
            "token": created["token"],
        }
    )
    joined = host.recv()
    assert joined["type"] == "JOINED"
    assert any(p["role"] == "HOST" for p in joined["participants"])
    return created, host


def test_join_guest_and_presence(client):
    created, host = setup_room(client)
    guest = Sock(client)
    guest.send({"type": "JOIN_ROOM", "code": created["code"], "username": "Andi"})
    guest_joined = guest.recv()
    assert guest_joined["type"] == "JOINED"
    roles = {p["username"]: p["role"] for p in guest_joined["participants"]}
    assert roles == {"Bata": "HOST", "Andi": "GUEST"}
    event = host.recv()
    assert event["type"] == "USER_JOINED"
    assert event["participant"]["username"] == "Andi"
    guest.close()
    host.close()


def test_invalid_code_rejected(client):
    ws = Sock(client)
    ws.send({"type": "JOIN_ROOM", "code": "abc", "username": "X"})
    res = ws.recv()
    assert res == {"type": "ERROR", "code": "INVALID_CODE", "message": res["message"]}
    ws.close()


def test_unknown_room_rejected(client):
    ws = Sock(client)
    ws.send({"type": "JOIN_ROOM", "code": "ZZZZZZ", "username": "X"})
    res = ws.recv()
    assert res["code"] == "ROOM_NOT_FOUND"
    ws.close()


def test_guest_cannot_control_playback(client):
    created, host = setup_room(client)
    guest = Sock(client)
    guest.send({"type": "JOIN_ROOM", "code": created["code"], "username": "Andi"})
    guest.recv()
    host.recv()

    guest.send({"type": "PLAY", "position": 5})
    res = guest.recv()
    assert res == {"type": "ERROR", "code": "AUTH_REQUIRED", "message": res["message"]}
    guest.send(
        {"type": "MEDIA_OPEN", "url": "https://filmapik.college/nonton-x/play"}
    )
    res = guest.recv()
    assert res["code"] == "AUTH_REQUIRED"
    guest.close()
    host.close()


def test_media_open_play_pause_seek_broadcast(client):
    created, host = setup_room(client)
    guest = Sock(client)
    guest.send({"type": "JOIN_ROOM", "code": created["code"], "username": "Andi"})
    guest.recv()
    host.recv()

    url = "https://filmapik.college/nonton-feed-2026-subtitle-indonesia/play"
    host.send({"type": "MEDIA_OPEN", "url": url, "mediaId": "feed-2026"})
    for sock in (host, guest):
        ev = sock.recv()
        assert ev["type"] == "MEDIA_OPEN"
        assert ev["url"] == url
        assert ev["position"] == 0.0
        assert ev["playing"] is False

    host.send({"type": "PLAY", "position": 12.5})
    for sock in (host, guest):
        ev = sock.recv()
        assert ev["type"] == "PLAY"
        assert ev["playing"] is True
        assert ev["position"] >= 12.5

    host.send({"type": "SEEK", "position": 1530.0})
    for sock in (host, guest):
        ev = sock.recv()
        assert ev["type"] == "SEEK"
        assert abs(ev["position"] - 1530.0) < 0.5

    host.send({"type": "PAUSE", "position": 1531.0})
    for sock in (host, guest):
        ev = sock.recv()
        assert ev["type"] == "PAUSE"
        assert ev["playing"] is False
        assert abs(ev["position"] - 1531.0) < 0.5

    guest.close()
    host.close()


def test_sync_request_returns_response(client):
    created, host = setup_room(client)
    host.send({"type": "PLAY", "position": 30.0})
    host.recv()
    host.send({"type": "SYNC_REQUEST"})
    ev = host.recv()
    assert ev["type"] == "SYNC_RESPONSE"
    assert ev["playing"] is True
    assert ev["position"] >= 30.0
    host.close()


def test_chat_flow(client):
    created, host = setup_room(client)
    guest = Sock(client)
    guest.send({"type": "JOIN_ROOM", "code": created["code"], "username": "Andi"})
    guest.recv()
    host.recv()

    guest.send({"type": "CHAT_MESSAGE", "message": "Let's watch this one!"})
    for sock in (host, guest):
        ev = sock.recv()
        assert ev["type"] == "CHAT_MESSAGE"
        assert ev["message"] == "Let's watch this one!"
        assert ev["username"] == "Andi"

    guest.send({"type": "CHAT_MESSAGE", "message": ""})
    ev = guest.recv()
    assert ev["type"] == "ERROR"

    guest.close()
    host.close()


def test_clock_ping_pong(client):
    created, host = setup_room(client)
    host.send({"type": "PING", "sentAt": 123456})
    ev = host.recv()
    assert ev == {"type": "PONG", "sentAt": 123456, "serverTime": ev["serverTime"]}
    assert isinstance(ev["serverTime"], int)
    host.close()


def test_reconnect_restores_identity(client):
    created, host = setup_room(client)
    guest = Sock(client)
    guest.send({"type": "JOIN_ROOM", "code": created["code"], "username": "Andi"})
    guest_joined = guest.recv()
    host.recv()
    token = guest_joined["token"]
    old_id = guest_joined["participantId"]

    guest.close()
    guest2 = Sock(client)
    guest2.send(
        {"type": "JOIN_ROOM", "code": created["code"], "username": "Andi", "token": token}
    )
    rejoined = guest2.recv()
    assert rejoined["type"] == "JOINED"
    assert rejoined["participantId"] == old_id
    assert rejoined["participants"][1]["role"] == "GUEST"
    guest2.close()
    host.close()


def test_host_disconnect_transfers_host(client):
    created, host = setup_room(client)
    code = created["code"]
    guest = Sock(client)
    guest.send({"type": "JOIN_ROOM", "code": code, "username": "Andi"})
    guest.recv()
    host.recv()

    host.close()
    events = [guest.recv() for _ in range(3)]
    types = {e["type"] for e in events}
    assert types == {"PARTICIPANT_OFFLINE", "HOST_CHANGED", "ROOM_STATE"}
    changed = next(e for e in events if e["type"] == "HOST_CHANGED")

    third = Sock(client)
    third.send({"type": "JOIN_ROOM", "code": code, "username": "Budi"})
    joined_third = third.recv()
    assert joined_third["type"] == "JOINED"
    andi = next(p for p in joined_third["participants"] if p["username"] == "Andi")
    budi = next(p for p in joined_third["participants"] if p["username"] == "Budi")
    assert andi["role"] == "HOST"
    assert budi["role"] == "GUEST"
    assert changed["hostId"] == andi["id"]
    third.close()
    guest.close()


def test_leave_room_removes_participant(client):
    created, host = setup_room(client)
    guest = Sock(client)
    guest.send({"type": "JOIN_ROOM", "code": created["code"], "username": "Andi"})
    guest.recv()
    host.recv()

    guest.send({"type": "LEAVE_ROOM"})
    ev = host.recv()
    assert ev["type"] == "USER_LEFT"
    guest.close()
    host.close()


def test_unknown_event_type(client):
    created, host = setup_room(client)
    host.send({"type": "NOPE"})
    ev = host.recv()
    assert ev == {"type": "ERROR", "code": "BAD_REQUEST", "message": ev["message"]}
    host.close()
