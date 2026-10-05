import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import {
  TeamforceBreakSettings,
  BREAK_SCOPE_TYPES,
} from "../../models/teamforce/teamforceBreakSettings.model";
import { TeamforceBreakLog } from "../../models/teamforce/teamforceBreakLog.model";
import { TeamforceEmployeeProfile } from "../../models/teamforce/teamforceEmployeeProfile.model";
import {
  getAuthUser,
  getOrgIdStrict,
  requireTeamforceWriteAccess,
} from "./_helpers";

const router = Router();

// One-shot: drop the legacy singleton-per-org unique index if present so the
// new compound {orgId, name} index can coexist. Ignored if not present.
TeamforceBreakSettings.collection
  .dropIndex("orgId_1")
  .catch(() => {
    /* index didn't exist — fine */
  });

const policyBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  activateBreaks: z.boolean().optional(),
  scopeType: z.enum(BREAK_SCOPE_TYPES).optional(),
  scopeTargets: z.array(z.string()).optional(),
  breakMinutesPerDay: z.number().int().min(0).optional(),
  breachAffectsPayroll: z.boolean().optional(),
  maxBreachMinutesAllowed: z.number().int().min(0).optional(),
  maxBreachesAllowed: z.number().int().min(0).optional(),
  payrollImpact: z
    .object({
      deductHalfDay: z.boolean().optional(),
      deductHourly: z
        .object({
          enabled: z.boolean().optional(),
          ofBasic: z.boolean().optional(),
          ofCtc: z.boolean().optional(),
        })
        .optional(),
      fixedAmount: z.number().min(0).optional(),
    })
    .optional(),
});

const policyUpdateSchema = policyBodySchema.partial();

// List all break policies for the current org (any auth user).
router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const policies = await TeamforceBreakSettings.find({
    orgId: new Types.ObjectId(orgId),
  })
    .sort({ createdAt: 1 })
    .lean();
  res.json({ policies });
});

// Create a new break policy (admin/founder only).
router.post("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = policyBodySchema.parse(req.body);

  try {
    const created = await TeamforceBreakSettings.create({
      ...body,
      orgId: new Types.ObjectId(orgId),
    });
    res.status(201).json({ policy: created.toObject() });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ error: `A policy named "${body.name}" already exists.` });
    }
    throw err;
  }
});

// Update a break policy (admin/founder only).
router.patch("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = policyUpdateSchema.parse(req.body);

  try {
    const updated = await TeamforceBreakSettings.findOneAndUpdate(
      { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
      { $set: body },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json({ policy: updated });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ error: `A policy with that name already exists.` });
    }
    throw err;
  }
});

// Delete a break policy (admin/founder only).
router.delete("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const deleted = await TeamforceBreakSettings.findOneAndDelete({
    _id: req.params.id,
    orgId: new Types.ObjectId(orgId),
  }).lean();
  if (!deleted) {
    return res.status(404).json({ error: "Policy not found" });
  }
  res.json({ ok: true });
});

const SCOPE_PRIORITY: Record<string, number> = {
  "By Designation": 3,
  "By Department": 2,
  Universal: 1,
};

/** Find the single break policy that currently applies to this user.
 *  Only activated policies are considered. When multiple match, pick the
 *  one with the most specific scope (Designation > Department > Universal).
 *  Ties are broken by alphabetical name for determinism. */
export async function findApplicablePolicy(
  userId: string,
  orgId: string
): Promise<any | null> {
  const oid = new Types.ObjectId(orgId);
  const all = await TeamforceBreakSettings.find({
    orgId: oid,
    activateBreaks: true,
  }).lean();
  if (all.length === 0) return null;

  const profile = await TeamforceEmployeeProfile.findOne({
    userId: new Types.ObjectId(userId),
    orgId: oid,
  })
    .select("departmentId designation")
    .lean();

  const matching = all.filter((p: any) => {
    const scope = p.scopeType || "Universal";
    if (scope === "Universal") return true;
    if (!profile) return false;
    const targets: string[] = p.scopeTargets || [];
    if (scope === "By Department") {
      return (
        !!profile.departmentId &&
        targets.includes(String(profile.departmentId))
      );
    }
    if (scope === "By Designation") {
      return !!profile.designation && targets.includes(profile.designation);
    }
    return false;
  });

  if (matching.length === 0) return null;

  matching.sort((a: any, b: any) => {
    const ap = SCOPE_PRIORITY[a.scopeType || "Universal"] || 0;
    const bp = SCOPE_PRIORITY[b.scopeType || "Universal"] || 0;
    if (ap !== bp) return bp - ap;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
  return matching[0];
}

/** Compute the user's break status for TODAY against their applicable policy. */
router.get("/status", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  const me = getAuthUser(req);

  const oid = new Types.ObjectId(orgId);
  const policy = await findApplicablePolicy(me.userId, orgId);

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const todayLogs = await TeamforceBreakLog.find({
    userId: new Types.ObjectId(me.userId),
    orgId: oid,
    breakStartTime: { $gte: startOfDay },
  })
    .select("breakStartTime breakStopTime durationInSeconds isBreach")
    .lean();

  let usedSeconds = 0;
  let openBreak: { breakStartTime: Date } | null = null;
  for (const l of todayLogs) {
    if (l.breakStopTime) {
      usedSeconds += l.durationInSeconds || 0;
    } else {
      openBreak = { breakStartTime: l.breakStartTime };
      usedSeconds += Math.max(
        0,
        Math.floor((now.getTime() - l.breakStartTime.getTime()) / 1000)
      );
    }
  }

  const activated = !!policy;
  const inScope = !!policy;
  const budgetMinutes = policy?.breakMinutesPerDay ?? 0;
  const budgetSeconds = budgetMinutes * 60;
  const remainingSeconds = Math.max(0, budgetSeconds - usedSeconds);
  const overBudgetSeconds = Math.max(0, usedSeconds - budgetSeconds);
  const hasBreached = overBudgetSeconds > 0;

  res.json({
    activated,
    inScope,
    policyId: policy?._id || null,
    policyName: policy?.name || null,
    breakMinutesPerDay: budgetMinutes,
    budgetSeconds,
    usedSeconds,
    remainingSeconds,
    overBudgetSeconds,
    hasBreached,
    onBreak: !!openBreak,
    breakStartTime: openBreak?.breakStartTime || null,
  });
});

export default router;
