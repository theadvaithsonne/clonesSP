# `server/routes/courseVideo.ts`

> src/routes/courseVideo.ts Handles presigned URL generation for direct browser-to-S3 video uploads and signed streaming URL generation for video playback.

**Kind:** Express router · **Lines:** 271 · **Mounted at:** `/courses/video` (browser: `/backend/courses/video`)

<!-- docgen:auto -->

## Purpose
src/routes/courseVideo.ts
Handles presigned URL generation for direct browser-to-S3 video uploads
and signed streaming URL generation for video playback.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/presigned-upload` | `/backend/courses/video/presigned-upload` | `requireAuth` | inline | 30 |
| POST | `/multipart/initiate` | `/backend/courses/video/multipart/initiate` | `requireAuth` | inline | 92 |
| POST | `/multipart/complete` | `/backend/courses/video/multipart/complete` | `requireAuth` | inline | 166 |
| POST | `/multipart/abort` | `/backend/courses/video/multipart/abort` | `requireAuth` | inline | 198 |
| GET | `/signed-url` | `/backend/courses/video/signed-url` | `requireAuth` | inline | 223 |
| DELETE | `/delete` | `/backend/courses/video/delete` | `requireAuth` | inline | 253 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 270 |

## Interfaces

- **Database (Mongoose models used):**
  - `Course` (server/models/course.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/s3.ts` — `s3Service`
  - `server/models/course.model.ts` — `Course`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/courses/video`.
