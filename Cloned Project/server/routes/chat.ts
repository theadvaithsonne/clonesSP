// src/routes/chat.ts
//
// Cross-device chat state: mutes, pins, stars, blocks, drafts, and search.
//
// Everything here is keyed on a viewer-relative `convKey` —
// `dm:<otherUserId>` or `group:<groupId>` — which is the key the mobile client
// and the push payload (`data.chatId`) already use. DM message rows are keyed
// on the SORTED `convId` (`dm:<a>:<b>`) instead, so the two are converted at
// the boundary by `convIdForKey` rather than anywhere deeper.
//
// Guards are attached PER ROUTE, never `router.use(requireAuth)` — see the
// Express note in CLAUDE.md. This router owns the whole `/chat` prefix today,
// but a second router mounted alongside it later would be intercepted by a
// router-level guard, which is exactly how admin login broke once.

import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { Message } from "../models/message.model";
import { GroupMessage } from "../models/groupMessage.model";
import { Group } from "../models/group.model";
import { ChatMute } from "../models/chatMute.model";
import { ChatPin, MAX_PINNED_CHATS } from "../models/chatPin.model";
import { ChatStar } from "../models/chatStar.model";
import { ChatBlock } from "../models/chatBlock.model";
import { ChatDraft, MAX_DRAFT_LENGTH } from "../models/chatDraft.model";
import { clearedAtMap } from "../models/chatClear.model";
import { dmConvId } from "../utils/conv";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────
// convKey helpers
// ─────────────────────────────────────────────────────────────────────────

type ConvRef = { kind: "dm" | "group"; id: string };

/** `dm:<userId>` | `group:<groupId>` → parts, or null if malformed. */
function parseConvKey(convKey: string): ConvRef | null {
  const m = /^(dm|group):([a-fA-F0-9]{24})$/.exec(convKey || "");
  if (!m) return null;
  return { kind: m[1] as "dm" | "group", id: m[2] };
}

const convKeySchema = z
  .string()
  .refine((v) => parseConvKey(v) !== null, {
    message: "convKey must be dm:<userId> or group:<groupId>",
  });

/**
 * Resolve a message the caller is ENTITLED to see, or null.
 *
 * The authorisation is expressed as part of the query rather than as a check
 * after the fetch, so there is no path that loads a body first and decides
 * afterwards:
 *
 *   - DM    — the row must sit in the sorted convId for (me, other) AND have
 *             the caller as `from` or `to`.
 *   - Group — the row must belong to that group AND the caller must be a
 *             current member of it.
 *
 * Both also pin the message to the conversation named by `convKey`, so a valid
 * id from another chat cannot be filed under one the caller does belong to.
 */
async function findAuthorisedMessage(
  meId: string,
  ref: ConvRef,
  messageId: string
): Promise<any | null> {
  const meOid = new Types.ObjectId(meId);
  const msgOid = new Types.ObjectId(messageId);

  if (ref.kind === "dm") {
    return Message.findOne({
      _id: msgOid,
      convId: dmConvId(meId, ref.id),
      $or: [{ from: meOid }, { to: meOid }],
    })
      .select("_id")
      .lean();
  }

  const member = await Group.findOne({
    _id: new Types.ObjectId(ref.id),
    "members.userId": meOid,
  })
    .select("_id")
    .lean();
  if (!member) return null;

  return GroupMessage.findOne({
    _id: msgOid,
    groupId: new Types.ObjectId(ref.id),
  })
    .select("_id")
    .lean();
}

/**
 * Escape a user's search text so it is matched literally.
 * Without this, a query containing `(` or `*` is either a syntax error or a
 * pathological regex — user input must never reach the engine as a pattern.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─────────────────────────────────────────────────────────────────────────
// P1-1  Mutes
// ─────────────────────────────────────────────────────────────────────────

/**
 * GET /chat/mutes
 * Every active mute for the caller. Expired rows are filtered out here rather
 * than swept, so the client never has to reason about staleness.
 */
router.get("/mutes", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const now = new Date();
    const rows = await ChatMute.find({
      userId: new Types.ObjectId(me.userId),
      $or: [{ until: null }, { until: { $gt: now } }],
    })
      .select("convKey until")
      .lean();

    res.json({
      mutes: rows.map((r: any) => ({
        convKey: r.convKey,
        until: r.until ? r.until.toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("[chat] list mutes failed:", error);
    res.status(500).json({ error: "Failed to list mutes" });
  }
});

/**
 * PUT /chat/mutes/:convKey   { until: ISO string | null }
 * `until: null` mutes indefinitely. Upsert, so re-muting an already-muted
 * chat just moves the expiry.
 */
router.put("/mutes/:convKey", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { convKey } = z.object({ convKey: convKeySchema }).parse(req.params);
    const { until } = z
      .object({ until: z.string().datetime().nullable().optional() })
      .parse(req.body ?? {});

    const row = await ChatMute.findOneAndUpdate(
      { userId: new Types.ObjectId(me.userId), convKey },
      { $set: { until: until ? new Date(until) : null } },
      { upsert: true, new: true }
    ).lean<any>();

    res.json({
      ok: true,
      mute: {
        convKey: row.convKey,
        until: row.until ? row.until.toISOString() : null,
      },
    });
  } catch (error) {
    console.error("[chat] set mute failed:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/** DELETE /chat/mutes/:convKey — unmute. Idempotent. */
router.delete("/mutes/:convKey", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { convKey } = z.object({ convKey: convKeySchema }).parse(req.params);
    await ChatMute.deleteOne({
      userId: new Types.ObjectId(me.userId),
      convKey,
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("[chat] delete mute failed:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// P2-1  Pinned chats
// ─────────────────────────────────────────────────────────────────────────

/** GET /chat/pins → convKeys in display order. */
router.get("/pins", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const row = await ChatPin.findOne({ userId: new Types.ObjectId(me.userId) })
      .select("pins")
      .lean<any>();
    res.json({ pins: row?.pins || [] });
  } catch (error) {
    console.error("[chat] list pins failed:", error);
    res.status(500).json({ error: "Failed to list pins" });
  }
});

/**
 * PUT /chat/pins   { pins: convKey[] }
 * The client always sends the complete ordered list — see chatPin.model.ts for
 * why this is an array rather than a row per pin.
 */
router.put("/pins", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { pins } = z
      .object({ pins: z.array(convKeySchema).max(MAX_PINNED_CHATS) })
      .parse(req.body ?? {});

    // De-duplicate while preserving order — a repeated convKey would render
    // the same chat twice at the top of the list.
    const unique = Array.from(new Set(pins));

    await ChatPin.findOneAndUpdate(
      { userId: new Types.ObjectId(me.userId) },
      { $set: { pins: unique } },
      { upsert: true }
    );
    res.json({ ok: true, pins: unique });
  } catch (error) {
    console.error("[chat] set pins failed:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// P2-2  Starred messages
// ─────────────────────────────────────────────────────────────────────────

/**
 * POST /chat/stars   { convKey, messageId }
 *
 * The caller must be a participant in the conversation the message belongs to.
 * Without this check, starring was an oracle: any ObjectId could be filed and
 * then read back in full through GET /chat/stars, and message ObjectIds are
 * partly derivable (timestamp + counter), so they can be guessed rather than
 * merely leaked.
 */
router.post("/stars", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { convKey, messageId } = z
      .object({
        convKey: convKeySchema,
        messageId: z.string().regex(/^[a-fA-F0-9]{24}$/),
      })
      .parse(req.body ?? {});

    const ref = parseConvKey(convKey)!;
    const allowed = await findAuthorisedMessage(me.userId, ref, messageId);
    if (!allowed) {
      // Deliberately the same answer whether the message does not exist or the
      // caller simply cannot see it — distinguishing them would confirm that a
      // given ObjectId is real.
      return res.status(404).json({ error: "Message not found" });
    }

    await ChatStar.findOneAndUpdate(
      {
        userId: new Types.ObjectId(me.userId),
        messageId: new Types.ObjectId(messageId),
      },
      { $set: { convKey } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("[chat] star failed:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/** DELETE /chat/stars/:messageId — unstar. Idempotent. */
router.delete("/stars/:messageId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { messageId } = z
      .object({ messageId: z.string().regex(/^[a-fA-F0-9]{24}$/) })
      .parse(req.params);

    await ChatStar.deleteOne({
      userId: new Types.ObjectId(me.userId),
      messageId: new Types.ObjectId(messageId),
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("[chat] unstar failed:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * GET /chat/stars?convKey=&cursor=&limit=
 *
 * Message bodies are resolved live rather than snapshotted, so an edited star
 * shows current text. A star whose message has since been deleted is dropped
 * from the page AND its row removed — the spec asks for the star to go when the
 * message does, and this is the moment we can tell.
 */
router.get("/stars", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { convKey, cursor, limit } = z
      .object({
        convKey: convKeySchema.optional(),
        cursor: z.string().datetime().optional(),
        limit: z.coerce.number().min(1).max(50).default(30),
      })
      .parse(req.query);

    const q: any = { userId: new Types.ObjectId(me.userId) };
    if (convKey) q.convKey = convKey;
    if (cursor) q.createdAt = { $lt: new Date(cursor) };

    const rows = await ChatStar.find(q)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    // Split by conversation kind so each collection is hit once, not per row.
    const dmIds: Types.ObjectId[] = [];
    const groupIds: Types.ObjectId[] = [];
    for (const r of page as any[]) {
      const ref = parseConvKey(r.convKey);
      if (!ref) continue;
      (ref.kind === "dm" ? dmIds : groupIds).push(r.messageId);
    }

    // Authorisation is re-applied HERE, not just at POST time: a user can be
    // removed from a group after starring one of its messages, and their old
    // star must not keep serving them its contents.
    //
    // DMs are constrained to rows the caller is a party to; groups to rows in
    // groups they are still a member of. Both are part of the query, so an
    // unauthorised row is never loaded in the first place.
    const meOid = new Types.ObjectId(me.userId);
    const myGroupIds = groupIds.length
      ? (
          await Group.find({ "members.userId": meOid })
            .select("_id")
            .lean()
        ).map((g: any) => g._id)
      : [];

    const [dmMsgs, groupMsgs] = await Promise.all([
      dmIds.length
        ? Message.find({
            _id: { $in: dmIds },
            deletedAt: null,
            $or: [{ from: meOid }, { to: meOid }],
          })
            .populate("from", "name profilePicture")
            .lean()
        : Promise.resolve([]),
      groupIds.length && myGroupIds.length
        ? GroupMessage.find({
            _id: { $in: groupIds },
            deletedAt: null,
            groupId: { $in: myGroupIds },
          })
            .populate("from", "name profilePicture")
            .lean()
        : Promise.resolve([]),
    ]);

    const byId = new Map<string, any>();
    for (const m of [...(dmMsgs as any[]), ...(groupMsgs as any[])]) {
      byId.set(String(m._id), m);
    }

    const items: any[] = [];
    const orphaned: Types.ObjectId[] = [];
    for (const r of page as any[]) {
      const message = byId.get(String(r.messageId));
      if (!message) {
        orphaned.push(r.messageId);
        continue;
      }
      items.push({
        convKey: r.convKey,
        message,
        starredAt: r.createdAt.toISOString(),
      });
    }

    // A row can drop out of the page for TWO different reasons, and they must
    // not be conflated: the message was deleted (the star should go), or the
    // caller can no longer see it (the star should merely be hidden — being
    // removed from a group must not destroy their saved messages, since they
    // may be added back).
    //
    // So only stars whose message is genuinely gone or soft-deleted are
    // cleaned up. This runs unauthenticated ON PURPOSE: it checks existence
    // only and returns nothing to the caller.
    if (orphaned.length) {
      void (async () => {
        const [liveDm, liveGroup] = await Promise.all([
          Message.find({ _id: { $in: orphaned }, deletedAt: null })
            .select("_id")
            .lean(),
          GroupMessage.find({ _id: { $in: orphaned }, deletedAt: null })
            .select("_id")
            .lean(),
        ]);
        const stillAlive = new Set(
          [...(liveDm as any[]), ...(liveGroup as any[])].map((m) =>
            String(m._id)
          )
        );
        const trulyGone = orphaned.filter((id) => !stillAlive.has(String(id)));
        if (!trulyGone.length) return;
        await ChatStar.deleteMany({
          userId: new Types.ObjectId(me.userId),
          messageId: { $in: trulyGone },
        });
      })().catch((e) => console.error("[chat] star cleanup failed:", e));
    }

    res.json({
      items,
      nextCursor: hasMore
        ? (page[page.length - 1] as any).createdAt.toISOString()
        : null,
    });
  } catch (error) {
    console.error("[chat] list stars failed:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// P2-6  Blocking
// ─────────────────────────────────────────────────────────────────────────

/** GET /chat/blocks → userIds the caller has blocked. */
router.get("/blocks", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const rows = await ChatBlock.find({
      userId: new Types.ObjectId(me.userId),
    })
      .select("blockedUserId")
      .lean();
    res.json({ blocked: rows.map((r: any) => String(r.blockedUserId)) });
  } catch (error) {
    console.error("[chat] list blocks failed:", error);
    res.status(500).json({ error: "Failed to list blocks" });
  }
});

/** PUT /chat/blocks/:userId — block. Idempotent. */
router.put("/blocks/:userId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { userId } = z
      .object({ userId: z.string().regex(/^[a-fA-F0-9]{24}$/) })
      .parse(req.params);

    if (userId === me.userId) {
      return res.status(400).json({ error: "You cannot block yourself" });
    }

    await ChatBlock.findOneAndUpdate(
      {
        userId: new Types.ObjectId(me.userId),
        blockedUserId: new Types.ObjectId(userId),
      },
      { $setOnInsert: { userId: new Types.ObjectId(me.userId) } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("[chat] block failed:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/** DELETE /chat/blocks/:userId — unblock. Idempotent. */
router.delete("/blocks/:userId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { userId } = z
      .object({ userId: z.string().regex(/^[a-fA-F0-9]{24}$/) })
      .parse(req.params);

    await ChatBlock.deleteOne({
      userId: new Types.ObjectId(me.userId),
      blockedUserId: new Types.ObjectId(userId),
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("[chat] unblock failed:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// P2-4  Drafts
// ─────────────────────────────────────────────────────────────────────────

/** GET /chat/drafts → every non-empty draft for the caller. */
router.get("/drafts", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const rows = await ChatDraft.find({
      userId: new Types.ObjectId(me.userId),
      text: { $ne: "" },
    })
      .select("convKey text updatedAt")
      .lean();

    res.json({
      drafts: rows.map((r: any) => ({
        convKey: r.convKey,
        text: r.text,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[chat] list drafts failed:", error);
    res.status(500).json({ error: "Failed to list drafts" });
  }
});

/**
 * PUT /chat/drafts/:convKey   { text }
 * Empty text deletes the row rather than storing a blank — see the model.
 */
router.put("/drafts/:convKey", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { convKey } = z.object({ convKey: convKeySchema }).parse(req.params);
    const { text } = z
      .object({ text: z.string().max(MAX_DRAFT_LENGTH) })
      .parse(req.body ?? {});

    if (!text.trim()) {
      await ChatDraft.deleteOne({
        userId: new Types.ObjectId(me.userId),
        convKey,
      });
      return res.json({ ok: true, cleared: true });
    }

    await ChatDraft.findOneAndUpdate(
      { userId: new Types.ObjectId(me.userId), convKey },
      { $set: { text } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("[chat] set draft failed:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// P1-2  Search
// ─────────────────────────────────────────────────────────────────────────

/**
 * GET /chat/search?q=&type=all|messages|media&cursor=&limit=
 *
 * Substring, case-insensitive, across every conversation the caller belongs to.
 *
 * Matching is a REGEX, not a Mongo text index. A text index tokenises into
 * whole words with stemming, so "rep" would never find "report" and a
 * two-character query would match nothing — wrong for a chat search box, which
 * is incremental by nature. The regex is anchored by a conversation filter
 * (`convId` for DMs, `groupId ∈ my groups`), both of which are indexed with
 * `createdAt`, so the scan stays bounded to the caller's own history.
 *
 * Pagination is a `createdAt` cursor rather than an offset: the two streams are
 * merged after the fact, and an offset would have to re-fetch and re-merge
 * everything above it on every page.
 */
router.get("/search", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { q, type, cursor, limit } = z
      .object({
        q: z.string().min(2, "Search needs at least 2 characters"),
        type: z.enum(["all", "messages", "media"]).default("all"),
        cursor: z.string().datetime().optional(),
        limit: z.coerce.number().min(1).max(50).default(20),
      })
      .parse(req.query);

    const rx = new RegExp(escapeRegex(q.trim()), "i");
    const before = cursor ? new Date(cursor) : null;
    const meOid = new Types.ObjectId(me.userId);

    // Respect "clear chat for me" — cleared history must not reappear here.
    const cleared = await clearedAtMap(me.userId);

    // Groups the caller is actually in. Membership is the authorisation
    // boundary for group results; DMs are bounded by from/to below.
    const myGroups = await Group.find({ "members.userId": meOid })
      .select("_id name")
      .lean();
    const groupNameById = new Map(
      (myGroups as any[]).map((g) => [String(g._id), g.name])
    );

    const textClause =
      type === "media"
        ? {
            attachments: { $ne: [] },
            $or: [{ text: rx }, { "attachments.fileName": rx }],
          }
        : { text: rx };

    const dmQuery: any = {
      $and: [
        { $or: [{ from: meOid }, { to: meOid }] },
        textClause,
        { deletedAt: null },
      ],
    };
    if (before) dmQuery.createdAt = { $lt: before };

    const groupQuery: any = {
      groupId: { $in: (myGroups as any[]).map((g) => g._id) },
      ...textClause,
      deletedAt: null,
      // System pills are not content and must never surface in search.
      type: { $ne: "system" },
    };
    if (before) groupQuery.createdAt = { $lt: before };

    // Over-fetch each side: after merging and dropping cleared rows, either
    // stream alone might supply the whole page.
    const [dmRows, groupRows] = await Promise.all([
      Message.find(dmQuery)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .populate("from", "name profilePicture")
        .populate("to", "name profilePicture")
        .lean(),
      (myGroups as any[]).length
        ? GroupMessage.find(groupQuery)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .populate("from", "name profilePicture")
            .lean()
        : Promise.resolve([]),
    ]);

    type Hit = { convKey: string; message: any; chatName: string };
    const hits: Hit[] = [];

    for (const m of dmRows as any[]) {
      // convKey is viewer-relative: the OTHER participant.
      const fromId = String(m.from?._id || m.from);
      const otherId = fromId === me.userId ? String(m.to?._id || m.to) : fromId;
      const convKey = `dm:${otherId}`;

      const clearedAt = cleared.get(convKey);
      if (clearedAt && m.createdAt <= clearedAt) continue;

      const other = fromId === me.userId ? m.to : m.from;
      hits.push({
        convKey,
        message: m,
        chatName: other?.name || "Unknown",
      });
    }

    for (const m of groupRows as any[]) {
      const convKey = `group:${String(m.groupId)}`;
      const clearedAt = cleared.get(convKey);
      if (clearedAt && m.createdAt <= clearedAt) continue;

      hits.push({
        convKey,
        message: m,
        chatName: groupNameById.get(String(m.groupId)) || "Group",
      });
    }

    hits.sort(
      (a, b) =>
        new Date(b.message.createdAt).getTime() -
        new Date(a.message.createdAt).getTime()
    );

    const hasMore = hits.length > limit;
    const page = hits.slice(0, limit);

    res.json({
      messages: page,
      nextCursor:
        hasMore && page.length
          ? new Date(page[page.length - 1].message.createdAt).toISOString()
          : null,
    });
  } catch (error) {
    console.error("[chat] search failed:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
