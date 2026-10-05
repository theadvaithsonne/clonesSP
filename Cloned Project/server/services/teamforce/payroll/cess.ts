/**
 * Health & Education Cess — flat 4% on (tax_after_rebate + surcharge).
 * Spec §10.
 */

export const CESS_RATE = 0.04;

export function computeCess(taxPlusSurcharge: number): number {
  return Math.round(taxPlusSurcharge * CESS_RATE);
}
