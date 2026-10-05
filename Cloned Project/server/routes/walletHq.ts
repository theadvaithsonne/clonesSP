// src/routes/walletHq.ts
//
// Internal-only programmatic access to a user's Garage HQ Store Wallet.
// "Garage HQ" is the Organization with `parent: true` — exactly one row.
// All endpoints are guarded by `requireInternalKey` (X-Internal-Api-Key
// header), matching the existing /wallet/internal/* surface used by
// Agent-Manager.
//
// Endpoints:
//   GET  /wallet/hq/users/:userId/balance
//   GET  /wallet/hq/users/:userId/transactions
//   GET  /wallet/hq/users/:userId/summary
//   POST /wallet/hq/users/:userId/debit
//
// All reads + the debit are scoped to (userId, hqOrgId). The HQ org is
// resolved at request time via `Organization.findOne({ parent: true })` —
// never hard-coded.

import { Router, Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { Types } from "mongoose";
import { requireInternalKey } from "../middleware/auth";
import { Organization } from "../models/organization.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import {
  getStoreWalletBalance,
  getStoreWalletTransactions,
  debitStoreWallet,
} from "../services/wallet";
import { getWithdrawableBalanceCents } from "../services/withdrawal";

const router = Router();

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

const DEBIT_MIN_CENTS = 1;
const DEBIT_MAX_CENTS = 1_000_000;
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

// Tiny request-lifecycle cache for the HQ org. We resolve it at most once
// per request even if multiple handler layers reach for it.
async function resolveHqOrgId(req: Request): Promise<string> {
  const cached = (req as any)._hqOrgId as string | undefined;
  if (cached) return cached;
  const hq = await Organization.findOne({ parent: true })
    .select("_id")
    .lean();
  if (!hq) {
    throw new Error("GARAGE HQ org (parent: true) not found");
  }
  const id = String((hq as any)._id);
  (req as any)._hqOrgId = id;
  return id;
}

function userIdParam(req: Request): string {
  const id = req.params.userId;
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new HttpError(400, "invalid_user_id", "userId must be a valid ObjectId");
  }
  return id;
}

class HttpError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function sendError(res: Response, err: any) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      success: false,
      error: err.code,
      message: err.message,
      ...(err.details || {}),
    });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: "invalid_body",
      message: "Invalid request payload",
      details: err.issues,
    });
  }
  console.error("[walletHq] unexpected error:", err);
  return res.status(500).json({
    success: false,
    error: "internal_error",
    message: err?.message || "Unexpected error",
  });
}

// ──────────────────────────────────────────────────────────────────────
// GET /wallet/hq/users/:userId/balance
// ──────────────────────────────────────────────────────────────────────

router.get(
  "/users/:userId/balance",
  requireInternalKey,
  async (req: Request, res: Response) => {
    try {
      const userId = userIdParam(req);
      const hqOrgId = await resolveHqOrgId(req);

      const balance = await getStoreWalletBalance(userId, hqOrgId);
      const withdrawableCents = await getWithdrawableBalanceCents(
        userId,
        "store",
        hqOrgId
      );

      // Pull lastTransactionAt off the wallet directly — the helper above
      // doesn't include it. Use lean projection to keep this cheap.
      const { StoreWallet } = await import("../models/storeWallet.model");
      const wallet = await StoreWallet.findOne({ userId, orgId: hqOrgId })
        .select("lastTransactionAt")
        .lean();

      res.json({
        success: true,
        userId,
        orgId: hqOrgId,
        balance: balance?.balance || 0,
        balanceCents: Math.round((balance?.balance || 0) * 100),
        currency: balance?.currency || "USD",
        withdrawableBalanceCents: withdrawableCents,
        lastTransactionAt: (wallet as any)?.lastTransactionAt || null,
        exists: !!balance,
      });
    } catch (err: any) {
      sendError(res, err);
    }
  }
);

// ──────────────────────────────────────────────────────────────────────
// GET /wallet/hq/users/:userId/transactions
// ──────────────────────────────────────────────────────────────────────

const transactionsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Math.max(parseInt(v, 10) || 20, 1), 200) : 20)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(parseInt(v, 10) || 0, 0) : 0)),
  type: z.enum(["credit", "debit", "transfer", "withdrawal"]).optional(),
});

router.get(
  "/users/:userId/transactions",
  requireInternalKey,
  async (req: Request, res: Response) => {
    try {
      const userId = userIdParam(req);
      const hqOrgId = await resolveHqOrgId(req);
      const { limit, offset, type } = transactionsQuerySchema.parse(req.query);

      const result = await getStoreWalletTransactions(userId, hqOrgId, {
        limit,
        offset,
        type,
      });

      res.json({
        success: true,
        userId,
        orgId: hqOrgId,
        limit,
        offset,
        total: result.total,
        transactions: result.transactions,
      });
    } catch (err: any) {
      sendError(res, err);
    }
  }
);

// ──────────────────────────────────────────────────────────────────────
// GET /wallet/hq/users/:userId/summary
// One-shot snapshot for dashboard cards. Cheaper than 3 separate calls.
// ──────────────────────────────────────────────────────────────────────

const summaryQuerySchema = z.object({
  recent: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Math.max(parseInt(v, 10) || 5, 0), 50) : 5)),
});

router.get(
  "/users/:userId/summary",
  requireInternalKey,
  async (req: Request, res: Response) => {
    try {
      const userId = userIdParam(req);
      const hqOrgId = await resolveHqOrgId(req);
      const { recent } = summaryQuerySchema.parse(req.query);

      const userObjId = new Types.ObjectId(userId);
      const orgObjId = new Types.ObjectId(hqOrgId);

      const { StoreWallet } = await import("../models/storeWallet.model");

      // Run reads in parallel: wallet doc + counts agg + recent list +
      // withdrawable amount.
      const [walletRow, counts, recentRows, withdrawableCents] = await Promise.all([
        StoreWallet.findOne({ userId: userObjId, orgId: orgObjId })
          .select("balance currency lastTransactionAt")
          .lean(),
        WalletTransaction.aggregate([
          { $match: { userId: userObjId, orgId: orgObjId, walletType: "store" } },
          { $group: { _id: "$type", count: { $sum: 1 }, total: { $sum: "$amount" } } },
        ]),
        getStoreWalletTransactions(userId, hqOrgId, { limit: recent, offset: 0 }),
        getWithdrawableBalanceCents(userId, "store", hqOrgId),
      ]);

      const countsByType: Record<
        string,
        { count: number; total: number }
      > = {};
      let totalTransactions = 0;
      for (const c of counts as any[]) {
        countsByType[c._id] = {
          count: c.count || 0,
          total: Math.round(((c.total as number) || 0) * 100) / 100,
        };
        totalTransactions += c.count || 0;
      }

      res.json({
        success: true,
        userId,
        orgId: hqOrgId,
        balance: walletRow?.balance || 0,
        balanceCents: Math.round((walletRow?.balance || 0) * 100),
        currency: walletRow?.currency || "USD",
        withdrawableBalanceCents: withdrawableCents,
        lastTransactionAt: (walletRow as any)?.lastTransactionAt || null,
        totalTransactions,
        countsByType,
        recentTransactions: recentRows.transactions,
        exists: !!walletRow,
      });
    } catch (err: any) {
      sendError(res, err);
    }
  }
);

// ──────────────────────────────────────────────────────────────────────
// POST /wallet/hq/users/:userId/debit
// ──────────────────────────────────────────────────────────────────────

const debitBodySchema = z.object({
  amountCents: z
    .number()
    .int()
    .min(DEBIT_MIN_CENTS)
    .max(DEBIT_MAX_CENTS),
  description: z.string().min(3).max(500),
});

router.post(
  "/users/:userId/debit",
  requireInternalKey,
  async (req: Request, res: Response) => {
    try {
      const userId = userIdParam(req);
      const hqOrgId = await resolveHqOrgId(req);
      const body = debitBodySchema.parse(req.body);

      const idempotencyKey =
        (req.headers["idempotency-key"] as string | undefined)?.trim() ||
        undefined;

      // Idempotency replay: same key inside the 24h window → return the
      // original transaction unchanged. Keep the lookup tight so a stale
      // key on a different user/org never collides.
      if (idempotencyKey) {
        const existing = await WalletTransaction.findOne({
          userId: new Types.ObjectId(userId),
          orgId: new Types.ObjectId(hqOrgId),
          walletType: "store",
          type: "debit",
          "metadata.idempotencyKey": idempotencyKey,
          createdAt: { $gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) },
        }).lean();
        if (existing) {
          // Surface the current spendable balance for the caller's UI.
          const currentBalance = await getStoreWalletBalance(userId, hqOrgId);
          return res.json({
            success: true,
            replay: true,
            balanceCents: Math.round((currentBalance?.balance || 0) * 100),
            balanceAfter: (existing as any).balanceAfter,
            balanceBefore: (existing as any).balanceBefore,
            transaction: existing,
          });
        }
      }

      const amountUsd = body.amountCents / 100;

      let result: { wallet: any; transaction: any };
      try {
        result = await debitStoreWallet(
          userId,
          hqOrgId,
          amountUsd,
          body.description
        );
      } catch (err: any) {
        const msg = err?.message || "";
        // Both "Store wallet not found" and "Insufficient balance" map to
        // 402 per the spec — the caller can't transact, regardless of
        // whether the wallet has never been touched or is just empty.
        if (/Insufficient balance|wallet not found/i.test(msg)) {
          const currentBalance = await getStoreWalletBalance(userId, hqOrgId);
          return res.status(402).json({
            success: false,
            error: "insufficient_balance",
            message: `Insufficient HQ wallet balance for user ${userId}`,
            balanceCents: Math.round((currentBalance?.balance || 0) * 100),
            requestedCents: body.amountCents,
          });
        }
        throw err;
      }

      // Stamp idempotency + source metadata. The debit service already
      // committed, so this is a follow-up write — best-effort but harmless
      // on failure (the debit + ledger row are durable).
      const updates: Record<string, unknown> = {
        "metadata.source": "hq_internal_debit",
      };
      if (idempotencyKey) {
        updates["metadata.idempotencyKey"] = idempotencyKey;
      }
      await WalletTransaction.updateOne(
        { _id: result.transaction._id },
        { $set: updates }
      ).catch((e) =>
        console.error("[walletHq] metadata stamp failed:", e)
      );

      res.json({
        success: true,
        replay: false,
        balanceBefore: result.transaction.balanceBefore,
        balanceAfter: result.transaction.balanceAfter,
        balanceCents: Math.round((result.wallet.balance || 0) * 100),
        transaction: {
          _id: result.transaction._id,
          userId,
          orgId: hqOrgId,
          type: result.transaction.type,
          amount: result.transaction.amount,
          currency: result.transaction.currency,
          balanceBefore: result.transaction.balanceBefore,
          balanceAfter: result.transaction.balanceAfter,
          description: result.transaction.description,
          status: result.transaction.status,
          createdAt: result.transaction.createdAt,
        },
      });
    } catch (err: any) {
      sendError(res, err);
    }
  }
);

export default router;
