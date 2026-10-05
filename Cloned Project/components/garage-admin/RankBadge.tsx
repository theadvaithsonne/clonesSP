"use client";

// Shared rank + status pills for the Rank Bonus admin surface.
//
// Colours follow the metal each rank is named after so a table of hundreds of
// rows is scannable at a glance without reading the label.

const RANK_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  Bronze: { bg: "bg-[#7C4A21]/25", text: "text-[#D08B4F]", ring: "ring-[#7C4A21]/40" },
  Silver: { bg: "bg-[#8A8F98]/20", text: "text-[#C7CBD1]", ring: "ring-[#8A8F98]/40" },
  Gold: { bg: "bg-[#FFC200]/15", text: "text-[#FFC200]", ring: "ring-[#FFC200]/35" },
  Diamond: { bg: "bg-[#3FA9F5]/15", text: "text-[#6FC3FF]", ring: "ring-[#3FA9F5]/35" },
  Platinum: { bg: "bg-[#A78BFA]/15", text: "text-[#C4B0FF]", ring: "ring-[#A78BFA]/35" },
};

export function RankBadge({
  rank,
  size = "sm",
}: {
  rank?: string | null;
  size?: "sm" | "md";
}) {
  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  if (!rank) {
    return (
      <span
        className={`inline-flex items-center rounded-full ${pad} font-medium text-zinc-600 ring-1 ring-inset ring-white/[0.06]`}
      >
        No rank
      </span>
    );
  }
  const s = RANK_STYLES[rank] ?? RANK_STYLES.Bronze;
  return (
    <span
      className={`inline-flex items-center rounded-full ${pad} font-semibold ${s.bg} ${s.text} ring-1 ring-inset ${s.ring}`}
    >
      {rank}
    </span>
  );
}

export function ActivePill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        active
          ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/25"
          : "bg-zinc-500/10 text-zinc-500 ring-white/[0.06]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-400" : "bg-zinc-600"
        }`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/** Why someone is inactive — the answer to "but I paid". */
export function SubReasonPill({ reason }: { reason: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active_paid: {
      label: "Active paid",
      cls: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/25",
    },
    free_month_only: {
      label: "Free month only",
      cls: "bg-amber-500/10 text-amber-400 ring-amber-500/25",
    },
    lapsed: {
      label: "Lapsed",
      cls: "bg-rose-500/10 text-rose-400 ring-rose-500/25",
    },
    never_subscribed: {
      label: "Never subscribed",
      cls: "bg-zinc-500/10 text-zinc-500 ring-white/[0.06]",
    },
  };
  const s = map[reason] ?? map.never_subscribed;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export function PayoutStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/25",
    pending: "bg-sky-500/10 text-sky-400 ring-sky-500/25",
    skipped_dry_run: "bg-zinc-500/10 text-zinc-400 ring-white/[0.06]",
    failed: "bg-rose-500/10 text-rose-400 ring-rose-500/25",
  };
  const label =
    status === "skipped_dry_run"
      ? "Dry run"
      : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        map[status] ?? map.pending
      }`}
    >
      {label}
    </span>
  );
}
