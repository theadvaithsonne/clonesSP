/**
 * Catalog → Qdrant backfill via the existing outbox pipeline.
 *
 * Walks every sellable / office collection and enqueues an `upsert`
 * row in CatalogOutbox for each existing document. The dispatcher
 * (already running on the roam-backend process) drains these rows
 * and delivers webhooks to NetworkChainApi, which embeds + upserts
 * into Qdrant `catalog_items`.
 *
 * Use this when:
 *  - Standing up a fresh Qdrant instance (dev / staging) and need
 *    every existing catalog item indexed.
 *  - Repointing roam-backend's MONGODB_URI at a different DB
 *    snapshot — the dispatcher only fires on changes, so existing
 *    rows need an explicit kick to re-index.
 *  - Suspecting Qdrant drift vs Mongo and wanting a forced re-emit.
 *
 * Idempotent: enqueueCatalogChange does an upsert on (itemType,
 * itemId), so a re-run flips any "sent" rows back to "pending" and
 * the dispatcher re-delivers. No duplicate Qdrant points (NC-side
 * upsert is keyed by itemId).
 *
 * Run:
 *   npx tsx src/scripts/backfill-catalog-outbox.ts
 *
 * Optional env:
 *   BACKFILL_TYPES=product,course   # comma-separated; defaults to ALL
 *   BACKFILL_LIMIT=50               # cap per type for smoke testing
 *   BACKFILL_BATCH_SIZE=200         # docs per Mongo cursor batch
 */
import { JobPosting } from "../models/jobPosting.model";
import "dotenv/config";
import mongoose from "mongoose";

import { env } from "../config/env";
import { Product } from "../models/product.model";
import { Course } from "../models/course.model";
import { Workshop } from "../models/workshop.model";
import { Channel } from "../models/channel.model";
import { Service } from "../models/service.model";
import { CallOffering } from "../models/callOffering.model";
import { Organization } from "../models/organization.model";
import {
  enqueueCatalogChange,
} from "../services/catalogOutbox.service";
import type { CatalogOutboxItemType } from "../models/catalogOutbox.model";

interface TypeConfig {
  type: CatalogOutboxItemType;
  // Mongoose Model<any> — kept as `any` because the seven models share
  // no TS supertype and we only need .find().cursor() on them.
  model: any;
}

const ALL_TYPES: TypeConfig[] = [
  { type: "product", model: Product },
  { type: "course", model: Course },
  { type: "workshop", model: Workshop },
  { type: "channel", model: Channel },
  { type: "service", model: Service },
  { type: "call", model: CallOffering },
  { type: "office", model: Organization },
  // Every posting, not just the live ones — the index decides sellability from
  // `reward` and `status`, and a posting that goes live later must already be
  // known or it stays invisible until someone edits it.
  { type: "job", model: JobPosting },
];

async function _backfillType(
  cfg: TypeConfig,
  limit?: number,
): Promise<{ enqueued: number; failed: number }> {
  let enqueued = 0;
  let failed = 0;
  const cursor = cfg.model
    .find({}, { _id: 1 })
    .lean()
    .cursor({ batchSize: Number(process.env.BACKFILL_BATCH_SIZE) || 200 });
  for await (const doc of cursor) {
    if (limit && enqueued >= limit) break;
    const id = String((doc as any)._id || "");
    if (!id) continue;
    try {
      await enqueueCatalogChange(cfg.type, id, "upsert");
      enqueued++;
      if (enqueued % 100 === 0) {
        console.log(`  …${cfg.type}: enqueued ${enqueued}`);
      }
    } catch (err) {
      failed++;
      console.warn(
        `  ✗ ${cfg.type}/${id} enqueue failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { enqueued, failed };
}

async function run(): Promise<void> {
  if (!env.MONGODB_URI) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  const requestedTypes = (process.env.BACKFILL_TYPES || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const types =
    requestedTypes.length > 0
      ? ALL_TYPES.filter((t) => requestedTypes.includes(t.type))
      : ALL_TYPES;
  if (types.length === 0) {
    console.error(
      `BACKFILL_TYPES filter matched nothing. Valid: ${ALL_TYPES.map((t) => t.type).join(", ")}`,
    );
    process.exit(1);
  }

  const limit = Number(process.env.BACKFILL_LIMIT) || undefined;

  console.log("→ Connecting to MongoDB…");
  await mongoose.connect(env.MONGODB_URI);
  console.log("✓ connected\n");

  console.log(
    `Backfilling catalog outbox for types: ${types.map((t) => t.type).join(", ")}${
      limit ? ` (limit ${limit}/type)` : ""
    }\n`,
  );

  const totals = { enqueued: 0, failed: 0 };
  for (const cfg of types) {
    console.log(`→ ${cfg.type}…`);
    const r = await _backfillType(cfg, limit);
    totals.enqueued += r.enqueued;
    totals.failed += r.failed;
    console.log(`  ✓ ${cfg.type}: enqueued=${r.enqueued} failed=${r.failed}\n`);
  }

  console.log("──────── summary ────────");
  console.log(`Total enqueued:           ${totals.enqueued}`);
  console.log(`Total failed:             ${totals.failed}`);
  console.log("─────────────────────────");
  console.log(
    "\nThe outbox dispatcher (running on roam-backend) will deliver these to",
  );
  console.log(
    "NetworkChainApi over the next few minutes. Watch [catalog-dispatcher]",
  );
  console.log(
    "logs and `db.catalogoutboxes.countDocuments({status: 'pending'})` to",
  );
  console.log("track drainage.\n");

  await mongoose.disconnect();
  console.log("✓ enqueue complete");
}

if (require.main === module) {
  run().catch((err) => {
    console.error("✗ backfill failed:", err);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}

export { run };
