"use client"

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { createPortal } from "react-dom"
import { TS_ACCENT, TS_ACCENT_SOFT_BG_HOVER, TS_ON_ACCENT } from "./timesheetTheme"

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function localDayMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function startOfSunday(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

export function weekOffsetForSunday(sunday: Date) {
  const todaySun = startOfSunday(new Date())
  const diff = localDayMs(sunday) - localDayMs(todaySun)
  return Math.round(diff / (7 * 24 * 60 * 60 * 1000))
}

function isSameDay(a: Date, b: Date) {
  return localDayMs(a) === localDayMs(b)
}

function isSameWeek(weekDates: Date[], sunday: Date) {
  if (!weekDates.length) return false
  return isSameDay(weekDates[0], sunday)
}

function buildMonthWeeks(year: number, month: number) {
  const first = new Date(year, month, 1)
  const gridStart = startOfSunday(first)
  const weeks: Date[][] = []
  const cursor = new Date(gridStart)

  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  return weeks
}

function fmtWeekLabel(dates: Date[]) {
  if (!dates.length) return "Select week"
  return `${MONTH_SHORT[dates[0].getMonth()]} ${dates[0].getDate()} – ${MONTH_SHORT[dates[6].getMonth()]} ${dates[6].getDate()}`
}

type TimesheetWeekPickerProps = {
  dates: Date[]
  onWeekOffsetChange: Dispatch<SetStateAction<number>>
  fontSize?: number
  fontWeight?: number
}

export function TimesheetWeekPicker({
  dates,
  onWeekOffsetChange,
  fontSize = 20,
  fontWeight = 700,
}: TimesheetWeekPickerProps) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => new Date(dates[0]))
  const [hoverSundayMs, setHoverSundayMs] = useState<number | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setViewDate(new Date(dates[0]))
      setHoverSundayMs(null)
    }
  }, [open, dates])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setPos({ top: r.bottom + 8, left: r.left })
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
      document.removeEventListener("mousedown", onPointerDown, true)
    }
  }, [open])

  const weeks = useMemo(
    () => buildMonthWeeks(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  )

  const viewMonth = viewDate.getMonth()
  const viewYear = viewDate.getFullYear()

  function shiftMonth(delta: number) {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  function selectWeek(week: Date[]) {
    onWeekOffsetChange(weekOffsetForSunday(week[0]))
    setOpen(false)
  }

  function goToToday() {
    onWeekOffsetChange(0)
    setOpen(false)
  }

  const calendarPanel = open && typeof document !== "undefined" ? (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Select week"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 100000,
        width: 280,
        background: "#161616",
        border: "1px solid #2a2b2c",
        borderRadius: 10,
        boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
        color: "#e8e8e8",
      }}
    >
      <div style={{ padding: "12px 14px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0" }}>
            {MONTH_LONG[viewMonth]} {viewYear}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              onClick={goToToday}
              style={{
                background: "none",
                border: "none",
                color: "#9ca3af",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: 4,
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              style={monthNavBtn}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 8L6 5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              style={monthNavBtn}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 0,
            marginBottom: 4,
          }}
        >
          {DAY_HEADERS.map(h => (
            <div
              key={h}
              style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 500,
                color: "#6b7280",
                padding: "2px 0 6px",
              }}
            >
              {h}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {weeks.map((week, wi) => {
            const sundayMs = localDayMs(week[0])
            const selected = isSameWeek(dates, week[0])
            const hovered = hoverSundayMs === sundayMs
            const highlighted = selected || hovered

            return (
              <button
                key={wi}
                type="button"
                onClick={() => selectWeek(week)}
                onMouseEnter={() => setHoverSundayMs(sundayMs)}
                onMouseLeave={() => setHoverSundayMs(null)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  width: "100%",
                  border: "none",
                  borderRadius: 8,
                  padding: "3px 2px",
                  cursor: "pointer",
                  background: highlighted ? (selected ? TS_ACCENT : TS_ACCENT_SOFT_BG_HOVER) : "transparent",
                  transition: "background 0.12s ease",
                }}
              >
                {week.map((day, di) => {
                  const inMonth = day.getMonth() === viewMonth
                  return (
                    <span
                      key={di}
                      style={{
                        textAlign: "center",
                        fontSize: 13,
                        fontWeight: selected ? 600 : 400,
                        color: highlighted ? TS_ON_ACCENT : inMonth ? "#d1d5db" : "#4b5563",
                        lineHeight: "28px",
                      }}
                    >
                      {day.getDate()}
                    </span>
                  )
                })}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(prev => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "#e0e0e0",
          fontSize,
          fontWeight,
          cursor: "pointer",
          padding: 0,
        }}
        aria-label="Select week"
        aria-expanded={open}
      >
        {fmtWeekLabel(dates)}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "#888", marginTop: 2 }}>
          <path
            d="M3 5.5L8 10.5l5-5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {calendarPanel ? createPortal(calendarPanel, document.body) : null}
    </>
  )
}

const monthNavBtn = {
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  color: "#9ca3af",
  cursor: "pointer",
  borderRadius: 4,
  padding: 0,
} as const
