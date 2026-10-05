/**
 * One-time migration: add all existing bat246 players to the bat246 org.
 * Players assigned before the auto-org-add logic was added need this backfill.
 *
 * Run: npx ts-node src/bat246/scripts/addPlayersToOrg.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Player } from "../models/bat246Player.model";
import { Product } from "../../models/product.model";
import { User } from "../../models/user.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // Get the org from the bat246_entry product
  const entryProduct = await Product.findOne({ tags: "bat246_entry" }).select("organizationId name").lean() as any;
  if (!entryProduct?.organizationId) {
    console.error("No product with tag 'bat246_entry' found. Run seedBat246Product.ts first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const orgId = entryProduct.organizationId;
  console.log(`Target org: ${orgId}  (product: ${entryProduct.name})`);

  // Get all bat246 players
  const players = await Bat246Player.find().select("userId nickname email").lean() as any[];
  console.log(`Found ${players.length} bat246 player(s)`);

  let added = 0;
  let alreadyIn = 0;
  let noUser = 0;

  for (const player of players) {
    if (!player.userId) {
      console.log(`  SKIP — player ${player.nickname || player.email} has no userId`);
      noUser++;
      continue;
    }

    const user = await User.findById(player.userId).select("email organizations").lean() as any;
    if (!user) {
      console.log(`  SKIP — no Garage user found for player ${player.nickname || player.email}`);
      noUser++;
      continue;
    }

    const alreadyMember = (user.organizations ?? []).some(
      (o: any) => o.organization?.toString() === orgId.toString()
    );

    if (alreadyMember) {
      console.log(`  ALREADY IN ORG — ${user.email}`);
      alreadyIn++;
      continue;
    }

    await User.updateOne(
      { _id: user._id },
      { $addToSet: { organizations: { organization: orgId, role: "member" } } }
    );
    console.log(`  ADDED — ${user.email}`);
    added++;
  }

  console.log("");
  console.log(`Done. Added: ${added}  Already in org: ${alreadyIn}  Skipped (no user): ${noUser}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
