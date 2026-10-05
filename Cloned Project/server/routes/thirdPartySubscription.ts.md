# `server/routes/thirdPartySubscription.ts`

> Express router with 2 endpoints, mounted at `/api/third-party`.

**Kind:** Express router · **Lines:** 90 · **Mounted at:** `/api/third-party` (browser: `/backend/api/third-party`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/subscriptions` | `/backend/api/third-party/subscriptions` | — | inline | 39 |
| PATCH | `/subscriptions/:parentInvoiceId/term` | `/backend/api/third-party/subscriptions/:parentInvoiceId/term` | — | inline | 62 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth` (L18)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 89 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/thirdPartyTerms.ts` — `changeSubscriptionTerm`, `listSubscriptionsForUser`
  - `server/services/thirdPartyError.ts` — `ThirdPartyError`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/api/third-party`.
