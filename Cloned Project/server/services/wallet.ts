import { StoreWallet } from "../models/storeWallet.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import { NcWallet } from "../models/ncWallet.model";
import { OrgRewardsWallet } from "../models/orgRewardsWallet.model";
import mongoose from "mongoose";

// Balances are carried to FOUR decimal places, matching the commission engine
// (services/unilevelPlusCommission.ts). Rounding to cents here would silently
// discard the sub-cent part of every level bonus on a small sale base — the
// exact thing four places exists to preserve.
//
// This is an ACCRUAL precision, not a settlement one: withdrawals still leave
// in whole cents (services/withdrawal.ts floors to them), so the remainder
// stays in the balance and rolls into the next payout.
//
// Rounding at all is still necessary: `balance + amount` on IEEE doubles
// produces 1.2200000000000002 without it.
const MONEY_SCALE = 10000;
const round2 = (n: number) => Math.round(n * MONEY_SCALE) / MONEY_SCALE;

// ============================================================================
// Affiliate-wallet outflow fee
// ============================================================================
//
// Any user-initiated transfer OUT of the affiliate wallet (currently only
// `transferAffiliateToStore` — the "Transfer to Store Vault" button) carves
// off a flat 5% platform fee.
//
// NOTE — this is no longer symmetrical with withdrawals. Withdrawal fees are
// now tiered off the user's payout preference (5% / 2% / 0% — see
// config/affiliateWithdrawalFees.ts and services/withdrawal.ts), while this
// transfer route stayed at the flat 5% it has always charged: the fee matrix
// was specified for withdrawals only. So a dollar still leaves the affiliate
// wallet exactly once and is charged exactly once, but what it costs now
// depends on the route — transferring to the Store Vault can be dearer than
// withdrawing. If transfers should follow the same grid, call
// resolveAffiliateFeeTier here; it is deliberately NOT wired up.
//
// Not applied to:
//   - Direct affiliate commission credits — those are earnings already net of
//     the platform's take at the point of sale.
//   - Affiliate-wallet INFLOWS (content_rewards → affiliate, campaign →
//     affiliate) — those are unaffected; the fee only fires on outflow.
//   - `debitAffiliateWallet` invoice-payment path — spending affiliate wallet
//     on invoices doesn't route through Transfer; explicitly out of scope.
//   - Cashback-code redemptions — out of scope.

export const AFFILIATE_OUTFLOW_FEE_PERCENT = 5;

export interface AffiliateOutflowFeeSplit {
  /** What the affiliate wallet is debited (full amount). */
  grossUsd: number;
  /** What the destination wallet actually receives. */
  netUsd: number;
  /** What the platform (Shorupan) collects. */
  feeUsd: number;
  feePct: number;
}

/**
 * Given a gross USD amount being transferred OUT of an affiliate wallet,
 * carve the platform fee and return the split. Rounds each leg to 2dp
 * and guarantees `net + fee === gross` for the ledger.
 */
export function computeAffiliateOutflowFee(
  grossUsd: number,
): AffiliateOutflowFeeSplit {
  const gross = round2(grossUsd);
  const fee = round2((gross * AFFILIATE_OUTFLOW_FEE_PERCENT) / 100);
  // Compute net as (gross - fee) so cent-level rounding on `fee` is
  // absorbed by `net` and the two legs always add back to gross.
  const net = round2(gross - fee);
  return {
    grossUsd: gross,
    netUsd: net,
    feeUsd: fee,
    feePct: AFFILIATE_OUTFLOW_FEE_PERCENT,
  };
}

/**
 * Credit the platform (Shorupan's PLATFORM_ORG_ID StoreWallet) with the
 * fee side of an affiliate-outflow transfer. Meant to be called inside
 * the same DB transaction that debited the affiliate wallet with `gross`
 * and credited the destination wallet with `net`. Writes a WalletTransaction
 * row so the fee appears in the audit ledger under the sender's userId.
 *
 * Safe no-op when feeUsd <= 0. Never throws — logs and returns null on
 * error so a fee-credit failure doesn't roll back the (already successful)
 * main transfer.
 */
export async function creditPlatformAffiliateOutflowFee(params: {
  senderUserId: string;
  feeUsd: number;
  session?: mongoose.ClientSession;
  source: string; // free-form tag: "transfer_to_store", etc.
  description?: string;
  note?: string;
}): Promise<{
  wallet: any;
  transaction: any;
} | null> {
  const { senderUserId, feeUsd, session, source, description, note } = params;
  if (!feeUsd || feeUsd <= 0) return null;

  try {
    const { User } = await import("../models/user.model");
    const { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } = await import(
      "./commission"
    );

    const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
      .select("_id")
      .session(session || null)
      .lean();
    if (!platformUser) {
      console.error(
        "[creditPlatformAffiliateOutflowFee] platform user not found — skipping fee credit",
      );
      return null;
    }

    // Pin currency to USD — cryptobrand orgs auto-provision INR/ETH/BTC
    // siblings for every user (including the platform user in those
    // orgs). A currency-less lookup returns whichever sibling Mongo's
    // {userId,orgId,currency} unique index sorts first (BTC alphabetically),
    // silently misrouting USD credits onto the BTC ledger. Pin explicitly.
    let wallet = await StoreWallet.findOne({
      userId: platformUser._id,
      orgId: PLATFORM_ORG_ID,
      currency: "USD",
    }).session(session || null);
    if (!wallet) {
      const created = await StoreWallet.create(
        [
          {
            userId: platformUser._id,
            orgId: PLATFORM_ORG_ID,
            balance: 0,
            currency: "USD",
          },
        ],
        { session },
      );
      wallet = created[0];
    }

    const before = wallet.balance;
    const after = round2(before + feeUsd);
    wallet.balance = after;
    wallet.lastTransactionAt = new Date();
    await wallet.save({ session });

    const [transaction] = await WalletTransaction.create(
      [
        {
          storeWalletId: wallet._id,
          walletType: "store",
          userId: platformUser._id,
          orgId: PLATFORM_ORG_ID,
          type: "credit",
          amount: feeUsd,
          currency: "USD",
          balanceBefore: before,
          balanceAfter: after,
          description:
            description ||
            `Affiliate transfer processing fee (${AFFILIATE_OUTFLOW_FEE_PERCENT}%)`,
          note,
          relatedUserId: new mongoose.Types.ObjectId(senderUserId),
          metadata: {
            affiliateOutflowFee: {
              kind: source,
              feePct: AFFILIATE_OUTFLOW_FEE_PERCENT,
              feeUsd,
            },
          },
          status: "completed",
        },
      ],
      { session },
    );
    return { wallet, transaction };
  } catch (err) {
    console.error(
      "[creditPlatformAffiliateOutflowFee] failed to credit fee:",
      err,
    );
    return null;
  }
}

// ============= Store Wallet Functions =============

/**
 * Get or create a store wallet for a user in an organization
 */
export async function getOrCreateStoreWallet(
  userId: string,
  orgId: string
): Promise<any> {
  // Pin to USD. Every non-cryptobrand org only has USD; every
  // cryptobrand org has USD as the parent PLUS INR/ETH/BTC siblings.
  // A bare {userId,orgId} query resolves through the unique
  // {userId,orgId,currency} index in ambient sort order (BTC alphabetically
  // first) and returns a sibling instead of the parent — the historical
  // "one wallet per (user, org)" contract this helper implements.
  let wallet = await StoreWallet.findOne({ userId, orgId, currency: "USD" });

  if (!wallet) {
    wallet = await StoreWallet.create({
      userId,
      orgId,
      balance: 0,
      currency: "USD",
    });
  }

  return wallet;
}

/**
 * Get store wallet balance for a user in an organization
 */
export async function getStoreWalletBalance(
  userId: string,
  orgId: string,
  currency: string = "USD"
): Promise<{ balance: number; currency: string } | null> {
  // Pin the currency. Cryptobrand orgs hold INR/ETH/BTC siblings next to the
  // USD parent, and a bare {userId, orgId} match resolves through the
  // {userId, orgId, currency} unique index — where "BTC" sorts first — so this
  // read returned the BTC wallet, not USD. Read-only fix; the credit/debit
  // paths still select their own wallet.
  const wallet = await StoreWallet.findOne({ userId, orgId, currency })
    .select("balance currency")
    .lean();

  return wallet ? { balance: wallet.balance, currency: wallet.currency } : null;
}

/**
 * Get all store wallets for a user across all organizations
 */
export async function getUserStoreWallets(userId: string): Promise<any[]> {
  return await StoreWallet.find({ userId, isActive: true })
    .populate("orgId", "name icon store.name")
    .lean();
}

/**
 * Credit amount to a stakeholder's store wallet (founder only action)
 * Uses MongoDB transaction for atomicity
 */
export async function creditStoreWallet(
  founderId: string,
  stakeholderUserId: string,
  orgId: string,
  amount: number,
  description: string,
  note?: string
): Promise<{ wallet: any; transaction: any }> {
  if (amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get or create wallet — pin USD. Cryptobrand orgs have four
    // sibling wallets; a currency-less lookup picks whichever the
    // unique index sorts first (BTC alphabetically), and this helper's
    // caller contract has always been "credit USD". Without the pin,
    // legacy USD flows silently write to the BTC ledger and the money
    // never surfaces on the user's actual USD balance.
    let wallet = await StoreWallet.findOne({
      userId: stakeholderUserId,
      orgId,
      currency: "USD",
    }).session(session);

    if (!wallet) {
      const created = await StoreWallet.create(
        [
          {
            userId: stakeholderUserId,
            orgId,
            balance: 0,
            currency: "USD",
          },
        ],
        { session }
      );
      wallet = created[0];
    }

    const balanceBefore = wallet!.balance;
    const balanceAfter = balanceBefore + amount;

    // Update wallet balance
    wallet!.balance = balanceAfter;
    wallet!.lastTransactionAt = new Date();
    await wallet!.save({ session });

    // Create transaction record
    const transaction = await WalletTransaction.create(
      [
        {
          storeWalletId: wallet!._id,
          walletType: "store",
          userId: stakeholderUserId,
          orgId,
          type: "credit",
          amount,
          currency: "USD",
          balanceBefore,
          balanceAfter,
          description,
          note,
          relatedUserId: founderId,
          status: "completed",
        },
      ],
      { session }
    ).then((docs) => docs[0]);

    await session.commitTransaction();

    return { wallet, transaction };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Credit a store wallet on behalf of an external partner (third-party API key).
 *
 * Deliberately separate from `creditStoreWallet` above rather than adding
 * parameters to it, for three reasons:
 *
 * 1. **Currency is explicit and required.** `creditStoreWallet` pins USD, which
 *    is right for its callers and wrong here — a partner settling in rupees
 *    would otherwise have INR amounts written onto a USD balance. See the
 *    StoreWallet note in CLAUDE.md: since Aug 2026 uniqueness is
 *    `{userId, orgId, currency}`, and an unpinned lookup resolves to BTC.
 *
 * 2. **It is idempotent.** A partner's job-completion call can be retried by a
 *    queue, a webhook redelivery or a user double-tap. `dedupeKey` is written
 *    into `metadata`, where a unique partial index makes at-most-once a
 *    database guarantee rather than an application promise. A replay returns
 *    the ORIGINAL transaction and does not credit again.
 *
 * 3. **There is no acting user.** `creditStoreWallet` records a founder as
 *    `relatedUserId`; here the actor is a machine, so the client is recorded in
 *    `metadata` instead of pretending a human did it.
 *
 * Money leaving the platform runs through this one function so the guarantees
 * above cannot be half-applied by a future caller.
 */
export async function creditStoreWalletExternal(input: {
  userId: string;
  orgId: string;
  amount: number;
  currency: string;
  description: string;
  /** Stable per credit. A replay with the same key is a no-op. */
  dedupeKey: string;
  /** Which API client asked, for the audit trail. */
  clientId: string;
  clientName: string;
  note?: string;
}): Promise<{ wallet: any; transaction: any; replayed: boolean }> {
  const { userId, orgId, amount, currency, description, dedupeKey } = input;

  if (!(amount > 0)) {
    throw new Error("Amount must be greater than 0");
  }

  // Cheap path for the common replay: a redelivered webhook should not open a
  // transaction to discover it has nothing to do.
  const existing = await WalletTransaction.findOne({
    "metadata.dedupeKey": dedupeKey,
  }).lean();
  if (existing) {
    const w = await StoreWallet.findOne({ userId, orgId, currency }).lean();
    return { wallet: w, transaction: existing, replayed: true };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Currency pinned on BOTH the lookup and the create — an unpinned findOne
    // resolves through the {userId, orgId, currency} index, where "BTC" sorts
    // first, and would silently credit the wrong ledger.
    let wallet = await StoreWallet.findOne({ userId, orgId, currency }).session(
      session
    );

    if (!wallet) {
      const created = await StoreWallet.create(
        [{ userId, orgId, balance: 0, currency }],
        { session }
      );
      wallet = created[0];
    }

    const balanceBefore = wallet!.balance;
    const balanceAfter = round2(balanceBefore + amount);

    wallet!.balance = balanceAfter;
    wallet!.lastTransactionAt = new Date();
    await wallet!.save({ session });

    const transaction = await WalletTransaction.create(
      [
        {
          storeWalletId: wallet!._id,
          walletType: "store",
          userId,
          orgId,
          type: "credit",
          amount,
          currency,
          balanceBefore,
          balanceAfter,
          description,
          note: input.note,
          status: "completed",
          metadata: {
            dedupeKey,
            source: "third-party",
            clientId: input.clientId,
            clientName: input.clientName,
          },
        },
      ],
      { session }
    ).then((docs) => docs[0]);

    await session.commitTransaction();
    return { wallet, transaction, replayed: false };
  } catch (error: any) {
    await session.abortTransaction();

    // Two concurrent replays raced past the pre-check and the unique index
    // caught the loser. That is the index doing its job, not a failure: the
    // credit exists, so report it as a replay rather than an error.
    if (error?.code === 11000) {
      const won = await WalletTransaction.findOne({
        "metadata.dedupeKey": dedupeKey,
      }).lean();
      if (won) {
        const w = await StoreWallet.findOne({ userId, orgId, currency }).lean();
        return { wallet: w, transaction: won, replayed: true };
      }
    }
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Debit amount from store wallet (for future use)
 */
export async function debitStoreWallet(
  userId: string,
  orgId: string,
  amount: number,
  description: string,
  relatedUserId?: string,
  note?: string,
  /**
   * Currency of the wallet to debit. Defaults to USD for backwards
   * compatibility — every legacy caller (whitelabel, cryptosub, office
   * plan, product, course, workshop, etc.) implicitly targets the USD
   * parent wallet. Cryptobrand orgs also have INR/ETH/BTC siblings; pass
   * the currency explicitly to hit those (Investment Products flow).
   */
  currency: string = "USD",
  /**
   * Optional metadata blob to spread onto the WalletTransaction.
   * Historically nothing was ever stamped on the debit side, which
   * left downstream filters (e.g. "show me this user's HiFi investment
   * payments") blind. Callers that know what kind of debit this is
   * (pay-with-wallet on a hifi_investment invoice, direct topup, etc.)
   * can now attach a `kind` + reference IDs. Omitted → unchanged
   * behavior for every legacy caller.
   */
  metadata?: Record<string, any>
): Promise<{ wallet: any; transaction: any }> {
  if (amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = await StoreWallet.findOne({
      userId,
      orgId,
      currency,
    }).session(session);

    if (!wallet) {
      throw new Error(`Store wallet not found (currency=${currency})`);
    }

    if (wallet.balance < amount) {
      throw new Error("Insufficient balance");
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;

    wallet.balance = balanceAfter;
    wallet.lastTransactionAt = new Date();
    await wallet.save({ session });

    const transaction = await WalletTransaction.create(
      [
        {
          storeWalletId: wallet._id,
          walletType: "store",
          userId,
          orgId,
          type: "debit",
          amount,
          currency,
          balanceBefore,
          balanceAfter,
          description,
          note,
          relatedUserId,
          ...(metadata ? { metadata } : {}),
          status: "completed",
        },
      ],
      { session }
    ).then((docs) => docs[0]);

    await session.commitTransaction();

    return { wallet, transaction };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Transfer credits between two users' store wallets within the SAME org.
 * Thin wrapper kept for existing callers (peer same-org transfer, coupon gifts).
 * Uses MongoDB transaction for atomicity — creates linked debit/credit records.
 */
export async function transferStoreCredits(
  senderId: string,
  recipientId: string,
  orgId: string,
  amount: number,
  description?: string
): Promise<{
  senderWallet: any;
  recipientWallet: any;
  senderTransaction: any;
  recipientTransaction: any;
}> {
  return transferStoreCreditsBetweenOrgs(
    senderId,
    recipientId,
    orgId,
    orgId,
    amount,
    description
  );
}

/**
 * Transfer credits from the sender's store wallet (in `senderOrgId`) to the
 * recipient's store wallet (in `recipientOrgId`). When the two orgs match this
 * is a classic same-org transfer; when they differ the sender funds from their
 * current org while the recipient is credited in the destination org they were
 * picked under. Atomic; creates linked debit/credit transaction records.
 */
export async function transferStoreCreditsBetweenOrgs(
  senderId: string,
  recipientId: string,
  senderOrgId: string,
  recipientOrgId: string,
  amount: number,
  description?: string
): Promise<{
  senderWallet: any;
  recipientWallet: any;
  senderTransaction: any;
  recipientTransaction: any;
}> {
  if (amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  // Same user + same org = same wallet, still a no-op. Same user across
  // DIFFERENT orgs is a legitimate move between the user's own store
  // vaults and is now allowed.
  if (senderId === recipientId && senderOrgId === recipientOrgId) {
    throw new Error("Cannot transfer to the same wallet");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Pin USD on both sides. This helper is the legacy USD-only
    // cross-org transfer (the multi-currency variant lives in
    // transferBetweenWallets). Without the pin, cryptobrand orgs
    // return the alphabetically-first sibling (BTC) and USD transfers
    // get mislogged on the wrong ledger.
    const senderWallet = await StoreWallet.findOne({
      userId: senderId,
      orgId: senderOrgId,
      currency: "USD",
    }).session(session);

    if (!senderWallet) {
      throw new Error("Sender store wallet not found");
    }
    if (senderWallet.balance < amount) {
      throw new Error(
        `Insufficient balance. Available: $${senderWallet.balance.toFixed(2)}`
      );
    }

    // Get or create recipient wallet (in the destination org)
    let recipientWallet = await StoreWallet.findOne({
      userId: recipientId,
      orgId: recipientOrgId,
      currency: "USD",
    }).session(session);

    if (!recipientWallet) {
      const created = await StoreWallet.create(
        [{ userId: recipientId, orgId: recipientOrgId, balance: 0, currency: "USD" }],
        { session }
      );
      recipientWallet = created[0];
    }

    // Debit sender
    const senderBalanceBefore = senderWallet.balance;
    const senderBalanceAfter = round2(senderBalanceBefore - amount);
    senderWallet.balance = senderBalanceAfter;
    senderWallet.lastTransactionAt = new Date();
    await senderWallet.save({ session });

    // Credit recipient
    const recipientBalanceBefore = recipientWallet.balance;
    const recipientBalanceAfter = round2(recipientBalanceBefore + amount);
    recipientWallet.balance = recipientBalanceAfter;
    recipientWallet.lastTransactionAt = new Date();
    await recipientWallet.save({ session });

    const txDescription = description || "Store wallet transfer";

    // Create sender (debit) transaction
    const senderTransaction = (
      await WalletTransaction.create(
        [
          {
            storeWalletId: senderWallet._id,
            walletType: "store",
            userId: senderId,
            orgId: senderOrgId,
            type: "transfer",
            amount,
            currency: "USD",
            balanceBefore: senderBalanceBefore,
            balanceAfter: senderBalanceAfter,
            description: txDescription,
            relatedUserId: recipientId,
            status: "completed",
          },
        ],
        { session }
      )
    )[0];

    // Create recipient (credit) transaction
    const recipientTransaction = (
      await WalletTransaction.create(
        [
          {
            storeWalletId: recipientWallet._id,
            walletType: "store",
            userId: recipientId,
            orgId: recipientOrgId,
            type: "transfer",
            amount,
            currency: "USD",
            balanceBefore: recipientBalanceBefore,
            balanceAfter: recipientBalanceAfter,
            description: txDescription,
            relatedUserId: senderId,
            status: "completed",
          },
        ],
        { session }
      )
    )[0];

    // Link the two transactions
    senderTransaction.relatedTransactionId = recipientTransaction._id;
    recipientTransaction.relatedTransactionId = senderTransaction._id;
    await senderTransaction.save({ session });
    await recipientTransaction.save({ session });

    await session.commitTransaction();

    // Fire-and-forget push to the recipient — same pattern as the commission
    // push in creditAffiliateOrPlatform, but dispatched strictly AFTER commit,
    // so no false positive on rollback. Skip self-transfers (moving money
    // between your own store vaults across orgs shouldn't ping you). Pass the
    // caller's raw `description`, not txDescription: the "Store wallet
    // transfer" fallback would just repeat the title.
    if (senderId !== recipientId) {
      (async () => {
        try {
          const [{ sendTransferReceivedPushNotification }, { User }] =
            await Promise.all([
              import("./pushNotification"),
              import("../models/user.model"),
            ]);
          const sender = await User.findById(senderId).select("name profilePicture").lean();
          await sendTransferReceivedPushNotification(recipientId, {
            amount, // whole dollars — store wallets are not in cents
            currency: "USD",
            senderName: (sender as any)?.name || undefined,
            senderId: String(senderId),
            senderAvatar: (sender as any)?.profilePicture || undefined,
            description,
            destination: "store",
            walletDeepLink: "/wallet",
          });
        } catch (err) {
          console.error(
            `[transferStoreCredits] push notify failed for ${recipientId}:`,
            (err as any)?.message || err,
          );
        }
      })();
    }

    return {
      senderWallet,
      recipientWallet,
      senderTransaction,
      recipientTransaction,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Peer transfer where the destination is the recipient's Content Rewards
 * balance for a specific `destinationOrgId`. The sender funds from their
 * store wallet in `senderOrgId` (USD); the recipient is credited in the
 * Garage per-org `OrgRewardsWallet` (cents) and ALSO in the legacy NcWallet
 * (cents) for NC-side compatibility during the cutover period.
 *
 * Atomic: debits the sender's StoreWallet + writes a `transfer` WalletTransaction
 * audit row, and credits both wallets in the same Mongo session.
 */
export async function transferStoreToContentRewards(
  senderId: string,
  recipientId: string,
  senderOrgId: string,
  destinationOrgId: string,
  amount: number,
  description?: string
): Promise<{
  senderWallet: any;
  recipientBalanceCents: number;
  senderTransaction: any;
}> {
  if (amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  if (senderId === recipientId) {
    throw new Error("Cannot transfer to yourself");
  }
  if (!destinationOrgId) {
    throw new Error("destinationOrgId is required for Content Rewards transfer");
  }

  const amountCents = Math.round(amount * 100);
  if (amountCents <= 0) {
    throw new Error("Amount is too small");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Debit sender's store wallet (USD — same sibling-lookup fix
    // as elsewhere in this file; see PLATFORM_ORG_ID comment above).
    const senderWallet = await StoreWallet.findOne({
      userId: senderId,
      orgId: senderOrgId,
      currency: "USD",
    }).session(session);

    if (!senderWallet) {
      throw new Error("Sender store wallet not found");
    }
    if (senderWallet.balance < amount) {
      throw new Error(
        `Insufficient balance. Available: $${senderWallet.balance.toFixed(2)}`
      );
    }

    const senderBalanceBefore = senderWallet.balance;
    const senderBalanceAfter = round2(senderBalanceBefore - amount);
    senderWallet.balance = senderBalanceAfter;
    senderWallet.lastTransactionAt = new Date();
    await senderWallet.save({ session });

    const txDescription = description || "Transfer to Content Rewards wallet";
    const uid = new mongoose.Types.ObjectId(recipientId);
    const destOrgObjId = new mongoose.Types.ObjectId(destinationOrgId);

    const senderTransaction = (
      await WalletTransaction.create(
        [
          {
            storeWalletId: senderWallet._id,
            walletType: "store",
            userId: senderId,
            orgId: senderOrgId,
            type: "transfer",
            amount,
            currency: "USD",
            balanceBefore: senderBalanceBefore,
            balanceAfter: senderBalanceAfter,
            description: txDescription,
            relatedUserId: recipientId,
            metadata: {
              destination: "content_rewards",
              recipientId,
              destinationOrgId,
              amountCents,
            },
            status: "completed",
          },
        ],
        { session }
      )
    )[0];

    // ── Credit recipient's OrgRewardsWallet (per-org, Garage-owned) ──
    let orgWallet = await OrgRewardsWallet.findOne({
      userId: uid,
      orgId: destOrgObjId,
    }).session(session);
    if (!orgWallet) {
      const created = await OrgRewardsWallet.create(
        [
          {
            userId: uid,
            orgId: destOrgObjId,
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
    const orgBalanceAfter = (orgWallet.balance || 0) + amountCents;
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
                source: "store_to_cr_send",
                description: txDescription,
                relatedId: senderTransaction._id,
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

    // ── Mirror credit on the legacy NcWallet for NC compatibility ──
    let ncWallet = await NcWallet.findOne({ userId: uid }).session(session);
    if (!ncWallet) {
      const created = await NcWallet.create(
        [{ userId: uid, balance: 0, debt: 0, transactions: [] }],
        { session }
      );
      ncWallet = created[0];
    }

    const ncBalanceAfter = (ncWallet.balance || 0) + amountCents;
    await NcWallet.updateOne(
      { _id: ncWallet._id },
      {
        $inc: { balance: amountCents },
        $push: {
          transactions: {
            $each: [
              {
                type: "credit",
                amount: amountCents,
                balanceAfter: ncBalanceAfter,
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

    await session.commitTransaction();

    // Fire-and-forget push, after commit — see transferStoreCreditsBetweenOrgs.
    // No self-transfer guard needed: this path throws on senderId === recipientId.
    (async () => {
      try {
        const [{ sendTransferReceivedPushNotification }, { User }] =
          await Promise.all([
            import("./pushNotification"),
            import("../models/user.model"),
          ]);
        const sender = await User.findById(senderId).select("name profilePicture").lean();
        await sendTransferReceivedPushNotification(recipientId, {
          amount, // whole dollars — the cents conversion is wallet-internal
          currency: "USD",
          senderName: (sender as any)?.name || undefined,
          senderId: String(senderId),
          senderAvatar: (sender as any)?.profilePicture || undefined,
          description,
          destination: "content_rewards",
          walletDeepLink: "/wallet",
        });
      } catch (err) {
        console.error(
          `[transferStoreToContentRewards] push notify failed for ${recipientId}:`,
          (err as any)?.message || err,
        );
      }
    })();

    return {
      senderWallet,
      recipientBalanceCents: orgBalanceAfter,
      senderTransaction,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// ============= Affiliate Wallet Functions =============

/**
 * Get or create affiliate wallet for a user
 */
export async function getOrCreateAffiliateWallet(userId: string): Promise<any> {
  let wallet = await AffiliateWallet.findOne({ userId });

  if (!wallet) {
    wallet = await AffiliateWallet.create({
      userId,
      balance: 0,
      currency: "USD",
    });
  }

  return wallet;
}

/**
 * Get affiliate wallet balance for a user
 */
export async function getAffiliateWalletBalance(userId: string): Promise<{
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  currency: string;
} | null> {
  const wallet = await AffiliateWallet.findOne({ userId })
    .select("balance totalEarnings totalWithdrawn currency")
    .lean();

  return wallet
    ? {
        balance: wallet.balance,
        totalEarnings: wallet.totalEarnings,
        totalWithdrawn: wallet.totalWithdrawn,
        currency: wallet.currency,
      }
    : null;
}

/**
 * Get affiliate wallet balance with redemption gating based on Unilevel Plus purchase status.
 * - Not purchased: redeemableBalance = 0, lockedBalance = full balance
 * - Purchased: redeemableBalance = sum of commissions after purchasedAt, lockedBalance = balance - redeemable
 */
export async function getAffiliateWalletBalanceWithGating(userId: string): Promise<{
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  currency: string;
  hasPurchasedUnilevelPlus: boolean;
  purchasedAt: Date | null;
  redeemableBalance: number;
  lockedBalance: number;
  /**
   * Lifetime commission credited and then taken back out — no licence, no
   * NetworkChain subscription, or cascaded to an upline.
   *
   * Distinct from `lockedBalance`, and the two must not be added together
   * blindly. `lockedBalance` is money sitting in the wallet that cannot be
   * spent (including the phantom balances accrued before the licence lock
   * became a visible deduction). `totalForfeited` is money that never stayed
   * at all. Since that change, a new locked commission adds to the SECOND
   * number and not the first, so a "what am I missing out on" figure needs
   * both.
   */
  totalForfeited: number;
}> {
  const [wallet, purchase] = await Promise.all([
    AffiliateWallet.findOne({ userId })
      .select("balance totalEarnings totalWithdrawn currency totalForfeited")
      .lean(),
    UnilevelPlusPurchase.findOne({ userId, status: "active" })
      .select("purchasedAt")
      .lean(),
  ]);

  if (!wallet) {
    return {
      balance: 0,
      totalEarnings: 0,
      totalWithdrawn: 0,
      currency: "USD",
      hasPurchasedUnilevelPlus: !!purchase,
      purchasedAt: purchase?.purchasedAt || null,
      redeemableBalance: 0,
      lockedBalance: 0,
      totalForfeited: 0,
    };
  }

  const base = {
    balance: wallet.balance,
    totalEarnings: wallet.totalEarnings,
    totalWithdrawn: wallet.totalWithdrawn,
    currency: wallet.currency,
    // Absent on wallets written before forfeitures were recorded.
    totalForfeited: (wallet as any).totalForfeited || 0,
  };

  // Platform user (Shorupan) is always unlocked — everything redeemable
  const { User: UserModel } = await import("../models/user.model");
  const user = await UserModel.findById(userId).select("email").lean();
  if (user?.email === PLATFORM_USER_EMAIL) {
    return {
      ...base,
      hasPurchasedUnilevelPlus: true,
      purchasedAt: null,
      redeemableBalance: wallet.balance,
      lockedBalance: 0,
    };
  }

  if (!purchase) {
    // Not every commission is locked any more. Founder comb-plan DIRECT
    // credits are the member's to spend whether or not they hold a licence
    // (services/wallet.ts::creditAffiliateOrPlatform#unlockWithoutLicence),
    // so they are summed here instead of the flat zero this used to return.
    const unlockedAgg = await WalletTransaction.aggregate([
      {
        $match: {
          affiliateWalletId: wallet._id,
          type: "commission",
          status: "completed",
          "metadata.unlockedWithoutLicence": true,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const unlockedTotal = unlockedAgg.length > 0 ? unlockedAgg[0].total : 0;

    // Subtracting `totalWithdrawn` is what stops the same dollar being
    // withdrawn twice: an unlicensed member can only ever have withdrawn
    // unlocked money, because it is the only redeemable kind they have. The
    // balance clamp then covers anything else that moved (a forfeiture, a
    // wallet-funded invoice) without needing to attribute it.
    const redeemableBalance =
      Math.round(
        Math.max(
          0,
          Math.min(unlockedTotal - (wallet.totalWithdrawn || 0), wallet.balance)
        ) * 100
      ) / 100;

    return {
      ...base,
      hasPurchasedUnilevelPlus: false,
      purchasedAt: null,
      redeemableBalance,
      lockedBalance:
        Math.round(Math.max(0, wallet.balance - redeemableBalance) * 100) / 100,
    };
  }

  // Aggregate commissions earned BEFORE the purchase date — these are permanently locked
  //
  // EXCEPT the founder comb-plan direct share. That money was already real and
  // spendable while the member was unlicensed, so sweeping it into the
  // pre-purchase lock would mean buying the licence CONFISCATED earnings they
  // could have withdrawn the day before — punishing the exact upgrade the
  // licence is meant to encourage.
  //
  // Forfeitures are netted off for the same reason they are netted off in the
  // withdrawal-maturity sum: a commission that was credited gross and then
  // taken straight back out is not money sitting in the wallet, so locking
  // against it would confiscate an equal slice of something else the member
  // genuinely owns. Caught by the end-to-end test, where a $0.02 cascaded
  // level bonus was quietly eating $0.02 of an unlocked $1.44 direct share.
  const prePurchaseResult = await WalletTransaction.aggregate([
    {
      $match: {
        affiliateWalletId: wallet._id,
        status: "completed",
        createdAt: { $lte: purchase.purchasedAt },
        $or: [
          {
            type: "commission",
            "metadata.unlockedWithoutLicence": { $ne: true },
          },
          { type: "debit", "metadata.forfeiture": { $exists: true } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [
              { $eq: ["$type", "commission"] },
              "$amount",
              { $multiply: ["$amount", -1] },
            ],
          },
        },
      },
    },
  ]);

  // Floored at 0: a forfeiture taken against an UNLOCKED commission would
  // otherwise subtract a parent that was never added.
  const prePurchaseTotal =
    prePurchaseResult.length > 0 ? Math.max(0, prePurchaseResult[0].total) : 0;
  // Locked = pre-purchase commissions, but never more than current balance
  const lockedBalance = Math.round(Math.min(prePurchaseTotal, wallet.balance) * 100) / 100;
  // Redeemable = whatever is left after locking
  const redeemableBalance = Math.round(Math.max(0, wallet.balance - lockedBalance) * 100) / 100;

  return {
    ...base,
    hasPurchasedUnilevelPlus: true,
    purchasedAt: purchase.purchasedAt,
    redeemableBalance,
    lockedBalance,
  };
}

/**
 * Debit the affiliate wallet (e.g., to pay an invoice using wallet balance).
 * Uses the REDEEMABLE balance (not the total) for the check — only commissions earned
 * after Unilevel Plus purchase can be spent.
 * Atomic via MongoDB session.
 */
export async function debitAffiliateWallet(
  userId: string,
  amount: number,
  description: string,
  note?: string
): Promise<{ wallet: any; transaction: any }> {
  if (amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  // Gate on the SAME rule as a withdrawal — matured (Sunday-cutoff) AND
  // Unilevel-Plus redeemable. Paying an invoice with affiliate funds is
  // economically equivalent to a withdrawal: this week's earnings can't be
  // spent until they mature.
  const { getWithdrawableBalanceCents } = await import("./withdrawal");
  const availableCents = await getWithdrawableBalanceCents(userId, "affiliate");
  const availableUsd = Math.round(availableCents) / 100;
  if (availableUsd < amount) {
    throw new Error(
      `Insufficient withdrawable balance. Available: $${availableUsd.toFixed(2)}`
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = await AffiliateWallet.findOne({ userId }).session(session);
    if (!wallet) {
      throw new Error("Affiliate wallet not found");
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;
    if (balanceAfter < 0) {
      throw new Error("Insufficient balance");
    }

    wallet.balance = balanceAfter;
    wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + amount;
    wallet.lastTransactionAt = new Date();
    await wallet.save({ session });

    const transaction = await WalletTransaction.create(
      [
        {
          affiliateWalletId: wallet._id,
          walletType: "affiliate",
          userId,
          type: "debit",
          amount,
          currency: "USD",
          balanceBefore,
          balanceAfter,
          description,
          note,
          status: "completed",
        },
      ],
      { session }
    ).then((docs) => docs[0]);

    await session.commitTransaction();
    return { wallet, transaction };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Transfer redeemable affiliate balance to the user's own store wallet.
 * Only allowed for users who have purchased Unilevel Plus (redeemable balance > 0).
 * Uses MongoDB transaction for atomicity.
 */
export async function transferAffiliateToStore(
  userId: string,
  orgId: string,
  amount: number,
  description?: string
): Promise<{
  affiliateWallet: any;
  storeWallet: any;
  affiliateTransaction: any;
  storeTransaction: any;
  fee: AffiliateOutflowFeeSplit;
}> {
  if (amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  // Gate on the SAME rule as a withdrawal — matured (Sunday-cutoff) AND
  // Unilevel-Plus redeemable. Moving funds out of the affiliate wallet
  // (transfer or withdrawal) must respect both. Dynamic import to avoid the
  // services/wallet ↔ services/withdrawal circular dependency.
  const { getWithdrawableBalanceCents } = await import("./withdrawal");
  const availableCents = await getWithdrawableBalanceCents(userId, "affiliate");
  const availableUsd = Math.round(availableCents) / 100;
  if (availableUsd < amount) {
    throw new Error(
      `Insufficient withdrawable balance. Available: $${availableUsd.toFixed(2)}`
    );
  }

  // Carve the 5% outflow fee. Affiliate is debited GROSS; destination store
  // receives NET; platform (Shorupan's PLATFORM_ORG_ID StoreWallet) receives
  // FEE. See file-top comment block for rationale.
  const fee = computeAffiliateOutflowFee(amount);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Debit affiliate wallet by GROSS
    const affiliateWallet = await AffiliateWallet.findOne({ userId }).session(
      session
    );
    if (!affiliateWallet) {
      throw new Error("Affiliate wallet not found");
    }

    const affBalanceBefore = affiliateWallet.balance;
    const affBalanceAfter = round2(affBalanceBefore - fee.grossUsd);
    if (affBalanceAfter < 0) {
      throw new Error("Insufficient balance");
    }

    affiliateWallet.balance = affBalanceAfter;
    affiliateWallet.totalWithdrawn =
      (affiliateWallet.totalWithdrawn || 0) + fee.grossUsd;
    affiliateWallet.lastTransactionAt = new Date();
    await affiliateWallet.save({ session });

    // Credit store wallet (USD parent — same sibling-lookup fix as
    // elsewhere in this file). Affiliate→Store transfer has always
    // been a USD-only credit.
    let storeWallet = await StoreWallet.findOne({ userId, orgId, currency: "USD" }).session(
      session
    );
    if (!storeWallet) {
      const created = await StoreWallet.create(
        [{ userId, orgId, balance: 0, currency: "USD" }],
        { session }
      );
      storeWallet = created[0];
    }

    const storeBalanceBefore = storeWallet.balance;
    const storeBalanceAfter = round2(storeBalanceBefore + fee.netUsd);
    storeWallet.balance = storeBalanceAfter;
    storeWallet.lastTransactionAt = new Date();
    await storeWallet.save({ session });

    const affDescription =
      description ||
      `Transfer to Store Vault (before ${fee.feePct}% fee)`;
    const storeDescription = `Transfer from Affiliate to Store Vault (net after ${fee.feePct}% fee)`;

    // Create affiliate (debit) transaction — GROSS
    const affiliateTransaction = (
      await WalletTransaction.create(
        [
          {
            affiliateWalletId: affiliateWallet._id,
            walletType: "affiliate",
            userId,
            type: "transfer",
            amount: fee.grossUsd,
            currency: "USD",
            balanceBefore: affBalanceBefore,
            balanceAfter: affBalanceAfter,
            description: affDescription,
            status: "completed",
            metadata: {
              outflowFee: {
                grossUsd: fee.grossUsd,
                netUsd: fee.netUsd,
                feeUsd: fee.feeUsd,
                feePct: fee.feePct,
              },
            },
          },
        ],
        { session }
      )
    )[0];

    // Create store (credit) transaction — NET
    const storeTransaction = (
      await WalletTransaction.create(
        [
          {
            storeWalletId: storeWallet._id,
            walletType: "store",
            userId,
            orgId,
            type: "transfer",
            amount: fee.netUsd,
            currency: "USD",
            balanceBefore: storeBalanceBefore,
            balanceAfter: storeBalanceAfter,
            description: storeDescription,
            status: "completed",
            metadata: {
              outflowFee: {
                grossUsd: fee.grossUsd,
                netUsd: fee.netUsd,
                feeUsd: fee.feeUsd,
                feePct: fee.feePct,
              },
            },
          },
        ],
        { session }
      )
    )[0];

    // Link the two transactions
    affiliateTransaction.relatedTransactionId = storeTransaction._id;
    storeTransaction.relatedTransactionId = affiliateTransaction._id;
    await affiliateTransaction.save({ session });
    await storeTransaction.save({ session });

    // Credit the platform (Shorupan) with the fee. Same session so the
    // whole thing rolls back together if anything downstream throws.
    await creditPlatformAffiliateOutflowFee({
      senderUserId: userId,
      feeUsd: fee.feeUsd,
      session,
      source: "transfer_to_store",
    });

    await session.commitTransaction();

    return {
      affiliateWallet,
      storeWallet,
      affiliateTransaction,
      storeTransaction,
      fee,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// Platform configuration for routing locked earnings
const PLATFORM_USER_EMAIL = "shorupan@gmail.com";

/**
 * The platform account's _id, or null if it somehow isn't provisioned.
 *
 * The terminus of the NetworkChain coverage walk. Returns null rather than
 * throwing: a missing platform user must not fail a commission the earner had
 * already qualified for — the forfeited half is simply not forwarded, which is
 * loud in the ledger and recoverable, unlike a rolled-back payout.
 */
async function resolvePlatformUserId(): Promise<string | null> {
  const { User } = await import("../models/user.model");
  const platform = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id")
    .lean();
  return platform ? String(platform._id) : null;
}
const PLATFORM_ORG_ID = "68f1fe05876fcc5fadb61951";

/**
 * Label a credit that reached someone by being passed up the chain.
 *
 * Idempotent, because money can hop twice: a founder-plan bonus cascades from
 * an unlicensed member to a licensed upline, and if THAT upline has no
 * NetworkChain subscription half of it is forwarded again. Appending blindly
 * produced "Level 1 network bonus (forwarded — upline share) (forwarded —
 * upline share)" on the member's statement.
 */
const forwardedLabel = (description: string) =>
  description.includes("(forwarded")
    ? description
    : `${description} (forwarded — upline share)`;

/**
 * Credit affiliate wallet with commission, routing actual money to Shorupan if recipient
 * has NOT purchased the Unilevel Plus Plan.
 *
 * - If recipient HAS an active UP purchase: money stays in their affiliate wallet (real).
 * - If recipient has NOT purchased: affiliate wallet still shows the credit (visual),
 *   but the actual money goes to Shorupan's StoreWallet.
 *
 * Works within an existing MongoDB session for transactional safety.
 */
export async function creditAffiliateOrPlatform(params: {
  recipientUserId: string;
  amount: number;
  currency: string;
  description: string;
  note?: string;
  relatedUserId?: string;
  metadata?: any;
  session: mongoose.ClientSession;
  /**
   * Skip the NetworkChain coverage split for this credit.
   *
   * Set on the second leg of a split so it cannot split again, and available to
   * any caller paying something that is not an affiliate commission.
   */
  skipNetworkChainSplit?: boolean;
  /**
   * FOUNDER COMB-PLAN DIRECT SHARE — real money without a $25 licence.
   *
   * The one commission a member keeps whatever their status: the founder set
   * this percentage out of their own margin, and the direct share was agreed
   * to be unlocked. Suppresses the platform lock and marks the row
   * `metadata.unlockedWithoutLicence` so the redeemable gate
   * (`getAffiliateWalletBalanceWithGating`) counts it as spendable and exempts
   * it from the pre-purchase lock.
   *
   * Only ever set by the founder comb-plan path — never by a licence sale,
   * NetworkChain, White Label, Cryptosub or Founders Office.
   */
  unlockWithoutLicence?: boolean;
  /**
   * FOUNDER COMB-PLAN NON-DIRECT POSITION held by an unlicensed member.
   *
   * They cannot keep it, but it must not become platform revenue either: it
   * cascades to their nearest upline holding a licence, and if the chain has
   * none it is reported back via `founderReturnAmount` so the founder keeps
   * it. Either way the member sees the full credit and a labelled deduction,
   * rather than a number that silently never arrived.
   */
  cascadeToLicensedUpline?: boolean;
  /**
   * What the "commission earned" push should announce, when that differs from
   * the amount credited.
   *
   * Used by the NetworkChain split: the member is now credited GROSS and
   * debited the forfeited half separately, so without this they would be told
   * they earned $9.00 and then find $4.50. The ledger shows both legs; the
   * notification should show what they keep.
   */
  notifyAmount?: number;
}): Promise<{
  affiliateWallet: any;
  transaction: any;
  routedToPlatform: boolean;
  /** Present only when the coverage split actually fired. */
  networkChainSplit?: {
    recipientAmount: number;
    forfeitedAmount: number;
    /** Who received the forfeited half. Null means the platform did. */
    forfeitedToUserId: string | null;
  };
  /**
   * Founder comb-plan money the cascade could not place — no licensed upline
   * anywhere in the chain. The caller adds it to its unspent total so it stays
   * with the founder. Absent unless `cascadeToLicensedUpline` was set.
   */
  founderReturnAmount?: number;
  /**
   * Present when the founder cascade actually fired, i.e. the member was
   * credited and then relieved of the whole amount.
   *
   * The distribution record must stamp `creditedAmount: 0` from this, because
   * `getUPCommissionStats` reports from that field rather than the wallet —
   * without it a member would be shown as having earned every cascaded bonus
   * they never kept.
   */
  founderCascade?: { forfeitedAmount: number; toUserId: string | null };
}> {
  const {
    recipientUserId,
    amount,
    currency,
    description,
    note,
    relatedUserId,
    metadata,
    session,
    skipNetworkChainSplit = false,
    unlockWithoutLicence = false,
    cascadeToLicensedUpline = false,
    notifyAmount,
  } = params;

  // Platform user (Shorupan) is always unlocked — no purchase needed
  const { User: UserModel } = await import("../models/user.model");
  const recipientUser = await UserModel.findById(recipientUserId)
    .select("email")
    .lean();
  const isPlatformUser = recipientUser?.email === PLATFORM_USER_EMAIL;

  let hasPurchased = isPlatformUser;
  if (!isPlatformUser) {
    const purchase = await UnilevelPlusPurchase.findOne({
      userId: recipientUserId,
      status: "active",
    })
      .select("_id")
      .lean();
    hasPurchased = !!purchase;
  }

  // Whether the real money is seized by the platform. Historically this was
  // simply `!hasPurchased`. Founder comb plans carve out both exceptions:
  // the direct share is the member's to keep, and every other position they
  // hold cascades to a licensed upline (or back to the founder) instead.
  const routeToPlatform =
    !hasPurchased && !unlockWithoutLicence && !cascadeToLicensedUpline;

  // ── NetworkChain coverage split ────────────────────────────────────────
  //
  // A commission earner who is NOT covered by a live NetworkChain subscription
  // keeps HALF; the other half travels up the referral chain to the first
  // covered upline, and to the platform if there is none.
  //
  // ORDER MATTERS, and it is licence-first by design: a recipient with no
  // active $25 licence falls through to the block below, which sends the WHOLE
  // amount to the platform as it always has. Splitting first would hand a
  // licence-less earner a real half they never used to get — adding a
  // requirement would have made them better off.
  //
  // The forfeited half is paid by RECURSING into this same function. That is
  // deliberate: the upline still has to pass the licence check, and because the
  // upline is covered by definition the recursion cannot split again. The
  // `skipNetworkChainSplit` guard makes that explicit rather than relying on it.
  // `unlockWithoutLicence` opts out too: it was agreed that founder comb-plan
  // direct does not depend on NetworkChain for ANYONE, so a member holding the
  // $25 but not the $36 keeps all of this one rather than half.
  if (!skipNetworkChainSplit && !unlockWithoutLicence && hasPurchased && amount > 0) {
    const { getNetworkChainCoveredUsers, findCoveredUpline } = await import(
      "./networkChainCoverage"
    );
    const covered = await getNetworkChainCoveredUsers();

    if (!covered.has(String(recipientUserId))) {
      // Half-cent rounding goes to the RECIPIENT, not the platform: on an odd
      // cent the earner should not be the one who loses it.
      const { splitForfeiture, recordForfeiture } = await import(
        "./commissionForfeiture"
      );
      const { keep, forfeited } = splitForfeiture(amount, 0.5);

      const uplineId = await findCoveredUpline(recipientUserId, covered);

      // Credit the member the FULL amount, then take the forfeited half back
      // out as its own labelled row.
      //
      // The net balance is identical to crediting `keep` directly, which is
      // what this used to do. What changed is that the deduction now exists:
      // previously the member simply received a smaller number, and the half
      // they lost lived only in a `note` string and a metadata blob — nothing
      // that could be totalled, labelled, or explained back to them.
      // `notifyAmount` keeps the push announcing what they keep.
      const kept = await creditAffiliateOrPlatform({
        ...params,
        amount,
        notifyAmount: keep,
        description,
        note,
        metadata: {
          ...(metadata || {}),
          networkChainSplit: {
            role: "retained",
            originalAmount: amount,
            forfeitedAmount: forfeited,
            forfeitedToUserId: uplineId,
          },
        },
        skipNetworkChainSplit: true,
      });

      if (forfeited > 0) {
        await recordForfeiture({
          affiliateWallet: kept.affiliateWallet,
          userId: recipientUserId,
          amount: forfeited,
          grossAmount: amount,
          reason: "no_networkchain",
          currency,
          ofTransactionId: kept.transaction?._id,
          // Null only when the chain has no covered upline; the platform is
          // the terminus there, as it has always been.
          toUserId: uplineId,
          relatedUserId,
          dedupeKey: metadata?.dedupeKey,
          metadata: { ...(metadata || {}), originalDescription: description },
          session,
        });
      }

      if (forfeited > 0) {
        // No covered upline — the platform is the terminus. Crediting the
        // platform THROUGH this function keeps one ledger shape for both
        // outcomes; the platform always passes the licence check.
        const target = uplineId || (await resolvePlatformUserId());
        if (target) {
          await creditAffiliateOrPlatform({
            ...params,
            recipientUserId: target,
            amount: forfeited,
            description: forwardedLabel(description),
            note: `Forwarded from a member with no active NetworkChain subscription`,
            metadata: {
              ...(metadata || {}),
              // Distinct key or the two legs collide on the partial unique
              // index that makes these credits replay-safe.
              ...(metadata?.dedupeKey
                ? { dedupeKey: `${metadata.dedupeKey}_ncsplit_upline` }
                : {}),
              networkChainSplit: {
                role: "forwarded",
                originalAmount: amount,
                fromUserId: String(recipientUserId),
                viaUpline: !!uplineId,
              },
            },
            skipNetworkChainSplit: true,
          });
        }
      }

      return {
        affiliateWallet: kept.affiliateWallet,
        transaction: kept.transaction,
        routedToPlatform: kept.routedToPlatform,
        networkChainSplit: {
          recipientAmount: keep,
          forfeitedAmount: forfeited,
          forfeitedToUserId: uplineId,
        },
      };
    }
  }

  // Get or create affiliate wallet
  let affiliateWallet = await AffiliateWallet.findOne({
    userId: recipientUserId,
  }).session(session);

  if (!affiliateWallet) {
    const created = await AffiliateWallet.create(
      [
        {
          userId: recipientUserId,
          balance: 0,
          totalEarnings: 0,
          totalWithdrawn: 0,
          currency,
        },
      ],
      { session }
    );
    affiliateWallet = created[0];
  }

  // Always update affiliate wallet visually (balance + totalEarnings)
  const balanceBefore = affiliateWallet.balance;
  const balanceAfter = balanceBefore + amount;
  affiliateWallet.balance = balanceAfter;
  affiliateWallet.totalEarnings = (affiliateWallet.totalEarnings || 0) + amount;
  affiliateWallet.lastTransactionAt = new Date();
  await affiliateWallet.save({ session });

  // Create affiliate wallet transaction (always visible to recipient)
  const transaction = await WalletTransaction.create(
    [
      {
        affiliateWalletId: affiliateWallet._id,
        walletType: "affiliate",
        userId: recipientUserId,
        type: "commission",
        amount,
        currency,
        balanceBefore,
        balanceAfter,
        description,
        note,
        relatedUserId: relatedUserId
          ? new mongoose.Types.ObjectId(relatedUserId)
          : undefined,
        metadata: {
          ...metadata,
          routedToPlatform: routeToPlatform,
          // Read by getAffiliateWalletBalanceWithGating to treat this row as
          // spendable with no licence, and to keep it out of the pre-purchase
          // lock if the member later buys one.
          ...(unlockWithoutLicence ? { unlockedWithoutLicence: true } : {}),
        },
        status: "completed",
      },
    ],
    { session }
  ).then((docs) => docs[0]);

  // ── Founder comb-plan cascade ──────────────────────────────────────────
  //
  // The member has been credited in full above; now take it back out with a
  // labelled deduction and hand it to the first upline who holds a licence.
  // Nothing found → report it to the caller, which keeps it with the founder.
  //
  // Runs only for an UNLICENSED member: a licensed one simply keeps the money,
  // which is the whole point of holding the licence.
  let founderReturnAmount: number | undefined;
  let founderCascade: { forfeitedAmount: number; toUserId: string | null } | undefined;
  if (cascadeToLicensedUpline && !hasPurchased && amount > 0) {
    const { getUnilevelPlusLicensedUsers, findLicensedUpline } = await import(
      "./networkChainCoverage"
    );
    const licensed = await getUnilevelPlusLicensedUsers();
    const uplineId = await findLicensedUpline(recipientUserId, licensed);

    const { recordForfeiture } = await import("./commissionForfeiture");
    await recordForfeiture({
      affiliateWallet,
      userId: recipientUserId,
      amount,
      grossAmount: amount,
      reason: uplineId ? "cascade_to_upline" : "no_licence",
      currency,
      ofTransactionId: transaction._id,
      toUserId: uplineId,
      relatedUserId,
      dedupeKey: metadata?.dedupeKey,
      metadata: { ...(metadata || {}), originalDescription: description },
      session,
    });

    if (uplineId) {
      await creditAffiliateOrPlatform({
        ...params,
        recipientUserId: uplineId,
        description: forwardedLabel(description),
        note: "Forwarded from a member with no Unilevel Plus licence",
        metadata: {
          ...(metadata || {}),
          ...(metadata?.dedupeKey
            ? { dedupeKey: `${metadata.dedupeKey}_cascade_upline` }
            : {}),
          founderCascade: {
            role: "forwarded",
            fromUserId: String(recipientUserId),
          },
        },
        // The upline holds a licence by construction, so this cannot cascade
        // again; saying so explicitly beats relying on that invariant.
        cascadeToLicensedUpline: false,
        unlockWithoutLicence: false,
      });
    } else {
      // Chain exhausted. Deliberately NOT the platform — see the note on
      // getUnilevelPlusLicensedUsers.
      founderReturnAmount = amount;
    }
    founderCascade = { forfeitedAmount: amount, toUserId: uplineId };
  }

  // ── The licence lock, as a visible deduction ───────────────────────────
  //
  // This used to write the SAME dollar into two wallets: the member's
  // affiliate balance rose by the full amount (a number they could never
  // touch) while the real money went to the platform. The balance was
  // fiction, the two ledgers double-counted, and the member had no record of
  // what they had actually lost — only a big greyed-out figure.
  //
  // Now the gross credit above is followed by a deduction for the same
  // amount, so the balance reflects what they really have (nothing from this
  // commission) and `totalForfeited` accumulates what holding no licence has
  // cost them. The platform credit below is unchanged — same destination,
  // same amount.
  //
  // FORWARD ONLY. Balances accrued before this shipped are left exactly as
  // they are and keep displaying as locked; nothing is rewritten or written
  // down.
  if (routeToPlatform && amount > 0) {
    const { recordForfeiture } = await import("./commissionForfeiture");
    await recordForfeiture({
      affiliateWallet,
      userId: recipientUserId,
      amount,
      grossAmount: amount,
      reason: "no_licence",
      currency,
      ofTransactionId: transaction._id,
      // The platform is the destination here — this is NOT the founder
      // cascade, which applies only to founder comb plans.
      toUserId: null,
      relatedUserId,
      dedupeKey: metadata?.dedupeKey,
      metadata: { ...(metadata || {}), originalDescription: description },
      session,
    });
  }

  // If NOT purchased, route the actual money to Shorupan's StoreWallet
  if (routeToPlatform) {
    const platformUser = await UserModel.findOne({
      email: PLATFORM_USER_EMAIL,
    })
      .select("_id")
      .lean();

    if (platformUser) {
      const platformUserId = platformUser._id.toString();

      let platformWallet = await StoreWallet.findOne({
        userId: platformUserId,
        orgId: new mongoose.Types.ObjectId(PLATFORM_ORG_ID),
      }).session(session);

      if (!platformWallet) {
        const created = await StoreWallet.create(
          [
            {
              userId: platformUserId,
              orgId: new mongoose.Types.ObjectId(PLATFORM_ORG_ID),
              balance: 0,
              currency,
            },
          ],
          { session }
        );
        platformWallet = created[0];
      }

      const platBalanceBefore = platformWallet.balance;
      const platBalanceAfter = platBalanceBefore + amount;
      platformWallet.balance = platBalanceAfter;
      platformWallet.lastTransactionAt = new Date();
      await platformWallet.save({ session });

      await WalletTransaction.create(
        [
          {
            storeWalletId: platformWallet._id,
            walletType: "store",
            userId: platformUserId,
            orgId: new mongoose.Types.ObjectId(PLATFORM_ORG_ID),
            type: "credit",
            amount,
            currency,
            balanceBefore: platBalanceBefore,
            balanceAfter: platBalanceAfter,
            description: `Locked commission: ${description}`,
            note: `Affiliate commission held from non-activated user`,
            relatedUserId: relatedUserId
              ? new mongoose.Types.ObjectId(relatedUserId)
              : undefined,
            metadata: {
              ...metadata,
              // Suffix the caller's dedupeKey so this platform-lock tx
              // doesn't collide with the visible affiliate tx above —
              // both writes must be independently idempotent, but the
              // partial-unique index on metadata.dedupeKey doesn't
              // allow the same value twice. Bug surfaced by the
              // whitelabel commission credits where L2+ recipients
              // often haven't purchased UP: the affiliate write
              // succeeds with dedupeKey X, the platform-lock write
              // tries the same X and E11000s, aborting the whole
              // session.withTransaction and rolling back the credit.
              ...(metadata?.dedupeKey
                ? { dedupeKey: `${metadata.dedupeKey}_platform_lock` }
                : {}),
              lockedFromUserId: recipientUserId,
              originalDescription: description,
            },
            status: "completed",
          },
        ],
        { session }
      );
    }
  }

  // Fire-and-forget push notification to the recipient. Skip the
  // platform user (Shorupan) — every commission credits some slice to
  // the platform account and pushing him for each one would be pure
  // noise. Also skip when amount ≤ 0 (defensive; shouldn't happen).
  //
  // Runs outside the transaction — if the caller's session rolls back
  // after this returns, the push is a false positive. Rare in
  // practice, and the trade-off is worth it: a job queue for reliable
  // post-commit dispatch is out of scope for now. See
  // services/pushNotification.ts::sendCommissionEarnedPushNotification.
  //
  // A cascaded credit is suppressed: the member was credited and debited in
  // the same breath, so "you earned $1.15" would be a notification about
  // money they no longer have. The deduction is visible in their ledger,
  // which is the honest place for it.
  // Suppressed whenever the member ends up with none of it: a cascade, or a
  // commission seized by the licence lock. "You earned $9.00" is false when
  // the balance did not move, and it used to be sent on every locked
  // commission purely because the phantom balance made it look true.
  const cascadedAway = cascadeToLicensedUpline && !hasPurchased;
  const keptNothing = cascadedAway || routeToPlatform;
  const announceAmount = notifyAmount ?? amount;
  if (!isPlatformUser && announceAmount > 0 && !keptNothing) {
    (async () => {
      try {
        const { sendCommissionEarnedPushNotification } = await import(
          "./pushNotification"
        );
        await sendCommissionEarnedPushNotification(recipientUserId, {
          amount: announceAmount,
          currency,
          description,
          // Callers pass `metadata.unit: "whole"` when the amount is
          // in whole units (rank-bonus does this — dollars, not cents).
          // Standard commissions omit this and default to smallest-unit
          // (cents/paise). Getting this wrong shows "$0.40" instead of
          // "$40.00" on the notification.
          unit: metadata?.unit === "whole" ? "whole" : "smallest",
          level:
            typeof metadata?.level === "number"
              ? metadata.level
              : undefined,
          routedToPlatform: routeToPlatform,
          // App-internal route, not a URL: the mobile tap handler refuses
          // anything that doesn't start with '/' and falls back to the wallet.
          // Sent from here so a future payout type can point somewhere more
          // specific without waiting on an app release.
          walletDeepLink: "/wallet",
        });
      } catch (err) {
        console.error(
          `[creditAffiliateOrPlatform] push notify failed for ${recipientUserId}:`,
          (err as any)?.message || err,
        );
      }
    })();
  }

  return {
    affiliateWallet,
    transaction,
    routedToPlatform: routeToPlatform,
    ...(founderReturnAmount !== undefined ? { founderReturnAmount } : {}),
    ...(founderCascade ? { founderCascade } : {}),
  };
}

/**
 * Add commission to affiliate wallet (for future commission logic)
 */
export async function addCommission(
  userId: string,
  amount: number,
  description: string,
  relatedUserId?: string,
  metadata?: any
): Promise<{ wallet: any; transaction: any }> {
  if (amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let wallet = await AffiliateWallet.findOne({ userId }).session(session);

    if (!wallet) {
      const created = await AffiliateWallet.create(
        [
          {
            userId,
            balance: 0,
            totalEarnings: 0,
            totalWithdrawn: 0,
            currency: "USD",
          },
        ],
        { session }
      );
      wallet = created[0];
    }

    const balanceBefore = wallet!.balance;
    const balanceAfter = balanceBefore + amount;

    wallet!.balance = balanceAfter;
    wallet!.totalEarnings = (wallet!.totalEarnings || 0) + amount;
    wallet!.lastTransactionAt = new Date();
    await wallet!.save({ session });

    const transaction = await WalletTransaction.create(
      [
        {
          affiliateWalletId: wallet!._id,
          walletType: "affiliate",
          userId,
          type: "commission",
          amount,
          currency: "USD",
          balanceBefore,
          balanceAfter,
          description,
          relatedUserId,
          metadata,
          status: "completed",
        },
      ],
      { session }
    ).then((docs) => docs[0]);

    await session.commitTransaction();

    return { wallet, transaction };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// ============= Transaction History Functions =============

/**
 * Get transaction history for a store wallet
 */
export async function getStoreWalletTransactions(
  userId: string,
  orgId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: string;
    /**
     * Which sibling wallet's ledger to read. Cryptobrand orgs hold
     * one wallet per currency (USD parent + INR/ETH/BTC siblings)
     * and each has its own independent balance + transaction stream.
     * Defaults to "USD" — the parent, and the only wallet a non-
     * cryptobrand org has. Callers that want a specific sibling
     * MUST pass `currency` explicitly.
     *
     * See the note in getStoreWalletBalance on why this must be
     * explicit (a bare {userId, orgId} match resolves through the
     * {userId, orgId, currency} unique index in an undefined order,
     * often returning the wrong wallet).
     */
    currency?: string;
  } = {}
): Promise<{ transactions: any[]; total: number }> {
  const { limit = 20, offset = 0, type, currency = "USD" } = options;
  const currencyUpper = String(currency).toUpperCase();

  // `currency=ALL` — unified ledger across every sibling wallet the
  // caller holds in this org. Powers the OTC desk's cross-currency
  // History view, which was previously forced to pick one currency
  // tab because offset pagination cannot correctly merge N
  // per-currency streams client-side. Each returned row still carries
  // its own `currency`, so the FE can render mixed rows in one list.
  if (currencyUpper === "ALL") {
    const wallets = await StoreWallet.find({
      userId,
      orgId,
      isActive: true,
    })
      .select("_id")
      .lean<Array<{ _id: any }>>();
    if (wallets.length === 0) {
      return { transactions: [], total: 0 };
    }
    const walletIds = wallets.map((w) => w._id);
    const filter: any = { storeWalletId: { $in: walletIds } };
    if (type) filter.type = type;
    const [transactions, total] = await Promise.all([
      WalletTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("relatedUserId", "name email profilePicture")
        .lean(),
      WalletTransaction.countDocuments(filter),
    ]);
    return { transactions, total };
  }

  // .toUpperCase() at the query site as well — belt + braces with the
  // schema-side normalisation in the route, so any service caller that
  // bypasses the route (internal reuse) still gets a case-safe match.
  const wallet = await StoreWallet.findOne({
    userId,
    orgId,
    currency: currencyUpper,
  }).lean();
  if (!wallet) {
    return { transactions: [], total: 0 };
  }

  const filter: any = { storeWalletId: wallet._id };
  if (type) {
    filter.type = type;
  }

  const [transactions, total] = await Promise.all([
    WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("relatedUserId", "name email profilePicture")
      .lean(),
    WalletTransaction.countDocuments(filter),
  ]);

  return { transactions, total };
}

/**
 * Get transaction history for affiliate wallet
 */
export async function getAffiliateWalletTransactions(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: string;
  } = {}
): Promise<{ transactions: any[]; total: number }> {
  const { limit = 20, offset = 0, type } = options;

  const wallet = await AffiliateWallet.findOne({ userId }).lean();
  if (!wallet) {
    return { transactions: [], total: 0 };
  }

  const filter: any = { affiliateWalletId: wallet._id };
  if (type === "cashback") {
    // Cashback payouts aren't a distinct transaction type — they're `debit`
    // rows tagged with metadata.source === "cashback" (see cashbackCode.ts).
    filter["metadata.source"] = "cashback";
  } else if (type) {
    filter.type = type;
  }

  const [transactions, total] = await Promise.all([
    WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("relatedUserId", "name email profilePicture")
      .lean(),
    WalletTransaction.countDocuments(filter),
  ]);

  // A forwarded NetworkChain split carries the BUYER as `relatedUserId` (the
  // credit inherits the original sale's params), so on its own the upline
  // can't tell whose share they received. Resolve the forfeiting member's
  // name — name only, no email — in one query for the whole page.
  const fromIds = new Set<string>();
  for (const tx of transactions as any[]) {
    const split = tx.metadata?.networkChainSplit;
    if (split?.role === "forwarded" && split.fromUserId) {
      fromIds.add(String(split.fromUserId));
    }
  }
  if (fromIds.size > 0) {
    const { User: UserModel } = await import("../models/user.model");
    const users = await UserModel.find({ _id: { $in: [...fromIds] } })
      .select("name")
      .lean();
    const names = new Map(users.map((u: any) => [String(u._id), u.name]));
    for (const tx of transactions as any[]) {
      const split = tx.metadata?.networkChainSplit;
      if (split?.role === "forwarded" && split.fromUserId) {
        const id = String(split.fromUserId);
        split.fromUser = { _id: id, name: names.get(id) || null };
      }
    }
  }

  return { transactions, total };
}

/**
 * Get all wallets for a user (both store and affiliate).
 * Auto-creates store wallets for any org the user belongs to that doesn't have one yet.
 */
export async function getAllUserWallets(userId: string): Promise<{
  storeWallets: any[];
  affiliateWallet: any | null;
}> {
  const { User: UserModel } = await import("../models/user.model");
  const user = await UserModel.findById(userId)
    .select("organizations")
    .lean();

  // Auto-create the USD parent wallet for every org the user belongs to.
  const orgIds = (user?.organizations || []).map(
    (m: any) => m.organization?.toString?.() || m.organization
  );
  if (orgIds.length > 0) {
    await Promise.all(
      orgIds.map((orgId: string) => getOrCreateStoreWallet(userId, orgId))
    );

    // For cryptobrand orgs, also ensure the INR/ETH/BTC sibling wallets
    // exist so the multi-currency FE selector can render them. The
    // helper is a no-op on non-cryptobrand orgs.
    const { ensureCryptobrandWallets } = await import(
      "./cryptobrandWallets"
    );
    await Promise.all(
      orgIds.map((orgId: string) =>
        ensureCryptobrandWallets(userId, orgId).catch((err) => {
          console.warn(
            `[getAllUserWallets] ensureCryptobrandWallets failed userId=${userId} orgId=${orgId}:`,
            err?.message || err,
          );
        }),
      ),
    );
  }

  const [storeWallets, affiliateWallet] = await Promise.all([
    StoreWallet.find({ userId, isActive: true })
      .populate("orgId", "name icon store.name store.slug officeCreatedFromCryptobrand")
      .lean(),
    AffiliateWallet.findOne({ userId }).lean(),
  ]);

  return { storeWallets, affiliateWallet };
}

/**
 * Get all stakeholders' store wallets for an organization (founder use)
 */
export async function getOrgStoreWallets(
  orgId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ wallets: any[]; total: number }> {
  const { limit = 50, offset = 0 } = options;

  const [wallets, total] = await Promise.all([
    StoreWallet.find({ orgId, isActive: true })
      .populate("userId", "name email profilePicture")
      .sort({ balance: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    StoreWallet.countDocuments({ orgId, isActive: true }),
  ]);

  return { wallets, total };
}

// ============= Founder Wallet Credit Functions =============

import { User } from "../models/user.model";

/**
 * Find the founder of an organization
 */
export async function getOrgFounder(orgId: string): Promise<string | null> {
  // Try new organizations array first
  const founderFromOrgs = await User.findOne({
    "organizations.organization": new mongoose.Types.ObjectId(orgId),
    "organizations.role": "founder",
  })
    .select("_id")
    .lean();

  if (founderFromOrgs) {
    return founderFromOrgs._id.toString();
  }

  // Fallback to legacy single organization field
  const founderLegacy = await User.findOne({
    organization: new mongoose.Types.ObjectId(orgId),
    role: "founder",
  })
    .select("_id")
    .lean();

  return founderLegacy ? founderLegacy._id.toString() : null;
}

// Import models for purchase history
import { CourseEnrollment } from "../models/courseEnrollment.model";
import { Course } from "../models/course.model";
import { ProductOrder } from "../models/productOrder.model";
import { CallPurchase } from "../models/callPurchase.model";

/**
 * Get user's purchase history (combined courses and products)
 */
export async function getUserPurchaseHistory(
  userId: string,
  orgId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: "all" | "course" | "product" | "call";
  } = {}
): Promise<{
  purchases: any[];
  total: number;
}> {
  const { limit = 20, offset = 0, type = "all" } = options;

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const orgObjectId = new mongoose.Types.ObjectId(orgId);

  // Collect all purchases
  let purchases: any[] = [];

  // Get course enrollments (paid only)
  if (type === "all" || type === "course") {
    const courseEnrollments = await CourseEnrollment.find({
      userId: userObjectId,
      organizationId: orgObjectId,
      isPaid: true,
    })
      .populate({
        path: "courseId",
        select: "title coverImage createdBy",
        populate: { path: "createdBy", select: "name profilePicture" },
      })
      .sort({ enrolledAt: -1 })
      .lean();

    // Transform course enrollments into unified purchase format
    for (const enrollment of courseEnrollments) {
      const course = enrollment.courseId as any;
      if (course) {
        purchases.push({
          _id: enrollment._id,
          type: "course",
          itemId: course._id,
          itemName: course.title,
          itemImage: course.coverImage,
          amount: enrollment.amountPaid || 0,
          currency: enrollment.currency || "INR",
          status: enrollment.paymentStatus || "completed",
          paymentId: enrollment.paymentId,
          seller: course.createdBy,
          createdAt: enrollment.enrolledAt,
          metadata: {
            enrollmentStatus: enrollment.status,
            progressPercentage: enrollment.progressPercentage,
          },
        });
      }
    }
  }

  // Get product orders
  if (type === "all" || type === "product") {
    const productOrders = await ProductOrder.find({
      userId: userObjectId,
      organizationId: orgObjectId,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Transform product orders into unified purchase format
    for (const order of productOrders) {
      purchases.push({
        _id: order._id,
        type: "product",
        orderNumber: order.orderNumber,
        items: order.items,
        itemName:
          order.items.length === 1
            ? order.items[0].productName
            : `${order.items.length} items`,
        itemImage: order.items[0]?.productImage,
        amount: order.total,
        currency: order.currency,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentId: order.paymentId,
        createdAt: order.createdAt,
        metadata: {
          subtotal: order.subtotal,
          discount: order.discount,
          tax: order.tax,
          shippingCost: order.shippingCost,
          requiresShipping: order.requiresShipping,
          trackingNumber: order.trackingNumber,
          trackingUrl: order.trackingUrl,
        },
      });
    }
  }

  // Get call purchases
  if (type === "all" || type === "call") {
    const callPurchases = await CallPurchase.find({
      userId: userObjectId,
      organizationId: orgObjectId,
      paymentStatus: "completed",
    })
      .populate({
        path: "callOfferingId",
        select: "title coverImage duration createdBy",
        populate: { path: "createdBy", select: "name profilePicture" },
      })
      .sort({ purchasedAt: -1 })
      .lean();

    // Transform call purchases into unified purchase format
    for (const purchase of callPurchases) {
      const callOffering = purchase.callOfferingId as any;
      if (callOffering) {
        purchases.push({
          _id: purchase._id,
          type: "call",
          itemId: callOffering._id,
          itemName: callOffering.title,
          itemImage: callOffering.coverImage,
          amount: purchase.totalAmount,
          currency: purchase.currency || "INR",
          status: purchase.paymentStatus,
          paymentId: purchase.paymentId,
          seller: callOffering.createdBy,
          createdAt: purchase.purchasedAt,
          metadata: {
            quantityPurchased: purchase.quantityPurchased,
            quantityUsed: purchase.quantityUsed,
            quantityRemaining: purchase.quantityRemaining,
            quantityScheduled: purchase.quantityScheduled,
            duration: callOffering.duration,
          },
        });
      }
    }
  }

  // Sort all purchases by date (newest first)
  purchases.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const total = purchases.length;

  // Apply pagination
  purchases = purchases.slice(offset, offset + limit);

  return { purchases, total };
}

// ============= Store Wallet Top-up =============

// Inclusive cents bounds matching the user-confirmed $1–$10,000 range.
export const STORE_WALLET_TOPUP_MIN_CENTS = 100;
export const STORE_WALLET_TOPUP_MAX_CENTS = 1_000_000;

/**
 * Issue an invoice that, when paid, credits `amountCents` USD to the
 * caller's per-org StoreWallet for `orgId`. Uses the existing invoice +
 * payment + fulfillment plumbing — same `payUrl` flow as every other
 * checkout. No coupons, no commission distribution, no UP routing. The
 * fulfillment branch in `fulfillInvoice` reads `metadata.kind === "topup"`
 * and credits the wallet via `creditStoreWallet`.
 *
 * Validations:
 *   - amount must be in [$1, $10,000]
 *   - caller must be a member of `orgId` (any role — top-up is buyer-side)
 */
export async function createStoreWalletTopupInvoice(params: {
  userId: string;
  orgId: string;
  amountCents: number;
  customerEmail?: string;
  customerName?: string;
}): Promise<{ invoice: any; payUrl: string }> {
  const { userId, orgId, amountCents } = params;

  if (
    !Number.isInteger(amountCents) ||
    amountCents < STORE_WALLET_TOPUP_MIN_CENTS ||
    amountCents > STORE_WALLET_TOPUP_MAX_CENTS
  ) {
    throw new Error(
      `Top-up amount must be between $${(STORE_WALLET_TOPUP_MIN_CENTS / 100).toFixed(
        2
      )} and $${(STORE_WALLET_TOPUP_MAX_CENTS / 100).toFixed(2)}`
    );
  }

  const { User } = await import("../models/user.model");
  const { Organization } = await import("../models/organization.model");

  const user = await User.findById(userId)
    .select("email name organizations")
    .lean();
  if (!user) throw new Error("User not found");

  const isMember = (user as any).organizations?.some(
    (m: any) => String(m.organization) === String(orgId)
  );
  if (!isMember) {
    throw new Error("You are not a member of this organization");
  }

  const org = await Organization.findById(orgId).select("name").lean();
  if (!org) throw new Error("Organization not found");

  // Use the org founder as the sellerId so the invoice has a non-null seller
  // record. The fulfillment doesn't pay them — it just credits the buyer's
  // wallet — but the field is required upstream.
  const founder = await User.findOne({
    "organizations.organization": new mongoose.Types.ObjectId(orgId),
    "organizations.role": "founder",
  })
    .select("_id")
    .sort({ "organizations.joinedAt": 1 })
    .lean();
  const sellerId = (founder as any)?._id?.toString() || userId; // fallback: self-sell

  const customerEmail =
    params.customerEmail || (user as any).email || undefined;
  if (!customerEmail) {
    throw new Error("Customer email is required for top-up");
  }

  const { createInvoice } = await import("./invoice");

  const orgName = (org as any).name || "Organization";

  const invoice = await createInvoice({
    organizationId: orgId,
    sellerId,
    userId,
    customerEmail,
    customerName: params.customerName || (user as any).name || undefined,
    lineItems: [
      {
        itemType: "store_wallet_topup",
        itemId: orgId, // the destination org for the credit
        itemName: `Top up Store Wallet · ${orgName}`,
        itemDescription: `Add $${(amountCents / 100).toFixed(
          2
        )} to your Store Wallet for ${orgName}`,
        quantity: 1,
        unitPrice: amountCents,
        originalCurrency: "USD",
      },
    ],
    itemCurrency: "USD",
    metadata: {
      kind: "topup",
      topupKind: "store_wallet",
      topupOrgId: orgId,
      topupOrgName: orgName,
    },
  });

  // The FE's standard payment flow takes over from here. We hand back a
  // canonical pay URL so the caller can redirect immediately. The
  // invoice payment page lives at `/invoice/[invoiceId]` (same route
  // the third-party invoice flow returns) — the previous `/checkout/X`
  // landed on the product-type catalog router (`app/checkout/product/`,
  // `app/checkout/channel/`, etc.), which doesn't match a Mongo id and
  // showed users "Invalid Invitation."
  const frontendBase = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  const payUrl = `${frontendBase}/invoice/${invoice._id}`;

  return { invoice, payUrl };
}

// ============================================================================
// Multi-currency wallet transfer (cryptobrand offices)
// ============================================================================
//
// One atomic transaction moves value from any of my currency wallets to
// any target wallet (mine or someone else's, same or different org),
// converting between currencies at live spot when the sides differ.
// Powers `POST /wallet/store/convert` (self) and `POST /wallet/store/transfer-multi`
// (cross-user).
//
// Both legs (debit + credit) run inside a single mongoose transaction —
// either both succeed or neither does. FX rate captured once at debit
// time and stamped on both `WalletTransaction` rows.
//
// See CRYPTOBRAND_OFFICE_APIS.md for the full external contract.

export class WalletTransferError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface TransferBetweenWalletsResult {
  fromWallet: {
    userId: string;
    orgId: string;
    currency: string;
    balanceBefore: number;
    balanceAfter: number;
    amountDebited: number;
  };
  toWallet: {
    userId: string;
    orgId: string;
    currency: string;
    balanceBefore: number;
    balanceAfter: number;
    amountCredited: number;
  };
  fx: {
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    path: string[];
    capturedAt: Date;
  };
  /** Present on every result. `amount: 0` when no fee applied. */
  fee: {
    feeBps: number;
    currency: string;
    /** Total fee charged, before any comp-plan split. */
    amount: number;
    /** What was actually converted after the fee came out. */
    netConverted: number;
    sourceOrgId: string;
    beneficiaryUserId: string | null;
    beneficiaryOrgId: string | null;
    /** % of the fee routed to the Unilevel Plus tree. 0 = none. */
    compPlanPercentage: number;
    founderShare: number;
    compPlanShare: number;
    /** Outcome of the post-commit tree payout. null when no comp plan,
     *  or when settlement failed (check logs — it is replayable). */
    compPlan: {
      distributedUsd: number;
      recipients: number;
      unspentUsd: number;
      refundedToFounder: number;
    } | null;
  };
  transactionIds: { debit: string; credit: string; fee?: string };
  transferGroupId: string;
}

export async function transferBetweenWallets(params: {
  fromUserId: string;
  fromOrgId: string;
  fromCurrency: string;
  toUserId: string;
  toOrgId: string;
  toCurrency: string;
  amount: number;
  description: string;
  note?: string;
  dedupeKey?: string;
}): Promise<TransferBetweenWalletsResult> {
  const {
    fromUserId,
    fromOrgId,
    fromCurrency,
    toUserId,
    toOrgId,
    toCurrency,
    amount,
    description,
    note,
    dedupeKey,
  } = params;

  const {
    TRANSFERABLE_CURRENCIES,
    convertBetween,
  } = await import("./cryptoFxRate");
  const { ensureCryptobrandWallets } = await import("./cryptobrandWallets");
  const { Organization } = await import("../models/organization.model");

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new WalletTransferError(
      "INVALID_AMOUNT",
      "amount must be a positive number",
    );
  }
  const from = String(fromCurrency).toUpperCase();
  const to = String(toCurrency).toUpperCase();
  if (!TRANSFERABLE_CURRENCIES.includes(from as any)) {
    throw new WalletTransferError(
      "UNSUPPORTED_CURRENCY",
      `fromCurrency "${from}" is not supported. Supported: ${TRANSFERABLE_CURRENCIES.join(", ")}`,
    );
  }
  if (!TRANSFERABLE_CURRENCIES.includes(to as any)) {
    throw new WalletTransferError(
      "UNSUPPORTED_CURRENCY",
      `toCurrency "${to}" is not supported. Supported: ${TRANSFERABLE_CURRENCIES.join(", ")}`,
    );
  }
  if (
    fromUserId === toUserId &&
    fromOrgId === toOrgId &&
    from === to
  ) {
    throw new WalletTransferError(
      "IDENTICAL_ENDPOINTS",
      "source and destination wallets are identical — nothing to transfer",
    );
  }

  // ── Conversion fee ───────────────────────────────────────────────
  // Charged on the SELL side, in the currency being sold, BEFORE FX
  // (see services/conversionFee.ts for why). The sending org's
  // schedule always applies on a cross-org move: the sender pays, and
  // the receiver is never deducted.
  //
  // This sits here, inside the one function every convert/transfer
  // path funnels through, so the fee moves in the SAME transaction as
  // the trade. An earlier attempt sequenced it as two calls from a
  // caller, and a failure in between meant a conversion happened for
  // free with no way to unwind.
  const { resolveFee, computeFee, isFeeExempt, splitFeeForCompPlan } =
    await import("./conversionFee");
  let feeBreakdown = { feeBps: 0, amount: 0, net: amount, gross: amount };
  let feeBeneficiaryUserId: string | null = null;
  // How the collected fee is divided: what the founder keeps vs what
  // goes to the Unilevel Plus tree.
  let feeSplit = { founderShare: 0, compPlanShare: 0 };
  let compPlanId: string | null = null;

  const resolvedFee = await resolveFee(fromOrgId, from, to);
  if (resolvedFee.feeBps > 0) {
    const { findOrgFounderId } = await import("./hifiInvoiceFulfillment");
    const founderId = await findOrgFounderId(fromOrgId);
    if (!founderId) {
      // Converting for free would silently lose the org money. Fail
      // loudly instead — the schedule says to charge and we cannot.
      throw new WalletTransferError(
        "FEE_WALLET_UNAVAILABLE",
        `Org ${fromOrgId} charges a conversion fee but has no founder to receive it`,
        409,
      );
    }
    if (isFeeExempt(fromUserId, founderId)) {
      // A founder converting their own funds would pay themselves —
      // the money leaves and returns, netting zero while cluttering
      // the ledger. Skip it.
    } else {
      feeBeneficiaryUserId = founderId;
      feeBreakdown = computeFee(amount, resolvedFee.feeBps);
      feeSplit = { founderShare: feeBreakdown.amount, compPlanShare: 0 };

      // Optional comp plan: a percentage OF THE FEE routed through the
      // Unilevel Plus tree. Resolved BEFORE the transaction so that an
      // org with no active plan simply leaves the whole fee with the
      // founder, rather than carving out a slice with nowhere to go.
      if (resolvedFee.compPlanPercentage > 0 && feeBreakdown.amount > 0) {
        const { getActiveUnilevelPlusPlan } = await import(
          "./unilevelPlusCommission"
        );
        const upPlan = await getActiveUnilevelPlusPlan();
        if (upPlan) {
          compPlanId = String((upPlan as any)._id);
          feeSplit = splitFeeForCompPlan(
            feeBreakdown.amount,
            resolvedFee.compPlanPercentage,
          );
        } else {
          console.warn(
            `[conversionFee] org ${fromOrgId} has compPlanPercentage set but there is no active Unilevel Plus plan — founder keeps the whole fee`,
          );
        }
      }
    }
  }

  // FX conversion — throws if the price feed is unreachable. Caller
  // maps that to a 503.
  //
  // Prices the NET, not the gross: the fee was taken off the sell side
  // above, so only what remains is converted.
  let fx: Awaited<ReturnType<typeof convertBetween>>;
  try {
    fx = await convertBetween(feeBreakdown.net, from as any, to as any);
  } catch (err) {
    throw new WalletTransferError(
      "FX_FEED_UNAVAILABLE",
      `Live FX rate unavailable: ${(err as Error).message}. Try again in a moment.`,
      503,
    );
  }

  // Materialize destination sibling wallets on a cryptobrand org so a
  // BTC/ETH credit doesn't fail because the recipient never had the
  // sibling created. No-op on non-cryptobrand orgs.
  try {
    await ensureCryptobrandWallets(toUserId, toOrgId);
  } catch {
    // Ignore — the createOrThrow-during-credit below will surface a
    // clearer error if the wallet still doesn't exist.
  }

  const transferGroupId = new mongoose.Types.ObjectId().toString();
  const session = await mongoose.startSession();
  let debitTx: any;
  let creditTx: any;
  let feeTx: any;
  let sourceWalletSnapshot!: {
    balanceBefore: number;
    balanceAfter: number;
    walletId: any;
  };
  let destWalletSnapshot!: {
    balanceBefore: number;
    balanceAfter: number;
    walletId: any;
  };

  try {
    await session.withTransaction(async () => {
      // ── Debit leg ────────────────────────────────────────────────
      const fromWallet: any = await StoreWallet.findOne({
        userId: fromUserId,
        orgId: fromOrgId,
        currency: from,
      }).session(session);
      if (!fromWallet) {
        throw new WalletTransferError(
          "WALLET_NOT_FOUND",
          `Source wallet not found for user ${fromUserId} / org ${fromOrgId} / currency ${from}`,
        );
      }
      // Precision guard: compare to 8-decimal rounded value so a
      // 0.00000001 float artefact doesn't nudge us over the balance.
      const roundedAmount = Math.round(amount * 1e8) / 1e8;
      const fromBalanceRounded = Math.round(fromWallet.balance * 1e8) / 1e8;
      if (fromBalanceRounded < roundedAmount) {
        throw new WalletTransferError(
          "INSUFFICIENT_BALANCE",
          `Source wallet balance ${fromBalanceRounded} < requested ${roundedAmount} ${from}`,
        );
      }
      const debitBefore = fromWallet.balance;
      const debitAfter = Math.round((debitBefore - amount) * 1e8) / 1e8;
      fromWallet.balance = debitAfter;
      fromWallet.lastTransactionAt = new Date();
      await fromWallet.save({ session });
      sourceWalletSnapshot = {
        balanceBefore: debitBefore,
        balanceAfter: debitAfter,
        walletId: fromWallet._id,
      };

      // ── Credit leg ───────────────────────────────────────────────
      let toWallet: any = await StoreWallet.findOne({
        userId: toUserId,
        orgId: toOrgId,
        currency: to,
      }).session(session);
      if (!toWallet) {
        // For USD (the parent), auto-create — every user gets one in
        // any org they interact with. For sibling currencies
        // (INR/ETH/BTC), auto-create ONLY when the org is a
        // cryptobrand office (ensureCryptobrandWallets above should
        // have already handled this; this is a defensive fallback).
        if (to === "USD") {
          const created = await StoreWallet.create(
            [
              {
                userId: toUserId,
                orgId: toOrgId,
                balance: 0,
                currency: "USD",
              },
            ],
            { session },
          );
          toWallet = created[0];
        } else {
          const org = await Organization.findById(toOrgId)
            .select("officeCreatedFromCryptobrand")
            .session(session)
            .lean();
          if (!org?.officeCreatedFromCryptobrand) {
            throw new WalletTransferError(
              "WALLET_NOT_FOUND",
              `Destination wallet ${to} not available on org ${toOrgId} (not a cryptobrand office)`,
            );
          }
          // Cryptobrand ensure should have created it — if not, race
          // with concurrent traffic. Retry once inside the txn.
          const created = await StoreWallet.create(
            [
              {
                userId: toUserId,
                orgId: toOrgId,
                balance: 0,
                currency: to,
              },
            ],
            { session },
          );
          toWallet = created[0];
        }
      }
      const creditBefore = toWallet.balance;
      const creditAfter =
        Math.round((creditBefore + fx.converted) * 1e8) / 1e8;
      toWallet.balance = creditAfter;
      toWallet.lastTransactionAt = new Date();
      await toWallet.save({ session });
      destWalletSnapshot = {
        balanceBefore: creditBefore,
        balanceAfter: creditAfter,
        walletId: toWallet._id,
      };

      // ── Ledger rows ─────────────────────────────────────────────
      // Two rows — one on each wallet — linked by transferGroupId so
      // audit tooling can pair them without querying by user/time.
      const commonMetadata: Record<string, any> = {
        kind: fromUserId === toUserId ? "wallet_convert" : "wallet_transfer_multi",
        transferGroupId,
        fx: {
          from,
          to,
          rate: fx.rate,
          path: fx.path,
          capturedAt: fx.capturedAt,
        },
        counterparty: {
          userId: fromUserId === toUserId ? undefined : toUserId,
          orgId: toOrgId,
          currency: to,
        },
      };
      // Preserve the caller's original dedupeKey verbatim on both rows
      // for audit / replay lookups, but stamp the per-leg index key
      // (`metadata.dedupeKey`) with a `_debit` / `_credit` suffix so
      // the partial-unique index doesn't treat the two legs of the
      // SAME transfer as duplicates of each other.
      //
      // Idempotency semantics are unchanged: a repeat call with the
      // same base key still collides on the first (debit) insert
      // with `${key}_debit`, which surfaces as DUPLICATE_DEDUPE_KEY
      // via the E11000 handler below.
      if (dedupeKey) commonMetadata.originalDedupeKey = dedupeKey;

      const [debitDoc] = await WalletTransaction.create(
        [
          {
            storeWalletId: sourceWalletSnapshot.walletId,
            walletType: "store",
            userId: fromUserId,
            orgId: fromOrgId,
            type: "debit",
            amount,
            currency: from,
            balanceBefore: sourceWalletSnapshot.balanceBefore,
            balanceAfter: sourceWalletSnapshot.balanceAfter,
            description,
            note,
            relatedUserId:
              fromUserId === toUserId ? undefined : new mongoose.Types.ObjectId(toUserId),
            metadata: {
              ...commonMetadata,
              leg: "debit",
              ...(dedupeKey ? { dedupeKey: `${dedupeKey}_debit` } : {}),
              counterparty: {
                ...commonMetadata.counterparty,
                userId:
                  fromUserId === toUserId ? undefined : toUserId,
              },
            },
            status: "completed",
          },
        ],
        { session },
      );
      debitTx = debitDoc;

      const [creditDoc] = await WalletTransaction.create(
        [
          {
            storeWalletId: destWalletSnapshot.walletId,
            walletType: "store",
            userId: toUserId,
            orgId: toOrgId,
            type: "credit",
            amount: fx.converted,
            currency: to,
            balanceBefore: destWalletSnapshot.balanceBefore,
            balanceAfter: destWalletSnapshot.balanceAfter,
            description,
            note,
            relatedUserId:
              fromUserId === toUserId ? undefined : new mongoose.Types.ObjectId(fromUserId),
            metadata: {
              ...commonMetadata,
              leg: "credit",
              ...(dedupeKey ? { dedupeKey: `${dedupeKey}_credit` } : {}),
              counterparty: {
                userId:
                  fromUserId === toUserId ? undefined : fromUserId,
                orgId: fromOrgId,
                currency: from,
              },
            },
            status: "completed",
          },
        ],
        { session },
      );
      creditTx = creditDoc;

      // ── Fee leg ─────────────────────────────────────────────────
      // Third row, same transaction. If this fails the debit and
      // credit roll back with it — that atomicity is the whole reason
      // the fee lives in Garage rather than in a caller.
      if (feeSplit.founderShare > 0 && feeBeneficiaryUserId) {
        let feeWallet: any = await StoreWallet.findOne({
          userId: feeBeneficiaryUserId,
          orgId: fromOrgId,
          currency: from,
        }).session(session);
        if (!feeWallet) {
          // A missing fee wallet must never fail a customer's
          // conversion — create it the way the credit leg already
          // auto-creates destination wallets.
          const [created] = await StoreWallet.create(
            [
              {
                userId: feeBeneficiaryUserId,
                orgId: fromOrgId,
                currency: from,
                balance: 0,
                isActive: true,
              },
            ],
            { session },
          );
          feeWallet = created;
        }
        const feeBefore = feeWallet.balance;
        const feeAfter =
          Math.round((feeBefore + feeSplit.founderShare) * 1e8) / 1e8;
        feeWallet.balance = feeAfter;
        feeWallet.lastTransactionAt = new Date();
        await feeWallet.save({ session });

        const [feeDoc] = await WalletTransaction.create(
          [
            {
              storeWalletId: feeWallet._id,
              walletType: "store",
              userId: feeBeneficiaryUserId,
              orgId: fromOrgId,
              type: "credit",
              amount: feeSplit.founderShare,
              currency: from,
              balanceBefore: feeBefore,
              balanceAfter: feeAfter,
              description: `Conversion fee ${from} \u2192 ${to}`,
              relatedUserId: new mongoose.Types.ObjectId(fromUserId),
              status: "completed",
              metadata: {
                // Distinct kind: without it a founder's ledger shows
                // unexplained credits and the earnings report has
                // nothing to filter on.
                kind: "wallet_conversion_fee",
                transferGroupId,
                leg: "fee",
                ...(dedupeKey ? { dedupeKey: `${dedupeKey}_fee` } : {}),
                ...(dedupeKey ? { originalDedupeKey: dedupeKey } : {}),
                fee: {
                  feeBps: feeBreakdown.feeBps,
                  grossAmount: feeBreakdown.gross,
                  netAmount: feeBreakdown.net,
                  currency: from,
                  // Full fee collected, and how it was divided.
                  totalFee: feeBreakdown.amount,
                  founderShare: feeSplit.founderShare,
                  compPlanShare: feeSplit.compPlanShare,
                  compPlanPercentage: resolvedFee.compPlanPercentage,
                },
                counterparty: {
                  userId: fromUserId,
                  orgId: fromOrgId,
                  currency: from,
                },
                fx: {
                  from,
                  to,
                  rate: fx.rate,
                  path: fx.path,
                  capturedAt: fx.capturedAt,
                },
              },
            },
          ],
          { session },
        );
        feeTx = feeDoc;

        // Stamp the breakdown on the payer's own debit row too, so
        // their ledger can explain where the difference went without
        // joining to a row on a wallet they cannot read.
        await WalletTransaction.updateOne(
          { _id: debitTx._id },
          {
            $set: {
              "metadata.fee": {
                feeBps: feeBreakdown.feeBps,
                amount: feeBreakdown.amount,
                netAmount: feeBreakdown.net,
                currency: from,
                beneficiaryUserId: feeBeneficiaryUserId,
              },
            },
          },
          { session },
        );
      }
    });
  } catch (err: any) {
    if (err instanceof WalletTransferError) throw err;
    if (err?.code === 11000) {
      // Dedupe collision — either leg's insert hit the
      // metadata.dedupeKey partial-unique index. Surface as a stable
      // error the caller can treat as "already applied."
      throw new WalletTransferError(
        "DUPLICATE_DEDUPE_KEY",
        "A transfer with this dedupeKey already succeeded.",
        409,
      );
    }
    throw err;
  } finally {
    session.endSession();
  }

  // ── Comp-plan settlement (POST-COMMIT, non-blocking) ──────────────
  // Deliberately outside the transaction: the Unilevel Plus engine
  // starts and owns its own session and cannot join ours. Running it
  // inside would nest an independent transaction that commits even if
  // the conversion rolled back.
  //
  // The conversion is already final at this point, so a failure here
  // must never surface as a failed transfer. It is logged loudly, and
  // `paymentId` makes a later replay safe.
  let compPlanResult: {
    compPlanShareUsd: number;
    unspentUsd: number;
    refundedToFounder: number;
    recipients: number;
  } | null = null;
  if (feeSplit.compPlanShare > 0 && compPlanId && feeBeneficiaryUserId) {
    try {
      const { settleFeeCompPlan } = await import("./conversionFee");
      compPlanResult = await settleFeeCompPlan({
        transferGroupId,
        payerUserId: fromUserId,
        founderUserId: feeBeneficiaryUserId,
        orgId: fromOrgId,
        currency: from,
        compPlanShare: feeSplit.compPlanShare,
        upPlanId: compPlanId,
      });
    } catch (err) {
      console.error(
        `[conversionFee] COMP-PLAN SETTLEMENT FAILED for transfer ${transferGroupId} — ` +
          `${feeSplit.compPlanShare} ${from} was withheld from the founder but not yet ` +
          `distributed. Replay with paymentId convfee_${transferGroupId}.`,
        (err as Error)?.message || err,
      );
    }
  }

  return {
    fromWallet: {
      userId: fromUserId,
      orgId: fromOrgId,
      currency: from,
      balanceBefore: sourceWalletSnapshot.balanceBefore,
      balanceAfter: sourceWalletSnapshot.balanceAfter,
      amountDebited: amount,
    },
    toWallet: {
      userId: toUserId,
      orgId: toOrgId,
      currency: to,
      balanceBefore: destWalletSnapshot.balanceBefore,
      balanceAfter: destWalletSnapshot.balanceAfter,
      amountCredited: fx.converted,
    },
    fx: {
      fromCurrency: from,
      toCurrency: to,
      rate: fx.rate,
      path: fx.path,
      capturedAt: fx.capturedAt,
    },
    fee: {
      feeBps: feeBreakdown.feeBps,
      currency: from,
      /** Total fee charged. Unchanged by any comp-plan split. */
      amount: feeBreakdown.amount,
      netConverted: feeBreakdown.net,
      sourceOrgId: fromOrgId,
      beneficiaryUserId: feeBeneficiaryUserId,
      beneficiaryOrgId: feeBeneficiaryUserId ? fromOrgId : null,
      /** How the fee was divided. compPlanShare is 0 when no plan. */
      compPlanPercentage: resolvedFee.compPlanPercentage,
      founderShare: feeSplit.founderShare,
      compPlanShare: feeSplit.compPlanShare,
      compPlan: compPlanResult
        ? {
            distributedUsd: compPlanResult.compPlanShareUsd,
            recipients: compPlanResult.recipients,
            unspentUsd: compPlanResult.unspentUsd,
            refundedToFounder: compPlanResult.refundedToFounder,
          }
        : null,
    },
    transactionIds: {
      debit: String(debitTx._id),
      credit: String(creditTx._id),
      ...(feeTx ? { fee: String(feeTx._id) } : {}),
    },
    transferGroupId,
  };
}
