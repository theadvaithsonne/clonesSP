"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { RefreshCw, Wifi, WifiOff, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type OnlineSession = {
  id: string;
  onlineAt: string;
  offlineAt: string | null;
  durationInSeconds: number;
};

type StakeholderActivity = {
  userId: string;
  name: string;
  email: string | null;
  sessions: OnlineSession[];
  totalOnlineSeconds: number;
  dailyTotals: Record<string, number>;
  lastOnline: string | null;
  isCurrentlyOnline: boolean;
};

type OnlineActivityData = {
  range: { start: string; end: string };
  stakeholders: StakeholderActivity[];
  days: Array<{
    date: string;
    totalOnlineSeconds: number;
    activeUsers: number;
  }>;
  currentlyOnline: number;
  totalStakeholders: number;
  generatedAt: string;
};

type OnlineActivityApiResponse = {
  success: boolean;
  data: OnlineActivityData;
};

const getMonthRange = (month: string) => {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

const formatDurationWithZero = (seconds?: number) => {
  const result = formatDuration(seconds);
  return result === "-" ? "0h" : result;
};

const formatTime = (isoDate: string) => {
  const date = new Date(isoDate);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDate = (isoDate: string) => {
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

export default function OnlineActivityTab() {
  const defaultMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [activityMonth, setActivityMonth] = useState(defaultMonth);
  const [activityRange, setActivityRange] = useState(() =>
    getMonthRange(defaultMonth)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityData, setActivityData] = useState<OnlineActivityData | null>(
    null
  );
  const [selectedStakeholderId, setSelectedStakeholderId] = useState<string>("");
  const [stakeholderSearch, setStakeholderSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchOnlineActivity = useCallback(
    async (range: { start: string; end: string }) => {
      const orgId = localStorage.getItem("garage_org_id");

      if (!orgId) {
        setError("No organization selected");
        setActivityData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ orgId });
        if (range.start) params.append("start", range.start);
        if (range.end) params.append("end", range.end);

        const res = await api<OnlineActivityApiResponse>(
          `/betty/online-activity?${params.toString()}`
        );

        if (res.success) {
          setActivityData(res.data);
        } else {
          setActivityData(null);
          setError("Failed to load online activity data");
        }
      } catch (err) {
        console.error("Failed to load online activity:", err);
        setActivityData(null);
        setError("Failed to load online activity data");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchOnlineActivity(activityRange);
  }, [activityRange, fetchOnlineActivity]);

  useEffect(() => {
    if (!activityData || activityData.stakeholders.length === 0) {
      if (selectedStakeholderId !== "") {
        setSelectedStakeholderId("");
      }
      return;
    }

    const exists = activityData.stakeholders.some(
      (s) => s.userId === selectedStakeholderId
    );

    if (!selectedStakeholderId || !exists) {
      setSelectedStakeholderId(activityData.stakeholders[0].userId);
    }
  }, [activityData, selectedStakeholderId]);

  const handleMonthChange = (value: string) => {
    if (!value) return;
    setActivityMonth(value);
    setActivityRange(getMonthRange(value));
  };

  const filteredStakeholders = useMemo(() => {
    if (!activityData) return [];
    const query = stakeholderSearch.trim().toLowerCase();
    if (!query) return activityData.stakeholders;
    return activityData.stakeholders.filter((s) => {
      const name = s.name?.toLowerCase() ?? "";
      const email = s.email?.toLowerCase() ?? "";
      return name.includes(query) || email.includes(query);
    });
  }, [activityData, stakeholderSearch]);

  const selectedStakeholder = useMemo(() => {
    if (!selectedStakeholderId || !activityData) return null;
    return activityData.stakeholders.find(
      (s) => s.userId === selectedStakeholderId
    );
  }, [activityData, selectedStakeholderId]);

  const groupedSessions = useMemo(() => {
    if (!selectedStakeholder) return [];

    const map = new Map<
      string,
      {
        date: string;
        sessions: OnlineSession[];
        totalDurationInSeconds: number;
      }
    >();

    selectedStakeholder.sessions.forEach((session) => {
      const dayKey = new Date(session.onlineAt).toISOString().split("T")[0];
      if (!map.has(dayKey)) {
        map.set(dayKey, {
          date: dayKey,
          sessions: [],
          totalDurationInSeconds: 0,
        });
      }
      const target = map.get(dayKey)!;
      target.sessions.push(session);
      target.totalDurationInSeconds += session.durationInSeconds;
    });

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        sessions: group.sessions.sort(
          (a, b) =>
            new Date(a.onlineAt).getTime() - new Date(b.onlineAt).getTime()
        ),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedStakeholder]);

  // Pagination calculations
  const totalPages = Math.ceil(groupedSessions.length / itemsPerPage);
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return groupedSessions.slice(startIndex, startIndex + itemsPerPage);
  }, [groupedSessions, currentPage, itemsPerPage]);

  // Reset page when stakeholder changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStakeholderId]);

  const selectedStakeholderDayCount = selectedStakeholder
    ? Object.keys(selectedStakeholder.dailyTotals || {}).length
    : 0;

  const averageDailySeconds =
    selectedStakeholder && selectedStakeholderDayCount > 0
      ? Math.round(
          selectedStakeholder.totalOnlineSeconds / selectedStakeholderDayCount
        )
      : 0;

  const lastOnlineDate = selectedStakeholder?.lastOnline
    ? new Date(selectedStakeholder.lastOnline)
    : null;

  const handleExport = () => {
    if (!selectedStakeholder) return;

    const rows: string[] = ["Date,Online Time,Offline Time,Duration (hours)"];

    selectedStakeholder.sessions.forEach((session) => {
      const onlineDate = new Date(session.onlineAt);
      const dateLabel = onlineDate.toLocaleDateString();
      const onlineLabel = onlineDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const offlineLabel = session.offlineAt
        ? new Date(session.offlineAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Still Online";
      const hoursDecimal = (session.durationInSeconds / 3600).toFixed(2);

      rows.push(
        [
          `"${dateLabel}"`,
          `"${onlineLabel}"`,
          `"${offlineLabel}"`,
          hoursDecimal,
        ].join(",")
      );
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (selectedStakeholder.name || "stakeholder")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");
    link.href = url;
    link.download = `${safeName || "stakeholder"}_online_activity_${
      activityMonth || "range"
    }.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const summaryStats = useMemo(() => {
    if (!activityData) {
      return {
        totalStakeholders: 0,
        currentlyOnline: 0,
        totalOnlineHours: 0,
        activeDays: 0,
      };
    }

    const totalOnlineSeconds = activityData.stakeholders.reduce(
      (acc, s) => acc + s.totalOnlineSeconds,
      0
    );

    return {
      totalStakeholders: activityData.totalStakeholders,
      currentlyOnline: activityData.currentlyOnline,
      totalOnlineHours: totalOnlineSeconds,
      activeDays: activityData.days.length,
    };
  }, [activityData]);

  if (!activityData && loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        Loading online activity...
      </div>
    );
  }

  if (!activityData) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        No online activity data available yet. Stakeholder presence is tracked
        when they connect to the platform.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 overflow-y-auto p-4"
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Left sidebar - Summary and Stakeholder List */}
        <div className="flex-shrink-0 space-y-4 lg:w-72">
          {/* Summary Card */}
          <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Activity Summary
            </div>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Total Stakeholders</span>
                <span className="text-base font-semibold text-white">
                  {summaryStats.totalStakeholders}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Currently Online</span>
                <span className="text-base font-semibold text-green-400">
                  {summaryStats.currentlyOnline}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Total Online Time</span>
                <span className="text-sm font-semibold text-yellow-300">
                  {formatDurationWithZero(summaryStats.totalOnlineHours)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Active Days</span>
                <span className="text-base font-semibold text-white">
                  {summaryStats.activeDays}
                </span>
              </div>
            </div>
          </div>

          {/* Stakeholder List */}
          <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Stakeholder List
              </h3>
              <span className="text-xs text-gray-500">
                {filteredStakeholders.length} filtered
              </span>
            </div>
            <Input
              placeholder="Search by name or email"
              value={stakeholderSearch}
              onChange={(e) => setStakeholderSearch(e.target.value)}
              className="mt-3 bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-gray-500"
            />
            <div className="mt-3 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredStakeholders.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#2a2a35] px-3 py-6 text-center text-xs text-gray-500">
                  No stakeholders match your search.
                </div>
              ) : (
                filteredStakeholders.map((stakeholder) => {
                  const isSelected =
                    stakeholder.userId === selectedStakeholderId;
                  return (
                    <button
                      key={stakeholder.userId}
                      onClick={() =>
                        setSelectedStakeholderId(stakeholder.userId)
                      }
                      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? "border-yellow-400/50 bg-yellow-500/10"
                          : "border-transparent bg-[#111116] hover:border-[#1f1f27]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              stakeholder.isCurrentlyOnline
                                ? "bg-green-400"
                                : "bg-gray-500"
                            }`}
                          />
                          <div>
                            <div className="text-sm font-medium text-white">
                              {stakeholder.name || stakeholder.email || "—"}
                            </div>
                            {stakeholder.email && (
                              <div className="text-xs text-gray-500">
                                {stakeholder.email}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-xs font-medium text-yellow-300">
                          {formatDurationWithZero(stakeholder.totalOnlineSeconds)}
                        </div>
                      </div>
                      {stakeholder.isCurrentlyOnline && (
                        <div className="mt-2 text-[11px] text-green-400 flex items-center gap-1">
                          <Wifi className="w-3 h-3" />
                          Currently Online
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Controls */}
          <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    Month
                  </span>
                  <Input
                    type="month"
                    value={activityMonth}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className="bg-[#1a1a20] border-[#2a2a35] text-white text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    Stakeholder
                  </span>
                  <Select
                    value={selectedStakeholderId}
                    onValueChange={(value) => setSelectedStakeholderId(value)}
                  >
                    <SelectTrigger className="w-[220px] bg-[#1a1a20] border-[#2a2a35] text-left text-sm text-white">
                      <SelectValue placeholder="Select stakeholder" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111116] text-white">
                      {activityData.stakeholders.map((stakeholder) => (
                        <SelectItem
                          key={stakeholder.userId}
                          value={stakeholder.userId}
                          className="text-sm text-white data-[state=checked]:bg-yellow-500/20 data-[state=checked]:text-yellow-200"
                        >
                          {stakeholder.name || stakeholder.email || "—"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleExport}
                  size="sm"
                  variant="outline"
                  disabled={
                    !selectedStakeholder ||
                    selectedStakeholder.sessions.length === 0
                  }
                  className="bg-[#1a1a20] border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35]"
                >
                  Export CSV
                </Button>
                <Button
                  onClick={() => fetchOnlineActivity(activityRange)}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 bg-[#1a1a20] border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35]"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>
            {error && (
              <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}
            <div className="mt-3 text-xs text-gray-500">
              Showing activity from{" "}
              {new Date(activityData.range.start).toLocaleDateString()} to{" "}
              {new Date(activityData.range.end).toLocaleDateString()}
            </div>
          </div>

          {loading && (
            <div className="rounded-lg border border-dashed border-[#2a2a35] bg-[#0b0b0d] px-4 py-3 text-sm text-gray-500">
              Refreshing online activity data...
            </div>
          )}

          {selectedStakeholder ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Total Online Time
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {formatDurationWithZero(
                      selectedStakeholder.totalOnlineSeconds
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Across {selectedStakeholderDayCount} day
                    {selectedStakeholderDayCount === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Average Per Day
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {formatDurationWithZero(averageDailySeconds)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Based on active days
                  </div>
                </div>
                <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Current Status
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                    {selectedStakeholder.isCurrentlyOnline ? (
                      <>
                        <Wifi className="w-5 h-5 text-green-400" />
                        <span className="text-green-400">Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-400">Offline</span>
                      </>
                    )}
                  </div>
                  {selectedStakeholder.isCurrentlyOnline ? (
                    <div className="mt-1 text-xs text-gray-500">
                      Connected now
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-gray-500">
                      Not currently connected
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Last Online
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {lastOnlineDate
                      ? lastOnlineDate.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "—"}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {lastOnlineDate
                      ? lastOnlineDate.toLocaleDateString()
                      : "No activity recorded"}
                  </div>
                </div>
              </div>

              {/* Sessions List */}
              <div className="space-y-4">
                {groupedSessions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#2a2a35] bg-[#0b0b0d] p-6 text-center text-sm text-gray-500">
                    No online sessions recorded for this period.
                  </div>
                ) : (
                  <>
                    {paginatedSessions.map((group) => {
                      const dateObj = new Date(`${group.date}T00:00:00`);
                      return (
                        <div
                          key={group.date}
                          className="overflow-hidden rounded-lg border border-[#2a2a35] bg-[#0e0e12]"
                        >
                          <div className="flex items-center justify-between border-b border-[#1f1f27] px-4 py-3">
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {dateObj.toLocaleDateString(undefined, {
                                  weekday: "long",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </div>
                              <div className="text-xs text-gray-500">
                                Total{" "}
                                {formatDurationWithZero(
                                  group.totalDurationInSeconds
                                )}
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className="border-[#1f1f27] bg-[#111116] text-xs text-gray-300"
                            >
                              {group.sessions.length}{" "}
                              {group.sessions.length === 1
                                ? "session"
                                : "sessions"}
                            </Badge>
                          </div>
                          <div className="px-4 py-2">
                            <div className="grid grid-cols-[1fr_120px_120px_120px] gap-3 text-[11px] uppercase tracking-wide text-gray-500">
                              <span>Session</span>
                              <span className="text-right">Came Online</span>
                              <span className="text-right">Went Offline</span>
                              <span className="text-right">Duration</span>
                            </div>
                            {group.sessions.map((session, index) => {
                              const isActive = !session.offlineAt;
                              return (
                                <div
                                  key={session.id}
                                  className="grid grid-cols-[1fr_120px_120px_120px] items-center gap-3 border-t border-[#1f1f27] py-3"
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                        isActive
                                          ? "bg-green-500/20"
                                          : "bg-[#18181f]"
                                      } text-xs ${
                                        isActive ? "text-green-400" : "text-gray-400"
                                      }`}
                                    >
                                      {isActive ? (
                                        <Wifi className="w-4 h-4" />
                                      ) : (
                                        index + 1
                                      )}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-sm text-white">
                                        Session {index + 1}
                                      </span>
                                      <span
                                        className={`text-xs ${
                                          isActive
                                            ? "text-green-400"
                                            : "text-gray-500"
                                        }`}
                                      >
                                        {isActive ? "Currently online" : "Completed"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right text-sm text-white">
                                    {formatTime(session.onlineAt)}
                                  </div>
                                  <div className="text-right text-sm text-white">
                                    {session.offlineAt
                                      ? formatTime(session.offlineAt)
                                      : "—"}
                                  </div>
                                  <div className="text-right text-sm font-medium text-yellow-300">
                                    {formatDurationWithZero(
                                      session.durationInSeconds
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between rounded-lg border border-[#2a2a35] bg-[#0e0e12] px-4 py-3">
                        <div className="text-sm text-gray-400">
                          Showing {(currentPage - 1) * itemsPerPage + 1} -{" "}
                          {Math.min(currentPage * itemsPerPage, groupedSessions.length)} of{" "}
                          {groupedSessions.length} days
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            variant="outline"
                            size="sm"
                            className="bg-[#1a1a20] border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35] disabled:opacity-50"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm text-gray-300 min-w-[80px] text-center">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            variant="outline"
                            size="sm"
                            className="bg-[#1a1a20] border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35] disabled:opacity-50"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-[#2a2a35] bg-[#0b0b0d] text-sm text-gray-500">
              Select a stakeholder from the list to see detailed online activity.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
