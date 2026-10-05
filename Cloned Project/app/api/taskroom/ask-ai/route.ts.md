# `app/api/taskroom/ask-ai/route.ts`

> Next.js route handler for `/api/taskroom/ask-ai` (POST).

**Kind:** Next.js route handler · **Lines:** 141 · **Route:** `/api/taskroom/ask-ai` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `POST /api/taskroom/ask-ai`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `POST` | function | `async POST(req: NextRequest)` | 62 |

## Interfaces

- **External HTTP calls:**
  - `POST https://api.openai.com/v1/chat/completions` (L112)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${TASKROOM_API_BASE}rooms/detail/${roomId}?page=1&size=30&cardSize=30` (L92)
- **Environment variables (`process.env`):** `OPENAI_API_KEY`
- **External hosts mentioned in the code:** `api.openai.com`

## Dependencies

- **Internal:**
  - `lib/taskroomServerAuth.ts` — `TASKROOM_API_BASE`, `getBearerToken`
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/taskroom/ask-ai` (route).
