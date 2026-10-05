"use client";

// The shared Analytics page body: control bar + a grid of KPI cards on live
// data. Traction and Subscriptions are the same screen with different metric
// sets and endpoints (see the Figma "Admin → Analytics → *" frames), so both
// render this rather than keeping two copies of the fetch/override logic.
//
// Two levels of filtering:
//   - the control bar sets the page-wide range/interval and one bulk request
//     fills every card;
//   - any single card can override that from its own filter drawer, which
//     re-fetches just that metric (`?metrics=<id>`). Changing the page-wide
//     filter clears the per-card overrides so the grid is comparable again.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChartCard } from "./ChartCard";
import { ControlBar, type DateRangePreset } from "./ControlBar";
import { defaultIntervalForPreset, rangeFromPreset } from "./mock";
import type { ChartInterval, ChartPoint, ChartUnit } from "./types";
import { garageAdminApi } from "@/lib/api";

/** One card on the page. `id` must match the backend metric id. */
export interface AnalyticsMetric {
  id: string;
  title: string;
  unit: ChartUnit;
}

interface MetricPayload {
  points: ChartPoint[];
  /** Count created within the selected range. */
  headline: number | null;
  /** All-time running count as of the range end. */
  total?: number | null;
}
interface AnalyticsResponse {
  interval: ChartInterval;
  buckets: number[];
  metrics: Record<string, MetricPayload>;
}
type LoadStatus = "loading" | "error" | "ready";
interface Override {
  range: DateRangePreset;
  interval: ChartInterval;
  customStart?: string;
  customEnd?: string;
}

/** A custom window as "YYYY-MM-DD" strings. */
interface CustomRange {
  start: string;
  end: string;
}

function buildQuery(
  range: DateRangePreset,
  interval: ChartInterval,
  metricId?: string,
  custom?: CustomRange
): string {
  // A custom window is inclusive of both days: start at 00:00:00Z and end at
  // 23:59:59Z, so picking the same date twice still yields a real day rather
  // than a zero-length range the backend would reject.
  const r =
    range === "custom" && custom?.start && custom?.end
      ? {
          start: Date.parse(`${custom.start}T00:00:00Z`),
          end: Date.parse(`${custom.end}T23:59:59Z`),
        }
      : rangeFromPreset(range, Date.now());
  const qs = new URLSearchParams({
    rangeStart: String(r.start),
    rangeEnd: String(r.end),
    interval,
  });
  if (metricId) qs.set("metrics", metricId);
  return qs.toString();
}

function MetricCard({
  metric,
  endpoint,
  globalRange,
  globalInterval,
  globalCustom,
  globalPayload,
  globalStatus,
  globalError,
  override,
  onOverrideChange,
}: {
  metric: AnalyticsMetric;
  endpoint: string;
  globalRange: DateRangePreset;
  globalInterval: ChartInterval;
  globalCustom?: CustomRange;
  globalPayload?: MetricPayload;
  globalStatus: LoadStatus;
  globalError?: string;
  override: Override | null;
  onOverrideChange: (next: Override) => void;
}) {
  const [ownPayload, setOwnPayload] = useState<MetricPayload | null>(null);
  const [ownStatus, setOwnStatus] = useState<LoadStatus>("loading");
  const [ownError, setOwnError] = useState<string | undefined>();

  const effRange = override?.range ?? globalRange;
  const effInterval = override?.interval ?? globalInterval;
  const effCustom: CustomRange | undefined = override
    ? override.customStart && override.customEnd
      ? { start: override.customStart, end: override.customEnd }
      : undefined
    : globalCustom;

  // Only an overridden card fetches for itself; the rest ride the bulk load.
  useEffect(() => {
    if (!override) return;
    let cancelled = false;
    setOwnStatus("loading");
    setOwnError(undefined);
    garageAdminApi<AnalyticsResponse>(
      `${endpoint}?${buildQuery(override.range, override.interval, metric.id, effCustom)}`,
      { method: "GET" }
    )
      .then((res) => {
        if (cancelled) return;
        setOwnPayload(res.metrics?.[metric.id] ?? null);
        setOwnStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setOwnError(e instanceof Error ? e.message : "Failed to load");
        setOwnStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [override, metric.id, endpoint, effCustom?.start, effCustom?.end]);

  const payload = override ? ownPayload : globalPayload;
  const status = override ? ownStatus : globalStatus;
  const errorMessage = override ? ownError : globalError;

  return (
    <ChartCard
      title={metric.title}
      unit={metric.unit}
      interval={effInterval}
      status={status}
      errorMessage={errorMessage}
      series={[{ id: metric.id, name: metric.title, points: payload?.points ?? [] }]}
      headline={payload?.headline ?? null}
      total={payload?.total ?? null}
      range={effRange}
      // Picking a range re-picks a sensible interval for it; picking an
      // interval keeps the range as-is.
      customStart={effCustom?.start}
      customEnd={effCustom?.end}
      onRangeChange={(next, custom) =>
        onOverrideChange({
          range: next,
          interval: defaultIntervalForPreset(next),
          customStart: custom?.start,
          customEnd: custom?.end,
        })
      }
      onIntervalChange={(next) =>
        onOverrideChange({
          range: effRange,
          interval: next,
          customStart: effCustom?.start,
          customEnd: effCustom?.end,
        })
      }
      filtered={!!override}
    />
  );
}

export function AnalyticsMetricsPage({
  title,
  subtitle,
  endpoint,
  metrics,
  defaultRange = "last_12_months",
}: {
  title: string;
  subtitle: string;
  /** Backend path, e.g. "/garage-admin/analytics/subscriptions". */
  endpoint: string;
  metrics: AnalyticsMetric[];
  defaultRange?: DateRangePreset;
}) {
  const [rangePreset, setRangePreset] = useState<DateRangePreset>(defaultRange);
  const [interval, setIntervalValue] = useState<ChartInterval>(
    defaultIntervalForPreset(defaultRange)
  );
  const [customRange, setCustomRange] = useState<CustomRange>({ start: "", end: "" });
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // A page-wide change puts every card back on the same window.
  const handleRangeChange = (next: DateRangePreset) => {
    setRangePreset(next);
    // "custom" has no sensible default interval (the window can be a day or
    // three years), so keep whatever the user already had.
    if (next !== "custom") setIntervalValue(defaultIntervalForPreset(next));
    setOverrides({});
  };
  const handleIntervalChange = (next: ChartInterval) => {
    setIntervalValue(next);
    setOverrides({});
  };

  const query = useMemo(
    () => buildQuery(rangePreset, interval, undefined, customRange),
    [rangePreset, interval, customRange]
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMessage(undefined);
    garageAdminApi<AnalyticsResponse>(`${endpoint}?${query}`, { method: "GET" })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setErrorMessage(e instanceof Error ? e.message : "Failed to load analytics");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [query, endpoint]);

  const setOverride = useCallback(
    (id: string, next: Override) => setOverrides((prev) => ({ ...prev, [id]: next })),
    []
  );

  return (
    <div className="chat-font flex flex-col gap-6">
      <div>
        <h1 className="text-[20px] font-semibold text-white">{title}</h1>
        <p className="mt-1 text-[13px] text-white/50">{subtitle}</p>
      </div>

      <ControlBar
        range={rangePreset}
        onRangeChange={handleRangeChange}
        interval={interval}
        onIntervalChange={handleIntervalChange}
        customStart={customRange.start}
        customEnd={customRange.end}
        onCustomRangeChange={setCustomRange}
      />

      {/* Fixed 356px tracks left whatever didn't divide evenly as one dead
          gutter on the right. The tracks now flex and each card centres in
          its own, so the slack is shared between the columns instead.
          The CARD stays exactly 356px: ChartCard is pixel-spec'd from Figma
          and LineChart maps pointer x to a data index assuming 1 CSS px = 1
          SVG unit, so stretching it would break hover, not just layout. */}
      <div
        className="grid justify-items-center gap-x-[10px] gap-y-[13px]"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(356px, 1fr))" }}
      >
        {metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            metric={metric}
            endpoint={endpoint}
            globalRange={rangePreset}
            globalInterval={interval}
            globalCustom={customRange}
            globalPayload={data?.metrics?.[metric.id]}
            globalStatus={status}
            globalError={errorMessage}
            override={overrides[metric.id] ?? null}
            onOverrideChange={(next) => setOverride(metric.id, next)}
          />
        ))}
      </div>
    </div>
  );
}
