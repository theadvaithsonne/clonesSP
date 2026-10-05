/**
 * Finds who referred a BAT246 user, by distributorId (e.g. 1012EE) or email.
 * Run: npx ts-node src/scripts/bat246-who-referred.ts <distributorId|email>
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Distributor } from "../bat246/models/bat246Distributor.model";
import { Bat246Player } from "../bat246/models/bat246Player.model";
import { Bat246Board } from "../bat246/models/bat246Board.model";
import { User } from "../models/user.model";

async function run() {
  const q = process.argv[2];
  if (!q) throw new Error("Usage: npx ts-node src/scripts/bat246-who-referred.ts <distributorId|email>");
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI environment variable not set");

  await mongoose.connect(mongoUri);

  const dist = q.includes("@")
    ? await Bat246Distributor.findOne({ userId: (await User.findOne({ email: { $regex: `^${q}$`, $options: "i" } }).select("_id").lean() as any)?._id }).lean() as any
    : await Bat246Distributor.findOne({ distributorId: q }).lean() as any;

  if (!dist) { console.log("Distributor not found for:", q); await mongoose.disconnect(); return; }

  const user = await User.findById(dist.userId).select("email name").lean() as any;
  console.log(`USER: ${user?.name} <${user?.email}> — distributorId: ${dist.distributorId}`);

  if (!dist.bat246RefUserId) {
    console.log("No referrer recorded (bat246RefUserId is empty).");
  } else {
    const refUser = await User.findById(dist.bat246RefUserId).select("email name").lean() as any;
    const refDist = await Bat246Distributor.findOne({ userId: dist.bat246RefUserId }).select("distributorId").lean() as any;
    const refPlayer = await Bat246Player.findOne({ userId: dist.bat246RefUserId }).select("_id nickname").lean() as any;
    console.log(`\nREFERRED BY: ${refUser?.name} <${refUser?.email}>${refDist?.distributorId ? ` — distributorId: ${refDist.distributorId}` : ""}`);

    if (refPlayer) {
      const board = await Bat246Board.findOne({
        $or: [
          { "firstBase.playerId": refPlayer._id },
          { "atBat.playerId": refPlayer._id },
          { "secondBaseA.playerId": refPlayer._id },
          { "secondBaseB.playerId": refPlayer._id },
          { "thirdBase.playerId": refPlayer._id },
          { "homePlate.playerId": refPlayer._id },
        ],
        status: { $in: ["pending", "active"] },
      }).select("trackingNumber firstBase atBat secondBaseA secondBaseB thirdBase homePlate").lean() as any;
      if (board) {
        let pos = "";
        const pid = refPlayer._id.toString();
        if (board.homePlate?.playerId?.toString() === pid) pos = "Home Plate";
        else if (board.thirdBase?.playerId?.toString() === pid) pos = "3rd Base";
        else if (board.secondBaseA?.playerId?.toString() === pid) pos = "2nd Base A";
        else if (board.secondBaseB?.playerId?.toString() === pid) pos = "2nd Base B";
        else {
          const fb = (board.firstBase ?? []).findIndex((s: any) => s?.playerId?.toString() === pid);
          const ab = (board.atBat ?? []).findIndex((s: any) => s?.playerId?.toString() === pid);
          if (fb !== -1) pos = `1st Base ${"ABCD"[fb]}`;
          else if (ab !== -1) pos = `AT BAT ${ab + 1}`;
        }
        console.log(`Referrer position: ${pos || "unknown"} on board ${board.trackingNumber}`);
      }
    }
  }

  // Also show the referred user's own board slot referredBy fields if present
  const player = await Bat246Player.findOne({ userId: dist.userId }).select("_id").lean() as any;
  if (player) {
    const board = await Bat246Board.findOne({
      $or: [{ "atBat.playerId": player._id }, { "dugout.playerId": player._id }],
    }).select("trackingNumber atBat dugout").lean() as any;
    if (board) {
      const ab = (board.atBat ?? []).find((s: any) => s?.playerId?.toString() === player._id.toString());
      const dg = (board.dugout ?? []).find((s: any) => s?.playerId?.toString() === player._id.toString());
      const slot = ab ?? dg;
      if (slot?.referredByName) console.log(`\nBoard slot record — referredBy: ${slot.referredByName}`);
    }
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
