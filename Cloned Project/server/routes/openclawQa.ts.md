# `server/routes/openclawQa.ts`

> Public Q&A pass-through — unauthenticated.

**Kind:** Express router · **Lines:** 125 · **Mounted at:** `/openclaw-qa` (browser: `/backend/openclaw-qa`)

<!-- docgen:auto -->

## Purpose
Public Q&A pass-through — unauthenticated.

Q&A pages are visitor-facing; there is no Garage JWT. The backend
enforces its own per-IP / per-agent rate limiting and visitor-safe
error messages. This route is a transport shim that:
  - does NOT require auth
  - attaches the shared service secret (harmless — OpenClawApi
    allowlists /api/public/qa paths, but we include it for consistency
    so the same firewall rules work everywhere)
  - forwards x-forwarded-for so the backend sees the real visitor IP
  - streams SSE bodies back untouched

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/:agentId/chat` | `/backend/openclaw-qa/:agentId/chat` | — | inline | 39 |
| GET | `/:agentId/info` | `/backend/openclaw-qa/:agentId/info` | — | inline | 93 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 124 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `POST ${upstreamBase()}/api/public/qa/${encodeURIComponent(agentId)}/chat` (L45)
  - `GET ${upstreamBase()}/api/public/qa/${encodeURIComponent(agentId)}/info` (L98)
- **Environment via `server/config/env.ts`:** `env.OPENCLAW_API_URL`, `env.OPENCLAW_SERVICE_SECRET`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `express` — `Router`, `Request`, `Response as ExpressResponse`
  - `stream` — `Readable`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/openclaw-qa`.
