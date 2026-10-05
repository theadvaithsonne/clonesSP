import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { UserNotification } from "../models/userNotification.model";
import { Types } from "mongoose";

const router = Router();

/**
 * The notifications that belong in an office's bell: that office's own, plus
 * those that belong to no office. Global DMs never have one. Nor does a DM from
 * someone in two or more offices — their login token carries no office, so the
 * DM and its notification are stored without one. The DM itself already shows
 * in every office's chat list (routes/dm.ts matches `orgId: null`); without the
 * same rule here its notification showed in none.
 */
function officeScope(orgId: string) {
  return [
    { orgId: new Types.ObjectId(orgId) },
    { type: "global_dm" }, // Global DMs don't have orgId
    { type: "dm", orgId: null }, // `null` also matches a missing orgId
  ];
}

/** Get all notifications for current user (not cleared) */
router.get("/", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const orgId = req.query.orgId as string | undefined;

  const query: any = {
    userId: new Types.ObjectId(me),
    cleared: false,
  };

  if (orgId) {
    query.$or = officeScope(orgId);
  }

  try {
    const notifications = await UserNotification.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ notifications });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

/** Get unread count */
router.get("/unread-count", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const orgId = req.query.orgId as string | undefined;

  const query: any = {
    userId: new Types.ObjectId(me),
    cleared: false,
    read: false,
  };

  if (orgId) {
    query.$or = officeScope(orgId);
  }

  try {
    const count = await UserNotification.countDocuments(query);
    res.json({ count });
  } catch (error) {
    console.error("Failed to fetch unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

/** Mark notification as read */
router.post("/:notificationId/read", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { notificationId } = z
    .object({ notificationId: z.string() })
    .parse(req.params);

  try {
    const notification = await UserNotification.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(me),
      },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ ok: true, notification });
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

/** Mark all notifications as read */
router.post("/read-all", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const orgId = req.query.orgId as string | undefined;

  const query: any = {
    userId: new Types.ObjectId(me),
    cleared: false,
    read: false,
  };

  if (orgId) {
    query.$or = officeScope(orgId);
  }

  try {
    const result = await UserNotification.updateMany(query, {
      $set: { read: true },
    });

    res.json({ ok: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Failed to mark all as read:", error);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

/** Clear (soft delete) a notification */
router.delete("/:notificationId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { notificationId } = z
    .object({ notificationId: z.string() })
    .parse(req.params);

  try {
    const notification = await UserNotification.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(me),
      },
      { $set: { cleared: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to clear notification:", error);
    res.status(500).json({ error: "Failed to clear notification" });
  }
});

/** Clear all notifications */
router.delete("/", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const orgId = req.query.orgId as string | undefined;

  const query: any = {
    userId: new Types.ObjectId(me),
    cleared: false,
  };

  if (orgId) {
    query.$or = officeScope(orgId);
  }

  try {
    const result = await UserNotification.updateMany(query, {
      $set: { cleared: true },
    });

    res.json({ ok: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Failed to clear all notifications:", error);
    res.status(500).json({ error: "Failed to clear all notifications" });
  }
});

/** Clear notifications for a specific DM conversation */
router.delete("/dm/:dmFromUserId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { dmFromUserId } = z
    .object({ dmFromUserId: z.string() })
    .parse(req.params);
  const orgId = req.query.orgId as string | undefined;

  const query: any = {
    userId: new Types.ObjectId(me),
    type: "dm",
    dmFrom: new Types.ObjectId(dmFromUserId),
    cleared: false,
  };

  if (orgId) {
    // This office's, and any stored without an office (see officeScope).
    query.orgId = { $in: [new Types.ObjectId(orgId), null] };
  }

  try {
    const result = await UserNotification.updateMany(query, {
      $set: { cleared: true },
    });

    res.json({ ok: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Failed to clear DM notifications:", error);
    res.status(500).json({ error: "Failed to clear DM notifications" });
  }
});

/** Clear notifications for a specific group */
router.delete("/group/:groupId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  const orgId = req.query.orgId as string | undefined;

  const query: any = {
    userId: new Types.ObjectId(me),
    type: "group_message",
    groupId: new Types.ObjectId(groupId),
    cleared: false,
  };

  if (orgId) {
    query.orgId = new Types.ObjectId(orgId);
  }

  try {
    const result = await UserNotification.updateMany(query, {
      $set: { cleared: true },
    });

    res.json({ ok: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Failed to clear group notifications:", error);
    res.status(500).json({ error: "Failed to clear group notifications" });
  }
});

/** Get all Global DM notifications */
router.get("/global-dm", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;

  try {
    const notifications = await UserNotification.find({
      userId: new Types.ObjectId(me),
      type: "global_dm",
      cleared: false,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ notifications });
  } catch (error) {
    console.error("Failed to fetch global DM notifications:", error);
    res.status(500).json({ error: "Failed to fetch global DM notifications" });
  }
});

/** Get unread count for Global DMs only */
router.get("/global-dm/unread-count", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;

  try {
    const count = await UserNotification.countDocuments({
      userId: new Types.ObjectId(me),
      type: "global_dm",
      cleared: false,
      read: false,
    });

    res.json({ count });
  } catch (error) {
    console.error("Failed to fetch global DM unread count:", error);
    res.status(500).json({ error: "Failed to fetch global DM unread count" });
  }
});

/** Mark all Global DM notifications as read */
router.post("/global-dm/read-all", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;

  try {
    const result = await UserNotification.updateMany(
      {
        userId: new Types.ObjectId(me),
        type: "global_dm",
        cleared: false,
        read: false,
      },
      { $set: { read: true } }
    );

    res.json({ ok: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Failed to mark global DM notifications as read:", error);
    res
      .status(500)
      .json({ error: "Failed to mark global DM notifications as read" });
  }
});

/** Clear notifications for a specific Global DM conversation */
router.delete("/global-dm/:globalDmFromUserId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { globalDmFromUserId } = z
    .object({ globalDmFromUserId: z.string() })
    .parse(req.params);

  try {
    const result = await UserNotification.updateMany(
      {
        userId: new Types.ObjectId(me),
        type: "global_dm",
        globalDmFrom: new Types.ObjectId(globalDmFromUserId),
        cleared: false,
      },
      { $set: { cleared: true } }
    );

    res.json({ ok: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Failed to clear global DM notifications:", error);
    res.status(500).json({ error: "Failed to clear global DM notifications" });
  }
});

/** Clear all Global DM notifications */
router.delete("/global-dm", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;

  try {
    const result = await UserNotification.updateMany(
      {
        userId: new Types.ObjectId(me),
        type: "global_dm",
        cleared: false,
      },
      { $set: { cleared: true } }
    );

    res.json({ ok: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Failed to clear all global DM notifications:", error);
    res
      .status(500)
      .json({ error: "Failed to clear all global DM notifications" });
  }
});

export default router;
