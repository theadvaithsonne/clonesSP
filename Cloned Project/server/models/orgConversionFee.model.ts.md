# `server/models/orgConversionFee.model.ts`

> Mongoose model for an organization's currency-conversion fee schedule (one document per org), with fees stored in integer basis points.

**Kind:** Mongoose model · **Lines:** 77

## Purpose
A founder of a crypto office sets what they charge when a customer converts between wallet currencies (for example INR to USDT at 10%, INR to BTC at 20%). Garage charges that fee inside `transferBetweenWallets`, in the same MongoDB transaction as the conversion. The header comment explains why: an earlier design had the HiFi seller app do "convert, then move the fee" as two separate calls, and a failure between them meant the conversion happened for free with no way to unwind it. Keeping the schedule here lets the wallet transfer read it atomically.

## How it works
- **Units:** all rates are integer basis points (`1000` = 10%). This avoids float-percentage rounding errors when the fee is applied to small crypto amounts such as BTC.
- **`MAX_FEE_BPS = 5000`** (50%): hard upper bound on every fee field, so a typo such as `10000` (100%) cannot wipe out a customer's conversion. The service re-exports it so the UI can echo the same limit.
- **Pair sub-schema** (`_id: false`): `fromCurrency` and `toCurrency` (both enum `TRANSFERABLE_CURRENCIES` = `USD`, `INR`, `ETH`, `BTC`, `USDT`, `USDC`, from `server/services/cryptoFxRate.ts`), `feeBps` (0..5000, required), `isActive` (default `true`). Pairs are directional: INR to BTC says nothing about BTC to INR.
- **Document fields:**
  - `orgId` - ref `Organization`, required, unique and indexed: one schedule per org. The founder edits the whole table and saves it, so writes are wholesale replaces with no merge logic.
  - `defaultFeeBps` - applied when no explicit pair matches; default `0` (free).
  - `compPlanPercentage` - 0..100, default 0. The share **of the collected fee** (not of the conversion amount) routed through the Unilevel Plus commission tree. Example from the code: a 2% fee on a 100,000 INR conversion is 2,000; at 50% the tree gets 1,000 and the founder keeps 1,000.
  - `pairs` - array of pair rows, default `[]`. Uniqueness per direction is enforced by the service on write, because an embedded array cannot carry a unique index.
  - `updatedBy` - ref `User`, default `null`; audit of who last changed the prices.
- Options: `timestamps: true`, explicit collection name `org_conversion_fees`.
- The model is registered with a `mongoose.models.OrgConversionFee ||` guard, so re-imports (hot reload, scripts) reuse the existing model.

## Exports
- `MAX_FEE_BPS` - `5000`, the maximum fee in basis points.
- `IOrgConversionFee` - type inferred from the schema.
- `OrgConversionFee: Model<IOrgConversionFee>` - the model.

## Interfaces
- **Database:** `OrgConversionFee` (collection `org_conversion_fees`).

## Dependencies
- **Internal:** `server/services/cryptoFxRate.ts` - `TRANSFERABLE_CURRENCIES`, the list of currencies a wallet transfer can move between.
- **Packages:** `mongoose`.

## Used by
- `server/services/conversionFee.ts` - `resolveFee`, `computeFee`, `splitFeeForCompPlan`, `settleFeeCompPlan`, `isChargeablePair`, `isFeeExempt`; re-exports `MAX_FEE_BPS`.
- `server/routes/wallet.ts` - wallet routes that read and save the founder's fee table and perform transfers.

## Notes
- The enum on currency fields means adding a new transferable currency in `cryptoFxRate.ts` automatically widens what this schema accepts.
- Editing the max (`MAX_FEE_BPS`) changes validation for existing documents on their next save.
