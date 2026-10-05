"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  CalendarPlus,
  MapPin,
  CalendarDays,
  Clock,
  CheckCircle2,
  Clock3,
  XCircle,
} from "lucide-react";
import {
  getTicket,
  ticketCalendarUrl,
} from "@/components/dashboard/inlineApps/events/api";

// The attendee's ticket badge. The QR encodes the ticket URL (not the raw
// token) so a door scanner running any generic QR app lands on this page and
// sees the live status rather than an opaque string.
function qrSrc(url: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    url
  )}&margin=8&ecc=H`;
}

const ACCENT = "#FACC15";

export default function TicketClient({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getTicket>> | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    setPageUrl(window.location.href);
    getTicket(token)
      .then(setData)
      .catch((err) => setError(err?.message || "Ticket not found"));
  }, [token]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0c0c0e] px-6 text-center">
        <div>
          <XCircle className="mx-auto h-10 w-10 text-[#f87171]" strokeWidth={1.5} />
          <h1 className="mt-4 text-xl font-semibold text-white">Ticket not found</h1>
          <p className="mt-2 text-sm text-[#7c7d94]">
            This ticket link is invalid or has been revoked.
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0c0c0e]">
        <Loader2 className="h-7 w-7 animate-spin text-[#4f5065]" />
      </main>
    );
  }

  const { ticket, event } = data;
  const pending = ticket.status === "pending_approval";
  const rejected = ticket.status === "rejected" || ticket.status === "cancelled";

  return (
    <main className="min-h-screen bg-[#0c0c0e] px-5 py-12">
      <div className="mx-auto w-full max-w-md">
        <Link
          href={`/events/${slug}`}
          className="mb-6 inline-block text-xs text-[#7c7d94] hover:text-white"
        >
          ← Back to event
        </Link>

        <div className="overflow-hidden rounded-2xl border border-[#26262f] bg-[#141418]">
          {event?.bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.bannerUrl}
              alt=""
              className="h-32 w-full object-cover opacity-80"
            />
          )}

          <div className="p-7">
            <div className="flex items-center gap-2 text-xs">
              {pending ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#2a2a35] px-2.5 py-1 text-[#c7c7da]">
                  <Clock3 className="h-3 w-3" />
                  Awaiting approval
                </span>
              ) : rejected ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#3a1f1f] px-2.5 py-1 text-[#f87171]">
                  <XCircle className="h-3 w-3" />
                  Not valid
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium text-[#141418]"
                  style={{ background: ACCENT }}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Confirmed
                </span>
              )}
              {ticket.checkedInAt && (
                <span className="rounded-md bg-[#1f2d1f] px-2.5 py-1 text-[#4ade80]">
                  Checked in
                </span>
              )}
            </div>

            <h1 className="mt-5 text-xl font-semibold leading-snug text-white">
              {event?.name}
            </h1>

            <dl className="mt-5 space-y-2.5 text-sm text-[#9fa0b8]">
              <div className="flex items-center gap-2.5">
                <CalendarDays className="h-4 w-4" style={{ color: ACCENT }} />
                {event?.startsAt
                  ? new Date(event.startsAt).toLocaleDateString(undefined, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : ""}
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4" style={{ color: ACCENT }} />
                {event?.startsAt
                  ? new Date(event.startsAt).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : ""}
                {event?.timezone ? ` · ${event.timezone}` : ""}
              </div>
              {event?.venue?.name && (
                <div className="flex items-start gap-2.5">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: ACCENT }}
                  />
                  <span>
                    {[
                      event.venue.name,
                      event.venue.addressLine1,
                      event.venue.city,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}
            </dl>

            <div className="my-7 border-t border-dashed border-[#2a2a35]" />

            <div className="text-center">
              {pending ? (
                <p className="mx-auto max-w-xs text-sm leading-6 text-[#7c7d94]">
                  Your QR code appears here once the organizer approves your
                  registration.
                </p>
              ) : rejected ? (
                <p className="mx-auto max-w-xs text-sm leading-6 text-[#7c7d94]">
                  This registration is no longer valid.
                </p>
              ) : (
                <>
                  <div className="inline-block rounded-xl bg-white p-3">
                    {pageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrSrc(pageUrl)}
                        alt="Ticket QR code"
                        width={220}
                        height={220}
                      />
                    )}
                  </div>
                  <p className="mt-4 text-xs text-[#61627a]">
                    Show this at the door
                  </p>
                </>
              )}
            </div>

            <dl className="mt-7 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#7c7d94]">Attendee</dt>
                <dd className="text-[#e7e7ef]">{ticket.attendeeName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#7c7d94]">Ticket</dt>
                <dd className="text-[#e7e7ef]">
                  {ticket.tier?.name || "General admission"} × {ticket.quantity}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#7c7d94]">Reference</dt>
                <dd className="font-mono text-xs text-[#e7e7ef]">
                  {ticket.qrCodeToken.slice(0, 12)}
                </dd>
              </div>
            </dl>

            <a
              href={ticketCalendarUrl(token)}
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg border border-[#33333f] py-3 text-sm text-[#e7e7ef] transition-colors hover:bg-white/5"
            >
              <CalendarPlus className="h-4 w-4" />
              Add to calendar
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
