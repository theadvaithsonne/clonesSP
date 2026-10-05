# `server/models/franchiseOffer.model.ts`

> Mongoose model for a buyer-initiated offer to purchase an already-owned territory in a founder's franchise programme (System B).

**Kind:** Mongoose model · **Lines:** 167

## Purpose
In System B a founder sells territories of their own `FranchiseProgram` to buyers (`FranchiseTerritoryAssignment`). This model lets a third party bid on an `active` territory. The territory owner, not the office founder, accepts. It coexists with the older owner-initiated, founder-approved resale flow recorded in `FranchiseReassignment`.

## How it works
Business rules from the header comment:
- The offer must be above the owner's current `priceUSD`.
- On accept a prorated invoice is minted for the buyer covering the remaining days of the current subscription cycle.
- On payment ownership transfers, `subscription.expiresAt` is preserved, and 100% of the paid amount goes to the seller's store wallet. The platform and the office founder earn nothing on the resale itself; they resume at the next full annual renewal.

Fields:
- `assignmentId` (ref `FranchiseTerritoryAssignment`, required, indexed), `programId` (ref `FranchiseProgram`), `officeId` (ref `Organization`).
- Territory snapshot: `geoLevel`, `geoEntityId`, `geoEntityName`.
- `fromUserId`/`fromEmail` (buyer) and `toUserId`/`toEmail` (owner).
- `currentPriceUSD` (owner price snapshot) and `offerPriceUSD`.
- `message` (max 280 chars).
- `status`: `pending` (default) | `accepted` | `rejected` | `cancelled` | `auto_rejected` | `expired`; `respondedAt`; `expiresAt` (required - pending offers auto-expire after N days).
- `invoiceId` (resale invoice, set on accept) and `resolutionTxRefs` (`resaleInvoiceId`, `renewalParentInvoiceId`, `sellerWalletTxId`).

Indexes:
- Partial unique `{ assignmentId, fromUserId }` for `status: "pending"` - one live offer per buyer per territory; the buyer may re-offer after cancel/reject/expiry, and several buyers can hold pending offers (first accept wins).
- `{ toUserId, status, createdAt: -1 }` and `{ fromUserId, status, createdAt: -1 }` - inbox/outbox.
- `{ status, expiresAt }` - expiry sweep.
- `{ assignmentId, status, offerPriceUSD: -1 }` - grouping offers on one territory for the owner's view.

## Exports
- `FranchiseOffer` - model `"FranchiseOffer"`, collection `franchise_offers`.
- `IFranchiseOffer` - document interface.
- `FranchiseOfferStatus` - status union.
- `IFranchiseOfferResolutionRefs` - settlement reference shape.

## Interfaces
- **Database:** collection `franchise_offers` (read/write).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/franchiseProgram.ts` (mounted at `/franchise-program`, browser `/backend/franchise-program`), `server/services/franchiseOffer.ts`, `server/services/invoice.ts`.

## Notes
- The lock preventing a second acceptance lives on the assignment (`pendingResaleOffer` in `franchiseTerritoryAssignment.model.ts`), not here.
- `franchiseGlobalOffer.model.ts` is a near-copy for System A; keep the two in step when changing statuses or indexes.
