/**
 * Attempt a ₹10 CIT charge on shorupan's saved Indian card. Since RBI
 * mandates OTP-per-charge for saved Indian cards (unless a pre-
 * registered e-mandate exists), the server-side PI can only get to
 * `requires_action` — the actual OTP has to happen in a browser.
 *
 * Two outcomes possible:
 *   1. `next_action.type === "redirect_to_url"` — Stripe hosts a 3DS
 *      confirmation page. Print the URL; shorupan opens it, enters
 *      OTP, done. Zero code needed on our side.
 *   2. `next_action.type === "use_stripe_sdk"` — requires Stripe.js
 *      in a browser (our normal FE flow). Fallback path: print the
 *      client_secret + a browser console snippet he can run on any
 *      Stripe-loaded page.
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/charge-shorupan-inr-ten.ts
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { chargeSavedPaymentMethod } from "../services/stripe";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const user: any = await User.findOne({ email: "shorupan@gmail.com" })
    .select("_id paymentProfile")
    .lean();
  if (!user) throw new Error("User not found");

  const customerId = user.paymentProfile?.stripe?.customerId;
  const methods = user.paymentProfile?.stripe?.methods || [];
  // Prefer the Indian ICICI card (•••• 4009) for the INR CIT test.
  // Fall back to whichever is default if we can't identify it.
  const indianCard =
    methods.find((m: any) => m.last4 === "4009") ||
    methods.find((m: any) => m.isDefault) ||
    methods[0];
  if (!customerId || !indianCard?.id) {
    throw new Error("No saved card found on user");
  }

  console.log(
    `[charge] Using ${indianCard.brand} •••• ${indianCard.last4} (customer ${customerId})`,
  );
  console.log(`[charge] Attempting ₹10.00 INR CIT charge (off_session: false)…`);

  let pi: any;
  try {
    pi = await chargeSavedPaymentMethod({
      customerId,
      paymentMethodId: indianCard.id,
      amountInSmallestUnit: 1000, // ₹10.00 = 1000 paise
      currency: "inr",
      offSession: false, // CIT — Stripe returns requires_action for OTP
      metadata: {
        invoiceId: "manual-inr-test",
        invoiceNumber: "MANUAL-INR-TEST",
        userId: String(user._id),
        orgId: "manual-test",
        itemType: "manual_test",
      },
      description: "₹10 INR CIT test charge — shorupan saved card",
      receiptEmail: "shorupan@gmail.com",
    });
  } catch (err: any) {
    console.error(`[charge] Stripe error:`, err.message);
    console.error(`  code: ${err.code}`);
    console.error(`  type: ${err.type}`);
    if (err?.raw?.payment_intent) {
      pi = err.raw.payment_intent;
      console.log(`[charge] PI attached to error, continuing…`);
    } else {
      await mongoose.disconnect();
      return;
    }
  }

  console.log(``);
  console.log(`═══ PaymentIntent ═══`);
  console.log(`  id:                 ${pi.id}`);
  console.log(`  status:             ${pi.status}`);
  console.log(`  amount:             ${pi.amount} ${pi.currency}`);
  console.log(`  amount_received:    ${pi.amount_received}`);
  console.log(`  client_secret:      ${pi.client_secret}`);
  console.log(`  next_action.type:   ${pi.next_action?.type || "(none)"}`);
  if (pi.next_action?.redirect_to_url) {
    console.log(
      `  next_action.redirect_to_url.url: ${pi.next_action.redirect_to_url.url}`,
    );
  }
  if (pi.next_action?.use_stripe_sdk) {
    console.log(
      `  next_action.use_stripe_sdk: (requires Stripe.js in browser)`,
    );
  }

  console.log(`\n═══ How to complete this charge ═══`);
  if (pi.status === "succeeded") {
    console.log(`  ✅ Charged ₹10 successfully. No OTP needed this time.`);
  } else if (pi.next_action?.redirect_to_url?.url) {
    console.log(`  Open this URL and enter the OTP:`);
    console.log(``);
    console.log(`     ${pi.next_action.redirect_to_url.url}`);
    console.log(``);
    console.log(`  Once he enters OTP, the PI flips to 'succeeded' and`);
    console.log(`  Stripe's webhook fires — our BE will mark any linked`);
    console.log(`  invoice as paid (this test PI has no real invoice, so`);
    console.log(`  the payment lands but no invoice fulfills — that's fine).`);
  } else if (pi.next_action?.type === "use_stripe_sdk") {
    console.log(
      `  Requires the Stripe SDK in a browser. Easiest path: shorupan`,
    );
    console.log(
      `  pays a real ₹10 invoice through the app — that flows through`,
    );
    console.log(`  our StripeCardForm's saved3DSOnly view which auto-fires`);
    console.log(`  confirmCardPayment on mount.`);
    console.log(``);
    console.log(`  If you want to complete it right now via a scratch URL,`);
    console.log(`  paste this snippet in the browser console on any page`);
    console.log(`  that has our Stripe SDK loaded (e.g. any Garage invoice`);
    console.log(`  page):`);
    console.log(``);
    console.log(
      `     stripe.confirmCardPayment("${pi.client_secret}").then(console.log)`,
    );
  } else {
    console.log(
      `  Unexpected next_action shape. Full next_action: ${JSON.stringify(pi.next_action, null, 2)}`,
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[charge] fatal:", err);
  process.exit(1);
});
