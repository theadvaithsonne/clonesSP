import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";
import {
  ConferenceRoom,
  conferenceRoomSpaceId,
} from "../models/conferenceRoom.model";
import {
  applyAddRoomsBilling,
  applyCancelRoomBilling,
  pruneExpiredRoomsForOrg,
} from "../services/conferenceRoomBilling";

const router = Router();

// Per-org founder check. Mirrors the inline pattern used by routes/roles
// elsewhere — looks at the user's per-org membership for `role === founder`
// instead of trusting the top-level `user.role` field, so a user who is a
// founder of org A can't accidentally create rooms inside org B.
async function isOrgFounder(userId: string, orgId: string): Promise<boolean> {
  const u = await User.findById(userId).lean();
  if (!u) return false;
  // Legacy single-org doc shape
  if (
    (u as any).organization?.toString() === orgId &&
    ["admin", "founder"].includes((u as any).role || "")
  ) {
    return true;
  }
  const memberships = (u as any).organizations || [];
  const m = memberships.find(
    (m: any) => m.organization?.toString() === orgId,
  );
  return !!m && hasFounderAccess(m);
}

/**
 * POST /conference-rooms?orgId=<orgId>
 * Body: { name }
 * Founder-only. Creates a new named conference room inside the org.
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const orgId = req.query.orgId as string;
    if (!orgId) {
      return res
        .status(400)
        .json({ success: false, error: "orgId query parameter is required" });
    }
    if (!Types.ObjectId.isValid(orgId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid orgId" });
    }

    const schema = z.object({
      name: z
        .string()
        .min(1, "Room name is required")
        .max(80, "Room name must be ≤80 chars")
        .trim(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: parsed.error.issues[0].message });
    }

    if (!(await isOrgFounder(me.userId, orgId))) {
      return res
        .status(403)
        .json({ success: false, error: "Only founders can create rooms" });
    }

    try {
      // Prune any stale "scheduled for cancellation" rooms first so the
      // billing count we're about to use is accurate. Without this, a
      // founder who cancelled then re-added wouldn't get charged twice
      // (good) but the count would be temporarily wrong (bad).
      await pruneExpiredRoomsForOrg(orgId);

      const activeRoomsBefore = await ConferenceRoom.countDocuments({
        orgId: new Types.ObjectId(orgId),
        isActive: true,
      });

      const room = await ConferenceRoom.create({
        orgId: new Types.ObjectId(orgId),
        name: parsed.data.name,
        createdBy: new Types.ObjectId(me.userId),
        isActive: true,
      });

      // Free first room. Anything beyond #1 is billed.
      // - activeRoomsBefore = 0: shouldn't happen post-signup (we auto-
      //   create the included room) but be defensive — treat as free.
      // - activeRoomsBefore = 1: this new room is the first EXTRA; bill it.
      // - activeRoomsBefore >= 2: parent invoice already exists, just bump
      //   its quantity + generate prorated for this 1 added room.
      let proratedInvoiceId: string | null = null;
      if (activeRoomsBefore >= 1) {
        try {
          const { proratedInvoice } = await applyAddRoomsBilling(
            orgId,
            me.userId,
            1
          );
          proratedInvoiceId = proratedInvoice._id.toString();
        } catch (billingErr) {
          // Roll back the room. Previously we kept the room and only
          // logged — that path let founders end up with free rooms
          // whenever billing hiccupped, and hid the "add-later never
          // charges again" family of bugs. Fail atomically: the room
          // exists iff billing succeeded.
          console.error(
            "[conference-rooms] billing failed for new room — rolling back:",
            billingErr
          );
          try {
            await ConferenceRoom.deleteOne({ _id: room._id });
          } catch (rollbackErr) {
            console.error(
              "[conference-rooms] rollback of room after billing failure ALSO failed — manual cleanup needed for room " +
                room._id.toString(),
              rollbackErr
            );
          }
          return res.status(500).json({
            success: false,
            error: "Failed to bill for room. Please try again.",
          });
        }
      }

      return res.status(201).json({
        success: true,
        room: {
          ...room.toObject(),
          spaceId: conferenceRoomSpaceId(orgId, room._id.toString()),
        },
        // FE redirects to /invoice/<id> when this is set so the founder
        // can pay the prorated charge for the partial cycle.
        proratedInvoiceId,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({
          success: false,
          error: `A room named "${parsed.data.name}" already exists in this org`,
        });
      }
      throw err;
    }
  } catch (error) {
    console.error("[conference-rooms] create error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create conference room",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /conference-rooms?orgId=<orgId>
 * List active conference rooms for the org. Any authenticated member can
 * read — booking surface needs this list too, not just founders.
 *
 * Decorates each row with a `spaceId` string so the client doesn't have
 * to re-derive the synthetic ID convention (`hq-room:<orgId>:<roomId>`)
 * — the realtime layer + LiveKit room helpers all key off that string.
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId || !Types.ObjectId.isValid(orgId)) {
      return res
        .status(400)
        .json({ success: false, error: "Valid orgId required" });
    }
    // Lazy-prune any rooms whose paid cycle just ended. This is how
    // cancelled-but-paid-through rooms eventually drop out of the list —
    // we don't run a dedicated cron, the list endpoint does the cleanup
    // on demand (idempotent + cheap).
    await pruneExpiredRoomsForOrg(orgId);

    const rooms = await ConferenceRoom.find({
      orgId: new Types.ObjectId(orgId),
      isActive: true,
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      success: true,
      rooms: rooms.map((r) => ({
        ...r,
        spaceId: conferenceRoomSpaceId(orgId, r._id.toString()),
        // Surface the cycle-end date so the FE can render
        // "Cancels on Apr 5" badges on rooms that are scheduled to drop.
        scheduledDeactivationAt: r.scheduledDeactivationAt
          ? new Date(r.scheduledDeactivationAt).toISOString()
          : null,
      })),
    });
  } catch (error) {
    console.error("[conference-rooms] list error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list conference rooms",
      details: (error as Error).message,
    });
  }
});

/**
 * PUT /conference-rooms/:id?orgId=<orgId>
 * Body: { name }
 * Founder-only rename.
 */
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const orgId = req.query.orgId as string;
    const { id } = req.params;
    if (
      !orgId ||
      !Types.ObjectId.isValid(orgId) ||
      !Types.ObjectId.isValid(id)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Valid orgId and id required" });
    }
    const schema = z.object({
      name: z.string().min(1).max(80).trim(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: parsed.error.issues[0].message });
    }
    if (!(await isOrgFounder(me.userId, orgId))) {
      return res
        .status(403)
        .json({ success: false, error: "Only founders can rename rooms" });
    }
    const room = await ConferenceRoom.findOne({
      _id: new Types.ObjectId(id),
      orgId: new Types.ObjectId(orgId),
    });
    if (!room) {
      return res
        .status(404)
        .json({ success: false, error: "Conference room not found" });
    }
    room.name = parsed.data.name;
    try {
      await room.save();
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({
          success: false,
          error: `A room named "${parsed.data.name}" already exists in this org`,
        });
      }
      throw err;
    }
    res.json({ success: true, room });
  } catch (error) {
    console.error("[conference-rooms] rename error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to rename conference room",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /conference-rooms/:id?orgId=<orgId>
 *
 * Cancel a conference room. Behavior depends on whether the room is
 * billed:
 *
 * - **Free included room** (no parent rooms invoice exists for this org):
 *   immediate soft-delete, isActive=false right now. No billing impact.
 *
 * - **Paid extra room** (parent rooms invoice exists): the founder has
 *   already paid for the current cycle, so the room stays usable until
 *   the cycle ends. We set `scheduledDeactivationAt = parent.nextDueDate`
 *   and the lazy prune in GET /conference-rooms flips `isActive` to
 *   false on/after that date. The parent invoice's `lineItems[0].quantity`
 *   is decremented immediately so the NEXT cycle bills the right count.
 *   No refund — they paid for the full month, the room stays till it's
 *   over.
 *
 * Either way, founder-only and existing bookings stay in the DB so we
 * don't lose schedule history.
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const orgId = req.query.orgId as string;
    const { id } = req.params;
    if (
      !orgId ||
      !Types.ObjectId.isValid(orgId) ||
      !Types.ObjectId.isValid(id)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Valid orgId and id required" });
    }
    if (!(await isOrgFounder(me.userId, orgId))) {
      return res
        .status(403)
        .json({ success: false, error: "Only founders can delete rooms" });
    }
    const room = await ConferenceRoom.findOne({
      _id: new Types.ObjectId(id),
      orgId: new Types.ObjectId(orgId),
    });
    if (!room || !room.isActive) {
      return res
        .status(404)
        .json({ success: false, error: "Conference room not found" });
    }

    const { activeUntil, parentCancelled } = await applyCancelRoomBilling(
      orgId,
      id
    );

    res.json({
      success: true,
      // Null when room was deactivated immediately (free included room
      // path). Set to the cycle-end date when it'll stay live till then.
      activeUntil: activeUntil ? activeUntil.toISOString() : null,
      // True when this cancellation took the org back to 0 paid rooms
      // and the parent recurring invoice was cancelled.
      parentCancelled,
    });
  } catch (error) {
    console.error("[conference-rooms] delete error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete conference room",
      details: (error as Error).message,
    });
  }
});

export default router;
