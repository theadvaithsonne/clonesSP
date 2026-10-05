# `app/api/revenue-network/channels/route.ts`

> Next.js route handler for `/api/revenue-network/channels` (GET).

**Kind:** Next.js route handler · **Lines:** 47 · **Route:** `/api/revenue-network/channels` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/revenue-network/channels`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(request: NextRequest)` | 5 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/feed/channels?orgId=${storeId}` (L23)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/revenue-network/channels` (route).
