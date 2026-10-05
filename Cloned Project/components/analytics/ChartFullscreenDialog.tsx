"use client";

// The maximize target: same chart, same pan model, more room. Bigger
// margins (room for less-abbreviated tick labels), more ticks in both
// axes, and — unlike the compact card — room for the floating
// CrosshairTooltip (`showTooltip`). The card has the same crosshair
// (guides, axis chips, keyboard model) but swaps its own header instead
// of a floating tooltip, since a 293×210 plot has no room for one.
//
// Radix's Dialog (components/ui/dialog.tsx) already wires Escape-to-close,
// a close button, and focus trapping — nothing extra needed here for that.

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineFilters, type DateRangePreset } from "./ControlBar";
import { LineChart } from "./LineChart";
import { computeGeometry } from "./scale";
import { formatValue } from "./format";
import type { ChartInterval, ChartSeries, ChartUnit } from "./types";

export interface ChartFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  unit: ChartUnit;
  interval: ChartInterval;
  status: "loading" | "error" | "ready";
  errorMessage?: string;
  series: ChartSeries[];
  headline: number | null;
  pixelsPerPoint?: number;
  /** Range/interval controls, shown in the dialog header. Omit them and the
   *  header renders without filters, so callers that have no filtering to
   *  offer are unaffected. */
  range?: DateRangePreset;
  customStart?: string;
  customEnd?: string;
  onRangeChange?: (next: DateRangePreset) => void;
  onIntervalChange?: (next: ChartInterval) => void;
}

const DIALOG_HEIGHT = 460;

export function ChartFullscreenDialog({
  open,
  onOpenChange,
  title,
  unit,
  interval,
  status,
  errorMessage,
  series,
  headline,
  pixelsPerPoint = 34,
  range,
  customStart,
  customEnd,
  onRangeChange,
  onIntervalChange,
}: ChartFullscreenDialogProps) {
  const showFilters = !!(range && onRangeChange && onIntervalChange);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !open) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const geometry = computeGeometry({
    width,
    height: DIALOG_HEIGHT,
    topMargin: 16,
    bottomMargin: 56,
    leftMargin: 72,
    rightMargin: 32,
    yTickCount: 8,
    yLabelGap: 12,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="chat-font w-[calc(100%-2rem)] max-w-[1080px] border-white/10 bg-[#181818] p-6 text-white sm:max-w-[1080px]"
        style={{ zIndex: 1100 }}
        // DialogContent renders {children} before its close button, so the
        // first focusable node in the dialog is the chart's hit region
        // (tabIndex 0, because the crosshair is keyboard-operable). Radix
        // auto-focuses it on open, and a programmatic focus after a keyboard-
        // ish modality matches :focus-visible — so the plot drew its gold
        // focus ring every time the dialog opened, reading as a stray border
        // around the chart.
        //
        // Focus the dialog itself instead. The ring is left intact: it is the
        // only indicator a keyboard user has for a chart they can drive with
        // arrow keys, so it should appear when someone tabs to the plot, not
        // merely because the dialog opened.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <DialogHeader>
          {/* Title and filters share a row: enlarging a chart is when you most
              want to re-cut it, and sending the user back to the page behind
              the dialog to do that is the thing being fixed. `pr-8` keeps the
              controls clear of the dialog's own close button. */}
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
          <DialogTitle className="flex items-baseline gap-3 text-white">
            <span className="text-[15px] font-medium text-white/50">{title}</span>
            {status === "loading" ? (
              // Same treatment as ChartCard's headline skeleton, so the
              // dialog never flashes a stale/empty number while it opens on
              // top of a still-loading card.
              <span className="h-[28px] w-[120px] animate-pulse rounded bg-white/10" />
            ) : (
              <span className="text-[28px] font-bold leading-none">
                {status === "error" ? "—" : formatValue(headline, unit)}
              </span>
            )}
          </DialogTitle>
            {showFilters && (
              <InlineFilters
                range={range!}
                onRangeChange={onRangeChange!}
                interval={interval}
                onIntervalChange={onIntervalChange!}
                customStart={customStart}
                customEnd={customEnd}
              />
            )}
          </div>
        </DialogHeader>

        <div ref={containerRef} className="w-full" style={{ height: DIALOG_HEIGHT }}>
          <LineChart
            geometry={geometry}
            series={series}
            unit={unit}
            interval={interval}
            status={status}
            errorMessage={errorMessage}
            pixelsPerPoint={pixelsPerPoint}
            showCrosshair
            showTooltip
            // No artificial tick cap: the point of fullscreen is to see the
            // detail, and LineChart already caps labels by how many actually
            // fit (minLabelPx per interval), which is the real constraint. A
            // fixed 10 was below what the width holds — 928px of plot takes 15
            // monthly labels, so asking for 10 of 13 months dropped three of
            // them for no reason.
            xTickCount={Infinity}
            ariaLabel={`${title}, ${interval}ly, fullscreen`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
