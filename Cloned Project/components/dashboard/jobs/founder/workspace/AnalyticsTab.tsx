"use client";

// A17 · Job analytics — views and applications over time, where candidates
// drop out of the application form, which sources bring applicants and hires,
// and the affiliates referring the most people. Renders inside the job
// workspace, which provides the page padding and scroll container.

import React from "react";
import { Loader2, TrendingDown } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as jobsApi from "../../api";
import { SOURCE_COLORS, SOURCE_LABELS } from "../../constants";
import { Avatar, Card, Chip, ErrorState, GOLD, LoadingBlock, StatTile, formatMoney, useLoad } from "../../ui";
import type { AnalyticsResponse } from "../../types";

const RANGES = [7, 30, 90] as const;
const APPLICATIONS_COLOR = "#60a5fa";

function shortDay(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default function AnalyticsTab({ jobId }: { jobId: string }) {
  const [days, setDays] = React.useState<(typeof RANGES)[number]>(30);
  const { data, loading, error, reload } = useLoad(() => jobsApi.getJobAnalytics(jobId, days), [jobId, days]);

  if (loading && !data) return <LoadingBlock label="Loading analytics…" />;
  if (error && !data) return <ErrorState message={error} onRetry={() => reload()} />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <KpiTiles totals={data.totals} />
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">Views and applications</h2>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7c7d94]" />}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-[#c7c7da]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: GOLD }} /> Views
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: APPLICATIONS_COLOR }} /> Applications
              </span>
            </div>
            <div className="flex gap-1.5">
              {RANGES.map((r) => (
                <Chip key={r} active={days === r} onClick={() => setDays(r)}>
                  {r} days
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <ViewsChart series={data.series} />
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <DropoffCard dropoff={data.dropoff} />
        <SourcesCard sources={data.sources} />
        <ReferrersCard referrers={data.topReferrers} />
      </div>
    </div>
  );
}

function KpiTiles({ totals }: { totals: AnalyticsResponse["totals"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatTile label="Views" value={totals.views.toLocaleString()} sub="All time" />
      <StatTile label="Apply starts" value={totals.applyStarts.toLocaleString()} sub="Opened the form" />
      <StatTile label="Applications" value={totals.applications.toLocaleString()} sub="Submitted" />
      <StatTile
        label="Apply rate"
        value={totals.applyRate === null ? "—" : `${totals.applyRate}%`}
        sub={totals.applyRate === null ? "No views yet" : "Applications per view"}
      />
      <StatTile
        label="Time to hire"
        value={totals.timeToHireDays === null ? "—" : `${totals.timeToHireDays} day${totals.timeToHireDays === 1 ? "" : "s"}`}
        sub={totals.timeToHireDays === null ? "No hires yet" : "Applied → hired, average"}
      />
      <StatTile
        label="Cost per hire"
        value={totals.costPerHire === null ? "—" : formatMoney(totals.costPerHire)}
        sub={totals.costPerHire === null ? "No hires yet" : "Referral reward per hire"}
        accent={totals.costPerHire !== null}
      />
    </div>
  );
}

function ViewsChart({ series }: { series: AnalyticsResponse["series"] }) {
  const gradientId = React.useId().replace(/:/g, "");
  const empty = !series.some((p) => p.views > 0 || p.applications > 0);
  return (
    <div className="relative h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id={`views-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.25} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`apps-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={APPLICATIONS_COLOR} stopOpacity={0.25} />
              <stop offset="100%" stopColor={APPLICATIONS_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f1f24" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDay}
            tick={{ fill: "#7c7d94", fontSize: 11 }}
            axisLine={{ stroke: "#1f1f24" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis allowDecimals={false} tick={{ fill: "#7c7d94", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            labelFormatter={(label) => shortDay(String(label))}
            contentStyle={{ background: "#141414", border: "1px solid #262626", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "#ffffff", marginBottom: 4 }}
            itemStyle={{ color: "#c7c7da" }}
            cursor={{ stroke: "#3a3a48" }}
          />
          <Area
            type="monotone"
            dataKey="views"
            name="Views"
            stroke={GOLD}
            strokeWidth={2}
            fill={`url(#views-${gradientId})`}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="applications"
            name="Applications"
            stroke={APPLICATIONS_COLOR}
            strokeWidth={2}
            fill={`url(#apps-${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-lg bg-[#0c0c0e]/80 px-3 py-1.5 text-sm text-[#7c7d94]">No views yet in this period</span>
        </div>
      )}
    </div>
  );
}

function DropoffCard({ dropoff }: { dropoff: AnalyticsResponse["dropoff"] }) {
  const first = dropoff.pages[0]?.count || 0;
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">Form drop-off</h2>
      {!dropoff.pages.length ? (
        <p className="py-6 text-center text-sm text-[#7c7d94]">This job&apos;s form has no pages.</p>
      ) : !first ? (
        <p className="py-6 text-center text-sm text-[#7c7d94]">Drop-off appears once candidates start applying.</p>
      ) : (
        <>
          <div className="space-y-3">
            {dropoff.pages.map((p, i) => {
              const pct = first ? (p.count / first) * 100 : 0;
              return (
                <div key={p.pageId || i}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-[#c7c7da]">
                      {i + 1}. {p.title}
                    </span>
                    <span className="tabular-nums text-white">{p.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#1f1f28]">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, p.count ? 2 : 0)}%`, background: GOLD }} />
                  </div>
                </div>
              );
            })}
          </div>
          {dropoff.worst && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/5 px-3 py-2.5 text-xs text-[#fbbf24]">
              <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Page “{dropoff.worst.title}”: {dropoff.worst.dropPercent}% drop — consider making it shorter or optional.
              </span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function SourcesCard({ sources }: { sources: AnalyticsResponse["sources"] }) {
  const rows = [...sources].sort((a, b) => b.applicants - a.applicants);
  return (
    <Card className="overflow-hidden">
      <h2 className="px-5 pb-3 pt-5 text-sm font-semibold text-white">Source performance</h2>
      {!rows.length ? (
        <p className="px-5 pb-8 pt-3 text-center text-sm text-[#7c7d94]">No applicants yet.</p>
      ) : (
        <div>
          <div className="grid grid-cols-[1.4fr_repeat(3,minmax(0,1fr))] gap-3 border-y border-[#1f1f24] px-5 py-2 text-[11px] font-medium uppercase tracking-wider text-[#7c7d94]">
            <span>Source</span>
            <span className="text-right">Applicants</span>
            <span className="text-right">Hires</span>
            <span className="text-right">Rewarded</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.source}
              className="grid grid-cols-[1.4fr_repeat(3,minmax(0,1fr))] items-center gap-3 border-t border-[#1f1f24] px-5 py-2.5 text-sm first:border-t-0"
            >
              <span className="flex min-w-0 items-center gap-2 text-[#c7c7da]">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: SOURCE_COLORS[r.source] || "#71717a" }} />
                <span className="truncate">{SOURCE_LABELS[r.source] || r.source}</span>
              </span>
              <span className="text-right tabular-nums text-white">{r.applicants}</span>
              <span className="text-right tabular-nums text-white">{r.hires}</span>
              <span className="text-right tabular-nums" style={{ color: r.rewarded ? GOLD : "#61627a" }}>
                {r.rewarded}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ReferrersCard({ referrers }: { referrers: AnalyticsResponse["topReferrers"] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">Top referrers</h2>
      {!referrers.length ? (
        <p className="py-6 text-center text-sm text-[#7c7d94]">No referred applicants yet.</p>
      ) : (
        <ol className="space-y-3">
          {referrers.map((r, i) => (
            <li key={r.userId} className="flex items-center gap-3">
              <span className="w-5 text-xs tabular-nums text-[#61627a]">{String(i + 1).padStart(2, "0")}</span>
              <Avatar name={r.name} src={r.avatar} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-white">{r.name}</div>
                <div className="text-xs text-[#7c7d94]">
                  {r.applicants} applicant{r.applicants === 1 ? "" : "s"} · {r.hires} hire{r.hires === 1 ? "" : "s"}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
