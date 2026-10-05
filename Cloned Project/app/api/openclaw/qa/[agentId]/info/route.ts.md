# `app/api/openclaw/qa/[agentId]/info/route.ts`

> Next.js route handler for `/api/openclaw/qa/[agentId]/info` (GET).

**Kind:** Next.js route handler · **Lines:** 39 · **Route:** `/api/openclaw/qa/[agentId]/info` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/openclaw/qa/[agentId]/info`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(req: NextRequest, { params }: { params: Promise<{ agentId: string }> })` | 7 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/openclaw-qa/${encodeURIComponent(agentId)}/info` (L16)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/qa/[agentId]/info` (route).
