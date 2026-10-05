// Admin surface for auction win settlements.
//
// Every failure in the settlement pipeline used to be console-only, and a
// `failed` row was unrecoverable: the cron selects `status: "pending"` and
// nothing reset it, so the buyer's money stayed in the platform escrow wallet
// with no way back. These endpoints make stuck wins visible and fixable.
//
// Same gate as /garage-admin/wallets — super-admin only, because requeue and
// repair both move real money.

import { Router, Response } from "express";
import { Types } from "mongoose";
import {
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { AuctionSettlement } from "../models/auctionSettlement.model";
import { StoreProduct } from "../models/storeProduct.model";
import { User } from "../models/user.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import {
  settleAuctionWin,
  repairSellerCommission,
} from "../services/auctionSettlement";

const router = Router();
router.use(requireGarageAdminAuth, requireGarageSuperAdmin);

/**
 * GET /garage-admin/auction-settlements?status=failed&limit=&skip=
 *
 * The stuck list. Defaults to everything that is NOT settled, because that's
 * the set where money may be sitting in escrow unpaid.
 */
router.get("/", async (req: GarageAdminRequest, res: Response) => {
  try {
    const limit = Math.min(
      parseInt(String(req.query.limit ?? "50"), 10) || 50,
      200
    );
    const skip = Math.max(parseInt(String(req.query.skip ?? "0"), 10) || 0, 0);
    const status = String(req.query.status ?? "").trim();

    const filter: Record<string, unknown> = status
      ? { status }
      : { status: { $ne: "settled" } };

    const [rows, total] = await Promise.all([
      AuctionSettlement.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuctionSettlement.countDocuments(filter),
    ]);

    // Hydrate just enough to act on the list without a second round trip.
    const productIds = rows.map((r: any) => r.productId);
    const winnerIds = rows.map((r: any) => r.winnerUserId);
    const [products, winners] = await Promise.all([
      StoreProduct.find({ _id: { $in: productIds } })
        .select("title orgId auction.settlementStatus")
        .lean(),
      User.find({ _id: { $in: winnerIds } })
        .select("email name")
        .lean(),
    ]);
    const productById = new Map(products.map((p: any) => [String(p._id), p]));
    const winnerById = new Map(winners.map((u: any) => [String(u._id), u]));

    const items = rows.map((r: any) => {
      const p: any = productById.get(String(r.productId));
      const w: any = winnerById.get(String(r.winnerUserId));
      return {
        _id: r._id,
        status: r.status,
        attempts: r.attempts,
        lastError: r.lastError,
        nextAttemptAt: r.nextAttemptAt,
        // How much is at stake if this never settles.
        amountUsd: r.amountUsd,
        sellerCreditedUsd: r.sellerCreditedUsd,
        bid: `${r.bidAmount} ${r.bidCurrency}`,
        productId: r.productId,
        productTitle: p?.title || null,
        orgId: r.orgId,
        winnerUserId: r.winnerUserId,
        winnerEmail: r.winnerEmail || w?.email || null,
        invoiceId: r.invoiceId,
        productOrderId: r.productOrderId,
        // The two facts that pick the right repair action:
        //   invoice exists + no commission → repair-commission
        //   no invoice                     → requeue
        hasInvoice: !!r.invoiceId,
        sellerPaid: !!r.commissionDistributionId,
        createdAt: r.createdAt,
        settledAt: r.settledAt,
      };
    });

    res.json({ success: true, items, total, limit, skip });
  } catch (error) {
    console.error("[garage-admin/auction-settlements] list:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list auction settlements",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /garage-admin/auction-settlements/:id
 * Full detail including the commission rows for this sale — including any
 * retired tombstones, whose failureReason explains the original break.
 */
router.get("/:id", async (req: GarageAdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const settlement: any = await AuctionSettlement.findById(id).lean();
    if (!settlement) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    const paymentRef = `auction_${String(settlement.bidId)}`;
    const distributions = await CommissionDistribution.find({
      paymentId: {
        $regex: `^${paymentRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      },
    })
      .select("paymentId status failureReason saleAmount sellerAmount platformFeeAmount createdAt")
      .lean();

    res.json({ success: true, settlement, distributions });
  } catch (error) {
    console.error("[garage-admin/auction-settlements] detail:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load settlement",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /garage-admin/auction-settlements/:id/requeue
 *
 * Reset a parked row and run it immediately. Use after fixing the underlying
 * data problem named in `lastError` (a missing founder record, a missing
 * email). Idempotent at every downstream layer, so a requeue that turns out
 * to be unnecessary is harmless.
 */
router.post("/:id/requeue", async (req: GarageAdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }

    const settlement: any = await AuctionSettlement.findById(id);
    if (!settlement) {
      return res.status(404).json({ success: false, error: "Not found" });
    }
    if (settlement.status === "settled") {
      return res
        .status(409)
        .json({ success: false, error: "Already settled — nothing to requeue" });
    }

    settlement.status = "pending";
    settlement.attempts = 0;
    settlement.lastError = null;
    settlement.nextAttemptAt = null;
    await settlement.save();

    // Run it now rather than waiting up to a minute for the cron.
    const result = await settleAuctionWin(settlement._id);

    res.json({ success: true, result });
  } catch (error) {
    console.error("[garage-admin/auction-settlements] requeue:", error);
    res.status(500).json({
      success: false,
      error: "Failed to requeue settlement",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /garage-admin/auction-settlements/:id/repair-commission
 *
 * For the case where the invoice and ProductOrder DID get created but the
 * seller was never credited (a swallowed per-line commission error). Re-runs
 * only the commission — it does not touch fulfillInvoice, so no duplicate
 * order is created.
 */
router.post(
  "/:id/repair-commission",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: "Invalid id" });
      }

      const result = await repairSellerCommission(id);
      if (!result.ok) {
        return res.status(400).json({ success: false, error: result.reason });
      }

      res.json({
        success: true,
        sellerCredited: result.sellerCredited,
      });
    } catch (error) {
      console.error("[garage-admin/auction-settlements] repair:", error);
      res.status(500).json({
        success: false,
        error: "Failed to repair commission",
        details: (error as Error).message,
      });
    }
  }
);

export default router;
