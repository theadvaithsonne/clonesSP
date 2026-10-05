/**
 * Migration script to sweep locked affiliate earnings to Shorupan's platform wallet.
 *
 * For every user who has NOT purchased the Unilevel Plus Plan and has a positive
 * affiliate wallet balance, credit that full balance to Shorupan's StoreWallet.
 * The user's affiliate wallet balance is NOT changed (it remains as a visual number).
 *
 * This is a one-time migration to backfill the routing that was added in the
 * creditAffiliateOrPlatform() helper for all new commissions going forward.
 *
 * Run: npx ts-node src/scripts/migrate-sweep-locked-earnings.ts
 *
 * DRY RUN (default): Set DRY_RUN=true or omit to only log what would happen.
 * LIVE RUN: Set DRY_RUN=false to actually execute.
 */

import mongoose from "mongoose";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { User } from "../models/user.model";
import dotenv from "dotenv";
dotenv.config();

const PLATFORM_USER_EMAIL = "shorupan@gmail.com";
const PLATFORM_ORG_ID = "68f1fe05876fcc5fadb61951";

interface MigrationStats {
  walletsScanned: number;
  walletsWithBalance: number;
  alreadyPurchased: number;
  swept: number;
  totalAmountSwept: number;
  errors: number;
}

async function sweepLockedEarnings(): Promise<MigrationStats> {
  const DRY_RUN = process.env.DRY_RUN !== "false";

  const stats: MigrationStats = {
    walletsScanned: 0,
    walletsWithBalance: 0,
    alreadyPurchased: 0,
    swept: 0,
    totalAmountSwept: 0,
    errors: 0,
  };

  try {
    console.log(`\n${"=".repeat(60)}`);
    console.log(DRY_RUN ? "  DRY RUN MODE (no changes will be made)" : "  LIVE RUN MODE (changes will be committed)");
    console.log(`${"=".repeat(60)}\n`);

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable not set");
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to database\n");

    // Get platform user
    const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
      .select("_id")
      .lean();
    if (!platformUser) {
      throw new Error(`Platform user ${PLATFORM_USER_EMAIL} not found`);
    }
    const platformUserId = platformUser._id.toString();
    console.log(`Platform user: ${PLATFORM_USER_EMAIL} (${platformUserId})\n`);

    // Get all users who have an active UP purchase
    const purchasedUserIds = new Set(
      (
        await UnilevelPlusPurchase.find({ status: "active" })
          .select("userId")
          .lean()
      ).map((p) => p.userId.toString())
    );
    console.log(`Users with active UP purchase: ${purchasedUserIds.size}`);

    // Get all affiliate wallets with positive balance
    const wallets = await AffiliateWallet.find({ balance: { $gt: 0 } }).lean();
    console.log(`Affiliate wallets with positive balance: ${wallets.length}\n`);

    console.log(`${"─".repeat(60)}`);
    console.log("Processing wallets...");
    console.log(`${"─".repeat(60)}\n`);

    for (const wallet of wallets) {
      stats.walletsScanned++;
      const userId = wallet.userId.toString();

      if (wallet.balance <= 0) continue;
      stats.walletsWithBalance++;

      // Skip users who have purchased UP — their money is rightfully theirs
      if (purchasedUserIds.has(userId)) {
        stats.alreadyPurchased++;
        continue;
      }

      const amount = wallet.balance;
      console.log(`  User ${userId}: balance ${amount} ${wallet.currency} -> sweep to platform`);

      if (!DRY_RUN) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // Get or create platform StoreWallet
          let platformWallet = await StoreWallet.findOne({
            userId: platformUserId,
            orgId: new mongoose.Types.ObjectId(PLATFORM_ORG_ID),
          }).session(session);

          if (!platformWallet) {
            const created = await StoreWallet.create(
              [
                {
                  userId: platformUserId,
                  orgId: new mongoose.Types.ObjectId(PLATFORM_ORG_ID),
                  balance: 0,
                  currency: "INR",
                },
              ],
              { session }
            );
            platformWallet = created[0];
          }

          const platBalanceBefore = platformWallet.balance;
          const platBalanceAfter = platBalanceBefore + amount;
          platformWallet.balance = platBalanceAfter;
          platformWallet.lastTransactionAt = new Date();
          await platformWallet.save({ session });

          // Create transaction record
          await WalletTransaction.create(
            [
              {
                storeWalletId: platformWallet._id,
                walletType: "store",
                userId: platformUserId,
                orgId: new mongoose.Types.ObjectId(PLATFORM_ORG_ID),
                type: "credit",
                amount,
                currency: wallet.currency,
                balanceBefore: platBalanceBefore,
                balanceAfter: platBalanceAfter,
                description: `Locked affiliate earnings transfer`,
                note: `Pre-existing locked earnings from non-activated affiliate`,
                metadata: {
                  migrationScript: "migrate-sweep-locked-earnings",
                  lockedFromUserId: userId,
                  originalWalletBalance: amount,
                  migratedAt: new Date().toISOString(),
                },
                status: "completed",
              },
            ],
            { session }
          );

          await session.commitTransaction();
          stats.swept++;
          stats.totalAmountSwept += amount;
          console.log(`    -> Swept ${amount} ${wallet.currency}`);
        } catch (err) {
          await session.abortTransaction();
          stats.errors++;
          console.error(`    -> ERROR: ${(err as Error).message}`);
        } finally {
          session.endSession();
        }
      } else {
        // Dry run — just count
        stats.swept++;
        stats.totalAmountSwept += amount;
      }
    }

    // Summary
    console.log(`\n${"=".repeat(60)}`);
    console.log(DRY_RUN ? "  DRY RUN COMPLETE (no changes made)" : "  MIGRATION COMPLETE");
    console.log(`${"=".repeat(60)}\n`);
    console.log("Summary:");
    console.log(`  Wallets scanned:        ${stats.walletsScanned}`);
    console.log(`  With positive balance:  ${stats.walletsWithBalance}`);
    console.log(`  Already UP-purchased:   ${stats.alreadyPurchased} (skipped)`);
    console.log(`  Swept to platform:      ${stats.swept}`);
    console.log(`  Total amount swept:     ${stats.totalAmountSwept.toFixed(2)} INR`);
    console.log(`  Errors:                 ${stats.errors}`);

    if (DRY_RUN) {
      console.log(`\nTo execute for real, run with: DRY_RUN=false npx ts-node src/scripts/migrate-sweep-locked-earnings.ts`);
    }

    return stats;
  } catch (error) {
    console.error("\nMigration failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from database");
  }
}

if (require.main === module) {
  sweepLockedEarnings()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

export { sweepLockedEarnings };
