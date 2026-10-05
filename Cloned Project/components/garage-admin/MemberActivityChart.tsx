"use client";

// Downline member profile — the monthly activity chart in the header.
//
// ONE series is shown at a time: the switch swaps between what the member
// spent and what the viewer earned from them. That is why there is no legend —
// the title names the series, so identity is never carried by colour alone.
// Both series are cents from GET /affiliate/downline/:userId/monthly.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// The admin panel's own select. NetworkChains renders this picker with its
// searchable-select template, which doesn't exist in this repo — and a list of
// two or three years has nothing to search. Same component the other
// garage-admin filters use.
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fetchMemberMonthly } from "@/lib/affiliate/downline-monthly-api";

const GOLD = "#FFC200";
/** The recessive rail behind each bar. Constant height, so it reads as the
 *  plot's capacity rather than a second series. */
const TRACK = "rgba(255,255,255,0.05)";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec",
];

type Metric = "spent" | "earned";

/** Axis ticks: abbreviated so twelve of them fit a 420px card. */
function tickMoney(cents: number): string {
  const v = (cents || 0) / 100;
  if (v === 0) return "$0"; // "$0.00" reads oddly next to an abbreviated "$2.5k"
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `$${v.toFixed(2)}`;
}

/** Tooltip + screen-reader values: full precision, never abbreviated. */
function fullMoney(cents: number, currency: string): string {
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} ${code}`;
  }
}

export function MemberActivityChart({
  userId,
  memberName,
  className,
  showEarnings = true,
}: {
  userId: string;
  memberName?: string;
  className?: string;
  /**
   * Whether the Earnings series is meaningful for the CALLER.
   *
   * `earned` is the caller's own commission from this member. The garage
   * admin panel authenticates with an admin token and has no commission
   * relationship — requireUserOrGarageAdmin sets `req.user = {}`, so the
   * backend returns zeros. Off in the admin panel, where the toggle would
   * otherwise be a dead control that always draws a flat zero.
   */
  showEarnings?: boolean;
}) {
  const [metricState, setMetric] = useState<Metric>("spent");
  // Never render the earnings series when it can only be zeros.
  const metric: Metric = showEarnings ? metricState : "spent";
  const [year, setYear] = useState(() => new Date().getFullYear());

  const q = useQuery({
    queryKey: ["downline", "monthly", userId, year],
    queryFn: () => fetchMemberMonthly(userId, year),
    enabled: !!userId,
  });

  const currency = q.data?.currency || "USD";
  const first = (memberName || "").trim().split(/\s+/)[0] || "this member";
  const title =
    metric === "spent"
      ? `Total Money Spent By ${first}`
      : `Your Earnings From ${first}`;

  const rows = useMemo(
    () =>
      MONTHS.map((label, i) => {
        const point = q.data?.months?.find((m) => m.month === i + 1);
        return { label, value: (metric === "spent" ? point?.spent : point?.earned) ?? 0 };
      }),
    [q.data, metric],
  );

  const isEmpty = !q.isLoading && rows.every((r) => r.value === 0);

  // Always offer the year being viewed, even before the response lands, so the
  // picker is never momentarily empty.
  const yearOptions = useMemo(() => {
    const ys = new Set<number>(q.data?.years ?? []);
    ys.add(year);
    return [...ys]
      .sort((a, b) => b - a)
      .map((y) => ({ value: String(y), label: String(y) }));
  }, [q.data, year]);

  return (
    <div
      className={`flex min-h-[230px] flex-col rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 ${className || ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-semibold text-white">
          {title}
        </p>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="h-8 w-[92px] shrink-0 rounded-lg border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/[0.08] bg-[#15151d] text-white">
            {yearOptions.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-[12px]">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative mt-3 min-h-0 flex-1">
        {q.isLoading ? (
          <div className="h-[150px] animate-pulse rounded-lg bg-white/[0.04]" />
        ) : q.isError ? (
          <p className="py-10 text-center text-[13px] text-zinc-500">
            Couldn&apos;t load activity.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                  interval={0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                  tickFormatter={tickMoney}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-lg border border-white/[0.08] bg-[#181818] px-2.5 py-1.5 shadow-lg">
                        <p className="text-[11px] text-zinc-400">
                          {label} {year}
                        </p>
                        <p className="text-[13px] font-semibold text-white">
                          {fullMoney(Number(payload[0].value) || 0, currency)}
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Bar
                  dataKey="value"
                  fill={GOLD}
                  // 4px rounded data-end, anchored to the baseline.
                  radius={[4, 4, 0, 0]}
                  // Constant-height rail behind each bar (the design's track).
                  background={{ fill: TRACK, radius: 4 }}
                  // ~2px of surface between adjacent bars.
                  barSize={12}
                />
              </BarChart>
            </ResponsiveContainer>

            {isEmpty && (
              <p className="pointer-events-none absolute inset-x-0 top-[60px] text-center text-[12px] text-zinc-500">
                No {metric === "spent" ? "purchases" : "earnings"} in {year}
              </p>
            )}
          </>
        )}

        {/* Same numbers as the bars, for screen readers — the chart's values
            are otherwise only reachable by hovering. */}
        {/* Wrapped in a div: `sr-only` on the <table> itself is overridden by
            the table reset (clip/size don't stick), leaving a real 211x312 box
            that inflates the card's scroll height. The div clips it properly. */}
        <div className="sr-only">
          <table>
            <caption>{title}</caption>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>{fullMoney(r.value, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-[12px] text-zinc-400">
          {!showEarnings || metric === "spent" ? "Purchase Volume" : "Earnings"}
        </span>
        {showEarnings && (
          <Switch
            checked={metric === "spent"}
            onCheckedChange={(on) => setMetric(on ? "spent" : "earned")}
            aria-label="Switch between purchase volume and earnings"
          />
        )}
      </div>
    </div>
  );
}
