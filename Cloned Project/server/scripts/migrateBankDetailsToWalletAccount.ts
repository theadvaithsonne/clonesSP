/**
 * One-time migration: copy each legacy per-user BankDetails record into the
 * new per-wallet model as the AFFILIATE wallet's bank account.
 *
 * Run once per environment:
 *     npx ts-node src/scripts/migrateBankDetailsToWalletAccount.ts
 *
 * Idempotent — upserts on the wallet slot {userId, affiliate, null, bank},
 * so re-running just refreshes the same rows. The legacy BankDetails
 * collection is left untouched.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

import { BankDetails } from "../models/bank-details.model";
import { WalletAccount } from "../models/walletAccount.model";

dotenv.config();

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI environment variable not set");
  await mongoose.connect(mongoUri);
  console.log("[migrate] connected");

  const cursor = BankDetails.find({}).lean().cursor();
  let migrated = 0;
  let skipped = 0;

  for await (const bd of cursor as any) {
    if (!bd.userId) {
      skipped++;
      continue;
    }
    await WalletAccount.findOneAndUpdate(
      {
        userId: bd.userId,
        walletType: "affiliate",
        orgId: null,
        accountType: "bank",
      },
      {
        userId: bd.userId,
        walletType: "affiliate",
        orgId: null,
        accountType: "bank",
        label: "",
        country: bd.country || "",
        bankName: bd.bankName || "",
        branchAddress: bd.branchAddress || {},
        routingNumber: bd.routingNumber || "",
        accountNumber: bd.accountNumber || "",
        swiftCode: bd.swiftCode || "",
        ibanNumber: bd.ibanNumber || "",
        beneficiaryName: bd.beneficiaryName || "",
        beneficiaryAddress: bd.beneficiaryAddress || {},
        isActive: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    migrated++;
  }

  console.log(`[migrate] done — migrated ${migrated}, skipped ${skipped}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
