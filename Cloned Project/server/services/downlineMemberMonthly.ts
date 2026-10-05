// ───────────────────────────────────────────────────────────────────────
// Downline member profile — the monthly activity chart behind the header.
//
// Two series for one member, bucketed into the 12 months of a year:
//
//   · spent  → "Total Money Spent By <member>". Every PAID invoice line the
//              member bought, across ALL orgs and item types (the profile
//              TABS filter by category; this chart deliberately does not).
//   · earned → "Your Earnings From <member>". The VIEWER's commission on that
//              member's purchases — the same relationship the profile table's
//              "You Earned" column shows, just bucketed by month.
//
// Both are returned in **cents**, so the frontend has one unit to format.
// ───────────────────────────────────────────────────────────────────────

import { Types } from "mongoose";
import { Invoice } from "../models/invoice.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";

/**
 * INR → USD. Invoice line items are stored in their ORIGINAL currency's minor
 * unit (paise for INR, cents for USD) and carry no USD equivalent — only 65
 * paid invoices have a `currencyConversion`, so a per-invoice historical rate
 * isn't available for most rows. Both sides are 2-decimal minor units, so
 * dividing paise by this rate yields cents directly.
 *
 * Single source of truth: when the rate drifts, edit this one constant.
 */
export const INR_PER_USD = 88;

/** One month's totals. `month` is 1-12. Money is in CENTS. */
export interface MemberMonthlyPoint {
  month: number;
  spent: number;
  earned: number;
}

export interface MemberMonthlyResult {
  year: number;
  /** Always "USD" — INR spend is converted at INR_PER_USD. */
  currency: string;
  /** Years that have any spend or earnings, descending. Drives the picker. */
  years: number[];
  /** Always 12 entries, zero-filled, ordered Jan→Dec. */
  months: MemberMonthlyPoint[];
}

/** Invoices carry `paidAt` on 1223 of 1224 paid rows; `createdAt` covers the
 *  straggler so a purchase can never fall out of the chart entirely. */
const PAID_AT = { $ifNull: ["$paidAt", "$createdAt"] };

/** A line item's value in cents — INR converted, everything else as-is.
 *  A missing/absent currency is treated as USD, which is how the rest of the
 *  profile already reads these rows. */
const LINE_TOTAL_CENTS = {
  $cond: [
    { $eq: ["$lineItems.originalCurrency", "INR"] },
    { $divide: ["$lineItems.totalPrice", INR_PER_USD] },
    "$lineItems.totalPrice",
  ],
};

function emptyMonths(): MemberMonthlyPoint[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    spent: 0,
    earned: 0,
  }));
}

/**
 * Monthly spend + viewer earnings for one downline member.
 *
 * @param memberId whose profile is being viewed
 * @param viewerId the upline viewing it. Undefined for the garage admin panel,
 *                 which has no commission relationship — earnings stay 0.
 * @param year     calendar year (UTC) to bucket into
 */
export async function getMemberMonthlyActivity(
  memberId: Types.ObjectId,
  viewerId: Types.ObjectId | undefined,
  year: number,
): Promise<MemberMonthlyResult> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const [spendRows, earnRows, spendYears, earnYears] = await Promise.all([
    // ── spend: every paid invoice line, all orgs, all item types ──
    Invoice.aggregate([
      { $match: { userId: memberId, status: "paid" } },
      { $addFields: { _at: PAID_AT } },
      { $match: { _at: { $gte: start, $lt: end } } },
      { $unwind: "$lineItems" },
      { $group: { _id: { $month: "$_at" }, total: { $sum: LINE_TOTAL_CENTS } } },
    ]),

    // ── earnings: the viewer's cut of this member's purchases ──
    // Mirrors the profile table's "You Earned" match. The second $match after
    // $unwind is required: the first only proves the document contains a
    // commission for the viewer, not that every unwound row is theirs.
    viewerId
      ? CommissionDistribution.aggregate([
          {
            $match: {
              customerId: memberId,
              status: "completed",
              "commissions.userId": viewerId,
              createdAt: { $gte: start, $lt: end },
            },
          },
          { $unwind: "$commissions" },
          { $match: { "commissions.userId": viewerId } },
          {
            $group: {
              _id: { $month: "$createdAt" },
              // `commissions.amount` is in WHOLE units ($0.03) — the profile
              // table converts the same way.
              total: { $sum: { $multiply: ["$commissions.amount", 100] } },
            },
          },
        ])
      : Promise.resolve([] as { _id: number; total: number }[]),

    // ── which years to offer in the picker ──
    Invoice.aggregate([
      { $match: { userId: memberId, status: "paid" } },
      { $addFields: { _at: PAID_AT } },
      { $group: { _id: { $year: "$_at" } } },
    ]),
    viewerId
      ? CommissionDistribution.aggregate([
          {
            $match: {
              customerId: memberId,
              status: "completed",
              "commissions.userId": viewerId,
            },
          },
          { $group: { _id: { $year: "$createdAt" } } },
        ])
      : Promise.resolve([] as { _id: number }[]),
  ]);

  const months = emptyMonths();
  for (const r of spendRows as { _id: number; total: number }[]) {
    if (r._id >= 1 && r._id <= 12) months[r._id - 1].spent = Math.round(r.total);
  }
  for (const r of earnRows as { _id: number; total: number }[]) {
    if (r._id >= 1 && r._id <= 12) months[r._id - 1].earned = Math.round(r.total);
  }

  const years = [
    ...new Set(
      [...(spendYears as { _id: number }[]), ...(earnYears as { _id: number }[])]
        .map((r) => r._id)
        .filter((y) => Number.isFinite(y)),
    ),
  ].sort((a, b) => b - a);

  // Always offer the year being viewed, so an empty year still renders a
  // labelled, selectable chart rather than an empty picker.
  if (!years.includes(year)) years.push(year);

  return { year, currency: "USD", years: years.sort((a, b) => b - a), months };
}
