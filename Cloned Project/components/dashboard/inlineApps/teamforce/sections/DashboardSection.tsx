"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Loader2,
  LayoutGrid,
  Landmark,
  Calendar,
  Settings,
  Plus,
  CheckSquare,
  Clock,
  FileText,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  LogIn,
  LogOut,
  Coffee,
  Briefcase,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { getUserIdFromToken } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  listEmployees,
  listDepartments,
  listBranches,
  getEmployee,
  createDepartment,
  listOrgLeaveRequests,
  listTeamLeaveRequests,
  listMyLeaveRequests,
  listLeavePolicies,
  approveLeaveRequest,
  rejectLeaveRequest,
  listRecruitmentRequests,
  updateRecruitmentRequest,
  type LeaveRequest,
} from "../api";
import type {
  Section,
  EmployeeListItem,
  Department,
  Branch,
  RecruitmentRequest,
} from "../types";

// ─────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────

type AdminEntry = {
  _id: string;
  userId: { _id: string; name?: string; email?: string } | string;
  clockInTime: string;
  clockOutTime: string | null;
  durationInSeconds?: number;
};
type AdminBreak = {
  _id: string;
  userId: { _id: string; name?: string; email?: string } | string;
  breakStartTime: string;
  breakStopTime: string | null;
};

// Department slice palette. Grey is deliberately absent — it's reserved for
// the "Unassigned" bucket below so that bucket always reads as "no data"
// rather than as just another department.
const PIE_COLORS = [
  "#fbd10d",
  "#8b5cf6",
  "#ec4899",
  "#3b82f6",
  "#10b981",
  "#06b6d4",
  "#6366f1",
  "#14b8a6",
  "#f43f5e",
  "#f97316",
  "#a855f7",
  "#84cc16",
  "#0ea5e9",
  "#e11d48",
  "#22c55e",
  "#d946ef",
];

const UNASSIGNED_LABEL = "Unassigned";
const UNASSIGNED_COLOR = "#6b7280";

/** Mix a hex colour toward white (t > 0) or black (t < 0) by ratio |t|. */
function shadeHex(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) =>
    Math.round(t >= 0 ? c + (255 - c) * t : c * (1 + t));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => mix(c).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Colour for the nth department in stable order. Past the end of the palette
 *  hues are reused at a different lightness rather than repeated exactly, so
 *  department 17 stays distinguishable from department 1. */
function paletteColor(index: number): string {
  const base = PIE_COLORS[index % PIE_COLORS.length];
  const pass = Math.floor(index / PIE_COLORS.length);
  if (pass === 0) return base;
  return shadeHex(base, pass % 2 === 1 ? 0.35 : -0.35);
}

const PAGE_SIZE = 8;
const APPROVALS_PAGE_SIZE = 15;

const LEAVE_TYPE_PILL: Record<
  string,
  { label: string; className: string }
> = {
  "Sick Leave": {
    label: "SL",
    className: "bg-[#FECACA] text-[#991B1B]",
  },
  "Casual Leave": {
    label: "PL",
    className: "bg-[#BFDBFE] text-[#1E40AF]",
  },
  "Earned Leave": {
    label: "EL",
    className: "bg-[#E9D5FF] text-[#6B21A8]",
  },
  "Official Duty": {
    label: "Official Duty",
    className: "bg-[#A7F3D0] text-[#065F46]",
  },
};

function fmtApprovalDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function leaveDayCount(start: string, end: string, isHalfDay?: boolean) {
  if (isHalfDay) return 0.5;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "—";
  const ms = e.setHours(0, 0, 0, 0) - s.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

function ApprovalAvatar({ name }: { name: string }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full bg-[#93C5FD]/30 text-[#93C5FD] flex items-center justify-center text-xs font-semibold shrink-0">
      {initial}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
function uid(
  u: AdminEntry["userId"] | AdminBreak["userId"] | null | undefined,
): string {
  if (!u) return "";
  return typeof u === "string" ? u : u._id;
}

// ─────────────────────────────────────────────────────────────────────
// Top-level: role gate
// ─────────────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (section: Section) => void;
}

export default function DashboardSection({ onNavigate }: Props) {
  const { amIFounder, loading: founderLoading } = useAmIFounder();
  const [role, setRole] = useState<
    "founder" | "admin" | "manager" | "employee" | null
  >(null);

  useEffect(() => {
    if (founderLoading) return;
    if (amIFounder) {
      setRole("founder");
      return;
    }
    const myUserId = getUserIdFromToken();
    if (!myUserId) {
      setRole("employee");
      return;
    }
    getEmployee(myUserId)
      .then((data) => {
        if (data.teamforceRole === "admin") setRole("admin");
        else if (data.profile?.managesTeam) setRole("manager");
        else setRole("employee");
      })
      .catch(() => setRole("employee"));
  }, [amIFounder, founderLoading]);

  if (role === null) return <CenterLoader />;
  if (role === "employee") return <EmployeeDashboard />;
  if (role === "manager") return <ManagerDashboard />;
  return <AdminFounderDashboard onNavigate={onNavigate} />;
}

function CenterLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-brand" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Employee dashboard — "Your Workday"
// ─────────────────────────────────────────────────────────────────────

function EmployeeDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myEntries, setMyEntries] = useState<MyTimeEntry[]>([]);
  const [myBreaks, setMyBreaks] = useState<MyBreakLog[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [totalQuota, setTotalQuota] = useState(0);
  const [clockBusy, setClockBusy] = useState(false);
  const [breakBusy, setBreakBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const orgId =
        typeof window !== "undefined"
          ? localStorage.getItem("garage_org_id")
          : null;

      const myEntriesPromise: Promise<{ history: MyTimeEntry[] }> = orgId
        ? api<{ success: boolean; history: MyTimeEntry[] }>(
            `/betty/time-tracking?orgId=${orgId}`,
          ).catch(() => ({ history: [] }))
        : Promise.resolve({ history: [] });

      const myBreaksPromise: Promise<{ logs: MyBreakLog[] }> = orgId
        ? api<{ success: boolean; logs: MyBreakLog[] }>(
            `/betty/break-logs?orgId=${orgId}`,
          ).catch(() => ({ logs: [] }))
        : Promise.resolve({ logs: [] });

      const [entRes, brkRes, leavesRes, policiesRes] = await Promise.all([
        myEntriesPromise,
        myBreaksPromise,
        listMyLeaveRequests().catch(() => ({
          leaves: [] as LeaveRequest[],
        })),
        listLeavePolicies().catch(() => ({ policies: [] })),
      ]);

      setMyEntries(entRes.history || []);
      setMyBreaks(brkRes.logs || []);
      setMyLeaves(leavesRes.leaves || []);
      setTotalQuota(
        (policiesRes.policies || [])
          .filter((p) => p.isActive)
          .reduce((sum, p) => sum + (p.annualQuota || 0), 0),
      );
    } catch (err) {
      console.error("Employee dashboard load failed", err);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll, refreshKey]);

  const isClockedIn = myEntries.some((e) => !e.clockOutTime);
  const isOnBreak = myBreaks.some((b) => !b.breakStopTime);

  // Stats ──────────────────────────────────────────────────────────
  const todayKey = fmtDate(new Date().toISOString());
  const todaySec = useMemo(() => {
    return myEntries
      .filter((e) => fmtDate(e.clockInTime) === todayKey)
      .reduce((sum, e) => {
        if (e.clockOutTime) {
          return (
            sum +
            (new Date(e.clockOutTime).getTime() -
              new Date(e.clockInTime).getTime()) /
              1000
          );
        }
        return sum + (Date.now() - new Date(e.clockInTime).getTime()) / 1000;
      }, 0);
  }, [myEntries, todayKey]);

  const approvedLeaves = useMemo(
    () => myLeaves.filter((l) => l.status === "Approved"),
    [myLeaves],
  );
  const leavesTaken = useMemo(
    () => approvedLeaves.reduce((sum, l) => sum + leaveDays(l), 0),
    [approvedLeaves],
  );
  const upcomingHolidays = useMemo(() => {
    const todayMs = new Date(todayKey + "T00:00:00").getTime();
    return approvedLeaves.filter(
      (l) => new Date(l.startDate).getTime() >= todayMs,
    ).length;
  }, [approvedLeaves, todayKey]);

  // Daily Attendance rows — last 14 days; merge with approved leaves.
  const attRows = useMemo(() => {
    type Row = {
      date: string;
      loginTime: string | null;
      hoursWorked: string;
      status: "Present" | "On Leave" | "Absent";
    };
    const rows: Row[] = [];
    const entriesByDate = new Map<string, MyTimeEntry[]>();
    for (const e of myEntries) {
      const k = fmtDate(e.clockInTime);
      if (!entriesByDate.has(k)) entriesByDate.set(k, []);
      entriesByDate.get(k)!.push(e);
    }
    // Build set of dates covered by approved leaves
    const leaveDates = new Set<string>();
    for (const l of approvedLeaves) {
      const s = new Date(l.startDate);
      const e = new Date(l.endDate);
      for (
        let d = new Date(s);
        d.getTime() <= e.getTime();
        d.setDate(d.getDate() + 1)
      ) {
        leaveDates.add(fmtDate(d.toISOString()));
      }
    }

    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = fmtDate(d.toISOString());
      const list = entriesByDate.get(k) || [];
      const sorted = [...list].sort(
        (a, b) =>
          new Date(a.clockInTime).getTime() - new Date(b.clockInTime).getTime(),
      );
      const sec = sorted.reduce((sum, e) => {
        if (e.clockOutTime) {
          return (
            sum +
            (new Date(e.clockOutTime).getTime() -
              new Date(e.clockInTime).getTime()) /
              1000
          );
        }
        return sum + (Date.now() - new Date(e.clockInTime).getTime()) / 1000;
      }, 0);
      const hasEntry = sorted.length > 0;
      const onLeave = leaveDates.has(k);
      const status: Row["status"] = hasEntry
        ? "Present"
        : onLeave
          ? "On Leave"
          : "Absent";
      rows.push({
        date: k,
        loginTime: sorted[0]?.clockInTime
          ? fmtTime(sorted[0].clockInTime)
          : null,
        hoursWorked: sec > 0 ? `${(sec / 3600).toFixed(1)}h` : "0h",
        status,
      });
    }
    return rows;
  }, [myEntries, approvedLeaves]);
  const attPg = usePagination(attRows, 7);

  // Action handlers
  async function clockAction(action: "in" | "out") {
    if (clockBusy) return;
    const orgId =
      typeof window !== "undefined"
        ? localStorage.getItem("garage_org_id")
        : null;
    if (!orgId) {
      toast.error("No organization selected");
      return;
    }
    setClockBusy(true);
    try {
      await api(
        `/betty/clock-${action === "in" ? "in" : "out"}?orgId=${orgId}`,
        { method: "POST" },
      );
      toast.success(action === "in" ? "Clocked in" : "Clocked out");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message || "Clock action failed";
      toast.error(parseErr(msg));
    } finally {
      setClockBusy(false);
    }
  }
  async function breakToggle() {
    if (breakBusy) return;
    if (!isClockedIn) {
      toast.error("Clock in first to take a break");
      return;
    }
    const orgId =
      typeof window !== "undefined"
        ? localStorage.getItem("garage_org_id")
        : null;
    if (!orgId) {
      toast.error("No organization selected");
      return;
    }
    setBreakBusy(true);
    try {
      const ep = isOnBreak ? "break-stop" : "break-start";
      await api(`/betty/${ep}?orgId=${orgId}`, { method: "POST" });
      toast.success(isOnBreak ? "Break ended" : "Break started");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message || "Break action failed";
      toast.error(parseErr(msg));
    } finally {
      setBreakBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Your Workday
        </h2>
        <p className="text-sm text-[#7a7a7a] mt-1">
          {new Date().toLocaleDateString([], {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard tone="indigo" value={totalQuota} label="Total Leaves" />
        <StatCard tone="pink" value={leavesTaken} label="Leaves Taken" />
        <StatCard
          tone="teal"
          value={upcomingHolidays}
          label="Upcoming Holidays"
        />
        <StatCard
          tone="cyan"
          value={todaySec > 0 ? `${(todaySec / 3600).toFixed(1)}h` : "0h"}
          label="Hours Worked Today"
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-3">
        <QuickBtn
          icon={
            clockBusy && !isClockedIn ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )
          }
          label="Clock In"
          disabled={isClockedIn || clockBusy}
          onClick={() => clockAction("in")}
        />
        <QuickBtn
          icon={
            clockBusy && isClockedIn ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )
          }
          label="Clock Out"
          disabled={!isClockedIn || clockBusy}
          onClick={() => clockAction("out")}
        />
        <QuickBtn
          icon={
            breakBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Coffee className="h-4 w-4" />
            )
          }
          label={isOnBreak ? "Stop Break" : "Take Break"}
          disabled={!isClockedIn || breakBusy}
          onClick={breakToggle}
        />
        <QuickBtn
          icon={<Briefcase className="h-4 w-4" />}
          label="Mark Official Duty"
          onClick={() => toast.info("Official Duty — coming soon")}
        />
      </div>

      {/* Daily Attendance */}
      <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8">
          <h3 className="text-sm font-semibold text-white">
            Your Daily Attendance
          </h3>
          <p className="text-xs text-[#7a7a7a] mt-0.5">Last 14 days</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {["Date", "Login Time", "Hours Worked", "Attendance"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-[#7a7a7a] px-4 py-2.5"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-brand inline-block" />
                  </td>
                </tr>
              ) : (
                attPg.pageItems.map((r) => (
                  <tr
                    key={r.date}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0"
                  >
                    <td className="px-4 py-2.5 text-xs text-white">
                      {new Date(r.date + "T00:00:00").toLocaleDateString([], {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.loginTime ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                      {r.hoursWorked}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          r.status === "Present"
                            ? "text-green-400 bg-green-500/10 ring-1 ring-green-500/20"
                            : r.status === "On Leave"
                              ? "text-orange-300 bg-orange-500/10 ring-1 ring-orange-500/20"
                              : "text-[#a8a8a8] bg-white/5 ring-1 ring-white/10"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination pg={attPg} />
      </div>
    </div>
  );
}

function leaveDays(l: LeaveRequest): number {
  const start = new Date(l.startDate);
  const end = new Date(l.endDate);
  const ms = end.getTime() - start.getTime();
  const days = Math.max(1, Math.round(ms / 86_400_000) + 1);
  if (l.isHalfDay && days === 1) return 0.5;
  return days;
}

// ─────────────────────────────────────────────────────────────────────
// Manager dashboard
// ─────────────────────────────────────────────────────────────────────

type MyTimeEntry = {
  _id: string;
  clockInTime: string;
  clockOutTime: string | null;
};
type MyBreakLog = {
  _id: string;
  breakStartTime: string;
  breakStopTime: string | null;
};

function ManagerDashboard() {
  const [view, setView] = useState<"dashboard" | "approvals">("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  // Team data
  const [team, setTeam] = useState<EmployeeListItem[]>([]);
  const [myName, setMyName] = useState<string>("");
  const [entries, setEntries] = useState<AdminEntry[]>([]);
  const [breaks, setBreaks] = useState<AdminBreak[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [pendingReqs, setPendingReqs] = useState<RecruitmentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Personal clock state
  const [myEntries, setMyEntries] = useState<MyTimeEntry[]>([]);
  const [myBreaks, setMyBreaks] = useState<MyBreakLog[]>([]);
  const [clockBusy, setClockBusy] = useState(false);
  const [breakBusy, setBreakBusy] = useState(false);

  const myUserId = useMemo(() => getUserIdFromToken(), []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const orgId =
        typeof window !== "undefined"
          ? localStorage.getItem("garage_org_id")
          : null;
      const start = new Date();
      start.setDate(start.getDate() - 42);
      const end = new Date();
      const startIso = new Date(
        fmtDate(start.toISOString()) + "T00:00:00",
      ).toISOString();
      const endIso = new Date(
        fmtDate(end.toISOString()) + "T23:59:59",
      ).toISOString();

      const teamAttPromise: Promise<{
        entries: AdminEntry[];
        breakLogs: AdminBreak[];
      }> = orgId
        ? api<{
            success: boolean;
            entries: AdminEntry[];
            breakLogs: AdminBreak[];
          }>(
            `/betty/manager-team-attendance?orgId=${orgId}&start=${encodeURIComponent(
              startIso,
            )}&end=${encodeURIComponent(endIso)}`,
          ).catch(() => ({ entries: [], breakLogs: [] }))
        : Promise.resolve({ entries: [], breakLogs: [] });

      const myEntriesPromise: Promise<{ history: MyTimeEntry[] }> = orgId
        ? api<{ success: boolean; history: MyTimeEntry[] }>(
            `/betty/time-tracking?orgId=${orgId}`,
          ).catch(() => ({ history: [] }))
        : Promise.resolve({ history: [] });

      const myBreaksPromise: Promise<{ logs: MyBreakLog[] }> = orgId
        ? api<{ success: boolean; logs: MyBreakLog[] }>(
            `/betty/break-logs?orgId=${orgId}`,
          ).catch(() => ({ logs: [] }))
        : Promise.resolve({ logs: [] });

      const [empRes, teamAttRes, leavesRes, reqsRes, myEntRes, myBrkRes] =
        await Promise.all([
          listEmployees(),
          teamAttPromise,
          listTeamLeaveRequests("Pending").catch(() => ({
            leaves: [] as LeaveRequest[],
          })),
          listRecruitmentRequests({
            status: "approval_pending",
            pageSize: 100,
          }).catch(() => ({ requests: [] as RecruitmentRequest[] })),
          myEntriesPromise,
          myBreaksPromise,
        ]);

      const allEmps = empRes.employees || [];
      const me = allEmps.find((e) => e.userId === myUserId);
      const myNameVal = me?.name || "";
      setMyName(myNameVal);

      // Direct reports — employees whose reportingManagerId is me.
      const directReports = allEmps.filter((e) => {
        const mgr = e.profile?.reportingManagerId;
        const mgrId = typeof mgr === "string" ? mgr : mgr?._id;
        return mgrId === myUserId;
      });
      setTeam(directReports);

      setEntries(teamAttRes.entries || []);
      setBreaks(teamAttRes.breakLogs || []);
      setPendingLeaves(leavesRes.leaves || []);

      // Recruitment: only those where the manager is named as an approver.
      // Empty list = open to anyone, so excluded from the manager bucket.
      const allReqs = reqsRes.requests || [];
      const myReqs = allReqs.filter((r) => {
        const list = [
          ...(r.approvers || []),
          ...(r.approver ? [r.approver] : []),
        ].filter(Boolean);
        return list.length > 0 && !!myNameVal && list.includes(myNameVal);
      });
      setPendingReqs(myReqs);

      setMyEntries(myEntRes.history || []);
      setMyBreaks(myBrkRes.logs || []);
    } catch (err) {
      console.error("Manager dashboard load failed", err);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [myUserId]);

  useEffect(() => {
    loadAll();
  }, [loadAll, refreshKey]);

  // Personal state
  const isClockedIn = myEntries.some((e) => !e.clockOutTime);
  const isOnBreak = myBreaks.some((b) => !b.breakStopTime);

  // Team-scoped derived
  const today = fmtDate(new Date().toISOString());
  const todayEntries = useMemo(
    () => entries.filter((e) => fmtDate(e.clockInTime) === today),
    [entries, today],
  );
  const activeBreakUserIds = useMemo(
    () =>
      new Set(breaks.filter((b) => !b.breakStopTime).map((b) => uid(b.userId))),
    [breaks],
  );
  const todayLoggedInIds = useMemo(
    () => new Set(todayEntries.map((e) => uid(e.userId))),
    [todayEntries],
  );
  const attendancePct =
    team.length > 0 ? (todayLoggedInIds.size / team.length) * 100 : 0;
  const pendingApprovals = pendingLeaves.length + pendingReqs.length;

  async function clockAction(action: "in" | "out") {
    if (clockBusy) return;
    const orgId =
      typeof window !== "undefined"
        ? localStorage.getItem("garage_org_id")
        : null;
    if (!orgId) {
      toast.error("No organization selected");
      return;
    }
    setClockBusy(true);
    try {
      await api(
        `/betty/clock-${action === "in" ? "in" : "out"}?orgId=${orgId}`,
        { method: "POST" },
      );
      toast.success(action === "in" ? "Clocked in" : "Clocked out");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message || "Clock action failed";
      toast.error(parseErr(msg));
    } finally {
      setClockBusy(false);
    }
  }

  async function breakToggle() {
    if (breakBusy) return;
    if (!isClockedIn) {
      toast.error("Clock in first to take a break");
      return;
    }
    const orgId =
      typeof window !== "undefined"
        ? localStorage.getItem("garage_org_id")
        : null;
    if (!orgId) {
      toast.error("No organization selected");
      return;
    }
    setBreakBusy(true);
    try {
      const ep = isOnBreak ? "break-stop" : "break-start";
      await api(`/betty/${ep}?orgId=${orgId}`, { method: "POST" });
      toast.success(isOnBreak ? "Break ended" : "Break started");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message || "Break action failed";
      toast.error(parseErr(msg));
    } finally {
      setBreakBusy(false);
    }
  }

  if (view === "approvals") {
    return (
      <ApprovalsView
        leaves={pendingLeaves}
        requests={pendingReqs}
        onBack={() => setView("dashboard")}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Your Team Overview
        </h2>
        <p className="text-sm text-[#7a7a7a] mt-1">
          {new Date().toLocaleDateString([], {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Stat cards (2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          tone="green"
          value={`${attendancePct.toFixed(1)}%`}
          label="Attendance %"
        />
        <StatCard
          tone="orange"
          value={pendingApprovals}
          label="Pending Approvals"
        />
      </div>

      {/* Quick actions (5) */}
      <div className="flex flex-wrap items-center gap-3">
        <QuickBtn
          icon={<CheckSquare className="h-4 w-4" />}
          label={
            pendingApprovals > 0
              ? `Approvals (${pendingApprovals})`
              : "Approvals"
          }
          onClick={() => setView("approvals")}
        />
        <QuickBtn
          icon={
            clockBusy && !isClockedIn ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )
          }
          label="Clock In"
          disabled={isClockedIn || clockBusy}
          onClick={() => clockAction("in")}
        />
        <QuickBtn
          icon={
            clockBusy && isClockedIn ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )
          }
          label="Clock Out"
          disabled={!isClockedIn || clockBusy}
          onClick={() => clockAction("out")}
        />
        <QuickBtn
          icon={
            breakBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Coffee className="h-4 w-4" />
            )
          }
          label={isOnBreak ? "Stop Break" : "Take Break"}
          disabled={!isClockedIn || breakBusy}
          onClick={breakToggle}
        />
        <QuickBtn
          icon={<Briefcase className="h-4 w-4" />}
          label="Mark Official Duty"
          onClick={() => toast.info("Official Duty — coming soon")}
        />
      </div>

      {loading ? (
        <CenterLoader />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <EmployeeActivityCard
              title="Your Team Activity"
              subtitle="Today's check-ins and current status"
              employees={team}
              todayEntries={todayEntries}
              activeBreakUserIds={activeBreakUserIds}
            />
            <AttendanceTrendCard
              title="Team Attendance Trend"
              entries={entries}
              employees={team}
            />
          </div>
          <div className="space-y-6">
            <AlertsCard
              title="Team Alerts"
              leaves={pendingLeaves}
              requests={pendingReqs}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Admin / founder dashboard
// ─────────────────────────────────────────────────────────────────────

function AdminFounderDashboard({
  onNavigate,
}: {
  onNavigate: (s: Section) => void;
}) {
  const [view, setView] = useState<"dashboard" | "approvals">("dashboard");
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [entries, setEntries] = useState<AdminEntry[]>([]);
  const [breaks, setBreaks] = useState<AdminBreak[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [pendingReqs, setPendingReqs] = useState<RecruitmentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const orgId =
        typeof window !== "undefined"
          ? localStorage.getItem("garage_org_id")
          : null;
      const start = new Date();
      start.setDate(start.getDate() - 42);
      const end = new Date();
      const startIso = new Date(
        fmtDate(start.toISOString()) + "T00:00:00",
      ).toISOString();
      const endIso = new Date(
        fmtDate(end.toISOString()) + "T23:59:59",
      ).toISOString();

      const attendancePromise: Promise<{
        success?: boolean;
        entries: AdminEntry[];
        breakLogs: AdminBreak[];
      }> = orgId
        ? api<{
            success: boolean;
            entries: AdminEntry[];
            breakLogs: AdminBreak[];
          }>(
            `/betty/admin-org-attendance?orgId=${orgId}&start=${encodeURIComponent(
              startIso,
            )}&end=${encodeURIComponent(endIso)}`,
          ).catch(() => ({ entries: [], breakLogs: [] }))
        : Promise.resolve({ entries: [], breakLogs: [] });

      const [empRes, deptRes, brRes, attRes, leavesRes, reqsRes] =
        await Promise.all([
          listEmployees(),
          listDepartments(),
          listBranches(),
          attendancePromise,
          listOrgLeaveRequests("Pending").catch(() => ({
            leaves: [] as LeaveRequest[],
          })),
          listRecruitmentRequests({
            status: "approval_pending",
            pageSize: 100,
          }).catch(() => ({
            requests: [] as RecruitmentRequest[],
          })),
        ]);

      setEmployees(empRes.employees || []);
      setDepartments(deptRes.departments || []);
      setBranches(brRes.branches || []);
      setEntries(attRes.entries || []);
      setBreaks(attRes.breakLogs || []);
      setPendingLeaves(leavesRes.leaves || []);
      setPendingReqs(reqsRes.requests || []);
    } catch (err) {
      console.error("Dashboard load failed", err);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll, refreshKey]);

  const today = fmtDate(new Date().toISOString());
  const todayEntries = useMemo(
    () => entries.filter((e) => fmtDate(e.clockInTime) === today),
    [entries, today],
  );
  const activeBreakUserIds = useMemo(
    () =>
      new Set(breaks.filter((b) => !b.breakStopTime).map((b) => uid(b.userId))),
    [breaks],
  );
  const todayLoggedInUserIds = useMemo(
    () => new Set(todayEntries.map((e) => uid(e.userId))),
    [todayEntries],
  );
  const attendancePct =
    employees.length > 0
      ? (todayLoggedInUserIds.size / employees.length) * 100
      : 0;
  const pendingApprovals = pendingLeaves.length + pendingReqs.length;

  if (view === "approvals") {
    return (
      <ApprovalsView
        leaves={pendingLeaves}
        requests={pendingReqs}
        onBack={() => setView("dashboard")}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {/* <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Organization Overview
          </h2>
          <p className="text-sm text-[#7a7a7a] mt-1">
            {new Date().toLocaleDateString([], {
              weekday: "long",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div> */}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          tone="blue"
          icon={<LayoutGrid className="h-4 w-4" />}
          value={employees.length}
          label="Total Employees"
          action={{
            label: "Add Employee",
            icon: <Plus className="h-3.5 w-3.5" />,
            onClick: () => onNavigate("add-employee"),
          }}
        />
        <StatCard
          tone="purple"
          icon={<Landmark className="h-4 w-4" />}
          value={departments.length}
          label="Total Departments"
          action={{
            label: "Add Depart.",
            icon: <Plus className="h-3.5 w-3.5" />,
            onClick: () => setShowDeptModal(true),
          }}
        />
        <StatCard
          tone="green"
          icon={<Calendar className="h-4 w-4" />}
          value={`${attendancePct.toFixed(1)}%`}
          label="Attendance %"
        />
        <StatCard
          tone="orange"
          icon={<Settings className="h-4 w-4" />}
          value={pendingApprovals}
          label="Pending Approvals"
          action={{
            label: "View Approvals",
            onClick: () => setView("approvals"),
          }}
        />
      </div>

      {loading ? (
        <CenterLoader />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <div className="space-y-6">
            <DeptDistributionCard
              employees={employees}
              departments={departments}
              branches={branches}
            />
          </div>
          <div className="xl:col-span-2 space-y-6">
            <EmployeeActivityCard
              employees={employees}
              todayEntries={todayEntries}
              activeBreakUserIds={activeBreakUserIds}
            />
          </div>
        </div>
      )}

      {showDeptModal && (
        <AddDepartmentModal
          onClose={() => setShowDeptModal(false)}
          onCreated={() => {
            setShowDeptModal(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Stat card / quick action
// ─────────────────────────────────────────────────────────────────────

const TONE_BG: Record<string, string> = {
  blue: "bg-blue-500/10 ring-blue-500/20",
  purple: "bg-purple-500/10 ring-purple-500/20",
  green: "bg-green-500/10 ring-green-500/20",
  orange: "bg-orange-500/10 ring-orange-500/20",
  indigo: "bg-indigo-500/10 ring-indigo-500/20",
  pink: "bg-pink-500/10 ring-pink-500/20",
  teal: "bg-teal-500/10 ring-teal-500/20",
  cyan: "bg-cyan-500/10 ring-cyan-500/20",
};
const TONE_TXT: Record<string, string> = {
  blue: "text-blue-300",
  purple: "text-purple-300",
  green: "text-green-300",
  orange: "text-orange-300",
  indigo: "text-indigo-300",
  pink: "text-pink-300",
  teal: "text-teal-300",
  cyan: "text-cyan-300",
};

type Tone =
  | "blue"
  | "purple"
  | "green"
  | "orange"
  | "indigo"
  | "pink"
  | "teal"
  | "cyan";

function StatCard({
  tone,
  icon,
  value,
  label,
  action,
}: {
  tone: Tone;
  icon?: ReactNode;
  value: number | string;
  label: string;
  action?: { label: string; icon?: ReactNode; onClick: () => void };
}) {
  // Flat/neutral card style — used by the org-overview stat row (icon + inline action).
  if (icon) {
    return (
      <div className="rounded-xl border border-white/8 bg-[#0c0c0c] p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[#a8a8a8]">{icon}</span>
          <span className="text-sm text-[#a8a8a8]">{label}</span>
        </div>
        <div className="flex items-center justify-between gap-3 bg-white/[0.06] rounded-lg px-4 py-3.5">
          <div className="text-3xl font-semibold text-white tabular-nums">
            {value}
          </div>
          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-black border border-white/10 hover:bg-[#151515] hover:border-white/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              {action.icon}
              {action.label}
            </button>
          )}
        </div>
      </div>
    );
  }
  // Legacy toned card — still used by Employee/Manager dashboards.
  return (
    <div
      className={`rounded-xl border-transparent border ring-1 p-4 ${TONE_BG[tone]}`}
    >
      <div className={`text-2xl font-semibold ${TONE_TXT[tone]} tabular-nums`}>
        {value}
      </div>
      <div className="text-xs text-[#a8a8a8] mt-1">{label}</div>
    </div>
  );
}

function QuickBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-[#050505] border border-white/8 hover:bg-white/5 hover:border-brand/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#050505] disabled:hover:border-white/8"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Employee Activity (today)
// ─────────────────────────────────────────────────────────────────────

type ActivityRow = {
  userId: string;
  name: string;
  department: string;
  status: "Present" | "On Break" | "Absent";
  checkIn: string | null;
  lastActive: string | null;
};

function EmployeeActivityCard({
  employees,
  todayEntries,
  activeBreakUserIds,
  title = "Employee Activity",
  subtitle = "Today's check-ins and current status",
}: {
  employees: EmployeeListItem[];
  todayEntries: AdminEntry[];
  activeBreakUserIds: Set<string>;
  title?: string;
  subtitle?: string;
}) {
  const rows: ActivityRow[] = useMemo(() => {
    const entriesByUid = new Map<string, AdminEntry[]>();
    for (const e of todayEntries) {
      const u = uid(e.userId);
      if (!entriesByUid.has(u)) entriesByUid.set(u, []);
      entriesByUid.get(u)!.push(e);
    }
    return employees
      .map((emp) => {
        const list = entriesByUid.get(emp.userId) || [];
        const onBreak = activeBreakUserIds.has(emp.userId);
        const dept =
          typeof emp.profile?.departmentId === "object"
            ? (emp.profile.departmentId as { name?: string }).name || "—"
            : "—";
        const status: ActivityRow["status"] = onBreak
          ? "On Break"
          : list.length > 0
            ? "Present"
            : "Absent";
        const sorted = [...list].sort(
          (a, b) =>
            new Date(a.clockInTime).getTime() -
            new Date(b.clockInTime).getTime(),
        );
        const checkIn = sorted[0]?.clockInTime
          ? fmtTime(sorted[0].clockInTime)
          : null;
        const lastEntry = sorted[sorted.length - 1];
        const lastIso =
          lastEntry?.clockOutTime || lastEntry?.clockInTime || null;
        return {
          userId: emp.userId,
          name: emp.name,
          department: dept,
          status,
          checkIn,
          lastActive: lastIso ? relTime(lastIso) : null,
        };
      })
      .sort((a, b) => {
        const order = (s: string) =>
          s === "Present" ? 0 : s === "On Break" ? 1 : 2;
        return order(a.status) - order(b.status);
      });
  }, [employees, todayEntries, activeBreakUserIds]);

  const pg = usePagination(rows, 12);

  return (
    <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden h-[540px] flex flex-col">
      <div className="overflow-auto flex-1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8 bg-white/[0.08]">
              {[
                "Employee Name",
                "Department",
                "Status",
                "Clock In Time",
                "Last Active",
              ].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs font-medium text-[#7a7a7a] px-4 py-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-xs text-[#a8a8a8]"
                >
                  No employees yet
                </td>
              </tr>
            ) : (
              pg.pageItems.map((r) => (
                <tr
                  key={r.userId}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[#c7c7c7] text-[10px] font-semibold">
                        {(r.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-white">
                        {r.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#a8a8a8]">
                    {r.department}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold text-white ${
                        r.status === "Present"
                          ? "bg-green-500"
                          : r.status === "On Break"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#a8a8a8]">
                    {r.checkIn ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#5a5a5a]">
                    {r.lastActive ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination pg={pg} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Searchable dropdown — trigger button + panel with search input and
// checkmarked options (same pattern as the Deals "Sales Funnel" picker).
// ─────────────────────────────────────────────────────────────────────

function SearchableDropdown({
  value,
  options,
  onChange,
  allLabel,
  searchPlaceholder,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  /** Label for the "all" option (value "all"), e.g. "All Branches". */
  allLabel: string;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const all = [{ value: "all", label: allLabel }, ...options];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? all.filter((o) => o.label.toLowerCase().includes(q))
    : all;
  const currentLabel = all.find((o) => o.value === value)?.label || allLabel;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setQuery("");
        }}
        className="flex items-center justify-between gap-2 text-xs px-3 py-1.5 bg-[#1c1c1e] border border-white/10 rounded-lg text-white hover:bg-[#26262a] transition-colors cursor-pointer min-w-[140px] max-w-[180px]"
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#a8a8a8] shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[220px] bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/8">
            <Search className="h-3.5 w-3.5 text-[#7a7a7a] shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs text-white placeholder:text-[#5a5a5a] outline-none"
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[#7a7a7a] text-center">
                No matches
              </p>
            ) : (
              filtered.map((o) => {
                const selected = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                      selected
                        ? "bg-[#2a2a2e] text-white"
                        : "text-[#d0d0d0] hover:bg-white/5"
                    }`}
                  >
                    <span className="w-3.5 shrink-0">
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="truncate">{o.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Department Distribution (pie)
// ─────────────────────────────────────────────────────────────────────

function DeptDistributionCard({
  employees,
  departments,
  branches,
}: {
  employees: EmployeeListItem[];
  departments: Department[];
  branches: Branch[];
}) {
  const [branchFilter, setBranchFilter] = useState<string>("all");

  // Stable colour per department: palette slots are handed out in _id order
  // (Mongo ObjectIds sort by creation time), NOT by headcount rank. A
  // department therefore keeps its colour when headcounts shift or the branch
  // filter changes, and newly created departments take the next free slot
  // instead of reshuffling everyone. Soft-deleted departments stop coming back
  // from listDepartments but employees can still reference them, so any such
  // orphan id is appended after the live ones rather than stealing a slot.
  const colorById = useMemo(() => {
    const live = departments.map((d) => d._id).sort();
    const known = new Set(live);
    const orphans = new Set<string>();
    for (const e of employees) {
      const dept = e.profile?.departmentId;
      if (dept && typeof dept === "object") {
        const id = (dept as { _id?: string })._id;
        if (id && !known.has(id)) orphans.add(id);
      }
    }
    const map = new Map<string, string>();
    [...live, ...Array.from(orphans).sort()].forEach((id, i) =>
      map.set(id, paletteColor(i)),
    );
    return map;
  }, [departments, employees]);

  const data = useMemo(() => {
    const filtered = employees.filter((e) => {
      if (branchFilter === "all") return true;
      const bId =
        typeof e.profile?.branchId === "object"
          ? (e.profile.branchId as { _id?: string })._id
          : e.profile?.branchId;
      return bId === branchFilter;
    });

    // Bucket by department _id, not name, so identity drives the colour
    // lookup and two departments sharing a name stay separate.
    const counts = new Map<string, { name: string; value: number }>();
    let unassigned = 0;
    for (const e of filtered) {
      // Anyone with no Teamforce profile, or a profile with no department
      // set, lands in a single "Unassigned" bucket. The null-check matters:
      // typeof null === "object", so a cleared departmentId would otherwise
      // throw on .name and take the whole card down.
      const dept = e.profile?.departmentId;
      const d =
        dept && typeof dept === "object"
          ? (dept as { _id?: string; name?: string })
          : null;
      if (d?._id && d.name) {
        const row = counts.get(d._id) || { name: d.name, value: 0 };
        row.value += 1;
        counts.set(d._id, row);
      } else {
        unassigned += 1;
      }
    }

    const rows = Array.from(counts.entries())
      .map(([id, r]) => ({
        key: id,
        name: r.name,
        value: r.value,
        color: colorById.get(id) || UNASSIGNED_COLOR,
      }))
      .sort((a, b) => b.value - a.value);

    // Unassigned is pinned last regardless of size — it's a data-hygiene
    // signal, not a department competing for the top of the legend.
    if (unassigned > 0)
      rows.push({
        key: UNASSIGNED_LABEL,
        name: UNASSIGNED_LABEL,
        value: unassigned,
        color: UNASSIGNED_COLOR,
      });
    return rows;
  }, [employees, branchFilter, colorById]);

  return (
    <div className="bg-[#050505] rounded-xl border border-white/8 p-5 h-[540px] flex flex-col">
      <div className="flex items-center justify-between mb-4 gap-2 shrink-0">
        <h3 className="text-sm font-semibold text-white shrink-0">
          Department Distribution
        </h3>
        <SearchableDropdown
          value={branchFilter}
          onChange={setBranchFilter}
          options={branches.map((b) => ({ value: b._id, label: b.name }))}
          allLabel="All Branches"
          searchPlaceholder="Search branches..."
        />
      </div>
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[#a8a8a8]">
          No data
        </div>
      ) : (
        <>
          <div className="w-full h-[300px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={115}
                  dataKey="value"
                  stroke="#0e0e0e"
                  strokeWidth={3}
                >
                  {data.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2.5 mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
            {data.map((d) => (
              <div key={d.key} className="flex items-center gap-2.5">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-sm text-[#c7c7c7] truncate">
                  {d.name}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Attendance Trend (last 6 weeks)
// ─────────────────────────────────────────────────────────────────────

function AttendanceTrendCard({
  entries,
  employees,
  title = "Attendance Trend",
}: {
  entries: AdminEntry[];
  employees: EmployeeListItem[];
  title?: string;
}) {
  const data = useMemo(() => {
    const now = new Date();
    const weeks: { name: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(now.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      const startMs = new Date(
        fmtDate(start.toISOString()) + "T00:00:00",
      ).getTime();
      const endMs =
        new Date(fmtDate(end.toISOString()) + "T23:59:59").getTime() + 1;
      const ids = new Set<string>();
      for (const e of entries) {
        const t = new Date(e.clockInTime).getTime();
        if (t >= startMs && t < endMs) ids.add(uid(e.userId));
      }
      const pct =
        employees.length > 0
          ? Math.round((ids.size / employees.length) * 100)
          : 0;
      weeks.push({ name: `Week ${6 - i}`, value: pct });
    }
    return weeks;
  }, [entries, employees]);

  return (
    <div className="bg-[#050505] rounded-xl border border-white/8 p-5">
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-[#7a7a7a] mb-4">Last 6 weeks</p>
      <div className="w-full h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#7a7a7a" }}
              stroke="#ffffff20"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#7a7a7a" }}
              stroke="#ffffff20"
            />
            <Tooltip
              contentStyle={{
                background: "#050505",
                border: "1px solid #ffffff14",
                borderRadius: 8,
                fontSize: 12,
                color: "#fff",
              }}
              formatter={(v: number) => [`${v}%`, "Attendance"]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4, fill: "#3b82f6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Alerts & Reminders
// ─────────────────────────────────────────────────────────────────────

type AlertItem = {
  id: string;
  type: "leave" | "recruitment";
  title: string;
  subtitle: string;
  createdAt: string;
};

function AlertsCard({
  leaves,
  requests,
  title = "Alerts & Reminders",
}: {
  leaves: LeaveRequest[];
  requests: RecruitmentRequest[];
  title?: string;
}) {
  const alerts: AlertItem[] = useMemo(() => {
    const items: AlertItem[] = [
      ...leaves.map((lv) => {
        const empName =
          typeof lv.userId === "object" ? lv.userId.name : "Someone";
        return {
          id: `l_${lv._id}`,
          type: "leave" as const,
          title: "Leave Request",
          subtitle: `${empName} — ${lv.leaveType}`,
          createdAt: lv.createdAt,
        };
      }),
      ...requests.map((r) => ({
        id: `r_${r._id}`,
        type: "recruitment" as const,
        title: "Recruitment Request",
        subtitle: `${r.positionName} — ${r.department}`,
        createdAt: r.createdAt,
      })),
    ];
    return items
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 8);
  }, [leaves, requests]);

  return (
    <div className="bg-[#050505] rounded-xl border border-white/8 p-5">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      {alerts.length === 0 ? (
        <p className="text-xs text-[#a8a8a8] py-6 text-center">
          No pending alerts
        </p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  a.type === "leave" ? "bg-yellow-500/15" : "bg-blue-500/15"
                }`}
              >
                {a.type === "leave" ? (
                  <Clock className="h-4 w-4 text-yellow-300" />
                ) : (
                  <FileText className="h-4 w-4 text-blue-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{a.title}</div>
                <div className="text-xs text-[#7a7a7a] truncate">
                  {a.subtitle}
                </div>
              </div>
              <div className="text-xs text-[#5a5a5a] flex-shrink-0">
                {relTime(a.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Approvals view
// ─────────────────────────────────────────────────────────────────────

function ApprovalsView({
  leaves,
  requests,
  onBack,
  onUpdated,
}: {
  leaves: LeaveRequest[];
  requests: RecruitmentRequest[];
  onBack: () => void;
  onUpdated: () => void;
}) {
  const [tab, setTab] = useState<"leave" | "recruitment">("leave");
  const [busyId, setBusyId] = useState<string | null>(null);
  const leavesPg = usePagination(leaves, APPROVALS_PAGE_SIZE);
  const reqsPg = usePagination(requests, APPROVALS_PAGE_SIZE);

  async function decideLeave(id: string, action: "approve" | "reject") {
    if (busyId) return;
    setBusyId(id);
    try {
      if (action === "approve") await approveLeaveRequest(id);
      else await rejectLeaveRequest(id);
      toast.success(action === "approve" ? "Leave approved" : "Leave rejected");
      onUpdated();
    } catch (err) {
      const msg =
        (err as { message?: string })?.message || "Failed to update leave";
      toast.error(parseErr(msg));
    } finally {
      setBusyId(null);
    }
  }

  async function decideRequest(id: string, action: "approve" | "reject") {
    if (busyId) return;
    setBusyId(id);
    try {
      await updateRecruitmentRequest(id, {
        status: action === "approve" ? "approved" : "draft",
      });
      toast.success(
        action === "approve" ? "Request approved" : "Request rejected",
      );
      onUpdated();
    } catch (err) {
      const msg =
        (err as { message?: string })?.message || "Failed to update request";
      toast.error(parseErr(msg));
    } finally {
      setBusyId(null);
    }
  }

  function leaveName(lv: LeaveRequest) {
    return typeof lv.userId === "object" ? lv.userId.name : "Unknown";
  }

  function leavePill(type: string) {
    return (
      LEAVE_TYPE_PILL[type] || {
        label: type,
        className: "bg-[#E5E7EB] text-[#374151]",
      }
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#a8a8a8] hover:text-white transition-colors mb-2 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Approvals
        </h2>
        <p className="text-sm text-[#7a7a7a] mt-1">
          Pending leaves and recruitment requests in your bucket
        </p>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#1a1a1a] border border-white/8">
        <button
          type="button"
          onClick={() => setTab("leave")}
          className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
            tab === "leave"
              ? "bg-brand text-brand-foreground"
              : "text-[#a8a8a8] hover:text-white"
          }`}
        >
          Leave Approvals
          {leaves.length > 0 && (
            <span
              className={`ml-1.5 text-[11px] ${
                tab === "leave" ? "text-black/60" : "text-[#7a7a7a]"
              }`}
            >
              ({leaves.length})
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("recruitment")}
          className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
            tab === "recruitment"
              ? "bg-brand text-brand-foreground"
              : "text-[#a8a8a8] hover:text-white"
          }`}
        >
          Recruitment Request
          {requests.length > 0 && (
            <span
              className={`ml-1.5 text-[11px] ${
                tab === "recruitment" ? "text-black/60" : "text-[#7a7a7a]"
              }`}
            >
              ({requests.length})
            </span>
          )}
        </button>
      </div>

      {tab === "leave" ? (
        <div className="space-y-3">
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {leaves.length === 0 ? (
              <div className="rounded-xl border border-white/8 bg-[#0a0a0a] px-4 py-10 text-center text-sm text-[#a8a8a8]">
                No pending leave requests
              </div>
            ) : (
              leavesPg.pageItems.map((lv) => {
                const name = leaveName(lv);
                const pill = leavePill(lv.leaveType);
                return (
                  <div
                    key={lv._id}
                    className="rounded-xl border border-white/8 bg-[#0a0a0a] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ApprovalAvatar name={name} />
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-white truncate">
                            {name}
                          </p>
                          <p
                            className="text-[12px] text-[#7a7a7a] truncate"
                            title={lv.reason}
                          >
                            {lv.reason || "—"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${pill.className}`}
                      >
                        {pill.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[13px]">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#7a7a7a] mb-0.5">
                          Start
                        </p>
                        <p className="text-[#a8a8a8]">
                          {fmtApprovalDate(lv.startDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#7a7a7a] mb-0.5">
                          End
                        </p>
                        <p className="text-[#a8a8a8]">
                          {fmtApprovalDate(lv.endDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#7a7a7a] mb-0.5">
                          Days
                        </p>
                        <p className="text-[#a8a8a8]">
                          {leaveDayCount(
                            lv.startDate,
                            lv.endDate,
                            lv.isHalfDay,
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <OutlineActionBtn
                        tone="green"
                        busy={busyId === lv._id}
                        onClick={() => decideLeave(lv._id, "approve")}
                      >
                        Approve
                      </OutlineActionBtn>
                      <OutlineActionBtn
                        tone="red"
                        busy={busyId === lv._id}
                        onClick={() => decideLeave(lv._id, "reject")}
                      >
                        Reject
                      </OutlineActionBtn>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table — pagination is a separate bar below */}
          <div className="hidden md:block space-y-3">
            <div className="bg-[#0a0a0a] rounded-xl border border-white/8 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse table-fixed min-w-[760px]">
                  <colgroup>
                    <col className="w-auto" />
                    <col className="w-[140px]" />
                    <col className="w-[120px]" />
                    <col className="w-[120px]" />
                    <col className="w-[100px]" />
                    <col className="w-[180px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#121212]">
                      <th className="text-left text-[12px] font-medium text-[#a8a8a8] px-5 py-3.5 border-b border-white/8">
                        Employee Name
                      </th>
                      <th className="text-left text-[12px] font-medium text-[#a8a8a8] px-4 py-3.5 border-b border-white/8 whitespace-nowrap">
                        Type of Leave
                      </th>
                      <th className="text-left text-[12px] font-medium text-[#a8a8a8] px-4 py-3.5 border-b border-white/8 whitespace-nowrap">
                        Start Date
                      </th>
                      <th className="text-left text-[12px] font-medium text-[#a8a8a8] px-4 py-3.5 border-b border-white/8 whitespace-nowrap">
                        End Date
                      </th>
                      <th className="text-left text-[12px] font-medium text-[#a8a8a8] px-4 py-3.5 border-b border-white/8 whitespace-nowrap">
                        No. of Days
                      </th>
                      <th className="text-right text-[12px] font-medium text-[#a8a8a8] px-5 py-3.5 border-b border-white/8 whitespace-nowrap">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-10 text-center text-sm text-[#a8a8a8]"
                        >
                          No pending leave requests
                        </td>
                      </tr>
                    ) : (
                      leavesPg.pageItems.map((lv) => {
                        const name = leaveName(lv);
                        const pill = leavePill(lv.leaveType);
                        return (
                          <tr
                            key={lv._id}
                            className="border-b border-white/5 hover:bg-white/[0.03] transition-colors last:border-b-0"
                          >
                            <td className="px-5 py-3.5 min-w-0">
                              <div className="flex items-center gap-3 min-w-0">
                                <ApprovalAvatar name={name} />
                                <span
                                  title={name}
                                  className="text-[13px] font-medium text-white truncate"
                                >
                                  {name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${pill.className}`}
                              >
                                {pill.label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-[13px] text-[#a8a8a8] whitespace-nowrap">
                              {fmtApprovalDate(lv.startDate)}
                            </td>
                            <td className="px-4 py-3.5 text-[13px] text-[#a8a8a8] whitespace-nowrap">
                              {fmtApprovalDate(lv.endDate)}
                            </td>
                            <td className="px-4 py-3.5 text-[13px] text-[#a8a8a8] whitespace-nowrap">
                              {leaveDayCount(
                                lv.startDate,
                                lv.endDate,
                                lv.isHalfDay,
                              )}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <OutlineActionBtn
                                  tone="green"
                                  busy={busyId === lv._id}
                                  onClick={() =>
                                    decideLeave(lv._id, "approve")
                                  }
                                >
                                  Approve
                                </OutlineActionBtn>
                                <OutlineActionBtn
                                  tone="red"
                                  busy={busyId === lv._id}
                                  onClick={() =>
                                    decideLeave(lv._id, "reject")
                                  }
                                >
                                  Reject
                                </OutlineActionBtn>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {leavesPg.totalPages > 1 && (
              <div className="rounded-xl border border-white/8 bg-[#0a0a0a]">
                <Pagination pg={leavesPg} />
              </div>
            )}
          </div>

          {leavesPg.totalPages > 1 && (
            <div className="md:hidden rounded-xl border border-white/8 bg-[#0a0a0a]">
              <Pagination pg={leavesPg} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {requests.length === 0 ? (
              <div className="rounded-xl border border-white/8 bg-[#0a0a0a] px-4 py-10 text-center text-sm text-[#a8a8a8]">
                No pending recruitment requests
              </div>
            ) : (
              reqsPg.pageItems.map((r) => {
                const approverList =
                  r.approvers && r.approvers.length > 0
                    ? r.approvers.join(", ")
                    : r.approver || "—";
                return (
                  <div
                    key={r._id}
                    className="rounded-xl border border-white/8 bg-[#0a0a0a] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-white truncate">
                          {r.positionName}
                        </p>
                        <p className="text-[12px] text-[#7a7a7a] truncate">
                          {r.department || "—"} · {r.branch || "—"}
                        </p>
                      </div>
                      <span className="shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-[#BFDBFE] text-[#1E40AF]">
                        {r.numberOfOpenings}{" "}
                        {r.numberOfOpenings === 1 ? "opening" : "openings"}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#7a7a7a] mb-0.5">
                        Approver
                      </p>
                      <p className="text-[13px] text-[#a8a8a8] truncate">
                        {approverList}
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <OutlineActionBtn
                        tone="green"
                        busy={busyId === r._id}
                        onClick={() => decideRequest(r._id, "approve")}
                      >
                        Approve
                      </OutlineActionBtn>
                      <OutlineActionBtn
                        tone="red"
                        busy={busyId === r._id}
                        onClick={() => decideRequest(r._id, "reject")}
                      >
                        Reject
                      </OutlineActionBtn>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table — pagination is a separate bar below */}
          <div className="hidden md:block space-y-3">
            <div className="bg-[#0a0a0a] rounded-xl border border-white/8 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse table-fixed min-w-[960px]">
                  <colgroup>
                    <col className="w-auto" />
                    <col className="w-[170px]" />
                    <col className="w-[150px]" />
                    <col className="w-[110px]" />
                    <col className="w-[220px]" />
                    <col className="w-[180px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#121212]">
                      <th className="text-left text-[12px] font-medium text-[#a8a8a8] px-5 py-3.5 border-b border-white/8">
                        Position
                      </th>
                      <th className="text-left text-[12px] font-medium text-[#a8a8a8] px-4 py-3.5 border-b border-white/8 whitespace-nowrap">
                        Department
                      </th>
                      <th className="text-left text-[12px] font-medium text-[#a8a8a8] px-4 py-3.5 border-b border-white/8 whitespace-nowrap">
                        Branch
                      </th>
                      <th className="text-left text-[12px] font-medium text-[#a8a8a8] px-4 py-3.5 border-b border-white/8 whitespace-nowrap">
                        Openings
                      </th>
                      <th className="text-left text-[12px] font-medium text-[#a8a8a8] px-4 py-3.5 border-b border-white/8 whitespace-nowrap">
                        Approver
                      </th>
                      <th className="text-right text-[12px] font-medium text-[#a8a8a8] px-5 py-3.5 border-b border-white/8 whitespace-nowrap">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-10 text-center text-sm text-[#a8a8a8]"
                        >
                          No pending recruitment requests
                        </td>
                      </tr>
                    ) : (
                      reqsPg.pageItems.map((r) => {
                        const approverList =
                          r.approvers && r.approvers.length > 0
                            ? r.approvers.join(", ")
                            : r.approver || "—";
                        return (
                          <tr
                            key={r._id}
                            className="border-b border-white/5 hover:bg-white/[0.03] transition-colors last:border-b-0"
                          >
                            <td className="px-5 py-3.5 min-w-0">
                              <span
                                title={r.positionName}
                                className="text-[13px] font-medium text-white truncate block"
                              >
                                {r.positionName}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-[#E0E7FF] text-[#4338CA]">
                                {r.department || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-[13px] text-[#a8a8a8] whitespace-nowrap">
                              {r.branch || "—"}
                            </td>
                            <td className="px-4 py-3.5 text-[13px] text-[#a8a8a8] whitespace-nowrap">
                              {r.numberOfOpenings}
                            </td>
                            <td
                              className="px-4 py-3.5 text-[13px] text-[#a8a8a8] truncate"
                              title={approverList}
                            >
                              {approverList}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <OutlineActionBtn
                                  tone="green"
                                  busy={busyId === r._id}
                                  onClick={() =>
                                    decideRequest(r._id, "approve")
                                  }
                                >
                                  Approve
                                </OutlineActionBtn>
                                <OutlineActionBtn
                                  tone="red"
                                  busy={busyId === r._id}
                                  onClick={() =>
                                    decideRequest(r._id, "reject")
                                  }
                                >
                                  Reject
                                </OutlineActionBtn>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {reqsPg.totalPages > 1 && (
              <div className="rounded-xl border border-white/8 bg-[#0a0a0a]">
                <Pagination pg={reqsPg} />
              </div>
            )}
          </div>

          {reqsPg.totalPages > 1 && (
            <div className="md:hidden rounded-xl border border-white/8 bg-[#0a0a0a]">
              <Pagination pg={reqsPg} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OutlineActionBtn({
  tone,
  busy,
  onClick,
  children,
}: {
  tone: "green" | "red";
  busy?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const toneCls =
    tone === "green"
      ? "bg-[#D1FAE5] text-[#047857] hover:bg-[#A7F3D0]"
      : "bg-[#FECACA] text-[#991B1B] hover:bg-[#FCA5A5]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center justify-center h-8 px-3 rounded-lg text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50 ${toneCls}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

function parseErr(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error) return parsed.error;
  } catch {
    /* ignore */
  }
  return raw || "Action failed";
}

// ─────────────────────────────────────────────────────────────────────
// Add Department modal
// ─────────────────────────────────────────────────────────────────────

function AddDepartmentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Department name is required");
      return;
    }
    setSaving(true);
    try {
      await createDepartment({
        name: name.trim(),
        description: description.trim(),
      });
      toast.success("Department created");
      onCreated();
    } catch {
      toast.error("Failed to create department");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#050505] rounded-xl border border-white/8 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h3 className="text-sm font-semibold text-white">Add Department</h3>
            <p className="text-xs text-[#7a7a7a] mt-0.5">
              Create a new department
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/8 rounded transition-colors cursor-pointer"
          >
            <X className="h-4 w-4 text-[#a8a8a8]" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Engineering"
              className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-10 px-3 text-sm text-white focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a8a8a8] mb-1">
              Description
            </label>
            <textarea
              value={description}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-[#a8a8a8] bg-transparent border border-white/10 rounded-lg hover:bg-white/5 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-brand-foreground bg-brand rounded-lg hover:bg-brand/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Pagination hook + component
// ─────────────────────────────────────────────────────────────────────

function usePagination<T>(data: T[], pageSize: number = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(page, totalPages);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageItems = useMemo(
    () => data.slice((safePage - 1) * pageSize, safePage * pageSize),
    [data, safePage, pageSize],
  );
  return {
    page: safePage,
    totalPages,
    pageItems,
    total: data.length,
    start: data.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    end: Math.min(safePage * pageSize, data.length),
    pageSize,
    goPrev: () => setPage((p) => Math.max(1, p - 1)),
    goNext: () => setPage((p) => Math.min(totalPages, p + 1)),
    goToPage: (p: number) => setPage(Math.min(Math.max(1, p), totalPages)),
  };
}

type Pg = ReturnType<typeof usePagination<unknown>>;

/** First page, last page, and a small window around the current page —
 *  with "…" filling any gaps. Keeps the pager short even at 50+ pages. */
function pageWindow(current: number, total: number): (number | "…")[] {
  const keep = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) keep.add(p);
  }
  const sorted = Array.from(keep).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

function Pagination({ pg }: { pg: Pg }) {
  const pages = pageWindow(pg.page, pg.totalPages);
  return (
    <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
      <span className="text-xs text-[#7a7a7a]">
        Rows per page:{" "}
        <span className="text-white font-medium">{pg.pageSize}</span>
        <span className="ml-4">
          <span className="text-white font-medium">{pg.start}</span>–
          <span className="text-white font-medium">{pg.end}</span> of{" "}
          <span className="text-white font-medium">{pg.total}</span> results
        </span>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={pg.goPrev}
          disabled={pg.page <= 1}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#7a7a7a] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-xs text-[#5a5a5a]">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => pg.goToPage(p)}
              className={`h-7 w-7 flex items-center justify-center rounded-md text-xs font-medium transition-colors cursor-pointer ${
                p === pg.page
                  ? "bg-white/15 text-white"
                  : "text-[#7a7a7a] hover:text-white"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={pg.goNext}
          disabled={pg.page >= pg.totalPages}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#7a7a7a] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
