/**
 * Add N months, clamping to the last valid day of the target month.
 *
 * Native `setMonth` overflows: Aug 31 + 6 months lands on Mar 3, not Feb 28.
 * At 1-month intervals that quirk is pre-existing and rare; at 6/12-month
 * intervals it becomes a visible billing-date defect, so multi-month terms
 * clamp instead.
 *
 * Lives in a leaf module (no model or service imports) so both the invoice
 * service and the third-party term pricing can use it without a cycle.
 */
export function addMonthsClamped(from: Date, months: number): Date {
  const date = new Date(from);
  const targetDay = date.getDate();
  // Move to the 1st first so the intermediate value can never overflow.
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  // Last day of the now-current month.
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(targetDay, lastDay));
  return date;
}
