# `server/routes/openclawChat.ts`

> Chat entry point that supersedes the Next.js /api/openclaw/chat route.

**Kind:** Express router · **Lines:** 276 · **Mounted at:** `/openclaw-chat` (browser: `/backend/openclaw-chat`)

<!-- docgen:auto -->

## Purpose
Chat entry point that supersedes the Next.js /api/openclaw/chat route.

Two branches:
  - Personal agent (personalAgentId + userId present):
    POST /api/chat on OpenClawApi (SSE). We drain the SSE into a single
    `{ response, agentId }` JSON reply so the frontend doesn't have to
    change its consumption shape.
  - Shared agent (no personalAgentId):
    POST /v1/chat/completions on the OpenClaw gateway with agent_id
    resolved via env-var email map / default.

Both branches support JSON and multipart (file upload) bodies. File
uploads are only meaningful on the personal-agent branch.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/openclaw-chat` | `requireAuth`, `upload.array("files")` | inline | 145 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 275 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `POST ${env.OPENCLAW_GATEWAY_URL.replace(/\/+$/, "")}/v1/chat/completions` (L129)
- **Environment via `server/config/env.ts`:** `env.OPENCLAW_USER_AGENT_MAP`, `env.OPENCLAW_DEFAULT_AGENT_ID`, `env.OPENCLAW_SERVICE_SECRET`, `env.OPENCLAW_API_URL`, `env.OPENCLAW_GATEWAY_URL`, `env.OPENCLAW_GATEWAY_TOKEN`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/config/env.ts` — `env`
- **Packages:**
  - `express` — `Router`, `Request`, `Response as ExpressResponse`
  - `multer`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/openclaw-chat`.
