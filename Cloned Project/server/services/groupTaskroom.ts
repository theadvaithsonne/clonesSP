// src/services/groupTaskroom.ts
//
// Links a group chat to a Taskroom board and keeps the board's membership in
// step with the group's.
//
// Design constraints this file exists to satisfy:
//
//  1. Taskroom v2 is a separate service we do not own (see taskroomProvision.ts).
//     Every call below is one the Taskroom UI already makes, with the same
//     payload shape, so a linked board is indistinguishable from a hand-made one.
//
//  2. The group decides who belongs on the board, but a linked board may have
//     had members of its own. The sync therefore only ever REMOVES people it
//     added itself (`taskroom.members[].addedBySync`), and never the admin who
//     linked it — whoever was on an existing board keeps their access whatever
//     happens in the chat.
//
//  3. Member sync is a reconcile, not a replay of events: every run re-reads
//     the group and the board and closes the gap between them, so a missed or
//     failed run is repaired by the next one. Runs for a group are serialised
//     in-process, and requests that arrive mid-run buy exactly one more run.
//
//  4. Background work never throws and never `save()`s a whole group — the
//     routes write the same document concurrently. Results land with targeted
//     `$set`s guarded on `taskroom.roomId`, so a run that finishes after the
//     group was relinked or unlinked writes nothing.

import { Types } from "mongoose";
import { Group } from "../models/group.model";
import { User } from "../models/user.model";
import {
  mintUserToken,
  taskroomRequest,
  type TaskroomRole,
} from "./taskroomProvision";
import {
  NoTaskroomActorError,
  isTaskroomUnauthorized,
  withTaskroomActor,
} from "./groupTaskroomActor";
import { writeGroupSystemMessage } from "./groupSystemMessage";
import { isSupportGroup } from "./supportChat";

// Same teal every other object we provision in Taskroom uses.
const BOARD_COLOR = "#008080";

// Boards created for group chats are filed under this space, created on first
// use in each workspace.
const GROUP_CHATS_SPACE_NAME = "Group Chats";

// Everyone the sync adds joins as a plain member. The admin who linked the
// board is already its owner — Taskroom makes whoever creates a board its admin.
const MEMBER_ROLE: TaskroomRole = "member";

// Member lists are paged on Taskroom's side; they are read to the end.
const LIST_PAGE_SIZE = 500;
const USER_PAGE_SIZE = 1000;
const MAX_LIST_PAGES = 20;

export const TASKROOM_ACCOUNT_MISSING_MESSAGE =
  "Open Taskroom once to set up your account, then try again";
const NO_EMAIL_MESSAGE = "No email address on file";
const NO_ACTOR_MESSAGE =
  "Nobody in this group can reach the linked Taskroom board. An admin with Taskroom access needs to link it again.";
const BOARD_GONE_MESSAGE =
  "The linked Taskroom board was deleted. Link another board to keep capturing tasks.";

export type GroupTaskroomLinkMode =
  | "new-workspace"
  | "new-board"
  | "existing-board";

/** The `taskroom` block of GET /groups/:groupId. */
export interface GroupTaskroomSummary {
  enabled: boolean;
  status: "active" | "broken";
  mode: GroupTaskroomLinkMode;
  workspaceId: string;
  workspaceName: string | null;
  spaceId: string;
  roomId: string;
  roomName: string | null;
  linkedBy: string;
  linkedByName: string | null;
  linkedAt: string;
  lastError: string | null;
  memberSync: {
    /** A sync is running, or queued, in this process. */
    running: boolean;
    /** Current group members the board has. */
    synced: number;
    /** Current group members the sync could not put on the board. */
    failed: number;
    lastSyncAt: string | null;
    failures: { userId: string; name: string; error: string }[];
  };
}

/** One row of `Group.taskroom.members`, ids as strings. */
export interface GroupTaskroomMemberEntry {
  userId: string;
  /** tr2_user id — Taskroom's own user record, not the Garage user id. */
  taskroomUserId: string | null;
  addedBySync: boolean;
  status: "synced" | "failed";
  error: string | null;
  syncedAt?: Date;
}

/**
 * A link request that could not be carried out, with the status the route
 * answers with. The message is written for the admin and shown as-is.
 */
export class GroupTaskroomError extends Error {
  readonly status: 400 | 404 | 409 | 502;

  constructor(status: 400 | 404 | 409 | 502, message: string) {
    super(message);
    this.name = "GroupTaskroomError";
    this.status = status;
  }
}

/** The linked board was deleted in Taskroom (or never existed). */
class BoardGoneError extends Error {
  constructor() {
    super(BOARD_GONE_MESSAGE);
    this.name = "BoardGoneError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

/** Taskroom's list routes answer with a bare array or `{ data: [...] }`. */
function asList(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

/** Taskroom answers a missing record with a 400 "Couldn't find the …". */
function isTaskroomNotFound(error: unknown): boolean {
  return /couldn'?t find/i.test(errorMessage(error));
}

/**
 * A `search=` value for Taskroom's member lists. The search is a regex over
 * name and email, so `+` and `.` in an address would change its meaning;
 * membership is confirmed by id afterwards rather than by the hit alone.
 */
function searchFor(email: string): string {
  return encodeURIComponent(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

function displayName(user: any): string {
  return user?.name || user?.email?.split("@")[0] || "Member";
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function idsOf(rows: any[]): Set<string> {
  return new Set(rows.map((row) => String(row?.userId)));
}

/** Read a paged Taskroom list to the end. */
async function listPages(
  path: string,
  token: string,
  pageSize = LIST_PAGE_SIZE,
  maxPages = MAX_LIST_PAGES
): Promise<any[]> {
  const rows: any[] = [];
  const joiner = path.includes("?") ? "&" : "?";
  for (let page = 1; page <= maxPages; page++) {
    const batch = asList(
      await taskroomRequest(`${path}${joiner}size=${pageSize}&page=${page}`, {
        token,
      })
    );
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

/** Every active Taskroom account in the org. */
function listTaskroomUsers(token: string, orgId: string): Promise<any[]> {
  return listPages(
    `users?orgId=${encodeURIComponent(orgId)}`,
    token,
    USER_PAGE_SIZE,
    10
  );
}

/**
 * A board, or null when Taskroom has no live board by that id. `rooms/:id`
 * does not filter on status: a deleted board comes back as `inactive` rather
 * than as a miss.
 */
async function readRoom(token: string, roomId: string): Promise<any | null> {
  try {
    const room = await taskroomRequest<any>(`rooms/${roomId}`, { token });
    return room?._id && room.status !== "inactive" ? room : null;
  } catch (error) {
    if (isTaskroomNotFound(error)) return null;
    throw error;
  }
}

// ── Pure helpers (unit-tested in __tests__/groupTaskroom.test.ts) ──────────

/**
 * The column new tasks land in: the board's first "tostart" column (Backlog on
 * a fresh board), else its first column. Taskroom seeds every default column
 * with `orderId: 1`, so ties keep Taskroom's own order.
 */
export function pickLandingStageId(stages: any[]): string | null {
  const order = (stage: any) =>
    typeof stage?.orderId === "number" ? stage.orderId : Number.MAX_SAFE_INTEGER;
  const first = (list: any[]) =>
    list.reduce<any>(
      (best, stage) => (best === null || order(stage) < order(best) ? stage : best),
      null
    );

  const live = (stages || []).filter(
    (stage) => stage?._id && (stage.status === undefined || stage.status === "active")
  );
  const pick =
    first(live.filter((stage) => stage.stageType === "tostart")) ?? first(live);
  return pick ? String(pick._id) : null;
}

export interface TaskroomAccount {
  /** tr2_user `_id` — what every Taskroom membership row points at. */
  id: string;
  /** The address stored on the account, exactly as Taskroom has it. */
  email: string;
}

/**
 * Pick each person's Taskroom account out of the org's tr2_users.
 *
 * One Garage user can own several: Taskroom keys its lookups by email, so a
 * changed or differently-cased address mints another. The one Taskroom's auth
 * resolves for them is the exact-email match, so that wins, then a
 * case-insensitive match. An account under an address the person no longer
 * has is ignored — access granted to it is access they cannot use — unless
 * they have no email at all, when it is the only candidate there is.
 */
export function pickTaskroomAccounts(
  records: any[],
  emailByUserId: Map<string, string | null | undefined>
): Map<string, TaskroomAccount> {
  const byUser = new Map<string, any[]>();
  for (const record of records || []) {
    if (!record?._id || !record?.userId) continue;
    const key = String(record.userId);
    const list = byUser.get(key);
    if (list) list.push(record);
    else byUser.set(key, [record]);
  }

  const picked = new Map<string, TaskroomAccount>();
  for (const [userId, email] of emailByUserId) {
    const candidates = byUser.get(userId);
    if (!candidates?.length) continue;
    const loose = String(email || "").trim().toLowerCase();
    const match = loose
      ? candidates.find((c) => c.email === email) ||
        candidates.find((c) => String(c.email || "").trim().toLowerCase() === loose)
      : candidates[0];
    if (match) {
      picked.set(userId, { id: String(match._id), email: String(match.email || "") });
    }
  }
  return picked;
}

export interface MemberSyncPlan {
  /** Group members already on the board — nothing to do but record them. */
  keep: { userId: string; taskroomUserId: string; addedBySync: boolean }[];
  /** Group members to put on the board (their Taskroom id may be unknown yet). */
  add: { userId: string; taskroomUserId: string | null }[];
  /** Former members the sync itself put on the board — take them off. */
  remove: { userId: string; taskroomUserId: string }[];
  /** Former members to drop from the record without touching the board. */
  forget: string[];
}

/**
 * The diff between the group and the board.
 *
 * `addedBySync` only survives on someone already on the board when an earlier
 * run put them there: a person found on the board was put there by somebody
 * else, and the sync must never take them off. The linker is never removed —
 * they own the board.
 */
export function planMemberSync(
  desiredUserIds: string[],
  currentEntries: Pick<
    GroupTaskroomMemberEntry,
    "userId" | "taskroomUserId" | "addedBySync"
  >[],
  roomMemberTaskroomIds: Iterable<string>,
  taskroomIdByUserId: Map<string, string>,
  linkedBy?: string | null
): MemberSyncPlan {
  const onBoard = new Set([...roomMemberTaskroomIds].map(String));
  const desired = [...new Set(desiredUserIds.map(String))];
  const desiredSet = new Set(desired);
  const previous = new Map(currentEntries.map((entry) => [String(entry.userId), entry]));
  const plan: MemberSyncPlan = { keep: [], add: [], remove: [], forget: [] };

  for (const userId of desired) {
    const taskroomUserId = taskroomIdByUserId.get(userId) ?? null;
    if (taskroomUserId && onBoard.has(taskroomUserId)) {
      plan.keep.push({
        userId,
        taskroomUserId,
        addedBySync: previous.get(userId)?.addedBySync === true,
      });
    } else {
      plan.add.push({ userId, taskroomUserId });
    }
  }

  const seen = new Set<string>();
  for (const entry of currentEntries) {
    const userId = String(entry.userId);
    if (desiredSet.has(userId) || seen.has(userId)) continue;
    seen.add(userId);
    const taskroomUserId = entry.taskroomUserId ? String(entry.taskroomUserId) : null;
    if (
      entry.addedBySync === true &&
      taskroomUserId &&
      onBoard.has(taskroomUserId) &&
      userId !== String(linkedBy ?? "")
    ) {
      plan.remove.push({ userId, taskroomUserId });
    } else {
      plan.forget.push(userId);
    }
  }

  return plan;
}

// ── Linking ─────────────────────────────────────────────────────────────────

interface LinkedBoard {
  workspaceId: string;
  workspaceName: string | null;
  spaceId: string;
  roomId: string;
  roomName: string | null;
}

/** Wrap a Taskroom failure in the 502 the admin sees; the detail goes to the log. */
function upstream(action: string, error: unknown): GroupTaskroomError {
  if (error instanceof GroupTaskroomError) return error;
  console.error(`[group-taskroom] Could not ${action}:`, errorMessage(error));
  return new GroupTaskroomError(502, `Couldn't ${action}. Please try again.`);
}

async function upstreamStep<T>(action: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw upstream(action, error);
  }
}

/**
 * Run a link attempt, and if it fails part-way, take back what it created so a
 * retry does not leave a trail of empty workspaces and boards. Taskroom's
 * deletes are soft (status → inactive). Best-effort: the original error is
 * what the admin needs to see.
 */
async function withRollback<T>(
  token: string,
  fn: (created: string[]) => Promise<T>
): Promise<T> {
  const created: string[] = [];
  try {
    return await fn(created);
  } catch (error) {
    for (const path of created.reverse()) {
      await taskroomRequest(path, { method: "DELETE", token }).catch((undoError) =>
        console.error(
          `[group-taskroom] Could not roll back ${path}:`,
          errorMessage(undoError)
        )
      );
    }
    throw error;
  }
}

/**
 * The linking admin's own Taskroom account.
 *
 * This is the first call of every link, and it goes through nothing but
 * Taskroom's auth — so a refusal here means exactly "no active Taskroom
 * account for this person in this org", which Taskroom only creates when they
 * open it. Later calls can fail with "Unauthorized for this operation" (a
 * permission check, not a missing account), so only this one maps to 409.
 */
async function resolveLinkerAccount(
  token: string,
  orgId: string,
  actorId: string
): Promise<TaskroomAccount> {
  let records: any[];
  try {
    records = asList(
      await taskroomRequest(
        `users?orgId=${encodeURIComponent(orgId)}&userId=${actorId}&size=5&page=1`,
        { token }
      )
    );
  } catch (error) {
    if (isTaskroomUnauthorized(error)) {
      throw new GroupTaskroomError(409, TASKROOM_ACCOUNT_MISSING_MESSAGE);
    }
    throw upstream("reach Taskroom", error);
  }

  const actor: any = await User.findById(actorId).select("email").lean();
  const account = pickTaskroomAccounts(
    records,
    new Map([[actorId, actor?.email ?? null]])
  ).get(actorId);
  if (!account) {
    throw new GroupTaskroomError(409, TASKROOM_ACCOUNT_MISSING_MESSAGE);
  }
  return account;
}

/**
 * A workspace the admin picked. `workspaces/:id` is already scoped to the
 * caller's org, so another org's workspace reads as missing; the org is still
 * checked here rather than trusted to that.
 */
async function readWorkspace(
  token: string,
  orgId: string,
  workspaceId: string
): Promise<{ id: string; name: string | null }> {
  let workspace: any;
  try {
    workspace = await taskroomRequest<any>(`workspaces/${workspaceId}`, { token });
  } catch (error) {
    if (!isTaskroomNotFound(error)) throw upstream("read that Taskroom workspace", error);
  }
  if (!workspace?._id || workspace.status === "inactive") {
    throw new GroupTaskroomError(400, "That Taskroom workspace no longer exists");
  }
  if (String(workspace.orgId) !== orgId) {
    throw new GroupTaskroomError(400, "That Taskroom workspace belongs to another organization");
  }
  return { id: String(workspace._id), name: workspace.name || null };
}

/**
 * Taskroom lets anyone in the org create a space in any workspace, member or
 * not — and a board filed where its owner cannot see it is no use to them.
 */
async function assertWorkspaceMember(
  token: string,
  workspaceId: string,
  account: TaskroomAccount
): Promise<void> {
  const members = await upstreamStep("check your Taskroom workspace access", async () =>
    asList(
      await taskroomRequest(
        `workspace/members?workspaceId=${workspaceId}&search=${searchFor(account.email)}&size=50&page=1`,
        { token }
      )
    )
  );
  if (!members.some((member) => String(member?.userId) === account.id)) {
    throw new GroupTaskroomError(400, "You're not a member of that Taskroom workspace");
  }
}

async function createGroupChatsSpace(token: string, workspaceId: string): Promise<string> {
  const space = await upstreamStep("create the Group Chats space in Taskroom", () =>
    taskroomRequest<any>("spaces", {
      method: "POST",
      token,
      body: {
        name: GROUP_CHATS_SPACE_NAME,
        description: "Boards linked to group chats",
        color: BOARD_COLOR,
        spaceCode: `group-chats-${Math.random().toString(36).substring(2, 8)}`,
        workspaceId,
        // Taskroom reads `isPrivate`; the lowercase spelling is ignored and a
        // public space pulls in every workspace member.
        isPrivate: true,
        members: [],
      },
    })
  );
  if (!space?._id) {
    throw new GroupTaskroomError(502, "Taskroom didn't return the new space. Please try again.");
  }
  return String(space._id);
}

/**
 * The admin's "Group Chats" space in a workspace, created on first use.
 * `spaces/me` only lists spaces the admin belongs to, so the board is always
 * filed somewhere its owner can see.
 */
async function findOrCreateGroupChatsSpace(
  token: string,
  workspaceId: string
): Promise<string> {
  const spaces = await upstreamStep("read your Taskroom spaces", async () =>
    asList(
      await taskroomRequest(
        `spaces/me?workspaceId=${workspaceId}&searchData=${encodeURIComponent(GROUP_CHATS_SPACE_NAME)}&page=1&size=50`,
        { token }
      )
    )
  );
  const match = spaces.find(
    (space) =>
      String(space?.name || "").trim().toLowerCase() ===
      GROUP_CHATS_SPACE_NAME.toLowerCase()
  );
  if (match?._id) return String(match._id);
  return createGroupChatsSpace(token, workspaceId);
}

/**
 * The board itself. Private, so it is not shared with the whole space; the
 * member sync adds the group. Taskroom seeds the four default columns and
 * makes the creator the board's admin.
 */
async function createGroupBoard(
  token: string,
  spaceId: string,
  groupName: string,
  created: string[]
): Promise<{ id: string; name: string }> {
  const room = await upstreamStep("create the Taskroom board", () =>
    taskroomRequest<any>("rooms", {
      method: "POST",
      token,
      body: {
        name: groupName,
        description: `Tasks captured from the "${groupName}" group chat`,
        spaceId,
        color: BOARD_COLOR,
        bgImage: "",
        // A real boolean — Taskroom evals this field.
        isPrivate: true,
        members: [],
        setDefault: false,
      },
    })
  );
  if (!room?._id) {
    throw new GroupTaskroomError(502, "Taskroom didn't return the new board. Please try again.");
  }
  created.push(`rooms/${room._id}`);
  return { id: String(room._id), name: room.name || groupName };
}

async function createWorkspaceWithBoard(
  token: string,
  groupName: string,
  created: string[]
): Promise<LinkedBoard> {
  const workspace = await upstreamStep("create the Taskroom workspace", () =>
    taskroomRequest<any>("workspaces", {
      method: "POST",
      token,
      body: { category: "work", name: groupName, color: BOARD_COLOR },
    })
  );
  if (!workspace?._id) {
    throw new GroupTaskroomError(502, "Taskroom didn't return the new workspace. Please try again.");
  }
  const workspaceId = String(workspace._id);
  created.push(`workspaces/${workspaceId}`);

  const spaceId = await createGroupChatsSpace(token, workspaceId);
  const room = await createGroupBoard(token, spaceId, groupName, created);
  return {
    workspaceId,
    workspaceName: workspace.name || groupName,
    spaceId,
    roomId: room.id,
    roomName: room.name,
  };
}

async function createBoardInWorkspace(
  token: string,
  opts: { orgId: string; workspaceId: string; account: TaskroomAccount; groupName: string },
  created: string[]
): Promise<LinkedBoard> {
  const workspace = await readWorkspace(token, opts.orgId, opts.workspaceId);
  await assertWorkspaceMember(token, workspace.id, opts.account);
  const spaceId = await findOrCreateGroupChatsSpace(token, workspace.id);
  const room = await createGroupBoard(token, spaceId, opts.groupName, created);
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    spaceId,
    roomId: room.id,
    roomName: room.name,
  };
}

/**
 * A board the admin picked. `rooms/:id` is not scoped to the caller's org or
 * membership at all, so both are checked here: the board must be live, in
 * this group's org, in the workspace the admin picked, and the admin must be
 * on it — linking a board would otherwise let the sync put the whole group on
 * a board its linker cannot see.
 */
async function readExistingBoard(
  token: string,
  opts: { orgId: string; workspaceId: string; roomId: string; account: TaskroomAccount }
): Promise<LinkedBoard> {
  const room = await upstreamStep("read that Taskroom board", () =>
    readRoom(token, opts.roomId)
  );
  if (!room) {
    throw new GroupTaskroomError(400, "That Taskroom board no longer exists");
  }
  if (String(room.orgId) !== opts.orgId) {
    throw new GroupTaskroomError(400, "That Taskroom board belongs to another organization");
  }
  if (String(room.workspaceId) !== opts.workspaceId) {
    throw new GroupTaskroomError(400, "That board isn't in the selected workspace");
  }

  const spaceId = String(room.spaceId);
  const members = await upstreamStep("check your access to that board", async () =>
    asList(
      await taskroomRequest(
        `room/members?spaceId=${spaceId}&roomId=${opts.roomId}&search=${searchFor(opts.account.email)}&size=50&page=1`,
        { token }
      )
    )
  );
  if (!members.some((member) => String(member?.userId) === opts.account.id)) {
    throw new GroupTaskroomError(400, "You're not a member of that Taskroom board");
  }

  const workspace = await readWorkspace(token, opts.orgId, opts.workspaceId);
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    spaceId,
    roomId: String(room._id),
    roomName: room.name || null,
  };
}

async function resolveLandingStageId(token: string, roomId: string): Promise<string> {
  let stages: any[];
  try {
    stages = asList(await taskroomRequest(`stages/room/${roomId}`, { token }));
  } catch (error) {
    // Taskroom's answer to a caller who is not on the board (400).
    if (/unauthori[sz]ed for this operation/i.test(errorMessage(error))) {
      throw new GroupTaskroomError(400, "You're not a member of that Taskroom board");
    }
    throw upstream("read the board's columns", error);
  }
  const stageId = pickLandingStageId(stages);
  if (!stageId) {
    throw new GroupTaskroomError(
      400,
      "That board has no columns yet. Add one in Taskroom, then link it again."
    );
  }
  return stageId;
}

/**
 * Link a group to a Taskroom board, replacing any existing link (the old
 * board is left exactly as it is). Writes the "linked" pill and starts the
 * member sync. Throws GroupTaskroomError for anything the admin can act on.
 */
export async function linkGroupTaskroom(input: {
  groupId: string;
  actorId: string;
  mode: GroupTaskroomLinkMode;
  workspaceId?: string;
  roomId?: string;
}): Promise<GroupTaskroomSummary> {
  const { groupId, actorId, mode } = input;

  const group: any = await Group.findById(groupId)
    .select("name orgId kind taskroom")
    .lean();
  if (!group) throw new GroupTaskroomError(404, "Group not found");
  if (isSupportGroup(group)) {
    throw new GroupTaskroomError(400, "Support chats can't be linked to Taskroom");
  }
  if (!group.orgId) {
    throw new GroupTaskroomError(400, "This group isn't part of an organization");
  }
  const workspaceId = input.workspaceId || "";
  const roomId = input.roomId || "";
  if (mode !== "new-workspace" && !workspaceId) {
    throw new GroupTaskroomError(400, "Pick a Taskroom workspace");
  }
  if (mode === "existing-board" && !roomId) {
    throw new GroupTaskroomError(400, "Pick a Taskroom board");
  }

  const orgId = String(group.orgId);
  const token = await mintUserToken(actorId, orgId);
  const account = await resolveLinkerAccount(token, orgId, actorId);

  const board = await withRollback(token, async (created) => {
    const target =
      mode === "new-workspace"
        ? await createWorkspaceWithBoard(token, group.name, created)
        : mode === "new-board"
          ? await createBoardInWorkspace(
              token,
              { orgId, workspaceId, account, groupName: group.name },
              created
            )
          : await readExistingBoard(token, { orgId, workspaceId, roomId, account });

    const stageId = await resolveLandingStageId(token, target.roomId);

    // Relinking the SAME board keeps what the sync knows about it — who it
    // added — so those people still come off when they leave the chat. Any
    // other board starts from nothing.
    const previous = group.taskroom;
    const sameBoard = !!previous?.roomId && String(previous.roomId) === target.roomId;

    await Group.updateOne(
      { _id: group._id },
      {
        $set: {
          taskroom: {
            enabled: true,
            status: "active",
            mode,
            workspaceId: target.workspaceId,
            workspaceName: target.workspaceName,
            spaceId: target.spaceId,
            roomId: target.roomId,
            roomName: target.roomName,
            stageId,
            linkedBy: new Types.ObjectId(actorId),
            linkedAt: new Date(),
            members: sameBoard ? previous.members || [] : [],
            lastSyncAt: null,
            lastError: null,
          },
        },
      }
    );
    return target;
  });

  void writeGroupSystemMessage({
    groupId: group._id,
    event: "taskroom_linked",
    actorId,
    meta: { roomName: board.roomName || undefined },
    taskroom: {
      roomId: board.roomId,
      spaceId: board.spaceId,
      workspaceId: board.workspaceId,
      title: board.roomName || undefined,
    },
  });
  // Read first, queue second: the summary is built right after the queue, so
  // it reports the sync as running rather than racing it.
  const fresh: any = await Group.findById(group._id).select("members taskroom").lean();
  requestGroupTaskroomSync(String(group._id));
  const summary = await serializeGroupTaskroom(fresh);
  if (!summary) {
    throw new GroupTaskroomError(409, "The link was removed while it was being set up");
  }
  return summary;
}

/**
 * Remove the link. The board, its tasks and everyone on it are left untouched
 * — unlinking stops the chat feeding the board, it does not take the board
 * away from anyone. Returns false when there was no link.
 */
export async function unlinkGroupTaskroom(
  groupId: string,
  actorId: string
): Promise<boolean> {
  const result = await Group.updateOne(
    { _id: groupId, taskroom: { $exists: true } },
    { $unset: { taskroom: 1 } }
  );
  if (!result.modifiedCount) return false;

  void writeGroupSystemMessage({ groupId, event: "taskroom_unlinked", actorId });
  return true;
}

/** Turn AI task capture on or off. Undefined when the group is not linked. */
export async function setGroupTaskroomEnabled(
  groupId: string,
  enabled: boolean
): Promise<GroupTaskroomSummary | undefined> {
  const result = await Group.updateOne(
    { _id: groupId, "taskroom.roomId": { $exists: true } },
    { $set: { "taskroom.enabled": enabled } }
  );
  if (!result.matchedCount) return undefined;

  const group: any = await Group.findById(groupId).select("members taskroom").lean();
  return serializeGroupTaskroom(group);
}

// ── Member sync ─────────────────────────────────────────────────────────────
//
// Taskroom quirks the member walk works around (task-room-node-v1,
// controllers/v2):
//
//  • A board member must already be a space member, and a space member a
//    workspace member, so the levels are walked in that order.
//  • Adding at the workspace level is what creates a Taskroom account for
//    someone who has never opened Taskroom, which is why it is keyed by email.
//  • None of the bulk-add routes checks for an existing membership, so each
//    level is listed first and only the missing people are sent.
//  • The space and board bulk adds accept a batch only when the count of
//    membership ROWS one level up equals the batch size, so one person with a
//    duplicate row sinks the batch. The single-add routes use findOne and do
//    not have that problem — they are the per-person fallback.

interface SyncPerson {
  userId: string;
  name: string;
  email: string | null;
  image?: string;
}

interface ReconcileInput {
  orgId: string;
  roomId: string;
  spaceId: string;
  workspaceId: string;
  linkedBy: string | null;
  memberIds: string[];
  people: Map<string, SyncPerson>;
  entries: GroupTaskroomMemberEntry[];
}

interface SyncOutcome {
  members: GroupTaskroomMemberEntry[];
  spaceId: string;
  workspaceId: string;
  roomName: string | null;
  added: number;
  removed: number;
  failed: number;
}

/**
 * Groups with a sync running in this process. `again` is raised by a request
 * that arrives mid-run and buys exactly one more run once this one is done —
 * enough to pick up whatever changed, however many requests there were.
 */
const syncQueue = new Map<string, { again: boolean }>();

/**
 * Bring the linked board's membership in line with the group's. Fire-and-
 * forget: returns at once, never throws, and is a no-op for groups that are
 * not linked (and for support chats, which never are).
 */
export function requestGroupTaskroomSync(groupId: string): void {
  try {
    const id = String(groupId || "");
    if (!Types.ObjectId.isValid(id)) return;

    const queued = syncQueue.get(id);
    if (queued) {
      queued.again = true;
      return;
    }

    const state = { again: false };
    syncQueue.set(id, state);
    void drainGroupSync(id, state);
  } catch (error) {
    console.error("[group-taskroom] Could not queue a member sync:", errorMessage(error));
  }
}

async function drainGroupSync(groupId: string, state: { again: boolean }): Promise<void> {
  try {
    do {
      state.again = false;
      try {
        await syncGroupTaskroomMembers(groupId);
      } catch (error) {
        console.error(
          `[group-taskroom] Member sync for group ${groupId} failed:`,
          errorMessage(error)
        );
      }
    } while (state.again);
  } finally {
    syncQueue.delete(groupId);
  }
}

async function syncGroupTaskroomMembers(groupId: string): Promise<void> {
  const group: any = await Group.findById(groupId)
    .select("orgId kind createdBy members taskroom")
    .lean();
  const link = group?.taskroom;
  if (!group || !link?.roomId || !group.orgId || isSupportGroup(group)) return;

  const roomId = String(link.roomId);
  // Every write below is conditional on the link it was computed for.
  const sameLink = { _id: group._id, "taskroom.roomId": roomId };

  // `members` holds real users only; agents live in `agentMembers`.
  const memberIds: string[] = [
    ...new Set<string>((group.members || []).map((member: any) => String(member.userId))),
  ];
  const users: any[] = memberIds.length
    ? await User.find({ _id: { $in: memberIds } })
        .select("name email profilePicture")
        .lean()
    : [];
  const people = new Map<string, SyncPerson>(
    users.map((user) => {
      const email = typeof user.email === "string" && user.email.trim() ? user.email : null;
      return [
        String(user._id),
        {
          userId: String(user._id),
          name: user.name || email || "Member",
          email,
          image: user.profilePicture || undefined,
        },
      ];
    })
  );

  const entries: GroupTaskroomMemberEntry[] = (link.members || []).map((member: any) => ({
    userId: String(member.userId),
    taskroomUserId: member.taskroomUserId ? String(member.taskroomUserId) : null,
    addedBySync: member.addedBySync === true,
    status: member.status === "failed" ? "failed" : "synced",
    error: member.error ?? null,
    syncedAt: member.syncedAt ? new Date(member.syncedAt) : undefined,
  }));

  let outcome: SyncOutcome;
  try {
    // No preferred actor: the linker first, then any synced admin.
    const run = await withTaskroomActor(group, (token) =>
      reconcileBoardMembers(token, {
        orgId: String(group.orgId),
        roomId,
        spaceId: String(link.spaceId || ""),
        workspaceId: String(link.workspaceId || ""),
        linkedBy: link.linkedBy ? String(link.linkedBy) : null,
        memberIds,
        people,
        entries,
      })
    );
    outcome = run.result;
  } catch (error) {
    const now = new Date();
    if (error instanceof NoTaskroomActorError || error instanceof BoardGoneError) {
      const message = error instanceof BoardGoneError ? BOARD_GONE_MESSAGE : NO_ACTOR_MESSAGE;
      // Only a board that is really gone stops capture. "Nobody can act" can
      // be a transient Taskroom failure (it answers any internal error with
      // 401), so it is recorded for the admin panel without disabling anything.
      await Group.updateOne(sameLink, {
        $set: {
          ...(error instanceof BoardGoneError ? { "taskroom.status": "broken" } : {}),
          "taskroom.lastError": message,
          "taskroom.lastErrorAt": now,
        },
      });
      console.warn(
        `[group-taskroom] Group ${groupId} ${error instanceof BoardGoneError ? "link is broken" : "sync could not act"}: ${message}`
      );
      return;
    }

    const message = `Couldn't sync members with Taskroom: ${errorMessage(error)}`;
    await Group.updateOne(sameLink, {
      $set: { "taskroom.lastError": message, "taskroom.lastErrorAt": now },
    });
    console.error(`[group-taskroom] Group ${groupId}: ${message}`);
    return;
  }

  const result = await Group.updateOne(sameLink, {
    $set: {
      "taskroom.members": outcome.members.map((entry) => ({
        userId: new Types.ObjectId(entry.userId),
        taskroomUserId: entry.taskroomUserId,
        addedBySync: entry.addedBySync,
        status: entry.status,
        error: entry.error,
        ...(entry.syncedAt ? { syncedAt: entry.syncedAt } : {}),
      })),
      "taskroom.lastSyncAt": new Date(),
      "taskroom.lastError": null,
      "taskroom.status": "active",
      // Where the board lives now, in case it was moved in Taskroom.
      "taskroom.spaceId": outcome.spaceId,
      "taskroom.workspaceId": outcome.workspaceId,
      ...(outcome.roomName ? { "taskroom.roomName": outcome.roomName } : {}),
    },
  });

  if (!result.matchedCount) {
    console.log(
      `[group-taskroom] Group ${groupId} was relinked or unlinked mid-sync; results discarded`
    );
    return;
  }
  console.log(
    `[group-taskroom] Synced group ${groupId}: ${outcome.added} added, ${outcome.removed} removed, ${outcome.failed} failed`
  );
}

/**
 * One reconcile pass against Taskroom, as whoever `withTaskroomActor` picked.
 * Pure in the sense that matters: it writes nothing to our database, so a run
 * retried as another actor starts clean.
 */
async function reconcileBoardMembers(
  token: string,
  input: ReconcileInput
): Promise<SyncOutcome> {
  const { orgId, roomId, people } = input;

  // 0. The board must still exist. Where it lives now wins over what was
  //    stored — Taskroom can move a board to another space.
  const room = await readRoom(token, roomId);
  if (!room) throw new BoardGoneError();
  const spaceId = String(room.spaceId || input.spaceId);
  const workspaceId = String(room.workspaceId || input.workspaceId);

  // 1. Everyone's Taskroom account, from one org-wide list.
  const emails = new Map<string, string | null>(
    input.memberIds.map((userId) => [userId, people.get(userId)?.email ?? null])
  );
  let accounts = pickTaskroomAccounts(await listTaskroomUsers(token, orgId), emails);
  const taskroomIdOf = (userId: string) => accounts.get(userId)?.id ?? null;

  // 2. Who is on the board now.
  const boardRows = await listPages(`room/members?spaceId=${spaceId}&roomId=${roomId}`, token);
  const onBoard = idsOf(boardRows);

  const plan = planMemberSync(
    input.memberIds,
    input.entries,
    onBoard,
    new Map([...accounts].map(([userId, account]) => [userId, account.id])),
    input.linkedBy
  );

  const failures = new Map<string, string>();

  if (plan.add.length) {
    for (const { userId } of plan.add) {
      if (!people.has(userId)) failures.set(userId, "Their Garage account couldn't be found");
    }

    // 3. Workspace.
    const inWorkspace = idsOf(
      asList(await taskroomRequest(`workspace/members/all?workspaceId=${workspaceId}`, { token }))
    );
    const needWorkspace = plan.add.filter(({ userId }) => {
      if (failures.has(userId)) return false;
      const taskroomUserId = taskroomIdOf(userId);
      return !taskroomUserId || !inWorkspace.has(taskroomUserId);
    });
    if (needWorkspace.length) {
      const mintsAccounts = needWorkspace.some(({ userId }) => !accounts.has(userId));
      await addToWorkspace(
        token,
        { orgId, workspaceId },
        needWorkspace.map(({ userId }) => ({
          person: people.get(userId) as SyncPerson,
          account: accounts.get(userId),
        })),
        failures
      );
      // Accounts minted by that call only exist on Taskroom's side so far.
      if (mintsAccounts) {
        accounts = pickTaskroomAccounts(await listTaskroomUsers(token, orgId), emails);
      }
    }
    for (const { userId } of plan.add) {
      if (!failures.has(userId) && !taskroomIdOf(userId)) {
        failures.set(userId, "Taskroom didn't create an account for them");
      }
    }

    const pending = () =>
      new Map(
        plan.add
          .filter(({ userId }) => !failures.has(userId))
          .map(({ userId }) => [userId, taskroomIdOf(userId) as string])
      );

    // 4. Space.
    await addToLevel({
      label: "space",
      people: pending(),
      present: async () =>
        idsOf(await listPages(`space/members?workspaceId=${workspaceId}&spaceId=${spaceId}`, token)),
      bulk: (taskroomUserIds) =>
        taskroomRequest("space/members/bulk", {
          method: "POST",
          token,
          body: {
            spaceId,
            workspaceId,
            membersList: taskroomUserIds.map((userId) => ({ userId, role: MEMBER_ROLE })),
          },
        }),
      single: (trUserId) =>
        taskroomRequest("space/members", {
          method: "POST",
          token,
          body: { trUserId, spaceId, workspaceId, role: MEMBER_ROLE },
        }),
      failures,
    });

    // 5. Board.
    await addToLevel({
      label: "board",
      people: pending(),
      initial: onBoard,
      present: async () =>
        idsOf(await listPages(`room/members?spaceId=${spaceId}&roomId=${roomId}`, token)),
      bulk: (taskroomUserIds) =>
        taskroomRequest("room/members/bulk", {
          method: "POST",
          token,
          body: {
            spaceId,
            roomId,
            membersList: taskroomUserIds.map((userId) => ({ userId, role: MEMBER_ROLE })),
          },
        }),
      single: (trUserId) =>
        taskroomRequest("room/members", {
          method: "POST",
          token,
          body: { trUserId, spaceId, roomId, role: MEMBER_ROLE },
        }),
      failures,
    });
  }

  // 5b. Photos. The workspace add carries `image`, but only for people the
  //     sync creates — anyone who already had a Taskroom account (opened it
  //     themselves, or was on the board first) keeps whatever avatar Taskroom
  //     had, usually none, and shows as initials on every card. Push their
  //     Garage photo too. Best-effort: a photo is never worth failing the sync.
  try {
    await syncMemberPhotos(token, orgId, input.memberIds, people);
  } catch (error) {
    console.warn(`[group-taskroom] Photo sync failed:`, errorMessage(error));
  }

  // 6. Former members the sync put on the board come off it. Every row of
  //    theirs goes — a duplicate row would otherwise keep them on.
  let removed = 0;
  const removalErrors = new Map<string, string>();
  for (const target of plan.remove) {
    const rows = boardRows.filter(
      (row) => row?._id && String(row.userId) === target.taskroomUserId
    );
    try {
      for (const row of rows) {
        // No socket ids in the query: Taskroom's delete handler references an
        // undefined variable on that path and answers 500.
        await taskroomRequest(`room/members/${row._id}`, { method: "DELETE", token });
      }
      removed++;
    } catch (error) {
      removalErrors.set(
        target.userId,
        `Couldn't remove them from the board: ${errorMessage(error)}`
      );
    }
  }

  const now = new Date();
  const members: GroupTaskroomMemberEntry[] = plan.keep.map((person) => ({
    userId: person.userId,
    taskroomUserId: person.taskroomUserId,
    addedBySync: person.addedBySync,
    status: "synced",
    error: null,
    syncedAt: now,
  }));
  for (const { userId } of plan.add) {
    const error = failures.get(userId);
    members.push(
      error
        ? {
            userId,
            taskroomUserId: taskroomIdOf(userId),
            addedBySync: false,
            status: "failed",
            error,
          }
        : {
            userId,
            taskroomUserId: taskroomIdOf(userId),
            addedBySync: true,
            status: "synced",
            error: null,
            syncedAt: now,
          }
    );
  }
  // A removal that failed stays on record so the next run tries again.
  const previous = new Map(input.entries.map((entry) => [entry.userId, entry]));
  for (const [userId, error] of removalErrors) {
    const entry = previous.get(userId);
    if (entry) members.push({ ...entry, error });
  }

  return {
    members,
    spaceId,
    workspaceId,
    roomName: room.name || null,
    added: plan.add.length - failures.size,
    removed,
    failed: failures.size,
  };
}

/**
 * Copy each member's Garage profile photo onto their Taskroom account
 * (`PUT users/:id`), so cards show faces instead of initials. Only writes when
 * Garage has a photo and Taskroom's differs — a member without a Garage photo
 * is never blanked. Garage is the source of truth for avatars.
 */
async function syncMemberPhotos(
  token: string,
  orgId: string,
  memberIds: string[],
  people: Map<string, SyncPerson>
): Promise<void> {
  const withPhoto = memberIds.filter((userId) => people.get(userId)?.image);
  if (!withPhoto.length) return;

  const records = await listTaskroomUsers(token, orgId);
  const recordById = new Map(records.map((record: any) => [String(record?._id), record]));
  const accounts = pickTaskroomAccounts(
    records,
    new Map(withPhoto.map((userId) => [userId, people.get(userId)?.email ?? null]))
  );

  for (const userId of withPhoto) {
    const account = accounts.get(userId);
    if (!account) continue;
    const image = people.get(userId)?.image as string;
    if (String(recordById.get(account.id)?.image || "") === image) continue;
    try {
      await taskroomRequest(`users/${account.id}`, { method: "PUT", token, body: { image } });
    } catch (error) {
      console.warn(
        `[group-taskroom] Couldn't set the Taskroom photo for ${userId}:`,
        errorMessage(error)
      );
    }
  }
}

/**
 * Workspace level, keyed by email because this is where Taskroom mints an
 * account for someone who has never opened it.
 *
 * Taskroom matches the batch to existing accounts by EXACT email and
 * lower-cases the ones it creates; in a batch that also creates accounts, an
 * existing account stored with capitals is not recognised and gets created a
 * second time. People who have an account are therefore sent with the address
 * stored on it, in a batch of their own.
 */
async function addToWorkspace(
  token: string,
  target: { orgId: string; workspaceId: string },
  needed: { person: SyncPerson; account?: TaskroomAccount }[],
  failures: Map<string, string>
): Promise<void> {
  const existing: any[] = [];
  const fresh: any[] = [];
  for (const { person, account } of needed) {
    const member = {
      memberUserId: person.userId,
      name: person.name,
      image: person.image,
      role: MEMBER_ROLE,
    };
    if (account?.email) existing.push({ ...member, email: account.email });
    else if (person.email) fresh.push({ ...member, email: person.email.trim().toLowerCase() });
    else failures.set(person.userId, NO_EMAIL_MESSAGE);
  }

  for (const batch of [existing, fresh]) {
    if (!batch.length) continue;
    try {
      await taskroomRequest("workspace/members/bulk", {
        method: "POST",
        token,
        body: { ...target, membersList: batch },
      });
      continue;
    } catch (error) {
      console.warn(
        `[group-taskroom] Bulk workspace add refused (${errorMessage(error)}); adding one by one`
      );
    }

    for (const member of batch) {
      try {
        await taskroomRequest("workspace/members", {
          method: "POST",
          token,
          body: { ...target, ...member },
        });
      } catch (error) {
        // The single-add route checks first and refuses a duplicate — which
        // is the outcome wanted here.
        if (/already member/i.test(errorMessage(error))) continue;
        failures.set(
          member.memberUserId,
          `Couldn't add them to the Taskroom workspace: ${errorMessage(error)}`
        );
      }
    }
  }
}

/**
 * Put people on one level (space or board): one bulk call, and if Taskroom
 * refuses the batch, one call per person so a single bad record costs only
 * that person. The level is re-read before falling back, because a batch that
 * timed out on our side may still have landed and the single-add routes do
 * not de-duplicate.
 */
async function addToLevel(opts: {
  label: "space" | "board";
  /** Garage user id → Taskroom user id. */
  people: Map<string, string>;
  /** Taskroom ids already on this level, when already read. */
  initial?: Set<string>;
  present: () => Promise<Set<string>>;
  bulk: (taskroomUserIds: string[]) => Promise<unknown>;
  single: (taskroomUserId: string) => Promise<unknown>;
  failures: Map<string, string>;
}): Promise<void> {
  if (!opts.people.size) return;
  const already = opts.initial ?? (await opts.present());
  const missing = [...opts.people].filter(([, taskroomUserId]) => !already.has(taskroomUserId));
  if (!missing.length) return;

  try {
    await opts.bulk(missing.map(([, taskroomUserId]) => taskroomUserId));
    return;
  } catch (error) {
    console.warn(
      `[group-taskroom] Bulk ${opts.label} add refused (${errorMessage(error)}); adding one by one`
    );
  }

  const landed = await opts.present().catch(() => new Set<string>());
  for (const [userId, taskroomUserId] of missing) {
    if (landed.has(taskroomUserId)) continue;
    try {
      await opts.single(taskroomUserId);
    } catch (error) {
      opts.failures.set(
        userId,
        `Couldn't add them to the Taskroom ${opts.label}: ${errorMessage(error)}`
      );
    }
  }
}

// ── Read model ──────────────────────────────────────────────────────────────

/**
 * The `taskroom` block for GET /groups/:groupId, or undefined when the group
 * is not linked. Sync counts only cover people still in the group: a former
 * member's row is history, not something the admin can act on.
 */
export async function serializeGroupTaskroom(
  group: any
): Promise<GroupTaskroomSummary | undefined> {
  const link = group?.taskroom;
  if (!link?.roomId) return undefined;
  // Before any await, so a caller that has just queued a sync sees it.
  const running = syncQueue.has(String(group._id));

  const inGroup = new Set<string>(
    (group.members || []).map((member: any) => String(member.userId))
  );
  const current = (link.members || []).filter((member: any) =>
    inGroup.has(String(member.userId))
  );
  const failed = current.filter((member: any) => member.status === "failed");
  const synced = current.filter((member: any) => member.status !== "failed");

  const linkedBy = link.linkedBy ? String(link.linkedBy) : "";
  const lookupIds = [
    ...new Set<string>(
      [linkedBy, ...failed.map((member: any) => String(member.userId))].filter(
        (id) => Types.ObjectId.isValid(id)
      )
    ),
  ];
  const users: any[] = lookupIds.length
    ? await User.find({ _id: { $in: lookupIds } }).select("name email").lean()
    : [];
  const nameById = new Map(users.map((user) => [String(user._id), displayName(user)]));

  return {
    enabled: link.enabled !== false,
    status: link.status === "broken" ? "broken" : "active",
    mode: link.mode,
    workspaceId: String(link.workspaceId || ""),
    workspaceName: link.workspaceName || null,
    spaceId: String(link.spaceId || ""),
    roomId: String(link.roomId),
    roomName: link.roomName || null,
    linkedBy,
    linkedByName: nameById.get(linkedBy) ?? null,
    linkedAt: toIso(link.linkedAt) ?? "",
    lastError: link.lastError || null,
    memberSync: {
      running,
      synced: synced.length,
      failed: failed.length,
      lastSyncAt: toIso(link.lastSyncAt),
      failures: failed.map((member: any) => ({
        userId: String(member.userId),
        name: nameById.get(String(member.userId)) || "Member",
        error: member.error || "Couldn't add them to the board",
      })),
    },
  };
}
