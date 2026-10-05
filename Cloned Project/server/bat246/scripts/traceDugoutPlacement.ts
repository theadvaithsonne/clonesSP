import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";
const EMAILS = ["mavictp@yahoo.ca", "natej770@gmail.com"];

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  for (const email of EMAILS) {
    console.log(`\n\n########## ${email} ##########`);
    const user = await db.collection("users").findOne({ email });
    if (!user) { console.log("No User found."); continue; }
    console.log("User:", { _id: user._id, name: user.name, referredBy: user.referredBy });

    const player = await db.collection("bat246players").findOne({ userId: user._id });
    if (!player) { console.log("No bat246Player found."); continue; }
    console.log("Player:", { _id: player._id, playerIdNo: player.playerIdNo, nickname: player.nickname });

    // Find any board where this player occupies a slot (any position).
    const pid = player._id;
    const boards = await db.collection("bat246boards").find({
      $or: [
        { "homePlate.playerId": pid }, { "thirdBase.playerId": pid },
        { "secondBaseA.playerId": pid }, { "secondBaseB.playerId": pid },
        { "firstBase.playerId": pid }, { "atBat.playerId": pid },
        { "dugout.playerId": pid }, { "onDeckCircle.playerId": pid },
      ],
    }).toArray();

    for (const b of boards) {
      const findSlot = (arr: any, label: string) => {
        if (!arr) return null;
        const list = Array.isArray(arr) ? arr : [arr];
        for (let i = 0; i < list.length; i++) {
          if (list[i]?.playerId?.toString() === pid.toString()) {
            return { label: Array.isArray(arr) ? `${label}[${i}]` : label, slot: list[i] };
          }
        }
        return null;
      };
      const hit = findSlot(b.homePlate, "homePlate") || findSlot(b.thirdBase, "thirdBase") ||
        findSlot(b.secondBaseA, "secondBaseA") || findSlot(b.secondBaseB, "secondBaseB") ||
        findSlot(b.firstBase, "firstBase") || findSlot(b.atBat, "atBat") ||
        findSlot(b.dugout, "dugout") || findSlot(b.onDeckCircle, "onDeckCircle");
      console.log(`Board ${b.trackingNumber} (${b._id}):`, hit ? { position: hit.label, referredBy: hit.slot.referredBy, referredByName: hit.slot.referredByName, enteredAt: hit.slot.enteredAt } : "not found in any array (shouldn't happen)");
    }

    // Find their invoice(s) for bat246_entry to see the exact checkout params captured.
    const invoices = await db.collection("invoices").find({
      userId: user._id,
    }).sort({ createdAt: -1 }).limit(10).toArray();
    const bat246Invoices = invoices.filter((inv: any) =>
      inv.metadata?.type === "product_checkout" || inv.metadata?.bat246Pos || inv.metadata?.bat246GenRef || inv.metadata?.bat246UpperRef || inv.metadata?.bat246DugoutRef || inv.metadata?.bat246Ref
    );
    console.log(`Invoices found: ${invoices.length}, bat246-relevant: ${bat246Invoices.length}`);
    for (const inv of bat246Invoices) {
      console.log("Invoice:", {
        _id: inv._id,
        status: inv.status,
        createdAt: inv.createdAt,
        itemType: inv.itemType,
        metadata: inv.metadata,
      });
    }
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
