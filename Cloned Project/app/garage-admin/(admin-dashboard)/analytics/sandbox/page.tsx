"use client";

// Reference sandbox for the analytics chart template — every state and
// edge case the components/analytics primitives are built to handle,
// side by side. This is what the developer wiring real APIs should look
// at before writing a single fetch call: it shows what LineChart/ChartCard
// do with loading, error, empty, single/two-point, long (365pt, pannable),
// negative, flat, and each unit + interval.
//
// Deliberately not linked from the sidebar (see the report) — this is a
// dev reference, not a product surface, but it must stay a real route.
// Note for future edits: Next's App Router treats an underscore-prefixed
// folder (`_sandbox`) as a PRIVATE folder excluded from routing entirely
// (this repo already relies on that for app/garage-admin/(admin-dashboard)/
// _stub/, a non-routed shared component) — so this route lives at
// /garage-admin/analytics/sandbox, not /analytics/_sandbox.
//
// Everything below is generated from a fixed reference instant, not
// Date.now(). Date.now() called during render would give the server render
// and the client hydration render two different millisecond values; for
// most intervals that's harmless (both round down to the same day/month),
// but for the "hour" interval sandbox it can flip the exact bucket count if
// the request happens to straddle the top of an hour — a real, if rare,
// hydration mismatch. A fixed constant makes every render byte-identical.

import { ChartCard } from "@/components/analytics/ChartCard";
import {
  bucketStarts,
  emptySeries,
  generateSeries,
  headlineFromSeries,
  seriesFromValues,
} from "@/components/analytics/mock";
import type { ChartInterval, DateRange } from "@/components/analytics/types";

const MOCK_NOW = Date.UTC(2026, 8, 4);
const DAY = 86_400_000;

function daysRange(days: number): DateRange {
  return { start: MOCK_NOW - days * DAY, end: MOCK_NOW };
}

const RANGE_30D = daysRange(30);
const RANGE_365D = daysRange(365);
const RANGE_1D: DateRange = { start: MOCK_NOW, end: MOCK_NOW };
const RANGE_2D: DateRange = { start: MOCK_NOW - DAY, end: MOCK_NOW };

function Cell({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-[13px] font-medium text-white/80">{label}</p>
        {note && <p className="text-[11px] text-white/40">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid gap-x-[10px] gap-y-6"
      style={{ gridTemplateColumns: "repeat(auto-fill, 356px)" }}
    >
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-white/10 pb-2 text-[15px] font-semibold text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function AnalyticsSandboxPage() {
  const interval: ChartInterval = "day";

  const emptyS = emptySeries("empty", "Empty metric", RANGE_30D, interval);
  const singleS = seriesFromValues("single", "Single point", RANGE_1D, "day", [42]);
  const twoS = seriesFromValues("two", "Two points", RANGE_2D, "day", [30, 45]);
  const dailyYearS = generateSeries({
    id: "daily-year",
    name: "365 daily points",
    range: RANGE_365D,
    interval: "day",
    unit: "count",
    base: 500,
    trend: 1.5,
  });
  const negativeS = generateSeries({
    id: "negative",
    name: "Net change",
    range: RANGE_30D,
    interval,
    unit: "count",
    base: 0,
    trend: 0,
    volatility: 40,
    allowNegative: true,
  });
  const allZeroS = generateSeries({
    id: "all-zero",
    name: "All zero",
    range: RANGE_30D,
    interval,
    unit: "count",
    allZero: true,
  });
  const allEqualS = seriesFromValues(
    "all-equal",
    "All equal (flat, nonzero)",
    RANGE_30D,
    interval,
    bucketStarts(RANGE_30D, interval).map(() => 7)
  );
  const centsS = generateSeries({
    id: "cents",
    name: "Revenue",
    range: RANGE_30D,
    interval,
    unit: "currencyCents",
    base: 480_000,
    trend: 3_000,
    volatility: 20_000,
  });
  const percentS = generateSeries({
    id: "percent",
    name: "Conversion rate",
    range: RANGE_30D,
    interval,
    unit: "percent",
    base: 34,
    trend: 0.2,
    volatility: 4,
  });
  const durationS = generateSeries({
    id: "duration",
    name: "Avg. session length",
    range: RANGE_30D,
    interval,
    unit: "duration",
    base: 420,
    trend: 2,
    volatility: 90,
  });

  const intervalSamples: { interval: ChartInterval; days: number }[] = [
    { interval: "hour", days: 3 },
    { interval: "day", days: 45 },
    { interval: "week", days: 180 },
    { interval: "month", days: 365 },
    { interval: "quarter", days: 365 * 3 },
    { interval: "year", days: 365 * 8 },
  ];

  return (
    <div className="chat-font flex flex-col gap-10 pb-16">
      <div>
        <h1 className="text-[20px] font-semibold text-white">Analytics sandbox</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-white/50">
          Every state components/analytics/LineChart and ChartCard are built to
          handle, rendered from deterministic mock data. Use this as the
          reference when binding real API data — swap the mock ChartSeries[]
          for a real one and everything downstream (scales, ticks, pan,
          fullscreen) keeps working unchanged.
        </p>
      </div>

      <Section title="Crosshair">
        <p className="max-w-2xl text-[13px] text-white/50">
          Hover, tap/drag, or focus the plot and use arrow keys, Home, End,
          Page Up/Down, or Escape — the crosshair always snaps to the
          nearest real point (never interpolates), echoes the exact
          value/date on both axes, and moving past the edge of the visible
          window pans the view to follow it. The card swaps its own header
          in place of a floating tooltip (no room for one at 293×210);
          click the maximize icon for the same crosshair with the floating
          tooltip, where there is room.
        </p>
        <Grid>
          <Cell
            label="Card crosshair, wide series"
            note="Header swaps to the hovered point + date. Arrow-key past the edge to see auto-pan; maximize for the tooltip."
          >
            <ChartCard
              title={dailyYearS.name}
              unit="count"
              interval="day"
              status="ready"
              series={[dailyYearS]}
              headline={headlineFromSeries(dailyYearS)}
            />
          </Cell>
          <Cell
            label="Card crosshair, two points"
            note="Nothing to pan, but the crosshair still moves between the two points via arrow keys."
          >
            <ChartCard
              title={twoS.name}
              unit="count"
              interval="day"
              status="ready"
              series={[twoS]}
              headline={headlineFromSeries(twoS)}
            />
          </Cell>
        </Grid>
      </Section>

      <Section title="Async / lifecycle states">
        <Grid>
          <Cell label="Loading" note="Skeleton matches the exact plot geometry — no layout shift on load.">
            <ChartCard title="Users" unit="count" interval="day" status="loading" series={[]} headline={null} />
          </Cell>
          <Cell label="Error" note="A real fetch failure.">
            <ChartCard
              title="Users"
              unit="count"
              interval="day"
              status="error"
              errorMessage="Couldn't load Users — try again."
              series={[]}
              headline={null}
            />
          </Cell>
          <Cell label="Empty" note="Ready, zero-length data — an invitation, not an apology.">
            <ChartCard
              title={emptyS.name}
              unit="count"
              interval={interval}
              status="ready"
              series={[emptyS]}
              headline={null}
            />
          </Cell>
        </Grid>
      </Section>

      <Section title="Point-count edge cases">
        <Grid>
          <Cell label="Single point" note="A line needs 2 points — renders a dot, value still shown.">
            <ChartCard
              title={singleS.name}
              unit="count"
              interval="day"
              status="ready"
              series={[singleS]}
              headline={headlineFromSeries(singleS)}
            />
          </Cell>
          <Cell label="Two points" note="Exactly enough for one line segment.">
            <ChartCard
              title={twoS.name}
              unit="count"
              interval="day"
              status="ready"
              series={[twoS]}
              headline={headlineFromSeries(twoS)}
            />
          </Cell>
          <Cell label="365 daily points" note="Wide virtual canvas — drag, wheel, or arrow-key pan.">
            <ChartCard
              title={dailyYearS.name}
              unit="count"
              interval="day"
              status="ready"
              series={[dailyYearS]}
              headline={headlineFromSeries(dailyYearS)}
            />
          </Cell>
        </Grid>
      </Section>

      <Section title="Numeric edge cases">
        <Grid>
          <Cell label="Negative values" note="Domain includes zero when data goes negative.">
            <ChartCard
              title={negativeS.name}
              unit="count"
              interval={interval}
              status="ready"
              series={[negativeS]}
              headline={headlineFromSeries(negativeS)}
            />
          </Cell>
          <Cell label="All zero" note="Flat line at 0, sensible synthesized domain — no NaN ticks.">
            <ChartCard
              title={allZeroS.name}
              unit="count"
              interval={interval}
              status="ready"
              series={[allZeroS]}
              headline={headlineFromSeries(allZeroS)}
            />
          </Cell>
          <Cell label="All equal, nonzero" note="Flat line at 7 — ticks still distinct, still nice numbers.">
            <ChartCard
              title={allEqualS.name}
              unit="count"
              interval={interval}
              status="ready"
              series={[allEqualS]}
              headline={headlineFromSeries(allEqualS)}
            />
          </Cell>
        </Grid>
      </Section>

      <Section title="Units">
        <Grid>
          <Cell label="currencyCents" note="Stored as cents, formatted as currency.">
            <ChartCard
              title={centsS.name}
              unit="currencyCents"
              interval={interval}
              status="ready"
              series={[centsS]}
              headline={headlineFromSeries(centsS)}
            />
          </Cell>
          <Cell label="percent" note="Capped at 0–100.">
            <ChartCard
              title={percentS.name}
              unit="percent"
              interval={interval}
              status="ready"
              series={[percentS]}
              headline={headlineFromSeries(percentS)}
            />
          </Cell>
          <Cell label="duration" note="Seconds, formatted human (s/m/h/d).">
            <ChartCard
              title={durationS.name}
              unit="duration"
              interval={interval}
              status="ready"
              series={[durationS]}
              headline={headlineFromSeries(durationS)}
            />
          </Cell>
        </Grid>
      </Section>

      <Section title="Every interval">
        <Grid>
          {intervalSamples.map(({ interval: iv, days }) => {
            const range = daysRange(days);
            const s = generateSeries({
              id: `interval-${iv}`,
              name: `${iv[0].toUpperCase()}${iv.slice(1)}ly sample`,
              range,
              interval: iv,
              unit: "count",
              base: 200,
              trend: 1,
            });
            return (
              <Cell key={iv} label={iv} note={`${bucketStarts(range, iv).length} buckets over ${days} days`}>
                <ChartCard
                  title={s.name}
                  unit="count"
                  interval={iv}
                  status="ready"
                  series={[s]}
                  headline={headlineFromSeries(s)}
                />
              </Cell>
            );
          })}
        </Grid>
      </Section>
    </div>
  );
}
