/**
 * Provident Fund — Section 192 statutory.
 * Spec §13.5:
 *
 *   pf_basis = basic + DA
 *
 *   IF pf_basis <= 15000:
 *       employee_pf  = 12% × pf_basis
 *       employer_epf = 3.67% × pf_basis  (goes to EPF)
 *       employer_eps = 8.33% × pf_basis  (goes to EPS — pension; capped at ₹15k basis)
 *   ELSE:
 *       IF employee.pf_option = CEILING:
 *           employee_pf = 12% × 15000 = 1800
 *       ELSE (ACTUAL):
 *           employee_pf = 12% × pf_basis
 *       employer_epf = 3.67% × 15000
 *       employer_eps = 8.33% × 15000  (= ₹1,250)
 *       employer_edli = 0.5% × 15000   (EDLI always on ₹15k ceiling)
 */

import type { PFOption } from "./types";

export const PF_BASIS_CEILING = 15000;

export interface PFInput {
  basicMonthly: number;
  daMonthly: number;
  pfOption: PFOption;
}

export interface PFResult {
  pfBasis: number;
  employeePF: number;
  employerEPF: number;
  employerEPS: number;
  employerEDLI: number;
}

export function computePF(input: PFInput): PFResult {
  const pfBasis = input.basicMonthly + input.daMonthly;

  if (pfBasis <= PF_BASIS_CEILING) {
    const employeePF = 0.12 * pfBasis;
    const employerEPS = 0.0833 * pfBasis;
    const employerEPF = 0.0367 * pfBasis;
    return {
      pfBasis: Math.round(pfBasis),
      employeePF: Math.round(employeePF),
      employerEPF: Math.round(employerEPF),
      employerEPS: Math.round(employerEPS),
      employerEDLI: Math.round(0.005 * pfBasis),
    };
  }

  const employeePF =
    input.pfOption === "CEILING" ? 0.12 * PF_BASIS_CEILING : 0.12 * pfBasis;
  return {
    pfBasis: Math.round(pfBasis),
    employeePF: Math.round(employeePF),
    employerEPF: Math.round(0.0367 * PF_BASIS_CEILING),
    employerEPS: Math.round(0.0833 * PF_BASIS_CEILING),
    employerEDLI: Math.round(0.005 * PF_BASIS_CEILING),
  };
}
