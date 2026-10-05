/**
 * Old Regime tax — Section 192 / FY 2024-25.
 * Spec §8.
 *
 * Age-tiered slabs:
 *   < 60:  Nil up to ₹2.5L; 5% to ₹5L; 20% to ₹10L; 30% above
 *   60-79: Nil up to ₹3L;   5% to ₹5L; 20% to ₹10L; 30% above
 *   80+:   Nil up to ₹5L;                20% to ₹10L; 30% above
 *
 * Sec 87A rebate (Old Regime):
 *   IF net_taxable_income <= 5,00,000:
 *       rebate = MIN(tax_before_rebate, 12500)
 *       tax_after_rebate = tax_before_rebate - rebate
 */

import type { RebateApplication } from "./types";

export const STD_DEDUCTION_OLD = 50000;
export const REBATE_OLD_THRESHOLD = 500000;
export const REBATE_OLD_CAP = 12500;

interface SlabPair {
  upper: number;
  rate: number;
}

function slabsForAge(age: number): SlabPair[] {
  if (age >= 80) {
    return [
      { upper: 500000, rate: 0 },
      { upper: 1000000, rate: 0.2 },
      { upper: Infinity, rate: 0.3 },
    ];
  }
  if (age >= 60) {
    return [
      { upper: 300000, rate: 0 },
      { upper: 500000, rate: 0.05 },
      { upper: 1000000, rate: 0.2 },
      { upper: Infinity, rate: 0.3 },
    ];
  }
  return [
    { upper: 250000, rate: 0 },
    { upper: 500000, rate: 0.05 },
    { upper: 1000000, rate: 0.2 },
    { upper: Infinity, rate: 0.3 },
  ];
}

export function computeOldRegimeTaxBeforeRebate(
  netTaxableIncome: number,
  age: number
): number {
  if (netTaxableIncome <= 0) return 0;
  const slabs = slabsForAge(age);
  let remaining = netTaxableIncome;
  let prevUpper = 0;
  let tax = 0;
  for (const s of slabs) {
    if (remaining <= 0) break;
    const slabSize = s.upper - prevUpper;
    const taxableInSlab = Math.min(remaining, slabSize);
    tax += taxableInSlab * s.rate;
    remaining -= taxableInSlab;
    prevUpper = s.upper;
  }
  return tax;
}

export function applyRebate87AOld(
  taxBeforeRebate: number,
  netTaxableIncome: number
): RebateApplication {
  if (netTaxableIncome > REBATE_OLD_THRESHOLD) {
    return {
      rebateApplied: 0,
      taxAfterRebate: taxBeforeRebate,
      reason: "no_rebate_eligible",
    };
  }
  const rebate = Math.min(taxBeforeRebate, REBATE_OLD_CAP);
  const after = Math.max(0, taxBeforeRebate - rebate);
  return {
    rebateApplied: rebate,
    taxAfterRebate: after,
    reason: rebate >= taxBeforeRebate ? "rebate_full" : "rebate_capped",
  };
}

export function computeOldRegimeTax(
  netTaxableIncome: number,
  age: number
): { taxBeforeRebate: number; rebate: RebateApplication } {
  const taxBeforeRebate = computeOldRegimeTaxBeforeRebate(netTaxableIncome, age);
  const rebate = applyRebate87AOld(taxBeforeRebate, netTaxableIncome);
  return { taxBeforeRebate, rebate };
}
