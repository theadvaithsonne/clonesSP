"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlarmClock,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Loader2,
  Lock,
  Radio,
  Share2,
  Square,
  User as UserIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sanitizeDescription } from "@/lib/sanitizeDescription";
import { useCountdown } from "@/lib/hooks/useCountdown";
import {
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
  type CalendarEvent,
} from "@/lib/calendar";
import { useBrandColors } from "@/lib/brand-color-context";

/** Doors open this long before the scheduled start. */
export const JOIN_WINDOW_MS = 10 * 60 * 1000;

export interface CommissionLevel {
  level: number;
  percentage: number;
  description?: string;
}

export interface SessionPerson {
  id?: string;
  name: string;
  profilePicture?: string | null;
  /** Rendered under the avatar stack as a caption when set. */
  caption?: string;
}

export interface SessionNotStartedCardProps {
  webinarId: string;
  title: string;
  description?: string | null;
  coverPhoto?: string | null;
  hostName?: string | null;
  hostProfilePicture?: string | null;
  orgName?: string | null;
  orgIcon?: string | null;
  brandColor: string;
  /** Host's IANA timezone (e.g. "America/New_York"). Omitted → host row hidden. */
  timezone?: string | null;
  startDate: Date;
  endDate?: Date | null;
  isLive: boolean;
  alreadyEnded?: boolean;
  /** Real registration count from the backend. `null` → row hidden. */
  enrolledCount: number | null;
  pricing: { isFree: boolean; price: number; currency: string } | null;
  commission: {
    totalPercentage: number;
    levels: CommissionLevel[];
    name?: string;
  } | null;
  /** People we can prove are attached to this session — never filler. */
  people: SessionPerson[];
  /** The founder's billed speakers; `caption` carries their designation. */
  speakers?: SessionPerson[];
  /** Viewer's OWN affiliate id. Empty string → plain link, no ?ref=. */
  affiliateId: string;
  /**
   * Last-chance lookup for the viewer's affiliate id, awaited on click when
   * `affiliateId` is still empty. Without it a signed-in user whose id
   * hasn't landed yet would copy a link with no ?ref= and quietly lose
   * credit for the referral.
   */
  resolveAffiliateId?: () => Promise<string>;
  /** Absolute URL of the affiliate program explainer, when one exists. */
  learnMoreHref?: string | null;
  isChecking?: boolean;
  /**
   * Viewer already has access to this session — they cleared the
   * paid-enrolment gate (or the workshop is free and they verified).
   * Drives the "Enrolled" badge and the "View enrolled webinar" CTA.
   */
  isEnrolled?: boolean;
  onJoin?: () => void;
  onExpire?: () => void;
  /**
   * Identity step (email → OTP → name) rendered in place of the
   * share/join row and the reminder notice. Supplying it turns the card
   * into the sign-in surface, so an unverified visitor sees the same
   * session card rather than a separate bare login page.
   */
  authForm?: React.ReactNode;
  /** Affiliate who shared the link — renders the "invited you to join" pill. */
  inviterName?: string | null;
  inviterAvatar?: string | null;
  /**
   * Replaces the dead-end "Session ended" button once a session is over.
   * Omit it to keep the disabled button — the card never invents a
   * destination it wasn't given.
   */
  onExploreOffice?: () => void;
  isExploringOffice?: boolean;
}


// ── Formatting helpers ────────────────────────────────────────────────────

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/** "Sat, Aug 15 · 7:00 PM IST" in whatever timezone the browser reports. */
function formatViewerTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
    .format(date)
    .replace(/,\s(?=\d{1,2}:)/, " · ");
}

/** "9:30 AM EST" rendered in the host's own timezone. */
function formatHostTime(date: Date, timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone,
    }).format(date);
  } catch {
    return null;
  }
}

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function SessionNotStartedCard({
  webinarId,
  title,
  description,
  coverPhoto,
  hostName,
  hostProfilePicture,
  orgName,
  orgIcon,
  brandColor,
  timezone,
  startDate,
  endDate,
  isLive,
  alreadyEnded = false,
  enrolledCount,
  pricing,
  commission,
  people,
  speakers,
  affiliateId,
  resolveAffiliateId,
  learnMoreHref,
  isChecking = false,
  isEnrolled = false,
  onJoin,
  onExpire,
  authForm,
  inviterName,
  inviterAvatar,
  onExploreOffice,
  isExploringOffice = false,
}: SessionNotStartedCardProps) {
  // The office's accent, for the chrome around the webinar's own brandColour.
  const { brand: ACCENT } = useBrandColors();
  const [descExpanded, setDescExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [earningsOpen, setEarningsOpen] = useState(false);

  const countdown = useCountdown(alreadyEnded ? null : startDate, onExpire);

  // Doors open JOIN_WINDOW_MS before the scheduled start, or the moment the
  // host actually goes live — whichever happens first.
  const doorsOpen =
    !alreadyEnded &&
    (isLive || (countdown != null && countdown.total <= JOIN_WINDOW_MS));

  const media = coverPhoto || hostProfilePicture || orgIcon || null;

  const viewerTime = useMemo(() => formatViewerTime(startDate), [startDate]);
  const hostTime = useMemo(
    () => (timezone ? formatHostTime(startDate, timezone) : null),
    [startDate, timezone]
  );

  // Suppress the host row when it would just restate the viewer's own clock.
  const showHostTime = useMemo(() => {
    if (!hostTime || !timezone) return false;
    try {
      return (
        Intl.DateTimeFormat().resolvedOptions().timeZone !== timezone &&
        !viewerTime.includes(hostTime)
      );
    } catch {
      return true;
    }
  }, [hostTime, timezone, viewerTime]);

  const buildShareUrl = useCallback(
    (ref: string) => {
      if (typeof window === "undefined") return "";
      const base = `${window.location.origin}/webinar/${webinarId}`;
      return ref ? `${base}?ref=${encodeURIComponent(ref)}` : base;
    },
    [webinarId]
  );

  const shareUrl = useMemo(
    () => buildShareUrl(affiliateId),
    [buildShareUrl, affiliateId]
  );

  const calendarEvent: CalendarEvent = useMemo(
    () => ({
      title,
      description,
      startDateTime: startDate,
      endDateTime: endDate ?? null,
      location: shareUrl,
      url: shareUrl,
    }),
    [title, description, startDate, endDate, shareUrl]
  );

  const copyShareLink = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      // A signed-in viewer's id may still be in flight — resolve it now
      // rather than copying a link that credits nobody.
      const ref = affiliateId || (resolveAffiliateId ? await resolveAffiliateId() : "");
      const url = buildShareUrl(ref);
      if (!url) return;

      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(
        ref
          ? "Affiliate link copied to clipboard!"
          : "Session link copied to clipboard!"
      );
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link — try again");
    }
  }, [affiliateId, resolveAffiliateId, buildShareUrl]);

  // The share control is icon-only, so the wording lives in the tooltip and
  // the accessible name instead of a visible label.
  const shareLabel = affiliateId
    ? "Copy your affiliate link"
    : "Copy session link";

  // Only ever renders real, backend-sourced commission data.
  const canShowEarnings =
    !!commission && commission.levels.length > 0 && !alreadyEnded;
  const salePrice = pricing && !pricing.isFree ? pricing.price : 0;

  // Descriptions are authored in a rich-text editor, so they arrive as
  // HTML. Render the sanitized markup rather than the raw string —
  // otherwise "<p>" and "<strong>" show up as literal tags.
  const descriptionHtml = useMemo(() => {
    const raw = (description || "").trim();
    return raw ? sanitizeDescription(raw) : "";
  }, [description]);

  // Length is judged on the visible text, not the markup — a short line
  // wrapped in <p><strong> would otherwise trip the "Read more" toggle.
  const descriptionPlain = useMemo(
    () =>
      (description || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    [description]
  );
  const hasLongDescription = descriptionPlain.length > 160;

  return (
    <div className="min-h-screen bg-[#0a0a0e] flex items-center justify-center p-4 overflow-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-5xl my-auto"
      >
        <div className="rounded-2xl sm:rounded-3xl border border-[#23232e] bg-[#0e0e12] overflow-hidden shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)]">
          <div className="grid md:grid-cols-[42fr_58fr]">
            {/* ── Left: cover media, countdown badge, earnings bar ───── */}
            <div className="relative flex flex-col justify-between overflow-hidden bg-[#08080b] min-h-[300px] md:min-h-[480px]">
              {media ? (
                <>
                  {/* Ambient wash: the same image, cropped and blurred, so any
                      aspect ratio fills the column in its own dominant tones
                      instead of sitting in hard letterbox bars. */}
                  <img
                    src={media}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover scale-125 blur-2xl opacity-40 brightness-50 pointer-events-none"
                  />

                  {/* Foreground: contained, so flyers, 1:1 graphics, and
                      portrait posters show every edge — no cropped text. */}
                  <div className="absolute inset-0 z-[1] flex items-center justify-center p-3 sm:p-5">
                    <img
                      src={media}
                      alt={title || "Session cover"}
                      className="max-h-full max-w-full h-auto w-auto object-contain rounded-xl shadow-2xl"
                    />
                  </div>
                </>
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(120% 120% at 20% 0%, ${brandColor}33 0%, #08080b 65%)`,
                  }}
                />
              )}

              {/* Legibility scrim behind the floating chrome. */}
              <div className="absolute inset-0 z-[2] bg-gradient-to-b from-black/60 via-transparent to-black/75 pointer-events-none" />

              {/* Countdown badge */}
              <div className="relative z-10 p-3 sm:p-4">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/75 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                  {alreadyEnded ? (
                    <>
                      <Square className="h-3.5 w-3.5 text-[#9fa0b8]" />
                      Stream ended
                    </>
                  ) : isLive ? (
                    <>
                      <Radio className="h-3.5 w-3.5 animate-pulse text-red-400" />
                      <span className="text-red-400">Live</span>
                    </>
                  ) : (
                    <>
                      <AlarmClock
                        className="h-3.5 w-3.5"
                        style={{ color: ACCENT }}
                      />
                      {countdown
                        ? `Stream starts in ${countdown.label}`
                        : "Stream starting soon"}
                    </>
                  )}
                </span>
              </div>

              <div className="flex-1" />

              {/* Earnings / affiliate callout */}
              {canShowEarnings && (
                <button
                  type="button"
                  onClick={() => setEarningsOpen(true)}
                  className="relative z-10 flex w-full items-center justify-center gap-2 bg-[#F3BA2F] px-4 py-3 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-black transition-colors hover:bg-brand hover:text-brand-foreground"
                >
                  Find out how much you can earn
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* ── Right: details, schedule, social proof, actions ────── */}
            <div className="flex flex-col gap-4 p-5 sm:p-7">
              {/* Inviter attribution */}
              {inviterName && (
                <div
                  className="flex items-center gap-2.5 rounded-xl border px-3 py-2"
                  style={{
                    backgroundColor: `${brandColor}14`,
                    borderColor: `${brandColor}33`,
                  }}
                >
                  {inviterAvatar ? (
                    <img
                      src={inviterAvatar}
                      alt={inviterName}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: `${brandColor}66` }}
                    >
                      {initialsOf(inviterName)}
                    </div>
                  )}
                  <span className="truncate text-xs text-[#9fa0b8]">
                    <span
                      className="font-semibold"
                      style={{ color: brandColor }}
                    >
                      {inviterName}
                    </span>{" "}
                    invited you to join
                  </span>
                </div>
              )}

              {/* Status pill — three states, each stating what is actually
                  true of the stream right now. */}
              <div className="flex flex-wrap items-center gap-2">
                {alreadyEnded ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#33334a] bg-[#1a1a22] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#9fa0b8]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6b6b7b]" />
                    Stream ended
                  </span>
                ) : isLive ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-red-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                    </span>
                    Live
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
                    style={{
                      color: ACCENT,
                      backgroundColor: `${ACCENT}1A`,
                      borderColor: `${ACCENT}4D`,
                    }}
                  >
                    <AlarmClock className="h-3 w-3" />
                    {countdown
                      ? `Stream starts in ${countdown.label}`
                      : "Stream starting soon"}
                  </span>
                )}
                {isEnrolled && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    <Check className="h-3 w-3" />
                    Enrolled
                  </span>
                )}
                {orgName && (
                  <span className="truncate text-[11px] font-medium uppercase tracking-wider text-[#6b6b7b]">
                    {orgName}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {title}
              </h1>

              {/* Description */}
              {descriptionHtml && descriptionPlain !== title.trim() && (
                <div className="text-sm leading-relaxed text-[#9fa0b8]">
                  <div
                    className={`[&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_a]:text-brand [&_a]:hover:underline [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-semibold ${
                      descExpanded ? "" : "line-clamp-2"
                    }`}
                    dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                  />
                  {hasLongDescription && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((v) => !v)}
                      className="mt-1 text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ color: ACCENT }}
                    >
                      {descExpanded ? "Read less" : "Read more"}
                    </button>
                  )}
                </div>
              )}

              {/* Social proof */}
              {(people.length > 0 || (enrolledCount ?? 0) > 0) && (
                <div className="flex items-center gap-3">
                  {people.length > 0 && (
                    <div className="flex -space-x-2.5">
                      {people.slice(0, 4).map((p, i) =>
                        p.profilePicture ? (
                          <img
                            key={p.id || `${p.name}-${i}`}
                            src={p.profilePicture}
                            alt={p.name}
                            title={p.caption ? `${p.name} · ${p.caption}` : p.name}
                            className="h-8 w-8 rounded-full border-2 border-[#0e0e12] object-cover"
                          />
                        ) : (
                          <div
                            key={p.id || `${p.name}-${i}`}
                            title={p.caption ? `${p.name} · ${p.caption}` : p.name}
                            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0e0e12] text-[10px] font-bold text-white"
                            style={{ backgroundColor: `${brandColor}66` }}
                          >
                            {initialsOf(p.name)}
                          </div>
                        )
                      )}
                    </div>
                  )}
                  {(enrolledCount ?? 0) > 0 && (
                    <span className="text-sm text-[#9fa0b8]">
                      <span className="font-semibold text-white">
                        +{(enrolledCount as number).toLocaleString()}
                      </span>{" "}
                      {enrolledCount === 1 ? "member" : "members"} enrolled
                    </span>
                  )}
                </div>
              )}

              {/* Schedule + calendar */}
              <div className="flex flex-col gap-3 rounded-xl border border-[#262636] bg-[#161620] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#22222f]">
                    <CalendarDays
                      className="h-4.5 w-4.5"
                      style={{ color: ACCENT }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {viewerTime}
                    </div>
                    {showHostTime && (
                      <div className="truncate text-xs text-[#6b6b7b]">
                        {hostTime} · host time
                      </div>
                    )}
                  </div>
                </div>

                {!alreadyEnded && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-white/20 px-3.5 py-2 text-xs font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
                      >
                        ADD TO CALENDAR
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="border-[#262636] bg-[#161620] text-white"
                    >
                      <DropdownMenuItem
                        className="cursor-pointer focus:bg-white/10 focus:text-white"
                        onClick={() =>
                          window.open(
                            generateGoogleCalendarUrl(calendarEvent),
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        Google Calendar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer focus:bg-white/10 focus:text-white"
                        onClick={() =>
                          window.open(
                            generateOutlookCalendarUrl(calendarEvent),
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        Outlook
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Pricing */}
              {pricing && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[#6b6b7b]">
                    Pricing:
                  </span>
                  {pricing.isFree || pricing.price <= 0 ? (
                    <span className="font-bold text-emerald-400">FREE</span>
                  ) : (
                    <span className="font-bold text-white">
                      {pricing.currency}{" "}
                      {formatMoney(pricing.price, pricing.currency)}
                    </span>
                  )}
                </div>
              )}

              {/* Identity step — replaces the join/share row until the
                  visitor is verified. */}
              {authForm ? (
                <>
                  <div className="border-t border-[#1e1e28] pt-4">{authForm}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <button
                      type="button"
                      onClick={copyShareLink}
                      aria-label={shareLabel}
                      title={shareLabel}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#262636] text-[#9fa0b8] transition-colors hover:border-white/30 hover:text-white"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Share2 className="h-4 w-4" />
                      )}
                    </button>
                    {canShowEarnings && (
                      <button
                        type="button"
                        onClick={() => setEarningsOpen(true)}
                        className="font-semibold transition-opacity hover:opacity-80"
                        style={{ color: ACCENT }}
                      >
                        Learn more
                      </button>
                    )}
                  </div>
                </>
              ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <button
                    type="button"
                    onClick={copyShareLink}
                    aria-label={shareLabel}
                    title={shareLabel}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#262636] text-[#9fa0b8] transition-colors hover:border-white/30 hover:text-white"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Share2 className="h-4 w-4" />
                    )}
                  </button>
                  {canShowEarnings && (
                    <button
                      type="button"
                      onClick={() => setEarningsOpen(true)}
                      className="font-semibold transition-opacity hover:opacity-80"
                      style={{ color: ACCENT }}
                    >
                      Learn more
                    </button>
                  )}
                </div>

                {alreadyEnded ? (
                  onExploreOffice ? (
                    <button
                      type="button"
                      onClick={onExploreOffice}
                      disabled={isExploringOffice}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-brand-foreground transition-colors hover:brightness-95 disabled:opacity-70 sm:w-auto"
                      style={{ backgroundColor: ACCENT }}
                    >
                      {isExploringOffice ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Opening office…
                        </>
                      ) : (
                        <>
                          <Building2 className="h-4 w-4" />
                          Explore office
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-lg border border-[#2a2a35] bg-[#1a1a22] px-4 py-2.5 text-sm font-semibold text-[#6b6b7b] sm:w-auto"
                    >
                      Session ended
                    </button>
                  )
                ) : (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    {/* Somewhere to go while waiting. Only offered before
                        the host goes live — once the stream is running the
                        room is the only destination that matters. */}
                    {onExploreOffice && !isLive && (
                      <button
                        type="button"
                        onClick={onExploreOffice}
                        disabled={isExploringOffice}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5 disabled:opacity-70 sm:w-auto"
                      >
                        {isExploringOffice ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Opening office…
                          </>
                        ) : (
                          <>
                            <Building2 className="h-4 w-4" />
                            Explore office
                          </>
                        )}
                      </button>
                    )}
                    {doorsOpen || isEnrolled ? (
                  // An enrolled viewer always gets a live button: it drops
                  // them into the stream when it's running, and reports back
                  // ("the host hasn't started yet") when it isn't. Entry is
                  // still gated on server truth inside onJoin — this only
                  // removes a dead, disabled control from a paid seat.
                  <button
                    type="button"
                    onClick={onJoin}
                    disabled={isChecking}
                    title={
                      !doorsOpen
                        ? "Doors open 10 minutes before the start time"
                        : undefined
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-brand-foreground transition-colors hover:brightness-95 disabled:opacity-70 sm:w-auto"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {isChecking ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking…
                      </>
                    ) : (
                      <>
                        {isLive ? (
                          <>
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-600 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                            </span>
                            Join live stream (LIVE)
                          </>
                        ) : (
                          <>
                            {isEnrolled
                              ? "View enrolled webinar"
                              : "Enter session"}
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    title={
                      countdown
                        ? `Doors open in ${countdown.label} minus 10 minutes`
                        : "Doors open 10 minutes before the start time"
                    }
                    className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-[#2a2a35] bg-[#1a1a22] px-4 py-2.5 text-sm font-semibold text-[#6b6b7b] sm:w-auto"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Opens 10 min before start
                  </button>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Enrolment notice. Deliberately promises nothing the
                  backend doesn't do — there is no pre-session email
                  scheduler, so the buyer is pointed at the calendar
                  export and the doors-open time instead. */}
              {isEnrolled && !alreadyEnded && (
                <p className="flex items-start gap-2 border-t border-[#1e1e28] pt-3 text-xs leading-relaxed text-[#6b6b7b]">
                  <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    You&apos;re enrolled. Add it to your calendar and come back
                    when doors open — 10 minutes before the start time.
                  </span>
                </p>
              )}

              {hostName && (
                <div className="flex items-center gap-2 text-xs text-[#6b6b7b]">
                  {hostProfilePicture ? (
                    <img
                      src={hostProfilePicture}
                      alt={hostName}
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <UserIcon className="h-3.5 w-3.5" />
                  )}
                  Hosted by <span className="text-[#9fa0b8]">{hostName}</span>
                </div>
              )}

              {!!speakers?.length && (
                <div className="flex items-center gap-2 text-xs text-[#6b6b7b]">
                  <div className="flex -space-x-1.5">
                    {speakers.slice(0, 4).map((p, i) =>
                      p.profilePicture ? (
                        <img
                          key={p.id || `${p.name}-${i}`}
                          src={p.profilePicture}
                          alt={p.name}
                          title={p.caption ? `${p.name} · ${p.caption}` : p.name}
                          className="h-5 w-5 rounded-full border border-[#0e0e12] object-cover"
                        />
                      ) : (
                        <div
                          key={p.id || `${p.name}-${i}`}
                          title={p.caption ? `${p.name} · ${p.caption}` : p.name}
                          className="flex h-5 w-5 items-center justify-center rounded-full border border-[#0e0e12] text-[8px] font-bold text-white"
                          style={{ backgroundColor: `${brandColor}66` }}
                        >
                          {initialsOf(p.name)}
                        </div>
                      )
                    )}
                  </div>
                  Speakers{" "}
                  <span className="text-[#9fa0b8]">
                    {speakers.map((p) => p.name).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Earnings breakdown ──────────────────────────────────────── */}
      {canShowEarnings && commission && (
        <Dialog open={earningsOpen} onOpenChange={setEarningsOpen}>
          <DialogContent className="max-w-md border-[#262636] bg-[#0e0e12] text-white">
            <DialogHeader>
              <DialogTitle className="text-white">
                Earn up to {commission.totalPercentage}% for every referral
              </DialogTitle>
              <DialogDescription className="text-[#9fa0b8]">
                {commission.name
                  ? `${commission.name} — commission is paid across every level below.`
                  : "Commission is paid across every level below."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {commission.levels.map((lvl) => (
                <div
                  key={lvl.level}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#262636] bg-[#161620] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">
                      Level {lvl.level}
                    </div>
                    {lvl.description && (
                      <div className="truncate text-xs text-[#6b6b7b]">
                        {lvl.description}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className="text-sm font-bold"
                      style={{ color: ACCENT }}
                    >
                      {lvl.percentage}%
                    </div>
                    {salePrice > 0 && pricing && (
                      <div className="text-[11px] text-[#6b6b7b]">
                        {formatMoney(
                          (salePrice * lvl.percentage) / 100,
                          pricing.currency
                        )}{" "}
                        / sale
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {salePrice > 0 && pricing && (
              <div className="flex items-center justify-between rounded-lg border border-[#262636] bg-[#161620] px-3 py-2.5">
                <span className="text-sm font-semibold text-white">
                  Total per sale
                </span>
                <span className="text-base font-bold" style={{ color: ACCENT }}>
                  {formatMoney(
                    (salePrice * commission.totalPercentage) / 100,
                    pricing.currency
                  )}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={copyShareLink}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-brand-foreground transition-colors hover:brightness-95"
                style={{ backgroundColor: ACCENT }}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                {affiliateId ? "Copy affiliate link" : "Copy session link"}
              </button>
              {learnMoreHref && (
                <a
                  href={learnMoreHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
                >
                  Learn more
                </a>
              )}
            </div>

            {!affiliateId && (
              <p className="text-[11px] leading-relaxed text-[#6b6b7b]">
                Sign in to get your own referral link — the link above has no
                affiliate code attached, so referrals won&apos;t be credited to
                you.
              </p>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
