import json
import logging

from fastapi import WebSocket

from app.models.room import Room
from app.services.room_service import ParticipantState

logger = logging.getLogger("watchparty.ws")


async def send_to(ws: WebSocket, payload: dict) -> bool:
    try:
        await ws.send_text(json.dumps(payload))
        return True
    except Exception:
        logger.warning("send failed", exc_info=True)
        return False


async def broadcast(room: Room, payload: dict, exclude: str | None = None) -> None:
    text = json.dumps(payload)
    for participant in room.connected_participants():
        if exclude is not None and participant.id == exclude:
            continue
        ws = participant.ws
        if isinstance(ws, WebSocket):
            try:
                await ws.send_text(text)
            except Exception:
                participant.connected = False


def broadcast_participants(room: Room) -> dict:
    return {
        "type": "ROOM_STATE",
        "room": room.snapshot(),
        "participants": room.participants_public(),
    }


def participant_of(room: Room, participant_id: str | None) -> ParticipantState | None:
    if participant_id is None:
        return None
    return room.participants.get(participant_id)
