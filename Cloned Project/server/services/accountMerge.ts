import mongoose, { Types } from "mongoose";
import { User } from "../models/user.model";
import { storablePhone } from "./twoFactorSms";

/**
 * Merging a throwaway phone-signup account into the caller's real account.
 *
 * ── The situation ────────────────────────────────────────────────────────
 * Logging in by phone creates an account when the number matches none. Someone
 * whose number was never on file therefore lands in an empty account that
 * looks like their history vanished. Complete Profile offers them a way out:
 * type the email of their real account, prove they own it with an OTP, and
 * this moves the verified number across and disposes of the throwaway.
 *
 * Two proofs are required and both are already held by the time this runs:
 * the OTP on the phone (which created the throwaway and set phoneVerified),
 * and the OTP on the email (checked by the caller). Neither alone is enough —
 * that is what stops this being an account-takeover route.
 *
 * ── Direction is fixed ───────────────────────────────────────────────────
 * The OLD account always survives. It holds the purchases, wallet, downline
 * position and org history; the throwaway is minutes old. Merging the other
 * way would destroy the thing the user is trying to get back to.
 *
 * ── Why the unwind exists ────────────────────────────────────────────────
 * `syncNewEnrollee` increments `directsCount` on the referrer and
 * `downlineCount` on every ancestor when an account is created, and nothing
 * decrements them on delete. Those counters gate compensation qualification
 * (the Unilevel Plus infinity tiers require >=4 and >=10 active directs), so
 * deleting the row without unwinding silently inflates someone's rank forever.
 * The row is still hard-deleted — the unwind just stops the delete corrupting
 * data that outlives it.
 */

export type MergeOutcome =
  | { ok: true; targetUserId: string; movedPhone: string | null; bonusReversed: boolean }
  | { ok: false; error: string; code: "same_account" | "no_target" | "no_phone" | "failed" };

/**
 * Undoes the tree counters the throwaway's creation bumped.
 *
 * Mirrors `syncNewEnrollee` exactly: parent gets -1 direct, every ancestor
 * gets -1 downline. `$max: 0` guards against a double-run driving a counter
 * negative, which would be worse than leaving it high.
 */
async function unwindDownlineCounters(
  throwaway: any,
  session: mongoose.ClientSession
): Promise<void> {
  const parentId = throwaway.referredBy;
  const ancestors: any[] = throwaway.ancestors || [];

  if (parentId) {
    await User.updateOne(
      { _id: parentId, directsCount: { $gt: 0 } },
      { $inc: { directsCount: -1 } },
      { session }
    );
  }
  if (ancestors.length) {
    await User.updateMany(
      { _id: { $in: ancestors }, downlineCount: { $gt: 0 } },
      { $inc: { downlineCount: -1 } },
      { session }
    );
  }
}

/**
 * Reverses a signup referral bonus paid to the throwaway, if there was one.
 *
 * The bonus fires on profile completion — the very screen the merge button
 * lives on — so it may well already be paid by the time someone merges.
 * Without this, the cycle "sign up by phone, complete profile, merge away,
 * repeat with a new number" pays a referrer $0.10 out of platform funds every
 * time, unbounded.
 *
 * Append-only: the original credits stand and compensating entries are
 * written, matching how the FOUNDERSOFFICE cascade was reversed.
 */
async function reverseSignupBonus(
  throwawayId: Types.ObjectId,
  session: mongoose.ClientSession
): Promise<boolean> {
  const { ReferralBonusPayout } = await import("../models/referralBonusPayout.model");
  const { StoreWallet } = await import("../models/storeWallet.model");
  const { WalletTransaction } = await import("../models/walletTransaction.model");
  const { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } = await import("./commission");

  const payout: any = await ReferralBonusPayout.findOne({
    refereeUserId: throwawayId,
    reversedAt: { $exists: false },
  }).session(session);
  if (!payout) return false;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const amount = payout.amountUsd;

  const platformUser: any = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id")
    .session(session);
  if (!platformUser) return false;

  /** Debit a store wallet, never below zero, and record why. */
  const debit = async (userId: any, orgId: any, note: string) => {
    const w: any = await StoreWallet.findOne({
      userId,
      orgId: new Types.ObjectId(String(orgId)),
      currency: "USD",
    }).session(session);
    if (!w) return 0;
    const before = w.balance || 0;
    const take = Math.min(before, amount);
    if (take <= 0) return 0;
    const after = round2(before - take);
    w.balance = after;
    await w.save({ session });
    await WalletTransaction.create(
      [
        {
          storeWalletId: w._id,
          walletType: "store",
          userId,
          orgId: new Types.ObjectId(String(orgId)),
          type: "debit",
          amount: take,
          currency: "USD",
          balanceBefore: before,
          balanceAfter: after,
          description: "Signup referral bonus reversed",
          note,
          metadata: { kind: "referral_signup_bonus_reversal", payoutId: String(payout._id) },
          status: "completed",
        },
      ],
      { session }
    );
    return take;
  };

  const back =
    (await debit(payout.referrerUserId, payout.referrerOrgId, "Referred account was merged away")) +
    (await debit(payout.refereeUserId, payout.refereeOrgId, "Account merged into an existing one"));

  // Return whatever was actually recovered to the platform.
  if (back > 0) {
    const pw: any = await StoreWallet.findOne({
      userId: platformUser._id,
      orgId: new Types.ObjectId(PLATFORM_ORG_ID),
      currency: "USD",
    }).session(session);
    if (pw) {
      const before = pw.balance || 0;
      const after = round2(before + back);
      pw.balance = after;
      await pw.save({ session });
      await WalletTransaction.create(
        [
          {
            storeWalletId: pw._id,
            walletType: "store",
            userId: platformUser._id,
            orgId: new Types.ObjectId(PLATFORM_ORG_ID),
            type: "credit",
            amount: back,
            currency: "USD",
            balanceBefore: before,
            balanceAfter: after,
            description: "Signup referral bonus recovered",
            note: "Referred account merged into an existing account",
            metadata: { kind: "referral_signup_bonus_reversal", payoutId: String(payout._id) },
            status: "completed",
          },
        ],
        { session }
      );
    }
  }

  payout.reversedAt = new Date();
  payout.reversedReason = "account_merged";
  await payout.save({ session });
  return true;
}

/**
 * Moves the verified phone from `throwawayId` onto `targetId` and deletes the
 * throwaway. Both OTPs must already have been checked by the caller.
 */
export async function mergePhoneAccountInto(
  throwawayId: string,
  targetId: string
): Promise<MergeOutcome> {
  if (String(throwawayId) === String(targetId)) {
    return { ok: false, error: "Already signed in to that account", code: "same_account" };
  }

  const session = await mongoose.startSession();
  let movedPhone: string | null = null;
  let bonusReversed = false;

  try {
    let outcome: MergeOutcome | null = null;

    await session.withTransaction(async () => {
      const throwaway: any = await User.findById(throwawayId).session(session);
      const target: any = await User.findById(targetId).session(session);
      if (!throwaway || !target) {
        outcome = { ok: false, error: "Account not found", code: "no_target" };
        return;
      }

      const phone = throwaway.phone || null;
      const phoneVerified = !!throwaway.phoneVerified;

      // Counters first: once the row is gone, `referredBy` and `ancestors`
      // are unreadable and the unwind is impossible.
      await unwindDownlineCounters(throwaway, session);
      bonusReversed = await reverseSignupBonus(throwaway._id, session);

      // Free the number BEFORE writing it to the target, or the two rows
      // collide the instant a unique index on `phone` is in place.
      throwaway.phone = undefined;
      throwaway.phoneVerified = false;
      await throwaway.save({ session });

      if (phone && phoneVerified) {
        target.phone = storablePhone(phone) ?? phone;
        target.phoneVerified = true;
        await target.save({ session });
        movedPhone = phone;
      }

      await User.deleteOne({ _id: throwaway._id }, { session });
      outcome = { ok: true, targetUserId: String(target._id), movedPhone, bonusReversed };
    });

    return (
      outcome || { ok: false, error: "Merge did not complete", code: "failed" }
    );
  } catch (err: any) {
    console.error("[account-merge] failed:", err?.message);
    return { ok: false, error: "Could not merge the accounts", code: "failed" };
  } finally {
    await session.endSession();
  }
}
