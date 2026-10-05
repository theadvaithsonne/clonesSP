import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { Bat246Config } = await import("../bat246/models/bat246Config.model");
  const { Bat246Board } = await import("../bat246/models/bat246Board.model");

  const config = await Bat246Config.findOne({}).lean();
  console.log("Config:", JSON.stringify(config, null, 2));

  const boards = await Bat246Board.find({}).select("boardNumber trackingNumber title familyNumber status").lean();
  console.log("Boards:", JSON.stringify(boards, null, 2));
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
