/**
 * Reset script to wipe all wallet balances, transactions, and commission distributions.
 * Use this when migrating currency (e.g., INR -> USD) to start fresh.
 *
 * This script will:
 * 1. Reset all AffiliateWallet balances to 0 (and currency to USD)
 * 2. Reset all StoreWallet balances to 0 (and currency to USD)
 * 3. Delete all WalletTransaction records
 * 4. Delete all CommissionDistribution records
 * 5. Delete all UnilevelPlusDistribution records
 *
 * Run: npx ts-node src/scripts/reset-wallets.ts
 */

import mongoose from "mongoose";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { UnilevelPlusDistribution } from "../models/unilevelPlusDistribution.model";
import dotenv from "dotenv";
dotenv.config();

async function resetWallets() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI not found in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  console.log(`URI: ${mongoUri.replace(/\/\/.*@/, "//***:***@")}\n`); // mask credentials

  await mongoose.connect(mongoUri);
  console.log("Connected.\n");

  // --- 1. Reset AffiliateWallet balances ---
  const affiliateResult = await AffiliateWallet.updateMany(
    {},
    {
      $set: {
        balance: 0,
        totalEarnings: 0,
        totalWithdrawn: 0,
        currency: "USD",
        lastTransactionAt: null,
      },
    }
  );
  console.log(`AffiliateWallets reset: ${affiliateResult.modifiedCount} wallets`);

  // --- 2. Reset StoreWallet balances ---
  const storeResult = await StoreWallet.updateMany(
    {},
    {
      $set: {
        balance: 0,
        currency: "USD",
        lastTransactionAt: null,
      },
    }
  );
  console.log(`StoreWallets reset: ${storeResult.modifiedCount} wallets`);

  // --- 3. Delete all WalletTransactions ---
  const txResult = await WalletTransaction.deleteMany({});
  console.log(`WalletTransactions deleted: ${txResult.deletedCount} records`);

  // --- 4. Delete all CommissionDistributions ---
  const commResult = await CommissionDistribution.deleteMany({});
  console.log(`CommissionDistributions deleted: ${commResult.deletedCount} records`);

  // --- 5. Delete all UnilevelPlusDistributions ---
  const uniResult = await UnilevelPlusDistribution.deleteMany({});
  console.log(`UnilevelPlusDistributions deleted: ${uniResult.deletedCount} records`);

  console.log("\nWallet reset complete. All balances are now $0.00 USD.");

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
}

resetWallets().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
