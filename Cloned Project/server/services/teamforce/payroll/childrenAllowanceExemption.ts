/**
 * Children Education & Hostel Allowance exemption — Section 10(14).
 * Old Regime only.
 *
 * Spec §4.3:
 *   education_allowance_exempt = MIN(actual_paid, 100 × num_eligible × 12)
 *   hostel_allowance_exempt    = MIN(actual_paid, 300 × num_eligible × 12)
 *   num_eligible               = MIN(num_children, 2)
 */

export interface ChildrenAllowanceInput {
  educationAnnual: number;
  hostelAnnual: number;
  numChildren: number;
}

export interface ChildrenAllowanceResult {
  educationExempt: number;
  hostelExempt: number;
  totalExempt: number;
}

const EDU_PER_CHILD_PER_MONTH = 100;
const HOSTEL_PER_CHILD_PER_MONTH = 300;

export function computeChildrenAllowanceExemption(
  input: ChildrenAllowanceInput
): ChildrenAllowanceResult {
  const eligible = Math.min(Math.max(input.numChildren, 0), 2);
  const educationCap = EDU_PER_CHILD_PER_MONTH * eligible * 12;
  const hostelCap = HOSTEL_PER_CHILD_PER_MONTH * eligible * 12;

  const educationExempt = Math.max(0, Math.min(input.educationAnnual, educationCap));
  const hostelExempt = Math.max(0, Math.min(input.hostelAnnual, hostelCap));

  return {
    educationExempt: Math.round(educationExempt),
    hostelExempt: Math.round(hostelExempt),
    totalExempt: Math.round(educationExempt + hostelExempt),
  };
}
