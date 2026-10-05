"use client"

/**
 * TIME ESTIMATE & TRACK TIME — ClickUp-style
 * Updated API integration:
 *   POST   /taskroomv2/v2/tasks/time/tracks
 *   PUT    /taskroomv2/v2/tasks/time/tracks/:id
 *   GET    /taskroomv2/v2/tasks/:id/time/logs   ← fetch entries list
 *   DELETE /taskroomv2/v2/tasks/time/tracks/:id
 *
 * - startTime / endTime sent as epoch milliseconds
 * - No localStorage used (except auth token)
 * - If user forgot to stop, API returns the startTime; we resume from that
 * - Stop = PUT endTime as Date.now() (user's local epoch ms)
 */

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Timer, Clock, Plus, X, Check,Loader2,
  Play, Square, Edit2, AlignLeft, ChevronRight, Trash2, User, Calendar
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TimeEntry {
  _id: string
  userId?: string
  userName?: string
  startTime: number      // epoch ms
  endTime: number | null // epoch ms, null = still running
  duration: number       // seconds
  comment: string
  tags: string[]
  createdAt?: string
  timePeriod?: number
  [key: string]: any
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert "1h 30m" / "2h" / "45m" / "90" (minutes) → seconds */
export function parseEstimateInput(raw: string): number | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null
  const hm = s.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/)
  if (hm && (hm[1] || hm[2])) {
    return (parseInt(hm[1] || "0") * 3600) + (parseInt(hm[2] || "0") * 60)
  }
  const mins = s.match(/^(\d+)$/)
  if (mins) return parseInt(mins[1]) * 60
  return null
}

/** seconds → "1h 30m" display */
export function fmtSeconds(sec: number): string {
  if (!sec || sec <= 0) return "0m"
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  if (m > 0 && s > 0) return `${m}m ${s}s`
  if (m > 0) return `${m}m`
  return `${s}s`
}

/** ms-delta → "1h 30m 05s" live clock */
function fmtElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

/** epoch ms → "Jun 14, 2:30 PM" using user's local timezone */
function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true
  })
}

/** Generate a consistent avatar bg color from a string */
function avatarColor(name: string): string {
  const colors = [
    "bg-indigo-500/30 border-indigo-500/40 text-indigo-300",
    "bg-violet-500/30 border-violet-500/40 text-violet-300",
    "bg-brand/30 border-emerald-500/40 text-emerald-300",
    "bg-amber-500/30 border-amber-500/40 text-amber-300",
    "bg-rose-500/30 border-rose-500/40 text-rose-300",
    "bg-sky-500/30 border-sky-500/40 text-sky-300",
    "bg-pink-500/30 border-pink-500/40 text-pink-300",
    "bg-teal-500/30 border-teal-500/40 text-teal-300",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

// ─── API base ─────────────────────────────────────────────────────────────────
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? ""
const API = `${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks/time/tracks`
const LOGS = (taskId: string) => `${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks/${taskId}/time/logs`

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TIME ESTIMATE
// ═════════════════════════════════════════════════════════════════════════════

interface TimeEstimateProps {
  cardId: string
  initialEstimate?: number
  onSave?: (seconds: number | null) => Promise<void>
  isReadOnly?: boolean
}

export function TimeEstimate({ initialEstimate, onSave, isReadOnly }: TimeEstimateProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [estimate, setEstimate] = useState<number | null>(initialEstimate ? initialEstimate * 60 : null)
  console.log("initialEstimate", initialEstimate)
  useEffect(() => {
    setEstimate(initialEstimate ? initialEstimate * 60 : null)
  }, [initialEstimate])
  const [saving, setSaving] = useState(false)

  const presets = [
    { label: "30m", sec: 30 * 60 },
    { label: "1h", sec: 3600 },
    { label: "2h", sec: 7200 },
    { label: "4h", sec: 4 * 3600 },
    { label: "1d", sec: 8 * 3600 },
  ]

  const handleSave = async (sec: number | null) => {
    if (saving) return
    setSaving(true)
    try {
      const minutes = sec !== null ? Math.floor(sec / 60) : null
      await onSave?.(minutes)
      setEstimate(sec)
      setOpen(false)
      setInput("")
    } catch {
      toast.error("Failed to save estimate")
    } finally {
      setSaving(false)
    }
  }

  const handleInputSave = async () => {
    if (!input.trim()) { await handleSave(null); return }
    const sec = parseEstimateInput(input)
    if (sec === null) { toast.error("Use format like '2h 30m', '1h', '45m'"); return }
    await handleSave(sec)
  }

  return (
    <div className="flex items-center py-2 rounded hover:bg-white/[0.03] transition group">
      <div className="flex items-center gap-2 w-40 shrink-0 text-sm text-white">
        <Timer className="w-3.5 h-3.5" />
        <span>Time estimate</span>
      </div>

      <Popover open={open} onOpenChange={(v) => { if (!isReadOnly) setOpen(v) }}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/70 transition"
            disabled={isReadOnly || saving}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white/10 animate-pulse">
                <span className="h-2 w-16 rounded bg-white/20" />
              </span>
            ) : estimate ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#0a0a0d] border border-[#e5e7eb29] text-white/70 font-medium">
                <Timer className="w-3 h-3 text-brand" />
                {fmtSeconds(estimate)}
              </span>
            ) : (
              <span className="text-white/30 hover:text-white/50">Empty</span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="bottom" align="start" sideOffset={6}
          className="w-72 p-0 bg-[#0a0a0d]  border border-[#e5e7eb29] shadow-2xl rounded-lg"
        >
          <div className="p-3 border-b border-[#e5e7eb29]">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Time Estimate</p>
            <div className="flex gap-1.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInputSave()}
                placeholder="e.g. 2h 30m"
                className="flex-1 bg-[#0a0a0d] border border-[#e5e7eb29] rounded px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-brand/60 placeholder-white/50"
                autoFocus
              />
              <button
                onClick={handleInputSave}
                disabled={saving}
                className="px-3 py-1.5 bg-brand hover:bg-brand text-brand-foreground rounded text-sm font-medium transition disabled:opacity-50"
              >
                {saving ? "…" : "Set"}
              </button>
            </div>
            <p className="text-[11px] text-white/30 mt-1.5">Format: 2h 30m · 1h · 45m · 90 (=90m)</p>
          </div>

          <div className="p-3">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">Quick presets</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => handleSave(p.sec)}
                  className="px-3 py-1 bg-[#0a0a0d] hover:bg-[#2e2e3e] border border-[#e5e7eb29] rounded text-sm text-white/60 hover:text-white/80 transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {estimate && (
            <div className="px-3 pb-3">
              <button
                onClick={() => handleSave(null)}
                className="w-full text-sm text-red-400/70 hover:text-red-400 transition py-1.5 border border-red-500/20 hover:border-red-500/40 rounded"
              >
                Clear estimate
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// USER LOG GROUP ITEM (Handles Infinite Scroll per user)
// ═════════════════════════════════════════════════════════════════════════════

function UserLogGroupItem({ 
  group, 
  taskId, 
  isExpanded, 
  onToggle, 
  isReadOnly, 
  onDelete 
}: { 
  group: any; 
  taskId: string; 
  isExpanded: boolean; 
  onToggle: () => void; 
  isReadOnly?: boolean; 
  onDelete: (logId: string) => void; 
}) {
  const user = group.userData;
  const userId = user?._id || "unknown";
  const initials = user?.name ? user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "?";
  const colorClass = user?.name ? avatarColor(user.name) : "bg-white/10 text-white/40";
  const totalSec = (group.totalTimePeriod || 0) * 60;

  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<any[]>(group.logsData || []);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (page === 1) {
      setLogs(group.logsData || []);
      setHasMore((group.totalCount || 0) > (group.logsData?.length || 0));
    }
  }, [group.logsData, group.totalCount, page]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const url = `${process.env.NEXT_PUBLIC_TASKROOM_URL || 'https://uatapi.garage.app/taskroomv2/v2/'}tasks/${taskId}/user/${userId}/time/logs?size=10&page=${nextPage}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch more logs");
      const json = await res.json();
      const pageLogs = Array.isArray(json?.data?.data)
        ? json?.data?.data
        : Array.isArray(json?.data)
          ? json.data
          : [];
      if (json.status && pageLogs.length > 0) {
        setLogs(prev => [...prev, ...pageLogs]);
        setPage(nextPage);
        const totalPages = json.metadata?.totalPages || json.data?.metadata?.totalPages || 1;
        setHasMore(nextPage < totalPages);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error(e);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [page, hasMore, loadingMore, taskId, userId]);

  useEffect(() => {
    if (!isExpanded || !hasMore) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    }, { threshold: 0.1 });

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
    return () => observer.disconnect();
  }, [isExpanded, hasMore, loadMore]);

  return (
    <div className="group/user-section">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition group/user-row"
      >
        <div className="flex items-center gap-3">
          <ChevronRight className={`w-3.5 h-3.5 white/50 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          <div className={`w-6 h-6 rounded-full border border-white/10 flex items-center justify-center shrink-0 text-[10px] font-bold ${colorClass}`}>
            {initials}
          </div>
          <span className="text-sm font-semibold text-white/70 group-hover/user-row:text-white transition">{user?.name}</span>
        </div>
        <span className="text-xs font-bold text-white/40 group-hover/user-row:text-white/60">{fmtSeconds(totalSec)}</span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          {logs.map((log: any) => {
            const logSec = (log.timePeriod ?? 0) * 60;
            return (
              <div key={log._id} className="ml-7 bg-white/[0.03] border border-white/[0.05] rounded-lg p-3 group/log relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-white/50 leading-none">
                        {fmtDateTime(log.startTime)} – {log.endTime ? fmtDateTime(log.endTime).split(", ").pop() : "now"}
                      </span>
                      <Clock className="w-3 h-3 white/50" />
                    </div>

                    {log.comment && (
                      <div className="flex items-start gap-1.5 pt-0.5">
                        <AlignLeft className="w-3 h-3 white/50 mt-0.5 shrink-0" />
                        <p className="text-xs text-white/40 line-clamp-2 italic">“{log.comment}”</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-bold text-white/60">{fmtSeconds(logSec)}</span>
                    {!isReadOnly && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(log._id); }}
                        className="p-1.5 rounded-md hover:bg-red-500/10 white/50 hover:text-red-400/80 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <div ref={sentinelRef} className="py-2 flex justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-white/30" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TRACK TIME
// ═════════════════════════════════════════════════════════════════════════════

interface TrackTimeProps {
  cardId: string
  roomId: string
  userId?: string
  /** If a timer is currently running server-side, pass the open entry here */
  runningEntry?: TimeEntry | null
  onEntriesChange?: (entries: TimeEntry[]) => void
  isReadOnly?: boolean
  estimate?: number  // minutes from API, for % bar
}

export function TrackTime({
  cardId,
  roomId,
  runningEntry,
  onEntriesChange,
  isReadOnly,
  estimate,
}: TrackTimeProps) {
  const [open, setOpen] = useState(false)

  // ── Entries — fetched from GET /tasks/:id/time/logs ───────────────────────
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)

  /**
   * activeEntry: the currently-running server entry (endTime === null).
   * Seeded from `runningEntry` prop so if user left without stopping,
   * the API's startTime is used to continue the duration.
   */
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(runningEntry ?? null)
  const [elapsed, setElapsed] = useState(0)  // ms since activeEntry.startTime

  const [noteInput, setNoteInput] = useState("")
  const [isBillable, setIsBillable] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualStart, setManualStart] = useState("")
  const [manualEnd, setManualEnd] = useState("")
  const [manualNote, setManualNote] = useState("")
  const [manualTags, setManualTags] = useState("")

  const [addNoteOpen, setAddNoteOpen] = useState<string | null>(null)
  const [addNoteValue, setAddNoteValue] = useState("")

  const [saving, setSaving] = useState(false)
  const [stopping, setStopping] = useState(false)

  const [userGroups, setUserGroups] = useState<any[]>([])
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({})

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch time logs when popover opens or cardId changes ──────────────────
  const fetchLogs = useCallback(async () => {
    if (!cardId) return
    setLoadingEntries(true)
    try {
      const res = await fetch(LOGS(cardId), { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to fetch time logs")
      const json = await res.json()

      if (json.status && json.data) {
        const { activeTimeLog, timeLogData } = json.data

        // 1. Handle grouped data directly
        const groups = Array.isArray(timeLogData) ? timeLogData : (timeLogData ? [timeLogData] : [])
        setUserGroups(groups)

        // 2. Flatten for legacy/totals
        let allMappedLogs: TimeEntry[] = []
        groups.forEach(group => {
          const uName = group.userData?.name
          const logs = (group.logsData || []).map((l: any) => ({
            ...l,
            userName: uName || l.userName,
            duration: (l.timePeriod ?? 0) * 60 || l.duration || 0
          }))
          allMappedLogs = [...allMappedLogs, ...logs]
        })

        setEntries(allMappedLogs)
        onEntriesChange?.(allMappedLogs)

        // 3. Handle Active Timer
        if (activeTimeLog) {
          let activeUserName = ""
          activeUserName = groups.find(g => g.userData?._id === activeTimeLog.userId)?.userData?.name || ""

          setActiveEntry({
            ...activeTimeLog,
            userName: activeUserName || activeTimeLog.userName,
            duration: 0,
            endTime: null
          })
        } else {
          setActiveEntry(null)
        }
      }
    } catch (err) {
      console.error("fetchLogs error:", err)
      toast.error("Could not load time logs")
    } finally {
      setLoadingEntries(false)
    }
  }, [cardId, onEntriesChange])

  useEffect(() => {
    fetchLogs()
  }, [])

  // ── Tick: count elapsed from activeEntry.startTime ──────────────────────
  useEffect(() => {
    if (activeEntry) {
      const tick = () => setElapsed(Date.now() - activeEntry.startTime)
      tick()
      tickRef.current = setInterval(tick, 1000)
    } else {
      setElapsed(0)
      if (tickRef.current) clearInterval(tickRef.current)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [activeEntry])

  // ── Sync runningEntry prop changes (e.g. parent re-fetches) ─────────────
  useEffect(() => {
    if (runningEntry && !activeEntry) setActiveEntry(runningEntry)
  }, [runningEntry])

  const pushEntries = (next: TimeEntry[]) => {
    setEntries(next)
    onEntriesChange?.(next)
  }

  // ── Start timer ──────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (isReadOnly || activeEntry) return
    const startTime = Date.now()
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          comment: noteInput.trim(),
          tags: [],
          taskId: cardId,
          roomId,
          startTime,
          isBillable,
        }),
      })
      if (!res.ok) throw new Error("Failed to start timer")
      const data: TimeEntry = await res.json()
      setActiveEntry({ ...data?.data, startTime, endTime: null, duration: 0, isBillable })
      setNoteInput("")
      setIsBillable(false)
    } catch {
      toast.error("Could not start timer")
    }
  }
  // ── Stop timer ───────────────────────────────────────────────────────────
  const handleStop = async () => {
    if (!activeEntry || stopping) return
    setStopping(true)
    const endTime = Date.now()
    const duration = Math.floor((endTime - activeEntry.startTime) / 1000)
    try {
      const res = await fetch(`${API}/${activeEntry._id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          comment: activeEntry.comment,
          tags: activeEntry.tags ?? [],
          endTime,
        }),
      })
      if (!res.ok) throw new Error("Failed to stop timer")
      const completed: TimeEntry = { ...activeEntry, endTime, duration }
      pushEntries([completed, ...entries])
      setActiveEntry(null)
      fetchLogs()
      toast.success(`Tracked ${fmtSeconds(duration)}`)
    } catch {
      toast.error("Could not stop timer")
    } finally {
      setStopping(false)
    }
  }

  // ── Delete entry ──────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this time entry?")) return
    try {
      await fetch(`${API}/${id}`, { method: "DELETE", headers: authHeaders() })
      pushEntries(entries.filter(e => e._id !== id))
      fetchLogs()
    } catch {
      toast.error("Could not delete entry")
    }
  }

  // ── Update note on existing entry ─────────────────────────────────────────
  const handleUpdateNote = async (id: string) => {
    const entry = entries.find(e => e._id === id)
    if (!entry) return
    try {
      await fetch(`${API}/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          comment: addNoteValue,
          tags: entry.tags ?? [],
          endTime: entry.endTime,
        }),
      })
      pushEntries(entries.map(e => e._id === id ? { ...e, comment: addNoteValue } : e))
      setAddNoteOpen(null)
      setAddNoteValue("")
    } catch {
      toast.error("Could not update note")
    }
  }

  // ── Add manual entry ──────────────────────────────────────────────────────
  const handleAddManual = async () => {
    if (!manualStart || !manualEnd) { toast.error("Start and end required"); return }
    const startEpoch = new Date(manualStart).getTime()
    const endEpoch = new Date(manualEnd).getTime()
    if (isNaN(startEpoch) || isNaN(endEpoch)) { toast.error("Invalid date/time"); return }
    if (endEpoch <= startEpoch) { toast.error("End must be after start"); return }
    const duration = Math.floor((endEpoch - startEpoch) / 1000)
    const tags = manualTags.trim() ? manualTags.split(",").map(t => t.trim()).filter(Boolean) : []
    setSaving(true)
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          comment: manualNote.trim(),
          tags,
          taskId: cardId,
          roomId,
          startTime: startEpoch,
          endTime: endEpoch,
        }),
      })
      if (!res.ok) throw new Error("Failed to add entry")
      const created: TimeEntry = await res.json()
      pushEntries([{ ...created, startTime: startEpoch, endTime: endEpoch, duration }, ...entries])
      setManualOpen(false)
      setManualStart(""); setManualEnd(""); setManualNote(""); setManualTags("")
      toast.success(`Added ${fmtSeconds(duration)}`)
    } catch {
      toast.error("Could not add time entry")
    } finally {
      setSaving(false)
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const trackedSec = entries.reduce((s, e) => s + (e.duration || 0), 0)
  const totalTracked = trackedSec + (activeEntry ? Math.floor(elapsed / 1000) : 0)
  const estimateSec = estimate ? estimate * 60 : null
  const pct = estimateSec && estimateSec > 0 ? Math.min((totalTracked / estimateSec) * 100, 100) : null

  return (
    <div className="flex items-center py-2 rounded hover:bg-white/[0.03] transition group">
      <div className="flex items-center gap-2 w-40 shrink-0 text-sm text-white">
        <Clock className="w-3.5 h-3.5" />
        <span>Track time</span>
      </div>

      <Popover open={open} onOpenChange={(v) => { if (!isReadOnly || !v) setOpen(v) }}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/70 transition"
            disabled={loadingEntries || (isReadOnly && !activeEntry)}
          >
            {loadingEntries ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white/10 animate-pulse">
                <span className="h-2 w-16 rounded bg-white/20" />
              </span>
            ) : activeEntry ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs font-semibold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                {fmtElapsed(elapsed)}
              </span>
            ) : totalTracked > 0 ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0a0a0d] border border-[#e5e7eb29] text-white/70 font-medium text-xs">
                <Clock className="w-3 h-3 text-emerald-400" />
                {fmtSeconds(totalTracked)}
                {pct !== null && (
                  <span className={`ml-0.5 ${pct >= 100 ? "text-red-400" : "text-white/40"}`}>
                    ({Math.round(pct)}%)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-white/30 hover:text-white/50">Empty</span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="bottom" align="start" sideOffset={6}
          className="w-[360px] p-0 bg-[#0a0a0d] border border-[#e5e7eb29] shadow-2xl rounded-lg overflow-hidden"
          onInteractOutside={(e) => {
            if (addNoteOpen || manualOpen) e.preventDefault()
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#e5e7eb29] flex items-center justify-between bg-[#0a0a0d]">
            <span className="text-sm font-semibold text-white/70">Time Tracked</span>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span>Total: <span className="text-white/70 font-mono">{fmtSeconds(totalTracked)}</span></span>
              {estimateSec && (
                <span>Est: <span className="text-white/70 font-mono">{fmtSeconds(estimateSec)}</span></span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {estimateSec && estimateSec > 0 && (
            <div className="px-4 pt-3">
              <div className="w-full bg-[#0a0a0d] rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${pct! >= 100 ? "bg-red-500" : "bg-brand"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-white/30">
                <span>{fmtSeconds(totalTracked)} tracked</span>
                <span>{pct !== null ? `${Math.round(pct)}%` : ""}</span>
              </div>
            </div>
          )}

          {/* Timer controls */}
          {!isReadOnly && (
            <div className="px-4 py-3 border-b border-[#e5e7eb29]">
              {activeEntry ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-[#0a0a0d] rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="font-mono text-lg font-bold text-white/90">{fmtElapsed(elapsed)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-white/30">{fmtDateTime(activeEntry.startTime)}</span>
                      <button
                        onClick={handleStop}
                        disabled={stopping}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold transition disabled:opacity-50"
                      >
                        <Square className="w-3 h-3 fill-white" />
                        {stopping ? "…" : "Stop"}
                      </button>
                    </div>
                  </div>
                  {activeEntry.comment && (
                    <div className="flex items-center gap-1.5 text-xs text-white/40 px-1">
                      <AlignLeft className="w-3 h-3" />
                      <span className="truncate">{activeEntry.comment}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Note (optional)"
                      onKeyDown={(e) => e.key === "Enter" && handleStart()}
                      className="flex-1 bg-[#0a0a0d] border border-[#e5e7eb29] rounded px-3 py-1.5 text-sm placeholder:text-sm white/50 focus:outline-none"
                    />
                    <button
                      onClick={handleStart}
                      className="flex items-center gap-1 px-3 py-1.5 bg-brand hover:bg-brand text-brand-foreground rounded text-sm font-semibold transition whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5 fill-black" />
                      Start
                    </button>
                  </div>
                  <label className="flex items-center gap-2 px-0.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isBillable}
                      onChange={(e) => setIsBillable(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-[#e5e7eb29] bg-[#0a0a0d] accent-brand cursor-pointer"
                    />
                    <span className="text-xs text-white/50">Billable</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Manual add */}
          {!isReadOnly && (
            <div className="border-b border-[#e5e7eb29]">
              <button
                onClick={() => setManualOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.02] transition"
              >
                <span className="flex items-center gap-1.5"><Plus className="w-3 h-3" /> Add time manually</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${manualOpen ? "rotate-90" : ""}`} />
              </button>
              {manualOpen && (
                <div className="px-4 pb-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Start</label>
                      <div className="relative">
                        <input
                          type="datetime-local"
                          value={manualStart}
                          onChange={(e) => setManualStart(e.target.value)}
                          className="w-full bg-[#0a0a0d] border border-[#e5e7eb29] rounded pl-2 pr-8 py-1.5 text-xs text-white/70 focus:outline-none focus:border-brand/50 [color-scheme:dark]"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            const input = (e.currentTarget.previousElementSibling as HTMLInputElement | null)
                            if (!input) return
                            if (typeof input.showPicker === "function") input.showPicker()
                            else input.focus()
                          }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-white/40 hover:text-white/70 transition"
                          aria-label="Open start date picker"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">End</label>
                      <div className="relative">
                        <input
                          type="datetime-local"
                          value={manualEnd}
                          onChange={(e) => setManualEnd(e.target.value)}
                          className="w-full bg-[#0a0a0d] border border-[#e5e7eb29] rounded pl-2 pr-8 py-1.5 text-xs text-white/70 focus:outline-none focus:border-brand/50 [color-scheme:dark]"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            const input = (e.currentTarget.previousElementSibling as HTMLInputElement | null)
                            if (!input) return
                            if (typeof input.showPicker === "function") input.showPicker()
                            else input.focus()
                          }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-white/40 hover:text-white/70 transition"
                          aria-label="Open end date picker"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <input
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="w-full bg-[#0a0a0d] border border-[#e5e7eb29] rounded px-3 py-1.5 text-sm text-white/70 focus:outline-none focus:border-brand/50 placeholder-white/50"
                  />
                  <input
                    value={manualTags}
                    onChange={(e) => setManualTags(e.target.value)}
                    placeholder="Tags (comma separated, optional)"
                    className="w-full bg-[#0a0a0d] border border-[#e5e7eb29] rounded px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-brand/50 placeholder-white/50"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setManualOpen(false)}
                      className="text-xs text-white/30 hover:text-white/50 px-2 py-1 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddManual}
                      disabled={saving}
                      className="text-xs bg-brand hover:bg-brand text-brand-foreground px-3 py-1 rounded font-medium transition disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Add"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Entries list grouped by user */}
          <div className="max-h-[200px] overflow-y-auto">
            <div className="px-4 py-2 bg-white/[0.02] border-b border-[#e5e7eb14]">
              <span className="text-[11px] font-bold text-white/30 uppercase tracking-widest">Time Entries</span>
            </div>

            {loadingEntries ? (
              <div className="py-4 px-4 space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="animate-pulse space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/10" />
                      <div className="h-3 w-24 bg-white/10 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : userGroups.length === 0 ? (
              <div className="py-8 text-center white/50 text-sm">No time entries yet</div>
            ) : (
              <div className="divide-y divide-[#e5e7eb0d]">
                {userGroups.map((group) => {
                  const user = group.userData;
                  const userId = user?._id || "unknown";
                  return (
                    <UserLogGroupItem 
                      key={userId}
                      group={group}
                      taskId={cardId}
                      isExpanded={!!expandedUsers[userId]}
                      onToggle={() => setExpandedUsers(prev => ({ ...prev, [userId]: !expandedUsers[userId] }))}
                      isReadOnly={isReadOnly}
                      onDelete={handleDelete}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}