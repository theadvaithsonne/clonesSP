// src/scripts/grant-networkchain-coupon-hiren.ts
//
// Give h.sabalpara6844@gmail.com (Hiren Sabalpara) a 3-month NetworkChain
// subscription via the GETNETWORKCHAINS coupon (100% off × 3 cycles).
//
// Goes through `createThirdPartyInvoice` — the same service a real NetworkChain
// purchase uses — rather than hand-writing an invoice, so fulfilment,
// activation and commission distribution all behave exactly as they would for
// a paying customer. The resulting row is byte-identical in shape to
// khanthecoach@gmail.com's working chain (INV-MQEXRCOR-R8X6).
//
// Depends on the redemption-scope fix: the coupon has cycleCount 3, so
// `redemptionScopeFor` files the redemption under `parentInvoiceId: <root>`,
// which is the only key `generateNextChildInvoice` reads. Without that fix
// this would grant exactly one free cycle and then start billing.
//
// 100% off → the invoice totals $0 → createInvoice's zero-pay path marks it
// paid and fulfils it. Cycles 2 and 3 are then minted free by the renewal
// cron as each falls due.
//
//   npx tsx src/scripts/grant-networkchain-coupon-hiren.ts            # dry run
//   npx tsx src/scripts/grant-networkchain-coupon-hiren.ts --confirm

import "dotenv/config";
import mongoose from "mongoose";

const EMAIL = "h.sabalpara6844@gmail.com";
const COUPON = "GETNETWORKCHAINS";
const PRODUCT_CODE = "GU_SUB_36";
const CLIENT_NAME = "NetworkChain";
/** Idempotency key — see the note at the call site. */
const EXTERNAL_ID = "support-grant-3mo-h.sabalpara6844";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

async function main() {
  const confirm = process.argv.includes("--confirm");
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  const { User } = await import("../models/user.model");
  const { Invoice } = await import("../models/invoice.model");
  const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");
  const { PlatformCoupon } = await import("../models/platformCoupon.model");
  const { PlatformCouponRedemption } = await import(
    "../models/platformCouponRedemption.model"
  );

  const user: any = await User.findOne({ email: EMAIL }).lean();
  if (!user) throw new Error(`User ${EMAIL} not found`);

  const coupon: any = await PlatformCoupon.findOne({ code: COUPON }).lean();
  if (!coupon) throw new Error(`Coupon ${COUPON} not found`);
  if ((coupon.cycleCount ?? 1) < 3) {
    throw new Error(
      `${COUPON} grants ${coupon.cycleCount} cycle(s), not 3 — refusing to run.`
    );
  }

  const client: any = await ThirdPartyClient.findOne({ name: CLIENT_NAME });
  if (!client) throw new Error(`Third-party client "${CLIENT_NAME}" not found`);

  // Already has one? Never stack a second subscription on the same person.
  const existing = await Invoice.find({
    userId: user._id,
    "lineItems.itemType": "third_party_subscription",
    cancelledAt: { $in: [null, undefined] },
  })
    .select("invoiceNumber status parentInvoiceId")
    .lean();
  if (existing.length) {
    console.log(
      `${EMAIL} already has ${existing.length} NetworkChain invoice(s) — refusing to create another:`
    );
    for (const e of existing as any[]) console.log(`   ${e.invoiceNumber} ${e.status}`);
    await mongoose.disconnect();
    return;
  }

  console.log(`${confirm ? "EXECUTING" : "DRY RUN"}\n`);
  console.log(`  user     ${user.name} <${user.email}>  (${user.country ?? "?"})`);
  console.log(`  coupon   ${coupon.code} — ${coupon.discountValue}% off × ${coupon.cycleCount} cycles`);
  console.log(`  product  ${PRODUCT_CODE} via ${CLIENT_NAME}`);
  console.log(`  effect   3 monthly cycles at ${usd(0)}, then billing resumes at the normal rate`);

  if (!confirm) {
    console.log("\nDry run only. Re-run with --confirm.");
    await mongoose.disconnect();
    return;
  }

  const { createThirdPartyInvoice } = await import("../services/thirdPartyInvoice");
  const invoice: any = await createThirdPartyInvoice({
    client,
    customerEmail: EMAIL,
    productCode: PRODUCT_CODE,
    couponCode: COUPON,
    // Required, not optional: `invoices` carries a UNIQUE index on
    // (thirdPartyClientId, thirdPartyExternalId) and it is not sparse, so
    // every invoice omitting this stores `null` — and the second one for a
    // given client collides with E11000. It doubles as the idempotency key,
    // so re-running this script returns the same invoice instead of granting
    // a second subscription.
    externalId: EXTERNAL_ID,
    metadata: {
      grantedBy: "support",
      grantReason: "3-month NetworkChain grant",
    },
  });

  // Re-read: the zero-pay path mutates and fulfils after creation.
  const fresh: any = await Invoice.findById(invoice._id).lean();
  console.log(`\n  invoice  ${fresh.invoiceNumber}`);
  console.log(`     subtotal ${usd(fresh.subtotal)}  discount ${usd(fresh.discount)}  total ${usd(fresh.totalAmount)}`);
  console.log(`     status ${fresh.status}  recurring=${fresh.isRecurring}  nextDue ${fresh.nextDueDate?.toISOString?.().slice(0, 10)}`);

  const red: any = await PlatformCouponRedemption.findOne({
    parentInvoiceId: fresh._id,
  }).lean();

  // The whole point of the exercise: filed on the ROOT, or cycles 2-3 silently
  // never get discounted.
  if (!red) {
    console.error(
      "\n  *** REDEMPTION NOT FILED ON THE ROOT — cycles 2 and 3 would be charged. Investigate before telling the member. ***"
    );
  } else {
    console.log(`     redemption ${red.couponCode} cycleCount=${red.cycleCount} keyed on parentInvoiceId ✅`);
  }
  if (fresh.totalAmount !== 0) {
    console.error(`  *** total is ${usd(fresh.totalAmount)}, expected $0.00 ***`);
  }

  // ── Wait for the partner webhook before closing the connection ──────────
  //
  // `createThirdPartyInvoice` dispatches `invoice.paid` fire-and-forget, and
  // `deliverInvoiceWebhook` ALSO returns before its own retry loop has run.
  // Disconnecting here kills the POST mid-flight: the invoice is perfect on
  // our side while the partner never hears about it, so the member shows as
  // inactive on NetworkChain with nothing in our data to suggest a problem.
  // That is precisely what happened on the first run of this script — it left
  // `webhookDelivery.attempts: 0` and needed a manual redelivery.
  const deadline = Date.now() + 90_000;
  let wd: any = {};
  process.stdout.write("  waiting for the NetworkChain webhook");
  while (Date.now() < deadline) {
    const row: any = await Invoice.findById(fresh._id).select("webhookDelivery").lean();
    wd = row?.webhookDelivery ?? {};
    if (wd.deliveredAt) break;
    if ((wd.attempts ?? 0) >= 4) break; // retry loop exhausted
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("");
  console.log(`     webhook attempts=${wd.attempts ?? 0} lastStatus=${wd.lastStatus ?? "-"} delivered=${wd.deliveredAt?.toISOString?.() ?? "NOT DELIVERED"}`);
  if (!wd.deliveredAt) {
    console.error(
      "  *** The partner was NOT told. They will show this member as inactive.\n" +
      "      Re-send with: npx tsx src/scripts/redeliver-thirdparty-webhook.ts " +
      `${fresh.invoiceNumber} --confirm ***`
    );
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
