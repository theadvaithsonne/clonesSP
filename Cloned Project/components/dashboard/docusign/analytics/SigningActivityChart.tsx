"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DsAnalyticsSummary } from "@/lib/docusign/types";

const SENT_COLOR = "#FBD10D";
const COMPLETED_COLOR = "#10b981";

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function SigningActivityChart({
  activity,
  loading,
}: {
  activity: DsAnalyticsSummary["signingActivity"] | null;
  loading?: boolean;
}) {
  const rows = useMemo(() => {
    const byDate = new Map<string, { date: string; sent: number; completed: number }>();
    for (const row of activity?.sent ?? []) {
      byDate.set(row.date, { date: row.date, sent: row.count, completed: byDate.get(row.date)?.completed ?? 0 });
    }
    for (const row of activity?.completed ?? []) {
      const existing = byDate.get(row.date);
      byDate.set(row.date, { date: row.date, sent: existing?.sent ?? 0, completed: row.count });
    }
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [activity]);

  const isEmpty = rows.length === 0 || rows.every((r) => r.sent === 0 && r.completed === 0);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#2a2a35] bg-[#111116] p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white/90">Signing Activity</h3>
        <div className="flex items-center gap-3 text-[11px] text-[#8a8a9b]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SENT_COLOR }} />
            Sent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COMPLETED_COLOR }} />
            Completed
          </span>
        </div>
      </div>
      <div className="relative mt-3 flex-1" style={{ minHeight: 220 }}>
        {loading ? (
          <div className="h-full w-full animate-pulse rounded-lg bg-white/[0.04]" />
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#ffffff10" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#ffffff80", fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tickLine={false} axisLine={false} width={32} tick={{ fill: "#ffffff80", fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  labelFormatter={(v) => formatDateLabel(String(v))}
                  contentStyle={{ background: "#050505", border: "1px solid #ffffff14", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="sent" name="Sent" fill={SENT_COLOR} radius={[3, 3, 0, 0]} barSize={10} isAnimationActive={false} />
                <Bar dataKey="completed" name="Completed" fill={COMPLETED_COLOR} radius={[3, 3, 0, 0]} barSize={10} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            {isEmpty && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-[#8a8a9b]">
                No activity in this range
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
