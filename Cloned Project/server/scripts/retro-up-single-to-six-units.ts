/**
 * One-shot: convert a whitelabel/cryptosub invoice's UP cascade from a
 * SINGLE $150 distribution → SIX $25 distributions.
 *
 * Why: UP level bonuses use `points × pointValue` (fixed ¢/point), NOT
 * a % of saleAmount. A single $150 call paid level bonuses as if the
 * sale were ONE UP unit. Six $25 calls correctly scale level bonuses 6×.
 *
 * Also undoes the earlier `retro-pool-delta` script (the +$2.16 shift
 * from HQ to L1 that only patched UP-direct, not level bonuses).
 *
 * Steps (all inside one transaction):
 *   1. Undo retro-pool-delta txs (dedupeKey `<prefix>_pool_delta_<invId>`
 *      and `<prefix>_pool_delta_<invId>_platform`) if present.
 *   2. Reverse every WalletTransaction with metadata.distributionId of
 *      the old single UP distribution — restore each wallet balance.
 *   3. Mark the old UnilevelPlusDistribution as `reversed` (keep the row
 *      for audit; delete the reversal txs won't since we're inserting
 *      matched debit rows).
 * Then OUTSIDE the transaction:
 *   4. Run 6 × distributeUnilevelPlusCommission({ saleAmount: 25 }),
 *      each with paymentId `<prefix>_up_<invId>_unit_<i>`.
 *
 * Idempotent: if any unit's paymentId already exists in
 * UnilevelPlusDistribution, that unit is skipped (UP's built-in dedupe).
 *
 * Usage:
 *   npx tsx src/scripts/retro-up-single-to-six-units.ts <invoiceId>
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";
import { StoreWallet } from "../models/storeWallet.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { UnilevelPlusPlan } from "../models/unilevelPlusPlan.model";
import { UnilevelPlusDistribution } from "../models/unilevelPlusDistribution.model";

const UNIT_COUNT = 6;
const UNIT_AMOUNT_USD = 25;

async function run() {
  const [id] = process.argv.slice(2);
  if (!id) {
    console.error(
      "Usage: npx tsx src/scripts/retro-up-single-to-six-units.ts <invoiceId>",
    );
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected\n`);

  const inv: any = await Invoice.findById(id).lean();
  if (!inv) {
    console.error(`❌ No invoice ${id}`);
    process.exit(1);
  }
  const itemType = inv.lineItems?.[0]?.itemType;
  if (itemType !== "whitelabel_addon" && itemType !== "cryptosub") {
    console.error(
      `❌ itemType "${itemType}" — must be whitelabel_addon or cryptosub`,
    );
    process.exit(1);
  }
  const prefix = itemType === "whitelabel_addon" ? "whitelabel" : "cryptosub";
  const oldPaymentId = `${prefix}_up_${id}`;

  console.log(`📄 ${inv.invoiceNumber}  itemType=${itemType}`);
  console.log(`   old paymentId: ${oldPaymentId}\n`);

  const oldDist: any = await UnilevelPlusDistribution.findOne({
    paymentId: oldPaymentId,
  }).lean();
  if (!oldDist) {
    console.log(
      `⚠️  No old single UP distribution found. Skipping reversal; running 6-unit distribution.`,
    );
  } else {
    console.log(`   old distributionId: ${oldDist._id}`);
    console.log(`   old saleAmount: $${oldDist.saleAmount}`);
    console.log(
      `   old status: ${oldDist.status}${oldDist.status === "reversed" ? " (already reversed)" : ""}\n`,
    );
  }

  // ── Undo pool-delta txs (if the earlier retro-pool-delta ran) ──
  const poolDeltaKey = `${prefix}_pool_delta_${id}`;
  const poolDeltaPlatKey = `${prefix}_pool_delta_${id}_platform`;
  const poolDeltaTxs: any[] = await WalletTransaction.find({
    "metadata.dedupeKey": { $in: [poolDeltaKey, poolDeltaPlatKey] },
  }).lean();
  console.log(`Found ${poolDeltaTxs.length} pool-delta tx(s) to undo`);

  // ── Find old distribution's wallet txs (if not already reversed) ──
  const oldDistTxs: any[] =
    oldDist && oldDist.status !== "reversed"
      ? await WalletTransaction.find({
          "metadata.distributionId": oldDist._id,
        }).lean()
      : [];
  console.log(`Found ${oldDistTxs.length} old UP distribution tx(s) to reverse\n`);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // ── Reverse pool-delta txs ──
      for (const t of poolDeltaTxs) {
        if (t.walletType === "affiliate") {
          const wallet: any = await AffiliateWallet.findById(
            t.affiliateWalletId,
          ).session(session);
          if (!wallet) continue;
          // pool-delta L1 was a "commission" (credit-like); undo by debiting.
          const before = wallet.balance;
          const after = Math.round((before - t.amount) * 100) / 100;
          wallet.balance = after;
          wallet.totalEarnings =
            Math.round(((wallet.totalEarnings || 0) - t.amount) * 100) / 100;
          wallet.lastTransactionAt = new Date();
          await wallet.save({ session });
          await WalletTransaction.create(
            [
              {
                affiliateWalletId: wallet._id,
                walletType: "affiliate",
                userId: t.userId,
                type: "debit",
                amount: t.amount,
                currency: t.currency,
                balanceBefore: before,
                balanceAfter: after,
                description: `Reversal: ${t.description}`,
                note: `Superseded by 6-unit UP distribution retro for invoice ${inv.invoiceNumber}.`,
                relatedUserId: t.relatedUserId,
                metadata: {
                  kind: `${prefix}_pool_delta_reversal`,
                  invoiceId: String(id),
                  originalTxId: String(t._id),
                  dedupeKey: `${prefix}_pool_delta_reversal_${t._id}`,
                },
                status: "completed",
              },
            ],
            { session },
          );
        } else if (t.walletType === "store") {
          const wallet: any = await StoreWallet.findById(
            t.storeWalletId,
          ).session(session);
          if (!wallet) continue;
          // pool-delta platform side was a "debit"; undo by crediting back.
          const before = wallet.balance;
          const after = Math.round((before + t.amount) * 100) / 100;
          wallet.balance = after;
          wallet.lastTransactionAt = new Date();
          await wallet.save({ session });
          await WalletTransaction.create(
            [
              {
                storeWalletId: wallet._id,
                walletType: "store",
                userId: t.userId,
                orgId: t.orgId,
                type: "credit",
                amount: t.amount,
                currency: t.currency,
                balanceBefore: before,
                balanceAfter: after,
                description: `Reversal: ${t.description}`,
                note: `Superseded by 6-unit UP distribution retro for invoice ${inv.invoiceNumber}.`,
                relatedUserId: t.relatedUserId,
                metadata: {
                  kind: `${prefix}_pool_delta_reversal`,
                  invoiceId: String(id),
                  originalTxId: String(t._id),
                  dedupeKey: `${prefix}_pool_delta_reversal_${t._id}`,
                },
                status: "completed",
              },
            ],
            { session },
          );
        }
      }

      // ── Reverse old distribution wallet txs ──
      for (const t of oldDistTxs) {
        // Original tx `type` was "credit" (or "commission" on affiliate side).
        // We reverse by applying the OPPOSITE balance movement.
        const invertedType = "debit";
        const delta = t.amount;
        if (t.walletType === "affiliate") {
          const wallet: any = await AffiliateWallet.findById(
            t.affiliateWalletId,
          ).session(session);
          if (!wallet) continue;
          const before = wallet.balance;
          const after = Math.round((before - delta) * 100) / 100;
          wallet.balance = after;
          wallet.totalEarnings =
            Math.round(((wallet.totalEarnings || 0) - delta) * 100) / 100;
          wallet.lastTransactionAt = new Date();
          await wallet.save({ session });
          await WalletTransaction.create(
            [
              {
                affiliateWalletId: wallet._id,
                walletType: "affiliate",
                userId: t.userId,
                type: invertedType,
                amount: delta,
                currency: t.currency,
                balanceBefore: before,
                balanceAfter: after,
                description: `Reversal: ${t.description}`,
                note: `Old single-$150 UP distribution reversed — replaced by 6 × $25 units for invoice ${inv.invoiceNumber}.`,
                relatedUserId: t.relatedUserId,
                metadata: {
                  kind: `${prefix}_up_single_reversal`,
                  invoiceId: String(id),
                  originalTxId: String(t._id),
                  oldDistributionId: String(oldDist._id),
                  dedupeKey: `${prefix}_up_single_reversal_${t._id}`,
                },
                status: "completed",
              },
            ],
            { session },
          );
        } else if (t.walletType === "store") {
          const wallet: any = await StoreWallet.findById(
            t.storeWalletId,
          ).session(session);
          if (!wallet) continue;
          const before = wallet.balance;
          const after = Math.round((before - delta) * 100) / 100;
          wallet.balance = after;
          wallet.lastTransactionAt = new Date();
          await wallet.save({ session });
          await WalletTransaction.create(
            [
              {
                storeWalletId: wallet._id,
                walletType: "store",
                userId: t.userId,
                orgId: t.orgId,
                type: invertedType,
                amount: delta,
                currency: t.currency,
                balanceBefore: before,
                balanceAfter: after,
                description: `Reversal: ${t.description}`,
                note: `Old single-$150 UP distribution reversed — replaced by 6 × $25 units for invoice ${inv.invoiceNumber}.`,
                relatedUserId: t.relatedUserId,
                metadata: {
                  kind: `${prefix}_up_single_reversal`,
                  invoiceId: String(id),
                  originalTxId: String(t._id),
                  oldDistributionId: String(oldDist._id),
                  dedupeKey: `${prefix}_up_single_reversal_${t._id}`,
                },
                status: "completed",
              },
            ],
            { session },
          );
        }
      }

      // ── Mark old distribution as reversed (keep for audit) ──
      if (oldDist && oldDist.status !== "reversed") {
        await UnilevelPlusDistribution.updateOne(
          { _id: oldDist._id },
          {
            $set: {
              status: "reversed",
              "metadata.reversedAt": new Date(),
              "metadata.reversedReason":
                "Replaced by 6 × $25 unit distributions",
            },
          },
          { session },
        );
      }
    });

    console.log(`✅ Reversal transaction committed.\n`);
  } finally {
    await session.endSession();
  }

  // ── Run 6 × $25 distributions (OUTSIDE our session — each gets its own) ──
  console.log(`── Running ${UNIT_COUNT} × $${UNIT_AMOUNT_USD} UP distributions ──`);
  const activePlan: any = await UnilevelPlusPlan.findOne({
    isActive: true,
  })
    .select("_id")
    .lean();
  if (!activePlan) {
    console.error(`❌ No active UnilevelPlusPlan`);
    process.exit(1);
  }
  const { distributeUnilevelPlusCommission } = await import(
    "../services/unilevelPlusCommission"
  );
  const results: any[] = [];
  for (let i = 1; i <= UNIT_COUNT; i++) {
    const unitPaymentId = `${prefix}_up_${id}_unit_${i}`;
    try {
      const r = await distributeUnilevelPlusCommission({
        buyerId: String(inv.userId),
        planId: String(activePlan._id),
        saleAmount: UNIT_AMOUNT_USD,
        currency: "USD",
        paymentId: unitPaymentId,
        metadata: {
          kind: `${prefix}_up_cascade`,
          invoiceId: String(id),
          invoiceNumber: inv.invoiceNumber,
          unitIndex: i,
          unitCount: UNIT_COUNT,
          retro: true,
        },
      });
      results.push({
        unit: i,
        distributionId: String(r.distribution?._id || ""),
        company: r.companyAmount,
        direct: r.directBonusPaid,
        levels: r.levelBonusesPaid,
      });
      console.log(
        `   unit ${i}/${UNIT_COUNT}  company=$${r.companyAmount}  direct=$${r.directBonusPaid}  levels=$${r.levelBonusesPaid}`,
      );
    } catch (err: any) {
      console.error(`   unit ${i}/${UNIT_COUNT} FAILED:`, err?.message || err);
    }
  }

  // ── Stamp invoice metadata ──
  await Invoice.updateOne(
    { _id: id },
    {
      $set: {
        [`metadata.${prefix}UpRetroSixUnitsAt`]: new Date(),
        [`metadata.${prefix}CommissionBreakdown.upDistribution`]: {
          unitCount: UNIT_COUNT,
          unitAmountUsd: UNIT_AMOUNT_USD,
          totalPoolUsd: UNIT_COUNT * UNIT_AMOUNT_USD,
          units: results,
        },
      },
    },
  );
  console.log(`\n✅ Invoice metadata stamped`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
