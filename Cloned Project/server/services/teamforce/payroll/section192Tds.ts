/**
 * Section 192 — Monthly TDS computation pipeline.
 * Spec §11. Wires together every other module in this folder:
 *
 *   YTD actuals + projected gross
 *     → exemptions (HRA, LTA, Children) — Old Regime only
 *     → standard deduction (regime-specific)
 *     → Chapter VI-A (Old Regime + 80CCD(2) for both)
 *     → Professional Tax (annualised)
 *     → net taxable income
 *     → income tax (regime-specific) + 87A rebate
 *     → marginal relief (New Regime ₹7L boundary)
 *     → surcharge (with marginal relief at 50L/1Cr/2Cr/5Cr)
 *     → cess (4%)
 *     → annual_tax_liability − ytd_tds_deducted, divided over remaining months
 */

import type { CityType, PTSlab, Regime } from "./types";
import { computeHRAExemption } from "./hraExemption";
import { computeLTAExemption } from "./ltaExemption";
import { computeChildrenAllowanceExemption } from "./childrenAllowanceExemption";
import { computeProfessionalTax } from "./ptComputation";
import {
  computeOldRegimeTax,
  STD_DEDUCTION_OLD,
  computeOldRegimeTaxBeforeRebate,
  applyRebate87AOld,
} from "./oldRegimeTax";
import {
  computeNewRegimeTax,
  STD_DEDUCTION_NEW,
  computeNewRegimeTaxBeforeRebate,
  applyRebate87ANew,
  applyMarginalReliefNew,
} from "./newRegimeTax";
import { computeSurcharge } from "./surcharge";
import { computeCess } from "./cess";
import { computeChapterVIA, type ChapterVIAInput } from "./chapterVIA";
import { getRemainingMonthsInFY } from "./fyHelpers";

export interface Section192Input {
  // Employee static
  age: number;
  state: string;
  cityType: CityType;
  regime: Regime;

  // YTD actuals (April → end of last completed payroll month, in INR)
  ytdActualGross: number;
  ytdTdsDeducted: number;
  ytdPtPaid: number;
  ytdPfEmployeeAnnual: number;

  // Current pay-month context (drives projection)
  payrollMonth: number; // calendar month 1..12
  payrollYear: number;
  monthlyGross: number;

  // Salary structure breakdown (annual; for Old Regime exemptions)
  basicAnnual: number;
  daAnnual: number;
  hraAnnual: number;
  ltaAnnual: number;
  educationAllowanceAnnual: number;
  hostelAllowanceAnnual: number;

  // Employer NPS (both regimes via 80CCD(2))
  employerNpsAnnual: number;

  // Old-regime declarations (ignored if regime === NEW)
  hraDeclaration?: {
    monthlyRentPaid: number;
    ownsHouseInCity: boolean;
    rentDeclarationProvided: boolean;
    landlordPanProvided: boolean;
  };
  ltaClaimAmount?: number;
  numChildren?: number;

  // Chapter VI-A declared amounts (Old Regime only, except 80CCD(2))
  declared80C?: number;
  declaredNpsSelf?: number;
  declared80DSelf?: number;
  declared80DParent?: number;
  parentSeniorCitizen?: boolean;
  savingsInterest?: number;
  fdInterest?: number;
  declared80E?: number;
  declared80EEA?: number;
  declared80G?: number;
  isCentralGovt?: boolean;

  // PT lookup
  ptSlabs: PTSlab[];

  /** Spec §13.2 — when this is the employee's final payroll month (F&F /
   *  exit), TDS is the FULL remaining liability instead of being spread
   *  across notional remaining months. */
  isFinalMonth?: boolean;
}

export interface Section192Result {
  // Inputs that drive everything
  fyMonthsElapsed: number;
  remainingMonths: number;
  projectedAnnualGross: number;

  // Old-regime exemptions (zero in New Regime)
  hraExempt: number;
  ltaExempt: number;
  childrenExempt: number;
  totalExemptions: number;

  taxableSalary: number;
  standardDeduction: number;
  taxableAfterStdDed: number;

  // Chapter VI-A
  chapterVIATotal: number;

  // PT (annualised — actuals + projected remaining)
  projectedAnnualPT: number;

  netTaxableIncome: number;

  // Tax stack
  taxBeforeRebate: number;
  rebateApplied: number;
  taxAfterRebate: number;
  marginalReliefNew: number;
  surchargeRate: number;
  surcharge: number;
  surchargeMarginalRelief: number;
  cess: number;
  annualTaxLiability: number;

  // Output
  monthlyTDS: number;
  /** True when YTD TDS already exceeds the new annual liability — caller
   *  should deduct ₹0 for remaining months and refund happens via ITR. */
  overDeducted: boolean;
}

export function computeSection192TDS(input: Section192Input): Section192Result {
  // --- Step 1: project annual gross ---
  const fyMonthsElapsed = 12 - getRemainingMonthsInFY(input.payrollMonth);
  const remainingMonths = 12 - fyMonthsElapsed;
  const projectedAnnualGross =
    input.ytdActualGross + input.monthlyGross * remainingMonths;

  // --- Step 2: exemptions (Old Regime only) ---
  let hraExempt = 0;
  let ltaExempt = 0;
  let childrenExempt = 0;

  if (input.regime === "OLD") {
    if (input.hraDeclaration && input.hraAnnual > 0) {
      const r = computeHRAExemption({
        hraAnnualReceived: input.hraAnnual,
        basicAnnual: input.basicAnnual,
        monthlyRentPaid: input.hraDeclaration.monthlyRentPaid,
        cityType: input.cityType,
        ownsHouseInCity: input.hraDeclaration.ownsHouseInCity,
        rentDeclarationProvided: input.hraDeclaration.rentDeclarationProvided,
        landlordPanProvided: input.hraDeclaration.landlordPanProvided,
      });
      hraExempt = r.exempt;
    }
    if (input.ltaAnnual > 0 && input.ltaClaimAmount) {
      ltaExempt = computeLTAExemption({
        ltaAnnualComponent: input.ltaAnnual,
        ltaClaimAmount: input.ltaClaimAmount,
      }).exempt;
    }
    if (
      (input.educationAllowanceAnnual > 0 || input.hostelAllowanceAnnual > 0) &&
      (input.numChildren || 0) > 0
    ) {
      childrenExempt = computeChildrenAllowanceExemption({
        educationAnnual: input.educationAllowanceAnnual,
        hostelAnnual: input.hostelAllowanceAnnual,
        numChildren: input.numChildren!,
      }).totalExempt;
    }
  }

  const totalExemptions = hraExempt + ltaExempt + childrenExempt;
  const taxableSalary = Math.max(0, projectedAnnualGross - totalExemptions);

  // --- Step 3: standard deduction (both regimes) ---
  const standardDeduction =
    input.regime === "NEW" ? STD_DEDUCTION_NEW : STD_DEDUCTION_OLD;
  const taxableAfterStdDed = Math.max(0, taxableSalary - standardDeduction);

  // --- Step 4: Chapter VI-A ---
  const chapterVIA = computeChapterVIA({
    declared80C: input.declared80C || 0,
    pfEmployeeAnnual: input.ytdPfEmployeeAnnual,
    declaredNpsSelf: input.declaredNpsSelf || 0,
    basicAnnual: input.basicAnnual,
    daAnnual: input.daAnnual,
    employerNpsAnnual: input.employerNpsAnnual,
    isCentralGovt: input.isCentralGovt,
    declared80DSelf: input.declared80DSelf || 0,
    selfAge: input.age,
    declared80DParent: input.declared80DParent || 0,
    parentSeniorCitizen: input.parentSeniorCitizen || false,
    savingsInterest: input.savingsInterest || 0,
    fdInterest: input.fdInterest || 0,
    declared80E: input.declared80E || 0,
    declared80EEA: input.declared80EEA || 0,
    declared80G: input.declared80G || 0,
  });
  const chapterVIATotal =
    input.regime === "OLD" ? chapterVIA.total : chapterVIA.availableInNewRegime;

  // --- Step 5: PT projection (annual) ---
  const ptThisMonth = computeProfessionalTax({
    state: input.state,
    monthlyGross: input.monthlyGross,
    payrollMonth: input.payrollMonth,
    ytdPtPaid: input.ytdPtPaid,
    slabs: input.ptSlabs,
  }).monthlyPT;
  const projectedAnnualPT =
    input.ytdPtPaid + ptThisMonth * remainingMonths;

  // --- Step 6: net taxable income ---
  const netTaxableIncome = Math.max(
    0,
    taxableAfterStdDed - chapterVIATotal - projectedAnnualPT
  );

  // --- Step 7: income tax (regime-specific) ---
  let taxBeforeRebate: number;
  let rebateApplied: number;
  let taxAfterRebate: number;
  let marginalReliefNew = 0;

  if (input.regime === "NEW") {
    const r = computeNewRegimeTax(netTaxableIncome);
    taxBeforeRebate = r.taxBeforeRebate;
    rebateApplied = r.rebate.rebateApplied;
    taxAfterRebate = r.marginalRelief.taxAfterRelief;
    marginalReliefNew = r.marginalRelief.reliefAmount;
  } else {
    const r = computeOldRegimeTax(netTaxableIncome, input.age);
    taxBeforeRebate = r.taxBeforeRebate;
    rebateApplied = r.rebate.rebateApplied;
    taxAfterRebate = r.rebate.taxAfterRebate;
  }

  // --- Step 8: surcharge (with marginal relief at slab boundaries) ---
  // Helper that computes "tax at threshold" using the same regime path.
  const taxAtThresholdComputer = (threshold: number): number => {
    if (input.regime === "NEW") {
      const t = computeNewRegimeTaxBeforeRebate(threshold);
      const r = applyRebate87ANew(t, threshold);
      const m = applyMarginalReliefNew(r.taxAfterRebate, threshold);
      return m.taxAfterRelief;
    }
    const t = computeOldRegimeTaxBeforeRebate(threshold, input.age);
    const r = applyRebate87AOld(t, threshold);
    return r.taxAfterRebate;
  };
  const sc = computeSurcharge(
    taxAfterRebate,
    netTaxableIncome,
    input.regime,
    taxAtThresholdComputer
  );

  // --- Step 9: cess (4% on tax + effective surcharge) ---
  const cess = computeCess(taxAfterRebate + sc.effectiveSurcharge);
  const annualTaxLiability = Math.round(
    taxAfterRebate + sc.effectiveSurcharge + cess
  );

  // --- Step 10: monthly TDS (round to rupee) ---
  const balance = annualTaxLiability - input.ytdTdsDeducted;
  const overDeducted = balance < 0;
  // Spec §13.2: in the F&F / final month, deduct the FULL remaining
  // liability now — there are no remaining months to spread across.
  const monthlyTDS = overDeducted
    ? 0
    : input.isFinalMonth
      ? Math.round(balance)
      : Math.round(balance / Math.max(remainingMonths, 1));

  return {
    fyMonthsElapsed,
    remainingMonths,
    projectedAnnualGross: Math.round(projectedAnnualGross),
    hraExempt,
    ltaExempt,
    childrenExempt,
    totalExemptions: Math.round(totalExemptions),
    taxableSalary: Math.round(taxableSalary),
    standardDeduction,
    taxableAfterStdDed: Math.round(taxableAfterStdDed),
    chapterVIATotal: Math.round(chapterVIATotal),
    projectedAnnualPT: Math.round(projectedAnnualPT),
    netTaxableIncome: Math.round(netTaxableIncome),
    taxBeforeRebate: Math.round(taxBeforeRebate),
    rebateApplied: Math.round(rebateApplied),
    taxAfterRebate: Math.round(taxAfterRebate),
    marginalReliefNew: Math.round(marginalReliefNew),
    surchargeRate: sc.rate,
    surcharge: sc.surcharge,
    surchargeMarginalRelief: sc.marginalReliefApplied,
    cess,
    annualTaxLiability,
    monthlyTDS,
    overDeducted,
  };
}
