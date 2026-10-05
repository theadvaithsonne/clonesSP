import { calculateFoundersOfficeEarnings } from "../foundersOfficeCalculator";

const UP_PLAN: any = {
  name: "Unilevel Plus", productPrice: 25, currency: "USD", maxLevels: 15, pointValue: 0.02,
  legMultipliers: [1, 2, 3], companyPercentage: 4, directBonusPercentage: 36,
  levelBonusPercentage: 28.8, infinityTier1Percentage: 4.8, infinityTier2Percentage: 24, managerBonusPercentage: 2.4,
};

describe("Founders Office calculator", () => {
  it("the screenshot's inputs: 10 new, 30 active, no deeper levels", () => {
    const r = calculateFoundersOfficeEarnings(UP_PLAN, { newSubsThisMonth: 10, activeDirectSubs: 30 });
    // $24 flat + $9 direct on each of 30 subs, plus level-1 bonus with 30 legs
    // averaging 2.9333×: 2.9333 × 1 × 0.02 = $0.06 per sub → $1.80.
    expect(r.breakdown.directFlat.usd).toBe(720);
    expect(r.breakdown.directBonus.usd).toBe(270);
    expect(r.breakdown.levelBonus.usd).toBe(1.8);
    expect(r.breakdown.volumeBonus.usd).toBe(0);
    expect(r.breakdown.volumeBonus.tier).toBe("none");
    // 30 legs ≥ 10: both infinity tiers open on the 30 subs.
    expect(r.breakdown.infinityTier1.qualified).toBe(true);
    expect(r.breakdown.infinityTier2.qualified).toBe(true);
    expect(r.summary.everyMonthAfterUsd).toBeGreaterThan(991);
    expect(r.summary.thisMonthUsd).toBe(r.summary.everyMonthAfterUsd);
    expect(r.nextMilestone).toMatchObject({ name: "Volume bonus", salesToGo: 40, wouldPayUsd: 1200 });
  });

  it("volume bonus tiers mirror config: 49 → 0, 50 → 1200, 99 → 2376, 100 → 4800, 150 → 4800", () => {
    const at = (n: number) => calculateFoundersOfficeEarnings(UP_PLAN, { newSubsThisMonth: n }).breakdown.volumeBonus;
    expect(at(49).usd).toBe(0);
    expect(at(50)).toMatchObject({ usd: 1200, tier: "lower", perSaleUsd: 24 });
    expect(at(99).usd).toBe(2376);
    expect(at(100)).toMatchObject({ usd: 4800, tier: "upper", countedSubs: 100, perSaleUsd: 48 });
    expect(at(150)).toMatchObject({ usd: 4800, countedSubs: 100 });
  });

  it("volume bonus is one-off: this month includes it, every-month-after does not, total counts it once", () => {
    const r = calculateFoundersOfficeEarnings(UP_PLAN, { newSubsThisMonth: 50, activeDirectSubs: 50, months: 12 });
    expect(r.summary.thisMonthUsd).toBe(r2(r.summary.everyMonthAfterUsd + 1200));
    expect(r.summary.totalUsd).toBe(r2(r.summary.everyMonthAfterUsd * 12 + 1200));
  });

  it("new sales this month are always counted as active", () => {
    const r = calculateFoundersOfficeEarnings(UP_PLAN, { newSubsThisMonth: 10, activeDirectSubs: 3 });
    expect(r.inputs.activeDirectSubs).toBe(10);
    expect(r.breakdown.directFlat.subs).toBe(10);
  });

  it("deeper levels earn the tree's level bonus only — no $24 flat, no $9 direct", () => {
    const r = calculateFoundersOfficeEarnings(UP_PLAN, { activeDirectSubs: 3, directs: 3, subsByLevel: [3, 0, 10] });
    expect(r.breakdown.directFlat.subs).toBe(3);
    expect(r.breakdown.directBonus.subs).toBe(3);
    // 3 legs → avg 2×; level 3 pays 2 × 3 × 0.02 = $0.12 per sub → $1.20
    expect(r.breakdown.levelBonus.byLevel[2]).toMatchObject({ level: 3, subs: 10, perSubUsd: 0.12, monthlyUsd: 1.2 });
    expect(r.breakdown.infinityTier1.qualified).toBe(false);
  });

  it("directs default to activeDirectSubs and can be overridden", () => {
    const a = calculateFoundersOfficeEarnings(UP_PLAN, { activeDirectSubs: 5 });
    expect(a.inputs.directs).toBe(5);
    const b = calculateFoundersOfficeEarnings(UP_PLAN, { activeDirectSubs: 5, directs: 0 });
    expect(b.inputs.directs).toBe(0);
    expect(b.breakdown.levelBonus.usd).toBe(0);
    // The flat and direct bonus do not depend on legs.
    expect(b.breakdown.directFlat.usd).toBe(120);
    expect(b.breakdown.directBonus.usd).toBe(45);
  });

  it("split adds up to the $96 price", () => {
    const r = calculateFoundersOfficeEarnings(UP_PLAN, {});
    expect(r.plan.split.reduce((a, s) => a + s.usd, 0)).toBe(96);
    expect(r.plan.split.map((s) => s.usd)).toEqual([25, 24, 47]);
  });
});

const r2 = (n: number) => Math.round(n * 100) / 100;
