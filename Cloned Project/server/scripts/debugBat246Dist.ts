import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { Bat246Distributor } = await import("../bat246/models/bat246Distributor.model");
  const { User } = await import("../models/user.model");

  // List all bat246 distributor docs with key flags
  const all = await Bat246Distributor.find({}).select("userId isOfficeMember hasBat246Membership isGarageAffiliate hasPurchasedProduct isQualified").lean() as any[];
  console.log(`Total distributors: ${all.length}`);
  for (const d of all) {
    const user = await User.findById(d.userId).select("email name").lean() as any;
    console.log(`  email: ${user?.email ?? "?"} | office:${d.isOfficeMember} membership:${d.hasBat246Membership} affiliate:${d.isGarageAffiliate} purchased:${d.hasPurchasedProduct} qualified:${d.isQualified}`);
  }
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
