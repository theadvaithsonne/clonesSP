// src/services/groupSystemMessage.ts
//
// "Priya added Devon" — the centred pills in a group thread.
//
// Written as ordinary GroupMessage rows carrying `type: "system"`, so they
// arrive on the EXISTING `group:message` socket event and page through the
// existing message routes. No new event, no new endpoint.
//
// Two rules make them safe for clients that predate them:
//
//   1. `text` is pre-rendered server-side. A client that knows nothing about
//      `type`/`event` still has a human-readable line to show.
//   2. They must never affect unread counts, previews, or pushes. Unread is
//      computed from `lastReadAt` vs message time, so a system row WOULD
//      otherwise inflate the badge — callers filter on `type: { $ne: "system" }`
//      at those three sites (see groups.ts /unread/all and /last-messages).
//
// `from` is intentionally left unset — the schema already allows that for agent
// replies. Who performed the action is on `actorId`.

import { Types } from "mongoose";
import { GroupMessage, SystemEvent } from "../models/groupMessage.model";
import { User } from "../models/user.model";
import { getSocketInstance } from "./socket";

/** Extra context some events need to render their sentence. */
export interface SystemMessageMeta {
  /** New group name, for `group_renamed`. */
  name?: string;
  /** New retention window in days, for `retention_changed`. 0 = off. */
  retentionDays?: number;
  /** Board name, for `taskroom_linked`. */
  roomName?: string;
  /** Task title, for `ai_task_created` / `ai_task_removed` / `ai_task_assigned` / `manual_task_created`. */
  taskTitle?: string;
  /** Who the task was assigned to, for `ai_task_assigned`. */
  assigneeName?: string;
}

/**
 * Where a Taskroom pill points, stored on the message so the client can open
 * the board. Only `taskroom_linked` and `ai_task_created` carry it.
 */
export interface SystemMessageTaskroom {
  taskId?: string;
  roomId?: string;
  spaceId?: string;
  workspaceId?: string;
  title?: string;
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "someone";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function renderText(
  event: SystemEvent,
  actorName: string,
  targetNames: string[],
  meta: SystemMessageMeta
): string {
  const targets = joinNames(targetNames);
  switch (event) {
    case "group_created":
      return `${actorName} created this group`;
    case "member_added":
      return `${actorName} added ${targets}`;
    case "member_removed":
      return `${actorName} removed ${targets}`;
    case "member_left":
      return `${actorName} left`;
    case "admin_promoted":
      return `${actorName} made ${targets} an admin`;
    case "admin_dismissed":
      return `${actorName} dismissed ${targets} as admin`;
    case "group_renamed":
      return meta.name
        ? `${actorName} changed the group name to "${meta.name}"`
        : `${actorName} changed the group name`;
    case "icon_changed":
      return `${actorName} changed the group icon`;
    case "description_changed":
      return `${actorName} changed the group description`;
    case "retention_changed":
      return meta.retentionDays
        ? `${actorName} set disappearing messages to ${meta.retentionDays} days`
        : `${actorName} turned off disappearing messages`;
    case "taskroom_linked":
      return meta.roomName
        ? `${actorName} linked this group to the Taskroom board "${meta.roomName}"`
        : `${actorName} linked this group to Taskroom`;
    case "taskroom_unlinked":
      return `${actorName} unlinked Taskroom from this group`;
    case "ai_task_created":
      return meta.taskTitle
        ? `Task added to Taskroom: "${meta.taskTitle}"`
        : `Task added to Taskroom`;
    case "manual_task_created":
      return meta.taskTitle
        ? `${actorName} added a task to Taskroom: "${meta.taskTitle}"`
        : `${actorName} added a task to Taskroom`;
    case "ai_task_removed":
      return meta.taskTitle
        ? `Task removed from Taskroom: "${meta.taskTitle}"`
        : `Task removed from Taskroom`;
    case "ai_task_updated":
      return meta.taskTitle
        ? `Task updated in Taskroom: "${meta.taskTitle}"`
        : `Task updated in Taskroom`;
    case "ai_task_assigned": {
      const who = meta.assigneeName || "someone";
      return meta.taskTitle
        ? `Task assigned to ${who}: "${meta.taskTitle}"`
        : `Task assigned to ${who}`;
    }
    default:
      return `${actorName} updated the group`;
  }
}

/**
 * Write a system pill and broadcast it to the group room.
 *
 * Never throws into the caller: the action that triggered it (adding a member,
 * renaming a group) has already been committed and must not be reported as
 * failed because its audit line could not be written.
 */
export async function writeGroupSystemMessage(opts: {
  groupId: string | Types.ObjectId;
  event: SystemEvent;
  actorId: string | Types.ObjectId;
  targetIds?: (string | Types.ObjectId)[];
  meta?: SystemMessageMeta;
  taskroom?: SystemMessageTaskroom;
}): Promise<void> {
  try {
    const groupId = new Types.ObjectId(String(opts.groupId));
    // Taskroom pills ("added a task to Taskroom: …") never go into a support
    // chat: the customer is a member and would read internal task titles.
    if (opts.taskroom || /taskroom|_task_/.test(String(opts.event))) {
      const { Group } = await import("../models/group.model");
      const g: any = await Group.findById(groupId).select("kind").lean();
      if (g?.kind === "support") return;
    }
    const actorId = new Types.ObjectId(String(opts.actorId));
    const targetIds = (opts.targetIds || []).map(
      (id) => new Types.ObjectId(String(id))
    );
    const meta = opts.meta || {};

    // One query for actor + targets rather than one each.
    const users = await User.find({ _id: { $in: [actorId, ...targetIds] } })
      .select("name email")
      .lean();
    const nameById = new Map(
      (users as any[]).map((u) => [
        String(u._id),
        u.name || u.email?.split("@")[0] || "Someone",
      ])
    );

    const actorName = nameById.get(String(actorId)) || "Someone";
    const targetNames = targetIds.map(
      (id) => nameById.get(String(id)) || "someone"
    );

    const text = renderText(opts.event, actorName, targetNames, meta);

    const msg = await GroupMessage.create({
      groupId,
      type: "system",
      event: opts.event,
      actorId,
      ...(targetIds.length ? { targetIds } : {}),
      ...(opts.taskroom ? { taskroom: opts.taskroom } : {}),
      text,
    } as any);

    const out = {
      _id: msg.id,
      groupId: String(groupId),
      type: "system",
      event: opts.event,
      actorId: String(actorId),
      ...(targetIds.length
        ? { targetIds: targetIds.map((id) => String(id)) }
        : {}),
      ...(opts.taskroom ? { taskroom: opts.taskroom } : {}),
      from: null,
      text,
      createdAt: (msg as any).createdAt,
    };

    const io = getSocketInstance();
    if (io) {
      // Group room only — same as agent replies, so a user in both
      // group:X and user:Y doesn't receive it twice.
      io.to(`group:${String(groupId)}`).emit("group:message", out);
    }
  } catch (err) {
    console.error(
      `[groupSystemMessage] failed to write ${opts.event}:`,
      (err as Error)?.message || err
    );
  }
}
