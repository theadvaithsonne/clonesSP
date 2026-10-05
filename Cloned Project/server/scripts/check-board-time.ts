import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const board = await mongoose.connection.db!.collection("bat246boards").findOne({ trackingNumber: "1-100" });
  if (!board) { console.log("Board 1-100 not found"); await mongoose.disconnect(); return; }
  console.log("boardNumber:", board.boardNumber);
  console.log("trackingNumber:", board.trackingNumber);
  console.log("status:", board.status);
  console.log("protectionPeriodEnd:", board.protectionPeriodEnd);
  console.log("createdAt:", board.createdAt);
  console.log("now:", new Date());
  if (board.protectionPeriodEnd) {
    const msLeft = new Date(board.protectionPeriodEnd).getTime() - Date.now();
    console.log("time remaining:", msLeft > 0 ? `${Math.round(msLeft/1000)}s (${(msLeft/60000).toFixed(1)} min)` : "EXPIRED");
  }
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
