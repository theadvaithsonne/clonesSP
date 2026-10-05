/**
 * Ignite call — the link between a Garage affiliate and a NetworkChains
 * catch-up, plus the reads that back the status column and its side panel.
 *
 * Guards are attached PER ROUTE, never at the router level: this router
 * shares the bare /garage-admin mount, where router-level middleware fires
 * for paths this router does not define and rejects them before the next
 * router is reached. See CLAUDE.md — that pattern took down admin login in
 * production.
 */
import { Router, Request, Response } from "express";
import { Types } from "mongoose";

import { requireGarageAdminAuth, requireGarageSuperAdmin } from "../middleware/garageAdminAuth";
import { IgniteCallModel } from "../models/igniteCall.model";
import { applyManualCompletion } from "../services/igniteCall.service";
import { User } from "../models/user.model";
import { GarageAdminModel } from "../models/garageAdmin.model";
import {
  ncHostByEmail,
  ncHostSchedules,
  ncCreateSchedule,
  ncAddAttendee,
  ncScheduleRelated,
  ncRescheduleSchedule,
  NcMeetError,
} from "../lib/ncMeetClient";

const router = Router();
const adminOnly = [requireGarageAdminAuth];
const superAdminOnly = [requireGarageAdminAuth, requireGarageSuperAdmin];

function ncErrorResponse(res: Response, err: unknown, fallback: string) {
  if (err instanceof NcMeetError) {
    return res.status(err.status === 503 ? 503 : 502).json({ success: false, message: err.message });
  }
  console.error(`[garage-admin/ignite-call] ${fallback}:`, err);
  return res.status(500).json({ success: false, message: fallback });
}

/**
 * GET /garage-admin/admins/:adminId/catchups
 * That admin's upcoming catch-ups, for step 2 of the picker.
 * `host: null` means the admin has no NetworkChains account — a normal
 * outcome the picker renders explicitly, not an error.
 *
 * Note: `host.orgId` can come back as `""` for a NetworkChains user with no
 * organisation (contacts-backend's host-by-email resolves org membership
 * from an array, not a scalar). We only ever forward `host` as-is to the
 * frontend and read `host.userId` — never `new Types.ObjectId(host.orgId)`,
 * which would throw on the empty string.
 */
router.get("/admins/:adminId/catchups", superAdminOnly, async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params;
    if (!Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({ success: false, message: "Invalid admin id" });
    }
    const admin = await GarageAdminModel.findById(adminId).select("_id name email").lean();
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    const { user: host } = await ncHostByEmail(String(admin.email));
    if (!host) {
      return res.json({ success: true, data: { host: null, schedules: [] } });
    }
    const { schedules } = await ncHostSchedules(host.userId, 60);
    return res.json({ success: true, data: { host, schedules } });
  } catch (err) {
    return ncErrorResponse(res, err, "Failed to load catch-ups");
  }
});

/**
 * POST /garage-admin/users/:userId/ignite-call
 * Attach an existing catch-up, or create one and attach it.
 *
 * Body: { adminId, ncScheduleId? , createSchedule?: { title, scheduledAt,
 *         durationMinutes?, timeZone?, description? } }
 */
router.post("/users/:userId/ignite-call", superAdminOnly, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { adminId, ncScheduleId, createSchedule } = req.body ?? {};

    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    if (!Types.ObjectId.isValid(String(adminId))) {
      return res.status(400).json({ success: false, message: "Invalid admin id" });
    }
    if (!ncScheduleId && !createSchedule) {
      return res
        .status(400)
        .json({ success: false, message: "Provide ncScheduleId or createSchedule" });
    }

    const [affiliate, admin] = await Promise.all([
      User.findById(userId).select("_id name email assignedSupportAgentId").lean(),
      GarageAdminModel.findById(adminId).select("_id name email profilePicture").lean(),
    ]);
    if (!affiliate) return res.status(404).json({ success: false, message: "Affiliate not found" });
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });

    // The Ignite call is conducted by the affiliate's ASSIGNED support agent —
    // the Assigned To column — and by nobody else. The UI has no admin picker
    // and refuses to open when unassigned, but enforce it here too: a stale
    // page or a direct API call must not be able to hand the call to someone
    // who doesn't own the relationship, which would split ownership between
    // the two columns.
    const assignedAgentId = (affiliate as { assignedSupportAgentId?: unknown })
      .assignedSupportAgentId;
    if (!assignedAgentId) {
      return res.status(409).json({
        success: false,
        message:
          "Assign a support agent to this affiliate first — the Ignite call is scheduled under them.",
      });
    }
    if (String(assignedAgentId) !== String(adminId)) {
      return res.status(409).json({
        success: false,
        message:
          "The Ignite call must be scheduled under this affiliate's assigned support agent. Refresh the page and try again.",
      });
    }

    const { user: host } = await ncHostByEmail(String(admin.email));
    if (!host) {
      return res.status(409).json({
        success: false,
        message: `${admin.name || admin.email} has no NetworkChains account, so they have no catch-ups to attach.`,
      });
    }

    // Either use the catch-up the operator picked, or create a new one with
    // the affiliate already on it.
    let schedule;
    if (createSchedule) {
      schedule = await ncCreateSchedule(host.userId, {
        title: String(createSchedule.title ?? "Ignite call"),
        scheduledAt: String(createSchedule.scheduledAt),
        durationMinutes: createSchedule.durationMinutes,
        timeZone: createSchedule.timeZone,
        description: createSchedule.description,
        attendees: affiliate.email
          ? [{ email: String(affiliate.email), displayName: affiliate.name ?? undefined }]
          : [],
      });
    } else {
      const { schedules } = await ncHostSchedules(host.userId, 180);
      schedule = schedules.find((s) => s.scheduleId === String(ncScheduleId));
      if (!schedule) {
        return res.status(404).json({ success: false, message: "Catch-up not found for this admin" });
      }
      // Idempotent on the NetworkChains side — a no-op if already listed.
      if (affiliate.email) {
        await ncAddAttendee(schedule.scheduleId, String(affiliate.email), affiliate.name ?? undefined);
      }
    }

    const actingAdminId = (req as any).garageAdmin?.id;
    const call = await IgniteCallModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), ncScheduleId: schedule.scheduleId },
      {
        $set: {
          adminId: new Types.ObjectId(String(adminId)),
          ncHostUserId: host.userId,
          ncRoomId: schedule.roomId,
          title: schedule.title,
          scheduledAt: new Date(schedule.scheduledAt),
          detachedAt: null,
        },
        $setOnInsert: {
          userId: new Types.ObjectId(userId),
          ncScheduleId: schedule.scheduleId,
          createdBy: actingAdminId ? new Types.ObjectId(actingAdminId) : undefined,
        },
      },
      { upsert: true, new: true },
    ).lean();

    // Shape must match the frontend's IgniteCallSummary EXACTLY — the picker
    // writes this straight into the table row, so a missing field would leave
    // the cell with an undefined status until the next reload.
    const historyCount = await IgniteCallModel.countDocuments({ userId });

    return res.json({
      success: true,
      data: {
        id: String(call!._id),
        adminId: String(admin._id),
        admin: { name: admin.name, email: admin.email, profilePicture: (admin as any).profilePicture ?? null },
        ncScheduleId: schedule.scheduleId,
        ncRoomId: schedule.roomId,
        title: schedule.title,
        scheduledAt: schedule.scheduledAt,
        // A just-attached call has not started. `started`/`completed` arrive
        // from the live status on the next list load.
        status: "scheduled",
        startedAt: null,
        endedAt: null,
        historyCount,
      },
    });
  } catch (err) {
    return ncErrorResponse(res, err, "Failed to attach Ignite call");
  }
});

/** DELETE /garage-admin/users/:userId/ignite-call/:id — soft detach. */
router.delete("/users/:userId/ignite-call/:id", superAdminOnly, async (req: Request, res: Response) => {
  try {
    const { userId, id } = req.params;
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const updated = await IgniteCallModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { detachedAt: new Date() } },
      { new: true },
    ).lean();
    if (!updated) return res.status(404).json({ success: false, message: "Ignite call not found" });
    return res.json({ success: true, data: { id, detachedAt: updated.detachedAt } });
  } catch (err) {
    console.error("[garage-admin/ignite-call] detach error:", err);
    return res.status(500).json({ success: false, message: "Failed to detach Ignite call" });
  }
});

/** GET /garage-admin/users/:userId/ignite-calls — full history for the panel. */
router.get("/users/:userId/ignite-calls", adminOnly, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const calls = await IgniteCallModel.find({ userId }).sort({ scheduledAt: -1 }).lean();
    const adminIds = [...new Set(calls.map((c) => String(c.adminId)))];
    const admins = await GarageAdminModel.find({ _id: { $in: adminIds } })
      .select("_id name email profilePicture")
      .lean();
    const adminById = new Map(admins.map((a) => [String(a._id), a]));

    return res.json({
      success: true,
      data: {
        calls: calls.map((c) => {
          const a = adminById.get(String(c.adminId));
          return {
            id: String(c._id),
            adminId: String(c.adminId),
            admin: a
              ? { name: a.name, email: a.email, profilePicture: (a as any).profilePicture ?? null }
              : null,
            ncScheduleId: c.ncScheduleId,
            ncRoomId: c.ncRoomId,
            title: c.title,
            scheduledAt: c.scheduledAt,
            detachedAt: c.detachedAt ?? null,
          };
        }),
      },
    });
  } catch (err) {
    console.error("[garage-admin/ignite-call] history error:", err);
    return res.status(500).json({ success: false, message: "Failed to load Ignite calls" });
  }
});

/** GET /garage-admin/ignite-call/:id/related — recordings, transcript, summary. */
router.get("/ignite-call/:id/related", adminOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const call = await IgniteCallModel.findById(id).lean();
    if (!call) return res.status(404).json({ success: false, message: "Ignite call not found" });

    try {
      const related = (await ncScheduleRelated(call.ncScheduleId)) as Record<string, unknown>;
      // A manual "mark as completed" wins over the derived status here too,
      // or the panel would contradict the column it was opened from.
      if (related && typeof related.status === "string") {
        related.status = applyManualCompletion(
          related.status as "not_scheduled" | "scheduled" | "started" | "completed",
          call.manuallyCompletedAt,
        );
      }
      return res.json({
        success: true,
        data: {
          call: {
            id: String(call._id),
            title: call.title,
            manuallyCompletedAt: call.manuallyCompletedAt ?? null,
          },
          related,
        },
      });
    } catch (err) {
      // The schedule can be deleted in NetworkChains after we linked it. The
      // snapshot keeps the panel readable rather than showing a hard error.
      if (err instanceof NcMeetError && err.status === 404) {
        return res.json({
          success: true,
          data: {
            call: { id: String(call._id), title: call.title },
            related: null,
            unavailableReason: "This catch-up no longer exists in NetworkChains.",
          },
        });
      }
      throw err;
    }
  } catch (err) {
    return ncErrorResponse(res, err, "Failed to load related data");
  }
});

/**
 * PATCH /garage-admin/users/:userId/ignite-call/:id/reschedule
 *
 * Move an attached Ignite call. Updates the catch-up in NetworkChains (which
 * re-syncs the Google invite) and then the local snapshot, so the table and
 * CSV export keep showing the right time even while NetworkChains is
 * unreachable.
 */
router.patch(
  "/users/:userId/ignite-call/:id/reschedule",
  superAdminOnly,
  async (req: Request, res: Response) => {
    try {
      const { userId, id } = req.params;
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid id" });
      }
      const { title, scheduledAt, durationMinutes, timeZone, description } = req.body ?? {};
      if (!scheduledAt && !title && !durationMinutes) {
        return res.status(400).json({ success: false, message: "Nothing to update" });
      }

      const call = await IgniteCallModel.findOne({ _id: id, userId }).lean();
      if (!call) {
        return res.status(404).json({ success: false, message: "Ignite call not found" });
      }
      if (call.detachedAt) {
        return res
          .status(409)
          .json({ success: false, message: "This Ignite call has been detached." });
      }

      const updated = await ncRescheduleSchedule(call.ncScheduleId, {
        title,
        scheduledAt,
        durationMinutes,
        timeZone,
        description,
      });

      // Mirror into our snapshot. These two fields are what the column, the
      // history list and the CSV export read when NetworkChains is down, so
      // leaving them stale would make the table disagree with the invite.
      await IgniteCallModel.updateOne(
        { _id: id },
        { $set: { title: updated.title, scheduledAt: new Date(updated.scheduledAt) } },
      );

      return res.json({
        success: true,
        data: {
          id: String(call._id),
          ncScheduleId: updated.scheduleId,
          title: updated.title,
          scheduledAt: updated.scheduledAt,
          durationMinutes: updated.durationMinutes,
        },
      });
    } catch (err) {
      return ncErrorResponse(res, err, "Failed to reschedule Ignite call");
    }
  },
);

/**
 * POST /garage-admin/users/:userId/ignite-call/:id/complete
 * Body: { completed: boolean }
 *
 * Manual override for a call the derived status cannot see as finished —
 * it happened off-platform, or the room never stamped a session. Recorded as
 * its own field so the derived truth stays visible underneath, and reversible.
 */
router.post(
  "/users/:userId/ignite-call/:id/complete",
  superAdminOnly,
  async (req: Request, res: Response) => {
    try {
      const { userId, id } = req.params;
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid id" });
      }
      const completed = req.body?.completed !== false; // default: mark complete
      const actingAdminId = (req as any).garageAdmin?.id;

      const updated = await IgniteCallModel.findOneAndUpdate(
        { _id: id, userId },
        completed
          ? {
              $set: {
                manuallyCompletedAt: new Date(),
                ...(actingAdminId
                  ? { manuallyCompletedBy: new Types.ObjectId(actingAdminId) }
                  : {}),
              },
            }
          : { $set: { manuallyCompletedAt: null }, $unset: { manuallyCompletedBy: 1 } },
        { new: true },
      ).lean();

      if (!updated) {
        return res.status(404).json({ success: false, message: "Ignite call not found" });
      }
      return res.json({
        success: true,
        data: {
          id: String(updated._id),
          manuallyCompletedAt: updated.manuallyCompletedAt ?? null,
        },
      });
    } catch (err) {
      console.error("[garage-admin/ignite-call] complete override error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to update the Ignite call status" });
    }
  },
);

export default router;
