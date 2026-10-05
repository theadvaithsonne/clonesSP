// One-shot: flip `officeCreatedFromCryptobrand` back to false on
// Garage HQ. HQ (`parent: true`) is the platform's root org — every
// Garage user auto-joins it — so having the cryptobrand flag on it
// caused ensureCryptobrandWallets to eagerly create INR/ETH/BTC
// sibling wallets for every user in the system. That was accidental.
// This script un-does the flag; the companion
// cleanup-hq-cryptobrand-wallets.ts drops the 4,681 zero-balance
// sibling wallets those flips created.
//
// USAGE:
//   npx tsx src/scripts/unflag-hq-cryptobrand.ts          (dry-run)
//   npx tsx src/scripts/unflag-hq-cryptobrand.ts --live   (execute)

import mongoose from "mongoose";
import { Organization } from "../models/organization.model";

const HQ_ORG_ID = "68f1fe05876fcc5fadb61951";
const isLive = process.argv.includes("--live");

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI required");
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false } as any);
  console.log(`Mode: ${isLive ? "LIVE" : "DRY-RUN"}`);

  const org: any = await Organization.findOne({
    _id: new mongoose.Types.ObjectId(HQ_ORG_ID),
    parent: true,
  })
    .select("_id name parent officeCreatedFromCryptobrand")
    .lean();
  if (!org) {
    console.error(
      `HQ org ${HQ_ORG_ID} not found (or does not have parent: true) — refusing to update.`,
    );
    process.exit(1);
  }
  console.log(
    `Target: ${org.name} (id=${org._id})  parent=${org.parent}  officeCreatedFromCryptobrand=${org.officeCreatedFromCryptobrand}`,
  );

  if (org.officeCreatedFromCryptobrand === false) {
    console.log("Already false. Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  if (!isLive) {
    console.log("Would set officeCreatedFromCryptobrand = false.");
    console.log("Pass --live to execute.");
    await mongoose.disconnect();
    return;
  }

  const res = await Organization.updateOne(
    { _id: org._id, parent: true },
    { $set: { officeCreatedFromCryptobrand: false } },
  );
  console.log(`✅ modifiedCount = ${res.modifiedCount}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("[unflag-hq-cryptobrand]", e);
  process.exit(1);
});
