# `server/routes/franchiseGlobal.ts`

> Express router with 23 endpoints, mounted at `/franchise-global`.

**Kind:** Express router · **Lines:** 2244 · **Mounted at:** `/franchise-global` (browser: `/backend/franchise-global`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (23)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/assignments` | `/backend/franchise-global/assignments` | `requirePlatformFounder` | inline | 244 |
| POST | `/self-buy` | `/backend/franchise-global/self-buy` | — | inline | 418 |
| GET | `/assignments` | `/backend/franchise-global/assignments` | `requirePlatformFounder` | inline | 665 |
| GET | `/assignments/all` | `/backend/franchise-global/assignments/all` | — | inline | 688 |
| GET | `/assignments/:assignmentId` | `/backend/franchise-global/assignments/:assignmentId` | — | inline | 706 |
| DELETE | `/assignments/:assignmentId` | `/backend/franchise-global/assignments/:assignmentId` | `requirePlatformFounder` | inline | 731 |
| POST | `/assignments/:assignmentId/offers` | `/backend/franchise-global/assignments/:assignmentId/offers` | — | inline | 841 |
| GET | `/offers/outgoing` | `/backend/franchise-global/offers/outgoing` | — | inline | 865 |
| GET | `/offers/incoming` | `/backend/franchise-global/offers/incoming` | — | inline | 905 |
| POST | `/offers/:offerId/accept` | `/backend/franchise-global/offers/:offerId/accept` | — | inline | 949 |
| POST | `/offers/:offerId/reject` | `/backend/franchise-global/offers/:offerId/reject` | — | inline | 974 |
| POST | `/offers/:offerId/cancel` | `/backend/franchise-global/offers/:offerId/cancel` | — | inline | 991 |
| POST | `/listings` | `/backend/franchise-global/listings` | — | inline | 1028 |
| PATCH | `/listings/:assignmentId` | `/backend/franchise-global/listings/:assignmentId` | — | inline | 1273 |
| DELETE | `/listings/:assignmentId` | `/backend/franchise-global/listings/:assignmentId` | — | inline | 1330 |
| POST | `/listings/:assignmentId/claim` | `/backend/franchise-global/listings/:assignmentId/claim` | — | inline | 1391 |
| GET | `/my/assignments` | `/backend/franchise-global/my/assignments` | — | inline | 1636 |
| GET | `/assignments/:assignmentId/invoices` | `/backend/franchise-global/assignments/:assignmentId/invoices` | — | inline | 1793 |
| GET | `/assignments/:assignmentId/offers` | `/backend/franchise-global/assignments/:assignmentId/offers` | — | inline | 1890 |
| POST | `/assignments/:assignmentId/directed-sale` | `/backend/franchise-global/assignments/:assignmentId/directed-sale` | — | inline | 1975 |
| DELETE | `/assignments/:assignmentId/directed-sale` | `/backend/franchise-global/assignments/:assignmentId/directed-sale` | — | inline | 2160 |
| POST | `/assignments/:id/reassign-request` | `/backend/franchise-global/assignments/:id/reassign-request` | — | inline | 2232 |
| POST | `/reassignments/:id/approve` | `/backend/franchise-global/reassignments/:id/approve` | — | inline | 2237 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth` (L32)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 2243 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`
  - `FranchiseGlobalAssignment` (server/models/franchiseGlobalAssignment.model.ts) — reads: `findOne`, `findById`, `find`; **writes:** `findByIdAndUpdate`, `create`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/user.model.ts` — `User`
  - `server/models/franchiseCountry.model.ts` — `FranchiseCountry`
  - `server/models/franchiseTerritory.model.ts` — `FranchiseTerritory`
  - `server/models/franchiseSubTerritory.model.ts` — `FranchiseSubTerritory`
  - `server/models/franchiseGlobalAssignment.model.ts` — `FranchiseGlobalAssignment`, `FranchiseGlobalGeoLevel`
  - `server/models/franchiseProgram.model.ts` — `FRANCHISE_PRICE_USD`
  - `server/services/invoice.ts` — `createInvoice`
  - `server/services/commission.ts` — `PLATFORM_ORG_ID`, `PLATFORM_USER_EMAIL`
  - `server/utils/territoryResolver.ts` — `caseInsensitiveExact`
  - `server/services/franchiseGlobalOffer.ts` — `FranchiseGlobalOfferError`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/franchise-global`.

## Notes

- Large file (2244 lines) — read it by section; line numbers above point into it.
