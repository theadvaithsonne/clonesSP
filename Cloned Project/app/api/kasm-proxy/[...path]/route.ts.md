# `app/api/kasm-proxy/[...path]/route.ts`

> Next.js route handler for `/api/kasm-proxy/[...path]` (GET, POST, PUT, DELETE, OPTIONS).

**Kind:** Next.js route handler · **Lines:** 316 · **Route:** `/api/kasm-proxy/[...path]` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/kasm-proxy/[...path]`
- `POST /api/kasm-proxy/[...path]`
- `PUT /api/kasm-proxy/[...path]`
- `DELETE /api/kasm-proxy/[...path]`
- `OPTIONS /api/kasm-proxy/[...path]`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(request: NextRequest, { params }: { params: { path: string[] } })` | 39 |
| `POST` | function | `async POST(request: NextRequest, { params }: { params: { path: string[] } })` | 132 |
| `PUT` | function | `async PUT(request: NextRequest, { params }: { params: { path: string[] } })` | 190 |
| `DELETE` | function | `async DELETE(request: NextRequest, { params }: { params: { path: string[] } })` | 248 |
| `OPTIONS` | function | `async OPTIONS()` | 306 |

## Interfaces

- **Environment variables (`process.env`):** `NODE_TLS_REJECT_UNAUTHORIZED`
- **External hosts mentioned in the code:** `deskstream.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`
  - `https`

## Used by

Entry: reached by the Next.js router at `/api/kasm-proxy/[...path]` (route).
