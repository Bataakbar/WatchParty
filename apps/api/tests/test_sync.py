from app.models.room import Room
from app.services.sync_service import (
    apply_pause,
    apply_play,
    apply_rate,
    apply_seek,
    effective_position,
    open_media,
    sync_broadcast,
)

BASE_TS = 1_750_000_000_000


def make_room() -> Room:
    return Room(code="K7X92P", host_id=None, created_at=BASE_TS, updated_at=BASE_TS)


def test_paused_position_is_static():
    room = make_room()
    room.playback_position = 42.0
    assert effective_position(room, BASE_TS + 10_000) == 42.0


def test_playing_position_advances_with_rate():
    room = make_room()
    apply_play(room, 100.0)
    room.updated_at = BASE_TS
    assert effective_position(room, BASE_TS + 2_000) == 102.0


def test_rate_multiplies_elapsed():
    room = make_room()
    apply_play(room, 100.0)
    apply_rate(room, 2.0)
    base = room.updated_at
    assert effective_position(room, base + 3_000) == 106.0


def test_play_then_pause_freezes_position():
    room = make_room()
    apply_play(room, 50.0)
    paused_at = room.updated_at + 5_000
    apply_pause(room, effective_position(room, paused_at))
    assert room.is_playing is False
    assert abs(room.playback_position - 55.0) < 0.01


def test_seek_updates_immediately():
    room = make_room()
    apply_play(room, 10.0)
    apply_seek(room, 900.0)
    assert room.is_playing is True
    assert effective_position(room, room.updated_at) == 900.0


def test_open_media_resets_state():
    room = make_room()
    apply_play(room, 300.0)
    apply_rate(room, 1.5)
    open_media(room, "https://example.com/watch/1", "abc")
    assert room.current_url == "https://example.com/watch/1"
    assert room.media_id == "abc"
    assert room.is_playing is False
    assert room.playback_position == 0.0
    assert room.playback_rate == 1.0


def test_sync_broadcast_shape():
    room = make_room()
    apply_play(room, 923.42)
    snap = sync_broadcast(room)
    assert set(snap.keys()) == {"position", "playing", "rate", "timestamp"}
    assert snap["playing"] is True
    assert snap["rate"] == 1.0
