"use client";

// The visual half of Alerts & Promotions. Pure presentation: it takes an
// announcement (or an unsaved draft) and renders it, which is what lets the
// garage-admin editor show a live preview of the exact thing users will see
// instead of a second, drifting mock.
//
// Deliberately not built on components/ui/dialog: that portals to the body,
// which is wrong for an inline preview pane. The overlay below is a plain
// fixed container, so the same component works in both places.

import { useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import {
  BellRing,
  CalendarClock,
  Clock,
  Gift,
  Info,
  Lock,
  Megaphone,
  Rocket,
  Sparkles,
  TriangleAlert,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AnnouncementIcon,
  AnnouncementSize,
  AnnouncementTemplate,
} from "@/lib/announcements";

// ---------------------------------------------------------------------------
// Glass badge
// ---------------------------------------------------------------------------

/** The icon catalogue, keyed by the value stored on the announcement. */
const GLYPHS: Record<Exclude<AnnouncementIcon, "none">, LucideIcon> = {
  megaphone: Megaphone,
  bell: BellRing,
  alert: TriangleAlert,
  info: Info,
  sparkle: Sparkles,
  gift: Gift,
  rocket: Rocket,
  bolt: Zap,
  calendar: CalendarClock,
  lock: Lock,
  wrench: Wrench,
};

/**
 * The announcement mark: a liquid-glass squircle rather than a flat
 * icon-in-a-tinted-box.
 *
 * Colourless on purpose — the glass reads as glass, and the only hue on the
 * card is the CTA. Three stacked layers make it: a blurred translucent body,
 * a diagonal specular sweep, and a pooled bottom highlight, over inset
 * highlight/shadow rings that give the edge thickness. `backdrop-blur` is
 * doing real work: the badge sits over the card body (and over the image in
 * the split layout), so it refracts whatever is behind it.
 */
function GlassBadge({
  icon,
  compact,
}: {
  icon: AnnouncementIcon;
  compact?: boolean;
}) {
  if (icon === "none") return null;
  // An unknown stored value (e.g. one added and then removed from the
  // catalogue) falls back rather than rendering a hole.
  const Glyph = GLYPHS[icon as Exclude<AnnouncementIcon, "none">] ?? Megaphone;

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden border border-white/20 bg-white/[0.07] backdrop-blur-xl",
        // A squircle, not a rounded rect — closer to the platform icon shape
        // and the reason this reads as glass rather than as a button.
        "rounded-[30%]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-10px_18px_-10px_rgba(0,0,0,0.65),0_10px_28px_-14px_rgba(0,0,0,0.9)]",
        compact ? "h-9 w-9" : "h-11 w-11",
      )}
    >
      {/* specular sweep across the top-left corner */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-1/4 -top-1/2 h-[150%] w-[150%] rotate-[24deg] bg-[linear-gradient(105deg,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0.07)_34%,transparent_52%)]"
      />
      {/* a second, tighter highlight where the "liquid" pools at the bottom */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-1 bottom-0 h-1/3 rounded-b-[30%] bg-[linear-gradient(to_top,rgba(255,255,255,0.14),transparent)]"
      />
      <Glyph
        className={cn("relative text-white", compact ? "h-4 w-4" : "h-5 w-5")}
        strokeWidth={1.75}
      />
    </span>
  );
}

/** Everything the card needs to draw itself — a saved row or a draft both fit. */
export interface AnnouncementCardData {
  title: string;
  body: string;
  eyebrow: string;
  size: AnnouncementSize;
  contentType: "text" | "image-text";
  imageUrl: string;
  template: AnnouncementTemplate;
  icon: AnnouncementIcon;
  cta: { enabled: boolean; label: string; href: string; newTab: boolean };
  comingSoon: boolean;
  comingSoonLabel: string;
}

/**
 * Per-template chrome. Each entry is a genuinely different card, not a
 * relabelling of the same one — see AnnouncementTemplate in
 * lib/announcements.ts for why the styles are named by appearance.
 */
interface TemplateChrome {
  /** Border + background + drop shadow on the card shell. */
  shell: string;
  eyebrow: string;
  /** Full-width bar across the top, e.g. the hazard stripe. */
  topBar: string | null;
  /** Vertical rail down the left edge. */
  sideRail: string | null;
  /** Soft light bleeding in from the top edge. */
  topBloom: string | null;
  primaryButton: string;
}

const YELLOW_BUTTON = "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]";
const NEUTRAL_SHADOW = "shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]";

const TEMPLATE_CHROME: Record<AnnouncementTemplate, TemplateChrome> = {
  solid: {
    shell: `border-[#2a2a2a] bg-[#101010] ${NEUTRAL_SHADOW}`,
    eyebrow: "bg-white/5 text-[#a1a1aa] border-white/10",
    topBar: null,
    sideRail: null,
    topBloom: null,
    primaryButton: YELLOW_BUTTON,
  },
  glass: {
    // The one style that depends on what is behind it: over the overlay's
    // dimmed page this frosts, rather than covering.
    shell:
      "border-white/15 bg-white/[0.07] backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_24px_60px_-24px_rgba(0,0,0,0.9)]",
    eyebrow: "bg-white/10 text-white/80 border-white/20",
    topBar: null,
    sideRail: null,
    topBloom: null,
    primaryButton: YELLOW_BUTTON,
  },
  spotlight: {
    shell: `border-[#2a2a2a] bg-[#101010] ${NEUTRAL_SHADOW}`,
    eyebrow: "bg-white/5 text-[#a1a1aa] border-white/10",
    topBar: null,
    sideRail: null,
    topBloom:
      "bg-[radial-gradient(120%_70%_at_50%_0%,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.04)_38%,transparent_70%)]",
    primaryButton: YELLOW_BUTTON,
  },
  accent: {
    shell: `border-[#2a2a2a] bg-[#101010] ${NEUTRAL_SHADOW}`,
    eyebrow: "bg-brand/15 text-brand border-brand/30",
    topBar: null,
    sideRail: "bg-brand",
    topBloom: null,
    primaryButton: YELLOW_BUTTON,
  },
  caution: {
    shell: `border-[#2a2a2a] bg-[#101010] ${NEUTRAL_SHADOW}`,
    eyebrow: "bg-brand text-brand-foreground border-transparent font-semibold",
    topBar:
      "bg-[repeating-linear-gradient(45deg,var(--brand)_0,var(--brand)_10px,#101010_10px,#101010_20px)]",
    sideRail: null,
    topBloom: null,
    primaryButton: YELLOW_BUTTON,
  },
};

/**
 * Styles are stored by name, and three use-case names shipped before the
 * catalogue was reworked. Map them onto their nearest surviving look so old
 * rows keep rendering; anything else falls back to Solid.
 */
const LEGACY_TEMPLATES: Record<string, AnnouncementTemplate> = {
  "feature-promo": "accent",
  "system-alert": "caution",
  "clean-announcement": "solid",
};

function chromeFor(template: string): TemplateChrome {
  return (
    TEMPLATE_CHROME[template as AnnouncementTemplate] ??
    TEMPLATE_CHROME[LEGACY_TEMPLATES[template]] ??
    TEMPLATE_CHROME.solid
  );
}

const SIZE_WIDTH: Record<AnnouncementSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-3xl",
  banner: "max-w-none",
};

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

/**
 * What the rich-text editor is allowed to produce. Everything else is
 * dropped — no images, no tables, no ids or classes, and no style attribute,
 * because a promo card must not be able to reposition itself over the app.
 */
const BODY_ALLOWED_TAGS = [
  "p", "br", "b", "strong", "i", "em", "u", "s", "span", "div",
  "ul", "ol", "li", "a", "blockquote", "code", "h3", "h4",
];
const BODY_ALLOWED_ATTR = ["href", "target", "rel"];

/**
 * The announcement body.
 *
 * Authored as HTML, so this is the app's sanitisation boundary: DOMPurify
 * with the allow-list above, every time, on every render path. Rows written
 * before the editor existed are plain text — rendered with `whitespace-pre-line`
 * so their newlines survive, and escaped by React as normal.
 *
 * The typography classes are as much about containment as looks: long words
 * break instead of widening the card, and headings are pulled down to body
 * scale so nothing can out-shout the title.
 */
function AnnouncementBody({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(html);

  // DOMPurify needs a DOM. Nothing SSRs with real data (the host fetches in
  // an effect), but the guard keeps a future server render from throwing —
  // and from ever emitting unsanitised markup.
  const clean = useMemo(() => {
    if (!looksLikeHtml || typeof window === "undefined") return "";
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: BODY_ALLOWED_TAGS,
      ALLOWED_ATTR: BODY_ALLOWED_ATTR,
    });
  }, [html, looksLikeHtml]);

  if (!html.trim()) return null;

  const typography = cn(
    "break-words [overflow-wrap:anywhere]",
    "[&_p]:my-0 [&_p+p]:mt-2",
    "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
    "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
    "[&_li]:my-0.5",
    "[&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2",
    "[&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-[1.05em] [&_h3]:font-semibold [&_h3]:text-white",
    "[&_h4]:mb-1 [&_h4]:mt-3 [&_h4]:font-semibold [&_h4]:text-white",
    "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3",
    "[&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5",
    className,
  );

  if (!looksLikeHtml) {
    return <div className={cn("whitespace-pre-line", typography)}>{html}</div>;
  }

  return (
    <div className={typography} dangerouslySetInnerHTML={{ __html: clean }} />
  );
}

function CtaButton({
  data,
  chrome,
  onNavigate,
  block,
}: {
  data: AnnouncementCardData;
  chrome: TemplateChrome;
  onNavigate?: () => void;
  block?: boolean;
}) {
  if (!data.cta.enabled) return null;

  const label = data.cta.label.trim() || "Learn more";
  const base = cn(
    // whitespace-nowrap + shrink-0: the copy column is half the card in the
    // split layout, and without these a two-word label ("Not now", "Buy
    // now") breaks across lines inside the button.
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
    block ? "w-full" : "",
  );

  // Coming-soon CTAs are inert rather than hidden: the point is to advertise
  // something that does not exist yet, so the button must read as a label.
  if (data.comingSoon) {
    return (
      <span
        className={cn(
          base,
          "cursor-not-allowed border border-white/10 bg-white/5 text-[#a1a1aa]",
        )}
      >
        <Clock className="h-4 w-4" />
        {data.comingSoonLabel.trim() || "Coming Soon"}
      </span>
    );
  }

  const href = data.cta.href.trim();
  if (!href) return null;

  return (
    <a
      href={href}
      target={data.cta.newTab ? "_blank" : undefined}
      rel={data.cta.newTab ? "noopener noreferrer" : undefined}
      onClick={onNavigate}
      className={cn(base, chrome.primaryButton)}
    >
      {label}
    </a>
  );
}

function ComingSoonBadge({ data }: { data: AnnouncementCardData }) {
  if (!data.comingSoon) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand">
      <Clock className="h-3 w-3" />
      {data.comingSoonLabel.trim() || "Coming Soon"}
    </span>
  );
}

/**
 * The top-banner form. Not a dialog — a full-width strip that sits above the
 * page, so it never blocks what the user came to do.
 */
function AnnouncementBanner({
  data,
  onDismiss,
  onDiscard,
  onNavigate,
}: {
  data: AnnouncementCardData;
  onDismiss?: () => void;
  onDiscard?: () => void;
  onNavigate?: () => void;
}) {
  const chrome = chromeFor(data.template);
  const hasImage = data.contentType === "image-text" && !!data.imageUrl;

  return (
    <div
      role="region"
      aria-label={data.title || "Announcement"}
      className="relative w-full border-b border-[#2a2a2a] bg-[#101010] text-white"
    >
      {chrome.topBloom && (
        <div
          aria-hidden
          className={cn("pointer-events-none absolute inset-0", chrome.topBloom)}
        />
      )}
      {/* A banner has no left edge to rail against — it spans the viewport —
          so Accent Rail becomes a top rule here, which is the same signal in
          the shape the strip allows. */}
      {(chrome.topBar || chrome.sideRail) && (
        <div
          className={cn("h-1 w-full", chrome.topBar ?? chrome.sideRail ?? "")}
        />
      )}
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
        {hasImage ? (
          <img
            src={data.imageUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-md object-cover"
          />
        ) : (
          <GlassBadge icon={data.icon} compact />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {data.eyebrow.trim() && (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                  chrome.eyebrow,
                )}
              >
                {data.eyebrow}
              </span>
            )}
            <p className="truncate text-sm font-semibold">
              {data.title || "Untitled announcement"}
            </p>
            <ComingSoonBadge data={data} />
          </div>
          {data.body.trim() && (
            <AnnouncementBody
              html={data.body}
              className="mt-0.5 line-clamp-2 text-xs text-[#a1a1aa]"
            />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <CtaButton data={data} chrome={chrome} onNavigate={onNavigate} />
          {onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              className="hidden whitespace-nowrap text-xs text-[#71717a] underline decoration-[#71717a]/40 underline-offset-4 transition-colors hover:text-[#a1a1aa] sm:inline"
            >
              Don&apos;t show again
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="rounded-md p-1.5 text-[#a1a1aa] transition-colors hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The dialog form (sm / md / lg).
 *
 * With an image it is always the split layout — copy on the LEFT, image on
 * the RIGHT — at every size, not just `lg`. Stacking the image above the text
 * pushed the copy so far down that a medium card read as an image with a
 * caption. Below `sm:` there is no room for two columns, so it falls back to
 * copy-then-image (reading order preserved).
 */
export function AnnouncementCard({
  data,
  onDismiss,
  onDiscard,
  onNavigate,
  className,
}: {
  data: AnnouncementCardData;
  /** Close for now — "Not now" and the X. */
  onDismiss?: () => void;
  /** Never again — renders the "Don't show this again" opt-out. */
  onDiscard?: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  if (data.size === "banner") {
    return (
      <div className={className}>
        <AnnouncementBanner
          data={data}
          onDismiss={onDismiss}
          onDiscard={onDiscard}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  const chrome = chromeFor(data.template);
  const hasImage = data.contentType === "image-text" && !!data.imageUrl;
  const split = hasImage;
  const compact = data.size === "sm";
  const roomy = data.size === "lg";
  // Mirrors what CtaButton actually renders: an enabled CTA with no
  // destination draws nothing, and a coming-soon one draws its inert label
  // whether or not a destination was set.
  const hasCta =
    data.cta.enabled && (data.comingSoon || data.cta.href.trim() !== "");

  const copy = (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        compact ? "gap-2 p-5" : "gap-3 p-6",
        split && "justify-center",
        split && roomy && "sm:p-8",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {data.eyebrow.trim() && (
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wide",
              chrome.eyebrow,
            )}
          >
            {data.eyebrow}
          </span>
        )}
        <ComingSoonBadge data={data} />
      </div>

      <div className={cn("flex items-start", compact ? "gap-2.5" : "gap-3")}>
        {data.icon !== "none" && (
          <div className="mt-0.5">
            <GlassBadge icon={data.icon} compact={compact} />
          </div>
        )}
        <div className="min-w-0">
          <h2
            className={cn(
              "font-bold leading-tight text-white",
              compact ? "text-lg" : roomy ? "text-2xl" : "text-xl",
            )}
          >
            {data.title || "Untitled announcement"}
          </h2>
          {data.body.trim() && (
            <AnnouncementBody
              html={data.body}
              className={cn(
                "mt-2 text-[#a1a1aa]",
                compact ? "text-xs" : "text-sm",
              )}
            />
          )}
        </div>
      </div>

      {/* "Not now" only exists to sit BESIDE a call to action — it is the
          decline half of "do this / not yet". With no button there is nothing
          to decline, so a lone "Not now" is just a second, wordier close
          button next to the X. The row goes away entirely in that case; the X
          and "Don't show this again" already cover dismissing. */}
      {hasCta && (
        <div
          className={cn(
            "mt-1 flex gap-2",
            // Wrap rather than squeeze: in a half-width copy column the two
            // buttons drop onto separate rows instead of compressing into
            // unreadable slivers.
            compact ? "flex-col" : "flex-wrap items-center",
          )}
        >
          <CtaButton
            data={data}
            chrome={chrome}
            onNavigate={onNavigate}
            block={compact}
          />
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={cn(
                "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium text-[#a1a1aa] transition-colors hover:bg-white/5 hover:text-white",
                compact && "w-full",
              )}
            >
              Not now
            </button>
          )}
        </div>
      )}

      {/* The permanent opt-out, kept visually quieter than "Not now" — that
          one closes the dialog for this session, this one retires it. */}
      {onDiscard && (
        <button
          type="button"
          onClick={onDiscard}
          className="mt-1 self-start whitespace-nowrap text-xs text-[#71717a] underline decoration-[#71717a]/40 underline-offset-4 transition-colors hover:text-[#a1a1aa]"
        >
          Don&apos;t show this again
        </button>
      )}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={data.title || "Announcement"}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border text-white",
        SIZE_WIDTH[data.size],
        chrome.shell,
        className,
      )}
    >
      {chrome.topBar && <div className={cn("h-1.5 w-full", chrome.topBar)} />}

      {/* Spotlight's light source. Absolute and non-interactive so it lies
          over the image in the split layout as well as over the copy. */}
      {chrome.topBloom && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-2/3",
            chrome.topBloom,
          )}
        />
      )}

      {/* Accent Rail. Inside the rounded shell, so it picks up the corner
          radius from the parent's overflow-hidden. */}
      {chrome.sideRail && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-1.5",
            chrome.sideRail,
          )}
        />
      )}

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-3 z-10 rounded-md bg-black/40 p-1.5 text-[#a1a1aa] backdrop-blur transition-colors hover:bg-black/60 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {split ? (
        // Copy comes first in the DOM (so it reads first to a screen reader
        // and in the CTA's tab order); `order-first` only moves the image
        // above it in the one-column mobile fallback.
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {copy}
          <div
            className={cn(
              "relative order-first bg-[#1a1a1a] sm:order-none sm:h-auto",
              compact ? "h-32 sm:min-h-[170px]" : "h-40",
              !compact && !roomy && "sm:min-h-[220px]",
              roomy && "sm:min-h-[300px]",
            )}
          >
            <img
              src={data.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      ) : (
        copy
      )}
    </div>
  );
}

/**
 * The live presentation: a fixed backdrop with the card centred (or the banner
 * pinned to the top). Escape dismisses, and so does a backdrop click — same
 * contract as every other dialog in the app.
 */
export function AnnouncementOverlay({
  data,
  onDismiss,
  onDiscard,
  onNavigate,
}: {
  data: AnnouncementCardData;
  onDismiss: () => void;
  onDiscard?: () => void;
  onNavigate?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  if (data.size === "banner") {
    return (
      // Above every piece of app chrome (which tops out around z-900) but
      // below Radix dialogs (z-1100) and call overlays (z-9999) — a banner
      // lingers until dismissed, so it must never sit on top of a dialog the
      // user deliberately opened.
      <div className="fixed inset-x-0 top-0 z-[1000]">
        <AnnouncementCard
          data={data}
          onDismiss={onDismiss}
          onDiscard={onDiscard}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div className="relative z-10 flex w-full justify-center py-8">
        <AnnouncementCard
          data={data}
          onDismiss={onDismiss}
          onDiscard={onDiscard}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

export default AnnouncementCard;
