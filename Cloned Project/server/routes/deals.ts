// src/routes/deals.ts
//
// Deals feed API — Garage Connect → Deals tab.
//
//   GET    /deals                        the feed (newest first, cursor paged)
//   GET    /deals/stats                  four platform totals + all-time series (header cards)
//   GET    /deals/:dealId                one deal
//   PUT    /deals/:dealId/reaction       react / change reaction
//   DELETE /deals/:dealId/reaction       remove mine
//   GET    /deals/:dealId/reactions      who reacted
//   GET    /deals/:dealId/comments       comments, newest first
//   POST   /deals/:dealId/comments       add one
//   DELETE /deals/:dealId/comments/:id   soft-delete your own
//
// Reading the feed uses softAuth: the timeline is the same for everyone, and
// a token only adds `reactions.mine`. Writing needs a real user.
//
// See services/deals.ts for why a deal is a projection rather than a row.
import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth, softAuth, AuthRequest } from "../middleware/auth";
import { ok, fail } from "../utils/http";
import {
  listDeals,
  getDeal,
  getDealStats,
  dealExists,
  isValidDealId,
} from "../services/deals";
import { DealReaction } from "../models/dealReaction.model";
import { DealComment } from "../models/dealComment.model";
import { User } from "../models/user.model";

const router = Router();

const feedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  // Validated here so a malformed cursor is a 400 from the schema rather
  // than a throw out of the service, which surfaced as a 500.
  cursor: z
    .string()
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "cursor must be an ISO date")
    .optional(),
  earnerId: z.string().optional(),
  minAmountUsd: z.coerce.number().min(0).optional(),
  // A $25 sale pays up to 22 people, so a 50-deal page can carry 1,100
  // payout rows. `none` trims them for a long scroll; the card can refetch
  // the full chain from GET /deals/:dealId when someone expands it.
  payouts: z.enum(["full", "none"]).optional(),
});

/** GET /deals */
router.get("/", softAuth, async (req: Request, res: Response) => {
  try {
    const q = feedQuery.parse(req.query);
    if (q.earnerId && !Types.ObjectId.isValid(q.earnerId)) {
      return res.status(400).json(fail("earnerId must be a user id"));
    }
    const viewerId = (req as AuthRequest).user?.userId;
    const { deals, nextCursor } = await listDeals({ ...q, viewerId });
    return res.json(ok({ deals, nextCursor }));
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res
        .status(400)
        .json(fail(err.issues?.[0]?.message || "Invalid query"));
    }
    console.error("[deals] feed failed:", err);
    return res.status(500).json(fail("Failed to load deals"));
  }
});

/**
 * GET /deals/stats — platform-wide affiliate earnings, purchase volume, users
 * and businesses, each with an all-time running series. Public like the feed.
 * Must stay ABOVE `/:dealId`, which would otherwise swallow "stats" as a (bad)
 * deal id.
 */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    return res.json(ok(await getDealStats()));
  } catch (err) {
    console.error("[deals] stats failed:", err);
    return res.status(500).json(fail("Failed to load deal stats"));
  }
});

/** GET /deals/:dealId — the same shape as one feed row. */
router.get("/:dealId", softAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    if (!isValidDealId(dealId)) return res.status(400).json(fail("Invalid deal id"));
    const viewerId = (req as AuthRequest).user?.userId;
    const deal = await getDeal(dealId, { viewerId });
    if (!deal) return res.status(404).json(fail("Deal not found"));
    return res.json(ok(deal));
  } catch (err) {
    console.error("[deals] single failed:", err);
    return res.status(500).json(fail("Failed to load deal"));
  }
});

/* ── Reactions ─────────────────────────────────────────────────────────── */

/** PUT /deals/:dealId/reaction — idempotent; reacting again changes the type. */
router.put("/:dealId/reaction", requireAuth, async (req: Request, res: Response) => {
    const auth = req as AuthRequest;
  try {
    const { dealId } = req.params;
    const body = z
      .object({ type: z.string().trim().min(1).max(32).default("like") })
      .parse(req.body ?? {});
    if (!(await dealExists(dealId))) {
      return res.status(404).json(fail("Deal not found"));
    }
    await DealReaction.updateOne(
      { dealId, userId: new Types.ObjectId(auth.user.userId) },
      { $set: { type: body.type } },
      { upsert: true }
    );
    const total = await DealReaction.countDocuments({ dealId });
    return res.json(ok({ dealId, total, mine: body.type }));
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json(fail("Invalid reaction"));
    console.error("[deals] react failed:", err);
    return res.status(500).json(fail("Failed to react"));
  }
});

/** DELETE /deals/:dealId/reaction */
router.delete("/:dealId/reaction", requireAuth, async (req: Request, res: Response) => {
    const auth = req as AuthRequest;
  try {
    const { dealId } = req.params;
    if (!isValidDealId(dealId)) return res.status(400).json(fail("Invalid deal id"));
    await DealReaction.deleteOne({
      dealId,
      userId: new Types.ObjectId(auth.user.userId),
    });
    const total = await DealReaction.countDocuments({ dealId });
    return res.json(ok({ dealId, total, mine: null }));
  } catch (err) {
    console.error("[deals] unreact failed:", err);
    return res.status(500).json(fail("Failed to remove reaction"));
  }
});

/** GET /deals/:dealId/reactions — for the "who reacted" sheet. */
router.get("/:dealId/reactions", softAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    if (!isValidDealId(dealId)) return res.status(400).json(fail("Invalid deal id"));
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const rows: any[] = await DealReaction.find({ dealId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const users: any[] = await User.find({
      _id: { $in: rows.map((r) => r.userId) },
    })
      .select("name email profilePicture")
      .lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    return res.json(
      ok({
        total: await DealReaction.countDocuments({ dealId }),
        reactions: rows.map((r) => {
          const u = byId.get(String(r.userId));
          return {
            type: r.type,
            reactedAt: r.createdAt,
            user: {
              id: String(r.userId),
              name: u?.name || u?.email?.split("@")[0] || null,
              avatar: u?.profilePicture || null,
            },
          };
        }),
      })
    );
  } catch (err) {
    console.error("[deals] reactions failed:", err);
    return res.status(500).json(fail("Failed to load reactions"));
  }
});

/* ── Comments ──────────────────────────────────────────────────────────── */

/** GET /deals/:dealId/comments */
router.get("/:dealId/comments", softAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    if (!isValidDealId(dealId)) return res.status(400).json(fail("Invalid deal id"));
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const before = req.query.cursor ? new Date(String(req.query.cursor)) : null;
    if (before && Number.isNaN(before.getTime())) {
      return res.status(400).json(fail("cursor must be an ISO date"));
    }
    const rows: any[] = await DealComment.find({
      dealId,
      deletedAt: null,
      ...(before ? { createdAt: { $lt: before } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();
    const page = rows.slice(0, limit);
    const users: any[] = await User.find({ _id: { $in: page.map((r) => r.userId) } })
      .select("name email profilePicture")
      .lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    return res.json(
      ok({
        total: await DealComment.countDocuments({ dealId, deletedAt: null }),
        comments: page.map((c) => {
          const u = byId.get(String(c.userId));
          return {
            id: String(c._id),
            body: c.body,
            parentId: c.parentId ? String(c.parentId) : null,
            createdAt: c.createdAt,
            user: {
              id: String(c.userId),
              name: u?.name || u?.email?.split("@")[0] || null,
              avatar: u?.profilePicture || null,
            },
          };
        }),
        nextCursor:
          rows.length > limit ? page[page.length - 1].createdAt.toISOString() : null,
      })
    );
  } catch (err) {
    console.error("[deals] comments failed:", err);
    return res.status(500).json(fail("Failed to load comments"));
  }
});

/** POST /deals/:dealId/comments */
router.post("/:dealId/comments", requireAuth, async (req: Request, res: Response) => {
    const auth = req as AuthRequest;
  try {
    const { dealId } = req.params;
    const body = z
      .object({
        body: z.string().trim().min(1).max(2000),
        parentId: z.string().optional(),
      })
      .parse(req.body ?? {});
    if (!(await dealExists(dealId))) return res.status(404).json(fail("Deal not found"));
    if (body.parentId) {
      // A reply must belong to the same deal — otherwise a thread could be
      // grafted onto someone else's card.
      const parent: any = await DealComment.findById(body.parentId).lean();
      if (!parent || parent.dealId !== dealId) {
        return res.status(400).json(fail("parentId is not a comment on this deal"));
      }
    }
    const created: any = await DealComment.create({
      dealId,
      userId: new Types.ObjectId(auth.user.userId),
      body: body.body,
      parentId: body.parentId ? new Types.ObjectId(body.parentId) : null,
    });
    return res.status(201).json(
      ok({
        id: String(created._id),
        dealId,
        body: created.body,
        parentId: created.parentId ? String(created.parentId) : null,
        createdAt: created.createdAt,
        total: await DealComment.countDocuments({ dealId, deletedAt: null }),
      })
    );
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json(fail(err.issues?.[0]?.message || "Invalid comment"));
    }
    console.error("[deals] comment failed:", err);
    return res.status(500).json(fail("Failed to post comment"));
  }
});

/** DELETE /deals/:dealId/comments/:commentId — author only, soft delete. */
router.delete(
  "/:dealId/comments/:commentId",
  requireAuth,
  async (req: Request, res: Response) => {
    const auth = req as AuthRequest;
    try {
      const { dealId, commentId } = req.params;
      if (!Types.ObjectId.isValid(commentId)) {
        return res.status(400).json(fail("Invalid comment id"));
      }
      const c: any = await DealComment.findOne({ _id: commentId, dealId });
      if (!c || c.deletedAt) return res.status(404).json(fail("Comment not found"));
      if (String(c.userId) !== auth.user.userId) {
        return res.status(403).json(fail("You can only delete your own comment"));
      }
      c.deletedAt = new Date();
      await c.save();
      return res.json(
        ok({
          id: commentId,
          deleted: true,
          total: await DealComment.countDocuments({ dealId, deletedAt: null }),
        })
      );
    } catch (err) {
      console.error("[deals] delete comment failed:", err);
      return res.status(500).json(fail("Failed to delete comment"));
    }
  }
);

export default router;
