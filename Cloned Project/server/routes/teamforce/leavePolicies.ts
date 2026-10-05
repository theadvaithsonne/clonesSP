import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import {
  TeamforceLeavePolicy,
  LEAVE_POLICY_TYPES,
  LEAVE_POLICY_APPLICABLE,
} from "../../models/teamforce/teamforceLeavePolicy.model";
import {
  getOrgIdStrict,
  requireTeamforceWriteAccess,
} from "./_helpers";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  leaveType: z.enum(LEAVE_POLICY_TYPES),
  annualQuota: z.number().int().min(0).default(0),
  maxConsecutiveDays: z.number().int().min(0).default(0),
  applicableFor: z.enum(LEAVE_POLICY_APPLICABLE).default("All Employees"),
  allowCarryForward: z.boolean().default(false),
  allowEncashment: z.boolean().default(false),
});

const updateSchema = createSchema.partial();

router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const policies = await TeamforceLeavePolicy.find({
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  })
    .sort({ name: 1 })
    .lean();

  res.json({ policies });
});

router.post("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = createSchema.parse(req.body);
  const policy = await TeamforceLeavePolicy.create({
    orgId: new Types.ObjectId(orgId),
    ...body,
  });
  res.status(201).json({ policy });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = updateSchema.parse(req.body);
  const policy = await TeamforceLeavePolicy.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: body },
    { new: true }
  ).lean();

  if (!policy) return res.status(404).json({ error: "Policy not found" });
  res.json({ policy });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  await TeamforceLeavePolicy.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: { isActive: false } }
  );
  res.json({ ok: true });
});

export default router;
