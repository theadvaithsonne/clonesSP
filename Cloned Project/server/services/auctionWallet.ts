// src/services/auctionWallet.ts
//
// Auction Wallet — the prepaid balance a buyer bids from. See the header on
// models/auctionWallet.model.ts for the money model.
//
// This file owns the garagenew half of the wallet:
//   - read APIs (balance, transactions, locked breakdown)
//   - money IN: top-up invoice creation, and the credit that runs when that
//     invoice is paid (fulfillInvoice → case "auction_wallet_topup")
//
// The escrow half — lock on bid, refund on outbid/loss, settle on win — is
// owned by garage-store-backend/src/services/auctionEscrow.ts, because those
// operations must be in the same Mongo transaction as the bid write. Both
// backends share one replica set, so that is safe; keep the two in sync.

import mongoose from "mongoose";
import { AuctionWallet } from "../models/auctionWallet.model";
import {
  AuctionWalletTransaction,
  AuctionWalletTxType,
} from "../models/auctionWalletTransaction.model";
import { AuctionEscrow } from "../models/auctionEscrow.model";

// Same rounding discipline as services/wallet.ts:10 — float USD balances stay
// clean across credit/debit math.
const round2 = (n: number) => Math.round(n * 100) / 100;

// Inclusive cents bounds, mirroring STORE_WALLET_TOPUP_* in services/wallet.ts.
export const AUCTION_WALLET_TOPUP_MIN_CENTS = 100; // $1
export const AUCTION_WALLET_TOPUP_MAX_CENTS = 1_000_000; // $10,000

// ============= Wallet access =============

/**
 * Get or create the caller's auction wallet. Unlike StoreWallet this is global
 * per user — one balance funds bids across every seller's store.
 *
 * Accepts an optional session so callers doing multi-write money movement can
 * pull the wallet into their own transaction (the campaignWallet convention).
 */
export async function getOrCreateAuctionWallet(
  userId: string | mongoose.Types.ObjectId,
  session?: mongoose.ClientSession
): Promise<any> {
  const q = AuctionWallet.findOne({ userId });
  if (session) q.session(session);
  let wallet = await q;

  if (!wallet) {
    // Array form so the insert joins the caller's transaction when present.
    const created = await AuctionWallet.create(
      [{ userId, balance: 0, lockedBalance: 0, currency: "USD" }],
      session ? { session } : {}
    );
    wallet = created[0];
  }

  return wallet;
}

/**
 * Read-only balance snapshot. Does NOT create the wallet — callers that want
 * lazy-create (the wallet page) call getOrCreateAuctionWallet first, matching
 * how GET /wallet/store/balance behaves.
 */
export async function getAuctionWalletBalance(userId: string): Promise<{
  balance: number;
  lockedBalance: number;
  availableBalance: number;
  currency: string;
  exists: boolean;
  lastTransactionAt: Date | null;
}> {
  const wallet = await AuctionWallet.findOne({ userId }).lean();
  if (!wallet) {
    return {
      balance: 0,
      lockedBalance: 0,
      availableBalance: 0,
      currency: "USD",
      exists: false,
      lastTransactionAt: null,
    };
  }
  const balance = (wallet as any).balance || 0;
  return {
    balance,
    lockedBalance: (wallet as any).lockedBalance || 0,
    // `balance` is already the spendable figure — locked funds have physically
    // left it for the escrow account. Exposed under both names so clients can't
    // get it wrong.
    availableBalance: balance,
    currency: (wallet as any).currency || "USD",
    exists: true,
    lastTransactionAt: (wallet as any).lastTransactionAt || null,
  };
}

/**
 * Ledger history. Same { limit, offset, type } contract and
 * { transactions, total } shape as getStoreWalletTransactions.
 */
export async function getAuctionWalletTransactions(
  userId: string,
  options: { limit?: number; offset?: number; type?: string } = {}
): Promise<{ transactions: any[]; total: number }> {
  const { limit = 20, offset = 0, type } = options;

  const wallet = await AuctionWallet.findOne({ userId }).lean();
  if (!wallet) return { transactions: [], total: 0 };

  const filter: any = { auctionWalletId: wallet._id };
  if (type) filter.type = type;

  const [transactions, total] = await Promise.all([
    AuctionWalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    AuctionWalletTransaction.countDocuments(filter),
  ]);

  return { transactions, total };
}

/**
 * Per-auction breakdown of what this user currently has escrowed. Powers the
 * "$X locked across N auctions" panel — the wallet's lockedBalance is the sum
 * of these rows.
 */
export async function getAuctionWalletLocks(userId: string): Promise<{
  locks: any[];
  totalLockedUsd: number;
}> {
  const escrows = await AuctionEscrow.find({ userId, status: "held" })
    .sort({ updatedAt: -1 })
    .lean();
  if (escrows.length === 0) return { locks: [], totalLockedUsd: 0 };

  // storeproducts is owned by the storefront backend; we read it through the
  // existing mirror model rather than duplicating the schema.
  const { StoreProduct } = await import("../models/storeProduct.model");
  const products = await StoreProduct.find({
    _id: { $in: escrows.map((e: any) => e.productId) },
  })
    .select("title featuredImage images auction saleType currency")
    .lean();
  const byId = new Map(products.map((p: any) => [String(p._id), p]));

  const locks = escrows.map((e: any) => {
    const p: any = byId.get(String(e.productId));
    return {
      productId: e.productId,
      productTitle: p?.title || null,
      image: p?.featuredImage || p?.images?.[0]?.url || null,
      lockedUsd: e.lockedUsd,
      bidAmount: e.bidAmount,
      bidCurrency: e.bidCurrency,
      exchangeRate: e.exchangeRate,
      auctionEndsAt: p?.auction?.endsAt || null,
      auctionStatus: p?.auction?.status || null,
      isHighestBidder:
        p?.auction?.highestBidderId != null &&
        String(p.auction.highestBidderId) === String(userId),
      status: e.status,
      updatedAt: e.updatedAt,
    };
  });

  const totalLockedUsd = round2(
    locks.reduce((sum, l) => sum + (l.lockedUsd || 0), 0)
  );

  return { locks, totalLockedUsd };
}

// ============= Money in =============

/**
 * Credit spendable balance. Used by the top-up fulfillment branch, and
 * available for admin adjustments.
 *
 * Idempotent whenever `idempotencyKey` is supplied — mandatory for the top-up
 * path, because a single payment can reach fulfillInvoice more than once
 * (verify-payment plus a gateway webhook, or the crypto poller re-matching).
 * Returns `alreadyCredited: true` on the replay instead of double-crediting.
 */
export async function creditAuctionWallet(params: {
  userId: string;
  amountUsd: number;
  description: string;
  idempotencyKey?: string;
  type?: AuctionWalletTxType;
  note?: string;
  productId?: string | mongoose.Types.ObjectId;
  bidId?: string | mongoose.Types.ObjectId;
  metadata?: any;
}): Promise<{ wallet: any; transaction: any; alreadyCredited: boolean }> {
  const {
    userId,
    description,
    idempotencyKey,
    type = "topup",
    note,
    productId,
    bidId,
    metadata,
  } = params;
  const amountUsd = round2(params.amountUsd);

  if (amountUsd <= 0) throw new Error("Amount must be greater than 0");

  // Cheap pre-check outside the transaction. The unique index is the real
  // guard — see the 11000 catch below.
  if (idempotencyKey) {
    const existing = await AuctionWalletTransaction.findOne({
      idempotencyKey,
    }).lean();
    if (existing) {
      const wallet = await AuctionWallet.findOne({ userId }).lean();
      return { wallet, transaction: existing, alreadyCredited: true };
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const wallet = await getOrCreateAuctionWallet(userId, session);

    const balanceBefore = wallet.balance;
    const balanceAfter = round2(balanceBefore + amountUsd);
    const lockedBefore = wallet.lockedBalance || 0;

    wallet.balance = balanceAfter;
    wallet.lastTransactionAt = new Date();
    if (type === "topup") {
      wallet.totalToppedUp = round2((wallet.totalToppedUp || 0) + amountUsd);
    } else if (type === "bid_refund") {
      wallet.totalRefunded = round2((wallet.totalRefunded || 0) + amountUsd);
    }
    await wallet.save({ session });

    const transaction = await AuctionWalletTransaction.create(
      [
        {
          auctionWalletId: wallet._id,
          userId,
          type,
          direction: "in",
          amount: amountUsd,
          currency: "USD",
          balanceBefore,
          balanceAfter,
          lockedBefore,
          lockedAfter: lockedBefore,
          productId: productId || null,
          bidId: bidId || null,
          description,
          note: note || null,
          idempotencyKey: idempotencyKey || null,
          metadata,
          status: "completed",
        },
      ],
      { session }
    ).then((docs) => docs[0]);

    await session.commitTransaction();
    return { wallet, transaction, alreadyCredited: false };
  } catch (error: any) {
    await session.abortTransaction();
    // Race: a concurrent call with the same idempotencyKey won the unique
    // index. That call did the credit — report it as a replay, not a failure.
    if (idempotencyKey && error?.code === 11000) {
      const existing = await AuctionWalletTransaction.findOne({
        idempotencyKey,
      }).lean();
      if (existing) {
        const wallet = await AuctionWallet.findOne({ userId }).lean();
        return { wallet, transaction: existing, alreadyCredited: true };
      }
    }
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Issue an invoice that credits the caller's auction wallet when paid.
 *
 * Mirrors createStoreWalletTopupInvoice with two differences: the wallet is
 * user-global so there is no org-membership check, and the line is billed
 * against the platform org rather than a seller's org.
 *
 * `itemCurrency: "USD"` is deliberate and load-bearing — the wallet is a USD
 * balance, so the credit amount must be unambiguous. The buyer can still pay in
 * INR: the existing currencyConversion machinery converts at checkout exactly
 * as it does for store-wallet top-ups.
 */
export async function createAuctionWalletTopupInvoice(params: {
  userId: string;
  amountCents: number;
  customerEmail?: string;
  customerName?: string;
}): Promise<{ invoice: any; payUrl: string }> {
  const { userId, amountCents } = params;

  if (
    !Number.isInteger(amountCents) ||
    amountCents < AUCTION_WALLET_TOPUP_MIN_CENTS ||
    amountCents > AUCTION_WALLET_TOPUP_MAX_CENTS
  ) {
    throw new Error(
      `Top-up amount must be between $${(
        AUCTION_WALLET_TOPUP_MIN_CENTS / 100
      ).toFixed(2)} and $${(AUCTION_WALLET_TOPUP_MAX_CENTS / 100).toFixed(2)}`
    );
  }

  const { User } = await import("../models/user.model");
  const { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } = await import("./commission");

  const user = await User.findById(userId).select("email name").lean();
  if (!user) throw new Error("User not found");

  const customerEmail = params.customerEmail || (user as any).email || undefined;
  if (!customerEmail) {
    throw new Error("Customer email is required for top-up");
  }

  // The invoice needs a non-null seller. Nothing is paid out on this invoice —
  // "auction_wallet_topup" is on the commission-skip list in fulfillInvoice —
  // but the field is required upstream, so we bill it against the platform.
  const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id")
    .lean();
  const sellerId = (platformUser as any)?._id?.toString() || userId;

  const { createInvoice } = await import("./invoice");

  const invoice = await createInvoice({
    organizationId: PLATFORM_ORG_ID,
    sellerId,
    userId,
    customerEmail,
    customerName: params.customerName || (user as any).name || undefined,
    lineItems: [
      {
        itemType: "auction_wallet_topup",
        itemId: userId, // the destination wallet's owner
        itemName: "Top up Auction Wallet",
        itemDescription: `Add $${(amountCents / 100).toFixed(
          2
        )} to your Auction Wallet for bidding`,
        quantity: 1,
        unitPrice: amountCents,
        originalCurrency: "USD",
      },
    ],
    itemCurrency: "USD",
    metadata: {
      kind: "topup",
      topupKind: "auction_wallet",
      topupUserId: userId,
    },
  } as any);

  // Same canonical pay URL as every other invoice — `/invoice/[invoiceId]`,
  // NOT `/checkout/...` (that route is the product-type catalog router and
  // shows "Invalid Invitation" for a Mongo id).
  const frontendBase = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  const payUrl = `${frontendBase}/invoice/${invoice._id}`;

  return { invoice, payUrl };
}
