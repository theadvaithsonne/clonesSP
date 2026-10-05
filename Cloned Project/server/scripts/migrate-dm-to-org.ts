import mongoose from "mongoose";
import { Message } from "../models/message.model";
import { config } from "dotenv";

// Load environment variables
config();

/**
 * Migration script to assign all existing DM messages to a specific organization (HQ).
 *
 * This fixes the bug where DMs were not scoped to organizations, causing users
 * in multiple orgs to see DMs across all their organizations.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-dm-to-org.ts <TARGET_ORG_ID>
 *
 * Example:
 *   npx ts-node src/scripts/migrate-dm-to-org.ts 507f1f77bcf86cd799439011
 */

async function migrateDMsToOrg(targetOrgId: string) {
  console.log("=".repeat(60));
  console.log("DM Migration Script - Assign all DMs to Organization");
  console.log("=".repeat(60));
  console.log(`Target Organization ID: ${targetOrgId}`);
  console.log("");

  // Validate the org ID format
  if (!mongoose.Types.ObjectId.isValid(targetOrgId)) {
    console.error("❌ Error: Invalid Organization ID format");
    console.error("   Please provide a valid MongoDB ObjectId");
    process.exit(1);
  }

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✓ Connected to MongoDB\n");

    // Step 1: Count total messages
    const totalMessages = await Message.countDocuments({});
    console.log(`Total messages in database: ${totalMessages}`);

    // Step 2: Count messages already with orgId
    const messagesWithOrg = await Message.countDocuments({ orgId: { $exists: true, $ne: null } });
    console.log(`Messages already with orgId: ${messagesWithOrg}`);

    // Step 3: Count messages without orgId (to be migrated)
    const messagesToMigrate = await Message.countDocuments({
      $or: [
        { orgId: { $exists: false } },
        { orgId: null }
      ]
    });
    console.log(`Messages to migrate: ${messagesToMigrate}`);
    console.log("");

    if (messagesToMigrate === 0) {
      console.log("✓ No messages need migration. All messages already have orgId.");
      return { success: true, migratedCount: 0, totalMessages };
    }

    // Step 4: Confirm before proceeding
    console.log("⚠️  This will assign ALL messages without orgId to the target organization.");
    console.log("   Press Ctrl+C within 5 seconds to cancel...\n");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 5: Perform the migration
    console.log("Starting migration...");
    const startTime = Date.now();

    const result = await Message.updateMany(
      {
        $or: [
          { orgId: { $exists: false } },
          { orgId: null }
        ]
      },
      {
        $set: { orgId: new mongoose.Types.ObjectId(targetOrgId) }
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("");
    console.log("=".repeat(60));
    console.log("Migration Complete!");
    console.log("=".repeat(60));
    console.log(`✓ Messages updated: ${result.modifiedCount}`);
    console.log(`✓ Matched documents: ${result.matchedCount}`);
    console.log(`✓ Duration: ${duration} seconds`);
    console.log(`✓ Target Org ID: ${targetOrgId}`);
    console.log("");

    // Step 6: Verify migration
    const remainingWithoutOrg = await Message.countDocuments({
      $or: [
        { orgId: { $exists: false } },
        { orgId: null }
      ]
    });

    if (remainingWithoutOrg === 0) {
      console.log("✓ Verification passed: All messages now have orgId");
    } else {
      console.log(`⚠️  Warning: ${remainingWithoutOrg} messages still without orgId`);
    }

    return {
      success: true,
      migratedCount: result.modifiedCount,
      totalMessages,
      targetOrgId,
    };

  } catch (error) {
    console.error("❌ Migration failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await mongoose.disconnect();
    console.log("\n✓ Disconnected from MongoDB");
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const targetOrgId = process.argv[2];

  if (!targetOrgId) {
    console.error("Usage: npx ts-node src/scripts/migrate-dm-to-org.ts <TARGET_ORG_ID>");
    console.error("");
    console.error("Example:");
    console.error("  npx ts-node src/scripts/migrate-dm-to-org.ts 507f1f77bcf86cd799439011");
    process.exit(1);
  }

  migrateDMsToOrg(targetOrgId)
    .then((result) => {
      console.log("\nMigration result:", JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Migration error:", error);
      process.exit(1);
    });
}

export { migrateDMsToOrg };
