import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { GlobalMessage } from "../models/globalMessage.model";
import { globalDmConvId } from "../utils/globalConv";
import { Types } from "mongoose";
import { getSocketInstance } from "../services/socket";
import { User } from "../models/user.model";

const router = Router();

// Get messages with another user (paginated)
router.get("/:otherId/messages", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { otherId } = z.object({ otherId: z.string() }).parse(req.params);
  const { cursor, limit = 40 } = z
    .object({
      cursor: z.string().optional(),
      limit: z.coerce.number().max(100).optional(),
    })
    .parse(req.query);

  const convId = globalDmConvId(me.userId, otherId);
  const q: any = { convId };
  if (cursor) q.createdAt = { $lt: new Date(cursor) };

  const docs = await GlobalMessage.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("replyTo")
    .lean();
  const items = docs.reverse();
  const nextCursor = items.length ? items[0].createdAt.toISOString() : null;
  res.json({ items, nextCursor });
});

// Mark messages as read
router.post("/:otherId/read", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { otherId } = req.params;
  const upTo = (req.body?.upTo && new Date(req.body.upTo)) || new Date();
  const convId = globalDmConvId(me, otherId);

  const matchQuery: any = {
    convId,
    to: new Types.ObjectId(me),
    readAt: null,
    createdAt: { $lte: upTo },
  };

  const result = await GlobalMessage.updateMany(matchQuery, {
    $set: { readAt: new Date() },
  });

  // Emit socket event to user's personal room to update unread count in real-time
  const io = getSocketInstance();
  if (io) {
    io.to(`user:${me}`).emit("global-dm:read", {
      otherId,
      convId,
      count: result.modifiedCount,
    });
  }

  res.json({ ok: true });
});

// Edit message
router.put("/message/:messageId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { messageId } = req.params;
  const { text } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "Message text is required" });
  }

  const matchQuery: any = {
    _id: new Types.ObjectId(messageId),
    from: new Types.ObjectId(me), // Only allow editing own messages
  };

  const message = await GlobalMessage.findOneAndUpdate(
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

  // Emit socket event for real-time update
  const io = getSocketInstance();
  if (io) {
    io.to(message.convId).emit("global-dm:edited", {
      messageId: message._id,
      text: message.text,
      editedAt: message.editedAt,
      convId: message.convId,
    });
  }

  res.json({ ok: true, message });
});

// Delete message
router.delete("/message/:messageId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { messageId } = req.params;

  const matchQuery: any = {
    _id: new Types.ObjectId(messageId),
    from: new Types.ObjectId(me), // Only allow deleting own messages
  };

  const message = await GlobalMessage.findOneAndDelete(matchQuery);

  if (!message) {
    return res
      .status(404)
      .json({ error: "Message not found or not authorized" });
  }

  // Emit socket event for real-time update
  const io = getSocketInstance();
  if (io) {
    io.to(message.convId).emit("global-dm:deleted", {
      messageId: message._id,
      convId: message.convId,
    });
  }

  res.json({ ok: true });
});

// Get unread counts per conversation
router.get("/unread", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;

  const matchStage: any = { to: new Types.ObjectId(me), readAt: null };

  const rows = await GlobalMessage.aggregate([
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
    const parts = (r._id as string).split(":"); // ["global-dm", a, b]
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

// Get last message timestamps for all conversations
router.get("/last-messages", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;

  const matchStage: any = {
    $or: [
      { from: new Types.ObjectId(me) },
      { to: new Types.ObjectId(me) },
    ],
  };

  const rows = await GlobalMessage.aggregate([
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
    const parts = (r._id as string).split(":"); // ["global-dm", a, b]
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

// Get all conversations with user details
router.get("/conversations", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;

  // Get all unique conversations with their latest message
  const conversations = await GlobalMessage.aggregate([
    {
      $match: {
        $or: [
          { from: new Types.ObjectId(me) },
          { to: new Types.ObjectId(me) },
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$convId",
        lastMessage: { $first: "$$ROOT" },
        latestAt: { $max: "$createdAt" },
      },
    },
    { $sort: { latestAt: -1 } },
  ]);

  // Extract other user IDs
  const otherUserIds = conversations.map((conv) => {
    const parts = (conv._id as string).split(":"); // ["global-dm", a, b]
    return parts[1] === me ? parts[2] : parts[1];
  });

  // Fetch user details
  const users = await User.find(
    { _id: { $in: otherUserIds.map((id) => new Types.ObjectId(id)) } },
    { name: 1, email: 1, profilePicture: 1, city: 1, state: 1, country: 1 }
  ).lean();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  // Get unread counts
  const unreadCounts = await GlobalMessage.aggregate([
    {
      $match: {
        to: new Types.ObjectId(me),
        readAt: null,
      },
    },
    {
      $group: {
        _id: "$convId",
        count: { $sum: 1 },
      },
    },
  ]);

  const unreadMap = new Map(
    unreadCounts.map((u) => [u._id as string, u.count as number])
  );

  // Build response
  const result = conversations.map((conv) => {
    const parts = (conv._id as string).split(":");
    const otherId = parts[1] === me ? parts[2] : parts[1];
    const otherUser = userMap.get(otherId);

    return {
      convId: conv._id,
      otherId,
      otherUser: otherUser
        ? {
            _id: otherUser._id,
            name: otherUser.name,
            email: otherUser.email,
            profilePicture: otherUser.profilePicture,
            city: otherUser.city,
            state: otherUser.state,
            country: otherUser.country,
          }
        : null,
      lastMessage: {
        _id: conv.lastMessage._id,
        text: conv.lastMessage.text,
        from: conv.lastMessage.from,
        createdAt: conv.lastMessage.createdAt,
        attachments: conv.lastMessage.attachments,
      },
      latestAt: conv.latestAt,
      unreadCount: unreadMap.get(conv._id as string) || 0,
    };
  });

  res.json({ conversations: result });
});

export default router;
