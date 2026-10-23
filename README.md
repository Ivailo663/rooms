# Rooms

Monorepo for the playground/room booking app.

- **`client/`** — Vue 3 + Vite + PrimeVue + Tailwind SPA (port **5173**)
- **`server/`** — Express + Socket.IO + Prisma + BullMQ API (port **3000**)
- **`packages/shared/`** — types shared between client and server
- npm workspaces, orchestrated with Turborepo

## Prerequisites

| Tool | Version |
| --- | --- |
| Node | 20.19+ or 22.12+ (currently on 24.x) |
| npm | 8+ |
| Docker | only needed for Redis + pgAdmin |

## What the app needs to run

1. **Postgres** — the real database is **hosted on Supabase**, not local. The connection string lives in `server/.env` as `DATABASE_URL` (direct connection, port 5432; a pooled 6543 URL is commented out next to it). The `db` service in `docker-compose.yml` is leftover local Postgres and is *not* what the server talks to.
2. **Redis** — required: BullMQ powers the timeslot scheduler/worker. Defaults to `localhost:6379` (`REDIS_HOST` / `REDIS_PORT` to override).
3. **Firebase** — auth. The client config is hardcoded in [client/src/firebase.ts](client/src/firebase.ts); the server needs `server/serviceAccountKey.json` (gitignored, already present locally).

### Env files (both gitignored — don't lose them)

- `.env` (root) — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `HOST_PORT` (used by docker-compose)
- `server/.env` — `DATABASE_URL`

## Run it locally (recommended)

```sh
# 1. install everything (npm workspaces — run from repo root)
npm install

# 2. generate the Prisma client
npm run prisma:generate --workspace=server

# 3. start Redis (only service actually needed from compose)
docker compose up -d redis

# 4a. start both apps at once
npx turbo dev

# 4b. ...or in two terminals
npm run dev --workspace=server   # http://localhost:3000
npm run dev --workspace=client   # http://localhost:5173
```

Open **http://localhost:5173**. The client calls the API at `http://localhost:3000` (hardcoded in [client/src/axios.ts](client/src/axios.ts)), and Socket.IO CORS on the server only allows `http://localhost:5173`, so keep those ports.

## Run it with Docker

```sh
docker compose up
```

Starts client (5173), server (3000), Redis (6379), local Postgres (`${HOST_PORT}`), and pgAdmin on **http://localhost:8080** (`admin@example.com` / `admin`). Note: the server container still points `DATABASE_URL` at Supabase, so the local Postgres container is effectively unused.

## Useful commands

```sh
# server
npm run dev --workspace=server              # nodemon + tsx
npm run prisma:generate --workspace=server  # regenerate client after schema edits
npm run prisma:pull --workspace=server      # pull schema from the live DB
npm run prisma:push --workspace=server      # push schema to the DB

# client
npm run dev --workspace=client
npm run build --workspace=client
npm run test:unit --workspace=client        # vitest
npm run test:e2e --workspace=client         # playwright (npx playwright install first)
npm run lint --workspace=client

# repo-wide
npm run lint
npm run format
npm run type-check
```

## Troubleshooting

- **`(EAUTHQUERY) authentication query failed: connection to database not available`** — the Supabase project is **paused or still restoring**, not a credentials problem. The `aws-0-*.pooler.supabase.com` host is shared infrastructure and always answers on 5432/6543, so a successful TCP connect proves nothing; the pooler returns this when it can't reach *your* project's Postgres to run its auth query. Free-tier projects auto-pause after ~7 days idle. Open the Supabase dashboard and restore the project, wait for it to report healthy, then **restart the dev server** — the boot-time `startScheduler` call fails when the DB is down and BullMQ job schedulers never get registered, so the process does not self-heal.
  Check uptime to confirm it just came back: `select pg_postmaster_start_time(), now() - pg_postmaster_start_time() as uptime;`
- **Server exits with "DATABASE_URL is missing"** — `server/.env` is gone; restore it (see Env files above).
- **"DATABASE_URL uses Prisma Accelerate"** — the URL must be `postgres://` / `postgresql://`, not `prisma://`.
- **Prisma type errors / `@prisma/client` not found** — run `npm run prisma:generate --workspace=server`.
- **BullMQ `ECONNREFUSED 127.0.0.1:6379`** — Redis isn't up: `docker compose up -d redis`.
- **Cannot find `./serviceAccountKey.json`** — download a fresh service account key from the Firebase console (project `playgrounds-c9391`) into `server/`.
- **401 "No token" on every request** — you're not signed in on the client; auth goes through Firebase at `/auth`.

## Where things live

| Path | What |
| --- | --- |
| [server/app.ts](server/app.ts) | API entry: route registration, Socket.IO, scheduler, worker |
| [server/routes/](server/routes/) | rooms, timeslots, users, accounts, tenants, membership |
| [server/prisma/schema.prisma](server/prisma/schema.prisma) | data model |
| [server/scheduler.ts](server/scheduler.ts), [server/redistribution.ts](server/redistribution.ts) | slot locking & player redistribution logic |
| [client/src/features/](client/src/features/) | feature modules (rooms, etc.) |
| [client/src/stores/](client/src/stores/) | Pinia stores (auth, role) |
