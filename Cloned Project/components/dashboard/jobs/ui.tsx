"use client";

// Jobs screens reuse the founder-console primitives from the Events module
// (the same #141414 cards, #262626 hairlines, #1A1A1A inputs and office brand
// accent as every founder create/edit surface) and add the few pieces hiring
// needs: status and stage pills, the reward badge, avatars, a right-side
// drawer, underline tabs, compact filter menus and row menus.

import React from "react";
import { Check, ChevronDown, Copy, Loader2, MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import {
  Button,
  Card,
  GOLD,
  useHideBottomBar,
  formatMoney,
} from "@/components/dashboard/inlineApps/events/ui";
import { CATEGORY_META, STATUS_META } from "./constants";
import type { JobStatus, StageCategory } from "./types";

export {
  Button,
  Card,
  GOLD,
  Label,
  TextInput,
  TextArea,
  Select,
  CustomSelect,
  SwitchControl,
  Toggle,
  Checkbox,
  StatTile,
  EmptyState,
  Modal,
  useHideBottomBar,
  useConfirm,
  toLocalInput,
  fromLocalInput,
  formatMoney,
} from "@/components/dashboard/inlineApps/events/ui";

// ── Formatting ───────────────────────────────────────────────────────────

/** The message of a thrown error, or `fallback` when it has none. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function formatDate(d?: string | Date | null, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", ...opts });
}

export function formatDateTime(d?: string | Date | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Interview join links are built by the backend from its FRONTEND_URL, so a
 * misconfigured server stores `http://localhost:3000/meet/join?...` on the
 * interview for good. Re-home the path onto the site the user is on.
 */
export function meetingLink(url?: string | null): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (typeof window === "undefined" || !u.pathname.startsWith("/meet/")) return url;
    return `${window.location.origin}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

export function timeAgo(d?: string | Date | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(date);
}

/** "₹28L – ₹36L / year" style salary text, or null when hidden/unset. */
export function formatSalary(salary?: {
  show?: boolean;
  currency?: string;
  min?: number | null;
  max?: number | null;
  period?: string;
} | null): string | null {
  if (!salary || salary.show === false) return null;
  const { min, max } = salary;
  if (!min && !max) return null;
  const compact = (n: number) => {
    try {
      return new Intl.NumberFormat("en", {
        style: "currency",
        currency: salary.currency || "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
    } catch {
      return `${salary.currency} ${n}`;
    }
  };
  const range = min && max ? `${compact(min)} – ${compact(max)}` : compact((min || max)!);
  return `${range} / ${salary.period || "year"}`;
}

// ── Page layout ──────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b border-[#1c1c24] px-8 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[#7c7d94]">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={[
              "relative shrink-0 pb-3 text-sm transition-colors",
              active ? "text-white" : "text-[#7c7d94] hover:text-white",
            ].join(" ")}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 text-xs text-[#61627a]">{t.count}</span>}
            {active && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full" style={{ background: GOLD }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = "w-64",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4f5065]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#2a2a35] bg-[#141418] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#4f5065] focus:border-[#4a4a5c] focus:outline-none"
      />
    </div>
  );
}

/** Founder-written rich text (job descriptions), sanitised before rendering. */
export function SafeHtml({ html, className = "" }: { html: string; className?: string }) {
  const clean = React.useMemo(
    () => (typeof window === "undefined" ? "" : DOMPurify.sanitize(html || "", { USE_PROFILES: { html: true } })),
    [html]
  );
  return (
    <div
      className={`text-sm leading-6 text-[#c7c7da] [&_a]:underline [&_li]:ml-5 [&_ol>li]:list-decimal [&_p]:mb-2 [&_strong]:text-white [&_ul>li]:list-disc ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

// ── Pills & badges ───────────────────────────────────────────────────────

export function StatusPill({ status }: { status: JobStatus }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
      style={{ background: m.bg, color: m.fg }}
    >
      {m.label}
    </span>
  );
}

export function StagePill({ category, name }: { category: StageCategory; name?: string }) {
  const m = CATEGORY_META[category];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#262626] bg-[#1A1A1A] px-2 py-0.5 text-[11px] text-[#c7c7da]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {name || m.label}
    </span>
  );
}

export function RewardBadge({ amount, suffix = "per hire", size = "md" }: { amount: number; suffix?: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center rounded-md font-medium ${size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"}`}
      style={{ color: GOLD, background: "color-mix(in srgb, var(--brand) 12%, transparent)" }}
    >
      {formatMoney(amount)} {suffix}
    </span>
  );
}

export function Chip({
  children,
  onRemove,
  active,
  onClick,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <span
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors",
        onClick ? "cursor-pointer" : "",
        active ? "text-white" : "border-[#2a2a35] bg-[#141418] text-[#c7c7da] hover:text-white",
      ].join(" ")}
      style={active ? { borderColor: GOLD, background: "color-mix(in srgb, var(--brand) 10%, transparent)" } : undefined}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-[#7c7d94] hover:text-white"
          aria-label="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

export function Avatar({ name, src, size = 32 }: { name?: string; src?: string; size?: number }) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#262630] font-semibold text-[#c7c7da]"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {initials || "?"}
    </span>
  );
}

export function OrgLogo({ name, src, size = 36 }: { name?: string; src?: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="shrink-0 rounded-lg object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#1f1f28] font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name || "?").trim()[0]?.toUpperCase() || "?"}
    </span>
  );
}

export function MatchScore({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "#fbbf24" : "#a1a1aa";
  if (size === "lg") {
    const r = 22;
    const c = 2 * Math.PI * r;
    return (
      <div className="relative h-14 w-14 shrink-0">
        <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
          <circle cx="28" cy="28" r={r} stroke="#262626" strokeWidth="4" fill="none" />
          <circle
            cx="28"
            cy="28"
            r={r}
            stroke={color}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * c} ${c}`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">{score}%</span>
      </div>
    );
  }
  return <span className="text-xs font-semibold tabular-nums" style={{ color }}>{score}%</span>;
}

// ── Menus ────────────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside, active]);
}

/** Compact filter dropdown — a chip that opens a small option list. */
export function FilterMenu({
  label,
  value,
  options,
  onChange,
  allLabel = "All",
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors",
          value ? "text-white" : "border-[#2a2a35] bg-[#141418] text-[#c7c7da] hover:text-white",
        ].join(" ")}
        style={value ? { borderColor: GOLD, background: "color-mix(in srgb, var(--brand) 10%, transparent)" } : undefined}
      >
        {current ? `${label}: ${current.label}` : label}
        <ChevronDown className="h-3 w-3 text-[#7c7d94]" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 min-w-[180px] overflow-y-auto rounded-xl border border-[#262626] bg-[#141414] p-1 shadow-2xl">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-[#c7c7da] hover:bg-[#1f1f28]"
          >
            {allLabel}
            {!value && <Check className="h-3.5 w-3.5" style={{ color: GOLD }} />}
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs text-[#c7c7da] hover:bg-[#1f1f28]"
            >
              <span className="truncate">{o.label}</span>
              {value === o.value && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type RowMenuItem = {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  hint?: string;
  danger?: boolean;
};

/** "•••" menu for a table row or card. */
export function RowMenu({ items, align = "right" }: { items: RowMenuItem[]; align?: "left" | "right" }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-1.5 text-[#7c7d94] transition-colors hover:bg-[#1f1f28] hover:text-white"
        aria-label="More actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          className={`absolute top-full z-50 mt-1 w-56 rounded-xl border border-[#262626] bg-[#141414] p-1 shadow-2xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item, i) => (
            <div key={i} title={item.disabled ? item.hint : undefined}>
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={[
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  item.disabled
                    ? "cursor-not-allowed text-[#4f5065]"
                    : item.danger
                      ? "text-[#f87171] hover:bg-[#f87171]/10"
                      : "text-[#c7c7da] hover:bg-[#1f1f28] hover:text-white",
                ].join(" ")}
              >
                {item.icon}
                {item.label}
              </button>
              {item.disabled && item.hint && <p className="px-3 pb-2 text-[11px] text-[#61627a]">{item.hint}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────

/** Right-side panel with a sticky header and footer (candidate profile, offers, payouts). */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  headerExtra,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  useHideBottomBar(open);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <aside
        className="relative flex h-full w-full flex-col border-l border-[#262626] bg-[#101012] shadow-2xl"
        style={{ maxWidth: width }}
      >
        {(title || headerExtra) && (
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#1c1c24] px-6 py-4">
            <div className="min-w-0 flex-1">
              {title && <div className="text-base font-semibold text-white">{title}</div>}
              {subtitle && <div className="mt-0.5 text-sm text-[#7c7d94]">{subtitle}</div>}
              {headerExtra}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-[#262626] hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[#1c1c24] px-6 py-4">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}

// ── States ───────────────────────────────────────────────────────────────

export function LoadingBlock({ label = "Loading…", className = "py-20" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-sm text-[#7c7d94] ${className}`}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-[#141414]" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm text-[#f87171]">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Couldn't copy — select the text instead.");
        }
      }}
      className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:brightness-110"
      style={{ color: GOLD }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

/** Thin horizontal bar split by stage category — the postings "applicant funnel". */
export function StageBar({ counts }: { counts: Partial<Record<StageCategory, number>> }) {
  const entries = (Object.keys(CATEGORY_META) as StageCategory[]).map((c) => [c, counts[c] || 0] as const);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (!total) return <div className="h-1 w-24 rounded-full bg-[#1f1f28]" />;
  return (
    <div className="flex h-1 w-24 overflow-hidden rounded-full bg-[#1f1f28]">
      {entries
        .filter(([, n]) => n > 0)
        .map(([c, n]) => (
          <span key={c} style={{ width: `${(n / total) * 100}%`, background: CATEGORY_META[c].color }} title={`${CATEGORY_META[c].label}: ${n}`} />
        ))}
    </div>
  );
}

/** Loads data with loading / error state and a reload function. */
export function useLoad<T>(loader: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const seq = React.useRef(0);
  const run = React.useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await loader();
      if (id === seq.current) setData(result);
    } catch (err) {
      if (id === seq.current) setError(errorMessage(err, "Something went wrong."));
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  React.useEffect(() => {
    run();
  }, [run]);
  return { data, setData, loading, error, reload: run };
}
