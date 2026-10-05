/**
 * Shared types for the Teamforce payroll tax engine.
 * All amounts are in INR. All "annual" figures are full-FY, not prorated.
 */

export type Regime = "OLD" | "NEW";
export type CityType = "METRO" | "NON_METRO";
export type PFOption = "CEILING" | "ACTUAL";

/** PT slab as stored in the DB. Re-declared here so the engine has zero
 *  dependency on Mongoose models — any caller can synthesise a slab list. */
export interface PTSlab {
  state: string;
  grossFrom: number;
  grossTo: number | null; // null = "and above"
  monthlyPT: number;
  monthOverride: number | null; // 1..12 (calendar month) or null = all months
}

/** ESI contribution period covers Apr–Sep or Oct–Mar. Once an employee
 *  enters a period as covered, ESI continues for the whole period. */
export type ESIPeriod = "APR_SEP" | "OCT_MAR";

/** Sec 87A rebate handles for clarity in audit logs / breakdown. */
export interface RebateApplication {
  rebateApplied: number;
  taxAfterRebate: number;
  reason: "no_rebate_eligible" | "rebate_capped" | "rebate_full";
}

/** Surcharge with optional marginal-relief adjustment. */
export interface SurchargeResult {
  rate: number; // 0, 0.10, 0.15, 0.25, 0.37
  surcharge: number;
  marginalReliefApplied: number;
  effectiveSurcharge: number;
}
