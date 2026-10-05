"use client";

import { cn } from "@/lib/utils";
import type { DsAnalyticsRange } from "@/lib/docusign/types";

const RANGES: { value: DsAnalyticsRange; label: string }[] = [
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
];

export function DateRangeToggle({ value, onChange }: { value: DsAnalyticsRange; onChange: (range: DsAnalyticsRange) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a35] bg-[#111116] p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onChange(r.value)}
          aria-pressed={value === r.value}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === r.value ? "bg-brand text-[#141414]" : "text-[#8a8a9b] hover:text-white/80"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
