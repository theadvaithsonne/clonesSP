import {
  splitForfeiture,
  describeForfeiture,
  FORFEITURE_LABELS,
  type ForfeitureReason,
} from "../commissionForfeiture";

describe("commission forfeiture — splitting", () => {
  it("splits a clean amount in half", () => {
    expect(splitForfeiture(10, 0.5)).toEqual({ keep: 5, forfeited: 5 });
  });

  it("gives the indivisible remainder to the MEMBER, never the platform", () => {
    // $0.0075 halved is $0.00375, which four places cannot express. The
    // member must not be the one who loses the leftover.
    const { keep, forfeited } = splitForfeiture(0.0075, 0.5);
    expect(forfeited).toBe(0.0037);
    expect(keep).toBe(0.0038);
    expect(keep).toBeGreaterThan(forfeited);
  });

  it("splits a sub-cent level bonus without destroying it", () => {
    // What cent precision used to do to a small-base level bonus: $0.0432
    // halved reported $0.02 + $0.02 and lost $0.0032 of real money.
    const { keep, forfeited } = splitForfeiture(0.0432, 0.5);
    expect(keep).toBe(0.0216);
    expect(forfeited).toBe(0.0216);
    expect(keep + forfeited).toBeCloseTo(0.0432, 10);
  });

  it("always adds back to the gross — no money invented or destroyed", () => {
    for (const gross of [0.0008, 0.0075, 0.01, 0.0432, 0.03, 0.75, 1.44, 9, 12.335, 650]) {
      for (const f of [0, 0.25, 0.5, 0.625, 1]) {
        const { keep, forfeited } = splitForfeiture(gross, f);
        const rounded = Math.round(gross * 10000) / 10000;
        expect(Math.round((keep + forfeited) * 10000) / 10000).toBe(rounded);
        expect(keep).toBeGreaterThanOrEqual(0);
        expect(forfeited).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("forfeits everything at 1 and nothing at 0", () => {
    expect(splitForfeiture(9, 1)).toEqual({ keep: 0, forfeited: 9 });
    expect(splitForfeiture(9, 0)).toEqual({ keep: 9, forfeited: 0 });
  });

  it("clamps a fraction outside 0..1 rather than paying out negative money", () => {
    expect(splitForfeiture(10, 1.5)).toEqual({ keep: 0, forfeited: 10 });
    expect(splitForfeiture(10, -1)).toEqual({ keep: 10, forfeited: 0 });
  });

  it("treats a zero or negative gross as nothing to split", () => {
    expect(splitForfeiture(0, 0.5)).toEqual({ keep: 0, forfeited: 0 });
    expect(splitForfeiture(-5, 0.5)).toEqual({ keep: 0, forfeited: 0 });
  });

  it("reproduces today's NetworkChain half on a $25 direct bonus", () => {
    // The live rule: keep half, forward half. $9.00 direct → $4.50 each.
    expect(splitForfeiture(9, 0.5)).toEqual({ keep: 4.5, forfeited: 4.5 });
  });
});

describe("commission forfeiture — labels", () => {
  it("names a reason for every case the member can hit", () => {
    const reasons: ForfeitureReason[] = [
      "no_licence",
      "no_networkchain",
      "cascade_to_upline",
    ];
    for (const r of reasons) {
      expect(describeForfeiture(r)).toBe(FORFEITURE_LABELS[r]);
      expect(describeForfeiture(r).length).toBeGreaterThan(0);
    }
  });

  it("says what was lost and why, without an upsell on every row", () => {
    expect(describeForfeiture("no_licence")).toBe(
      "Lost commission — no Unilevel Plus licence"
    );
    expect(describeForfeiture("no_networkchain")).toBe(
      "Lost commission — no NetworkChain subscription"
    );
    expect(describeForfeiture("cascade_to_upline")).toBe(
      "Lost commission — passed up to a licensed upline"
    );
    for (const label of Object.values(FORFEITURE_LABELS)) {
      expect(label).not.toMatch(/activate|buy|upgrade|\$25/i);
    }
  });

  it("falls back rather than rendering undefined to a member", () => {
    expect(describeForfeiture("something_new" as ForfeitureReason)).toBe(
      "Lost commission"
    );
  });
});
