import { redemptionScopeFor } from "../platformCoupon";

/**
 * `generateNextChildInvoice` finds a redemption with exactly one query:
 *
 *     PlatformCouponRedemption.findOne({ parentInvoiceId: parent._id })
 *
 * so a discount only ever spans cycles when it is filed under the CHAIN ROOT.
 * Everything here is really one assertion in different clothes: a coupon sold
 * as N cycles must end up somewhere that query can reach.
 */
const ROOT = "aaaaaaaaaaaaaaaaaaaaaaaa";
const CHILD = "bbbbbbbbbbbbbbbbbbbbbbbb";

const root = { _id: ROOT, isRecurring: true, parentInvoiceId: undefined };
const child = { _id: CHILD, isRecurring: true, parentInvoiceId: ROOT };
const oneOff = { _id: CHILD, isRecurring: false, parentInvoiceId: undefined };

describe("redemption scope", () => {
  it("files a multi-cycle coupon on the ROOT when redeemed at the root", () => {
    expect(redemptionScopeFor({ cycleCount: 3 } as any, root)).toEqual({
      parentInvoiceId: ROOT,
    });
  });

  it("files a multi-cycle coupon on the ROOT even when redeemed at a RENEWAL", () => {
    // The regression. This returned { invoiceId: CHILD } before, which the
    // generator never reads — khanthecoach@gmail.com bought 3 cycles on
    // 28 Sep 2026 and received none.
    expect(redemptionScopeFor({ cycleCount: 3 } as any, child)).toEqual({
      parentInvoiceId: ROOT,
    });
  });

  it("never files a multi-cycle coupon under invoiceId, from anywhere", () => {
    for (const invoice of [root, child, oneOff]) {
      for (const cycleCount of [2, 3, 9, 12]) {
        const scope = redemptionScopeFor({ cycleCount } as any, invoice);
        expect(scope).not.toHaveProperty("invoiceId");
        expect(scope).toHaveProperty("parentInvoiceId");
      }
    }
  });

  it("keeps a single-cycle coupon on a new subscription at the root", () => {
    expect(redemptionScopeFor({ cycleCount: 1 } as any, root)).toEqual({
      parentInvoiceId: ROOT,
    });
  });

  it("keeps a single-cycle coupon on a renewal scoped to that invoice ALONE", () => {
    // The other half of the bargain: one renewal's discount must not become
    // permanent. Widening this to the root would hand out a free forever.
    expect(redemptionScopeFor({ cycleCount: 1 } as any, child)).toEqual({
      invoiceId: CHILD,
    });
  });

  it("scopes a one-time purchase to its own invoice", () => {
    expect(redemptionScopeFor({ cycleCount: 1 } as any, oneOff)).toEqual({
      invoiceId: CHILD,
    });
    expect(redemptionScopeFor({} as any, oneOff)).toEqual({ invoiceId: CHILD });
  });

  it("treats a missing cycleCount as one cycle, not unlimited", () => {
    // One-time product types coerce cycleCount away entirely, so `undefined`
    // must read as "this invoice only" — never as a chain-wide discount.
    expect(redemptionScopeFor({} as any, child)).toEqual({ invoiceId: CHILD });
    expect(redemptionScopeFor({ cycleCount: undefined } as any, child)).toEqual({
      invoiceId: CHILD,
    });
  });

  it("returns exactly one key, never both", () => {
    const cases = [root, child, oneOff];
    for (const invoice of cases) {
      for (const cycleCount of [undefined, 1, 2, 12]) {
        const scope = redemptionScopeFor({ cycleCount } as any, invoice);
        expect(Object.keys(scope)).toHaveLength(1);
      }
    }
  });

  it("accepts ObjectId-ish values, not just strings", () => {
    const oid = { toString: () => ROOT };
    expect(
      redemptionScopeFor({ cycleCount: 3 } as any, {
        _id: { toString: () => CHILD },
        isRecurring: true,
        parentInvoiceId: oid,
      })
    ).toEqual({ parentInvoiceId: ROOT });
  });
});
