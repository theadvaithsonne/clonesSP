// Rehan's group-chat Taskroom features, for support/NVC chats.
//
// Group chats link to a board and file tasks onto it (services/groupTaskroom.ts,
// groupTaskManual.ts). Support chats were refused at every step, for good
// reasons this file keeps:
//
//   • No member sync. A support chat's members are the customer and their
//     upline — they must never be put on an internal board. Tasks are posted as
//     the support board owner instead (the link's `linkedBy` + `actorOrgId`,
//     honoured by groupTaskroomActor.ts).
//   • No pills in the chat. "Added a task to Taskroom: …" would show the
//     customer internal titles; groupSystemMessage.ts drops them for support
//     chats. Admins see a chat's tasks in the console instead.
//   • No AI capture yet. groupTaskAuto's `kind !== "support"` gate stays —
//     "we will add AI creation later" (Shorupan, 2026-10-01).
//
// A support chat with no board of its own uses the SHARED support board (the
// one picked at the top of the Support Chats page). Admins can point a single
// chat at a different board, or unlink it to fall back to the shared one.
// Rehan's manual-task, list and remove code is reused as-is: it reads the link
// off the Group, so writing a link here is all it needs.

import { Types } from "mongoose";
import { Group } from "../models/group.model";
import { GroupAiTask } from "../models/groupAiTask.model";
import { mintUserToken, taskroomRequest } from "./taskroomProvision";
import { GroupTaskroomError } from "./groupTaskroom";
import { createManualTask, listGroupTasks, removeGroupTaskById } from "./groupTaskManual";
import {
  getSharedSupportBoard,
  resolveBoardAsOwner,
  type ResolvedBoard,
} from "./supportTicketTaskroom";

async function loadSupportGroup(groupId: string): Promise<any> {
  if (!Types.ObjectId.isValid(groupId)) throw new GroupTaskroomError(404, "Support chat not found");
  const g: any = await Group.findOne({ _id: groupId, kind: "support" })
    .select("name orgId kind taskroom")
    .lean();
  if (!g) throw new GroupTaskroomError(404, "Support chat not found");
  return g;
}

async function writeLink(groupId: string, board: ResolvedBoard, own: boolean): Promise<void> {
  await Group.updateOne(
    { _id: groupId, kind: "support" },
    {
      $set: {
        taskroom: {
          enabled: true,
          status: "active",
          mode: "existing-board",
          workspaceId: board.workspaceId,
          workspaceName: board.workspaceName,
          spaceId: board.spaceId,
          roomId: board.roomId,
          roomName: board.roomName,
          stageId: board.stageId,
          linkedBy: new Types.ObjectId(board.owner.userId),
          linkedAt: new Date(),
          actorOrgId: new Types.ObjectId(board.owner.orgId),
          members: [],
          lastError: null,
        },
        // A board an admin picked for this chat, vs the shared default.
        supportTaskroomOwn: own,
      },
    }
  );
}

export interface SupportChatTaskroomInfo {
  /** This chat has a board of its own (vs using the shared support board). */
  own: boolean;
  /** The board tasks from this chat go to, or null if none can be resolved. */
  board: {
    workspaceId: string;
    workspaceName: string | null;
    roomId: string;
    roomName: string | null;
  } | null;
}

export async function getSupportChatTaskroom(groupId: string): Promise<SupportChatTaskroomInfo> {
  const g: any = await Group.findOne({ _id: groupId, kind: "support" })
    .select("taskroom supportTaskroomOwn")
    .lean();
  if (!g) throw new GroupTaskroomError(404, "Support chat not found");
  if (g.supportTaskroomOwn && g.taskroom?.roomId) {
    return {
      own: true,
      board: {
        workspaceId: String(g.taskroom.workspaceId || ""),
        workspaceName: g.taskroom.workspaceName || null,
        roomId: String(g.taskroom.roomId),
        roomName: g.taskroom.roomName || null,
      },
    };
  }
  const shared = await getSharedSupportBoard();
  return {
    own: false,
    board: shared
      ? {
          workspaceId: shared.workspaceId,
          workspaceName: shared.workspaceName,
          roomId: shared.roomId,
          roomName: shared.roomName,
        }
      : null,
  };
}

/**
 * Make sure the chat's link points where it should before a write: its own
 * board when it has one, else the CURRENT shared board (which an admin may have
 * changed since the chat last filed a task).
 */
async function ensureLinked(groupId: string): Promise<void> {
  const g: any = await Group.findOne({ _id: groupId, kind: "support" })
    .select("taskroom supportTaskroomOwn")
    .lean();
  if (!g) throw new GroupTaskroomError(404, "Support chat not found");
  if (g.supportTaskroomOwn && g.taskroom?.roomId) return;
  const shared = await getSharedSupportBoard();
  if (!shared) {
    throw new GroupTaskroomError(502, "The support Taskroom board isn't available. Please try again.");
  }
  if (String(g.taskroom?.roomId || "") !== shared.roomId) {
    await writeLink(groupId, shared, false);
  }
}

/** Point one chat at its own board. */
export async function linkSupportChat(
  groupId: string,
  workspaceId: string,
  roomId: string
): Promise<SupportChatTaskroomInfo> {
  await loadSupportGroup(groupId);
  let board: ResolvedBoard;
  try {
    board = await resolveBoardAsOwner(workspaceId, roomId);
  } catch (e: any) {
    throw new GroupTaskroomError(400, e?.message || "Couldn't use that board");
  }
  await writeLink(groupId, board, true);
  return getSupportChatTaskroom(groupId);
}

/** Drop the chat's own board; it falls back to the shared support board. */
export async function unlinkSupportChat(groupId: string): Promise<SupportChatTaskroomInfo> {
  await loadSupportGroup(groupId);
  await Group.updateOne(
    { _id: groupId, kind: "support" },
    { $unset: { taskroom: 1, supportTaskroomOwn: 1 } }
  );
  return getSupportChatTaskroom(groupId);
}

export async function addSupportChatTask(input: {
  groupId: string;
  actorId: string;
  title: string;
  description?: string;
  priority?: string;
  attachments?: Array<{ fileUrl: string; fileName?: string; fileType?: string }>;
  /** The chat message the task was made from — the console marks it. */
  sourceMessageId?: string;
}) {
  await loadSupportGroup(input.groupId);
  await ensureLinked(input.groupId);
  const { sourceMessageId, ...rest } = input;
  // No assignees: support tasks are assigned by hand inside Taskroom.
  const result = await createManualTask({ ...rest, assigneeUserIds: [] });
  // Tie the task to its message. Kept on the GroupAiTask record only — never on
  // the GroupMessage, which the customer's app would render.
  if (sourceMessageId && Types.ObjectId.isValid(sourceMessageId)) {
    await GroupAiTask.updateOne(
      { groupId: new Types.ObjectId(input.groupId), taskroomTaskId: result.taskId },
      { $set: { sourceMessageIds: [new Types.ObjectId(sourceMessageId)] } }
    ).catch(() => {});
  }
  return result;
}

// ── Task notes for the console ─────────────────────────────────────────────
// The app shows "Task added to Taskroom" pills and open/copy-link buttons in
// the chat. In a support chat those are admin-only (the customer must not see
// internal tasks), so they are built from GroupAiTask rows and returned beside
// the messages instead of being written into the thread.

export interface SupportTaskMark {
  taskId: string;
  title: string;
  /** The message it was made from; null for tasks added from the panel. */
  sourceMessageId: string | null;
  createdAt: string;
  roomId: string;
  spaceId: string;
  workspaceId: string;
  /** Opens the task in Taskroom (my.garage.app). */
  link: string;
  /** People assigned from the console ("Assign to…"). */
  assignees: { userId: string; name: string }[];
}

/** Taskroom's own task share URL — the one its Share button produces. */
function taskUrl(t: {
  orgId: string;
  workspaceId: string;
  spaceId: string;
  roomId: string;
  taskId: string;
  title: string;
}): string {
  const params = new URLSearchParams();
  if (t.orgId) params.set("orgId", t.orgId);
  if (t.workspaceId) params.set("workspaceId", t.workspaceId);
  if (t.spaceId) params.set("spaceId", t.spaceId);
  if (t.roomId) params.set("roomId", t.roomId);
  params.set("shareTask", t.taskId);
  params.set("og", encodeURIComponent(JSON.stringify({ title: t.title || "Task" })));
  return `https://my.garage.app/taskroom/backOffice/athena?${params.toString()}`;
}

export async function listSupportTaskMarks(groupId: string): Promise<SupportTaskMark[]> {
  if (!Types.ObjectId.isValid(groupId)) return [];
  const g: any = await Group.findOne({ _id: groupId, kind: "support" })
    .select("taskroom")
    .lean();
  if (!g) return [];
  const aiRows: any[] = await GroupAiTask.find({ groupId: g._id })
    .sort({ createdAt: 1 })
    .select("taskroomTaskId title roomId sourceMessageIds createdAt")
    .lean();
  // Tickets raised from this chat are mirrored onto the support board too
  // (supportTicketTaskroom.ts) — they get the same note.
  const { Ticket } = await import("../models/ticket.model");
  const ticketRows: any[] = await Ticket.find({
    groupId: g._id,
    taskroomTaskId: { $nin: [null, ""] },
  })
    .select("taskroomTaskId taskroomRoomId title sourceMessageId createdAt")
    .lean();
  const seen = new Set(aiRows.map((r) => String(r.taskroomTaskId)));
  const rows: any[] = [
    ...aiRows,
    ...ticketRows
      .filter((t) => !seen.has(String(t.taskroomTaskId)))
      .map((t) => ({
        taskroomTaskId: t.taskroomTaskId,
        title: t.title,
        roomId: t.taskroomRoomId,
        sourceMessageIds: t.sourceMessageId ? [t.sourceMessageId] : [],
        createdAt: t.createdAt,
      })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (!rows.length) return [];

  // Space/workspace for a task's board: the chat's current link, else the
  // shared support board (a chat may have moved boards since).
  const shared = await getSharedSupportBoard().catch(() => null);
  const where = (roomId: string) => {
    if (g.taskroom?.roomId && String(g.taskroom.roomId) === roomId) {
      return {
        spaceId: String(g.taskroom.spaceId || ""),
        workspaceId: String(g.taskroom.workspaceId || ""),
        orgId: String(g.taskroom.actorOrgId || shared?.owner.orgId || ""),
      };
    }
    if (shared && shared.roomId === roomId) {
      return { spaceId: shared.spaceId, workspaceId: shared.workspaceId, orgId: shared.owner.orgId };
    }
    return { spaceId: "", workspaceId: "", orgId: String(g.taskroom?.actorOrgId || "") };
  };

  const { SupportTaskAssignment } = await import("../models/supportTaskAssignment.model");
  const assigned: any[] = await SupportTaskAssignment.find({ groupId: g._id })
    .sort({ createdAt: 1 })
    .lean();
  const assigneesOf = (taskId: string) =>
    assigned
      .filter((a) => a.taskId === taskId)
      .map((a) => ({ userId: String(a.userId), name: String(a.name) }));

  return rows.map((r) => {
    const roomId = String(r.roomId || "");
    const w = where(roomId);
    const taskId = String(r.taskroomTaskId);
    const title = String(r.title || "Task");
    return {
      taskId,
      title,
      sourceMessageId: r.sourceMessageIds?.[0] ? String(r.sourceMessageIds[0]) : null,
      createdAt: new Date(r.createdAt).toISOString(),
      roomId,
      spaceId: w.spaceId,
      workspaceId: w.workspaceId,
      link: taskUrl({ ...w, roomId, taskId, title }),
      assignees: assigneesOf(taskId),
    };
  });
}

// ── Assign / remove (the app chat's "Assign to…" and "Remove from Taskroom") ─
// Both act as the support board owner, so they work for every support task —
// "Add to Taskroom" cards and mirrored tickets alike.

async function ownerTokenFor(groupId: string): Promise<{ token: string; orgId: string }> {
  const g: any = await Group.findOne({ _id: groupId, kind: "support" })
    .select("taskroom")
    .lean();
  let userId = g?.taskroom?.linkedBy ? String(g.taskroom.linkedBy) : "";
  let orgId = g?.taskroom?.actorOrgId ? String(g.taskroom.actorOrgId) : "";
  if (!userId || !orgId) {
    const shared = await getSharedSupportBoard();
    if (!shared) throw new GroupTaskroomError(502, "The support Taskroom board isn't available");
    userId = shared.owner.userId;
    orgId = shared.owner.orgId;
  }
  return { token: await mintUserToken(userId, orgId), orgId };
}

/**
 * Assign a support task to one of the chat's support staff. Only staff can be
 * picked — never the customer or their upline. The person is put on the board
 * first (Taskroom rejects assigning a non-member), then added to the card
 * without dropping anyone already on it.
 */
export async function assignSupportTask(input: {
  groupId: string;
  taskId: string;
  userId: string;
  assignedBy: string;
}): Promise<SupportTaskMark> {
  const g: any = await Group.findOne({ _id: input.groupId, kind: "support" })
    .select("members supportUserId supportUplineId")
    .lean();
  if (!g) throw new GroupTaskroomError(404, "Support chat not found");
  const staff = (g.members || []).find(
    (m: any) =>
      String(m.userId) === input.userId &&
      m.role === "admin" &&
      String(m.userId) !== String(g.supportUserId || "")
  );
  if (!staff) throw new GroupTaskroomError(400, "Only support staff in this chat can be assigned");

  const mark = (await listSupportTaskMarks(input.groupId)).find((m) => m.taskId === input.taskId);
  if (!mark) throw new GroupTaskroomError(404, "Task not found");
  if (!mark.spaceId || !mark.workspaceId) {
    throw new GroupTaskroomError(409, "That task's board can't be found any more");
  }

  const { User } = await import("../models/user.model");
  const person: any = await User.findById(input.userId).select("name email profilePicture").lean();
  if (!person?.email) throw new GroupTaskroomError(400, "That person has no email address on file");

  const { token, orgId } = await ownerTokenFor(input.groupId);
  const { ensureRoomMembership } = await import("./taskroomProvision");
  let taskroomUserId: string;
  try {
    taskroomUserId = await ensureRoomMembership(token, {
      orgId,
      workspaceId: mark.workspaceId,
      spaceId: mark.spaceId,
      roomId: mark.roomId,
      person: {
        userId: input.userId,
        email: person.email,
        name: person.name || person.email,
        image: person.profilePicture || undefined,
      },
      role: "member",
    });
  } catch (e: any) {
    throw new GroupTaskroomError(502, `Couldn't add ${person.name || person.email} to the board: ${e?.message || e}`);
  }

  let task: any;
  try {
    task = await taskroomRequest<any>(`tasks/${input.taskId}`, { token });
  } catch {
    throw new GroupTaskroomError(404, "That task no longer exists in Taskroom");
  }
  if (!task?._id || task.status === "inactive") {
    throw new GroupTaskroomError(404, "That task no longer exists in Taskroom");
  }
  // PUT tasks/:id replaces assignedToIds wholesale — append, never drop.
  const current = ((task.assignedToIds || []) as any[])
    .map((a) => String(a?._id ?? a ?? ""))
    .filter(Boolean);
  if (!current.includes(taskroomUserId)) {
    await taskroomRequest(`tasks/${input.taskId}`, {
      method: "PUT",
      token,
      body: { assignedToIds: [...current, taskroomUserId] },
    });
  }

  const { SupportTaskAssignment } = await import("../models/supportTaskAssignment.model");
  await SupportTaskAssignment.updateOne(
    { groupId: g._id, taskId: input.taskId, userId: new Types.ObjectId(input.userId) },
    { $setOnInsert: { name: person.name || person.email, assignedBy: input.assignedBy } },
    { upsert: true }
  );
  const fresh = (await listSupportTaskMarks(input.groupId)).find((m) => m.taskId === input.taskId);
  return fresh || mark;
}

/** Delete a support task from Taskroom — either kind — and forget it. */
export async function removeSupportTask(input: {
  groupId: string;
  taskId: string;
  actorId: string;
}): Promise<void> {
  const g: any = await Group.findOne({ _id: input.groupId, kind: "support" }).select("_id").lean();
  if (!g) throw new GroupTaskroomError(404, "Support chat not found");

  const ai = await GroupAiTask.exists({ groupId: g._id, taskroomTaskId: input.taskId });
  if (ai) {
    const r = await removeGroupTaskById({
      groupId: input.groupId,
      actorId: input.actorId,
      taskId: input.taskId,
      isAdmin: true,
    });
    if (!r.found) throw new GroupTaskroomError(404, "Task not found");
  } else {
    const { Ticket } = await import("../models/ticket.model");
    const ticket: any = await Ticket.findOne({ groupId: g._id, taskroomTaskId: input.taskId })
      .select("_id")
      .lean();
    if (!ticket) throw new GroupTaskroomError(404, "Task not found");
    const { token } = await ownerTokenFor(input.groupId);
    await taskroomRequest(`tasks/${input.taskId}`, { method: "DELETE", token }).catch((e: any) => {
      if (!/couldn'?t find|not found|no record/i.test(String(e?.message || e))) throw e;
    });
    // The ticket stays; only its Taskroom card goes.
    await Ticket.updateOne(
      { _id: ticket._id },
      { $set: { taskroomTaskId: null, taskroomRoomId: null } }
    );
  }
  const { SupportTaskAssignment } = await import("../models/supportTaskAssignment.model");
  await SupportTaskAssignment.deleteMany({ groupId: g._id, taskId: input.taskId });
}

/** Short share link (Taskroom's short-URL service), else the long one. */
export async function shortTaskLink(groupId: string, taskId: string): Promise<string> {
  const mark = (await listSupportTaskMarks(groupId)).find((m) => m.taskId === taskId);
  if (!mark) throw new GroupTaskroomError(404, "Task not found");
  try {
    const shared = await getSharedSupportBoard();
    if (!shared) return mark.link;
    const token = await mintUserToken(shared.owner.userId, shared.owner.orgId);
    const res: any = await taskroomRequest("short/urls", {
      method: "POST",
      token,
      body: { longurl: mark.link, og: { title: mark.title } },
    });
    // The service answers with the stored record; the short link is its id on
    // the web app's resolver page (app/taskroom/backOffice/athena/short/[id]).
    const explicit = res?.shortUrl || res?.shortURL || res?.url;
    if (explicit) return explicit;
    return res?._id ? `https://my.garage.app/taskroom/backOffice/athena/short/${res._id}` : mark.link;
  } catch {
    return mark.link;
  }
}

export async function listSupportChatTasks(groupId: string, actorId: string) {
  await loadSupportGroup(groupId);
  await ensureLinked(groupId);
  return listGroupTasks({ groupId, actorId, scope: "group" });
}

export async function removeSupportChatTask(groupId: string, actorId: string, taskId: string) {
  await loadSupportGroup(groupId);
  return removeGroupTaskById({ groupId, actorId, taskId, isAdmin: true });
}
