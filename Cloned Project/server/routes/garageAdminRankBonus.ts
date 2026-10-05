// Admin surface for the NetworkChain monthly rank bonus.
//
// Same gate as /garage-admin/wallets and /garage-admin/auction-settlements —
// super-admin only, because the manual trigger can move real money.
//
// The primary use before launch is the dry run: GET a computed run and read the
// qualifier list and total bill, then decide whether to set
// RANK_BONUS_PAYOUTS_ENABLED=true.

import { Router, Response } from "express";
import { Types } from "mongoose";
import {
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import {
  RankRun,
  periodKeyFor,
  previousPeriodKeyFor,
} from "../models/rankRun.model";
import { RankQualification } from "../models/rankQualification.model";
import { RankPlan } from "../models/rankPlan.model";
import { User } from "../models/user.model";
import {
  executeRankBonusRun,
  payoutsEnabled,
  firstEligiblePeriod,
} from "../services/rankBonus/run";
import {
  getUserRankDetail,
  listSubscribers,
} from "../services/rankBonus/detail";

const router = Router();

/**
 * POST /garage-admin/rank-bonus/cron
 *
 * External-cron entry point, as an alternative or backstop to the in-process
 * hourly tick in index.ts. Same shared-secret scheme as
 * /api/invoices/cron/generate-recurring, but with the `!expectedSecret` guard
 * that one is missing — without it, an unset CRON_WEBHOOK_SECRET makes
 * `undefined !== undefined` false and leaves the endpoint wide open.
 *
 * Declared BEFORE the admin auth middleware, since cron has no admin JWT.
 * Settles the month that has just closed and is idempotent on the period, so it
 * is safe to call on any schedule — hourly, daily, or only on the 1st.
 */
router.post("/cron", async (req, res: Response) => {
  const incoming = req.headers["x-webhook-secret"] || req.headers["x-cron-secret"];
  const expected = process.env.CRON_WEBHOOK_SECRET;
  if (!expected || incoming !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { rankBonusTick } = await import("../services/rankBonus/run");
    await rankBonusTick();
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[RankBonus] cron endpoint failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.use(requireGarageAdminAuth, requireGarageSuperAdmin);

/** GET /garage-admin/rank-bonus/runs — run history, newest first. */
router.get("/runs", async (req: GarageAdminRequest, res: Response) => {
  try {
    const limit = Math.min(
      parseInt(String(req.query.limit ?? "24"), 10) || 24,
      100
    );
    const runs = await RankRun.find({})
      .sort({ periodKey: -1 })
      .limit(limit)
      .lean();
    return res.json({
      payoutsEnabled: payoutsEnabled(),
      runs,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /garage-admin/rank-bonus/runs/:periodKey
 *
 * Run detail plus its qualifiers. `?rank=Silver` and `?payoutStatus=failed`
 * narrow the list — the latter is the stuck-payment view.
 */
router.get("/runs/:periodKey", async (req: GarageAdminRequest, res: Response) => {
  try {
    const { periodKey } = req.params;
    const run = await RankRun.findOne({ periodKey }).lean();
    if (!run) return res.status(404).json({ error: "Run not found" });

    const limit = Math.min(
      parseInt(String(req.query.limit ?? "200"), 10) || 200,
      1000
    );
    const skip = Math.max(parseInt(String(req.query.skip ?? "0"), 10) || 0, 0);

    const q: any = { periodKey };
    if (req.query.rank) q.rank = String(req.query.rank);
    if (req.query.payoutStatus) q.payoutStatus = String(req.query.payoutStatus);

    const [rows, total] = await Promise.all([
      RankQualification.find(q)
        .sort({ bonusUsd: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RankQualification.countDocuments(q),
    ]);

    // Hydrate names in one round trip rather than per row.
    const users = await User.find({ _id: { $in: rows.map((r) => r.userId) } })
      .select({ _id: 1, name: 1, email: 1, affiliateId: 1 })
      .lean();
    const byId = new Map(users.map((u) => [u._id.toString(), u]));

    return res.json({
      run,
      total,
      qualifiers: rows.map((r) => {
        const u = byId.get(r.userId.toString());
        return {
          ...r,
          user: u
            ? { id: u._id, name: u.name, email: u.email, affiliateId: u.affiliateId }
            : null,
        };
      }),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /garage-admin/rank-bonus/runs/:periodKey/execute
 *
 * Manual trigger. Recomputes and, if payouts are enabled, pays. Body
 * `{ "dryRun": true }` forces report-only regardless of the env var — the safe
 * way to preview a period.
 *
 * Refuses a period that has already paid; reopening it could change ranks under
 * people who were already credited.
 */
router.post(
  "/runs/:periodKey/execute",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { periodKey } = req.params;
      if (!/^\d{4}-\d{2}$/.test(periodKey)) {
        return res.status(400).json({ error: "periodKey must be YYYY-MM" });
      }
      const outcome = await executeRankBonusRun({
        periodKey,
        forceDryRun: req.body?.dryRun === true,
        triggeredBy: `admin:${req.garageAdmin?.email || "unknown"}`,
      });

      const code =
        outcome.status === "completed"
          ? 200
          : outcome.status === "already_paid"
          ? 409
          : outcome.status === "skipped_locked"
          ? 423
          : 500;
      return res.status(code).json(outcome);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/**
 * GET /garage-admin/rank-bonus/people
 *   ?search=&status=active|inactive&rank=Silver&limit=&skip=
 *
 * The people-first view. Everyone in the tree with their subscription state,
 * who referred them, and their rank — the list the admin actually browses.
 */
router.get("/people", async (req: GarageAdminRequest, res: Response) => {
  try {
    const plan = await RankPlan.findOne({ isActive: true }).lean();
    if (!plan) return res.status(404).json({ error: "No active RankPlan" });

    const out = await listSubscribers({
      thirdPartyClientId: plan.thirdPartyClientId,
      search: req.query.search ? String(req.query.search) : undefined,
      status:
        req.query.status === "active" || req.query.status === "inactive"
          ? req.query.status
          : undefined,
      rank: req.query.rank ? String(req.query.rank) : undefined,
      sortBy: req.query.sortBy ? String(req.query.sortBy) : undefined,
      sortOrder: req.query.sortOrder === "asc" ? "asc" : "desc",
      limit: parseInt(String(req.query.limit ?? "50"), 10) || 50,
      skip: parseInt(String(req.query.skip ?? "0"), 10) || 0,
    });
    return res.json(out);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /garage-admin/rank-bonus/people/:userId
 *
 * Everything about one person: who referred them, their subscription state and
 * WHY it's inactive if it is, every direct with their active flag, each leg's
 * top rank, their payout history, and what would promote them next.
 */
router.get("/people/:userId", async (req: GarageAdminRequest, res: Response) => {
  try {
    if (!Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }
    const plan = await RankPlan.findOne({ isActive: true }).lean();
    if (!plan) return res.status(404).json({ error: "No active RankPlan" });

    const detail = await getUserRankDetail(
      req.params.userId,
      plan.thirdPartyClientId
    );
    if (!detail) return res.status(404).json({ error: "User not found" });
    return res.json(detail);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /garage-admin/rank-bonus/plan — the active config and its version. */
router.get("/plan", async (_req: GarageAdminRequest, res: Response) => {
  try {
    const plan = await RankPlan.findOne({ isActive: true }).lean();
    if (!plan) return res.status(404).json({ error: "No active RankPlan" });
    return res.json({ plan, payoutsEnabled: payoutsEnabled() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /garage-admin/rank-bonus/current
 *
 * Two distinct months, which the UI must not conflate:
 *   accruing — the month in progress. Previewable, but not payable until it ends.
 *   settling — the month that has closed and is what the cron pays next.
 */
router.get("/current", async (_req: GarageAdminRequest, res: Response) => {
  try {
    const now = new Date();
    const accruingPeriodKey = periodKeyFor(now);
    const settlingPeriodKey = previousPeriodKeyFor(now);

    const [accruingRun, settlingRun, floor] = await Promise.all([
      RankRun.findOne({ periodKey: accruingPeriodKey }).lean(),
      RankRun.findOne({ periodKey: settlingPeriodKey }).lean(),
      firstEligiblePeriod(),
    ]);

    return res.json({
      accruingPeriodKey,
      accruingRun,
      settlingPeriodKey,
      settlingRun,
      // False before the first full month has closed — on a mid-August launch
      // the "previous month" is July, which predates the plan and must not be
      // offered as payable.
      settlingEligible: settlingPeriodKey >= floor,
      firstEligiblePeriod: floor,
      payoutsEnabled: payoutsEnabled(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
