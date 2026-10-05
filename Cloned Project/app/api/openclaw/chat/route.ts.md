# `app/api/openclaw/chat/route.ts`

> Next.js route handler for `/api/openclaw/chat` (POST).

**Kind:** Next.js route handler · **Lines:** 48 · **Route:** `/api/openclaw/chat` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `POST /api/openclaw/chat`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `runtime` | const | `= "nodejs"` | 7 |
| `maxDuration` | const | `= 300` | 8 |
| `POST` | function | `async POST(req: NextRequest)` | 12 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/openclaw-chat` (L26)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/chat` (route).
