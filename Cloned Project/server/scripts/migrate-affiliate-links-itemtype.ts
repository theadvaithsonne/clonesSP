/**
 * Generalize AffiliateLink from channel-only to (itemType, itemId).
 *
 * Steps (idempotent, non-destructive to data):
 *   1. Backfill every legacy row → itemType: "channel", itemId: channelId,
 *      clickCount: 0 (where missing).
 *   2. Drop the legacy unique index { userId, orgId, channelId } — it would
 *      block product/office rows (null channelId collides).
 *   3. Create the new unique index { userId, orgId, itemType, itemId }.
 *
 * autoIndex is ON in this app, so RUN THIS BEFORE deploying the new schema:
 * a deploy-first would try to build the new unique index over un-backfilled
 * rows (itemId undefined → duplicate-key) and silently fail.
 *
 * Usage (from roam-backend/):
 *   npx tsx src/scripts/migrate-affiliate-links-itemtype.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";

const OLD_UNIQUE = "userId_1_orgId_1_channelId_1";
const NEW_UNIQUE_KEY = { userId: 1, orgId: 1, itemType: 1, itemId: 1 } as const;

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB");
  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongoose connection has no .db handle");
  const coll = db.collection("affiliatelinks");

  const total = await coll.countDocuments({});
  const needsBackfill = await coll.countDocuments({ itemId: { $exists: false } });
  console.log(`affiliatelinks: ${total} total, ${needsBackfill} need backfill`);

  // 1. Backfill itemType/itemId from channelId (aggregation-pipeline update).
  if (needsBackfill > 0) {
    const r = await coll.updateMany(
      { itemId: { $exists: false } },
      [
        {
          $set: {
            itemType: { $ifNull: ["$itemType", "channel"] },
            itemId: "$channelId",
            clickCount: { $ifNull: ["$clickCount", 0] },
          },
        },
      ],
    );
    console.log(`Backfilled ${r.modifiedCount} rows`);
  }

  // Safety: nothing should be left without an itemId before we build the index.
  const stillMissing = await coll.countDocuments({ itemId: { $exists: false } });
  if (stillMissing > 0) {
    throw new Error(
      `${stillMissing} rows still missing itemId (channelId null?) — aborting before index swap`,
    );
  }

  // 2. Drop the legacy unique index if present.
  const indexes = await coll.indexes();
  if (indexes.some((i) => i.name === OLD_UNIQUE)) {
    await coll.dropIndex(OLD_UNIQUE);
    console.log(`Dropped legacy index ${OLD_UNIQUE}`);
  } else {
    console.log(`Legacy index ${OLD_UNIQUE} not present — skipping drop`);
  }

  // 3. Create the new unique index (idempotent).
  await coll.createIndex(NEW_UNIQUE_KEY, { unique: true });
  console.log("Created unique index { userId, orgId, itemType, itemId }");

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
