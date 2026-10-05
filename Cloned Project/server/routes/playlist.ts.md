# `server/routes/playlist.ts`

> Express router with 10 endpoints, mounted at `/playlists`.

**Kind:** Express router · **Lines:** 419 · **Mounted at:** `/playlists` (browser: `/backend/playlists`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (10)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/available-videos` | `/backend/playlists/available-videos` | `requireAuth` | inline | 44 |
| POST | `/quick-add` | `/backend/playlists/quick-add` | `requireAuth` | inline | 70 |
| POST | `/` | `/backend/playlists` | `requireAuth` | inline | 117 |
| GET | `/` | `/backend/playlists` | `requireAuth` | inline | 157 |
| GET | `/:id` | `/backend/playlists/:id` | `requireAuth` | inline | 178 |
| PUT | `/:id` | `/backend/playlists/:id` | `requireAuth` | inline | 195 |
| DELETE | `/:id` | `/backend/playlists/:id` | `requireAuth` | inline | 245 |
| POST | `/:id/videos` | `/backend/playlists/:id/videos` | `requireAuth` | inline | 280 |
| DELETE | `/:id/videos/:videoId` | `/backend/playlists/:id/videos/:videoId` | `requireAuth` | inline | 331 |
| POST | `/:id/videos/reorder` | `/backend/playlists/:id/videos/reorder` | `requireAuth` | inline | 369 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 418 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
  - `server/services/playlist.ts` — `* as playlistService`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/playlists`.
