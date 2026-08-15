# Phase 1 — Backend & Dashboard

This document covers the Phase 1 slice of the project (README Section 2.2):
a NestJS backend + PostgreSQL + Redis + Next.js dashboard built around the
existing Phase 0 Python recognition service ([docs/phase0.md](phase0.md)).

**Gate triggering remains fully simulated in Phase 1.** No relay, ESP32, or
physical hardware is introduced — `SimulatedGateTrigger` only logs
`GATE WOULD OPEN (simulated)` and writes an access-log row. Phase 3 replaces
that one class with a real implementation behind the same `GateTrigger`
interface; nothing else changes.

## 1. Architecture

```text
Laptop Webcam
      |
Python Recognition Service (Phase 0, recognition/)
      | (detect -> embed -> match -> confidence decision)
      v
FACE_RECOGNIZED / FACE_UNKNOWN event
      |
Redis Pub/Sub ("gate:recognition-events")
      |
NestJS Backend (backend/)
      |-- validates event, resolves member by name (Phase 0 has no concept
      |   of Postgres IDs), checks isActive
      |-- PostgreSQL: members, embeddings (metadata only), access_logs
      |-- SimulatedGateTrigger: logs "GATE WOULD OPEN", never touches hardware
      `-- WebSocket (Socket.IO): recognition.detected / unknown-face.detected /
          gate.status / system.status
      |
Next.js Dashboard (frontend/)
      |-- Live Status Panel, Access Log, Family Members, Alerts
      `-- JWT login; REST for CRUD/history, WebSocket for live updates
```

Embedding **vectors** stay exactly where Phase 0 put them
(`recognition/data/embeddings/`) - Postgres's `Embedding` model only stores
metadata (a file path, sample index), never redesigning Phase 0's storage.
Similarly, snapshots stay on disk under `recognition/data/snapshots/`; the
backend serves them from that shared path (`GET /snapshots/:filename`),
which is why backend and recognition are assumed to run on the same machine
(this project's whole deployment model - see README Section 1).

## 2. Project structure

```text
docker-compose.yml        # Postgres 16 + Redis 7, dev-only (README Section 17)
backend/                  # NestJS + TypeScript + Prisma
├── prisma/schema.prisma  # Member, Embedding, AccessLog models + migrations
├── src/
│   ├── auth/             # JWT login, global guard, @Public() escape hatch
│   ├── members/          # Member CRUD
│   ├── access-logs/      # Access log persistence + filtered/paginated query API
│   ├── access-events/    # Orchestrates a recognition event (Section 7)
│   ├── gate/              # GateTrigger interface + SimulatedGateTrigger
│   ├── redis/             # Subscribes to gate:recognition-events
│   ├── websocket/          # Socket.IO gateway (recognition/gate/unknown/system events)
│   ├── health/             # GET /health (Postgres/Redis/recognition-service status)
│   ├── snapshots/           # Serves recognition/data/snapshots/* (auth-protected)
│   └── common/prisma/       # Shared PrismaService
└── test files live next to the module they test (*.spec.ts)
frontend/                 # Next.js (App Router) + TypeScript + Tailwind
├── src/app/
│   ├── login/            # Login form
│   └── dashboard/         # Protected layout + Live Status / Access Log / Members pages
└── src/lib/               # api.ts (REST client), auth.tsx (JWT context),
                            # use-live-events.ts (WebSocket hook), types.ts
```

## 3. Environment variables

See `backend/.env.example` and `frontend/.env.example` (copy to `.env` /
`.env.local`). Never commit the real `.env` files - both are gitignored.

**backend/.env**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `REDIS_RECOGNITION_CHANNEL` | Pub/sub channel name (must match Python's) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` | Single-admin login (Section 14) - generate a hash with `node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"` |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Signing secret and token lifetime |
| `PYTHON_SERVICE_STALE_AFTER_SECONDS` | How old a Redis event can be before the recognition service is reported "down" in `/health` |
| `RECOGNITION_SNAPSHOTS_DIR` | Filesystem path to `recognition/data/snapshots/` |
| `PORT` / `CORS_ORIGIN` | HTTP port and the dashboard origin allowed to call it |

**frontend/.env.local**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend REST base URL (baked into the client bundle) |
| `NEXT_PUBLIC_WS_URL` | Backend WebSocket URL |

**recognition/.env** gained two new variables in Phase 1 (see
[docs/phase0.md](phase0.md)'s `.env.example`): `REDIS_URL` and
`REDIS_RECOGNITION_CHANNEL`, which must match the backend's values.

> **Port note:** `docker-compose.yml` maps Postgres to host port **5433**
> and Redis to host port **6380** - not the defaults (5432/6379) - because
> dev machines commonly already run something on those default ports. If
> you hit connection errors, check nothing else is bound to 5433/6380
> first, and check that `CORS_ORIGIN` matches whatever port the frontend
> dev server actually printed (Next.js picks a different port automatically
> if its default is busy).

## 4. Database setup

```powershell
docker compose up -d          # starts Postgres + Redis
cd backend
copy .env.example .env         # then fill in JWT_SECRET etc.
npm install
npx prisma migrate dev         # applies all migrations, generates the client
```

Schema (see `backend/prisma/schema.prisma` for the authoritative version):

- **members** - `id, name, profile_photo, is_active, created_at, updated_at`
- **embeddings** - `id, member_id, file_path, sample_index, metadata, created_at` (metadata/pointer only - see Section 1 above)
- **access_logs** - `id, timestamp, member_id (nullable), matched_name (nullable), confidence (nullable), snapshot_path (nullable), action, event_type, created_at`, indexed on `timestamp` and `member_id`
  - `action`: `AUTO_OPENED | MANUAL_OPENED | DENIED | NONE`
  - `event_type`: `FACE_RECOGNIZED | FACE_UNKNOWN | MANUAL`
  - `confidence` is nullable because a `MANUAL` dashboard trigger has no recognition confidence to report.

## 5. Redis setup

Already running via `docker compose up -d` (port 6380 on this machine's
compose file). No further setup - the backend's `RedisModule` connects on
boot and logs `Subscribed to Redis channel "gate:recognition-events"`.

## 6. How to run each service

```powershell
docker compose up -d                              # Postgres + Redis

cd recognition
.venv\Scripts\Activate.ps1
python scripts\run_webcam.py                       # Phase 0 recognition service

cd backend
npm run start:dev                                  # NestJS, http://localhost:3001

cd frontend
npm run dev                                        # Next.js, http://localhost:3000 (or whatever port it prints)
```

Log in at `http://localhost:3000` with the `ADMIN_USERNAME` /
`ADMIN_PASSWORD_HASH` you configured (`.env.example` ships a dev default of
`admin` / `changeme123` - change this before using this anywhere but a
local dev machine).

## 7. API endpoints

All endpoints require `Authorization: Bearer <token>` **except**
`POST /auth/login` and `GET /health` (see Section 20 Rule 5 - a health
probe revealing only up/down status is a standard unauthenticated
endpoint, not "disabling auth for convenience").

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{ username, password }` -> `{ accessToken }` |
| GET | `/members` | List all members |
| POST | `/members` | `{ name, profilePhoto? }` |
| GET | `/members/:id` | |
| PATCH | `/members/:id` | Update name/profilePhoto |
| PATCH | `/members/:id/status` | `{ isActive }` - enable/disable |
| DELETE | `/members/:id` | 204 No Content |
| GET | `/access-logs` | Query: `dateFrom, dateTo, memberId, eventType, page, pageSize` (max 100) |
| GET | `/access-logs/:id` | |
| POST | `/gate/trigger` | Manual unlock - simulated, logs `MANUAL_OPENED` |
| GET | `/health` | Public. Postgres/Redis/recognition-service status |
| GET | `/snapshots/:filename` | Streams a JPEG from `recognition/data/snapshots/` |

## 8. WebSocket events (Socket.IO)

Connect with `io(WS_URL, { auth: { token } })` - the handshake is rejected
(disconnected) without a valid JWT, since this transport isn't covered by
the REST guard.

| Event | Payload |
|---|---|
| `recognition.detected` | `{ memberId, name, confidence, timestamp, action }` (`action` includes `DENIED` for a recognized-but-inactive/unknown-member case) |
| `unknown-face.detected` | `{ confidence, timestamp, snapshotPath }` |
| `gate.status` | `{ status: 'JUST_OPENED', trigger: 'AUTO' \| 'MANUAL', timestamp }` |
| `system.status` | Reserved for future health push (currently `/health` is polled, not pushed - see Section 15 below) |

## 9. Redis event contract

Channel: `gate:recognition-events` (configurable via
`REDIS_RECOGNITION_CHANNEL`, must match on both the Python and NestJS side).

```json
{
  "eventType": "FACE_RECOGNIZED",
  "name": "Ali",
  "confidence": 0.91,
  "snapshotPath": "20260101T120000000000Z_Ali.jpg",
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

```json
{
  "eventType": "FACE_UNKNOWN",
  "name": null,
  "confidence": 0.32,
  "snapshotPath": "20260101T120005000000Z_Unknown.jpg",
  "timestamp": "2026-01-01T12:00:05.000Z"
}
```

**There is no `memberId` field here on purpose.** Phase 0 only ever knows
the enrollment folder name (e.g. `"Ali"`), never a Postgres UUID -
`AccessEventsService` resolves `name -> Member` server-side
(`MembersService.findByName`). This is also why a member's dashboard name
**must exactly match** its `recognition/data/embeddings/<name>/` folder
name - see Section 12 note below.

De-duplication of rapid repeat events for the same person happens upstream,
in the Python service's own gate cooldown
(`recognition/app/gate_trigger.py`), before anything is ever published.
`AccessEventsService` processes every event it receives independently
rather than keeping a second, potentially out-of-sync cooldown window on
the backend.

## 10. Recognition -> action mapping (Section 7)

| Recognized? | Member found & active? | `access_logs.action` | Gate fires? |
|---|---|---|---|
| Yes | Yes | `AUTO_OPENED` | Yes |
| Yes | No (missing or disabled) | `DENIED` | **No** |
| No (unknown) | n/a | `DENIED` | **No** |
| Manual (dashboard button) | n/a | `MANUAL_OPENED` | Yes |

The Python service's threshold decision is never re-evaluated on the
backend - NestJS trusts `eventType` as given and only adds the
exists/active check.

## 11. Family Members / enrollment integration (Section 12)

Adding a member on the dashboard creates the Postgres row and displays the
exact CLI command to run next:

```powershell
python scripts\enroll.py --name <Name>
```

This is a deliberate design choice, not a missing feature: Phase 0's
enrollment already works over the webcam, and re-implementing face capture
inside a browser (`getUserMedia` + streaming frames back to Python) would
be a second, parallel enrollment implementation - exactly what README
Section 12 says not to build. The dashboard **orchestrates** the existing
mechanism (creates the record, tells you the command) rather than
replacing it.

## 12. Health checks (Section 15)

`GET /health` returns:

```json
{
  "status": "ok",
  "checks": {
    "postgres": { "status": "up" },
    "redis": { "status": "up" },
    "recognitionService": { "status": "up", "lastEventSecondsAgo": 3 }
  },
  "timestamp": "..."
}
```

There is no HTTP server on the Python side to ping directly - it's a
foreground webcam script (`scripts/run_webcam.py`), not a service. Its
liveness is inferred from how recently a Redis event arrived:
`unknown` (no event since backend startup) is intentionally distinct from
`down` (an event arrived once, but not within
`PYTHON_SERVICE_STALE_AFTER_SECONDS`), and neither counts against the
overall `status`, only `postgres`/`redis` do. The dashboard polls this
endpoint every 10s (not pushed over the WebSocket in this phase).

## 13. Testing

**Backend** (`cd backend`):

```powershell
npm test          # unit tests, no Docker/network required - Prisma/Redis/HTTP are all mocked
npm run lint
npm run build
```

50+ unit tests cover: member CRUD, access-log filtering/pagination,
recognized/unknown/inactive-member/invalid-event handling, the gate
trigger's manual-vs-automatic paths, the Redis subscriber's message
parsing, the WebSocket gateway's emit contract and connection auth, the
JWT login/guard, and health-check status derivation.

**Integration (against real Postgres/Redis/HTTP)** was run manually during
development rather than checked in as an automated suite requiring live
infrastructure, mirroring recognition/'s own "unit tests need no camera"
design goal. What was verified, with real `docker-compose` Postgres/Redis
and a real running server:

- Login success/failure, and that every other endpoint genuinely 401s
  without a token and 200s with one.
- Real member create/list/disable/delete against Postgres.
- Manual gate trigger end-to-end (log row created, WS `gate.status`
  emitted).
- A real Redis-published `FACE_RECOGNIZED` event for an active member ->
  `AUTO_OPENED` log + simulated gate fire.
- The same event for a since-disabled member -> `DENIED`, gate does **not**
  fire (confirmed via server logs, not just the API response).
- A real `FACE_UNKNOWN` event -> `DENIED`, gate does not fire.
- WebSocket handshake genuinely rejects a connection with no/invalid token
  and accepts one with a valid token (verified via `socket.connected` after
  a delay, not just the first `connect` event - the naive test races the
  server's `handleConnection` and misreports success).
- A real environment bug this surfaced and fixed: a pre-existing `PORT=0`
  shell variable shadowed `.env`'s `PORT=3001` (`??` doesn't fall back on a
  defined-but-unhelpful value), causing the server to bind a random
  ephemeral port. Fixed by validating the parsed port instead of trusting
  `??`.

**Frontend**: driven in a real headless-Chromium browser (Playwright)
against the real backend/Postgres/Redis - not just `next build`. Verified:
login -> dashboard redirect, all three dashboard pages load with zero
console errors, adding a member and seeing it listed, the Manual Unlock
button producing a real access-log row, and - most importantly - the Live
Status page updating **live over the WebSocket, with no page reload**, for
both a recognized-member event and an unknown-face event. This pass also
caught a real UI bug (initially, an unrelated unknown-face event made
"Last recognized" revert to "None yet") which was fixed and reverified the
same way.

**Not verified in this environment (no physical webcam access on this
machine):** the actual `recognition/scripts/run_webcam.py` script
publishing a real event from a live camera frame. Everything downstream of
"a JSON event arrives on `gate:recognition-events`" was verified with real
infrastructure; only the camera-to-Redis leg (already covered by Phase 0's
own verification of detection/recognition accuracy) was substituted with a
directly-published, realistically-shaped event for this phase's testing.

## 14. Phase 1 acceptance checklist

- [x] NestJS backend implemented
- [x] PostgreSQL schema implemented, migrations apply cleanly
- [x] Member CRUD works (verified against real Postgres)
- [x] Access logs work (create, filter, paginate - verified against real Postgres)
- [x] Redis Pub/Sub works (verified: Python-shaped event -> backend receipt)
- [x] Python -> Redis -> NestJS flow works (real Redis, real backend)
- [x] WebSocket gateway works (real Socket.IO client, real auth handshake, real event delivery)
- [x] Manual gate trigger works in simulation
- [x] Automatic recognized-face trigger works in simulation
- [x] Unknown faces never trigger the simulated gate (verified via server logs, not just API responses)
- [x] Disabled/unknown members never trigger the simulated gate either (a case the spec implies but doesn't call out by name)
- [x] Next.js dashboard works (real browser, real backend, screenshots taken)
- [x] Live Status Panel works, including live WebSocket updates with no reload
- [x] Access Log page works (filters, pagination, snapshot preview, live tail)
- [x] Family Members page works (add/enable/disable/delete, enrollment-CLI guidance)
- [x] Alerts panel works (unknown-face banner, system health indicators)
- [x] Basic authentication works (REST guard + WebSocket handshake, both verified to actually reject/accept)
- [x] Health status works (real Postgres/Redis checks + recency-based recognition-service inference)
- [x] Tests pass (54 backend unit tests, 0 lint/type errors on backend and frontend)
- [x] End-to-end webcam-substitute -> recognition -> Redis -> backend -> DB -> WebSocket -> dashboard flow passes
- [x] Documentation updated
- [x] No real hardware dependency introduced (`SimulatedGateTrigger` only)

## 15. What belongs to later phases (not implemented here)

- USB relay / ESP32 / real gate wiring, analog CCTV capture card, DVR/RTSP
  migration - **Phase 3**.
- UPS, systemd watchdog, outdoor hardware hardening - **Phase 4**.
- Shadow-mode field trial - **Phase 5**.
- Telegram/WhatsApp notifications, liveness detection, and the rest of the
  future-features list - **Phase 8 / README Section 8**.
- `system.status` WebSocket push (health is currently polled, not pushed -
  Section 12) and browser-based enrollment (Section 11) are both
  intentionally out of scope for the reasons given in those sections.
