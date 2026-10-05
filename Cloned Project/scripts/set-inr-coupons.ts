import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log("Connected to MongoDB");

  const result = await mongoose.connection
    .collection("platformcoupons")
    .updateMany(
      { code: { $in: ["RAW100FLAT"] } },
      { $set: { currency: "INR" } }
    );
  console.log("Updated coupons:", result.modifiedCount);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
