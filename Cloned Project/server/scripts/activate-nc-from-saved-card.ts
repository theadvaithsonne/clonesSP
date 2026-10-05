/**
 * Activates a NetworkChain subscription by charging the buyer's saved card.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * A buyer paid $25 for a Unilevel Plus licence on an invoice minted 129 days
 * earlier that should never have still been payable. By the time it settled
 * their 24-hour free-first-month window had closed, so fulfilment correctly
 * declined to grant a free NetworkChain month — leaving them with a licence
 * and no subscription. They saved a card during that payment. This charges it
 * for the first cycle and activates the subscription.
 *
 * ── Why there was no existing path ───────────────────────────────────────
 * `activateComboFreeFirstMonth({ freeFirstCycle: false })` exists but refuses
 * without a `bundle`, because that path assumes the subscription money was
 * ALREADY collected on the UP invoice as part of one cart. It has no concept
 * of "activate now, collect separately". So this collects the cash first, then
 * hands the activation a `bundle` describing what was taken — which is also
 * what `commission.ts` reads as the revenue base, since the third-party
 * invoice itself totals $0.
 *
 * ── Consent ──────────────────────────────────────────────────────────────
 * This is a merchant-initiated charge for an amount the buyer was never
 * quoted: their invoice carried a single $25 line and no subscription. Run it
 * deliberately, one account at a time, with a human deciding — never in bulk,
 * never on a schedule. The card must already be set up for off-session use
 * (the checkout that saved it passes `setupFutureUsage: "off_session"`).
 *
 * ── Idempotency ──────────────────────────────────────────────────────────
 * Two independent guards, so a re-run cannot double-charge:
 *   - Stripe `idempotencyKey` keyed on (user, trigger invoice, term) — a
 *     repeat returns the ORIGINAL PaymentIntent rather than a second one.
 *   - `activateComboFreeFirstMonth` dedupes on
 *     `nc_paid_first_cycle_<triggerInvoiceId>` and returns the existing row.
 *
 *   npx tsx src/scripts/activate-nc-from-saved-card.ts --email someone@x.com
 *   npx tsx src/scripts/activate-nc-from-saved-card.ts --email someone@x.com --apply
 *   ...optionally --term 1|3|6|12   (default 1)
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const APPLY = process.argv.includes("--apply");
const EMAIL = arg("email");
const TERM = Number(arg("term") || 1);

(async () => {
  if (!EMAIL) {
    console.error("--email is required");
    process.exit(1);
  }
  // autoIndex off: this tree's user.model declares a unique phone index the
  // deployed code has no guard for yet, so loading models with autoIndex on
  // would recreate it against production.
  await mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false });

  const { User } = await import("../models/user.model");
  const { Invoice } = await import("../models/invoice.model");
  const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");
  const { chargeSavedPaymentMethod } = await import("../services/stripe");
  const { activateComboFreeFirstMonth } = await import("../services/comboActivation");

  console.log(APPLY ? "=== APPLY ===\n" : "=== DRY RUN — pass --apply to charge ===\n");

  // ── 1. The buyer and their card ──
  const user: any = await User.findOne({ email: EMAIL.toLowerCase() }).lean();
  if (!user) throw new Error(`No user with email ${EMAIL}`);
  console.log(`buyer            : ${user.email}  (${user._id})`);

  const sp = user.paymentProfile?.stripe;
  const card =
    (sp?.methods || []).find((m: any) => m.isDefault) || (sp?.methods || [])[0];
  if (!sp?.customerId || !card) {
    throw new Error("No saved Stripe card on this account — cannot charge.");
  }
  console.log(
    `saved card       : ${card.brand} ****${card.last4}  exp ${card.expMonth}/${card.expYear}  (${card.country})`
  );
  console.log(`stripe customer  : ${sp.customerId}`);

  // ── 2. The subscription attaches to a licence — require one ──
  const upPurchase = await mongoose.connection
    .db!.collection("unilevelpluspurchases")
    .findOne({ userId: user._id, status: "active" });
  if (!upPurchase) {
    throw new Error("No active Unilevel Plus licence — the subscription attaches to one.");
  }
  const trigger: any = await Invoice.findOne({
    userId: user._id,
    status: "paid",
    "lineItems.itemType": "unilevel_plus",
  })
    .sort({ paidAt: -1 })
    .lean();
  if (!trigger) throw new Error("No paid Unilevel Plus invoice to attach to.");
  console.log(
    `licence invoice  : ${trigger.invoiceNumber}  $${(trigger.totalAmount / 100).toFixed(2)}  paid ${new Date(trigger.paidAt).toISOString().slice(0, 10)}`
  );

  // ── 3. Never charge someone who already has coverage ──
  const nc = await mongoose.connection
    .db!.collection("networkchain_subscriptions")
    .findOne({ userId: user._id });
  const covered =
    nc?.status === "active" &&
    nc?.currentPeriodEnd &&
    new Date(nc.currentPeriodEnd) > new Date();
  console.log(
    `existing NC sub  : ${nc ? `${nc.status}, period ends ${nc.currentPeriodEnd}` : "none"}`
  );
  if (covered) {
    console.log("\nABORT — this account already has active NetworkChain coverage.");
    await mongoose.disconnect();
    return;
  }

  // ── 4. Price comes from the client config, never a literal ──
  const client: any = await ThirdPartyClient.findOne({ isActive: true });
  if (!client?.productConfig) throw new Error("No active third-party client configured.");
  const term = (client.productConfig.termPlans || []).find(
    (t: any) => t.termMonths === TERM && t.isActive
  );
  if (!term) {
    const avail = (client.productConfig.termPlans || [])
      .filter((t: any) => t.isActive)
      .map((t: any) => `${t.termMonths}mo=$${t.totalAmount}`)
      .join(", ");
    throw new Error(`No active ${TERM}-month term. Available: ${avail}`);
  }
  const amountUsd = Number(term.totalAmount);
  console.log(`\nproduct          : ${client.name} ${client.productConfig.productCode}`);
  console.log(`term             : ${term.termMonths} month(s) - $${amountUsd.toFixed(2)}`);
  console.log(
    `  -> $${term.upPortion} to the UP tree, $${(amountUsd - Number(term.upPortion)).toFixed(2)} platform`
  );

  // Activated by an earlier run?
  const already: any = await Invoice.findOne({
    thirdPartyClientId: client._id,
    thirdPartyExternalId: `nc_paid_first_cycle_${trigger._id}`,
  }).lean();
  if (already) {
    console.log(
      `\nALREADY ACTIVATED - third-party invoice ${already.invoiceNumber} exists. Nothing to do.`
    );
    await mongoose.disconnect();
    return;
  }

  if (!APPLY) {
    console.log(
      `\nWould charge ${card.brand} ****${card.last4} $${amountUsd.toFixed(2)} USD off-session,`
    );
    console.log(`then activate ${term.termMonths}-month ${client.name} coverage.`);
    console.log("\nNothing charged.");
    await mongoose.disconnect();
    return;
  }

  // ── 5. Collect ──
  const idempotencyKey = `nc-activate-${user._id}-${trigger._id}-${term.termMonths}m`;
  console.log(`\ncharging $${amountUsd.toFixed(2)} USD  (idempotency: ${idempotencyKey})`);
  const pi: any = await chargeSavedPaymentMethod({
    customerId: sp.customerId,
    paymentMethodId: card.id,
    amountInSmallestUnit: Math.round(amountUsd * 100),
    currency: "usd",
    description: `${client.name} subscription - ${term.termMonths} month(s)`,
    receiptEmail: user.email,
    // Shape is fixed by CreatePaymentIntentOptions — these five keys are
    // required so every PaymentIntent is reconcilable from the Stripe side.
    // The trigger invoice is referenced because the cash collected here has
    // no invoice of its own; it settles the subscription that invoice's
    // purchase should have created.
    metadata: {
      invoiceId: String(trigger._id),
      invoiceNumber: String(trigger.invoiceNumber),
      userId: String(user._id),
      orgId: String(trigger.organizationId || ""),
      itemType: "third_party_subscription",
      kind: "nc_manual_activation",
      termMonths: String(term.termMonths),
    },
    idempotencyKey,
  });
  console.log(`PaymentIntent    : ${pi.id}  status=${pi.status}`);

  if (pi.status !== "succeeded") {
    // requires_action = the issuer wants SCA, which a merchant-initiated
    // charge cannot satisfy. Nothing was captured and nothing is activated;
    // the buyer has to confirm on-session instead.
    console.log(
      pi.status === "requires_action"
        ? "\nNOT ACTIVATED - the issuer requires the cardholder to authenticate (SCA)." +
            "\nNothing was captured. Send a confirm-to-pay link instead."
        : `\nNOT ACTIVATED - charge did not succeed (${pi.status}). Nothing was captured.`
    );
    await mongoose.disconnect();
    return;
  }

  // ── 6. Activate, telling the commission engine what was collected ──
  const result = await activateComboFreeFirstMonth({
    buyerId: String(user._id),
    clientId: String(client._id),
    productCode: client.productConfig.productCode,
    triggerInvoiceId: String(trigger._id),
    freeFirstCycle: false,
    // `subUsd` is the revenue base commission.ts distributes on — the
    // third-party invoice itself totals $0. `licenceUsd` is the licence's full
    // list value, already collected on the trigger invoice.
    bundle: { licenceUsd: 25, subUsd: amountUsd, termMonths: term.termMonths },
  });

  // Tie the cash to the subscription so this is traceable later.
  await Invoice.updateOne(
    { _id: (result.invoice as any)._id },
    {
      $set: {
        "metadata.manualActivationPaymentIntentId": pi.id,
        "metadata.manualActivationBy": "script:activate-nc-from-saved-card",
        "metadata.manualActivationAt": new Date().toISOString(),
      },
    }
  );

  console.log("\nACTIVATED");
  console.log(`  third-party invoice : ${(result.invoice as any).invoiceNumber}`);
  console.log(`  already existed     : ${result.alreadyExisted}`);
  console.log(`  next due            : ${(result.invoice as any).nextDueDate}`);

  const after = await mongoose.connection
    .db!.collection("networkchain_subscriptions")
    .findOne({ userId: user._id });
  console.log(`  NC subscription     : ${after?.status}  period ends ${after?.currentPeriodEnd}`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error("\nFAILED:", err?.message || err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
