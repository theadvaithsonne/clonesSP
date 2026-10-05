/**
 * One-time patch for the dev/test board (boardNumber=1):
 *   - Change trackingNumber → "6-1001"
 *   - Home Plate: grayCards=2, cardType="Gold", brownCards=1, blackCards=1
 *   - 3rd Base:   grayCards=1, blackCards=1
 *   - 2nd Base A: cardType="Gold"
 *
 * Uses a loose schema so grayCards (not in strict model) is persisted.
 *
 * Run: npx tsx src/scripts/patch-board-cards-and-tracking.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const LooseBoardSchema = new mongoose.Schema({}, { strict: false });
// Avoid OverwriteModelError if re-run in a warm process
const Board =
  (mongoose.models["LooseBoard246"] as mongoose.Model<any>) ??
  mongoose.model("LooseBoard246", LooseBoardSchema, "bat246boards");

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI environment variable not set");

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB\n");

  const board = await Board.findOne({ boardNumber: 1 }).lean() as any;
  if (!board) throw new Error("No board with boardNumber=1 found");

  console.log(`Targeting board: trackingNumber="${board.trackingNumber}"  _id=${board._id}\n`);

  // ── Build slot patch helpers ─────────────────────────────────────────────────
  // If a slot is currently null we create a minimal object so $set works.
  const makeSlotBase = (existing: any) =>
    existing ? {} : { enteredAt: new Date().toISOString() };

  // For homePlate — 2 gray, 1 gold (cardType), 1 brown, 1 black
  const hpBase = makeSlotBase(board.homePlate);
  const hpPatch: Record<string, any> = {
    ...Object.fromEntries(Object.entries(hpBase).map(([k, v]) => [`homePlate.${k}`, v])),
    "homePlate.cardType": "Gold",
    "homePlate.grayCards": 2,
    "homePlate.brownCards": 1,
    "homePlate.blackCards": 1,
  };

  // For thirdBase — 1 gray, 1 black
  const tbBase = makeSlotBase(board.thirdBase);
  const tbPatch: Record<string, any> = {
    ...Object.fromEntries(Object.entries(tbBase).map(([k, v]) => [`thirdBase.${k}`, v])),
    "thirdBase.grayCards": 1,
    "thirdBase.blackCards": 1,
  };

  // For secondBaseA — 1 gold
  const s2aBase = makeSlotBase(board.secondBaseA);
  const s2aPatch: Record<string, any> = {
    ...Object.fromEntries(Object.entries(s2aBase).map(([k, v]) => [`secondBaseA.${k}`, v])),
    "secondBaseA.cardType": "Gold",
  };

  const result = await Board.updateOne(
    { _id: board._id },
    {
      $set: {
        trackingNumber: "6-1001",
        ...hpPatch,
        ...tbPatch,
        ...s2aPatch,
      },
    }
  );

  console.log(`Modified: ${result.modifiedCount} document(s)\n`);

  // ── Verify ───────────────────────────────────────────────────────────────────
  const updated = await Board.findById(board._id).lean() as any;
  console.log("✓ trackingNumber:", updated.trackingNumber);
  console.log("\n✓ homePlate cards:");
  console.log("    cardType  :", updated.homePlate?.cardType ?? "(null)");
  console.log("    grayCards :", updated.homePlate?.grayCards ?? 0);
  console.log("    brownCards:", updated.homePlate?.brownCards ?? 0);
  console.log("    blackCards:", updated.homePlate?.blackCards ?? 0);
  console.log("\n✓ thirdBase cards:");
  console.log("    cardType  :", updated.thirdBase?.cardType ?? "(null)");
  console.log("    grayCards :", updated.thirdBase?.grayCards ?? 0);
  console.log("    blackCards:", updated.thirdBase?.blackCards ?? 0);
  console.log("\n✓ secondBaseA cards:");
  console.log("    cardType  :", updated.secondBaseA?.cardType ?? "(null)");

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
