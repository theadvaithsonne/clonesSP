/**
 * Per-user inbox state for DMs + groups. Powers the LinkedIn-style
 * archive / mark-unread features without forking the message or group
 * models. See `models/conversationState.model.ts` for the schema
 * rationale; this router is the thin REST surface on top.
 *
 * Endpoints (all auth-required):
 *
 *   GET    /conv-state            list every state doc the user owns
 *                                 — the inbox UI calls this once on
 *                                 mount and overlays the result onto
 *                                 the existing DM + group lists.
 *
 *   POST   /conv-state/archive    { convId, kind }
 *   POST   /conv-state/unarchive  { convId }
 *   POST   /conv-state/mark-unread { convId, kind }
 *
 * Bulk variants exist (POST /conv-state/archive-bulk etc.) so the
 * mobile multi-select bar can ship Archive-N / Mark-Unread-N as a
 * single round-trip — important for users archiving 20+ rows after a
 * busy week.
 *
 * Why no DELETE for "delete conversation": leaving the destructive
 * action out for v1 — "delete" in LinkedIn just hides from the inbox
 * but keeps the messages, which is effectively what archive does.
 * Adding a separate delete-state with cascading cleanup is its own
 * scope and product call.
 */
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { ConversationState } from "../models/conversationState.model";

const router = Router();

// Same validator for everywhere a single conv id arrives. The format is
// app-defined (`dm:<a>:<b>` or `group:<id>`) so we keep it lax — just
// "non-empty bounded string" — and let the model layer be authoritative.
const ConvIdSchema = z.string().min(1).max(120);

router.get("/", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const states = await ConversationState.find({
    userId: new Types.ObjectId(me),
  }).lean();
  res.json({
    states: states.map((s: any) => ({
      convId: s.convId,
      kind: s.kind,
      archivedAt: s.archivedAt,
      markedUnreadAt: s.markedUnreadAt,
    })),
  });
});

router.post("/archive", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { convId, kind } = z
    .object({ convId: ConvIdSchema, kind: z.enum(["dm", "group"]) })
    .parse(req.body);
  await ConversationState.findOneAndUpdate(
    { userId: new Types.ObjectId(me), convId },
    { $set: { kind, archivedAt: new Date(), markedUnreadAt: null } },
    { upsert: true, new: true },
  );
  res.json({ ok: true });
});

router.post("/unarchive", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { convId } = z.object({ convId: ConvIdSchema }).parse(req.body);
  await ConversationState.findOneAndUpdate(
    { userId: new Types.ObjectId(me), convId },
    { $set: { archivedAt: null } },
    { new: true },
  );
  res.json({ ok: true });
});

router.post("/mark-unread", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { convId, kind } = z
    .object({ convId: ConvIdSchema, kind: z.enum(["dm", "group"]) })
    .parse(req.body);
  await ConversationState.findOneAndUpdate(
    { userId: new Types.ObjectId(me), convId },
    { $set: { kind, markedUnreadAt: new Date() } },
    { upsert: true, new: true },
  );
  res.json({ ok: true });
});

// ── Bulk variants for the multi-select action bar ──────────────────────

router.post("/archive-bulk", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { items } = z
    .object({
      items: z
        .array(
          z.object({ convId: ConvIdSchema, kind: z.enum(["dm", "group"]) }),
        )
        .min(1)
        .max(200),
    })
    .parse(req.body);
  const ops = items.map((it) => ({
    updateOne: {
      filter: { userId: new Types.ObjectId(me), convId: it.convId },
      update: {
        $set: { kind: it.kind, archivedAt: new Date(), markedUnreadAt: null },
      },
      upsert: true,
    },
  }));
  await ConversationState.bulkWrite(ops);
  res.json({ ok: true, count: items.length });
});

router.post("/unarchive-bulk", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { convIds } = z
    .object({ convIds: z.array(ConvIdSchema).min(1).max(200) })
    .parse(req.body);
  await ConversationState.updateMany(
    { userId: new Types.ObjectId(me), convId: { $in: convIds } },
    { $set: { archivedAt: null } },
  );
  res.json({ ok: true, count: convIds.length });
});

router.post("/mark-unread-bulk", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { items } = z
    .object({
      items: z
        .array(
          z.object({ convId: ConvIdSchema, kind: z.enum(["dm", "group"]) }),
        )
        .min(1)
        .max(200),
    })
    .parse(req.body);
  const ops = items.map((it) => ({
    updateOne: {
      filter: { userId: new Types.ObjectId(me), convId: it.convId },
      update: { $set: { kind: it.kind, markedUnreadAt: new Date() } },
      upsert: true,
    },
  }));
  await ConversationState.bulkWrite(ops);
  res.json({ ok: true, count: items.length });
});

export default router;
