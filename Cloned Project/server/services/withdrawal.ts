// src/services/withdrawal.ts
// Admin-initiated withdrawal lifecycle. The Withdrawal collection is the
// canonical record; the wallet BALANCE is debited on initiate, refunded on
// reject, kept on complete. The 5% fee is credited to the platform
// (Shorupan) StoreWallet on completion. Amounts are CENTS; store/affiliate
// balances are float USD, so we convert at the boundary. NcWallet is cents.

import mongoose, { ClientSession, Types } from "mongoose";
import { Withdrawal, WithdrawalWalletType } from "../models/withdrawal.model";
import { WalletAccount } from "../models/walletAccount.model";
import { StoreWallet } from "../models/storeWallet.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { NcWallet } from "../models/ncWallet.model";
import { OrgRewardsWallet } from "../models/orgRewardsWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { User } from "../models/user.model";
import { GarageAdminModel } from "../models/garageAdmin.model";
import {
  getAffiliateWalletBalanceWithGating,
  creditStoreWallet,
} from "./wallet";
import { sendMail, EMAIL_FROM_NOTIFICATION } from "./mailer";
import { WithdrawalPreference } from "../models/withdrawalPreference.model";
import {
  resolveAffiliateFeeTier,
  AFFILIATE_KEEP_THRESHOLD_CENTS,
  type PayoutMethod,
} from "../config/affiliateWithdrawalFees";
import { env } from "../config/env";

// Platform (Shorupan) destination for processing fees — mirrors the constants
// used by creditAffiliateOrPlatform in services/wallet.ts.
const PLATFORM_USER_EMAIL = "shorupan@gmail.com";
const PLATFORM_ORG_ID = "68f1fe05876fcc5fadb61951";
const FEE_PERCENT = 5;

/**
 * Resolve the Garage processing fee for one withdrawal.
 *
 * Store and content_rewards pass through free. The AFFILIATE wallet is priced
 * off the user's saved payout preference — daily/weekly × whether they keep
 * $50 in the wallet — see config/affiliateWithdrawalFees.ts. A user who never
 * configured anything keeps the historical flat 5%.
 *
 * The affiliate fee stays symmetrical with the 5% carved at outflow-transfer
 * time (services/wallet.ts::computeAffiliateOutflowFee): a dollar leaves the
 * affiliate wallet exactly once, and is charged once.
 */
async function resolveWithdrawalFee(params: {
  userId: string;
  walletType: WithdrawalWalletType;
  payoutMethod: PayoutMethod;
}): Promise<{ feePercent: number; feeTier: any }> {
  if (params.walletType !== "affiliate") {
    return { feePercent: 0, feeTier: undefined };
  }
  const pref = await WithdrawalPreference.findOne({
    userId: new Types.ObjectId(params.userId),
    walletType: "affiliate",
    orgId: null,
  })
    .select("frequency keepAmountCents")
    .lean();

  const tier = resolveAffiliateFeeTier(pref as any);
  return {
    feePercent: tier.feePercent,
    feeTier: {
      frequency: tier.frequency,
      keepAmountCents: tier.keepAmountCents,
      meetsKeepThreshold: tier.meetsKeepThreshold,
      configured: tier.configured,
      payoutMethod: params.payoutMethod,
    },
  };
}


/**
 * A super admin's per-withdrawal overrides.
 *
 * Both are deliberately scoped to ONE withdrawal. Nothing here is written
 * back to WithdrawalPreference, so the member's standing fee tier and the
 * withdrawable calculation are exactly what they were before.
 */
export interface WithdrawalOverrides {
  /** Charge this % instead of the member's resolved tier. 0-100. */
  feePercent?: number;
  /** Allow the gross to exceed the gated cap, up to the real balance. */
  releaseLockedFunds?: boolean;
  /** Why — stored on the Withdrawal row for the audit trail. */
  reason?: string;
}

function resolveFeeOverride(
  resolved: number,
  overrides?: WithdrawalOverrides
): { feePercent: number; overridden: boolean } {
  const raw = overrides?.feePercent;
  if (raw === undefined || raw === null) {
    return { feePercent: resolved, overridden: false };
  }
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
    throw new Error("Fee percentage must be between 0 and 100");
  }
  const feePercent = Math.round(raw * 100) / 100;
  return { feePercent, overridden: feePercent !== resolved };
}

/**
 * Dollars → whole cents, at the settlement boundary.
 *
 * Wallets accrue at FOUR decimal places (services/unilevelPlusCommission.ts),
 * but no payment rail — bank, PayPal, Stripe, UPI — moves less than a cent.
 * So a balance of $10.0075 is withdrawable as $10.00, and the $0.0075 stays
 * in the wallet and rolls into the next payout rather than being paid or lost.
 *
 * FLOOR, never round: `Math.round(10.0075 * 100)` is 1001 cents, which would
 * pay out a cent more than the member actually holds. Nothing may let someone
 * withdraw more than what is present.
 */
const usdToCentsFloor = (usd: number) => Math.floor((usd || 0) * 100);

/**
 * The same conversion for figures SUBTRACTED from what can be withdrawn.
 * Rounding these down would inflate the withdrawable total, so they round up:
 * the member's own money is never at risk, only the bank's patience.
 */
const usdToCentsCeil = (usd: number) => Math.ceil((usd || 0) * 100);

const centsToUsd = (cents: number) => Math.round(cents) / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────
// Maturity cutoff — funds are withdrawable only once they've passed the most
// recent **Sunday 11:59:59 PM IST** (i.e. Monday 00:00 IST). Anything credited
// during the current week stays locked until the next Sunday-night boundary,
// when the whole remaining balance matures.
// ─────────────────────────────────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function lastSundayCutoff(now: Date = new Date()): Date {
  // Shift into IST wall-clock so getUTC* reads IST values.
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const day = ist.getUTCDay(); // 0=Sun .. 6=Sat (in IST)
  const daysSinceMonday = (day + 6) % 7; // Mon=0, Tue=1, ... Sun=6
  // IST midnight at the start of "today" (as a UTC-encoded wall-clock instant).
  const istMidnightToday = Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate()
  );
  const mondayIstMidnight = istMidnightToday - daysSinceMonday * 86_400_000;
  // Convert that IST wall-clock instant back to a real UTC timestamp.
  return new Date(mondayIstMidnight - IST_OFFSET_MS);
}

// Sum of everything that INCREASED a wallet's balance after the cutoff (cents).
// These are the not-yet-matured credits/earnings for the current week.
async function creditsAfterCutoffCents(
  userId: string,
  walletType: WithdrawalWalletType,
  orgId: string | null | undefined,
  cutoff: Date
): Promise<number> {
  const uid = new Types.ObjectId(userId);

  if (walletType === "content_rewards") {
    // Per-org Content Rewards: read the embedded ledger on the per-org row.
    // If no orgId is provided, sum across all of the user's per-org wallets
    // (used by the legacy "all orgs" rollup that still appears in some
    // admin views).
    const txs: any[] = [];
    if (orgId) {
      const r = await OrgRewardsWallet.findOne({
        userId: uid,
        orgId: new Types.ObjectId(orgId),
      })
        .select("transactions")
        .lean();
      if (r?.transactions) txs.push(...(r.transactions as any[]));
    } else {
      const rows = await OrgRewardsWallet.find({ userId: uid })
        .select("transactions")
        .lean();
      for (const r of rows) {
        if (r.transactions) txs.push(...(r.transactions as any[]));
      }
    }
    return txs.reduce(
      (sum, t) =>
        t.type === "credit" && new Date(t.createdAt) >= cutoff
          ? sum + (t.amount || 0)
          : sum,
      0
    );
  }

  // store / affiliate → WalletTransaction. Sum per-row balance increases
  // (covers credit, commission, and incoming transfers; ignores debits/outgoing).
  //
  // FORFEITURES ARE THE ONE DEBIT THAT MUST BE SUBTRACTED.
  //
  // Ignoring debits is right for withdrawals and transfers: those spend money
  // that had already matured, so they say nothing about how much arrived this
  // week. A forfeiture is different — it cancels part of a credit written in
  // the SAME week (services/commissionForfeiture.ts credits gross, then debits
  // the lost part). Counting the gross credit while ignoring its deduction
  // would report more new money than the balance actually gained, and
  // `maturedCents = balance - locked` would then understate what the member
  // can withdraw. Credit $10, forfeit $5: the balance rose $5, so $5 is
  // immature — not $10, which would strand $5 of ALREADY-matured money for a
  // week. Keyed off the presence of `metadata.forfeiture`, which only that
  // module writes.
  const match: any = { userId: uid, walletType, createdAt: { $gte: cutoff } };
  const delta = { $subtract: ["$balanceAfter", "$balanceBefore"] };
  const [agg] = await WalletTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        credits: { $sum: { $max: [delta, 0] } },
        forfeited: {
          $sum: {
            $cond: [
              { $eq: [{ $type: "$metadata.forfeiture" }, "object"] },
              { $abs: { $min: [delta, 0] } },
              0,
            ],
          },
        },
      },
    },
  ]);
  const credits = (agg?.credits as number) || 0;
  const forfeited = (agg?.forfeited as number) || 0;
  // Floored at 0: a forfeiture whose parent credit fell on the other side of
  // the cutoff would otherwise push this negative and inflate `matured`.
  return usdToCentsCeil(Math.max(0, credits - forfeited));
}

// ─────────────────────────────────────────────────────────────────────────
// Withdrawable balance per wallet (in cents).
//
// Only the AFFILIATE wallet applies the Sunday-cutoff maturity gate (and
// additionally clamps to the Unilevel-Plus redeemable balance). For store
// and content_rewards, the full balance is always considered available —
// the platform owner can authorise an admin-initiated withdrawal up to that.
// ─────────────────────────────────────────────────────────────────────────
/**
 * The withdrawable cap, with the reasoning behind it.
 *
 * `getWithdrawableBalanceCents` answers "how much" in one number; the admin
 * dialog also has to answer "why is this less than the balance", because a
 * super admin is allowed to override the cap and must not do it blind.
 *
 * Two independent locks apply to the affiliate wallet and they mean very
 * different things:
 *
 *   maturity — credited since last Sunday 23:59:59 IST. The money is
 *              unambiguously the member's; it is simply early. Releasing it
 *              is a timing decision.
 *   licence  — commissions earned BEFORE the member bought Unilevel Plus.
 *              Those were never qualified earnings. Releasing them is a
 *              policy exception, not a timing one.
 *
 * Both are always <= balance, which is what makes an override safe to cap at
 * the real balance.
 */
export async function getWithdrawableBreakdown(
  userId: string,
  walletType: WithdrawalWalletType,
  orgId?: string | null
): Promise<{
  balanceCents: number;
  withdrawableCents: number;
  maturedCents: number;
  redeemableCents: number;
  lockedByMaturityCents: number;
  lockedByLicenceCents: number;
  maturityCutoff: Date | null;
  hasLicence: boolean;
}> {
  if (walletType !== "affiliate") {
    // Store and content_rewards have no gating — the whole balance is
    // withdrawable, so the breakdown collapses to a single number.
    const cents = await getWithdrawableBalanceCents(userId, walletType, orgId);
    return {
      balanceCents: cents,
      withdrawableCents: cents,
      maturedCents: cents,
      redeemableCents: cents,
      lockedByMaturityCents: 0,
      lockedByLicenceCents: 0,
      maturityCutoff: null,
      hasLicence: true,
    };
  }

  const g = await getAffiliateWalletBalanceWithGating(userId);
  const balanceCents = usdToCentsFloor(g?.balance || 0);
  const redeemableCents = usdToCentsFloor(g?.redeemableBalance || 0);
  const maturityCutoff = lastSundayCutoff();
  const immatureCents = await creditsAfterCutoffCents(
    userId,
    "affiliate",
    null,
    maturityCutoff
  );
  const maturedCents = Math.max(0, balanceCents - immatureCents);
  const withdrawableCents = Math.min(redeemableCents, maturedCents);

  return {
    balanceCents,
    withdrawableCents,
    maturedCents,
    redeemableCents,
    // What each rule is holding back ON ITS OWN. They overlap, so these do
    // NOT sum to (balance - withdrawable) — the dialog labels them
    // separately rather than adding them.
    lockedByMaturityCents: Math.max(0, balanceCents - maturedCents),
    lockedByLicenceCents: Math.max(0, balanceCents - redeemableCents),
    maturityCutoff,
    hasLicence: !!g?.hasPurchasedUnilevelPlus,
  };
}

export async function getWithdrawableBalanceCents(
  userId: string,
  walletType: WithdrawalWalletType,
  orgId?: string | null
): Promise<number> {
  if (walletType === "store") {
    if (!orgId) return 0;
    const w = await StoreWallet.findOne({ userId, orgId }).select("balance").lean();
    return usdToCentsFloor(w?.balance || 0);
  }

  if (walletType === "affiliate") {
    const b = await getWithdrawableBreakdown(userId, "affiliate", null);
    return b.withdrawableCents;
  }

  // content_rewards → per-org OrgRewardsWallet (cents).
  // With an orgId: return that org's balance.
  // Without an orgId: return the sum across all orgs (legacy "all orgs" rollup).
  const uid = new Types.ObjectId(userId);
  if (orgId) {
    const r = await OrgRewardsWallet.findOne({
      userId: uid,
      orgId: new Types.ObjectId(orgId),
    })
      .select("balance")
      .lean();
    return r?.balance || 0;
  }
  const agg = await OrgRewardsWallet.aggregate([
    { $match: { userId: uid } },
    { $group: { _id: null, total: { $sum: "$balance" } } },
  ]);
  return ((agg as any[])[0]?.total as number) || 0;
}

// Internal: apply a balance delta (cents) to the source wallet inside a session.
// `deltaCents` negative = debit, positive = refund/credit.
async function applyWalletDelta(
  userId: string,
  walletType: WithdrawalWalletType,
  orgId: string | null | undefined,
  deltaCents: number,
  session: ClientSession
): Promise<void> {
  const uid = new Types.ObjectId(userId);

  if (walletType === "content_rewards") {
    if (!orgId) {
      throw new Error("orgId is required for content rewards wallet");
    }
    const orgObjId = new Types.ObjectId(orgId);
    const wallet = await OrgRewardsWallet.findOne({
      userId: uid,
      orgId: orgObjId,
    }).session(session);
    if (!wallet) throw new Error("Content rewards wallet not found for this org");
    const after = (wallet.balance || 0) + deltaCents;
    if (after < 0) throw new Error("Insufficient content rewards balance");
    // Track totalWithdrawn on debits so the per-org dashboard shows it.
    const withdrawnDelta = deltaCents < 0 ? -deltaCents : 0;
    await OrgRewardsWallet.updateOne(
      { _id: wallet._id },
      {
        $inc: {
          balance: deltaCents,
          totalWithdrawn: withdrawnDelta,
        },
      },
      { session }
    );
    // Mirror on NcWallet too while the cutover is in flight — keeps NC in sync.
    const nc = await NcWallet.findOne({ userId: uid }).session(session);
    if (nc) {
      const ncAfter = (nc.balance || 0) + deltaCents;
      if (ncAfter >= 0) {
        await NcWallet.updateOne(
          { _id: nc._id },
          { $inc: { balance: deltaCents } },
          { session }
        );
      }
    }
    return;
  }

  const deltaUsd = round2(deltaCents / 100);
  if (walletType === "store") {
    if (!orgId) throw new Error("orgId is required for store wallet");
    const wallet = await StoreWallet.findOne({ userId: uid, orgId }).session(session);
    if (!wallet) throw new Error("Store wallet not found");
    const after = round2(wallet.balance + deltaUsd);
    if (after < 0) throw new Error("Insufficient store wallet balance");
    wallet.balance = after;
    wallet.lastTransactionAt = new Date();
    await wallet.save({ session });
    return;
  }

  // affiliate
  const wallet = await AffiliateWallet.findOne({ userId: uid }).session(session);
  if (!wallet) throw new Error("Affiliate wallet not found");
  const after = round2(wallet.balance + deltaUsd);
  if (after < 0) throw new Error("Insufficient affiliate balance");
  wallet.balance = after;
  wallet.lastTransactionAt = new Date();
  await wallet.save({ session });
}

// ─────────────────────────────────────────────────────────────────────────
// Initiate — debit gross from the wallet, create the Withdrawal (initiated).
// ─────────────────────────────────────────────────────────────────────────
/**
 * Price a withdrawal without writing anything.
 *
 * Backs the admin's initiate dialog (so the team sees the fee, the bank
 * charge, the taxes and the net BEFORE committing) and the user's own
 * projection. Same resolution path as initiateWithdrawal, so a quote and the
 * real thing cannot disagree.
 */
export async function quoteWithdrawal(params: {
  userId: string;
  walletType: WithdrawalWalletType;
  orgId?: string | null;
  payoutMethod: PayoutMethod;
  grossCents: number;
  taxes?: { label: string; type: "percent" | "flat"; value: number }[];
  bankTransferFeeCents?: number;
  overrides?: WithdrawalOverrides;
}) {
  const gross = Math.max(0, Math.round(params.grossCents || 0));
  const { feePercent: tierFeePct, feeTier } = await resolveWithdrawalFee({
    userId: params.userId,
    walletType: params.walletType,
    payoutMethod: params.payoutMethod,
  });
  // The dialog prices off this endpoint, so it has to apply the override
  // identically to initiateWithdrawal or the figures on screen would not be
  // the figures committed.
  const { feePercent, overridden: feeOverridden } = resolveFeeOverride(
    tierFeePct,
    params.overrides
  );
  const feeCents = Math.round((gross * feePercent) / 100);
  const bankTransferFeeCents =
    params.payoutMethod === "bank"
      ? Math.max(0, Math.round(params.bankTransferFeeCents || 0))
      : 0;
  const taxes = (params.taxes || []).map((t) => ({
    label: (t.label || "").trim(),
    type: t.type,
    value: t.value,
    amount:
      t.type === "percent"
        ? Math.round((gross * t.value) / 100)
        : Math.round(t.value),
  }));
  const taxTotalCents = taxes.reduce((sum, t) => sum + t.amount, 0);
  const netCents = gross - feeCents - bankTransferFeeCents - taxTotalCents;

  const breakdown = await getWithdrawableBreakdown(
    params.userId,
    params.walletType,
    params.orgId
  );
  const availableCents = breakdown.withdrawableCents;
  const keepAmountCents = feeTier?.keepAmountCents ?? 0;
  // With locked funds released, the ceiling becomes the real balance — never
  // anything above it.
  const ceilingCents = params.overrides?.releaseLockedFunds
    ? breakdown.balanceCents
    : availableCents;

  return {
    grossCents: gross,
    feePercent,
    feeCents,
    bankTransferFeeCents,
    taxes,
    taxTotalCents,
    netCents,
    /** What the platform actually keeps — the bank's cut is not ours. */
    platformRetainsCents: feeCents + taxTotalCents,
    feeTier,
    availableCents,
    keepAmountCents,
    /** Available minus the buffer the user asked to leave behind. */
    payableAfterKeepCents: Math.max(0, availableCents - keepAmountCents),
    keepThresholdCents: AFFILIATE_KEEP_THRESHOLD_CENTS,
    sufficient: gross <= ceilingCents && netCents >= 1,
    // Everything the dialog needs to explain the cap, and what an override
    // would actually be releasing.
    breakdown,
    ceilingCents,
    feeOverridden,
    tierFeePercent: tierFeePct,
    releasingLockedFunds: !!params.overrides?.releaseLockedFunds,
  };
}

export async function initiateWithdrawal(params: {
  adminId: string;
  userId: string;
  walletType: WithdrawalWalletType;
  orgId?: string | null;
  accountId: string;
  grossCents: number;
  taxes?: { label: string; type: "percent" | "flat"; value: number }[];
  /** What the bank charges to send it, cents. Bank payouts only. */
  bankTransferFeeCents?: number;
  /** Super-admin, this withdrawal only. See WithdrawalOverrides. */
  overrides?: WithdrawalOverrides;
}): Promise<any> {
  const { adminId, userId, walletType, accountId, grossCents } = params;
  // store + content_rewards are both per-org wallets now. Affiliate is the
  // only one that's still a single per-user pool.
  const orgId =
    walletType === "store" || walletType === "content_rewards"
      ? params.orgId || null
      : null;
  if (walletType === "content_rewards" && !orgId) {
    throw new Error("orgId is required for a content rewards withdrawal");
  }

  if (!grossCents || grossCents < 1) {
    throw new Error("Amount must be greater than 0");
  }

  // Validate the account belongs to this user + wallet slot.
  // Payout accounts are keyed differently per wallet type:
  //   store           → orgId of the store
  //   affiliate       → null (global per user)
  //   content_rewards → null (global per user — one destination shared by
  //                     ALL per-org CR buckets; the per-org orgId on the
  //                     Withdrawal row records which CR bucket was drained)
  const accountOrgId =
    walletType === "store" && orgId ? new Types.ObjectId(orgId) : null;
  const account = await WalletAccount.findOne({
    _id: new Types.ObjectId(accountId),
    userId: new Types.ObjectId(userId),
    walletType,
    orgId: accountOrgId,
    isActive: true,
  }).lean();
  if (!account) {
    throw new Error("Payout account not found for this wallet");
  }

  // ── Cap ────────────────────────────────────────────────────────────
  // Normally the gated cap: matured AND redeemable. A super admin may
  // release the locked portion, which raises the ceiling to the REAL
  // balance — never above it. `applyWalletDelta` re-checks inside the
  // transaction and refuses to go negative, so this is a second line of
  // defence rather than the only one.
  const breakdown = await getWithdrawableBreakdown(userId, walletType, orgId);
  const releasingLocked = !!params.overrides?.releaseLockedFunds;
  const ceiling = releasingLocked
    ? breakdown.balanceCents
    : breakdown.withdrawableCents;

  if (grossCents > ceiling) {
    throw new Error(
      releasingLocked
        ? `Amount exceeds the wallet balance ($${centsToUsd(breakdown.balanceCents).toFixed(2)})`
        : `Amount exceeds available balance ($${centsToUsd(breakdown.withdrawableCents).toFixed(2)})`
    );
  }
  // Releasing nothing is not an override — don't stamp one.
  const releasedCents = releasingLocked
    ? Math.max(0, grossCents - breakdown.withdrawableCents)
    : 0;

  // Resolve per-wallet-type fee percentage. Affiliate = 0%, others = 5%.
  const payoutMethod: PayoutMethod =
    (account as any).accountType === "crypto" ? "crypto" : "bank";
  const { feePercent: tierFeePct, feeTier } = await resolveWithdrawalFee({
    userId,
    walletType,
    payoutMethod,
  });
  // The fee never touches the debit — the wallet is debited the full gross
  // either way. It only decides how that gross splits between the member
  // and the platform, which is why overriding it cannot affect any balance.
  const { feePercent: resolvedFeePct, overridden: feeOverridden } =
    resolveFeeOverride(tierFeePct, params.overrides);
  const feeAmount = Math.round((grossCents * resolvedFeePct) / 100);

  // The bank's own charge. Deducted from what the user receives, but it is
  // the bank's money — completeWithdrawal never credits it to the platform.
  // Meaningless on a crypto payout, so refuse it rather than quietly drop it.
  const bankTransferFee = Math.max(0, Math.round(params.bankTransferFeeCents || 0));
  if (bankTransferFee > 0 && payoutMethod !== "bank") {
    throw new Error("A bank transfer fee cannot be charged on a crypto payout");
  }

  // Compute admin-added tax/deduction lines (percent off gross, or flat cents).
  const taxes = (params.taxes || []).map((t) => {
    const label = (t.label || "").trim();
    if (!label) throw new Error("Each tax line needs a label");
    if (!(t.value >= 0)) throw new Error("Tax value must be 0 or more");
    if (t.type === "percent" && t.value > 100) {
      throw new Error("Tax percentage cannot exceed 100%");
    }
    const amount =
      t.type === "percent"
        ? Math.round((grossCents * t.value) / 100)
        : Math.round(t.value);
    return { label, type: t.type, value: t.value, amount };
  });
  const taxTotal = taxes.reduce((sum, t) => sum + t.amount, 0);
  const netAmount = grossCents - feeAmount - bankTransferFee - taxTotal;
  if (netAmount < 1) {
    throw new Error("Deductions exceed the withdrawal amount");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Debit the wallet by the full gross.
    await applyWalletDelta(userId, walletType, orgId, -grossCents, session);

    const created = await Withdrawal.create(
      [
        {
          userId: new Types.ObjectId(userId),
          walletType,
          orgId: orgId ? new Types.ObjectId(orgId) : null,
          accountId: account._id,
          accountType: (account as any).accountType,
          accountSnapshot: account,
          withdrawalType: "manual",
          currency: "USD",
          grossAmount: grossCents,
          feePercent: resolvedFeePct,
          feeAmount,
          bankTransferFee,
          feeTier,
          taxes,
          taxTotal,
          netAmount,
          status: "initiated",
          initiatedByAdmin: new Types.ObjectId(adminId),
          // Audit: what the rules would have allowed, what was actually
          // done, and why. Only stamped when something was overridden.
          ...(feeOverridden || releasedCents > 0
            ? {
                adminOverride: {
                  ...(feeOverridden
                    ? { tierFeePercent: tierFeePct, appliedFeePercent: resolvedFeePct }
                    : {}),
                  ...(releasedCents > 0
                    ? {
                        gatedCapCents: breakdown.withdrawableCents,
                        walletBalanceCents: breakdown.balanceCents,
                        releasedCents,
                        lockedByMaturityCents: breakdown.lockedByMaturityCents,
                        lockedByLicenceCents: breakdown.lockedByLicenceCents,
                      }
                    : {}),
                  reason: (params.overrides?.reason || "").trim() || undefined,
                  at: new Date(),
                },
              }
            : {}),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return created[0];
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Complete — keep the debit, credit the 5% fee + taxes to Shorupan's StoreWallet.
// ─────────────────────────────────────────────────────────────────────────
export async function completeWithdrawal(params: {
  adminId: string;
  withdrawalId: string;
  receiptUrl?: string;
  /** Raw on-chain hash for a crypto payout. */
  txHash?: string;
  /** Everything the admin attached while approving. */
  proofs?: { url: string; label?: string }[];
}): Promise<any> {
  const { adminId, withdrawalId, receiptUrl, txHash, proofs } = params;

  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (!withdrawal) throw new Error("Withdrawal not found");
  if (withdrawal.status !== "initiated") {
    throw new Error(`Withdrawal is already ${withdrawal.status}`);
  }

  // Credit the platform-retained amount (5% fee + all taxes) to the platform
  // (Shorupan) StoreWallet in one transaction. Reuses creditStoreWallet, which
  // writes its own WalletTransaction atomically.
  // Fee + taxes are ours to keep. `bankTransferFee` is deliberately NOT here:
  // the bank takes that, so crediting it to the platform wallet would invent
  // revenue that never arrived.
  const platformRetained = (withdrawal.feeAmount || 0) + (withdrawal.taxTotal || 0);
  if (platformRetained > 0) {
    const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
      .select("_id")
      .lean();
    if (platformUser) {
      try {
        const feePct = withdrawal.feePercent ?? FEE_PERCENT;
        const description =
          withdrawal.taxTotal > 0
            ? withdrawal.feeAmount > 0
              ? `Withdrawal fee (${feePct}%) + taxes`
              : `Withdrawal taxes`
            : `Withdrawal processing fee (${feePct}%)`;
        const { transaction } = await creditStoreWallet(
          withdrawal.userId.toString(), // relatedUserId = who the fee came from
          platformUser._id.toString(),
          PLATFORM_ORG_ID,
          centsToUsd(platformRetained),
          description,
          `Withdrawal ${withdrawal._id}`
        );
        withdrawal.feeTransactionRef = transaction?._id?.toString() || "";
      } catch (e) {
        // Don't block completion if the platform wallet credit fails; log it.
        console.error("Failed to credit platform fee for withdrawal", withdrawal._id, e);
      }
    }
  }

  withdrawal.status = "completed";
  withdrawal.processedByAdmin = new Types.ObjectId(adminId);
  withdrawal.processedAt = new Date();
  if (receiptUrl) withdrawal.receiptUrl = receiptUrl;
  if (txHash) withdrawal.txHash = txHash.trim();

  // Normalised, de-duplicated and capped. `receiptUrl` is folded in so the
  // member's email shows one list whether the admin used the old single-file
  // field or the new multi-upload — and so a row written either way renders
  // identically.
  const incoming = [
    ...(proofs || []),
    ...(receiptUrl ? [{ url: receiptUrl, label: "" }] : []),
  ];
  if (incoming.length) {
    const seen = new Set((withdrawal.proofs || []).map((p: any) => p.url));
    for (const p of incoming) {
      const url = String(p?.url || "").trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      withdrawal.proofs.push({
        url,
        label: String(p?.label || "").trim().slice(0, 120),
        uploadedAt: new Date(),
      } as any);
    }
    // Defensive cap: the email renders every one of these.
    if (withdrawal.proofs.length > 10) {
      withdrawal.proofs = withdrawal.proofs.slice(0, 10) as any;
    }
    // Keep the legacy single field pointing at the first proof.
    if (!withdrawal.receiptUrl && withdrawal.proofs.length) {
      withdrawal.receiptUrl = withdrawal.proofs[0].url;
    }
  }
  await withdrawal.save();

  return withdrawal;
}

// ─────────────────────────────────────────────────────────────────────────
// Reject — refund the full gross back to the source wallet.
// ─────────────────────────────────────────────────────────────────────────
export async function rejectWithdrawal(params: {
  adminId: string;
  withdrawalId: string;
  reason?: string;
}): Promise<any> {
  const { adminId, withdrawalId, reason } = params;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const withdrawal = await Withdrawal.findById(withdrawalId).session(session);
    if (!withdrawal) throw new Error("Withdrawal not found");
    if (withdrawal.status !== "initiated") {
      throw new Error(`Withdrawal is already ${withdrawal.status}`);
    }

    // Refund the full gross.
    await applyWalletDelta(
      withdrawal.userId.toString(),
      withdrawal.walletType,
      withdrawal.orgId ? withdrawal.orgId.toString() : null,
      withdrawal.grossAmount,
      session
    );

    withdrawal.status = "rejected";
    withdrawal.processedByAdmin = new Types.ObjectId(adminId);
    withdrawal.processedAt = new Date();
    withdrawal.rejectionReason = reason || "";
    await withdrawal.save({ session });

    await session.commitTransaction();
    return withdrawal;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Read helpers.
// ─────────────────────────────────────────────────────────────────────────
export async function getUserWithdrawals(
  userId: string,
  walletType: WithdrawalWalletType,
  orgId?: string | null
): Promise<any[]> {
  const isPerOrg =
    walletType === "store" || walletType === "content_rewards";
  const filter: any = {
    userId: new Types.ObjectId(userId),
    walletType,
    orgId: isPerOrg && orgId ? new Types.ObjectId(orgId) : null,
  };
  return Withdrawal.find(filter).sort({ createdAt: -1 }).limit(100).lean();
}

// ─────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────

const WALLET_LABEL: Record<WithdrawalWalletType, string> = {
  store: "Store Wallet",
  affiliate: "Affiliate Wallet",
  content_rewards: "Content Rewards",
};

function payoutDestination(w: any): string {
  const a = w?.accountSnapshot;
  if (!a) return w?.accountType || "unknown";
  if (a.accountType === "bank") {
    const tail = a.accountNumber ? `••••${String(a.accountNumber).slice(-4)}` : "";
    return `${a.bankName || "Bank"}${tail ? ` · ${tail}` : ""}`;
  }
  const tail = a.cryptoAddress
    ? `${String(a.cryptoAddress).slice(0, 6)}…${String(a.cryptoAddress).slice(-4)}`
    : "";
  return `${a.cryptoNetwork || "Crypto"}${tail ? ` · ${tail}` : ""}`;
}

/**
 * Notify the platform owner (Shorupan) that a withdrawal needs manual
 * settlement. Fire-and-forget — failures are logged but do NOT bubble up
 * to the API caller. The Withdrawal row is already persisted by the time
 * this runs, so a missed email never loses money.
 *
 * Email contains: initiating admin, recipient user, full deduction
 * breakdown, payout destination, and a deep-link into the admin queue.
 */
export async function notifyAdminOnWithdrawalInitiated(
  withdrawalId: string | Types.ObjectId
): Promise<void> {
  try {
    const w: any = await Withdrawal.findById(withdrawalId)
      .populate("userId", "name email")
      .populate("initiatedByAdmin", "name email")
      .lean();
    if (!w) return;

    const userName = w.userId?.name || w.userId?.email || "a user";
    const userEmail = w.userId?.email || "unknown";
    const adminName = w.initiatedByAdmin?.name || w.initiatedByAdmin?.email || "an admin";
    const adminEmail = w.initiatedByAdmin?.email || "unknown";
    const walletLabel = WALLET_LABEL[w.walletType as WithdrawalWalletType] || w.walletType;
    const destination = payoutDestination(w);

    const grossFmt = `$${centsToUsd(w.grossAmount || 0).toFixed(2)}`;
    const feeFmt = `$${centsToUsd(w.feeAmount || 0).toFixed(2)}`;
    const netFmt = `$${centsToUsd(w.netAmount || 0).toFixed(2)}`;

    const taxLines = (w.taxes || [])
      .map(
        (t: any) =>
          `<tr><td style="padding:6px 0;color:#9fa0b8;">${escapeHtml(t.label)}</td>` +
          `<td style="padding:6px 0;text-align:right;font-family:monospace;color:#c7c7da;">−$${centsToUsd(t.amount).toFixed(2)}</td></tr>`
      )
      .join("");

    const adminLink = `${env.FRONTEND_URL.replace(/\/$/, "")}/garage-admin/withdrawals`;

    const subject = `[Garage] Withdrawal initiated · ${netFmt} to ${userName}`;
    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#0e0e12;color:#e7e7ea;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#111116;border:1px solid #2a2a35;border-radius:14px;padding:22px;">
    <div style="font-size:13px;color:#FBD10D;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">Withdrawal initiated</div>
    <h1 style="margin:0 0 4px;font-size:22px;color:#fff;font-weight:800;">${netFmt} to ${escapeHtml(userName)}</h1>
    <p style="margin:0 0 18px;font-size:13px;color:#9fa0b8;">Pending your bank transfer + completion in the admin queue.</p>

    <table style="width:100%;font-size:13px;border-collapse:collapse;border-top:1px solid #2a2a35;">
      <tr><td style="padding:8px 0;color:#9fa0b8;width:40%;">Initiated by</td><td style="padding:8px 0;color:#fff;text-align:right;">${escapeHtml(adminName)} <span style="color:#5a5a72;">(${escapeHtml(adminEmail)})</span></td></tr>
      <tr><td style="padding:6px 0;color:#9fa0b8;">User</td><td style="padding:6px 0;color:#fff;text-align:right;">${escapeHtml(userName)} <span style="color:#5a5a72;">(${escapeHtml(userEmail)})</span></td></tr>
      <tr><td style="padding:6px 0;color:#9fa0b8;">Wallet</td><td style="padding:6px 0;color:#fff;text-align:right;">${escapeHtml(walletLabel)}</td></tr>
      <tr><td style="padding:6px 0;color:#9fa0b8;">Pay to</td><td style="padding:6px 0;color:#fff;text-align:right;">${escapeHtml(destination)}</td></tr>
    </table>

    <div style="margin-top:18px;border-top:1px solid #2a2a35;padding-top:14px;">
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#9fa0b8;">Withdrawal amount</td><td style="padding:6px 0;text-align:right;font-family:monospace;color:#fff;">${grossFmt}</td></tr>
        ${
          (w.feeAmount || 0) > 0
            ? `<tr><td style="padding:6px 0;color:#9fa0b8;">Platform fee (${w.feePercent ?? FEE_PERCENT}%)</td><td style="padding:6px 0;text-align:right;font-family:monospace;color:#c7c7da;">−${feeFmt}</td></tr>`
            : ""
        }
        ${taxLines}
        <tr><td style="padding:10px 0 0;border-top:1px solid #2a2a35;color:#fff;font-weight:600;">Net payout</td><td style="padding:10px 0 0;border-top:1px solid #2a2a35;text-align:right;font-family:monospace;color:#FBD10D;font-weight:700;">${netFmt}</td></tr>
      </table>
    </div>

    <div style="margin-top:22px;text-align:center;">
      <a href="${adminLink}" style="display:inline-block;background:#FBD10D;color:#000;text-decoration:none;font-weight:700;font-size:13px;padding:10px 18px;border-radius:10px;">Open admin queue →</a>
    </div>

    <p style="margin:18px 0 0;font-size:11px;color:#5a5a72;text-align:center;">
      You're receiving this because admin-initiated withdrawals are routed to the platform owner for manual settlement.
    </p>
  </div>
</div>`;
    const text =
      `Withdrawal initiated: ${netFmt} to ${userName} (${userEmail}).\n` +
      `Wallet: ${walletLabel}. Pay to: ${destination}.\n` +
      `Gross ${grossFmt} − fee ${feeFmt} = net ${netFmt}.\n` +
      `Initiated by ${adminName} (${adminEmail}).\n` +
      `Open: ${adminLink}`;

    await sendMail(PLATFORM_USER_EMAIL, subject, html, text, EMAIL_FROM_NOTIFICATION);
  } catch (err) {
    console.error(
      `[withdrawal] notifyAdminOnWithdrawalInitiated failed for ${withdrawalId}:`,
      err
    );
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─────────────────────────────────────────────────────────────────────────
// User-facing notifications — the recipient of the withdrawal gets an
// email at each lifecycle transition (initiated / completed / rejected).
// Fire-and-forget; failures are logged but never block the API response.
// Withdrawal row is already committed before these run, so a missed email
// never affects the money.
// ─────────────────────────────────────────────────────────────────────────

/** Shared HTML shell — keeps user-facing emails visually consistent. */
function userWithdrawalEmailShell(args: {
  badge: string;
  badgeColor: string;
  heading: string;
  intro: string;
  recipientName: string;
  walletLabel: string;
  destination: string;
  grossFmt: string;
  feeFmt?: string;
  feePct?: number;
  taxes?: { label: string; amount: number }[];
  netFmt: string;
  extra?: string; // arbitrary HTML appended to the breakdown block
  footnote?: string;
}): string {
  const taxLines = (args.taxes || [])
    .map(
      (t) =>
        `<tr><td style="padding:6px 0;color:#9fa0b8;">${escapeHtml(t.label)}</td>` +
        `<td style="padding:6px 0;text-align:right;font-family:monospace;color:#c7c7da;">−$${centsToUsd(t.amount).toFixed(2)}</td></tr>`
    )
    .join("");
  const feeRow =
    args.feeFmt && args.feePct !== undefined
      ? `<tr><td style="padding:6px 0;color:#9fa0b8;">Processing fee (${args.feePct}%)</td><td style="padding:6px 0;text-align:right;font-family:monospace;color:#c7c7da;">−${args.feeFmt}</td></tr>`
      : "";

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#0e0e12;color:#e7e7ea;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#111116;border:1px solid #2a2a35;border-radius:14px;padding:22px;">
    <div style="font-size:13px;color:${args.badgeColor};font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">${escapeHtml(args.badge)}</div>
    <h1 style="margin:0 0 4px;font-size:22px;color:#fff;font-weight:800;">${escapeHtml(args.heading)}</h1>
    <p style="margin:0 0 18px;font-size:13px;color:#9fa0b8;">Hi ${escapeHtml(args.recipientName)}, ${escapeHtml(args.intro)}</p>

    <table style="width:100%;font-size:13px;border-collapse:collapse;border-top:1px solid #2a2a35;">
      <tr><td style="padding:8px 0;color:#9fa0b8;width:40%;">Wallet</td><td style="padding:8px 0;color:#fff;text-align:right;">${escapeHtml(args.walletLabel)}</td></tr>
      <tr><td style="padding:6px 0;color:#9fa0b8;">Payout to</td><td style="padding:6px 0;color:#fff;text-align:right;">${escapeHtml(args.destination)}</td></tr>
    </table>

    <div style="margin-top:18px;border-top:1px solid #2a2a35;padding-top:14px;">
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#9fa0b8;">Withdrawal amount</td><td style="padding:6px 0;text-align:right;font-family:monospace;color:#fff;">${args.grossFmt}</td></tr>
        ${feeRow}
        ${taxLines}
        <tr><td style="padding:10px 0 0;border-top:1px solid #2a2a35;color:#fff;font-weight:600;">Net to you</td><td style="padding:10px 0 0;border-top:1px solid #2a2a35;text-align:right;font-family:monospace;color:#FBD10D;font-weight:700;">${args.netFmt}</td></tr>
      </table>
    </div>

    ${args.extra || ""}

    ${args.footnote ? `<p style="margin:22px 0 0;font-size:11px;color:#5a5a72;text-align:center;">${args.footnote}</p>` : ""}
  </div>
</div>`;
}

/** Email the user that their withdrawal request is queued for processing. */
export async function notifyUserOnWithdrawalInitiated(
  withdrawalId: string | Types.ObjectId
): Promise<void> {
  try {
    const w: any = await Withdrawal.findById(withdrawalId)
      .populate("userId", "name email")
      .lean();
    if (!w?.userId?.email) return;

    const name = w.userId.name || "there";
    const email = w.userId.email;
    const walletLabel = WALLET_LABEL[w.walletType as WithdrawalWalletType] || w.walletType;
    const destination = payoutDestination(w);

    const grossFmt = `$${centsToUsd(w.grossAmount || 0).toFixed(2)}`;
    const feeFmt = `$${centsToUsd(w.feeAmount || 0).toFixed(2)}`;
    const netFmt = `$${centsToUsd(w.netAmount || 0).toFixed(2)}`;

    const subject = `Your withdrawal of ${netFmt} is being processed`;
    const feeIsCharged = (w.feeAmount || 0) > 0;
    const html = userWithdrawalEmailShell({
      badge: "Withdrawal initiated",
      badgeColor: "#FBD10D",
      heading: `${netFmt} is on its way`,
      intro: `we've received your withdrawal request and it's now queued for processing. You'll get another email once the funds have been sent.`,
      recipientName: name,
      walletLabel,
      destination,
      grossFmt,
      // Only surface the fee row when a fee was actually charged; hides
      // the "Processing fee (0%): $0.00" noise on zero-fee wallets
      // (currently affiliate).
      feeFmt: feeIsCharged ? feeFmt : undefined,
      feePct: feeIsCharged ? (w.feePercent ?? FEE_PERCENT) : undefined,
      taxes: w.taxes,
      netFmt,
      footnote:
        "Manual settlements typically complete within 1–3 business days. If anything looks wrong, reply to this email — we'll fix it before the transfer goes out.",
    });
    const text =
      `Hi ${name}, your withdrawal of ${netFmt} is being processed.\n` +
      `Wallet: ${walletLabel}. Pay to: ${destination}.\n` +
      `Gross ${grossFmt} − fee ${feeFmt} = net ${netFmt}.`;

    await sendMail(email, subject, html, text, EMAIL_FROM_NOTIFICATION);
  } catch (err) {
    console.error(
      `[withdrawal] notifyUserOnWithdrawalInitiated failed for ${withdrawalId}:`,
      err
    );
  }
}

/** Email the user that their withdrawal has been settled / paid out. */
export async function notifyUserOnWithdrawalCompleted(
  withdrawalId: string | Types.ObjectId
): Promise<void> {
  try {
    const w: any = await Withdrawal.findById(withdrawalId)
      .populate("userId", "name email")
      .lean();
    if (!w?.userId?.email) return;

    const name = w.userId.name || "there";
    const email = w.userId.email;
    const walletLabel = WALLET_LABEL[w.walletType as WithdrawalWalletType] || w.walletType;
    const destination = payoutDestination(w);

    const grossFmt = `$${centsToUsd(w.grossAmount || 0).toFixed(2)}`;
    const feeFmt = `$${centsToUsd(w.feeAmount || 0).toFixed(2)}`;
    const netFmt = `$${centsToUsd(w.netAmount || 0).toFixed(2)}`;

    // ── Proof of payment ───────────────────────────────────────────────
    //
    // Everything the admin attached while approving, rendered in the member's
    // own email rather than left for them to ask support for. Previously only
    // a single "View transfer receipt" button appeared, and for crypto the
    // raw hash was discarded entirely in favour of an explorer link — so the
    // member could click through but never copy the hash itself.
    //
    // Images are shown inline: a bank transfer screenshot is the thing people
    // actually want to look at, and making them click a link to see it is a
    // worse experience for no gain. Anything else becomes a labelled link,
    // since an email client cannot preview a PDF.
    const proofs: { url: string; label: string }[] = (w.proofs?.length
      ? w.proofs
      : w.receiptUrl
        ? [{ url: w.receiptUrl, label: "" }]
        : []
    ).map((p: any) => ({ url: String(p.url), label: String(p.label || "") }));

    const isImage = (u: string) => /\.(png|jpe?g|gif|webp|bmp|heic)(\?|#|$)/i.test(u);
    const prettyName = (u: string, label: string) => {
      if (label) return label;
      try {
        const base = decodeURIComponent(new URL(u).pathname.split("/").pop() || "");
        return base || "Attachment";
      } catch {
        return "Attachment";
      }
    };

    const hashRow = w.txHash
      ? `<div style="margin-top:14px;">
           <div style="font-size:11px;color:#5a5a72;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Transaction hash</div>
           <div style="font-family:monospace;font-size:12px;color:#e7e7ea;background:#0a0a0c;border:1px solid #2a2a35;border-radius:8px;padding:10px 12px;word-break:break-all;">${escapeHtml(w.txHash)}</div>
         </div>`
      : "";

    const proofBlocks = proofs
      .map((p) =>
        isImage(p.url)
          ? `<div style="margin-top:12px;">
               <div style="font-size:11px;color:#5a5a72;margin-bottom:6px;">${escapeHtml(prettyName(p.url, p.label))}</div>
               <a href="${escapeHtml(p.url)}" style="display:block;">
                 <img src="${escapeHtml(p.url)}" alt="${escapeHtml(prettyName(p.url, p.label))}" style="max-width:100%;border:1px solid #2a2a35;border-radius:10px;display:block;" />
               </a>
             </div>`
          : `<div style="margin-top:10px;">
               <a href="${escapeHtml(p.url)}" style="display:block;background:#0a0a0c;border:1px solid #2a2a35;border-radius:8px;padding:11px 13px;color:#FBD10D;text-decoration:none;font-size:13px;font-weight:600;">${escapeHtml(prettyName(p.url, p.label))} →</a>
             </div>`
      )
      .join("");

    const receiptBlock =
      hashRow || proofBlocks
        ? `<div style="margin-top:22px;border-top:1px solid #2a2a35;padding-top:16px;">
             <div style="font-size:13px;color:#fff;font-weight:700;margin-bottom:2px;">Proof of payment</div>
             <p style="margin:0 0 4px;font-size:12px;color:#9fa0b8;">${
               proofs.length > 1
                 ? `${proofs.length} documents were attached when this payout was approved.`
                 : "Attached when this payout was approved."
             }</p>
             ${hashRow}
             ${proofBlocks}
           </div>`
        : "";

    const subject = `${netFmt} has been sent to your ${walletLabel.toLowerCase()} payout account`;
    const feeIsCharged = (w.feeAmount || 0) > 0;
    const html = userWithdrawalEmailShell({
      badge: "Withdrawal completed",
      badgeColor: "#34d399",
      heading: `${netFmt} sent`,
      intro: `your withdrawal has been settled and the funds are on their way to your payout account.`,
      recipientName: name,
      walletLabel,
      destination,
      grossFmt,
      feeFmt: feeIsCharged ? feeFmt : undefined,
      feePct: feeIsCharged ? (w.feePercent ?? FEE_PERCENT) : undefined,
      taxes: w.taxes,
      netFmt,
      extra: receiptBlock,
      footnote:
        "Bank transfers can take up to 2 business days to appear in your account depending on your bank. Crypto transfers settle on-chain — track them on the explorer if needed.",
    });
    const text =
      `Hi ${name}, ${netFmt} has been sent to ${destination}.\n` +
      `Wallet: ${walletLabel}.\n` +
      `Gross ${grossFmt} − fee ${feeFmt} = net ${netFmt}.` +
      (w.txHash ? `\nTransaction hash: ${w.txHash}` : "") +
      (proofs.length
        ? `\nProof of payment:\n` +
          proofs.map((p) => `  - ${prettyName(p.url, p.label)}: ${p.url}`).join("\n")
        : "");

    await sendMail(email, subject, html, text, EMAIL_FROM_NOTIFICATION);
  } catch (err) {
    console.error(
      `[withdrawal] notifyUserOnWithdrawalCompleted failed for ${withdrawalId}:`,
      err
    );
  }
}

/** Email the user that their withdrawal was declined and funds refunded. */
export async function notifyUserOnWithdrawalRejected(
  withdrawalId: string | Types.ObjectId
): Promise<void> {
  try {
    const w: any = await Withdrawal.findById(withdrawalId)
      .populate("userId", "name email")
      .lean();
    if (!w?.userId?.email) return;

    const name = w.userId.name || "there";
    const email = w.userId.email;
    const walletLabel = WALLET_LABEL[w.walletType as WithdrawalWalletType] || w.walletType;
    const destination = payoutDestination(w);

    const grossFmt = `$${centsToUsd(w.grossAmount || 0).toFixed(2)}`;
    const reasonHtml = w.rejectionReason
      ? `<div style="margin-top:18px;border-top:1px solid #2a2a35;padding-top:14px;">
           <div style="font-size:11px;color:#9fa0b8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">Reason</div>
           <div style="font-size:13px;color:#fff;line-height:1.5;">${escapeHtml(w.rejectionReason)}</div>
         </div>`
      : "";

    const subject = `Your withdrawal of ${grossFmt} couldn't be processed`;
    const html = userWithdrawalEmailShell({
      badge: "Withdrawal declined",
      badgeColor: "#f87171",
      heading: `${grossFmt} refunded to your ${walletLabel.toLowerCase()}`,
      intro: `we weren't able to process this withdrawal. The full amount has been credited back to your wallet — your balance is unchanged.`,
      recipientName: name,
      walletLabel,
      destination,
      grossFmt,
      // No fee row on a rejection — nothing was retained.
      netFmt: grossFmt,
      extra: reasonHtml,
      footnote:
        "If this was unexpected, reply to this email and we'll take another look.",
    });
    const text =
      `Hi ${name}, your withdrawal of ${grossFmt} couldn't be processed.\n` +
      `The full amount has been refunded to your ${walletLabel} — no balance lost.\n` +
      (w.rejectionReason ? `Reason: ${w.rejectionReason}\n` : "") +
      `Reply to this email if you want us to take another look.`;

    await sendMail(email, subject, html, text, EMAIL_FROM_NOTIFICATION);
  } catch (err) {
    console.error(
      `[withdrawal] notifyUserOnWithdrawalRejected failed for ${withdrawalId}:`,
      err
    );
  }
}
