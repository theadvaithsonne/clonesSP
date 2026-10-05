// src/routes/publicFoundersOffice.ts
//
// PUBLIC earnings calculator for referring Founders Office ($96/month)
// subscriptions. No auth, no user context, no writes.
//
//   GET  /public/founders-office/plan        the split and the volume-bonus tiers
//   GET  /public/founders-office/earnings    calculator via query params
//   POST /public/founders-office/earnings    calculator via JSON body
import { Router, Request, Response } from "express";
import { z } from "zod";
import { getActiveUnilevelPlusPlan } from "../services/unilevelPlusCommission";
import {
  calculateFoundersOfficeEarnings,
  FoundersOfficeInput,
} from "../services/foundersOfficeCalculator";

const router = Router();

const MAX_SUBS = 1_000_000;
const MAX_DIRECTS = 1000;
const MAX_DUPLICATION = 50;
const MAX_MONTHS = 120;

const inputSchema = z.object({
  newSubsThisMonth: z.number().int().min(0).max(MAX_SUBS).default(0),
  activeDirectSubs: z.number().int().min(0).max(MAX_SUBS).default(0),
  directs: z.number().int().min(0).max(MAX_DIRECTS).optional(),
  subsByLevel: z.array(z.number().min(0).max(MAX_SUBS)).max(15).optional(),
  duplication: z.number().min(0).max(MAX_DUPLICATION).optional(),
  depth: z.number().int().min(1).max(15).optional(),
  months: z.number().int().min(1).max(MAX_MONTHS).optional(),
});

function parseQuery(q: Request["query"]): unknown {
  const num = (v: unknown) => (v === undefined || v === "" ? undefined : Number(v));
  const list = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.split(",").map((s) => Number(s.trim())) : undefined;
  return {
    newSubsThisMonth: num(q.newSubsThisMonth) ?? 0,
    activeDirectSubs: num(q.activeDirectSubs) ?? 0,
    directs: num(q.directs),
    subsByLevel: list(q.subsByLevel),
    duplication: num(q.duplication),
    depth: num(q.depth),
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
        "newSubsThisMonth = new Founders Office sales you closed this month; activeDirectSubs = all active subs you referred. " +
        "Optionally subsByLevel[] (active subs per level, level 1 first) OR duplication + depth, plus directs (your UP-active legs) and months.",
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
  const result = calculateFoundersOfficeEarnings(plan, parsed.data as FoundersOfficeInput);
  return res.json({ success: true, ...result });
}

/** GET /public/founders-office/plan */
router.get("/plan", async (_req: Request, res: Response) => {
  const plan = await getActiveUnilevelPlusPlan();
  if (!plan) {
    return res.status(503).json({
      success: false,
      error: "plan_unavailable",
      message: "The Unilevel Plus plan is not configured.",
    });
  }
  const { plan: shape, qualifications, assumptions } = calculateFoundersOfficeEarnings(plan, {});
  return res.json({ success: true, plan: shape, qualifications, assumptions });
});

/** GET /public/founders-office/earnings?newSubsThisMonth=10&activeDirectSubs=30&duplication=2&depth=3&months=12 */
router.get("/earnings", async (req: Request, res: Response) => {
  try {
    return await respond(parseQuery(req.query), res);
  } catch (err: any) {
    console.error("[PublicFoundersOffice] earnings failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

/** POST /public/founders-office/earnings  { newSubsThisMonth, activeDirectSubs, ... } */
router.post("/earnings", async (req: Request, res: Response) => {
  try {
    return await respond(req.body ?? {}, res);
  } catch (err: any) {
    console.error("[PublicFoundersOffice] earnings failed:", err);
    return res.status(500).json({ success: false, error: "internal", message: err?.message });
  }
});

export default router;
