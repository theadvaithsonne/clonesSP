# `app/api/openclaw/agents/[agentId]/activity/route.ts`

> Next.js route handler for `/api/openclaw/agents/[agentId]/activity` (GET).

**Kind:** Next.js route handler · **Lines:** 34 · **Route:** `/api/openclaw/agents/[agentId]/activity` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/openclaw/agents/[agentId]/activity`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }): Promise<NextResponse>` | 7 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/agents/[agentId]/activity` (route).
