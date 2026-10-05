/**
 * One-off: sets the "test" BAT246 webinar's thumbnail to the BAT246 Player
 * ID card image. Its previous thumbnail was empty ("") so the pre-join card
 * fell back to hostProfilePicture (Alan's photo) — see
 * SessionNotStartedCard.tsx:224 `coverPhoto || hostProfilePicture || orgIcon`
 * and publicWebinar.ts's /validate response `coverPhoto: workshop.thumbnail`.
 * Setting a real thumbnail makes it win over that fallback for every normal
 * visitor who reaches the pre-join screen (not just the "05" demo path).
 *
 * Run: npx ts-node src/scripts/set-test-webinar-thumbnail.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const WEBINAR_ID = "6a892d20548f652a9a3997e2";
const THUMBNAIL_URL =
  "https://nela-app.s3.us-east-1.amazonaws.com/public-onboarding/2026-08-29/1788019512121_inhbzp7l3n_3509b62d-34fa-4992-b685-a24c70371016.jpeg";

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI not set");
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db!;

  const result = await db.collection("workshops").updateOne(
    { _id: new mongoose.Types.ObjectId(WEBINAR_ID) },
    { $set: { thumbnail: THUMBNAIL_URL } }
  );
  console.log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}`);

  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
