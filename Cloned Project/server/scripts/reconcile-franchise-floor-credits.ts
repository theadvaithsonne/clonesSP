/**
 * Reconcile the "franchise floor" credit for every paid franchise_program
 * / franchise_territory invoice that was paid via store_wallet.
 *
 * Background:
 *   The fulfilment code for `franchise_program` and `franchise_territory`
 *   was written assuming payment-gateway settlement — the $650 floor lands
 *   in the platform's bank externally, no internal wallet split needed.
 *   For `paymentPlatform: "store_wallet"` invoices, the buyer's wallet is
 *   debited but nothing credits the platform wallet, so the money vanishes
 *   from the internal ledger.
 *
 *   Code fix landed in services/invoice.ts (franchise_program +
 *   franchise_territory case blocks) — future invoices credit the floor
 *   at fulfilment time, tagged with `metadata.franchiseFloor` for
 *   idempotency.
 *
 *   This script retroactively creates those credits for invoices that
 *   were paid BEFORE the fix. Idempotent via the same metadata key.
 *
 * Usage:
 *   npx tsx src/scripts/reconcile-franchise-floor-credits.ts            # dry-run
 *   npx tsx src/scripts/reconcile-franchise-floor-credits.ts --apply    # execute
 */

import "dotenv/config";
import mongoose from "mongoose";
import { FRANCHISE_PRICE_USD } from "../models/franchiseProgram.model";
import { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } from "../services/commission";
import { User } from "../models/user.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { creditStoreWallet } from "../services/wallet";

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  console.log(`Mode: ${APPLY ? "LIVE (--apply)" : "DRY-RUN"}`);

  const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id email")
    .lean<{ _id: any; email: string }>();
  if (!platformUser) {
    console.error(`Platform user ${PLATFORM_USER_EMAIL} not found — aborting.`);
    process.exit(1);
  }
  console.log(`Platform recipient: ${platformUser.email} (${platformUser._id})`);
  console.log(`Platform orgId:     ${PLATFORM_ORG_ID}\n`);

  const candidates = await db
    .collection("invoices")
    .find({
      status: "paid",
      paymentPlatform: "store_wallet",
      "lineItems.itemType": { $in: ["franchise_program", "franchise_territory"] },
    })
    .toArray();

  console.log(`Candidate paid franchise invoices (store_wallet): ${candidates.length}`);

  const toCredit: Array<{
    invoice: any;
    itemType: string;
    itemName: string;
    floorUSD: number;
  }> = [];

  for (const inv of candidates) {
    const item = (inv.lineItems || []).find(
      (li: any) =>
        li.itemType === "franchise_program" ||
        li.itemType === "franchise_territory",
    );
    if (!item) continue;

    const existing = await WalletTransaction.findOne({
      "metadata.franchiseFloor.invoiceId": inv._id.toString(),
    }).lean();
    if (existing) {
      console.log(
        `  ✓ ${inv.invoiceNumber} already has floor credit — skip (${item.itemType})`,
      );
      continue;
    }

    const paidUSD = inv.totalAmount / 100;
    // franchise_program: full paid amount is platform revenue (no markup concept).
    // franchise_territory: floor is min(FRANCHISE_PRICE_USD, paid), excess to founder (which the
    //   fulfilment code already credits separately).
    const floorUSD =
      item.itemType === "franchise_program"
        ? paidUSD
        : Math.min(FRANCHISE_PRICE_USD, paidUSD);

    if (floorUSD <= 0) {
      console.log(
        `  ⚠ ${inv.invoiceNumber} floor=$0 — skip (${item.itemType}, paid=$${paidUSD})`,
      );
      continue;
    }

    toCredit.push({ invoice: inv, itemType: item.itemType, itemName: item.itemName, floorUSD });
  }

  console.log(`\nWill credit ${toCredit.length} invoices:\n`);
  let total = 0;
  for (const c of toCredit) {
    console.log(
      `  +$${c.floorUSD.toFixed(2).padStart(8)}  ${c.invoice.invoiceNumber}  ${c.itemType}: ${c.itemName}  buyer=${c.invoice.customerEmail}`,
    );
    total += c.floorUSD;
  }
  console.log(`\nTotal to credit to ${platformUser.email}: +$${total.toFixed(2)}`);

  if (!APPLY) {
    console.log("\nDry-run complete. Rerun with --apply to execute.");
    await mongoose.disconnect();
    return;
  }

  if (toCredit.length === 0) {
    console.log("\nNothing to apply.");
    await mongoose.disconnect();
    return;
  }

  console.log("\nApplying credits...\n");
  let ok = 0;
  let failed = 0;
  for (const c of toCredit) {
    try {
      const { transaction } = await creditStoreWallet(
        c.invoice.userId.toString(),
        platformUser._id.toString(),
        PLATFORM_ORG_ID,
        c.floorUSD,
        `Franchise ${c.itemType === "franchise_program" ? "program" : "territory"} floor (restitution): ${c.itemName}`,
        `Invoice ${c.invoice.invoiceNumber} — store_wallet paid; retroactive floor credit`,
      );
      await WalletTransaction.updateOne(
        { _id: transaction._id },
        {
          $set: {
            "metadata.franchiseFloor": {
              kind:
                c.itemType === "franchise_program"
                  ? "program_floor"
                  : "territory_floor",
              invoiceId: c.invoice._id.toString(),
              invoiceNumber: c.invoice.invoiceNumber,
              restitution: true,
            },
          },
        },
      );
      console.log(`  ✓ ${c.invoice.invoiceNumber}: +$${c.floorUSD.toFixed(2)} credited`);
      ok++;
    } catch (err: any) {
      console.error(`  ✗ ${c.invoice.invoiceNumber}: FAILED — ${err?.message ?? err}`);
      failed++;
    }
  }

  console.log(`\nDone: ${ok} credited, ${failed} failed. Total: +$${total.toFixed(2)}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
