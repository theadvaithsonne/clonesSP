/**
 * Migrate `franchise_sub_territories` docs that were inserted with
 * ObjectId `_id` to String `_id` (matching the model schema, matching
 * the other 57 rows in the collection).
 *
 * Background: 4 India sub-territories (Bengaluru Urban, Bengaluru Rural,
 * Hyderabad, Visakhapatnam) were seeded with `new ObjectId()` instead of
 * a hex-string _id like the rest. The Mongoose model declares
 * `_id: { type: String }`, so `FranchiseSubTerritory.findById(str)`
 * misses those 4 rows — the route at franchiseProgram.ts:491
 * (loadCatalogEntity) then 404s with "Catalog entity not found" when a
 * founder tries to assign one of them.
 *
 * The fix: insert a copy of each stuck row with `_id = ObjectId.toHexString()`
 * (same 24 chars, but as a plain String), then delete the ObjectId original.
 * Referential integrity is preserved because franchise_territory_assignments
 * stores geoEntityId as a String (matches either type when compared).
 *
 * Idempotent: bails cleanly when zero stuck rows remain.
 *
 * Usage:
 *   npx tsx src/scripts/fix-subterritory-objectids.ts            # dry-run (default)
 *   npx tsx src/scripts/fix-subterritory-objectids.ts --apply    # actually write
 */

import "dotenv/config";
import mongoose, { Types } from "mongoose";

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const col = db.collection("franchise_sub_territories");

  const mode = APPLY ? "LIVE (--apply)" : "DRY-RUN (no writes)";
  console.log(`Mode: ${mode}`);

  const stuck = await col.find({ _id: { $type: "objectId" } }).toArray();
  console.log(`\nStuck rows (ObjectId _id): ${stuck.length}`);
  if (stuck.length === 0) {
    console.log("Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  // Referential safety check — for each stuck row, count references from
  // franchise_territory_assignments (both String and ObjectId forms just
  // in case a caller stored either).
  console.log("\nReferential check:");
  const assignmentsCol = db.collection("franchise_territory_assignments");
  for (const doc of stuck) {
    const idHex = String(doc._id);
    const asString = await assignmentsCol.countDocuments({
      geoEntityId: idHex,
    });
    const asObjectId = await assignmentsCol.countDocuments({
      geoEntityId: new Types.ObjectId(idHex) as any,
    });
    console.log(
      `  ${doc.name.padEnd(20)} → assignments: string=${asString}, objectId=${asObjectId}`,
    );
  }
  console.log(
    "\n(String refs will keep working after migration because the new _id has the same hex chars.\n Any ObjectId refs would need updating separately — but we expect zero of those.)",
  );

  // Also: check the target _id (String hex) doesn't already exist. If it
  // did, insertOne would 11000-dup and we'd bail out cleanly.
  console.log("\nCollision check (target String _id must not already exist):");
  for (const doc of stuck) {
    const hex = String(doc._id);
    const exists = await col.findOne({ _id: hex as any });
    console.log(
      `  ${doc.name.padEnd(20)} → target _id "${hex}" ${exists ? "!!! EXISTS !!!" : "clear"}`,
    );
  }

  console.log(`\nPlan (${stuck.length} rows):`);
  for (const doc of stuck) {
    console.log(
      `  - ${doc.name.padEnd(20)}  ObjectId(${doc._id}) → String("${doc._id}")`,
    );
  }

  if (!APPLY) {
    console.log("\nDry-run complete. Rerun with --apply to execute.");
    await mongoose.disconnect();
    return;
  }

  console.log("\nApplying migration...\n");
  let ok = 0;
  let failed = 0;
  for (const doc of stuck) {
    const oldId = doc._id;
    const newId = String(doc._id); // Mongoose ObjectId.toString() → 24-char hex
    const clone = { ...doc, _id: newId };
    try {
      // Insert first — safe: if insert fails (e.g., dup), the original is untouched.
      await col.insertOne(clone as any);
      // Only after successful insert, delete the ObjectId original.
      await col.deleteOne({ _id: oldId } as any);
      console.log(`  ✓ ${doc.name}: migrated`);
      ok++;
    } catch (err: any) {
      console.error(`  ✗ ${doc.name}: FAILED — ${err?.message ?? err}`);
      failed++;
    }
  }

  console.log(`\nDone: ${ok} migrated, ${failed} failed.`);

  // Post-migration verification: how many ObjectId _ids left?
  const remaining = await col.countDocuments({ _id: { $type: "objectId" } });
  console.log(`ObjectId _ids remaining in collection: ${remaining}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
