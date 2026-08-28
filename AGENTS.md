# AGENTS.md

## Project

**WatchTogether** — synchronized watch-party app. Host creates a room, opens a supported video page; guests' browsers follow automatically and each loads the video locally. Only playback state crosses the backend. Never proxy/store video; never bypass DRM; host-only playback control.

## Layout

```
apps/web         Next.js 16 frontend (@watchparty/web)
apps/api         FastAPI backend (Python, in-memory store, Postgres models staged)
apps/extension   Chrome MV3 extension (@watchparty/extension)
packages/shared  Typed WS event protocol (@watchparty/shared)
```

npm workspaces at root (`@watchparty/*`). Python venv lives at repo root `.venv`.

## Commands (verified)

```bash
# Backend — run from apps/api (so the `app` package resolves)
D:\Bata\watch party\.venv\Scripts\python -m pytest -q        # 25 tests
D:\Bata\watch party\.venv\Scripts\python -m ruff check .     # lint
../../.venv/Scripts/python -m uvicorn app.main:app --port 8000

# Frontend — from repo root
npm run dev:web            # http://localhost:3000
npm run typecheck:web      # tsc --noEmit
npm run lint:web
npm run build:web

# Shared types / extension — from repo root
npm run typecheck --workspace @watchparty/shared
npm run build:extension    # outputs apps/extension/dist → load unpacked in chrome://extensions
```

Setup from scratch: `python -m venv .venv && .venv/Scripts/pip install -r apps/api/requirements.txt` then `npm install` at root.

Live end-to-end smoke (needs backend running): `cd apps/api && ../../.venv/Scripts/python tests/live_smoke.py` — exercises join/sync/chat/transfer/reconnect over real WebSockets (12 checks).

Browser E2E (needs BOTH servers running + `npx playwright install chromium` once): `cd apps/web && node tests/e2e.mjs` — drives real host+guest Chromium contexts through create/join/open-stream/play/pause/seek/chat and asserts drift < 1.5s (11 checks). `tests/probe.mjs` is a single-session debug probe dumping room state from `window.__wt`.

Required command order after changes: `ruff check` → `pytest` → live_smoke (api); `typecheck` → `lint` → `build` → e2e (web).

## Architecture facts that are easy to miss

- **Single WS connection is owned by the web page**, not the extension. Chain: site tab content script ↔ service worker ↔ app-tab content script ↔ `window.postMessage` ↔ React room client ↔ FastAPI. Cross-origin iframes cannot be scripted directly; the extension relays instead.
- Server broadcasts events **back to the sender too** (echo). Clients treat echoed snapshots as authoritative confirmation.
- Sync math: guests compute expected position from `timestamp + clock offset` (PING/PONG median of last 5 samples, `use-room.ts`), then soft drift ≤0.35s ignored, <5s rate-nudge, ≥5s hard seek.
- `PLAYER_POSITION` events travel **extension→page only** (never sent to server); they feed the guest drift loop for extension-based playback.
- Room state is in-memory by design for MVP; SQLAlchemy models exist in `app/models/db.py` but are not wired into runtime yet. Rooms expire via lazy purge + 15s sweeper (`ROOM_EXPIRATION_MINUTES`).
- Host disconnect transfers host to earliest connected participant; empty rooms survive until expiration so a host refresh can reclaim via session token (`sessionStorage wt:token:<CODE>`).

## Toolchain gotchas (bit us already)

- **Next 16**: read bundled docs at `apps/web/node_modules/next/dist/docs/` before assuming old App Router behavior. An auto-generated `apps/web/AGENTS.md` reminds of this — do not delete it.
- **No top-level browser globals** in imported modules: `const X = window.location.origin` at module scope 500s SSR'd routes. Use a function called inside effects/handlers.
- **React 19 ESLint** forbids ref writes during render (`react-hooks/refs`) and setState in effect bodies (`react-hooks/set-state-in-effect`); scoped eslint-disable comments exist deliberately — keep them minimal.
- **StrictMode double-mount spawns zombie WebSockets** unless cleanup detaches handlers (`ws.onclose = null`) AND stale callbacks are generation-guarded (`disposed` flag) — otherwise the retry timer reconnects the killed first socket and `send()` silently no-ops.
- **Server event field mapping**: server broadcasts `MEDIA_OPEN` with a `url` field; client snapshots store it as `currentUrl`. The WS handler in `use-room.ts` maps `url→currentUrl`; forgetting this makes the stage silently never switch.
- **Paused drift must hard-seek**: rate-nudge correction does nothing while paused. Any drift >0.35s on paused playback must seek directly.
- **Autoplay policy**: `video.play()` called from WS-message effects (no user gesture) is rejected by Chrome. Fallback: mute → retry play → user can unmute via the stage toggle.
- **Never use external sample video URLs**: blocked/slow networks fail as a silent black `<video>` with `MEDIA_ELEMENT_ERROR`. The test stream is bundled at `apps/api/app/static/sample.mp4`, served by FastAPI at `/media/sample.mp4`.
- **Next dev overlay intercepts clicks** in headless tests (`<nextjs-portal>` covers the page); `devIndicators: false` in `next.config.ts` disables it.
- **Starlette 1.x TestClient** requires entering the websocket context manager before any send/receive; tests use the `Sock` helper wrapping `__enter__`.
- Tailwind v4: theme tokens live in CSS via `@theme inline` in `globals.css`, no tailwind.config file.
- Extension must bundle to flat `dist/*.js` filenames matching manifest paths (see `build.mjs` object-form entryPoints).

## Protocol

All WS events are defined once in `packages/shared/src/index.ts` (discriminated unions + drift helpers). Backend mirrors them in `app/websocket/events.py`. When changing an event, update shared TS, Python handlers, and both consumers in the same change.

## Env

Copy `.env.example` files (root + `apps/api/`). Defaults assume API on :8000, web on :3000. CORS origins come from `CORS_ORIGINS`. Never commit secrets.
