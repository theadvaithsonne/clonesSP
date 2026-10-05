import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { Deal } from "../models/deal.model";
import { getSocketInstance } from "../services/socket";

// Slash-command Deal routes. Designed to be cheap:
//   - /search caps at 20 results with a prefix-regex on indexed name
//   - PATCH /:id/stage emits a single org-scoped socket event so every
//     client showing the card updates without polling
//   - GET /:id exists for late-loading clients but cards normally render
//     from the inline marker payload, so this endpoint is rarely hit
const router = Router();

const DEAL_STAGES = ["lead", "qualified", "proposal", "won", "lost"] as const;

// POST /slash/deals — create a minimal deal record from the chat form
router.post("/", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string; orgId: string };
  if (!me.orgId) return res.status(400).json({ error: "No organization" });

  const body = z
    .object({
      name: z.string().min(1).max(200),
      stage: z.enum(DEAL_STAGES).optional(),
      value: z.number().nonnegative().optional(),
      currency: z.string().min(1).max(8).optional(),
      ownerId: z.string().nullable().optional(),
    })
    .parse(req.body);

  const deal = await Deal.create({
    orgId: new Types.ObjectId(me.orgId),
    createdBy: new Types.ObjectId(me.userId),
    name: body.name,
    stage: body.stage || "lead",
    value: body.value ?? 0,
    currency: body.currency || "USD",
    ownerId: body.ownerId ? new Types.ObjectId(body.ownerId) : undefined,
  });

  res.status(201).json({ deal });
});

// GET /slash/deals/search?q=&limit=20
// Capped, prefix-regex search on the indexed name field.
router.get("/search", requireAuth, async (req, res) => {
  const me = (req as any).user as { orgId: string };
  if (!me.orgId) return res.status(400).json({ error: "No organization" });

  const { q, limit } = z
    .object({
      q: z.string().min(1).max(100),
      limit: z.coerce.number().min(1).max(20).optional(),
    })
    .parse(req.query);

  // Escape regex specials so user input can't blow up the query planner.
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const deals = await Deal.find({
    orgId: new Types.ObjectId(me.orgId),
    name: { $regex: safe, $options: "i" },
  })
    .select("name stage value currency ownerId")
    .limit(limit ?? 20)
    .lean();

  res.json({ deals });
});

// GET /slash/deals/:id — fallback for late-loading clients
router.get("/:id", requireAuth, async (req, res) => {
  const me = (req as any).user as { orgId: string };
  if (!me.orgId) return res.status(400).json({ error: "No organization" });

  const deal = await Deal.findOne({
    _id: req.params.id,
    orgId: new Types.ObjectId(me.orgId),
  })
    .select("name stage value currency ownerId")
    .lean();

  if (!deal) return res.status(404).json({ error: "Deal not found" });
  res.json({ deal });
});

// PATCH /slash/deals/:id/stage — single source of truth for stage changes
router.patch("/:id/stage", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string; orgId: string };
  if (!me.orgId) return res.status(400).json({ error: "No organization" });

  const { stage } = z.object({ stage: z.enum(DEAL_STAGES) }).parse(req.body);

  const deal = await Deal.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(me.orgId) },
    { $set: { stage } },
    { new: true }
  )
    .select("name stage")
    .lean();

  if (!deal) return res.status(404).json({ error: "Deal not found" });

  // Single org-scoped broadcast. All open clients showing this card
  // update via socket — no polling, no per-card GET.
  const io = getSocketInstance();
  io?.to(`org:${me.orgId}`).emit("slash:deal-updated", {
    dealId: String(deal._id),
    stage: deal.stage,
    updatedBy: me.userId,
  });

  res.json({ deal });
});

export default router;
