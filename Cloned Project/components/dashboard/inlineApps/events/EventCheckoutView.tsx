"use client";

// Buying tickets inside Garage: Tickets → Details → Payment, then the passes.
//
// Same API as the public checkout page (/events/[slug]/checkout) — quote,
// register for free orders, checkout + Garage Pay for paid ones — laid out for
// the dashboard instead of the public site. The buyer never leaves the app:
// payment runs through Garage Pay's own payment step inline, and the passes
// show on this page the moment the order settles.
//
// Billing is separate from the attendees, so a buyer can book for other people
// without attending. The billing email is the signed-in account's: the paid
// checkout bills whichever account owns that email, and that account is the
// one whose Purchases list the order appears in.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Lock,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";
import {
  ATTENDEE_KEYS,
  CONSENT_TYPES,
  NAME_PART,
  fieldSpansRow,
  joinName,
  type NameParts,
} from "@/components/events/checkout/FormFields";
import {
  getPublicEvent,
  getTicket,
  quoteTickets,
  registerFree,
  startCheckout,
  type AttendeeInput,
  type PublicEventPayload,
  type PublicTierPayload,
  type QuoteResult,
} from "./api";
import type { EventFormField } from "./types";
import { SwitchControl } from "./ui";
import { dateRange, locationLabel, money } from "./browse-format";
import { EmptyPanel, EventBar, OUTLINE_BUTTON, PAGE } from "./browse-ui";
import { PassCard, fetchPasses, type Pass } from "./EventPasses";
import { saveStoredOrder } from "./pass-store";

type Step = 1 | 2 | 3;

/** One named person against one seat of one pass type. */
interface Seat {
  tierId: string;
  tierName: string;
  attendee: AttendeeInput;
  nameParts: NameParts;
  answers: Record<string, unknown>;
}

const newSeat = (tierId: string, tierName: string): Seat => ({
  tierId,
  tierName,
  attendee: { name: "", email: "" },
  nameParts: { first: "", last: "" },
  answers: {},
});

interface CheckoutRef {
  invoiceId: string;
  invoiceNumber?: string;
  registrations: Array<{ ticketTierId: string; qrCodeToken: string }>;
  /** The order this invoice was minted for — a changed order needs a new one. */
  signature: string;
}

/** Stock under this reads red; up to SHOW_REMAINING_BELOW it reads in brand. */
const LOW_STOCK = 20;
const SHOW_REMAINING_BELOW = 200;

// globals.css pins inputs to 16px (unlayered) so iOS doesn't zoom on focus;
// `!` lets desktop take the design's 13px while phones keep 16px.
const INPUT =
  "w-full rounded-lg border border-[#2e2e2e] bg-[#1a1a1a] px-3 text-[#f5f5f5] outline-none transition-colors placeholder:text-[#5c5c5c] focus:border-[#4a4a4a] disabled:cursor-not-allowed disabled:text-[#8a8a8a] sm:text-[13px]!";

interface Props {
  slug: string;
  /** The landing payload, when the caller already has it. */
  initial?: PublicEventPayload | null;
  /** Pass to start the cart with, e.g. the one clicked on the event page. */
  initialTierId?: string;
  /** Leave the checkout (back to wherever it was opened from). */
  onBack: () => void;
  /** "Close" on the passes screen once the order is done. */
  onDone: () => void;
  onOpenPurchases?: () => void;
}

export default function EventCheckoutView({
  slug,
  initial,
  initialTierId,
  onBack,
  onDone,
  onOpenPurchases,
}: Props) {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<PublicEventPayload | null>(initial ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [addonOn, setAddonOn] = useState<Record<string, boolean>>({});
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [seats, setSeats] = useState<Seat[]>([]);
  const [attendingToo, setAttendingToo] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]));
  const [billing, setBilling] = useState({ name: "", company: "", country: "" });

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutRef, setCheckoutRef] = useState<CheckoutRef | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<{
    passes: Pass[];
    invoiceNumber?: string;
    pendingApproval: boolean;
  } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // ── Profile (for "I'm attending too" and billing) ──────────────────────
  const [profileCountry, setProfileCountry] = useState("");
  useEffect(() => {
    api<{ user?: { country?: string } }>("/auth/me")
      .then((res) => setProfileCountry(res?.user?.country || ""))
      .catch(() => {
        // Country is a convenience; the buyer can type it.
      });
  }, []);
  const profile = useMemo(() => {
    const name = (user?.name || "").trim();
    const [first = "", ...rest] = name.split(/\s+/);
    return {
      name,
      first,
      last: rest.join(" "),
      email: (user?.email || "").trim(),
      phone: (user?.phone || user?.phoneNumber || "").trim(),
      country: profileCountry,
    };
  }, [user, profileCountry]);

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initial) return;
    let alive = true;
    getPublicEvent(slug)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err: unknown) => {
        if (alive) setLoadError((err instanceof Error && err.message) || "Event not found");
      });
    return () => {
      alive = false;
    };
  }, [slug, initial]);

  // Start with one of the pass the buyer clicked, or the first one on sale.
  useEffect(() => {
    if (!data) return;
    const buyable = data.tiers.filter((t) => !t.soldOut && t.onSale);
    const first =
      (initialTierId && buyable.some((t) => t._id === initialTierId)
        ? initialTierId
        : buyable[0]?._id) || null;
    if (first) setCart({ [first]: 1 });
  }, [data, initialTierId]);

  const tiers = useMemo(() => (data?.tiers || []) as PublicTierPayload[], [data]);
  const popularTierId = data?.website.blocks.find((b) => b.type === "tickets")?.content
    ?.popularTierId as string | undefined;

  const chosen = useMemo(
    () =>
      tiers
        .filter((t) => (cart[t._id] || 0) > 0)
        .map((t) => ({ tier: t, quantity: cart[t._id] })),
    [tiers, cart]
  );
  const cartItems = useMemo(
    () => chosen.map((c) => ({ ticketTierId: c.tier._id, quantity: c.quantity })),
    [chosen]
  );
  // Free passes register and paid ones check out — two endpoints, so one
  // order can't hold both.
  const mixesFreeAndPaid =
    chosen.some((c) => c.tier.price > 0) && chosen.some((c) => c.tier.price <= 0);
  const isFree = chosen.length > 0 && chosen.every((c) => c.tier.price <= 0);

  // Sold-out extras are simply not offered next to the ticket being bought.
  const addons = useMemo(
    () => (data?.addons || []).filter((a) => !a.soldOut && a.onSale),
    [data]
  );
  const addonSelection = useMemo(
    () =>
      addons
        .filter((a) => addonOn[a._id])
        .map((a) => ({ ticketTierId: a._id, quantity: 1 })),
    [addons, addonOn]
  );

  /**
   * One seat per ticket, rebuilt when quantities change while keeping what
   * was typed against the seats that survive.
   */
  useEffect(() => {
    setSeats((prev) => {
      const pools = new Map<string, Seat[]>();
      prev.forEach((s) => pools.set(s.tierId, [...(pools.get(s.tierId) || []), s]));
      const next: Seat[] = [];
      for (const c of chosen) {
        const pool = pools.get(c.tier._id) || [];
        for (let i = 0; i < c.quantity; i++) next.push(pool[i] || newSeat(c.tier._id, c.tier.name));
      }
      return next;
    });
  }, [chosen]);

  const patchSeat = useCallback((index: number, patch: Partial<Seat>) => {
    setSeats((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }, []);

  // "I'm attending too" fills the first seat from the profile while that seat
  // is blank — on arriving here, and each time the toggle goes back on. Only a
  // blank seat, so clearing one field to retype it doesn't refill it.
  useEffect(() => {
    if (!attendingToo || !seats[0]) return;
    const s0 = seats[0];
    if (s0.attendee.name || s0.attendee.email || (!profile.name && !profile.email)) return;
    patchSeat(0, {
      attendee: {
        ...s0.attendee,
        name: profile.name,
        email: profile.email,
        phone: s0.attendee.phone || profile.phone || undefined,
        country: s0.attendee.country || profile.country || undefined,
      },
      nameParts: { first: profile.first, last: profile.last },
    });
  }, [attendingToo, seats, profile, patchSeat]);

  // The profile's country arrives after the seat was filled; add it once.
  const countryFilled = useRef(false);
  useEffect(() => {
    if (countryFilled.current || !attendingToo || !profile.country || !seats[0]) return;
    const s0 = seats[0];
    if (!profile.email || s0.attendee.email.toLowerCase() !== profile.email.toLowerCase()) return;
    countryFilled.current = true;
    if (!s0.attendee.country) patchSeat(0, { attendee: { ...s0.attendee, country: profile.country } });
  }, [attendingToo, seats, profile, patchSeat]);

  // Billing starts from the profile too.
  useEffect(() => {
    setBilling((b) => ({
      ...b,
      name: b.name || profile.name,
      country: b.country || profile.country,
    }));
  }, [profile.name, profile.country]);

  const toggleAttending = (on: boolean) => {
    setAttendingToo(on);
    if (on || !seats[0]) return;
    // Turning it off clears what the profile filled in, and nothing else.
    const s0 = seats[0];
    const same = (a?: string, b?: string) =>
      !!a && (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
    const nameFromProfile = same(s0.attendee.name, profile.name);
    patchSeat(0, {
      attendee: {
        ...s0.attendee,
        name: nameFromProfile ? "" : s0.attendee.name,
        email: same(s0.attendee.email, profile.email) ? "" : s0.attendee.email,
        phone: same(s0.attendee.phone, profile.phone) ? "" : s0.attendee.phone,
        country: same(s0.attendee.country, profile.country) ? "" : s0.attendee.country,
      },
      nameParts: nameFromProfile ? { first: "", last: "" } : s0.nameParts,
    });
  };

  // ── Form ────────────────────────────────────────────────────────────────
  const allFields = useMemo(
    () => [...(data?.form?.fields || [])].sort((a, b) => a.order - b.order),
    [data]
  );
  /** The fields one pass asks for — conditions are per ticket type. */
  const fieldsFor = useCallback(
    (tierId: string) =>
      allFields.filter((f) =>
        (f.conditions || []).every((c) => {
          if (c.source !== "ticket_type") return true;
          const hit = (c.values || []).includes(tierId);
          return c.operator === "is" ? hit : !hit;
        })
      ),
    [allFields]
  );

  /**
   * Consents are asked once for the whole order and written onto every seat
   * whose pass asks for them — the server checks them per seat.
   */
  const consentFields = useMemo(() => {
    const byKey = new Map<string, EventFormField>();
    seats.forEach((s) =>
      fieldsFor(s.tierId)
        .filter((f) => CONSENT_TYPES.includes(f.type))
        .forEach((f) => byKey.set(f.key, f))
    );
    return [...byKey.values()];
  }, [seats, fieldsFor]);

  const setConsent = (field: EventFormField, value: boolean) =>
    setSeats((prev) =>
      prev.map((s) =>
        fieldsFor(s.tierId).some((f) => f.key === field.key)
          ? { ...s, answers: { ...s.answers, [field.key]: value } }
          : s
      )
    );
  const consentValue = (field: EventFormField) => {
    const asking = seats.filter((s) => fieldsFor(s.tierId).some((f) => f.key === field.key));
    return asking.length > 0 && asking.every((s) => s.answers[field.key] === true);
  };

  /** What's missing on one seat, or null. Mirrors the server's checks. */
  const seatProblem = (seat: Seat): string | null => {
    if (!seat.attendee.name.trim() || !seat.attendee.email.trim())
      return "name and email are required";
    for (const f of fieldsFor(seat.tierId)) {
      if (!f.required || CONSENT_TYPES.includes(f.type)) continue;
      const part = NAME_PART[f.type];
      if (part) {
        if (!seat.nameParts[part].trim()) return `"${f.label}" is required`;
        continue;
      }
      const key = ATTENDEE_KEYS[f.type];
      if (key) {
        if (!String(seat.attendee[key] || "").trim()) return `"${f.label}" is required`;
        continue;
      }
      const v = seat.answers[f.key];
      const empty = Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
      if (empty) return `"${f.label}" is required`;
    }
    return null;
  };

  const seatState = (seat: Seat) => {
    if (!seatProblem(seat)) return "Complete";
    const touched =
      seat.attendee.name || seat.attendee.email || Object.keys(seat.answers).length;
    return touched ? "In progress" : "Not started";
  };

  function validateDetails(): string | null {
    if (!seats.length) return "Choose a ticket first";
    for (const [i, seat] of seats.entries()) {
      const problem = seatProblem(seat);
      if (problem) return seats.length > 1 ? `Attendee ${i + 1}: ${problem}` : `Attendee: ${problem}`;
    }
    const emails = seats.map((s) => s.attendee.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) return "Each attendee needs their own email address";
    for (const f of consentFields)
      if (f.required && !consentValue(f)) return `Please accept "${f.label}"`;
    if (!billing.name.trim()) return "Billing: full name is required";
    if (!profile.email) return "Sign in again to complete your order";
    if (!billing.country.trim()) return "Billing: country is required";
    return null;
  }

  // ── Quote ───────────────────────────────────────────────────────────────
  // Billing country is re-quoted on blur, not per keystroke — read through a
  // ref so the callback always sends the latest value.
  const countryRef = useRef(billing.country);
  countryRef.current = billing.country;
  const refreshQuote = useCallback(async () => {
    if (!cartItems.length) return;
    setQuoting(true);
    try {
      setQuote(
        await quoteTickets(slug, {
          items: cartItems,
          promoCode: appliedPromo || undefined,
          country: countryRef.current || undefined,
          addons: addonSelection,
        })
      );
    } catch {
      setQuote(null);
    } finally {
      setQuoting(false);
    }
  }, [slug, cartItems, appliedPromo, addonSelection]);

  useEffect(() => {
    if (!cartItems.length) {
      setQuote(null);
      return;
    }
    void refreshQuote();
  }, [cartItems, refreshQuote]);

  const currency = chosen[0]?.tier.currency || quote?.currency || "USD";
  const lines = useMemo(() => {
    const out = chosen.map((c) => ({
      label: `${c.quantity}× ${c.tier.name}`,
      amount: c.tier.price * c.quantity,
    }));
    addons
      .filter((a) => addonOn[a._id])
      .forEach((a) => out.push({ label: `1× ${a.name}`, amount: a.price }));
    return out;
  }, [chosen, addons, addonOn]);
  const subtotal = quote?.subtotal ?? lines.reduce((s, l) => s + l.amount, 0);
  const total = quote?.total ?? subtotal;

  // ── Submit ──────────────────────────────────────────────────────────────
  const buyer: AttendeeInput = {
    name: billing.name.trim(),
    email: profile.email,
    phone: profile.phone || undefined,
    company: billing.company.trim() || undefined,
    country: billing.country.trim() || undefined,
  };
  const seatPayload = () =>
    seats.map((s) => ({ ticketTierId: s.tierId, attendee: s.attendee, answers: s.answers }));
  const orderSignature = () =>
    JSON.stringify({ cartItems, addonSelection, appliedPromo, seats: seatPayload(), buyer });

  const scrollTop = () =>
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });

  const goStep = (next: Step) => {
    setError(null);
    setStep(next);
    scrollTop();
  };

  function goToDetails() {
    if (!chosen.length) return;
    if (mixesFreeAndPaid) {
      setError("Free passes have to be booked on their own. Remove either the free or the paid pass to continue.");
      return;
    }
    goStep(2);
  }

  /** Shows the passes, and keeps a copy for Purchases (see pass-store). */
  const finish = async (
    registrations: Array<{ qrCodeToken: string; ticketTierId: string }>,
    invoiceNumber?: string
  ) => {
    const tokens = registrations.map((r) => r.qrCodeToken);
    saveStoredOrder(user?.userId || "", {
      key: invoiceNumber || tokens[0],
      slug: data?.event.slug || slug,
      eventName: data?.event.name || "",
      invoiceNumber,
      passes: registrations.map((r, i) => ({
        token: r.qrCodeToken,
        tierName: tiers.find((t) => t._id === r.ticketTierId)?.name || "Admission",
        attendeeName: seats[i]?.attendee.name || "",
      })),
      savedAt: new Date().toISOString(),
    });
    const { passes } = await fetchPasses(tokens);
    setDone({
      passes,
      invoiceNumber,
      pendingApproval: passes.some((p) => p.status === "pending_approval"),
    });
    scrollTop();
  };

  async function submitDetails() {
    const problem = validateDetails();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (isFree) {
        const res = await registerFree(slug, {
          items: cartItems,
          attendee: buyer,
          answers: seats[0]?.answers || {},
          attendees: seatPayload(),
        });
        await finish(
          res.registrations ||
            [{ qrCodeToken: res.registration.qrCodeToken, ticketTierId: cartItems[0].ticketTierId }]
        );
        return;
      }

      const signature = orderSignature();
      if (checkoutRef?.signature === signature) {
        goStep(3);
        return;
      }
      // The order changed since that invoice was minted — void it rather than
      // leave it holding seats the buyer no longer wants.
      if (checkoutRef) {
        void api(`/api/invoices/${checkoutRef.invoiceId}/cancel`, { method: "POST" }).catch(() => {});
      }
      const res = await startCheckout(slug, {
        items: cartItems,
        attendee: buyer,
        promoCode: appliedPromo || undefined,
        addons: addonSelection,
        answers: seats[0]?.answers || {},
        attendees: seatPayload(),
      });
      setCheckoutRef({
        invoiceId: res.invoiceId,
        invoiceNumber: res.invoiceNumber,
        registrations:
          res.registrations ||
          [{ ticketTierId: cartItems[0].ticketTierId, qrCodeToken: res.qrCodeToken }],
        signature,
      });
      goStep(3);
    } catch (err: unknown) {
      setError((err instanceof Error && err.message) || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Paid. The invoice settles first and the tickets are fulfilled by its
   * webhook, so wait for the pass itself to say paid before showing it.
   */
  const cancelled = useRef(false);
  useEffect(() => () => void (cancelled.current = true), []);
  async function handlePaid() {
    if (!checkoutRef) return;
    setConfirming(true);
    const token = checkoutRef.registrations[0]?.qrCodeToken;
    for (let i = 0; i < 12 && token && !cancelled.current; i++) {
      try {
        const res = await getTicket(token);
        if (res.ticket.paymentStatus === "paid") break;
      } catch {
        // Best effort — the passes screen reads the status again.
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (cancelled.current) return;
    await finish(checkoutRef.registrations, checkoutRef.invoiceNumber);
    setConfirming(false);
    toast.success("You're going! Your passes are ready.");
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (loadError || !data) {
    return (
      <div className={PAGE}>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[12px] text-[#8a8a8a] hover:text-[#f5f5f5]">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to event
        </button>
        <div className="mt-7">
          {loadError ? (
            <EmptyPanel title="Could not open checkout" description={`${loadError}. The event may have been unpublished.`} />
          ) : (
            <div className="flex justify-center py-32">
              <Loader2 className="h-6 w-6 animate-spin text-[#5c5c5c]" />
            </div>
          )}
        </div>
      </div>
    );
  }

  const { event } = data;
  const eventMeta = [dateRange(event.startsAt, event.endsAt), locationLabel(event, "full")]
    .filter(Boolean)
    .join(" · ");
  const gstNote = event.addGstForIndianBuyers
    ? event.gstInclusive
      ? "Prices include 18% GST for buyers in India."
      : "Prices exclude 18% GST, added at checkout for buyers in India."
    : "";

  // ── Done ────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div ref={topRef} className={cn(PAGE, "scroll-mt-4")}>
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#16a34a]/15 text-[#4ade80]">
              <Check className="h-6 w-6" strokeWidth={2.5} />
            </span>
            <h1 className="mt-4 text-[22px] font-semibold leading-7 text-[#f5f5f5]">
              {done.pendingApproval ? "Application received" : "You're going!"}
            </h1>
            <p className="mt-1.5 text-[13px] leading-5 text-[#8a8a8a]">
              {done.pendingApproval
                ? "The organizer reviews every registration for this event. Your QR code appears once you're approved."
                : `Your ${done.passes.length === 1 ? "pass is" : "passes are"} below and saved in Purchases.`}
              {done.invoiceNumber ? ` Order ${done.invoiceNumber}.` : ""}
            </p>
          </div>

          <div className="mt-6">
            <EventBar image={event.bannerUrl} name={event.name} meta={eventMeta} />
          </div>

          <div className="mt-4 space-y-3">
            {done.passes.map((p) => (
              <PassCard key={p.qrCodeToken} slug={event.slug} pass={p} />
            ))}
            {!done.passes.length && (
              <EmptyPanel
                title="Your order is confirmed"
                description="Your passes are on their way by email and will show in Purchases shortly."
              />
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={onDone}
              className="h-9 rounded-lg bg-brand px-5 text-[13px] font-semibold text-brand-foreground transition-opacity hover:opacity-90"
            >
              Close
            </button>
            {onOpenPurchases && (
              <button type="button" onClick={onOpenPurchases} className={cn(OUTLINE_BUTTON, "h-9 px-4")}>
                View in Purchases
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const summaryCta =
    step === 1 ? (
      <PrimaryButton disabled={!chosen.length} onClick={goToDetails}>
        Continue to details
      </PrimaryButton>
    ) : step === 2 ? (
      <PrimaryButton loading={submitting} onClick={submitDetails}>
        {isFree
          ? event.requireApproval
            ? "Request to attend"
            : "Complete registration"
          : "Continue to payment"}
      </PrimaryButton>
    ) : null;

  return (
    <div ref={topRef} className={cn(PAGE, "scroll-mt-4")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[12px] text-[#8a8a8a] transition-colors hover:text-[#f5f5f5]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to event
        </button>
        <Stepper current={step} onGo={(s) => goStep(s)} />
      </div>

      <div className="mt-5 border-b border-[#262626] pb-3">
        <EventBar image={event.bannerUrl} name={event.name} meta={eventMeta} />
      </div>

      <div className="mt-7 grid items-start gap-7 @4xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {step === 1 && (
            <section>
              <h1 className="text-[22px] font-semibold leading-7 text-[#f5f5f5]">Choose your tickets</h1>
              {gstNote && <p className="mt-1 text-[12px] leading-4 text-[#8a8a8a]">{gstNote}</p>}

              <div className="mt-5 space-y-2.5">
                {tiers.length === 0 && (
                  <EmptyPanel title="No tickets on sale" description="Check back when the organizer opens sales." />
                )}
                {tiers.map((t) => (
                  <TierRow
                    key={t._id}
                    tier={t}
                    quantity={cart[t._id] || 0}
                    popular={t._id === popularTierId}
                    onQuantity={(qty) =>
                      setCart((prev) => {
                        const next = { ...prev };
                        if (qty > 0) next[t._id] = qty;
                        else delete next[t._id];
                        return next;
                      })
                    }
                  />
                ))}
              </div>

              {error && <p className="mt-3 text-[12px] text-[#f87171]">{error}</p>}

              {addons.length > 0 && (
                <>
                  <h2 className="mt-8 text-[18px] font-semibold leading-[26px] text-[#f5f5f5]">Add-ons</h2>
                  <div className="mt-3 space-y-2.5">
                    {addons.map((a) => {
                      const on = !!addonOn[a._id];
                      return (
                        <button
                          key={a._id}
                          type="button"
                          onClick={() => setAddonOn((p) => ({ ...p, [a._id]: !on }))}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-lg border bg-[#202020] px-4 py-3.5 text-left transition-colors",
                            on ? "border-[#3a3a3a]" : "border-[#262626] hover:border-[#333333]"
                          )}
                        >
                          <CheckBox checked={on} />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium leading-5 text-[#f5f5f5]">
                              {a.name} — {a.price > 0 ? money(a.price, a.currency) : "Free"}
                            </span>
                            {a.description && (
                              <span className="block text-[12px] leading-4 text-[#8a8a8a]">{a.description}</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="mt-8">
                <p className="text-[13px] font-semibold text-[#f5f5f5]">Have a code?</p>
                <div className="mt-2 flex gap-2.5">
                  <input
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && promoInput.trim()) setAppliedPromo(promoInput.trim());
                    }}
                    placeholder="Enter code"
                    className={cn(INPUT, "h-9")}
                  />
                  <button
                    type="button"
                    disabled={!promoInput.trim()}
                    onClick={() => setAppliedPromo(promoInput.trim())}
                    className={cn(OUTLINE_BUTTON, "h-9 shrink-0 px-4")}
                  >
                    Apply
                  </button>
                </div>
                {appliedPromo && quote && !quoting && (
                  <PromoResult
                    code={appliedPromo}
                    quote={quote}
                    currency={currency}
                    onRemove={() => {
                      setAppliedPromo("");
                      setPromoInput("");
                    }}
                  />
                )}
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="text-[22px] font-semibold leading-7 text-[#f5f5f5]">Who&apos;s attending?</h1>

              <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-[#262626] bg-[#202020] px-4 py-3.5">
                <span className="text-[13px] text-[#f5f5f5]">I&apos;m attending too</span>
                <SwitchControl checked={attendingToo} onChange={toggleAttending} aria-label="I'm attending too" />
              </div>

              <div className="mt-5 space-y-3">
                {seats.map((seat, i) => {
                  const open = expanded.has(i);
                  const prefilled =
                    i === 0 && attendingToo && !!profile.email &&
                    seat.attendee.email.trim().toLowerCase() === profile.email.toLowerCase();
                  const fields = fieldsFor(seat.tierId).filter((f) => !CONSENT_TYPES.includes(f.type));
                  const state = seatState(seat);
                  const toggleOpen = () =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    });
                  return (
                    <div key={`${seat.tierId}-${i}`} className="rounded-xl border border-[#262626] bg-[#202020]">
                      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
                        <div className="min-w-0">
                          <button type="button" onClick={toggleOpen} className="text-left">
                            <span
                              className={cn(
                                "text-[11px] font-bold uppercase tracking-[0.08em]",
                                open ? "text-brand" : "text-[#bdbdbd]"
                              )}
                            >
                              Attendee {i + 1} · {seat.tierName}
                            </span>
                          </button>
                          {!open && i > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const from = seats[0];
                                patchSeat(i, {
                                  attendee: {
                                    ...seat.attendee,
                                    company: from.attendee.company,
                                    jobTitle: from.attendee.jobTitle,
                                    country: from.attendee.country,
                                  },
                                  // Custom answers carry over; consents are set once for the order.
                                  answers: { ...from.answers, ...seat.answers },
                                });
                                setExpanded((prev) => new Set(prev).add(i));
                              }}
                              className="mt-1 block text-[11px] text-[#8a8a8a] underline underline-offset-2 hover:text-[#f5f5f5]"
                            >
                              Copy details from Attendee 1
                            </button>
                          )}
                        </div>
                        {prefilled && open ? (
                          <span className="flex shrink-0 items-center gap-1 text-[11px] text-[#4ade80]">
                            <Check className="h-3 w-3" />
                            Pre-filled
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={toggleOpen}
                            className={cn(
                              "flex shrink-0 items-center gap-0.5 text-[12px]",
                              state === "Complete" ? "text-[#4ade80]" : "text-[#8a8a8a]"
                            )}
                          >
                            {state}
                            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>

                      {open && (
                        <div className="border-t border-[#262626] px-4 pb-4 pt-4">
                          <div className="grid gap-x-3 gap-y-3.5 @xl:grid-cols-2">
                            {fields.map((f) => (
                              <div key={f.key} className={fieldSpansRow(f) ? "@xl:col-span-2" : ""}>
                                <Field
                                  field={f}
                                  seat={seat}
                                  onAttendee={(patch) => patchSeat(i, { attendee: { ...seat.attendee, ...patch } })}
                                  onNamePart={(part, value) => {
                                    const nameParts = { ...seat.nameParts, [part]: value };
                                    patchSeat(i, { nameParts, attendee: { ...seat.attendee, name: joinName(nameParts) } });
                                  }}
                                  onAnswer={(value) => patchSeat(i, { answers: { ...seat.answers, [f.key]: value } })}
                                />
                              </div>
                            ))}
                          </div>
                          {prefilled && (
                            <p className="mt-3.5 text-[11px] text-[#6b6b6b]">Filled from your Garage profile</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-xl border border-[#262626] bg-[#202020] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#bdbdbd]">
                  Buyer / billing details
                </p>
                <div className="mt-4 grid gap-x-3 gap-y-3.5 @xl:grid-cols-2">
                  <Labeled label="Full name" required>
                    <input
                      value={billing.name}
                      onChange={(e) => setBilling((b) => ({ ...b, name: e.target.value }))}
                      autoComplete="name"
                      className={cn(INPUT, "h-10")}
                    />
                  </Labeled>
                  <Labeled label="Billing email" required hint="Your order is saved to this account">
                    <div className="relative">
                      <input value={profile.email} disabled className={cn(INPUT, "h-10 pr-8")} />
                      <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5c5c5c]" />
                    </div>
                  </Labeled>
                  <Labeled label="Company name">
                    <input
                      value={billing.company}
                      onChange={(e) => setBilling((b) => ({ ...b, company: e.target.value }))}
                      placeholder="Acme Inc"
                      autoComplete="organization"
                      className={cn(INPUT, "h-10")}
                    />
                  </Labeled>
                  <Labeled label="Billing country" required hint="Decides any tax on your order">
                    <input
                      value={billing.country}
                      onChange={(e) => setBilling((b) => ({ ...b, country: e.target.value }))}
                      onBlur={() => void refreshQuote()}
                      placeholder="India"
                      autoComplete="country-name"
                      className={cn(INPUT, "h-10")}
                    />
                  </Labeled>
                </div>
              </div>

              {consentFields.length > 0 && (
                <div className="mt-6 space-y-3">
                  {consentFields.map((f) => {
                    const on = consentValue(f);
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setConsent(f, !on)}
                        className="flex items-start gap-2.5 text-left text-[13px] leading-5 text-[#d4d4d4]"
                      >
                        <CheckBox checked={on} />
                        <span>
                          {f.label}
                          {f.required && <span className="ml-1 text-[#f87171]">*</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {event.requireApproval && (
                <p className="mt-5 flex gap-2 rounded-lg border border-[#262626] p-3.5 text-[12px] leading-5 text-[#8a8a8a]">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  This event requires organizer approval. You&apos;ll be notified by email once your registration is reviewed.
                </p>
              )}

              {error && <p className="mt-4 text-[13px] text-[#f87171]">{error}</p>}
            </section>
          )}

          {step === 3 && checkoutRef && (
            <section>
              <h1 className="text-[22px] font-semibold leading-7 text-[#f5f5f5]">Payment</h1>
              <p className="mt-1 text-[13px] leading-5 text-[#8a8a8a]">Choose your preferred payment method.</p>

              <div className="mt-5 rounded-xl border border-[#262626] bg-[#202020] p-4">
                <CheckoutPaymentStep
                  invoiceId={checkoutRef.invoiceNumber || checkoutRef.invoiceId}
                  organizationName={data.organization?.name || event.name}
                  userEmail={profile.email}
                  userName={billing.name}
                  userPhone={profile.phone || undefined}
                  showInvoicePreview={false}
                  onSuccess={() => void handlePaid()}
                  onCancel={() => {
                    // The payment step cancelled the invoice on its way out.
                    setCheckoutRef(null);
                    goStep(2);
                  }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#262626] bg-[#202020] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b6b6b]">
                    Billing
                  </span>
                  <span className="truncate text-[13px] text-[#d4d4d4]">
                    {[billing.name, billing.company, billing.country].filter(Boolean).join(", ")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => goStep(2)}
                  className="shrink-0 text-[12px] text-[#8a8a8a] underline underline-offset-2 hover:text-[#f5f5f5]"
                >
                  Edit
                </button>
              </div>

              <p className="mt-4 flex items-center gap-2 text-[11px] text-[#6b6b6b]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Payments are processed by Garage Pay. Card details never touch the organiser.
              </p>
            </section>
          )}
        </div>

        <aside className="space-y-3 @4xl:sticky @4xl:top-6">
          <section className="rounded-xl border border-[#2a2a2a] bg-[#262626] p-5">
            <h2 className="text-[15px] font-semibold leading-5 text-[#f5f5f5]">Order summary</h2>
            <div className="mt-4 space-y-2">
              {lines.length === 0 && <p className="text-[12px] text-[#6b6b6b]">No tickets selected yet.</p>}
              {lines.map((l) => (
                <SummaryLine key={l.label} label={l.label} value={money(l.amount, currency)} />
              ))}
            </div>
            <div className="my-4 h-px bg-[#333333]" />
            <div className="space-y-2">
              <SummaryLine label="Subtotal" value={money(subtotal, currency)} />
              {!!quote?.discount && (
                <SummaryLine
                  label={appliedPromo ? `Discount (${appliedPromo})` : "Discount"}
                  value={`−${money(quote.discount, currency)}`}
                  green
                />
              )}
              {!!quote?.tax && <SummaryLine label={`GST (${quote.taxRate}%)`} value={money(quote.tax, currency)} />}
            </div>
            <div className="my-4 h-px bg-[#333333]" />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold text-[#f5f5f5]">Total</span>
              <span className="text-[22px] font-bold tabular-nums text-[#f5f5f5]">
                {quoting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#8a8a8a]" />
                ) : total > 0 ? (
                  money(total, currency)
                ) : (
                  "Free"
                )}
              </span>
            </div>
            {summaryCta && <div className="mt-5">{summaryCta}</div>}
            {step === 3 && (
              <p className="mt-4 text-center text-[11px] leading-4 text-[#6b6b6b]">
                Pick a method on the left to pay {money(total, currency)}.
              </p>
            )}
          </section>
          {step > 1 && (
            <button
              type="button"
              onClick={() => goStep((step - 1) as Step)}
              className="block w-full text-center text-[13px] text-[#8a8a8a] transition-colors hover:text-[#f5f5f5]"
            >
              Back
            </button>
          )}
        </aside>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[300] grid place-items-center bg-black/60 px-6 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-[#262626] bg-[#1c1c1c] px-8 py-9 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
            <h3 className="mt-5 text-[15px] font-semibold text-[#f5f5f5]">Confirming your payment</h3>
            <p className="mt-1 text-[12px] text-[#8a8a8a]">Don&apos;t close this page</p>
            {checkoutRef?.invoiceNumber && (
              <p className="mt-4 font-mono text-[12px] text-[#bdbdbd]">{checkoutRef.invoiceNumber}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────

const STEPS = ["Tickets", "Details", "Payment"] as const;

function Stepper({ current, onGo }: { current: Step; onGo: (step: Step) => void }) {
  return (
    <nav className="flex items-center gap-2.5">
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step;
        const doneStep = n < current;
        const active = n === current;
        return (
          <React.Fragment key={label}>
            {i > 0 && <span className="h-px w-6 bg-[#333333]" />}
            <button
              type="button"
              disabled={!doneStep}
              onClick={() => onGo(n)}
              className="flex items-center gap-2 disabled:cursor-default"
            >
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold",
                  active && "bg-brand text-brand-foreground",
                  doneStep && "bg-[#16a34a] text-white",
                  !active && !doneStep && "bg-[#262626] text-[#8a8a8a]"
                )}
              >
                {doneStep ? <Check className="h-3 w-3" strokeWidth={3} /> : n}
              </span>
              <span
                className={cn(
                  "text-[13px]",
                  active ? "font-semibold text-[#f5f5f5]" : doneStep ? "text-[#bdbdbd]" : "text-[#8a8a8a]"
                )}
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

function TierRow({
  tier: t,
  quantity,
  popular,
  onQuantity,
}: {
  tier: PublicTierPayload;
  quantity: number;
  popular: boolean;
  onQuantity: (qty: number) => void;
}) {
  const available = t.onSale && !t.soldOut;
  const max = Math.min(20, Math.max(0, t.remaining));
  const sub = t.soldOut
    ? { text: "No passes remaining", tone: "text-[#6b6b6b]" }
    : !t.onSale
      ? {
          text:
            t.salesStart && new Date(t.salesStart).getTime() > Date.now()
              ? `Available from ${dateRange(t.salesStart)}`
              : t.isPaused
                ? "Sales paused"
                : "Sales closed",
          tone: "text-[#6b6b6b]",
        }
      : t.remaining < LOW_STOCK
        ? { text: `${t.remaining} left`, tone: "text-[#f87171]" }
        : t.remaining < SHOW_REMAINING_BELOW
          ? { text: `${t.remaining} left`, tone: "text-brand" }
          : t.description
            ? { text: t.description, tone: "text-[#8a8a8a]" }
            : null;

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border bg-[#202020] px-4 py-3.5",
        popular && available ? "border-brand" : "border-[#262626]",
        !available && "opacity-50"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-semibold leading-5 text-[#f5f5f5]">{t.name}</span>
          {popular && available && (
            <span className="rounded bg-brand/15 px-1.5 py-px text-[10px] font-medium leading-4 text-brand">
              Most popular
            </span>
          )}
          {t.soldOut && (
            <span className="rounded bg-[#2e2e2e] px-1.5 py-px text-[10px] leading-4 text-[#8a8a8a]">Sold out</span>
          )}
        </div>
        {sub && <p className={cn("mt-0.5 truncate text-[11px] leading-4", sub.tone)}>{sub.text}</p>}
      </div>
      <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[#f5f5f5]">
        {t.price > 0 ? money(t.price, t.currency) : "Free"}
      </span>
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[#2a2a2a] bg-[#181818] p-1">
        <button
          type="button"
          aria-label={`Fewer ${t.name}`}
          disabled={!available || quantity <= 0}
          onClick={() => onQuantity(quantity - 1)}
          className="grid h-6 w-6 place-items-center rounded-md bg-[#262626] text-[#bdbdbd] transition-colors hover:bg-[#2e2e2e] disabled:opacity-40"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-6 text-center text-[13px] font-semibold tabular-nums text-[#f5f5f5]">{quantity}</span>
        <button
          type="button"
          aria-label={`More ${t.name}`}
          disabled={!available || quantity >= max}
          onClick={() => onQuantity(quantity + 1)}
          className="grid h-6 w-6 place-items-center rounded-md bg-[#262626] text-[#bdbdbd] transition-colors hover:bg-[#2e2e2e] disabled:opacity-40"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function PromoResult({
  code,
  quote,
  currency,
  onRemove,
}: {
  code: string;
  quote: QuoteResult;
  currency: string;
  onRemove: () => void;
}) {
  const ok = quote.promoValid || quote.promoDeferred;
  return (
    <div
      className={cn(
        "mt-3 flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-[12px]",
        ok
          ? "border-[#16a34a]/30 bg-[#16a34a]/10 text-[#4ade80]"
          : "border-[#f87171]/30 bg-[#f87171]/10 text-[#f87171]"
      )}
    >
      <span>
        {ok
          ? quote.discount > 0
            ? `✓ ${code} applied — ${money(quote.discount, currency)} off`
            : `✓ ${code} will be applied at payment`
          : quote.promoError || `${code} isn't valid for this event`}
      </span>
      <button type="button" onClick={onRemove} className="shrink-0 underline underline-offset-2 opacity-80 hover:opacity-100">
        Remove
      </button>
    </div>
  );
}

function SummaryLine({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className={green ? "text-[#4ade80]" : "text-[#a3a3a3]"}>{label}</span>
      <span className={cn("tabular-nums", green ? "text-[#4ade80]" : "text-[#f5f5f5]")}>{value}</span>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand text-[13px] font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
        checked ? "border-brand bg-brand text-brand-foreground" : "border-[#4a4a4a]"
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

function Labeled({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] text-[#bdbdbd]">
        {label}
        {required && <span className="ml-0.5 text-[#f87171]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-[#6b6b6b]">{hint}</p>}
    </div>
  );
}

/** One organizer form field, dark. Rules live in components/events/checkout/FormFields. */
function Field({
  field: f,
  seat,
  onAttendee,
  onNamePart,
  onAnswer,
}: {
  field: EventFormField;
  seat: Seat;
  onAttendee: (patch: Partial<AttendeeInput>) => void;
  onNamePart: (part: "first" | "last", value: string) => void;
  onAnswer: (value: unknown) => void;
}) {
  const help = f.helpText ? <p className="mt-1 text-[11px] text-[#6b6b6b]">{f.helpText}</p> : null;
  const wrap = (control: React.ReactNode) => (
    <Labeled label={f.label} required={f.required}>
      {control}
      {help}
    </Labeled>
  );

  const part = NAME_PART[f.type];
  if (part) {
    return wrap(
      <input
        value={seat.nameParts[part]}
        onChange={(e) => onNamePart(part, e.target.value)}
        placeholder={f.placeholder}
        autoComplete={part === "first" ? "given-name" : "family-name"}
        className={cn(INPUT, "h-10")}
      />
    );
  }

  const key = ATTENDEE_KEYS[f.type];
  if (key) {
    return wrap(
      <input
        type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
        value={(seat.attendee[key] as string) || ""}
        onChange={(e) => onAttendee({ [key]: e.target.value })}
        placeholder={f.placeholder}
        className={cn(INPUT, "h-10")}
      />
    );
  }

  if (f.type === "long_text") {
    return wrap(
      <textarea
        rows={3}
        value={(seat.answers[f.key] as string) || ""}
        onChange={(e) => onAnswer(e.target.value)}
        placeholder={f.placeholder}
        className={cn(INPUT, "resize-y py-2.5")}
      />
    );
  }

  if (f.type === "dropdown") {
    return wrap(
      <div className="relative">
        <select
          value={(seat.answers[f.key] as string) || ""}
          onChange={(e) => onAnswer(e.target.value)}
          className={cn(INPUT, "h-10 appearance-none pr-9 [&>option]:bg-[#1a1a1a]")}
        >
          <option value="">{f.placeholder || "Select…"}</option>
          {f.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6b6b6b]" />
      </div>
    );
  }

  if (f.type === "multi_select") {
    const chosen = Array.isArray(seat.answers[f.key]) ? (seat.answers[f.key] as string[]) : [];
    return wrap(
      <div className="flex flex-wrap gap-1.5">
        {f.options.map((o) => {
          const on = chosen.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onAnswer(on ? chosen.filter((c) => c !== o) : [...chosen, o])}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                on ? "border-brand bg-brand/10 text-brand" : "border-[#2e2e2e] text-[#bdbdbd] hover:border-[#3a3a3a]"
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    );
  }

  return wrap(
    <input
      value={(seat.answers[f.key] as string) || ""}
      onChange={(e) => onAnswer(e.target.value)}
      placeholder={f.placeholder}
      className={cn(INPUT, "h-10")}
    />
  );
}
