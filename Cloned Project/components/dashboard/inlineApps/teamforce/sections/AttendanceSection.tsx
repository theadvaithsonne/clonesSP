"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  LogIn,
  LogOut,
  Clock,
  Briefcase,
  Coffee,
  Eye,
  Loader2,
  Crown,
  Shield,
  UserCog,
  Users,
  Calendar,
  TrendingUp,
  X,
  Check,
  XCircle,
  Ban,
  Upload,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
} from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { getUserIdFromToken } from "@/lib/auth";
import {
  getEmployee,
  listEmployees,
  listBranches,
  listDepartments,
  createLeaveRequest,
  listMyLeaveRequests,
  listOrgLeaveRequests,
  listTeamLeaveRequests,
  listWeeklyOffPatterns,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  uploadFile,
  getBreakStatus,
  type LeaveRequest,
  type LeaveType,
  type LeaveStatus,
} from "../api";
import type {
  EmployeeListItem,
  Branch,
  Department,
  BreakStatus,
} from "../types";

/** Fire the "you've used your allowed break time" toast at most once per
 *  calendar day per user. Uses localStorage so a reload doesn't re-notify. */
function notifyBreachOncePerDay(userId: string | null) {
  if (!userId) return;
  const day = new Date().toISOString().slice(0, 10);
  const key = `break-breach-notified-${userId}-${day}`;
  if (typeof window === "undefined") return;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, "1");
  toast.warning(
    "You've used your allowed break time. Extra minutes may affect your payroll.",
    { duration: 6000 }
  );
}

type MyRole = "founder" | "admin" | "manager" | "employee";

type TimeEntry = {
  _id: string;
  clockInTime: string;
  clockOutTime: string | null;
  durationInSeconds?: number;
};

type BreakLog = {
  _id: string;
  breakStartTime: string;
  breakStopTime: string | null;
  durationInSeconds?: number;
};

type AttendanceRecord = {
  date: string;
  loginTime: string | null;
  logoutTime: string | null;
  hoursWorked: string | null;
  breakTime: string | null;
  breakCount: number;
  status: "Present" | "Not Marked";
};

/** Formats a "Total Break"/"Break Time" cell to match the grid display
 *  (e.g. "45m (2)" or "—"). */
function fmtBreakCell(breakTime: string | null, breakCount: number) {
  if (!breakTime) return "—";
  return breakCount > 0 ? `${breakTime} (${breakCount})` : breakTime;
}

/** Builds an .xlsx workbook from an array of plain row objects and
 *  triggers a browser download. */
function exportRowsToExcel(
  rows: Record<string, string | number>[],
  filename: string
) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
  XLSX.writeFile(workbook, filename);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtHours(seconds: number) {
  return `${(seconds / 3600).toFixed(2).replace(/\.00$/, "")}h`;
}

function fmtDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

function buildRecords(
  entries: TimeEntry[],
  breakLogs: BreakLog[]
): AttendanceRecord[] {
  const byDate = new Map<string, TimeEntry[]>();
  entries.forEach((e) => {
    const k = fmtDate(e.clockInTime);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(e);
  });
  const breaksByDate = new Map<string, BreakLog[]>();
  breakLogs.forEach((b) => {
    const k = fmtDate(b.breakStartTime);
    if (!breaksByDate.has(k)) breaksByDate.set(k, []);
    breaksByDate.get(k)!.push(b);
  });
  return Array.from(byDate.entries())
    .map(([date, list]) => {
      const sorted = [...list].sort(
        (a, b) => new Date(a.clockInTime).getTime() - new Date(b.clockInTime).getTime()
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSec = sorted.reduce((sum, e) => {
        if (typeof e.durationInSeconds === "number") return sum + e.durationInSeconds;
        if (e.clockOutTime) {
          return sum + (new Date(e.clockOutTime).getTime() - new Date(e.clockInTime).getTime()) / 1000;
        }
        return sum;
      }, 0);
      const hasOpen = sorted.some((e) => !e.clockOutTime);
      const dayBreaks = breaksByDate.get(date) || [];
      const breakSec = dayBreaks.reduce((sum, b) => {
        if (typeof b.durationInSeconds === "number") return sum + b.durationInSeconds;
        if (b.breakStopTime) {
          return sum + (new Date(b.breakStopTime).getTime() - new Date(b.breakStartTime).getTime()) / 1000;
        }
        return sum + (Date.now() - new Date(b.breakStartTime).getTime()) / 1000;
      }, 0);
      return {
        date,
        loginTime: fmtTime(first.clockInTime),
        logoutTime: last.clockOutTime ? fmtTime(last.clockOutTime) : null,
        hoursWorked: totalSec > 0 ? fmtHours(totalSec) : hasOpen ? "—" : null,
        breakTime: breakSec > 0 ? fmtDuration(breakSec) : null,
        breakCount: dayBreaks.length,
        status: "Present" as const,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export default function AttendanceSection() {
  const { amIFounder, loading: founderLoading } = useAmIFounder();
  const [role, setRole] = useState<MyRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (founderLoading) return;
    if (amIFounder) {
      setRole("founder");
      setRoleLoading(false);
      return;
    }
    const myUserId = getUserIdFromToken();
    if (!myUserId) {
      setRole("employee");
      setRoleLoading(false);
      return;
    }
    getEmployee(myUserId)
      .then((data) => {
        if (data.teamforceRole === "admin") {
          setRole("admin");
        } else if (data.profile?.managesTeam) {
          setRole("manager");
        } else {
          setRole("employee");
        }
      })
      .catch(() => setRole("employee"))
      .finally(() => setRoleLoading(false));
  }, [amIFounder, founderLoading]);

  if (roleLoading || role === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (role === "founder" || role === "admin") {
    return <AdminAttendanceView />;
  }
  if (role === "manager") {
    return <ManagerAttendanceView />;
  }

  return <EmployeeAttendanceView />;
}

function RolePlaceholder({ role }: { role: Exclude<MyRole, "employee"> }) {
  const meta: Record<
    Exclude<MyRole, "employee">,
    { label: string; icon: React.ReactNode; tint: string }
  > = {
    founder: {
      label: "Founder",
      icon: <Crown className="h-5 w-5 text-brand" />,
      tint: "bg-brand/10 ring-1 ring-brand/20",
    },
    admin: {
      label: "Admin",
      icon: <Shield className="h-5 w-5 text-purple-400" />,
      tint: "bg-purple-500/10 ring-1 ring-purple-500/20",
    },
    manager: {
      label: "Manager",
      icon: <UserCog className="h-5 w-5 text-blue-400" />,
      tint: "bg-blue-500/10 ring-1 ring-blue-500/20",
    },
  };
  const m = meta[role];
  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Attendance
          </h2>
          <p className="text-sm text-[#7a7a7a] mt-1">
            Role-based attendance view
          </p>
        </div>
      </div>
      <div className="bg-[#050505] rounded-xl border border-white/8 p-10 flex flex-col items-center justify-center text-center min-h-[320px]">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${m.tint}`}
        >
          {m.icon}
        </div>
        <p className="text-sm text-[#a8a8a8]">
          This view is for <span className="font-semibold text-white">{m.label}</span>
        </p>
        <p className="text-xs text-[#5a5a5a] mt-1">Coming soon</p>
      </div>
    </div>
  );
}

/** Two-pill segmented switcher used by admin/founder/manager headers and
 *  by EmployeeAttendanceView when it's reused for the "Self Attendance"
 *  tab. Stays a single source of truth for the active tab style. */
function ViewTabs({
  active,
  onChange,
}: {
  active: "org" | "self";
  onChange: (v: "org" | "self") => void;
}) {
  const Tab = (key: "org" | "self", label: string) => (
    <button
      type="button"
      onClick={() => active !== key && onChange(key)}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
        active === key
          ? "bg-brand text-brand-foreground"
          : "text-[#a8a8a8] hover:text-white hover:bg-white/8"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-1 p-1 bg-[#0e0e12] rounded-lg ring-1 ring-white/8">
      {Tab("org", "Organisation Level")}
      {Tab("self", "Self Attendance")}
    </div>
  );
}

/** Two-pill segmented switch rendered next to the "Attendance Records"
 *  title in the admin/founder/manager view. Flips the records grid
 *  between the org-wide table (default) and the user's own history. */
function MyRecordsToggle({
  on,
  onChange,
  orgLabel,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  /** Label for the OFF state. e.g. "Organization" for admin, "Team" for
   *  manager. Defaults to "Organization". */
  orgLabel?: string;
}) {
  const Tab = (key: "org" | "self", label: string) => {
    const active = key === "self" ? on : !on;
    return (
      <button
        type="button"
        onClick={() => onChange(key === "self")}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
          active
            ? "bg-brand text-brand-foreground"
            : "text-[#a8a8a8] hover:text-white hover:bg-white/8"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="flex items-center gap-1 p-1 bg-[#0e0e12] rounded-lg ring-1 ring-white/8">
      {Tab("org", orgLabel || "Organization")}
      {Tab("self", "My Records")}
    </div>
  );
}

/** Self-attendance records grid (date | login | logout | hours | break |
 *  status | action). Used inside the admin/manager view when the "My
 *  Records" toggle is ON. Self-contained — owns its own fetch + state. */
function SelfAttendanceRecordsGrid({
  onRecordsChange,
}: {
  onRecordsChange?: (records: AttendanceRecord[]) => void;
}) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [breakLogs, setBreakLogs] = useState<BreakLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailRecord, setDetailRecord] =
    useState<AttendanceRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) {
          if (!cancelled) {
            setEntries([]);
            setBreakLogs([]);
          }
          return;
        }
        const [r1, r2] = await Promise.all([
          api<{ success: boolean; history: TimeEntry[] }>(
            `/betty/time-tracking?orgId=${orgId}`
          ),
          api<{ success: boolean; logs: BreakLog[] }>(
            `/betty/break-logs?orgId=${orgId}`
          ),
        ]);
        if (cancelled) return;
        setEntries(r1.history || []);
        setBreakLogs(r2.logs || []);
      } catch (e) {
        console.error("Failed to load self attendance", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const records = useMemo(
    () => buildRecords(entries, breakLogs),
    [entries, breakLogs]
  );
  const recordsPg = usePagination(records);

  useEffect(() => {
    onRecordsChange?.(records);
  }, [records, onRecordsChange]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8">
              {[
                "Date",
                "Login Time",
                "Logout Time",
                "Hours Worked",
                "Break Time",
                "Status",
                "Action",
              ].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs font-medium text-[#7a7a7a] px-4 py-2.5"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading || recordsPg.transitioning ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-brand inline-block" />
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <p className="text-xs text-[#a8a8a8]">
                    No attendance records yet
                  </p>
                  <p className="text-xs text-[#5a5a5a] mt-0.5">
                    Clock in to start tracking your time
                  </p>
                </td>
              </tr>
            ) : (
              recordsPg.pageItems.map((r) => (
                <tr
                  key={r.date}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0"
                >
                  <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                    {r.date}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                    {r.loginTime ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                    {r.logoutTime ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-white">
                    {r.hoursWorked ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                    {r.breakTime ? (
                      <span className="text-white font-medium">
                        {r.breakTime}
                        {r.breakCount > 0 && (
                          <span className="text-[#5a5a5a] ml-1">
                            ({r.breakCount})
                          </span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === "Present"
                          ? "text-green-400 bg-green-500/10 ring-1 ring-green-500/20"
                          : "text-[#a8a8a8] bg-white/5 ring-1 ring-white/10"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setDetailRecord(r)}
                      className="p-1 hover:bg-white/8 rounded transition-colors cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="h-3.5 w-3.5 text-brand" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={recordsPg.page}
        totalPages={recordsPg.totalPages}
        total={recordsPg.total}
        start={recordsPg.start}
        end={recordsPg.end}
        loading={recordsPg.transitioning}
        onPrev={recordsPg.goPrev}
        onNext={recordsPg.goNext}
      />
      {detailRecord && (
        <AttendanceDetailsModal
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
        />
      )}
    </>
  );
}

function EmployeeAttendanceView({
  hideRecords = false,
  onBackToOrg,
  onLeaveSubmitted,
  pendingApprovalsCount,
  onViewApprovals,
}: {
  /** Pending org leave count for the "Pending Leave Approvals" stat card
   *  (admin/founder Self Attendance only). */
  pendingApprovalsCount?: number;
  /** Opens the parent's Leave Approvals page (admin/founder only). */
  onViewApprovals?: () => void;
  /** Skip the "Attendance Records" history grid. Used when this view is
   *  reused as the admin/manager "Self Attendance" tab — that grid is
   *  shown inline in the org view via the My Records toggle instead. */
  hideRecords?: boolean;
  /** Renders an "Org Attendance / Self Attendance" tab in the header.
   *  Clicking "Org Attendance" calls this to return the parent. */
  onBackToOrg?: () => void;
  /** Fired after a leave request is successfully submitted. Used by the
   *  admin/manager wrappers to refresh their Leave Approval Queue so a
   *  founder/admin who applies from Self Attendance immediately sees
   *  their pending leave when they switch back to the Org tab. */
  onLeaveSubmitted?: () => void;
} = {}) {
  const [dateRange, setDateRange] = useState("Jan 06, 2026 - Jan 13, 2026");
  const [view, setView] = useState("Monthly View");
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isClockedIn, setIsClockedIn] = useState<boolean | null>(null);
  const [clockActionLoading, setClockActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [breakLogs, setBreakLogs] = useState<BreakLog[]>([]);
  const [isOnBreak, setIsOnBreak] = useState<boolean>(false);
  const [breakActionLoading, setBreakActionLoading] = useState(false);
  const [breakStatus, setBreakStatus] = useState<BreakStatus | null>(null);
  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [showApplyLeave, setShowApplyLeave] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [offDays, setOffDays] = useState<number[]>([]);
  // Dedicated "My Leave Approvals" sub-view (employee/manager) — the admin
  // self tab routes to the parent's org approvals page via onViewApprovals.
  const [showMyApprovals, setShowMyApprovals] = useState(false);

  const loadLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try {
      const res = await listMyLeaveRequests();
      setLeaves(res.leaves || []);
    } catch (err: any) {
      console.error("Failed to load leave requests", err);
    } finally {
      setLeavesLoading(false);
    }
  }, []);

  const handleCancelLeave = useCallback(
    async (id: string) => {
      if (cancellingId) return;
      setCancellingId(id);
      try {
        await cancelLeaveRequest(id);
        toast.success("Leave request cancelled");
        await loadLeaves();
      } catch (err: any) {
        toast.error(err?.message || "Failed to cancel leave");
      } finally {
        setCancellingId(null);
      }
    },
    [cancellingId, loadLeaves]
  );

  const loadEntries = useCallback(async () => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        setIsClockedIn(false);
        setEntries([]);
        return;
      }
      const res = await api<{ success: boolean; history: TimeEntry[] }>(
        `/betty/time-tracking?orgId=${orgId}`
      );
      const history = res.history || [];
      setEntries(history);
      setIsClockedIn(history.some((e) => !e.clockOutTime));
    } catch (e) {
      console.error("Failed to load time entries", e);
      setIsClockedIn(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBreaks = useCallback(async () => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        setBreakLogs([]);
        setIsOnBreak(false);
        return;
      }
      const res = await api<{ success: boolean; logs: BreakLog[] }>(
        `/betty/break-logs?orgId=${orgId}`
      );
      const logs = res.logs || [];
      setBreakLogs(logs);
      setIsOnBreak(logs.some((b) => !b.breakStopTime));
    } catch (e) {
      console.error("Failed to load break logs", e);
      setIsOnBreak(false);
    }
  }, []);

  const loadBreakStatus = useCallback(async () => {
    try {
      const status = await getBreakStatus();
      setBreakStatus(status);
      if (status.hasBreached) {
        notifyBreachOncePerDay(getUserIdFromToken());
      }
    } catch (e) {
      console.error("Failed to load break status", e);
      setBreakStatus(null);
    }
  }, []);

  useEffect(() => {
    loadEntries();
    loadBreaks();
    loadBreakStatus();
    loadLeaves();
  }, [loadEntries, loadBreaks, loadBreakStatus, loadLeaves]);

  useEffect(() => {
    const myUserId = getUserIdFromToken();
    if (!myUserId) return;
    Promise.all([getEmployee(myUserId), listWeeklyOffPatterns()])
      .then(([emp, { patterns }]) => {
        const raw = emp.profile?.weeklyOffPatternId;
        const patternId = typeof raw === "string" ? raw : (raw as any)?._id ?? "";
        const match = patterns.find((p) => p._id === patternId);
        if (match?.offDays?.length) setOffDays(match.offDays);
      })
      .catch(() => { /* silently ignore — no restriction if pattern unavailable */ });
  }, []);

  const handleClockToggle = useCallback(async () => {
    if (clockActionLoading || isClockedIn === null) return;
    setClockActionLoading(true);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        toast.error("No organization selected");
        return;
      }
      if (isClockedIn) {
        await api(`/betty/clock-out?orgId=${orgId}`, { method: "POST" });
        toast.success("Clocked out");
      } else {
        // Block clock-in if user has an approved leave covering today
        const todayStr = new Date().toISOString().slice(0, 10);
        const hasApprovedLeaveToday = leaves.some(
          (lv) =>
            lv.status === "Approved" &&
            fmtDate(lv.startDate) <= todayStr &&
            fmtDate(lv.endDate) >= todayStr
        );
        if (hasApprovedLeaveToday) {
          toast.error("You have an approved leave for today. Attendance cannot be marked on approved leave days.");
          return;
        }
        await api(`/betty/clock-in?orgId=${orgId}`, { method: "POST" });
        toast.success("Clocked in");
      }
      await Promise.all([loadEntries(), loadBreaks()]);
    } catch (err: any) {
      toast.error(err?.message || "Clock action failed");
    } finally {
      setClockActionLoading(false);
    }
  }, [isClockedIn, clockActionLoading, loadEntries, loadBreaks, leaves]);

  const handleBreakToggle = useCallback(async () => {
    if (breakActionLoading) return;
    if (!isClockedIn) {
      toast.error("Clock in first to take a break");
      return;
    }
    setBreakActionLoading(true);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        toast.error("No organization selected");
        return;
      }
      if (isOnBreak) {
        const res = await api<{
          success: boolean;
          record: { triggeredBreach?: boolean };
        }>(`/betty/break-stop?orgId=${orgId}`, { method: "POST" });
        if (res?.record?.triggeredBreach) {
          notifyBreachOncePerDay(getUserIdFromToken());
        } else {
          toast.success("Break ended");
        }
      } else {
        await api(`/betty/break-start?orgId=${orgId}`, { method: "POST" });
        toast.success("Break started");
      }
      await Promise.all([loadBreaks(), loadBreakStatus()]);
    } catch (err: any) {
      const raw = err?.message || "";
      let msg = "Break action failed";
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.error) msg = parsed.error;
      } catch {
        if (raw) msg = raw;
      }
      toast.error(msg);
    } finally {
      setBreakActionLoading(false);
    }
  }, [isClockedIn, isOnBreak, breakActionLoading, loadBreaks, loadBreakStatus]);

  // ── New attendance design (all roles, incl. plain employees): quick
  //    actions live in the bottom dock. Tell the shell to swap dock items,
  //    and handle the actions it forwards back. Reset on unmount so the
  //    dock restores.
  const dockUi = true;
  // Re-dispatch whenever the clocked-in state changes so the dock swaps the
  // Clock In / Clock Out item live.
  useEffect(() => {
    if (!dockUi) return;
    window.dispatchEvent(
      new CustomEvent("teamforce:self-attendance", {
        detail: { active: true, clockedIn: isClockedIn === true },
      })
    );
  }, [dockUi, isClockedIn]);
  useEffect(() => {
    if (!dockUi) return;
    return () => {
      window.dispatchEvent(
        new CustomEvent("teamforce:self-attendance", { detail: { active: false } })
      );
    };
  }, [dockUi]);

  useEffect(() => {
    if (!dockUi) return;
    const handler = (e: Event) => {
      const action = (e as CustomEvent<{ action: string }>).detail?.action;
      if (action === "clock-in") {
        if (isClockedIn) {
          toast.error("You're already clocked in");
          return;
        }
        handleClockToggle();
      } else if (action === "clock-out") {
        if (!isClockedIn) {
          toast.error("You're not clocked in");
          return;
        }
        handleClockToggle();
      } else if (action === "break") {
        if (
          breakStatus &&
          !isOnBreak &&
          (!breakStatus.activated || !breakStatus.inScope)
        ) {
          toast.error("Breaks are not enabled for you");
          return;
        }
        handleBreakToggle();
      } else if (action === "apply-leave") {
        setShowApplyLeave(true);
      }
    };
    window.addEventListener("teamforce:attendance-action", handler);
    return () => window.removeEventListener("teamforce:attendance-action", handler);
  }, [dockUi, isClockedIn, isOnBreak, breakStatus, handleClockToggle, handleBreakToggle]);

  const records = useMemo(() => buildRecords(entries, breakLogs), [entries, breakLogs]);

  const leavesPg = usePagination(leaves);
  const recordsPg = usePagination(records);

  const today = fmtDate(new Date().toISOString());
  const todayEntries = entries.filter((e) => fmtDate(e.clockInTime) === today);
  const activeEntry = entries.find((e) => !e.clockOutTime);
  const todaySec = todayEntries.reduce((sum, e) => {
    if (typeof e.durationInSeconds === "number") return sum + e.durationInSeconds;
    if (e.clockOutTime) {
      return sum + (new Date(e.clockOutTime).getTime() - new Date(e.clockInTime).getTime()) / 1000;
    }
    return sum + (Date.now() - new Date(e.clockInTime).getTime()) / 1000;
  }, 0);
  const todayFirstLogin = todayEntries.length
    ? fmtTime(
        [...todayEntries].sort(
          (a, b) => new Date(a.clockInTime).getTime() - new Date(b.clockInTime).getTime()
        )[0].clockInTime
      )
    : "—";
  const todayStatus = todayEntries.length ? "Present" : "Not Marked";
  const currentStatus = isOnBreak
    ? "On Break"
    : activeEntry
    ? "Working"
    : "Not Clocked In";

  // Today's break stats
  const todayBreaks = breakLogs.filter(
    (b) => fmtDate(b.breakStartTime) === today
  );
  const todayBreakSec = todayBreaks.reduce((sum, b) => {
    if (typeof b.durationInSeconds === "number") return sum + b.durationInSeconds;
    if (b.breakStopTime) {
      return sum + (new Date(b.breakStopTime).getTime() - new Date(b.breakStartTime).getTime()) / 1000;
    }
    return sum + (Date.now() - new Date(b.breakStartTime).getTime()) / 1000;
  }, 0);

  // "My Leave Requests" card — shown on the main page and reused by the
  // dedicated My Leave Approvals sub-view below.
  const myLeaveRequestsCard = (
    <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/8">
        <h2 className="text-sm font-semibold text-white">My Leave Requests</h2>
        <p className="text-xs text-[#7a7a7a] mt-0.5">
          View all your submitted leave requests and their status
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8">
              {["Leave Type", "Start Date", "End Date", "Duration", "Status", "Approver", "Action"].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs font-medium text-[#7a7a7a] px-4 py-2.5"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leavesLoading || leavesPg.transitioning ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-brand inline-block" />
                </td>
              </tr>
            ) : leaves.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <p className="text-xs text-[#a8a8a8]">
                    No leave requests found
                  </p>
                  <p className="text-xs text-[#5a5a5a] mt-0.5">
                    Submit a leave request to get started
                  </p>
                </td>
              </tr>
            ) : (
              leavesPg.pageItems.map((lv) => (
                <tr
                  key={lv._id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0"
                >
                  <td className="px-4 py-2.5 text-xs font-medium text-white">
                    {lv.leaveType}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                    {fmtDate(lv.startDate)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                    {fmtDate(lv.endDate)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                    {leaveDuration(lv)}
                  </td>
                  <td className="px-4 py-2.5">
                    <LeaveStatusBadge status={lv.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                    {lv.status === "Approved" || lv.status === "Rejected"
                      ? lv.approverName || "Admin"
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {lv.status === "Pending" ? (
                      <button
                        onClick={() => handleCancelLeave(lv._id)}
                        disabled={cancellingId === lv._id}
                        className="p-1 hover:bg-white/8 rounded transition-colors cursor-pointer disabled:opacity-50"
                        title="Cancel Request"
                      >
                        {cancellingId === lv._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" />
                        ) : (
                          <Ban className="h-3.5 w-3.5 text-red-400" />
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-[#5a5a5a]">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={leavesPg.page}
        totalPages={leavesPg.totalPages}
        total={leavesPg.total}
        start={leavesPg.start}
        end={leavesPg.end}
        loading={leavesPg.transitioning}
        onPrev={leavesPg.goPrev}
        onNext={leavesPg.goNext}
      />
    </div>
  );

  // Dedicated My Leave Approvals page — opened via the "View Approvals"
  // stat card button (employee/manager); back button returns.
  if (showMyApprovals) {
    return (
      <div className="animate-[fadeIn_0.3s_ease-out] space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowMyApprovals(false)}
            className="h-9 w-9 rounded-xl bg-[#1c1c1e] border border-white/10 hover:bg-[#26262a] flex items-center justify-center cursor-pointer transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-[#a8a8a8]" />
          </button>
          <h2 className="text-lg font-semibold text-white tracking-tight">
            Leave Approvals
          </h2>
        </div>
        {myLeaveRequestsCard}
        {showApplyLeave && (
          <ApplyLeaveModal
            onClose={() => setShowApplyLeave(false)}
            onSubmitted={() => {
              setShowApplyLeave(false);
              loadLeaves();
              onLeaveSubmitted?.();
            }}
            existingLeaves={leaves}
            offDays={offDays}
          />
        )}
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out] space-y-4">
      {/* Header — self tab: tabs left + export right (actions live in the
          dock); employee view: title + Apply Leave button (unchanged). */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {onBackToOrg ? (
          <ViewTabs
            active="self"
            onChange={(v) => v === "org" && onBackToOrg?.()}
          />
        ) : (
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">
              Attendance
            </h2>
            <p className="text-sm text-[#7a7a7a] mt-1">
              View your attendance records
            </p>
          </div>
        )}
        {dockUi ? (
          <button
            type="button"
            title="Export to Excel"
            onClick={() => {
              if (records.length === 0) {
                toast.error("No records to export");
                return;
              }
              exportRowsToExcel(
                records.map((r) => ({
                  Date: r.date,
                  "Login Time": r.loginTime ?? "—",
                  "Logout Time": r.logoutTime ?? "—",
                  "Hours Worked": r.hoursWorked ?? "—",
                  "Total Break": fmtBreakCell(r.breakTime, r.breakCount),
                  Status: r.status,
                })),
                "My_Attendance.xlsx"
              );
            }}
            className="flex items-center justify-center h-[34px] w-[34px] rounded-lg border border-white/10 bg-[#1c1c1e] hover:bg-[#26262a] text-white transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={() => setShowApplyLeave(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-foreground bg-brand rounded-lg hover:bg-brand/90 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Apply Leave
          </button>
        )}
      </div>

      {/* Filters — hidden on the self tab (dock + stat cards replace it) */}
      {!dockUi && (
      <div className="bg-[#050505] rounded-xl border border-white/8 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
              Date Range
            </label>
            <input
              type="text"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[#0e0e12] border border-white/8 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
              View
            </label>
            <select
              value={view}
              onChange={(e) => setView(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[#0e0e12] border border-white/8 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              <option>Monthly View</option>
              <option>Weekly View</option>
              <option>Daily View</option>
            </select>
          </div>
        </div>
      </div>
      )}

      {/* Status cards — grey style on the self tab (per design) */}
      {dockUi ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <OrgStatCard
            label="Today's Status"
            value={todayStatus}
            icon={<LogIn className="h-3.5 w-3.5 text-[#a8a8a8]" />}
          />
          <OrgStatCard
            label="Login Time"
            value={todayFirstLogin}
            icon={<Clock className="h-3.5 w-3.5 text-[#a8a8a8]" />}
          />
          <OrgStatCard
            label="Break Time"
            value={todayBreakSec > 0 ? fmtDuration(todayBreakSec) : "0s"}
            icon={<Coffee className="h-3.5 w-3.5 text-[#a8a8a8]" />}
          />
          <OrgStatCard
            label="Pending Leave Approvals"
            value={String(
              onViewApprovals
                ? pendingApprovalsCount ?? 0
                : leaves.filter((l) => l.status === "Pending").length
            )}
            icon={<Calendar className="h-3.5 w-3.5 text-[#a8a8a8]" />}
            action={
              <button
                type="button"
                onClick={onViewApprovals ?? (() => setShowMyApprovals(true))}
                className="px-2.5 py-1.5 rounded-md border border-white/10 bg-[#2a2a2e] hover:bg-[#333338] text-[11px] font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                View Approvals
              </button>
            }
          />
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatusCard
          label="Today's Status"
          value={todayStatus}
          valueClass={todayStatus === "Present" ? "text-green-400" : "text-[#a8a8a8]"}
          icon={<LogIn className="h-4 w-4 text-green-400" />}
          iconBg="bg-green-500/10 ring-1 ring-green-500/20"
        />
        <StatusCard
          label="Login Time"
          value={todayFirstLogin}
          valueClass="text-white"
          icon={<Clock className="h-4 w-4 text-brand" />}
          iconBg="bg-brand/10 ring-1 ring-brand/20"
        />
        <StatusCard
          label="Hours Worked Today"
          value={todaySec > 0 ? fmtHours(todaySec) : "—"}
          valueClass="text-white"
          icon={<Briefcase className="h-4 w-4 text-purple-400" />}
          iconBg="bg-purple-500/10 ring-1 ring-purple-500/20"
        />
      </div>
      )}

      {/* Quick Actions — hidden on the self tab (moved into the dock) */}
      {!dockUi && (
      <div className="bg-[#050505] rounded-xl border border-white/8 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction
            icon={
              clockActionLoading && !isClockedIn ? (
                <Loader2 className="h-4.5 w-4.5 text-green-400 animate-spin" />
              ) : (
                <LogIn className="h-4.5 w-4.5 text-green-400" />
              )
            }
            label="Clock In"
            disabled={isClockedIn === null || isClockedIn === true || clockActionLoading}
            onClick={handleClockToggle}
            borderClass="border-green-500/20 hover:border-green-500/50 hover:bg-green-500/10"
            iconBg="bg-green-500/10"
            labelClass="text-white"
          />
          <QuickAction
            icon={
              clockActionLoading && isClockedIn ? (
                <Loader2 className="h-4.5 w-4.5 text-red-400 animate-spin" />
              ) : (
                <LogOut className="h-4.5 w-4.5 text-red-400" />
              )
            }
            label="Clock Out"
            disabled={isClockedIn === null || isClockedIn === false || clockActionLoading}
            onClick={handleClockToggle}
            borderClass="border-red-500/20 hover:border-red-500/50 hover:bg-red-500/10"
            iconBg="bg-red-500/10"
            labelClass="text-white"
          />
          <QuickAction
            icon={
              breakActionLoading ? (
                <Loader2 className="h-4.5 w-4.5 text-orange-400 animate-spin" />
              ) : (
                <Coffee className="h-4.5 w-4.5 text-orange-400" />
              )
            }
            label={
              breakStatus && !breakStatus.activated
                ? "Breaks Off"
                : breakStatus && !breakStatus.inScope
                ? "Not In Scope"
                : isOnBreak
                ? "Stop Break"
                : "Take Break"
            }
            disabled={
              !isClockedIn ||
              breakActionLoading ||
              (breakStatus !== null &&
                !isOnBreak &&
                (!breakStatus.activated || !breakStatus.inScope))
            }
            onClick={handleBreakToggle}
            borderClass={
              isOnBreak
                ? "border-orange-500/50 bg-orange-500/10"
                : "border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/10"
            }
            iconBg="bg-orange-500/10"
            labelClass="text-white"
          />
          <QuickAction
            icon={<Briefcase className="h-4.5 w-4.5 text-brand" />}
            label="Official Duty"
            borderClass="border-brand/20 hover:border-brand/50 hover:bg-brand/10"
            iconBg="bg-brand/10"
            labelClass="text-white"
          />
        </div>
        <div className="mt-3 pt-3 border-t border-white/8">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isOnBreak
                    ? "bg-orange-400 animate-pulse"
                    : activeEntry
                    ? "bg-green-500 animate-pulse"
                    : "bg-[#5a5a5a]"
                }`}
              />
              <span className="text-xs text-[#a8a8a8]">
                Current Status:{" "}
                <span className="font-medium text-white">{currentStatus}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-[#a8a8a8]">
                Total Break Today:{" "}
                <span className="font-medium text-white">
                  {todayBreakSec > 0 ? fmtDuration(todayBreakSec) : "0s"}
                </span>
                {todayBreaks.length > 0 && (
                  <span className="text-[#5a5a5a]"> ({todayBreaks.length})</span>
                )}
              </span>
              {breakStatus?.activated &&
                breakStatus.inScope &&
                breakStatus.budgetSeconds > 0 && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                      breakStatus.hasBreached
                        ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                        : "bg-brand/10 text-brand ring-1 ring-brand/20"
                    }`}
                  >
                    {breakStatus.hasBreached
                      ? `Over by ${fmtDuration(breakStatus.overBudgetSeconds)}`
                      : `${fmtDuration(
                          breakStatus.remainingSeconds
                        )} left of ${breakStatus.breakMinutesPerDay}m`}
                  </span>
                )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* My Leave Requests lives in the "View Approvals" sub-view now */}

      {/* Attendance Records — hidden when this view is the "Self Attendance"
          tab inside admin/manager (those views show records inline via the
          My Records toggle on their own Attendance Records section). */}
      {(!hideRecords || dockUi) && (
      <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1c1c1e] border-b border-white/8">
                {["Date", "Login Time", "Logout Time", "Hours Worked", "Break Time", "Status", "Action"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-[#7a7a7a] px-4 py-2.5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading || recordsPg.transitioning ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-brand inline-block" />
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <p className="text-xs text-[#a8a8a8]">No attendance records yet</p>
                    <p className="text-xs text-[#5a5a5a] mt-0.5">
                      Clock in to start tracking your time
                    </p>
                  </td>
                </tr>
              ) : (
                recordsPg.pageItems.map((r) => (
                  <tr
                    key={r.date}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0"
                  >
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">{r.date}</td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.loginTime ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.logoutTime ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-white">
                      {r.hoursWorked ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.breakTime ? (
                        <span className="text-white font-medium">
                          {r.breakTime}
                          {r.breakCount > 0 && (
                            <span className="text-[#5a5a5a] ml-1">
                              ({r.breakCount})
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          r.status === "Present"
                            ? "text-green-400 bg-green-500/10 ring-1 ring-green-500/20"
                            : "text-[#a8a8a8] bg-white/5 ring-1 ring-white/10"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setDetailRecord(r)}
                        className="p-1 hover:bg-white/8 rounded transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="h-3.5 w-3.5 text-brand" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={recordsPg.page}
          totalPages={recordsPg.totalPages}
          total={recordsPg.total}
          start={recordsPg.start}
          end={recordsPg.end}
          loading={recordsPg.transitioning}
          onPrev={recordsPg.goPrev}
          onNext={recordsPg.goNext}
        />
      </div>
      )}

      {(!hideRecords || dockUi) && detailRecord && (
        <AttendanceDetailsModal
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
        />
      )}

      {showApplyLeave && (
        <ApplyLeaveModal
          onClose={() => setShowApplyLeave(false)}
          onSubmitted={() => {
            setShowApplyLeave(false);
            loadLeaves();
            onLeaveSubmitted?.();
          }}
          existingLeaves={leaves}
          offDays={offDays}
        />
      )}
    </div>
  );
}

function leaveDuration(lv: LeaveRequest): string {
  const start = new Date(lv.startDate);
  const end = new Date(lv.endDate);
  const ms = end.getTime() - start.getTime();
  const days = Math.max(1, Math.round(ms / 86400000) + 1);
  if (lv.isHalfDay && days === 1) return "0.5 day";
  return days === 1 ? "1 day" : `${days} days`;
}

function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const map: Record<LeaveStatus, string> = {
    Pending:
      "text-brand bg-brand/10 ring-1 ring-brand/20",
    Approved:
      "text-green-400 bg-green-500/10 ring-1 ring-green-500/20",
    Rejected: "text-red-400 bg-red-500/10 ring-1 ring-red-500/20",
    Cancelled:
      "text-[#a8a8a8] bg-white/5 ring-1 ring-white/10",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}
    >
      {status}
    </span>
  );
}

const LEAVE_TYPE_OPTIONS: LeaveType[] = [
  "Casual Leave",
  "Sick Leave",
  "Earned Leave",
  "Official Duty",
];

function ApplyLeaveModal({
  onClose,
  onSubmitted,
  existingLeaves,
  offDays,
}: {
  onClose: () => void;
  onSubmitted: () => void;
  existingLeaves: LeaveRequest[];
  offDays: number[];
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>("Casual Leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | undefined>();
  const [attachmentName, setAttachmentName] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFile(file);
      setAttachmentUrl(res.url);
      setAttachmentName(file.name);
      toast.success("Document attached");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!leaveType) return toast.error("Select a leave type");
    if (!startDate) return toast.error("Select a start date");
    if (!endDate) return toast.error("Select an end date");
    // Block past-date leave applications
    const todayStr = new Date().toISOString().slice(0, 10);
    if (startDate < todayStr) {
      return toast.error("Leave cannot be applied for past dates. Please select today or a future date.");
    }
    if (endDate < startDate)
      return toast.error("End date cannot be before start date");
    if (isHalfDay && startDate !== endDate)
      return toast.error("Half-day leave can only be applied for a single day. Start and end date must be the same.");
    if (!reason.trim()) return toast.error("Enter a reason");

    if (offDays.length > 0) {
      let hasWorkingDay = false;
      const cur = new Date(startDate);
      const end = new Date(endDate);
      while (cur <= end) {
        if (!offDays.includes(cur.getDay())) { hasWorkingDay = true; break; }
        cur.setDate(cur.getDate() + 1);
      }
      if (!hasWorkingDay)
        return toast.error("Selected dates fall entirely on non-working days. Please select working days.");
    }

    const d = (s: string) => s.slice(0, 10);
    const conflict = existingLeaves.find(
      (lr) =>
        lr.status !== "Cancelled" &&
        lr.status !== "Rejected" &&
        d(lr.startDate) <= endDate &&
        d(lr.endDate) >= startDate
    );
    if (conflict)
      return toast.error(
        `You already have a ${conflict.status.toLowerCase()} leave request covering this period. Cancel or wait for it to be rejected before applying again.`
      );

    setSubmitting(true);
    try {
      await createLeaveRequest({
        leaveType,
        startDate,
        endDate,
        isHalfDay,
        reason: reason.trim(),
        attachmentUrl,
      });
      toast.success("Leave request submitted");
      onSubmitted();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-[#050505] rounded-xl border border-white/8 w-full max-w-lg shadow-xl animate-[slideUp_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Apply for Leave
            </h3>
            <p className="text-xs text-[#7a7a7a] mt-0.5">
              Submit a new leave request for approval
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/8 rounded transition-colors cursor-pointer"
          >
            <X className="h-4 w-4 text-[#a8a8a8]" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
              Leave Type <span className="text-red-400">*</span>
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full px-2.5 py-2 text-xs bg-[#0e0e12] border border-white/8 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              {LEAVE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
                Start Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                min={new Date().toISOString().slice(0, 10)}
                max={isHalfDay ? undefined : (endDate || undefined)}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (isHalfDay) setEndDate(e.target.value);
                }}
                className="w-full px-2.5 py-2 text-xs bg-[#0e0e12] border border-white/8 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand/40 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
                End Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isHalfDay}
                className={`w-full px-2.5 py-2 text-xs bg-[#0e0e12] border border-white/8 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand/40 [color-scheme:dark]${isHalfDay ? " opacity-50 cursor-not-allowed" : ""}`}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isHalfDay}
              onChange={(e) => {
                setIsHalfDay(e.target.checked);
                if (e.target.checked && startDate) setEndDate(startDate);
              }}
              className="h-3.5 w-3.5 accent-brand"
            />
            <span className="text-xs text-[#a8a8a8]">Half-day leave</span>
          </label>

          <div>
            <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Briefly describe the reason for your leave"
              className="w-full px-2.5 py-2 text-xs bg-[#0e0e12] border border-white/8 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
              Attach Document{" "}
              <span className="text-[#5a5a5a]">(optional)</span>
            </label>
            <label className="flex items-center gap-2 px-2.5 py-2 text-xs bg-[#0e0e12] border border-white/8 border-dashed rounded-lg text-[#a8a8a8] hover:border-brand/30 hover:text-white transition-colors cursor-pointer">
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
              ) : (
                <Upload className="h-3.5 w-3.5 text-[#a8a8a8]" />
              )}
              <span className="truncate">
                {attachmentName ||
                  (uploading ? "Uploading..." : "Click to upload a file")}
              </span>
              <input
                type="file"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/8">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-medium text-[#a8a8a8] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-foreground bg-brand rounded-lg hover:bg-brand/90 transition-colors cursor-pointer disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}

function AttendanceDetailsModal({
  record,
  onClose,
}: {
  record: AttendanceRecord;
  onClose: () => void;
}) {
  const prettyDate = new Date(record.date + "T00:00:00").toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const notMarked = record.status === "Not Marked" || (!record.loginTime && !record.logoutTime);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#050505] rounded-xl border border-white/8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 sticky top-0 bg-[#050505]">
          <div>
            <h2 className="text-base font-semibold text-white">
              Attendance Details
            </h2>
            <p className="text-xs text-[#7a7a7a] mt-0.5">{prettyDate}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/8 rounded transition-colors cursor-pointer"
          >
            <X className="h-5 w-5 text-[#a8a8a8]" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-orange-400 flex items-center justify-center text-brand-foreground text-lg font-semibold">
              CU
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Current User</h3>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-md text-xs font-medium mt-1 ring-1 ${
                  record.status === "Present"
                    ? "text-green-400 bg-green-500/10 ring-green-500/20"
                    : "text-[#a8a8a8] bg-white/5 ring-white/10"
                }`}
              >
                {record.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <DetailTile label="Login Time" value={record.loginTime ?? "—"} />
            <DetailTile label="Logout Time" value={record.logoutTime ?? "—"} />
            <DetailTile label="Total Hours" value={record.hoursWorked ?? "—"} />
          </div>

          <div className="bg-[#0e0e12] border border-white/8 rounded-lg p-8 text-center">
            <Clock className="h-10 w-10 text-[#5a5a5a] mx-auto mb-2" />
            <p className="text-xs text-[#a8a8a8]">
              {notMarked
                ? "Attendance not marked yet"
                : record.breakTime
                ? `Total break: ${record.breakTime}${
                    record.breakCount > 0 ? ` (${record.breakCount})` : ""
                  }`
                : "No breaks taken"}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/8 bg-[#050505]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#0e0e12] border border-white/8 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0e0e12] border border-white/8 rounded-lg p-3">
      <p className="text-[11px] font-medium text-[#a8a8a8] mb-1">{label}</p>
      <p className="text-base font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}

function StatusCard({
  label,
  value,
  valueClass,
  icon,
  iconBg,
}: {
  label: string;
  value: string;
  valueClass: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="bg-[#050505] rounded-xl border border-white/8 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#a8a8a8] mb-0.5">{label}</p>
          <p className={`text-lg font-semibold ${valueClass}`}>{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/** Grey stat card used by the admin org-attendance header row (per design:
 *  grey card with the value inside an inner grey box). */
function OrgStatCard({
  label,
  value,
  icon,
  action,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-[#151517] rounded-xl border border-white/8 p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="text-xs font-medium text-[#a8a8a8]">{label}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#232327] border border-white/5">
          <p className="text-lg font-semibold text-white truncate">{value}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

/** Filters dialog for the admin org-attendance view. Holds draft values —
 *  nothing is applied until "Apply Filter". Left nav switches between
 *  Branches / Departments / Date panes (per design). */
function OrgFiltersDialog({
  branches,
  departments,
  initial,
  onApply,
  onClose,
}: {
  branches: Branch[];
  departments: Department[];
  initial: { startDate: string; endDate: string; branchId: string; departmentId: string };
  onApply: (f: { startDate: string; endDate: string; branchId: string; departmentId: string }) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"branch" | "dept" | "date">("date");
  const [dStart, setDStart] = useState(initial.startDate);
  const [dEnd, setDEnd] = useState(initial.endDate);
  const [dBranch, setDBranch] = useState(initial.branchId);
  const [dDept, setDDept] = useState(initial.departmentId);

  function reset() {
    const range = defaultDateRange();
    setDStart(range.start);
    setDEnd(range.end);
    setDBranch("all");
    setDDept("all");
  }

  function apply() {
    if (!dStart || !dEnd) {
      toast.error("Select both a start and end date");
      return;
    }
    if (dStart > dEnd) {
      toast.error("Start date cannot be after the end date");
      return;
    }
    onApply({ startDate: dStart, endDate: dEnd, branchId: dBranch, departmentId: dDept });
  }

  const navItem = (key: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`w-full flex items-center justify-between px-4 py-3 text-[13px] font-medium text-left transition-colors cursor-pointer ${
        tab === key ? "bg-[#2a2a2e] text-white" : "text-[#a8a8a8] hover:bg-white/5 hover:text-white"
      }`}
    >
      {label}
      <ChevronRight className="h-3.5 w-3.5 opacity-60" />
    </button>
  );

  const optionRow = (
    selected: boolean,
    label: string,
    onSelect: () => void,
    key: string
  ) => (
    <button
      key={key}
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-left transition-colors cursor-pointer ${
        selected ? "bg-[#2a2a2e] text-white" : "text-[#a8a8a8] hover:bg-white/5 hover:text-white"
      }`}
    >
      <span
        className={`h-3.5 w-3.5 rounded-full border shrink-0 ${
          selected ? "border-brand bg-brand" : "border-white/25"
        }`}
      />
      <span className="truncate">{label}</span>
    </button>
  );

  const DATE_INPUT =
    "w-full px-3 py-2 text-[13px] bg-[#151517] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand/40 [color-scheme:dark]";

  return (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] bg-[#1c1c1e] rounded-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden animate-[scaleIn_0.15s_ease-out]"
      >
        <div className="flex min-h-[320px]">
          {/* Left nav */}
          <div className="w-[180px] shrink-0 bg-[#161618] border-r border-white/8 py-4">
            <p className="px-4 pb-3 text-[14px] font-semibold text-white">Filters</p>
            {navItem("branch", "By Branches")}
            {navItem("dept", "By Departments")}
            {navItem("date", "Date")}
          </div>

          {/* Right pane */}
          <div className="flex-1 p-5 overflow-y-auto max-h-[420px]">
            {tab === "date" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#a8a8a8] mb-1.5">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={dStart}
                    max={dEnd || undefined}
                    onChange={(e) => setDStart(e.target.value)}
                    className={DATE_INPUT}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#a8a8a8] mb-1.5">
                    End date
                  </label>
                  <input
                    type="date"
                    value={dEnd}
                    min={dStart || undefined}
                    max={fmtDate(new Date().toISOString())}
                    onChange={(e) => setDEnd(e.target.value)}
                    className={DATE_INPUT}
                  />
                </div>
              </div>
            )}
            {tab === "branch" && (
              <div className="space-y-1">
                {optionRow(dBranch === "all", "All Branches", () => setDBranch("all"), "all")}
                {branches.map((b) =>
                  optionRow(dBranch === b._id, b.name, () => setDBranch(b._id), b._id)
                )}
              </div>
            )}
            {tab === "dept" && (
              <div className="space-y-1">
                {optionRow(dDept === "all", "All Departments", () => setDDept("all"), "all")}
                {departments.map((d) =>
                  optionRow(dDept === d._id, d.name, () => setDDept(d._id), d._id)
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-white/8 bg-[#161618]">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] font-medium text-[#a8a8a8] hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 rounded-lg border border-white/15 text-[13px] font-medium text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
            <button
              type="button"
              onClick={apply}
              className="px-4 py-2 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 transition-colors cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  disabled,
  onClick,
  borderClass,
  iconBg,
  labelClass,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  borderClass: string;
  iconBg: string;
  labelClass: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${borderClass} ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <span className={`text-xs font-medium ${labelClass}`}>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Admin view
// ---------------------------------------------------------------------------

type AdminEntry = {
  _id: string;
  userId: { _id: string; name?: string; email?: string } | string;
  clockInTime: string;
  clockOutTime: string | null;
  durationInSeconds?: number;
};

type AdminBreakLog = {
  _id: string;
  userId: { _id: string; name?: string; email?: string } | string;
  breakStartTime: string;
  breakStopTime: string | null;
  durationInSeconds?: number;
};

type AdminRow = {
  key: string;
  userId: string;
  name: string;
  department: string;
  branch: string;
  date: string;
  loginTime: string | null;
  logoutTime: string | null;
  hoursWorked: string | null;
  breakTime: string | null;
  breakCount: number;
  status: "Present" | "Absent" | "Half Day";
  dayEntries: AdminEntry[];
  dayBreaks: AdminBreakLog[];
  breakSeconds: number;
};

function extractUserId(u: AdminEntry["userId"]): string {
  return typeof u === "string" ? u : u?._id || "";
}

function initialsOf(name: string) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function todayDateKey() {
  return fmtDate(new Date().toISOString());
}

function daysBetween(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  const s = new Date(startKey + "T00:00:00");
  const e = new Date(endKey + "T00:00:00");
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return out;
  const cur = new Date(s);
  while (cur.getTime() <= e.getTime()) {
    out.push(fmtDate(cur.toISOString()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function defaultDateRange(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 6); // last 7 days inclusive
  return {
    start: fmtDate(start.toISOString()),
    end: fmtDate(today.toISOString()),
  };
}

function ManagerAttendanceView() {
  const [selfMode, setSelfMode] = useState(false);
  const [showMyRecords, setShowMyRecords] = useState(false);

  const initialRange = useMemo(() => defaultDateRange(), []);

  const [teamEmployees, setTeamEmployees] = useState<EmployeeListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [entries, setEntries] = useState<AdminEntry[]>([]);
  const [breakLogs, setBreakLogs] = useState<AdminBreakLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [mgrDetail, setMgrDetail] = useState<AdminRow | null>(null);

  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>(initialRange.start);
  const [endDate, setEndDate] = useState<string>(initialRange.end);

  // Pending leaves state
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [selfRecords, setSelfRecords] = useState<AttendanceRecord[]>([]);

  const loadPendingLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try {
      const res = await listTeamLeaveRequests("Pending");
      setPendingLeaves(res.leaves || []);
    } catch (err: any) {
      console.error("Failed to load team pending leaves", err);
    } finally {
      setLeavesLoading(false);
    }
  }, []);

  const handleDecide = useCallback(
    async (id: string, action: "approve" | "reject") => {
      if (decidingId) return;
      if (action === "approve") {
        const todayStr = new Date().toISOString().slice(0, 10);
        const leave = pendingLeaves.find((lv) => lv._id === id);
        if (leave && fmtDate(leave.endDate) < todayStr) {
          toast.error("Cannot approve leave: the leave period has already passed.");
          return;
        }
      }
      setDecidingId(id);
      try {
        if (action === "approve") await approveLeaveRequest(id);
        else await rejectLeaveRequest(id);
        toast.success(
          action === "approve" ? "Leave approved" : "Leave rejected"
        );
        await loadPendingLeaves();
      } catch (err: any) {
        toast.error(err?.message || "Action failed");
      } finally {
        setDecidingId(null);
      }
    },
    [decidingId, loadPendingLeaves, pendingLeaves]
  );

  // Load employees list to build team roster + departments for filter
  useEffect(() => {
    async function loadStatic() {
      try {
        const [empRes, deptRes] = await Promise.all([
          listEmployees(),
          listDepartments(),
        ]);
        const allEmps = empRes.employees || [];
        const myUserId = getUserIdFromToken();
        // Filter to direct reports — those whose reportingManagerId matches me
        const team = allEmps.filter((e) => {
          const mgr = e.profile?.reportingManagerId;
          const mgrId = typeof mgr === "string" ? mgr : mgr?._id;
          return mgrId === myUserId;
        });
        setTeamEmployees(team);
        setDepartments(deptRes.departments || []);
      } catch (err: any) {
        console.error("Failed to load team data", err);
        toast.error(err?.message || "Failed to load team");
      }
    }
    loadStatic();
    loadPendingLeaves();
  }, [loadPendingLeaves]);

  // Fetch attendance for date range
  useEffect(() => {
    async function loadAttendance() {
      if (!startDate || !endDate) return;
      if (startDate > endDate) {
        toast.error("Start date must be before end date");
        return;
      }
      setAttendanceLoading(true);
      try {
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) return;
        const startIso = new Date(startDate + "T00:00:00").toISOString();
        const endIso = new Date(endDate + "T23:59:59").toISOString();
        const attRes = await api<{
          success: boolean;
          entries: AdminEntry[];
          breakLogs: AdminBreakLog[];
        }>(
          `/betty/manager-team-attendance?orgId=${orgId}&start=${encodeURIComponent(
            startIso
          )}&end=${encodeURIComponent(endIso)}`
        );
        setEntries(attRes.entries || []);
        setBreakLogs(attRes.breakLogs || []);
      } catch (err: any) {
        console.error("Failed to load team attendance", err);
        toast.error(err?.message || "Failed to load attendance");
      } finally {
        setAttendanceLoading(false);
        setLoading(false);
      }
    }
    loadAttendance();
  }, [startDate, endDate]);

  const rows: AdminRow[] = useMemo(() => {
    // Apply filters
    const filtered = teamEmployees.filter((e) => {
      if (departmentFilter !== "all") {
        const dId =
          typeof e.profile?.departmentId === "string"
            ? e.profile?.departmentId
            : e.profile?.departmentId?._id || "";
        if (dId !== departmentFilter) return false;
      }
      if (memberFilter !== "all" && e.userId !== memberFilter) return false;
      return true;
    });

    const entriesByKey = new Map<string, AdminEntry[]>();
    entries.forEach((e) => {
      const uid = extractUserId(e.userId);
      const dateK = fmtDate(e.clockInTime);
      const k = `${uid}|${dateK}`;
      if (!entriesByKey.has(k)) entriesByKey.set(k, []);
      entriesByKey.get(k)!.push(e);
    });
    const breaksByKey = new Map<string, AdminBreakLog[]>();
    breakLogs.forEach((b) => {
      const uid = extractUserId(b.userId);
      const dateK = fmtDate(b.breakStartTime);
      const k = `${uid}|${dateK}`;
      if (!breaksByKey.has(k)) breaksByKey.set(k, []);
      breaksByKey.get(k)!.push(b);
    });

    const dates = daysBetween(startDate, endDate).sort().reverse();
    const out: AdminRow[] = [];

    for (const date of dates) {
      for (const emp of filtered) {
        const k = `${emp.userId}|${date}`;
        const dayEntries = entriesByKey.get(k) || [];
        const dayBreaks = breaksByKey.get(k) || [];

        const dept =
          typeof emp.profile?.departmentId === "object"
            ? emp.profile?.departmentId?.name
            : "—";
        const branch =
          typeof emp.profile?.branchId === "object"
            ? emp.profile?.branchId?.name
            : "—";

        if (dayEntries.length === 0) {
          // Don't fabricate "Absent" rows for dates before the employee
          // existed in this org (same rule as AdminAttendanceView).
          const joinIso = emp.profile?.dateOfJoining || emp.joinedAt;
          if (joinIso && date < fmtDate(joinIso)) continue;
          out.push({
            key: k,
            userId: emp.userId,
            name: emp.name,
            department: dept || "—",
            branch: branch || "—",
            date,
            loginTime: null,
            logoutTime: null,
            hoursWorked: null,
            breakTime: null,
            breakCount: 0,
            status: "Absent",
            dayEntries: [],
            dayBreaks: [],
            breakSeconds: 0,
          });
          continue;
        }

        const sorted = [...dayEntries].sort(
          (a, b) =>
            new Date(a.clockInTime).getTime() -
            new Date(b.clockInTime).getTime()
        );
        const firstIn = sorted[0].clockInTime;
        const lastOut = sorted[sorted.length - 1].clockOutTime;
        const totalSec = dayEntries.reduce((sum, e) => {
          if (typeof e.durationInSeconds === "number")
            return sum + e.durationInSeconds;
          if (e.clockOutTime)
            return (
              sum +
              (new Date(e.clockOutTime).getTime() -
                new Date(e.clockInTime).getTime()) /
                1000
            );
          return sum;
        }, 0);
        const breakSec = dayBreaks.reduce((sum, b) => {
          if (typeof b.durationInSeconds === "number")
            return sum + b.durationInSeconds;
          if (b.breakStopTime)
            return (
              sum +
              (new Date(b.breakStopTime).getTime() -
                new Date(b.breakStartTime).getTime()) /
                1000
            );
          return sum;
        }, 0);

        out.push({
          key: k,
          userId: emp.userId,
          name: emp.name,
          department: dept || "—",
          branch: branch || "—",
          date,
          loginTime: fmtTime(firstIn),
          logoutTime: lastOut ? fmtTime(lastOut) : null,
          hoursWorked: totalSec > 0 ? fmtHours(totalSec) : null,
          breakTime: breakSec > 0 ? fmtDuration(breakSec) : null,
          breakCount: dayBreaks.length,
          status: totalSec > 0 && totalSec < 14400 ? "Half Day" : "Present",
          dayEntries,
          dayBreaks,
          breakSeconds: breakSec,
        });
      }
    }

    return out.sort((a, b) => {
      if (a.date !== b.date) return a.date > b.date ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [
    teamEmployees,
    entries,
    breakLogs,
    departmentFilter,
    memberFilter,
    startDate,
    endDate,
  ]);

  const handleExport = useCallback(() => {
    if (showMyRecords) {
      if (selfRecords.length === 0) {
        toast.error("No data to export");
        return;
      }
      const data = selfRecords.map((r) => ({
        Date: r.date,
        "Login Time": r.loginTime ?? "—",
        "Logout Time": r.logoutTime ?? "—",
        "Hours Worked": r.hoursWorked ?? "—",
        "Break Time": fmtBreakCell(r.breakTime, r.breakCount),
        Status: r.status,
      }));
      exportRowsToExcel(data, "My_Attendance_Records.xlsx");
      return;
    }
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    const data = rows.map((r) => ({
      Employee: r.name,
      Date: r.date,
      "Login Time": r.loginTime ?? "—",
      "Logout Time": r.logoutTime ?? "—",
      "Hours Worked": r.hoursWorked ?? "—",
      "Total Break": fmtBreakCell(r.breakTime, r.breakCount),
      Status: r.status,
    }));
    exportRowsToExcel(
      data,
      `Team_Attendance_${startDate}_to_${endDate}.xlsx`
    );
  }, [showMyRecords, selfRecords, rows, startDate, endDate]);

  const pendingLeavesPg = usePagination(pendingLeaves);
  const rowsPg = usePagination(rows);

  const teamSize = teamEmployees.length;
  const today = todayDateKey();
  const loggedInTodayIds = new Set<string>();
  entries.forEach((e) => {
    if (fmtDate(e.clockInTime) === today)
      loggedInTodayIds.add(extractUserId(e.userId));
  });
  const loggedInToday = loggedInTodayIds.size;
  // Count approved leaves that overlap today
  const onLeaveToday = pendingLeaves.length; // for now shows pending count
  const attendancePct =
    teamSize > 0
      ? ((loggedInToday / teamSize) * 100).toFixed(1)
      : "0.0";

  // When the manager flips into Self Attendance, defer to the employee
  // view (without its records grid — those live on the org tab via the
  // My Records toggle).
  if (selfMode) {
    return (
      <EmployeeAttendanceView
        hideRecords
        onBackToOrg={() => setSelfMode(false)}
        onLeaveSubmitted={loadPendingLeaves}
      />
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Attendance
          </h2>
          <p className="text-sm text-[#7a7a7a] mt-1">
            Monitor your team attendance
          </p>
        </div>
        <ViewTabs
          active="org"
          onChange={(v) => v === "self" && setSelfMode(true)}
        />
      </div>

      {/* Filters */}
      <div className="bg-[#050505] rounded-xl border border-white/8 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[#0e0e12] border border-white/8 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand/40 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={fmtDate(new Date().toISOString())}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[#0e0e12] border border-white/8 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand/40 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
              Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[#0e0e12] border border-white/8 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
              Team Member
            </label>
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[#0e0e12] border border-white/8 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              <option value="all">All Team Members</option>
              {teamEmployees.map((e) => (
                <option key={e.userId} value={e.userId}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusCard
          label="Team Size"
          value={String(teamSize)}
          valueClass="text-white"
          icon={<Users className="h-4 w-4 text-blue-400" />}
          iconBg="bg-blue-500/10 ring-1 ring-blue-500/20"
        />
        <StatusCard
          label="Team Logged In"
          value={String(loggedInToday)}
          valueClass="text-green-400"
          icon={<LogIn className="h-4 w-4 text-green-400" />}
          iconBg="bg-green-500/10 ring-1 ring-green-500/20"
        />
        <StatusCard
          label="Team On Leave"
          value={String(onLeaveToday)}
          valueClass="text-orange-400"
          icon={<Calendar className="h-4 w-4 text-orange-400" />}
          iconBg="bg-orange-500/10 ring-1 ring-orange-500/20"
        />
        <StatusCard
          label="Attendance %"
          value={`${attendancePct}%`}
          valueClass="text-brand"
          icon={<TrendingUp className="h-4 w-4 text-brand" />}
          iconBg="bg-brand/10 ring-1 ring-brand/20"
        />
      </div>

      {/* Leave Approval Queue */}
      <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8">
          <h2 className="text-sm font-semibold text-white">
            Leave Approval Queue
          </h2>
          <p className="text-xs text-[#7a7a7a] mt-0.5">
            Review and approve leave requests from your team members
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {[
                  "Employee Name",
                  "Leave Type",
                  "Start Date",
                  "End Date",
                  "Duration",
                  "Reason",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-[#7a7a7a] px-4 py-2.5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leavesLoading || pendingLeavesPg.transitioning ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-brand inline-block" />
                  </td>
                </tr>
              ) : pendingLeaves.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <p className="text-xs text-[#a8a8a8]">
                      No pending leave requests
                    </p>
                    <p className="text-xs text-[#5a5a5a] mt-0.5">
                      Approvals will show up here when team members submit leave
                    </p>
                  </td>
                </tr>
              ) : (
                pendingLeavesPg.pageItems.map((lv) => {
                  const empName =
                    typeof lv.userId === "object"
                      ? lv.userId.name
                      : "Unknown";
                  const empEmail =
                    typeof lv.userId === "object" ? lv.userId.email : "";
                  return (
                    <tr
                      key={lv._id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-orange-400 flex items-center justify-center text-brand-foreground text-[10px] font-semibold">
                            {initialsOf(empName)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">
                              {empName}
                            </p>
                            {empEmail && (
                              <p className="text-[10px] text-[#7a7a7a] truncate">
                                {empEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-white">
                        {lv.leaveType}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                        {fmtDate(lv.startDate)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                        {fmtDate(lv.endDate)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                        {leaveDuration(lv)}
                      </td>
                      <td
                        className="px-4 py-2.5 text-xs text-[#a8a8a8] max-w-[220px] truncate"
                        title={lv.reason}
                      >
                        {lv.reason}
                      </td>
                      <td className="px-4 py-2.5">
                        <LeaveStatusBadge status={lv.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDecide(lv._id, "approve")}
                            disabled={decidingId === lv._id}
                            className="p-1 hover:bg-green-500/20 rounded transition-colors cursor-pointer disabled:opacity-50"
                            title="Approve"
                          >
                            {decidingId === lv._id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-green-400" />
                            ) : (
                              <Check className="h-3.5 w-3.5 text-green-400" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDecide(lv._id, "reject")}
                            disabled={decidingId === lv._id}
                            className="p-1 hover:bg-red-500/20 rounded transition-colors cursor-pointer disabled:opacity-50"
                            title="Reject"
                          >
                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pendingLeavesPg.page}
          totalPages={pendingLeavesPg.totalPages}
          total={pendingLeavesPg.total}
          start={pendingLeavesPg.start}
          end={pendingLeavesPg.end}
          loading={pendingLeavesPg.transitioning}
          onPrev={pendingLeavesPg.goPrev}
          onNext={pendingLeavesPg.goNext}
        />
      </div>

      {/* Attendance Records */}
      <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Attendance Records
            </h2>
            <p className="text-xs text-[#7a7a7a] mt-0.5">
              {showMyRecords ? "My attendance history" : "Team attendance overview"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-white transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Export to Excel
            </button>
            <MyRecordsToggle
              on={showMyRecords}
              onChange={setShowMyRecords}
              orgLabel="Team"
            />
          </div>
        </div>
        {showMyRecords ? (
          <SelfAttendanceRecordsGrid onRecordsChange={setSelfRecords} />
        ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {[
                  "Employee",
                  "Date",
                  "Login Time",
                  "Logout Time",
                  "Hours Worked",
                  "Total Break",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-[#7a7a7a] px-4 py-2.5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading || attendanceLoading || rowsPg.transitioning ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-brand inline-block" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <p className="text-xs text-[#a8a8a8]">
                      No attendance records found
                    </p>
                    <p className="text-xs text-[#5a5a5a] mt-0.5">
                      Try adjusting the filters above
                    </p>
                  </td>
                </tr>
              ) : (
                rowsPg.pageItems.map((r) => (
                  <tr
                    key={r.key}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-orange-400 flex items-center justify-center text-brand-foreground text-[10px] font-semibold">
                          {initialsOf(r.name)}
                        </div>
                        <span className="text-xs font-medium text-white">
                          {r.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.date}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.loginTime ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.logoutTime ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-white">
                      {r.hoursWorked ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.breakTime ? (
                        <span className="text-white font-medium">
                          {r.breakTime}
                          {r.breakCount > 0 && (
                            <span className="text-[#5a5a5a] ml-1">
                              ({r.breakCount})
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          r.status === "Present"
                            ? "text-green-400 bg-green-500/10 ring-1 ring-green-500/20"
                            : r.status === "Half Day"
                            ? "text-brand bg-brand/10 ring-1 ring-brand/20"
                            : "text-red-400 bg-red-500/10 ring-1 ring-red-500/20"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setMgrDetail(r)}
                        className="p-1 hover:bg-white/8 rounded transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="h-3.5 w-3.5 text-brand" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={rowsPg.page}
          totalPages={rowsPg.totalPages}
          total={rowsPg.total}
          start={rowsPg.start}
          end={rowsPg.end}
          loading={rowsPg.transitioning}
          onPrev={rowsPg.goPrev}
          onNext={rowsPg.goNext}
        />
        </>
        )}
      </div>

      {mgrDetail && (
        <AdminAttendanceDetailsModal
          row={mgrDetail}
          onClose={() => setMgrDetail(null)}
        />
      )}
    </div>
  );
}

function AdminAttendanceView() {
  const [selfMode, setSelfMode] = useState(false);
  const [showMyRecords, setShowMyRecords] = useState(false);

  const initialRange = useMemo(() => defaultDateRange(), []);

  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [entries, setEntries] = useState<AdminEntry[]>([]);
  const [breakLogs, setBreakLogs] = useState<AdminBreakLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [adminDetail, setAdminDetail] = useState<AdminRow | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [selfRecords, setSelfRecords] = useState<AttendanceRecord[]>([]);

  const loadPendingLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try {
      const res = await listOrgLeaveRequests("Pending");
      setPendingLeaves(res.leaves || []);
    } catch (err: any) {
      console.error("Failed to load pending leaves", err);
    } finally {
      setLeavesLoading(false);
    }
  }, []);

  const handleDecide = useCallback(
    async (id: string, action: "approve" | "reject") => {
      if (decidingId) return;
      if (action === "approve") {
        const todayStr = new Date().toISOString().slice(0, 10);
        const leave = pendingLeaves.find((lv) => lv._id === id);
        if (leave && fmtDate(leave.endDate) < todayStr) {
          toast.error("Cannot approve leave: the leave period has already passed.");
          return;
        }
      }
      setDecidingId(id);
      try {
        if (action === "approve") await approveLeaveRequest(id);
        else await rejectLeaveRequest(id);
        toast.success(
          action === "approve" ? "Leave approved" : "Leave rejected"
        );
        await loadPendingLeaves();
      } catch (err: any) {
        toast.error(err?.message || "Action failed");
      } finally {
        setDecidingId(null);
      }
    },
    [decidingId, loadPendingLeaves, pendingLeaves]
  );

  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>(initialRange.start);
  const [endDate, setEndDate] = useState<string>(initialRange.end);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  // Yellow dot on the Filters button when anything differs from defaults
  const filtersActive =
    branchFilter !== "all" ||
    departmentFilter !== "all" ||
    startDate !== initialRange.start ||
    endDate !== initialRange.end;

  // One-time load of employees / branches / departments
  useEffect(() => {
    async function loadStatic() {
      try {
        const [empRes, branchRes, deptRes] = await Promise.all([
          listEmployees(),
          listBranches(),
          listDepartments(),
        ]);
        setEmployees(empRes.employees || []);
        setBranches(branchRes.branches || []);
        setDepartments(deptRes.departments || []);
      } catch (err: any) {
        console.error("Failed to load teamforce lookups", err);
        toast.error(err?.message || "Failed to load attendance");
      }
    }
    loadStatic();
    loadPendingLeaves();
  }, [loadPendingLeaves]);

  // Re-fetch attendance whenever the date range changes
  useEffect(() => {
    async function loadAttendance() {
      if (!startDate || !endDate) return;
      if (startDate > endDate) {
        toast.error("Start date must be before end date");
        return;
      }
      setAttendanceLoading(true);
      try {
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) return;
        const startIso = new Date(startDate + "T00:00:00").toISOString();
        const endIso = new Date(endDate + "T23:59:59").toISOString();
        const attRes = await api<{
          success: boolean;
          entries: AdminEntry[];
          breakLogs: AdminBreakLog[];
        }>(
          `/betty/admin-org-attendance?orgId=${orgId}&start=${encodeURIComponent(
            startIso
          )}&end=${encodeURIComponent(endIso)}`
        );
        setEntries(attRes.entries || []);
        setBreakLogs(attRes.breakLogs || []);
      } catch (err: any) {
        console.error("Failed to load admin attendance", err);
        toast.error(err?.message || "Failed to load attendance");
      } finally {
        setAttendanceLoading(false);
        setLoading(false);
      }
    }
    loadAttendance();
  }, [startDate, endDate]);

  const rows: AdminRow[] = useMemo(() => {
    const empById = new Map<string, EmployeeListItem>();
    employees.forEach((e) => empById.set(e.userId, e));

    // Filter employees by branch / department
    const filteredEmployees = employees.filter((e) => {
      const p = e.profile;
      if (branchFilter !== "all") {
        const bId =
          typeof p?.branchId === "string"
            ? p?.branchId
            : p?.branchId?._id || "";
        if (bId !== branchFilter) return false;
      }
      if (departmentFilter !== "all") {
        const dId =
          typeof p?.departmentId === "string"
            ? p?.departmentId
            : p?.departmentId?._id || "";
        if (dId !== departmentFilter) return false;
      }
      return true;
    });

    // Group entries and breaks by user + date
    const entriesByKey = new Map<string, AdminEntry[]>();
    entries.forEach((e) => {
      const uid = extractUserId(e.userId);
      const dateK = fmtDate(e.clockInTime);
      const k = `${uid}|${dateK}`;
      if (!entriesByKey.has(k)) entriesByKey.set(k, []);
      entriesByKey.get(k)!.push(e);
    });
    const breaksByKey = new Map<string, AdminBreakLog[]>();
    breakLogs.forEach((b) => {
      const uid = extractUserId(b.userId);
      const dateK = fmtDate(b.breakStartTime);
      const k = `${uid}|${dateK}`;
      if (!breaksByKey.has(k)) breaksByKey.set(k, []);
      breaksByKey.get(k)!.push(b);
    });

    const dates = daysBetween(startDate, endDate).sort().reverse();
    const out: AdminRow[] = [];

    for (const date of dates) {
      for (const emp of filteredEmployees) {
        const key = `${emp.userId}|${date}`;
        const dayEntries = entriesByKey.get(key) || [];
        const dayBreaks = breaksByKey.get(key) || [];
        const p = emp.profile;
        const branchName =
          typeof p?.branchId === "string"
            ? branches.find((b) => b._id === p?.branchId)?.name || "—"
            : p?.branchId?.name || "—";
        const deptName =
          typeof p?.departmentId === "string"
            ? departments.find((d) => d._id === p?.departmentId)?.name || "—"
            : p?.departmentId?.name || "—";

        if (dayEntries.length === 0 && dayBreaks.length === 0) {
          // Don't fabricate "Absent" rows for dates before the employee
          // existed in this org (new office / newly added employee would
          // otherwise show a week of fake absences).
          const joinIso = p?.dateOfJoining || emp.joinedAt;
          if (joinIso && date < fmtDate(joinIso)) continue;
          out.push({
            key,
            userId: emp.userId,
            name: emp.name,
            department: deptName,
            branch: branchName,
            date,
            loginTime: null,
            logoutTime: null,
            hoursWorked: null,
            breakTime: null,
            breakCount: 0,
            status: "Absent",
            dayEntries: [],
            dayBreaks: [],
            breakSeconds: 0,
          });
          continue;
        }

        const sorted = [...dayEntries].sort(
          (a, b) =>
            new Date(a.clockInTime).getTime() - new Date(b.clockInTime).getTime()
        );
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const totalSec = sorted.reduce((sum, e) => {
          if (typeof e.durationInSeconds === "number")
            return sum + e.durationInSeconds;
          if (e.clockOutTime) {
            return (
              sum +
              (new Date(e.clockOutTime).getTime() -
                new Date(e.clockInTime).getTime()) /
                1000
            );
          }
          return sum;
        }, 0);
        const hasOpen = sorted.some((e) => !e.clockOutTime);
        const breakSec = dayBreaks.reduce((sum, b) => {
          if (typeof b.durationInSeconds === "number")
            return sum + b.durationInSeconds;
          if (b.breakStopTime) {
            return (
              sum +
              (new Date(b.breakStopTime).getTime() -
                new Date(b.breakStartTime).getTime()) /
                1000
            );
          }
          return (
            sum + (Date.now() - new Date(b.breakStartTime).getTime()) / 1000
          );
        }, 0);

        let status: AdminRow["status"] = "Present";
        if (totalSec > 0 && totalSec < 4 * 3600) status = "Half Day";

        out.push({
          key,
          userId: emp.userId,
          name: emp.name,
          department: deptName,
          branch: branchName,
          date,
          loginTime: first ? fmtTime(first.clockInTime) : null,
          logoutTime: last?.clockOutTime ? fmtTime(last.clockOutTime) : null,
          hoursWorked:
            totalSec > 0 ? fmtHours(totalSec) : hasOpen ? "—" : null,
          breakTime: breakSec > 0 ? fmtDuration(breakSec) : null,
          breakCount: dayBreaks.length,
          status,
          dayEntries: sorted,
          dayBreaks,
          breakSeconds: breakSec,
        });
      }
    }

    return out.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [
    employees,
    entries,
    breakLogs,
    branches,
    departments,
    branchFilter,
    departmentFilter,
    startDate,
    endDate,
  ]);

  const handleExport = useCallback(() => {
    if (showMyRecords) {
      if (selfRecords.length === 0) {
        toast.error("No data to export");
        return;
      }
      const data = selfRecords.map((r) => ({
        Date: r.date,
        "Login Time": r.loginTime ?? "—",
        "Logout Time": r.logoutTime ?? "—",
        "Hours Worked": r.hoursWorked ?? "—",
        "Break Time": fmtBreakCell(r.breakTime, r.breakCount),
        Status: r.status,
      }));
      exportRowsToExcel(data, "My_Attendance_Records.xlsx");
      return;
    }
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    const data = rows.map((r) => ({
      Employee: r.name,
      Department: r.department,
      Branch: r.branch,
      Date: r.date,
      "Login Time": r.loginTime ?? "—",
      "Logout Time": r.logoutTime ?? "—",
      "Hours Worked": r.hoursWorked ?? "—",
      "Total Break": fmtBreakCell(r.breakTime, r.breakCount),
      Status: r.status,
    }));
    exportRowsToExcel(
      data,
      `Organization_Attendance_${startDate}_to_${endDate}.xlsx`
    );
  }, [showMyRecords, selfRecords, rows, startDate, endDate]);

  const pendingLeavesPg = usePagination(pendingLeaves);
  const rowsPg = usePagination(rows);

  const totalEmployees = employees.length;
  const today = todayDateKey();
  const loggedInTodayUserIds = new Set<string>();
  entries.forEach((e) => {
    if (fmtDate(e.clockInTime) === today)
      loggedInTodayUserIds.add(extractUserId(e.userId));
  });
  const loggedInToday = loggedInTodayUserIds.size;
  const attendancePct =
    totalEmployees > 0
      ? ((loggedInToday / totalEmployees) * 100).toFixed(1)
      : "0.0";

  // Defer to the employee view when the admin/founder flips into Self
  // Attendance. It renders the grey stat cards + own records grid; quick
  // actions live in the dock while it's open.
  if (selfMode) {
    return (
      <EmployeeAttendanceView
        hideRecords
        onBackToOrg={() => setSelfMode(false)}
        onLeaveSubmitted={loadPendingLeaves}
        pendingApprovalsCount={pendingLeaves.length}
        onViewApprovals={() => {
          setSelfMode(false);
          setShowApprovals(true);
        }}
      />
    );
  }

  // Dedicated Leave Approvals page — opened via the "View Approvals" stat
  // card button; back button returns to the org attendance view.
  if (showApprovals) {
    return (
      <div className="animate-[fadeIn_0.3s_ease-out] space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowApprovals(false)}
            className="h-9 w-9 rounded-xl bg-[#1c1c1e] border border-white/10 hover:bg-[#26262a] flex items-center justify-center cursor-pointer transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-[#a8a8a8]" />
          </button>
          <h2 className="text-lg font-semibold text-white tracking-tight">
            Leave Approvals
          </h2>
        </div>
        <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8">
            <h2 className="text-sm font-semibold text-white">
              Leave Approval Queue
            </h2>
            <p className="text-xs text-[#7a7a7a] mt-0.5">
              Review and approve leave requests from all employees
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8">
                  {[
                    "Employee Name",
                    "Leave Type",
                    "Start Date",
                    "End Date",
                    "Duration",
                    "Reason",
                    "Status",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-[#7a7a7a] px-4 py-2.5"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leavesLoading || pendingLeavesPg.transitioning ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center">
                      <Loader2 className="h-5 w-5 animate-spin text-brand inline-block" />
                    </td>
                  </tr>
                ) : pendingLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center">
                      <p className="text-xs text-[#a8a8a8]">
                        No pending leave requests
                      </p>
                      <p className="text-xs text-[#5a5a5a] mt-0.5">
                        Approvals will show up here when employees submit leave
                      </p>
                    </td>
                  </tr>
                ) : (
                  pendingLeavesPg.pageItems.map((lv) => {
                    const empName =
                      typeof lv.userId === "object"
                        ? lv.userId.name
                        : "Unknown";
                    const empEmail =
                      typeof lv.userId === "object" ? lv.userId.email : "";
                    return (
                      <tr
                        key={lv._id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-orange-400 flex items-center justify-center text-brand-foreground text-[10px] font-semibold">
                              {initialsOf(empName)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate">
                                {empName}
                              </p>
                              {empEmail && (
                                <p className="text-[10px] text-[#7a7a7a] truncate">
                                  {empEmail}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-white">
                          {lv.leaveType}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                          {fmtDate(lv.startDate)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                          {fmtDate(lv.endDate)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                          {leaveDuration(lv)}
                        </td>
                        <td
                          className="px-4 py-2.5 text-xs text-[#a8a8a8] max-w-[220px] truncate"
                          title={lv.reason}
                        >
                          {lv.reason}
                        </td>
                        <td className="px-4 py-2.5">
                          <LeaveStatusBadge status={lv.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDecide(lv._id, "approve")}
                              disabled={decidingId === lv._id}
                              className="p-1 hover:bg-green-500/20 rounded transition-colors cursor-pointer disabled:opacity-50"
                              title="Approve"
                            >
                              {decidingId === lv._id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-green-400" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-green-400" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDecide(lv._id, "reject")}
                              disabled={decidingId === lv._id}
                              className="p-1 hover:bg-red-500/20 rounded transition-colors cursor-pointer disabled:opacity-50"
                              title="Reject"
                            >
                              <XCircle className="h-3.5 w-3.5 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={pendingLeavesPg.page}
            totalPages={pendingLeavesPg.totalPages}
            total={pendingLeavesPg.total}
            start={pendingLeavesPg.start}
            end={pendingLeavesPg.end}
            loading={pendingLeavesPg.transitioning}
            onPrev={pendingLeavesPg.goPrev}
            onNext={pendingLeavesPg.goNext}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out] space-y-4">
      {/* Header — tabs left, Filters + export right (per design) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ViewTabs
          active="org"
          onChange={(v) => v === "self" && setSelfMode(true)}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/10 bg-[#1c1c1e] hover:bg-[#26262a] text-xs font-medium text-white transition-colors cursor-pointer"
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {filtersActive && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-brand" />
            )}
          </button>
          <button
            type="button"
            onClick={handleExport}
            title="Export to Excel"
            className="flex items-center justify-center h-[34px] w-[34px] rounded-lg border border-white/10 bg-[#1c1c1e] hover:bg-[#26262a] text-white transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Filters dialog — Start/End date, Branch, Department live here now */}
      {filtersOpen && (
        <OrgFiltersDialog
          branches={branches}
          departments={departments}
          initial={{
            startDate,
            endDate,
            branchId: branchFilter,
            departmentId: departmentFilter,
          }}
          onApply={(f) => {
            setStartDate(f.startDate);
            setEndDate(f.endDate);
            setBranchFilter(f.branchId);
            setDepartmentFilter(f.departmentId);
            setFiltersOpen(false);
          }}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <OrgStatCard
          label="Total Employees"
          value={String(totalEmployees)}
          icon={<Users className="h-3.5 w-3.5 text-[#a8a8a8]" />}
        />
        <OrgStatCard
          label="Logged in Today"
          value={String(loggedInToday)}
          icon={<LogIn className="h-3.5 w-3.5 text-[#a8a8a8]" />}
        />
        <OrgStatCard
          label="Attendance"
          value={`${attendancePct}%`}
          icon={<TrendingUp className="h-3.5 w-3.5 text-[#a8a8a8]" />}
        />
        <OrgStatCard
          label="Pending Leave Approvals"
          value={String(pendingLeaves.length)}
          icon={<Calendar className="h-3.5 w-3.5 text-[#a8a8a8]" />}
          action={
            <button
              type="button"
              onClick={() => setShowApprovals(true)}
              className="px-2.5 py-1.5 rounded-md border border-white/10 bg-[#2a2a2e] hover:bg-[#333338] text-[11px] font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              View Approvals
            </button>
          }
        />
      </div>

      {/* Attendance Records — header bar removed; export lives in the
          top-right icon, table starts with the grey column row */}
      <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden">
        {showMyRecords ? (
          <SelfAttendanceRecordsGrid onRecordsChange={setSelfRecords} />
        ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1c1c1e] border-b border-white/8">
                {[
                  "Employee",
                  "Department",
                  "Branch",
                  "Date",
                  "Login Time",
                  "Logout Time",
                  "Hours Worked",
                  "Total Break",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-[#7a7a7a] px-4 py-2.5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading || attendanceLoading || rowsPg.transitioning ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-brand inline-block" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center">
                    <p className="text-xs text-[#a8a8a8]">
                      No attendance records found
                    </p>
                    <p className="text-xs text-[#5a5a5a] mt-0.5">
                      Try adjusting the filters above
                    </p>
                  </td>
                </tr>
              ) : (
                rowsPg.pageItems.map((r) => (
                  <tr
                    key={r.key}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-orange-400 flex items-center justify-center text-brand-foreground text-[10px] font-semibold">
                          {initialsOf(r.name)}
                        </div>
                        <span className="text-xs font-medium text-white">
                          {r.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.department}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.branch}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.date}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.loginTime ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.logoutTime ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-white">
                      {r.hoursWorked ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.breakTime ? (
                        <span className="text-white font-medium">
                          {r.breakTime}
                          {r.breakCount > 0 && (
                            <span className="text-[#5a5a5a] ml-1">
                              ({r.breakCount})
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ring-1 ${
                          r.status === "Present"
                            ? "text-green-400 bg-green-500/10 ring-green-500/20"
                            : r.status === "Half Day"
                            ? "text-yellow-400 bg-yellow-500/10 ring-yellow-500/20"
                            : "text-red-400 bg-red-500/10 ring-red-500/20"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setAdminDetail(r)}
                        className="p-1 hover:bg-white/8 rounded transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="h-3.5 w-3.5 text-brand" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={rowsPg.page}
          totalPages={rowsPg.totalPages}
          total={rowsPg.total}
          start={rowsPg.start}
          end={rowsPg.end}
          loading={rowsPg.transitioning}
          onPrev={rowsPg.goPrev}
          onNext={rowsPg.goNext}
        />
        </>
        )}
      </div>

      {adminDetail && (
        <AdminAttendanceDetailsModal
          row={adminDetail}
          onClose={() => setAdminDetail(null)}
        />
      )}
    </div>
  );
}

function AdminAttendanceDetailsModal({
  row,
  onClose,
}: {
  row: AdminRow;
  onClose: () => void;
}) {
  const prettyDate = new Date(row.date + "T00:00:00").toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  type TimelineEvent = {
    kind: "in" | "out" | "break-start" | "break-end";
    time: string;
    iso: string;
  };
  const events: TimelineEvent[] = [];
  row.dayEntries.forEach((e) => {
    events.push({
      kind: "in",
      time: fmtTime(e.clockInTime),
      iso: e.clockInTime,
    });
    if (e.clockOutTime) {
      events.push({
        kind: "out",
        time: fmtTime(e.clockOutTime),
        iso: e.clockOutTime,
      });
    }
  });
  row.dayBreaks.forEach((b) => {
    events.push({
      kind: "break-start",
      time: fmtTime(b.breakStartTime),
      iso: b.breakStartTime,
    });
    if (b.breakStopTime) {
      events.push({
        kind: "break-end",
        time: fmtTime(b.breakStopTime),
        iso: b.breakStopTime,
      });
    }
  });
  events.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());

  const statusTint =
    row.status === "Present"
      ? "text-green-400 bg-green-500/10 ring-green-500/20"
      : row.status === "Half Day"
      ? "text-yellow-400 bg-yellow-500/10 ring-yellow-500/20"
      : "text-red-400 bg-red-500/10 ring-red-500/20";

  const eventMeta: Record<
    TimelineEvent["kind"],
    { label: string; icon: React.ReactNode; bg: string; line: string }
  > = {
    in: {
      label: "Clocked In",
      icon: <LogIn className="h-3.5 w-3.5 text-green-400" />,
      bg: "bg-green-500/10 ring-green-500/20",
      line: "bg-green-500/30",
    },
    out: {
      label: "Clocked Out",
      icon: <LogOut className="h-3.5 w-3.5 text-red-400" />,
      bg: "bg-red-500/10 ring-red-500/20",
      line: "bg-red-500/30",
    },
    "break-start": {
      label: "Break Started",
      icon: <Coffee className="h-3.5 w-3.5 text-orange-400" />,
      bg: "bg-orange-500/10 ring-orange-500/20",
      line: "bg-orange-500/30",
    },
    "break-end": {
      label: "Break Ended",
      icon: <Clock className="h-3.5 w-3.5 text-blue-400" />,
      bg: "bg-blue-500/10 ring-blue-500/20",
      line: "bg-blue-500/30",
    },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#050505] rounded-xl border border-white/8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 sticky top-0 bg-[#050505] z-10">
          <div>
            <h2 className="text-base font-semibold text-white">
              Attendance Details
            </h2>
            <p className="text-xs text-[#7a7a7a] mt-0.5">{prettyDate}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/8 rounded transition-colors cursor-pointer"
          >
            <X className="h-5 w-5 text-[#a8a8a8]" />
          </button>
        </div>

        <div className="p-6">
          {/* User chip */}
          <div className="mb-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-orange-400 flex items-center justify-center text-brand-foreground text-base font-semibold">
              {initialsOf(row.name)}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {row.name}
              </h3>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-md text-xs font-medium mt-1 ring-1 ${statusTint}`}
              >
                {row.status}
              </span>
            </div>
          </div>

          {/* Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <DetailTile label="Login Time" value={row.loginTime ?? "—"} />
            <DetailTile label="Logout Time" value={row.logoutTime ?? "—"} />
            <DetailTile label="Total Hours" value={row.hoursWorked ?? "—"} />
          </div>

          {/* Timeline or empty state */}
          {events.length === 0 ? (
            <div className="bg-[#0e0e12] border border-white/8 rounded-lg p-8 text-center">
              <Clock className="h-10 w-10 text-[#5a5a5a] mx-auto mb-2" />
              <p className="text-xs text-[#a8a8a8]">
                {row.status === "Absent"
                  ? "No attendance data available for this day"
                  : "No activity recorded"}
              </p>
            </div>
          ) : (
            <div className="bg-[#0e0e12] border border-white/8 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-white mb-3">
                Activity Timeline
              </h4>
              <div className="relative">
                {events.map((ev, i) => {
                  const m = eventMeta[ev.kind];
                  const isLast = i === events.length - 1;
                  return (
                    <div key={i} className="relative flex items-start gap-3 pb-3 last:pb-0">
                      {!isLast && (
                        <div className={`absolute left-[13px] top-7 bottom-0 w-px ${m.line}`} />
                      )}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ring-1 shrink-0 ${m.bg}`}>
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white">
                          {m.label}
                        </p>
                        <p className="text-[11px] text-[#7a7a7a] mt-0.5">
                          {ev.time}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {row.breakSeconds > 0 && (
                <div className="mt-3 pt-3 border-t border-white/8 flex items-center justify-between">
                  <span className="text-xs text-[#a8a8a8]">
                    Total Break Duration
                  </span>
                  <span className="text-xs font-medium text-white">
                    {fmtDuration(row.breakSeconds)}
                    {row.breakCount > 0 && (
                      <span className="text-[#5a5a5a] ml-1">
                        ({row.breakCount})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/8 bg-[#050505]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#0e0e12] border border-white/8 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

function usePagination<T>(data: T[], pageSize: number = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  // Clamp page synchronously to avoid empty-slice flicker
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const pageItems = useMemo(
    () => data.slice((safePage - 1) * pageSize, safePage * pageSize),
    [data, safePage, pageSize]
  );

  const go = useCallback(
    (next: number) => {
      const target = Math.min(Math.max(1, next), totalPages);
      if (target === safePage) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setTransitioning(true);
      timerRef.current = setTimeout(() => {
        setPage(target);
        setTransitioning(false);
        timerRef.current = null;
      }, 250);
    },
    [safePage, totalPages]
  );

  return {
    page: safePage,
    totalPages,
    pageItems,
    transitioning,
    goNext: () => go(safePage + 1),
    goPrev: () => go(safePage - 1),
    total: data.length,
    start: data.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    end: Math.min(safePage * pageSize, data.length),
  };
}

function Pagination({
  page,
  totalPages,
  total,
  start,
  end,
  loading,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/8">
      <span className="text-xs text-[#7a7a7a]">
        Showing <span className="text-white font-medium">{start}</span>–
        <span className="text-white font-medium">{end}</span> of{" "}
        <span className="text-white font-medium">{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={page <= 1 || loading}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#a8a8a8] bg-[#0e0e12] border border-white/8 rounded-md hover:text-white hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </button>
        <span className="text-xs text-[#7a7a7a] px-1">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={onNext}
          disabled={page >= totalPages || loading}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#a8a8a8] bg-[#0e0e12] border border-white/8 rounded-md hover:text-white hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
