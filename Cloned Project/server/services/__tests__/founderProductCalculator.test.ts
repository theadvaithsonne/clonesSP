import { calculateFounderProductEarnings } from "../founderProductCalculator";

// The live plan's numbers, so the tree kind is tested against what the
// engine actually pays. Only the fields the calculator reads.
const UP_PLAN: any = {
  name: "Unilevel Plus",
  productPrice: 25,
  currency: "USD",
  maxLevels: 15,
  pointValue: 0.02,
  legMultipliers: [1, 2, 3],
  companyPercentage: 4,
  directBonusPercentage: 36,
  levelBonusPercentage: 28.8,
  infinityTier1Percentage: 4.8,
  infinityTier2Percentage: 24,
  managerBonusPercentage: 2.4,
};

describe("founder product calculator — levels kind", () => {
  it("pays each level its founder-set share of the full price", () => {
    const r = calculateFounderProductEarnings({
      kind: "levels",
      productPrice: 40,
      levelPercents: [10, 5],
      salesByLevel: [3, 10],
    });
    expect(r.kind).toBe("levels");
    expect(r.breakdown.byLevel).toEqual([
      { level: 1, percent: 10, sales: 3, perSaleUsd: 4, monthlyUsd: 12 },
      { level: 2, percent: 5, sales: 10, perSaleUsd: 2, monthlyUsd: 20 },
    ]);
    expect(r.summary.youEarnPerMonthUsd).toBe(32);
    expect(r.summary.salesPerMonth).toBe(13);
    expect(r.plan.commissionPercent).toBe(15);
    expect(r.plan.commissionPerSaleUsd).toBe(6);
    expect(r.plan.returnedToFounderPerSaleUsd).toBe(0);
  });

  it("sales deeper than the founder's table pay nothing and are called out", () => {
    const r = calculateFounderProductEarnings({
      kind: "levels",
      productPrice: 100,
      levelPercents: [10],
      salesByLevel: [1, 50, 50],
    });
    expect(r.summary.youEarnPerMonthUsd).toBe(10);
    expect(r.breakdown.explanation).toMatch(/100 of your monthly sales sit deeper than level 1/);
  });

  it("duplication model: level-L sales = directs × dup^(L-1) × salesPerPerson", () => {
    const r = calculateFounderProductEarnings({
      kind: "levels",
      productPrice: 40,
      levelPercents: [10, 5, 5],
      directs: 5,
      duplication: 2,
      depth: 3,
      salesPerPerson: 2,
    });
    expect(r.inputs.salesByLevel).toEqual([10, 20, 40]);
    // 10×$4 + 20×$2 + 40×$2
    expect(r.summary.youEarnPerMonthUsd).toBe(160);
  });

  it("months multiplies the total, never the monthly figure", () => {
    const r = calculateFounderProductEarnings({
      kind: "levels",
      productPrice: 40,
      levelPercents: [10],
      salesByLevel: [5],
      months: 12,
    });
    expect(r.summary.youEarnPerMonthUsd).toBe(20);
    expect(r.summary.youEarnTotalUsd).toBe(240);
  });

  it("refuses a table over the 90% founder cap, same as commission.ts", () => {
    expect(() =>
      calculateFounderProductEarnings({ kind: "levels", productPrice: 10, levelPercents: [50, 41] })
    ).toThrow(RangeError);
  });

  it("refuses a non-positive price", () => {
    expect(() =>
      calculateFounderProductEarnings({ kind: "levels", productPrice: 0, levelPercents: [10] })
    ).toThrow(RangeError);
  });
});

describe("founder product calculator — unilevel_plus kind", () => {
  it("is the default kind — a founder assigns the UP comp plan and one percentage", () => {
    const r = calculateFounderProductEarnings(
      { productPrice: 40, commissionPercent: 10, directs: 0 },
      UP_PLAN
    );
    expect(r.kind).toBe("unilevel_plus");
    expect(r.plan.commissionPerSaleUsd).toBe(4);
  });

  it("splits the founder's pool by the tree's percentages, minus what returns to the founder", () => {
    // $40 × 10% = $4 pool. The screenshot claimed Direct $1.50 / Levels $1.20 /
    // T1 $0.20 / T2 $1.00 / Leadership $0.10. The engine pays 36/28.8/4.8/24
    // of $4 and returns 4% + 2.4% to the founder.
    const r = calculateFounderProductEarnings(
      { kind: "unilevel_plus", productPrice: 40, commissionPercent: 10, directs: 0 },
      UP_PLAN
    );
    expect(r.plan.commissionPerSaleUsd).toBe(4);
    const byName = Object.fromEntries(r.plan.schedule.map((s) => [s.name, s.perSaleUsd]));
    expect(byName["Direct bonus"]).toBe(1.44);
    expect(byName["Level bonus"]).toBe(1.15);
    expect(byName["Infinity Tier 1"]).toBe(0.19);
    expect(byName["Infinity Tier 2"]).toBe(0.96);
    expect(byName["Company share"]).toBe(0.16);
    expect(byName["Manager pool"]).toBe(0.1);
    expect(r.plan.returnedToFounderPerSaleUsd).toBe(0.26);
    expect(r.plan.networkMaxPerSaleUsd).toBe(3.74);
  });

  it("direct bonus only on level-1 purchases; infinity locked under 4 legs", () => {
    const r = calculateFounderProductEarnings(
      {
        kind: "unilevel_plus",
        productPrice: 40,
        commissionPercent: 10,
        directs: 3,
        salesByLevel: [3, 6, 12],
      },
      UP_PLAN
    );
    const p = r.breakdown.pools!;
    expect(p.directBonus.sales).toBe(3);
    expect(p.directBonus.usd).toBe(4.32); // 3 × $1.44
    expect(p.infinityTier1.qualified).toBe(false);
    expect(p.infinityTier1.usd).toBe(0);
    expect(p.infinityTier2.usd).toBe(0);
    expect(r.nextMilestone?.name).toBe("Infinity Tier 1");
  });

  it("level bonus: the point value scales to the pool, so a small sale still pays all 15 levels", () => {
    // $40 × 10% = $4 pool → level pool $1.15.
    //
    // This used to truncate. The point value was fixed at $0.02 — calibrated
    // to the $25 licence — while the pool shrank with the sale, so the chain
    // ate the pool and died: L1 .05 … L6 .32 (cumulative 1.13), L7 got the
    // last .02, and levels 8-15 earned nothing. Nobody was overpaid, so it
    // never alarmed.
    //
    // Scaling the point value by pool/$25 (= 0.16 → $0.0032/point), the same
    // way the engine does, makes the whole 15-level chain fit again.
    const r = calculateFounderProductEarnings(
      {
        kind: "unilevel_plus",
        productPrice: 40,
        commissionPercent: 10,
        directs: 10,
        salesByLevel: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      UP_PLAN
    );
    const rows = r.breakdown.byLevel.map((l) => l.perSaleUsd);
    // 2.7 average legs × level × $0.0032, carried to four places — these are
    // genuinely sub-cent, and rounding them to cents floored them to $0.
    expect(rows).toEqual([
      0.0086, 0.0173, 0.0259, 0.0346, 0.0432, 0.0518, 0.0605, 0.0691, 0.0778,
    ]);
    expect(rows.every((v) => v > 0)).toBe(true); // nothing truncated
    expect(r.plan.levelPoolReachesLevels).toBe(UP_PLAN.maxLevels);
    // The full 15-level chain still fits inside the pool — that is what
    // scaling buys, and it must never overspend it.
    const fullChain = Array.from({ length: 15 }, (_, i) => 2.7 * (i + 1) * 0.0032)
      .reduce((a, b) => a + b, 0);
    expect(fullChain).toBeLessThanOrEqual(4 * 0.288 + 1e-9);
    expect(r.breakdown.pools!.levelBonus.explanation).toMatch(/reaches about 15 levels/);
  });

  it("on a $25 pool the level pool covers all 15 levels, same as a licence sale", () => {
    // $250 × 10% = $25 → pool $7.20. Even at 3× on every leg, 15 levels consume
    // 0.06 × (1+…+15) = $7.20 exactly, so nothing is ever cut.
    const r = calculateFounderProductEarnings(
      {
        kind: "unilevel_plus",
        productPrice: 250,
        commissionPercent: 10,
        directs: 3, // avg 2×
        salesByLevel: [1, 1, 1, 1, 1],
      },
      UP_PLAN
    );
    expect(r.breakdown.byLevel.map((l) => l.perSaleUsd)).toEqual([0.04, 0.08, 0.12, 0.16, 0.2]);
    expect(r.plan.levelPoolReachesLevels).toBe(15);
  });

  it("infinity per-recipient amounts scale by pool/$25 but never above 1×", () => {
    const small = calculateFounderProductEarnings(
      { kind: "unilevel_plus", productPrice: 40, commissionPercent: 10, directs: 10, salesByLevel: [1] },
      UP_PLAN
    ).breakdown.pools!;
    expect(small.infinityTier1.perSaleUsd).toBe(0.06); // 0.40 × 0.16
    expect(small.infinityTier2.perSaleUsd).toBe(0.32); // 2.00 × 0.16
    const big = calculateFounderProductEarnings(
      { kind: "unilevel_plus", productPrice: 1000, commissionPercent: 10, directs: 10, salesByLevel: [1] },
      UP_PLAN
    ).breakdown.pools!;
    expect(big.infinityTier1.perSaleUsd).toBe(0.4); // $100 pool, still 1×
    expect(big.infinityTier2.perSaleUsd).toBe(2);
  });

  it("infinity is a headcount gate: 4+/10+ UP-active directs qualifies EVERY sale below you", () => {
    const r = calculateFounderProductEarnings(
      {
        kind: "unilevel_plus",
        productPrice: 250, // $25 pool → T1 $0.40, T2 $2.00 per recipient
        commissionPercent: 10,
        directs: 10,
        salesByLevel: [100],
      },
      UP_PLAN
    );
    const p = r.breakdown.pools!;
    expect(p.infinityTier1.perSaleUsd).toBe(0.4);
    expect(p.infinityTier1.qualifyingSales).toBe(100); // all of them, not (10−3)/10
    expect(p.infinityTier1.usd).toBe(40);
    expect(p.infinityTier2.perSaleUsd).toBe(2);
    expect(p.infinityTier2.qualifyingSales).toBe(100);
    expect(p.infinityTier2.usd).toBe(200);
    // 9 legs: T1 on everything, T2 locked
    const nine = calculateFounderProductEarnings(
      { kind: "unilevel_plus", productPrice: 250, commissionPercent: 10, directs: 9, salesByLevel: [100] },
      UP_PLAN
    ).breakdown.pools!;
    expect(nine.infinityTier1.qualifyingSales).toBe(100);
    expect(nine.infinityTier2.qualified).toBe(false);
    expect(nine.infinityTier2.usd).toBe(0);
  });

  it("requires the plan", () => {
    expect(() =>
      calculateFounderProductEarnings({ kind: "unilevel_plus", productPrice: 40, commissionPercent: 10 })
    ).toThrow(/plan is required/);
  });

  it("refuses over the 90% cap", () => {
    expect(() =>
      calculateFounderProductEarnings(
        { kind: "unilevel_plus", productPrice: 40, commissionPercent: 91 },
        UP_PLAN
      )
    ).toThrow(RangeError);
  });
});

const r2 = (n: number) => Math.round(n * 100) / 100;
