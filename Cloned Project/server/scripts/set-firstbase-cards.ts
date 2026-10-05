/**
 * Sets specific card values on firstBase slots for Board 1:
 *   fb[0] 1st Base A — salesCredits=2 (2 green cards)
 *   fb[1] 1st Base B — noCards=1 (1 NoCard)
 *   fb[2] 1st Base C — salesCredits=2 (2 green cards)
 *   fb[3] 1st Base D — blank (salesCredits=0, noCards=0)
 *
 * Run: npx ts-node src/scripts/set-firstbase-cards.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const boards = mongoose.connection.db!.collection("bat246boards");

  const result = await boards.updateMany(
    {},
    {
      $set: {
        "firstBase.0.salesCredits": 2, "firstBase.0.noCards": 0,
        "firstBase.1.salesCredits": 0, "firstBase.1.noCards": 1,
        "firstBase.2.salesCredits": 2, "firstBase.2.noCards": 0,
        "firstBase.3.salesCredits": 0, "firstBase.3.noCards": 0,
      },
    }
  );

  console.log(`Updated ${result.modifiedCount} board(s)`);
  console.log("  fb[0] A → salesCredits=2 (2 green)");
  console.log("  fb[1] B → noCards=1 (1 NoCard)");
  console.log("  fb[2] C → salesCredits=2 (2 green)");
  console.log("  fb[3] D → blank");

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
