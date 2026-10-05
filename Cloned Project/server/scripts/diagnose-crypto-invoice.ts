/**
 * Ops-only helper for the crypto payment pipeline. Three modes:
 *
 *   npx tsx src/scripts/diagnose-crypto-invoice.ts <invoiceIdOrNumber>
 *     Prints the invoice + every CryptoPaymentRequest attached to it
 *     (status, expected atomic amount, TTL). Best first stop when a
 *     payment "was received but the invoice isn't paid."
 *
 *   npx tsx src/scripts/diagnose-crypto-invoice.ts \
 *     --reconcile <invoiceIdOrNumber> <requestId> <txHash> [<fromAddress>]
 *     Manually flips the named pending request to matched → runs the
 *     same markMatched path the poller would, so fulfillInvoice fires
 *     identically. Use ONLY after cross-checking the on-chain tx.
 *     Dry-run by default; pass --apply to persist.
 *
 *   npx tsx src/scripts/diagnose-crypto-invoice.ts --sweep <isoDate>
 *     Expires every `pending` CryptoPaymentRequest created BEFORE the
 *     given ISO date. Intended for use post-deploy of the INR→USD
 *     amount fix — the pre-fix rows all have inflated expected
 *     amounts that will never match a real payment, and the (now
 *     amount-aware) createRequest idempotency guard will supersede
 *     them naturally on the next FE fetch. Dry-run by default; pass
 *     --apply to persist.
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose, { Types } from "mongoose";
import { Invoice } from "../models/invoice.model";
import { CryptoPaymentRequest } from "../models/cryptoPaymentRequest.model";

const APPLY = process.argv.includes("--apply");

function stripArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return undefined;
  const val = process.argv[idx + 1];
  return val;
}

async function loadInvoice(idOrNumber: string) {
  if (Types.ObjectId.isValid(idOrNumber)) {
    const byId = await Invoice.findById(idOrNumber).lean();
    if (byId) return byId as any;
  }
  return (await Invoice.findOne({
    invoiceNumber: idOrNumber,
  }).lean()) as any;
}

async function diagnose(invoiceIdOrNumber: string) {
  const inv = await loadInvoice(invoiceIdOrNumber);
  if (!inv) {
    console.log(`Invoice ${invoiceIdOrNumber} not found`);
    return;
  }

  console.log(`\n─── Invoice ${inv.invoiceNumber} ─────────────────────────`);
  console.log(`  _id:            ${inv._id}`);
  console.log(`  status:         ${inv.status}`);
  console.log(`  totalAmount:    ${inv.totalAmount} (in ${inv.itemCurrency} smallest unit)`);
  console.log(`  itemCurrency:   ${inv.itemCurrency}`);
  console.log(`  paymentCurrency:${inv.paymentCurrency || "(unset)"}`);
  console.log(`  paymentPlatform:${inv.paymentPlatform || "(unset)"}`);
  console.log(`  metadata.cryptoAmountUsdCents: ${inv.metadata?.cryptoAmountUsdCents ?? "(unset)"}`);
  console.log(`  metadata.cryptoTxHash:         ${inv.metadata?.cryptoTxHash ?? "(unset)"}`);
  console.log(`  currencyConversion:            ${JSON.stringify(inv.currencyConversion || null)}`);

  const requests = await CryptoPaymentRequest.find({
    invoiceId: inv._id,
  })
    .sort({ createdAt: 1 })
    .lean();

  console.log(`\n─── CryptoPaymentRequests (${requests.length}) ───────────`);
  const now = new Date();
  for (const r of requests as any[]) {
    const ttl = r.expiresAt
      ? `${Math.round((new Date(r.expiresAt).getTime() - now.getTime()) / 60000)}m`
      : "-";
    console.log(
      `  - ${r._id}  chain=${r.chain}/${r.coin}  status=${r.status}  ttl=${ttl}`,
    );
    console.log(
      `      expected: ${r.expectedAmountAtomic} (${r.expectedAmountDisplay})`,
    );
    if (r.matchedTxHash) {
      console.log(
        `      matched:  tx=${r.matchedTxHash}  at=${r.matchedAt}  from=${r.matchedFromAddress || "-"}`,
      );
    }
  }

  console.log(
    `\nNext: if a real on-chain tx exists whose amount matches one of the`,
  );
  console.log(
    `above, reconcile with --reconcile <invoiceId> <requestId> <txHash>`,
  );
  console.log(
    `(dry-run by default; add --apply to persist). If the amount doesn't`,
  );
  console.log(
    `match ANY row, the customer paid the wrong amount OR a stale pre-fix`,
  );
  console.log(
    `row is/was in play — expire the stale row via --sweep <isoDate>.`,
  );
}

async function reconcile(
  invoiceIdOrNumber: string,
  requestId: string,
  txHash: string,
  fromAddress?: string,
) {
  const inv = await loadInvoice(invoiceIdOrNumber);
  if (!inv) throw new Error(`Invoice ${invoiceIdOrNumber} not found`);
  if (!Types.ObjectId.isValid(requestId)) {
    throw new Error(`requestId ${requestId} is not a valid ObjectId`);
  }

  const req: any = await CryptoPaymentRequest.findById(requestId).lean();
  if (!req) throw new Error(`Request ${requestId} not found`);
  if (String(req.invoiceId) !== String(inv._id)) {
    throw new Error(
      `Request ${requestId} belongs to invoice ${req.invoiceId}, not ${inv._id}`,
    );
  }

  console.log(
    `Reconciling ${req._id} (${req.chain}/${req.coin}, expected=${req.expectedAmountAtomic}) with tx ${txHash}`,
  );
  console.log(`Current request status: ${req.status}`);
  console.log(`Current invoice status: ${inv.status}`);

  if (!APPLY) {
    console.log(
      `\n[DRY RUN] Would call markMatched({ requestId, txHash, fromAddress }).`,
    );
    console.log(
      `          That runs the atomic status flip + fulfillInvoice (same`,
    );
    console.log(`          path as the poller).`);
    console.log(`\nRerun with --apply to persist.`);
    return;
  }

  const { markMatched } = await import("../services/cryptoPaymentRequest");
  await markMatched({ requestId, txHash, fromAddress });
  console.log(`\n✓ markMatched completed. Verify:`);
  console.log(
    `  npx tsx src/scripts/diagnose-crypto-invoice.ts ${inv.invoiceNumber}`,
  );
}

async function sweep(beforeIso: string) {
  const before = new Date(beforeIso);
  if (isNaN(before.getTime())) {
    throw new Error(`--sweep argument must be a valid ISO date: got "${beforeIso}"`);
  }
  const rows = await CryptoPaymentRequest.find({
    status: "pending",
    createdAt: { $lt: before },
  })
    .select("_id chain coin expectedAmountAtomic expectedAmountDisplay createdAt")
    .lean();

  console.log(
    `\n${rows.length} pending CryptoPaymentRequest(s) created before ${before.toISOString()}:`,
  );
  for (const r of rows as any[]) {
    console.log(
      `  - ${r._id}  ${r.chain}/${r.coin}  ${r.expectedAmountDisplay}  createdAt=${r.createdAt}`,
    );
  }
  if (rows.length === 0) return;

  if (!APPLY) {
    console.log(`\n[DRY RUN] Would flip all ${rows.length} to status="expired".`);
    console.log(`Rerun with --apply to persist.`);
    return;
  }
  const res = await CryptoPaymentRequest.updateMany(
    { _id: { $in: rows.map((r: any) => r._id) }, status: "pending" },
    { $set: { status: "expired" } },
  );
  console.log(`\n✓ Expired ${res.modifiedCount} pending row(s).`);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const sweepArg = stripArg("--sweep");
  const reconcileFlag = process.argv.includes("--reconcile");

  if (sweepArg) {
    await sweep(sweepArg);
  } else if (reconcileFlag) {
    // Positional args after --reconcile: invoiceId requestId txHash [fromAddress]
    const idx = process.argv.indexOf("--reconcile");
    const invoiceArg = process.argv[idx + 1];
    const requestArg = process.argv[idx + 2];
    const txArg = process.argv[idx + 3];
    const fromArg = process.argv[idx + 4];
    if (!invoiceArg || !requestArg || !txArg) {
      throw new Error(
        `Usage: --reconcile <invoiceIdOrNumber> <requestId> <txHash> [<fromAddress>] [--apply]`,
      );
    }
    await reconcile(invoiceArg, requestArg, txArg, fromArg);
  } else {
    const invoiceArg = process.argv[2];
    if (!invoiceArg) {
      throw new Error(
        `Usage: <invoiceIdOrNumber>  |  --reconcile ... |  --sweep <isoDate>`,
      );
    }
    await diagnose(invoiceArg);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
