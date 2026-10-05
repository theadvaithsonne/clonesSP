/**
 * Put a TEST account (App Store review, QA) into the fully-onboarded state a
 * real affiliate reaches after completing their profile and taking the combo
 * offer — without a card, an OTP, or anyone getting paid.
 *
 *   1. Profile complete: name, an Indian location, a verified +91 number.
 *   2. Unilevel Plus licence: a $0 UP invoice, marked paid and fulfilled by
 *      the real `fulfillInvoice` path. The line is priced at 0 (not
 *      discounted from $25) so `subtotal` is 0 and fulfilment SKIPS the
 *      commission run — a comped test seat must not pay the upline $25.
 *   3. NetworkChain subscription: `activateComboFreeFirstMonth`, the exact
 *      free-first-month path a combo buyer takes. Fulfilment fires the
 *      partner webhook and NetworkChains flips `networkchain_subscriptions`
 *      to active for a month. Cycle 2 will be minted by the cron and, with
 *      no card on file, sit unpaid — fine for a review account.
 *
 * Every step is idempotent: an existing licence / subscription / verified
 * phone is left alone and reported.
 *
 *   npx tsx src/scripts/setup-test-account.ts <email> --phone +91XXXXXXXXXX [--name "…"]            (dry run)
 *   npx tsx src/scripts/setup-test-account.ts <email> --phone +91XXXXXXXXXX [--name "…"] --apply
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose, { Types } from "mongoose";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const APPLY = process.argv.includes("--apply");
const EMAIL = (process.argv[2] || "").trim().toLowerCase();
const PHONE = (arg("--phone") || "").trim();
const NAME_ARG = arg("--name");

const PLATFORM_ORG_ID = "68f1fe05876fcc5fadb61951";
const LOCATION = { country: "India", state: "Karnataka", city: "Bengaluru", postalCode: "560001" };

(async () => {
  // --phone is optional: an account that already has a complete profile and a
  // verified number keeps it untouched (step 1 is skipped). It is required
  // when the profile is incomplete, since that is what completes it.
  if (!EMAIL || !EMAIL.includes("@") || (PHONE && !/^\+91\d{10}$/.test(PHONE))) {
    console.error("Usage: setup-test-account.ts <email> [--phone +91XXXXXXXXXX] [--name ...] [--apply]");
    process.exit(1);
  }
  // autoIndex off: user.model declares a unique phone index that must not be
  // (re)built on production by a one-off script.
  await mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false });
  const { User } = await import("../models/user.model");
  const { Invoice } = await import("../models/invoice.model");
  const { UnilevelPlusPurchase } = await import("../models/unilevelPlusPurchase.model");
  const { NcSubscription } = await import("../models/ncSubscription.model");
  const { createInvoice, fulfillInvoice } = await import("../services/invoice");
  const { PLATFORM_USER_EMAIL } = await import("../services/commission");
  const { UNILEVEL_PLUS_PLAN_ID, UNILEVEL_PLUS_PLAN_CONFIG } = await import("../models/unilevelPlusPlan.model");
  const { resolveComboClient, comboClientProblem } = await import("../services/comboClient");
  const { activateComboFreeFirstMonth } = await import("../services/comboActivation");
  const { refreshTypeFlags } = await import("../services/downlineTree");

  const user: any = await User.findOne({ email: EMAIL });
  if (!user) {
    console.error(`No user ${EMAIL}`);
    process.exit(1);
  }
  console.log(APPLY ? "=== APPLY ===" : "=== DRY RUN — pass --apply to write ===");
  console.log(`User: ${user.name || "(no name)"} <${user.email}> ${user._id}`);

  // ── 1. Profile ──────────────────────────────────────────────────────────
  const name =
    NAME_ARG ||
    user.name ||
    EMAIL.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const profileAlreadyDone = !!user.profileComplete && !!user.phoneVerified && !!user.phone;
  if (profileAlreadyDone && !PHONE) {
    console.log(`\n1. Profile: already complete (${user.phone}, ${user.city || "?"}/${user.country || "?"}) — untouched`);
  } else {
    if (!PHONE) {
      console.error("ABORT — profile is incomplete; pass --phone +91XXXXXXXXXX to complete it");
      process.exit(1);
    }
    const holder: any = await User.findOne({ phone: PHONE, _id: { $ne: user._id } }).select("email").lean();
    if (holder) {
      console.error(`ABORT — ${PHONE} is already on ${holder.email}`);
      process.exit(1);
    }
    const profileSet: Record<string, any> = {
      name,
      ...LOCATION,
      phone: PHONE,
      phoneVerified: true,
      profileComplete: true,
      ...(user.profileCompletedAt ? {} : { profileCompletedAt: new Date() }),
    };
    console.log("\n1. Profile ->", JSON.stringify(profileSet));
    if (APPLY) {
      await User.updateOne({ _id: user._id }, { $set: profileSet });
      console.log("   ✅ profile written");
    }
  }

  // ── 2. Unilevel Plus licence ────────────────────────────────────────────
  let upInvoice: any = null;
  const existingLicence = await UnilevelPlusPurchase.findOne({ userId: user._id, status: "active" }).lean();
  if (existingLicence) {
    console.log("\n2. Licence: already active — skipping");
    upInvoice = await Invoice.findOne({ userId: user._id, status: "paid", "lineItems.itemType": "unilevel_plus" })
      .sort({ paidAt: -1 })
      .lean();
  } else {
    console.log("\n2. Licence: none — will mint a $0 Unilevel Plus invoice, mark paid, fulfil (commission skipped: subtotal 0)");
    if (APPLY) {
      const seller: any = await User.findOne({ email: PLATFORM_USER_EMAIL }).select("_id").lean();
      if (!seller) throw new Error(`platform user ${PLATFORM_USER_EMAIL} missing`);
      const inv: any = await createInvoice({
        organizationId: PLATFORM_ORG_ID,
        sellerId: String(seller._id),
        userId: String(user._id),
        customerEmail: user.email,
        customerName: name,
        lineItems: [
          {
            itemType: "unilevel_plus",
            itemId: UNILEVEL_PLUS_PLAN_ID,
            itemName: "Unilevel Plus",
            quantity: 1,
            unitPrice: 0, // comped: subtotal 0 → fulfilment skips commission
            originalCurrency: UNILEVEL_PLUS_PLAN_CONFIG.currency || "USD",
          },
        ],
        itemCurrency: UNILEVEL_PLUS_PLAN_CONFIG.currency || "USD",
        tax: 0,
        isRecurring: false,
        metadata: {
          type: "unilevel_plus_activation",
          adminInitiated: true,
          source: "test_account_setup",
          note: "Comped test seat — no payment, no commission",
        },
      } as any);
      // No coupon, so createInvoice's zero-pay auto-paid branch does not run;
      // mark paid and fulfil explicitly, the way adminPlatformBilling does.
      const doc: any = await Invoice.findById(inv._id);
      doc.status = "paid";
      doc.paidAt = new Date();
      await doc.save();
      await fulfillInvoice(doc, `test_account_setup_${doc._id}`);
      upInvoice = await Invoice.findById(doc._id).lean();
      const lic = await UnilevelPlusPurchase.findOne({ userId: user._id, status: "active" }).lean();
      console.log(`   ✅ ${upInvoice.invoiceNumber} paid+fulfilled; licence active: ${!!lic}`);
    }
  }

  // ── 3. NetworkChain subscription ────────────────────────────────────────
  const ncBefore: any = await NcSubscription.findOne({ userId: user._id }).lean();
  const ncActive = ncBefore && ncBefore.status === "active" && new Date(ncBefore.currentPeriodEnd) > new Date();
  console.log(
    `\n3. NetworkChain: ${ncBefore ? `${ncBefore.status} until ${new Date(ncBefore.currentPeriodEnd).toISOString().slice(0, 10)}` : "no record"}`,
  );
  if (ncActive) {
    console.log("   already active — skipping");
  } else {
    const combo = await resolveComboClient();
    if (!combo.client) throw new Error(comboClientProblem(combo.reason));
    const client: any = combo.client;
    console.log(`   will activate free first month via ${client.name} (${client.productConfig?.productCode}) → partner webhook ${client.webhookUrl}`);
    if (APPLY) {
      if (!upInvoice) throw new Error("no paid UP invoice to attach the free cycle to");
      const r = await activateComboFreeFirstMonth({
        buyerId: String(user._id),
        clientId: String(client._id),
        productCode: client.productConfig?.productCode,
        triggerInvoiceId: String(upInvoice._id),
        freeFirstCycle: true,
        nextTermMonths: 1,
      });
      console.log(`   ✅ ${(r.invoice as any).invoiceNumber} (${r.alreadyExisted ? "already existed" : "created"}); next due ${(r.invoice as any).nextDueDate}`);
    }
  }

  if (APPLY) {
    await refreshTypeFlags(user._id);
    // The partner flips the mirror asynchronously; give it a moment.
    await new Promise((r) => setTimeout(r, 4000));
    const after: any = await User.findById(user._id).select("name phone phoneVerified country state city profileComplete typeFlags").lean();
    const lic = await UnilevelPlusPurchase.countDocuments({ userId: user._id, status: "active" });
    const nc: any = await NcSubscription.findOne({ userId: user._id }).lean();
    console.log("\nRESULT:", JSON.stringify({
      name: after.name, phone: after.phone, phoneVerified: after.phoneVerified,
      location: `${after.city}, ${after.state}, ${after.country}`, profileComplete: after.profileComplete,
      licence: lic > 0,
      networkchain: nc ? `${nc.status} ${new Date(nc.currentPeriodStart).toISOString().slice(0, 10)} → ${new Date(nc.currentPeriodEnd).toISOString().slice(0, 10)}` : "no record",
      typeFlags: after.typeFlags,
    }, null, 1));
  }
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error("FAILED:", err?.message || err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
