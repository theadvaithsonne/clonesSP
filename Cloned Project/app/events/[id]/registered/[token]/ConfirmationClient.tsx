"use client";

// The post-checkout receipt.
//
// Reached from the checkout page once the registration exists — after payment
// settles for a paid ticket, immediately for a free or approval-gated one.
// The live status comes from the public ticket endpoint; the money comes from
// the order the checkout cached for this tab (see orderCache), because the
// public endpoint deliberately doesn't expose pricing to anyone holding a QR
// token. No cache (a link opened on another device) simply hides the order
// block — everything else still renders.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  Check,
  Clock3,
  Copy,
  Loader2,
  QrCode,
  Share2,
  XCircle,
} from "lucide-react";
import {
  getTicket,
  ticketCalendarUrl,
} from "@/components/dashboard/inlineApps/events/api";
import {
  C,
  CheckoutShell,
  DEFAULT_ACCENT,
  SummaryRow,
  eventDateRange,
  money,
} from "@/components/events/checkout/ui";
import { loadOrder, type CachedOrder } from "@/components/events/checkout/orderCache";
import ShareEventModal from "@/components/events/ShareEventModal";

type Ticket = Awaited<ReturnType<typeof getTicket>>;

export default function ConfirmationClient({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  const [data, setData] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<CachedOrder | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setOrder(loadOrder(token));
    getTicket(token)
      .then(setData)
      .catch((err) => setError(err?.message || "Ticket not found"));
  }, [token]);

  const accent = DEFAULT_ACCENT;

  if (error) {
    return (
      <CheckoutShell>
        <div className="py-16 text-center">
          <XCircle className="mx-auto h-9 w-9" style={{ color: C.red }} strokeWidth={1.5} />
          <h1 className="mt-4 text-xl font-bold" style={{ color: C.ink }}>
            Ticket not found
          </h1>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>
            This link is invalid or the registration has been revoked.
          </p>
        </div>
      </CheckoutShell>
    );
  }

  if (!data) {
    return (
      <CheckoutShell>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.faint }} />
        </div>
      </CheckoutShell>
    );
  }

  const { ticket, event } = data;
  const pending = ticket.status === "pending_approval";
  const rejected = ticket.status === "rejected" || ticket.status === "cancelled";
  const email = ticket.attendeeEmail || order?.email;
  const eventUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/events/${slug}`
      : `/events/${slug}`;


  return (
    <CheckoutShell
      event={event}
      accent={accent}
      headerRight={
        <span className="text-xs" style={{ color: C.muted }}>
          Confirmation Receipt
        </span>
      }
    >
      {/* ── Headline ─────────────────────────────────────────────────── */}
      <div className="text-center">
        <span
          className="mx-auto grid h-11 w-11 place-items-center rounded-full border"
          style={{
            borderColor: pending ? "#e4d9a0" : "#a9e0c4",
            background: pending ? "#fdf8e6" : "#eefaf3",
          }}
        >
          {pending ? (
            <Clock3 className="h-5 w-5" style={{ color: "#b08900" }} strokeWidth={2} />
          ) : (
            <Check className="h-5 w-5" style={{ color: C.green }} strokeWidth={2.5} />
          )}
        </span>
        <h1 className="mt-4 text-[26px] font-bold" style={{ color: C.ink }}>
          {rejected
            ? "Registration cancelled"
            : pending
              ? "Application received"
              : "You're registered!"}
        </h1>
        <p className="mt-1.5 text-[13px]" style={{ color: C.muted }}>
          {rejected ? (
            "This registration is no longer valid."
          ) : pending ? (
            <>
              The organizer will review your registration and email{" "}
              <span style={{ color: C.ink }}>{email}</span>.
            </>
          ) : (
            <>
              We&apos;ve emailed your ticket to{" "}
              <span style={{ color: C.ink }}>{email}</span>
            </>
          )}
        </p>
      </div>

      {/* ── Ticket stub ──────────────────────────────────────────────── */}
      <div
        className="mx-auto mt-8 w-full max-w-md overflow-hidden rounded-2xl border"
        style={{ borderColor: C.border, background: "#fbfbfc" }}
      >
        <div className="px-7 pb-6 pt-6">
          <div className="flex items-start justify-between gap-4">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: C.faint }}
            >
              Event admission ticket
            </p>
            <span
              className="mt-1 block h-[3px] w-8 rounded-full"
              style={{ background: accent }}
            />
          </div>
          <h2 className="mt-3 text-[17px] font-bold" style={{ color: C.ink }}>
            {event?.name}
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: C.muted }}>
            {eventDateRange(event)}
          </p>
          {event?.venue?.name && (
            <p className="text-[12px]" style={{ color: C.muted }}>
              {[event.venue.name, event.venue.city].filter(Boolean).join(", ")}
            </p>
          )}
        </div>

        {/* Perforation */}
        <div className="relative">
          <span
            className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full"
            style={{ background: C.card }}
          />
          <span
            className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full"
            style={{ background: C.card }}
          />
          <div className="mx-7 border-t border-dashed" style={{ borderColor: "#d7d8de" }} />
        </div>

        <div className="px-7 pb-7 pt-6">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: C.faint }}
          >
            Attendee
          </p>
          <p className="mt-1 text-[15px] font-semibold" style={{ color: C.ink }}>
            {ticket.attendeeName}
          </p>
          <p
            className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: C.faint }}
          >
            Ref code
          </p>
          <p className="mt-1 font-mono text-[13px]" style={{ color: C.ink }}>
            {ticket.qrCodeToken.slice(0, 12).toUpperCase()}
          </p>
        </div>
      </div>

      {/* A buyer who took more than one pass type gets a ticket per type,
          each with its own QR code. The stub above is the first of them. */}
      {!rejected && (order?.tickets?.length || 0) > 1 && (
        <div
          className="mx-auto mt-4 w-full max-w-md rounded-xl border p-4"
          style={{ borderColor: C.border }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: C.faint }}
          >
            {order!.tickets!.length} tickets in this order
          </p>
          <ul className="mt-3 space-y-2">
            {order!.tickets!.map((t) => (
              <li
                key={t.token}
                className="flex items-center justify-between gap-3 text-[13px]"
              >
                <span style={{ color: C.ink }}>{t.label}</span>
                <Link
                  href={`/events/${slug}/ticket/${t.token}`}
                  className="text-[12px] font-medium underline underline-offset-4"
                  style={{ color: C.body }}
                >
                  View ticket
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!rejected && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`/events/${slug}/ticket/${token}`}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-semibold"
            style={{ background: C.ink, color: "#ffffff" }}
          >
            <QrCode className="h-4 w-4" />
            View my ticket
          </Link>
          {!pending && (
            <a
              href={ticketCalendarUrl(token)}
              className="inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-[13px] font-semibold"
              style={{ borderColor: C.border, color: C.ink }}
            >
              <CalendarPlus className="h-4 w-4" />
              Add to calendar
            </a>
          )}
        </div>
      )}

      {/* ── What's next ──────────────────────────────────────────────── */}
      <h2 className="mt-12 text-[15px] font-bold" style={{ color: C.ink }}>
        What&apos;s next?
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <NextCard
          title="Build your schedule"
          body="Explore the agenda and the sessions on offer. Save your spots before they fill up."
          action={
            <Link
              href={`/events/${slug}`}
              className="text-[12px] font-medium underline underline-offset-4"
              style={{ color: C.ink }}
            >
              View the agenda
            </Link>
          }
        />
        <NextCard
          title="Keep your ticket handy"
          body="Your QR code is on your ticket page and in your inbox. Show it at the door to check in."
          action={
            <Link
              href={`/events/${slug}/ticket/${token}`}
              className="text-[12px] font-medium underline underline-offset-4"
              style={{ color: C.ink }}
            >
              Open ticket
            </Link>
          }
        />
        <NextCard
          title="Invite a colleague"
          body="Passes sell out — and you earn commission on every ticket bought through your link."
          action={
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium underline underline-offset-4"
              style={{ color: C.ink }}
            >
              <Share2 className="h-3 w-3" />
              Share &amp; earn
            </button>
          }
        />
      </div>

      {/* ── Order ────────────────────────────────────────────────────── */}
      {order && (
        <div
          className="mt-10 rounded-xl border p-6"
          style={{ borderColor: C.border }}
        >
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-[15px] font-bold" style={{ color: C.ink }}>
              Your order
            </h2>
            <span className="font-mono text-[11px]" style={{ color: C.faint }}>
              {order.invoiceNumber
                ? `Order ID: ${order.invoiceNumber}`
                : `Ref: ${ticket.qrCodeToken.slice(0, 12).toUpperCase()}`}
            </span>
          </div>

          <div className="mt-5 space-y-2">
            {order.lines.map((l) => (
              <SummaryRow
                key={l.label}
                label={l.label}
                value={money(l.amount, order.currency)}
              />
            ))}
          </div>

          <div
            className="mt-4 space-y-2 border-t pt-4"
            style={{ borderColor: C.borderSoft }}
          >
            <SummaryRow
              label="Subtotal"
              value={money(order.subtotal, order.currency)}
              tone="muted"
            />
            {!!order.discount && (
              <SummaryRow
                label={
                  order.promoCode
                    ? `Promo discount (${order.promoCode})`
                    : "Promo discount"
                }
                value={`−${money(order.discount, order.currency)}`}
                tone="green"
              />
            )}
            {!!order.tax && (
              <SummaryRow
                label={`GST (${order.taxRate}%)`}
                value={money(order.tax, order.currency)}
                tone="muted"
              />
            )}
          </div>

          <div
            className="mt-4 flex items-baseline justify-between border-t pt-4"
            style={{ borderColor: C.borderSoft }}
          >
            <span className="text-[15px] font-bold" style={{ color: C.ink }}>
              {ticket.paymentStatus === "paid" ? "Total Paid" : "Total"}
            </span>
            <span
              className="text-[17px] font-bold tabular-nums"
              style={{ color: C.ink }}
            >
              {order.total > 0 ? money(order.total, order.currency) : "Free"}
            </span>
          </div>

          {order.invoiceNumber && (
            <a
              href={`/invoice/${order.invoiceNumber}`}
              className="mt-5 inline-block text-[12px] font-medium underline underline-offset-4"
              style={{ color: "#b08900" }}
            >
              View invoice
            </a>
          )}
        </div>
      )}

      {/* The buyer's own referral link, so the invite they send earns them
          commission rather than just filling a seat. */}
      <ShareEventModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        event={event as any}
      />
    </CheckoutShell>
  );
}

function NextCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border p-5"
      style={{ borderColor: C.border }}
    >
      <h3 className="text-[13px] font-semibold" style={{ color: C.ink }}>
        {title}
      </h3>
      <p className="text-[12px] leading-5" style={{ color: C.muted }}>
        {body}
      </p>
      <div className="mt-auto pt-2">{action}</div>
    </div>
  );
}
