/**
 * Re-point a member's ALREADY-PAID Unilevel Plus commission at their new upline.
 *
 * `POST /garage-admin/users/:id/move-upline` deliberately only affects FUTURE
 * commissions — the historical ledger is immutable by design. When an admin
 * moves someone whose $25 UP purchase has already distributed, the payout still
 * follows the old chain. This script performs that correction.
 *
 * WHAT IT DOES
 *   1. Reverses every wallet transaction the original distribution created,
 *      by posting opposite entries. The original transactions and the original
 *      distribution's recipient arrays are never mutated — the audit trail is
 *      append-only. The distribution is marked status: "reversed".
 *   2. Re-runs distributeUnilevelPlusCommission against the CURRENT tree, under
 *      a fresh paymentId, carrying metadata.supersedes.
 *
 * This is NOT zero-sum. A buyer who sat near the tree root had most of the
 * level-bonus budget fall through to the platform as `unallocatedAmount`.
 * Re-running under a deep upline pays that out to real people, so platform
 * revenue drops. The dry run prints the delta — read it before confirming.
 *
 * TRANSACTIONALITY
 *   distributeUnilevelPlusCommission opens and owns its own Mongo session
 *   (services/unilevelPlusCommission.ts:714), so the reversal and the re-run
 *   cannot share one transaction without refactoring a live money path. Each
 *   phase is individually atomic instead, and if the re-run fails the reversal
 *   is compensated automatically. The script is also resumable: run it again
 *   and it completes whichever half is outstanding.
 *
 * Usage (from roam-backend/):
 *   npx tsx src/scripts/move-unilevel-commission.ts <buyer-email>
 *   npx tsx src/scripts/move-unilevel-commission.ts <buyer-email> --confirm
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { UnilevelPlusDistribution } from "../models/unilevelPlusDistribution.model";
import { distributeUnilevelPlusCommission } from "../services/unilevelPlusCommission";

const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

type Named = { _id: any; name?: string; email?: string };
const label = (u?: Named | null) =>
  u ? `${u.name || "(no name)"} <${u.email}>` : "(unknown)";

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const emailArg = args.find((a) => !a.startsWith("--"));
  if (!emailArg) {
    console.error(
      "Usage: npx tsx src/scripts/move-unilevel-commission.ts <buyer-email> [--confirm]",
    );
    process.exit(1);
  }
  const email = emailArg.trim().toLowerCase();

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected to Mongo (db: ${mongoose.connection.name})\n`);

  // ── Resolve buyer ───────────────────────────────────────────────────────
  const buyer = await User.findOne({ email })
    .select("_id name email referredBy")
    .lean<any>();
  if (!buyer) {
    console.error(`❌ No user with email ${email}`);
    process.exit(1);
  }
  console.log(`👤 Buyer: ${label(buyer)}  ${buyer._id}`);

  // ── Resolve the distribution to correct ─────────────────────────────────
  const all = await UnilevelPlusDistribution.find({ buyerId: buyer._id })
    .sort({ createdAt: 1 })
    .lean<any[]>();
  if (all.length === 0) {
    console.error(`❌ No Unilevel Plus distribution found for this buyer.`);
    process.exit(1);
  }

  // A superseding run from a previous invocation means the correction already
  // happened — don't stack another one on top.
  const superseding = all.find((d) => d.metadata?.supersedes);
  const live = all.filter((d) => d.status === "completed" && !d.metadata?.supersedes);
  const reversed = all.filter((d) => d.status === "reversed");

  if (superseding && live.length === 0) {
    console.log(
      `\nℹ️  Already corrected — distribution ${superseding._id} supersedes ${superseding.metadata.supersedes}. Nothing to do.`,
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  // Resumable: a previous run reversed but died before re-running.
  const orphanReversed =
    !superseding && reversed.length > 0 && live.length === 0 ? reversed[reversed.length - 1] : null;

  if (!orphanReversed && live.length === 0) {
    console.error(
      `❌ No completed distribution to correct (found ${all.length}: ${all
        .map((d) => d.status)
        .join(", ")}).`,
    );
    process.exit(1);
  }
  if (live.length > 1) {
    console.error(`❌ ${live.length} completed distributions for this buyer — refusing to guess:`);
    for (const d of live) console.error(`   ${d._id}  ${money(d.saleAmount)}  ${d.createdAt?.toISOString?.()}`);
    process.exit(1);
  }

  const dist = orphanReversed || live[0];
  console.log(`📄 Distribution: ${dist._id}  ${money(dist.saleAmount)} ${dist.currency}  status=${dist.status}`);

  // ── Who was paid vs who should be ───────────────────────────────────────
  const oldUpline = dist.directBonusRecipientId
    ? await User.findById(dist.directBonusRecipientId).select("name email").lean<any>()
    : null;
  const newUpline = buyer.referredBy
    ? await User.findById(buyer.referredBy).select("name email").lean<any>()
    : null;

  console.log(`   paid to  : ${label(oldUpline)}`);
  console.log(`   should be: ${label(newUpline)}`);

  if (!newUpline) {
    console.error(`\n❌ Buyer has no referredBy — nothing to move them to.`);
    process.exit(1);
  }
  if (oldUpline && String(oldUpline._id) === String(newUpline._id) && !orphanReversed) {
    console.log(`\nℹ️  Upline unchanged — the distribution already pays the current upline. Nothing to do.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── Gather everything the original distribution credited ────────────────
  // Every write from this distribution is tagged metadata.distributionId —
  // including the platform-lock rows creditAffiliateOrPlatform adds for
  // recipients who never activated (services/wallet.ts:1358+). Iterating the
  // transactions therefore covers both halves of that dual write without
  // special-casing it.
  const txns = await WalletTransaction.find({
    "metadata.distributionId": dist._id,
    status: "completed",
  }).lean<any[]>();

  console.log(`\n── REVERSE ── ${txns.length} transaction(s)`);
  let reverseTotal = 0;
  const plan: Array<{ txn: any; kind: "affiliate" | "store"; wallet: any; owner: any }> = [];

  for (const t of txns) {
    let wallet: any = null;
    let kind: "affiliate" | "store" = "affiliate";
    if (t.affiliateWalletId) {
      wallet = await AffiliateWallet.findById(t.affiliateWalletId).lean<any>();
      kind = "affiliate";
    } else if (t.storeWalletId) {
      wallet = await StoreWallet.findById(t.storeWalletId).lean<any>();
      kind = "store";
    }
    if (!wallet) {
      console.error(`❌ Transaction ${t._id} has no resolvable wallet — aborting.`);
      process.exit(1);
    }
    const owner = await User.findById(wallet.userId).select("name email").lean<any>();
    plan.push({ txn: t, kind, wallet, owner });
    reverseTotal = round2(reverseTotal + t.amount);
    console.log(
      `   -${money(t.amount).padStart(9)}  ${kind.padEnd(9)} ${label(owner)}  "${t.description}"`,
    );
  }
  console.log(`   ${"".padStart(3)}total to claw back: ${money(reverseTotal)}`);

  // Balance safety — never drive a wallet negative.
  const needed = new Map<string, number>();
  for (const p of plan) {
    const k = `${p.kind}:${p.wallet._id}`;
    needed.set(k, round2((needed.get(k) || 0) + p.txn.amount));
  }
  let insufficient = false;
  for (const p of plan) {
    const k = `${p.kind}:${p.wallet._id}`;
    const need = needed.get(k)!;
    if (p.wallet.balance < need) {
      console.error(
        `❌ ${label(p.owner)} ${p.kind} wallet has ${money(p.wallet.balance)}, needs ${money(need)} — short ${money(need - p.wallet.balance)}`,
      );
      insufficient = true;
      needed.delete(k);
    }
  }
  if (insufficient) {
    console.error(`\nRefusing to drive a wallet negative. Nothing written.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // ── Preview the re-run ──────────────────────────────────────────────────
  console.log(`\n── RE-RUN ── against the current tree`);
  const chain: any[] = [];
  let cur: any = newUpline;
  for (let lvl = 1; cur && lvl <= 15; lvl++) {
    chain.push({ lvl, u: cur });
    const nxt: any = await User.findById(cur._id).select("referredBy").lean<any>();
    cur = nxt?.referredBy
      ? await User.findById(nxt.referredBy).select("name email referredBy").lean<any>()
      : null;
  }
  console.log(`   ${money(dist.saleAmount)} will be redistributed across this chain:`);
  for (const c of chain.slice(0, 8)) console.log(`     L${String(c.lvl).padEnd(2)} ${label(c.u)}`);
  if (chain.length > 8) console.log(`     … ${chain.length - 8} more level(s)`);
  console.log(
    `   Exact per-level amounts are computed by the live distribution engine at execution.`,
  );
  console.log(
    `   Previously unallocated budget now finds recipients, so the platform's share DROPS.`,
  );

  if (!confirm) {
    console.log(`\n🔍 DRY RUN — nothing written. Re-run with --confirm to apply.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── PHASE 1: reversal (atomic) ──────────────────────────────────────────
  const reversalTxnIds: any[] = [];
  if (!orphanReversed) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (const p of plan) {
        const Model: any = p.kind === "affiliate" ? AffiliateWallet : StoreWallet;
        const w = await Model.findById(p.wallet._id).session(session);
        const before = w.balance;
        const after = round2(before - p.txn.amount);
        w.balance = after;
        // totalEarnings tracks lifetime credits on affiliate wallets; the
        // original credit inflated it, so the reversal must deflate it or the
        // recipient's lifetime earnings permanently overstate what they kept.
        if (p.kind === "affiliate") {
          w.totalEarnings = round2((w.totalEarnings || 0) - p.txn.amount);
        }
        w.lastTransactionAt = new Date();
        await w.save({ session });

        const created = await WalletTransaction.create(
          [
            {
              ...(p.kind === "affiliate"
                ? { affiliateWalletId: w._id, walletType: "affiliate" }
                : { storeWalletId: w._id, walletType: "store", orgId: p.txn.orgId }),
              userId: w.userId,
              type: "debit",
              amount: p.txn.amount,
              currency: p.txn.currency || dist.currency || "USD",
              balanceBefore: before,
              balanceAfter: after,
              description: `Reversal: ${p.txn.description}`,
              note: `Upline moved — commission re-pointed to ${label(newUpline)}`,
              relatedUserId: buyer._id,
              metadata: {
                reversalOf: p.txn._id,
                distributionId: dist._id,
                distributionType: "unilevel_plus",
                reason: "upline_move",
                movedFrom: oldUpline?._id,
                movedTo: newUpline._id,
              },
              status: "completed",
            },
          ],
          { session },
        );
        reversalTxnIds.push(created[0]._id);
      }

      await UnilevelPlusDistribution.updateOne(
        { _id: dist._id },
        {
          $set: {
            status: "reversed",
            "metadata.reversedAt": new Date(),
            "metadata.reversedBy": "move-unilevel-commission script",
            "metadata.reversalReason": "upline_move",
            "metadata.movedFrom": oldUpline?._id,
            "metadata.movedTo": newUpline._id,
          },
        },
        { session },
      );

      await session.commitTransaction();
      console.log(`\n✅ Phase 1: reversed ${plan.length} transaction(s), ${money(reverseTotal)} clawed back`);
    } catch (err) {
      await session.abortTransaction();
      console.error(`❌ Phase 1 failed — nothing written:`, err);
      await mongoose.disconnect();
      process.exit(1);
    } finally {
      session.endSession();
    }
  } else {
    console.log(`\n↩️  Phase 1 already done by an earlier run — resuming at Phase 2.`);
  }

  // ── PHASE 2: re-run against the new tree ────────────────────────────────
  // distributeUnilevelPlusCommission is idempotent on paymentId
  // (unilevelPlusCommission.ts:443), so reusing the original would silently
  // no-op. A distinct id is what makes the re-run actually execute.
  const newPaymentId = `${dist.paymentId}:upline-move:${Date.now()}`;
  try {
    const result = await distributeUnilevelPlusCommission({
      buyerId: String(buyer._id),
      planId: String(dist.planId),
      saleAmount: dist.saleAmount,
      currency: dist.currency,
      paymentId: newPaymentId,
      metadata: {
        supersedes: dist._id,
        reason: "upline_move",
        movedFrom: oldUpline?._id,
        movedTo: newUpline._id,
        originalPaymentId: dist.paymentId,
      },
    });

    console.log(`✅ Phase 2: new distribution ${result.distribution._id}`);
    console.log(`\n── NEW PAYOUTS ──`);
    if (result.directBonusPaid) {
      const u = await User.findById(result.directBonusPaid.userId).select("name email").lean<any>();
      console.log(`   +${money(result.directBonusPaid.amount).padStart(9)}  direct   ${label(u)}`);
    }
    let paidOut = result.directBonusPaid?.amount || 0;
    for (const l of result.levelBonusesPaid) {
      const u = await User.findById(l.userId).select("name email").lean<any>();
      console.log(`   +${money(l.amount).padStart(9)}  L${String(l.level).padEnd(2)}     ${label(u)}`);
      paidOut = round2(paidOut + l.amount);
    }
    console.log(`   company share: ${money(result.companyAmount)}`);

    // ── Balance assertion ────────────────────────────────────────────────
    const after = await UnilevelPlusDistribution.findById(result.distribution._id).lean<any>();
    const newTotal = round2(
      (after.companyAmount || 0) +
        (after.directBonusAmount || 0) +
        (after.levelBonusDistributed || 0) +
        (after.infinityTier1Distributed || 0) +
        (after.infinityTier2Distributed || 0) +
        (after.managerBonusAmount || 0) +
        (after.unallocatedAmount || 0) +
        round2((after.infinityTier1Amount || 0) - (after.infinityTier1Distributed || 0)) +
        round2((after.infinityTier2Amount || 0) - (after.infinityTier2Distributed || 0)),
    );
    const balanced = Math.abs(newTotal - dist.saleAmount) < 0.02;
    console.log(
      `\n   redistributed total ${money(newTotal)} vs sale ${money(dist.saleAmount)} — ${balanced ? "BALANCED ✅" : "MISMATCH ⚠️"}`,
    );
    if (!balanced) {
      console.error(
        `⚠️  Totals do not reconcile. Both phases are committed; review distribution ${result.distribution._id} manually.`,
      );
    }
  } catch (err) {
    // Compensate: put back exactly what Phase 1 removed, so a failed re-run
    // never leaves the old upline out of pocket with nobody paid.
    console.error(`❌ Phase 2 failed:`, err);
    if (reversalTxnIds.length > 0) {
      console.error(`↩️  Compensating — restoring the reversed amounts…`);
      const s2 = await mongoose.startSession();
      s2.startTransaction();
      try {
        for (const p of plan) {
          const Model: any = p.kind === "affiliate" ? AffiliateWallet : StoreWallet;
          const w = await Model.findById(p.wallet._id).session(s2);
          w.balance = round2(w.balance + p.txn.amount);
          if (p.kind === "affiliate") {
            w.totalEarnings = round2((w.totalEarnings || 0) + p.txn.amount);
          }
          await w.save({ session: s2 });
        }
        await WalletTransaction.deleteMany({ _id: { $in: reversalTxnIds } }, { session: s2 });
        await UnilevelPlusDistribution.updateOne(
          { _id: dist._id },
          { $set: { status: "completed" }, $unset: { "metadata.reversedAt": 1 } },
          { session: s2 },
        );
        await s2.commitTransaction();
        console.error(`✅ Compensated — state restored to before this run.`);
      } catch (e2) {
        await s2.abortTransaction();
        console.error(`🔥 COMPENSATION FAILED. Distribution ${dist._id} is reversed but NOT re-run.`);
        console.error(`   Re-run this script to complete Phase 2. Do not run anything else.`);
        console.error(e2);
      } finally {
        s2.endSession();
      }
    }
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\n✅ Done. Original distribution ${dist._id} is "reversed" and superseded.`);
  console.log(`   Original transactions were NOT modified — the audit trail is intact.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
