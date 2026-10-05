import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const orgs = await db.collection("organizations")
    .find({ name: { $regex: /bat|246/i } })
    .project({ _id: 1, name: 1 })
    .toArray();
  console.log("Matching orgs:\n", JSON.stringify(orgs, null, 2));

  const prods = await db.collection("products")
    .find({ name: { $regex: /bat|246/i } })
    .project({ _id: 1, name: 1, organizationId: 1, tags: 1 })
    .toArray();
  console.log("\nMatching products:\n", JSON.stringify(prods, null, 2));

  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
