"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  FileText,
  Lock,
  CircleCheck,
  ChevronRight,
  Receipt,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { listMyPayrollSlips, getMyForm16 } from "../api";
import type {
  PayrollRun,
  PayrollRunStatus,
  PayrollTransaction,
  Form16Response,
} from "../types";
import SalarySlipDrawer from "./SalarySlipDrawer";
import { INR, fyMonthLabel, fmtDate } from "../lib/payrollFormat";
import InfoCard from "../lib/InfoCard";

interface SlipRow {
  run: PayrollRun;
  transaction: PayrollTransaction;
}

function statusChip(status: PayrollRunStatus): { cls: string; label: string } {
  if (status === "PAID")
    return {
      cls: "bg-emerald-500/[0.04] border-emerald-500/20 text-emerald-300",
      label: "PAID",
    };
  return {
    cls: "bg-amber-500/[0.04] border-amber-500/20 text-amber-300",
    label: "APPROVED",
  };
}

export default function MySalarySlipsSection() {
  const [slips, setSlips] = useState<SlipRow[] | null>(null);
  const [selected, setSelected] = useState<SlipRow | null>(null);
  const [downloadingFy, setDownloadingFy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await listMyPayrollSlips();
      setSlips(r.slips || []);
    } catch {
      toast.error("Failed to load your salary slips");
      setSlips([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** All distinct FY years present in the user's slips, descending. */
  const fyYears = (slips || [])
    .map((s) => s.run.fyYear)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => b - a);

  const downloadForm16 = async (fyYear: number) => {
    setDownloadingFy(fyYear);
    try {
      const data = await getMyForm16(fyYear);
      if (!data.totals || data.months.length === 0) {
        toast.error(`No approved runs in FY ${data.fyString}`);
        return;
      }
      printForm16(data);
    } catch {
      toast.error("Failed to load Form 16 data");
    } finally {
      setDownloadingFy(null);
    }
  };

  if (slips === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out] space-y-5 max-w-4xl">
      {/* Header card */}
      <div className="rounded-xl border border-white/8 bg-[#0e0e0e] px-5 py-4">
        <h1 className="text-xl font-semibold text-white tracking-tight">
          My Salary Slips
        </h1>
        <p className="text-[12px] text-[#7a7a7a] mt-1">
          Approved and paid payroll runs that include you. Drafts are hidden
          until your HR team approves them.
        </p>
      </div>

      {slips.length === 0 ? (
        <div className="space-y-3">
          {/* A9: empty-state expectation */}
          <InfoCard variant="neutral">
            Slips appear here only after your HR team approves the payroll run
            for that month. Drafts are hidden until approval.
          </InfoCard>
          <div className="rounded-xl border border-white/8 bg-[#0a0a0a] py-16 px-6 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-[#161616] flex items-center justify-center ring-1 ring-white/8 mb-4">
              <FileText className="h-7 w-7 text-[#5a5a5a]" />
            </div>
            <h3 className="text-[16px] font-semibold text-white mb-1.5 tracking-tight">
              No slips yet
            </h3>
            <p className="text-[13px] text-[#a8a8a8] max-w-md leading-relaxed">
              You will see your monthly salary slips here once your HR team
              approves the run.
            </p>
          </div>
        </div>
      ) : (
        <>
        {/* Form 16 download row — one button per FY present in the slips */}
        <div className="rounded-xl border border-white/8 bg-[#0a0a0a] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[12px] text-[#a8a8a8]">
            <span className="font-semibold text-white">Form 16</span> —
            annual TDS certificate, downloadable per FY.
          </div>
          <div className="flex items-center gap-2">
            {fyYears.map((y) => (
              <button
                key={y}
                onClick={() => downloadForm16(y)}
                disabled={downloadingFy === y}
                className="h-9 px-3 text-[12px] text-white/80 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {downloadingFy === y ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                FY {y}-{String((y + 1) % 100).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/8 bg-[#0a0a0a] overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-3 px-5 py-3 border-b border-white/5 text-[10px] font-semibold text-[#7a7a7a] uppercase tracking-[0.1em]">
            <span>Pay Month</span>
            <span>Status</span>
            <span className="text-right">Gross</span>
            <span className="text-right">TDS</span>
            <span className="text-right">Net Pay</span>
            <span />
          </div>
          <div className="divide-y divide-white/5">
            {slips.map(({ run, transaction }) => {
              const chip = statusChip(run.status);
              return (
                <button
                  key={transaction._id}
                  onClick={() => setSelected({ run, transaction })}
                  className="w-full grid grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer text-left items-center"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-white">
                      {fyMonthLabel(run.fyMonth, run.fyYear)}
                    </div>
                    <div className="text-[11px] text-[#7a7a7a] mt-0.5 truncate">
                      Window {fmtDate(run.windowStart)} – {fmtDate(run.windowEnd)}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[10.5px] font-semibold uppercase tracking-wider ${chip.cls}`}
                    >
                      {run.status === "PAID" ? (
                        <CircleCheck className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      {chip.label}
                    </span>
                  </div>
                  <div className="text-[13px] text-white text-right tabular-nums">
                    {INR(transaction.grossSalary)}
                  </div>
                  <div className="text-[13px] text-white/80 text-right tabular-nums">
                    {INR(transaction.monthlyTDS)}
                  </div>
                  <div className="text-[13px] text-white text-right font-semibold tabular-nums">
                    {INR(transaction.netPay)}
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#5a5a5a]" />
                </button>
              );
            })}
          </div>
        </div>
        </>
      )}

      {/* Helper hint */}
      {slips.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-[#0a0a0a] px-5 py-3 flex items-center gap-2 text-[11px] text-[#7a7a7a]">
          <Receipt className="h-3.5 w-3.5 text-brand" />
          Click any month to view the full breakdown and print the slip.
        </div>
      )}

      {selected && (
        <SalarySlipDrawer
          tx={selected.transaction}
          run={selected.run}
          editable={false}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
 * Form 16 print — opens a fresh popup with a clean white annual TDS
 * certificate. Mirrors the salary-slip print pattern.
 * ─────────────────────────────────────────────────────────────────────── */
function printForm16(data: Form16Response) {
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) {
    toast.error("Popup blocked — allow popups to download Form 16");
    return;
  }

  const firstTxn = data.months[0]?.transaction;
  const lastTxn = data.months[data.months.length - 1]?.transaction;
  const u = firstTxn && typeof firstTxn.userId === "object" ? firstTxn.userId : null;
  const name = u?.name || u?.email || "Employee";
  const email = u?.email || "";
  const regime = lastTxn?.regimeUsed || firstTxn?.regimeUsed || "—";

  const monthRows = data.months
    .map(({ run, transaction: t }) => {
      return `<tr>
        <td>${escape(fyMonthLabel(run.fyMonth, run.fyYear))}</td>
        <td class="r">${INR(t.grossSalary)}</td>
        <td class="r">${INR(t.totalExemptions)}</td>
        <td class="r">${INR(t.standardDeduction)}</td>
        <td class="r">${INR(t.chapterVIA?.total || 0)}</td>
        <td class="r">${INR(t.professionalTax)}</td>
        <td class="r">${INR(t.monthlyTDS)}</td>
        <td class="r"><b>${INR(t.netPay)}</b></td>
      </tr>`;
    })
    .join("");

  const t = data.totals!;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Form 16 — ${escape(name)} — FY ${escape(data.fyString)}</title>
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
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#111;margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid #ddd}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px}
  th{text-align:left;font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;padding:8px;border-bottom:1px solid #ddd;background:#fafafa}
  th.r,td.r{text-align:right;font-variant-numeric:tabular-nums}
  td{padding:6px 8px;border-bottom:1px solid #f0f0f0}
  tfoot td{border-top:2px solid #111;border-bottom:none;font-weight:700;padding-top:8px;background:#fafafa}
  .totals-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;font-size:12px;margin-bottom:16px}
  .totals-grid .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0}
  .totals-grid .row.bold{border-bottom:2px solid #111;font-weight:700;font-size:13px}
  .net{margin-top:24px;padding:16px 20px;background:#fff7d6;border:1px solid #e5c100;border-radius:8px;display:flex;justify-content:space-between;align-items:center}
  .net .l{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#7a5d00}
  .net .v{font-size:24px;font-weight:700;color:#111;font-variant-numeric:tabular-nums}
  .foot{margin-top:32px;font-size:10px;color:#888;text-align:center;line-height:1.6}
</style>
</head>
<body>
  <div class="head">
    <div>
      <h1 class="h-title">Form 16 — Annual TDS Certificate</h1>
      <div class="h-sub">${escape(name)} · ${escape(email)}</div>
    </div>
    <div class="h-right">
      <strong>FY ${escape(data.fyString)}</strong><br/>
      Tax regime: ${escape(regime)}<br/>
      Months in scope: ${data.months.length}<br/>
      Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
    </div>
  </div>

  <div class="section-title">Part B — Monthly Salary Breakdown</div>
  <table>
    <thead>
      <tr>
        <th>Month</th>
        <th class="r">Gross</th>
        <th class="r">Exemptions</th>
        <th class="r">Std Ded.</th>
        <th class="r">Chapter VI-A</th>
        <th class="r">PT</th>
        <th class="r">TDS</th>
        <th class="r">Net Pay</th>
      </tr>
    </thead>
    <tbody>${monthRows}</tbody>
    <tfoot>
      <tr>
        <td>Annual totals</td>
        <td class="r">${INR(t.gross)}</td>
        <td class="r">${INR(t.exemptions)}</td>
        <td class="r">${INR(t.standardDeduction)}</td>
        <td class="r">${INR(t.chapterVIA)}</td>
        <td class="r">${INR(t.pt)}</td>
        <td class="r">${INR(t.tds)}</td>
        <td class="r">${INR(t.netPay)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="section-title">Annual Summary</div>
  <div class="totals-grid">
    <div class="row"><span>Gross salary</span><span>${INR(t.gross)}</span></div>
    <div class="row"><span>Exemptions (HRA, LTA, etc.)</span><span>−${INR(t.exemptions)}</span></div>
    <div class="row"><span>Standard deduction</span><span>−${INR(t.standardDeduction)}</span></div>
    <div class="row"><span>Chapter VI-A</span><span>−${INR(t.chapterVIA)}</span></div>
    <div class="row"><span>Professional Tax</span><span>−${INR(t.pt)}</span></div>
    <div class="row"><span>PF (Employee)</span><span>−${INR(t.pf)}</span></div>
    <div class="row"><span>ESI (Employee)</span><span>−${INR(t.esi)}</span></div>
    <div class="row bold"><span>Total TDS deducted</span><span>${INR(t.tds)}</span></div>
  </div>

  <div class="net">
    <div class="l">Annual Net Pay</div>
    <div class="v">${INR(t.netPay)}</div>
  </div>

  <div class="foot">
    Computer-generated certificate · No signature required.<br/>
    This Form 16 reflects approved + paid payroll runs only. For the official
    income-tax filing copy with TAN/PAN-stamped Part A, contact HR.
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
