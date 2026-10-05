"use client";

import * as React from "react";
import { ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    color?: string;
  };
};

type ChartContextProps = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within <ChartContainer />");
  return ctx;
}

// ── ChartContainer ─────────────────────────────────────────────────────────────

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof ResponsiveContainer>["children"];
}) {
  const uid = React.useId();
  const chartId = `chart-${id ?? uid.replace(/:/g, "")}`;

  // Build --color-<key> CSS variables from config
  const style = Object.entries(config).reduce<Record<string, string>>((acc, [key, val]) => {
    if (val.color) acc[`--color-${key}`] = val.color;
    return acc;
  }, {});

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn("flex justify-center text-xs", className)}
        style={style}
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

// ── ChartTooltipContent ────────────────────────────────────────────────────────

function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  formatter,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  className?: string;
  formatter?: (value: any, name: string) => React.ReactNode;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-[#2a2a35] bg-[#0e0e12] px-3 py-2 text-xs shadow-xl",
        className
      )}
    >
      {label && (
        <p className="font-semibold text-white mb-1.5">{label}</p>
      )}
      {payload.map((item: any, i: number) => {
        const cfg = config[item.dataKey as string];
        const color = item.fill ?? item.stroke ?? cfg?.color ?? "var(--brand)";
        const displayLabel = cfg?.label ?? item.name ?? item.dataKey;
        const displayValue = formatter
          ? formatter(item.value, item.dataKey)
          : item.value?.toLocaleString();
        return (
          <div key={i} className="flex items-center gap-2 mt-1">
            <span
              className="h-2 w-2 rounded-sm shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-[#9fa0b8]">{displayLabel}</span>
            <span className="font-semibold text-white ml-auto pl-3">{displayValue}</span>
          </div>
        );
      })}
    </div>
  );
}

// Re-export Tooltip as ChartTooltip for ergonomics
const ChartTooltip = Tooltip;

export { ChartContainer, ChartTooltip, ChartTooltipContent, useChart };
