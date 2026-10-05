// One-shot: delete every zero-balance non-USD StoreWallet in Garage
// HQ that got eagerly created because HQ was flagged
// officeCreatedFromCryptobrand: true. The USD wallet in HQ is the
// PLATFORM-WIDE parent every user has — NEVER touched. Any non-USD
// wallet with balance > 0 is left alone (a founder had 4.52 INR +
// 0.00007472 BTC — those were consolidated to USD in the previous
// script; if any others turn up now, they still stay).
//
// Only affects orgId = HQ. Wallets in the 22 real cryptobrand
// offices are untouched (different orgId).
//
// USAGE:
//   npx tsx src/scripts/cleanup-hq-cryptobrand-wallets.ts          (dry-run)
//   npx tsx src/scripts/cleanup-hq-cryptobrand-wallets.ts --live   (execute)

import mongoose from "mongoose";
import { StoreWallet } from "../models/storeWallet.model";

const HQ_ORG_ID = "68f1fe05876fcc5fadb61951";
const NON_USD_CURRENCIES = ["INR", "ETH", "BTC", "USDT"] as const;

const isLive = process.argv.includes("--live");

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI required");
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false } as any);
  console.log(`Mode: ${isLive ? "LIVE" : "DRY-RUN"}`);

  const orgId = new mongoose.Types.ObjectId(HQ_ORG_ID);

  const filter = {
    orgId,
    currency: { $in: [...NON_USD_CURRENCIES] },
    balance: 0,
  };

  const [
    perCurrencyTotals,
    withBalanceCount,
    usdCount,
    distinctUsersAffected,
  ] = await Promise.all([
    (async () => {
      const out: Record<string, number> = {};
      for (const c of NON_USD_CURRENCIES) {
        out[c] = await StoreWallet.countDocuments({
          orgId,
          currency: c,
          balance: 0,
        });
      }
      return out;
    })(),
    StoreWallet.countDocuments({
      orgId,
      currency: { $in: [...NON_USD_CURRENCIES] },
      balance: { $gt: 0 },
    }),
    StoreWallet.countDocuments({ orgId, currency: "USD" }),
    (
      await StoreWallet.distinct("userId", filter)
    ).length,
  ]);

  const totalDeletable = Object.values(perCurrencyTotals).reduce(
    (s, n) => s + n,
    0,
  );

  console.log();
  console.log("─── HQ StoreWallet counts ───");
  console.log(`USD wallets (NEVER touched): ${usdCount}`);
  console.log(`Non-USD zero-balance (deletable):`);
  for (const c of NON_USD_CURRENCIES) {
    console.log(`   ${c}: ${perCurrencyTotals[c]}`);
  }
  console.log(`Non-USD with balance > 0 (SKIPPED): ${withBalanceCount}`);
  console.log();
  console.log(`TOTAL to delete: ${totalDeletable}`);
  console.log(`Distinct users affected: ${distinctUsersAffected}`);
  console.log();

  if (withBalanceCount > 0) {
    console.log(
      `⚠ ${withBalanceCount} non-USD wallet(s) still carry balance; those are safe (balance:0 guard).`,
    );
    const stayers: any[] = await StoreWallet.find({
      orgId,
      currency: { $in: [...NON_USD_CURRENCIES] },
      balance: { $gt: 0 },
    })
      .select("userId currency balance")
      .lean();
    for (const s of stayers) {
      console.log(
        `   userId=${s.userId}  ${s.currency}=${s.balance}  (STAYS)`,
      );
    }
    console.log();
  }

  if (!isLive) {
    console.log("Dry-run only. Pass --live to execute the deleteMany.");
    await mongoose.disconnect();
    return;
  }

  const res = await StoreWallet.deleteMany(filter);
  console.log(`✅ deleted ${res.deletedCount} wallet row(s)`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("[cleanup-hq-cryptobrand-wallets]", e);
  process.exit(1);
});
