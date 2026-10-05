/**
 * Counter-bill status sync — how a sent bill learns it was paid, expired,
 * cancelled, or (for a split bill) how many of its shares are in.
 *
 * Every payment path marks the invoice paid before fulfilment runs, so the
 * invoice is the source of truth; these pin the mapping from it.
 */
import { Types } from "mongoose";

let invoices: any[] = [];
jest.mock("../../models/invoice.model", () => ({
  Invoice: {
    find: () => ({ select: () => ({ lean: async () => invoices }) }),
  },
}));
jest.mock("../../models/counterBill.model", () => ({
  CounterBill: {},
  nextCounterBillNumber: jest.fn(),
}));
jest.mock("../../models/store.model", () => ({ Store: {} }));
jest.mock("../../models/user.model", () => ({ User: {} }));

import { syncBills } from "../counterBill";

const inv = (status: string, extra: Record<string, any> = {}): any => ({
  _id: new Types.ObjectId(),
  status,
  ...extra,
});

const sentBill = (over: Record<string, any> = {}) => {
  const b: any = {
    status: "sent",
    attachCode: "ABCDEFG",
    save: jest.fn(async () => b),
    ...over,
  };
  return b;
};

describe("syncBills", () => {
  it("marks a bill paid when its invoice is paid, and retires its QR", async () => {
    const i = inv("paid", { paidAt: new Date("2026-09-23T10:00:00Z") });
    invoices = [i];
    const b = sentBill({ invoiceId: i._id });
    await syncBills([b]);
    expect(b.status).toBe("paid");
    expect(b.paidAt).toEqual(i.paidAt);
    expect(b.attachCode).toBeUndefined();
    expect(b.save).toHaveBeenCalled();
  });

  it("treats a lapsed expiresAt as expired even before the expiry cron runs", async () => {
    const i = inv("draft", { expiresAt: new Date(Date.now() - 1000) });
    invoices = [i];
    const b = sentBill({ invoiceId: i._id });
    await syncBills([b]);
    expect(b.status).toBe("expired");
  });

  it("leaves an unpaid, unexpired bill alone", async () => {
    const i = inv("pending", { expiresAt: new Date(Date.now() + 60_000) });
    invoices = [i];
    const b = sentBill({ invoiceId: i._id });
    await syncBills([b]);
    expect(b.status).toBe("sent");
    expect(b.save).not.toHaveBeenCalled();
  });

  it("counts split shares as they're paid and closes the bill on the last one", async () => {
    const [a, c] = [inv("paid", { paidAt: new Date() }), inv("draft")];
    invoices = [a, c];
    const b = sentBill({
      split: {
        ways: 2,
        shares: [
          { index: 0, amount: 100, invoiceId: a._id, status: "pending" },
          { index: 1, amount: 100, invoiceId: c._id, status: "pending" },
        ],
      },
    });
    await syncBills([b]);
    expect(b.split.shares.map((s: any) => s.status)).toEqual(["paid", "pending"]);
    expect(b.status).toBe("sent");

    invoices = [a, { ...c, status: "paid", paidAt: new Date() }];
    await syncBills([b]);
    expect(b.status).toBe("paid");
  });

  it("ignores drafts and bills that are already closed", async () => {
    invoices = [];
    const draft = sentBill({ status: "draft" });
    await syncBills([draft]);
    expect(draft.save).not.toHaveBeenCalled();
  });
});
