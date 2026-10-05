// src/services/contentRewardsWallet.ts
// Read-only accessors for the founder/affiliate Content Rewards dashboard
// in the Garage Payment Vault.
//
// HISTORY: Originally backed by `ContentRewardsWallet` + `ContentRewardsWalletTransaction`.
// After Option B (shared-DB direct write — see services/campaignWallet.ts),
// payouts no longer touch those collections. Earnings now land in the shared
// `wallets` collection (NC's Wallet model, exposed on Garage as NcWallet) and
// are audited in `CampaignWalletTransaction` rows with `relatedUserId = the affiliate`.
//
// These functions read from the new sources but keep the legacy response
// shape so the existing /wallet/content-rewards/* routes + WalletPageNew
// frontend don't need to change.

import { ClientSession, Types } from "mongoose";
import { NcWallet } from "../models/ncWallet.model";
import { OrgRewardsWallet } from "../models/orgRewardsWallet.model";
import { Organization } from "../models/organization.model";
import { StoreWallet } from "../models/storeWallet.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";

const round2 = (n: number) => Math.round(n * 100) / 100;
const centsToUsd = (cents: number) => round2(cents / 100);

/**
 * Legacy lazy-create helper. Kept as a no-op so any caller that still
 * imports it doesn't break. The new payout path doesn't need a wallet
 * pre-created — NcWallet is upserted inside the payout transaction.
 */
export async function getOrCreateContentRewardsWallet(
  _userId: string,
  _session?: any
): Promise<{ userId: string; balance: number; currency: string }> {
  return { userId: _userId, balance: 0, currency: "USD" };
}

/**
 * Read-only balance for the Payment Vault dashboard.
 *
 * Sums across every org's OrgRewardsWallet for the user — the "all orgs"
 * roll-up the legacy single-card UI used to show. New per-org callers
 * should use `listContentRewardsBalancesForUser` instead. Reads
 * OrgRewardsWallet only (the Garage source of truth) — the legacy
 * NcWallet is NC-owned and no longer consulted post-cutover.
 *
 *   balance        ← Σ OrgRewardsWallet.balance for this user
 *   totalEarnings  ← Σ OrgRewardsWallet.totalEarnings for this user
 *   totalWithdrawn ← Σ OrgRewardsWallet.totalWithdrawn for this user
 */
export async function getContentRewardsWalletBalance(userId: string): Promise<{
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  currency: string;
}> {
  const uid = new Types.ObjectId(userId);

  const orgAgg = await OrgRewardsWallet.aggregate([
    { $match: { userId: uid } },
    {
      $group: {
        _id: null,
        balance: { $sum: "$balance" },
        totalEarnings: { $sum: "$totalEarnings" },
        totalWithdrawn: { $sum: "$totalWithdrawn" },
        rowCount: { $sum: 1 },
      },
    },
  ]);
  const orgTotals = (orgAgg as any[])[0];

  // OrgRewardsWallet is the sole source of truth. Users with no rows show
  // $0 here (their spendable NC-wallet money, if any, is not content-rewards
  // earnings and lives untouched in the NC-owned `wallets` collection).
  return {
    balance: centsToUsd(orgTotals?.balance || 0),
    totalEarnings: centsToUsd(orgTotals?.totalEarnings || 0),
    totalWithdrawn: centsToUsd(orgTotals?.totalWithdrawn || 0),
    currency: "USD",
  };
}

/**
 * Per-org balance for one (user, org). Returns zeros if no wallet exists
 * yet (lazy-create happens on the next credit).
 */
export async function getContentRewardsBalanceForOrg(
  userId: string,
  orgId: string
): Promise<{
  orgId: string;
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  currency: string;
}> {
  const w = await OrgRewardsWallet.findOne({
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
  })
    .select("balance totalEarnings totalWithdrawn")
    .lean();
  return {
    orgId,
    balance: centsToUsd(w?.balance || 0),
    totalEarnings: centsToUsd(w?.totalEarnings || 0),
    totalWithdrawn: centsToUsd(w?.totalWithdrawn || 0),
    currency: "USD",
  };
}

/**
 * Per-org breakdown for one user — one row per org with any content
 * rewards activity. Sorted by orgName ascending. Used by the Vault's
 * Content Rewards tab to render one card per business.
 */
export async function listContentRewardsBalancesForUser(
  userId: string
): Promise<
  Array<{
    orgId: string;
    orgName: string;
    balance: number;
    totalEarnings: number;
    totalWithdrawn: number;
    currency: string;
  }>
> {
  const uid = new Types.ObjectId(userId);
  const rows = await OrgRewardsWallet.find({ userId: uid })
    .select("orgId balance totalEarnings totalWithdrawn")
    .lean();
  if (rows.length === 0) return [];

  // Resolve org names in one round-trip.
  const orgIds = rows.map((r) => r.orgId);
  const orgs = await Organization.find({ _id: { $in: orgIds } })
    .select("name")
    .lean();
  const nameById = new Map(
    (orgs as any[]).map((o) => [String(o._id), o.name as string])
  );

  return rows
    .map((r: any) => ({
      orgId: String(r.orgId),
      orgName: nameById.get(String(r.orgId)) || "Untitled organization",
      balance: centsToUsd(r.balance || 0),
      totalEarnings: centsToUsd(r.totalEarnings || 0),
      totalWithdrawn: centsToUsd(r.totalWithdrawn || 0),
      currency: "USD",
    }))
    .sort((a, b) => a.orgName.localeCompare(b.orgName));
}

/**
 * Paginated content-rewards transactions for the user.
 *
 * Reads OrgRewardsWallet embedded `transactions[]` ledgers only (the Garage
 * source of truth). When `orgId` is given, reads that single org's ledger;
 * otherwise rolls up every org's ledger for the user into one chronological
 * feed. The legacy NcWallet / CampaignWalletTransaction merge is gone —
 * post-cutover those are NC-owned and not consulted for reads.
 */
export async function getContentRewardsWalletTransactions(
  userId: string,
  options: { limit?: number; offset?: number; type?: string; orgId?: string } = {}
): Promise<{ transactions: any[]; total: number }> {
  const { limit = 20, offset = 0, type, orgId } = options;
  const uid = new Types.ObjectId(userId);

  // Gather the embedded ledger(s): one org when scoped, otherwise every
  // OrgRewardsWallet the user has. Each entry keeps its orgId so the
  // synthetic _id stays stable/unique across orgs in the rollup.
  const walletQuery = orgId
    ? { userId: uid, orgId: new Types.ObjectId(orgId) }
    : { userId: uid };
  const wallets = await OrgRewardsWallet.find(walletQuery)
    .select("orgId transactions")
    .lean();

  const allTx: Array<{ tx: any; orgId: string }> = [];
  for (const w of wallets as any[]) {
    const oid = String(w.orgId);
    for (const t of (w.transactions as any[]) || []) allTx.push({ tx: t, orgId: oid });
  }
  // Newest first.
  allTx.sort(
    (a, b) =>
      new Date(b.tx.createdAt).getTime() - new Date(a.tx.createdAt).getTime()
  );

  const filtered = type
    ? allTx.filter(({ tx: t }) => {
        if (type === "credit") return t.type === "credit";
        if (type === "debit") return t.type === "debit" && t.source !== "withdrawal";
        if (type === "withdrawal") return t.source === "withdrawal";
        return true;
      })
    : allTx;

  const paged = filtered
    .slice(offset, offset + limit)
    .map(({ tx: t, orgId: oid }, i: number) => {
      const balanceAfter = centsToUsd(t.balanceAfter || 0);
      const amountUsd = centsToUsd(t.amount || 0);
      const balanceBefore =
        t.type === "credit"
          ? round2(Math.max(0, balanceAfter - amountUsd))
          : round2(balanceAfter + amountUsd);
      return {
        _id: `org-${oid}-${new Date(t.createdAt).getTime()}-${i}`,
        type: t.type,
        amount: amountUsd,
        currency: "USD",
        balanceBefore,
        balanceAfter,
        description: t.description,
        status: "completed",
        source: t.source,
        relatedId: t.relatedId || null,
        campaignId: null,
        submissionId: null,
        relatedPayoutId: null,
        viewsRewarded: null,
        createdAt: t.createdAt,
      };
    });

  return { transactions: paged, total: filtered.length };
}

// ─────────────────────────────────────────────────────────────────────────
// Earner self-transfer: Content Rewards (NcWallet) → own Store/Affiliate wallet.
// Source and destination both key on the SAME userId, so this is safe to call
// for any authenticated user — a user can only move their own money.
// Runs inside the caller's Mongo session for atomicity.
// ─────────────────────────────────────────────────────────────────────────

export async function transferEarningsToUserWallet(params: {
  userId: string;
  orgId: string; // doubles as the source CR org (per-org bucket to debit)
  destination: "store" | "affiliate";
  amountCents: number;
  note?: string;
  session: ClientSession;
}): Promise<{ ncWallet: any; destinationWallet: any; walletTransaction: any }> {
  const { userId, orgId, destination, amountCents, note, session } = params;

  if (amountCents <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const uid = new Types.ObjectId(userId);
  const amountUsd = centsToUsd(amountCents);
  const orgObjId = new Types.ObjectId(orgId);

  // ── 1) Load + debit per-org OrgRewardsWallet ────────────────────────
  // Per-org is the new source of truth. Balance check MUST happen before
  // the $inc — $inc bypasses min:0 and can drive the balance negative.
  const orgWallet = await OrgRewardsWallet.findOne({
    userId: uid,
    orgId: orgObjId,
  }).session(session);
  if (!orgWallet || (orgWallet.balance || 0) < amountCents) {
    throw new Error(
      `Insufficient content rewards balance for this org. Available: $${centsToUsd(
        orgWallet?.balance || 0
      ).toFixed(2)}`
    );
  }
  const orgBalanceAfterCents = orgWallet.balance - amountCents;
  const destLabel = destination === "store" ? "Store" : "Affiliate";
  const txDescription = `Transfer to ${destLabel} wallet`;

  await OrgRewardsWallet.updateOne(
    { _id: orgWallet._id },
    {
      $inc: { balance: -amountCents },
      $push: {
        transactions: {
          $each: [
            {
              type: "debit",
              amount: amountCents,
              balanceAfter: orgBalanceAfterCents,
              source: "self_transfer_to_store",
              description: txDescription,
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

  // ── 1b) Mirror debit on the legacy NcWallet so NC stays in step ────
  const ncWallet = await NcWallet.findOne({ userId: uid }).session(session);
  if (ncWallet && (ncWallet.balance || 0) >= amountCents) {
    const ncBalanceAfterCents = ncWallet.balance - amountCents;
    await NcWallet.updateOne(
      { _id: ncWallet._id },
      {
        $inc: { balance: -amountCents },
        $push: {
          transactions: {
            $each: [
              {
                type: "debit",
                amount: amountCents,
                balanceAfter: ncBalanceAfterCents,
                description: txDescription,
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
    ncWallet.balance = ncBalanceAfterCents;
  }
  // Reflect the new per-org balance on the doc for the caller's response.
  // We keep the field name `ncWallet` in the return for API stability —
  // it's the spendable-balance doc the caller renders. After full cutover,
  // rename to `crWallet` and update the route handler.
  const returnedWallet = { balance: orgBalanceAfterCents };

  // ── 2) Credit the destination wallet + write the audit row ─────────
  let destinationWallet: any;
  let walletTransaction: any;

  if (destination === "store") {
    let sw = await StoreWallet.findOne({ userId: uid, orgId }).session(session);
    if (!sw) {
      const created = await StoreWallet.create(
        [{ userId: uid, orgId, balance: 0, currency: "USD" }],
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
            userId: uid,
            orgId,
            type: "transfer",
            amount: amountUsd,
            currency: "USD",
            balanceBefore: before,
            balanceAfter: after,
            description: "Transfer from Content Rewards",
            note,
            metadata: { source: "content_rewards", action: "earner_transfer" },
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
    let aw = await AffiliateWallet.findOne({ userId: uid }).session(session);
    if (!aw) {
      const created = await AffiliateWallet.create(
        [{ userId: uid, balance: 0, currency: "USD" }],
        { session }
      );
      aw = created[0];
    }
    const before = aw.balance;
    const after = round2(before + amountUsd);
    aw.balance = after;
    // Deliberately NOT touching totalEarnings — a transfer-in is a move, not
    // newly earned commission.
    aw.lastTransactionAt = new Date();
    await aw.save({ session });
    destinationWallet = aw;

    walletTransaction = (
      await WalletTransaction.create(
        [
          {
            affiliateWalletId: aw._id,
            walletType: "affiliate",
            userId: uid,
            type: "transfer",
            amount: amountUsd,
            currency: "USD",
            balanceBefore: before,
            balanceAfter: after,
            description: "Transfer from Content Rewards",
            note,
            metadata: { source: "content_rewards", action: "earner_transfer" },
            status: "completed",
          },
        ],
        { session }
      )
    )[0];
  }

  return { ncWallet: returnedWallet, destinationWallet, walletTransaction };
}
