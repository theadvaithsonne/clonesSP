import { Router, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import {
  requireGarageAdminAuth,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { Group } from "../models/group.model";
import { GroupMessage } from "../models/groupMessage.model";
import { User } from "../models/user.model";
import { GarageAdminModel } from "../models/garageAdmin.model";
import { Ticket } from "../models/ticket.model";
import { suggestTicketForChat } from "../services/supportTicketSuggest";
import multer from "multer";
import { s3Service } from "../services/s3";

// In-memory multipart for the admin attachment upload — buffered, then handed
// to S3. 50MB is plenty for support screenshots and short clips.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});
import {
  ensureSupportGroup,
  postGroupMessageAs,
} from "../services/supportChat";
import {
  isTranslateLang,
  MAX_TRANSLATE_BATCH,
  translateGroupMessages,
} from "../services/messageTranslation";

/**
 * Support Chats — the admin console's view of every member's support chat
 * (services/supportChat.ts), and the way to answer one.
 *
 * Gated on the grantable `support_chats` page (config/adminPages): view to
 * read, manage to reply / tag / delete / add tasks. Super admins hand it out
 * from Roles & Access. The App Store review account is refused here too — it
 * exists to never see real user data.
 *
 * Replies go out as the admin's own User account (matched on email), on the
 * ordinary `group:message` socket event — the member sees a message from
 * "Punith", live, in whichever app they use.
 *
 * Guarded per route, never router.use (see backend CLAUDE.md: routers share
 * the bare /garage-admin prefix).
 */
const router = Router();

const DEMO_ADMIN_EMAIL = "applereview@yopmail.com";

/** The acting admin's User id, or a response already sent. */
async function actingUser(
  req: GarageAdminRequest,
  res: Response
): Promise<Types.ObjectId | null> {
  const email = String(req.garageAdmin?.email || "").toLowerCase();
  if (!email || email === DEMO_ADMIN_EMAIL) {
    res.status(403).json({ success: false, message: "Support chats are not available for this account" });
    return null;
  }
  const u: any = await User.findOne({ email }).select("_id").lean();
  if (!u) {
    res.status(409).json({
      success: false,
      message: `There is no app account for ${email}. Sign up in the app with this email to use support chats.`,
    });
    return null;
  }
  return u._id;
}

async function loadSupportGroup(groupId: string): Promise<any | null> {
  if (!Types.ObjectId.isValid(groupId)) return null;
  return Group.findOne({ _id: groupId, kind: "support" }).lean();
}

const userCard = (u: any) =>
  u
    ? {
        id: String(u._id),
        name: u.name || null,
        email: u.email || null,
        phone: u.phone || null,
        profilePicture: u.profilePicture || null,
        country: u.country || null,
      }
    : null;

/**
 * GET /garage-admin/support-chats?filter=all|unanswered|mine&q=&page=&limit=
 *
 * `unanswered` — the last message came from someone other than the support
 *                team (the member or their upline).
 * `mine`       — members whose assignedSupportAgentId is the calling admin.
 * `q`          — the member's name, email or phone.
 */
router.get(
  "/support-chats",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const { filter = "all", q, page = 1, limit = 30 } = z
        .object({
          filter: z.enum(["all", "unanswered", "mine"]).optional(),
          q: z.string().trim().max(100).optional(),
          page: z.coerce.number().int().min(1).optional(),
          limit: z.coerce.number().int().min(1).max(100).optional(),
        })
        .parse(req.query);

      const base: any = { kind: "support" };

      if (q) {
        const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
        const hits = await User.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] })
          .select("_id")
          .limit(500)
          .lean();
        base.supportUserId = { $in: hits.map((h: any) => h._id) };
      }

      const adminId = req.garageAdmin!.id;
      const mineUserIds = (
        await User.find({ assignedSupportAgentId: new Types.ObjectId(adminId) })
          .select("_id")
          .lean()
      ).map((u: any) => u._id);

      const unansweredQ = {
        "supportLastMessage.at": { $exists: true },
        "supportLastMessage.fromStaff": false,
      };
      const mineQ = { supportUserId: { $in: mineUserIds } };
      const and = (extra: any) =>
        base.supportUserId ? { $and: [base, extra] } : { ...base, ...extra };

      const match =
        filter === "unanswered" ? and(unansweredQ) : filter === "mine" ? and(mineQ) : base;

      const [total, counts, groups] = await Promise.all([
        Group.countDocuments(match),
        Promise.all([
          Group.countDocuments(base),
          Group.countDocuments(and(unansweredQ)),
          Group.countDocuments(and(mineQ)),
        ]),
        Group.find(match)
          .sort({ supportActivityAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select(
            "_id name picture members supportUserId supportUplineId supportAgentUserId supportLastMessage supportActivityAt createdAt"
          )
          .lean(),
      ]);

      const userIds = new Set<string>();
      for (const g of groups as any[]) {
        for (const id of [g.supportUserId, g.supportUplineId, g.supportAgentUserId, g.supportLastMessage?.from]) {
          if (id) userIds.add(String(id));
        }
      }
      const users = await User.find({ _id: { $in: [...userIds].map((id) => new Types.ObjectId(id)) } })
        .select("_id name email phone profilePicture country assignedSupportAgentId")
        .lean();
      const byId = new Map((users as any[]).map((u) => [String(u._id), u]));

      const agentAdminIds = [
        ...new Set(
          (users as any[])
            .map((u) => u.assignedSupportAgentId && String(u.assignedSupportAgentId))
            .filter(Boolean)
        ),
      ];
      const agentAdmins = agentAdminIds.length
        ? await GarageAdminModel.find({ _id: { $in: agentAdminIds } })
            .select("_id name email profilePicture")
            .lean()
        : [];
      const agentById = new Map((agentAdmins as any[]).map((a) => [String(a._id), a]));

      const rows = (groups as any[]).map((g) => {
        const member = byId.get(String(g.supportUserId));
        const lm = g.supportLastMessage;
        const meMember = (g.members || []).find((m: any) => me.equals(m.userId));
        const agent = member?.assignedSupportAgentId
          ? agentById.get(String(member.assignedSupportAgentId))
          : null;
        return {
          groupId: String(g._id),
          name: g.name,
          user: userCard(member),
          upline: userCard(g.supportUplineId ? byId.get(String(g.supportUplineId)) : null),
          assignedAgent: agent
            ? { id: String(agent._id), name: agent.name || null, email: agent.email || null, profilePicture: agent.profilePicture || null }
            : null,
          lastMessage: lm?.at
            ? {
                text: lm.text || "",
                fromId: lm.from ? String(lm.from) : null,
                fromName: lm.from ? byId.get(String(lm.from))?.name || null : null,
                fromStaff: !!lm.fromStaff,
                hasAttachments: !!lm.hasAttachments,
                at: lm.at,
              }
            : null,
          awaitingReply: !!(lm?.at && !lm.fromStaff),
          unread: !!(
            lm?.at &&
            !(lm.from && me.equals(lm.from)) &&
            new Date(lm.at) > new Date(meMember?.lastReadAt || 0)
          ),
          memberCount: (g.members || []).length,
          activityAt: g.supportActivityAt || g.createdAt,
        };
      });

      res.json({
        success: true,
        data: {
          chats: rows,
          total,
          page,
          limit,
          counts: { all: counts[0], unanswered: counts[1], mine: counts[2] },
        },
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ success: false, message: "Invalid query" });
      console.error("[garage-admin/support-chats] list error:", err);
      res.status(500).json({ success: false, message: "Failed to load support chats" });
    }
  }
);

/**
 * POST /garage-admin/support-chats/ensure/:userId — create (or re-sync) one
 * member's support chat by hand, e.g. for an account that predates the
 * backfill. Returns the group id.
 */
router.post(
  "/support-chats/ensure/:userId",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    const me = await actingUser(req, res);
    if (!me) return;
    const { userId } = req.params;
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const groupId = await ensureSupportGroup(userId);
    if (!groupId) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: { groupId: String(groupId) } });
  }
);

/** GET /garage-admin/support-chats/:groupId — the chat, its member and roster. */
router.get(
  "/support-chats/:groupId",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const g = await loadSupportGroup(req.params.groupId);
      if (!g) return res.status(404).json({ success: false, message: "Support chat not found" });

      const memberIds = (g.members || []).map((m: any) => m.userId);
      const users = await User.find({ _id: { $in: memberIds } })
        .select("_id name email phone profilePicture country city state assignedSupportAgentId createdAt")
        .lean();
      const byId = new Map((users as any[]).map((u) => [String(u._id), u]));
      const member = byId.get(String(g.supportUserId));

      const agent = member?.assignedSupportAgentId
        ? await GarageAdminModel.findById(member.assignedSupportAgentId)
            .select("_id name email profilePicture")
            .lean()
        : null;

      res.json({
        success: true,
        data: {
          groupId: String(g._id),
          name: g.name,
          picture: g.picture || null,
          me: String(me),
          user: member
            ? {
                ...userCard(member),
                city: member.city || null,
                state: member.state || null,
                joinedAt: member.createdAt || null,
              }
            : null,
          uplineId: g.supportUplineId ? String(g.supportUplineId) : null,
          assignedAgent: agent
            ? { id: String((agent as any)._id), name: (agent as any).name || null, email: (agent as any).email || null }
            : null,
          members: (g.members || []).map((m: any) => {
            const id = String(m.userId);
            const u = byId.get(id);
            return {
              ...userCard(u || { _id: id }),
              role: m.role,
              isMember: id === String(g.supportUserId),
              isUpline: !!g.supportUplineId && id === String(g.supportUplineId),
              isStaff: m.role === "admin",
            };
          }),
        },
      });
    } catch (err) {
      console.error("[garage-admin/support-chats] detail error:", err);
      res.status(500).json({ success: false, message: "Failed to load support chat" });
    }
  }
);

/**
 * GET /garage-admin/support-chats/:groupId/messages?cursor=&limit=
 *
 * Same paging as GET /groups/:groupId/messages (oldest-first page, cursor =
 * the page's first createdAt), top-level messages only, plus a `users` map so
 * the console can name every sender without a lookup per bubble.
 */
router.get(
  "/support-chats/:groupId/messages",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const g = await loadSupportGroup(req.params.groupId);
      if (!g) return res.status(404).json({ success: false, message: "Support chat not found" });
      const { cursor, limit = 40 } = z
        .object({
          cursor: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(100).optional(),
        })
        .parse(req.query);

      const q: any = {
        groupId: g._id,
        $or: [{ threadId: null }, { threadId: { $exists: false } }],
      };
      if (cursor) {
        const c = new Date(cursor);
        if (!isNaN(c.getTime())) q.createdAt = { $lt: c };
      }
      const docs = await GroupMessage.find(q)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("replyTo")
        .lean();
      const items = (docs as any[]).reverse();

      // `reactions` is a Mongoose Map; even under lean() it can come back as a
      // Map, which JSON.stringify turns into {}. Normalise to a plain
      // { emoji: userId[] } object so the console can render reaction chips.
      for (const it of items) {
        it.reactions =
          it.reactions instanceof Map
            ? Object.fromEntries(it.reactions)
            : it.reactions || {};
      }

      const staffIds = new Set(
        (g.members || []).filter((m: any) => m.role === "admin").map((m: any) => String(m.userId))
      );
      const senderIds = new Set<string>();
      for (const m of items) {
        if (m.from) senderIds.add(String(m.from));
        if (m.actorId) senderIds.add(String(m.actorId));
      }
      const users = await User.find({ _id: { $in: [...senderIds].map((id) => new Types.ObjectId(id)) } })
        .select("_id name email profilePicture")
        .lean();

      // How far the customer has read — the console draws ✓ / ✓✓ off it.
      const memberRow = (g.members || []).find(
        (m: any) => String(m.userId) === String(g.supportUserId)
      );
      // Admin-only "Task added to Taskroom" notes (never stored in the thread).
      const { listSupportTaskMarks } = await import("../services/supportChatTaskroom");
      const taskMarks = await listSupportTaskMarks(String(g._id)).catch(() => []);
      res.json({
        success: true,
        data: {
          items,
          taskMarks,
          readUpTo: memberRow?.lastReadAt ? new Date(memberRow.lastReadAt).toISOString() : null,
          nextCursor: items.length === limit ? new Date(items[0].createdAt).toISOString() : null,
          users: Object.fromEntries(
            (users as any[]).map((u) => [
              String(u._id),
              {
                name: u.name || u.email || "Unknown",
                email: u.email || null,
                profilePicture: u.profilePicture || null,
                isStaff: staffIds.has(String(u._id)),
                isMember: String(u._id) === String(g.supportUserId),
              },
            ])
          ),
        },
      });
    } catch (err) {
      console.error("[garage-admin/support-chats] messages error:", err);
      res.status(500).json({ success: false, message: "Failed to load messages" });
    }
  }
);

/**
 * POST /garage-admin/support-chats/:groupId/messages — { text, replyTo? }
 *
 * Reply as the admin's own User account. If that account isn't in the chat
 * yet (their membership sync hasn't run), it's added as staff first.
 */
router.post(
  "/support-chats/:groupId/messages",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const g = await loadSupportGroup(req.params.groupId);
      if (!g) return res.status(404).json({ success: false, message: "Support chat not found" });
      const body = z
        .object({
          text: z.string().trim().max(5000).optional().default(""),
          replyTo: z.string().optional().nullable(),
          // Tagged user ids (or "all"); postGroupMessageAs keeps chat members only.
          mentions: z.array(z.string()).max(100).optional().default([]),
          attachments: z
            .array(
              z.object({
                fileName: z.string().optional(),
                fileSize: z.number().optional(),
                fileType: z.string().optional(),
                fileUrl: z.string().min(1),
                fileKey: z.string().optional(),
              }),
            )
            .optional()
            .default([]),
        })
        .safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ success: false, message: "Invalid request body" });
      }
      // Need at least text or one attachment.
      if (!body.data.text.trim() && body.data.attachments.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Message text or an attachment is required" });
      }
      const replyTo =
        body.data.replyTo && Types.ObjectId.isValid(body.data.replyTo) ? body.data.replyTo : null;

      const meMember = (g.members || []).find((m: any) => me.equals(m.userId));
      if (!meMember) {
        await Group.updateOne(
          { _id: g._id, "members.userId": { $ne: me } },
          { $push: { members: { userId: me, role: "admin", lastReadAt: new Date(0) } } }
        );
      } else if (meMember.role !== "admin" && !me.equals(g.supportUserId)) {
        await Group.updateOne(
          { _id: g._id },
          { $set: { "members.$[m].role": "admin" } },
          { arrayFilters: [{ "m.userId": me }] }
        );
      }

      const msg = await postGroupMessageAs({
        groupId: String(g._id),
        fromUserId: String(me),
        text: body.data.text,
        replyTo,
        attachments: body.data.attachments,
        mentions: body.data.mentions,
      });
      res.json({ success: true, data: { message: msg } });
    } catch (err) {
      console.error("[garage-admin/support-chats] reply error:", err);
      res.status(500).json({ success: false, message: "Failed to send reply" });
    }
  }
);

/**
 * POST /garage-admin/support-chats/:groupId/ticket
 *
 * Raise a support ticket from this chat — the "create ticket for this" action
 * on a message. Kept in the support-chats router (not the tickets router) so
 * it doesn't collide with the ticket-backend work happening there.
 *
 * Multiple tickets per chat are allowed — one chat can carry several distinct
 * issues, so every call creates a new ticket. When `sourceMessageId` is given
 * the ticket's subject/description default to that message. The ticket is filed
 * FOR the member (createdBy = the chat's subject user) and auto-assigned to the
 * member's support agent when they have one.
 */
router.post(
  "/support-chats/:groupId/ticket",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const g = await loadSupportGroup(req.params.groupId);
      if (!g) return res.status(404).json({ success: false, message: "Support chat not found" });
      if (!g.orgId) {
        return res
          .status(400)
          .json({ success: false, message: "This chat has no organization, so a ticket can't be filed." });
      }

      const parsed = z
        .object({
          subject: z.string().trim().max(200).optional(),
          description: z.string().trim().max(5000).optional(),
          sourceMessageId: z.string().optional(),
          priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        })
        .safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Invalid request body" });
      }
      let { subject, description } = parsed.data;
      const { sourceMessageId, priority } = parsed.data;

      // Multiple tickets per chat are allowed — a chat can hold several
      // distinct issues at once, so we always create a new ticket rather than
      // returning an existing open one.

      // Default subject/description off the quoted message when given.
      let srcId: Types.ObjectId | undefined;
      if (sourceMessageId && Types.ObjectId.isValid(sourceMessageId)) {
        const msg: any = await GroupMessage.findOne({ _id: sourceMessageId, groupId: g._id })
          .select("text")
          .lean();
        if (msg?.text) {
          srcId = new Types.ObjectId(sourceMessageId);
          if (!description) description = msg.text;
          if (!subject) subject = String(msg.text).slice(0, 80);
        }
      }
      if (!subject) subject = `Support request — ${g.name || "chat"}`;
      if (!description) description = subject;

      // The ticket is FOR the member. The admin Tickets page (Ticket model,
      // tickets_garage) denormalises the requester's email/name onto the row,
      // so load them from the chat's subject user.
      const member: any = g.supportUserId
        ? await User.findById(g.supportUserId).select("email name").lean()
        : null;
      if (!member?.email) {
        return res.status(400).json({
          success: false,
          message: "This chat's member has no email, so a ticket can't be filed.",
        });
      }

      const ticket = await Ticket.create({
        userId: g.supportUserId,
        userEmail: member.email,
        userName: member.name || member.email,
        orgId: g.orgId,
        title: subject,
        description,
        category: "General",
        ...(priority ? { priority } : {}),
        source: "chat",
        groupId: g._id,
        ...(srcId ? { sourceMessageId: srcId } : {}),
      });
      console.log(
        `[garage-admin/support-chats] ticket raised group=${g._id} ticket=${ticket._id} by=${req.garageAdmin?.email}`
      );
      // Fire-and-forget: AI routes it to the best-fit admin (human can change).
      void import("../services/ticketAutoAssign").then((m) =>
        m.autoAssignTicket(String(ticket._id)),
      );
      return res.json({ success: true, data: { ticket, existed: false } });
    } catch (err) {
      console.error("[garage-admin/support-chats] create ticket error:", err);
      res.status(500).json({ success: false, message: "Failed to create ticket" });
    }
  }
);

/**
 * GET /garage-admin/support-chats/:groupId/ticket-suggestion
 *
 * AI triage for the "suggest creating a ticket" banner. Returns
 * { suggest, subject?, summary?, priority?, reason?, openTicketId? }. Never
 * errors on the model's account — a failure just comes back as suggest:false.
 */
router.get(
  "/support-chats/:groupId/ticket-suggestion",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const g = await loadSupportGroup(req.params.groupId);
      if (!g) return res.status(404).json({ success: false, message: "Support chat not found" });
      const suggestion = await suggestTicketForChat(String(g._id));
      return res.json({ success: true, data: suggestion });
    } catch (err) {
      console.error("[garage-admin/support-chats] ticket-suggestion error:", err);
      // Degrade to "no suggestion" rather than surfacing a 500 in the console.
      return res.json({ success: true, data: { suggest: false } });
    }
  }
);

/**
 * POST /garage-admin/support-chats/:groupId/messages/:messageId/react { emoji }
 *
 * Toggle the admin's emoji reaction on a message, as their app user — the same
 * one-reaction-per-user toggle as the socket `group:react`, and it broadcasts
 * the same `group:message-reactions` event so the apps update live. Returns the
 * message's full reaction map.
 */
router.post(
  "/support-chats/:groupId/messages/:messageId/react",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const g = await loadSupportGroup(req.params.groupId);
      if (!g) return res.status(404).json({ success: false, message: "Support chat not found" });

      const { messageId } = req.params;
      const emoji = String((req.body || {}).emoji || "");
      if (!Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({ success: false, message: "Invalid message id" });
      }
      if (!emoji || emoji.length > 16) {
        return res.status(400).json({ success: false, message: "Invalid emoji" });
      }

      const msg: any = await GroupMessage.findOne({ _id: messageId, groupId: g._id });
      if (!msg) return res.status(404).json({ success: false, message: "Message not found" });
      if (msg.deletedAt) {
        return res.status(400).json({ success: false, message: "Message was deleted" });
      }

      const userId = String(me);
      const reactions: Map<string, string[]> = (msg.reactions as any) || new Map();
      // One reaction per user: drop the user from every emoji, then add them to
      // the chosen one — unless they were already on it (toggle off).
      let removingOwnSame = false;
      for (const [e, users] of reactions.entries()) {
        const filtered = (users || []).filter((u: string) => u !== userId);
        if (e === emoji && (users || []).includes(userId)) removingOwnSame = true;
        if (filtered.length > 0) reactions.set(e, filtered);
        else reactions.delete(e);
      }
      if (!removingOwnSame) {
        const arr = reactions.get(emoji) || [];
        arr.push(userId);
        reactions.set(emoji, arr);
      }
      msg.reactions = reactions as any;
      msg.markModified("reactions");
      await msg.save();

      const serialized: Record<string, string[]> = {};
      for (const [e, users] of reactions.entries()) serialized[e] = users;

      // Live-update the apps (the console itself polls).
      try {
        const { getSocketInstance } = await import("../services/socket");
        getSocketInstance()
          ?.to(`group:${String(g._id)}`)
          .emit("group:message-reactions", {
            messageId: String(msg._id),
            groupId: String(g._id),
            reactions: serialized,
          });
      } catch {
        /* socket optional — the reaction is already saved */
      }

      return res.json({
        success: true,
        data: { messageId: String(msg._id), reactions: serialized },
      });
    } catch (err) {
      console.error("[garage-admin/support-chats] react error:", err);
      res.status(500).json({ success: false, message: "Failed to react" });
    }
  }
);

/**
 * PATCH /garage-admin/support-chats/:groupId/messages/:messageId { text }
 *
 * Edit a message the calling admin sent — own messages only, matching the
 * app's group message edit. Stamps editedAt.
 */
router.patch(
  "/support-chats/:groupId/messages/:messageId",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const g = await loadSupportGroup(req.params.groupId);
      if (!g) return res.status(404).json({ success: false, message: "Support chat not found" });

      const { messageId } = req.params;
      if (!Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({ success: false, message: "Invalid message id" });
      }
      const parsed = z
        .object({ text: z.string().trim().min(1).max(5000) })
        .safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Message text is required" });
      }

      const updated: any = await GroupMessage.findOneAndUpdate(
        {
          _id: new Types.ObjectId(messageId),
          groupId: g._id,
          from: new Types.ObjectId(String(me)), // own messages only
        },
        { $set: { text: parsed.data.text, editedAt: new Date() } },
        { new: true },
      ).lean();
      if (!updated) {
        return res
          .status(404)
          .json({ success: false, message: "Message not found or not yours to edit" });
      }

      try {
        const { getSocketInstance } = await import("../services/socket");
        getSocketInstance()
          ?.to(`group:${String(g._id)}`)
          .emit("group:message-edited", {
            messageId: String(updated._id),
            groupId: String(g._id),
            text: updated.text,
            editedAt: updated.editedAt,
          });
      } catch {
        /* socket optional */
      }

      return res.json({
        success: true,
        data: {
          messageId: String(updated._id),
          text: updated.text,
          editedAt: updated.editedAt,
        },
      });
    } catch (err) {
      console.error("[garage-admin/support-chats] edit error:", err);
      res.status(500).json({ success: false, message: "Failed to edit message" });
    }
  }
);

/**
 * POST /garage-admin/support-chats/:groupId/members { userId }
 *
 * Add an app user to the support chat as a plain member. Idempotent — adding
 * someone already in the group is a no-op that reports back.
 */
router.post(
  "/support-chats/:groupId/members",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const g = await loadSupportGroup(req.params.groupId);
      if (!g) return res.status(404).json({ success: false, message: "Support chat not found" });

      const userId = String((req.body || {}).userId || "");
      if (!Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user id" });
      }
      const user: any = await User.findById(userId)
        .select("name email profilePicture")
        .lean();
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      // Guarded push: only adds when they aren't already a member.
      const r = await Group.updateOne(
        { _id: g._id, "members.userId": { $ne: new Types.ObjectId(userId) } },
        {
          $push: {
            members: {
              userId: new Types.ObjectId(userId),
              role: "member",
              lastReadAt: new Date(0),
            },
          },
        },
      );

      const added = r.modifiedCount > 0;
      if (added) {
        console.log(
          `[garage-admin/support-chats] member added group=${g._id} user=${userId} by=${req.garageAdmin?.email}`,
        );
      }
      return res.json({
        success: true,
        data: {
          added,
          member: {
            id: String(user._id),
            name: user.name || null,
            email: user.email || null,
            profilePicture: user.profilePicture || null,
          },
        },
      });
    } catch (err) {
      console.error("[garage-admin/support-chats] add member error:", err);
      res.status(500).json({ success: false, message: "Failed to add member" });
    }
  }
);

/**
 * GET /garage-admin/support-chats/:groupId/typing
 *
 * Who is currently typing in this chat, for the "X is typing…" indicator. The
 * console has no socket, so it polls this; it's fed by the group:typing socket
 * handler. Excludes the calling admin.
 */
router.get(
  "/support-chats/:groupId/typing",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const g = await loadSupportGroup(req.params.groupId);
      if (!g) return res.status(404).json({ success: false, message: "Support chat not found" });

      const { typingUserIds } = await import("../services/groupTypingPresence");
      const ids = typingUserIds(String(g._id)).filter(
        (uid) => uid !== String(me),
      );
      if (ids.length === 0) {
        return res.json({ success: true, data: { typing: [] } });
      }
      const users = await User.find({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
      })
        .select("_id name email")
        .lean();
      return res.json({
        success: true,
        data: {
          typing: (users as any[]).map((u) => ({
            id: String(u._id),
            name: u.name || u.email || "Someone",
          })),
        },
      });
    } catch (err) {
      console.error("[garage-admin/support-chats] typing error:", err);
      return res.json({ success: true, data: { typing: [] } });
    }
  }
);

/**
 * POST /garage-admin/support-chats/upload — multipart { file }
 *
 * Upload an attachment for a reply. Returns the shape the send endpoint's
 * `attachments[]` expects. Public S3 URL, same as the app's own uploads.
 */
router.post(
  "/support-chats/upload",
  requireGarageAdminAuth,
  upload.single("file"),
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const file = (req as any).file as
        | { buffer: Buffer; originalname: string; mimetype: string; size: number }
        | undefined;
      if (!file) {
        return res
          .status(400)
          .json({ success: false, message: "No file provided (max 50MB)" });
      }
      const fileKey = s3Service.generateFileKey(
        String(me),
        "support",
        file.originalname,
      );
      await s3Service.uploadFile(fileKey, file.buffer, file.mimetype, {
        originalName: file.originalname,
        uploadedBy: String(me),
        uploadedAt: new Date().toISOString(),
      });
      const fileUrl = s3Service.getPublicUrl(fileKey);
      return res.json({
        success: true,
        data: {
          fileUrl,
          fileKey,
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
        },
      });
    } catch (err) {
      console.error("[garage-admin/support-chats] upload error:", err);
      res.status(500).json({ success: false, message: "Upload failed" });
    }
  },
);

/** POST /garage-admin/support-chats/:groupId/read — mark read for this admin. */
router.post(
  "/support-chats/:groupId/read",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const g = await loadSupportGroup(req.params.groupId);
      if (!g) return res.status(404).json({ success: false, message: "Support chat not found" });
      const now = new Date();
      await Group.updateOne(
        { _id: g._id },
        { $set: { "members.$[m].lastReadAt": now } },
        { arrayFilters: [{ "m.userId": me }] }
      );
      // Their app's unread badge follows (same event POST /groups/:id/read sends).
      const { getSocketInstance } = await import("../services/socket");
      getSocketInstance()?.to(`user:${String(me)}`).emit("group:read", {
        groupId: String(g._id),
        lastReadAt: now,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[garage-admin/support-chats] read error:", err);
      res.status(500).json({ success: false, message: "Failed to mark as read" });
    }
  }
);

/**
 * POST /garage-admin/support-chats/:groupId/translate — { messageIds, lang }
 * Same cache as the member-facing POST /groups/:groupId/translate.
 */
router.post(
  "/support-chats/:groupId/translate",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    const me = await actingUser(req, res);
    if (!me) return;
    const g = await loadSupportGroup(req.params.groupId);
    if (!g) return res.status(404).json({ success: false, message: "Support chat not found" });
    const body = z
      .object({
        messageIds: z.array(z.string()).min(1).max(MAX_TRANSLATE_BATCH),
        lang: z.string(),
      })
      .safeParse(req.body);
    if (!body.success || !isTranslateLang(body.data.lang)) {
      return res.status(400).json({ success: false, message: "messageIds and a supported lang are required" });
    }
    try {
      const translations = await translateGroupMessages(
        String(g._id),
        body.data.messageIds,
        body.data.lang
      );
      res.json({ success: true, data: { lang: body.data.lang, translations } });
    } catch (err) {
      console.error("[garage-admin/support-chats] translate error:", err);
      res.status(502).json({ success: false, message: "Translation is unavailable right now. Please try again." });
    }
  }
);

// ── Taskroom (Rehan's group-chat features, for support chats) ──────────────
// services/supportChatTaskroom.ts. Board picking reuses
// GET /garage-admin/tickets/support-board/options.

function taskroomError(res: Response, err: any, what: string) {
  const status = Number(err?.status);
  if ([400, 404, 409, 502].includes(status)) {
    return res.status(status).json({ success: false, message: err.message });
  }
  console.error(`[garage-admin/support-chats] taskroom ${what} error:`, err?.message || err);
  return res.status(500).json({ success: false, message: `Failed to ${what}` });
}

/** GET /support-chats/:groupId/taskroom — the board this chat's tasks go to. */
router.get(
  "/support-chats/:groupId/taskroom",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { getSupportChatTaskroom } = await import("../services/supportChatTaskroom");
      res.json({ success: true, data: await getSupportChatTaskroom(req.params.groupId) });
    } catch (err) {
      taskroomError(res, err, "read the Taskroom board");
    }
  }
);

/** PUT /support-chats/:groupId/taskroom { workspaceId, roomId } — give this chat its own board. */
router.put(
  "/support-chats/:groupId/taskroom",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const body = z
        .object({ workspaceId: z.string().min(1), roomId: z.string().min(1) })
        .safeParse(req.body || {});
      if (!body.success) {
        return res.status(400).json({ success: false, message: "Pick a workspace and a board" });
      }
      const { linkSupportChat } = await import("../services/supportChatTaskroom");
      const data = await linkSupportChat(req.params.groupId, body.data.workspaceId, body.data.roomId);
      res.json({ success: true, data });
    } catch (err) {
      taskroomError(res, err, "link the board");
    }
  }
);

/** DELETE /support-chats/:groupId/taskroom — back to the shared support board. */
router.delete(
  "/support-chats/:groupId/taskroom",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { unlinkSupportChat } = await import("../services/supportChatTaskroom");
      res.json({ success: true, data: await unlinkSupportChat(req.params.groupId) });
    } catch (err) {
      taskroomError(res, err, "unlink the board");
    }
  }
);

/** GET /support-chats/:groupId/taskroom/tasks — tasks this chat filed. */
router.get(
  "/support-chats/:groupId/taskroom/tasks",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const { listSupportChatTasks } = await import("../services/supportChatTaskroom");
      res.json({ success: true, data: await listSupportChatTasks(req.params.groupId, String(me)) });
    } catch (err) {
      taskroomError(res, err, "load tasks");
    }
  }
);

/**
 * POST /support-chats/:groupId/taskroom/tasks
 *   { title?, description?, priority?, sourceMessageId? }
 * Add a task by hand. With `sourceMessageId` the title/description default to
 * that message and its files go on the card. Unassigned — assign in Taskroom.
 */
router.post(
  "/support-chats/:groupId/taskroom/tasks",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const body = z
        .object({
          title: z.string().trim().max(200).optional(),
          description: z.string().trim().max(5000).optional(),
          priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
          sourceMessageId: z.string().optional(),
        })
        .safeParse(req.body || {});
      if (!body.success) {
        return res.status(400).json({ success: false, message: "Invalid request body" });
      }
      let { title, description } = body.data;
      let attachments: Array<{ fileUrl: string; fileName?: string; fileType?: string }> = [];
      const src = body.data.sourceMessageId;
      if (src && Types.ObjectId.isValid(src)) {
        const msg: any = await GroupMessage.findOne({
          _id: src,
          groupId: new Types.ObjectId(req.params.groupId),
          deletedAt: null,
        })
          .select("text attachments")
          .lean();
        if (msg) {
          const text = String(msg.text || "").trim();
          if (!title) title = text.split("\n")[0].slice(0, 120) || "Task from support chat";
          if (!description) description = text;
          attachments = (msg.attachments || []).map((a: any) => ({
            fileUrl: a.fileUrl,
            fileName: a.fileName,
            fileType: a.fileType,
          }));
        }
      }
      if (!title) return res.status(400).json({ success: false, message: "A task needs a title" });

      const { addSupportChatTask } = await import("../services/supportChatTaskroom");
      const data = await addSupportChatTask({
        groupId: req.params.groupId,
        actorId: String(me),
        title,
        description,
        priority: body.data.priority,
        attachments,
        sourceMessageId: src && Types.ObjectId.isValid(src) ? src : undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      taskroomError(res, err, "add the task");
    }
  }
);

/** DELETE /support-chats/:groupId/taskroom/tasks/:taskId — remove a task this chat filed. */
router.delete(
  "/support-chats/:groupId/taskroom/tasks/:taskId",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      // Either kind of support task: an "Add to Taskroom" card or a mirrored
      // ticket's card (the ticket itself stays).
      const { removeSupportTask } = await import("../services/supportChatTaskroom");
      await removeSupportTask({
        groupId: req.params.groupId,
        taskId: req.params.taskId,
        actorId: String(me),
      });
      res.json({ success: true, data: { removed: 1 } });
    } catch (err) {
      taskroomError(res, err, "remove the task");
    }
  }
);

/**
 * DELETE /garage-admin/support-chats/:groupId/messages/:messageId
 *
 * Delete for everyone. Staff are the admins of a support chat, so — like a
 * WhatsApp group admin — they can remove any message, not just their own.
 * Same soft delete and live event as the app's own delete route.
 */
router.delete(
  "/support-chats/:groupId/messages/:messageId",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const g = await loadSupportGroup(req.params.groupId);
      if (!g) return res.status(404).json({ success: false, message: "Support chat not found" });
      const { messageId } = req.params;
      if (!Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({ success: false, message: "Invalid message id" });
      }
      const message: any = await GroupMessage.findOneAndUpdate(
        { _id: messageId, groupId: g._id, type: { $ne: "system" }, deletedAt: null },
        { $set: { deletedAt: new Date(), text: "", attachments: [], mentions: [], reactions: {} } },
        { new: true }
      );
      if (!message) return res.status(404).json({ success: false, message: "Message not found" });

      try {
        const { getSocketInstance } = await import("../services/socket");
        getSocketInstance()
          ?.to(`group:${String(g._id)}`)
          .emit("group:message-deleted", {
            messageId: String(message._id),
            groupId: String(g._id),
            deletedAt: message.deletedAt,
          });
      } catch {
        /* socket optional — the delete is saved */
      }
      if (message.aiTasks?.length) {
        const { removeAiTasksForDeletedMessage } = await import("../services/groupTaskRemoval");
        void removeAiTasksForDeletedMessage(String(g._id), messageId, String(me));
      }
      console.log(
        `[garage-admin/support-chats] message deleted group=${g._id} msg=${messageId} by=${req.garageAdmin?.email}`
      );
      res.json({ success: true, data: { messageId, deletedAt: message.deletedAt } });
    } catch (err) {
      console.error("[garage-admin/support-chats] delete message error:", err);
      res.status(500).json({ success: false, message: "Failed to delete message" });
    }
  }
);

/** GET /support-chats/:groupId/taskroom/tasks/:taskId/link — short share link for "Copy link". */
router.get(
  "/support-chats/:groupId/taskroom/tasks/:taskId/link",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { shortTaskLink } = await import("../services/supportChatTaskroom");
      const url = await shortTaskLink(req.params.groupId, req.params.taskId);
      res.json({ success: true, data: { url } });
    } catch (err: any) {
      if (Number(err?.status) === 404) {
        return res.status(404).json({ success: false, message: "Task not found" });
      }
      console.error("[garage-admin/support-chats] task link error:", err?.message || err);
      res.status(500).json({ success: false, message: "Failed to get the task link" });
    }
  }
);

/**
 * POST /support-chats/:groupId/taskroom/tasks/:taskId/assign { userId }
 * "Assign to…" — one of the chat's support staff (never the customer).
 */
router.post(
  "/support-chats/:groupId/taskroom/tasks/:taskId/assign",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const me = await actingUser(req, res);
      if (!me) return;
      const userId = String((req.body || {}).userId || "");
      if (!Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Pick someone to assign" });
      }
      const { assignSupportTask } = await import("../services/supportChatTaskroom");
      const mark = await assignSupportTask({
        groupId: req.params.groupId,
        taskId: req.params.taskId,
        userId,
        assignedBy: req.garageAdmin?.email || "admin",
      });
      res.json({ success: true, data: mark });
    } catch (err) {
      taskroomError(res, err, "assign the task");
    }
  }
);

export default router;
