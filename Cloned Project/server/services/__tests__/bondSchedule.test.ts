import { payoutDueAt } from "../bondInvoiceFulfillment";

describe("bond payout schedule dates", () => {
  const purchased = new Date("2026-01-01T00:00:00.000Z");
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  it("spaces daily payouts one day apart, starting the day after purchase", () => {
    expect(iso(payoutDueAt(purchased, 1, "daily"))).toBe("2026-01-02");
    expect(iso(payoutDueAt(purchased, 2, "daily"))).toBe("2026-01-03");
    expect(iso(payoutDueAt(purchased, 90, "daily"))).toBe("2026-04-01");
  });

  it("uses whole 30-day periods for monthly", () => {
    expect(iso(payoutDueAt(purchased, 1, "monthly"))).toBe("2026-01-31");
    expect(iso(payoutDueAt(purchased, 12, "monthly"))).toBe("2026-12-27");
  });

  it("lands the final quarterly payout on the 90-day maturity", () => {
    // A 90-day quarterly bond pays exactly once, at maturity.
    expect(iso(payoutDueAt(purchased, 1, "quarterly"))).toBe("2026-04-01");
  });

  it("never schedules a payout before the purchase date", () => {
    for (const f of ["daily", "monthly", "quarterly", "half_yearly", "yearly"] as const) {
      expect(payoutDueAt(purchased, 1, f).getTime()).toBeGreaterThan(
        purchased.getTime(),
      );
    }
  });
});
