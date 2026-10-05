// src/routes/publicWhiteLabel.ts
//
// PUBLIC earnings calculator for referring White Label ($600/year)
// subscriptions. No auth, no user context, no writes.
//
//   GET  /public/white-label/plan        the split and the volume-bonus tiers
//   GET  /public/white-label/earnings    calculator via query params
//   POST /public/white-label/earnings    calculator via JSON body
import { Router, Request, Response } from "express";
import { z } from "zod";
import { getActiveUnilevelPlusPlan } from "../services/unilevelPlusCommission";
import {
  calculateWhiteLabelEarnings,
  WhiteLabelInput,
} from "../services/whiteLabelCalculator";

const router = Router();

const MAX_LICENCES = 1_000_000;
const MAX_DIRECTS = 1000;
const MAX_DUPLICATION = 50;
const MAX_YEARS = 20;

const inputSchema = z.object({
  newSalesThisMonth: z.number().int().min(0).max(MAX_LICENCES).default(0),
  activeDirectLicences: z.number().int().min(0).max(MAX_LICENCES).default(0),
  directs: z.number().int().min(0).max(MAX_DIRECTS).optional(),
  licencesByLevel: z.array(z.number().min(0).max(MAX_LICENCES)).max(15).optional(),
  duplication: z.number().min(0).max(MAX_DUPLICATION).optional(),
  depth: z.number().int().min(1).max(15).optional(),
  years: z.number().int().min(1).max(MAX_YEARS).optional(),
});

function parseQuery(q: Request["query"]): unknown {
  const num = (v: unknown) => (v === undefined || v === "" ? undefined : Number(v));
  const list = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.split(",").map((s) => Number(s.trim())) : undefined;
  return {
    newSalesThisMonth: num(q.newSalesThisMonth) ?? 0,
    activeDirectLicences: num(q.activeDirectLicences) ?? 0,
    directs: num(q.directs),
    licencesByLevel: list(q.licencesByLevel),
    duplication: num(q.duplication),
    depth: num(q.depth),
    years: num(q.years),
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
        "newSalesThisMonth = new White Label sales you closed this month; activeDirectLicences = all active licences you referred. " +
        "Optionally licencesByLevel[] (active licences per level, level 1 first) OR duplication + depth, plus directs (your UP-active legs) and years.",
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
  const result = calculateWhiteLabelEarnings(plan, parsed.data as WhiteLabelInput);
  return res.json({ success: true, ...result });
}

/** GET /public/white-label/plan */
router.get("/plan", async (_req: Request, res: Response) => {
  const plan = await getActiveUnilevelPlusPlan();
  if (!plan) {
    return res.status(503).json({
      success: false,
      error: "plan_unavailable",
      message: "The Unilevel Plus plan is not configured.",
    });
  }
  const { plan: shape, qualifications, assumptions } = calculateWhiteLabelEarnings(plan, {});
  return res.json({ success: true, plan: shape, qualifications, assumptions });
});

/** GET /public/white-label/earnings?newSalesThisMonth=3&activeDirectLicences=12&years=1 */
router.get("/earnings", async (req: Request, res: Response) => {
  try {
    return await respond(parseQuery(req.query), res);
  } catch (err: any) {
    console.error("[PublicWhiteLabel] earnings failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

/** POST /public/white-label/earnings  { newSalesThisMonth, activeDirectLicences, ... } */
router.post("/earnings", async (req: Request, res: Response) => {
  try {
    return await respond(req.body ?? {}, res);
  } catch (err: any) {
    console.error("[PublicWhiteLabel] earnings failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

export default router;
