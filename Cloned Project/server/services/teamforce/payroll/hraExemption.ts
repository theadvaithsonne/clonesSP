/**
 * HRA exemption — Section 10(13A). Old Regime only.
 * Per spec §4.1: take MIN of three conditions.
 *
 *   c1 = actual HRA received (annual)
 *   c2 = actual rent paid (annual) − 10% × basic (annual)
 *   c3 = 50% × basic (annual) for METRO,  40% × basic (annual) otherwise
 *
 * Guards:
 *   - exempt = 0 if employee owns a house in the same city
 *   - exempt = 0 if no rent declaration submitted
 *   - exempt = 0 if monthly rent > 8333 (annual > 1L) AND landlord PAN not provided
 *   - exempt = 0 if c2 is negative (rent < 10% of basic)
 */

import type { CityType } from "./types";

export interface HRAExemptionInput {
  hraAnnualReceived: number;
  basicAnnual: number;
  monthlyRentPaid: number;
  cityType: CityType;
  ownsHouseInCity: boolean;
  rentDeclarationProvided: boolean;
  landlordPanProvided: boolean;
}

export interface HRAExemptionResult {
  exempt: number;
  taxable: number;
  c1: number;
  c2: number;
  c3: number;
  reason:
    | "computed"
    | "no_declaration"
    | "owns_house"
    | "missing_landlord_pan"
    | "rent_below_10pct";
}

const PAN_REQUIRED_MONTHLY_RENT = 8333; // ₹1L / 12 ≈ 8333

export function computeHRAExemption(
  input: HRAExemptionInput
): HRAExemptionResult {
  const annualRent = (input.monthlyRentPaid || 0) * 12;
  const c1 = Math.max(0, input.hraAnnualReceived);
  const c2 = annualRent - 0.1 * input.basicAnnual;
  const c3 =
    input.cityType === "METRO" ? 0.5 * input.basicAnnual : 0.4 * input.basicAnnual;

  const buildResult = (
    exempt: number,
    reason: HRAExemptionResult["reason"]
  ): HRAExemptionResult => ({
    exempt: Math.max(0, Math.round(exempt)),
    taxable: Math.max(0, Math.round(input.hraAnnualReceived - exempt)),
    c1,
    c2,
    c3,
    reason,
  });

  if (!input.rentDeclarationProvided) return buildResult(0, "no_declaration");
  if (input.ownsHouseInCity) return buildResult(0, "owns_house");
  if (
    input.monthlyRentPaid > PAN_REQUIRED_MONTHLY_RENT &&
    !input.landlordPanProvided
  ) {
    return buildResult(0, "missing_landlord_pan");
  }
  if (c2 < 0) return buildResult(0, "rent_below_10pct");

  const exempt = Math.min(c1, c2, c3);
  return buildResult(exempt, "computed");
}
