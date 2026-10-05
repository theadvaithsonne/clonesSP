"use client";

import { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Check,
  Pencil,
  AlertTriangle,
  Printer,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { overridePayrollTransaction, emailPayrollSlip } from "../api";
import type { PayrollTransaction, PayrollRun } from "../types";
import { INR, fyMonthLabel } from "../lib/payrollFormat";
import InfoCard from "../lib/InfoCard";

interface SalarySlipDrawerProps {
  tx: PayrollTransaction;
  /** Optional run context; used by the printable HTML for header info. */
  run?: PayrollRun | null;
  /** When false, the override section is hidden. */
  editable: boolean;
  onClose: () => void;
  /** Called after a successful override save; not invoked in read-only mode. */
  onSaved?: (updated: PayrollTransaction) => void;
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : "";
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    /* non-JSON */
  }
  return raw || fallback;
}

export default function SalarySlipDrawer({
  tx,
  run,
  editable,
  onClose,
  onSaved,
}: SalarySlipDrawerProps) {
  const [override, setOverride] = useState({
    monthlyTDS: tx.monthlyTDS,
    professionalTax: tx.professionalTax,
    pfEmployee: tx.pfEmployee,
    esiEmployee: tx.esiEmployee,
    netPay: tx.netPay,
    overrideNotes: tx.overrideNotes || "",
  });
  const [saving, setSaving] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const u = typeof tx.userId === "object" ? tx.userId : null;
  const name = u?.name || u?.email || "Employee";

  const dirty =
    override.monthlyTDS !== tx.monthlyTDS ||
    override.professionalTax !== tx.professionalTax ||
    override.pfEmployee !== tx.pfEmployee ||
    override.esiEmployee !== tx.esiEmployee ||
    override.netPay !== tx.netPay ||
    override.overrideNotes !== (tx.overrideNotes || "");

  const onSave = async () => {
    if (!editable || !onSaved) return;
    setSaving(true);
    try {
      const { transaction } = await overridePayrollTransaction(
        tx.runId,
        tx._id,
        override
      );
      toast.success("Override saved");
      onSaved(transaction);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to save override"));
    } finally {
      setSaving(false);
    }
  };

  const onPrint = () => printSlip(tx, run, name, u?.email || "");

  // Whether the "Email" button is shown. Only admins (i.e. the override path
  // is on, or onSaved was passed) can trigger a server-side mailer. Hidden in
  // employee read-only mode and on DRAFT runs (server rejects DRAFT anyway).
  const canEmail = !!onSaved && run?.status && run.status !== "DRAFT";

  const onEmail = async () => {
    setEmailing(true);
    try {
      const r = await emailPayrollSlip(tx.runId, tx._id);
      toast.success(`Slip emailed to ${r.sentTo}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to send slip"));
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex-1 bg-black/60 backdrop-blur-sm cursor-pointer"
      />
      <aside className="w-full max-w-[520px] h-full bg-[#0a0a0a] border-l border-white/8 overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
        {/* Header */}
        <div className="sticky top-0 bg-[#0a0a0a] border-b border-white/8 px-5 py-4 flex items-center justify-between gap-3 z-10">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-white tracking-tight truncate">
              {name}
            </h3>
            <p className="text-[11px] text-[#7a7a7a] truncate">
              {u?.email || ""} · {tx.regimeUsed} regime
              {run ? ` · ${fyMonthLabel(run.fyMonth, run.fyYear)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {canEmail && (
              <button
                onClick={onEmail}
                disabled={emailing}
                className="h-9 w-9 rounded-lg hover:bg-white/5 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                title={`Email this slip to ${u?.email || "the employee"}`}
                aria-label="Email slip"
              >
                {emailing ? (
                  <Loader2 className="h-4 w-4 text-[#a8a8a8] animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 text-[#a8a8a8]" />
                )}
              </button>
            )}
            <button
              onClick={onPrint}
              className="h-9 w-9 rounded-lg hover:bg-white/5 flex items-center justify-center cursor-pointer transition-colors"
              title="Print salary slip"
              aria-label="Print"
            >
              <Printer className="h-4 w-4 text-[#a8a8a8]" />
            </button>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-lg hover:bg-white/5 flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-[#a8a8a8]" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* A10: read-only mode banner */}
          {!editable && (
            <InfoCard variant="neutral">
              This slip is read-only because the run is approved or paid. Use
              the <b>Print</b> button to save a copy.
            </InfoCard>
          )}

          {tx.warnings && tx.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3.5 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Notes
              </div>
              <ul className="text-[11px] text-amber-300/80 space-y-1 list-disc pl-4">
                {tx.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <SlipBlock
            title="Earnings"
            rows={tx.earnings.map((c) => ({
              label: c.componentName,
              value: c.amount,
              sub:
                c.calculationType === "flat"
                  ? "fixed"
                  : `${c.value}% (${c.calculationType.replace("percent", "of ")})`,
            }))}
            totalLabel="Gross Salary"
            totalValue={tx.grossSalary}
          />

          <SlipBlock
            title="Deductions"
            rows={[
              { label: "PF (Employee)", value: tx.pfEmployee, sub: "statutory" },
              { label: "ESI (Employee)", value: tx.esiEmployee, sub: "statutory" },
              { label: "Professional Tax", value: tx.professionalTax, sub: "statutory" },
              ...tx.deductions
                .filter(
                  (d) =>
                    !["PF_EMPLOYEE", "ESI_EMPLOYEE", "PT"].includes(
                      d.componentCode
                    )
                )
                .map((d) => ({
                  label: d.componentName,
                  value: d.amount,
                  sub: d.calculationType === "flat" ? "fixed" : `${d.value}%`,
                })),
            ]}
            totalLabel="Total Deductions"
            totalValue={
              tx.pfEmployee +
              tx.esiEmployee +
              tx.professionalTax +
              tx.deductions
                .filter(
                  (d) =>
                    !["PF_EMPLOYEE", "ESI_EMPLOYEE", "PT"].includes(
                      d.componentCode
                    )
                )
                .reduce((s, d) => s + d.amount, 0)
            }
          />

          <SlipBlock
            title="Tax (Section 192)"
            rows={[
              { label: "Projected annual gross", value: tx.projectedAnnualGross },
              { label: "Total exemptions", value: -tx.totalExemptions },
              { label: "Standard deduction", value: -tx.standardDeduction },
              { label: "Chapter VI-A", value: -(tx.chapterVIA?.total || 0) },
              { label: "Net taxable income", value: tx.netTaxableIncome, bold: true },
              { label: "Annual tax liability", value: tx.annualTaxLiability, bold: true },
            ]}
            totalLabel="Monthly TDS"
            totalValue={tx.monthlyTDS}
          />

          <SlipBlock
            title="Attendance"
            rows={[
              { label: "Window calendar days", value: tx.attendance.windowCalendarDays },
              { label: "Days employee in window", value: tx.attendance.daysEmployeeInWindow },
              { label: "Present", value: tx.attendance.daysPresentInWindow },
              { label: "Paid leave", value: tx.attendance.paidLeaveDaysInWindow },
              { label: "LOP days", value: tx.attendance.lopDaysInWindow },
              { label: "Deferred LOP applied", value: tx.attendance.deferredLopApplied },
              ...(tx.attendance.inGraceWindow
                ? [
                    { label: "Grace tail days", value: tx.attendance.graceTailDays, bold: true },
                    { label: "Grace LOP (deferred to next cycle)", value: tx.attendance.deferredLopForNextCycle },
                  ]
                : []),
            ]}
            isCurrency={false}
            totalLabel="Attendance factor"
            totalValue={Math.round(tx.attendance.attendanceFactor * 10000) / 100}
            totalSuffix="%"
          />

          {editable && onSaved && (
            <div className="rounded-xl border border-white/8 bg-[#050505] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Pencil className="h-4 w-4 text-brand" />
                <h4 className="text-[13px] font-semibold text-white">
                  Override (DRAFT only)
                </h4>
              </div>
              {/* B6: when-to-override explainer */}
              <div className="mb-4">
                <InfoCard variant="info" title="When to override">
                  Use overrides for one-off corrections (bonus mid-cycle,
                  last-month F&amp;F, manual TDS adjustment). Always add a
                  note — overrides are audit-tracked and surface as a tag in
                  the runs table.
                </InfoCard>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <OverrideField label="Monthly TDS" value={override.monthlyTDS} onChange={(v) => setOverride({ ...override, monthlyTDS: v })} />
                <OverrideField label="Professional Tax" value={override.professionalTax} onChange={(v) => setOverride({ ...override, professionalTax: v })} />
                <OverrideField label="PF (Employee)" value={override.pfEmployee} onChange={(v) => setOverride({ ...override, pfEmployee: v })} />
                <OverrideField label="ESI (Employee)" value={override.esiEmployee} onChange={(v) => setOverride({ ...override, esiEmployee: v })} />
                <div className="col-span-2">
                  <OverrideField label="Net Pay (override)" value={override.netPay} onChange={(v) => setOverride({ ...override, netPay: v })} />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-[#a8a8a8] uppercase tracking-wider mb-1.5 block">
                    Notes
                  </label>
                  <textarea
                    className="w-full min-h-[64px] px-3 py-2 text-[12px] rounded-lg border border-white/8 bg-[#0a0a0a] text-white placeholder:text-[#5a5a5a] outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/10 transition-colors resize-none"
                    placeholder="Why was this override applied?"
                    value={override.overrideNotes}
                    onChange={(e) => setOverride({ ...override, overrideNotes: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={onSave}
                disabled={!dirty || saving}
                className="mt-4 h-10 px-4 w-full rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save Override
              </button>
            </div>
          )}

          <div className="rounded-xl border border-brand/30 bg-brand/[0.04] px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand/80 mb-1">
              Net pay this month
            </div>
            <div className="text-[28px] font-bold tabular-nums text-white">
              {INR(tx.netPay)}
            </div>
            {tx.joiningPartialPay > 0 && (
              <div className="text-[11px] text-[#a8a8a8] mt-1">
                Includes joining partial pay {INR(tx.joiningPartialPay)}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

interface SlipBlockProps {
  title: string;
  rows: Array<{ label: string; value: number; sub?: string; bold?: boolean }>;
  totalLabel: string;
  totalValue: number;
  totalSuffix?: string;
  isCurrency?: boolean;
}

function SlipBlock({
  title,
  rows,
  totalLabel,
  totalValue,
  totalSuffix,
  isCurrency = true,
}: SlipBlockProps) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#050505] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#a8a8a8]">
        {title}
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className={`text-[12px] truncate ${r.bold ? "text-white font-semibold" : "text-[#a8a8a8]"}`}>
                {r.label}
              </div>
              {r.sub && (
                <div className="text-[10px] text-[#5a5a5a] truncate">
                  {r.sub}
                </div>
              )}
            </div>
            <div
              className={`text-[12px] tabular-nums ${
                r.value < 0 ? "text-[#7a7a7a]" : r.bold ? "text-white font-semibold" : "text-white"
              }`}
            >
              {r.value < 0 ? "−" : ""}
              {isCurrency ? INR(Math.abs(r.value)) : Math.abs(r.value)}
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between gap-3 bg-[#080808]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#a8a8a8]">
          {totalLabel}
        </div>
        <div className="text-[14px] font-semibold text-white tabular-nums">
          {isCurrency ? INR(totalValue) : totalValue}
          {totalSuffix || ""}
        </div>
      </div>
    </div>
  );
}

function OverrideField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  useEffect(() => {
    const parsed = text === "" ? 0 : Number(text);
    if (parsed !== value) setText(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div>
      <label className="text-[10.5px] font-medium text-[#a8a8a8] uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#5a5a5a] font-medium pointer-events-none">
          ₹
        </span>
        <input
          type="text"
          inputMode="decimal"
          className="w-full h-10 pl-7 pr-3 text-[12px] rounded-lg border border-white/8 bg-[#0a0a0a] text-white placeholder:text-[#5a5a5a] outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/10 transition-colors tabular-nums"
          value={text}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d.]/g, "");
            setText(cleaned);
            const n = cleaned === "" ? 0 : Number(cleaned);
            onChange(Number.isNaN(n) ? 0 : n);
          }}
        />
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
 * Print-friendly HTML rendered into a fresh popup. We intentionally do NOT
 * try to print the in-page drawer — it would inherit dashboard chrome and
 * dark backgrounds. A standalone window keeps the slip clean and white.
 * ─────────────────────────────────────────────────────────────────────── */

function printSlip(
  tx: PayrollTransaction,
  run: PayrollRun | null | undefined,
  name: string,
  email: string
) {
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) {
    toast.error("Popup blocked — allow popups to print the slip");
    return;
  }

  const earnRows = tx.earnings
    .map(
      (c) =>
        `<tr><td>${escape(c.componentName)}</td><td>${escape(
          c.calculationType === "flat" ? "fixed" : `${c.value}%`
        )}</td><td class="r">${INR(c.amount)}</td></tr>`
    )
    .join("");

  const customDeductions = tx.deductions.filter(
    (d) => !["PF_EMPLOYEE", "ESI_EMPLOYEE", "PT"].includes(d.componentCode)
  );
  const dedRows =
    [
      ["PF (Employee)", "statutory", tx.pfEmployee],
      ["ESI (Employee)", "statutory", tx.esiEmployee],
      ["Professional Tax", "statutory", tx.professionalTax],
      ["TDS (Income Tax)", "statutory", tx.monthlyTDS],
      ...customDeductions.map(
        (d) => [
          d.componentName,
          d.calculationType === "flat" ? "fixed" : `${d.value}%`,
          d.amount,
        ] as [string, string, number]
      ),
    ]
      .filter(([, , v]) => Number(v) > 0)
      .map(
        ([label, sub, v]) =>
          `<tr><td>${escape(label as string)}</td><td>${escape(
            sub as string
          )}</td><td class="r">${INR(v as number)}</td></tr>`
      )
      .join("");

  const totalDeductions =
    tx.pfEmployee +
    tx.esiEmployee +
    tx.professionalTax +
    tx.monthlyTDS +
    customDeductions.reduce((s, d) => s + d.amount, 0);

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Salary Slip — ${escape(name)} — ${
    run ? escape(fyMonthLabel(run.fyMonth, run.fyYear)) : ""
  }</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#111;background:#fff;margin:0;padding:32px}
  .head{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px}
  .h-title{font-size:22px;font-weight:700;margin:0}
  .h-sub{font-size:12px;color:#555;margin-top:4px}
  .h-right{text-align:right;font-size:11px;color:#555}
  .h-right strong{color:#111;font-size:13px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
  .label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px}
  .value{font-size:12px;color:#111;font-weight:500}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px}
  th{text-align:left;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;padding:8px 12px;border-bottom:1px solid #ddd}
  th.r,td.r{text-align:right;font-variant-numeric:tabular-nums}
  td{padding:8px 12px;border-bottom:1px solid #eee}
  tfoot td{border-top:2px solid #111;border-bottom:none;font-weight:700;padding-top:10px}
  .net{margin-top:24px;padding:16px 20px;background:#fff7d6;border:1px solid #e5c100;border-radius:8px;display:flex;justify-content:space-between;align-items:center}
  .net .l{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#7a5d00}
  .net .v{font-size:24px;font-weight:700;color:#111;font-variant-numeric:tabular-nums}
  .foot{margin-top:32px;font-size:10px;color:#888;text-align:center}
</style>
</head>
<body>
  <div class="head">
    <div>
      <h1 class="h-title">Salary Slip</h1>
      <div class="h-sub">${escape(name)} · ${escape(email)}</div>
    </div>
    <div class="h-right">
      <strong>${run ? escape(fyMonthLabel(run.fyMonth, run.fyYear)) : ""}</strong><br/>
      Regime: ${escape(tx.regimeUsed)}<br/>
      ${run ? `Window: ${escape(formatDate(run.windowStart))} – ${escape(formatDate(run.windowEnd))}<br/>` : ""}
      Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="label">Attendance Factor</div>
      <div class="value">${(tx.attendance.attendanceFactor * 100).toFixed(2)}% (${tx.attendance.daysPresentInWindow}/${tx.attendance.windowCalendarDays} days)</div>
    </div>
    <div>
      <div class="label">LOP days</div>
      <div class="value">${tx.attendance.lopDaysApplied}</div>
    </div>
  </div>

  <table>
    <thead><tr><th>Earning</th><th>Calc</th><th class="r">Amount</th></tr></thead>
    <tbody>${earnRows || `<tr><td colspan="3" style="color:#999;text-align:center">No earnings</td></tr>`}</tbody>
    <tfoot><tr><td colspan="2">Gross Salary</td><td class="r">${INR(tx.grossSalary)}</td></tr></tfoot>
  </table>

  <table>
    <thead><tr><th>Deduction</th><th>Type</th><th class="r">Amount</th></tr></thead>
    <tbody>${dedRows || `<tr><td colspan="3" style="color:#999;text-align:center">No deductions</td></tr>`}</tbody>
    <tfoot><tr><td colspan="2">Total Deductions</td><td class="r">${INR(totalDeductions)}</td></tr></tfoot>
  </table>

  <div class="net">
    <div class="l">Net Pay</div>
    <div class="v">${INR(tx.netPay)}</div>
  </div>

  <div class="foot">
    Computer-generated salary slip · No signature required.
  </div>

  <script>setTimeout(function(){ window.print(); }, 100);</script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}

function escape(s: string): string {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDate(s: string | Date): string {
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
