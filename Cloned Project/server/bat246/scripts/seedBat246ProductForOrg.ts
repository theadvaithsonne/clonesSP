/**
 * Creates a $0 Bat246 Board Entry product scoped to a specific org.
 * Run: npx ts-node src/bat246/scripts/seedBat246ProductForOrg.ts
 *
 * Targets: Bat246 org (6a0d34e677323d1b81c6469b) in roam-admin-dev
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Product } from "../../models/product.model";
import { Organization } from "../../models/organization.model";
import { User } from "../../models/user.model";
import { Bat246Board } from "../models/bat246Board.model";

const MONGO_URI = process.env.MONGODB_URI!;
const TARGET_ORG_ID = "6a0d34e677323d1b81c6469b"; // Bat246 org
const TARGET_EMAIL  = "redbaron2020@mail.com";

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to:", MONGO_URI.includes("dev") ? "DEV" : "PROD");

  // ── Verify org exists ──────────────────────────────────────────────────────
  const org = await Organization.findById(TARGET_ORG_ID).lean() as any;
  if (!org) {
    console.error(`Org ${TARGET_ORG_ID} not found. Run copyUserFromProd first.`);
    process.exit(1);
  }
  console.log(`Org: ${org.name} (${org._id})`);

  // ── Find the user to set as createdBy ──────────────────────────────────────
  const user = await User.findOne({ email: TARGET_EMAIL }).lean() as any;
  if (!user) {
    console.error(`User ${TARGET_EMAIL} not found in dev.`);
    process.exit(1);
  }
  console.log(`CreatedBy: ${user.email} (${user._id})`);

  // ── Check if product already exists for this org ───────────────────────────
  const existing = await Product.findOne({
    organizationId: org._id,
    tags: "bat246_entry",
  }).lean() as any;

  if (existing) {
    console.log(`\nProduct already exists for org ${org.name}:`);
    console.log(`  _id  : ${existing._id}`);
    console.log(`  name : ${existing.name}`);
    console.log(`  price: $${existing.price}`);
    console.log(`  status: ${existing.status}`);
    await mongoose.disconnect();
    return;
  }

  // ── Create the product ─────────────────────────────────────────────────────
  const product = await Product.create({
    organizationId: org._id,
    createdBy: user._id,
    name: "Bat246 Board Entry",
    slug: "bat246-board-entry",
    description: "Purchase a position on a new Bat246 board. You will be placed at Home Plate.",
    sku: "BAT246-ENTRY-001",
    price: 0,
    currency: "USD",
    isDigital: true,
    requiresShipping: false,
    deliveryMethod: "digital",
    status: "active",
    tags: ["bat246_entry"],
    trackQuantity: false,
  });

  console.log(`\n✓ Product created:`);
  console.log(`  _id  : ${product._id}`);
  console.log(`  name : ${product.name}`);
  console.log(`  price: $${product.price}`);
  console.log(`  org  : ${org.name} (${org._id})`);

  // ── Wire inviteProductId on boards belonging to this org (if any) ──────────
  // Boards created by this org's users will have been seeded without an inviteProductId
  // Update them now so invite links work immediately
  const wired = await Bat246Board.updateMany(
    { inviteProductId: { $exists: false } },
    { $set: { inviteProductId: product._id } }
  );
  if (wired.modifiedCount) {
    console.log(`  inviteProductId wired to ${wired.modifiedCount} board(s) that had none`);
  }

  console.log(`\nProduct is now visible only in the "${org.name}" office store.`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
