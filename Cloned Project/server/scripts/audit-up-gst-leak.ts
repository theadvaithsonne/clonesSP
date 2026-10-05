/**
 * Audit unilevel-plus commission distributions where GST was passed as
 * the sale amount (bug fixed in services/invoice.ts:2457). For every
 * distribution whose `saleAmount` looks like `plan.productPrice × 1.18`,
 * print the recipient breakdown and per-recipient overage.
 *
 * Read-only. Prints a report — no wallet mutation.
 *
 * Run: npx ts-node src/scripts/audit-up-gst-leak.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
dotenv.config();

const GST_RATE = 0.18;
const TOLERANCE = 0.02; // detection tolerance vs productPrice × 1.18

interface FlaggedRow {
  distributionId: string;
  createdAt: Date;
  planPrice: number;
  saleAmount: number;
  overageFactor: number;
  overageUsd: number;
  paymentId: string;
  source?: string;
  recipients: Array<{
    userEmail: string;
    kind: string;
    amount: number;
    overpaidBy: number;
  }>;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  console.log("=".repeat(72));
  console.log("Unilevel Plus GST-leak audit");
  console.log(`Mongo: ${mongoose.connection.host} / ${db.databaseName}`);
  console.log("=".repeat(72));

  const distributions = await db
    .collection("unilevelplusdistributions")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  const plans = await db.collection("unilevelplusplans").find({}).toArray();
  const planPriceById = new Map<string, number>();
  for (const p of plans as any[]) {
    planPriceById.set(p._id.toString(), p.productPrice);
  }

  const flagged: FlaggedRow[] = [];

  for (const d of distributions as any[]) {
    const planPrice = planPriceById.get(d.planId?.toString?.() || "");
    if (!planPrice || planPrice <= 0) continue;

    const factor = d.saleAmount / planPrice;
    const expectedWithGst = planPrice * (1 + GST_RATE);
    if (Math.abs(d.saleAmount - expectedWithGst) > TOLERANCE) continue;

    // Already fully corrected — skip entirely.
    if (d.metadata?.gstBackfillCorrected) continue;

    // Partially corrected — exclude those userIds from the leaked list.
    const partialIds: string[] = d.metadata?.gstBackfillPartialUserIds || [];
    const isCorrected = (id: any): boolean =>
      partialIds.includes(id.toString());

    // build recipient list with overpaid amounts
    const recipients: FlaggedRow["recipients"] = [];

    // direct bonus
    if (
      d.directBonusRecipientId &&
      d.directBonusAmount > 0 &&
      !isCorrected(d.directBonusRecipientId)
    ) {
      const u = await db
        .collection("users")
        .findOne(
          { _id: d.directBonusRecipientId },
          { projection: { email: 1 } }
        );
      const correct = d.directBonusAmount / factor;
      recipients.push({
        userEmail: (u as any)?.email || "?",
        kind: "direct",
        amount: d.directBonusAmount,
        overpaidBy: Math.round((d.directBonusAmount - correct) * 100) / 100,
      });
    }

    for (const r of d.levelBonusRecipients || []) {
      if (isCorrected(r.userId)) continue;
      const u = await db
        .collection("users")
        .findOne({ _id: r.userId }, { projection: { email: 1 } });
      const correct = r.amount / factor;
      recipients.push({
        userEmail: (u as any)?.email || "?",
        kind: `level L${r.level} leg${r.legNumber}`,
        amount: r.amount,
        overpaidBy: Math.round((r.amount - correct) * 100) / 100,
      });
    }
    for (const r of d.infinityTier1Recipients || []) {
      const u = await db
        .collection("users")
        .findOne({ _id: r.userId }, { projection: { email: 1 } });
      // infinity is a per-recipient flat, not percentage — no scaling leak
      recipients.push({
        userEmail: (u as any)?.email || "?",
        kind: "infT1",
        amount: r.amount,
        overpaidBy: 0,
      });
    }
    for (const r of d.infinityTier2Recipients || []) {
      const u = await db
        .collection("users")
        .findOne({ _id: r.userId }, { projection: { email: 1 } });
      recipients.push({
        userEmail: (u as any)?.email || "?",
        kind: "infT2",
        amount: r.amount,
        overpaidBy: 0,
      });
    }

    flagged.push({
      distributionId: d._id.toString(),
      createdAt: d.createdAt,
      planPrice,
      saleAmount: d.saleAmount,
      overageFactor: factor,
      overageUsd:
        Math.round(recipients.reduce((s, r) => s + r.overpaidBy, 0) * 100) /
        100,
      paymentId: d.paymentId,
      source: d.metadata?.source,
      recipients,
    });
  }

  console.log(`\nDistributions flagged: ${flagged.length}`);
  console.log("─".repeat(72));

  let totalOverpaid = 0;
  const byUser = new Map<string, number>();

  for (const f of flagged) {
    console.log(
      `\n▸ ${f.createdAt.toISOString()}  plan $${f.planPrice} → saleAmount $${f.saleAmount}  (×${f.overageFactor.toFixed(3)})`
    );
    console.log(
      `  distributionId ${f.distributionId}  payment ${f.paymentId}  source ${f.source ?? "-"}`
    );
    console.log(`  total overpaid: $${f.overageUsd}`);
    for (const r of f.recipients) {
      if (r.overpaidBy > 0) {
        byUser.set(r.userEmail, (byUser.get(r.userEmail) || 0) + r.overpaidBy);
        totalOverpaid += r.overpaidBy;
        console.log(
          `    · ${r.userEmail.padEnd(40)} ${r.kind.padEnd(20)} paid $${r.amount}  overpaid $${r.overpaidBy}`
        );
      }
    }
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`Per-user total overpaid:`);
  const sorted = Array.from(byUser.entries()).sort((a, b) => b[1] - a[1]);
  for (const [email, amt] of sorted) {
    console.log(`  ${email.padEnd(40)} $${(Math.round(amt * 100) / 100).toFixed(2)}`);
  }
  console.log(`\nGRAND TOTAL over-distributed: $${(Math.round(totalOverpaid * 100) / 100).toFixed(2)}`);
  console.log(`Distributions flagged: ${flagged.length}`);
  console.log("═".repeat(72));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
