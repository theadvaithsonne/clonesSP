import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth";
import { Group } from "../models/group.model";
import { GroupMessage } from "../models/groupMessage.model";
import { User } from "../models/user.model";
import { Types } from "mongoose";
import { getSocketInstance } from "../services/socket";
import { writeGroupSystemMessage } from "../services/groupSystemMessage";
import { ChatClear, clearedAtFor } from "../models/chatClear.model";
import { isSupportGroup, isSupportStaff } from "../services/supportChat";
import {
  isTranslateLang,
  MAX_TRANSLATE_BATCH,
  translateGroupMessages,
} from "../services/messageTranslation";
import {
  GroupTaskroomError,
  linkGroupTaskroom,
  requestGroupTaskroomSync,
  serializeGroupTaskroom,
  setGroupTaskroomEnabled,
  unlinkGroupTaskroom,
} from "../services/groupTaskroom";
import {
  removeAiTasksForDeletedMessage,
  removeAiTasksFromMessage,
} from "../services/groupTaskRemoval";
import {
  assignGroupTask,
  createManualTask,
  listGroupTasks,
  removeGroupTaskById,
} from "../services/groupTaskManual";

const router = Router();

/**
 * Hard ceiling on group size, matching MAX_GROUP_MEMBERS in the mobile client
 * ("3 of 256 selected"). Enforced on both the create and add-members paths.
 *
 * Deliberately checked against the resulting total, not the number being added,
 * so a single request cannot straddle the limit. Groups that are ALREADY over
 * this — created before the cap existed — are not broken retroactively: the
 * check only rejects additions that would push the count further past it.
 */
const MAX_GROUP_MEMBERS = 256;

/**
 * Pipeline stages that attach the caller's "clear chat" watermark to each
 * group as `clearedAt`.
 *
 * Every list endpoint below has to honour it: clearing a chat that still shows
 * its old preview and its old unread badge is the bug this exists to prevent.
 * Groups the user never cleared get the epoch, so downstream comparisons need
 * no null handling.
 */
function clearedAtStages(meObj: Types.ObjectId): any[] {
  return [
    {
      $lookup: {
        from: "chatclears",
        let: { gid: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", meObj] },
                  {
                    $eq: [
                      "$convKey",
                      { $concat: ["group:", { $toString: "$$gid" }] },
                    ],
                  },
                ],
              },
            },
          },
          { $project: { clearedAt: 1 } },
        ],
        as: "clr",
      },
    },
    {
      $addFields: {
        clearedAt: { $ifNull: [{ $first: "$clr.clearedAt" }, new Date(0)] },
      },
    },
  ];
}

/**
 * Shared check: caller must be an admin (or the creator) of the given group.
 *
 * Support chats are the exception: their creator is the member the chat is
 * FOR, and only the support team (admin-role members) manages them — so the
 * creator shortcut doesn't apply there.
 */
function isGroupAdmin(group: any, userId: string): boolean {
  if (!group) return false;
  if (isSupportGroup(group)) return isSupportStaff(group, userId);
  if (group.createdBy?.toString() === userId) return true;
  const m = group.members.find((x: any) => x.userId.toString() === userId);
  return m?.role === "admin";
}

/** Generate a URL-safe random invite code. */
function generateInviteCode(): string {
  return crypto.randomBytes(8).toString("base64url"); // ~11 chars
}

/**
 * Resolve the org a group request is scoped to.
 *
 * Groups belong to exactly one org, so every list query must be scoped.
 * Callers should pass ?orgId=, but older clients (and the mobile app)
 * don't — falling back to the token's org keeps them working instead of
 * silently handing back every org's groups.
 *
 * Also absorbs the `?orgId=null` / `?orgId=undefined` strings that come
 * from clients interpolating an empty localStorage value into the URL;
 * those used to reach `new Types.ObjectId("null")` and throw a 500.
 *
 * Returns null when no org can be resolved — callers must treat that as
 * "no groups", never as "no filter".
 */
function resolveOrgId(req: any): Types.ObjectId | null {
  const raw = (req.query?.orgId as string | undefined) || req.user?.orgId;
  if (!raw || raw === "null" || raw === "undefined") return null;
  if (!Types.ObjectId.isValid(raw)) return null;
  return new Types.ObjectId(raw);
}

/** List groups I'm in (with unread counts) */
router.get("/", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const meObj = new Types.ObjectId(me);
  // Groups are org-scoped. An unresolvable org means "no groups" — never
  // "every group I'm a member of", which is how groups used to bleed
  // across orgs when a caller omitted ?orgId=.
  const orgObj = resolveOrgId(req);
  if (!orgObj) return res.json({ groups: [] });

  // Support chats live in their own list (GET /groups/support) — they must
  // not appear among the office's groups, and a support-team member sits in
  // every one of them.
  const matchStage: any = {
    "members.userId": meObj,
    orgId: orgObj,
    kind: { $ne: "support" },
  };

  const rows = await Group.aggregate([
    { $match: matchStage },
    ...clearedAtStages(meObj),
    {
      $addFields: {
        meMember: {
          $first: {
            $filter: {
              input: "$members",
              as: "m",
              cond: { $eq: ["$$m.userId", meObj] },
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "groupmessages",
        let: {
          gid: "$_id",
          last: "$meMember.lastReadAt",
          userId: meObj,
          clr: "$clearedAt",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$groupId", "$$gid"] },
                  { $gt: ["$createdAt", "$$last"] },
                  // Anything at or before the clear watermark is gone for this
                  // user, so it must not survive as an unread count either.
                  { $gt: ["$createdAt", "$$clr"] },
                  { $ne: ["$from", "$$userId"] },
                  // System pills ("Priya added Devon") are not unread mail.
                  // Without this, adding a member would badge the group for
                  // every other member.
                  { $ne: ["$type", "system"] },
                ],
              },
            },
          },
          // Count the unread, and in the same pass note whether any of them
          // @-mentions the caller. Doing it here rather than in a second
          // lookup keeps this to one scan of the same matched set.
          {
            $group: {
              _id: null,
              cnt: { $sum: 1 },
              mentioned: {
                $max: {
                  $cond: [
                    { $in: ["$$userId", { $ifNull: ["$mentions", []] }] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        as: "unr",
      },
    },
    {
      $project: {
        name: 1,
        createdBy: 1,
        members: 1,
        picture: 1,
        unread: { $ifNull: [{ $first: "$unr.cnt" }, 0] },
        updatedAt: 1,
      },
    },
    { $sort: { updatedAt: -1 } },
  ]);

  res.json({
    groups: rows.map((r) => ({
      id: r._id,
      name: r.name,
      picture: r.picture,
      unread: r.unread,
      members: r.members,
    })),
  });
});

/** Create a new group with name + members (includes me) */
router.post("/", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  // A group with no org is invisible to every org-scoped list query, so
  // refuse to create one rather than silently orphaning it.
  const orgObj = resolveOrgId(req);
  if (!orgObj) {
    return res.status(400).json({ error: "orgId is required to create a group" });
  }
  const body = z
    .object({
      name: z.string().min(2).max(80),
      description: z.string().max(500).optional(),
      memberIds: z.array(z.string()).default([]),
    })
    .parse(req.body);

  // Split real user IDs from virtual agent IDs (openclaw_agent_*)
  const realMemberIds = body.memberIds.filter(
    (id) => !id.startsWith("openclaw_agent_")
  );
  const agentMemberIds = Array.from(
    new Set(body.memberIds.filter((id) => id.startsWith("openclaw_agent_")))
  );
  const uniq = Array.from(new Set([me, ...realMemberIds])).map(
    (id) => new Types.ObjectId(id)
  );

  if (uniq.length > MAX_GROUP_MEMBERS) {
    return res
      .status(400)
      .json({ error: `Groups can have at most ${MAX_GROUP_MEMBERS} members` });
  }

  const members = uniq.map((uid) => ({
    userId: uid,
    role: uid.equals(new Types.ObjectId(me)) ? "admin" : "member",
    lastReadAt: new Date(0),
  }));

  const groupData: any = {
    name: body.name.trim(),
    createdBy: me,
    members,
    agentMembers: agentMemberIds,
    orgId: orgObj,
  };
  if (body.description) {
    groupData.description = body.description.trim();
  }

  const doc = await Group.create(groupData);

  // Opening pill in the thread. Fire-and-forget — the group exists either way.
  void writeGroupSystemMessage({
    groupId: doc._id,
    event: "group_created",
    actorId: me,
  });

  res.json({ ok: true, group: { id: doc._id, name: doc.name } });
});

/** Unread per group for me */
router.get("/unread/all", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const meObj = new Types.ObjectId(me);
  // Groups are org-scoped. An unresolvable org means "no groups" — never
  // "every group I'm a member of", which is how groups used to bleed
  // across orgs when a caller omitted ?orgId=.
  const orgObj = resolveOrgId(req);
  if (!orgObj) return res.json({ groups: [] });

  // Support chats live in their own list (GET /groups/support) — they must
  // not appear among the office's groups, and a support-team member sits in
  // every one of them.
  const matchStage: any = {
    "members.userId": meObj,
    orgId: orgObj,
    kind: { $ne: "support" },
  };

  const rows = await Group.aggregate([
    { $match: matchStage },
    ...clearedAtStages(meObj),
    {
      $addFields: {
        meMember: {
          $first: {
            $filter: {
              input: "$members",
              as: "m",
              cond: { $eq: ["$$m.userId", meObj] },
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "groupmessages",
        let: {
          gid: "$_id",
          last: "$meMember.lastReadAt",
          userId: meObj,
          clr: "$clearedAt",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$groupId", "$$gid"] },
                  { $gt: ["$createdAt", "$$last"] },
                  // Anything at or before the clear watermark is gone for this
                  // user, so it must not survive as an unread count either.
                  { $gt: ["$createdAt", "$$clr"] },
                  { $ne: ["$from", "$$userId"] },
                  // System pills ("Priya added Devon") are not unread mail.
                  // Without this, adding a member would badge the group for
                  // every other member.
                  { $ne: ["$type", "system"] },
                ],
              },
            },
          },
          // Count the unread, and in the same pass note whether any of them
          // @-mentions the caller. Doing it here rather than in a second
          // lookup keeps this to one scan of the same matched set.
          {
            $group: {
              _id: null,
              cnt: { $sum: 1 },
              mentioned: {
                $max: {
                  $cond: [
                    { $in: ["$$userId", { $ifNull: ["$mentions", []] }] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        as: "unr",
      },
    },
    {
      $project: {
        _id: 1,
        count: { $ifNull: [{ $first: "$unr.cnt" }, 0] },
        // Drives the "@" badge on a group row for mentions that arrived while
        // the app was closed — previously only live socket mentions showed one.
        mentioned: {
          $eq: [{ $ifNull: [{ $first: "$unr.mentioned" }, 0] }, 1],
        },
      },
    },
  ]);

  res.json({
    groups: rows.map((r) => ({
      groupId: r._id.toString(),
      count: r.count,
      mentioned: !!r.mentioned,
    })),
  });
});

/** Get last message timestamps for all groups */
router.get("/last-messages", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const meObj = new Types.ObjectId(me);
  // Groups are org-scoped. An unresolvable org means "no groups" — never
  // "every group I'm a member of", which is how groups used to bleed
  // across orgs when a caller omitted ?orgId=.
  const orgObj = resolveOrgId(req);
  if (!orgObj) return res.json({ groups: [] });

  // Support chats live in their own list (GET /groups/support) — they must
  // not appear among the office's groups, and a support-team member sits in
  // every one of them.
  const matchStage: any = {
    "members.userId": meObj,
    orgId: orgObj,
    kind: { $ne: "support" },
  };

  const rows = await Group.aggregate([
    { $match: matchStage },
    ...clearedAtStages(meObj),
    {
      $lookup: {
        from: "groupmessages",
        let: { gid: "$_id", clr: "$clearedAt" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$groupId", "$$gid"] },
                  // Keep system pills out of the chat-list preview: a group
                  // whose last event was "X changed the icon" should still
                  // show the last real message.
                  { $ne: ["$type", "system"] },
                  // A cleared group must not keep sorting by the message the
                  // user just cleared away.
                  { $gt: ["$createdAt", "$$clr"] },
                ],
              },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          { $project: { createdAt: 1, text: 1, from: 1, attachments: 1 } },
        ],
        as: "lastMsg",
      },
    },
    {
      $project: {
        _id: 1,
        latestAt: { $ifNull: [{ $first: "$lastMsg.createdAt" }, null] },
        text: { $ifNull: [{ $first: "$lastMsg.text" }, null] },
        from: { $ifNull: [{ $first: "$lastMsg.from" }, null] },
        attachments: { $ifNull: [{ $first: "$lastMsg.attachments" }, null] },
      },
    },
    { $match: { latestAt: { $ne: null } } },
    { $sort: { latestAt: -1 } },
  ]);

  res.json({
    groups: rows.map((r) => ({
      groupId: r._id.toString(),
      timestamp: new Date(r.latestAt).getTime(),
      text: r.text || "",
      from: r.from?.toString(),
      hasAttachments: r.attachments && r.attachments.length > 0,
    })),
  });
});

/** `{ userId, name, email, profilePicture }` for every member of the given groups. */
async function supportMemberProfiles(groups: any[]): Promise<Map<string, any>> {
  const ids = new Set<string>();
  for (const g of groups) for (const m of g.members || []) ids.add(String(m.userId));
  if (!ids.size) return new Map();
  const users = await User.find({ _id: { $in: [...ids].map((id) => new Types.ObjectId(id)) } })
    .select("_id name email profilePicture")
    .lean();
  return new Map(
    (users as any[]).map((u) => [
      String(u._id),
      {
        userId: String(u._id),
        name: u.name || u.email?.split("@")[0] || "Member",
        email: u.email || null,
        profilePicture: u.profilePicture || null,
      },
    ])
  );
}

/**
 * Support chats I'm in — GET /groups/support?limit=&before=&q=
 *
 * NOT org-scoped: a user's support chat is filed under Garage HQ, and must
 * show up whichever office they're signed into. For an ordinary user this is
 * their one chat; for the support team it's every member's, so it pages —
 * newest activity first, `before` = the previous page's `nextBefore`.
 *
 * Each row carries the same `unread` the office group list does, plus
 * `lastMessage` (hidden when it predates the caller's "clear chat").
 *
 * The first page (no `before`) also carries `mine`: the caller's OWN support
 * chat (the one whose `supportUserId` is them), or null when they have none or
 * it doesn't match `q`. Clients pin it above the rest. It is fetched on its
 * own because for the support team it can sit pages deep when it's been quiet.
 * It is NOT removed from `groups` — additive, so older clients that don't read
 * `mine` still find their chat where they always did; clients that pin it
 * de-duplicate.
 */
router.get("/support", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const meObj = new Types.ObjectId(me);
  const { limit = 30, before, q } = z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      before: z.string().optional(),
      q: z.string().trim().max(80).optional(),
    })
    .parse(req.query);

  const match: any = { kind: "support", "members.userId": meObj };
  if (before) {
    const b = new Date(before);
    if (!isNaN(b.getTime())) match.supportActivityAt = { $lt: b };
  }
  if (q) {
    match.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }

  const [rows, mineRows] = await Promise.all([
    supportRows(match, limit, meObj),
    before ? Promise.resolve(null) : supportRows({ ...match, supportUserId: meObj }, 1, meObj),
  ]);

  // Names + avatars for every member: a support chat's upline and staff are
  // usually outside the caller's office roster, which is where clients
  // otherwise resolve sender names from.
  const profiles = await supportMemberProfiles([...rows, ...(mineRows || [])]);
  const toRow = (r: any) => {
    const lm = r.supportLastMessage;
    const visible = lm?.at && new Date(lm.at) > new Date(r.clearedAt);
    return {
      id: r._id,
      name: r.name,
      description: r.description,
      picture: r.picture,
      kind: "support" as const,
      supportUserId: r.supportUserId,
      supportUplineId: r.supportUplineId || null,
      members: r.members,
      memberProfiles: (r.members || [])
        .map((m: any) => profiles.get(String(m.userId)))
        .filter(Boolean),
      unread: r.unr?.[0]?.cnt ?? 0,
      lastMessage: visible
        ? {
            text: lm.text || "",
            from: lm.from ? String(lm.from) : null,
            timestamp: new Date(lm.at).getTime(),
            hasAttachments: !!lm.hasAttachments,
          }
        : null,
      activityAt: r.supportActivityAt,
    };
  };

  const last = rows[rows.length - 1];
  res.json({
    groups: rows.map(toRow),
    nextBefore:
      rows.length === limit && last?.supportActivityAt
        ? new Date(last.supportActivityAt).toISOString()
        : null,
    ...(mineRows ? { mine: mineRows[0] ? toRow(mineRows[0]) : null } : {}),
  });
});

/**
 * One page of support chats matching `match`, newest activity first, each with
 * the caller's `clearedAt` and unread count (`unr`) attached.
 */
function supportRows(match: any, limit: number, meObj: Types.ObjectId): Promise<any[]> {
  return Group.aggregate([
    { $match: match },
    { $sort: { supportActivityAt: -1 } },
    { $limit: limit },
    ...clearedAtStages(meObj),
    {
      $addFields: {
        meMember: {
          $first: {
            $filter: {
              input: "$members",
              as: "m",
              cond: { $eq: ["$$m.userId", meObj] },
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "groupmessages",
        let: {
          gid: "$_id",
          last: "$meMember.lastReadAt",
          userId: meObj,
          clr: "$clearedAt",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$groupId", "$$gid"] },
                  { $gt: ["$createdAt", "$$last"] },
                  { $gt: ["$createdAt", "$$clr"] },
                  { $ne: ["$from", "$$userId"] },
                  { $ne: ["$type", "system"] },
                ],
              },
            },
          },
          { $count: "cnt" },
        ],
        as: "unr",
      },
    },
  ]);
}

/**
 * GET /groups/support/unread — how many of my support chats have something
 * unread, for the Support tab's badge.
 *
 * Counts CHATS, not messages, and reads only the group documents (the last
 * message is denormalised on each) — a support-team member is in every
 * support chat on the platform, so a per-group message lookup here would
 * scale with the user base.
 */
router.get("/support/unread", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const meObj = new Types.ObjectId(me);

  const rows = await Group.aggregate([
    {
      $match: {
        kind: "support",
        "members.userId": meObj,
        "supportLastMessage.at": { $exists: true },
        "supportLastMessage.from": { $ne: meObj },
      },
    },
    {
      $addFields: {
        meMember: {
          $first: {
            $filter: {
              input: "$members",
              as: "m",
              cond: { $eq: ["$$m.userId", meObj] },
            },
          },
        },
      },
    },
    {
      $match: {
        $expr: {
          $gt: ["$supportLastMessage.at", { $ifNull: ["$meMember.lastReadAt", new Date(0)] }],
        },
      },
    },
    { $project: { _id: 1 } },
  ]);

  res.json({
    count: rows.length,
    groupIds: rows.slice(0, 500).map((r: any) => String(r._id)),
  });
});

/**
 * POST /groups/:groupId/translate — { messageIds: string[], lang }
 *
 * Machine translation of messages in a support chat into one of the app
 * languages (en/es/fr/hi/ar/zh). Cached per message + language, so the same
 * message costs one model call however many people translate it. Support
 * chats only for now — that's where the feature is offered.
 */
router.post("/:groupId/translate", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  const body = z
    .object({
      messageIds: z.array(z.string()).min(1).max(MAX_TRANSLATE_BATCH),
      lang: z.string(),
    })
    .safeParse(req.body);
  if (!body.success || !isTranslateLang(body.data.lang)) {
    return res.status(400).json({ error: "messageIds and a supported lang are required" });
  }
  if (!Types.ObjectId.isValid(groupId)) {
    return res.status(404).json({ error: "Group not found or access denied" });
  }

  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  })
    .select("kind")
    .lean();
  if (!g) return res.status(404).json({ error: "Group not found or access denied" });
  if (!isSupportGroup(g)) {
    return res.status(403).json({ error: "Translation is available in support chats" });
  }

  try {
    const translations = await translateGroupMessages(
      groupId,
      body.data.messageIds,
      body.data.lang
    );
    res.json({ lang: body.data.lang, translations });
  } catch (err) {
    console.error("[groups/translate] failed:", err);
    res.status(502).json({ error: "Translation is unavailable right now. Please try again." });
  }
});

/** Get group details */
router.get("/:groupId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);

  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  }).lean();

  if (!g)
    return res.status(404).json({ error: "Group not found or access denied" });

  const group = g as any;
  const supportProfiles = isSupportGroup(group)
    ? await supportMemberProfiles([group])
    : null;
  // The Taskroom summary is extra: failing to build it must not cost the
  // client the group itself.
  // A support chat's board is internal — never surface it to the customer's
  // app (admins see it in the support console).
  const taskroom = isSupportGroup(group)
    ? undefined
    : await serializeGroupTaskroom(group).catch((err) => {
        console.error("[groups/:groupId] taskroom summary failed:", err);
        return undefined;
      });
  res.json({
    id: group._id,
    name: group.name,
    description: group.description,
    picture: group.picture,
    createdBy: group.createdBy,
    members: group.members,
    agentMembers: group.agentMembers || [],
    broadcastOnly: !!group.broadcastOnly,
    adminOnlyFiles: !!group.adminOnlyFiles,
    messageRetentionDays: group.messageRetentionDays || 0,
    inviteCode: group.inviteCode || null,
    inviteExpiry: group.inviteExpiry || null,
    // Only support chats carry these; ordinary groups omit the keys.
    ...(isSupportGroup(group)
      ? {
          kind: "support",
          supportUserId: group.supportUserId,
          supportUplineId: group.supportUplineId || null,
          memberProfiles: [...supportProfiles!.values()],
        }
      : {}),
    // Only groups linked to a Taskroom board carry this key.
    ...(taskroom ? { taskroom } : {}),
  });
});

/** Update group (name, picture, description) */
router.put("/:groupId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  const body = z
    .object({
      name: z.string().min(2).max(80).optional(),
      description: z.string().max(500).nullable().optional(),
      picture: z.string().nullable().optional(),
    })
    .parse(req.body);

  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  });

  if (!g)
    return res.status(404).json({ error: "Group not found or access denied" });

  // Check if user is admin (creator or has admin role)
  const meMember = g.members.find(
    (m: any) => m.userId.toString() === me
  ) as any;
  const isAdmin = isSupportGroup(g)
    ? isSupportStaff(g, me)
    : g.createdBy.toString() === me || meMember?.role === "admin";

  if (!isAdmin) {
    return res.status(403).json({ error: "Only admins can update the group" });
  }

  // Compare against the previous values so an unchanged field doesn't emit a
  // pill — the client sends the whole object back on every edit.
  const renamed =
    body.name !== undefined && body.name.trim() !== g.name;
  const iconChanged =
    body.picture !== undefined && body.picture !== g.picture;
  const descChanged =
    body.description !== undefined &&
    (body.description ? body.description.trim() : null) !==
      ((g as any).description ?? null);

  if (body.name !== undefined) {
    g.name = body.name.trim();
  }
  if (body.description !== undefined) {
    (g as any).description = body.description ? body.description.trim() : null;
  }
  if (body.picture !== undefined) {
    g.picture = body.picture;
  }

  await g.save();

  if (renamed) {
    void writeGroupSystemMessage({
      groupId,
      event: "group_renamed",
      actorId: me,
      meta: { name: g.name },
    });
  }
  if (iconChanged) {
    void writeGroupSystemMessage({
      groupId,
      event: "icon_changed",
      actorId: me,
    });
  }
  if (descChanged) {
    void writeGroupSystemMessage({
      groupId,
      event: "description_changed",
      actorId: me,
    });
  }
  res.json({
    ok: true,
    group: { id: g._id, name: g.name, description: (g as any).description, picture: g.picture },
  });
});

/** Add members */
router.post("/:groupId/members", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  const { memberIds } = z
    .object({ memberIds: z.array(z.string()).min(1) })
    .parse(req.body);

  const g = await Group.findById(groupId);
  if (!g) return res.status(404).json({ error: "Group not found" });
  if (!g.members.some((m: any) => m.userId.toString() === me))
    return res.status(403).json({ error: "Not a member" });
  // Support chat membership is managed by the server (services/supportChat);
  // only the support team may add anyone by hand.
  if (isSupportGroup(g) && !isSupportStaff(g, me))
    return res.status(403).json({ error: "Only the support team can add people to this chat" });

  const existing = new Set(g.members.map((m: any) => m.userId.toString()));
  // Only genuinely new members count toward the cap — re-adding someone who is
  // already in the group is a no-op and must not be rejected.
  const toAdd = memberIds.filter((id) => !existing.has(id));

  if (toAdd.length && g.members.length + toAdd.length > MAX_GROUP_MEMBERS) {
    return res
      .status(400)
      .json({ error: `Groups can have at most ${MAX_GROUP_MEMBERS} members` });
  }

  for (const id of toAdd) {
    g.members.push({
      userId: new Types.ObjectId(id),
      role: "member",
      lastReadAt: new Date(0),
    } as any);
  }
  await g.save();

  if (toAdd.length) {
    void writeGroupSystemMessage({
      groupId,
      event: "member_added",
      actorId: me,
      targetIds: toAdd,
    });
    // New members join the linked board too (background; never throws).
    if ((g as any).taskroom?.roomId) requestGroupTaskroomSync(groupId);
  }

  res.json({ ok: true });
});

/** Remove members */
router.delete("/:groupId/members/:memberId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId, memberId } = z
    .object({
      groupId: z.string(),
      memberId: z.string(),
    })
    .parse(req.params);

  const g = await Group.findById(groupId);
  if (!g) return res.status(404).json({ error: "Group not found" });

  const meMember = g.members.find(
    (m: any) => m.userId.toString() === me
  ) as any;
  if (!meMember) {
    return res.status(403).json({ error: "Not a member" });
  }

  const isRemovingSelf = memberId === me;

  // Support chats: the member can't leave (or be removed from) their own
  // chat, and nobody outside the support team can remove anyone — the upline
  // included. Staff manage the rest.
  if (isSupportGroup(g)) {
    if (memberId === String((g as any).supportUserId)) {
      return res.status(403).json({
        error: isRemovingSelf
          ? "You can't leave your support chat"
          : "The member can't be removed from their own support chat",
      });
    }
    if (!isSupportStaff(g, me)) {
      return res.status(403).json({
        error: isRemovingSelf
          ? "You can't leave this support chat"
          : "Only the support team can remove people from this chat",
      });
    }
  }

  // Check if user is admin or removing themselves
  const isAdmin = isSupportGroup(g)
    ? isSupportStaff(g, me)
    : g.createdBy.toString() === me || meMember?.role === "admin";

  if (!isAdmin && !isRemovingSelf) {
    return res
      .status(403)
      .json({ error: "Only admins can remove other members" });
  }

  // Prevent removing the creator
  if (memberId === g.createdBy.toString()) {
    return res.status(403).json({ error: "Cannot remove the group creator" });
  }

  const wasMember = g.members.some(
    (m: any) => m.userId.toString() === memberId
  );

  g.members = g.members.filter(
    (m: any) => m.userId.toString() !== memberId
  ) as any;

  await g.save();

  // "left" and "was removed" read very differently in the thread.
  if (wasMember) {
    void writeGroupSystemMessage({
      groupId,
      event: isRemovingSelf ? "member_left" : "member_removed",
      actorId: me,
      ...(isRemovingSelf ? {} : { targetIds: [memberId] }),
    });
    // Takes them off the linked board if the sync put them there.
    if ((g as any).taskroom?.roomId) requestGroupTaskroomSync(groupId);
  }

  res.json({ ok: true });
});

/** Messages (paged, like DM) */
router.get("/:groupId/messages", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  const { cursor, limit = 40 } = z
    .object({
      cursor: z.string().optional(),
      limit: z.coerce.number().max(100).optional(),
    })
    .parse(req.query);

  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  }).lean();
  if (!g)
    return res.status(404).json({ error: "Group not found or access denied" });

  const q: any = {
    groupId: new Types.ObjectId(groupId),
    // Exclude thread replies from the main feed — only parents/regular messages
    $or: [{ threadId: null }, { threadId: { $exists: false } }],
  };
  if (cursor) q.createdAt = { $lt: new Date(cursor) };

  // "Clear chat for me": hide everything up to this user's watermark. Nothing
  // was deleted — the other members still see the full history.
  const clearedAt = await clearedAtFor(me, `group:${groupId}`);
  if (clearedAt) {
    q.createdAt = { ...(q.createdAt || {}), $gt: clearedAt };
  }

  const docs = await GroupMessage.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("replyTo")
    .lean();
  const items = docs.reverse();
  const nextCursor = items.length ? items[0].createdAt.toISOString() : null;

  res.json({ items, nextCursor });
});

/**
 * POST /groups/:groupId/clear — "clear chat for me", synced across devices.
 *
 * Writes a watermark; deletes nothing. The other members keep the full history,
 * and messages sent AFTER the clear appear normally.
 */
router.post("/:groupId/clear", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);

  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  })
    .select("_id")
    .lean();
  if (!g)
    return res.status(404).json({ error: "Group not found or access denied" });

  const clearedAt = new Date();
  await ChatClear.findOneAndUpdate(
    { userId: new Types.ObjectId(me), convKey: `group:${groupId}` },
    { $set: { clearedAt } },
    { upsert: true }
  );

  res.json({ ok: true, clearedAt: clearedAt.toISOString() });
});

/** Get all messages in a thread (parent + replies, sorted ascending) */
router.get("/:groupId/thread/:messageId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId, messageId } = z
    .object({ groupId: z.string(), messageId: z.string() })
    .parse(req.params);

  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  }).lean();
  if (!g)
    return res.status(404).json({ error: "Group not found or access denied" });

  const parent = await GroupMessage.findOne({
    _id: new Types.ObjectId(messageId),
    groupId: new Types.ObjectId(groupId),
  }).lean();
  if (!parent) {
    return res.status(404).json({ error: "Thread parent not found" });
  }

  const replies = await GroupMessage.find({
    groupId: new Types.ObjectId(groupId),
    threadId: new Types.ObjectId(messageId),
  })
    .sort({ createdAt: 1 })
    .populate("replyTo")
    .lean();

  res.json({ parent, items: replies });
});

/** Toggle threadResolved on a thread's parent message */
router.patch(
  "/:groupId/thread/:messageId/resolve",
  requireAuth,
  async (req, res) => {
    const me = (req as any).user.userId as string;
    const { groupId, messageId } = z
      .object({ groupId: z.string(), messageId: z.string() })
      .parse(req.params);

    const g = await Group.findOne({
      _id: groupId,
      "members.userId": new Types.ObjectId(me),
    }).lean();
    if (!g)
      return res
        .status(404)
        .json({ error: "Group not found or access denied" });

    const parent = await GroupMessage.findOne({
      _id: new Types.ObjectId(messageId),
      groupId: new Types.ObjectId(groupId),
    });
    if (!parent) {
      return res.status(404).json({ error: "Thread parent not found" });
    }

    parent.threadResolved = !parent.threadResolved;
    await parent.save();

    const io = getSocketInstance();
    if (io) {
      io.to(`group:${groupId}`).emit("group:thread-update", {
        groupId,
        messageId,
        threadResolved: parent.threadResolved,
        replyCount: parent.replyCount,
        lastThreadReply: parent.lastThreadReply,
      });
    }

    res.json({ ok: true, threadResolved: parent.threadResolved });
  }
);

/** Mark read: set my lastReadAt = now (or upTo) */
router.post("/:groupId/read", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  const upTo = (req.body?.upTo && new Date(req.body.upTo)) || new Date();

  const group = await Group.findById(groupId);
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }

  // Find and update the specific member's lastReadAt
  const meObj = new Types.ObjectId(me);
  const memberIndex = group.members.findIndex(
    (m: any) => m.userId.toString() === meObj.toString()
  );

  if (memberIndex >= 0) {
    (group.members[memberIndex] as any).lastReadAt = upTo;
    await group.save();

    // Clear any per-user "mark as unread" state — opening the group
    // is the same universal signal we treat in the DM read path.
    const { ConversationState, groupConvId } = await import(
      "../models/conversationState.model"
    );
    await ConversationState.updateOne(
      { userId: new Types.ObjectId(me), convId: groupConvId(groupId) },
      { $set: { markedUnreadAt: null } },
    ).catch(() => {});

    // Emit socket event to user's personal room to update unread count in real-time
    const io = getSocketInstance();
    if (io) {
      io.to(`user:${me}`).emit("group:read", {
        groupId,
        lastReadAt: upTo,
      });
    }
  }

  res.json({ ok: true });
});

/** Edit group message */
router.put("/:groupId/message/:messageId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId, messageId } = z
    .object({
      groupId: z.string(),
      messageId: z.string(),
    })
    .parse(req.params);
  const { text } = z.object({ text: z.string().min(1) }).parse(req.body);

  // Verify user is a member of the group
  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  });
  if (!g)
    return res.status(404).json({ error: "Group not found or access denied" });

  const message = await GroupMessage.findOneAndUpdate(
    {
      _id: new Types.ObjectId(messageId),
      groupId: new Types.ObjectId(groupId),
      from: new Types.ObjectId(me), // Only allow editing own messages
    },
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

  // Linked Taskroom board: a task filed from this message follows the edit
  // (async, best-effort — never blocks the response). Unlinked groups never
  // load the module.
  if ((g as any).taskroom?.roomId || (message as any).aiTasks?.length) {
    void import("../services/groupTaskAuto")
      .then(({ maybeUpdateGroupTaskForEdit }) =>
        maybeUpdateGroupTaskForEdit(groupId, messageId, me)
      )
      .catch((e) => console.warn("[group-task-ai] edit hook failed:", e?.message || e));
  }

  res.json({ ok: true, message });
});

/** Delete group message */
router.delete("/:groupId/message/:messageId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId, messageId } = z
    .object({
      groupId: z.string(),
      messageId: z.string(),
    })
    .parse(req.params);

  // Verify user is a member of the group
  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  });
  if (!g)
    return res.status(404).json({ error: "Group not found or access denied" });

  const message = await GroupMessage.findOneAndUpdate(
    {
      _id: new Types.ObjectId(messageId),
      groupId: new Types.ObjectId(groupId),
      from: new Types.ObjectId(me), // Only allow deleting own messages
    },
    {
      $set: {
        deletedAt: new Date(),
        text: "",
        attachments: [],
        mentions: [],
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

  // Broadcast deletion so all group members see the placeholder in real time
  const io = getSocketInstance();
  if (io) {
    io.to(`group:${groupId}`).emit("group:message-deleted", {
      messageId: message._id.toString(),
      groupId,
      deletedAt: message.deletedAt,
    });
  }

  // A message the AI filed as a Taskroom task takes its task with it. Only
  // linked groups (or a message that carries the mark) can have one, so every
  // other delete skips the lookup entirely.
  if ((g as any).taskroom?.roomId || (message as any).aiTasks?.length) {
    void removeAiTasksForDeletedMessage(groupId, messageId, me);
  }

  res.json({ ok: true });
});

/**
 * DELETE /:groupId/message/:messageId/taskroom — "Remove from Taskroom".
 *
 * Deletes the Taskroom task(s) the AI filed from this message and keeps the
 * message. Allowed for the message's sender and for group admins — the same
 * people who could otherwise delete the message or unlink the board.
 */
router.delete(
  "/:groupId/message/:messageId/taskroom",
  requireAuth,
  async (req, res) => {
    const me = (req as any).user.userId as string;
    const { groupId, messageId } = z
      .object({ groupId: z.string(), messageId: z.string() })
      .parse(req.params);
    if (!Types.ObjectId.isValid(groupId) || !Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const g = await Group.findOne({
      _id: groupId,
      "members.userId": new Types.ObjectId(me),
    }).lean();
    if (!g)
      return res.status(404).json({ error: "Group not found or access denied" });

    const message: any = await GroupMessage.findOne({
      _id: new Types.ObjectId(messageId),
      groupId: new Types.ObjectId(groupId),
      deletedAt: null,
    })
      .select("from aiTasks")
      .lean();
    if (!message) return res.status(404).json({ error: "Message not found" });

    const isSender = message.from && String(message.from) === me;
    const isAdmin = isGroupAdmin(g, me);
    if (!isSender && !isAdmin) {
      return res.status(403).json({
        error: "Only the sender or a group admin can remove this task",
      });
    }

    const result = await removeAiTasksFromMessage(groupId, message, me, {
      isAdmin,
    });
    if (result.forbidden) {
      return res.status(403).json({
        error: "Only the person who reported this task or a group admin can remove it",
      });
    }
    if (!result.found) {
      return res
        .status(404)
        .json({ error: "This message has no Taskroom task" });
    }
    if (!result.removed) {
      return res
        .status(502)
        .json({ error: "Taskroom could not remove the task. Try again." });
    }
    res.json({ ok: true, removed: result.removed });
  }
);

/** POST /:groupId/agent-reply — broadcast an AI agent's reply into a group */
router.post("/:groupId/agent-reply", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  const { text, agentId, agentName } = z
    .object({
      text: z.string().min(1),
      agentId: z.string(),
      agentName: z.string(),
    })
    .parse(req.body);

  // Verify requesting user is a member of the group
  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  }).lean();
  if (!g) return res.status(404).json({ error: "Group not found or access denied" });

  const msg = await GroupMessage.create({
    groupId: new Types.ObjectId(groupId),
    text: text.trim(),
    agentMeta: { agentId, agentName },
  } as any);

  const out = {
    _id: msg.id,
    groupId,
    from: null,
    text: msg.text || "",
    agentMeta: { agentId, agentName },
    createdAt: (msg as any).createdAt,
  };

  const io = getSocketInstance();
  if (io) {
    // Broadcast only to the group room — avoids duplicate delivery
    // to users who are in both group:X and user:Y rooms
    io.to(`group:${groupId}`).emit("group:message", out);
  }

  res.json({ ok: true, msg: out });
});

/** Update admin-controlled group settings (broadcastOnly, adminOnlyFiles, retention) */
router.put("/:groupId/settings", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  const body = z
    .object({
      broadcastOnly: z.boolean().optional(),
      adminOnlyFiles: z.boolean().optional(),
      messageRetentionDays: z
        .number()
        .int()
        .refine((n) => [0, 7, 30, 90, 180, 365].includes(n), {
          message: "messageRetentionDays must be 0, 7, 30, 90, 180, or 365",
        })
        .optional(),
    })
    .parse(req.body);

  const g = await Group.findById(groupId);
  if (!g) return res.status(404).json({ error: "Group not found" });
  if (!isGroupAdmin(g, me)) {
    return res.status(403).json({ error: "Only admins can update settings" });
  }

  // Only disappearing-messages gets a pill. broadcastOnly/adminOnlyFiles are
  // admin plumbing, not something the whole thread needs narrated.
  const retentionChanged =
    body.messageRetentionDays !== undefined &&
    body.messageRetentionDays !== ((g as any).messageRetentionDays || 0);

  if (body.broadcastOnly !== undefined) (g as any).broadcastOnly = body.broadcastOnly;
  if (body.adminOnlyFiles !== undefined) (g as any).adminOnlyFiles = body.adminOnlyFiles;
  if (body.messageRetentionDays !== undefined)
    (g as any).messageRetentionDays = body.messageRetentionDays;

  await g.save();

  if (retentionChanged) {
    void writeGroupSystemMessage({
      groupId,
      event: "retention_changed",
      actorId: me,
      meta: { retentionDays: body.messageRetentionDays },
    });
  }
  res.json({
    ok: true,
    settings: {
      broadcastOnly: !!(g as any).broadcastOnly,
      adminOnlyFiles: !!(g as any).adminOnlyFiles,
      messageRetentionDays: (g as any).messageRetentionDays || 0,
    },
  });
});

// ── Taskroom link (services/groupTaskroom.ts) ──────────────────────────────
// Admin-only. The client creates the group first and links it after, so a
// failed link never costs anyone the group.

/** A Taskroom (Mongo) id — anything else would reach Taskroom as a 400. */
const taskroomId = z.string().regex(/^[a-f\d]{24}$/i);

const TaskroomLinkBody = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("new-workspace") }),
  z.object({ mode: z.literal("new-board"), workspaceId: taskroomId }),
  z.object({
    mode: z.literal("existing-board"),
    workspaceId: taskroomId,
    roomId: taskroomId,
  }),
]);

/** The group for a Taskroom route, or null (a malformed id is a miss, not a 500). */
async function findGroupForTaskroom(groupId: string): Promise<any | null> {
  if (!Types.ObjectId.isValid(groupId)) return null;
  return Group.findById(groupId)
    .select("createdBy members kind orgId taskroom")
    .lean();
}

/**
 * An admin who is still IN the group. `isGroupAdmin` admits the creator on
 * `createdBy` alone, which outlives their removal from the org — and a link
 * decides where the chat's captured work is sent.
 */
function canManageTaskroom(group: any, userId: string): boolean {
  const inGroup = (group?.members || []).some(
    (m: any) => String(m.userId) === userId
  );
  return inGroup && isGroupAdmin(group, userId);
}

/** Link errors carry their own status; anything else is ours, not Taskroom's. */
function sendTaskroomError(res: any, err: unknown, action: string) {
  if (err instanceof GroupTaskroomError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`[groups/taskroom] ${action} failed:`, err);
  return res
    .status(500)
    .json({ error: "Something went wrong. Please try again." });
}

/**
 * Support chats' Taskroom is internal (services/supportChatTaskroom.ts, reached
 * only through the garage-admin API). None of the member routes below may
 * touch it — the customer is a member of their support chat.
 */
router.use("/:groupId/taskroom", async (req, res, next) => {
  try {
    const { groupId } = req.params;
    if (Types.ObjectId.isValid(groupId)) {
      const g: any = await Group.findById(groupId).select("kind").lean();
      if (g && isSupportGroup(g)) return res.status(404).json({ error: "Not found" });
    }
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /groups/:groupId/taskroom — link (or relink) the group to a board.
 *   { mode: "new-workspace" }
 *   { mode: "new-board", workspaceId }
 *   { mode: "existing-board", workspaceId, roomId }
 * → { ok, taskroom }. 409 when the caller has no Taskroom account in this org.
 */
router.put("/:groupId/taskroom", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  const body = TaskroomLinkBody.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({
      error:
        "mode must be new-workspace, new-board (with workspaceId) or existing-board (with workspaceId and roomId)",
    });
  }

  const g = await findGroupForTaskroom(groupId);
  if (!g) return res.status(404).json({ error: "Group not found" });
  if (!canManageTaskroom(g, me)) {
    return res.status(403).json({ error: "Only admins can link Taskroom" });
  }
  if (isSupportGroup(g)) {
    return res
      .status(400)
      .json({ error: "Support chats can't be linked to Taskroom" });
  }

  try {
    const taskroom = await linkGroupTaskroom({
      groupId,
      actorId: me,
      ...body.data,
    });
    res.json({ ok: true, taskroom });
  } catch (err) {
    sendTaskroomError(res, err, "link");
  }
});

/** PATCH /groups/:groupId/taskroom — { enabled } turns AI task capture on/off. */
router.patch("/:groupId/taskroom", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  const body = z.object({ enabled: z.boolean() }).safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "enabled must be true or false" });
  }

  const g = await findGroupForTaskroom(groupId);
  if (!g) return res.status(404).json({ error: "Group not found" });
  if (!canManageTaskroom(g, me)) {
    return res.status(403).json({ error: "Only admins can change Taskroom settings" });
  }

  try {
    const taskroom = await setGroupTaskroomEnabled(groupId, body.data.enabled);
    if (!taskroom) {
      return res.status(404).json({ error: "This group isn't linked to Taskroom" });
    }
    res.json({ ok: true, taskroom });
  } catch (err) {
    sendTaskroomError(res, err, "toggle");
  }
});

/** POST /groups/:groupId/taskroom/sync — queue a member sync now. */
router.post("/:groupId/taskroom/sync", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);

  const g = await findGroupForTaskroom(groupId);
  if (!g) return res.status(404).json({ error: "Group not found" });
  if (!canManageTaskroom(g, me)) {
    return res.status(403).json({ error: "Only admins can sync Taskroom members" });
  }
  if (!g.taskroom?.roomId) {
    return res.status(404).json({ error: "This group isn't linked to Taskroom" });
  }

  requestGroupTaskroomSync(groupId);
  try {
    // Read after queueing, so `memberSync.running` is already true.
    const taskroom = await serializeGroupTaskroom(g);
    res.json({ ok: true, taskroom });
  } catch (err) {
    sendTaskroomError(res, err, "sync");
  }
});

/**
 * DELETE /groups/:groupId/taskroom — unlink. The board, its tasks and its
 * members are left untouched; the chat just stops feeding it.
 */
router.delete("/:groupId/taskroom", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);

  const g = await findGroupForTaskroom(groupId);
  if (!g) return res.status(404).json({ error: "Group not found" });
  if (!canManageTaskroom(g, me)) {
    return res.status(403).json({ error: "Only admins can unlink Taskroom" });
  }

  try {
    await unlinkGroupTaskroom(groupId, me);
    res.json({ ok: true });
  } catch (err) {
    sendTaskroomError(res, err, "unlink");
  }
});

// ── Manual Taskroom tasks (services/groupTaskManual.ts) ────────────────────
// Membership-only, NOT admin-only: anyone in the group can add, list and (with
// the reporter/admin rule) remove a task, the same way anyone can say something
// the AI would have captured. A manual add never posts a chat message and never
// runs the classifier.

const ManualTaskBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assigneeUserIds: z.array(z.string()).optional(),
  attachments: z
    .array(
      z.object({
        fileUrl: z.string(),
        fileName: z.string().optional(),
        fileType: z.string().optional(),
      })
    )
    .optional(),
});

/**
 * POST /:groupId/taskroom/task — file a task on the linked board by hand.
 * → 201 { ok, task }. Typed link errors (not linked / disabled / board gone /
 * nobody can act) come back with their own status via sendTaskroomError.
 */
router.post("/:groupId/taskroom/task", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  if (!Types.ObjectId.isValid(groupId)) {
    return res.status(404).json({ error: "Group not found" });
  }
  const body = ManualTaskBody.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "A task needs a title" });
  }

  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  })
    .select("_id")
    .lean();
  if (!g) return res.status(404).json({ error: "Group not found or access denied" });

  try {
    const task = await createManualTask({ groupId, actorId: me, ...body.data });
    res.status(201).json({ ok: true, task });
  } catch (err) {
    sendTaskroomError(res, err, "create task");
  }
});

/**
 * GET /:groupId/taskroom/tasks?scope=group|mine — the group's tasks on the
 * linked board (live, with a cache fallback). → 200 { ok, board, live, counts, tasks }.
 */
router.get("/:groupId/taskroom/tasks", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  if (!Types.ObjectId.isValid(groupId)) {
    return res.status(404).json({ error: "Group not found" });
  }
  const scope = req.query.scope === "mine" ? "mine" : "group";

  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  })
    .select("_id")
    .lean();
  if (!g) return res.status(404).json({ error: "Group not found or access denied" });

  try {
    const result = await listGroupTasks({ groupId, actorId: me, scope });
    res.json({ ok: true, ...result });
  } catch (err) {
    sendTaskroomError(res, err, "list tasks");
  }
});

/**
 * DELETE /:groupId/taskroom/tasks/:taskId — remove a task the group filed.
 * The reporter or a group admin may remove it; anyone else gets 403.
 */
router.delete("/:groupId/taskroom/tasks/:taskId", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId, taskId } = z
    .object({ groupId: z.string(), taskId: z.string() })
    .parse(req.params);
  if (!Types.ObjectId.isValid(groupId)) {
    return res.status(404).json({ error: "Group not found" });
  }

  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  })
    .select("createdBy members kind")
    .lean();
  if (!g) return res.status(404).json({ error: "Group not found or access denied" });

  try {
    const isAdmin = isGroupAdmin(g, me);
    const result = await removeGroupTaskById({ groupId, actorId: me, taskId, isAdmin });
    if (result.forbidden) {
      return res.status(403).json({
        error: "Only the person who added this task or a group admin can remove it",
      });
    }
    res.json({ ok: true, removed: result.removed });
  } catch (err) {
    sendTaskroomError(res, err, "remove task");
  }
});

/**
 * PUT /:groupId/taskroom/tasks/:taskId/assign — add group members to a task the
 * group filed. Membership-only, like adding a task: anyone in the group can
 * assign. → 200 { ok, assigned, already, notAssigned, failed }. Members not yet
 * synced to the board come back in `notAssigned`, not as an error.
 */
router.put("/:groupId/taskroom/tasks/:taskId/assign", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId, taskId } = z
    .object({ groupId: z.string(), taskId: z.string() })
    .parse(req.params);
  if (!Types.ObjectId.isValid(groupId)) {
    return res.status(404).json({ error: "Group not found" });
  }
  const body = z
    .object({ assigneeUserIds: z.array(z.string()).min(1) })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Pick at least one person to assign" });
  }

  const g = await Group.findOne({
    _id: groupId,
    "members.userId": new Types.ObjectId(me),
  })
    .select("_id")
    .lean();
  if (!g) return res.status(404).json({ error: "Group not found or access denied" });

  try {
    const result = await assignGroupTask({
      groupId,
      actorId: me,
      taskId,
      assigneeUserIds: body.data.assigneeUserIds,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    sendTaskroomError(res, err, "assign task");
  }
});

/** Change a member's role (promote/demote) */
router.put("/:groupId/members/:memberId/role", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId, memberId } = z
    .object({ groupId: z.string(), memberId: z.string() })
    .parse(req.params);
  const { role } = z
    .object({ role: z.enum(["admin", "member"]) })
    .parse(req.body);

  const g = await Group.findById(groupId);
  if (!g) return res.status(404).json({ error: "Group not found" });
  if (!isGroupAdmin(g, me)) {
    return res.status(403).json({ error: "Only admins can change roles" });
  }
  if (memberId === g.createdBy.toString()) {
    return res.status(400).json({ error: "Cannot change the creator's role" });
  }

  const target = g.members.find((m: any) => m.userId.toString() === memberId) as any;
  if (!target) return res.status(404).json({ error: "Member not found" });

  // Refuse to demote the last admin
  if (target.role === "admin" && role === "member") {
    const adminCount = g.members.filter(
      (m: any) => m.role === "admin" || m.userId.toString() === g.createdBy.toString()
    ).length;
    if (adminCount <= 1) {
      return res.status(400).json({ error: "Cannot demote the last admin" });
    }
  }

  const roleChanged = target.role !== role;
  target.role = role;
  await g.save();

  if (roleChanged) {
    void writeGroupSystemMessage({
      groupId,
      event: role === "admin" ? "admin_promoted" : "admin_dismissed",
      actorId: me,
      targetIds: [memberId],
    });
  }

  res.json({ ok: true, memberId, role });
});

/** Generate (or regenerate) the group's invite link */
router.post("/:groupId/invite-link", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);
  const { expiryDays } = z
    .object({
      expiryDays: z
        .number()
        .int()
        .refine((n) => [1, 7, 30].includes(n), {
          message: "expiryDays must be 1, 7, or 30",
        })
        .nullable()
        .optional(),
    })
    .parse(req.body);

  const g = await Group.findById(groupId);
  if (!g) return res.status(404).json({ error: "Group not found" });
  if (!isGroupAdmin(g, me)) {
    return res.status(403).json({ error: "Only admins can manage invite links" });
  }

  // Generate a code (retry once on the astronomically-rare collision)
  let code = generateInviteCode();
  if (await Group.findOne({ inviteCode: code, _id: { $ne: g._id } }).lean()) {
    code = generateInviteCode();
  }

  const expiresAt =
    expiryDays && expiryDays > 0
      ? new Date(Date.now() + expiryDays * 86400000)
      : null;

  (g as any).inviteCode = code;
  (g as any).inviteExpiry = expiresAt;
  await g.save();

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  res.json({
    ok: true,
    inviteCode: code,
    inviteUrl: appUrl ? `${appUrl}/invite/${code}` : `/invite/${code}`,
    expiresAt,
  });
});

/** Revoke the group's invite link */
router.delete("/:groupId/invite-link", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { groupId } = z.object({ groupId: z.string() }).parse(req.params);

  const g = await Group.findById(groupId);
  if (!g) return res.status(404).json({ error: "Group not found" });
  if (!isGroupAdmin(g, me)) {
    return res.status(403).json({ error: "Only admins can manage invite links" });
  }

  // Use $unset rather than setting to null. The partial unique index
  // on inviteCode excludes only docs where the field is *missing*, so
  // setting it to null would collide on the next revoke of any other
  // group. Bypasses Mongoose document state and goes straight to the
  // collection so the field truly disappears.
  await Group.updateOne(
    { _id: g._id },
    { $unset: { inviteCode: 1, inviteExpiry: 1 } },
  );
  res.json({ ok: true });
});

/** Public group preview for an invite code (no auth required) */
router.get("/invite/:code", async (req, res) => {
  const { code } = z.object({ code: z.string().min(1) }).parse(req.params);

  const g = await Group.findOne({ inviteCode: code }).lean();
  if (!g) return res.status(404).json({ error: "Invite link not found" });

  const group = g as any;
  const expired = !!(group.inviteExpiry && new Date(group.inviteExpiry) < new Date());
  res.json({
    id: group._id,
    name: group.name,
    description: group.description,
    picture: group.picture,
    memberCount: (group.members || []).length,
    expired,
    expiresAt: group.inviteExpiry || null,
  });
});

/** Join a group via invite code (auth required) */
router.post("/invite/:code/join", requireAuth, async (req, res) => {
  const me = (req as any).user.userId as string;
  const { code } = z.object({ code: z.string().min(1) }).parse(req.params);

  const g = await Group.findOne({ inviteCode: code });
  if (!g) return res.status(404).json({ error: "Invite link not found" });

  const expiry = (g as any).inviteExpiry;
  if (expiry && new Date(expiry) < new Date()) {
    return res.status(410).json({ error: "Invite link has expired" });
  }

  const alreadyMember = g.members.some((m: any) => m.userId.toString() === me);
  if (!alreadyMember) {
    g.members.push({
      userId: new Types.ObjectId(me),
      role: "member",
      lastReadAt: new Date(0),
    } as any);
    await g.save();
    if ((g as any).taskroom?.roomId) requestGroupTaskroomSync(String(g._id));
  }

  res.json({ ok: true, groupId: g._id, alreadyMember });
});

export default router;
