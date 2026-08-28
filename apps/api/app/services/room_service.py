import secrets
import uuid

from app.config import get_settings
from app.models.room import CODE_ALPHABET, ROLE_HOST, ROOM_CODE_LENGTH, ParticipantState, Room
from app.services.clock import now_ms

USERNAME_MAX_LENGTH = 30


class RoomNotFoundError(Exception):
    pass


class RoomFullError(Exception):
    pass


class RoomService:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}

    def create_room(self) -> tuple[Room, ParticipantState, str]:
        settings = get_settings()
        code = self._generate_code()
        host = ParticipantState(
            id=uuid.uuid4().hex[:12],
            username="Host",
            role=ROLE_HOST,
            joined_at=now_ms(),
            connected=False,
            last_seen=now_ms(),
        )
        room = Room(
            code=code,
            host_id=host.id,
            created_at=now_ms(),
            participants={host.id: host},
            updated_at=now_ms(),
            last_activity=now_ms(),
        )
        token = uuid.uuid4().hex
        room.tokens[token] = host.id
        self._rooms[code] = room
        assert settings.max_participants > 0
        return room, host, token

    def get_room(self, code: str) -> Room:
        room = self._rooms.get(code)
        if room is None or self._is_expired(room):
            if room is not None:
                del self._rooms[code]
            raise RoomNotFoundError(code)
        return room

    def exists(self, code: str) -> bool:
        try:
            self.get_room(code)
            return True
        except RoomNotFoundError:
            return False

    def participant_count(self, code: str) -> int:
        return len(self.get_room(code).participants)

    def bind_participant(
        self,
        room: Room,
        username: str,
        token: str | None,
        ws: object,
    ) -> tuple[ParticipantState, bool]:
        settings = get_settings()
        now = now_ms()
        if token and token in room.tokens:
            participant = room.participants[room.tokens[token]]
            participant.ws = ws
            participant.connected = True
            participant.last_seen = now
            participant.username = username or participant.username
            room.touch()
            return participant, True
        if len(room.participants) >= settings.max_participants:
            raise RoomFullError(room.code)
        participant = ParticipantState(
            id=uuid.uuid4().hex[:12],
            username=username,
            role="GUEST",
            joined_at=now,
            connected=True,
            ws=ws,
            last_seen=now,
        )
        room.participants[participant.id] = participant
        new_token = uuid.uuid4().hex
        room.tokens[new_token] = participant.id
        room.touch()
        return participant, False

    def remove_participant(self, room: Room, participant_id: str) -> None:
        room.participants.pop(participant_id, None)
        room.tokens = {t: pid for t, pid in room.tokens.items() if pid != participant_id}
        room.touch()

    def mark_disconnected(self, participant: ParticipantState) -> None:
        participant.connected = False
        participant.ws = None
        participant.last_seen = now_ms()

    def transfer_host_if_needed(self, room: Room) -> str | None:
        host = room.participants.get(room.host_id) if room.host_id else None
        if host is not None and host.connected:
            return None
        candidates = [
            p for p in sorted(room.participants.values(), key=lambda x: x.joined_at)
            if p.connected
        ]
        if not candidates:
            return None
        new_host = candidates[0]
        if host is not None:
            host.role = "GUEST"
        new_host.role = ROLE_HOST
        room.host_id = new_host.id
        room.touch()
        return new_host.id

    def sweep(self) -> list[str]:
        settings = get_settings()
        now = now_ms()
        removed_rooms: list[str] = []
        for code in list(self._rooms.keys()):
            room = self._rooms[code]
            dropped: list[str] = []
            for pid, participant in list(room.participants.items()):
                if (
                    not participant.connected
                    and (now - participant.last_seen) / 1000 > settings.disconnect_grace_seconds
                ):
                    dropped.append(pid)
            for pid in dropped:
                self.remove_participant(room, pid)
            if dropped:
                self.transfer_host_if_needed(room)
            idle_seconds = (now - room.last_activity) / 1000
            expired = idle_seconds > settings.room_expiration_minutes * 60
            if expired or len(room.participants) == 0:
                del self._rooms[code]
                removed_rooms.append(code)
        return removed_rooms

    def _is_expired(self, room: Room) -> bool:
        settings = get_settings()
        idle = (now_ms() - room.last_activity) / 1000
        return idle > settings.room_expiration_minutes * 60

    def _generate_code(self) -> str:
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(ROOM_CODE_LENGTH))
            if code not in self._rooms:
                return code


_store: RoomService | None = None


def get_room_service() -> RoomService:
    global _store
    if _store is None:
        _store = RoomService()
    return _store


def reset_room_service() -> None:
    global _store
    _store = RoomService()
