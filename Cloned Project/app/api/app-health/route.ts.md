# `app/api/app-health/route.ts`

> Next.js route handler for `/api/app-health` (GET).

**Kind:** Next.js route handler · **Lines:** 42 · **Route:** `/api/app-health` (route)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### HTTP handlers

- `GET /api/app-health`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LINK_CONTRACT_VERSION` | const | `= 1` — Link contract version. | 14 |
| `dynamic` | const | `= "force-dynamic"` | 18 |
| `revalidate` | const | `= 0` | 19 |
| `GET` | function | `async GET()` — Deployment liveness probe for white-label domains. | 29 |

## Interfaces

- **Environment variables (`process.env`):** `VERCEL_DEPLOYMENT_ID`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_ENV`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `NextResponse`

## Used by

Entry: reached by the Next.js router at `/api/app-health` (route).
