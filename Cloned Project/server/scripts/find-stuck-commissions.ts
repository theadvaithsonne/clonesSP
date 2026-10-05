/**
 * Find every PAID whitelabel_addon / cryptosub invoice where the
 * commission never fired (whitelabelCommissionAt / cryptosubCommissionAt
 * absent) — i.e., stuck-state invoices victim of the E11000 bug we
 * just fixed.
 *
 * Read-only. Doesn't touch anything.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";

async function run() {
  await mongoose.connect(env.MONGODB_URI);

  console.log(`\n═══ Stuck whitelabel_addon invoices ═══`);
  const wl: any[] = await Invoice.find({
    "lineItems.itemType": "whitelabel_addon",
    status: "paid",
    "metadata.whitelabelCommissionAt": { $exists: false },
  })
    .select("_id invoiceNumber paidAt userId organizationId totalAmount metadata.whitelabelActivatedAt metadata.whitelabelCommissionSkipped")
    .sort({ paidAt: -1 })
    .lean();
  console.log(`Found ${wl.length}`);
  for (const i of wl) {
    console.log(
      `  • ${i.invoiceNumber} (${i._id})  paidAt=${i.paidAt?.toISOString?.() || "?"}  totalAmount=${i.totalAmount}  activated=${!!i.metadata?.whitelabelActivatedAt}  skipReason=${i.metadata?.whitelabelCommissionSkipped || "(none — E11000 stuck)"}`,
    );
  }

  console.log(`\n═══ Stuck cryptosub invoices ═══`);
  const cs: any[] = await Invoice.find({
    "lineItems.itemType": "cryptosub",
    status: "paid",
    "metadata.cryptosubCommissionAt": { $exists: false },
  })
    .select("_id invoiceNumber paidAt userId organizationId totalAmount metadata.cryptosubActivatedAt metadata.cryptosubCommissionSkipped")
    .sort({ paidAt: -1 })
    .lean();
  console.log(`Found ${cs.length}`);
  for (const i of cs) {
    console.log(
      `  • ${i.invoiceNumber} (${i._id})  paidAt=${i.paidAt?.toISOString?.() || "?"}  totalAmount=${i.totalAmount}  activated=${!!i.metadata?.cryptosubActivatedAt}  skipReason=${i.metadata?.cryptosubCommissionSkipped || "(none — E11000 stuck)"}`,
    );
  }

  // Also check any paid invoices with orphan whitelabel_* commission dedupeKeys
  // (partial credits that leaked despite bug — belt-and-braces).
  console.log(`\n═══ Any orphan commission dedupeKeys across all invoices? ═══`);
  const { WalletTransaction } = await import("../models/walletTransaction.model");
  const anyOrphan = await WalletTransaction.aggregate([
    {
      $match: {
        "metadata.dedupeKey": {
          $regex: /^(whitelabel|cryptosub)_(direct|cascade|platform)/,
        },
      },
    },
    {
      $group: {
        _id: "$metadata.invoiceId",
        count: { $sum: 1 },
        kinds: { $addToSet: "$metadata.kind" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);
  console.log(`Distinct invoiceIds with commission txs (top 20 by count):`);
  for (const g of anyOrphan) {
    console.log(`  • ${g._id}  count=${g.count}  kinds=${g.kinds.join(", ")}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
