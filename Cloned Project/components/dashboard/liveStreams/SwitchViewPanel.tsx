"use client";

/**
 * The founder console's view switcher — a two-step docked panel.
 *
 * Step 1 "Switch View"            → One Time (n) / Recurring (n)
 * Step 2 "Recurring Live Streams" → pick WHICH series' sessions to table
 *
 * Recurring needs the second step because the two views answer different
 * questions: One Time lists streams, Recurring lists the SESSIONS of one
 * series. Without the picker there would be nothing to say which series the
 * session rows belong to.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, RefreshCw, Repeat1 } from "lucide-react";
import type { FounderRecurringSeries, FounderStreamView } from "@/lib/feed-api";
import { Avatar } from "./founderStreamCells";
import {
  DrawerCard,
  DrawerListSkeleton,
  DrawerShell,
  SeriesPickerSkeleton,
} from "./DrawerShell";

export function SwitchViewPanel({
  open,
  onClose,
  view,
  counts,
  series,
  selectedSeriesId,
  loading,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  view: FounderStreamView;
  counts: { oneTime: number; recurring: number };
  series: FounderRecurringSeries[];
  selectedSeriesId: string | null;
  /** The table's first fetch hasn't landed, so the counts and the series list
   *  aren't known yet. Rendering "One Time (0)" while it loads would be a
   *  wrong number, not a pending one. */
  loading?: boolean;
  /** Fired with the chosen view; `seriesId` is set only for recurring. */
  onPick: (view: FounderStreamView, seriesId?: string) => void;
}) {
  const [step, setStep] = useState<"root" | "series">("root");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // Reopening should always land on the first step — a panel that reopens
  // two levels deep is disorienting.
  useEffect(() => {
    if (open) {
      setStep("root");
      setQuery("");
      setSearching(false);
    }
  }, [open]);

  // Title OR host — a founder running several series often remembers who
  // hosts one before they remember what it's called. Each row already states
  // its enrolment type, so there is no separate control for it.
  const filteredSeries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return series;
    return series.filter((s) =>
      `${s.title} ${s.host?.name ?? ""}`.toLowerCase().includes(q),
    );
  }, [series, query]);

  return (
    <DrawerShell
      open={open}
      title={step === "root" ? "Switch View" : "Recurring Live Streams"}
      onBack={() => (step === "series" ? setStep("root") : onClose())}
      onClose={onClose}
      searching={searching}
      onToggleSearch={() => setSearching((v) => !v)}
      searchValue={query}
      onSearchChange={setQuery}
      searchPlaceholder={step === "root" ? "Search views…" : "Search series…"}
      loading={loading}
      skeleton={
        step === "root" ? <DrawerListSkeleton rows={2} /> : <SeriesPickerSkeleton />
      }
    >
      {step === "root" ? (
        <DrawerCard>
          <ViewRow
            icon={<Repeat1 className="h-[22px] w-[22px] text-white/85" />}
            title="One Time"
            count={counts.oneTime}
            subtitle="See all the one time live streams"
            selected={view === "one-time"}
            onClick={() => {
              onPick("one-time");
              onClose();
            }}
          />
          <ViewRow
            icon={<RefreshCw className="h-[22px] w-[22px] text-white/85" />}
            title="Recurring"
            count={counts.recurring}
            subtitle="Select from one of your recurring live stream series"
            selected={view === "recurring"}
            chevron
            onClick={() => setStep("series")}
          />
        </DrawerCard>
      ) : filteredSeries.length === 0 ? (
        <div className="rim-light rounded-2xl bg-[#18181B]/80 px-4 py-16 text-center text-[13px] text-white/45">
          {series.length === 0
            ? "No recurring live streams yet."
            : "No series match that search."}
        </div>
      ) : (
        <DrawerCard>
          {filteredSeries.map((s) => (
            <button
              key={s._id}
              type="button"
              onClick={() => {
                onPick("recurring", s._id);
                onClose();
              }}
              className="flex w-full cursor-pointer items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-white/[0.04]"
            >
              {/* Same rule as the header chip: these rows are live streams,
                  so they wear the stream's cover, not the host's face. */}
              <Avatar
                src={s.thumbnail}
                name={s.title}
                className="h-9 w-9"
                rounded="rounded-[8px]"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold text-white">
                  {s.title}
                </div>
                <div className="truncate text-[13px] text-white/45">
                  {s.totalSessions} Session{s.totalSessions === 1 ? "" : "s"} |{" "}
                  {s.enrollmentType === "per_session"
                    ? "Enrollment Per Session"
                    : "Enrollment One Time"}
                </div>
              </div>
              {selectedSeriesId === s._id ? (
                <SelectedDot />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
              )}
            </button>
          ))}
        </DrawerCard>
      )}
    </DrawerShell>
  );
}

function ViewRow({
  icon,
  title,
  count,
  subtitle,
  selected,
  chevron,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  subtitle: string;
  selected: boolean;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-white/[0.04]"
    >
      <span className="grid w-[22px] shrink-0 place-items-center">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-white">
          {title} <span className="text-white/40">({count})</span>
        </div>
        <div className="truncate text-[13px] text-white/45">{subtitle}</div>
      </div>
      {selected ? (
        <SelectedDot />
      ) : chevron ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
      ) : null}
    </button>
  );
}

function SelectedDot() {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand">
      <Check className="h-3 w-3 text-brand-foreground" strokeWidth={3} />
    </span>
  );
}
