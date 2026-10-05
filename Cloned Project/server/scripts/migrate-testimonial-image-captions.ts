/**
 * One-off migration: converts every Bat246 Lost Money testimonial's
 * `images` field from the old shape (`string[]` of URLs) to the new one
 * (`{ url, caption }[]`), which is what bat246LostMoneyTestimonial.model.ts
 * now expects.
 *
 * Written via the raw MongoDB driver (not the Mongoose model) on purpose:
 * once the model's schema is updated to the new shape, reading a document
 * that still has plain-string entries through that model would fail to
 * cast. Going around the model for this one write sidesteps that — every
 * document is normalized on disk before anything ever reads it through
 * the new schema.
 *
 * Idempotent: an entry that's already `{ url, caption }` (object with a
 * string `url`) is left untouched, so this is safe to re-run.
 *
 * Run: npx ts-node src/scripts/migrate-testimonial-image-captions.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI environment variable not set");

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle after connect");

  const collection = db.collection("bat246lostmoneytestimonials");
  const docs = await collection.find({}).toArray();

  let migrated = 0;
  let alreadyOk = 0;
  let skippedEmpty = 0;

  for (const doc of docs) {
    const images = doc.images;
    if (!Array.isArray(images) || images.length === 0) {
      skippedEmpty++;
      continue;
    }

    const needsMigration = images.some((entry: any) => typeof entry === "string");
    if (!needsMigration) {
      alreadyOk++;
      continue;
    }

    const newImages = images.map((entry: any) => {
      if (typeof entry === "string") return { url: entry, caption: "" };
      // Already an object (e.g. re-running after a partial migration) —
      // keep as-is rather than risk clobbering a caption someone set.
      return entry;
    });

    await collection.updateOne({ _id: doc._id }, { $set: { images: newImages } });
    migrated++;
    console.log(`  - migrated "${doc.name}" (${doc._id}): ${images.length} image(s)`);
  }

  console.log(
    `\nDone — migrated ${migrated}, already correct ${alreadyOk}, no images ${skippedEmpty} (total ${docs.length}).`
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
