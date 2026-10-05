# `server/models/cryptosubBonusPayout.model.ts`

> One document per (run, recipient) — the concrete "user X gets $qualifyingSales*150 for month Y" row.

**Kind:** Mongoose model · **Lines:** 118

<!-- docgen:auto -->

## Purpose
One document per (run, recipient) — the concrete "user X gets
$qualifyingSales*150 for month Y" row. Mirrors RankQualification's
shape but simpler (no rank / basis / tier fields; the bonus is a
flat function of sale count).

Idempotency: unique compound index on {periodKey, userId} — so a
re-run for the same month upserts these rows instead of duplicating
them. The wallet-side dedupeKey below is layered on top for the
actual money.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `CryptosubBonusPayout`

- **Collection:** `cryptosubbonuspayouts` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `runId` | `Schema.Types.ObjectId` | required, index, ref "CryptosubBonusRun" |
| `periodKey` | `String` | required, index |
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `qualifyingSales` | `Number` | required |
| `bonusUsd` | `Number` | required |
| `payoutStatus` | `String` | index, default "pending", enum CRYPTOSUB_BONUS_PAYOUT_STATUSES as unknown … |
| `routedToPlatform` | `Boolean` | default false |
| `walletTransactionId` | `Schema.Types.ObjectId` | — |
| `paidAt` | `Date` | — |
| `attempts` | `Number` | default 0 |
| `lastError` | `String` | — |
| `saleInvoiceIds` | `[Schema.Types.ObjectId]` | — |
| `saleInvoiceIdsTruncated` | `Boolean` | default false |

### Indexes

- `{ periodKey: 1, userId: 1 }, { unique: true }` (L91)
- `{ runId: 1, bonusUsd: -1 }` (L97)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CRYPTOSUB_BONUS_PAYOUT_STATUSES` | const | `= [ "pending", "paid", "failed", ] as const` | 13 |
| `CryptosubBonusPayoutStatus` | type |  | 18 |
| `ICryptosubBonusPayout` | interface |  | 21 |
| `CryptosubBonusPayout` | model | `mongoose.model<ICryptosubBonusPayout>( "CryptosubBonusPayout", CryptosubBonusPayoutSchema…` | 99 |
| `MAX_PERSISTED_INVOICE_IDS` | export |  | 104 |
| `cryptosubMonthlyBonusDedupeKey` | function | `cryptosubMonthlyBonusDedupeKey(periodKey: string, userId: string): string` — Wallet-side dedupe key. | 112 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/routes/garageAdminCryptosubMonthlyBonus.ts`
- `server/services/cryptosubMonthlyBonus/payout.ts`
- `server/services/cryptosubMonthlyBonus/qualify.ts`
- `server/services/cryptosubMonthlyBonus/run.ts`
