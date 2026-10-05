/**
 * Chapter VI-A deductions aggregator — Old Regime (mostly).
 * Spec §6.
 *
 * Sec 80CCD(2) — employer NPS contribution — is the ONE Chapter VI-A item
 * available in BOTH regimes. The caller decides which sections to pass in
 * based on the employee's selected regime.
 */

export interface ChapterVIAInput {
  // 80C basket (₹1.5L cap, includes EPF auto)
  declared80C: number;
  pfEmployeeAnnual: number;

  // 80CCD(1B) — NPS self contribution (₹50k extra)
  declaredNpsSelf: number;

  // 80CCD(2) — Employer NPS — both regimes
  basicAnnual: number;
  daAnnual: number;
  employerNpsAnnual: number;
  /** True for central-government employees (limit 14% × Basic+DA);
   *  false for private sector (10%). */
  isCentralGovt?: boolean;

  // 80D — medical insurance
  declared80DSelf: number;
  selfAge: number;
  declared80DParent: number;
  parentSeniorCitizen: boolean;

  // 80TTA / 80TTB — savings interest (age-tiered)
  savingsInterest: number;
  fdInterest?: number; // only relevant for 80TTB (age >= 60)

  // 80E, 80EEA, 80G (treated as already-validated by caller)
  declared80E: number;
  declared80EEA: number;
  declared80G: number;
}

export interface ChapterVIAResult {
  sec80C: number;
  sec80CCD1B: number;
  sec80CCD2: number;
  sec80D: number;
  sec80TTAorTTB: number;
  sec80E: number;
  sec80EEA: number;
  sec80G: number;
  total: number;
  /** Subset available in BOTH regimes — useful for the New-Regime pipeline. */
  availableInNewRegime: number;
}

const CAP_80C = 150000;
const CAP_80CCD_1B = 50000;
const CAP_80EEA = 150000;
const CAP_80TTA = 10000;
const CAP_80TTB = 50000;

function compute80D(
  selfPremium: number,
  selfAge: number,
  parentPremium: number,
  parentSenior: boolean
): number {
  const selfLimit = selfAge < 60 ? 25000 : 50000;
  const parentLimit = parentSenior ? 50000 : 25000;
  const selfClaim = Math.max(0, Math.min(selfPremium, selfLimit));
  const parentClaim = Math.max(0, Math.min(parentPremium, parentLimit));
  return selfClaim + parentClaim;
}

export function computeChapterVIA(input: ChapterVIAInput): ChapterVIAResult {
  const sec80C = Math.min(
    Math.max(0, input.declared80C) + Math.max(0, input.pfEmployeeAnnual),
    CAP_80C
  );

  const sec80CCD1B = Math.min(Math.max(0, input.declaredNpsSelf), CAP_80CCD_1B);

  const employerNpsRate = input.isCentralGovt ? 0.14 : 0.1;
  const employerNpsCap =
    employerNpsRate * (input.basicAnnual + input.daAnnual);
  const sec80CCD2 = Math.min(
    Math.max(0, input.employerNpsAnnual),
    employerNpsCap
  );

  const sec80D = compute80D(
    input.declared80DSelf,
    input.selfAge,
    input.declared80DParent,
    input.parentSeniorCitizen
  );

  let sec80TTAorTTB: number;
  if (input.selfAge >= 60) {
    sec80TTAorTTB = Math.min(
      Math.max(0, input.savingsInterest) + Math.max(0, input.fdInterest || 0),
      CAP_80TTB
    );
  } else {
    sec80TTAorTTB = Math.min(Math.max(0, input.savingsInterest), CAP_80TTA);
  }

  const sec80E = Math.max(0, input.declared80E);
  const sec80EEA = Math.min(Math.max(0, input.declared80EEA), CAP_80EEA);
  const sec80G = Math.max(0, input.declared80G);

  const total =
    sec80C +
    sec80CCD1B +
    sec80CCD2 +
    sec80D +
    sec80TTAorTTB +
    sec80E +
    sec80EEA +
    sec80G;

  return {
    sec80C: Math.round(sec80C),
    sec80CCD1B: Math.round(sec80CCD1B),
    sec80CCD2: Math.round(sec80CCD2),
    sec80D: Math.round(sec80D),
    sec80TTAorTTB: Math.round(sec80TTAorTTB),
    sec80E: Math.round(sec80E),
    sec80EEA: Math.round(sec80EEA),
    sec80G: Math.round(sec80G),
    total: Math.round(total),
    // Only 80CCD(2) carries through to New Regime.
    availableInNewRegime: Math.round(sec80CCD2),
  };
}
