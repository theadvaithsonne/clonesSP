import { IRecurrencePattern } from "../models/workshop.model";

export interface WorkshopSession {
  date: Date; // The session date (midnight)
  startDateTime: Date; // Full start datetime
  endDateTime: Date; // Full end datetime
  isPast: boolean;
  isToday: boolean;
  dateString: string; // ISO date string (YYYY-MM-DD)
}

/**
 * Check if two dates are the same day (UTC)
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

/**
 * Get start of day for a date (UTC)
 */
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day for a date (UTC)
 */
function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}

/**
 * Every weekday a weekly pattern runs on. `daysOfWeek` wins when present;
 * otherwise the singular `dayOfWeek` is the one and only day, which is what
 * every series predating multi-day selection carries.
 */
function weeklyDays(pattern: IRecurrencePattern): number[] {
  if (pattern.daysOfWeek?.length) return pattern.daysOfWeek;
  return pattern.dayOfWeek === undefined ? [] : [pattern.dayOfWeek];
}

/** Same rule for monthly. Defaults to the 1st when nothing is set, matching
 *  the previous `pattern.dayOfMonth || 1`. */
function monthlyDays(pattern: IRecurrencePattern): number[] {
  if (pattern.daysOfMonth?.length) return pattern.daysOfMonth;
  return [pattern.dayOfMonth || 1];
}

/** True when a pattern lists more than one day, and the cheap "+7 days" /
 *  "+1 month" stepping below would skip over the other days in the set. */
function isMultiDay(pattern: IRecurrencePattern): boolean {
  if (pattern.type === "weekly") return (pattern.daysOfWeek?.length || 0) > 1;
  if (pattern.type === "monthly") return (pattern.daysOfMonth?.length || 0) > 1;
  return false;
}

/**
 * Check if a date matches the recurrence pattern (UTC)
 */
function isSessionDate(date: Date, pattern: IRecurrencePattern): boolean {
  const dayOfWeek = date.getUTCDay();
  const dayOfMonth = date.getUTCDate();

  switch (pattern.type) {
    case "daily":
      // Check if day is not in excluded days
      return !pattern.excludedDays?.includes(dayOfWeek);

    case "weekly":
      return weeklyDays(pattern).includes(dayOfWeek);

    case "monthly": {
      // Handle months with fewer days (e.g., Feb 30 -> use last day of month)
      const lastDayOfMonth = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
      ).getUTCDate();
      // Two selected days can clamp onto the same short-month day (30 and 31
      // both land on Feb 28), which is one session, not two — `some` gives
      // that for free.
      return monthlyDays(pattern).some(
        (d) => dayOfMonth === Math.min(d, lastDayOfMonth)
      );
    }

    default:
      return false;
  }
}

/**
 * Get the next candidate date based on recurrence type
 *
 * The +7 / +1-month jumps are an optimisation that only holds while a pattern
 * has ONE day in it: from a Monday, +7 is the next Monday. With Mon+Wed+Fri
 * selected it would step Monday to Monday forever and never emit Wed or Fri,
 * so multi-day patterns walk a day at a time and let `isSessionDate` filter.
 */
function getNextCandidateDate(date: Date, pattern: IRecurrencePattern): Date {
  const next = new Date(date);

  if (isMultiDay(pattern)) {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  switch (pattern.type) {
    case "daily":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }

  return next;
}

/**
 * Get the UTC offset in minutes for a given IANA timezone at a specific date.
 * Positive means ahead of UTC (e.g., IST = +330), negative means behind (e.g., EST = -300).
 */
export function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone: timezone });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

/**
 * Format date as YYYY-MM-DD string
 */
function formatDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculate upcoming sessions for a recurring workshop
 * @param recurrencePattern - The recurrence configuration
 * @param recurrenceStartDate - When recurrence begins
 * @param startTime - Workshop start time (HH:mm) in the workshop's timezone
 * @param endTime - Workshop end time (HH:mm) in the workshop's timezone
 * @param fromDate - Calculate sessions from this date (default: now)
 * @param limit - Maximum number of sessions to return
 * @param includePast - Include past sessions
 * @param timezone - IANA timezone of the workshop (e.g., "Asia/Kolkata")
 */
export function calculateSessions(
  recurrencePattern: IRecurrencePattern,
  recurrenceStartDate: Date,
  startTime: string,
  endTime: string,
  fromDate: Date = new Date(),
  limit: number = 10,
  includePast: boolean = false,
  timezone?: string,
  // Bound for per_session workshops — stop emitting once we've moved past
  // the end date (inclusive of the day). Undefined = unbounded (legacy /
  // enrol-once / non-recurring paths keep today's behaviour).
  recurrenceEndDate?: Date
): WorkshopSession[] {
  const sessions: WorkshopSession[] = [];
  const now = new Date();

  // Start from recurrenceStartDate or fromDate, whichever is later
  // Unless includePast is true, then use recurrenceStartDate
  let startPoint: Date;
  if (includePast) {
    startPoint = new Date(recurrenceStartDate);
  } else {
    startPoint = new Date(
      Math.max(recurrenceStartDate.getTime(), startOfDay(fromDate).getTime())
    );
  }

  // Determine "today" in the workshop's timezone, not UTC.
  // Without this, a session at 8 PM EDT on Wednesday would be skipped when
  // now is 11:30 PM EDT (which is already Thursday UTC), causing the webinar
  // to appear as "next day" before its end time in the local timezone.
  let currentDate: Date;
  if (timezone && !includePast) {
    const nowInTz = new Date(
      now.toLocaleString("en-US", { timeZone: timezone })
    );
    const tzToday = new Date(
      Date.UTC(nowInTz.getFullYear(), nowInTz.getMonth(), nowInTz.getDate())
    );
    // Use timezone-aware "today" instead of UTC "today", but still respect recurrenceStartDate
    currentDate = new Date(
      Math.max(startOfDay(new Date(recurrenceStartDate)).getTime(), tzToday.getTime())
    );
  } else {
    currentDate = startOfDay(startPoint);
  }

  // For weekly/monthly, we need to find the first valid date from currentDate
  if (
    recurrencePattern.type === "weekly" ||
    recurrencePattern.type === "monthly"
  ) {
    // Find the first valid session date
    let maxSearch = recurrencePattern.type === "weekly" ? 7 : 31;
    let found = false;
    for (let i = 0; i < maxSearch && !found; i++) {
      if (isSessionDate(currentDate, recurrencePattern)) {
        found = true;
      } else {
        // setUTCDate, not setDate: `currentDate` is a UTC-midnight anchor, and
        // stepping it in local time on a server west of UTC would move it to
        // local midnight — i.e. off the anchor by the zone's offset.
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
    }
  }

  const maxIterations = 365 * 2; // Safety: max 2 years lookahead
  let iterations = 0;

  // Precompute the end-of-day cutoff so we can stop the loop cleanly once
  // we walk past the bound. Comparing at start-of-day would drop the last
  // valid day if the end date IS a valid session day.
  const endBound = recurrenceEndDate
    ? endOfDay(new Date(recurrenceEndDate))
    : null;

  while (sessions.length < limit && iterations < maxIterations) {
    iterations++;

    if (endBound && currentDate > endBound) break;

    const isValidSession = isSessionDate(currentDate, recurrencePattern);

    if (isValidSession) {
      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);

      const startDateTime = new Date(currentDate);
      startDateTime.setUTCHours(startH, startM, 0, 0);

      const endDateTime = new Date(currentDate);
      endDateTime.setUTCHours(endH, endM, 0, 0);

      // Handle case where end time is past midnight (next day)
      if (endDateTime <= startDateTime) {
        endDateTime.setUTCDate(endDateTime.getUTCDate() + 1);
      }

      // Adjust for timezone: startTime/endTime are in the workshop's timezone,
      // but setUTCHours() sets them as if they were UTC. Subtract the timezone
      // offset so the resulting UTC timestamps represent the correct moment.
      // e.g., 20:00 EDT (UTC-4) → setUTCHours(20) = 20:00 UTC, offset = -240,
      //        20:00 UTC - (-240min) = 20:00 UTC + 4h = 00:00 UTC next day ✓
      if (timezone) {
        const offset = getTimezoneOffsetMinutes(startDateTime, timezone);
        startDateTime.setMinutes(startDateTime.getMinutes() - offset);
        endDateTime.setMinutes(endDateTime.getMinutes() - offset);
      }

      const isPast = endDateTime < now;
      // Check "today" in the workshop's timezone, not UTC.
      // Without this, a session at 8 PM HKT on March 20 would be considered
      // "today" even when it's already March 21 in HKT (but still March 20 UTC).
      let isToday: boolean;
      if (timezone) {
        const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
        const sessionDateInTz = new Date(currentDate.toLocaleString("en-US", { timeZone: timezone }));
        isToday = nowInTz.getFullYear() === sessionDateInTz.getFullYear() &&
          nowInTz.getMonth() === sessionDateInTz.getMonth() &&
          nowInTz.getDate() === sessionDateInTz.getDate();
      } else {
        isToday = isSameDay(currentDate, now);
      }

      // Skip past sessions unless explicitly requested.
      // For today's sessions: only keep them if they haven't ended yet (live or upcoming).
      // A session that ended today should be skipped so the next future session is returned.
      const isLiveOrUpcoming = now < endDateTime;
      if (!includePast && isPast && (!isToday || !isLiveOrUpcoming)) {
        currentDate = getNextCandidateDate(currentDate, recurrencePattern);
        continue;
      }

      sessions.push({
        date: new Date(currentDate),
        startDateTime,
        endDateTime,
        isPast,
        isToday,
        dateString: formatDateString(currentDate),
      });
    }

    currentDate = getNextCandidateDate(currentDate, recurrencePattern);
  }

  return sessions;
}

/**
 * Get the next session from now
 */
export function getNextSession(
  recurrencePattern: IRecurrencePattern,
  recurrenceStartDate: Date,
  startTime: string,
  endTime: string,
  timezone?: string,
  recurrenceEndDate?: Date
): WorkshopSession | null {
  const sessions = calculateSessions(
    recurrencePattern,
    recurrenceStartDate,
    startTime,
    endTime,
    new Date(),
    1,
    false,
    timezone,
    recurrenceEndDate
  );
  return sessions[0] || null;
}

/**
 * Check if a given date is a valid session date according to the recurrence pattern
 */
export function isValidSessionDate(
  sessionDate: Date,
  recurrencePattern: IRecurrencePattern,
  recurrenceStartDate: Date,
  recurrenceEndDate?: Date
): boolean {
  // Session must be on or after recurrence start
  if (sessionDate < startOfDay(recurrenceStartDate)) {
    return false;
  }

  // Bound for per_session workshops — reject anything past the end date.
  // Callers on unbounded (legacy / enrol-once) paths pass undefined and
  // this check is a no-op.
  if (recurrenceEndDate && sessionDate > endOfDay(recurrenceEndDate)) {
    return false;
  }

  return isSessionDate(sessionDate, recurrencePattern);
}

/**
 * Generate a unique session identifier for per-session enrollments
 */
export function generateSessionId(
  workshopId: string,
  sessionDate: Date
): string {
  const dateStr = formatDateString(sessionDate);
  return `${workshopId}_${dateStr}`;
}

/**
 * Parse a session ID back to workshopId and date
 */
export function parseSessionId(
  sessionId: string
): { workshopId: string; dateString: string } | null {
  const parts = sessionId.split("_");
  if (parts.length < 2) return null;

  const dateString = parts.pop()!;
  const workshopId = parts.join("_");

  return { workshopId, dateString };
}

/**
 * Get start of day for a date string (YYYY-MM-DD)
 */
export function parseSessionDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export { startOfDay, endOfDay, isSameDay, formatDateString };
