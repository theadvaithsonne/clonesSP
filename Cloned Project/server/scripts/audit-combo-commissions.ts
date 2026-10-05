/**
 * Read-only audit: walk every combo_free_first_month invoice and report on
 * whether commissions distributed as expected.
 *
 * Expected per combo activation:
 *   UP invoice ($25, status: paid)        → distributeUnilevelPlusCommission ran
 *   Combo invoice ($0, status: paid)      → NO distribution (zero-pay branch)
 *   Children at full price (cycle 2+)     → distributeThirdPartySubscription ran per cycle
 *
 * Run: `npx ts-node src/scripts/_audit-combo-commissions.ts`
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  const combos = await db.collection("invoices").find({
    "metadata.kind": "combo_free_first_month",
  }).toArray();

  console.log(`Found ${combos.length} combo invoice(s)\n`);
  if (combos.length === 0) {
    console.log("No combo activations yet — nothing to audit.");
    await mongoose.disconnect();
    return;
  }

  let problems = 0;

  for (const combo of combos) {
    const heading = `\n=== Combo invoice ${combo.invoiceNumber} (${combo._id}) ===`;
    console.log(heading);
    console.log(`buyer:           ${combo.customerEmail} (${combo.userId})`);
    console.log(`partner client:  ${combo.thirdPartyClientId}`);
    console.log(`status:          ${combo.status}`);
    console.log(`subtotal:        ${combo.subtotal}  (should be > 0 — full partner price in cents)`);
    console.log(`discount:        ${combo.discount}  (should equal subtotal)`);
    console.log(`totalAmount:     ${combo.totalAmount}  (should be 0 — free)`);
    console.log(`nextDueDate:     ${combo.nextDueDate}`);

    // Shape check
    if (combo.subtotal === 0) {
      console.log("  ⚠️  PROBLEM: subtotal is 0 — child cycles will also be 0 (forever-free bug)");
      problems++;
    } else if (combo.subtotal !== combo.discount) {
      console.log("  ⚠️  PROBLEM: discount does not equal subtotal — totalAmount math is off");
      problems++;
    }
    if (combo.totalAmount !== 0) {
      console.log("  ⚠️  PROBLEM: totalAmount is not 0 — buyer was charged for the freebie");
      problems++;
    }

    // Was commission CORRECTLY skipped on the combo invoice?
    const comboTpDist = await db.collection("commissiondistributions").findOne({
      paymentId: { $regex: `^tp_${combo._id.toString()}_` },
    });
    if (comboTpDist) {
      console.log(`  ⚠️  PROBLEM: third-party commission distributed for combo invoice (paymentId=${comboTpDist.paymentId}) — should have been skipped (it's free)`);
      problems++;
    } else {
      console.log(`  ✓ no third-party commission on combo invoice (correctly skipped)`);
    }

    // Did UP commission fire for the triggering $25 invoice?
    const triggerInvoiceId = combo.metadata?.triggerInvoiceId;
    if (triggerInvoiceId) {
      const trigger = await db.collection("invoices").findOne({ _id: new mongoose.Types.ObjectId(triggerInvoiceId) });
      console.log(`UP trigger invoice:  ${trigger?.invoiceNumber} status=${trigger?.status}`);
      const upDist = await db.collection("unilevelplusdistributions").find({
        $or: [
          { paymentId: { $regex: `^reserve_${triggerInvoiceId}_` } },
          { "metadata.invoiceId": triggerInvoiceId },
        ],
      }).toArray();
      if (upDist.length === 0) {
        console.log(`  ⚠️  PROBLEM: no UnilevelPlusDistribution for UP trigger invoice — comp tree didn't pay out on the $25`);
        problems++;
      } else {
        for (const d of upDist) {
          console.log(`  ✓ UP comp distributed: paymentId=${d.paymentId} saleAmount=$${d.saleAmount} levelRecipients=${(d.levelBonusRecipients || []).length}`);
        }
      }
    }

    // Children: each should be at full price + commission distributed per cycle
    const children = await db.collection("invoices").find({
      parentInvoiceId: combo._id,
    }).sort({ recurringPaymentNumber: 1 }).toArray();
    console.log(`children (cycle 2+): ${children.length}`);
    for (const c of children) {
      const expectedFull = combo.subtotal;
      const tag = c.totalAmount === expectedFull
        ? "✓"
        : `⚠️  PROBLEM (expected ${expectedFull}, got ${c.totalAmount})`;
      console.log(`  cycle ${c.recurringPaymentNumber}: total=${c.totalAmount} status=${c.status} kind=${c.metadata?.kind || '(none)'} ${tag}`);
      if (c.totalAmount !== expectedFull) problems++;
      if (c.metadata?.kind === "combo_free_first_month") {
        console.log(`    ⚠️  PROBLEM: child still carries combo_free_first_month marker — would skip commission`);
        problems++;
      }

      // For paid children, verify third-party commission distributed
      if (c.status === "paid" && c.totalAmount > 0) {
        const childDist = await db.collection("unilevelplusdistributions").findOne({
          paymentId: `tp_${c._id.toString()}_${c.recurringPaymentNumber}`,
        });
        if (childDist) {
          console.log(`    ✓ third-party UP comp distributed for this cycle (saleAmount=$${childDist.saleAmount})`);
        } else {
          console.log(`    ⚠️  PROBLEM: cycle ${c.recurringPaymentNumber} is paid but no UnilevelPlusDistribution found`);
          problems++;
        }
      }
    }
  }

  console.log(`\n${problems === 0 ? "✅ All combo activations look correct." : `❌ ${problems} problem(s) found across ${combos.length} combo invoice(s).`}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
