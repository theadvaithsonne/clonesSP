"use client"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import axios from "axios"
import dynamic from "next/dynamic"
import Cookies from "js-cookie"
import { isRoomObserver, useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace"

import TimesheetApprovals from "./TimesheetApprovals"
import { TimesheetWeekPicker } from "./TimesheetWeekPicker"
import TimesheetSubmissionDrawer from "./TimesheetSubmissionDrawer"

const AllTimesheets = dynamic(() => import("./AllTimesheets"), { ssr: false })
// ─── Icons (inline SVG, no dep) ───────────────────────────────────────────────
const Icon = {
  ChevronRight: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 2.5L7.5 6l-3 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M7.5 2.5L4.5 6l3 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ChevronDown: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 4.5L6 7.5l3.5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Play: () => (
    <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor">
      <path d="M1 1.5L8 5 1 8.5V1.5Z" />
    </svg>
  ),
  Stop: () => (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
      <rect x="0.5" y="0.5" width="8" height="8" rx="1.5" />
    </svg>
  ),
  Clock: () => (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 3v2.5L7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  Plus: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  X: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 4h9M5.5 4V2.75h3V4M5.25 11h3.5l.5-5.5H4.75l.5 5.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Dot: () => <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e24b4a', display: 'inline-block' }} />
}

/** ClickUp-style grid: fixed task column + scrollable day/total columns (delete lives in task cell) */
export const TIMESHEET_COL_STYLE = { gridTemplateColumns: "280px repeat(7, minmax(88px, 1fr)) 100px" }
export const TIMESHEET_GRID_MIN_WIDTH = 280 + 7 * 88 + 100
export const TIMESHEET_SCROLL_ROOT = { flex: 1, minHeight: 0, overflow: "auto" as const }
export const TIMESHEET_STICKY_LEFT = {
  position: "sticky" as const,
  left: 0,
  zIndex: 2,
  background: "#0a0a0d",
  boxShadow: "8px 0 12px -8px rgba(0,0,0,0.45)",
}
export const TIMESHEET_STICKY_LEFT_NESTED = {
  ...TIMESHEET_STICKY_LEFT,
  background: "#141516",
}
export const TIMESHEET_STICKY_HEADER_CORNER = {
  ...TIMESHEET_STICKY_LEFT,
  top: 0,
  zIndex: 12,
}
export const TIMESHEET_STICKY_HEADER_CELL = {
  position: "sticky" as const,
  top: 0,
  zIndex: 10,
  background: "#0a0a0d",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Grid column 0–6 (Sun–Sat) → API `draftDailyTotals` keys */
export const DAY_API_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
/** Default daily capacity (ClickUp-style); API does not provide this yet */
const DEFAULT_DAILY_CAPACITY_MINS = 8 * 60

export function fmtMins(m) {
  if (!m) return '—'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

/** Minutes → `00h 00m` pill (popover) */
function fmtHmPill(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0))
  const h = Math.floor(m / 60)
  const r = m % 60
  return `${String(h).padStart(2, '0')}h ${String(r).padStart(2, '0')}m`
}

function capacityPct(mins, capacityMins) {
  if (!capacityMins || capacityMins <= 0) return 0
  return Math.round((Math.max(0, mins) / capacityMins) * 100)
}

/** seconds → display (same as time-tracking.tsx fmtSeconds) */
function fmtSeconds(sec) {
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

function fmtTimer(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function parseMins(v) {
  const s = v.trim()
  const hm = s.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/i)
  if (hm && (hm[1] || hm[2])) return (+hm[1] || 0) * 60 + (+hm[2] || 0)
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.round(n * 60)
}

function fmtDate(d) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

function localDayStartMs(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function localDayEndMs(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
}

/** start/end epoch ms for manual entry on the clicked grid day (duration in minutes). */
function epochRangeForManualEntryOnDay(dayIndex, dates, durationMins) {
  if (dayIndex < 0 || dayIndex >= dates.length || durationMins <= 0) return null

  const dayStart = localDayStartMs(dates[dayIndex])
  const dayEnd = localDayEndMs(dates[dayIndex])
  const todayStart = localDayStartMs(new Date())
  const isToday = dayStart === todayStart

  let endEpoch = isToday ? Math.min(Date.now(), dayEnd) : dayEnd
  if (endEpoch <= dayStart) endEpoch = dayEnd

  let startEpoch = endEpoch - durationMins * 60 * 1000
  if (startEpoch < dayStart) {
    startEpoch = dayStart
    endEpoch = Math.min(dayStart + durationMins * 60 * 1000, dayEnd)
  }

  if (!Number.isFinite(startEpoch) || !Number.isFinite(endEpoch) || startEpoch >= endEpoch) {
    return null
  }
  return { startEpoch, endEpoch }
}

/** Which column index (0–6) in `dates` contains this instant in local time, or -1 */
function dayIndexForTimestamp(ms, dates) {
  const t = localDayStartMs(new Date(ms))
  for (let i = 0; i < dates.length; i++) {
    if (localDayStartMs(dates[i]) === t) return i
  }
  return -1
}

/** Calendar week: Sun–Sat local. `weekStart` / `weekEnd` = epoch ms for API (inclusive end of Sat). */
function getWeekRange(offsetWeeks) {
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
    23, 59, 59, 999
  ).getTime()
  return { dates, weekStartMs, weekEndMs }
}

/** True when today (local) falls inside the displayed Sun–Sat week. */
function isTodayInWeekRange(weekStartMs, weekEndMs) {
  const now = Date.now()
  return now >= weekStartMs && now <= weekEndMs
}

function taskroomBase() {
  const b = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/"
  return b.endsWith("/") ? b : `${b}/`
}

/** Same as time-tracking.tsx: POST/PUT /tasks/time/tracks */
function tracksApi() {
  return `${taskroomBase()}tasks/time/tracks`
}

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/** IANA timezone for the user's locale (e.g. America/New_York). */
function userTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

function extractSheetTasks(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.paginatedTaskEntries)) return payload.paginatedTaskEntries
    if (Array.isArray(payload.TaskData)) return payload.TaskData
    if (Array.isArray(payload.data)) return payload.data
    if (Array.isArray(payload.tasks)) return payload.tasks
    if (Array.isArray(payload.content)) return payload.content
    const inner = payload.data
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      if (Array.isArray(inner.paginatedTaskEntries)) return inner.paginatedTaskEntries
      if (Array.isArray(inner.TaskData)) return inner.TaskData
      if (Array.isArray(inner.tasks)) return inner.tasks
      if (Array.isArray(inner.content)) return inner.content
    }
  }
  return []
}

function getSheetDocument(payload) {
  if (!payload || typeof payload !== "object") return null
  if (
    payload.dailyTotals ||
    payload.draftDailyTotals ||
    payload.approvalDailyTotals ||
    payload.currentStatus != null ||
    payload.paginatedTaskEntries ||
    payload.taskEntries
  ) {
    return payload
  }
  const data = payload.data
  if (data && typeof data === "object" && !Array.isArray(data)) return data
  return null
}

/** API `data.currentStatus` values on GET /tasks/time/sheets */
export type TimesheetCurrentStatus = "draft" | "submitted" | "pending" | "approved" | "rejected"

function normalizeSheetCurrentStatus(raw) {
  if (raw == null) return null
  const s = String(raw).trim().toLowerCase()
  if (s === "draft" || s === "submitted" || s === "pending" || s === "approved" || s === "rejected") {
    return s
  }
  return null
}

export function sheetStatusLabel(status) {
  const s = normalizeSheetCurrentStatus(status)
  if (s === "rejected") return "Changes needed"
  if (s === "pending" || s === "submitted") return "Pending approval"
  if (s === "approved") return "Approved"
  return null
}

/** Normalize API `draftDailyTotals` / `approvalDailyTotals` / `dailyTotals` for Sun–Sat columns. */
function normalizeDailyTotals(raw) {
  if (!raw || typeof raw !== "object") return null
  const out = {}
  for (const key of DAY_API_KEYS) {
    const day = raw[key]
    if (day && typeof day === "object") {
      out[key] = {
        billable: Math.max(0, Math.round(Number(day.billable) || 0)),
        nonBillable: Math.max(0, Math.round(Number(day.nonBillable ?? day.non_billable) || 0)),
      }
    } else {
      out[key] = { billable: 0, nonBillable: 0 }
    }
  }
  return out
}

/** Prefer `dailyTotals` from the timesheet document (minutes per day); falls back to legacy fields. */
function extractDailyTotals(payload) {
  const doc = getSheetDocument(payload)
  if (!doc) return null
  const source = doc.dailyTotals ?? doc.draftDailyTotals ?? doc.approvalDailyTotals
  return normalizeDailyTotals(source)
}

/** Timesheet document _id from GET/POST sheets response. */
function extractSheetId(payload) {
  if (!payload || typeof payload !== "object") return null
  const tryId = v => (v != null && String(v).trim() !== "" ? String(v) : null)
  const root = tryId(payload._id ?? payload.id ?? payload.sheetId ?? payload.timeSheetId)
  if (root) return root
  const data = payload.data
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const fromData = tryId(data._id ?? data.id ?? data.sheetId ?? data.timeSheetId)
    if (fromData) return fromData
  }
  const sheet = payload.sheet
  if (sheet && typeof sheet === "object") {
    const fromSheet = tryId(sheet._id ?? sheet.id)
    if (fromSheet) return fromSheet
  }
  return null
}

function extractSheetStatus(payload) {
  if (!payload || typeof payload !== "object") return null
  const doc = getSheetDocument(payload)
  const data =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : null
  const raw =
    doc?.currentStatus ??
    doc?.submissionStatus ??
    data?.currentStatus ??
    data?.submissionStatus ??
    payload.currentStatus ??
    payload.submissionStatus
  return normalizeSheetCurrentStatus(raw)
}

function extractSheetRejectionReason(payload) {
  if (!payload || typeof payload !== "object") return null
  const doc = getSheetDocument(payload)
  const data =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : null
  const raw = doc?.rejectionReason ?? data?.rejectionReason ?? payload.rejectionReason
  if (raw == null || String(raw).trim() === "") return null
  return String(raw)
}

function extractTaskCount(payload, fallback = 0) {
  const doc = getSheetDocument(payload)
  if (doc && typeof doc.taskCount === "number") return Math.max(0, doc.taskCount)
  const meta = payload?.metadata
  if (meta && typeof meta.count === "number") return Math.max(0, meta.count)
  return fallback
}

export const TIMESHEET_PAGE_SIZE = 50
const TIME_TRACKS_PAGE_SIZE = 20

export function extractSheetMetadata(payload) {
  const meta = payload?.metadata
  if (meta && typeof meta === "object") {
    const totalPages = Math.max(1, Number(meta.totalPages) || 1)
    const currentPage = Math.max(1, Math.min(totalPages, Number(meta.currentPage) || 1))
    const nextPage = meta.nextPage != null ? Number(meta.nextPage) : null
    return { totalPages, currentPage, nextPage }
  }
  return { totalPages: 1, currentPage: 1, nextPage: null }
}

/** Dedupe concurrent GET for the same week (e.g. React Strict Mode double-mount). */
const weekSheetInflight = new Map()

async function loadWeekTimesheet(weekOffset, workspaceId, refreshKey = 0, page = 1, size = TIMESHEET_PAGE_SIZE) {
  const { dates: weekDates, weekStartMs: ws, weekEndMs: we } = getWeekRange(weekOffset)
  const wsId = workspaceId != null && String(workspaceId).trim() !== "" ? String(workspaceId).trim() : ""
  const safePage = Math.max(1, Number(page) || 1)
  const cacheKey = `${ws}-${we}-${wsId}-${refreshKey}-${safePage}-${size}`

  const existing = weekSheetInflight.get(cacheKey)
  if (existing) return existing

  const promise = (async () => {
    const query = new URLSearchParams()
    query.set("weekStart", String(ws))
    query.set("weekEnd", String(we))
    query.set("timeZone", String("Asia/Calcutta"))
    query.set("page", String(safePage))
    query.set("size", String(size))

    if (wsId) query.set("workspaceId", wsId)
    const url = `${taskroomBase()}tasks/time/sheets?${query.toString()}`
    const headers = authHeaders()

    const res = await axios.get(url, { headers })
    const payload = res.data

    const sheetId = extractSheetId(payload)
    const list = extractSheetTasks(payload)
    const dailyTotals = extractDailyTotals(payload)
    const metadata = extractSheetMetadata(payload)
    return {
      weekDates,
      sheetId,
      dailyTotals,
      metadata,
      currentStatus: extractSheetStatus(payload),
      rejectionReason: extractSheetRejectionReason(payload),
      taskCount: extractTaskCount(payload, list.length),
      tasks: list.map(raw => mapApiTaskToRow(raw, weekDates)),
    }
  })().finally(() => {
    weekSheetInflight.delete(cacheKey)
  })

  weekSheetInflight.set(cacheKey, promise)
  return promise
}

function extractTasklistRows(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.data)) return payload.data
    if (Array.isArray(payload.tasks)) return payload.tasks
    if (Array.isArray(payload.content)) return payload.content
    const inner = payload.data
    if (inner && typeof inner === "object") {
      if (Array.isArray(inner.tasks)) return inner.tasks
      if (Array.isArray(inner.content)) return inner.content
      if (Array.isArray(inner.data)) return inner.data
    }
  }
  return []
}

function fmtPickerUpdatedAt(v) {
  if (v == null) return "—"
  const ms = typeof v === "string" ? Date.parse(v) : Number(v)
  if (!Number.isFinite(ms)) return "—"
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Map API task row → AddTaskDialog list item */
function mapTasklistItemToPicker(raw) {
  const task = raw?.task && typeof raw.task === "object" ? raw.task : raw
  const id = String(task?._id ?? task?.id ?? raw?._id ?? raw?.taskId ?? uid())
  const name = String(task?.title ?? task?.name ?? raw?.title ?? raw?.name ?? "Untitled task")
  const status = String(task?.status ?? raw?.status ?? task?.taskStatus ?? "—")
  const spacePath = String(
    raw?.listName ??
    raw?.roomName ??
    raw?.spaceName ??
    task?.listName ??
    task?.spaceName ??
    raw?.space ??
    "—"
  )
  const dotColor = String(task?.color ?? raw?.color ?? "#fbd10d")
  const updatedAt = fmtPickerUpdatedAt(task?.updatedAt ?? raw?.updatedAt ?? task?.modifiedAt ?? raw?.modifiedAt)
  return { id, name, dotColor, status, space: spacePath, updatedAt }
}

/** Query params for GET /tasks/time/sheets/:id/all/tasklist */
type TimesheetAllTasklistQuery = {
  size?: number
  page?: number
  status?: string
  roomId?: string
  workspaceId?: string
  sBound?: number
  eBound?: number
  assignedToMe?: boolean
  spaceId?: string
}

function buildTimesheetAllTasklistUrl(timesheetId: string, query: TimesheetAllTasklistQuery) {
  const {
    size = 10,
    page = 1,
    status,
    roomId,
    workspaceId,
    sBound,
    eBound,
    assignedToMe = false,
    spaceId,
  } = query
  const params = new URLSearchParams()
  params.set("size", String(size))
  params.set("page", String(page))
  params.set("assignedToMe", String(assignedToMe))
  if (typeof sBound === "number") params.set("sBound", String(sBound))
  if (typeof eBound === "number") params.set("eBound", String(eBound))
  if (workspaceId) params.set("workspaceId", workspaceId)
  // if (spaceId) params.set("spaceId", spaceId)
  // if (roomId) params.set("roomId", roomId)
  if (status != null && String(status).trim() !== "") params.set("status", String(status).trim())
  return `${taskroomBase()}tasks/time/sheets/${timesheetId}/all/tasklist?${params.toString()}`
}

/** GET /tasks/time/sheets/:id/all/tasklist — tasks available to add to the timesheet. */
export async function fetchTimesheetAllTasklist(timesheetId: string, query: TimesheetAllTasklistQuery) {
  const url = buildTimesheetAllTasklistUrl(timesheetId, query)
  const res = await axios.get(url, { headers: authHeaders() })
  const rows = extractTasklistRows(res.data)
  return rows.map(mapTasklistItemToPicker)
}

/** PUT /tasks/time/sheets/:id/remove/tasks — remove tasks from the current week's timesheet. */
export async function removeTasksFromTimesheet(timesheetId: string, taskIds: string[]) {
  const res = await axios.put(
    `${taskroomBase()}tasks/time/sheets/${timesheetId}/remove/tasks`,
    { taskIds },
    { headers: authHeaders() }
  )
  const body = res.data
  if (body && typeof body === "object" && body.status === false) {
    throw new Error(body.message || body.error || "Failed to remove task from timesheet")
  }
  return res.data
}

/** PUT /tasks/time/sheets/submit/:id — submit timesheet for approval. */
export async function submitTimesheetForApproval(timesheetId: string) {
  const res = await axios.put(
    `${taskroomBase()}tasks/time/sheets/submit/${encodeURIComponent(timesheetId)}`,
    {},
    { headers: authHeaders() }
  )
  const body = res.data
  if (body && typeof body === "object" && body.status === false) {
    throw new Error(body.message || body.error || "Failed to submit timesheet for approval")
  }
  return res.data
}

export const TIMESHEET_SUBMISSION_PAGE_SIZE = 10

export type TimesheetSubmissionRecord = {
  id: string
  timesheetLogId: string
  userId: string
  approverId: string
  workspaceId: string
  weekStart: number
  weekEnd: number
  snapshotTaskEntries: unknown
  dailyTotals: ReturnType<typeof normalizeDailyTotals>
  submissionStatus: string
  rejectionReason: string | null
}

function extractSubmissionHistoryList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[]
  if (!payload || typeof payload !== "object") return []
  const root = payload as Record<string, unknown>
  if (Array.isArray(root.data)) return root.data as Record<string, unknown>[]
  if (Array.isArray(root.submissions)) return root.submissions as Record<string, unknown>[]
  const data = root.data
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const inner = data as Record<string, unknown>
    if (Array.isArray(inner.data)) return inner.data as Record<string, unknown>[]
    if (Array.isArray(inner.submissions)) return inner.submissions as Record<string, unknown>[]
  }
  return []
}

function mapSubmissionHistoryRow(raw: Record<string, unknown>): TimesheetSubmissionRecord | null {
  const id = String(raw._id ?? raw.id ?? raw.submissionId ?? "").trim()
  if (!id) return null
  return {
    id,
    timesheetLogId: String(raw.timesheetLogId ?? raw.timeSheetLogId ?? ""),
    userId: String(raw.userId ?? ""),
    approverId: String(raw.approverId ?? ""),
    workspaceId: String(raw.workspaceId ?? ""),
    weekStart: Number(raw.weekStart) || 0,
    weekEnd: Number(raw.weekEnd) || 0,
    snapshotTaskEntries: raw.snapshotTaskEntries ?? null,
    dailyTotals: normalizeDailyTotals(raw.dailyTotals),
    submissionStatus: String(raw.submissionStatus ?? raw.currentStatus ?? ""),
    rejectionReason: raw.rejectionReason != null ? String(raw.rejectionReason) : null,
  }
}

/** GET /tasks/time/sheets/:id/submissions — paginated submission history for a timesheet. */
export async function fetchTimesheetSubmissions(
  timesheetId: string,
  page = 1,
  size = TIMESHEET_SUBMISSION_PAGE_SIZE
) {
  const safePage = Math.max(1, Number(page) || 1)
  const params = new URLSearchParams({
    page: String(safePage),
    size: String(size),
  })
  const url = `${taskroomBase()}tasks/time/sheets/${encodeURIComponent(timesheetId)}/submissions?${params}`
  const res = await axios.get(url, { headers: authHeaders() })
  const payload = res.data
  if (payload && typeof payload === "object" && payload.status === false) {
    throw new Error(payload.message || payload.error || "Failed to load submission history")
  }
  const rows = extractSubmissionHistoryList(payload)
  const submissions = rows
    .map(mapSubmissionHistoryRow)
    .filter((s): s is TimesheetSubmissionRecord => s != null)
  return { submissions, metadata: extractSheetMetadata(payload) }
}

/** PUT /tasks/time/sheets/:id/revoke/submission — cancel the active timesheet submission. */
export async function revokeTimesheetSubmission(timesheetId: string) {
  const res = await axios.put(
    `${taskroomBase()}tasks/time/sheets/${encodeURIComponent(timesheetId)}/revoke/submission`,
    {},
    { headers: authHeaders() }
  )
  const body = res.data
  if (body && typeof body === "object" && body.status === false) {
    throw new Error(body.message || body.error || "Failed to revoke submission")
  }
  return res.data
}

export function TimesheetRemoveTaskButton({
  onRemove,
  disabled,
  removing,
}: {
  onRemove: () => void
  disabled?: boolean
  removing?: boolean
}) {
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        onRemove()
      }}
      disabled={disabled || removing}
      aria-label="Remove task from timesheet"
      title="Remove from timesheet"
      style={{
        background: "none",
        border: "none",
        color: removing ? "#444" : "#666",
        cursor: disabled || removing ? "not-allowed" : "pointer",
        padding: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        opacity: disabled ? 0.35 : 1,
      }}
      onMouseEnter={e => {
        if (!disabled && !removing) e.currentTarget.style.color = "#ef4444"
      }}
      onMouseLeave={e => {
        if (!disabled && !removing) e.currentTarget.style.color = "#666"
      }}
    >
      <Icon.Trash />
    </button>
  )
}


function fmtRangeFromEpoch(startMs, endMs) {
  const fmt = d =>
    new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()
  if (endMs == null || !Number.isFinite(endMs)) return `${fmt(startMs)} – Now`
  return `${fmt(startMs)} – ${fmt(endMs)}`
}

/** API dayOfWeek: 1 = Sunday … 7 = Saturday → grid column 0–6 (Sun–Sat). */
function apiDayOfWeekToColumn(dayOfWeek) {
  const n = Number(dayOfWeek)
  if (!Number.isFinite(n)) return -1
  if (n >= 1 && n <= 7) return n - 1
  if (n >= 0 && n <= 6) return n
  return -1
}

/** One time log → grid entry (flat or nested dayWiseData row). */
function mapTimeLogEntry(tr, weekDates, dayOfWeekHint) {
  const start = tr.startTime ?? tr.start ?? tr.startedAt
  if (start == null) return null
  const startMs = typeof start === "string" ? Date.parse(start) : Number(start)
  if (!Number.isFinite(startMs)) return null

  const endRaw = tr.endTime ?? tr.end ?? tr.endedAt
  const endMs =
    endRaw == null || endRaw === undefined
      ? null
      : typeof endRaw === "string"
        ? Date.parse(endRaw)
        : Number(endRaw)

  const dow =
    tr.dayOfWeek ??
    tr.dayOfweek ??
    dayOfWeekHint ??
    (tr._id && typeof tr._id === "object" ? tr._id.dayOfWeek : undefined)

  let day = dow != null ? apiDayOfWeekToColumn(dow) : -1
  if (day < 0) day = dayIndexForTimestamp(startMs, weekDates)
  if (day < 0) return null

  const live = endMs == null || !Number.isFinite(endMs)

  let mins = 0
  if (typeof tr.timePeriod === "number" && tr.timePeriod > 0 && !live) {
    mins = Math.max(0, Math.round(tr.timePeriod))
  } else if (typeof tr.durationMinutes === "number") {
    mins = Math.max(0, Math.round(tr.durationMinutes))
  } else if (live) {
    mins = Math.max(0, Math.round((Date.now() - startMs) / 60000))
  } else if (endMs != null && Number.isFinite(endMs)) {
    mins = Math.max(1, Math.round((endMs - startMs) / 60000))
  } else if (typeof tr.duration === "number" && tr.duration > 0) {
    mins = Math.max(0, Math.round(tr.duration / 60))
  }

  const label = tr.label ?? tr.comment ?? fmtRangeFromEpoch(startMs, live ? null : endMs)
  const rawId = tr._id
  const trackId =
    rawId != null && typeof rawId !== "object" ? String(rawId) : undefined

  return {
    id: trackId ?? uid(),
    trackId,
    day,
    mins,
    label,
    live,
    billable: !!(tr.isBillable ?? tr.billable),
    startTime: startMs,
    comment: String(tr.comment ?? ""),
    tags: Array.isArray(tr.tags) ? tr.tags : [],
  }
}

/** Map weekData[] → grid entries (dayWiseData per day). */
function flattenWeekData(weekData, weekDates) {
  const entries = []
  if (!Array.isArray(weekData)) return entries

  for (const weekDay of weekData) {
    const dow =
      weekDay?.dayOfWeek ?? weekDay?._id?.dayOfWeek ?? weekDay?._id?.dayOfweek
    const logs =
      weekDay?.dayWiseData ??
      weekDay?.dayWiseLogs ??
      weekDay?.logs ??
      weekDay?.entries ??
      []
    if (!Array.isArray(logs)) continue
    for (const tr of logs) {
      const row = mapTimeLogEntry(tr, weekDates, dow)
      if (row) entries.push(row)
    }
  }

  return entries
}

/** API may return activeLogs as an array or a single running log object. */
function normalizeActiveLogs(activeLogs) {
  if (activeLogs == null) return []
  if (Array.isArray(activeLogs)) return activeLogs.filter(Boolean)
  if (typeof activeLogs !== "object") return []
  if (activeLogs.startTime != null || activeLogs.start != null || activeLogs._id != null) {
    return [activeLogs]
  }
  return []
}

/**
 * New API shape:
 *   timeLogsData.activeLogs — running timer (object or array)
 *   timeLogsData.completedLogs.weekData — finished entries by day
 * Legacy: timeLogsData.weekData at top level.
 */
function flattenTimeLogsData(timeLogsData, weekDates) {
  if (!timeLogsData || typeof timeLogsData !== "object" || Array.isArray(timeLogsData)) {
    return []
  }

  const entries = []

  const completed = timeLogsData.completedLogs
  const weekData =
    (completed && typeof completed === "object" ? completed.weekData : null) ??
    timeLogsData.weekData

  entries.push(...flattenWeekData(weekData, weekDates))

  for (const tr of normalizeActiveLogs(timeLogsData.activeLogs)) {
    const row = mapTimeLogEntry(tr, weekDates, tr.dayOfWeek)
    if (row) {
      // mins: 0 — live duration comes from timer tick (same as local startTimer)
      entries.push({ ...row, live: true, mins: 0 })
    }
  }

  return entries
}

/** Flatten time logs: legacy array sources or nested weekData blocks. */
function flattenTimeLogsFromApi(source, weekDates) {
  if (!source) return []

  if (!Array.isArray(source) && typeof source === "object") {
    if (source.activeLogs != null || source.completedLogs != null) {
      return flattenTimeLogsData(source, weekDates)
    }
    return flattenWeekData(source.weekData, weekDates)
  }

  const entries = []
  if (!Array.isArray(source)) return entries

  for (const block of source) {
    if (Array.isArray(block?.weekData)) {
      entries.push(...flattenWeekData(block.weekData, weekDates))
      continue
    }
    if (block?.startTime != null || block?.start != null) {
      const row = mapTimeLogEntry(block, weekDates, undefined)
      if (row) entries.push(row)
    }
  }

  return entries
}

/** Query params for GET /tasks/time/tracks — time-log entries for one task within a date range. */
export type TimeTracksQuery = {
  taskId: string
  weekStart: number
  weekEnd: number
  status?: string
  size?: number
  page?: number
  isPersonal?: boolean
  timeSheetUserId?: string
}

function buildTimeTracksUrl(query: TimeTracksQuery) {
  const {
    taskId,
    weekStart,
    weekEnd,
    status,
    size = TIME_TRACKS_PAGE_SIZE,
    page = 1,
    isPersonal = true,
    timeSheetUserId,
  } = query
  const params = new URLSearchParams()
  params.set("taskId", taskId)
  params.set("weekStart", String(weekStart))
  params.set("weekEnd", String(weekEnd))
  params.set("size", String(size))
  params.set("page", String(page))
  params.set("isPersonal", String(isPersonal))
  if (timeSheetUserId != null && String(timeSheetUserId).trim() !== "") {
    params.set("timeSheetUserId", String(timeSheetUserId).trim())
  }
  if (status != null && String(status).trim() !== "") params.set("status", String(status).trim())
  return `${tracksApi()}?${params.toString()}`
}

function extractTimeTrackMetadata(payload) {
  const meta = payload?.metadata
  if (meta && typeof meta === "object") {
    const totalPages = Math.max(1, Number(meta.totalPages) || 1)
    const currentPage = Math.max(1, Math.min(totalPages, Number(meta.currentPage) || 1))
    const nextPage = meta.nextPage != null ? Number(meta.nextPage) : null
    return { totalPages, currentPage, nextPage }
  }
  return { totalPages: 1, currentPage: 1, nextPage: null }
}

function extractTimeTrackRows(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.data)) return payload.data
    if (Array.isArray(payload.tracks)) return payload.tracks
    if (Array.isArray(payload.content)) return payload.content
    const inner = payload.data
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      if (Array.isArray(inner.tracks)) return inner.tracks
      if (Array.isArray(inner.data)) return inner.data
      if (Array.isArray(inner.content)) return inner.content
    }
  }
  return []
}

/** GET /tasks/time/tracks — one page of time-log entries for a single task. */
export async function fetchTaskTimeTracks(query: TimeTracksQuery, weekDates: Date[]) {
  const pageSize = query.size ?? TIME_TRACKS_PAGE_SIZE
  const page = Math.max(1, query.page ?? 1)
  const url = buildTimeTracksUrl({ ...query, size: pageSize, page })
  const res = await axios.get(url, { headers: authHeaders() })
  const payload = res.data
  const rows = extractTimeTrackRows(payload)
  const metadata = extractTimeTrackMetadata(payload)
  const entries = rows.map(tr => mapTimeLogEntry(tr, weekDates, undefined)).filter(Boolean)
  return { entries, metadata }
}

/** Per-day `isTimerRunning` on paginatedTaskEntries → grid column 0–6 (Sun–Sat). */
function findTimerRunningDayIndex(raw) {
  if (!raw || typeof raw !== "object") return -1
  for (let i = 0; i < DAY_API_KEYS.length; i++) {
    const day = raw[DAY_API_KEYS[i]]
    if (day && day.isTimerRunning === true) return i
  }
  return -1
}

/** `taskDetails.activeTimerDetails` from paginatedTaskEntries → live entry + running track. */
function mapActiveTimerFromPaginatedRow(raw, weekDates) {
  const taskDetails =
    raw?.taskDetails && typeof raw.taskDetails === "object" ? raw.taskDetails : null
  const activeTimer = taskDetails?.activeTimerDetails
  if (!activeTimer || typeof activeTimer !== "object") return null

  const runningDay = findTimerRunningDayIndex(raw)
  const isActive =
    activeTimer.isTimerActive === true ||
    activeTimer.status === "active" ||
    runningDay >= 0
  if (!isActive || activeTimer.startTime == null) return null

  const dayOfWeekHint =
    activeTimer.dayOfWeek ??
    (runningDay >= 0 ? runningDay + 1 : undefined)

  const entry = mapTimeLogEntry(activeTimer, weekDates, dayOfWeekHint)
  if (!entry) return null

  const trackId = String(activeTimer._id ?? activeTimer.id ?? entry.trackId ?? "")
  if (!trackId) return null

  const liveEntry = { ...entry, live: true, mins: 0, trackId }
  const taskId = String(activeTimer.taskId ?? taskDetails?._id ?? raw.taskId ?? "")

  return {
    entry: liveEntry,
    track: {
      _id: trackId,
      taskId,
      roomId: String(activeTimer.roomId ?? taskDetails?.roomId ?? raw.roomId ?? ""),
      startTime: liveEntry.startTime,
      comment: String(activeTimer.comment ?? ""),
      tags: Array.isArray(activeTimer.tags) ? activeTimer.tags : [],
      liveDay: liveEntry.day,
    },
  }
}

/** Map one API row → local task row for the grid (best-effort field names). */
function mapApiTaskToRow(raw, weekDates) {
  const taskDetails =
    raw.taskDetails && typeof raw.taskDetails === "object" ? raw.taskDetails : null
  const task = raw.task && typeof raw.task === "object" ? raw.task : taskDetails ?? raw
  const id = String(
    taskDetails?.taskId ??
    task._id ??
    task.id ??
    raw._id ??
    raw.taskId ??
    uid()
  )
  const name = String(
    taskDetails?.title ??
    task.title ??
    task.name ??
    raw.title ??
    raw.name ??
    "Untitled task"
  )
  const stageName =
    taskDetails?.stageName ??
    task.stageData?.name ??
    raw.stageData?.name ??
    task.stageName ??
    raw.stageName
  const status = String(stageName ?? task.status ?? raw.status ?? task.taskStatus ?? "—")
  const spaceParts = [
    taskDetails?.spaceName ?? task.spaceData?.name ?? raw.spaceData?.name ?? task.spaceName ?? raw.spaceName,
    taskDetails?.roomName ??
    task.roomData?.name ??
    raw.roomData?.name ??
    task.roomName ??
    raw.roomName ??
    raw.listName,
  ].filter(Boolean)
  const spacePath =
    spaceParts.length > 0
      ? spaceParts.join(" / ")
      : String(
        raw.listName ??
        raw.roomName ??
        raw.spaceName ??
        task.listName ??
        task.spaceName ??
        raw.space ??
        "—"
      )
  const dotColor = String(
    taskDetails?.stageColor ??
    task.stageData?.color ??
    raw.stageData?.color ??
    task.color ??
    raw.color ??
    "#fbd10d"
  )

  // paginatedTaskEntries rows carry per-day {billable, nonBillable} totals directly on the row —
  // there's no individual time-log/track data in this response shape, so `entries` is left empty
  // here and populated separately via fetchTaskTimeTracks().
  const hasOwnDailyTotals = DAY_API_KEYS.some(key => raw?.[key] && typeof raw[key] === "object")

  let entries = []
  let time

  if (hasOwnDailyTotals) {
    time = dailyTotalsToTimeArray(raw)
    const active = mapActiveTimerFromPaginatedRow(raw, weekDates)
    if (active) entries = [active.entry]
  } else {
    const timeLogsData = raw.timeLogsData ?? task.timeLogsData
    entries =
      timeLogsData != null && typeof timeLogsData === "object" && !Array.isArray(timeLogsData)
        ? flattenTimeLogsData(timeLogsData, weekDates)
        : flattenTimeLogsFromApi(
          raw.tracks ??
          raw.timeLogs ??
          raw.logs ??
          raw.timeTracks ??
          raw.entries ??
          task.tracks ??
          task.timeLogs ??
          [],
          weekDates
        )
    time = deriveTime(entries)
  }

  const roomId = String(
    task.roomId ?? raw.roomId ?? task.roomData?._id ?? raw.roomData?._id ?? ""
  )

  return {
    id,
    name,
    dotColor,
    roomId,
    space: `${status} · ${spacePath}`,
    entries,
    time,
  }
}

/** Normalize GET/POST timesheet payload → grid rows (shared with admin All Timesheets). */
export function parseTimesheetApiPayload(payload: unknown, weekDates: Date[]) {
  const sheetId = extractSheetId(payload)
  const list = extractSheetTasks(payload)
  const dailyTotals = extractDailyTotals(payload)
  return {
    sheetId,
    dailyTotals,
    tasks: list.map(raw => mapApiTaskToRow(raw, weekDates)),
  }
}

/** Resume server-side running track after week load (same as time-tracking activeTimeLog). */
function findRunningTrack(tasks) {
  for (const t of tasks) {
    for (const e of t.entries || []) {
      if (e.live && e.trackId && e.startTime != null) {
        return {
          _id: e.trackId,
          taskId: t.id,
          roomId: t.roomId || "",
          startTime: e.startTime,
          comment: e.comment ?? "",
          tags: e.tags ?? [],
          liveDay: e.day,
        }
      }
    }
  }
  return null
}

// ─── Unique ID ────────────────────────────────────────────────────────────────
let _uid = 0
const uid = () => `e${++_uid}`

// Derive time[7] from entries
function deriveTime(entries) {
  const t = Array(7).fill(0)
  entries.forEach(e => { t[e.day] = (t[e.day] || 0) + e.mins })
  return t
}

/** paginatedTaskEntries rows carry per-day {billable, nonBillable} totals directly — no individual time-log entries. */
function dailyTotalsToTimeArray(raw) {
  const normalized = normalizeDailyTotals(raw)
  if (!normalized) return Array(7).fill(0)
  return DAY_API_KEYS.map(key => {
    const day = normalized[key]
    return day ? day.billable + day.nonBillable : 0
  })
}

// ─── EMPTY STATE (ClickUp-style) ─────────────────────────────────────────────
function TimesheetEmptyState({ onAllAssigned, onLastWeek, onIndividual, onTrackTime, allAssignedLoading = false }) {
  const cardBase = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 18px",
    borderRadius: 10,
    border: "1px solid #2a2b35",
    background: "#16161c",
    color: "#c9cdd4",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
  }
  const iconWrap = { color: "#8b7fd8", flexShrink: 0, display: "flex" }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px 64px",
        minHeight: 280,
      }}
    >
      <div style={{ position: "relative", marginBottom: 20 }}>
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden>
          <circle cx="36" cy="40" r="22" stroke="#3a3b45" strokeWidth="2.5" />
          <path
            d="M36 26v14l10 6"
            stroke="#4a4b55"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="30" y="14" width="12" height="6" rx="2" fill="#3a3b45" />
        </svg>
        <div
          style={{
            position: "absolute",
            right: -2,
            bottom: 4,
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "var(--brand)",
            border: "3px solid #0a0a0d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0a0a0d",
          }}
        >
          <Icon.Plus />
        </div>
      </div>
      <h2
        style={{
          margin: "0 0 28px",
          fontSize: 16,
          fontWeight: 600,
          color: "#e8e9ed",
          textAlign: "center",
          maxWidth: 420,
          lineHeight: 1.35,
        }}
      >
        Add entries to this week&apos;s timesheet
      </h2>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "center",
          maxWidth: 720,
        }}
      >
        <button
          type="button"
          onClick={onAllAssigned}
          disabled={allAssignedLoading}
          style={{
            ...cardBase,
            cursor: allAssignedLoading ? "wait" : "pointer",
            opacity: allAssignedLoading ? 0.85 : 1,
          }}
        >
          <span style={iconWrap}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="12" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M3 14c1-2 3.5-3 6-3s5 1 6 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
          {allAssignedLoading ? "Loading tasks…" : "All assigned tasks"}
        </button>
        {/* <button type="button" onClick={onLastWeek} style={cardBase}>
          <span style={iconWrap}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="3" y="4" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <rect x="7" y="6" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </span>
          Last week&apos;s tasks
        </button>
        <button type="button" onClick={onIndividual} style={cardBase}>
          <span style={iconWrap}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M9 2v3M9 13v3M2 9h3M13 9h3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <circle cx="9" cy="9" r="1.2" fill="currentColor" />
            </svg>
          </span>
          Individual tasks
        </button>
        <button type="button" onClick={onTrackTime} style={cardBase}>
          <span style={iconWrap}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9 6v4l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
          Track time
        </button> */}
      </div>
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
      <div style={{ animation: "timesheetSpin 0.85s linear infinite" }}>
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

type DialogTaskRow = {
  id: string | number
  name: string
  dotColor: string
  status: string
  space: string
  updatedAt: string
}

// ─── ADD TASK DIALOG ─────────────────────────────────────────────────────────
export function AddTaskDialog({
  existingTaskIds,
  onClose,
  onAdd,
  pickerTasks,
  adding = false,
}: {
  existingTaskIds: Set<string>
  onClose: () => void
  onAdd: (picked: DialogTaskRow[]) => void | Promise<void>
  pickerTasks?: DialogTaskRow[] | null
  adding?: boolean
}) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState({})
  const ref = useRef<HTMLInputElement | null>(null)

  const sourcePool: DialogTaskRow[] = pickerTasks ?? []

  useEffect(() => {
    ref.current?.focus()
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Filter pool: exclude tasks already in the timesheet, apply search
  const pool = sourcePool.filter(t => {
    if (existingTaskIds.has(String(t.id))) return false
    if (search.trim()) return t.name.toLowerCase().includes(search.toLowerCase())
    return true
  })

  const selectedCount = Object.values(selected).filter(Boolean).length

  function toggle(id) {
    setSelected(p => ({ ...p, [id]: !p[id] }))
  }

  async function handleAdd() {
    const toAdd = pool.filter(t => selected[t.id])
    if (toAdd.length === 0 || adding) return
    await onAdd(toAdd)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#161616'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#161616', border: '1px solid #2a2b2c',
          borderRadius: 12, width: 520, maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)'
        }}
      >
        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderBottom: '1px solid #222'
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#666', flexShrink: 0 }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            ref={ref}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: '#c9cdd4',
            }}
          />
        </div>

        {/* <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: '1px solid #222'
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#e0e0e0' }}>All Tasks</span>
          <button type="button" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', color: '#666',
            fontSize: 12, cursor: 'pointer'
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Filter
          </button>
        </div> */}

        {/* Task list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {pool.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#444', fontSize: 13 }}>
              {search ? 'No tasks match your search' : 'All tasks already added to timesheet'}
            </div>
          ) : (
            pool.map(task => {
              const checked = !!selected[task.id]
              return (
                <div
                  key={task.id}
                  onClick={() => toggle(task.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', cursor: 'pointer',
                    background: checked ? '#2a2460' : 'transparent',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#1a1b2e' }}
                  onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Status icon (circle with dashes = To Do) */}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: '#666' }}>
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" strokeDasharray="3 2" />
                  </svg>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: checked ? '#e0e0e0' : '#c9cdd4' }}>
                      {task.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: '#555' }}>{task.status}</span>
                      <span style={{ fontSize: 11, color: '#444' }}>•</span>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: task.dotColor, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: 11, color: '#555' }}>{task.space}</span>
                      <span style={{ fontSize: 11, color: '#444' }}>•</span>
                      <span style={{ fontSize: 11, color: '#555' }}>{task.updatedAt}</span>
                    </div>
                  </div>

                  {/* Checkbox */}
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: checked ? 'none' : '1.5px solid #444',
                    background: checked ? 'var(--brand)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}>
                    {checked && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
          padding: '12px 16px', borderTop: '1px solid #222'
        }}>
          <button
            onClick={onClose}
            disabled={adding}
            style={{
              background: 'none', border: 'none', color: adding ? '#555' : '#888',
              fontSize: 13, cursor: adding ? 'wait' : 'pointer', padding: '6px 12px', borderRadius: 6
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedCount === 0 || adding}
            style={{
              background: selectedCount > 0 && !adding ? 'var(--brand)' : '#333',
              color: selectedCount > 0 && !adding ? 'var(--brand-foreground)' : '#555',
              border: 'none', borderRadius: 8,
              padding: '7px 18px', fontSize: 13, fontWeight: 600,
              cursor: selectedCount > 0 && !adding ? 'pointer' : 'wait',
              transition: 'all 0.15s'
            }}
          >
            {adding
              ? 'Adding…'
              : selectedCount > 0
                ? `Add ${selectedCount} task${selectedCount > 1 ? 's' : ''}`
                : 'Add tasks'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TIME ENTRY MODAL ─────────────────────────────────────────────────────────
function TimeEntryModal({ taskName, day, dates, onClose, onSave }) {
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    ref.current?.focus()
    const h = e => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose, saving])

  const dateLabel = day >= 0 ? fmtDate(dates[day]) : '—'

  async function handleSave() {
    const m = parseMins(val)
    if (m <= 0) {
      toast.error("Enter a valid duration (e.g. 1h 30m, 45m)")
      return
    }
    setSaving(true)
    try {
      await onSave(m)
      onClose()
    } catch {
      // Parent shows toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 140, background: 'rgba(0,0,0,0.55)'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0a0a0d', border: '1px solid #3a3b3c',
          borderRadius: 12, padding: 16, width: 320,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, marginRight: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: 'var(--brand-foreground)'
            }}>{(taskName || 'T').charAt(0).toUpperCase()}</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskName || 'Task'}</span>
          </div>
          <button onClick={onClose} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Icon.X />
          </button>
        </div>

        <input
          ref={ref}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !saving && handleSave()}
          disabled={saving}
          placeholder="e.g. 1h 30m, 45m, 2h"
          style={{
            width: '100%', background: '#141414',
            border: '2px solid var(--brand)', borderRadius: 8,
            padding: '8px 12px', fontSize: 13, color: '#e0e0e0',
            outline: 'none', boxSizing: 'border-box', marginBottom: 12
          }}
        />

        <div style={{ fontSize: 12, color: '#888', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon.Clock /> {dateLabel}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'none', border: 'none', color: '#666', fontSize: 12,
              cursor: saving ? 'wait' : 'pointer', padding: '6px 8px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saving ? '#555' : 'var(--brand)', color: 'var(--brand-foreground)', border: 'none',
              borderRadius: 8, padding: '6px 16px', fontSize: 12,
              fontWeight: 500, cursor: saving ? 'wait' : 'pointer'
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── START TIMER MODAL ────────────────────────────────────────────────────────
function StartTimerModal({ taskName, starting, onClose, onStart }) {
  const [isBillable, setIsBillable] = useState(false)

  useEffect(() => {
    const h = e => { if (e.key === 'Escape' && !starting) onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose, starting])

  return (
    <div
      onClick={() => { if (!starting) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 140, background: 'rgba(0,0,0,0.55)'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0a0a0d', border: '1px solid #3a3b3c',
          borderRadius: 12, padding: 16, width: 320,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, marginRight: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: 'var(--brand-foreground)'
            }}>{(taskName || 'T').charAt(0).toUpperCase()}</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskName || 'Task'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={starting}
            style={{ color: '#666', background: 'none', border: 'none', cursor: starting ? 'wait' : 'pointer', padding: 0 }}
          >
            <Icon.X />
          </button>
        </div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 16, cursor: starting ? 'wait' : 'pointer', userSelect: 'none'
        }}>
          <input
            type="checkbox"
            checked={isBillable}
            disabled={starting}
            onChange={e => setIsBillable(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: 'var(--brand)', cursor: starting ? 'wait' : 'pointer' }}
          />
          <span style={{ fontSize: 13, color: '#c9cdd4' }}>Billable</span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={starting}
            style={{
              background: 'none', border: 'none', color: '#666', fontSize: 12,
              cursor: starting ? 'wait' : 'pointer', padding: '6px 8px'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onStart(isBillable)}
            disabled={starting}
            style={{
              background: starting ? '#555' : 'var(--brand)', color: 'var(--brand-foreground)', border: 'none',
              borderRadius: 8, padding: '6px 16px', fontSize: 12,
              fontWeight: 500, cursor: starting ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Icon.Play />
            {starting ? 'Starting…' : 'Start timer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DAY COLUMN HEADER HOVER POPOVER ─────────────────────────────────────────
function DayHeaderHoverPopover({ date, dayIndex, dailyTotals, accent, children }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const hideTimerRef = useRef(null)

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

  const apiKey = DAY_API_KEYS[dayIndex] ?? DAY_API_KEYS[0]
  const dayData = dailyTotals?.[apiKey] ?? { billable: 0, nonBillable: 0 }
  const billable = dayData.billable ?? 0
  const nonBillable = dayData.nonBillable ?? 0
  const tracked = billable + nonBillable
  const capacity = DEFAULT_DAILY_CAPACITY_MINS
  const remaining = Math.max(0, capacity - tracked)

  const fullDateLabel = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const pill = mins => (
    <span style={{
      fontSize: 11, fontWeight: 500, color: '#e0e0e0',
      background: '#2a2b2c', borderRadius: 6,
      padding: '2px 8px', fontVariantNumeric: 'tabular-nums',
    }}>
      {fmtHmPill(mins)}
    </span>
  )

  const popoverRow = (label: string, mins: number, pct: number, opts: { indent?: boolean; muted?: boolean } = {}) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 10, paddingLeft: opts.indent ? 14 : 0, marginTop: opts.indent ? 6 : 0,
    }}>
      <span style={{ fontSize: 12, color: opts.muted ? '#888' : '#c9cdd4' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#666', minWidth: 28, textAlign: 'right' }}>{pct}%</span>
        {pill(mins)}
      </div>
    </div>
  )

  const popover = open && typeof document !== 'undefined' ? createPortal(
    <div
      role="tooltip"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translateX(-50%)',
        zIndex: 99999,
        width: 300,
        background: '#161616',
        border: '1px solid #2a2b2c',
        borderRadius: 10,
        boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
        padding: '14px 16px',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0', marginBottom: 12 }}>
        {fullDateLabel}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
      }}>
        <span style={{ fontSize: 12, color: '#c9cdd4' }}>Total capacity</span>
        {pill(capacity)}
      </div>

      <div style={{ height: 1, background: '#2a2b2c', margin: '10px 0 12px' }} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
        <div style={{ width: 3, borderRadius: 2, background: '#3b82f6', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {popoverRow('Tracked time', tracked, capacityPct(tracked, capacity))}
          {popoverRow('Billable', billable, capacityPct(billable, capacity), { indent: true, muted: true })}
          {popoverRow('Non-billable', nonBillable, capacityPct(nonBillable, capacity), { indent: true, muted: true })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <div style={{ width: 3, borderRadius: 2, background: '#555', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {popoverRow('Remaining capacity', remaining, capacityPct(remaining, capacity))}
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        style={{ position: 'relative', cursor: 'default' }}
      >
        {accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />}
        {children}
      </div>
      {popover}
    </>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const OBSERVER_VIEW_ONLY_MSG = "Observers can only view this timesheet"

export default function Timesheet() {
  const searchParams = useSearchParams()
  const currentWorkspace = useTaskroomWorkspacetore(s => s.currentWorkspace)
  const currentRoomDetail = useTaskroomWorkspacetore(s => s.currentRoomDetail)
  const memberData = useTaskroomWorkspacetore(s => s.memberData)

  const [weekOffset, setWeekOffset] = useState(0)
  const [tasks, setTasks] = useState([])
  const [expanded, setExpanded] = useState({})
  const [activeTrack, setActiveTrack] = useState(null)
  const [timerElapsedMs, setTimerElapsedMs] = useState(0)
  const [startingTimer, setStartingTimer] = useState(false)
  const [stoppingTimer, setStoppingTimer] = useState(false)
  const [startTimerPrompt, setStartTimerPrompt] = useState(null)
  const [modal, setModal] = useState(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [pickerTasksForDialog, setPickerTasksForDialog] = useState(null)
  const [allAssignedLoading, setAllAssignedLoading] = useState(false)
  const [addingTasks, setAddingTasks] = useState(false)
  const [removingTaskId, setRemovingTaskId] = useState(null)
  const [timesheetId, setTimesheetId] = useState(null)
  const [timesheetStatus, setTimesheetStatus] = useState(null)
  const [taskCount, setTaskCount] = useState(0)
  const [submittingForApproval, setSubmittingForApproval] = useState(false)
  const [submissionDrawerOpen, setSubmissionDrawerOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
  const [dailyTotals, setDailyTotals] = useState(null)
  const [sheetsLoading, setSheetsLoading] = useState(true)
  const [sheetsError, setSheetsError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tasksPage, setTasksPage] = useState(1)
  const [tasksMetadata, setTasksMetadata] = useState({ totalPages: 1, currentPage: 1, nextPage: null })
  const pendingTasksPageResetRef = useRef(false)
  const [mainNav, setMainNav] = useState<"my-timesheet" | "all-timesheet" | "approvals">("my-timesheet")
  const [entriesLoading, setEntriesLoading] = useState<Record<string, boolean>>({})
  const [entriesMetadata, setEntriesMetadata] = useState<Record<string, { totalPages: number; currentPage: number; nextPage: number | null }>>({})
  // Tracks which tasks already have entries fetched for the current week, so re-expanding
  // a row doesn't refire the request. Reset whenever the sheet itself reloads.
  const loadedEntryTaskIdsRef = useRef<Set<string>>(new Set())

  const { dates, weekStartMs, weekEndMs } = getWeekRange(weekOffset)
  const canStartTimer = isTodayInWeekRange(weekStartMs, weekEndMs)
  const approvalsPendingCount = 1
  const workspaceId =
    (searchParams.get("shareTask") ? searchParams.get("workspaceId") : currentWorkspace?._id) || ""

  const currentUserId = useMemo(() => {
    try {
      const userData = Cookies.get("TaskRoomUserDetails")
      if (!userData) return null
      return JSON.parse(userData)?._id ?? null
    } catch {
      return null
    }
  }, [])

  const canViewAllTimesheets =
    !!currentUserId &&
    !!currentWorkspace?.userId &&
    String(currentWorkspace.userId) === String(currentUserId)

  const isReadOnly = isRoomObserver(currentRoomDetail, memberData)

  useEffect(() => {
    if (mainNav === "all-timesheet" && !canViewAllTimesheets) {
      setMainNav("my-timesheet")
    }
  }, [mainNav, canViewAllTimesheets])

  const applyTimesheetData = useCallback(
    (
      { sheetId, dailyTotals: loadedTotals, tasks: loadedTasks, metadata, currentStatus, rejectionReason: loadedRejectionReason, taskCount: loadedTaskCount },
      opts: { clearActiveTrack?: boolean } = {}
    ) => {
      if (sheetId) setTimesheetId(sheetId)
      setTimesheetStatus(currentStatus ?? null)
      setRejectionReason(loadedRejectionReason ?? null)
      setTaskCount(typeof loadedTaskCount === "number" ? loadedTaskCount : loadedTasks.length)
      setDailyTotals(loadedTotals)
      setTasksMetadata(metadata)
      setTasksPage(prev => (metadata.currentPage !== prev ? metadata.currentPage : prev))
      setTasks(loadedTasks)
      if (opts.clearActiveTrack) {
        setActiveTrack(null)
      } else {
        const running = findRunningTrack(loadedTasks)
        setActiveTrack(running)
      }
    },
    []
  )

  useEffect(() => {
    pendingTasksPageResetRef.current = true
    setTasksPage(1)
  }, [weekOffset, workspaceId, refreshKey])

  useEffect(() => {
    let cancelled = false
    const pageToLoad = pendingTasksPageResetRef.current ? 1 : tasksPage
    pendingTasksPageResetRef.current = false

    setSheetsLoading(true)
    setSheetsError(null)
    setTimesheetId(null)
    setTimesheetStatus(null)
    setRejectionReason(null)
    setTaskCount(0)
    setDailyTotals(null)
    setActiveTrack(null)
    setExpanded({})
    setEntriesLoading({})
    setEntriesMetadata({})
    loadedEntryTaskIdsRef.current = new Set()

    loadWeekTimesheet(weekOffset, workspaceId, refreshKey, pageToLoad)
      .then(result => {
        if (cancelled) return
        applyTimesheetData(result)
      })
      .catch(err => {
        if (!cancelled) {
          let msg = "Failed to load timesheet"
          if (axios.isAxiosError(err)) {
            const serverData = err.response?.data
            const serverMsg = typeof serverData === "string" ? serverData : serverData?.message ?? serverData?.error
            msg = serverMsg || err.message || msg
          } else if (err instanceof Error) {
            msg = err.message
          }
          setSheetsError(msg)
        }
      })
      .finally(() => {
        if (!cancelled) setSheetsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [weekOffset, refreshKey, workspaceId, tasksPage, applyTimesheetData])

  /** GET /tasks/time/tracks for one task — called lazily when its row is expanded (one page at a time). */
  const loadTaskEntries = useCallback(
    (task, opts: { force?: boolean; page?: number } = {}) => {
      const page = Math.max(1, opts.page ?? 1)
      if (!opts.force && page === 1 && loadedEntryTaskIdsRef.current.has(task.id)) return
      if (entriesLoading[task.id]) return

      setEntriesLoading(p => ({ ...p, [task.id]: true }))
      fetchTaskTimeTracks(
        { taskId: task.id, weekStart: weekStartMs, weekEnd: weekEndMs, isPersonal: true, page },
        dates
      )
        .then(({ entries: taskEntries, metadata }) => {
          if (page === 1) loadedEntryTaskIdsRef.current.add(task.id)
          setEntriesMetadata(p => ({ ...p, [task.id]: metadata }))
          setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, entries: taskEntries } : t)))
          const running = findRunningTrack([{ ...task, entries: taskEntries }])
          if (running) setActiveTrack(prev => prev ?? running)
        })
        .catch(e => {
          console.error("Failed to load time entries for task", task.id, e)
          toast.error("Could not load time entries for this task")
        })
        .finally(() => {
          setEntriesLoading(p => ({ ...p, [task.id]: false }))
        })
    },
    [dates, weekStartMs, weekEndMs, entriesLoading]
  )

  /** Re-fetch current week sheet and apply state in place (no full-page loading spinner). */
  const reloadCurrentTimesheet = useCallback(
    async (opts: { clearActiveTrack?: boolean } = {}) => {
      const result = await loadWeekTimesheet(weekOffset, workspaceId, refreshKey, tasksPage)
      applyTimesheetData(result, opts)

      loadedEntryTaskIdsRef.current = new Set()
      setEntriesLoading({})
      setEntriesMetadata({})

      const expandedIds = Object.keys(expanded).filter(id => expanded[id])
      for (const id of expandedIds) {
        const task = result.tasks.find(t => String(t.id) === id)
        if (task) loadTaskEntries(task, { force: true })
      }
    },
    [weekOffset, workspaceId, refreshKey, tasksPage, expanded, applyTimesheetData, loadTaskEntries]
  )

  const handleSubmissionsLoaded = useCallback(
    (latest: { submissionStatus?: string; rejectionReason?: string | null } | null) => {
      if (!latest) return
      const status = String(latest.submissionStatus ?? "").trim().toLowerCase()
      if (status) {
        setTimesheetStatus(prev => {
          const normalized =
            status === "draft" ||
            status === "submitted" ||
            status === "pending" ||
            status === "approved" ||
            status === "rejected"
              ? status
              : prev
          return normalized ?? prev
        })
      }
      if (latest.rejectionReason != null) {
        setRejectionReason(latest.rejectionReason)
      }
    },
    []
  )

  const handleSubmissionRevoked = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const handleSubmitForApproval = useCallback(async () => {
    if (isReadOnly) {
      toast.error(OBSERVER_VIEW_ONLY_MSG)
      return
    }
    if (!timesheetId || submittingForApproval) return
    setSubmittingForApproval(true)
    try {
      await submitTimesheetForApproval(timesheetId)
      toast.success("Timesheet submitted for approval")
      setRefreshKey(k => k + 1)
    } catch (e) {
      let msg = "Failed to submit timesheet for approval"
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
      setSubmittingForApproval(false)
    }
  }, [timesheetId, submittingForApproval, isReadOnly])

  const loadAddTaskPicker = useCallback(async (assignedToMeOrEvent?: unknown) => {
    if (isReadOnly) {
      toast.error(OBSERVER_VIEW_ONLY_MSG)
      return
    }
    if (allAssignedLoading || addingTasks) return

    // When used as `onClick={loadAddTaskPicker}`, React passes the click event as
    // the first argument. Only treat it as `assignedToMe` when it's explicitly boolean.
    const assignedToMe = typeof assignedToMeOrEvent === "boolean" ? assignedToMeOrEvent : false

    if (!timesheetId) {
      toast.error("Timesheet is not ready yet. Wait for the week to load, then try again.")
      return
    }

    const workspaceId =
      (searchParams.get("shareTask") ? searchParams.get("workspaceId") : currentWorkspace?._id) || ""
    const spaceId =
      (searchParams.get("shareTask") ? searchParams.get("spaceId") : currentRoomDetail?.spaceId) || ""
    const roomId =
      (searchParams.get("shareTask") ? searchParams.get("roomId") : currentRoomDetail?._id) || ""

    if (!workspaceId) {
      toast.error(
        "Missing workspace. Open Timesheets from a board with workspaceId in the URL, or select a workspace in the app."
      )
      return
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null
    if (!token) {
      toast.error("Sign in required to load tasks.")
      return
    }

    setAllAssignedLoading(true)
    try {
      // "All assigned tasks" scopes by assignedToMe only — no sBound/eBound week filter.
      const mapped = await fetchTimesheetAllTasklist(timesheetId, {
        workspaceId,
        spaceId: spaceId || undefined,
        roomId: roomId || undefined,
        assignedToMe,
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
  },
    [searchParams, currentWorkspace, currentRoomDetail, allAssignedLoading, addingTasks, timesheetId, isReadOnly]
  )

  const activeTaskId = activeTrack?.taskId ?? null
  const activeLiveDay =
    activeTrack?.liveDay != null && activeTrack.liveDay >= 0
      ? activeTrack.liveDay
      : activeTrack?.startTime != null
        ? dayIndexForTimestamp(activeTrack.startTime, dates)
        : null
  const timerSecs = Math.floor(timerElapsedMs / 1000)

  // ── TIMER TICK (elapsed from server startTime, same as time-tracking.tsx) ───
  useEffect(() => {
    if (!activeTrack) {
      setTimerElapsedMs(0)
      return
    }
    const tick = () => setTimerElapsedMs(Date.now() - activeTrack.startTime)
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeTrack])

  const startTimer = useCallback(
    async (task, isBillable = false) => {
      if (isReadOnly) {
        toast.error(OBSERVER_VIEW_ONLY_MSG)
        return
      }
      if (!canStartTimer) {
        toast.error("Timer can only be started for the current week. Use manual entry for other dates.")
        return
      }
      if (startingTimer || stoppingTimer || activeTrack) {
        if (activeTrack && activeTrack.taskId !== task.id) {
          toast.error("Stop the running timer before starting another.")
        }
        return
      }
      if (!task.roomId) {
        toast.error("Task room is missing; cannot start timer.")
        return
      }

      const col = dayIndexForTimestamp(Date.now(), dates)
      if (col < 0) {
        toast.error("Timer can only be started on a day in this week.")
        return
      }
      const day = col
      const startTime = Date.now()

      setStartingTimer(true)
      try {
        const res = await axios.post(
          tracksApi(),
          {
            comment: "",
            tags: [],
            taskId: task.id,
            roomId: task.roomId,
            startTime,
            isBillable: !!isBillable,
          },
          { headers: authHeaders() }
        )
        const track = res.data?.data ?? res.data
        const trackId = String(track?._id ?? track?.id ?? "")
        if (!trackId) throw new Error("No track id returned")

        const nextTrack = {
          _id: trackId,
          taskId: task.id,
          roomId: task.roomId,
          startTime: track?.startTime ?? startTime,
          comment: track?.comment ?? "",
          tags: Array.isArray(track?.tags) ? track.tags : [],
          isBillable: track?.isBillable ?? !!isBillable,
          liveDay: day,
        }
        setActiveTrack(nextTrack)
        setStartTimerPrompt(null)

        const liveEntry = {
          id: trackId,
          trackId,
          day,
          mins: 0,
          label: fmtRangeFromEpoch(nextTrack.startTime, null),
          live: true,
          startTime: nextTrack.startTime,
          comment: nextTrack.comment,
          tags: nextTrack.tags,
          billable: nextTrack.isBillable,
        }
        setTasks(prev =>
          prev.map(t => {
            if (t.id !== task.id) return t
            const entries = [...t.entries.filter(e => !e.live), liveEntry]
            return { ...t, entries, time: deriveTime(entries) }
          })
        )
      } catch (e) {
        let msg = "Could not start timer"
        if (axios.isAxiosError(e)) {
          const serverData = e.response?.data
          const serverMsg =
            typeof serverData === "string" ? serverData : serverData?.message ?? serverData?.error
          msg = serverMsg || e.message || msg
        } else if (e instanceof Error) {
          msg = e.message
        }
        toast.error(String(msg).slice(0, 240))
      } finally {
        setStartingTimer(false)
      }
    },
    [activeTrack, canStartTimer, dates, startingTimer, stoppingTimer, isReadOnly]
  )

  const stopTimer = useCallback(async () => {
    if (isReadOnly) {
      toast.error(OBSERVER_VIEW_ONLY_MSG)
      return
    }
    if (!activeTrack || stoppingTimer) return

    setStoppingTimer(true)
    const endTime = Date.now()
    try {
      await axios.put(
        `${tracksApi()}/${activeTrack._id}`,
        {
          comment: activeTrack.comment ?? "",
          tags: activeTrack.tags ?? [],
          endTime,
        },
        { headers: authHeaders() }
      )
      const durationSec = Math.floor((endTime - activeTrack.startTime) / 1000)
      try {
        await reloadCurrentTimesheet({ clearActiveTrack: true })
      } catch {
        setActiveTrack(null)
        toast.error("Timer stopped but could not refresh timesheet")
        return
      }
      const h = Math.floor(durationSec / 3600)
      const m = Math.floor((durationSec % 3600) / 60)
      const label =
        h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : m > 0 ? `${m}m` : `${durationSec}s`
      toast.success(`Tracked ${label}`)
    } catch (e) {
      let msg = "Could not stop timer"
      if (axios.isAxiosError(e)) {
        const serverData = e.response?.data
        const serverMsg =
          typeof serverData === "string" ? serverData : serverData?.message ?? serverData?.error
        msg = serverMsg || e.message || msg
      } else if (e instanceof Error) {
        msg = e.message
      }
      toast.error(String(msg).slice(0, 240))
    } finally {
      setStoppingTimer(false)
    }
  }, [activeTrack, stoppingTimer, reloadCurrentTimesheet, isReadOnly])

  /** Manual time entry — POST with start/end on the selected grid day (epoch ms). */
  const handleSave = useCallback(
    async mins => {
      if (isReadOnly) {
        toast.error(OBSERVER_VIEW_ONLY_MSG)
        return
      }
      if (!modal || mins <= 0) return

      const task = tasks.find(t => t.id === modal.taskId)
      if (!task?.roomId) {
        toast.error("Task room is missing; cannot save time entry.")
        throw new Error("missing roomId")
      }

      const range = epochRangeForManualEntryOnDay(modal.day, dates, mins)
      if (!range) {
        toast.error("Invalid time range for the selected day")
        throw new Error("invalid range")
      }
      const { startEpoch, endEpoch } = range
      const duration = Math.floor((endEpoch - startEpoch) / 1000)

      try {
        await axios.post(
          tracksApi(),
          {
            comment: "",
            tags: [],
            taskId: task.id,
            roomId: task.roomId,
            startTime: startEpoch,
            endTime: endEpoch,
          },
          { headers: authHeaders() }
        )
        setModal(null)
        setRefreshKey(k => k + 1)
        toast.success(`Added ${fmtSeconds(duration)}`)
      } catch (e) {
        let msg = "Could not add time entry"
        if (axios.isAxiosError(e)) {
          const serverData = e.response?.data
          const serverMsg =
            typeof serverData === "string" ? serverData : serverData?.message ?? serverData?.error
          msg = serverMsg || e.message || msg
        } else if (e instanceof Error) {
          msg = e.message
        }
        toast.error(String(msg).slice(0, 240))
        throw e
      }
    },
    [modal, tasks, dates, isReadOnly]
  )

  const addTasksFromDialog = useCallback(
    async picked => {
      if (isReadOnly) {
        toast.error(OBSERVER_VIEW_ONLY_MSG)
        return
      }
      const fromAllAssigned = pickerTasksForDialog != null
      const draftTaskIds = picked.map(p => String(p.id))

      if (fromAllAssigned) {
        if (addingTasks) return
        if (!timesheetId) {
          toast.error("Timesheet not loaded yet. Please wait and try again.")
          return
        }
        const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null
        if (!token) {
          toast.error("Sign in required to add tasks.")
          return
        }

        setAddingTasks(true)
        try {
          await axios.put(`${taskroomBase()}tasks/time/sheets/${timesheetId}/add/tasks`, {
            taskIds: draftTaskIds,
          }, {
            headers: authHeaders(),
          })
          setShowAddTask(false)
          setPickerTasksForDialog(null)
          try {
            await reloadCurrentTimesheet()
            toast.success(
              draftTaskIds.length === 1 ? "Task added to timesheet" : `${draftTaskIds.length} tasks added to timesheet`
            )
          } catch {
            toast.error("Tasks added but could not refresh timesheet")
          }
        } catch (e) {
          let msg = "Failed to add tasks to timesheet"
          if (axios.isAxiosError(e)) {
            const serverData = e.response?.data
            const serverMsg = typeof serverData === "string" ? serverData : serverData?.message ?? serverData?.error
            msg = serverMsg || e.message || msg
          } else if (e instanceof Error) {
            msg = e.message
          }
          toast.error(msg.slice(0, 240))
        } finally {
          setAddingTasks(false)
        }
        return
      }

      const newTasks = picked.map(p => ({
        id: p.id,
        name: p.name,
        dotColor: p.dotColor,
        space: `${p.status} · ${p.space}`,
        entries: [],
        time: Array(7).fill(0),
      }))
      setTasks(prev => [...prev, ...newTasks])
      setShowAddTask(false)
      setPickerTasksForDialog(null)
    },
    [pickerTasksForDialog, timesheetId, addingTasks, reloadCurrentTimesheet, isReadOnly]
  )

  const removeTaskFromSheet = useCallback(
    async (taskId: string) => {
      if (isReadOnly) {
        toast.error(OBSERVER_VIEW_ONLY_MSG)
        return
      }
      if (!timesheetId || removingTaskId) return
      if (
        !confirm(
          "Remove this task from your timesheet for this week? Tracked time stays on the task; it will only be hidden from this sheet."
        )
      ) {
        return
      }

      if (activeTaskId === taskId && activeTrack) {
        toast.error("Stop the timer before removing this task.")
        return
      }

      setRemovingTaskId(taskId)
      try {
        await removeTasksFromTimesheet(timesheetId, [String(taskId)])
        setTasks(prev => prev.filter(t => String(t.id) !== String(taskId)))
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
            typeof serverData === "string" ? serverData : serverData?.message ?? serverData?.error
          msg = serverMsg || e.message || msg
        } else if (e instanceof Error) {
          msg = e.message
        }
        toast.error(String(msg).slice(0, 240))
      } finally {
        setRemovingTaskId(null)
      }
    },
    [timesheetId, removingTaskId, activeTaskId, activeTrack, isReadOnly]
  )

  const totalByDay = Array.from({ length: 7 }, (_, d) => {
    let sum = tasks.reduce((s, t) => s + (t.time[d] || 0), 0)
    if (activeTaskId !== null && activeLiveDay === d) {
      sum += Math.floor(timerSecs / 60)
    }
    return sum
  })
  const grandTotal = totalByDay.reduce((a, b) => a + b, 0)

  const todayCol = dayIndexForTimestamp(Date.now(), dates)
  const accentColor = i => {
    if (todayCol < 0) return null
    if (i === todayCol) return "var(--brand)"
    return null
  }

  const colStyle = TIMESHEET_COL_STYLE
  const showEmptyState = !sheetsLoading && !sheetsError && tasks.length === 0
  const hasTimesheetTasks = taskCount > 0 || tasks.length > 0
  const canSubmitTimesheetStatus =
    !timesheetStatus || timesheetStatus === "draft" || timesheetStatus === "rejected"
  const showSubmitForApproval =
    !isReadOnly &&
    !sheetsLoading &&
    !sheetsError &&
    !!timesheetId &&
    hasTimesheetTasks &&
    canSubmitTimesheetStatus
  const showSubmissionStatusButton = !sheetsLoading && !sheetsError && !!timesheetId
  const statusLabel = sheetStatusLabel(timesheetStatus)

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#0a0a0d', color: '#c9cdd4', overflow: 'hidden',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 13
    }}>

      {/* ── TOP NAV BAR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 44,
        borderBottom: '1px solid #0a0a0d', flexShrink: 0, padding: '0 16px', gap: 2
      }}>
        {/* Timesheets breadcrumb */}
        {/* <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', color: '#888', fontSize: 13,
          cursor: 'pointer', padding: '0 10px', height: 44
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <line x1="4" y1="4" x2="10" y2="4" stroke="currentColor" strokeWidth="1.2" />
            <line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1.2" />
            <line x1="4" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          Timesheets
        </button> */}

        {/* My timesheet tab */}
        <button
          type="button"
          onClick={() => setMainNav("my-timesheet")}
          style={{
            background: 'none', border: 'none', fontSize: 13,
            fontWeight: mainNav === "my-timesheet" ? 600 : 400,
            color: mainNav === "my-timesheet" ? '#e0e0e0' : '#666',
            cursor: 'pointer', padding: '0 12px', height: 44,
            borderBottom: mainNav === "my-timesheet" ? '2px solid #e8e8e8' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          My timesheet
        </button>

        {canViewAllTimesheets && (
          <button
            type="button"
            onClick={() => setMainNav("all-timesheet")}
            style={{
              background: 'none', border: 'none', fontSize: 13,
              fontWeight: mainNav === "all-timesheet" ? 600 : 400,
              color: mainNav === "all-timesheet" ? '#e0e0e0' : '#666',
              cursor: 'pointer', padding: '0 12px', height: 44,
              borderBottom: mainNav === "all-timesheet" ? '2px solid #e8e8e8' : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            All timesheets
          </button>
        )}


        {/* Approvals tab */}
        <button
          type="button"
          onClick={() => setMainNav("approvals")}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', fontSize: 13,
            fontWeight: mainNav === "approvals" ? 600 : 400,
            color: mainNav === "approvals" ? '#e0e0e0' : '#666',
            cursor: 'pointer', padding: '0 12px', height: 44,
            borderBottom: mainNav === "approvals" ? '2px solid #e8e8e8' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          Approvals
          {/* {approvalsPendingCount > 0 && (
            <span style={{
              minWidth: 18, height: 18, borderRadius: 999,
              background: mainNav === "approvals" ? 'var(--brand)' : '#2a2b2c',
              color: mainNav === "approvals" ? 'var(--brand-foreground)' : '#888',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px'
            }}>
              {approvalsPendingCount}
            </span>
          )} */}
        </button>

        <div style={{ flex: 1 }} />

        {/* Configure */}
        {/* <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', color: '#888', fontSize: 13,
          cursor: 'pointer', padding: '0 10px'
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 1.5v1M7 11.5v1M1.5 7h1M11.5 7h1M3.1 3.1l.7.7M10.2 10.2l.7.7M10.2 3.1l-.7.7M3.1 10.2l-.7.7"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Configure
        </button> */}
      </div>

      {mainNav === "approvals" && <TimesheetApprovals />}

      {canViewAllTimesheets && mainNav === "all-timesheet" && (
        <AllTimesheets workspaceId={workspaceId} />
      )}

      {mainNav === "my-timesheet" && <>
        {/* ── WEEK NAV + STATUS + SUBMIT ROW ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', borderBottom: '1px solid #0a0a0d', flexShrink: 0
        }}>
          {/* Prev / Next arrows */}
          <button onClick={() => setWeekOffset(o => o - 1)} style={navBtn}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button onClick={() => setWeekOffset(o => o + 1)} style={navBtn}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Week label + week picker */}
          <TimesheetWeekPicker dates={dates} onWeekOffsetChange={setWeekOffset} />

          {/* Status pill */}
          {statusLabel && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: timesheetStatus === 'rejected' ? '#3d2f00' : timesheetStatus === 'approved' ? 'color-mix(in srgb, var(--brand) 16%, #0a0a0a)' : 'color-mix(in srgb, var(--brand) 16%, #0a0a0a)',
            border: timesheetStatus === 'rejected' ? '1px solid #7a5a00' : timesheetStatus === 'approved' ? '1px solid color-mix(in srgb, var(--brand) 48%, black)' : '1px solid color-mix(in srgb, var(--brand) 48%, black)',
            color: timesheetStatus === 'rejected' ? '#f5c842' : timesheetStatus === 'approved' ? 'var(--brand)' : 'var(--brand)',
            borderRadius: 999,
            padding: '3px 12px', fontSize: 12, fontWeight: 500
          }}>
            {timesheetStatus === 'rejected' ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M5.5 1.5v4M5.5 8v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.1" />
            </svg>
            ) : timesheetStatus === 'approved' ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2.5 5.5l2 2 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            ) : (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.1" />
              <path d="M5.5 3v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            )}
            {statusLabel}
          </span>
          )}
          {timesheetStatus === "rejected" && rejectionReason && (
            <span
              title={rejectionReason}
              style={{
                fontSize: 12,
                color: "#f5c842",
                maxWidth: 280,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {rejectionReason}
            </span>
          )}

          <div style={{ flex: 1 }} />
          {showSubmissionStatusButton && (
            <button
              type="button"
              onClick={() => setSubmissionDrawerOpen(true)}
              style={{
                background: "#0a0a0d",
                color: "#c9cdd4",
                border: "1px solid #2a2b2c",
                borderRadius: 8,
                padding: "7px 14px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Submission status
            </button>
          )}
          {showSubmitForApproval && (
          <button
            type="button"
            onClick={() => void handleSubmitForApproval()}
            disabled={submittingForApproval}
            style={{
            background: 'var(--brand)', color: 'var(--brand-foreground)', border: 'none',
            borderRadius: 8, padding: '7px 18px', fontSize: 13,
            fontWeight: 600, cursor: submittingForApproval ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap', opacity: submittingForApproval ? 0.7 : 1
          }}>
            {submittingForApproval ? 'Submitting…' : 'Submit for approval'}
          </button>
          )}

          {/* Notification bell with badge */}
          {/* <div style={{ position: 'relative' }}>
          <button style={{
            width: 32, height: 32, borderRadius: 8,
            background: '#0a0a0d', border: '1px solid #2a2b2c',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#888', cursor: 'pointer'
          }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1.5C5 1.5 3.5 3.2 3.5 5.5v4l-1 1.5h10l-1-1.5V5.5C11.5 3.2 10 1.5 7.5 1.5Z"
                stroke="currentColor" strokeWidth="1.2" />
              <path d="M6 12a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--brand)', color: 'var(--brand-foreground)',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #0a0a0d'
          }}>1</span>
        </div> */}
        </div>

        {/* ── GRID (fixed task column + scrollable days) ── */}
        <div style={{ ...TIMESHEET_SCROLL_ROOT, display: "flex", flexDirection: "column" }}>
          {sheetsLoading && <LoaderBlock />}
          {!sheetsLoading && sheetsError && (
            <div style={{ padding: 32, textAlign: "center", color: "#e57373" }}>
              <div style={{ marginBottom: 16, fontSize: 14 }}>{sheetsError}</div>
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
          {showEmptyState && isReadOnly && (
            <div style={{ padding: 48, textAlign: "center", color: "#666", fontSize: 14 }}>
              No time entries this week
            </div>
          )}
          {showEmptyState && !isReadOnly && (
            <TimesheetEmptyState
              onAllAssigned={() => loadAddTaskPicker(true)}
              allAssignedLoading={allAssignedLoading}
              onLastWeek={() => loadAddTaskPicker(false)}
              onIndividual={() => loadAddTaskPicker(false)}
              onTrackTime={() => loadAddTaskPicker(false)}
            />
          )}
          {!sheetsLoading && !sheetsError && tasks.length > 0 && (
            <div style={{ width: "100%", minWidth: TIMESHEET_GRID_MIN_WIDTH }}>

              {/* Column headers */}
              <div style={{ display: 'grid', ...colStyle, borderBottom: '1px solid #222324' }}>
                <div style={{ ...headerCell, ...TIMESHEET_STICKY_HEADER_CORNER }}>Task / Location</div>
                {dates.map((date, i) => {
                  const accent = accentColor(i)
                  const apiKey = DAY_API_KEYS[i]
                  const apiDay = dailyTotals?.[apiKey]
                  const tot = apiDay
                    ? (apiDay.billable ?? 0) + (apiDay.nonBillable ?? 0)
                    : totalByDay[i]
                  return (
                    <div key={i} style={{ ...headerCell, ...TIMESHEET_STICKY_HEADER_CELL, textAlign: 'center', paddingTop: 0 }}>
                      <DayHeaderHoverPopover
                        date={date}
                        dayIndex={i}
                        dailyTotals={dailyTotals}
                        accent={accent}
                      >
                        <div style={{ paddingTop: 10 }}>
                          <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>
                            {DAYS[date.getDay()]}, {MONTHS[date.getMonth()]} {date.getDate()}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: tot > 0 ? '#e0e0e0' : '#888' }}>
                            {tot > 0 ? fmtMins(tot) : '0h'}
                          </div>
                          {accent && <div style={{ height: 2, background: accent, borderRadius: 2, marginTop: 4 }} />}
                        </div>
                      </DayHeaderHoverPopover>
                    </div>
                  )
                })}
                <div style={{ ...headerCell, ...TIMESHEET_STICKY_HEADER_CELL, textAlign: 'left' }}>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>Total</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>{fmtMins(grandTotal)}</div>
                </div>
              </div>

              {/* Task rows */}
              {tasks.map(task => {
                const isRunning = activeTaskId === task.id
                const exp = !!expanded[task.id]
                const rowTotal = task.time.reduce((a, b) => a + b, 0) + (isRunning ? Math.floor(timerSecs / 60) : 0)

                return (
                  <div key={task.id}>
                    {/* ── Main task row ── */}
                    <div
                      className="task-row"
                      style={{ display: 'grid', ...colStyle, borderBottom: '1px solid #0a0a0d', cursor: 'default' }}
                    >
                      {/* Task name cell — sticky left */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderRight: '1px solid #0a0a0d', minWidth: 0, ...TIMESHEET_STICKY_LEFT }}>
                        {/* Expand toggle — fetches this task's time-log entries on first expand */}
                        <button
                          onClick={() => {
                            const wasExpanded = !!expanded[task.id]
                            setExpanded(p => ({ ...p, [task.id]: !p[task.id] }))
                            if (!wasExpanded) loadTaskEntries(task)
                          }}
                          style={{
                            background: 'none', border: 'none', color: '#555', cursor: 'pointer',
                            padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0,
                            width: 16, height: 16, justifyContent: 'center'
                          }}
                        >
                          {exp ? <Icon.ChevronDown /> : <Icon.ChevronRight />}
                        </button>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: '#e0e0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: task.dotColor, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {task.space}
                            </span>
                          </div>
                        </div>

                        {/* Play/Stop — only when today is in this week; past/future weeks use manual entry */}
                        {!isReadOnly && (canStartTimer || isRunning) && (
                          <button
                            onClick={() => (isRunning ? stopTimer() : setStartTimerPrompt(task))}
                            disabled={
                              startingTimer ||
                              stoppingTimer ||
                              (!isRunning && !!activeTrack && activeTrack.taskId !== task.id)
                            }
                            style={{
                              width: 22, height: 22, borderRadius: '50%', border: 'none',
                              cursor:
                                startingTimer ||
                                  stoppingTimer ||
                                  (!isRunning && activeTrack && activeTrack.taskId !== task.id)
                                  ? 'not-allowed'
                                  : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              background: isRunning ? '#dc2626' : '#2a2b2c',
                              color: isRunning ? '#fff' : '#888',
                              opacity:
                                !isRunning && activeTrack && activeTrack.taskId !== task.id ? 0.4 : 1,
                              transition: 'all 0.15s'
                            }}
                            title={isRunning ? 'Stop timer' : 'Start timer'}
                          >
                            {isRunning ? <Icon.Stop /> : <Icon.Play />}
                          </button>
                        )}

                        {!isReadOnly && (
                          <TimesheetRemoveTaskButton
                            onRemove={() => removeTaskFromSheet(task.id)}
                            removing={removingTaskId === task.id}
                            disabled={!timesheetId || !!removingTaskId}
                          />
                        )}
                      </div>

                      {/* Day cells */}
                      {task.time.map((mins, d) => {
                        const isLiveCell = isRunning && activeLiveDay !== null && d === activeLiveDay
                        const cellMins = isLiveCell ? Math.floor(timerSecs / 60) : mins
                        return (
                          <div
                            key={d}
                            onClick={() => {
                              if (isReadOnly) return
                              setModal({ taskId: task.id, day: d })
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              padding: '10px 4px', borderRight: '1px solid #0a0a0d',
                              cursor: isReadOnly ? 'default' : 'pointer', fontSize: 12
                            }}
                          >
                            {isLiveCell ? (
                              <span style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                background: '#dc2626', color: '#fff',
                                borderRadius: 999, padding: '2px 8px', fontSize: 10, fontFamily: 'monospace'
                              }}>
                                <span style={{
                                  width: 5, height: 5, borderRadius: '50%', background: '#fff',
                                  animation: 'pulse 1s infinite'
                                }} />
                                {fmtTimer(timerSecs)}
                              </span>
                            ) : cellMins > 0 ? (
                              <span style={{ color: '#c9cdd4', fontWeight: 500 }}>{fmtMins(cellMins)}</span>
                            ) : (
                              <span style={{ color: '#333' }}>—</span>
                            )}
                          </div>
                        )
                      })}

                      {/* Row total */}
                      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderRight: '1px solid #0a0a0d', fontWeight: 500 }}>
                        {rowTotal > 0 ? fmtMins(rowTotal) : <span style={{ color: '#444' }}>—</span>}
                      </div>
                    </div>

                    {/* ── Expanded: entry rows ── */}
                    {exp && (
                      <div style={{ background: '#141516' }}>

                        {/* "N time entries" label row */}
                        <div style={{
                          display: 'grid', ...colStyle,
                          borderBottom: '1px solid #161616'
                        }}>
                          <div style={{ padding: '6px 12px 6px 40px', fontSize: 11, color: '#555', borderRight: '1px solid #161616', ...TIMESHEET_STICKY_LEFT_NESTED }}>
                            {entriesLoading[task.id]
                              ? 'Loading entries…'
                              : `${task.entries.length} time entr${task.entries.length === 1 ? 'y' : 'ies'}`}
                          </div>
                          {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} style={{ borderRight: '1px solid #161616' }} />
                          ))}
                          <div style={{ borderRight: '1px solid #161616' }} />
                        </div>

                        {/* Individual entry rows */}
                        {task.entries.map(entry => {
                          // For the live entry, use the running timer; otherwise use entry.mins
                          const entryMins = entry.live ? Math.floor(timerSecs / 60) : entry.mins

                          return (
                            <div
                              key={entry.id}
                              style={{
                                display: 'grid', ...colStyle,
                                borderBottom: '1px solid #161616'
                              }}
                            >
                              {/* Entry info */}
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 12px 8px 40px', borderRight: '1px solid #161616', minWidth: 0,
                                ...TIMESHEET_STICKY_LEFT_NESTED,
                              }}>
                                <Icon.Clock />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {/* Date */}
                                  <div style={{ fontSize: 11, color: '#999', marginBottom: 1 }}>
                                    {fmtDate(dates[entry.day])}
                                  </div>
                                  {/* Time range label */}
                                  <div style={{
                                    fontSize: 11, color: '#555',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                  }}>
                                    {entry.label}
                                  </div>
                                </div>
                                {entry.billable && (
                                  <span style={{
                                    fontSize: 9, background: '#1a3a1a', color: '#4caf50',
                                    border: '1px solid #2a4a2a', borderRadius: 4, padding: '1px 5px'
                                  }}>
                                    $
                                  </span>
                                )}
                              </div>

                              {/* Day cells — only the matching day column shows the duration */}
                              {Array.from({ length: 7 }, (_, d) => (
                                <div key={d} style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  padding: '8px 4px', borderRight: '1px solid #161616', fontSize: 11
                                }}>
                                  {d === entry.day ? (
                                    entry.live ? (
                                      <span style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: 10 }}>
                                        {fmtTimer(timerSecs)}
                                      </span>
                                    ) : (
                                      /* ← This is the duration for this specific entry on this day */
                                      <span style={{ color: '#c9cdd4', fontWeight: 500 }}>
                                        {fmtMins(entryMins)}
                                      </span>
                                    )
                                  ) : null}
                                </div>
                              ))}

                              {/* Entry total (same as entryMins) */}
                              <div style={{
                                display: 'flex', alignItems: 'center',
                                padding: '8px 12px', borderRight: '1px solid #161616',
                                fontSize: 11, color: '#888'
                              }}>
                                {entry.live ? fmtTimer(timerSecs) : fmtMins(entryMins)}
                              </div>
                            </div>
                          )
                        })}

                        {/* Empty state */}
                        {task.entries.length === 0 && !entriesLoading[task.id] && (
                          <div style={{
                            display: 'grid', ...colStyle, borderBottom: '1px solid #161616'
                          }}>
                            <div style={{
                              gridColumn: '1 / -1', padding: '10px 40px',
                              fontSize: 11, color: '#444', fontStyle: 'italic'
                            }}>
                              {isReadOnly ? "No entries yet" : "No entries yet — click a day cell to add time"}
                            </div>
                          </div>
                        )}

                        {entriesMetadata[task.id]?.totalPages > 1 && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 16px 8px 40px',
                            borderBottom: '1px solid #161616',
                            background: '#0a0a0d',
                          }}>
                            <span style={{ fontSize: 11, color: '#666' }}>
                              Page {entriesMetadata[task.id].currentPage} of {entriesMetadata[task.id].totalPages}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => loadTaskEntries(task, { page: Math.max(1, (entriesMetadata[task.id]?.currentPage ?? 1) - 1) })}
                                disabled={(entriesMetadata[task.id]?.currentPage ?? 1) <= 1 || entriesLoading[task.id]}
                                style={{
                                  ...navBtn,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  opacity: (entriesMetadata[task.id]?.currentPage ?? 1) <= 1 || entriesLoading[task.id] ? 0.4 : 1,
                                  cursor: (entriesMetadata[task.id]?.currentPage ?? 1) <= 1 || entriesLoading[task.id] ? 'not-allowed' : 'pointer',
                                }}
                              >
                                <Icon.ChevronLeft /> Previous
                              </button>
                              <button
                                type="button"
                                onClick={() => loadTaskEntries(task, { page: (entriesMetadata[task.id]?.currentPage ?? 1) + 1 })}
                                disabled={(entriesMetadata[task.id]?.currentPage ?? 1) >= (entriesMetadata[task.id]?.totalPages ?? 1) || entriesLoading[task.id]}
                                style={{
                                  ...navBtn,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  opacity: (entriesMetadata[task.id]?.currentPage ?? 1) >= (entriesMetadata[task.id]?.totalPages ?? 1) || entriesLoading[task.id] ? 0.4 : 1,
                                  cursor: (entriesMetadata[task.id]?.currentPage ?? 1) >= (entriesMetadata[task.id]?.totalPages ?? 1) || entriesLoading[task.id] ? 'not-allowed' : 'pointer',
                                }}
                              >
                                Next <Icon.ChevronRight />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {tasksMetadata.totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: '1px solid #0a0a0d',
                  background: '#0a0a0d',
                }}>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    Page {tasksMetadata.currentPage} of {tasksMetadata.totalPages}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setTasksPage(p => Math.max(1, p - 1))}
                      disabled={tasksMetadata.currentPage <= 1 || sheetsLoading}
                      style={{
                        ...navBtn,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        opacity: tasksMetadata.currentPage <= 1 || sheetsLoading ? 0.4 : 1,
                        cursor: tasksMetadata.currentPage <= 1 || sheetsLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Icon.ChevronLeft /> Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasksPage(p => Math.min(tasksMetadata.totalPages, p + 1))}
                      disabled={tasksMetadata.currentPage >= tasksMetadata.totalPages || sheetsLoading}
                      style={{
                        ...navBtn,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        opacity: tasksMetadata.currentPage >= tasksMetadata.totalPages || sheetsLoading ? 0.4 : 1,
                        cursor: tasksMetadata.currentPage >= tasksMetadata.totalPages || sheetsLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Next <Icon.ChevronRight />
                    </button>
                  </div>
                </div>
              )}

              {!isReadOnly && (
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #0a0a0d' }}>
                  <button
                    type="button"
                    onClick={() => loadAddTaskPicker(false)}
                    disabled={allAssignedLoading || addingTasks}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'none', border: 'none', color: allAssignedLoading ? '#444' : '#555',
                      fontSize: 12, cursor: allAssignedLoading ? 'wait' : 'pointer', padding: 0
                    }}
                  >
                    <Icon.Plus /> {allAssignedLoading ? 'Loading…' : 'Add task'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── ADD TASK DIALOG ── */}
        {showAddTask && !isReadOnly && (
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

        {/* ── START TIMER MODAL ── */}
        {startTimerPrompt && !isReadOnly && (
          <StartTimerModal
            taskName={startTimerPrompt.name || ''}
            starting={startingTimer}
            onClose={() => {
              if (startingTimer) return
              setStartTimerPrompt(null)
            }}
            onStart={(isBillable) => startTimer(startTimerPrompt, isBillable)}
          />
        )}

        {/* ── MODAL ── */}
        {modal && !isReadOnly && (
          <TimeEntryModal
            taskName={tasks.find(t => t.id === modal.taskId)?.name || ''}
            day={modal.day}
            dates={dates}
            onClose={() => setModal(null)}
            onSave={handleSave}
          />
        )}

        <TimesheetSubmissionDrawer
          open={submissionDrawerOpen}
          onClose={() => setSubmissionDrawerOpen(false)}
          timesheetId={timesheetId}
          onSubmissionsLoaded={handleSubmissionsLoaded}
          onRevoked={handleSubmissionRevoked}
        />

        <style>{`
        .task-row:hover { background: #181920; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes timesheetSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      </>}

    </div>
  )
}

const navBtn = {
  background: 'none', border: 'none', color: '#666', cursor: 'pointer',
  fontSize: 14, padding: '2px 6px', borderRadius: 4
}
const headerCell = {
  padding: '10px 12px', fontSize: 11, color: '#666',
  fontWeight: 500, borderRight: '1px solid #222324'
}