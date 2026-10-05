/**
 * Repairs the referral-bonus payouts that landed in BTC wallets.
 *
 * `StoreWallet.findOne({userId, orgId})` resolves through the
 * {userId, orgId, currency} unique index, where "BTC" sorts first — so every
 * unpinned lookup returned the BTC sibling. services/wallet.ts already fixed
 * the READ path and explicitly left the write paths alone; referralSignupBonus
 * inherited the bug from that pattern and has now been pinned to USD.
 *
 * This moves the already-paid money to the wallets the recipients can actually
 * see, and clears the transaction rows left behind by testing.
 *
 * Run with --apply to write. Default is a dry run.
 */
import dotenv from "dotenv"; dotenv.config({ quiet: true } as any);
import mongoose, { Types } from "mongoose";

const APPLY = process.argv.includes("--apply");
const r2 = (n: number) => Math.round(n * 100) / 100;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { StoreWallet } = await import("../models/storeWallet.model");
  const { WalletTransaction } = await import("../models/walletTransaction.model");

  console.log(APPLY ? "=== APPLY ===" : "=== DRY RUN (pass --apply to write) ===\n");

  const txns: any[] = await WalletTransaction.find({
    "metadata.kind": "referral_signup_bonus",
  }).sort({ createdAt: 1 }).lean();

  const orphans: any[] = [];
  const live: any[] = [];
  for (const t of txns) {
    const w = await StoreWallet.findById(t.storeWalletId).lean();
    (w ? live : orphans).push({ t, w });
  }

  // ── 1. Testing artifacts: rows pointing at wallets that no longer exist ──
  console.log(`Orphan txn rows (point at deleted wallets, from testing): ${orphans.length}`);
  for (const { t } of orphans)
    console.log(`   delete ${t._id} ${t.type} $${t.amount} @ ${t.createdAt.toISOString()}`);

  // The two platform debits from those test runs were already undone by
  // resetting the balance directly, so only their ledger rows remain.
  const testPlatformDebits = live.filter(
    (x) => x.t.type === "debit" && x.t.createdAt < new Date("2026-09-05T06:00:00Z")
  );
  console.log(`\nPlatform debit rows from testing (balance already restored): ${testPlatformDebits.length}`);
  for (const { t } of testPlatformDebits)
    console.log(`   delete ${t._id} debit $${t.amount} @ ${t.createdAt.toISOString()}`);

  // ── 2. The real backfill: move BTC -> USD on all three sides ──
  const real = live.filter((x) => !testPlatformDebits.includes(x));
  console.log(`\nReal payout rows to move BTC -> USD: ${real.length}`);

  const moves: any[] = [];
  for (const { t, w } of real) {
    if (w.currency === "USD") { console.log(`   ${t._id} already USD — skip`); continue; }
    const usd: any = await StoreWallet.findOne({
      userId: w.userId, orgId: w.orgId, currency: "USD",
    }).lean();
    if (!usd) { console.log(`   !! no USD wallet for user ${w.userId} org ${w.orgId}`); continue; }
    moves.push({ t, from: w, to: usd });
    const sign = t.type === "debit" ? -1 : 1;
    console.log(
      `   ${t.type.padEnd(6)} $${t.amount}  BTC ${w._id} ($${w.balance} -> $${r2(w.balance - sign * t.amount)})` +
      `  =>  USD ${usd._id} ($${usd.balance} -> $${r2(usd.balance + sign * t.amount)})`
    );
  }

  if (!APPLY) { console.log("\nNothing written."); await mongoose.disconnect(); return; }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const { t } of [...orphans, ...testPlatformDebits])
        await WalletTransaction.deleteOne({ _id: t._id }, { session });

      for (const { t, from, to } of moves) {
        const sign = t.type === "debit" ? -1 : 1;
        // Undo on BTC.
        const fromDoc: any = await StoreWallet.findById(from._id).session(session);
        fromDoc.balance = r2(fromDoc.balance - sign * t.amount);
        await fromDoc.save({ session });
        // Redo on USD, and repoint the ledger row so it reads correctly.
        const toDoc: any = await StoreWallet.findById(to._id).session(session);
        const before = toDoc.balance || 0;
        const after = r2(before + sign * t.amount);
        toDoc.balance = after;
        toDoc.lastTransactionAt = new Date();
        await toDoc.save({ session });
        await WalletTransaction.updateOne(
          { _id: t._id },
          { $set: { storeWalletId: toDoc._id, balanceBefore: before, balanceAfter: after } },
          { session }
        );
      }
    });
    console.log("\nApplied.");
  } finally { await session.endSession(); }
  await mongoose.disconnect();
})();
