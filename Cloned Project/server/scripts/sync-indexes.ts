/**
 * Manual, deliberate index-sync — the replacement for Mongoose's
 * default autoIndex on prod.
 *
 * With `autoIndex: false` (see src/db/mongo.ts) the app no longer
 * silently builds indexes on boot. Adding a new index to a schema
 * has zero effect until this script runs — which is the intended
 * shape, because on a large collection (WalletTransaction is the
 * canonical offender) an unexpected `createIndex` at deploy time
 * pins CPU on the DB and cascades to every wallet endpoint.
 *
 * Usage:
 *   # Sync ALL models' indexes:
 *   npm run indexes:sync
 *
 *   # Sync a specific model:
 *   npm run indexes:sync -- WalletTransaction
 *
 * Behaviour:
 *   • Loads models by importing the app's route/service tree — same
 *     way the running server sees them.
 *   • Calls `Model.syncIndexes()` per model: creates missing
 *     indexes, drops indexes no longer in the schema. This is the
 *     mongoose-recommended primitive, and MongoDB 4.2+ builds in
 *     the background so writes are not blocked.
 *   • Logs progress + timing per model. On completion, prints the
 *     final index list for anything that changed.
 *
 * When to run:
 *   • After adding / removing / modifying `schema.index(...)` calls.
 *   • Never during a peak-traffic window on a large collection —
 *     background builds still burn CPU. Pick a quiet hour.
 *   • Safe to re-run — a syncIndexes with no schema changes is a
 *     cheap no-op.
 *
 * NOT a substitute for a schema migration for existing data — this
 * only manages the INDEX definitions, not the row shape.
 */
import "dotenv/config";
import mongoose from "mongoose";

async function main() {
  const targetModel = process.argv[2]?.trim();
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  console.log(`[sync-indexes] connected`);

  // Force-load every registered model by walking src/models/. Model
  // files register their schema with mongoose as a side effect of
  // being required. No routes/index barrel exists in this repo, so
  // walking the models directory is the reliable path.
  //
  // Runs from either src/ (tsx) or dist/ (production). `__dirname`
  // resolves to whichever tree the script was launched from, and
  // path.resolve("..") lifts to that tree's root.
  const path = await import("path");
  const fs = await import("fs");
  const modelsDir = path.resolve(__dirname, "..", "models");
  const entries = fs.readdirSync(modelsDir);
  let loaded = 0;
  for (const f of entries) {
    // Skip TS type-defs, tests, and support files that start with
    // an underscore (e.g. _catalogHooks.ts).
    if (f.startsWith("_")) continue;
    if (!/\.(m|c)?js$/.test(f) && !/\.ts$/.test(f)) continue;
    if (f.endsWith(".d.ts")) continue;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require(path.join(modelsDir, f));
      loaded += 1;
    } catch (err) {
      console.warn(
        `[sync-indexes] failed to load ${f}: ${(err as Error).message}`,
      );
    }
  }
  console.log(`[sync-indexes] loaded ${loaded} model file(s)`);

  const models = mongoose.modelNames();
  const targets = targetModel
    ? models.filter((n) => n.toLowerCase() === targetModel.toLowerCase())
    : models;

  if (targetModel && targets.length === 0) {
    console.error(
      `[sync-indexes] no model matches "${targetModel}". Available:\n  ${models.join("\n  ")}`,
    );
    process.exit(2);
  }

  console.log(
    `[sync-indexes] syncing ${targets.length} model(s)${targetModel ? " (filtered)" : ""}`,
  );

  let ok = 0;
  let failed = 0;
  for (const name of targets) {
    const Model = mongoose.model(name);
    const started = Date.now();
    try {
      // syncIndexes returns array of dropped index names. Empty
      // array means "created what was missing, nothing to drop."
      const dropped = await Model.syncIndexes();
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      const summary =
        dropped.length > 0
          ? `dropped ${dropped.length}: ${dropped.join(", ")}`
          : `up to date`;
      console.log(`  ✓ ${name.padEnd(30)} ${elapsed.padStart(6)}s  ${summary}`);
      ok += 1;
    } catch (err) {
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      console.error(
        `  ✗ ${name.padEnd(30)} ${elapsed.padStart(6)}s  ${(err as Error).message}`,
      );
      failed += 1;
    }
  }

  console.log(`\n[sync-indexes] done  ok=${ok}  failed=${failed}`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 3 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
