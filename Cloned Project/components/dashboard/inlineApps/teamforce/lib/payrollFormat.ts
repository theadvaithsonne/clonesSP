/**
 * Shared formatters for the payroll UI. Tiny module so PayrollSection,
 * SalarySlipDrawer and MySalarySlipsSection don't duplicate these.
 */

export const INR = (n: number): string =>
  "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function fmtDate(s: string | Date | undefined | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const FY_MONTHS_LABELS = [
  "Apr", "May", "Jun", "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
];

export function fyMonthLabel(fyMonth: number, fyYear: number): string {
  const yr = fyMonth >= 10 ? fyYear + 1 : fyYear;
  return `${FY_MONTHS_LABELS[fyMonth - 1]} ${yr}`;
}
