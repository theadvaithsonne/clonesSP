# `server/routes/itemReserves.ts`

> Express router with 8 endpoints, mounted at `/item-reserves`.

**Kind:** Express router · **Lines:** 299 · **Mounted at:** `/item-reserves` (browser: `/backend/item-reserves`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (8)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/item-reserves` | — | inline | 32 |
| GET | `/stats` | `/backend/item-reserves/stats` | — | inline | 70 |
| POST | `/:licenseId/assign` | `/backend/item-reserves/:licenseId/assign` | — | inline | 107 |
| GET | `/offers/incoming` | `/backend/item-reserves/offers/incoming` | — | inline | 193 |
| GET | `/offers/outgoing` | `/backend/item-reserves/offers/outgoing` | — | inline | 207 |
| POST | `/offers/:offerId/approve` | `/backend/item-reserves/offers/:offerId/approve` | — | inline | 228 |
| POST | `/offers/:offerId/reject` | `/backend/item-reserves/offers/:offerId/reject` | — | inline | 259 |
| POST | `/offers/:offerId/cancel` | `/backend/item-reserves/offers/:offerId/cancel` | — | inline | 279 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth` (L27)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 298 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/itemReserveLicense.ts` — `getItemReserves`, `getItemReserveStats`, `assignItemReserve`, `ItemReserveError`
  - `server/services/pendingReserveAssignment.ts` — `createPendingReserveAssignment`, `approvePendingReserveAssignment`, `rejectPendingReserveAssignment`, `cancelPendingReserveAssignment`, `listIncomingPendingReserves`, `listOutgoingPendingReserves`, `PendingReserveError`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/item-reserves`.
