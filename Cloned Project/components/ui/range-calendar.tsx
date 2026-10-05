"use client";

/**
 * Two-month range calendar on plain "YYYY-MM-DD" strings.
 *
 * Lifted out of components/analytics/ControlBar.tsx so other admin surfaces
 * (Daily Reports) get the same picker instead of a native <input type="date">.
 * Values stay strings on purpose: they survive drawer draft state and compare
 * with `<`/`>` without any timezone drift; the caller decides what "today"
 * means via `maxIso`.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ── Custom range calendar ──────────────────────────────────────────────────
// Two months side by side with a highlighted range, the shape people expect
// from a date-range picker (Stripe/GA style). Values are plain "YYYY-MM-DD"
// strings so they survive the drawer's draft state and compare with `<`/`>`
// without timezone drift — the analytics clock is UTC-based, and building
// Date objects here would reintroduce local-offset bugs.

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/** "YYYY-MM-DD" for a y/m/d triple, zero-padded. */
export function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Today as YYYY-MM-DD, UTC — the analytics clock is UTC, so "today" must be too. */
export function todayIso(): string {
  const n = new Date();
  return ymd(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
}

function MonthGrid({
  year,
  month,
  start,
  end,
  hover,
  maxIso,
  onPick,
  onHover,
}: {
  year: number;
  month: number;
  start: string;
  end: string;
  hover: string;
  maxIso: string;
  onPick: (iso: string) => void;
  onHover: (iso: string) => void;
}) {
  const lead = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  const today = todayIso();

  // While picking the end date, preview the range under the cursor so the
  // selection is visible before it is committed.
  const previewEnd = !end && start && hover > start ? hover : end;

  return (
    <div className="flex-1">
      <div className="mb-2 text-center text-[12px] font-semibold text-white">
        {MONTHS[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {DOW.map((d) => (
          <div key={d} className="pb-1 text-center text-[10px] font-medium text-zinc-500">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const iso = ymd(year, month, d);
          const disabled = iso > maxIso;
          const isStart = !!start && iso === start;
          const isEnd = !!previewEnd && iso === previewEnd;
          const inRange = !!start && !!previewEnd && iso > start && iso < previewEnd;
          const isToday = iso === today;

          // The band is drawn on a wrapper so it runs edge-to-edge between
          // cells; the endpoints round only on their outer side, which is what
          // makes a selection read as one continuous range.
          return (
            <div
              key={iso}
              className={
                inRange
                  ? "bg-brand/15"
                  : isStart && previewEnd && !isEnd
                    ? "rounded-l-full bg-brand/15"
                    : isEnd && start && !isStart
                      ? "rounded-r-full bg-brand/15"
                      : ""
              }
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(iso)}
                onMouseEnter={() => onHover(iso)}
                aria-label={iso}
                aria-current={isToday ? "date" : undefined}
                className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12px] transition-colors ${
                  isStart || isEnd
                    ? "bg-brand font-semibold text-brand-foreground"
                    : disabled
                      ? "cursor-not-allowed text-zinc-700"
                      : inRange
                        ? "text-brand hover:bg-brand/25"
                        : isToday
                          ? "text-white ring-1 ring-inset ring-white/30 hover:bg-white/[0.08]"
                          : "text-zinc-300 hover:bg-white/[0.08]"
                }`}
              >
                {d}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Accepts a typed date only once it is a real calendar date, so half-typed
 *  input never wipes the selection mid-keystroke. */
export function isValidIso(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function RangeCalendar({
  start,
  end,
  onChange,
  maxIso: maxIsoProp,
}: {
  start: string;
  end: string;
  onChange: (next: { start: string; end: string }) => void;
  /**
   * Latest selectable day, "YYYY-MM-DD". Defaults to today in UTC (the
   * analytics clock). Pass an IST "today" for surfaces that report in IST.
   */
  maxIso?: string;
}) {
  const [view, setView] = useState(() => {
    const base = start ? new Date(start + "T00:00:00Z") : new Date();
    return { y: base.getUTCFullYear(), m: base.getUTCMonth() };
  });
  const [hover, setHover] = useState("");
  // Mirrors of the committed values so a partially-typed date is not rejected
  // on every keystroke.
  const [startText, setStartText] = useState(start);
  const [endText, setEndText] = useState(end);
  useEffect(() => setStartText(start), [start]);
  useEffect(() => setEndText(end), [end]);

  const maxIso = maxIsoProp ?? todayIso(); // can't report the future

  const shift = (delta: number) =>
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  const pick = (iso: string) => {
    if (!start || (start && end)) return onChange({ start: iso, end: "" });
    if (iso < start) return onChange({ start: iso, end: start });
    onChange({ start, end: iso });
  };

  const right = new Date(Date.UTC(view.y, view.m + 1, 1));
  const nextDisabled =
    ymd(right.getUTCFullYear(), right.getUTCMonth(), 1) >= maxIso.slice(0, 8) + "01";

  const field =
    "w-full rounded-lg border bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-brand/60";

  return (
    <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Start</span>
          <input
            value={startText}
            placeholder="YYYY-MM-DD"
            onChange={(e) => {
              setStartText(e.target.value);
              if (isValidIso(e.target.value) && e.target.value <= maxIso) {
                onChange({ start: e.target.value, end: end && e.target.value > end ? "" : end });
              }
            }}
            className={`${field} ${start ? "border-brand/50" : "border-white/[0.08]"}`}
          />
        </label>
        <span className="pb-2 text-zinc-600">→</span>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">End</span>
          <input
            value={endText}
            placeholder="YYYY-MM-DD"
            onChange={(e) => {
              setEndText(e.target.value);
              if (isValidIso(e.target.value) && e.target.value <= maxIso && (!start || e.target.value >= start)) {
                onChange({ start, end: e.target.value });
              }
            }}
            className={`${field} ${end ? "border-brand/50" : "border-white/[0.08]"}`}
          />
        </label>
      </div>

      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => onChange({ start: "", end: "" })}
          className="text-[11px] text-zinc-500 transition-colors hover:text-white"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={nextDisabled}
          aria-label="Next month"
          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex gap-4" onMouseLeave={() => setHover("")}>
        <MonthGrid
          year={view.y} month={view.m}
          start={start} end={end} hover={hover} maxIso={maxIso}
          onPick={pick} onHover={setHover}
        />
        <MonthGrid
          year={right.getUTCFullYear()} month={right.getUTCMonth()}
          start={start} end={end} hover={hover} maxIso={maxIso}
          onPick={pick} onHover={setHover}
        />
      </div>
    </div>
  );
}

