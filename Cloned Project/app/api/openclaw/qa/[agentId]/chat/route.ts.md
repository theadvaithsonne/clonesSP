# `app/api/openclaw/qa/[agentId]/chat/route.ts`

> Next.js route handler for `/api/openclaw/qa/[agentId]/chat` (POST).

**Kind:** Next.js route handler · **Lines:** 59 · **Route:** `/api/openclaw/qa/[agentId]/chat` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `POST /api/openclaw/qa/[agentId]/chat`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `runtime` | const | `= "nodejs"` | 5 |
| `POST` | function | `async POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> })` | 9 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/openclaw-qa/${encodeURIComponent(agentId)}/chat` (L20)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/qa/[agentId]/chat` (route).
