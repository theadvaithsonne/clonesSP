# `server/models/cryptosubBonusRun.model.ts`

> One document per monthly cryptosub-volume-bonus run.

**Kind:** Mongoose model · **Lines:** 150

<!-- docgen:auto -->

## Purpose
One document per monthly cryptosub-volume-bonus run. `periodKey`
("2026-08") is unique so a second attempt at the same month reuses
the existing run doc rather than creating a parallel one — the first
line of re-run defence. The second is the dedupeKey on each
WalletTransaction (see `cryptosubMonthlyBonusDedupeKey` in
CryptosubBonusPayout).

Mirrors the shape of RankRun on purpose so admin queries + status
enums stay familiar. Sibling models (not shared) because the
qualifier logic is completely different (invoice aggregation vs
tree traversal at snapshot).

Amounts are DOLLARS (float), matching the wallet layer.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `CryptosubBonusRun`

- **Collection:** `cryptosubbonusruns` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `periodKey` | `String` | required, unique |
| `status` | `String` | index, default "computing", enum CRYPTOSUB_BONUS_RUN_STATUSES as unknown as … |
| `dryRun` | `Boolean` | required |
| `snapshotAt` | `Date` | required |
| `startedAt` | `Date` | required |
| `computedAt` | `Date` | — |
| `paidAt` | `Date` | — |
| `totals` | `TotalsSchema` | default () => ({}) |
| `error` | `String` | — |
| `triggeredBy` | `String` | — |

### Indexes

- `{ createdAt: -1 }` (L104)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CRYPTOSUB_BONUS_RUN_STATUSES` | const | `= [ "computing", "computed", "paying", "paid", "failed", ] as const` | 17 |
| `CryptosubBonusRunStatus` | type |  | 24 |
| `ICryptosubBonusRunTotals` | interface |  | 27 |
| `ICryptosubBonusRun` | interface |  | 43 |
| `CryptosubBonusRun` | model | `mongoose.model<ICryptosubBonusRun>( "CryptosubBonusRun", CryptosubBonusRunSchema, )` | 106 |
| `periodKeyFor` | function | `periodKeyFor(d: Date): string` — "2026-08" for the month containing `d`. | 112 |
| `previousPeriodKeyFor` | function | `previousPeriodKeyFor(d: Date): string` — The month BEFORE the one containing `d` — the period a run executed on `d` settles. | 121 |
| `periodBoundsFor` | function | `periodBoundsFor(periodKey: string): { start: Date; endExclusive: Date; }` — [startInclusive, endExclusive) UTC bounds for a `YYYY-MM` key. | 128 |
| `emptyTotals` | function | `emptyTotals(): ICryptosubBonusRunTotals` — Empty totals — kept alongside the constructor so admin API shape is stable. | 139 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`

## Used by

- `server/routes/garageAdminCryptosubMonthlyBonus.ts`
- `server/services/cryptosubMonthlyBonus/qualify.ts`
- `server/services/cryptosubMonthlyBonus/run.ts`
