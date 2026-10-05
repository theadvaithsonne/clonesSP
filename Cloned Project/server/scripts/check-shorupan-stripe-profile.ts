/**
 * Diagnose why shorupan@gmail.com's Stripe card save didn't land.
 * Checks four things:
 *   1. User doc paymentProfile.stripe.{customerId, methods}
 *   2. Stripe Customers with metadata.garageUserId = <shorupan._id>
 *   3. PaymentMethods attached to those Customers (Stripe side)
 *   4. Recent PaymentIntents for those Customers (last 24h) —
 *      inspect their setup_future_usage + status
 *
 * Diagnosis rules at the bottom of the output.
 *
 *   npx ts-node --transpile-only src/scripts/check-shorupan-stripe-profile.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { User } from "../models/user.model";
import { getStripeClient } from "../services/stripe";

const EMAIL = "shorupan@gmail.com";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const user: any = await User.findOne({ email: EMAIL })
    .select("_id email paymentProfile")
    .lean();
  if (!user) {
    console.log(`User not found for ${EMAIL}`);
    return;
  }
  const uid = String(user._id);

  console.log(`\n─── User doc ─────────────────────────────────────────────`);
  console.log(`  _id: ${uid}`);
  const s = user.paymentProfile?.stripe || {};
  console.log(`  paymentProfile.stripe.customerId: ${s.customerId || "(null)"}`);
  console.log(`  paymentProfile.stripe.methods[]:  ${(s.methods || []).length} entries`);
  for (const m of s.methods || []) {
    console.log(
      `    - ${m.id}  ${m.brand} •••• ${m.last4}  exp ${m.expMonth}/${m.expYear}  default=${m.isDefault}`,
    );
  }

  const stripe = getStripeClient();

  // ─── Any Stripe Customers tagged with this user (search API) ────────
  console.log(`\n─── Stripe Customers with metadata.garageUserId = ${uid} ─`);
  try {
    const res = await stripe.customers.search({
      query: `metadata['garageUserId']:'${uid}'`,
      limit: 10,
    });
    console.log(`  Found ${res.data.length} Customer(s)`);
    for (const c of res.data) {
      console.log(
        `    - ${c.id}  email=${c.email}  created=${new Date(c.created * 1000).toISOString()}`,
      );
    }
    if (res.data.length === 0) {
      console.log(
        `  ⚠ No Customers on Stripe with our metadata → getOrCreateStripeCustomer never ran.`,
      );
    }

    // For each Customer, list PaymentMethods + recent PaymentIntents
    for (const c of res.data) {
      console.log(`\n  ── PaymentMethods for ${c.id} ──`);
      const pms = await stripe.paymentMethods.list({
        customer: c.id,
        type: "card",
      });
      console.log(`    ${pms.data.length} PM(s) attached to this Customer`);
      for (const pm of pms.data) {
        console.log(
          `      - ${pm.id}  ${pm.card?.brand} •••• ${pm.card?.last4}  exp ${pm.card?.exp_month}/${pm.card?.exp_year}`,
        );
      }

      console.log(`\n  ── Recent PaymentIntents for ${c.id} (last 24h) ──`);
      const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
      const pis = await stripe.paymentIntents.list({
        customer: c.id,
        created: { gte: since },
        limit: 10,
      });
      console.log(`    Found ${pis.data.length} PaymentIntent(s)`);
      for (const pi of pis.data) {
        console.log(
          `      - ${pi.id}  status=${pi.status}  amount=${pi.amount} ${pi.currency}  setup_future_usage=${pi.setup_future_usage || "(none)"}  payment_method=${typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id || "(none)"}`,
        );
      }

      // Setup intents too
      console.log(`\n  ── Recent SetupIntents for ${c.id} (last 24h) ──`);
      const sis = await stripe.setupIntents.list({
        customer: c.id,
        limit: 10,
      });
      console.log(`    Found ${sis.data.length} SetupIntent(s)`);
      for (const si of sis.data) {
        console.log(
          `      - ${si.id}  status=${si.status}  payment_method=${typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id || "(none)"}  created=${new Date(si.created * 1000).toISOString()}`,
        );
      }
    }
  } catch (err: any) {
    console.log(`  (Stripe search failed: ${err.message})`);
  }

  // ─── Recent PaymentIntents by our metadata userId (catches PIs
  // that were created WITHOUT a customer — e.g. save-for-future flag
  // never made it to BE, so PI has no customer and no setup_future_usage) ─
  console.log(
    `\n─── Recent PaymentIntents with metadata.userId (any customer) ─`,
  );
  try {
    const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
    const all = await stripe.paymentIntents.list({
      created: { gte: since },
      limit: 100,
    });
    const mine = all.data.filter((pi: any) => pi.metadata?.userId === uid);
    console.log(`  Found ${mine.length} PaymentIntent(s) tagged with userId`);
    for (const pi of mine as any[]) {
      console.log(
        `    - ${pi.id}  status=${pi.status}  amount=${pi.amount} ${pi.currency}`,
      );
      console.log(
        `        customer=${pi.customer || "(none)"}  setup_future_usage=${pi.setup_future_usage || "(none)"}`,
      );
      console.log(
        `        payment_method=${typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id || "(none)"}`,
      );
      console.log(
        `        metadata.invoiceNumber=${pi.metadata?.invoiceNumber}`,
      );
    }
  } catch (err: any) {
    console.log(`  (PI list failed: ${err.message})`);
  }

  console.log(`\n─── Diagnosis ────────────────────────────────────────────`);
  if (!s.customerId) {
    console.log(
      `  ❌ User doc has NO stripe.customerId. Interpret alongside the`,
    );
    console.log(`     Stripe-side sections above:`);
    console.log(``);
    console.log(
      `     A) 'PaymentIntents with metadata.userId' section shows PIs`,
    );
    console.log(
      `        with customer=(none) AND setup_future_usage=(none):`,
    );
    console.log(
      `        → FE didn't send savePaymentMethodForFuture. Either the`,
    );
    console.log(
      `          checkbox wasn't visible, wasn't ticked, OR the FE deploy`,
    );
    console.log(`          is stale.`);
    console.log(``);
    console.log(
      `     B) PIs show customer=cus_xxx AND setup_future_usage='off_session':`,
    );
    console.log(
      `        → BE ran the save path correctly. Customer WAS created`,
    );
    console.log(
      `          on Stripe. But our webhook missed 'payment_method.attached'`,
    );
    console.log(
      `          OR 'setup_intent.succeeded' — verify those events are`,
    );
    console.log(`          subscribed on Stripe Dashboard → Webhooks.`);
    console.log(``);
    console.log(
      `     C) 'Stripe Customers with metadata' section shows a Customer`,
    );
    console.log(`        but user doc has null customerId:`);
    console.log(
      `        → getOrCreateStripeCustomer created a Customer but the`,
    );
    console.log(
      `          User.updateOne write failed. Look for BE errors around`,
    );
    console.log(`          that call.`);
  } else if ((s.methods || []).length === 0) {
    console.log(
      `  ⚠  User has stripe.customerId but zero methods. Compare Stripe-`,
    );
    console.log(
      `     side PMs above. If Stripe has PMs and we don't → webhook`,
    );
    console.log(
      `     'payment_method.attached' + 'setup_intent.succeeded' events`,
    );
    console.log(
      `     aren't subscribed OR handler failed silently.`,
    );
  } else {
    console.log(`  ✓ Everything in sync.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
