import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const Board = mongoose.model("B1", new mongoose.Schema({}, { strict: false }), "bat246boards");
  const PlayerBoard = mongoose.model("PB1", new mongoose.Schema({}, { strict: false }), "bat246playerboards");
  const PendingPlacement = mongoose.model("PP1", new mongoose.Schema({}, { strict: false }), "bat246pendingplacements");
  const PositionReservation = mongoose.model("PR1", new mongoose.Schema({}, { strict: false }), "bat246positionreservations");
  const PlacementNotification = mongoose.model("PN1", new mongoose.Schema({}, { strict: false }), "bat246placementnotifications");

  // Keep only boardNumber=1
  const toDelete = await Board.find({ boardNumber: { $ne: 1 } }).select("_id trackingNumber boardNumber familyNumber").lean() as any[];
  console.log(`Deleting ${toDelete.length} boards:`, toDelete.map((b: any) => b.trackingNumber).join(", "));

  const ids = toDelete.map((b: any) => b._id);

  const [pb, pp, pr, pn, br] = await Promise.all([
    PlayerBoard.deleteMany({ boardId: { $in: ids } }),
    PendingPlacement.deleteMany({ boardId: { $in: ids } }),
    PositionReservation.deleteMany({ boardId: { $in: ids } }),
    PlacementNotification.deleteMany({ boardId: { $in: ids } }),
    Board.deleteMany({ _id: { $in: ids } }),
  ]);

  console.log(`Boards deleted: ${br.deletedCount}`);
  console.log(`PlayerBoards: ${pb.deletedCount}, PendingPlacements: ${pp.deletedCount}, Reservations: ${pr.deletedCount}, Notifications: ${pn.deletedCount}`);

  // Also reset hasPurchasedProduct for non-seed distributors that got set by repair
  const { Bat246Distributor } = await import("../bat246/models/bat246Distributor.model");
  await Bat246Distributor.updateMany(
    { isQualified: false, hasPurchasedProduct: true },
    { $set: { hasPurchasedProduct: false } }
  );
  console.log("Reset hasPurchasedProduct for non-qualified distributors.");

  // Reset board/family counters back to 1 and clear familySequences for deleted boards
  const { Bat246Config } = await import("../bat246/models/bat246Config.model");
  const familyUnset: Record<string, string> = {};
  for (const b of toDelete) familyUnset[`familySequences.${b.familyNumber}`] = "";
  await Bat246Config.updateOne(
    {},
    {
      $set: { boardCounter: 1, familyCounter: 1 },
      ...(Object.keys(familyUnset).length ? { $unset: familyUnset } : {}),
    }
  );
  console.log("Config reset: boardCounter=1, familyCounter=1, familySequences cleared for deleted boards.");

  await mongoose.disconnect();
  console.log("Done.");
}
main().catch(e => { console.error(e); process.exit(1); });
