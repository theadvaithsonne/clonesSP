// Admin surface for the monthly founder Pro-sub volume bonus.
// Mounted at /garage-admin/founder-sub-monthly-bonus. Mirrors
// garageAdminWhitelabelMonthlyBonus.ts endpoints:
//   POST /cron              — CRON_WEBHOOK_SECRET-gated backstop
//   GET  /runs              — history list, newest first
//   GET  /runs/:periodKey   — hydrated detail
//   POST /runs/:periodKey/execute — { dryRun? }
//   GET  /current           — { accruing, settling }

import { Router, Response } from "express";
import {
  requireGarageAdminAuth,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { FounderSubBonusRun } from "../models/founderSubBonusRun.model";
import { FounderSubBonusPayout } from "../models/founderSubBonusPayout.model";
import { User } from "../models/user.model";
import {
  executeFounderSubMonthlyBonusRun,
  founderSubMonthlyBonusTick,
  payoutsEnabled,
  currentPeriodKeys,
} from "../services/founderSubMonthlyBonus/run";

const router = Router();

router.post("/cron", async (req, res: Response) => {
  const incoming =
    req.headers["x-webhook-secret"] || req.headers["x-cron-secret"];
  const expected = process.env.CRON_WEBHOOK_SECRET;
  if (!expected || incoming !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const r = await founderSubMonthlyBonusTick();
    return res.json({ success: true, result: r });
  } catch (err: any) {
    console.error("[FounderSubMonthlyBonus] cron endpoint failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.use(requireGarageAdminAuth);

router.get("/runs", async (req: GarageAdminRequest, res: Response) => {
  try {
    const limit = Math.min(
      parseInt(String(req.query.limit ?? "24"), 10) || 24,
      100,
    );
    const runs = await FounderSubBonusRun.find({})
      .sort({ periodKey: -1 })
      .limit(limit)
      .lean();
    return res.json({
      success: true,
      payoutsEnabled: payoutsEnabled(),
      runs,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/current", async (_req: GarageAdminRequest, res: Response) => {
  try {
    const keys = currentPeriodKeys();
    const settlingRun = await FounderSubBonusRun.findOne({
      periodKey: keys.settling,
    })
      .select({ status: 1, dryRun: 1, totals: 1, paidAt: 1 })
      .lean();
    return res.json({
      success: true,
      payoutsEnabled: payoutsEnabled(),
      ...keys,
      settlingRun: settlingRun || null,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get(
  "/runs/:periodKey",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { periodKey } = req.params;
      const run = await FounderSubBonusRun.findOne({ periodKey }).lean();
      if (!run) return res.status(404).json({ error: "Run not found" });

      const limit = Math.min(
        parseInt(String(req.query.limit ?? "200"), 10) || 200,
        1000,
      );
      const skip = Math.max(
        parseInt(String(req.query.skip ?? "0"), 10) || 0,
        0,
      );

      const payoutFilter: any = { runId: run._id };
      if (req.query.payoutStatus) {
        payoutFilter.payoutStatus = String(req.query.payoutStatus);
      }

      const [payouts, total] = await Promise.all([
        FounderSubBonusPayout.find(payoutFilter)
          .sort({ bonusUsd: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        FounderSubBonusPayout.countDocuments(payoutFilter),
      ]);

      const userIds = payouts.map((p) => p.userId);
      const users = userIds.length
        ? await User.find({ _id: { $in: userIds } })
            .select("_id name email")
            .lean()
        : [];
      const byId = new Map(users.map((u) => [String(u._id), u]));

      return res.json({
        success: true,
        run,
        payouts: payouts.map((p) => {
          const u = byId.get(String(p.userId)) as any;
          return {
            payoutId: String(p._id),
            userId: String(p.userId),
            name: u?.name || null,
            email: u?.email || null,
            qualifyingSales: p.qualifyingSales,
            tier: p.tier,
            countedSales: p.countedSales,
            bonusUsd: p.bonusUsd,
            payoutStatus: p.payoutStatus,
            routedToPlatform: p.routedToPlatform,
            paidAt: p.paidAt || null,
            attempts: p.attempts,
            lastError: p.lastError || null,
            walletTransactionId: p.walletTransactionId
              ? String(p.walletTransactionId)
              : null,
            saleInvoiceIdsTruncated: p.saleInvoiceIdsTruncated,
            saleInvoiceIdCount: p.saleInvoiceIds?.length || 0,
          };
        }),
        pagination: { total, limit, skip },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },
);

router.post(
  "/runs/:periodKey/execute",
  async (req: GarageAdminRequest, res: Response) => {
    const { periodKey } = req.params;
    const dryRun = req.body?.dryRun === true;
    const admin: any = (req as any).garageAdmin;
    try {
      const outcome = await executeFounderSubMonthlyBonusRun(periodKey, {
        dryRun,
        triggeredBy: admin?.email || admin?.id || "admin",
      });
      return res.json({ success: true, outcome });
    } catch (err: any) {
      const status = err?.statusCode || 500;
      return res
        .status(status)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

export default router;
