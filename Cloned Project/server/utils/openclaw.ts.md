# `server/utils/openclaw.ts`

> Shared OpenClawApi client for roam-backend.

**Kind:** backend utility · **Lines:** 100

<!-- docgen:auto -->

## Purpose
Shared OpenClawApi client for roam-backend.

Every call carries:
  - Authorization: Bearer <OPENCLAW_SERVICE_SECRET>  (service identity)
  - x-user-id, x-org-id, x-user-role                 (end-user identity)

OpenClawApi's middleware rejects non-public calls without the bearer.
The trusted identity headers are only trusted *because* the bearer
validated — roam-backend is the only place that mints them, after
verifying the caller's JWT via requireAuth.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ProxyResult` | interface |  | 16 |
| `callOpenClaw` | function | `async callOpenClaw(path: string, method: string, opts: { user?: AuthUser; body?: unknown; query?: Record<str…): Promise<ProxyResult>` — JSON-in, JSON-out proxy call. | 47 |
| `streamOpenClaw` | function | `async streamOpenClaw(path: string, method: string, opts: { user?: AuthUser; body?: unknown; headers?: Record<s…): Promise<Response>` — Streaming proxy — returns the raw Response so the caller can pipe body chunks back to the browser (SSE, long chat streams, downloads). | 85 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.OPENCLAW_API_URL`, `env.OPENCLAW_SERVICE_SECRET`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `AuthUser`, `(types only)`
  - `server/config/env.ts` — `env`
- **Packages:** none

## Used by

- `server/routes/openclawActivity.ts`
- `server/routes/openclawAgent.ts`
- `server/routes/openclawContexts.ts`
- `server/routes/openclawCronTemplates.ts`
- `server/routes/openclawIntegrations.ts`
- `server/routes/openclawJobs.ts`
- `server/routes/openclawTasks.ts`
