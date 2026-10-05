/**
 * Migration script for the native affiliate system
 * Replaces EarnGPT third-party integration with local database
 *
 * Run: npx ts-node src/scripts/migrate-affiliate.ts
 */

import mongoose from "mongoose";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Channel } from "../models/channel.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { generateAffiliateId } from "../utils/affiliateId";
import { generateSlug, ensureUniqueSlug } from "../utils/storeSlug";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

interface MigrationStats {
  affiliateIdsGenerated: number;
  foundersReferredBySet: number;
  stakeholdersReferredBySet: number;
  storesCreated: number;
  channelsCreated: number;
  membershipsCreated: number;
}

async function migrateAffiliateSystem(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    affiliateIdsGenerated: 0,
    foundersReferredBySet: 0,
    stakeholdersReferredBySet: 0,
    storesCreated: 0,
    channelsCreated: 0,
    membershipsCreated: 0,
  };

  try {
    console.log("🚀 Starting affiliate system migration...\n");

    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable not set");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to database\n");

    // STEP 1: Generate affiliate IDs for all users
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 1: Generating affiliate IDs for all users...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const usersWithoutAffiliateId = await User.find({
      affiliateId: { $exists: false },
    });

    console.log(`Found ${usersWithoutAffiliateId.length} users without affiliate ID`);

    for (const user of usersWithoutAffiliateId) {
      user.affiliateId = await generateAffiliateId();
      await user.save();
      stats.affiliateIdsGenerated++;
      console.log(`  ✅ Generated affiliate ID for ${user.email}: ${user.affiliateId}`);
    }

    // Also check users with null affiliateId
    const usersWithNullAffiliateId = await User.find({
      affiliateId: null,
    });

    for (const user of usersWithNullAffiliateId) {
      user.affiliateId = await generateAffiliateId();
      await user.save();
      stats.affiliateIdsGenerated++;
      console.log(`  ✅ Generated affiliate ID for ${user.email}: ${user.affiliateId}`);
    }

    console.log(`\n✅ Generated ${stats.affiliateIdsGenerated} affiliate IDs\n`);

    // STEP 2: Set referredBy for founders
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 2: Setting referredBy for founders...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const garageHQ = await Organization.findOne({ parent: true });
    if (!garageHQ) {
      throw new Error("GARAGE HQ not found");
    }

    const shorupan = await User.findOne({ email: "shorupan@gmail.com" });
    if (!shorupan?.affiliateId) {
      throw new Error("Shorupan must have an affiliate ID");
    }

    console.log(`  Shorupan's affiliate ID: ${shorupan.affiliateId}\n`);

    // Find all founders (users with founder role in any non-parent org)
    const allUsers = await User.find({});

    for (const user of allUsers) {
      // Skip if referredBy is already set
      if (user.referredBy) continue;

      // Check if user is a founder of any non-parent org
      const founderMembership = user.organizations?.find(
        (m: any) =>
          m.role === "founder" &&
          m.organization.toString() !== garageHQ._id.toString()
      );

      if (founderMembership && user.email !== "shorupan@gmail.com") {
        user.referredBy = shorupan._id;
        await user.save();
        stats.foundersReferredBySet++;
        console.log(`  ✅ Set referredBy for founder ${user.email}`);
      }
    }

    console.log(`\n✅ Set referredBy for ${stats.foundersReferredBySet} founders\n`);

    // STEP 3: Set referredBy for stakeholders
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 3: Setting referredBy for stakeholders...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const nonParentOrgs = await Organization.find({ parent: { $ne: true } });

    for (const org of nonParentOrgs) {
      // Find founder of this org
      const founder = await User.findOne({
        "organizations.organization": org._id,
        "organizations.role": "founder",
        affiliateId: { $exists: true, $ne: null },
      });

      if (!founder?.affiliateId) {
        console.log(`  ⚠️ No founder with affiliate ID found for ${org.name}`);
        continue;
      }

      // Find stakeholders of this org without referredBy
      const stakeholders = await User.find({
        "organizations.organization": org._id,
        "organizations.role": "stakeholder",
        referredBy: { $exists: false },
      });

      for (const stakeholder of stakeholders) {
        stakeholder.referredBy = founder._id;
        await stakeholder.save();
        stats.stakeholdersReferredBySet++;
        console.log(`  ✅ Set referredBy for stakeholder ${stakeholder.email} in ${org.name}`);
      }

      // Also handle stakeholders with null referredBy
      const stakeholdersWithNull = await User.find({
        "organizations.organization": org._id,
        "organizations.role": "stakeholder",
        referredBy: null,
      });

      for (const stakeholder of stakeholdersWithNull) {
        stakeholder.referredBy = founder._id;
        await stakeholder.save();
        stats.stakeholdersReferredBySet++;
        console.log(`  ✅ Set referredBy for stakeholder ${stakeholder.email} in ${org.name}`);
      }
    }

    console.log(`\n✅ Set referredBy for ${stats.stakeholdersReferredBySet} stakeholders\n`);

    // STEP 4: Create stores for organizations
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 4: Creating stores for organizations...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const allOrgs = await Organization.find({});

    for (const org of allOrgs) {
      // Skip if store already exists
      if (org.store?.slug) {
        console.log(`  ⏭️ Organization ${org.name} already has store, skipping`);
        continue;
      }

      const baseSlug = generateSlug(org.name);
      const slug = await ensureUniqueSlug(baseSlug, org._id.toString());

      org.store = {
        name: org.name,
        slug: slug,
        description: org.description || "",
        headingText: org.headingText || "",
        subHeadingText: org.subHeadingText || "",
        icon: org.icon || "",
        coverPhoto: org.coverPhoto || "",
        promoVideoLink: org.promoVideoLink || "",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      await org.save();
      stats.storesCreated++;
      console.log(`  ✅ Created store for ${org.name} with slug: ${slug}`);
    }

    console.log(`\n✅ Created ${stats.storesCreated} stores\n`);

    // STEP 5: Create default channels for each store
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("STEP 5: Creating default channels for each store...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    for (const org of allOrgs) {
      if (!org.store?.slug) {
        console.log(`  ⚠️ Organization ${org.name} has no store, skipping channels`);
        continue;
      }

      // Check if channels already exist
      const existingChannels = await Channel.countDocuments({ storeId: org._id });
      if (existingChannels >= 2) {
        console.log(`  ⏭️ Organization ${org.name} already has channels, skipping`);
        continue;
      }

      // Find founder to set as creator
      const founder = await User.findOne({
        $or: [
          { organization: org._id, role: { $in: ["admin", "founder"] } },
          { "organizations.organization": org._id, "organizations.role": "founder" },
        ],
      });

      if (!founder) {
        console.log(`  ⚠️ No founder found for ${org.name}, skipping channels`);
        continue;
      }

      // Create Employees channel if not exists
      const existingEmployeesChannel = await Channel.findOne({
        storeId: org._id,
        title: "Employees",
      });

      let employeesChannel = existingEmployeesChannel;
      if (!existingEmployeesChannel) {
        employeesChannel = await Channel.create({
          title: "Employees",
          description: "For team members of this organization",
          price: 0,
          currency: "USD",
          isActive: true,
          isFree: true,
          isSubscription: false,
          allowPayWhatYouWant: false,
          storeId: org._id,
          createdBy: founder._id,
        });
        stats.channelsCreated++;
        console.log(`  ✅ Created Employees channel for ${org.name}`);
      }

      // Create Customers channel if not exists
      const existingCustomersChannel = await Channel.findOne({
        storeId: org._id,
        title: "Customers",
      });

      if (!existingCustomersChannel) {
        await Channel.create({
          title: "Customers",
          description: "For customers and clients",
          price: 0,
          currency: "USD",
          isActive: true,
          isFree: true,
          isSubscription: false,
          allowPayWhatYouWant: false,
          storeId: org._id,
          createdBy: founder._id,
        });
        stats.channelsCreated++;
        console.log(`  ✅ Created Customers channel for ${org.name}`);
      }

      // STEP 6: Create channel memberships for existing stakeholders
      if (employeesChannel) {
        const stakeholders = await User.find({
          "organizations.organization": org._id,
          "organizations.role": "stakeholder",
        });

        for (const stakeholder of stakeholders) {
          // Check if membership already exists
          const existing = await ChannelMembership.findOne({
            userId: stakeholder._id,
            channelId: employeesChannel._id,
          });

          if (!existing) {
            await ChannelMembership.create({
              userId: stakeholder._id,
              channelId: employeesChannel._id,
              orgId: org._id,
              joinedAt: new Date(),
              role: "member",
              status: "active",
            });
            stats.membershipsCreated++;
            console.log(`    ✅ Added ${stakeholder.email} to Employees channel`);
          }
        }
      }
    }

    console.log(`\n✅ Created ${stats.channelsCreated} channels`);
    console.log(`✅ Created ${stats.membershipsCreated} channel memberships\n`);

    // Summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Summary:");
    console.log(`  - Generated ${stats.affiliateIdsGenerated} affiliate IDs`);
    console.log(`  - Set referredBy for ${stats.foundersReferredBySet} founders`);
    console.log(`  - Set referredBy for ${stats.stakeholdersReferredBySet} stakeholders`);
    console.log(`  - Created ${stats.storesCreated} stores`);
    console.log(`  - Created ${stats.channelsCreated} channels`);
    console.log(`  - Created ${stats.membershipsCreated} channel memberships`);

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
  migrateAffiliateSystem()
    .then((stats) => {
      console.log("\n✅ Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateAffiliateSystem };
