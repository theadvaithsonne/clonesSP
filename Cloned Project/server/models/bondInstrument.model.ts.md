# `server/models/bondInstrument.model.ts`

> Mongoose model `BondInstrument`: a HiFi bond issued by a crypto-office founder, with seller-defined terms and a frozen `derived` snapshot of payouts, commissions and outflows.

**Kind:** Mongoose model · **Lines:** 125

## Purpose
Defines the bond product itself in the HiFi Bonds feature: price per unit, currency, duration, payout frequency and rate, unit supply, commission rules and comp plan. Investors buy units, producing `BondHolding` rows. Only crypto offices can issue bonds: every route touching this model asserts `Organization.officeCreatedFromCryptobrand === true`.

## How it works
### Money rules
Every amount is an **integer count of the currency's smallest unit stored as a string** and handled with BigInt (`server/config/bondMoney.ts`), never a float: wallet balances already drift, and a daily bond would compound that. The local helper `atomic` = `{ type: String, required: true, default: "0" }`.

### Seller-defined terms (spec §2)
- `orgId` (ref `Organization`, indexed), `createdBy` (ref `User`), `name`, `description`.
- `unitPriceAtomic`, `currency` (`BOND_CURRENCIES`: `INR`, `USD`, `USDT`, `BTC`, `ETH`), `durationDays` (`min: 1`).
- `payoutFrequency` - `PAYOUT_FREQUENCIES` from `server/services/bondMath.ts`: `daily`, `monthly`, `quarterly`, `half_yearly`, `yearly`.
- `ratePerPayoutPeriod` - percent **per payout event**, never annualised (the spec warns that calling it IRR would get it divided by 365).
- `totalUnits`, `minUnits` (default 1), `unitsSold` (default 0).
- `commissionBasis` - `principal`, `payout`, `both`, `none` (default).
- `principalCommissionRate` - percent of unit price, charged once at purchase.
- `payoutCommissionRate` - percent of the payout amount, charged on each payout date. Kept separate from the principal rate on purpose (decision D2): a single "commission rate" could be read two ways that differ by 100x.
- `combPlanId` (ref `CombPlan`) - the `levels` or `unilevel_plus` comp plan that splits the commission pool; the bond engine never splits it itself.

### `derived` snapshot (spec §3 / §7)
Computed and stored at publish time so a founder cannot edit a plan and retroactively change what existing holdings are owed. Sub-schema (no `_id`):
- Per unit: `payoutAmountPerUnitAtomic`, `payoutCount`, `totalInterestPerUnitAtomic`, `principalCommissionPerUnitAtomic`, `payoutCommissionPerPayoutPerUnitAtomic`, `totalCommissionPerUnitAtomic`, `totalOutflowPerUnitAtomic`, `sellerNetPerUnitAtomic` (signed - negative when the seller pays out more than they raise).
- At full subscription: `totalRaiseAtomic`, `totalInterestAtFullAtomic`, `totalCommissionAtFullAtomic`, `totalOutflowAtFullAtomic`, `sellerNetAtFullAtomic`.
- `annualisedRatePct` (string), `stubDays`.

### Publishing
- `acknowledgedOutflowAtomic` - the exact total-outflow figure the founder confirmed at publish (a hard confirmation, storing proof of which number they saw).
- `status` - `draft` (default), `published`, `fully_subscribed`, `closed`; indexed. `publishedAt`, `closedAt`.

### Indexes
`{ orgId, status, createdAt -1 }` (founder list) and `{ status, currency }` (investor browse). Collection `bond_instruments`; registered behind a `mongoose.models.BondInstrument ||` guard.

## Exports
- `BondInstrument: Model<IBondInstrument>` - Mongoose model.
- `type IBondInstrument` - `InferSchemaType` of the schema.
- `BOND_INSTRUMENT_STATUSES` - `["draft", "published", "fully_subscribed", "closed"]`.
- `COMMISSION_BASES` - `["principal", "payout", "both", "none"]`.

## Interfaces
- **Database:** `BondInstrument` (collection `bond_instruments`).

## Dependencies
- **Internal:** `server/config/bondMoney.ts` - `BOND_CURRENCIES`; `server/services/bondMath.ts` - `PAYOUT_FREQUENCIES` (and the maths that fills `derived`).
- **Packages:** `mongoose`.

## Used by
- `server/routes/bond.ts` - mounted at `/bonds` (browser `/backend/bonds`).
- `server/services/bondInvoiceFulfillment.ts`, `server/services/bondPayoutEngine.ts`, `server/services/bondView.ts`.
- `server/services/__tests__/bondModels.test.ts` - tests.
