// Mirror every support ticket onto one shared Taskroom board.
//
// Shorupan's decision ("option 1"): rather than a separate ticket console, each
// ticket we create also lands as an UNASSIGNED card on a single "Garage Support"
// board that the support team already works in. Assignment is then done by hand
// inside the taskroom — NVC/support tickets don't tag anyone, so nothing is
// auto-assigned here.
//
// The board is provisioned once, lazily, on the first ticket (create a
// workspace → space → room in Taskroom v2, acting as the super admin) and its
// coordinates cached on the SupportTicketBoard singleton. Everything is
// best-effort and never throws into ticket creation: a Taskroom hiccup must
// never stop a ticket being filed.
//
// Reuses Rehan's Taskroom v2 client (taskroomProvision.ts) verbatim — same
// endpoints the web app calls, so a provisioned board is indistinguishable from
// a hand-made one.

import { Types } from "mongoose";
import { SupportTicketBoard } from "../models/supportTicketBoard.model";
import { mintUserToken, taskroomRequest } from "./taskroomProvision";
import { pickLandingStageId } from "./groupTaskroom";

const BOARD_COLOR = "#008080";
const WORKSPACE_NAME = "Garage Support";
const SPACE_NAME = "Support Tickets";
const ROOM_NAME = "Support Tickets";

/** Taskroom's card priority enum. Ticket "medium" is "normal" there. */
const PRIORITY: Record<string, string> = {
  low: "low",
  medium: "normal",
  high: "high",
  urgent: "urgent",
};

function disabled(): boolean {
  return process.env.SUPPORT_TICKET_TASKROOM_DISABLED === "true";
}

interface Owner {
  userId: string;
  orgId: string;
}

/**
 * The Garage user whose Taskroom account owns the support board. Defaults to the
 * garage super admin; both the account and its org are overridable by env so the
 * board can be moved without a code change.
 */
async function resolveOwner(): Promise<Owner> {
  const { User } = await import("../models/user.model");
  const email = (process.env.SUPPORT_TICKET_TASKROOM_OWNER_EMAIL || "")
    .trim()
    .toLowerCase();

  let owner: any = null;
  if (email) {
    owner = await User.findOne({ email }).select("_id organizations").lean();
    if (!owner) throw new Error(`No user for SUPPORT_TICKET_TASKROOM_OWNER_EMAIL ${email}`);
  } else {
    const { GarageAdminModel } = await import("../models/garageAdmin.model");
    const superAdmin: any = await GarageAdminModel.findOne({
      role: "garage-super-admin",
    })
      .select("email")
      .lean();
    if (!superAdmin?.email) throw new Error("No garage-super-admin to own the support board");
    owner = await User.findOne({ email: String(superAdmin.email).toLowerCase() })
      .select("_id organizations")
      .lean();
    if (!owner) {
      throw new Error(
        `The super admin (${superAdmin.email}) has no Garage user account to own the board`
      );
    }
  }

  const orgId =
    (process.env.SUPPORT_TICKET_TASKROOM_ORG_ID || "").trim() ||
    (owner.organizations?.[0]?.organization
      ? String(owner.organizations[0].organization)
      : "");
  if (!orgId || !Types.ObjectId.isValid(orgId)) {
    throw new Error("Could not resolve an org for the support board owner");
  }
  return { userId: String(owner._id), orgId };
}

interface Board {
  ownerUserId: string;
  orgId: string;
  roomId: string;
  stageId: string;
}

// Serialise provisioning within the process: two tickets landing at once must
// not both create a workspace.
let provisioning: Promise<Board | null> | null = null;

/**
 * The support board's coordinates, provisioning it on first use. Returns null
 * (never throws) when it can't be resolved — the ticket is still filed.
 */
async function getBoard(): Promise<Board | null> {
  try {
    // The board an admin picked in the Support Chats page (or the one we
    // provisioned) wins; env only applies when nothing is stored yet.
    const existing: any = await SupportTicketBoard.findOne({ key: "support" }).lean();
    if (existing?.status === "ready" && existing.roomId && existing.stageId) {
      return {
        ownerUserId: String(existing.ownerUserId),
        orgId: String(existing.orgId),
        roomId: String(existing.roomId),
        stageId: String(existing.stageId),
      };
    }

    // An explicit board via env skips provisioning entirely (use an existing one).
    const envRoom = (process.env.SUPPORT_TICKET_TASKROOM_ROOM_ID || "").trim();
    const envStage = (process.env.SUPPORT_TICKET_TASKROOM_STAGE_ID || "").trim();
    if (envRoom && envStage) {
      const owner = await resolveOwner();
      return {
        ownerUserId: owner.userId,
        orgId: owner.orgId,
        roomId: envRoom,
        stageId: envStage,
      };
    }

    if (!provisioning) {
      provisioning = provisionBoard().finally(() => {
        provisioning = null;
      });
    }
    return await provisioning;
  } catch (e: any) {
    console.warn("[support-ticket-taskroom] getBoard failed:", e?.message || e);
    return null;
  }
}

/** Create the workspace → space → room once and cache it on the singleton. */
async function provisionBoard(): Promise<Board | null> {
  // A concurrent process may already have finished; re-check before creating.
  const current: any = await SupportTicketBoard.findOne({ key: "support" }).lean();
  if (current?.status === "ready" && current.roomId && current.stageId) {
    return {
      ownerUserId: String(current.ownerUserId),
      orgId: String(current.orgId),
      roomId: String(current.roomId),
      stageId: String(current.stageId),
    };
  }

  const owner = await resolveOwner();
  const token = await mintUserToken(owner.userId, owner.orgId);

  const workspace = await taskroomRequest<any>("workspaces", {
    method: "POST",
    token,
    body: { category: "work", name: WORKSPACE_NAME, color: BOARD_COLOR },
  });
  if (!workspace?._id) throw new Error("Taskroom returned no workspace");
  const workspaceId = String(workspace._id);

  const space = await taskroomRequest<any>("spaces", {
    method: "POST",
    token,
    body: {
      name: SPACE_NAME,
      description: "Support tickets, mirrored from Garage",
      color: BOARD_COLOR,
      spaceCode: `support-${Math.random().toString(36).slice(2, 8)}`,
      workspaceId,
      isPrivate: true,
      members: [],
    },
  });
  if (!space?._id) throw new Error("Taskroom returned no space");
  const spaceId = String(space._id);

  const room = await taskroomRequest<any>("rooms", {
    method: "POST",
    token,
    body: {
      name: ROOM_NAME,
      description: "Every support ticket lands here as a card",
      spaceId,
      color: BOARD_COLOR,
      bgImage: "",
      isPrivate: true,
      members: [],
      setDefault: false,
    },
  });
  if (!room?._id) throw new Error("Taskroom returned no room");
  const roomId = String(room._id);

  // Taskroom seeds default columns; land cards in the first "to start" one.
  const stages = await taskroomRequest<any>(`stages/room/${roomId}`, { token });
  const stageId = pickLandingStageId(Array.isArray(stages) ? stages : stages?.data || []);
  if (!stageId) throw new Error("The support board has no columns");

  await SupportTicketBoard.findOneAndUpdate(
    { key: "support" },
    {
      $set: {
        ownerUserId: new Types.ObjectId(owner.userId),
        orgId: new Types.ObjectId(owner.orgId),
        workspaceId,
        workspaceName: WORKSPACE_NAME,
        spaceId,
        roomId,
        roomName: ROOM_NAME,
        stageId,
        status: "ready",
        lastError: null,
        provisionedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
  console.log(`[support-ticket-taskroom] provisioned board room=${roomId} stage=${stageId}`);
  return { ownerUserId: owner.userId, orgId: owner.orgId, roomId, stageId };
}

/**
 * Mirror one ticket onto the support board as an unassigned card. Fire-and-
 * forget from ticket creation; best-effort and never throws.
 */
export async function createTaskForTicket(ticketId: string): Promise<void> {
  try {
    if (disabled()) return;
    if (!Types.ObjectId.isValid(ticketId)) return;
    const { Ticket } = await import("../models/ticket.model");
    const ticket: any = await Ticket.findById(ticketId);
    if (!ticket) return;
    // Already mirrored (a retry, or a save that re-fired the hook).
    if (ticket.taskroomTaskId) return;

    const board = await getBoard();
    if (!board) return;

    const token = await mintUserToken(board.ownerUserId, board.orgId);
    const title = String(ticket.title || "Support ticket").slice(0, 200);
    const parts = [
      String(ticket.description || "").trim(),
      "",
      `From ${ticket.userName || ticket.userEmail || "a user"}` +
        (ticket.userEmail ? ` (${ticket.userEmail})` : "") +
        (ticket.source === "chat" ? " · via support chat" : ""),
      ticket.aiGenerated ? "Created by AI from a support conversation." : "",
    ];
    const description = parts.filter(Boolean).join("\n");

    const task = await taskroomRequest<any>("tasks", {
      method: "POST",
      token,
      body: {
        roomId: board.roomId,
        stageId: board.stageId,
        title,
        description,
        priority: PRIORITY[String(ticket.priority)] || "normal",
        // Unassigned on purpose: NVC/support tickets tag no one, so a human
        // assigns the card inside the taskroom.
        assignedToIds: [],
      },
    });

    const taskroomTaskId = task?._id ? String(task._id) : "";
    if (!taskroomTaskId) {
      console.warn(`[support-ticket-taskroom] ticket=${ticketId} Taskroom returned no task id`);
      return;
    }
    // Guarded write so we never mirror the same ticket twice.
    const { Ticket: TicketModel } = await import("../models/ticket.model");
    await TicketModel.updateOne(
      { _id: ticket._id, taskroomTaskId: { $in: [null, undefined] } },
      { $set: { taskroomTaskId, taskroomRoomId: board.roomId } }
    );
    console.log(`[support-ticket-taskroom] ticket=${ticketId} -> task=${taskroomTaskId}`);
  } catch (e: any) {
    console.warn("[support-ticket-taskroom] createTaskForTicket failed:", e?.message || e);
  }
}

// ── Board selection (Support Chats page) ────────────────────────────────────
//
// Admins pick which Taskroom board support tasks go to. The admin panel has no
// Taskroom login of its own (garage admins are not Taskroom users), so listing
// and validation run here, acting as the board owner — the super admin by
// default. Only boards the owner can see are offered, which is also the set we
// can post cards to.

function asList(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

/** The owner to act as: whoever owns the stored board, else the default owner. */
async function ownerForSelection(): Promise<Owner> {
  const stored: any = await SupportTicketBoard.findOne({ key: "support" })
    .select("ownerUserId orgId")
    .lean();
  if (stored?.ownerUserId && stored?.orgId) {
    return { userId: String(stored.ownerUserId), orgId: String(stored.orgId) };
  }
  return resolveOwner();
}

export interface SupportBoardInfo {
  configured: boolean;
  status: "ready" | "provisioning" | "failed" | null;
  workspaceId: string | null;
  workspaceName: string | null;
  roomId: string | null;
  roomName: string | null;
  selectedBy: string | null;
  selectedAt: string | null;
  lastError: string | null;
}

/** Where support tasks currently go. */
export async function getSupportBoardInfo(): Promise<SupportBoardInfo> {
  const b: any = await SupportTicketBoard.findOne({ key: "support" }).lean();
  return {
    configured: !!(b?.status === "ready" && b.roomId),
    status: b?.status ?? null,
    workspaceId: b?.workspaceId ?? null,
    workspaceName: b?.workspaceName ?? null,
    roomId: b?.roomId ?? null,
    roomName: b?.roomName ?? null,
    selectedBy: b?.selectedBy ?? null,
    selectedAt: b?.selectedAt ? new Date(b.selectedAt).toISOString() : null,
    lastError: b?.lastError ?? null,
  };
}

export interface SupportBoardOption {
  workspaceId: string;
  workspaceName: string;
  boards: { roomId: string; label: string }[];
}

/** Every workspace and board the owner can post to. */
export async function listSupportBoardOptions(): Promise<SupportBoardOption[]> {
  const owner = await ownerForSelection();
  const token = await mintUserToken(owner.userId, owner.orgId);
  const workspaces = asList(await taskroomRequest("workspaces/me?size=100&page=1", { token }));

  return Promise.all(
    workspaces
      .filter((w: any) => w?._id && w.status !== "inactive")
      .map(async (w: any) => {
        const workspaceId = String(w._id);
        const spaces = asList(
          await taskroomRequest(
            `spaces/me?workspaceId=${encodeURIComponent(workspaceId)}&page=1&size=100`,
            { token }
          ).catch(() => [])
        );
        const perSpace = await Promise.all(
          spaces.map(async (s: any) => {
            const rooms = asList(
              await taskroomRequest(
                `rooms/me?spaceId=${encodeURIComponent(String(s._id))}&page=1&size=100`,
                { token }
              ).catch(() => [])
            );
            return rooms
              .filter((r: any) => r?._id && r.status !== "inactive")
              .map((r: any) => ({
                roomId: String(r._id),
                label: `${s.name || "Untitled space"} › ${r.name || "Untitled board"}`,
              }));
          })
        );
        return {
          workspaceId,
          workspaceName: w.name || "Untitled workspace",
          boards: perSpace.flat(),
        };
      })
  );
}

/**
 * Point support tasks at a board. Validates the board is live, sits in the
 * picked workspace and that the owner can read its columns (i.e. post to it),
 * then stores it. Throws an Error whose message is safe to show the admin.
 */
export interface ResolvedBoard {
  owner: Owner;
  workspaceId: string;
  workspaceName: string | null;
  spaceId: string;
  roomId: string;
  roomName: string | null;
  stageId: string;
}

/**
 * Validate a board as the support board owner: live, in the given workspace,
 * and postable (the owner can read its columns). Shared by the global
 * selection and per-chat links. Throws an Error safe to show an admin.
 */
export async function resolveBoardAsOwner(
  workspaceId: string,
  roomId: string
): Promise<ResolvedBoard> {
  const owner = await ownerForSelection();
  const token = await mintUserToken(owner.userId, owner.orgId);

  const room: any = await taskroomRequest(`rooms/${roomId}`, { token }).catch(() => null);
  if (!room?._id || room.status === "inactive") {
    throw new Error("That Taskroom board no longer exists");
  }
  if (String(room.workspaceId) !== workspaceId) {
    throw new Error("That board isn't in the selected workspace");
  }

  let stages: any[];
  try {
    stages = asList(await taskroomRequest(`stages/room/${roomId}`, { token }));
  } catch {
    throw new Error("The support board owner isn't a member of that board");
  }
  const stageId = pickLandingStageId(stages);
  if (!stageId) throw new Error("That board has no columns yet — add one in Taskroom first");

  const workspace: any = await taskroomRequest(`workspaces/${workspaceId}`, { token }).catch(
    () => null
  );
  return {
    owner,
    workspaceId,
    workspaceName: workspace?.name || null,
    spaceId: String(room.spaceId || ""),
    roomId,
    roomName: room.name || null,
    stageId,
  };
}

/** The shared support board, provisioning it if needed; null if unavailable. */
export async function getSharedSupportBoard(): Promise<ResolvedBoard | null> {
  const board = await getBoard();
  if (!board) return null;
  const b: any = await SupportTicketBoard.findOne({ key: "support" }).lean();
  return {
    owner: { userId: board.ownerUserId, orgId: board.orgId },
    workspaceId: String(b?.workspaceId || ""),
    workspaceName: b?.workspaceName || null,
    spaceId: String(b?.spaceId || ""),
    roomId: board.roomId,
    roomName: b?.roomName || null,
    stageId: board.stageId,
  };
}

export async function setSupportBoard(input: {
  workspaceId: string;
  roomId: string;
  selectedBy: string;
}): Promise<SupportBoardInfo> {
  const r = await resolveBoardAsOwner(input.workspaceId, input.roomId);
  const { owner, stageId } = r;
  const room = { spaceId: r.spaceId, name: r.roomName };
  const workspace = { name: r.workspaceName };

  await SupportTicketBoard.findOneAndUpdate(
    { key: "support" },
    {
      $set: {
        ownerUserId: new Types.ObjectId(owner.userId),
        orgId: new Types.ObjectId(owner.orgId),
        workspaceId: input.workspaceId,
        workspaceName: workspace?.name || null,
        spaceId: String(room.spaceId || ""),
        roomId: input.roomId,
        roomName: room.name || null,
        stageId,
        status: "ready",
        lastError: null,
        selectedBy: input.selectedBy,
        selectedAt: new Date(),
      },
    },
    { upsert: true }
  );
  console.log(
    `[support-ticket-taskroom] board set to room=${input.roomId} stage=${stageId} by=${input.selectedBy}`
  );
  return getSupportBoardInfo();
}
