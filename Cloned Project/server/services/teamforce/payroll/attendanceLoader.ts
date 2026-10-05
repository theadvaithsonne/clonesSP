/**
 * Database loader for attendance aggregation. The pure aggregator in
 * `attendance.ts` deliberately takes pre-fetched data so it stays testable
 * — this module is the impure adapter that converts DB rows into the
 * aggregator's input shape.
 */

import { Types } from "mongoose";
import { TimeTracking } from "../../../models/timeTracking.model";
import { TeamforceLeaveRequest } from "../../../models/teamforce/teamforceLeaveRequest.model";
import { TeamforceEmployeeProfile } from "../../../models/teamforce/teamforceEmployeeProfile.model";
import { TeamforceWeeklyOffPattern } from "../../../models/teamforce/teamforceWeeklyOffPattern.model";
import { getAttendanceWindow, type ApprovedLeaveRow } from "./attendance";

export interface LoadedAttendanceData {
  doj: Date | null;
  weeklyOffDays: number[];
  approvedLeaves: ApprovedLeaveRow[];
  presentDates: Set<string>;
  deferredLopFromPrevCycle: number;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Loads everything the aggregator needs for one (employee, payroll month).
 *  Also pulls the full grace tail (joining_date → month_end) so the
 *  aggregator can compute deferredLopForNextCycle in joining months. */
export async function loadAttendanceForRun(
  userId: string,
  orgId: string,
  payrollMonth: number,
  payrollYear: number,
  cutoffDay: number
): Promise<LoadedAttendanceData> {
  const userOid = new Types.ObjectId(userId);
  const orgOid = new Types.ObjectId(orgId);

  const profile = await TeamforceEmployeeProfile.findOne({
    userId: userOid,
    orgId: orgOid,
  })
    .select("dateOfJoining weeklyOffPatternId deferredLopDays")
    .lean();

  const doj = profile?.dateOfJoining
    ? new Date(profile.dateOfJoining as Date)
    : null;
  const deferredLopFromPrevCycle = Number(profile?.deferredLopDays || 0);

  let weeklyOffDays: number[] = [];
  if (profile?.weeklyOffPatternId) {
    const pattern = await TeamforceWeeklyOffPattern.findOne({
      _id: profile.weeklyOffPatternId,
      orgId: orgOid,
    })
      .select("offDays")
      .lean();
    if (pattern && Array.isArray(pattern.offDays)) {
      weeklyOffDays = pattern.offDays as number[];
    }
  }

  const { start: windowStart, end: windowEnd } = getAttendanceWindow(
    payrollMonth,
    payrollYear,
    cutoffDay
  );

  // For joining months, also include the grace-tail period (DOJ → month-end)
  // beyond windowEnd so the aggregator can compute deferred LOP.
  const monthEnd = new Date(payrollYear, payrollMonth, 0, 23, 59, 59, 999);
  const isJoiningMonth =
    !!doj &&
    doj.getMonth() + 1 === payrollMonth &&
    doj.getFullYear() === payrollYear;
  const queryEnd =
    isJoiningMonth && doj && doj.getDate() > cutoffDay ? monthEnd : windowEnd;
  const queryStart =
    isJoiningMonth && doj && doj.getTime() < windowStart.getTime()
      ? doj
      : windowStart;

  // Approved leaves intersecting [queryStart, queryEnd].
  const leaveRows = await TeamforceLeaveRequest.find({
    userId: userOid,
    orgId: orgOid,
    status: "Approved",
    startDate: { $lte: queryEnd },
    endDate: { $gte: queryStart },
  })
    .select("startDate endDate isHalfDay")
    .lean();

  const approvedLeaves: ApprovedLeaveRow[] = leaveRows.map((l: any) => ({
    startDate: new Date(l.startDate),
    endDate: new Date(l.endDate),
    isHalfDay: !!l.isHalfDay,
  }));

  // TimeTracking: any session with a clock-in inside the period counts that
  // calendar day as "present".
  const ttRows = await TimeTracking.find({
    userId: userOid,
    orgId: orgOid,
    clockInTime: { $gte: queryStart, $lte: queryEnd },
  })
    .select("clockInTime")
    .lean();

  const presentDates = new Set<string>();
  for (const t of ttRows) {
    presentDates.add(ymd(new Date(t.clockInTime as Date)));
  }

  return {
    doj,
    weeklyOffDays,
    approvedLeaves,
    presentDates,
    deferredLopFromPrevCycle,
  };
}

/** Resets the carry-over slot on the profile after a payroll run consumes it,
 *  and writes the new deferred amount (0 for normal months, > 0 in grace months).
 *  Called by the Phase 5 PayrollRun pipeline after a successful run. */
export async function persistDeferredLop(
  userId: string,
  orgId: string,
  newDeferredLopDays: number
): Promise<void> {
  await TeamforceEmployeeProfile.updateOne(
    {
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    },
    { $set: { deferredLopDays: Math.max(0, newDeferredLopDays) } }
  );
}
