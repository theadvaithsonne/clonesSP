import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import {
  TeamforcePTSlab,
  PT_STATES,
  SEED_PT_SLABS,
} from "../../models/teamforce/teamforcePTSlab.model";
import { requireFounderOnly } from "./_helpers";

const router = Router();

const slabSchema = z.object({
  state: z.string().trim().min(1),
  grossFrom: z.number().min(0),
  grossTo: z.number().nullable().optional(),
  monthlyPT: z.number().min(0),
  monthOverride: z.number().int().min(1).max(12).nullable().optional(),
  effectiveDate: z.string().datetime().optional(),
});

const updateSchema = slabSchema.partial();

// List all active slabs (any auth user). Optional state filter.
router.get("/", requireAuth, async (req, res) => {
  const state = (req.query.state as string | undefined)?.trim();
  const filter: Record<string, unknown> = { isActive: true };
  if (state) filter.state = state;

  const slabs = await TeamforcePTSlab.find(filter)
    .sort({ state: 1, monthOverride: 1, grossFrom: 1 })
    .lean();
  res.json({ slabs, states: PT_STATES });
});

// Add a slab (founder-only).
router.post("/", requireAuth, async (req, res) => {
  if (!requireFounderOnly(req, res)) return;
  const body = slabSchema.parse(req.body);
  const slab = await TeamforcePTSlab.create({
    ...body,
    grossTo: body.grossTo ?? null,
    monthOverride: body.monthOverride ?? null,
    effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date(),
  });
  res.status(201).json({ slab: slab.toObject() });
});

// Edit a slab (founder-only).
router.patch("/:id", requireAuth, async (req, res) => {
  if (!requireFounderOnly(req, res)) return;
  const body = updateSchema.parse(req.body);
  const $set: Record<string, unknown> = { ...body };
  if (body.effectiveDate) $set.effectiveDate = new Date(body.effectiveDate);

  const slab = await TeamforcePTSlab.findOneAndUpdate(
    { _id: req.params.id },
    { $set },
    { new: true, runValidators: true }
  ).lean();

  if (!slab) return res.status(404).json({ error: "Slab not found" });
  res.json({ slab });
});

// Soft delete a slab (founder-only).
router.delete("/:id", requireAuth, async (req, res) => {
  if (!requireFounderOnly(req, res)) return;
  const slab = await TeamforcePTSlab.findOneAndUpdate(
    { _id: req.params.id },
    { $set: { isActive: false } },
    { new: true }
  ).lean();
  if (!slab) return res.status(404).json({ error: "Slab not found" });
  res.json({ ok: true });
});

// Re-seed missing slabs from the canonical spec list. Idempotent (founder-only).
router.post("/seed", requireAuth, async (req, res) => {
  if (!requireFounderOnly(req, res)) return;

  let inserted = 0;
  for (const row of SEED_PT_SLABS) {
    const existing = await TeamforcePTSlab.findOne({
      state: row.state,
      grossFrom: row.grossFrom,
      grossTo: row.grossTo,
      monthlyPT: row.monthlyPT,
      monthOverride: row.monthOverride,
    }).lean();
    if (existing) continue;
    await TeamforcePTSlab.create({
      ...row,
      effectiveDate: new Date("2024-04-01T00:00:00Z"),
    });
    inserted++;
  }
  res.json({ ok: true, inserted });
});

export default router;
