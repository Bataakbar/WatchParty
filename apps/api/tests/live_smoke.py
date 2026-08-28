import asyncio
import json
import sys

import httpx
import websockets

API = "http://localhost:8000"
WS = "ws://localhost:8000/ws"


async def recv_until(ws, want_type, timeout=5):
    while True:
        raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        event = json.loads(raw)
        if event.get("type") == want_type:
            return event


async def main():
    results = []

    def check(name, ok, detail=""):
        results.append((name, ok, detail))
        print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")

    async with httpx.AsyncClient() as http:
        res = await http.post(f"{API}/api/rooms", json={"username": "HostTest"})
        data = res.json()
        code = data["code"]

    host = await websockets.connect(WS)
    join_msg = {
        "type": "JOIN_ROOM",
        "code": code,
        "username": "HostTest",
        "token": data["token"],
    }
    await host.send(json.dumps(join_msg))
    joined = await recv_until(host, "JOINED")
    check("host join", any(p["role"] == "HOST" for p in joined["participants"]))

    guest = await websockets.connect(WS)
    await guest.send(json.dumps({"type": "JOIN_ROOM", "code": code, "username": "GuestTest"}))
    gj = await recv_until(guest, "JOINED")
    check("guest join", len(gj["participants"]) == 2)
    await recv_until(host, "USER_JOINED")

    url = "https://filmapik.college/nonton-feed-2026-subtitle-indonesia/play"
    await host.send(json.dumps({"type": "MEDIA_OPEN", "url": url}))
    await recv_until(host, "MEDIA_OPEN")
    mo_g = await recv_until(guest, "MEDIA_OPEN")
    check("media open broadcast", mo_g["url"] == url and mo_g["position"] == 0.0)

    await host.send(json.dumps({"type": "PLAY", "position": 10.0}))
    pg = await recv_until(guest, "PLAY")
    check("play broadcast", pg["playing"] is True and pg["position"] >= 10.0)

    await asyncio.sleep(1.5)

    await guest.send(json.dumps({"type": "PLAY", "position": 1.0}))
    err = await recv_until(guest, "ERROR")
    check("guest rejected", err["code"] == "AUTH_REQUIRED")

    await guest.send(json.dumps({"type": "SYNC_REQUEST"}))
    snap = await recv_until(guest, "SYNC_RESPONSE")
    expected_drift = abs(snap["position"] - (10.0 + 1.5))
    check("sync snapshot drift < 0.5s", expected_drift < 0.5, f"drift={expected_drift:.3f}s")

    await host.send(json.dumps({"type": "SEEK", "position": 900.0}))
    sk = await recv_until(guest, "SEEK")
    check("seek broadcast", abs(sk["position"] - 900.0) < 0.3)

    await host.send(json.dumps({"type": "PAUSE", "position": 901.0}))
    pz = await recv_until(guest, "PAUSE")
    check("pause broadcast", pz["playing"] is False)

    await guest.send(json.dumps({"type": "CHAT_MESSAGE", "message": "Halo dari guest!"}))
    ch_h = await recv_until(host, "CHAT_MESSAGE")
    check("chat", ch_h["message"] == "Halo dari guest!" and ch_h["username"] == "GuestTest")

    t0 = 555555
    await host.send(json.dumps({"type": "PING", "sentAt": t0}))
    pong = await recv_until(host, "PONG")
    check("clock ping/pong", pong["sentAt"] == t0 and isinstance(pong["serverTime"], int))

    await host.close()
    ev = await recv_until(guest, "HOST_CHANGED")
    check("host transfer on disconnect", ev["hostId"] in [p["id"] for p in gj["participants"]])

    token = gj["token"]
    gid = gj["participantId"]
    await guest.close()
    g2 = await websockets.connect(WS)
    await g2.send(
        json.dumps({"type": "JOIN_ROOM", "code": code, "username": "GuestTest", "token": token})
    )
    rj = await recv_until(g2, "JOINED")
    check("reconnect restores identity", rj["participantId"] == gid)
    await g2.close()

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
