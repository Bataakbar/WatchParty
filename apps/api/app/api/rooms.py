from fastapi import APIRouter, HTTPException

from app.dependencies import RoomServiceDep, SettingsDep
from app.schemas.room import CreateRoomRequest, RoomCreatedResponse, RoomInfoResponse
from app.services.room_service import RoomNotFoundError

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.post("", response_model=RoomCreatedResponse)
def create_room(body: CreateRoomRequest, rooms: RoomServiceDep) -> RoomCreatedResponse:
    room, host, token = rooms.create_room()
    host.username = body.username.strip() or "Host"
    return RoomCreatedResponse(
        code=room.code,
        token=token,
        participantId=host.id,
        role="HOST",
    )


@router.get("/{code}", response_model=RoomInfoResponse)
def get_room_info(code: str, rooms: RoomServiceDep, settings: SettingsDep) -> RoomInfoResponse:
    if len(code) != 6 or not code.isalnum():
        raise HTTPException(status_code=400, detail="Invalid room code format")
    try:
        room = rooms.get_room(code)
    except RoomNotFoundError:
        raise HTTPException(status_code=404, detail="Room does not exist or has expired") from None
    host = room.participants.get(room.host_id) if room.host_id else None
    return RoomInfoResponse(
        code=room.code,
        exists=True,
        participants=len(room.participants),
        capacity=settings.max_participants,
        hasMedia=room.current_url is not None,
        hostUsername=host.username if host else None,
    )
