import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import { TeamforcePayrollConfig } from "../../models/teamforce/teamforcePayrollConfig.model";
import {
  getOrgIdStrict,
  requireTeamforceWriteAccess,
  requireFounderOnly,
} from "./_helpers";

const router = Router();

const updateSchema = z.object({
  attendanceCutoffDay: z.number().int().min(1).max(28).optional(),
  defaultState: z.string().trim().min(1).optional(),
  fyStartMonth: z.number().int().min(1).max(12).optional(),
});

async function loadOrCreateConfig(orgId: string) {
  const oid = new Types.ObjectId(orgId);
  const existing = await TeamforcePayrollConfig.findOne({ orgId: oid }).lean();
  if (existing) return existing;
  await TeamforcePayrollConfig.create({ orgId: oid });
  // Re-read via lean() so the returned shape is consistent for callers.
  return TeamforcePayrollConfig.findOne({ orgId: oid }).lean();
}

// Get this org's payroll config (creates a default if missing).
router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const config = await loadOrCreateConfig(orgId);
  res.json({ config });
});

// Update payroll config (admin/founder only). attendanceCutoffDay rejected if locked.
router.patch("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = updateSchema.parse(req.body);

  const existing = await loadOrCreateConfig(orgId);
  if (
    existing &&
    existing.locked &&
    body.attendanceCutoffDay !== undefined &&
    body.attendanceCutoffDay !== existing.attendanceCutoffDay
  ) {
    return res.status(409).json({
      error:
        "Attendance cutoff date cannot be changed after payroll has been processed. Please contact support.",
    });
  }

  const updated = await TeamforcePayrollConfig.findOneAndUpdate(
    { orgId: new Types.ObjectId(orgId) },
    { $set: body },
    { new: true, runValidators: true }
  ).lean();

  res.json({ config: updated });
});

// Founder-only master unlock — clears `locked` so the cutoff day can be
// edited again. Use sparingly: any prior approved payroll runs were
// computed against the previous cutoff window.
router.post("/unlock", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!requireFounderOnly(req, res)) return;

  const updated = await TeamforcePayrollConfig.findOneAndUpdate(
    { orgId: new Types.ObjectId(orgId) },
    { $set: { locked: false, lockedSince: null } },
    { new: true }
  ).lean();

  if (!updated)
    return res.status(404).json({ error: "Payroll config not found" });
  res.json({ config: updated });
});

export default router;
