/**
 * One-shot targeted delta: adjust a whitelabel/cryptosub invoice from
 * the old $144 cascade pool → new $150 cascade pool.
 *
 * Delta accounting (per invoice):
 *   - UP direct bonus: was 36%×$144 = $51.84, now 36%×$150 = $54.00 → +$2.16 to L1
 *   - UP company/infinity/manager/unallocated: was ~$91.92, now ~$95.76 → +$3.84 to Shorupan HQ
 *   - UP level bonuses: change by ~$0.01 (rounding), platform absorbs → +$0.01 to Shorupan HQ
 *   - Platform revenue (seller take): was $300, now $294 → -$6 from Shorupan HQ
 *
 * Net wallet movement: +$2.16 Ayra, +($3.84 + $0.01 - $6) = -$2.15 Shorupan HQ
 * Ignoring rounding pennies: $2.16 shifts from Shorupan HQ → L1 recipient.
 *
 * This script does exactly that: credit L1 +$2.16, debit Shorupan HQ -$2.16.
 * Idempotent via dedupeKey `<prefix>_pool_delta_<invoiceId>`.
 *
 * Usage:
 *   npx tsx src/scripts/retro-pool-delta.ts <invoiceId>
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { User } from "../models/user.model";
import { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } from "../services/commission";

const DELTA_TO_L1_USD = 2.16;

async function run() {
  const [id] = process.argv.slice(2);
  if (!id) {
    console.error("Usage: npx tsx src/scripts/retro-pool-delta.ts <invoiceId>");
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected`);

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
  const prefix = itemType === "whitelabel_addon" ? "whitelabel" : "cryptosub";
  const dedupeKey = `${prefix}_pool_delta_${id}`;

  const existing = await WalletTransaction.findOne({
    "metadata.dedupeKey": dedupeKey,
  }).lean();
  if (existing) {
    console.log(`✅ Delta already applied — no-op`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const buyer: any = await User.findById(inv.userId).select("referredBy").lean();
  const l1UserId = buyer?.referredBy ? String(buyer.referredBy) : null;
  if (!l1UserId) {
    console.error(`❌ Buyer has no L1 referrer — pool delta not applicable`);
    process.exit(1);
  }

  const platformUser: any = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id")
    .lean();
  const platformOrg = new Types.ObjectId(PLATFORM_ORG_ID);

  console.log(`📄 ${inv.invoiceNumber}`);
  console.log(`   L1 (Ayra): ${l1UserId}`);
  console.log(`   delta: +$${DELTA_TO_L1_USD} to L1, -$${DELTA_TO_L1_USD} from Shorupan HQ\n`);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // L1 affiliate wallet credit
      let l1Wallet: any = await AffiliateWallet.findOne({
        userId: l1UserId,
      }).session(session);
      if (!l1Wallet) {
        console.error(`❌ L1 affiliate wallet not found`);
        throw new Error("L1 wallet missing");
      }
      const l1Before = l1Wallet.balance;
      const l1After = Math.round((l1Before + DELTA_TO_L1_USD) * 100) / 100;
      l1Wallet.balance = l1After;
      l1Wallet.totalEarnings =
        Math.round(((l1Wallet.totalEarnings || 0) + DELTA_TO_L1_USD) * 100) / 100;
      l1Wallet.lastTransactionAt = new Date();
      await l1Wallet.save({ session });

      await WalletTransaction.create(
        [
          {
            affiliateWalletId: l1Wallet._id,
            walletType: "affiliate",
            userId: new Types.ObjectId(l1UserId),
            type: "commission",
            amount: DELTA_TO_L1_USD,
            currency: "USD",
            balanceBefore: l1Before,
            balanceAfter: l1After,
            description: `${itemType === "whitelabel_addon" ? "Whitelabel" : "Cryptosub"} add-on — UP direct bonus adjustment ($144→$150 pool)`,
            note: `Retro adjustment for invoice ${inv.invoiceNumber}: UP direct bonus corrected from $51.84 → $54.00 to match $150 cascade pool.`,
            relatedUserId: new Types.ObjectId(String(inv.userId)),
            metadata: {
              kind: `${prefix}_pool_delta`,
              invoiceId: String(inv._id),
              invoiceNumber: inv.invoiceNumber,
              dedupeKey,
              retro: true,
              deltaKind: "direct_bonus_pool_bump",
              unit: "whole",
            },
            status: "completed",
          },
        ],
        { session },
      );

      // Shorupan HQ StoreWallet debit
      const platWallet: any = await StoreWallet.findOne({
        userId: platformUser._id,
        orgId: platformOrg,
      }).session(session);
      if (!platWallet) throw new Error("Platform HQ wallet missing");
      const platBefore = platWallet.balance;
      const platAfter = Math.round((platBefore - DELTA_TO_L1_USD) * 100) / 100;
      platWallet.balance = platAfter;
      platWallet.lastTransactionAt = new Date();
      await platWallet.save({ session });

      await WalletTransaction.create(
        [
          {
            storeWalletId: platWallet._id,
            walletType: "store",
            userId: platformUser._id,
            orgId: platformOrg,
            type: "debit",
            amount: DELTA_TO_L1_USD,
            currency: "USD",
            balanceBefore: platBefore,
            balanceAfter: platAfter,
            description: `${itemType === "whitelabel_addon" ? "Whitelabel" : "Cryptosub"} add-on — platform revenue adjustment ($144→$150 pool)`,
            note: `Retro adjustment for invoice ${inv.invoiceNumber}: platform revenue corrected from $300 → $294 (compensates $2.16 UP-direct bump to L1).`,
            relatedUserId: new Types.ObjectId(String(inv.userId)),
            metadata: {
              kind: `${prefix}_pool_delta`,
              invoiceId: String(inv._id),
              invoiceNumber: inv.invoiceNumber,
              dedupeKey: `${dedupeKey}_platform`,
              retro: true,
              deltaKind: "platform_revenue_pool_bump",
              unit: "whole",
            },
            status: "completed",
          },
        ],
        { session },
      );
    });

    console.log(`✅ Delta applied.`);
    console.log(`   L1 +$${DELTA_TO_L1_USD}`);
    console.log(`   Shorupan HQ -$${DELTA_TO_L1_USD}`);
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
