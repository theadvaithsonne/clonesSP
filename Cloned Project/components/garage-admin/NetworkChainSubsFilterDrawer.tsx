"use client";

// Filter drawer for the NetworkChain Subs table. Modeled on NC's
// DownlineFilterDrawer (field-list → per-field screen morph) but scoped to
// the one filter the admin cares about today:
//   - Started: date-range preset OR custom from/to
// There is no status filter: the table is active subscriptions only (the
// backend enforces it), so there is nothing to choose between.
// Backend contract: `?startedFrom=YYYY-MM-DD&startedTo=YYYY-MM-DD`.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Hourglass,
  Trash2,
  X,
} from "lucide-react";

export type SubStatus = "active" | "cancelled" | "expired" | "pending";
export interface NcSubsFilters {
  startedFrom?: string;
  startedTo?: string;
}

type FieldId = "started";

const DATE_PRESETS: { label: string; days: number | null }[] = [
  { label: "Any start date", days: null },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last year", days: 365 },
];

export function NetworkChainSubsFilterDrawer({
  open,
  onClose,
  filters,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  filters: NcSubsFilters;
  onApply: (f: NcSubsFilters) => void;
}) {
  // Draft state so navigating between screens doesn't commit anything until
  // the user hits Apply.
  const [draft, setDraft] = useState<NcSubsFilters>(filters);
  const [screen, setScreen] = useState<FieldId | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setDraft(filters);
      setScreen(null);
    }
  }, [open, filters]);

  const anyActive = !!draft.startedFrom || !!draft.startedTo;

  const summaries = {
    started: dateSummary(draft.startedFrom, draft.startedTo),
  };

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
            className="mr-6 flex h-[calc(100vh-48px)] w-[400px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e12] shadow-2xl"
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
                  {screen === null ? "Filters" : "Subscription started"}
                </h2>
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
                      id: "started",
                      label: "Subscription started",
                      icon: Calendar,
                      value: summaries.started,
                      active: !!draft.startedFrom || !!draft.startedTo,
                    },
                  ]}
                  onOpen={setScreen}
                />
              )}

              {screen === "started" && (
                <StartedScreen
                  from={draft.startedFrom}
                  to={draft.startedTo}
                  onChange={(next) =>
                    setDraft((d) => ({
                      ...d,
                      startedFrom: next.from,
                      startedTo: next.to,
                    }))
                  }
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setDraft({});
                  onApply({});
                  onClose();
                }}
                disabled={!anyActive}
                className="text-sm text-zinc-400 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-400"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply(draft);
                  onClose();
                }}
                className="flex h-9 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
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
    icon: typeof CheckCircle2;
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
                it.active
                  ? "bg-brand/15 text-brand"
                  : "bg-white/[0.03] text-zinc-400"
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-white">
                {it.label}
              </div>
              <div className="truncate text-[12px] text-zinc-400">
                {it.value}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
          </button>
        );
      })}
    </div>
  );
}

function StartedScreen({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (next: { from?: string; to?: string }) => void;
}) {
  const activePreset = presetForRange(from, to);
  return (
    <div className="flex flex-col">
      {DATE_PRESETS.map((p) => {
        const on = p.label === activePreset;
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              if (p.days == null) return onChange({ from: undefined, to: undefined });
              const now = new Date();
              const fromD = new Date(now);
              fromD.setDate(now.getDate() - p.days);
              onChange({
                from: fromD.toISOString().slice(0, 10),
                to: now.toISOString().slice(0, 10),
              });
            }}
            className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.02]"
          >
            <span className="flex-1 text-[13px] text-white">{p.label}</span>
            {on && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3 text-black"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        );
      })}

      {/* Custom */}
      <div className="px-5 py-4">
        <div className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">
          Custom range
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[12px] text-zinc-400">
            From
            <input
              type="date"
              value={from ?? ""}
              onChange={(e) =>
                onChange({ from: e.target.value || undefined, to })
              }
              className="h-9 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-white outline-none focus:border-white/[0.2]"
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-zinc-400">
            To
            <input
              type="date"
              value={to ?? ""}
              onChange={(e) =>
                onChange({ from, to: e.target.value || undefined })
              }
              className="h-9 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-white outline-none focus:border-white/[0.2]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

/* ── formatting ── */

function dateSummary(from?: string, to?: string): string {
  if (!from && !to) return "Any start date";
  const preset = presetForRange(from, to);
  if (preset && preset !== "Any start date") return preset;
  if (from && to) return `${from} → ${to}`;
  if (from) return `From ${from}`;
  return `Until ${to}`;
}

function presetForRange(from?: string, to?: string): string {
  if (!from && !to) return "Any start date";
  if (!from || !to) return "";
  const now = new Date();
  const nowIso = now.toISOString().slice(0, 10);
  if (to !== nowIso) return "";
  const days = Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
  );
  const match = DATE_PRESETS.find((p) => p.days === days);
  return match?.label ?? "";
}
