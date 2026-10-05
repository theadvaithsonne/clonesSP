/**
 * Seed one test entry into bat246Distributors.
 * Finds the first User in the DB and creates a fully-qualified distributor.
 *
 * Run:  npx tsx src/scripts/seedBat246Distributor.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Distributor } from "../bat246/models/bat246Distributor.model";
import { User } from "../models/user.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // Pick the first user that has a name + email
  const user = await User.findOne({ email: { $exists: true } })
    .select("_id name email")
    .lean() as any;

  if (!user) {
    console.error("No users found in DB — cannot seed.");
    process.exit(1);
  }

  console.log(`Using user: ${user.name || user.email} (${user._id})`);

  // Rename to "Test User 1" so the grid shows a recognisable test label
  await User.updateOne({ _id: user._id }, { $set: { name: "Test User 1" } });

  // Remove any prior test entry for this user so the script is re-runnable
  await Bat246Distributor.deleteOne({ userId: user._id });

  const now        = new Date();
  const oneYearOut = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  const doc = await Bat246Distributor.create({
    userId:                   user._id,
    isOfficeMember:           true,
    isGarageAffiliate:        true,
    garageAffiliateExpiresAt: oneYearOut,
    hasBat246Membership:      true,
    membershipExpiresAt:      oneYearOut,
    hasPurchasedProduct:      true,
    isQualified:              true,
    qualifiedAt:              now,
  });

  console.log("Seeded distributor:", doc._id.toString());
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
