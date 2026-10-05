// src/routes/ecommerceWallet.ts
//
// Buyer-side wallet reads for the external Garage e-commerce storefront,
// authenticated via the buyer's Garage Bearer JWT (SSO). The storefront
// forwards the buyer's existing JWT — no new key, no userId in the path.
//
// Endpoints (mounted under /ecommerce):
//   GET /ecommerce/wallet?orgId=<X>     — snapshot for one storefront
//   GET /ecommerce/wallets/me           — all storefronts the buyer has activity in
//
// Both return a unified `EcommerceWalletSnapshot` shape: balance,
// withdrawable, recent StoreWallet transactions, and the cashback the
// buyer has received at THAT storefront.
//
// Design note: a buyer holds one StoreWallet per (userId, orgId). Cashback
// also lands per-(buyer, sellerOrgId) — see CASHBACK_CODES_API.md. So
// "the buyer's wallet" only makes sense scoped to one storefront (typical)
// or as a list across storefronts (dashboard).

import { Router, Request, Response } from "express";
import { z, ZodError } from "zod";
import { Types } from "mongoose";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { StoreWallet } from "../models/storeWallet.model";
import { Organization } from "../models/organization.model";
import { CashbackDistribution } from "../models/cashbackDistribution.model";
import {
  getStoreWalletBalance,
  getStoreWalletTransactions,
} from "../services/wallet";
import { getWithdrawableBalanceCents } from "../services/withdrawal";

const router = Router();

// ──────────────────────────────────────────────────────────────────────
// Constants + types
// ──────────────────────────────────────────────────────────────────────

const SINGLE_RECENT_DEFAULT = 10;
const SINGLE_RECENT_MAX = 50;
const SINGLE_CASHBACK_RECENT_DEFAULT = 5;

const LIST_RECENT_PER_ORG = 3;
const LIST_CASHBACK_PER_ORG = 3;

function shapeTransaction(tx: any) {
  return {
    _id: String(tx._id),
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency || "USD",
    balanceBefore: tx.balanceBefore,
    balanceAfter: tx.balanceAfter,
    description: tx.description,
    status: tx.status || "completed",
    createdAt: tx.createdAt,
  };
}

function shapeCashbackRow(row: any) {
  return {
    _id: String(row._id),
    codeId: String(row.codeId),
    cashbackAmount: row.cashbackAmount,
    productType: row.productType,
    itemId: row.itemId ? String(row.itemId) : null,
    saleAmountCents: row.saleAmountCents || 0,
    appliedRatePct: row.appliedRatePct || 0,
    createdAt: row.createdAt,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Snapshot builder — shared by single-org + list endpoints.
//
// `recentLimit` controls the size of `recentTransactions`.
// `cashbackRecentLimit` controls the size of `cashback.recent`.
// Both are passed from the handler so the per-org list endpoint can
// stay cheap when a buyer has many storefronts.
// ──────────────────────────────────────────────────────────────────────

async function buildSnapshot(params: {
  userId: string;
  orgId: string;
  orgName: string;
  recentLimit: number;
  cashbackRecentLimit: number;
}) {
  const { userId, orgId, orgName, recentLimit, cashbackRecentLimit } = params;
  const userObjId = new Types.ObjectId(userId);
  const orgObjId = new Types.ObjectId(orgId);

  const [
    balance,
    walletDoc,
    txResult,
    withdrawableCents,
    cashbackAgg,
    cashbackRecent,
  ] = await Promise.all([
    getStoreWalletBalance(userId, orgId),
    StoreWallet.findOne({ userId: userObjId, orgId: orgObjId })
      .select("lastTransactionAt")
      .lean(),
    getStoreWalletTransactions(userId, orgId, {
      limit: recentLimit,
      offset: 0,
    }),
    getWithdrawableBalanceCents(userId, "store", orgId),
    CashbackDistribution.aggregate([
      {
        $match: {
          buyerId: userObjId,
          sellerOrgId: orgObjId,
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalReceivedUsd: { $sum: "$cashbackAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
    cashbackRecentLimit > 0
      ? CashbackDistribution.find({
          buyerId: userObjId,
          sellerOrgId: orgObjId,
          status: "completed",
        })
          .sort({ createdAt: -1 })
          .limit(cashbackRecentLimit)
          .lean()
      : Promise.resolve([] as any[]),
  ]);

  const cashbackTotals = (cashbackAgg as any[])[0] || {};

  return {
    orgId,
    orgName,
    balance: balance?.balance || 0,
    balanceCents: Math.round((balance?.balance || 0) * 100),
    currency: (balance?.currency as "USD") || "USD",
    withdrawableBalanceCents: withdrawableCents,
    lastTransactionAt: (walletDoc as any)?.lastTransactionAt || null,
    exists: !!balance || !!walletDoc,
    recentTransactions: (txResult.transactions as any[]).map(shapeTransaction),
    cashback: {
      totalReceivedUsd:
        Math.round(((cashbackTotals.totalReceivedUsd as number) || 0) * 100) /
        100,
      completedCount: (cashbackTotals.count as number) || 0,
      recent: (cashbackRecent as any[]).map(shapeCashbackRow),
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// GET /ecommerce/wallet?orgId=<X>
// ──────────────────────────────────────────────────────────────────────

router.get("/wallet", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const schema = z.object({
      orgId: z
        .string()
        .min(1)
        .refine((v) => Types.ObjectId.isValid(v), "orgId must be a valid ObjectId"),
      recent: z
        .string()
        .optional()
        .transform((v) =>
          v
            ? Math.min(
                Math.max(parseInt(v, 10) || SINGLE_RECENT_DEFAULT, 0),
                SINGLE_RECENT_MAX
              )
            : SINGLE_RECENT_DEFAULT
        ),
      cashbackRecent: z
        .string()
        .optional()
        .transform((v) =>
          v
            ? Math.min(
                Math.max(parseInt(v, 10) || SINGLE_CASHBACK_RECENT_DEFAULT, 0),
                SINGLE_RECENT_MAX
              )
            : SINGLE_CASHBACK_RECENT_DEFAULT
        ),
    });
    const { orgId, recent, cashbackRecent } = schema.parse(req.query);

    const org = await Organization.findById(orgId).select("name").lean();
    if (!org) {
      return res.status(404).json({
        success: false,
        error: "org_not_found",
        message: `Organization ${orgId} not found`,
      });
    }

    const snapshot = await buildSnapshot({
      userId: authReq.user!.userId,
      orgId,
      orgName: (org as any).name || "Storefront",
      recentLimit: recent,
      cashbackRecentLimit: cashbackRecent,
    });

    res.json({ success: true, ...snapshot });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: "invalid_query",
        message: "Invalid query parameters",
        details: err.issues,
      });
    }
    console.error("[ecommerceWallet] /wallet error:", err);
    res.status(500).json({
      success: false,
      error: "internal_error",
      message: err?.message || "Failed to load wallet",
    });
  }
});

// ──────────────────────────────────────────────────────────────────────
// GET /ecommerce/wallets/me — every storefront with non-zero activity.
//
// "Non-zero activity" = the buyer has a StoreWallet row OR has ever
// received cashback at that storefront. We union the two sources so a
// buyer who has only received cashback (never spent) still appears.
// ──────────────────────────────────────────────────────────────────────

router.get(
  "/wallets/me",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userObjId = new Types.ObjectId(authReq.user!.userId);

      // 1) orgs the user has a StoreWallet row in
      const storeOrgIdsAgg = await StoreWallet.find({ userId: userObjId })
        .select("orgId")
        .lean();

      // 2) orgs the user has received cashback at
      const cashbackOrgIdsAgg = await CashbackDistribution.aggregate([
        { $match: { buyerId: userObjId, status: "completed" } },
        { $group: { _id: "$sellerOrgId" } },
      ]);

      // Union → unique orgIds as strings
      const orgIdSet = new Set<string>();
      for (const r of storeOrgIdsAgg as any[]) {
        if (r?.orgId) orgIdSet.add(String(r.orgId));
      }
      for (const r of cashbackOrgIdsAgg as any[]) {
        if (r?._id) orgIdSet.add(String(r._id));
      }
      const orgIds = [...orgIdSet];

      if (orgIds.length === 0) {
        return res.json({ success: true, wallets: [] });
      }

      const orgs = await Organization.find({
        _id: { $in: orgIds.map((id) => new Types.ObjectId(id)) },
      })
        .select("name")
        .lean();
      const nameById = new Map(
        (orgs as any[]).map((o) => [String(o._id), o.name as string])
      );

      // Build snapshots in parallel. Each is bounded (small recent
      // limits) so this scales fine to dozens of storefronts. If we
      // ever need to support hundreds, cap with a slice() and add a
      // pagination param.
      const snapshots = await Promise.all(
        orgIds.map((orgId) =>
          buildSnapshot({
            userId: authReq.user!.userId,
            orgId,
            orgName: nameById.get(orgId) || "Storefront",
            recentLimit: LIST_RECENT_PER_ORG,
            cashbackRecentLimit: LIST_CASHBACK_PER_ORG,
          })
        )
      );

      // Sort by orgName for stable UI rendering.
      snapshots.sort((a, b) =>
        (a.orgName || "").localeCompare(b.orgName || "")
      );

      res.json({ success: true, wallets: snapshots });
    } catch (err: any) {
      console.error("[ecommerceWallet] /wallets/me error:", err);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: err?.message || "Failed to load wallets",
      });
    }
  }
);

export default router;
