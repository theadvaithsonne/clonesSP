"use client"

import { useEffect, useMemo, useRef, useState, useCallback, type Dispatch, type SetStateAction } from "react"
import { useSearchParams } from "next/navigation"
import axios from "axios"
import { toast } from "sonner"

import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace"

import { Skeleton } from "@/components/ui/skeleton"
import { extractSheetMetadata } from "./timesheet"
import {
  MemberTimesheetDetail,
  type AllTimesheetsMember,
  type MemberTimesheetApprovalContext,
} from "./AllTimesheets"
import { TimesheetWeekPicker } from "./TimesheetWeekPicker"

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalTab = "to_review" | "changes_requested" | "approved"
type ApprovalStatus = "pending" | "changes_needed" | "approved"
type SubmissionApiStatus = "pending" | "approved" | "rejected"
type ReviewAction = "approve" | "reject"
type DayTotals = { billable: number; nonBillable: number }
type DailyTotalsMap = Record<(typeof DAY_API_KEYS)[number], DayTotals>

type ApprovalSubmission = {
  id: string
  userId: string
  name: string
  email?: string
  image?: string
  initials: string
  dateRange: string
  tracked: string
  trackedMins: number
  capacity: string
  capacityMins: number
  billable: string
  billableMins: number
  status: ApprovalStatus
  submittedAt: string
  timezone: string
  dailyMins: number[]
  dailyBreakdown: DayTotals[]
}

type OrgPerson = {
  id: string
  name: string
  email: string
  initials: string
  isMe?: boolean
}

type SubmitterRow = {
  recordId?: string
  submitterId: string
  approverIds: string[]
}

type SubmitterApproverPayload = {
  submitter: string
  approvers: string[]
}

const TAB_CONFIG: { id: ApprovalTab; label: string; submissionStatus: SubmissionApiStatus }[] = [
  { id: "to_review", label: "To review", submissionStatus: "pending" },
  { id: "changes_requested", label: "Changes requested", submissionStatus: "rejected" },
  { id: "approved", label: "Approved", submissionStatus: "approved" },
]

const SUBMISSION_PAGE_SIZE = 50
const DEFAULT_WEEKLY_CAPACITY_H = 50
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAY_API_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const

const DUE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const DUE_TIMES = ["9:00 am", "12:00 pm", "5:00 pm", "6:00 pm"]
const REMIND_BEFORE = ["None", "1h before", "24h before", "48h before"]
const REMIND_AFTER = ["None", "4h after", "8h after", "24h after"]

// ─── API helpers ──────────────────────────────────────────────────────────────

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

function memberInitials(name: string, email?: string) {
  const src = (name || email || "?").trim()
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return src.slice(0, 2).toUpperCase()
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

function fmtWeekRangeFromMs(weekStartMs: number) {
  const dates = datesFromWeekStartMs(weekStartMs)
  return fmtWeekRange(dates)
}

function datesFromWeekStartMs(weekStartMs: number) {
  const sun = new Date(weekStartMs)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sun)
    d.setDate(sun.getDate() + i)
    return d
  })
}

function fmtHmPill(mins: number) {
  const m = Math.max(0, Math.round(mins))
  const h = Math.floor(m / 60)
  const r = m % 60
  return `${String(h).padStart(2, "0")}h ${String(r).padStart(2, "0")}m`
}

function fmtSubmittedAt(value: unknown) {
  if (value == null) return "—"
  const d = new Date(value as string | number)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function tabToSubmissionStatus(tab: ApprovalTab): SubmissionApiStatus {
  const found = TAB_CONFIG.find(t => t.id === tab)
  return found?.submissionStatus ?? "pending"
}

function apiStatusToUiStatus(status: string): ApprovalStatus {
  const s = status.toLowerCase()
  if (s === "pending") return "pending"
  if (s === "rejected") return "changes_needed"
  return "approved"
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

function dailyBreakdownFromSheet(sheet: Record<string, unknown> | null | undefined): DayTotals[] {
  if (!sheet) return DAY_API_KEYS.map(() => ({ billable: 0, nonBillable: 0 }))
  const totals =
    normalizeDailyTotals(sheet.dailyTotals) ??
    normalizeDailyTotals(sheet.approvalDailyTotals) ??
    normalizeDailyTotals(sheet.draftDailyTotals)
  if (!totals) return DAY_API_KEYS.map(() => ({ billable: 0, nonBillable: 0 }))
  return DAY_API_KEYS.map(key => totals[key] ?? { billable: 0, nonBillable: 0 })
}

function totalsFromBreakdown(breakdown: DayTotals[]) {
  let trackedMins = 0
  let billableMins = 0
  const dailyMins = breakdown.map(d => {
    const mins = (d.billable ?? 0) + (d.nonBillable ?? 0)
    trackedMins += mins
    billableMins += d.billable ?? 0
    return mins
  })
  return { trackedMins, billableMins, dailyMins }
}

function extractSubmissionList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[]
  if (!payload || typeof payload !== "object") return []
  const root = payload as Record<string, unknown>
  if (Array.isArray(root.data)) return root.data as Record<string, unknown>[]
  const data = root.data
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const inner = data as Record<string, unknown>
    if (Array.isArray(inner.data)) return inner.data as Record<string, unknown>[]
    if (Array.isArray(inner.submissions)) return inner.submissions as Record<string, unknown>[]
  }
  return []
}

function fmtWeekRange(dates: Date[]) {
  return `${MONTHS[dates[0].getMonth()]} ${dates[0].getDate()} – ${MONTHS[dates[6].getMonth()]} ${dates[6].getDate()}`
}

function mapSubmissionRow(raw: Record<string, unknown>, weekStartMs: number): ApprovalSubmission | null {
  const id = String(raw._id ?? raw.submissionId ?? raw.id ?? "").trim()
  if (!id) return null

  const sheet =
    (raw.timeSheetData as Record<string, unknown> | undefined) ??
    (raw.timesheet as Record<string, unknown> | undefined) ??
    raw

  const userField = raw.userData ?? raw.user ?? raw.submitter ?? raw.submitterData
  let name = String(raw.name ?? "")
  let email = raw.email != null ? String(raw.email) : undefined
  let image = raw.image != null ? String(raw.image) : undefined

  if (userField && typeof userField === "object") {
    const u = userField as Record<string, unknown>
    if (u.name) name = String(u.name)
    if (u.email) email = String(u.email)
    if (u.image) image = String(u.image)
  }

  const userId = String(
    raw.userId ??
    raw.submitterId ??
    (userField && typeof userField === "object"
      ? (userField as Record<string, unknown>)._id ?? (userField as Record<string, unknown>).id
      : "") ??
    ""
  ).trim()
  if (!userId) return null

  if (!name) name = email || "Unknown"

  const breakdown = dailyBreakdownFromSheet(sheet)
  const { trackedMins, billableMins, dailyMins } = totalsFromBreakdown(breakdown)
  const capacityMins = DEFAULT_WEEKLY_CAPACITY_H * 60
  const submissionStatus = String(raw.submissionStatus ?? raw.approvalStatus ?? raw.currentStatus ?? "pending")
  const timezone = String(raw.timeZone ?? sheet.timeZone ?? "UTC")

  return {
    id,
    userId,
    name,
    email,
    image,
    initials: memberInitials(name, email),
    dateRange: fmtWeekRangeFromMs(weekStartMs),
    tracked: fmtHmPill(trackedMins),
    trackedMins,
    capacity: fmtHmPill(capacityMins),
    capacityMins,
    billable: fmtHmPill(billableMins),
    billableMins,
    status: apiStatusToUiStatus(submissionStatus),
    submittedAt: fmtSubmittedAt(raw.submittedAt ?? raw.updatedAt ?? raw.createdAt),
    timezone,
    dailyMins,
    dailyBreakdown: breakdown,
  }
}

function submissionToMember(sub: ApprovalSubmission): AllTimesheetsMember {
  return {
    id: sub.userId,
    name: sub.name,
    email: sub.email,
    image: sub.image,
    dailyMins: sub.dailyMins,
    dailyBreakdown: sub.dailyBreakdown,
    weekTotalMins: sub.trackedMins,
    weeklyCapacityH: DEFAULT_WEEKLY_CAPACITY_H,
    timeZone: sub.timezone,
  }
}

const submissionInflight = new Map<
  string,
  Promise<{
    submissions: ApprovalSubmission[]
    metadata: { totalPages: number; currentPage: number; nextPage: number | null; count: number }
  }>
>()

async function fetchWorkspaceSubmissions(opts: {
  workspaceId: string
  weekStartMs: number
  weekEndMs: number
  submissionStatus: SubmissionApiStatus
  page?: number
  size?: number
}) {
  const safePage = Math.max(1, Number(opts.page) || 1)
  const size = opts.size ?? SUBMISSION_PAGE_SIZE
  const cacheKey = `${opts.workspaceId}-${opts.weekStartMs}-${opts.weekEndMs}-${opts.submissionStatus}-${safePage}-${size}`

  const existing = submissionInflight.get(cacheKey)
  if (existing) return existing

  const promise = (async () => {
    const params = new URLSearchParams({
      submissionStatus: opts.submissionStatus,
      weekStart: String(opts.weekStartMs),
      weekEnd: String(opts.weekEndMs),
      page: String(safePage),
      size: String(size),
    })
    const url = `${taskroomBase()}tasks/time/sheets/submission/${encodeURIComponent(opts.workspaceId)}/workspace?${params.toString()}`
    const res = await axios.get(url, { headers: authHeaders() })
    const payload = res.data
    if (payload?.status === false) {
      throw new Error(payload?.message || "Failed to load submissions")
    }
    const rows = extractSubmissionList(payload)
    const submissions = rows
      .map(row => mapSubmissionRow(row, opts.weekStartMs))
      .filter((s): s is ApprovalSubmission => s != null)
    const sheetMeta = extractSheetMetadata(payload)
    const count = typeof payload?.metadata?.count === "number" ? payload.metadata.count : submissions.length
    return { submissions, metadata: { ...sheetMeta, count } }
  })().finally(() => {
    submissionInflight.delete(cacheKey)
  })

  submissionInflight.set(cacheKey, promise)
  return promise
}

async function apiReviewSubmission(
  submissionId: string,
  action: ReviewAction,
  comment?: string
) {
  const payload: { action: ReviewAction; comment?: string } = { action }
  if (comment?.trim()) {
    payload.comment = comment.trim()
  }
  const res = await axios.put(
    `${taskroomBase()}tasks/time/sheets/admin/review/submission/${encodeURIComponent(submissionId)}`,
    payload,
    { headers: authHeaders() }
  )
  const resBody = res.data as { status?: boolean; message?: string }
  if (resBody?.status === false) throw new Error(resBody.message || "Failed to update submission")
  return res.data
}

// AFTER
function mapWorkspaceMemberToPerson(raw: Record<string, unknown>): OrgPerson | null {
  const id = String(raw._id ?? "")
  if (!id) return null
  const name = String(raw.name ?? raw.email ?? "Unknown")
  const email = String(raw.email ?? "")
  return { id, name, email, initials: memberInitials(name, email) }
}

async function apiUpdateTimesheetManagerApprovers(
  recordId: string,
  payload: { addedApprovers?: string[]; removedApprovers?: string[] }
) {
  const res = await axios.put(
    `${taskroomBase()}time/sheets/manager/${encodeURIComponent(recordId)}`,
    payload,
    { headers: authHeaders() }
  )
  const body = res.data as { status?: boolean; message?: string }
  if (body?.status === false) throw new Error(body.message || "Failed to update approvers")
  return res.data
}

async function apiDeleteTimesheetManager(recordId: string) {
  const res = await axios.delete(
    `${taskroomBase()}time/sheets/manager/${encodeURIComponent(recordId)}`,
    { headers: authHeaders() }
  )
  const body = res.data as { status?: boolean; message?: string }
  if (body?.status === false) throw new Error(body.message || "Failed to delete submitter")
  return res.data
}

// AFTER
function parseWorkspaceMembersResponse(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== "object") return []
  const root = body as Record<string, unknown>
  const data = root.data
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  return []
}

async function apiSearchWorkspaceMembers(workspaceId: string, search = "") {
  const token = localStorage.getItem("garage_tok")
  if (!token) throw new Error("Sign in required")
  const res = await axios.get(
    `${taskroomBase()}time/sheets/manager/${encodeURIComponent(workspaceId)}/workspace/users?page=1&size=25&searchData=${encodeURIComponent(search)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const body = res.data as { status?: boolean; message?: string; data?: unknown }
  if (body?.status === false) throw new Error(body.message || "Failed to fetch workspace members")
  console.log("peopleccc", body?.data)
  const list = parseWorkspaceMembersResponse(body)
  const people: OrgPerson[] = []
  const lookup: Record<string, OrgPerson> = {}

  for (const item of list) {
    const person = mapWorkspaceMemberToPerson(item)
    if (!person) continue
    people.push(person)
    lookup[person.id] = person
  }
  console.log("peopleccc", people)
  console.log("peopleccc11", lookup)
  return { people, lookup }

}

// ─── Fetch approver candidates for a submitter row ────────────────────────────
// URL: GET baseUrl/time/sheets/manager/add/approvers
// - newObj=true  → new record, send approverList[], do NOT send mgrId
// - newObj=false → existing record, send mgrId (_id of the timesheetMgr record) + approverList[]
// approverList = already-selected approver IDs (API excludes them from results)

async function apiGetApproversForSubmitter(
  params: {
    workspaceId: string
    size?: number
    page?: number
    searchData?: string
    status?: string
  } & (
      | { newObj: true; approverList: string[] }
      | { newObj: false; mgrId: string; approverList: string[] }
    )
) {
  const token = localStorage.getItem("garage_tok")
  if (!token) throw new Error("Sign in required")

  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    size: String(params.size ?? 10),
    workspaceId: params.workspaceId,
    newObj: String(params.newObj),
    ...(params.searchData ? { searchData: params.searchData } : {}),
    ...(params.status ? { status: params.status } : {}),
  })
  // mgrId only sent when newObj=false
  if (params.newObj === false) query.set("mgrId", params.mgrId)

  // approverList is an array — append each value separately
  params.approverList.forEach(id => query.append("approverList[]", id))

  const res = await axios.get(
    `${taskroomBase()}time/sheets/manager/add/approvers?${query.toString()}`,
    { headers: authHeaders() }
  )

  const body = res.data as { status?: boolean; message?: string; data?: unknown }
  if (body?.status === false) throw new Error(body.message || "Failed to fetch approvers")

  // Response shape: { status, message, metadata, data: [...] }
  const data = body.data
  const list: Record<string, unknown>[] = Array.isArray(data) ? data : []

  const people: OrgPerson[] = []
  const lookup: Record<string, OrgPerson> = {}
  for (const item of list) {
    const id = String(item._id ?? "")
    if (!id) continue
    const name = String(item.name ?? item.email ?? "Unknown")
    const email = String(item.email ?? "")
    const person: OrgPerson = { id, name, email, initials: memberInitials(name, email) }
    people.push(person)
    lookup[id] = person
  }
  return { people, lookup }
}

function extractUserIds(field: unknown): string[] {
  if (!field) return []
  if (typeof field === "string") return [field]
  if (Array.isArray(field)) {
    return field.map(v => {
      if (typeof v === "string") return v
      if (v && typeof v === "object") return String((v as Record<string, unknown>)._id ?? (v as Record<string, unknown>).id ?? "")
      return ""
    }).filter(Boolean)
  }
  if (typeof field === "object") {
    const id = String((field as Record<string, unknown>)._id ?? (field as Record<string, unknown>).id ?? "")
    return id ? [id] : []
  }
  return []
}

function personFromManagerField(field: unknown): OrgPerson | null {
  const pick = (o: Record<string, unknown>) => {
    const id = String(o._id ?? o.id ?? "")
    if (!id) return null
    const name = String(o.name ?? o.email ?? "Unknown")
    const email = String(o.email ?? "")
    return { id, name, email, initials: memberInitials(name, email) }
  }
  if (Array.isArray(field)) {
    for (const item of field) {
      if (item && typeof item === "object") {
        const p = pick(item as Record<string, unknown>)
        if (p) return p
      }
    }
    return null
  }
  if (field && typeof field === "object") return pick(field as Record<string, unknown>)
  return null
}

function buildPeopleLookupFromEntry(raw: Record<string, unknown>, lookup: Record<string, OrgPerson>) {
  const submitterPerson = personFromManagerField(raw.submitter)
  if (submitterPerson) lookup[submitterPerson.id] = submitterPerson
  const approverField = raw.approvers ?? raw.approver
  if (Array.isArray(approverField)) {
    for (const a of approverField) {
      const ap = personFromManagerField(a)
      if (ap) lookup[ap.id] = ap
    }
  } else {
    const ap = personFromManagerField(approverField)
    if (ap) lookup[ap.id] = ap
  }
}

function mapSubmitterApproverEntry(raw: Record<string, unknown>): SubmitterRow | null {
  const submitterId = extractUserIds(raw.submitter)[0]
  if (!submitterId) return null
  return {
    recordId: raw._id != null ? String(raw._id) : undefined,
    submitterId,
    approverIds: extractUserIds(raw.approvers ?? raw.approver),
  }
}

function mapManagerRecord(raw: Record<string, unknown>): SubmitterRow | null {
  const submitterId = extractUserIds(raw.submitter ?? raw.submitters)[0]
  if (!submitterId) return null
  return {
    recordId: raw._id != null ? String(raw._id) : undefined,
    submitterId,
    approverIds: extractUserIds(raw.approvers ?? raw.approver),
  }
}

function extractSubmitterApproverEntries(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return []
  const root = payload as Record<string, unknown>
  if (Array.isArray(root.reportMgr)) return root.reportMgr as Record<string, unknown>[]
  const data = root.data
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const inner = data as Record<string, unknown>
    if (Array.isArray(inner.reportMgr)) return inner.reportMgr as Record<string, unknown>[]
    if (Array.isArray(inner.data)) return inner.data as Record<string, unknown>[]
  }
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  return []
}

function extractManagerList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[]
  if (!payload || typeof payload !== "object") return []
  const p = payload as Record<string, unknown>
  if (Array.isArray(p.data)) return p.data as Record<string, unknown>[]
  const data = p.data
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const inner = data as Record<string, unknown>
    if (Array.isArray(inner.data)) return inner.data as Record<string, unknown>[]
    if (Array.isArray(inner.records)) return inner.records as Record<string, unknown>[]
  }
  if (Array.isArray(p.records)) return p.records as Record<string, unknown>[]
  return []
}

async function apiGetTimesheetManagers(workspaceId: string) {
  const res = await axios.get(`${taskroomBase()}time/sheets/manager/${workspaceId}/workspace`, {
    headers: authHeaders(),
  })
  const body = res.data?.data ?? res.data
  const rows: SubmitterRow[] = []
  const lookup: Record<string, OrgPerson> = {}
  const entries = extractSubmitterApproverEntries(body)
  if (entries.length > 0) {
    for (const item of entries) {
      const row = mapSubmitterApproverEntry(item)
      if (!row) continue
      rows.push(row)
      buildPeopleLookupFromEntry(item, lookup)
    }
    return { rows, lookup }
  }
  for (const item of extractManagerList(body)) {
    const row = mapManagerRecord(item)
    if (!row) continue
    rows.push(row)
    buildPeopleLookupFromEntry(item, lookup)
  }
  return { rows, lookup }
}

async function apiPostTimesheetManager(body: { workspaceId: string; reportMgr: SubmitterApproverPayload[] }) {
  const res = await axios.post(`${taskroomBase()}time/sheets/manager/bulk`, body, { headers: authHeaders() })
  return res.data
}

function buildSubmitterApproverPayload(rows: SubmitterRow[]): SubmitterApproverPayload[] {
  return rows.map(row => ({ submitter: row.submitterId, approvers: row.approverIds }))
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Ico = {
  User: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.5 12.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  Users: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="9.5" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.1" />
      <path d="M1 12c0-2 1.8-3.5 4-3.5M7 12c0-1.8 1.2-3 3-3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 4v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  Reply: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M4 4.5L2 7l2 2.5M2 7h6a4 4 0 014 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 7l3 3 7-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Pencil: () => (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M7.5 1.5l2 2L4 9H2V7l5.5-5.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  ),
  Pending: () => (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M5.5 3v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Message: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 3h10a1 1 0 011 1v6a1 1 0 01-1 1H6l-3 2V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
  Globe: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 7h10M7 2a8 8 0 010 10M7 2a8 8 0 000 10" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  Grid: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <rect x="8" y="2" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <rect x="2" y="8" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <rect x="8" y="8" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  List: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 4h8M3 7h8M3 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  Plus: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  More: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" /><circle cx="11" cy="7" r="1.2" />
    </svg>
  ),
  Settings: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 1.5v1M7 11.5v1M1.5 7h1M11.5 7h1M3.1 3.1l.7.7M10.2 10.2l.7.7M10.2 3.1l-.7.7M3.1 10.2l-.7.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  Calendar: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="3" width="10" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 6h10M5 1.5V3M9 1.5V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  Bell: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 12a2 2 0 002-2H5a2 2 0 002 2zM3 5a4 4 0 118 0v2.5l1 1.5H2l1-1.5V5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  ),
  Info: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6 5.2V8M6 4v.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 4h8M5.5 4V3h3v1M5 6v4M7 6v4M9 6v4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  PanelClose: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 5l-4 4M5 5l4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  CheckCircle: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 7l2 2 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  EmptyCheck: () => (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="8" width="32" height="32" rx="8" stroke="#333" strokeWidth="1.5" strokeDasharray="4 3" />
      <circle cx="24" cy="24" r="10" stroke="#555" strokeWidth="1.5" strokeDasharray="3 2" />
      <path d="M19 24l3 3 7-7" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Sparkle: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.5 2.5l1.4 1.4M8.1 8.1l1.4 1.4M2.5 9.5l1.4-1.4M8.1 3.9l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
}


// ─── Shared styles ────────────────────────────────────────────────────────────

const filterPill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "#161616",
  border: "1px solid #2a2b2c",
  borderRadius: 999,
  padding: "6px 14px",
  fontSize: 13,
  color: "#aaa",
  cursor: "pointer",
}

const thCell: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 11,
  color: "#666",
  fontWeight: 500,
  textAlign: "right",
}

const iconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: "#0a0a0d",
  border: "1px solid #2a2b2c",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#888",
  cursor: "pointer",
}

const accentBtn: React.CSSProperties = {
  background: "var(--brand)",
  border: "none",
  color: "#0a0a0d",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
}

// ─── Shared UI components ─────────────────────────────────────────────────────

function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#c9a80a",
        color: "#0a0a0d",
        fontSize: size * 0.35,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  if (status === "changes_needed") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "#f5c842", color: "#111", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
        <Ico.Pencil />
        Changes needed
      </span>
    )
  }
  if (status === "pending") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#2a2608", color: "var(--brand)", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}>
        <Ico.Pending />
        Pending
      </span>
    )
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#2a2608", color: "var(--brand)", border: "1px solid #7a6800", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}>
      <Ico.Check />
      Approved
    </span>
  )
}

function SettingsSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ background: "#141414", border: "1px solid #2a2b2c", borderRadius: 8, color: "#e0e0e0", fontSize: 13, padding: "6px 10px", cursor: "pointer", outline: "none", minWidth: 120 }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function MemberPickerSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #161616" }}>
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 flex-1 max-w-[200px]" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
      ))}
    </>
  )
}

// ─── ApproverPopover ──────────────────────────────────────────────────────────

function ApproverPopover({
  submitterId,
  approverIds,
  approverCandidates,
  approverMembersLoading,
  approverSearch,
  onSearchChange,
  onToggle,
  onClose,
}: {
  submitterId: string
  approverIds: string[]
  approverCandidates: OrgPerson[]
  approverMembersLoading: boolean
  approverSearch: string
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onToggle: (submitterId: string, approverId: string, person: OrgPerson) => void
  onClose: () => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handler, true)
    return () => document.removeEventListener("mousedown", handler, true)
  }, [onClose])

  return (
    <div
      ref={popoverRef}
      onMouseDown={e => e.stopPropagation()}
      style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 240, background: "#161616", border: "1px solid #2a2b2c", borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", zIndex: 100, overflow: "hidden" }}
    >
      <div style={{ padding: 10, borderBottom: "1px solid #222" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Ico.Search />
          <input
            autoFocus
            value={approverSearch}
            onChange={onSearchChange}
            placeholder="Search approvers..."
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 12, color: "#e0e0e0" }}
          />
        </div>
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {approverMembersLoading ? (
          <div style={{ padding: "8px 12px" }}><MemberPickerSkeleton /></div>
        ) : approverCandidates.length === 0 ? (
          <p style={{ padding: 12, fontSize: 12, color: "#666", textAlign: "center", margin: 0 }}>
            {approverSearch.trim() ? "No approvers found" : "Type to search approvers"}
          </p>
        ) : (
          approverCandidates.map(p => {
            const isSelected = approverIds.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggle(submitterId, p.id, p)
                }}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", background: isSelected ? "#2a2b2c" : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ position: "relative", flexShrink: 0, borderRadius: "50%", outline: isSelected ? "2px solid var(--brand)" : "2px solid transparent", outlineOffset: 1 }}>
                  <Avatar initials={p.initials} size={28} />
                  {isSelected && (
                    <div style={{ position: "absolute", bottom: -2, right: -2, width: 12, height: 12, background: "var(--brand)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4l2 2 3-3" stroke="#0a0a0d" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#e0e0e0", fontSize: 13, fontWeight: isSelected ? 600 : 400 }}>{p.isMe ? "Me" : p.name}</div>
                  <div style={{ color: "#666", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── SubmitterRowItem ─────────────────────────────────────────────────────────

function SubmitterRowItem({
  row,
  isNew,
  workspaceId,
  peopleById,
  openApproverFor,
  onApproverPickerToggle,
  onApproverPopoverClose,
  onToggleApprover,
  onRemoveRow,
  onPeopleUpdate,
}: {
  row: SubmitterRow
  isNew: boolean
  workspaceId: string
  peopleById: Record<string, OrgPerson>
  openApproverFor: string | null
  onApproverPickerToggle: (id: string) => void
  onApproverPopoverClose: () => void
  onToggleApprover: (submitterId: string, approverId: string, person?: OrgPerson) => void
  onRemoveRow: (submitterId: string) => void
  onPeopleUpdate: (lookup: Record<string, OrgPerson>) => void
}) {
  const [approverCandidates, setApproverCandidates] = useState<OrgPerson[]>([])
  const [approverMembersLoading, setApproverMembersLoading] = useState(false)
  const [approverSearch, setApproverSearch] = useState("")
  const [hoveredApproverId, setHoveredApproverId] = useState<string | null>(null)
  const approverDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const popoverOpen = openApproverFor === row.submitterId
  const submitter = peopleById[row.submitterId]
  const approverCount = row.approverIds.length

  // When popover closes, reset search & candidates
  useEffect(() => {
    if (!popoverOpen) {
      setApproverSearch("")
      setApproverCandidates([])
      return
    }
    void doApproverSearch("")
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only preload when this row's popover opens
  }, [popoverOpen])

  async function doApproverSearch(query: string) {
    if (!workspaceId) return
    setApproverMembersLoading(true)
    try {
      // newObj=true  → row not yet saved (no recordId), do NOT send mgrId
      // newObj=false → existing saved row, send recordId as mgrId
      const isNewRecord = !row.recordId

      const { people, lookup } = await apiGetApproversForSubmitter(
        isNewRecord
          ? {
            workspaceId,
            newObj: true,
            approverList: row.approverIds,
            searchData: query.trim(),
            page: 1,
            size: 10,
          }
          : {
            workspaceId,
            newObj: false,
            mgrId: row.recordId!,       // _id of the timesheetMgr record
            approverList: row.approverIds,
            searchData: query.trim(),
            page: 1,
            size: 10,
          }
      )
      setApproverCandidates(people)
      onPeopleUpdate(lookup)
    } catch {
      setApproverCandidates([])
    } finally {
      setApproverMembersLoading(false)
    }
  }

  function handleApproverSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setApproverSearch(value)
    if (approverDebounceRef.current) clearTimeout(approverDebounceRef.current)
    approverDebounceRef.current = setTimeout(() => void doApproverSearch(value), 400)
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr 200px 32px",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid #161616",
        background: isNew ? "color-mix(in srgb, var(--brand) 4%, transparent)" : "transparent",
      }}
    >
      <input type="checkbox" style={{ accentColor: "var(--brand)" }} />

      {/* Submitter identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar initials={submitter?.initials ?? "?"} />
        <div>
          <span style={{ color: "#e0e0e0", fontSize: 13, fontWeight: 500 }}>{submitter?.name ?? "Unknown member"}</span>
          {isNew && (
            <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4, background: "#2a2540", color: "#9d8ff0", fontSize: 10, fontWeight: 600, borderRadius: 999, padding: "2px 7px" }}>
              <Ico.Sparkle />NEW
            </span>
          )}
        </div>
      </div>

      {/* Approver trigger + popover */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => onApproverPickerToggle(row.submitterId)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            minHeight: 36,
            width: "100%",
            padding: "4px 8px",
            background: "#141414",
            border: popoverOpen ? "1px solid var(--brand)" : "1px solid #2a2b2c",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {approverCount === 0 ? (
            <span style={{ fontSize: 12, color: "#666" }}>Add approvers</span>
          ) : (
            <>
              <div style={{ display: "flex", marginRight: 4 }}>
                {row.approverIds.slice(0, 4).map((approverId, i) => {
                  const a = peopleById[approverId]
                  return (
                  <button
                    key={approverId}
                    type="button"
                    title={isNew ? undefined : "Remove approver"}
                    onMouseEnter={() => { if (!isNew) setHoveredApproverId(approverId) }}
                    onMouseLeave={() => { if (!isNew) setHoveredApproverId(prev => (prev === approverId ? null : prev)) }}
                    onMouseDown={e => {
                      // Keep the picker closed/open state unchanged when removing.
                      e.preventDefault()
                      e.stopPropagation()
                      if (!isNew) onToggleApprover(row.submitterId, approverId, a)
                    }}
                    style={{
                      marginLeft: i === 0 ? 0 : -4,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      cursor: isNew ? "default" : "pointer",
                      position: "relative",
                      borderRadius: 999,
                      outline: "none",
                    }}
                    disabled={isNew}
                  >
                    <Avatar initials={a?.initials ?? "?"} size={24} />
                    {!isNew && hoveredApproverId === approverId && (
                      <span
                        style={{
                          position: "absolute",
                          inset: -2,
                          borderRadius: 999,
                          background: "rgba(0,0,0,0.55)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid rgba(255,255,255,0.15)",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
                          <Ico.X />
                        </span>
                      </span>
                    )}
                  </button>
                  )
                })}
              </div>
              <span style={{ fontSize: 12, color: "#aaa" }}>
                {approverCount} approver{approverCount !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </button>

        {popoverOpen && (
          <ApproverPopover
            submitterId={row.submitterId}
            approverIds={row.approverIds}
            approverCandidates={approverCandidates}
            approverMembersLoading={approverMembersLoading}
            approverSearch={approverSearch}
            onSearchChange={handleApproverSearchChange}
            onToggle={onToggleApprover}
            onClose={onApproverPopoverClose}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => onRemoveRow(row.submitterId)}
        style={{ ...iconBtn, width: 28, height: 28, color: "#888" }}
      >
        <Ico.Trash />
      </button>
    </div>
  )
}

// ─── ManageApproversDialog ────────────────────────────────────────────────────

function ManageApproversDialog({
  open,
  workspaceId,
  initialRows,
  initialPeopleById,
  onClose,
  onSave,
}: {
  open: boolean
  workspaceId: string
  initialRows: SubmitterRow[]
  initialPeopleById: Record<string, OrgPerson>
  onClose: () => void
  onSave: (rows: SubmitterRow[], peopleById: Record<string, OrgPerson>) => void
}) {
  const [existingRows, setExistingRows] = useState<SubmitterRow[]>([])
  const [newRows, setNewRows] = useState<SubmitterRow[]>([])
  const [peopleById, setPeopleById] = useState<Record<string, OrgPerson>>({})

  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<OrgPerson[]>([])
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false)
  const [submitterSearchLoading, setSubmitterSearchLoading] = useState(false)

  const [openApproverFor, setOpenApproverFor] = useState<string | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ submitterId: string; isNew: boolean } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const searchAreaRef = useRef<HTMLDivElement>(null)
  const submitterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasOpenRef = useRef(false)
  const didInitRef = useRef(false)

  useEffect(() => {
    if (!open) { wasOpenRef.current = false; didInitRef.current = false; return }
    if (wasOpenRef.current) return
    wasOpenRef.current = true
    setExistingRows(initialRows.map(r => ({ ...r, approverIds: [...r.approverIds] })))
    setNewRows([])
    setPeopleById({ ...initialPeopleById })
    setSearch("")
    setSearchResults([])
    setSearchDropdownOpen(false)
    setOpenApproverFor(null)
    setPendingDelete(null)
    setIsDeleting(false)
    didInitRef.current = true
  }, [open, initialRows, initialPeopleById])

  // Keep parent state in sync so the settings drawer and reopening
  // "Edit list" reflect add/remove changes without a hard refresh.
  useEffect(() => {
    if (!open) return
    if (!didInitRef.current) return
    onSave([...existingRows, ...newRows], { ...peopleById })
  }, [open, existingRows, newRows, peopleById, onSave])

  useEffect(() => {
    if (!searchDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (!searchAreaRef.current?.contains(e.target as Node)) setSearchDropdownOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [searchDropdownOpen])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  const allSubmitterIds = new Set([
    ...existingRows.map(r => r.submitterId),
    ...newRows.map(r => r.submitterId),
  ])

  async function doSubmitterSearch(query: string) {
    if (!workspaceId) { toast.error("Workspace is required to search members"); return }
    setSubmitterSearchLoading(true)
    try {
      const { people, lookup } = await apiSearchWorkspaceMembers(workspaceId, query.trim())
      setSearchResults(people)
      setPeopleById(prev => ({ ...prev, ...lookup }))
    } catch (err) {
      setSearchResults([])
      const msg = axios.isAxiosError(err) ? (err.response?.data as { message?: string })?.message || err.message : "Failed to search members"
      toast.error(msg)
    } finally {
      setSubmitterSearchLoading(false)
    }
  }

  function handleSubmitterSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setSearch(value)
    setSearchDropdownOpen(true)
    if (submitterDebounceRef.current) clearTimeout(submitterDebounceRef.current)
    submitterDebounceRef.current = setTimeout(() => void doSubmitterSearch(value), 400)
  }

  function addSubmitterToDraft(person: OrgPerson) {
    if (allSubmitterIds.has(person.id)) { toast.error("This member is already in the list"); return }
    const newRow: SubmitterRow = { submitterId: person.id, approverIds: [] }
    setPeopleById(prev => ({ ...prev, [person.id]: person }))
    setNewRows(prev => [...prev, newRow])
    setSearch("")
    setSearchResults([])
    setSearchDropdownOpen(false)
  }

  function requestRemoveRow(submitterId: string, isNew: boolean) {
    setPendingDelete({ submitterId, isNew })
  }

  function cancelRemoveRow() {
    if (isDeleting) return
    setPendingDelete(null)
  }

  async function confirmRemoveRow() {
    if (!pendingDelete || isDeleting) return
    const { submitterId, isNew } = pendingDelete

    if (isNew) {
      setNewRows(prev => prev.filter(r => r.submitterId !== submitterId))
      if (openApproverFor === submitterId) setOpenApproverFor(null)
      setPendingDelete(null)
      return
    }

    const row = existingRows.find(r => r.submitterId === submitterId)
    if (!row) {
      setPendingDelete(null)
      return
    }

    setIsDeleting(true)
    setExistingRows(prev => prev.filter(r => r.submitterId !== submitterId))
    if (openApproverFor === submitterId) setOpenApproverFor(null)

    if (!row.recordId) {
      setPendingDelete(null)
      setIsDeleting(false)
      return
    }

    try {
      await apiDeleteTimesheetManager(row.recordId)
      toast.success("Submitter removed")
      setPendingDelete(null)
    } catch (err) {
      setExistingRows(prev => {
        if (prev.some(r => r.submitterId === submitterId)) return prev
        return [...prev, row]
      })
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message || err.message
        : err instanceof Error ? err.message : "Failed to delete submitter"
      toast.error(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  function toggleApproverForNew(submitterId: string, approverId: string, person?: OrgPerson) {
    if (person) setPeopleById(prev => ({ ...prev, [person.id]: person }))
    setNewRows(prev =>
      prev.map(r => {
        if (r.submitterId !== submitterId) return r
        const has = r.approverIds.includes(approverId)
        return { ...r, approverIds: has ? r.approverIds.filter(id => id !== approverId) : [...r.approverIds, approverId] }
      })
    )
  }

  async function toggleApproverForExisting(submitterId: string, approverId: string, person?: OrgPerson) {
    if (person) setPeopleById(prev => ({ ...prev, [person.id]: person }))
    // Find the row to get recordId and current state
    const row = existingRows.find(r => r.submitterId === submitterId)
    if (!row) return

    const isRemoving = row.approverIds.includes(approverId)

    // Optimistic UI update first
    setExistingRows(prev =>
      prev.map(r => {
        if (r.submitterId !== submitterId) return r
        return {
          ...r,
          approverIds: isRemoving
            ? r.approverIds.filter(id => id !== approverId)
            : [...r.approverIds, approverId],
        }
      })
    )

    // Persist to API if record already exists
    if (row.recordId) {
      try {
        await apiUpdateTimesheetManagerApprovers(row.recordId, {
          ...(isRemoving
            ? { removedApprovers: [approverId] }
            : { addedApprovers: [approverId] }),
        })
      } catch (err) {
        // Revert optimistic update on failure
        setExistingRows(prev =>
          prev.map(r => {
            if (r.submitterId !== submitterId) return r
            return {
              ...r,
              approverIds: isRemoving
                ? [...r.approverIds, approverId]       // re-add on revert
                : r.approverIds.filter(id => id !== approverId), // re-remove on revert
            }
          })
        )
        const msg = axios.isAxiosError(err)
          ? (err.response?.data as { message?: string })?.message || err.message
          : err instanceof Error ? err.message : "Failed to update approver"
        toast.error(msg)
      }
    }
  }

  function handlePeopleUpdate(lookup: Record<string, OrgPerson>) {
    setPeopleById(prev => ({ ...prev, ...lookup }))
  }

  function handleApproverPickerToggle(submitterId: string) {
    setOpenApproverFor(prev => (prev === submitterId ? null : submitterId))
  }

  async function refreshManagersFromApi() {
    if (!workspaceId) return
    const { rows, lookup } = await apiGetTimesheetManagers(workspaceId)
    setExistingRows(rows.map(r => ({ ...r, approverIds: [...r.approverIds] })))
    setNewRows([])
    setPeopleById(prev => ({ ...prev, ...lookup }))
    onSave(rows, lookup)
    return rows
  }

  async function handleSave() {
    if (!workspaceId) { toast.error("Workspace is required"); return }
    if (newRows.length === 0) { toast.error("No new submitters to save"); return }
    if (newRows.some(r => r.approverIds.length === 0)) {
      toast.error("Each new submitter must have at least one approver before saving")
      return
    }
    setIsPosting(true)
    try {
      await apiPostTimesheetManager({ workspaceId, reportMgr: buildSubmitterApproverPayload(newRows) })
      await refreshManagersFromApi()
      toast.success("Timesheet approvers saved")
      onClose()
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message || err.message
        : err instanceof Error ? err.message : "Failed to save approvers"
      toast.error(msg)
    } finally {
      setIsPosting(false)
    }
  }

  const showDropdown = searchDropdownOpen && (submitterSearchLoading || search.trim().length > 0)
  const addableResults = searchResults.filter(p => !allSubmitterIds.has(p.id))
  const hasNewRows = newRows.length > 0

  const rowProps = {
    workspaceId,
    peopleById,
    openApproverFor,
    onApproverPickerToggle: handleApproverPickerToggle,
    onApproverPopoverClose: () => setOpenApproverFor(null),
    onPeopleUpdate: handlePeopleUpdate,
  }

  const pendingDeleteName = pendingDelete
    ? (peopleById[pendingDelete.submitterId]?.name ?? "this submitter")
    : ""

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", background: "#161616" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#121214", border: "1px solid #2a2b2c", borderRadius: 12, width: "80vw", height: "80vh", maxWidth: "80vw", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div style={{ padding: "20px 20px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f0f0f0" }}>Manage Timesheet Approvers and Submitters</h2>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#888" }}>To view timesheet submissions, users must be added as approvers.</p>
            </div>
            <button type="button" onClick={onClose} style={{ ...iconBtn, width: 28, height: 28 }}><Ico.X /></button>
          </div>

          {/* Search input */}
          <div ref={searchAreaRef} style={{ position: "relative", marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#141414", border: "1px solid var(--brand)", borderRadius: 10, minHeight: 42 }}>
              <Ico.Search />
              <input
                value={search}
                onChange={handleSubmitterSearchChange}
                onFocus={() => { if (search.trim()) setSearchDropdownOpen(true) }}
                placeholder="Add submitters by name or email"
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "#c9cdd4" }}
              />
            </div>

            {showDropdown && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30, background: "#161616", border: "1px solid #2a2b2c", borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", maxHeight: 240, overflow: "auto" }}>
                {submitterSearchLoading ? (
                  <div style={{ padding: "8px 12px" }}><MemberPickerSkeleton /></div>
                ) : addableResults.length === 0 ? (
                  <p style={{ padding: 12, margin: 0, fontSize: 12, color: "#666", textAlign: "center" }}>
                    {search.trim() ? "No members match your search" : "No members found"}
                  </p>
                ) : (
                  addableResults.map(p => (
                    <button key={p.id} type="button" onClick={() => addSubmitterToDraft(p)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", background: "transparent", border: "none", borderBottom: "1px solid #222", cursor: "pointer", textAlign: "left" }}>
                      <Avatar initials={p.initials} size={28} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", color: "#e0e0e0", fontSize: 13 }}>{p.name}</span>
                        <span style={{ display: "block", color: "#666", fontSize: 11 }}>{p.email}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "0 20px" }}>

          {/* ── NEW submitters section ── */}
          {hasNewRows && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0 6px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  New — not saved yet
                </span>
                <div style={{ flex: 1, height: 1, background: "#2a2540" }} />
                <span style={{ fontSize: 11, color: "#666" }}>{newRows.length} pending</span>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#1e1b33", border: "1px solid #2a2540", borderRadius: 8, padding: "9px 12px", marginBottom: 8, fontSize: 12, color: "#9d8ff0" }}>
                <Ico.Info />
                <span>Assign at least one approver to each new submitter, then click <strong style={{ color: "#c4b8ff" }}>Save new submitters</strong> to confirm.</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 200px 32px", gap: 12, padding: "6px 0", borderBottom: "1px solid #222", fontSize: 11, color: "var(--brand)", fontWeight: 600 }}>
                <span /><span>Submitter</span><span>Approvers</span><span />
              </div>

              {newRows.map(row => (
                <SubmitterRowItem
                  key={row.submitterId}
                  row={row}
                  isNew={true}
                  {...rowProps}
                  onToggleApprover={(submitterId, approverId, person) => toggleApproverForNew(submitterId, approverId, person)}

                  onRemoveRow={submitterId => requestRemoveRow(submitterId, true)}
                />
              ))}
            </div>
          )}

          {/* ── EXISTING submitters section ── */}
          {existingRows.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0 6px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {hasNewRows ? "Already saved" : "Submitters"}
                </span>
                <div style={{ flex: 1, height: 1, background: "#222" }} />
                <span style={{ fontSize: 11, color: "#666" }}>{existingRows.length}</span>
              </div>

              {!hasNewRows && (
                <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 200px 32px", gap: 12, padding: "6px 0", borderBottom: "1px solid #222", fontSize: 11, color: "#666", fontWeight: 500 }}>
                  <span /><span>Submitter</span><span>Approvers</span><span />
                </div>
              )}

              {existingRows.map(row => (
                <SubmitterRowItem
                  key={row.submitterId}
                  row={row}
                  isNew={false}
                  {...rowProps}
                  onToggleApprover={(submitterId, approverId, person) => void toggleApproverForExisting(submitterId, approverId, person)}

                  onRemoveRow={submitterId => requestRemoveRow(submitterId, false)}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {existingRows.length === 0 && !hasNewRows && (
            <div style={{ padding: "48px 0", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Ico.EmptyCheck /></div>
              <p style={{ margin: 0, fontSize: 13, color: "#666" }}>Add your first submitter from the search field above</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #222", flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#e0e0e0", fontSize: 13, cursor: "pointer" }}>
            {hasNewRows ? "Discard & close" : "Close"}
          </button>

          {hasNewRows && (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isPosting}
              style={{
                ...accentBtn,
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: isPosting ? 0.7 : 1,
                cursor: isPosting ? "not-allowed" : "pointer",
              }}
            >
              {isPosting ? (
                <>Saving…</>
              ) : (
                <>
                  <Ico.Check />
                  Save {newRows.length} new submitter{newRows.length !== 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {pendingDelete && (
        <div
          onClick={e => { e.stopPropagation(); cancelRemoveRow() }}
          style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", borderRadius: 12 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 360, background: "#161616", border: "1px solid #2a2b2c", borderRadius: 12, padding: "20px 22px", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
          >
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>Remove submitter?</h3>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>
              {pendingDelete.isNew
                ? <>Remove <strong style={{ color: "#e0e0e0" }}>{pendingDeleteName}</strong> from the pending list? This cannot be undone.</>
                : <>Remove <strong style={{ color: "#e0e0e0" }}>{pendingDeleteName}</strong> and their approver assignments? This will delete the saved record.</>}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={cancelRemoveRow}
                disabled={isDeleting}
                style={{ background: "none", border: "1px solid #2a2b2c", borderRadius: 8, color: "#e0e0e0", fontSize: 13, padding: "8px 14px", cursor: isDeleting ? "not-allowed" : "pointer", opacity: isDeleting ? 0.6 : 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmRemoveRow()}
                disabled={isDeleting}
                style={{ background: "#c0392b", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, padding: "8px 14px", cursor: isDeleting ? "not-allowed" : "pointer", opacity: isDeleting ? 0.7 : 1 }}
              >
                {isDeleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ApprovalSettingsDrawer ───────────────────────────────────────────────────

function ApprovalSettingsDrawer({
  onClose,
  submitterRows,
  peopleById,
  dueDay,
  dueTime,
  remindBefore,
  remindAfter,
  onDueDayChange,
  onDueTimeChange,
  onRemindBeforeChange,
  onRemindAfterChange,
  onEditList,
}: {
  onClose: () => void
  submitterRows: SubmitterRow[]
  peopleById: Record<string, OrgPerson>
  dueDay: string
  dueTime: string
  remindBefore: string
  remindAfter: string
  onDueDayChange: (v: string) => void
  onDueTimeChange: (v: string) => void
  onRemindBeforeChange: (v: string) => void
  onRemindAfterChange: (v: string) => void
  onEditList: () => void
}) {
  const uniquePeopleCount = useMemo(() => {
    const ids = new Set<string>()
    submitterRows.forEach(r => { ids.add(r.submitterId); r.approverIds.forEach(a => ids.add(a)) })
    return ids.size
  }, [submitterRows])

  const uniquePeopleForPreview = useMemo(() => {
    const ids: string[] = []
    const seen = new Set<string>()
    for (const r of submitterRows) {
      if (!seen.has(r.submitterId)) { ids.push(r.submitterId); seen.add(r.submitterId) }
      for (const a of r.approverIds) {
        if (!seen.has(a)) { ids.push(a); seen.add(a) }
      }
    }
    return ids.map(id => peopleById[id]).filter((p): p is OrgPerson => Boolean(p))
  }, [submitterRows, peopleById])

  return (
    <div style={{ width: 360, flexShrink: 0, borderLeft: "1px solid #0a0a0d", background: "#0a0a0d", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #0a0a0d" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>Timesheet Approval Settings</h2>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={iconBtn}><Ico.More /></button>
          <button type="button" onClick={onClose} style={iconBtn}><Ico.PanelClose /></button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 18px" }}>
        {/* Submitters & Approvers */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>Submitters &amp; Approvers</span>
            <button type="button" onClick={onEditList} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--brand)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              <Ico.Pencil />Edit list
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#161616", border: "1px solid #2a2b2c", borderRadius: 10 }}>
            <span style={{ color: "#888" }}><Ico.Users /></span>
            <span style={{ fontSize: 13, color: "#e0e0e0" }}>{uniquePeopleCount} people</span>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex" }}>
              {uniquePeopleForPreview.slice(0, 5).map((p, i) => (
                <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                  <Avatar initials={p.initials} size={26} />
                </div>
              ))}
              {uniquePeopleForPreview.length > 5 && (
                <div style={{ marginLeft: -6 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      background: "#2a2b2c",
                      border: "1px solid #3a3b3c",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#e0e0e0",
                    }}
                  >
                    +{uniquePeopleForPreview.length - 5}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Deadlines */}
        {/* <section style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>Timesheet deadlines</span>
            <span style={{ color: "#555" }}><Ico.Info /></span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#aaa" }}><Ico.Calendar />Due date</span>
              <SettingsSelect value={dueDay} options={DUE_DAYS} onChange={onDueDayChange} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#aaa" }}><Ico.Clock />Due time</span>
              <SettingsSelect value={dueTime} options={DUE_TIMES} onChange={onDueTimeChange} />
            </div>
          </div>
        </section> */}

        {/* Reminders */}
        {/* <section>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>Send reminders</span>
            <span style={{ color: "#555" }}><Ico.Info /></span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#aaa" }}><Ico.Bell />Remind before due date</span>
              <SettingsSelect value={remindBefore} options={REMIND_BEFORE} onChange={onRemindBeforeChange} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#aaa" }}><Ico.Bell />Remind after due date</span>
              <SettingsSelect value={remindAfter} options={REMIND_AFTER} onChange={onRemindAfterChange} />
            </div>
          </div>
        </section> */}
      </div>
    </div>
  )
}

// ─── ApprovalsListView ────────────────────────────────────────────────────────

const listNavBtn = {
  background: "none",
  border: "none",
  color: "#666",
  cursor: "pointer",
  fontSize: 14,
  padding: "2px 6px",
  borderRadius: 4,
} as const

// ─── Review comment dialog (reject / request changes) ─────────────────────────

function ReviewCommentDialog({
  memberName,
  submitting,
  onCancel,
  onSubmit,
}: {
  memberName: string
  submitting: boolean
  onCancel: () => void
  onSubmit: (text: string) => void
}) {
  const [text, setText] = useState("")
  const trimmed = text.trim()
  const canSubmit = trimmed.length > 0 && !submitting

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onCancel, submitting])

  return (
    <div
      onClick={() => { if (!submitting) onCancel() }}
      style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", background: "#161616" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 420, maxWidth: "92vw", background: "#161616", border: "1px solid #2a2b2c", borderRadius: 12, padding: "22px 24px", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>Request changes</h3>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>
          Add a reason for <strong style={{ color: "#e0e0e0" }}>{memberName || "this submitter"}</strong>. They will see this when reviewing their timesheet.
        </p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Explain what needs to be changed…"
          disabled={submitting}
          autoFocus
          rows={4}
          style={{
            width: "100%",
            marginTop: 16,
            boxSizing: "border-box",
            background: "#121214",
            border: "1px solid #2a2b2c",
            borderRadius: 8,
            color: "#e8e8e8",
            fontSize: 13,
            lineHeight: 1.5,
            padding: "10px 12px",
            resize: "vertical",
            minHeight: 96,
            outline: "none",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{ background: "none", border: "1px solid #2a2b2c", borderRadius: 8, color: "#e0e0e0", fontSize: 13, padding: "8px 14px", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { if (canSubmit) onSubmit(trimmed) }}
            disabled={!canSubmit}
            style={{ background: "#f5c842", border: "none", borderRadius: 8, color: "#0a0a0d", fontSize: 13, fontWeight: 600, padding: "8px 16px", cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.5 }}
          >
            {submitting ? "Submitting…" : "Request changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ApprovalsListView({
  activeTab,
  onTabChange,
  submissions,
  tabCounts,
  onOpenDetail,
  showReviewActions,
  onOpenSettings,
  weekOffset,
  onWeekOffsetChange,
  dates,
  loading,
  error,
  onRetry,
  submissionsPage,
  onSubmissionsPageChange,
  submissionsMetadata,
  onReview,
  reviewingId,
}: {
  activeTab: ApprovalTab
  onTabChange: (t: ApprovalTab) => void
  submissions: ApprovalSubmission[]
  tabCounts: Record<ApprovalTab, number>
  onOpenDetail: (sub: ApprovalSubmission) => void
  showReviewActions: boolean
  onOpenSettings: () => void
  weekOffset: number
  onWeekOffsetChange: Dispatch<SetStateAction<number>>
  dates: Date[]
  loading: boolean
  error: string | null
  onRetry: () => void
  submissionsPage: number
  onSubmissionsPageChange: (fn: (p: number) => number) => void
  submissionsMetadata: { totalPages: number; currentPage: number; nextPage: number | null; count: number }
  onReview: (submissionId: string, action: ReviewAction, memberName?: string) => void
  reviewingId: string | null
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px 0", flexShrink: 0, paddingTop:"0px" }}>

        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #0a0a0d", marginBottom: 16 }}>
          {TAB_CONFIG.map(tab => {
            const count = tabCounts[tab.id] ?? 0
            const active = activeTab === tab.id
            return (
              <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", borderBottom: active ? "2px solid #e8e8e8" : "2px solid transparent", marginBottom: -1, color: active ? "#e8e8e8" : "#666", fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer" }}>
                {tab.label}
                {/* {count > 0 && (
                  <span style={{ minWidth: 18, height: 18, borderRadius: 999, padding: "0 6px", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", background: active ? "var(--brand)" : "#2a2b2c", color: active ? "var(--brand-foreground)" : "#888" }}>
                    {count}
                  </span>
                )} */}
              </button>
            )
          })}

          <button type="button" onClick={onOpenSettings} style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", marginBottom: 8, background: "#161616", border: "1px solid #2a2b2c", borderRadius: 8, color: "#e0e0e0", fontSize: 13, fontWeight: 500, padding: "8px 14px", cursor: "pointer" }}>
            <Ico.Settings />Settings
          </button>

        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button type="button" onClick={() => onWeekOffsetChange(o => o - 1)} style={listNavBtn} aria-label="Previous week">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" onClick={() => onWeekOffsetChange(o => o + 1)} style={listNavBtn} aria-label="Next week">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <TimesheetWeekPicker dates={dates} onWeekOffsetChange={onWeekOffsetChange} />
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => onWeekOffsetChange(0)}
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
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 24px 80px" }}>
        {loading && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--brand)" }}>Loading submissions…</div>
        )}
        {!loading && error && (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ color: "#e57373", marginBottom: 16, fontSize: 14 }}>{error}</div>
            <button type="button" onClick={onRetry} style={{ background: "#2a2b2c", border: "1px solid #3a3b45", color: "#e0e0e0", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #222324" }}>
                <th style={{ ...thCell, textAlign: "left", paddingLeft: 0 }}>Details</th>
                <th style={thCell}>Tracked</th>
                <th style={thCell}>Capacity</th>
                <th style={thCell}>Billable</th>
                <th style={thCell}>Over capacity</th>
                <th style={{ ...thCell, width: showReviewActions ? 100 : 140 }}>{showReviewActions ? "Review" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#555" }}>No submissions in this tab</td></tr>
              ) : (
                submissions.map(sub => {
                  const overCapacity = sub.trackedMins > sub.capacityMins
                  const isReviewing = reviewingId === sub.id
                  return (
                    <tr key={sub.id} style={{ borderBottom: "1px solid #161616" }}>
                      <td style={{ padding: "10px 0", verticalAlign: "middle" }}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpenDetail(sub)}
                          onKeyDown={e => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              onOpenDetail(sub)
                            }
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                        >
                          <Avatar initials={sub.initials} />
                          <div>
                            <div style={{ color: "#e8e8e8", fontWeight: 600, fontSize: 14 }}>{sub.name}</div>
                            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{sub.dateRange}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...thCell, color: "#e8e8e8", fontWeight: 600 }}>{sub.tracked}</td>
                      <td style={{ ...thCell, color: "#888" }}>{sub.capacity}</td>
                      <td style={{ ...thCell, color: "#888" }}>{sub.billable}</td>
                      <td style={{ ...thCell, color: overCapacity ? "#f5c842" : "#888" }}>{overCapacity ? fmtHmPill(sub.trackedMins - sub.capacityMins) : "—"}</td>
                      <td style={{ ...thCell, paddingRight: 0 }}>
                        {showReviewActions ? (
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button type="button" title="Request changes" disabled={isReviewing} onClick={() => onReview(sub.id, "reject", sub.name)} style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid #5a4a20", background: "#3d2f00", color: "#f5c842", cursor: isReviewing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: isReviewing ? 0.5 : 1 }}><Ico.Reply /></button>
                            <button type="button" title="Approve" disabled={isReviewing} onClick={() => onReview(sub.id, "approve")} style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid #7a6800", background: "#2a2608", color: "var(--brand)", cursor: isReviewing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: isReviewing ? 0.5 : 1 }}><Ico.Check /></button>
                          </div>
                        ) : (
                          <StatusBadge status={sub.status} />
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}

        {!loading && !error && submissionsMetadata.totalPages > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0",
              marginTop: 8,
              borderTop: "1px solid #0a0a0d",
            }}
          >
            <span style={{ fontSize: 12, color: "#666" }}>
              Page {submissionsMetadata.currentPage} of {submissionsMetadata.totalPages}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => onSubmissionsPageChange(p => Math.max(1, p - 1))}
                disabled={submissionsMetadata.currentPage <= 1 || loading}
                style={{
                  ...listNavBtn,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  opacity: submissionsMetadata.currentPage <= 1 || loading ? 0.4 : 1,
                  cursor: submissionsMetadata.currentPage <= 1 || loading ? "not-allowed" : "pointer",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Previous
              </button>
              <button
                type="button"
                onClick={() => onSubmissionsPageChange(p => Math.min(submissionsMetadata.totalPages, p + 1))}
                disabled={submissionsMetadata.currentPage >= submissionsMetadata.totalPages || loading}
                style={{
                  ...listNavBtn,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  opacity: submissionsMetadata.currentPage >= submissionsMetadata.totalPages || loading ? 0.4 : 1,
                  cursor: submissionsMetadata.currentPage >= submissionsMetadata.totalPages || loading ? "not-allowed" : "pointer",
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
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function TimesheetApprovals() {
  const searchParams = useSearchParams()
  const currentWorkspace = useTaskroomWorkspacetore(s => s.currentWorkspace)
  const workspaceId = (searchParams.get("shareTask") ? searchParams.get("workspaceId") : currentWorkspace?._id) || ""

  const [activeTab, setActiveTab] = useState<ApprovalTab>("to_review")
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedSubmission, setSelectedSubmission] = useState<ApprovalSubmission | null>(null)
  const [submissions, setSubmissions] = useState<ApprovalSubmission[]>([])
  const [tabCounts, setTabCounts] = useState<Record<ApprovalTab, number>>({
    to_review: 0,
    changes_requested: 0,
    approved: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [submissionsPage, setSubmissionsPage] = useState(1)
  const [submissionsMetadata, setSubmissionsMetadata] = useState({
    totalPages: 1,
    currentPage: 1,
    nextPage: null as number | null,
    count: 0,
  })
  const pendingSubmissionsPageResetRef = useRef(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [rejectCommentTarget, setRejectCommentTarget] = useState<{ submissionId: string; memberName: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [manageDialogOpen, setManageDialogOpen] = useState(false)
  const [submitterRows, setSubmitterRows] = useState<SubmitterRow[]>([])
  const [peopleById, setPeopleById] = useState<Record<string, OrgPerson>>({})
  const [dueDay, setDueDay] = useState("Friday")
  const [dueTime, setDueTime] = useState("5:00 pm")
  const [remindBefore, setRemindBefore] = useState("24h before")
  const [remindAfter, setRemindAfter] = useState("8h after")

  const weekRange = useMemo(() => getWeekRange(weekOffset), [weekOffset])
  const { dates, weekStartMs, weekEndMs } = weekRange

  const loadApprovalManagers = useCallback(async () => {
    if (!workspaceId) return
    try {
      const { rows, lookup } = await apiGetTimesheetManagers(workspaceId)
      setSubmitterRows(rows)
      setPeopleById(prev => ({ ...prev, ...lookup }))
    } catch {
      setSubmitterRows([])
    }
  }, [workspaceId])

  const handleManagersSave = useCallback((rows: SubmitterRow[], lookup: Record<string, OrgPerson>) => {
    setSubmitterRows(rows)
    setPeopleById(prev => ({ ...prev, ...lookup }))
  }, [])

  const handleManageDialogClose = useCallback(() => {
    setManageDialogOpen(false)
    void loadApprovalManagers()
  }, [loadApprovalManagers])

  function handleOpenSettings() {
    setSettingsOpen(true)
    void loadApprovalManagers()
  }

  function handleOpenManageDialog() {
    setManageDialogOpen(true)
  }

  useEffect(() => {
    pendingSubmissionsPageResetRef.current = true
    setSubmissionsPage(1)
  }, [weekOffset, workspaceId, refreshKey])

  useEffect(() => {
    let cancelled = false
    const pageToLoad = pendingSubmissionsPageResetRef.current ? 1 : submissionsPage
    pendingSubmissionsPageResetRef.current = false

    if (!workspaceId?.trim()) {
      setError("Missing workspace.")
      setSubmissions([])
      setLoading(false)
      return
    }

    const submissionStatus = tabToSubmissionStatus(activeTab)

    setLoading(true)
    setError(null)

    fetchWorkspaceSubmissions({
      workspaceId: workspaceId.trim(),
      weekStartMs,
      weekEndMs,
      submissionStatus,
      page: pageToLoad,
      size: SUBMISSION_PAGE_SIZE,
    })
      .then(({ submissions: loaded, metadata }) => {
        if (cancelled) return
        setSubmissions(loaded)
        setSubmissionsMetadata(metadata)
        setSubmissionsPage(prev => (metadata.currentPage !== prev ? metadata.currentPage : prev))
        setTabCounts(prev => ({ ...prev, [activeTab]: metadata.count }))
        setError(null)
      })
      .catch(err => {
        if (cancelled) return
        let msg = "Failed to load submissions"
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
        setSubmissions([])
        toast.error(msg.slice(0, 200))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId, weekStartMs, weekEndMs, activeTab, refreshKey, submissionsPage])

  const showReviewActions = activeTab === "to_review"

  const handleReview = useCallback(
    async (submissionId: string, action: ReviewAction, comment?: string) => {
      if (reviewingId) return
      if (action === "reject" && !comment?.trim()) {
        toast.error("Please provide a reason for requesting changes")
        return
      }
      setReviewingId(submissionId)
      try {
        await apiReviewSubmission(submissionId, action, comment)
        toast.success(action === "approve" ? "Timesheet approved" : "Changes requested")
        setRefreshKey(k => k + 1)
        setSelectedSubmission(prev => (prev?.id === submissionId ? null : prev))
        setRejectCommentTarget(prev => (prev?.submissionId === submissionId ? null : prev))
      } catch (err) {
        let msg = "Failed to update submission"
        if (axios.isAxiosError(err)) {
          const serverData = err.response?.data
          const serverMsg =
            typeof serverData === "string"
              ? serverData
              : (serverData as { message?: string })?.message
          msg = serverMsg || err.message || msg
        } else if (err instanceof Error) {
          msg = err.message
        }
        toast.error(msg.slice(0, 200))
      } finally {
        setReviewingId(null)
      }
    },
    [reviewingId]
  )

  const handleReviewAction = useCallback(
    (submissionId: string, action: ReviewAction, memberName?: string) => {
      if (action === "reject") {
        setRejectCommentTarget({ submissionId, memberName: memberName ?? "" })
        return
      }
      void handleReview(submissionId, "approve")
    },
    [handleReview]
  )

  function handleTabChange(tab: ApprovalTab) {
    setActiveTab(tab)
    setSubmissionsPage(1)
  }

  function openSubmissionDetail(sub: ApprovalSubmission) {
    setSelectedSubmission(sub)
  }

  if (selectedSubmission) {
    const approvalContext: MemberTimesheetApprovalContext = {
      submissionId: selectedSubmission.id,
      status: selectedSubmission.status,
      submittedAt: selectedSubmission.submittedAt,
      billableMins: selectedSubmission.billableMins,
      showReviewActions,
      reviewing: reviewingId === selectedSubmission.id,
      onReview: action => {
        if (action === "reject") {
          setRejectCommentTarget({ submissionId: selectedSubmission.id, memberName: selectedSubmission.name })
          return
        }
        void handleReview(selectedSubmission.id, "approve")
      },
    }

    return (
      <>
        <MemberTimesheetDetail
          member={submissionToMember(selectedSubmission)}
          workspaceId={workspaceId}
          initialWeekOffset={weekOffset}
          onBack={() => setSelectedSubmission(null)}
          approvalContext={approvalContext}
        />
        {rejectCommentTarget?.submissionId === selectedSubmission.id && (
          <ReviewCommentDialog
            memberName={rejectCommentTarget.memberName}
            submitting={reviewingId === selectedSubmission.id}
            onCancel={() => setRejectCommentTarget(null)}
            onSubmit={text => void handleReview(selectedSubmission.id, "reject", text)}
          />
        )}
      </>
    )
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <ApprovalsListView
          activeTab={activeTab}
          onTabChange={handleTabChange}
          submissions={submissions}
          tabCounts={tabCounts}
          onOpenDetail={openSubmissionDetail}
          showReviewActions={showReviewActions}
          onOpenSettings={handleOpenSettings}
          weekOffset={weekOffset}
          onWeekOffsetChange={setWeekOffset}
          dates={dates}
          loading={loading}
          error={error}
          onRetry={() => setRefreshKey(k => k + 1)}
          submissionsPage={submissionsPage}
          onSubmissionsPageChange={setSubmissionsPage}
          submissionsMetadata={submissionsMetadata}
          onReview={handleReviewAction}
          reviewingId={reviewingId}
        />
      </div>

      {settingsOpen && (
        <ApprovalSettingsDrawer
          onClose={() => setSettingsOpen(false)}
          submitterRows={submitterRows}
          peopleById={peopleById}
          dueDay={dueDay}
          dueTime={dueTime}
          remindBefore={remindBefore}
          remindAfter={remindAfter}
          onDueDayChange={setDueDay}
          onDueTimeChange={setDueTime}
          onRemindBeforeChange={setRemindBefore}
          onRemindAfterChange={setRemindAfter}
          onEditList={handleOpenManageDialog}
        />
      )}

      <ManageApproversDialog
        open={manageDialogOpen}
        workspaceId={workspaceId}
        initialRows={submitterRows}
        initialPeopleById={peopleById}
        onClose={handleManageDialogClose}
        onSave={handleManagersSave}
      />

      {rejectCommentTarget && (
        <ReviewCommentDialog
          memberName={rejectCommentTarget.memberName}
          submitting={reviewingId === rejectCommentTarget.submissionId}
          onCancel={() => setRejectCommentTarget(null)}
          onSubmit={text => void handleReview(rejectCommentTarget.submissionId, "reject", text)}
        />
      )}
    </div>
  )
}