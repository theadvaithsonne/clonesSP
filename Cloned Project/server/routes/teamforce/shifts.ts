import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import { TeamforceShift } from "../../models/teamforce/teamforceShift.model";
import {
  getOrgIdStrict,
  requireTeamforceWriteAccess,
} from "./_helpers";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const shifts = await TeamforceShift.find({
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  })
    .sort({ name: 1 })
    .lean();

  res.json({ shifts });
});

router.post("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = z
    .object({
      name: z.string().min(1).max(200).trim(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      workingHours: z.number().min(0).max(24).default(0),
      graceMinutes: z.number().int().min(0).default(0),
      breakMinutes: z.number().int().min(0).default(0),
    })
    .parse(req.body);

  const duplicate = await TeamforceShift.findOne({
    orgId: new Types.ObjectId(orgId),
    isActive: true,
    startTime: body.startTime,
    endTime: body.endTime,
  })
    .select("_id name")
    .lean();
  if (duplicate) {
    return res.status(409).json({
      error: `A shift with this start and end time already exists (${duplicate.name}).`,
    });
  }

  const shift = await TeamforceShift.create({
    orgId: new Types.ObjectId(orgId),
    ...body,
  });

  res.status(201).json({ shift });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const body = z
    .object({
      name: z.string().min(1).max(200).trim().optional(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      workingHours: z.number().min(0).max(24).optional(),
      graceMinutes: z.number().int().min(0).optional(),
      breakMinutes: z.number().int().min(0).optional(),
    })
    .parse(req.body);

  if (body.startTime || body.endTime) {
    const current = await TeamforceShift.findOne({
      _id: req.params.id,
      orgId: new Types.ObjectId(orgId),
    })
      .select("startTime endTime")
      .lean();
    if (current) {
      const nextStart = body.startTime ?? current.startTime;
      const nextEnd = body.endTime ?? current.endTime;
      const duplicate = await TeamforceShift.findOne({
        _id: { $ne: new Types.ObjectId(req.params.id) },
        orgId: new Types.ObjectId(orgId),
        isActive: true,
        startTime: nextStart,
        endTime: nextEnd,
      })
        .select("_id name")
        .lean();
      if (duplicate) {
        return res.status(409).json({
          error: `A shift with this start and end time already exists (${duplicate.name}).`,
        });
      }
    }
  }

  const shift = await TeamforceShift.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: body },
    { new: true }
  ).lean();

  if (!shift) return res.status(404).json({ error: "Shift not found" });
  res.json({ shift });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  await TeamforceShift.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: { isActive: false } }
  );

  res.json({ ok: true });
});

export default router;
