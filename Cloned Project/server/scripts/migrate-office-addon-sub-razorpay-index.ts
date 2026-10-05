/**
 * One-shot migration: rebuild the OfficeAddonSubscription
 * `razorpaySubscriptionId` unique index as SPARSE-unique.
 *
 * Why: prod's legacy index is a plain unique on
 * `razorpaySubscriptionId`, created before the invoice-driven
 * whitelabel/cryptosub flows existed. Non-sparse unique treats a
 * missing/null value as "the null value", so at most ONE doc without
 * a razorpaySubscriptionId can exist (Chamak's manual grant already
 * occupies that slot). Any second invoice-driven activation attempt
 * fails with E11000 → activation silently no-ops → commission never
 * fires.
 *
 * The Mongoose schema already declares this index as sparse-unique;
 * Mongoose does NOT auto-drop-and-recreate mismatched indexes on
 * connect, so we have to migrate deliberately.
 *
 * Safety: NEVER changes any document. Only touches indexes.
 * Idempotent — re-running is a no-op.
 *
 * Usage (from roam-backend/):
 *   npx tsx src/scripts/migrate-office-addon-sub-razorpay-index.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { OfficeAddonSubscription } from "../models/officeAddonSubscription.model";

const NEW_INDEX_KEY = { razorpaySubscriptionId: 1 };
const NEW_INDEX_NAME = "razorpaySubscriptionId_1";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected to Mongo`);

  const coll = OfficeAddonSubscription.collection;
  const existingIndexes = await coll.indexes();
  console.log(
    `📋 Existing indexes on ${coll.collectionName}:`,
    existingIndexes
      .map((i: any) => `${i.name} unique=${!!i.unique} sparse=${!!i.sparse}`)
      .join(", "),
  );

  const legacy = existingIndexes.find(
    (i: any) => i.name === NEW_INDEX_NAME,
  ) as any;

  if (legacy && legacy.unique && legacy.sparse) {
    console.log(
      `✅ Index ${NEW_INDEX_NAME} is already unique+sparse — no-op`,
    );
  } else {
    if (legacy) {
      try {
        await coll.dropIndex(NEW_INDEX_NAME);
        console.log(`🗑️  Dropped legacy index ${NEW_INDEX_NAME}`);
      } catch (err: any) {
        console.error(`❌ Failed to drop ${NEW_INDEX_NAME}:`, err?.message || err);
      }
    }
    await coll.createIndex(NEW_INDEX_KEY, {
      unique: true,
      sparse: true,
      name: NEW_INDEX_NAME,
    });
    console.log(`✅ Created ${NEW_INDEX_NAME} as unique+sparse`);
  }

  const finalIndexes = await coll.indexes();
  console.log(
    `📋 Final indexes:`,
    finalIndexes
      .map((i: any) => `${i.name} unique=${!!i.unique} sparse=${!!i.sparse}`)
      .join(", "),
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
