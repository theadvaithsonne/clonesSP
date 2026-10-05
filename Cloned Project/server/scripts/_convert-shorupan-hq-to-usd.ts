// One-shot: convert Shorupan's non-USD balances in Garage HQ
// (INR 4.52 + BTC 0.00007472) to USD at live spot rate and credit
// his HQ USD wallet. Debits the source wallets to 0 so the HQ
// cleanup script's `balance: 0` guard subsequently deletes them.
//
// Writes three WalletTransaction rows for the audit trail:
//   1. INR debit (4.52 INR → 0)
//   2. BTC debit (0.00007472 BTC → 0)
//   3. USD credit (sum of both conversions)
//
// All three rows carry `metadata.kind: "hq_cryptobrand_cleanup"` so
// they're distinguishable in the ledger from user-initiated
// conversions. dedupeKey guards against re-runs.
//
// USAGE:
//   npx tsx src/scripts/_convert-shorupan-hq-to-usd.ts            (dry-run)
//   npx tsx src/scripts/_convert-shorupan-hq-to-usd.ts --live     (execute)

import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { getUsdPerCoin } from "../services/cryptoFxRate";
import { convertInrToUsd } from "../utils/exchangeRate";

const HQ_ORG_ID = "68f1fe05876fcc5fadb61951";
const SHORUPAN_USER_ID = "68f1fe06876fcc5fadb61984";

const isLive = process.argv.includes("--live");

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI required");
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false } as any);

  const orgId = new Types.ObjectId(HQ_ORG_ID);
  const userId = new Types.ObjectId(SHORUPAN_USER_ID);

  console.log(`Mode: ${isLive ? "LIVE (will write)" : "DRY-RUN (no writes)"}`);
  console.log();

  const wallets: any[] = await StoreWallet.find({
    userId,
    orgId,
    currency: { $in: ["USD", "INR", "BTC"] },
  })
    .select("_id currency balance")
    .lean();
  const byCurrency = new Map(wallets.map((w) => [w.currency, w]));
  const usdWallet: any = byCurrency.get("USD");
  const inrWallet: any = byCurrency.get("INR");
  const btcWallet: any = byCurrency.get("BTC");

  if (!usdWallet || !inrWallet || !btcWallet) {
    console.error("Missing one of USD / INR / BTC wallets in HQ for user.");
    process.exit(1);
  }

  console.log(`USD wallet: ${usdWallet._id}  balance=${usdWallet.balance}`);
  console.log(`INR wallet: ${inrWallet._id}  balance=${inrWallet.balance}`);
  console.log(`BTC wallet: ${btcWallet._id}  balance=${btcWallet.balance}`);
  console.log();

  const inrAmount = Number(inrWallet.balance || 0);
  const btcAmount = Number(btcWallet.balance || 0);

  // Live spot rates.
  const btcUsdRate = await getUsdPerCoin("BTC");
  const inrToUsd = await convertInrToUsd(inrAmount);
  const inrAsUsd = inrToUsd.usdAmount;
  const btcAsUsd = Math.round(btcAmount * btcUsdRate * 100) / 100;
  const totalUsd = Math.round((inrAsUsd + btcAsUsd) * 100) / 100;

  console.log("─── Live rates ───");
  console.log(`BTC/USD: $${btcUsdRate.toLocaleString()}`);
  console.log(`INR/USD: 1 USD = ${(inrAmount / (inrAsUsd || 1)).toFixed(2)} INR (approx from convertInrToUsd)`);
  console.log();
  console.log("─── Conversion ───");
  console.log(`INR ${inrAmount}   →  USD $${inrAsUsd.toFixed(4)}`);
  console.log(`BTC ${btcAmount}   →  USD $${btcAsUsd.toFixed(4)}`);
  console.log(`TOTAL USD to credit: $${totalUsd.toFixed(4)}`);
  console.log();
  console.log(`USD wallet balance will move: ${usdWallet.balance}  →  ${(usdWallet.balance + totalUsd).toFixed(4)}`);
  console.log(`INR wallet balance will move: ${inrAmount}  →  0`);
  console.log(`BTC wallet balance will move: ${btcAmount}  →  0`);
  console.log();

  if (!isLive) {
    console.log("Dry-run only. Pass --live to execute.");
    await mongoose.disconnect();
    return;
  }

  // Idempotency — dedupeKey shared across all three legs so a re-run
  // hits the partial-unique WalletTransaction.metadata.dedupeKey and
  // no double-writes happen.
  const runKey = `hq-cryptobrand-cleanup:${SHORUPAN_USER_ID}:${HQ_ORG_ID}:v1`;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // ── Debit INR ──
    if (inrAmount > 0) {
      await StoreWallet.updateOne(
        { _id: inrWallet._id },
        { $set: { balance: 0, lastTransactionAt: new Date() } },
        { session },
      );
      await WalletTransaction.create(
        [
          {
            storeWalletId: inrWallet._id,
            walletType: "store",
            userId,
            orgId,
            type: "debit",
            amount: inrAmount,
            currency: "INR",
            balanceBefore: inrAmount,
            balanceAfter: 0,
            description: "HQ cryptobrand cleanup — drain INR to USD",
            note: `converted to $${inrAsUsd.toFixed(4)} at live rate; USD wallet credited in same txn`,
            status: "completed",
            metadata: {
              kind: "hq_cryptobrand_cleanup",
              leg: "debit_inr",
              usdEquivalent: inrAsUsd,
              dedupeKey: crypto
                .createHash("sha256")
                .update(`${runKey}|debit_inr`)
                .digest("hex"),
            },
          },
        ],
        { session },
      );
    }

    // ── Debit BTC ──
    if (btcAmount > 0) {
      await StoreWallet.updateOne(
        { _id: btcWallet._id },
        { $set: { balance: 0, lastTransactionAt: new Date() } },
        { session },
      );
      await WalletTransaction.create(
        [
          {
            storeWalletId: btcWallet._id,
            walletType: "store",
            userId,
            orgId,
            type: "debit",
            amount: btcAmount,
            currency: "BTC",
            balanceBefore: btcAmount,
            balanceAfter: 0,
            description: "HQ cryptobrand cleanup — drain BTC to USD",
            note: `converted to $${btcAsUsd.toFixed(4)} at 1 BTC = $${btcUsdRate.toLocaleString()}; USD wallet credited in same txn`,
            status: "completed",
            metadata: {
              kind: "hq_cryptobrand_cleanup",
              leg: "debit_btc",
              usdEquivalent: btcAsUsd,
              btcUsdRateAtConversion: btcUsdRate,
              dedupeKey: crypto
                .createHash("sha256")
                .update(`${runKey}|debit_btc`)
                .digest("hex"),
            },
          },
        ],
        { session },
      );
    }

    // ── Credit USD (sum of both) ──
    const usdBalanceBefore = Number(usdWallet.balance || 0);
    const usdBalanceAfter = Math.round((usdBalanceBefore + totalUsd) * 100) / 100;
    await StoreWallet.updateOne(
      { _id: usdWallet._id },
      { $set: { balance: usdBalanceAfter, lastTransactionAt: new Date() } },
      { session },
    );
    await WalletTransaction.create(
      [
        {
          storeWalletId: usdWallet._id,
          walletType: "store",
          userId,
          orgId,
          type: "credit",
          amount: totalUsd,
          currency: "USD",
          balanceBefore: usdBalanceBefore,
          balanceAfter: usdBalanceAfter,
          description: "HQ cryptobrand cleanup — consolidated INR + BTC → USD",
          note: `INR ${inrAmount} (~$${inrAsUsd.toFixed(4)}) + BTC ${btcAmount} (~$${btcAsUsd.toFixed(4)}) = $${totalUsd.toFixed(4)}`,
          status: "completed",
          metadata: {
            kind: "hq_cryptobrand_cleanup",
            leg: "credit_usd",
            sources: [
              { currency: "INR", amount: inrAmount, usdEquivalent: inrAsUsd },
              {
                currency: "BTC",
                amount: btcAmount,
                usdEquivalent: btcAsUsd,
                btcUsdRateAtConversion: btcUsdRate,
              },
            ],
            dedupeKey: crypto
              .createHash("sha256")
              .update(`${runKey}|credit_usd`)
              .digest("hex"),
          },
        },
      ],
      { session },
    );

    await session.commitTransaction();
    console.log("✅ COMMITTED. USD wallet now at:", usdBalanceAfter);
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ ABORTED:", (err as Error).message);
    throw err;
  } finally {
    session.endSession();
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("[convert-shorupan-hq-to-usd]", e);
  process.exit(1);
});
