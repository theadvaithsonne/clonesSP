# `server/models/franchiseTerritoryAssignment.model.ts`

> Mongoose model for a territory that an office founder has listed or sold to a buyer inside their `FranchiseProgram` (System B).

**Kind:** Mongoose model · **Lines:** 287

## Purpose
This is the ownership ledger for founder-run franchise programmes. The geographic entity itself comes from the read-only global catalog (`franchise_countries`, `franchise_territorymasters`, `franchise_sub_territories`); this collection stores only a reference to it plus the denormalised data needed for buyer-address matching, along with the owner, price, subscription and any in-flight resale. Only `active` assignments earn commission. `franchiseGlobalAssignment.model.ts` is the platform-level (System A) twin.

## How it works
**Scope and identity.** Each row belongs to a programme (`programId`, ref `FranchiseProgram`) and office (`officeId`, ref `Organization`). The entity is `geoLevel` (`country | territory | subTerritory`) plus `geoEntityId` (the catalog's string `_id`), with `geoEntityName`, `geoCountry`, `geoParentTerritory` and `zipCodes` denormalised. A unique index `{ programId, geoLevel, geoEntityId }` allows one owner per entity per programme; cancelled rows keep the slot so a reassignment updates the existing document.

**Status (default `pending_payment`):**
- `listed` - founder created a listing, no buyer yet (owner fields unset).
- `pending_payment` - a buyer claimed; invoice minted.
- `active` - paid (the header cites $650/yr or a custom price of at least $650) and subscription window open.
- `paused_lapsed` - subscription lapsed; earning pauses, slot kept.
- `withdrawn` - founder pulled the listing before a claim.
- `cancelled` - admin or founder cancelled a claimed assignment.

**Money and parties.** `priceUSD` (required), `assignedByUserId` (required - the founder or admin who created the row), optional `ownerUserId`/`ownerEmail`. The schema comment notes downstream consumers (`assignmentPayload`, earnings, invoice fulfilment) null-guard the owner fields.

**Subscription** (`subscription`, default `{}`): `invoiceId`, `startedAt`, `expiresAt`, `lastPaymentInvoiceId`.

**Resale state:**
- `pendingReassignment` (default null) - owner-requested resale that the office founder must approve: `status` (`pending_approval | approved | rejected`), `resellerUserId`, `newOwnerUserId`, `newOwnerEmail`, `resalePriceUSD`, `invoiceId` (set at founder approval), `requestedAt`, `decidedAt`, `reassignmentId` (link to the durable `FranchiseReassignment` row). On payment ownership transfers and the reseller is credited the markup over the $650 floor.
- `pendingResaleOffer` (default null) - lock set when the owner accepts a buyer-initiated `FranchiseOffer`: `offerId`, `buyerUserId`, `buyerEmail`, `agreedPriceUSD`, `resaleInvoiceId`, `acceptedAt`. While present the owner cannot accept another offer (the comment points at `POST /offers/:id/accept`). Cleared on payment, cancel or expiry.
- `acquisitionType` (`original` default | `resale`) and `acquiredReassignmentId` record how the current owner got the territory.

**Indexes:** unique `{ programId, geoLevel, geoEntityId }`; `{ programId, status }` (find active assignments during buyer-location commission matching); `{ ownerUserId, status }`; single-field indexes on `programId`, `officeId`, `geoEntityId`, `ownerUserId`, `status`, `acquisitionType`.

## Exports
- `FranchiseTerritoryAssignment` - model `"FranchiseTerritoryAssignment"`, collection `franchise_territory_assignments`.
- `IFranchiseTerritoryAssignment` - document interface.
- `FranchiseAssignmentStatus` - status union.
- `FranchiseGeoLevel` - `"country" | "territory" | "subTerritory"`.
- `IFranchiseAssignmentSubscription` - subscription shape.
- `ReassignmentStatus` - `"pending_approval" | "approved" | "rejected"`.
- `IPendingReassignment`, `IPendingResaleOffer` - resale lock shapes.
- `AcquisitionType` - `"original" | "resale"`.

## Interfaces
- **Database:** collection `franchise_territory_assignments` (read/write). References `FranchiseProgram`, `Organization`, `User`, `Invoice`, `FranchiseReassignment`, `FranchiseOffer`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/franchiseApi.ts` (`/franchise-api`), `server/routes/franchiseProgram.ts` (`/franchise-program`), `server/services/franchiseChainPlan.ts`, `server/services/franchiseOffer.ts`, `server/services/franchiseProgramCommission.ts`, `server/services/franchiseSubscriptions.ts`, `server/services/invoice.ts` (fulfilment of `franchise_territory` invoices), `server/utils/entityAccess.ts`, `server/utils/officeCustomerAccess.ts`, and the manual script `scripts/test-franchise-e2e.ts`.

## Notes
- Unlike the global twin, there is no `pendingDirectedSale` or `listedPriceUSD` field here.
- Mutual exclusion between `pendingReassignment` and `pendingResaleOffer` is enforced in route code, not the schema.
- Production has `autoIndex` off (`server/db/mongo.ts`); index changes need `npm run indexes:sync`.
