from dataclasses import dataclass, field

from app.services.clock import now_ms

ROLE_HOST = "HOST"
ROLE_GUEST = "GUEST"

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
ROOM_CODE_LENGTH = 6
DISCONNECTED = False
CONNECTED = True


@dataclass
class ParticipantState:
    id: str
    username: str
    role: str
    joined_at: int
    status: str = "CONNECTED"
    connected: bool = CONNECTED
    ws: object | None = field(default=None, repr=False)
    last_seen: int = 0

    def public(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "status": self.status,
        }


@dataclass
class Room:
    code: str
    host_id: str | None
    created_at: int
    participants: dict[str, ParticipantState] = field(default_factory=dict)
    tokens: dict[str, str] = field(default_factory=dict)
    current_url: str | None = None
    media_id: str | None = None
    playback_position: float = 0.0
    is_playing: bool = False
    playback_rate: float = 1.0
    updated_at: int = 0
    last_activity: int = 0

    def snapshot(self) -> dict:
        return {
            "code": self.code,
            "hostId": self.host_id,
            "currentUrl": self.current_url,
            "mediaId": self.media_id,
            "playbackPosition": self.playback_position,
            "isPlaying": self.is_playing,
            "playbackRate": self.playback_rate,
            "timestamp": self.updated_at,
        }

    def participants_public(self) -> list[dict]:
        ordered = sorted(self.participants.values(), key=lambda p: p.joined_at)
        return [p.public() for p in ordered]

    def connected_participants(self) -> list[ParticipantState]:
        ordered = sorted(self.participants.values(), key=lambda p: p.joined_at)
        return [p for p in ordered if p.connected and p.ws is not None]

    def touch(self) -> None:
        self.last_activity = now_ms()
