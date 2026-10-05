# `server/utils/invoiceMoney.ts`

> src/utils/invoiceMoney.ts

**Kind:** backend utility · **Lines:** 118

<!-- docgen:auto -->

## Purpose
src/utils/invoiceMoney.ts

Turning invoice money into USD, in one place.

── Why this file exists ──────────────────────────────────────────────────
`Invoice.totalAmount` is in MINOR UNITS OF `itemCurrency` — cents for a USD
invoice, paise for an INR one. Dividing it by 100 therefore yields dollars
only when the invoice happens to be in dollars.

Eleven call sites across the codebase sum `$totalAmount` and present the
result as USD. Each one hand-rolled the conversion, and the ones that forgot
the currency dimension produced figures like this, on the admin users list
(1 Oct 2026):

  Betty Bee's Sweet Chilli Sauce, 23482 paise = ₹234.82 = $2.44
  admin "Purchase Volume"                                $234.82 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `usdRates` | function | `async usdRates(): Promise<Record<string, number>>` — `rates[X]` = units of X per 1 USD. | 43 |
| `minorToUsd` | function | `minorToUsd(minor: number, currency: string \| undefined, rates: Record<string, number>): number` — Minor units of `currency` → USD dollars, 2dp. | 55 |
| `sumMinorToUsd` | function | `sumMinorToUsd(rows: Array<{ currency?: string; minor: number }>, rates: Record<string, number>): number` — Fold `{ currency, minor }` rows into one USD figure. | 70 |
| `usdMinorExpr` | function | `usdMinorExpr(rates: Record<string, number>, currencies: Array<string \| null \| undefined>, amountField = "$totalAmount", currencyField = "$itemCurrency"): Record<string, unknown>` — A Mongo expression that converts `totalAmount` to USD MINOR UNITS inside an aggregation, so `$sum`, `$sort` and `$skip`/`$limit` all stay server-side. | 95 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/fx/fxService.ts` — `getRateTable`
- **Packages:** none

## Used by

- `server/controllers/garageAdmin.controller.ts`
- `server/services/affiliateAnalyticsDetail.ts`
