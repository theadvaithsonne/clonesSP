# `server/routes/garageAdminOrgCategories.ts`

> Express router with 4 endpoints, mounted at `/garage-admin/categories`.

**Kind:** Express router · **Lines:** 170 · **Mounted at:** `/garage-admin/categories` (browser: `/backend/garage-admin/categories`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/garage-admin/categories` | `requireGarageAdminAuth` | inline | 24 |
| POST | `/` | `/backend/garage-admin/categories` | `requireGarageAdminAuth` | inline | 50 |
| PATCH | `/:id` | `/backend/garage-admin/categories/:id` | `requireGarageAdminAuth` | inline | 87 |
| DELETE | `/:id` | `/backend/garage-admin/categories/:id` | `requireGarageAdminAuth` | inline | 130 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 169 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`
  - `server/services/orgCategory.ts` — `listCategoriesWithCounts`, `createOrgCategory`, `renameOrgCategory`, `mergeAndDeleteOrgCategory`
  - `server/utils/http.ts` — `ok`, `fail`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/categories`.
