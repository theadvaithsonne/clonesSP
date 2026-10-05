# `app/api/affiliate-analytics/indirect/route.ts`

> Next.js route handler for `/api/affiliate-analytics/indirect` (GET).

**Kind:** Next.js route handler · **Lines:** 45 · **Route:** `/api/affiliate-analytics/indirect` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/affiliate-analytics/indirect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(request: NextRequest)` | 6 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `` GET /backend/public/analytics/affiliate/indirect${qs ? `?${qs}` : ""} `` (L19)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `ANALYTICS_API_KEY`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/affiliate-analytics/indirect` (route).
