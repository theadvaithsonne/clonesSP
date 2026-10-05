"use client";

// Admin LIVE calls dashboard.
//
// Real-time monitoring + moderation of every ongoing LiveKit room.
// Admin can mute, ban, kick, end a call, toggle host access-control,
// start/stop recording, broadcast a system message — all without
// joining the call.
//
// Motivating incident: a rogue host muted everyone and blocked others
// from unmuting themselves. An out-of-band super-admin now has the
// override.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Radio,
  Users,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  UserX,
  Ban,
  PhoneOff,
  RefreshCw,
  Loader2,
  Calendar,
  Clock,
  X,
  ShieldAlert,
  ArrowUpDown,
  Circle,
  Volume2,
  VolumeX,
  Send,
  Settings2,
  History,
  CheckCircle2,
  AlertCircle,
  Bot,
} from "lucide-react";

import {
  listLiveRooms,
  getLiveRoom,
  getEndedRoom,
  getAdminRecordingUrl,
  muteLiveParticipant,
  kickLiveParticipant,
  endLiveRoom,
  listScheduledMeets,
  listRecentEnded,
  muteAllInRoom,
  banLiveParticipant,
  broadcastToRoom,
  updateRoomSettings,
  startRoomRecording,
  stopRoomRecording,
  AdminUnauthorizedError,
  type LiveRoomSummary,
  type LiveRoomDetail,
  type LiveParticipant,
  type EndedRoomDetail,
  type EndedRoomParticipant,
  type AdminScheduledMeet,
  type RecentEndedSession,
} from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import { Building2, Film, FileText, Download, User as UserIcon } from "lucide-react";
import { useAdminSearch } from "@/components/garage-admin/admin-search";

const REFRESH_MS = 4000;
const DETAIL_REFRESH_MS = 2000;

type Tab = "active" | "scheduled" | "ended";
type Sort = "newest" | "oldest" | "participants";

function fmtRel(fromMs: number | null): string {
  if (!fromMs) return "—";
  const s = Math.max(0, Math.floor((Date.now() - fromMs) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function fmtDuration(fromMs: number | null): string {
  if (!fromMs) return "—";
  const s = Math.max(0, Math.floor((Date.now() - fromMs) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ── Toast system ─────────────────────────────────────────────────────

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, kind, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);
  return { toasts, push };
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex min-w-[220px] items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-2xl backdrop-blur ${
            t.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
              : t.kind === "error"
              ? "border-red-500/30 bg-red-500/15 text-red-200"
              : "border-white/10 bg-black/70 text-zinc-200"
          }`}
        >
          {t.kind === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : t.kind === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ── Live-tick hook ───────────────────────────────────────────────────
//
// Forces a re-render every second so duration counters update without
// re-polling the server. Used inside cards and the drawer header.

function useSecondTick(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return n;
}

// ── Page ─────────────────────────────────────────────────────────────

export default function AdminLiveCallsPage() {
  const [rooms, setRooms] = useState<LiveRoomSummary[]>([]);
  const [scheduled, setScheduled] = useState<AdminScheduledMeet[]>([]);
  const [ended, setEnded] = useState<RecentEndedSession[]>([]);
  const [tab, setTab] = useState<Tab>("active");
  const { query } = useAdminSearch();
  const [sort, setSort] = useState<Sort>("newest");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<{
    name: string;
    mode: "live" | "ended";
  } | null>(null);
  const { toasts, push: pushToast } = useToasts();

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  // Capped to one recovery attempt per failure episode: if elevation keeps
  // succeeding while this endpoint keeps 401ing, this must not loop forever
  // hammering the backend. Re-arms once the data loads again — NOT on
  // elevation success, which reintroduces an unbounded loop (Task 14 defect).
  const reloadRecoveryAttempted = useRef(false);

  const reload = useCallback(
    async (background = false) => {
      if (!background) setLoading(true);
      else setRefreshing(true);
      try {
        const [live, sched, recent] = await Promise.all([
          listLiveRooms(),
          listScheduledMeets(7).catch(() => ({ schedules: [], total: 0 })),
          // minutes=0 → every ended meet ever, newest first, capped
          // server-side at limit (200). "Last hour" was almost always
          // empty in practice — admins want post-mortem access to
          // anything that ever happened.
          listRecentEnded(0, 200).catch(() => ({ sessions: [], total: 0 })),
        ]);
        setRooms(live.rooms);
        setScheduled(sched.schedules);
        setEnded(recent.sessions);
        reloadRecoveryAttempted.current = false; // healthy again — re-arm for a future episode
      } catch (e) {
        if (e instanceof AdminUnauthorizedError) {
          if (reloadRecoveryAttempted.current) return; // one attempt per failure episode
          reloadRecoveryAttempted.current = true;
          ensureNcAdminToken().then((result) => {
            if (result.ok === true) {
              reload(background);
            }
          });
          return;
        }
        pushToast("error", (e as Error).message || "Failed to load");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pushToast],
  );

  // Page-level poll. Cleaned up on unmount — inside the Garage shell an
  // operator can switch dashboard type via the top-right pill without a
  // full page load, so a leaked interval here would keep hammering the
  // live-rooms endpoint from a page nobody is looking at.
  useEffect(() => {
    reload(false);
    const id = window.setInterval(() => reload(true), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [reload]);

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = rooms;
    if (q) {
      arr = arr.filter((r) => {
        const hay = [
          r.roomName,
          r.roomId ?? "",
          r.title ?? "",
          r.host?.name ?? "",
          r.host?.email ?? "",
          r.kind,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    const sorted = [...arr];
    if (sort === "newest") sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    if (sort === "oldest") sorted.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    if (sort === "participants") sorted.sort((a, b) => b.numParticipants - a.numParticipants);
    return sorted;
  }, [rooms, query, sort]);

  const totalParticipants = rooms.reduce((a, r) => a + r.numParticipants, 0);
  const recordingCount = rooms.filter((r) => r.isRecording).length;

  return (
    <div className="-mx-8 -mb-8 -mt-7 flex h-[calc(100vh-66px)] min-h-[600px] flex-col overflow-y-auto bg-[#080808] text-zinc-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Radio className="h-5 w-5 text-[#FFC200]" />
                {rooms.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                )}
              </div>
              <h1 className="text-lg font-semibold md:text-xl">Live Calls</h1>
              {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Monitor every ongoing NetworkChain call. Mute, ban, broadcast or end without joining.
            </p>
          </div>
          <button
            onClick={() => reload(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </header>

        {/* Stats strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={<Radio className="h-4 w-4" />}
            label="Active calls"
            value={rooms.length}
            accent="text-[#FFC200]"
            pulse={rooms.length > 0}
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Live participants"
            value={totalParticipants}
          />
          <StatCard
            icon={<Circle className="h-4 w-4 fill-current" />}
            label="Recording now"
            value={recordingCount}
            accent={recordingCount > 0 ? "text-red-400" : "text-zinc-400"}
          />
          <StatCard
            icon={<Calendar className="h-4 w-4" />}
            label="Scheduled (7d)"
            value={scheduled.length}
          />
        </div>

        {/* Tabs */}
        <div className="mb-4 flex items-center gap-1 border-b border-white/[0.06]">
          <TabBtn active={tab === "active"} onClick={() => setTab("active")}>
            <Radio className="h-3.5 w-3.5" />
            Active
            <span className="ml-1 rounded bg-white/[0.06] px-1.5 text-[10px]">
              {rooms.length}
            </span>
          </TabBtn>
          <TabBtn active={tab === "scheduled"} onClick={() => setTab("scheduled")}>
            <Calendar className="h-3.5 w-3.5" />
            Scheduled
            <span className="ml-1 rounded bg-white/[0.06] px-1.5 text-[10px]">
              {scheduled.length}
            </span>
          </TabBtn>
          <TabBtn active={tab === "ended"} onClick={() => setTab("ended")}>
            <History className="h-3.5 w-3.5" />
            Past sessions
            <span className="ml-1 rounded bg-white/[0.06] px-1.5 text-[10px]">
              {ended.length}
            </span>
          </TabBtn>
        </div>

        {tab === "active" && (
          <>
            {/* Sort */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative">
                <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="appearance-none rounded-lg border border-white/[0.06] bg-white/[0.02] py-1.5 pl-8 pr-3 text-xs text-zinc-100 focus:border-white/[0.15] focus:outline-none"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="participants">Most participants</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <EmptyState
                icon={<Radio className="h-8 w-8" />}
                title={query ? "No matches" : "No active calls"}
                body={query ? "Try a different search term." : "Everyone is offline. Pour a coffee."}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredRooms.map((r) => (
                  <RoomCard
                    key={r.roomName}
                    room={r}
                    onOpen={() =>
                      setSelectedRoom({ name: r.roomName, mode: "live" })
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "scheduled" && (
          <ScheduledTable schedules={scheduled} />
        )}

        {tab === "ended" && (
          <EndedTable
            sessions={ended}
            onOpen={(name) => setSelectedRoom({ name, mode: "ended" })}
          />
        )}
      </div>

      {selectedRoom && (
        <RoomDetailDrawer
          roomName={selectedRoom.name}
          mode={selectedRoom.mode}
          onClose={() => setSelectedRoom(null)}
          onEnded={() => {
            setSelectedRoom(null);
            reload(true);
          }}
          pushToast={pushToast}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-[#FFC200] text-white"
          : "border-transparent text-zinc-500 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent = "text-white",
  pulse = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent?: string;
  pulse?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500">
        <span className={pulse ? "animate-pulse" : ""}>{icon}</span>
        {label}
      </div>
      <div className={`text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] text-zinc-500">
        {icon}
      </div>
      <div className="text-sm font-medium text-zinc-200">{title}</div>
      <div className="mt-1 text-xs text-zinc-500">{body}</div>
    </div>
  );
}

function RoomCard({ room, onOpen }: { room: LiveRoomSummary; onOpen: () => void }) {
  useSecondTick(); // tick the duration counter
  return (
    <button
      onClick={onOpen}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-4 text-left transition-all hover:border-white/[0.14] hover:from-white/[0.05] hover:to-white/[0.02]"
    >
      {room.isRecording && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-red-300">
          <Circle className="h-2 w-2 animate-pulse fill-current" />
          REC
        </div>
      )}

      <div className="mb-2 flex items-start justify-between gap-2 pr-14">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">
            {room.title || room.roomId || room.roomName}
          </div>
          <div className="mt-0.5 truncate text-xs text-zinc-500">
            {room.host?.name || room.host?.email || "Unknown host"}
          </div>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <KindBadge kind={room.kind} />
        <span className="ml-auto inline-flex items-center gap-1 rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
          <Clock className="h-2.5 w-2.5" />
          {fmtDuration(room.createdAt)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {room.numParticipants}
        </span>
        <span className="inline-flex items-center gap-1">
          <Video className="h-3.5 w-3.5" />
          {room.numPublishers}
        </span>
        <span className="ml-auto text-[10px] text-zinc-600 group-hover:text-zinc-500">
          Started {fmtRel(room.createdAt)}
        </span>
      </div>

      <div className="mt-2 truncate text-[10px] text-zinc-700 group-hover:text-zinc-600">
        {room.roomName}
      </div>
    </button>
  );
}

function KindBadge({ kind }: { kind: LiveRoomSummary["kind"] }) {
  const map: Record<LiveRoomSummary["kind"], string> = {
    meet: "bg-emerald-500/15 text-emerald-300",
    office: "bg-sky-500/15 text-sky-300",
    webinar: "bg-purple-500/15 text-purple-300",
    other: "bg-white/[0.06] text-zinc-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${map[kind]}`}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      {kind.toUpperCase()}
    </span>
  );
}

function ScheduledTable({ schedules }: { schedules: AdminScheduledMeet[] }) {
  if (schedules.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="h-8 w-8" />}
        title="Nothing scheduled"
        body="No meets in the next 7 days."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-2">When</th>
            <th className="px-4 py-2">Title</th>
            <th className="px-4 py-2">Host</th>
            <th className="px-4 py-2">Duration</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {schedules.map((s) => (
            <tr key={s._id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-2 text-zinc-300">{fmtWhen(s.scheduledAt)}</td>
              <td className="px-4 py-2">{s.title}</td>
              <td className="px-4 py-2 text-zinc-400">
                {s.host?.name || s.host?.email || "—"}
              </td>
              <td className="px-4 py-2 text-zinc-400">{s.durationMinutes}m</td>
              <td className="px-4 py-2">
                {s.startedAt ? (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                    STARTED
                  </span>
                ) : (
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">
                    PENDING
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndedTable({
  sessions,
  onOpen,
}: {
  sessions: RecentEndedSession[];
  onOpen: (roomName: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-8 w-8" />}
        title="No past sessions yet"
        body="Any meet that ends will show up here."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-2">Ended</th>
            <th className="px-4 py-2">Room</th>
            <th className="px-4 py-2">Host</th>
            <th className="px-4 py-2">Duration</th>
            <th className="px-4 py-2">Peak</th>
            <th className="px-4 py-2">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {sessions.map((s) => (
            <tr
              key={s.roomName + s.endedAt}
              onClick={() => onOpen(s.roomName)}
              className="cursor-pointer hover:bg-white/[0.03]"
              title="Open recordings & transcript"
            >
              <td className="px-4 py-2 text-zinc-300">{fmtWhen(s.endedAt)}</td>
              <td className="px-4 py-2 truncate">{s.roomId}</td>
              <td className="px-4 py-2 text-zinc-400">
                {s.host?.name || s.host?.email || "—"}
              </td>
              <td className="px-4 py-2 text-zinc-400">
                {s.durationSeconds ? `${Math.round(s.durationSeconds / 60)}m` : "—"}
              </td>
              <td className="px-4 py-2 text-zinc-400">{s.peakParticipants}</td>
              <td className="px-4 py-2 text-zinc-500 text-xs">{s.closedReason || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────

function RoomDetailDrawer({
  roomName,
  mode,
  onClose,
  onEnded,
  pushToast,
}: {
  roomName: string;
  mode: "live" | "ended";
  onClose: () => void;
  onEnded: () => void;
  pushToast: (kind: "success" | "error" | "info", text: string) => void;
}) {
  const [detail, setDetail] = useState<
    LiveRoomDetail | EndedRoomDetail | null
  >(null);
  const [busy, setBusy] = useState<string>("");
  const [ending, setEnding] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [tab, setTab] = useState<"participants" | "settings" | "artifacts">(
    "participants",
  );
  const timerRef = useRef<number | null>(null);
  useSecondTick();

  const isLive = mode === "live";

  // Tracks whether this drawer instance is still the one the operator is
  // looking at. The drawer unmounts (rather than just hiding) when it
  // closes — selectedRoom flips to null in the parent and this component
  // stops rendering — so a plain mount/unmount ref is enough to stop a
  // queued re-elevation retry from firing a destructive write (mute/kick/
  // ban/end/broadcast/record) after the operator has moved on. Same
  // hazard, same fix shape, as the credit-wallet dialog guard in Task 14.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Independent fetches/mutations against this drawer each get their own
  // one-shot recovery guard so a 401 in one never consumes another's single
  // retry attempt. `action` is the shared dispatcher for every per-room
  // moderation control (mute/cam/kick/ban/mute-all/settings/recording), so
  // one guard covers that whole family — they all originate from the same
  // drawer "session" and a single re-elevation should serve all of them.
  const loadRecoveryAttempted = useRef(false);
  const actionRecoveryAttempted = useRef(false);
  const broadcastRecoveryAttempted = useRef(false);
  const endRecoveryAttempted = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = isLive
        ? await getLiveRoom(roomName)
        : await getEndedRoom(roomName);
      setDetail(d);
      loadRecoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (loadRecoveryAttempted.current) return; // one attempt per failure episode
        loadRecoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true && mountedRef.current) {
            load();
          }
        });
        return;
      }
      const msg = (e as Error).message;
      if (
        isLive &&
        msg &&
        msg.toLowerCase().includes("not currently active")
      ) {
        onEnded();
        return;
      }
      pushToast("error", msg || "Failed to load room");
    }
  }, [roomName, isLive, onEnded, pushToast]);

  // Detail poll — live rooms only. Cleaned up on unmount/close and whenever
  // `load`/`isLive` change, so this never keeps ticking against a room the
  // operator has closed the drawer on.
  useEffect(() => {
    load();
    if (isLive) {
      timerRef.current = window.setInterval(load, DETAIL_REFRESH_MS);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [load, isLive]);

  const action = async (key: string, run: () => Promise<unknown>, successMsg?: string) => {
    setBusy(key);
    try {
      await run();
      if (successMsg) pushToast("success", successMsg);
      await load();
      actionRecoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (actionRecoveryAttempted.current) return; // one attempt per failure episode
        actionRecoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          // Re-check on the far side of the elevation round-trip: if the
          // operator closed this drawer while we were waiting, do not fire
          // the retried mute/kick/ban/etc. against the room.
          if (result.ok === true && mountedRef.current) {
            action(key, run, successMsg);
          }
        });
        return;
      }
      pushToast("error", (e as Error).message || "Action failed");
    } finally {
      setBusy("");
    }
  };

  // Every control below — mute, mute-all, kick, ban, recording, broadcast,
  // room settings, end call — is a write, and contacts-backend refuses all of
  // them without "Full" on NC · Live Calls. A view-only grant keeps the whole
  // observability side (room list, participants, artifacts) and simply loses
  // the moderation affordances, including the Room controls tab.
  const { ready: accessReady, canManage } = useAdminAccess();
  const canModerate = accessReady && canManage("nc_live_calls");

  const onMute = (p: LiveParticipant, muted: boolean) =>
    action(
      `mute:${p.identity}`,
      () => muteLiveParticipant(roomName, p.identity, muted, "microphone"),
      muted ? `${p.name || "user"} muted` : `${p.name || "user"} unmuted`,
    );

  const onMuteCam = (p: LiveParticipant, muted: boolean) =>
    action(
      `cam:${p.identity}`,
      () => muteLiveParticipant(roomName, p.identity, muted, "camera"),
      muted ? "Camera off" : "Camera on",
    );

  const onKick = (p: LiveParticipant) => {
    if (!confirm(`Remove ${p.name || p.identity} from this call?`)) return;
    action(
      `kick:${p.identity}`,
      () => kickLiveParticipant(roomName, p.identity),
      "Participant removed",
    );
  };

  const onBan = (p: LiveParticipant) => {
    const reason = prompt(
      `Ban ${p.name || p.identity} from this room? They cannot rejoin.\n\nReason (optional):`,
    );
    if (reason === null) return;
    action(
      `ban:${p.identity}`,
      () => banLiveParticipant(roomName, p.identity, reason || undefined),
      "Participant banned",
    );
  };

  const onMuteAll = () => {
    if (!confirm("Force-mute everyone (including the host) in this room?")) return;
    action("mute-all", () => muteAllInRoom(roomName), "All mics muted");
  };

  const onSettings = (key: "allowUnmute" | "allowPresent", value: boolean) => {
    action(
      `set:${key}`,
      () => updateRoomSettings(roomName, { [key]: value }),
      `${key === "allowUnmute" ? "Unmute" : "Screen-share"} ${value ? "allowed" : "locked"}`,
    );
  };

  const onToggleRecording = () => {
    const isRec = !!detail?.room.recording;
    if (isRec) {
      if (!confirm("Stop the current recording?")) return;
      action("recording", () => stopRoomRecording(roomName), "Recording stopped");
    } else {
      action("recording", () => startRoomRecording(roomName), "Recording started");
    }
  };

  const doBroadcast = async (text: string) => {
    setBroadcasting(true);
    try {
      await broadcastToRoom(roomName, text);
      setBroadcastText("");
      pushToast("success", "Message broadcast to room");
      broadcastRecoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (broadcastRecoveryAttempted.current) {
          setBroadcasting(false); // one attempt per failure episode
          return;
        }
        broadcastRecoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true && mountedRef.current) {
            doBroadcast(text);
          } else {
            setBroadcasting(false);
          }
        });
        return;
      }
      pushToast("error", (e as Error).message || "Failed to broadcast");
      setBroadcasting(false);
    }
  };

  const onBroadcast = () => {
    const text = broadcastText.trim();
    if (!text) return;
    doBroadcast(text);
  };

  const doEnd = async () => {
    setEnding(true);
    try {
      await endLiveRoom(roomName);
      pushToast("success", "Call ended");
      endRecoveryAttempted.current = false; // healthy again — re-arm for a future episode
      onEnded();
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (endRecoveryAttempted.current) {
          setEnding(false); // one attempt per failure episode
          return;
        }
        endRecoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true && mountedRef.current) {
            doEnd();
          } else {
            setEnding(false);
          }
        });
        return;
      }
      pushToast("error", (e as Error).message || "Failed to end call");
      setEnding(false);
    }
  };

  const onEnd = () => {
    if (!confirm("End this call for EVERYONE? All participants will be disconnected.")) return;
    doEnd();
  };

  const session = detail?.room.session;
  const isRecording = !!detail?.room.recording;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
      />
      {/* Centered modal (was a right-side drawer). Mobile still uses a
          bottom sheet — a full-screen centered dialog on 4-inch phones
          doesn't buy anything and forces awkward keyboard behaviour on
          the broadcast input. Desktop / tablet gets the centered card. */}
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
        <aside
          className="flex w-full flex-col border-white/[0.06] bg-[#0c0c0c] text-zinc-100 shadow-2xl
            max-h-[92dvh] rounded-t-2xl border-t
            md:max-h-[86vh] md:max-w-3xl md:rounded-2xl md:border"
        >
        {/* Drag handle for mobile */}
        <div className="mx-auto mb-1 mt-2 h-1 w-10 rounded-full bg-white/10 md:hidden" />

        <header className="border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate">
                  {detail?.room.roomId || roomName}
                </span>
                {isRecording && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-red-300">
                    <Circle className="h-2 w-2 animate-pulse fill-current" />
                    Recording
                  </span>
                )}
                {!isLive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase text-zinc-400">
                    <History className="h-2 w-2" />
                    Ended
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate text-xs text-zinc-500">
                {roomName}
              </div>
              {detail?.room.createdAt && (
                <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-600">
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3" />
                    {isLive
                      ? fmtDuration(detail.room.createdAt)
                      : detail.room.durationSeconds
                        ? `${Math.round(
                            (detail.room.durationSeconds ?? 0) / 60,
                          )}m`
                        : "—"}
                  </span>
                  <span>
                    {detail.participants.length} participant
                    {detail.participants.length === 1 ? "" : "s"}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Company + host card — enriched from /admin/meet-manage.
              Two little chips so the admin sees at-a-glance WHOSE meet
              this is (task 1). Host chip has avatar / initial + name. */}
          {(detail?.room.organization || detail?.room.host) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {detail?.room.organization && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-200">
                  <Building2 className="h-3 w-3 text-[#FFC200]" />
                  {detail.room.organization.name}
                </span>
              )}
              {detail?.room.host && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-200">
                  {detail.room.host.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={detail.room.host.avatar}
                      alt=""
                      className="h-4 w-4 rounded-full object-cover"
                    />
                  ) : (
                    <UserIcon className="h-3 w-3 text-emerald-300" />
                  )}
                  {detail.room.host.name || detail.room.host.email || "Host"}
                </span>
              )}
            </div>
          )}
        </header>

        {/* Drawer tabs */}
        <div className="flex items-center gap-1 border-b border-white/[0.06] px-4">
          <DrawerTabBtn active={tab === "participants"} onClick={() => setTab("participants")}>
            <Users className="h-3.5 w-3.5" />
            Participants
          </DrawerTabBtn>
          <DrawerTabBtn active={tab === "artifacts"} onClick={() => setTab("artifacts")}>
            <Film className="h-3.5 w-3.5" />
            Recordings & notes
            {detail?.room.recordings && detail.room.recordings.length > 0 && (
              <span className="ml-1 rounded bg-white/[0.06] px-1.5 text-[9px]">
                {detail.room.recordings.length}
              </span>
            )}
          </DrawerTabBtn>
          {isLive && canModerate && (
            <DrawerTabBtn active={tab === "settings"} onClick={() => setTab("settings")}>
              <Settings2 className="h-3.5 w-3.5" />
              Room controls
            </DrawerTabBtn>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!detail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : tab === "participants" ? (
            <div className="px-5 py-4">
              {detail.participants.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-500">
                  {isLive ? "Room is empty." : "No participants recorded."}
                </p>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                      {detail.participants.length} {isLive ? "in room" : "attended"}
                    </span>
                    {isLive && canModerate && (
                      <button
                        onClick={onMuteAll}
                        disabled={busy === "mute-all"}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-zinc-200 hover:bg-white/[0.06] disabled:opacity-50"
                      >
                        {busy === "mute-all" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <VolumeX className="h-3 w-3" />
                        )}
                        Mute all
                      </button>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {isLive
                      ? (detail.participants as LiveParticipant[]).map((p) => (
                          <ParticipantRow
                            key={p.identity}
                            p={p}
                            busyKey={busy}
                            onMute={onMute}
                            onMuteCam={onMuteCam}
                            onKick={onKick}
                            onBan={onBan}
                            canModerate={canModerate}
                          />
                        ))
                      : (detail.participants as EndedRoomParticipant[]).map(
                          (p) => (
                            <HistoricalParticipantRow key={p.identity} p={p} />
                          ),
                        )}
                  </ul>
                </>
              )}
            </div>
          ) : tab === "artifacts" ? (
            <ArtifactsPanel detail={detail} />
          ) : (
            <div className="space-y-6 px-5 py-4">
              {/* Recording control */}
              <ControlBlock
                title="Recording"
                description={
                  isRecording
                    ? "This call is being recorded. Stop to finalize the file."
                    : "Start an S3 recording (720p speaker-dark layout)."
                }
              >
                <button
                  onClick={onToggleRecording}
                  disabled={busy === "recording"}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    isRecording
                      ? "bg-red-500/90 text-white hover:bg-red-500"
                      : "bg-white/[0.06] text-white hover:bg-white/[0.10]"
                  }`}
                >
                  {busy === "recording" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isRecording ? (
                    <Circle className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                  {isRecording ? "Stop recording" : "Start recording"}
                </button>
              </ControlBlock>

              {/* Broadcast */}
              <ControlBlock
                title="Broadcast to room"
                description="Send an on-screen system message to every participant."
              >
                <div className="space-y-2">
                  <textarea
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value.slice(0, 500))}
                    rows={2}
                    placeholder="Announcement…"
                    className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-white/[0.15] focus:outline-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-600">
                      {broadcastText.length}/500
                    </span>
                    <button
                      onClick={onBroadcast}
                      disabled={!broadcastText.trim() || broadcasting}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFC200]/90 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-[#FFC200] disabled:opacity-50"
                    >
                      {broadcasting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Broadcast
                    </button>
                  </div>
                </div>
              </ControlBlock>

              {/* Access control */}
              <ControlBlock
                title="Host access-control"
                description="Applies to non-host participants immediately."
              >
                <div className="space-y-2">
                  <Toggle
                    label="Allow participants to unmute themselves"
                    value={session?.allowUnmute ?? true}
                    disabled={busy === "set:allowUnmute" || !session}
                    onChange={(v) => onSettings("allowUnmute", v)}
                  />
                  <Toggle
                    label="Allow participants to share screen"
                    value={session?.allowPresent ?? true}
                    disabled={busy === "set:allowPresent" || !session}
                    onChange={(v) => onSettings("allowPresent", v)}
                  />
                </div>
              </ControlBlock>
            </div>
          )}
        </div>

        {/* Footer: end call — live rooms only, and only with Full access. */}
        {isLive && canModerate && (
          <footer className="border-t border-white/[0.06] px-5 py-4">
            <button
              onClick={onEnd}
              disabled={ending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/90 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
            >
              {ending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PhoneOff className="h-4 w-4" />
              )}
              End call for everyone
            </button>
          </footer>
        )}
        </aside>
      </div>
    </>
  );
}

function DrawerTabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-[#FFC200] text-white"
          : "border-transparent text-zinc-500 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function ControlBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h3>
      <p className="mt-0.5 mb-2 text-[11px] text-zinc-500">{description}</p>
      {children}
    </section>
  );
}

function Toggle({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs ${
        disabled ? "opacity-60" : "cursor-pointer hover:bg-white/[0.04]"
      }`}
    >
      <span className="flex items-center gap-2 text-zinc-200">
        {value ? (
          <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <VolumeX className="h-3.5 w-3.5 text-zinc-500" />
        )}
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          value ? "bg-emerald-500/80" : "bg-white/[0.08]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function ParticipantRow({
  p,
  busyKey,
  onMute,
  onMuteCam,
  onKick,
  onBan,
  canModerate,
}: {
  p: LiveParticipant;
  busyKey: string;
  onMute: (p: LiveParticipant, muted: boolean) => void;
  onMuteCam: (p: LiveParticipant, muted: boolean) => void;
  onKick: (p: LiveParticipant) => void;
  onBan: (p: LiveParticipant) => void;
  /** False for a view-only NC · Live Calls grant — render the row read-only. */
  canModerate: boolean;
}) {
  const micMuted = p.tracks.mic?.muted ?? true;
  const camMuted = p.tracks.camera?.muted ?? true;
  const hasScreen = !!p.tracks.screen;
  const initial = (p.name || p.identity).slice(0, 1).toUpperCase();

  return (
    <li className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200]/30 to-purple-500/30 text-xs font-semibold text-zinc-100">
          {p.isBot ? <Bot className="h-4 w-4 text-zinc-300" /> : initial}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium text-white">
              {p.name || p.identity}
            </span>
            {p.isHost && (
              <span className="rounded bg-[#FFC200]/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[#FFC200]">
                Host
              </span>
            )}
            {p.isBot && (
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-zinc-400">
                Bot
              </span>
            )}
            {hasScreen && (
              <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-sky-300">
                <Monitor className="h-2.5 w-2.5" /> Screen
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-zinc-500">{p.identity}</div>
        </div>

        {/* Read-only for a view-only grant: mic/camera state still shows in the
            row's own indicators, but nothing here can act on the room. */}
        {canModerate && (
        <div className="flex items-center gap-1">
          <IconAction
            active={!micMuted}
            iconOn={<Mic className="h-3.5 w-3.5" />}
            iconOff={<MicOff className="h-3.5 w-3.5" />}
            title={micMuted ? "Unmute" : "Mute mic"}
            busy={busyKey === `mute:${p.identity}`}
            disabled={p.isBot || !p.tracks.mic}
            onClick={() => onMute(p, !micMuted)}
          />
          <IconAction
            active={!camMuted}
            iconOn={<Video className="h-3.5 w-3.5" />}
            iconOff={<VideoOff className="h-3.5 w-3.5" />}
            title={camMuted ? "Camera on" : "Camera off"}
            busy={busyKey === `cam:${p.identity}`}
            disabled={p.isBot || !p.tracks.camera}
            onClick={() => onMuteCam(p, !camMuted)}
          />
          <button
            onClick={() => onKick(p)}
            disabled={busyKey === `kick:${p.identity}` || p.isBot}
            title="Remove"
            className="rounded p-1.5 text-zinc-400 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-40"
          >
            {busyKey === `kick:${p.identity}` ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserX className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => onBan(p)}
            disabled={busyKey === `ban:${p.identity}` || p.isBot}
            title="Ban (persistent)"
            className="rounded p-1.5 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-40"
          >
            {busyKey === `ban:${p.identity}` ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Ban className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        )}
      </div>
    </li>
  );
}

function IconAction({
  active,
  iconOn,
  iconOff,
  title,
  busy,
  disabled,
  onClick,
}: {
  active: boolean;
  iconOn: React.ReactNode;
  iconOff: React.ReactNode;
  title: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className={`rounded p-1.5 transition-colors disabled:opacity-40 ${
        active
          ? "text-emerald-300 hover:bg-emerald-500/20"
          : "text-zinc-500 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : active ? iconOn : iconOff}
    </button>
  );
}

// ── Historical participant (ended sessions) ──────────────────────────

function HistoricalParticipantRow({ p }: { p: EndedRoomParticipant }) {
  const initial = (p.name || p.identity).slice(0, 1).toUpperCase();
  return (
    <li className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200]/30 to-purple-500/30 text-xs font-semibold text-zinc-100">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium text-white">
              {p.name || p.identity}
            </span>
            {p.isHost && (
              <span className="rounded bg-[#FFC200]/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[#FFC200]">
                Host
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-zinc-500">
            {p.joinedAt ? new Date(p.joinedAt).toLocaleTimeString() : "?"}
            {p.leftAt
              ? ` → ${new Date(p.leftAt).toLocaleTimeString()}`
              : " → active"}
          </div>
        </div>
        {p.durationSeconds != null && (
          <span className="font-mono text-[10px] text-zinc-400">
            {Math.round(p.durationSeconds / 60)}m
          </span>
        )}
      </div>
    </li>
  );
}

// ── Artifacts (recordings + notes) ───────────────────────────────────

function formatBytes(n: number): string {
  if (!n) return "0";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function formatSecs(n: number): string {
  if (!n || n < 1) return "—";
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ArtifactsPanel({
  detail,
}: {
  detail: LiveRoomDetail | EndedRoomDetail;
}) {
  const recordings = detail.room.recordings ?? [];
  const notes = detail.room.notes ?? null;
  return (
    <div className="space-y-6 px-5 py-4">
      {/* Recordings — filter out obvious misfires (< 5s duration) so
          the admin doesn't stare at accidental 2-second stubs. */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Recordings
        </h3>
        <p className="mt-0.5 mb-2 text-[11px] text-zinc-500">
          Every recording ever captured for this room.
        </p>
        {recordings.length === 0 ? (
          <p className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-4 text-center text-xs text-zinc-500">
            No recordings yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {recordings.map((r) => {
              const isReady = r.status === "ready";
              const isTiny = r.duration > 0 && r.duration < 5;
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                >
                  <Film className="h-3.5 w-3.5 text-pink-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs text-zinc-200">
                        {r.displayName || r.filename}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                          r.status === "ready"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : r.status === "failed"
                              ? "bg-red-500/15 text-red-300"
                              : "bg-white/[0.06] text-zinc-400"
                        }`}
                      >
                        {r.status}
                      </span>
                      {isTiny && (
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-zinc-500">
                          misfire
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-500">
                      {formatSecs(r.duration)} · {formatBytes(r.size)} ·{" "}
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {isReady && (
                    <button
                      type="button"
                      onClick={async () => {
                        // Read-only download link. A 401 here is recovered
                        // with a single bounded retry (no persisted ref
                        // needed — this closure runs at most twice per
                        // click); anything else is swallowed, matching the
                        // original page's behavior for non-auth errors.
                        try {
                          const { url } = await getAdminRecordingUrl(r.id);
                          window.open(url, "_blank", "noopener,noreferrer");
                        } catch (err) {
                          if (err instanceof AdminUnauthorizedError) {
                            const result = await ensureNcAdminToken();
                            if (result.ok === true) {
                              try {
                                const { url } = await getAdminRecordingUrl(r.id);
                                window.open(url, "_blank", "noopener,noreferrer");
                              } catch {
                                // one retry only — swallow, as above.
                              }
                            }
                          }
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-pink-500/15 border border-pink-500/30 px-2 py-1 text-[10px] text-pink-400 hover:bg-pink-500/25"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Note-taker transcript / summary. Chat itself isn't persisted on
          the LiveKit server — the note-taker's transcript is the closest
          "in-meeting text" we can surface here. */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Transcript & notes
        </h3>
        <p className="mt-0.5 mb-2 text-[11px] text-zinc-500">
          Note-taker output — transcript + AI summary (when the bot was
          enabled).
        </p>
        {!notes ? (
          <p className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-4 text-center text-xs text-zinc-500">
            Note-taker did not run for this meeting.
          </p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <FileText className="h-3.5 w-3.5 text-emerald-300" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-200">
                    Note session
                  </span>
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-zinc-400">
                    {notes.status}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-zinc-500 font-mono">
                  {notes.id}
                </div>
              </div>
              {notes.transcriptId && (
                <a
                  href={`/meet/copilot/${notes.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/25"
                >
                  Open
                </a>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
