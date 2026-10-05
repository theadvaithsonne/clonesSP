"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Calendar, Check, ChevronRight, Search, X } from "lucide-react";
import { DUR, EASE, SPRING } from "./motion";

/**
 * The shared, Bigin-style typed filter drawer — generalized from the downline
 * drawer. It owns the shell (portal, backdrop, expo slide-in, search-morph
 * header, spring nav-stack list → value screen); each PAGE supplies a schema of
 * `FilterField`s (build them with facetField / numericRangeField / dateRangeField
 * below). The drawer edits a `draft` copy and commits it via onApply only when
 * the user hits the gold check — identical to the downline behaviour.
 *
 * `D` is the page's filter object (any shape). Fields read/write it through the
 * closures they capture, so the drawer stays fully domain-agnostic.
 */
export interface FilterField<D> {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Collapsed row summary, e.g. "All roles" / "Stakeholder". */
  summary: (draft: D) => string;
  active: (draft: D) => boolean;
  /** Optional number badge on the field row (e.g. a selected level). */
  badge?: (draft: D) => number | string | undefined;
  /** Facets offer the header value-search; ranges don't. */
  searchable?: boolean;
  /** Render the value editor for this field. */
  render: (ctx: {
    draft: D;
    setDraft: (d: D) => void;
    query: string;
    close: () => void;
  }) => React.ReactNode;
}

export function FilterDrawer<D>({
  open,
  onClose,
  title = "Filters",
  fields,
  value,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  fields: FilterField<D>[];
  value: D;
  onApply: (d: D) => void;
}) {
  const [draft, setDraft] = useState<D>(value);
  const [screen, setScreen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setDraft(value);
      setScreen(null);
      setQuery("");
      setSearching(false);
    }
  }, [open, value]);

  if (!mounted) return null;

  const field = screen ? fields.find((f) => f.id === screen) ?? null : null;
  const apply = () => {
    onApply(draft);
    onClose();
  };
  const back = () => {
    setScreen(null);
    setSearching(false);
    setQuery("");
  };
  const heading = field?.label ?? title;
  const canSearch = !!field?.searchable;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.base }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: DUR.drawer, ease: EASE.expo }}
            className="absolute right-0 top-0 flex h-full w-[min(470px,92vw)] flex-col p-4"
          >
            <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#0c0c0c]/95 backdrop-blur-2xl">
              {/* Header — morphs: [Back · title · Search/✓] ⇄ [full-width Search · X] */}
              <div className="relative flex h-[68px] items-center px-4">
                <AnimatePresence initial={false} mode="wait">
                  {field && searching && canSearch ? (
                    <motion.div
                      key="search"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: DUR.fast }}
                      className="flex w-full items-center gap-2"
                    >
                      <motion.div
                        initial={{ width: "58%", opacity: 0.4 }}
                        animate={{ width: "100%", opacity: 1 }}
                        transition={{ duration: DUR.morph, ease: EASE.expo }}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-4"
                      >
                        <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                        <input
                          autoFocus
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search All"
                          className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                        />
                      </motion.div>
                      <button
                        type="button"
                        onClick={() => {
                          setSearching(false);
                          setQuery("");
                        }}
                        aria-label="Close search"
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.02] text-zinc-200 transition hover:bg-white/[0.06]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="normal"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: DUR.fast }}
                      className="flex w-full items-center justify-between"
                    >
                      <button
                        type="button"
                        onClick={screen ? back : onClose}
                        className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-white/[0.02] text-zinc-200 transition hover:bg-white/[0.06]"
                        aria-label={screen ? "Back" : "Close filters"}
                      >
                        {screen ? <ArrowLeft className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      </button>
                      <h2 className="text-[17px] font-semibold text-white">{heading}</h2>
                      {screen ? (
                        canSearch ? (
                          <button
                            type="button"
                            onClick={() => setSearching(true)}
                            className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-white/[0.02] text-zinc-200 transition hover:bg-white/[0.06]"
                            aria-label="Search values"
                          >
                            <Search className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="h-11 w-11" />
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={apply}
                          className="grid h-11 w-11 place-items-center rounded-full bg-brand text-brand-foreground transition hover:bg-[color:color-mix(in_srgb,var(--brand)_83%,white)]"
                          aria-label="Apply filters"
                        >
                          <Check className="h-5 w-5" strokeWidth={2.6} />
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative min-h-0 flex-1">
                <AnimatePresence initial={false} mode="popLayout">
                  {screen === null ? (
                    <motion.div
                      key="list"
                      initial={{ x: -40, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -40, opacity: 0 }}
                      transition={SPRING}
                      className="glass-scrollbar absolute inset-0 overflow-y-auto px-4 pb-4"
                    >
                      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.012]">
                        {fields.map((f, i) => {
                          const badge = f.badge?.(draft);
                          const active = f.active(draft);
                          const Icon = f.icon;
                          return (
                            <button
                              key={f.id}
                              onClick={() => {
                                setScreen(f.id);
                                setQuery("");
                              }}
                              className={`flex w-full items-center gap-3.5 px-4 py-4 text-left transition hover:bg-white/[0.03] ${
                                i > 0 ? "border-t border-white/[0.05]" : ""
                              }`}
                            >
                              {active && badge != null ? (
                                <NumberBadge n={badge} gold />
                              ) : Icon ? (
                                <Icon className="h-5 w-5 shrink-0 text-zinc-400" />
                              ) : (
                                <span className="h-5 w-5 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-medium text-white">{f.label}</div>
                                <div
                                  className={`truncate text-[13px] ${
                                    active ? "text-white" : "text-zinc-500"
                                  }`}
                                >
                                  {f.summary(draft)}
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={screen}
                      initial={{ x: 60, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 60, opacity: 0 }}
                      transition={SPRING}
                      className="absolute inset-0 flex flex-col px-4 pb-4"
                    >
                      <div className="glass-scrollbar min-h-0 flex-1 overflow-y-auto">
                        {field?.render({ draft, setDraft, query, close: back })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ── Shared value-screen primitives (exported for custom field renderers) ───────

export function NumberBadge({ n, gold }: { n: number | string; gold?: boolean }) {
  return (
    <span
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${
        gold
          ? "bg-brand/15 text-brand ring-1 ring-brand/40"
          : "bg-white/[0.04] text-zinc-300 ring-1 ring-white/[0.08]"
      }`}
    >
      {n}
    </span>
  );
}

export function ValueRow({
  badge,
  title,
  sub,
  selected,
  first,
  onClick,
}: {
  badge?: React.ReactNode;
  title: string;
  sub?: string;
  selected?: boolean;
  first?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3.5 px-4 py-4 text-left transition ${
        first ? "" : "border-t border-white/[0.05]"
      } ${selected ? "bg-white/[0.04]" : "hover:bg-white/[0.025]"}`}
    >
      {badge && <span className="shrink-0">{badge}</span>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-white">{title}</div>
        {sub && <div className="truncate text-[13px] text-zinc-500">{sub}</div>}
      </div>
      {selected && <Check className="h-4 w-4 shrink-0 text-brand" />}
    </button>
  );
}

export function FilterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.012]">
      {children}
    </div>
  );
}

export function NoMatch() {
  return <div className="px-4 py-8 text-center text-[13px] text-zinc-600">No matches</div>;
}

// ── Field builders ─────────────────────────────────────────────────────────────

export interface FacetOption {
  value: string;
  label: string;
  sub?: string;
  badge?: React.ReactNode;
}

/** A categorical facet field (single- or multi-select) with a value+count list —
 *  the downline "Level/Location/Type" pattern, generalized. */
export function facetField<D>(cfg: {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  allLabel?: string;
  multi?: boolean;
  /** Value options, filtered by the header search query. */
  options: (query: string) => FacetOption[];
  /** Currently-selected values. */
  selected: (draft: D) => Set<string>;
  /** Write the selected set back into the draft. */
  apply: (draft: D, values: Set<string>) => D;
}): FilterField<D> {
  const allLabel = cfg.allLabel ?? `All ${cfg.label.toLowerCase()}`;
  return {
    id: cfg.id,
    label: cfg.label,
    icon: cfg.icon,
    searchable: true,
    active: (d) => cfg.selected(d).size > 0,
    badge: (d) => {
      const n = cfg.selected(d).size;
      return n > 0 && cfg.multi ? n : undefined;
    },
    summary: (d) => {
      const sel = cfg.selected(d);
      if (sel.size === 0) return allLabel;
      if (sel.size === 1) {
        const only = [...sel][0];
        return cfg.options("").find((o) => o.value === only)?.label ?? only;
      }
      return `${sel.size} selected`;
    },
    render: ({ draft, setDraft, query, close }) => {
      const sel = cfg.selected(draft);
      const q = query.trim().toLowerCase();
      const opts = cfg.options(query);
      const pick = (value: string) => {
        const next = new Set(sel);
        if (cfg.multi) {
          if (next.has(value)) next.delete(value);
          else next.add(value);
          setDraft(cfg.apply(draft, next));
        } else {
          setDraft(cfg.apply(draft, new Set([value])));
          close();
        }
      };
      return (
        <FilterCard>
          {!q && (
            <ValueRow
              first
              badge={<NumberBadge n={opts.length} />}
              title={allLabel}
              selected={sel.size === 0}
              onClick={() => {
                setDraft(cfg.apply(draft, new Set()));
                if (!cfg.multi) close();
              }}
            />
          )}
          {opts.map((o, i) => (
            <ValueRow
              key={o.value}
              first={!!q && i === 0}
              badge={o.badge ?? <NumberBadge n={o.label.charAt(0).toUpperCase()} />}
              title={o.label}
              sub={o.sub}
              selected={sel.has(o.value)}
              onClick={() => pick(o.value)}
            />
          ))}
          {opts.length === 0 && <NoMatch />}
        </FilterCard>
      );
    },
  };
}

/** A numeric min/max range field (e.g. payments, days-remaining). */
export function numericRangeField<D>(cfg: {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  unit?: string;
  get: (draft: D) => { min?: number; max?: number };
  set: (draft: D, range: { min?: number; max?: number }) => D;
}): FilterField<D> {
  const fmt = (n?: number) => (n == null ? "" : `${n}${cfg.unit ? ` ${cfg.unit}` : ""}`);
  return {
    id: cfg.id,
    label: cfg.label,
    icon: cfg.icon,
    active: (d) => {
      const r = cfg.get(d);
      return r.min != null || r.max != null;
    },
    summary: (d) => {
      const { min, max } = cfg.get(d);
      if (min == null && max == null) return "Any";
      if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
      if (min != null) return `≥ ${fmt(min)}`;
      return `≤ ${fmt(max)}`;
    },
    render: ({ draft, setDraft }) => {
      const { min, max } = cfg.get(draft);
      const parse = (v: string) => (v.trim() === "" ? undefined : Number(v));
      const input =
        "h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 text-sm text-white placeholder:text-zinc-600 focus:border-white/[0.25] focus:outline-none";
      return (
        <div className="space-y-3 pt-1">
          <div>
            <label className="mb-1.5 block text-[12px] text-zinc-500">Minimum</label>
            <input
              type="number"
              inputMode="numeric"
              value={min ?? ""}
              placeholder="No minimum"
              onChange={(e) => setDraft(cfg.set(draft, { min: parse(e.target.value), max }))}
              className={input}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] text-zinc-500">Maximum</label>
            <input
              type="number"
              inputMode="numeric"
              value={max ?? ""}
              placeholder="No maximum"
              onChange={(e) => setDraft(cfg.set(draft, { min, max: parse(e.target.value) }))}
              className={input}
            />
          </div>
          {(min != null || max != null) && (
            <button
              type="button"
              onClick={() => setDraft(cfg.set(draft, { min: undefined, max: undefined }))}
              className="text-[13px] text-zinc-500 transition hover:text-white"
            >
              Clear range
            </button>
          )}
        </div>
      );
    },
  };
}

export const DATE_PRESETS: { label: string; days: number | null }[] = [
  { label: "All dates", days: null },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last year", days: 365 },
];

/** A date-range field driven by relative presets (Bigin's "Last N days"). */
export function dateRangeField<D>(cfg: {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  presets?: { label: string; days: number | null }[];
  getFrom: (draft: D) => string | undefined;
  setFrom: (draft: D, fromISO: string | undefined) => D;
}): FilterField<D> {
  const presets = cfg.presets ?? DATE_PRESETS;
  const labelFor = (from?: string) => {
    if (!from) return presets.find((p) => p.days == null)?.label ?? "All dates";
    const days = Math.round((Date.now() - new Date(from).getTime()) / 864e5);
    return presets.find((p) => p.days === days)?.label ?? "Custom range";
  };
  return {
    id: cfg.id,
    label: cfg.label,
    icon: cfg.icon ?? Calendar,
    active: (d) => !!cfg.getFrom(d),
    summary: (d) => labelFor(cfg.getFrom(d)),
    render: ({ draft, setDraft, close }) => {
      const from = cfg.getFrom(draft);
      return (
        <FilterCard>
          {presets.map((p, i) => {
            const presetFrom =
              p.days == null ? undefined : new Date(Date.now() - p.days * 864e5).toISOString();
            const selected = p.days == null ? !from : labelFor(from) === p.label;
            return (
              <ValueRow
                key={p.label}
                first={i === 0}
                badge={
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.04] ring-1 ring-white/[0.08]">
                    <Calendar className="h-4 w-4 text-zinc-300" />
                  </span>
                }
                title={p.label}
                selected={selected}
                onClick={() => {
                  setDraft(cfg.setFrom(draft, presetFrom));
                  close();
                }}
              />
            );
          })}
        </FilterCard>
      );
    },
  };
}
