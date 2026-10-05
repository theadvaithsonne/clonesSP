import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/user.model";

/**
 * GET /users/last-seen?userIds=id1,id2,id3
 *
 * Batch fetcher for `lastSeenAt` timestamps. Used by frontend components
 * that need the "Active X ago" affordance but didn't fetch the field as
 * part of their main payload (e.g. legacy avatar lists, ad-hoc lookups).
 *
 * Returns a flat `{ [userId]: ISOString | null }` map so the FE can use
 * it as a plain lookup without re-shaping.
 */
const router = Router();

router.get("/last-seen", requireAuth, async (req, res) => {
  try {
    const raw = (req.query.userIds as string | undefined) || "";
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => Types.ObjectId.isValid(s))
      .map((s) => new Types.ObjectId(s));

    if (ids.length === 0) {
      return res.json({ success: true, lastSeen: {} });
    }

    // Hard cap at 500 ids per call — guards against pathological URLs.
    const capped = ids.slice(0, 500);

    const rows = await User.find({ _id: { $in: capped } })
      .select("_id lastSeenAt")
      .lean();

    const lastSeen: Record<string, string | null> = {};
    for (const r of rows as any[]) {
      lastSeen[String(r._id)] = r.lastSeenAt
        ? new Date(r.lastSeenAt).toISOString()
        : null;
    }

    res.json({ success: true, lastSeen });
  } catch (error: any) {
    console.error("[users/last-seen] error:", error);
    res
      .status(500)
      .json({ success: false, error: error?.message || "Failed to fetch" });
  }
});

export default router;
