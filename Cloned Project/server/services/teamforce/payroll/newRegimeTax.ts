/**
 * New Regime tax — Section 115BAC / FY 2024-25 (default).
 * Spec §9.
 *
 * Slabs (no age differentiation):
 *   ≤ ₹3L            : Nil
 *   ₹3L–₹7L          : 5%
 *   ₹7L–₹10L         : 10%
 *   ₹10L–₹12L        : 15%
 *   ₹12L–₹15L        : 20%
 *   > ₹15L           : 30%
 *
 * Sec 87A rebate (New Regime):
 *   IF net_taxable_income <= 7,00,000:
 *       rebate = MIN(tax_before_rebate, 25000)  // effective tax = 0 up to ₹7L
 *
 * Marginal relief (just above ₹7L):
 *   IF net_taxable_income > 7,00,000 AND tax_after_rebate > (income - 7,00,000):
 *       relief = tax_after_rebate - (income - 7,00,000)
 */

import type { RebateApplication } from "./types";

export const STD_DEDUCTION_NEW = 75000;
export const REBATE_NEW_THRESHOLD = 700000;
export const REBATE_NEW_CAP = 25000;

const SLABS: Array<{ upper: number; rate: number }> = [
  { upper: 300000, rate: 0 },
  { upper: 700000, rate: 0.05 },
  { upper: 1000000, rate: 0.1 },
  { upper: 1200000, rate: 0.15 },
  { upper: 1500000, rate: 0.2 },
  { upper: Infinity, rate: 0.3 },
];

export function computeNewRegimeTaxBeforeRebate(
  netTaxableIncome: number
): number {
  if (netTaxableIncome <= 0) return 0;
  let remaining = netTaxableIncome;
  let prevUpper = 0;
  let tax = 0;
  for (const s of SLABS) {
    if (remaining <= 0) break;
    const slabSize = s.upper - prevUpper;
    const taxableInSlab = Math.min(remaining, slabSize);
    tax += taxableInSlab * s.rate;
    remaining -= taxableInSlab;
    prevUpper = s.upper;
  }
  return tax;
}

export function applyRebate87ANew(
  taxBeforeRebate: number,
  netTaxableIncome: number
): RebateApplication {
  if (netTaxableIncome > REBATE_NEW_THRESHOLD) {
    return {
      rebateApplied: 0,
      taxAfterRebate: taxBeforeRebate,
      reason: "no_rebate_eligible",
    };
  }
  const rebate = Math.min(taxBeforeRebate, REBATE_NEW_CAP);
  const after = Math.max(0, taxBeforeRebate - rebate);
  return {
    rebateApplied: rebate,
    taxAfterRebate: after,
    reason: rebate >= taxBeforeRebate ? "rebate_full" : "rebate_capped",
  };
}

export interface MarginalReliefResult {
  applied: boolean;
  reliefAmount: number;
  taxAfterRelief: number;
}

export function applyMarginalReliefNew(
  taxAfterRebate: number,
  netTaxableIncome: number
): MarginalReliefResult {
  if (netTaxableIncome <= REBATE_NEW_THRESHOLD) {
    return { applied: false, reliefAmount: 0, taxAfterRelief: taxAfterRebate };
  }
  const incomeAboveThreshold = netTaxableIncome - REBATE_NEW_THRESHOLD;
  if (taxAfterRebate <= incomeAboveThreshold) {
    return { applied: false, reliefAmount: 0, taxAfterRelief: taxAfterRebate };
  }
  const relief = taxAfterRebate - incomeAboveThreshold;
  return {
    applied: true,
    reliefAmount: Math.round(relief),
    taxAfterRelief: Math.max(0, Math.round(incomeAboveThreshold)),
  };
}

export function computeNewRegimeTax(netTaxableIncome: number): {
  taxBeforeRebate: number;
  rebate: RebateApplication;
  marginalRelief: MarginalReliefResult;
} {
  const taxBeforeRebate = computeNewRegimeTaxBeforeRebate(netTaxableIncome);
  const rebate = applyRebate87ANew(taxBeforeRebate, netTaxableIncome);
  const marginalRelief = applyMarginalReliefNew(
    rebate.taxAfterRebate,
    netTaxableIncome
  );
  return { taxBeforeRebate, rebate, marginalRelief };
}
