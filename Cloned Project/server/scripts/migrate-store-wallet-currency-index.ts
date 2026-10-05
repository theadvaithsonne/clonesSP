/**
 * One-shot migration: swap the StoreWallet unique index from
 * `(userId, orgId)` → `(userId, orgId, currency)`.
 *
 * Why: pre-migration, the compound-unique on `(userId, orgId)`
 * literally prevented multi-currency wallets from coexisting for the
 * same user in the same org. The cryptobrand multi-currency feature
 * needs to hold USD + INR + ETH + BTC side by side.
 *
 * Safety: NEVER changes any wallet document. Only touches indexes.
 * Idempotent — re-running after the first successful run does
 * nothing (checks existing index shape first).
 *
 * Usage (from roam-backend/):
 *   npx tsx src/scripts/migrate-store-wallet-currency-index.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { StoreWallet } from "../models/storeWallet.model";

const OLD_INDEX_NAME_CANDIDATES = ["userId_1_orgId_1"];
const NEW_INDEX_KEY = { userId: 1, orgId: 1, currency: 1 };
const NEW_INDEX_NAME = "userId_1_orgId_1_currency_1";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected to Mongo`);

  const coll = StoreWallet.collection;
  const existingIndexes = await coll.indexes();
  console.log(
    `📋 Existing indexes on ${coll.collectionName}:`,
    existingIndexes.map((i: any) => `${i.name} unique=${!!i.unique}`).join(", "),
  );

  // Drop the legacy unique index if present.
  for (const name of OLD_INDEX_NAME_CANDIDATES) {
    if (existingIndexes.some((i: any) => i.name === name)) {
      try {
        await coll.dropIndex(name);
        console.log(`🗑️  Dropped legacy index ${name}`);
      } catch (err: any) {
        console.error(`❌ Failed to drop ${name}:`, err?.message || err);
      }
    }
  }

  // Ensure the new (userId, orgId, currency) unique index exists.
  const hasNew = existingIndexes.some((i: any) => i.name === NEW_INDEX_NAME);
  if (hasNew) {
    console.log(`✅ New index ${NEW_INDEX_NAME} already present — no-op`);
  } else {
    await coll.createIndex(NEW_INDEX_KEY, {
      unique: true,
      name: NEW_INDEX_NAME,
    });
    console.log(`✅ Created new index ${NEW_INDEX_NAME}`);
  }

  const finalIndexes = await coll.indexes();
  console.log(
    `📋 Final indexes:`,
    finalIndexes.map((i: any) => `${i.name} unique=${!!i.unique}`).join(", "),
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
