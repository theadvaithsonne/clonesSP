// src/routes/publicUnilevelPlus.ts
//
// PUBLIC Unilevel Plus earnings calculator. No auth, no user context, no
// writes — it reads the live plan config and runs a pure projection, so it is
// safe to call from a marketing page or an affiliate's own site.
//
// Deliberately takes a HYPOTHETICAL org shape rather than a userId: quoting a
// real person's downline would leak their network size to anyone who could
// guess an id, and the whole point is letting a prospect model "what if".
//
//   GET  /public/unilevel-plus/plan         the pool structure and the rules
//   GET  /public/unilevel-plus/earnings     calculator via query params
//   POST /public/unilevel-plus/earnings     calculator via JSON body
//
// Inputs are clamped rather than rejected wherever a silly number would only
// produce a silly answer — a public endpoint should not be a way to make the
// server do unbounded work.

import { Router, Request, Response } from "express";
import { z } from "zod";
import { getActiveUnilevelPlusPlan } from "../services/unilevelPlusCommission";
import {
  calculateUnilevelPlusEarnings,
  CalculatorInput,
} from "../services/unilevelPlusCalculator";

const router = Router();

/** Ceilings that keep a public projection cheap and believable. */
const MAX_DIRECTS = 1000;
const MAX_DUPLICATION = 50;
const MAX_LEVEL_HEADCOUNT = 10_000_000;

const inputSchema = z.object({
  // Defaults to 0 so GET and POST behave identically. The query parser has to
  // supply a value for every field anyway, so without a default here the same
  // omission would 400 on POST and quietly return the zero case on GET.
  directs: z.number().int().min(0).max(MAX_DIRECTS).default(0),
  levels: z.array(z.number().int().min(0).max(MAX_LEVEL_HEADCOUNT)).max(15).optional(),
  duplication: z.number().min(0).max(MAX_DUPLICATION).optional(),
  depth: z.number().int().min(1).max(15).optional(),
  licencePrice: z.number().min(0.01).max(100000).optional(),
});

/** Query params arrive as strings; `levels` accepts "5,25,125". */
function parseQuery(q: Request["query"]): unknown {
  const num = (v: unknown) =>
    v === undefined || v === "" ? undefined : Number(v);
  const levels =
    typeof q.levels === "string" && q.levels.trim()
      ? q.levels.split(",").map((s) => Number(s.trim()))
      : undefined;
  return {
    directs: num(q.directs) ?? 0,
    levels,
    duplication: num(q.duplication),
    depth: num(q.depth),
    licencePrice: num(q.licencePrice),
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
      hint: "directs is required. Optionally send levels[] (headcount per level, level 1 first) OR duplication + depth.",
    });
  }
  const plan = await getActiveUnilevelPlusPlan();
  if (!plan) {
    return res.status(503).json({
      success: false,
      error: "plan_unavailable",
      message: "The Unilevel Plus plan is not configured.",
    });
  }
  const result = calculateUnilevelPlusEarnings(plan, parsed.data as CalculatorInput);
  return res.json({ success: true, ...result });
}

/**
 * GET /public/unilevel-plus/plan
 *
 * The rules with no projection attached — pool split, gates and multipliers.
 * Useful for rendering a plan page that can never drift from the live config.
 */
router.get("/plan", async (_req: Request, res: Response) => {
  const plan = await getActiveUnilevelPlusPlan();
  if (!plan) {
    return res.status(503).json({
      success: false,
      error: "plan_unavailable",
      message: "The Unilevel Plus plan is not configured.",
    });
  }
  // directs: 0 gives the pool structure with an empty projection.
  const { plan: shape, qualifications, assumptions } =
    calculateUnilevelPlusEarnings(plan, { directs: 0 });
  return res.json({ success: true, plan: shape, qualifications, assumptions });
});

/** GET /public/unilevel-plus/earnings?directs=10&duplication=5&depth=4 */
router.get("/earnings", async (req: Request, res: Response) => {
  try {
    return await respond(parseQuery(req.query), res);
  } catch (err: any) {
    console.error("[PublicUP] earnings failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

/** POST /public/unilevel-plus/earnings  { directs, levels? | duplication+depth? } */
router.post("/earnings", async (req: Request, res: Response) => {
  try {
    return await respond(req.body ?? {}, res);
  } catch (err: any) {
    console.error("[PublicUP] earnings failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

export default router;
