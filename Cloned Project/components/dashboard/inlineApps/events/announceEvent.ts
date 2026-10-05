// The "published — now share it" popup for an event, from the create form and
// from the console's Publish button. Both have the saved event plus its ticket
// prices; this turns them into the popup's preview card.

import {
  formatSellablePrice,
  showSellablePublished,
} from "@/components/shared/SellablePublishedModal";
import type { EventProgram } from "./types";

const FORMAT_LABEL: Record<EventProgram["format"], string> = {
  in_person: "In person",
  hybrid: "Hybrid",
  virtual: "Online",
};

/** "Sat, Oct 12, 7:00 PM" in the event's own timezone. */
function whenLabel(event: EventProgram): string | null {
  const at = new Date(event.startsAt);
  if (Number.isNaN(at.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  try {
    return at.toLocaleString("en-US", { ...opts, timeZone: event.timezone || undefined });
  } catch {
    // An unknown timezone name — fall back to the viewer's own.
    return at.toLocaleString("en-US", opts);
  }
}

/** "Free", "$25", or "From $25" when the tiers are priced differently. */
function priceLabel(tickets: Array<{ price: number; currency: string }>): string | null {
  if (tickets.length === 0) return null;
  const sorted = [...tickets].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0];
  const label = formatSellablePrice(cheapest.price, cheapest.currency);
  const varied = sorted[sorted.length - 1].price !== cheapest.price;
  return varied && cheapest.price > 0 ? `From ${label}` : label;
}

export function announceEvent(
  event: EventProgram,
  tickets: Array<{ price: number; currency: string }>,
  opts: { draft: boolean; note?: string | null; bannerUrl?: string | null },
) {
  const city = event.venue?.city?.trim();
  const formatLabel = FORMAT_LABEL[event.format] || null;
  showSellablePublished({
    kind: "event",
    title: event.name,
    image: opts.bannerUrl || event.bannerUrl || null,
    url: `/events/${event.slug || event._id}`,
    price: priceLabel(tickets),
    facts: [
      whenLabel(event),
      formatLabel && city && event.format !== "virtual" ? `${formatLabel} · ${city}` : formatLabel,
    ],
    draft: opts.draft,
    note: opts.note,
  });
}
