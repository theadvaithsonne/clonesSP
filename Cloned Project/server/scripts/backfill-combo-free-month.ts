/**
 * Grant the 24-hour free-first-month combo to buyers whose checkout never
 * stamped the intent.
 *
 * Two checkout endpoints mint the $25 Unilevel Plus invoice and only
 * `/checkout/create-combo-invoice` stamps `metadata.combo`. `fulfillInvoice`
 * gates the free month on that field, so anyone routed through
 * `/checkout/create-order` silently missed the offer regardless of how fast
 * they paid — one buyer paid two minutes after completing his profile and got
 * nothing. services/invoice.ts now re-checks the window at fulfilment so this
 * cannot recur; this script settles the people who already missed out.
 *
 * Eligibility — all four must hold:
 *   1. an ACTIVE UnilevelPlusPurchase they PAID for (paymentId not `assigned_`,
 *      so reserve-gifted seats are excluded — nobody paid for those)
 *   2. the 24h window was OPEN at their purchase moment (comboWindowFor,
 *      honouring any admin offerExpiresAtOverride)
 *   3. no `combo_free_first_month` invoice already
 *   4. purchased within --days (default 4)
 *
 * Grants via activateComboFreeFirstMonth — the same call the live path makes,
 * so recipients get exactly what a correctly-stamped checkout produced: a $0
 * paid first cycle plus the next-cycle invoice. Idempotent on (clientId,
 * buyerId), so re-running cannot double-grant.
 *
 * Safe by default: prints what it WOULD do and exits. Pass --confirm to write.
 *
 * Usage (from roam-backend/):
 *   npx tsx src/scripts/backfill-combo-free-month.ts
 *   npx tsx src/scripts/backfill-combo-free-month.ts --days=4 --confirm
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { Invoice } from "../models/invoice.model";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import { resolveComboClient, comboClientProblem } from "../services/comboClient";
import { comboWindowFor } from "../services/comboWindow";
import { activateComboFreeFirstMonth } from "../services/comboActivation";

const label = (u: any) => `${u?.name || "(no name)"} <${u?.email}>`;

async function run() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const daysArg = args.find((a) => a.startsWith("--days="));
  const fromArg = args.find((a) => a.startsWith("--from="));
  const toArg = args.find((a) => a.startsWith("--to="));

  // --from/--to express a calendar range ("everyone who paid this month"),
  // which a relative --days window cannot: 29 days back from the 29th starts
  // in the previous month and would sweep in July buyers.
  let cutoff: Date;
  let upper: Date | null = null;
  let rangeLabel: string;
  if (fromArg) {
    cutoff = new Date(`${fromArg.split("=")[1]}T00:00:00.000Z`);
    if (Number.isNaN(cutoff.getTime())) {
      console.error("--from must be YYYY-MM-DD");
      process.exit(1);
    }
    if (toArg) {
      upper = new Date(`${toArg.split("=")[1]}T23:59:59.999Z`);
      if (Number.isNaN(upper.getTime())) {
        console.error("--to must be YYYY-MM-DD");
        process.exit(1);
      }
    }
    rangeLabel = `${cutoff.toISOString().slice(0, 10)} → ${
      upper ? upper.toISOString().slice(0, 10) : "now"
    }`;
  } else {
    const days = daysArg ? Number(daysArg.split("=")[1]) : 4;
    if (!Number.isFinite(days) || days <= 0) {
      console.error("--days must be a positive number");
      process.exit(1);
    }
    cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    rangeLabel = `last ${days} day(s)`;
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected to Mongo (db: ${mongoose.connection.name})`);
  console.log(`   window: purchases ${rangeLabel}\n`);

  // Which subscription does the combo sell? Resolved by NAME (isComboDefault),
  // falling back to "the only active client" — the same resolver the live
  // fulfilment path uses, so this script grants exactly what it would have.
  //
  // It used to count active clients here and bail unless there was exactly
  // one. That is the very bug this script cleans up after: activating a second
  // client (GarageGo, 10 Sep 2026) silently switched the offer off, and it
  // also switched off the tool for repairing the damage.
  const combo = await resolveComboClient();
  if (!combo.client) {
    console.error(`❌ ${comboClientProblem(combo.reason)}. Refusing to guess.`);
    process.exit(1);
  }
  const client = combo.client;
  console.log(
    `🎁 Granting: ${client.name} (${client._id}) — resolved by ${combo.reason}\n`,
  );

  const purchases = await UnilevelPlusPurchase.find({ status: "active" })
    .select("userId amount paymentId purchasedAt createdAt")
    .lean<any[]>();

  const eligible: any[] = [];
  const skipped = { assigned: 0, outOfWindow: 0, hasCombo: 0, tooOld: 0, noUser: 0 };

  for (const p of purchases) {
    const boughtAt = p.purchasedAt || p.createdAt;
    const when = boughtAt ? new Date(boughtAt) : null;
    if (!when || when < cutoff || (upper && when > upper)) {
      skipped.tooOld++;
      continue;
    }
    if (String(p.paymentId || "").startsWith("assigned_")) {
      skipped.assigned++;
      continue;
    }
    const u = await User.findById(p.userId)
      .select("name email profileCompletedAt offerExpiresAtOverride")
      .lean<any>();
    if (!u) {
      skipped.noUser++;
      continue;
    }
    const win = comboWindowFor(u, new Date(boughtAt));
    if (!win.open) {
      skipped.outOfWindow++;
      continue;
    }
    const existing = await Invoice.findOne({
      userId: u._id,
      "metadata.kind": "combo_free_first_month",
    })
      .select("_id")
      .lean();
    if (existing) {
      skipped.hasCombo++;
      continue;
    }
    // The $25 invoice that should have carried the combo. Organic grants
    // record it as metadata.triggerInvoiceId, so resolve it here rather than
    // leaving backfilled rows with a blank trigger. The reserve paymentId
    // embeds it (`reserve_<invoiceId>_<n>`); otherwise fall back to the
    // buyer's own unilevel_plus invoice.
    let triggerInvoiceId: string | undefined;
    const m = String(p.paymentId || "").match(/^reserve_([0-9a-f]{24})_/);
    if (m) {
      triggerInvoiceId = m[1];
    } else {
      const inv = await Invoice.findOne({
        userId: u._id,
        "lineItems.itemType": "unilevel_plus",
      })
        .sort({ createdAt: 1 })
        .select("_id")
        .lean<any>();
      triggerInvoiceId = inv ? String(inv._id) : undefined;
    }

    eligible.push({ user: u, purchase: p, boughtAt: new Date(boughtAt), triggerInvoiceId });
  }

  eligible.sort((a, b) => b.boughtAt - a.boughtAt);

  console.log(`Scanned ${purchases.length} active licences.`);
  console.log(
    `   skipped: ${skipped.tooOld} outside the date range, ${skipped.assigned} assigned seats, ` +
      `${skipped.outOfWindow} bought after their 24h closed, ${skipped.hasCombo} already have it` +
      (skipped.noUser ? `, ${skipped.noUser} orphaned` : ""),
  );
  console.log(`\n=== OWED THE FREE MONTH (${eligible.length}) ===`);
  for (const e of eligible) {
    console.log(
      `   ${label(e.user).padEnd(52)} bought ${e.boughtAt.toISOString().slice(0, 16)}  ${e.purchase.paymentId}`,
    );
  }

  if (eligible.length === 0) {
    console.log(`\n✅ Nothing to backfill.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(
    `\nℹ️  Each grant mints a $0 paid first cycle AND the next-cycle invoice,\n` +
      `   exactly as a correctly-stamped checkout does. Anyone with a saved card\n` +
      `   will be auto-charged for that next cycle when it falls due.`,
  );

  if (!confirm) {
    console.log(`\n🔍 DRY RUN — nothing written. Re-run with --confirm to apply.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  let granted = 0;
  let alreadyThere = 0;
  const failures: string[] = [];
  for (const e of eligible) {
    try {
      const result = await activateComboFreeFirstMonth({
        buyerId: String(e.user._id),
        clientId: String(client._id),
        triggerInvoiceId: e.triggerInvoiceId as any,
        freeFirstCycle: true,
      });
      if (result.alreadyExisted) {
        alreadyThere++;
        console.log(`   ↩︎  ${label(e.user)} — already had one`);
      } else {
        granted++;
        console.log(
          `   ✅ ${label(e.user)} — ${result.invoice.invoiceNumber}`,
        );
      }
    } catch (err: any) {
      failures.push(`${label(e.user)}: ${err?.message ?? err}`);
      console.error(`   ❌ ${label(e.user)}: ${err?.message ?? err}`);
    }
  }

  console.log(
    `\n✅ Granted ${granted}, already present ${alreadyThere}, failed ${failures.length}`,
  );
  if (failures.length) {
    console.log(`\nFailures:\n - ${failures.join("\n - ")}`);
  }

  await mongoose.disconnect();
  process.exit(failures.length ? 1 : 0);
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
