// src/scripts/fix-hiren-nc-webhook-identity.ts
//
// Hiren's NetworkChain subscription is correct on OUR side — invoice paid,
// coverage valid, 3-cycle coupon filed on the chain root — and NetworkChain
// acknowledged our webhook with a 200. He still shows inactive on their side
// because of what the payload was MISSING.
//
// The webhook body carries `metadata: redactInternalKeys(invoice.metadata)`.
// 233 of the 249 NetworkChain root invoices carry `metadata.userId` (the
// GARAGE user id — verified: Khan's is 69e603ea…, which is his own Garage
// account) plus `metadata.orgId`. Hiren's carries NEITHER, because the normal
// flow has NetworkChain call our API and pass those ids themselves, whereas
// this subscription was created by calling the service directly from a script
// that never supplied them.
//
// So they received an invoice.paid for an email with no account identifiers
// attached, accepted it, and had nothing to link it to.
//
// This adds the two ids and re-sends. It does NOT touch money: the invoice,
// its $0 total, the coupon redemption and the due dates are all untouched.
//
//   npx tsx src/scripts/fix-hiren-nc-webhook-identity.ts            # dry run
//   npx tsx src/scripts/fix-hiren-nc-webhook-identity.ts --confirm

import "dotenv/config";
import mongoose from "mongoose";

const INVOICE_NUMBER = "INV-MUP9UFVJ-WKCQ";
const EMAIL = "h.sabalpara6844@gmail.com";
/** Hiren's Garage user id — the same kind of value Khan's invoice carries. */
const USER_ID = "6a3a1c90a520826319b30028";
/** Shapedream Labs LLP — the org he founded, mirroring Khan's own-org pattern. */
const ORG_ID = "6a68949d795ca3adbc6af3b5";

async function main() {
  const confirm = process.argv.includes("--confirm");
  await mongoose.connect(process.env.MONGODB_URI!);
  const { Invoice } = await import("../models/invoice.model");
  const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");

  const invoice: any = await Invoice.findOne({ invoiceNumber: INVOICE_NUMBER });
  if (!invoice) throw new Error(`${INVOICE_NUMBER} not found`);
  if (invoice.customerEmail !== EMAIL) {
    throw new Error(`${INVOICE_NUMBER} belongs to ${invoice.customerEmail}, not ${EMAIL}`);
  }
  const client: any = await ThirdPartyClient.findById(invoice.thirdPartyClientId);
  if (!client?.webhookUrl) throw new Error("NetworkChain client/webhookUrl missing");

  console.log(`${confirm ? "APPLYING" : "DRY RUN"}\n`);
  console.log(`  invoice   ${INVOICE_NUMBER} (${EMAIL})`);
  console.log(`  before    metadata.userId=${invoice.metadata?.userId ?? "(absent)"}  metadata.orgId=${invoice.metadata?.orgId ?? "(absent)"}`);
  console.log(`  adding    userId=${USER_ID}  orgId=${ORG_ID}`);
  console.log(`  then      re-send invoice.paid to ${client.name}`);

  if (!confirm) {
    console.log("\nDry run only. Re-run with --confirm.");
    await mongoose.disconnect();
    return;
  }

  // Merge, never replace: periodStart/periodEnd/termMonths/gst in there are
  // read by the partner and by our own renewal logic.
  await Invoice.updateOne(
    { _id: invoice._id },
    { $set: { "metadata.userId": USER_ID, "metadata.orgId": ORG_ID } }
  );
  const patched: any = await Invoice.findById(invoice._id);
  console.log(`\n  after     metadata.userId=${patched.metadata?.userId}  metadata.orgId=${patched.metadata?.orgId}`);

  // Re-send. `deliverInvoiceWebhook` returns BEFORE its own retry loop runs
  // (it ends fire-and-forget), so hold the connection open and watch the row
  // rather than disconnecting on the function returning — that is what lost
  // the first delivery entirely.
  const beforeAttempts = patched.webhookDelivery?.attempts ?? 0;
  const { deliverInvoiceWebhook } = await import("../services/thirdPartyWebhook");
  await deliverInvoiceWebhook(patched, client, "invoice.paid");

  const deadline = Date.now() + 90_000;
  let d: any = {};
  process.stdout.write("  re-sending");
  while (Date.now() < deadline) {
    const row: any = await Invoice.findById(invoice._id).select("webhookDelivery").lean();
    d = row?.webhookDelivery ?? {};
    if ((d.attempts ?? 0) > beforeAttempts) break;
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("");
  console.log(`  result    attempts=${d.attempts ?? 0} lastStatus=${d.lastStatus ?? "-"} delivered=${d.deliveredAt?.toISOString?.() ?? "-"}`);
  console.log(
    d.lastStatus && d.lastStatus >= 200 && d.lastStatus < 300
      ? "  ✅ re-sent with identifiers — ask NetworkChain to confirm he now shows active"
      : "  ❌ partner did not accept — check with NetworkChain"
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
