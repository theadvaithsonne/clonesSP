# `server/services/bondInvoiceFulfillment.ts`

> Fulfillment for the "hifi_bond" invoice itemType.

**Kind:** backend service · **Lines:** 372

<!-- docgen:auto -->

## Purpose
Fulfillment for the "hifi_bond" invoice itemType.

By the time this runs the buyer's store wallet has already been
debited by the invoice pay path. This hook turns that payment into a
live position:

  1. Creates the bond_holding (one per invoice, DB-enforced).
  2. Pre-creates EVERY scheduled payout event, before any money is
     ever moved for them. Spec §8 — the ledger row has to exist
     first, so a retrying scheduler can never double-pay.
  3. Passes the principal through to the founder's wallet
     (decision D5 — no escrow; the founder can spend it, which is
     why the payout engine has a payout_failed state).
  4. Records the principal-commission POOL owed, if any.
  5. Advances unitsSold and closes the instrument at cap.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BondFulfillmentResult` | interface |  | 33 |
| `payoutDueAt` | function | `payoutDueAt(purchasedAt: Date, sequenceNo: number, frequency: PayoutFrequency): Date` — Nth payout date = purchase date + N whole periods. | 47 |
| `fulfillBondInvoice` | function | `async fulfillBondInvoice(invoice: any): Promise<BondFulfillmentResult>` | 57 |

## Interfaces

- **Database (Mongoose models used):**
  - `BondHolding` (server/models/bondHolding.model.ts) — reads: `findOne`; **writes:** `create`
  - `BondInstrument` (server/models/bondInstrument.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `BondPayoutEvent` (server/models/bondPayoutEvent.model.ts) — **writes:** `insertMany`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`
  - `BondLedgerEntry` (server/models/bondLedgerEntry.model.ts) — **writes:** `create`
  - `Invoice` (server/models/invoice.model.ts) — **writes:** `updateOne`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/bondInstrument.model.ts` — `BondInstrument`
  - `server/models/bondHolding.model.ts` — `BondHolding`
  - `server/models/bondPayoutEvent.model.ts` — `BondPayoutEvent`
  - `server/models/bondLedgerEntry.model.ts` — `BondLedgerEntry`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/config/bondMoney.ts` — `BondCurrency`, `mulUnits`, `percentOf`, `toWalletAmount`
  - `server/services/bondMath.ts` — `PAYOUT_PERIOD_DAYS`, `PayoutFrequency`
  - `server/services/hifiInvoiceFulfillment.ts` — `findOrgFounderId`
  - `server/services/bondHash.ts` — `generateBondHash`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/services/__tests__/bondSchedule.test.ts`
- `server/services/invoice.ts`
