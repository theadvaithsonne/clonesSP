/**
 * Inspect shorupan's saved INR (Indian issuer) Stripe card + its RBI
 * e-mandate, then attempt a ₹10 MIT charge using the mandate for
 * zero-OTP off-session confirmation.
 *
 * Flow:
 *   1. Load the User doc, filter methods → Indian issuer.
 *   2. Print mandate id / cap / status from the User doc.
 *   3. Cross-check with Stripe (mandate.retrieve) — confirms it's active
 *      and hasn't lapsed on their side.
 *   4. If mandate is active and ₹10 ≤ cap → chargeSavedPaymentMethod
 *      with offSession:true + mandate id. Expect status:"succeeded".
 *   5. If NOT active → don't charge, print why.
 *
 * Usage:
 *   npx tsx src/scripts/check-and-charge-shorupan-inr-mandate.ts
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { User } from "../models/user.model";
import {
  chargeSavedPaymentMethod,
  getStripeClient,
} from "../services/stripe";

const EMAIL = "shorupan@gmail.com";
const AMOUNT_PAISE = 1000; // ₹10.00

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const user: any = await User.findOne({ email: EMAIL })
    .select("_id email paymentProfile")
    .lean();
  if (!user) throw new Error(`User not found for ${EMAIL}`);
  const uid = String(user._id);

  const customerId = user.paymentProfile?.stripe?.customerId;
  const methods: any[] = user.paymentProfile?.stripe?.methods || [];

  console.log(`\n─── User doc ───────────────────────────────────────`);
  console.log(`  _id:        ${uid}`);
  console.log(`  customerId: ${customerId || "(null)"}`);
  console.log(`  methods[]:  ${methods.length} entries`);
  for (const m of methods) {
    console.log(
      `    - ${m.id} ${m.brand} •••• ${m.last4} country=${m.country || "?"} default=${!!m.isDefault} mandate=${m.mandateId || "(none)"} status=${m.mandateStatus || "-"} cap=${m.mandateAmount ?? "-"}`,
    );
  }

  // Filter INR-issuer cards. Fall back to any card with a mandateId if
  // country wasn't captured (legacy row).
  const inrCard =
    methods.find((m) => m.country === "IN" && m.mandateId) ||
    methods.find((m) => m.mandateId) ||
    methods.find((m) => m.country === "IN") ||
    null;

  console.log(`\n─── Target card ────────────────────────────────────`);
  if (!inrCard) {
    console.log(`  ❌ No Indian card saved. Cannot charge.`);
    console.log(
      `     Shorupan needs to re-save the ICICI card via the Payment Methods settings so the SetupIntent registers a mandate.`,
    );
    await mongoose.disconnect();
    return;
  }
  console.log(`  ${inrCard.brand} •••• ${inrCard.last4} (${inrCard.id})`);
  console.log(`  country:       ${inrCard.country || "(unknown)"}`);
  console.log(`  mandateId:     ${inrCard.mandateId || "(none)"}`);
  console.log(`  mandateStatus: ${inrCard.mandateStatus || "(none)"}`);
  console.log(`  mandateAmount: ${inrCard.mandateAmount ?? "(none)"} paise`);

  if (!inrCard.mandateId) {
    console.log(
      `\n  ⚠ Card has no mandate — the SetupIntent didn't register one, or the webhook missed the setup_intent.succeeded event. Cannot do zero-OTP MIT; would need to fall back to CIT (OTP-per-charge).`,
    );
    await mongoose.disconnect();
    return;
  }

  // ─── Cross-check on Stripe side ─────────────────────────────────
  console.log(`\n─── Stripe mandate.retrieve ${inrCard.mandateId} ──`);
  const stripe = getStripeClient();
  let mandate: any = null;
  try {
    mandate = await stripe.mandates.retrieve(inrCard.mandateId);
    console.log(`  status:        ${mandate.status}`);
    console.log(`  type:          ${mandate.type}`);
    console.log(`  payment_method:${mandate.payment_method}`);
    if (mandate.payment_method_details?.card) {
      const c = mandate.payment_method_details.card;
      console.log(
        `  card mandate:  amount=${c.amount} ${c.currency} amount_type=${c.amount_type} interval=${c.interval} reference=${c.reference}`,
      );
    }
  } catch (err: any) {
    console.log(`  (mandate.retrieve failed: ${err.message})`);
  }

  const stripeMandateActive = mandate?.status === "active";
  const withinCap = AMOUNT_PAISE <= Number(inrCard.mandateAmount || 0);

  console.log(`\n─── Preflight ─────────────────────────────────────`);
  console.log(`  stripeMandateActive:  ${stripeMandateActive}`);
  console.log(
    `  amountWithinCap:      ${withinCap} (₹${AMOUNT_PAISE / 100} vs cap ₹${(inrCard.mandateAmount || 0) / 100})`,
  );

  if (!stripeMandateActive || !withinCap) {
    console.log(
      `\n  ❌ Not safe to attempt MIT — mandate not active or amount above cap. Aborting.`,
    );
    await mongoose.disconnect();
    return;
  }

  // ─── Attempt zero-OTP MIT charge ────────────────────────────────
  console.log(`\n─── Charging ₹${AMOUNT_PAISE / 100} MIT (off_session, mandate attached) ──`);
  let pi: any;
  try {
    pi = await chargeSavedPaymentMethod({
      customerId,
      paymentMethodId: inrCard.id,
      amountInSmallestUnit: AMOUNT_PAISE,
      currency: "inr",
      offSession: true,
      mandate: inrCard.mandateId,
      metadata: {
        invoiceId: "manual-inr-mandate-test",
        invoiceNumber: "MANUAL-INR-MANDATE-TEST",
        userId: uid,
        orgId: "manual-test",
        itemType: "manual_mandate_test",
      },
      description: "₹10 INR MIT test — mandate-authorized off-session",
      receiptEmail: EMAIL,
    });
  } catch (err: any) {
    console.error(`  Stripe error: ${err.message}`);
    console.error(`    code: ${err.code} type: ${err.type}`);
    if (err?.raw?.payment_intent) {
      pi = err.raw.payment_intent;
      console.log(`  (PI attached to error — inspecting)`);
    } else {
      await mongoose.disconnect();
      return;
    }
  }

  console.log(`\n═══ PaymentIntent ═══`);
  console.log(`  id:              ${pi.id}`);
  console.log(`  status:          ${pi.status}`);
  console.log(`  amount:          ${pi.amount} ${pi.currency}`);
  console.log(`  amount_received: ${pi.amount_received}`);
  console.log(`  next_action:     ${pi.next_action?.type || "(none)"}`);

  if (pi.status === "succeeded") {
    console.log(
      `\n  ✅ Charged ₹${AMOUNT_PAISE / 100} zero-OTP via mandate. This is the target behavior — every renewal ≤ ₹1,00,000 will settle the same way.`,
    );
  } else if (pi.status === "requires_action") {
    console.log(
      `\n  ⚠ Stripe still asked for auth (probably issuer-side risk decision, not our mandate). Fall back to OTP: open pi.next_action.redirect_to_url in a browser.`,
    );
    if (pi.next_action?.redirect_to_url?.url) {
      console.log(`     ${pi.next_action.redirect_to_url.url}`);
    }
  } else {
    console.log(`\n  ⚠ Unexpected status. Full next_action:`);
    console.log(JSON.stringify(pi.next_action, null, 2));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
