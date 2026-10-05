/**
 * One-shot: credit the $300 platform-revenue write to Shorupan HQ
 * StoreWallet for a specific whitelabel_addon (or cryptosub) invoice
 * that was fulfilled BEFORE the platform-revenue write was added.
 *
 * Idempotent via a dedupeKey — running twice is a no-op after the
 * first success.
 *
 * Usage:
 *   npx tsx src/scripts/retro-platform-revenue.ts <invoiceId>
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { User } from "../models/user.model";
import { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } from "../services/commission";
import { WHITELABEL_ADDON } from "../config/whitelabelAddon";
import { CRYPTOSUB_ADDON } from "../config/cryptosubAddon";

async function run() {
  const [id] = process.argv.slice(2);
  if (!id) {
    console.error("Usage: npx tsx src/scripts/retro-platform-revenue.ts <invoiceId>");
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected`);

  const inv: any = await Invoice.findById(id).lean();
  if (!inv) {
    console.error(`❌ No invoice ${id}`);
    process.exit(1);
  }
  const primary = inv.lineItems?.[0];
  const itemType = primary?.itemType;
  if (itemType !== "whitelabel_addon" && itemType !== "cryptosub") {
    console.error(
      `❌ Invoice itemType "${itemType}" — must be whitelabel_addon or cryptosub`,
    );
    process.exit(1);
  }
  if (inv.status !== "paid") {
    console.error(`❌ Invoice not paid (status: ${inv.status})`);
    process.exit(1);
  }

  const cfg = itemType === "whitelabel_addon" ? WHITELABEL_ADDON : CRYPTOSUB_ADDON;
  const revenueCents =
    cfg.priceUsdCents -
    (cfg.commission.directFlatUsdCents +
      cfg.commission.cascadePoolUsdCents +
      cfg.commission.platformResidualUsdCents);
  const revenueUsd = revenueCents / 100;
  const kind = itemType === "whitelabel_addon"
    ? "whitelabel_addon_platform_revenue"
    : "cryptosub_platform_revenue";
  const dedupeKey = itemType === "whitelabel_addon"
    ? `whitelabel_platform_revenue_${inv._id}`
    : `cryptosub_platform_revenue_${inv._id}`;

  console.log(`📄 ${inv.invoiceNumber}  itemType=${itemType}`);
  console.log(`   platform revenue to credit: $${revenueUsd}`);

  // Idempotency guard
  const existing = await WalletTransaction.findOne({
    "metadata.dedupeKey": dedupeKey,
  }).lean();
  if (existing) {
    console.log(`✅ Already credited (dedupeKey exists) — no-op`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const platformUser: any = await User.findOne({ email: PLATFORM_USER_EMAIL }).select("_id").lean();
  if (!platformUser) {
    console.error(`❌ Platform user not found`);
    process.exit(1);
  }
  const platformOrg = new Types.ObjectId(PLATFORM_ORG_ID);
  const wallet: any = await StoreWallet.findOne({
    userId: platformUser._id,
    orgId: platformOrg,
  });
  if (!wallet) {
    console.error(`❌ Platform HQ StoreWallet not found`);
    process.exit(1);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const before = wallet.balance;
      const after = Math.round((before + revenueUsd) * 100) / 100;
      wallet.balance = after;
      wallet.lastTransactionAt = new Date();
      await wallet.save({ session });

      await WalletTransaction.create(
        [
          {
            storeWalletId: wallet._id,
            walletType: "store",
            userId: platformUser._id,
            orgId: platformOrg,
            type: "credit",
            amount: revenueUsd,
            currency: "USD",
            balanceBefore: before,
            balanceAfter: after,
            description: `${itemType === "whitelabel_addon" ? "Whitelabel" : "Cryptosub"} add-on — platform revenue (seller take)`,
            note: `Retro platform-revenue credit for invoice ${inv.invoiceNumber}. Base $${cfg.priceUsdCents / 100} minus commission ($${(cfg.commission.directFlatUsdCents + cfg.commission.cascadePoolUsdCents + cfg.commission.platformResidualUsdCents) / 100}) = $${revenueUsd}.`,
            relatedUserId: new Types.ObjectId(String(inv.userId)),
            metadata: {
              kind,
              invoiceId: String(inv._id),
              invoiceNumber: inv.invoiceNumber,
              dedupeKey,
              retro: true,
            },
            status: "completed",
          },
        ],
        { session },
      );
    });

    console.log(`✅ Credited $${revenueUsd} to Shorupan HQ StoreWallet`);
    console.log(`   dedupeKey: ${dedupeKey}`);
  } finally {
    await session.endSession();
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
