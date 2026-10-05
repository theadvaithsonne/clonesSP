/**
 * One-shot: migrate a whitelabel/cryptosub invoice from the old
 * depth-weighted cascade + platform-absorbed layout to the new
 * UP-formula cascade layout.
 *
 * For the ONE invoice already paid before the fix:
 *   - Reverses the old cascade credits (L1..L6 depth-weighted).
 *   - Reverses the old platform residual (which had L4..L6 absorbed).
 *   - Runs distributeUnilevelPlusCommission on the $144 pool for the fresh split.
 *   - Credits the new $6 baseline platform residual.
 *   - Leaves the $150 direct AND the $300 platform revenue untouched
 *     (both already correct under both models).
 *
 * Idempotent — checks if the UP distribution already exists for the invoice.
 *
 * Usage:
 *   npx tsx src/scripts/retro-migrate-cascade-to-up.ts <invoiceId>
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";
import { StoreWallet } from "../models/storeWallet.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { User } from "../models/user.model";
import { UnilevelPlusPlan } from "../models/unilevelPlusPlan.model";
import { UnilevelPlusDistribution } from "../models/unilevelPlusDistribution.model";
import { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } from "../services/commission";
import { WHITELABEL_ADDON } from "../config/whitelabelAddon";
import { CRYPTOSUB_ADDON } from "../config/cryptosubAddon";

async function run() {
  const [id] = process.argv.slice(2);
  if (!id) {
    console.error("Usage: npx tsx src/scripts/retro-migrate-cascade-to-up.ts <invoiceId>");
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
    console.error(`❌ itemType "${itemType}" — must be whitelabel_addon or cryptosub`);
    process.exit(1);
  }
  const cfg = itemType === "whitelabel_addon" ? WHITELABEL_ADDON : CRYPTOSUB_ADDON;
  const prefix = itemType === "whitelabel_addon" ? "whitelabel" : "cryptosub";
  const upPaymentId = `${prefix}_up_${inv._id}`;

  console.log(`📄 ${inv.invoiceNumber}  itemType=${itemType}`);

  // Idempotency check: UP already ran?
  const upDist = await UnilevelPlusDistribution.findOne({ paymentId: upPaymentId }).lean();
  if (upDist) {
    console.log(`✅ UP distribution already exists for this invoice — no-op`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── STEP 1: Find old cascade + platform-residual txs and REVERSE them ──
  const oldCascadeTxs: any[] = await WalletTransaction.find({
    "metadata.dedupeKey": {
      $regex: new RegExp(`^${prefix}_cascade_${inv._id}(_L\\d+)?(_platform_lock)?$`),
    },
  }).lean();
  const oldPlatformResidualTx: any = await WalletTransaction.findOne({
    "metadata.dedupeKey": `${prefix}_platform_${inv._id}`,
  }).lean();

  console.log(`Found ${oldCascadeTxs.length} old cascade txs to reverse`);
  console.log(`Found old platform residual tx: ${!!oldPlatformResidualTx}`);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const t of oldCascadeTxs) {
        // Reverse each: apply the opposite type/amount on the same wallet.
        // We ADD a new "reversal" tx and adjust the wallet balance.
        if (t.walletType === "affiliate") {
          const wallet: any = await AffiliateWallet.findById(t.affiliateWalletId).session(session);
          if (wallet) {
            const before = wallet.balance;
            const after = Math.round((before - t.amount) * 100) / 100;
            wallet.balance = after;
            wallet.totalEarnings = Math.round(((wallet.totalEarnings || 0) - t.amount) * 100) / 100;
            wallet.lastTransactionAt = new Date();
            await wallet.save({ session });
            await WalletTransaction.create([{
              affiliateWalletId: wallet._id,
              walletType: "affiliate",
              userId: t.userId,
              type: "debit",
              amount: t.amount,
              currency: t.currency,
              balanceBefore: before,
              balanceAfter: after,
              description: `Reversal: ${t.description}`,
              note: `Retro migration to UP-formula cascade. Reverses original tx ${t._id}.`,
              relatedUserId: t.relatedUserId,
              metadata: {
                kind: `${prefix}_cascade_reversal`,
                invoiceId: String(inv._id),
                originalTxId: String(t._id),
                dedupeKey: `${prefix}_cascade_reversal_${t._id}`,
              },
              status: "completed",
            }], { session });
          }
        } else if (t.walletType === "store") {
          // Platform-lock mirror on Shorupan HQ.
          const wallet: any = await StoreWallet.findById(t.storeWalletId).session(session);
          if (wallet) {
            const before = wallet.balance;
            const after = Math.round((before - t.amount) * 100) / 100;
            wallet.balance = after;
            wallet.lastTransactionAt = new Date();
            await wallet.save({ session });
            await WalletTransaction.create([{
              storeWalletId: wallet._id,
              walletType: "store",
              userId: t.userId,
              orgId: t.orgId,
              type: "debit",
              amount: t.amount,
              currency: t.currency,
              balanceBefore: before,
              balanceAfter: after,
              description: `Reversal: ${t.description}`,
              note: `Retro migration to UP-formula cascade. Reverses original tx ${t._id}.`,
              relatedUserId: t.relatedUserId,
              metadata: {
                kind: `${prefix}_cascade_reversal`,
                invoiceId: String(inv._id),
                originalTxId: String(t._id),
                dedupeKey: `${prefix}_cascade_reversal_${t._id}`,
              },
              status: "completed",
            }], { session });
          }
        }
      }

      // Reverse the old platform residual (Shorupan HQ StoreWallet debit).
      if (oldPlatformResidualTx) {
        const wallet: any = await StoreWallet.findById(oldPlatformResidualTx.storeWalletId).session(session);
        if (wallet) {
          const before = wallet.balance;
          const after = Math.round((before - oldPlatformResidualTx.amount) * 100) / 100;
          wallet.balance = after;
          wallet.lastTransactionAt = new Date();
          await wallet.save({ session });
          await WalletTransaction.create([{
            storeWalletId: wallet._id,
            walletType: "store",
            userId: oldPlatformResidualTx.userId,
            orgId: oldPlatformResidualTx.orgId,
            type: "debit",
            amount: oldPlatformResidualTx.amount,
            currency: oldPlatformResidualTx.currency,
            balanceBefore: before,
            balanceAfter: after,
            description: `Reversal: ${oldPlatformResidualTx.description}`,
            note: `Retro migration to UP-formula cascade. Old platform residual had absorbed missing chain levels; new residual is just $6 baseline (UP handles its own unspent routing).`,
            relatedUserId: oldPlatformResidualTx.relatedUserId,
            metadata: {
              kind: `${prefix}_platform_reversal`,
              invoiceId: String(inv._id),
              originalTxId: String(oldPlatformResidualTx._id),
              dedupeKey: `${prefix}_platform_reversal_${oldPlatformResidualTx._id}`,
            },
            status: "completed",
          }], { session });
        }
      }

      // ── STEP 2: Credit the NEW $6 baseline platform residual. ──
      // Different dedupeKey suffix than the old one so no collision.
      const platformUser: any = await User.findOne({ email: PLATFORM_USER_EMAIL }).select("_id").lean();
      if (platformUser) {
        const platformOrg = new Types.ObjectId(PLATFORM_ORG_ID);
        let platWallet: any = await StoreWallet.findOne({
          userId: platformUser._id,
          orgId: platformOrg,
        }).session(session);
        if (platWallet) {
          const baselineUsd = cfg.commission.platformResidualUsdCents / 100;
          const before = platWallet.balance;
          const after = Math.round((before + baselineUsd) * 100) / 100;
          platWallet.balance = after;
          platWallet.lastTransactionAt = new Date();
          await platWallet.save({ session });
          await WalletTransaction.create([{
            storeWalletId: platWallet._id,
            walletType: "store",
            userId: platformUser._id,
            orgId: platformOrg,
            type: "credit",
            amount: baselineUsd,
            currency: "USD",
            balanceBefore: before,
            balanceAfter: after,
            description: `${itemType === "whitelabel_addon" ? "Whitelabel" : "Cryptosub"} add-on — platform residual (baseline, retro)`,
            note: `Retro-issued $6 baseline residual for invoice ${inv.invoiceNumber} after cascade migration.`,
            relatedUserId: new Types.ObjectId(String(inv.userId)),
            metadata: {
              kind: `${prefix}_platform`,
              invoiceId: String(inv._id),
              invoiceNumber: inv.invoiceNumber,
              retro: true,
              dedupeKey: `${prefix}_platform_baseline_${inv._id}`,
            },
            status: "completed",
          }], { session });
        }
      }
    });

    console.log(`✅ Reversals done + $6 baseline residual credited`);
  } finally {
    await session.endSession();
  }

  // ── STEP 3: Run UP distribution on $144 (OUTSIDE our session). ──
  console.log(`\n── Running UP distribution on $${cfg.commission.cascadePoolUsdCents / 100} ──`);
  const activePlan: any = await UnilevelPlusPlan.findOne({ isActive: true }).select("_id").lean();
  if (!activePlan) {
    console.error(`❌ No active UnilevelPlusPlan`);
    process.exit(1);
  }
  const { distributeUnilevelPlusCommission } = await import("../services/unilevelPlusCommission");
  const upResult = await distributeUnilevelPlusCommission({
    buyerId: String(inv.userId),
    planId: String(activePlan._id),
    saleAmount: cfg.commission.cascadePoolUsdCents / 100,
    currency: "USD",
    paymentId: upPaymentId,
    metadata: {
      kind: `${prefix}_up_cascade`,
      invoiceId: String(inv._id),
      invoiceNumber: inv.invoiceNumber,
      retro: true,
    },
  });

  console.log(`✅ UP distribution complete`);
  console.log(`   distributionId: ${upResult.distribution?._id}`);
  console.log(`   companyAmount:  $${upResult.companyAmount}`);
  console.log(`   directBonusPaid: $${upResult.directBonusPaid}`);
  console.log(`   levelBonusesPaid: $${upResult.levelBonusesPaid}`);

  // Stamp invoice metadata to mark migration.
  await Invoice.updateOne(
    { _id: inv._id },
    {
      $set: {
        [`metadata.${prefix}CommissionRetroMigratedAt`]: new Date(),
        [`metadata.${prefix}CommissionBreakdown.upCascadePool`]: cfg.commission.cascadePoolUsdCents / 100,
        [`metadata.${prefix}CommissionBreakdown.upDistribution`]: {
          distributionId: String(upResult.distribution?._id || ""),
          companyAmount: upResult.companyAmount,
          directBonusPaid: upResult.directBonusPaid,
          levelBonusesPaid: upResult.levelBonusesPaid,
        },
      },
    },
  );

  console.log(`✅ Invoice metadata stamped`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
