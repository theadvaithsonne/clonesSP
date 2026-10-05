/**
 * Ensures every product in the Bat246 org has the "bat246_entry" tag.
 *
 * Targets by organizationId (most reliable) — not by name.
 * Safe to re-run: uses $addToSet so the tag is never duplicated.
 *
 * Run: npx ts-node src/bat246/scripts/tagBat246Products.ts
 *
 * To tag specific product IDs only:
 *   BAT246_PRODUCT_IDS=id1,id2 npx ts-node src/bat246/scripts/tagBat246Products.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

// Bat246 org ID — verified from DB (organizations collection, name: "Bat246")
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";

const SPECIFIC_IDS = process.env.BAT246_PRODUCT_IDS
  ? process.env.BAT246_PRODUCT_IDS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;

  let query: any;

  if (SPECIFIC_IDS.length > 0) {
    query = { _id: { $in: SPECIFIC_IDS.map((id) => new mongoose.Types.ObjectId(id)) } };
    console.log(`Targeting ${SPECIFIC_IDS.length} specific product(s): ${SPECIFIC_IDS.join(", ")}`);
  } else {
    query = { organizationId: new mongoose.Types.ObjectId(BAT246_ORG_ID) };
    console.log(`Targeting all products in Bat246 org (${BAT246_ORG_ID})...`);
  }

  const products = await db.collection("products")
    .find(query)
    .project({ _id: 1, name: 1, tags: 1 })
    .toArray();

  if (products.length === 0) {
    console.log("No products found in the Bat246 org.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\nFound ${products.length} product(s):`);
  for (const p of products) {
    const alreadyTagged = Array.isArray(p.tags) && p.tags.includes("bat246_entry");
    console.log(
      `  [${p._id}] "${p.name}"  tags: [${(p.tags || []).join(", ")}]` +
      (alreadyTagged ? "  ✓ already tagged" : "  → will tag")
    );
  }

  const ids = products.map((p) => p._id);
  const result = await db.collection("products").updateMany(
    { _id: { $in: ids } },
    { $addToSet: { tags: "bat246_entry" } }
  );

  console.log(`\nDone. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

  // Print final state
  const updated = await db.collection("products")
    .find({ _id: { $in: ids } })
    .project({ _id: 1, name: 1, tags: 1 })
    .toArray();

  console.log("\nFinal tag state:");
  for (const p of updated) {
    console.log(`  [${p._id}] "${p.name}"  tags: [${(p.tags || []).join(", ")}]`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
