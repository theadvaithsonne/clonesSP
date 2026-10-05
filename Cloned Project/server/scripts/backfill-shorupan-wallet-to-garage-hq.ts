/**
 * Pass 2 migration — one-shot backfill of shorupan@gmail.com's legacy
 * user-scoped wallet data into the GARAGE HQ org's AivatarWallet.
 *
 * Run manually before the wallet branch (feat/first-office-bonus) merges
 * to prod. After merge, the legacy garage_agent_wallets collection
 * becomes orphaned and this data would never be reachable.
 *
 * The legacy `Wallet` model file was already deleted in the wallet
 * refactor, so we read its docs via raw collection access instead of
 * a Mongoose model.
 *
 * Idempotent: re-running after a successful pass does nothing
 * (checks the legacy doc's `migratedAt` field).
 *
 * Usage (from roam-backend/):
 *   npx ts-node src/scripts/backfill-shorupan-wallet-to-garage-hq.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { AivatarWallet } from "../models/aivatarWallet.model";

const SHORUPAN_EMAIL = "shorupan@gmail.com";
const LEGACY_COLLECTION = "garage_agent_wallets";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const user = await User.findOne({ email: SHORUPAN_EMAIL });
  if (!user) {
    throw new Error(`User ${SHORUPAN_EMAIL} not found — abort`);
  }
  console.log(`Found user ${SHORUPAN_EMAIL} (${user._id})`);

  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongoose connection has no .db handle");
  const legacy = db.collection(LEGACY_COLLECTION);
  const legacyWallet = await legacy.findOne({ userId: user._id });
  if (!legacyWallet) {
    console.log(`No legacy wallet doc in ${LEGACY_COLLECTION} for ${SHORUPAN_EMAIL} — nothing to backfill. Done.`);
    return;
  }
  if (legacyWallet.migratedAt) {
    console.log(`Legacy wallet already migrated at ${legacyWallet.migratedAt} — skip.`);
    return;
  }
  console.log(
    `Legacy wallet: balance=${legacyWallet.balance ?? 0}c debt=${legacyWallet.debt ?? 0}c ` +
    `transactions=${legacyWallet.transactions?.length ?? 0}`
  );

  const garageHQ = await Organization.findOne({ parent: true });
  if (!garageHQ) {
    throw new Error("GARAGE HQ org (parent: true) not found — abort");
  }
  console.log(`Found GARAGE HQ: ${garageHQ.name} (${garageHQ._id})`);

  // Upsert the AivatarWallet for GARAGE HQ; add legacy values onto any
  // existing balance/debt (in case the welcome-bonus already created one).
  let hqWallet = await AivatarWallet.findOne({ orgId: garageHQ._id });
  if (!hqWallet) {
    hqWallet = await AivatarWallet.create({
      orgId: garageHQ._id,
      balance: 0,
      debt: 0,
    });
    console.log(`Created new AivatarWallet for GARAGE HQ`);
  }

  const balanceMoved = legacyWallet.balance ?? 0;
  const debtMoved = legacyWallet.debt ?? 0;
  const txns = (legacyWallet.transactions ?? []).map((t: any) => ({
    type: t.type,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    description: `[migrated from user-scoped wallet] ${t.description}`,
    createdAt: t.createdAt,
  }));

  // One atomic update: bump balance/debt, push all legacy txns to the
  // inline array (current schema — Pass 1 will move these to the new
  // collection later).
  await AivatarWallet.updateOne(
    { _id: hqWallet._id },
    {
      $inc: { balance: balanceMoved, debt: debtMoved },
      $push: { transactions: { $each: txns, $position: 0 } as any },
    }
  );

  // Mark legacy doc as migrated. Don't delete — separate cleanup later.
  await legacy.updateOne(
    { _id: legacyWallet._id },
    { $set: { migratedAt: new Date() } }
  );

  console.log("\n=== Backfill complete ===");
  console.log(`User: ${SHORUPAN_EMAIL} (${user._id})`);
  console.log(`Org:  GARAGE HQ (${garageHQ._id})`);
  console.log(`Balance moved: ${balanceMoved}c ($${(balanceMoved / 100).toFixed(2)})`);
  console.log(`Debt moved:    ${debtMoved}c ($${(debtMoved / 100).toFixed(2)})`);
  console.log(`Transactions backfilled: ${txns.length}`);
}

run()
  .catch((err) => {
    console.error("BACKFILL FAILED:", err);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());
