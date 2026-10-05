# `server/routes/standaloneVideo.ts`

> src/routes/standaloneVideo.ts Handles CRUD for standalone videos (not tied to courses) and presigned URL generation for direct browser-to-S3 video uploads.

**Kind:** Express router · **Lines:** 599 · **Mounted at:** `/standalone-videos` (browser: `/backend/standalone-videos`)

<!-- docgen:auto -->

## Purpose
src/routes/standaloneVideo.ts
Handles CRUD for standalone videos (not tied to courses) and
presigned URL generation for direct browser-to-S3 video uploads.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (12)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/link-preview` | `/backend/standalone-videos/link-preview` | `requireAuth` | inline | 72 |
| POST | `/presigned-upload` | `/backend/standalone-videos/presigned-upload` | `requireAuth` | inline | 169 |
| POST | `/multipart/initiate` | `/backend/standalone-videos/multipart/initiate` | `requireAuth` | inline | 220 |
| POST | `/multipart/complete` | `/backend/standalone-videos/multipart/complete` | `requireAuth` | inline | 288 |
| POST | `/multipart/abort` | `/backend/standalone-videos/multipart/abort` | `requireAuth` | inline | 319 |
| GET | `/signed-url` | `/backend/standalone-videos/signed-url` | `requireAuth` | inline | 342 |
| DELETE | `/video/delete` | `/backend/standalone-videos/video/delete` | `requireAuth` | inline | 371 |
| POST | `/` | `/backend/standalone-videos` | `requireAuth` | inline | 402 |
| GET | `/` | `/backend/standalone-videos` | `requireAuth` | inline | 447 |
| GET | `/:id` | `/backend/standalone-videos/:id` | `requireAuth` | inline | 483 |
| PUT | `/:id` | `/backend/standalone-videos/:id` | `requireAuth` | inline | 510 |
| DELETE | `/:id` | `/backend/standalone-videos/:id` | `requireAuth` | inline | 560 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 598 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `StandaloneVideo` (server/models/standaloneVideo.model.ts) — reads: `findById`, `find`, `countDocuments`; **writes:** `create`, `findOneAndUpdate`, `findOneAndDelete`
- **External hosts mentioned in the code:** `www.youtube.com`, `img.youtube.com`, `vimeo.com`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/services/s3.ts` — `s3Service`
  - `server/models/standaloneVideo.model.ts` — `StandaloneVideo`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/standalone-videos`.
