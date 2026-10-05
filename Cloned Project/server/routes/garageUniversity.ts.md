# `server/routes/garageUniversity.ts`

> Express router with 4 endpoints, mounted at `/garage-university`.

**Kind:** Express router · **Lines:** 61 · **Mounted at:** `/garage-university`, `/garage-university` (browser: `/backend/garage-university`, `/backend/garage-university`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/onboarding` | `/backend/garage-university/onboarding` | `requireAuth` | `getMyOnboarding` | 30 |
| POST | `/onboarding` | `/backend/garage-university/onboarding` | `requireAuth` | `createMyOnboarding` | 31 |
| PATCH | `/onboarding` | `/backend/garage-university/onboarding` | `requireAuth` | `updateMyOnboarding` | 32 |
| ALL | `/onboarding` | `/backend/garage-university/onboarding` | — | inline | 33 |

The router is also mounted at `/garage-university`; every path above exists under each mount.

**Router-level middleware** (`router.use`, runs before route matching):
- `` (req: Request, res: Response) => { res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.… `` (L39)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `garageUniversityErrorHandler` | function | `garageUniversityErrorHandler(err: any, req: Request, res: Response, next: NextFunction)` — JSON errors for /garage-university. | 48 |
| `default (router)` | default |  | 60 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/controllers/garageUniversityOnboarding.controller.ts` — `createMyOnboarding`, `getMyOnboarding`, `updateMyOnboarding`
- **Packages:**
  - `express` — `NextFunction`, `Request`, `Response`, `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-university`, `/garage-university`.
