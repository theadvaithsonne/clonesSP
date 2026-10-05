/**
 * IANA-timezone arithmetic built on `Intl` alone — no date library.
 *
 * Workshops store their schedule as a calendar date plus a wall-clock
 * "HH:MM" string interpreted in the host's timezone. Turning that back into
 * a real instant needs the UTC offset *at that moment*, which shifts across
 * DST boundaries, so a fixed offset is never correct.
 */

/**
 * UTC offset of `timeZone` at the instant `date`, in milliseconds.
 * Positive east of Greenwich (e.g. +19800000 for IST).
 */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;

  // `hour` comes back as "24" at midnight in some ICU builds.
  const hour = Number(parts.hour) % 24;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );

  // Zero out sub-second noise so repeated calls are stable.
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Calendar Y/M/D of `date` as observed in `timeZone`. */
export function ymdInTimeZone(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number } {
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)) {
    parts[p.type] = p.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

/**
 * Instant at which the wall clock in `timeZone` reads
 * `year-month-day hour:minute`.
 *
 * Solved by fixed-point iteration: guess the offset from the naive UTC
 * interpretation, correct, then correct once more so a DST transition
 * between the guess and the answer resolves. Ambiguous local times (the
 * repeated hour when clocks fall back) settle on the first occurrence.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  let ts = naive - timeZoneOffsetMs(new Date(naive), timeZone);
  ts = naive - timeZoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

/** Parses "HH:MM" / "H:MM" / "HH:MM:SS" into `{hour, minute}`; null when unparseable. */
export function parseWallClock(
  value?: string | null
): { hour: number; minute: number } | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** Parses "YYYY-MM-DD" into its calendar parts; null when unparseable. */
export function parseCalendarDate(
  value?: string | null
): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}
