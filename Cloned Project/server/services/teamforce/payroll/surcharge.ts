/**
 * Surcharge — applies on top of income-tax. Spec §10.
 *
 * Slabs (both regimes by income):
 *   ≤ ₹50L            : 0%
 *   ₹50L - ₹1Cr       : 10%
 *   ₹1Cr - ₹2Cr       : 15%
 *   ₹2Cr - ₹5Cr       : 25%
 *   > ₹5Cr            : Old → 37%, New → 25%
 *
 * Marginal relief applies at every slab boundary so that the additional
 * tax due to crossing into a higher surcharge bracket cannot exceed the
 * incremental income beyond the threshold.
 */

import type { Regime, SurchargeResult } from "./types";

const THRESHOLDS = [5000000, 10000000, 20000000, 50000000];
const RATES_OLD = [0.1, 0.15, 0.25, 0.37];
const RATES_NEW = [0.1, 0.15, 0.25, 0.25];

function rateForIncome(netTaxableIncome: number, regime: Regime): {
  rate: number;
  threshold: number;
  prevThreshold: number;
} {
  if (netTaxableIncome <= THRESHOLDS[0]) {
    return { rate: 0, threshold: THRESHOLDS[0], prevThreshold: 0 };
  }
  const rates = regime === "OLD" ? RATES_OLD : RATES_NEW;
  for (let i = 0; i < THRESHOLDS.length; i++) {
    const upper = THRESHOLDS[i + 1] ?? Infinity;
    if (netTaxableIncome <= upper) {
      return {
        rate: rates[i],
        threshold: upper,
        prevThreshold: THRESHOLDS[i],
      };
    }
  }
  return {
    rate: rates[rates.length - 1],
    threshold: Infinity,
    prevThreshold: THRESHOLDS[THRESHOLDS.length - 1],
  };
}

export function computeSurcharge(
  taxAfterRebate: number,
  netTaxableIncome: number,
  regime: Regime,
  /** Caller injects "tax at the threshold" — the same regime tax function applied
   *  to (prevThreshold). Avoids a circular import here. */
  taxAtPrevThresholdComputer: (incomeAtThreshold: number) => number
): SurchargeResult {
  const { rate, prevThreshold } = rateForIncome(netTaxableIncome, regime);
  if (rate === 0) {
    return { rate: 0, surcharge: 0, marginalReliefApplied: 0, effectiveSurcharge: 0 };
  }

  const surcharge = Math.round(taxAfterRebate * rate);

  // Marginal relief: total tax (tax + surcharge) above threshold should not
  // exceed (tax_at_threshold + (income - threshold)).
  const taxAtThreshold = taxAtPrevThresholdComputer(prevThreshold);
  const totalTaxThis = taxAfterRebate + surcharge;
  const incomeAboveThreshold = netTaxableIncome - prevThreshold;
  const allowedTaxIncrease = incomeAboveThreshold;
  const actualTaxIncrease = totalTaxThis - taxAtThreshold;

  if (actualTaxIncrease > allowedTaxIncrease) {
    const relief = actualTaxIncrease - allowedTaxIncrease;
    const effective = Math.max(0, surcharge - relief);
    return {
      rate,
      surcharge,
      marginalReliefApplied: Math.round(relief),
      effectiveSurcharge: Math.round(effective),
    };
  }

  return {
    rate,
    surcharge,
    marginalReliefApplied: 0,
    effectiveSurcharge: surcharge,
  };
}
