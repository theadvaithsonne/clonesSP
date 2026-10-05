"use client";

// Attendee-facing Events: Purchases — the tickets this user holds.
//
// Paid orders come from the invoice feed (/api/invoices/my/list, the same one
// as Garage Pay → Orders), kept to `event_ticket` lines, and each is resolved
// to its passes through the public ticket lookup (invoice number + an
// attendee's email). Orders the in-app checkout completed in this browser fill
// the two gaps that lookup has (see pass-store): orders where the buyer is not
// one of the attendees, and free registrations, which raise no invoice.
//
// Opening a purchase shows its passes: QR code, ticket ID and the order.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ExternalLink, Ticket } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { lookupTickets } from "./api";
import type { EventProgram } from "./types";
import { dateRange, dayMonth, hasEnded, isLive, locationLabel, money } from "./browse-format";
import {
  CARD_GRID,
  CardSkeleton,
  EmptyPanel,
  EventBar,
  EventCard,
  OUTLINE_BUTTON,
  PAGE,
  SectionHeading,
} from "./browse-ui";
import { PassCard, fetchPasses, type Pass } from "./EventPasses";
import EventFlowView from "./EventFlowView";
import { loadStoredOrders } from "./pass-store";

interface InvoiceLine {
  itemType: string;
  itemName: string;
  itemImage?: string;
  quantity: number;
}

interface MyInvoice {
  _id: string;
  invoiceNumber: string;
  status: string;
  lineItems: InvoiceLine[];
  /** Smallest currency unit. */
  totalAmount: number;
  itemCurrency?: string;
  paymentCurrency?: string;
  createdAt: string;
}

interface Purchase {
  key: string;
  /** Null for a free registration — those raise no invoice. */
  invoice: MyInvoice | null;
  /** Null when the passes couldn't be resolved from here. */
  event: EventProgram | null;
  slug: string;
  eventName: string;
  image?: string;
  passes: Pass[];
  savedAt: string;
}

const PAGE_SIZE = 100;
/** Enough history for any real attendee without walking an unbounded list. */
const MAX_INVOICES = 1000;

async function fetchEventInvoices(): Promise<MyInvoice[]> {
  const found: MyInvoice[] = [];
  for (let skip = 0; skip < MAX_INVOICES; skip += PAGE_SIZE) {
    const res = await api<{ invoices: MyInvoice[]; total: number }>(
      `/api/invoices/my/list?invoiceType=one_time&limit=${PAGE_SIZE}&skip=${skip}`
    );
    found.push(
      ...(res.invoices || []).filter((inv) =>
        inv.lineItems?.some((l) => l.itemType === "event_ticket")
      )
    );
    if (skip + PAGE_SIZE >= (res.total || 0)) break;
  }
  // Draft, failed, cancelled and expired orders were never tickets.
  return found.filter((inv) => ["paid", "pending", "refunded"].includes(inv.status));
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

/** "Network Economy Summit 2026 — VIP Pass" → the event half. */
function eventNameOf(invoice: MyInvoice) {
  const name = invoice.lineItems.find((l) => l.itemType === "event_ticket")?.itemName || "";
  const cut = name.lastIndexOf(" — ");
  return cut > 0 ? name.slice(0, cut) : name || "Event order";
}

function amountOf(p: Purchase) {
  if (!p.invoice) return "Free";
  return money(
    (p.invoice.totalAmount || 0) / 100,
    p.invoice.paymentCurrency || p.invoice.itemCurrency || "USD"
  );
}

function statusOf(p: Purchase) {
  if (p.invoice?.status === "pending") return "Payment pending";
  if (p.invoice?.status === "refunded") return "Refunded";
  if (p.event && isLive(p.event)) return "Live now";
  if (p.passes.some((t) => t.status === "pending_approval")) return "Awaiting approval";
  return p.invoice ? "Paid" : "Registered";
}

const livePasses = (p: Purchase) =>
  p.passes.filter((t) => t.status !== "cancelled" && t.status !== "rejected");

export default function EventsPurchases({ onDiscover }: { onDiscover?: () => void }) {
  const email = useAuthStore((s) => s.user?.email) || "";
  const userId = useAuthStore((s) => s.user?.userId) || "";
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Purchase | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Bumped per load, so a slow earlier load can't overwrite a newer one.
  const loadRun = useRef(0);

  const load = useCallback(async () => {
    const run = ++loadRun.current;
    setPurchases(null);
    setError(null);
    try {
      const [invoices, stored] = [await fetchEventInvoices(), loadStoredOrders(userId)];
      const storedByInvoice = new Map(
        stored.filter((o) => o.invoiceNumber).map((o) => [o.invoiceNumber as string, o])
      );

      const paid = await mapLimit(invoices, 4, async (invoice): Promise<Purchase> => {
        const saved = storedByInvoice.get(invoice.invoiceNumber);
        let event: EventProgram | null = null;
        let passes: Pass[] = [];
        if (email) {
          try {
            const res = await lookupTickets(invoice.invoiceNumber, email);
            event = res.event;
            passes = res.tickets || [];
          } catch {
            // Not on a seat of this order — fall back to what checkout saved.
          }
        }
        if (!event && saved) {
          const res = await fetchPasses(saved.passes.map((p) => p.token));
          event = res.event;
          passes = res.passes;
        }
        return {
          key: invoice._id,
          invoice,
          event,
          slug: event?.slug || saved?.slug || "",
          eventName: event?.name || saved?.eventName || eventNameOf(invoice),
          image: event?.bannerUrl || invoice.lineItems[0]?.itemImage,
          passes,
          savedAt: invoice.createdAt,
        };
      });

      const free = await mapLimit(
        stored.filter((o) => !o.invoiceNumber),
        4,
        async (order): Promise<Purchase> => {
          const res = await fetchPasses(order.passes.map((p) => p.token));
          return {
            key: order.key,
            invoice: null,
            event: res.event,
            slug: res.event?.slug || order.slug,
            eventName: res.event?.name || order.eventName,
            image: res.event?.bannerUrl,
            passes: res.passes,
            savedAt: order.savedAt,
          };
        }
      );

      if (run !== loadRun.current) return;
      setPurchases(
        [...paid, ...free].filter((p) =>
          // An unpaid order whose seats all lapsed is an abandoned checkout, not
          // a purchase — and one we can't check is left out rather than shown
          // with a "pay now" button that may charge for nothing. A free order
          // that no longer resolves has nothing left to show.
          p.invoice?.status === "pending" || !p.invoice
            ? livePasses(p).length > 0
            : true
        )
      );
    } catch (err) {
      if (run !== loadRun.current) return;
      const message = (err instanceof Error && err.message) || "Could not load your purchases";
      setError(message);
      toast.error(message);
    }
  }, [email, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [openSlug, viewing]);

  const { upcoming, past, unmatched } = useMemo(() => {
    const list = purchases || [];
    const start = (p: Purchase) => new Date(p.event!.startsAt).getTime();
    return {
      upcoming: list
        .filter((p) => p.event && !hasEnded(p.event))
        .sort((a, b) => start(a) - start(b)),
      past: list
        .filter((p) => p.event && hasEnded(p.event))
        .sort((a, b) => start(b) - start(a)),
      unmatched: list
        .filter((p) => !p.event)
        .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()),
    };
  }, [purchases]);

  // ── One event (from "View event") ───────────────────────────────────────
  if (openSlug) {
    return (
      <div ref={scrollRef} className="h-full w-full overflow-y-auto bg-[#181818]">
        <EventFlowView
          key={openSlug}
          slug={openSlug}
          rootLabel="Purchases"
          onBack={() => setOpenSlug(null)}
          // Already here — back to the list, with the new order on it.
          onOpenPurchases={() => {
            setOpenSlug(null);
            setViewing(null);
            void load();
          }}
          onScrollTop={() => scrollRef.current?.scrollTo({ top: 0 })}
        />
      </div>
    );
  }

  // ── One order's passes ──────────────────────────────────────────────────
  if (viewing) {
    const p = viewing;
    const pending = p.invoice?.status === "pending";
    return (
      <div ref={scrollRef} className="h-full w-full overflow-y-auto bg-[#181818]">
        <div className={PAGE}>
          <nav className="flex min-w-0 items-center gap-1.5 text-[12px] leading-4">
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="shrink-0 text-[#8a8a8a] transition-colors hover:text-[#f5f5f5]"
            >
              Purchases
            </button>
            <ChevronRight className="h-3 w-3 shrink-0 text-[#5c5c5c]" />
            <span className="truncate text-[#f5f5f5]">{p.eventName}</span>
          </nav>

          <div className="mx-auto mt-6 max-w-2xl">
            <EventBar
              image={p.image}
              name={p.eventName}
              meta={
                p.event
                  ? [dateRange(p.event.startsAt, p.event.endsAt), locationLabel(p.event, "full")]
                      .filter(Boolean)
                      .join(" · ")
                  : p.invoice
                    ? `Order ${p.invoice.invoiceNumber}`
                    : ""
              }
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#262626] bg-[#202020] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b6b6b]">
                  {p.invoice ? "Order reference" : "Registration"}
                </p>
                <p className="mt-1 font-mono text-[13px] font-semibold text-[#f5f5f5]">
                  {p.invoice
                    ? p.invoice.invoiceNumber
                    : `${p.passes.length} ${p.passes.length === 1 ? "pass" : "passes"}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold tabular-nums text-[#f5f5f5]">
                  {amountOf(p)}
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px]",
                    pending ? "bg-[#2a2a2a] text-[#bdbdbd]" : "bg-brand/15 text-brand"
                  )}
                >
                  {statusOf(p)}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {p.passes.length > 0 ? (
                p.passes.map((pass) => <PassCard key={pass.qrCodeToken} slug={p.slug} pass={pass} />)
              ) : (
                <EmptyPanel
                  icon={<Ticket className="h-10 w-10" strokeWidth={1.25} />}
                  title="Passes aren't available here"
                  description="This order was booked under another email. The passes are in the confirmation email that was sent to it."
                />
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {pending && p.invoice && (
                <a
                  href={`/invoice/${p.invoice.invoiceNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center rounded-lg bg-brand px-5 text-[13px] font-semibold text-brand-foreground transition-opacity hover:opacity-90"
                >
                  Pay now
                </a>
              )}
              {p.slug && (
                <button type="button" onClick={() => setOpenSlug(p.slug)} className={cn(OUTLINE_BUTTON, "h-9 px-4")}>
                  View event
                </button>
              )}
              {p.invoice && (
                <a
                  href={`/invoice/${p.invoice.invoiceNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(OUTLINE_BUTTON, "h-9 px-4")}
                >
                  View invoice
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List ────────────────────────────────────────────────────────────────
  const card = (p: Purchase) => {
    const pending = p.invoice?.status === "pending";
    const seats = livePasses(p).reduce((n, t) => n + (t.quantity || 1), 0);
    return (
      <EventCard
        key={p.key}
        image={p.image}
        label={[p.event ? dayMonth(p.event.startsAt) : "", statusOf(p)].filter(Boolean).join(" · ")}
        title={p.eventName}
        subtitle={p.event ? locationLabel(p.event) : p.invoice ? `Order ${p.invoice.invoiceNumber}` : ""}
        onOpen={() => setViewing(p)}
        footer={
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[12px] font-semibold leading-4 text-[#f5f5f5]">
              {seats > 0 ? `${seats} ${seats === 1 ? "ticket" : "tickets"} · ` : ""}
              {amountOf(p)}
            </p>
            {pending && p.invoice ? (
              <a
                href={`/invoice/${p.invoice.invoiceNumber}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-7 shrink-0 items-center rounded-md bg-brand px-2.5 text-[12px] font-semibold text-brand-foreground transition-opacity hover:opacity-90"
              >
                Pay now
              </a>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-[12px] text-[#8a8a8a]">
                <Ticket className="h-3.5 w-3.5" />
                View tickets
              </span>
            )}
          </div>
        }
      />
    );
  };

  return (
    <div ref={scrollRef} className="h-full w-full overflow-y-auto bg-[#181818]">
      <div className={PAGE}>
        <header>
          <h1 className="text-[22px] font-semibold leading-7 text-[#f5f5f5]">Purchases</h1>
          <p className="mt-1.5 text-[13px] leading-5 text-[#8a8a8a]">
            Your tickets for events in this office. Open one for its QR code.
          </p>
        </header>

        {purchases === null && !error ? (
          <div className={`mt-7 ${CARD_GRID}`}>
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="mt-7">
            <EmptyPanel
              icon={<Ticket className="h-10 w-10" strokeWidth={1.25} />}
              title="Could not load your purchases"
              description={`${error}. Your tickets are safe — this is only the list failing to load.`}
              action={
                <button type="button" onClick={load} className={OUTLINE_BUTTON}>
                  Try again
                </button>
              }
            />
          </div>
        ) : !purchases?.length ? (
          <div className="mt-7">
            <EmptyPanel
              icon={<Ticket className="h-10 w-10" strokeWidth={1.25} />}
              title="No tickets yet"
              description="Tickets you get for this office's events show up here."
              action={
                onDiscover && (
                  <button type="button" onClick={onDiscover} className={OUTLINE_BUTTON}>
                    Discover events
                  </button>
                )
              }
            />
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="mt-7">
                <SectionHeading className="mb-4">Upcoming</SectionHeading>
                <div className={CARD_GRID}>{upcoming.map(card)}</div>
              </section>
            )}
            {past.length > 0 && (
              <section className="mt-7">
                <SectionHeading className="mb-4">Past</SectionHeading>
                <div className={CARD_GRID}>{past.map(card)}</div>
              </section>
            )}
            {unmatched.length > 0 && (
              <section className="mt-7">
                <SectionHeading>Other orders</SectionHeading>
                <p className="mb-4 mt-1 text-[12px] leading-5 text-[#8a8a8a]">
                  Booked under another email, so the passes can&apos;t be shown here. The
                  invoice and the confirmation email have them.
                </p>
                <div className={CARD_GRID}>{unmatched.map(card)}</div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
