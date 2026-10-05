/**
 * BACKFILL: Reverse the GST leak on unilevel-plus commission distributions.
 *
 * Detection rule: any distribution where `saleAmount ≈ plan.productPrice × 1.18`.
 * That's the signature of the `invoice.ts:2457` bug (fixed) where the
 * tax-inflated `invoice.totalAmount` was used as the commission base.
 *
 * Correction per flagged distribution:
 *   Only PERCENTAGE-based pool amounts are affected. Flat per-recipient
 *   amounts (infinity T1/T2 $0.60 each, pointValue $0.03) are correct.
 *
 *   For each recipient in { direct, level, manager }:
 *       overpaid = amount - (amount / 1.18)
 *   → Debit `overpaid` from the recipient's AffiliateWallet.
 *   → Emit a WalletTransaction with type=debit, description tagged so it's
 *     visible in the user's ledger.
 *
 *   Distribution record fields updated:
 *       saleAmount               → base (was total)
 *       companyAmount            → /1.18
 *       directBonusAmount        → /1.18
 *       levelBonusBudget         → /1.18
 *       levelBonusDistributed    → /1.18
 *       levelBonusRecipients[].amount → /1.18
 *       managerBonusAmount       → /1.18
 *       unallocatedAmount        → /1.18
 *       metadata.gstBackfillCorrected: true
 *       metadata.gstBackfillCorrectedAt: <iso>
 *       metadata.gstBackfillPreviousSaleAmount: <old>
 *
 * Idempotent: skips distributions already marked corrected.
 *
 * Underwater safety:
 *   If a recipient's current wallet balance < overpayment, we DO NOT allow
 *   going negative by default — that distribution is reported and skipped.
 *   Pass --allow-negative to force clawback into a negative balance.
 *
 * Company / platform user:
 *   The overpaid companyAmount lives in the platform store wallet. Debiting
 *   platform is safe by default.
 *
 * Usage:
 *   Dry run (default):
 *     npx ts-node src/scripts/backfill-up-gst-leak.ts
 *   Apply:
 *     npx ts-node src/scripts/backfill-up-gst-leak.ts --apply
 *   Apply and allow negative balances (dangerous):
 *     npx ts-node src/scripts/backfill-up-gst-leak.ts --apply --allow-negative
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
dotenv.config();

const GST_RATE = 0.18;
const GST_FACTOR = 1 + GST_RATE; // 1.18
const TOLERANCE = 0.02;

const APPLY = process.argv.includes("--apply");
const ALLOW_NEGATIVE = process.argv.includes("--allow-negative");
const RECIPIENT_EMAIL_ARG = process.argv.find((a) =>
  a.startsWith("--recipient-email=")
);
const RECIPIENT_EMAIL = RECIPIENT_EMAIL_ARG
  ? RECIPIENT_EMAIL_ARG.split("=")[1].trim().toLowerCase()
  : null;
const RECIPIENT_NAME_ARG = process.argv.find((a) =>
  a.startsWith("--recipient-name=")
);
const RECIPIENT_NAME = RECIPIENT_NAME_ARG
  ? RECIPIENT_NAME_ARG.split("=")[1].trim()
  : null;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function correct(n: number): number {
  return round2(n / GST_FACTOR);
}
function overpaid(n: number): number {
  return round2(n - n / GST_FACTOR);
}

interface UnderwaterRecipient {
  email: string;
  needed: number;
  available: number;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  console.log("═".repeat(72));
  console.log(
    `Unilevel Plus GST-leak BACKFILL — ${APPLY ? "APPLY" : "DRY RUN"}${ALLOW_NEGATIVE ? " (allow-negative)" : ""}`
  );
  console.log(`Mongo: ${mongoose.connection.host} / ${db.databaseName}`);
  if (RECIPIENT_EMAIL) console.log(`Filter: recipient email = ${RECIPIENT_EMAIL}`);
  if (RECIPIENT_NAME) console.log(`Filter: recipient name  ~ ${RECIPIENT_NAME}`);
  console.log("═".repeat(72));

  // Resolve recipient filter to a set of userIds we care about.
  let targetUserIdSet: Set<string> | null = null;
  if (RECIPIENT_EMAIL || RECIPIENT_NAME) {
    const query: any = {};
    if (RECIPIENT_EMAIL) query.email = new RegExp(`^${RECIPIENT_EMAIL}$`, "i");
    if (RECIPIENT_NAME) query.name = new RegExp(RECIPIENT_NAME, "i");
    const users = await db
      .collection("users")
      .find(query)
      .project({ _id: 1, name: 1, email: 1 })
      .toArray();
    if (users.length === 0) {
      console.log("No user matched the filter — nothing to do.");
      await mongoose.disconnect();
      return;
    }
    console.log(`Matched users:`);
    for (const u of users as any[])
      console.log(`  ${u._id}  ${u.name}  ${u.email}`);
    targetUserIdSet = new Set(users.map((u: any) => u._id.toString()));
  }

  const distFilter: any = {};
  if (targetUserIdSet) {
    const ids = Array.from(targetUserIdSet).map((s) => new Types.ObjectId(s));
    distFilter.$or = [
      { directBonusRecipientId: { $in: ids } },
      { "levelBonusRecipients.userId": { $in: ids } },
    ];
  }

  const distributions = await db
    .collection("unilevelplusdistributions")
    .find(distFilter)
    .sort({ createdAt: 1 })
    .toArray();

  const plans = await db.collection("unilevelplusplans").find({}).toArray();
  const planPriceById = new Map<string, number>();
  for (const p of plans as any[]) {
    planPriceById.set(p._id.toString(), p.productPrice);
  }

  let flaggedCount = 0;
  let correctedCount = 0;
  let skippedUnderwater = 0;
  let skippedAlreadyCorrected = 0;
  let totalReversedUsd = 0;
  const underwater: UnderwaterRecipient[] = [];

  for (const d of distributions as any[]) {
    const planPrice = planPriceById.get(d.planId?.toString?.() || "");
    if (!planPrice || planPrice <= 0) continue;

    const expectedWithGst = planPrice * GST_FACTOR;
    if (Math.abs(d.saleAmount - expectedWithGst) > TOLERANCE) continue;
    flaggedCount++;

    if (d.metadata?.gstBackfillCorrected) {
      skippedAlreadyCorrected++;
      continue;
    }
    const partialUserIds: string[] = d.metadata?.gstBackfillPartialUserIds || [];
    const alreadyPartial = (uid: Types.ObjectId): boolean =>
      partialUserIds.includes(uid.toString());

    // Build the list of (userId, description, overpayment) tuples.
    const clawbacks: Array<{
      userId: Types.ObjectId;
      overpaid: number;
      kind: string;
    }> = [];

    const matchesFilter = (id: Types.ObjectId): boolean =>
      !targetUserIdSet || targetUserIdSet.has(id.toString());

    if (
      d.directBonusRecipientId &&
      d.directBonusAmount > 0 &&
      matchesFilter(d.directBonusRecipientId) &&
      !alreadyPartial(d.directBonusRecipientId)
    ) {
      clawbacks.push({
        userId: d.directBonusRecipientId,
        overpaid: overpaid(d.directBonusAmount),
        kind: "direct",
      });
    }
    for (const r of d.levelBonusRecipients || []) {
      if (
        r.amount > 0 &&
        matchesFilter(r.userId) &&
        !alreadyPartial(r.userId)
      ) {
        clawbacks.push({
          userId: r.userId,
          overpaid: overpaid(r.amount),
          kind: `level L${r.level}`,
        });
      }
    }

    if (clawbacks.length === 0) continue;
    // managerBonusAmount is stored on the distribution but not always
    // credited to an individual — skip individual clawback for it; fix
    // will be reflected in the distribution record only.

    // Check for underwater recipients before applying anything.
    const localUnderwater: UnderwaterRecipient[] = [];
    for (const c of clawbacks) {
      const wallet = await db
        .collection("affiliatewallets")
        .findOne({ userId: c.userId });
      const balance = (wallet as any)?.balance || 0;
      if (balance < c.overpaid) {
        const u = await db
          .collection("users")
          .findOne({ _id: c.userId }, { projection: { email: 1 } });
        localUnderwater.push({
          email: (u as any)?.email || c.userId.toString(),
          needed: c.overpaid,
          available: round2(balance),
        });
      }
    }

    if (localUnderwater.length > 0 && !ALLOW_NEGATIVE) {
      console.log(
        `\n⚠️  SKIP  distribution ${d._id} — underwater recipients:`
      );
      for (const u of localUnderwater) {
        console.log(
          `   ${u.email}  needs $${u.needed}  has $${u.available}`
        );
      }
      underwater.push(...localUnderwater);
      skippedUnderwater++;
      continue;
    }

    // Everything ok — apply.
    console.log(
      `\n▸ ${d.createdAt.toISOString()}  distribution ${d._id}  plan $${planPrice}`
    );
    console.log(`   sale $${d.saleAmount} → $${correct(d.saleAmount)}`);

    if (!APPLY) {
      for (const c of clawbacks) {
        const u = await db
          .collection("users")
          .findOne({ _id: c.userId }, { projection: { email: 1 } });
        console.log(
          `   [dry] debit ${(u as any)?.email || c.userId}  $${c.overpaid}  (${c.kind})`
        );
        totalReversedUsd += c.overpaid;
      }
      correctedCount++;
      continue;
    }

    // APPLY: single mongo session per distribution (atomic per unit).
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (const c of clawbacks) {
        const wallet = await db
          .collection("affiliatewallets")
          .findOne({ userId: c.userId }, { session });
        if (!wallet) {
          console.warn(
            `   ! no wallet for ${c.userId} — skipping this recipient`
          );
          continue;
        }
        const balanceBefore = (wallet as any).balance || 0;
        const balanceAfter = round2(balanceBefore - c.overpaid);

        await db.collection("affiliatewallets").updateOne(
          { _id: (wallet as any)._id },
          {
            $set: {
              balance: balanceAfter,
              lastTransactionAt: new Date(),
            },
          },
          { session }
        );

        await db.collection("wallettransactions").insertOne(
          {
            affiliateWalletId: (wallet as any)._id,
            walletType: "affiliate",
            userId: c.userId,
            type: "debit",
            amount: c.overpaid,
            currency: "USD",
            balanceBefore,
            balanceAfter,
            description: "GST commission correction",
            note: `Reversal of GST over-distribution on UP sale ${d.paymentId}`,
            status: "completed",
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
          { session }
        );

        totalReversedUsd += c.overpaid;
        console.log(
          `   ✓ debit ${c.userId}  $${c.overpaid}  (${c.kind})  new balance $${balanceAfter}`
        );
      }

      // Correct the distribution record.
      if (!targetUserIdSet) {
        // Full-pass correction — rewrite every pool amount.
        const correctedLevelRecipients = (d.levelBonusRecipients || []).map(
          (r: any) => ({ ...r, amount: correct(r.amount) })
        );
        await db.collection("unilevelplusdistributions").updateOne(
          { _id: d._id },
          {
            $set: {
              saleAmount: correct(d.saleAmount),
              companyAmount: correct(d.companyAmount || 0),
              directBonusAmount: correct(d.directBonusAmount || 0),
              levelBonusBudget: correct(d.levelBonusBudget || 0),
              levelBonusDistributed: correct(d.levelBonusDistributed || 0),
              levelBonusRecipients: correctedLevelRecipients,
              managerBonusAmount: correct(d.managerBonusAmount || 0),
              unallocatedAmount: correct(d.unallocatedAmount || 0),
              "metadata.gstBackfillCorrected": true,
              "metadata.gstBackfillCorrectedAt": new Date().toISOString(),
              "metadata.gstBackfillPreviousSaleAmount": d.saleAmount,
            },
          },
          { session }
        );
      } else {
        // Targeted correction — only rewrite the debited recipient's line.
        const debitedIds = new Set(clawbacks.map((c) => c.userId.toString()));
        const updates: any = {};
        if (
          d.directBonusRecipientId &&
          debitedIds.has(d.directBonusRecipientId.toString())
        ) {
          updates.directBonusAmount = correct(d.directBonusAmount || 0);
        }
        if (d.levelBonusRecipients?.length) {
          updates.levelBonusRecipients = d.levelBonusRecipients.map((r: any) =>
            debitedIds.has(r.userId.toString())
              ? { ...r, amount: correct(r.amount) }
              : r
          );
        }
        const newPartial = Array.from(
          new Set([...partialUserIds, ...debitedIds])
        );
        await db.collection("unilevelplusdistributions").updateOne(
          { _id: d._id },
          {
            $set: {
              ...updates,
              "metadata.gstBackfillPartialUserIds": newPartial,
              "metadata.gstBackfillPartialCorrectedAt": new Date().toISOString(),
            },
          },
          { session }
        );
      }

      await session.commitTransaction();
      correctedCount++;
    } catch (err) {
      await session.abortTransaction();
      console.error(`   ✗ FAILED on distribution ${d._id}:`, err);
    } finally {
      session.endSession();
    }
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`Distributions flagged (GST-leaked):    ${flaggedCount}`);
  console.log(`Already corrected (skipped):           ${skippedAlreadyCorrected}`);
  console.log(`Skipped underwater:                    ${skippedUnderwater}`);
  console.log(`Corrected this run:                    ${correctedCount}`);
  console.log(
    `Total $ ${APPLY ? "reversed" : "that WOULD reverse"}:       $${round2(totalReversedUsd)}`
  );
  if (underwater.length > 0) {
    console.log(
      `\nUnderwater recipients (would go negative — rerun with --allow-negative to force):`
    );
    for (const u of underwater) {
      console.log(`  ${u.email}  needs $${u.needed}  has $${u.available}`);
    }
  }
  console.log("═".repeat(72));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
