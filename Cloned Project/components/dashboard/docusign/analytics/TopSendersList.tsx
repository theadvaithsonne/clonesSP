"use client";

import { Avatar } from "@/components/ui/data-table/cells";
import type { DsAnalyticsSummary } from "@/lib/docusign/types";

export function TopSendersList({ senders, loading }: { senders: DsAnalyticsSummary["topSenders"] | null; loading?: boolean }) {
  const rows = senders ?? [];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#2a2a35] bg-[#111116] p-5">
      <h3 className="text-sm font-semibold text-white/90">Top Senders</h3>
      <div className="mt-3 flex-1 space-y-3.5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-white/[0.04]" />)
        ) : !rows.length ? (
          <div className="flex h-full items-center justify-center text-xs text-[#8a8a9b]">No documents sent yet</div>
        ) : (
          rows.map((s) => (
            <div key={s.userId} className="flex items-center gap-3">
              <Avatar src={s.image} name={s.name} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-[#c4c4d4]">{s.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-[#8a8a9b]">
                    {s.count} ({s.percent}%)
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#2f2f3a]"
                  role="meter"
                  aria-valuenow={s.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${s.name}: ${s.count} documents sent, ${s.percent}% of total`}
                >
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
                    style={{ width: `${s.percent}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
