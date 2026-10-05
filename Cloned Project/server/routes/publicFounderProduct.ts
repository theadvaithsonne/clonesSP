// src/routes/publicFounderProduct.ts
//
// PUBLIC earnings calculator for founder-set commission on store items. No
// auth, no user context, no writes — safe for a marketing page.
//
// Takes the plan SHAPE, not an item id: quoting a real item would reveal what
// its founder chose to pay, and the point is letting a prospect model "what
// if a founder paid X% on a $Y product".
//
// DEFAULT KIND IS "unilevel_plus": the founder picks the Unilevel Plus comp
// plan when creating an item and sets ONE percentage, which is split through
// the tree proportionally (see services/founderProductCalculator.ts). The
// fixed L1/L2/L3 kind is still reachable with kind=levels for legacy plans.
//
//   GET  /public/founder-products/plan        the two engines and their rules
//   GET  /public/founder-products/earnings    calculator via query params
//   POST /public/founder-products/earnings    calculator via JSON body
//
// Inputs are clamped rather than rejected wherever a silly number would only
// produce a silly answer.
import { Router, Request, Response } from "express";
import { z } from "zod";
import { getActiveUnilevelPlusPlan } from "../services/unilevelPlusCommission";
import {
  calculateFounderProductEarnings,
  COMB_PLAN_MAX_PERCENTAGE,
  UP_MAX_LEVELS,
  FounderCalculatorInput,
} from "../services/founderProductCalculator";

const router = Router();

const MAX_DIRECTS = 1000;
const MAX_DUPLICATION = 50;
const MAX_SALES_PER_LEVEL = 10_000_000;
const MAX_MONTHS = 120;

const inputSchema = z.object({
  kind: z.enum(["levels", "unilevel_plus"]).default("unilevel_plus"),
  productPrice: z.number().min(0.01).max(1_000_000),
  levelPercents: z.array(z.number().min(0).max(COMB_PLAN_MAX_PERCENTAGE)).max(UP_MAX_LEVELS).optional(),
  commissionPercent: z.number().min(0).max(COMB_PLAN_MAX_PERCENTAGE).optional(),
  directs: z.number().int().min(0).max(MAX_DIRECTS).default(0),
  salesByLevel: z.array(z.number().min(0).max(MAX_SALES_PER_LEVEL)).max(UP_MAX_LEVELS).optional(),
  duplication: z.number().min(0).max(MAX_DUPLICATION).optional(),
  depth: z.number().int().min(1).max(UP_MAX_LEVELS).optional(),
  salesPerPerson: z.number().min(0).max(1000).optional(),
  months: z.number().int().min(1).max(MAX_MONTHS).optional(),
});

/** Query params arrive as strings; lists accept "10,5,2". */
function parseQuery(q: Request["query"]): unknown {
  const num = (v: unknown) => (v === undefined || v === "" ? undefined : Number(v));
  const list = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.split(",").map((s) => Number(s.trim())) : undefined;
  return {
    kind: typeof q.kind === "string" && q.kind ? q.kind : undefined,
    productPrice: num(q.productPrice),
    levelPercents: list(q.levelPercents),
    commissionPercent: num(q.commissionPercent),
    directs: num(q.directs) ?? 0,
    salesByLevel: list(q.salesByLevel),
    duplication: num(q.duplication),
    depth: num(q.depth),
    salesPerPerson: num(q.salesPerPerson),
    months: num(q.months),
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
      hint:
        "productPrice and commissionPercent are required (the founder's single % into the Unilevel Plus tree), plus directs (your UP-active legs). " +
        "kind=levels with levelPercents (e.g. 10,5) models a legacy fixed-level plan instead. " +
        "Describe sales with salesByLevel[] (purchases per month, level 1 first) OR directs + duplication + depth (+ salesPerPerson).",
    });
  }
  const input = parsed.data as FounderCalculatorInput;

  if (input.kind === "levels" && !input.levelPercents?.length) {
    return res.status(400).json({
      success: false,
      error: "invalid_input",
      message: "levelPercents is required for kind=levels (e.g. 10,5 for 10% at L1 and 5% at L2).",
    });
  }
  if (input.kind === "unilevel_plus" && !(input.commissionPercent! > 0)) {
    return res.status(400).json({
      success: false,
      error: "invalid_input",
      message: "commissionPercent is required — the single percentage the founder assigns to the Unilevel Plus comp plan.",
    });
  }

  // Only the tree kind needs the live plan — the levels kind is fully
  // described by the founder's own numbers.
  const plan = input.kind === "unilevel_plus" ? await getActiveUnilevelPlusPlan() : null;
  if (input.kind === "unilevel_plus" && !plan) {
    return res.status(503).json({
      success: false,
      error: "plan_unavailable",
      message: "The Unilevel Plus plan is not configured.",
    });
  }

  try {
    const result = calculateFounderProductEarnings(input, plan);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    if (err instanceof RangeError) {
      return res.status(400).json({ success: false, error: "invalid_input", message: err.message });
    }
    throw err;
  }
}

/**
 * GET /public/founder-products/plan
 * The two engines a founder can choose from, with worked $100 / 10% examples.
 */
router.get("/plan", async (_req: Request, res: Response) => {
  const plan = await getActiveUnilevelPlusPlan();
  const levels = calculateFounderProductEarnings({
    kind: "levels",
    productPrice: 100,
    levelPercents: [10, 5],
  });
  const tree = plan
    ? calculateFounderProductEarnings(
        { kind: "unilevel_plus", productPrice: 100, commissionPercent: 10, directs: 0 },
        plan
      )
    : null;
  return res.json({
    success: true,
    defaultKind: "unilevel_plus",
    maxCommissionPercent: COMB_PLAN_MAX_PERCENTAGE,
    kinds: {
      unilevel_plus: tree
        ? {
            description:
              "The founder assigns the Unilevel Plus comp plan to the item and sets one percentage. That pool is split through the tree proportionally — 36% direct, 28.8% levels, 4.8% / 24% infinity — and the company share and manager pool return to the founder.",
            example: { plan: tree.plan, qualifications: tree.qualifications, assumptions: tree.assumptions },
          }
        : { description: "Unavailable — the Unilevel Plus plan is not configured." },
      levels: {
        description:
          "Legacy: the founder sets a fixed percentage for each upline level (L1, L2, L3…). L1 is the buyer's direct referrer. Only used when kind=levels is passed explicitly.",
        example: { plan: levels.plan, assumptions: levels.assumptions },
      },
    },
  });
});

/** GET /public/founder-products/earnings?productPrice=40&commissionPercent=10&directs=5&duplication=2&depth=8 */
router.get("/earnings", async (req: Request, res: Response) => {
  try {
    return await respond(parseQuery(req.query), res);
  } catch (err: any) {
    console.error("[PublicFounderProducts] earnings failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

/** POST /public/founder-products/earnings  { productPrice, kind?, levelPercents? | commissionPercent?, ... } */
router.post("/earnings", async (req: Request, res: Response) => {
  try {
    return await respond(req.body ?? {}, res);
  } catch (err: any) {
    console.error("[PublicFounderProducts] earnings failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

export default router;
