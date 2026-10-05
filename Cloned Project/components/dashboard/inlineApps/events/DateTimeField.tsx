"use client";

// A themed replacement for `<input type="datetime-local">`.
//
// The native control paints an OS popup — white, blue-accented, and completely
// outside our styling reach — which looked like a bug sitting inside the dark
// event forms. This is the same value contract (a local `YYYY-MM-DDTHH:mm`
// string, so `toLocalInput` / `fromLocalInput` are unchanged) with a surface
// that matches the rest of the module, plus the things the native picker
// never gave us: presets, a readable summary, a `min` bound that actually
// greys out impossible dates, and one-tap common times.
//
// The panel renders through a portal because every caller lives inside a
// modal with `overflow-hidden` / `overflow-y-auto`, which would clip or scroll
// an inline popover away.

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
} from "lucide-react";
import { GOLD, Label } from "./ui";

// ── Local-time string helpers ────────────────────────────────────────────
// Everything here works on the literal `YYYY-MM-DDTHH:mm` shape rather than
// round-tripping through `Date`, so a value can never drift by a timezone
// offset on the way in and back out.

const pad = (n: number) => String(n).padStart(2, "0");

type Parts = { y: number; m: number; d: number; hh: number; mm: number };

function parseValue(value: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || "");
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const parts = {
    y: Number(y),
    m: Number(m),
    d: Number(d),
    hh: Number(hh),
    mm: Number(mm),
  };
  const probe = new Date(parts.y, parts.m - 1, parts.d);
  if (probe.getMonth() !== parts.m - 1 || probe.getDate() !== parts.d) return null;
  return parts;
}

function formatValue(p: Parts): string {
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}`;
}

/** Sortable day key, used for `min` comparisons and same-day checks. */
function dayKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function partsFromDate(date: Date, hh: number, mm: number): Parts {
  return {
    y: date.getFullYear(),
    m: date.getMonth() + 1,
    d: date.getDate(),
    hh,
    mm,
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
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
];

/**
 * Compact enough to sit in a three-column row without wrapping. The weekday is
 * dropped from the visible label and kept in the tooltip — "Wed, 16 Sep 2026 ·
 * 9:00 AM" wrapped to two lines and collided with the clear button.
 */
function summarise(p: Parts): string {
  const h12 = p.hh % 12 === 0 ? 12 : p.hh % 12;
  const suffix = p.hh < 12 ? "AM" : "PM";
  return `${p.d} ${MONTHS[p.m - 1].slice(0, 3)} ${p.y}, ${h12}:${pad(
    p.mm
  )} ${suffix}`;
}

/** The long form, for the trigger's title attribute. */
function summariseLong(p: Parts): string {
  const date = new Date(p.y, p.m - 1, p.d, p.hh, p.mm);
  return `${WEEKDAYS[date.getDay()]}, ${summarise(p)}`;
}

/** Leading blanks + day numbers for a month grid that starts on Sunday. */
function monthGrid(year: number, month: number): Array<number | null> {
  const first = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells: Array<number | null> = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const QUICK_TIMES: Array<{ label: string; hh: number; mm: number }> = [
  { label: "9:00 AM", hh: 9, mm: 0 },
  { label: "10:00 AM", hh: 10, mm: 0 },
  { label: "12:00 PM", hh: 12, mm: 0 },
  { label: "2:00 PM", hh: 14, mm: 0 },
  { label: "6:00 PM", hh: 18, mm: 0 },
  { label: "7:30 PM", hh: 19, mm: 30 },
];

export default function DateTimeField({
  label,
  required,
  hint,
  value,
  onChange,
  min,
  placeholder = "Pick a date and time",
  disabled,
  className = "",
  clearable = true,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  /** Local `YYYY-MM-DDTHH:mm`, or "" for empty. */
  value: string;
  onChange: (value: string) => void;
  /** Local `YYYY-MM-DDTHH:mm`. Earlier days are greyed out and unclickable. */
  min?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const selected = useMemo(() => parseValue(value), [value]);
  const minParts = useMemo(() => (min ? parseValue(min) : null), [min]);
  const minKey = minParts ? dayKey(minParts.y, minParts.m, minParts.d) : null;

  // The month on screen. Follows the selection while closed so reopening a
  // filled field always lands on the right page.
  const [view, setView] = useState(() => ({
    y: selected?.y ?? new Date().getFullYear(),
    m: selected?.m ?? new Date().getMonth() + 1,
  }));
  useEffect(() => {
    if (open) return;
    setView({
      y: selected?.y ?? new Date().getFullYear(),
      m: selected?.m ?? new Date().getMonth() + 1,
    });
  }, [open, selected?.y, selected?.m]);

  // ── Positioning ────────────────────────────────────────────────────────
  // Measured from the panel itself rather than a guessed constant: the height
  // changes with the month (5 vs 6 week rows), and a stale estimate is what
  // pushed the Done row off the bottom of the screen.
  const GAP = 8;
  const MARGIN = 8;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panel = panelRef.current;
    const h = panel?.offsetHeight || 430;
    const w = panel?.offsetWidth || 340;

    const spaceBelow = window.innerHeight - r.bottom - GAP;
    const spaceAbove = r.top - GAP;
    // Flip above only when that genuinely has more room; otherwise stay below
    // and let the clamp below pull it back on screen.
    const openUp = h > spaceBelow && spaceAbove > spaceBelow;

    let top = openUp ? r.top - h - GAP : r.bottom + GAP;
    top = Math.min(top, window.innerHeight - h - MARGIN);
    top = Math.max(MARGIN, top);

    const left = Math.min(
      Math.max(MARGIN, r.left),
      Math.max(MARGIN, window.innerWidth - w - MARGIN)
    );

    setRect((prev) =>
      prev && prev.top === top && prev.left === left && prev.width === r.width
        ? prev
        : { top, left, width: r.width }
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  // Re-place once the panel actually exists, and again whenever its height
  // changes — switching to a 6-row month is the common case.
  const mounted = rect !== null;
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    place();
    const observer = new ResizeObserver(() => place());
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [open, mounted, place]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  // ── Mutations ──────────────────────────────────────────────────────────
  // A date click keeps whatever time is already set; the first pick on an
  // empty field defaults to 9:00 AM rather than midnight, which is almost
  // never what an event organiser means.
  const commit = useCallback(
    (next: Parts) => onChange(formatValue(next)),
    [onChange]
  );

  const pickDay = useCallback(
    (d: number) => {
      const base = selected ?? { hh: 9, mm: 0 };
      commit({ y: view.y, m: view.m, d, hh: base.hh, mm: base.mm });
    },
    [commit, selected, view.m, view.y]
  );

  const pickTime = useCallback(
    (hh: number, mm: number) => {
      const now = new Date();
      const base = selected ?? partsFromDate(now, hh, mm);
      commit({ ...base, hh, mm });
    },
    [commit, selected]
  );

  const jumpTo = useCallback(
    (offsetDays: number) => {
      const target = new Date();
      target.setDate(target.getDate() + offsetDays);
      const hh = selected?.hh ?? 9;
      const mm = selected?.mm ?? 0;
      commit(partsFromDate(target, hh, mm));
      setView({ y: target.getFullYear(), m: target.getMonth() + 1 });
    },
    [commit, selected]
  );

  const shiftMonth = useCallback((delta: number) => {
    setView((v) => {
      const d = new Date(v.y, v.m - 1 + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() + 1 };
    });
  }, []);

  const cells = useMemo(() => monthGrid(view.y, view.m), [view.y, view.m]);
  const today = new Date();
  const todayKey = dayKey(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const hh12 = selected ? (selected.hh % 12 === 0 ? 12 : selected.hh % 12) : 9;
  const isPm = selected ? selected.hh >= 12 : false;

  function setHour12(h: number) {
    const clamped = Math.min(12, Math.max(1, h));
    const hh = (clamped % 12) + (isPm ? 12 : 0);
    pickTime(hh, selected?.mm ?? 0);
  }
  function setMinute(m: number) {
    const clamped = Math.min(59, Math.max(0, m));
    pickTime(selected?.hh ?? 9, clamped);
  }
  function setMeridiem(pm: boolean) {
    const base = selected?.hh ?? 9;
    const h12 = base % 12;
    pickTime(h12 + (pm ? 12 : 0), selected?.mm ?? 0);
  }

  const panel =
    open && rect
      ? createPortal(
          <div
            ref={panelRef}
            // Above the create modal (z-100) and the console modals (z-120).
            className="fixed z-[900] flex w-[340px] flex-col overflow-y-auto overscroll-contain rounded-2xl border border-[#262626] bg-[#141414] shadow-2xl shadow-black/60"
            // A short viewport scrolls the panel instead of clipping it, so
            // Clear/Done are always reachable.
            style={{
              top: rect.top,
              left: rect.left,
              maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
            }}
          >
            {/* Presets — the three dates people actually pick, without
                navigating the grid at all. */}
            <div className="flex items-center gap-1.5 border-b border-[#262626] px-3 py-2.5">
              {[
                { label: "Today", offset: 0 },
                { label: "Tomorrow", offset: 1 },
                { label: "Next week", offset: 7 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => jumpTo(p.offset)}
                  className="rounded-md border border-[#262626] px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-brand/40 hover:text-white"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Month header */}
            <div className="flex items-center justify-between px-3 pt-3">
              <div className="text-sm font-semibold text-white">
                {MONTHS[view.m - 1]} {view.y}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="rounded-md p-1.5 text-[#9fa0b8] transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="rounded-md p-1.5 text-[#9fa0b8] transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Day grid */}
            <div className="px-3 pb-1 pt-2">
              <div className="grid grid-cols-7 gap-y-1">
                {WEEKDAYS.map((w) => (
                  <div
                    key={w}
                    className="text-center text-[10px] font-medium uppercase tracking-wider text-[#61627a]"
                  >
                    {w[0]}
                  </div>
                ))}
                {cells.map((d, i) => {
                  if (d === null) return <div key={`b${i}`} />;
                  const key = dayKey(view.y, view.m, d);
                  const isSelected =
                    !!selected &&
                    selected.y === view.y &&
                    selected.m === view.m &&
                    selected.d === d;
                  const isToday = key === todayKey;
                  const blocked = !!minKey && key < minKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={blocked}
                      onClick={() => pickDay(d)}
                      className={[
                        "mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-[13px] transition-colors",
                        blocked
                          ? "cursor-not-allowed text-[#3a3a48]"
                          : isSelected
                            ? "font-semibold text-[#141418]"
                            : isToday
                              ? "text-white ring-1 ring-inset ring-[#3a3a48] hover:bg-white/5"
                              : "text-[#c7c7da] hover:bg-white/5 hover:text-white",
                      ].join(" ")}
                      style={isSelected && !blocked ? { background: GOLD } : undefined}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time */}
            <div className="border-t border-[#262626] px-3 py-3">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 shrink-0 text-[#61627a]" />
                <div className="flex items-center gap-1 rounded-xl border border-[#262626] bg-[#1A1A1A] px-2 py-1.5">
                  <TimeCell
                    value={pad(hh12)}
                    ariaLabel="Hour"
                    onCommit={(n) => setHour12(n)}
                    onStep={(delta) => setHour12(((hh12 - 1 + delta + 12) % 12) + 1)}
                  />
                  <span className="text-sm text-[#61627a]">:</span>
                  <TimeCell
                    value={pad(selected?.mm ?? 0)}
                    ariaLabel="Minute"
                    onCommit={(n) => setMinute(n)}
                    onStep={(delta) =>
                      setMinute((((selected?.mm ?? 0) + delta * 5 + 60) % 60))
                    }
                  />
                </div>
                <div className="flex overflow-hidden rounded-xl border border-[#262626]">
                  {(["AM", "PM"] as const).map((m) => {
                    const active = m === "PM" ? isPm : !isPm;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMeridiem(m === "PM")}
                        className={[
                          "px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                          active ? "text-[#141418]" : "text-[#9fa0b8] hover:text-white",
                        ].join(" ")}
                        style={active ? { background: GOLD } : undefined}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {QUICK_TIMES.map((t) => {
                  const active =
                    !!selected && selected.hh === t.hh && selected.mm === t.mm;
                  return (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => pickTime(t.hh, t.mm)}
                      className={[
                        "rounded-md border px-2 py-1 text-[11px] transition-colors",
                        active
                          ? "border-brand/60 text-brand"
                          : "border-[#262626] text-zinc-400 hover:border-[#3A3A3A] hover:text-white",
                      ].join(" ")}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#262626] px-3 py-2.5">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-[11px] text-[#7c7d94] transition-colors hover:text-white"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-[11px] font-semibold text-[#141418]"
                style={{ background: GOLD }}
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={className}>
      {label && (
        <Label required={required} hint={hint}>
          {label}
        </Label>
      )}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          title={selected ? summariseLong(selected) : placeholder}
          className={[
            "flex w-full items-center gap-2 rounded-xl border bg-[#1A1A1A] py-3 pl-3 text-left text-sm transition-all",
            // Room for the clear button, so the label can never run under it.
            clearable && selected && !disabled ? "pr-9" : "pr-3",
            "focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50",
            open ? "border-brand" : "border-[#262626] hover:border-[#3A3A3A]",
          ].join(" ")}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-[#61627a]" />
          {/* One line, always. A wrapped label was what collided with the X. */}
          <span
            className={`min-w-0 flex-1 truncate ${
              selected ? "text-white" : "text-zinc-600"
            }`}
          >
            {selected ? summarise(selected) : placeholder}
          </span>
        </button>
        {clearable && selected && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear date"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#61627a] transition-colors hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {panel}
    </div>
  );
}

/**
 * One editable hour/minute cell. Typing is committed on blur (so a half-typed
 * "1" on the way to "11" isn't clamped mid-keystroke) and arrow keys step.
 */
function TimeCell({
  value,
  ariaLabel,
  onCommit,
  onStep,
}: {
  value: string;
  ariaLabel: string;
  onCommit: (n: number) => void;
  onStep: (delta: 1 | -1) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  return (
    <input
      aria-label={ariaLabel}
      inputMode="numeric"
      value={draft}
      onFocus={(e) => {
        setEditing(true);
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
      onBlur={() => {
        setEditing(false);
        const n = Number(draft);
        if (draft !== "" && !Number.isNaN(n)) onCommit(n);
        else setDraft(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onStep(1);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onStep(-1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className="w-7 bg-transparent text-center text-sm tabular-nums text-white outline-none"
    />
  );
}
