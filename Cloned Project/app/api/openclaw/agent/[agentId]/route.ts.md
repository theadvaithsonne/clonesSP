# `app/api/openclaw/agent/[agentId]/route.ts`

> Next.js route handler for `/api/openclaw/agent/[agentId]` (PATCH, DELETE).

**Kind:** Next.js route handler · **Lines:** 45 · **Route:** `/api/openclaw/agent/[agentId]` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `PATCH /api/openclaw/agent/[agentId]`
- `DELETE /api/openclaw/agent/[agentId]`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PATCH` | function | `PATCH(req: NextRequest, { params }: { params: { agentId: string } })` | 41 |
| `DELETE` | function | `DELETE(req: NextRequest, { params }: { params: { agentId: string } })` | 44 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/agent/[agentId]` (route).
