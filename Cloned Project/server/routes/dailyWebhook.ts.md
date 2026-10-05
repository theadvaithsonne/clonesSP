# `server/routes/dailyWebhook.ts`

> Express router with 1 endpoint, mounted at `/webhooks/daily`.

**Kind:** Express router · **Lines:** 231 · **Mounted at:** `/webhooks/daily` (browser: `/backend/webhooks/daily`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/webhooks/daily` | — | inline | 37 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 230 |

## Interfaces

- **Database (Mongoose models used):**
  - `OrganizationCabinet` (server/models/cabinet.model.ts) — reads: `findOne`; **writes:** `create`
  - `OrganizationFile` (server/models/cabinet.model.ts) — **writes:** `create`
- **Environment variables (`process.env`):** `DAILY_WEBHOOK_SECRET`, `AWS_S3_BUCKET`, `AWS_S3_REGION`

## Dependencies

- **Internal:**
  - `server/services/daily.ts` — `getRecordingDownloadLink`, `getRecordingContext`
  - `server/services/s3.ts` — `s3Service`
  - `server/models/cabinet.model.ts` — `OrganizationCabinet`, `OrganizationFile`
  - `server/utils/videoCompression.ts` — `compressVideo`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `crypto`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/webhooks/daily`.
