/**
 * Unit tests for bat246.controller.ts — listBoards
 * Verifies the mine=true / mine=false branching and response shape.
 * My Boards now filters by the logged-in user's email address (stored on each board slot).
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock("../models/bat246Player.model", () => ({
  Bat246Player: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../models/user.model", () => ({
  User: {
    findById: jest.fn(),
  },
}));

jest.mock("../services/bat246.service", () => ({
  getBoards: jest.fn().mockResolvedValue([]),
  getCompletedBoards: jest.fn().mockResolvedValue([]),
  getBoardById: jest.fn(),
  getBoardMovements: jest.fn(),
  getPlayerById: jest.fn(),
  setPenciling: jest.fn(),
  setPrePick: jest.fn(),
}));

jest.mock("../services/bat246Split.service", () => ({
  splitBoardPhase1: jest.fn(),
}));

jest.mock("../services/bat246Admin.service", () => ({
  searchGarageUsers: jest.fn(),
  assignSlot: jest.fn(),
  activateBoard: jest.fn(),
  getPendingBoard: jest.fn(),
}));

import { listBoards } from "../controllers/bat246.controller";
import { User } from "../../models/user.model";
import * as svc from "../services/bat246.service";

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeReq(query: Record<string, string>, userId = "user_abc") {
  return { query, user: { userId } } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockUser(email: string | null) {
  (User.findById as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(email ? { email } : null),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("listBoards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (svc.getBoards as jest.Mock).mockResolvedValue([]);
    (svc.getCompletedBoards as jest.Mock).mockResolvedValue([]);
  });

  it("mine=false: still looks up user (for the isAdmin/hidden-boards check), returns { boards, completed }", async () => {
    mockUser("tripleh@yopmail.com");

    const req = makeReq({ mine: "false" });
    const res = makeRes();

    await listBoards(req, res);

    expect(User.findById).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ boards: [], completed: [] });
  });

  it("mine not set: still looks up user", async () => {
    mockUser("tripleh@yopmail.com");

    const req = makeReq({});
    const res = makeRes();

    await listBoards(req, res);

    expect(User.findById).toHaveBeenCalled();
  });

  it("no userId on request at all: skips user lookup entirely", async () => {
    const req = makeReq({ mine: "false" }, "");
    (req as any).user = {};
    const res = makeRes();

    await listBoards(req, res);

    expect(User.findById).not.toHaveBeenCalled();
    expect(svc.getBoards).toHaveBeenCalledWith(undefined, false);
  });

  it("mine=true, user not found: returns empty arrays without calling getBoards", async () => {
    mockUser(null);

    const req = makeReq({ mine: "true" });
    const res = makeRes();

    await listBoards(req, res);

    expect(res.json).toHaveBeenCalledWith({ boards: [], completed: [] });
    expect(svc.getBoards).not.toHaveBeenCalled();
    expect(svc.getCompletedBoards).not.toHaveBeenCalled();
  });

  it("mine=true, userId missing: returns empty arrays without calling getBoards", async () => {
    const req = makeReq({ mine: "true" }, "");   // empty userId
    (req as any).user = {};                        // no userId field
    const res = makeRes();

    await listBoards(req, res);

    expect(res.json).toHaveBeenCalledWith({ boards: [], completed: [] });
    expect(svc.getBoards).not.toHaveBeenCalled();
  });

  it("mine=true, user found: calls getBoards with lowercased email, isAdmin=false for a non-Alan-K user", async () => {
    mockUser("TripleH@YopMail.com");

    const req = makeReq({ mine: "true" });
    const res = makeRes();

    await listBoards(req, res);

    expect(svc.getBoards).toHaveBeenCalledWith("tripleh@yopmail.com", false);
    expect(svc.getCompletedBoards).toHaveBeenCalledWith("tripleh@yopmail.com", false);
  });

  it("mine=true, Alan K: isAdmin=true is passed through so hidden boards stay visible to him", async () => {
    mockUser("redbaron2020@mail.com");

    const req = makeReq({ mine: "true" });
    const res = makeRes();

    await listBoards(req, res);

    expect(svc.getBoards).toHaveBeenCalledWith("redbaron2020@mail.com", true);
    expect(svc.getCompletedBoards).toHaveBeenCalledWith("redbaron2020@mail.com", true);
  });

  it("mine=true, user found: response shape is { boards, completed }", async () => {
    mockUser("tripleh@yopmail.com");

    const fakeBoards = [{ _id: "b1", status: "active" }];
    const fakeCompleted = [{ _id: "b2", status: "completed" }];
    (svc.getBoards as jest.Mock).mockResolvedValue(fakeBoards);
    (svc.getCompletedBoards as jest.Mock).mockResolvedValue(fakeCompleted);

    const req = makeReq({ mine: "true" });
    const res = makeRes();

    await listBoards(req, res);

    expect(res.json).toHaveBeenCalledWith({ boards: fakeBoards, completed: fakeCompleted });
  });

  it("mine=false, non-admin: both getBoards and getCompletedBoards called with no email filter, isAdmin=false", async () => {
    mockUser("tripleh@yopmail.com");

    const req = makeReq({ mine: "false" });
    const res = makeRes();

    await listBoards(req, res);

    expect(svc.getBoards).toHaveBeenCalledWith(undefined, false);
    expect(svc.getCompletedBoards).toHaveBeenCalledWith(undefined, false);
  });

  it("mine=false, Alan K: isAdmin=true so hidden boards appear in the all-boards view", async () => {
    mockUser("redbaron2020@mail.com");

    const req = makeReq({ mine: "false" });
    const res = makeRes();

    await listBoards(req, res);

    expect(svc.getBoards).toHaveBeenCalledWith(undefined, true);
    expect(svc.getCompletedBoards).toHaveBeenCalledWith(undefined, true);
  });

  it("DB error: returns 500 with error message", async () => {
    mockUser("tripleh@yopmail.com");
    (svc.getBoards as jest.Mock).mockRejectedValue(new Error("DB down"));

    const req = makeReq({ mine: "false" });
    const res = makeRes();

    await listBoards(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "DB down" });
  });
});
