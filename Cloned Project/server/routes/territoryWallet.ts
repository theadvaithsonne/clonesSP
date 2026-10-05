import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { TerritoryWallet } from "../models/territoryWallet.model";
import { transferTerritoryToStoreWallet } from "../services/territoryWalletTransfer";

/**
 * Self-serve territory-wallet endpoints for the current user (the franchise-app
 * franchisee). Read of the aggregate balance already lives in
 * `/franchise-api/wallet/user/:userId` (API-key-gated, roam-admin-facing);
 * this router adds the write path from a normal JWT-authed session.
 */
const router = Router();

router.use(requireAuth);

/**
 * GET /territory-wallet
 *
 * Returns the caller's own TerritoryWallet balance. Empty wallet returns a
 * zero-balance stub so the FE doesn't have to special-case "no wallet yet".
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const wallet = await TerritoryWallet.findOne({ userId: me.userId }).lean();
    res.json({
      wallet: {
        userId: me.userId,
        balance: wallet?.balance ?? 0,
        currency: wallet?.currency ?? "USD",
        totalEarnings: wallet?.totalEarnings ?? 0,
        totalWithdrawn: wallet?.totalWithdrawn ?? 0,
        isActive: (wallet as any)?.isActive ?? true,
        lastTransactionAt: wallet?.lastTransactionAt ?? null,
      },
    });
  } catch (err: any) {
    console.error("[territory-wallet] get error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /territory-wallet/transfer
 *
 * Move USD from the caller's TerritoryWallet into their per-org StoreWallet.
 * Self-transfer only — no theft vector, so `requireAuth` alone is enough
 * (mirrors `/wallet/content-rewards/transfer`).
 *
 * Body: { amountCents: int > 0, orgId?: string, note?: string ≤1000 }
 *   orgId defaults to the caller's active org from the JWT.
 *
 * Response: { success, transfer: { amountCents, amountUsd,
 *              territoryBalanceAfter, storeBalanceAfter,
 *              walletTransactionId, territoryTransactionId } }
 *
 * Atomic (single Mongo session): both audit rows land together or neither.
 * See TERRITORY_WALLET_TRANSFER_API.md for the full contract.
 */
router.post("/transfer", async (req: Request, res: Response) => {
  const me = (req as any).user as { userId: string; orgId?: string };

  const schema = z.object({
    amountCents: z.number().int().positive(),
    orgId: z.string().min(1).optional(),
    note: z.string().max(1000).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: "Invalid transfer data",
      details: parsed.error.issues,
    });
    return;
  }
  const { amountCents, note } = parsed.data;
  const orgId = parsed.data.orgId || me.orgId;
  if (!orgId) {
    res.status(400).json({
      success: false,
      error: "orgId is required (destination StoreWallet)",
    });
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const description = "Transfer from Franchise Wallet";
    const {
      territoryWallet,
      storeWallet,
      territoryTransaction,
      walletTransaction,
    } = await transferTerritoryToStoreWallet({
      userId: me.userId,
      orgId,
      amountCents,
      description,
      note,
      session,
    });
    await session.commitTransaction();

    res.json({
      success: true,
      transfer: {
        amountCents,
        amountUsd: amountCents / 100,
        territoryBalanceAfter: territoryWallet.balance,
        storeBalanceAfter: storeWallet.balance,
        walletTransactionId: walletTransaction._id,
        territoryTransactionId: territoryTransaction._id,
      },
    });
  } catch (err: any) {
    await session.abortTransaction();
    const msg = err?.message || "Failed to transfer";
    const status = /Insufficient/.test(msg)
      ? 400
      : /not found/i.test(msg)
        ? 404
        : /inactive|blocked/i.test(msg)
          ? 409
          : 400;
    res.status(status).json({ success: false, error: msg });
  } finally {
    session.endSession();
  }
});

export default router;
