# `server/models/bondHolding.model.ts`

> Mongoose model `BondHolding`: one investor's position in a HiFi bond, created per purchase, with snapshotted payout terms and a public bond hash.

**Kind:** Mongoose model · **Lines:** 103

## Purpose
Part of the HiFi Bonds feature, in which crypto-office founders issue bonds (`BondInstrument`) and investors buy units. Each purchase produces exactly one holding that tracks payment, payouts, maturity and redemption. Section references in the comments ("spec §9", "§8") point to the bond specification, and `HIFI_BONDS_PLAN.md` decision O2 explains the shape.

## How it works
### One row per purchase
Partial redemption is not supported in v1. The comment warns that supporting it would need unit-level rows, so if that decision changes, this model must change shape rather than gain a field.

### Money
All amounts are **atomic integer strings** (smallest currency unit, handled with BigInt - see `server/config/bondMoney.ts`). `currency` is one of `BOND_CURRENCIES`: `INR`, `USD`, `USDT`, `BTC`, `ETH`.

### Fields
- `instrumentId` (ref `BondInstrument`), `buyerUserId` (ref `User`), `orgId` (ref `Organization`) - required, indexed.
- `bondHash` - public, non-guessable 12-digit identifier shown on the public bond page and share links; defaults to `generateBondHash()` (`server/services/bondHash.ts`, first digit 1-9). Fulfilment also sets it explicitly so it can retry on a collision.
- `units` (`min: 1`), `principalAtomic` (units x unit price at purchase).
- `payoutAmountPerUnitAtomic`, `payoutCount` - **snapshot** of the instrument's terms so a later edit can never change what this holding is owed.
- `invoiceId` (ref `Invoice`).
- `status` - see lifecycle below; indexed.
- `purchasedAt`, `maturesAt`, `nextPayoutAt` (denormalised from bond payout events for cheap listing), `payoutsCompleted`.
- `redeemedAt`, `redemptionTxId` (the `WalletTransaction` that returned principal), `autoRedeemed` (true when returned by the auto-redeem sweep rather than by the user).
- `lastPayoutError`.

### Lifecycle (`BOND_HOLDING_STATUSES`)
`pending_payment` -> `active` -> (`payout_failed` <-> `active`) -> `matured` -> `redeemed`, plus `cancelled` before Day 0 completes.

### Indexes
- Unique `invoiceId`, partial on `invoiceId` being an ObjectId: one invoice can only ever produce one holding (database guarantee, since `fulfillInvoice` can be re-entered by retries or reconcile sweeps), while many pre-payment rows with `null` don't collide.
- Unique `bondHash`, partial on it being a string.
- `{ buyerUserId, orgId, createdAt -1 }` - investor portfolio.
- `{ status, maturesAt }` - auto-redeem sweep for unredeemed matured holdings.

Collection `bond_holdings`. The model is registered behind a `mongoose.models.BondHolding ||` guard.

## Exports
- `BondHolding: Model<IBondHolding>` - Mongoose model.
- `type IBondHolding` - `InferSchemaType` of the schema.
- `BOND_HOLDING_STATUSES` - the status tuple.

## Interfaces
- **Database:** `BondHolding` (collection `bond_holdings`).

## Dependencies
- **Internal:** `server/config/bondMoney.ts` - `BOND_CURRENCIES`; `server/services/bondHash.ts` - `generateBondHash` default.
- **Packages:** `mongoose`.

## Used by
- `server/routes/bond.ts` - mounted at `/bonds` (browser `/backend/bonds`).
- `server/routes/publicBond.ts` - mounted at `/public/bonds` (browser `/backend/public/bonds`), public lookup by bond hash.
- `server/services/bondInvoiceFulfillment.ts` - creates/activates holdings on payment.
- `server/services/bondPayoutEngine.ts` - payouts, maturity, redemption.
- `server/services/__tests__/bondModels.test.ts` - tests.

## Notes
- autoIndex is off in production (`server/db/mongo.ts`), so the partial unique indexes are created by the bond-hash backfill / `npm run indexes:sync`, not on deploy. Until they exist, the "one holding per invoice" guarantee is application-level only.
