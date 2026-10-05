# `app/api/openclaw/agent/[agentId]/assignments/route.ts`

> Next.js route handler for `/api/openclaw/agent/[agentId]/assignments` (GET, PUT).

**Kind:** Next.js route handler · **Lines:** 53 · **Route:** `/api/openclaw/agent/[agentId]/assignments` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/openclaw/agent/[agentId]/assignments`
- `PUT /api/openclaw/agent/[agentId]/assignments`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(req: NextRequest, { params }: { params: Promise<{ agentId: string }> })` | 38 |
| `PUT` | function | `async PUT(req: NextRequest, { params }: { params: Promise<{ agentId: string }> })` | 46 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/openclaw-agent/${agentId}/assignments` (L13)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/agent/[agentId]/assignments` (route).
