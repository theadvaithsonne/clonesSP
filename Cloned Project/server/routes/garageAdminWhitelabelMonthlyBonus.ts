// Admin surface for the monthly whitelabel volume bonus.
// Mounted at /garage-admin/whitelabel-monthly-bonus. Mirrors the
// rank-bonus admin routes for consistency:
//   POST /cron              — CRON_WEBHOOK_SECRET-gated backstop
//   GET  /runs              — history list, newest first
//   GET  /runs/:periodKey   — hydrated detail (payouts + user names)
//   POST /runs/:periodKey/execute — { dryRun? } — refuses paid periods
//   GET  /current           — { accruing, settling } this month + last

import { Router, Response } from "express";
import { Types } from "mongoose";
import {
  requireGarageAdminAuth,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { WhitelabelBonusRun } from "../models/whitelabelBonusRun.model";
import { WhitelabelBonusPayout } from "../models/whitelabelBonusPayout.model";
import { User } from "../models/user.model";
import {
  executeWhitelabelMonthlyBonusRun,
  whitelabelMonthlyBonusTick,
  payoutsEnabled,
  currentPeriodKeys,
} from "../services/whitelabelMonthlyBonus/run";

const router = Router();

/**
 * POST /garage-admin/whitelabel-monthly-bonus/cron
 *
 * External-cron backstop / alternative to the in-process hourly tick.
 * Same secret-header scheme as the rank-bonus cron endpoint. Declared
 * BEFORE the admin auth middleware, since cron has no admin JWT.
 * Idempotent on periodKey — safe to call at any cadence.
 */
router.post("/cron", async (req, res: Response) => {
  const incoming =
    req.headers["x-webhook-secret"] || req.headers["x-cron-secret"];
  const expected = process.env.CRON_WEBHOOK_SECRET;
  if (!expected || incoming !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const r = await whitelabelMonthlyBonusTick();
    return res.json({ success: true, result: r });
  } catch (err: any) {
    console.error("[WhitelabelMonthlyBonus] cron endpoint failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin auth for the rest.
router.use(requireGarageAdminAuth);

/** GET /runs — history, newest first. */
router.get("/runs", async (req: GarageAdminRequest, res: Response) => {
  try {
    const limit = Math.min(
      parseInt(String(req.query.limit ?? "24"), 10) || 24,
      100,
    );
    const runs = await WhitelabelBonusRun.find({})
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

/** GET /current — { accruing, settling }. */
router.get("/current", async (_req: GarageAdminRequest, res: Response) => {
  try {
    const keys = currentPeriodKeys();
    // Also surface whether the settling period has an existing run
    // record + its status — the FE uses this to decide button state
    // (Preview vs Execute vs "already paid").
    const settlingRun = await WhitelabelBonusRun.findOne({
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

/**
 * GET /runs/:periodKey — run detail + hydrated payouts.
 * ?payoutStatus=pending|paid|failed  narrows.
 */
router.get(
  "/runs/:periodKey",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { periodKey } = req.params;
      const run = await WhitelabelBonusRun.findOne({ periodKey }).lean();
      if (!run) return res.status(404).json({ error: "Run not found" });

      const limit = Math.min(
        parseInt(String(req.query.limit ?? "200"), 10) || 200,
        1000,
      );
      const skip = Math.max(parseInt(String(req.query.skip ?? "0"), 10) || 0, 0);

      const payoutFilter: any = { runId: run._id };
      if (req.query.payoutStatus) {
        payoutFilter.payoutStatus = String(req.query.payoutStatus);
      }

      const [payouts, total] = await Promise.all([
        WhitelabelBonusPayout.find(payoutFilter)
          .sort({ bonusUsd: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        WhitelabelBonusPayout.countDocuments(payoutFilter),
      ]);

      // Hydrate user names for display.
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

/**
 * POST /runs/:periodKey/execute
 * Body: { dryRun?: boolean }
 *
 * Refuses paid periods with 409. Returns 423 when the cron lease is
 * held by another replica.
 */
router.post(
  "/runs/:periodKey/execute",
  async (req: GarageAdminRequest, res: Response) => {
    const { periodKey } = req.params;
    const dryRun = req.body?.dryRun === true;
    const admin: any = (req as any).garageAdmin;
    try {
      const outcome = await executeWhitelabelMonthlyBonusRun(periodKey, {
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
