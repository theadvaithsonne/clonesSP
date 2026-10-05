import {
  resolveAffiliateFeeTier,
  affiliateFeeMatrix,
  describeAffiliateFee,
  AFFILIATE_KEEP_THRESHOLD_CENTS,
  AFFILIATE_DEFAULT_FEE_PERCENT,
} from "../../config/affiliateWithdrawalFees";

const KEEP = AFFILIATE_KEEP_THRESHOLD_CENTS; // 5000 = $50

describe("affiliate withdrawal fee matrix", () => {
  it("prices the four configured outcomes exactly as specified", () => {
    const pct = (frequency: any, keepAmountCents: number) =>
      resolveAffiliateFeeTier({ frequency, keepAmountCents }).feePercent;

    expect(pct("daily", 0)).toBe(5); //  daily,  no $50  → 5%
    expect(pct("daily", KEEP)).toBe(2); //  daily,  $50    → 2%
    expect(pct("weekly", 0)).toBe(2); //  weekly, no $50  → 2%
    expect(pct("weekly", KEEP)).toBe(0); //  weekly, $50    → 0%
  });

  it("keeping MORE than $50 still earns the lower tier", () => {
    expect(resolveAffiliateFeeTier({ frequency: "weekly", keepAmountCents: 100_00 }).feePercent).toBe(0);
    expect(resolveAffiliateFeeTier({ frequency: "daily", keepAmountCents: 500_00 }).feePercent).toBe(2);
  });

  it("one cent under $50 does NOT earn it", () => {
    const t = resolveAffiliateFeeTier({ frequency: "weekly", keepAmountCents: KEEP - 1 });
    expect(t.meetsKeepThreshold).toBe(false);
    expect(t.feePercent).toBe(2);
  });

  it("an unconfigured user stays on the historical 5%, not a silent discount", () => {
    for (const pref of [null, undefined, {}, { frequency: null }]) {
      const t = resolveAffiliateFeeTier(pref as any);
      expect(t.feePercent).toBe(AFFILIATE_DEFAULT_FEE_PERCENT);
      expect(t.feePercent).toBe(5);
      expect(t.configured).toBe(false);
    }
  });

  it("a saved weekly preference with no keep is 2% — cheaper than the unconfigured default", () => {
    // Configuring is what earns the discount; this is the whole incentive.
    expect(resolveAffiliateFeeTier({ frequency: "weekly", keepAmountCents: null }).feePercent).toBe(2);
    expect(resolveAffiliateFeeTier(null).feePercent).toBe(5);
  });

  it("treats a negative keep as zero rather than inverting the tier", () => {
    const t = resolveAffiliateFeeTier({ frequency: "daily", keepAmountCents: -100 });
    expect(t.keepAmountCents).toBe(0);
    expect(t.feePercent).toBe(5);
  });

  it("the payout method changes the LABEL, never the Garage percentage", () => {
    const cells = affiliateFeeMatrix();
    expect(cells).toHaveLength(4);
    for (const c of cells) {
      const [crypto, bank] = [c.methods.find((m) => m.method === "crypto")!, c.methods.find((m) => m.method === "bank")!];
      expect(crypto.feePercent).toBe(c.feePercent);
      expect(bank.feePercent).toBe(c.feePercent);
      expect(crypto.bankFeeApplies).toBe(false);
      expect(bank.bankFeeApplies).toBe(true);
      expect(bank.label).toContain("bank transfer fees charged by the bank");
      expect(crypto.label).not.toContain("bank");
    }
  });

  it("renders the exact wording the product asked for", () => {
    const daily = resolveAffiliateFeeTier({ frequency: "daily", keepAmountCents: 0 });
    expect(describeAffiliateFee(daily, "crypto")).toBe("5% Garage processing fee");
    expect(describeAffiliateFee(daily, "bank")).toBe(
      "5% Garage processing fee + bank transfer fees charged by the bank"
    );
    const best = resolveAffiliateFeeTier({ frequency: "weekly", keepAmountCents: KEEP });
    expect(describeAffiliateFee(best, "crypto")).toBe("0% Garage processing fee");
    expect(describeAffiliateFee(best, "bank")).toBe(
      "0% Garage processing fee + bank transfer fees charged by the bank"
    );
  });

  it("the grid covers every combination once", () => {
    const keys = affiliateFeeMatrix().map((c) => `${c.frequency}:${c.keepsFifty}`).sort();
    expect(keys).toEqual(["daily:false", "daily:true", "weekly:false", "weekly:true"]);
  });
});
