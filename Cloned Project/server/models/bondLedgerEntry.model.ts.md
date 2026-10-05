# `server/models/bondLedgerEntry.model.ts`

> Mongoose model `BondLedgerEntry`: append-only, bond-shaped audit row for every HiFi bond money movement, recorded in exact atomic amounts.

**Kind:** Mongoose model · **Lines:** 67

## Purpose
`WalletTransaction` already records the wallet side of each movement, but it is per-wallet and knows nothing about bonds. This ledger records which instrument, holding and payout event a movement belongs to, and the exact atomic amount before any float conversion at the wallet layer, which makes reconciliation possible.

## How it works
- **Never updated in place.** A reversal is a new row of kind `reversal` pointing at the original through `reversesEntryId`.
- `kind` (`BOND_LEDGER_KINDS`, indexed):
  - `purchase_debit` / `purchase_credit` - principal from buyer to seller.
  - `principal_commission` - commission pool at purchase.
  - `payout_debit` / `payout_credit` - interest from seller to buyer.
  - `payout_commission` - pool on a payout date.
  - `redemption_debit` / `redemption_credit` - principal back to buyer.
  - `reversal` - automatic reversal of a debit whose matching credit failed.
- Links: `instrumentId` (ref `BondInstrument`, required), `holdingId` (ref `BondHolding`), `payoutEventId` (ref `BondPayoutEvent`), `orgId` (ref `Organization`, required).
- Parties: `fromUserId`, `toUserId` (ref `User`).
- Amounts: `currency` (`BOND_CURRENCIES`), `amountAtomic` (string - the authoritative figure), `walletAmount` (the float actually handed to the wallet layer, to detect edge drift).
- Commission rows only: `poolUsd` and `fxRateToUsd` (commission distribution is USD-only today).
- `walletTransactionId` - the corresponding wallet transaction; `note`.
- Indexes: `kind`, `instrumentId`, `holdingId`, `orgId` single-field; `{ orgId, createdAt -1 }` (org ledger view, mirroring the hifi transactions endpoint); `{ holdingId, createdAt 1 }` (per-holding history).
- Collection `bond_ledger_entries`; registered behind a `mongoose.models.BondLedgerEntry ||` guard.

## Exports
- `BondLedgerEntry: Model<IBondLedgerEntry>` - Mongoose model.
- `type IBondLedgerEntry` - `InferSchemaType` of the schema.
- `BOND_LEDGER_KINDS` - the kind tuple listed above.

## Interfaces
- **Database:** `BondLedgerEntry` (collection `bond_ledger_entries`) - append-only.

## Dependencies
- **Internal:** `server/config/bondMoney.ts` - `BOND_CURRENCIES`.
- **Packages:** `mongoose`.

## Used by
- `server/routes/bond.ts` - mounted at `/bonds` (browser `/backend/bonds`), ledger listing.
- `server/services/bondCommission.ts`, `server/services/bondInvoiceFulfillment.ts`, `server/services/bondPayoutEngine.ts` - write entries.
- `server/services/__tests__/bondModels.test.ts` - tests.
