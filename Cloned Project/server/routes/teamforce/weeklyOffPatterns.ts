import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import { TeamforceWeeklyOffPattern } from "../../models/teamforce/teamforceWeeklyOffPattern.model";
import {
  getOrgIdStrict,
  requireTeamforceWriteAccess,
} from "./_helpers";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const patterns = await TeamforceWeeklyOffPattern.find({
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  })
    .sort({ name: 1 })
    .lean();

  res.json({ patterns });
});

router.post("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = z
    .object({
      name: z.string().min(1).max(200).trim(),
      patternType: z.enum(["Fixed", "Rotating"]).default("Fixed"),
      offDays: z.array(z.number().int().min(0).max(6)).default([]),
    })
    .parse(req.body);

  const pattern = await TeamforceWeeklyOffPattern.create({
    orgId: new Types.ObjectId(orgId),
    ...body,
  });

  res.status(201).json({ pattern });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = z
    .object({
      name: z.string().min(1).max(200).trim().optional(),
      patternType: z.enum(["Fixed", "Rotating"]).optional(),
      offDays: z.array(z.number().int().min(0).max(6)).optional(),
    })
    .parse(req.body);

  const pattern = await TeamforceWeeklyOffPattern.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: body },
    { new: true }
  ).lean();

  if (!pattern)
    return res.status(404).json({ error: "Pattern not found" });
  res.json({ pattern });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  await TeamforceWeeklyOffPattern.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: { isActive: false } }
  );

  res.json({ ok: true });
});

export default router;
