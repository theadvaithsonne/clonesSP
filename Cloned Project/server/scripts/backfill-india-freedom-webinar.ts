/**
 * BACKFILL: enrol every India-based user into "Your Freedom Webinar".
 *
 * WHO COUNTS AS INDIAN
 *   The SAME determination used to decide whether to charge GST —
 *   `utils/gstBuyerRegion.ts#resolveBuyerGstRegion`. Not a bespoke country
 *   regex: that resolver already handles "India" / "IN" / casing / trailing
 *   whitespace, falls back to PIN code and state when country is absent, and
 *   correctly does NOT match "British Indian Ocean Territory" (7 users) or
 *   "Indian " (1) — both of which a naive /india/i would sweep in.
 *
 *   `paymentCurrency` is deliberately NOT passed. Its "INR ⇒ India" fallback
 *   is right at a checkout, where the buyer just picked a currency, but in a
 *   backfill there is no payment — supplying one would be inventing a signal.
 *
 *   Extended by ONE historical GST fact: users with a paid invoice carrying
 *   `paymentCurrency: "INR"` or `metadata.gst.buyerRegion: "IN"`. We already
 *   formally taxed those people as Indian at checkout, so excluding them
 *   because their profile country is blank would contradict our own books.
 *
 * WHAT IT WRITES
 *   One WorkshopRegistration per user: status "registered", enrollmentType
 *   "full", hasPaid true (the webinar is free).
 *
 *   It does NOT mint the $0 "workshop_checkout" invoice the interactive
 *   `registerForWorkshop()` path creates, because that path passes
 *   `notifyBuyer: true` — which would fire a confirmation email to every
 *   backfilled user. Several hundred unsolicited emails about a webinar
 *   nobody signed up for is a deliverability problem, and an invoice implies
 *   a transaction the user never made. Access comes from the registration
 *   row; the invoice is only a paper trail.
 *
 * IDEMPOTENT
 *   WorkshopRegistration has NO unique index — the model comments say
 *   uniqueness is "enforced via application logic". So this reads the
 *   existing enrolled set first and skips it. Safe to re-run.
 *
 * Usage:
 *   Dry run (default):  npx tsx src/scripts/backfill-india-freedom-webinar.ts
 *   Apply:              npx tsx src/scripts/backfill-india-freedom-webinar.ts --apply
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const APPLY = process.argv.includes("--apply");

const WORKSHOP_ID = "6a8c430abf0ad3c0ff3ef431"; // Your Freedom Webinar

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const { resolveBuyerGstRegion } = await import("../utils/gstBuyerRegion");
  const { WorkshopRegistration } = await import(
    "../models/workshopRegistration.model"
  );

  console.log(
    `\nIndia → "Your Freedom Webinar" backfill — ${APPLY ? "APPLY" : "DRY RUN"}\n` +
      "=".repeat(72)
  );

  const wid = new Types.ObjectId(WORKSHOP_ID);
  const workshop: any = await db.collection("workshops").findOne({ _id: wid });
  if (!workshop) throw new Error("Workshop not found");
  const orgId = workshop.organizationId || workshop.orgId;
  console.log(`Workshop: ${workshop.title} (free=${workshop.isFree}, recurring=${workshop.isRecurring})`);

  // ── 1. Resolve India via the GST determination ──
  const users = await db
    .collection("users")
    .find({})
    .project({ email: 1, country: 1, state: 1, city: 1, postalCode: 1 })
    .toArray();

  const indian = new Map<string, string>(); // userId -> reason
  for (const u of users as any[]) {
    const r = await resolveBuyerGstRegion({ buyerUser: u });
    if (r.inIndia) indian.set(String(u._id), `gst:${r.source}`);
  }
  console.log(`\nGST resolver says in-India: ${indian.size}`);

  // ── 2. Extend with users we have ALREADY charged Indian GST ──
  const chargedIndian = await db.collection("invoices").distinct("userId", {
    status: "paid",
    $or: [{ paymentCurrency: "INR" }, { "metadata.gst.buyerRegion": "IN" }],
  });
  let addedByHistory = 0;
  for (const uid of chargedIndian) {
    const k = String(uid);
    if (!indian.has(k)) {
      indian.set(k, "gst:prior_inr_invoice");
      addedByHistory++;
    }
  }
  console.log(`Added by prior Indian-GST invoice:  ${addedByHistory}`);
  console.log(`TOTAL India cohort:                 ${indian.size}`);

  // ── 3. Skip anyone already enrolled ──
  const enrolled = await WorkshopRegistration.distinct("userId", {
    workshopId: wid,
  });
  const enrolledSet = new Set(enrolled.map((x: any) => String(x)));
  const todo = [...indian.keys()].filter((id) => !enrolledSet.has(id));

  console.log(`Already enrolled (skipped):         ${indian.size - todo.length}`);
  console.log(`NET NEW to enrol:                   ${todo.length}\n`);

  const byReason: Record<string, number> = {};
  for (const id of todo) {
    const r = indian.get(id)!;
    byReason[r] = (byReason[r] || 0) + 1;
  }
  console.log("Net-new by signal:");
  for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${k.padEnd(28)} ${v}`);
  }

  if (!APPLY) {
    const emailById = new Map(users.map((u: any) => [String(u._id), u.email]));
    console.log("\nSample of who would be enrolled:");
    for (const id of todo.slice(0, 8)) {
      console.log(`   ${String(emailById.get(id) || id).padEnd(38)} ${indian.get(id)}`);
    }
    console.log(`   … and ${Math.max(0, todo.length - 8)} more`);
    console.log("\nDRY RUN — nothing written. Re-run with --apply.\n");
    await mongoose.disconnect();
    return;
  }

  // ── 4. Write ──
  const now = new Date();
  const docs = todo.map((id) => ({
    workshopId: wid,
    userId: new Types.ObjectId(id),
    orgId: new Types.ObjectId(String(orgId)),
    status: "registered" as const,
    hasPaid: true, // free webinar
    registeredAt: now,
    enrolledAt: now,
    enrollmentType: "full" as const,
  }));

  let created = 0;
  const CHUNK = 200;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const slice = docs.slice(i, i + CHUNK);
    const res = await WorkshopRegistration.insertMany(slice, { ordered: false });
    created += res.length;
    console.log(`  inserted ${created}/${docs.length}`);
  }

  const finalCount = await WorkshopRegistration.countDocuments({ workshopId: wid });
  console.log(`\nCreated ${created}. Total registrations on this webinar: ${finalCount}\n`);

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
