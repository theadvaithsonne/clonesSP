/**
 * Creates (or re-activates) the unlimited free-entry coupon for Alan K.
 *
 * Coupon code : BAT246FREE
 * Discount    : 100% — makes any product in the bat246 office free
 * Limits      : none — unlimited uses, unlimited per user, never expires
 * Scope       : organization (bat246 office only — cannot be used elsewhere)
 *
 * Safe to re-run:
 *   - If the coupon already exists and is active  → prints status, exits cleanly
 *   - If the coupon exists but is inactive        → re-activates it
 *   - If the coupon does not exist               → creates it
 *
 * Run: npx ts-node src/bat246/scripts/createAlanKFreeCoupon.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Coupon } from "../../models/coupon.model";
import { User } from "../../models/user.model";
import { Product } from "../../models/product.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";
const ALAN_K_EMAIL = "redbaron2020@mail.com";
const COUPON_CODE = "BAT246FREE";

// Bat246 org ID — verified from DB (organizations collection, name: "Bat246")
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // ── Resolve Alan K ──────────────────────────────────────────────────────────
  const alanK = await User.findOne({ email: ALAN_K_EMAIL }).select("_id name").lean() as any;
  if (!alanK) {
    console.error(`ERROR: User ${ALAN_K_EMAIL} not found in database.`);
    process.exit(1);
  }
  console.log(`Alan K resolved: ${alanK._id} (${ALAN_K_EMAIL})`);

  // ── Verify org exists and has at least one bat246 product ──────────────────
  const productCount = await Product.countDocuments({
    organizationId: new mongoose.Types.ObjectId(BAT246_ORG_ID),
  });
  console.log(`Bat246 org (${BAT246_ORG_ID}) has ${productCount} product(s)`);

  // ── Check for existing coupon ───────────────────────────────────────────────
  const existing = await Coupon.findOne({ code: COUPON_CODE });

  if (existing) {
    if (existing.status === "active") {
      console.log(`\nCoupon "${COUPON_CODE}" already exists and is ACTIVE.`);
      console.log(`  _id          : ${existing._id}`);
      console.log(`  discountValue: ${existing.discountValue}%`);
      console.log(`  maxUsageCount: ${existing.maxUsageCount ?? "unlimited"}`);
      console.log(`  maxUsagePerUser: ${existing.maxUsagePerUser ?? "unlimited"}`);
      console.log(`  validUntil   : ${existing.validUntil ?? "never expires"}`);
      console.log(`  currentUsage : ${existing.currentUsageCount}`);
      console.log("\nNothing to do.");
    } else {
      // Re-activate if it was deactivated
      existing.status = "active";
      await existing.save();
      console.log(`\nCoupon "${COUPON_CODE}" re-activated (was ${existing.status}).`);
      console.log(`  _id: ${existing._id}`);
    }
    await mongoose.disconnect();
    return;
  }

  // ── Create new coupon ───────────────────────────────────────────────────────
  const coupon = await Coupon.create({
    code: COUPON_CODE,
    name: "Bat246 Free Entry — Alan K",
    description:
      "Unlimited 100% discount for Alan K to purchase any product in the Bat246 office. " +
      "No usage cap, no expiry. Used to create new boards by buying bat246_entry products.",
    discountValue: 100,          // 100% off = free
    // maxDiscountAmount: not set  → no cap on discount amount
    scope: "organization",
    orgId: new mongoose.Types.ObjectId(BAT246_ORG_ID),
    createdBy: alanK._id,
    createdByType: "founder",
    applicableTo: ["product"],
    // specificItemIds: not set    → applies to ALL products in the org
    validFrom: new Date(),
    // validUntil: not set         → never expires
    status: "active",
    // maxUsageCount: not set      → unlimited total uses
    // maxUsagePerUser: not set    → unlimited per user
    currentUsageCount: 0,
  });

  console.log(`\nCoupon created successfully:`);
  console.log(`  code         : ${coupon.code}`);
  console.log(`  _id          : ${coupon._id}`);
  console.log(`  discountValue: ${coupon.discountValue}%`);
  console.log(`  scope        : ${coupon.scope} (orgId: ${BAT246_ORG_ID})`);
  console.log(`  applicableTo : ${coupon.applicableTo.join(", ")}`);
  console.log(`  maxUsageCount: unlimited`);
  console.log(`  maxUsagePerUser: unlimited`);
  console.log(`  validUntil   : never expires`);
  console.log(`\nAlan K can now use code "${COUPON_CODE}" on any product in the bat246 office for free.`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
