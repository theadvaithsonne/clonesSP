# `app/api/openclaw/skills/gmail/status/route.ts`

> Next.js route handler for `/api/openclaw/skills/gmail/status` (GET).

**Kind:** Next.js route handler · **Lines:** 30 · **Route:** `/api/openclaw/skills/gmail/status` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/openclaw/skills/gmail/status`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(req: NextRequest)` | 6 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/openclaw-proxy/api/integrations/gmail/list?agent_id=${encodeURIComponent(agentId)}&max_results=1` (L14)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/skills/gmail/status` (route).
