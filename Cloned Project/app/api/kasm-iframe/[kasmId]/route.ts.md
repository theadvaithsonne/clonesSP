# `app/api/kasm-iframe/[kasmId]/route.ts`

> Next.js route handler for `/api/kasm-iframe/[kasmId]` (GET).

**Kind:** Next.js route handler · **Lines:** 302 · **Route:** `/api/kasm-iframe/[kasmId]` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/kasm-iframe/[kasmId]`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(request: NextRequest, { params }: { params: { kasmId: string } })` | 39 |

## Interfaces

- **Environment variables (`process.env`):** `NODE_TLS_REJECT_UNAUTHORIZED`
- **External hosts mentioned in the code:** `deskstream.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`
  - `https`

## Used by

Entry: reached by the Next.js router at `/api/kasm-iframe/[kasmId]` (route).
