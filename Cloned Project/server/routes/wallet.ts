import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, requireFounder } from "../middleware/auth";
import { requireOrgAdmin } from "../middleware/roles";
import { User } from "../models/user.model";
import { BankDetails } from "../models/bank-details.model";
import {
  getOrCreateStoreWallet,
  getStoreWalletBalance,
  getUserStoreWallets,
  creditStoreWallet,
  transferStoreCreditsBetweenOrgs,
  transferStoreToContentRewards,
  getOrCreateAffiliateWallet,
  getAffiliateWalletBalanceWithGating,
  getStoreWalletTransactions,
  getAffiliateWalletTransactions,
  getAllUserWallets,
  getOrgStoreWallets,
  getUserPurchaseHistory,
  transferAffiliateToStore,
  createStoreWalletTopupInvoice,
  STORE_WALLET_TOPUP_MIN_CENTS,
  STORE_WALLET_TOPUP_MAX_CENTS,
  transferBetweenWallets,
  WalletTransferError,
} from "../services/wallet";
import { TRANSFERABLE_CURRENCIES, convertBetween, getUsdPerCoin } from "../services/cryptoFxRate";
import { WalletTransaction } from "../models/walletTransaction.model";
import { StoreWallet } from "../models/storeWallet.model";
import { Organization } from "../models/organization.model";
import { ensureCryptobrandWallets } from "../services/cryptobrandWallets";
import { CRYPTOBRAND_ALL_CURRENCIES } from "../config/cryptobrandCurrencies";
import {
  getOrCreateAuctionWallet,
  getAuctionWalletBalance,
  getAuctionWalletTransactions,
  getAuctionWalletLocks,
  createAuctionWalletTopupInvoice,
  AUCTION_WALLET_TOPUP_MIN_CENTS,
  AUCTION_WALLET_TOPUP_MAX_CENTS,
} from "../services/auctionWallet";
import { AUCTION_WALLET_TX_TYPES } from "../models/auctionWalletTransaction.model";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import { GarageAdminModel } from "../models/garageAdmin.model";
import {
  getOrCreateContentRewardsWallet,
  getContentRewardsWalletBalance,
  getContentRewardsBalanceForOrg,
  listContentRewardsBalancesForUser,
  getContentRewardsWalletTransactions,
  transferEarningsToUserWallet,
} from "../services/contentRewardsWallet";
import {
  getWalletAccounts,
  upsertWalletAccount,
  deleteWalletAccount,
} from "../services/walletAccount";
import {
  WALLET_ACCOUNT_WALLET_TYPES,
  CRYPTO_NETWORKS,
} from "../models/walletAccount.model";
import { getUserWithdrawals, getWithdrawableBalanceCents } from "../services/withdrawal";
import { WITHDRAWAL_WALLET_TYPES } from "../models/withdrawal.model";
import { getAffiliateTransactionDetail } from "../services/affiliateTransactionDetail";
import { resolveAffiliateFeeTier } from "../config/affiliateWithdrawalFees";

const router = Router();

// ============= Store Wallet Endpoints =============

/**
 * GET /wallet/store/balance
 * Get user's store wallet balance for a specific organization
 */
router.get("/store/balance", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId, currency } = z
      .object({ orgId: z.string(), currency: z.string().optional() })
      .parse(req.query);

    // Ensure wallet exists
    await getOrCreateStoreWallet(me.userId, orgId);

    // Defaults to the USD parent when `currency` is omitted, so the legacy
    // contract ("this endpoint returns the USD balance") holds.
    const balance = await getStoreWalletBalance(me.userId, orgId, currency);

    res.json({
      success: true,
      balance: balance?.balance || 0,
      currency: balance?.currency || "USD",
    });
  } catch (error) {
    console.error("Error getting store wallet balance:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get store wallet balance",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /wallet/store/transactions
 * Get user's store wallet transaction history for a specific organization
 */
router.get("/store/transactions", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
      type: z.enum(["credit", "debit", "transfer"]).optional(),
      // Cryptobrand orgs expose one wallet per currency (USD parent +
      // INR/ETH/BTC siblings). Passing `currency` scopes the ledger
      // view to that specific sibling; omitting it defaults to USD
      // (the parent, and the only wallet non-cryptobrand orgs have),
      // so every existing caller keeps its current meaning.
      // Pre-fix, this param was silently dropped and `StoreWallet.findOne`
      // returned a non-deterministic wallet doc — often the wrong one.
      // `.trim().toUpperCase()` normalises FE-sent lowercase (`?currency=btc`)
      // so the query matches the DB's uppercase convention regardless.
      currency: z
        .string()
        .trim()
        .toUpperCase()
        .optional(),
    });
    const { orgId, limit, offset, type, currency } = schema.parse(req.query);

    const result = await getStoreWalletTransactions(me.userId, orgId, {
      limit,
      offset,
      type,
      currency,
    });

    res.json({
      success: true,
      transactions: result.transactions,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error getting store wallet transactions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get transaction history",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /wallet/store/credit
 * Add credits to a stakeholder's store wallet (founder only)
 */
router.post("/store/credit", requireAuth, requireOrgAdmin, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const schema = z.object({
      stakeholderUserId: z.string(),
      amount: z.number().positive("Amount must be positive"),
      description: z.string().min(1).max(500),
      note: z.string().max(1000).optional(),
    });
    const { stakeholderUserId, amount, description, note } = schema.parse(
      req.body
    );

    // Verify stakeholder is part of the organization
    const stakeholder = await User.findById(stakeholderUserId);
    if (!stakeholder) {
      return res.status(404).json({
        success: false,
        error: "Stakeholder not found",
      });
    }

    const isOrgMember = stakeholder.organizations?.some(
      (m: any) => m.organization.toString() === orgId
    );
    if (!isOrgMember) {
      return res.status(400).json({
        success: false,
        error: "User is not a member of this organization",
      });
    }

    const result = await creditStoreWallet(
      me.userId,
      stakeholderUserId,
      orgId,
      amount,
      description,
      note
    );

    res.json({
      success: true,
      message: "Credits added successfully",
      transaction: result.transaction,
      newBalance: result.wallet.balance,
    });
  } catch (error) {
    console.error("Error crediting store wallet:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add credits",
      details: (error as Error).message,
    });
  }
});

// ─── Multi-currency store wallet APIs (cryptobrand offices) ───────
//
// Cryptobrand orgs (officeCreatedFromCryptobrand: true) auto-provision
// four sibling wallets per member: USD parent + INR/ETH/BTC. Below:
//
//   GET  /wallet/store/currencies?orgId=X
//     Roster of the caller's wallets in one org (currency + balance).
//     Cryptobrand orgs return all four (auto-creating missing ones on
//     the way through); non-cryptobrand return USD only.
//
//   POST /wallet/store/convert
//     Self-transfer between two currency wallets I control. Cross-org
//     allowed. Live FX at spot (CoinGecko + exchangerate-api).
//
//   POST /wallet/store/transfer-multi
//     Cross-user transfer with optional currency conversion. Cross-org
//     allowed on both sides. Existing USD-only same-org
//     /wallet/store/transfer below stays untouched for backward compat.
//
// All three delegate to `transferBetweenWallets` in services/wallet.ts
// for atomicity + ledger consistency. See CRYPTOBRAND_OFFICE_APIS.md
// for the full external contract.

async function isMemberOfOrg(userId: string, orgId: string): Promise<boolean> {
  const u: any = await User.findById(userId).select("organizations").lean();
  if (!u) return false;
  return (u.organizations || []).some(
    (m: any) => String(m.organization) === String(orgId),
  );
}

/**
 * GET /wallet/store/currencies?orgId=X
 * Lists the caller's currency wallets in the given org.
 */
router.get("/store/currencies", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string().min(1) }).parse(req.query);

    if (!(await isMemberOfOrg(me.userId, orgId))) {
      return res
        .status(403)
        .json({ success: false, error: "You are not a member of this org" });
    }

    // Materialise sibling wallets on cryptobrand orgs so the picker
    // always sees the full four-wallet roster rather than a subset
    // that depends on prior activity.
    let isCryptobrand = false;
    try {
      const org: any = await Organization.findById(orgId)
        .select("officeCreatedFromCryptobrand")
        .lean();
      isCryptobrand = !!org?.officeCreatedFromCryptobrand;
      if (isCryptobrand) {
        await ensureCryptobrandWallets(me.userId, orgId);
      }
    } catch (err) {
      console.warn(
        "[wallet/store/currencies] ensureCryptobrandWallets:",
        (err as Error).message,
      );
    }

    const wallets = await StoreWallet.find({
      userId: me.userId,
      orgId,
      isActive: true,
    })
      .select("currency balance parentWalletId")
      .lean<Array<{ currency: string; balance: number; parentWalletId?: any }>>();

    // Sort USD first (parent), then siblings in the config's declared
    // order — stable UX for the FE picker.
    const ORDER = new Map<string, number>();
    ORDER.set("USD", 0);
    CRYPTOBRAND_ALL_CURRENCIES.forEach((c, i) => {
      if (!ORDER.has(c)) ORDER.set(c, i + 1);
    });
    wallets.sort(
      (a, b) => (ORDER.get(a.currency) ?? 99) - (ORDER.get(b.currency) ?? 99),
    );

    res.json({
      success: true,
      orgId,
      isCryptobrand,
      wallets: wallets.map((w) => ({
        currency: w.currency,
        balance: w.balance,
        isParent: !w.parentWalletId,
      })),
    });
  } catch (error) {
    console.error("Error getting store wallet currencies:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get wallet currencies",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /wallet/store/fx-quote?from=USD&to=BTC&amount=100
 *
 * Exposes the SAME `convertBetween` output that `POST /wallet/store/convert`
 * uses to decide `toWallet.amountCredited`, without moving any money.
 * Powers the OTC desk's Convert preview + the Rates page's per-pair
 * numbers. Same live-FX contract as the convert path — 5-min cache on
 * ETH/BTC (CoinGecko), 1-h cache on INR (exchangerate-api), stablecoin
 * identity for USDT/USDC.
 *
 * Read-only. No auth on the FX numbers themselves — the rates are
 * public market data — but we require auth so this endpoint stays
 * consistent with the other /wallet routes and rate-limits per user
 * via the existing auth middleware.
 */
router.get("/store/fx-quote", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      from: z.enum(TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]]),
      to: z.enum(TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]]),
      amount: z
        .string()
        .transform((v) => Number(v))
        .refine((n) => Number.isFinite(n) && n > 0, {
          message: "amount must be a positive number",
        }),
    });
    const { from, to, amount } = schema.parse(req.query);
    const fx = await convertBetween(
      amount,
      from as any,
      to as any,
    );
    // Rate is cached for at most 5 min (ETH/BTC) or 1 h (INR); we hand
    // the FE a 5-min freshness horizon uniformly so the Convert screen
    // can display a coherent countdown for the quote it just saw.
    const expiresAt = new Date(fx.capturedAt.getTime() + 5 * 60 * 1000);
    res.json({
      success: true,
      fromCurrency: from,
      toCurrency: to,
      rate: fx.rate,
      path: fx.path,
      estimatedAmount: fx.converted,
      capturedAt: fx.capturedAt,
      expiresAt,
    });
  } catch (error: any) {
    console.error("[wallet/store/fx-quote]", error);
    // Feed failure — same 503 contract the convert endpoint uses so
    // the FE can treat FX_FEED_UNAVAILABLE consistently.
    if (String(error?.message || "").includes("CoinGecko")) {
      return res.status(503).json({
        success: false,
        code: "FX_FEED_UNAVAILABLE",
        error: "Rate feed temporarily unavailable — please retry",
      });
    }
    res.status(400).json({
      success: false,
      error: error?.message || "Failed to compute FX quote",
    });
  }
});

/**
 * POST /wallet/store/convert/preview
 *
 * Dry-run of `POST /wallet/store/convert` — same body, same FX pivot,
 * same rounding, but writes NOTHING. Solves the "our preview
 * disagrees with your receipt" problem the FE hits when a two-hop
 * pivot (e.g. INR → BTC through USD) is reproduced client-side by
 * naive multiplication. The server's `convertBetween` is the source
 * of truth; this endpoint just exposes it.
 *
 * Same shape as the convert response's `fx` + amount fields — no
 * `wouldDebit` beyond the input amount because there is no ambiguity;
 * the caller already knows what they'd send.
 */
router.post("/store/convert/preview", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      fromCurrency: z.enum(
        TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]],
      ),
      toCurrency: z.enum(
        TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]],
      ),
      amount: z.number().positive(),
      // Previously absent, so these were silently stripped from a body
      // the client was already sending. Without an org there is no fee
      // schedule to look up, which made a fee-aware quote impossible.
      fromOrgId: z.string().optional(),
      toOrgId: z.string().optional(),
    });
    const { fromCurrency, toCurrency, amount, fromOrgId } = schema.parse(
      req.body,
    );
    const me = (req as any).user as { userId: string };

    // Resolve the sending org's fee first — it comes off the sell side
    // before FX, so the quote must price the NET.
    const { resolveFee, computeFee, isFeeExempt } = await import(
      "../services/conversionFee"
    );
    let fee = { feeBps: 0, amount: 0, net: amount, gross: amount };
    let beneficiaryUserId: string | null = null;
    let compPlanPercentage = 0;
    let split = { founderShare: 0, compPlanShare: 0 };
    if (fromOrgId) {
      const resolved = await resolveFee(fromOrgId, fromCurrency, toCurrency);
      compPlanPercentage = resolved.compPlanPercentage;
      if (resolved.feeBps > 0) {
        const { findOrgFounderId } = await import(
          "../services/hifiInvoiceFulfillment"
        );
        const founderId = await findOrgFounderId(fromOrgId);
        if (founderId && !isFeeExempt(me.userId, founderId)) {
          beneficiaryUserId = founderId;
          fee = computeFee(amount, resolved.feeBps);
          const { splitFeeForCompPlan } = await import(
            "../services/conversionFee"
          );
          split = splitFeeForCompPlan(fee.amount, compPlanPercentage);
        }
      }
    }

    const fx = await convertBetween(
      fee.net,
      fromCurrency as any,
      toCurrency as any,
    );
    res.json({
      success: true,
      fx: {
        fromCurrency,
        toCurrency,
        rate: fx.rate,
        path: fx.path,
        capturedAt: fx.capturedAt,
      },
      // GROSS — the full amount leaving the customer's wallet.
      wouldDebit: amount,
      fee: {
        feeBps: fee.feeBps,
        currency: fromCurrency,
        // Total charged. The split below is informational — the
        // customer pays this either way.
        amount: fee.amount,
        sourceOrgId: fromOrgId || null,
        beneficiaryUserId,
        compPlanPercentage,
        founderShare: split.founderShare,
        compPlanShare: split.compPlanShare,
      },
      netConverted: fee.net,
      // AFTER the fee. If this disagrees with the receipt we get bug
      // reports about a desk stealing money.
      estimatedCredit: fx.converted,
    });
  } catch (error: any) {
    if (String(error?.message || "").includes("CoinGecko")) {
      return res.status(503).json({
        success: false,
        code: "FX_FEED_UNAVAILABLE",
        error: "Rate feed temporarily unavailable — please retry",
      });
    }
    console.error("[wallet/store/convert/preview]", error);
    // Always emit a `code`. Clients map codes centrally, and a bare
    // message renders as a raw server string to a customer.
    res.status(400).json({
      success: false,
      code: error?.name === "ZodError" ? "INVALID_REQUEST" : "PREVIEW_FAILED",
      error: error?.message || "Failed to preview convert",
      ...(error?.name === "ZodError" ? { issues: error.issues } : {}),
    });
  }
});

/**
 * Conversion fee schedule — founder-set, per currency pair.
 *
 * GET  /wallet/store/conversion-fees?orgId=   (any member of the org)
 * PUT  /wallet/store/conversion-fees          (founder of that org)
 *
 * Replace-the-whole-map rather than per-row CRUD: the founder screen
 * edits a table and saves it, and a wholesale replace has no merge
 * semantics to get wrong.
 *
 * Rates are BASIS POINTS. 10% is exactly 1000 — no float storage, so
 * no rounding argument can start.
 *
 * NOTE on the founder check: `requireFounder` in middleware/roles only
 * reads a role claim off the JWT, which says nothing about THIS org. A
 * fee is a price, so this does the real membership lookup instead.
 */
async function isFounderOfOrg(userId: string, orgId: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(orgId)) return false;
  const u = await User.findOne({
    _id: userId,
    organizations: {
      $elemMatch: {
        organization: new mongoose.Types.ObjectId(orgId),
        role: "founder",
      },
    },
  })
    .select("_id")
    .lean();
  return !!u;
}

router.get("/store/conversion-fees", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const orgId = String(req.query.orgId || "");
    if (!mongoose.isValidObjectId(orgId)) {
      return res
        .status(400)
        .json({ success: false, code: "INVALID_REQUEST", error: "orgId is required" });
    }
    // Members only. Not a meaningful secret — the preview endpoint
    // reveals the same rate to anyone who can quote — but /store/convert
    // already requires membership, so everyone who can act on this
    // schedule is a member anyway. Keeping the two consistent avoids
    // handing an org's pricing to an outsider for free.
    if (!(await isMemberOfOrg(me.userId, orgId))) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN_NOT_MEMBER",
        error: "You are not a member of this organization",
      });
    }
    const { OrgConversionFee, MAX_FEE_BPS } = await import(
      "../models/orgConversionFee.model"
    );
    const doc: any = await OrgConversionFee.findOne({ orgId }).lean();
    const { findOrgFounderId } = await import(
      "../services/hifiInvoiceFulfillment"
    );
    const founderId = await findOrgFounderId(orgId);

    // An org that has never saved a schedule reads as "free", not 404 —
    // the customer app calls this before every quote.
    return res.json({
      success: true,
      orgId,
      defaultFeeBps: doc?.defaultFeeBps ?? 0,
      // % OF THE FEE routed through the Unilevel Plus tree.
      compPlanPercentage: doc?.compPlanPercentage ?? 0,
      pairs: (doc?.pairs || []).map((p: any) => ({
        fromCurrency: p.fromCurrency,
        toCurrency: p.toCurrency,
        feeBps: p.feeBps,
        feePct: p.feeBps / 100,
        isActive: p.isActive !== false,
      })),
      maxFeeBps: MAX_FEE_BPS,
      feeBeneficiary: founderId ? { userId: founderId, orgId } : null,
      updatedAt: doc?.updatedAt || null,
      updatedBy: doc?.updatedBy ? String(doc.updatedBy) : null,
    });
  } catch (error: any) {
    console.error("[wallet/store/conversion-fees GET]", error);
    return res
      .status(500)
      .json({ success: false, code: "FEE_SCHEDULE_READ_FAILED", error: error?.message });
  }
});

/**
 * GET /wallet/store/conversion-fee?orgId=&fromCurrency=&toCurrency=
 *
 * Single-pair read (spec §4.2 option b) — for showing a fee outside a
 * live quote, e.g. a rate card. Note the singular path; the plural
 * `/conversion-fees` returns the whole schedule.
 *
 * This does NOT compute a fee amount: only the server does that, during
 * preview or the conversion itself. A client that computed its own
 * would eventually disagree with the receipt.
 */
router.get("/store/conversion-fee", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      fromCurrency: z.enum(
        TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]],
      ),
      toCurrency: z.enum(
        TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]],
      ),
    });
    const { orgId, fromCurrency, toCurrency } = schema.parse(req.query);
    if (!(await isMemberOfOrg(me.userId, orgId))) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN_NOT_MEMBER",
        error: "You are not a member of this organization",
      });
    }
    const { resolveFee } = await import("../services/conversionFee");
    const resolved = await resolveFee(orgId, fromCurrency, toCurrency);
    return res.json({
      success: true,
      orgId,
      fromCurrency,
      toCurrency,
      feeBps: resolved.feeBps,
      feePct: resolved.feeBps / 100,
      compPlanPercentage: resolved.compPlanPercentage,
      // "pair" = an explicit row, "default" = the org default,
      // "none" = nothing configured or not a chargeable pair.
      source: resolved.source,
      effectiveFrom: null,
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        code: "INVALID_REQUEST",
        error: "Invalid query",
        issues: error.issues,
      });
    }
    console.error("[wallet/store/conversion-fee]", error);
    return res
      .status(500)
      .json({ success: false, code: "FEE_READ_FAILED", error: error?.message });
  }
});

router.put("/store/conversion-fees", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { OrgConversionFee, MAX_FEE_BPS } = await import(
      "../models/orgConversionFee.model"
    );

    const schema = z.object({
      orgId: z.string(),
      defaultFeeBps: z.number().int().min(0).max(MAX_FEE_BPS).default(0),
      /** % OF THE COLLECTED FEE paid out through the Unilevel Plus
       *  tree — the same engine founder products use. 50 means half
       *  the fee goes to the tree, half stays with the founder. */
      compPlanPercentage: z.number().min(0).max(100).default(0),
      pairs: z
        .array(
          z.object({
            fromCurrency: z.enum(
              TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]],
            ),
            toCurrency: z.enum(
              TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]],
            ),
            feeBps: z.number().int().min(0).max(MAX_FEE_BPS),
            isActive: z.boolean().default(true),
          }),
        )
        .default([]),
    });
    const body = schema.parse(req.body);

    if (!(await isFounderOfOrg(me.userId, body.orgId))) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN_NOT_FOUNDER",
        error: "Only the founder of this organization can set conversion fees",
      });
    }

    // Same-currency is not a conversion — reject rather than store a
    // row that can never fire.
    const bad = body.pairs.find((p) => p.fromCurrency === p.toCurrency);
    if (bad) {
      return res.status(400).json({
        success: false,
        code: "INVALID_FEE_CONFIG",
        error: `${bad.fromCurrency} \u2192 ${bad.toCurrency} is not a conversion — a same-currency move is a relocation and is never charged`,
      });
    }

    // Pairs are DIRECTIONAL; one row per direction. Two rows for the
    // same direction have no defined winner.
    const seen = new Set<string>();
    for (const p of body.pairs) {
      const k = `${p.fromCurrency}>${p.toCurrency}`;
      if (seen.has(k)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_FEE_CONFIG",
          error: `Duplicate pair ${p.fromCurrency} \u2192 ${p.toCurrency}`,
        });
      }
      seen.add(k);
    }

    const doc = await OrgConversionFee.findOneAndUpdate(
      { orgId: body.orgId },
      {
        $set: {
          defaultFeeBps: body.defaultFeeBps,
          compPlanPercentage: body.compPlanPercentage,
          pairs: body.pairs,
          updatedBy: me.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return res.json({
      success: true,
      orgId: body.orgId,
      defaultFeeBps: (doc as any).defaultFeeBps,
      compPlanPercentage: (doc as any).compPlanPercentage,
      pairs: (doc as any).pairs,
      maxFeeBps: MAX_FEE_BPS,
      updatedAt: (doc as any).updatedAt,
      updatedBy: String(me.userId),
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        code: "INVALID_FEE_CONFIG",
        error: "Invalid fee schedule",
        issues: error.issues,
      });
    }
    console.error("[wallet/store/conversion-fees PUT]", error);
    return res
      .status(500)
      .json({ success: false, code: "FEE_SCHEDULE_WRITE_FAILED", error: error?.message });
  }
});

/**
 * GET /wallet/store/conversion-fees/earnings?orgId=&from=&to=&currency=
 *
 * Derived entirely from the ledger — every fee row carries
 * `kind: "wallet_conversion_fee"` and a `metadata.fee` breakdown.
 */
router.get("/store/conversion-fees/earnings", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const orgId = String(req.query.orgId || "");
    if (!(await isFounderOfOrg(me.userId, orgId))) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN_NOT_FOUNDER",
        error: "Founder access required",
      });
    }

    const q: any = {
      orgId: new mongoose.Types.ObjectId(orgId),
      "metadata.kind": "wallet_conversion_fee",
    };
    if (req.query.currency) q.currency = String(req.query.currency).toUpperCase();
    if (req.query.from || req.query.to) {
      q.createdAt = {};
      if (req.query.from) q.createdAt.$gte = new Date(String(req.query.from));
      if (req.query.to) q.createdAt.$lte = new Date(String(req.query.to));
    }

    const rows: any[] = await WalletTransaction.find(q)
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    const byCurrency = new Map<string, { amount: number; conversions: number }>();
    for (const r of rows) {
      const cur = byCurrency.get(r.currency) || { amount: 0, conversions: 0 };
      cur.amount = Math.round((cur.amount + r.amount) * 1e8) / 1e8;
      cur.conversions += 1;
      byCurrency.set(r.currency, cur);
    }

    return res.json({
      success: true,
      totals: [...byCurrency.entries()].map(([currency, v]) => ({
        currency,
        amount: v.amount,
        conversions: v.conversions,
      })),
      rows: rows.map((r) => ({
        transferGroupId: r.metadata?.transferGroupId || null,
        at: r.createdAt,
        pair: r.metadata?.fx
          ? `${r.metadata.fx.from}/${r.metadata.fx.to}`
          : null,
        feeBps: r.metadata?.fee?.feeBps ?? null,
        grossAmount: r.metadata?.fee?.grossAmount ?? null,
        feeAmount: r.amount,
        currency: r.currency,
        payerUserId: r.metadata?.counterparty?.userId
          ? String(r.metadata.counterparty.userId)
          : null,
      })),
    });
  } catch (error: any) {
    console.error("[wallet/store/conversion-fees/earnings]", error);
    return res
      .status(500)
      .json({ success: false, code: "FEE_EARNINGS_FAILED", error: error?.message });
  }
});

/**
 * GET /wallet/store/rates?base=USD
 *
 * Bulk spot rates for every non-base TRANSFERABLE_CURRENCIES entry.
 * One HTTP round-trip populates the desk's rates board + every
 * balance screen's USD-value column without N per-pair /fx-quote
 * calls.
 *
 * Ships the flat `rates` map today. `change24hPct` and `sparkline`
 * are NOT included in this ship — they need a new CoinGecko endpoint
 * (`/coins/markets` or `market_chart`) and a rolling cache, and the
 * desk can render numbers without charts as a soft-degrade. Room is
 * left in the response shape (each entry is an object, not a bare
 * number) so the extension is additive.
 */
router.get("/store/rates", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      base: z
        .enum(TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]])
        .default("USD"),
    });
    const { base } = schema.parse(req.query);
    const capturedAt = new Date();
    const rates: Record<string, { rate: number; stale: boolean }> = {};
    let anyStale = false;
    for (const c of TRANSFERABLE_CURRENCIES) {
      if (c === base) continue;
      try {
        // convertBetween(1, base, c) gives us the base→c rate directly.
        // Same feeds, same cache, same failure semantics as convert.
        const fx = await convertBetween(1, base as any, c as any);
        rates[c] = { rate: fx.rate, stale: false };
      } catch (err) {
        // Per-pair failure shouldn't kill the whole board — the desk
        // is better off seeing 5 pairs live and 1 stale than seeing
        // nothing. `stale:true` tells the FE to grey out that row.
        rates[c] = { rate: 0, stale: true };
        anyStale = true;
        console.warn(
          `[wallet/store/rates] ${base}->${c} feed failure:`,
          (err as Error).message,
        );
      }
    }
    res.json({
      success: true,
      base,
      asOf: capturedAt,
      rates,
      anyStale,
    });
  } catch (error: any) {
    console.error("[wallet/store/rates]", error);
    res.status(400).json({
      success: false,
      error: error?.message || "Failed to fetch rates",
    });
  }
});

/**
 * GET /wallet/store/transfer/:transferGroupId
 *
 * Fetch a committed convert / transfer-multi movement by its
 * `transferGroupId`. Closes the 409-recovery loop: on
 * `DUPLICATE_DEDUPE_KEY`, the desk client used to have no way to
 * reconstruct the original success payload — this endpoint returns
 * the same shape a fresh convert response has, so the FE can render
 * the receipt with confidence.
 *
 * Auth: only the debit-leg's userId OR the credit-leg's userId can
 * read the pair. Prevents a caller from probing arbitrary
 * transferGroupIds to observe other users' balance movements.
 */
router.get("/store/transfer/:transferGroupId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { transferGroupId } = req.params;
    if (!transferGroupId || transferGroupId.length > 200) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid transferGroupId" });
    }
    const rows: any[] = await WalletTransaction.find({
      "metadata.transferGroupId": transferGroupId,
    })
      .sort({ createdAt: 1 })
      .lean();
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: "TRANSFER_NOT_FOUND",
        error: "No transfer with that transferGroupId",
      });
    }
    // Select by `metadata.leg`, NOT by `type`. The conversion-fee row
    // is also `type: "credit"`, so a plain type match can return the
    // fee instead of the real credit leg and misreport the receipt.
    // `leg` has been stamped on both legs since before fees existed,
    // so the fallback is only for defence.
    const debit =
      rows.find((r) => r.metadata?.leg === "debit") ||
      rows.find((r) => r.type === "debit");
    const credit =
      rows.find((r) => r.metadata?.leg === "credit") ||
      rows.find((r) => r.type === "credit" && r.metadata?.leg !== "fee");
    const feeRow = rows.find((r) => r.metadata?.leg === "fee");
    if (!debit || !credit) {
      // Rows exist but the pair is incomplete — an audit anomaly, not
      // a valid transfer to return. 404 rather than expose a
      // half-shape the caller can't render.
      return res.status(404).json({
        success: false,
        code: "TRANSFER_INCOMPLETE",
        error: "Transfer legs not both present",
      });
    }
    const owners = new Set<string>([
      String(debit.userId),
      String(credit.userId),
      ...(feeRow ? [String(feeRow.userId)] : []),
    ]);
    if (!owners.has(String(me.userId))) {
      return res
        .status(403)
        .json({ success: false, error: "Not your transfer" });
    }
    const fx = debit?.metadata?.fx || credit?.metadata?.fx || null;
    const feeMeta = feeRow?.metadata?.fee || debit?.metadata?.fee || null;
    res.json({
      success: true,
      transferGroupId,
      // Rebuilt receipts are what the client shows after a 409 retry,
      // so the fee has to be here or the retried total disagrees with
      // the original.
      fee: {
        feeBps: feeMeta?.feeBps ?? 0,
        currency: feeRow?.currency ?? debit.currency,
        amount: feeRow?.amount ?? 0,
        netConverted: feeMeta?.netAmount ?? debit.amount,
        sourceOrgId: String(debit.orgId),
        beneficiaryUserId: feeRow ? String(feeRow.userId) : null,
        beneficiaryOrgId: feeRow ? String(feeRow.orgId) : null,
      },
      fromWallet: {
        userId: String(debit.userId),
        orgId: String(debit.orgId),
        currency: debit.currency,
        balanceBefore: debit.balanceBefore,
        balanceAfter: debit.balanceAfter,
        amountDebited: debit.amount,
      },
      toWallet: {
        userId: String(credit.userId),
        orgId: String(credit.orgId),
        currency: credit.currency,
        balanceBefore: credit.balanceBefore,
        balanceAfter: credit.balanceAfter,
        amountCredited: credit.amount,
      },
      fx: fx
        ? {
            fromCurrency: fx.from,
            toCurrency: fx.to,
            rate: fx.rate,
            path: fx.path,
            capturedAt: fx.capturedAt,
          }
        : null,
      transactionIds: {
        debit: String(debit._id),
        credit: String(credit._id),
      },
      committedAt: debit.createdAt,
    });
  } catch (error: any) {
    console.error("[wallet/store/transfer/:transferGroupId]", error);
    res.status(400).json({
      success: false,
      error: error?.message || "Failed to fetch transfer",
    });
  }
});

/**
 * GET /wallet/store/limits?orgId=X
 *
 * First-ship stub — returns platform-wide defaults so the OTC desk
 * can wire the limit-awareness affordances (Withdraw form validation,
 * tier badge) against a real endpoint instead of hardcoded strings.
 *
 * When per-user KYC tiers land, this endpoint's shape stays the same
 * — the numbers just start varying by `me.userId`. Until then, every
 * user resolves to TIER_3 with the platform-max limits so the FE
 * doesn't block anyone.
 *
 * `tier` here is authoritative for the badge the desk shows in
 * headers — the FE should read from here and delete its local copy,
 * per B2's decision point.
 */
router.get("/store/limits", requireAuth, async (req, res) => {
  try {
    const schema = z.object({ orgId: z.string().min(1) });
    schema.parse(req.query);
    res.json({
      success: true,
      daily: { withdrawn: 0, limit: 50000, currency: "USD" },
      perTransaction: { min: 10, max: 25000, currency: "USD" },
      tier: "TIER_3",
    });
  } catch (error: any) {
    console.error("[wallet/store/limits]", error);
    res.status(400).json({
      success: false,
      error: error?.message || "Failed to fetch limits",
    });
  }
});

/**
 * POST /wallet/store/convert
 * Self-transfer between two currency wallets the caller controls.
 * Cross-org allowed. Live FX applied at spot.
 */
router.post("/store/convert", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      fromOrgId: z.string().min(1),
      fromCurrency: z
        .enum(TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]]),
      toOrgId: z.string().min(1),
      toCurrency: z
        .enum(TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]]),
      amount: z.number().positive(),
      note: z.string().max(1000).optional(),
      dedupeKey: z.string().min(1).max(200).optional(),
    });
    const body = schema.parse(req.body);

    if (
      !(await isMemberOfOrg(me.userId, body.fromOrgId)) ||
      !(await isMemberOfOrg(me.userId, body.toOrgId))
    ) {
      return res.status(403).json({
        success: false,
        error: "You are not a member of the source or destination org",
      });
    }

    const result = await transferBetweenWallets({
      fromUserId: me.userId,
      fromOrgId: body.fromOrgId,
      fromCurrency: body.fromCurrency,
      toUserId: me.userId,
      toOrgId: body.toOrgId,
      toCurrency: body.toCurrency,
      amount: body.amount,
      description: `Wallet convert ${body.fromCurrency} → ${body.toCurrency}`,
      note: body.note,
      dedupeKey: body.dedupeKey,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof WalletTransferError) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    console.error("Error converting store wallet:", error);
    res.status(500).json({
      success: false,
      error: "Failed to convert",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /wallet/store/transfer-multi
 * Cross-user transfer with optional currency conversion.
 * Cross-org allowed on both sides. The existing USD-only same-org
 * `POST /wallet/store/transfer` remains for backward compat.
 */
router.post("/store/transfer-multi", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      toUserId: z.string().min(1),
      fromOrgId: z.string().min(1),
      fromCurrency: z
        .enum(TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]]),
      toOrgId: z.string().min(1),
      toCurrency: z
        .enum(TRANSFERABLE_CURRENCIES as unknown as [string, ...string[]]),
      amount: z.number().positive(),
      description: z.string().min(1).max(500),
      note: z.string().max(1000).optional(),
      dedupeKey: z.string().min(1).max(200).optional(),
    });
    const body = schema.parse(req.body);

    if (!(await isMemberOfOrg(me.userId, body.fromOrgId))) {
      return res.status(403).json({
        success: false,
        error: "You are not a member of the source org",
      });
    }
    if (!(await isMemberOfOrg(body.toUserId, body.toOrgId))) {
      return res.status(400).json({
        success: false,
        error: "Recipient is not a member of the destination org",
      });
    }

    const result = await transferBetweenWallets({
      fromUserId: me.userId,
      fromOrgId: body.fromOrgId,
      fromCurrency: body.fromCurrency,
      toUserId: body.toUserId,
      toOrgId: body.toOrgId,
      toCurrency: body.toCurrency,
      amount: body.amount,
      description: body.description,
      note: body.note,
      dedupeKey: body.dedupeKey,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof WalletTransferError) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    console.error("Error transferring (multi):", error);
    res.status(500).json({
      success: false,
      error: "Failed to transfer",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /wallet/store/transfer
 * Transfer credits from current user's store wallet to another user's store wallet
 */
router.post("/store/transfer", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      toUserId: z.string().min(1, "Recipient is required"),
      // Sender's funding org (the store wallet being debited — sender's current org).
      orgId: z.string().min(1, "Organization is required"),
      amount: z.number().positive("Amount must be positive"),
      description: z.string().max(500).optional(),
      // Which of the recipient's wallets the funds land in. Affiliate is never a target.
      destinationWalletType: z
        .enum(["store", "content_rewards"])
        .optional()
        .default("store"),
      // The org the recipient is credited under (Store or Content Rewards;
      // both are per-org now). Defaults to the sender's org if omitted.
      destinationOrgId: z.string().min(1).optional(),
    });
    const {
      toUserId,
      orgId,
      amount,
      description,
      destinationWalletType,
      destinationOrgId,
    } = schema.parse(req.body);

    // Verify recipient exists
    const recipient = await User.findById(toUserId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: "Recipient not found",
      });
    }

    if (destinationWalletType === "content_rewards") {
      // Per-org Content Rewards — the recipient's OrgRewardsWallet for the
      // chosen org receives the credit (defaults to the sender's org so a
      // sender who didn't pick one still gets the historical same-org
      // behaviour, just on the new wallet). Org-membership for the recipient
      // is NOT enforced — Content Rewards are sendable cross-org.
      const crDestOrgId = destinationOrgId || orgId;
      const result = await transferStoreToContentRewards(
        me.userId,
        toUserId,
        orgId,
        crDestOrgId,
        amount,
        description
      );
      return res.json({
        success: true,
        message: "Transfer completed successfully",
        senderTransaction: result.senderTransaction,
        newBalance: result.senderWallet.balance,
      });
    }

    // Store destination — recipient must be a member of the destination org.
    const recipientOrgId = destinationOrgId || orgId;
    const isOrgMember = recipient.organizations?.some(
      (m: any) => m.organization.toString() === recipientOrgId
    );
    if (!isOrgMember) {
      return res.status(400).json({
        success: false,
        error: "Recipient is not a member of the selected organization",
      });
    }

    const result = await transferStoreCreditsBetweenOrgs(
      me.userId,
      toUserId,
      orgId,
      recipientOrgId,
      amount,
      description
    );

    res.json({
      success: true,
      message: "Transfer completed successfully",
      senderTransaction: result.senderTransaction,
      recipientTransaction: result.recipientTransaction,
      newBalance: result.senderWallet.balance,
    });
  } catch (error) {
    console.error("Error transferring store credits:", error);
    const message = (error as Error).message;
    const status = message.includes("Insufficient") ? 400 : 500;
    res.status(status).json({
      success: false,
      error: message || "Failed to transfer credits",
    });
  }
});

/**
 * POST /wallet/store/topup
 * Self-funded top-up of the caller's per-org Store wallet via the existing
 * invoice + payment system. Body: `{ orgId, amountCents }`.
 *
 * Returns `{ success, invoice, payUrl }` — the caller redirects the browser
 * to `payUrl` and the existing checkout flow takes over. On payment
 * success, `fulfillInvoice` credits StoreWallet[caller, orgId].
 *
 * No coupons, no commission distribution, no recurring. Amount in cents,
 * USD-denominated. Range $1–$10,000.
 */
router.post("/store/topup", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string().min(1, "orgId is required"),
      amountCents: z
        .number()
        .int()
        .min(STORE_WALLET_TOPUP_MIN_CENTS)
        .max(STORE_WALLET_TOPUP_MAX_CENTS),
    });
    const { orgId, amountCents } = schema.parse(req.body);

    const { invoice, payUrl } = await createStoreWalletTopupInvoice({
      userId: me.userId,
      orgId,
      amountCents,
    });

    res.json({
      success: true,
      invoice: {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        itemCurrency: invoice.itemCurrency,
        status: invoice.status,
      },
      payUrl,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid body",
        details: error.issues,
      });
    }
    const msg = error?.message || "Failed to create top-up invoice";
    const status = /member|not found|between/.test(msg) ? 400 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

// ============= Crypto Top-Up Endpoints (persistent per-user address) =============
//
// Distinct from `/store/topup` above — that mints an invoice for a
// USD-priced deposit through the standard checkout. These two
// endpoints back the "Add Crypto" flow: the user picks a wallet
// (BTC / ETH / USDT), we return the persistent HD-derived address
// bound to (userId, orgId, currency, chain), and the FE renders a QR
// code. Deposits land at that address and the crypto backend's
// watcher stack credits the user's native-currency StoreWallet
// (BTC → BTC balance, USDT → USDT balance) — no invoice created,
// no CryptoPaymentRequest, just a CryptoTopupTransaction row.

/**
 * GET /wallet/store/topup-address?walletId=X&chain=Y
 *
 * Returns the persistent deposit address for a specific wallet. For
 * BTC and ETH wallets, `chain` is ignored (only one supported chain
 * per currency). For USDT wallets, `chain` is required — one of
 * `tron`, `polygon`, `bsc`.
 *
 * The addresses were provisioned at office-join time via
 * `ensureCryptobrandWallets` → `allocateUserAddressesFor`. If the
 * user hasn't been backfilled yet, returns 404 — call
 * `ensureCryptobrandWallets(userId, orgId)` to provision.
 */
router.get("/store/topup-address", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    // Query is (orgId, currency, chain?) — matches the shape of the
    // rest of the multi-currency wallet API (getStoreWalletTransactions
    // also filters by (orgId, currency)). The FE doesn't have to know
    // the underlying walletId this way.
    const schema = z.object({
      orgId: z.string().min(1, "orgId is required"),
      currency: z.enum(["BTC", "ETH", "USDT"]),
      chain: z.enum(["bitcoin", "ethereum", "polygon", "bsc", "tron"]).optional(),
    });
    const { orgId, currency, chain: bodyChain } = schema.parse(req.query);

    const { Types } = await import("mongoose");
    if (!Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({ success: false, error: "Invalid orgId" });
    }

    // Ownership + currency lookup on the StoreWallet — the caller must
    // actually have a wallet for this (orgId, currency). No leak: the
    // filter includes userId, so an attacker who supplies someone
    // else's orgId gets a 404 (wallet: null in their scope).
    const wallet: any = await StoreWallet.findOne({
      orgId: new Types.ObjectId(orgId),
      userId: new Types.ObjectId(me.userId),
      currency,
    })
      .select("_id currency orgId")
      .lean();
    if (!wallet) {
      return res.status(404).json({ success: false, error: "Wallet not found" });
    }

    // Chain resolution:
    //   BTC → bitcoin (fixed)
    //   ETH → ethereum (fixed)
    //   USDT → requires ?chain= (tron | polygon | bsc)
    let chain: "bitcoin" | "ethereum" | "polygon" | "bsc" | "tron";
    if (wallet.currency === "BTC") chain = "bitcoin";
    else if (wallet.currency === "ETH") chain = "ethereum";
    else {
      // USDT — pick from query
      if (!bodyChain) {
        return res.status(400).json({
          success: false,
          error: "USDT wallets require ?chain= (tron | polygon | bsc)",
        });
      }
      if (bodyChain !== "tron" && bodyChain !== "polygon" && bodyChain !== "bsc") {
        return res.status(400).json({
          success: false,
          error: `USDT not supported on chain ${bodyChain}`,
        });
      }
      chain = bodyChain;
    }

    const { getUserAddress } = await import("../services/userCryptoAddress");
    const addr = await getUserAddress(
      me.userId,
      String(wallet.orgId),
      wallet.currency as "BTC" | "ETH" | "USDT",
      chain,
    );
    if (!addr) {
      return res.status(404).json({
        success: false,
        error:
          "No deposit address provisioned yet. Ask an admin to run the backfill script or re-touch your org membership.",
      });
    }

    // Session-scoped fast-poll arm. Sheet-open (this call) is the
    // natural "user is watching for a deposit" signal — extend the
    // fast-poll window by 15 min. Backend watchers use
    // `activePollUntil > now` to decide whether to include this row
    // in their per-tick address cache. Deposits landed OUTSIDE the
    // window still credit via `cryptoHdAddressReconciler`, just with
    // higher latency (its own tick, ~15 min).
    try {
      const { UserCryptoAddress } = await import(
        "../models/userCryptoAddress.model"
      );
      await UserCryptoAddress.updateOne(
        {
          userId: new Types.ObjectId(me.userId),
          orgId: new Types.ObjectId(String(wallet.orgId)),
          currency: addr.currency,
          chain: addr.chain,
          isActive: true,
        },
        { $set: { activePollUntil: new Date(Date.now() + 15 * 60 * 1000) } },
      );
    } catch (armErr) {
      // Non-fatal: FE still gets the address; deposits still credit
      // via reconciler. Log and move on.
      console.warn(
        "[wallet/store/topup-address] arm-watch failed:",
        (armErr as Error).message,
      );
    }

    res.json({
      success: true,
      walletId: String(wallet._id),
      currency: addr.currency,
      chain: addr.chain,
      coin: addr.coin,
      address: addr.address,
      // Payload the FE renders as a QR code. Some wallets accept a
      // richer URI (e.g. `bitcoin:bc1q…?amount=0.01`) but for a raw
      // deposit we just return the address string — the FE decides
      // whether to enrich it with a suggested amount.
      qrData: addr.address,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid query", details: error.issues });
    }
    console.error("[wallet/store/topup-address]", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Failed to fetch topup address",
    });
  }
});

/**
 * GET /wallet/store/topup-transactions?walletId=X&page=1&limit=20
 *
 * Paginated list of crypto top-ups credited to a specific wallet.
 * Newest first. Powers the "Top-up history" section on the wallet
 * detail page — distinct from the general WalletTransaction feed so
 * refunds / transfers / commission credits don't drown out the
 * crypto-inflow rows.
 */
router.get("/store/topup-transactions", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    // Same shape as /store/topup-address — (orgId, currency).
    const schema = z.object({
      orgId: z.string().min(1, "orgId is required"),
      currency: z.enum(["BTC", "ETH", "USDT"]),
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    });
    const { orgId, currency, page, limit } = schema.parse(req.query);

    const { Types } = await import("mongoose");
    if (!Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({ success: false, error: "Invalid orgId" });
    }

    // Ownership check — resolve the wallet by (userId, orgId, currency).
    const wallet: any = await StoreWallet.findOne({
      orgId: new Types.ObjectId(orgId),
      userId: new Types.ObjectId(me.userId),
      currency,
    })
      .select("_id")
      .lean();
    if (!wallet) {
      return res.status(404).json({ success: false, error: "Wallet not found" });
    }

    const { CryptoTopupTransaction } = await import(
      "../models/cryptoTopupTransaction.model"
    );
    // Session-scoped fast-poll extend. This endpoint is the FE's 10s
    // poll heartbeat while the DepositCryptoSheet is open — every
    // call bumps `activePollUntil` forward 15 min for every address
    // this user owns under (orgId, currency). When the sheet closes,
    // the FE stops calling this and the window naturally expires,
    // dropping the user's addresses from every watcher's fast-poll
    // set. Reconciler is the safety backstop for post-window sends.
    try {
      const { UserCryptoAddress } = await import(
        "../models/userCryptoAddress.model"
      );
      await UserCryptoAddress.updateMany(
        {
          userId: new Types.ObjectId(me.userId),
          orgId: new Types.ObjectId(orgId),
          currency,
          isActive: true,
        },
        { $set: { activePollUntil: new Date(Date.now() + 15 * 60 * 1000) } },
      );
    } catch (armErr) {
      console.warn(
        "[wallet/store/topup-transactions] extend-watch failed:",
        (armErr as Error).message,
      );
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      CryptoTopupTransaction.find({ walletId: wallet._id })
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CryptoTopupTransaction.countDocuments({ walletId: wallet._id }),
    ]);

    res.json({
      success: true,
      transactions: rows.map((r: any) => ({
        _id: String(r._id),
        currency: r.currency,
        chain: r.chain,
        coin: r.coin,
        address: r.address,
        amount: r.amount,
        amountAtomic: r.amountAtomic,
        amountUsdAtDeposit: r.amountUsdAtDeposit,
        txHash: r.txHash,
        fromAddress: r.fromAddress,
        blockNumber: r.blockNumber,
        receivedAt: r.receivedAt,
        status: r.status,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid query", details: error.issues });
    }
    console.error("[wallet/store/topup-transactions]", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Failed to fetch topup transactions",
    });
  }
});

// ============= Auction Wallet Endpoints =============
//
// The prepaid balance a buyer bids from. Global per user (not per-org) — one
// balance funds bids across every seller's store. Always USD.
//
// `balance` is spendable. `lockedBalance` mirrors what is currently held in
// escrow against the user's live bids — that money has physically moved to the
// platform escrow account, so it is NOT part of `balance`.

/**
 * GET /wallet/auction/balance
 * Lazy-creates the wallet on first call, matching /wallet/store/balance.
 */
router.get("/auction/balance", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    // Ensure wallet exists — "first call creates it".
    await getOrCreateAuctionWallet(me.userId);

    const snapshot = await getAuctionWalletBalance(me.userId);

    res.json({ success: true, ...snapshot });
  } catch (error) {
    console.error("Error getting auction wallet balance:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get auction wallet balance",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /wallet/auction/transactions?limit=&offset=&type=
 * Same limit/offset contract as the store wallet history.
 */
router.get("/auction/transactions", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
      type: z.enum(AUCTION_WALLET_TX_TYPES).optional(),
    });
    const { limit, offset, type } = schema.parse(req.query);

    const result = await getAuctionWalletTransactions(me.userId, {
      limit,
      offset,
      type,
    });

    res.json({
      success: true,
      transactions: result.transactions,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid query",
        details: error.issues,
      });
    }
    console.error("Error getting auction wallet transactions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get transaction history",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /wallet/auction/locks
 * Per-auction breakdown of the user's escrowed funds. The sum equals the
 * wallet's `lockedBalance`.
 */
router.get("/auction/locks", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { locks, totalLockedUsd } = await getAuctionWalletLocks(me.userId);
    res.json({ success: true, locks, totalLockedUsd });
  } catch (error) {
    console.error("Error getting auction wallet locks:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get locked funds",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /wallet/auction/topup
 * Self-funded top-up via the existing invoice + payment system.
 * Body: `{ amountCents }`. Returns `{ success, invoice, payUrl }` — redirect
 * the browser to `payUrl` and the standard checkout takes over. On payment,
 * `fulfillInvoice` credits the caller's AuctionWallet.
 *
 * Amount is USD cents, range $1–$10,000. The buyer may still pay in INR; the
 * standard currency conversion handles it.
 */
router.post("/auction/topup", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      amountCents: z
        .number()
        .int()
        .min(AUCTION_WALLET_TOPUP_MIN_CENTS)
        .max(AUCTION_WALLET_TOPUP_MAX_CENTS),
    });
    const { amountCents } = schema.parse(req.body);

    const { invoice, payUrl } = await createAuctionWalletTopupInvoice({
      userId: me.userId,
      amountCents,
    });

    res.json({
      success: true,
      invoice: {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        itemCurrency: invoice.itemCurrency,
        status: invoice.status,
      },
      payUrl,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid body",
        details: error.issues,
      });
    }
    const msg = error?.message || "Failed to create top-up invoice";
    const status = /not found|between|required/.test(msg) ? 400 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

/**
 * GET /wallet/store/transfer-targets?toUserId=X
 * List the destination wallets a sender may transfer INTO for a given recipient:
 *   - the recipient's Store wallet in each org they belong to
 *   - the recipient's Content Rewards (NcWallet) balance
 * The recipient's Affiliate wallet is deliberately excluded.
 */
router.get("/store/transfer-targets", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { toUserId } = z
      .object({ toUserId: z.string().min(1) })
      .parse(req.query);

    // Self-transfer between the user's own store vaults across different
    // orgs is allowed — the actual same-wallet guard lives in the transfer
    // service (senderId + senderOrgId === recipientId + recipientOrgId).
    // Just make sure the FE excludes the sender's current org from the
    // destination picker so the user doesn't try to move funds to the
    // same wallet they're funding from.

    const recipient = await User.findById(toUserId)
      .select("name email profilePicture organizations")
      .populate("organizations.organization", "name icon store.name store.icon")
      .lean();
    if (!recipient) {
      return res
        .status(404)
        .json({ success: false, error: "Recipient not found" });
    }

    const orgIdOf = (m: any) =>
      String(m?.organization?._id || m?.organization || "");

    const seen = new Set<string>();
    const storeTargets = ((recipient as any).organizations || [])
      .map((m: any) => ({
        walletType: "store" as const,
        orgId: orgIdOf(m),
        orgName: m?.organization?.name || "Organization",
        // Prefer the org's store icon, fall back to the org icon. Lets the
        // picker render each store's real logo instead of a generic glyph.
        orgIcon:
          m?.organization?.store?.icon || m?.organization?.icon || null,
      }))
      .filter((t: any) => {
        if (!t.orgId || seen.has(t.orgId)) return false;
        seen.add(t.orgId);
        return true;
      });

    // Content Rewards is now per-org too. Surface one option per org the
    // recipient belongs to so the sender can pick "Content Rewards for
    // Org A". `storeTargets` already deduped the recipient's orgs above.
    const crTargets = storeTargets.map((t: any) => ({
      walletType: "content_rewards" as const,
      orgId: t.orgId,
      orgName: t.orgName,
      orgIcon: t.orgIcon,
    }));

    const targets = [...storeTargets, ...crTargets];

    res.json({
      success: true,
      recipient: {
        _id: (recipient as any)._id,
        name: (recipient as any).name,
        email: (recipient as any).email,
        profilePicture: (recipient as any).profilePicture || null,
      },
      targets,
    });
  } catch (error) {
    console.error("Error fetching transfer targets:", error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || "Failed to fetch transfer targets",
    });
  }
});

/**
 * GET /wallet/store/org-wallets
 * Get all stakeholders' wallets for an organization (founder only)
 */
router.get(
  "/store/org-wallets",
  requireAuth,
  requireOrgAdmin,
  async (req, res) => {
    try {
      const schema = z.object({
        orgId: z.string(),
        limit: z
          .string()
          .optional()
          .transform((v) => (v ? parseInt(v, 10) : 50)),
        offset: z
          .string()
          .optional()
          .transform((v) => (v ? parseInt(v, 10) : 0)),
      });
      const { orgId, limit, offset } = schema.parse(req.query);

      const result = await getOrgStoreWallets(orgId, { limit, offset });

      res.json({
        success: true,
        wallets: result.wallets,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      console.error("Error getting org store wallets:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get organization wallets",
        details: (error as Error).message,
      });
    }
  }
);

// ============= Affiliate Wallet Endpoints =============

/**
 * GET /wallet/affiliate/balance
 * Get user's affiliate wallet balance
 */
router.get("/affiliate/balance", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    // Ensure wallet exists
    await getOrCreateAffiliateWallet(me.userId);

    const result = await getAffiliateWalletBalanceWithGating(me.userId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error getting affiliate wallet balance:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get affiliate wallet balance",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /wallet/affiliate/transactions
 * Get user's affiliate wallet transaction history
 */
router.get("/affiliate/transactions", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
      type: z.enum(["commission", "withdrawal", "cashback"]).optional(),
    });
    const { limit, offset, type } = schema.parse(req.query);

    const result = await getAffiliateWalletTransactions(me.userId, {
      limit,
      offset,
      type,
    });

    res.json({
      success: true,
      transactions: result.transactions,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error getting affiliate wallet transactions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get transaction history",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /wallet/affiliate/transactions/:transactionId
 * Rich detail for a single affiliate wallet credit. Resolves the source
 * commission distribution (comb-plan or Unilevel Plus), the customer whose
 * purchase generated it, their direct upline, the source org, and the
 * product with its price break-down. Owner-only.
 */
router.get(
  "/affiliate/transactions/:transactionId",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { transactionId } = z
        .object({ transactionId: z.string().min(1) })
        .parse(req.params);

      const result = await getAffiliateTransactionDetail(
        me.userId,
        transactionId
      );

      if (!result.ok) {
        const status =
          result.code === "not_found"
            ? 404
            : result.code === "forbidden"
            ? 403
            : 400;
        return res
          .status(status)
          .json({ success: false, error: result.message });
      }

      res.json({ success: true, ...result.data });
    } catch (error) {
      console.error("Error getting affiliate transaction detail:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get transaction detail",
        details: (error as Error).message,
      });
    }
  }
);

/**
 * POST /wallet/affiliate/transfer-to-store
 * Transfer redeemable affiliate balance to user's own store wallet
 * Requires active Unilevel Plus purchase
 */
router.post("/affiliate/transfer-to-store", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; email?: string };
    const schema = z.object({
      orgId: z.string().min(1, "Organization is required"),
      amount: z.number().positive("Amount must be positive"),
      description: z.string().max(500).optional(),
    });
    const { orgId, amount, description } = schema.parse(req.body);

    // Root-user bypass: the platform owner (shorupan@gmail.com) is treated
    // as default-activated for Unilevel Plus and should not be gated by the
    // paywall. Check by userId → email (JWT may not carry email) AND fall
    // back to the GarageAdmin lookup for other garage-super-admins.
    const meUser = await User.findById(me.userId).select("email").lean();
    const meEmail = (meUser?.email || me.email || "").toLowerCase();
    const isPlatformOwner = meEmail === "shorupan@gmail.com";
    const isPlatformSuperAdmin =
      isPlatformOwner ||
      (meEmail
        ? !!(await GarageAdminModel.exists({
            email: meEmail,
            role: "garage-super-admin",
            isActive: true,
          }))
        : false);

    if (!isPlatformSuperAdmin) {
      // Verify user has active Unilevel Plus purchase
      const purchase = await UnilevelPlusPurchase.findOne({
        userId: me.userId,
        status: "active",
      })
        .select("_id")
        .lean();

      if (!purchase) {
        return res.status(403).json({
          success: false,
          error: "Unilevel Plus activation required to transfer affiliate earnings",
        });
      }
    }

    const result = await transferAffiliateToStore(
      me.userId,
      orgId,
      amount,
      description
    );

    res.json({
      success: true,
      message: "Transfer completed successfully",
      affiliateBalance: result.affiliateWallet.balance,
      storeBalance: result.storeWallet.balance,
      affiliateTransaction: result.affiliateTransaction,
      storeTransaction: result.storeTransaction,
      // 5% platform fee carved on affiliate outflow (see
      // services/wallet.ts::transferAffiliateToStore). Exposed so the FE
      // can render "you moved $X, paid $Y fee, credited $Z to Store".
      fee: {
        percent: result.fee.feePct,
        grossUsd: result.fee.grossUsd,
        netUsd: result.fee.netUsd,
        feeUsd: result.fee.feeUsd,
      },
    });
  } catch (error) {
    console.error("Error transferring affiliate to store:", error);
    const message = (error as Error).message;
    const status = message.includes("Insufficient") ? 400 : 500;
    res.status(status).json({
      success: false,
      error: message || "Failed to transfer credits",
    });
  }
});

// ============= Content Rewards Wallet Endpoints =============

/**
 * GET /wallet/content-rewards/balance
 *
 * With NO query param        → legacy single-number rollup across all orgs
 *                               (kept for callers that haven't been updated).
 * With `?orgId=<id>`          → balance for that one org.
 * With `?breakdown=1`         → per-org array, one row per org the user has
 *                               any Content Rewards balance in.
 */
router.get("/content-rewards/balance", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string().min(1).optional(),
      breakdown: z.string().optional(),
    });
    const { orgId, breakdown } = schema.parse(req.query);

    if (breakdown === "1" || breakdown === "true") {
      const orgs = await listContentRewardsBalancesForUser(me.userId);
      return res.json({ success: true, orgs });
    }
    if (orgId) {
      const balance = await getContentRewardsBalanceForOrg(me.userId, orgId);
      return res.json({ success: true, ...balance });
    }
    const balance = await getContentRewardsWalletBalance(me.userId);
    res.json({ success: true, ...balance });
  } catch (error) {
    console.error("Error getting content rewards wallet balance:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get content rewards wallet balance",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /wallet/content-rewards/transactions
 * Paginated transaction history for the user's Content Rewards wallet.
 */
router.get("/content-rewards/transactions", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
      type: z.enum(["credit", "debit", "withdrawal"]).optional(),
      // When set, restricts the feed to that one org's OrgRewardsWallet
      // embedded ledger. Mirrors the sibling /balance endpoint above.
      orgId: z.string().min(1).optional(),
    });
    const { limit, offset, type, orgId } = schema.parse(req.query);

    const result = await getContentRewardsWalletTransactions(me.userId, {
      limit,
      offset,
      type,
      orgId,
    });

    res.json({
      success: true,
      transactions: result.transactions,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error getting content rewards transactions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get transaction history",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /wallet/content-rewards/transfer
 * Earner moves their OWN content-rewards earnings (now per-org OrgRewardsWallet)
 * into their OWN Store or Affiliate wallet. Source + destination both key on
 * me.userId, so this is safe for any authenticated user — no theft vector.
 *
 * `orgId` (the source per-org CR bucket) is required: it MUST be supplied
 * in the body, OR — for backward compat — falls back to the session's
 * orgId.
 */
router.post("/content-rewards/transfer", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string; orgId?: string };

  const schema = z.object({
    destination: z.enum(["store", "affiliate"]),
    amountCents: z.number().int().positive(),
    note: z.string().max(1000).optional(),
    orgId: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Invalid transfer data", details: parsed.error.issues });
  }
  const { destination, amountCents, note } = parsed.data;
  const sourceOrgId = parsed.data.orgId || me.orgId;

  if (!sourceOrgId) {
    return res
      .status(400)
      .json({ success: false, error: "orgId is required (source CR bucket)" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { ncWallet, destinationWallet, walletTransaction } =
      await transferEarningsToUserWallet({
        userId: me.userId,
        orgId: sourceOrgId,
        destination,
        amountCents,
        note,
        session,
      });
    await session.commitTransaction();

    // No inflow fee anymore — the 5% platform cut on affiliate funds
    // moved to the OUTFLOW path (see /affiliate/transfer-to-store).
    return res.json({
      success: true,
      transfer: {
        destination,
        amountCents,
        amountUsd: amountCents / 100,
        contentRewardsBalanceAfter: (ncWallet.balance || 0) / 100,
        destinationBalanceAfter: destinationWallet.balance,
        walletTransactionId: walletTransaction._id,
      },
    });
  } catch (err: any) {
    await session.abortTransaction();
    const msg = err?.message || "Failed to transfer";
    const status = /Insufficient/.test(msg) ? 400 : /not found/.test(msg) ? 404 : 400;
    return res.status(status).json({ success: false, error: msg });
  } finally {
    session.endSession();
  }
});

// ============= Combined Wallet Endpoints =============

/**
 * GET /wallet/all
 * Get all wallets for the current user (store wallets + affiliate wallet)
 */
router.get("/all", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    // Optional `?invoiceId=X` hint from the invoice-pay page. When set,
    // we materialize the buyer's INR / ETH / BTC sibling wallets in the
    // invoice's issuing org BEFORE the wallet list is built.
    //
    // Uses `ensureMultiCurrencyWalletsForInvoice` — fires on either a
    // cryptobrand-flagged org OR an invoice whose line item declares
    // itself multi-currency-native (e.g. `hifi_investment`). Without
    // this, a HiFi INR-bond buyer whose seller org isn't cryptobrand-
    // flagged would see the wallet chooser render empty.
    const invoiceIdRaw = req.query.invoiceId;
    if (invoiceIdRaw && typeof invoiceIdRaw === "string") {
      try {
        const { ensureMultiCurrencyWalletsForInvoice } = await import(
          "../services/cryptobrandWallets"
        );
        await ensureMultiCurrencyWalletsForInvoice(me.userId, invoiceIdRaw);
      } catch (err) {
        // Best-effort — don't let this failure hide the wallet list.
        console.warn(
          "[wallet/all] invoice-hint ensureMultiCurrencyWalletsForInvoice failed:",
          (err as Error).message,
        );
      }
    }

    const wallets = await getAllUserWallets(me.userId);

    res.json({
      success: true,
      storeWallets: wallets.storeWallets,
      affiliateWallet: wallets.affiliateWallet,
    });
  } catch (error) {
    console.error("Error getting all wallets:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get wallets",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /wallet/store/all
 * Get all store wallets for the current user across organizations
 */
router.get("/store/all", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    const wallets = await getUserStoreWallets(me.userId);

    res.json({
      success: true,
      wallets,
    });
  } catch (error) {
    console.error("Error getting all store wallets:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get store wallets",
      details: (error as Error).message,
    });
  }
});

// ============= Purchase History Endpoints =============

/**
 * GET /wallet/purchases
 * Get user's purchase history (courses + products)
 */
router.get("/purchases", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };
    const schema = z.object({
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
      type: z.enum(["all", "course", "product"]).optional().default("all"),
    });
    const { limit, offset, type } = schema.parse(req.query);

    const result = await getUserPurchaseHistory(me.userId, me.orgId, {
      limit,
      offset,
      type,
    });

    res.json({
      success: true,
      purchases: result.purchases,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error getting purchase history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get purchase history",
      details: (error as Error).message,
    });
  }
});


// ============= Agent Wallet Endpoints (AI Agent billing) =============

import Razorpay from "razorpay";
import crypto from "crypto";
import { requireInternalKey } from "../middleware/auth";
import { OpenClawAgent } from "../models/openclawAgent.model";
import {
  getOrCreateAivatarWallet,
  addAivatarCredits,
  deductAivatarCreditsWithDebt,
} from "../services/aivatarWallet.service";
import { AivatarWalletTransaction } from "../models/aivatarWalletTransaction.model";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

/** GET /wallet — aivatar (per-org) wallet balance + transactions */
router.get("/", requireAuth, requireFounder, async (req, res) => {
  try {
    const orgId = (req as any).user.orgId as string | undefined;
    if (!orgId) {
      return res.status(400).json({ error: "No organization in session" });
    }
    const wallet = await getOrCreateAivatarWallet(orgId);
    const transactions = await AivatarWalletTransaction
      .find({ orgId: wallet.orgId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({
      balanceCents: wallet.balance,
      balanceDollars: (wallet.balance / 100).toFixed(2),
      debtCents: wallet.debt,
      debtDollars: (wallet.debt / 100).toFixed(2),
      transactions,
    });
  } catch (err) {
    console.error("GET /wallet error:", err);
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

/** POST /wallet/create-order — create Razorpay order for topping up agent wallet */
router.post("/create-order", requireAuth, requireFounder, async (req, res) => {
  try {
    const { amountDollars } = z.object({ amountDollars: z.number().positive() }).parse(req.body);
    const amountCents = Math.round(amountDollars * 100);
    const order = await razorpay.orders.create({
      amount: amountCents,
      currency: "USD",
      receipt: `agwallet_${Date.now()}`,
    });
    res.json({ orderId: order.id, amount: amountCents, currency: "USD", keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("POST /wallet/create-order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

/** POST /wallet/verify-payment — verify Razorpay signature + credit org aivatar wallet */
router.post("/verify-payment", requireAuth, requireFounder, async (req, res) => {
  try {
    const orgId = (req as any).user.orgId as string | undefined;
    if (!orgId) {
      return res.status(400).json({ error: "No organization in session" });
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amountCents } =
      z.object({
        razorpay_order_id: z.string(),
        razorpay_payment_id: z.string(),
        razorpay_signature: z.string(),
        amountCents: z.number().int().positive(),
      }).parse(req.body);

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    const wallet = await addAivatarCredits(
      orgId,
      amountCents,
      `Top-up via GaragePay (${razorpay_payment_id})`,
      { source: "user" }
    );
    res.json({
      success: true,
      balanceCents: wallet.balance,
      balanceDollars: (wallet.balance / 100).toFixed(2),
    });
  } catch (err) {
    console.error("POST /wallet/verify-payment error:", err);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

/** GET /wallet/internal/balance — Agent-Manager pre-flight check.
 *
 * Resolves the agent's owning org and returns that org's aivatar wallet
 * balance. agentId is required — without it we have no way to know which
 * org's wallet to read. The userId query parameter is accepted for
 * backwards compatibility with the Agent-Manager wallet_client but is
 * currently unused.
 */
router.get("/internal/balance", requireInternalKey, async (req, res) => {
  try {
    const { agentId } = z
      .object({ userId: z.string().optional(), agentId: z.string() })
      .parse(req.query);
    const agent = await OpenClawAgent.findOne({ agentId }).select("orgId").lean();
    if (!agent?.orgId) {
      return res.status(404).json({ error: "agent_not_found" });
    }
    const wallet = await getOrCreateAivatarWallet(agent.orgId.toString());
    res.json({
      balanceCents: wallet.balance,
      debtCents: wallet.debt,
    });
  } catch (err) {
    console.error("GET /wallet/internal/balance error:", err);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

/** POST /wallet/internal/deduct — Agent-Manager post-execution deduction.
 *
 * Resolves the agent's owning org and deducts from that org's aivatar
 * wallet. agentId is required. The userId body field is accepted for
 * backwards compatibility with the Agent-Manager wallet_client but is
 * currently unused.
 */
router.post("/internal/deduct", requireInternalKey, async (req, res) => {
  try {
    const { amountCents, description, agentId } = z
      .object({
        userId: z.string().optional(),
        amountCents: z.number().int().positive(),
        description: z.string(),
        agentId: z.string(),
      })
      .parse(req.body);

    const agent = await OpenClawAgent.findOne({ agentId }).select("orgId").lean();
    if (!agent?.orgId) {
      return res.status(404).json({ error: "agent_not_found" });
    }
    const result = await deductAivatarCreditsWithDebt(agent.orgId.toString(), amountCents, description);
    res.json({
      success: true,
      balanceCents: result.wallet.balance,
      debtCents: result.wallet.debt,
    });
  } catch (err: any) {
    if (err?.name === "DebtLimitReachedError") {
      return res.status(402).json({ error: "debt_limit_reached", message: err.message, debtCents: err.debt_cents });
    }
    if (err?.name === "InsufficientBalanceError") {
      return res.status(402).json({ error: "insufficient_balance", message: err.message, balanceCents: err.balance_cents });
    }
    console.error("POST /wallet/internal/deduct error:", err);
    res.status(500).json({ error: "Failed to deduct credits" });
  }
});

// ============= Bank Details Endpoints =============

/**
 * GET /wallet/bank-details
 * Get the current user's bank details
 */
router.get("/bank-details", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const bankDetails = await BankDetails.findOne({ userId: me.userId }).lean();
    res.json({ success: true, bankDetails: bankDetails || null });
  } catch (err: any) {
    console.error("GET /wallet/bank-details error:", err);
    res.status(500).json({ error: "Failed to fetch bank details" });
  }
});

/**
 * POST /wallet/bank-details
 * Create or update bank details (upsert)
 */
router.post("/bank-details", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };

    const addressSchema = z.object({
      line1: z.string().nullish().transform((v) => v ?? ""),
      line2: z.string().nullish().transform((v) => v ?? ""),
      city: z.string().nullish().transform((v) => v ?? ""),
      state: z.string().nullish().transform((v) => v ?? ""),
      postalCode: z.string().nullish().transform((v) => v ?? ""),
      country: z.string().nullish().transform((v) => v ?? ""),
    });

    const bodySchema = z.object({
      country: z.string().min(1, "Country is required"),
      bankName: z.string().min(1, "Bank name is required"),
      branchAddress: addressSchema,
      routingNumber: z.string().nullish().transform((v) => v ?? ""),
      accountNumber: z.string().min(1, "Account number is required"),
      swiftCode: z.string().min(1, "SWIFT code is required"),
      ibanNumber: z.string().nullish().transform((v) => v ?? ""),
      beneficiaryName: z.string().min(1, "Beneficiary name is required"),
      beneficiaryAddress: addressSchema,
    });

    const validated = bodySchema.parse(req.body);

    const bankDetails = await BankDetails.findOneAndUpdate(
      { userId: me.userId },
      { ...validated, userId: me.userId },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    res.json({ success: true, bankDetails });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      const issues = err.issues || err.errors || [];
      return res.status(400).json({ error: issues[0]?.message || "Validation error" });
    }
    console.error("POST /wallet/bank-details error:", err);
    res.status(500).json({ error: "Failed to save bank details" });
  }
});

// ============= Per-Wallet Payout Accounts (bank + crypto) =============
// A wallet (store per-org / affiliate / content_rewards) can hold at most one
// bank account AND one crypto address. Supersedes /wallet/bank-details.

const accountAddressSchema = z.object({
  line1: z.string().nullish().transform((v) => v ?? ""),
  line2: z.string().nullish().transform((v) => v ?? ""),
  city: z.string().nullish().transform((v) => v ?? ""),
  state: z.string().nullish().transform((v) => v ?? ""),
  postalCode: z.string().nullish().transform((v) => v ?? ""),
  country: z.string().nullish().transform((v) => v ?? ""),
});

const bankAccountSchema = z.object({
  accountType: z.literal("bank"),
  label: z.string().max(120).optional().default(""),
  country: z.string().min(1, "Country is required"),
  bankName: z.string().min(1, "Bank name is required"),
  branchAddress: accountAddressSchema,
  routingNumber: z.string().nullish().transform((v) => v ?? ""),
  accountNumber: z.string().min(1, "Account number is required"),
  swiftCode: z.string().min(1, "SWIFT code is required"),
  ibanNumber: z.string().nullish().transform((v) => v ?? ""),
  beneficiaryName: z.string().min(1, "Beneficiary name is required"),
  beneficiaryAddress: accountAddressSchema,
});

const cryptoAccountSchema = z.object({
  accountType: z.literal("crypto"),
  label: z.string().max(120).optional().default(""),
  cryptoNetwork: z.enum(CRYPTO_NETWORKS),
  cryptoAddress: z.string().min(1, "Wallet address is required"),
  cryptoMemo: z.string().nullish().transform((v) => v ?? ""),
});

const upsertAccountSchema = z.object({
  walletType: z.enum(WALLET_ACCOUNT_WALLET_TYPES),
  orgId: z.string().nullish(),
  account: z.discriminatedUnion("accountType", [
    bankAccountSchema,
    cryptoAccountSchema,
  ]),
});

/**
 * GET /wallet/accounts?walletType=&orgId=
 * List the (≤2) payout accounts for one of the user's wallets.
 */
router.get("/accounts", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      walletType: z.enum(WALLET_ACCOUNT_WALLET_TYPES),
      orgId: z.string().optional(),
    });
    const { walletType, orgId } = schema.parse(req.query);

    if (walletType === "store" && !orgId) {
      return res.status(400).json({ success: false, error: "orgId is required for store wallet" });
    }

    const accounts = await getWalletAccounts(me.userId, walletType, orgId);
    res.json({ success: true, accounts });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      const issues = error.issues || error.errors || [];
      return res.status(400).json({ success: false, error: issues[0]?.message || "Invalid query" });
    }
    console.error("GET /wallet/accounts error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch accounts" });
  }
});

/**
 * POST /wallet/accounts
 * Upsert one account (bank or crypto) for a wallet slot.
 */
router.post("/accounts", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { walletType, orgId, account } = upsertAccountSchema.parse(req.body);

    if (walletType === "store" && !orgId) {
      return res.status(400).json({ success: false, error: "orgId is required for store wallet" });
    }

    const { accountType, ...fields } = account;
    const saved = await upsertWalletAccount({
      userId: me.userId,
      walletType,
      orgId,
      accountType,
      data: fields,
    });
    res.json({ success: true, account: saved });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      const issues = error.issues || error.errors || [];
      return res.status(400).json({ success: false, error: issues[0]?.message || "Validation error" });
    }
    console.error("POST /wallet/accounts error:", error);
    res.status(500).json({ success: false, error: "Failed to save account" });
  }
});

/**
 * GET /wallet/withdrawable?walletType=&orgId=
 * The current user's withdrawable (matured) balance for one wallet, in cents.
 * Matured = funds credited before last Sunday 11:59:59 PM IST.
 */
router.get("/withdrawable", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      walletType: z.enum(WITHDRAWAL_WALLET_TYPES),
      orgId: z.string().optional(),
    });
    const { walletType, orgId } = schema.parse(req.query);
    if (walletType === "store" && !orgId) {
      return res.status(400).json({ success: false, error: "orgId is required for store wallet" });
    }
    const withdrawableCents = await getWithdrawableBalanceCents(me.userId, walletType, orgId);
    res.json({ success: true, withdrawableCents });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      const issues = error.issues || error.errors || [];
      return res.status(400).json({ success: false, error: issues[0]?.message || "Invalid query" });
    }
    console.error("GET /wallet/withdrawable error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch withdrawable balance" });
  }
});

/**
 * GET /wallet/withdrawal-preference?walletType=&orgId=
 * PUT /wallet/withdrawal-preference   { walletType, orgId?, frequency, keepAmountCents? }
 *
 * How often the user wants this wallet paid out, and how much to leave in it.
 * A standing instruction the admin reads (Vaults → Withdrawals → Preferences);
 * nothing is automated. No document = the default: weekly, keep nothing.
 * See models/withdrawalPreference.model.ts.
 */
/** Affiliate is the only priced wallet; everything else returns null. */
function resolveAffiliateFeeTierFor(walletType: string, pref: any) {
  if (walletType !== "affiliate") return null;
  return resolveAffiliateFeeTier(pref);
}

/**
 * GET /wallet/withdrawal-fees?walletType=affiliate
 *
 * Everything the configuration screen needs: the full fee grid, the user's
 * current tier, and the payout accounts they hold (so it can show the crypto
 * and bank lines that actually apply to them). Read-only.
 */
router.get("/withdrawal-fees", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const walletType = String(req.query.walletType || "affiliate");
    const {
      affiliateFeeMatrix,
      AFFILIATE_KEEP_THRESHOLD_CENTS,
      AFFILIATE_DEFAULT_FEE_PERCENT,
    } = await import("../config/affiliateWithdrawalFees");

    if (walletType !== "affiliate") {
      // Store / content-rewards withdrawals are free and not on the grid.
      return res.json({
        success: true,
        applies: false,
        walletType,
        feePercent: 0,
        note: "No Garage processing fee on this wallet.",
      });
    }

    const { WithdrawalPreference } = await import(
      "../models/withdrawalPreference.model"
    );
    const [pref, accounts] = await Promise.all([
      WithdrawalPreference.findOne({
        userId: new mongoose.Types.ObjectId(me.userId),
        walletType: "affiliate",
        orgId: null,
      })
        .select("frequency keepAmountCents")
        .lean(),
      (await import("../models/walletAccount.model")).WalletAccount.find({
        userId: new mongoose.Types.ObjectId(me.userId),
        walletType: "affiliate",
        isActive: true,
      })
        .select("_id accountType label")
        .lean(),
    ]);

    return res.json({
      success: true,
      applies: true,
      walletType,
      keepThresholdCents: AFFILIATE_KEEP_THRESHOLD_CENTS,
      defaultFeePercent: AFFILIATE_DEFAULT_FEE_PERCENT,
      current: resolveAffiliateFeeTier(pref as any),
      matrix: affiliateFeeMatrix(),
      accounts: (accounts || []).map((a: any) => ({
        id: String(a._id),
        accountType: a.accountType,
        label: a.label || "",
      })),
    });
  } catch (error: any) {
    console.error("GET /wallet/withdrawal-fees error:", error);
    res.status(500).json({ success: false, error: "Failed to load withdrawal fees" });
  }
});

router.get("/withdrawal-preference", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      walletType: z.enum(WITHDRAWAL_WALLET_TYPES),
      orgId: z.string().optional(),
    });
    const { walletType, orgId } = schema.parse(req.query);
    if (walletType === "store" && !orgId) {
      return res.status(400).json({ success: false, error: "orgId is required for store wallet" });
    }
    const { WithdrawalPreference, DEFAULT_WITHDRAWAL_FREQUENCY } = await import(
      "../models/withdrawalPreference.model"
    );
    const pref = await WithdrawalPreference.findOne({
      userId: new mongoose.Types.ObjectId(me.userId),
      walletType,
      orgId: orgId ? new mongoose.Types.ObjectId(orgId) : null,
    }).lean();
    res.json({
      success: true,
      preference: {
        frequency: pref?.frequency || DEFAULT_WITHDRAWAL_FREQUENCY,
        keepAmountCents: pref?.keepAmountCents ?? null,
        /** False when the user has never saved one — the UI shows the default as such. */
        isSet: !!pref,
        feeTier: resolveAffiliateFeeTierFor(walletType, pref),
        updatedAt: pref?.updatedAt || null,
      },
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      const issues = error.issues || error.errors || [];
      return res.status(400).json({ success: false, error: issues[0]?.message || "Invalid query" });
    }
    console.error("GET /wallet/withdrawal-preference error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch withdrawal preference" });
  }
});

router.put("/withdrawal-preference", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { WithdrawalPreference, WITHDRAWAL_FREQUENCIES } = await import(
      "../models/withdrawalPreference.model"
    );
    const schema = z.object({
      walletType: z.enum(WITHDRAWAL_WALLET_TYPES),
      orgId: z.string().optional(),
      frequency: z.enum(WITHDRAWAL_FREQUENCIES),
      // Cents. Honoured on BOTH frequencies: since the affiliate fee matrix
      // shipped, keeping $50 back lowers the fee on daily payouts too
      // (config/affiliateWithdrawalFees.ts), so nulling it on daily would
      // silently cost the user the cheaper tier.
      keepAmountCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
    });
    const body = schema.parse(req.body);
    if (body.walletType === "store" && !body.orgId) {
      return res.status(400).json({ success: false, error: "orgId is required for store wallet" });
    }
    const keep = body.keepAmountCents ?? null;
    const pref = await WithdrawalPreference.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(me.userId),
        walletType: body.walletType,
        orgId: body.orgId ? new mongoose.Types.ObjectId(body.orgId) : null,
      },
      { $set: { frequency: body.frequency, keepAmountCents: keep } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({
      success: true,
      preference: {
        frequency: pref!.frequency,
        keepAmountCents: pref!.keepAmountCents ?? null,
        isSet: true,
        updatedAt: pref!.updatedAt,
        // So the UI can show the new fee the instant it saves, without a
        // second round trip.
        feeTier:
          body.walletType === "affiliate"
            ? resolveAffiliateFeeTier(pref as any)
            : null,
      },
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      const issues = error.issues || error.errors || [];
      return res.status(400).json({ success: false, error: issues[0]?.message || "Invalid body" });
    }
    console.error("PUT /wallet/withdrawal-preference error:", error);
    res.status(500).json({ success: false, error: "Failed to save withdrawal preference" });
  }
});

/**
 * GET /wallet/withdrawals?walletType=&orgId=
 * The current user's withdrawals for one wallet — used by the client to merge
 * withdrawal rows (amount + fee) into that wallet's transaction feed.
 */
router.get("/withdrawals", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      walletType: z.enum(WITHDRAWAL_WALLET_TYPES),
      orgId: z.string().optional(),
    });
    const { walletType, orgId } = schema.parse(req.query);

    if (walletType === "store" && !orgId) {
      return res.status(400).json({ success: false, error: "orgId is required for store wallet" });
    }

    const withdrawals = await getUserWithdrawals(me.userId, walletType, orgId);
    res.json({
      success: true,
      withdrawals: withdrawals.map((w: any) => ({
        _id: w._id,
        walletType: w.walletType,
        orgId: w.orgId || null,
        grossAmount: w.grossAmount,
        feeAmount: w.feeAmount,
        feePercent: w.feePercent,
        taxes: (w.taxes || []).map((t: any) => ({ label: t.label, amount: t.amount })),
        taxTotal: w.taxTotal || 0,
        netAmount: w.netAmount,
        status: w.status,
        receiptUrl: w.receiptUrl || "",
        rejectionReason: w.rejectionReason || "",
        accountType: w.accountType,
        createdAt: w.createdAt,
        processedAt: w.processedAt,
      })),
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      const issues = error.issues || error.errors || [];
      return res.status(400).json({ success: false, error: issues[0]?.message || "Invalid query" });
    }
    console.error("GET /wallet/withdrawals error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch withdrawals" });
  }
});

/**
 * DELETE /wallet/accounts/:id
 * Remove an account owned by the current user.
 */
router.delete("/accounts/:id", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const removed = await deleteWalletAccount(me.userId, req.params.id);
    if (!removed) {
      return res.status(404).json({ success: false, error: "Account not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE /wallet/accounts/:id error:", error);
    res.status(500).json({ success: false, error: "Failed to delete account" });
  }
});

// ────────────────────────────────────────────────────────────────────
// Multi-currency store wallets (Cryptobrand)
//
// GET /wallet/store/all-currencies?orgId=X
//   Returns every store wallet the caller has in this org, USD first.
//   On non-cryptobrand orgs the response has just the USD wallet
//   (identical shape to always). On cryptobrand orgs (org has
//   `officeCreatedFromCryptobrand: true`) the response also contains
//   INR, ETH, BTC sibling wallets (auto-created lazily as a safety net
//   in case an eager-creation hook was missed).
//
// The legacy `/wallet/store/balance` endpoint is UNCHANGED — it still
// returns the USD balance only. Every existing consumer keeps working.
// ────────────────────────────────────────────────────────────────────

router.get("/store/all-currencies", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Ensure USD exists (matches legacy behavior) AND ensure sibling
    // currency wallets on cryptobrand orgs. Safety-net top-up for
    // members who joined pre-flag-flip.
    await getOrCreateStoreWallet(me.userId, orgId);
    const { ensureCryptobrandWallets } = await import(
      "../services/cryptobrandWallets"
    );
    const ensureResult = await ensureCryptobrandWallets(me.userId, orgId);

    // Read every wallet for (userId, orgId). Return USD first so the
    // FE can render it as the "primary" balance without extra sorting.
    const { StoreWallet } = await import("../models/storeWallet.model");
    const wallets = await StoreWallet.find({
      userId: new mongoose.Types.ObjectId(me.userId),
      orgId: new mongoose.Types.ObjectId(orgId),
    })
      .select("_id currency balance parentWalletId isActive lastTransactionAt")
      .lean();

    const usd = wallets.find((w: any) => w.currency === "USD");
    const others = wallets
      .filter((w: any) => w.currency !== "USD")
      .sort((a: any, b: any) => (a.currency < b.currency ? -1 : 1));

    res.json({
      success: true,
      isCryptobrandOrg: ensureResult.isCryptobrandOrg,
      wallets: [...(usd ? [usd] : []), ...others].map((w: any) => ({
        walletId: String(w._id),
        currency: w.currency,
        balance: w.balance,
        isParent: !w.parentWalletId,
        parentWalletId: w.parentWalletId ? String(w.parentWalletId) : null,
        isActive: w.isActive,
        lastTransactionAt: w.lastTransactionAt || null,
      })),
    });
  } catch (error) {
    console.error("Error getting multi-currency store wallets:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get store wallets",
      details: (error as Error).message,
    });
  }
});

export default router;
