import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { Message } from "../models/message.model";
import { dmConvId } from "../utils/conv";
import { Types } from "mongoose";
import { getSocketInstance } from "../services/socket";
import {
  ChatClear,
  clearedAtFor,
  dmClearedNorClauses,
} from "../models/chatClear.model";
import {
  DmSettings,
  RETENTION_DAY_OPTIONS,
} from "../models/dmSettings.model";

const router = Router();

router.get("/:otherId/messages", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { otherId } = z.object({ otherId: z.string() }).parse(req.params);
  const { cursor, limit = 40, orgId } = z
    .object({
      cursor: z.string().optional(),
      limit: z.coerce.number().max(100).optional(),
      orgId: z.string().optional(),
    })
    .parse(req.query);

  const convId = dmConvId(me.userId, otherId);
  const q: any = { convId };
  if (orgId) {
    q.$or = [
      { orgId: new Types.ObjectId(orgId) },
      { orgId: null },
      { orgId: { $exists: false } },
    ];
  }
  if (cursor) q.createdAt = { $lt: new Date(cursor) };

  // "Clear chat for me": hide everything up to this user's watermark. Nothing
  // is deleted — the other participant keeps their full copy.
  const clearedAt = await clearedAtFor(me.userId, `dm:${otherId}`);
  if (clearedAt) {
    q.createdAt = { ...(q.createdAt || {}), $gt: clearedAt };
  }

  const docs = await Message.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("replyTo")
    .lean();
  const items = docs.reverse();
  const nextCursor = items.length ? items[0].createdAt.toISOString() : null;
  res.json({ items, nextCursor });
});

router.post("/:otherId/read", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { otherId } = req.params;
  const orgId = req.query.orgId as string | undefined;
  const upTo = (req.body?.upTo && new Date(req.body.upTo)) || new Date();
  const convId = dmConvId(me, otherId);

  const matchQuery: any = {
    convId,
    to: new Types.ObjectId(me),
    readAt: null,
    createdAt: { $lte: upTo },
  };
  if (orgId) {
    matchQuery.$or = [
      { orgId: new Types.ObjectId(orgId) },
      { orgId: null },
      { orgId: { $exists: false } },
    ];
  }

  const readAt = new Date();
  const result = await Message.updateMany(
    matchQuery,
    { $set: { readAt } }
  );

  // Clear any manual "mark as unread" the user had set on this DM —
  // opening the chat is the universal signal that they've actually
  // read it. Lazy-import to dodge a top-of-file edit; the model is
  // tiny and only loaded after first archive/unread call anyway.
  const { ConversationState } = await import(
    "../models/conversationState.model"
  );
  await ConversationState.updateOne(
    { userId: new Types.ObjectId(me), convId },
    { $set: { markedUnreadAt: null } },
  ).catch(() => {});

  // Emit socket event to user's personal room to update unread count in real-time
  const io = getSocketInstance();
  if (io) {
    io.to(`user:${me}`).emit("dm:read", {
      otherId,
      convId,
      count: result.modifiedCount,
    });

    // Also tell the SENDER their messages were seen, so their open chat can
    // flip the sent-checkmark to a read receipt in real time. Separate event
    // from `dm:read` (which means "I read — sync MY unread badges") so
    // existing clients' badge logic is untouched.
    if (result.modifiedCount > 0) {
      io.to(`user:${otherId}`).emit("dm:seen", {
        convId,
        by: me,
        readAt: readAt.toISOString(),
      });
    }
  }

  res.json({ ok: true });
});

// Edit message
router.put("/message/:messageId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { messageId } = req.params;
  const orgId = req.query.orgId as string | undefined;
  const { text } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "Message text is required" });
  }

  const matchQuery: any = {
    _id: new Types.ObjectId(messageId),
    from: new Types.ObjectId(me), // Only allow editing own messages
  };
  if (orgId) {
    matchQuery.$or = [
      { orgId: new Types.ObjectId(orgId) },
      { orgId: null },
      { orgId: { $exists: false } },
    ];
  }

  const message = await Message.findOneAndUpdate(
    matchQuery,
    {
      $set: {
        text: text.trim(),
        editedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!message) {
    return res
      .status(404)
      .json({ error: "Message not found or not authorized" });
  }

  res.json({ ok: true, message });
});

// Delete message (soft delete - keeps the row so both parties see "deleted" placeholder)
router.delete("/message/:messageId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { messageId } = req.params;
  const orgId = req.query.orgId as string | undefined;

  const matchQuery: any = {
    _id: new Types.ObjectId(messageId),
    from: new Types.ObjectId(me), // Only allow deleting own messages
  };
  if (orgId) {
    matchQuery.$or = [
      { orgId: new Types.ObjectId(orgId) },
      { orgId: null },
      { orgId: { $exists: false } },
    ];
  }

  const message = await Message.findOneAndUpdate(
    matchQuery,
    {
      $set: {
        deletedAt: new Date(),
        text: "",
        attachments: [],
        reactions: {},
      },
    },
    { new: true }
  );

  if (!message) {
    return res
      .status(404)
      .json({ error: "Message not found or not authorized" });
  }

  // Broadcast deletion so both sides update in real-time
  const io = getSocketInstance();
  if (io) {
    const roomName = orgId ? `${message.convId}:${orgId}` : message.convId;
    const payload = {
      messageId: message._id.toString(),
      convId: message.convId,
      deletedAt: message.deletedAt,
    };
    io.to(roomName).emit("dm:message-deleted", payload);
    io.to(`user:${message.to.toString()}`).emit("dm:message-deleted", payload);
    io.to(`user:${me}`).emit("dm:message-deleted", payload);
  }

  res.json({ ok: true });
});

/** unread counts per conversation */
router.get("/unread", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const orgId = req.query.orgId as string | undefined;

  const matchStage: any = { to: new Types.ObjectId(me), readAt: null };
  if (orgId) {
    matchStage.$or = [
      { orgId: new Types.ObjectId(orgId) },
      { orgId: null },
      { orgId: { $exists: false } },
    ];
  }

  // Clearing a chat must also clear its badge — otherwise the conversation
  // reads as empty but still shows "3 unread". One clause per cleared chat,
  // which is a handful at most.
  const clearedNor = await dmClearedNorClauses(me);
  if (clearedNor.length) matchStage.$nor = clearedNor;

  const rows = await Message.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$convId",
        count: { $sum: 1 },
        latestAt: { $max: "$createdAt" },
      },
    },
    { $sort: { latestAt: -1 } },
  ]);

  // return convId + count (+ otherId for convenience)
  const result = rows.map((r) => {
    const parts = (r._id as string).split(":"); // ["dm", a, b]
    const otherId = parts[1] === me ? parts[2] : parts[1];
    return {
      convId: r._id as string,
      otherId,
      count: r.count,
      latestAt: r.latestAt,
    };
  });

  res.json({ unread: result });
});

/** Get last message timestamps for all conversations */
router.get("/last-messages", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const orgId = req.query.orgId as string | undefined;

  const matchStage: any = {
    $and: [
      {
        $or: [
          { from: new Types.ObjectId(me) },
          { to: new Types.ObjectId(me) },
        ],
      }
    ]
  };
  if (orgId) {
    matchStage.$and.push({
      $or: [
        { orgId: new Types.ObjectId(orgId) },
        { orgId: null },
        { orgId: { $exists: false } },
      ],
    });
  }

  // A cleared chat must not keep sorting by its old last message — the preview
  // should fall back to whatever was sent AFTER the clear, or drop out entirely.
  const clearedNor = await dmClearedNorClauses(me);
  if (clearedNor.length) matchStage.$and.push({ $nor: clearedNor });

  const rows = await Message.aggregate([
    { $match: matchStage },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$convId",
        latestAt: { $first: "$createdAt" },
        text: { $first: "$text" },
        from: { $first: "$from" },
        attachments: { $first: "$attachments" },
      },
    },
  ]);

  // return otherId, timestamp, text, from, hasAttachments
  const result = rows.map((r) => {
    const parts = (r._id as string).split(":"); // ["dm", a, b]
    const otherId = parts[1] === me ? parts[2] : parts[1];
    return {
      otherId,
      timestamp: new Date(r.latestAt).getTime(),
      text: r.text || "",
      from: r.from?.toString(),
      hasAttachments: r.attachments && r.attachments.length > 0,
    };
  });

  res.json({ conversations: result });
});

/**
 * POST /dm/:otherId/clear — "clear chat for me", synced across devices.
 *
 * A watermark, not a delete: the other participant keeps their copy, and
 * anything sent after this point shows up normally.
 */
router.post("/:otherId/clear", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { otherId } = z
    .object({ otherId: z.string().regex(/^[a-fA-F0-9]{24}$/) })
    .parse(req.params);

  const clearedAt = new Date();
  await ChatClear.findOneAndUpdate(
    { userId: new Types.ObjectId(me.userId), convKey: `dm:${otherId}` },
    { $set: { clearedAt } },
    { upsert: true }
  );

  res.json({ ok: true, clearedAt: clearedAt.toISOString() });
});

/**
 * GET /dm/:otherId/settings — disappearing-messages state for this DM.
 *
 * Returns the default (off) rather than 404 when no row exists, so the client
 * has one shape to read regardless of whether anyone has touched the setting.
 */
router.get("/:otherId/settings", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { otherId } = z
    .object({ otherId: z.string().regex(/^[a-fA-F0-9]{24}$/) })
    .parse(req.params);

  const convId = dmConvId(me.userId, otherId);
  const row = await DmSettings.findOne({ convId }).lean<any>();

  res.json({
    messageRetentionDays: row?.messageRetentionDays || 0,
    updatedBy: row?.updatedBy ? String(row.updatedBy) : null,
    updatedAt: row?.updatedAt || null,
  });
});

/**
 * PUT /dm/:otherId/settings   { messageRetentionDays }
 *
 * The setting belongs to the CONVERSATION, not to one side of it: either
 * participant can change it and both are bound by it, which is why it is keyed
 * on the sorted convId. Both are notified over `dm:settings`.
 */
router.put("/:otherId/settings", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { otherId } = z
    .object({ otherId: z.string().regex(/^[a-fA-F0-9]{24}$/) })
    .parse(req.params);
  const { messageRetentionDays } = z
    .object({
      messageRetentionDays: z
        .number()
        .int()
        .refine(
          (n) => (RETENTION_DAY_OPTIONS as readonly number[]).includes(n),
          {
            message:
              "messageRetentionDays must be 0, 7, 30, 90, 180, or 365",
          }
        ),
    })
    .parse(req.body);

  const convId = dmConvId(me.userId, otherId);
  await DmSettings.findOneAndUpdate(
    { convId },
    {
      $set: {
        messageRetentionDays,
        updatedBy: new Types.ObjectId(me.userId),
      },
    },
    { upsert: true }
  );

  const payload = {
    otherId,
    messageRetentionDays,
    updatedBy: me.userId,
  };

  const io = getSocketInstance();
  if (io) {
    // Each side needs the OTHER party's id in its own frame — `otherId` is
    // viewer-relative, so the two emits are not the same payload.
    io.to(`user:${me.userId}`).emit("dm:settings", payload);
    io.to(`user:${otherId}`).emit("dm:settings", {
      ...payload,
      otherId: me.userId,
    });
  }

  res.json({ ok: true, messageRetentionDays });
});

export default router;
