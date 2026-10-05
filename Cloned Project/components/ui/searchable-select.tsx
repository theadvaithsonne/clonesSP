"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  /** Left badge — short code, uppercase (e.g. "IST"). Optional. */
  code?: string;
  /** Left image (e.g. a store/org logo url). Rendered before the label. Optional. */
  icon?: string;
  /** Primary label (white). */
  label: string;
  /** Secondary muted sub-line (e.g. "GMT + 5:30"). Optional. */
  sublabel?: string;
  /** Extra text folded into the search match but not displayed. */
  keywords?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value?: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  /** Max rows rendered (perf cap for very large lists). Default 200. */
  limit?: number;
  autoFocus?: boolean;
  className?: string;
  /** Fill the parent's height instead of the popover's 60vh cap (panel mode). */
  fill?: boolean;
}

/**
 * THE dropdown template — one searchable select for every dropdown field.
 * A magnifier search row over a dark list of `code · label · sublabel` rows
 * (selected row highlighted, per-row divider), filtering live over the displayed
 * fields + `keywords`. Container-agnostic: the caller wraps it in a drawer
 * screen, popover, or sheet. Extracted from the catch-up scheduler timezone
 * picker so all dropdowns share the exact same look and behaviour.
 */
export function SearchableSelect({
  options,
  value,
  onSelect,
  placeholder = "Search...",
  emptyText = "No matches.",
  limit = 200,
  autoFocus = true,
  className,
  fill = false,
}: SearchableSelectProps) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();

  const rows = useMemo(() => {
    const match = ql
      ? options.filter((o) =>
          `${o.code ?? ""} ${o.label} ${o.sublabel ?? ""} ${o.keywords ?? ""}`
            .toLowerCase()
            .includes(ql),
        )
      : options;
    return match.slice(0, limit);
  }, [options, ql, limit]);

  return (
    <div className={className}>
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
        <Search className="h-[18px] w-[18px] shrink-0 text-zinc-400" />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[15px] text-white placeholder:text-zinc-500 outline-none"
        />
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto scrollbar-hide",
          !fill && "max-h-[60vh]",
        )}
      >
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            {ql ? `No matches for “${q}”.` : emptyText}
          </div>
        ) : (
          rows.map((o, i) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onSelect(o.value)}
              className={cn(
                "flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]",
                i < rows.length - 1 && "border-b border-white/[0.05]",
                value === o.value && "bg-white/[0.04]",
              )}
            >
              {o.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={o.icon}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                />
              ) : o.code != null ? (
                <span className="w-9 shrink-0 text-[11px] font-semibold uppercase text-zinc-500">
                  {o.code}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-white">{o.label}</span>
                {o.sublabel && (
                  <span className="block text-[12px] text-zinc-500">{o.sublabel}</span>
                )}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

interface SearchableSelectFieldProps {
  options: SearchableOption[];
  value?: string;
  onChange: (value: string) => void;
  /** Empty-state text on the trigger button. */
  placeholder?: string;
  /** Search-box placeholder inside the popover. */
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Override/extend the trigger button classes (to match neighbouring fields). */
  className?: string;
  /** Override/extend the popover panel classes. */
  contentClassName?: string;
  align?: "start" | "center" | "end";
  limit?: number;
  /** Custom trigger content for the selected option (default: `code · label`). */
  renderValue?: (option: SearchableOption | undefined) => ReactNode;
  /** How the list opens: an attached dropdown `popover` (default) or the standard
   *  right-side `panel` (a Sheet — for long lists / small triggers). */
  openIn?: "popover" | "panel";
  /** Heading shown at the top of the side panel (panel mode only). */
  panelTitle?: string;
}

/**
 * Inline form-field version of the dropdown template: a trigger button (shows the
 * selected option) that opens a Popover containing the `SearchableSelect` search
 * + rows. Use this for every dropdown FIELD; use `SearchableSelect` directly only
 * when you already have a full-height container (e.g. a drawer screen).
 */
export function SearchableSelectField({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText,
  disabled,
  className,
  contentClassName,
  align = "start",
  limit,
  renderValue,
  openIn = "popover",
  panelTitle,
}: SearchableSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const triggerCls = cn(
    "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white transition-colors hover:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-brand/60 disabled:opacity-50",
    className,
  );
  const triggerInner = (
    <>
      <span className="flex min-w-0 items-center gap-2 truncate">
        {renderValue ? (
          renderValue(selected)
        ) : selected ? (
          <>
            {selected.code && (
              <span className="shrink-0 text-xs text-zinc-500">{selected.code}</span>
            )}
            <span className="truncate">{selected.label}</span>
          </>
        ) : (
          <span className="text-zinc-500">{placeholder}</span>
        )}
      </span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-500" />
    </>
  );

  // Standard right-side panel (Sheet) — for long lists / small triggers.
  if (openIn === "panel") {
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={triggerCls}
        >
          {triggerInner}
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className="flex w-full flex-col gap-0 border-white/[0.08] bg-[#0e0e0e] p-0 sm:max-w-md"
          >
            <SheetHeader className="border-b border-white/[0.06] px-4 py-4">
              <SheetTitle className="text-[15px] font-medium text-white">
                {panelTitle ?? placeholder}
              </SheetTitle>
            </SheetHeader>
            <SearchableSelect
              className="flex min-h-0 flex-1 flex-col"
              options={options}
              value={value}
              onSelect={(v) => {
                onChange(v);
                setOpen(false);
              }}
              placeholder={searchPlaceholder}
              emptyText={emptyText ?? "No matches."}
              limit={limit}
              autoFocus
              fill
            />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" className={triggerCls}>
          {triggerInner}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        collisionPadding={12}
        className={cn(
          // Never exceed the space between the trigger and the viewport edge
          // (Radix exposes it) — the list scrolls inside, always falling short
          // of the window instead of clipping the last rows.
          "flex max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0e0e0e] p-0",
          contentClassName,
        )}
      >
        <SearchableSelect
          className="flex min-h-0 flex-1 flex-col"
          options={options}
          value={value}
          onSelect={(v) => {
            onChange(v);
            setOpen(false);
          }}
          placeholder={searchPlaceholder}
          emptyText={emptyText ?? "No matches."}
          limit={limit}
        />
      </PopoverContent>
    </Popover>
  );
}
