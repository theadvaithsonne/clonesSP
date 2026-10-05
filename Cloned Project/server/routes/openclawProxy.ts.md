# `server/routes/openclawProxy.ts`

> Generic OpenClawApi pass-through.

**Kind:** Express router · **Lines:** 134 · **Mounted at:** `/openclaw-proxy` (browser: `/backend/openclaw-proxy`)

<!-- docgen:auto -->

## Purpose
Generic OpenClawApi pass-through.

Frontend calls `/openclaw-proxy/api/<whatever>` → this handler forwards
to `${OPENCLAW_API_URL}/api/<whatever>` with the shared service secret
and the authenticated user's identity headers attached.

Guardrails:
  - requireAuth: rejects anything without a valid Garage JWT
  - Path must start with `/api/` on the target side. Anything else 404s.
  - No body transformation — JSON, form data, binary all pass through
  - Response is streamed back as-is (Content-Type preserved) so SSE and
    file downloads work without buffering

For routes that need custom logic (agent-id resolution, session
storage side-effects, public-unauthenticated access) keep an explicit
route file alongside this catch-all. The explicit handler wins because […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| ALL | `(dynamic)` | `/backend/openclaw-proxy/(dynamic)` | `/.*/` | inline | 65 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth` (L63)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 133 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.OPENCLAW_SERVICE_SECRET`, `env.OPENCLAW_API_URL`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/config/env.ts` — `env`
- **Packages:**
  - `express` — `Router`, `Request`, `Response as ExpressResponse`
  - `stream` — `Readable`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/openclaw-proxy`.
