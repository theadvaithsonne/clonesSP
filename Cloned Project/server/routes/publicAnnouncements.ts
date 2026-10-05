import { Router, Request, Response } from "express";
import { Announcement } from "../models/announcement.model";
import { serializeAnnouncement } from "./garageAdminAnnouncements";
import { ok, fail } from "../utils/http";

/**
 * The read side of Alerts & Promotions, mounted at /public/announcements.
 *
 * Unauthenticated on purpose: the pre-login surface is the login/signup
 * screen, where there is no token to send. Nothing here is user-specific —
 * it is the same marketing copy every visitor sees — and dismissal is
 * tracked in the browser, so there is no read model to protect either.
 */
const router = Router();

/**
 * GET /public/announcements/active?surface=pre-login|post-login
 *
 * Everything enabled, inside its schedule window, targeting that surface
 * (or "everywhere"), best first. Returns a list rather than a single item so
 * the client can skip the ones this browser already dismissed without a
 * second round trip.
 */
router.get("/active", async (req: Request, res: Response) => {
  try {
    const surface = String(req.query.surface || "post-login");
    if (surface !== "pre-login" && surface !== "post-login") {
      return res
        .status(400)
        .json(fail("surface must be 'pre-login' or 'post-login'"));
    }

    const now = new Date();
    const rows = await Announcement.find({
      enabled: true,
      surface: { $in: [surface, "everywhere"] },
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    })
      .sort({ priority: -1, createdAt: -1 })
      .limit(10)
      .lean();

    return res.json(ok(rows.map(serializeAnnouncement)));
  } catch (err: any) {
    console.error("[public/announcements][active] error:", err);
    return res
      .status(500)
      .json(fail(err?.message || "Failed to load announcements"));
  }
});

export default router;
