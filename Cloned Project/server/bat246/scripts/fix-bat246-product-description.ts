/**
 * One-off: the earlier rename-bat246-product-title.ts script only fixed
 * Product.name ("bat264-650$" -> "BAT 246 - $650") — it never touched
 * Product.description, which still held the same old internal-name-style
 * value ("bat264-650$") and was visibly rendering on the checkout page
 * below the price.
 *
 * Run: npx ts-node src/bat246/scripts/fix-bat246-product-description.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const PRODUCT_ID = "6a159466cd9f94f7f23b2ef9";
const NEW_DESCRIPTION = "BAT 246 - $650";

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI not set");
  await mongoose.connect(mongoUri);
  const { Product } = await import("../../models/product.model");

  const before = await Product.findById(PRODUCT_ID).select("name description").lean();
  console.log("Before:", before);

  await Product.updateOne(
    { _id: new mongoose.Types.ObjectId(PRODUCT_ID) },
    { $set: { description: NEW_DESCRIPTION } }
  );

  const after = await Product.findById(PRODUCT_ID).select("name description").lean();
  console.log("After:", after);

  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
