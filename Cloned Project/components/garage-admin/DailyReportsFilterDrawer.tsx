"use client";

// Filter drawer for the Daily Reports table. Same shell as
// NetworkChainSubsFilterDrawer (field list → per-field screen), with:
//   - Date range: presets on IST calendar days + a real two-month range
//     calendar (components/ui/range-calendar) instead of native date inputs.
//     The page always has a range; "Reset" returns to the default window
//     (yesterday → today, IST) rather than clearing it.
//   - Kind: Founders Office / Unilevel Plus / Crypto white-label.
// Backend contract: `?from=YYYY-MM-DD&to=YYYY-MM-DD&kind=office|unilevel|whitelabel`.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Calendar, ChevronRight, Check, Layers, Users, X } from "lucide-react";
import { RangeCalendar } from "@/components/ui/range-calendar";
import { DownlineScreen } from "@/components/garage-admin/downline-scope";
import {
  RANGE_PRESETS,
  KIND_LABEL,
  defaultRange,
  istToday,
  presetForRange,
  rangeSummary,
  type DailyReportKind,
  type DailyReportsFilters,
} from "@/lib/admin-api/daily-reports";

export type { DailyReportsFilters };

type FieldId = "range" | "kind" | "downline";

export function DailyReportsFilterDrawer({
  open,
  onClose,
  filters,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  filters: DailyReportsFilters;
  onApply: (next: DailyReportsFilters) => void;
}) {
  const [draft, setDraft] = useState<DailyReportsFilters>(filters);
  const [screen, setScreen] = useState<FieldId | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setDraft(filters);
      setScreen(null);
    }
  }, [open, filters]);

  const def = defaultRange();
  const isDefault =
    draft.from === def.from && draft.to === def.to && !draft.kind && !draft.downlineOf;
  // A half-picked custom range must not be applied.
  const rangeValid = !!draft.from && !!draft.to && draft.from <= draft.to;

  const body = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-end bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            // Two month grids side by side need the room — same widening the
            // analytics drawer does when its calendar is open.
            className={`mr-6 flex h-[calc(100vh-48px)] max-w-[94vw] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e12] shadow-2xl transition-[width] ${
              screen === "range" ? "w-[620px]" : "w-[400px]"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-3">
                {screen !== null && (
                  <button
                    type="button"
                    onClick={() => setScreen(null)}
                    className="rounded p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <h2 className="text-sm font-semibold text-white">
                  {screen === null
                    ? "Filters"
                    : screen === "range"
                      ? "Date range"
                      : screen === "kind"
                        ? "Sale type"
                        : "Downline / Sponsor"}
                </h2>
                {screen === "range" && (
                  <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    IST days
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {screen === null && (
                <FieldList
                  items={[
                    {
                      id: "range",
                      label: "Date range",
                      icon: Calendar,
                      value: rangeValid ? rangeSummary(draft.from, draft.to) : "Pick a range",
                      active: !(draft.from === def.from && draft.to === def.to),
                    },
                    {
                      id: "kind",
                      label: "Sale type",
                      icon: Layers,
                      value: draft.kind ? KIND_LABEL[draft.kind] : "All sales",
                      active: !!draft.kind,
                    },
                    {
                      id: "downline",
                      label: "Downline / Sponsor",
                      icon: Users,
                      value:
                        (draft.downlineOf
                          ? (draft.downlineOf.name || draft.downlineOf.email || "Selected person") +
                            (draft.excludedUsers?.length
                              ? draft.excludedUsers.length === 1
                                ? ` — except ${
                                    draft.excludedUsers[0].name ||
                                    draft.excludedUsers[0].email ||
                                    "one leg"
                                  }`
                                : ` — except ${draft.excludedUsers.length} legs`
                              : "")
                          : "") || "Everyone",
                      active: !!draft.downlineOf,
                    },
                  ]}
                  onOpen={setScreen}
                />
              )}

              {screen === "range" && (
                <RangeScreen
                  from={draft.from}
                  to={draft.to}
                  onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
                />
              )}

              {screen === "kind" && (
                <KindScreen
                  selected={draft.kind}
                  onChange={(kind) => setDraft((d) => ({ ...d, kind }))}
                />
              )}

              {screen === "downline" && (
                <DownlineScreen
                  selected={draft.downlineOf ?? null}
                  onChange={(person) =>
                    setDraft((d) => ({
                      ...d,
                      downlineOf: person,
                      // Clearing the root clears its exceptions — they mean
                      // nothing without a tree to take them out of.
                      ...(person ? {} : { excludedUsers: undefined }),
                    }))
                  }
                  excluded={draft.excludedUsers ?? []}
                  onChangeExcluded={(people) =>
                    setDraft((d) => ({ ...d, excludedUsers: people.length ? people : undefined }))
                  }
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  const next = { ...defaultRange() };
                  setDraft(next);
                  onApply(next);
                  onClose();
                }}
                disabled={isDefault}
                className="text-sm text-zinc-400 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-400"
              >
                Reset to yesterday → today
              </button>
              <button
                type="button"
                disabled={!rangeValid}
                onClick={() => {
                  onApply(draft);
                  onClose();
                }}
                className="flex h-9 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(body, document.body);
}

/* ── Screens ── */

function FieldList({
  items,
  onOpen,
}: {
  items: Array<{
    id: FieldId;
    label: string;
    icon: typeof Calendar;
    value: string;
    active: boolean;
  }>;
  onOpen: (id: FieldId) => void;
}) {
  return (
    <div className="flex flex-col">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onOpen(it.id)}
            className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-white/[0.02]"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                it.active ? "bg-brand/15 text-brand" : "bg-white/[0.03] text-zinc-400"
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-white">{it.label}</div>
              <div className="truncate text-[12px] text-zinc-400">{it.value}</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
          </button>
        );
      })}
    </div>
  );
}

function GoldCheck() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand">
      <Check className="h-3 w-3 text-brand-foreground" strokeWidth={3} />
    </span>
  );
}

/**
 * Presets first (one tap), the calendar under them for anything else.
 * Picking in the calendar simply makes the range "custom"; there is no
 * separate mode to switch into.
 */
function RangeScreen({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
}) {
  const active = presetForRange(from, to);
  return (
    <div className="flex flex-col">
      {RANGE_PRESETS.map((p) => {
        const on = active === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.range())}
            className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-3 text-left transition-colors hover:bg-white/[0.02]"
          >
            <span className="flex-1 text-[13px] text-white">{p.label}</span>
            {on && <GoldCheck />}
          </button>
        );
      })}

      <div className="border-b border-white/[0.04] px-5 pb-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">Custom range</div>
          {active === "custom" && <GoldCheck />}
        </div>
        <RangeCalendar
          start={from}
          end={to}
          maxIso={istToday()}
          onChange={(next) => onChange({ from: next.start, to: next.end })}
        />
        <div className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          Days run midnight to midnight, India time. Today ends now.
        </div>
      </div>
    </div>
  );
}

function KindScreen({
  selected,
  onChange,
}: {
  selected?: DailyReportKind;
  onChange: (kind?: DailyReportKind) => void;
}) {
  const options: Array<{ id: DailyReportKind | ""; label: string; hint: string }> = [
    { id: "", label: "All sales", hint: "Office, Unilevel Plus, NetworkChain and white-label together" },
    { id: "office", label: KIND_LABEL.office, hint: "New subscriptions and paid renewals" },
    { id: "unilevel", label: KIND_LABEL.unilevel, hint: "$25 licence, combos, reserve seats" },
    { id: "networkchain", label: KIND_LABEL.networkchain, hint: "Subscriptions paid on their own — first cycles and renewals" },
    { id: "whitelabel", label: KIND_LABEL.whitelabel, hint: "White-label and Cryptosub add-ons" },
  ];
  return (
    <div className="flex flex-col">
      {options.map((o) => {
        const on = (selected || "") === o.id;
        return (
          <button
            key={o.id || "all"}
            type="button"
            onClick={() => onChange(o.id === "" ? undefined : o.id)}
            className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.02]"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-white">{o.label}</div>
              <div className="text-[11px] text-zinc-500">{o.hint}</div>
            </div>
            {on && <GoldCheck />}
          </button>
        );
      })}
    </div>
  );
}
