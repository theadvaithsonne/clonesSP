# `app/api/openclaw/skills/garage-feed/route.ts`

> Next.js route handler for `/api/openclaw/skills/garage-feed` (GET, POST, DELETE).

**Kind:** Next.js route handler · **Lines:** 91 · **Route:** `/api/openclaw/skills/garage-feed` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/openclaw/skills/garage-feed`
- `POST /api/openclaw/skills/garage-feed`
- `DELETE /api/openclaw/skills/garage-feed`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(req: NextRequest)` | 13 |
| `POST` | function | `async POST(req: NextRequest)` | 30 |
| `DELETE` | function | `async DELETE(req: NextRequest)` | 68 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/openclaw-proxy/api/secrets/${encodeURIComponent(agentId)}/garage_feed` (L19)
  - `POST /backend/openclaw-proxy/api/secrets` (L46)
  - `DELETE /backend/openclaw-proxy/api/secrets/${encodeURIComponent(agentId)}/garage_feed` (L74)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/skills/garage-feed` (route).
