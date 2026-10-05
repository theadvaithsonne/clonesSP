// Qualify step for the monthly whitelabel volume bonus.
//
// Given a period key ("YYYY-MM"), aggregates all PAID whitelabel_addon
// invoices with paidAt in the UTC month window, groups by the buyer's
// direct referrer (User.referredBy), filters to referrers with
// qualifyingSales ≥ threshold, and returns the qualifier list.
//
// RENEWAL EXCLUSION — the yearly renewal cron mints subsequent
// invoices with `recurringPaymentNumber > 1`. First-cycle invoices
// have either `recurringPaymentNumber: 1` or the field absent
// entirely (older docs). We match both.
//
// Amounts are computed in DOLLARS (float) — matches the wallet
// primitive `creditAffiliateOrPlatform`.

import { Types } from "mongoose";
import { Invoice } from "../../models/invoice.model";
import { WHITELABEL_ADDON } from "../../config/whitelabelAddon";
import {
  periodBoundsFor,
  IWhitelabelBonusRunTotals,
} from "../../models/whitelabelBonusRun.model";
import {
  MAX_PERSISTED_INVOICE_IDS,
} from "../../models/whitelabelBonusPayout.model";

export interface Qualifier {
  userId: string;
  qualifyingSales: number;
  bonusUsd: number;
  saleInvoiceIds: Types.ObjectId[];
  saleInvoiceIdsTruncated: boolean;
}

export interface QualifyResult {
  qualifiers: Qualifier[];
  /** Populated so the run totals get filled from the qualifier pass in one shot. */
  totalsSeed: Pick<
    IWhitelabelBonusRunTotals,
    "evaluatedReferrers" | "qualifiedReferrers" | "qualifyingSales" | "bonusUsd"
  >;
}

export async function qualifyForPeriod(
  periodKey: string,
): Promise<QualifyResult> {
  const { start, endExclusive } = periodBoundsFor(periodKey);
  const cfg = WHITELABEL_ADDON.monthlyVolumeBonus;
  const bonusPerSaleUsd = cfg.bonusPerSaleUsdCents / 100;

  const rows = await Invoice.aggregate<{
    _id: Types.ObjectId; // buyer.referredBy
    qualifyingSales: number;
    saleInvoiceIds: Types.ObjectId[];
  }>([
    {
      $match: {
        "lineItems.itemType": "whitelabel_addon",
        status: "paid",
        paidAt: { $gte: start, $lt: endExclusive },
        // NEW activations only — renewal invoices (yearly cron) carry
        // recurringPaymentNumber > 1 and are excluded.
        $or: [
          { recurringPaymentNumber: { $exists: false } },
          { recurringPaymentNumber: 1 },
        ],
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "buyer",
      },
    },
    { $unwind: "$buyer" },
    { $match: { "buyer.referredBy": { $ne: null, $exists: true } } },
    {
      $group: {
        _id: "$buyer.referredBy",
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
    if (row.qualifyingSales < cfg.thresholdSales) continue;
    const truncated =
      row.saleInvoiceIds.length > MAX_PERSISTED_INVOICE_IDS;
    const invoiceIds = truncated
      ? row.saleInvoiceIds.slice(0, MAX_PERSISTED_INVOICE_IDS)
      : row.saleInvoiceIds;
    const bonusUsd =
      Math.round(row.qualifyingSales * bonusPerSaleUsd * 100) / 100;
    qualifiers.push({
      userId: String(row._id),
      qualifyingSales: row.qualifyingSales,
      bonusUsd,
      saleInvoiceIds: invoiceIds,
      saleInvoiceIdsTruncated: truncated,
    });
    totalQualifyingSales += row.qualifyingSales;
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
