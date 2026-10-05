# `server/models/cashbackDistribution.model.ts`

> Mongoose model for the cashback ledger: one row per invoice line that a cashback code touched, whether the cashback was paid, skipped or failed.

**Kind:** Mongoose model · **Lines:** 140

## Purpose
When a buyer uses a `CashbackCode`, the cashback service evaluates each invoice line and writes a `CashbackDistribution` row for it. The row records the outcome (`completed`, `skipped` when the line type was not covered or had no level-1 commission, `failed` for runtime problems such as an insufficient creator wallet balance) and the rate arithmetic. Its per-line shape mirrors `CommissionDistribution` so cashback can be broken down by product, buyer or creator.

## How it works
Fields (`ICashbackDistribution`, with `timestamps`):
- **Source:** `codeId` (`CashbackCode`), `invoiceId` (`Invoice`), `invoiceLineItemIndex` (0-based line position).
- `subscriptionRootId` (`Invoice`) - root invoice of a subscription (the `parentInvoiceId` for renewals, the invoice itself for the first one or for one-time items). Used to enforce the code's `cycleCount` per buyer-subscription.
- **Parties:** `creatorId` (affiliate), `buyerId`, `sellerOrgId` (`Organization`).
- **Item:** `productType` (enum from `CASHBACK_PRODUCT_TYPES`), optional `itemId`.
- **Sale:** `saleAmountCents` (line subtotal in the line's currency, smallest unit), `saleCurrency` (default `USD`).
- **Rates:** `level1RatePct` (the level-1 commission rate actually applied on the line, taken from the commission distribution), `configuredRatePct` (the code's `ratePct`), `appliedRatePct` (`min` of the two).
- `cashbackAmount` - float USD (wallet currency).
- `cycleNumber` - 1 for one-time items and the first subscription cycle.
- `affiliateTxId`, `storeTxId` - the debit and credit `WalletTransaction`s when paid.
- `status` - `completed`, `skipped` or `failed` (required); `failureReason` (max 500).

Indexes:
- `{ codeId, buyerId, subscriptionRootId }` - cycle-count enforcement (count completed rows per code, buyer and subscription root).
- `{ creatorId, createdAt: -1 }` - creator dashboard.
- `{ buyerId, createdAt: -1 }` - buyer history.
- Single-field indexes on the reference fields.

Collection: Mongoose default, `cashbackdistributions`.

## Exports
- `CashbackDistribution` - the model.
- `type CashbackDistributionStatus` - `"completed" | "skipped" | "failed"`.
- `interface ICashbackDistribution` - document type.

## Interfaces
- **Database:** `CashbackDistribution` (collection `cashbackdistributions`) - written by `server/services/cashbackCode.ts` during invoice fulfilment; read (finds and aggregations) by `server/routes/ecommerceWallet.ts` for ecommerce wallet views.

## Dependencies
- **Internal:** `server/models/cashbackCode.model.ts` - `CASHBACK_PRODUCT_TYPES` and `CashbackProductType`.
- **Packages:** `mongoose` - schema, model, types.

## Used by
`server/routes/ecommerceWallet.ts`, `server/services/cashbackCode.ts`.

## Notes
- There is no unique index on `(invoiceId, invoiceLineItemIndex, codeId)`. Idempotency comes from the service instead: `executeCashback` returns early if any row already exists for the invoice (`CashbackDistribution.exists({ invoiceId })`). That check is not atomic, so two concurrent fulfilments of the same invoice could both pass it.
- `saleAmountCents` is in the line's own currency while `cashbackAmount` is float USD; do not compare them directly.
