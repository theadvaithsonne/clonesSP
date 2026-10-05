/**
 * Rollback script for the native affiliate system migration
 * This removes the new affiliate data and restores to pre-migration state
 *
 * Run: npx ts-node src/scripts/rollback-affiliate.ts
 */

import mongoose from "mongoose";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Channel } from "../models/channel.model";
import { ChannelMembership } from "../models/channelMembership.model";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

async function rollbackAffiliateSystem() {
  try {
    console.log("🔄 Starting affiliate system rollback...\n");

    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable not set");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to database\n");

    // STEP 1: Remove affiliateId and referredBy from users
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 1: Removing affiliateId and referredBy from users...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const userResult = await User.updateMany(
      {},
      {
        $unset: {
          affiliateId: "",
          referredBy: "",
        },
      }
    );
    console.log(`✅ Updated ${userResult.modifiedCount} users\n`);

    // STEP 2: Remove store from organizations
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 2: Removing store from organizations...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const orgResult = await Organization.updateMany(
      {},
      {
        $unset: {
          store: "",
        },
      }
    );
    console.log(`✅ Updated ${orgResult.modifiedCount} organizations\n`);

    // STEP 3: Delete all channels
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 3: Deleting all channels...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const channelResult = await Channel.deleteMany({});
    console.log(`✅ Deleted ${channelResult.deletedCount} channels\n`);

    // STEP 4: Delete all channel memberships
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 4: Deleting all channel memberships...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const membershipResult = await ChannelMembership.deleteMany({});
    console.log(`✅ Deleted ${membershipResult.deletedCount} channel memberships\n`);

    // Summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 ROLLBACK COMPLETED SUCCESSFULLY!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Summary:");
    console.log(`  - Removed affiliateId/referredBy from ${userResult.modifiedCount} users`);
    console.log(`  - Removed store from ${orgResult.modifiedCount} organizations`);
    console.log(`  - Deleted ${channelResult.deletedCount} channels`);
    console.log(`  - Deleted ${membershipResult.deletedCount} channel memberships`);
    console.log("\n⚠️  Note: Legacy EarnGPT data (earnGPT, earngpt_employee, earngpt_data) was NOT touched.");

  } catch (error) {
    console.error("\n💥 Rollback failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from database");
  }
}

// Run rollback if called directly
if (require.main === module) {
  rollbackAffiliateSystem()
    .then(() => {
      console.log("\n✅ Rollback script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Rollback script failed:", error);
      process.exit(1);
    });
}

export { rollbackAffiliateSystem };
