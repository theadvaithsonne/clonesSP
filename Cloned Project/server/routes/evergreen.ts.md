# `server/routes/evergreen.ts`

> Evergreen (pre-recorded, scheduled) webinar configuration — founder-facing.

**Kind:** Express router · **Lines:** 328 · **Mounted at:** `/evergreen` (browser: `/backend/evergreen`)

<!-- docgen:auto -->

## Purpose
Evergreen (pre-recorded, scheduled) webinar configuration — founder-facing.

The HOST configures their own webinar here, so these routes use the same
guard as the rest of workshop editing: requireAuth + isUserFounder(orgId).
Playback itself is public and lives in publicWebinar.ts (/evergreen-state);
nothing here is reachable without founder rights.

Purely additive: none of this touches the live-webinar path. A workshop that
never calls these keeps `evergreen.enabled === false` and behaves exactly as
it does today. See docs/superpowers/specs/2026-09-07-evergreen-webinars-design.md

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/:workshopId/upload-url` | `/backend/evergreen/:workshopId/upload-url` | `requireAuth` | inline | 47 |
| POST | `/:workshopId/attach` | `/backend/evergreen/:workshopId/attach` | `requireAuth` | inline | 77 |
| PATCH | `/:workshopId` | `/backend/evergreen/:workshopId` | `requireAuth` | inline | 117 |
| GET | `/:workshopId` | `/backend/evergreen/:workshopId` | `requireAuth` | inline | 187 |
| GET | `/:workshopId/recordings` | `/backend/evergreen/:workshopId/recordings` | `requireAuth` | inline | 206 |
| POST | `/:workshopId/use-recording` | `/backend/evergreen/:workshopId/use-recording` | `requireAuth` | inline | 247 |
| GET | `/:workshopId/preview` | `/backend/evergreen/:workshopId/preview` | `requireAuth` | inline | 301 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 327 |

## Interfaces

- **Database (Mongoose models used):**
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`
  - `OrganizationFile` (server/models/cabinet.model.ts) — reads: `find`, `findOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/services/review.ts` — `isUserFounder`
  - `server/services/s3.ts` — `s3Service`
  - `server/models/cabinet.model.ts` — `OrganizationFile`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/evergreen`.
