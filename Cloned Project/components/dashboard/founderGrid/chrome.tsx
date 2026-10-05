"use client";

/**
 * Shared chrome for the founder console's data grids.
 *
 * The Orders grid and the Unsub Log grid have the same top bar (filter
 * toggle, view tabs, item picker, search) and the same expandable filter
 * tray (segmented pill groups, a date range). Every one of those was
 * duplicated across the two files before this module existed, which is how
 * the pill padding on one page ends up 2px off the other after a tweak that
 * only touched one of them.
 *
 * Anything here is presentation only — it holds no data and knows nothing
 * about invoices or unsub events. The tables own their state and pass it in.
 */

import type { ReactNode } from "react";
import { Download, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GLASS_STYLE, SHELL_BORDER } from "./tokens";

/**
 * Sentinel for "no filter".
 *
 * Radix Select can't accept an empty string as an item value, so the grids
 * use this and translate it to `undefined` at the API boundary.
 */
export const ANY = "__all__";

/** Page-size choices. Capped at 100 because that's the ceiling both
 *  `/feed/founder/invoices` and `/feed/founder/unsub-log` clamp `limit` to. */
export const RPP_OPTIONS = [10, 20, 50, 100];

/** Read the current org id from where the rest of the dashboard reads it. */
export function readOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

/* ── footer value styling ───────────────────────────────────────────────── */

/** Counts. Gold is the brand accent and marks "how many". */
export function Gold({ children }: { children: ReactNode }) {
  return (
    <span className="text-[12px] font-semibold text-brand">{children}</span>
  );
}

/** Money. Emerald separates "how much" from "how many" at a glance, so a
 *  founder never reads a revenue figure as a headcount. */
export function Green({ children }: { children: ReactNode }) {
  return (
    <span className="text-[12px] font-semibold text-[#10B981]">{children}</span>
  );
}

/* ── top bar ────────────────────────────────────────────────────────────── */

/** The outer shell of a grid's top bar: the bottom rule plus the responsive
 *  padding both grids use. `children` is the bar's own row(s). */
export function TopBarShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ borderBottom: `1px solid ${SHELL_BORDER}` }}>{children}</div>
  );
}

/** The main row. Two groups that wrap as UNITS rather than one long wrapping
 *  row, so at tablet width the search/export pair drops to its own line
 *  intact instead of the export button orphaning under the tabs. */
export function TopBarRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 sm:py-3">
      {children}
    </div>
  );
}

export function FilterToggleButton({
  open,
  active,
  onToggle,
}: {
  open: boolean;
  /** Any filter currently narrowing the list — lights the button and adds
   *  the badge dot, so a filtered grid can't look unfiltered. */
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Filters"
      aria-expanded={open}
      className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
        active || open
          ? "border border-brand/40 bg-brand/10 text-brand"
          : "rim-light rim-light-strong bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <SlidersHorizontal className="h-4 w-4" />
      {active && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brand ring-2 ring-[#181818]" />
      )}
    </button>
  );
}

/** One tab of a segmented view switcher. */
export function ViewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Selected reads as raised frosted glass rather than a gold fill —
      // gold is this console's "here is a number" accent, and spending it on
      // a view tab makes the loudest thing on screen the tab you're already
      // looking at.
      style={active ? GLASS_STYLE : undefined}
      aria-label={label}
      title={label}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] transition sm:px-3 ${
        active
          ? "font-semibold text-white"
          : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {icon}
      {/* Icon-only on a phone. Both tabs stay visible and tappable — hiding
          one behind a menu would make "which view am I in" a guess. */}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/** The pill bar a `ViewTab` set sits in. */
export function ViewTabBar({ children }: { children: ReactNode }) {
  return (
    <div className="rim-light flex shrink-0 items-center gap-1 rounded-full bg-white/[0.02] p-1">
      {children}
    </div>
  );
}

/**
 * The top bar's search box.
 *
 * Lives up here rather than in the tray: it's the control a founder reaches
 * for most, and burying it behind the filter toggle meant two clicks to look
 * up one invoice number.
 */
export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="rim-light relative flex min-w-0 flex-1 items-center rounded-full bg-white/[0.02] sm:flex-none">
      <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-zinc-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full min-w-0 rounded-full bg-transparent pl-9 pr-8 text-[13px] text-white placeholder-zinc-600 outline-none sm:w-[200px] lg:w-[250px]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 grid h-5 w-5 place-items-center rounded-full text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/** Right-hand group of the top bar. Full width on a phone so the search box
 *  gets the whole line rather than a 200px stub; auto from sm up. */
export function TopBarActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:shrink-0">
      {children}
    </div>
  );
}

/** One entry of an `ItemPicker`. `value` is a comma-joined id list because
 *  duplicate titles collapse into a single option — see below. */
export interface ItemPickerOption {
  title: string;
  value: string;
  /** How many underlying items share this title. */
  count: number;
}

/**
 * "All communities" / "All digital products" — the scope picker.
 *
 * Duplicate titles collapse into ONE option whose value is every matching
 * id, because the mobile app has historically created several items with the
 * same name (three "Chamak Skin School" channels came out of the
 * `currency: "USD $"` bug). The backend splits and `$in`s that list, so
 * picking the deduped title still returns everything under it — the pill
 * just says how many are hiding behind the one row.
 */
export function ItemPicker({
  value,
  onChange,
  options,
  itemLabel,
  itemLabelPlural,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ItemPickerOption[];
  itemLabel: string;
  itemLabelPlural: string;
}) {
  const allLabel = `All ${itemLabelPlural.toLowerCase()}`;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        // min-w-0 so the trigger can actually shrink — Radix's `w-fit`
        // otherwise keeps a long item name at full width and shoves the
        // search box off the bar.
        className="rim-light rim-light-strong h-9 min-w-0 max-w-[160px] rounded-full border-0 bg-white/[0.03] px-3 text-[13px] text-zinc-200 shadow-none transition-colors hover:bg-white/[0.06] focus-visible:ring-0 sm:max-w-[220px] lg:max-w-[260px]"
        aria-label={`Filter by ${itemLabel.toLowerCase()}`}
      >
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent className="max-h-72 border-[#2E2E2E] bg-[#161618] text-white">
        <SelectItem value={ANY} className="focus:bg-white/[0.06] focus:text-white">
          {allLabel}
        </SelectItem>
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className="focus:bg-white/[0.06] focus:text-white"
          >
            <span className="flex items-center gap-1.5">
              {opt.title}
              {opt.count > 1 && (
                <span
                  title={`${opt.count} ${itemLabelPlural.toLowerCase()} share this name — filtering across all of them.`}
                  className="rounded bg-amber-500/10 px-1 py-px text-[9px] font-semibold text-amber-400/80 ring-1 ring-inset ring-amber-500/20"
                >
                  {opt.count} dupes
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ExportCsvButton({
  exporting,
  onClick,
}: {
  exporting: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={exporting}
      // Icon-only below lg: the label is ~95px of a bar that also has to hold
      // the tabs, the item picker and the search box. aria-label + title
      // carry the meaning the text stops carrying.
      aria-label="Export to CSV"
      title="Export to CSV"
      className="rim-light rim-light-strong flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-white/[0.03] px-0 text-[13px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-50 max-lg:w-9 lg:px-3.5"
    >
      {exporting ? (
        <>
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span className="hidden lg:inline">Exporting…</span>
        </>
      ) : (
        <>
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden lg:inline">Export to CSV</span>
        </>
      )}
    </button>
  );
}

/* ── filter tray ────────────────────────────────────────────────────────── */

export function FilterTray({ children }: { children: ReactNode }) {
  return (
    <div
      // gap-y smaller than gap-x: wrapped rows of pills need less air between
      // them than two groups sitting side by side need between each other,
      // and 16px both ways made a three-row tray on a tablet taller than the
      // visible grid.
      className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-3 pb-3 pt-2.5 sm:px-4 sm:py-3"
      style={{ borderTop: `1px solid ${SHELL_BORDER}` }}
    >
      {children}
    </div>
  );
}

/** An uppercase caption for a tray control. */
export function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap text-[12px] uppercase tracking-wide text-zinc-500">
      {children}
    </span>
  );
}

/** A labelled bar of mutually-exclusive pills. */
export function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    // shrink-0 + nowrap: a group is one unit. Letting "Any status / Paid /
    // Pending / Cancelled" break mid-pill-bar left orphaned pills under a
    // label that no longer read as theirs.
    <div className="flex shrink-0 items-center gap-2">
      <FilterLabel>{label}</FilterLabel>
      <div className="rim-light flex items-center gap-1 rounded-full bg-white/[0.02] p-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={value === o.id ? GLASS_STYLE : undefined}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] transition sm:px-3 ${
              value === o.id
                ? "font-semibold text-white"
                : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A labelled From–To pair. */
export function DateRangeFilter({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <FilterLabel>{label}</FilterLabel>
      <div className="rim-light flex items-center gap-1.5 rounded-full bg-white/[0.02] px-2 py-1">
        <DateInput label="From" value={from} onChange={onFrom} />
        <span className="text-[12px] text-zinc-600">–</span>
        <DateInput label="To" value={to} onChange={onTo} />
      </div>
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      {/* The From/To captions go at sm — on a phone the two fields sit side by
          side and read as a range without being told twice. */}
      <span className="hidden text-[11px] uppercase tracking-wide text-zinc-600 sm:inline">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-lg border border-[#2E2E2E] bg-black/30 px-2 text-[12px] text-zinc-200 outline-none transition [color-scheme:dark] focus:border-brand/40"
      />
    </label>
  );
}

/** "Clear all" — only worth rendering when something is actually filtered. */
export function ClearAllButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] text-zinc-400 underline-offset-2 transition hover:text-white hover:underline"
    >
      Clear all
    </button>
  );
}

/* ── empty state ────────────────────────────────────────────────────────── */

/**
 * The "nothing to show" block, for `DataTable`'s `emptyLabel`.
 *
 * DataTable renders it inside a `py-24` cell, which on a tall viewport parks
 * the message just under the header with an acre of nothing below it. The
 * min-height plus centring puts it in the middle of the empty grid where the
 * eye already is; 30vh keeps it off the header on short ones.
 */
export function GridEmptyState({
  title,
  detail,
  onClearFilters,
}: {
  title: string;
  /** Optional second line — why the grid is empty, or what will fill it. */
  detail?: string;
  /** Omit when no filter is active; a "clear" button that clears nothing is
   *  worse than no button. */
  onClearFilters?: () => void;
}) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 px-4">
      <span className="text-center text-sm text-zinc-400">{title}</span>
      {detail && (
        <span className="max-w-sm text-center text-xs text-zinc-600">
          {detail}
        </span>
      )}
      {onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-1 rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-white/[0.06] hover:text-white rim-light rim-light-strong"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

/* ── page shell ─────────────────────────────────────────────────────────── */

/**
 * The wrapper every founder grid page mounts its table in.
 *
 * `flex-1 min-h-0`, NOT the `-mx-4 -my-3 h-[calc(100dvh-73px)]` breakout
 * WorkshopsPage uses. That page wraps its content in its own padded scroll
 * container, so the negative margins there cancel a gutter that exists.
 * These routes render straight into the dashboard shell's
 * `flex flex-1 min-h-0 flex-col overflow-y-auto`, which has no gutter — the
 * same margins would push the grid 16/24px outside its parent on every side
 * and break every width below desktop.
 *
 * Measuring off the flex parent also beats viewport maths: a `100dvh - 73px`
 * guess is wrong the moment the chrome above changes height, while `flex-1`
 * is whatever is actually left. DataTable scrolls internally (sticky header +
 * frozen columns), so it needs the definite height `min-h-0` gives it.
 */
export function GridPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}
