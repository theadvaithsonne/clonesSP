/**
 * Backfill: catalog ownerEmail ← Garage FranchiseGlobalAssignment (active)
 *
 * Idempotent. Safe to re-run. For every ACTIVE Garage global assignment,
 * ensure the corresponding catalog doc's `ownerEmail` matches. Reports rows
 * that already agreed, rows updated, rows where catalog doc was missing.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-catalog-ownership.ts            # dry-run
 *   npx tsx src/scripts/backfill-catalog-ownership.ts --apply    # write
 */
import "dotenv/config";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { FranchiseGlobalAssignment } = await import(
    "../models/franchiseGlobalAssignment.model"
  );
  const { FranchiseCountry } = await import("../models/franchiseCountry.model");
  const { FranchiseTerritory } = await import(
    "../models/franchiseTerritory.model"
  );
  const { FranchiseSubTerritory } = await import(
    "../models/franchiseSubTerritory.model"
  );

  console.log(`\nMode: ${APPLY ? "LIVE (--apply)" : "DRY-RUN"}\n`);

  const active = await FranchiseGlobalAssignment.find({ status: "active" })
    .select("geoLevel geoEntityId geoEntityName ownerEmail")
    .lean<any[]>();
  console.log(`Active Garage assignments: ${active.length}`);
  if (active.length === 0) {
    console.log(`Nothing to backfill.`);
    await mongoose.disconnect();
    return;
  }

  const modelFor = (lvl: string) =>
    lvl === "country"
      ? FranchiseCountry
      : lvl === "territory"
        ? FranchiseTerritory
        : FranchiseSubTerritory;

  let toWrite: any[] = [];
  let alreadyOk = 0;
  let missing = 0;

  for (const a of active) {
    const Model: any = modelFor(a.geoLevel);
    const catalog = (await Model.findById(a.geoEntityId)
      .select("_id ownerEmail name")
      .lean()) as any;
    if (!catalog) {
      console.log(
        `  ⚠ catalog missing: ${a.geoLevel} ${a.geoEntityId} (${a.geoEntityName})`,
      );
      missing++;
      continue;
    }
    const current = String(catalog.ownerEmail || "").toLowerCase();
    const desired = String(a.ownerEmail || "").toLowerCase();
    if (current === desired) {
      alreadyOk++;
      continue;
    }
    console.log(
      `  ${a.geoLevel.padEnd(13)} ${a.geoEntityName?.padEnd(20)} catalog="${catalog.ownerEmail || "(none)"}" → "${desired}"`,
    );
    toWrite.push({ a, Model, current });
  }

  console.log(
    `\nSummary: ${alreadyOk} already-in-sync, ${toWrite.length} to write, ${missing} missing catalog docs`,
  );

  if (!APPLY) {
    console.log(`\n(Re-run with --apply to persist the writes above.)`);
    await mongoose.disconnect();
    return;
  }

  if (toWrite.length === 0) {
    console.log(`\nNothing to apply.`);
    await mongoose.disconnect();
    return;
  }

  console.log(`\nWriting ${toWrite.length} catalog rows...\n`);
  let ok = 0;
  let failed = 0;
  for (const { a, Model } of toWrite) {
    try {
      await Model.updateOne(
        { _id: a.geoEntityId },
        { $set: { ownerEmail: String(a.ownerEmail).toLowerCase() } },
      );
      console.log(`  ✓ ${a.geoLevel} ${a.geoEntityName}`);
      ok++;
    } catch (err: any) {
      console.error(
        `  ✗ ${a.geoLevel} ${a.geoEntityName}: ${err?.message ?? err}`,
      );
      failed++;
    }
  }
  console.log(`\nDone: ${ok} written, ${failed} failed.`);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
