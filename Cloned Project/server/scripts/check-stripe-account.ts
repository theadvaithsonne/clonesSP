/**
 * Fetch the current Stripe account's country + supported currencies.
 * Answers the "can we shift INR cards to Stripe" question definitively.
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/check-stripe-account.ts
 */
import dotenv from "dotenv";
dotenv.config();

import { getStripeClient } from "../services/stripe";

async function main() {
  const stripe = getStripeClient();
  const account: any = await stripe.accounts.retrieve();

  console.log("\n─── Stripe Account ────────────────────────────────────");
  console.log(`  id:            ${account.id}`);
  console.log(`  country:       ${account.country}`);
  console.log(`  default_currency: ${account.default_currency?.toUpperCase()}`);
  console.log(`  business_type: ${account.business_type || "(unknown)"}`);
  console.log(`  email:         ${account.email || "(none)"}`);
  console.log(
    `  charges_enabled: ${account.charges_enabled}   payouts_enabled: ${account.payouts_enabled}`,
  );

  const inr = (account.capabilities || {}).card_payments;
  console.log(`\n  card_payments capability: ${inr || "(unknown)"}`);
  console.log(
    `  (Stripe India account will have country=IN + default_currency=INR)`,
  );

  console.log("\n─── Verdict for INR-cards-through-Stripe routing ─────");
  if (account.country === "IN") {
    console.log(
      "  ✅ Stripe India account. INR charges will work natively.",
    );
    console.log(
      "     Indian cards will require OTP per charge (RBI rule) unless",
    );
    console.log("     you register e-mandates. Save-card + PAN reuse works.");
  } else {
    console.log(
      `  ⚠  Non-India account (${account.country}). INR charges likely to`,
    );
    console.log(
      "     be rejected by Stripe or hit heavy decline rates on Indian",
    );
    console.log(
      "     issuer cards. Recommend REVERTING the INR-cards routing to",
    );
    console.log("     Razorpay before deploying.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
