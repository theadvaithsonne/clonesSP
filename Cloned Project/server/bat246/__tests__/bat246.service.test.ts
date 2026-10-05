/**
 * Unit tests for bat246.service.ts
 * Tests the query-building logic for getBoards and getCompletedBoards.
 * Mongoose models are fully mocked — no real DB connection needed.
 */

// ── Mock models before importing the service ──────────────────────────────────
const mockBoardChain = {
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue([]),
};

jest.mock("../models/bat246Board.model", () => ({
  Bat246Board: { find: jest.fn(() => mockBoardChain) },
}));
jest.mock("../models/bat246Player.model", () => ({
  Bat246Player: { find: jest.fn(), findOne: jest.fn(), findById: jest.fn() },
}));
jest.mock("../models/bat246Movement.model", () => ({
  Bat246Movement: { find: jest.fn() },
}));

import { getBoards, getCompletedBoards } from "../services/bat246.service";
import { Bat246Board } from "../models/bat246Board.model";

// ── getBoards ─────────────────────────────────────────────────────────────────
describe("getBoards", () => {
  it("without filterEmail: queries all active statuses, no $or", async () => {
    await getBoards();
    const query = (Bat246Board.find as jest.Mock).mock.calls[0][0];
    expect(query.status.$in).toEqual(["pending", "active", "stalled", "splitting"]);
    expect(query.$or).toBeUndefined();
  });

  it("with filterEmail: $or covers all 8 slot paths", async () => {
    await getBoards("player@example.com");
    const query = (Bat246Board.find as jest.Mock).mock.calls[0][0];
    expect(query.$or).toHaveLength(8);
    const paths = query.$or.map((c: any) => Object.keys(c)[0]);
    expect(paths).toEqual([
      "homePlate.playerEmail",
      "thirdBase.playerEmail",
      "secondBaseA.playerEmail",
      "secondBaseB.playerEmail",
      "firstBase.playerEmail",
      "atBat.playerEmail",
      "dugout.playerEmail",
      "onDeckCircle.playerEmail",
    ]);
  });

  it("with filterEmail: $or values are the email string", async () => {
    const email = "player@example.com";
    await getBoards(email);
    const query = (Bat246Board.find as jest.Mock).mock.calls[0][0];
    const firstValue = Object.values(query.$or[0])[0] as any;
    expect(typeof firstValue).toBe("string");
    expect(firstValue).toBe(email);
  });

  it("active status query includes splitting but NOT split", async () => {
    await getBoards();
    const query = (Bat246Board.find as jest.Mock).mock.calls[0][0];
    expect(query.status.$in).toContain("splitting");
    expect(query.status.$in).not.toContain("split");
  });

  it("does NOT include completed or split in the active query", async () => {
    await getBoards();
    const query = (Bat246Board.find as jest.Mock).mock.calls[0][0];
    expect(query.status.$in).not.toContain("completed");
    expect(query.status.$in).not.toContain("split");
  });

  it("returns an array (lean result passthrough)", async () => {
    const result = await getBoards();
    expect(Array.isArray(result)).toBe(true);
  });

  it("isAdmin not passed (default false): excludes hidden boards", async () => {
    await getBoards();
    const query = (Bat246Board.find as jest.Mock).mock.calls[0][0];
    expect(query.hidden).toEqual({ $ne: true });
  });

  it("isAdmin=true: no hidden filter applied", async () => {
    await getBoards(undefined, true);
    const query = (Bat246Board.find as jest.Mock).mock.calls[0][0];
    expect(query.hidden).toBeUndefined();
  });
});

// ── getCompletedBoards ────────────────────────────────────────────────────────
describe("getCompletedBoards", () => {
  it("without filterEmail: queries status completed+split, no $or", async () => {
    await getCompletedBoards();
    const query = (Bat246Board.find as jest.Mock).mock.calls[0][0];
    expect(query.status.$in).toEqual(["completed", "split"]);
    expect(query.$or).toBeUndefined();
  });

  it("with filterEmail: $or covers all 8 slot paths", async () => {
    await getCompletedBoards("player@example.com");
    const query = (Bat246Board.find as jest.Mock).mock.calls[0][0];
    expect(query.status.$in).toEqual(["completed", "split"]);
    expect(query.$or).toHaveLength(8);
  });

  it("sorts completed boards by createdAt descending", async () => {
    await getCompletedBoards();
    const sortArg = mockBoardChain.sort.mock.calls[0][0];
    expect(sortArg).toEqual({ createdAt: -1 });
  });

  it("includes splitAt in selected fields", async () => {
    await getCompletedBoards();
    const selectArg = mockBoardChain.select.mock.calls[0][0];
    expect(selectArg).toContain("splitAt");
  });
});
