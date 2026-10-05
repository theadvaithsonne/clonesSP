import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const boards = mongoose.connection.db!.collection("bat246boards");
  const docs = await boards.find({}, { projection: { boardNumber: 1, "firstBase.playerId": 1, "firstBase.salesCredits": 1 } }).toArray();
  for (const d of docs) {
    console.log(`Board ${d.boardNumber}`);
    (d.firstBase || []).forEach((s: any, i: number) => {
      if (s && s.playerId) {
        console.log(`  fb[${i}] salesCredits=${s.salesCredits} noCards=${s.noCards ?? 0}`);
      } else {
        console.log(`  fb[${i}] empty`);
      }
    });
  }
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
