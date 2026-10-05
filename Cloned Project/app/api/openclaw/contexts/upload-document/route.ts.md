# `app/api/openclaw/contexts/upload-document/route.ts`

> Next.js route handler for `/api/openclaw/contexts/upload-document` (POST).

**Kind:** Next.js route handler · **Lines:** 68 · **Route:** `/api/openclaw/contexts/upload-document` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `POST /api/openclaw/contexts/upload-document`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `POST` | function | `async POST(req: NextRequest): Promise<NextResponse>` | 12 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/openclaw-proxy/api/contexts/upload-document${search}` (L26)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/contexts/upload-document` (route).
