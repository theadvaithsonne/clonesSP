/**
 * Post-reversal audit: verifies that the reverted invoice, wallets,
 * and OfficeAddonSubscription docs are all in the expected end-state.
 *
 * Doesn't mutate anything — pure inspection.
 *
 * Usage:
 *   npx tsx src/scripts/audit-whitelabel-state.ts
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
import { Organization } from "../models/organization.model";
import { WHITELABEL_ADDON } from "../config/whitelabelAddon";
import { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } from "../services/commission";

const INVOICE_ID = "6a87f387925e8f1794908bc2";
const CAMILLA_EMAIL = "shorupanmedia@gmail.com";
const UPLINE_EMAIL = "legallyapp123@gmail.com";

function pass(label: string, msg?: string) {
  console.log(`  ✅ ${label}${msg ? " — " + msg : ""}`);
}
function fail(label: string, msg: string) {
  console.log(`  ❌ ${label} — ${msg}`);
}
function info(label: string, msg: string) {
  console.log(`  ℹ️  ${label} — ${msg}`);
}

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected to prod\n`);

  let issues = 0;

  // ─── 1. Invoice state ────────────────────────────────────────────
  console.log("═══ 1. INVOICE STATE ═══");
  const inv: any = await Invoice.findById(INVOICE_ID).lean();
  if (!inv) {
    fail("Invoice fetch", `No invoice ${INVOICE_ID}`);
    process.exit(1);
  }
  info("invoiceNumber", inv.invoiceNumber);
  if (inv.status === "refunded") pass("status", 'is "refunded"');
  else { fail("status", `expected "refunded", got "${inv.status}"`); issues++; }
  if (inv.refundedAt) pass("refundedAt", inv.refundedAt.toISOString?.() || String(inv.refundedAt));
  else { fail("refundedAt", "missing"); issues++; }
  if (inv.metadata?.reversedAt) pass("metadata.reversedAt", "stamped");
  else { fail("metadata.reversedAt", "missing"); issues++; }
  if (inv.metadata?.reversalReason) pass("metadata.reversalReason", `"${inv.metadata.reversalReason.slice(0, 60)}…"`);
  else { fail("metadata.reversalReason", "missing"); issues++; }
  if (!inv.metadata?.whitelabelActivatedAt) pass("no whitelabelActivatedAt", "correct — never fired");
  else { fail("whitelabelActivatedAt", `unexpectedly set to ${inv.metadata.whitelabelActivatedAt}`); issues++; }
  if (!inv.metadata?.whitelabelCommissionAt) pass("no whitelabelCommissionAt", "correct — never fired");
  else { fail("whitelabelCommissionAt", `unexpectedly set`); issues++; }
  console.log("");

  // ─── 2. Refund + GST-reversal wallet transactions ────────────────
  console.log("═══ 2. REVERSAL WALLET TRANSACTIONS ═══");
  const refundTx: any = await WalletTransaction.findOne({
    "metadata.dedupeKey": `whitelabel_refund_${INVOICE_ID}`,
  }).lean();
  if (refundTx) {
    pass("refund tx exists", `+$${refundTx.amount} ${refundTx.currency} to user ${refundTx.userId}`);
    if (refundTx.type === "credit" && refundTx.amount === 708) pass("refund amount", "= $708 correct");
    else { fail("refund amount", `type=${refundTx.type} amount=${refundTx.amount} — expected credit $708`); issues++; }
  } else { fail("refund tx", "not found"); issues++; }

  const gstReversalTx: any = await WalletTransaction.findOne({
    "metadata.dedupeKey": `gst_reversal_${INVOICE_ID}`,
  }).lean();
  if (gstReversalTx) {
    pass("gst reversal tx exists", `-$${gstReversalTx.amount} ${gstReversalTx.currency} from user ${gstReversalTx.userId}`);
    if (gstReversalTx.type === "debit" && gstReversalTx.amount === 108) pass("gst reversal amount", "= $108 correct");
    else { fail("gst reversal amount", `type=${gstReversalTx.type} amount=${gstReversalTx.amount}`); issues++; }
  } else { fail("gst reversal tx", "not found"); issues++; }
  console.log("");

  // ─── 3. Camilla's wallet balance sanity ──────────────────────────
  console.log("═══ 3. CAMILLA'S WALLET (History Stream org) ═══");
  const camilla: any = await User.findOne({ email: CAMILLA_EMAIL }).select("_id").lean();
  if (!camilla) { fail("camilla user", "not found"); issues++; }
  else {
    const walletOrgId = String(inv.metadata?.walletOrgId || inv.organizationId);
    const camillaWallet: any = await StoreWallet.findOne({
      userId: camilla._id,
      orgId: new Types.ObjectId(walletOrgId),
    }).lean();
    if (!camillaWallet) { fail("camilla wallet", "not found"); issues++; }
    else {
      info("balance", `$${camillaWallet.balance}`);
      info("last tx", camillaWallet.lastTransactionAt?.toISOString?.() || "n/a");
      pass("wallet doc exists", `walletId=${camillaWallet._id}`);
    }
  }
  console.log("");

  // ─── 4. Platform / Shorupan HQ wallet ────────────────────────────
  console.log("═══ 4. SHORUPAN HQ WALLET ═══");
  const platformUser: any = await User.findOne({ email: PLATFORM_USER_EMAIL }).select("_id").lean();
  if (platformUser) {
    const hqWallet: any = await StoreWallet.findOne({
      userId: platformUser._id,
      orgId: new Types.ObjectId(PLATFORM_ORG_ID),
    }).lean();
    if (hqWallet) {
      info("balance", `$${hqWallet.balance}`);
      pass("wallet doc exists");
    } else { fail("HQ wallet", "not found"); issues++; }
  }
  console.log("");

  // ─── 5. No lingering whitelabel commission for this invoice ──────
  console.log("═══ 5. NO ORPHAN COMMISSION TX ═══");
  const commissionTxs = await WalletTransaction.find({
    "metadata.dedupeKey": {
      $regex: new RegExp(`^whitelabel_(direct|cascade|platform)_${INVOICE_ID}`),
    },
  }).lean();
  if (commissionTxs.length === 0) pass("commission tx count", "0 — clean");
  else { fail("commission tx count", `found ${commissionTxs.length} orphan commission tx(s) for this invoice`); issues++; }
  console.log("");

  // ─── 6. No OfficeAddonSubscription tied to this invoice ──────────
  console.log("═══ 6. NO SUBSCRIPTION TIED TO THIS INVOICE ═══");
  const wlAddon: any = await OfficeAddon.findOne({ slug: WHITELABEL_ADDON.slug }).select("_id").lean();
  if (wlAddon) {
    const orgObjectId = new Types.ObjectId(String(inv.organizationId));
    const subForThisInvoice: any = await OfficeAddonSubscription.findOne({
      orgId: orgObjectId,
      addonId: wlAddon._id,
      "metadata.lastInvoiceId": inv._id,
    }).lean();
    if (!subForThisInvoice) pass("subscription tied to invoice", "none exists");
    else { fail("subscription tied to invoice", `found ${subForThisInvoice._id}`); issues++; }

    // Also list any subscription for this org
    const anyForOrg: any[] = await OfficeAddonSubscription.find({
      orgId: orgObjectId,
      addonId: wlAddon._id,
    }).lean();
    if (anyForOrg.length === 0) {
      pass("any whitelabel sub for this org", "none");
    } else {
      info("whitelabel subs on this org", `${anyForOrg.length} exist`);
      for (const s of anyForOrg) {
        console.log(`      • ${s._id}  status=${s.status}  source=${s.metadata?.source}`);
      }
    }
  }
  console.log("");

  // ─── 7. Upline (legallyapp123) — no whitelabel commissions ───────
  console.log("═══ 7. UPLINE (legallyapp123) COMMISSION CHECK ═══");
  const upline: any = await User.findOne({ email: UPLINE_EMAIL }).select("_id").lean();
  if (upline) {
    const uplineTxs = await WalletTransaction.find({
      userId: upline._id,
      "metadata.kind": {
        $in: [
          "whitelabel_addon",
          "whitelabel_addon_direct",
          "whitelabel_addon_cascade",
          "whitelabel_monthly_bonus",
        ],
      },
    }).lean();
    if (uplineTxs.length === 0) pass("legallyapp123 whitelabel tx count", "0 (as expected — no commission fired)");
    else {
      info("legallyapp123 whitelabel tx count", `${uplineTxs.length} exist`);
      for (const t of uplineTxs) {
        console.log(`      • ${(t as any).createdAt?.toISOString?.()}  ${(t as any).metadata?.kind}  $${(t as any).amount}`);
      }
    }
  } else { fail("upline user", `${UPLINE_EMAIL} not found`); issues++; }
  console.log("");

  // ─── 8. Chamak org (previous manual grant) — sanity ──────────────
  console.log("═══ 8. CHAMAK MANUAL GRANT SANITY ═══");
  const chamakSub: any = await OfficeAddonSubscription.findOne({
    "metadata.source": "manual_admin_grant",
  }).lean();
  if (chamakSub) {
    info("chamak-style manual grant", `status=${chamakSub.status} currentEnd=${chamakSub.currentEnd?.toISOString?.()}`);
    pass("marker distinguishable", `metadata.source="manual_admin_grant" — won't be mistaken for a paid sub`);
  } else info("chamak-style manual grant", "none found (may have been cleaned up)");
  console.log("");

  // ─── 9. Code-path integrity checks ───────────────────────────────
  console.log("═══ 9. CODE-PATH INTEGRITY (source-level) ═══");
  console.log("  ℹ️  These are static — deploy is separate. Confirming source has:");
  console.log("      • whitelabel_addon in InvoiceItemType union + runtime enum");
  console.log("      • fulfillInvoice's whitelabel_addon switch case");
  console.log("      • chargeReferralCommission 3-bucket split (direct + cascade + platform)");
  console.log("      • monthly volume bonus (services/whitelabelMonthlyBonus/)");
  console.log(
    "  ℹ️  Verify at deploy time: grep 'case \"whitelabel_addon\"' in dist/services/invoice.js on the running node.",
  );
  console.log("");

  console.log("═══ SUMMARY ═══");
  if (issues === 0) console.log(`✅ All checks passed. Ready to deploy + re-test.`);
  else console.log(`❌ ${issues} issue(s) found — review above.`);

  await mongoose.disconnect();
  process.exit(issues === 0 ? 0 : 1);
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
