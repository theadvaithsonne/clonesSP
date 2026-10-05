"use client";

// Analytics filter controls, at two levels:
//
//   - PAGE-WIDE: the two Figma pills (Date Range 235x34, Date Intervals
//     246x34, radius 35, label + value split by a 2px divider) open a
//     filter DRAWER built on the garage-admin drawer pattern (see
//     NetworkChainSubsFilterDrawer) — portalled right-side panel, gold-tinted
//     selection, draft state that only commits on Apply.
//
//   - PER-CARD: ChartCard opens the same `TractionFilterDrawer` (titled with
//     the metric name), so a single chart can be put on its own
//     range/interval through exactly the same UI.
//
// Presentational + controlled — no fetch/mock logic here. The page owns the
// selected range/interval and decides what to do when they change.

import { forwardRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChartInterval } from "./types";
import { RangeCalendar } from "@/components/ui/range-calendar";

export type DateRangePreset =
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "last_12_months"
  | "year_to_date"
  | "all_time"
  | "custom";

export const RANGE_LABELS: Record<DateRangePreset, string> = {
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  last_90_days: "Last 90 days",
  last_12_months: "Last 12 months",
  year_to_date: "Year to date",
  all_time: "All time",
  custom: "Custom range",
};

export const INTERVAL_LABELS: Record<ChartInterval, string> = {
  hour: "Hourly",
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  quarter: "Quarterly",
  year: "Yearly",
};

// ── Page-wide filter drawer ────────────────────────────────────────────────

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function DrawerOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${
        selected ? "bg-brand/15 text-brand" : "text-zinc-200 hover:bg-white/[0.05]"
      }`}
    >
      <span>{label}</span>
      {selected && <Check className="h-4 w-4 shrink-0" />}
    </button>
  );
}


export function TractionFilterDrawer({
  open,
  onClose,
  range,
  interval,
  customStart,
  customEnd,
  onApply,
  title = "Traction",
}: {
  open: boolean;
  onClose: () => void;
  range: DateRangePreset;
  interval: ChartInterval;
  /** Active custom window (YYYY-MM-DD), when range === "custom". */
  customStart?: string;
  customEnd?: string;
  onApply: (next: {
    range: DateRangePreset;
    interval: ChartInterval;
    customStart?: string;
    customEnd?: string;
  }) => void;
  /** Eyebrow above "Filters" — a card passes its metric name. */
  title?: string;
}) {
  const [draftRange, setDraftRange] = useState(range);
  const [draftInterval, setDraftInterval] = useState(interval);
  const [draftStart, setDraftStart] = useState(customStart || "");
  const [draftEnd, setDraftEnd] = useState(customEnd || "");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reopening starts from what's actually applied, so an abandoned edit never
  // leaks into the next session.
  useEffect(() => {
    if (open) {
      setDraftRange(range);
      setDraftInterval(interval);
      setDraftStart(customStart || "");
      setDraftEnd(customEnd || "");
    }
  }, [open, range, interval, customStart, customEnd]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const body = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-end bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 28, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className={`mr-6 flex h-[calc(100vh-48px)] max-w-[94vw] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e12] shadow-2xl transition-[width] ${
              draftRange === "custom" ? "w-[620px]" : "w-[400px]"
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {title}
                </p>
                <p className="text-base font-bold text-white">Filters</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close filters"
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <DrawerSection title="Date Range">
                {(Object.keys(RANGE_LABELS) as DateRangePreset[]).map((key) => (
                  <DrawerOption
                    key={key}
                    label={RANGE_LABELS[key]}
                    selected={draftRange === key}
                    onClick={() => setDraftRange(key)}
                  />
                ))}
              </DrawerSection>

              {draftRange === "custom" && (
                <RangeCalendar
                  start={draftStart}
                  end={draftEnd}
                  onChange={({ start, end }) => {
                    setDraftStart(start);
                    setDraftEnd(end);
                  }}
                />
              )}

              <DrawerSection title="Date Intervals">
                {(Object.keys(INTERVAL_LABELS) as ChartInterval[]).map((key) => (
                  <DrawerOption
                    key={key}
                    label={INTERVAL_LABELS[key]}
                    selected={draftInterval === key}
                    onClick={() => setDraftInterval(key)}
                  />
                ))}
              </DrawerSection>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setDraftRange("last_12_months");
                  setDraftInterval("month");
                }}
                className="text-sm text-zinc-400 transition-colors hover:text-white"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={
                  draftRange === "custom" &&
                  (!draftStart || !draftEnd || draftStart > draftEnd)
                }
                onClick={() => {
                  onApply({
                    range: draftRange,
                    interval: draftInterval,
                    customStart: draftRange === "custom" ? draftStart : undefined,
                    customEnd: draftRange === "custom" ? draftEnd : undefined,
                  });
                  onClose();
                }}
                className="flex h-9 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(body, document.body);
}

// ── The pills ──────────────────────────────────────────────────────────────

const Pill = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { minWidth: number; label: string; value: string }
>(function Pill({ minWidth, label, value, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`chat-font flex items-center gap-2.5 rounded-[35px] border border-white/[0.06] bg-white/[0.04] px-4 text-[14px] font-medium text-white transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className || ""}`}
      // Figma's 235/246 is the resting size, not a cap: "Last 12 months" and a
      // custom range are both wider than it, and a fixed width truncated them
      // to "Last 12 m...". Growing past it beats hiding the selection.
      style={{ minWidth, height: 34 }}
      {...props}
    >
      <span className="whitespace-nowrap text-white/60">{label}</span>
      <span aria-hidden="true" style={{ width: 2, height: 14, background: "rgba(114,114,114,0.32)" }} />
      <span className="flex-1 whitespace-nowrap text-left text-white">{value}</span>
      <ChevronDown size={14} className="shrink-0 text-white/50" />
    </button>
  );
});

// ── Inline filters (fullscreen dialog) ─────────────────────────────────────
//
// The page-wide pills open `TractionFilterDrawer`, which portals to <body> at
// z-[100]. That cannot be reused inside the fullscreen dialog: the dialog sits
// at z-1100, so the drawer would open behind it — and Radix would treat every
// click in it as an interaction outside the dialog (closing it) while its focus
// trap pulled focus back out of the drawer's inputs.
//
// So the enlarged chart gets real dropdowns instead. Radix's DropdownMenu is
// built to nest inside a Dialog, which sidesteps all three problems, and inline
// menus suit a dialog better than a second overlay sliding over the first.
//
// Custom ranges are deliberately absent: picking one needs the drawer's
// calendar. A card already on a custom window still shows it as the value, and
// the card's own filter button remains the way to change it.

function InlinePill({
  label,
  value,
  ariaLabel,
}: {
  label: string;
  value: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="flex h-[34px] items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] pl-3 pr-2 text-[12px] transition-colors hover:border-white/[0.14] hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      <span className="text-zinc-400">{label}</span>
      <span aria-hidden className="h-[14px] w-px bg-white/[0.12]" />
      <span className="max-w-[160px] truncate font-medium text-white">{value}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
    </button>
  );
}

function InlineMenu<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <DropdownMenuContent
      align="start"
      // Above the dialog's own z-1100. Radix portals menu content to <body>,
      // so it does not inherit the dialog's stacking context.
      className="z-[1200] min-w-[200px] border-white/10 bg-[#1a1a1a] p-1 text-white"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => onChange(o.value)}
            className={`flex cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-[13px] focus:bg-white/[0.06] ${
              active ? "bg-white/[0.04] text-white" : "text-zinc-300"
            }`}
          >
            {o.label}
            {active && <Check className="h-3.5 w-3.5 text-brand" />}
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  );
}

export function InlineFilters({
  range,
  onRangeChange,
  interval,
  onIntervalChange,
  customStart,
  customEnd,
  className,
}: {
  range: DateRangePreset;
  onRangeChange: (next: DateRangePreset) => void;
  interval: ChartInterval;
  onIntervalChange: (next: ChartInterval) => void;
  customStart?: string;
  customEnd?: string;
  className?: string;
}) {
  const rangeValue =
    range === "custom" && customStart && customEnd
      ? `${customStart} → ${customEnd}`
      : RANGE_LABELS[range];

  const rangeOptions = (Object.keys(RANGE_LABELS) as DateRangePreset[])
    .filter((r) => r !== "custom")
    .map((r) => ({ value: r, label: RANGE_LABELS[r] }));

  const intervalOptions = (Object.keys(INTERVAL_LABELS) as ChartInterval[]).map(
    (i) => ({ value: i, label: INTERVAL_LABELS[i] }),
  );

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ""}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <InlinePill
            label="Date Range"
            value={rangeValue}
            ariaLabel={`Date range: ${rangeValue}. Change range.`}
          />
        </DropdownMenuTrigger>
        <InlineMenu options={rangeOptions} value={range} onChange={onRangeChange} />
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <InlinePill
            label="Date Intervals"
            value={INTERVAL_LABELS[interval]}
            ariaLabel={`Date interval: ${INTERVAL_LABELS[interval]}. Change interval.`}
          />
        </DropdownMenuTrigger>
        <InlineMenu
          options={intervalOptions}
          value={interval}
          onChange={onIntervalChange}
        />
      </DropdownMenu>
    </div>
  );
}

export function ControlBar({
  range,
  onRangeChange,
  interval,
  onIntervalChange,
  customStart,
  customEnd,
  onCustomRangeChange,
  className,
}: {
  range: DateRangePreset;
  onRangeChange: (next: DateRangePreset) => void;
  interval: ChartInterval;
  onIntervalChange: (next: ChartInterval) => void;
  customStart?: string;
  customEnd?: string;
  onCustomRangeChange?: (next: { start: string; end: string }) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className || ""}`}>
      <Pill
        minWidth={235}
        label="Date Range"
        value={
          range === "custom" && customStart && customEnd
            ? `${customStart} → ${customEnd}`
            : RANGE_LABELS[range]
        }
        onClick={() => setOpen(true)}
        aria-label={`Date range: ${RANGE_LABELS[range]}. Open filters.`}
      />
      <Pill
        minWidth={246}
        label="Date Intervals"
        value={INTERVAL_LABELS[interval]}
        onClick={() => setOpen(true)}
        aria-label={`Date interval: ${INTERVAL_LABELS[interval]}. Open filters.`}
      />

      <TractionFilterDrawer
        open={open}
        onClose={() => setOpen(false)}
        range={range}
        interval={interval}
        customStart={customStart}
        customEnd={customEnd}
        onApply={({ range: nextRange, interval: nextInterval, customStart: cs, customEnd: ce }) => {
          // Commit the window BEFORE the range, so the page never renders a
          // "custom" range with no dates attached to it.
          if (nextRange === "custom" && cs && ce) onCustomRangeChange?.({ start: cs, end: ce });
          // Order matters: the page's range handler re-picks a sensible
          // default interval, so only override it when the user actually
          // chose an interval themselves.
          if (nextRange !== range) onRangeChange(nextRange);
          if (nextInterval !== interval) onIntervalChange(nextInterval);
        }}
      />
    </div>
  );
}
