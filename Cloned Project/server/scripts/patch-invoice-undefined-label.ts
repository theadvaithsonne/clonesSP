/**
 * Targeted patch for INV-MT2T5TAC-Q1ZL (philip). The past-window monthly
 * combo path in routes/unilevel-plus.ts used to template raw `termMonths`
 * (undefined) into the line-item text, rendering:
 *   name: "Unilevel Plus + undefined months of NetworkChain"
 *   desc: "$25 Unilevel Plus licence + undefined-month GU_SUB_36 subscription ($36), with the first month free"
 *
 * The bug is fixed for future invoices. This one is already minted; patch
 * lineItems[0].itemName / itemDescription in place. Money fields untouched.
 *
 * Reads the invoice's own metadata (combo.termMonths, bundle.subUsd, etc)
 * to build the correct strings — no hardcoding.
 *
 * Usage:
 *   npx tsx src/scripts/patch-invoice-undefined-label.ts <invoiceId>
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { Invoice } from "../models/invoice.model";

async function run() {
  const [id] = process.argv.slice(2);
  if (!id) {
    console.error(
      "Usage: npx tsx src/scripts/patch-invoice-undefined-label.ts <invoiceId>",
    );
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected`);

  const inv: any = await Invoice.findById(id).lean();
  if (!inv) {
    console.error(`❌ No invoice ${id}`);
    process.exit(1);
  }

  const line = inv.lineItems?.[0];
  if (!line || line.itemType !== "unilevel_plus") {
    console.error(
      `❌ Line 0 itemType "${line?.itemType}" — must be unilevel_plus`,
    );
    process.exit(1);
  }

  const combo = inv.metadata?.combo || {};
  const bundle = inv.metadata?.bundle || {};

  // termMonths in metadata is the source of truth; falls back to 1 if
  // absent (past-window monthly path stamped combo.termMonths as
  // undefined too, but always resolved to 1 month).
  const termMonths: number = Number(combo.termMonths) || 1;
  const clientName: string = combo.clientName || "NetworkChain";
  const productCode: string = combo.productCode || "";
  const licenceUsd: number = Number(bundle.licenceUsd) || 25;
  const subUsd: number = Number(bundle.subUsd) || 0;
  const freeFirstCycle: boolean = !!combo.freeFirstCycle;

  const label =
    termMonths === 1 ? "Monthly" : `${termMonths} months`;
  const descLabel =
    termMonths === 1 ? "Monthly" : `${termMonths}-month`;

  const newName = `Unilevel Plus + ${label} of ${clientName}`;
  const newDesc = `$${licenceUsd} Unilevel Plus licence + ${descLabel} ${productCode} subscription ($${subUsd})${freeFirstCycle ? ", with the first month free" : ""}`;

  console.log(`📄 ${inv.invoiceNumber}  itemType=${line.itemType}`);
  console.log(`   metadata.combo.termMonths=${combo.termMonths} (resolved → ${termMonths})`);
  console.log(`   metadata.combo.freeFirstCycle=${freeFirstCycle}`);
  console.log(`   metadata.bundle.subUsd=${subUsd}\n`);
  console.log(`   OLD name: ${line.itemName}`);
  console.log(`   NEW name: ${newName}\n`);
  console.log(`   OLD desc: ${line.itemDescription}`);
  console.log(`   NEW desc: ${newDesc}\n`);

  const r = await Invoice.updateOne(
    { _id: id },
    {
      $set: {
        "lineItems.0.itemName": newName,
        "lineItems.0.itemDescription": newDesc,
        "metadata.labelPatchedAt": new Date(),
      },
    },
  );
  console.log(
    `✅ Patched ${r.modifiedCount} invoice (matched ${r.matchedCount})`,
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
