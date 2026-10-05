# `server/routes/whatsappWebhook.ts`

> src/routes/whatsappWebhook.ts

**Kind:** Express router · **Lines:** 112 · **Mounted at:** `/webhooks/whatsapp` (browser: `/backend/webhooks/whatsapp`)

<!-- docgen:auto -->

## Purpose
src/routes/whatsappWebhook.ts

Meta WhatsApp Cloud API webhook. Two halves, per Meta's spec:

  GET  /webhooks/whatsapp   — subscription verification. Meta calls this
      once when you save the webhook in the App Dashboard:
        ?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=<N>
      We echo hub.challenge back (plain text, 200) IFF the verify_token
      matches ours. Anything else → 403.

  POST /webhooks/whatsapp   — event receiver (incoming messages + status
      updates). Meta signs the body with the App Secret; we verify the
      X-Hub-Signature-256 HMAC over the RAW bytes before trusting it, then
      ACK 200 fast (Meta retries on non-2xx / slow responses).

Mounted BEFORE express.json() with express.raw so req.body is the exact […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/webhooks/whatsapp` | — | inline | 32 |
| POST | `/` | `/backend/webhooks/whatsapp` | — | inline | 52 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 111 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.WHATSAPP_VERIFY_TOKEN`, `env.WHATSAPP_APP_SECRET`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `crypto`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/webhooks/whatsapp`.

## Notes

- `whatsappWebhook.ts`:95 — TODO: route to the messaging pipeline (persist + reply).
