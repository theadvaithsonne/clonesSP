/**
 * Attendance aggregation — feeds the payroll engine. Spec §3.1–§3.3.
 *
 * Exports:
 *   - getAttendanceWindow(payMonth, payYear, cutoffDay): { start, end }
 *   - aggregateForEmployee(input): full per-employee breakdown for the run
 *
 * Both functions are PURE — no DB calls. The Phase 5 PayrollRun pipeline
 * fetches the raw attendance data and passes it in.
 *
 * LOP rule (Phase 4): a "loss of pay" day is any calendar day in the
 * attendance window where the employee:
 *   - is NOT on an Approved leave request, AND
 *   - has NO TimeTracking clock-in for that calendar day, AND
 *   - is NOT on a scheduled weekly-off
 * Half-day approved leaves count as 0.5 paid leave + 0.5 LOP-eligible (so the
 * other half day still counts as present iff there's a clock-in).
 *
 * Grace window (joining-month) handling per spec §3.3:
 *   - If joining_date.day > cutoff_day, the employee enters the grace window.
 *   - Grace tail = doj → end of joining month. PAID IN FULL (no LOP applied).
 *   - LOP days inside the grace tail are tracked as `deferredLopForNextCycle`
 *     and recovered in the NEXT payroll cycle.
 */

import { calendarDaysInMonth } from "./fyHelpers";

export interface ApprovedLeaveRow {
  startDate: Date; // inclusive
  endDate: Date; // inclusive
  isHalfDay: boolean;
}

export interface AttendanceWindow {
  start: Date; // inclusive 00:00 of cutoff_day+1, previous month
  end: Date; // inclusive 23:59 of cutoff_day, current pay month
}

/** Returns the attendance window for a given pay month + cutoff day.
 *  When cutoffDay = 1 the window is the full prior calendar month
 *  (no mid-month split — easiest for callers to reason about). */
export function getAttendanceWindow(
  payMonth: number, // 1..12
  payYear: number,
  cutoffDay: number
): AttendanceWindow {
  if (cutoffDay < 1 || cutoffDay > 28) {
    throw new Error(`cutoffDay must be in [1, 28], got ${cutoffDay}`);
  }

  if (cutoffDay === 1) {
    // Window = full PREVIOUS calendar month, 1st → last day.
    const prevMonth = payMonth === 1 ? 12 : payMonth - 1;
    const prevYear = payMonth === 1 ? payYear - 1 : payYear;
    const start = new Date(prevYear, prevMonth - 1, 1, 0, 0, 0, 0);
    const lastDay = calendarDaysInMonth(prevMonth, prevYear);
    const end = new Date(prevYear, prevMonth - 1, lastDay, 23, 59, 59, 999);
    return { start, end };
  }

  // Window ends on cutoff_day of pay month (23:59).
  const end = new Date(payYear, payMonth - 1, cutoffDay, 23, 59, 59, 999);

  // Window starts on (cutoff_day + 1) of the PREVIOUS calendar month.
  const prevMonth = payMonth === 1 ? 12 : payMonth - 1;
  const prevYear = payMonth === 1 ? payYear - 1 : payYear;
  const start = new Date(prevYear, prevMonth - 1, cutoffDay + 1, 0, 0, 0, 0);
  return { start, end };
}

export interface AttendanceAggregateInput {
  payrollMonth: number; // calendar month 1..12
  payrollYear: number;
  cutoffDay: number;
  /** Employee's date of joining; null if loaded but unknown. */
  doj: Date | null;
  /** Weekly off days as Sunday=0..Saturday=6. */
  weeklyOffDays: number[];
  /** Approved leaves intersecting the window (or grace tail). */
  approvedLeaves: ApprovedLeaveRow[];
  /** YYYY-MM-DD strings — calendar days the employee clocked in at all. */
  presentDates: Set<string>;
  /** Carried over from previous payroll's grace tail; consumed here. */
  deferredLopFromPrevCycle: number;
}

export interface AttendanceAggregateResult {
  windowStart: Date;
  windowEnd: Date;
  windowCalendarDays: number;
  daysEmployeeInWindow: number;
  daysPresentInWindow: number;
  paidLeaveDaysInWindow: number;
  lopDaysInWindow: number;
  scheduledOffDaysInWindow: number;

  /** = (daysPresent + paidLeave + scheduledOff − deferredLopApplied) / calendarDaysInPayMonth.
   *  Caller multiplies this against monthly_gross to get prorated salary. */
  attendanceFactor: number;

  /** Total LOP days deducted in this run = lopDaysInWindow + deferredLopFromPrevCycle. */
  lopDaysApplied: number;
  deferredLopApplied: number;

  // Joining-month grace window (only non-zero in joining month)
  isJoiningMonth: boolean;
  inGraceWindow: boolean;
  graceTailDays: number;
  graceTailLopDays: number;
  graceTailFactor: number; // graceTailDays / calendar days in pay month
  /** Consumed (reset to 0) by next month's payroll. */
  deferredLopForNextCycle: number;

  warnings: string[];
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function eachDayBetween(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur.getTime() <= last.getTime()) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** True if `day` falls within an approved-leave row (inclusive). */
function leaveCoversDay(row: ApprovedLeaveRow, day: Date): boolean {
  const s = new Date(
    row.startDate.getFullYear(),
    row.startDate.getMonth(),
    row.startDate.getDate()
  );
  const e = new Date(
    row.endDate.getFullYear(),
    row.endDate.getMonth(),
    row.endDate.getDate()
  );
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return d.getTime() >= s.getTime() && d.getTime() <= e.getTime();
}

/** Returns the leave "weight" (1 = full day, 0.5 = half day, 0 = no leave). */
function leaveWeightForDay(
  leaves: ApprovedLeaveRow[],
  day: Date
): number {
  let weight = 0;
  for (const row of leaves) {
    if (leaveCoversDay(row, day)) {
      // Half-day requests cap weight at 0.5; multiple stacked leaves are
      // treated as additive but never exceed 1.
      weight += row.isHalfDay ? 0.5 : 1;
      if (weight >= 1) return 1;
    }
  }
  return weight;
}

export function aggregateForEmployee(
  input: AttendanceAggregateInput
): AttendanceAggregateResult {
  const warnings: string[] = [];
  const { start: windowStart, end: windowEnd } = getAttendanceWindow(
    input.payrollMonth,
    input.payrollYear,
    input.cutoffDay
  );

  const allDays = eachDayBetween(windowStart, windowEnd);
  const windowCalendarDays = allDays.length;

  // Determine the slice of the window during which the employee is "in role".
  let effectiveStart = windowStart;
  let inFutureForJoiner = false;
  if (input.doj) {
    if (input.doj.getTime() > windowEnd.getTime()) {
      // DOJ after window end → employee not on payroll for this cycle.
      inFutureForJoiner = true;
    } else if (input.doj.getTime() > windowStart.getTime()) {
      effectiveStart = input.doj;
    }
  }

  let daysPresentInWindow = 0;
  let paidLeaveDaysInWindow = 0;
  let lopDaysInWindow = 0;
  let scheduledOffDaysInWindow = 0;

  if (!inFutureForJoiner) {
    const employeeDays = eachDayBetween(effectiveStart, windowEnd);
    for (const day of employeeDays) {
      // Scheduled weekly off?
      if (input.weeklyOffDays.includes(day.getDay())) {
        scheduledOffDaysInWindow += 1;
        continue;
      }

      const leaveWeight = leaveWeightForDay(input.approvedLeaves, day);
      const present = input.presentDates.has(ymd(day));

      if (leaveWeight >= 1) {
        paidLeaveDaysInWindow += 1;
      } else if (leaveWeight === 0.5) {
        paidLeaveDaysInWindow += 0.5;
        // The other half: present (clocked in) → 0.5 present; else 0.5 LOP
        if (present) daysPresentInWindow += 0.5;
        else lopDaysInWindow += 0.5;
      } else {
        if (present) daysPresentInWindow += 1;
        else lopDaysInWindow += 1;
      }
    }
  }

  const daysEmployeeInWindow = inFutureForJoiner
    ? 0
    : eachDayBetween(effectiveStart, windowEnd).length;

  // ── Grace window (joining month only) ─────────────────────────────
  const isJoiningMonth =
    !!input.doj &&
    input.doj.getMonth() + 1 === input.payrollMonth &&
    input.doj.getFullYear() === input.payrollYear;
  const inGraceWindow =
    isJoiningMonth && !!input.doj && input.doj.getDate() > input.cutoffDay;

  let graceTailDays = 0;
  let graceTailLopDays = 0;
  let graceTailFactor = 0;
  let deferredLopForNextCycle = 0;

  if (isJoiningMonth && inGraceWindow && input.doj) {
    const monthEnd = new Date(
      input.payrollYear,
      input.payrollMonth - 1,
      calendarDaysInMonth(input.payrollMonth, input.payrollYear),
      23,
      59,
      59,
      999
    );
    const tailDays = eachDayBetween(input.doj, monthEnd);
    graceTailDays = tailDays.length;
    for (const day of tailDays) {
      if (input.weeklyOffDays.includes(day.getDay())) continue;
      const leaveWeight = leaveWeightForDay(input.approvedLeaves, day);
      const present = input.presentDates.has(ymd(day));
      if (leaveWeight >= 1 || present) continue;
      if (leaveWeight === 0.5) {
        if (!present) graceTailLopDays += 0.5;
      } else {
        graceTailLopDays += 1;
      }
    }
    graceTailFactor =
      graceTailDays /
      calendarDaysInMonth(input.payrollMonth, input.payrollYear);
    deferredLopForNextCycle = graceTailLopDays;
  }

  // ── Cycle pay attendance factor ──────────────────────────────────
  const calendarDaysPayMonth = calendarDaysInMonth(
    input.payrollMonth,
    input.payrollYear
  );
  const deferredLopApplied = Math.max(0, input.deferredLopFromPrevCycle);
  const lopDaysApplied = lopDaysInWindow + deferredLopApplied;

  // Attendance factor = effective worked days (present + paid leave + scheduled off)
  // minus deferred LOP, divided by calendar days in pay month.
  // Per spec §3.1 the denominator is FIXED at calendar days; presence + paid
  // leave + weekly off all "count as paid" days, so the numerator is
  // window_employee_days − lop_days_in_window − deferred_lop.
  const numerator = Math.max(
    0,
    daysEmployeeInWindow - lopDaysInWindow - deferredLopApplied
  );
  let attendanceFactor = numerator / calendarDaysPayMonth;

  if (isJoiningMonth && inGraceWindow) {
    // In the joining month, cycle pay = 0 (employee was not in the prior
    // window). The grace tail is paid as a separate line item (graceTailFactor).
    attendanceFactor = 0;
    if (lopDaysInWindow > 0) {
      warnings.push(
        "Grace-window joiner: LOP in main window ignored (employee was not on payroll yet)."
      );
    }
  }

  if (inFutureForJoiner) {
    warnings.push("Date of joining is after this cycle's window — payroll = 0.");
  }
  if (!input.doj) {
    warnings.push("Employee dateOfJoining missing — assuming employee was present for the full window.");
  }

  return {
    windowStart,
    windowEnd,
    windowCalendarDays,
    daysEmployeeInWindow,
    daysPresentInWindow,
    paidLeaveDaysInWindow,
    lopDaysInWindow,
    scheduledOffDaysInWindow,
    attendanceFactor,
    lopDaysApplied,
    deferredLopApplied,
    isJoiningMonth,
    inGraceWindow,
    graceTailDays,
    graceTailLopDays,
    graceTailFactor,
    deferredLopForNextCycle,
    warnings,
  };
}
