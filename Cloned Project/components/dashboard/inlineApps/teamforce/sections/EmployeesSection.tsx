"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  Crown,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  MoreHorizontal,
  Shield,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  listEmployees,
  listDepartments,
  listShifts,
  listWeeklyOffPatterns,
  createShift,
  createWeeklyOffPattern,
  updateEmployeeProfile,
  setTeamforceRole,
} from "../api";
import type {
  EmployeeListItem,
  EmployeeStatus,
  Section,
  Department,
  Shift,
  WeeklyOffPattern,
} from "../types";

const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: "full-time", label: "Full-Time" },
  { value: "part-time", label: "Part-Time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "freelance", label: "Freelance" },
];

interface BulkEditRow {
  departmentId: string;
  reportingManagerId: string;
  dateOfJoining: string;
  employmentType: string;
  designation: string;
  shiftId: string;
  weeklyOffPatternId: string;
}

const STATUS_BADGE: Record<EmployeeStatus, { label: string; className: string }> = {
  invited: {
    label: "Invited",
    className:
      "rounded-full border-transparent bg-[#FFEDD5] text-[#C2410C] hover:bg-[#FFEDD5] px-2.5 py-0.5 text-[11px] font-medium",
  },
  onboarded: {
    label: "Onboarded",
    className:
      "rounded-full border-transparent bg-[#E0E7FF] text-[#4338CA] hover:bg-[#E0E7FF] px-2.5 py-0.5 text-[11px] font-medium",
  },
  active: {
    label: "Active",
    className:
      "rounded-full border-transparent bg-[#D1FAE5] text-[#047857] hover:bg-[#D1FAE5] px-2.5 py-0.5 text-[11px] font-medium",
  },
  inactive: {
    label: "Inactive",
    className:
      "rounded-full border-transparent bg-[#E5E7EB] text-[#4B5563] hover:bg-[#E5E7EB] px-2.5 py-0.5 text-[11px] font-medium",
  },
};

const SEARCH_INPUT_CLASS =
  "w-full h-11 pl-10 pr-4 rounded-lg bg-[#1e1e1e] border border-white/10 text-sm text-white placeholder:text-[#8a8a8a] focus:outline-none focus:border-white/20 focus:ring-0 transition-all duration-200";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function formatJoiningDate(emp: EmployeeListItem): string {
  const raw = emp.profile?.dateOfJoining || emp.joinedAt;
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function memberRoleLabel(role: EmployeeListItem["role"]): string {
  if (role === "founder") return "Founder";
  if (role === "stakeholder") return "Stakeholder";
  return role || "—";
}

function EmployeeAvatar({
  emp,
  size = "md",
}: {
  emp: EmployeeListItem;
  size?: "sm" | "md" | "lg";
}) {
  const sizeCls =
    size === "lg" ? "h-10 w-10 text-sm" : size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-xs";
  const initial = (emp.name || "?").charAt(0).toUpperCase();
  if (emp.profilePicture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={emp.profilePicture}
        alt={emp.name || "Employee"}
        className={`${sizeCls} rounded-full object-cover shrink-0 ring-1 ring-white/10`}
      />
    );
  }
  return (
    <div
      className={`${sizeCls} rounded-full bg-brand/15 text-brand ring-1 ring-brand/25 flex items-center justify-center font-bold shrink-0`}
    >
      {initial}
    </div>
  );
}

const BULK_CELL =
  "h-9 w-full min-w-0 text-[12px] md:text-[12px] bg-[#141414] border border-white/10 rounded-lg text-white shadow-none focus:ring-1 focus:ring-brand/30 focus:border-brand/40";

const CHECKBOX_CLASS =
  "border-white/20 data-[state=checked]:bg-brand data-[state=checked]:border-brand data-[state=checked]:text-brand-foreground";

/** Fallback labels (same as design mock) used when Settings has no rows yet. */
const DEFAULT_SHIFT_OPTIONS = ["General", "Morning", "Evening", "Night"] as const;
const DEFAULT_PATTERN_OPTIONS: Array<{
  name: string;
  patternType: "Fixed" | "Rotating";
  offDays: number[];
}> = [
  { name: "Sat-Sun", patternType: "Fixed", offDays: [0, 6] },
  { name: "Sun Only", patternType: "Fixed", offDays: [0] },
  { name: "Rotating", patternType: "Rotating", offDays: [] },
];

function isMongoId(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}

function getProfileId(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "_id" in val) {
    return (val as { _id: string })._id;
  }
  return "";
}

interface Props {
  hasWriteAccess: boolean;
  isFounder: boolean;
  onNavigate: (section: Section, userId?: string) => void;
  /** When true, open directly in Bulk Assign edit mode (dock shortcut). */
  initialBulkMode?: boolean;
}

export default function EmployeesSection({
  hasWriteAccess,
  isFounder,
  onNavigate,
  initialBulkMode = false,
}: Props) {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Bulk-edit mode — admins can select onboarded employees and edit
  // fields inline in the grid, then Save Changes patches each selected employee.
  const [bulkMode, setBulkMode] = useState(initialBulkMode);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, BulkEditRow>>({});
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [weeklyOffPatterns, setWeeklyOffPatterns] = useState<WeeklyOffPattern[]>([]);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!hasWriteAccess) return;
    let cancelled = false;

    // Load independently so one failing endpoint doesn't wipe the others.
    listDepartments()
      .then((d) => {
        if (!cancelled) setDepartments(d.departments || []);
      })
      .catch(() => {});

    listShifts()
      .then((s) => {
        if (cancelled) return;
        const raw = Array.isArray(s)
          ? s
          : (s as { shifts?: Shift[] }).shifts ||
            (s as { data?: Shift[] }).data ||
            [];
        setShifts(raw.filter((x) => x && x.isActive !== false));
      })
      .catch(() => {});

    listWeeklyOffPatterns()
      .then((w) => {
        if (cancelled) return;
        const raw = Array.isArray(w)
          ? w
          : (w as { patterns?: WeeklyOffPattern[] }).patterns ||
            (w as { weeklyOffPatterns?: WeeklyOffPattern[] }).weeklyOffPatterns ||
            (w as { data?: WeeklyOffPattern[] }).data ||
            [];
        setWeeklyOffPatterns(raw.filter((x) => x && x.isActive !== false));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [hasWriteAccess, bulkMode]);

  // Options shown in dropdowns — fall back to design defaults when Settings is empty.
  const shiftOptions = useMemo(() => {
    if (shifts.length > 0) {
      return shifts.map((s) => ({ value: s._id, label: s.name }));
    }
    return DEFAULT_SHIFT_OPTIONS.map((name) => ({
      value: `name:${name}`,
      label: name,
    }));
  }, [shifts]);

  const patternOptions = useMemo(() => {
    if (weeklyOffPatterns.length > 0) {
      return weeklyOffPatterns.map((p) => ({ value: p._id, label: p.name }));
    }
    return DEFAULT_PATTERN_OPTIONS.map((p) => ({
      value: `name:${p.name}`,
      label: p.name,
    }));
  }, [weeklyOffPatterns]);

  // Tell the global bottom dock that bulk-edit-grid mode is active so it can
  // temporarily show every Teamforce section (including ones normally hidden
  // behind a feature flag). Always reset to false on unmount so navigating
  // away from Employees (or closing Teamforce) restores the normal dock.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("teamforce:bulk-edit-mode", { detail: { active: bulkMode } })
    );
  }, [bulkMode]);
  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent("teamforce:bulk-edit-mode", { detail: { active: false } })
      );
    };
  }, []);

  function toggleSelect(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function exitBulkMode() {
    setBulkMode(false);
    setSelectedIds(new Set());
    setEditValues({});
    setPage(1);
    // Dock shortcut opens this as the "bulk-assign" section — leave back to Employees.
    if (initialBulkMode) {
      onNavigate("employees");
    }
  }

  function seedBulkRow(e: EmployeeListItem): BulkEditRow {
    return {
      departmentId: getProfileId(e.profile?.departmentId),
      reportingManagerId: getProfileId(e.profile?.reportingManagerId),
      dateOfJoining: e.profile?.dateOfJoining
        ? new Date(e.profile.dateOfJoining).toISOString().split("T")[0]
        : "",
      employmentType: e.profile?.employmentType || "",
      designation: e.profile?.designation || "",
      shiftId: getProfileId(e.profile?.shiftId),
      weeklyOffPatternId: getProfileId(e.profile?.weeklyOffPatternId),
    };
  }

  function enterBulkEditMode() {
    const seed: Record<string, BulkEditRow> = {};
    for (const e of employees) {
      if (e.status !== "onboarded") continue;
      seed[e.userId] = seedBulkRow(e);
    }
    setEditValues(seed);
    setSelectedIds(new Set());
    setPage(1);
    setBulkMode(true);
  }

  // Seed bulk-edit rows when opened via the dock "Bulk Assign" shortcut.
  useEffect(() => {
    if (!initialBulkMode || loading || !hasWriteAccess) return;
    if (Object.keys(editValues).length > 0) return;
    enterBulkEditMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once after first load
  }, [initialBulkMode, loading, hasWriteAccess, employees]);

  function updateEditValue(userId: string, field: keyof BulkEditRow, value: string) {
    setEditValues((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value },
    }));
    // Editing a field is an implicit "include this row in Save Changes".
    setSelectedIds((prev) => (prev.has(userId) ? prev : new Set(prev).add(userId)));
  }

  async function resolveShiftId(value: string): Promise<string | null> {
    if (!value) return null;
    if (isMongoId(value)) return value;
    if (!value.startsWith("name:")) return value;
    const name = value.slice(5);
    const existing = shifts.find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing._id;
    // Defaults for common shift names when Settings has none yet.
    const presets: Record<string, { startTime: string; endTime: string }> = {
      General: { startTime: "09:00", endTime: "18:00" },
      Morning: { startTime: "06:00", endTime: "14:00" },
      Evening: { startTime: "14:00", endTime: "22:00" },
      Night: { startTime: "22:00", endTime: "06:00" },
    };
    const times = presets[name] || { startTime: "09:00", endTime: "18:00" };
    const created = await createShift({
      name,
      startTime: times.startTime,
      endTime: times.endTime,
      workingHours: 8,
      graceMinutes: 10,
      breakMinutes: 60,
    });
    const shift = created.shift;
    setShifts((prev) => [...prev, shift]);
    return shift._id;
  }

  async function resolvePatternId(value: string): Promise<string | null> {
    if (!value) return null;
    if (isMongoId(value)) return value;
    if (!value.startsWith("name:")) return value;
    const name = value.slice(5);
    const existing = weeklyOffPatterns.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing._id;
    const preset =
      DEFAULT_PATTERN_OPTIONS.find((p) => p.name === name) || {
        name,
        patternType: "Fixed" as const,
        offDays: [0],
      };
    const created = await createWeeklyOffPattern({
      name: preset.name,
      patternType: preset.patternType,
      offDays: preset.offDays,
    });
    const pattern = created.pattern;
    setWeeklyOffPatterns((prev) => [...prev, pattern]);
    return pattern._id;
  }

  async function saveBulkEdits() {
    if (selectedIds.size === 0) {
      toast.error("Select at least one employee to save changes for");
      return;
    }
    setSaving(true);
    let ok = 0;
    let failed = 0;
    for (const userId of selectedIds) {
      const row = editValues[userId];
      if (!row) continue;
      const patch: Record<string, unknown> = {};
      if (row.departmentId) patch.departmentId = row.departmentId;
      if (row.reportingManagerId) patch.reportingManagerId = row.reportingManagerId;
      if (row.dateOfJoining) patch.dateOfJoining = row.dateOfJoining;
      if (row.employmentType) patch.employmentType = row.employmentType;
      if (row.designation) patch.designation = row.designation;
      try {
        if (row.shiftId) {
          const shiftId = await resolveShiftId(row.shiftId);
          if (shiftId) patch.shiftId = shiftId;
        }
        if (row.weeklyOffPatternId) {
          const weeklyOffPatternId = await resolvePatternId(row.weeklyOffPatternId);
          if (weeklyOffPatternId) patch.weeklyOffPatternId = weeklyOffPatternId;
        }
        if (Object.keys(patch).length === 0) continue;
        await updateEmployeeProfile(userId, patch);
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setSaving(false);
    if (failed === 0) {
      toast.success(`Updated ${ok} employee${ok === 1 ? "" : "s"}`);
    } else {
      toast.error(
        `Updated ${ok}, failed on ${failed} — check those profiles individually`
      );
    }
    exitBulkMode();
    await load();
  }

  async function load() {
    try {
      const res = await listEmployees();
      setEmployees(res.employees || []);
    } catch {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /**
   * Grant / revoke the Teamforce admin role.
   *
   * Founder-only, matching the backend: PATCH /teamforce/employees/:userId/role
   * runs `requireFounderOnly`, so a non-founder would just get a 403. The
   * dropdown is therefore hidden for non-founders rather than shown-and-failing.
   *
   * Reloads the list afterwards so the "Admin Role" column reflects the change
   * — the endpoint returns the updated profile, but the row also carries
   * status/name fields that come from the list query.
   */
  async function handleToggleAdmin(emp: EmployeeListItem) {
    const newRole = emp.teamforceRole === "admin" ? "member" : "admin";
    try {
      await setTeamforceRole(emp.userId, newRole);
      toast.success(
        newRole === "admin"
          ? `${emp.name} is now a Teamforce Admin`
          : `Removed admin role from ${emp.name}`
      );
      await load();
    } catch {
      toast.error("Failed to update role");
    }
  }

  const matchesSearch = (e: EmployeeListItem) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
  };
  const filtered = employees.filter(matchesSearch);
  // Bulk-edit only ever targets onboarded employees.
  const bulkFiltered = employees.filter((e) => e.status === "onboarded").filter(matchesSearch);
  const displayList = bulkMode ? bulkFiltered : filtered;
  // Reporting-manager options — any real (non-pending) org member.
  const managerOptions = employees.filter((e) => !e.isPending);

  // Reset to page 1 whenever search or page size changes
  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const totalPages = Math.max(1, Math.ceil(displayList.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = displayList.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, displayList.length);
  // Bulk mode shows all rows with vertical scroll; list mode stays paginated.
  const paginated = bulkMode
    ? displayList
    : displayList.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: Array<number | "ellipsis"> = [1];
    const left = Math.max(2, safePage - 1);
    const right = Math.min(totalPages - 1, safePage + 1);
    if (left > 2) pages.push("ellipsis");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }, [safePage, totalPages]);

  // "Members" only counts people who've actually joined — pending
  // invitees are shown as rows but haven't joined the org yet.
  const allBulkSelected =
    bulkFiltered.length > 0 && bulkFiltered.every((e) => selectedIds.has(e.userId));

  function renderBulkFieldControls(emp: EmployeeListItem) {
    const row = editValues[emp.userId];
    return (
      <>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#7a7a7a]">Department</label>
          <Select
            value={row?.departmentId || undefined}
            onValueChange={(v) => updateEditValue(emp.userId, "departmentId", v)}
          >
            <SelectTrigger className={BULK_CELL}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-[#161616] border-white/10 text-white">
              {departments.map((d) => (
                <SelectItem key={d._id} value={d._id} className="text-[12px]">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#7a7a7a]">
            Reporting Manager
          </label>
          <Select
            value={row?.reportingManagerId || undefined}
            onValueChange={(v) => updateEditValue(emp.userId, "reportingManagerId", v)}
          >
            <SelectTrigger className={BULK_CELL}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-[#161616] border-white/10 text-white max-h-[240px]">
              {managerOptions
                .filter((m) => m.userId !== emp.userId)
                .map((m) => (
                  <SelectItem key={m.userId} value={m.userId} className="text-[12px]">
                    {m.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#7a7a7a]">
            Date of Joining
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand" />
            <Input
              type="date"
              value={row?.dateOfJoining || ""}
              onChange={(e) => updateEditValue(emp.userId, "dateOfJoining", e.target.value)}
              onClick={(e) => {
                const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                el.showPicker?.();
              }}
              className={`${BULK_CELL} pl-8 cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden`}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#7a7a7a]">
            Employment Type
          </label>
          <Select
            value={row?.employmentType || undefined}
            onValueChange={(v) => updateEditValue(emp.userId, "employmentType", v)}
          >
            <SelectTrigger className={BULK_CELL}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-[#161616] border-white/10 text-white">
              {EMPLOYMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-[12px]">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#7a7a7a]">Designation</label>
          <Input
            type="text"
            value={row?.designation || ""}
            onChange={(e) => updateEditValue(emp.userId, "designation", e.target.value)}
            placeholder="Designation"
            className={BULK_CELL}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#7a7a7a]">Shift Type</label>
          <Select
            value={
              shiftOptions.some((o) => o.value === row?.shiftId)
                ? row?.shiftId
                : undefined
            }
            onValueChange={(v) => updateEditValue(emp.userId, "shiftId", v)}
          >
            <SelectTrigger className={BULK_CELL}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-[#161616] border-white/10 text-white max-h-[280px] z-[1000000]">
              {shiftOptions.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-[12px]">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#7a7a7a]">
            Weekly Off Pattern
          </label>
          <Select
            value={
              patternOptions.some((o) => o.value === row?.weeklyOffPatternId)
                ? row?.weeklyOffPatternId
                : undefined
            }
            onValueChange={(v) => updateEditValue(emp.userId, "weeklyOffPatternId", v)}
          >
            <SelectTrigger className={BULK_CELL}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-[#161616] border-white/10 text-white max-h-[280px] z-[1000000]">
              {patternOptions.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-[12px]">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  return (
    <div>
      {/* Search only — header actions live in the dock */}
      {!bulkMode && (
        <div className="mb-5">
          <div className="relative w-full md:w-[40%]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8a8a] pointer-events-none" />
            <input
              type="text"
              placeholder="Search by employee name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={SEARCH_INPUT_CLASS}
            />
          </div>
        </div>
      )}

      {/* Bulk Assign toolbar */}
      {bulkMode && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8a8a] pointer-events-none" />
            <input
              type="text"
              placeholder="Search by employee name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={SEARCH_INPUT_CLASS}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={exitBulkMode}
              disabled={saving}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none h-11 px-5 border-white/10 bg-[#141414] text-white hover:bg-white/5 hover:border-white/15 font-medium text-sm cursor-pointer transition-all duration-150"
            >
              Cancel
            </Button>
            <Button
              onClick={saveBulkEdits}
              disabled={saving || selectedIds.size === 0}
              className="flex-1 sm:flex-none h-11 px-5 bg-brand text-brand-foreground hover:bg-brand/90 font-semibold text-sm cursor-pointer disabled:opacity-50"
              size="sm"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
          <p className="text-xs text-[#5a5a5a]">Loading employees...</p>
        </div>
      ) : displayList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 animate-[fadeIn_0.3s_ease-out]">
          <div className="h-16 w-16 rounded-2xl bg-[#050505] flex items-center justify-center mb-4 ring-1 ring-white/8">
            <UserCircle className="h-7 w-7 text-[#5a5a5a]" />
          </div>
          <p className="text-sm text-[#a8a8a8]">
            {bulkMode
              ? "No onboarded employees to bulk-edit"
              : search
                ? "No employees match your search"
                : "No employees found"}
          </p>
        </div>
      ) : bulkMode ? (
        <>
          {/* Mobile: card layout */}
          <div className="md:hidden space-y-3 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 text-xs text-[#a8a8a8] cursor-pointer">
                <Checkbox
                  checked={allBulkSelected}
                  onCheckedChange={(v) => {
                    setSelectedIds(v ? new Set(bulkFiltered.map((e) => e.userId)) : new Set());
                  }}
                  aria-label="Select all"
                  className={CHECKBOX_CLASS}
                />
                Select all ({selectedIds.size} selected)
              </label>
            </div>
            {paginated.map((emp) => {
              const isSelected = selectedIds.has(emp.userId);
              return (
                <div
                  key={emp.userId}
                  className={`rounded-xl border bg-[#0a0a0a] p-4 space-y-3 ${
                    isSelected ? "border-brand/35 bg-brand/[0.03]" : "border-white/8"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(emp.userId)}
                      aria-label={`Select ${emp.name}`}
                      className={CHECKBOX_CLASS}
                    />
                    <EmployeeAvatar emp={emp} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{emp.name}</p>
                      <p className="text-[11px] text-[#7a7a7a] truncate">{emp.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">{renderBulkFieldControls(emp)}</div>
                </div>
              );
            })}
          </div>

          {/* Desktop/tablet: sticky employee column + horizontal/vertical scroll */}
          <div className="hidden md:block bg-[#0a0a0a] rounded-xl border border-white/8 overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            <div className="overflow-auto max-h-[min(68vh,640px)]">
              <table className="w-full border-collapse min-w-[1280px]">
                <thead>
                  <tr className="bg-[#121212]">
                    <th className="sticky top-0 left-0 z-40 w-12 px-3 py-3 bg-[#121212] border-b border-white/8 text-left">
                      <Checkbox
                        checked={allBulkSelected}
                        onCheckedChange={(v) => {
                          setSelectedIds(
                            v ? new Set(bulkFiltered.map((e) => e.userId)) : new Set()
                          );
                        }}
                        aria-label="Select all"
                        className={CHECKBOX_CLASS}
                      />
                    </th>
                    <th className="sticky top-0 left-12 z-40 min-w-[200px] px-3 py-3 bg-[#121212] border-b border-white/8 text-left text-[11px] font-semibold text-[#a8a8a8] tracking-wide shadow-[4px_0_8px_-4px_rgba(0,0,0,0.5)]">
                      Employee Name
                    </th>
                    <th className="sticky top-0 z-30 min-w-[150px] px-2 py-3 bg-[#121212] border-b border-white/8 text-left text-[11px] font-semibold text-[#a8a8a8] tracking-wide">
                      Department
                    </th>
                    <th className="sticky top-0 z-30 min-w-[170px] px-2 py-3 bg-[#121212] border-b border-white/8 text-left text-[11px] font-semibold text-[#a8a8a8] tracking-wide">
                      Reporting Manager
                    </th>
                    <th className="sticky top-0 z-30 min-w-[150px] px-2 py-3 bg-[#121212] border-b border-white/8 text-left text-[11px] font-semibold text-[#a8a8a8] tracking-wide">
                      Date of Joining
                    </th>
                    <th className="sticky top-0 z-30 min-w-[140px] px-2 py-3 bg-[#121212] border-b border-white/8 text-left text-[11px] font-semibold text-[#a8a8a8] tracking-wide">
                      Employment Type
                    </th>
                    <th className="sticky top-0 z-30 min-w-[150px] px-2 py-3 bg-[#121212] border-b border-white/8 text-left text-[11px] font-semibold text-[#a8a8a8] tracking-wide">
                      Designation
                    </th>
                    <th className="sticky top-0 z-30 min-w-[140px] px-2 py-3 bg-[#121212] border-b border-white/8 text-left text-[11px] font-semibold text-[#a8a8a8] tracking-wide">
                      Shift Type
                    </th>
                    <th className="sticky top-0 z-30 min-w-[160px] px-2 py-3 bg-[#121212] border-b border-white/8 text-left text-[11px] font-semibold text-[#a8a8a8] tracking-wide">
                      Weekly Off Pattern
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((emp) => {
                    const isSelected = selectedIds.has(emp.userId);
                    const stickyBg = isSelected ? "bg-[#16140a]" : "bg-[#0a0a0a]";
                    return (
                      <tr
                        key={emp.userId}
                        className={`border-b border-white/5 last:border-b-0 ${
                          isSelected ? "bg-brand/[0.04]" : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className={`sticky left-0 z-20 w-12 px-3 py-2.5 ${stickyBg}`}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(emp.userId)}
                            aria-label={`Select ${emp.name}`}
                            className={CHECKBOX_CLASS}
                          />
                        </td>
                        <td
                          className={`sticky left-12 z-20 min-w-[200px] px-3 py-2.5 ${stickyBg} shadow-[4px_0_8px_-4px_rgba(0,0,0,0.5)]`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <EmployeeAvatar emp={emp} size="sm" />
                            <p title={emp.name} className="text-[13px] font-medium text-white truncate">
                              {emp.name}
                            </p>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 min-w-[150px]">
                          <Select
                            value={editValues[emp.userId]?.departmentId || undefined}
                            onValueChange={(v) => updateEditValue(emp.userId, "departmentId", v)}
                          >
                            <SelectTrigger className={BULK_CELL}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#161616] border-white/10 text-white">
                              {departments.map((d) => (
                                <SelectItem key={d._id} value={d._id} className="text-[12px]">
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2.5 min-w-[170px]">
                          <Select
                            value={editValues[emp.userId]?.reportingManagerId || undefined}
                            onValueChange={(v) =>
                              updateEditValue(emp.userId, "reportingManagerId", v)
                            }
                          >
                            <SelectTrigger className={BULK_CELL}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#161616] border-white/10 text-white max-h-[240px]">
                              {managerOptions
                                .filter((m) => m.userId !== emp.userId)
                                .map((m) => (
                                  <SelectItem key={m.userId} value={m.userId} className="text-[12px]">
                                    {m.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2.5 min-w-[150px]">
                          <div className="relative">
                            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand" />
                            <Input
                              type="date"
                              value={editValues[emp.userId]?.dateOfJoining || ""}
                              onChange={(e) =>
                                updateEditValue(emp.userId, "dateOfJoining", e.target.value)
                              }
                              onClick={(e) => {
                                const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                                el.showPicker?.();
                              }}
                              className={`${BULK_CELL} pl-8 cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden`}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2.5 min-w-[140px]">
                          <Select
                            value={editValues[emp.userId]?.employmentType || undefined}
                            onValueChange={(v) => updateEditValue(emp.userId, "employmentType", v)}
                          >
                            <SelectTrigger className={BULK_CELL}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#161616] border-white/10 text-white">
                              {EMPLOYMENT_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value} className="text-[12px]">
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2.5 min-w-[150px]">
                          <Input
                            type="text"
                            value={editValues[emp.userId]?.designation || ""}
                            onChange={(e) =>
                              updateEditValue(emp.userId, "designation", e.target.value)
                            }
                            placeholder="Designation"
                            className={BULK_CELL}
                          />
                        </td>
                        <td className="px-2 py-2.5 min-w-[140px]">
                          <Select
                            value={
                              shiftOptions.some(
                                (o) => o.value === editValues[emp.userId]?.shiftId
                              )
                                ? editValues[emp.userId]?.shiftId
                                : undefined
                            }
                            onValueChange={(v) => updateEditValue(emp.userId, "shiftId", v)}
                          >
                            <SelectTrigger className={BULK_CELL}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#161616] border-white/10 text-white max-h-[280px] z-[1000000]">
                              {shiftOptions.map((s) => (
                                <SelectItem key={s.value} value={s.value} className="text-[12px]">
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2.5 min-w-[160px]">
                          <Select
                            value={
                              patternOptions.some(
                                (o) =>
                                  o.value === editValues[emp.userId]?.weeklyOffPatternId
                              )
                                ? editValues[emp.userId]?.weeklyOffPatternId
                                : undefined
                            }
                            onValueChange={(v) =>
                              updateEditValue(emp.userId, "weeklyOffPatternId", v)
                            }
                          >
                            <SelectTrigger className={BULK_CELL}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#161616] border-white/10 text-white max-h-[280px] z-[1000000]">
                              {patternOptions.map((p) => (
                                <SelectItem key={p.value} value={p.value} className="text-[12px]">
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {displayList.length > 0 && (
              <div className="flex items-center px-4 py-2.5 border-t border-white/8 text-xs text-[#7a7a7a]">
                <span>
                  {selectedIds.size} of {displayList.length} selected
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3 animate-[fadeIn_0.3s_ease-out]">
            {paginated.map((emp) => {
              const designation = emp.profile?.designation || "—";
              const status = STATUS_BADGE[emp.status];
              return (
                <div
                  key={emp.userId}
                  className={`rounded-xl border border-white/8 bg-[#0a0a0a] p-4 space-y-3 ${
                    emp.isPending ? "opacity-70" : "active:bg-white/[0.03] cursor-pointer"
                  }`}
                  onClick={() => {
                    if (!emp.isPending) onNavigate("edit-employee", emp.userId);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <EmployeeAvatar emp={emp} size="lg" />
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-white truncate flex items-center gap-1.5">
                          {emp.name}
                          {emp.role === "founder" && (
                            <Crown className="h-3 w-3 text-brand shrink-0" />
                          )}
                        </p>
                        <p className="text-[12px] text-[#7a7a7a] truncate">{emp.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={status?.className || ""}>
                        {status?.label || emp.status}
                      </Badge>
                      {/* Same founder-only admin toggle as the desktop table —
                          always visible here since there's no row hover on
                          touch devices. */}
                      {isFounder &&
                        emp.role !== "founder" &&
                        !emp.isPending && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="h-7 w-7 rounded-lg hover:bg-white/8 flex items-center justify-center cursor-pointer transition-all">
                                  <MoreHorizontal className="h-4 w-4 text-[#7a7a7a]" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="bg-[#050505] border-white/10 min-w-[160px]"
                              >
                                <DropdownMenuItem
                                  onClick={() => handleToggleAdmin(emp)}
                                  className="text-sm cursor-pointer gap-2"
                                >
                                  {emp.teamforceRole === "admin" ? (
                                    <>
                                      <ShieldOff className="h-4 w-4 text-red-400" />
                                      Remove Admin
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="h-4 w-4 text-brand" />
                                      Make Admin
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#7a7a7a] mb-0.5">
                        Designation
                      </p>
                      <p className="text-white truncate">{designation}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#7a7a7a] mb-0.5">
                        Joining Date
                      </p>
                      <p className="text-white">{formatJoiningDate(emp)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#7a7a7a] mb-0.5">
                        Member Role
                      </p>
                      <p className="text-white">{memberRoleLabel(emp.role)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#7a7a7a] mb-0.5">
                        Admin Role
                      </p>
                      <p className="text-white">
                        {emp.teamforceRole === "admin" ? "Admin" : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop / tablet table — sticky employee name */}
          <div className="hidden md:block bg-[#0a0a0a] rounded-xl border border-white/8 overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            <div className="overflow-auto max-h-[min(68vh,640px)]">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-[#121212]">
                    <th className="sticky top-0 left-0 z-30 min-w-[220px] px-5 py-3.5 bg-[#121212] border-b border-white/8 text-left text-[12px] font-medium text-[#a8a8a8] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]">
                      Employee Name
                    </th>
                    <th className="sticky top-0 z-20 min-w-[150px] px-4 py-3.5 bg-[#121212] border-b border-white/8 text-left text-[12px] font-medium text-[#a8a8a8]">
                      Designation
                    </th>
                    <th className="sticky top-0 z-20 min-w-[140px] px-4 py-3.5 bg-[#121212] border-b border-white/8 text-left text-[12px] font-medium text-[#a8a8a8]">
                      Joining Date
                    </th>
                    <th className="sticky top-0 z-20 min-w-[130px] px-4 py-3.5 bg-[#121212] border-b border-white/8 text-left text-[12px] font-medium text-[#a8a8a8]">
                      Member Role
                    </th>
                    <th className="sticky top-0 z-20 min-w-[110px] px-4 py-3.5 bg-[#121212] border-b border-white/8 text-left text-[12px] font-medium text-[#a8a8a8]">
                      Admin Role
                    </th>
                    <th className="sticky top-0 z-20 min-w-[120px] px-4 py-3.5 bg-[#121212] border-b border-white/8 text-left text-[12px] font-medium text-[#a8a8a8]">
                      Status
                    </th>
                    {/* Actions — founder-only, mirrors the backend's
                        requireFounderOnly guard on PATCH /:userId/role. */}
                    {isFounder && (
                      <th className="sticky top-0 z-20 w-[60px] px-4 py-3.5 bg-[#121212] border-b border-white/8 text-right text-[12px] font-medium text-[#a8a8a8]">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((emp) => {
                    const designation = emp.profile?.designation || "—";
                    const status = STATUS_BADGE[emp.status];
                    const isFounderRow = emp.role === "founder";
                    return (
                      <tr
                        key={emp.userId}
                        className={`border-b border-white/5 last:border-b-0 group ${
                          emp.isPending
                            ? "opacity-70 cursor-default"
                            : "hover:bg-white/[0.03] cursor-pointer"
                        }`}
                        onClick={() => {
                          if (!emp.isPending) onNavigate("edit-employee", emp.userId);
                        }}
                      >
                        <td className="sticky left-0 z-10 min-w-[220px] px-5 py-3.5 bg-[#0a0a0a] group-hover:bg-[#111] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]">
                          <div className="flex items-center gap-3 min-w-0">
                            <EmployeeAvatar emp={emp} size="sm" />
                            <p
                              title={emp.name}
                              className="text-[13px] font-medium text-white truncate flex items-center gap-1.5"
                            >
                              {emp.name}
                              {isFounderRow && (
                                <Crown className="h-3 w-3 text-brand shrink-0" />
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-white whitespace-nowrap">
                          {designation}
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-white whitespace-nowrap">
                          {formatJoiningDate(emp)}
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-white whitespace-nowrap">
                          {memberRoleLabel(emp.role)}
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-white whitespace-nowrap">
                          {emp.teamforceRole === "admin" ? "Admin" : "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge className={status?.className || ""}>
                            {status?.label || emp.status}
                          </Badge>
                        </td>
                        {isFounder && (
                          // stopPropagation: the row itself navigates to the
                          // employee editor, and opening the menu must not.
                          <td
                            className="px-4 py-3.5 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* A founder can't demote themselves, and a
                                pending invitee has no profile to promote. */}
                            {!isFounderRow && !emp.isPending && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="h-7 w-7 rounded-lg hover:bg-white/8 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all">
                                    <MoreHorizontal className="h-4 w-4 text-[#7a7a7a]" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="bg-[#050505] border-white/10 min-w-[160px]"
                                >
                                  <DropdownMenuItem
                                    onClick={() => handleToggleAdmin(emp)}
                                    className="text-sm cursor-pointer gap-2"
                                  >
                                    {emp.teamforceRole === "admin" ? (
                                      <>
                                        <ShieldOff className="h-4 w-4 text-red-400" />
                                        Remove Admin
                                      </>
                                    ) : (
                                      <>
                                        <Shield className="h-4 w-4 text-brand" />
                                        Make Admin
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination — matches mockup */}
          {displayList.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 px-1">
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#a8a8a8]">
                <label className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-8 rounded-md bg-[#141414] border border-white/10 text-white px-2 text-[13px] outline-none focus:border-brand/40 cursor-pointer"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <span>
                  {start}-{end} of {displayList.length} results
                </span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="flex items-center gap-1 px-2.5 h-8 text-[13px] font-medium text-[#a8a8a8] rounded-md hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                {pageNumbers.map((p, idx) =>
                  p === "ellipsis" ? (
                    <span
                      key={`e-${idx}`}
                      className="h-8 w-8 flex items-center justify-center text-[13px] text-[#7a7a7a]"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-8 w-8 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                        safePage === p
                          ? "bg-white/10 text-white"
                          : "text-[#a8a8a8] hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="flex items-center gap-1 px-2.5 h-8 text-[13px] font-medium text-[#a8a8a8] rounded-md hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
