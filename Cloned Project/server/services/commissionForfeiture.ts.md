# `server/services/commissionForfeiture.ts`

> src/services/commissionForfeiture.ts

**Kind:** backend service · **Lines:** 221

<!-- docgen:auto -->

## Purpose
src/services/commissionForfeiture.ts

The ledger primitive behind every commission a member does not get to keep.

Historically a forfeiture was invisible: the earner was simply credited a
smaller number, and the part they lost existed only as an English `note`
string and a `metadata` blob. You cannot label, total, or explain a loss the
system never recorded — so the shape is now always the same three rows:

  1. commission  + gross   to the earner      (what they actually earned)
  2. debit       − lost    to the earner      (this module)
  3. credit      + lost    to whoever gets it (the caller)

Net balance is identical to crediting the smaller number directly. What
changes is that the member can see the deduction, and we can total it.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ForfeitureReason` | type | Why the money left. | 38 |
| `FORFEITURE_LABELS` | const | `= { no_licence: "Lost commission — no Unilevel Plus licence", no_networkchain: "Lost comm…` — Shown to the member on the deduction row. | 49 |
| `describeForfeiture` | function | `describeForfeiture(reason: ForfeitureReason): string` | 55 |
| `ForfeitureMetadata` | interface | Stamped onto the debit row's `metadata.forfeiture`. | 66 |
| `RecordForfeitureResult` | interface |  | 78 |
| `recordForfeiture` | function | `` async recordForfeiture(params: { /** The earner's wallet, already loaded in `sessi…): Promise<RecordForfeitureResult \| null> `` — Write the deduction leg against an earner's affiliate wallet. | 94 |
| `splitForfeiture` | function | `splitForfeiture(gross: number, forfeitFraction: number): { keep: number; forfeited: number }` | 210 |

## Interfaces

- **Database (Mongoose models used):**
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
- **Packages:**
  - `mongoose` — `Types`, `ClientSession`

## Used by

- `server/services/__tests__/commissionForfeiture.test.ts`
- `server/services/wallet.ts`
