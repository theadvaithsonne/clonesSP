"use client";

// "My tickets".
//
// An attendee who lost the confirmation email still has the reference from the
// checkout screen or their receipt. This trades that reference for the passes
// on it, QR codes included.
//
// Two fields rather than one, on purpose: a QR token is exactly what a door
// scanner accepts and invoice numbers run in sequence, so a reference on its
// own is not a secret. The email the booking was made with is what turns it
// into one. The server applies the same rule and answers every miss with the
// same message, so neither field can be used to probe for the other.

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, Ticket as TicketIcon } from "lucide-react";
import {
  lookupTickets,
  type LookedUpTicket,
} from "@/components/dashboard/inlineApps/events/api";
import type { EventProgram } from "@/components/dashboard/inlineApps/events/types";
import {
  C,
  CheckoutShell,
  eventDateRange,
  eventLocation,
  money,
} from "@/components/events/checkout/ui";

/**
 * The QR encodes the ticket's own page rather than the raw token, so a door
 * scanner running any generic QR app lands somewhere useful. Same source the
 * ticket page itself uses.
 */
function qrSrc(url: string, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    url
  )}`;
}

export default function MyTicketsClient({ slug }: { slug: string }) {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    event: EventProgram;
    tickets: LookedUpTicket[];
  } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim()) {
      setError("Enter your ticket ID");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Email is only needed for an order reference — a ticket ID stands on
      // its own. See the lookup route.
      const res = await lookupTickets(reference.trim(), email.trim() || undefined);
      setResult({ event: res.event, tickets: res.tickets || [] });
    } catch (err: any) {
      setResult(null);
      setError(err?.message || "We couldn't find that ticket");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CheckoutShell>
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/events/${slug}`}
          className="inline-flex items-center gap-1.5 text-[12px] underline underline-offset-4"
          style={{ color: C.body }}
        >
          <ArrowLeft className="h-3 w-3" />
          Back to the event
        </Link>

        <h1 className="mt-5 text-[22px] font-bold" style={{ color: C.ink }}>
          My tickets
        </h1>
        <p className="mt-1.5 text-[13px]" style={{ color: C.muted }}>
          Enter the ticket ID from your confirmation email. An order reference
          needs the email you booked with as well.
        </p>

        <form
          onSubmit={submit}
          className="mt-6 rounded-xl border p-5"
          style={{ borderColor: C.border }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Ticket ID or order reference"
              value={reference}
              onChange={setReference}
              placeholder="7DZ_FHDXMFAB"
            />
            <Field
              label="Email (only for an order reference)"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              type="email"
            />
          </div>

          {error && (
            <p className="mt-4 text-[13px]" style={{ color: C.red }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-[13px] font-semibold text-[#141418] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "#FACC15" }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Find my ticket
          </button>
        </form>

        {result && (
          <section className="mt-8">
            <h2 className="text-[15px] font-bold" style={{ color: C.ink }}>
              {result.event.name}
            </h2>
            <p className="mt-0.5 text-[12px]" style={{ color: C.muted }}>
              {eventDateRange(result.event)}
              {eventLocation(result.event)
                ? ` • ${eventLocation(result.event)}`
                : ""}
            </p>

            {result.tickets.length === 0 ? (
              <p className="mt-5 text-[13px]" style={{ color: C.muted }}>
                That booking has no passes on it.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {result.tickets.map((t) => (
                  <TicketCard
                    key={t.qrCodeToken}
                    ticket={t}
                    slug={result.event.slug || slug}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </CheckoutShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label
        className="mb-1.5 block text-[12px] font-medium"
        style={{ color: C.body }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none placeholder:text-[#b6b7c2] focus:border-[#15151a]"
        style={{ borderColor: C.border, color: C.ink }}
      />
    </div>
  );
}

function TicketCard({
  ticket,
  slug,
}: {
  ticket: LookedUpTicket;
  slug: string;
}) {
  const pageUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/events/${slug}/ticket/${ticket.qrCodeToken}`;

  return (
    <div
      className="flex flex-col gap-5 rounded-xl border p-5 sm:flex-row sm:items-center"
      style={{ borderColor: C.border }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold" style={{ color: C.ink }}>
            {ticket.attendeeName || "Attendee"}
          </span>
          {!ticket.valid && (
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
              style={{ background: "#f1f1f4", color: C.muted }}
            >
              {ticket.paymentStatus === "pending"
                ? "AWAITING PAYMENT"
                : "NOT YET VALID"}
            </span>
          )}
          {ticket.checkedInAt && (
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
              style={{ background: "#f1f1f4", color: C.muted }}
            >
              CHECKED IN
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px]" style={{ color: C.muted }}>
          {ticket.tier?.name || "Admission"}
          {ticket.tier && ticket.tier.price > 0
            ? ` · ${money(ticket.tier.price, ticket.tier.currency)}`
            : ""}
          {ticket.quantity > 1 ? ` · ×${ticket.quantity}` : ""}
        </p>
        <p className="mt-0.5 text-[12px]" style={{ color: C.faint }}>
          {ticket.attendeeEmail}
        </p>
        <p
          className="mt-2 font-mono text-[11px] uppercase tracking-wider"
          style={{ color: C.faint }}
        >
          {ticket.qrCodeToken.slice(0, 12)}
        </p>
        <a
          href={`/events/${slug}/ticket/${ticket.qrCodeToken}`}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] underline underline-offset-4"
          style={{ color: C.body }}
        >
          <TicketIcon className="h-3 w-3" />
          Open full ticket
        </a>
      </div>

      {/* An unpaid or unapproved pass has nothing to scan yet — showing a QR
          the door will reject is worse than saying so. */}
      <div className="shrink-0">
        {ticket.valid ? (
          <div
            className="rounded-lg border bg-white p-2.5"
            style={{ borderColor: C.border }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc(pageUrl)}
              alt={`QR code for ${ticket.attendeeName}`}
              className="h-[140px] w-[140px]"
            />
          </div>
        ) : (
          <div
            className="flex h-[165px] w-[165px] items-center justify-center rounded-lg border px-4 text-center text-[11px] leading-4"
            style={{ borderColor: C.border, color: C.faint }}
          >
            Your QR code appears here once this pass is confirmed.
          </div>
        )}
      </div>
    </div>
  );
}
