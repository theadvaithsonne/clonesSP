import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import {
  TeamforcePayrollRun,
} from "../../models/teamforce/teamforcePayrollRun.model";
import { TeamforcePayrollTransaction } from "../../models/teamforce/teamforcePayrollTransaction.model";
import { TeamforcePayrollConfig } from "../../models/teamforce/teamforcePayrollConfig.model";
import { TeamforceEmployeeProfile } from "../../models/teamforce/teamforceEmployeeProfile.model";
import { TeamforceSalaryStructure } from "../../models/teamforce/teamforceSalaryStructure.model";
import { TeamforcePTSlab } from "../../models/teamforce/teamforcePTSlab.model";
import { TeamforceEmployeeTaxDeclaration } from "../../models/teamforce/teamforceEmployeeTaxDeclaration.model";
import {
  getAuthUser,
  getOrgIdStrict,
  requireTeamforceWriteAccess,
} from "./_helpers";
import {
  computeSection192TDS,
  computePF,
  computeESI,
  computeProfessionalTax,
  determineEsiCoverage,
  getESIPeriod,
  resolveStructure,
  prorateResolved,
  aggregateForEmployee,
  getAttendanceWindow,
  getFYString,
  ageOnDate,
  type CityType,
  type PFOption,
  type PTSlab,
  type Regime,
  type RawStructure,
} from "../../services/teamforce/payroll";
import {
  loadAttendanceForRun,
  persistDeferredLop,
} from "../../services/teamforce/payroll/attendanceLoader";
import { sendSalarySlipEmail } from "../../services/teamforce/payroll/slipEmail";
import { User } from "../../models/user.model";

const router = Router();

const fyMonthSchema = z.object({
  fyMonth: z.number().int().min(1).max(12),
  fyYear: z.number().int().min(2020).max(2100),
});

const createRunSchema = fyMonthSchema.extend({
  runType: z.enum(["FULL", "PARTIAL"]).optional().default("FULL"),
  scope: z
    .object({
      departmentIds: z.array(z.string()).optional().default([]),
      branchIds: z.array(z.string()).optional().default([]),
      userIds: z.array(z.string()).optional().default([]),
      label: z.string().optional().default(""),
    })
    .optional(),
});

/** Calendar (month, year) of FY-relative month X for FY starting in startYear.
 *  fyMonth 1 = April of startYear; fyMonth 10 = January of startYear+1. */
function fyToCalendar(fyMonth: number, fyYear: number) {
  const calendarMonth = ((fyMonth - 1 + 3) % 12) + 1;
  const calendarYear = fyMonth + 3 > 12 ? fyYear + 1 : fyYear;
  return { calendarMonth, calendarYear };
}

interface BuildTransactionInput {
  orgId: string;
  userId: string;
  runId: string;
  calendarMonth: number;
  calendarYear: number;
  cutoffDay: number;
  defaultState: string;
  ptSlabs: PTSlab[];
}

/** Build (and upsert) a single payroll transaction for one employee. */
async function buildTransactionForEmployee(input: BuildTransactionInput) {
  const orgOid = new Types.ObjectId(input.orgId);
  const userOid = new Types.ObjectId(input.userId);

  const profile = await TeamforceEmployeeProfile.findOne({
    userId: userOid,
    orgId: orgOid,
  }).lean();
  if (!profile)
    return { skipped: true, reason: "no_profile" as const };
  if (!profile.salaryStructureId)
    return { skipped: true, reason: "no_salary_structure" as const };
  if (!profile.monthlyCtc || profile.monthlyCtc <= 0)
    return { skipped: true, reason: "no_monthly_ctc" as const };

  const structure = await TeamforceSalaryStructure.findOne({
    _id: profile.salaryStructureId,
    orgId: orgOid,
    isActive: true,
  }).lean();
  if (!structure)
    return { skipped: true, reason: "structure_inactive" as const };

  // Resolve structure → monthly amounts at full attendance.
  const fullResolved = resolveStructure({
    structure: structure as unknown as RawStructure,
    monthlyCtc: profile.monthlyCtc,
  });

  // Aggregate attendance → factor.
  const attData = await loadAttendanceForRun(
    input.userId,
    input.orgId,
    input.calendarMonth,
    input.calendarYear,
    input.cutoffDay
  );
  const att = aggregateForEmployee({
    payrollMonth: input.calendarMonth,
    payrollYear: input.calendarYear,
    cutoffDay: input.cutoffDay,
    doj: attData.doj,
    weeklyOffDays: attData.weeklyOffDays,
    approvedLeaves: attData.approvedLeaves,
    presentDates: attData.presentDates,
    deferredLopFromPrevCycle: attData.deferredLopFromPrevCycle,
  });

  // Apply attendance proration to component amounts.
  const proRated = prorateResolved(fullResolved, att.attendanceFactor);
  const monthlyGross = proRated.grossMonthly;
  const joiningPartialPay = att.inGraceWindow
    ? Math.round(fullResolved.grossMonthly * att.graceTailFactor)
    : 0;

  // Tax declaration
  const fyString = getFYString(input.calendarMonth, input.calendarYear);
  const decl = await TeamforceEmployeeTaxDeclaration.findOne({
    userId: userOid,
    orgId: orgOid,
    fy: fyString,
  }).lean();
  const regime: Regime = (decl?.regime as Regime) || "NEW";

  // YTD actuals from prior PAID/APPROVED transactions in the same FY.
  const fyStart = new Date(input.calendarYear, input.calendarMonth - 1, 1);
  fyStart.setMonth(3); // April
  if (input.calendarMonth < 4) fyStart.setFullYear(input.calendarYear - 1);
  const priorTxns = await TeamforcePayrollTransaction.find({
    orgId: orgOid,
    userId: userOid,
    runId: { $ne: new Types.ObjectId(input.runId) },
  })
    .populate("runId", "calendarMonth calendarYear status")
    .lean();
  // FY of a (calendarMonth, calendarYear) pair = April-start year.
  const fyOf = (m: number, y: number) => (m >= 4 ? y : y - 1);
  const currentFyYear = fyOf(input.calendarMonth, input.calendarYear);

  const ytd = { gross: 0, tds: 0, pt: 0, pf: 0 };
  /** Approved/paid prior transactions for THIS employee in THIS FY. */
  const priorTxnsThisFy: Array<{
    calendarMonth: number;
    calendarYear: number;
    monthlyGross: number;
    esiEmployee: number;
  }> = [];
  for (const t of priorTxns) {
    const r = t.runId as any;
    if (!r) continue;
    if (r.status !== "APPROVED" && r.status !== "PAID") continue;
    const txnMonth = r.calendarMonth as number;
    const txnYear = r.calendarYear as number;
    if (fyOf(txnMonth, txnYear) !== currentFyYear) continue;
    // Strictly prior in the FY (not the current month).
    const txnFyMonthIdx =
      (txnMonth >= 4 ? txnMonth - 4 : txnMonth + 8) +
      (txnYear - currentFyYear) * 12;
    const curFyMonthIdx =
      input.calendarMonth >= 4 ? input.calendarMonth - 4 : input.calendarMonth + 8;
    if (txnFyMonthIdx >= curFyMonthIdx) continue;

    ytd.gross += t.grossSalary || 0;
    ytd.tds += t.monthlyTDS || 0;
    ytd.pt += t.professionalTax || 0;
    ytd.pf += t.pfEmployee || 0;
    priorTxnsThisFy.push({
      calendarMonth: txnMonth,
      calendarYear: txnYear,
      monthlyGross: t.grossSalary || 0,
      esiEmployee: t.esiEmployee || 0,
    });
  }

  // ── Form 12B (§13.1) — previous employer's gross / TDS / PT / PF
  // count toward annual liability. This employer deducts only the balance. ──
  const formTwelveBNote: string[] = [];
  if (decl?.previousEmployer) {
    const pe = decl.previousEmployer;
    const peGross = pe.grossSalary || 0;
    if (peGross > 0) {
      ytd.gross += peGross;
      ytd.tds += pe.tdsDeducted || 0;
      ytd.pt += pe.ptPaid || 0;
      ytd.pf += pe.pfPaid || 0;
      formTwelveBNote.push(
        `Form 12B applied: previous employer ${pe.name || "(unnamed)"} ₹${peGross.toLocaleString("en-IN")} gross + ₹${(pe.tdsDeducted || 0).toLocaleString("en-IN")} TDS counted toward YTD.`
      );
    }
  }

  const cityType: CityType =
    (profile.cityType as CityType | undefined) === "METRO"
      ? "METRO"
      : "NON_METRO";
  const state = profile.state || input.defaultState;
  const age = profile.dateOfBirth ? ageOnDate(profile.dateOfBirth as Date) : 35;

  // Spec §13.2 — F&F detection. The employee's run is treated as their
  // FINAL month iff they have an `exitedAt` date that falls within or
  // before the current pay-month boundary. The engine then deducts the
  // full remaining tax liability instead of spreading.
  const exitDate = profile.exitedAt ? new Date(profile.exitedAt as Date) : null;
  const isFinalMonth =
    !!exitDate &&
    (exitDate.getFullYear() < input.calendarYear ||
      (exitDate.getFullYear() === input.calendarYear &&
        exitDate.getMonth() + 1 <= input.calendarMonth));

  const sec192 = computeSection192TDS({
    age,
    state,
    cityType,
    regime,
    ytdActualGross: ytd.gross,
    ytdTdsDeducted: ytd.tds,
    ytdPtPaid: ytd.pt,
    ytdPfEmployeeAnnual: ytd.pf,
    payrollMonth: input.calendarMonth,
    payrollYear: input.calendarYear,
    monthlyGross,
    basicAnnual: fullResolved.basicMonthly * 12,
    daAnnual: fullResolved.daMonthly * 12,
    hraAnnual: fullResolved.hraMonthly * 12,
    ltaAnnual: fullResolved.ltaMonthly * 12,
    educationAllowanceAnnual: fullResolved.educationAllowanceMonthly * 12,
    hostelAllowanceAnnual: fullResolved.hostelAllowanceMonthly * 12,
    employerNpsAnnual: fullResolved.employerNpsMonthly * 12,
    hraDeclaration:
      decl?.hraDeclaration && decl.hraDeclaration.monthlyRentPaid
        ? {
            monthlyRentPaid: decl.hraDeclaration.monthlyRentPaid || 0,
            ownsHouseInCity: !!decl.hraDeclaration.ownsHouseInCity,
            rentDeclarationProvided: true,
            landlordPanProvided: !!decl.hraDeclaration.landlordPan,
          }
        : undefined,
    ltaClaimAmount: decl?.ltaClaimAmount || 0,
    numChildren: decl?.numChildren || 0,
    declared80C: decl?.declared80C || 0,
    declaredNpsSelf: decl?.declaredNpsSelf || 0,
    declared80DSelf: decl?.declared80DSelf || 0,
    declared80DParent: decl?.declared80DParent || 0,
    parentSeniorCitizen: !!decl?.parentSeniorCitizen,
    savingsInterest: decl?.savingsInterest || 0,
    fdInterest: decl?.fdInterest || 0,
    declared80E: decl?.declared80E || 0,
    declared80EEA: decl?.declared80EEA || 0,
    declared80G: decl?.declared80G || 0,
    ptSlabs: input.ptSlabs,
    isFinalMonth,
  });

  // ── Authoritative PF / ESI / PT (override structure-derived figures) ──
  // The structure resolver gives us a hint, but the engine modules are the
  // canonical source for statutory math because they implement the ceiling /
  // contribution-period rules.

  const pfResult = computePF({
    basicMonthly: proRated.basicMonthly,
    daMonthly: proRated.daMonthly,
    pfOption: (profile.pfOption as PFOption | undefined) === "ACTUAL"
      ? "ACTUAL"
      : "CEILING",
  });

  // ESI: spec §13.4 stickiness. Coverage is fixed at the start of each
  // 6-month contribution period (Apr-Sep / Oct-Mar) and carries forward
  // even if salary later rises above ₹21k. The pure helper figures out
  // who set the period's coverage given the prior-month transactions.
  const esiPeriod = getESIPeriod(input.calendarMonth);
  const esiCoverage = determineEsiCoverage({
    calendarMonth: input.calendarMonth,
    calendarYear: input.calendarYear,
    currentMonthlyGross: monthlyGross,
    esiApplicableOnProfile: !!profile.esiApplicable,
    priorTxnsThisFy,
  });
  const esiResult = computeESI({
    monthlyGross,
    coveredAtPeriodStart: esiCoverage.coveredAtPeriodStart,
  });

  // PT: state slabs are authoritative; only used if employee has a state.
  const ptResult = computeProfessionalTax({
    state: profile.state || input.defaultState,
    monthlyGross,
    payrollMonth: input.calendarMonth,
    ytdPtPaid: ytd.pt,
    slabs: input.ptSlabs,
  });

  // Net pay = gross + grace tail − authoritative statutory − TDS − any
  // voluntary deductions in the structure (loan EMI, advance recovery).
  const voluntaryDeductions = proRated.deductions
    .filter((d) =>
      [
        "DEDUCTION_VOLUNTARY",
      ].includes(d.taxabilityType)
    )
    .reduce((s, d) => s + d.amount, 0);

  const totalStatutory =
    pfResult.employeePF + esiResult.employeeESI + ptResult.monthlyPT;

  const netPay =
    monthlyGross +
    joiningPartialPay -
    totalStatutory -
    voluntaryDeductions -
    sec192.monthlyTDS;

  const warnings = [
    ...fullResolved.warnings,
    ...att.warnings,
    ...formTwelveBNote,
  ];
  if (ptResult.cappedByAnnualLimit && ptResult.monthlyPT === 0) {
    warnings.push("Professional Tax annual cap (₹2,500) reached — PT = 0 this month.");
  }
  if (isFinalMonth && exitDate) {
    warnings.push(
      `Full & Final settlement: exit date ${exitDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. TDS deducts the full remaining annual liability this month (spec §13.2).`
    );
  }
  // Surface ESI status + the reason. Carry-over from period start is
  // important for employees to understand why ESI is still being deducted
  // even if their salary is now above ₹21k.
  if (esiResult.applies) {
    if (esiCoverage.reason === "carried_from_period_start" && monthlyGross > 21000) {
      warnings.push(
        `ESI carried from period ${esiPeriod} start — sticky for the full 6-month period (spec §13.4).`
      );
    } else {
      warnings.push(`ESI applies (period ${esiPeriod}).`);
    }
  } else if (
    esiCoverage.reason === "uncovered_from_period_start" &&
    monthlyGross <= 21000
  ) {
    warnings.push(
      `ESI not applicable: employee was not covered at start of period ${esiPeriod}; will not retroactively apply mid-period.`
    );
  }

  const txn = await TeamforcePayrollTransaction.findOneAndUpdate(
    { runId: new Types.ObjectId(input.runId), userId: userOid },
    {
      $set: {
        runId: new Types.ObjectId(input.runId),
        orgId: orgOid,
        userId: userOid,
        salaryStructureId: profile.salaryStructureId,
        monthlyCtcAnchor: profile.monthlyCtc,
        earnings: proRated.earnings,
        deductions: proRated.deductions,
        attendance: {
          windowStart: att.windowStart,
          windowEnd: att.windowEnd,
          windowCalendarDays: att.windowCalendarDays,
          daysEmployeeInWindow: att.daysEmployeeInWindow,
          daysPresentInWindow: att.daysPresentInWindow,
          paidLeaveDaysInWindow: att.paidLeaveDaysInWindow,
          lopDaysInWindow: att.lopDaysInWindow,
          scheduledOffDaysInWindow: att.scheduledOffDaysInWindow,
          attendanceFactor: att.attendanceFactor,
          lopDaysApplied: att.lopDaysApplied,
          deferredLopApplied: att.deferredLopApplied,
          isJoiningMonth: att.isJoiningMonth,
          inGraceWindow: att.inGraceWindow,
          graceTailDays: att.graceTailDays,
          graceTailLopDays: att.graceTailLopDays,
          graceTailFactor: att.graceTailFactor,
          deferredLopForNextCycle: att.deferredLopForNextCycle,
        },
        regimeUsed: regime,
        projectedAnnualGross: sec192.projectedAnnualGross,
        totalExemptions: sec192.totalExemptions,
        standardDeduction: sec192.standardDeduction,
        chapterVIA: {
          // We persist what the engine returned (sum, not sub-breakdown — the
          // engine doesn't surface individual sub-codes today).
          total: sec192.chapterVIATotal,
        },
        netTaxableIncome: sec192.netTaxableIncome,
        annualTaxLiability: sec192.annualTaxLiability,
        monthlyTDS: sec192.monthlyTDS,
        overDeducted: sec192.overDeducted,

        pfEmployee: pfResult.employeePF,
        pfEmployer: pfResult.employerEPF + pfResult.employerEPS,
        esiEmployee: esiResult.employeeESI,
        esiEmployer: esiResult.employerESI,
        professionalTax: ptResult.monthlyPT,

        grossSalary: monthlyGross,
        joiningPartialPay,
        netPay: Math.max(0, netPay),

        warnings,
      },
    },
    { upsert: true, new: true }
  ).lean();

  return { skipped: false as const, transaction: txn, attendance: att };
}

/** Recompute totals on the run from its transactions. */
async function recomputeRunTotals(runId: string) {
  const txns = await TeamforcePayrollTransaction.find({
    runId: new Types.ObjectId(runId),
  })
    .select(
      "grossSalary netPay monthlyTDS pfEmployee professionalTax esiEmployee"
    )
    .lean();
  const totals = txns.reduce(
    (acc, t) => {
      acc.grossSum += t.grossSalary || 0;
      acc.netSum += t.netPay || 0;
      acc.tdsSum += t.monthlyTDS || 0;
      acc.pfSum += t.pfEmployee || 0;
      acc.ptSum += t.professionalTax || 0;
      acc.esiSum += t.esiEmployee || 0;
      acc.employeeCount += 1;
      return acc;
    },
    { grossSum: 0, netSum: 0, tdsSum: 0, pfSum: 0, ptSum: 0, esiSum: 0, employeeCount: 0 }
  );
  await TeamforcePayrollRun.updateOne(
    { _id: new Types.ObjectId(runId) },
    { $set: { totals } }
  );
  return totals;
}

// ─────────────────────────────────────────────────────────────────────
// POST /payroll-runs  → create or refresh the DRAFT run for {fyMonth, fyYear}
//   One run per month per org (unique index enforced).
//   FULL: upserts transactions for ALL eligible employees (original behaviour).
//   PARTIAL: adds transactions only for scope employees not yet in the run.
// ─────────────────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;
  const me = getAuthUser(req);

  const { fyMonth, fyYear, runType, scope } = createRunSchema.parse(req.body);
  const orgOid = new Types.ObjectId(orgId);
  const { calendarMonth, calendarYear } = fyToCalendar(fyMonth, fyYear);

  if (runType === "PARTIAL") {
    const hasScope =
      (scope?.departmentIds?.length ?? 0) > 0 ||
      (scope?.branchIds?.length ?? 0) > 0 ||
      (scope?.userIds?.length ?? 0) > 0;
    if (!hasScope)
      return res.status(400).json({ error: "PARTIAL run requires at least one department, branch, or user in scope." });
  }

  // Load org payroll config (auto-create with sensible defaults if missing).
  let cfg = await TeamforcePayrollConfig.findOne({ orgId: orgOid }).lean();
  if (!cfg) {
    await TeamforcePayrollConfig.create({ orgId: orgOid });
    cfg = await TeamforcePayrollConfig.findOne({ orgId: orgOid }).lean();
  }
  if (!cfg) return res.status(500).json({ error: "Failed to load payroll config" });

  const cutoffDay = cfg.attendanceCutoffDay;
  const defaultState = cfg.defaultState || "Karnataka";

  const window = getAttendanceWindow(calendarMonth, calendarYear, cutoffDay);

  // Upsert: reuse existing DRAFT, reject APPROVED/PAID (original behaviour).
  let run = await TeamforcePayrollRun.findOne({ orgId: orgOid, fyMonth, fyYear });
  if (run && (run.status === "APPROVED" || run.status === "PAID")) {
    return res.status(409).json({
      error: `Payroll for FY${fyYear} M${fyMonth} is already ${run.status}; create not allowed.`,
      runId: run._id,
    });
  }
  if (!run) {
    run = await TeamforcePayrollRun.create({
      orgId: orgOid,
      fyMonth,
      fyYear,
      calendarMonth,
      calendarYear,
      status: "DRAFT",
      windowStart: window.start,
      windowEnd: window.end,
      cutoffDayUsed: cutoffDay,
      runType,
      scope: scope
        ? {
            departmentIds: scope.departmentIds.map((id) => new Types.ObjectId(id)),
            branchIds: scope.branchIds.map((id) => new Types.ObjectId(id)),
            userIds: scope.userIds.map((id) => new Types.ObjectId(id)),
            label: scope.label,
          }
        : null,
      createdBy: new Types.ObjectId(me.userId),
    });
  } else {
    // Update scope/runType on existing DRAFT when re-running partial.
    await TeamforcePayrollRun.updateOne(
      { _id: run._id },
      { $set: { runType, scope: scope ? {
          departmentIds: scope.departmentIds.map((id) => new Types.ObjectId(id)),
          branchIds: scope.branchIds.map((id) => new Types.ObjectId(id)),
          userIds: scope.userIds.map((id) => new Types.ObjectId(id)),
          label: scope.label,
        } : null } }
    );
  }

  // For PARTIAL: find users already in this DRAFT run — skip them.
  const skipUserIds = new Set<string>();
  if (runType === "PARTIAL") {
    const existingTxns = await TeamforcePayrollTransaction.find({ runId: run._id })
      .select("userId")
      .lean();
    existingTxns.forEach((t: any) => skipUserIds.add(String(t.userId)));
  }

  // Resolve scope user IDs (PARTIAL only).
  let scopeUserIds: Set<string> | null = null;
  if (runType === "PARTIAL" && scope) {
    const resolved = new Set<string>();
    if (scope.departmentIds.length) {
      const dProfiles = await TeamforceEmployeeProfile.find({
        orgId: orgOid,
        departmentId: { $in: scope.departmentIds.map((id) => new Types.ObjectId(id)) },
      })
        .select("userId")
        .lean();
      dProfiles.forEach((p: any) => resolved.add(String(p.userId)));
    }
    if (scope.branchIds.length) {
      const bProfiles = await TeamforceEmployeeProfile.find({
        orgId: orgOid,
        branchId: { $in: scope.branchIds.map((id) => new Types.ObjectId(id)) },
      })
        .select("userId")
        .lean();
      bProfiles.forEach((p: any) => resolved.add(String(p.userId)));
    }
    scope.userIds.forEach((id) => resolved.add(id));
    scopeUserIds = resolved;
  }

  // PT slabs (active only)
  const slabs = (await TeamforcePTSlab.find({ isActive: true }).lean()).map(
    (s: any) => ({
      state: s.state,
      grossFrom: s.grossFrom,
      grossTo: s.grossTo,
      monthlyPT: s.monthlyPT,
      monthOverride: s.monthOverride,
    })
  ) as PTSlab[];

  // Eligible employees: have a profile in this org AND a salaryStructureId.
  const allProfiles = await TeamforceEmployeeProfile.find({
    orgId: orgOid,
    salaryStructureId: { $ne: null },
  })
    .select("userId")
    .lean();

  // FULL: process all eligible (upserts existing transactions — original behaviour).
  // PARTIAL: process only scope employees not already in this run.
  const profiles = allProfiles.filter((p: any) => {
    const uid = String(p.userId);
    if (runType === "PARTIAL") {
      if (scopeUserIds && !scopeUserIds.has(uid)) return false; // outside scope
      if (skipUserIds.has(uid)) return false;                   // already in run
    }
    return true;
  });

  // Track cumulative includedUserIds on the run.
  const newIncludedIds = profiles.map((p: any) => new Types.ObjectId(String(p.userId)));
  await TeamforcePayrollRun.updateOne(
    { _id: run._id },
    { $addToSet: { includedUserIds: { $each: newIncludedIds } } }
  );

  const skipped: Array<{ userId: string; reason: string }> = [];
  let processed = 0;

  for (const p of profiles) {
    const result = await buildTransactionForEmployee({
      orgId,
      userId: String(p.userId),
      runId: String(run._id),
      calendarMonth,
      calendarYear,
      cutoffDay,
      defaultState,
      ptSlabs: slabs,
    });
    if (result.skipped) {
      skipped.push({ userId: String(p.userId), reason: result.reason });
    } else {
      processed += 1;
    }
  }

  await recomputeRunTotals(String(run._id));

  const refreshed = await TeamforcePayrollRun.findById(run._id).lean();
  res.status(201).json({
    run: refreshed,
    processed,
    skipped,
  });
});

// ─────────────────────────────────────────────────────────────────────
// GET /payroll-runs/me/transactions  → caller's own approved/paid txns
//   Each row is paired with its parent run for context. DRAFTs are
//   hidden — employees should only see slips after admin approval.
// ─────────────────────────────────────────────────────────────────────
router.get("/me/transactions", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  const me = getAuthUser(req);

  const orgOid = new Types.ObjectId(orgId);
  const userOid = new Types.ObjectId(me.userId);

  const fyYear = req.query.fyYear ? Number(req.query.fyYear) : undefined;
  const runFilter: Record<string, unknown> = {
    orgId: orgOid,
    status: { $in: ["APPROVED", "PAID"] },
  };
  if (fyYear) runFilter.fyYear = fyYear;

  const runs = await TeamforcePayrollRun.find(runFilter)
    .sort({ fyYear: -1, fyMonth: -1 })
    .lean();
  if (runs.length === 0) return res.json({ slips: [] });

  const runIds = runs.map((r) => r._id);
  const txns = await TeamforcePayrollTransaction.find({
    runId: { $in: runIds },
    userId: userOid,
  }).lean();

  const slips = txns
    .map((t) => {
      const run = runs.find((r) => String(r._id) === String(t.runId));
      if (!run) return null;
      return { run, transaction: t };
    })
    .filter(Boolean)
    // Same FY ordering as runs.
    .sort((a: any, b: any) => {
      const ay = a.run.fyYear * 100 + a.run.fyMonth;
      const by = b.run.fyYear * 100 + b.run.fyMonth;
      return by - ay;
    });

  res.json({ slips });
});

// ─────────────────────────────────────────────────────────────────────
// GET /payroll-runs/me/form16?fyYear=2024
//   Annual aggregation of the caller's APPROVED+PAID transactions for the
//   given FY. Returns totals + per-month rows so the frontend can render a
//   Form 16-style printable. Hides DRAFTs the same way self-view does.
// ─────────────────────────────────────────────────────────────────────
router.get("/me/form16", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  const me = getAuthUser(req);

  const fyYear = Number(req.query.fyYear);
  if (!fyYear)
    return res.status(400).json({ error: "fyYear is required" });

  const orgOid = new Types.ObjectId(orgId);
  const userOid = new Types.ObjectId(me.userId);

  const runs = await TeamforcePayrollRun.find({
    orgId: orgOid,
    fyYear,
    status: { $in: ["APPROVED", "PAID"] },
  })
    .sort({ fyMonth: 1 })
    .lean();
  if (runs.length === 0)
    return res.json({ fyYear, fyString: `${fyYear}-${String((fyYear + 1) % 100).padStart(2, "0")}`, months: [], totals: null });

  const runIds = runs.map((r) => r._id);
  const txns = await TeamforcePayrollTransaction.find({
    runId: { $in: runIds },
    userId: userOid,
  }).lean();

  const months = txns
    .map((t) => {
      const r = runs.find((rr) => String(rr._id) === String(t.runId));
      if (!r) return null;
      return { run: r, transaction: t };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.run.fyMonth - b.run.fyMonth);

  const totals = months.reduce(
    (acc: any, m: any) => {
      const t = m.transaction;
      acc.gross += t.grossSalary || 0;
      acc.exemptions += t.totalExemptions || 0;
      acc.standardDeduction += t.standardDeduction || 0;
      acc.chapterVIA += t.chapterVIA?.total || 0;
      acc.tds += t.monthlyTDS || 0;
      acc.pf += t.pfEmployee || 0;
      acc.pt += t.professionalTax || 0;
      acc.esi += t.esiEmployee || 0;
      acc.netPay += t.netPay || 0;
      return acc;
    },
    {
      gross: 0,
      exemptions: 0,
      standardDeduction: 0,
      chapterVIA: 0,
      tds: 0,
      pf: 0,
      pt: 0,
      esi: 0,
      netPay: 0,
    }
  );

  res.json({
    fyYear,
    fyString: `${fyYear}-${String((fyYear + 1) % 100).padStart(2, "0")}`,
    months,
    totals,
  });
});

// ─────────────────────────────────────────────────────────────────────
// GET /payroll-runs  → list runs (optionally filter by FY)
// ─────────────────────────────────────────────────────────────────────
// GET /payroll-runs/month-summary?fyYear=&fyMonth=
//   Returns all runs for the month + remaining eligible employees
//   (eligible but not yet in any APPROVED/PAID run this month).
// ─────────────────────────────────────────────────────────────────────
router.get("/month-summary", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const fyYear = Number(req.query.fyYear);
  const fyMonth = Number(req.query.fyMonth);
  if (!fyYear || !fyMonth)
    return res.status(400).json({ error: "fyYear and fyMonth are required" });

  const orgOid = new Types.ObjectId(orgId);

  // One run per month — find it.
  const run = await TeamforcePayrollRun.findOne({ orgId: orgOid, fyYear, fyMonth }).lean();
  const runs = run ? [run] : [];

  // Users already in this run's transactions (regardless of run status).
  const processedTxns = run
    ? await TeamforcePayrollTransaction.find({ runId: run._id }).select("userId").lean()
    : [];
  const processedUserIds = [...new Set(processedTxns.map((t: any) => String(t.userId)))];
  const processedSet = new Set(processedUserIds);

  // All eligible employees.
  const profiles = await TeamforceEmployeeProfile.find({
    orgId: orgOid,
    salaryStructureId: { $ne: null },
  })
    .select("userId monthlyCtc departmentId branchId")
    .lean();

  const eligibleProfiles = (profiles as any[]).filter((p) => p.monthlyCtc && p.monthlyCtc > 0);
  const eligibleUserOids = eligibleProfiles.map((p) => new Types.ObjectId(String(p.userId)));

  const users = await User.find({ _id: { $in: eligibleUserOids } })
    .select("_id name email")
    .lean();
  const userMap = new Map((users as any[]).map((u) => [String(u._id), u]));

  const remainingEmployees = eligibleProfiles
    .filter((p) => !processedSet.has(String(p.userId)))
    .map((p) => {
      const u = userMap.get(String(p.userId));
      return {
        userId: String(p.userId),
        name: (u as any)?.name || (u as any)?.email || String(p.userId).slice(-6),
        email: (u as any)?.email,
        departmentId: p.departmentId ? String(p.departmentId) : null,
        branchId: p.branchId ? String(p.branchId) : null,
      };
    });

  res.json({
    runs,
    processedUserIds,
    remainingEmployees,
    totalEligible: eligibleProfiles.length,
    totalProcessed: processedUserIds.length,
    totalRemaining: remainingEmployees.length,
  });
});

// ─────────────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;

  const fyYear = req.query.fyYear ? Number(req.query.fyYear) : undefined;
  const filter: Record<string, unknown> = { orgId: new Types.ObjectId(orgId) };
  if (fyYear) filter.fyYear = fyYear;

  const runs = await TeamforcePayrollRun.find(filter)
    .sort({ fyYear: -1, fyMonth: -1 })
    .lean();
  res.json({ runs });
});

// ─────────────────────────────────────────────────────────────────────
// GET /payroll-runs/:id  → run + all its transactions
// ─────────────────────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const run = await TeamforcePayrollRun.findOne({
    _id: req.params.id,
    orgId: new Types.ObjectId(orgId),
  }).lean();
  if (!run) return res.status(404).json({ error: "Run not found" });

  const transactions = await TeamforcePayrollTransaction.find({
    runId: run._id,
  })
    .populate("userId", "name email")
    .populate("overriddenBy", "name email")
    .lean();

  res.json({ run, transactions });
});

// ─────────────────────────────────────────────────────────────────────
// PATCH /payroll-runs/:id/transactions/:txId — admin override single txn
// Allowed fields: monthlyTDS, professionalTax, pfEmployee, esiEmployee,
//   joiningPartialPay, netPay (final-pay override). Recomputes run totals.
// ─────────────────────────────────────────────────────────────────────
const overrideSchema = z.object({
  monthlyTDS: z.number().min(0).optional(),
  professionalTax: z.number().min(0).optional(),
  pfEmployee: z.number().min(0).optional(),
  esiEmployee: z.number().min(0).optional(),
  joiningPartialPay: z.number().min(0).optional(),
  netPay: z.number().min(0).optional(),
  overrideNotes: z.string().optional(),
});

router.patch(
  "/:id/transactions/:txId",
  requireAuth,
  async (req, res) => {
    const orgId = getOrgIdStrict(req, res);
    if (!orgId) return;
    if (!(await requireTeamforceWriteAccess(req, res))) return;
    const me = getAuthUser(req);

    const run = await TeamforcePayrollRun.findOne({
      _id: req.params.id,
      orgId: new Types.ObjectId(orgId),
    }).lean();
    if (!run) return res.status(404).json({ error: "Run not found" });
    if (run.status !== "DRAFT") {
      return res
        .status(409)
        .json({ error: "Only DRAFT runs can be overridden" });
    }

    const patch = overrideSchema.parse(req.body);
    const update: Record<string, unknown> = {
      ...patch,
      overriddenBy: new Types.ObjectId(me.userId),
      overriddenAt: new Date(),
    };

    const txn = await TeamforcePayrollTransaction.findOneAndUpdate(
      { _id: req.params.txId, runId: run._id },
      { $set: update },
      { new: true }
    ).lean();
    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    await recomputeRunTotals(String(run._id));
    res.json({ transaction: txn });
  }
);

// ─────────────────────────────────────────────────────────────────────
// POST /payroll-runs/:id/approve
//   - Flip status DRAFT → APPROVED
//   - Lock payrollConfig.attendanceCutoffDay (set locked=true)
//   - For each transaction: persist deferredLopForNextCycle to profile
// ─────────────────────────────────────────────────────────────────────
router.post("/:id/approve", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;
  const me = getAuthUser(req);
  const orgOid = new Types.ObjectId(orgId);

  const run = await TeamforcePayrollRun.findOne({
    _id: req.params.id,
    orgId: orgOid,
  });
  if (!run) return res.status(404).json({ error: "Run not found" });
  if (run.status !== "DRAFT") {
    return res
      .status(409)
      .json({ error: `Run is ${run.status}; only DRAFT can be approved.` });
  }

  // 1. Mark run approved
  await TeamforcePayrollRun.updateOne(
    { _id: run._id },
    {
      $set: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: new Types.ObjectId(me.userId),
      },
    }
  );

  // 2. Lock cutoff
  await TeamforcePayrollConfig.updateOne(
    { orgId: orgOid },
    { $set: { locked: true, lockedSince: new Date() } }
  );

  // 3. Consume + write back deferredLopDays for every employee in this run
  const txns = await TeamforcePayrollTransaction.find({ runId: run._id })
    .select("userId attendance.deferredLopForNextCycle")
    .lean();
  for (const t of txns) {
    await persistDeferredLop(
      String(t.userId),
      orgId,
      Number(t.attendance?.deferredLopForNextCycle || 0)
    );
  }

  const refreshed = await TeamforcePayrollRun.findById(run._id).lean();
  res.json({ run: refreshed });
});

// ─────────────────────────────────────────────────────────────────────
// POST /payroll-runs/:id/mark-paid
// ─────────────────────────────────────────────────────────────────────
router.post("/:id/mark-paid", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const run = await TeamforcePayrollRun.findOne({
    _id: req.params.id,
    orgId: new Types.ObjectId(orgId),
  });
  if (!run) return res.status(404).json({ error: "Run not found" });
  if (run.status !== "APPROVED") {
    return res
      .status(409)
      .json({ error: `Run is ${run.status}; only APPROVED can be marked paid.` });
  }
  await TeamforcePayrollRun.updateOne(
    { _id: run._id },
    { $set: { status: "PAID", paidAt: new Date() } }
  );
  const refreshed = await TeamforcePayrollRun.findById(run._id).lean();
  res.json({ run: refreshed });
});

// ─────────────────────────────────────────────────────────────────────
// DELETE /payroll-runs/:id  → only DRAFT
// ─────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
// Slip email — admin only. Run must be APPROVED or PAID before send.
//   POST /payroll-runs/:id/transactions/:txId/email  → single
//   POST /payroll-runs/:id/email-all                 → every txn in the run
// ─────────────────────────────────────────────────────────────────────

function fyMonthLabelFor(fyMonth: number, fyYear: number): string {
  const labels = [
    "Apr", "May", "Jun", "Jul", "Aug", "Sep",
    "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
  ];
  const yr = fyMonth >= 10 ? fyYear + 1 : fyYear;
  return `${labels[fyMonth - 1]} ${yr}`;
}

function fyStringOf(fyYear: number): string {
  return `${fyYear}-${String((fyYear + 1) % 100).padStart(2, "0")}`;
}

async function emailOneTransaction(
  runId: string,
  txId: string,
  orgId: string
): Promise<{ ok: true; email: string } | { ok: false; reason: string }> {
  const orgOid = new Types.ObjectId(orgId);
  const run = await TeamforcePayrollRun.findOne({
    _id: new Types.ObjectId(runId),
    orgId: orgOid,
  }).lean();
  if (!run) return { ok: false, reason: "run_not_found" };
  if (run.status === "DRAFT")
    return { ok: false, reason: "run_is_draft" };

  const txn = await TeamforcePayrollTransaction.findOne({
    _id: new Types.ObjectId(txId),
    runId: run._id,
  }).lean();
  if (!txn) return { ok: false, reason: "transaction_not_found" };

  const user = await User.findById(txn.userId).select("email name").lean();
  if (!user || !user.email) return { ok: false, reason: "no_email_on_user" };

  await sendSalarySlipEmail({
    recipientEmail: user.email,
    recipientName: user.name || user.email,
    payMonthLabel: fyMonthLabelFor(run.fyMonth as number, run.fyYear as number),
    fyString: fyStringOf(run.fyYear as number),
    regime: txn.regimeUsed as "OLD" | "NEW",
    windowStart: new Date(run.windowStart as any),
    windowEnd: new Date(run.windowEnd as any),
    earnings: (txn.earnings || []).map((e: any) => ({
      label: e.componentName,
      amount: e.amount || 0,
    })),
    deductions: (txn.deductions || [])
      .filter(
        (d: any) =>
          !["PF_EMPLOYEE", "ESI_EMPLOYEE", "PT"].includes(d.componentCode)
      )
      .map((d: any) => ({
        label: d.componentName,
        amount: d.amount || 0,
      })),
    grossSalary: txn.grossSalary || 0,
    pfEmployee: txn.pfEmployee || 0,
    esiEmployee: txn.esiEmployee || 0,
    professionalTax: txn.professionalTax || 0,
    monthlyTDS: txn.monthlyTDS || 0,
    joiningPartialPay: txn.joiningPartialPay || 0,
    netPay: txn.netPay || 0,
    attendance: {
      factor: txn.attendance?.attendanceFactor || 0,
      daysPresent: txn.attendance?.daysPresentInWindow || 0,
      calendarDays: txn.attendance?.windowCalendarDays || 0,
      lopDays: txn.attendance?.lopDaysApplied || 0,
    },
    warnings: txn.warnings || [],
  });

  return { ok: true, email: user.email };
}

router.post(
  "/:id/transactions/:txId/email",
  requireAuth,
  async (req, res) => {
    const orgId = getOrgIdStrict(req, res);
    if (!orgId) return;
    if (!(await requireTeamforceWriteAccess(req, res))) return;

    const result = await emailOneTransaction(
      req.params.id,
      req.params.txId,
      orgId
    );
    if (!result.ok) {
      const code = result.reason === "run_is_draft" ? 409 : 404;
      return res.status(code).json({ error: result.reason });
    }
    res.json({ ok: true, sentTo: result.email });
  }
);

router.post("/:id/email-all", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const orgOid = new Types.ObjectId(orgId);
  const run = await TeamforcePayrollRun.findOne({
    _id: req.params.id,
    orgId: orgOid,
  }).lean();
  if (!run) return res.status(404).json({ error: "Run not found" });
  if (run.status === "DRAFT")
    return res.status(409).json({ error: "Cannot email DRAFT slips" });

  const txns = await TeamforcePayrollTransaction.find({
    runId: run._id,
  }).select("_id").lean();

  let sent = 0;
  const failures: Array<{ txId: string; reason: string }> = [];
  for (const t of txns) {
    const result = await emailOneTransaction(
      String(run._id),
      String(t._id),
      orgId
    );
    if (result.ok) sent += 1;
    else failures.push({ txId: String(t._id), reason: result.reason });
  }
  res.json({ ok: true, sent, total: txns.length, failures });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireTeamforceWriteAccess(req, res))) return;

  const run = await TeamforcePayrollRun.findOne({
    _id: req.params.id,
    orgId: new Types.ObjectId(orgId),
  });
  if (!run) return res.status(404).json({ error: "Run not found" });
  if (run.status !== "DRAFT") {
    return res
      .status(409)
      .json({ error: "Only DRAFT runs can be deleted" });
  }

  await TeamforcePayrollTransaction.deleteMany({ runId: run._id });
  await TeamforcePayrollRun.deleteOne({ _id: run._id });
  res.json({ ok: true });
});

export default router;
