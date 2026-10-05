// User-facing view of the NetworkChain rank bonus.
//
// Strictly self-service: every handler derives the subject from the JWT, so
// there is no way to read another member's tree from here. The admin surface
// (routes/garageAdminRankBonus.ts) is the only place an arbitrary userId can be
// queried, and it is super-admin gated.
//
// Read-only. Nothing here triggers a run or moves money.

import { Router, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { RankPlan } from "../models/rankPlan.model";
import { RankQualification } from "../models/rankQualification.model";
import { RankRun, periodKeyFor } from "../models/rankRun.model";
import { getUserRankDetail } from "../services/rankBonus/detail";

const router = Router();

router.use(requireAuth);

/**
 * GET /rank-bonus/me
 *
 * Everything the member can see about their own standing: current rank, their
 * own subscription state, each direct with whether it counts, per-leg top rank,
 * what would promote them, and their payout history — plus the plan ladder so
 * the UI can show what each rank is worth.
 */
router.get("/me", async (req, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const plan = await RankPlan.findOne({ isActive: true }).lean();
    if (!plan) {
      return res.status(503).json({ error: "Rank bonus is not configured yet" });
    }

    const detail = await getUserRankDetail(
      me.userId,
      plan.thirdPartyClientId
    );
    if (!detail) return res.status(404).json({ error: "User not found" });

    // Lifetime earnings, counting only what actually settled. Dry-run and
    // pending rows are deliberately excluded so the figure never overstates.
    const paid = await RankQualification.find({
      userId: me.userId,
      payoutStatus: "paid",
    })
      .select({ bonusUsd: 1 })
      .lean();
    const lifetimeUsd =
      Math.round(paid.reduce((s, r) => s + (r.bonusUsd || 0), 0) * 100) / 100;

    return res.json({
      ...detail,
      lifetimeUsd,
      currentPeriodKey: periodKeyFor(new Date()),
      plan: {
        version: plan.version,
        bronzeStacks: plan.bronzeStacks,
        tiers: plan.tiers,
      },
    });
  } catch (err: any) {
    console.error("[RankBonus] /me failed:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /rank-bonus/plan
 *
 * The ladder on its own, for anyone who wants to see what the ranks pay before
 * they have a tree of their own.
 */
router.get("/plan", async (_req, res: Response) => {
  try {
    const plan = await RankPlan.findOne({ isActive: true }).lean();
    if (!plan) {
      return res.status(503).json({ error: "Rank bonus is not configured yet" });
    }
    return res.json({
      version: plan.version,
      bronzeStacks: plan.bronzeStacks,
      tiers: plan.tiers,
      note: plan.note,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /rank-bonus/me/history
 *
 * Payout rows for the signed-in member, newest first, with the run's dry-run
 * flag joined on so a $0 month is self-explanatory rather than looking like a
 * failure.
 */
router.get("/me/history", async (req, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const limit = Math.min(
      parseInt(String(req.query.limit ?? "24"), 10) || 24,
      100
    );
    const rows = await RankQualification.find({ userId: me.userId })
      .sort({ periodKey: -1 })
      .limit(limit)
      .lean();

    const runs = await RankRun.find({
      periodKey: { $in: rows.map((r) => r.periodKey) },
    })
      .select({ periodKey: 1, dryRun: 1, status: 1 })
      .lean();
    const runByPeriod = new Map(runs.map((r) => [r.periodKey, r]));

    return res.json({
      rows: rows.map((r) => ({
        periodKey: r.periodKey,
        rank: r.rank,
        bonusUsd: r.bonusUsd,
        payoutStatus: r.payoutStatus,
        routedToPlatform: r.routedToPlatform,
        paidAt: r.paidAt ?? null,
        basis: r.basis,
        dryRun: runByPeriod.get(r.periodKey)?.dryRun ?? false,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
