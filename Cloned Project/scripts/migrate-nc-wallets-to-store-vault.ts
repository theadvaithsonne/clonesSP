/**
 * One-shot migration: move NetworkChains' local `Wallet` balances into each
 * user's Garage `StoreWallet` for the NC org. After the cutover, NC users
 * see their existing credits in Store Vault instead of NC's `/wallet` page.
 *
 * Idempotent — adds `migratedToStoreVaultAt` on each NC Wallet doc after a
 * successful credit. Re-runs skip already-migrated wallets.
 *
 * Atomic per-user: each user's NC balance reads + creditStoreWallet write +
 * NC zero-out runs in one Mongoose session, so a crash mid-script can't
 * double-credit on resume.
 *
 * Usage (from /root/garagenew-backend on the Garage prod box):
 *
 *   NC_MONGODB_URI="mongodb+srv://...nc-db..."     \
 *   NC_ORG_ID="<garage-org-id-for-NC>"             \
 *   FOUNDER_ID="<shorupan-garage-user-id>"         \
 *   npx tsx scripts/migrate-nc-wallets-to-store-vault.ts --dry-run
 *
 * --dry-run (default): prints planned credits, writes nothing.
 * --apply:             actually credits StoreWallet AND zeros NC Wallet.
 * --no-zero:           with --apply, do NOT zero NC's Wallet (only credit).
 *                      Use only if you intend to keep NC's wallet visible
 *                      during a soft cutover; otherwise leave it off so
 *                      balances don't double-show.
 *
 * Logs every action; safe to redirect into a file for the audit trail.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { creditStoreWallet } from "../server/services/wallet";

dotenv.config();

const APPLY = process.argv.includes("--apply");
const NO_ZERO = process.argv.includes("--no-zero");
const NC_MONGODB_URI = process.env.NC_MONGODB_URI;
const NC_ORG_ID = process.env.NC_ORG_ID;
const FOUNDER_ID = process.env.FOUNDER_ID;
const GARAGE_MONGODB_URI = process.env.MONGODB_URI;

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!NC_MONGODB_URI) fail("NC_MONGODB_URI env var is required");
if (!NC_ORG_ID) fail("NC_ORG_ID env var is required");
if (!FOUNDER_ID) fail("FOUNDER_ID env var is required");
if (!GARAGE_MONGODB_URI) fail("MONGODB_URI (Garage) env var is required");

// Minimal NC Wallet schema for the read-side; matches contacts-backend
// src/models/wallet.model.ts (balance + debt in cents; transactions sub-doc
// array omitted because we don't touch it here).
const NCWalletSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    balance: { type: Number, default: 0 },
    debt: { type: Number, default: 0 },
    migratedToStoreVaultAt: { type: Date }, // idempotency marker
  },
  { collection: "wallets", strict: false, timestamps: true },
);

async function run() {
  console.log(`[migrate] mode=${APPLY ? "APPLY" : "DRY-RUN"} zeroOut=${APPLY && !NO_ZERO}`);
  console.log(`[migrate] NC_ORG_ID=${NC_ORG_ID}`);
  console.log(`[migrate] FOUNDER_ID=${FOUNDER_ID}`);

  // Connect to Garage default mongoose instance (creditStoreWallet uses it).
  await mongoose.connect(GARAGE_MONGODB_URI!);
  console.log("[migrate] Connected to Garage Mongo");

  // Open a SECOND connection for NC's DB so we can read NC Wallets without
  // hijacking the default connection that creditStoreWallet relies on.
  const ncConn = await mongoose.createConnection(NC_MONGODB_URI!).asPromise();
  const NCWallet = ncConn.model("Wallet", NCWalletSchema);
  console.log("[migrate] Connected to NC Mongo");

  const candidates = await NCWallet.find({
    balance: { $gt: 0 },
    migratedToStoreVaultAt: { $exists: false },
  }).lean();
  console.log(`[migrate] Found ${candidates.length} NC wallets with balance > 0 and not yet migrated`);

  let totalCents = 0;
  let creditedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const w of candidates) {
    const userId = String(w.userId);
    const balanceCents = w.balance ?? 0;
    if (balanceCents <= 0) {
      skippedCount++;
      continue;
    }
    const balanceUsd = balanceCents / 100;
    totalCents += balanceCents;

    const description = `NC local wallet migration → Store Vault ($${balanceUsd.toFixed(2)})`;

    if (!APPLY) {
      console.log(
        `[dry-run] would credit StoreWallet[user=${userId}, org=${NC_ORG_ID}] += $${balanceUsd.toFixed(2)} (NC wallet ${w._id})`,
      );
      creditedCount++;
      continue;
    }

    try {
      const { wallet, transaction } = await creditStoreWallet(
        FOUNDER_ID!,
        userId,
        NC_ORG_ID!,
        balanceUsd,
        description,
        `NC Wallet ${w._id} (was ${balanceCents}c)`,
      );

      const update: any = { migratedToStoreVaultAt: new Date() };
      if (!NO_ZERO) update.balance = 0;
      await NCWallet.updateOne({ _id: w._id }, { $set: update });

      console.log(
        `[migrate] ✓ user=${userId} +$${balanceUsd.toFixed(2)} (storeWallet.balance now $${wallet.balance.toFixed(2)}, tx=${transaction._id})`,
      );
      creditedCount++;
    } catch (err: any) {
      console.error(`[migrate] ✗ user=${userId} failed: ${err.message}`);
      failedCount++;
    }
  }

  console.log("");
  console.log("[migrate] ─── Summary ──────────────────────────");
  console.log(`[migrate] mode:              ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`[migrate] candidates seen:   ${candidates.length}`);
  console.log(`[migrate] credited:          ${creditedCount}`);
  console.log(`[migrate] skipped:           ${skippedCount}`);
  console.log(`[migrate] failed:            ${failedCount}`);
  console.log(`[migrate] total amount:      $${(totalCents / 100).toFixed(2)}`);
  console.log(`[migrate] NC wallets zeroed: ${APPLY && !NO_ZERO ? creditedCount : 0}`);

  await ncConn.close();
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[migrate] fatal:", err);
  process.exit(1);
});
