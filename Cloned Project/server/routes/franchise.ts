import { Router, Request, Response } from "express";
import { Types } from "mongoose";

import { requireAuth, AuthRequest } from "../middleware/auth";
import { User } from "../models/user.model";
import { TerritoryWallet } from "../models/territoryWallet.model";
import { TerritoryWalletTransaction } from "../models/territoryWalletTransaction.model";

/**
 * Franchise (territory) vault — READ ONLY, JWT-authed.
 *
 * The web/mobile vault UI reads the caller's single territory wallet + recent
 * transactions here. This data historically lived only on the key-gated
 * `/franchise-api/*` surface (roam-admin-facing, `X-Franchise-API-Key`) and was
 * proxied by the NetworkChains BFF so the browser never held the shared key.
 * Because the data is our own (`TerritoryWallet` / `TerritoryWalletTransaction`)
 * and the caller is authenticated by JWT (NC + Garage share the user DB), we
 * read it DIRECTLY here — no key, no self-HTTP. The response shape matches the
 * BFF's `{ configured, wallet, transactions }` exactly, so existing vault
 * clients are unchanged. Transfer-out lives on `/territory-wallet/transfer`.
 */
const router = Router();

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * GET /franchise/wallet — the authenticated caller's territory wallet (balance)
 * + recent transactions. Always `configured: true` (the data source is local);
 * `wallet: null, noGarageUser: true` only if the JWT resolves to no user.
 */
router.get("/wallet", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const user = await User.findById(userId)
      .select("_id email name")
      .lean<{ _id: Types.ObjectId; email: string; name?: string }>();
    if (!user) {
      res.json({ configured: true, wallet: null, transactions: [], noGarageUser: true });
      return;
    }

    const wallet = await TerritoryWallet.findOne({ userId: user._id }).lean<any>();

    // AUTHORITATIVE figures (global + founder-program combined) — mirrors
    // `franchiseApi.ts` walletPayload so the vault reads identically whether it
    // came through the old BFF proxy or this direct route.
    const walletPayload = {
      userId: String(user._id),
      email: user.email,
      name: user.name || null,
      balance: round2(Math.max(0, wallet?.balance ?? 0)),
      currency: wallet?.currency ?? "USD",
      isActive: wallet?.isActive ?? true,
      totalEarnings: round2(Math.max(0, wallet?.totalEarnings ?? 0)),
      totalWithdrawn: round2(Math.max(0, wallet?.totalWithdrawn ?? 0)),
      lastTransactionAt: wallet?.lastTransactionAt ?? null,
    };

    // Recent transactions, all sources (global + founder_program), newest first —
    // same projection as `/franchise-api/wallets/by-email/:email/transactions`.
    const rows = await TerritoryWalletTransaction.find({ userId: user._id })
      .sort({ _id: -1 })
      .limit(50)
      .lean<any[]>();

    const transactions = rows.map((r) => ({
      id: String(r._id),
      // "global" = System A (Shorupan platform-fee split), "founder_program" =
      // System B (per-office franchise). Legacy rows have no source → "global".
      source: r.source ?? "global",
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      description: r.description,
      status: r.status,
      balanceBefore: r.balanceBefore,
      balanceAfter: r.balanceAfter,
      entityType: r.entityType,
      entityId: r.entityId,
      entityName: r.entityName,
      originalSliceLevel: r.originalSliceLevel,
      relatedSplitPercentage: r.relatedSplitPercentage,
      relatedSaleAmount: r.relatedSaleAmount,
      relatedPlatformFeeAmount: r.relatedPlatformFeeAmount,
      relatedPlatformFeePercentage: r.relatedPlatformFeePercentage,
      relatedOrgId: r.relatedOrgId ? String(r.relatedOrgId) : null,
      relatedCommissionDistributionId: r.relatedCommissionDistributionId
        ? String(r.relatedCommissionDistributionId)
        : null,
      relatedPaymentId: r.relatedPaymentId || null,
      relatedItemType: r.relatedItemType || null,
      relatedItemId: r.relatedItemId ? String(r.relatedItemId) : null,
      relatedItemName: r.relatedItemName || null,
      createdAt: r.createdAt,
    }));

    res.json({ configured: true, wallet: walletPayload, transactions });
  } catch (err) {
    console.error("[franchise] wallet read error:", err);
    res.json({ configured: true, wallet: null, transactions: [], error: "network" });
  }
});

export default router;
