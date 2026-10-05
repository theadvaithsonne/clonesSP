/**
 * Client-side mirror of the server's recurrence walk (see
 * `roam-backend/src/utils/recurrence.ts`).
 *
 * It exists so a founder can SEE the sessions a rule will produce while they
 * are still editing the rule — before any workshop document exists to ask the
 * backend about. The server stays the authority: nothing computed here is
 * persisted, and every session that is edited is written back through
 * `updateWorkshopSession` keyed by the same canonical day.
 *
 * EVERYTHING HERE IS UTC. A session's identity is the UTC midnight of the day
 * the rule produced — that's the key registrations, orders and room routing
 * use — so the walk is done on `YYYY-MM-DD` strings and UTC accessors. Using
 * local dates would shift half the world's sessions by a day.
 */

export interface ClientRecurrencePattern {
  type: "daily" | "weekly" | "monthly";
  /** Daily only: weekdays the series skips (0 = Sunday). */
  excludedDays?: number[];
  /** Weekly, single-day. Superseded by `daysOfWeek` when that is set. */
  dayOfWeek?: number;
  /** Monthly, single-date. Superseded by `daysOfMonth` when that is set. */
  dayOfMonth?: number;
  /** Weekly, multi-day. */
  daysOfWeek?: number[];
  /** Monthly, multi-date. */
  daysOfMonth?: number[];
}

/** Every weekday a weekly rule runs on. Falls back to the singular field, so
 *  series created before multi-day selection read identically. */
export function weeklyDays(pattern: ClientRecurrencePattern): number[] {
  if (pattern.daysOfWeek?.length) return [...pattern.daysOfWeek].sort((a, b) => a - b);
  return pattern.dayOfWeek === undefined ? [] : [pattern.dayOfWeek];
}

/** Every date-of-month a monthly rule runs on. Defaults to the 1st, matching
 *  the server's `pattern.dayOfMonth || 1`. */
export function monthlyDays(pattern: ClientRecurrencePattern): number[] {
  if (pattern.daysOfMonth?.length) return [...pattern.daysOfMonth].sort((a, b) => a - b);
  return [pattern.dayOfMonth || 1];
}

/** "2026-09-17" → Date at 2026-09-17T00:00:00.000Z. */
export function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

/** Date → "YYYY-MM-DD", read in UTC. */
export function utcDateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Does this day satisfy the rule? Mirrors the server's `isSessionDate`,
 *  including the short-month clamp (the 31st runs on Feb 28). */
export function matchesPattern(
  date: Date,
  pattern: ClientRecurrencePattern,
): boolean {
  const dow = date.getUTCDay();
  const dom = date.getUTCDate();

  switch (pattern.type) {
    case "daily":
      return !pattern.excludedDays?.includes(dow);
    case "weekly":
      return weeklyDays(pattern).includes(dow);
    case "monthly": {
      const lastDay = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
      ).getUTCDate();
      // Two selected dates can clamp onto the same short-month day (30 and 31
      // are both Feb 28) — that's one session, which `some` gives for free.
      return monthlyDays(pattern).some((d) => dom === Math.min(d, lastDay));
    }
    default:
      return false;
  }
}

/**
 * Every session day a rule produces, as `YYYY-MM-DD`, inclusive of both bounds.
 *
 * Walks a day at a time rather than jumping by week/month: with several days
 * selected the jump would step Monday-to-Monday forever and never emit the
 * other days. `limit` is the same 500 the server's sessions endpoint caps at,
 * and `maxDays` bounds the walk at the server's two-year lookahead.
 */
export function computeSessionDays(opts: {
  pattern: ClientRecurrencePattern;
  /** yyyy-mm-dd, inclusive. */
  startDate: string;
  /** yyyy-mm-dd, inclusive. Blank/absent walks to the day cap. */
  endDate?: string;
  limit?: number;
  maxDays?: number;
}): string[] {
  const { pattern, startDate, endDate, limit = 500, maxDays = 730 } = opts;
  if (!startDate) return [];

  const cursor = ymdToUtcDate(startDate);
  if (Number.isNaN(cursor.getTime())) return [];

  const end = endDate ? ymdToUtcDate(endDate) : null;
  if (end && Number.isNaN(end.getTime())) return [];

  const days: string[] = [];
  for (let i = 0; i < maxDays && days.length < limit; i++) {
    if (end && cursor.getTime() > end.getTime()) break;
    if (matchesPattern(cursor, pattern)) days.push(utcDateToYmd(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Natural-language list: "Mon", "Mon and Wed", "Mon, Wed and Fri". */
function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] || "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "Every day", "Every Monday and Wednesday", "Monthly on the 1st and 15th" —
 *  a one-line summary of the rule, for headers and preview captions. */
export function describePattern(pattern: ClientRecurrencePattern): string {
  switch (pattern.type) {
    case "daily": {
      const skipped = [...(pattern.excludedDays || [])].sort((a, b) => a - b);
      return skipped.length
        ? `Every day except ${joinWithAnd(skipped.map((d) => DAY_LABELS[d]))}`
        : "Every day";
    }
    case "weekly": {
      const days = weeklyDays(pattern);
      return days.length
        ? `Every ${joinWithAnd(days.map((d) => DAY_LABELS[d]))}`
        : "Every week";
    }
    case "monthly": {
      const days = monthlyDays(pattern);
      return `Monthly on the ${joinWithAnd(days.map(ordinal))}`;
    }
    default:
      return "";
  }
}

export { DAY_LABELS as RECURRENCE_DAY_LABELS, ordinal as ordinalDay };
