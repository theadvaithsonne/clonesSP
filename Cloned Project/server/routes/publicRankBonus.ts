// src/routes/publicRankBonus.ts
//
// PUBLIC NetworkChain rank-bonus calculator. No auth, no user context, no
// writes — it reads the live RankPlan and runs a pure projection.
//
// Like the Unilevel Plus calculator it takes a HYPOTHETICAL org shape rather
// than a userId: quoting a real member's leg structure would leak their
// network to anyone who could guess an id.
//
//   GET  /public/rank-bonus/plan       the ladder and the rules
//   GET  /public/rank-bonus/earnings   calculator via query params
//   POST /public/rank-bonus/earnings   calculator via JSON body

import { Router, Request, Response } from "express";
import { z } from "zod";
import { RankPlan, RANK_KEYS } from "../models/rankPlan.model";
import { ThirdPartyClient } from "../models/thirdPartyClient.model";
import {
  calculateRankBonus,
  RankCalculatorInput,
} from "../services/rankBonusCalculator";

const router = Router();

const MAX_DIRECTS = 10_000;
const MAX_LEGS = 10_000;
const RANK_ENUM = z.enum(RANK_KEYS as unknown as [string, ...string[]]);

const inputSchema = z.object({
  selfActive: z.boolean().optional(),
  activeDirects: z.number().int().min(0).max(MAX_DIRECTS).default(0),
  legs: z.array(RANK_ENUM.nullable()).max(MAX_LEGS).optional(),
  legsWith: z
    .object({
      Bronze: z.number().int().min(0).max(MAX_LEGS).optional(),
      Silver: z.number().int().min(0).max(MAX_LEGS).optional(),
      Gold: z.number().int().min(0).max(MAX_LEGS).optional(),
      Diamond: z.number().int().min(0).max(MAX_LEGS).optional(),
      Platinum: z.number().int().min(0).max(MAX_LEGS).optional(),
    })
    .optional(),
  sponsorBonusPerDirect: z.number().min(0).max(10_000).optional(),
});

/**
 * Query params arrive as strings.
 *   legs=Bronze,Bronze,Silver,,Gold   (empty entry = a leg with no rank)
 *   bronzeLegs=4&silverLegs=2         (shorthand for legsWith)
 */
function parseQuery(q: Request["query"]): unknown {
  const num = (v: unknown) => (v === undefined || v === "" ? undefined : Number(v));
  const legs =
    typeof q.legs === "string" && q.legs.trim()
      ? q.legs.split(",").map((s) => (s.trim() === "" ? null : s.trim()))
      : undefined;
  const legsWith = {
    Bronze: num(q.bronzeLegs),
    Silver: num(q.silverLegs),
    Gold: num(q.goldLegs),
    Diamond: num(q.diamondLegs),
    Platinum: num(q.platinumLegs),
  };
  const anyLegsWith = Object.values(legsWith).some((v) => v !== undefined);
  return {
    selfActive: q.selfActive === undefined ? undefined : q.selfActive !== "false",
    activeDirects: num(q.activeDirects) ?? 0,
    legs,
    legsWith: anyLegsWith ? legsWith : undefined,
    sponsorBonusPerDirect: num(q.sponsorBonusPerDirect),
  };
}

/** Live plan + the sponsor bonus from the partner's own product config. */
async function loadPlan() {
  const plan = await RankPlan.findOne({ isActive: true });
  if (!plan) return null;
  const client = await ThirdPartyClient.findById(plan.thirdPartyClientId)
    .select("name productConfig")
    .lean<any>();
  return {
    plan,
    clientName: client?.name || "NetworkChain",
    // upPortion is the per-month amount that flows to the direct sponsor.
    sponsorBonus: client?.productConfig?.upPortion ?? 6,
    subscriptionUsd: client?.productConfig?.totalAmount ?? 36,
  };
}

async function respond(raw: unknown, res: Response) {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "invalid_input",
      message: parsed.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; "),
      hint: "activeDirects drives Bronze. For higher ranks send legs[] (top rank per leg) OR legsWith{}.",
    });
  }
  const loaded = await loadPlan();
  if (!loaded) {
    return res.status(503).json({
      success: false,
      error: "plan_unavailable",
      message: "No active rank plan is configured.",
    });
  }
  const result = calculateRankBonus(
    loaded.plan,
    parsed.data as RankCalculatorInput,
    loaded.sponsorBonus
  );
  return res.json({
    success: true,
    clientName: loaded.clientName,
    subscriptionUsd: loaded.subscriptionUsd,
    ...result,
  });
}

/** GET /public/rank-bonus/plan — the ladder with no projection attached. */
router.get("/plan", async (_req: Request, res: Response) => {
  const loaded = await loadPlan();
  if (!loaded) {
    return res.status(503).json({
      success: false,
      error: "plan_unavailable",
      message: "No active rank plan is configured.",
    });
  }
  const { plan, ladder, assumptions } = calculateRankBonus(
    loaded.plan,
    { activeDirects: 0 },
    loaded.sponsorBonus
  );
  return res.json({
    success: true,
    clientName: loaded.clientName,
    subscriptionUsd: loaded.subscriptionUsd,
    sponsorBonusPerDirectUsd: loaded.sponsorBonus,
    plan,
    ladder: ladder.map(({ rank, requirement, paysMonthlyUsd }) => ({
      rank,
      requirement,
      paysMonthlyUsd,
    })),
    assumptions,
  });
});

/** GET /public/rank-bonus/earnings?activeDirects=5&legs=Bronze,Bronze,Bronze,Bronze */
router.get("/earnings", async (req: Request, res: Response) => {
  try {
    return await respond(parseQuery(req.query), res);
  } catch (err: any) {
    console.error("[PublicRankBonus] earnings failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

/** POST /public/rank-bonus/earnings */
router.post("/earnings", async (req: Request, res: Response) => {
  try {
    return await respond(req.body ?? {}, res);
  } catch (err: any) {
    console.error("[PublicRankBonus] earnings failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

export default router;
