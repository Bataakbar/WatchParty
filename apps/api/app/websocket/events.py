from pydantic import BaseModel, Field, ValidationError


class JoinRoomIn(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9]{6}$")
    username: str = Field(min_length=1, max_length=30)
    token: str | None = None


class MediaOpenIn(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    mediaId: str | None = Field(default=None, max_length=255)


class PositionIn(BaseModel):
    position: float = Field(ge=0, le=2_000_000)


class RateIn(BaseModel):
    rate: float = Field(gt=0.05, le=8)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class PlayerStatusIn(BaseModel):
    status: str
    detail: str | None = None


PLAYER_STATUSES = {"SYNCING", "PLAYER_UNAVAILABLE", "CONNECTED", "LOADING"}


def parse_payload(model: type[BaseModel], data: dict) -> BaseModel | None:
    try:
        return model.model_validate(data)
    except ValidationError:
        return None
