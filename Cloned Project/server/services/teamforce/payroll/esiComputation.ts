/**
 * Employees' State Insurance (ESI) — Section 192 statutory.
 * Spec §13.4:
 *   - Threshold: gross ≤ ₹21,000 → covered.
 *   - Two periods: April–September (P1) and October–March (P2).
 *   - Once covered at the start of a period, ESI continues for the WHOLE
 *     period regardless of mid-period salary increase.
 *   - Inverse: not covered at start → no ESI even if salary dips below ₹21k.
 *   - Rates: 0.75% employee, 3.25% employer (on full gross).
 */

import type { ESIPeriod } from "./types";

export const ESI_THRESHOLD = 21000;
export const ESI_EMPLOYEE_RATE = 0.0075;
export const ESI_EMPLOYER_RATE = 0.0325;

export function getESIPeriod(calendarMonth: number): ESIPeriod {
  return calendarMonth >= 4 && calendarMonth <= 9 ? "APR_SEP" : "OCT_MAR";
}

export interface ESIInput {
  monthlyGross: number;
  /** True iff the employee was on ESI at the start of the current contribution
   *  period. Caller (Section 192 pipeline) is responsible for tracking this
   *  sticky flag across months. */
  coveredAtPeriodStart: boolean;
}

export interface ESIResult {
  applies: boolean;
  employeeESI: number;
  employerESI: number;
}

export function computeESI(input: ESIInput): ESIResult {
  if (!input.coveredAtPeriodStart) {
    return { applies: false, employeeESI: 0, employerESI: 0 };
  }
  return {
    applies: true,
    employeeESI: Math.round(input.monthlyGross * ESI_EMPLOYEE_RATE),
    employerESI: Math.round(input.monthlyGross * ESI_EMPLOYER_RATE),
  };
}

/** Convenience: decide initial ESI coverage for a fresh contribution period. */
export function isESIEligibleAtPeriodStart(periodStartMonthlyGross: number): boolean {
  return periodStartMonthlyGross <= ESI_THRESHOLD;
}

/* ─────────────────────────────────────────────────────────────────────
 * Period stickiness helper (spec §13.4)
 *
 * Once an employee is covered at the start of an ESI contribution period
 * (April or October), coverage continues for that whole 6-month period
 * regardless of subsequent salary changes. The inverse is also true: if
 * NOT covered at period start, no ESI for the period even if salary dips.
 *
 * This helper is PURE — caller passes the prior-month transactions; the
 * helper figures out who set the period's coverage and returns sticky.
 * ───────────────────────────────────────────────────────────────────── */

export interface PriorMonthEsi {
  calendarMonth: number;
  calendarYear: number;
  monthlyGross: number;
  /** > 0 if ESI was deducted that month. */
  esiEmployee: number;
}

export interface DetermineEsiCoverageInput {
  /** Calendar month (1..12) of the run being computed. */
  calendarMonth: number;
  /** Calendar year of the run being computed. */
  calendarYear: number;
  /** Current month's gross — used only when no period-start history exists. */
  currentMonthlyGross: number;
  /**
   * Admin-set override on the profile. When true, we treat the employee as
   * covered regardless of gross / period-start history. Useful when policy
   * dictates ESI for everyone. */
  esiApplicableOnProfile: boolean;
  /** Prior approved/paid txns for this employee in this FY. */
  priorTxnsThisFy: PriorMonthEsi[];
}

export interface DetermineEsiCoverageResult {
  coveredAtPeriodStart: boolean;
  /** Brief explanation suitable for inclusion in transaction warnings. */
  reason:
    | "profile_override"
    | "period_start_this_month_eligible"
    | "period_start_this_month_not_eligible"
    | "carried_from_period_start"
    | "uncovered_from_period_start"
    | "joined_mid_period_eligible"
    | "joined_mid_period_not_eligible";
}

/** Period start month: 4 (April) for APR_SEP, 10 (October) for OCT_MAR. */
function periodStartMonthFor(periodMonth: number): 4 | 10 {
  return periodMonth >= 4 && periodMonth <= 9 ? 4 : 10;
}

export function determineEsiCoverage(
  input: DetermineEsiCoverageInput
): DetermineEsiCoverageResult {
  if (input.esiApplicableOnProfile) {
    return { coveredAtPeriodStart: true, reason: "profile_override" };
  }

  const startMonth = periodStartMonthFor(input.calendarMonth);
  // Period-start year handles Oct-Mar wrapping into the next calendar year.
  const startYear =
    startMonth === 4
      ? input.calendarYear
      : input.calendarMonth <= 3
        ? input.calendarYear - 1
        : input.calendarYear;

  // Case A: we're processing the period-start month itself.
  if (input.calendarMonth === startMonth && input.calendarYear === startYear) {
    return isESIEligibleAtPeriodStart(input.currentMonthlyGross)
      ? {
          coveredAtPeriodStart: true,
          reason: "period_start_this_month_eligible",
        }
      : {
          coveredAtPeriodStart: false,
          reason: "period_start_this_month_not_eligible",
        };
  }

  // Case B: look up the period-start transaction in the supplied history.
  const startTxn = input.priorTxnsThisFy.find(
    (t) => t.calendarMonth === startMonth && t.calendarYear === startYear
  );
  if (startTxn) {
    return startTxn.esiEmployee > 0
      ? { coveredAtPeriodStart: true, reason: "carried_from_period_start" }
      : { coveredAtPeriodStart: false, reason: "uncovered_from_period_start" };
  }

  // Case C: period start was never run (employee joined mid-period).
  // Fall back to current gross — best estimate without history.
  return isESIEligibleAtPeriodStart(input.currentMonthlyGross)
    ? { coveredAtPeriodStart: true, reason: "joined_mid_period_eligible" }
    : { coveredAtPeriodStart: false, reason: "joined_mid_period_not_eligible" };
}
