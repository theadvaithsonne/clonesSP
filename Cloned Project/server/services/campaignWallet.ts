// src/services/campaignWallet.ts
// Service layer for the per-campaign escrow wallet. Mirrors the patterns in
// services/wallet.ts (single Mongo session, paired debit/credit transactions
// linked via relatedTransactionId).
//
// Three operations:
//   1. lockBudgetForCampaign  — Store → Campaign  (on campaign creation)
//   2. payoutFromCampaignToAffiliate — Campaign → NC Wallet  (per cron sweep tick)
//   3. refundCampaignToFounder — Campaign → Store  (on campaign close)
//
// Payout destination: the affiliate's NC `Wallet` (shared MongoDB collection
// owned by network-chains-backend). Both backends sit on the same Mongo
// cluster, so the campaign debit and the affiliate credit commit inside a
// single Mongo transaction — no HTTP rail, no outbox, no reconciliation.
//
// All amounts are passed in as CENTS (matching ContentCampaign /
// ContentSubmission / NC Wallet storage). They are converted to FLOAT USD at
// the wallet boundary because StoreWallet uses float USD.

import mongoose, { ClientSession, Types } from "mongoose";
import { CampaignWallet } from "../models/campaignWallet.model";
import { CampaignWalletTransaction } from "../models/campaignWalletTransaction.model";
import { ContentPayout } from "../models/contentPayout.model";
import { ContentSubmission } from "../models/contentSubmission.model";
import { ContentCampaign } from "../models/contentCampaign.model";
import { NcWallet } from "../models/ncWallet.model";
import { OrgRewardsWallet } from "../models/orgRewardsWallet.model";
import { StoreWallet } from "../models/storeWallet.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";

const round2 = (n: number) => Math.round(n * 100) / 100;
const centsToUsd = (cents: number) => round2(cents / 100);

// ─────────────────────────────────────────────────────────────────────────
// Read-only accessors
// ─────────────────────────────────────────────────────────────────────────

export async function getCampaignWalletByCampaignId(
  campaignId: string
): Promise<any> {
  return CampaignWallet.findOne({
    campaignId: new Types.ObjectId(campaignId),
  }).lean();
}

export async function getCampaignWalletTransactions(
  campaignId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ transactions: any[]; total: number }> {
  const { limit = 20, offset = 0 } = options;
  const cid = new Types.ObjectId(campaignId);

  const [transactions, total] = await Promise.all([
    CampaignWalletTransaction.find({ campaignId: cid })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("relatedUserId", "name email profilePicture")
      .lean(),
    CampaignWalletTransaction.countDocuments({ campaignId: cid }),
  ]);

  return { transactions, total };
}

// ─────────────────────────────────────────────────────────────────────────
// 1) Lock budget at campaign creation
//    Debits founder's StoreWallet → credits new CampaignWallet.
// ─────────────────────────────────────────────────────────────────────────

export async function lockBudgetForCampaign(params: {
  campaignId: string;
  founderId: string;
  orgId: string;
  amountCents: number;
  description: string;
  session: ClientSession;
}): Promise<{
  campaignWallet: any;
  storeTransaction: any;
  campaignTransaction: any;
}> {
  const { campaignId, founderId, orgId, amountCents, description, session } =
    params;

  if (amountCents <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  const amountUsd = centsToUsd(amountCents);

  // 1) Debit founder's StoreWallet (must already exist — caller is expected
  //    to have run a balance check before opening the session)
  const storeWallet = await StoreWallet.findOne({
    userId: founderId,
    orgId,
  }).session(session);
  if (!storeWallet) {
    throw new Error("Founder store wallet not found");
  }
  if (storeWallet.balance < amountUsd) {
    throw new Error(
      `Insufficient store wallet balance. Available: $${storeWallet.balance.toFixed(
        2
      )}, required: $${amountUsd.toFixed(2)}`
    );
  }

  const storeBalanceBefore = storeWallet.balance;
  const storeBalanceAfter = round2(storeBalanceBefore - amountUsd);
  storeWallet.balance = storeBalanceAfter;
  storeWallet.lastTransactionAt = new Date();
  await storeWallet.save({ session });

  const storeTransaction = (
    await WalletTransaction.create(
      [
        {
          storeWalletId: storeWallet._id,
          walletType: "store",
          userId: founderId,
          orgId,
          type: "debit",
          amount: amountUsd,
          currency: "USD",
          balanceBefore: storeBalanceBefore,
          balanceAfter: storeBalanceAfter,
          description,
          metadata: { campaignId, action: "campaign_budget_lock" },
          status: "completed",
        },
      ],
      { session }
    )
  )[0];

  // 2) Create CampaignWallet (1:1 with the campaign)
  const campaignWallet = (
    await CampaignWallet.create(
      [
        {
          campaignId: new Types.ObjectId(campaignId),
          orgId: new Types.ObjectId(orgId),
          founderId: new Types.ObjectId(founderId),
          balance: amountUsd,
          currency: "USD",
          totalLocked: amountUsd,
          totalPaidOut: 0,
          totalRefunded: 0,
          status: "active",
          lastTransactionAt: new Date(),
        },
      ],
      { session }
    )
  )[0];

  // 3) Audit row on the campaign side
  const campaignTransaction = (
    await CampaignWalletTransaction.create(
      [
        {
          campaignWalletId: campaignWallet._id,
          campaignId: new Types.ObjectId(campaignId),
          orgId: new Types.ObjectId(orgId),
          type: "credit",
          direction: "in",
          amount: amountUsd,
          currency: "USD",
          balanceBefore: 0,
          balanceAfter: amountUsd,
          description,
          relatedUserId: new Types.ObjectId(founderId),
          relatedTransactionId: storeTransaction._id,
          metadata: { action: "campaign_budget_lock" },
          status: "completed",
        },
      ],
      { session }
    )
  )[0];

  // 4) Link the paired transactions both ways
  storeTransaction.relatedTransactionId = campaignTransaction._id;
  await storeTransaction.save({ session });

  return { campaignWallet, storeTransaction, campaignTransaction };
}

// ─────────────────────────────────────────────────────────────────────────
// 2) Payout from campaign to affiliate
//    Debits CampaignWallet (Garage, float USD)
//    → credits affiliate's NC Wallet (shared collection, integer cents).
//    All writes commit inside the caller's Mongo session — true atomicity.
//
//    Side effects in the same transaction:
//      · ContentPayout row (audit record, status="completed")
//      · CampaignWalletTransaction row (Garage-side audit)
//      · NC Wallet transaction record (embedded in wallets.transactions[])
//      · submission.paidOutAmount += amountCents
//      · campaign.budgetSpent += amountCents
//      · If campaign wallet drains to 0, campaign.status → "completed"
//
//    `amountCents` is the DELTA being paid this tick (not the cumulative
//    earnedAmount). Caller computes it as `submission.earnedAmount -
//    submission.paidOutAmount` and clamps to wallet balance.
//
//    Currency: USD only for V1. INR campaigns throw before any state change.
// ─────────────────────────────────────────────────────────────────────────

export async function payoutFromCampaignToAffiliate(params: {
  campaignId: string;
  submissionId: string;
  userId: string;
  orgId: string;
  amountCents: number;
  viewsRewarded: number;
  description: string;
  session: ClientSession;
}): Promise<{
  campaignWallet: any;
  ncWallet: any;
  payout: any;
  campaignTransaction: any;
  campaignAutoCompleted: boolean;
}> {
  const {
    campaignId,
    submissionId,
    userId,
    orgId,
    amountCents,
    viewsRewarded,
    description,
    session,
  } = params;

  if (amountCents <= 0) {
    throw new Error("Payout amount must be greater than 0");
  }

  // ── Currency guard ──────────────────────────────────────────────────
  // V1 is USD-only. CampaignWallet and NC Wallet both track integer cents
  // labelled USD. An INR campaign would silently relabel paise as cents
  // and credit the affiliate the wrong amount. Fail loud, leave the
  // submission for a manual fix.
  const campaign = await ContentCampaign.findById(campaignId).session(session);
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  if (campaign.currency && campaign.currency !== "USD") {
    throw new Error(
      `Payout blocked: campaign currency is ${campaign.currency}. V1 supports USD only.`
    );
  }

  const amountUsd = centsToUsd(amountCents);
  const uid = new Types.ObjectId(userId);

  // ── 1) Debit CampaignWallet ────────────────────────────────────────
  const campaignWallet = await CampaignWallet.findOne({
    campaignId: new Types.ObjectId(campaignId),
  }).session(session);
  if (!campaignWallet) {
    throw new Error("Campaign wallet not found");
  }
  if (campaignWallet.status !== "active") {
    throw new Error(`Campaign wallet is ${campaignWallet.status}`);
  }
  if (campaignWallet.balance < amountUsd) {
    throw new Error(
      `Insufficient campaign wallet balance. Available: $${campaignWallet.balance.toFixed(
        2
      )}, required: $${amountUsd.toFixed(2)}`
    );
  }

  const cwBalanceBefore = campaignWallet.balance;
  const cwBalanceAfter = round2(cwBalanceBefore - amountUsd);
  campaignWallet.balance = cwBalanceAfter;
  campaignWallet.totalPaidOut = round2(campaignWallet.totalPaidOut + amountUsd);
  campaignWallet.lastTransactionAt = new Date();
  await campaignWallet.save({ session });

  // ── 2) Credit affiliate's NC Wallet (shared `wallets` collection) ──
  // Mirrors NC's services/wallet.service.ts addCredits behaviour:
  //   - lazy-create (upsert)
  //   - auto-clear outstanding debt before crediting balance
  //   - push transaction record (newest first), keep history capped at 200
  let ncWallet = await NcWallet.findOne({ userId: uid }).session(session);
  if (!ncWallet) {
    const created = await NcWallet.create(
      [{ userId: uid, balance: 0, debt: 0, transactions: [] }],
      { session }
    );
    ncWallet = created[0];
  }

  const debtBefore = ncWallet.debt || 0;
  const debtCleared = Math.min(debtBefore, amountCents);
  const creditToBalance = amountCents - debtCleared;
  const ncBalanceBefore = ncWallet.balance;
  const ncBalanceAfter = ncBalanceBefore + creditToBalance;

  const ncTxDescription =
    debtCleared > 0
      ? `${description} ($${(debtCleared / 100).toFixed(2)} used to clear debt)`
      : description;

  await NcWallet.updateOne(
    { _id: ncWallet._id },
    {
      $inc: {
        balance: creditToBalance,
        debt: -debtCleared,
      },
      $push: {
        transactions: {
          $each: [
            {
              type: "credit",
              amount: amountCents,
              balanceAfter: ncBalanceAfter,
              description: ncTxDescription,
              createdAt: new Date(),
            },
          ],
          $position: 0,
          $slice: 200,
        },
      },
    },
    { session }
  );

  // ── 2b) Mirror credit into the per-org wallet (Garage source of truth) ──
  // Same amountCents, same transaction. Lazy-create on first credit.
  // This is what the Garage Vault / Send modal / withdrawals now read.
  // NcWallet stays in step (above) for NC compatibility until the cutover.
  const orgObjId = new Types.ObjectId(orgId);
  let orgWallet = await OrgRewardsWallet.findOne({
    userId: uid,
    orgId: orgObjId,
  }).session(session);
  if (!orgWallet) {
    const created = await OrgRewardsWallet.create(
      [
        {
          userId: uid,
          orgId: orgObjId,
          balance: 0,
          totalEarnings: 0,
          totalWithdrawn: 0,
          transactions: [],
        },
      ],
      { session }
    );
    orgWallet = created[0];
  }
  const orgBalanceBefore = orgWallet.balance;
  const orgBalanceAfter = orgBalanceBefore + amountCents;
  await OrgRewardsWallet.updateOne(
    { _id: orgWallet._id },
    {
      $inc: { balance: amountCents, totalEarnings: amountCents },
      $push: {
        transactions: {
          $each: [
            {
              type: "credit",
              amount: amountCents,
              balanceAfter: orgBalanceAfter,
              source: "campaign_payout",
              description,
              createdAt: new Date(),
            },
          ],
          $position: 0,
          $slice: 200,
        },
      },
    },
    { session }
  );

  // ── 3) ContentPayout audit record ──────────────────────────────────
  const payout = (
    await ContentPayout.create(
      [
        {
          userId: uid,
          campaignId: new Types.ObjectId(campaignId),
          submissionId: new Types.ObjectId(submissionId),
          orgId: new Types.ObjectId(orgId),
          amount: amountCents,
          viewsRewarded,
          status: "completed",
          processedAt: new Date(),
        },
      ],
      { session }
    )
  )[0];

  // ── 4) CampaignWalletTransaction audit row ─────────────────────────
  const campaignTransaction = (
    await CampaignWalletTransaction.create(
      [
        {
          campaignWalletId: campaignWallet._id,
          campaignId: new Types.ObjectId(campaignId),
          orgId: new Types.ObjectId(orgId),
          type: "debit",
          direction: "out",
          amount: amountUsd,
          currency: "USD",
          balanceBefore: cwBalanceBefore,
          balanceAfter: cwBalanceAfter,
          description,
          relatedUserId: uid,
          relatedSubmissionId: new Types.ObjectId(submissionId),
          relatedPayoutId: payout._id,
          metadata: {
            action: "campaign_payout",
            viewsRewarded,
            ncWalletId: ncWallet._id,
            ncDebtCleared: debtCleared,
            ncBalanceAfter,
          },
          status: "completed",
        },
      ],
      { session }
    )
  )[0];

  payout.transactionRef = campaignTransaction._id.toString();
  await payout.save({ session });

  // ── 5) Update submission paid-out tracking ─────────────────────────
  await ContentSubmission.updateOne(
    { _id: new Types.ObjectId(submissionId) },
    {
      $inc: { paidOutAmount: amountCents },
      $set: { paidOutAt: new Date() },
    },
    { session }
  );

  // ── 6) Update campaign counters + auto-complete on exhaustion ──────
  // When the escrow drains to zero we flip the campaign to "completed"
  // in the same transaction. Sweeper short-circuits non-active campaigns
  // on the next tick; NC's submission ingress rejects them at
  // contentSubmission.ts:79. Idempotent — re-running on an already-
  // completed campaign is a no-op.
  const campaignAutoCompleted = cwBalanceAfter === 0 && campaign.status === "active";
  const campaignUpdate: any = {
    $inc: { budgetSpent: amountCents },
    $set: { lockedAmount: Math.max(0, Math.round(cwBalanceAfter * 100)) },
  };
  if (campaignAutoCompleted) {
    campaignUpdate.$set.status = "completed";
    campaignUpdate.$set.completedAt = new Date();
  }
  await ContentCampaign.updateOne(
    { _id: new Types.ObjectId(campaignId) },
    campaignUpdate,
    { session }
  );

  return {
    campaignWallet,
    ncWallet,
    payout,
    campaignTransaction,
    campaignAutoCompleted,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 3) Refund unspent balance to founder on campaign close.
// ─────────────────────────────────────────────────────────────────────────

export async function refundCampaignToFounder(params: {
  campaignId: string;
  description: string;
  session: ClientSession;
}): Promise<{
  campaignWallet: any;
  storeWallet: any;
  campaignTransaction: any;
  storeTransaction: any;
  refundedUsd: number;
} | null> {
  const { campaignId, description, session } = params;

  const campaignWallet = await CampaignWallet.findOne({
    campaignId: new Types.ObjectId(campaignId),
  }).session(session);
  if (!campaignWallet) {
    return null;
  }

  // Idempotent: closing an already-closed wallet is a no-op
  if (campaignWallet.status === "closed") {
    return null;
  }

  const refundUsd = round2(campaignWallet.balance);

  // Even if balance is 0 we still flip status to closed so the wallet can't
  // be drained further (e.g. by a cron tick that races with archive).
  if (refundUsd <= 0) {
    campaignWallet.status = "closed";
    campaignWallet.lastTransactionAt = new Date();
    await campaignWallet.save({ session });
    return null;
  }

  // 1) Debit CampaignWallet
  const cwBalanceBefore = campaignWallet.balance;
  campaignWallet.balance = 0;
  campaignWallet.totalRefunded = round2(
    campaignWallet.totalRefunded + refundUsd
  );
  campaignWallet.status = "closed";
  campaignWallet.lastTransactionAt = new Date();
  await campaignWallet.save({ session });

  // 2) Credit founder's StoreWallet (lazy create — should exist since they
  //    were debited at lock time, but be defensive)
  let storeWallet = await StoreWallet.findOne({
    userId: campaignWallet.founderId,
    orgId: campaignWallet.orgId,
  }).session(session);
  if (!storeWallet) {
    const created = await StoreWallet.create(
      [
        {
          userId: campaignWallet.founderId,
          orgId: campaignWallet.orgId,
          balance: 0,
          currency: "USD",
        },
      ],
      { session }
    );
    storeWallet = created[0];
  }

  const swBalanceBefore = storeWallet.balance;
  const swBalanceAfter = round2(swBalanceBefore + refundUsd);
  storeWallet.balance = swBalanceAfter;
  storeWallet.lastTransactionAt = new Date();
  await storeWallet.save({ session });

  // 3) Audit rows
  const campaignTransaction = (
    await CampaignWalletTransaction.create(
      [
        {
          campaignWalletId: campaignWallet._id,
          campaignId: new Types.ObjectId(campaignId),
          orgId: campaignWallet.orgId,
          type: "refund",
          direction: "out",
          amount: refundUsd,
          currency: "USD",
          balanceBefore: cwBalanceBefore,
          balanceAfter: 0,
          description,
          relatedUserId: campaignWallet.founderId,
          metadata: { action: "campaign_refund" },
          status: "completed",
        },
      ],
      { session }
    )
  )[0];

  const storeTransaction = (
    await WalletTransaction.create(
      [
        {
          storeWalletId: storeWallet._id,
          walletType: "store",
          userId: campaignWallet.founderId,
          orgId: campaignWallet.orgId,
          type: "credit",
          amount: refundUsd,
          currency: "USD",
          balanceBefore: swBalanceBefore,
          balanceAfter: swBalanceAfter,
          description,
          metadata: { campaignId, action: "campaign_refund" },
          status: "completed",
        },
      ],
      { session }
    )
  )[0];

  // Link both sides
  campaignTransaction.relatedTransactionId = storeTransaction._id;
  storeTransaction.relatedTransactionId = campaignTransaction._id;
  await campaignTransaction.save({ session });
  await storeTransaction.save({ session });

  // Sync the denormalized lockedAmount on the campaign
  await ContentCampaign.updateOne(
    { _id: new Types.ObjectId(campaignId) },
    { $set: { lockedAmount: 0 } },
    { session }
  );

  return {
    campaignWallet,
    storeWallet,
    campaignTransaction,
    storeTransaction,
    refundedUsd: refundUsd,
  };
}

// Helper for callers that want a one-shot refund inside its own session
// (e.g. the archive endpoint). Most callers should pass an existing session
// so the refund commits atomically with whatever else is happening (status
// change on the campaign, etc.).
export async function refundCampaignToFounderInOwnSession(
  campaignId: string,
  description: string
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await refundCampaignToFounder({
      campaignId,
      description,
      session,
    });
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 4) Transfer campaign escrow → a target user's native Store/Affiliate wallet.
//    Like a payout, but to a chosen user + chosen native wallet (not NC).
//    The source is a SHARED escrow pool the caller doesn't personally own, so
//    the route MUST enforce a founder/admin ownership guard before calling.
//
//    Writes (all in the caller's session):
//      · debit CampaignWallet  (bumps totalPaidOut)
//      · credit target StoreWallet | AffiliateWallet
//      · WalletTransaction (destination-side audit, type "transfer")
//      · CampaignWalletTransaction (campaign-side audit, debit/out)
//      · cross-link both audit rows
// ─────────────────────────────────────────────────────────────────────────

export async function transferCampaignToUserWallet(params: {
  campaignId: string;
  targetUserId: string;
  destination: "store" | "affiliate";
  amountCents: number;
  description: string;
  note?: string;
  actorUserId?: string;
  session: ClientSession;
}): Promise<{
  campaignWallet: any;
  destinationWallet: any;
  campaignTransaction: any;
  walletTransaction: any;
}> {
  const {
    campaignId,
    targetUserId,
    destination,
    amountCents,
    description,
    note,
    actorUserId,
    session,
  } = params;

  if (amountCents <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  // Currency guard — V1 USD only (same rule as payouts).
  const campaign = await ContentCampaign.findById(campaignId).session(session);
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  if (campaign.currency && campaign.currency !== "USD") {
    throw new Error(
      `Transfer blocked: campaign currency is ${campaign.currency}. V1 supports USD only.`
    );
  }

  const amountUsd = centsToUsd(amountCents);
  const tuid = new Types.ObjectId(targetUserId);

  // ── 1) Debit CampaignWallet ────────────────────────────────────────
  const campaignWallet = await CampaignWallet.findOne({
    campaignId: new Types.ObjectId(campaignId),
  }).session(session);
  if (!campaignWallet) {
    throw new Error("Campaign wallet not found");
  }
  if (campaignWallet.status !== "active") {
    throw new Error(`Campaign wallet is ${campaignWallet.status}`);
  }
  if (campaignWallet.balance < amountUsd) {
    throw new Error(
      `Insufficient campaign wallet balance. Available: $${campaignWallet.balance.toFixed(
        2
      )}, required: $${amountUsd.toFixed(2)}`
    );
  }

  const cwBefore = campaignWallet.balance;
  const cwAfter = round2(cwBefore - amountUsd);
  campaignWallet.balance = cwAfter;
  campaignWallet.totalPaidOut = round2(campaignWallet.totalPaidOut + amountUsd);
  campaignWallet.lastTransactionAt = new Date();
  await campaignWallet.save({ session });

  // ── 2) Credit destination wallet + write its audit row ─────────────
  let destinationWallet: any;
  let walletTransaction: any;

  if (destination === "store") {
    let sw = await StoreWallet.findOne({
      userId: tuid,
      orgId: campaignWallet.orgId,
    }).session(session);
    if (!sw) {
      const created = await StoreWallet.create(
        [{ userId: tuid, orgId: campaignWallet.orgId, balance: 0, currency: "USD" }],
        { session }
      );
      sw = created[0];
    }
    const before = sw.balance;
    const after = round2(before + amountUsd);
    sw.balance = after;
    sw.lastTransactionAt = new Date();
    await sw.save({ session });
    destinationWallet = sw;

    walletTransaction = (
      await WalletTransaction.create(
        [
          {
            storeWalletId: sw._id,
            walletType: "store",
            userId: tuid,
            orgId: campaignWallet.orgId,
            type: "transfer",
            amount: amountUsd,
            currency: "USD",
            balanceBefore: before,
            balanceAfter: after,
            description,
            note,
            relatedUserId: actorUserId
              ? new Types.ObjectId(actorUserId)
              : undefined,
            metadata: { campaignId, action: "campaign_transfer" },
            status: "completed",
          },
        ],
        { session }
      )
    )[0];
  } else {
    // Affiliate destination — credit FULL amount, no fee. The 5% platform
    // cut now happens at OUTFLOW time (transferAffiliateToStore or
    // withdrawal) rather than at inflow.
    let aw = await AffiliateWallet.findOne({ userId: tuid }).session(session);
    if (!aw) {
      const created = await AffiliateWallet.create(
        [{ userId: tuid, balance: 0, currency: "USD" }],
        { session }
      );
      aw = created[0];
    }
    const before = aw.balance;
    const after = round2(before + amountUsd);
    aw.balance = after;
    aw.lastTransactionAt = new Date();
    await aw.save({ session });
    destinationWallet = aw;

    walletTransaction = (
      await WalletTransaction.create(
        [
          {
            affiliateWalletId: aw._id,
            walletType: "affiliate",
            userId: tuid,
            type: "transfer",
            amount: amountUsd,
            currency: "USD",
            balanceBefore: before,
            balanceAfter: after,
            description,
            note,
            relatedUserId: actorUserId
              ? new Types.ObjectId(actorUserId)
              : undefined,
            metadata: { campaignId, action: "campaign_transfer" },
            status: "completed",
          },
        ],
        { session }
      )
    )[0];
  }

  // ── 3) CampaignWalletTransaction audit row ─────────────────────────
  const campaignTransaction = (
    await CampaignWalletTransaction.create(
      [
        {
          campaignWalletId: campaignWallet._id,
          campaignId: new Types.ObjectId(campaignId),
          orgId: campaignWallet.orgId,
          type: "debit",
          direction: "out",
          amount: amountUsd,
          currency: "USD",
          balanceBefore: cwBefore,
          balanceAfter: cwAfter,
          description,
          relatedUserId: tuid,
          // Clean link: this field has no ref, so storing the WalletTransaction
          // id here is safe.
          relatedTransactionId: walletTransaction._id,
          metadata: { action: "campaign_transfer", destination, note },
          status: "completed",
        },
      ],
      { session }
    )
  )[0];

  // ── 4) Backfill the reverse link on the destination row ────────────
  // WalletTransaction.relatedTransactionId is ref:"WalletTransaction", so we
  // stash the campaign tx id in metadata instead of that field.
  walletTransaction.metadata = {
    ...walletTransaction.metadata,
    campaignTransactionId: campaignTransaction._id,
  };
  await walletTransaction.save({ session });

  return {
    campaignWallet,
    destinationWallet,
    campaignTransaction,
    walletTransaction,
  };
}
