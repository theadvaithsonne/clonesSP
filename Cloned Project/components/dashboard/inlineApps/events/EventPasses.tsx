"use client";

// An order's passes, as the attendee carries them: one card per person with
// the QR the door scans, who it's for, the pass type and the ticket ID.
//
// Shown straight after checkout and again from Purchases. The QR encodes the
// public ticket page rather than the raw token — the same choice the ticket
// page makes — so any phone camera at the door lands on the live status.

import React, { useEffect, useState } from "react";
import { CalendarPlus, CheckCircle2, Clock3, ExternalLink, XCircle } from "lucide-react";
import { getTicket, ticketCalendarUrl, type LookedUpTicket } from "./api";
import type { EventProgram } from "./types";
import { cn } from "@/lib/utils";

/** What a pass card needs — the lookup and the ticket endpoint both return it. */
export type Pass = Pick<
  LookedUpTicket,
  "qrCodeToken" | "attendeeName" | "quantity" | "status" | "paymentStatus" | "checkedInAt" | "valid"
> & { tier: { name: string } | null };

/** Ticket IDs are the token's leading characters — what the lookup accepts. */
export const ticketId = (token: string) => token.slice(0, 12);

function qrSrc(url: string, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    url
  )}&margin=8&ecc=H`;
}

/** Resolves passes by token, for an order this browser just placed. */
export async function fetchPasses(tokens: string[]) {
  const results = await Promise.all(
    tokens.map((t) => getTicket(t).catch(() => null))
  );
  const found = results.filter((r): r is NonNullable<typeof r> => !!r);
  return {
    event: (found[0]?.event as EventProgram | undefined) || null,
    passes: found.map((r) => r.ticket as Pass),
  };
}

function statusOf(pass: Pass) {
  if (pass.status === "rejected" || pass.status === "cancelled")
    return { label: "Not valid", tone: "bad" as const };
  if (pass.status === "pending_approval")
    return { label: "Awaiting approval", tone: "wait" as const };
  if (pass.paymentStatus === "pending")
    return { label: "Payment pending", tone: "wait" as const };
  return { label: "Confirmed", tone: "ok" as const };
}

export function PassCard({ slug, pass }: { slug: string; pass: Pass }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const status = statusOf(pass);
  const ticketUrl = origin ? `${origin}/events/${slug}/ticket/${pass.qrCodeToken}` : "";

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-[#262626] bg-[#202020] p-5 @xl:flex-row">
      <div className="flex shrink-0 justify-center">
        {status.tone === "ok" && ticketUrl ? (
          <div className="rounded-lg bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc(ticketUrl)} alt="Ticket QR code" width={140} height={140} />
          </div>
        ) : (
          <div className="flex h-[156px] w-[156px] items-center justify-center rounded-lg border border-dashed border-[#333333] px-4 text-center text-[11px] leading-4 text-[#6b6b6b]">
            {status.tone === "bad"
              ? "This pass is no longer valid"
              : "Your QR code appears here once this pass is confirmed"}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium",
            status.tone === "ok" && "bg-brand text-brand-foreground",
            status.tone === "wait" && "bg-[#2a2a2a] text-[#bdbdbd]",
            status.tone === "bad" && "bg-[#3a1f1f] text-[#f87171]"
          )}
        >
          {status.tone === "ok" ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : status.tone === "wait" ? (
            <Clock3 className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {status.label}
        </span>
        {pass.checkedInAt && (
          <span className="ml-2 rounded-md bg-[#1f2d1f] px-2 py-0.5 text-[11px] text-[#4ade80]">
            Checked in
          </span>
        )}

        <p className="mt-3 truncate text-[16px] font-semibold leading-[22px] text-[#f5f5f5]">
          {pass.attendeeName || "Attendee"}
        </p>
        <p className="mt-0.5 text-[13px] leading-5 text-[#8a8a8a]">
          {pass.tier?.name || "Admission"}
          {pass.quantity > 1 ? ` × ${pass.quantity}` : ""}
        </p>

        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b6b6b]">
            Ticket ID
          </p>
          <p className="mt-1 font-mono text-[14px] font-semibold tracking-wider text-[#f5f5f5]">
            {ticketId(pass.qrCodeToken)}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={ticketCalendarUrl(pass.qrCodeToken)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#2e2e2e] px-3 text-[12px] font-medium text-[#e8e8e8] transition-colors hover:bg-white/[0.04]"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Add to calendar
          </a>
          {ticketUrl && (
            <a
              href={ticketUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#2e2e2e] px-3 text-[12px] font-medium text-[#e8e8e8] transition-colors hover:bg-white/[0.04]"
            >
              Open ticket
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
