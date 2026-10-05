// src/controllers/downlineOffer.controller.ts
//
// POST /downlines/:userId/extend-offer
//
// Lets an authenticated (non-admin) user extend a DOWNLINE member's 24-hour
// free-first-month offer window. Mirrors the garage-admin extend
// (`garageAdmin.controller.ts#extendUserOffer`) write-for-write, but is
// scoped + audited to the calling user instead of a garage admin:
//
//   - Same unconditional `offerExpiresAtOverride = now + hours` write (no
//     max() against a prior override — mirrors admin exactly).
//   - Same `offerExtendedAt = now` audit stamp.
//   - Writes `offerExtendedByUserId` (NOT `offerExtendedByAdminId`).
//
// The entire security model is the upline-ownership guard below: the target
// user must carry the caller in its materialized `ancestors` path, i.e. the
// caller must be a real upline of the target. `ancestors` is indexed
// (see user.model.ts), so this is a cheap, single-query check.

import { Request, Response } from "express";
import { Types } from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { User } from "../models/user.model";
import { comboWindowFor, comboWindowStatus } from "../services/comboWindow";
import { ok, fail } from "../utils/http";

export async function extendDownlineOffer(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest;
    const callerId = authReq.user!.userId;
    const { userId: targetId } = req.params;

    if (!Types.ObjectId.isValid(targetId)) {
      return res.status(400).json(fail("Invalid user id"));
    }
    if (String(targetId) === String(callerId)) {
      return res.status(400).json({
        success: false,
        code: "SELF_TARGET",
        message: "Cannot extend your own window here",
      });
    }

    const raw = (req.body || {}).hours;
    const hours = raw === undefined ? 24 : Number(raw);
    if (
      !Number.isFinite(hours) ||
      !Number.isInteger(hours) ||
      hours < 1 ||
      hours > 720
    ) {
      return res
        .status(400)
        .json(fail("hours must be an integer between 1 and 720"));
    }

    // Upline-ownership guard: target must have the caller in its ancestors
    // (materialized downline path). This is the whole security model for
    // this endpoint — a caller can only extend users beneath them.
    const target = await User.findOne({
      _id: new Types.ObjectId(targetId),
      ancestors: new Types.ObjectId(String(callerId)),
    })
      .select("_id profileCompletedAt offerExpiresAtOverride")
      .lean<any>();
    if (!target) {
      return res.status(403).json({
        success: false,
        code: "NOT_YOUR_DOWNLINE",
        message: "That user is not in your downline",
      });
    }

    const now = new Date();
    // Mirror admin exactly: unconditional now+hours, no max() against a
    // prior override.
    const newExpiry = new Date(now.getTime() + hours * 60 * 60 * 1000);

    await User.updateOne(
      { _id: new Types.ObjectId(targetId) },
      {
        $set: {
          offerExpiresAtOverride: newExpiry,
          offerExtendedAt: now,
          offerExtendedByUserId: new Types.ObjectId(String(callerId)),
        },
      },
    );

    console.log(
      `[downlines][extend-offer] caller=${String(callerId)} target=${targetId} hours=${hours} newExpiry=${newExpiry.toISOString()}`,
    );

    // Recompute the window with the fresh override so the FE can update the
    // row in place without a listing refetch.
    const w = comboWindowFor(
      {
        profileCompletedAt: target.profileCompletedAt,
        offerExpiresAtOverride: newExpiry,
      },
      now,
    );

    return res.json(
      ok({
        userId: String(targetId),
        offerWindow: {
          // The caller can't know the target's UP-purchase moment here, so
          // "completed" can't surface from this endpoint — it'll show up on
          // the next table load once the caller (or admin) has that data.
          status: comboWindowStatus(w, {}),
          startsAt: w.startsAt ? w.startsAt.toISOString() : null,
          expiresAt: w.expiresAt ? w.expiresAt.toISOString() : null,
          secondsRemaining: w.secondsRemaining,
          extendedByUpline: true,
        },
      }),
    );
  } catch (e) {
    console.error("[downlines][extend-offer]", e);
    return res.status(500).json(fail("Failed to extend offer"));
  }
}
