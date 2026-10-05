"use client";

// The attendee checkout, as a page rather than a drawer.
//
// Three steps on one route — tickets → details → payment — with the order
// summary pinned alongside the whole way. Free and approval-gated tiers finish
// at the end of step two and go straight to the confirmation page.
//
// Paid tiers hand off to Garage Pay. The invoice is minted on "Proceed to
// pay", opened in an overlay (`/invoice/:number?embed=1`, the same surface
// every other paid checkout in the app uses), and when that surface posts
// `invoice:paid` back we close it, confirm the ticket flipped to paid, and
// send the buyer to the confirmation page. The buyer never leaves this route.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Lock,
  ArrowLeft,
} from "lucide-react";
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
} from "@/components/dashboard/inlineApps/events/api";
import {
  C,
  CheckoutShell,
  DEFAULT_ACCENT,
  Stepper,
  SummaryRow,
  eventDateRange,
  eventLocation,
  money,
} from "@/components/events/checkout/ui";
import {
  ATTENDEE_KEYS,
  CONSENT_TYPES,
  FormFieldInput,
  NAME_PART,
  fieldSpansRow,
  joinName,
  type NameParts,
} from "@/components/events/checkout/FormFields";
import { saveOrder } from "@/components/events/checkout/orderCache";
import CheckoutIdentity from "@/components/events/checkout/CheckoutIdentity";
import { useAuthStore } from "@/store/authStore";

type Step = 1 | 2 | 3;

/** One named attendee against one seat of one pass type. */
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
  /** The first pass in the order — the one the confirmation page opens on. */
  qrCodeToken: string;
  /** Every ticket the order minted, one per pass type. */
  registrations: Array<{ ticketTierId: string; qrCodeToken: string }>;
}

export default function CheckoutClient({
  slug,
  initialTierId,
  initialRef,
}: {
  slug: string;
  initialTierId?: string;
  /** `?ref=` / `?referCode=`, read on the server by the page. */
  initialRef?: string;
}) {
  const router = useRouter();
  // Signing in is a required step, not an offer — see CheckoutIdentity.
  const isSignedIn = useAuthStore((s) => s.isAuthenticated);

  /**
   * Whoever's share link brought this buyer here.
   *
   * Parked in sessionStorage because the ref rides on the EVENT url, not on
   * the checkout url — a buyer who lands on /events/x?ref=aff_1 and then
   * clicks through to /events/x/checkout would otherwise lose it. Read once
   * on mount so a later render can't clear it.
   */
  const [referralCode, setReferralCode] = useState(initialRef || "");
  useEffect(() => {
    const key = `event-ref:${slug}`;
    const incoming = initialRef || "";
    if (incoming) {
      setReferralCode(incoming);
      try {
        sessionStorage.setItem(key, incoming);
      } catch {
        // Private mode — the code still works for this page view.
      }
      return;
    }
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) setReferralCode(stored);
    } catch {
      // Nothing to recover.
    }
  }, [slug, initialRef]);

  const [data, setData] = useState<PublicEventPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>(1);
  /** Chosen passes, keyed by tier id → quantity. Several types at once. */
  const [cart, setCart] = useState<Record<string, number>>({});
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  /** The code actually sent to the quote — typing alone must not reprice. */
  const [appliedPromo, setAppliedPromo] = useState("");

  /**
   * One entry per seat in the order, not one per order.
   *
   * A two-ticket order is two people, each scanned in separately, so each
   * answers the organizer's form in full and gets their own pass. The list is
   * derived from the ticket quantities rather than grown by an "add" button —
   * that is what keeps it from running away: to name another attendee you buy
   * another ticket.
   */
  const [seats, setSeats] = useState<Seat[]>([]);

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [checkoutRef, setCheckoutRef] = useState<CheckoutRef | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const accent = data?.website?.theme?.primaryColor || DEFAULT_ACCENT;

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    getPublicEvent(slug)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        // Start with one of the pass the buyer clicked, or the first one that
        // is actually on sale. They can add other types on top from here.
        const tiers = res.tiers || [];
        const buyable = tiers.filter((t) => !t.soldOut && t.onSale);
        const first =
          (initialTierId && buyable.some((t) => t._id === initialTierId)
            ? initialTierId
            : buyable[0]?._id) || null;
        if (first) setCart({ [first]: 1 });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || "Event not found");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, initialTierId]);

  const tiers = (data?.tiers || []) as PublicTierPayload[];

  /** The passes in the cart, in the order the organizer listed them. */
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
  /** The first pass in the cart — what one-ticket copy refers to. */
  const tier = chosen[0]?.tier || null;

  // Free passes mint no invoice and paid ones mint nothing else, so an order
  // cannot hold both: the API takes a free registration and a paid checkout
  // through two different endpoints.
  const mixesFreeAndPaid =
    chosen.some((c) => c.tier.price > 0) && chosen.some((c) => c.tier.price <= 0);

  // Add-ons are optional extras, so a sold-out one is simply not offered
  // rather than shown greyed out next to the ticket the buyer came for.
  const addons = useMemo(
    () => (data?.addons || []).filter((a) => !a.soldOut && a.onSale),
    [data?.addons]
  );

  const addonSelection = useMemo(
    () =>
      Object.entries(addonQty)
        .filter(([, q]) => q > 0)
        .map(([ticketTierId, qty]) => ({ ticketTierId, quantity: qty })),
    [addonQty]
  );

  /**
   * One seat per ticket bought, in cart order.
   *
   * Rebuilt whenever the quantities change, keeping whatever was already typed
   * against the seats that survive — dropping from 3 tickets to 2 must not
   * wipe the first two attendees.
   */
  useEffect(() => {
    setSeats((prev) => {
      const pools = new Map<string, Seat[]>();
      prev.forEach((s) => {
        const list = pools.get(s.tierId) || [];
        list.push(s);
        pools.set(s.tierId, list);
      });
      const next: Seat[] = [];
      for (const c of chosen) {
        const pool = pools.get(c.tier._id) || [];
        for (let i = 0; i < c.quantity; i++)
          next.push(pool[i] || newSeat(c.tier._id, c.tier.name));
      }
      return next;
    });
  }, [chosen]);

  const patchSeat = useCallback((index: number, patch: Partial<Seat>) => {
    setSeats((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }, []);

  /**
   * The fields one pass asks for.
   *
   * Applied per seat rather than across the whole cart, because that is what
   * the server does: a VIP-only question is required on the VIP seat and is
   * neither asked nor stored on the general-admission one beside it.
   */
  const allFields = useMemo(
    () => [...(data?.form?.fields || [])].sort((a, b) => a.order - b.order),
    [data?.form]
  );
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

  /** The buyer is the first seat — they own the order and the billing country. */
  const buyer = seats[0];
  const attendee: AttendeeInput = buyer?.attendee || { name: "", email: "" };
  /** The form only asks for a country when the organizer added the field. */
  const formHasCountry = buyer
    ? fieldsFor(buyer.tierId).some((f) => f.type === "country")
    : false;

  // ── Quote ───────────────────────────────────────────────────────────────
  const refreshQuote = useCallback(async () => {
    if (!cartItems.length) return;
    setQuoting(true);
    try {
      const q = await quoteTickets(slug, {
        items: cartItems,
        promoCode: appliedPromo || undefined,
        country: attendee.country,
        addons: addonSelection,
      });
      setQuote(q);
    } catch {
      setQuote(null);
    } finally {
      setQuoting(false);
    }
  }, [slug, cartItems, appliedPromo, attendee.country, addonSelection]);

  useEffect(() => {
    if (!cartItems.length) {
      setQuote(null);
      return;
    }
    void refreshQuote();
  }, [cartItems, appliedPromo, addonSelection, refreshQuote]);

  const currency = tier?.currency || quote?.currency || "USD";
  /** A free order — every pass in it is $0, so it registers instead of paying. */
  const isFree = chosen.length > 0 && chosen.every((c) => c.tier.price <= 0);

  /** Line items, shared by the summary card and the cached order. */
  const lines = useMemo(() => {
    const out: Array<{ label: string; amount: number }> = [];
    for (const c of chosen) {
      out.push({
        label: `${c.quantity}× ${c.tier.name}`,
        amount: c.tier.price * c.quantity,
      });
    }
    for (const a of addons) {
      const q = addonQty[a._id] || 0;
      if (q > 0) out.push({ label: `${q}× ${a.name}`, amount: a.price * q });
    }
    return out;
  }, [chosen, addons, addonQty]);

  const subtotal = quote?.subtotal ?? lines.reduce((s, l) => s + l.amount, 0);
  const total = quote?.total ?? subtotal;

  const cacheOrder = useCallback(
    (
      token: string,
      invoiceNumber?: string,
      issued?: Array<{ ticketTierId: string; qrCodeToken: string }>
    ) => {
      saveOrder(token, {
        currency,
        lines,
        subtotal,
        discount: quote?.discount || 0,
        promoCode: quote?.discount ? appliedPromo : undefined,
        taxRate: quote?.taxRate || 0,
        tax: quote?.tax || 0,
        total,
        invoiceNumber,
        email: attendee.email,
        tickets: (issued || []).map((r) => ({
          label:
            tiers.find((t) => t._id === r.ticketTierId)?.name || "Admission",
          token: r.qrCodeToken,
        })),
      });
    },
    [currency, lines, subtotal, quote, appliedPromo, total, attendee.email, tiers]
  );

  // ── Step 1 → 2 ──────────────────────────────────────────────────────────
  function goToDetails() {
    if (!chosen.length) return;
    if (mixesFreeAndPaid) {
      setError(
        "Free passes have to be booked on their own. Remove either the free or the paid pass to continue."
      );
      return;
    }
    setError(null);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Step 2 validation ───────────────────────────────────────────────────
  function validateDetails(): string | null {
    if (!seats.length) return "Choose a ticket first";
    if (!isSignedIn)
      return "Sign in above to complete your registration";

    for (const [i, seat] of seats.entries()) {
      // Named so a 3-seat order says which person is missing something.
      // Prefixed only when there is more than one person to tell apart, so a
      // single-ticket order reads as a plain sentence rather than "Attendee 1:".
      const who = seats.length > 1 ? `Attendee ${i + 1}: ` : "";
      if (!seat.attendee.name.trim() || !seat.attendee.email.trim())
        return seats.length > 1
          ? `${who}name and email are required`
          : "Name and email are required";

      const fields = fieldsFor(seat.tierId);

      // A required last name has to be checked on its own half: the combined
      // `name` is non-empty as soon as the first name is typed.
      for (const f of fields) {
        const part = NAME_PART[f.type];
        if (part && f.required && !seat.nameParts[part].trim())
          return `${who}"${f.label}" is required`;
      }

      // Mirror of the server's check — it exists there because the form is
      // public data, and here so the buyer sees the problem without a round
      // trip.
      for (const f of fields) {
        if (!f.required) continue;
        if (CONSENT_TYPES.includes(f.type)) {
          if (seat.answers[f.key] !== true)
            return `${who}please accept "${f.label}"`;
          continue;
        }
        if (ATTENDEE_KEYS[f.type] || NAME_PART[f.type]) continue;
        const v = seat.answers[f.key];
        const empty = Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
        if (empty) return `${who}"${f.label}" is required`;
      }
    }

    // Each pass is scanned in against one person, so two seats on one address
    // would be the same attendee twice — and the server rejects it anyway.
    const emails = seats.map((s) => s.attendee.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length)
      return "Each attendee needs their own email address";

    return null;
  }

  /** The per-seat payload both submit paths send. */
  const attendeePayload = () =>
    seats.map((s) => ({
      ticketTierId: s.tierId,
      attendee: s.attendee,
      answers: s.answers,
    }));

  /** Step two's action: free tickets finish here, paid ones move to payment. */
  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen.length) return;
    const problem = validateDetails();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);

    if (!isFree) {
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerFree(slug, {
        items: cartItems,
        // Buyer at the top for older readers of this payload; the seat list
        // is what actually mints the passes.
        attendee,
        answers: buyer?.answers || {},
        attendees: attendeePayload(),
        referralCode: referralCode || undefined,
      });
      const token = res.registration.qrCodeToken;
      cacheOrder(token, undefined, res.registrations);
      router.push(`/events/${slug}/registered/${token}`);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  // ── Step 3: hand off to Garage Pay ──────────────────────────────────────
  async function proceedToPay() {
    if (!chosen.length) return;
    setError(null);

    // Reuse the invoice from a previous attempt — a buyer who closed the
    // payment overlay and came back must not mint a second invoice and hold a
    // second set of seats.
    if (checkoutRef) {
      setPayOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await startCheckout(slug, {
        items: cartItems,
        attendee,
        promoCode: appliedPromo || undefined,
        addons: addonSelection,
        answers: buyer?.answers || {},
        attendees: attendeePayload(),
        referralCode: referralCode || undefined,
      });
      const issued = res.registrations || [
        { ticketTierId: cartItems[0].ticketTierId, qrCodeToken: res.qrCodeToken },
      ];
      setCheckoutRef({
        invoiceId: res.invoiceId,
        invoiceNumber: res.invoiceNumber,
        qrCodeToken: res.qrCodeToken,
        registrations: issued,
      });
      cacheOrder(res.qrCodeToken, res.invoiceNumber, issued);
      setPayOpen(true);
    } catch (err: any) {
      setError(err?.message || "Could not start the payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Payment came back clean. The invoice is settled, but the ticket is
   * fulfilled by the invoice webhook, so poll until the registration itself
   * says paid before showing a confirmation page that claims it is.
   */
  const pollCancelled = useRef(false);
  useEffect(() => () => void (pollCancelled.current = true), []);

  async function handlePaid() {
    if (!checkoutRef) return;
    setPayOpen(false);
    setConfirming(true);
    const token = checkoutRef.qrCodeToken;
    cacheOrder(token, checkoutRef.invoiceNumber, checkoutRef.registrations);

    for (let i = 0; i < 12 && !pollCancelled.current; i++) {
      try {
        const res = await getTicket(token);
        if (res.ticket.paymentStatus === "paid") break;
      } catch {
        // Ticket lookup is best-effort; the confirmation page reads it again.
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (pollCancelled.current) return;
    router.push(`/events/${slug}/registered/${token}`);
  }

  // The payment overlay is the invoice page in embed mode. It reports success
  // by posting to its opener rather than redirecting, which is what lets the
  // buyer land back here instead of on /workspace.
  useEffect(() => {
    if (!payOpen) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if ((e.data as any)?.type === "invoice:paid") void handlePaid();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payOpen, checkoutRef]);

  // ── Render ──────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <CheckoutShell>
        <div className="py-16 text-center">
          <h1 className="text-xl font-bold" style={{ color: C.ink }}>
            Event not found
          </h1>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>
            This event may have been unpublished or the link is incorrect.
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

  const summary = (
    <OrderSummary
      event={data.event}
      lines={lines}
      currency={currency}
      subtotal={subtotal}
      quote={quote}
      quoting={quoting}
      promoCode={appliedPromo}
      total={total}
      accent={accent}
      footer={
        step === 1 ? (
          <PrimaryButton
            accent={accent}
            disabled={!chosen.length}
            onClick={goToDetails}
          >
            Continue
          </PrimaryButton>
        ) : step === 2 ? (
          <PrimaryButton
            accent={accent}
            type="submit"
            form="attendee-form"
            loading={submitting}
            // Nothing to submit until there is an account to hang the ticket
            // on; the form says why, so the button only has to stay shut.
            disabled={!isSignedIn}
          >
            {isFree
              ? data.event.requireApproval
                ? "Apply to attend"
                : "Complete registration"
              : "Continue to payment"}
          </PrimaryButton>
        ) : (
          <PrimaryButton accent={accent} loading={submitting} onClick={proceedToPay}>
            {quoting ? "Pay" : `Pay ${money(total, currency)}`}
          </PrimaryButton>
        )
      }
    />
  );

  return (
    <CheckoutShell
      event={data.event}
      organizationIcon={data.organization?.icon}
      organizationName={data.organization?.name}
      accent={accent}
    >
      <Stepper
        current={step}
        accent={accent}
        onBack={(s) => {
          setError(null);
          setStep(s);
        }}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {step === 1 && (
            <TicketStep
              tiers={tiers}
              addons={addons}
              cart={cart}
              addonQty={addonQty}
              accent={accent}
              promoOpen={promoOpen}
              promoCode={promoCode}
              appliedPromo={appliedPromo}
              quote={quote}
              error={error}
              onQuantity={(id, qty) =>
                setCart((prev) => {
                  const next = { ...prev };
                  if (qty > 0) next[id] = qty;
                  else delete next[id];
                  return next;
                })
              }
              onAddon={(id, qty) => setAddonQty((p) => ({ ...p, [id]: qty }))}
              onPromoOpen={() => setPromoOpen(true)}
              onPromoCode={setPromoCode}
              onApplyPromo={() => setAppliedPromo(promoCode.trim().toUpperCase())}
            />
          )}

          {step === 2 && seats.length > 0 && (
            <DetailsStep
              form={data.form}
              seats={seats}
              fieldsFor={fieldsFor}
              accent={accent}
              needsCountry={!formHasCountry}
              requireApproval={!!data.event.requireApproval}
              error={error}
              referralCode={referralCode}
              onSignedIn={(u) =>
                patchSeat(0, {
                  attendee: {
                    ...seats[0].attendee,
                    name: u.name || seats[0].attendee.name,
                    email: u.email || seats[0].attendee.email,
                    phone: u.phone || seats[0].attendee.phone,
                  },
                  nameParts: {
                    first: (u.name || "").split(/\s+/)[0] || "",
                    last: (u.name || "").split(/\s+/).slice(1).join(" "),
                  },
                })
              }
              onSubmit={submitDetails}
              onAttendee={(i, patch) =>
                patchSeat(i, { attendee: { ...seats[i].attendee, ...patch } })
              }
              onNamePart={(i, part, value) => {
                const next = { ...seats[i].nameParts, [part]: value };
                patchSeat(i, {
                  nameParts: next,
                  attendee: { ...seats[i].attendee, name: joinName(next) },
                });
              }}
              onAnswer={(i, key, value) =>
                patchSeat(i, { answers: { ...seats[i].answers, [key]: value } })
              }
              onCountryBlur={refreshQuote}
            />
          )}

          {step === 3 && chosen.length > 0 && (
            <PaymentStep
              accent={accent}
              passes={chosen.map((c) => `${c.tier.name} × ${c.quantity}`)}
              seats={seats}
              error={error}
              onBack={() => setStep(2)}
            />
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">{summary}</aside>
      </div>

      {payOpen && checkoutRef && (
        <PayOverlay
          invoiceRef={checkoutRef.invoiceNumber || checkoutRef.invoiceId}
          onClose={() => setPayOpen(false)}
        />
      )}

      {confirming && (
        <ConfirmingDialog
          accent={accent}
          reference={checkoutRef?.invoiceNumber || checkoutRef?.qrCodeToken.slice(0, 12)}
        />
      )}
    </CheckoutShell>
  );
}

// ══ Step 1 ════════════════════════════════════════════════════════════════

function TicketStep({
  tiers,
  addons,
  cart,
  addonQty,
  accent,
  promoOpen,
  promoCode,
  appliedPromo,
  quote,
  error,
  onQuantity,
  onAddon,
  onPromoOpen,
  onPromoCode,
  onApplyPromo,
}: {
  tiers: PublicTierPayload[];
  addons: PublicTierPayload[];
  cart: Record<string, number>;
  addonQty: Record<string, number>;
  accent: string;
  promoOpen: boolean;
  promoCode: string;
  appliedPromo: string;
  quote: QuoteResult | null;
  error: string | null;
  onQuantity: (id: string, qty: number) => void;
  onAddon: (id: string, qty: number) => void;
  onPromoOpen: () => void;
  onPromoCode: (v: string) => void;
  onApplyPromo: () => void;
}) {
  return (
    <section>
      <h1 className="text-[22px] font-bold" style={{ color: C.ink }}>
        Choose your tickets
      </h1>
      <p className="mt-1.5 text-[13px]" style={{ color: C.muted }}>
        Select the passes and workshops you would like to attend below. Mix as
        many pass types as you need.
      </p>

      <div
        className="mt-6 overflow-hidden rounded-xl border"
        style={{ borderColor: C.border }}
      >
        {tiers.length === 0 && (
          <p className="px-5 py-8 text-center text-sm" style={{ color: C.muted }}>
            No tickets are on sale right now.
          </p>
        )}
        {tiers.map((t, i) => {
          const disabled = t.soldOut || !t.onSale;
          const qty = cart[t._id] || 0;
          return (
            <div
              key={t._id}
              className="flex items-center gap-4 px-5 py-4"
              style={{
                borderTop: i === 0 ? undefined : `1px solid ${C.borderSoft}`,
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="text-[15px] font-semibold"
                    style={{ color: C.ink }}
                  >
                    {t.name}
                  </span>
                  {t.soldOut ? (
                    <Badge>SOLD OUT</Badge>
                  ) : !t.onSale ? (
                    <Badge>NOT YET ON SALE</Badge>
                  ) : null}
                </div>
                {t.description && (
                  <p
                    className="mt-1 max-w-md text-[12px] leading-5"
                    style={{ color: C.muted }}
                  >
                    {t.description}
                  </p>
                )}
                <p
                  className="mt-1.5 font-mono text-[11px]"
                  style={{ color: t.soldOut ? C.red : C.faint }}
                >
                  {t.soldOut
                    ? "No passes remaining"
                    : !t.onSale
                      ? t.salesStart
                        ? `Available from ${new Date(t.salesStart).toLocaleDateString(
                            "en-GB",
                            { day: "numeric", month: "short", year: "numeric" }
                          )}`
                        : "Sales closed"
                      : `${t.remaining} passes remaining`}
                </p>
              </div>

              <div
                className="shrink-0 text-[15px] font-semibold tabular-nums"
                style={{ color: C.ink }}
              >
                {t.price > 0 ? money(t.price, t.currency) : "Free"}
              </div>

              <QtyStepper
                value={qty}
                disabled={disabled}
                max={Math.min(20, t.remaining || 1)}
                onChange={(next) => onQuantity(t._id, Math.max(0, next))}
              />
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-3 text-[12px]" style={{ color: C.red }}>
          {error}
        </p>
      )}

      {addons.length > 0 && (
        <>
          <h2 className="mt-8 text-[15px] font-semibold" style={{ color: C.ink }}>
            Add-ons
          </h2>
          <div
            className="mt-3 overflow-hidden rounded-xl border"
            style={{ borderColor: C.border }}
          >
            {addons.map((a, i) => {
              const qty = addonQty[a._id] || 0;
              return (
                <div
                  key={a._id}
                  className="flex items-center gap-4 px-5 py-3.5"
                  style={{
                    borderTop: i === 0 ? undefined : `1px solid ${C.borderSoft}`,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px]" style={{ color: C.ink }}>
                      {a.name}
                    </span>
                    {a.description && (
                      <span className="text-[13px]" style={{ color: C.muted }}>
                        {" "}
                        ({a.description})
                      </span>
                    )}
                  </div>
                  <span
                    className="shrink-0 text-[13px] font-medium tabular-nums"
                    style={{ color: C.ink }}
                  >
                    {a.price > 0 ? money(a.price, a.currency) : "Free"}
                  </span>
                  <QtyStepper
                    value={qty}
                    max={Math.min(20, a.remaining || 1)}
                      onChange={(next) => onAddon(a._id, Math.max(0, next))}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-8">
        {!promoOpen ? (
          <button
            type="button"
            onClick={onPromoOpen}
            className="text-[13px] underline underline-offset-4"
            style={{ color: C.body }}
          >
            Have a promo code?
          </button>
        ) : (
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: C.border }}
          >
            <div className="flex gap-2">
              <input
                value={promoCode}
                onChange={(e) => onPromoCode(e.target.value.toUpperCase())}
                placeholder="EARLYBIRD"
                className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-[13px] outline-none placeholder:text-[#b6b7c2] focus:border-[#15151a]"
                style={{ borderColor: C.border, color: C.ink }}
              />
              <button
                type="button"
                onClick={onApplyPromo}
                className="rounded-lg border px-5 py-2 text-[13px] font-medium"
                style={{ borderColor: C.ink, color: C.ink }}
              >
                Apply
              </button>
            </div>
            {appliedPromo && quote && quote.promoValid && (
              <p className="mt-2 text-[12px]" style={{ color: C.green }}>
                ✓ {appliedPromo} applied
              </p>
            )}
            {appliedPromo && quote && !quote.promoValid && (
              <p className="mt-2 text-[12px]" style={{ color: C.red }}>
                {quote.promoError || "That code is not valid for this event."}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ══ Step 2 ════════════════════════════════════════════════════════════════

function DetailsStep({
  form,
  seats,
  fieldsFor,
  accent,
  needsCountry,
  requireApproval,
  error,
  referralCode,
  onSignedIn,
  onSubmit,
  onAttendee,
  onNamePart,
  onAnswer,
  onCountryBlur,
}: {
  form: PublicEventPayload["form"];
  /** One card per seat, in cart order. The first seat is the buyer. */
  seats: Seat[];
  fieldsFor: (tierId: string) => PublicEventPayload["form"]["fields"];
  accent: string;
  needsCountry: boolean;
  requireApproval: boolean;
  error: string | null;
  /** From the share link; binds a fresh OTP signup to that affiliate. */
  referralCode?: string;
  onSignedIn: (u: { name: string; email: string; phone?: string }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onAttendee: (seat: number, patch: Partial<AttendeeInput>) => void;
  onNamePart: (seat: number, part: "first" | "last", value: string) => void;
  onAnswer: (seat: number, key: string, value: unknown) => void;
  onCountryBlur: () => void;
}) {
  return (
    <form id="attendee-form" onSubmit={onSubmit}>
      <h1 className="text-[22px] font-bold" style={{ color: C.ink }}>
        {form?.title || "Who's attending?"}
      </h1>
      {/* Offered, never required — a guest checkout still completes. */}
      <div className="mt-5">
        <CheckoutIdentity
          accent={accent}
          referralCode={referralCode}
          onSignedIn={onSignedIn}
        />
      </div>
      {form?.description && (
        <p className="mt-1.5 text-[13px]" style={{ color: C.muted }}>
          {form.description}
        </p>
      )}
      {seats.length > 1 && (
        <p className="mt-1.5 text-[13px]" style={{ color: C.muted }}>
          You&apos;re booking {seats.length} passes. Each attendee is scanned in
          separately, so each one needs their own details — change the ticket
          quantity to add or remove someone.
        </p>
      )}

      {seats.map((seat, i) => {
        const all = fieldsFor(seat.tierId);
        const consents = all.filter((f) => CONSENT_TYPES.includes(f.type));
        const fields = all.filter((f) => !CONSENT_TYPES.includes(f.type));
        return (
          <div
            key={`${seat.tierId}-${i}`}
            className="mt-6 rounded-xl border p-5"
            style={{ borderColor: C.border }}
          >
            <div className="mb-5 flex flex-wrap items-center gap-2.5">
              <span
                className="rounded px-2 py-1 text-[10px] font-semibold tracking-wide"
                style={{ background: "#f1f1f4", color: C.muted }}
              >
                ATTENDEE {i + 1}
              </span>
              <span
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: C.ink }}
              >
                {seat.tierName}
              </span>
              {i === 0 && seats.length > 1 && (
                <span className="text-[11px]" style={{ color: C.faint }}>
                  This is you — the order and receipt go here.
                </span>
              )}
            </div>

            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {fields.map((f) => (
                <div
                  key={f.key}
                  className={fieldSpansRow(f) ? "sm:col-span-2" : ""}
                >
                  <FormFieldInput
                    field={f}
                    accent={accent}
                    attendee={seat.attendee}
                    answers={seat.answers}
                    nameParts={seat.nameParts}
                    onAttendee={(patch) => onAttendee(i, patch)}
                    onNamePart={(part, value) => onNamePart(i, part, value)}
                    onAnswer={(v) => onAnswer(i, f.key, v)}
                    onCountryBlur={i === 0 ? onCountryBlur : () => {}}
                  />
                </div>
              ))}
            </div>

            {consents.length > 0 && (
              <div
                className="mt-5 space-y-3 border-t pt-5"
                style={{ borderColor: C.borderSoft }}
              >
                {consents.map((f) => (
                  <FormFieldInput
                    key={f.key}
                    field={f}
                    accent={accent}
                    attendee={seat.attendee}
                    answers={seat.answers}
                    nameParts={seat.nameParts}
                    onAttendee={(patch) => onAttendee(i, patch)}
                    onNamePart={(part, value) => onNamePart(i, part, value)}
                    onAnswer={(v) => onAnswer(i, f.key, v)}
                    onCountryBlur={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Billing country drives the tax on the quote, so it is asked for even
          when the organizer's form doesn't include a country field. */}
      {needsCountry && (
        <div
          className="mt-4 rounded-xl border p-5"
          style={{ borderColor: C.border }}
        >
          <h2 className="mb-4 text-[15px] font-semibold" style={{ color: C.ink }}>
            Buyer details
          </h2>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <div>
              <label
                className="mb-1.5 block text-[12px] font-medium"
                style={{ color: C.body }}
              >
                Billing country
              </label>
              <input
                value={seats[0]?.attendee.country || ""}
                onChange={(e) => onAttendee(0, { country: e.target.value })}
                onBlur={onCountryBlur}
                placeholder="India"
                className="w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none placeholder:text-[#b6b7c2] focus:border-[#15151a]"
                style={{ borderColor: C.border, color: C.ink }}
              />
              <p className="mt-1 text-[11px]" style={{ color: C.faint }}>
                Used to work out any tax on your order.
              </p>
            </div>
          </div>
        </div>
      )}

      {requireApproval && (
        <p
          className="mt-4 flex gap-2 rounded-xl border p-4 text-[12px] leading-5"
          style={{ borderColor: C.border, color: C.muted }}
        >
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This event requires organizer approval. You will be notified by email
          once your registration is reviewed.
        </p>
      )}

      {error && (
        <p className="mt-4 text-[13px]" style={{ color: C.red }}>
          {error}
        </p>
      )}
    </form>
  );
}

// ══ Step 3 ════════════════════════════════════════════════════════════════

function PaymentStep({
  accent,
  passes,
  seats,
  error,
  onBack,
}: {
  accent: string;
  /** One entry per pass type in the order, already formatted "Name × 2". */
  passes: string[];
  /** Every named attendee, so the buyer can check them before paying. */
  seats: Seat[];
  error: string | null;
  onBack: () => void;
}) {
  return (
    <section>
      <h1 className="text-[22px] font-bold" style={{ color: C.ink }}>
        Payment
      </h1>
      <p className="mt-1.5 text-[13px]" style={{ color: C.muted }}>
        Review your order, then pay securely through Garage Pay.
      </p>

      <div
        className="mt-6 rounded-xl border p-5"
        style={{ borderColor: C.border }}
      >
        <h2 className="text-[13px] font-semibold" style={{ color: C.ink }}>
          Your registration
        </h2>
        <dl className="mt-4 space-y-2.5 text-[13px]">
          <Detail label={passes.length > 1 ? "Tickets" : "Ticket"}>
            <span className="block whitespace-pre-line">{passes.join("\n")}</span>
          </Detail>
          <Detail label={seats.length > 1 ? "Attendees" : "Attendee"}>
            <span className="block whitespace-pre-line">
              {seats
                .map((s) => `${s.attendee.name} · ${s.attendee.email}`)
                .join("\n")}
            </span>
          </Detail>
          {seats[0]?.attendee.company && (
            <Detail label="Company">{seats[0].attendee.company}</Detail>
          )}
        </dl>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-1.5 text-[12px] underline underline-offset-4"
          style={{ color: C.body }}
        >
          <ArrowLeft className="h-3 w-3" />
          Edit details
        </button>
      </div>

      <div
        className="mt-4 rounded-xl border p-5"
        style={{ borderColor: C.border, background: "#fafafb" }}
      >
        <div className="flex items-start gap-3">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
            style={{ background: accent }}
          >
            <Lock className="h-4 w-4" style={{ color: "#141418" }} />
          </span>
          <div>
            <p className="text-[13px] font-medium" style={{ color: C.ink }}>
              Pay with Garage Pay
            </p>
            <p className="mt-1 text-[12px] leading-5" style={{ color: C.muted }}>
              Your invoice opens in a secure window where you can pay by wallet,
              card, UPI or netbanking. We&apos;ll bring you straight back here and
              confirm your ticket.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-[13px]" style={{ color: C.red }}>
          {error}
        </p>
      )}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt style={{ color: C.muted }}>{label}</dt>
      <dd className="text-right" style={{ color: C.ink }}>
        {children}
      </dd>
    </div>
  );
}

// ══ Order summary ═════════════════════════════════════════════════════════

function OrderSummary({
  event,
  lines,
  currency,
  subtotal,
  quote,
  quoting,
  promoCode,
  total,
  accent,
  footer,
}: {
  event: PublicEventPayload["event"];
  lines: Array<{ label: string; amount: number }>;
  currency: string;
  subtotal: number;
  quote: QuoteResult | null;
  quoting: boolean;
  promoCode: string;
  total: number;
  accent: string;
  footer: React.ReactNode;
}) {
  const where = eventLocation(event);
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: C.border, background: "#fbfbfc" }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: accent === "#FACC15" ? "#b08900" : accent }}
      >
        Order summary
      </p>
      <h2 className="mt-2 text-[15px] font-bold" style={{ color: C.ink }}>
        {event.name}
      </h2>
      <p className="mt-0.5 text-[12px]" style={{ color: C.muted }}>
        {eventDateRange(event)}
        {where ? ` • ${where}` : ""}
      </p>

      <div
        className="mt-5 space-y-2 border-t pt-4"
        style={{ borderColor: C.borderSoft }}
      >
        {lines.length === 0 && (
          <p className="text-[13px]" style={{ color: C.faint }}>
            No tickets selected yet.
          </p>
        )}
        {lines.map((l) => (
          <SummaryRow
            key={l.label}
            label={l.label}
            value={money(l.amount, currency)}
          />
        ))}
      </div>

      <div
        className="mt-4 space-y-2 border-t pt-4"
        style={{ borderColor: C.borderSoft }}
      >
        <SummaryRow label="Subtotal" value={money(subtotal, currency)} tone="muted" />
        {!!quote?.discount && (
          <SummaryRow
            label={promoCode ? `Promo discount (${promoCode})` : "Promo discount"}
            value={`−${money(quote.discount, currency)}`}
            tone="green"
          />
        )}
        {!!quote?.tax && (
          <SummaryRow
            label={`GST (${quote.taxRate}%)`}
            value={money(quote.tax, currency)}
            tone="muted"
          />
        )}
      </div>

      <div
        className="mt-4 flex items-baseline justify-between border-t pt-4"
        style={{ borderColor: C.borderSoft }}
      >
        <span className="text-[15px] font-bold" style={{ color: C.ink }}>
          Total
        </span>
        <span className="text-[22px] font-bold tabular-nums" style={{ color: C.ink }}>
          {quoting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : total > 0 ? (
            money(total, currency)
          ) : (
            "Free"
          )}
        </span>
      </div>

      <div className="mt-5">{footer}</div>

      <p
        className="mt-4 text-center text-[10px] leading-4"
        style={{ color: C.faint }}
      >
        By continuing, you agree to the event&apos;s terms and the Garage Pay refund
        policy. Refunds are handled by the organizer.
      </p>
    </div>
  );
}

// ══ Payment overlay + confirmation dialog ═════════════════════════════════

function PayOverlay({
  invoiceRef,
  onClose,
}: {
  invoiceRef: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black/70 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 sm:px-8">
        <span className="text-sm font-medium text-white">Complete payment</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          Cancel
        </button>
      </div>
      {/* The invoice page in embed mode: it suppresses its own post-payment
          redirect and posts `invoice:paid` to this window instead. */}
      <iframe
        src={`/invoice/${invoiceRef}?embed=1`}
        title="Payment"
        className="min-h-0 w-full flex-1 border-0 bg-[#0a0a0f]"
      />
    </div>
  );
}

function ConfirmingDialog({
  accent,
  reference,
}: {
  accent: string;
  reference?: string;
}) {
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/45 px-6">
      <div className="w-full max-w-xs rounded-2xl bg-white px-8 py-9 text-center shadow-2xl">
        <Loader2
          className="mx-auto h-9 w-9 animate-spin"
          style={{ color: accent }}
          strokeWidth={2}
        />
        <h3 className="mt-5 text-[15px] font-semibold" style={{ color: C.ink }}>
          Confirming your payment
        </h3>
        <p className="mt-1 text-[12px]" style={{ color: C.muted }}>
          Don&apos;t close this window
        </p>
        {reference && (
          <>
            <div
              className="my-5 border-t"
              style={{ borderColor: C.borderSoft }}
            />
            <p
              className="font-mono text-[10px] uppercase tracking-wider"
              style={{ color: C.faint }}
            >
              Order reference
            </p>
            <p
              className="mt-1 font-mono text-[13px] font-semibold"
              style={{ color: C.ink }}
            >
              {reference}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ══ Bits ══════════════════════════════════════════════════════════════════

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
      style={{ background: "#f1f1f4", color: C.muted }}
    >
      {children}
    </span>
  );
}

function QtyStepper({
  value,
  onChange,
  max,
  min = 0,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  max: number;
  /** 1 for the selected pass — an order always carries one of them. */
  min?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <StepButton
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        label="Decrease quantity"
      >
        <Minus className="h-3 w-3" />
      </StepButton>
      <span
        className="w-5 text-center text-[13px] tabular-nums"
        style={{ color: value > 0 ? C.ink : C.faint }}
      >
        {value}
      </span>
      <StepButton
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        label="Increase quantity"
      >
        <Plus className="h-3 w-3" />
      </StepButton>
    </div>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md border transition-colors disabled:opacity-35"
      style={{ borderColor: C.border, color: C.body }}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  accent,
  onClick,
  disabled,
  loading,
  type = "button",
  form,
}: {
  children: React.ReactNode;
  accent: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  form?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled || loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: accent, color: "#141418" }}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
