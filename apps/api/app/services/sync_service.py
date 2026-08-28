from app.models.room import Room
from app.services.clock import now_ms

MIN_RATE = 0.25
MAX_RATE = 4.0


def apply_play(room: Room, position: float) -> None:
    room.playback_position = position
    room.is_playing = True
    room.updated_at = now_ms()
    room.touch()


def apply_pause(room: Room, position: float) -> None:
    room.playback_position = position
    room.is_playing = False
    room.updated_at = now_ms()
    room.touch()


def apply_seek(room: Room, position: float) -> None:
    room.playback_position = position
    room.updated_at = now_ms()
    room.touch()


def apply_rate(room: Room, rate: float) -> None:
    room.playback_position = effective_position(room, now_ms())
    room.playback_rate = rate
    room.updated_at = now_ms()
    room.touch()


def open_media(room: Room, url: str, media_id: str | None) -> None:
    room.current_url = url
    room.media_id = media_id
    room.playback_position = 0.0
    room.is_playing = False
    room.playback_rate = 1.0
    room.updated_at = now_ms()
    room.touch()


def effective_position(room: Room, at_ms: int | None = None) -> float:
    at = at_ms if at_ms is not None else now_ms()
    if not room.is_playing:
        return room.playback_position
    elapsed_seconds = max(0.0, (at - room.updated_at) / 1000)
    return room.playback_position + elapsed_seconds * room.playback_rate


def sync_broadcast(room: Room, at_ms: int | None = None) -> dict:
    at = at_ms if at_ms is not None else now_ms()
    return {
        "position": round(effective_position(room, at), 3),
        "playing": room.is_playing,
        "rate": room.playback_rate,
        "timestamp": at,
    }
