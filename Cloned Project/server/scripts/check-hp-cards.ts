import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import { Bat246Board } from "../bat246/models/bat246Board.model";
import { Bat246Player } from "../bat246/models/bat246Player.model";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const board = await Bat246Board.findOne({ trackingNumber: "6-1001" }).lean() as any;
  if (!board) { console.log("Board 6-1001 not found"); return; }

  console.log("Board status:", board.status);
  console.log("HP slot:", JSON.stringify(board.homePlate, null, 2));

  if (board.homePlate?.playerId) {
    const player = await Bat246Player.findById(board.homePlate.playerId).lean() as any;
    if (!player) { console.log("Player not found"); return; }
    console.log("\ncrossedHp:", player.minorLeague?.crossedHp);
    console.log("crossedHpAt:", player.minorLeague?.crossedHpAt);
    console.log("cardsEarned:", JSON.stringify(player.minorLeague?.cardsEarned, null, 2));
    console.log("lbEarnings:", JSON.stringify(player.minorLeague?.lbEarnings, null, 2));

    // Compute tier eligibility
    const ce = player.minorLeague?.cardsEarned ?? {};
    const gold  = ce.gold  ?? 0;
    const black = ce.black ?? 0;
    const brown = ce.brown ?? 0;
    const green = ce.green ?? 0;
    const total = gold + black + brown + green;
    console.log(`\nCard counts: gold=${gold} black=${black} brown=${brown} green=${green} total=${total} (gray excluded)`);
    if (gold < 1) { console.log("No gold card → does NOT qualify for any tier"); }
    else if (total >= 7) console.log("Tier: G (Grand Slam)");
    else if (total >= 5) console.log("Tier: H (Homerun)");
    else if (green >= 2) console.log("Tier: T (Triple)");
    else console.log("Does NOT qualify for any tier (insufficient cards)");
  }

  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
