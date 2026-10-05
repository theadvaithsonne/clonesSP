// src/services/taskroomProvision.ts
//
// Provisions an isolated Taskroom room for a single service engagement
// (ServiceOpt), and reads that room back on the client's behalf.
//
// Design constraints this file exists to satisfy:
//
//  1. Taskroom v2 is a separate microservice that we do not own. Every call
//     below uses an endpoint the Taskroom UI already calls, with the same
//     payload shape. No schema change, no new endpoint, no behaviour change on
//     that side — a provisioned room is indistinguishable from a hand-made one.
//
//  2. Taskroom v2 has no per-stage visibility flag. The internal/shared
//     boundary therefore lives here: the stage ids we create for internal
//     columns are recorded on the opt-in as `taskroom.internalStageIds` and
//     stripped by `getClientBoard` before anything reaches the client. The
//     client's browser never receives internal cards and never learns the
//     roomId, so it cannot query Taskroom directly.
//
//  3. Provisioning is best-effort. It runs after the opt-in row is committed
//     and never throws into the checkout path. A failure leaves
//     `taskroom.status = "failed"` with the error recorded for retry.

import { Types } from "mongoose";
import {
  Service,
  IService,
  IServiceStageTemplate,
  IServiceTaskTemplate,
} from "../models/service.model";
import { ServiceOpt, IServiceOpt } from "../models/serviceOpt.model";
import { User } from "../models/user.model";
import { signJwt } from "./jwt";

// Trailing slash matches how the web app builds these URLs.
const TASKROOM_URL = (
  process.env.TASKROOM_V2_URL ||
  process.env.NEXT_PUBLIC_TASKROOM_URL ||
  "https://uatapi.garage.app/taskroomv2/v2/"
).replace(/\/?$/, "/");

const REQUEST_TIMEOUT_MS = 15000;
const MAX_PROVISION_ATTEMPTS = 3;

// The space every engagement room is filed under, created on first use.
const ENGAGEMENT_SPACE_NAME = "Client Engagements";

// Roles understood by Taskroom v2. The client gets `observer` — "can only view
// items" — which prevents writes on the Taskroom side as well as ours.
export type TaskroomRole = "admin" | "member" | "observer" | "commenter";
const CLIENT_ROLE: TaskroomRole = "observer";
// The people delivering the work need to move cards and log hours, so they join
// as full members rather than observers.
const STAFF_ROLE: TaskroomRole = "member";

// Taskroom's card priority enum is not ours: it has `normal` where the service
// wizard has `medium`. Sending an unmapped value fails Mongoose validation on
// their side and the card silently never appears.
const TASKROOM_PRIORITY: Record<string, string> = {
  low: "low",
  medium: "normal",
  high: "high",
};

export interface TaskroomCard {
  _id: string;
  name?: string;
  title?: string;
  description?: string;
  stageId: string;
  priority?: string;
  isCompleted?: boolean;
  startDate?: number | string;
  dueDate?: number | string;
  assignedToIds?: unknown[];
  members?: unknown[];
  tags?: unknown[];
  attachments?: unknown[];
  createdAt?: string;
  [key: string]: unknown;
}

export interface TaskroomStage {
  _id: string;
  name: string;
  color?: string;
  stageType?: string;
  orderId?: number;
  roomId?: string;
  taskCount?: number;
  cardData?: TaskroomCard[];
  cards?: TaskroomCard[];
  [key: string]: unknown;
}

/**
 * Mint a short-lived Garage JWT for a user so we can act as them against
 * Taskroom v2, which authenticates with the same token the web app holds.
 */
export async function mintUserToken(
  userId: string | Types.ObjectId,
  orgId: string | Types.ObjectId
): Promise<string> {
  const user = await User.findById(userId).select("name email").lean();
  return signJwt(
    {
      userId: userId.toString(),
      orgId: orgId.toString(),
      role: "founder",
      name: user?.name || "",
      email: user?.email || "",
    },
    { expiresIn: "10m" }
  );
}

interface TaskroomRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  token: string;
}

/**
 * Thin wrapper over the Taskroom v2 REST surface.
 *
 * Taskroom wraps successful payloads inconsistently — sometimes
 * `{data: {data: X}}`, sometimes `{data: X}` — so unwrapping is centralised
 * here to match what the web app does.
 */
export async function taskroomRequest<T = any>(
  path: string,
  { method = "GET", body, token }: TaskroomRequestOptions
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${TASKROOM_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(
        `Taskroom ${method} ${path} returned non-JSON (${response.status})`
      );
    }

    const ok =
      response.ok && payload?.status !== false && payload?.success !== false;

    if (!ok) {
      throw new Error(
        payload?.message ||
          `Taskroom ${method} ${path} failed with ${response.status}`
      );
    }

    return (payload?.data?.data ?? payload?.data ?? payload) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the workspace an engagement room belongs in.
 *
 * The founder picks this in Section 6 of the wizard and it is stored on the
 * service, so provisioning is deterministic: rooms land where the founder said
 * they should, not wherever their first workspace happens to be. A configured
 * id that no longer resolves is an error rather than a silent fallback —
 * quietly filing a client's room in the wrong workspace is worse than a failed
 * provision the founder can retry.
 */
async function resolveConfiguredWorkspaceId(
  token: string,
  configuredWorkspaceId: string
): Promise<string> {
  const workspace = await taskroomRequest<any>(
    `workspaces/${configuredWorkspaceId}`,
    { token }
  ).catch(() => null);

  if (!workspace?._id) {
    throw new Error(
      "The Taskroom workspace configured for this service no longer exists. " +
        "Pick a workspace again in the service's Taskroom section."
    );
  }

  return String(workspace._id);
}

/**
 * Find the founder's workspace, or create one if they have never opened
 * Taskroom. Only used for services saved before the wizard asked for a
 * workspace.
 */
async function resolveWorkspaceId(token: string): Promise<string> {
  const existing = await taskroomRequest<any>("workspaces/me?size=50&page=1", {
    token,
  });
  const list: any[] = Array.isArray(existing) ? existing : existing?.data || [];

  if (list.length > 0 && list[0]?._id) {
    return list[0]._id;
  }

  const created = await taskroomRequest<any>("workspaces", {
    method: "POST",
    token,
    body: {
      category: "work",
      name: "Client Delivery",
      color: "#008080",
    },
  });

  if (!created?._id) {
    throw new Error("Could not resolve or create a Taskroom workspace");
  }
  return created._id;
}

/**
 * Find the "Client Engagements" space inside a workspace, creating it on first
 * use. Every provisioned engagement room is filed here.
 */
async function resolveSpaceId(
  token: string,
  workspaceId: string
): Promise<string> {
  const existing = await taskroomRequest<any>(
    `spaces/me?workspaceId=${workspaceId}&page=1&size=50`,
    { token }
  );
  const list: any[] = Array.isArray(existing) ? existing : existing?.data || [];

  const match = list.find(
    (space) =>
      String(space?.name || space?.workspacename || "").toLowerCase() ===
      ENGAGEMENT_SPACE_NAME.toLowerCase()
  );
  if (match?._id) return match._id;

  const created = await taskroomRequest<any>("spaces", {
    method: "POST",
    token,
    body: {
      name: ENGAGEMENT_SPACE_NAME,
      description: "Client engagement rooms provisioned from Digital Services",
      color: "#008080",
      spaceCode: `client-engagements-${Math.random()
        .toString(36)
        .substring(2, 8)}`,
      workspaceId,
      // Taskroom reads `isPrivate`; the lowercase spelling is silently ignored
      // and the space would be shared with every workspace member.
      isPrivate: true,
      members: [],
    },
  });

  if (!created?._id) {
    throw new Error("Could not resolve or create the Client Engagements space");
  }
  return created._id;
}

// Taskroom's colour for `done` stages, so the seeded column matches a
// hand-made one.
const COMPLETED_STAGE_COLOR = "#10b981";

/** A column is the terminal one when it is the board's client-visible `done`. */
function isCompletedStage(stage: IServiceStageTemplate): boolean {
  return !stage.isInternal && stage.stageType === "done";
}

/**
 * Guarantee a client-visible Completed column and order the board as working
 * columns, then Completed, then the internal ones.
 *
 * Without it the client can tick a card's subtasks but has nowhere to drag the
 * card once the work is done. Applied to configured boards too, so services
 * saved before the wizard seeded this column still provision one.
 */
export function ensureCompletedStage(
  stages: IServiceStageTemplate[]
): IServiceStageTemplate[] {
  const withCompleted = stages.some(isCompletedStage)
    ? stages
    : [
        ...stages,
        {
          name: "Completed",
          color: COMPLETED_STAGE_COLOR,
          stageType: "done" as const,
          isInternal: false,
          tasks: [],
        },
      ];

  return [
    ...withCompleted.filter(
      (stage) => !stage.isInternal && !isCompletedStage(stage)
    ),
    ...withCompleted.filter(isCompletedStage),
    ...withCompleted.filter((stage) => stage.isInternal),
  ];
}

/**
 * Build the stage list to seed. When the founder configured stages in the
 * service wizard we use those verbatim; otherwise we derive one column per
 * milestone plus an Internal Notes column, which is the default the wizard's
 * board preview shows. Either way the board ends with a Completed column.
 *
 * Each milestone column carries exactly one card — the milestone itself — with
 * that milestone's deliverables as its subtasks. The board therefore reads as
 * the contract does: a milestone is the unit of delivery, a deliverable is a
 * line item inside it.
 *
 * A billable (hourly / retainer) service has no milestones to derive columns
 * from, so it gets the plain To Do / In Progress flow — the cards are added as
 * the hours are worked.
 */
export function resolveStageTemplates(
  service: Pick<IService, "milestones" | "taskroomConfig">
): IServiceStageTemplate[] {
  const configured = service.taskroomConfig?.stages;
  if (configured && configured.length > 0) {
    return ensureCompletedStage(configured as IServiceStageTemplate[]);
  }

  const sortedMilestones = (service.milestones || [])
    .slice()
    .sort((a, b) => a.order - b.order);

  const stages: IServiceStageTemplate[] =
    sortedMilestones.length > 0
      ? sortedMilestones.map((milestone, index) => ({
          name: `M${index + 1}: ${milestone.title}`,
          color: "#008080",
          stageType: index === 0 ? "tostart" : "active",
          isInternal: false,
          milestoneIndex: index,
          tasks: [
            {
              title: milestone.title,
              description: milestone.description,
              kind: "required" as const,
              priority: "medium" as const,
              subtasks: (milestone.deliverables || []).filter(
                (deliverable) => deliverable && deliverable.trim().length > 0
              ),
            },
          ],
        }))
      : [
          {
            name: "To Do",
            color: "#64748b",
            stageType: "tostart",
            isInternal: false,
            tasks: [],
          },
          {
            name: "In Progress",
            color: "#008080",
            stageType: "active",
            isInternal: false,
            tasks: [],
          },
        ];

  stages.push({
    name: "Internal Notes",
    color: "#64748b",
    stageType: "tostart",
    isInternal: true,
    tasks: [],
  });

  return ensureCompletedStage(stages);
}

interface ProvisionResult {
  roomId: string;
  spaceId: string;
  workspaceId: string;
  internalStageIds: string[];
  milestoneStages: { milestoneId: Types.ObjectId; stageId: string }[];
  /**
   * The delivery team as it was actually added, keyed by Taskroom user id so
   * the board proxy can name the assignee on a card. Pay rates are deliberately
   * not carried here — this is read on the client's behalf.
   */
  teamMembers: {
    userId: string;
    taskroomUserId: string;
    name: string;
    image?: string;
    role?: string;
  }[];
}

/**
 * Drop the four columns (Backlog / In Progress / Done / Review) Taskroom seeds
 * into every new room. The engagement board is defined by the service, so those
 * defaults are noise the client would otherwise see beside the real milestones.
 *
 * Best-effort: a leftover default column is cosmetic, an abandoned room is not.
 */
async function removeDefaultStages(
  token: string,
  roomId: string
): Promise<void> {
  try {
    const stages = await taskroomRequest<any>(`stages/room/${roomId}`, {
      token,
    });
    const list: TaskroomStage[] = Array.isArray(stages)
      ? stages
      : stages?.data || [];

    for (const stage of list) {
      if (stage?.type !== "default" || !stage?._id) continue;
      await taskroomRequest(`stages/${stage._id}`, {
        method: "DELETE",
        token,
      }).catch(() => undefined);
    }
  } catch (error) {
    console.error(
      "[TaskroomProvision] Could not clear the default stages:",
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Pin the created stages to the order the founder configured.
 *
 * `stages/add` derives its own `orderId` from the stage types already in the
 * room and ignores the one we send, so the columns come out in an order that
 * has nothing to do with the milestone sequence. This restates it once, at the
 * end, when every stage exists.
 */
async function applyStageOrder(
  token: string,
  roomId: string,
  stageIds: string[]
): Promise<void> {
  if (stageIds.length === 0) return;

  await taskroomRequest(`stages/room/${roomId}`, {
    method: "PUT",
    token,
    body: {
      updatedStages: stageIds.map((id, index) => ({
        _id: id,
        updatedOrderId: index + 1,
      })),
    },
  }).catch((error) => {
    console.error(
      "[TaskroomProvision] Could not apply the configured stage order:",
      error instanceof Error ? error.message : error
    );
  });
}

/**
 * Seed one column: the card, then its subtasks.
 *
 * A subtask in Taskroom is a task carrying `parentId`/`rootId`; it is excluded
 * from the board's card list and surfaces inside its parent, which is what
 * makes "milestone card, deliverables inside it" work without a second model.
 */
async function seedStageCards(
  token: string,
  roomId: string,
  stageId: string,
  tasks: IServiceTaskTemplate[],
  /** Garage user id → Taskroom user id, for the cards the wizard assigned. */
  staffIds: Map<string, string> = new Map()
): Promise<void> {
  for (const task of tasks) {
    const priority = TASKROOM_PRIORITY[task.priority || "medium"] || "normal";

    // An assignee we could not add to the room is dropped rather than sent:
    // Taskroom rejects an assignment to a non-member, which would cost the card
    // itself, and an unassigned card is the lesser loss.
    const assigneeId = task.assignee?.userId
      ? staffIds.get(task.assignee.userId)
      : undefined;
    const assignedToIds = assigneeId ? [assigneeId] : [];

    // A single seed card failing must not abandon the whole room.
    const card = await taskroomRequest<any>("tasks", {
      method: "POST",
      token,
      body: {
        roomId,
        stageId,
        title: task.title,
        description: task.description || "",
        priority,
        assignedToIds,
      },
    }).catch((error) => {
      console.error(
        `[TaskroomProvision] Seed card "${task.title}" failed:`,
        error instanceof Error ? error.message : error
      );
      return null;
    });

    const cardId: string | undefined = card?._id;
    if (!cardId) continue;

    for (const subtask of task.subtasks || []) {
      if (!subtask || !subtask.trim()) continue;
      await taskroomRequest("tasks", {
        method: "POST",
        token,
        body: {
          roomId,
          stageId,
          title: subtask.trim(),
          priority,
          // Subtasks inherit the card's owner — a deliverable belongs to
          // whoever owns the milestone it sits under.
          assignedToIds,
          rootId: cardId,
          parentId: cardId,
        },
      }).catch((error) => {
        console.error(
          `[TaskroomProvision] Seed subtask "${subtask}" failed:`,
          error instanceof Error ? error.message : error
        );
      });
    }
  }
}

interface RoomPerson {
  userId: string;
  email: string;
  name?: string;
  image?: string;
}

/**
 * Give somebody access to an engagement room, at the role they belong at:
 * `observer` for the client, `member` for the people delivering the work.
 *
 * Taskroom enforces the hierarchy — a room member must already be a space
 * member, and a space member must already be a workspace member — so all three
 * levels are walked in order. Adding at the workspace level also creates the
 * person's Taskroom user record if they have never opened Taskroom, which is
 * why it is keyed by email rather than by a Taskroom user id we do not have
 * yet.
 *
 * Every step is checked first, so re-provisioning does not stack duplicate
 * membership rows. Returns the Taskroom user id, which is what card assignment
 * is keyed by.
 */
export async function ensureRoomMembership(
  token: string,
  {
    orgId,
    workspaceId,
    spaceId,
    roomId,
    person,
    role,
  }: {
    orgId: string;
    workspaceId: string;
    spaceId: string;
    roomId: string;
    person: RoomPerson;
    role: TaskroomRole;
  }
): Promise<string> {
  const client = person;

  if (!client.email) {
    throw new Error(`${client.name || "This user"} has no email address on file`);
  }

  // Taskroom's member search is a regex over name and email, so `+` and `.` in
  // an address would change its meaning. Escaped here; membership is still
  // confirmed by id below rather than by the search hit alone.
  const search = encodeURIComponent(
    client.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );

  const list = async (path: string): Promise<any[]> => {
    const result = await taskroomRequest<any>(path, { token });
    if (Array.isArray(result)) return result;
    return result?.data || [];
  };

  /**
   * The client's Taskroom user id, which is a record of its own and not the
   * Garage user id. Looked up by exact `userId` filter, not by search.
   */
  const findTaskroomUserId = async (): Promise<string | undefined> => {
    const users = await list(
      `users?orgId=${encodeURIComponent(orgId)}&userId=${client.userId}&size=5&page=1`
    );
    return users[0]?._id ? String(users[0]._id) : undefined;
  };

  // 1. Workspace. Adding here also creates the Taskroom user record when the
  //    client has never opened Taskroom, which is why it is keyed by email.
  let taskroomUserId = await findTaskroomUserId();

  const isMember = (members: any[]) =>
    members.some(
      (member) =>
        (taskroomUserId && String(member?.userId) === taskroomUserId) ||
        String(member?.userData?.email || "").toLowerCase() ===
          client.email.toLowerCase()
    );

  const workspaceMembers = await list(
    `workspace/members?workspaceId=${workspaceId}&search=${search}&size=50&page=1`
  );

  if (!taskroomUserId || !isMember(workspaceMembers)) {
    await taskroomRequest("workspace/members/bulk", {
      method: "POST",
      token,
      body: {
        orgId,
        workspaceId,
        membersList: [
          {
            memberUserId: client.userId,
            email: client.email,
            name: client.name || client.email,
            image: client.image,
            role,
          },
        ],
      },
    });

    taskroomUserId = await findTaskroomUserId();
  }

  if (!taskroomUserId) {
    throw new Error(
      `Could not resolve the Taskroom user record for ${client.email}`
    );
  }

  // 2. Space — a room member must already be one.
  const spaceMembers = await list(
    `space/members?workspaceId=${workspaceId}&spaceId=${spaceId}&search=${search}&size=50&page=1`
  );
  if (!isMember(spaceMembers)) {
    await taskroomRequest("space/members/bulk", {
      method: "POST",
      token,
      body: {
        spaceId,
        workspaceId,
        membersList: [{ userId: taskroomUserId, role }],
      },
    });
  }

  // 3. Room.
  const roomMembers = await list(
    `room/members?spaceId=${spaceId}&roomId=${roomId}&search=${search}&size=50&page=1`
  );
  if (!isMember(roomMembers)) {
    await taskroomRequest("room/members/bulk", {
      method: "POST",
      token,
      body: {
        spaceId,
        roomId,
        membersList: [{ userId: taskroomUserId, role }],
      },
    });
  }

  return taskroomUserId;
}

/** The client's own membership: observer, so the board is read-only for them. */
async function ensureClientMembership(
  token: string,
  args: {
    orgId: string;
    workspaceId: string;
    spaceId: string;
    roomId: string;
    client: RoomPerson;
  }
): Promise<void> {
  await ensureRoomMembership(token, {
    ...args,
    person: args.client,
    role: CLIENT_ROLE,
  });
}

/**
 * Everyone the founder put on this service: the delivery roster from the hourly
 * setup plus anybody named on a card in Section 6, deduplicated by user id.
 *
 * The two lists are one team — a card can be given to someone who is not on the
 * roster (a milestone service has no roster at all), and a roster member with
 * no cards yet still belongs in the room.
 */
function resolveStaffRoster(
  service: Pick<IService, "hourlyConfig">,
  stages: IServiceStageTemplate[]
): RoomPerson[] {
  const byId = new Map<string, RoomPerson>();

  const add = (person: Partial<RoomPerson> | undefined) => {
    const userId = String(person?.userId || "").trim();
    const email = String(person?.email || "").trim();
    if (!userId || !email || byId.has(userId)) return;
    byId.set(userId, {
      userId,
      email,
      name: person?.name || email,
      image: person?.image,
    });
  };

  for (const member of service.hourlyConfig?.team || []) add(member);
  for (const stage of stages) {
    for (const task of stage.tasks || []) add(task.assignee);
  }

  return [...byId.values()];
}

/**
 * Add the delivery team to the room and return the Garage → Taskroom user id
 * map that card assignment is keyed by.
 *
 * Best-effort per person: someone who cannot be added (no Taskroom record, a
 * failed call) costs their cards an assignee, which the founder can fix inside
 * Taskroom. Failing the whole provision over it would cost the client their
 * room.
 */
async function ensureStaffMembership(
  token: string,
  {
    orgId,
    workspaceId,
    spaceId,
    roomId,
    staff,
  }: {
    orgId: string;
    workspaceId: string;
    spaceId: string;
    roomId: string;
    staff: RoomPerson[];
  }
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();

  for (const person of staff) {
    try {
      const taskroomUserId = await ensureRoomMembership(token, {
        orgId,
        workspaceId,
        spaceId,
        roomId,
        person,
        role: STAFF_ROLE,
      });
      resolved.set(person.userId, taskroomUserId);
    } catch (error) {
      console.error(
        `[TaskroomProvision] Could not add ${person.email} to the room:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return resolved;
}

/**
 * Create the room, its stages and its seed cards, then add the client as an
 * observer. Pure orchestration — persistence is the caller's job.
 */
async function provisionRoom(
  service: IService,
  optIn: IServiceOpt,
  client: { userId: string; name: string; email: string; image?: string }
): Promise<ProvisionResult> {
  const founderToken = await mintUserToken(
    service.createdBy,
    service.organizationId
  );

  const configuredWorkspaceId = service.taskroomConfig?.workspaceId;
  const workspaceId = configuredWorkspaceId
    ? await resolveConfiguredWorkspaceId(founderToken, configuredWorkspaceId)
    : await resolveWorkspaceId(founderToken);
  const spaceId =
    service.taskroomConfig?.spaceId ||
    (await resolveSpaceId(founderToken, workspaceId));

  // Room name mirrors the mock: "[Web Sprint] - Acme Corp"
  const room = await taskroomRequest<any>("rooms", {
    method: "POST",
    token: founderToken,
    body: {
      name: `[${service.title}] - ${client.name}`,
      description: `Client engagement room for ${service.title}`,
      spaceId,
      color: "#008080",
      bgImage: "",
      // Private so the room is never visible to the wider space by default.
      isPrivate: true,
      members: [],
      setDefault: false,
    },
  });

  if (!room?._id) {
    throw new Error("Taskroom did not return a room id");
  }
  const roomId: string = room._id;

  await removeDefaultStages(founderToken, roomId);

  const stageTemplates = resolveStageTemplates(service);
  const sortedMilestones = (service.milestones || [])
    .slice()
    .sort((a, b) => a.order - b.order);

  // The delivery team joins before any card is created: Taskroom will not
  // accept an assignment to a non-member, so the roster has to exist first.
  const staff = resolveStaffRoster(service, stageTemplates);
  const staffIds = await ensureStaffMembership(founderToken, {
    orgId: service.organizationId.toString(),
    workspaceId,
    spaceId,
    roomId,
    staff,
  });

  const teamMembers = staff
    .filter((person) => staffIds.has(person.userId))
    .map((person) => ({
      userId: person.userId,
      taskroomUserId: staffIds.get(person.userId) as string,
      name: person.name || person.email,
      image: person.image,
      role: (service.hourlyConfig?.team || []).find(
        (member) => member.userId === person.userId
      )?.role,
    }));

  const internalStageIds: string[] = [];
  const createdStageIds: string[] = [];
  const milestoneStages: { milestoneId: Types.ObjectId; stageId: string }[] = [];

  for (let index = 0; index < stageTemplates.length; index++) {
    const template = stageTemplates[index];

    const stage = await taskroomRequest<any>("stages/add", {
      method: "POST",
      token: founderToken,
      body: {
        name: template.name,
        color: template.color || "#008080",
        stageType: template.stageType || "tostart",
        type: "custom",
        orderId: index + 1,
        roomId,
      },
    });

    const stageId: string | undefined = stage?._id;
    if (!stageId) continue;

    createdStageIds.push(stageId);

    if (template.isInternal) {
      internalStageIds.push(stageId);
    }

    if (
      typeof template.milestoneIndex === "number" &&
      sortedMilestones[template.milestoneIndex]
    ) {
      milestoneStages.push({
        milestoneId: sortedMilestones[template.milestoneIndex]._id,
        stageId,
      });
    }

    // A card in an internal column is internal regardless of its own kind;
    // the whole column is stripped before the client ever sees the board.
    await seedStageCards(
      founderToken,
      roomId,
      stageId,
      template.tasks || [],
      staffIds
    );
  }

  await applyStageOrder(founderToken, roomId, createdStageIds);

  // Add the client last, so they never observe a half-built board.
  await ensureClientMembership(founderToken, {
    orgId: service.organizationId.toString(),
    workspaceId,
    spaceId,
    roomId,
    client: {
      userId: optIn.userId.toString(),
      email: client.email,
      name: client.name,
      image: client.image,
    },
  }).catch((error) => {
    // The board still works for the founder without this; the client falls
    // back to the proxied read, which does not depend on room membership.
    console.error(
      "[TaskroomProvision] Adding client as observer failed:",
      error instanceof Error ? error.message : error
    );
  });

  return {
    roomId,
    spaceId,
    workspaceId,
    internalStageIds,
    milestoneStages,
    teamMembers,
  };
}

/**
 * Provision the engagement room for an opt-in, recording the outcome on the
 * opt-in document.
 *
 * Safe to call more than once: an opt-in that already has a room is returned
 * untouched. Never throws — callers are checkout paths.
 */
export async function provisionEngagementRoom(
  optInId: string | Types.ObjectId
): Promise<IServiceOpt | null> {
  const optIn = await ServiceOpt.findById(optInId);
  if (!optIn) return null;

  // Already provisioned, or being provisioned by a concurrent caller.
  if (
    optIn.taskroom?.status === "ready" ||
    optIn.taskroom?.status === "provisioning"
  ) {
    return optIn;
  }

  if ((optIn.taskroom?.attempts || 0) >= MAX_PROVISION_ATTEMPTS) {
    return optIn;
  }

  const service = await Service.findById(optIn.serviceId);
  if (!service) return optIn;

  // Founder opted out of taskrooms for this service — record it and stop, so
  // the retry sweep does not keep picking this opt-in up.
  if (!service.taskroomConfig?.enabled) {
    optIn.set("taskroom.status", "skipped");
    optIn.set("taskroom.internalStageIds", optIn.taskroom?.internalStageIds || []);
    optIn.set("taskroom.milestoneStages", optIn.taskroom?.milestoneStages || []);
    optIn.set("taskroom.attempts", optIn.taskroom?.attempts || 0);
    await optIn.save();
    return optIn;
  }

  optIn.set("taskroom.status", "provisioning");
  optIn.set("taskroom.attempts", (optIn.taskroom?.attempts || 0) + 1);
  optIn.set("taskroom.internalStageIds", optIn.taskroom?.internalStageIds || []);
  optIn.set("taskroom.milestoneStages", optIn.taskroom?.milestoneStages || []);
  await optIn.save();

  try {
    const client = await User.findById(optIn.userId)
      .select("name email profilePicture")
      .lean();

    const result = await provisionRoom(service, optIn, {
      userId: optIn.userId.toString(),
      name: client?.name || client?.email || "Client",
      email: client?.email || "",
      image: (client as any)?.profilePicture || undefined,
    });

    optIn.set("taskroom.status", "ready");
    optIn.set("taskroom.roomId", result.roomId);
    optIn.set("taskroom.spaceId", result.spaceId);
    optIn.set("taskroom.workspaceId", result.workspaceId);
    optIn.set("taskroom.internalStageIds", result.internalStageIds);
    optIn.set("taskroom.milestoneStages", result.milestoneStages);
    optIn.set("taskroom.teamMembers", result.teamMembers);
    optIn.set("taskroom.error", undefined);
    optIn.set("taskroom.provisionedAt", new Date());
    await optIn.save();

    return optIn;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[TaskroomProvision] Failed for opt-in ${optIn._id}:`,
      message
    );
    optIn.set("taskroom.status", "failed");
    optIn.set("taskroom.error", message);
    await optIn.save();
    return optIn;
  }
}

/**
 * Fire-and-forget wrapper for checkout paths. Provisioning latency (several
 * sequential Taskroom calls) must never be added to the client's payment
 * round-trip, and its failure must never fail the purchase.
 */
export function provisionEngagementRoomAsync(
  optInId: string | Types.ObjectId
): void {
  setImmediate(() => {
    provisionEngagementRoom(optInId).catch((error) => {
      console.error(
        "[TaskroomProvision] Unhandled provisioning error:",
        error instanceof Error ? error.message : error
      );
    });
  });
}

export interface ClientBoardStage {
  _id: string;
  name: string;
  color?: string;
  stageType?: string;
  orderId?: number;
  cards: TaskroomCard[];
}

/** A delivery-team member as the client sees them: no rate, no email. */
export interface ClientBoardMember {
  name: string;
  image?: string;
  role?: string;
}

export interface ClientBoard {
  roomId: string;
  stages: ClientBoardStage[];
  team: ClientBoardMember[];
  access: IService["taskroomConfig"] extends undefined
    ? never
    : {
        showTaskroomBoard: boolean;
        showActivityLogs: boolean;
        enableFilesTab: boolean;
        revealTimelogSheet: boolean;
        showProgressStatusGauge: boolean;
      };
  progress: {
    milestonePercentage: number;
    completedMilestones: number;
    totalMilestones: number;
    taskPercentage: number;
    completedTasks: number;
    totalTasks: number;
  };
}

export const DEFAULT_CLIENT_ACCESS = {
  showTaskroomBoard: true,
  showActivityLogs: true,
  enableFilesTab: true,
  revealTimelogSheet: false,
  showProgressStatusGauge: true,
};

/**
 * Read an engagement board on the client's behalf, with internal columns
 * removed.
 *
 * This is the only path by which a client sees taskroom data. Filtering happens
 * here rather than in the browser precisely because a client-side filter would
 * still ship internal cards over the wire.
 *
 * The caller is responsible for asserting that the requester owns the opt-in.
 */
export async function getClientBoard(
  optIn: IServiceOpt,
  service: IService,
  options: {
    /**
     * Founders reading their own engagement still get the board when it is
     * switched off for clients — they see the same filtered view, which is the
     * point of looking.
     */
    ignoreVisibilitySwitch?: boolean;
  } = {}
): Promise<ClientBoard | null> {
  const roomId = optIn.taskroom?.roomId;
  if (!roomId || optIn.taskroom?.status !== "ready") return null;

  const access = {
    ...DEFAULT_CLIENT_ACCESS,
    ...(service.taskroomConfig?.clientAccess || {}),
  };

  if (!access.showTaskroomBoard && !options.ignoreVisibilitySwitch) return null;

  // Read as the founder: the client is an observer on the room, but we never
  // hand them a token that reaches Taskroom directly.
  const founderToken = await mintUserToken(
    service.createdBy,
    service.organizationId
  );

  const detail = await taskroomRequest<any>(
    `rooms/detail/${roomId}?page=1&size=50&cardSize=30`,
    { token: founderToken }
  );

  // `rooms/detail` answers with the stage array directly; the object-wrapped
  // shapes are tolerated because older Taskroom builds returned those.
  const rawStages: TaskroomStage[] = Array.isArray(detail)
    ? detail
    : detail?.stages || detail?.stageData || detail?.data || [];

  const internal = new Set(optIn.taskroom?.internalStageIds || []);

  // Who a card's `assignedToIds` point at. Only people we put in the room are
  // resolvable, which is the intent: a client sees the delivery team, not every
  // Taskroom user the founder later invited by hand.
  const roomTeam = optIn.taskroom?.teamMembers || [];
  const byTaskroomId = new Map(
    roomTeam.map((member) => [
      String(member.taskroomUserId),
      { name: member.name, image: member.image, role: member.role },
    ])
  );

  const stages: ClientBoardStage[] = (
    Array.isArray(rawStages) ? rawStages : []
  )
    .filter((stage) => !internal.has(String(stage._id)))
    .map((stage) => ({
      _id: String(stage._id),
      name: stage.name,
      color: stage.color,
      stageType: stage.stageType,
      orderId: stage.orderId,
      cards: (stage.cardData || stage.cards || []).map((card) =>
        withAssignees(stripCardForClient(card, access), byTaskroomId)
      ),
    }))
    .sort((a, b) => (a.orderId ?? 0) - (b.orderId ?? 0));

  const totalTasks = stages.reduce((sum, stage) => sum + stage.cards.length, 0);
  const completedTasks = stages.reduce(
    (sum, stage) => sum + stage.cards.filter((card) => card.isCompleted).length,
    0
  );

  return {
    roomId,
    stages,
    access,
    team: roomTeam.map((member) => ({
      name: member.name,
      image: member.image,
      role: member.role,
    })),
    progress: {
      // The contract number the client is billed against.
      milestonePercentage: optIn.progressPercentage || 0,
      completedMilestones: optIn.completedMilestones || 0,
      totalMilestones: optIn.totalMilestones || 0,
      // Secondary, derived from the visible cards only.
      taskPercentage:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      completedTasks,
      totalTasks,
    },
  } as ClientBoard;
}

/**
 * Name the people a card is assigned to.
 *
 * Taskroom answers with its own user ids, which mean nothing to a client, so
 * they are resolved against the roster we put in the room and replaced by a
 * name and an avatar. Ids that resolve to nobody are dropped rather than passed
 * through — an opaque id is not information, and it is one more handle on
 * another system than a client needs.
 */
function withAssignees(
  card: TaskroomCard,
  byTaskroomId: Map<string, ClientBoardMember>
): TaskroomCard {
  const raw = Array.isArray(card.assignedToIds)
    ? card.assignedToIds
    : card.assignedToId
      ? [card.assignedToId]
      : [];

  const assignees = raw
    .map((id) => byTaskroomId.get(String(id)))
    .filter((member): member is ClientBoardMember => !!member);

  const { assignedToIds, assignedToId, ...rest } = card as Record<
    string,
    unknown
  >;

  return { ...(rest as TaskroomCard), assignees };
}

export interface EngagementRoomFile {
  _id: string;
  name: string;
  url: string;
  fileType?: string;
  uploadedAt?: string;
}

/**
 * Files attached to cards in the engagement room.
 *
 * Read as the founder and handed to the client through our own API, like the
 * board itself — the client never gets a token that reaches Taskroom.
 * Best-effort: the Files tab still has the milestone documents without this.
 */
export async function getRoomFiles(
  optIn: IServiceOpt,
  service: IService
): Promise<EngagementRoomFile[]> {
  const roomId = optIn.taskroom?.roomId;
  if (!roomId || optIn.taskroom?.status !== "ready") return [];

  try {
    const founderToken = await mintUserToken(
      service.createdBy,
      service.organizationId
    );

    const result = await taskroomRequest<any>(
      `attachments?roomId=${roomId}&size=100&page=1`,
      { token: founderToken }
    );
    const list: any[] = Array.isArray(result) ? result : result?.data || [];

    return list
      .filter((file) => file?.link)
      .map((file) => ({
        _id: String(file._id),
        name: file.name || "Attachment",
        url: file.link,
        fileType: file.fileType,
        uploadedAt: file.createdAt,
      }));
  } catch (error) {
    console.error(
      "[TaskroomProvision] Could not read the room attachments:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Drop card fields the client has not been granted. Time tracking is the one
 * that is opt-in rather than opt-out.
 *
 * Comment and audit trails go with `showActivityLogs`: the card payload carries
 * comment counts and edit history, and a client whose founder turned activity
 * off must not receive them just because they are attached to a visible card.
 */
function stripCardForClient(
  card: TaskroomCard,
  access: typeof DEFAULT_CLIENT_ACCESS
): TaskroomCard {
  const {
    timeEstimate,
    timeLogged,
    timeLogs,
    totalTimeSpent,
    ...rest
  } = card as Record<string, unknown>;

  if (!access.showActivityLogs) {
    for (const field of [
      "commentData",
      "comments",
      "commentCount",
      "activity",
      "activityLogs",
      "logs",
      "history",
      "auditLogs",
      "updatedAt",
    ]) {
      delete rest[field];
    }
  }

  if (access.revealTimelogSheet) {
    return {
      ...rest,
      timeEstimate,
      timeLogged,
      timeLogs,
      totalTimeSpent,
    } as unknown as TaskroomCard;
  }

  return rest as unknown as TaskroomCard;
}
