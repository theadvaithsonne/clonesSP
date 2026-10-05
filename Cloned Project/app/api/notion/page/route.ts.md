# `app/api/notion/page/route.ts`

> Next.js route handler for `/api/notion/page` (GET).

**Kind:** Next.js route handler · **Lines:** 38 · **Route:** `/api/notion/page` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/notion/page`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `runtime` | const | `= "nodejs"` | 5 |
| `GET` | function | `async GET(req: NextRequest)` | 12 |

## Interfaces

- **Environment variables (`process.env`):** `NOTION_TOKEN`, `NOTION_API_KEY`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextRequest`, `NextResponse`
  - `notion-client` — `NotionAPI`
  - `notion-utils` — `parsePageId`

## Used by

Entry: reached by the Next.js router at `/api/notion/page` (route).
