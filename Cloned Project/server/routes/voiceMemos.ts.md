# `server/routes/voiceMemos.ts`

> src/routes/voiceMemos.ts

**Kind:** Express router · **Lines:** 195 · **Mounted at:** `/voice-memos` (browser: `/backend/voice-memos`)

<!-- docgen:auto -->

## Purpose
src/routes/voiceMemos.ts

Proxies the webinar UI's voice-memo flow to NetworkChain's voice-agent
service (contacts-backend → /voice-agent/memos). Garage doesn't host the
transcription / OpenAI / Qdrant pipeline locally — we just forward
authenticated requests with a service token, scoping memos to the
caller's Garage user via a namespaced X-Service-User-Id.

User-id namespace: `garage:<userId>`. Keeps Garage-recorded memos
from ever colliding with NC-recorded memos that share the same Mongo
userId index in the voice-memo collection.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/voice-memos` | `requireAuth`, `upload.single("audio")` | inline | 76 |
| GET | `/` | `/backend/voice-memos` | `requireAuth` | inline | 122 |
| GET | `/:id` | `/backend/voice-memos/:id` | `requireAuth` | inline | 136 |
| PATCH | `/:id` | `/backend/voice-memos/:id` | `requireAuth` | inline | 149 |
| DELETE | `/:id` | `/backend/voice-memos/:id` | `requireAuth` | inline | 166 |
| POST | `/:id/reprocess` | `/backend/voice-memos/:id/reprocess` | `requireAuth` | inline | 179 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 194 |

## Interfaces

- **External HTTP calls:**
  - `POST backend.networkchains.com${MEMOS_PATH}` (L105)
  - `GET backend.networkchains.com${MEMOS_PATH}` (L124)
  - `GET backend.networkchains.com${MEMOS_PATH}/${encodeURIComponent(req.params.id)}` (L138)
  - `PATCH backend.networkchains.com${MEMOS_PATH}/${encodeURIComponent(req.params.id)}` (L151)
  - `DELETE backend.networkchains.com${MEMOS_PATH}/${encodeURIComponent(req.params.id)}` (L168)
  - `POST backend.networkchains.com${MEMOS_PATH}/${encodeURIComponent(
        req.params.id,
      )}/reprocess` (L181)
- **Environment variables (`process.env`):** `NC_BACKEND_URL`, `NC_VOICE_AGENT_SERVICE_TOKEN`
- **External hosts mentioned in the code:** `backend.networkchains.com`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `axios` — `AxiosError`
  - `multer`
  - `form-data`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/voice-memos`.
