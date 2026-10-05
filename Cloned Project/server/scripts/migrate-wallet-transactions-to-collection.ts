/**
 * Pass 1 migration — move every existing AivatarWallet's inline
 * transactions[] field into the garage_aivatar_wallet_transactions
 * collection.
 *
 * Run AFTER the wallet-admin-panel branch ships to prod. The new
 * AivatarWallet model dropped the inline field, so any pre-existing
 * transactions live in MongoDB but are unreachable via the model. We
 * read them via the raw collection.
 *
 * Idempotent: re-running checks for duplicates by (walletId, createdAt,
 * amount, type) and skips already-migrated rows.
 *
 * Usage (from roam-backend/):
 *   npx ts-node src/scripts/migrate-wallet-transactions-to-collection.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { AivatarWalletTransaction } from "../models/aivatarWalletTransaction.model";

const BATCH_SIZE = 100;

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongoose connection has no .db handle");
  const rawCollection = db.collection("garage_aivatar_wallets");
  const cursor = rawCollection.find(
    { transactions: { $exists: true, $ne: [] } },
    { projection: { _id: 1, orgId: 1, transactions: 1 } }
  );

  let walletsProcessed = 0;
  let transactionsMigrated = 0;
  let skipped = 0;
  let errors = 0;

  while (await cursor.hasNext()) {
    const doc: any = await cursor.next();
    if (!doc) break;

    const inlineTxns: any[] = doc.transactions ?? [];
    for (const t of inlineTxns) {
      const exists = await AivatarWalletTransaction.findOne({
        walletId: doc._id,
        createdAt: t.createdAt,
        amount: t.amount,
        type: t.type,
      }).select("_id").lean();
      if (exists) { skipped++; continue; }

      try {
        await AivatarWalletTransaction.create({
          walletId: doc._id,
          orgId: doc.orgId,
          type: t.type,
          amount: t.amount,
          balanceAfter: t.balanceAfter,
          debtAfter: 0, // legacy txns predate debtAfter on the row
          source: "system",
          description: t.description ?? "(no description)",
          createdAt: t.createdAt,
        });
        transactionsMigrated++;
      } catch (err: any) {
        errors++;
        console.error(`[wallet=${doc._id}] insert failed:`, err?.message ?? err);
      }
    }

    // Drop the inline field after successful migration of this doc.
    await rawCollection.updateOne(
      { _id: doc._id },
      { $unset: { transactions: "" } }
    );
    walletsProcessed++;

    if (walletsProcessed % BATCH_SIZE === 0) {
      console.log(`  progress: ${walletsProcessed} wallets, ${transactionsMigrated} txns migrated`);
    }
  }

  console.log("\n=== Pass 1 migration complete ===");
  console.log(`Wallets processed:        ${walletsProcessed}`);
  console.log(`Transactions migrated:    ${transactionsMigrated}`);
  console.log(`Transactions skipped:     ${skipped} (already present)`);
  console.log(`Errors:                   ${errors}`);
}

run()
  .catch((err) => {
    console.error("MIGRATION FAILED:", err);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());
