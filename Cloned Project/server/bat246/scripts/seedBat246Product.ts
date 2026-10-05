/**
 * Seed script — creates the $1 Bat246 Board Entry product only.
 * Safe to run at any time — does NOT touch boards or players.
 * Run: npx ts-node src/bat246/scripts/seedBat246Product.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Product } from "../../models/product.model";
import { Organization } from "../../models/organization.model";
import { User } from "../../models/user.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const existing = await Product.findOne({ tags: "bat246_entry" }).lean() as any;
  if (existing) {
    console.log(`Bat246 $1 entry product already exists: ${existing._id}`);
    console.log(`  Name: ${existing.name}`);
    console.log(`  Status: ${existing.status}`);
    console.log(`  OrgId: ${existing.organizationId}`);
    await mongoose.disconnect();
    return;
  }

  const admin = await User.findOne({ role: { $in: ["admin", "founder", "superAdmin"] } }).lean() as any;
  const orgId = process.env.BAT246_ORG_ID || admin?.organizationId;
  const org   = orgId ? await Organization.findById(orgId).lean() as any : await Organization.findOne().lean() as any;

  if (!org || !admin) {
    console.error("No org or admin user found. Cannot create product.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const p246 = await Product.create({
    organizationId: org._id,
    createdBy: admin._id,
    name: "Bat246 Board Entry",
    slug: "bat246-board-entry",
    description: "Purchase a position on a new Bat246 board. You will be placed at Home Plate.",
    sku: "BAT246-ENTRY-001",
    price: 1,
    currency: "USD",
    isDigital: true,
    requiresShipping: false,
    deliveryMethod: "digital",
    status: "active",
    tags: ["bat246_entry"],
    trackQuantity: false,
  });

  // Wire inviteProductId on any existing boards
  const { Bat246Board } = await import("../models/bat246Board.model");
  const wired = await Bat246Board.updateMany({}, { $set: { inviteProductId: p246._id } });
  console.log(`Bat246 $1 entry product created: ${p246._id}`);
  console.log(`  OrgId: ${org._id}  (${org.name})`);
  if (wired.modifiedCount) console.log(`  inviteProductId set on ${wired.modifiedCount} board(s)`);
  console.log(`  Admin: ${admin.email}`);
  console.log("");
  console.log("Product is now visible in Digital Products.");

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
