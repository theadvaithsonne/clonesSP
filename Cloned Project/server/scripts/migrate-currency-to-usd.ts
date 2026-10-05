/**
 * Migration script: Convert all wallets from INR to USD
 *
 * This script:
 * 1. Resets all store wallet balances to 0 and sets currency to "USD"
 * 2. Resets all affiliate wallet balances to 0 and sets currency to "USD"
 * 3. Marks existing INR wallet transactions with metadata.legacyINR = true
 * 4. Marks existing INR commission distributions with metadata.legacyINR = true
 * 5. Creates a migration audit record
 *
 * IMPORTANT: Uses raw MongoDB driver to bypass Mongoose immutable constraints on currency fields.
 *
 * Run: npx ts-node src/scripts/migrate-currency-to-usd.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

interface MigrationResult {
  storeWalletsUpdated: number;
  affiliateWalletsUpdated: number;
  walletTransactionsMarked: number;
  commissionDistributionsMarked: number;
  startedAt: Date;
  completedAt?: Date;
  errors: string[];
}

async function migrateCurrencyToUsd(): Promise<MigrationResult> {
  const result: MigrationResult = {
    storeWalletsUpdated: 0,
    affiliateWalletsUpdated: 0,
    walletTransactionsMarked: 0,
    commissionDistributionsMarked: 0,
    startedAt: new Date(),
    errors: [],
  };

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI not found in environment variables");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected.\n");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not available");
    }

    // ========================================
    // Step 1: Reset all store wallets to USD with balance 0
    // ========================================
    console.log("Step 1: Resetting store wallets to USD...");
    try {
      const storeWalletResult = await db.collection("storewallets").updateMany(
        {}, // All wallets
        {
          $set: {
            currency: "USD",
            balance: 0,
            lastTransactionAt: new Date(),
          },
        }
      );
      result.storeWalletsUpdated = storeWalletResult.modifiedCount;
      console.log(`  Updated ${result.storeWalletsUpdated} store wallets`);
    } catch (error) {
      const msg = `Step 1 failed: ${(error as Error).message}`;
      result.errors.push(msg);
      console.error(`  ERROR: ${msg}`);
    }

    // ========================================
    // Step 2: Reset all affiliate wallets to USD with balance 0
    // ========================================
    console.log("Step 2: Resetting affiliate wallets to USD...");
    try {
      const affiliateWalletResult = await db
        .collection("affiliatewallets")
        .updateMany(
          {}, // All wallets
          {
            $set: {
              currency: "USD",
              balance: 0,
              totalEarnings: 0,
              totalWithdrawn: 0,
              lastTransactionAt: new Date(),
            },
          }
        );
      result.affiliateWalletsUpdated = affiliateWalletResult.modifiedCount;
      console.log(
        `  Updated ${result.affiliateWalletsUpdated} affiliate wallets`
      );
    } catch (error) {
      const msg = `Step 2 failed: ${(error as Error).message}`;
      result.errors.push(msg);
      console.error(`  ERROR: ${msg}`);
    }

    // ========================================
    // Step 3: Mark existing wallet transactions as legacy INR
    // ========================================
    console.log("Step 3: Marking existing wallet transactions as legacy INR...");
    try {
      const txResult = await db
        .collection("wallettransactions")
        .updateMany(
          { "metadata.legacyINR": { $ne: true } }, // Only those not already marked
          {
            $set: {
              "metadata.legacyINR": true,
              "metadata.migrationDate": new Date(),
            },
          }
        );
      result.walletTransactionsMarked = txResult.modifiedCount;
      console.log(
        `  Marked ${result.walletTransactionsMarked} wallet transactions`
      );
    } catch (error) {
      const msg = `Step 3 failed: ${(error as Error).message}`;
      result.errors.push(msg);
      console.error(`  ERROR: ${msg}`);
    }

    // ========================================
    // Step 4: Mark existing commission distributions as legacy INR
    // ========================================
    console.log(
      "Step 4: Marking existing commission distributions as legacy INR..."
    );
    try {
      const commResult = await db
        .collection("commissiondistributions")
        .updateMany(
          { "metadata.legacyINR": { $ne: true } },
          {
            $set: {
              "metadata.legacyINR": true,
              "metadata.migrationDate": new Date(),
            },
          }
        );
      result.commissionDistributionsMarked = commResult.modifiedCount;
      console.log(
        `  Marked ${result.commissionDistributionsMarked} commission distributions`
      );
    } catch (error) {
      const msg = `Step 4 failed: ${(error as Error).message}`;
      result.errors.push(msg);
      console.error(`  ERROR: ${msg}`);
    }

    // ========================================
    // Step 5: Create migration audit record
    // ========================================
    console.log("Step 5: Creating migration audit record...");
    try {
      result.completedAt = new Date();
      await db.collection("migrations").insertOne({
        name: "currency-inr-to-usd",
        description:
          "Migrated all wallets from INR to USD. Reset balances to 0. Marked legacy transactions.",
        result,
        executedAt: new Date(),
        executedBy: "migration-script",
      });
      console.log("  Audit record created.");
    } catch (error) {
      const msg = `Step 5 failed: ${(error as Error).message}`;
      result.errors.push(msg);
      console.error(`  ERROR: ${msg}`);
    }

    // Summary
    console.log("\n========================================");
    console.log("Migration Summary:");
    console.log("========================================");
    console.log(`Store wallets reset:          ${result.storeWalletsUpdated}`);
    console.log(
      `Affiliate wallets reset:      ${result.affiliateWalletsUpdated}`
    );
    console.log(
      `Transactions marked legacy:   ${result.walletTransactionsMarked}`
    );
    console.log(
      `Commissions marked legacy:    ${result.commissionDistributionsMarked}`
    );
    console.log(`Errors:                       ${result.errors.length}`);
    if (result.errors.length > 0) {
      console.log("\nErrors:");
      result.errors.forEach((e) => console.log(`  - ${e}`));
    }
    console.log("========================================\n");

    return result;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

// Run the migration
migrateCurrencyToUsd()
  .then((result) => {
    if (result.errors.length > 0) {
      console.error("Migration completed with errors.");
      process.exit(1);
    }
    console.log("Migration completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
