/**
 * Migration script to create wallets for existing users
 *
 * Run: npx ts-node src/scripts/migrate-wallets.ts
 */

import mongoose from "mongoose";
import { User } from "../models/user.model";
import { StoreWallet } from "../models/storeWallet.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import dotenv from "dotenv";
dotenv.config();

interface MigrationStats {
  storeWalletsCreated: number;
  affiliateWalletsCreated: number;
  usersProcessed: number;
  errors: number;
}

async function migrateWallets(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    storeWalletsCreated: 0,
    affiliateWalletsCreated: 0,
    usersProcessed: 0,
    errors: 0,
  };

  try {
    console.log("🚀 Starting wallet migration...\n");

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable not set");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to database\n");

    // Get all users
    const users = await User.find({}).lean();
    console.log(`Found ${users.length} users to process\n`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Processing users...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    for (const user of users) {
      try {
        stats.usersProcessed++;
        const userId = user._id.toString();

        // Create affiliate wallet if doesn't exist
        const existingAffiliateWallet = await AffiliateWallet.findOne({
          userId,
        }).lean();
        if (!existingAffiliateWallet) {
          await AffiliateWallet.create({
            userId,
            balance: 0,
            totalEarnings: 0,
            totalWithdrawn: 0,
            currency: "INR",
          });
          stats.affiliateWalletsCreated++;
          console.log(`  ✅ Created affiliate wallet for ${user.email}`);
        }

        // Track orgs we've created wallets for to avoid duplicates
        const processedOrgIds = new Set<string>();

        // Create store wallets for each organization membership
        if (user.organizations && user.organizations.length > 0) {
          for (const membership of user.organizations as any[]) {
            const orgId = membership.organization.toString();

            // Skip if already processed
            if (processedOrgIds.has(orgId)) continue;
            processedOrgIds.add(orgId);

            const existingStoreWallet = await StoreWallet.findOne({
              userId,
              orgId,
            }).lean();

            if (!existingStoreWallet) {
              await StoreWallet.create({
                userId,
                orgId,
                balance: 0,
                currency: "INR",
              });
              stats.storeWalletsCreated++;
              console.log(
                `  ✅ Created store wallet for ${user.email} in org ${orgId}`
              );
            }
          }
        }

        // Also handle legacy single organization field
        if (user.organization) {
          const orgId = (user.organization as any).toString();

          // Skip if already processed
          if (!processedOrgIds.has(orgId)) {
            const existingStoreWallet = await StoreWallet.findOne({
              userId,
              orgId,
            }).lean();

            if (!existingStoreWallet) {
              await StoreWallet.create({
                userId,
                orgId,
                balance: 0,
                currency: "INR",
              });
              stats.storeWalletsCreated++;
              console.log(
                `  ✅ Created store wallet for ${user.email} in legacy org ${orgId}`
              );
            }
          }
        }
      } catch (userError) {
        stats.errors++;
        console.error(`  ❌ Error processing user ${user.email}:`, userError);
      }
    }

    // Summary
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 MIGRATION COMPLETED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Summary:");
    console.log(`  - Users processed: ${stats.usersProcessed}`);
    console.log(`  - Affiliate wallets created: ${stats.affiliateWalletsCreated}`);
    console.log(`  - Store wallets created: ${stats.storeWalletsCreated}`);
    console.log(`  - Errors: ${stats.errors}`);

    return stats;
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
  migrateWallets()
    .then((stats) => {
      console.log("\n✅ Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateWallets };
