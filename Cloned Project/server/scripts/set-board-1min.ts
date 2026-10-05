/**
 * Sets board 1-100's protectionPeriodEnd to now + 1 minute.
 *
 * Run: npx ts-node src/scripts/set-board-1min.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const boards = mongoose.connection.db!.collection("bat246boards");

  const newEnd = new Date(Date.now() + 60 * 1000); // now + 1 minute

  const result = await boards.updateOne(
    { trackingNumber: "1-100" },
    { $set: { protectionPeriodEnd: newEnd } }
  );

  if (result.matchedCount === 0) {
    console.log("Board 1-100 not found.");
  } else {
    console.log(`Board 1-100 protectionPeriodEnd → ${newEnd.toISOString()}`);
    console.log(`Expires in ~1 minute from now (${new Date().toISOString()})`);
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
