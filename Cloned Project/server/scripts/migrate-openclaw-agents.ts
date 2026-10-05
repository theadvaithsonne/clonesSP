import mongoose from "mongoose";
import { User } from "../models/user.model";
import { OpenClawAgent } from "../models/openclawAgent.model";

/**
 * Migration script to move agents from User.openclawAgents
 * into the standalone OpenClawAgent collection.
 *
 * Usage:  npx ts-node -r tsconfig-paths/register src/scripts/migrate-openclaw-agents.ts
 */
async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const users = await User.find({
    "openclawAgents.0": { $exists: true },
  })
    .select("_id openclawAgents")
    .lean();

  console.log(`Found ${users.length} user(s) with openclawAgents`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    for (const agent of (user as any).openclawAgents) {
      if (!agent.agentId) {
        console.warn(`  Skipping agent with no agentId for user ${user._id}`);
        skipped++;
        continue;
      }

      const exists = await OpenClawAgent.findOne({ agentId: agent.agentId });
      if (exists) {
        console.log(`  Agent ${agent.agentId} already migrated, skipping`);
        skipped++;
        continue;
      }

      await OpenClawAgent.create({
        agentId: agent.agentId,
        name: agent.name || "Unnamed Agent",
        orgId: agent.orgId,
        createdBy: user._id,
      });

      migrated++;
      console.log(`  Migrated agent ${agent.agentId} (${agent.name})`);
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`);
  console.log(
    "You can now remove User.openclawAgents field and its index when ready."
  );

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
