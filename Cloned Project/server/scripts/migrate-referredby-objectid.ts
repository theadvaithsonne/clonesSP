/**
 * Migration script to convert referredBy from affiliateId string to User ObjectId
 *
 * Run: npx ts-node src/scripts/migrate-referredby-objectid.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function migrateReferredByToObjectId() {
  console.log("🚀 Starting referredBy ObjectId migration...\n");

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

    // Find users with string referredBy (old format)
    const users = await db.collection("users").find({
      referredBy: { $type: "string" }
    }).toArray();

    console.log(`Found ${users.length} users with string referredBy to migrate\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const referrerAffiliateId = user.referredBy as string;

        // Find the referrer by their affiliate ID
        const referrer = await db.collection("users").findOne({
          affiliateId: referrerAffiliateId
        });

        if (referrer) {
          await db.collection("users").updateOne(
            { _id: user._id },
            { $set: { referredBy: referrer._id } }
          );
          console.log(`  ✅ Migrated: ${user.email} -> ${referrer.email}`);
          migrated++;
        } else {
          console.log(`  ⚠️ Skipped: ${user.email} - referrer not found for affiliateId: ${referrerAffiliateId}`);
          skipped++;
        }
      } catch (err) {
        console.error(`  ❌ Error migrating ${user.email}:`, err);
        errors++;
      }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 MIGRATION COMPLETED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Summary:");
    console.log(`  - Migrated: ${migrated}`);
    console.log(`  - Skipped: ${skipped}`);
    console.log(`  - Errors: ${errors}`);

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
  migrateReferredByToObjectId()
    .then(() => {
      console.log("\n✅ Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateReferredByToObjectId };
