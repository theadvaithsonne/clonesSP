# `app/api/revenue-network/affiliate/links/route.ts`

> Next.js route handler for `/api/revenue-network/affiliate/links` (GET, POST).

**Kind:** Next.js route handler · **Lines:** 95 · **Route:** `/api/revenue-network/affiliate/links` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/revenue-network/affiliate/links`
- `POST /api/revenue-network/affiliate/links`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(request: NextRequest)` | 5 |
| `POST` | function | `async POST(request: NextRequest)` | 48 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/links?orgId=${storeId}` (L23)
  - `POST /backend/affiliate/links` (L67)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/revenue-network/affiliate/links` (route).
