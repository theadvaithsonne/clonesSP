"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Video,
  Users,
  Clock,
  Film,
  TrendingUp,
  Calendar as CalendarIcon,
  Loader2,
  Monitor,
  Zap,
  UserCheck,
} from "lucide-react";
import {
  getMeetAnalytics,
  AdminUnauthorizedError,
  type MeetAnalyticsData,
  type MeetSession,
} from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface RecordingFile {
  filename: string;
  size: number;
  sizeMB: string;
  createdAt: string;
  roomName: string;
}

const LK_API_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace("wss://", "https://").replace(
    "ws://",
    "http://"
  ) || "https://lk.garage.app";

export default function MeetAnalyticsPage() {
  const [data, setData] = useState<MeetAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [selectedSession, setSelectedSession] = useState<MeetSession | null>(null);
  const [recordingFiles, setRecordingFiles] = useState<RecordingFile[]>([]);
  const [sessionPage, setSessionPage] = useState(1);
  const SESSION_PAGE_SIZE = 10;

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  // Capped to one recovery attempt per failure episode: if elevation keeps
  // succeeding while the data endpoint keeps 401ing, this must not loop
  // forever hammering the backend. Re-arms once the data loads again.
  const recoveryAttempted = useRef(false);

  const reload = () => {
    setLoading(true);
    getMeetAnalytics(days)
      .then((d) => {
        setData(d);
        recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      })
      .catch((e) => {
        if (e instanceof AdminUnauthorizedError) {
          if (recoveryAttempted.current) return; // one attempt per failure episode
          recoveryAttempted.current = true;
          ensureNcAdminToken().then((result) => {
            if (result.ok === true) {
              reload();
            }
          });
          return;
        }
        setError("Failed to load analytics.");
      })
      .finally(() => setLoading(false));
  };

  // Fetch available recording files from the LiveKit server directly — this
  // does not go through the NC admin auth flow (no AdminUnauthorizedError
  // possible here), so it needs no recovery guard of its own.
  useEffect(() => {
    fetch(`${LK_API_URL}/api/recordings/list`)
      .then((r) => r.json())
      .then((files) => Array.isArray(files) && setRecordingFiles(files))
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [days]);

  const maxDailyCount = useMemo(() => {
    if (!data?.dailyTrend.length) return 1;
    return Math.max(...data.dailyTrend.map((d) => d.count), 1);
  }, [data]);

  // Reset session page when days range changes
  useEffect(() => {
    setSessionPage(1);
  }, [days]);

  if (loading) {
    return (
      <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col items-center justify-center bg-[#080808]">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFC200]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col items-center justify-center gap-4 bg-[#080808]">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <Zap className="h-8 w-8" />
        </div>
        <p className="text-zinc-400 max-w-md text-center">{error || "No data available"}</p>
      </div>
    );
  }

  const {
    overall,
    topParticipants,
    dailyTrend,
    recentSessions,
    recordings,
  } = data;

  const topScreenSharers = data.topScreenSharers ?? [];
  const hourlyDistribution = data.hourlyDistribution ?? [];
  const weekdayDistribution = data.weekdayDistribution ?? [];
  const userTypeBreakdown = data.userTypeBreakdown ?? null;

  const maxHourCount = Math.max(
    ...hourlyDistribution.map((h) => h.count),
    1
  );
  const maxWeekdayCount = Math.max(
    ...weekdayDistribution.map((w) => w.count),
    1
  );

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col overflow-y-auto bg-[#080808] px-4 py-6 text-white sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFC200] to-[#FFA800]">
            <Monitor className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Admin Dashboard
            </h1>
            <p className="mt-0.5 text-sm text-zinc-400">
              Platform administration and meet analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Range selector */}
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  days === d
                    ? "bg-gradient-to-r from-[#FFC200]/20 to-[#FFA800]/20 text-black border border-[#FFC200]/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={() => {
              setData(null);
              reload();
            }}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
            title="Refresh"
          >
            <Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6 mb-8">
        <StatCard
          icon={<Video className="h-5 w-5" />}
          label="Total Meetings"
          value={overall.totalMeetings.toString()}
          subtitle={`${overall.soloSessions} solo`}
          color="text-[#FFC200]"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Total Duration"
          value={formatDuration(overall.totalDurationSeconds)}
          subtitle={`avg ${formatDuration(
            Math.round(overall.avgDurationSeconds || 0)
          )}`}
          color="text-[#1D9E75]"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Total Joins"
          value={overall.totalJoins.toString()}
          subtitle={`avg ${(overall.avgParticipants || 0).toFixed(1)}/meeting`}
          color="text-[#f59e0b]"
        />
        <StatCard
          icon={<Monitor className="h-5 w-5" />}
          label="Screen Shares"
          value={formatDuration(overall.totalScreenShareSeconds)}
          subtitle={`${overall.sessionsWithScreenShare} sessions`}
          color="text-[#FFC200]"
        />
        <StatCard
          icon={<Film className="h-5 w-5" />}
          label="Recordings"
          value={recordings.totalRecordings.toString()}
          subtitle={`${recordings.sessionsRecorded} sessions`}
          color="text-[#ec4899]"
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="Longest Meeting"
          value={formatDuration(overall.maxDurationSeconds || 0)}
          subtitle="record duration"
          color="text-[#FFA800]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Daily trend chart */}
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFC200]/10">
              <TrendingUp className="h-4 w-4 text-[#FFC200]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Daily Activity</h2>
              <p className="text-[10px] text-zinc-500">
                Meetings per day over the last {days} days
              </p>
            </div>
          </div>
          {dailyTrend.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03]">
                <TrendingUp className="h-5 w-5 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-500">
                No meetings in this period
              </p>
            </div>
          ) : (
            <>
              <div className="relative h-52">
                {/* Y-axis gridlines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="border-t border-white/[0.04] w-full"
                    />
                  ))}
                </div>
                {/* Bars */}
                <div className="relative h-full flex items-end gap-2 px-2">
                  {dailyTrend.map((d) => {
                    const heightPct = Math.max(
                      6,
                      (d.count / maxDailyCount) * 100
                    );
                    return (
                      <div
                        key={d._id}
                        className="flex-1 relative h-full group cursor-pointer flex items-end justify-center min-w-[20px]"
                        title={`${d._id}: ${d.count} meetings, ${formatDuration(
                          d.totalSeconds
                        )}`}
                      >
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                          <div className="rounded-lg border border-white/[0.1] bg-[#0a0a0a] px-2 py-1 text-[10px] shadow-xl">
                            <div className="text-white font-semibold">
                              {d.count} meeting{d.count !== 1 ? "s" : ""}
                            </div>
                            <div className="text-zinc-400">
                              {formatDuration(d.totalSeconds)}
                            </div>
                          </div>
                        </div>
                        {/* Bar */}
                        <div
                          className="w-full max-w-[60px] rounded-t-lg bg-gradient-to-t from-[#FFC200]/40 to-[#FFA800]/60 group-hover:from-[#FFC200]/80 group-hover:to-[#FFA800]/90 transition-all"
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* X-axis labels */}
              <div className="mt-2 flex gap-2 px-2 text-[9px] text-zinc-500">
                {dailyTrend.map((d, i) => {
                  // Only show every Nth label to avoid overlap
                  const showEvery = Math.max(
                    1,
                    Math.ceil(dailyTrend.length / 8)
                  );
                  const show =
                    i === 0 ||
                    i === dailyTrend.length - 1 ||
                    i % showEvery === 0;
                  const date = new Date(d._id);
                  const label = isNaN(date.getTime())
                    ? d._id
                    : `${date.getDate()}/${date.getMonth() + 1}`;
                  return (
                    <div
                      key={d._id}
                      className="flex-1 text-center min-w-[20px]"
                    >
                      {show ? label : ""}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Top participants */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D9E75]/10">
              <Users className="h-4 w-4 text-[#1D9E75]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Top Participants</h2>
              <p className="text-[10px] text-zinc-500">By total call time</p>
            </div>
          </div>
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {topParticipants.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-zinc-500">No data yet</p>
              </div>
            ) : (
              topParticipants.slice(0, 10).map((p, idx) => {
                const displayName = p.name || p._id;
                const rankColor =
                  idx === 0
                    ? "bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30"
                    : idx === 1
                    ? "bg-zinc-400/20 text-zinc-300 border-zinc-400/30"
                    : idx === 2
                    ? "bg-orange-600/20 text-orange-400 border-orange-600/30"
                    : "bg-white/[0.05] text-zinc-400 border-white/[0.06]";
                return (
                  <div
                    key={p._id}
                    className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/[0.03] transition"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${rankColor}`}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-white font-medium">
                        {displayName}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {p.meetingsAttended} meeting
                        {p.meetingsAttended !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-300 font-mono shrink-0 rounded-md bg-white/[0.04] px-2 py-0.5">
                      {formatDuration(p.totalSeconds)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Insights row: hourly, weekday, user types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Hourly distribution */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFC200]/10">
              <Clock className="h-4 w-4 text-[#FFC200]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Peak Hours</h2>
              <p className="text-[10px] text-zinc-500">
                When meetings happen (UTC)
              </p>
            </div>
          </div>
          <div className="relative h-32">
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {hourlyDistribution.map((h) => {
                const heightPct = Math.max(
                  3,
                  (h.count / maxHourCount) * 100
                );
                const hour12 =
                  h.hour === 0
                    ? "12 AM"
                    : h.hour < 12
                    ? `${h.hour} AM`
                    : h.hour === 12
                    ? "12 PM"
                    : `${h.hour - 12} PM`;
                return (
                  <div
                    key={h.hour}
                    className="flex-1 group relative h-full flex items-end"
                    title={`${hour12} — ${h.count} meetings`}
                  >
                    <div
                      className="w-full rounded-t bg-[#FFC200]/30 group-hover:bg-[#FFC200]/60 transition"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[9px] text-zinc-500">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>
        </div>

        {/* Weekday distribution */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f59e0b]/10">
              <CalendarIcon className="h-4 w-4 text-[#f59e0b]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Busiest Days</h2>
              <p className="text-[10px] text-zinc-500">By day of week</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {weekdayDistribution.map((w) => {
              const widthPct = (w.count / maxWeekdayCount) * 100;
              return (
                <div key={w.day} className="flex items-center gap-2">
                  <span className="w-8 text-[10px] text-zinc-400 uppercase">
                    {w.day}
                  </span>
                  <div className="flex-1 h-5 rounded-md bg-white/[0.03] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#f59e0b]/40 to-[#f59e0b]/60 transition-all"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-300 font-mono w-6 text-right">
                    {w.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* User type breakdown + top screen sharers */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFA800]/10">
              <UserCheck className="h-4 w-4 text-[#FFA800]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Attendees</h2>
              <p className="text-[10px] text-zinc-500">
                Guest vs authenticated
              </p>
            </div>
          </div>

          {!userTypeBreakdown ? (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500">No data yet</p>
              <p className="text-[10px] text-zinc-600 mt-1">
                Deploy backend to see attendee stats
              </p>
            </div>
          ) : (
            (() => {
              const guestCount = userTypeBreakdown.guestCount || 0;
              const authedCount = userTypeBreakdown.authedCount || 0;
              const hostCount = userTypeBreakdown.hostCount || 0;
              const total = guestCount + authedCount;
              const authedPct =
                total > 0 ? Math.round((authedCount / total) * 100) : 0;
              const guestPct = 100 - authedPct;
              return (
                <>
                  <div className="mb-3 h-2 rounded-full bg-white/[0.03] overflow-hidden flex">
                    <div
                      className="bg-[#FFA800]"
                      style={{ width: `${authedPct}%` }}
                    />
                    <div
                      className="bg-[#FFC200]"
                      style={{ width: `${guestPct}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#FFA800]" />
                      <div>
                        <div className="text-white font-medium">
                          {authedCount}
                        </div>
                        <div className="text-[9px] text-zinc-500">
                          Members ({authedPct}%)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#FFC200]" />
                      <div>
                        <div className="text-white font-medium">
                          {guestCount}
                        </div>
                        <div className="text-[9px] text-zinc-500">
                          Guests ({guestPct}%)
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">
                      Host sessions
                    </span>
                    <span className="text-xs text-zinc-300 font-medium">
                      {hostCount}
                    </span>
                  </div>
                </>
              );
            })()
          )}
        </div>
      </div>

      {/* Top screen sharers */}
      {topScreenSharers.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFC200]/10">
              <Monitor className="h-4 w-4 text-[#FFC200]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Top Screen Sharers</h2>
              <p className="text-[10px] text-zinc-500">
                By total time sharing
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {topScreenSharers.slice(0, 9).map((p, idx) => (
              <div
                key={p._id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFC200]/20 text-xs font-semibold text-[#FFC200]">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm text-white font-medium">
                    {p.name || p._id}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {p.shareCount} share{p.shareCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-xs text-zinc-300 font-mono shrink-0 rounded-md bg-white/[0.04] px-2 py-0.5">
                  {formatDuration(p.totalSeconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recordings */}
      <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/10">
              <Film className="h-4 w-4 text-pink-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Recordings</h2>
              <p className="text-[10px] text-zinc-500">
                {recordingFiles.length} file
                {recordingFiles.length !== 1 ? "s" : ""} available
              </p>
            </div>
          </div>
        </div>

        {recordingFiles.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03]">
              <Film className="h-5 w-5 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500">No recordings yet</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Start recording during a meeting to see files here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500 border-b border-white/[0.06]">
                  <th className="pb-3 font-medium">Room</th>
                  <th className="pb-3 font-medium">Size</th>
                  <th className="pb-3 font-medium">Recorded</th>
                  <th className="pb-3 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody>
                {recordingFiles.slice(0, 20).map((rec) => {
                  const roomId = rec.roomName.replace(
                    /^(meet|office-room|call)-/,
                    ""
                  );
                  const downloadUrl = `${LK_API_URL}/api/recordings/download/${encodeURIComponent(rec.filename)}`;
                  return (
                    <tr
                      key={rec.filename}
                      className="border-b border-white/[0.04] transition hover:bg-white/[0.03] group"
                    >
                      <td className="py-3.5">
                        <div className="font-mono text-[11px] text-zinc-300">
                          {roomId}
                        </div>
                      </td>
                      <td className="py-3.5 text-zinc-300 text-xs">
                        {parseFloat(rec.sizeMB) >= 1024
                          ? `${(parseFloat(rec.sizeMB) / 1024).toFixed(2)} GB`
                          : `${rec.sizeMB} MB`}
                      </td>
                      <td className="py-3.5 text-zinc-400 text-xs whitespace-nowrap">
                        {formatDateTime(rec.createdAt)}
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="inline-flex gap-2">
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[10px] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                          >
                            Play
                          </a>
                          <a
                            href={downloadUrl}
                            download={rec.filename}
                            className="rounded-lg bg-pink-500/15 border border-pink-500/30 px-2.5 py-1 text-[10px] text-pink-400 transition hover:bg-pink-500/25"
                          >
                            Download
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent sessions */}
      {(() => {
        const totalSessionPages = Math.max(
          1,
          Math.ceil(recentSessions.length / SESSION_PAGE_SIZE)
        );
        const curSessionPage = Math.min(sessionPage, totalSessionPages);
        const sessionStart = (curSessionPage - 1) * SESSION_PAGE_SIZE;
        const paginatedSessions = recentSessions.slice(
          sessionStart,
          sessionStart + SESSION_PAGE_SIZE
        );

        return (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f59e0b]/10">
                  <CalendarIcon className="h-4 w-4 text-[#f59e0b]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Recent Sessions</h2>
                  <p className="text-[10px] text-zinc-500">
                    {recentSessions.length}{" "}
                    {recentSessions.length === 1 ? "session" : "sessions"} in
                    the last {days} days
                  </p>
                </div>
              </div>
            </div>

            {recentSessions.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03]">
                  <Video className="h-5 w-5 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500">
                  No sessions in this period
                </p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  Start a meeting to see activity here
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500 border-b border-white/[0.06]">
                        <th className="pb-3 font-medium">Room</th>
                        <th className="pb-3 font-medium">Participants</th>
                        <th className="pb-3 font-medium">Started</th>
                        <th className="pb-3 font-medium">Duration</th>
                        <th className="pb-3 font-medium">Peak</th>
                        <th className="pb-3 font-medium">Recorded</th>
                        <th className="pb-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSessions.map((s) => {
                        const seen = new Set<string>();
                        const names: string[] = [];
                        for (const p of s.participants || []) {
                          const label = p.name || p.identity;
                          if (label && !seen.has(label)) {
                            seen.add(label);
                            names.push(label);
                          }
                        }
                        const isLive = !s.endedAt;
                        return (
                          <tr
                            key={s._id}
                            className="border-b border-white/[0.04] transition hover:bg-white/[0.03] group"
                          >
                            <td className="py-3.5">
                              <div className="font-mono text-[11px] text-zinc-300">
                                {s.roomId}
                              </div>
                              {isLive && (
                                <div className="mt-0.5 inline-flex items-center gap-1 text-[9px] text-emerald-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  LIVE
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 max-w-[220px]">
                              {names.length === 0 ? (
                                <span className="text-zinc-600 text-xs">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {names.slice(0, 2).map((n) => (
                                    <span
                                      key={n}
                                      className="inline-flex items-center gap-1 rounded-full bg-[#FFC200]/10 border border-[#FFC200]/20 px-2 py-0.5 text-[10px] text-[#FFD24D]"
                                    >
                                      <span className="h-3 w-3 rounded-full bg-[#FFC200]/30 flex items-center justify-center text-[7px] text-white">
                                        {n.charAt(0).toUpperCase()}
                                      </span>
                                      {n.length > 12
                                        ? n.slice(0, 12) + "…"
                                        : n}
                                    </span>
                                  ))}
                                  {names.length > 2 && (
                                    <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-400">
                                      +{names.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 text-zinc-400 text-xs whitespace-nowrap">
                              {formatDateTime(s.startedAt)}
                            </td>
                            <td className="py-3.5 text-zinc-300 text-xs">
                              {s.durationSeconds ? (
                                formatDuration(s.durationSeconds)
                              ) : isLive ? (
                                <span className="text-emerald-400">
                                  ongoing
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3.5 text-zinc-300 text-xs">
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3 w-3 text-zinc-500" />
                                {s.peakParticipants}
                              </span>
                            </td>
                            <td className="py-3.5">
                              {s.wasRecorded ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 text-[10px] text-pink-400">
                                  <Film className="h-2.5 w-2.5" />
                                  {s.recordingIds.length}
                                </span>
                              ) : (
                                <span className="text-zinc-600 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => setSelectedSession(s)}
                                className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[10px] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white opacity-60 group-hover:opacity-100"
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalSessionPages > 1 && (
                  <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      Showing {sessionStart + 1}-
                      {Math.min(
                        sessionStart + SESSION_PAGE_SIZE,
                        recentSessions.length
                      )}{" "}
                      of {recentSessions.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                        disabled={curSessionPage === 1}
                        className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 hover:bg-white/[0.06] disabled:opacity-30"
                      >
                        Prev
                      </button>
                      <span className="px-3 text-zinc-300">
                        {curSessionPage} / {totalSessionPages}
                      </span>
                      <button
                        onClick={() =>
                          setSessionPage((p) =>
                            Math.min(totalSessionPages, p + 1)
                          )
                        }
                        disabled={curSessionPage === totalSessionPages}
                        className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 hover:bg-white/[0.06] disabled:opacity-30"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Session details modal */}
      {selectedSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedSession(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#0a0a0a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Session Details
                </h3>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  {selectedSession.roomId}
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5 text-xs">
              <div>
                <p className="text-zinc-500">Started</p>
                <p className="text-white">
                  {formatDateTime(selectedSession.startedAt)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Ended</p>
                <p className="text-white">
                  {selectedSession.endedAt
                    ? formatDateTime(selectedSession.endedAt)
                    : "ongoing"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Duration</p>
                <p className="text-white">
                  {formatDuration(selectedSession.durationSeconds || 0)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Peak Participants</p>
                <p className="text-white">{selectedSession.peakParticipants}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">
                Participants ({selectedSession.participants.length})
              </h4>
              <div className="space-y-2">
                {selectedSession.participants.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#FFC200]/20 flex items-center justify-center text-[10px] text-[#FFC200]">
                        {(p.name || p.identity).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white">{p.name || p.identity}</p>
                        <p className="text-[10px] text-zinc-500">
                          {formatDateTime(p.joinedAt)}
                          {p.leftAt
                            ? ` → ${formatDateTime(p.leftAt)}`
                            : " → active"}
                        </p>
                      </div>
                      {p.isHost && (
                        <span className="rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-[9px] text-[#f59e0b]">
                          HOST
                        </span>
                      )}
                      {p.isGuest && (
                        <span className="rounded-full bg-[#FFC200]/15 px-2 py-0.5 text-[9px] text-[#FFC200]">
                          GUEST
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-zinc-300">
                      {formatDuration(p.durationSeconds || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Screen share events */}
            {selectedSession.screenShares &&
              selectedSession.screenShares.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Monitor className="h-3.5 w-3.5 text-[#FFC200]" />
                      Screen Shares ({selectedSession.screenShares.length})
                    </h4>
                    <span className="text-[10px] text-zinc-500">
                      Total:{" "}
                      {formatDuration(
                        selectedSession.totalScreenShareSeconds || 0
                      )}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {selectedSession.screenShares.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-[#FFC200]/10 bg-[#FFC200]/5 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-md bg-[#FFC200]/20 flex items-center justify-center">
                            <Monitor className="h-3 w-3 text-[#FFC200]" />
                          </div>
                          <div>
                            <p className="text-white">
                              {s.name || s.identity}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              {formatDateTime(s.startedAt)}
                              {s.endedAt
                                ? ` → ${formatDateTime(s.endedAt)}`
                                : " → active"}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-[#FFC200]">
                          {formatDuration(s.durationSeconds || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-white/[0.15] hover:bg-white/[0.04]">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition" />
      <div className="relative">
        <div
          className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] ${
            color || "text-white"
          }`}
        >
          {icon}
        </div>
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
        {subtitle && (
          <p className="mt-1 text-[10px] text-zinc-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
