// src/services/supportChat.ts
//
// Support chats: one group per user, created the first time their profile is
// completed (routes/profile.ts), holding
//
//   • the user                       — role "member", can't leave
//   • their upline (referredBy)      — role "member"; default sponsor if none
//   • every active garage admin      — role "admin", via their User account
//   • their assigned support agent   — the assignedSupportAgentId admin
//
// Garage admins are a separate identity (GarageAdmin) from app users, and a
// group message's `from` must be a User. Every admin has a User account on the
// same email, so that account is the one placed in the group and the one an
// admin console reply is sent as.
//
// Membership is kept in sync from the events that change it rather than being
// computed on read: a new/re-activated admin joins every support chat, a
// deactivated one leaves them (see syncAdminSupportMembership), and a changed
// upline or support agent swaps into the user's own chat.
//
// Support groups are pinned to the Garage HQ org (the schema requires an org),
// and the org-scoped group lists exclude them — they are served by
// GET /groups/support instead, regardless of which office the caller is in.

import { Types } from "mongoose";
import { Group } from "../models/group.model";
import { User } from "../models/user.model";
import { GarageAdminModel } from "../models/garageAdmin.model";

/** Garage HQ — the org every support group is filed under. */
export const SUPPORT_ORG_ID = "68f1fe05876fcc5fadb61951";

/** Upline for users with no referrer — the same default sponsor profile.ts uses. */
export const DEFAULT_SPONSOR_EMAIL = "shorupan@gmail.com";

/**
 * The Apple App Store review admin (see garageAdmin.controller DEMO_ADMIN_EMAIL).
 * It exists precisely so reviewers never see real user data, so it is kept
 * out of every support chat even though it is an active admin.
 */
const EXCLUDED_ADMIN_EMAILS = new Set(["applereview@yopmail.com"]);

export function isSupportGroup(g: any): boolean {
  return g?.kind === "support";
}

/** Staff = a support group's "admin"-role members. The creator is NOT staff. */
export function isSupportStaff(g: any, userId: string): boolean {
  const m = (g?.members || []).find((x: any) => String(x.userId) === userId);
  return m?.role === "admin";
}

function oid(id: string | Types.ObjectId): Types.ObjectId {
  return id instanceof Types.ObjectId ? id : new Types.ObjectId(String(id));
}

/** The User account behind a garage admin, matched on email. */
async function userIdForAdminEmail(email?: string | null): Promise<Types.ObjectId | null> {
  const e = String(email || "").trim().toLowerCase();
  if (!e || EXCLUDED_ADMIN_EMAILS.has(e)) return null;
  const u = await User.findOne({ email: e }).select("_id").lean();
  return (u as any)?._id ?? null;
}

/**
 * User ids of every active, non-excluded garage admin. Admins without a User
 * account on their email are skipped (they can't be a group member).
 */
export async function activeStaffUserIds(): Promise<Types.ObjectId[]> {
  const admins = (await GarageAdminModel.find({ isActive: true })
    .select("email")
    .lean()) as { email: string }[];
  const emails = admins
    .map((a) => String(a.email || "").toLowerCase())
    .filter((e) => e && !EXCLUDED_ADMIN_EMAILS.has(e));
  if (!emails.length) return [];
  const users = (await User.find({ email: { $in: emails } })
    .select("_id")
    .lean()) as { _id: Types.ObjectId }[];
  return users.map((u) => u._id);
}

async function defaultSponsorId(): Promise<Types.ObjectId | null> {
  const u = await User.findOne({ email: DEFAULT_SPONSOR_EMAIL }).select("_id").lean();
  return (u as any)?._id ?? null;
}

async function agentUserIdFor(user: any): Promise<Types.ObjectId | null> {
  if (!user?.assignedSupportAgentId) return null;
  const admin = await GarageAdminModel.findById(user.assignedSupportAgentId)
    .select("email isActive")
    .lean();
  if (!admin || (admin as any).isActive === false) return null;
  return userIdForAdminEmail((admin as any).email);
}

/**
 * "Garage | NVC | <member> | <city>" — the naming the Garage team already uses
 * for its WhatsApp member groups, so a support chat reads the same wherever
 * staff meet it. The city segment is left off when the profile has none.
 */
export function supportGroupName(user: any): string {
  const who =
    String(user?.name || "").trim() ||
    String(user?.email || "").split("@")[0].trim() ||
    "Member";
  const city = String(user?.city || "").trim();
  return ["Garage", "NVC", who, ...(city ? [city] : [])].join(" | ").slice(0, 80);
}

/**
 * Create the user's support chat, or bring an existing one's membership and
 * name up to date (a profile save may have changed the name or city).
 * Idempotent — safe on every profile save and from the backfill.
 *
 * Never throws: callers are fire-and-forget paths (a profile save) whose own
 * work is already committed. Returns the group id, or null if nothing could
 * be done (unknown user, or the create failed).
 */
export async function ensureSupportGroup(
  userId: string | Types.ObjectId
): Promise<Types.ObjectId | null> {
  try {
    const user: any = await User.findById(oid(userId))
      .select("_id name email city referredBy assignedSupportAgentId")
      .lean();
    if (!user) return null;
    const me = user._id as Types.ObjectId;

    const [staff, sponsor, agent] = await Promise.all([
      activeStaffUserIds(),
      user.referredBy ? Promise.resolve(null) : defaultSponsorId(),
      agentUserIdFor(user),
    ]);
    let upline: Types.ObjectId | null = user.referredBy ? oid(user.referredBy) : sponsor;
    if (upline && upline.equals(me)) upline = null;

    // role per member; staff win over "member" for someone who is both.
    const roles = new Map<string, "admin" | "member">();
    roles.set(String(me), "member");
    if (upline) roles.set(String(upline), "member");
    for (const s of [...staff, ...(agent ? [agent] : [])]) {
      // The user never becomes staff of their own chat, even if they're an admin.
      if (!s.equals(me)) roles.set(String(s), "admin");
    }

    const existing: any = await Group.findOne({ kind: "support", supportUserId: me })
      .select("_id members")
      .lean();

    if (existing) {
      const present = new Set((existing.members || []).map((m: any) => String(m.userId)));
      const toAdd = [...roles.entries()]
        .filter(([id]) => !present.has(id))
        .map(([id, role]) => ({ userId: oid(id), role, lastReadAt: new Date(0) }));
      await Group.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: supportGroupName(user),
            ...(upline ? { supportUplineId: upline } : {}),
            ...(agent ? { supportAgentUserId: agent } : {}),
          },
          ...(toAdd.length ? { $push: { members: { $each: toAdd } } } : {}),
        }
      );
      return existing._id;
    }

    const now = new Date();
    try {
      const doc = await Group.create({
        name: supportGroupName(user),
        description: "Your direct line to the Garage team.",
        createdBy: me,
        orgId: new Types.ObjectId(SUPPORT_ORG_ID),
        members: [...roles.entries()].map(([id, role]) => ({
          userId: oid(id),
          role,
          lastReadAt: new Date(0),
        })),
        kind: "support",
        supportUserId: me,
        ...(upline ? { supportUplineId: upline } : {}),
        ...(agent ? { supportAgentUserId: agent } : {}),
        supportActivityAt: now,
      });
      return doc._id as Types.ObjectId;
    } catch (err: any) {
      // Two profile saves racing: the unique index let one through.
      if (err?.code === 11000) {
        const g: any = await Group.findOne({ kind: "support", supportUserId: me })
          .select("_id")
          .lean();
        return g?._id ?? null;
      }
      throw err;
    }
  } catch (err) {
    console.error("[supportChat] ensureSupportGroup failed for", String(userId), err);
    return null;
  }
}

/**
 * Put a staff user into every support chat (as admin), or promote them where
 * they're already a plain member (e.g. they were someone's upline).
 */
export async function addStaffToAllSupportGroups(staffUserId: Types.ObjectId): Promise<void> {
  await Group.updateMany(
    { kind: "support", "members.userId": { $ne: staffUserId }, supportUserId: { $ne: staffUserId } },
    { $push: { members: { userId: staffUserId, role: "admin", lastReadAt: new Date(0) } } }
  );
  await Group.updateMany(
    {
      kind: "support",
      supportUserId: { $ne: staffUserId },
      members: { $elemMatch: { userId: staffUserId, role: { $ne: "admin" } } },
    },
    { $set: { "members.$[m].role": "admin" } },
    { arrayFilters: [{ "m.userId": staffUserId }] }
  );
}

/**
 * Take a former staff user out of the support chats — except where they have
 * their own reason to be there: it's their chat, they're the upline (they stay
 * as a plain member), or they're still the assigned agent.
 */
export async function removeStaffFromSupportGroups(staffUserId: Types.ObjectId): Promise<void> {
  await Group.updateMany(
    {
      kind: "support",
      supportUserId: { $ne: staffUserId },
      supportUplineId: { $ne: staffUserId },
      supportAgentUserId: { $ne: staffUserId },
    },
    { $pull: { members: { userId: staffUserId } } }
  );
  await Group.updateMany(
    { kind: "support", supportUplineId: staffUserId, supportAgentUserId: { $ne: staffUserId } },
    { $set: { "members.$[m].role": "member" } },
    { arrayFilters: [{ "m.userId": staffUserId }] }
  );
}

/**
 * Bring one admin's support-chat membership in line with their status. Call
 * after an admin is created/invited, activated or deactivated. Never throws.
 */
export async function syncAdminSupportMembership(admin: {
  email?: string | null;
  isActive?: boolean | null;
}): Promise<void> {
  try {
    const uid = await userIdForAdminEmail(admin.email);
    if (!uid) return;
    if (admin.isActive === false) await removeStaffFromSupportGroups(uid);
    else await addStaffToAllSupportGroups(uid);
  } catch (err) {
    console.error("[supportChat] admin membership sync failed for", admin.email, err);
  }
}

/**
 * Swap the upline in a user's support chat after their referrer changed. The
 * old upline is removed unless they're staff (they stay, as staff). Never throws.
 */
export async function syncSupportUpline(userId: string | Types.ObjectId): Promise<void> {
  try {
    const me = oid(userId);
    const g: any = await Group.findOne({ kind: "support", supportUserId: me })
      .select("_id members supportUplineId supportAgentUserId")
      .lean();
    if (!g) return;
    const user: any = await User.findById(me).select("referredBy").lean();
    const next = user?.referredBy ? oid(user.referredBy) : await defaultSponsorId();
    const prev: Types.ObjectId | null = g.supportUplineId ?? null;
    if (!next || (prev && prev.equals(next)) || next.equals(me)) return;

    if (prev && !isSupportStaff(g, String(prev)) && !(g.supportAgentUserId && prev.equals(g.supportAgentUserId))) {
      await Group.updateOne({ _id: g._id }, { $pull: { members: { userId: prev } } });
    }
    const present = (g.members || []).some((m: any) => next.equals(m.userId));
    await Group.updateOne(
      { _id: g._id },
      {
        $set: { supportUplineId: next },
        ...(present
          ? {}
          : { $push: { members: { userId: next, role: "member", lastReadAt: new Date(0) } } }),
      }
    );
  } catch (err) {
    console.error("[supportChat] upline sync failed for", String(userId), err);
  }
}

/**
 * Reflect a changed assignedSupportAgentId in the user's support chat: the new
 * agent joins as staff and is recorded; an unassigned agent stays only if they
 * are still active staff anyway. Never throws.
 */
export async function syncSupportAgent(userId: string | Types.ObjectId): Promise<void> {
  try {
    const me = oid(userId);
    const g: any = await Group.findOne({ kind: "support", supportUserId: me })
      .select("_id members supportAgentUserId supportUplineId")
      .lean();
    if (!g) return;
    const user: any = await User.findById(me).select("assignedSupportAgentId").lean();
    const next = await agentUserIdFor(user);
    const prev: Types.ObjectId | null = g.supportAgentUserId ?? null;

    if (prev && (!next || !prev.equals(next))) {
      const staff = await activeStaffUserIds();
      const stillStaff = staff.some((s) => s.equals(prev));
      const isUpline = g.supportUplineId && prev.equals(g.supportUplineId);
      if (!stillStaff && !isUpline) {
        await Group.updateOne({ _id: g._id }, { $pull: { members: { userId: prev } } });
      }
    }

    if (!next) {
      await Group.updateOne({ _id: g._id }, { $unset: { supportAgentUserId: 1 } });
      return;
    }
    const present = (g.members || []).some((m: any) => next.equals(m.userId));
    await Group.updateOne(
      { _id: g._id },
      {
        $set: { supportAgentUserId: next },
        ...(present
          ? {}
          : { $push: { members: { userId: next, role: "admin", lastReadAt: new Date(0) } } }),
      }
    );
    if (present) {
      await Group.updateOne(
        { _id: g._id },
        { $set: { "members.$[m].role": "admin" } },
        { arrayFilters: [{ "m.userId": next }] }
      );
    }
  } catch (err) {
    console.error("[supportChat] agent sync failed for", String(userId), err);
  }
}

/**
 * Record a new top-level message on a support group: the denormalised last
 * message (list preview + "unanswered" flag) and the list sort key. No-op for
 * any other group. Never throws.
 */
export async function recordSupportMessage(
  group: any,
  msg: { from?: any; text?: string; attachments?: any[]; createdAt?: Date }
): Promise<void> {
  if (!isSupportGroup(group)) return;
  try {
    const from = msg.from ? String(msg.from) : "";
    const at = msg.createdAt || new Date();
    await Group.updateOne(
      { _id: group._id },
      {
        $set: {
          supportLastMessage: {
            text: (msg.text || "").slice(0, 500),
            from: from ? new Types.ObjectId(from) : undefined,
            at,
            hasAttachments: !!(msg.attachments && msg.attachments.length),
            fromStaff: from ? isSupportStaff(group, from) : false,
          },
          supportActivityAt: at,
        },
      }
    );
  } catch (err) {
    console.error("[supportChat] recordSupportMessage failed", err);
  }
}

/**
 * Post a top-level text message into a group as `fromUserId`, server-side —
 * how an admin-console reply reaches the chat. Mirrors the socket
 * `group:message` path (realtime/socket.ts) for the parts a reply needs:
 * persist, deliver on the same `group:message` event to every member's user
 * room and the group room, a UserNotification per recipient, the push, and
 * the support-list bookkeeping. Mentions and threads are not supported here.
 */
export async function postGroupMessageAs(opts: {
  groupId: string;
  fromUserId: string;
  text: string;
  replyTo?: string | null;
  attachments?: Array<{
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    fileUrl: string;
    fileKey?: string;
  }>;
  /** Tagged user ids; "all" tags every member. Kept to people in the chat. */
  mentions?: string[];
}): Promise<any> {
  // Lazy: these pull in the socket/push stack, which the profile and admin
  // routes that import this module for membership sync don't need.
  const { GroupMessage } = await import("../models/groupMessage.model");
  const { UserNotification } = await import("../models/userNotification.model");
  const { getSocketInstance } = await import("./socket");
  const { sendGroupPushNotification } = await import("./pushNotification");

  const group: any = await Group.findById(opts.groupId).lean();
  if (!group) throw new Error("Group not found");
  const from = opts.fromUserId;
  const text = opts.text.trim();

  const attachments = (opts.attachments || [])
    .filter((a) => a && a.fileUrl)
    .map((a) => ({
      fileName: a.fileName || a.fileUrl.split("/").pop() || "file",
      fileSize: a.fileSize,
      fileType: a.fileType,
      fileUrl: a.fileUrl,
      fileKey: a.fileKey || a.fileUrl.split("/").pop() || "",
      uploadedAt: new Date(),
    }));

  // @mentions — same rules as the app's socket send path: "all" tags every
  // member, anything else must be someone actually in the chat.
  const memberIdSet = new Set<string>(
    (group.members || []).map((m: any) => String(m.userId))
  );
  const wanted = new Set<string>((opts.mentions || []).map(String));
  const mentionIds: string[] = wanted.has("all")
    ? [...memberIdSet].filter((id) => id !== from)
    : [...wanted].filter((id) => Types.ObjectId.isValid(id) && memberIdSet.has(id));

  const msg: any = await GroupMessage.create({
    groupId: new Types.ObjectId(opts.groupId),
    from: new Types.ObjectId(from),
    text,
    attachments,
    mentions: mentionIds.map((id) => new Types.ObjectId(id)),
    replyTo: opts.replyTo ? new Types.ObjectId(opts.replyTo) : null,
    threadId: null,
  } as any);

  const populatedReplyTo = msg.replyTo
    ? await GroupMessage.findById(msg.replyTo).lean()
    : null;

  const out = {
    _id: msg.id,
    groupId: opts.groupId,
    from,
    text: msg.text || "",
    attachments: msg.attachments,
    mentions: mentionIds,
    replyTo: populatedReplyTo || msg.replyTo,
    threadId: null,
    replyCount: 0,
    threadResolved: false,
    editedAt: msg.editedAt,
    createdAt: msg.createdAt,
    readAt: msg.readAt,
  };

  const sender: any = await User.findById(from)
    .select("name email profilePicture")
    .lean();
  const io = getSocketInstance();
  const memberIds: string[] = (group.members || []).map((m: any) => String(m.userId));

  for (const uid of memberIds) {
    if (uid === from) continue;
    UserNotification.create({
      userId: new Types.ObjectId(uid),
      orgId: group.orgId,
      type: "group_message",
      groupId: new Types.ObjectId(opts.groupId),
      groupName: group.name,
      groupFrom: new Types.ObjectId(from),
      groupFromName: sender?.name,
      groupFromEmail: sender?.email,
      groupFromPicture: sender?.profilePicture,
      groupText: text,
      groupMessageId: msg._id,
      read: false,
      cleared: false,
    }).catch((err: unknown) =>
      console.error("[supportChat] UserNotification failed for", uid, err)
    );
    io?.to(`user:${uid}`).emit("group:message", out);
  }
  // The sender's own devices (the admin's phone, say) see it too.
  io?.to(`user:${from}`).emit("group:message", out);
  io?.to(`group:${opts.groupId}`).emit("group:message", out);

  // The author just wrote here, so it's read up to now for them.
  await Group.updateOne(
    { _id: group._id },
    { $set: { "members.$[m].lastReadAt": msg.createdAt } },
    { arrayFilters: [{ "m.userId": new Types.ObjectId(from) }] }
  );
  await recordSupportMessage(group, msg);

  // Tagged people get the app's "X mentioned you" alert: a high-priority
  // notification row, a live notification:new, and a mention push.
  const mentionRecipients = mentionIds.filter((id) => id !== from);
  if (mentionRecipients.length) {
    const { Notification } = await import("../models/notification.model");
    const { sendMentionPushNotification } = await import("./pushNotification");
    const senderName = sender?.name || sender?.email || "Garage Support";
    const preview = text ? text.slice(0, 100) + (text.length > 100 ? "..." : "") : "Shared a file";
    const data = {
      groupId: opts.groupId,
      groupName: group.name,
      messageId: msg._id.toString(),
      senderId: from,
      senderName,
    };
    Notification.insertMany(
      mentionRecipients.map((uid) => ({
        userId: new Types.ObjectId(uid),
        orgId: group.orgId,
        type: "group_mention",
        priority: "high",
        title: `${senderName} mentioned you`,
        message: preview,
        data,
        isRead: false,
      })),
      { ordered: false }
    ).catch((err: unknown) => console.error("[supportChat] mention notifications failed", err));
    for (const uid of mentionRecipients) {
      io?.to(`user:${uid}`).emit("notification:new", {
        type: "group_mention",
        priority: "high",
        title: `${senderName} mentioned you`,
        message: preview,
        data: { groupId: opts.groupId, groupName: group.name, messageId: msg._id.toString() },
      });
      sendMentionPushNotification(
        uid,
        from,
        senderName,
        opts.groupId,
        group.name,
        text,
        msg._id.toString(),
        sender?.profilePicture || null,
        group.picture || null
      ).catch((err: unknown) => console.error("[supportChat] mention push failed", err));
    }
  }

  sendGroupPushNotification(
    memberIds,
    from,
    sender?.name || sender?.email || "Garage Support",
    opts.groupId,
    group.name,
    text,
    msg._id.toString(),
    sender?.profilePicture || null,
    group.picture || null
  ).catch((err: unknown) => console.error("[supportChat] push failed", err));

  return out;
}
