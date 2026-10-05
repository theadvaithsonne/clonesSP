# `server/routes/uploadsPublic.ts`

> Public (unauthenticated) upload endpoint for the onboarding flow.

**Kind:** Express router · **Lines:** 116 · **Mounted at:** `/uploads/public` (browser: `/backend/uploads/public`)

<!-- docgen:auto -->

## Purpose
Public (unauthenticated) upload endpoint for the onboarding flow.

The org-creation step needs to persist a logo BEFORE the user has an
org, a JWT, or any server-side identity. The main /upload route
requires requireAuth (it attributes the file to a user + org for
billing / audit), so it can't serve this case. UploadThing was doing
this in a stub'd-mock state — replaced by first-party S3 here so we
own the storage + drop a third-party service token.

Trade-offs baked into this route:
  - No auth → open surface. Mitigated by tight MIME allow-list
    (images only), 5 MB size cap, and a distinctive S3 prefix that
    we can prune with a nightly sweep once we add one.
  - Stored under `public-onboarding/YYYY-MM-DD/…` so orphans (users
    who abandon onboarding) are easy to identify and delete later
    without touching authenticated uploads. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/uploads/public` | `upload.single("file")` | inline | 75 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 115 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/s3.ts` — `s3Service`
- **Packages:**
  - `express` — `Router`
  - `multer`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/uploads/public`.
