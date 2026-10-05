# `app/api/taskroom/ai-chat/route.ts`

> Next.js route handler for `/api/taskroom/ai-chat` (POST).

**Kind:** Next.js route handler · **Lines:** 76 · **Route:** `/api/taskroom/ai-chat` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `POST /api/taskroom/ai-chat`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `POST` | function | `async POST(req: NextRequest)` | 14 |

## Interfaces

- **External HTTP calls:**
  - `POST https://api.openai.com/v1/chat/completions` (L52)
- **Environment variables (`process.env`):** `OPENAI_API_KEY`
- **External hosts mentioned in the code:** `api.openai.com`

## Dependencies

- **Internal:**
  - `lib/taskroomServerAuth.ts` — `verifyTaskroomUser`
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/taskroom/ai-chat` (route).
