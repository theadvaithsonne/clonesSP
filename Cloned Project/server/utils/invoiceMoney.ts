// src/utils/invoiceMoney.ts
//
// Turning invoice money into USD, in one place.
//
// ── Why this file exists ──────────────────────────────────────────────────
// `Invoice.totalAmount` is in MINOR UNITS OF `itemCurrency` — cents for a USD
// invoice, paise for an INR one. Dividing it by 100 therefore yields dollars
// only when the invoice happens to be in dollars.
//
// Eleven call sites across the codebase sum `$totalAmount` and present the
// result as USD. Each one hand-rolled the conversion, and the ones that forgot
// the currency dimension produced figures like this, on the admin users list
// (1 Oct 2026):
//
//   Betty Bee's Sweet Chilli Sauce, 23482 paise = ₹234.82 = $2.44
//   admin "Purchase Volume"                                $234.82
//
// A 96× overstatement, and it read as plausible because the variable was
// called `totalCents`. Across the panel 45 users were inflated, $27,334 shown
// against $9,779 real.
//
// A correct helper already existed — `minorToUsd` — but it lived in
// services/genealogy/pure.ts, so only the genealogy code ever found it. This
// module is the obvious place to look instead.
//
// ── How to use it ────────────────────────────────────────────────────────
// Group by currency as well as by whatever you are reporting on, then fold:
//
//   const rows = await Invoice.aggregate([
//     { $match: { ...yourMatch, totalAmount: { $gt: 0 } } },
//     { $group: { _id: { u: "$userId", c: "$itemCurrency" },
//                 minor: { $sum: "$totalAmount" }, n: { $sum: 1 } } },
//   ]);
//   const rates = await usdRates();
//   const usd = minorToUsd(r.minor, r._id.c, rates);
//
// Never `$sum` across mixed currencies and convert afterwards — that adds
// paise to cents before the rate is applied, and the total is meaningless.

import { getRateTable } from "../fx/fxService";

/** `rates[X]` = units of X per 1 USD. */
export async function usdRates(): Promise<Record<string, number>> {
  const table = await getRateTable("USD");
  return table.rates as Record<string, number>;
}

/**
 * Minor units of `currency` → USD dollars, 2dp.
 *
 * An unrecognised currency returns 0 rather than passing the raw number
 * through: a missing rate must not silently become "that many dollars", which
 * is the exact failure this module exists to prevent.
 */
export function minorToUsd(
  minor: number,
  currency: string | undefined,
  rates: Record<string, number>
): number {
  const cur = (currency || "USD").toUpperCase();
  const rate = cur === "USD" ? 1 : rates[cur];
  if (!rate || rate <= 0) return 0;
  return Math.round((minor || 0) / rate) / 100;
}

/**
 * Fold `{ currency, minor }` rows into one USD figure.
 * Each currency is converted before anything is added together.
 */
export function sumMinorToUsd(
  rows: Array<{ currency?: string; minor: number }>,
  rates: Record<string, number>
): number {
  let usd = 0;
  for (const r of rows) usd += minorToUsd(r.minor, r.currency, rates);
  return Math.round(usd * 100) / 100;
}

/**
 * A Mongo expression that converts `totalAmount` to USD MINOR UNITS inside an
 * aggregation, so `$sum`, `$sort` and `$skip`/`$limit` all stay server-side.
 *
 * Use this when the pipeline sorts or paginates on the money figure — adding
 * `itemCurrency` to the `$group` key would split one row per currency and
 * break both the ordering and any `$addToSet` beside it.
 *
 * `currencies` should be the currencies actually present in the matched set
 * (`Invoice.distinct("itemCurrency", match)`), so the pipeline carries a
 * handful of branches rather than every rate on the table.
 *
 * An unrecognised currency yields 0 — the same refusal as `minorToUsd`, and
 * for the same reason: a missing rate must never pass the raw minor units
 * through as though they were cents.
 */
export function usdMinorExpr(
  rates: Record<string, number>,
  currencies: Array<string | null | undefined>,
  amountField = "$totalAmount",
  currencyField = "$itemCurrency"
): Record<string, unknown> {
  const branches: Array<Record<string, unknown>> = [
    {
      case: { $in: [currencyField, [null, "", "USD", "usd"]] },
      then: amountField,
    },
  ];
  for (const raw of new Set(currencies.map((c) => (c || "USD").toUpperCase()))) {
    if (raw === "USD") continue;
    const rate = rates[raw];
    if (!rate || rate <= 0) continue; // falls through to default 0
    branches.push({
      case: { $eq: [{ $toUpper: currencyField }, raw] },
      then: { $divide: [amountField, rate] },
    });
  }
  return { $switch: { branches, default: 0 } };
}
