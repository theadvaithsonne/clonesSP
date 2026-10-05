# `app/api/openclaw/contexts/third-party/[contextId]/available-agents/route.ts`

> Next.js route handler for `/api/openclaw/contexts/third-party/[contextId]/available-agents` (GET).

**Kind:** Next.js route handler · **Lines:** 43 · **Route:** `/api/openclaw/contexts/third-party/[contextId]/available-agents` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/openclaw/contexts/third-party/[contextId]/available-agents`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GET` | function | `async GET(req: NextRequest, { params }: { params: Promise<{ contextId: string }> })` | 4 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${baseUrl}/openclaw-agent` (L19)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:**
  - `app/api/openclaw/proxy.ts` — `proxyAM`
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/openclaw/contexts/third-party/[contextId]/available-agents` (route).
