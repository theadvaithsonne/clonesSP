import {
  computeFee,
  splitFeeForCompPlan,
  isChargeablePair,
  isFeeExempt,
  round8,
  MAX_FEE_BPS,
} from "../conversionFee";

describe("conversion fee — the spec's worked example", () => {
  // 100,000 INR -> BTC at 20%
  const f = computeFee(100000, 2000);

  it("takes 20,000 INR and converts 80,000", () => {
    expect(f.gross).toBe(100000);
    expect(f.amount).toBe(20000);
    expect(f.net).toBe(80000);
  });

  it("leaves the gross debit unchanged", () => {
    // The customer's wallet is debited the FULL amount; the fee is the
    // slice of it that went to the founder. balanceBefore - gross =
    // balanceAfter must still hold.
    expect(f.amount + f.net).toBe(f.gross);
  });
});

describe("conversion fee — fee + net === gross, always", () => {
  const grosses = [
    100000, 1, 0.5, 333.33333333, 0.00000003, 999999.99999999, 12345.6789,
    0.1, 0.07, 1e-8,
  ];
  const rates = [0, 1, 50, 250, 1000, 2000, 3333, 5000];

  it("holds across every amount x rate combination", () => {
    for (const g of grosses) {
      for (const bps of rates) {
        const f = computeFee(g, bps);
        expect(round8(f.amount + f.net)).toBe(round8(g));
        expect(f.amount).toBeGreaterThanOrEqual(0);
        expect(f.net).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("never lets the fee exceed the gross", () => {
    for (const g of grosses) {
      const f = computeFee(g, MAX_FEE_BPS);
      expect(f.amount).toBeLessThanOrEqual(f.gross);
      expect(f.net).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("conversion fee — rounding at 8dp", () => {
  it("rounds a fee to the 8th decimal", () => {
    // 10% of 333.33333333 = 33.333333333 -> 33.33333333
    const f = computeFee(333.33333333, 1000);
    expect(f.amount).toBe(33.33333333);
    expect(f.net).toBe(300);
  });

  it("charges nothing when the fee rounds away to dust", () => {
    // 20% of 1 satoshi = 0.000000002 -> rounds to 0.
    const f = computeFee(0.00000001, 2000);
    expect(f.amount).toBe(0);
    expect(f.net).toBe(0.00000001);
  });

  it("puts the rounding residue on net, never dangling", () => {
    const f = computeFee(0.00000003, 2000);
    expect(f.amount).toBe(0.00000001);
    expect(f.net).toBe(0.00000002);
    // NOTE: asserted at 8dp, deliberately. Adding two exact 8dp floats
    // can land outside 8dp — 1e-8 + 2e-8 is 3.0000000000000004e-8 in
    // IEEE754. That is precisely why the debit leg writes `gross`
    // directly instead of recomputing `fee + net`: the sum of the parts
    // is not bit-identical to the whole.
    expect(round8(f.amount + f.net)).toBe(0.00000003);
  });

  it("never reconstructs gross by adding the parts", () => {
    // Guards the design choice above. If someone later changes
    // computeFee to derive gross from fee + net, this catches it.
    const f = computeFee(0.00000003, 2000);
    expect(f.gross).toBe(0.00000003);
    expect(f.gross).not.toBe(f.amount + f.net);
  });
});

describe("conversion fee — zero and disabled", () => {
  it("charges nothing at 0 bps", () => {
    const f = computeFee(100000, 0);
    expect(f.amount).toBe(0);
    expect(f.net).toBe(100000);
    expect(f.feeBps).toBe(0);
  });
});

describe("conversion fee — which pairs are chargeable", () => {
  it("never charges a true same-currency relocation", () => {
    expect(isChargeablePair("USD", "USD")).toBe(false);
    expect(isChargeablePair("inr", "INR")).toBe(false);
  });

  it("DOES allow charging stablecoin identity hops", () => {
    // The FX layer prices these 1:1, but moving between fiat USD and a
    // stablecoin is a real OTC service the desk may price.
    expect(isChargeablePair("USD", "USDT")).toBe(true);
    expect(isChargeablePair("USDT", "USDC")).toBe(true);
  });

  it("charges real conversions", () => {
    expect(isChargeablePair("INR", "BTC")).toBe(true);
    expect(isChargeablePair("BTC", "INR")).toBe(true);
  });
});

describe("conversion fee — founder self-exemption", () => {
  it("exempts the payer when they are the beneficiary", () => {
    expect(isFeeExempt("66ab", "66ab")).toBe(true);
  });
  it("charges everyone else", () => {
    expect(isFeeExempt("66cd", "66ab")).toBe(false);
  });
});

describe("conversion fee — the spec's §5 blind spot", () => {
  it("charges nothing when the fee would ROUND UP to the whole amount", () => {
    // 50% of 1 satoshi = 0.000000005, which rounds to 0.00000001 — the
    // entire amount. The spec assumes the 50% cap makes net <= 0
    // unreachable; rounding on dust makes it reachable. Charging here
    // would debit the customer and deliver them nothing.
    const f = computeFee(0.00000001, 5000);
    expect(f.amount).toBe(0);
    expect(f.net).toBe(0.00000001);
  });

  it("still throws on a genuinely corrupt rate (>= 100%)", () => {
    // Not a rounding artefact — the cap should have stopped this.
    expect(() => computeFee(100000, 10000)).toThrow(/>= 100%/);
  });

  it("leaves a normal 50% conversion untouched", () => {
    const f = computeFee(100, 5000);
    expect(f.amount).toBe(50);
    expect(f.net).toBe(50);
  });
});

describe("conversion fee — comp-plan split", () => {
  it("splits the FEE, not the conversion: 50% of a 2% fee", () => {
    // 100,000 INR at 2% = 2,000 fee. Comp plan takes 50% of THAT.
    const fee = computeFee(100000, 200);
    expect(fee.amount).toBe(2000);
    const split = splitFeeForCompPlan(fee.amount, 50);
    expect(split.compPlanShare).toBe(1000);
    expect(split.founderShare).toBe(1000);
  });

  it("keeps founderShare + compPlanShare === fee", () => {
    for (const fee of [2000, 1, 0.07, 333.33333333, 0.00000003]) {
      for (const pct of [0, 1, 25, 50, 99.5, 100]) {
        const s = splitFeeForCompPlan(fee, pct);
        expect(round8(s.founderShare + s.compPlanShare)).toBe(round8(fee));
        expect(s.founderShare).toBeGreaterThanOrEqual(0);
        expect(s.compPlanShare).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("gives the founder everything at 0%", () => {
    const s = splitFeeForCompPlan(2000, 0);
    expect(s.founderShare).toBe(2000);
    expect(s.compPlanShare).toBe(0);
  });

  it("gives the tree everything at 100%", () => {
    const s = splitFeeForCompPlan(2000, 100);
    expect(s.founderShare).toBe(0);
    expect(s.compPlanShare).toBe(2000);
  });

  it("puts the rounding residue on the FOUNDER, never dropped", () => {
    // 33.333...% of 100 is 33.33333333; founder gets the remainder so
    // nothing is lost to rounding.
    const s = splitFeeForCompPlan(100, 33.333333);
    expect(round8(s.founderShare + s.compPlanShare)).toBe(100);
    expect(s.founderShare).toBeGreaterThan(s.compPlanShare);
  });

  it("leaves dust with the founder rather than distributing it", () => {
    // 1% of one satoshi rounds to nothing — not worth a tree payout.
    const s = splitFeeForCompPlan(0.00000001, 1);
    expect(s.compPlanShare).toBe(0);
    expect(s.founderShare).toBe(0.00000001);
  });
});
