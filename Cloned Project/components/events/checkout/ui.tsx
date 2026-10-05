"use client";

// Shared chrome for the attendee checkout surfaces — the three-step ticket
// page and the post-payment confirmation page.
//
// These pages are light-themed on purpose. The rest of the product (and the
// event landing page the buyer arrives from) is dark, but a checkout reads as
// a receipt: the organizer's accent is the only colour that carries meaning,
// so everything else is paper.

import React from "react";
import type { EventProgram } from "@/components/dashboard/inlineApps/events/types";

export const DEFAULT_ACCENT = "#FACC15";

/** Neutral palette, kept in one place so the two pages can't drift apart. */
export const C = {
  page: "#f2f2f4",
  card: "#ffffff",
  border: "#e6e6ea",
  borderSoft: "#efeff2",
  ink: "#15151a",
  body: "#4a4b57",
  muted: "#8b8c99",
  faint: "#a9aab5",
  green: "#137a4a",
  red: "#c0392b",
};

export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** "24 – 26 Mar 2026" — collapsed to one date when the event is single-day. */
export function eventDateRange(event?: Pick<EventProgram, "startsAt" | "endsAt">) {
  if (!event?.startsAt) return "";
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const d = (x: Date, withMonth = true) =>
    x.toLocaleDateString("en-GB", {
      day: "numeric",
      ...(withMonth ? { month: "short" } : {}),
      ...(withMonth ? { year: "numeric" } : {}),
    });
  if (!end || start.toDateString() === end.toDateString()) return d(start);
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth ? `${d(start, false)} – ${d(end)}` : `${d(start)} – ${d(end)}`;
}

export function eventLocation(event?: Pick<EventProgram, "venue">) {
  const v = event?.venue;
  if (!v) return "";
  return [v.city, v.country].filter(Boolean).join(", ");
}

/** Page frame: sticky brand bar, a white sheet, and the legal footer. */
export function CheckoutShell({
  event,
  organizationIcon,
  organizationName,
  accent = DEFAULT_ACCENT,
  headerRight,
  children,
}: {
  event?: EventProgram | null;
  organizationIcon?: string;
  organizationName?: string;
  accent?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: C.page }}>
      <header
        className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur"
        style={{ borderColor: C.border }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            {organizationIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={organizationIcon}
                alt=""
                className="h-6 w-6 shrink-0 rounded-md object-cover"
              />
            ) : (
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold"
                style={{ background: accent, color: "#141418" }}
              >
                {(event?.name || organizationName || "E").charAt(0).toUpperCase()}
              </span>
            )}
            <span
              className="truncate text-sm font-semibold"
              style={{ color: C.ink }}
            >
              {event?.name || "Event"}
            </span>
          </div>
          {headerRight ?? (
            <span className="shrink-0 text-xs" style={{ color: C.muted }}>
              Need help?{" "}
              <a
                href="mailto:support@garage.app"
                className="font-medium underline underline-offset-2"
                style={{ color: C.ink }}
              >
                Contact support
              </a>
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-3 pb-16 pt-5 sm:px-8 sm:pt-8">
        <div
          className="rounded-2xl border bg-white px-4 py-8 sm:px-10 sm:py-10"
          style={{ borderColor: C.border }}
        >
          {children}
        </div>

        <footer
          className="mt-6 flex flex-col gap-3 px-1 text-[11px] sm:flex-row sm:items-center sm:justify-between"
          style={{ color: C.faint }}
        >
          <span>
            © {new Date().getFullYear()} {event?.name || "Garage Events"}. Powered by
            Garage Pay Events.
          </span>
          <span className="flex gap-5">
            <a href="/privacy" className="hover:underline">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:underline">
              Terms of Use
            </a>
            <a href="mailto:support@garage.app" className="hover:underline">
              Event Policies
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}

const STEPS = ["Tickets", "Details", "Payment"] as const;

/** 1-based index of the step the buyer is on. Earlier steps show a tick. */
export function Stepper({
  current,
  onBack,
  accent = DEFAULT_ACCENT,
}: {
  current: 1 | 2 | 3;
  onBack?: (step: 1 | 2) => void;
  accent?: string;
}) {
  return (
    <nav className="mb-8 flex items-center justify-center gap-2 sm:gap-3">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;
        const clickable = done && !!onBack && n !== 3;
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <span
                className="h-px w-8 sm:w-14"
                style={{ background: done || active ? accent : C.border }}
              />
            )}
            <button
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onBack?.(n as 1 | 2) : undefined}
              className={`flex items-center gap-2 text-xs sm:text-sm ${
                clickable ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <span
                className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold"
                style={
                  done || active
                    ? { background: accent, color: "#141418" }
                    : { background: C.borderSoft, color: C.muted }
                }
              >
                {done ? "✓" : n}
              </span>
              <span
                className="font-medium"
                style={{ color: done || active ? C.ink : C.muted }}
              >
                {label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/** One line of an order summary. */
export function SummaryRow({
  label,
  value,
  tone,
  bold,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: "muted" | "green";
  bold?: boolean;
}) {
  const color = tone === "green" ? C.green : tone === "muted" ? C.muted : C.body;
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <span style={{ color }}>{label}</span>
      <span
        className={bold ? "font-semibold tabular-nums" : "tabular-nums"}
        style={{ color: tone === "green" ? C.green : C.ink }}
      >
        {value}
      </span>
    </div>
  );
}
