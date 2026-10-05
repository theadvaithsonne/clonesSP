/**
 * LTA exemption — Section 10(5). Old Regime only.
 * Per spec §4.2:
 *   exempt_per_journey = MIN(actual_fare_claimed, LTA_component_annual / 2)
 *
 * Block check (2022–25 current block, 2 journeys allowed) is the caller's
 * concern — this function trusts the caller to pass the in-block claim amount.
 * The function caps a single journey claim at half the annual LTA component.
 */

export interface LTAExemptionInput {
  ltaAnnualComponent: number;
  ltaClaimAmount: number; // actual fare claimed for the FY
}

export interface LTAExemptionResult {
  exempt: number;
  taxable: number;
}

export function computeLTAExemption(
  input: LTAExemptionInput
): LTAExemptionResult {
  const cap = input.ltaAnnualComponent / 2;
  const exempt = Math.max(
    0,
    Math.min(input.ltaClaimAmount, cap, input.ltaAnnualComponent)
  );
  return {
    exempt: Math.round(exempt),
    taxable: Math.max(0, Math.round(input.ltaAnnualComponent - exempt)),
  };
}
