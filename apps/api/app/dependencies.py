from typing import Annotated

from fastapi import Depends

from app.config import Settings, get_settings
from app.services.room_service import RoomService, get_room_service

SettingsDep = Annotated[Settings, Depends(get_settings)]
RoomServiceDep = Annotated[RoomService, Depends(get_room_service)]
