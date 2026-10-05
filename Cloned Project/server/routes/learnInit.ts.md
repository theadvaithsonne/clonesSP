# `server/routes/learnInit.ts`

> src/routes/learnInit.ts Consolidated endpoint for the Learn/Courses page.

**Kind:** Express router · **Lines:** 381 · **Mounted at:** `/learn` (browser: `/backend/learn`)

<!-- docgen:auto -->

## Purpose
src/routes/learnInit.ts
Consolidated endpoint for the Learn/Courses page.
Returns all data needed for the initial page load in a single round trip,
eliminating multiple sequential API calls from the frontend.

This is an ADDITIVE route — no existing endpoints are modified.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/init` | `/backend/learn/init` | `requireAuth` | inline | 66 |
| GET | `/init/livestream` | `/backend/learn/init/livestream` | `requireAuth` | inline | 181 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 380 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `find`
  - `Course` (server/models/course.model.ts) — reads: `find`
  - `CourseEnrollment` (server/models/courseEnrollment.model.ts) — reads: `find`
  - `Workshop` (server/models/workshop.model.ts) — reads: `find`
  - `OrganizationFile` (server/models/cabinet.model.ts) — reads: `find`
  - `WorkshopRegistration` (server/models/workshopRegistration.model.ts) — reads: `aggregate`, `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/user.model.ts` — `User`
  - `server/models/course.model.ts` — `Course`
  - `server/models/courseEnrollment.model.ts` — `CourseEnrollment`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/workshopRegistration.model.ts` — `WorkshopRegistration`
  - `server/models/cabinet.model.ts` — `OrganizationFile`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/services/s3.ts` — `s3Service`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/learn`.
