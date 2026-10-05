/**
 * Salary structure resolver — converts a TeamforceSalaryStructure (with
 * percentage / flat components) into actual rupee amounts for ONE month,
 * given the employee's monthly CTC anchor.
 *
 * Resolution order (handles forward dependencies between calc types):
 *   1. flat              → uses `value` directly
 *   2. percentCTC        → `value` % of monthlyCtc
 *   3. compute basic + DA from results so far
 *   4. percentBasic      → `value` % of basic
 *   5. percentBasicPlusDA → `value` % of (basic + DA)
 *   6. compute gross from earnings so far
 *   7. percentGross      → `value` % of gross  (typically only for ESI)
 *
 * Pure function, no DB.
 */

export type CalcType =
  | "flat"
  | "percentBasic"
  | "percentBasicPlusDA"
  | "percentCTC"
  | "percentGross";

export type ComponentCode = string; // mirrors model enum; not narrowed here so the resolver stays decoupled

export type TaxabilityType =
  | "FULLY_TAXABLE"
  | "EXEMPT_FORMULA"
  | "EXEMPT_FIXED"
  | "EXEMPT_FULL"
  | "DEDUCTION_STATUTORY"
  | "DEDUCTION_VOLUNTARY"
  | "REIMBURSEMENT";

export interface RawComponent {
  componentCode: ComponentCode;
  componentName: string;
  taxabilityType: TaxabilityType;
  calculationType: CalcType;
  value: number;
}

export interface RawStructure {
  earnings: RawComponent[];
  deductions: RawComponent[];
}

export interface ResolvedComponent extends RawComponent {
  amount: number; // monthly rupees
}

export interface ResolvedStructure {
  earnings: ResolvedComponent[];
  deductions: ResolvedComponent[];
  // Derived monthly anchors (used by the tax engine)
  basicMonthly: number;
  daMonthly: number;
  hraMonthly: number;
  ltaMonthly: number;
  educationAllowanceMonthly: number;
  hostelAllowanceMonthly: number;
  employerNpsMonthly: number;
  pfEmployeeMonthly: number;
  ptMonthlyFromStructure: number; // engine usually overrides via state slabs
  grossMonthly: number;
  totalDeductionsMonthly: number; // statutory + voluntary
  netMonthly: number;
  warnings: string[];
}

function sumByCode(
  resolved: ResolvedComponent[],
  codes: string[]
): number {
  return resolved
    .filter((c) => codes.includes(c.componentCode))
    .reduce((sum, c) => sum + c.amount, 0);
}

function resolveSide(
  components: RawComponent[],
  monthlyCtc: number,
  basicSoFar: number,
  daSoFar: number,
  grossSoFar: number,
  warnings: string[]
): ResolvedComponent[] {
  return components.map((c) => {
    let amount = 0;
    switch (c.calculationType) {
      case "flat":
        amount = Math.max(0, c.value);
        break;
      case "percentCTC":
        if (monthlyCtc <= 0) {
          warnings.push(
            `${c.componentName}: % of CTC needs monthlyCtc > 0; treated as 0`
          );
        }
        amount = (c.value / 100) * monthlyCtc;
        break;
      case "percentBasic":
        amount = (c.value / 100) * basicSoFar;
        break;
      case "percentBasicPlusDA":
        amount = (c.value / 100) * (basicSoFar + daSoFar);
        break;
      case "percentGross":
        amount = (c.value / 100) * grossSoFar;
        break;
    }
    return { ...c, amount: Math.round(amount) };
  });
}

export interface ResolveInput {
  structure: RawStructure;
  monthlyCtc: number;
}

export function resolveStructure(input: ResolveInput): ResolvedStructure {
  const warnings: string[] = [];
  const { structure, monthlyCtc } = input;

  // Pass A: resolve everything that doesn't depend on basic/DA/gross.
  // For other items, push placeholder amounts (0) and patch in later passes.
  const earningsPassA: ResolvedComponent[] = structure.earnings.map((c) => {
    if (c.calculationType === "flat" || c.calculationType === "percentCTC") {
      return resolveSide([c], monthlyCtc, 0, 0, 0, warnings)[0];
    }
    return { ...c, amount: 0 };
  });

  // Compute basic + DA from earnings so far.
  const basic = sumByCode(earningsPassA, ["BASIC"]);
  const da = sumByCode(earningsPassA, ["DA"]);

  // Pass B: percentBasic + percentBasicPlusDA on earnings.
  const earningsPassB = structure.earnings.map((c, i) => {
    if (
      c.calculationType === "percentBasic" ||
      c.calculationType === "percentBasicPlusDA"
    ) {
      return resolveSide([c], monthlyCtc, basic, da, 0, warnings)[0];
    }
    return earningsPassA[i];
  });

  // Compute provisional gross (earnings minus REIMBURSEMENT, which doesn't form gross).
  const provisionalGross = earningsPassB
    .filter((c) => c.taxabilityType !== "REIMBURSEMENT")
    .reduce((s, c) => s + c.amount, 0);

  // Pass C: percentGross items (rare on earnings side, but supported).
  const earningsResolved = structure.earnings.map((c, i) => {
    if (c.calculationType === "percentGross") {
      return resolveSide([c], monthlyCtc, basic, da, provisionalGross, warnings)[0];
    }
    return earningsPassB[i];
  });

  // Final gross excludes REIMBURSEMENT components.
  const grossMonthly = earningsResolved
    .filter((c) => c.taxabilityType !== "REIMBURSEMENT")
    .reduce((s, c) => s + c.amount, 0);

  // Deductions: same staged resolution (mostly flat / percentBasicPlusDA / percentGross).
  const deductionsResolved = structure.deductions.map((c) => {
    return resolveSide([c], monthlyCtc, basic, da, grossMonthly, warnings)[0];
  });

  const totalDeductionsMonthly = deductionsResolved.reduce(
    (s, c) => s + c.amount,
    0
  );

  const netMonthly = grossMonthly - totalDeductionsMonthly;

  // Convenience anchors for the section-192 caller.
  const hra = sumByCode(earningsResolved, ["HRA"]);
  const lta = sumByCode(earningsResolved, ["LTA"]);
  const childrenEdu = sumByCode(earningsResolved, ["CHILDREN_EDU"]);
  const childrenHostel = sumByCode(earningsResolved, ["CHILDREN_HOSTEL"]);
  const employerNps = sumByCode(earningsResolved, ["NPS_EMPLOYER"]);
  const pfEmployee = sumByCode(deductionsResolved, ["PF_EMPLOYEE"]);
  const ptStructure = sumByCode(deductionsResolved, ["PT"]);

  return {
    earnings: earningsResolved,
    deductions: deductionsResolved,
    basicMonthly: basic,
    daMonthly: da,
    hraMonthly: hra,
    ltaMonthly: lta,
    educationAllowanceMonthly: childrenEdu,
    hostelAllowanceMonthly: childrenHostel,
    employerNpsMonthly: employerNps,
    pfEmployeeMonthly: pfEmployee,
    ptMonthlyFromStructure: ptStructure,
    grossMonthly,
    totalDeductionsMonthly,
    netMonthly,
    warnings,
  };
}

/** Apply attendance proration to every monthly amount. Reimbursements are
 *  paid full or zero based on claim — the run pipeline decides those. */
export function prorateResolved(
  resolved: ResolvedStructure,
  attendanceFactor: number
): ResolvedStructure {
  const factor = Math.max(0, attendanceFactor);
  const proRate = (n: number): number => Math.round(n * factor);
  const proRated = (rows: ResolvedComponent[]): ResolvedComponent[] =>
    rows.map((c) =>
      c.taxabilityType === "REIMBURSEMENT"
        ? c
        : { ...c, amount: proRate(c.amount) }
    );

  const earnings = proRated(resolved.earnings);
  const deductions = proRated(resolved.deductions);
  const grossMonthly = earnings
    .filter((c) => c.taxabilityType !== "REIMBURSEMENT")
    .reduce((s, c) => s + c.amount, 0);
  const totalDeductionsMonthly = deductions.reduce((s, c) => s + c.amount, 0);

  return {
    ...resolved,
    earnings,
    deductions,
    basicMonthly: proRate(resolved.basicMonthly),
    daMonthly: proRate(resolved.daMonthly),
    hraMonthly: proRate(resolved.hraMonthly),
    ltaMonthly: proRate(resolved.ltaMonthly),
    educationAllowanceMonthly: proRate(resolved.educationAllowanceMonthly),
    hostelAllowanceMonthly: proRate(resolved.hostelAllowanceMonthly),
    employerNpsMonthly: proRate(resolved.employerNpsMonthly),
    pfEmployeeMonthly: proRate(resolved.pfEmployeeMonthly),
    ptMonthlyFromStructure: proRate(resolved.ptMonthlyFromStructure),
    grossMonthly,
    totalDeductionsMonthly,
    netMonthly: grossMonthly - totalDeductionsMonthly,
  };
}
