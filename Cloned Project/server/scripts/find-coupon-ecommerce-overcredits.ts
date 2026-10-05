/**
 * Enumerate every ecommerce invoice paid with a coupon before the
 * per-line coupon-discount fix landed. Reports the over-credit to
 * each recipient (seller, affiliates, platform, territory owners).
 *
 * Bug: services/invoice.ts ecommerce_item branch computed commissions
 * on li.totalPrice (PRE-discount) instead of on (li.totalPrice - lineDiscount).
 * Every downstream credit — seller gross, platform fee, comb-plan
 * affiliates, System A territory slices, System B franchise slices —
 * inflated by the same fraction (discount / preDiscountLineTotal).
 *
 * Report shape:
 *   - Per-invoice detail: buyer, item, coupon, discount amount,
 *     recipients with (credited, should-be, over-credit).
 *   - Aggregated: per-recipient total over-credit in USD.
 *
 * Dry-run only — writes nothing. Reconciliation is a separate script.
 *
 * Usage:
 *   npx tsx src/scripts/find-coupon-ecommerce-overcredits.ts
 */

import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { TerritoryWalletTransaction } from "../models/territoryWalletTransaction.model";
import { User } from "../models/user.model";

type Recipient = {
  email: string;
  userId: string;
  role: string;
  credited: number;
  overCredit: number;
  currency: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  // 1) Paid invoices with an ecommerce line item AND a discount applied.
  const invoices = await db
    .collection("invoices")
    .find({
      status: "paid",
      discount: { $gt: 0 },
      "lineItems.itemType": "ecommerce_item",
    })
    .sort({ paidAt: 1 })
    .toArray();

  console.log(`\nCandidate invoices: ${invoices.length}\n`);

  const byRecipient = new Map<string, Recipient>();
  let scannedLines = 0;
  let scannedDistributions = 0;

  for (const inv of invoices) {
    const invNum: string = inv.invoiceNumber;
    const buyer = inv.customerEmail || String(inv.userId);
    const subtotalPaise: number = inv.subtotal || 0;
    const discountPaise: number = inv.discount || 0;
    const itemCurrency: string = inv.itemCurrency || "INR";

    if (subtotalPaise <= 0 || discountPaise <= 0) continue;

    // Per-line: how much of the coupon SHOULD have been subtracted?
    for (const li of (inv.lineItems || []) as any[]) {
      if (li.itemType !== "ecommerce_item") continue;
      scannedLines += 1;
      const lineGrossPaise: number = li.totalPrice || 0;
      if (lineGrossPaise <= 0) continue;
      const lineDiscountPaise = Math.round(
        (lineGrossPaise / subtotalPaise) * discountPaise,
      );
      if (lineDiscountPaise <= 0) continue;
      const discountFraction = lineDiscountPaise / lineGrossPaise;

      // 2) Find distributions for this line. Ecommerce uses paymentId
      //    `${razorpayPaymentId}_${itemId}` (or `_variantId` suffix).
      //    Fall back to metadata.invoiceId if present.
      const paymentIdPrefix = inv.razorpayPaymentId
        ? `${inv.razorpayPaymentId}_${String(li.itemId)}`
        : null;
      const distFilter: any = {
        $or: [{ "metadata.invoiceId": String(inv._id) }],
      };
      if (paymentIdPrefix) {
        distFilter.$or.push({
          paymentId: { $regex: `^${escape(paymentIdPrefix)}` },
        });
      }
      distFilter.itemType = "product";
      distFilter.itemId = li.itemId;

      const dists = await CommissionDistribution.find(distFilter).lean();
      if (dists.length === 0) {
        console.log(
          `  ⚠ ${invNum} line ${li.itemName}: no CommissionDistribution — skip`,
        );
        continue;
      }

      for (const d of dists) {
        scannedDistributions += 1;

        const currency = (d as any).currency || "USD";
        const platformUserId =
          ((d.metadata as any) || {}).platformUserId || null;

        // === Seller over-credit ===
        const sellerId = String(d.sellerId);
        addRecipient(byRecipient, {
          email: (d as any).sellerEmail || sellerId,
          userId: sellerId,
          role: "seller",
          credited: d.sellerAmount || 0,
          overCredit: (d.sellerAmount || 0) * discountFraction,
          currency,
        });

        // === Platform fee over-credit (Shorupan) ===
        if (platformUserId && (d as any).platformFeeAmount > 0) {
          addRecipient(byRecipient, {
            email: "shorupan@gmail.com",
            userId: String(platformUserId),
            role: "platform",
            credited: (d as any).platformFeeAmount,
            overCredit: (d as any).platformFeeAmount * discountFraction,
            currency,
          });
        }

        // === Affiliate over-credits ===
        for (const c of d.commissions || []) {
          addRecipient(byRecipient, {
            email: (c as any).userEmail || String(c.userId),
            userId: String(c.userId),
            role: `affiliate-L${c.level}`,
            credited: c.amount || 0,
            overCredit: (c.amount || 0) * discountFraction,
            currency,
          });
        }

        // === Territory / franchise-program slices (System A + B) ===
        const twtxs = await TerritoryWalletTransaction.find({
          relatedCommissionDistributionId: d._id,
          type: "credit",
        }).lean();
        for (const t of twtxs) {
          addRecipient(byRecipient, {
            email: (t as any).userId ? String((t as any).userId) : "unknown",
            userId: String((t as any).userId),
            role: `territory-${(t as any).entityType || "?"}`,
            credited: t.amount || 0,
            overCredit: (t.amount || 0) * discountFraction,
            currency,
          });
        }
      }

      console.log(
        `  ${invNum}  ${buyer.padEnd(30)}  ${li.itemName?.slice(0, 40) || "?"}  ` +
          `gross=${(lineGrossPaise / 100).toFixed(2)} disc=${(lineDiscountPaise / 100).toFixed(2)} ${itemCurrency}  ` +
          `frac=${(discountFraction * 100).toFixed(2)}%`,
      );
    }
  }

  console.log(
    `\nScanned: ${invoices.length} invoices, ${scannedLines} ecommerce lines, ${scannedDistributions} distributions.\n`,
  );

  // 3) Resolve real emails for every unique userId (best-effort — some rows
  //    already carry emails; ObjectId ones need a lookup).
  const idsToResolve = Array.from(
    new Set(
      Array.from(byRecipient.values())
        .filter((r) => /^[a-f0-9]{24}$/i.test(r.email))
        .map((r) => r.userId),
    ),
  );
  if (idsToResolve.length) {
    const users = await User.find({
      _id: { $in: idsToResolve.map((id) => new Types.ObjectId(id)) },
    })
      .select("_id email name")
      .lean();
    const emailById = new Map(
      users.map((u: any) => [String(u._id), u.email || u.name || String(u._id)]),
    );
    for (const r of byRecipient.values()) {
      const resolved = emailById.get(r.userId);
      if (resolved) r.email = resolved;
    }
  }

  // 4) Aggregated per-recipient report.
  const rows = Array.from(byRecipient.values()).sort(
    (a, b) => b.overCredit - a.overCredit,
  );
  console.log("=".repeat(100));
  console.log("OVER-CREDIT TOTALS BY RECIPIENT (across all affected invoices)");
  console.log("=".repeat(100));
  console.log(
    `${"Role".padEnd(22)}${"Recipient".padEnd(42)}${"Credited".padStart(14)}${"Over".padStart(14)}${" Cur".padStart(6)}`,
  );
  console.log("-".repeat(100));
  let totalOver = 0;
  for (const r of rows) {
    console.log(
      `${r.role.padEnd(22)}${r.email.slice(0, 40).padEnd(42)}${round2(r.credited).toFixed(2).padStart(14)}${round2(r.overCredit).toFixed(4).padStart(14)}  ${r.currency}`,
    );
    if (r.currency === "USD") totalOver += r.overCredit;
  }
  console.log("-".repeat(100));
  console.log(`Total USD over-credit: $${round2(totalOver).toFixed(4)}\n`);

  await mongoose.disconnect();
}

function addRecipient(
  map: Map<string, Recipient>,
  entry: Recipient,
): void {
  const key = `${entry.userId}::${entry.role}::${entry.currency}`;
  const existing = map.get(key);
  if (existing) {
    existing.credited += entry.credited;
    existing.overCredit += entry.overCredit;
  } else {
    map.set(key, { ...entry });
  }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
