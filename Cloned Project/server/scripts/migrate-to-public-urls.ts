/**
 * Migration script to convert presigned S3 URLs to public URLs
 * Run with: npx ts-node src/scripts/migrate-to-public-urls.ts
 *
 * This script:
 * 1. Finds all messages with attachments
 * 2. Extracts the S3 key from the old presigned URL (or uses existing fileKey)
 * 3. Generates new public URLs that never expire
 */

import mongoose from "mongoose";
import { env } from "../config/env";
import { s3Service } from "../services/s3";

// Import models
import "../models/message.model";
import "../models/groupMessage.model";

const Message = mongoose.model("Message");
const GroupMessage = mongoose.model("GroupMessage");

/**
 * Extract S3 key from a presigned URL or public URL
 * Handles various URL formats:
 * - https://bucket.s3.region.amazonaws.com/cabinet/orgId/userId/file.jpg?X-Amz-...
 * - https://bucket.s3.region.amazonaws.com/cabinet/orgId/userId/file.jpg
 * - https://s3.region.amazonaws.com/bucket/cabinet/orgId/userId/file.jpg
 */
function extractS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname;

    // Remove leading slash
    if (path.startsWith("/")) {
      path = path.substring(1);
    }

    // If path-style URL, remove bucket name from path
    // e.g., /bucket-name/cabinet/... -> cabinet/...
    if (path.startsWith(env.AWS_S3_BUCKET + "/")) {
      path = path.substring(env.AWS_S3_BUCKET.length + 1);
    }

    // Validate it looks like a valid cabinet key
    if (path.startsWith("cabinet/") || path.includes("/cabinet/")) {
      // Extract just the cabinet/... part if there's a prefix
      const cabinetIndex = path.indexOf("cabinet/");
      if (cabinetIndex > 0) {
        path = path.substring(cabinetIndex);
      }
      return path;
    }

    // If not a cabinet path, return the full path as-is
    return path || null;
  } catch (e) {
    console.error(`Failed to parse URL: ${url}`, e);
    return null;
  }
}

async function migrateMessages() {
  console.log("Migrating Message attachments...");

  const messages = await Message.find({
    "attachments.0": { $exists: true },
  });

  console.log(`Found ${messages.length} messages with attachments`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const msg of messages) {
    let modified = false;

    for (const attachment of (msg as any).attachments) {
      const oldUrl = attachment.fileUrl;
      let s3Key = attachment.fileKey;

      // If fileKey is missing or looks incomplete (just filename), extract from URL
      if (!s3Key || !s3Key.includes("/")) {
        s3Key = extractS3KeyFromUrl(oldUrl);
        if (s3Key) {
          attachment.fileKey = s3Key; // Fix the fileKey too
        }
      }

      if (!s3Key) {
        console.warn(`  Could not extract S3 key for message ${msg._id}, attachment: ${attachment.fileName}`);
        errors++;
        continue;
      }

      const newUrl = s3Service.getPublicUrl(s3Key);

      if (oldUrl !== newUrl) {
        attachment.fileUrl = newUrl;
        modified = true;
      }
    }

    if (modified) {
      try {
        await msg.save();
        updated++;
      } catch (e) {
        console.error(`  Failed to save message ${msg._id}:`, e);
        errors++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`Messages: ${updated} updated, ${skipped} skipped (already correct), ${errors} errors`);
}

async function migrateGroupMessages() {
  console.log("\nMigrating GroupMessage attachments...");

  const messages = await GroupMessage.find({
    "attachments.0": { $exists: true },
  });

  console.log(`Found ${messages.length} group messages with attachments`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const msg of messages) {
    let modified = false;

    for (const attachment of (msg as any).attachments) {
      const oldUrl = attachment.fileUrl;
      let s3Key = attachment.fileKey;

      // If fileKey is missing or looks incomplete (just filename), extract from URL
      if (!s3Key || !s3Key.includes("/")) {
        s3Key = extractS3KeyFromUrl(oldUrl);
        if (s3Key) {
          attachment.fileKey = s3Key; // Fix the fileKey too
        }
      }

      if (!s3Key) {
        console.warn(`  Could not extract S3 key for group message ${msg._id}, attachment: ${attachment.fileName}`);
        errors++;
        continue;
      }

      const newUrl = s3Service.getPublicUrl(s3Key);

      if (oldUrl !== newUrl) {
        attachment.fileUrl = newUrl;
        modified = true;
      }
    }

    if (modified) {
      try {
        await msg.save();
        updated++;
      } catch (e) {
        console.error(`  Failed to save group message ${msg._id}:`, e);
        errors++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`Group messages: ${updated} updated, ${skipped} skipped (already correct), ${errors} errors`);
}

async function main() {
  try {
    console.log("=".repeat(60));
    console.log("S3 URL Migration: Presigned -> Public URLs");
    console.log("=".repeat(60));
    console.log(`\nBucket: ${env.AWS_S3_BUCKET}`);
    console.log(`Region: ${env.AWS_S3_REGION}`);
    console.log(`\nExample public URL format:`);
    console.log(`  ${s3Service.getPublicUrl("cabinet/orgId/userId/example.jpg")}`);
    console.log("\nConnecting to MongoDB...");

    await mongoose.connect(env.MONGODB_URI);
    console.log("Connected!\n");

    await migrateMessages();
    await migrateGroupMessages();

    console.log("\n" + "=".repeat(60));
    console.log("Migration complete!");
    console.log("=".repeat(60));
    console.log("\nIMPORTANT: Make sure your S3 bucket has public read access enabled!");
    console.log("See the bucket policy instructions in the previous response.\n");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
