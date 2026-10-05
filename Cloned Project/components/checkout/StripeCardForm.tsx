"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrandHex } from "@/lib/brand-color-context";
import { Country } from "country-state-city";

export interface BillingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

interface StripeCardFormProps {
  clientSecret: string;
  publishableKey: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  customerName?: string;
  customerAddress?: BillingAddress;
  onPaid: (paymentIntentId: string) => void | Promise<void>;
  onError?: (message: string) => void;
  /**
   * Saved-card 3DS-only mode. Set when the parent has already created a
   * PaymentIntent server-side with a customer + payment_method attached
   * (e.g. an INR saved-card reuse where BE returned `requires_action`).
   * In this mode we skip the billing-details form entirely and skip
   * PaymentElement — there's nothing for the user to fill. We just fire
   * `stripe.confirmCardPayment(clientSecret)` on mount, which uses the
   * attached PM and pops the 3DS/OTP challenge. Then bubbles success
   * via onPaid the same way the fresh-card path does.
   */
  saved3DSOnly?: boolean;
}

const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

function getStripePromise(publishableKey: string) {
  let p = stripePromiseCache.get(publishableKey);
  if (!p) {
    p = loadStripe(publishableKey);
    stripePromiseCache.set(publishableKey, p);
  }
  return p;
}

// Convert whatever the User profile stores ("India", "in", "IN") to an ISO-2
// country code that Stripe accepts. Returns "" if no match.
function toIsoCountry(input?: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const match = Country.getAllCountries().find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  return match?.isoCode || "";
}

export default function StripeCardForm({
  clientSecret,
  publishableKey,
  amount,
  currency,
  customerEmail,
  customerName,
  customerAddress,
  onPaid,
  onError,
  saved3DSOnly = false,
}: StripeCardFormProps) {
  const stripePromise = useMemo(
    () => getStripePromise(publishableKey),
    [publishableKey]
  );

  // Saved-card 3DS branch: no Elements/billing form needed — the PI
  // already has customer + payment_method attached server-side. All we
  // do is fire confirmCardPayment(clientSecret) which triggers the
  // Stripe-hosted 3DS/OTP flow and resolves with the result.
  if (saved3DSOnly) {
    return (
      <SavedCard3DSConfirm
        stripePromise={stripePromise}
        clientSecret={clientSecret}
        amount={amount}
        currency={currency}
        onPaid={onPaid}
        onError={onError}
      />
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: getBrandHex(),
            colorBackground: "#15151b",
            colorText: "#FFFFFF",
            colorDanger: "#ef4444",
            fontFamily: "system-ui, sans-serif",
            borderRadius: "8px",
          },
        },
      }}
    >
      <InnerForm
        amount={amount}
        currency={currency}
        customerEmail={customerEmail}
        customerName={customerName}
        customerAddress={customerAddress}
        onPaid={onPaid}
        onError={onError}
      />
    </Elements>
  );
}

/**
 * Zero-form 3DS challenge for a PI that already has a payment_method
 * attached (saved-card reuse path). Auto-fires on mount, shows a
 * calm loader + "Confirm with your bank" copy while Stripe's 3DS
 * iframe/redirect runs. On success calls onPaid; on error surfaces
 * inline with a Try Again button so the founder isn't stranded.
 */
function SavedCard3DSConfirm({
  stripePromise,
  clientSecret,
  amount,
  currency,
  onPaid,
  onError,
}: {
  stripePromise: Promise<Stripe | null>;
  clientSecret: string;
  amount: number;
  currency: string;
  onPaid: (paymentIntentId: string) => void | Promise<void>;
  onError?: (message: string) => void;
}) {
  const [status, setStatus] = useState<
    "loading" | "confirming" | "succeeded" | "error"
  >("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formatAmount = () => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
      }).format((amount || 0) / 100);
    } catch {
      return `${currency} ${((amount || 0) / 100).toFixed(2)}`;
    }
  };

  const runConfirm = async () => {
    setStatus("confirming");
    setErrorMsg(null);

    const stripe = await stripePromise;
    if (!stripe) {
      setErrorMsg("Stripe failed to load. Please refresh and try again.");
      setStatus("error");
      onError?.("Stripe SDK failed to load");
      return;
    }

    // Race against a 5-min timeout — mirrors the fresh-card flow's
    // policy. Real OTP flows are 15-60s; anything longer probably means
    // a stuck iframe or browser-extension interference.
    const CONFIRM_TIMEOUT_MS = 300_000;
    const TIMEOUT_SENTINEL = Symbol("stripe_confirm_timeout");

    // confirmCardPayment (classic API) uses the payment_method already
    // attached to the PI — no need to pass PM or elements. If the PI
    // is in requires_action, Stripe pops the 3DS challenge and
    // resolves once the bank confirms.
    const confirmPromise = stripe.confirmCardPayment(clientSecret);
    const timeoutPromise = new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
      setTimeout(() => resolve(TIMEOUT_SENTINEL), CONFIRM_TIMEOUT_MS);
    });

    const raced = await Promise.race([confirmPromise, timeoutPromise]);

    if (raced === TIMEOUT_SENTINEL) {
      // Same policy as the fresh-card timeout: don't error out, don't
      // fire onError (would trigger toast + retry loop = double
      // charge risk). Show calm "still processing" and let the
      // invoice-status polling / webhook finalize.
      setErrorMsg(
        "Payment is still processing with your bank. Please DON'T close this page or retry — you'll get a confirmation email once it settles (usually under a minute).",
      );
      setStatus("error");
      return;
    }

    const { error, paymentIntent } = raced;

    if (error) {
      const msg = error.message || "Payment failed";
      setErrorMsg(msg);
      setStatus("error");
      onError?.(msg);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      setStatus("succeeded");
      try {
        await onPaid(paymentIntent.id);
      } catch {
        // onPaid throwing shouldn't undo the success state — the money
        // moved. Parent handles the post-fulfill navigation.
      }
      return;
    }

    // Any other terminal-but-not-succeeded status (canceled, etc.)
    setErrorMsg(
      `Payment is ${paymentIntent?.status || "in an unexpected state"}. Please try again.`,
    );
    setStatus("error");
  };

  useEffect(() => {
    runConfirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSecret]);

  return (
    <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-6 space-y-4 text-center">
      {status === "loading" || status === "confirming" ? (
        <>
          <div className="mx-auto w-10 h-10 rounded-full border-2 border-[#2a2a35] border-t-brand animate-spin" />
          <div>
            <p className="text-sm font-medium text-white">
              Confirming {formatAmount()} with your bank…
            </p>
            <p className="text-xs text-[#6b6b80] mt-1.5">
              You may be asked for an OTP. Don&apos;t close this page.
            </p>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6b6b80]">
            <ShieldCheck className="h-3 w-3" />
            Secured by Stripe
          </div>
        </>
      ) : status === "succeeded" ? (
        <p className="text-sm font-medium text-emerald-400">
          Payment confirmed ✓
        </p>
      ) : (
        <>
          <p className="text-sm text-red-300">{errorMsg || "Payment failed."}</p>
          <Button
            type="button"
            onClick={runConfirm}
            className="bg-brand hover:bg-brand-2 text-brand-foreground"
          >
            Try again
          </Button>
        </>
      )}
    </div>
  );
}

function InnerForm({
  amount,
  currency,
  customerEmail,
  customerName,
  customerAddress,
  onPaid,
  onError,
}: Omit<StripeCardFormProps, "clientSecret" | "publishableKey">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Custom billing fields, mirroring ProfilePopover's pattern.
  const [billing, setBilling] = useState({
    name: customerName || "",
    line1: customerAddress?.line1 || "",
    line2: customerAddress?.line2 || "",
    city: customerAddress?.city || "",
    state: customerAddress?.state || "",
    postal_code: customerAddress?.postal_code || "",
    country: customerAddress?.country || "",
  });

  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);

  const allCountries = useMemo(
    () => Country.getAllCountries().map((c) => c.name).sort(),
    []
  );

  const filteredCountrySuggestions = useMemo(() => {
    if (!billing.country.trim()) return allCountries;
    const q = billing.country.toLowerCase();
    return allCountries.filter((name) => name.toLowerCase().includes(q));
  }, [billing.country, allCountries]);

  useEffect(() => {
    setErrorMsg(null);
  }, [amount, currency]);

  const formatAmount = () => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
      }).format((amount || 0) / 100);
    } catch {
      return `$${((amount || 0) / 100).toFixed(2)}`;
    }
  };

  const isComplete =
    !!billing.name.trim() &&
    !!billing.line1.trim() &&
    !!billing.city.trim() &&
    !!billing.state.trim() &&
    !!billing.postal_code.trim() &&
    !!toIsoCountry(billing.country);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    if (!isComplete) {
      setErrorMsg("Please fill in all billing fields.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const isoCountry = toIsoCountry(billing.country);

    // Race confirmPayment against a 3-minute safety timeout. The old 45s
    // cap was fine for USD Stripe (no 3DS in the common path) but trips
    // routinely on INR / Indian-issuer flows where RBI-mandated OTP
    // legitimately eats 45-80s (bank SMS latency + user reading +
    // Stripe's own bank round-trip). When the timeout fires we DO NOT
    // claim failure — the real confirmPayment call is still in flight on
    // Stripe's side, and killing it just to show an error causes double-
    // charges if the founder hits Pay again. Instead we hand the flow
    // over to the invoice-status polling on the parent page (webhook
    // finalises within seconds after Stripe returns success), and show a
    // "still processing" message so the founder waits rather than
    // retrying. Real browser-extension hangs are much slower than any
    // legit flow — 180s is well above the OTP-heavy p99 (~90s) and still
    // catches genuinely stuck iframes.
    const CONFIRM_TIMEOUT_MS = 300_000;
    const TIMEOUT_SENTINEL = Symbol("stripe_confirm_timeout");

    const confirmPromise = stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        receipt_email: customerEmail,
        payment_method_data: {
          billing_details: {
            name: billing.name.trim(),
            email: customerEmail,
            address: {
              line1: billing.line1.trim(),
              line2: billing.line2.trim() || undefined,
              city: billing.city.trim(),
              state: billing.state.trim(),
              postal_code: billing.postal_code.trim(),
              country: isoCountry,
            },
          },
        },
      },
    });

    const timeoutPromise = new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
      setTimeout(() => resolve(TIMEOUT_SENTINEL), CONFIRM_TIMEOUT_MS);
    });

    const raced = (await Promise.race([confirmPromise, timeoutPromise])) as
      | typeof TIMEOUT_SENTINEL
      | Awaited<typeof confirmPromise>;

    if (raced === TIMEOUT_SENTINEL) {
      // Don't call onError — that surfaces as a red toast + likely
      // triggers a retry. Instead, show an inline "still processing"
      // message and let the parent page's invoice polling / webhook
      // resolve the outcome. Reset the submitting state so the pay
      // button doesn't stay stuck, but keep it visually calm.
      setErrorMsg(
        "Payment is still processing with your bank. Please DON'T close this page or retry — you'll get a confirmation email once it settles (usually under a minute).",
      );
      setSubmitting(false);
      return;
    }

    const { error, paymentIntent } = raced;

    if (error) {
      const msg = error.message || "Payment failed";
      setErrorMsg(msg);
      onError?.(msg);
      setSubmitting(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      try {
        await onPaid(paymentIntent.id);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(false);
    setErrorMsg(
      `Payment is ${paymentIntent?.status || "processing"}. You will receive a confirmation shortly.`
    );
  };

  const inputClass =
    "h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200";
  const labelClass = "text-sm font-medium text-[#c7c7da]";

  // Amex-on-USD is blocked by Stripe India until we register an IEC
  // (Import Export Code). Visa/MC route via presentment-currency
  // conversion so they work; Amex settles as a true cross-border USD
  // transaction and returns "A valid Importer/Exporter Code (IEC) is
  // needed to present in USD." Surface a warning up-front so founders
  // don't hit the confusing Stripe popup mid-flow.
  const isUsd = (currency || "").toLowerCase() === "usd";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isUsd && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          <span className="font-semibold">Heads up:</span> Amex cards are not
          supported for USD payments yet — please use Visa or Mastercard.
          Amex support is coming soon.
        </div>
      )}
      {/* Billing details — required by Stripe-India for non-INR (export) cards.
          Collected on our side so we control the UX, then passed to Stripe via
          confirmParams.payment_method_data.billing_details. */}
      <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-4 space-y-4">
        <div className="text-[11px] uppercase tracking-wider text-[#9fa0b8]">
          Billing details
        </div>

        <div className="space-y-2">
          <Label htmlFor="stripe-name" className={labelClass}>
            Full name
          </Label>
          <Input
            id="stripe-name"
            value={billing.name}
            onChange={(e) => setBilling((p) => ({ ...p, name: e.target.value }))}
            className={inputClass}
            placeholder="Name as on card"
            autoComplete="cc-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stripe-line1" className={labelClass}>
            Address line 1
          </Label>
          <Input
            id="stripe-line1"
            value={billing.line1}
            onChange={(e) =>
              setBilling((p) => ({ ...p, line1: e.target.value }))
            }
            className={inputClass}
            placeholder="Street address"
            autoComplete="address-line1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stripe-line2" className={labelClass}>
            Address line 2{" "}
            <span className="text-[10px] text-[#6a6a7a]">(optional)</span>
          </Label>
          <Input
            id="stripe-line2"
            value={billing.line2}
            onChange={(e) =>
              setBilling((p) => ({ ...p, line2: e.target.value }))
            }
            className={inputClass}
            placeholder="Apt, suite, etc."
            autoComplete="address-line2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 relative">
            <Label htmlFor="stripe-country" className={labelClass}>
              Country
            </Label>
            <Input
              id="stripe-country"
              value={billing.country}
              onChange={(e) => {
                setBilling((p) => ({ ...p, country: e.target.value }));
                setShowCountrySuggestions(true);
              }}
              onFocus={() => setShowCountrySuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowCountrySuggestions(false), 150)
              }
              className={inputClass}
              placeholder="Type to search..."
              autoComplete="country-name"
            />
            {showCountrySuggestions && filteredCountrySuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 max-h-48 bg-[#1a1a22] border border-[#2a2a35] rounded-lg shadow-lg z-50 overflow-y-auto">
                {filteredCountrySuggestions.slice(0, 50).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setBilling((p) => ({ ...p, country: name }));
                      setShowCountrySuggestions(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-[#2a2a35] transition-colors",
                      billing.country === name
                        ? "text-brand-2 bg-[#2a2a35]/50"
                        : "text-[#c7c7da]"
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="stripe-postal" className={labelClass}>
              Postal code
            </Label>
            <Input
              id="stripe-postal"
              value={billing.postal_code}
              onChange={(e) =>
                setBilling((p) => ({ ...p, postal_code: e.target.value }))
              }
              className={inputClass}
              placeholder="ZIP / Postal code"
              autoComplete="postal-code"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="stripe-city" className={labelClass}>
              City
            </Label>
            <Input
              id="stripe-city"
              value={billing.city}
              onChange={(e) =>
                setBilling((p) => ({ ...p, city: e.target.value }))
              }
              className={inputClass}
              placeholder="City"
              autoComplete="address-level2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stripe-state" className={labelClass}>
              State
            </Label>
            <Input
              id="stripe-state"
              value={billing.state}
              onChange={(e) =>
                setBilling((p) => ({ ...p, state: e.target.value }))
              }
              className={inputClass}
              placeholder="State / Province"
              autoComplete="address-level1"
            />
          </div>
        </div>
      </div>

      {/* Card row — Stripe-managed (PCI scope stays at Stripe) */}
      <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3">
        <PaymentElement
          onReady={() => setReady(true)}
          options={{
            layout: "tabs",
            // Granular opt-out: name, email, and address come from our custom
            // inputs above (passed via confirmParams.payment_method_data.billing_details).
            // Phone is intentionally left unset — Stripe's "auto" handles it
            // (won't render a phone input for plain card payments). Using the
            // STRING form "never" would require us to also pass phone and would
            // throw "did not pass confirmParams...billing_details.phone".
            fields: {
              billingDetails: {
                name: "never",
                email: "never",
                address: "never",
              },
            },
          }}
        />
      </div>

      {errorMsg && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || !elements || !ready || submitting || !isComplete}
        className="w-full bg-gradient-to-r from-brand to-brand-2 text-brand-foreground font-semibold hover:opacity-95 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing…
          </>
        ) : (
          <>Pay {formatAmount()}</>
        )}
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
        <ShieldCheck className="h-3 w-3" />
        Secured by Stripe
      </div>
    </form>
  );
}
