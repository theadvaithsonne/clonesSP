# `server/models/territoryWalletTransaction.model.ts`

> Mongoose model for the audit ledger of every credit, debit and withdrawal on a `TerritoryWallet`, with per-entity and per-slice attribution.

**Kind:** Mongoose model · **Lines:** 140

## Purpose
`TerritoryWallet` holds a single pooled balance per franchise owner. This model records where each movement came from: which owned entity (country / territory / sub-territory) it is attributed to, which slice level the money originally belonged to, and which sale, payment, commission distribution and organisation produced it. It is the source of truth for franchise earnings reports.

## How it works
**Core ledger fields:** `territoryWalletId` (-> `TerritoryWallet`, required), `userId` (-> `User`, required), `type` (`"credit" | "debit" | "withdrawal"`, required), `amount` (required, `min: 0`; sub-cent values are allowed because slices are stored as exact percentages of the platform fee without rounding), `currency` (default `"USD"`), `description` (required, trimmed, max 500), `balanceBefore` / `balanceAfter` (required), `status` (`"completed" | "pending" | "failed" | "reversed"`, default `"completed"`).

**Programme source (L59-L84):** `source` is `"global"` (the original platform-fee split; default, so all legacy rows read as global) or `"founder_program"` (a founder-run per-office franchise programme carved from the seller office's gross). Founder-programme rows also carry `franchiseProgramId` (-> `FranchiseProgram`), `franchiseAssignmentId` (-> `FranchiseTerritoryAssignment`), `franchiseOfficeId` (-> `Organization`) and `buyerUserId` (founder programmes attribute by buyer location). The comment notes the `/franchise-api` reads filter to `"global"` so the external franchise admin's numbers are unaffected by founder programmes.

**Entity and slice attribution (L86-L111):**
- `entityType` (`country | territory | subTerritory`), `entityId` (string), `entityName`: the level the owner actually owns.
- `originalSliceLevel` (same enum) and `relatedSplitPercentage`: the slice this row paid.
- These four (except `entityName`) are **conditionally required**: required unless `type === "withdrawal"`. Withdrawals are aggregate pool movements that cannot map to a single entity.
- Cascading: when a slice is unresolved at a lower level it cascades upward. A territory owner who also receives an unowned sub-territory slice gets two rows, one with `originalSliceLevel: "territory"` and one with `"subTerritory"`, both with `entityType: "territory"`.

**Sale context:** `relatedCommissionDistributionId` (-> `CommissionDistribution`), `relatedPaymentId`, `relatedItemType`, `relatedItemId`, `relatedItemName`, `relatedSaleAmount`, `relatedPlatformFeeAmount`, `relatedPlatformFeePercentage`, `relatedOrgId` (-> `Organization`), and free-form `metadata`.

**Indexes:** single-field indexes on `territoryWalletId`, `userId`, `type`, `status`, `source`, `franchiseProgramId`, `entityType`, `entityId`, `relatedCommissionDistributionId`; compound `{userId, createdAt:-1}`, `{entityType, entityId, createdAt:-1}`, `{relatedOrgId, createdAt:-1}`. Timestamps are on.

## Exports
- `TerritoryWalletTransaction` - Mongoose model `"TerritoryWalletTransaction"` (default collection `territorywallettransactions`).

## Interfaces
- **Database:** `TerritoryWalletTransaction` (collection `territorywallettransactions`) - schema definition.

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`.

## Used by
`server/routes/franchise.ts` (`/franchise`), `server/routes/franchiseApi.ts` (`/franchise-api`), `server/routes/franchiseProgram.ts` (`/franchise-program`), `server/services/franchiseProgramCommission.ts` and `server/services/territoryCommission.ts` (write credit rows), `server/services/territoryWalletTransfer.ts` (writes a `withdrawal` row with no entity attribution when moving money to a `StoreWallet`, cross-linked to the `WalletTransaction` through `metadata`), and the hand-run audit scripts `server/scripts/audit-partial-fanout.ts` and `server/scripts/find-coupon-ecommerce-overcredits.ts`.

## Notes
- The conditional `required` validators use `this.type`, so they only run on document validation (`create`/`save`), not on `insertMany` with `ordered`/`lean` bypasses or raw updates.
- Any reporting that sums earnings should filter by `source` to avoid mixing global and founder-programme money.
