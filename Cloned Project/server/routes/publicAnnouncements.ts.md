# `server/routes/publicAnnouncements.ts`

> Express router with 1 endpoint, mounted at `/public/announcements`.

**Kind:** Express router · **Lines:** 56 · **Mounted at:** `/public/announcements` (browser: `/backend/public/announcements`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/active` | `/backend/public/announcements/active` | — | inline | 24 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 55 |

## Interfaces

- **Database (Mongoose models used):**
  - `Announcement` (server/models/announcement.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/announcement.model.ts` — `Announcement`
  - `server/routes/garageAdminAnnouncements.ts` — `serializeAnnouncement`
  - `server/utils/http.ts` — `ok`, `fail`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/announcements`.
