"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import axios from "axios"
import { toast } from "sonner"
import {
  fetchTimesheetSubmissions,
  revokeTimesheetSubmission,
  sheetStatusLabel,
  TIMESHEET_SUBMISSION_PAGE_SIZE,
  type TimesheetSubmissionRecord,
} from "./timesheet"

function fmtEpochDate(ms: number) {
  if (!ms) return "—"
  return new Date(ms).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
}

function isRevocableStatus(status: string) {
  const s = String(status).trim().toLowerCase()
  return s === "pending" || s === "submitted"
}

function submissionStatusColors(status: string) {
  const s = String(status).trim().toLowerCase()
  if (s === "rejected") return { bg: "#3d2f00", border: "#7a5a00", color: "#f5c842" }
  if (s === "approved") return { bg: "#2a2608", border: "#7a6800", color: "var(--brand)" }
  if (s === "revoked" || s === "cancelled" || s === "canceled") {
    return { bg: "#0a0a0d", border: "#444", color: "#888" }
  }
  return { bg: "#2a2608", border: "#7a6800", color: "var(--brand)" }
}

function snapshotTaskCount(entries: unknown) {
  if (Array.isArray(entries)) return entries.length
  if (entries && typeof entries === "object") {
    const obj = entries as Record<string, unknown>
    if (Array.isArray(obj.tasks)) return obj.tasks.length
    if (Array.isArray(obj.data)) return obj.data.length
  }
  return 0
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: "#c9cdd4", wordBreak: "break-all" }}>{value}</span>
    </div>
  )
}

function SubmissionCard({
  record,
  timesheetId,
  revoking,
  onRevoke,
}: {
  record: TimesheetSubmissionRecord
  timesheetId: string
  revoking: boolean
  onRevoke: (timesheetId: string) => void
}) {
  const statusLabel = (sheetStatusLabel(record.submissionStatus) ?? record.submissionStatus) || "—"
  const colors = submissionStatusColors(record.submissionStatus)
  const taskCount = snapshotTaskCount(record.snapshotTaskEntries)
  const canRevoke = isRevocableStatus(record.submissionStatus)

  return (
    <div
      style={{
        background: "#141516",
        border: "1px solid #2a2b2c",
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e8e8", marginBottom: 4 }}>
            {fmtEpochDate(record.weekStart)} – {fmtEpochDate(record.weekEnd)}
          </div>
          <div style={{ fontSize: 11, color: "#666" }}>Submission {record.id.slice(-8)}</div>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 999,
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            color: colors.color,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {record.rejectionReason && (
        <div
          style={{
            background: "#3d2f00",
            border: "1px solid #7a5a00",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            color: "#f5c842",
            lineHeight: 1.45,
          }}
        >
          <strong style={{ display: "block", marginBottom: 4, fontSize: 11 }}>Rejection reason</strong>
          {record.rejectionReason}
        </div>
      )}

      <FieldRow label="Timesheet log ID" value={record.timesheetLogId || "—"} />

      <FieldRow
        label="Snapshot tasks"
        value={taskCount > 0 ? `${taskCount} task${taskCount === 1 ? "" : "s"} captured` : "—"}
      />

      {canRevoke && (
        <button
          type="button"
          onClick={() => onRevoke(timesheetId)}
          disabled={revoking}
          style={{
            alignSelf: "flex-start",
            marginTop: 4,
            background: "transparent",
            border: "1px solid #7a3a3a",
            color: revoking ? "#666" : "#f87171",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            cursor: revoking ? "not-allowed" : "pointer",
            opacity: revoking ? 0.6 : 1,
          }}
        >
          {revoking ? "Revoking…" : "Revoke submission"}
        </button>
      )}
    </div>
  )
}

export default function TimesheetSubmissionDrawer({
  open,
  onClose,
  timesheetId,
  onSubmissionsLoaded,
  onRevoked,
}: {
  open: boolean
  onClose: () => void
  timesheetId: string | null
  onSubmissionsLoaded?: (latest: TimesheetSubmissionRecord | null) => void
  onRevoked?: () => void
}) {
  const [submissions, setSubmissions] = useState<TimesheetSubmissionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [metadata, setMetadata] = useState({ totalPages: 1, currentPage: 1, nextPage: null as number | null })
  const [revoking, setRevoking] = useState(false)

  const loadSubmissions = useCallback(
    async (pageToLoad: number) => {
      if (!timesheetId) return
      setLoading(true)
      setError(null)
      try {
        const result = await fetchTimesheetSubmissions(timesheetId, pageToLoad, TIMESHEET_SUBMISSION_PAGE_SIZE)
        setSubmissions(result.submissions)
        setMetadata(result.metadata)
        setPage(result.metadata.currentPage)
        onSubmissionsLoaded?.(result.submissions[0] ?? null)
      } catch (e) {
        let msg = "Failed to load submission history"
        if (axios.isAxiosError(e)) {
          const serverData = e.response?.data
          const serverMsg =
            typeof serverData === "string" ? serverData : serverData?.message ?? serverData?.error
          msg = serverMsg || e.message || msg
        } else if (e instanceof Error) {
          msg = e.message
        }
        setError(msg)
        setSubmissions([])
      } finally {
        setLoading(false)
      }
    },
    [timesheetId, onSubmissionsLoaded]
  )

  useEffect(() => {
    if (!open || !timesheetId) return
    setPage(1)
    void loadSubmissions(1)
  }, [open, timesheetId, loadSubmissions])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const handleRevoke = useCallback(
    async (sheetId: string) => {
      if (revoking || !sheetId) return
      setRevoking(true)
      try {
        await revokeTimesheetSubmission(sheetId)
        toast.success("Submission revoked")
        onRevoked?.()
        await loadSubmissions(page)
      } catch (e) {
        let msg = "Failed to revoke submission"
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
        setRevoking(false)
      }
    },
    [revoking, page, loadSubmissions, onRevoked]
  )

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 9998,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          maxWidth: "100vw",
          zIndex: 9999,
          background: "#0a0a0d",
          borderLeft: "1px solid #0a0a0d",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.45)",
        }}
        onWheel={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid #0a0a0d",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#e8e8e8" }}>Submission status</div>
            {timesheetId && (
              <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>Timesheet {timesheetId.slice(-8)}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid #2a2b2c",
              background: "#0a0a0d",
              color: "#888",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && (
            <div style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 13 }}>Loading submissions…</div>
          )}
          {!loading && error && (
            <div style={{ padding: 16, textAlign: "center", color: "#e57373", fontSize: 13 }}>{error}</div>
          )}
          {!loading && !error && submissions.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 13 }}>
              No submissions yet for this timesheet.
            </div>
          )}
          {!loading &&
            !error &&
            submissions.map((record) => (
              <SubmissionCard
                key={record.id}
                record={record}
                timesheetId={timesheetId!}
                revoking={revoking}
                onRevoke={handleRevoke}
              />
            ))}
        </div>

        {!loading && !error && metadata.totalPages > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderTop: "1px solid #0a0a0d",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12, color: "#666" }}>
              Page {metadata.currentPage} of {metadata.totalPages}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={metadata.currentPage <= 1 || loading}
                onClick={() => void loadSubmissions(Math.max(1, page - 1))}
                style={{
                  background: "#0a0a0d",
                  border: "1px solid #2a2b2c",
                  color: metadata.currentPage <= 1 ? "#444" : "#aaa",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 11,
                  cursor: metadata.currentPage <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={metadata.currentPage >= metadata.totalPages || loading}
                onClick={() => void loadSubmissions(page + 1)}
                style={{
                  background: "#0a0a0d",
                  border: "1px solid #2a2b2c",
                  color: metadata.currentPage >= metadata.totalPages ? "#444" : "#aaa",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 11,
                  cursor: metadata.currentPage >= metadata.totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
