from pydantic import BaseModel, Field


class CreateRoomRequest(BaseModel):
    username: str = Field(min_length=1, max_length=30)


class RoomCreatedResponse(BaseModel):
    code: str
    token: str
    participantId: str
    role: str


class RoomInfoResponse(BaseModel):
    code: str
    exists: bool
    participants: int
    capacity: int
    hasMedia: bool
    hostUsername: str | None
