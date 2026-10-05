# `app/api/image-proxy/route.ts`

> Next.js route handler for `/api/image-proxy` (GET).

**Kind:** Next.js route handler · **Lines:** 121 · **Route:** `/api/image-proxy` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/image-proxy`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `runtime` | const | `= "nodejs"` — Reads a remote image through our own origin. | 15 |
| `dynamic` | const | `= "force-dynamic"` — Proxied bytes are per-URL immutable in practice, but never worth caching wrong. | 17 |
| `GET` | function | `async GET(request: NextRequest)` | 53 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **External hosts mentioned in the code:** `garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/image-proxy` (route).
