/**
 * Indian Financial Year helpers. FY runs April 1 → March 31.
 * Calendar month 4 (April) is FY month 1; calendar month 3 (March) is FY month 12.
 */

/** Returns "2024-25" for April 2024 → March 2025. */
export function getFYString(calendarMonth: number, calendarYear: number): string {
  const startYear = calendarMonth >= 4 ? calendarYear : calendarYear - 1;
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${String(endYear).padStart(2, "0")}`;
}

/** April → 1, May → 2, …, March → 12. */
export function getFYMonth(calendarMonth: number): number {
  return calendarMonth >= 4 ? calendarMonth - 3 : calendarMonth + 9;
}

export function getRemainingMonthsInFY(calendarMonth: number): number {
  return 12 - getFYMonth(calendarMonth) + 1;
}

/** Calendar days in a given month of a given year (handles leap Feb). */
export function calendarDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/** True iff the current pay-month is February. Used by Maharashtra PT override. */
export function isFebruary(calendarMonth: number): boolean {
  return calendarMonth === 2;
}

/** Whole-year age as of a given reference date (defaults to today).
 *  Returns 0 when no DOB is supplied — caller should pick a sensible default. */
export function ageOnDate(
  dateOfBirth: Date | null | undefined,
  asOf: Date = new Date()
): number {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  let age = asOf.getFullYear() - dob.getFullYear();
  const m = asOf.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < dob.getDate())) age -= 1;
  return Math.max(0, age);
}
