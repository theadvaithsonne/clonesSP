/**
 * Seat-hold expiry — an unpaid checkout's seats go back on sale only once its
 * invoice is closed, so nobody can pay for a seat that has been resold.
 */
import { Types } from "mongoose";

let expired: any[] = [];
const flips: any[] = [];
const releases: Array<{ tierId: string; qty: number }> = [];
jest.mock("../../models/eventRegistration.model", () => ({
  EventRegistration: {
    find: () => ({ select: () => ({ lean: async () => expired }) }),
    updateOne: jest.fn(async (filter: any) => {
      flips.push(filter._id);
      return { modifiedCount: 1 };
    }),
  },
}));
jest.mock("../../models/eventTicketTier.model", () => ({
  EventTicketTier: {
    updateOne: jest.fn(async (filter: any, update: any) => {
      releases.push({ tierId: String(filter._id), qty: -update.$inc.soldCount });
      return { modifiedCount: 1 };
    }),
  },
}));
jest.mock("../../models/eventProgram.model", () => ({ EventProgram: {} }));
jest.mock("../../models/eventWebsiteConfig.model", () => ({ EventWebsiteConfig: {} }));
jest.mock("../../utils/rbac", () => ({ isFounderOrModuleAdmin: jest.fn() }));

const invoices = new Map<string, any>();
const cancelInvoice = jest.fn(async (id: string) => {
  const inv = invoices.get(id);
  if (inv.inFlight) throw new Error("This invoice is being charged right now.");
  inv.status = "cancelled";
  return inv;
});
jest.mock("../invoice", () => ({
  getInvoice: async (id: string) => invoices.get(id) || null,
  cancelInvoice: (id: string) => cancelInvoice(id),
}));

import { releaseExpiredHolds } from "../eventManagement";

const tierId = new Types.ObjectId();
const addonId = new Types.ObjectId();
const invoice = (status: string, extra: Record<string, any> = {}) => {
  const inv = { _id: new Types.ObjectId(), status, ...extra };
  invoices.set(String(inv._id), inv);
  return inv;
};
const seat = (invoiceId?: Types.ObjectId, extra: Record<string, any> = {}) => ({
  _id: new Types.ObjectId(),
  ticketTierId: tierId,
  quantity: 1,
  addons: [],
  invoiceId,
  ...extra,
});

beforeEach(() => {
  expired = [];
  flips.length = 0;
  releases.length = 0;
  invoices.clear();
});

describe("releaseExpiredHolds", () => {
  it("cancels the unpaid invoice before handing the seats back", async () => {
    const inv = invoice("pending");
    expired = [seat(inv._id, { addons: [{ ticketTierId: addonId, quantity: 2 }] })];

    await releaseExpiredHolds(new Types.ObjectId());

    expect(inv.status).toBe("cancelled");
    expect(flips).toHaveLength(1);
    expect(releases).toEqual([
      { tierId: String(tierId), qty: 1 },
      { tierId: String(addonId), qty: 2 },
    ]);
  });

  it("cancels a multi-seat order's invoice once", async () => {
    const inv = invoice("draft");
    expired = [seat(inv._id), seat(inv._id), seat(inv._id)];

    await releaseExpiredHolds(new Types.ObjectId());

    expect(cancelInvoice).toHaveBeenCalledTimes(1);
    expect(flips).toHaveLength(3);
  });

  it("leaves the seats held when the invoice was paid in the meantime", async () => {
    const inv = invoice("paid");
    expired = [seat(inv._id)];

    await releaseExpiredHolds(new Types.ObjectId());

    expect(flips).toHaveLength(0);
    expect(releases).toHaveLength(0);
  });

  it("keeps the hold while a payment is in flight", async () => {
    const inv = invoice("pending", { inFlight: true });
    expired = [seat(inv._id)];

    await releaseExpiredHolds(new Types.ObjectId());

    expect(flips).toHaveLength(0);
    expect(releases).toHaveLength(0);
  });

  it("still releases a hold whose invoice is already closed or missing", async () => {
    const inv = invoice("expired");
    expired = [seat(inv._id), seat(new Types.ObjectId()), seat()];

    await releaseExpiredHolds(new Types.ObjectId());

    expect(flips).toHaveLength(3);
  });
});
