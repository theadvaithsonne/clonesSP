# `server/routes/upload.ts`

> Express router with 1 endpoint, mounted at `/upload`.

**Kind:** Express router · **Lines:** 153 · **Mounted at:** `/upload` (browser: `/backend/upload`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/upload` | `requireAuth`, `upload.single("file")` | inline | 99 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 152 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/s3.ts` — `s3Service`
- **Packages:**
  - `express` — `Router`
  - `multer`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/upload`.
