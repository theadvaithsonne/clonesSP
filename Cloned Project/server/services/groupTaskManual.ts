// src/services/groupTaskManual.ts
//
// Tasks a member adds to a linked board BY HAND, and the read/remove surface
// that goes with them.
//
// This is the deliberate counterpart to services/groupTaskAuto.ts: the AI path
// watches chat and decides what becomes a task; here a person names the task
// outright. So there is no chat message and no classifier — the task is filed
// straight onto the board, a "… added a task to Taskroom" pill is written, and
// a GroupAiTask row records it exactly as an AI capture would (so removal,
// listing and the per-board scoping all work unchanged) with `source:"manual"`
// and a synthetic `messageId` that points at no real message. That synthetic id
// keeps the unique {messageId,itemIndex} guard satisfied with zero migration,
// and means the message delete/edit hooks — which look tasks up by a real
// message id — simply never match a manual row.
//
// Everything Taskroom is reached through the same actor/token machinery the AI
// path uses (withTaskroomActor + the create/attach helpers exported from
// groupTaskAuto.ts), so a manual task is indistinguishable on the board from a
// captured one, and the SSRF allowlist for attachments lives in one place.

import { Types } from "mongoose";
import { Group } from "../models/group.model";
import { GroupAiTask } from "../models/groupAiTask.model";
import { User } from "../models/user.model";
import { taskroomRequest } from "./taskroomProvision";
import { NoTaskroomActorError, withTaskroomActor } from "./groupTaskroomActor";
import { GroupTaskroomError } from "./groupTaskroom";
import { writeGroupSystemMessage } from "./groupSystemMessage";
import { removeGroupTasks } from "./groupTaskRemoval";
import {
  BoardGoneError,
  assignTask,
  attachFiles,
  createTaskOnBoard,
  isTrustedFileUrl,
} from "./groupTaskAuto";

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];

/** Clip a title to what Taskroom (and a card) can sensibly show. */
const TITLE_MAX = 200;

export type TaskScope = "group" | "mine";

export interface ManualTaskPerson {
  userId: string;
  name: string;
}

export interface CreateManualTaskInput {
  groupId: string;
  actorId: string;
  title: string;
  description?: string;
  priority?: string;
  /** Garage user ids to assign — only those already synced to the board land. */
  assigneeUserIds?: string[];
  attachments?: Array<{ fileUrl: string; fileName?: string; fileType?: string }>;
}

export interface CreateManualTaskResult {
  taskId: string;
  roomId: string;
  spaceId: string;
  workspaceId: string;
  title: string;
  priority: Priority;
  assignees: ManualTaskPerson[];
  /** Requested assignees not on the board yet (member sync hasn't reached them). */
  notAssigned: ManualTaskPerson[];
  attachmentCount: number;
}

export interface GroupTaskListItem {
  taskId: string;
  title: string;
  priority: string;
  stageName?: string;
  stageColor?: string;
  isCompleted: boolean;
  status: string;
  assignees: ManualTaskPerson[];
  reporterName: string;
  source: string;
  dueDate?: unknown;
  createdAt?: unknown;
  roomId: string;
  spaceId: string;
  workspaceId: string;
}

export interface ListGroupTasksResult {
  board: {
    roomId: string;
    spaceId: string;
    workspaceId: string;
    roomName: string | null;
  };
  /** false when the board couldn't be reached and the rows came from our cache. */
  live: boolean;
  counts: { group: number; mine: number };
  tasks: GroupTaskListItem[];
}

interface ManualFile {
  link: string;
  name: string;
  fileType: "image" | "video" | "document";
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Same select for all three entry points, so they see the same shape. */
async function loadGroup(groupId: string): Promise<any | null> {
  if (!Types.ObjectId.isValid(groupId)) return null;
  return Group.findById(groupId)
    .select("name orgId kind members createdBy taskroom")
    .lean();
}

/**
 * The live board this group is allowed to write to, or a typed rejection the
 * route turns into a status. A missing/disabled/broken link is the caller's to
 * fix (relink, re-enable), not ours to paper over.
 */
function assertLinked(group: any): any {
  if (!group) throw new GroupTaskroomError(404, "Group not found");
  const link = group.taskroom;
  if (!link?.roomId) {
    throw new GroupTaskroomError(404, "This group isn't linked to Taskroom");
  }
  if (link.enabled === false) {
    throw new GroupTaskroomError(409, "Taskroom is turned off for this group");
  }
  if (link.status === "broken") {
    throw new GroupTaskroomError(
      409,
      "The Taskroom link is broken. An admin needs to relink the board."
    );
  }
  return link;
}

function normalizePriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : "normal";
}

/** Taskroom's list routes answer with a bare array or `{ data: [...] }`. */
function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

/** A Taskroom `assignedToIds` entry is sometimes the id, sometimes `{_id}`. */
function assignedIds(task: any): string[] {
  return asArray(task?.assignedToIds)
    .map((a) => String(a?._id ?? a ?? ""))
    .filter(Boolean);
}

/**
 * Garage user id → best display name (name, else the email's local part), in
 * one lookup. Unknown ids and users with neither are absent/empty — the caller
 * applies its own fallback ("Member" for a listed person, "Someone" for an
 * actor).
 */
async function namesFor(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id) => id && Types.ObjectId.isValid(id)))];
  if (!ids.length) return new Map();
  const users = await User.find({ _id: { $in: ids } })
    .select("name email")
    .lean();
  return new Map(
    (users as any[]).map((u) => [String(u._id), u.name || u.email?.split("@")[0] || ""])
  );
}

/** Trusted attachments only, shaped for POST attachments/bulk. */
function toTaskroomFiles(
  attachments: CreateManualTaskInput["attachments"]
): ManualFile[] {
  const files: ManualFile[] = [];
  for (const a of attachments || []) {
    // Same guard the AI path uses: attachment URLs come from the client, so
    // only our own uploads are ever handed to Taskroom (see groupTaskAuto.ts).
    if (!a?.fileUrl || !isTrustedFileUrl(a.fileUrl)) continue;
    const type = String(a.fileType || "").toLowerCase();
    files.push({
      link: a.fileUrl,
      name: a.fileName || String(a.fileUrl).split("/").pop() || "attachment",
      fileType: type.startsWith("image/")
        ? "image"
        : type.startsWith("video/")
          ? "video"
          : "document",
    });
  }
  return files;
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createManualTask(
  input: CreateManualTaskInput
): Promise<CreateManualTaskResult> {
  const group = await loadGroup(input.groupId);
  const link = assertLinked(group);

  const title = String(input.title || "").trim().slice(0, TITLE_MAX);
  if (!title) throw new GroupTaskroomError(400, "A task needs a title");
  const priority = normalizePriority(input.priority);

  // Only members the sync has put on the board can be assigned — Taskroom
  // rejects an assignment to a non-member. Anyone else is reported back as
  // `notAssigned` so the caller can say why.
  const requested = [...new Set((input.assigneeUserIds || []).map(String))];
  const syncedTaskroomId = new Map<string, string>();
  for (const m of link.members || []) {
    if (m?.status === "synced" && m?.taskroomUserId) {
      syncedTaskroomId.set(String(m.userId), String(m.taskroomUserId));
    }
  }

  const nameById = await namesFor([input.actorId, ...requested]);
  const nameOf = (userId: string) => nameById.get(userId) || "Member";

  const assignees: ManualTaskPerson[] = [];
  const notAssigned: ManualTaskPerson[] = [];
  const assignedToIds: string[] = [];
  for (const userId of requested) {
    const taskroomUserId = syncedTaskroomId.get(userId);
    if (taskroomUserId) {
      assignedToIds.push(taskroomUserId);
      assignees.push({ userId, name: nameOf(userId) });
    } else {
      notAssigned.push({ userId, name: nameOf(userId) });
    }
  }

  const files = toTaskroomFiles(input.attachments);
  const groupName = group.name || "Group chat";
  const actorName = nameById.get(input.actorId) || "Someone";
  const description = buildDescription(input.description, actorName, groupName);

  // Create the card. createTaskOnBoard repairs a missing/stale stageId and
  // retries once on its own; a board that is gone, or that nobody in the group
  // can act on, surfaces as a typed error the route maps to a status.
  let task: any;
  try {
    ({ result: task } = await withTaskroomActor(
      group,
      (token) =>
        createTaskOnBoard(token, group, {
          roomId: link.roomId,
          stageId: link.stageId,
          title,
          description,
          priority,
          assignedToIds,
        }),
      input.actorId
    ));
  } catch (e) {
    if (e instanceof BoardGoneError) {
      throw new GroupTaskroomError(
        409,
        "The linked Taskroom board is no longer available. An admin needs to relink it."
      );
    }
    if (e instanceof NoTaskroomActorError) {
      throw new GroupTaskroomError(
        502,
        "Nobody in this group can reach the linked Taskroom board right now. Please try again."
      );
    }
    console.error(
      `[group-task-manual] group=${group._id} task create failed:`,
      e instanceof Error ? e.message : e
    );
    throw new GroupTaskroomError(502, "Couldn't add the task to Taskroom. Please try again.");
  }

  const taskId = task?._id ? String(task._id) : "";
  if (!taskId) {
    throw new GroupTaskroomError(502, "Taskroom didn't return the new task. Please try again.");
  }

  // attachFiles never throws — a card with no files is the lesser loss than a
  // failed create, so we report whatever landed and carry on.
  const attachmentCount = files.length
    ? await attachFiles(group, String(link.roomId), taskId, files, input.actorId)
    : 0;

  // Record it like an AI capture so listing/removal treat it identically. The
  // synthetic messageId keeps the unique {messageId,itemIndex} index happy; a
  // failed record must not fail a call whose task already exists on the board.
  try {
    await GroupAiTask.create({
      groupId: group._id,
      orgId: group.orgId,
      messageId: new Types.ObjectId(),
      itemIndex: 0,
      sourceMessageIds: [],
      fromUserId: input.actorId,
      taskroomTaskId: taskId,
      roomId: link.roomId,
      priority,
      title,
      attachmentCount,
      source: "manual",
      confidence: 1,
    });
  } catch (e: any) {
    console.warn(
      `[group-task-manual] group=${group._id} task=${taskId} record failed:`,
      e?.message || e
    );
  }

  void writeGroupSystemMessage({
    groupId: group._id,
    event: "manual_task_created",
    actorId: input.actorId,
    meta: { taskTitle: title },
    taskroom: {
      taskId,
      roomId: String(link.roomId),
      spaceId: link.spaceId,
      workspaceId: link.workspaceId,
      title,
    },
  });

  return {
    taskId,
    roomId: String(link.roomId),
    spaceId: String(link.spaceId || ""),
    workspaceId: String(link.workspaceId || ""),
    title,
    priority,
    assignees,
    notAssigned,
    attachmentCount,
  };
}

/** The footer that says where the task came from — no "original message" line. */
function buildDescription(
  description: string | undefined,
  actorName: string,
  groupName: string
): string {
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const footer = `Added by ${actorName} in the "${groupName}" group chat · ${date}`;
  const body = (description || "").trim();
  return body ? `${body}\n\n${footer}` : footer;
}

// ── List ──────────────────────────────────────────────────────────────────

export async function listGroupTasks(input: {
  groupId: string;
  actorId: string;
  scope?: TaskScope;
}): Promise<ListGroupTasksResult> {
  const scope: TaskScope = input.scope === "mine" ? "mine" : "group";
  const group = await loadGroup(input.groupId);
  const link = assertLinked(group);

  const roomId = String(link.roomId);
  const spaceId = String(link.spaceId || "");
  const workspaceId = String(link.workspaceId || "");
  const board = { roomId, spaceId, workspaceId, roomName: link.roomName || null };

  // This board's rows only: after a relink, old-board rows belong to another
  // board and must not scope this one.
  const rows: any[] = await GroupAiTask.find({ groupId: group._id, roomId })
    .sort({ createdAt: -1 })
    .lean();
  const rowByTaskId = new Map<string, any>();
  for (const r of rows) {
    const id = String(r.taskroomTaskId);
    if (!rowByTaskId.has(id)) rowByTaskId.set(id, r);
  }

  // Board user id → Garage user id, and my own board id (for the "mine" count).
  const userIdByTaskroomId = new Map<string, string>();
  let myTaskroomId: string | null = null;
  for (const m of link.members || []) {
    if (!m?.taskroomUserId) continue;
    userIdByTaskroomId.set(String(m.taskroomUserId), String(m.userId));
    if (String(m.userId) === String(input.actorId)) {
      myTaskroomId = String(m.taskroomUserId);
    }
  }

  // Live board read: the active tasks and the columns, as one actor.
  let liveTasks: any[] | null = null;
  const stageById = new Map<string, { name?: string; color?: string }>();
  try {
    const { result } = await withTaskroomActor(
      group,
      async (token) => {
        const tasks = await taskroomRequest<any>(
          `tasks?roomId=${roomId}&status=active`,
          { token }
        );
        const stages = await taskroomRequest<any>(`stages/room/${roomId}`, { token });
        return { tasks, stages };
      },
      input.actorId
    );
    liveTasks = asArray(result.tasks);
    for (const s of asArray(result.stages)) {
      if (s?._id) stageById.set(String(s._id), { name: s.name, color: s.color });
    }
  } catch (e) {
    // Nobody can act, or the board is gone: fall back to the cache rather than
    // failing the whole list. Best effort — never throws from here.
    console.warn(
      `[group-task-manual] group=${group._id} live task read failed, using cache:`,
      e instanceof Error ? e.message : e
    );
  }

  if (liveTasks === null) {
    const reporterNames = await namesFor(rows.map((r) => String(r.fromUserId)));
    const tasks: GroupTaskListItem[] = rows.map((r) => ({
      taskId: String(r.taskroomTaskId),
      title: String(r.title || ""),
      priority: String(r.priority || "normal"),
      stageName: undefined,
      stageColor: undefined,
      isCompleted: false,
      status: "active",
      assignees: [],
      reporterName: reporterNames.get(String(r.fromUserId)) || "Member",
      source: String(r.source || "ai"),
      dueDate: null,
      createdAt: r.createdAt ?? null,
      roomId,
      spaceId,
      workspaceId,
    }));
    // Without the board we can't know who a task is assigned to, so "mine" is
    // empty; the group count is what we have on record.
    return {
      board,
      live: false,
      counts: { group: tasks.length, mine: 0 },
      tasks: scope === "mine" ? [] : tasks,
    };
  }

  // Keep only tasks this group filed — scopes a board shared with other groups.
  const groupTasks = liveTasks.filter((t) => rowByTaskId.has(String(t._id)));

  const nameLookupIds = new Set<string>();
  for (const t of groupTasks) {
    for (const trId of assignedIds(t)) {
      const uid = userIdByTaskroomId.get(trId);
      if (uid) nameLookupIds.add(uid);
    }
    const row = rowByTaskId.get(String(t._id));
    if (row?.fromUserId) nameLookupIds.add(String(row.fromUserId));
  }
  const nameById = await namesFor([...nameLookupIds]);

  interface Built extends GroupTaskListItem {
    _sortAt: number;
    _completed: boolean;
    _mine: boolean;
  }
  const built: Built[] = groupTasks.map((t) => {
    const row = rowByTaskId.get(String(t._id));
    const trIds = assignedIds(t);
    const assignees: ManualTaskPerson[] = trIds.map((trId) => {
      const uid = userIdByTaskroomId.get(trId);
      // Someone assigned in Taskroom directly (not through the chat) resolves to
      // nobody we know — shown as a plain "Member".
      return uid
        ? { userId: uid, name: nameById.get(uid) || "Member" }
        : { userId: "", name: "Member" };
    });
    const isCompleted = !!t.isCompleted;
    const createdAt = row?.createdAt ?? t.createdAt ?? null;
    const stage = t.stageId ? stageById.get(String(t.stageId)) : undefined;
    return {
      taskId: String(t._id),
      title: String(t.title || row?.title || ""),
      priority: PRIORITIES.includes(t.priority)
        ? t.priority
        : String(row?.priority || "normal"),
      stageName: stage?.name,
      stageColor: stage?.color,
      isCompleted,
      status: String(t.status || "active"),
      assignees,
      reporterName: row?.fromUserId
        ? nameById.get(String(row.fromUserId)) || "Member"
        : "Member",
      source: String(row?.source || "ai"),
      dueDate: t.dueDate ?? null,
      createdAt,
      roomId,
      spaceId,
      workspaceId,
      _sortAt: createdAt ? new Date(createdAt).getTime() : 0,
      _completed: isCompleted,
      _mine: !!myTaskroomId && trIds.includes(myTaskroomId),
    };
  });

  const counts = {
    group: built.length,
    mine: built.filter((b) => b._mine).length,
  };

  const visible = (scope === "mine" ? built.filter((b) => b._mine) : built).sort(
    (a, b) => {
      // Open work first, then newest first.
      if (a._completed !== b._completed) return a._completed ? 1 : -1;
      return b._sortAt - a._sortAt;
    }
  );

  const tasks: GroupTaskListItem[] = visible.map(
    ({ _sortAt, _completed, _mine, ...rest }) => rest
  );

  return { board, live: true, counts, tasks };
}

// ── Remove ──────────────────────────────────────────────────────────────

export async function removeGroupTaskById(input: {
  groupId: string;
  actorId: string;
  taskId: string;
  isAdmin: boolean;
}): Promise<{ removed: number; found: number; forbidden?: boolean }> {
  if (!Types.ObjectId.isValid(input.groupId)) return { removed: 0, found: 0 };

  const doc: any = await GroupAiTask.findOne({
    groupId: new Types.ObjectId(input.groupId),
    taskroomTaskId: input.taskId,
  }).lean();
  if (!doc) return { removed: 0, found: 0 };

  // Same rule as the message-level "Remove from Taskroom": an admin, or the
  // person who filed it.
  if (!input.isAdmin && String(doc.fromUserId) !== String(input.actorId)) {
    return { removed: 0, found: 1, forbidden: true };
  }

  // No link-state gate here: a task must be removable even after the board was
  // unlinked or the link went broken. removeGroupTasks handles the unlinked
  // case with the actor's own token.
  const group = await loadGroup(input.groupId);
  if (!group?.orgId) return { removed: 0, found: 1 };

  const { removed } = await removeGroupTasks(input.groupId, group, [doc], input.actorId);
  return { removed, found: 1 };
}

// ── Assign ──────────────────────────────────────────────────────────────

export interface AssignGroupTaskResult {
  /** Newly added to the card — one pill written per person here. */
  assigned: ManualTaskPerson[];
  /** Already on the card; nothing changed, so no pill. */
  already: ManualTaskPerson[];
  /** Requested but not on the board yet (member sync hasn't reached them). */
  notAssigned: ManualTaskPerson[];
  /** On the board but the append didn't land (Taskroom error, or task gone). */
  failed: ManualTaskPerson[];
}

/**
 * Add one or more Garage members to a task the group already filed.
 *
 * Mirrors the AI path's per-assignee append (groupTaskAuto.assignTask): Taskroom
 * has no atomic "add assignee", so each person is read-appended in turn and
 * someone already on the card is reported back rather than re-added. A single
 * failed append never sinks the others — every requested id lands in exactly one
 * of the four buckets.
 *
 * Only members the sync has put on the board can be assigned; anyone else comes
 * back as `notAssigned` (as with a manual create) instead of failing the call.
 */
export async function assignGroupTask(input: {
  groupId: string;
  actorId: string;
  taskId: string;
  assigneeUserIds: string[];
}): Promise<AssignGroupTaskResult> {
  const group = await loadGroup(input.groupId);
  const link = assertLinked(group);

  // The task must be one THIS group filed — a raw Taskroom id from another group
  // (or another board after a relink) is not ours to touch. The row also gives
  // the title and roomId the pill points at.
  const doc: any = await GroupAiTask.findOne({
    groupId: new Types.ObjectId(input.groupId),
    taskroomTaskId: input.taskId,
  }).lean();
  if (!doc) {
    throw new GroupTaskroomError(404, "That task isn't tracked in this group");
  }

  // Only synced members can be assigned — Taskroom rejects an assignment to a
  // non-member (same rule as createManualTask).
  const requested = [...new Set((input.assigneeUserIds || []).map(String))];
  const syncedTaskroomId = new Map<string, string>();
  for (const m of link.members || []) {
    if (m?.status === "synced" && m?.taskroomUserId) {
      syncedTaskroomId.set(String(m.userId), String(m.taskroomUserId));
    }
  }

  const nameById = await namesFor(requested);
  const nameOf = (userId: string) => nameById.get(userId) || "Member";

  const title = String(doc.title || "");
  // Where each pill points — spaceId/workspaceId are board-wide, so they come
  // from the link; roomId prefers the task's own row.
  const taskroom = {
    taskId: input.taskId,
    roomId: String(doc.roomId || link.roomId),
    spaceId: link.spaceId,
    workspaceId: link.workspaceId,
    title,
  };

  const result: AssignGroupTaskResult = {
    assigned: [],
    already: [],
    notAssigned: [],
    failed: [],
  };

  for (const userId of requested) {
    const person: ManualTaskPerson = { userId, name: nameOf(userId) };
    const taskroomUserId = syncedTaskroomId.get(userId);
    if (!taskroomUserId) {
      result.notAssigned.push(person);
      continue;
    }
    // assignTask maps every failure (including a task deleted on the board:
    // "gone") to an outcome and never throws.
    const outcome = await assignTask(group, input.taskId, taskroomUserId, input.actorId);
    if (outcome === "assigned") {
      result.assigned.push(person);
      // One pill per newly-added person, exactly as the AI assign path does.
      // Never for "already": nothing changed on the board to announce.
      void writeGroupSystemMessage({
        groupId: group._id,
        event: "ai_task_assigned",
        actorId: input.actorId,
        meta: { taskTitle: title, assigneeName: person.name },
        taskroom,
      });
    } else if (outcome === "already") {
      result.already.push(person);
    } else {
      // "failed" or "gone" — nothing landed for this person.
      result.failed.push(person);
    }
  }

  return result;
}
