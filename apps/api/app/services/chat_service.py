import time
import uuid

from app.services.clock import now_ms

CHAT_MAX_LENGTH = 500
CHAT_WINDOW_SECONDS = 10.0
CHAT_MAX_MESSAGES_PER_WINDOW = 10


class RateLimitedError(Exception):
    pass


class ChatValidationError(Exception):
    pass


class ChatService:
    def __init__(self) -> None:
        self._send_times: dict[str, list[float]] = {}

    def validate_and_allow(self, participant_id: str, message: str) -> str:
        cleaned = message.strip()
        if not cleaned:
            raise ChatValidationError("Message must not be empty")
        if len(cleaned) > CHAT_MAX_LENGTH:
            raise ChatValidationError(f"Message exceeds {CHAT_MAX_LENGTH} characters")
        now = time.monotonic()
        window = self._send_times.setdefault(participant_id, [])
        window[:] = [t for t in window if now - t < CHAT_WINDOW_SECONDS]
        if len(window) >= CHAT_MAX_MESSAGES_PER_WINDOW:
            raise RateLimitedError("Too many messages, slow down")
        window.append(now)
        return cleaned

    def build_message(
        self, username: str, role: str, message: str
    ) -> dict:
        return {
            "id": uuid.uuid4().hex[:12],
            "username": username,
            "role": role,
            "message": message,
            "createdAt": now_ms(),
        }


_chat_service: ChatService | None = None


def get_chat_service() -> ChatService:
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service
