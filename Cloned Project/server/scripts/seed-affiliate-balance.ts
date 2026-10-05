import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const { User } = await import("../models/user.model");
  const { AffiliateWallet } = await import("../models/affiliateWallet.model");
  const { WalletTransaction } = await import("../models/walletTransaction.model");

  const email = "johncena@yopmail.com";
  const seedAmount = 500;

  const user = await User.findOne({ email }).lean();
  if (!user) {
    console.error(`User with email ${email} not found`);
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (${user._id})`);

  // Get or create affiliate wallet
  let wallet = await AffiliateWallet.findOne({ userId: user._id });
  if (!wallet) {
    wallet = await AffiliateWallet.create({
      userId: user._id,
      balance: 0,
      currency: "USD",
      totalEarnings: 0,
      totalWithdrawn: 0,
    });
    console.log("Created new affiliate wallet");
  }

  const balanceBefore = wallet.balance;
  const balanceAfter = balanceBefore + seedAmount;

  // Update wallet
  wallet.balance = balanceAfter;
  wallet.totalEarnings = (wallet.totalEarnings || 0) + seedAmount;
  wallet.lastTransactionAt = new Date();
  await wallet.save();

  // Create transaction record
  await WalletTransaction.create({
    affiliateWalletId: wallet._id,
    walletType: "affiliate",
    userId: user._id,
    type: "commission",
    amount: seedAmount,
    currency: "USD",
    balanceBefore,
    balanceAfter,
    description: "Seed: Affiliate balance for testing",
    status: "completed",
  });

  console.log(`Seeded $${seedAmount} to ${email}'s affiliate wallet`);
  console.log(`Balance: $${balanceBefore.toFixed(2)} → $${balanceAfter.toFixed(2)}`);

  await mongoose.disconnect();
  console.log("Done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
