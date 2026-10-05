"use client";

// Right-side detail sheet for the one-time-affiliate profile's Communities
// tab — opened by the `>` on the Price and Comp Plan cells. Price shows
// currency/frequency/amount/taxes; Comp Plan pages through the channel's
// commission levels.
// Ported from NetworkChains' components/downline/community-detail-drawer.tsx
// (import path swapped to the ported lib/affiliate/downline-profile-api).

import { useEffect, useState } from "react";
import { X, Globe, CalendarDays, AlarmClock, Flag } from "lucide-react";
import type { MemberCommunityItem } from "@/lib/affiliate/downline-profile-api";

export type CommunityDrawer = { kind: "price" | "comp"; row: MemberCommunityItem };

function periodLabel(p: string | null | undefined): string {
  if (!p) return "One-time";
  const s = p.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1); // "monthly" → "Monthly"
}
function money(n: number, currency: string): string {
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(n || 0);
  } catch {
    return `${(n || 0).toFixed(2)} ${code}`;
  }
}

function DetailRow({
  icon: Icon,
  label,
  value,
  last,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3.5 px-4 py-4 ${last ? "" : "border-b border-white/[0.06]"}`}>
      <Icon className="h-5 w-5 shrink-0 text-zinc-300" />
      <div className="min-w-0">
        <div className="text-[12px] text-zinc-500">{label}</div>
        <div className="truncate text-[15px] font-medium text-white">{value}</div>
      </div>
    </div>
  );
}

export function CommunityDetailDrawer({
  drawer,
  onClose,
}: {
  drawer: CommunityDrawer | null;
  onClose: () => void;
}) {
  const [levelIdx, setLevelIdx] = useState(0);

  // Reset paging + wire Escape whenever a drawer opens.
  useEffect(() => {
    setLevelIdx(0);
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, onClose]);

  if (!drawer) return null;
  const { kind, row } = drawer;
  const title = kind === "price" ? "Price Details" : "Comp Plan";
  const taxes = "18% GST On Top";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-white/[0.08] bg-[#0e0e12] shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.12] text-zinc-300 transition hover:bg-white/[0.05]"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="flex-1 pr-9 text-center text-lg font-semibold text-white">{title}</h3>
        </div>

        <div className="px-5">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            {kind === "price" ? (
              <>
                <DetailRow icon={Flag} label="Currency" value={(row.currency || "USD").toUpperCase()} />
                <DetailRow icon={Globe} label="Frequency" value={periodLabel(row.subscriptionPeriod)} />
                <DetailRow icon={CalendarDays} label="Amount" value={row.isFree ? "Free" : (row.price ?? 0).toFixed(2)} />
                <DetailRow icon={AlarmClock} label="Taxes" value={taxes} last />
              </>
            ) : (
              <CompLevel row={row} idx={levelIdx} taxes={taxes} />
            )}
          </div>

          {kind === "comp" && (row.compLevels?.length ?? 0) > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {(row.compLevels ?? []).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Level ${i + 1}`}
                  onClick={() => setLevelIdx(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === levelIdx ? "w-5 bg-[#3b82f6]" : "w-2 bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function CompLevel({
  row,
  idx,
  taxes,
}: {
  row: MemberCommunityItem;
  idx: number;
  taxes: string;
}) {
  const lvl = (row.compLevels ?? [])[idx];
  if (!lvl) {
    return (
      <div className="px-4 py-8 text-center text-sm text-zinc-500">
        No commission plan on this community.
      </div>
    );
  }
  const levelAmount = ((lvl.percentage / 100) * (row.price || 0)); // per-level payout
  return (
    <>
      {/* Level headline: % badge + payout */}
      <div className="flex items-center gap-3.5 border-b border-white/[0.06] px-4 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-[11px] font-semibold text-white">
          {lvl.percentage}%
        </span>
        <div className="min-w-0">
          <div className="text-[12px] text-zinc-500">Level {lvl.level}</div>
          <div className="truncate text-[15px] font-medium text-white">{money(levelAmount, row.currency)}</div>
        </div>
      </div>
      <DetailRow icon={Globe} label="Frequency" value={periodLabel(row.subscriptionPeriod)} />
      <DetailRow icon={CalendarDays} label="Amount" value={(row.price ?? 0).toFixed(2)} />
      <DetailRow icon={AlarmClock} label="Taxes" value={taxes} last />
    </>
  );
}
