# `server/routes/coworkingSpace.ts`

> Express router with 8 endpoints, mounted at `/garage-admin/coworking-spaces`.

**Kind:** Express router · **Lines:** 50 · **Mounted at:** `/garage-admin/coworking-spaces` (browser: `/backend/garage-admin/coworking-spaces`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (8)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/public` | `/backend/garage-admin/coworking-spaces/public` | `requireAuth` | `getPublicCoworkingSpaces` | 21 |
| GET | `/public/:id` | `/backend/garage-admin/coworking-spaces/public/:id` | `requireAuth` | `getPublicCoworkingSpaceById` | 22 |
| GET | `/` | `/backend/garage-admin/coworking-spaces` | `requireGarageAdminAuth` | `getAllCoworkingSpaces` | 25 |
| GET | `/office-types` | `/backend/garage-admin/coworking-spaces/office-types` | `requireGarageAdminAuth` | `getUniqueOfficeTypes` | 26 |
| GET | `/:id` | `/backend/garage-admin/coworking-spaces/:id` | `requireGarageAdminAuth` | `getCoworkingSpaceById` | 27 |
| POST | `/` | `/backend/garage-admin/coworking-spaces` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `createCoworkingSpace` | 30 |
| PUT | `/:id` | `/backend/garage-admin/coworking-spaces/:id` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `updateCoworkingSpace` | 36 |
| DELETE | `/:id` | `/backend/garage-admin/coworking-spaces/:id` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | `deleteCoworkingSpace` | 42 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 49 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/controllers/coworkingSpace.controller.ts` — `getAllCoworkingSpaces`, `getCoworkingSpaceById`, `createCoworkingSpace`, `updateCoworkingSpace`, `deleteCoworkingSpace`, `getUniqueOfficeTypes`, `getPublicCoworkingSpaces`, `getPublicCoworkingSpaceById`
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireGarageSuperAdmin`
  - `server/middleware/auth.ts` — `requireAuth`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/coworking-spaces`.
