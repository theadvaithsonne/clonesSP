"use client";

// The SVG chart primitive. Deliberately knows nothing about cards, titles,
// or dialogs — it takes a `ChartGeometry` (scale.ts) and draws into exactly
// that box. That separation is what lets ChartCard and
// ChartFullscreenDialog each pick their own size/margins and still share
// one renderer, and what will let a future BarChart slot into the same
// ChartCard without ChartCard changing.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChartGeometry, ChartInterval, ChartPoint, ChartSeries, ChartUnit } from "./types";
import { niceTicks, scaleLinear, crisp } from "./scale";
import { formatAxisDate, formatAxisDateLong, formatTicks, formatValue } from "./format";
import { useChartPan } from "./use-chart-pan";

const GOLD = "#FFC200";
const SERIES_PALETTE = [GOLD, "rgba(255,255,255,0.55)", "#60A5FA", "#34D399"];
const GRIDLINE = "rgba(255,255,255,0.17)";
const AXIS_LABEL = "rgba(255,255,255,0.5)";
// Crosshair guides are the gridline hue stepped up in contrast — no new
// color introduced — so they read as "guide," not as a second data series.
const CROSSHAIR_GUIDE = "rgba(255,255,255,0.35)";
// Touch slop: cumulative horizontal movement below this, from contact to
// release, reads as a tap (crosshair); past it, it's a pan drag.
const TOUCH_MOVE_THRESHOLD = 8;

export type LineChartStatus = "loading" | "error" | "ready";

export interface LineChartProps {
  geometry: ChartGeometry;
  series: ChartSeries[];
  unit: ChartUnit;
  interval: ChartInterval;
  status?: LineChartStatus;
  errorMessage?: string;
  emptyMessage?: string;
  /** Fixed horizontal spacing between adjacent points — the "pixels per
   *  point" the pan model is built on. Bigger virtual canvases pan instead
   *  of squashing. */
  pixelsPerPoint?: number;
  /** Richer hover affordance: vertical + horizontal guides, axis echo
   *  chips, and per-series point markers. Drives both pointer hover and
   *  the arrow-key/Home/End/Page Up/Page Down crosshair navigation. */
  showCrosshair?: boolean;
  /** Floating value tooltip anchored to the crosshair. Needs real
   *  clearance to not crowd the plot, so it's opt-in separately from
   *  `showCrosshair` — the fullscreen dialog turns it on, the compact
   *  card doesn't (it swaps its own header instead, via `onHoverChange`). */
  showTooltip?: boolean;
  /** Reports the crosshair's data index outward (or `null` when idle).
   *  LineChart stays dumb about cards/titles — a caller that wants to do
   *  something with the hovered point (e.g. ChartCard swapping its own
   *  header) reads it from here instead of reaching into internals. */
  onHoverChange?: (index: number | null) => void;
  xTickCount?: number;
  /** Describes the chart for assistive tech and labels the sr-only table
   *  (e.g. "Users, last 6 months"). Required — there is no visual fallback
   *  a screen reader can use instead. */
  ariaLabel: string;
  className?: string;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Splits a series into runs of consecutive non-null points. A run of one
 *  point can't draw a line (needs 2), so it's rendered as a dot instead —
 *  this also naturally covers the "single point total" case, since a
 *  series with exactly one point is just one run of length 1. */
function buildRuns(points: ChartPoint[]): number[][] {
  const runs: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (points[i].v !== null && Number.isFinite(points[i].v as number)) {
      current.push(i);
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

export function LineChart({
  geometry,
  series,
  unit,
  interval,
  status = "ready",
  errorMessage = "Couldn't load this chart.",
  emptyMessage = "No data in this range yet — try widening the date range.",
  pixelsPerPoint = 26,
  showCrosshair = false,
  showTooltip = false,
  onHoverChange,
  xTickCount = 6,
  ariaLabel,
  className,
}: LineChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const { plot } = geometry;

  const pointCount = series.reduce((max, s) => Math.max(max, s.points.length), 0);
  // The series always spans exactly the plot: picking "Last 12 months" shows
  // twelve months rather than a window you drag through, and a sparse series
  // fills its box instead of hugging the left edge (which is what made the
  // fullscreen labels bunch up — they're spaced by point pitch, not by the
  // plot width). `pixelsPerPoint` stays the prop for callers that care about
  // the pan model, but it can no longer leave the plot partly empty.
  const ppp =
    pointCount > 1 ? plot.width / (pointCount - 1) : pixelsPerPoint;
  const virtualWidth = ppp * Math.max(0, pointCount - 1);

  const pan = useChartPan({
    virtualWidth,
    viewportWidth: plot.width,
  });

  const xAt = (index: number) => plot.x - pan.offset + index * ppp;

  const allValues = useMemo(
    () =>
      series.flatMap((s) => s.points.map((p) => p.v)).filter((v): v is number => v !== null && Number.isFinite(v)),
    [series]
  );
  const isEmpty = status === "ready" && (pointCount === 0 || allValues.length === 0);

  const domainMin = allValues.length ? Math.min(...allValues) : 0;
  const domainMax = allValues.length ? Math.max(...allValues) : 0;
  const ticks = useMemo(
    () => niceTicks(domainMin, domainMax, geometry.yTickCount, unit),
    [domainMin, domainMax, geometry.yTickCount, unit]
  );
  const tickLabels = useMemo(() => formatTicks(ticks, unit), [ticks, unit]);
  const yDomainMin = ticks[0];
  const yDomainMax = ticks[ticks.length - 1];
  const yAt = useMemo(
    () => scaleLinear([yDomainMin, yDomainMax], [plot.y + plot.height, plot.y]),
    [yDomainMin, yDomainMax, plot.y, plot.height]
  );

  // X-axis labels track the current viewport, not the whole virtual canvas
  // — as you pan, the six labels update to whatever's currently visible.
  // A range that crosses a year boundary needs the year on its labels, or
  // last September is indistinguishable from this September.
  const multiYear = useMemo(() => {
    const pts = series[0]?.points ?? [];
    if (pts.length < 2) return false;
    const first = new Date(pts[0].t).getUTCFullYear();
    return pts.some((p) => new Date(p.t).getUTCFullYear() !== first);
  }, [series]);

  const xLabels = useMemo(() => {
    if (pointCount === 0) return [];
    const firstVisible = Math.max(0, Math.floor(pan.offset / ppp));
    const lastVisible = Math.min(
      pointCount - 1,
      Math.ceil((pan.offset + plot.width) / ppp)
    );
    const span = Math.max(0, lastVisible - firstVisible);
    // Cap the label count by how many actually fit across the plot, so
    // evenly-spaced labels never land on adjacent points and overprint (e.g.
    // "Aug 29"/"Aug 30" on a 7-day daily view). Width per label depends on
    // the text each interval renders on the axis (see formatAxisDate).
    const minLabelPx =
      interval === "hour"
        ? 92
        : interval === "day" || interval === "week"
          ? multiYear
            ? 84
            : 64
          : multiYear
            ? 64
            : 44;
    // Labels sit at point positions, so the room between them is the pixel
    // distance those points actually occupy — not the plot width. n labels
    // leave n-1 gaps, hence the +1.
    const spanPx = Math.min(plot.width, span * ppp);
    const maxByWidth = Math.max(2, 1 + Math.floor(spanPx / minLabelPx));
    const maxLabels = Math.max(2, Math.min(xTickCount, span + 1, maxByWidth));

    // Step by a whole number of points rather than dividing the span into
    // `maxLabels` even slices and rounding each to the nearest point. Rounding
    // only lands on a regular pattern when span/(maxLabels-1) happens to be an
    // integer; otherwise the skipped points scatter. Twelve months across ten
    // labels gave gaps of 1,2,1,1,2,1,1,2,1 — Nov, Mar and Jul silently
    // vanished while every other month stayed, which reads as missing data
    // rather than as a thinned axis. A stride can only ever skip a constant
    // number, so it reads as deliberate at any density.
    const stride = Math.max(1, Math.ceil(span / Math.max(1, maxLabels - 1)));
    const idx: number[] = [];
    for (let i = firstVisible; i <= lastVisible; i += stride) idx.push(i);

    // The stride rarely lands exactly on the last point, and an unlabelled
    // final point is the one people actually read ("where did this end up?").
    // Append it — dropping the previous label when the stride left it too
    // close, which is the overprinting `minLabelPx` exists to prevent.
    if (idx[idx.length - 1] !== lastVisible) {
      if (lastVisible - idx[idx.length - 1] < stride / 2) idx.pop();
      idx.push(lastVisible);
    }
    return idx;
  }, [pan.offset, ppp, plot.width, pointCount, xTickCount, interval, multiYear]);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  // useId(), not Math.random() — must match between server and client render.
  const svgId = `lc-clip-${useId()}`;

  const updateHover = (index: number | null) => {
    setHoverIndex(index);
    onHoverChange?.(index);
  };

  const clampIndex = (i: number) => Math.min(pointCount - 1, Math.max(0, i));

  // currentTarget is the plot-sized hit-region, so its own left edge is
  // already at svg-space x = plot.x — don't subtract plot.x again.
  //
  // Divides by `ppp`, NOT the `pixelsPerPoint` prop. Those were the same
  // number until the series was made to span the plot exactly; now the prop is
  // only a hint and `ppp` is the real pitch. Hit-testing on the stale one made
  // the crosshair land at the wrong index by a factor of ppp/pixelsPerPoint —
  // exact at ~30 points (where they coincide, which is why short ranges looked
  // fine) and badly wrong as the range widens: over a year the crosshair
  // crawled near the left edge while the cursor crossed the whole chart, which
  // read as the tracker lagging the cursor and still moving after it had left.
  //
  // This must stay the algebraic inverse of xAt(): xAt(i) = plot.x - offset +
  // i*ppp, and localX is measured from plot.x, so i = (localX + offset) / ppp.
  const indexFromClientX = (e: React.PointerEvent): number => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const localX = e.clientX - rect.left;
    // ppp is 0 only if the plot has no width yet (first paint, before layout).
    // Dividing then yields Infinity, which clamps to the last point — a
    // crosshair pinned to the right edge until the first resize.
    if (ppp <= 0) return 0;
    const rawIndex = Math.round((localX + pan.offset) / ppp);
    return clampIndex(rawIndex);
  };

  // Touch/pen gesture tracked separately from mouse: a tap should place the
  // crosshair, a horizontal drag should pan — see onPointerMove below.
  const touchGestureRef = useRef<{ startX: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    pan.handlers.onPointerDown(e);
    if (showCrosshair && pointCount > 0 && e.pointerType !== "mouse") {
      // Show a crosshair preview immediately on contact. If the gesture
      // turns into a horizontal drag (below) this is cleared so it reads
      // as a pan, never a stuck crosshair.
      touchGestureRef.current = { startX: e.clientX, moved: false };
      updateHover(indexFromClientX(e));
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    pan.handlers.onPointerMove(e);
    if (!showCrosshair || pointCount === 0) return;

    if (e.pointerType === "mouse") {
      if (e.buttons !== 0) {
        // A button is held — this is a drag-to-pan gesture, not a hover.
        updateHover(null);
        return;
      }
      updateHover(indexFromClientX(e));
      return;
    }

    // Touch/pen: decide tap-vs-pan by cumulative horizontal movement since
    // contact. Below the slop threshold it's a crosshair scrub; past it,
    // it's a pan and the crosshair stays cleared for the rest of the
    // gesture (matches the mouse drag-suppresses-hover reasoning above).
    const gesture = touchGestureRef.current;
    if (!gesture) return;
    const dx = e.clientX - gesture.startX;
    if (!gesture.moved && Math.abs(dx) > TOUCH_MOVE_THRESHOLD) {
      gesture.moved = true;
      updateHover(null);
    }
    if (!gesture.moved) {
      updateHover(indexFromClientX(e));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    pan.handlers.onPointerUp(e);
    const gesture = touchGestureRef.current;
    touchGestureRef.current = null;
    if (showCrosshair && pointCount > 0 && e.pointerType !== "mouse" && gesture && !gesture.moved) {
      // A genuine tap (movement stayed under the slop threshold) — land
      // the crosshair exactly where the finger lifted.
      updateHover(indexFromClientX(e));
    }
  };
  const onPointerCancel = (e: React.PointerEvent) => {
    setDragging(false);
    pan.handlers.onPointerCancel(e);
    touchGestureRef.current = null;
    updateHover(null);
  };
  const onPointerLeave = (e: React.PointerEvent) => {
    setDragging(false);
    pan.handlers.onPointerCancel(e);
    touchGestureRef.current = null;
    updateHover(null);
  };

  const runsBySeries = useMemo(() => series.map((s) => buildRuns(s.points)), [series]);

  // Crosshair is keyed off series[0]. Markers/guides below still loop every
  // series (kept multi-series-ready), but the header swap (ChartCard), the
  // axis echo chips, and the aria-live announcement need one value to lead
  // with, and the primary series is the obvious pick.
  const activePoint = showCrosshair && hoverIndex !== null ? series[0]?.points[hoverIndex] ?? null : null;
  const activeValue = activePoint && activePoint.v !== null ? activePoint.v : null;

  // A "screenful" no longer exists: the series spans the plot exactly, so every
  // point is always on screen and `plot.width / pitch` is the entire range —
  // which would make Page Up/Down a slower duplicate of Home/End. A tenth of
  // the range keeps the key meaningful between arrows (one point) and
  // Home/End (the ends), and scales with how much data is loaded.
  const pageJump = Math.max(1, Math.round((pointCount - 1) / 10));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (pointCount === 0) return;

    if (!showCrosshair) {
      // Plain panning — arrows/Home/End/Page Up/Down move the viewport
      // directly. Kept for callers that don't turn the crosshair on.
      switch (e.key) {
        case "ArrowLeft":
          pan.setOffset((o) => o - ppp);
          e.preventDefault();
          break;
        case "ArrowRight":
          pan.setOffset((o) => o + ppp);
          e.preventDefault();
          break;
        case "Home":
          pan.setOffset(0);
          e.preventDefault();
          break;
        case "End":
          pan.setOffset(pan.maxOffset);
          e.preventDefault();
          break;
        case "PageUp":
          pan.setOffset((o) => o - plot.width);
          e.preventDefault();
          break;
        case "PageDown":
          pan.setOffset((o) => o + plot.width);
          e.preventDefault();
          break;
        default:
          break;
      }
      return;
    }

    // Unified model: arrows move the crosshair through the data one bucket
    // at a time; the view pans only as much as needed to keep the
    // crosshair in frame ("scroll into view"), never further. One mental
    // model — "move through the data" — with panning as a consequence.
    // With no active crosshair yet, the first press starts from whichever
    // point currently sits at the left edge of the viewport.
    // `ppp`, not the prop — same inverse-of-xAt reasoning as
    // indexFromClientX. Inert while the plot fits exactly (offset is pinned at
    // 0), but it must not be the one place left holding the stale scale.
    const base = hoverIndex ?? clampIndex(ppp > 0 ? Math.round(pan.offset / ppp) : 0);

    const goTo = (index: number) => {
      const clamped = clampIndex(index);
      updateHover(clamped);
      const pointX = clamped * ppp;
      if (pointX < pan.offset) pan.setOffset(pointX);
      else if (pointX > pan.offset + plot.width) pan.setOffset(pointX - plot.width);
    };

    switch (e.key) {
      case "ArrowLeft":
        goTo(base - 1);
        e.preventDefault();
        break;
      case "ArrowRight":
        goTo(base + 1);
        e.preventDefault();
        break;
      case "Home":
        goTo(0);
        e.preventDefault();
        break;
      case "End":
        goTo(pointCount - 1);
        e.preventDefault();
        break;
      case "PageUp":
        goTo(base - pageJump);
        e.preventDefault();
        break;
      case "PageDown":
        goTo(base + pageJump);
        e.preventDefault();
        break;
      case "Escape":
        updateHover(null);
        e.preventDefault();
        break;
      default:
        break;
    }
  };

  return (
    <div
      className={className}
      style={{ width: geometry.width, height: geometry.height, position: "relative" }}
    >
      {status === "loading" && <ChartSkeleton geometry={geometry} reducedMotion={reducedMotion} />}

      {status === "error" && (
        <div
          role="alert"
          className="absolute flex items-center justify-center text-center text-[13px] text-white/50"
          style={{
            left: plot.x,
            top: plot.y,
            width: plot.width,
            height: plot.height,
          }}
        >
          {errorMessage}
        </div>
      )}

      {status === "ready" && (
        <>
          {/* Purely visual layer — full card/dialog box, aria-hidden. The
              pannable hit-region below sits on top of it and is the actual
              interactive + accessible surface. */}
          <svg
            aria-hidden="true"
            width={geometry.width}
            height={geometry.height}
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            style={{ position: "absolute", left: 0, top: 0 }}
          >
              <defs>
                <clipPath id={svgId}>
                  <rect x={plot.x} y={plot.y} width={plot.width} height={plot.height} />
                </clipPath>
              </defs>

              {/* Gridlines */}
              {ticks.map((t, i) => {
                const y = crisp(yAt(t));
                return (
                  <line
                    key={`grid-${i}`}
                    x1={plot.x}
                    x2={plot.x + plot.width}
                    y1={y}
                    y2={y}
                    stroke={GRIDLINE}
                    strokeWidth={1}
                  />
                );
              })}

              {/* Y tick labels */}
              {ticks.map((t, i) => (
                <text
                  key={`ytick-${i}`}
                  x={geometry.yLabelRight}
                  y={yAt(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontFamily="var(--font-chat), Inter, sans-serif"
                  fontSize={12}
                  fontWeight={400}
                  fill={AXIS_LABEL}
                >
                  {tickLabels[i]}
                </text>
              ))}

              {/* X tick labels */}
              {xLabels.map((idx) => {
                const p = series[0]?.points[idx];
                if (!p) return null;
                return (
                  <text
                    key={`xtick-${idx}`}
                    x={xAt(idx)}
                    y={geometry.xLabelY}
                    textAnchor="middle"
                    fontFamily="var(--font-chat), Inter, sans-serif"
                    fontSize={12}
                    fontWeight={400}
                    fill={AXIS_LABEL}
                  >
                    {formatAxisDate(p.t, interval, multiYear)}
                  </text>
                );
              })}

              {/* Series */}
              <g clipPath={`url(#${svgId})`}>
                {isEmpty ? null : (
                  <>
                    {series.map((s, si) => {
                      const color = s.color || SERIES_PALETTE[si % SERIES_PALETTE.length];
                      return (
                        <g key={s.id}>
                          {runsBySeries[si].map((run, ri) => {
                            if (run.length >= 2) {
                              const d = run
                                .map((idx, j) => {
                                  const x = xAt(idx);
                                  const y = yAt(s.points[idx].v as number);
                                  return `${j === 0 ? "M" : "L"}${x},${y}`;
                                })
                                .join(" ");
                              return (
                                <path
                                  key={ri}
                                  d={d}
                                  fill="none"
                                  stroke={color}
                                  strokeWidth={2}
                                  strokeLinejoin="round"
                                  strokeLinecap="round"
                                />
                              );
                            }
                            // Single-point run: a line needs 2 points, so
                            // show a dot and let the value stand alone.
                            const idx = run[0];
                            return (
                              <circle
                                key={ri}
                                cx={xAt(idx)}
                                cy={yAt(s.points[idx].v as number)}
                                r={4}
                                fill={color}
                              />
                            );
                          })}
                        </g>
                      );
                    })}
                  </>
                )}

                {/* Vertical guide — always present while the crosshair is
                    active, since it only needs an index (a bucket always
                    has a position on the x-axis even when its value is
                    null). Thinner and more subdued than the gold series
                    line by design: it's a guide, not data. */}
                {showCrosshair && hoverIndex !== null && activePoint && (
                  <line
                    x1={xAt(hoverIndex)}
                    x2={xAt(hoverIndex)}
                    y1={plot.y}
                    y2={plot.y + plot.height}
                    stroke={CROSSHAIR_GUIDE}
                    strokeWidth={1}
                  />
                )}
                {/* Horizontal guide — only when the primary series has a
                    real value at this index; a null bucket has no y to
                    echo. */}
                {showCrosshair && hoverIndex !== null && activeValue !== null && (
                  <line
                    x1={plot.x}
                    x2={plot.x + plot.width}
                    y1={yAt(activeValue)}
                    y2={yAt(activeValue)}
                    stroke={CROSSHAIR_GUIDE}
                    strokeWidth={1}
                  />
                )}
                {showCrosshair &&
                  hoverIndex !== null &&
                  series.map((s, si) => {
                    const p = s.points[hoverIndex];
                    if (!p || p.v === null) return null;
                    const color = s.color || SERIES_PALETTE[si % SERIES_PALETTE.length];
                    return (
                      <circle
                        key={s.id}
                        cx={xAt(hoverIndex)}
                        cy={yAt(p.v)}
                        r={4}
                        fill={color}
                        stroke="#141414"
                        strokeWidth={2}
                      />
                    );
                  })}
              </g>
          </svg>

          {/* Interactive hit-region — sized to the plot rect only, matching
              "a focusable plot with visible focus ring." Sits above the svg
              so it receives every pointer/keyboard event. */}
          <div
            role="group"
            tabIndex={pointCount > 0 ? 0 : -1}
            aria-label={`${ariaLabel} chart. ${
              showCrosshair && pointCount > 1
                ? "Use arrow keys to move through the data point by point, Home or End to jump to the first or last point, Page Up or Page Down to jump by a tenth of the range, and Escape to clear the crosshair."
                : !showCrosshair && pan.canPan
                  ? "Use arrow keys, Home, End, or Page Up/Down to pan."
                  : ""
            }`}
            className="absolute select-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            style={{
              left: plot.x,
              top: plot.y,
              width: plot.width,
              height: plot.height,
              touchAction: "pan-y",
              cursor: pan.canPan ? (dragging ? "grabbing" : "grab") : "default",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerLeave}
            onKeyDown={onKeyDown}
            onBlur={() => updateHover(null)}
          >
            {/* Edge fades — subtle affordance that more data exists off-screen. */}
            {pan.canPan && !pan.atStart && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-6"
                style={{
                  background: "linear-gradient(to right, rgba(24,24,24,0.55), transparent)",
                }}
              />
            )}
            {pan.canPan && !pan.atEnd && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-6"
                style={{
                  background: "linear-gradient(to left, rgba(24,24,24,0.55), transparent)",
                }}
              />
            )}
          </div>

          {/* Axis echo chips — exact value/date at the crosshair, formatted
              with the same functions the ticks use (formatTicks /
              formatAxisDate) so they can never disagree with the axes. */}
          {showCrosshair && hoverIndex !== null && activeValue !== null && (
            <YAxisChip geometry={geometry} y={yAt(activeValue)} text={formatTicks([activeValue], unit)[0]} />
          )}
          {showCrosshair && hoverIndex !== null && activePoint && (
            <XAxisChip geometry={geometry} x={xAt(hoverIndex)} text={formatAxisDate(activePoint.t, interval, multiYear)} />
          )}

          {showTooltip && hoverIndex !== null && activePoint && (
            <CrosshairTooltip
              x={xAt(hoverIndex)}
              plot={plot}
              interval={interval}
              unit={unit}
              t={activePoint.t}
              series={series}
              pointIndex={hoverIndex}
            />
          )}

          {isEmpty && (
            <p
              className="pointer-events-none absolute text-center text-[13px] text-white/45"
              style={{
                left: plot.x,
                top: plot.y + plot.height / 2 - 10,
                width: plot.width,
              }}
            >
              {emptyMessage}
            </p>
          )}
        </>
      )}

      {/* Screen-reader mirror of the plotted data — same precedent as
          MemberActivityChart's sr-only table. This is the real data path
          for assistive tech; the SVG above is aria-hidden. */}
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Bucket</th>
              {series.map((s) => (
                <th key={s.id} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: pointCount }).map((_, i) => (
              <tr key={i}>
                <th scope="row">
                  {series[0]?.points[i] ? formatAxisDateLong(series[0].points[i].t, interval) : ""}
                </th>
                {series.map((s) => (
                  <td key={s.id}>{formatValue(s.points[i]?.v ?? null, unit)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Announces the crosshair position as it moves (keyboard or pointer)
          — the plot is a focusable role="group", not a native input, so
          nothing else tells assistive tech what changed. Keyed off the
          primary series, same choice as the axis chips and ChartCard's
          header swap. Visually hidden; clears when the crosshair is idle
          so it doesn't leave a stale announcement queued. */}
      <div aria-live="polite" className="sr-only">
        {showCrosshair && hoverIndex !== null && activePoint
          ? `${formatAxisDateLong(activePoint.t, interval)}: ${formatValue(activePoint.v, unit)}`
          : ""}
      </div>
    </div>
  );
}

function CrosshairTooltip({
  x,
  plot,
  t,
  interval,
  unit,
  series,
  pointIndex,
}: {
  x: number;
  plot: ChartGeometry["plot"];
  t: number;
  interval: ChartInterval;
  unit: ChartUnit;
  series: ChartSeries[];
  pointIndex: number;
}) {
  const flip = x > plot.x + plot.width - 140;
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-[12px] shadow-lg"
      style={{
        left: flip ? undefined : x + 10,
        right: flip ? plot.x + plot.width - x + 10 : undefined,
        top: plot.y,
        minWidth: 120,
      }}
    >
      <p className="mb-1 text-white/50">{formatAxisDateLong(t, interval)}</p>
      {series.map((s) => (
        <p key={s.id} className="flex items-center justify-between gap-3 text-white">
          <span className="text-white/60">{s.name}</span>
          <span className="font-semibold">{formatValue(s.points[pointIndex]?.v ?? null, unit)}</span>
        </p>
      ))}
    </div>
  );
}

/** Y-axis echo chip — the exact value at the crosshair's row, right-aligned
 *  into the same margin the y tick labels live in. Gold, tying it visually
 *  to the (gold) series line: it's echoing a data value, not a guide. */
function YAxisChip({ geometry, y, text }: { geometry: ChartGeometry; y: number; text: string }) {
  const { plot } = geometry;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute flex justify-end"
      style={{ left: 0, width: Math.max(0, plot.x - 6), top: y, transform: "translateY(-50%)" }}
    >
      <span className="whitespace-nowrap rounded-[3px] bg-brand px-1.5 py-[1px] text-[11px] font-semibold leading-[16px] text-[#141414]">
        {text}
      </span>
    </div>
  );
}

/** X-axis echo chip — the exact bucket date/label at the crosshair's
 *  column, below the x tick label row. Neutral/dark, matching the guide
 *  lines: it's a position label, not a data value. */
function XAxisChip({ geometry, x, text }: { geometry: ChartGeometry; x: number; text: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ left: x, top: geometry.xLabelY + 6, transform: "translateX(-50%)" }}
    >
      <span className="whitespace-nowrap rounded-[3px] border border-white/10 bg-[#1a1a1a] px-1.5 py-[1px] text-[11px] font-medium leading-[16px] text-white/70">
        {text}
      </span>
    </div>
  );
}

function ChartSkeleton({
  geometry,
  reducedMotion,
}: {
  geometry: ChartGeometry;
  reducedMotion: boolean;
}) {
  const { plot } = geometry;
  const pulse = reducedMotion ? "" : "animate-pulse";
  return (
    <div aria-hidden="true">
      <div
        className={`absolute rounded-md bg-white/[0.05] ${pulse}`}
        style={{ left: plot.x, top: plot.y, width: plot.width, height: plot.height }}
      />
      {Array.from({ length: geometry.yTickCount }).map((_, i) => (
        <div
          key={i}
          className={`absolute h-[10px] rounded bg-white/[0.06] ${pulse}`}
          style={{
            right: geometry.width - geometry.yLabelRight,
            width: 20,
            top: plot.y + (i * plot.height) / (geometry.yTickCount - 1) - 5,
          }}
        />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={`absolute h-[10px] w-[28px] rounded bg-white/[0.06] ${pulse}`}
          style={{
            left: plot.x + (i * plot.width) / 5 - 14,
            top: geometry.xLabelY - 8,
          }}
        />
      ))}
    </div>
  );
}
