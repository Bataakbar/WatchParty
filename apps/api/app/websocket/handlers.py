import asyncio
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.models.room import ROLE_HOST, Room
from app.services.chat_service import (
    ChatService,
    ChatValidationError,
    RateLimitedError,
    get_chat_service,
)
from app.services.clock import now_ms
from app.services.room_service import (
    RoomFullError,
    RoomNotFoundError,
    RoomService,
    get_room_service,
)
from app.services.sync_service import (
    apply_pause,
    apply_play,
    apply_rate,
    apply_seek,
    open_media,
    sync_broadcast,
)
from app.websocket.events import (
    PLAYER_STATUSES,
    ChatIn,
    JoinRoomIn,
    MediaOpenIn,
    PlayerStatusIn,
    PositionIn,
    RateIn,
    parse_payload,
)
from app.websocket.manager import broadcast, send_to

logger = logging.getLogger("watchparty.ws")


class ConnectionContext:
    def __init__(self, ws: WebSocket) -> None:
        self.ws = ws
        self.room_code: str | None = None
        self.participant_id: str | None = None
        self.sync_task: asyncio.Task | None = None


def _error(code: str, message: str) -> dict:
    return {"type": "ERROR", "code": code, "message": message}


def _room_state(room: Room) -> dict:
    return {
        "type": "ROOM_STATE",
        "room": room.snapshot(),
        "participants": room.participants_public(),
    }


async def dispatch(
    ctx: ConnectionContext,
    raw: str,
    rooms: RoomService,
    chat: ChatService,
) -> None:
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError
        event_type = data.get("type")
        if not isinstance(event_type, str):
            raise ValueError
    except ValueError:
        await send_to(ctx.ws, _error("BAD_REQUEST", "Malformed event"))
        return

    handlers = {
        "JOIN_ROOM": handle_join,
        "LEAVE_ROOM": handle_leave,
        "MEDIA_OPEN": handle_media_open,
        "MEDIA_READY": handle_media_ready,
        "PLAYER_STATUS": handle_player_status,
        "PLAY": handle_play,
        "PAUSE": handle_pause,
        "SEEK": handle_seek,
        "RATE_CHANGE": handle_rate_change,
        "SYNC_REQUEST": handle_sync_request,
        "CHAT_MESSAGE": handle_chat,
        "PING": handle_ping,
    }
    handler = handlers.get(event_type)
    if handler is None:
        await send_to(ctx.ws, _error("BAD_REQUEST", f"Unknown event type {event_type}"))
        return
    await handler(ctx, data, rooms, chat)


async def handle_join(
    ctx: ConnectionContext, data: dict, rooms: RoomService, chat: ChatService
) -> None:
    payload = parse_payload(JoinRoomIn, data)
    if payload is None:
        await send_to(ctx.ws, _error("INVALID_CODE", "Invalid room code or username"))
        return
    try:
        room = rooms.get_room(payload.code)
    except RoomNotFoundError:
        await send_to(ctx.ws, _error("ROOM_NOT_FOUND", "Room does not exist or has expired"))
        return
    try:
        participant, reconnected = rooms.bind_participant(
            room, payload.username.strip(), payload.token, ctx.ws
        )
    except RoomFullError:
        await send_to(ctx.ws, _error("ROOM_FULL", "Room is full"))
        return
    ctx.room_code = room.code
    ctx.participant_id = participant.id
    token = next(t for t, pid in room.tokens.items() if pid == participant.id)
    await send_to(
        ctx.ws,
        {
            "type": "JOINED",
            "token": token,
            "participantId": participant.id,
            "room": room.snapshot(),
            "participants": room.participants_public(),
        },
    )
    if not reconnected:
        await broadcast(
            room,
            {"type": "USER_JOINED", "participant": participant.public()},
            exclude=participant.id,
        )


def _resolve(ctx: ConnectionContext, rooms: RoomService) -> tuple[Room | None, object | None]:
    if ctx.room_code is None or ctx.participant_id is None:
        return None, None
    try:
        room = rooms.get_room(ctx.room_code)
    except RoomNotFoundError:
        return None, None
    return room, room.participants.get(ctx.participant_id)


async def _reject_if_not_host(
    ctx: ConnectionContext, participant: object
) -> bool:
    from app.services.room_service import ParticipantState

    if not isinstance(participant, ParticipantState) or participant.role != ROLE_HOST:
        await send_to(ctx.ws, _error("AUTH_REQUIRED", "Only the host can control playback"))
        return True
    return False


async def handle_media_open(ctx, data, rooms, chat) -> None:
    room, participant = _resolve(ctx, rooms)
    if room is None or participant is None:
        return
    if await _reject_if_not_host(ctx, participant):
        return
    payload = parse_payload(MediaOpenIn, data)
    if payload is None:
        await send_to(ctx.ws, _error("BAD_REQUEST", "Invalid MEDIA_OPEN payload"))
        return
    open_media(room, payload.url, payload.mediaId)
    await broadcast(
        room,
        {
            "type": "MEDIA_OPEN",
            "url": payload.url,
            "mediaId": payload.mediaId,
            **sync_broadcast(room),
        },
    )


async def handle_media_ready(ctx, data, rooms, chat) -> None:
    from app.services.room_service import ParticipantState

    room, participant = _resolve(ctx, rooms)
    if room is None or not isinstance(participant, ParticipantState):
        return
    participant.status = "CONNECTED"
    participant.last_seen = now_ms()
    await send_to(ctx.ws, {"type": "SYNC_RESPONSE", **sync_broadcast(room)})
    await broadcast(
        room,
        {
            "type": "PARTICIPANT_STATUS",
            "participantId": participant.id,
            "status": participant.status,
        },
        exclude=participant.id,
    )


async def handle_player_status(ctx, data, rooms, chat) -> None:
    from app.services.room_service import ParticipantState

    room, participant = _resolve(ctx, rooms)
    if room is None or not isinstance(participant, ParticipantState):
        return
    payload = parse_payload(PlayerStatusIn, data)
    if payload is None or payload.status not in PLAYER_STATUSES:
        await send_to(ctx.ws, _error("BAD_REQUEST", "Invalid player status"))
        return
    participant.status = payload.status
    participant.last_seen = now_ms()
    await broadcast(
        room,
        {
            "type": "PARTICIPANT_STATUS",
            "participantId": participant.id,
            "status": participant.status,
        },
        exclude=participant.id,
    )


async def handle_play(ctx, data, rooms, chat) -> None:
    room, participant = _resolve(ctx, rooms)
    if room is None or participant is None:
        return
    if await _reject_if_not_host(ctx, participant):
        return
    payload = parse_payload(PositionIn, data)
    if payload is None:
        await send_to(ctx.ws, _error("BAD_REQUEST", "Invalid PLAY payload"))
        return
    apply_play(room, payload.position)
    await broadcast(room, {"type": "PLAY", **sync_broadcast(room)})


async def handle_pause(ctx, data, rooms, chat) -> None:
    room, participant = _resolve(ctx, rooms)
    if room is None or participant is None:
        return
    if await _reject_if_not_host(ctx, participant):
        return
    payload = parse_payload(PositionIn, data)
    if payload is None:
        await send_to(ctx.ws, _error("BAD_REQUEST", "Invalid PAUSE payload"))
        return
    apply_pause(room, payload.position)
    await broadcast(room, {"type": "PAUSE", **sync_broadcast(room)})


async def handle_seek(ctx, data, rooms, chat) -> None:
    room, participant = _resolve(ctx, rooms)
    if room is None or participant is None:
        return
    if await _reject_if_not_host(ctx, participant):
        return
    payload = parse_payload(PositionIn, data)
    if payload is None:
        await send_to(ctx.ws, _error("BAD_REQUEST", "Invalid SEEK payload"))
        return
    apply_seek(room, payload.position)
    await broadcast(room, {"type": "SEEK", **sync_broadcast(room)})


async def handle_rate_change(ctx, data, rooms, chat) -> None:
    room, participant = _resolve(ctx, rooms)
    if room is None or participant is None:
        return
    if await _reject_if_not_host(ctx, participant):
        return
    payload = parse_payload(RateIn, data)
    if payload is None:
        await send_to(ctx.ws, _error("BAD_REQUEST", "Invalid RATE_CHANGE payload"))
        return
    apply_rate(room, payload.rate)
    await broadcast(room, {"type": "RATE_CHANGE", **sync_broadcast(room)})


async def handle_sync_request(ctx, data, rooms, chat) -> None:
    room, participant = _resolve(ctx, rooms)
    if room is None or participant is None:
        return
    await send_to(ctx.ws, {"type": "SYNC_RESPONSE", **sync_broadcast(room)})


async def handle_chat(ctx, data, rooms, chat) -> None:
    from app.services.room_service import ParticipantState

    room, participant = _resolve(ctx, rooms)
    if room is None or not isinstance(participant, ParticipantState):
        return
    payload = parse_payload(ChatIn, data)
    if payload is None:
        await send_to(ctx.ws, _error("BAD_REQUEST", "Invalid chat message"))
        return
    try:
        cleaned = chat.validate_and_allow(participant.id, payload.message)
    except RateLimitedError as exc:
        await send_to(ctx.ws, _error("RATE_LIMITED", str(exc)))
        return
    except ChatValidationError as exc:
        await send_to(ctx.ws, _error("BAD_REQUEST", str(exc)))
        return
    await broadcast(
        room,
        {
            "type": "CHAT_MESSAGE",
            **chat.build_message(participant.username, participant.role, cleaned),
        },
    )


async def handle_ping(ctx, data, rooms, chat) -> None:
    sent_at = data.get("sentAt")
    if not isinstance(sent_at, (int, float)) or isinstance(sent_at, bool):
        await send_to(ctx.ws, _error("BAD_REQUEST", "PING requires sentAt"))
        return
    await send_to(ctx.ws, {"type": "PONG", "sentAt": sent_at, "serverTime": now_ms()})


async def handle_leave(ctx, data, rooms, chat) -> None:
    from app.services.room_service import ParticipantState

    room, participant = _resolve(ctx, rooms)
    if room is None or not isinstance(participant, ParticipantState):
        return
    was_host = participant.role == ROLE_HOST
    rooms.remove_participant(room, participant.id)
    ctx.room_code = None
    ctx.participant_id = None
    await broadcast(room, {"type": "USER_LEFT", "participantId": participant.id})
    if was_host:
        new_host_id = rooms.transfer_host_if_needed(room)
        if new_host_id:
            await broadcast(room, {"type": "HOST_CHANGED", "hostId": new_host_id})
            await broadcast(room, _room_state(room))


async def handle_disconnect(ctx: ConnectionContext, rooms: RoomService) -> None:
    from app.services.room_service import ParticipantState

    if ctx.room_code is None or ctx.participant_id is None:
        return
    try:
        room = rooms.get_room(ctx.room_code)
    except RoomNotFoundError:
        return
    participant = room.participants.get(ctx.participant_id)
    if not isinstance(participant, ParticipantState):
        return
    rooms.mark_disconnected(participant)
    await broadcast(room, {"type": "PARTICIPANT_OFFLINE", "participantId": participant.id})
    if participant.role == ROLE_HOST:
        new_host_id = rooms.transfer_host_if_needed(room)
        if new_host_id:
            await broadcast(room, {"type": "HOST_CHANGED", "hostId": new_host_id})
            await broadcast(room, _room_state(room))


async def periodic_sync(ctx: ConnectionContext, rooms: RoomService) -> None:
    interval = get_settings().sync_state_interval_seconds
    try:
        while True:
            await asyncio.sleep(interval)
            room, participant = _resolve(ctx, rooms)
            if room is None or participant is None:
                continue
            if not getattr(participant, "connected", False):
                continue
            await send_to(ctx.ws, {"type": "SYNC_STATE", **sync_broadcast(room)})
    except asyncio.CancelledError:
        pass


async def connection_loop(ws: WebSocket) -> None:
    await ws.accept()
    ctx = ConnectionContext(ws)
    rooms = get_room_service()
    chat = get_chat_service()
    try:
        while True:
            raw = await ws.receive_text()
            if ctx.sync_task is None or ctx.sync_task.done():
                ctx.sync_task = asyncio.create_task(periodic_sync(ctx, rooms))
            await dispatch(ctx, raw, rooms, chat)
    except WebSocketDisconnect:
        if ctx.sync_task is not None:
            ctx.sync_task.cancel()
        await handle_disconnect(ctx, rooms)
