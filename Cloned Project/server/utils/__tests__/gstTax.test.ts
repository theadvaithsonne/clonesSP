import {
  applyGstToLine,
  getCommissionBase,
  isIndiaCountry,
  GST_CONFIG,
} from "../gstTax";

// ₹1,000 base / ₹1,180 inclusive, in paise.
const BASE = 100000;
const INCLUSIVE = 118000;
const TAX = 18000;

describe("isIndiaCountry", () => {
  it.each(["IN", "in", "India", "INDIA", "  india  "])(
    "treats %p as India",
    (v) => expect(isIndiaCountry(v)).toBe(true)
  );

  it.each(["US", "USA", "United States", "Indiana", "", "   ", null, undefined])(
    "does not treat %p as India",
    (v) => expect(isIndiaCountry(v as any)).toBe(false)
  );
});

describe("applyGstToLine — the GST matrix", () => {
  it("inclusive + Indian buyer: splits tax out, buyer pays the listed price", () => {
    const r = applyGstToLine({
      listedAmountMinor: INCLUSIVE,
      gstInclusive: true,
      buyerInIndia: true,
    });
    expect(r.lineUnitPrice).toBe(BASE);
    expect(r.taxTotal).toBe(TAX);
    expect(r.chargeTotal).toBe(INCLUSIVE);
    expect(r.gstMetadata).toEqual({
      rate: 18,
      amount: TAX,
      inclusive: true,
      sacCode: GST_CONFIG.sacCode,
    });
  });

  it("inclusive + foreign buyer: no tax, whole listed price is base", () => {
    const r = applyGstToLine({
      listedAmountMinor: INCLUSIVE,
      gstInclusive: true,
      buyerInIndia: false,
    });
    // The decision that the founder keeps the full amount — base is the
    // listed price, NOT the extracted ₹1,000.
    expect(r.lineUnitPrice).toBe(INCLUSIVE);
    expect(r.taxTotal).toBe(0);
    expect(r.chargeTotal).toBe(INCLUSIVE);
    expect(r.gstMetadata).toBeUndefined();
  });

  it("exclusive + Indian buyer: adds 18% on top", () => {
    const r = applyGstToLine({
      listedAmountMinor: BASE,
      gstInclusive: false,
      buyerInIndia: true,
    });
    expect(r.lineUnitPrice).toBe(BASE);
    expect(r.taxTotal).toBe(TAX);
    expect(r.chargeTotal).toBe(INCLUSIVE);
    expect(r.gstMetadata?.inclusive).toBe(false);
  });

  it("exclusive + foreign buyer: pays the listed price, no tax", () => {
    const r = applyGstToLine({
      listedAmountMinor: BASE,
      gstInclusive: false,
      buyerInIndia: false,
    });
    expect(r.lineUnitPrice).toBe(BASE);
    expect(r.taxTotal).toBe(0);
    expect(r.chargeTotal).toBe(BASE);
    expect(r.gstMetadata).toBeUndefined();
  });

  it("exempt items carry no tax even for an Indian buyer", () => {
    for (const gstInclusive of [true, false]) {
      const r = applyGstToLine({
        listedAmountMinor: INCLUSIVE,
        gstInclusive,
        buyerInIndia: true,
        exempt: true,
      });
      expect(r.taxTotal).toBe(0);
      expect(r.lineUnitPrice).toBe(INCLUSIVE);
      expect(r.gstMetadata).toBeUndefined();
    }
  });

  it("currency plays no part — only the buyer's region does", () => {
    // Same call, whatever the item was priced in. There is no currency
    // parameter at all; this asserts the shape rather than a behaviour,
    // guarding against a currency gate creeping back in.
    const indian = applyGstToLine({
      listedAmountMinor: BASE,
      gstInclusive: false,
      buyerInIndia: true,
    });
    const foreign = applyGstToLine({
      listedAmountMinor: BASE,
      gstInclusive: false,
      buyerInIndia: false,
    });
    expect(indian.taxTotal).toBeGreaterThan(0);
    expect(foreign.taxTotal).toBe(0);
  });

  describe("quantity", () => {
    it("scales tax and charge but not the unit price", () => {
      const r = applyGstToLine({
        listedAmountMinor: BASE,
        quantity: 3,
        gstInclusive: false,
        buyerInIndia: true,
      });
      expect(r.lineUnitPrice).toBe(BASE);
      expect(r.taxTotal).toBe(TAX * 3);
      expect(r.chargeTotal).toBe(INCLUSIVE * 3);
    });

    it("defaults to 1", () => {
      const r = applyGstToLine({
        listedAmountMinor: BASE,
        gstInclusive: false,
        buyerInIndia: true,
      });
      expect(r.chargeTotal).toBe(INCLUSIVE);
    });
  });

  describe("invariants across awkward amounts", () => {
    // Razorpay rejects fractional paise, so everything must stay integral
    // and the parts must always reconstruct the total.
    const amounts = [1, 7, 99, 333, 1000, 12345, 99999, 100001, 7777777];

    it.each(amounts)(
      "base + tax === charge, all integers (amount %p)",
      (amount) => {
        for (const gstInclusive of [true, false]) {
          for (const buyerInIndia of [true, false]) {
            const r = applyGstToLine({
              listedAmountMinor: amount,
              quantity: 2,
              gstInclusive,
              buyerInIndia,
            });
            expect(Number.isInteger(r.lineUnitPrice)).toBe(true);
            expect(Number.isInteger(r.taxTotal)).toBe(true);
            expect(Number.isInteger(r.chargeTotal)).toBe(true);
            expect(r.lineUnitPrice * 2 + r.taxTotal).toBe(r.chargeTotal);
          }
        }
      }
    );

    it.each(amounts)(
      "an Indian buyer never pays more for inclusive than exclusive (amount %p)",
      (amount) => {
        const inc = applyGstToLine({
          listedAmountMinor: amount,
          gstInclusive: true,
          buyerInIndia: true,
        });
        const exc = applyGstToLine({
          listedAmountMinor: amount,
          gstInclusive: false,
          buyerInIndia: true,
        });
        expect(inc.chargeTotal).toBe(amount);
        expect(exc.chargeTotal).toBeGreaterThanOrEqual(amount);
      }
    );
  });
});

describe("getCommissionBase", () => {
  it("extracts the pre-tax base for inclusive + Indian buyer", () => {
    expect(getCommissionBase(1180, { gstInclusive: true }, true)).toBe(1000);
  });

  it("keeps the full listed price for inclusive + foreign buyer", () => {
    // Mirrors applyGstToLine: no GST was collected, so it is all base.
    // This is why foreign inclusive sales pay 18% more commission.
    expect(getCommissionBase(1180, { gstInclusive: true }, false)).toBe(1180);
  });

  it("keeps the listed price for exclusive pricing, either region", () => {
    expect(getCommissionBase(1000, { gstInclusive: false }, true)).toBe(1000);
    expect(getCommissionBase(1000, { gstInclusive: false }, false)).toBe(1000);
  });

  it("matches the line-item base applyGstToLine produces", () => {
    // The two must agree or commissions drift from the invoice subtotal.
    for (const gstInclusive of [true, false]) {
      for (const buyerInIndia of [true, false]) {
        const line = applyGstToLine({
          listedAmountMinor: 118000,
          gstInclusive,
          buyerInIndia,
        });
        const commission = getCommissionBase(1180, { gstInclusive }, buyerInIndia);
        expect(commission).toBeCloseTo(line.lineUnitPrice / 100, 2);
      }
    }
  });
});
