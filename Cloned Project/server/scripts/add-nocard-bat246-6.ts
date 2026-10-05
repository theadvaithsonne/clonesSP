/**
 * Adds 1 noCard to the firstBase slot occupied by player "Bat246-6"
 * Run: npx ts-node src/scripts/add-nocard-bat246-6.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  // Find player by nickname
  const player = await db.collection("bat246players").findOne({ nickname: "Bat246-6" });
  if (!player) {
    // Try by playerName on the board slot
    console.log("Player 'Bat246-6' not found in bat246players by nickname, searching board slots...");
  } else {
    console.log(`Found player: ${player._id} nickname=${player.nickname}`);
  }

  // Find the board with this player in firstBase
  const boards = db.collection("bat246boards");
  const allBoards = await boards.find({}).toArray();

  for (const board of allBoards) {
    const fb: any[] = board.firstBase || [];
    for (let i = 0; i < fb.length; i++) {
      const slot = fb[i];
      if (!slot || !slot.playerId) continue;

      const isMatch = player
        ? slot.playerId.toString() === player._id.toString()
        : slot.playerName === "Bat246-6";

      if (isMatch) {
        const currentNoCards = slot.noCards ?? 0;
        const newNoCards = currentNoCards + 1;
        await boards.updateOne(
          { _id: board._id },
          { $set: { [`firstBase.${i}.noCards`]: newNoCards } }
        );
        console.log(`Board ${board.boardNumber} fb[${i}] (${slot.playerName}): noCards ${currentNoCards} → ${newNoCards}`);
        await mongoose.disconnect();
        return;
      }
    }
  }

  console.log("Bat246-6 not found in any firstBase slot.");
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
