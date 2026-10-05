import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log("Connected to MongoDB");

  const tpc = mongoose.connection.collection("thirdpartyclients");

  const candidates = await tpc
    .find({
      $or: [
        { name: { $regex: /networkchain/i } },
        { "productConfig.productCode": { $regex: /^NC_/i } },
        { "productConfig.productCode": { $regex: /^GU_SUB_NC/i } },
        { "productConfig.platformUserEmail": /networkchain/i },
      ],
    })
    .project({ name: 1, "productConfig.productCode": 1, "productConfig.allowsTopUp": 1, isActive: 1 })
    .toArray();

  console.log(`Candidate clients (${candidates.length}):`);
  for (const c of candidates) {
    console.log(
      `  - ${c._id} | name=${c.name} | productCode=${c.productConfig?.productCode} | allowsTopUp=${c.productConfig?.allowsTopUp ?? false} | isActive=${c.isActive}`
    );
  }

  if (candidates.length !== 1) {
    console.error(
      `\nExpected exactly 1 NetworkChain client, found ${candidates.length}. Refusing to update — pass the client _id explicitly:`
    );
    console.error(`  CLIENT_ID=<id> tsx scripts/enable-nc-topup.ts`);

    const forced = process.env.CLIENT_ID;
    if (!forced) {
      await mongoose.disconnect();
      process.exit(1);
    }
    const result = await tpc.updateOne(
      { _id: new mongoose.Types.ObjectId(forced) },
      { $set: { "productConfig.allowsTopUp": true } }
    );
    console.log(`Forced update for ${forced}: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
    await mongoose.disconnect();
    return;
  }

  const id = candidates[0]._id;
  const result = await tpc.updateOne(
    { _id: id },
    { $set: { "productConfig.allowsTopUp": true } }
  );
  console.log(`\nUpdated client ${id}: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

  const after = await tpc.findOne({ _id: id }, { projection: { name: 1, "productConfig.allowsTopUp": 1 } });
  console.log(`Verification: ${after?.name} allowsTopUp=${after?.productConfig?.allowsTopUp}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
