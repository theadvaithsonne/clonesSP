"use client";

// The Figma card: 356×356, title + big number + LineChart + a maximize
// control. This is the only place the exact pixel spec from the design
// lives — LineChart itself only ever sees a computed ChartGeometry.

import { useState } from "react";
import { Maximize2, SlidersHorizontal } from "lucide-react";
import { LineChart } from "./LineChart";
import { ChartFullscreenDialog } from "./ChartFullscreenDialog";
import { computeGeometry } from "./scale";
import { formatAxisDateLong, formatValue } from "./format";
import { TractionFilterDrawer, type DateRangePreset } from "./ControlBar";
import type { ChartInterval, ChartSeries, ChartUnit } from "./types";

// Figma "Admin -> Analytics -> Traction" card, measured:
//   card 356x356, radius 10, fill rgba(68,68,68,0.2)
//   title  x20 y24   Inter 500 16px rgba(255,255,255,.5)
//   value  x20 y48   Inter 700 22px #FFFFFF
//   plot   x42 y99, 293x210 (6 gridlines every 42px)
//   y-labels right-aligned to x34; x-labels baseline y326
const CARD_SIZE = 356;
const CARD_GEOMETRY = computeGeometry({
  width: CARD_SIZE,
  height: CARD_SIZE,
  topMargin: 99,
  bottomMargin: CARD_SIZE - 99 - 210, // 47 -> xLabelY lands at 326
  leftMargin: 42,
  rightMargin: CARD_SIZE - 42 - 293, // 21
  yTickCount: 6,
  yLabelGap: 8, // 42 - 8 = 34, matches "ending x≈34"
});

export interface ChartCardProps {
  title: string;
  unit: ChartUnit;
  interval: ChartInterval;
  status: "loading" | "error" | "ready";
  errorMessage?: string;
  series: ChartSeries[];
  /** The big number under the title. `null` renders as "—", not "0". */
  headline: number | null;
  /** All-time running count as of the range end. Shown under the headline
   *  while not hovering, so narrowing the range doesn't lose the total. */
  total?: number | null;
  pixelsPerPoint?: number;
  className?: string;
  /** Per-card filtering. When both handlers are supplied the card shows its
   *  own range/interval dropdown, so a single chart can be looked at on a
   *  different window than the rest of the grid. */
  range?: DateRangePreset;
  /** Active custom window (YYYY-MM-DD) when range === "custom". */
  customStart?: string;
  customEnd?: string;
  onRangeChange?: (next: DateRangePreset, custom?: { start: string; end: string }) => void;
  onIntervalChange?: (next: ChartInterval) => void;
  /** True when this card is on its own range/interval rather than the
   *  page-wide one — surfaces as a highlighted filter button. */
  filtered?: boolean;
}

export function ChartCard({
  title,
  unit,
  interval,
  status,
  errorMessage,
  series,
  headline,
  total,
  pixelsPerPoint = 24,
  className,
  range,
  customStart,
  customEnd,
  onRangeChange,
  onIntervalChange,
  filtered = false,
}: ChartCardProps) {
  const showFilter = !!(range && onRangeChange && onIntervalChange);
  const [filterOpen, setFilterOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  // The card doesn't have room for the floating tooltip, so instead the
  // title/value block itself becomes the readout: while hovering (pointer
  // or keyboard crosshair), the big number swaps to the hovered point and
  // a date line appears beneath it; on pointer-leave/blur/Escape LineChart
  // reports `null` and it reverts to the resting headline. Keyed off
  // series[0] — same "primary series leads" choice LineChart itself makes
  // for the axis chips and aria-live text.
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoveredPoint = hoveredIndex !== null ? series[0]?.points[hoveredIndex] ?? null : null;
  const displayValue = hoveredPoint ? hoveredPoint.v : headline;
  const dateText = hoveredPoint ? formatAxisDateLong(hoveredPoint.t, interval) : "";
  // Reuses the hover line's reserved row rather than adding one: the headline
  // is now "new in the selected range", so the running total would otherwise
  // have nowhere to go.
  const subText =
    dateText || (typeof total === "number" ? `${formatValue(total, unit)} total` : "");

  return (
    <div
      className={`chat-font relative overflow-hidden rounded-[10px] ${className || ""}`}
      style={{ width: CARD_SIZE, height: CARD_SIZE, background: "rgba(68,68,68,0.2)" }}
    >
      <p
        className="absolute left-5 top-6 truncate pr-8 text-[16px] font-medium"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {title}
      </p>

      {status === "loading" ? (
        <div className="absolute left-5 top-[52px] h-[22px] w-[90px] animate-pulse rounded bg-white/10" />
      ) : (
        <p className="absolute left-5 top-12 text-[22px] font-bold leading-none text-white">
          {status === "error" ? "—" : formatValue(displayValue, unit)}
        </p>
      )}

      {/* Reserves its own fixed-height row regardless of content, so the
          date appearing/disappearing on hover never shifts anything else
          in the card — and `truncate` inside a bounded (left+right) box,
          rather than a shrink-to-fit one, so a long formatted date clips
          instead of reflowing. */}
      <p
        className="absolute left-5 right-4 top-[74px] h-4 truncate text-[11px] font-medium text-white/40"
        aria-hidden="true"
      >
        {subText}
      </p>

      <button
        type="button"
        onClick={() => setFullscreenOpen(true)}
        aria-label={`Expand ${title} chart to fullscreen`}
        className="absolute right-4 top-5 z-10 flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Maximize2 size={14} />
      </button>

      {showFilter && (
        <>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-label={`Filter ${title} chart`}
            className={`absolute right-[52px] top-5 z-10 flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              filtered ? "text-brand" : "text-white/40 hover:text-white/80"
            }`}
          >
            <SlidersHorizontal size={14} />
          </button>
          <TractionFilterDrawer
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            title={title}
            range={range!}
            interval={interval}
            customStart={customStart}
            customEnd={customEnd}
            onApply={({ range: nextRange, interval: nextInterval, customStart: cs, customEnd: ce }) => {
              const custom = cs && ce ? { start: cs, end: ce } : undefined;
              // A custom window can change while the preset stays "custom", so
              // this can't short-circuit on `nextRange !== range` alone.
              if (nextRange !== range || (nextRange === "custom" && custom)) {
                onRangeChange!(nextRange, custom);
              }
              if (nextInterval !== interval) onIntervalChange!(nextInterval);
            }}
          />
        </>
      )}

      <LineChart
        geometry={CARD_GEOMETRY}
        series={series}
        unit={unit}
        interval={interval}
        status={status}
        errorMessage={errorMessage}
        pixelsPerPoint={pixelsPerPoint}
        showCrosshair
        onHoverChange={setHoveredIndex}
        ariaLabel={`${title}, ${interval}ly`}
      />

      <ChartFullscreenDialog
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        title={title}
        unit={unit}
        interval={interval}
        status={status}
        errorMessage={errorMessage}
        series={series}
        headline={headline}
        // Same handlers the card's own filter button uses, so a change made
        // while enlarged lands in exactly the same place as one made from the
        // card — including the page re-picking a sensible interval for a new
        // range. Passed only when the card is filterable at all.
        {...(showFilter
          ? {
              range,
              customStart,
              customEnd,
              onRangeChange: (next: DateRangePreset) => onRangeChange!(next),
              onIntervalChange: onIntervalChange!,
            }
          : {})}
      />
    </div>
  );
}
