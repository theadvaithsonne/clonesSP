/**
 * Unit tests for bat246Admin.service.ts — assignSlot org-add logic.
 * Verifies that users are added to the bat246 org after slot assignment,
 * and that a failure in org-add does NOT abort the slot assignment.
 */
import { Types } from "mongoose";

// ── Shared mock objects ────────────────────────────────────────────────────────
const mockBoard = {
  _id: new Types.ObjectId(),
  status: "pending",
  thirdBase: null,
  secondBaseA: null,
  secondBaseB: null,
  firstBase: [null, null, null, null],
  save: jest.fn().mockResolvedValue(undefined),
};

const mockPlayer = {
  _id: new Types.ObjectId(),
  userId: new Types.ObjectId(),
  nickname: "Shorupan P.",
  email: "shorupan@gmail.com",
  minorLeague: { totalEntries: 2 },
};

const mockUser = {
  _id: new Types.ObjectId(),
  name: "Shorupan P.",
  email: "shorupan@gmail.com",
  country: "CA",
  createdAt: new Date(),
  organizations: [],
};

const mockOrgId = new Types.ObjectId();
const mockProduct = { organizationId: mockOrgId };

// ── Model mocks ───────────────────────────────────────────────────────────────
jest.mock("../models/bat246Board.model", () => ({
  Bat246Board: {
    findById: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock("../models/bat246Player.model", () => ({
  Bat246Player: {
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
    countDocuments: jest.fn().mockResolvedValue(5),
  },
}));

jest.mock("../models/bat246PlayerBoard.model", () => ({
  Bat246PlayerBoard: {
    updateOne: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock("../../models/user.model", () => ({
  User: {
    findById: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock("../../models/product.model", () => ({
  Product: {
    findOne: jest.fn(),
  },
}));

import { assignSlot } from "../services/bat246Admin.service";
import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { User } from "../../models/user.model";
import { Product } from "../../models/product.model";

// ── Helper ────────────────────────────────────────────────────────────────────
function setupHappyPath() {
  (Bat246Board.findById as jest.Mock).mockResolvedValue({ ...mockBoard });
  (Bat246Player.findOne as jest.Mock).mockResolvedValue(mockPlayer);
  (User.findById as jest.Mock).mockReturnValue({
    lean: jest.fn().mockResolvedValue(mockUser),
  });
  (Product.findOne as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(mockProduct),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("assignSlot — org membership", () => {
  it("adds user to bat246 org via $addToSet after successful slot assignment", async () => {
    setupHappyPath();

    await assignSlot(mockBoard._id.toString(), "thirdBase", mockUser._id.toString());

    expect(User.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: mockUser._id }),
      expect.objectContaining({ $addToSet: expect.objectContaining({ organizations: expect.anything() }) })
    );
  });

  it("org add uses the organizationId from the bat246_entry product", async () => {
    setupHappyPath();

    await assignSlot(mockBoard._id.toString(), "thirdBase", mockUser._id.toString());

    const updateCall = (User.updateOne as jest.Mock).mock.calls.find((c: any[]) =>
      c[1]?.$addToSet?.organizations
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[1].$addToSet.organizations.organization.toString()).toBe(
      mockOrgId.toString()
    );
    expect(updateCall[1].$addToSet.organizations.role).toBe("member");
  });

  it("slot assignment succeeds even when Product lookup returns null (no product tagged bat246_entry)", async () => {
    setupHappyPath();
    (Product.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    });

    await expect(
      assignSlot(mockBoard._id.toString(), "thirdBase", mockUser._id.toString())
    ).resolves.not.toThrow();

    // org update should NOT have been called since product was null
    const orgUpdateCall = (User.updateOne as jest.Mock).mock.calls.find((c: any[]) =>
      c[1]?.$addToSet?.organizations
    );
    expect(orgUpdateCall).toBeUndefined();
  });

  it("slot assignment succeeds even when Product.findOne throws", async () => {
    setupHappyPath();
    (Product.findOne as jest.Mock).mockImplementation(() => {
      throw new Error("DB unavailable");
    });

    await expect(
      assignSlot(mockBoard._id.toString(), "thirdBase", mockUser._id.toString())
    ).resolves.not.toThrow();
  });
});

describe("assignSlot — validation", () => {
  it("throws if board is not in pending status", async () => {
    (Bat246Board.findById as jest.Mock).mockResolvedValue({ ...mockBoard, status: "active" });

    await expect(
      assignSlot(mockBoard._id.toString(), "thirdBase", mockUser._id.toString())
    ).rejects.toThrow("Only pending boards can be configured");
  });

  it("throws if board not found", async () => {
    (Bat246Board.findById as jest.Mock).mockResolvedValue(null);

    await expect(
      assignSlot(new Types.ObjectId().toString(), "thirdBase", mockUser._id.toString())
    ).rejects.toThrow("Board not found");
  });

  it("throws if Garage user not found", async () => {
    (Bat246Board.findById as jest.Mock).mockResolvedValue({ ...mockBoard });
    (Bat246Player.findOne as jest.Mock).mockResolvedValue(mockPlayer);
    (User.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    await expect(
      assignSlot(mockBoard._id.toString(), "thirdBase", new Types.ObjectId().toString())
    ).rejects.toThrow("Garage user not found");
  });
});
