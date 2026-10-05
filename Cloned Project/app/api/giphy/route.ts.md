# `app/api/giphy/route.ts`

> Server-side proxy for the Giphy v1 API.

**Kind:** Next.js route handler · **Lines:** 80 · **Route:** `/api/giphy` (route)

<!-- docgen:auto -->

## Purpose
Server-side proxy for the Giphy v1 API. We use this instead of calling
Giphy directly from the browser so the API key stays out of the JS bundle
and so server-only env vars (no NEXT_PUBLIC_ prefix) work without dev-server
restarts being load-bearing.

Client calls:
  GET /api/giphy?action=trending&type=gifs
  GET /api/giphy?action=trending&type=stickers
  GET /api/giphy?action=search&type=gifs&q=cat
  GET /api/giphy?action=search&type=stickers&q=happy

Limit / rating / offset can be passed through as query params.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/giphy`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(req: NextRequest)` | 21 |

## Interfaces

- **Environment variables (`process.env`):** `GIPHY_API_KEY`
- **External hosts mentioned in the code:** `api.giphy.com`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/giphy` (route).
