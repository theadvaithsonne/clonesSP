/**
 * Creates the BAT264FREE platform coupon (100% off, productType: "product").
 * Works for both the $20 annual membership and $650 Bat246 entry product.
 *
 * Run:  npx tsx src/scripts/seedBat246FreeCoupon.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { PlatformCoupon } from "../models/platformCoupon.model";
import { User } from "../models/user.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";
const ALAN_K_EMAIL = "redbaron2020@mail.com";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const alanK = await User.findOne({ email: ALAN_K_EMAIL }).select("_id name email").lean() as any;
  if (!alanK) {
    console.error(`User ${ALAN_K_EMAIL} not found — cannot create coupon.`);
    process.exit(1);
  }
  console.log(`Using creator: ${alanK.name || alanK.email} (${alanK._id})`);

  const existing = await PlatformCoupon.findOne({ code: "BAT264FREE" }).lean();
  if (existing) {
    console.log("Coupon BAT264FREE already exists — skipping.");
    process.exit(0);
  }

  const coupon = await PlatformCoupon.create({
    code: "BAT264FREE",
    name: "Bat246 Free Entry",
    description: "100% off Bat246 membership and entry products",
    productType: "product",
    discountType: "percent",
    discountValue: 100,
    currency: "USD",
    status: "active",
    validFrom: new Date(),
    scope: "platform",
    createdBy: alanK._id,
    createdByType: "garage_admin",
  });

  console.log(`✅ Coupon created: ${coupon.code} (${coupon._id})`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
