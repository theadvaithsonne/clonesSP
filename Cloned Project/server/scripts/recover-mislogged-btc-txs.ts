/**
 * One-shot recovery: find WalletTransactions that were logged against a
 * BTC (or INR / ETH) sibling wallet with `currency: "USD"` (or a
 * currency mismatch in general), rewrite them to the correct USD
 * sibling, and re-derive both wallets' balances from the ledger.
 *
 * Root cause: legacy `StoreWallet.findOne({userId, orgId})` lookups
 * across ~20 files return whichever sibling Mongo's compound unique
 * index sorts first (alphabetically → BTC). Every legacy USD-only
 * credit / debit / transfer on a cryptobrand org went to the wrong
 * ledger. Fixed at the schema level via a pre('findOne') hook, but
 * the historical writes need repair.
 *
 * Safe to run repeatedly — idempotent. Only touches rows where
 * `WalletTransaction.currency !== StoreWallet.currency`.
 *
 * Usage:
 *   ./node_modules/.bin/tsx src/scripts/recover-mislogged-btc-txs.ts --dry-run
 *   ./node_modules/.bin/tsx src/scripts/recover-mislogged-btc-txs.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Organization } from "../models/organization.model";
void Organization;

const DRY_RUN = process.argv.includes("--dry-run");

interface Mismatch {
  txId: string;
  txCurrency: string;
  walletCurrency: string;
  walletId: string;
  userId: string;
  orgId: string;
  amount: number;
  type: string;
  createdAt: Date;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log(`Connected — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}\n`);

  // Load every store wallet keyed by _id for currency lookup.
  const wallets: any[] = await StoreWallet.find()
    .select("_id userId orgId currency balance")
    .lean();
  const walletById = new Map<string, any>();
  const walletByTriple = new Map<string, any>(); // userId|orgId|currency → wallet
  for (const w of wallets) {
    walletById.set(String(w._id), w);
    walletByTriple.set(`${w.userId}|${w.orgId}|${w.currency}`, w);
  }
  console.log(`Loaded ${wallets.length} store wallets`);

  // Find mismatched transactions.
  const txs: any[] = await WalletTransaction.find({
    walletType: "store",
    storeWalletId: { $exists: true },
  })
    .select("_id storeWalletId currency amount type userId orgId createdAt description balanceBefore balanceAfter")
    .lean();

  const mismatches: Mismatch[] = [];
  for (const t of txs) {
    const w = walletById.get(String(t.storeWalletId));
    if (!w) continue; // orphan (wallet deleted)
    if (String(w.currency).toUpperCase() !== String(t.currency).toUpperCase()) {
      mismatches.push({
        txId: String(t._id),
        txCurrency: t.currency,
        walletCurrency: w.currency,
        walletId: String(w._id),
        userId: String(t.userId || w.userId),
        orgId: String(t.orgId || w.orgId),
        amount: t.amount,
        type: t.type,
        createdAt: t.createdAt,
      });
    }
  }

  console.log(`\nFound ${mismatches.length} mismatched WalletTransactions:`);
  const byGroup: Record<string, Mismatch[]> = {};
  for (const m of mismatches) {
    const key = `${m.userId}|${m.orgId}|${m.txCurrency} logged on ${m.walletCurrency}`;
    if (!byGroup[key]) byGroup[key] = [];
    byGroup[key].push(m);
  }
  for (const [key, arr] of Object.entries(byGroup)) {
    const total = arr.reduce(
      (s, m) => s + (m.type === "credit" ? m.amount : m.type === "debit" ? -m.amount : 0),
      0,
    );
    console.log(`  ${key}: ${arr.length} tx(s), net ${total.toFixed(2)} ${arr[0].txCurrency}`);
  }

  if (DRY_RUN || mismatches.length === 0) {
    console.log(`\n${DRY_RUN ? "Dry run — no writes." : "Nothing to fix."}\n`);
    await mongoose.disconnect();
    return;
  }

  // ── Repair pass ────────────────────────────────────────────────
  // 1. For each mismatched tx, find the correct sibling wallet by
  //    (userId, orgId, tx.currency). Reassign storeWalletId to it.
  // 2. After all txs are moved, recompute each affected wallet's
  //    balance from its ledger.

  // Delta-based adjustment: for each mislogged tx, subtract its impact
  // from the source (wrong) wallet and add to the destination (correct)
  // wallet. Preserves any pre-existing drift between stored balance
  // and ledger sum (e.g. historical manual admin adjustments) — a full
  // recompute-from-ledger would silently wipe those out.
  //
  // Per-tx impact:
  //   credit    →  +amount
  //   debit     →  -amount
  //   transfer  →  balanceAfter - balanceBefore (delta as recorded)

  // First, group txs by source wallet + destination wallet to compute
  // net impact per (source, dest) pair. Also fetch each tx's
  // balance delta up front so we can update rows in one pass.
  const txDocs: any[] = await WalletTransaction.find({
    _id: { $in: mismatches.map((m) => new mongoose.Types.ObjectId(m.txId)) },
  })
    .select("_id type amount balanceBefore balanceAfter storeWalletId currency userId orgId")
    .lean();
  const txById = new Map<string, any>();
  for (const t of txDocs) txById.set(String(t._id), t);

  function impactOf(t: any): number {
    if (t.type === "credit") return t.amount;
    if (t.type === "debit") return -t.amount;
    if (t.type === "transfer") return (t.balanceAfter || 0) - (t.balanceBefore || 0);
    return 0;
  }

  // Aggregate per (sourceWallet, destWallet) — net delta to remove
  // from source and add to dest.
  const walletDeltas = new Map<string, number>(); // walletId → delta
  const bumpDelta = (walletId: string, delta: number) => {
    walletDeltas.set(walletId, (walletDeltas.get(walletId) || 0) + delta);
  };

  let fixed = 0;
  let missingTarget = 0;
  for (const m of mismatches) {
    const targetKey = `${m.userId}|${m.orgId}|${m.txCurrency.toUpperCase()}`;
    let target = walletByTriple.get(targetKey);
    if (!target) {
      // Auto-create the missing sibling with balance=0. Cryptobrand
      // orgs should have it via ensureCryptobrandWallets already, but
      // legacy rows may predate that.
      const created = await StoreWallet.create({
        userId: m.userId,
        orgId: m.orgId,
        currency: m.txCurrency.toUpperCase(),
        balance: 0,
        isActive: true,
      });
      target = { _id: created._id, currency: created.currency, balance: 0 };
      walletByTriple.set(targetKey, target);
      walletById.set(String(created._id), created);
      console.log(`  + created missing sibling ${m.txCurrency} for user ${m.userId} org ${m.orgId}`);
    }
    if (!target) {
      missingTarget += 1;
      continue;
    }

    const txDoc = txById.get(m.txId);
    if (!txDoc) continue;
    const impact = impactOf(txDoc);

    await WalletTransaction.updateOne(
      { _id: m.txId },
      { $set: { storeWalletId: target._id } },
    );

    // Move impact from source (wrong wallet) to dest (correct wallet).
    bumpDelta(m.walletId, -impact);
    bumpDelta(String(target._id), +impact);
    fixed += 1;
  }

  console.log(`\nReassigned ${fixed} transaction(s). ${missingTarget} skipped (no target).`);

  // Apply the per-wallet balance deltas.
  console.log(`\nApplying balance deltas to ${walletDeltas.size} wallet(s):`);
  for (const [wid, delta] of walletDeltas) {
    if (Math.abs(delta) < 0.00000001) continue;
    const w = walletById.get(wid);
    if (!w) continue;
    const before = w.balance;
    const after = Math.round((before + delta) * 1e8) / 1e8;
    console.log(
      `  wallet ${wid} (${w.currency || "USD"}): ${before} → ${after}  (Δ ${delta > 0 ? "+" : ""}${delta.toFixed(2)})`,
    );
    await StoreWallet.updateOne({ _id: wid }, { $set: { balance: after } });
  }

  console.log(`\n✅ Repair complete.\n`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
