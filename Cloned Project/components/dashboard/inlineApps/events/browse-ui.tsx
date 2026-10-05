"use client";

// Building blocks for the attendee-facing Events pages (Discover, the event
// page and Purchases).
//
// These pages follow their own dark palette rather than the founder console's:
// #181818 page, #202020 cards on #262626 hairlines, with the office's brand
// colour (`brand` tokens) as the only accent.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Check, ChevronDown } from "lucide-react";
import { getOrgId } from "@/lib/auth";
import { fetchMyAffiliateId, withAffiliateRef } from "@/lib/affiliate-share";
import { useOrgShareOrigin } from "@/lib/hooks/useOrgShareOrigin";
import { useAuthStore } from "@/store/authStore";

// ── Cover image ──────────────────────────────────────────────────────────

/** An event banner, or a brand-tinted panel when there is none. */
export function EventCover({
  src,
  className = "",
}: {
  src?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        className={`h-full w-full ${className}`}
        style={{
          background:
            "radial-gradient(120% 90% at 20% 0%, color-mix(in srgb, var(--brand) 16%, transparent) 0%, transparent 60%), #1c1c1c",
        }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

// ── Saved events ─────────────────────────────────────────────────────────

const SAVED_CHANGE = "events:saved-change";

/**
 * Bookmarked events, per user and office.
 *
 * There is no save endpoint for events, so bookmarks live in this browser.
 * Every instance re-reads on `events:saved-change`, so all mounted cards stay
 * in step when one is toggled.
 */
export function useSavedEvents() {
  const userId = useAuthStore((s) => s.user?.userId) || "anon";
  const [orgId, setOrgId] = useState("");
  useEffect(() => setOrgId(getOrgId() || ""), []);
  const key = `garage:saved-events:${userId}:${orgId}`;

  const read = useCallback((): string[] => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(raw) ? raw.filter((v) => typeof v === "string") : [];
    } catch {
      return [];
    }
  }, [key]);

  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(SAVED_CHANGE, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_CHANGE, sync);
      window.removeEventListener("storage", sync);
    };
  }, [read]);

  const toggle = useCallback(
    (id: string) => {
      // Read fresh rather than from state: another instance may have written
      // since this one last rendered.
      const current = read();
      const next = current.includes(id)
        ? current.filter((v) => v !== id)
        : [...current, id];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Private mode / quota — the toggle simply doesn't stick.
      }
      window.dispatchEvent(new Event(SAVED_CHANGE));
    },
    [key, read]
  );

  const saved = useMemo(() => new Set(ids), [ids]);
  return { saved, toggle };
}

export function BookmarkButton({
  saved,
  onToggle,
  className = "",
}: {
  saved: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={saved ? "Remove from saved" : "Save event"}
      aria-pressed={saved}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-colors hover:bg-black/75 ${
        saved ? "text-brand" : "text-white"
      } ${className}`}
    >
      <Bookmark
        className="h-[13px] w-[13px]"
        strokeWidth={2.25}
        fill={saved ? "currentColor" : "none"}
      />
    </button>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────

/** The grid card used by Discover and Purchases. */
export function EventCard({
  image,
  label,
  title,
  subtitle,
  footer,
  corner,
  onOpen,
}: {
  image?: string;
  /** Brand-coloured eyebrow, e.g. "28 Oct · Technology". */
  label: string;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  /** Pinned to the image's top-right corner — the bookmark. */
  corner?: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <article
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group overflow-hidden rounded-lg border border-[#262626] bg-[#202020] outline-none transition-colors focus-visible:border-[#3a3a3a] ${
        onOpen ? "cursor-pointer hover:border-[#333333]" : ""
      }`}
    >
      <div className="relative aspect-[15/8] overflow-hidden bg-[#1c1c1c]">
        <EventCover
          src={image}
          className="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {corner && <div className="absolute right-2.5 top-2.5">{corner}</div>}
      </div>
      <div className="px-3.5 pb-4 pt-3">
        <p className="truncate text-[10px] font-bold uppercase leading-[14px] tracking-[0.08em] text-brand">
          {label}
        </p>
        <h3 className="mt-1.5 truncate text-[15px] font-semibold leading-5 text-[#f5f5f5]">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 truncate text-[11px] leading-4 text-[#8a8a8a]">
            {subtitle}
          </p>
        )}
        {footer && <div className="mt-2.5">{footer}</div>}
      </div>
    </article>
  );
}

/** The event as a one-line strip: banner thumbnail, name, date and place. */
export function EventBar({
  image,
  name,
  meta,
}: {
  image?: string;
  name: string;
  meta: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#262626] bg-[#202020] p-3">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[#262626]">
        <EventCover src={image} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-5 text-[#f5f5f5]">{name}</p>
        <p className="truncate text-[12px] leading-4 text-[#8a8a8a]">{meta}</p>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-[#262626] bg-[#202020]">
      <div className="aspect-[15/8] animate-pulse bg-[#262626]" />
      <div className="space-y-2.5 px-3.5 pb-4 pt-3">
        <div className="h-2.5 w-24 animate-pulse rounded bg-[#2a2a2a]" />
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#2a2a2a]" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-[#2a2a2a]" />
        <div className="h-3 w-16 animate-pulse rounded bg-[#2a2a2a]" />
      </div>
    </div>
  );
}

export const CARD_GRID =
  "grid grid-cols-1 gap-5 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4";

/** Page column: the design's 40px gutters, capped so ultra-wide screens don't stretch the grid. */
export const PAGE = "mx-auto w-full max-w-[1240px] px-5 pb-32 pt-7 @3xl:px-10";

export const OUTLINE_BUTTON =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#2e2e2e] px-3 text-[13px] font-medium text-[#e8e8e8] transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50";

export function EmptyPanel({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2a2a2a] px-6 py-16 text-center">
      {icon && <div className="mb-4 text-[#3a3a3a]">{icon}</div>}
      <h3 className="text-[14px] font-semibold text-[#f5f5f5]">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-5 text-[#8a8a8a]">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionHeading({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-[18px] font-semibold leading-[26px] text-[#f5f5f5] ${className}`}
    >
      {children}
    </h2>
  );
}

// ── Filter dropdown ──────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * A compact dark dropdown for the filter row. `value` "" is the unfiltered
 * state and shows the placeholder, so the trigger reads "All locations" until
 * something is picked.
 */
export function FilterDropdown({
  value,
  onChange,
  options,
  placeholder,
  align = "left",
}: {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder: string;
  /** Which edge the menu lines up with — `right` for triggers near the page edge. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = value ? options.find((o) => o.value === value) : undefined;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-[34px] items-center gap-1.5 rounded-lg border px-2.5 text-[13px] transition-colors ${
          selected
            ? "border-[#3a3a3a] text-[#f5f5f5]"
            : "border-[#262626] text-[#bdbdbd] hover:border-[#333333] hover:text-[#f5f5f5]"
        }`}
      >
        <span className="max-w-[150px] truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute top-full z-30 mt-1.5 max-h-72 min-w-[180px] overflow-y-auto rounded-lg border border-[#2e2e2e] bg-[#202020] py-1 shadow-2xl shadow-black/40 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {[{ value: "", label: placeholder }, ...options].map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value || "__all"}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors hover:bg-[#2a2a2a] ${
                  active ? "text-brand" : "text-[#d4d4d4]"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sharing ──────────────────────────────────────────────────────────────

let affiliateIdRequest: Promise<string> | null = null;

/**
 * The public link to an event, carrying the viewer's own affiliate id so a
 * purchase through it is credited to them. The id is requested once per page
 * load and shared by every card and page that asks.
 */
export function useEventShareUrl(slug?: string) {
  const origin = useOrgShareOrigin();
  const [affiliateId, setAffiliateId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    affiliateIdRequest ||= fetchMyAffiliateId().then((id) => {
      // "" is a failed lookup as often as a missing id — let the next page ask.
      if (!id) affiliateIdRequest = null;
      return id;
    });
    affiliateIdRequest
      .then((id) => {
        if (alive) setAffiliateId(id);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const base = slug && origin ? `${origin}/events/${slug}` : "";
  const url = base && affiliateId ? withAffiliateRef(base, affiliateId) : base;
  return { url, origin, affiliateId, loading };
}

/** "garage.app/events/x?ref=y" — the link as the eye reads it. */
export function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

export function XLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

/** LinkedIn's "in" without the rounded square, as it sits in running UI. */
export function LinkedInGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />
    </svg>
  );
}
