/**
 * One-off: replaces the Bat246 organization's icon (top-level `icon` field
 * and the mirrored `store.icon` field) with the new "TLS Revolution / BAT 246"
 * circular badge the user supplied locally.
 *
 * The UploadThing REST endpoint the rest of the app's uploadthing.ts helper
 * calls (api.uploadthing.com/api/upload) now 400s — looks like that legacy
 * raw-multipart route is no longer accepted by their API. Falls back to S3
 * instead, under the same `public-onboarding/YYYY-MM-DD/...` prefix used by
 * routes/uploadsPublic.ts for permanently-public, unauthenticated assets —
 * the org.icon field is just a URL string with no host validation, so
 * mixing hosts is safe.
 *
 * Run: npx ts-node src/bat246/scripts/set-bat246-org-icon.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";
const LOCAL_FILE_PATH =
  "C:\\Users\\Mayur\\Desktop\\WhatsApp Image 2026-09-10 at 12.11.39 AM.jpeg";

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI not set");

  const { s3Service } = await import("../../services/s3");
  const { Organization } = await import("../../models/organization.model");

  const buffer = fs.readFileSync(LOCAL_FILE_PATH);
  console.log(`Read local file: ${LOCAL_FILE_PATH} (${buffer.length} bytes)`);

  const todaySegment = new Date().toISOString().slice(0, 10);
  const fileKey = `public-onboarding/${todaySegment}/${Date.now()}_bat246-tls-revolution-badge.jpeg`;
  await s3Service.uploadFile(fileKey, buffer, "image/jpeg", {
    uploadedVia: "set-bat246-org-icon-script",
    uploadedAt: new Date().toISOString(),
  });
  const iconUrl = s3Service.getPublicUrl(fileKey);
  console.log("Uploaded to S3:", iconUrl);

  await mongoose.connect(mongoUri);

  const before = await Organization.findById(BAT246_ORG_ID)
    .select("icon store.icon")
    .lean() as any;
  console.log("Before:", { icon: before?.icon, storeIcon: before?.store?.icon });

  await Organization.updateOne(
    { _id: new mongoose.Types.ObjectId(BAT246_ORG_ID) },
    { $set: { icon: iconUrl, "store.icon": iconUrl } }
  );

  const after = await Organization.findById(BAT246_ORG_ID)
    .select("icon store.icon")
    .lean() as any;
  console.log("After:", { icon: after?.icon, storeIcon: after?.store?.icon });

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
