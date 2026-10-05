# `app/api/revenue-network/affiliate/settings/route.ts`

> Next.js route handler for `/api/revenue-network/affiliate/settings` (GET, PUT).

**Kind:** Next.js route handler · **Lines:** 99 · **Route:** `/api/revenue-network/affiliate/settings` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/revenue-network/affiliate/settings`
- `PUT /api/revenue-network/affiliate/settings`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(request: NextRequest)` | 5 |
| `PUT` | function | `async PUT(request: NextRequest)` | 52 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/settings?orgId=${storeId}` (L23)
  - `PUT /backend/affiliate/settings` (L71)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/revenue-network/affiliate/settings` (route).
