import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { MissedCall } from "../models/missedCall.model";

const router = Router();

/**
 * GET /missed-calls?limit=&before=
 * List the authenticated user's missed calls, newest first.
 *
 * Default returns the most recent 50 non-dismissed entries. Pass
 * `before` (ISO datetime) for cursor-based pagination — clients ask
 * for entries strictly older than the cursor's `occurredAt`.
 *
 * `includeDismissed=true` returns dismissed rows too — used by an
 * "Archive" tab if/when one ships. Default false keeps the badge +
 * default list clean.
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
      before: z.string().datetime().optional(),
      includeDismissed: z
        .preprocess((v) => v === "true" || v === true, z.boolean())
        .default(false),
    });
    const { limit, before, includeDismissed } = schema.parse(req.query);

    const filter: any = { toUserId: new Types.ObjectId(me.userId) };
    if (!includeDismissed) filter.dismissedAt = null;
    if (before) filter.occurredAt = { $lt: new Date(before) };

    const rows = await MissedCall.find(filter)
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, missedCalls: rows });
  } catch (error) {
    console.error("[missed-calls] list error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list missed calls",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /missed-calls/unread-count
 *
 * Tiny dedicated endpoint for the header badge. Returns count of
 * MissedCall rows where viewedAt is null and dismissedAt is null
 * for the authenticated user. Hot path — kept minimal so the
 * notification poll doesn't pay for a full list fetch.
 */
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const count = await MissedCall.countDocuments({
      toUserId: new Types.ObjectId(me.userId),
      viewedAt: null,
      dismissedAt: null,
    });
    res.json({ success: true, count });
  } catch (error) {
    console.error("[missed-calls] unread-count error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to read unread count",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /missed-calls/mark-viewed
 * Bulk-mark all of the user's currently-unviewed missed calls as
 * viewed. Called when the recipient opens the missed-calls list —
 * the badge clears, but the rows stay so the user can still see who
 * called.
 *
 * Idempotent: a second call with no unviewed rows is a no-op.
 */
router.post("/mark-viewed", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const now = new Date();
    const result = await MissedCall.updateMany(
      {
        toUserId: new Types.ObjectId(me.userId),
        viewedAt: null,
        dismissedAt: null,
      },
      { $set: { viewedAt: now } },
    );
    res.json({ success: true, viewed: result.modifiedCount });
  } catch (error) {
    console.error("[missed-calls] mark-viewed error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark viewed",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /missed-calls/:id
 * Soft-dismiss a single missed-call entry. Sets dismissedAt so it
 * falls out of the default list — the row stays for history.
 *
 * 404 if the row isn't this user's. We don't 403 on a foreign row to
 * avoid leaking row existence via different error codes.
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid id" });
    }
    const row = await MissedCall.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        toUserId: new Types.ObjectId(me.userId),
      },
      { $set: { dismissedAt: new Date() } },
      { new: true },
    );
    if (!row) {
      return res
        .status(404)
        .json({ success: false, error: "Missed call not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("[missed-calls] dismiss error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to dismiss missed call",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /missed-calls/clear
 * Hard-dismiss all of the user's currently-non-dismissed rows in
 * one call. Used by a "Clear all" CTA in the list view.
 */
router.post("/clear", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const result = await MissedCall.updateMany(
      {
        toUserId: new Types.ObjectId(me.userId),
        dismissedAt: null,
      },
      { $set: { dismissedAt: new Date() } },
    );
    res.json({ success: true, cleared: result.modifiedCount });
  } catch (error) {
    console.error("[missed-calls] clear error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear missed calls",
      details: (error as Error).message,
    });
  }
});

export default router;
