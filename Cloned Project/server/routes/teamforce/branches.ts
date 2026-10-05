import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import { TeamforceBranch } from "../../models/teamforce/teamforceBranch.model";
import {
  getOrgIdStrict,
  requireTeamforceWriteAccess,
} from "./_helpers";

const router = Router();

// List branches
router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const branches = await TeamforceBranch.find({
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  })
    .sort({ name: 1 })
    .lean();

  res.json({ branches });
});

// Create branch
router.post("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = z
    .object({
      name: z.string().min(1).max(200).trim(),
      code: z.string().max(50).trim().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
    })
    .parse(req.body);

  // Case-insensitive duplicate check within the org
  const existing = await TeamforceBranch.findOne({
    orgId: new Types.ObjectId(orgId),
    name: { $regex: `^${body.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    isActive: true,
  });
  if (existing) {
    res.status(409).json({ error: "Branch name already exists" });
    return;
  }

  const branch = await TeamforceBranch.create({
    orgId: new Types.ObjectId(orgId),
    ...body,
  });

  res.status(201).json({ branch });
});

// Update branch
router.patch("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = z
    .object({
      name: z.string().min(1).max(200).trim().optional(),
      code: z.string().max(50).trim().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
    })
    .parse(req.body);

  if (body.name) {
    const existing = await TeamforceBranch.findOne({
      orgId: new Types.ObjectId(orgId),
      name: { $regex: `^${body.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      isActive: true,
      _id: { $ne: req.params.id },
    });
    if (existing) {
      res.status(409).json({ error: "Branch name already exists" });
      return;
    }
  }

  const branch = await TeamforceBranch.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: body },
    { new: true }
  ).lean();

  if (!branch) return res.status(404).json({ error: "Branch not found" });
  res.json({ branch });
});

// Soft delete branch
router.delete("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  await TeamforceBranch.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: { isActive: false } }
  );

  res.json({ ok: true });
});

export default router;
