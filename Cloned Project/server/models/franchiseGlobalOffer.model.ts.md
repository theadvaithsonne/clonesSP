# `server/models/franchiseGlobalOffer.model.ts`

> Mongoose model for a buyer-initiated offer to purchase an already-owned global-catalog franchise assignment (System A).

**Kind:** Mongoose model · **Lines:** 160

## Purpose
Lets someone bid on an `active` `FranchiseGlobalAssignment` they do not own. It is the System A counterpart of `FranchiseOffer` (System B) without programme/office context, because global assignments are platform-scoped. The current owner, not a platform admin, accepts the offer.

## How it works
Per the header comment, the flow is:
1. A buyer submits an offer above the owner's `priceUSD`; a row is created with `status: "pending"` and an `expiresAt`.
2. The owner accepts; a prorated invoice is minted for the buyer covering the remaining days of the current subscription cycle (`invoiceId` is stored on the offer and `pendingResaleOffer` is set on the assignment as a lock).
3. On payment, ownership transfers, the assignment's `expiresAt` is preserved, and 100% of the paid amount is credited to the seller's store wallet at `PLATFORM_ORG_ID`.

Fields:
- `assignmentId` (ref `FranchiseGlobalAssignment`, required, indexed).
- Territory snapshot: `geoLevel`, `geoEntityId`, `geoEntityName` - kept so the inbox and audit trail survive catalog renames or removal.
- Parties: `fromUserId`/`fromEmail` (buyer), `toUserId`/`toEmail` (owner). Emails are lowercased and trimmed.
- `currentPriceUSD` (owner price snapshot at submission) and `offerPriceUSD`.
- `message` - optional, max 280 chars.
- `status`: `pending` (default), `accepted`, `rejected`, `cancelled`, `auto_rejected`, `expired`; `respondedAt`; `expiresAt` (required, indexed).
- `invoiceId` and `resolutionTxRefs` (`resaleInvoiceId`, `renewalParentInvoiceId`, `sellerWalletTxId` -> `WalletTransaction`) for audit after settlement.

Indexes:
- Partial unique `{ assignmentId, fromUserId }` where `status: "pending"` - at most one pending offer per buyer per assignment, while several buyers can compete (first accept wins).
- `{ toUserId, status, createdAt: -1 }` and `{ fromUserId, status, createdAt: -1 }` - owner inbox and buyer outbox.
- `{ status, expiresAt }` - TTL sweep for expiring pending offers.
- `{ assignmentId, status, offerPriceUSD: -1 }` - best pending offer per assignment.

## Exports
- `FranchiseGlobalOffer` - model `"FranchiseGlobalOffer"`, collection `franchise_global_offers`.
- `IFranchiseGlobalOffer` - document interface.
- `FranchiseGlobalOfferStatus` - status union.
- `IFranchiseGlobalOfferResolutionRefs` - settlement reference shape.

## Interfaces
- **Database:** collection `franchise_global_offers` (read/write).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/franchiseGlobal.ts` (mounted at `/franchise-global`, browser `/backend/franchise-global`), `server/services/franchiseGlobalOffer.ts` (offer business logic, floor price `OFFER_FLOOR_USD`), `server/services/invoice.ts` (settling the resale invoice).

## Notes
- The `expired` status is set by a sweep, not by a Mongo TTL index: `expiresAt` is a plain indexed date, so rows are kept for history.
- The header says the owner-initiated global reassignment endpoints are currently 501-stubbed; this offer flow is the working resale path for System A.
