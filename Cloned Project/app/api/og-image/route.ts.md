# `app/api/og-image/route.ts`

> Next.js route handler for `/api/og-image` (GET).

**Kind:** Next.js route handler · **Lines:** 110 · **Route:** `/api/og-image` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/og-image`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `runtime` | const | `= "edge"` — Edge Runtime — lightweight image proxy, no heavy dependencies. | 6 |
| `GET` | function | `async GET(request: NextRequest)` — Image proxy that serves images from external hosts on the application's own domain. | 35 |

## Interfaces

- **Timers / queues:** `setTimeout` at L49

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/og-image` (route).
