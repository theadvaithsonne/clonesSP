import { calculateWhiteLabelEarnings } from "../whiteLabelCalculator";

const UP_PLAN: any = {
  name: "Unilevel Plus", productPrice: 25, currency: "USD", maxLevels: 15, pointValue: 0.02,
  legMultipliers: [1, 2, 3], companyPercentage: 4, directBonusPercentage: 36,
  levelBonusPercentage: 28.8, infinityTier1Percentage: 4.8, infinityTier2Percentage: 24, managerBonusPercentage: 2.4,
};
const r2 = (n: number) => Math.round(n * 100) / 100;

describe("White Label calculator", () => {
  it("screenshot inputs: 3 new, 12 active — $204 per licence before level bonus, no incentive yet", () => {
    const r = calculateWhiteLabelEarnings(UP_PLAN, { newSalesThisMonth: 3, activeDirectLicences: 12 });
    expect(r.breakdown.directFlat.usd).toBe(1800);          // 12 × $150
    expect(r.breakdown.directBonus.perLicenceUsd).toBe(54); // 6 × $9
    expect(r.breakdown.directBonus.usd).toBe(648);
    expect(r.summary.recurringPerDirectLicenceUsd).toBeGreaterThanOrEqual(204);
    expect(r.breakdown.volumeBonus.usd).toBe(0);
    expect(r.nextMilestone).toMatchObject({ salesToGo: 7, wouldPayUsd: 1500 });
    // 12 legs → both infinity tiers open
    expect(r.breakdown.infinityTier1.qualified).toBe(true);
    expect(r.breakdown.infinityTier2.qualified).toBe(true);
    expect(r.summary.perYearUsd).toBeGreaterThan(2448);
  });

  it("volume bonus: 9 → 0, 10 → 1500, 15 → 2250 (uncapped, retroactive)", () => {
    const at = (n: number) => calculateWhiteLabelEarnings(UP_PLAN, { newSalesThisMonth: n }).breakdown.volumeBonus.usd;
    expect(at(9)).toBe(0);
    expect(at(10)).toBe(1500);
    expect(at(15)).toBe(2250);
    expect(at(100)).toBe(15000);
  });

  it("incentive is one-off; years multiplies only the recurring part", () => {
    const r = calculateWhiteLabelEarnings(UP_PLAN, { newSalesThisMonth: 10, activeDirectLicences: 10, years: 3 });
    expect(r.summary.thisMonthIncentiveUsd).toBe(1500);
    expect(r.summary.totalUsd).toBe(r2(r.summary.perYearUsd * 3 + 1500));
  });

  it("six units: level and infinity figures are 6× a single licence's", () => {
    const r = calculateWhiteLabelEarnings(UP_PLAN, { activeDirectLicences: 10, directs: 10, licencesByLevel: [10, 0, 5] });
    // 10 legs avg 2.7×; level 3: 2.7 × 3 × 0.02 × 6 = $0.97
    expect(r.breakdown.levelBonus.byLevel[2].perLicenceUsd).toBe(0.97);
    expect(r.breakdown.infinityTier1.perLicenceUsd).toBe(2.4); // 6 × $0.40
    expect(r.breakdown.infinityTier2.perLicenceUsd).toBe(12);  // 6 × $2.00
  });

  it("split adds up to the $600 price; commission is $306 in code ($150 + 6×$25 + $6), not the $300 the config comments claim", () => {
    const r = calculateWhiteLabelEarnings(UP_PLAN, {});
    expect(r.plan.commissionUsd).toBe(306);
    expect(r.plan.split.reduce((a, s) => a + s.usd, 0)).toBe(600);
  });
});
