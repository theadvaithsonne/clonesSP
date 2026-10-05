/**
 * MIGRATION: flip `gstInclusive` to false on non-INR founder-sold items.
 *
 * Why this exists
 * ---------------
 * GST used to be gated on the ITEM's currency: `shouldApplyGstForChannel()`
 * returned true only for INR, so for a USD-priced item the `gstInclusive`
 * flag had no effect whatsoever. Every model defaults it to `true`, which
 * means USD founders are carrying a stored `true` they never considered —
 * they priced in USD without thinking about Indian GST at all.
 *
 * GST is now gated on the BUYER's country. Left untouched, that stored
 * `true` would suddenly mean "my $100 already includes GST", so an Indian
 * buyer would pay $100 and the founder would net $84.75 — a silent 18% pay
 * cut on listings priced before the rule existed.
 *
 * Flipping these to `false` (= "add GST on top") preserves what the founder
 * actually intended: an Indian buyer pays $118 and the founder still nets
 * their $100. Buyers outside India are unaffected either way.
 *
 * Scope
 * -----
 *   Channel, Course, Workshop, Product — where currency is NOT "INR"
 *   (case-insensitive), including docs with no currency set at all, since
 *   every model defaults currency to "USD".
 *
 *   INR items are left alone: their `gstInclusive` was always meaningful and
 *   the founder answered it knowingly.
 *
 *   Items already set to `false` are skipped (no-op, keeps the run idempotent).
 *
 * Usage
 * -----
 *   Dry run (default — reports counts, writes nothing):
 *     npx tsx src/scripts/migrate-usd-items-gst-exclusive.ts
 *
 *   Apply:
 *     npx tsx src/scripts/migrate-usd-items-gst-exclusive.ts --apply
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
dotenv.config();

const APPLY = process.argv.includes("--apply");

// Non-INR = anything that isn't INR, including unset/null/empty.
const NON_INR_FILTER = {
  $or: [
    { currency: { $exists: false } },
    { currency: null },
    { currency: "" },
    { currency: { $not: /^inr$/i } },
  ],
};

// Only the ones that would actually change.
const NEEDS_FLIP = { gstInclusive: { $ne: false } };

const COLLECTIONS = [
  { label: "Channels", name: "channels" },
  { label: "Courses", name: "courses" },
  { label: "Workshops", name: "workshops" },
  { label: "Products", name: "products" },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  console.log("=".repeat(72));
  console.log(
    `Migrate non-INR items → gstInclusive:false   [${APPLY ? "APPLY" : "DRY RUN"}]`
  );
  console.log(`Mongo: ${mongoose.connection.host} / ${db.databaseName}`);
  console.log("=".repeat(72));

  let grandTotal = 0;
  let grandFlipped = 0;

  for (const { label, name } of COLLECTIONS) {
    const col = db.collection(name);

    const total = await col.countDocuments({});
    const inr = await col.countDocuments({ currency: /^inr$/i });
    const nonInr = await col.countDocuments(NON_INR_FILTER);
    const toFlip = await col.countDocuments({
      ...NON_INR_FILTER,
      ...NEEDS_FLIP,
    });
    const alreadyExclusive = nonInr - toFlip;

    console.log(`\n${label}  (${name})`);
    console.log(`  total documents          : ${total}`);
    console.log(`  INR — untouched          : ${inr}`);
    console.log(`  non-INR                  : ${nonInr}`);
    console.log(`    already exclusive      : ${alreadyExclusive}`);
    console.log(`    TO FLIP → exclusive    : ${toFlip}`);

    // Sanity: the two buckets must account for every document.
    if (inr + nonInr !== total) {
      console.log(
        `  ⚠️  ${total - inr - nonInr} document(s) matched neither bucket — inspect before applying.`
      );
    }

    // A small sample so the operator can eyeball what's being changed.
    if (toFlip > 0) {
      const sample = await col
        .find({ ...NON_INR_FILTER, ...NEEDS_FLIP })
        .project({ title: 1, name: 1, currency: 1, price: 1, gstInclusive: 1 })
        .limit(5)
        .toArray();
      console.log(`  sample:`);
      for (const s of sample as any[]) {
        console.log(
          `    - ${(s.title || s.name || "(untitled)").toString().slice(0, 48)}` +
            `  ${s.currency ?? "(unset)"} ${s.price ?? "?"}` +
            `  gstInclusive=${s.gstInclusive ?? "(unset)"}`
        );
      }
    }

    if (APPLY && toFlip > 0) {
      const result = await col.updateMany(
        { ...NON_INR_FILTER, ...NEEDS_FLIP },
        { $set: { gstInclusive: false } }
      );
      console.log(`  ✅ modified: ${result.modifiedCount}`);
      grandFlipped += result.modifiedCount;
    }

    grandTotal += toFlip;
  }

  console.log("\n" + "=".repeat(72));
  if (APPLY) {
    console.log(`Done. Flipped ${grandFlipped} of ${grandTotal} candidate document(s).`);
    if (grandFlipped !== grandTotal) {
      console.log(
        `⚠️  Flipped count differs from the candidate count — re-run the dry run to confirm convergence.`
      );
    }
  } else {
    console.log(
      `DRY RUN — nothing written. ${grandTotal} document(s) would be flipped.`
    );
    console.log(`Re-run with --apply to write.`);
  }
  console.log("=".repeat(72));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
