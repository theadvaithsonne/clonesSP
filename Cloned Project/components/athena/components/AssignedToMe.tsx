"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import Cookies from "js-cookie"
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { useUserStore } from "@/store/athena/userStore"
import { useCardStore } from "@/store/athena/cardStore"
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace"
import { CardModal, type RoomContext } from "./card-modal"
import { transformCard, type Card } from "./Dashbaord"

const TASKROOM_BASE = (
  process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/"
).replace(/\/+$/, "") + "/"

const PAGE_SIZE = 30
const PICKER_PAGE_SIZE = 10
const WORKSPACE_LOOKUP_SIZE = 100
const WORKSPACE_LOOKUP_MAX_PAGES = 5
const SEARCH_DEBOUNCE_MS = 400

/** Desktop list columns: Task | Source | Stage | Priority | Due date */
const ROW_GRID =
  "md:grid md:grid-cols-[minmax(180px,2fr)_minmax(140px,1.5fr)_150px_90px_100px] md:items-center md:gap-3"

const STATUS_OPTIONS: PickerItem[] = [
  { _id: "active", name: "Active" },
  { _id: "inactive", name: "Inactive" },
]

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#facc15",
  normal: "#60a5fa",
  low: "#94a3b8",
}

/** What differs between the Assigned and All tabs; everything else is the same list. */
type TaskListScope = "assigned" | "all"
const SCOPES: Record<
  TaskListScope,
  {
    title: string
    subtitle: string
    empty: string
    noun: string
    icon: typeof UserCheck
    path: (userId: string) => string
    params: Record<string, string>
  }
> = {
  assigned: {
    title: "Assigned To Me",
    subtitle: "Tasks assigned to you across all workspaces",
    empty: "No tasks are assigned to you yet",
    noun: "assigned tasks",
    icon: UserCheck,
    path: userId => `tasks/user/${encodeURIComponent(userId)}/assigned`,
    params: {},
  },
  all: {
    title: "All Tasks",
    subtitle: "Tasks assigned to you or created by you across all workspaces",
    empty: "You don't have any tasks yet",
    noun: "tasks",
    icon: ClipboardList,
    path: () => "tasks/me",
    // Always "all" (assigned to me OR created by me) — not user-selectable.
    params: { type: "all" },
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────
type PickerItem = { _id: string; name: string; color?: string }
type PickerPage = { items: PickerItem[]; hasMore: boolean }
type Selected = { id: string; name: string } | null

type ListMetadata = { count: number | null; totalPages: number; currentPage: number }

type AssignedTask = {
  id: string
  title: string
  workspaceId: string
  spaceId: string
  roomId: string
  stageId: string
  stageName: string
  stageColor: string
  workspaceName: string
  spaceName: string
  roomName: string
  priority: string
  dueDate: number | null
  isCompleted: boolean
}

/** A task opened in the edit modal, plus where it lives. */
type OpenTask = { card: Card; roomId: string; context: RoomContext }

// ─── API helpers ──────────────────────────────────────────────────────────────
function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** `$lookup` results arrive as one-element arrays; populated refs as objects. */
function asObject(v: unknown): Record<string, any> | null {
  const o = Array.isArray(v) ? v[0] : v
  return o && typeof o === "object" ? (o as Record<string, any>) : null
}

function refId(v: unknown): string {
  const o = asObject(v)
  if (o) return String(o._id ?? o.id ?? "")
  return v == null ? "" : String(v)
}

function extractRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.data)) return payload.data.data
  if (Array.isArray(payload?.data?.tasks)) return payload.data.tasks
  return []
}

function extractMetadata(payload: any, page: number, rowCount: number): ListMetadata {
  const meta = payload?.metadata ?? payload?.data?.metadata
  if (meta && typeof meta === "object") {
    const count = Number(meta.count)
    return {
      count: Number.isFinite(count) ? count : null,
      totalPages: Math.max(1, Number(meta.totalPages) || 1),
      currentPage: Math.max(1, Number(meta.currentPage) || page),
    }
  }
  // Without metadata, only offer "next" when a full page came back.
  return { count: null, totalPages: rowCount === PAGE_SIZE ? page + 1 : page, currentPage: page }
}

function hasMorePages(payload: any, page: number, itemCount: number) {
  const meta = payload?.metadata
  if (meta && meta.nextPage !== undefined) return meta.nextPage != null
  if (meta && meta.totalPages != null) return page < Number(meta.totalPages)
  return itemCount === PICKER_PAGE_SIZE
}

/**
 * tasks/user/:userId/assigned and tasks/me return the same row shape: stageId, roomId and spaceId
 * populated ({ _id, name, … }) but workspaceId as a bare id, so the workspace name is resolved
 * separately (fetchWorkspaceNames). Ids or populated refs are both accepted in case that changes.
 */
function mapAssignedTask(raw: any): AssignedTask {
  const task = asObject(raw?.task) ?? asObject(raw?.taskDetails) ?? raw ?? {}
  const stage = asObject(task.stageData) ?? asObject(task.stageId) ?? asObject(raw?.stageData)
  const room = asObject(task.roomData) ?? asObject(task.roomId) ?? asObject(raw?.roomData)
  const space = asObject(task.spaceData) ?? asObject(task.spaceId) ?? asObject(raw?.spaceData)
  const workspace =
    asObject(task.workspaceData) ?? asObject(task.workspaceId) ?? asObject(raw?.workspaceData)

  return {
    id: refId(task._id ?? task.id ?? raw?._id),
    title: String(task.title ?? task.name ?? "Untitled task"),
    workspaceId: refId(task.workspaceId) || refId(workspace),
    spaceId: refId(task.spaceId) || refId(space),
    roomId: refId(task.roomId) || refId(room),
    stageId: refId(task.stageId) || refId(stage),
    stageName: String(stage?.name ?? task.stageName ?? ""),
    stageColor: String(stage?.color ?? task.stageColor ?? ""),
    workspaceName: String(workspace?.name ?? workspace?.workspacename ?? task.workspaceName ?? ""),
    spaceName: String(space?.name ?? task.spaceName ?? ""),
    roomName: String(room?.name ?? task.roomName ?? ""),
    priority: String(task.priority ?? ""),
    dueDate: toMs(task.dueDate),
    isCompleted: !!task.isCompleted,
  }
}

function toMs(value: unknown): number | null {
  const ms =
    value == null || value === "" ? NaN : typeof value === "number" ? value : Date.parse(String(value))
  return Number.isFinite(ms) ? ms : null
}

/** One page of dropdown options from a paginated taskroom list endpoint. */
async function fetchPickerPage(
  path: string,
  params: Record<string, string>,
  page: number,
  search = ""
): Promise<PickerPage> {
  const query = new URLSearchParams({ ...params, page: String(page), size: String(PICKER_PAGE_SIZE) })
  if (search) query.set("searchData", search)
  const res = await axios.get(`${TASKROOM_BASE}${path}?${query.toString()}`, { headers: authHeaders() })
  const payload = res.data
  if (payload?.status === false) throw new Error(payload.message || "Failed to load options")
  const items = extractRows(payload)
    .map((r: any) => ({
      _id: String(r?._id ?? ""),
      name: String(r?.name ?? r?.workspacename ?? "Untitled"),
      color: r?.color,
    }))
    .filter((i: PickerItem) => i._id)
  return { items, hasMore: hasMorePages(payload, page, items.length) }
}

/** id → name for every workspace the user belongs to (the task lists don't include names). */
async function fetchWorkspaceNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  for (let page = 1; page <= WORKSPACE_LOOKUP_MAX_PAGES; page++) {
    const query = new URLSearchParams({ page: String(page), size: String(WORKSPACE_LOOKUP_SIZE) })
    const res = await axios.get(`${TASKROOM_BASE}workspaces/me?${query.toString()}`, { headers: authHeaders() })
    const payload = res.data
    if (payload?.status === false) break
    for (const r of extractRows(payload)) {
      const name = r?.name ?? r?.workspacename
      if (r?._id && name) names.set(String(r._id), String(name))
    }
    if (payload?.metadata?.nextPage == null) break
  }
  return names
}

/**
 * GET tasks/:id populates `tags` and `assignedToIds` with objects, while CardModal expects
 * the board's shape: `tags`/`assignedToIds` as ids, with the objects in `tagData`/`assigneeData`.
 */
function toBoardTaskShape(data: any) {
  const tags = Array.isArray(data?.tags) ? data.tags : []
  const assignees = Array.isArray(data?.assignedToIds) ? data.assignedToIds : []
  return {
    ...data,
    tags: tags.map(refId).filter(Boolean),
    tagData: data?.tagData ?? tags.filter((t: unknown) => asObject(t)),
    assignedToIds: assignees.map(refId).filter(Boolean),
    assigneeData: data?.assigneeData ?? assignees.filter((u: unknown) => asObject(u)),
  }
}

const fetchRoomStages = (roomId: string, page: number) =>
  fetchPickerPage("stages", { roomId, status: "active" }, page)

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmtDueDate(ms: number | null) {
  if (ms == null) return "—"
  const d = new Date(ms)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** `1 … 4 5 6 … 12` */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = Array.from(new Set([1, total, current - 1, current, current + 1]))
    .filter(p => p >= 1 && p <= total)
    .sort((a, b) => a - b)
  const out: (number | "gap")[] = []
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push("gap")
    out.push(p)
  })
  return out
}

// ─── Paginated dropdown ───────────────────────────────────────────────────────
/**
 * Popover list that loads its options page by page as the user scrolls.
 * `resetKey` changes (e.g. a new parent workspace/room) discard loaded options.
 * With `serverSearch` the query is sent as `searchData`; otherwise loaded options are filtered locally.
 */
function PaginatedPicker({
  title,
  fetchPage,
  resetKey,
  value,
  onSelect,
  allLabel,
  disabled,
  searchable = true,
  serverSearch = false,
  align = "start",
  children,
}: {
  title: string
  fetchPage: (page: number, search: string) => Promise<PickerPage>
  resetKey: string
  value: string
  onSelect: (item: PickerItem | null) => void
  allLabel?: string
  disabled?: boolean
  searchable?: boolean
  serverSearch?: boolean
  align?: "start" | "center" | "end"
  children: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<PickerItem[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  const fetchPageRef = useRef(fetchPage)
  fetchPageRef.current = fetchPage
  const requestIdRef = useRef(0)
  const isFetchingRef = useRef(false)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadedKeyRef = useRef("")
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(
    async (page: number, replace: boolean, query: string) => {
      if (!replace && isFetchingRef.current) return
      const requestId = ++requestIdRef.current
      isFetchingRef.current = true
      setLoading(true)
      setError(null)
      try {
        const res = await fetchPageRef.current(page, query)
        if (requestId !== requestIdRef.current) return
        setItems(prev => {
          if (replace) return res.items
          const seen = new Set(prev.map(p => p._id))
          return [...prev, ...res.items.filter(i => !seen.has(i._id))]
        })
        pageRef.current = page
        hasMoreRef.current = res.hasMore
        setHasMore(res.hasMore)
      } catch (err: any) {
        if (requestId !== requestIdRef.current) return
        loadedKeyRef.current = "" // retry on next open
        hasMoreRef.current = false
        setHasMore(false)
        setError(err?.response?.data?.message || err?.message || "Failed to load options")
      } finally {
        if (requestId === requestIdRef.current) {
          isFetchingRef.current = false
          setLoading(false)
        }
      }
    },
    []
  )

  // New parent → forget options loaded for the old one.
  useEffect(() => {
    requestIdRef.current++
    isFetchingRef.current = false
    loadedKeyRef.current = ""
    setItems([])
    setHasMore(true)
    setLoading(false)
  }, [resetKey])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Load page 1 on open, and again when the server-side query changes.
  useEffect(() => {
    if (!open) return
    const query = serverSearch ? debouncedSearch : ""
    const key = `${resetKey}::${query}`
    if (loadedKeyRef.current === key) return
    loadedKeyRef.current = key
    void load(1, true, query)
  }, [open, resetKey, debouncedSearch, serverSearch, load])

  // Infinite scroll inside the popover list.
  useEffect(() => {
    if (!open || !hasMore || loading) return
    const root = scrollRef.current
    const el = sentinelRef.current
    if (!root || !el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || isFetchingRef.current || !hasMoreRef.current) return
        void load(pageRef.current + 1, false, serverSearch ? debouncedSearch : "")
      },
      { root, threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [open, hasMore, loading, items.length, serverSearch, debouncedSearch, load])

  const visible = useMemo(() => {
    if (serverSearch || !search.trim()) return items
    const q = search.trim().toLowerCase()
    return items.filter(i => i.name.toLowerCase().includes(q))
  }, [items, search, serverSearch])

  const handleOpenChange = (next: boolean) => {
    if (disabled && next) return
    setOpen(next)
    if (!next) {
      setSearch("")
      setDebouncedSearch("")
    }
  }

  const pick = (item: PickerItem | null) => {
    onSelect(item)
    handleOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-[260px] border border-[#2e2e38] bg-[#0a0a0d] p-0 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col">
          <div className="rounded-t-md border-b border-[#2e2e38] bg-white/[0.02] px-3 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">{title}</span>
          </div>

          {searchable && (
            <div className="border-b border-[#2e2e38] p-2">
              <div className="relative flex items-center">
                <Search className="absolute left-2 h-3 w-3 text-white/50" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-8 w-full rounded border-none bg-[#0a0a0d] pl-8 pr-2.5 text-[12px] text-white/70 placeholder:text-[12px] placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#e5e7eb29]"
                />
              </div>
            </div>
          )}

          <div
            ref={scrollRef}
            className="max-h-[260px] space-y-0.5 overflow-y-auto overscroll-contain p-1.5"
            onWheel={e => e.stopPropagation()}
          >
            {allLabel && (
              <button
                type="button"
                onClick={() => pick(null)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded px-2.5 py-1.5 text-left text-[12px] text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white",
                  !value && "bg-white/[0.05] text-white"
                )}
              >
                <span>{allLabel}</span>
                {!value && <Check className="h-3.5 w-3.5 text-white/50" />}
              </button>
            )}

            {visible.map(item => {
              const isSelected = item._id === value
              return (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => pick(item)}
                  className={cn(
                    "group flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.05]",
                    isSelected && "bg-white/[0.05]"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {item.color && (
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    )}
                    <span className="truncate text-[12px] font-medium text-white/60 group-hover:text-white">
                      {item.name}
                    </span>
                  </span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-white/50" />}
                </button>
              )
            })}

            {!loading && !error && visible.length === 0 && (
              <div className="py-4 text-center text-[12px] text-white/40">No results</div>
            )}

            {error && !loading && (
              <div className="flex flex-col items-center gap-2 py-3 text-center">
                <span className="text-[11px] text-red-400/80">{error}</span>
                <button
                  type="button"
                  onClick={() => {
                    const query = serverSearch ? debouncedSearch : ""
                    loadedKeyRef.current = `${resetKey}::${query}`
                    void load(1, true, query)
                  }}
                  className="cursor-pointer rounded border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:bg-white/5"
                >
                  Retry
                </button>
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-white/50" />
              </div>
            )}

            {hasMore && !loading && !error && <div ref={sentinelRef} className="h-2 w-full" />}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Filter trigger ───────────────────────────────────────────────────────────
function filterButton(label: string, selected: string | undefined, disabled = false) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex h-8 max-w-[200px] cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[12px] transition-colors touch-manipulation",
        selected
          ? "border-[#FACC15]/40 bg-[#FACC15]/10 text-white"
          : "border-white/10 bg-[#161616] text-white/60 hover:bg-white/5",
        disabled && "cursor-not-allowed opacity-40 hover:bg-[#161616]"
      )}
    >
      <span className="truncate">{selected ? `${label}: ${selected}` : label}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40" />
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AssignedToMe() {
  return <MyTaskList scope="assigned" />
}

export function AllTasks() {
  return <MyTaskList scope="all" />
}

function MyTaskList({ scope }: { scope: TaskListScope }) {
  const config = SCOPES[scope]
  const ScopeIcon = config.icon

  const profileId = useUserStore(s => s.userProfile?._id)
  const profileLoading = useUserStore(s => s.isLoading)
  const profileError = useUserStore(s => s.error)
  const fetchUserProfile = useUserStore(s => s.fetchUserProfile)

  const cookieUserId = useMemo(() => {
    try {
      const userData = Cookies.get("TaskRoomUserDetails")
      return userData ? JSON.parse(userData)?._id ?? null : null
    } catch {
      return null
    }
  }, [])
  const userId: string = profileId || cookieUserId || ""

  const profileRequestedRef = useRef(false)
  useEffect(() => {
    if (userId || profileRequestedRef.current) return
    profileRequestedRef.current = true
    void fetchUserProfile()
  }, [userId, fetchUserProfile])

  // Filters — none applied on load, so every task in scope shows.
  const [status, setStatus] = useState<Selected>(null)
  const [workspace, setWorkspace] = useState<Selected>(null)
  const [space, setSpace] = useState<Selected>(null)
  const [room, setRoom] = useState<Selected>(null)
  const [stage, setStage] = useState<Selected>(null)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const [tasks, setTasks] = useState<AssignedTask[]>([])
  const [metadata, setMetadata] = useState<ListMetadata>({ count: null, totalPages: 1, currentPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set())
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [openTask, setOpenTask] = useState<OpenTask | null>(null)
  const [workspaceNames, setWorkspaceNames] = useState<Map<string, string>>(() => new Map())
  const setColumns = useTaskroomWorkspacetore(s => s.setColumns)

  const requestSeqRef = useRef(0)
  const listRef = useRef<HTMLDivElement | null>(null)

  const hasFilters = !!(status || workspace || space || room || stage || search)

  useEffect(() => {
    const next = searchInput.trim()
    if (next === search) return
    const t = setTimeout(() => {
      setSearch(next)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchInput, search])

  useEffect(() => {
    if (!userId) return
    const seq = ++requestSeqRef.current
    setLoading(true)
    setError(null)

    const { path, params: scopeParams, noun } = SCOPES[scope]
    const params = new URLSearchParams({ ...scopeParams, page: String(page), size: String(PAGE_SIZE) })
    if (status) params.set("status", status.id)
    if (workspace) params.set("workspaceId", workspace.id)
    if (space) params.set("spaceId", space.id)
    if (room) params.set("roomId", room.id)
    if (stage) params.set("stageId", stage.id)
    if (search) params.set("searchData", search)

    ;(async () => {
      try {
        const res = await axios.get(`${TASKROOM_BASE}${path(userId)}?${params.toString()}`, {
          headers: authHeaders(),
        })
        if (seq !== requestSeqRef.current) return
        const payload = res.data
        if (payload?.status === false) throw new Error(payload.message || `Failed to load ${noun}`)
        const rows = extractRows(payload)
        setTasks(rows.map(mapAssignedTask).filter(t => t.id))
        setMetadata(extractMetadata(payload, page, rows.length))
      } catch (err: any) {
        if (seq !== requestSeqRef.current) return
        setTasks([])
        setError(err?.response?.data?.message || err?.message || `Failed to load ${noun}`)
      } finally {
        if (seq === requestSeqRef.current) setLoading(false)
      }
    })()
  }, [scope, userId, page, status, workspace, space, room, stage, search, reloadKey])

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 })
  }, [page])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchWorkspaceNames()
      .then(names => {
        if (!cancelled) setWorkspaceNames(names)
      })
      .catch(() => {
        // Cosmetic only — the Source column still shows space and room.
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const sourceOf = (task: AssignedTask) => ({
    workspaceName: task.workspaceName || workspaceNames.get(task.workspaceId) || "",
    spaceName: task.spaceName,
    roomName: task.roomName,
  })

  // ── Filter handlers (parents clear their children) ──
  const toSelected = (item: PickerItem | null): Selected => (item ? { id: item._id, name: item.name } : null)
  const isSame = (item: PickerItem | null, current: Selected) => (item?._id ?? "") === (current?.id ?? "")

  const selectStatus = (item: PickerItem | null) => {
    if (isSame(item, status)) return
    setStatus(toSelected(item))
    setPage(1)
  }
  const selectWorkspace = (item: PickerItem | null) => {
    if (isSame(item, workspace)) return
    setWorkspace(toSelected(item))
    setSpace(null)
    setRoom(null)
    setStage(null)
    setPage(1)
  }
  const selectSpace = (item: PickerItem | null) => {
    if (isSame(item, space)) return
    setSpace(toSelected(item))
    setRoom(null)
    setStage(null)
    setPage(1)
  }
  const selectRoom = (item: PickerItem | null) => {
    if (isSame(item, room)) return
    setRoom(toSelected(item))
    setStage(null)
    setPage(1)
  }
  const selectStage = (item: PickerItem | null) => {
    if (isSame(item, stage)) return
    setStage(toSelected(item))
    setPage(1)
  }
  const clearFilters = () => {
    setStatus(null)
    setWorkspace(null)
    setSpace(null)
    setRoom(null)
    setStage(null)
    setSearchInput("")
    setSearch("")
    setPage(1)
  }

  // ── Stage change on a row ──
  const patchTask = (taskId: string, patch: Partial<AssignedTask>) =>
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...patch } : t)))

  const setUpdating = (taskId: string, on: boolean) =>
    setUpdatingIds(prev => {
      const next = new Set(prev)
      if (on) next.add(taskId)
      else next.delete(taskId)
      return next
    })

  const changeStage = async (task: AssignedTask, next: PickerItem | null) => {
    if (!next || next._id === task.stageId) return
    const previous = { stageId: task.stageId, stageName: task.stageName, stageColor: task.stageColor }
    patchTask(task.id, { stageId: next._id, stageName: next.name, stageColor: next.color || "" })
    setUpdating(task.id, true)
    try {
      await useCardStore.getState().updateCard(task.id, { stageId: next._id })
    } catch {
      // updateCard already toasted the error
      patchTask(task.id, previous)
    } finally {
      setUpdating(task.id, false)
    }
  }

  // ── Edit modal (same CardModal the Kanban card opens) ──
  const openTaskModal = async (task: AssignedTask) => {
    if (openingId) return
    setOpeningId(task.id)
    try {
      const res = await axios.get(`${TASKROOM_BASE}tasks/${encodeURIComponent(task.id)}`, {
        headers: authHeaders(),
      })
      const data = res.data?.data
      if (!res.data?.status || !data) throw new Error(res.data?.message || "Couldn't load this task")

      const card = transformCard(toBoardTaskShape(data), refId(data.stageId) || task.stageId)
      if (!card.stageData?.name && task.stageName) {
        card.stageData = { name: task.stageName, color: task.stageColor, stageType: "" }
      }
      setOpenTask({
        card,
        roomId: refId(data.roomId) || task.roomId,
        context: {
          workspaceId: refId(data.workspaceId) || task.workspaceId || undefined,
          spaceId: refId(data.spaceId) || task.spaceId || undefined,
          ...sourceOf(task),
        },
      })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Couldn't load this task")
    } finally {
      setOpeningId(null)
    }
  }

  // Reflect modal edits in the row right away; the reload on close catches deletes/unassigns.
  const handleCardPatched = (patch: { _id: string } & Partial<Card>) => {
    const next: Partial<AssignedTask> = {}
    if (patch.name !== undefined) next.title = patch.name
    if ("priority" in patch) next.priority = patch.priority || ""
    if (patch.isCompleted !== undefined) next.isCompleted = !!patch.isCompleted
    if ("dueDate" in patch) next.dueDate = toMs(patch.dueDate)
    if (patch.stageId) {
      next.stageId = patch.stageId
      if (patch.stageData) {
        next.stageName = patch.stageData.name || ""
        next.stageColor = patch.stageData.color || ""
      }
    }
    if (Object.keys(next).length > 0) patchTask(patch._id, next)
  }

  const closeTaskModal = () => {
    setOpenTask(null)
    setReloadKey(k => k + 1)
  }

  // ── Render ──
  const totalPages = Math.max(1, metadata.totalPages)
  const rangeStart = (page - 1) * PAGE_SIZE + 1
  const rangeEnd = (page - 1) * PAGE_SIZE + tasks.length
  const waitingForUser = !userId && (profileLoading || !profileError)
  const userLookupFailed = !userId && !profileLoading && !!profileError

  const renderStagePill = (task: AssignedTask) => {
    const isUpdating = updatingIds.has(task.id)
    return (
      <PaginatedPicker
        title="Move to stage"
        resetKey={task.roomId}
        value={task.stageId}
        fetchPage={p => fetchRoomStages(task.roomId, p)}
        onSelect={item => void changeStage(task, item)}
        disabled={!task.roomId || isUpdating}
      >
        <button
          type="button"
          disabled={!task.roomId || isUpdating}
          title={task.roomId ? "Change stage" : "This task has no room"}
          className="inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-[#161616] px-2 text-[12px] text-white/70 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation"
        >
          {isUpdating ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-white/50" />
          ) : (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: task.stageColor || "#6b7280" }}
            />
          )}
          <span className="truncate">{task.stageName || "No stage"}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-white/40" />
        </button>
      </PaginatedPicker>
    )
  }

  /** Workspace › Space › Room, with the room emphasised. */
  const renderSource = (task: AssignedTask) => {
    const { workspaceName, spaceName, roomName } = sourceOf(task)
    const parts = [workspaceName, spaceName, roomName].filter(Boolean)
    if (parts.length === 0) return <span className="text-[12px] text-white/30">—</span>
    return (
      <div className="flex min-w-0 items-center gap-1 text-[12px]" title={parts.join(" › ")}>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-white/25" />}
            <span className={cn("min-w-0 truncate", i === parts.length - 1 ? "text-white/75" : "text-white/45")}>
              {part}
            </span>
          </React.Fragment>
        ))}
      </div>
    )
  }

  const renderRow = (task: AssignedTask) => {
    const priorityKey = task.priority.toLowerCase()
    const isOverdue = task.dueDate != null && task.dueDate < Date.now() && !task.isCompleted
    const isOpening = openingId === task.id
    return (
      <div
        key={task.id}
        role="button"
        tabIndex={0}
        aria-busy={isOpening}
        onClick={() => void openTaskModal(task)}
        onKeyDown={e => {
          if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return
          e.preventDefault()
          void openTaskModal(task)
        }}
        className={cn(
          "flex cursor-pointer flex-col gap-2 border-b border-white/5 px-3 py-2.5 text-[13px] outline-none transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.05] md:px-6 md:py-2",
          ROW_GRID
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {isOpening ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/50" />
          ) : (
            task.isCompleted && <CircleCheck className="h-4 w-4 shrink-0 text-green-500" />
          )}
          <span
            className={cn("truncate font-medium", task.isCompleted ? "text-white/50" : "text-white/90")}
            title={task.title}
          >
            {task.title}
          </span>
        </div>

        {renderSource(task)}

        {/* The stage picker is its own control — don't let it open the modal too. */}
        <div className="flex min-w-0 cursor-default items-center" onClick={e => e.stopPropagation()}>
          {renderStagePill(task)}
        </div>

        <div className="flex items-center gap-4 md:contents">
          <div className="flex items-center gap-1.5 text-[12px] text-white/60">
            {task.priority ? (
              <>
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: PRIORITY_COLORS[priorityKey] || "#6b7280" }}
                />
                {capitalize(task.priority)}
              </>
            ) : (
              <span className="text-white/30">—</span>
            )}
          </div>
          <div className={cn("text-[12px]", isOverdue ? "text-red-400" : "text-white/60")}>
            {fmtDueDate(task.dueDate)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0a0d] pt-3">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
            <ScopeIcon className="h-4 w-4 text-[#FACC15]" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-white">{config.title}</h2>
            <p className="truncate text-[11px] text-white/40">
              {metadata.count != null && !loading
                ? `${metadata.count} task${metadata.count === 1 ? "" : "s"} across all workspaces`
                : config.subtitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey(k => k + 1)}
          disabled={loading || !userId}
          className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#161616] px-3 py-[7px] text-[13px] text-white/50 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation"
          aria-label="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#e5e7eb29] px-3 pb-3 md:px-6">
        <div className="relative w-full sm:w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search tasks..."
            className="h-8 w-full rounded-lg border border-white/10 bg-[#161616] pl-8 pr-7 text-[12px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/20"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-white/40 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <PaginatedPicker
          title="Status"
          resetKey="status"
          value={status?.id ?? ""}
          fetchPage={async () => ({ items: STATUS_OPTIONS, hasMore: false })}
          onSelect={selectStatus}
          allLabel="All statuses"
          searchable={false}
        >
          {filterButton("Status", status?.name)}
        </PaginatedPicker>

        <PaginatedPicker
          title="Workspace"
          resetKey="workspaces"
          value={workspace?.id ?? ""}
          fetchPage={(p, q) => fetchPickerPage("workspaces/me", {}, p, q)}
          onSelect={selectWorkspace}
          allLabel="All workspaces"
          serverSearch
        >
          {filterButton("Workspace", workspace?.name)}
        </PaginatedPicker>

        <PaginatedPicker
          title="Space"
          resetKey={workspace?.id ?? ""}
          value={space?.id ?? ""}
          fetchPage={(p, q) => fetchPickerPage("spaces/me", { workspaceId: workspace?.id ?? "" }, p, q)}
          onSelect={selectSpace}
          allLabel="All spaces"
          disabled={!workspace}
          serverSearch
        >
          {filterButton("Space", space?.name, !workspace)}
        </PaginatedPicker>

        <PaginatedPicker
          title="Room"
          resetKey={space?.id ?? ""}
          value={room?.id ?? ""}
          fetchPage={(p, q) => fetchPickerPage("rooms/me", { spaceId: space?.id ?? "" }, p, q)}
          onSelect={selectRoom}
          allLabel="All rooms"
          disabled={!space}
          serverSearch
        >
          {filterButton("Room", room?.name, !space)}
        </PaginatedPicker>

        <PaginatedPicker
          title="Stage"
          resetKey={room?.id ?? ""}
          value={stage?.id ?? ""}
          fetchPage={p => fetchRoomStages(room?.id ?? "", p)}
          onSelect={selectStage}
          allLabel="All stages"
          disabled={!room}
        >
          {filterButton("Stage", stage?.name, !room)}
        </PaginatedPicker>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-[12px] text-white/50 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* List */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          className={cn(
            "sticky top-0 z-10 hidden border-b border-[#e5e7eb29] bg-[#0a0a0d] px-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/40",
            ROW_GRID
          )}
        >
          <span>Task</span>
          <span>Source</span>
          <span>Stage</span>
          <span>Priority</span>
          <span>Due date</span>
        </div>

        {userLookupFailed ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <p className="text-[13px] text-white/60">We couldn&apos;t load your Taskroom profile.</p>
            <button
              type="button"
              onClick={() => void fetchUserProfile()}
              className="cursor-pointer rounded-lg border border-white/10 bg-[#161616] px-3 py-1.5 text-[12px] text-white/70 hover:bg-white/5"
            >
              Retry
            </button>
          </div>
        ) : waitingForUser || (loading && tasks.length === 0) ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={cn("flex flex-col gap-2 border-b border-white/5 px-3 py-3 md:px-6", ROW_GRID)}>
              <Skeleton className="h-4 w-3/4 bg-[#343439]" />
              <Skeleton className="h-3.5 w-2/3 bg-[#343439]" />
              <Skeleton className="h-6 w-28 bg-[#343439]" />
              <Skeleton className="hidden h-4 w-14 bg-[#343439] md:block" />
              <Skeleton className="hidden h-4 w-16 bg-[#343439] md:block" />
            </div>
          ))
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <p className="text-[13px] text-red-400/80">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey(k => k + 1)}
              className="cursor-pointer rounded-lg border border-white/10 bg-[#161616] px-3 py-1.5 text-[12px] text-white/70 hover:bg-white/5"
            >
              Retry
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <ScopeIcon className="h-8 w-8 text-white/20" />
            <p className="text-[13px] text-white/60">
              {hasFilters ? "No tasks match these filters" : config.empty}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="cursor-pointer rounded-lg border border-white/10 bg-[#161616] px-3 py-1.5 text-[12px] text-white/70 hover:bg-white/5"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className={cn(loading && "pointer-events-none opacity-60 transition-opacity")}>
            {tasks.map(renderRow)}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!error && !userLookupFailed && tasks.length > 0 && (
        <div className="flex shrink-0 flex-col items-center justify-between gap-2 border-t border-[#e5e7eb29] px-3 py-2.5 sm:flex-row md:px-6">
          <span className="text-[12px] text-white/40">
            {metadata.count != null
              ? `Showing ${rangeStart}–${rangeEnd} of ${metadata.count}`
              : `Page ${page} of ${totalPages}`}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageWindow(page, totalPages).map((p, i) =>
                p === "gap" ? (
                  <span key={`gap-${i}`} className="px-1 text-[12px] text-white/30">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    disabled={loading}
                    className={cn(
                      "h-7 min-w-7 cursor-pointer rounded-md px-2 text-[12px] transition-colors disabled:cursor-not-allowed",
                      p === page ? "bg-[#FACC15] font-semibold text-black" : "text-white/60 hover:bg-white/5"
                    )}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {openTask && (
        <CardModal
          key={openTask.card._id}
          card={openTask.card}
          boardId={openTask.roomId}
          orgId=""
          userId={userId}
          connected={false}
          setColumns={setColumns}
          isReadOnly={false}
          roomContext={openTask.context}
          onCardPatched={handleCardPatched}
          onClose={closeTaskModal}
        />
      )}
    </div>
  )
}
