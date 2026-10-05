# `server/routes/garageAdminAnnouncements.ts`

> Express router with 5 endpoints, mounted at `/garage-admin/announcements`.

**Kind:** Express router · **Lines:** 272 · **Mounted at:** `/garage-admin/announcements` (browser: `/backend/garage-admin/announcements`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/garage-admin/announcements` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | inline | 131 |
| POST | `/` | `/backend/garage-admin/announcements` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | inline | 151 |
| PATCH | `/:id` | `/backend/garage-admin/announcements/:id` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | inline | 183 |
| POST | `/:id/reset-dismissals` | `/backend/garage-admin/announcements/:id/reset-dismissals` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | inline | 230 |
| DELETE | `/:id` | `/backend/garage-admin/announcements/:id` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | inline | 253 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `serializeAnnouncement` | function | `serializeAnnouncement(a: any)` | 99 |
| `default (router)` | default |  | 271 |

## Interfaces

- **Database (Mongoose models used):**
  - `Announcement` (server/models/announcement.model.ts) — reads: `find`; **writes:** `create`, `findByIdAndUpdate`, `findByIdAndDelete`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireGarageSuperAdmin`, `GarageAdminRequest`
  - `server/models/announcement.model.ts` — `Announcement`
  - `server/utils/http.ts` — `ok`, `fail`
- **Packages:**
  - `express` — `Router`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`
- `server/routes/publicAnnouncements.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/announcements`.
