# `app/api/openclaw/group-agent-reply/route.ts`

> Next.js route handler for `/api/openclaw/group-agent-reply` (POST).

**Kind:** Next.js route handler · **Lines:** 37 · **Route:** `/api/openclaw/group-agent-reply` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `POST /api/openclaw/group-agent-reply`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `POST` | function | `async POST(req: NextRequest): Promise<NextResponse>` | 5 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/groups/${groupId}/agent-reply` (L15)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/group-agent-reply` (route).
