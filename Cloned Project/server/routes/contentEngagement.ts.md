# `server/routes/contentEngagement.ts`

> src/routes/contentEngagement.ts Content engagement tracking API — session-summary upsert model.

**Kind:** Express router · **Lines:** 1145 · **Mounted at:** `/content-engagement` (browser: `/backend/content-engagement`)

<!-- docgen:auto -->

## Purpose
src/routes/contentEngagement.ts
Content engagement tracking API — session-summary upsert model.

POST /content-engagement/ingest   → Public (no auth) — upsert session summary
GET  /content-engagement/stats    → Auth (founder) — content-level analytics
GET  /content-engagement/affiliate-report → Auth — affiliate performance report

Design principles:
 1. Idempotent upsert on (sessionId, contentId) — no duplicate sessions
 2. Client sends accumulated metrics; server does findOneAndUpdate with $set/$max/$inc
 3. Affiliate ID → User lookup cached in-memory (LRU, 5-min TTL)
 4. Returns 202 Accepted immediately — fire-and-forget from client perspective

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/ingest` | `/backend/content-engagement/ingest` | — | inline | 229 |
| GET | `/stats/:contentType/:contentId` | `/backend/content-engagement/stats/:contentType/:contentId` | `requireAuth`, `requireFounder` | inline | 351 |
| GET | `/affiliate-report` | `/backend/content-engagement/affiliate-report` | `requireAuth` | inline | 542 |
| GET | `/overview` | `/backend/content-engagement/overview` | `requireAuth` | inline | 703 |
| GET | `/leaderboard/:contentType` | `/backend/content-engagement/leaderboard/:contentType` | `requireAuth` | inline | 887 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1144 |

## Interfaces

- **Database (Mongoose models used):**
  - `Post` (server/models/post.model.ts) — reads: `find`
  - `StandaloneVideo` (server/models/standaloneVideo.model.ts) — reads: `find`
  - `Drop` (server/models/drop.model.ts) — reads: `find`
  - `Testimonial` (server/models/testimonial.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `ContentEngagement` (server/models/contentEngagement.model.ts) — reads: `aggregate`; **writes:** `findOneAndUpdate`
  - `CONTENT_TYPES` (server/models/contentEngagement.model.ts) — referenced
- **Timers / queues:** `setInterval` at L214

## Dependencies

- **Internal:**
  - `server/models/contentEngagement.model.ts` — `ContentEngagement`, `CONTENT_TYPES`, `DEVICE_TYPES`
  - `server/models/user.model.ts` — `User`
  - `server/models/post.model.ts` — `Post`
  - `server/models/standaloneVideo.model.ts` — `StandaloneVideo`
  - `server/models/drop.model.ts` — `Drop`
  - `server/models/testimonial.model.ts` — `Testimonial`
  - `server/middleware/auth.ts` — `requireAuth`, `requireFounder`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/content-engagement`.
