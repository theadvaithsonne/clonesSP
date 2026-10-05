/**
 * Professional Tax — state-level monthly deduction. Applies to BOTH regimes.
 * Spec §7.
 *
 * - Slabs are matched against the current month's gross salary.
 * - When a slab carries `monthOverride`, it applies only in that calendar
 *   month (e.g. Maharashtra Feb = ₹300 for gross > ₹10,000).
 * - Annual PT cannot exceed ₹2,500 — once YTD reaches the cap, deduct ₹0.
 */

import type { PTSlab } from "./types";

export const ANNUAL_PT_CAP = 2500;

export interface PTInput {
  state: string;
  monthlyGross: number;
  payrollMonth: number; // 1..12 calendar month
  ytdPtPaid: number;
  slabs: PTSlab[];
}

export interface PTResult {
  monthlyPT: number;
  cappedByAnnualLimit: boolean;
  matchedSlab: PTSlab | null;
}

export function computeProfessionalTax(input: PTInput): PTResult {
  const candidates = input.slabs.filter(
    (s) =>
      s.state === input.state &&
      input.monthlyGross >= s.grossFrom &&
      (s.grossTo === null || input.monthlyGross <= s.grossTo)
  );

  // Prefer a month-specific override over the all-months row.
  const monthSpecific = candidates.find(
    (s) => s.monthOverride === input.payrollMonth
  );
  const allMonths = candidates.find((s) => s.monthOverride === null);
  const matched = monthSpecific || allMonths || null;

  if (!matched) {
    return { monthlyPT: 0, cappedByAnnualLimit: false, matchedSlab: null };
  }

  const remainingCap = Math.max(0, ANNUAL_PT_CAP - input.ytdPtPaid);
  const cappedByAnnualLimit = matched.monthlyPT > remainingCap;
  const monthlyPT = Math.min(matched.monthlyPT, remainingCap);

  return {
    monthlyPT: Math.round(monthlyPT),
    cappedByAnnualLimit,
    matchedSlab: matched,
  };
}
