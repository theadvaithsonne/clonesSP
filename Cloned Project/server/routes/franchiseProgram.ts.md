# `server/routes/franchiseProgram.ts`

> Express router with 32 endpoints, mounted at `/franchise-program`.

**Kind:** Express router · **Lines:** 2708 · **Mounted at:** `/franchise-program` (browser: `/backend/franchise-program`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (32)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/marketplace` | `/backend/franchise-program/marketplace` | — | `handleMarketplace` | 49 |
| GET | `/offices/:officeId/listings/on-sale` | `/backend/franchise-program/offices/:officeId/listings/on-sale` | — | `handleOfficeListingsOnSale` | 50 |
| GET | `/offices/:officeId/assignments/all` | `/backend/franchise-program/offices/:officeId/assignments/all` | — | `handleOfficeAssignmentsAll` | 51 |
| GET | `/owners` | `/backend/franchise-program/owners` | — | `handleOwners` | 52 |
| POST | `/offices/:officeId/enroll` | `/backend/franchise-program/offices/:officeId/enroll` | `requireOfficeFounder` | inline | 238 |
| GET | `/offices/:officeId` | `/backend/franchise-program/offices/:officeId` | `requireOfficeFounder` | inline | 334 |
| PATCH | `/offices/:officeId/commissions` | `/backend/franchise-program/offices/:officeId/commissions` | `requireOfficeFounder` | inline | 355 |
| GET | `/offices/:officeId/catalog` | `/backend/franchise-program/offices/:officeId/catalog` | `requireOfficeFounder` | inline | 408 |
| POST | `/offices/:officeId/assignments` | `/backend/franchise-program/offices/:officeId/assignments` | `requireOfficeFounder` | inline | 485 |
| GET | `/offices/:officeId/assignments` | `/backend/franchise-program/offices/:officeId/assignments` | `requireOfficeFounder` | inline | 646 |
| GET | `/offices/:officeId/earnings-breakdown` | `/backend/franchise-program/offices/:officeId/earnings-breakdown` | `requireOfficeFounder` | inline | 746 |
| DELETE | `/offices/:officeId/assignments/:assignmentId` | `/backend/franchise-program/offices/:officeId/assignments/:assignmentId` | `requireOfficeFounder` | inline | 969 |
| GET | `/offices/:officeId/available-entities` | `/backend/franchise-program/offices/:officeId/available-entities` | `requireOfficeFounder` | inline | 1024 |
| POST | `/offices/:officeId/listings` | `/backend/franchise-program/offices/:officeId/listings` | `requireOfficeFounder` | inline | 1144 |
| PATCH | `/listings/:assignmentId` | `/backend/franchise-program/listings/:assignmentId` | — | inline | 1320 |
| DELETE | `/listings/:assignmentId` | `/backend/franchise-program/listings/:assignmentId` | — | inline | 1390 |
| POST | `/listings/:assignmentId/claim` | `/backend/franchise-program/listings/:assignmentId/claim` | — | inline | 1458 |
| GET | `/offices/:officeId/summary` | `/backend/franchise-program/offices/:officeId/summary` | `requireOfficeFounder` | inline | 1797 |
| POST | `/assignments/:assignmentId/reassign-request` | `/backend/franchise-program/assignments/:assignmentId/reassign-request` | — | inline | 1866 |
| GET | `/offices/:officeId/reassignments` | `/backend/franchise-program/offices/:officeId/reassignments` | `requireOfficeFounder` | inline | 1963 |
| GET | `/offices/:officeId/reassignments/history` | `/backend/franchise-program/offices/:officeId/reassignments/history` | `requireOfficeFounder` | inline | 1999 |
| POST | `/offices/:officeId/reassignments/:assignmentId/approve` | `/backend/franchise-program/offices/:officeId/reassignments/:assignmentId/approve` | `requireOfficeFounder` | inline | 2065 |
| POST | `/offices/:officeId/reassignments/:assignmentId/reject` | `/backend/franchise-program/offices/:officeId/reassignments/:assignmentId/reject` | `requireOfficeFounder` | inline | 2171 |
| GET | `/my/reassignments` | `/backend/franchise-program/my/reassignments` | — | inline | 2227 |
| GET | `/my/assignments` | `/backend/franchise-program/my/assignments` | — | inline | 2274 |
| POST | `/assignments/:assignmentId/offers` | `/backend/franchise-program/assignments/:assignmentId/offers` | — | inline | 2354 |
| GET | `/offers/outgoing` | `/backend/franchise-program/offers/outgoing` | — | inline | 2378 |
| GET | `/offers/incoming` | `/backend/franchise-program/offers/incoming` | — | inline | 2420 |
| POST | `/offers/:offerId/accept` | `/backend/franchise-program/offers/:offerId/accept` | — | inline | 2470 |
| POST | `/offers/:offerId/reject` | `/backend/franchise-program/offers/:offerId/reject` | — | inline | 2492 |
| POST | `/offers/:offerId/cancel` | `/backend/franchise-program/offers/:offerId/cancel` | — | inline | 2506 |
| GET | `/my/earnings` | `/backend/franchise-program/my/earnings` | — | inline | 2520 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth` (L55)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 2707 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`, `find`
  - `FranchiseCountry` (server/models/franchiseCountry.model.ts) — reads: `findById`, `find`
  - `FranchiseTerritory` (server/models/franchiseTerritory.model.ts) — reads: `findById`, `find`
  - `FranchiseSubTerritory` (server/models/franchiseSubTerritory.model.ts) — reads: `findById`, `find`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`, `find`
  - `FranchiseProgram` (server/models/franchiseProgram.model.ts) — reads: `findOne`, `findById`, `find`; **writes:** `create`, `findOneAndUpdate`
  - `FranchiseTerritoryAssignment` (server/models/franchiseTerritoryAssignment.model.ts) — reads: `findOne`, `find`, `findById`; **writes:** `findByIdAndUpdate`, `create`, `findOneAndUpdate`
  - `TerritoryWalletTransaction` (server/models/territoryWalletTransaction.model.ts) — reads: `aggregate`, `find`
  - `FranchiseReassignment` (server/models/franchiseReassignment.model.ts) — reads: `find`; **writes:** `create`, `updateOne`
  - `FranchiseOffer` (server/models/franchiseOffer.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/franchiseProgram.model.ts` — `FranchiseProgram`, `FRANCHISE_PRICE_USD`
  - `server/models/franchiseTerritoryAssignment.model.ts` — `FranchiseTerritoryAssignment`, `FranchiseGeoLevel`
  - `server/models/franchiseReassignment.model.ts` — `FranchiseReassignment`
  - `server/models/franchiseOffer.model.ts` — `FranchiseOffer`
  - `server/services/franchiseOffer.ts` — `createFranchiseOffer`, `acceptFranchiseOffer`, `rejectFranchiseOffer`, `cancelFranchiseOffer`, `FranchiseOfferError`
  - `server/models/franchiseCountry.model.ts` — `FranchiseCountry`
  - `server/models/franchiseTerritory.model.ts` — `FranchiseTerritory`
  - `server/models/franchiseSubTerritory.model.ts` — `FranchiseSubTerritory`
  - `server/models/territoryWalletTransaction.model.ts` — `TerritoryWalletTransaction`
  - `server/services/invoice.ts` — `createInvoice`
  - `server/services/commission.ts` — `PLATFORM_ORG_ID`, `PLATFORM_USER_EMAIL`
  - `server/utils/territoryResolver.ts` — `caseInsensitiveExact`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/franchise-program`.

## Notes

- Large file (2708 lines) — read it by section; line numbers above point into it.
