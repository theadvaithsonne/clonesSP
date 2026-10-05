/**
 * Smoke tests for the Teamforce payroll engine. No DB / network — pure
 * function checks against the worked examples in the spec.
 *
 * Run after `npm run build`:
 *   node dist/scripts/test-payroll-engine.js
 */

import {
  computeHRAExemption,
  computeLTAExemption,
  computeChildrenAllowanceExemption,
  computeProfessionalTax,
  computePF,
  computeESI,
  computeOldRegimeTax,
  computeNewRegimeTax,
  computeOldRegimeTaxBeforeRebate,
  computeNewRegimeTaxBeforeRebate,
  computeChapterVIA,
  computeSection192TDS,
  getAttendanceWindow,
  aggregateForEmployee,
  resolveStructure,
  prorateResolved,
  determineEsiCoverage,
  type PTSlab,
  type ApprovedLeaveRow,
  type RawStructure,
} from "../services/teamforce/payroll";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assertEq(label: string, actual: unknown, expected: unknown) {
  const ok =
    typeof actual === "number" && typeof expected === "number"
      ? Math.abs((actual as number) - (expected as number)) < 1
      : actual === expected;
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}: ${actual}`);
  } else {
    failed++;
    failures.push(`${label}: expected ${expected}, got ${actual}`);
    console.log(`  FAIL  ${label}: expected ${expected}, got ${actual}`);
  }
}

function section(name: string) {
  console.log(`\n── ${name} ─────────────────────────`);
}

// =====================================================================
section("HRA exemption — Mumbai metro, ₹25k rent");
{
  // Per spec: monthly rent 25k → annual 3L; basic 50k/m → 6L annual; HRA 25k/m → 3L annual
  // c1 = 3,00,000
  // c2 = 3,00,000 - 60,000 = 2,40,000
  // c3 = 50% × 6,00,000 = 3,00,000  (METRO)
  // exempt = MIN = 2,40,000
  const r = computeHRAExemption({
    hraAnnualReceived: 300000,
    basicAnnual: 600000,
    monthlyRentPaid: 25000,
    cityType: "METRO",
    ownsHouseInCity: false,
    rentDeclarationProvided: true,
    landlordPanProvided: true, // > ₹8333/month → required
  });
  assertEq("HRA exempt (Mumbai 25k rent)", r.exempt, 240000);
  assertEq("HRA taxable", r.taxable, 60000);
}

section("HRA exemption — guards");
{
  const noPan = computeHRAExemption({
    hraAnnualReceived: 300000,
    basicAnnual: 600000,
    monthlyRentPaid: 25000,
    cityType: "METRO",
    ownsHouseInCity: false,
    rentDeclarationProvided: true,
    landlordPanProvided: false, // > ₹8333/month w/o PAN → exempt = 0
  });
  assertEq("HRA exempt no PAN", noPan.exempt, 0);

  const ownsHouse = computeHRAExemption({
    hraAnnualReceived: 300000,
    basicAnnual: 600000,
    monthlyRentPaid: 25000,
    cityType: "METRO",
    ownsHouseInCity: true,
    rentDeclarationProvided: true,
    landlordPanProvided: true,
  });
  assertEq("HRA exempt owns house", ownsHouse.exempt, 0);

  const noDecl = computeHRAExemption({
    hraAnnualReceived: 300000,
    basicAnnual: 600000,
    monthlyRentPaid: 25000,
    cityType: "METRO",
    ownsHouseInCity: false,
    rentDeclarationProvided: false,
    landlordPanProvided: true,
  });
  assertEq("HRA exempt no declaration", noDecl.exempt, 0);
}

// =====================================================================
section("LTA exemption — capped at half annual");
{
  const r = computeLTAExemption({ ltaAnnualComponent: 60000, ltaClaimAmount: 50000 });
  // cap = 30000; claim 50000 > cap → exempt = 30000
  assertEq("LTA exempt", r.exempt, 30000);
  assertEq("LTA taxable", r.taxable, 30000);
}

// =====================================================================
section("Children Education + Hostel allowance");
{
  const r = computeChildrenAllowanceExemption({
    educationAnnual: 5000, // 5k actual paid
    hostelAnnual: 10000,
    numChildren: 3, // capped to 2
  });
  // Edu cap: 100 × 2 × 12 = 2400; min(5000, 2400) = 2400
  // Hostel cap: 300 × 2 × 12 = 7200; min(10000, 7200) = 7200
  assertEq("Children edu exempt", r.educationExempt, 2400);
  assertEq("Children hostel exempt", r.hostelExempt, 7200);
  assertEq("Children total", r.totalExempt, 9600);
}

// =====================================================================
section("Professional Tax — Maharashtra Feb override");
{
  const slabs: PTSlab[] = [
    { state: "Maharashtra", grossFrom: 0, grossTo: 7500, monthlyPT: 0, monthOverride: null },
    { state: "Maharashtra", grossFrom: 7501, grossTo: 10000, monthlyPT: 175, monthOverride: null },
    { state: "Maharashtra", grossFrom: 10001, grossTo: null, monthlyPT: 200, monthOverride: null },
    { state: "Maharashtra", grossFrom: 10001, grossTo: null, monthlyPT: 300, monthOverride: 2 },
  ];
  // April, gross 50000 → ₹200 (all-months row)
  const apr = computeProfessionalTax({
    state: "Maharashtra",
    monthlyGross: 50000,
    payrollMonth: 4,
    ytdPtPaid: 0,
    slabs,
  });
  assertEq("PT MH April 50k", apr.monthlyPT, 200);

  // Feb, gross 50000 → ₹300 (override wins)
  const feb = computeProfessionalTax({
    state: "Maharashtra",
    monthlyGross: 50000,
    payrollMonth: 2,
    ytdPtPaid: 0,
    slabs,
  });
  assertEq("PT MH Feb 50k", feb.monthlyPT, 300);

  // Annual cap ₹2500 reached → ₹0
  const capped = computeProfessionalTax({
    state: "Maharashtra",
    monthlyGross: 50000,
    payrollMonth: 4,
    ytdPtPaid: 2500,
    slabs,
  });
  assertEq("PT capped at annual", capped.monthlyPT, 0);

  // Gross below first slab → ₹0
  const low = computeProfessionalTax({
    state: "Maharashtra",
    monthlyGross: 5000,
    payrollMonth: 4,
    ytdPtPaid: 0,
    slabs,
  });
  assertEq("PT low gross", low.monthlyPT, 0);
}

// =====================================================================
section("PT — Karnataka simple slabs");
{
  const slabs: PTSlab[] = [
    { state: "Karnataka", grossFrom: 0, grossTo: 14999, monthlyPT: 0, monthOverride: null },
    { state: "Karnataka", grossFrom: 15000, grossTo: null, monthlyPT: 200, monthOverride: null },
  ];
  const r = computeProfessionalTax({
    state: "Karnataka",
    monthlyGross: 50000,
    payrollMonth: 6,
    ytdPtPaid: 0,
    slabs,
  });
  assertEq("PT KA 50k", r.monthlyPT, 200);
}

// =====================================================================
section("PF — under ceiling");
{
  // basis 12000 → all under 15k cap
  const r = computePF({ basicMonthly: 8000, daMonthly: 4000, pfOption: "CEILING" });
  assertEq("PF employee (basis 12k)", r.employeePF, Math.round(0.12 * 12000)); // 1440
  assertEq("PF employer EPS", r.employerEPS, Math.round(0.0833 * 12000));
}

section("PF — above ceiling, CEILING option");
{
  // basis 50k, CEILING → employee = 1800
  const r = computePF({ basicMonthly: 40000, daMonthly: 10000, pfOption: "CEILING" });
  assertEq("PF employee (CEILING, 50k basis)", r.employeePF, 1800);
  assertEq("PF employer EPS (capped)", r.employerEPS, Math.round(0.0833 * 15000));
}

section("PF — above ceiling, ACTUAL option");
{
  const r = computePF({ basicMonthly: 40000, daMonthly: 10000, pfOption: "ACTUAL" });
  assertEq("PF employee (ACTUAL, 50k basis)", r.employeePF, Math.round(0.12 * 50000));
}

// =====================================================================
section("ESI");
{
  const covered = computeESI({ monthlyGross: 18000, coveredAtPeriodStart: true });
  assertEq("ESI employee covered", covered.employeeESI, Math.round(18000 * 0.0075));
  assertEq("ESI employer covered", covered.employerESI, Math.round(18000 * 0.0325));

  const notCovered = computeESI({ monthlyGross: 18000, coveredAtPeriodStart: false });
  assertEq("ESI not covered", notCovered.employeeESI, 0);
}

// =====================================================================
section("Old Regime tax — under 60, ₹10L net taxable");
{
  // 250000 @ 0% = 0
  // 250000 @ 5% = 12500
  // 500000 @ 20% = 100000
  // total = 112500
  const r = computeOldRegimeTax(1000000, 35);
  assertEq("Old tax 10L (age 35) before rebate", r.taxBeforeRebate, 112500);
  assertEq("Old rebate not eligible", r.rebate.rebateApplied, 0);
  assertEq("Old tax after rebate", r.rebate.taxAfterRebate, 112500);
}

section("Old Regime — 87A rebate at ₹5L");
{
  // At exactly 5L: tax = 12500 → rebate caps it to 0
  const r = computeOldRegimeTax(500000, 35);
  assertEq("Old tax 5L before rebate", r.taxBeforeRebate, 12500);
  assertEq("Old rebate applied", r.rebate.rebateApplied, 12500);
  assertEq("Old tax after rebate at 5L", r.rebate.taxAfterRebate, 0);
}

section("Old Regime — senior citizen ₹4L");
{
  // 60-79: nil up to 3L; 5% on 100000 = 5000; rebate of 5000 → 0
  const r = computeOldRegimeTax(400000, 65);
  assertEq("Old tax senior 4L before rebate", r.taxBeforeRebate, 5000);
  assertEq("Old tax after rebate", r.rebate.taxAfterRebate, 0);
}

// =====================================================================
section("New Regime tax — ₹10L net taxable");
{
  // 0-3L: 0
  // 3-7L: 5% × 4L = 20000
  // 7-10L: 10% × 3L = 30000
  // total = 50000
  const r = computeNewRegimeTax(1000000);
  assertEq("New tax 10L before rebate", r.taxBeforeRebate, 50000);
  assertEq("New rebate not eligible", r.rebate.rebateApplied, 0);
  assertEq("New tax after rebate", r.rebate.taxAfterRebate, 50000);
}

section("New Regime — 87A rebate at ₹7L");
{
  // 3-7L: 5% × 4L = 20000; rebate of 20000 → 0
  const r = computeNewRegimeTax(700000);
  assertEq("New tax 7L before rebate", r.taxBeforeRebate, 20000);
  assertEq("New rebate applied", r.rebate.rebateApplied, 20000);
  assertEq("New tax after rebate at 7L", r.rebate.taxAfterRebate, 0);
}

section("New Regime — marginal relief just above ₹7L");
{
  // At 7,10,000: tax before rebate = 20000 + 5% × 10000 = 20500
  //   (10k from 7L→7.1L falls in the next slab which is also 5% under
  //    7-10L band; actually tax = 20000 + 5% × 10000 = 20500)
  // Wait — 7L exactly = 20000 (5% slab). Above 7L is 10% slab.
  // 7,10,000 → 20000 + 10% × 10000 = 21000
  // Rebate not eligible (>7L). Tax = 21000.
  // Marginal relief: income above 7L = 10000; tax > income above → relief = 21000 − 10000 = 11000
  // Tax after relief = 10000.
  const r = computeNewRegimeTax(710000);
  assertEq("New tax 7.1L before rebate", r.taxBeforeRebate, 21000);
  assertEq("New marginal relief", r.marginalRelief.reliefAmount, 11000);
  assertEq("New tax after marginal relief", r.marginalRelief.taxAfterRelief, 10000);
}

// =====================================================================
section("Chapter VI-A — old regime full stack");
{
  const r = computeChapterVIA({
    declared80C: 100000,
    pfEmployeeAnnual: 60000, // total 80C input = 160000 → capped at 150000
    declaredNpsSelf: 60000, // capped at 50000
    basicAnnual: 480000,
    daAnnual: 0,
    employerNpsAnnual: 60000, // limit = 10% × 480000 = 48000 → capped
    declared80DSelf: 30000, // age <60 limit 25000 → 25000
    selfAge: 35,
    declared80DParent: 60000, // parent senior → limit 50000
    parentSeniorCitizen: true,
    savingsInterest: 15000, // age <60 → cap 10000
    declared80E: 25000,
    declared80EEA: 100000,
    declared80G: 5000,
  });
  assertEq("80C capped", r.sec80C, 150000);
  assertEq("80CCD(1B) capped", r.sec80CCD1B, 50000);
  assertEq("80CCD(2) capped", r.sec80CCD2, 48000);
  assertEq("80D self+parent", r.sec80D, 25000 + 50000);
  assertEq("80TTA cap", r.sec80TTAorTTB, 10000);
  assertEq("80E uncapped", r.sec80E, 25000);
  assertEq("80EEA cap", r.sec80EEA, 100000);
  assertEq("80G", r.sec80G, 5000);
  assertEq(
    "Chapter VI-A total",
    r.total,
    150000 + 50000 + 48000 + 75000 + 10000 + 25000 + 100000 + 5000
  );
  assertEq("New Regime carries 80CCD(2) only", r.availableInNewRegime, 48000);
}

// =====================================================================
section("Section 192 — New Regime, ₹10L gross, April (1st month)");
{
  const slabs: PTSlab[] = [
    { state: "Karnataka", grossFrom: 0, grossTo: 14999, monthlyPT: 0, monthOverride: null },
    { state: "Karnataka", grossFrom: 15000, grossTo: null, monthlyPT: 200, monthOverride: null },
  ];

  // Gross 10L annual / 12 = 83,333/m; first month so no YTD; project = 1,000,000
  // Std ded New = 75,000; chapter VI-A = 0 (no employer NPS); no exemptions
  // Net taxable = 1,000,000 - 75,000 - PT(200×12=2400) = 922,600
  // Tax: 0-3L=0; 3-7L 5%=20000; 7-922600 → 222600 @ 10% = 22260; total = 42260
  // Rebate not eligible, no surcharge. Cess 4% → 1690
  // Annual = 43950; remaining 12 → ~3663/m
  const r = computeSection192TDS({
    age: 32,
    state: "Karnataka",
    cityType: "NON_METRO",
    regime: "NEW",
    ytdActualGross: 0,
    ytdTdsDeducted: 0,
    ytdPtPaid: 0,
    ytdPfEmployeeAnnual: 0,
    payrollMonth: 4,
    payrollYear: 2024,
    monthlyGross: 1000000 / 12,
    basicAnnual: 400000,
    daAnnual: 0,
    hraAnnual: 0,
    ltaAnnual: 0,
    educationAllowanceAnnual: 0,
    hostelAllowanceAnnual: 0,
    employerNpsAnnual: 0,
    ptSlabs: slabs,
  });
  assertEq("Sec192 New 10L projected gross", r.projectedAnnualGross, 1000000);
  assertEq("Sec192 New 10L net taxable", r.netTaxableIncome, 922600);
  assertEq("Sec192 New 10L tax before rebate", r.taxBeforeRebate, 42260);
  assertEq("Sec192 New 10L cess", r.cess, Math.round(42260 * 0.04));
  assertEq("Sec192 New 10L annual liability", r.annualTaxLiability, 42260 + Math.round(42260 * 0.04));
  // Monthly TDS = 43950/12 = 3663 (rounded)
  assertEq("Sec192 New 10L monthly TDS", r.monthlyTDS, Math.round((42260 + Math.round(42260 * 0.04)) / 12));
}

section("Section 192 — Old Regime, salary spike (bonus mid-year)");
{
  const slabs: PTSlab[] = [
    { state: "Karnataka", grossFrom: 0, grossTo: 14999, monthlyPT: 0, monthOverride: null },
    { state: "Karnataka", grossFrom: 15000, grossTo: null, monthlyPT: 200, monthOverride: null },
  ];
  // Halfway through FY (October = month 7, FY month = 7), 6 months YTD at 80k = 480k
  // Bonus month — current month gross = 200k; remaining 6 months at 200k each
  // projected = 480k + 200k × 6 = 1,680,000
  const r = computeSection192TDS({
    age: 30,
    state: "Karnataka",
    cityType: "NON_METRO",
    regime: "OLD",
    ytdActualGross: 480000,
    ytdTdsDeducted: 5000,
    ytdPtPaid: 1200,
    ytdPfEmployeeAnnual: 0,
    payrollMonth: 10,
    payrollYear: 2024,
    monthlyGross: 200000,
    basicAnnual: 600000,
    daAnnual: 0,
    hraAnnual: 0,
    ltaAnnual: 0,
    educationAllowanceAnnual: 0,
    hostelAllowanceAnnual: 0,
    employerNpsAnnual: 0,
    ptSlabs: slabs,
  });
  assertEq("Sec192 Old bonus projected gross", r.projectedAnnualGross, 1680000);
  // Std deduction 50000; PT projected = 1200 + 200 × 6 = 2400
  // Net taxable = 1,680,000 - 50,000 - 2,400 = 1,627,600
  assertEq("Sec192 Old bonus net taxable", r.netTaxableIncome, 1627600);
  // Old slabs at 1,627,600: 250k×0 + 250k×5%=12500 + 500k×20%=100000 + 627600×30%=188280 → 300780
  assertEq("Sec192 Old bonus tax before rebate", r.taxBeforeRebate, 300780);
}

section("Section 192 — overdeduction → monthly TDS = 0");
{
  const slabs: PTSlab[] = [];
  const r = computeSection192TDS({
    age: 35,
    state: "Karnataka",
    cityType: "NON_METRO",
    regime: "NEW",
    ytdActualGross: 800000,
    ytdTdsDeducted: 200000, // way more than annual will be
    ytdPtPaid: 0,
    ytdPfEmployeeAnnual: 0,
    payrollMonth: 11,
    payrollYear: 2024,
    monthlyGross: 100000,
    basicAnnual: 1200000,
    daAnnual: 0,
    hraAnnual: 0,
    ltaAnnual: 0,
    educationAllowanceAnnual: 0,
    hostelAllowanceAnnual: 0,
    employerNpsAnnual: 0,
    ptSlabs: slabs,
  });
  assertEq("Sec192 overdeducted flag", r.overDeducted, true);
  assertEq("Sec192 overdeducted monthly TDS = 0", r.monthlyTDS, 0);
}

// =====================================================================
section("Sanity — old regime tax-before-rebate at slab boundaries");
{
  assertEq("Old age<60 at 250000", computeOldRegimeTaxBeforeRebate(250000, 30), 0);
  assertEq("Old age<60 at 500000", computeOldRegimeTaxBeforeRebate(500000, 30), 12500);
  assertEq("Old age<60 at 1000000", computeOldRegimeTaxBeforeRebate(1000000, 30), 12500 + 100000);
  assertEq("Old age<60 at 1500000", computeOldRegimeTaxBeforeRebate(1500000, 30), 12500 + 100000 + 150000);
}

section("Sanity — new regime tax-before-rebate at slab boundaries");
{
  assertEq("New at 300000", computeNewRegimeTaxBeforeRebate(300000), 0);
  assertEq("New at 700000", computeNewRegimeTaxBeforeRebate(700000), 20000);
  assertEq("New at 1000000", computeNewRegimeTaxBeforeRebate(1000000), 20000 + 30000);
  assertEq("New at 1500000", computeNewRegimeTaxBeforeRebate(1500000), 20000 + 30000 + 30000 + 60000);
}

// =====================================================================
section("Attendance window — cutoff 18, June 2025");
{
  const w = getAttendanceWindow(6, 2025, 18);
  // Window = May 19 → June 18
  assertEq("Window start year", w.start.getFullYear(), 2025);
  assertEq("Window start month (0-indexed)", w.start.getMonth(), 4); // May
  assertEq("Window start day", w.start.getDate(), 19);
  assertEq("Window end month", w.end.getMonth(), 5); // June
  assertEq("Window end day", w.end.getDate(), 18);
}

section("Attendance window — cutoff 1 (full prior month)");
{
  const w = getAttendanceWindow(6, 2025, 1);
  // Window = May 1 → May 31
  assertEq("cutoff=1 start day", w.start.getDate(), 1);
  assertEq("cutoff=1 start month (0-indexed)", w.start.getMonth(), 4); // May
  assertEq("cutoff=1 end day", w.end.getDate(), 31);
}

section("Attendance window — January wraparound");
{
  // Pay month Jan 2025, cutoff 18 → window Dec 19 2024 → Jan 18 2025
  const w = getAttendanceWindow(1, 2025, 18);
  assertEq("Jan window start year", w.start.getFullYear(), 2024);
  assertEq("Jan window start month (Dec)", w.start.getMonth(), 11);
  assertEq("Jan window start day", w.start.getDate(), 19);
  assertEq("Jan window end year", w.end.getFullYear(), 2025);
  assertEq("Jan window end day", w.end.getDate(), 18);
}

// =====================================================================
section("Attendance aggregate — perfect attendance, May 2025, cutoff 18");
{
  // Window = April 19 → May 18 = 30 days
  // No weekly off, no leaves, present every day → daysPresent = 30, lop = 0
  const presentDates = new Set<string>();
  for (let d = 19; d <= 30; d++) presentDates.add(`2025-04-${String(d).padStart(2, "0")}`);
  for (let d = 1; d <= 18; d++) presentDates.add(`2025-05-${String(d).padStart(2, "0")}`);

  const r = aggregateForEmployee({
    payrollMonth: 5,
    payrollYear: 2025,
    cutoffDay: 18,
    doj: new Date(2024, 0, 1), // long ago
    weeklyOffDays: [],
    approvedLeaves: [],
    presentDates,
    deferredLopFromPrevCycle: 0,
  });
  assertEq("Perfect attendance window days", r.windowCalendarDays, 30);
  assertEq("Perfect attendance days present", r.daysPresentInWindow, 30);
  assertEq("Perfect attendance LOP", r.lopDaysInWindow, 0);
  // Factor = 30 days worked / 31 calendar days in May = 0.9677
  assertEq(
    "Perfect attendance factor",
    Math.round(r.attendanceFactor * 10000),
    Math.round((30 / 31) * 10000)
  );
}

section("Attendance aggregate — 2 LOP days");
{
  const presentDates = new Set<string>();
  for (let d = 19; d <= 30; d++) presentDates.add(`2025-04-${String(d).padStart(2, "0")}`);
  // Skip May 5 and May 10 (LOP)
  for (let d = 1; d <= 18; d++) {
    if (d === 5 || d === 10) continue;
    presentDates.add(`2025-05-${String(d).padStart(2, "0")}`);
  }
  const r = aggregateForEmployee({
    payrollMonth: 5,
    payrollYear: 2025,
    cutoffDay: 18,
    doj: new Date(2024, 0, 1),
    weeklyOffDays: [],
    approvedLeaves: [],
    presentDates,
    deferredLopFromPrevCycle: 0,
  });
  assertEq("2 LOP days", r.lopDaysInWindow, 2);
  assertEq("2 LOP days present count", r.daysPresentInWindow, 28);
}

section("Attendance aggregate — approved leave covers absence");
{
  const presentDates = new Set<string>();
  for (let d = 19; d <= 30; d++) presentDates.add(`2025-04-${String(d).padStart(2, "0")}`);
  for (let d = 1; d <= 18; d++) {
    if (d === 5 || d === 10) continue; // not present these 2 days
    presentDates.add(`2025-05-${String(d).padStart(2, "0")}`);
  }
  // But May 5–10 is on approved leave (paid)
  const approvedLeaves: ApprovedLeaveRow[] = [
    {
      startDate: new Date(2025, 4, 5), // May 5
      endDate: new Date(2025, 4, 10), // May 10
      isHalfDay: false,
    },
  ];
  const r = aggregateForEmployee({
    payrollMonth: 5,
    payrollYear: 2025,
    cutoffDay: 18,
    doj: new Date(2024, 0, 1),
    weeklyOffDays: [],
    approvedLeaves,
    presentDates,
    deferredLopFromPrevCycle: 0,
  });
  // 6 days approved leave (May 5-10), zero of those are LOP
  assertEq("Approved-leave LOP", r.lopDaysInWindow, 0);
  assertEq("Approved-leave count", r.paidLeaveDaysInWindow, 6);
}

section("Attendance aggregate — weekly off Sundays");
{
  // Window April 19 (Sat) → May 18 (Sun) 2025
  // Sundays in window: Apr 20, 27; May 4, 11, 18 = 5 Sundays
  const presentDates = new Set<string>();
  // Present every weekday (skip Sundays)
  for (let d = 19; d <= 30; d++) {
    const day = new Date(2025, 3, d).getDay();
    if (day === 0) continue;
    presentDates.add(`2025-04-${String(d).padStart(2, "0")}`);
  }
  for (let d = 1; d <= 18; d++) {
    const day = new Date(2025, 4, d).getDay();
    if (day === 0) continue;
    presentDates.add(`2025-05-${String(d).padStart(2, "0")}`);
  }
  const r = aggregateForEmployee({
    payrollMonth: 5,
    payrollYear: 2025,
    cutoffDay: 18,
    doj: new Date(2024, 0, 1),
    weeklyOffDays: [0], // Sundays
    approvedLeaves: [],
    presentDates,
    deferredLopFromPrevCycle: 0,
  });
  assertEq("Weekly-off Sundays", r.scheduledOffDaysInWindow, 5);
  assertEq("Weekly-off LOP", r.lopDaysInWindow, 0);
}

section("Attendance aggregate — joining mid-window (May 5)");
{
  // DOJ May 5 2025; pay month May 2025; cutoff 18 → window April 19 → May 18
  // Employee in window from May 5 → May 18 = 14 days
  const presentDates = new Set<string>();
  for (let d = 5; d <= 18; d++) {
    presentDates.add(`2025-05-${String(d).padStart(2, "0")}`);
  }
  const r = aggregateForEmployee({
    payrollMonth: 5,
    payrollYear: 2025,
    cutoffDay: 18,
    doj: new Date(2025, 4, 5), // May 5 — BEFORE cutoff (18) so NO grace window
    weeklyOffDays: [],
    approvedLeaves: [],
    presentDates,
    deferredLopFromPrevCycle: 0,
  });
  assertEq("Mid-window joiner days in window", r.daysEmployeeInWindow, 14);
  assertEq("Mid-window joiner present", r.daysPresentInWindow, 14);
  assertEq("Mid-window joiner not in grace", r.inGraceWindow, false);
}

section("Attendance aggregate — grace window (DOJ April 25, cutoff 18)");
{
  // Spec §3.3 worked example. Pay month April 2025, cutoff 18.
  // Window = March 19 → April 18; DOJ April 25 → after window end → cycle pay = 0
  // Grace tail = April 25 → April 30 = 6 days
  // Employee takes 2 LOP days during grace tail (Apr 27, 28)
  const presentDates = new Set<string>();
  for (let d = 25; d <= 30; d++) {
    if (d === 27 || d === 28) continue;
    presentDates.add(`2025-04-${String(d).padStart(2, "0")}`);
  }
  const r = aggregateForEmployee({
    payrollMonth: 4,
    payrollYear: 2025,
    cutoffDay: 18,
    doj: new Date(2025, 3, 25), // April 25 — AFTER cutoff
    weeklyOffDays: [],
    approvedLeaves: [],
    presentDates,
    deferredLopFromPrevCycle: 0,
  });
  assertEq("Grace cycle pay = 0", r.attendanceFactor, 0);
  assertEq("Grace flag set", r.inGraceWindow, true);
  assertEq("Grace tail days", r.graceTailDays, 6);
  assertEq("Grace tail factor", Math.round(r.graceTailFactor * 10000), Math.round((6 / 30) * 10000));
  assertEq("Grace tail LOP (2 days)", r.graceTailLopDays, 2);
  assertEq("Deferred LOP for next cycle", r.deferredLopForNextCycle, 2);
}

section("Attendance aggregate — May payroll AFTER grace (carries deferred LOP)");
{
  // Per spec example: May payroll after April grace, deferred LOP = 2 days
  // Employee in window April 19 → May 18; effective from April 25 (DOJ)
  // = 24 days; takes 1 LOP in window (May 5)
  const presentDates = new Set<string>();
  for (let d = 25; d <= 30; d++) {
    presentDates.add(`2025-04-${String(d).padStart(2, "0")}`);
  }
  for (let d = 1; d <= 18; d++) {
    if (d === 5) continue;
    presentDates.add(`2025-05-${String(d).padStart(2, "0")}`);
  }
  const r = aggregateForEmployee({
    payrollMonth: 5,
    payrollYear: 2025,
    cutoffDay: 18,
    doj: new Date(2025, 3, 25), // joined April 25
    weeklyOffDays: [],
    approvedLeaves: [],
    presentDates,
    deferredLopFromPrevCycle: 2, // recovered from grace
    });
  assertEq("Days in window (mid-cycle joiner)", r.daysEmployeeInWindow, 24);
  assertEq("LOP in window", r.lopDaysInWindow, 1);
  assertEq("Deferred LOP applied", r.deferredLopApplied, 2);
  assertEq("Total LOP applied", r.lopDaysApplied, 3);
  // numerator = 24 - 1 - 2 = 21 days; denom = 31 (May)
  assertEq("Carry attendance factor", Math.round(r.attendanceFactor * 10000), Math.round((21 / 31) * 10000));
  assertEq("Not joining month any more", r.isJoiningMonth, false);
}

section("Attendance aggregate — half-day leave");
{
  const presentDates = new Set<string>();
  for (let d = 19; d <= 30; d++) presentDates.add(`2025-04-${String(d).padStart(2, "0")}`);
  for (let d = 1; d <= 18; d++) {
    if (d === 7) continue; // not present that day
    presentDates.add(`2025-05-${String(d).padStart(2, "0")}`);
  }
  const approvedLeaves: ApprovedLeaveRow[] = [
    {
      startDate: new Date(2025, 4, 7), // May 7
      endDate: new Date(2025, 4, 7),
      isHalfDay: true,
    },
  ];
  const r = aggregateForEmployee({
    payrollMonth: 5,
    payrollYear: 2025,
    cutoffDay: 18,
    doj: new Date(2024, 0, 1),
    weeklyOffDays: [],
    approvedLeaves,
    presentDates,
    deferredLopFromPrevCycle: 0,
  });
  // Half day leave + not present second half → 0.5 paid + 0.5 LOP
  assertEq("Half-day paid leave", r.paidLeaveDaysInWindow, 0.5);
  assertEq("Half-day LOP", r.lopDaysInWindow, 0.5);
}

// =====================================================================
section("Salary structure resolver — typical Indian breakup at 1L CTC");
{
  // Default template: Basic 40% CTC, HRA 40% Basic, Special flat,
  // PF Employee 12% Basic+DA, PT flat 200
  const structure: RawStructure = {
    earnings: [
      { componentCode: "BASIC", componentName: "Basic", taxabilityType: "FULLY_TAXABLE", calculationType: "percentCTC", value: 40 },
      { componentCode: "HRA", componentName: "HRA", taxabilityType: "EXEMPT_FORMULA", calculationType: "percentBasic", value: 40 },
      { componentCode: "SPECIAL", componentName: "Special", taxabilityType: "FULLY_TAXABLE", calculationType: "flat", value: 0 },
    ],
    deductions: [
      { componentCode: "PF_EMPLOYEE", componentName: "PF Employee", taxabilityType: "DEDUCTION_STATUTORY", calculationType: "percentBasicPlusDA", value: 12 },
      { componentCode: "PT", componentName: "PT", taxabilityType: "DEDUCTION_STATUTORY", calculationType: "flat", value: 200 },
    ],
  };
  const r = resolveStructure({ structure, monthlyCtc: 100000 });
  // Basic = 40% × 1L = 40000
  // HRA = 40% × 40000 = 16000
  // Special = 0
  // Gross = 56000
  // PF employee = 12% × 40000 = 4800 (no DA)
  // PT = 200
  // Net = 56000 - 4800 - 200 = 51000
  assertEq("Resolver basic", r.basicMonthly, 40000);
  assertEq("Resolver HRA", r.hraMonthly, 16000);
  assertEq("Resolver gross", r.grossMonthly, 56000);
  assertEq("Resolver PF employee", r.pfEmployeeMonthly, 4800);
  assertEq("Resolver PT", r.ptMonthlyFromStructure, 200);
  assertEq("Resolver total deductions", r.totalDeductionsMonthly, 5000);
  assertEq("Resolver net", r.netMonthly, 51000);
}

section("Resolver — percentBasicPlusDA with DA component");
{
  const structure: RawStructure = {
    earnings: [
      { componentCode: "BASIC", componentName: "Basic", taxabilityType: "FULLY_TAXABLE", calculationType: "percentCTC", value: 40 },
      { componentCode: "DA", componentName: "DA", taxabilityType: "FULLY_TAXABLE", calculationType: "percentCTC", value: 10 },
    ],
    deductions: [
      { componentCode: "PF_EMPLOYEE", componentName: "PF", taxabilityType: "DEDUCTION_STATUTORY", calculationType: "percentBasicPlusDA", value: 12 },
    ],
  };
  const r = resolveStructure({ structure, monthlyCtc: 100000 });
  // Basic = 40000, DA = 10000, basis = 50000, PF = 6000
  assertEq("Resolver basic+DA basic", r.basicMonthly, 40000);
  assertEq("Resolver basic+DA DA", r.daMonthly, 10000);
  assertEq("Resolver basic+DA PF", r.pfEmployeeMonthly, 6000);
}

section("Resolver — percentGross deduction (ESI)");
{
  const structure: RawStructure = {
    earnings: [
      { componentCode: "BASIC", componentName: "Basic", taxabilityType: "FULLY_TAXABLE", calculationType: "flat", value: 15000 },
      { componentCode: "SPECIAL", componentName: "Special", taxabilityType: "FULLY_TAXABLE", calculationType: "flat", value: 5000 },
    ],
    deductions: [
      { componentCode: "ESI_EMPLOYEE", componentName: "ESI", taxabilityType: "DEDUCTION_STATUTORY", calculationType: "percentGross", value: 0.75 },
    ],
  };
  const r = resolveStructure({ structure, monthlyCtc: 20000 });
  // Gross = 20000; ESI = 0.75% × 20000 = 150
  assertEq("Resolver gross 20k", r.grossMonthly, 20000);
  assertEq("Resolver ESI from %gross", r.deductions[0].amount, 150);
}

section("Resolver — REIMBURSEMENT excluded from gross");
{
  const structure: RawStructure = {
    earnings: [
      { componentCode: "BASIC", componentName: "Basic", taxabilityType: "FULLY_TAXABLE", calculationType: "flat", value: 30000 },
      { componentCode: "TELEPHONE_REIMB", componentName: "Phone reimb", taxabilityType: "REIMBURSEMENT", calculationType: "flat", value: 2000 },
    ],
    deductions: [],
  };
  const r = resolveStructure({ structure, monthlyCtc: 50000 });
  assertEq("Reimb excluded from gross", r.grossMonthly, 30000);
  // Reimb component should still appear in earnings list with its amount
  assertEq("Reimb still listed", r.earnings[1].amount, 2000);
}

section("Prorate — attendance factor 0.5 halves all amounts (excl. reimb)");
{
  const structure: RawStructure = {
    earnings: [
      { componentCode: "BASIC", componentName: "Basic", taxabilityType: "FULLY_TAXABLE", calculationType: "flat", value: 40000 },
      { componentCode: "HRA", componentName: "HRA", taxabilityType: "EXEMPT_FORMULA", calculationType: "flat", value: 16000 },
      { componentCode: "TELEPHONE_REIMB", componentName: "Phone", taxabilityType: "REIMBURSEMENT", calculationType: "flat", value: 1000 },
    ],
    deductions: [
      { componentCode: "PF_EMPLOYEE", componentName: "PF", taxabilityType: "DEDUCTION_STATUTORY", calculationType: "flat", value: 1800 },
    ],
  };
  const full = resolveStructure({ structure, monthlyCtc: 100000 });
  const half = prorateResolved(full, 0.5);
  assertEq("Prorate basic 50%", half.basicMonthly, 20000);
  assertEq("Prorate HRA 50%", half.hraMonthly, 8000);
  assertEq("Prorate reimb unchanged", half.earnings[2].amount, 1000);
  assertEq("Prorate gross (basic+HRA halved, reimb excluded)", half.grossMonthly, 28000);
  assertEq("Prorate PF 50%", half.deductions[0].amount, 900);
  assertEq("Prorate net", half.netMonthly, 27100);
}

section("Prorate — factor 0 (no work this month) zeros earnings");
{
  const structure: RawStructure = {
    earnings: [{ componentCode: "BASIC", componentName: "Basic", taxabilityType: "FULLY_TAXABLE", calculationType: "flat", value: 50000 }],
    deductions: [],
  };
  const r = prorateResolved(resolveStructure({ structure, monthlyCtc: 0 }), 0);
  assertEq("Prorate zero gross", r.grossMonthly, 0);
}

section("Resolver warns when monthlyCtc is 0 but %CTC used");
{
  const structure: RawStructure = {
    earnings: [{ componentCode: "BASIC", componentName: "Basic", taxabilityType: "FULLY_TAXABLE", calculationType: "percentCTC", value: 40 }],
    deductions: [],
  };
  const r = resolveStructure({ structure, monthlyCtc: 0 });
  assertEq("Resolver warning emitted", r.warnings.length > 0, true);
  assertEq("Resolver basic = 0 when CTC missing", r.basicMonthly, 0);
}

// =====================================================================
section("ESI stickiness — covered at April start, salary jumps in June");
{
  // Employee on ₹18k in April → covered. Promoted to ₹30k in June.
  // Spec §13.4: ESI continues for the WHOLE Apr-Sep period.
  const r = determineEsiCoverage({
    calendarMonth: 6,
    calendarYear: 2025,
    currentMonthlyGross: 30000,
    esiApplicableOnProfile: false,
    priorTxnsThisFy: [
      { calendarMonth: 4, calendarYear: 2025, monthlyGross: 18000, esiEmployee: 135 },
      { calendarMonth: 5, calendarYear: 2025, monthlyGross: 18000, esiEmployee: 135 },
    ],
  });
  assertEq("ESI carry from April start", r.coveredAtPeriodStart, true);
  assertEq("ESI reason", r.reason, "carried_from_period_start");
}

section("ESI stickiness — NOT covered at April, salary dips in June");
{
  // Employee on ₹25k in April → NOT covered. Salary drops to ₹19k in June.
  // Spec §13.4: NO ESI mid-period if not covered at start.
  const r = determineEsiCoverage({
    calendarMonth: 6,
    calendarYear: 2025,
    currentMonthlyGross: 19000,
    esiApplicableOnProfile: false,
    priorTxnsThisFy: [
      { calendarMonth: 4, calendarYear: 2025, monthlyGross: 25000, esiEmployee: 0 },
      { calendarMonth: 5, calendarYear: 2025, monthlyGross: 25000, esiEmployee: 0 },
    ],
  });
  assertEq("ESI not retroactive", r.coveredAtPeriodStart, false);
  assertEq("ESI reason no-cover", r.reason, "uncovered_from_period_start");
}

section("ESI — period start month itself (April)");
{
  // Computing for April with ₹18k gross → covered now, sets the whole period.
  const r = determineEsiCoverage({
    calendarMonth: 4,
    calendarYear: 2025,
    currentMonthlyGross: 18000,
    esiApplicableOnProfile: false,
    priorTxnsThisFy: [],
  });
  assertEq("ESI April start eligible", r.coveredAtPeriodStart, true);
  assertEq("ESI April start reason", r.reason, "period_start_this_month_eligible");
}

section("ESI — Oct-Mar period spans calendar year (Feb)");
{
  // Feb 2026 → period start was Oct 2025; period FY year = 2025
  const r = determineEsiCoverage({
    calendarMonth: 2,
    calendarYear: 2026,
    currentMonthlyGross: 30000,
    esiApplicableOnProfile: false,
    priorTxnsThisFy: [
      { calendarMonth: 10, calendarYear: 2025, monthlyGross: 19000, esiEmployee: 142 },
      { calendarMonth: 11, calendarYear: 2025, monthlyGross: 19000, esiEmployee: 142 },
    ],
  });
  assertEq("ESI Oct-Mar carry into Feb", r.coveredAtPeriodStart, true);
  assertEq("ESI reason carry across year", r.reason, "carried_from_period_start");
}

section("ESI — joined mid-period (no period-start txn)");
{
  // Employee joined in May, no April txn exists. Uses current gross to decide.
  const eligible = determineEsiCoverage({
    calendarMonth: 5,
    calendarYear: 2025,
    currentMonthlyGross: 18000,
    esiApplicableOnProfile: false,
    priorTxnsThisFy: [],
  });
  assertEq("Mid-period join eligible", eligible.coveredAtPeriodStart, true);
  assertEq("Mid-period join reason", eligible.reason, "joined_mid_period_eligible");

  const notEligible = determineEsiCoverage({
    calendarMonth: 5,
    calendarYear: 2025,
    currentMonthlyGross: 30000,
    esiApplicableOnProfile: false,
    priorTxnsThisFy: [],
  });
  assertEq("Mid-period join not eligible", notEligible.coveredAtPeriodStart, false);
}

section("ESI — profile override applies regardless");
{
  const r = determineEsiCoverage({
    calendarMonth: 6,
    calendarYear: 2025,
    currentMonthlyGross: 50000, // way above threshold
    esiApplicableOnProfile: true,
    priorTxnsThisFy: [],
  });
  assertEq("Profile override wins", r.coveredAtPeriodStart, true);
  assertEq("Profile override reason", r.reason, "profile_override");
}

// =====================================================================
console.log(`\n──────────────────────────────────────────`);
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
