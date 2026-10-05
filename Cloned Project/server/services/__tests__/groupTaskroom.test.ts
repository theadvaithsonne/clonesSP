/**
 * Group chat × Taskroom: the member-sync diff, the pickers it relies on, the
 * per-group run queue, and one reconcile pass against an in-memory stand-in
 * for the Taskroom endpoints it calls (no network, no database).
 */
jest.mock("../../models/group.model", () => ({
  Group: { findById: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("../../models/user.model", () => ({
  User: { find: jest.fn(), findById: jest.fn() },
}));
jest.mock("../taskroomProvision", () => ({
  mintUserToken: jest.fn(),
  taskroomRequest: jest.fn(),
}));
jest.mock("../groupTaskroomActor", () => ({
  withTaskroomActor: jest.fn(),
  // Same test as the real one.
  isTaskroomUnauthorized: (error: any) => /unauthori[sz]ed/i.test(error?.message || ""),
  NoTaskroomActorError: class NoTaskroomActorError extends Error {},
}));
jest.mock("../groupSystemMessage", () => ({ writeGroupSystemMessage: jest.fn() }));
jest.mock("../supportChat", () => ({
  isSupportGroup: (g: any) => g?.kind === "support",
}));

import { Types } from "mongoose";
import { Group } from "../../models/group.model";
import { User } from "../../models/user.model";
import { mintUserToken, taskroomRequest } from "../taskroomProvision";
import { withTaskroomActor } from "../groupTaskroomActor";
import { writeGroupSystemMessage } from "../groupSystemMessage";
import {
  TASKROOM_ACCOUNT_MISSING_MESSAGE,
  linkGroupTaskroom,
  pickLandingStageId,
  pickTaskroomAccounts,
  planMemberSync,
  requestGroupTaskroomSync,
  serializeGroupTaskroom,
} from "../groupTaskroom";

const GroupMock = Group as any;
const UserMock = User as any;
const taskroomMock = taskroomRequest as unknown as jest.Mock;
const actorMock = withTaskroomActor as unknown as jest.Mock;
const pillMock = writeGroupSystemMessage as unknown as jest.Mock;

/** Let every queued promise and setImmediate run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 30; i++) await new Promise((resolve) => setImmediate(resolve));
}

const leanOf = (value: any) => ({ select: () => ({ lean: async () => value }) });

describe("planMemberSync", () => {
  const ids = (pairs: Record<string, string>) => new Map(Object.entries(pairs));

  it("keeps people already on the board and adds the rest", () => {
    const plan = planMemberSync(["a", "b", "c"], [], ["tA"], ids({ a: "tA", b: "tB" }), "a");
    expect(plan.keep).toEqual([{ userId: "a", taskroomUserId: "tA", addedBySync: false }]);
    expect(plan.add).toEqual([
      { userId: "b", taskroomUserId: "tB" },
      { userId: "c", taskroomUserId: null },
    ]);
    expect(plan.remove).toEqual([]);
    expect(plan.forget).toEqual([]);
  });

  it("keeps addedBySync only for people an earlier run put on the board", () => {
    const plan = planMemberSync(
      ["a", "b"],
      [
        { userId: "a", taskroomUserId: "tA", addedBySync: true },
        { userId: "b", taskroomUserId: "tB", addedBySync: false },
      ],
      ["tA", "tB"],
      ids({ a: "tA", b: "tB" })
    );
    expect(plan.keep).toEqual([
      { userId: "a", taskroomUserId: "tA", addedBySync: true },
      { userId: "b", taskroomUserId: "tB", addedBySync: false },
    ]);
  });

  it("removes a former member only when the sync added them and they are still on", () => {
    const plan = planMemberSync(
      ["a"],
      [
        { userId: "x", taskroomUserId: "tX", addedBySync: true },
        { userId: "y", taskroomUserId: "tY", addedBySync: false },
        { userId: "z", taskroomUserId: "tZ", addedBySync: true },
        { userId: "w", taskroomUserId: null, addedBySync: true },
      ],
      ["tA", "tX", "tY"],
      ids({ a: "tA" })
    );
    expect(plan.remove).toEqual([{ userId: "x", taskroomUserId: "tX" }]);
    expect(plan.forget).toEqual(["y", "z", "w"]);
  });

  it("never removes the admin who linked the board", () => {
    const plan = planMemberSync(
      [],
      [{ userId: "L", taskroomUserId: "tL", addedBySync: true }],
      ["tL"],
      ids({}),
      "L"
    );
    expect(plan.remove).toEqual([]);
    expect(plan.forget).toEqual(["L"]);
  });

  it("de-duplicates members and entries", () => {
    const plan = planMemberSync(
      ["a", "a"],
      [
        { userId: "x", taskroomUserId: "tX", addedBySync: true },
        { userId: "x", taskroomUserId: "tX", addedBySync: true },
      ],
      ["tX"],
      ids({})
    );
    expect(plan.add).toEqual([{ userId: "a", taskroomUserId: null }]);
    expect(plan.remove).toEqual([{ userId: "x", taskroomUserId: "tX" }]);
  });
});

describe("pickLandingStageId", () => {
  it("lands on Backlog on a fresh board, where every default column has orderId 1", () => {
    expect(
      pickLandingStageId([
        { _id: "s1", name: "Backlog", stageType: "tostart", orderId: 1 },
        { _id: "s2", name: "In Progress", stageType: "active", orderId: 1 },
        { _id: "s3", name: "Done", stageType: "done", orderId: 1 },
        { _id: "s4", name: "Review", stageType: "closed", orderId: 1 },
      ])
    ).toBe("s1");
  });

  it("prefers the lowest-ordered tostart column", () => {
    expect(
      pickLandingStageId([
        { _id: "a", stageType: "active", orderId: 1 },
        { _id: "b", stageType: "tostart", orderId: 3 },
        { _id: "c", stageType: "tostart", orderId: 2 },
      ])
    ).toBe("c");
  });

  it("falls back to the lowest-ordered column, keeping Taskroom's order on ties", () => {
    expect(
      pickLandingStageId([
        { _id: "x", stageType: "active", orderId: 2 },
        { _id: "y", stageType: "done", orderId: 1 },
        { _id: "z", stageType: "active", orderId: 1 },
      ])
    ).toBe("y");
  });

  it("is null for a board without columns", () => {
    expect(pickLandingStageId([])).toBeNull();
  });
});

describe("pickTaskroomAccounts", () => {
  // Taskroom lists accounts newest first.
  const records = [
    { _id: "t-new", userId: "u1", email: "priya@x.com" },
    { _id: "t-caps", userId: "u1", email: "Priya@X.com" },
    { _id: "t-old", userId: "u2", email: "old@x.com" },
    { _id: "t-only", userId: "u3", email: "someone@x.com" },
  ];

  it("prefers the exact-email account, the one Taskroom's auth resolves", () => {
    const picked = pickTaskroomAccounts(records, new Map([["u1", "Priya@X.com"]]));
    expect(picked.get("u1")).toEqual({ id: "t-caps", email: "Priya@X.com" });
  });

  it("falls back to a case-insensitive match", () => {
    const picked = pickTaskroomAccounts(records, new Map([["u1", "PRIYA@x.com"]]));
    expect(picked.get("u1")?.id).toBe("t-new");
  });

  it("ignores an account under an address the person no longer has", () => {
    expect(pickTaskroomAccounts(records, new Map([["u2", "new@x.com"]])).has("u2")).toBe(false);
  });

  it("uses the only candidate there is when the person has no email", () => {
    expect(pickTaskroomAccounts(records, new Map([["u3", null]])).get("u3")?.id).toBe("t-only");
  });
});

describe("requestGroupTaskroomSync queue", () => {
  it("runs once more when asked mid-run, however many times it was asked", async () => {
    const gates: Array<() => void> = [];
    GroupMock.findById.mockImplementation(() => ({
      select: () => ({
        lean: () => new Promise((resolve) => gates.push(() => resolve(null))),
      }),
    }));
    const id = new Types.ObjectId().toString();

    requestGroupTaskroomSync(id);
    requestGroupTaskroomSync(id);
    requestGroupTaskroomSync(id);
    expect(GroupMock.findById).toHaveBeenCalledTimes(1);

    gates.shift()!();
    await settle();
    expect(GroupMock.findById).toHaveBeenCalledTimes(2);

    gates.shift()!();
    await settle();
    expect(GroupMock.findById).toHaveBeenCalledTimes(2);

    // Drained — the next request starts a fresh run.
    requestGroupTaskroomSync(id);
    expect(GroupMock.findById).toHaveBeenCalledTimes(3);
    gates.shift()!();
    await settle();
  });

  it("ignores ids that are not ObjectIds, without throwing", () => {
    expect(() => requestGroupTaskroomSync("not-an-id")).not.toThrow();
    expect(GroupMock.findById).not.toHaveBeenCalled();
  });
});

describe("serializeGroupTaskroom", () => {
  it("is undefined for an unlinked group", async () => {
    expect(
      await serializeGroupTaskroom({ _id: new Types.ObjectId(), members: [] })
    ).toBeUndefined();
  });

  it("counts only people still in the group and names the failures", async () => {
    const linker = new Types.ObjectId();
    const stillIn = new Types.ObjectId();
    const failedIn = new Types.ObjectId();
    const left = new Types.ObjectId();
    UserMock.find.mockReturnValue(
      leanOf([
        { _id: linker, name: "Priya" },
        { _id: failedIn, email: "devon@x.com" },
      ])
    );
    const linkedAt = new Date("2026-09-01T10:00:00Z");

    const summary = await serializeGroupTaskroom({
      _id: new Types.ObjectId(),
      members: [{ userId: linker }, { userId: stillIn }, { userId: failedIn }],
      taskroom: {
        enabled: true,
        status: "active",
        mode: "existing-board",
        workspaceId: "w1",
        workspaceName: "Ops",
        spaceId: "s1",
        roomId: "r1",
        roomName: "Launch",
        linkedBy: linker,
        linkedAt,
        lastSyncAt: null,
        lastError: null,
        members: [
          { userId: linker, status: "synced", addedBySync: false },
          { userId: stillIn, status: "synced", addedBySync: true },
          { userId: failedIn, status: "failed", error: "No email address on file" },
          { userId: left, status: "failed", error: "gone" },
        ],
      },
    });

    expect(summary).toEqual({
      enabled: true,
      status: "active",
      mode: "existing-board",
      workspaceId: "w1",
      workspaceName: "Ops",
      spaceId: "s1",
      roomId: "r1",
      roomName: "Launch",
      linkedBy: String(linker),
      linkedByName: "Priya",
      linkedAt: linkedAt.toISOString(),
      lastError: null,
      memberSync: {
        running: false,
        synced: 2,
        failed: 1,
        lastSyncAt: null,
        failures: [
          { userId: String(failedIn), name: "devon", error: "No email address on file" },
        ],
      },
    });
  });
});

/**
 * A stand-in for the Taskroom v2 routes the sync calls, with the behaviour
 * that matters here: bulk adds do not de-duplicate, workspace bulk matches
 * accounts by exact email and mints lower-cased ones.
 */
function fakeTaskroom(seed: {
  users: { _id: string; userId: string; email: string }[];
  workspace: string[];
  space: string[];
  room: string[];
  refuseBulk?: Set<string>;
  refuseSingle?: Set<string>;
}) {
  const state = {
    users: [...seed.users],
    workspace: new Set(seed.workspace),
    space: new Set(seed.space),
    room: seed.room.map((userId, i) => ({ _id: `row-${i}`, userId })),
    calls: [] as { method: string; path: string; body?: any }[],
  };
  let rows = state.room.length;

  taskroomMock.mockImplementation(async (path: string, opts: any = {}) => {
    const method = opts.method || "GET";
    state.calls.push({ method, path, body: opts.body });
    const route = path.split("?")[0];

    if (method === "GET" && route === "rooms/room1") {
      return { _id: "room1", name: "Launch", spaceId: "space1", workspaceId: "ws1", status: "active" };
    }
    if (method === "GET" && route === "users") return state.users;
    if (method === "GET" && route === "room/members") return state.room;
    if (method === "GET" && route === "workspace/members/all") {
      return [...state.workspace].map((userId) => ({ userId }));
    }
    if (method === "GET" && route === "space/members") {
      return [...state.space].map((userId) => ({ userId }));
    }
    if (method === "POST" && route === "workspace/members/bulk") {
      for (const member of opts.body.membersList) {
        let user = state.users.find((u) => u.email === member.email);
        if (!user) {
          user = { _id: `t-${member.memberUserId}`, userId: member.memberUserId, email: member.email.toLowerCase() };
          state.users.push(user);
        }
        state.workspace.add(user._id);
      }
      return [];
    }
    if (method === "POST" && (route === "space/members/bulk" || route === "room/members/bulk")) {
      if (seed.refuseBulk?.has(route)) throw new Error("Some member Records doesn't exists in workspace");
      for (const { userId } of opts.body.membersList) {
        if (route === "space/members/bulk") state.space.add(userId);
        else state.room.push({ _id: `row-${rows++}`, userId });
      }
      return [];
    }
    if (method === "POST" && route === "room/members") {
      if (seed.refuseSingle?.has(opts.body.trUserId)) throw new Error("Internal server error");
      state.room.push({ _id: `row-${rows++}`, userId: opts.body.trUserId });
      return {};
    }
    if (method === "DELETE" && route.startsWith("room/members/")) {
      const id = route.split("/")[2];
      state.room = state.room.filter((row) => row._id !== id);
      return {};
    }
    throw new Error(`unexpected ${method} ${path}`);
  });

  return state;
}

describe("member sync against Taskroom", () => {
  const oid = () => new Types.ObjectId();
  const linker = oid();
  const hasAccount = oid();
  const newcomer = oid();
  const phoneOnly = oid();
  const groupId = oid();

  const users = [
    { _id: linker, name: "Priya", email: "priya@x.com" },
    { _id: hasAccount, name: "Devon", email: "Devon@X.com" },
    { _id: newcomer, name: "Sam", email: "Sam@X.com" },
    { _id: phoneOnly, name: "Ravi" },
  ];

  function groupWith(members: Types.ObjectId[], linkMembers: any[] = []) {
    return {
      _id: groupId,
      orgId: oid(),
      createdBy: linker,
      members: members.map((userId) => ({ userId, role: "member" })),
      taskroom: {
        roomId: "room1",
        spaceId: "space1",
        workspaceId: "ws1",
        linkedBy: linker,
        members: linkMembers,
      },
    };
  }

  beforeEach(() => {
    actorMock.mockImplementation(async (group: any, fn: any) => ({
      result: await fn("token", String(group.taskroom.linkedBy)),
      actorUserId: String(group.taskroom.linkedBy),
    }));
    GroupMock.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    UserMock.find.mockImplementation((query: any) => {
      const wanted = new Set(query._id.$in.map(String));
      return leanOf(users.filter((u) => wanted.has(String(u._id))));
    });
  });

  const lastWrite = () => GroupMock.updateOne.mock.calls.at(-1);
  const entryFor = (id: Types.ObjectId) =>
    lastWrite()[1].$set["taskroom.members"].find((m: any) => String(m.userId) === String(id));

  it("walks new people onto the board level by level and records who it added", async () => {
    const tr = fakeTaskroom({
      users: [
        { _id: "tL", userId: String(linker), email: "priya@x.com" },
        // Stored with capitals: must be sent exactly like this, apart from new people.
        { _id: "tD", userId: String(hasAccount), email: "Devon@X.com" },
      ],
      workspace: ["tL"],
      space: ["tL"],
      room: ["tL"],
    });
    GroupMock.findById.mockReturnValue(leanOf(groupWith([linker, hasAccount, newcomer, phoneOnly])));

    requestGroupTaskroomSync(String(groupId));
    await settle();

    const bulks = tr.calls.filter((c) => c.path === "workspace/members/bulk");
    expect(bulks.map((c) => c.body.membersList.map((m: any) => m.email))).toEqual([
      ["Devon@X.com"],
      ["sam@x.com"],
    ]);
    // Nobody got a second account.
    expect(tr.users.filter((u) => u.userId === String(hasAccount))).toHaveLength(1);
    expect(tr.room.map((row) => row.userId).sort()).toEqual(["tD", "tL", `t-${newcomer}`].sort());

    const [filter, update] = lastWrite();
    expect(filter).toEqual({ _id: groupId, "taskroom.roomId": "room1" });
    expect(update.$set["taskroom.status"]).toBe("active");
    expect(update.$set["taskroom.lastError"]).toBeNull();
    expect(entryFor(linker)).toMatchObject({ status: "synced", addedBySync: false, taskroomUserId: "tL" });
    expect(entryFor(hasAccount)).toMatchObject({ status: "synced", addedBySync: true, taskroomUserId: "tD" });
    expect(entryFor(newcomer)).toMatchObject({ status: "synced", addedBySync: true, taskroomUserId: `t-${newcomer}` });
    expect(entryFor(phoneOnly)).toMatchObject({ status: "failed", error: "No email address on file" });
  });

  it("takes a leaver off only if the sync put them on, and never the linker", async () => {
    const tr = fakeTaskroom({
      users: [
        { _id: "tL", userId: String(linker), email: "priya@x.com" },
        { _id: "tD", userId: String(hasAccount), email: "Devon@X.com" },
        { _id: "tS", userId: String(newcomer), email: "sam@x.com" },
      ],
      workspace: ["tL", "tD", "tS"],
      space: ["tL", "tD", "tS"],
      room: ["tL", "tD", "tS"],
    });
    // Everyone but the linker left; only Devon was put on by the sync.
    GroupMock.findById.mockReturnValue(
      leanOf(
        groupWith([], [
          { userId: linker, taskroomUserId: "tL", addedBySync: true, status: "synced" },
          { userId: hasAccount, taskroomUserId: "tD", addedBySync: true, status: "synced" },
          { userId: newcomer, taskroomUserId: "tS", addedBySync: false, status: "synced" },
        ])
      )
    );

    requestGroupTaskroomSync(String(groupId));
    await settle();

    expect(tr.calls.filter((c) => c.method === "DELETE").map((c) => c.path)).toEqual([
      "room/members/row-1",
    ]);
    expect(tr.room.map((row) => row.userId)).toEqual(["tL", "tS"]);
    expect(lastWrite()[1].$set["taskroom.members"]).toEqual([]);
  });

  it("falls back to one-by-one when Taskroom refuses a batch, so one bad record costs one person", async () => {
    const tr = fakeTaskroom({
      users: [
        { _id: "tL", userId: String(linker), email: "priya@x.com" },
        { _id: "tD", userId: String(hasAccount), email: "Devon@X.com" },
        { _id: "tS", userId: String(newcomer), email: "sam@x.com" },
      ],
      workspace: ["tL", "tD", "tS"],
      space: ["tL", "tD", "tS"],
      room: ["tL"],
      refuseBulk: new Set(["room/members/bulk"]),
      refuseSingle: new Set(["tS"]),
    });
    GroupMock.findById.mockReturnValue(leanOf(groupWith([linker, hasAccount, newcomer])));

    requestGroupTaskroomSync(String(groupId));
    await settle();

    expect(tr.room.map((row) => row.userId)).toEqual(["tL", "tD"]);
    expect(entryFor(hasAccount)).toMatchObject({ status: "synced", addedBySync: true });
    expect(entryFor(newcomer)).toMatchObject({
      status: "failed",
      addedBySync: false,
      error: "Couldn't add them to the Taskroom board: Internal server error",
    });
  });

  it("marks the link broken when the board was deleted", async () => {
    fakeTaskroom({ users: [], workspace: [], space: [], room: [] });
    const deleted = taskroomMock.getMockImplementation()!;
    taskroomMock.mockImplementation(async (path: string, opts: any) =>
      path.startsWith("rooms/")
        ? { _id: "room1", status: "inactive" }
        : deleted(path, opts)
    );
    GroupMock.findById.mockReturnValue(leanOf(groupWith([linker])));

    requestGroupTaskroomSync(String(groupId));
    await settle();

    const [filter, update] = lastWrite();
    expect(filter).toEqual({ _id: groupId, "taskroom.roomId": "room1" });
    expect(update.$set["taskroom.status"]).toBe("broken");
    expect(update.$set["taskroom.lastError"]).toMatch(/deleted/);
  });
});

describe("linkGroupTaskroom", () => {
  const actor = new Types.ObjectId();
  const groupId = new Types.ObjectId();
  const orgId = new Types.ObjectId();

  /** Answer Taskroom calls from a `"METHOD path"` table (query strings ignored). */
  function routeTaskroom(routes: Record<string, any>) {
    const calls: string[] = [];
    const bodies = new Map<string, any>();
    taskroomMock.mockImplementation(async (path: string, opts: any = {}) => {
      const key = `${opts.method || "GET"} ${path.split("?")[0]}`;
      calls.push(key);
      if (opts.body !== undefined) bodies.set(key, opts.body);
      if (!(key in routes)) throw new Error(`unexpected ${key}`);
      const answer = routes[key];
      if (answer instanceof Error) throw answer;
      return answer;
    });
    return { calls, bodies };
  }

  /** The group as the link reads it; the fresh read returns what was $set. */
  function mockGroup(taskroom?: any) {
    let saved: any;
    GroupMock.updateOne.mockImplementation(async (_filter: any, update: any) => {
      if (update.$set?.taskroom) saved = update.$set.taskroom;
      return { matchedCount: 1, modifiedCount: 1 };
    });
    GroupMock.findById.mockImplementation(() => ({
      select: (fields: string) => ({
        lean: async () => {
          if (fields === "name orgId kind taskroom") {
            return { _id: groupId, name: "Launch crew", orgId, ...(taskroom ? { taskroom } : {}) };
          }
          if (fields === "members taskroom") {
            return { _id: groupId, members: [{ userId: actor }], taskroom: saved };
          }
          return null; // the background member sync: nothing to do in these tests
        },
      }),
    }));
  }

  const me = { _id: "tMe", userId: String(actor), email: "priya@x.com" };

  beforeEach(() => {
    (mintUserToken as unknown as jest.Mock).mockResolvedValue("token");
    UserMock.findById.mockReturnValue(leanOf({ email: "priya@x.com" }));
    UserMock.find.mockReturnValue(leanOf([{ _id: actor, name: "Priya" }]));
  });

  it("answers 409 when the admin has no Taskroom account in this org yet", async () => {
    mockGroup();
    const { calls } = routeTaskroom({ "GET users": new Error("Unauthorized") });

    await expect(
      linkGroupTaskroom({ groupId: String(groupId), actorId: String(actor), mode: "new-workspace" })
    ).rejects.toMatchObject({ status: 409, message: TASKROOM_ACCOUNT_MISSING_MESSAGE });
    expect(calls).toEqual(["GET users"]);
    expect(GroupMock.updateOne).not.toHaveBeenCalled();
  });

  it("new-workspace: creates the workspace, the Group Chats space and a private board", async () => {
    mockGroup();
    const { bodies } = routeTaskroom({
      "GET users": [me],
      "POST workspaces": { _id: "ws9", name: "Launch crew" },
      "POST spaces": { _id: "sp9" },
      "POST rooms": { _id: "rm9", name: "Launch crew" },
      "GET stages/room/rm9": [
        { _id: "st-active", stageType: "active", orderId: 1 },
        { _id: "st-backlog", stageType: "tostart", orderId: 1 },
      ],
    });

    const summary = await linkGroupTaskroom({
      groupId: String(groupId),
      actorId: String(actor),
      mode: "new-workspace",
    });

    expect(bodies.get("POST workspaces")).toEqual({ category: "work", name: "Launch crew", color: "#008080" });
    expect(bodies.get("POST spaces")).toEqual({
      name: "Group Chats",
      description: "Boards linked to group chats",
      color: "#008080",
      spaceCode: expect.stringMatching(/^group-chats-[a-z0-9]{1,6}$/),
      workspaceId: "ws9",
      isPrivate: true,
      members: [],
    });
    expect(bodies.get("POST rooms")).toEqual({
      name: "Launch crew",
      description: 'Tasks captured from the "Launch crew" group chat',
      spaceId: "sp9",
      color: "#008080",
      bgImage: "",
      isPrivate: true,
      members: [],
      setDefault: false,
    });

    const [filter, update] = GroupMock.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: groupId });
    expect(update.$set.taskroom).toMatchObject({
      enabled: true,
      status: "active",
      mode: "new-workspace",
      workspaceId: "ws9",
      workspaceName: "Launch crew",
      spaceId: "sp9",
      roomId: "rm9",
      roomName: "Launch crew",
      stageId: "st-backlog",
      members: [],
      lastSyncAt: null,
      lastError: null,
    });
    expect(String(update.$set.taskroom.linkedBy)).toBe(String(actor));
    expect(pillMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "taskroom_linked",
        meta: { roomName: "Launch crew" },
        taskroom: { roomId: "rm9", spaceId: "sp9", workspaceId: "ws9", title: "Launch crew" },
      })
    );
    expect(summary).toMatchObject({ roomId: "rm9", linkedByName: "Priya", memberSync: { running: true } });
    await settle();
  });

  it("takes back what it created when a later step fails", async () => {
    mockGroup();
    const { calls } = routeTaskroom({
      "GET users": [me],
      "POST workspaces": { _id: "ws9" },
      "POST spaces": { _id: "sp9" },
      "POST rooms": { _id: "rm9" },
      "GET stages/room/rm9": new Error("Internal server error"),
      "DELETE rooms/rm9": {},
      "DELETE workspaces/ws9": {},
    });

    await expect(
      linkGroupTaskroom({ groupId: String(groupId), actorId: String(actor), mode: "new-workspace" })
    ).rejects.toMatchObject({ status: 502 });
    expect(calls.filter((c) => c.startsWith("DELETE"))).toEqual([
      "DELETE rooms/rm9",
      "DELETE workspaces/ws9",
    ]);
    expect(GroupMock.updateOne).not.toHaveBeenCalled();
  });

  it("new-board: files the board in the admin's existing Group Chats space", async () => {
    mockGroup();
    const { calls, bodies } = routeTaskroom({
      "GET users": [me],
      "GET workspaces/ws1": { _id: "ws1", name: "Ops", orgId: String(orgId), status: "active" },
      "GET workspace/members": [{ userId: "tMe" }],
      "GET spaces/me": [{ _id: "sp-other", name: "Group chats archive" }, { _id: "sp1", name: "group chats" }],
      "POST rooms": { _id: "rm1", name: "Launch crew" },
      "GET stages/room/rm1": [{ _id: "st1", stageType: "tostart", orderId: 1 }],
    });

    await linkGroupTaskroom({
      groupId: String(groupId),
      actorId: String(actor),
      mode: "new-board",
      workspaceId: "ws1",
    });

    expect(calls).not.toContain("POST spaces");
    expect(bodies.get("POST rooms")).toMatchObject({ spaceId: "sp1", isPrivate: true });
    expect(GroupMock.updateOne.mock.calls[0][1].$set.taskroom).toMatchObject({
      mode: "new-board",
      workspaceId: "ws1",
      workspaceName: "Ops",
      spaceId: "sp1",
      roomId: "rm1",
      stageId: "st1",
    });
    await settle();
  });

  it("new-board: refuses a workspace the admin isn't a member of", async () => {
    mockGroup();
    routeTaskroom({
      "GET users": [me],
      "GET workspaces/ws1": { _id: "ws1", name: "Ops", orgId: String(orgId), status: "active" },
      "GET workspace/members": [],
    });

    await expect(
      linkGroupTaskroom({ groupId: String(groupId), actorId: String(actor), mode: "new-board", workspaceId: "ws1" })
    ).rejects.toMatchObject({ status: 400, message: "You're not a member of that Taskroom workspace" });
  });

  describe("existing-board", () => {
    const board = {
      _id: "rm1",
      name: "Sprint board",
      orgId: String(orgId),
      workspaceId: "ws1",
      spaceId: "sp1",
      status: "active",
    };
    const link = () =>
      linkGroupTaskroom({
        groupId: String(groupId),
        actorId: String(actor),
        mode: "existing-board",
        workspaceId: "ws1",
        roomId: "rm1",
      });

    it("refuses a deleted board", async () => {
      mockGroup();
      routeTaskroom({ "GET users": [me], "GET rooms/rm1": { ...board, status: "inactive" } });
      await expect(link()).rejects.toMatchObject({ status: 400, message: "That Taskroom board no longer exists" });
    });

    it("refuses a board from another org", async () => {
      mockGroup();
      routeTaskroom({ "GET users": [me], "GET rooms/rm1": { ...board, orgId: "someone-else" } });
      await expect(link()).rejects.toMatchObject({ status: 400 });
    });

    it("refuses a board outside the picked workspace", async () => {
      mockGroup();
      routeTaskroom({ "GET users": [me], "GET rooms/rm1": { ...board, workspaceId: "ws2" } });
      await expect(link()).rejects.toMatchObject({ status: 400, message: "That board isn't in the selected workspace" });
    });

    it("refuses a board the admin is not on, even when the search matches someone", async () => {
      mockGroup();
      routeTaskroom({
        "GET users": [me],
        "GET rooms/rm1": board,
        "GET room/members": [{ userId: "tSomeoneElse", userData: { email: "priya@x.com.au" } }],
      });
      await expect(link()).rejects.toMatchObject({ status: 400, message: "You're not a member of that Taskroom board" });
    });

    it("keeps what the sync knows when the same board is linked again", async () => {
      const earlier = [{ userId: new Types.ObjectId(), taskroomUserId: "tX", addedBySync: true, status: "synced" }];
      mockGroup({ roomId: "rm1", members: earlier });
      routeTaskroom({
        "GET users": [me],
        "GET rooms/rm1": board,
        "GET room/members": [{ userId: "tMe" }],
        "GET workspaces/ws1": { _id: "ws1", name: "Ops", orgId: String(orgId), status: "active" },
        "GET stages/room/rm1": [{ _id: "st1", stageType: "tostart", orderId: 1 }],
      });

      await link();

      expect(GroupMock.updateOne.mock.calls[0][1].$set.taskroom).toMatchObject({
        mode: "existing-board",
        workspaceName: "Ops",
        spaceId: "sp1",
        roomName: "Sprint board",
        members: earlier,
      });
      await settle();
    });
  });
});
