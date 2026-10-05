"use client";

// Attendee-facing Events: Discover.
//
// No founder functionality at all — browse the office's published events,
// open one, and buy it without leaving the app (see EventCheckoutView, which
// runs the same checkout API as the public /events/[slug] page).
//
// Top to bottom: filters, the featured event, then what's on this week and
// everything after it. The featured slot is meant to hold the office's
// most-viewed event, but nothing records event views yet, so it holds the
// soonest one.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Copy,
  Link as LinkIcon,
  MapPin,
  Search,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard, withAffiliateRef } from "@/lib/affiliate-share";
import { cn } from "@/lib/utils";
import {
  browsePublicEvents,
  getPublicEvent,
  type BrowseEvent,
  type PublicEventPayload,
} from "./api";
import { EVENT_CATEGORIES, useHideBottomBar } from "./ui";
import {
  type DateFilter,
  dateRange,
  dayMonth,
  endOfWeek,
  fromPriceLabel,
  isLive,
  locationLabel,
  matchesDate,
  timeToGo,
} from "./browse-format";
import {
  BookmarkButton,
  CARD_GRID,
  CardSkeleton,
  EmptyPanel,
  EventCard,
  EventCover,
  FilterDropdown,
  OUTLINE_BUTTON,
  PAGE,
  SectionHeading,
  useEventShareUrl,
  useSavedEvents,
} from "./browse-ui";
import EventFlowView from "./EventFlowView";

const DATE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "weekend", label: "This weekend" },
  { value: "month", label: "This month" },
];

const PRICE_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

/** Online-attendable: fully virtual, or hybrid with a stream. */
const isOnline = (e: BrowseEvent) => e.format !== "in_person";

export default function EventsBrowse({
  onOpenPurchases,
}: {
  /** Switches the dashboard to Events → Purchases. */
  onOpenPurchases?: () => void;
} = {}) {
  const [events, setEvents] = useState<BrowseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  // A failed load and an empty catalogue are different things, and rendering
  // both as "No events scheduled" is how a broken request reads as "nothing
  // is on" to an attendee.
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  // "" | "online" | a city name
  const [location, setLocation] = useState("");
  const [date, setDate] = useState<DateFilter>("");
  const [price, setPrice] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);

  // The event on screen; `checkout` when it was opened straight into buying.
  const [open, setOpen] = useState<{ slug: string; checkout: boolean } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // Landing payloads fetched ahead of a click (the featured event), handed to
  // the event page so opening it doesn't refetch.
  const [prefetched, setPrefetched] = useState<Record<string, PublicEventPayload>>({});

  const { saved, toggle } = useSavedEvents();
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // One page of every upcoming event (the API's cap); search and filters
      // run client-side over it so they can reach fields the API doesn't.
      const res = await browsePublicEvents({ when: "upcoming", limit: 60 });
      setEvents(res.events || []);
    } catch (err) {
      const message = (err instanceof Error && err.message) || "Could not load events";
      setEvents([]);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The bottom bar's "Discover" tab brings a user on an event back here.
  useEffect(() => {
    const onShowDiscover = () => setOpen(null);
    window.addEventListener("events:show-discover", onShowDiscover);
    return () => window.removeEventListener("events:show-discover", onShowDiscover);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [open]);

  // Upcoming only, soonest first — which is also how the API sorts them.
  const featured = events[0];

  useEffect(() => {
    if (!featured || prefetched[featured.slug]) return;
    let alive = true;
    getPublicEvent(featured.slug)
      .then((res) => {
        if (alive) setPrefetched((p) => ({ ...p, [featured.slug]: res }));
      })
      .catch(() => {
        // The card still renders without its host line.
      });
    return () => {
      alive = false;
    };
  }, [featured, prefetched]);

  const categories = useMemo(() => {
    const present = new Set(
      events.map((e) => (e.category || "").trim()).filter(Boolean)
    );
    const known = EVENT_CATEGORIES.filter((c) => present.has(c));
    const other = [...present].filter((c) => !EVENT_CATEGORIES.includes(c)).sort();
    return [...known, ...other];
  }, [events]);

  const cities = useMemo(() => {
    const byKey = new Map<string, string>();
    events
      .filter((e) => e.format !== "virtual")
      .forEach((e) => {
        const city = (e.venue?.city || "").trim();
        if (city && !byKey.has(city.toLowerCase())) byKey.set(city.toLowerCase(), city);
      });
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }, [events]);

  const anyOnline = events.some(isOnline);
  const anySaved = events.some((e) => saved.has(e._id));

  const filtering = Boolean(
    search.trim() || category || location || date || price || savedOnly
  );

  const { thisWeek, later } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const matches = events.filter((e) => {
      if (q) {
        const haystack = [
          e.name,
          e.shortDescription,
          e.category,
          e.venue?.name,
          e.venue?.city,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (category && e.category !== category) return false;
      if (location === "online" && !isOnline(e)) return false;
      if (
        location &&
        location !== "online" &&
        (e.format === "virtual" ||
          (e.venue?.city || "").trim().toLowerCase() !== location.toLowerCase())
      ) {
        return false;
      }
      if (!matchesDate(e, date, now)) return false;
      if (price === "free" && e.fromPrice !== 0) return false;
      if (price === "paid" && !(e.fromPrice != null && e.fromPrice > 0)) return false;
      if (savedOnly && !saved.has(e._id)) return false;
      return true;
    });
    // The featured event stands on its own until a filter is applied; then it
    // is just another result.
    const listed = filtering ? matches : matches.filter((e) => e._id !== featured?._id);
    const weekEnd = endOfWeek(now);
    return {
      thisWeek: listed.filter((e) => new Date(e.startsAt) <= weekEnd),
      later: listed.filter((e) => new Date(e.startsAt) > weekEnd),
    };
  }, [events, search, category, location, date, price, savedOnly, saved, filtering, featured]);

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setLocation("");
    setDate("");
    setPrice("");
    setSavedOnly(false);
  };

  const card = (e: BrowseEvent) => {
    const priceText = e.soldOut ? "Sold out" : fromPriceLabel(e.fromPrice, e.currency);
    return (
      <EventCard
        key={e._id}
        image={e.bannerUrl}
        label={[isLive(e) ? "Live now" : dayMonth(e.startsAt), e.category]
          .filter(Boolean)
          .join(" · ")}
        title={e.name}
        subtitle={locationLabel(e)}
        onOpen={() => setOpen({ slug: e.slug, checkout: false })}
        corner={
          <BookmarkButton
            saved={saved.has(e._id)}
            onToggle={() => toggle(e._id)}
            className="h-[26px] w-[26px]"
          />
        }
        footer={
          priceText && (
            <p
              className={`text-[12px] font-semibold leading-4 ${
                e.soldOut ? "text-[#8a8a8a]" : "text-[#f5f5f5]"
              }`}
            >
              {priceText}
            </p>
          )
        }
      />
    );
  };

  // ── One event ──────────────────────────────────────────────────────────
  if (open) {
    return (
      <div ref={scrollRef} className="h-full w-full overflow-y-auto bg-[#181818]">
        <EventFlowView
          key={`${open.slug}:${open.checkout}`}
          slug={open.slug}
          rootLabel="Discover"
          startInCheckout={open.checkout}
          initial={prefetched[open.slug]}
          onBack={() => setOpen(null)}
          onOpenPurchases={onOpenPurchases}
          onScrollTop={() => scrollRef.current?.scrollTo({ top: 0 })}
        />
      </div>
    );
  }

  // ── Catalogue ──────────────────────────────────────────────────────────
  const allChipActive = !category && !savedOnly && location !== "online";
  const chipClass = (active: boolean) =>
    `h-[30px] shrink-0 rounded-full border px-3.5 text-[13px] transition-colors ${
      active
        ? "border-brand bg-brand/[0.06] text-brand"
        : "border-[#262626] text-[#bdbdbd] hover:border-[#333333] hover:text-[#f5f5f5]"
    }`;

  return (
    <div ref={scrollRef} className="h-full w-full overflow-y-auto bg-[#181818]">
      <div className={PAGE}>
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold leading-7 text-[#f5f5f5]">
              Discover events
            </h1>
            <p className="mt-1.5 text-[13px] leading-5 text-[#8a8a8a]">
              Workshops, summits and masterclasses from founders on Garage.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            disabled={!events.length}
            className={OUTLINE_BUTTON}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Share events
          </button>
        </header>

        <div className="mt-6 flex flex-col gap-2.5 @3xl:flex-row @3xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6b6b6b]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by event, topic or city"
              // `!` because globals.css pins inputs to 16px (unlayered) so
              // iOS doesn't zoom on focus; phones keep that, desktop gets 13px.
              className="h-[34px] w-full rounded-lg border border-[#262626] bg-[#202020] pl-8 pr-3 text-[#f5f5f5] outline-none transition-colors placeholder:text-[#5c5c5c] focus:border-[#3a3a3a] sm:text-[13px]!"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <FilterDropdown
              value={category}
              onChange={setCategory}
              placeholder="All types"
              options={categories.map((c) => ({ value: c, label: c }))}
            />
            <FilterDropdown
              value={location}
              onChange={setLocation}
              placeholder="All locations"
              options={[
                ...(anyOnline ? [{ value: "online", label: "Online" }] : []),
                ...cities.map((c) => ({ value: c, label: c })),
              ]}
            />
            <FilterDropdown
              value={date}
              onChange={(v) => setDate(v as DateFilter)}
              placeholder="Any date"
              options={DATE_OPTIONS}
              align="right"
            />
            <FilterDropdown
              value={price}
              onChange={setPrice}
              placeholder="Price"
              options={PRICE_OPTIONS}
              align="right"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCategory("");
              setSavedOnly(false);
              if (location === "online") setLocation("");
            }}
            className={chipClass(allChipActive)}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? "" : c)}
              className={chipClass(category === c)}
            >
              {c}
            </button>
          ))}
          {anyOnline && (
            <button
              type="button"
              onClick={() => setLocation(location === "online" ? "" : "online")}
              className={chipClass(location === "online")}
            >
              Online
            </button>
          )}
          {(anySaved || savedOnly) && (
            <button
              type="button"
              onClick={() => setSavedOnly((v) => !v)}
              className={chipClass(savedOnly)}
            >
              Saved
            </button>
          )}
        </div>

        {loading ? (
          <>
            <div className="mt-6 h-[243px] animate-pulse rounded-xl border border-[#262626] bg-[#202020]" />
            <div className={`mt-7 ${CARD_GRID}`}>
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </>
        ) : error ? (
          <div className="mt-6">
            <EmptyPanel
              icon={<CalendarDays className="h-10 w-10" strokeWidth={1.25} />}
              title="Could not load events"
              description={`${error}. This is a problem loading the list, not an empty calendar — try again.`}
              action={
                <button type="button" onClick={load} className={OUTLINE_BUTTON}>
                  Try again
                </button>
              }
            />
          </div>
        ) : events.length === 0 ? (
          <div className="mt-6">
            <EmptyPanel
              icon={<CalendarDays className="h-10 w-10" strokeWidth={1.25} />}
              title="No events scheduled"
              description="Published events show up here. Drafts and private events never do."
            />
          </div>
        ) : (
          <>
            {!filtering && featured && (
              <FeaturedEvent
                event={featured}
                payload={prefetched[featured.slug]}
                onOpen={() => setOpen({ slug: featured.slug, checkout: false })}
                onGetTickets={() => setOpen({ slug: featured.slug, checkout: true })}
              />
            )}

            {filtering && !thisWeek.length && !later.length ? (
              <div className="mt-6">
                <EmptyPanel
                  icon={<Search className="h-10 w-10" strokeWidth={1.25} />}
                  title="Nothing matches those filters"
                  description="Try a different search, or widen the date and location."
                  action={
                    <button type="button" onClick={clearFilters} className={OUTLINE_BUTTON}>
                      Clear filters
                    </button>
                  }
                />
              </div>
            ) : (
              <>
                {thisWeek.length > 0 && (
                  <section className="mt-7">
                    <SectionHeading className="mb-4">This week</SectionHeading>
                    <div className={CARD_GRID}>{thisWeek.map(card)}</div>
                  </section>
                )}
                {later.length > 0 && (
                  <section className="mt-7">
                    <SectionHeading className="mb-4">Upcoming</SectionHeading>
                    <div className={CARD_GRID}>{later.map(card)}</div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>

      {shareOpen && (
        <ShareEventsModal events={events} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}

// ── Featured ─────────────────────────────────────────────────────────────

function FeaturedEvent({
  event,
  payload,
  onOpen,
  onGetTickets,
}: {
  event: BrowseEvent;
  payload?: PublicEventPayload;
  onOpen: () => void;
  onGetTickets: () => void;
}) {
  const org = payload?.organization;
  const priceText = event.soldOut
    ? "Sold out"
    : fromPriceLabel(event.fromPrice, event.currency);

  return (
    <section className="mt-6 grid overflow-hidden rounded-xl border border-[#262626] bg-[#202020] @3xl:grid-cols-[47.8%_minmax(0,1fr)]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${event.name}`}
        className="group relative aspect-[16/9] overflow-hidden bg-[#1c1c1c] @3xl:aspect-[1.92]"
      >
        <EventCover
          src={event.bannerUrl}
          className="transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </button>

      <div className="flex min-w-0 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase leading-[14px] tracking-[0.12em] text-[#9a9a9a]">
            Featured · {dateRange(event.startsAt, event.endsAt)}
          </p>
          <span className="shrink-0 text-[11px] leading-[14px] text-[#6b6b6b]">
            {timeToGo(event)}
          </span>
        </div>
        <h2 className="mt-2.5 line-clamp-2 text-[18px] font-semibold leading-6 text-[#f5f5f5]">
          {event.name}
        </h2>
        {event.shortDescription && (
          <p className="mt-2 line-clamp-3 text-[13px] leading-[18px] text-[#9a9a9a]">
            {event.shortDescription}
          </p>
        )}

        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] leading-4 text-[#8a8a8a]">
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{locationLabel(event, "full")}</span>
            </span>
            {event.totalCapacity > 0 && (
              <span className="flex items-center gap-1.5">
                <Users className="h-3 w-3 shrink-0" />
                {event.totalCapacity.toLocaleString()} seats
              </span>
            )}
            {org?.name && (
              <span className="flex min-w-0 items-center gap-1.5">
                {org.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.icon} alt="" className="h-3.5 w-3.5 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-brand" />
                )}
                <span className="truncate">Hosted by {org.name}</span>
              </span>
            )}
          </div>

          <div className="mt-3.5 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onGetTickets}
              disabled={event.soldOut}
              className="h-[34px] rounded-md bg-brand px-4 text-[13px] font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Get tickets
            </button>
            <button
              type="button"
              onClick={onOpen}
              className="h-[34px] rounded-md border border-[#2e2e2e] px-4 text-[13px] font-medium text-[#f5f5f5] transition-colors hover:bg-white/[0.04]"
            >
              View event
            </button>
            {priceText && (
              <span className="ml-auto shrink-0 text-[15px] font-semibold text-[#f5f5f5]">
                {priceText}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Share ────────────────────────────────────────────────────────────────

/**
 * "Share events": a referral link for any event on the page. There is no
 * public catalogue page to link to, so each event is shared on its own.
 */
function ShareEventsModal({
  events,
  onClose,
}: {
  events: BrowseEvent[];
  onClose: () => void;
}) {
  useHideBottomBar(true);
  const { origin, affiliateId, loading } = useEventShareUrl();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async (e: BrowseEvent) => {
    const url = withAffiliateRef(`${origin}/events/${e.slug}`, affiliateId);
    if (!(await copyToClipboard(url))) {
      toast.error("Couldn't copy the link");
      return;
    }
    setCopiedId(e._id);
    window.setTimeout(() => setCopiedId((id) => (id === e._id ? null : id)), 2000);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[#262626] bg-[#1c1c1c] shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[#262626] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[#f5f5f5]">Share events</h2>
            <p className="mt-1 text-[12px] leading-[18px] text-[#8a8a8a]">
              {affiliateId
                ? "Links carry your referral code — you earn commission on tickets bought through them."
                : "Copy a link to any event."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#8a8a8a] transition-colors hover:bg-white/[0.05] hover:text-[#f5f5f5]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <ul className="flex-1 divide-y divide-[#262626] overflow-y-auto">
          {events.map((e) => (
            <li key={e._id} className="flex items-center gap-3 px-5 py-3">
              <div className="h-10 w-[72px] shrink-0 overflow-hidden rounded-md bg-[#262626]">
                <EventCover src={e.bannerUrl} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[#f5f5f5]">{e.name}</p>
                <p className="truncate text-[11px] text-[#8a8a8a]">
                  {dateRange(e.startsAt, e.endsAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copy(e)}
                disabled={loading}
                className={cn(OUTLINE_BUTTON, "h-7 shrink-0 px-2.5 text-[12px]")}
              >
                {copiedId === e._id ? (
                  <Check className="h-3.5 w-3.5 text-brand" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedId === e._id ? "Copied" : "Copy link"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
