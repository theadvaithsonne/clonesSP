import {
  validateInstrument,
  validateAcknowledgement,
  validateLevelsAgainstRate,
  isInvoiceRepresentable,
  toInvoiceMinorUnits,
} from "../bondValidation";
import { toAtomic } from "../../config/bondMoney";

const base = {
  unitPriceAtomic: toAtomic("1000", "INR"),
  currency: "INR" as const,
  durationDays: 90,
  payoutFrequency: "daily" as const,
  ratePerPayoutPeriod: "1",
  totalUnits: 500,
  minUnits: 1,
  commissionBasis: "both" as const,
  principalCommissionRate: "1",
  payoutCommissionRate: "1",
};
const codes = (d: any) => validateInstrument(d).map((i) => i.code);

describe("bond validation — structure", () => {
  it("accepts the spec's worked example", () => {
    expect(validateInstrument(base)).toEqual([]);
  });

  it("blocks a duration that leaves a stub period (spec §8)", () => {
    // 100 days monthly = 3 payouts + 10 days the engine would drop.
    expect(codes({ ...base, durationDays: 100, payoutFrequency: "monthly" })).toContain(
      "DURATION_NOT_WHOLE_PERIODS",
    );
  });

  it("allows a duration that divides evenly", () => {
    expect(codes({ ...base, durationDays: 90, payoutFrequency: "quarterly" })).toEqual([]);
  });

  it("blocks a term shorter than one payout period", () => {
    expect(codes({ ...base, durationDays: 30, payoutFrequency: "quarterly" })).toContain(
      "DURATION_SHORTER_THAN_PERIOD",
    );
  });

  it("requires a rate for whichever commission basis is chosen", () => {
    expect(codes({ ...base, commissionBasis: "principal", principalCommissionRate: "0" }))
      .toContain("PRINCIPAL_RATE_REQUIRED");
    expect(codes({ ...base, commissionBasis: "payout", payoutCommissionRate: "0" }))
      .toContain("PAYOUT_RATE_REQUIRED");
    // "none" needs neither.
    expect(
      codes({
        ...base,
        commissionBasis: "none",
        principalCommissionRate: "0",
        payoutCommissionRate: "0",
      }),
    ).toEqual([]);
  });

  it("rejects minUnits above total supply", () => {
    expect(codes({ ...base, minUnits: 600, totalUnits: 500 })).toContain("MIN_EXCEEDS_TOTAL");
  });
});

describe("bond validation — invoice precision", () => {
  it("accepts any INR/USD price (2dp currencies)", () => {
    expect(isInvoiceRepresentable(toAtomic("1000.55", "INR"), "INR")).toBe(true);
  });

  it("accepts a crypto price that lands on 2dp", () => {
    expect(isInvoiceRepresentable(toAtomic("0.25", "BTC"), "BTC")).toBe(true);
    expect(isInvoiceRepresentable(toAtomic("1.5", "ETH"), "ETH")).toBe(true);
  });

  it("rejects a crypto price finer than the invoice layer can record", () => {
    // 0.005 ETH would be written to the invoice as 0.01 ETH — a receipt
    // that misstates what was charged. Refuse rather than round.
    expect(isInvoiceRepresentable(toAtomic("0.005", "ETH"), "ETH")).toBe(false);
    const issues = validateInstrument({
      ...base,
      currency: "ETH",
      unitPriceAtomic: toAtomic("0.005", "ETH"),
    });
    expect(issues.map((i) => i.code)).toContain("UNIT_PRICE_PRECISION");
  });

  it("converts to invoice minor units correctly across currencies", () => {
    expect(toInvoiceMinorUnits(toAtomic("1000", "INR"), "INR")).toBe(100000);
    expect(toInvoiceMinorUnits(toAtomic("1.5", "ETH"), "ETH")).toBe(150);
    expect(toInvoiceMinorUnits(toAtomic("0.25", "BTC"), "BTC")).toBe(25);
  });
});

describe("bond validation — publish acknowledgement (spec §7)", () => {
  it("requires an acknowledgement", () => {
    expect(validateAcknowledgement(undefined, "191900", "INR")[0].code).toBe("ACK_REQUIRED");
  });

  it("rejects a figure that doesn't match the real obligation", () => {
    const r = validateAcknowledgement(toAtomic("1000", "INR"), "191900", "INR");
    expect(r[0].code).toBe("ACK_MISMATCH");
    expect(r[0].message).toContain("1919");
  });

  it("accepts the exact figure", () => {
    expect(validateAcknowledgement("191900", "191900", "INR")).toEqual([]);
  });
});

describe("bond validation — levels must sum to the bond's rate", () => {
  const levels = [
    { level: 1, percentage: 0.5 },
    { level: 2, percentage: 0.3 },
    { level: 3, percentage: 0.2 },
  ];

  it("accepts levels totalling the commission rate", () => {
    expect(validateLevelsAgainstRate(levels, "1")).toEqual([]);
  });

  it("rejects a mismatch", () => {
    const r = validateLevelsAgainstRate(levels, "2");
    expect(r[0].code).toBe("LEVELS_TOTAL_MISMATCH");
    expect(r[0].message).toContain("1%");
    expect(r[0].message).toContain("2%");
  });
});
