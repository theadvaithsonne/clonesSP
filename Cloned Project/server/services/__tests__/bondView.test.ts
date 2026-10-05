import { generateBondHash, normalizeBondHash } from "../bondHash";
import { computeBondSummary } from "../bondView";
import { toAtomic } from "../../config/bondMoney";

describe("bond hash", () => {
  it("is 12 digits and never starts with 0", () => {
    for (let i = 0; i < 2000; i++) {
      const h = generateBondHash();
      expect(h).toMatch(/^[1-9]\d{11}$/);
    }
  });

  it("does not repeat across a large sample", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) seen.add(generateBondHash());
    expect(seen.size).toBe(20000);
  });

  it("accepts search-box input with spaces, dashes or #", () => {
    expect(normalizeBondHash("4829 1305 7361")).toBe("482913057361");
    expect(normalizeBondHash("4829-1305-7361")).toBe("482913057361");
    expect(normalizeBondHash("#482913057361")).toBe("482913057361");
  });

  it("rejects anything that cannot be a bond hash", () => {
    expect(normalizeBondHash("12345")).toBeNull();
    expect(normalizeBondHash("012345678901")).toBeNull(); // leading zero
    expect(normalizeBondHash("abcdefghijkl")).toBeNull();
    expect(normalizeBondHash(undefined)).toBeNull();
    expect(normalizeBondHash("6ab7c35bc8cdfe79dbef6572")).toBeNull(); // a Mongo id
  });
});

describe("bond summary — the spec's worked example", () => {
  // 1 unit of Rs1,000, daily 1% for 90 days. 22 payouts made so far.
  const perPayout = toAtomic("10", "INR");
  const events = Array.from({ length: 90 }, (_, i) => ({
    sequenceNo: i + 1,
    status: i < 22 ? "paid" : "scheduled",
    interestAtomic: perPayout,
    dueAt: new Date(Date.UTC(2026, 0, 2 + i)),
  }));
  const s = computeBondSummary({
    currency: "INR",
    units: 1,
    principalAtomic: toAtomic("1000", "INR"),
    payoutAmountPerUnitAtomic: perPayout,
    payoutCount: 90,
    payoutFrequency: "daily",
    events,
    usdPerUnit: 0.012,
  });

  it("counts payments till date and remaining", () => {
    expect(s.paymentsTillDate).toBe(22);
    expect(s.paymentsRemaining).toBe(68);
    expect(s.paymentsTotal).toBe(90);
  });

  it("totals paid and remaining interest exactly", () => {
    expect(s.totalPaidInterest.amount).toBe("220");
    expect(s.totalRemainingInterest.amount).toBe("680");
    expect(s.termInterest.amount).toBe("900");
  });

  it("reports value, earning power and ROI", () => {
    expect(s.value.amount).toBe("1000");
    expect(s.perPayout.amount).toBe("10");
    expect(s.dailyEarning.amount).toBe("10");
    expect(s.netRoi.pct).toBe("90");
  });

  it("charges the buyer no fees", () => {
    expect(s.fees.amount).toBe("0");
  });

  it("converts to USD at the given rate, and degrades to null without one", () => {
    expect(s.value.usdNow).toBe(12);
    const noRate = computeBondSummary({
      currency: "INR", units: 1, principalAtomic: toAtomic("1000", "INR"),
      payoutAmountPerUnitAtomic: perPayout, payoutCount: 90,
      payoutFrequency: "daily", events, usdPerUnit: null,
    });
    expect(noRate.value.usdNow).toBeNull();
    expect(noRate.totalPaidInterest.amount).toBe("220"); // crypto figures unaffected
  });

  it("points at the earliest scheduled payout", () => {
    expect(s.nextPayoutAt?.toISOString().slice(0, 10)).toBe("2026-01-24");
  });
});

describe("bond summary — edge cases", () => {
  it("still counts an exhausted (failed) payout as owed", () => {
    const s = computeBondSummary({
      currency: "INR", units: 1, principalAtomic: "100000",
      payoutAmountPerUnitAtomic: "1000", payoutCount: 3, payoutFrequency: "monthly",
      events: [
        { sequenceNo: 1, status: "paid", interestAtomic: "1000", dueAt: new Date() },
        { sequenceNo: 2, status: "failed", interestAtomic: "1000", dueAt: new Date() },
        { sequenceNo: 3, status: "scheduled", interestAtomic: "1000", dueAt: new Date() },
      ],
      usdPerUnit: null,
    });
    expect(s.paymentsRemaining).toBe(2);
    expect(s.failedPayments).toBe(1);
    expect(s.totalRemainingInterest.atomic).toBe("2000");
  });

  it("divides a monthly payout into a daily rate", () => {
    const s = computeBondSummary({
      currency: "USDT", units: 10, principalAtomic: toAtomic("1000", "USDT"),
      payoutAmountPerUnitAtomic: toAtomic("0.5", "USDT"), payoutCount: 12,
      payoutFrequency: "monthly", events: [], usdPerUnit: 1,
    });
    expect(s.perPayout.amount).toBe("5");
    expect(s.dailyEarning.amount).toBe("0.166667"); // 5 / 30, rounded half up at 6dp
    expect(s.netRoi.pct).toBe("6");
  });

  it("handles a BTC bond like the design", () => {
    const s = computeBondSummary({
      currency: "BTC", units: 1, principalAtomic: toAtomic("0.25", "BTC"),
      payoutAmountPerUnitAtomic: toAtomic("0.0002", "BTC"), payoutCount: 44,
      payoutFrequency: "daily",
      events: Array.from({ length: 44 }, (_, i) => ({
        sequenceNo: i + 1, status: i < 22 ? "paid" : "scheduled",
        interestAtomic: toAtomic("0.0002", "BTC"), dueAt: new Date(),
      })),
      usdPerUnit: null,
    });
    expect(s.totalPaidInterest.amount).toBe("0.0044");
    expect(s.totalRemainingInterest.amount).toBe("0.0044");
    expect(s.paymentsTillDate).toBe(22);
  });
});
