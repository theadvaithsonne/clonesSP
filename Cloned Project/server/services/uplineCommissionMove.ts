/**
 * Re-point a member's ALREADY-PAID Unilevel Plus commission at their current
 * upline.
 *
 * Moving someone in the referral tree only changes who earns on their FUTURE
 * sales — the historical ledger is immutable by design. When an admin moves a
 * member whose $25 purchase has already distributed, the payout keeps following
 * the old chain. This service performs that correction, and is shared by:
 *
 *   - POST /garage-admin/users/:id/move-upline   (opt-in `moveCommissions` flag)
 *   - scripts/move-unilevel-commission.ts        (CLI, dry-run by default)
 *
 * WHAT IT DOES
 *   Phase 1 — reverse every wallet transaction the original distribution wrote,
 *             by posting opposite entries. Originals are never mutated; the
 *             distribution is marked status "reversed". Atomic.
 *   Phase 2 — re-run distributeUnilevelPlusCommission against the CURRENT tree
 *             under a fresh paymentId carrying `metadata.supersedes`.
 *
 * NOT ZERO-SUM. A buyer who sat near the tree root had most of the level-bonus
 * budget fall through to the platform as `unallocatedAmount`. Re-running under
 * a deep upline pays that out to real people, so platform revenue drops. Callers
 * must surface `platformDelta` before anyone confirms.
 *
 * TRANSACTIONALITY
 *   distributeUnilevelPlusCommission opens and owns its own Mongo session
 *   (services/unilevelPlusCommission.ts), so the two phases cannot share one
 *   transaction without refactoring a live money path. Each phase is
 *   individually atomic, and a failed Phase 2 automatically compensates Phase 1.
 *   Re-entrant: calling again completes whichever half is outstanding.
 *
 * SAFE TO CALL SPECULATIVELY. `preview()` is read-only, and `apply()` returns a
 * `skipped` outcome (never throws) when there is nothing to correct — no
 * distribution, upline unchanged, or already superseded.
 */
import mongoose, { Types } from "mongoose";
import { User } from "../models/user.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { UnilevelPlusDistribution } from "../models/unilevelPlusDistribution.model";
import { distributeUnilevelPlusCommission } from "./unilevelPlusCommission";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CommissionMoveParty {
  userId: string;
  name?: string;
  email?: string;
}

export interface CommissionMoveReversalLine {
  amount: number;
  walletType: "affiliate" | "store";
  description: string;
  recipient: CommissionMoveParty;
}

export interface CommissionMovePayoutLine {
  amount: number;
  level: number | null;
  kind: "direct" | "level";
  recipient: CommissionMoveParty;
}

export type CommissionMoveStatus =
  /** Corrected: reversed and re-distributed. */
  | "applied"
  /** Preview only — nothing written. */
  | "preview"
  /** Nothing to do (no distribution / upline already correct / already done). */
  | "skipped"
  /** Refused before writing anything (e.g. a wallet would go negative). */
  | "blocked"
  /** Phase 2 failed; Phase 1 was rolled back. */
  | "failed";

export interface CommissionMoveResult {
  status: CommissionMoveStatus;
  reason?: string;
  distributionId?: string;
  newDistributionId?: string;
  saleAmount?: number;
  currency?: string;
  previousUpline?: CommissionMoveParty | null;
  newUpline?: CommissionMoveParty | null;
  /** What is (or would be) clawed back. */
  reversals: CommissionMoveReversalLine[];
  reversalTotal: number;
  /** What the re-run paid out. Empty on preview. */
  payouts: CommissionMovePayoutLine[];
  /** Chain that will receive, for previews. */
  projectedChain: CommissionMoveParty[];
  /** Negative = platform gives money back to the network. */
  platformDelta?: number;
  balanced?: boolean;
}

const party = (u: any): CommissionMoveParty | null =>
  u ? { userId: String(u._id), name: u.name, email: u.email } : null;

const EMPTY = (status: CommissionMoveStatus, reason: string): CommissionMoveResult => ({
  status,
  reason,
  reversals: [],
  reversalTotal: 0,
  payouts: [],
  projectedChain: [],
});

/** Resolve the single completed distribution to correct, if there is one. */
async function resolveTarget(buyerId: string) {
  const all = await UnilevelPlusDistribution.find({
    buyerId: new Types.ObjectId(buyerId),
  })
    .sort({ createdAt: 1 })
    .lean<any[]>();

  const superseding = all.find((d) => d.metadata?.supersedes);
  const live = all.filter(
    (d) => d.status === "completed" && !d.metadata?.supersedes,
  );
  const reversed = all.filter((d) => d.status === "reversed");

  // A previous run already corrected this buyer.
  if (superseding && live.length === 0) {
    return { done: true as const, superseding };
  }
  // A previous run reversed but died before re-running — resume Phase 2.
  const orphanReversed =
    !superseding && reversed.length > 0 && live.length === 0
      ? reversed[reversed.length - 1]
      : null;

  if (!orphanReversed && live.length === 0) return { none: true as const, all };
  if (live.length > 1) return { ambiguous: true as const, live };

  return { dist: (orphanReversed || live[0]) as any, orphanReversed: !!orphanReversed };
}

/**
 * Read-only. What WOULD change if the commission were moved now.
 * Never writes. Use to render a confirmation before applying.
 */
export async function previewUnilevelCommissionMove(
  buyerId: string,
): Promise<CommissionMoveResult> {
  const buyer = await User.findById(buyerId).select("name email referredBy").lean<any>();
  if (!buyer) return EMPTY("skipped", "Buyer not found");

  const t = await resolveTarget(buyerId);
  if ("done" in t) return EMPTY("skipped", "Commission already moved for this buyer");
  if ("none" in t) return EMPTY("skipped", "No completed Unilevel Plus distribution to move");
  if ("ambiguous" in t)
    return EMPTY(
      "skipped",
      `${t.live?.length ?? "Multiple"} completed distributions — refusing to guess`,
    );

  const { dist } = t;
  const oldUpline = dist.directBonusRecipientId
    ? await User.findById(dist.directBonusRecipientId).select("name email").lean<any>()
    : null;
  const newUpline = buyer.referredBy
    ? await User.findById(buyer.referredBy).select("name email").lean<any>()
    : null;

  if (!newUpline) return EMPTY("skipped", "Buyer has no upline to move the commission to");
  if (oldUpline && String(oldUpline._id) === String(newUpline._id) && !t.orphanReversed) {
    return EMPTY("skipped", "The distribution already pays the current upline");
  }

  const txns = await WalletTransaction.find({
    "metadata.distributionId": dist._id,
    status: "completed",
  }).lean<any[]>();

  const reversals: CommissionMoveReversalLine[] = [];
  let reversalTotal = 0;
  for (const t2 of txns) {
    const wallet = t2.affiliateWalletId
      ? await AffiliateWallet.findById(t2.affiliateWalletId).lean<any>()
      : await StoreWallet.findById(t2.storeWalletId).lean<any>();
    const owner = wallet ? await User.findById(wallet.userId).select("name email").lean<any>() : null;
    reversals.push({
      amount: t2.amount,
      walletType: t2.affiliateWalletId ? "affiliate" : "store",
      description: t2.description,
      recipient: party(owner) ?? { userId: "" },
    });
    reversalTotal = round2(reversalTotal + t2.amount);
  }

  // Chain that will receive after the move.
  const projectedChain: CommissionMoveParty[] = [];
  let cur: any = newUpline;
  for (let i = 0; cur && i < 15; i++) {
    const p = party(cur);
    if (p) projectedChain.push(p);
    const nxt: any = await User.findById(cur._id).select("referredBy").lean<any>();
    cur = nxt?.referredBy
      ? await User.findById(nxt.referredBy).select("name email").lean<any>()
      : null;
  }

  return {
    status: "preview",
    distributionId: String(dist._id),
    saleAmount: dist.saleAmount,
    currency: dist.currency,
    previousUpline: party(oldUpline),
    newUpline: party(newUpline),
    reversals,
    reversalTotal,
    payouts: [],
    projectedChain,
  };
}

/**
 * Apply the correction. Idempotent and re-entrant.
 *
 * Never throws for expected conditions — inspect `status`. Only a genuinely
 * unexpected fault propagates, and Phase 1 is compensated before it does.
 */
export async function applyUnilevelCommissionMove(
  buyerId: string,
  opts: { actor?: string } = {},
): Promise<CommissionMoveResult> {
  const buyer = await User.findById(buyerId).select("name email referredBy").lean<any>();
  if (!buyer) return EMPTY("skipped", "Buyer not found");

  const t = await resolveTarget(buyerId);
  if ("done" in t) return EMPTY("skipped", "Commission already moved for this buyer");
  if ("none" in t) return EMPTY("skipped", "No completed Unilevel Plus distribution to move");
  if ("ambiguous" in t)
    return EMPTY(
      "skipped",
      `${t.live?.length ?? "Multiple"} completed distributions — refusing to guess`,
    );

  const { dist, orphanReversed } = t;
  const oldUpline = dist.directBonusRecipientId
    ? await User.findById(dist.directBonusRecipientId).select("name email").lean<any>()
    : null;
  const newUpline = buyer.referredBy
    ? await User.findById(buyer.referredBy).select("name email").lean<any>()
    : null;

  if (!newUpline) return EMPTY("skipped", "Buyer has no upline to move the commission to");
  if (oldUpline && String(oldUpline._id) === String(newUpline._id) && !orphanReversed) {
    return EMPTY("skipped", "The distribution already pays the current upline");
  }

  // ── Gather every write the original distribution made ────────────────────
  // All of them carry metadata.distributionId — including the platform-lock
  // rows creditAffiliateOrPlatform adds for recipients who never activated —
  // so iterating transactions covers both halves of that dual write.
  const txns = await WalletTransaction.find({
    "metadata.distributionId": dist._id,
    status: "completed",
  }).lean<any[]>();

  const plan: Array<{ txn: any; kind: "affiliate" | "store"; wallet: any; owner: any }> = [];
  const reversals: CommissionMoveReversalLine[] = [];
  let reversalTotal = 0;
  for (const txn of txns) {
    const kind: "affiliate" | "store" = txn.affiliateWalletId ? "affiliate" : "store";
    const wallet =
      kind === "affiliate"
        ? await AffiliateWallet.findById(txn.affiliateWalletId).lean<any>()
        : await StoreWallet.findById(txn.storeWalletId).lean<any>();
    if (!wallet) {
      return EMPTY("blocked", `Transaction ${txn._id} has no resolvable wallet`);
    }
    const owner = await User.findById(wallet.userId).select("name email").lean<any>();
    plan.push({ txn, kind, wallet, owner });
    reversals.push({
      amount: txn.amount,
      walletType: kind,
      description: txn.description,
      recipient: party(owner) ?? { userId: "" },
    });
    reversalTotal = round2(reversalTotal + txn.amount);
  }

  // ── Balance safety: never drive a wallet negative ────────────────────────
  const needed = new Map<string, number>();
  for (const p of plan) {
    const k = `${p.kind}:${p.wallet._id}`;
    needed.set(k, round2((needed.get(k) || 0) + p.txn.amount));
  }
  for (const p of plan) {
    const need = needed.get(`${p.kind}:${p.wallet._id}`);
    if (need !== undefined && p.wallet.balance < need) {
      return {
        ...EMPTY(
          "blocked",
          `${p.owner?.email ?? "A recipient"} has ${p.wallet.balance.toFixed(2)} in their ${p.kind} wallet but ${need.toFixed(2)} must be reversed`,
        ),
        reversals,
        reversalTotal,
        previousUpline: party(oldUpline),
        newUpline: party(newUpline),
      };
    }
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
        // The original credit inflated lifetime earnings; the reversal must
        // deflate it or the recipient permanently overstates what they kept.
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
              note: `Upline moved — commission re-pointed to ${newUpline.name || newUpline.email}`,
              relatedUserId: buyer._id,
              metadata: {
                reversalOf: p.txn._id,
                distributionId: dist._id,
                distributionType: "unilevel_plus",
                reason: "upline_move",
                movedFrom: oldUpline?._id,
                movedTo: newUpline._id,
                actor: opts.actor,
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
            "metadata.reversedBy": opts.actor || "upline-move",
            "metadata.reversalReason": "upline_move",
            "metadata.movedFrom": oldUpline?._id,
            "metadata.movedTo": newUpline._id,
          },
        },
        { session },
      );

      await session.commitTransaction();
    } catch (err: any) {
      await session.abortTransaction();
      return {
        ...EMPTY("failed", `Reversal failed, nothing written: ${err?.message ?? err}`),
        reversals,
        reversalTotal,
      };
    } finally {
      session.endSession();
    }
  }

  // ── PHASE 2: re-run against the current tree ────────────────────────────
  // distributeUnilevelPlusCommission is idempotent on paymentId, so reusing
  // the original would silently no-op. A distinct id makes it actually run.
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
        actor: opts.actor,
      },
    });

    const payouts: CommissionMovePayoutLine[] = [];
    if (result.directBonusPaid) {
      const u = await User.findById(result.directBonusPaid.userId).select("name email").lean<any>();
      payouts.push({
        amount: result.directBonusPaid.amount,
        level: null,
        kind: "direct",
        recipient: party(u) ?? { userId: result.directBonusPaid.userId },
      });
    }
    for (const l of result.levelBonusesPaid) {
      const u = await User.findById(l.userId).select("name email").lean<any>();
      payouts.push({
        amount: l.amount,
        level: l.level,
        kind: "level",
        recipient: party(u) ?? { userId: l.userId },
      });
    }

    const after = await UnilevelPlusDistribution.findById(result.distribution._id).lean<any>();
    const platformBefore = round2(
      (dist.companyAmount || 0) +
        (dist.managerBonusAmount || 0) +
        (dist.unallocatedAmount || 0) +
        round2((dist.infinityTier1Amount || 0) - (dist.infinityTier1Distributed || 0)) +
        round2((dist.infinityTier2Amount || 0) - (dist.infinityTier2Distributed || 0)),
    );
    const platformAfter = round2(
      (after.companyAmount || 0) +
        (after.managerBonusAmount || 0) +
        (after.unallocatedAmount || 0) +
        round2((after.infinityTier1Amount || 0) - (after.infinityTier1Distributed || 0)) +
        round2((after.infinityTier2Amount || 0) - (after.infinityTier2Distributed || 0)),
    );
    const redistributed = round2(
      platformAfter +
        (after.directBonusAmount || 0) +
        (after.levelBonusDistributed || 0) +
        (after.infinityTier1Distributed || 0) +
        (after.infinityTier2Distributed || 0),
    );

    return {
      status: "applied",
      distributionId: String(dist._id),
      newDistributionId: String(result.distribution._id),
      saleAmount: dist.saleAmount,
      currency: dist.currency,
      previousUpline: party(oldUpline),
      newUpline: party(newUpline),
      reversals,
      reversalTotal,
      payouts,
      projectedChain: [],
      platformDelta: round2(platformAfter - platformBefore),
      balanced: Math.abs(redistributed - dist.saleAmount) < 0.02,
    };
  } catch (err: any) {
    // Compensate: restore exactly what Phase 1 removed, so a failed re-run
    // never leaves the old upline out of pocket with nobody paid.
    if (reversalTxnIds.length > 0) {
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
          { $set: { status: "completed" }, $unset: { "metadata.reversedAt": "" } },
          { session: s2 },
        );
        await s2.commitTransaction();
      } catch (e2: any) {
        await s2.abortTransaction();
        console.error(
          `[uplineCommissionMove] COMPENSATION FAILED for distribution ${dist._id} — reversed but NOT re-run. Re-run to finish Phase 2.`,
          e2,
        );
        return {
          ...EMPTY(
            "failed",
            `Re-distribution failed AND rollback failed — distribution ${dist._id} is reversed but not re-run. Re-run the move to finish it.`,
          ),
          reversals,
          reversalTotal,
        };
      } finally {
        s2.endSession();
      }
    }
    return {
      ...EMPTY("failed", `Re-distribution failed and was rolled back: ${err?.message ?? err}`),
      reversals,
      reversalTotal,
    };
  }
}
