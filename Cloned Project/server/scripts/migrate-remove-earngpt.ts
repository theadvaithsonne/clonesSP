/**
 * Migration script to remove legacy EarnGPT data
 * This removes the old third-party EarnGPT integration fields that have been replaced
 * by the native affiliate system.
 *
 * Run: npx ts-node src/scripts/migrate-remove-earngpt.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function removeEarnGPTData() {
  console.log("🚀 Starting EarnGPT data removal migration...\n");

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable not set");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to database\n");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not established");
    }

    // STEP 1: Remove EarnGPT fields from users
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 1: Removing EarnGPT fields from users...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Count users with EarnGPT data before removal
    const usersWithEarnGPT = await db.collection("users").countDocuments({
      $or: [
        { earnGPT: { $exists: true } },
        { earngpt_employee: { $exists: true } },
        { referralCode: { $exists: true } },
      ],
    });
    console.log(`  Found ${usersWithEarnGPT} users with EarnGPT data\n`);

    const userResult = await db.collection("users").updateMany(
      {},
      {
        $unset: {
          earnGPT: "",
          earngpt_employee: "",
          referralCode: "",
        },
      }
    );
    console.log(`  ✅ Removed EarnGPT fields from ${userResult.modifiedCount} users\n`);

    // STEP 2: Remove earngpt_data from organizations
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 2: Removing earngpt_data from organizations...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Count orgs with EarnGPT data before removal
    const orgsWithEarnGPT = await db.collection("organizations").countDocuments({
      earngpt_data: { $exists: true },
    });
    console.log(`  Found ${orgsWithEarnGPT} organizations with earngpt_data\n`);

    const orgResult = await db.collection("organizations").updateMany(
      {},
      {
        $unset: {
          earngpt_data: "",
        },
      }
    );
    console.log(`  ✅ Removed earngpt_data from ${orgResult.modifiedCount} organizations\n`);

    // Summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 EARNGPT REMOVAL MIGRATION COMPLETED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Summary:");
    console.log(`  - Users with EarnGPT data found: ${usersWithEarnGPT}`);
    console.log(`  - Users updated: ${userResult.modifiedCount}`);
    console.log(`  - Organizations with earngpt_data found: ${orgsWithEarnGPT}`);
    console.log(`  - Organizations updated: ${orgResult.modifiedCount}`);
    console.log("\nRemoved fields:");
    console.log("  - User.earnGPT");
    console.log("  - User.earngpt_employee");
    console.log("  - User.referralCode");
    console.log("  - Organization.earngpt_data");

  } catch (error) {
    console.error("\n💥 Migration failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from database");
  }
}

// Run migration if called directly
if (require.main === module) {
  removeEarnGPTData()
    .then(() => {
      console.log("\n✅ Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration script failed:", error);
      process.exit(1);
    });
}

export { removeEarnGPTData };
