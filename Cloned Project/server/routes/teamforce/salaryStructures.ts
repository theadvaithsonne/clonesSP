import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import {
  TeamforceSalaryStructure,
  COMPONENT_CODES,
  TAXABILITY_TYPES,
  CALC_TYPES,
  TAX_REGIMES,
  buildDefaultSalaryStructureComponents,
} from "../../models/teamforce/teamforceSalaryStructure.model";
import { getOrgIdStrict, requireTeamforceWriteAccess } from "./_helpers";

const router = Router();

const MAX_FLAT_VALUE = 10_000_000;    // ₹1 crore per component
const MAX_ANNUAL_TDS = 100_000_000;   // ₹10 crore annual TDS

const componentSchema = z.object({
  componentCode: z.enum(COMPONENT_CODES).default("CUSTOM"),
  componentName: z.string().trim().min(1),
  taxabilityType: z.enum(TAXABILITY_TYPES),
  calculationType: z.enum(CALC_TYPES).default("flat"),
  value: z.number().min(0).max(MAX_FLAT_VALUE).default(0),
});

// Base object schema — used as-is for PATCH (partial) without cross-field refines
const bodyObjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  earnings: z.array(componentSchema).default([]),
  deductions: z.array(componentSchema).default([]),
  taxRegime: z.enum(TAX_REGIMES).default("new"),
  autoTds: z.boolean().default(true),
  estimatedAnnualTds: z.number().min(0).max(MAX_ANNUAL_TDS).default(0),
});

// Full schema with cross-field rules — used for POST
const bodySchema = bodyObjectSchema
  .refine(
    (data) =>
      data.earnings.every(
        (e) => e.calculationType === "flat" || e.value <= 100
      ),
    {
      message:
        "Each percentage-based earning component value must be between 0 and 100",
    }
  )
  .refine(
    (data) => {
      const total = data.earnings
        .filter((e) => e.calculationType !== "flat")
        .reduce((sum, e) => sum + e.value, 0);
      return total <= 100;
    },
    {
      message:
        "Total percentage allocation in earnings cannot exceed 100%",
    }
  );

const updateSchema = bodyObjectSchema.partial();

router.get("/defaults", requireAuth, async (_req, res) => {
  res.json(buildDefaultSalaryStructureComponents());
});

router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const structures = await TeamforceSalaryStructure.find({
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  })
    .sort({ createdAt: 1 })
    .lean();

  res.json({ structures });
});

router.post("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
  }
  const body = parsed.data;
  try {
    const structure = await TeamforceSalaryStructure.create({
      orgId: new Types.ObjectId(orgId),
      ...body,
    });
    res.status(201).json({ structure: structure.toObject() });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ error: `A structure named "${body.name}" already exists.` });
    }
    throw err;
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const parsedUpdate = updateSchema.safeParse(req.body);
  if (!parsedUpdate.success) {
    return res.status(400).json({ error: parsedUpdate.error.issues[0]?.message ?? "Invalid request body" });
  }
  const body = parsedUpdate.data;
  try {
    const structure = await TeamforceSalaryStructure.findOneAndUpdate(
      {
        _id: req.params.id,
        orgId: new Types.ObjectId(orgId),
        isActive: true,
      },
      { $set: body },
      { new: true, runValidators: true }
    ).lean();

    if (!structure)
      return res.status(404).json({ error: "Structure not found" });
    res.json({ structure });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ error: "A structure with that name already exists." });
    }
    throw err;
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const updated = await TeamforceSalaryStructure.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: { isActive: false } }
  );
  if (!updated) return res.status(404).json({ error: "Structure not found" });
  res.json({ ok: true });
});

export default router;
