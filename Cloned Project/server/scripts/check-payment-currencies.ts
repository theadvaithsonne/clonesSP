/**
 * Pre-deploy check for the card-only payment currencies (CAD/EUR/GBP/AED/PHP…).
 *
 * Adding a currency touches one list (utils/exchangeRate.ts) — but three
 * things can still go wrong silently and only show up in production:
 *
 *   1. The invoice's `paymentCurrency` enum rejects it. The Stripe webhook
 *      writes `pi.currency` into that field AFTER the card is charged, so a
 *      missing enum value means a paid invoice that fails to save.
 *   2. The option list reorders. The checkout reads the FIRST currency's
 *      method list to decide whether to show the crypto tile; a card-only
 *      currency landing first hides crypto for everyone (Sep 2026).
 *   3. The Stripe account can't present in it. Presentment currencies are
 *      per-account; a PaymentIntent that can't be created is a dead tile.
 *
 * This asserts all three for every extra currency, plus that a live rate
 * resolves. The Stripe check creates an uncharged PaymentIntent and cancels
 * it — no money moves. Exits non-zero on the first failure.
 *
 *   npx tsx src/scripts/check-payment-currencies.ts
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";
import { z } from "zod";

let failed = 0;
const ok = (label: string) => console.log(`  ✅ ${label}`);
const bad = (label: string) => {
  failed++;
  console.log(`  ❌ ${label}`);
};

(async () => {
  // autoIndex off: user.model declares a unique phone index that must not be
  // (re)built on production by a check script. No DB reads happen here; the
  // connection only exists so the models load with their real config.
  await mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false });

  const {
    EXTRA_PAYMENT_CURRENCIES,
    SUPPORTED_FIAT_CURRENCIES,
    getUsdToRate,
  } = await import("../utils/exchangeRate");
  const { Invoice } = await import("../models/invoice.model");
  const { getPaymentOptions } = await import("../services/invoice");

  console.log(`Supported fiat: ${SUPPORTED_FIAT_CURRENCIES.join(", ")}`);
  console.log(`Card-only extras: ${EXTRA_PAYMENT_CURRENCIES.join(", ")}\n`);

  // ── 1. Enum + schema accept every currency ────────────────────────────
  const enumValues: string[] =
    (Invoice.schema.path("paymentCurrency") as any)?.enumValues || [];
  const zodSchema = z.enum(SUPPORTED_FIAT_CURRENCIES);
  for (const c of SUPPORTED_FIAT_CURRENCIES) {
    enumValues.includes(c)
      ? ok(`${c}: Invoice.paymentCurrency enum accepts it`)
      : bad(`${c}: NOT in Invoice.paymentCurrency enum ${JSON.stringify(enumValues)}`);
    zodSchema.safeParse(c).success
      ? ok(`${c}: select-payment zod accepts it`)
      : bad(`${c}: select-payment zod rejects it`);
  }

  // ── 2. Option list shape, for both buyer regions ──────────────────────
  for (const isIndia of [false, true]) {
    const o = getPaymentOptions({ isIndia });
    const keys = Object.keys(o.methods);
    const label = isIndia ? "India" : "non-India";
    console.log(`\n${label}: currencies=${o.currencies.join(",")} methods order=${keys.join(",")}`);
    keys[0] === "USD" && keys[1] === "INR"
      ? ok(`${label}: USD, INR listed first`)
      : bad(`${label}: USD/INR are not first — the checkout's crypto sniff will break`);
    const firstHasCrypto = (o.methods[keys[0]] || []).some((m) => m.category === "crypto");
    if (!isIndia) {
      firstHasCrypto
        ? ok(`${label}: crypto present on the first currency (tile will show)`)
        : bad(`${label}: crypto missing from first currency — tile will vanish`);
    } else {
      !Object.values(o.methods).flat().some((m) => m.category === "crypto")
        ? ok(`${label}: crypto hidden`)
        : bad(`${label}: crypto offered to an Indian buyer`);
    }
    for (const c of EXTRA_PAYMENT_CURRENCIES) {
      const methods = o.methods[c];
      if (!o.currencies.includes(c) || !methods) {
        bad(`${label}: ${c} not offered`);
        continue;
      }
      const cardOnlyStripe =
        methods.length === 1 &&
        methods[0].category === "card" &&
        methods[0].platforms.length === 1 &&
        methods[0].platforms[0].id === "stripe" &&
        methods[0].platforms[0].enabled;
      cardOnlyStripe
        ? ok(`${label}: ${c} is card-only via Stripe`)
        : bad(`${label}: ${c} offers something other than card/Stripe: ${JSON.stringify(methods)}`);
      o.currencies.indexOf(c) > o.currencies.indexOf("INR")
        ? ok(`${label}: ${c} listed after USD/INR`)
        : bad(`${label}: ${c} listed before INR`);
    }
  }

  // ── 3. Live rate + Stripe presentment ─────────────────────────────────
  console.log("");
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
  for (const c of EXTRA_PAYMENT_CURRENCIES) {
    try {
      const rate = await getUsdToRate(c);
      rate > 0 ? ok(`${c}: USD→${c} rate ${rate}`) : bad(`${c}: rate ${rate}`);
    } catch (e: any) {
      bad(`${c}: rate lookup threw ${e?.message}`);
    }
    try {
      const pi = await stripe.paymentIntents.create({
        amount: 500,
        currency: c.toLowerCase(),
        payment_method_types: ["card"],
        description: "check-payment-currencies (cancelled immediately)",
      });
      await stripe.paymentIntents.cancel(pi.id);
      ok(`${c}: Stripe mints a PaymentIntent (${pi.id}, cancelled)`);
    } catch (e: any) {
      bad(`${c}: Stripe refused a PaymentIntent — ${e?.raw?.message || e?.message}`);
    }
  }

  await mongoose.disconnect();
  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
})().catch(async (err) => {
  console.error("FAILED:", err?.message || err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
