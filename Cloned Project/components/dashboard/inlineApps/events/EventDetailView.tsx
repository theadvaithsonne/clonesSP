"use client";

// One event, as an attendee sees it inside the dashboard.
//
// Reads the same public payload as /events/[slug] but lays it out as the
// in-app event page: hero, host, then Overview / Agenda / Speakers /
// Sponsors & Expo / Venue & FAQ beside a sticky ticket panel. Buying still
// hands off to the one checkout page every entry point shares.
//
// Organizer copy (the About text, FAQ, venue note, "most popular" pass) comes
// from the event's published website blocks, so what the organizer wrote in
// the Web Builder is what shows here.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Globe,
  Instagram,
  Link as LinkIcon,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Radio,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import EventVenueMap from "@/components/events/site/EventVenueMap";
import { shareTargets } from "@/components/events/ShareEventModal";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { copyToClipboard } from "@/lib/affiliate-share";
import { getBrandHex } from "@/lib/brand-color-context";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { cn } from "@/lib/utils";
import {
  getPublicEvent,
  type PublicEventPayload,
  type PublicTierPayload,
} from "./api";
import type { AgendaSession, EventProgram, EventSpeaker, EventSponsor } from "./types";
import { TRACK_COLORS } from "./sections/AgendaSection";
import {
  clock,
  dateRange,
  dayCount,
  dayKey,
  durationLabel,
  hasEnded,
  isLive,
  money,
  placeName,
} from "./browse-format";
import {
  EmptyPanel,
  EventCover,
  LinkedInGlyph,
  OUTLINE_BUTTON,
  PAGE,
  SectionHeading,
  XLogo,
  displayUrl,
  useEventShareUrl,
} from "./browse-ui";

type Tab = "overview" | "agenda" | "speakers" | "sponsors" | "venue";

/**
 * Stock is printed under a pass only below this. Past it the number is noise,
 * and it is one an organizer may not want published.
 */
const SHOW_REMAINING_BELOW = 200;

interface Props {
  slug: string;
  /** The breadcrumb root — the page this event was opened from. */
  rootLabel: string;
  onBack: () => void;
  /** Payload already fetched by the caller, to skip a second round-trip. */
  initial?: PublicEventPayload | null;
  /** Hands the fetched payload up, so the checkout can reuse it. */
  onLoaded?: (payload: PublicEventPayload) => void;
  onGetTickets: (slug: string, tierId?: string) => void;
}

export default function EventDetailView({
  slug,
  rootLabel,
  onBack,
  initial,
  onLoaded,
  onGetTickets,
}: Props) {
  const [data, setData] = useState<PublicEventPayload | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");
  const [activeDay, setActiveDay] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const share = useEventShareUrl(data?.event.slug || slug);
  // Read through a ref: a caller's inline callback must not re-trigger the fetch.
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    if (initial) return;
    let alive = true;
    setError(null);
    getPublicEvent(slug)
      .then((res) => {
        if (!alive) return;
        setData(res);
        onLoadedRef.current?.(res);
      })
      .catch((err: unknown) => {
        if (alive) setError((err instanceof Error && err.message) || "Could not open that event");
      });
    return () => {
      alive = false;
    };
  }, [slug, initial, attempt]);

  const view = useMemo(() => (data ? derive(data) : null), [data]);

  // A "see all" link far down the page switches tabs; bring the tab bar back
  // into view so the new content starts on screen.
  const goTab = (next: Tab) => {
    setTab(next);
    requestAnimationFrame(() => {
      const el = tabsRef.current;
      if (el && el.getBoundingClientRect().top < 0) {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  };

  if (error || !data || !view) {
    return (
      <div className={PAGE}>
        <Breadcrumb rootLabel={rootLabel} onBack={onBack} current={data?.event.name} />
        {error ? (
          <div className="mt-7">
            <EmptyPanel
              title="Could not open this event"
              description={`${error}. It may have been unpublished, or the connection dropped.`}
              action={
                <div className="flex gap-2">
                  <button type="button" onClick={onBack} className={OUTLINE_BUTTON}>
                    Back to {rootLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttempt((n) => n + 1)}
                    className={OUTLINE_BUTTON}
                  >
                    Try again
                  </button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="flex justify-center py-32">
            <Loader2 className="h-6 w-6 animate-spin text-[#5c5c5c]" />
          </div>
        )}
      </div>
    );
  }

  const { event, organization } = data;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "Overview" },
    ...(view.sessions.length ? [{ id: "agenda" as const, label: "Agenda" }] : []),
    ...(view.speakers.length ? [{ id: "speakers" as const, label: "Speakers" }] : []),
    ...(view.sponsors.length
      ? [{ id: "sponsors" as const, label: "Sponsors & Expo" }]
      : []),
    { id: "venue", label: view.faq.length ? "Venue & FAQ" : "Venue" },
  ];

  return (
    <div className={PAGE}>
      <Breadcrumb rootLabel={rootLabel} onBack={onBack} current={event.name} />

      <Hero
        event={event}
        subheadline={view.subheadline}
        shareUrl={share.url}
      />

      <div className="mt-6 flex items-center justify-between gap-4 border-b border-[#262626] pb-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <OrgAvatar icon={organization?.icon} name={organization?.name || event.name} />
          <span className="truncate text-[14px] leading-5 text-[#f5f5f5]">
            {organization?.name ? `Hosted by ${organization.name}` : "Event"}
          </span>
        </div>
        {event.totalCapacity > 0 && (
          <span className="flex shrink-0 items-center gap-1.5 text-[14px] leading-5 text-[#f5f5f5]">
            <Users className="h-4 w-4 text-[#8a8a8a]" />
            {event.totalCapacity.toLocaleString()} seats
          </span>
        )}
      </div>

      <div
        ref={tabsRef}
        className="mt-6 flex scroll-mt-4 gap-7 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative shrink-0 pb-1.5 text-[14px] leading-5 transition-colors ${
                active
                  ? "font-medium text-[#f5f5f5]"
                  : "text-[#8a8a8a] hover:text-[#d4d4d4]"
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid items-start gap-7 @4xl:grid-cols-[minmax(0,1fr)_296px]">
        <div className="min-w-0">
          {tab === "overview" && (
            <div className="space-y-10">
              <AboutSection
                heading={view.aboutHeading}
                body={view.aboutBody}
                stats={view.stats}
                companies={view.companies}
              />
              {view.sessions.length > 0 && (
                <section>
                  <SectionHeading className="mb-5">What&apos;s on</SectionHeading>
                  <Agenda
                    view={view}
                    activeDay={activeDay}
                    onDayChange={setActiveDay}
                    limit={3}
                    onSeeAll={() => goTab("agenda")}
                  />
                </section>
              )}
              {view.speakers.length > 0 && (
                <section>
                  <SectionHeading className="mb-4">Featured speakers</SectionHeading>
                  <SpeakerGrid
                    speakers={view.speakers}
                    limit={8}
                    onSeeAll={() => goTab("speakers")}
                  />
                </section>
              )}
              {view.sponsors.length > 0 && (
                <section>
                  <SectionHeading className="mb-4">Sponsors</SectionHeading>
                  <SponsorWall
                    sponsors={view.sponsors}
                    limit={8}
                    onSeeAll={() => goTab("sponsors")}
                  />
                </section>
              )}
              <section>
                <SectionHeading className="mb-3">Venue</SectionHeading>
                <VenueCard event={event} note={view.venueNote} />
              </section>
              {view.faq.length > 0 && (
                <section>
                  <SectionHeading className="mb-4">FAQ</SectionHeading>
                  <FaqList items={view.faq} />
                </section>
              )}
            </div>
          )}

          {tab === "agenda" && (
            <section>
              <SectionHeading className="mb-5">Agenda</SectionHeading>
              <Agenda view={view} activeDay={activeDay} onDayChange={setActiveDay} />
            </section>
          )}

          {tab === "speakers" && (
            <section>
              <SectionHeading className="mb-4">Speakers</SectionHeading>
              <SpeakerGrid speakers={view.speakers} />
            </section>
          )}

          {tab === "sponsors" && (
            <section>
              <SectionHeading className="mb-4">Sponsors &amp; Expo</SectionHeading>
              <SponsorWall sponsors={view.sponsors} showBooths />
            </section>
          )}

          {tab === "venue" && (
            <div className="space-y-10">
              <section>
                <SectionHeading className="mb-3">Venue</SectionHeading>
                <VenueCard event={event} note={view.venueNote} />
              </section>
              {view.faq.length > 0 && (
                <section>
                  <SectionHeading className="mb-4">FAQ</SectionHeading>
                  <FaqList items={view.faq} />
                </section>
              )}
            </div>
          )}
        </div>

        {/* First on a narrow screen: buying shouldn't sit below the whole page. */}
        <aside className="order-first space-y-4 @4xl:sticky @4xl:top-6 @4xl:order-none">
          <TicketPanel
            event={event}
            tiers={data.tiers}
            popularTierId={view.popularTierId}
            note={view.ticketNote}
            onBuy={(tierId) => onGetTickets(event.slug || slug, tierId)}
          />
          <SharePanel share={share} name={event.name} />
        </aside>
      </div>
    </div>
  );
}

// ── Derived view ─────────────────────────────────────────────────────────

type Stat = { value: string; label: string };

function derive(data: PublicEventPayload) {
  const { event, website } = data;
  const block = (type: string) => website.blocks.find((b) => b.type === type);
  const hero = block("hero");
  const about = block("about");
  const tickets = block("tickets");
  const faqBlock = block("faq");
  const venue = block("venue_map");

  const sessions = [...data.sessions].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  const talks = sessions.filter((s) => s.sessionType !== "break");

  // Keynotes first, then the organizer's order — same as the public site.
  const speakers = [...data.speakers].sort(
    (a, b) =>
      Number(!!b.isKeynote) - Number(!!a.isKeynote) || a.sortOrder - b.sortOrder
  );
  const sponsors = [...data.sponsors].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  const byDay = new Map<string, AgendaSession[]>();
  sessions.forEach((s) => {
    const key = dayKey(s.startTime);
    byDay.set(key, [...(byDay.get(key) || []), s]);
  });

  // Track colours the way the founder's agenda assigns them: the first colour
  // any session of the track sets, else a palette slot by order of appearance
  // (unnamed sessions count as "Main Stage", as they do there).
  const trackOrder: string[] = [];
  const explicitColor = new Map<string, string>();
  talks.forEach((s) => {
    const name = s.stageName || "Main Stage";
    if (!trackOrder.includes(name)) trackOrder.push(name);
    if (s.trackColor && !explicitColor.has(name)) explicitColor.set(name, s.trackColor);
  });
  const trackColor = new Map(
    trackOrder.map((name, i) => [
      name,
      explicitColor.get(name) || TRACK_COLORS[i % TRACK_COLORS.length],
    ])
  );

  const companies: string[] = [];
  const seen = new Set<string>();
  speakers.forEach((s) => {
    const c = (s.company || "").trim();
    if (!c || seen.has(c.toLowerCase())) return;
    seen.add(c.toLowerCase());
    companies.push(c);
  });

  // Capacity, not attendance: registrations aren't public, and "1,800 seats"
  // is a promise the organizer made where "1,800 attending" would be invented.
  const dayTotal = dayCount(event);
  const stats: Stat[] = [
    { value: dayTotal, label: dayTotal === 1 ? "Day" : "Days" },
    { value: talks.length, label: talks.length === 1 ? "Session" : "Sessions" },
    { value: speakers.length, label: speakers.length === 1 ? "Speaker" : "Speakers" },
    { value: event.totalCapacity, label: "Seats" },
  ]
    .filter((s) => s.value > 0)
    .map((s) => ({ value: s.value.toLocaleString(), label: s.label }));

  const venueLine = placeName(event);
  const venueNote = String(venue?.content?.subheading || "").trim();

  const gst = event.addGstForIndianBuyers
    ? event.gstInclusive
      ? "Prices include 18% GST for buyers in India"
      : "18% GST added at checkout for buyers in India"
    : "";

  return {
    subheadline: String(hero?.content?.subheadline || event.shortDescription || ""),
    aboutHeading: String(about?.content?.heading || "About the event"),
    aboutBody: String(about?.content?.body || event.description || event.shortDescription || ""),
    stats,
    companies: companies.slice(0, 8),
    sessions,
    days: Array.from(byDay.entries()),
    speakers,
    speakerById: new Map(speakers.map((s) => [s._id, s])),
    trackColor,
    sponsors,
    faq: (Array.isArray(faqBlock?.content?.items) ? faqBlock!.content.items : []).filter(
      (i: { q?: string }) => i && String(i.q || "").trim()
    ) as Array<{ q: string; a: string }>,
    // The builder seeds the venue subheading with the venue line itself;
    // only show it when the organizer actually wrote something.
    venueNote:
      venueNote && venueNote.toLowerCase() !== venueLine.toLowerCase() &&
      !venueNote.toLowerCase().startsWith(venueLine.toLowerCase() + ",")
        ? venueNote
        : "",
    popularTierId: (tickets?.content?.popularTierId as string | undefined) || undefined,
    ticketNote: [gst, String(tickets?.content?.note || "").trim()]
      .filter(Boolean)
      .join(" · "),
  };
}

type View = ReturnType<typeof derive>;

// ── Chrome ───────────────────────────────────────────────────────────────

function Breadcrumb({
  rootLabel,
  current,
  onBack,
}: {
  rootLabel: string;
  current?: string;
  onBack: () => void;
}) {
  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-[12px] leading-4">
      <button
        type="button"
        onClick={onBack}
        className="shrink-0 text-[#8a8a8a] transition-colors hover:text-[#f5f5f5]"
      >
        {rootLabel}
      </button>
      {current && (
        <>
          <ChevronRight className="h-3 w-3 shrink-0 text-[#5c5c5c]" />
          <span className="truncate text-[#f5f5f5]">{current}</span>
        </>
      )}
    </nav>
  );
}

function Hero({
  event,
  subheadline,
  shareUrl,
}: {
  event: EventProgram;
  subheadline: string;
  shareUrl: string;
}) {
  const where =
    event.format === "virtual"
      ? "Online"
      : [
          (event.venue?.city || event.venue?.name || "").trim(),
          event.format === "hybrid" ? "Online" : "",
        ]
          .filter(Boolean)
          .join(" + ");

  return (
    <div className="relative mt-7 h-[277px] overflow-hidden rounded-xl border border-[#262626] bg-[#1c1c1c]">
      <EventCover src={event.bannerUrl} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />

      <div className="absolute right-5 top-5">
        <button
          type="button"
          aria-label="Copy event link"
          disabled={!shareUrl}
          onClick={async () => {
            const ok = await copyToClipboard(shareUrl);
            if (ok) toast.success("Link copied");
            else toast.error("Couldn't copy the link");
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
        <p className="text-[11px] font-bold uppercase leading-4 tracking-[0.1em] text-brand">
          {[dateRange(event.startsAt, event.endsAt, "long"), where]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h1 className="mt-2 text-[28px] font-bold leading-[34px] text-white">
          {event.name}
        </h1>
        {subheadline && (
          <p className="mt-1.5 line-clamp-2 max-w-3xl text-[13px] leading-5 text-white/75">
            {subheadline}
          </p>
        )}
      </div>
    </div>
  );
}

function OrgAvatar({ icon, name }: { icon?: string; name: string }) {
  if (icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={icon} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-brand-foreground">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function MoreLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-brand transition-opacity hover:opacity-80"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────

function AboutSection({
  heading,
  body,
  stats,
  companies,
}: {
  heading: string;
  body: string;
  stats: Stat[];
  companies: string[];
}) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (!paragraphs.length && !stats.length && !companies.length) return null;

  return (
    <section className="space-y-10">
      {paragraphs.length > 0 && (
        <div>
          <SectionHeading>{heading}</SectionHeading>
          <div className="mt-2.5 space-y-3.5">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line text-[13px] leading-[21px] text-[#a3a3a3]">
                {p}
              </p>
            ))}
          </div>
        </div>
      )}

      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3.5 @2xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-[#262626] px-[18px] pb-4 pt-4">
              <div className="text-[28px] font-semibold leading-[34px] tracking-tight text-[#f5f5f5] tabular-nums">
                {s.value}
              </div>
              <div className="mt-1 text-[13px] leading-5 text-[#8a8a8a]">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {companies.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b6b6b]">
            Speakers from
          </p>
          <div className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
            {companies.map((c) => (
              <span key={c} className="text-[15px] font-bold text-[#6b6b6b]">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Agenda ───────────────────────────────────────────────────────────────

function Agenda({
  view,
  activeDay,
  onDayChange,
  limit,
  onSeeAll,
}: {
  view: View;
  activeDay: number;
  onDayChange: (day: number) => void;
  limit?: number;
  onSeeAll?: () => void;
}) {
  const days = view.days;
  const index = Math.min(activeDay, Math.max(0, days.length - 1));
  const items = days[index]?.[1] || [];
  const visible = limit ? items.slice(0, limit) : items;
  const hiddenCount = view.sessions.length - visible.length;

  return (
    <>
      {days.length > 1 && (
        <div className="mb-5 inline-flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-[#232323] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {days.map(([key], i) => {
            const d = new Date(`${key}T00:00:00`);
            const active = i === index;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onDayChange(i)}
                className={`h-[23px] shrink-0 rounded px-3 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-[#2e2e2e] text-[#f5f5f5]"
                    : "text-[#8a8a8a] hover:text-[#d4d4d4]"
                }`}
              >
                Day {i + 1} · {d.getDate()}{" "}
                {d.toLocaleDateString("en-US", { month: "short" })}
              </button>
            );
          })}
        </div>
      )}

      <ol className="space-y-3.5">
        {visible.map((s) =>
          s.sessionType === "break" ? (
            <li
              key={s._id}
              className="flex items-center gap-3 rounded-lg border border-dashed border-[#2a2a2a] px-[18px] py-2.5 text-[13px]"
            >
              <span className="font-semibold tabular-nums text-[#bdbdbd]">
                {clock(s.startTime)} - {clock(s.endTime)}
              </span>
              <span className="truncate text-[#8a8a8a]">{s.title || "Break"}</span>
            </li>
          ) : (
            <SessionCard key={s._id} session={s} view={view} />
          )
        )}
      </ol>

      {onSeeAll && hiddenCount > 0 && (
        <MoreLink onClick={onSeeAll}>See full agenda</MoreLink>
      )}
    </>
  );
}

function SessionCard({ session: s, view }: { session: AgendaSession; view: View }) {
  const duration = durationLabel(s.startTime, s.endTime);
  const color = s.stageName ? view.trackColor.get(s.stageName) : undefined;
  const people = (s.speakerIds || [])
    .map((id) => view.speakerById.get(id))
    .filter((p): p is EventSpeaker => !!p);
  const tag = s.isLivestreamed ? "Live-streamed" : s.isRecorded ? "Recorded" : "";

  return (
    <li className="rounded-lg border border-[#262626] bg-[#202020] px-[18px] pb-4 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[14px] font-semibold leading-5 tabular-nums text-[#f5f5f5]">
            {clock(s.startTime)} - {clock(s.endTime)}
          </span>
          {duration && (
            <span className="rounded bg-[#2a2a2a] px-1.5 py-0.5 text-[11px] leading-4 text-[#8a8a8a]">
              {duration}
            </span>
          )}
          {s.room && (
            <>
              <span className="h-[3px] w-[3px] rounded-full bg-[#5c5c5c]" />
              <span className="text-[13px] leading-5 text-[#8a8a8a]">{s.room}</span>
            </>
          )}
        </div>
        {s.stageName && (
          <span
            className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase leading-[14px] tracking-[0.06em]"
            style={{ borderColor: color, color }}
          >
            {s.stageName}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-[16px] font-semibold leading-[22px] text-[#f5f5f5]">
        {s.title}
      </h3>
      {s.description && (
        <p className="mt-1 text-[13px] leading-5 text-[#8a8a8a]">{s.description}</p>
      )}

      {(people.length > 0 || tag) && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <SpeakerStack people={people} />
          {tag && (
            <span className="shrink-0 rounded-full bg-[#2a2a2a] px-2.5 py-0.5 text-[12px] leading-5 text-[#bdbdbd]">
              {tag}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function SpeakerStack({ people }: { people: EventSpeaker[] }) {
  if (!people.length) return <span />;
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  const text =
    people.length === 1
      ? people[0].name
      : people.length === 2
        ? `${people[0].name} & ${people[1].name}`
        : extra > 0
          ? `+${extra} speakers`
          : `${people.length} speakers`;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex shrink-0 -space-x-1.5">
        {shown.map((p) =>
          p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p._id}
              src={p.avatarUrl}
              alt=""
              className="h-5 w-5 rounded-full object-cover ring-2 ring-[#202020]"
            />
          ) : (
            <span
              key={p._id}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2e2e2e] text-[9px] font-semibold text-[#bdbdbd] ring-2 ring-[#202020]"
            >
              {p.name.slice(0, 1).toUpperCase()}
            </span>
          )
        )}
      </div>
      <span className="truncate text-[12px] text-[#6b6b6b]">{text}</span>
    </div>
  );
}

// ── Speakers ─────────────────────────────────────────────────────────────

/** Socials are typed by organizers, often without a scheme. */
function externalHref(url?: string) {
  const raw = (url || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function SpeakerGrid({
  speakers,
  limit,
  onSeeAll,
}: {
  speakers: EventSpeaker[];
  limit?: number;
  onSeeAll?: () => void;
}) {
  const visible = limit ? speakers.slice(0, limit) : speakers;
  return (
    <>
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-4 @2xl:grid-cols-4">
        {visible.map((s) => {
          const socials = [
            { href: s.socials?.linkedin, label: "LinkedIn", icon: <LinkedInGlyph className="h-3 w-3" /> },
            { href: s.socials?.twitter, label: "X", icon: <XLogo className="h-[11px] w-[11px]" /> },
            { href: s.socials?.instagram, label: "Instagram", icon: <Instagram className="h-3 w-3" /> },
            { href: s.socials?.website, label: "Website", icon: <Globe className="h-3 w-3" /> },
          ].filter((x) => externalHref(x.href));

          return (
            <article key={s._id} className="min-w-0">
              <div className="aspect-[1.1] overflow-hidden rounded-[10px] bg-[#262626]">
                {s.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.avatarUrl} alt={s.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-[#5c5c5c]">
                    {s.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <h3 className="mt-2.5 truncate text-[14px] font-semibold leading-5 text-[#f5f5f5]">
                {s.name}
              </h3>
              {s.role && (
                <p className="mt-0.5 truncate text-[12px] leading-4 text-[#8a8a8a]">{s.role}</p>
              )}
              {s.company && (
                <p className="truncate text-[12px] leading-4 text-[#6b6b6b]">{s.company}</p>
              )}
              {socials.length > 0 && (
                <div className="mt-2.5 flex items-center gap-2.5 text-[#6b6b6b]">
                  {socials.map((x) => (
                    <a
                      key={x.label}
                      href={externalHref(x.href)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${s.name} on ${x.label}`}
                      className="transition-colors hover:text-[#f5f5f5]"
                    >
                      {x.icon}
                    </a>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {onSeeAll && limit && speakers.length > limit && (
        <MoreLink onClick={onSeeAll}>All {speakers.length} speakers</MoreLink>
      )}
    </>
  );
}

// ── Sponsors ─────────────────────────────────────────────────────────────

/**
 * Sponsors as logo + name, no card around them. One uniform list: sponsors
 * are no longer banded by tier anywhere — the founder console dropped the
 * field — so a platinum/gold split here would only reflect stale data.
 */
function SponsorWall({
  sponsors,
  limit,
  onSeeAll,
  showBooths,
}: {
  sponsors: EventSponsor[];
  limit?: number;
  onSeeAll?: () => void;
  showBooths?: boolean;
}) {
  const visible = limit ? sponsors.slice(0, limit) : sponsors;
  const hasBooths = sponsors.some((s) => s.boothNumber);
  return (
    <>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 @2xl:grid-cols-3">
        {visible.map((s) => {
          const content = (
            <>
              <SponsorMark sponsor={s} />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold leading-5 text-[#e5e5e5]">
                  {s.name}
                </span>
                {showBooths && s.boothNumber && (
                  <span className="block text-[11px] leading-4 text-[#6b6b6b]">
                    Booth {s.boothNumber}
                  </span>
                )}
              </span>
            </>
          );
          return s.websiteUrl ? (
            <a
              key={s._id}
              href={externalHref(s.websiteUrl)}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80"
            >
              {content}
            </a>
          ) : (
            <div key={s._id} className="flex min-w-0 items-center gap-3">
              {content}
            </div>
          );
        })}
      </div>
      {onSeeAll && ((limit && sponsors.length > limit) || hasBooths) && (
        <MoreLink onClick={onSeeAll}>Explore the expo</MoreLink>
      )}
    </>
  );
}

/**
 * A sponsor's logo as a rounded icon.
 *
 * Square logos fill the tile edge to edge, so a mark that ships on its own
 * white background reads as an app icon rather than a picture on a card.
 * Wider or taller ones (wordmarks) are fitted whole on white instead, since
 * filling would crop them.
 */
function SponsorMark({ sponsor }: { sponsor: EventSponsor }) {
  const [failed, setFailed] = useState(false);
  const [square, setSquare] = useState(true);

  if (sponsor.logoUrl && !failed) {
    return (
      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sponsor.logoUrl}
          alt=""
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            setSquare(!!h && w / h >= 0.8 && w / h <= 1.25);
          }}
          onError={() => setFailed(true)}
          className={`h-full w-full ${square ? "object-cover" : "object-contain p-1.5"}`}
        />
      </span>
    );
  }

  const initials = sponsor.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#262626] text-[13px] font-bold text-[#9a9a9a]">
      {initials || "•"}
    </span>
  );
}

// ── Venue & FAQ ──────────────────────────────────────────────────────────

function VenueCard({ event, note }: { event: EventProgram; note: string }) {
  const v = event.venue || {};

  if (event.format === "virtual") {
    return (
      <div className="rounded-xl border border-[#262626] bg-[#202020] p-5">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-brand" />
          <h3 className="text-[16px] font-semibold leading-[22px] text-[#f5f5f5]">Online</h3>
        </div>
        <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#8a8a8a]">
          {event.streaming?.streamType === "external_link"
            ? "The organizer shares the stream link by email once your registration is confirmed."
            : "Your seat opens inside Garage. When the event goes live, join from the link in your confirmation email."}
        </p>
        {note && <p className="mt-3 text-[11px] leading-[18px] text-[#6b6b6b]">{note}</p>}
      </div>
    );
  }

  const address = [v.addressLine1, v.city, v.state, v.postcode, v.country]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(", ");
  // Coordinates win over the text address — the organizer placed that pin.
  const mapsQuery = encodeURIComponent(
    typeof v.coordinates?.lat === "number" && typeof v.coordinates?.lng === "number"
      ? `${v.coordinates.lat},${v.coordinates.lng}`
      : [v.name, address].filter(Boolean).join(", ") || event.name
  );
  const pinColor = typeof window !== "undefined" ? getBrandHex() : undefined;

  return (
    <div className="grid gap-5 rounded-xl border border-[#262626] bg-[#202020] p-5 @2xl:grid-cols-[minmax(0,1fr)_240px]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-brand" />
          <h3 className="truncate text-[16px] font-semibold leading-[22px] text-[#f5f5f5]">
            {placeName(event) || "Venue to be announced"}
          </h3>
        </div>
        {address && (
          <p className="mt-3 text-[12px] leading-5 text-[#8a8a8a]">{address}</p>
        )}
        {(note || event.format === "hybrid") && (
          <>
            <div className="my-3.5 h-px bg-[#2a2a2a]" />
            {note && <p className="text-[11px] leading-[18px] text-[#6b6b6b]">{note}</p>}
            {event.format === "hybrid" && (
              <p className={`text-[11px] leading-[18px] text-[#6b6b6b] ${note ? "mt-1.5" : ""}`}>
                Can&apos;t make it in person? This event also streams online.
              </p>
            )}
          </>
        )}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
          target="_blank"
          rel="noreferrer"
          className={cn(OUTLINE_BUTTON, "mt-3.5 px-3.5 text-[12px]")}
        >
          <Navigation className="h-3.5 w-3.5" />
          Get directions
        </a>
      </div>
      <div className="overflow-hidden rounded-lg border border-[#262626]">
        <EventVenueMap
          coordinates={v.coordinates}
          label={v.name}
          height={190}
          variant="dark"
          pinColor={pinColor}
        />
      </div>
    </div>
  );
}

function FaqList({ items }: { items: Array<{ q: string; a: string }> }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={`${item.q}-${i}`} className="rounded-lg border border-[#262626] bg-[#202020]">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-3.5 py-[11px] text-left"
            >
              <span className="text-[14px] font-semibold leading-5 text-[#f5f5f5]">{item.q}</span>
              <ChevronDown
                strokeWidth={1.75}
                className={`h-4 w-4 shrink-0 text-[#8a8a8a] transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen && item.a && (
              <p className="-mt-1 whitespace-pre-line px-3.5 pb-3.5 text-[13px] leading-[21px] text-[#8a8a8a]">
                {item.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────

function TicketPanel({
  event,
  tiers,
  popularTierId,
  note,
  onBuy,
}: {
  event: PublicEventPayload["event"];
  tiers: PublicTierPayload[];
  popularTierId?: string;
  note: string;
  onBuy: (tierId?: string) => void;
}) {
  const ended = hasEnded(event);
  const live = isLive(event);

  // "Sale ends" only when every pass on sale has a close date; otherwise
  // sales run up to the event, and the start is the honest deadline.
  const salesClose = useMemo(() => {
    const onSale = tiers.filter((t) => t.onSale);
    if (!onSale.length || onSale.some((t) => !t.salesEnd)) return null;
    const last = Math.max(...onSale.map((t) => new Date(t.salesEnd!).getTime()));
    return last > Date.now() ? last : null;
  }, [tiers]);

  const target = ended || live ? null : (salesClose ?? new Date(event.startsAt).getTime());
  const countdown = useCountdown(target);
  const label = ended
    ? "This event has ended"
    : live
      ? "Happening now"
      : salesClose
        ? "Ticket sale ends in"
        : "Event starts in";

  const available = tiers.filter((t) => t.onSale && !t.soldOut);
  const cta = ended
    ? "Event has ended"
    : !tiers.length
      ? "Tickets coming soon"
      : !available.length
        ? tiers.every((t) => t.soldOut)
          ? "Sold out"
          : "Not on sale"
        : event.requireApproval
          ? "Request to attend"
          : available.every((t) => t.price <= 0)
            ? "Register"
            : "Get tickets";

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#262626] p-5">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">
        {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />}
        {label}
      </p>
      {target != null && (
        <div className="mt-3 grid grid-cols-4 text-center">
          {(
            [
              ["Days", countdown?.days],
              ["Hrs", countdown?.hours],
              ["Mins", countdown?.minutes],
              ["Secs", countdown?.seconds],
            ] as const
          ).map(([unit, value]) => (
            <div key={unit}>
              <div className="text-[22px] font-bold leading-7 tabular-nums text-[#f5f5f5]">
                {value == null ? "--" : pad(value)}
              </div>
              <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.1em] text-[#6b6b6b]">
                {unit}
              </div>
            </div>
          ))}
        </div>
      )}

      {tiers.length > 0 && (
        <>
          <div className="mb-3 mt-4 h-px bg-[#2a2a2a]" />
          <div className="space-y-1">
            {tiers.map((t) => {
              const canBuy = t.onSale && !t.soldOut && !ended;
              const status = t.soldOut
                ? "Sold out"
                : t.isPaused
                  ? "Sales paused"
                  : !t.onSale
                    ? "Not on sale"
                    : null;
              return (
                <button
                  key={t._id}
                  type="button"
                  disabled={!canBuy}
                  onClick={() => onBuy(t._id)}
                  className="-mx-2 flex w-[calc(100%+16px)] items-start justify-between gap-3 rounded-md px-2 py-1 text-left transition-colors enabled:hover:bg-white/[0.03] disabled:cursor-default"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`truncate text-[13px] font-medium leading-5 ${
                          canBuy ? "text-[#f5f5f5]" : "text-[#5c5c5c]"
                        }`}
                      >
                        {t.name}
                      </span>
                      {canBuy && t._id === popularTierId && (
                        <span className="shrink-0 rounded bg-brand/15 px-1.5 py-px text-[10px] font-medium leading-4 text-brand">
                          Most popular
                        </span>
                      )}
                    </div>
                    {canBuy && t.remaining < SHOW_REMAINING_BELOW && (
                      <p className="mt-0.5 text-[11px] leading-4 text-[#6b6b6b]">
                        {t.remaining} left
                      </p>
                    )}
                  </div>
                  {status ? (
                    <span className="mt-0.5 shrink-0 rounded bg-[#2e2e2e] px-1.5 py-0.5 text-[10px] leading-4 text-[#6b6b6b]">
                      {status}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[15px] font-bold leading-5 text-[#f5f5f5]">
                      {t.price > 0 ? money(t.price, t.currency) : "Free"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <button
        type="button"
        disabled={!available.length || ended}
        onClick={() => onBuy()}
        className="mt-4 h-9 w-full rounded-lg bg-brand text-[14px] font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[#2e2e2e] disabled:text-[#6b6b6b] disabled:hover:opacity-100"
      >
        {cta}
      </button>

      {note && (
        <p className="mt-3 text-center text-[11px] leading-4 text-[#6b6b6b]">{note}</p>
      )}
    </section>
  );
}

function SharePanel({
  share,
  name,
}: {
  share: ReturnType<typeof useEventShareUrl>;
  name: string;
}) {
  const { url, affiliateId, loading } = share;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!url) return;
    const ok = await copyToClipboard(url);
    if (!ok) {
      toast.error("Couldn't copy the link");
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const targets = url ? shareTargets(url, `${name} — I thought you'd want to be there.`) : [];
  const hrefOf = (key: string) => targets.find((t) => t.key === key)?.href;
  const channels = [
    { key: "whatsapp", label: "WhatsApp", icon: <WhatsAppIcon className="h-4 w-4" /> },
    { key: "linkedin", label: "LinkedIn", icon: <LinkedInGlyph className="h-4 w-4" /> },
    { key: "x", label: "X", icon: <XLogo className="h-3.5 w-3.5" /> },
    { key: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
  ];

  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#262626] p-5">
      <h3 className="text-[14px] font-semibold leading-5 text-[#f5f5f5]">
        Earn when your network attends
      </h3>
      <p className="mt-1 text-[12px] leading-[18px] text-[#8a8a8a]">
        {affiliateId
          ? "Share your link — you earn commission on every ticket bought through it."
          : "Share this event with your network."}
      </p>

      <div className="mt-4 flex h-[38px] items-center gap-2 rounded-lg border border-[#2e2e2e] bg-[#202020] pl-3 pr-1">
        <span className="min-w-0 flex-1 truncate text-[12px] text-[#bdbdbd]">
          {loading ? "Preparing your link…" : displayUrl(url)}
        </span>
        <button
          type="button"
          onClick={copy}
          disabled={!url || loading}
          className="h-7 shrink-0 rounded-md border border-[#3a3a3a] bg-[#262626] px-2.5 text-[12px] font-semibold text-[#f5f5f5] transition-colors hover:bg-[#2e2e2e] disabled:opacity-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b6b6b]">
          Or share via
        </span>
        <div className="flex items-center gap-3.5 text-[#8a8a8a]">
          {channels.map((c) => {
            const href = hrefOf(c.key);
            return href ? (
              <a
                key={c.key}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`Share on ${c.label}`}
                className="transition-colors hover:text-[#f5f5f5]"
              >
                {c.icon}
              </a>
            ) : (
              <span key={c.key} aria-hidden className="opacity-40">
                {c.icon}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
