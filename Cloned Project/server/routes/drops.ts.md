# `server/routes/drops.ts`

> src/routes/drops.ts Short-form video "Drops" API — Reels/Shorts-style content.

**Kind:** Express router · **Lines:** 790 · **Mounted at:** `/drops` (browser: `/backend/drops`)

<!-- docgen:auto -->

## Purpose
src/routes/drops.ts
Short-form video "Drops" API — Reels/Shorts-style content.
Cursor-based pagination, batch signed URLs, presigned uploads.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (11)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/public/:id` | `/backend/drops/public/:id` | — | inline | 111 |
| GET | `/link-preview` | `/backend/drops/link-preview` | `requireAuth` | inline | 166 |
| POST | `/presigned-upload` | `/backend/drops/presigned-upload` | `requireAuth` | inline | 302 |
| GET | `/signed-url` | `/backend/drops/signed-url` | `requireAuth` | inline | 347 |
| GET | `/` | `/backend/drops` | `requireAuth` | inline | 377 |
| POST | `/` | `/backend/drops` | `requireAuth` | inline | 487 |
| POST | `/:id/view` | `/backend/drops/:id/view` | `requireAuth` | inline | 588 |
| POST | `/:id/like` | `/backend/drops/:id/like` | `requireAuth` | inline | 618 |
| POST | `/:id/share` | `/backend/drops/:id/share` | `requireAuth` | inline | 667 |
| GET | `/:id` | `/backend/drops/:id` | `requireAuth` | inline | 691 |
| DELETE | `/:id` | `/backend/drops/:id` | `requireAuth` | inline | 744 |

### Model `Organization`

- **Collection:** `organizations` (default pluralised name)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 789 |

## Interfaces

- **External HTTP calls:**
  - `GET https://www.youtube.com/watch?v=${youtubeId}` (L202)
- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Drop` (server/models/drop.model.ts) — reads: `findById`, `find`, `exists`; **writes:** `create`, `updateOne`, `findOneAndUpdate`
- **External hosts mentioned in the code:** `www.youtube.com`, `img.youtube.com`, `vimeo.com`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/services/s3.ts` — `s3Service`
  - `server/models/drop.model.ts` — `Drop`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/drops`.
