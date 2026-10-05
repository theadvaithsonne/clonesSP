import {
  toAtomic,
  fromAtomic,
  percentOf,
  mulUnits,
  addAtomic,
  subAtomic,
  toWalletAmount,
  MINOR_UNITS,
} from "../../config/bondMoney";
import {
  deriveInstrumentFigures,
  payoutCountFor,
  stubDaysFor,
  isWholeMultipleOfPeriod,
  PAYOUT_PERIOD_DAYS,
} from "../bondMath";

describe("bondMoney — atomic conversion", () => {
  it("round-trips whole and fractional values per currency", () => {
    expect(toAtomic("1000", "INR")).toBe("100000");
    expect(fromAtomic("100000", "INR")).toBe("1000");
    expect(toAtomic("0.05", "USD")).toBe("5");
    expect(toAtomic("1", "USDT")).toBe("1000000");
    expect(toAtomic("1", "BTC")).toBe("100000000");
    expect(toAtomic("1", "ETH")).toBe("1000000000000000000");
    expect(fromAtomic("1000000000000000000", "ETH")).toBe("1");
  });

  it("holds an ETH value that overflows Number.MAX_SAFE_INTEGER", () => {
    // 0.01 ETH = 1e16 wei, already past MAX_SAFE_INTEGER (~9.0e15).
    const atomic = toAtomic("0.01", "ETH");
    expect(atomic).toBe("10000000000000000");
    expect(Number(atomic) > Number.MAX_SAFE_INTEGER).toBe(true);
    expect(fromAtomic(atomic, "ETH")).toBe("0.01");
  });

  it("rounds half-up when parsing beyond a currency's precision", () => {
    expect(toAtomic("1.005", "INR")).toBe("101"); // 1.005 -> 1.01
    expect(toAtomic("1.004", "INR")).toBe("100");
  });

  it("refuses to hand an inexact float to the wallet layer", () => {
    // Exactly representable -> fine.
    expect(toWalletAmount("100000", "INR")).toBe(1000);
    expect(toWalletAmount("1000000000000000000", "ETH")).toBe(1);
    // 1.234567890123456789 ETH cannot survive a float round-trip.
    expect(() => toWalletAmount("1234567890123456789", "ETH")).toThrow(
      /not exactly representable/,
    );
  });

  it("rejects negative results rather than silently wrapping", () => {
    expect(() => subAtomic("100", "200")).toThrow(/underflow/);
  });
});

describe("bondMoney — percentOf", () => {
  it("computes percentages exactly in minor units", () => {
    expect(percentOf("100000", 1)).toBe("1000"); // 1% of Rs1000 = Rs10
    expect(percentOf("1000", 1)).toBe("10"); // 1% of Rs10 = Rs0.10
    expect(percentOf("100000", "1.5")).toBe("1500");
    expect(percentOf("100000", 0)).toBe("0");
  });

  it("rounds half-up at the minor unit", () => {
    // 0.5% of 101 paise = 0.505 paise -> 1
    expect(percentOf("101", "0.5")).toBe("1");
    // 0.1% of 100 paise = 0.1 paise -> 0
    expect(percentOf("100", "0.1")).toBe("0");
  });

  it("multiplies per-unit amounts by N, never the reverse (spec §8)", () => {
    const perUnit = percentOf("100000", 1); // rounded first
    expect(mulUnits(perUnit, 7)).toBe("7000");
    expect(addAtomic("1000", "900")).toBe("1900");
  });
});

describe("bondMath — payout scheduling (spec §8)", () => {
  it("90 days at quarterly = 1 payout", () => {
    expect(payoutCountFor(90, "quarterly")).toBe(1);
    expect(isWholeMultipleOfPeriod(90, "quarterly")).toBe(true);
  });

  it("100 days at monthly = 3 payouts plus a 10-day stub", () => {
    expect(payoutCountFor(100, "monthly")).toBe(3);
    expect(stubDaysFor(100, "monthly")).toBe(10);
    expect(isWholeMultipleOfPeriod(100, "monthly")).toBe(false);
  });

  it("uses a 30-day month basis so yearly == monthly x 12", () => {
    expect(PAYOUT_PERIOD_DAYS.yearly).toBe(PAYOUT_PERIOD_DAYS.monthly * 12);
    expect(PAYOUT_PERIOD_DAYS.quarterly).toBe(PAYOUT_PERIOD_DAYS.monthly * 3);
  });
});

describe("bondMath — the spec §5 worked example, under decision D2", () => {
  // Unit price Rs1,000, 90 days, daily, 1% per payout,
  // commission basis `both` at 1%, 1 unit.
  const figures = deriveInstrumentFigures({
    unitPriceAtomic: toAtomic("1000", "INR"),
    currency: "INR",
    durationDays: 90,
    payoutFrequency: "daily",
    ratePerPayoutPeriod: 1,
    totalUnits: 1,
    commissionBasis: "both",
    principalCommissionRate: 1,
    payoutCommissionRate: 1,
  });
  const rs = (a: string) => fromAtomic(a, "INR");

  it("pays Rs10 per day for 90 days = Rs900 interest", () => {
    expect(figures.payoutCount).toBe(90);
    expect(rs(figures.payoutAmountPerUnitAtomic)).toBe("10");
    expect(rs(figures.totalInterestPerUnitAtomic)).toBe("900");
  });

  it("charges Rs10 principal commission once", () => {
    expect(rs(figures.principalCommissionPerUnitAtomic)).toBe("10");
  });

  it("charges Rs0.10 per payout — 1% of the PAYOUT, not the unit price", () => {
    // This is the whole point of D2. The spec's original reading gives
    // Rs10/day (Rs900 total); D2 gives Rs0.10/day (Rs9 total). 100x apart.
    expect(rs(figures.payoutCommissionPerPayoutPerUnitAtomic)).toBe("0.1");
    expect(rs(figures.totalCommissionPerUnitAtomic)).toBe("19"); // 10 + 9
  });

  it("totals Rs1,919 outflow and a seller net of -Rs919", () => {
    expect(rs(figures.totalOutflowPerUnitAtomic)).toBe("1919");
    expect(figures.sellerNetPerUnitAtomic).toBe("-91900");
    expect(fromAtomic("91900", "INR")).toBe("919");
  });

  it("annualises 1% daily as 360%", () => {
    expect(figures.annualisedRatePct).toBe("360");
  });
});

describe("bondMath — full subscription (spec §7)", () => {
  const figures = deriveInstrumentFigures({
    unitPriceAtomic: toAtomic("1000", "INR"),
    currency: "INR",
    durationDays: 90,
    payoutFrequency: "daily",
    ratePerPayoutPeriod: 1,
    totalUnits: 500,
    commissionBasis: "both",
    principalCommissionRate: 1,
    payoutCommissionRate: 1,
  });
  const rs = (a: string) => fromAtomic(a, "INR");

  it("scales all five headline figures by totalUnits", () => {
    expect(rs(figures.totalRaiseAtomic)).toBe("500000");
    expect(rs(figures.totalInterestAtFullAtomic)).toBe("450000");
    expect(rs(figures.totalCommissionAtFullAtomic)).toBe("9500");
    expect(rs(figures.totalOutflowAtFullAtomic)).toBe("959500");
    expect(figures.sellerNetAtFullAtomic).toBe("-45950000"); // -Rs459,500
  });
});

describe("bondMath — commission basis variants", () => {
  const base = {
    unitPriceAtomic: toAtomic("1000", "INR"),
    currency: "INR" as const,
    durationDays: 90,
    payoutFrequency: "daily" as const,
    ratePerPayoutPeriod: 1,
    totalUnits: 1,
    principalCommissionRate: 1,
    payoutCommissionRate: 1,
  };

  it("`none` charges nothing on either leg", () => {
    const f = deriveInstrumentFigures({ ...base, commissionBasis: "none" });
    expect(f.totalCommissionPerUnitAtomic).toBe("0");
    expect(fromAtomic(f.totalOutflowPerUnitAtomic, "INR")).toBe("1900");
  });

  it("`principal` charges once and nothing per payout", () => {
    const f = deriveInstrumentFigures({ ...base, commissionBasis: "principal" });
    expect(fromAtomic(f.principalCommissionPerUnitAtomic, "INR")).toBe("10");
    expect(f.payoutCommissionPerPayoutPerUnitAtomic).toBe("0");
    expect(fromAtomic(f.totalCommissionPerUnitAtomic, "INR")).toBe("10");
  });

  it("`payout` charges per payout and nothing at purchase", () => {
    const f = deriveInstrumentFigures({ ...base, commissionBasis: "payout" });
    expect(f.principalCommissionPerUnitAtomic).toBe("0");
    expect(fromAtomic(f.totalCommissionPerUnitAtomic, "INR")).toBe("9");
  });
});

describe("bondMath — multi-currency", () => {
  it("computes a USDT bond at 6 dp", () => {
    const f = deriveInstrumentFigures({
      unitPriceAtomic: toAtomic("100", "USDT"),
      currency: "USDT",
      durationDays: 360,
      payoutFrequency: "monthly",
      ratePerPayoutPeriod: "0.5",
      totalUnits: 10,
      commissionBasis: "none",
    });
    expect(f.payoutCount).toBe(12);
    expect(fromAtomic(f.payoutAmountPerUnitAtomic, "USDT")).toBe("0.5");
    expect(fromAtomic(f.totalInterestPerUnitAtomic, "USDT")).toBe("6");
    expect(f.annualisedRatePct).toBe("6");
  });

  it("computes an ETH bond in wei without precision loss", () => {
    const f = deriveInstrumentFigures({
      unitPriceAtomic: toAtomic("2", "ETH"),
      currency: "ETH",
      durationDays: 360,
      payoutFrequency: "monthly",
      ratePerPayoutPeriod: 1,
      totalUnits: 100,
      commissionBasis: "none",
    });
    expect(f.payoutAmountPerUnitAtomic).toBe("20000000000000000"); // 0.02 ETH
    expect(fromAtomic(f.totalInterestPerUnitAtomic, "ETH")).toBe("0.24");
    expect(fromAtomic(f.totalRaiseAtomic, "ETH")).toBe("200");
  });
});
