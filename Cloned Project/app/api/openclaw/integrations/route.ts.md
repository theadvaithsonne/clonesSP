# `app/api/openclaw/integrations/route.ts`

> Next.js route handler for `/api/openclaw/integrations` (GET, POST).

**Kind:** Next.js route handler · **Lines:** 54 · **Route:** `/api/openclaw/integrations` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/openclaw/integrations`
- `POST /api/openclaw/integrations`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(req: NextRequest)` | 4 |
| `POST` | function | `async POST(req: NextRequest)` | 52 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:**
  - `app/api/openclaw/proxy.ts` — `proxyAM`
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/integrations` (route).
