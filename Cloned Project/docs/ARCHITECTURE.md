# Architecture

Garage 2.0 is a virtual-office and business platform: workspace video calls, chat, webinars, courses, commerce and checkout, wallets, affiliate programmes, an admin back-office, the BAT246 game, HR (Teamforce) and more.

This repository is the **combined** form of two projects that used to be separate:

| Was | Is now | Stack |
|---|---|---|
| `garage-web-app-nextjs-v1` (frontend) | repo root: `app/`, `components/`, `lib/`, `hooks/`, `store/`, … | Next.js 15.5 App Router, React 19, Tailwind 4, Turbopack |
| `garagenew-backend` (backend, `src/`) | `server/` | Express 5, Socket.IO 4, Mongoose 8, BullMQ, mediasoup |

Both now run inside **one Node process on one port**, started by [`server/main.ts`](../server/main.ts).

## Process model

```
 browser ──HTTP / WebSocket──▶  server/main.ts   (one Node process, one port: PORT, default 3000)
                                      │
            ┌─────────────────────────┼───────────────────────────────┐
            ▼                         ▼                               ▼
   /backend/*  (prefix stripped)   /socket.io/*                everything else
   any path on BACKEND_HOSTS       /openclaw-ws/:channel        Next.js
            │                         │                         pages, app/api route
            ▼                         ▼                         handlers, middleware.ts
   Express app (server/app.ts)   Socket.IO + OpenClaw WS proxy  (+ /_next/* HMR upgrades in dev)
            └──────────── Mongoose ▶ MongoDB · ioredis ▶ Redis · S3 · Razorpay/Stripe · LiveKit · …
```

## Request routing

Every request and every WebSocket upgrade is classified once by `classify()` in [`server/main.ts`](../server/main.ts); the verdict is cached on the request.

| Request | Goes to | Notes |
|---|---|---|
| Host is in `BACKEND_HOSTS` (any path) | Express, at the root | For the old API domain (mobile apps, webhooks, partner APIs): `GET https://<old-api-host>/floors/roster` still works. |
| Path is `/backend` or starts with `/backend/` (or `/backend?`) | Express, with `/backend` **removed** from `req.url` first | `BACKEND_BASE_PATH` changes the prefix; `""` disables it. Routers see the same paths they always did. |
| `/socket.io/*` | Socket.IO | Also reachable as `/backend/socket.io/*` (the prefix is stripped before Socket.IO looks). |
| `/openclaw-ws/<tasks\|crons\|activity>` upgrade | OpenClaw WebSocket proxy | Also under `/backend`. JWT in the query string. |
| `/_next/*` upgrade (dev) | Next.js (HMR socket) | Forwarded through a private event emitter — see below. |
| everything else | Next.js | Pages, `app/api/**` route handlers, `middleware.ts`. |

A browser call that was `GET ${NEXT_PUBLIC_API_URL}/floors/roster` against `http://localhost:4000` is now `GET http://localhost:3000/backend/floors/roster`: `NEXT_PUBLIC_API_URL` is `<app origin>/backend`, so all ~250 call sites in the frontend needed no edits.

### Why Next.js only receives `/_next/*` upgrades

Next.js attaches an `upgrade` listener to whatever HTTP server it is given. Given the real server, it would see the Socket.IO and OpenClaw upgrades too — and `/socket.io` matches the root-level `app/(affiliate)/[orgSlug]` page route, so Next would call `socket.end()` on a connection engine.io had already upgraded. `server/main.ts` therefore gives Next a private `EventEmitter` as its `httpServer` and emits only `/_next/*` upgrades on it. Upgrades nobody claims are closed by engine.io.

### Why `lib/socket.ts` connects to the origin

Socket.IO's client reads a URL **path as a namespace**, not a mount point (`io("http://host/backend")` fails with "Invalid namespace"). [`lib/socket.ts`](../lib/socket.ts) therefore reduces `NEXT_PUBLIC_API_URL` to its origin (`socketOrigin()`); the engine path stays `/socket.io`. A path-less URL (a standalone backend) is unchanged.

## Start-up

1. [`server/bootstrap-env.ts`](../server/bootstrap-env.ts) — sets `NODE_ENV` from the `--dev` flag (not from the shell or a `.env` file), then loads `.env.$NODE_ENV.local`, `.env.local`, `.env.$NODE_ENV`, `.env` with Next.js precedence via `@next/env`, never overriding variables the shell already set.
2. [`server/instrument.ts`](../server/instrument.ts) — Sentry, before `http`/`express`/`mongoose` load.
3. `next({ dev, dir, turbopack: dev, httpServer: <private emitter> })`, the Express app, and [`server/index.ts`](../server/index.ts) are imported.
4. `Promise.all([nextApp.prepare(), startBackend()])` — Next's compiler start-up and the backend boot run side by side.
5. `server.listen(PORT)`.

`startBackend()` (in [`server/index.ts`](../server/index.ts)) connects Mongo (which also creates the GARAGE HQ organisation and founder user if absent), runs the idempotent boot tasks (review-index sync, office plans and add-ons, Unilevel Plus plan, mediasoup worker, S3 / KYC-bucket CORS) and — unless `BACKGROUND_JOBS=off` — schedules the background jobs below. `server/index.ts` still runs standalone when executed directly (`npm run dev:backend`, `npm run start:backend`): it only boots under `require.main === module`.

### Background jobs

All of these are started by the backend boot and are skipped when `BACKGROUND_JOBS` is `off`/`false`/`0`/`no`:

- Sweepers: stale live meets, expired permission grants, cancelled channel memberships, channel payment defaults, webinar-recording orphan segments, Garage Jobs, Taskroom member reconcile, group and DM message retention.
- Money and rewards ticks: content-rewards payouts, NetworkChain rank bonus, whitelabel / founder-sub / cryptosub renewals and monthly volume bonuses, HiFi bond payouts, BAT246 monthly membership billing, genealogy snapshots, offer reminders.
- Workers and dispatchers: Note-Taker BullMQ workers (summarise, distribute), catalog outbox dispatcher, auction-settlement cron, hourly FX-rate refresh.

Some of these move real money. The NetworkChain rank bonus and the genealogy snapshot take a distributed lease (`server/services/cronLease.ts`); the others are safe under multiple instances only because each step claims its rows with a conditional update (or a unique dedupe key) before acting.

## Development vs production

| | `npm run dev` | `npm run build` then `npm start` |
|---|---|---|
| Entry | `tsx watch … server/main.ts --dev` | `node dist/main.js` |
| `NODE_ENV` | `development` | `production` |
| Next.js | dev server, Turbopack, HMR | serves the `.next` build |
| Backend | TypeScript through tsx | compiled by `tsc -p server/tsconfig.json` into `dist/` |
| Restart | a change under `server/` restarts the **whole** process, Next.js included | — |

`tsx watch` ignores `.next/**` and `*.md`. Frontend edits hot-reload through Next and do not restart anything. If backend restarts get in the way of UI work, run the two halves separately: `npm run dev:web` (Next only) and `npm run dev:backend` (Express + Socket.IO only, on `BACKEND_PORT`/`PORT`), and set `NEXT_PUBLIC_API_URL` to the backend's URL.

## Repository layout

| Path | What lives there |
|---|---|
| `app/` | Next.js routes. Route groups `(affiliate)`, `(auth)`, `(dashboard)`, `(landing)`, `(onboarding)` do not appear in URLs; `app/api/**/route.ts` are Next route handlers; `app/garage-admin/` is the staff back-office (served from its own subdomain via `middleware.ts`). |
| `components/` | React components (dashboard, landing, shared, `ui/` Radix/shadcn wrappers, feature folders such as `bat246/`, `webinar/`, `athena/`). |
| `lib/`, `utils/` | Frontend libraries: `lib/api.ts` (fetch wrapper, `API_URL`), `lib/socket.ts` (Socket.IO clients), `lib/auth`, feature API clients, PostHog and so on. |
| `hooks/`, `store/`, `context/`, `types/` | React hooks, zustand stores (the auth store persists to localStorage as `auth-storage`), contexts, shared types. |
| `public/` | Static assets served at `/` — indexed in [`ASSETS.md`](ASSETS.md). |
| `middleware.ts` | Host-based rewrites: the admin domain, the lost-money domains, and organisers' custom event domains (looked up through the backend and cached 5 minutes). |
| `instrumentation*.ts`, `sentry.*.config.ts` | Sentry for Next.js. `sentry.server.config.ts` defers to the backend's client when one is already initialised. |
| `server/main.ts`, `server/bootstrap-env.ts` | The combined entry point (new). |
| `server/index.ts`, `server/app.ts`, `server/instrument.ts` | Backend boot sequence, Express app with every router mounted, Sentry for the backend. |
| `server/routes/`, `controllers/`, `services/`, `models/`, `middleware/`, `utils/`, `config/`, `lib/`, `fx/`, `db/` | Backend layers. `routes/` holds ~225 Express routers, `models/` ~260 Mongoose models. |
| `server/realtime/` | `socket.ts` (Socket.IO: presence, DMs, groups, knock calls, webinars), mediasoup handlers, P2P calls, OpenClaw WS proxy, webinar presence/end. |
| `server/bat246/`, `server/note-taker/` | Self-contained modules: the BAT246 game (routes, models, services, docs, scripts) and the webinar transcription / summary pipeline. |
| `server/scripts/`, `scripts/` | One-off maintenance and migration scripts run by hand with `tsx`. **They connect to `MONGODB_URI`.** `scripts/*.ts` are the old backend's root `scripts/`; `scripts/*.mjs` are build helpers. |
| `docs/` | Reference docs carried over from both repos (`docs/frontend`, `docs/backend`), plus the documents written for this combined project. |
| `keys/` | Apple APNs auth key (`.p8`) used for iOS push. A private key — never document or log its contents. |

### Per-file documentation

Every source file has a sibling `<file>.md` (`server/routes/auth.ts` → `server/routes/auth.ts.md`) describing its purpose, behaviour, exports, interfaces and dependencies. Binary assets are indexed in [`ASSETS.md`](ASSETS.md) instead, because files in `public/` are served to the world. The `.md` files are kept out of the toolchain: Tailwind does not scan them (`@source not` in `app/globals.css`), `tsc` only compiles `.ts`, `tsx watch` excludes them, and the server build does not copy them to `dist/`.

## Realtime

- **Socket.IO** on `/socket.io`, created by `initSocket()` in [`server/realtime/socket.ts`](../server/realtime/socket.ts). JWT in `auth.token` (or an `Authorization` header). Used for presence, DMs, groups, knock calls and notifications, call signalling and the webinar channel. Clients: [`lib/socket.ts`](../lib/socket.ts) opens a workspace socket, a guest socket and a WebSocket-only webinar socket.
- **Redis** (`REDIS_URL`) backs presence fan-out and the BullMQ queues. Without it Socket.IO still runs, with Redis errors in the log.
- **mediasoup** (SFU for webinars) and the **LiveKit** server SDK handle media; the browser uses `livekit-client` and `mediasoup-client`.
- **OpenClaw**: `/openclaw-ws/:channel` is proxied with per-user RBAC filtering (`server/realtime/openclawWs.ts`); the frontend derives the URL from `NEXT_PUBLIC_API_URL`, so it also works under `/backend`.
- Some features talk to services outside this repo and keep their own hardcoded hosts: flowboard and taskroom use `https://uatapi.garage.app` (REST and Socket.IO namespaces), the networkchains office API uses `NEXT_PUBLIC_OFFICE_API_URL`.

## Things that behave differently in one process

- **One event loop.** Heavy backend work (ffmpeg, report generation, bulk sweeps) competes with Next.js rendering.
- **Restarts.** A backend change under `npm run dev` restarts Next.js too (see above). In production, deploying restarts both.
- **Scaling.** Web and API scale together. To scale them separately, use the split scripts (`start:web`, `start:backend`) — both are kept.
- **Hosting.** The combined server needs a long-lived Node host (VM, container, pm2). It cannot run on Vercel's serverless runtime. See [`MIGRATION.md`](MIGRATION.md#deployment).
- **Same-origin API.** Browser → `/backend` calls are same-origin, so CORS is moot for the app itself (the backend still enables `cors()` for external callers).
- **Self-calls.** Next middleware and a few route handlers fetch `NEXT_PUBLIC_API_URL`, which now points back at the same server. That works but costs an HTTP round trip through the public URL.
