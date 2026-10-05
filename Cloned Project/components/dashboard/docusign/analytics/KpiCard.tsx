"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DsAnalyticsKpi } from "@/lib/docusign/types";

export function KpiCard({
  label,
  kpi,
  color = "#FBD10D",
  loading,
}: {
  label: string;
  kpi: DsAnalyticsKpi | null;
  color?: string;
  loading?: boolean;
}) {
  const gradientId = useId();
  const value = kpi?.value ?? 0;
  const change = kpi?.change ?? null;
  const trend = kpi?.trend ?? [];
  const hasTrend = trend.length > 1;

  return (
    <div className="rounded-2xl border border-[#2a2a35] bg-[#111116] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[#8a8a9b]">{label}</p>
          {loading ? (
            <div className="mt-1.5 h-7 w-16 animate-pulse rounded bg-white/[0.06]" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white/95">{value.toLocaleString()}</p>
          )}
          {!loading && change !== null && (
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-xs font-medium",
                change > 0 ? "text-emerald-400" : change < 0 ? "text-red-400" : "text-[#8a8a9b]"
              )}
            >
              {change > 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : change < 0 ? (
                <ArrowDownRight className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {Math.abs(change)}%
            </p>
          )}
        </div>
        {!loading && hasTrend && (
          <div className="h-12 w-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="count" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
