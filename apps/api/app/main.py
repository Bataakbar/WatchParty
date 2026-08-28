import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import health, rooms
from app.config import get_settings
from app.services.room_service import get_room_service
from app.websocket.handlers import connection_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("watchparty")

STATIC_DIR = Path(__file__).resolve().parent / "static"


async def _sweeper() -> None:
    rooms = get_room_service()
    while True:
        await asyncio.sleep(15)
        try:
            rooms.sweep()
        except Exception:
            logger.exception("sweep failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_sweeper())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="WatchTogether API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(rooms.router)

    if STATIC_DIR.is_dir():
        app.mount("/media", StaticFiles(directory=STATIC_DIR), name="media")

    @app.websocket("/ws")
    async def websocket_endpoint(ws: WebSocket) -> None:
        await connection_loop(ws)

    return app


app = create_app()
