# `server/models/bondPayoutEvent.model.ts`

> Mongoose model for one scheduled interest payment of one HiFi bond holding, with a unique `dedupeKey` that makes the payout engine safe to run on several instances at once.

**Kind:** Mongoose model · **Lines:** 75

## Purpose
HiFi bonds pay interest on a schedule. Rather than computing payouts on the fly, every payment for a holding is pre-created as a `BondPayoutEvent` row at purchase time, before any money moves. The hourly payout tick then settles rows whose `dueAt` has passed. The file header explains why: the backend has no cron library or leader election (jobs are plain `setInterval`s in `server/index.ts`), so two instances can run the same tick concurrently, and correctness rests on the database refusing a duplicate write.

## How it works
- **Collection:** explicitly `bond_payout_events`, with `timestamps`.
- **Links:** `holdingId` (`BondHolding`), `instrumentId` (`BondInstrument`), `orgId` (`Organization`), `buyerUserId` (`User`), all required.
- **Schedule:** `sequenceNo` (1-based position in the holding's schedule) and `dueAt`.
- **Money:** `currency` is one of `BOND_CURRENCIES` (`INR`, `USD`, `USDT`, `BTC`, `ETH`, from `server/config/bondMoney.ts`). `interestAtomic` and `commissionAtomic` are integer amounts in the currency's smallest unit **stored as strings** (bond maths uses BigInt so it never touches floats; ETH wei overflows a JS number). `commissionAtomic` is the commission pool for this payout date, `"0"` when the plan's basis excludes payouts.
- **Lifecycle:** `status` is `scheduled` (default), `paid`, `failed` or `skipped`. `attempts`, `lastError` and `paidAt` record settlement tries.
- **Settlement links:** `walletTransactionId` and `commissionDistributionId` point at the wallet credit and commission record made when it was paid.
- **USD snapshot:** `usdAtPayment` and `usdRateAtPayment` record what the payment was worth at payment time, for the public bond page. Both are null for older rows or when the price feed was down; the comment is explicit that a missing rate must never block a payout.
- **`dedupeKey`:** `"bond_payout_<holdingId>_<sequenceNo>"`, required.

Indexes:
- `{ dedupeKey: 1 }` **unique**: the safety index. A concurrent duplicate insert or settle must fail here.
- `{ status: 1, dueAt: 1 }`: the scheduler's hot query (`status: "scheduled", dueAt <= now`).

The model is registered with the `mongoose.models.BondPayoutEvent || mongoose.model(...)` guard so re-importing (e.g. in tests or hot reload) does not throw `OverwriteModelError`.

## Exports
- `BondPayoutEvent: Model<IBondPayoutEvent>` - the model.
- `BOND_PAYOUT_EVENT_STATUSES` - `["scheduled", "paid", "failed", "skipped"] as const`.
- `type IBondPayoutEvent` - document shape inferred from the schema (`InferSchemaType`).

## Interfaces
- **Database:** `BondPayoutEvent` (collection `bond_payout_events`) - defined here; inserted in bulk by `server/services/bondInvoiceFulfillment.ts` (`insertMany` inside a session at purchase), claimed and updated by `server/services/bondPayoutEngine.ts`, read by `server/services/bondView.ts` and `server/routes/bond.ts`.
- **Background work:** consumed by the hourly `runBondPayoutTick` scheduled in `server/index.ts` (first run about 4 minutes after boot, then every hour).

## Dependencies
- **Internal:** `server/config/bondMoney.ts` - `BOND_CURRENCIES` enum for `currency`.
- **Packages:** `mongoose` - schema and model.

## Used by
`server/routes/bond.ts` (mounted at `/bonds`, browser `/backend/bonds`), `server/services/bondInvoiceFulfillment.ts`, `server/services/bondPayoutEngine.ts`, `server/services/bondView.ts`, and the test `server/services/__tests__/bondModels.test.ts`.

## Notes
- Do not drop or relax the unique `dedupeKey` index; the header calls it "not optional". Multi-instance safety depends on it.
- Amount fields are strings. Never `$inc` them or compare them as numbers; convert with the helpers in `server/config/bondMoney.ts`.
