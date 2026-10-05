// src/scripts/redeliver-thirdparty-webhook.ts
//
// Re-send the `invoice.paid` webhook for a third-party invoice whose delivery
// never landed, so the partner's own system learns about a subscription we
// already created on our side.
//
// Why this exists: `createThirdPartyInvoice` dispatches the webhook
// fire-and-forget — it is NOT awaited, so it runs after the call returns. A
// script that creates an invoice and then closes its Mongo connection kills
// that dispatch mid-flight, leaving `webhookDelivery.attempts: 0`. The invoice
// is perfect on our side (paid, coverage valid, redemption filed) while the
// partner shows the member as inactive, because they were never told. That is
// exactly what happened to h.sabalpara6844@gmail.com on 1 Oct 2026.
//
// `retryInvoiceWebhook` has the same fire-and-forget shape, so this calls
// `deliverInvoiceWebhook` directly and AWAITS it — the point is to still be
// connected when the POST completes, and to report the real outcome rather
// than "dispatched".
//
//   npx tsx src/scripts/redeliver-thirdparty-webhook.ts <invoiceNumber>
//   npx tsx src/scripts/redeliver-thirdparty-webhook.ts <invoiceNumber> --confirm

import "dotenv/config";
import mongoose from "mongoose";

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--confirm");
  const confirm = process.argv.includes("--confirm");
  const invoiceNumber = args[0];
  if (!invoiceNumber) throw new Error("usage: <invoiceNumber> [--confirm]");

  await mongoose.connect(process.env.MONGODB_URI!);
  const { Invoice } = await import("../models/invoice.model");
  const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");

  const invoice: any = await Invoice.findOne({ invoiceNumber });
  if (!invoice) throw new Error(`Invoice ${invoiceNumber} not found`);
  if (!invoice.thirdPartyClientId) {
    throw new Error(`${invoiceNumber} is not a third-party invoice`);
  }
  const client: any = await ThirdPartyClient.findById(invoice.thirdPartyClientId);
  if (!client) throw new Error("Third-party client not found");
  if (!client.webhookUrl) throw new Error(`${client.name} has no webhookUrl`);

  // Only `paid` produces invoice.paid; anything else would send the wrong event.
  if (invoice.status !== "paid") {
    throw new Error(
      `${invoiceNumber} is "${invoice.status}", not "paid" — refusing to send invoice.paid`
    );
  }

  const before = invoice.webhookDelivery ?? {};
  console.log(`${confirm ? "SENDING" : "DRY RUN"}`);
  console.log(`  invoice   ${invoiceNumber}  (${invoice.customerEmail})`);
  console.log(`  partner   ${client.name} -> ${client.webhookUrl}`);
  console.log(`  event     invoice.paid`);
  console.log(`  current   attempts=${before.attempts ?? 0} delivered=${before.deliveredAt ?? "never"} lastStatus=${before.lastStatus ?? "-"}`);

  if (before.deliveredAt) {
    console.log("\n  Already delivered once — nothing to do.");
    await mongoose.disconnect();
    return;
  }
  if (!confirm) {
    console.log("\nDry run only. Re-run with --confirm to send.");
    await mongoose.disconnect();
    return;
  }

  const { deliverInvoiceWebhook } = await import("../services/thirdPartyWebhook");
  // Awaiting this is NOT sufficient: the function ends by calling its own
  // `run()` without awaiting it (see the "Fire-and-forget" comment at the foot
  // of deliverInvoiceWebhook), so it returns before the first POST is even
  // made. Disconnecting here would kill the retry loop exactly as the grant
  // script did. So: kick it off, then hold the connection open and watch the
  // row until delivery is recorded.
  await deliverInvoiceWebhook(invoice, client, "invoice.paid");

  const deadlineMs = Date.now() + 90_000;
  let d: any = {};
  process.stdout.write("  waiting for delivery");
  while (Date.now() < deadlineMs) {
    const row: any = await Invoice.findById(invoice._id).select("webhookDelivery").lean();
    d = row?.webhookDelivery ?? {};
    if (d.deliveredAt) break;
    // Report genuine failures rather than spinning to the deadline: once the
    // retry loop has exhausted its attempts there is nothing more coming.
    if ((d.attempts ?? 0) >= 4 && !d.deliveredAt) break;
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("");
  console.log(`\n  result    attempts=${d.attempts ?? 0} lastStatus=${d.lastStatus ?? "-"} delivered=${d.deliveredAt?.toISOString?.() ?? "NOT DELIVERED"}`);
  if (d.lastError) console.log(`  error     ${d.lastError}`);
  console.log(d.deliveredAt ? "  ✅ partner acknowledged" : "  ❌ still not delivered — check the partner endpoint");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
