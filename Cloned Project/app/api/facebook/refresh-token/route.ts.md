# `app/api/facebook/refresh-token/route.ts`

> Next.js route handler for `/api/facebook/refresh-token` (POST).

**Kind:** Next.js route handler · **Lines:** 72 · **Route:** `/api/facebook/refresh-token` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `POST /api/facebook/refresh-token`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `POST` | function | `async POST(request: NextRequest)` | 7 |

## Interfaces

- **External HTTP calls:**
  - `GET https://graph.facebook.com/debug_token?input_token=${currentToken}&access_token=${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}` (L20)
- **Environment variables (`process.env`):** `FACEBOOK_APP_SECRET`
- **External hosts mentioned in the code:** `graph.facebook.com`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/facebook/refresh-token` (route).
