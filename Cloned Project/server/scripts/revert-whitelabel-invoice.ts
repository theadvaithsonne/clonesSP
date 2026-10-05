/**
 * Full reversal of a wallet-paid whitelabel_addon invoice that broke
 * mid-fulfillment (no activation, no commission fired).
 *
 * Steps (all inside one mongoose session so they atomically commit or
 * atomically roll back):
 *   1. Refuse if invoice isn't `paid` + `whitelabel_addon` + paid via
 *      `store_wallet` (this script only handles that shape).
 *   2. Refuse if invoice.metadata.reversedAt is already set (idempotent).
 *   3. Refuse if any whitelabel_* commission tx exists for this invoice
 *      (partial commission → we'd need a bespoke unwind — not this script).
 *   4. Credit `totalAmount` back to the buyer's StoreWallet on the org
 *      they paid from.
 *   5. Debit `tax` from Shorupan's HQ StoreWallet (reverse the
 *      gst_collected credit).
 *   6. Set invoice.status = "refunded", refundedAt = now, and stamp
 *      metadata.reversedAt + reversalReason.
 *   7. Remove any OfficeAddonSubscription for {orgId, addonId:whitelabel}
 *      that was created BY this invoice (metadata.lastInvoiceId match).
 *
 * Usage:
 *   npx tsx src/scripts/revert-whitelabel-invoice.ts <invoiceId> "<reason>"
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { User } from "../models/user.model";
import { OfficeAddon } from "../models/officeAddon.model";
import { OfficeAddonSubscription } from "../models/officeAddonSubscription.model";
import { WHITELABEL_ADDON } from "../config/whitelabelAddon";
import { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } from "../services/commission";

async function run() {
  const [invoiceId, reasonRaw] = process.argv.slice(2);
  if (!invoiceId) {
    console.error(
      `Usage: npx tsx src/scripts/revert-whitelabel-invoice.ts <invoiceId> "<reason>"`,
    );
    process.exit(1);
  }
  const reason =
    reasonRaw?.trim() ||
    "Whitelabel add-on fulfillment failed on payment; full refund + subscription removal.";

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected`);

  const invoice: any = await Invoice.findById(invoiceId);
  if (!invoice) {
    console.error(`❌ No invoice ${invoiceId}`);
    process.exit(1);
  }
  const primary = invoice.lineItems?.[0];
  if (primary?.itemType !== "whitelabel_addon") {
    console.error(
      `❌ Refusing — invoice itemType is "${primary?.itemType}", not "whitelabel_addon"`,
    );
    process.exit(1);
  }
  if (invoice.status !== "paid") {
    console.error(
      `❌ Refusing — invoice status is "${invoice.status}", not "paid"`,
    );
    process.exit(1);
  }
  if (invoice.paymentPlatform !== "store_wallet") {
    console.error(
      `❌ Refusing — this script only reverses wallet-paid invoices. paymentPlatform="${invoice.paymentPlatform}"`,
    );
    process.exit(1);
  }
  if (invoice.metadata?.reversedAt) {
    console.error(
      `❌ Refusing — invoice was already reversed at ${invoice.metadata.reversedAt}`,
    );
    process.exit(1);
  }

  const buyerId = String(invoice.userId);
  const walletOrgId = String(invoice.metadata?.walletOrgId || invoice.organizationId);
  const totalAmountCents = invoice.totalAmount; // 70800 = $708
  const taxCents = invoice.tax || 0; // 10800 = $108
  const totalAmountUsd = totalAmountCents / 100;
  const taxUsd = taxCents / 100;

  console.log(`📄 ${invoice.invoiceNumber}`);
  console.log(`   totalAmount: ${totalAmountCents} = $${totalAmountUsd}`);
  console.log(`   tax:         ${taxCents} = $${taxUsd}`);
  console.log(`   buyer:       ${buyerId}`);
  console.log(`   walletOrgId: ${walletOrgId}`);
  console.log("");

  // Guard — refuse if ANY whitelabel_* commission tx exists (partial fulfillment).
  const partialCommission = await WalletTransaction.findOne({
    "metadata.dedupeKey": {
      $regex: new RegExp(`^whitelabel_.*${invoiceId}`),
    },
  }).lean();
  if (partialCommission) {
    console.error(
      `❌ Refusing — a whitelabel_* commission tx already exists for this invoice (dedupeKey=${(partialCommission as any).metadata?.dedupeKey}). This script does NOT unwind partial commissions — build a bespoke reverser.`,
    );
    process.exit(1);
  }

  // ─── Look up platform user + org ────────────────────────────────
  const platformUser: any = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id")
    .lean();
  if (!platformUser) {
    console.error(`❌ Platform user ${PLATFORM_USER_EMAIL} not found`);
    process.exit(1);
  }
  const platformOrg = new Types.ObjectId(PLATFORM_ORG_ID);

  // ─── Buyer's store wallet on their org ──────────────────────────
  const buyerObjectId = new Types.ObjectId(buyerId);
  const walletOrgObjectId = new Types.ObjectId(walletOrgId);
  const buyerWallet = await StoreWallet.findOne({
    userId: buyerObjectId,
    orgId: walletOrgObjectId,
  });
  if (!buyerWallet) {
    console.error(
      `❌ Buyer StoreWallet not found for (userId=${buyerId}, orgId=${walletOrgId})`,
    );
    process.exit(1);
  }

  // ─── Platform (Shorupan) HQ store wallet ────────────────────────
  const platformWallet = await StoreWallet.findOne({
    userId: platformUser._id,
    orgId: platformOrg,
  });
  if (!platformWallet) {
    console.error(`❌ Platform HQ StoreWallet not found`);
    process.exit(1);
  }
  if (taxCents > 0 && platformWallet.balance < taxUsd) {
    console.error(
      `❌ Refusing — platform HQ wallet balance $${platformWallet.balance} < GST to reverse $${taxUsd}. Fix upstream first.`,
    );
    process.exit(1);
  }

  // ─── Also look for the OfficeAddonSubscription (if any) tied to
  //     THIS invoice, so we know what we'd delete. ─────────────────
  const wlAddon = await OfficeAddon.findOne({ slug: WHITELABEL_ADDON.slug })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();
  const existingSub = wlAddon
    ? await OfficeAddonSubscription.findOne({
        orgId: new Types.ObjectId(String(invoice.organizationId)),
        addonId: wlAddon._id,
        "metadata.lastInvoiceId": invoice._id,
      })
    : null;

  console.log(`📋 Plan:`);
  console.log(`   1. Credit +$${totalAmountUsd} to buyer StoreWallet ${buyerWallet._id}`);
  if (taxCents > 0) {
    console.log(`   2. Debit  -$${taxUsd} from Shorupan HQ StoreWallet ${platformWallet._id}`);
  } else {
    console.log(`   2. (skip GST reversal — no GST on this invoice)`);
  }
  console.log(`   3. Flip invoice status → refunded`);
  console.log(
    existingSub
      ? `   4. Remove OfficeAddonSubscription ${existingSub._id} (tied to this invoice)`
      : `   4. (no matching OfficeAddonSubscription to remove)`,
  );
  console.log("");

  // ─── Execute inside a single session/transaction ────────────────
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 1. Credit buyer wallet
      const buyerBefore = buyerWallet.balance;
      const buyerAfter = Math.round((buyerBefore + totalAmountUsd) * 100) / 100;
      buyerWallet.balance = buyerAfter;
      buyerWallet.lastTransactionAt = new Date();
      await buyerWallet.save({ session });

      await WalletTransaction.create(
        [
          {
            storeWalletId: buyerWallet._id,
            walletType: "store",
            userId: buyerObjectId,
            orgId: walletOrgObjectId,
            type: "credit",
            amount: totalAmountUsd,
            currency: "USD",
            balanceBefore: buyerBefore,
            balanceAfter: buyerAfter,
            description: `Refund — Whitelabel invoice ${invoice.invoiceNumber}`,
            note: reason,
            metadata: {
              kind: "whitelabel_addon_reversal",
              invoiceId: String(invoice._id),
              invoiceNumber: invoice.invoiceNumber,
              // Idempotency guard — if we ever retry, this dedupeKey
              // prevents a second refund credit landing.
              dedupeKey: `whitelabel_refund_${invoice._id}`,
              reversalReason: reason,
            },
            status: "completed",
          },
        ],
        { session },
      );

      // 2. Debit platform wallet (GST reversal)
      if (taxCents > 0) {
        const platBefore = platformWallet.balance;
        const platAfter = Math.round((platBefore - taxUsd) * 100) / 100;
        platformWallet.balance = platAfter;
        platformWallet.lastTransactionAt = new Date();
        await platformWallet.save({ session });

        await WalletTransaction.create(
          [
            {
              storeWalletId: platformWallet._id,
              walletType: "store",
              userId: platformUser._id,
              orgId: platformOrg,
              type: "debit",
              amount: taxUsd,
              currency: "USD",
              balanceBefore: platBefore,
              balanceAfter: platAfter,
              description: `GST reversal — Whitelabel invoice ${invoice.invoiceNumber}`,
              note: `Reverses the gst_collected credit on invoice ${invoice._id}. ${reason}`,
              metadata: {
                kind: "gst_reversal",
                invoiceId: String(invoice._id),
                invoiceNumber: invoice.invoiceNumber,
                dedupeKey: `gst_reversal_${invoice._id}`,
                reversalReason: reason,
              },
              status: "completed",
            },
          ],
          { session },
        );
      }

      // 3. Flip invoice → refunded + stamp reversal metadata
      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $set: {
            status: "refunded",
            refundedAt: new Date(),
            "metadata.reversedAt": new Date(),
            "metadata.reversalReason": reason,
          },
        },
        { session },
      );

      // 4. Remove the OfficeAddonSubscription tied to this invoice (if any)
      if (existingSub) {
        await OfficeAddonSubscription.deleteOne(
          { _id: existingSub._id },
          { session },
        );
      }
    });

    console.log(`\n✅ Reversal complete.`);
    console.log(`   Invoice ${invoice.invoiceNumber} → refunded`);
    console.log(`   Buyer wallet: +$${totalAmountUsd}`);
    if (taxCents > 0) console.log(`   HQ wallet: -$${taxUsd} (GST reversal)`);
    if (existingSub) console.log(`   Removed sub ${existingSub._id}`);
  } finally {
    await session.endSession();
  }

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
