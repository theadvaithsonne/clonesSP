"use client"

import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import axios from "axios"
import { toast } from "sonner"
import {
  AddTaskDialog,
  extractSheetMetadata,
  fetchTaskTimeTracks,
  fetchTimesheetAllTasklist,
  fmtMins,
  parseTimesheetApiPayload,
  removeTasksFromTimesheet,
  TIMESHEET_PAGE_SIZE,
  TIMESHEET_COL_STYLE,
  TIMESHEET_GRID_MIN_WIDTH,
  TIMESHEET_SCROLL_ROOT,
  TIMESHEET_STICKY_HEADER_CELL,
  TIMESHEET_STICKY_HEADER_CORNER,
  TIMESHEET_STICKY_LEFT,
  TIMESHEET_STICKY_LEFT_NESTED,
  TimesheetRemoveTaskButton,
} from "./timesheet"
import { TimesheetWeekPicker } from "./TimesheetWeekPicker"

const PEOPLE_COL_STYLE = { gridTemplateColumns: "240px repeat(7, minmax(88px, 1fr)) 88px" }
const PEOPLE_GRID_MIN_WIDTH = 240 + 7 * 88 + 88
const PEOPLE_STICKY_LEFT = {
  position: "sticky" as const,
  left: 0,
  zIndex: 2,
  background: "#0a0a0d",
  boxShadow: "8px 0 12px -8px rgba(0,0,0,0.45)",
}
const PEOPLE_STICKY_HEADER_CORNER = { ...PEOPLE_STICKY_LEFT, top: 0, zIndex: 12 }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAY_API_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const
const DEFAULT_WEEKLY_CAPACITY_H = 40
const DEFAULT_DAILY_CAPACITY_MINS = 8 * 60

type DayTotals = { billable: number; nonBillable: number }
type DailyTotalsMap = Record<(typeof DAY_API_KEYS)[number], DayTotals>

type AdminMemberRow = {
  _id: string
  name: string
  email?: string
  image?: string
  timeSheetData?: {
    currentStatus?: string
    timeZone?: string
    dailyTotals?: DailyTotalsMap
    draftDailyTotals?: DailyTotalsMap
    approvalDailyTotals?: DailyTotalsMap
  }
}

export type AllTimesheetsMember = {
  id: string
  name: string
  email?: string
  image?: string
  dailyMins: number[]
  dailyBreakdown: DayTotals[]
  weekTotalMins: number
  weeklyCapacityH: number
  timeZone?: string
}

export type MemberTimesheetApprovalContext = {
  submissionId: string
  status: "pending" | "changes_needed" | "approved"
  submittedAt: string
  billableMins: number
  showReviewActions: boolean
  reviewing: boolean
  onReview: (action: "approve" | "reject") => void
}

function ApprovalStatusPill({ status }: { status: MemberTimesheetApprovalContext["status"] }) {
  if (status === "changes_needed") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#f5c842",
          color: "#111",
          borderRadius: 999,
          padding: "4px 12px",
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
          <path d="M7.5 1.5l1 1.5-4 4-2-2 1-1 1 1 3-3z" fill="currentColor" />
        </svg>
        Changes needed
      </span>
    )
  }
  if (status === "pending") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#1e3a5f",
          color: "#60a5fa",
          border: "1px solid #2563eb",
          borderRadius: 999,
          padding: "4px 12px",
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
          <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.1" />
          <path d="M5.5 3v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
        Pending
      </span>
    )
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "#2a2608",
        color: "var(--brand)",
        border: "1px solid #7a6800",
        borderRadius: 999,
        padding: "4px 12px",
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
        <path d="M2.5 5.5l2 2 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Approved
    </span>
  )
}

type TimesheetEntry = {
  id: string
  day: number
  mins: number
  label: string
  live?: boolean
  billable?: boolean
  startTime?: number
}

type TimesheetTaskRow = {
  id: string
  name: string
  dotColor: string
  space: string
  time: number[]
  entries: TimesheetEntry[]
}

function fmtDate(d: Date) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

function fmtWeekRangeLabel(dates: Date[]) {
  const y = dates[6].getFullYear()
  return `${MONTHS[dates[0].getMonth()]} ${dates[0].getDate()} – ${MONTHS[dates[6].getMonth()]} ${dates[6].getDate()}, ${y}`
}

function entryMinsForDisplay(entry: TimesheetEntry): number {
  if (!entry.live) return entry.mins
  if (entry.startTime != null && Number.isFinite(entry.startTime)) {
    return Math.max(0, Math.round((Date.now() - entry.startTime) / 60000))
  }
  return entry.mins
}

function taskroomBase() {
  const b = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/"
  return b.endsWith("/") ? b : `${b}/`
}

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function localDayStartMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function getWeekRange(offsetWeeks: number) {
  const anchor = new Date()
  const sun = new Date(anchor)
  sun.setHours(0, 0, 0, 0)
  sun.setDate(sun.getDate() - sun.getDay() + offsetWeeks * 7)

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sun)
    d.setDate(sun.getDate() + i)
    return d
  })
  const weekStartMs = localDayStartMs(dates[0])
  const last = dates[6]
  const weekEndMs = new Date(
    last.getFullYear(),
    last.getMonth(),
    last.getDate(),
    23,
    59,
    59,
    999
  ).getTime()
  return { dates, weekStartMs, weekEndMs }
}

function fmtDateHeader(d: Date) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

function fmtCellHours(mins: number) {
  const m = Math.max(0, Math.round(mins))
  if (!m) return "0h"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

function fmtHmPill(mins: number) {
  const m = Math.max(0, Math.round(mins))
  const h = Math.floor(m / 60)
  const r = m % 60
  return `${String(h).padStart(2, "0")}h ${String(r).padStart(2, "0")}m`
}

function capacityPct(mins: number, capacityMins: number) {
  if (!capacityMins || capacityMins <= 0) return 0
  return Math.round((Math.max(0, mins) / capacityMins) * 100)
}

function userTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

function formatLoggedInTimezone(iana?: string) {
  const tz = iana?.trim() || userTimeZone()
  try {
    const d = new Date()
    const short =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
        .formatToParts(d)
        .find(p => p.type === "timeZoneName")?.value ?? tz
    const offset =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
        .formatToParts(d)
        .find(p => p.type === "timeZoneName")?.value?.replace("GMT", "UTC") ?? "UTC"
    return `Logged in timezone: ${short} (${offset})`
  } catch {
    return `Logged in timezone: ${tz}`
  }
}

function fmtPopoverDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function initials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function normalizeDailyTotals(raw: unknown): DailyTotalsMap | null {
  if (!raw || typeof raw !== "object") return null
  const out = {} as DailyTotalsMap
  for (const key of DAY_API_KEYS) {
    const day = (raw as Record<string, unknown>)[key]
    if (day && typeof day === "object") {
      const d = day as Record<string, unknown>
      out[key] = {
        billable: Math.max(0, Math.round(Number(d.billable) || 0)),
        nonBillable: Math.max(0, Math.round(Number(d.nonBillable ?? d.non_billable) || 0)),
      }
    } else {
      out[key] = { billable: 0, nonBillable: 0 }
    }
  }
  return out
}

function pickDailySource(sheet: AdminMemberRow["timeSheetData"]) {
  if (!sheet) return null
  if (sheet.dailyTotals) return sheet.dailyTotals
  const useApproval =
    sheet.currentStatus === "submitted" ||
    sheet.currentStatus === "approved" ||
    sheet.currentStatus === "pending"
  return useApproval ? sheet.approvalDailyTotals : sheet.draftDailyTotals
}

function dailyBreakdownFromSheet(sheet: AdminMemberRow["timeSheetData"]): DayTotals[] {
  const totals = normalizeDailyTotals(pickDailySource(sheet))
  if (!totals) return DAY_API_KEYS.map(() => ({ billable: 0, nonBillable: 0 }))
  return DAY_API_KEYS.map(key => totals[key] ?? { billable: 0, nonBillable: 0 })
}

function dailyMinsFromBreakdown(breakdown: DayTotals[]) {
  return breakdown.map(d => (d.billable ?? 0) + (d.nonBillable ?? 0))
}

function mapAdminRows(rows: AdminMemberRow[]): AllTimesheetsMember[] {
  const byUser = new Map<string, AdminMemberRow[]>()

  for (const row of rows) {
    const id = String(row._id ?? "").trim()
    if (!id) continue
    const list = byUser.get(id) ?? []
    list.push(row)
    byUser.set(id, list)
  }

  const members: AllTimesheetsMember[] = []

  for (const [id, userRows] of byUser) {
    let name = ""
    let email: string | undefined
    let image: string | undefined
    let bestBreakdown = DAY_API_KEYS.map(() => ({ billable: 0, nonBillable: 0 }))
    let bestTotal = 0
    let timeZone: string | undefined

    for (const row of userRows) {
      if (row.name) name = row.name
      if (row.email) email = row.email
      if (row.image) image = row.image

      if (!row.timeSheetData) continue
      if (row.timeSheetData.timeZone) timeZone = row.timeSheetData.timeZone
      const breakdown = dailyBreakdownFromSheet(row.timeSheetData)
      const weekTotalMins = dailyMinsFromBreakdown(breakdown).reduce((a, b) => a + b, 0)
      if (weekTotalMins > bestTotal || (weekTotalMins === bestTotal && !bestTotal && row.timeSheetData)) {
        bestTotal = weekTotalMins
        bestBreakdown = breakdown
      }
    }

    const bestDaily = dailyMinsFromBreakdown(bestBreakdown)

    members.push({
      id,
      name: name || email || "Unknown",
      email,
      image,
      dailyMins: bestDaily,
      dailyBreakdown: bestBreakdown,
      weekTotalMins: bestTotal,
      weeklyCapacityH: DEFAULT_WEEKLY_CAPACITY_H,
      timeZone,
    })
  }

  return members.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
}

function DayCellHoverPopover({
  date,
  dayData,
  timeZone,
  children,
}: {
  date: Date
  dayData: DayTotals
  timeZone?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const updatePosition = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.bottom + 8, left: r.left + r.width / 2 })
  }

  const show = () => {
    clearHideTimer()
    updatePosition()
    setOpen(true)
  }

  const scheduleHide = () => {
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => () => clearHideTimer(), [])

  const billable = dayData.billable ?? 0
  const nonBillable = dayData.nonBillable ?? 0
  const tracked = billable + nonBillable
  const capacity = DEFAULT_DAILY_CAPACITY_MINS
  const remaining = Math.max(0, capacity - tracked)

  const pill = (mins: number) => (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: "#e0e0e0",
        background: "#2a2b2c",
        borderRadius: 6,
        padding: "2px 8px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {fmtHmPill(mins)}
    </span>
  )

  const popoverRow = (
    label: string,
    mins: number,
    pct: number,
    opts: { indent?: boolean; muted?: boolean } = {}
  ) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        paddingLeft: opts.indent ? 14 : 0,
        marginTop: opts.indent ? 6 : 0,
      }}
    >
      <span style={{ fontSize: 12, color: opts.muted ? "#888" : "#c9cdd4" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "#666", minWidth: 28, textAlign: "right" }}>{pct}%</span>
        {pill(mins)}
      </div>
    </div>
  )

  const popover =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translateX(-50%)",
              zIndex: 99999,
              width: 300,
              background: "#161616",
              border: "1px solid #2a2b2c",
              borderRadius: 10,
              boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
              padding: "14px 16px",
              pointerEvents: "auto",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", marginBottom: 12 }}>
              {fmtPopoverDate(date)}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 12, color: "#c9cdd4" }}>Total capacity</span>
              {pill(capacity)}
            </div>

            <div style={{ height: 1, background: "#2a2b2c", margin: "10px 0 12px" }} />

            <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
              <div style={{ width: 3, borderRadius: 2, background: "#3b82f6", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {popoverRow("Tracked time", tracked, capacityPct(tracked, capacity))}
                {popoverRow("Billable", billable, capacityPct(billable, capacity), {
                  indent: true,
                  muted: true,
                })}
                {popoverRow("Non-billable", nonBillable, capacityPct(nonBillable, capacity), {
                  indent: true,
                  muted: true,
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <div style={{ width: 3, borderRadius: 2, background: "#555", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {popoverRow("Remaining capacity", remaining, capacityPct(remaining, capacity))}
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px solid #2a2b2c",
                fontSize: 11,
                color: "#666",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.1" />
                <path
                  d="M1 6h1.5M9.5 6H11M6 1v1.5M6 9.5V11"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                />
              </svg>
              {formatLoggedInTimezone(timeZone)}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        {children}
      </div>
      {popover}
    </>
  )
}

const adminWorkspaceInflight = new Map<
  string,
  Promise<{ members: AllTimesheetsMember[]; metadata: { totalPages: number; currentPage: number; nextPage: number | null; count: number } }>
>()

async function fetchAdminWorkspaceTimesheets(
  workspaceId: string,
  weekStartMs: number,
  weekEndMs: number,
  page = 1,
  size = TIMESHEET_PAGE_SIZE
): Promise<{ members: AllTimesheetsMember[]; metadata: { totalPages: number; currentPage: number; nextPage: number | null; count: number } }> {
  const safePage = Math.max(1, Number(page) || 1)
  const cacheKey = `${workspaceId}-${weekStartMs}-${weekEndMs}-${safePage}-${size}`

  const existing = adminWorkspaceInflight.get(cacheKey)
  if (existing) return existing

  const promise = (async () => {
    const url = `${taskroomBase()}tasks/time/sheets/admin/${encodeURIComponent(workspaceId)}/workspace`
    const params = new URLSearchParams({
      weekStart: String(weekStartMs),
      weekEnd: String(weekEndMs),
      page: String(safePage),
      size: String(size),
    })
    const res = await axios.get(`${url}?${params.toString()}`, { headers: authHeaders() })
    const payload = res.data
    const rawList: AdminMemberRow[] = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : []
    const members = mapAdminRows(rawList)
    const sheetMeta = extractSheetMetadata(payload)
    const count =
      typeof payload?.metadata?.count === "number" ? payload.metadata.count : members.length
    return { members, metadata: { ...sheetMeta, count } }
  })().finally(() => {
    adminWorkspaceInflight.delete(cacheKey)
  })

  adminWorkspaceInflight.set(cacheKey, promise)
  return promise
}

export async function fetchAdminUserTimesheet(opts: {
  workspaceId: string
  weekStartMs: number
  weekEndMs: number
  timeSheetUserId: string
  page?: number
  size?: number
}) {
  const params = new URLSearchParams({
    weekStart: String(opts.weekStartMs),
    weekEnd: String(opts.weekEndMs),
    workspaceId: opts.workspaceId,
    timeSheetUserId: opts.timeSheetUserId,
    size: String(opts.size ?? TIMESHEET_PAGE_SIZE),
    page: String(opts.page ?? 1),
  })

  const url = `${taskroomBase()}tasks/time/sheets/admin?${params.toString()}`
  const res = await axios.get(url, { headers: authHeaders() })
  return res.data
}

const detailNavBtn = {
  background: "none",
  border: "none",
  color: "#666",
  cursor: "pointer",
  fontSize: 14,
  padding: "2px 6px",
  borderRadius: 4,
} as const

const detailHeaderCell = {
  padding: "10px 12px",
  fontSize: 11,
  color: "#666",
  fontWeight: 500,
  borderRight: "1px solid #222324",
} as const

export function MemberTimesheetDetail({
  member,
  workspaceId,
  initialWeekOffset,
  onBack,
  approvalContext,
}: {
  member: AllTimesheetsMember
  workspaceId: string
  initialWeekOffset: number
  onBack: () => void
  approvalContext?: MemberTimesheetApprovalContext
}) {
  const [weekOffset, setWeekOffset] = useState(initialWeekOffset)
  const [tasks, setTasks] = useState<TimesheetTaskRow[]>([])
  const [timesheetId, setTimesheetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAddTask, setShowAddTask] = useState(false)
  const [pickerTasksForDialog, setPickerTasksForDialog] = useState<
    { id: string; name: string; dotColor: string; status: string; space: string; updatedAt: string }[] | null
  >(null)
  const [allAssignedLoading, setAllAssignedLoading] = useState(false)
  const [addingTasks, setAddingTasks] = useState(false)
  const [removingTaskId, setRemovingTaskId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [tasksPage, setTasksPage] = useState(1)
  const [tasksMetadata, setTasksMetadata] = useState({ totalPages: 1, currentPage: 1, nextPage: null as number | null })
  const pendingTasksPageResetRef = useRef(false)
  const [entriesLoading, setEntriesLoading] = useState<Record<string, boolean>>({})
  const [entriesMetadata, setEntriesMetadata] = useState<Record<string, { totalPages: number; currentPage: number; nextPage: number | null }>>({})
  const loadedEntryTaskIdsRef = useRef<Set<string>>(new Set())

  const { dates, weekStartMs, weekEndMs } = getWeekRange(weekOffset)
  const isThisWeek = weekOffset === 0
  const colStyle = TIMESHEET_COL_STYLE
  const isApprovalReview = !!approvalContext
  const readOnly = isApprovalReview
  const compactRows = isApprovalReview
  const taskRowPad = compactRows ? "6px 10px" : "12px 14px"
  const cellRowPad = compactRows ? "6px 6px" : "12px 8px"
  const headerCellPad = compactRows ? "6px 8px" : "10px 12px"
  const capacityMins = member.weeklyCapacityH * 60
  const trackedMins = member.weekTotalMins
  const billableMins = approvalContext?.billableMins ?? member.dailyBreakdown.reduce((s, d) => s + (d.billable ?? 0), 0)
  const nonBillableMins = Math.max(0, trackedMins - billableMins)
  const capacityPct = capacityMins > 0 ? Math.min(100, (trackedMins / capacityMins) * 100) : 0
  const [detailView, setDetailView] = useState<"timesheet" | "entries">("timesheet")

  useEffect(() => {
    pendingTasksPageResetRef.current = true
    setTasksPage(1)
  }, [weekOffset, member.id, refreshKey])

  useEffect(() => {
    let cancelled = false
    const pageToLoad = pendingTasksPageResetRef.current ? 1 : tasksPage
    pendingTasksPageResetRef.current = false

    if (!workspaceId?.trim()) {
      setError("Missing workspace.")
      setTasks([])
      setLoading(false)
      return
    }

    const { dates: weekDates, weekStartMs: ws, weekEndMs: we } = getWeekRange(weekOffset)

    setLoading(true)
    setError(null)
    setTimesheetId(null)
    setExpanded({})
    setEntriesLoading({})
    setEntriesMetadata({})
    loadedEntryTaskIdsRef.current = new Set()

    fetchAdminUserTimesheet({
      workspaceId: workspaceId.trim(),
      weekStartMs: ws,
      weekEndMs: we,
      timeSheetUserId: member.id,
      page: pageToLoad,
      size: TIMESHEET_PAGE_SIZE,
    })
      .then(payload => {
        if (cancelled) return
        const metadata = extractSheetMetadata(payload)
        const { sheetId, tasks: loadedTasks } = parseTimesheetApiPayload(payload, weekDates)
        setTimesheetId(sheetId)
        setTasksMetadata(metadata)
        setTasksPage(prev => (metadata.currentPage !== prev ? metadata.currentPage : prev))
        setTasks(loadedTasks as TimesheetTaskRow[])
        setError(null)
      })
      .catch(err => {
        if (cancelled) return
        let msg = "Failed to load timesheet"
        if (axios.isAxiosError(err)) {
          const serverData = err.response?.data
          const serverMsg =
            typeof serverData === "string"
              ? serverData
              : (serverData as { message?: string; error?: string })?.message ??
                (serverData as { error?: string })?.error
          msg = serverMsg || err.message || msg
        } else if (err instanceof Error) {
          msg = err.message
        }
        setError(msg)
        setTasks([])
        toast.error(msg.slice(0, 200))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId, weekOffset, member.id, refreshKey, tasksPage])

  /** GET /tasks/time/tracks for one task — lazy load on expand (admin: isPersonal=false). */
  const loadTaskEntries = useCallback(
    (task: TimesheetTaskRow, opts: { force?: boolean; page?: number } = {}) => {
      const page = Math.max(1, opts.page ?? 1)
      if (!opts.force && page === 1 && loadedEntryTaskIdsRef.current.has(task.id)) return
      if (entriesLoading[task.id]) return

      setEntriesLoading(p => ({ ...p, [task.id]: true }))
      fetchTaskTimeTracks(
        {
          taskId: task.id,
          weekStart: weekStartMs,
          weekEnd: weekEndMs,
          isPersonal: false,
          timeSheetUserId: member.id,
          page,
        },
        dates
      )
        .then(({ entries: taskEntries, metadata }) => {
          if (page === 1) loadedEntryTaskIdsRef.current.add(task.id)
          setEntriesMetadata(p => ({ ...p, [task.id]: metadata }))
          setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, entries: taskEntries } : t)))
        })
        .catch(e => {
          console.error("Failed to load time entries for task", task.id, e)
          toast.error("Could not load time entries for this task")
        })
        .finally(() => {
          setEntriesLoading(p => ({ ...p, [task.id]: false }))
        })
    },
    [dates, weekStartMs, weekEndMs, member.id, entriesLoading]
  )

  const isTaskExpanded = (taskId: string) =>
    detailView === "entries" ? true : !!expanded[taskId]

  useEffect(() => {
    if (!isApprovalReview || detailView !== "entries" || loading || tasks.length === 0) return
    setExpanded(prev => {
      const next = { ...prev }
      for (const task of tasks) next[task.id] = true
      return next
    })
    for (const task of tasks) {
      if (!loadedEntryTaskIdsRef.current.has(task.id)) {
        loadTaskEntries(task)
      }
    }
  }, [isApprovalReview, detailView, loading, tasks.length, loadTaskEntries])

  const totalByDay = Array.from({ length: 7 }, (_, d) =>
    tasks.reduce((s, t) => s + (t.time[d] || 0), 0)
  )
  const grandTotal = totalByDay.reduce((a, b) => a + b, 0)

  const loadAddTaskPicker = useCallback(async () => {
    if (allAssignedLoading || addingTasks) return

    if (!timesheetId) {
      toast.error("Timesheet is not ready yet. Wait for the week to load, then try again.")
      return
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null
    if (!token) {
      toast.error("Sign in required to load tasks.")
      return
    }

    setAllAssignedLoading(true)
    try {
      const mapped = await fetchTimesheetAllTasklist(timesheetId, {
        // sBound: weekStartMs,
        // eBound: weekEndMs,
        workspaceId: workspaceId.trim(),
        assignedToMe: false,
      })
      setPickerTasksForDialog(mapped)
      setShowAddTask(true)
    } catch (e) {
      let msg = "Failed to load tasks"
      if (axios.isAxiosError(e)) {
        const serverData = e.response?.data
        const serverMsg =
          typeof serverData === "string" ? serverData : serverData?.message ?? serverData?.error
        msg = serverMsg || e.message || msg
      } else if (e instanceof Error) {
        msg = e.message
      }
      toast.error(msg.slice(0, 240))
    } finally {
      setAllAssignedLoading(false)
    }
  }, [
    allAssignedLoading,
    addingTasks,
    timesheetId,
    weekStartMs,
    weekEndMs,
    workspaceId,
  ])

  const addTasksFromDialog = useCallback(
    async (picked: { id: string | number }[]) => {
      if (addingTasks) return
      if (!timesheetId) {
        toast.error("Timesheet not loaded yet. Please wait and try again.")
        return
      }

      setAddingTasks(true)
      try {
        await axios.put(
          `${taskroomBase()}tasks/time/sheets/${timesheetId}/add/tasks`,
          { taskIds: picked.map(p => String(p.id)) },
          { headers: authHeaders() }
        )
        setShowAddTask(false)
        setPickerTasksForDialog(null)
        setRefreshKey(k => k + 1)
        toast.success("Tasks added to timesheet")
      } catch (e) {
        let msg = "Failed to add tasks to timesheet"
        if (axios.isAxiosError(e)) {
          const serverData = e.response?.data
          const serverMsg =
            typeof serverData === "string" ? serverData : serverData?.message ?? serverData?.error
          msg = serverMsg || e.message || msg
        } else if (e instanceof Error) {
          msg = e.message
        }
        toast.error(msg.slice(0, 240))
      } finally {
        setAddingTasks(false)
      }
    },
    [addingTasks, timesheetId]
  )

  const removeTaskFromSheet = useCallback(
    async (taskId: string) => {
      if (!timesheetId || removingTaskId) return
      if (
        !confirm(
          `Remove this task from ${member.name}'s timesheet for this week? Tracked time stays on the task.`
        )
      ) {
        return
      }

      setRemovingTaskId(taskId)
      try {
        await removeTasksFromTimesheet(timesheetId, [String(taskId)])
        setTasks(prev => prev.filter(t => t.id !== taskId))
        setExpanded(prev => {
          const next = { ...prev }
          delete next[taskId]
          return next
        })
        setRefreshKey(k => k + 1)
        toast.success("Task removed from timesheet")
      } catch (e) {
        let msg = "Failed to remove task from timesheet"
        if (axios.isAxiosError(e)) {
          const serverData = e.response?.data
          const serverMsg =
            typeof serverData === "string"
              ? serverData
              : (serverData as { message?: string; error?: string })?.message ??
                (serverData as { error?: string })?.error
          msg = serverMsg || e.message || msg
        } else if (e instanceof Error) {
          msg = e.message
        }
        toast.error(msg.slice(0, 240))
      } finally {
        setRemovingTaskId(null)
      }
    },
    [timesheetId, removingTaskId, member.name]
  )

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      {isApprovalReview ? (
        <>
          {/* Approval review header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              borderBottom: "1px solid #0a0a0d",
              flexShrink: 0,
            }}
          >
            {member.image ? (
              <img
                src={member.image}
                alt=""
                style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#5b4bb7",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {initials(member.name)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: "#e8e8e8" }}>{member.name}</span>
                <span style={{ fontSize: 12, color: "#666" }}>{approvalContext.submittedAt}</span>
                <ApprovalStatusPill status={approvalContext.status} />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {approvalContext.showReviewActions && (
                <>
                  <button
                    type="button"
                    disabled={approvalContext.reviewing}
                    onClick={() => approvalContext.onReview("reject")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "transparent",
                      border: "1px solid #5a4a20",
                      color: "#f5c842",
                      borderRadius: 8,
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: approvalContext.reviewing ? "not-allowed" : "pointer",
                      opacity: approvalContext.reviewing ? 0.5 : 1,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path d="M9 2.5l2.5 2.5-6 6H3v-2.5l6-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                    Request changes
                  </button>
                  <button
                    type="button"
                    disabled={approvalContext.reviewing}
                    onClick={() => approvalContext.onReview("approve")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#16a34a",
                      border: "none",
                      color: "#fff",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: approvalContext.reviewing ? "not-allowed" : "pointer",
                      opacity: approvalContext.reviewing ? 0.5 : 1,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Approve
                  </button>
                </>
              )}
              <button type="button" onClick={onBack} style={{ ...detailNavBtn, width: 32, height: 32 }} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Time summary */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "10px 16px",
              borderBottom: "1px solid #0a0a0d",
              flexShrink: 0,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#e8e8e8", lineHeight: 1.1 }}>
                {fmtHmPill(trackedMins)}{" "}
                <span style={{ fontSize: 16, fontWeight: 400, color: "#666" }}>/ {fmtHmPill(capacityMins)}</span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  height: 6,
                  borderRadius: 999,
                  background: "#0a0a0d",
                  overflow: "hidden",
                  maxWidth: 280,
                }}
              >
                <div
                  style={{
                    width: `${capacityPct}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #2563eb, #60a5fa)",
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
              <span style={{ color: "#888" }}>
                Billable: <strong style={{ color: "#e0e0e0" }}>{fmtHmPill(billableMins)}</strong>
              </span>
              <span style={{ color: "#888" }}>
                Non-billable: <strong style={{ color: "#e0e0e0" }}>{fmtHmPill(nonBillableMins)}</strong>
              </span>
            </div>
            {member.timeZone && (
              <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                {member.name}&apos;s timezone: {member.timeZone}
              </div>
            )}
          </div>

          {/* Week label (fixed for this submission) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "8px 16px",
              borderBottom: "1px solid #0a0a0d",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e8e8e8" }}>
              {fmtWeekRangeLabel(dates)}
            </span>
            <div
              style={{
                display: "flex",
                background: "#161616",
                border: "1px solid #2a2b2c",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {(["timesheet"] as const).map(view => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setDetailView(view)}
                  style={{
                    background: detailView === view ? "#2a2b2c" : "transparent",
                    border: "none",
                    color: detailView === view ? "#e8e8e8" : "#666",
                    fontSize: 12,
                    fontWeight: detailView === view ? 600 : 400,
                    padding: "6px 14px",
                    cursor: "pointer",
                  }}
                >
                  {view === "timesheet" ? "Timesheet" : "Time entries"}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
      {/* Header: back + user */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderBottom: "1px solid #0a0a0d",
          flexShrink: 0,
        }}
      >
        <button type="button" onClick={onBack} style={detailNavBtn} aria-label="Back to all timesheets">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {member.image ? (
          <img
            src={member.image}
            alt=""
            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#2a2b35",
              color: "#c9cdd4",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {initials(member.name)}
          </div>
        )}
        <span style={{ fontSize: 15, fontWeight: 600, color: "#e8e8e8", flex: 1, minWidth: 0 }}>{member.name}</span>

        {/* <button type="button" style={{ ...detailNavBtn, padding: 8 }} aria-label="Settings">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M11.6 3.4l-1 1M3.4 11.6l-1 1"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          style={{
            background: "#161616",
            border: "1px solid #2a2b2c",
            color: "#e0e0e0",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Profile
        </button> */}
      </div>

      {/* Week nav + view toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid #0a0a0d",
          flexShrink: 0,
        }}
      >
        <button type="button" onClick={() => setWeekOffset(o => o - 1)} style={detailNavBtn} aria-label="Previous week">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" onClick={() => setWeekOffset(o => o + 1)} style={detailNavBtn} aria-label="Next week">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <TimesheetWeekPicker dates={dates} onWeekOffsetChange={setWeekOffset} fontSize={14} fontWeight={600} />

        {isThisWeek && (
          <span
            style={{
              fontSize: 11,
              color: "#888",
              background: "#161616",
              border: "1px solid #2a2b2c",
              borderRadius: 6,
              padding: "2px 8px",
            }}
          >
            This week
          </span>
        )}
      </div>
        </>
      )}

      {/* Filters */}
      {/* <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          borderBottom: "1px solid #0a0a0d",
          flexShrink: 0,
        }}
      >
        <button type="button" style={filterPill}>
          <span style={{ color: "var(--brand)", fontWeight: 600 }}>$</span> Billable status
        </button>
        <button type="button" style={filterPill}>
          Tag
        </button>
        <button type="button" style={filterPill}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5.5 3v2.5L7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Tracked time
        </button>
      </div> */}

      <div style={TIMESHEET_SCROLL_ROOT}>
        {loading && <LoaderBlock />}
        {!loading && error && (
          <div style={{ padding: 32, textAlign: "center", color: "#e57373" }}>
            <div style={{ marginBottom: 16, fontSize: 14 }}>{error}</div>
            <button
              type="button"
              onClick={() => setRefreshKey(k => k + 1)}
              style={{
                background: "#2a2b2c",
                border: "1px solid #3a3b45",
                color: "#e0e0e0",
                borderRadius: 8,
                padding: "8px 20px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && (
          <div style={{ width: "100%", minWidth: TIMESHEET_GRID_MIN_WIDTH }}>
            <div
              style={{
                display: "grid",
                ...colStyle,
                borderBottom: "1px solid #222324",
              }}
            >
              <div style={{ ...detailHeaderCell, padding: headerCellPad, ...TIMESHEET_STICKY_HEADER_CORNER }}>Task / Location</div>
              {dates.map((date, i) => (
                <div key={i} style={{ ...detailHeaderCell, padding: headerCellPad, ...TIMESHEET_STICKY_HEADER_CELL, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#666", marginBottom: compactRows ? 0 : 2 }}>{fmtDateHeader(date)}</div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: totalByDay[i] > 0 ? "#e0e0e0" : "#888",
                    }}
                  >
                    {totalByDay[i] > 0 ? fmtMins(totalByDay[i]) : "0h"}
                  </div>
                </div>
              ))}
              <div style={{ ...detailHeaderCell, padding: headerCellPad, ...TIMESHEET_STICKY_HEADER_CELL, textAlign: "center" }}>Total</div>
            </div>

            {tasks.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#666", fontSize: 13 }}>
                No tasks on this timesheet for this week.
              </div>
            ) : (
              tasks.map(task => {
                const exp = isTaskExpanded(task.id)
                const rowTotal = task.time.reduce((a, b) => a + b, 0)
                const entries = Array.isArray(task.entries) ? task.entries : []

                return (
                  <div key={task.id}>
                    <div
                      style={{
                        display: "grid",
                        ...colStyle,
                        borderBottom: "1px solid #0a0a0d",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: taskRowPad,
                          borderRight: "1px solid #222324",
                          minWidth: 0,
                          ...TIMESHEET_STICKY_LEFT,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const wasExpanded = !!expanded[task.id]
                            setExpanded(p => ({ ...p, [task.id]: !p[task.id] }))
                            if (!wasExpanded) loadTaskEntries(task)
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#555",
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                            flexShrink: 0,
                            width: 16,
                            height: 16,
                            justifyContent: "center",
                          }}
                          aria-expanded={exp}
                          aria-label={exp ? "Collapse entries" : "Expand entries"}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
                            {exp ? (
                              <path d="M2 4l3 3 3-3" />
                            ) : (
                              <path d="M4 2l3 3-3 3" />
                            )}
                          </svg>
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: compactRows ? 12 : 13,
                              fontWeight: 600,
                              color: "#e8e8e8",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {task.name}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: compactRows ? 0 : 2 }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: task.dotColor,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 11,
                                color: "#666",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {task.space}
                            </span>
                          </div>
                        </div>

                        {!readOnly && (
                          <TimesheetRemoveTaskButton
                            onRemove={() => removeTaskFromSheet(task.id)}
                            removing={removingTaskId === task.id}
                            disabled={!timesheetId || !!removingTaskId}
                          />
                        )}
                      </div>

                      {task.time.map((mins, d) => (
                        <div
                          key={d}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: cellRowPad,
                            borderRight: "1px solid #222324",
                            fontSize: 12,
                            color: mins > 0 ? "#e0e0e0" : "#444",
                            fontWeight: mins > 0 ? 500 : 400,
                          }}
                        >
                          {mins > 0 ? fmtMins(mins) : "—"}
                        </div>
                      ))}

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: cellRowPad,
                          borderRight: "1px solid #222324",
                          fontSize: 12,
                          fontWeight: 600,
                          color: rowTotal > 0 ? "#e0e0e0" : "#888",
                        }}
                      >
                        {rowTotal > 0 ? fmtMins(rowTotal) : "—"}
                      </div>
                    </div>

                    {exp && (
                      <div style={{ background: "#141516" }}>
                        <div
                          style={{
                            display: "grid",
                            ...colStyle,
                            borderBottom: "1px solid #161616",
                          }}
                        >
                          <div
                            style={{
                              padding: "6px 12px 6px 40px",
                              fontSize: 11,
                              color: "#555",
                              borderRight: "1px solid #161616",
                              ...TIMESHEET_STICKY_LEFT_NESTED,
                            }}
                          >
                            {entriesLoading[task.id]
                              ? "Loading entries…"
                              : `${entries.length} time entr${entries.length === 1 ? "y" : "ies"}`}
                          </div>
                          {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} style={{ borderRight: "1px solid #161616" }} />
                          ))}
                          <div style={{ borderRight: "1px solid #161616" }} />
                        </div>

                        {entries.map(entry => {
                          const entryMins = entryMinsForDisplay(entry)
                          return (
                            <div
                              key={entry.id}
                              style={{
                                display: "grid",
                                ...colStyle,
                                borderBottom: "1px solid #161616",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "8px 12px 8px 40px",
                                  borderRight: "1px solid #161616",
                                  minWidth: 0,
                                  ...TIMESHEET_STICKY_LEFT_NESTED,
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                                  <circle cx="6" cy="6" r="5" stroke="#555" strokeWidth="1.2" />
                                  <path d="M6 3v3.5l2 1.5" stroke="#555" strokeWidth="1.2" strokeLinecap="round" />
                                </svg>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 11, color: "#999", marginBottom: 1 }}>
                                    {dates[entry.day] != null ? fmtDate(dates[entry.day]) : "—"}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#555",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {entry.label || "—"}
                                  </div>
                                </div>
                                {entry.billable && (
                                  <span
                                    style={{
                                      fontSize: 9,
                                      background: "#1a3a1a",
                                      color: "#4caf50",
                                      border: "1px solid #2a4a2a",
                                      borderRadius: 4,
                                      padding: "1px 5px",
                                    }}
                                  >
                                    $
                                  </span>
                                )}
                                {entry.live && (
                                  <span
                                    style={{
                                      fontSize: 9,
                                      background: "#3a1a1a",
                                      color: "#ef4444",
                                      border: "1px solid #4a2a2a",
                                      borderRadius: 4,
                                      padding: "1px 5px",
                                    }}
                                  >
                                    Live
                                  </span>
                                )}
                              </div>

                              {Array.from({ length: 7 }, (_, d) => (
                                <div
                                  key={d}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: "8px 4px",
                                    borderRight: "1px solid #161616",
                                    fontSize: 11,
                                  }}
                                >
                                  {d === entry.day && entryMins > 0 ? (
                                    <span style={{ color: "#c9cdd4", fontWeight: 500 }}>
                                      {fmtMins(entryMins)}
                                    </span>
                                  ) : null}
                                </div>
                              ))}

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  padding: "8px 12px",
                                  borderRight: "1px solid #161616",
                                  fontSize: 11,
                                  color: "#888",
                                }}
                              >
                                {entryMins > 0 ? fmtMins(entryMins) : "—"}
                              </div>
                            </div>
                          )
                        })}

                        {entries.length === 0 && !entriesLoading[task.id] && (
                          <div
                            style={{
                              display: "grid",
                              ...colStyle,
                              borderBottom: "1px solid #161616",
                            }}
                          >
                            <div
                              style={{
                                gridColumn: "1 / -1",
                                padding: "10px 40px",
                                fontSize: 11,
                                color: "#444",
                                fontStyle: "italic",
                              }}
                            >
                              No time entries for this task this week.
                            </div>
                          </div>
                        )}

                        {entriesMetadata[task.id]?.totalPages > 1 && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 16px 8px 40px",
                              borderBottom: "1px solid #161616",
                              background: "#0a0a0d",
                            }}
                          >
                            <span style={{ fontSize: 11, color: "#666" }}>
                              Page {entriesMetadata[task.id].currentPage} of {entriesMetadata[task.id].totalPages}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() =>
                                  loadTaskEntries(task, {
                                    page: Math.max(1, (entriesMetadata[task.id]?.currentPage ?? 1) - 1),
                                  })
                                }
                                disabled={(entriesMetadata[task.id]?.currentPage ?? 1) <= 1 || entriesLoading[task.id]}
                                style={{
                                  ...detailNavBtn,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  opacity:
                                    (entriesMetadata[task.id]?.currentPage ?? 1) <= 1 || entriesLoading[task.id]
                                      ? 0.4
                                      : 1,
                                  cursor:
                                    (entriesMetadata[task.id]?.currentPage ?? 1) <= 1 || entriesLoading[task.id]
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                                  <path
                                    d="M10 3L5 8l5 5"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                Previous
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  loadTaskEntries(task, {
                                    page: (entriesMetadata[task.id]?.currentPage ?? 1) + 1,
                                  })
                                }
                                disabled={
                                  (entriesMetadata[task.id]?.currentPage ?? 1) >=
                                    (entriesMetadata[task.id]?.totalPages ?? 1) || entriesLoading[task.id]
                                }
                                style={{
                                  ...detailNavBtn,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  opacity:
                                    (entriesMetadata[task.id]?.currentPage ?? 1) >=
                                      (entriesMetadata[task.id]?.totalPages ?? 1) || entriesLoading[task.id]
                                      ? 0.4
                                      : 1,
                                  cursor:
                                    (entriesMetadata[task.id]?.currentPage ?? 1) >=
                                      (entriesMetadata[task.id]?.totalPages ?? 1) || entriesLoading[task.id]
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                              >
                                Next
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                                  <path
                                    d="M6 3l5 5-5 5"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {tasksMetadata.totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderBottom: "1px solid #0a0a0d",
                  background: "#0a0a0d",
                }}
              >
                <span style={{ fontSize: 12, color: "#666" }}>
                  Page {tasksMetadata.currentPage} of {tasksMetadata.totalPages}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setTasksPage(p => Math.max(1, p - 1))}
                    disabled={tasksMetadata.currentPage <= 1 || loading}
                    style={{
                      ...detailNavBtn,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      opacity: tasksMetadata.currentPage <= 1 || loading ? 0.4 : 1,
                      cursor: tasksMetadata.currentPage <= 1 || loading ? "not-allowed" : "pointer",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setTasksPage(p => Math.min(tasksMetadata.totalPages, p + 1))}
                    disabled={tasksMetadata.currentPage >= tasksMetadata.totalPages || loading}
                    style={{
                      ...detailNavBtn,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      opacity: tasksMetadata.currentPage >= tasksMetadata.totalPages || loading ? 0.4 : 1,
                      cursor: tasksMetadata.currentPage >= tasksMetadata.totalPages || loading ? "not-allowed" : "pointer",
                    }}
                  >
                    Next
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {!readOnly && (
            <div style={{ padding: "12px 16px", borderTop: tasks.length > 0 ? "1px solid #0a0a0d" : undefined }}>
              <button
                type="button"
                onClick={loadAddTaskPicker}
                disabled={allAssignedLoading || addingTasks}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  color: allAssignedLoading ? "#444" : "#555",
                  fontSize: 12,
                  cursor: allAssignedLoading ? "wait" : "pointer",
                  padding: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                {allAssignedLoading ? "Loading…" : "Add task"}
              </button>
            </div>
            )}
          </div>
        )}
      </div>

      {showAddTask && (
        <AddTaskDialog
          existingTaskIds={new Set(tasks.map(t => String(t.id)))}
          pickerTasks={pickerTasksForDialog}
          adding={addingTasks}
          onClose={() => {
            if (addingTasks) return
            setShowAddTask(false)
            setPickerTasksForDialog(null)
          }}
          onAdd={addTasksFromDialog}
        />
      )}
    </div>
  )
}

function LoaderBlock() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 280,
        color: "var(--brand)",
      }}
    >
      <div style={{ animation: "allTimesheetSpin 0.85s linear infinite" }}>
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="50 100"
          />
        </svg>
      </div>
    </div>
  )
}

const navBtn = {
  background: "none",
  border: "none",
  color: "#666",
  cursor: "pointer",
  fontSize: 14,
  padding: "2px 6px",
  borderRadius: 4,
} as const

const filterPill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#161616",
  border: "1px solid #2a2b2c",
  color: "#aaa",
  borderRadius: 999,
  padding: "5px 12px",
  fontSize: 12,
  cursor: "pointer",
} as const

type AllTimesheetsProps = {
  workspaceId: string
  onOpenMember?: (memberId: string) => void
}

export default function AllTimesheets({ workspaceId, onOpenMember }: AllTimesheetsProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedMember, setSelectedMember] = useState<AllTimesheetsMember | null>(null)
  const [members, setMembers] = useState<AllTimesheetsMember[]>([])
  const [peopleCount, setPeopleCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [memberFilter, setMemberFilter] = useState<string>("all")
  const [membersPage, setMembersPage] = useState(1)
  const [membersMetadata, setMembersMetadata] = useState({
    totalPages: 1,
    currentPage: 1,
    nextPage: null as number | null,
    count: 0,
  })
  const pendingMembersPageResetRef = useRef(false)

  const weekRange = useMemo(() => getWeekRange(weekOffset), [weekOffset])
  const { dates, weekStartMs, weekEndMs } = weekRange

  useEffect(() => {
    pendingMembersPageResetRef.current = true
    setMembersPage(1)
  }, [weekOffset, workspaceId, refreshKey])

  useEffect(() => {
    let cancelled = false
    const pageToLoad = pendingMembersPageResetRef.current ? 1 : membersPage
    pendingMembersPageResetRef.current = false

    if (!workspaceId?.trim()) {
      setError("Missing workspace. Open Timesheets from a workspace context.")
      setMembers([])
      setPeopleCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    fetchAdminWorkspaceTimesheets(workspaceId.trim(), weekStartMs, weekEndMs, pageToLoad, TIMESHEET_PAGE_SIZE)
      .then(({ members: loaded, metadata }) => {
        if (cancelled) return
        setMembers(loaded)
        setMembersMetadata(metadata)
        setMembersPage(prev => (metadata.currentPage !== prev ? metadata.currentPage : prev))
        setPeopleCount(metadata.count)
        setError(null)
      })
      .catch(err => {
        if (cancelled) return
        let msg = "Failed to load team timesheets"
        if (axios.isAxiosError(err)) {
          const serverData = err.response?.data
          const serverMsg =
            typeof serverData === "string"
              ? serverData
              : (serverData as { message?: string; error?: string })?.message ??
                (serverData as { error?: string })?.error
          msg = serverMsg || err.message || msg
        } else if (err instanceof Error) {
          msg = err.message
        }
        setError(msg)
        setMembers([])
        setPeopleCount(0)
        toast.error(msg.slice(0, 200))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId, weekStartMs, weekEndMs, refreshKey, membersPage])

  const filteredMembers = useMemo(() => {
    if (memberFilter === "all") return members
    return members.filter(m => m.id === memberFilter)
  }, [members, memberFilter])

  const displayCount = memberFilter === "all" ? peopleCount || members.length : filteredMembers.length

  const colStyle = PEOPLE_COL_STYLE

  const openMember = (member: AllTimesheetsMember) => {
    setSelectedMember(member)
    onOpenMember?.(member.id)
  }

  if (selectedMember) {
    return (
      <MemberTimesheetDetail
        member={selectedMember}
        workspaceId={workspaceId}
        initialWeekOffset={weekOffset}
        onBack={() => setSelectedMember(null)}
      />
    )
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      {/* Week nav + member filter */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid #0a0a0d",
          flexShrink: 0,
        }}
      >
        <button type="button" onClick={() => setWeekOffset(o => o - 1)} style={navBtn} aria-label="Previous week">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button type="button" onClick={() => setWeekOffset(o => o + 1)} style={navBtn} aria-label="Next week">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 3l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <TimesheetWeekPicker dates={dates} onWeekOffsetChange={setWeekOffset} />

        {weekOffset !== 0 && (
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            style={{
              background: "#161616",
              border: "1px solid #2a2b2c",
              color: "#aaa",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            This week
          </button>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ position: "relative" }}>
          <select
            value={memberFilter}
            onChange={e => setMemberFilter(e.target.value)}
            style={{
              appearance: "none",
              background: "#161616",
              border: "1px solid #2a2b2c",
              color: "#e0e0e0",
              borderRadius: 8,
              padding: "7px 32px 7px 12px",
              fontSize: 13,
              cursor: "pointer",
              minWidth: 140,
            }}
          >
            <option value="all">All members</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#888" }}
          >
            <path d="M2.5 4.5L6 7.5l3.5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Filter pills */}
      {/* <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          borderBottom: "1px solid #0a0a0d",
          flexShrink: 0,
        }}
      >
        <button type="button" style={filterPill}>
          <span style={{ color: "var(--brand)", fontWeight: 600 }}>$</span> Billable status
        </button>
        <button type="button" style={filterPill}>
          Tag
        </button>
        <button type="button" style={filterPill}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5.5 3v2.5L7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Tracked time
        </button>
      </div> */}

      <div style={TIMESHEET_SCROLL_ROOT}>
        {loading && <LoaderBlock />}
        {!loading && error && (
          <div style={{ padding: 32, textAlign: "center", color: "#e57373" }}>
            <div style={{ marginBottom: 16, fontSize: 14 }}>{error}</div>
            <button
              type="button"
              onClick={() => setRefreshKey(k => k + 1)}
              style={{
                background: "#2a2b2c",
                border: "1px solid #3a3b45",
                color: "#e0e0e0",
                borderRadius: 8,
                padding: "8px 20px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && (
          <div style={{ width: "100%", minWidth: PEOPLE_GRID_MIN_WIDTH }}>
            {/* Header row */}
            <div
              style={{
                display: "grid",
                ...colStyle,
                borderBottom: "1px solid #222324",
              }}
            >
              <div style={{ ...headerCell, ...PEOPLE_STICKY_HEADER_CORNER }}>People ({displayCount})</div>
              {dates.map((date, i) => (
                <div key={i} style={{ ...headerCell, ...TIMESHEET_STICKY_HEADER_CELL, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>{fmtDateHeader(date)}</div>
                </div>
              ))}
              <div style={{ ...headerCell, ...TIMESHEET_STICKY_HEADER_CELL, textAlign: "center" }}>Total</div>
            </div>

            {filteredMembers.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#666", fontSize: 13 }}>
                No team members found for this week.
              </div>
            ) : (
              filteredMembers.map(member => (
                <div
                  key={member.id}
                  style={{
                    display: "grid",
                    ...colStyle,
                    borderBottom: "1px solid #0a0a0d",
                    alignItems: "stretch",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderRight: "1px solid #222324",
                      ...PEOPLE_STICKY_LEFT,
                    }}
                  >
                    {member.image ? (
                      <img
                        src={member.image}
                        alt=""
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "#2a2b35",
                          color: "#c9cdd4",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {initials(member.name)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#e8e8e8",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {member.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{member.weeklyCapacityH}h</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openMember(member)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#888",
                        fontSize: 12,
                        cursor: "pointer",
                        padding: "4px 0",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      Open →
                    </button>
                  </div>

                  {member.dailyMins.map((mins, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "8px 6px",
                        borderRight: "1px solid #222324",
                      }}
                    >
                      <DayCellHoverPopover
                        date={dates[i]}
                        dayData={member.dailyBreakdown[i] ?? { billable: 0, nonBillable: 0 }}
                        timeZone={member.timeZone}
                      >
                        <div
                          style={{
                            minWidth: 52,
                            padding: "8px 12px",
                            borderRadius: 8,
                            background: "#161616",
                            border: "1px solid #252628",
                            fontSize: 13,
                            color: mins > 0 ? "#e0e0e0" : "#888",
                            fontWeight: mins > 0 ? 600 : 400,
                            textAlign: "center",
                            cursor: "default",
                          }}
                        >
                          {fmtCellHours(mins)}
                        </div>
                      </DayCellHoverPopover>
                    </div>
                  ))}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "12px 8px",
                      fontSize: 13,
                      color: member.weekTotalMins > 0 ? "#e0e0e0" : "#888",
                      fontWeight: member.weekTotalMins > 0 ? 600 : 400,
                    }}
                  >
                    {fmtCellHours(member.weekTotalMins)}
                  </div>
                </div>
              ))
            )}

            {membersMetadata.totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderTop: "1px solid #0a0a0d",
                  background: "#0a0a0d",
                }}
              >
                <span style={{ fontSize: 12, color: "#666" }}>
                  Page {membersMetadata.currentPage} of {membersMetadata.totalPages}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setMembersPage(p => Math.max(1, p - 1))}
                    disabled={membersMetadata.currentPage <= 1 || loading}
                    style={{
                      ...navBtn,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      opacity: membersMetadata.currentPage <= 1 || loading ? 0.4 : 1,
                      cursor: membersMetadata.currentPage <= 1 || loading ? "not-allowed" : "pointer",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M10 3L5 8l5 5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setMembersPage(p => Math.min(membersMetadata.totalPages, p + 1))}
                    disabled={membersMetadata.currentPage >= membersMetadata.totalPages || loading}
                    style={{
                      ...navBtn,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      opacity:
                        membersMetadata.currentPage >= membersMetadata.totalPages || loading ? 0.4 : 1,
                      cursor:
                        membersMetadata.currentPage >= membersMetadata.totalPages || loading
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    Next
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M6 3l5 5-5 5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes allTimesheetSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

const headerCell = {
  padding: "10px 12px",
  fontSize: 11,
  color: "#666",
  fontWeight: 500,
  borderRight: "1px solid #222324",
} as const
