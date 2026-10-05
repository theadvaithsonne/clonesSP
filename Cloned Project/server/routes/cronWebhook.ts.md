# `server/routes/cronWebhook.ts`

> Express router with 1 endpoint, mounted at `/api/webhooks`.

**Kind:** Express router · **Lines:** 205 · **Mounted at:** `/api/webhooks` (browser: `/backend/api/webhooks`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/cron-result` | `/backend/api/webhooks/cron-result` | — | inline | 96 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 204 |

## Interfaces

- **Environment variables (`process.env`):** `CRON_WEBHOOK_SECRET`, `GARAGE_CHAT_INTERNAL_URL`, `GARAGE_INTERNAL_API_KEY`

## Dependencies

- **Internal:** none
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `axios`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/api/webhooks`.
