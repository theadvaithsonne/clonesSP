"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { DsAnalyticsSummary } from "@/lib/docusign/types";

// Same semantic colors as StatusBadge.tsx, as hex (Recharts needs real colors, not Tailwind classes).
const SEGMENTS: { key: keyof Omit<DsAnalyticsSummary["totals"], "total">; label: string; color: string }[] = [
  { key: "draft", label: "Draft", color: "#71717a" },
  { key: "sent", label: "Sent", color: "#3b82f6" },
  { key: "in_progress", label: "In Progress", color: "#f59e0b" },
  { key: "completed", label: "Completed", color: "#10b981" },
  { key: "voided", label: "Voided", color: "#ef4444" },
];

export function DocumentStatusDonut({ totals, loading }: { totals: DsAnalyticsSummary["totals"] | null; loading?: boolean }) {
  const data = SEGMENTS.map((s) => ({ ...s, value: totals?.[s.key] ?? 0 }));
  const total = totals?.total ?? 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#2a2a35] bg-[#111116] p-5">
      <h3 className="text-sm font-semibold text-white/90">Document Status</h3>
      {loading ? (
        <div className="mt-4 flex flex-1 items-center justify-center">
          <div className="h-40 w-40 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-[#8a8a9b]">No documents yet</div>
      ) : (
        <>
          <div className="relative mx-auto mt-2 h-[220px] w-[220px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={72} outerRadius={100} dataKey="value" stroke="#111116" strokeWidth={3} isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums text-white/95">{total.toLocaleString()}</span>
              <span className="text-[11px] text-[#8a8a9b]">Total Activity</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
            {data.map((d) => (
              <div key={d.key} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="truncate text-xs text-[#c4c4d4]">{d.label}</span>
                <span className="ml-auto text-xs font-medium tabular-nums text-white/70">{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
