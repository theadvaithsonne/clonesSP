// Qualify step for the monthly founder Pro-sub volume bonus.
//
// Aggregates NEW office Pro-plan subscriptions activated in the UTC
// month window (grouped by the founder's direct referrer), then applies
// the tier function.
//
// WHY OfficeSubscription NOT Invoice: a single Pro sub can produce
// two paid Invoices with `recurringPaymentNumber = 1` (the parent
// created up-front at checkout PLUS a child created by the Razorpay
// `subscription.charged` webhook on the first auto-charge). Counting
// invoices would double-count the Razorpay-flow sales. OfficeSubscription
// is one-per-sub with `startedAt` set exactly once at activation, so
// counting subs gives the correct "new activations this month" figure.
// Renewals bump `paidCount`/`currentStart`/`currentEnd` but never
// change `startedAt`, so they're inherently excluded.
//
// PRO ONLY: match on `planId === OFFICE_PLAN_IDS.pro`. Basic (deprecated)
// and Starter (free) don't qualify.

import { Types } from "mongoose";
import { OfficeSubscription } from "../../models/officeSubscription.model";
import { OFFICE_PLAN_IDS } from "../../models/officePlan.model";
import {
  FOUNDER_SUB_BONUS,
  computeFounderSubBonusUsd,
} from "../../config/founderSubBonus";
import {
  periodBoundsFor,
  IFounderSubBonusRunTotals,
} from "../../models/founderSubBonusRun.model";
import {
  MAX_PERSISTED_INVOICE_IDS,
  FounderSubBonusTier,
} from "../../models/founderSubBonusPayout.model";

export interface Qualifier {
  userId: string;
  qualifyingSales: number;
  tier: FounderSubBonusTier;
  countedSales: number;
  bonusUsd: number;
  /** Actually subscription IDs — the field name stays for schema-compat. */
  saleInvoiceIds: Types.ObjectId[];
  saleInvoiceIdsTruncated: boolean;
}

export interface QualifyResult {
  qualifiers: Qualifier[];
  totalsSeed: Pick<
    IFounderSubBonusRunTotals,
    "evaluatedReferrers" | "qualifiedReferrers" | "qualifyingSales" | "bonusUsd"
  >;
}

export async function qualifyForPeriod(
  periodKey: string,
): Promise<QualifyResult> {
  const { start, endExclusive } = periodBoundsFor(periodKey);
  const cfg = FOUNDER_SUB_BONUS;
  const proPlanId = new Types.ObjectId(OFFICE_PLAN_IDS.pro);

  const rows = await OfficeSubscription.aggregate<{
    _id: Types.ObjectId; // founder.referredBy
    qualifyingSales: number;
    saleInvoiceIds: Types.ObjectId[];
  }>([
    {
      $match: {
        planId: proPlanId,
        // Only truly-activated subs count — filters out sub docs that
        // were `created` in Razorpay but the founder never completed
        // authentication for.
        startedAt: { $gte: start, $lt: endExclusive },
        // Exclude subs that never reached a paid cycle — a
        // startedAt-in-month sub that was cancelled before any
        // successful charge shouldn't earn its upline a bonus.
        paidCount: { $gte: 1 },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "founderId",
        foreignField: "_id",
        as: "founder",
      },
    },
    { $unwind: "$founder" },
    {
      $match: { "founder.referredBy": { $ne: null, $exists: true } },
    },
    {
      $group: {
        _id: "$founder.referredBy",
        qualifyingSales: { $sum: 1 },
        saleInvoiceIds: { $push: "$_id" },
      },
    },
  ]);

  const evaluatedReferrers = rows.length;
  const qualifiers: Qualifier[] = [];
  let totalQualifyingSales = 0;
  let totalBonusUsd = 0;

  for (const row of rows) {
    const sales = row.qualifyingSales;
    const bonusUsd = computeFounderSubBonusUsd(sales);
    if (bonusUsd <= 0) continue;

    const tier: FounderSubBonusTier =
      sales >= cfg.tiers.upperThresholdSales ? "upper" : "lower";
    const countedSales =
      tier === "upper" ? Math.min(sales, cfg.tiers.upperCapSales) : sales;

    const truncated = row.saleInvoiceIds.length > MAX_PERSISTED_INVOICE_IDS;
    const invoiceIds = truncated
      ? row.saleInvoiceIds.slice(0, MAX_PERSISTED_INVOICE_IDS)
      : row.saleInvoiceIds;

    qualifiers.push({
      userId: String(row._id),
      qualifyingSales: sales,
      tier,
      countedSales,
      bonusUsd,
      saleInvoiceIds: invoiceIds,
      saleInvoiceIdsTruncated: truncated,
    });
    totalQualifyingSales += sales;
    totalBonusUsd += bonusUsd;
  }

  return {
    qualifiers,
    totalsSeed: {
      evaluatedReferrers,
      qualifiedReferrers: qualifiers.length,
      qualifyingSales: totalQualifyingSales,
      bonusUsd: Math.round(totalBonusUsd * 100) / 100,
    },
  };
}
