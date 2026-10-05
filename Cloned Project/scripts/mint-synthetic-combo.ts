/**
 * Mint a synthetic Unilevel Plus + NetworkChain combo subscription for one user.
 *
 * Used to produce a test account that looks fully entitled (UP active + NC sub
 * active) so it can be handed to Google for OAuth site verification without
 * running any real payment or firing wallet-touching commission flows.
 *
 * Idempotent — re-running for the same email is a no-op.
 *
 * Usage:
 *   MONGODB_URI=... npx ts-node scripts/mint-synthetic-combo.ts user@example.com
 *
 * What it creates (matches the shape produced by the real
 * /unilevel-plus/checkout/create-combo-invoice → fulfillInvoice path):
 *   1. UnilevelPlusPurchase              (roam)
 *   2. Invoice (third_party_subscription, $0, recurring, combo_free_first_month)  (roam)
 *   3. NetworkChainSubscription          (contacts-backend, same cluster,
 *                                        collection "networkchain_subscriptions")
 *
 * Deliberately NOT created:
 *   - The $25 UP "trigger" Invoice — only needed by the combo-status endpoint,
 *     which Google won't hit. Add it back if you want to demo the checkout flow.
 *   - UnilevelPlusDistribution rows — no commissions on a synthetic account.
 *   - Outbound webhook to NC — contacts-backend and roam share this cluster,
 *     so we write the NC sub row directly instead of firing invoice.paid.
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { User } from "../server/models/user.model";
import { Invoice } from "../server/models/invoice.model";
import { ThirdPartyClient } from "../server/models/thirdPartyClient.model";
import { UnilevelPlusPurchase } from "../server/models/unilevelPlusPurchase.model";
import { getActiveUnilevelPlusPlan } from "../server/services/unilevelPlusCommission";
import { calculateTaxAmounts, GST_CONFIG } from "../server/utils/gstTax";

const PERIOD_DAYS = 30;

async function run() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("Usage: ts-node scripts/mint-synthetic-combo.ts <email>");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI!);
  console.log(`Connected. Minting synthetic combo for ${email}`);

  // ── 1. Resolve user ──────────────────────────────────────────────────
  const user = await User.findOne({ email }).select("_id email name").lean();
  if (!user) throw new Error(`No user with email ${email}`);
  const userId = user._id.toString();
  // orgId is only needed for the NetworkChainSubscription row (contacts-backend
  // schema requires it). Users signed up via the standalone NC flow often have
  // no top-level orgId on the User doc — the JWT carries it separately. Match
  // contacts-backend's own webhook fallback (garage-subscription.ts:487):
  //   const orgId = metadata?.orgId || userId || "";
  // Using userId satisfies the "must be a valid ObjectId" schema constraint and
  // isn't semantically wrong — the sub is scoped to the user, not their org.
  const orgId = userId;
  console.log(`  user=${userId}  org=${orgId} (fallback=userId; matches NC webhook self-heal)`);

  // ── 2. Resolve NetworkChain ThirdPartyClient ─────────────────────────
  const nc = await ThirdPartyClient.findOne({ name: /networkchain/i, isActive: true });
  if (!nc?.productConfig?.recurringPeriod) {
    throw new Error("Active NetworkChain ThirdPartyClient with productConfig not found");
  }
  const pc = nc.productConfig;
  const platformUser = await User.findOne({ email: pc.platformUserEmail }).select("_id").lean();
  if (!platformUser) throw new Error(`Platform user ${pc.platformUserEmail} not provisioned`);
  console.log(`  nc=${nc._id}  productCode=${pc.productCode}  period=${pc.recurringPeriod}`);

  // ── 3. Resolve active UP plan ────────────────────────────────────────
  const plan = await getActiveUnilevelPlusPlan();
  if (!plan) throw new Error("No active Unilevel Plus plan found");
  console.log(`  upPlan=${plan._id}  price=$${plan.productPrice}`);

  // ── 4. UnilevelPlusPurchase (idempotent on userId — unique index) ────
  const paymentId = `synthetic_combo_${userId}`;
  const existingPurchase = await UnilevelPlusPurchase.findOne({ userId: new Types.ObjectId(userId) });
  if (existingPurchase) {
    console.log(`  ✔ UnilevelPlusPurchase already exists: ${existingPurchase._id} (status=${existingPurchase.status})`);
    if (existingPurchase.status !== "active") {
      existingPurchase.status = "active";
      await existingPurchase.save();
      console.log("    reactivated");
    }
  } else {
    const p = await UnilevelPlusPurchase.create({
      userId: new Types.ObjectId(userId),
      planId: plan._id,
      paymentId,
      amount: plan.productPrice,
      currency: plan.currency,
      status: "active",
      purchasedAt: new Date(),
      metadata: { source: "synthetic_mint_google_oauth" },
    });
    console.log(`  ✚ UnilevelPlusPurchase created: ${p._id}`);
  }

  // ── 5. Combo third_party_subscription invoice ────────────────────────
  // Same shape as services/thirdPartyInvoice.ts freeFirstCycle branch, then
  // marked paid + nextDueDate like comboActivation.ts does.
  const externalId = `combo_free_first_month_${userId}`;
  let comboInv = await Invoice.findOne({
    thirdPartyClientId: nc._id,
    thirdPartyExternalId: externalId,
  });
  if (comboInv) {
    console.log(`  ✔ Combo invoice already exists: ${comboInv._id} (${comboInv.invoiceNumber}, status=${comboInv.status})`);
    if (comboInv.status !== "paid") {
      comboInv.status = "paid";
      comboInv.paidAt = new Date();
      await comboInv.save();
      console.log("    marked paid");
    }
  } else {
    const unitPriceCents = Math.round(pc.totalAmount * 100);
    const taxAmount = calculateTaxAmounts(unitPriceCents, GST_CONFIG.rate).taxAmount;
    const discount = unitPriceCents + taxAmount; // drives parent total to 0
    const subtotal = unitPriceCents;
    const totalAmount = 0;
    const now = new Date();
    const nextDueDate = new Date(now.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);

    comboInv = await Invoice.create({
      invoiceType: "recurring",
      status: "paid",
      organizationId: new Types.ObjectId(pc.platformOrgId),
      sellerId: platformUser._id,
      userId: new Types.ObjectId(userId),
      customerEmail: email,
      customerName: (user as any).name,
      lineItems: [
        {
          itemType: "third_party_subscription",
          itemId: nc._id.toString(),
          itemName: `${nc.name} subscription`,
          itemDescription: `${pc.productCode} subscription — first cycle free (synthetic)`,
          quantity: 1,
          unitPrice: unitPriceCents,
          // Required by the line-item schema. createInvoice() normally computes
          // this (unitPrice * quantity); this script writes the Invoice directly
          // via Invoice.create(), so we must set it explicitly.
          totalPrice: unitPriceCents,
          originalCurrency: "USD",
        },
      ],
      subtotal,
      discount,
      tax: taxAmount,
      totalAmount,
      itemCurrency: "USD",
      isRecurring: true,
      recurringPeriod: pc.recurringPeriod,
      nextDueDate,
      paidAt: now,
      thirdPartyClientId: nc._id,
      thirdPartyExternalId: externalId,
      commissionDistributed: true, // zero-pay branch semantics
      metadata: {
        kind: "combo_free_first_month",
        userId,
        source: "synthetic_mint_google_oauth",
        thirdPartyClientName: nc.name,
        productCode: pc.productCode,
        ...(taxAmount > 0
          ? { gst: { rate: GST_CONFIG.rate, amount: taxAmount, inclusive: false, sacCode: GST_CONFIG.sacCode } }
          : {}),
      },
    });
    console.log(`  ✚ Combo invoice created: ${comboInv._id} (${comboInv.invoiceNumber}) nextDue=${nextDueDate.toISOString()}`);
  }

  // ── 6. NetworkChainSubscription (contacts-backend, same cluster) ─────
  // Written directly against the collection so we don't need to import from
  // contacts-backend. Schema mirrors contacts-backend/src/models/subscription.model.ts.
  const now = new Date();
  const periodEnd = new Date(now.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const ncSubs = mongoose.connection.collection("networkchain_subscriptions");
  const payment = {
    paymentId: comboInv._id.toString(),
    orderId: comboInv.invoiceNumber,
    amountCents: 0,
    paidAt: now,
  };
  const res = await ncSubs.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      $setOnInsert: {
        userId: new Types.ObjectId(userId),
        orgId: new Types.ObjectId(orgId),
        priceCents: 4248, // $36 + 18% GST (matches NC_SUB_PRICE_CENTS)
        currentPeriodStart: now,
        createdAt: now,
      },
      $set: {
        status: "active",
        currentPeriodEnd: periodEnd,
        updatedAt: now,
      },
      $addToSet: { payments: payment },
    },
    { upsert: true, returnDocument: "after" }
  );
  const doc = (res as any).value ?? res;
  console.log(`  ✚ NetworkChainSubscription upserted: ${doc?._id ?? "(new)"} periodEnd=${periodEnd.toISOString()}`);

  console.log("\nDone. Synthetic combo minted.");
  console.log(`  Login as: ${email}`);
  console.log(`  UP status:   active (purchase paymentId=${paymentId})`);
  console.log(`  NC sub:      active until ${periodEnd.toISOString()}`);
  console.log(`  Combo inv:   ${comboInv.invoiceNumber} ($0, recurring monthly)`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
