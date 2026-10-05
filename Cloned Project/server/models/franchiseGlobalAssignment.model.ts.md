# `server/models/franchiseGlobalAssignment.model.ts`

> Mongoose model for ownership of a global-catalog franchise entity (country, territory or sub-territory) sold to a Garage user through the Garage invoice engine.

**Kind:** Mongoose model · **Lines:** 325

## Purpose
Garage runs two franchise systems. "System A" (GaragePayFran) sells entities from the platform-wide global catalog (`franchise_countries`, `franchise_territorymasters`, `franchise_sub_territories`, owned by the external roam-admin-prod app and never written by Garage). "System B" is a founder's own per-office programme (see `franchiseTerritoryAssignment.model.ts`). This model is System A's ownership ledger: one row per catalog entity recording who owns it, what they paid, its subscription window and any in-flight resale. Territory commission distribution reads this collection first and falls back to the catalog's `ownerEmail` only for legacy owners who pre-date Garage sales.

## How it works
**Identity.** A row points at a catalog entity by `geoLevel` (`"country" | "territory" | "subTerritory"`) plus `geoEntityId` (the catalog's string `_id`). Denormalised `geoEntityName`, `geoCountry`, `geoParentTerritory` and `zipCodes` let services display and match without reading the catalog. A unique index on `{ geoLevel, geoEntityId }` enforces one row per entity; cancelled rows keep their slot so a later resale mutates the existing document instead of inserting.

**Lifecycle (`status`, default `pending_payment`):**
- `listed` - offered for sale with no owner yet (`ownerUserId`/`ownerEmail` null), asking price in `listedPriceUSD`, lister cached in `listedByUserId`.
- `pending_payment` - a buyer has claimed; invoice minted, awaiting payment.
- `active` - the buyer's yearly invoice (the source comment says $650/yr) was paid. Fulfilment copies `listedPriceUSD` into `priceUSD` and unsets the listing price.
- `paused_lapsed` - subscription lapsed; earnings pause and, per the header comment, the slice cascades up via the chain-integrity planner rather than reverting to the catalog owner.
- `withdrawn`, `cancelled`.

**Pricing fields.** `priceUSD` (required) is what the current owner actually paid and is never overwritten by a re-listing. `listedPriceUSD` is the current asking price only while listed (set by the listing endpoint, updated by `PATCH /listings/:id`, read by the claim handler). `soldByUserId` records the seller.

**Subscription sub-document** (`subscription`, no `_id`): `invoiceId`, `startedAt`, `expiresAt`, `lastPaymentInvoiceId`. Defaults to `{}`.

**Resale state (three mutually independent locks, each default `null`):**
- `pendingReassignment` - owner-requested buyer-to-buyer resale awaiting platform-admin approval (`status: pending_approval | approved | rejected`, reseller, new owner, `resalePriceUSD`, invoice, timestamps, link to a `FranchiseReassignment` ledger row). The header notes the global reassignment endpoints are currently stubbed (see `franchiseGlobalOffer.model.ts`).
- `pendingResaleOffer` - set when the owner accepts a buyer-initiated `FranchiseGlobalOffer`; holds `offerId`, buyer, `agreedPriceUSD`, `resaleInvoiceId`, `acceptedAt`. Its presence blocks accepting other offers; cleared on payment, cancel or expiry.
- `pendingDirectedSale` - owner-initiated sale to a specific buyer email at `priceUSD` (set by `POST /assignments/:id/directed-sale`). On payment ownership transfers and the seller receives the excess over the $650 floor. Its presence blocks a second directed sale.

**Acquisition.** `acquisitionType` (`original` | `resale`, default `original`) and `acquiredReassignmentId` record how the current owner obtained the entity.

**Indexes:** unique `{ geoLevel, geoEntityId }`; `{ ownerUserId, status }` (a user's holdings); `{ status, "subscription.expiresAt" }` (lapse/renewal sweeps); single-field indexes on `geoEntityId`, `ownerUserId`, `listedByUserId`, `status`, `acquisitionType`.

## Exports
- `FranchiseGlobalAssignment` - the Mongoose model (`"FranchiseGlobalAssignment"`, collection `franchise_global_assignments`).
- `IFranchiseGlobalAssignment` - document interface.
- `FranchiseGlobalStatus` - status union.
- `FranchiseGlobalGeoLevel` - `"country" | "territory" | "subTerritory"`.
- `IFranchiseGlobalSubscription` - subscription sub-document shape.
- `FranchiseGlobalReassignmentStatus` - `"pending_approval" | "approved" | "rejected"`.
- `IPendingGlobalReassignment`, `IPendingGlobalResaleOffer`, `IPendingGlobalDirectedSale` - the three resale lock shapes.
- `FranchiseGlobalAcquisitionType` - `"original" | "resale"`.

## Interfaces
- **Database:** collection `franchise_global_assignments` (read/write). References `User`, `Invoice`, `FranchiseReassignment`, `FranchiseGlobalOffer`.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
`server/routes/franchiseApi.ts` (mounted at `/franchise-api`), `server/routes/franchiseGlobal.ts` (`/franchise-global`), `server/routes/franchiseGlobalPublic.ts` (`/franchise-global-public`), `server/services/franchiseGlobalOffer.ts`, `server/services/franchiseSubscriptions.ts`, `server/services/invoice.ts` (fulfilment of `franchise_global` invoices), `server/services/territoryCommission.ts`, `server/utils/entityAccess.ts`, `server/utils/officeCustomerAccess.ts`, and the manual scripts `server/scripts/audit-partial-fanout.ts`, `server/scripts/backfill-catalog-ownership.ts`, `server/scripts/smoke-test-franchise-global.ts`.

## Notes
- Production runs with Mongoose `autoIndex` off (see `server/db/mongo.ts`), so new indexes here must be created by `npm run indexes:sync` or a migration.
- `ownerUserId` is optional at the schema level; all consumers must null-guard it for `listed`/`withdrawn` rows.
- The three pending sub-documents are independent fields; nothing in the schema stops more than one being set at once - exclusivity is enforced in route/service code.
