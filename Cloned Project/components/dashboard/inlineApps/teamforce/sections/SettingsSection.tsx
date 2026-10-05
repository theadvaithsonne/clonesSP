"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Calendar as CalendarIcon,
  Shield,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Check,
  Coffee,
  Calculator,
  Percent,
  ChevronDown,
  ChevronRight,
  Lock,
  RefreshCw,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { getUserIdFromToken } from "@/lib/auth";
import {
  getEmployee,
  listShifts,
  createShift,
  updateShift,
  deleteShift,
  listWeeklyOffPatterns,
  createWeeklyOffPattern,
  updateWeeklyOffPattern,
  deleteWeeklyOffPattern,
  listLeavePolicies,
  createLeavePolicy,
  updateLeavePolicy,
  deleteLeavePolicy,
  listDepartments,
  listBreakPolicies,
  createBreakPolicy,
  updateBreakPolicy,
  deleteBreakPolicy,
  getPayrollConfig,
  updatePayrollConfig,
  unlockPayrollConfig,
  listPTSlabs,
  createPTSlab,
  updatePTSlab,
  deletePTSlab,
  seedPTSlabs,
} from "../api";
import type {
  Shift,
  WeeklyOffPattern,
  LeavePolicy,
  LeavePolicyApplicableFor,
  LeavePolicyType,
  BreakPolicy,
  BreakScopeType,
  Department,
  PayrollConfig,
  PTSlab,
} from "../types";
import InfoCard from "../lib/InfoCard";

type Tab =
  | "shift"
  | "pattern"
  | "policy"
  | "break"
  | "payroll-config"
  | "pt-slabs";

interface TabDef {
  id: Tab;
  label: string;
  icon: typeof Clock;
  founderOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: "shift", label: "Define Shift", icon: Clock },
  { id: "pattern", label: "Weekly Off Pattern", icon: CalendarIcon },
  { id: "policy", label: "Leave Policy", icon: Shield },
  { id: "break", label: "Break Policy", icon: Coffee },
  // TEMP: Payroll Config + PT Slabs tabs hidden from the UI for now.
  // Uncomment to restore (tab content rendering below still handles them).
  // { id: "payroll-config", label: "Payroll Config", icon: Calculator },
  // { id: "pt-slabs", label: "PT Slabs", icon: Percent, founderOnly: true },
];

export default function SettingsSection() {
  const { amIFounder, loading: founderLoading } = useAmIFounder();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("shift");

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
          Settings are available only to admins and founders.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Settings
        </h2>
        <p className="text-sm text-[#7a7a7a] mt-1">
          Configure shifts, weekly-off patterns, leave & break policies, and
          payroll setup
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/8 mb-6 overflow-x-auto">
        {TABS.filter((t) => !t.founderOnly || amIFounder).map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
                isActive
                  ? "text-white border-brand"
                  : "text-[#7a7a7a] border-transparent hover:text-white/80"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === "shift" && <ShiftsTab />}
      {activeTab === "pattern" && <PatternsTab />}
      {activeTab === "policy" && <PoliciesTab />}
      {activeTab === "break" && <BreakPolicyTab />}
      {activeTab === "payroll-config" && <PayrollConfigTab />}
      {activeTab === "pt-slabs" && amIFounder && <PTSlabsTab />}
    </div>
  );
}

/* ----------------------------- Shared bits ----------------------------- */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#0e0e0e] p-5">
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] text-[#a0a0a0] font-medium uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full h-10 rounded-lg border border-white/10 bg-[#050505] px-3 text-[13px] text-white placeholder:text-[#5a5a5a] outline-none focus:border-brand/50 transition-colors [color-scheme:dark]";

const btnPrimary =
  "h-10 px-4 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";

const btnGhost =
  "h-10 px-4 rounded-lg border border-white/10 bg-transparent text-white/80 text-[13px] font-medium hover:bg-white/5 active:scale-[0.98] transition-all cursor-pointer";

const iconBtn =
  "h-8 w-8 rounded-md flex items-center justify-center text-[#7a7a7a] hover:text-white hover:bg-white/8 cursor-pointer transition-colors";

const EmptyRow = ({ label }: { label: string }) => (
  <div className="text-center py-10 text-[#5a5a5a] text-[13px]">
    No {label} yet. Add one above to get started.
  </div>
);

/** Extract a readable message from an API error (api() throws Error with the
 *  raw response body — usually `{"error":"..."}`). Falls back to the original
 *  message for non-JSON bodies. */
function apiErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : "";
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // not JSON — fall through
  }
  return raw || fallback;
}

/* ------------------------------- Shifts -------------------------------- */

type ShiftForm = {
  name: string;
  startTime: string;
  endTime: string;
  workingHours: string;
  graceMinutes: string;
  breakMinutes: string;
};

const emptyShift: ShiftForm = {
  name: "",
  startTime: "",
  endTime: "",
  workingHours: "",
  graceMinutes: "",
  breakMinutes: "",
};

function ShiftsTab() {
  const [items, setItems] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ShiftForm>(emptyShift);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { shifts } = await listShifts();
      setItems(shifts);
    } catch {
      toast.error("Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setEditingId(null);
    setForm(emptyShift);
    setShowForm(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.startTime || !form.endTime) {
      toast.error("Name, start time, and end time are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        startTime: form.startTime,
        endTime: form.endTime,
        workingHours: Number(form.workingHours) || 0,
        graceMinutes: parseInt(form.graceMinutes || "0", 10),
        breakMinutes: parseInt(form.breakMinutes || "0", 10),
      };
      if (editingId) {
        await updateShift(editingId, payload);
        toast.success("Shift updated");
      } else {
        await createShift(payload);
        toast.success("Shift created");
      }
      reset();
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to save shift"));
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (s: Shift) => {
    setEditingId(s._id);
    setShowForm(true);
    setForm({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      workingHours: String(s.workingHours ?? ""),
      graceMinutes: String(s.graceMinutes ?? ""),
      breakMinutes: String(s.breakMinutes ?? ""),
    });
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this shift?")) return;
    try {
      await deleteShift(id);
      toast.success("Shift deleted");
      if (editingId === id) reset();
      await load();
    } catch {
      toast.error("Failed to delete shift");
    }
  };

  return (
    <div className="space-y-6">
      {showForm && (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-white">
            {editingId ? "Edit Shift" : "Add Shift"}
          </h3>
          <button type="button" onClick={reset} className={iconBtn} title="Cancel">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Shift Name" className="lg:col-span-3">
            <input
              className={inputCls}
              placeholder="e.g. Morning Shift"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Start Time">
            <input
              type="time"
              className={inputCls}
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </Field>
          <Field label="End Time">
            <input
              type="time"
              className={inputCls}
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </Field>
          <Field label="Working Hours">
            <input
              type="number"
              step="0.25"
              min="0"
              className={inputCls}
              placeholder="8"
              value={form.workingHours}
              onChange={(e) => setForm({ ...form, workingHours: e.target.value })}
            />
          </Field>
          <Field label="Grace Time (mins)">
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder="10"
              value={form.graceMinutes}
              onChange={(e) => setForm({ ...form, graceMinutes: e.target.value })}
            />
          </Field>
          <Field label="Break Duration (mins)">
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder="60"
              value={form.breakMinutes}
              onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingId ? "Update Shift" : "Add Shift"}
            </button>
            <button type="button" onClick={reset} className={btnGhost}>
              Cancel
            </button>
          </div>
        </form>
      </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-white">All Shifts</h3>
          {!showForm && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyShift);
                setShowForm(true);
              }}
              className={btnPrimary}
            >
              <Plus className="h-4 w-4" />
              Add Shift
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 text-brand animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyRow label="shifts" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-[#7a7a7a] uppercase tracking-wide border-b border-white/8">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Start</th>
                  <th className="py-2 pr-4 font-medium">End</th>
                  <th className="py-2 pr-4 font-medium">Hours</th>
                  <th className="py-2 pr-4 font-medium">Grace</th>
                  <th className="py-2 pr-4 font-medium">Break</th>
                  <th className="py-2 pr-0 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr
                    key={s._id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="py-3 pr-4 text-white font-medium">{s.name}</td>
                    <td className="py-3 pr-4 text-white/80">{s.startTime}</td>
                    <td className="py-3 pr-4 text-white/80">{s.endTime}</td>
                    <td className="py-3 pr-4 text-white/80">
                      {s.workingHours ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-white/80">
                      {s.graceMinutes ?? 0} min
                    </td>
                    <td className="py-3 pr-4 text-white/80">
                      {s.breakMinutes ?? 0} min
                    </td>
                    <td className="py-3 pr-0">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit(s)}
                          className={iconBtn}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(s._id)}
                          className={`${iconBtn} hover:text-red-400`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ----------------------- Weekly Off Patterns --------------------------- */

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type PatternForm = {
  name: string;
  patternType: "Fixed" | "Rotating";
  offDays: number[];
};

const emptyPattern: PatternForm = {
  name: "",
  patternType: "Fixed",
  offDays: [],
};

function PatternsTab() {
  const [items, setItems] = useState<WeeklyOffPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PatternForm>(emptyPattern);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { patterns } = await listWeeklyOffPatterns();
      setItems(patterns);
    } catch {
      toast.error("Failed to load patterns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setEditingId(null);
    setForm(emptyPattern);
    setShowForm(false);
  };

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      offDays: f.offDays.includes(d)
        ? f.offDays.filter((x) => x !== d)
        : [...f.offDays, d].sort(),
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Pattern name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        patternType: form.patternType,
        offDays: form.offDays,
      };
      if (editingId) {
        await updateWeeklyOffPattern(editingId, payload);
        toast.success("Pattern updated");
      } else {
        await createWeeklyOffPattern(payload);
        toast.success("Pattern created");
      }
      reset();
      await load();
    } catch {
      toast.error("Failed to save pattern");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (p: WeeklyOffPattern) => {
    setEditingId(p._id);
    setShowForm(true);
    setForm({
      name: p.name,
      patternType: p.patternType || "Fixed",
      offDays: [...(p.offDays || [])].sort(),
    });
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this pattern?")) return;
    try {
      await deleteWeeklyOffPattern(id);
      toast.success("Pattern deleted");
      if (editingId === id) reset();
      await load();
    } catch {
      toast.error("Failed to delete pattern");
    }
  };

  return (
    <div className="space-y-6">
      {showForm && (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-white">
            {editingId ? "Edit Pattern" : "Add Pattern"}
          </h3>
          <button type="button" onClick={reset} className={iconBtn} title="Cancel">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Pattern Name">
              <input
                className={inputCls}
                placeholder="e.g. Standard Weekend Off"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Pattern Type">
              <select
                className={inputCls}
                value={form.patternType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    patternType: e.target.value as "Fixed" | "Rotating",
                  })
                }
              >
                <option value="Fixed">Fixed</option>
                <option value="Rotating">Rotating</option>
              </select>
            </Field>
          </div>

          <Field label="Select Off Days">
            <div className="flex flex-wrap gap-2 pt-1">
              {DAY_LABELS.map((label, idx) => {
                const selected = form.offDays.includes(idx);
                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    className={`h-9 px-3.5 rounded-lg text-[12px] font-medium border transition-all cursor-pointer ${
                      selected
                        ? "bg-brand text-brand-foreground border-brand"
                        : "bg-transparent text-white/70 border-white/10 hover:border-white/25"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingId ? "Update Pattern" : "Add Pattern"}
            </button>
            <button type="button" onClick={reset} className={btnGhost}>
              Cancel
            </button>
          </div>
        </form>
      </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-white">All Patterns</h3>
          {!showForm && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyPattern);
                setShowForm(true);
              }}
              className={btnPrimary}
            >
              <Plus className="h-4 w-4" />
              Add Pattern
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 text-brand animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyRow label="patterns" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-[#7a7a7a] uppercase tracking-wide border-b border-white/8">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Off Days</th>
                  <th className="py-2 pr-0 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p._id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="py-3 pr-4 text-white font-medium">{p.name}</td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/5 text-white/80 text-[11px]">
                        {p.patternType || "Fixed"}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {(p.offDays || []).length === 0 ? (
                        <span className="text-[#5a5a5a]">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {[...p.offDays]
                            .sort()
                            .map((d) => (
                              <span
                                key={d}
                                className="px-1.5 py-0.5 rounded bg-brand/10 text-brand text-[11px] font-medium"
                              >
                                {DAY_LABELS[d]}
                              </span>
                            ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-0">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit(p)}
                          className={iconBtn}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(p._id)}
                          className={`${iconBtn} hover:text-red-400`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ----------------------------- Leave Policies -------------------------- */

type PolicyForm = {
  name: string;
  leaveType: LeavePolicyType;
  annualQuota: string;
  maxConsecutiveDays: string;
  applicableFor: LeavePolicyApplicableFor;
  allowCarryForward: boolean;
  allowEncashment: boolean;
};

const emptyPolicy: PolicyForm = {
  name: "",
  leaveType: "Paid",
  annualQuota: "",
  maxConsecutiveDays: "",
  applicableFor: "All Employees",
  allowCarryForward: false,
  allowEncashment: false,
};

const APPLICABLE_OPTIONS: LeavePolicyApplicableFor[] = [
  "All Employees",
  "Full-Time Only",
  "Contract Only",
];

function PoliciesTab() {
  const [items, setItems] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyForm>(emptyPolicy);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { policies } = await listLeavePolicies();
      setItems(policies);
    } catch {
      toast.error("Failed to load policies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setEditingId(null);
    setForm(emptyPolicy);
    setShowForm(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Policy name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        leaveType: form.leaveType,
        annualQuota: parseInt(form.annualQuota || "0", 10),
        maxConsecutiveDays: parseInt(form.maxConsecutiveDays || "0", 10),
        applicableFor: form.applicableFor,
        allowCarryForward: form.allowCarryForward,
        allowEncashment: form.allowEncashment,
      };
      if (editingId) {
        await updateLeavePolicy(editingId, payload);
        toast.success("Policy updated");
      } else {
        await createLeavePolicy(payload);
        toast.success("Policy created");
      }
      reset();
      await load();
    } catch {
      toast.error("Failed to save policy");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (p: LeavePolicy) => {
    setEditingId(p._id);
    setShowForm(true);
    setForm({
      name: p.name,
      leaveType: p.leaveType,
      annualQuota: String(p.annualQuota ?? ""),
      maxConsecutiveDays: String(p.maxConsecutiveDays ?? ""),
      applicableFor: p.applicableFor,
      allowCarryForward: !!p.allowCarryForward,
      allowEncashment: !!p.allowEncashment,
    });
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this policy?")) return;
    try {
      await deleteLeavePolicy(id);
      toast.success("Policy deleted");
      if (editingId === id) reset();
      await load();
    } catch {
      toast.error("Failed to delete policy");
    }
  };

  return (
    <div className="space-y-6">
      {showForm && (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-white">
            {editingId ? "Edit Policy" : "Add Leave Policy"}
          </h3>
          <button type="button" onClick={reset} className={iconBtn} title="Cancel">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Policy Name" className="lg:col-span-2">
            <input
              className={inputCls}
              placeholder="e.g. Casual Leave"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Leave Type">
            <select
              className={inputCls}
              value={form.leaveType}
              onChange={(e) =>
                setForm({
                  ...form,
                  leaveType: e.target.value as LeavePolicyType,
                })
              }
            >
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </Field>
          <Field label="Annual Quota (days)">
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder="12"
              value={form.annualQuota}
              onChange={(e) => setForm({ ...form, annualQuota: e.target.value })}
            />
          </Field>
          <Field label="Max Consecutive Days">
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder="5"
              value={form.maxConsecutiveDays}
              onChange={(e) =>
                setForm({ ...form, maxConsecutiveDays: e.target.value })
              }
            />
          </Field>
          <Field label="Applicable For">
            <select
              className={inputCls}
              value={form.applicableFor}
              onChange={(e) =>
                setForm({
                  ...form,
                  applicableFor: e.target.value as LeavePolicyApplicableFor,
                })
              }
            >
              {APPLICABLE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-[13px] text-white/80">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-[#050505] accent-brand cursor-pointer"
                checked={form.allowCarryForward}
                onChange={(e) =>
                  setForm({ ...form, allowCarryForward: e.target.checked })
                }
              />
              Allow Carry Forward
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[13px] text-white/80">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-[#050505] accent-brand cursor-pointer"
                checked={form.allowEncashment}
                onChange={(e) =>
                  setForm({ ...form, allowEncashment: e.target.checked })
                }
              />
              Allow Encashment
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingId ? "Update Policy" : "Add Policy"}
            </button>
            <button type="button" onClick={reset} className={btnGhost}>
              Cancel
            </button>
          </div>
        </form>
      </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-white">All Policies</h3>
          {!showForm && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyPolicy);
                setShowForm(true);
              }}
              className={btnPrimary}
            >
              <Plus className="h-4 w-4" />
              Add Policy
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 text-brand animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyRow label="policies" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-[#7a7a7a] uppercase tracking-wide border-b border-white/8">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Quota</th>
                  <th className="py-2 pr-4 font-medium">Max Consec.</th>
                  <th className="py-2 pr-4 font-medium">Applicable</th>
                  <th className="py-2 pr-4 font-medium">CF</th>
                  <th className="py-2 pr-4 font-medium">Encash</th>
                  <th className="py-2 pr-0 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p._id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="py-3 pr-4 text-white font-medium">{p.name}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          p.leaveType === "Paid"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-white/5 text-white/80"
                        }`}
                      >
                        {p.leaveType}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-white/80">{p.annualQuota}</td>
                    <td className="py-3 pr-4 text-white/80">
                      {p.maxConsecutiveDays}
                    </td>
                    <td className="py-3 pr-4 text-white/80">{p.applicableFor}</td>
                    <td className="py-3 pr-4">
                      {p.allowCarryForward ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <span className="text-[#5a5a5a]">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {p.allowEncashment ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <span className="text-[#5a5a5a]">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-0">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit(p)}
                          className={iconBtn}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(p._id)}
                          className={`${iconBtn} hover:text-red-400`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------- Break Policy ----------------------------- */

type BreakForm = Omit<BreakPolicy, "_id" | "orgId">;

const emptyBreak: BreakForm = {
  name: "",
  activateBreaks: false,
  scopeType: "Universal",
  scopeTargets: [],
  breakMinutesPerDay: 60,
  breachAffectsPayroll: false,
  maxBreachMinutesAllowed: 0,
  maxBreachesAllowed: 0,
  payrollImpact: {
    deductHalfDay: false,
    deductHourly: { enabled: false, ofBasic: false, ofCtc: false },
    fixedAmount: 0,
  },
};

function BreakPolicyTab() {
  const [items, setItems] = useState<BreakPolicy[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BreakForm>(emptyBreak);
  const [designationInput, setDesignationInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ policies }, { departments: depts }] = await Promise.all([
        listBreakPolicies(),
        listDepartments(),
      ]);
      setItems(policies);
      setDepartments(depts);
    } catch {
      toast.error("Failed to load break policies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setEditingId(null);
    setForm(emptyBreak);
    setDesignationInput("");
    setShowForm(false);
  };

  const setScopeType = (scopeType: BreakScopeType) => {
    setForm((f) => ({ ...f, scopeType, scopeTargets: [] }));
  };

  const toggleDept = (id: string) => {
    setForm((f) => {
      const has = f.scopeTargets.includes(id);
      return {
        ...f,
        scopeTargets: has
          ? f.scopeTargets.filter((x) => x !== id)
          : [...f.scopeTargets, id],
      };
    });
  };

  const addDesignation = () => {
    const v = designationInput.trim();
    if (!v) return;
    if (form.scopeTargets.includes(v)) {
      setDesignationInput("");
      return;
    }
    setForm((f) => ({ ...f, scopeTargets: [...f.scopeTargets, v] }));
    setDesignationInput("");
  };

  const removeDesignation = (v: string) => {
    setForm((f) => ({
      ...f,
      scopeTargets: f.scopeTargets.filter((x) => x !== v),
    }));
  };

  const onSave = async () => {
    if (!form.name.trim()) {
      toast.error("Policy name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim() };
      if (editingId) {
        await updateBreakPolicy(editingId, payload);
        toast.success("Break policy updated");
      } else {
        await createBreakPolicy(payload);
        toast.success("Break policy created");
      }
      reset();
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to save break policy"));
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (p: BreakPolicy) => {
    setEditingId(p._id || null);
    setShowForm(true);
    setDesignationInput("");
    setForm({
      name: p.name || "",
      activateBreaks: !!p.activateBreaks,
      scopeType: p.scopeType || "Universal",
      scopeTargets: p.scopeTargets || [],
      breakMinutesPerDay: p.breakMinutesPerDay ?? 60,
      breachAffectsPayroll: !!p.breachAffectsPayroll,
      maxBreachMinutesAllowed: p.maxBreachMinutesAllowed ?? 0,
      maxBreachesAllowed: p.maxBreachesAllowed ?? 0,
      payrollImpact: {
        deductHalfDay: !!p.payrollImpact?.deductHalfDay,
        deductHourly: {
          enabled: !!p.payrollImpact?.deductHourly?.enabled,
          ofBasic: !!p.payrollImpact?.deductHourly?.ofBasic,
          ofCtc: !!p.payrollImpact?.deductHourly?.ofCtc,
        },
        fixedAmount: p.payrollImpact?.fixedAmount ?? 0,
      },
    });
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this break policy?")) return;
    try {
      await deleteBreakPolicy(id);
      toast.success("Break policy deleted");
      if (editingId === id) reset();
      await load();
    } catch {
      toast.error("Failed to delete break policy");
    }
  };

  const scopeLabel = (p: BreakPolicy) => {
    if (p.scopeType === "By Department") {
      const names = (p.scopeTargets || [])
        .map((id) => departments.find((d) => d._id === id)?.name || id)
        .filter(Boolean)
        .join(", ");
      return names ? `Dept: ${names}` : "Dept: —";
    }
    if (p.scopeType === "By Designation") {
      return (p.scopeTargets || []).length
        ? `Desig: ${(p.scopeTargets || []).join(", ")}`
        : "Desig: —";
    }
    return "Everyone";
  };

  return (
    <div className="space-y-6">
      {showForm && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold text-white">
                {editingId ? "Edit Break Policy" : "Add Break Policy"}
              </h3>
              <button
                type="button"
                onClick={reset}
                className={iconBtn}
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-4">
              <Field label="Policy Name">
                <input
                  className={inputCls}
                  placeholder="e.g. Standard Break Policy"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </Field>
            </div>

            <div className="flex items-start justify-between gap-4 pt-4 border-t border-white/8">
              <div>
                <h4 className="text-[13px] font-semibold text-white">
                  Activate Breaks
                </h4>
                <p className="text-[12px] text-[#7a7a7a] mt-1 max-w-lg">
                  When off, this policy doesn&apos;t apply. Turn on to make it
                  active for employees in its scope.
                </p>
              </div>
              <Toggle
                checked={form.activateBreaks}
                onChange={(v) =>
                  setForm((f) => ({ ...f, activateBreaks: v }))
                }
              />
            </div>
          </Card>

          <Card>
            <h3 className="text-[14px] font-semibold text-white mb-4">
              Break Time Allowed
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Applies To">
                <select
                  className={inputCls}
                  value={form.scopeType}
                  onChange={(e) =>
                    setScopeType(e.target.value as BreakScopeType)
                  }
                >
                  <option value="Universal">Universal (everyone)</option>
                  <option value="By Department">By Department</option>
                  <option value="By Designation">By Designation</option>
                </select>
              </Field>

              <Field label="Break Minutes Per Day">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={form.breakMinutesPerDay}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      breakMinutesPerDay: Math.max(
                        0,
                        Number(e.target.value) || 0
                      ),
                    }))
                  }
                />
              </Field>
            </div>

            {form.scopeType === "By Department" && (
              <div>
                <div className="text-[11px] text-[#a0a0a0] font-medium uppercase tracking-wide mb-2">
                  Select Departments
                </div>
                {departments.length === 0 ? (
                  <p className="text-[12px] text-[#7a7a7a]">
                    No departments defined yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {departments.map((d) => {
                      const checked = form.scopeTargets.includes(d._id);
                      return (
                        <button
                          key={d._id}
                          type="button"
                          onClick={() => toggleDept(d._id)}
                          className={`h-8 px-3 rounded-md text-[12px] font-medium border transition-colors cursor-pointer ${
                            checked
                              ? "bg-brand text-brand-foreground border-brand"
                              : "bg-[#050505] text-white/80 border-white/10 hover:bg-white/5"
                          }`}
                        >
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {form.scopeType === "By Designation" && (
              <div>
                <div className="text-[11px] text-[#a0a0a0] font-medium uppercase tracking-wide mb-2">
                  Designations
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    className={inputCls}
                    placeholder="Type designation and press Enter"
                    value={designationInput}
                    onChange={(e) => setDesignationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addDesignation();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addDesignation}
                    className={btnGhost}
                  >
                    Add
                  </button>
                </div>
                {form.scopeTargets.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.scopeTargets.map((v) => (
                      <span
                        key={v}
                        className="h-8 px-3 rounded-md text-[12px] font-medium bg-white/5 text-white/80 border border-white/10 inline-flex items-center gap-1.5"
                      >
                        {v}
                        <button
                          type="button"
                          onClick={() => removeDesignation(v)}
                          className="text-[#7a7a7a] hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-[14px] font-semibold text-white">
                  Breach Affects Payroll
                </h3>
                <p className="text-[12px] text-[#7a7a7a] mt-1 max-w-lg">
                  Employees can still exceed the daily budget — toggle this on
                  to also reduce their pay when they do.
                </p>
              </div>
              <Toggle
                checked={form.breachAffectsPayroll}
                onChange={(v) =>
                  setForm((f) => ({ ...f, breachAffectsPayroll: v }))
                }
              />
            </div>

            {form.breachAffectsPayroll && (
              <div className="space-y-4 pt-4 border-t border-white/8">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Max Breach Minutes Allowed (per day)">
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={form.maxBreachMinutesAllowed}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          maxBreachMinutesAllowed: Math.max(
                            0,
                            Number(e.target.value) || 0
                          ),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Max Breaches Allowed (per month)">
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={form.maxBreachesAllowed}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          maxBreachesAllowed: Math.max(
                            0,
                            Number(e.target.value) || 0
                          ),
                        }))
                      }
                    />
                  </Field>
                </div>

                <div>
                  <div className="text-[11px] text-[#a0a0a0] font-medium uppercase tracking-wide mb-2">
                    Payroll Impact
                  </div>
                  <div className="space-y-2">
                    <CheckRow
                      checked={form.payrollImpact.deductHalfDay}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          payrollImpact: {
                            ...f.payrollImpact,
                            deductHalfDay: v,
                          },
                        }))
                      }
                      label="Deduct a half-day when breached"
                    />
                    <CheckRow
                      checked={form.payrollImpact.deductHourly.enabled}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          payrollImpact: {
                            ...f.payrollImpact,
                            deductHourly: {
                              ...f.payrollImpact.deductHourly,
                              enabled: v,
                            },
                          },
                        }))
                      }
                      label="Deduct hourly pay for breach minutes"
                    />
                    {form.payrollImpact.deductHourly.enabled && (
                      <div className="pl-6 space-y-2">
                        <CheckRow
                          checked={form.payrollImpact.deductHourly.ofBasic}
                          onChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              payrollImpact: {
                                ...f.payrollImpact,
                                deductHourly: {
                                  ...f.payrollImpact.deductHourly,
                                  ofBasic: v,
                                },
                              },
                            }))
                          }
                          label="Based on Basic salary"
                        />
                        <CheckRow
                          checked={form.payrollImpact.deductHourly.ofCtc}
                          onChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              payrollImpact: {
                                ...f.payrollImpact,
                                deductHourly: {
                                  ...f.payrollImpact.deductHourly,
                                  ofCtc: v,
                                },
                              },
                            }))
                          }
                          label="Based on CTC"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3 pt-2">
                      <span className="text-[12px] text-white/80">
                        Fixed deduction amount per breach
                      </span>
                      <input
                        type="number"
                        min={0}
                        className={`${inputCls} w-36 h-9`}
                        value={form.payrollImpact.fixedAmount}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            payrollImpact: {
                              ...f.payrollImpact,
                              fixedAmount: Math.max(
                                0,
                                Number(e.target.value) || 0
                              ),
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} className={btnGhost}>
              Cancel
            </button>
            <button onClick={onSave} disabled={saving} className={btnPrimary}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingId ? "Update Break Policy" : "Add Break Policy"}
            </button>
          </div>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-white">
            All Break Policies
          </h3>
          {!showForm && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyBreak);
                setDesignationInput("");
                setShowForm(true);
              }}
              className={btnPrimary}
            >
              <Plus className="h-4 w-4" />
              Add Break Policy
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 text-brand animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyRow label="break policies" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-[#7a7a7a] uppercase tracking-wide border-b border-white/8">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Applies To</th>
                  <th className="py-2 pr-4 font-medium">Min / Day</th>
                  <th className="py-2 pr-4 font-medium">Breach Affects Pay</th>
                  <th className="py-2 pr-0 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p._id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="py-3 pr-4 text-white font-medium">
                      {p.name || (
                        <span className="text-[#7a7a7a] italic">
                          (unnamed)
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          p.activateBreaks
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-white/5 text-white/60"
                        }`}
                      >
                        {p.activateBreaks ? "Activated" : "Off"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-white/80">
                      {scopeLabel(p)}
                    </td>
                    <td className="py-3 pr-4 text-white/80">
                      {p.breakMinutesPerDay} min
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          p.breachAffectsPayroll
                            ? "bg-brand/10 text-brand"
                            : "bg-white/5 text-white/60"
                        }`}
                      >
                        {p.breachAffectsPayroll ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="py-3 pr-0">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit(p)}
                          className={iconBtn}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => p._id && onDelete(p._id)}
                          className={`${iconBtn} hover:text-red-400`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer flex-shrink-0 overflow-hidden ${
        checked ? "bg-brand" : "bg-white/20"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <span
        onClick={() => onChange(!checked)}
        className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
          checked
            ? "bg-brand border-brand"
            : "bg-[#050505] border-white/20 hover:border-white/40"
        }`}
      >
        {checked && <Check className="h-3 w-3 text-black" />}
      </span>
      <span className="text-[12px] text-white/80">{label}</span>
    </label>
  );
}

/* =====================================================================
 * Payroll Config Tab — org-level cutoff day, default state, lock status
 * ===================================================================*/

function PayrollConfigTab() {
  const { amIFounder } = useAmIFounder();
  const [config, setConfig] = useState<PayrollConfig | null>(null);
  const [states, setStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [draft, setDraft] = useState<{
    attendanceCutoffDay: number;
    defaultState: string;
  } | null>(null);

  const onUnlockCutoff = async () => {
    if (
      !confirm(
        "Master unlock the attendance cutoff day? This is a founder-only override — use only if the wrong cutoff was approved by mistake. Existing approved runs were computed against the previous cutoff window and won't be retroactively recalculated."
      )
    )
      return;
    setUnlocking(true);
    try {
      const { config } = await unlockPayrollConfig();
      setConfig(config);
      setDraft({
        attendanceCutoffDay: config.attendanceCutoffDay,
        defaultState: config.defaultState,
      });
      toast.success("Cutoff unlocked");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to unlock"));
    } finally {
      setUnlocking(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ config }, { states }] = await Promise.all([
        getPayrollConfig(),
        listPTSlabs(),
      ]);
      setConfig(config);
      setStates(states);
      setDraft({
        attendanceCutoffDay: config.attendanceCutoffDay,
        defaultState: config.defaultState,
      });
    } catch {
      toast.error("Failed to load payroll config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty =
    config &&
    draft &&
    (draft.attendanceCutoffDay !== config.attendanceCutoffDay ||
      draft.defaultState !== config.defaultState);

  const onSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const { config } = await updatePayrollConfig(draft);
      setConfig(config);
      setDraft({
        attendanceCutoffDay: config.attendanceCutoffDay,
        defaultState: config.defaultState,
      });
      toast.success("Payroll config saved");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config || !draft) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-brand animate-spin" />
      </div>
    );
  }

  const cutoffOptions = Array.from({ length: 28 }, (_, i) => i + 1);
  const lockedFmt = config.lockedSince
    ? new Date(config.lockedSince).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-5 max-w-2xl">
      <Card>
        <div className="mb-5">
          <h3 className="text-[15px] font-semibold text-white tracking-tight">
            Payroll Configuration
          </h3>
          <p className="text-[12px] text-[#7a7a7a] mt-1">
            Set the attendance cutoff date and default state. The cutoff date
            locks after the first payroll run is approved.
          </p>
        </div>

        {/* B1: lock status banner + founder-only master unlock */}
        <div className="mb-5 space-y-2">
          {config.locked ? (
            <>
              <InfoCard variant="warning" icon={Lock}>
                Cutoff{lockedFmt ? ` locked since ${lockedFmt}` : " is locked"}.
                Editing is disabled.{" "}
                {amIFounder ? (
                  <>Founders can master-unlock below.</>
                ) : (
                  <>Reach out to a founder to override.</>
                )}
              </InfoCard>
              {amIFounder && (
                <div className="flex items-center justify-end">
                  <button
                    onClick={onUnlockCutoff}
                    disabled={unlocking}
                    className="h-9 px-3 text-[12px] font-medium text-amber-300 border border-amber-500/30 bg-amber-500/[0.04] rounded-lg hover:bg-amber-500/[0.08] transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {unlocking ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                    Master unlock cutoff
                  </button>
                </div>
              )}
            </>
          ) : (
            <InfoCard variant="success">
              Cutoff is unlocked — change it freely. It locks automatically
              on first run approval.
            </InfoCard>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cutoff day */}
          <Field label="Attendance Cutoff Day">
            <Select
              value={String(draft.attendanceCutoffDay)}
              onValueChange={(v) =>
                setDraft({ ...draft, attendanceCutoffDay: Number(v) })
              }
              disabled={config.locked}
            >
              <SelectTrigger
                className={`h-11 text-[12px] bg-[#050505] border-white/8 text-white focus:border-brand/40 focus-visible:ring-1 focus-visible:ring-brand/10 transition-colors ${
                  config.locked ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#161616] border-white/10 text-white max-h-[280px]">
                {cutoffOptions.map((d) => (
                  <SelectItem
                    key={d}
                    value={String(d)}
                    className="text-[12px]"
                  >
                    Day {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10.5px] text-[#7a7a7a] mt-1.5 leading-relaxed">
              Days 29–31 are blocked — they cause errors in February. Common
              choices: 1, 16, 18, 25.
            </p>
          </Field>

          {/* Default state */}
          <Field label="Default State (for PT)">
            <Select
              value={draft.defaultState}
              onValueChange={(v) => setDraft({ ...draft, defaultState: v })}
            >
              <SelectTrigger className="h-11 text-[12px] bg-[#050505] border-white/8 text-white focus:border-brand/40 focus-visible:ring-1 focus-visible:ring-brand/10 transition-colors">
                <SelectValue placeholder="Select state…" />
              </SelectTrigger>
              <SelectContent className="bg-[#161616] border-white/10 text-white max-h-[280px]">
                {states.map((s) => (
                  <SelectItem key={s} value={s} className="text-[12px]">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10.5px] text-[#7a7a7a] mt-1.5 leading-relaxed">
              Used for Professional Tax lookup when an employee has no state set.
            </p>
          </Field>
        </div>

        {/* Save bar */}
        <div className="flex items-center justify-end mt-6 pt-4 border-t border-white/5">
          <button
            onClick={onSave}
            disabled={!dirty || saving}
            className="h-10 px-5 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Save Changes
          </button>
        </div>
      </Card>
    </div>
  );
}

/* =====================================================================
 * PT Slabs Tab — founder-only, state-grouped slab editor
 * ===================================================================*/

function PTSlabsTab() {
  const [slabs, setSlabs] = useState<PTSlab[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { slabs } = await listPTSlabs();
      setSlabs(slabs);
    } catch {
      toast.error("Failed to load PT slabs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSeed = async () => {
    setSeeding(true);
    try {
      const { inserted } = await seedPTSlabs();
      toast.success(
        inserted > 0
          ? `Seeded ${inserted} new slab${inserted === 1 ? "" : "s"}`
          : "All canonical slabs already present"
      );
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to seed slabs"));
    } finally {
      setSeeding(false);
    }
  };

  // Group by state, preserving slab insertion order within each state.
  const grouped = slabs.reduce<Record<string, PTSlab[]>>((acc, s) => {
    (acc[s.state] ||= []).push(s);
    return acc;
  }, {});
  const states = Object.keys(grouped).sort();

  const toggleState = (state: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  };

  const onPatch = async (id: string, patch: Partial<PTSlab>) => {
    try {
      const { slab } = await updatePTSlab(id, patch);
      setSlabs((prev) => prev.map((s) => (s._id === id ? slab : s)));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to update slab"));
    }
  };

  const onAdd = async (state: string) => {
    try {
      const { slab } = await createPTSlab({
        state,
        grossFrom: 0,
        grossTo: null,
        monthlyPT: 0,
        monthOverride: null,
      });
      setSlabs((prev) => [...prev, slab]);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to add slab"));
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this slab?")) return;
    try {
      await deletePTSlab(id);
      setSlabs((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to delete slab"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-white tracking-tight">
            Professional Tax Slabs
          </h3>
          <p className="text-[12px] text-[#7a7a7a] mt-1">
            State-keyed monthly PT lookup. Annual cap of ₹2,500 per spec.
          </p>
        </div>
        <button
          onClick={onSeed}
          disabled={seeding}
          className="h-9 px-3 text-[12px] text-white/80 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {seeding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Seed canonical slabs
        </button>
      </div>

      {/* B2: PT slabs purpose */}
      <InfoCard variant="info">
        Professional Tax slabs are looked up by employee state + monthly gross
        during every payroll run. Edit only if your state&rsquo;s slab changes;
        the seeded values match the spec for FY 2024-25.
      </InfoCard>

      {states.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="h-10 w-10 rounded-lg bg-white/5 ring-1 ring-white/8 flex items-center justify-center mb-3">
              <Percent className="h-4 w-4 text-[#5a5a5a]" />
            </div>
            <p className="text-[13px] text-[#a8a8a8] mb-3">
              No PT slabs configured yet
            </p>
            <button
              onClick={onSeed}
              className="h-9 px-3 rounded-md bg-brand text-brand-foreground text-[12px] font-semibold hover:bg-brand/90 cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Seed canonical slabs
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {states.map((state) => {
            const isOpen = expanded.has(state);
            const rows = grouped[state];
            return (
              <div
                key={state}
                className="rounded-xl border border-white/8 bg-[#0a0a0a] overflow-hidden"
              >
                <button
                  onClick={() => toggleState(state)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-[#7a7a7a]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#7a7a7a]" />
                    )}
                    <span className="text-[13px] font-semibold text-white">
                      {state}
                    </span>
                    <span className="text-[11px] text-[#7a7a7a]">
                      · {rows.length} slab{rows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/5 px-4 py-3">
                    <div className="grid grid-cols-[1fr_1fr_1fr_120px_36px] gap-2 px-2 pb-2 text-[10px] font-semibold text-[#7a7a7a] uppercase tracking-[0.1em]">
                      <span>Gross From (₹)</span>
                      <span>Gross To (₹)</span>
                      <span>Monthly PT (₹)</span>
                      <span>Month Override</span>
                      <span />
                    </div>
                    <div className="space-y-1">
                      {rows.map((row) => (
                        <PTSlabRow
                          key={row._id}
                          row={row}
                          onPatch={(patch) => onPatch(row._id, patch)}
                          onDelete={() => onDelete(row._id)}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => onAdd(state)}
                      className="mt-3 ml-2 text-[12px] font-medium text-brand hover:text-brand/80 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add slab
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PTSlabRow({
  row,
  onPatch,
  onDelete,
}: {
  row: PTSlab;
  onPatch: (patch: Partial<PTSlab>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({
    grossFrom: String(row.grossFrom),
    grossTo: row.grossTo === null ? "" : String(row.grossTo),
    monthlyPT: String(row.monthlyPT),
    monthOverride: row.monthOverride === null ? "" : String(row.monthOverride),
  });

  const commit = () => {
    const grossFrom = Number(draft.grossFrom) || 0;
    const grossTo = draft.grossTo === "" ? null : Number(draft.grossTo);
    const monthlyPT = Number(draft.monthlyPT) || 0;
    const monthOverride =
      draft.monthOverride === "" ? null : Number(draft.monthOverride);
    if (
      grossFrom === row.grossFrom &&
      grossTo === row.grossTo &&
      monthlyPT === row.monthlyPT &&
      monthOverride === row.monthOverride
    ) {
      return;
    }
    onPatch({ grossFrom, grossTo, monthlyPT, monthOverride });
  };

  const cls =
    "w-full h-10 px-3 text-[12px] rounded-md border border-white/8 bg-[#050505] text-white placeholder:text-[#5a5a5a] outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/10 transition-colors tabular-nums";

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_120px_36px] gap-2 items-center px-2 py-1.5 rounded-md hover:bg-white/[0.02] group">
      <input
        type="text"
        inputMode="numeric"
        className={cls}
        value={draft.grossFrom}
        onChange={(e) => setDraft({ ...draft, grossFrom: e.target.value })}
        onBlur={commit}
      />
      <input
        type="text"
        inputMode="numeric"
        placeholder="and above"
        className={cls}
        value={draft.grossTo}
        onChange={(e) => setDraft({ ...draft, grossTo: e.target.value })}
        onBlur={commit}
      />
      <input
        type="text"
        inputMode="numeric"
        className={cls}
        value={draft.monthlyPT}
        onChange={(e) => setDraft({ ...draft, monthlyPT: e.target.value })}
        onBlur={commit}
      />
      <input
        type="text"
        inputMode="numeric"
        placeholder="all months"
        className={cls}
        value={draft.monthOverride}
        onChange={(e) => setDraft({ ...draft, monthOverride: e.target.value })}
        onBlur={commit}
      />
      <button
        onClick={onDelete}
        className="h-8 w-8 rounded-md hover:bg-red-500/10 flex items-center justify-center cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
        title="Remove slab"
      >
        <Trash2 className="h-3.5 w-3.5 text-red-400/70" />
      </button>
    </div>
  );
}
