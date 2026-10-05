"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  DollarSign,
  Receipt,
  TrendingUp,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Shield,
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  Check,
  X,
  PlayCircle,
  Lock,
  CalendarRange,
  AlertTriangle,
  CircleCheck,
  Clock,
  FileText,
  History,
  Mail,
  Users,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { getUserIdFromToken } from "@/lib/auth";
import {
  getEmployee,
  listEmployees,
  listSalaryStructures,
  createSalaryStructure,
  updateSalaryStructure,
  deleteSalaryStructure,
  getSalaryStructureDefaults,
  listPayrollRuns,
  getPayrollRun,
  createPayrollRun,
  approvePayrollRun,
  markPaidPayrollRun,
  deletePayrollRun,
  overridePayrollTransaction,
  emailAllPayrollSlips,
  getPayrollConfig,
  listBranches,
  listDepartments,
  getMonthSummary,
} from "../api";
import type {
  SalaryStructure,
  SalaryComponent,
  ComponentCode,
  TaxabilityType,
  CalcType,
  TaxRegime,
  PayrollRun,
  PayrollRunStatus,
  PayrollTransaction,
  PayrollConfig,
  PayrollRunCreateResult,
  EmployeeListItem,
  Branch,
  Department,
  MonthSummaryRemainingEmployee,
} from "../types";
import SalarySlipDrawer from "./SalarySlipDrawer";
import InfoCard from "../lib/InfoCard";

type ViewState =
  | { kind: "overview" }
  | { kind: "salary-structure" }
  | { kind: "new-run"; isPartial: boolean }
  | { kind: "run-detail"; runId: string };

export default function PayrollSection() {
  const { amIFounder, loading: founderLoading } = useAmIFounder();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [view, setView] = useState<ViewState>({ kind: "overview" });

  useEffect(() => {
    if (founderLoading) return;
    if (amIFounder) {
      setAllowed(true);
      return;
    }
    const uid = getUserIdFromToken();
    if (!uid) {
      setAllowed(false);
      return;
    }
    getEmployee(uid)
      .then((data) => setAllowed(data.teamforceRole === "admin"))
      .catch(() => setAllowed(false));
  }, [amIFounder, founderLoading]);

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 text-brand animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-16 w-16 rounded-2xl bg-[#1c1c1c] flex items-center justify-center ring-1 ring-white/8 mb-4">
          <Shield className="h-7 w-7 text-[#5a5a5a]" />
        </div>
        <h3 className="text-base font-semibold text-white mb-2">
          Access Restricted
        </h3>
        <p className="text-[13px] text-[#7a7a7a] max-w-sm text-center">
          Payroll is available only to admins and founders.
        </p>
      </div>
    );
  }

  const titleByView = (() => {
    switch (view.kind) {
      case "salary-structure":
        return "Salary Structure Setup";
      case "new-run":
        return view.isPartial ? "New Partial Payroll Run" : "New Payroll Run";
      case "run-detail":
        return "Payroll Run";
      default:
        return "Payroll Overview";
    }
  })();

  const breadcrumbSuffix = (() => {
    switch (view.kind) {
      case "salary-structure":
        return "Salary Structure Setup";
      case "new-run":
        return view.isPartial ? "New Partial Run" : "New Run";
      case "run-detail":
        return "Run Detail";
      default:
        return null;
    }
  })();

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      {/* Top bar — breadcrumb + title + actions */}
      <div className="rounded-xl border border-white/8 bg-[#0e0e0e] px-5 py-4 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-[#7a7a7a] mb-1">
              <span>Home</span>
              <span>/</span>
              <span>Payroll</span>
              {breadcrumbSuffix && (
                <>
                  <span>/</span>
                  <span>{breadcrumbSuffix}</span>
                </>
              )}
            </div>
            <h1 className="text-xl font-semibold text-white tracking-tight">
              {titleByView}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {view.kind === "overview" ? (
              <>
                <button
                  onClick={() => setView({ kind: "salary-structure" })}
                  className="h-10 px-3.5 text-[13px] text-white/80 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <SettingsIcon className="w-4 h-4" />
                  Salary Structures
                </button>
                <button
                  onClick={() => setView({ kind: "new-run", isPartial: true })}
                  className="h-10 px-4 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-brand/10"
                >
                  <Filter className="w-4 h-4" />
                  <span className="sm:hidden">New Partial</span>
                  <span className="hidden sm:inline">New Partial Run</span>
                </button>
                <button
                  onClick={() => setView({ kind: "new-run", isPartial: false })}
                  className="h-10 px-4 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-brand/10"
                >
                  <Plus className="w-4 h-4" />
                  <span className="sm:hidden">New Payroll</span>
                  <span className="hidden sm:inline">New Payroll Run</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setView({ kind: "overview" })}
                className="h-10 px-3.5 text-[13px] text-white/80 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Payroll
              </button>
            )}
          </div>
        </div>
      </div>

      {view.kind === "salary-structure" && <SalaryStructureView />}
      {view.kind === "overview" && (
        <PayrollOverview
          onOpenRun={(runId) => setView({ kind: "run-detail", runId })}
          onNewRun={() => setView({ kind: "new-run", isPartial: false })}
        />
      )}
      {view.kind === "new-run" && (
        <NewRunView
          isPartial={view.isPartial}
          onCreated={(runId) => setView({ kind: "run-detail", runId })}
          onCancel={() => setView({ kind: "overview" })}
        />
      )}
      {view.kind === "run-detail" && (
        <RunDetailView
          runId={view.runId}
          onBack={() => setView({ kind: "overview" })}
        />
      )}
    </div>
  );
}

/* ─── Helpers shared across run views ──────────────────────────────────── */

const FY_MONTHS_LABELS = [
  "Apr", "May", "Jun", "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
];

function fyMonthLabel(fyMonth: number, fyYear: number): string {
  // FY month 1..9 → year fyYear; 10..12 → fyYear+1 (Jan/Feb/Mar)
  const yr = fyMonth >= 10 ? fyYear + 1 : fyYear;
  return `${FY_MONTHS_LABELS[fyMonth - 1]} ${yr}`;
}

function statusChipClasses(status: PayrollRunStatus): string {
  if (status === "DRAFT")
    return "bg-white/[0.04] border-white/10 text-[#a8a8a8]";
  if (status === "APPROVED")
    return "bg-amber-500/[0.04] border-amber-500/20 text-amber-300";
  return "bg-emerald-500/[0.04] border-emerald-500/20 text-emerald-300";
}

const INR = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function fmtDate(s: string | Date | undefined | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ─── Overview: runs list + new-run CTA ───────────────────────────────── */

interface PayrollOverviewProps {
  onOpenRun: (runId: string) => void;
  onNewRun: () => void;
}

function PayrollOverview({ onOpenRun, onNewRun }: PayrollOverviewProps) {
  const [runs, setRuns] = useState<PayrollRun[] | null>(null);

  const load = useCallback(async () => {
    try {
      const { runs } = await listPayrollRuns();
      setRuns(runs);
    } catch {
      toast.error("Failed to load payroll runs");
      setRuns([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (runs === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 text-brand animate-spin" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="space-y-3">
        {/* A1: empty-state explainer */}
        <InfoCard variant="info" title="What's a payroll run?">
          A run computes monthly salaries for every employee with a salary
          structure assigned. Runs start as <b>DRAFT</b> so you can review and
          override per-employee numbers before approving. Once approved, the
          attendance cutoff day is locked permanently.
        </InfoCard>
        <div className="rounded-xl border border-white/8 bg-[#0a0a0a] py-16 px-6 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div className="h-16 w-16 rounded-2xl bg-[#161616] flex items-center justify-center ring-1 ring-white/8">
              <Receipt className="h-7 w-7 text-[#5a5a5a]" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-lg bg-brand/10 flex items-center justify-center ring-1 ring-brand/20">
              <PlayCircle className="h-3.5 w-3.5 text-brand" />
            </div>
          </div>
          <h3 className="text-[16px] font-semibold text-white mb-1.5 tracking-tight">
            No payroll runs yet
          </h3>
          <p className="text-[13px] text-[#a8a8a8] max-w-md mb-6 leading-relaxed">
            Create your first payroll run to compute monthly salaries for
            everyone with a salary structure assigned.
          </p>
          <button
            onClick={onNewRun}
            className="h-10 px-5 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-brand/10"
          >
            <Plus className="h-4 w-4" />
            New Payroll Run
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* A2: lifecycle explainer */}
      <InfoCard variant="neutral" title="Run lifecycle">
        <b>DRAFT</b> → review and override per-employee. <b>APPROVED</b> →
        finalised, cutoff day locks. <b>PAID</b> → archived after disbursement.
      </InfoCard>
      <div className="rounded-xl border border-white/8 bg-[#0a0a0a] overflow-hidden">
      <div className="overflow-x-auto">
      <div className="grid grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_120px] min-w-[520px] gap-3 px-5 py-3 border-b border-white/5 text-[10px] font-semibold text-[#7a7a7a] uppercase tracking-[0.1em]">
        <span>Pay Month</span>
        <span>Status</span>
        <span className="text-right">Gross</span>
        <span className="text-right">TDS</span>
        <span className="text-right">Net</span>
        <span className="text-right">Employees</span>
      </div>
      <div className="divide-y divide-white/5">
        {runs.map((r) => (
          <button
            key={r._id}
            onClick={() => onOpenRun(r._id)}
            className="w-full grid grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_120px] min-w-[520px] gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer text-left items-center"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-white">
                  {fyMonthLabel(r.fyMonth, r.fyYear)}
                </span>
                {r.runType === "PARTIAL" && (
                  <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded border border-amber-500/30 bg-amber-500/[0.06] text-[9.5px] font-semibold uppercase tracking-wider text-amber-400">
                    <Filter className="h-2.5 w-2.5" />
                    Partial
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#7a7a7a] mt-0.5 truncate">
                {r.runType === "PARTIAL" && r.scope?.label
                  ? r.scope.label
                  : `Window ${fmtDate(r.windowStart)} – ${fmtDate(r.windowEnd)}`}
              </div>
            </div>
            <div>
              <span
                className={`inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[10.5px] font-semibold uppercase tracking-wider ${statusChipClasses(r.status)}`}
              >
                {r.status === "DRAFT" && <Pencil className="h-3 w-3" />}
                {r.status === "APPROVED" && <Lock className="h-3 w-3" />}
                {r.status === "PAID" && <CircleCheck className="h-3 w-3" />}
                {r.status}
              </span>
            </div>
            <div className="text-[13px] text-white text-right tabular-nums">
              {INR(r.totals?.grossSum || 0)}
            </div>
            <div className="text-[13px] text-white/80 text-right tabular-nums">
              {INR(r.totals?.tdsSum || 0)}
            </div>
            <div className="text-[13px] text-white text-right font-semibold tabular-nums">
              {INR(r.totals?.netSum || 0)}
            </div>
            <div className="text-[13px] text-[#a8a8a8] text-right tabular-nums">
              {r.totals?.employeeCount || 0}
            </div>
          </button>
        ))}
      </div>
      </div>{/* /overflow-x-auto */}
      </div>
    </div>
  );
}

/* ─── New Payroll Run wizard ─────────────────────────────────────────── */

interface NewRunViewProps {
  isPartial: boolean;
  onCreated: (runId: string) => void;
  onCancel: () => void;
}

function fyToCalendar(fyMonth: number, fyYear: number) {
  const calendarMonth = ((fyMonth - 1 + 3) % 12) + 1;
  const calendarYear = fyMonth + 3 > 12 ? fyYear + 1 : fyYear;
  return { calendarMonth, calendarYear };
}

function getCurrentFY(): { fyMonth: number; fyYear: number } {
  const now = new Date();
  const cm = now.getMonth() + 1;
  const cy = now.getFullYear();
  // FY month 1 = April. fyYear = the calendar year of April.
  const fyYear = cm >= 4 ? cy : cy - 1;
  const fyMonth = cm >= 4 ? cm - 3 : cm + 9;
  return { fyMonth, fyYear };
}

const SKIP_REASONS: Record<string, string> = {
  no_profile: "No Teamforce profile in this org",
  no_salary_structure: "No salary structure assigned",
  no_monthly_ctc: "Monthly CTC anchor not set",
  structure_inactive: "Their salary structure is inactive / deleted",
};

function NewRunView({ isPartial, onCreated, onCancel }: NewRunViewProps) {
  const init = getCurrentFY();
  const [fyMonth, setFyMonth] = useState(init.fyMonth);
  const [fyYear, setFyYear] = useState(init.fyYear);
  const [config, setConfig] = useState<PayrollConfig | null>(null);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<PayrollRunCreateResult | null>(null);

  // Scope selection (partial runs)
  const [selDeptIds, setSelDeptIds] = useState<string[]>([]);
  const [selBranchIds, setSelBranchIds] = useState<string[]>([]);
  const [selUserIds, setSelUserIds] = useState<string[]>([]);

  // Remaining employees (for partial scope helper)
  const [remaining, setRemaining] = useState<MonthSummaryRemainingEmployee[]>([]);

  useEffect(() => {
    const calls: Promise<unknown>[] = [getPayrollConfig(), listEmployees()];
    if (isPartial) {
      calls.push(listBranches(), listDepartments());
    }
    Promise.all(calls)
      .then(([cfgRes, empRes, brRes, deptRes]) => {
        setConfig((cfgRes as any).config);
        setEmployees((empRes as any).employees || []);
        if (isPartial) {
          setBranches(((brRes as any)?.branches || []).filter((b: Branch) => b.isActive));
          setDepartments(((deptRes as any)?.departments || []).filter((d: Department) => d.isActive));
        }
      })
      .catch(() => toast.error("Failed to load payroll config"))
      .finally(() => setLoadingCfg(false));
  }, [isPartial]);

  // Load remaining employees when month changes (partial runs only).
  useEffect(() => {
    if (isPartial) {
      getMonthSummary(fyYear, fyMonth)
        .then((res) => setRemaining(res.remainingEmployees))
        .catch(() => setRemaining([]));
    }
  }, [fyMonth, fyYear, isPartial]);

  const employeeName = (userId: string): string => {
    const e = employees.find((x) => x.userId === userId);
    return e?.name || e?.email || userId.slice(-6);
  };

  const { calendarMonth, calendarYear } = fyToCalendar(fyMonth, fyYear);

  // Compute window dates client-side for preview (engine has the same logic).
  const cutoff = config?.attendanceCutoffDay || 1;
  let windowStart: Date;
  let windowEnd: Date;
  if (cutoff === 1) {
    const prevMonth = calendarMonth === 1 ? 12 : calendarMonth - 1;
    const prevYear = calendarMonth === 1 ? calendarYear - 1 : calendarYear;
    const lastDay = new Date(prevYear, prevMonth, 0).getDate();
    windowStart = new Date(prevYear, prevMonth - 1, 1);
    windowEnd = new Date(prevYear, prevMonth - 1, lastDay);
  } else {
    const prevMonth = calendarMonth === 1 ? 12 : calendarMonth - 1;
    const prevYear = calendarMonth === 1 ? calendarYear - 1 : calendarYear;
    windowStart = new Date(prevYear, prevMonth - 1, cutoff + 1);
    windowEnd = new Date(calendarYear, calendarMonth - 1, cutoff);
  }

  // Auto-generate scope label.
  const scopeLabel = [
    selDeptIds.length > 0 &&
      `Dept: ${departments.filter((d) => selDeptIds.includes(d._id)).map((d) => d.name).join(", ")}`,
    selBranchIds.length > 0 &&
      `Branch: ${branches.filter((b) => selBranchIds.includes(b._id)).map((b) => b.name).join(", ")}`,
    selUserIds.length > 0 && `${selUserIds.length} people`,
  ]
    .filter(Boolean)
    .join(" · ");

  const hasScope = selDeptIds.length > 0 || selBranchIds.length > 0 || selUserIds.length > 0;

  const create = async () => {
    setCreating(true);
    try {
      const r = await createPayrollRun({
        fyMonth,
        fyYear,
        runType: isPartial ? "PARTIAL" : "FULL",
        scope: isPartial
          ? { departmentIds: selDeptIds, branchIds: selBranchIds, userIds: selUserIds, label: scopeLabel }
          : undefined,
      });
      const skippedCount = r.skipped?.length || 0;
      toast.success(
        `Run created · ${r.processed} processed${skippedCount ? ` · ${skippedCount} skipped` : ""}`
      );
      setResult(r);
      if (skippedCount === 0) onCreated(r.run._id);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to create run"));
    } finally {
      setCreating(false);
    }
  };

  const toggleId = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string, checked: boolean) => {
    setter((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  if (loadingCfg) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 text-brand animate-spin" />
      </div>
    );
  }

  // Result view — surfaces the skipped list before navigating to the detail.
  if (result) {
    const skippedCount = result.skipped?.length || 0;
    return (
      <div className="space-y-5 max-w-3xl">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30 flex items-center justify-center shrink-0">
              <CircleCheck className="h-4 w-4 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-white">
                Draft created · {result.processed} processed
                {skippedCount ? ` · ${skippedCount} skipped` : ""}
              </h3>
              <p className="text-[11px] text-[#a8a8a8] mt-0.5">
                Run ID {result.run._id} · Status {result.run.status}
              </p>
            </div>
          </div>
          <button
            onClick={() => onCreated(result.run._id)}
            className="h-10 px-4 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            Open Run
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {skippedCount > 0 && (
          <FormCard
            icon={AlertTriangle}
            title={`Skipped — ${skippedCount} employee${skippedCount === 1 ? "" : "s"}`}
            subtitle="These employees were not included. Fix the underlying field on each profile, then re-create or refresh the draft."
          >
            <div className="rounded-lg border border-white/8 overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3 px-4 py-2.5 border-b border-white/5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7a7a7a]">
                <span>Employee</span>
                <span>Reason</span>
              </div>
              <div className="divide-y divide-white/5">
                {result.skipped.map((s) => (
                  <div
                    key={s.userId}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3 px-4 py-2.5 items-center"
                  >
                    <div className="text-[12px] text-white truncate">
                      {employeeName(s.userId)}
                    </div>
                    <div className="text-[12px] text-amber-300/90 truncate">
                      {SKIP_REASONS[s.reason] || s.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FormCard>
        )}

        <div className="rounded-xl border border-white/8 bg-[#0a0a0a] px-5 py-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="h-10 px-4 rounded-lg border border-white/8 text-[13px] font-medium text-[#a8a8a8] hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            Back to Payroll
          </button>
          <button
            onClick={() => onCreated(result.run._id)}
            className="h-10 px-5 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-brand/10"
          >
            Open Run
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const fyOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = [init.fyYear - 1, init.fyYear, init.fyYear + 1];

  // Employees available in remaining (for partial scope)
  const remainingForScope = remaining.length > 0 ? remaining : [];

  return (
    <>
      <div className="space-y-5 max-w-3xl">
        {/* Step 1: Pick month */}
        <FormCard icon={CalendarRange} title="Pick the pay month">
          <div className="grid grid-cols-2 gap-4">
            <Field label="FY Month">
              <Select
                value={String(fyMonth)}
                onValueChange={(v) => setFyMonth(Number(v))}
              >
                <SelectTrigger className="h-11 text-[12px] bg-[#050505] border-white/8 text-white focus:border-brand/40 focus-visible:ring-1 focus-visible:ring-brand/10 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#161616] border-white/10 text-white">
                  {fyOptions.map((m) => (
                    <SelectItem key={m} value={String(m)} className="text-[12px]">
                      {fyMonthLabel(m, fyYear)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="FY Start Year">
              <Select
                value={String(fyYear)}
                onValueChange={(v) => setFyYear(Number(v))}
              >
                <SelectTrigger className="h-11 text-[12px] bg-[#050505] border-white/8 text-white focus:border-brand/40 focus-visible:ring-1 focus-visible:ring-brand/10 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#161616] border-white/10 text-white">
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-[12px]">
                      FY {y}-{String((y + 1) % 100).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormCard>

        {/* Step 2: Window preview */}
        <FormCard
          icon={Clock}
          title="Attendance window"
          subtitle={
            config?.locked
              ? `Cutoff locked at day ${config.attendanceCutoffDay}`
              : `Cutoff day = ${config?.attendanceCutoffDay || 1} · Will lock after first approval`
          }
        >
          <div className="rounded-lg border border-white/8 bg-[#050505] px-4 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-[13px] text-white">
              <CalendarRange className="h-4 w-4 text-brand" />
              <span className="font-semibold">{fmtDate(windowStart)}</span>
              <span className="text-[#5a5a5a]">→</span>
              <span className="font-semibold">{fmtDate(windowEnd)}</span>
            </div>
            <div className="text-[11px] text-[#7a7a7a]">
              Pay month: {fyMonthLabel(fyMonth, fyYear)}
            </div>
          </div>
          {!config?.locked && (
            <div className="mt-3">
              <InfoCard variant="warning">
                Approving this run permanently locks the attendance cutoff day for
                the org. Confirm it&rsquo;s correct in Settings → Payroll Config
                first.
              </InfoCard>
            </div>
          )}
        </FormCard>

        {/* Step 3 (Partial only): Scope selection */}
        {isPartial && (
          <FormCard
            icon={Filter}
            title="Select Scope"
            subtitle={`Choose who to include — departments, branches, or specific people. ${remaining.length > 0 ? `${remaining.length} employees not yet processed this month.` : ""}`}
          >
            <div className="space-y-5">
              {/* Departments */}
              {departments.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7a7a7a] mb-2">
                    By Department
                  </div>
                  <div className="rounded-lg border border-white/8 overflow-hidden max-h-44 overflow-y-auto">
                    {departments.map((d) => (
                      <label
                        key={d._id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] cursor-pointer border-b border-white/5 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selDeptIds.includes(d._id)}
                          onChange={(e) => toggleId(setSelDeptIds, d._id, e.target.checked)}
                          className="h-3.5 w-3.5 rounded accent-brand cursor-pointer"
                        />
                        <span className="text-[13px] text-white">{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Branches */}
              {branches.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7a7a7a] mb-2">
                    By Branch
                  </div>
                  <div className="rounded-lg border border-white/8 overflow-hidden max-h-44 overflow-y-auto">
                    {branches.map((b) => (
                      <label
                        key={b._id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] cursor-pointer border-b border-white/5 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selBranchIds.includes(b._id)}
                          onChange={(e) => toggleId(setSelBranchIds, b._id, e.target.checked)}
                          className="h-3.5 w-3.5 rounded accent-brand cursor-pointer"
                        />
                        <span className="text-[13px] text-white">{b.name}</span>
                        {b.city && <span className="text-[11px] text-[#7a7a7a]">{b.city}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Specific People */}
              {remainingForScope.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7a7a7a] mb-2">
                    Specific People
                    <span className="ml-1 text-[#5a5a5a] normal-case font-normal">
                      — {remainingForScope.length} not yet processed this month
                    </span>
                  </div>
                  <div className="rounded-lg border border-white/8 overflow-hidden max-h-52 overflow-y-auto">
                    {remainingForScope.map((emp) => (
                      <label
                        key={emp.userId}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] cursor-pointer border-b border-white/5 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selUserIds.includes(emp.userId)}
                          onChange={(e) => toggleId(setSelUserIds, emp.userId, e.target.checked)}
                          className="h-3.5 w-3.5 rounded accent-brand cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] text-white truncate">{emp.name}</div>
                          {emp.email && (
                            <div className="text-[11px] text-[#7a7a7a] truncate">{emp.email}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {departments.length === 0 && branches.length === 0 && remainingForScope.length === 0 && (
                <p className="text-[13px] text-[#7a7a7a] text-center py-4">
                  No departments, branches, or remaining employees found.
                </p>
              )}

              {hasScope && (
                <div className="rounded-lg border border-brand/20 bg-brand/[0.04] px-4 py-3 text-[12px] text-brand/80">
                  <span className="font-semibold text-brand">Scope: </span>
                  {scopeLabel}
                </div>
              )}
            </div>
          </FormCard>
        )}

        {/* Footer actions */}
        <div className="rounded-xl border border-white/8 bg-[#0a0a0a] px-5 py-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={creating}
            className="h-10 px-4 rounded-lg border border-white/8 text-[13px] font-medium text-[#a8a8a8] hover:bg-white/5 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={creating || (isPartial && !hasScope)}
            className="h-10 px-5 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand/10"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            {isPartial ? "Run Partial Payroll" : "Generate Draft Run"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Run Detail: transactions table + actions + slip drawer ─────────── */

interface RunDetailViewProps {
  runId: string;
  onBack: () => void;
}

function RunDetailView({ runId, onBack }: RunDetailViewProps) {
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [transactions, setTransactions] = useState<PayrollTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { run, transactions } = await getPayrollRun(runId);
      setRun(run);
      setTransactions(transactions);
    } catch {
      toast.error("Failed to load run");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    load();
  }, [load]);

  const onApprove = async () => {
    if (
      !confirm(
        "Approve this run? This locks the attendance cutoff day for the org."
      )
    )
      return;
    setBusy(true);
    try {
      await approvePayrollRun(runId);
      toast.success("Run approved · cutoff locked");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to approve"));
    } finally {
      setBusy(false);
    }
  };

  const onMarkPaid = async () => {
    if (!confirm("Mark this run as PAID?")) return;
    setBusy(true);
    try {
      await markPaidPayrollRun(runId);
      toast.success("Marked as paid");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to mark paid"));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!confirm("Delete this draft run?")) return;
    setBusy(true);
    try {
      await deletePayrollRun(runId);
      toast.success("Run deleted");
      onBack();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to delete"));
    } finally {
      setBusy(false);
    }
  };

  const onEmailAll = async () => {
    if (
      !confirm(
        "Email each employee their slip for this month? This sends to every approved transaction in the run."
      )
    )
      return;
    setBusy(true);
    try {
      const r = await emailAllPayrollSlips(runId);
      const failureMsg =
        r.failures.length > 0 ? ` · ${r.failures.length} failed` : "";
      toast.success(`Sent ${r.sent}/${r.total} slips${failureMsg}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to email slips"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 text-brand animate-spin" />
      </div>
    );
  }
  if (!run) return null;

  const isDraft = run.status === "DRAFT";
  const selectedTx = selectedTxId
    ? transactions.find((t) => t._id === selectedTxId) || null
    : null;

  return (
    <div className="space-y-5">
      {/* Run header card */}
      <div className="rounded-xl border border-white/8 bg-[#0a0a0a] px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-[#161616] ring-1 ring-white/8 flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5 text-brand" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[16px] font-semibold text-white tracking-tight">
                {fyMonthLabel(run.fyMonth, run.fyYear)}
              </h2>
              <span
                className={`inline-flex items-center gap-1 h-5 px-2 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${statusChipClasses(run.status)}`}
              >
                {run.status}
              </span>
            </div>
            <p className="text-[11px] text-[#7a7a7a] mt-0.5">
              Window {fmtDate(run.windowStart)} – {fmtDate(run.windowEnd)} ·
              Cutoff day {run.cutoffDayUsed}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && (
            <>
              <button
                onClick={onDelete}
                disabled={busy}
                className="h-10 px-3 rounded-lg text-[13px] font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete Draft
              </button>
              <button
                onClick={onApprove}
                disabled={busy}
                className="h-10 px-4 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-brand/10"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve & Lock
              </button>
            </>
          )}
          {(run.status === "APPROVED" || run.status === "PAID") && (
            <button
              onClick={onEmailAll}
              disabled={busy}
              className="h-10 px-3 rounded-lg border border-white/10 text-[13px] font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              title="Email each employee their slip"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Email all slips
            </button>
          )}
          {run.status === "APPROVED" && (
            <button
              onClick={onMarkPaid}
              disabled={busy}
              className="h-10 px-4 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-300 text-[13px] font-medium hover:bg-emerald-500/[0.08] transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CircleCheck className="h-4 w-4" />
              )}
              Mark Paid
            </button>
          )}
        </div>
      </div>

      {/* A4: Approve & Lock pre-action explainer (DRAFT only) */}
      {isDraft && (
        <InfoCard variant="warning" title="Approving locks two things">
          <span className="font-semibold">1)</span> The attendance cutoff day
          for the whole org. <span className="font-semibold">2)</span> Every
          transaction in this run becomes read-only. After approval you can
          only Mark Paid or generate slips — no edits.
        </InfoCard>
      )}

      {/* Totals strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Employees", value: run.totals?.employeeCount || 0, isCurrency: false },
          { label: "Gross", value: run.totals?.grossSum || 0, isCurrency: true },
          { label: "TDS", value: run.totals?.tdsSum || 0, isCurrency: true },
          { label: "PF + PT + ESI", value: (run.totals?.pfSum || 0) + (run.totals?.ptSum || 0) + (run.totals?.esiSum || 0), isCurrency: true },
          { label: "Net Pay", value: run.totals?.netSum || 0, isCurrency: true, highlight: true },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border px-4 py-3 ${
              s.highlight
                ? "border-brand/30 bg-brand/[0.03]"
                : "border-white/8 bg-[#0a0a0a]"
            }`}
          >
            <div className="text-[10px] font-semibold text-[#7a7a7a] uppercase tracking-[0.1em] mb-1">
              {s.label}
            </div>
            <div className={`text-[18px] font-bold tabular-nums ${s.highlight ? "text-brand" : "text-white"}`}>
              {s.isCurrency ? INR(s.value) : s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Transactions table */}
      <div className="rounded-xl border border-white/8 bg-[#0a0a0a] overflow-hidden">
        <div className="overflow-x-auto">
        <div className="grid grid-cols-[minmax(0,1.4fr)_80px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_40px] min-w-[580px] gap-3 px-5 py-3 border-b border-white/5 text-[10px] font-semibold text-[#7a7a7a] uppercase tracking-[0.1em]">
          <span>Employee</span>
          <span>Regime</span>
          <span className="text-right">Gross</span>
          <span className="text-right">TDS</span>
          <span className="text-right">Deductions</span>
          <span className="text-right">Net Pay</span>
          <span />
        </div>
        {transactions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[13px] text-[#7a7a7a]">
              No transactions in this run.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {transactions.map((t) => {
              const u = typeof t.userId === "object" ? t.userId : null;
              const name = u?.name || u?.email || "Employee";
              const totalDed =
                (t.pfEmployee || 0) +
                (t.esiEmployee || 0) +
                (t.professionalTax || 0);
              const overridden = !!t.overriddenAt;
              return (
                <button
                  key={t._id}
                  onClick={() => setSelectedTxId(t._id)}
                  className="w-full grid grid-cols-[minmax(0,1.4fr)_80px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_40px] min-w-[580px] gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer text-left items-center"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white truncate flex items-center gap-1.5">
                      {name}
                      {t.attendance?.inGraceWindow && (
                        <span className="inline-flex items-center gap-0.5 h-4 px-1.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-brand/10 text-brand border border-brand/20">
                          Grace
                        </span>
                      )}
                      {overridden && (
                        <span className="inline-flex items-center gap-0.5 h-4 px-1.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Override
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-[#7a7a7a] truncate">
                      {u?.email || ""}
                    </div>
                  </div>
                  <div>
                    <span className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-white/[0.04] text-[#a8a8a8] border border-white/8">
                      {t.regimeUsed}
                    </span>
                  </div>
                  <div className="text-[13px] text-white text-right tabular-nums">
                    {INR(t.grossSalary)}
                  </div>
                  <div className="text-[13px] text-white/80 text-right tabular-nums">
                    {INR(t.monthlyTDS)}
                  </div>
                  <div className="text-[13px] text-white/80 text-right tabular-nums">
                    {INR(totalDed)}
                  </div>
                  <div className="text-[13px] text-white text-right font-semibold tabular-nums">
                    {INR(t.netPay)}
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#5a5a5a]" />
                </button>
              );
            })}
          </div>
        )}
        </div>{/* /overflow-x-auto */}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="h-9 px-3 text-[12px] text-white/70 hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to all runs
        </button>
        <button
          onClick={() => setShowAuditLog(true)}
          className="h-9 px-3 text-[12px] text-white/70 hover:text-white border border-white/8 rounded-lg hover:bg-white/5 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5" />
          Audit log
        </button>
      </div>

      {selectedTx && (
        <SalarySlipDrawer
          tx={selectedTx}
          run={run}
          editable={isDraft}
          onClose={() => setSelectedTxId(null)}
          onSaved={(updated) => {
            setTransactions((prev) =>
              prev.map((t) => (t._id === updated._id ? updated : t))
            );
            // Refresh run totals
            load();
          }}
        />
      )}

      {showAuditLog && (
        <AuditLogDrawer
          run={run}
          transactions={transactions}
          onClose={() => setShowAuditLog(false)}
        />
      )}
    </div>
  );
}

/* ─── Salary slip drawer is in its own file (also used by My Slips) ──── */

/* ─── Audit log drawer — lists all overridden transactions for a run ── */

interface AuditLogDrawerProps {
  run: PayrollRun;
  transactions: PayrollTransaction[];
  onClose: () => void;
}

function AuditLogDrawer({ run, transactions, onClose }: AuditLogDrawerProps) {
  const overrides = transactions
    .filter((t) => !!t.overriddenAt)
    .sort((a, b) => {
      const at = a.overriddenAt ? new Date(a.overriddenAt).getTime() : 0;
      const bt = b.overriddenAt ? new Date(b.overriddenAt).getTime() : 0;
      return bt - at;
    });

  return (
    <div className="fixed inset-0 z-[99999] flex">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex-1 bg-black/60 backdrop-blur-sm cursor-pointer"
      />
      <aside className="w-full max-w-[520px] h-full bg-[#0a0a0a] border-l border-white/8 overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
        <div className="sticky top-0 bg-[#0a0a0a] border-b border-white/8 px-5 py-4 flex items-center justify-between gap-3 z-10">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-white tracking-tight truncate flex items-center gap-2">
              <History className="h-4 w-4 text-brand" />
              Audit Log
            </h3>
            <p className="text-[11px] text-[#7a7a7a] truncate">
              {fyMonthLabel(run.fyMonth, run.fyYear)} · {overrides.length}{" "}
              override{overrides.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-lg hover:bg-white/5 flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-[#a8a8a8]" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <InfoCard variant="neutral">
            Every admin override on a DRAFT transaction is recorded here with
            who made the change, when, and why. Overrides survive run approval
            and are visible to founders and admins.
          </InfoCard>

          {overrides.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-[#050505] py-12 px-5 text-center">
              <p className="text-[13px] text-[#a8a8a8]">
                No overrides on this run yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {overrides.map((t) => {
                const u = typeof t.userId === "object" ? t.userId : null;
                const name = u?.name || u?.email || "Employee";
                const ob =
                  typeof t.overriddenBy === "object" ? t.overriddenBy : null;
                const overrider =
                  ob?.name || ob?.email || "Admin";
                return (
                  <div
                    key={t._id}
                    className="rounded-xl border border-white/8 bg-[#050505] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div className="text-[13px] font-semibold text-white truncate">
                        {name}
                      </div>
                      <div className="text-[10.5px] text-[#7a7a7a] tabular-nums shrink-0">
                        {fmtDate(t.overriddenAt)}
                      </div>
                    </div>
                    <div className="text-[11px] text-[#a8a8a8] mb-2">
                      Overridden by{" "}
                      <span className="text-white">{overrider}</span>
                    </div>
                    {t.overrideNotes ? (
                      <div className="text-[11.5px] text-[#d4d4d4] bg-white/[0.02] rounded-lg px-3 py-2 leading-relaxed border border-white/5">
                        &ldquo;{t.overrideNotes}&rdquo;
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#5a5a5a] italic">
                        No note left.
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-3 text-[10.5px] tabular-nums">
                      <div className="flex justify-between text-[#a8a8a8]">
                        <span>Net Pay</span>
                        <span className="text-white">{INR(t.netPay)}</span>
                      </div>
                      <div className="flex justify-between text-[#a8a8a8]">
                        <span>Monthly TDS</span>
                        <span className="text-white">{INR(t.monthlyTDS)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

type Section = "earning" | "deduction";

interface ComponentDefault {
  componentName: string;
  taxabilityType: TaxabilityType;
  calculationType: CalcType;
  value: number;
}

const COMPONENT_DEFAULTS: Record<ComponentCode, ComponentDefault> = {
  // Earnings
  BASIC: { componentName: "Basic Salary", taxabilityType: "FULLY_TAXABLE", calculationType: "percentCTC", value: 40 },
  DA: { componentName: "Dearness Allowance", taxabilityType: "FULLY_TAXABLE", calculationType: "percentBasic", value: 0 },
  HRA: { componentName: "House Rent Allowance", taxabilityType: "EXEMPT_FORMULA", calculationType: "percentBasic", value: 40 },
  LTA: { componentName: "Leave Travel Allowance", taxabilityType: "EXEMPT_FORMULA", calculationType: "flat", value: 0 },
  SPECIAL: { componentName: "Special Allowance", taxabilityType: "FULLY_TAXABLE", calculationType: "flat", value: 0 },
  CHILDREN_EDU: { componentName: "Children Education Allowance", taxabilityType: "EXEMPT_FIXED", calculationType: "flat", value: 0 },
  CHILDREN_HOSTEL: { componentName: "Children Hostel Allowance", taxabilityType: "EXEMPT_FIXED", calculationType: "flat", value: 0 },
  UNIFORM: { componentName: "Uniform Allowance", taxabilityType: "EXEMPT_FIXED", calculationType: "flat", value: 0 },
  MEDICAL_REIMB: { componentName: "Medical Reimbursement", taxabilityType: "FULLY_TAXABLE", calculationType: "flat", value: 0 },
  TELEPHONE_REIMB: { componentName: "Telephone / Internet Reimb.", taxabilityType: "REIMBURSEMENT", calculationType: "flat", value: 0 },
  BONUS: { componentName: "Bonus", taxabilityType: "FULLY_TAXABLE", calculationType: "flat", value: 0 },
  OVERTIME: { componentName: "Overtime", taxabilityType: "FULLY_TAXABLE", calculationType: "flat", value: 0 },
  LEAVE_ENCASH: { componentName: "Leave Encashment", taxabilityType: "FULLY_TAXABLE", calculationType: "flat", value: 0 },
  PF_EMPLOYER: { componentName: "PF (Employer)", taxabilityType: "EXEMPT_FULL", calculationType: "percentBasicPlusDA", value: 12 },
  NPS_EMPLOYER: { componentName: "NPS (Employer)", taxabilityType: "EXEMPT_FULL", calculationType: "percentBasicPlusDA", value: 10 },
  GRATUITY_PROVISION: { componentName: "Gratuity Provision", taxabilityType: "EXEMPT_FULL", calculationType: "flat", value: 0 },
  // Deductions
  PF_EMPLOYEE: { componentName: "PF (Employee)", taxabilityType: "DEDUCTION_STATUTORY", calculationType: "percentBasicPlusDA", value: 12 },
  ESI_EMPLOYEE: { componentName: "ESI (Employee)", taxabilityType: "DEDUCTION_STATUTORY", calculationType: "percentGross", value: 0.75 },
  PT: { componentName: "Professional Tax", taxabilityType: "DEDUCTION_STATUTORY", calculationType: "flat", value: 200 },
  TDS: { componentName: "TDS", taxabilityType: "DEDUCTION_STATUTORY", calculationType: "flat", value: 0 },
  LOAN_EMI: { componentName: "Loan EMI", taxabilityType: "DEDUCTION_VOLUNTARY", calculationType: "flat", value: 0 },
  ADVANCE_RECOVERY: { componentName: "Advance Recovery", taxabilityType: "DEDUCTION_VOLUNTARY", calculationType: "flat", value: 0 },
  // Catch-all
  CUSTOM: { componentName: "", taxabilityType: "FULLY_TAXABLE", calculationType: "flat", value: 0 },
};

const EARNING_CODES: ComponentCode[] = [
  "BASIC", "DA", "HRA", "LTA", "SPECIAL",
  "CHILDREN_EDU", "CHILDREN_HOSTEL", "UNIFORM",
  "MEDICAL_REIMB", "TELEPHONE_REIMB",
  "BONUS", "OVERTIME", "LEAVE_ENCASH",
  "PF_EMPLOYER", "NPS_EMPLOYER", "GRATUITY_PROVISION",
  "CUSTOM",
];

const DEDUCTION_CODES: ComponentCode[] = [
  "PF_EMPLOYEE", "ESI_EMPLOYEE", "PT", "TDS",
  "LOAN_EMI", "ADVANCE_RECOVERY",
  "CUSTOM",
];

const TAXABILITY_LABELS: Record<TaxabilityType, string> = {
  FULLY_TAXABLE: "Fully Taxable",
  EXEMPT_FORMULA: "Exempt — Formula",
  EXEMPT_FIXED: "Exempt — Fixed Cap",
  EXEMPT_FULL: "Exempt — Full",
  DEDUCTION_STATUTORY: "Statutory Deduction",
  DEDUCTION_VOLUNTARY: "Voluntary Deduction",
  REIMBURSEMENT: "Reimbursement",
};

const CALC_LABELS: Record<CalcType, string> = {
  flat: "Fixed Amount",
  percentBasic: "% of Basic",
  percentBasicPlusDA: "% of Basic + DA",
  percentCTC: "% of CTC",
  percentGross: "% of Gross",
};

function buildEmptyComponent(section: Section): SalaryComponent {
  return {
    componentCode: "CUSTOM",
    componentName: "",
    taxabilityType: section === "earning" ? "FULLY_TAXABLE" : "DEDUCTION_VOLUNTARY",
    calculationType: "flat",
    value: 0,
  };
}

interface StructureFormState {
  name: string;
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
  taxRegime: TaxRegime;
  autoTds: boolean;
  estimatedAnnualTds: number;
}

const emptyForm: StructureFormState = {
  name: "",
  earnings: [],
  deductions: [],
  taxRegime: "new",
  autoTds: true,
  estimatedAnnualTds: 0,
};

function apiErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : "";
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // non-JSON body
  }
  return raw || fallback;
}

function SalaryStructureView() {
  const [items, setItems] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StructureFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { structures } = await listSalaryStructures();
      setItems(structures);
    } catch {
      toast.error("Failed to load salary structures");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(false);
  };

  const onNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const onSelect = (s: SalaryStructure) => {
    setEditingId(s._id);
    setShowForm(true);
    setForm({
      name: s.name,
      earnings: s.earnings?.map((e) => ({ ...e })) || [],
      deductions: s.deductions?.map((d) => ({ ...d })) || [],
      taxRegime: s.taxRegime || "new",
      autoTds: s.autoTds !== false,
      estimatedAnnualTds: s.estimatedAnnualTds || 0,
    });
  };

  const onSave = async () => {
    if (!form.name.trim()) {
      toast.error("Structure name is required");
      return;
    }
    // Drop rows with empty component names so Zod doesn't reject them
    const earnings = form.earnings.filter((e) => e.componentName.trim());
    const deductions = form.deductions.filter((d) => d.componentName.trim());

    // TC_012 / TC_016: individual component value limits
    const MAX_FLAT = 10_000_000;
    for (const e of earnings) {
      if (e.calculationType !== "flat" && e.value > 100) {
        toast.error(
          `"${e.componentName}" has a percentage value of ${e.value}%, which exceeds 100%. Please enter a value between 0 and 100.`
        );
        return;
      }
      if (e.calculationType === "flat" && e.value > MAX_FLAT) {
        toast.error(
          `"${e.componentName}" value ₹${e.value.toLocaleString()} exceeds the maximum allowed amount (₹${MAX_FLAT.toLocaleString()}). Please enter a valid amount.`
        );
        return;
      }
    }
    for (const d of deductions) {
      if (d.calculationType !== "flat" && d.value > 100) {
        toast.error(
          `"${d.componentName}" has a percentage value of ${d.value}%, which exceeds 100%. Please enter a value between 0 and 100.`
        );
        return;
      }
      if (d.calculationType === "flat" && d.value > MAX_FLAT) {
        toast.error(
          `"${d.componentName}" value ₹${d.value.toLocaleString()} exceeds the maximum allowed amount (₹${MAX_FLAT.toLocaleString()}). Please enter a valid amount.`
        );
        return;
      }
    }

    // TC_029: total percentage across earning components must not exceed 100%
    const pctEarnings = earnings.filter((e) => e.calculationType !== "flat");
    const totalPct = pctEarnings.reduce((sum, e) => sum + e.value, 0);
    if (totalPct > 100) {
      toast.error(
        `Total percentage allocation in Fixed Earnings is ${totalPct % 1 === 0 ? totalPct : totalPct.toFixed(1)}%, which exceeds 100%. Please reduce the values so they sum to 100% or less.`
      );
      return;
    }

    // TC_026: Estimated Annual TDS limit
    if (form.estimatedAnnualTds > 100_000_000) {
      toast.error(
        `Estimated Annual TDS ₹${form.estimatedAnnualTds.toLocaleString()} exceeds the maximum allowed (₹10,00,00,000). Please enter a valid amount.`
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        earnings,
        deductions,
        taxRegime: form.taxRegime,
        autoTds: form.autoTds,
        estimatedAnnualTds: form.estimatedAnnualTds,
      };
      if (editingId) {
        await updateSalaryStructure(editingId, payload);
        toast.success("Structure updated");
      } else {
        await createSalaryStructure(payload);
        toast.success("Structure created");
      }
      resetForm();
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to save structure"));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this salary structure?")) return;
    try {
      await deleteSalaryStructure(id);
      toast.success("Structure deleted");
      if (editingId === id) resetForm();
      await load();
    } catch {
      toast.error("Failed to delete structure");
    }
  };

  return (
    <div className="rounded-xl border border-white/8 bg-[#0e0e0e] overflow-hidden">
      <div className="flex flex-col sm:flex-row min-h-[600px]">
        {/* Left pane — structure list */}
        <aside className="w-full sm:w-[260px] shrink-0 border-b sm:border-b-0 sm:border-r border-white/8 flex flex-col bg-[#0a0a0a]">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-white/8">
            <p className="text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-[0.15em] mb-3">
              Structures
            </p>
            <button
              onClick={onNew}
              className="w-full h-10 rounded-lg border border-brand/25 bg-brand/10 text-brand text-[13px] font-semibold hover:bg-brand/15 hover:border-brand/35 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              New Structure
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-4 w-4 text-brand animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-3 text-center">
                <div className="h-10 w-10 rounded-xl bg-white/5 ring-1 ring-white/8 flex items-center justify-center mb-3">
                  <Receipt className="h-4 w-4 text-[#5a5a5a]" />
                </div>
                <p className="text-[12px] text-[#a8a8a8] mb-1">
                  No structures yet
                </p>
                <p className="text-[11px] text-[#5a5a5a] leading-relaxed">
                  Create your first salary template
                </p>
              </div>
            ) : (
              items.map((s) => {
                const isActive = editingId === s._id;
                return (
                  <button
                    key={s._id}
                    onClick={() => onSelect(s)}
                    className={`group relative w-full text-left px-3.5 py-3 rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? "bg-white/[0.04]"
                        : "bg-transparent hover:bg-white/[0.02]"
                    }`}
                  >
                    {/* Subtle left bar for active state */}
                    {isActive && (
                      <span className="absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-r-full bg-brand/70" />
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <h3
                        className={`text-[14px] font-medium truncate flex-1 ${
                          isActive ? "text-white" : "text-[#d4d4d4]"
                        }`}
                      >
                        {s.name}
                      </h3>
                      <Pencil
                        className={`h-3.5 w-3.5 shrink-0 transition-opacity ${
                          isActive
                            ? "text-[#7a7a7a] opacity-100"
                            : "text-[#5a5a5a] opacity-0 group-hover:opacity-100"
                        }`}
                      />
                    </div>
                    <p className="text-[12px] text-[#7a7a7a] tabular-nums">
                      {s.earnings?.length || 0} earnings · {s.deductions?.length || 0} deductions
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right pane — form */}
        <section className="flex-1 flex flex-col min-w-0">
          {!showForm ? (
            <div className="flex-1 flex flex-col items-stretch justify-center p-10">
              {/* A5: salary structure explainer */}
              <div className="mb-6 max-w-xl mx-auto w-full">
                <InfoCard variant="info" title="What's a salary structure?">
                  A reusable template that defines how an employee&rsquo;s pay
                  is calculated — earnings (Basic, HRA, Special) and
                  deductions (PF, PT, TDS). Each employee picks one structure
                  plus a Monthly CTC anchor; the engine computes the rest.
                </InfoCard>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="h-16 w-16 rounded-2xl bg-[#161616] flex items-center justify-center ring-1 ring-white/8">
                    <Receipt className="h-7 w-7 text-[#5a5a5a]" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-lg bg-brand/10 flex items-center justify-center ring-1 ring-brand/20">
                    <SettingsIcon className="h-3.5 w-3.5 text-brand" />
                  </div>
                </div>
                <h3 className="text-[16px] font-semibold text-white mb-1.5 tracking-tight">
                  Salary Structure Setup
                </h3>
                <p className="text-[13px] text-[#a8a8a8] max-w-sm mb-7 leading-relaxed">
                  Pick a structure on the left, or create a new one to get
                  started.
                </p>
                <button
                  onClick={onNew}
                  className="h-10 px-5 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-brand/10"
                >
                  <Plus className="h-4 w-4" />
                  New Structure
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6 pb-24 space-y-5">
                {/* Structure Name */}
                <FormCard icon={Receipt} title="Structure Details">
                  <Field label="Structure Name" required>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. Engineering – Senior"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                  </Field>
                </FormCard>

                {/* Fixed Earnings */}
                <ComponentTable
                  title="Fixed Earnings"
                  subtitle="Components added to gross pay"
                  icon={TrendingUp}
                  section="earning"
                  rows={form.earnings}
                  onChange={(rows) =>
                    setForm((f) => ({ ...f, earnings: rows }))
                  }
                  onAdd={() =>
                    setForm((f) => ({
                      ...f,
                      earnings: [...f.earnings, buildEmptyComponent("earning")],
                    }))
                  }
                  onUseDefaults={
                    !editingId
                      ? async () => {
                          try {
                            const defaults = await getSalaryStructureDefaults();
                            setForm((f) => ({
                              ...f,
                              earnings: defaults.earnings,
                              deductions:
                                f.deductions.length > 0
                                  ? f.deductions
                                  : defaults.deductions,
                            }));
                          } catch {
                            toast.error("Failed to load defaults");
                          }
                        }
                      : undefined
                  }
                />

                {/* Deductions */}
                <ComponentTable
                  title="Deductions"
                  subtitle="Amounts subtracted from gross pay"
                  icon={DollarSign}
                  section="deduction"
                  rows={form.deductions}
                  onChange={(rows) =>
                    setForm((f) => ({ ...f, deductions: rows }))
                  }
                  onAdd={() =>
                    setForm((f) => ({
                      ...f,
                      deductions: [
                        ...f.deductions,
                        buildEmptyComponent("deduction"),
                      ],
                    }))
                  }
                />

                {/* Tax Settings */}
                <FormCard icon={Shield} title="Tax Settings" subtitle="Choose regime and TDS calculation">
                  <div className="space-y-4">
                    {/* Regime selector */}
                    <div>
                      <p className="text-[11px] font-medium text-[#a8a8a8] uppercase tracking-wider mb-2.5">
                        Tax Regime
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {(["old", "new"] as TaxRegime[]).map((r) => {
                          const checked = form.taxRegime === r;
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() =>
                                setForm((f) => ({ ...f, taxRegime: r }))
                              }
                              className={`relative text-left p-4 rounded-xl border transition-all cursor-pointer ${
                                checked
                                  ? "border-brand/30 bg-brand/[0.04]"
                                  : "border-white/8 bg-[#050505] hover:border-white/12 hover:bg-white/[0.02]"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2.5">
                                <span
                                  className={`text-[13px] font-semibold ${
                                    checked ? "text-white" : "text-[#d4d4d4]"
                                  }`}
                                >
                                  {r === "old" ? "Old Regime" : "New Regime"}
                                </span>
                                {checked && (
                                  <div className="h-[18px] w-[18px] rounded-full bg-brand/12 ring-1 ring-brand/45 flex items-center justify-center">
                                    <Check className="h-2.5 w-2.5 text-brand" strokeWidth={3} />
                                  </div>
                                )}
                              </div>
                              <ul className="text-[11px] text-[#a8a8a8] space-y-1 leading-relaxed">
                                {r === "old" ? (
                                  <>
                                    <li>More deductions available</li>
                                    <li>HRA, 80C, 80D exemptions</li>
                                    <li>Higher tax with deductions</li>
                                  </>
                                ) : (
                                  <>
                                    <li>Lower tax slabs</li>
                                    <li>Limited exemptions</li>
                                    <li>Simplified calculation</li>
                                  </>
                                )}
                              </ul>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Auto-TDS toggle row */}
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, autoTds: !f.autoTds }))
                      }
                      className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        form.autoTds
                          ? "border-brand/25 bg-brand/[0.03]"
                          : "border-white/8 bg-[#050505] hover:border-white/12"
                      }`}
                    >
                      <div
                        className={`mt-0.5 h-[18px] w-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
                          form.autoTds
                            ? "bg-brand/12 border-brand/45"
                            : "bg-[#050505] border-white/15"
                        }`}
                      >
                        {form.autoTds && <Check className="h-3 w-3 text-brand" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-white mb-0.5">
                          Auto-TDS
                        </p>
                        <p className="text-[11px] text-[#a8a8a8] leading-relaxed">
                          Recalculate TDS on every payroll run based on employee
                          declarations
                        </p>
                      </div>
                    </button>

                    {/* Estimated Annual TDS */}
                    <Field label="Estimated Annual TDS">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#5a5a5a] font-medium pointer-events-none">
                          ₹
                        </span>
                        <NumericInput
                          className={`${inputCls} pl-7 tabular-nums`}
                          value={form.estimatedAnnualTds}
                          onChange={(v) =>
                            setForm((f) => ({ ...f, estimatedAnnualTds: v }))
                          }
                          max={100_000_000}
                        />
                      </div>
                    </Field>
                  </div>
                </FormCard>
              </div>

              {/* Sticky footer */}
              <div className="border-t border-white/8 bg-[#0a0a0a] px-6 py-4 flex items-center justify-between gap-3">
                <div>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => onDelete(editingId)}
                      className="h-10 px-3 rounded-lg text-[13px] font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Structure
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="h-10 px-4 rounded-lg border border-white/8 text-[13px] font-medium text-[#a8a8a8] hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className="h-10 px-5 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {editingId ? "Save Changes" : "Create Structure"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Shared form primitives for the salary structure view

const inputCls =
  "w-full h-11 rounded-lg border border-white/8 bg-[#050505] px-3.5 text-[12px] text-white placeholder:text-[#5a5a5a] outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/10 transition-colors";

function FormCard({
  icon: Icon,
  title,
  subtitle,
  children,
  rightSlot,
}: {
  icon: typeof Receipt;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#0a0a0a] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-white/[0.04] ring-1 ring-white/8 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-[#a8a8a8]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-white tracking-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-[#7a7a7a] mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {rightSlot}
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[#a8a8a8] uppercase tracking-wider mb-1.5 block">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function NumericInput({
  value,
  onChange,
  className,
  placeholder = "0",
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  placeholder?: string;
  max?: number;
}) {
  const [text, setText] = useState<string>(value ? String(value) : "");
  const exceedsMax = max !== undefined && value > max;

  useEffect(() => {
    const parsed = text === "" ? 0 : Number(text);
    if (parsed !== value) setText(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      className={`${className ?? ""}${exceedsMax ? " !border-red-500/60 focus:!border-red-500/70 focus:!ring-red-500/15" : ""}`}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^\d.]/g, "");
        setText(cleaned);
        const n = cleaned === "" ? 0 : Number(cleaned);
        onChange(Number.isNaN(n) ? 0 : n);
      }}
    />
  );
}

interface ComponentTableProps {
  title: string;
  subtitle?: string;
  icon: typeof Receipt;
  section: Section;
  rows: SalaryComponent[];
  onChange: (rows: SalaryComponent[]) => void;
  onAdd: () => void;
  onUseDefaults?: () => void | Promise<void>;
}

function ComponentTable({
  title,
  subtitle,
  icon,
  section,
  rows,
  onChange,
  onAdd,
  onUseDefaults,
}: ComponentTableProps) {
  const codeOptions = section === "earning" ? EARNING_CODES : DEDUCTION_CODES;
  const MAX_FLAT = 10_000_000;

  // Running total of percentage-based components (for TC_029 live feedback)
  const pctRows = rows.filter((r) => r.calculationType !== "flat");
  const totalPct = pctRows.reduce((sum, r) => sum + (r.value || 0), 0);
  const showPctTotal = section === "earning" && pctRows.length > 0;

  const patch = (idx: number, changes: Partial<SalaryComponent>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...changes } : r)));
  };
  const remove = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };
  const onCodeChange = (idx: number, code: ComponentCode) => {
    const def = COMPONENT_DEFAULTS[code];
    const current = rows[idx];
    // If row was untouched-CUSTOM (default empty name), apply full defaults.
    // Otherwise, only swap fields the user is unlikely to have customised.
    if (code === "CUSTOM") {
      patch(idx, { componentCode: code });
      return;
    }
    patch(idx, {
      componentCode: code,
      componentName: current.componentName?.trim()
        ? current.componentName
        : def.componentName,
      taxabilityType: def.taxabilityType,
      calculationType: def.calculationType,
      value: current.value || def.value,
    });
  };

  return (
    <FormCard
      icon={icon}
      title={title}
      subtitle={subtitle}
      rightSlot={
        <div className="flex items-center gap-3 shrink-0">
          {onUseDefaults && (
            <button
              type="button"
              onClick={onUseDefaults}
              className="h-7 px-2.5 rounded-md text-[11px] font-medium text-brand hover:bg-brand/10 transition-colors cursor-pointer"
            >
              Use defaults
            </button>
          )}
          <span className="text-[11px] font-medium text-[#7a7a7a] tabular-nums">
            {rows.length} {rows.length === 1 ? "component" : "components"}
          </span>
        </div>
      }
    >
      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-lg border border-dashed border-white/10 bg-[#050505]">
          <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center mb-2.5">
            <Plus className="h-4 w-4 text-[#5a5a5a]" />
          </div>
          <p className="text-[12px] text-[#a8a8a8] mb-3">
            No components added yet
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onAdd}
              className="h-8 px-3 rounded-md bg-brand text-brand-foreground text-[12px] font-semibold hover:bg-brand/90 active:scale-[0.97] transition-all cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add first component
            </button>
            {onUseDefaults && (
              <button
                onClick={onUseDefaults}
                className="h-8 px-3 rounded-md border border-white/10 text-[12px] font-medium text-[#a8a8a8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Or use defaults
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Column header */}
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1fr)_110px_36px] gap-2.5 px-3 pb-2.5 border-b border-white/5">
            <span className="text-[10px] font-semibold text-[#7a7a7a] uppercase tracking-[0.1em]">
              Component
            </span>
            <span className="text-[10px] font-semibold text-[#7a7a7a] uppercase tracking-[0.1em]">
              Type
            </span>
            <span className="text-[10px] font-semibold text-[#7a7a7a] uppercase tracking-[0.1em]">
              Calculation
            </span>
            <span className="text-[10px] font-semibold text-[#7a7a7a] uppercase tracking-[0.1em]">
              Value
            </span>
            <span />
          </div>

          {/* Rows */}
          <div className="space-y-1.5 mt-2">
            {rows.map((r, idx) => {
              const isPct = r.calculationType !== "flat";
              const isCustom = r.componentCode === "CUSTOM";
              return (
                <div
                  key={idx}
                  className="group grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1fr)_110px_36px] gap-2.5 items-start px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                >
                  {/* Component code + (when CUSTOM) free-form name */}
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Select
                      value={r.componentCode}
                      onValueChange={(v) =>
                        onCodeChange(idx, v as ComponentCode)
                      }
                    >
                      <SelectTrigger className="h-11 text-[12px] bg-[#050505] border-white/8 text-white focus:border-brand/40 focus-visible:ring-1 focus-visible:ring-brand/10 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#161616] border-white/10 text-white max-h-[280px]">
                        {codeOptions.map((c) => (
                          <SelectItem
                            key={c}
                            value={c}
                            className="text-[12px]"
                          >
                            {c === "CUSTOM"
                              ? "Custom (Other)"
                              : COMPONENT_DEFAULTS[c].componentName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isCustom && (
                      <input
                        type="text"
                        className="w-full h-9 px-3 text-[12px] rounded-md border border-white/8 bg-[#050505] text-white placeholder:text-[#5a5a5a] outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/10 transition-colors"
                        placeholder="Component name"
                        value={r.componentName}
                        onChange={(e) =>
                          patch(idx, { componentName: e.target.value })
                        }
                      />
                    )}
                  </div>

                  {/* Taxability type */}
                  <Select
                    value={r.taxabilityType}
                    onValueChange={(v) =>
                      patch(idx, { taxabilityType: v as TaxabilityType })
                    }
                  >
                    <SelectTrigger className="h-11 text-[12px] bg-[#050505] border-white/8 text-white focus:border-brand/40 focus-visible:ring-1 focus-visible:ring-brand/10 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161616] border-white/10 text-white">
                      {(Object.keys(TAXABILITY_LABELS) as TaxabilityType[]).map(
                        (t) => (
                          <SelectItem key={t} value={t} className="text-[12px]">
                            {TAXABILITY_LABELS[t]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>

                  {/* Calculation type */}
                  <Select
                    value={r.calculationType}
                    onValueChange={(v) =>
                      patch(idx, { calculationType: v as CalcType })
                    }
                  >
                    <SelectTrigger className="h-11 text-[12px] bg-[#050505] border-white/8 text-white focus:border-brand/40 focus-visible:ring-1 focus-visible:ring-brand/10 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161616] border-white/10 text-white">
                      {(Object.keys(CALC_LABELS) as CalcType[]).map((c) => (
                        <SelectItem key={c} value={c} className="text-[12px]">
                          {CALC_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#5a5a5a] font-medium pointer-events-none">
                      {isPct ? "%" : "₹"}
                    </span>
                    <NumericInput
                      className="w-full h-11 pl-7 pr-3 text-[12px] rounded-lg border border-white/8 bg-[#050505] text-white outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/10 transition-colors tabular-nums"
                      value={r.value}
                      onChange={(v) => patch(idx, { value: v })}
                      max={isPct ? 100 : MAX_FLAT}
                    />
                  </div>

                  {/* Delete */}
                  <div className="flex justify-center pt-1.5">
                    <button
                      onClick={() => remove(idx)}
                      className="h-8 w-8 rounded-md hover:bg-red-500/10 flex items-center justify-center cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove component"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400/70" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Percentage total indicator (TC_029) */}
          {showPctTotal && (
            <div
              className={`mx-3 mt-2.5 px-3 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 ${
                totalPct > 100
                  ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                  : totalPct === 100
                  ? "bg-green-500/10 text-green-400 ring-1 ring-green-500/20"
                  : "bg-white/5 text-[#a8a8a8] ring-1 ring-white/10"
              }`}
            >
              {totalPct > 100 ? (
                <AlertTriangle className="h-3 w-3 shrink-0" />
              ) : (
                <Check className="h-3 w-3 shrink-0" />
              )}
              Percentage allocation: {totalPct % 1 === 0 ? totalPct : totalPct.toFixed(1)}% / 100%
              {totalPct > 100 && " — exceeds limit"}
            </div>
          )}

          {/* Add row button */}
          <button
            onClick={onAdd}
            className="mt-3 ml-3 text-[12px] font-medium text-brand hover:text-brand/80 flex items-center gap-1 cursor-pointer group transition-colors"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
            Add component
          </button>
        </>
      )}
    </FormCard>
  );
}

