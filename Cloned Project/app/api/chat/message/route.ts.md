# `app/api/chat/message/route.ts`

> Next.js route handler for `/api/chat/message` (POST).

**Kind:** Next.js route handler · **Lines:** 36 · **Route:** `/api/chat/message` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `POST /api/chat/message`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `POST` | function | `async POST(req: NextRequest): Promise<NextResponse>` | 5 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/internal/chat/message` (L16)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `GARAGE_INTERNAL_API_KEY`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/chat/message` (route).
