# `server/services/cryptosubMonthlyBonus/qualify.ts`

> Qualify step for the monthly cryptosub volume bonus.

**Kind:** backend service · **Lines:** 123

<!-- docgen:auto -->

## Purpose
Qualify step for the monthly cryptosub volume bonus.

Given a period key ("YYYY-MM"), aggregates all PAID cryptosub
invoices with paidAt in the UTC month window, groups by the buyer's
direct referrer (User.referredBy), filters to referrers with
qualifyingSales ≥ threshold, and returns the qualifier list.

RENEWAL EXCLUSION — the yearly renewal cron mints subsequent
invoices with `recurringPaymentNumber > 1`. First-cycle invoices
have either `recurringPaymentNumber: 1` or the field absent
entirely (older docs). We match both.

Amounts are computed in DOLLARS (float) — matches the wallet
primitive `creditAffiliateOrPlatform`.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Qualifier` | interface |  | 27 |
| `QualifyResult` | interface |  | 35 |
| `qualifyForPeriod` | function | `async qualifyForPeriod(periodKey: string): Promise<QualifyResult>` | 44 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `aggregate`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/config/cryptosubAddon.ts` — `CRYPTOSUB_ADDON`
  - `server/models/cryptosubBonusRun.model.ts` — `periodBoundsFor`, `ICryptosubBonusRunTotals`
  - `server/models/cryptosubBonusPayout.model.ts` — `MAX_PERSISTED_INVOICE_IDS`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/services/cryptosubMonthlyBonus/run.ts`
