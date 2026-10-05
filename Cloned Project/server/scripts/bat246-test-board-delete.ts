/**
 * Removes everything bat246-test-board-create.ts made: the test board
 * (tracking number T-9999, mode "test"), its dummy players (@bat246-test.invalid),
 * their dummy distributors and the card history written for the test board.
 *
 *   Dry run:   npx tsx src/scripts/bat246-test-board-delete.ts
 *   For real:  npx tsx src/scripts/bat246-test-board-delete.ts --confirm
 *
 * Only ever matches the test markers. Never touches a real board or player.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246Board } from "../bat246/models/bat246Board.model";
import { Bat246Player } from "../bat246/models/bat246Player.model";
import { Bat246Distributor } from "../bat246/models/bat246Distributor.model";
import { Bat246SalesCredit } from "../bat246/models/bat246SalesCredit.model";

const TRACKING = "T-9999";
const EMAIL_RE = /@bat246-test\.invalid$/;

async function run() {
  const confirm = process.argv.includes("--confirm");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  await mongoose.connect(uri);

  const boards = await Bat246Board.find({ trackingNumber: TRACKING, mode: "test" }).select("_id trackingNumber title").lean() as any[];
  const players = await Bat246Player.find({ email: EMAIL_RE }).select("_id userId").lean() as any[];
  const userIds = players.map((p) => p.userId).filter(Boolean);
  const boardIds = boards.map((b) => b._id);

  const credits = boardIds.length ? await Bat246SalesCredit.countDocuments({ boardId: { $in: boardIds } }) : 0;
  const dists = userIds.length ? await Bat246Distributor.countDocuments({ userId: { $in: userIds } }) : 0;

  console.log(`boards: ${boards.length}`);
  console.log(`dummy players: ${players.length}`);
  console.log(`dummy distributors: ${dists}`);
  console.log(`card-history records: ${credits}`);

  if (!confirm) { console.log("\nDRY RUN — nothing deleted. Re-run with --confirm."); await mongoose.disconnect(); return; }

  if (boardIds.length) {
    await Bat246SalesCredit.deleteMany({ boardId: { $in: boardIds } });
    await Bat246Board.deleteMany({ _id: { $in: boardIds } });
  }
  if (userIds.length) await Bat246Distributor.deleteMany({ userId: { $in: userIds } });
  if (players.length) await Bat246Player.deleteMany({ _id: { $in: players.map((p) => p._id) } });

  console.log("\nDELETED.");
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
