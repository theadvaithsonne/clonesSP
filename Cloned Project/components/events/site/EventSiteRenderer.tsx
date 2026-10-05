"use client";

// The single renderer for an event's public website.
//
// Used in two places, and that is the point: the /e/[slug] customer page and
// the founder's Web Builder canvas both mount this component with the same
// props. A block that looks right in the builder therefore looks right live,
// with no second implementation to keep in sync.
//
// The layout is the "summit" template: a sticky nav, a centred hero with a
// countdown, and alternating white / tinted bands down the page. Every surface
// colour comes from a palette derived from `theme.backgroundColor`, so an
// organizer who picks a dark background gets the same layout inverted rather
// than a half-broken light page.

import React, { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Radio,
  Globe,
  Linkedin,
  Twitter,
  Instagram,
  ChevronDown,
  Menu,
  Share2,
  Ticket as TicketIcon,
  X,
  Navigation,
  Users,
} from "lucide-react";
import type {
  AgendaSession,
  EventBlock,
  EventBlockType,
  EventProgram,
  EventSpeaker,
  EventSponsor,
  EventTheme,
} from "@/components/dashboard/inlineApps/events/types";
import {
  lookupTickets,
  type LookedUpTicket,
} from "@/components/dashboard/inlineApps/events/api";
import EventVenueMap from "./EventVenueMap";

export interface PublicTier {
  _id: string;
  name: string;
  description?: string;
  perks?: string[];
  price: number;
  currency: string;
  remaining: number;
  soldOut: boolean;
  isPaused: boolean;
  onSale: boolean;
}

export interface EventSiteProps {
  event: EventProgram;
  blocks: EventBlock[];
  theme: EventTheme;
  tiers: PublicTier[];
  speakers: EventSpeaker[];
  sessions: AgendaSession[];
  sponsors: EventSponsor[];
  organizationName?: string;
  organizationIcon?: string;
  /** Opens the ticket drawer. Omitted in the builder, where CTAs are inert. */
  onGetTickets?: (tierId?: string) => void;
  /** Opens the share sheet. Omitted in the builder, where CTAs are inert. */
  onShare?: () => void;
  /** Builder-only: click a section to select it in the inspector. */
  onSelectBlock?: (blockId: string) => void;
  selectedBlockId?: string | null;
  /** Builder-only: renders hidden blocks at reduced opacity instead of dropping them. */
  showHidden?: boolean;
  /** Narrow layout for the builder's mobile viewport. */
  compact?: boolean;
}

// ── Palette ──────────────────────────────────────────────────────────────

interface Palette {
  dark: boolean;
  /** The page itself. */
  page: string;
  /** Tinted band used to separate neighbouring sections. */
  band: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  /** Always-dark surface, for the closing CTA banner. */
  ink: string;
}

const LIGHT: Palette = {
  dark: false,
  page: "#ffffff",
  band: "#f4f4f1",
  card: "#ffffff",
  border: "#e6e6e0",
  text: "#15151a",
  muted: "#5f6070",
  faint: "#8c8d9c",
  ink: "#141418",
};

const DARK: Palette = {
  dark: true,
  page: "#0c0c0e",
  band: "#101014",
  card: "#141418",
  border: "#26262f",
  text: "#ffffff",
  muted: "#9fa0b8",
  faint: "#7c7d94",
  ink: "#141418",
};

function luminance(hex?: string): number {
  const raw = (hex || "").replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return 1;
  return (
    (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) /
    255
  );
}

/**
 * The background the server has always stamped on a new site. Nobody picked it,
 * so it means "unset" rather than "this organizer wants a black page" — treat
 * it as the light template. An organizer who does want dark gets `#0b0b0f` from
 * the builder's Dark preset, which is a real choice and survives a reload.
 */
const LEGACY_DEFAULT_BG = "#0c0c0e";

function makePalette(theme?: EventTheme): Palette {
  const raw = theme?.backgroundColor || "";
  const bg =
    !raw || raw.toLowerCase() === LEGACY_DEFAULT_BG ? LIGHT.page : raw;
  return luminance(bg) < 0.5 ? { ...DARK, page: bg } : { ...LIGHT, page: bg };
}

const PaletteCtx = React.createContext<Palette>(LIGHT);
const usePalette = () => React.useContext(PaletteCtx);

// ── Formatting ───────────────────────────────────────────────────────────

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function fmtDate(iso?: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      ...opts,
    });
  } catch {
    return "";
  }
}

function fmtTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** "12–14 November 2026", collapsing to one date for a single-day event. */
function fmtRange(startIso?: string, endIso?: string): string {
  if (!startIso) return "";
  const s = new Date(startIso);
  const e = endIso ? new Date(endIso) : s;
  if (Number.isNaN(s.getTime())) return "";
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay || Number.isNaN(e.getTime())) {
    return s.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  const sameMonth =
    s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.getDate()}–${e.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
  }
  return `${s.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })} – ${e.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

/** Inclusive day span of the event, used by the stats band. */
function dayCount(startIso?: string, endIso?: string): number {
  if (!startIso) return 0;
  const s = new Date(startIso);
  const e = endIso ? new Date(endIso) : s;
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const a = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
  const b = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatLabelOf(event: EventProgram): string {
  return event.format === "virtual"
    ? "Online"
    : event.format === "hybrid"
      ? "In person + Online"
      : "In person";
}

// ── Countdown ────────────────────────────────────────────────────────────

/**
 * Ticks once a second toward `target`. Starts at null so the server render and
 * the first client render agree — a live clock rendered on the server would
 * hydrate mismatched every time.
 */
function useCountdown(target?: string) {
  const [parts, setParts] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    done: boolean;
  } | null>(null);

  useEffect(() => {
    // Clearing matters: turning "Show countdown" off passes `undefined` here,
    // and simply returning early left the last computed value on screen — the
    // toggle looked dead because the countdown never went away.
    if (!target) {
      setParts(null);
      return;
    }
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) {
        setParts({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
        return;
      }
      setParts({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff / 3600000) % 24),
        minutes: Math.floor((diff / 60000) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        done: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return parts;
}

// ── Shared chrome ────────────────────────────────────────────────────────

/**
 * Per-block layout, set in the builder's inspector.
 *
 * Kept as named steps rather than raw pixels: an organizer picking "Roomy"
 * gets something that still looks composed at every breakpoint, which a free
 * numeric padding field does not.
 */
const PAD_Y: Record<string, string> = {
  none: "py-0",
  tight: "py-8 sm:py-10",
  normal: "py-16 sm:py-20",
  roomy: "py-24 sm:py-32",
};

const ALIGN_TEXT: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** Centres the block's own max-width column when the text is centred. */
const ALIGN_ITEMS: Record<string, string> = {
  left: "items-start",
  center: "items-center",
  right: "items-end",
};

export function blockAlign(block: EventBlock): "left" | "center" | "right" {
  const a = block.styles?.textAlign;
  return a === "center" || a === "right" ? a : "left";
}

/** Tailwind classes for a block's chosen alignment and vertical padding. */
export function blockLayout(block: EventBlock) {
  const alignSet = !!block.styles?.textAlign;
  const padSet = !!block.styles?.paddingY;
  const align = blockAlign(block);
  return {
    align,
    // `!` because each block ships with its own `text-center` / `py-16`; an
    // unprefixed class on the parent would lose to it. Untouched blocks get
    // empty strings and keep exactly the design they had.
    alignText: alignSet
      ? [
          `!${ALIGN_TEXT[align]}`,
          // The blocks were designed centred: headings and copy carry
          // `mx-auto`, and rows like the countdown use `justify-center`.
          // Text-align alone can't move either, so those are unwound here —
          // otherwise picking "Left" would shift nothing but the eyebrow.
          align === "center"
            ? ""
            : "[&_.mx-auto]:!mx-0 [&_.justify-center]:!justify-start",
          align === "right"
            ? "[&_.mx-auto]:!ml-auto [&_.mx-auto]:!mr-0 [&_.justify-center]:!justify-end"
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      : "",
    alignItems: alignSet ? ALIGN_ITEMS[align] : "",
    // Neutralise the block's own vertical padding before applying the choice,
    // or the two stack.
    padY: padSet
      ? `[&>*]:!py-0 ${PAD_Y[block.styles!.paddingY!] || PAD_Y.normal}`
      : "",
  };
}

/** Sections that sit on the tinted band rather than the page colour. */
const BAND_BLOCKS = new Set<EventBlockType>(["speakers", "sponsors", "faq"]);

const DEFAULT_HEADING: Partial<Record<EventBlockType, string>> = {
  about: "About the event",
  agenda: "What's on",
  speakers: "Featured speakers",
  sponsors: "Our sponsors",
  tickets: "Tickets",
  venue_map: "The Venue",
  faq: "Frequently asked questions",
};

const DEFAULT_EYEBROW: Partial<Record<EventBlockType, string>> = {
  about: "",
  agenda: "Agenda preview",
  speakers: "Speakers",
  sponsors: "Support",
  tickets: "Pricing",
  venue_map: "Location",
  faq: "FAQ",
};

/** Nav entries, keyed by the block that owns the anchor. */
const NAV_ENTRY: Partial<Record<EventBlockType, { id: string; label: string }>> =
  {
    about: { id: "about", label: "About" },
    agenda: { id: "agenda", label: "Agenda" },
    speakers: { id: "speakers", label: "Speakers" },
    sponsors: { id: "sponsors", label: "Sponsors" },
    tickets: { id: "tickets", label: "Tickets" },
    venue_map: { id: "venue", label: "Venue" },
    faq: { id: "faq", label: "FAQ" },
  };

function SectionShell({
  id,
  children,
  onSelect,
  selected,
  dimmed,
  background,
  className = "",
  block,
}: {
  id: string;
  children: React.ReactNode;
  onSelect?: (id: string) => void;
  selected?: boolean;
  dimmed?: boolean;
  background?: string;
  className?: string;
  /** Supplies the per-block alignment and padding, when there is one. */
  block?: EventBlock;
}) {
  // Applied on the shell so every block inherits it, rather than each block
  // having to remember to read `styles`.
  const layout = block ? blockLayout(block) : null;
  return (
    <section
      data-block-id={id}
      onClick={onSelect ? () => onSelect(id) : undefined}
      className={[
        "relative w-full",
        onSelect ? "cursor-pointer" : "",
        selected ? "outline outline-2 outline-offset-[-2px] outline-[#FACC15]" : "",
        dimmed ? "opacity-40" : "",
        layout?.alignText || "",
        layout?.padY || "",
        className,
      ].join(" ")}
      style={background ? { background } : undefined}
    >
      {children}
    </section>
  );
}

function Container({
  children,
  compact,
  className = "",
}: {
  children: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        "mx-auto w-full px-5 sm:px-8",
        compact ? "max-w-full" : "max-w-6xl",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children?: React.ReactNode }) {
  const p = usePalette();
  if (!children) return null;
  return (
    <div
      className="text-[10px] font-semibold uppercase tracking-[0.22em]"
      style={{ color: p.faint }}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  center?: boolean;
}) {
  const p = usePalette();
  if (!title && !subtitle && !eyebrow) return null;
  return (
    <div className={["mb-10", center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"].join(" ")}>
      <Eyebrow>{eyebrow}</Eyebrow>
      {title && (
        <h2
          className="mt-3 text-3xl font-bold tracking-tight sm:text-[34px]"
          style={{ color: p.text }}
        >
          {title}
        </h2>
      )}
      {subtitle && (
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: p.muted }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function PrimaryButton({
  accent,
  onClick,
  children,
  className = "",
}: {
  accent: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-[#141418] transition-opacity hover:opacity-90",
        className,
      ].join(" ")}
      style={{ background: accent }}
    >
      {children}
    </button>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────

function SiteNav({
  event,
  accent,
  entries,
  organizationIcon,
  onGetTickets,
  onShare,
  sticky,
  compact,
}: {
  event: EventProgram;
  accent: string;
  entries: Array<{ id: string; label: string }>;
  organizationIcon?: string;
  onGetTickets?: (tierId?: string) => void;
  /** Opens the share sheet. Omitted in the builder, where CTAs are inert. */
  onShare?: () => void;
  sticky?: boolean;
  compact?: boolean;
}) {
  const p = usePalette();
  const [menuOpen, setMenuOpen] = useState(false);

  // Section anchors, "My tickets" and "Share & Earn" all need somewhere to go
  // on a phone. Below md they collapse into one drawer rather than competing
  // for a 360px row with the event name and the ticket button.
  const close = () => setMenuOpen(false);

  return (
    <header
      className={[
        "z-40 w-full border-b backdrop-blur",
        sticky ? "sticky top-0" : "",
      ].join(" ")}
      style={{
        borderColor: p.border,
        background: p.dark ? `${p.page}e6` : "#ffffffe6",
      }}
    >
      <Container
        compact={compact}
        className="flex h-14 items-center gap-3 px-4 md:h-16 md:gap-6 md:px-8"
      >
        <a href="#top" className="flex min-w-0 items-center gap-2.5">
          {organizationIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organizationIcon}
              alt=""
              className="h-6 w-6 shrink-0 rounded object-cover"
            />
          ) : (
            <span
              className="h-5 w-5 shrink-0 rounded-[5px]"
              style={{ background: accent }}
            />
          )}
          {/* min-w-0 on both the flex item and this span, or a long event name
              refuses to shrink and shoves the ticket button off screen. */}
          <span
            className="min-w-0 truncate text-[13px] font-bold tracking-tight"
            style={{ color: p.text }}
          >
            {event.name}
          </span>
        </a>

        {!compact && (
          <nav className="mx-auto hidden items-center gap-7 text-[13px] md:flex">
            {entries.map((e) => (
              <a
                key={e.id}
                href={`#${e.id}`}
                className="transition-colors hover:opacity-70"
                style={{ color: p.muted }}
              >
                {e.label}
              </a>
            ))}
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-3 md:gap-4">
          {!compact && onShare && (
            <button
              type="button"
              onClick={onShare}
              className="hidden items-center gap-1.5 text-[13px] transition-colors hover:opacity-70 md:inline-flex"
              style={{ color: p.muted }}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share &amp; Earn
            </button>
          )}
          <button
            type="button"
            onClick={() => onGetTickets?.()}
            className="shrink-0 rounded-lg px-3 py-2 text-[12px] font-semibold text-[#141418] transition-opacity hover:opacity-90 md:px-4 md:text-[13px]"
            style={{ background: accent }}
          >
            Get tickets
          </button>
          {!compact && (
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="-mr-1 shrink-0 rounded-lg p-1.5 transition-opacity hover:opacity-70 md:hidden"
              style={{ color: p.text }}
            >
              {menuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </Container>

      {/* Mobile drawer. Backdrop sits below the panel but above the page, and
          any tap on it — or on a link — closes the menu, so the anchor scroll
          is never hidden behind an open sheet. */}
      {menuOpen && !compact && (
        <>
          <div
            className="fixed inset-0 top-14 z-30 md:hidden"
            style={{ background: p.dark ? "#00000080" : "#0000004d" }}
            onClick={close}
          />
          <div
            className="absolute inset-x-0 top-full z-40 border-b backdrop-blur md:hidden"
            style={{
              borderColor: p.border,
              background: p.dark ? `${p.page}f2` : "#fffffff2",
            }}
          >
            <nav className="flex flex-col px-4 py-2">
              {entries.map((e) => (
                <a
                  key={e.id}
                  href={`#${e.id}`}
                  onClick={close}
                  className="border-b py-3.5 text-[14px] transition-opacity hover:opacity-70"
                  style={{ borderColor: p.border, color: p.text }}
                >
                  {e.label}
                </a>
              ))}
              {onShare && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onShare();
                  }}
                  className="mb-3 mt-1 flex items-center justify-center gap-2 rounded-lg py-3 text-[14px] font-semibold text-[#141418]"
                  style={{ background: accent }}
                >
                  <Share2 className="h-4 w-4" />
                  Share &amp; Earn
                </button>
              )}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}

// ── Blocks ───────────────────────────────────────────────────────────────

function HeroBlock({
  block,
  event,
  accent,
  speakers,
  onGetTickets,
  compact,
}: {
  block: EventBlock;
  event: EventProgram;
  accent: string;
  speakers: EventSpeaker[];
  onGetTickets?: (tierId?: string) => void;
  compact?: boolean;
}) {
  const p = usePalette();
  const countdown = useCountdown(
    block.content.showCountdown === false ? undefined : event.startsAt
  );

  const eyebrow = [
    fmtRange(event.startsAt, event.endsAt),
    event.venue?.city,
    formatLabelOf(event),
  ]
    .filter(Boolean)
    .join(" · ");

  // The logo strip is part of the hero rather than its own block: it belongs to
  // the fold visually, and there is no block type for it to live in.
  const companies = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    speakers.forEach((s) => {
      const c = (s.company || "").trim();
      if (!c || seen.has(c.toLowerCase())) return;
      seen.add(c.toLowerCase());
      out.push(c);
    });
    return out.slice(0, 12);
  }, [speakers]);

  return (
    <div id="top">
      <div
        className="relative overflow-hidden"
        style={{
          background: p.dark
            ? `radial-gradient(90% 70% at 50% 0%, ${accent}1a 0%, transparent 60%), ${p.page}`
            : `radial-gradient(80% 60% at 50% -10%, ${accent}26 0%, transparent 60%), ${p.page}`,
        }}
      >
        <Container
          compact={compact}
          className={compact ? "py-14 text-center" : "py-24 text-center sm:py-28"}
        >
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}

          <h1
            className={[
              "mx-auto mt-5 max-w-4xl font-bold tracking-tight",
              compact ? "text-3xl" : "text-5xl sm:text-6xl",
            ].join(" ")}
            style={{ color: p.text }}
          >
            {block.content.headline || event.name}
          </h1>

          {(block.content.subheadline || event.shortDescription) && (
            <p
              className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed"
              style={{ color: p.muted }}
            >
              {block.content.subheadline || event.shortDescription}
            </p>
          )}

          {countdown && !countdown.done && (
            <div className="mt-12">
              <Eyebrow>Event starts in</Eyebrow>
              <div className="mt-5 flex justify-center gap-10 sm:gap-16">
                {(
                  [
                    ["Days", countdown.days],
                    ["Hours", countdown.hours],
                    ["Mins", countdown.minutes],
                    ["Secs", countdown.seconds],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <div
                      className={[
                        "font-bold tabular-nums tracking-tight",
                        compact ? "text-2xl" : "text-[32px]",
                      ].join(" ")}
                      style={{ color: p.text }}
                    >
                      {label === "Days" ? value : String(value).padStart(2, "0")}
                    </div>
                    <div
                      className="mt-1 text-[10px] uppercase tracking-[0.18em]"
                      style={{ color: p.faint }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <PrimaryButton accent={accent} onClick={() => onGetTickets?.()}>
              {block.content.ctaLabel || "Get tickets"}
            </PrimaryButton>
            {block.content.secondaryCtaLabel && (
              <a
                href={block.content.secondaryCtaHref || "#about"}
                className="inline-flex items-center rounded-lg border px-6 py-3 text-sm font-medium transition-colors"
                style={{ borderColor: p.border, color: p.text }}
              >
                {block.content.secondaryCtaLabel}
              </a>
            )}
          </div>
        </Container>
      </div>

      {companies.length > 0 && (
        <div style={{ background: p.band }}>
          <Container compact={compact} className="py-10 text-center">
            <Eyebrow>Speakers from</Eyebrow>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {companies.map((c) => (
                <span
                  key={c}
                  className="rounded-md border px-4 py-2 text-xs"
                  style={{
                    borderColor: p.border,
                    background: p.card,
                    color: p.faint,
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </Container>
        </div>
      )}
    </div>
  );
}

function StatsBand({
  event,
  sessions,
  speakers,
  compact,
}: {
  event: EventProgram;
  sessions: AgendaSession[];
  speakers: EventSpeaker[];
  compact?: boolean;
}) {
  const p = usePalette();
  const stats = [
    { value: dayCount(event.startsAt, event.endsAt), label: "Days of programming" },
    { value: sessions.length, label: "Sessions on the agenda" },
    { value: speakers.length, label: "Speakers on stage" },
    { value: event.totalCapacity, label: "Attendee capacity" },
  ].filter((s) => s.value > 0);

  if (stats.length === 0) return null;

  return (
    <div style={{ background: p.band }}>
      <Container
        compact={compact}
        className={[
          "grid gap-8 py-14",
          compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4",
        ].join(" ")}
      >
        {stats.map((s) => (
          <div key={s.label}>
            <div
              className="text-[34px] font-bold tracking-tight tabular-nums"
              style={{ color: p.text }}
            >
              {s.value.toLocaleString()}
            </div>
            <div className="mt-1 text-xs" style={{ color: p.muted }}>
              {s.label}
            </div>
          </div>
        ))}
      </Container>
    </div>
  );
}

function AboutBlock({
  block,
  event,
  accent,
  sessions,
  speakers,
  organizationName,
  organizationIcon,
  compact,
}: {
  block: EventBlock;
  event: EventProgram;
  accent: string;
  sessions: AgendaSession[];
  speakers: EventSpeaker[];
  organizationName?: string;
  organizationIcon?: string;
  compact?: boolean;
}) {
  const p = usePalette();
  const highlights: string[] = Array.isArray(block.content.highlights)
    ? block.content.highlights
    : [];
  const image = block.content.imageUrl || event.bannerUrl;

  return (
    <>
      <Container compact={compact} className="py-16 sm:py-20">
        <div
          id="about"
          className={[
            "grid items-start gap-12 scroll-mt-20",
            compact ? "" : "lg:grid-cols-[1fr_1fr]",
          ].join(" ")}
        >
          <div>
            <SectionHeading
              eyebrow={block.content.eyebrow ?? DEFAULT_EYEBROW.about}
              title={block.content.heading || DEFAULT_HEADING.about}
            />
            <p
              className="-mt-4 whitespace-pre-line text-[14px] leading-7"
              style={{ color: p.muted }}
            >
              {block.content.body || event.description || event.shortDescription}
            </p>

            {highlights.length > 0 && (
              <div className="mt-7 flex flex-wrap gap-2">
                {highlights.map((h, i) => (
                  <span
                    key={`${h}-${i}`}
                    className="rounded-full border px-3.5 py-1.5 text-xs"
                    style={{
                      borderColor: p.border,
                      background: p.card,
                      color: p.muted,
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>
            )}

            {(organizationName || organizationIcon) && (
              <div className="mt-8 flex items-center gap-3">
                {organizationIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={organizationIcon}
                    alt=""
                    className="h-9 w-9 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-[#141418]"
                    style={{ background: accent }}
                  >
                    {(organizationName || event.name).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 text-xs">
                  <div className="truncate font-semibold" style={{ color: p.text }}>
                    {organizationName}
                  </div>
                  <div style={{ color: p.faint }}>Event organizer</div>
                </div>
              </div>
            )}
          </div>

          {image ? (
            <div
              className="overflow-hidden rounded-xl border-[3px]"
              style={{ borderColor: accent }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt=""
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          ) : (
            <div
              className="grid gap-4 rounded-xl border p-6 sm:grid-cols-2"
              style={{ borderColor: p.border, background: p.card }}
            >
              {[
                ["Dates", fmtRange(event.startsAt, event.endsAt)],
                ["Format", formatLabelOf(event)],
                ["Language", event.language || "English"],
                ["Capacity", `${event.totalCapacity.toLocaleString()} seats`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div
                    className="text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: p.faint }}
                  >
                    {k}
                  </div>
                  <div className="mt-1 text-sm" style={{ color: p.text }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Container>

      <StatsBand
        event={event}
        sessions={sessions}
        speakers={speakers}
        compact={compact}
      />
    </>
  );
}

function AgendaBlock({
  block,
  accent,
  sessions,
  speakers,
  compact,
}: {
  block: EventBlock;
  accent: string;
  sessions: AgendaSession[];
  speakers: EventSpeaker[];
  compact?: boolean;
}) {
  const p = usePalette();
  const days = useMemo(() => {
    const map = new Map<string, AgendaSession[]>();
    [...sessions]
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
      .forEach((s) => {
        const key = dayKey(s.startTime);
        map.set(key, [...(map.get(key) || []), s]);
      });
    return Array.from(map.entries());
  }, [sessions]);

  const [activeDay, setActiveDay] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const speakerById = useMemo(
    () => new Map(speakers.map((s) => [s._id, s])),
    [speakers]
  );
  const current = days[Math.min(activeDay, Math.max(0, days.length - 1))];
  const items = current?.[1] || [];
  const visible = expanded ? items : items.slice(0, 6);

  return (
    <Container compact={compact} className="py-16 sm:py-20">
      <div id="agenda" className="scroll-mt-20">
        <SectionHeading
          eyebrow={block.content.eyebrow ?? DEFAULT_EYEBROW.agenda}
          title={block.content.heading || DEFAULT_HEADING.agenda}
          subtitle={block.content.subheading}
        />

        {days.length === 0 ? (
          <p className="text-sm" style={{ color: p.faint }}>
            The schedule is being finalised — check back shortly.
          </p>
        ) : (
          <>
            {days.length > 1 && (
              <div className="mb-8 flex flex-wrap gap-2">
                {days.map(([key], i) => {
                  const active = i === activeDay;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setActiveDay(i);
                        setExpanded(false);
                      }}
                      className="rounded-md border px-3.5 py-2 text-xs font-medium transition-colors"
                      style={
                        active
                          ? {
                              background: accent,
                              borderColor: accent,
                              color: "#141418",
                            }
                          : {
                              background: p.card,
                              borderColor: p.border,
                              color: p.muted,
                            }
                      }
                    >
                      Day {i + 1}
                      <span className="ml-1.5 opacity-70">
                        ({fmtDate(key, { weekday: undefined, year: undefined })})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <ol className="space-y-3">
              {visible.map((s) => (
                <li
                  key={s._id}
                  className="grid gap-4 rounded-xl border p-5 sm:grid-cols-[140px_1fr]"
                  style={{ borderColor: p.border, background: p.card }}
                >
                  <div className="text-sm">
                    <div
                      className="font-semibold tabular-nums"
                      style={{ color: p.text }}
                    >
                      {fmtTime(s.startTime)}
                    </div>
                    <div className="tabular-nums" style={{ color: p.faint }}>
                      to {fmtTime(s.endTime)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold" style={{ color: p.text }}>
                        {s.title}
                      </h3>
                      <span
                        className="rounded px-2 py-0.5 text-[11px]"
                        style={{ background: p.band, color: p.muted }}
                      >
                        {s.stageName}
                      </span>
                      {s.isLivestreamed && (
                        <span
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: accent, color: "#141418" }}
                        >
                          <Radio className="h-3 w-3" />
                          Streamed
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-2 text-sm leading-6" style={{ color: p.muted }}>
                        {s.description}
                      </p>
                    )}
                    {s.speakerIds?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.speakerIds.map((sid) => {
                          const sp = speakerById.get(sid);
                          if (!sp) return null;
                          return (
                            <span
                              key={sid}
                              className="inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs"
                              style={{
                                borderColor: p.border,
                                background: p.page,
                                color: p.muted,
                              }}
                            >
                              {sp.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={sp.avatarUrl}
                                  alt=""
                                  className="h-5 w-5 rounded-full object-cover"
                                />
                              ) : (
                                <span
                                  className="flex h-5 w-5 items-center justify-center rounded-full text-[9px]"
                                  style={{ background: p.band }}
                                >
                                  {sp.name.slice(0, 1)}
                                </span>
                              )}
                              {sp.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {items.length > 6 && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-xs font-semibold underline underline-offset-4"
                  style={{ color: p.muted }}
                >
                  {expanded
                    ? "Show less"
                    : `See full agenda (${items.length} sessions)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Container>
  );
}

function SpeakersBlock({
  block,
  accent,
  speakers,
  compact,
}: {
  block: EventBlock;
  accent: string;
  speakers: EventSpeaker[];
  compact?: boolean;
}) {
  const p = usePalette();
  const ordered = useMemo(
    () =>
      [...speakers].sort(
        (a, b) =>
          Number(!!b.isKeynote) - Number(!!a.isKeynote) || a.sortOrder - b.sortOrder
      ),
    [speakers]
  );
  const [showAll, setShowAll] = useState(false);
  const limit = compact ? 4 : 8;
  const visible = showAll ? ordered : ordered.slice(0, limit);

  return (
    <Container compact={compact} className="py-16 sm:py-20">
      <div id="speakers" className="scroll-mt-20">
        <SectionHeading
          eyebrow={block.content.eyebrow ?? DEFAULT_EYEBROW.speakers}
          title={block.content.heading || DEFAULT_HEADING.speakers}
          subtitle={block.content.subheading}
        />
        {ordered.length === 0 ? (
          <p className="text-sm" style={{ color: p.faint }}>
            Speakers announced soon.
          </p>
        ) : (
          <>
            <div
              className={[
                "grid gap-5",
                compact
                  ? "grid-cols-1"
                  : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
              ].join(" ")}
            >
              {visible.map((s) => (
                <article
                  key={s._id}
                  className="group overflow-hidden rounded-xl border transition-shadow hover:shadow-lg"
                  style={{ borderColor: p.border, background: p.card }}
                >
                  <div
                    className="relative aspect-[4/3] w-full overflow-hidden"
                    style={{ background: p.band }}
                  >
                    {s.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.avatarUrl}
                        alt={s.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-3xl font-bold"
                        style={{ color: p.faint }}
                      >
                        {s.name.slice(0, 1)}
                      </div>
                    )}
                    {s.isKeynote && (
                      <span
                        className="absolute left-3 top-3 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#141418]"
                        style={{ background: accent }}
                      >
                        Keynote
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3
                      className="truncate text-[13px] font-bold"
                      style={{ color: p.text }}
                    >
                      {s.name}
                    </h3>
                    {s.role && (
                      <p className="mt-0.5 truncate text-[11px]" style={{ color: p.muted }}>
                        {s.role}
                      </p>
                    )}
                    {s.company && (
                      <p className="truncate text-[11px]" style={{ color: p.faint }}>
                        {s.company}
                      </p>
                    )}
                    {s.bio && (
                      <p
                        className="mt-2 line-clamp-2 text-[11px] leading-5"
                        style={{ color: p.faint }}
                      >
                        {s.bio}
                      </p>
                    )}
                    {s.socials && (
                      <div className="mt-3 flex gap-2.5" style={{ color: p.faint }}>
                        {s.socials.linkedin && (
                          <a href={s.socials.linkedin} target="_blank" rel="noreferrer">
                            <Linkedin className="h-3.5 w-3.5 hover:opacity-70" />
                          </a>
                        )}
                        {s.socials.twitter && (
                          <a href={s.socials.twitter} target="_blank" rel="noreferrer">
                            <Twitter className="h-3.5 w-3.5 hover:opacity-70" />
                          </a>
                        )}
                        {s.socials.instagram && (
                          <a href={s.socials.instagram} target="_blank" rel="noreferrer">
                            <Instagram className="h-3.5 w-3.5 hover:opacity-70" />
                          </a>
                        )}
                        {s.socials.website && (
                          <a href={s.socials.website} target="_blank" rel="noreferrer">
                            <Globe className="h-3.5 w-3.5 hover:opacity-70" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {ordered.length > limit && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs font-semibold underline underline-offset-4"
                  style={{ color: p.muted }}
                >
                  {showAll ? "Show fewer" : `All ${ordered.length} speakers`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Container>
  );
}

/**
 * One wall of logos, every sponsor the same size.
 *
 * Sponsors used to be banded by tier, which sized a "platinum" logo at 80px
 * and a "community" one at 48px in a separate row. That asked the organizer to
 * rank their partners before they could list them, and made the section read
 * as four small sections. `tier` is still stored on the record — nothing here
 * reads it.
 */
function SponsorsBlock({
  block,
  sponsors,
  compact,
}: {
  block: EventBlock;
  sponsors: EventSponsor[];
  compact?: boolean;
}) {
  const p = usePalette();
  const ordered = useMemo(
    () => [...sponsors].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [sponsors]
  );

  return (
    <Container compact={compact} className="py-16 sm:py-20">
      <div id="sponsors" className="scroll-mt-20">
        <SectionHeading
          eyebrow={block.content.eyebrow ?? DEFAULT_EYEBROW.sponsors}
          title={block.content.heading || DEFAULT_HEADING.sponsors}
          subtitle={block.content.subheading}
        />
        {ordered.length === 0 ? (
          <p className="text-sm" style={{ color: p.faint }}>
            Sponsorship slots are open.
          </p>
        ) : (
          <div
            className={[
              "grid gap-3",
              compact
                ? "grid-cols-2"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
            ].join(" ")}
          >
            {ordered.map((s) => {
              const inner = (
                <div
                  className="flex h-20 w-full items-center justify-center rounded-lg border px-5 transition-colors"
                  style={{ borderColor: p.border, background: p.card }}
                >
                  {s.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.logoUrl}
                      alt={s.name}
                      // Bounded on both axes so a wide wordmark and a square
                      // badge occupy the same optical weight.
                      className="max-h-12 max-w-full object-contain"
                    />
                  ) : (
                    <span
                      className="truncate text-sm font-medium"
                      style={{ color: p.muted }}
                    >
                      {s.name}
                    </span>
                  )}
                </div>
              );
              return (
                <div key={s._id}>
                  {s.websiteUrl ? (
                    <a href={s.websiteUrl} target="_blank" rel="noreferrer">
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                  {s.boothNumber && (
                    <div
                      className="mt-1.5 text-center text-[11px]"
                      style={{ color: p.faint }}
                    >
                      Booth {s.boothNumber}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {block.content.ctaLabel && block.content.ctaHref && (
          <div className="mt-10 text-center">
            <a
              href={block.content.ctaHref}
              className="text-xs font-semibold underline underline-offset-4"
              style={{ color: p.muted }}
            >
              {block.content.ctaLabel}
            </a>
          </div>
        )}
      </div>
    </Container>
  );
}

function TicketsBlock({
  block,
  accent,
  tiers,
  onGetTickets,
  compact,
}: {
  block: EventBlock;
  accent: string;
  tiers: PublicTier[];
  onGetTickets?: (tierId?: string) => void;
  compact?: boolean;
}) {
  const p = usePalette();
  // The highlight is the organizer's call, not ours — an invented "most
  // popular" badge is a claim about sales nobody made.
  const highlightId: string | undefined = block.content.popularTierId || undefined;

  return (
    <Container compact={compact} className="py-16 sm:py-20">
      <div id="tickets" className="scroll-mt-20">
        <SectionHeading
          eyebrow={block.content.eyebrow ?? DEFAULT_EYEBROW.tickets}
          title={block.content.heading || DEFAULT_HEADING.tickets}
          subtitle={block.content.subheading}
        />
        {tiers.length === 0 ? (
          <p className="text-sm" style={{ color: p.faint }}>
            Tickets go on sale soon.
          </p>
        ) : (
          <div
            className={[
              "grid gap-5",
              compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3",
            ].join(" ")}
          >
            {tiers.map((t) => {
              const disabled = t.soldOut || !t.onSale;
              const highlighted = t._id === highlightId;
              return (
                <div
                  key={t._id}
                  className="relative flex flex-col rounded-xl border p-6"
                  style={{
                    background: p.card,
                    borderColor: highlighted ? accent : p.border,
                    borderWidth: highlighted ? 2 : 1,
                  }}
                >
                  {highlighted && (
                    <span
                      className="absolute -top-2.5 left-6 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#141418]"
                      style={{ background: accent }}
                    >
                      Most popular
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold" style={{ color: p.text }}>
                      {t.name}
                    </h3>
                    {t.soldOut ? (
                      <span
                        className="rounded px-2 py-0.5 text-[11px]"
                        style={{ background: p.band, color: p.muted }}
                      >
                        Sold out
                      </span>
                    ) : t.remaining <= 10 ? (
                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: accent, color: "#141418" }}
                      >
                        {t.remaining} left
                      </span>
                    ) : null}
                  </div>

                  <div
                    className="mt-4 text-[32px] font-bold tracking-tight"
                    style={{ color: p.text }}
                  >
                    {t.price > 0 ? formatMoney(t.price, t.currency) : "Free"}
                  </div>
                  {t.description && (
                    <p className="mt-3 text-sm leading-6" style={{ color: p.muted }}>
                      {t.description}
                    </p>
                  )}
                  {t.perks && t.perks.length > 0 && (
                    <ul className="mt-5 space-y-2 text-sm" style={{ color: p.muted }}>
                      {t.perks.map((perk, i) => (
                        <li key={`${perk}-${i}`} className="flex gap-2">
                          <span style={{ color: p.faint }}>•</span>
                          {perk}
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onGetTickets?.(t._id)}
                    className="mt-6 w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed"
                    style={
                      disabled
                        ? { background: p.band, color: p.faint }
                        : { background: accent, color: "#141418" }
                    }
                  >
                    {t.soldOut
                      ? "Sold out"
                      : t.isPaused
                        ? "Sales paused"
                        : !t.onSale
                          ? "Not on sale"
                          : t.price > 0
                            ? "Buy ticket"
                            : "Register free"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {block.content.note && (
          <p className="mt-8 text-center text-xs" style={{ color: p.faint }}>
            {block.content.note}
          </p>
        )}
      </div>
    </Container>
  );
}

function VenueBlock({
  block,
  event,
  accent,
  compact,
}: {
  block: EventBlock;
  event: EventProgram;
  accent: string;
  compact?: boolean;
}) {
  const p = usePalette();
  const v = event.venue || {};
  const address = [v.addressLine1, v.city, v.state, v.postcode, v.country]
    .filter(Boolean)
    .join(", ");
  // Coordinates win over the text address — the organizer placed that pin
  // deliberately, and a re-geocode of a venue name can land a block away.
  const mapsQuery = encodeURIComponent(
    typeof v.coordinates?.lat === "number" && typeof v.coordinates?.lng === "number"
      ? `${v.coordinates.lat},${v.coordinates.lng}`
      : [v.name, address].filter(Boolean).join(", ") || event.name
  );
  const isVirtual = event.format === "virtual";

  return (
    <Container compact={compact} className="py-16 sm:py-20">
      <div id="venue" className="scroll-mt-20">
        {isVirtual ? (
          <>
            <SectionHeading
              eyebrow={block.content.eyebrow ?? DEFAULT_EYEBROW.venue_map}
              title={block.content.heading || "This event is online"}
              subtitle={block.content.subheading}
            />
            <div
              className="rounded-xl border p-8"
              style={{ borderColor: p.border, background: p.card }}
            >
              <div className="flex items-center gap-3">
                <Radio className="h-5 w-5" style={{ color: accent }} />
                <h3 className="font-semibold" style={{ color: p.text }}>
                  Joining is a click
                </h3>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-6" style={{ color: p.muted }}>
                {event.streaming?.streamType === "external_link"
                  ? "The organizer will share the stream link with you by email once your registration is confirmed."
                  : "Your seat opens inside Garage. When the event goes live, join from the link in your confirmation email — no download, no plugin."}
              </p>
              {event.streaming?.externalUrl && (
                <a
                  href={event.streaming.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold text-[#141418]"
                  style={{ background: accent }}
                >
                  Open stream
                </a>
              )}
            </div>
          </>
        ) : (
          <div
            className={[
              "grid items-center gap-10",
              compact ? "" : "lg:grid-cols-[1fr_1.1fr]",
            ].join(" ")}
          >
            <div>
              <SectionHeading
                eyebrow={block.content.eyebrow ?? DEFAULT_EYEBROW.venue_map}
                title={block.content.heading || DEFAULT_HEADING.venue_map}
              />
              <div className="-mt-6">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                  <span className="font-semibold" style={{ color: p.text }}>
                    {v.name || "Venue"}
                  </span>
                </div>
                {address && (
                  <p className="mt-2 text-sm leading-6" style={{ color: p.muted }}>
                    {address}
                  </p>
                )}
                {block.content.subheading && (
                  <p className="mt-3 text-sm leading-6" style={{ color: p.muted }}>
                    {block.content.subheading}
                  </p>
                )}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
                  style={{ borderColor: p.border, color: p.text, background: p.card }}
                >
                  <Navigation className="h-4 w-4" />
                  Get directions
                </a>
                {event.format === "hybrid" && (
                  <p
                    className="mt-5 flex items-start gap-2 text-xs leading-5"
                    style={{ color: p.faint }}
                  >
                    <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Can&apos;t make it in person? This event also streams online.
                  </p>
                )}
              </div>
            </div>

            <div
              className="relative overflow-hidden rounded-xl border"
              style={{ borderColor: p.border, background: p.card }}
            >
              {/* Live map centred on the pin the organizer dropped in the
                  wizard. Degrades to a styled placeholder when the event has
                  no coordinates yet. */}
              <EventVenueMap
                coordinates={v.coordinates}
                label={v.name}
                variant={p.dark ? "dark" : "light"}
              />
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}

function FaqBlock({
  block,
  compact,
}: {
  block: EventBlock;
  compact?: boolean;
}) {
  const p = usePalette();
  const items: Array<{ q: string; a: string }> = Array.isArray(block.content.items)
    ? block.content.items
    : [];
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Container compact={compact} className="py-16 sm:py-20">
      <div id="faq" className="scroll-mt-20">
        <SectionHeading
          eyebrow={block.content.eyebrow ?? DEFAULT_EYEBROW.faq}
          title={block.content.heading || DEFAULT_HEADING.faq}
          subtitle={block.content.subheading}
        />
        <div className="space-y-2.5">
          {items.map((item, i) => (
            <div
              key={`${item.q}-${i}`}
              className="rounded-lg border"
              style={{ borderColor: p.border, background: p.card }}
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-medium" style={{ color: p.text }}>
                  {item.q}
                </span>
                <ChevronDown
                  className={[
                    "h-4 w-4 shrink-0 transition-transform",
                    open === i ? "rotate-180" : "",
                  ].join(" ")}
                  style={{ color: p.faint }}
                />
              </button>
              {open === i && item.a && (
                <p
                  className="px-5 pb-4 text-[13px] leading-6"
                  style={{ color: p.muted }}
                >
                  {item.a}
                </p>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm" style={{ color: p.faint }}>
              No questions yet.
            </p>
          )}
        </div>
      </div>
    </Container>
  );
}

function CtaBannerBlock({
  block,
  accent,
  onGetTickets,
  compact,
}: {
  block: EventBlock;
  accent: string;
  onGetTickets?: (tierId?: string) => void;
  compact?: boolean;
}) {
  return (
    <div style={{ background: "#141418" }}>
      <Container
        compact={compact}
        className={compact ? "py-14 text-center" : "py-20 text-center"}
      >
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-[38px]">
          {/* No invented urgency: "Seats are limited" is a claim about the
              event, not a label. Fall back to the neutral action. */}
          {block.content.headline || "Get your ticket"}
        </h2>
        {block.content.body && (
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#9fa0b8]">
            {block.content.body}
          </p>
        )}
        <PrimaryButton
          accent={accent}
          onClick={() => onGetTickets?.()}
          className="mt-8"
        >
          <TicketIcon className="h-4 w-4" />
          {block.content.ctaLabel || "Get tickets"}
        </PrimaryButton>
      </Container>
    </div>
  );
}

interface FooterLink {
  label: string;
  href: string;
  group?: string;
}

function FooterBlock({
  block,
  event,
  accent,
  organizationName,
  organizationIcon,
  compact,
}: {
  block: EventBlock;
  event: EventProgram;
  accent: string;
  organizationName?: string;
  organizationIcon?: string;
  compact?: boolean;
}) {
  const p = usePalette();
  const links: FooterLink[] = Array.isArray(block.content.links)
    ? block.content.links
    : [];

  // Links carry an optional group, which turns the flat list into the
  // template's column layout. Ungrouped links stay a single row.
  const columns = useMemo(() => {
    const map = new Map<string, FooterLink[]>();
    links.forEach((l) => {
      const g = (l.group || "").trim();
      if (!g) return;
      map.set(g, [...(map.get(g) || []), l]);
    });
    return Array.from(map.entries());
  }, [links]);
  const loose = links.filter((l) => !(l.group || "").trim());
  const startYear = new Date(event.startsAt).getFullYear();
  const year = Number.isNaN(startYear) ? "" : startYear;

  return (
    <footer className="border-t" style={{ borderColor: p.border, background: p.page }}>
      <Container compact={compact} className="py-14">
        <div
          className={[
            "grid gap-10",
            compact ? "" : columns.length > 0 ? "lg:grid-cols-[1.4fr_2.6fr]" : "",
          ].join(" ")}
        >
          <div>
            <div className="flex items-center gap-2.5">
              {organizationIcon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={organizationIcon}
                  alt=""
                  className="h-6 w-6 rounded object-cover"
                />
              ) : (
                <span
                  className="h-5 w-5 rounded-[5px]"
                  style={{ background: accent }}
                />
              )}
              <span
                className="text-[13px] font-bold tracking-tight"
                style={{ color: p.text }}
              >
                {event.name}
              </span>
            </div>
            {block.content.note && (
              <p
                className="mt-4 max-w-xs text-xs leading-6"
                style={{ color: p.faint }}
              >
                {block.content.note}
              </p>
            )}
          </div>

          {columns.length > 0 && (
            <div
              className={[
                "grid gap-8",
                compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4",
              ].join(" ")}
            >
              {columns.map(([group, items]) => (
                <div key={group}>
                  <Eyebrow>{group}</Eyebrow>
                  <ul className="mt-3 space-y-2">
                    {items.map((l, i) => (
                      <li key={`${l.href}-${i}`}>
                        <a
                          href={l.href}
                          className="text-xs transition-opacity hover:opacity-70"
                          style={{ color: p.muted }}
                        >
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6"
          style={{ borderColor: p.border }}
        >
          <p className="text-[11px]" style={{ color: p.faint }}>
            {/* The event year, not "now" — a clock read during render would
                hydrate mismatched. */}
            {year ? `© ${year} ` : "© "}
            {organizationName || event.name}. All rights reserved.
          </p>
          <nav className="flex flex-wrap gap-5 text-[11px]">
            {loose.map((l, i) => (
              <a
                key={`${l.href}-${i}`}
                href={l.href}
                className="transition-opacity hover:opacity-70"
                style={{ color: p.muted }}
              >
                {l.label}
              </a>
            ))}
            {/* Always present, unlike the organizer's own links: it is the
                only route back to a pass once the email is gone. */}
            <a
              href={`/events/${event.slug}/tickets`}
              className="transition-opacity hover:opacity-70"
              style={{ color: p.muted }}
            >
              My tickets
            </a>
          </nav>
        </div>
      </Container>
    </footer>
  );
}

/**
 * "My tickets" — a lookup pinned to THIS event, near the bottom of the page.
 *
 * Deliberately not a builder block: it is not something an organizer should be
 * able to drag away or switch off, because it is the only route back to a pass
 * once the confirmation email is gone. `/events/<slug>/tickets` is the same
 * thing on its own page, for the footer link and for sharing.
 *
 * The email is asked for alongside the id on purpose — a ticket id is the
 * credential a door scanner accepts, so it is not one on its own.
 */
function MyTicketsSection({
  event,
  accent,
  compact,
}: {
  event: EventProgram;
  accent: string;
  compact?: boolean;
}) {
  const p = usePalette();
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<LookedUpTicket[] | null>(null);

  const inputClass =
    "w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none transition-colors";
  const inputStyle = {
    borderColor: p.border,
    background: p.card,
    color: p.text,
  } as React.CSSProperties;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim()) {
      setError("Enter your ticket ID");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Email is only needed for an order reference — a ticket ID stands
      // on its own. See the lookup route.
      const res = await lookupTickets(reference.trim(), email.trim() || undefined);
      setTickets(res.tickets || []);
    } catch (err: any) {
      setTickets(null);
      setError(err?.message || "We couldn't find that ticket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container compact={compact} className="py-16 sm:py-20">
      <div id="my-tickets" className="scroll-mt-20">
        <SectionHeading
          eyebrow="Already booked"
          title="My tickets"
          subtitle="Enter the ticket ID from your confirmation email to pull up your pass and QR code."
        />

        <form onSubmit={submit} className="max-w-xl">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ticket ID or order reference"
              className={inputClass}
              style={inputStyle}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (only for an order reference)"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 rounded-lg px-5 py-2.5 text-[13px] font-semibold text-[#141418] transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: accent }}
          >
            {busy ? "Looking…" : "Find my ticket"}
          </button>

          {error && (
            <p className="mt-3 text-[12px]" style={{ color: "#ef4444" }}>
              {error}
            </p>
          )}
        </form>

        {tickets && tickets.length === 0 && (
          <p className="mt-5 text-[13px]" style={{ color: p.muted }}>
            That booking has no passes on it.
          </p>
        )}

        {tickets && tickets.length > 0 && (
          <div className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
            {tickets.map((t) => (
              <a
                key={t.qrCodeToken}
                href={`/events/${event.slug}/ticket/${t.qrCodeToken}`}
                className="rounded-xl border p-4 transition-colors hover:opacity-90"
                style={{ borderColor: p.border, background: p.card }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="truncate text-[14px] font-semibold"
                    style={{ color: p.text }}
                  >
                    {t.attendeeName || "Attendee"}
                  </span>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
                    style={{
                      background: t.valid ? `${accent}26` : p.band,
                      color: t.valid ? p.text : p.faint,
                    }}
                  >
                    {t.valid ? "VALID" : "PENDING"}
                  </span>
                </div>
                <p className="mt-1 text-[12px]" style={{ color: p.muted }}>
                  {t.tier?.name || "Admission"}
                </p>
                <p
                  className="mt-2 font-mono text-[11px] uppercase tracking-wider"
                  style={{ color: p.faint }}
                >
                  {t.qrCodeToken.slice(0, 12)}
                </p>
                <p className="mt-2 text-[12px]" style={{ color: p.muted }}>
                  Open ticket &amp; QR code →
                </p>
              </a>
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}

/**
 * Floating "Get tickets" bar.
 *
 * The hero's CTA scrolls out of view within one screen, and on a phone the
 * nav button goes with it. This keeps the one action the page exists for
 * reachable from anywhere on it. Hidden in the builder, where CTAs are inert.
 */
function FloatingTicketBar({
  event,
  accent,
  onGetTickets,
}: {
  event: EventProgram;
  accent: string;
  onGetTickets: (tierId?: string) => void;
}) {
  const p = usePalette();
  const [visible, setVisible] = useState(false);

  // Only once the buyer is past the hero — showing it immediately would put
  // two identical buttons on the first screen.
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur"
      style={{
        borderColor: p.border,
        background: p.dark ? `${p.page}f2` : "#fffffff2",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 md:px-8">
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[13px] font-semibold"
            style={{ color: p.text }}
          >
            {event.name}
          </p>
          <p className="truncate text-[11px]" style={{ color: p.muted }}>
            {fmtRange(event.startsAt, event.endsAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onGetTickets()}
          className="shrink-0 rounded-lg px-5 py-2.5 text-[13px] font-semibold text-[#141418] transition-opacity hover:opacity-90"
          style={{ background: accent }}
        >
          Get tickets
        </button>
      </div>
    </div>
  );
}

// ── Renderer ─────────────────────────────────────────────────────────────

export default function EventSiteRenderer(props: EventSiteProps) {
  const {
    event,
    blocks,
    theme,
    tiers,
    speakers,
    sessions,
    sponsors,
    organizationName,
    organizationIcon,
    onGetTickets,
    onShare,
    onSelectBlock,
    selectedBlockId,
    showHidden,
    compact,
  } = props;

  const accent = theme?.primaryColor || "#FACC15";
  const palette = useMemo(() => makePalette(theme), [theme]);
  const ordered = useMemo(
    () =>
      [...blocks]
        .sort((a, b) => a.order - b.order)
        .filter((b) => showHidden || b.isVisible !== false),
    [blocks, showHidden]
  );

  const navEntries = useMemo(
    () => [
      ...ordered
        .filter((b) => b.isVisible !== false)
        .map((b) => NAV_ENTRY[b.type])
        .filter((e): e is { id: string; label: string } => !!e),
      // Not owned by a block, so it is appended rather than derived.
      ...(compact ? [] : [{ id: "my-tickets", label: "My tickets" }]),
    ],
    [ordered, compact]
  );

  return (
    <PaletteCtx.Provider value={palette}>
      <div
        className="min-h-screen w-full"
        style={{
          background: palette.page,
          color: palette.text,
          fontFamily: theme?.font
            ? `${theme.font}, ui-sans-serif, system-ui`
            : undefined,
        }}
      >
        <SiteNav
          event={event}
          accent={accent}
          entries={navEntries}
          organizationIcon={organizationIcon}
          onGetTickets={onGetTickets}
          onShare={onShare}
          // Sticky inside the builder canvas would pin the bar over the
          // section the founder is editing.
          sticky={!onSelectBlock}
          compact={compact}
        />

        {ordered.map((block) => {
          const shared = {
            key: block.id,
            id: block.id,
            onSelect: onSelectBlock,
            selected: selectedBlockId === block.id,
            dimmed: showHidden && block.isVisible === false,
            background: BAND_BLOCKS.has(block.type) ? palette.band : undefined,
            // Every block goes through the shell, so alignment and padding are
            // applied in one place instead of block by block.
            block,
          };

          switch (block.type) {
            case "hero":
              return (
                <SectionShell {...shared}>
                  <HeroBlock
                    block={block}
                    event={event}
                    accent={accent}
                    speakers={speakers}
                    onGetTickets={onGetTickets}
                    compact={compact}
                  />
                </SectionShell>
              );
            case "about":
              return (
                <SectionShell {...shared}>
                  <AboutBlock
                    block={block}
                    event={event}
                    accent={accent}
                    sessions={sessions}
                    speakers={speakers}
                    organizationName={organizationName}
                    organizationIcon={organizationIcon}
                    compact={compact}
                  />
                </SectionShell>
              );
            case "agenda":
              return (
                <SectionShell {...shared}>
                  <AgendaBlock
                    block={block}
                    accent={accent}
                    sessions={sessions}
                    speakers={speakers}
                    compact={compact}
                  />
                </SectionShell>
              );
            case "speakers":
              return (
                <SectionShell {...shared}>
                  <SpeakersBlock
                    block={block}
                    accent={accent}
                    speakers={speakers}
                    compact={compact}
                  />
                </SectionShell>
              );
            case "sponsors":
              return (
                <SectionShell {...shared}>
                  <SponsorsBlock block={block} sponsors={sponsors} compact={compact} />
                </SectionShell>
              );
            case "tickets":
              return (
                <SectionShell {...shared}>
                  <TicketsBlock
                    block={block}
                    accent={accent}
                    tiers={tiers}
                    onGetTickets={onGetTickets}
                    compact={compact}
                  />
                </SectionShell>
              );
            case "venue_map":
              return (
                <SectionShell {...shared}>
                  <VenueBlock
                    block={block}
                    event={event}
                    accent={accent}
                    compact={compact}
                  />
                </SectionShell>
              );
            case "faq":
              return (
                <SectionShell {...shared}>
                  <FaqBlock block={block} compact={compact} />
                </SectionShell>
              );
            case "cta_banner":
              return (
                <SectionShell {...shared} background={undefined}>
                  <CtaBannerBlock
                    block={block}
                    accent={accent}
                    onGetTickets={onGetTickets}
                    compact={compact}
                  />
                </SectionShell>
              );
            case "footer":
              return (
                <SectionShell {...shared}>
                  <FooterBlock
                    block={block}
                    event={event}
                    accent={accent}
                    organizationName={organizationName}
                    organizationIcon={organizationIcon}
                    compact={compact}
                  />
                </SectionShell>
              );
            default:
              return null;
          }
        })}

        {/* Always last, and never a builder block — see MyTicketsSection. */}
        {!compact && (
          <div style={{ background: palette.band }}>
            <MyTicketsSection event={event} accent={accent} compact={compact} />
          </div>
        )}

        {/* Clears the floating bar so it never covers the footer's last row. */}
        {onGetTickets && !onSelectBlock && <div className="h-20" />}
      </div>

      {onGetTickets && !onSelectBlock && (
        <FloatingTicketBar
          event={event}
          accent={accent}
          onGetTickets={onGetTickets}
        />
      )}
    </PaletteCtx.Provider>
  );
}
