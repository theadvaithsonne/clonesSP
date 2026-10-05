// src/services/commissionForfeiture.ts
//
// The ledger primitive behind every commission a member does not get to keep.
//
// Historically a forfeiture was invisible: the earner was simply credited a
// smaller number, and the part they lost existed only as an English `note`
// string and a `metadata` blob. You cannot label, total, or explain a loss the
// system never recorded — so the shape is now always the same three rows:
//
//   1. commission  + gross   to the earner      (what they actually earned)
//   2. debit       − lost    to the earner      (this module)
//   3. credit      + lost    to whoever gets it (the caller)
//
// Net balance is identical to crediting the smaller number directly. What
// changes is that the member can see the deduction, and we can total it.
//
// `AffiliateWallet.totalEarnings` therefore keeps counting GROSS, and
// `totalForfeited` counts what was taken back out, so "you earned $X, lost $Y"
// is a field read rather than an aggregation over metadata.
//
// Nothing calls this yet — it ships ahead of the callers on purpose, so the
// withdrawal-maturity fix it depends on (services/withdrawal.ts
// ::creditsAfterCutoffCents) is already live before any forfeiture row exists.

import mongoose, { Types, ClientSession } from "mongoose";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";

/**
 * Why the money left.
 *
 * - `no_licence`       — no active $25 Unilevel Plus licence.
 * - `no_networkchain`  — holds the licence but not the $36 subscription, so
 *                        half travels to the nearest covered upline.
 * - `cascade_to_upline`— a founder comb-plan position an unlicensed member
 *                        cannot hold, passed to the first licensed upline.
 */
export type ForfeitureReason =
  | "no_licence"
  | "no_networkchain"
  | "cascade_to_upline";

/**
 * Shown to the member on the deduction row. Deliberately plain: it names what
 * was lost and why, with no apology and no upsell — the wallet page already
 * carries the "activate to unlock" call to action, and repeating it on every
 * row would read as nagging.
 */
export const FORFEITURE_LABELS: Record<ForfeitureReason, string> = {
  no_licence: "Lost commission — no Unilevel Plus licence",
  no_networkchain: "Lost commission — no NetworkChain subscription",
  cascade_to_upline: "Lost commission — passed up to a licensed upline",
};

export function describeForfeiture(reason: ForfeitureReason): string {
  return FORFEITURE_LABELS[reason] ?? "Lost commission";
}

/**
 * Stamped onto the debit row's `metadata.forfeiture`.
 *
 * `creditsAfterCutoffCents` keys the withdrawal-maturity calculation off the
 * mere PRESENCE of this object, so every deduction that offsets a same-week
 * credit must carry it — see the note in services/withdrawal.ts.
 */
export interface ForfeitureMetadata {
  reason: ForfeitureReason;
  /** The commission row this was taken out of. */
  ofTransactionId?: string;
  /** What the member earned before the deduction. */
  grossAmount: number;
  /** What was taken. */
  forfeitedAmount: number;
  /** Who received it. Null means the platform. */
  toUserId: string | null;
}

export interface RecordForfeitureResult {
  transaction: any;
  balanceAfter: number;
}

/**
 * Write the deduction leg against an earner's affiliate wallet.
 *
 * MUST run inside the same session as the gross credit that precedes it —
 * a credit that lands without its deduction would hand the member money that
 * was never theirs, which is worse than the invisible-loss problem this
 * replaces.
 *
 * The caller is responsible for the third row (paying whoever receives the
 * money). This function only takes it off the earner.
 */
export async function recordForfeiture(params: {
  /** The earner's wallet, already loaded in `session` and already credited gross. */
  affiliateWallet: any;
  userId: string;
  /** Positive USD amount to remove. Values <= 0 are a no-op. */
  amount: number;
  reason: ForfeitureReason;
  /** What the member earned before this deduction. */
  grossAmount: number;
  currency?: string;
  ofTransactionId?: Types.ObjectId | string | null;
  /** Who receives it; null/undefined means the platform. */
  toUserId?: string | null;
  relatedUserId?: string | null;
  /** The parent credit's dedupe key; suffixed here so the two never collide. */
  dedupeKey?: string;
  /** Extra context merged into the row's metadata. */
  metadata?: Record<string, any>;
  /** Overrides the default label when a caller needs sale-specific wording. */
  description?: string;
  note?: string;
  session: ClientSession;
}): Promise<RecordForfeitureResult | null> {
  const {
    affiliateWallet,
    userId,
    reason,
    grossAmount,
    currency = "USD",
    ofTransactionId,
    toUserId = null,
    relatedUserId,
    dedupeKey,
    metadata,
    description,
    note,
    session,
  } = params;

  // Round to cents up front: the caller's arithmetic (half of an odd cent,
  // a percentage of a pool) routinely produces more precision than money has.
  const amount = Math.round((params.amount || 0) * 100) / 100;
  if (amount <= 0) return null;

  const balanceBefore = affiliateWallet.balance;
  // The gross credit always lands first, so the balance covers this. Clamping
  // rather than throwing keeps a rounding cent from rolling back a whole
  // distribution — and `AffiliateWallet.balance` has `min: 0`, which would
  // otherwise reject the save outright.
  const take = Math.min(amount, balanceBefore);
  const balanceAfter = Math.round((balanceBefore - take) * 100) / 100;

  affiliateWallet.balance = balanceAfter;
  affiliateWallet.totalForfeited =
    Math.round(((affiliateWallet.totalForfeited || 0) + take) * 100) / 100;
  affiliateWallet.lastTransactionAt = new Date();
  await affiliateWallet.save({ session });

  const forfeiture: ForfeitureMetadata = {
    reason,
    ofTransactionId: ofTransactionId ? String(ofTransactionId) : undefined,
    grossAmount: Math.round((grossAmount || 0) * 100) / 100,
    forfeitedAmount: take,
    toUserId: toUserId ? String(toUserId) : null,
  };

  const transaction = (
    await WalletTransaction.create(
      [
        {
          affiliateWalletId: affiliateWallet._id,
          walletType: "affiliate",
          userId: new mongoose.Types.ObjectId(userId),
          type: "debit",
          amount: take,
          currency,
          balanceBefore,
          balanceAfter,
          description: description || describeForfeiture(reason),
          note,
          relatedUserId: relatedUserId
            ? new mongoose.Types.ObjectId(relatedUserId)
            : undefined,
          metadata: {
            ...(metadata || {}),
            // Distinct from the parent credit's key or the partial unique
            // index on metadata.dedupeKey rejects the second write and
            // aborts the whole distribution — the same failure that forced
            // the `_platform_lock` and `_ncsplit_upline` suffixes.
            ...(dedupeKey ? { dedupeKey: `${dedupeKey}_forfeit` } : {}),
            forfeiture,
          },
          status: "completed",
        },
      ],
      { session }
    )
  )[0];

  return { transaction, balanceAfter };
}

/**
 * Split a gross commission into the part the member keeps and the part they
 * lose, at the engine's four-decimal precision.
 *
 * Rounding favours the MEMBER, matching the rule the NetworkChain split has
 * always used: on an indivisible remainder the earner should not be the one
 * who loses it. `forfeited` floors, so the leftover lands in `keep`.
 *
 * Four places, not two, because the amounts being split are now themselves
 * sub-cent on small sale bases — halving $0.0432 at cent precision would
 * report $0.02 + $0.02 and quietly destroy $0.0032.
 */
const FORFEIT_SCALE = 10000;

export function splitForfeiture(
  gross: number,
  forfeitFraction: number
): { keep: number; forfeited: number } {
  const g = Math.round((gross || 0) * FORFEIT_SCALE) / FORFEIT_SCALE;
  if (g <= 0) return { keep: 0, forfeited: 0 };
  const f = Math.min(Math.max(forfeitFraction, 0), 1);
  const forfeited = Math.floor(g * f * FORFEIT_SCALE) / FORFEIT_SCALE;
  const keep = Math.round((g - forfeited) * FORFEIT_SCALE) / FORFEIT_SCALE;
  return { keep, forfeited };
}
