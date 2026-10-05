import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import { TeamforceDepartment } from "../../models/teamforce/teamforceDepartment.model";
import {
  getOrgIdStrict,
  requireTeamforceWriteAccess,
} from "./_helpers";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const departments = await TeamforceDepartment.find({
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  })
    .populate("headId", "name email")
    .sort({ name: 1 })
    .lean();

  res.json({ departments });
});

router.post("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = z
    .object({
      name: z.string().min(1).max(200).trim(),
      description: z.string().optional(),
      headId: z.string().optional(),
    })
    .parse(req.body);

  const department = await TeamforceDepartment.create({
    orgId: new Types.ObjectId(orgId),
    name: body.name,
    description: body.description,
    headId: body.headId ? new Types.ObjectId(body.headId) : undefined,
  });

  res.status(201).json({ department });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = z
    .object({
      name: z.string().min(1).max(200).trim().optional(),
      description: z.string().optional(),
      headId: z.string().nullable().optional(),
    })
    .parse(req.body);

  const update: any = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.description !== undefined) update.description = body.description;
  if (body.headId !== undefined) {
    update.headId = body.headId
      ? new Types.ObjectId(body.headId)
      : null;
  }

  const department = await TeamforceDepartment.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: update },
    { new: true }
  ).lean();

  if (!department)
    return res.status(404).json({ error: "Department not found" });
  res.json({ department });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  await TeamforceDepartment.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: { isActive: false } }
  );

  res.json({ ok: true });
});

export default router;
