"use client";

// Public save-card page — opened by a user who received an
// admin-generated add-card link. NO auth. The token in the URL IS the
// auth: it's a short-lived JWT scoped to `save_card_admin_link` and
// bound to a specific SetupIntent minted by the admin.
//
// Flow:
//   1. Exchange token → clientSecret + publishableKey + recipient info
//   2. Render Stripe Elements bound to the SetupIntent
//   3. User enters card + confirms RBI mandate (bundled server-side)
//   4. On success, existing `setup_intent.succeeded` webhook persists
//      the PaymentMethod to User.paymentProfile.stripe.methods[] — no
//      further client action needed.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { API_URL } from "@/lib/api";

const stripePromiseCache = new Map<string, Promise<Stripe | null>>();
function getStripePromise(publishableKey: string) {
  let p = stripePromiseCache.get(publishableKey);
  if (!p) {
    p = loadStripe(publishableKey);
    stripePromiseCache.set(publishableKey, p);
  }
  return p;
}

interface ExchangeResponse {
  clientSecret: string;
  setupIntentId: string;
  publishableKey: string;
  recipient: { userId: string; email: string | null; name: string | null };
}

type Status =
  | { kind: "loading" }
  | { kind: "ready"; data: ExchangeResponse }
  | { kind: "expired" }
  | { kind: "invalid"; message: string }
  | { kind: "saved" };

export default function AdminSaveCardPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/public/save-card/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 410) {
          setStatus({ kind: "expired" });
          return;
        }
        if (!res.ok || !body?.success) {
          setStatus({
            kind: "invalid",
            message: body?.error || "This link is not valid.",
          });
          return;
        }
        setStatus({ kind: "ready", data: body as ExchangeResponse });
      } catch (e: any) {
        if (cancelled) return;
        setStatus({
          kind: "invalid",
          message: e?.message || "Failed to load link.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-[#08080b] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">Save your card</h1>
          <p className="mt-1 text-sm text-[#9fa0b8]">
            A Garage admin has invited you to save a card securely.
          </p>
        </div>

        <div className="rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-6 shadow-2xl">
          {status.kind === "loading" && (
            <div className="flex items-center justify-center py-10 text-[#9fa0b8]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Preparing secure form…
            </div>
          )}

          {status.kind === "expired" && (
            <div className="py-6 text-center">
              <p className="text-base font-semibold text-white">
                This link has expired
              </p>
              <p className="mt-2 text-sm text-[#9fa0b8]">
                Ask your Garage admin to generate a fresh add-card link.
                Links are valid for 24 hours.
              </p>
            </div>
          )}

          {status.kind === "invalid" && (
            <div className="py-6 text-center">
              <p className="text-base font-semibold text-white">
                Link not valid
              </p>
              <p className="mt-2 text-sm text-[#9fa0b8]">{status.message}</p>
            </div>
          )}

          {status.kind === "saved" && (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <p className="mt-3 text-base font-semibold text-white">
                Card saved
              </p>
              <p className="mt-2 text-sm text-[#9fa0b8]">
                Your card is now on file with Garage. You can close this
                window.
              </p>
            </div>
          )}

          {status.kind === "ready" && (
            <>
              {status.data.recipient.email && (
                <p className="mb-4 text-xs text-[#9fa0b8]">
                  Saving to{" "}
                  <span className="font-medium text-white">
                    {status.data.recipient.name ||
                      status.data.recipient.email}
                  </span>
                </p>
              )}
              <Elements
                stripe={getStripePromise(status.data.publishableKey)}
                options={{
                  clientSecret: status.data.clientSecret,
                  appearance: {
                    theme: "night",
                    variables: {
                      colorPrimary: "#FBD10D",
                      colorBackground: "#15151b",
                      colorText: "#FFFFFF",
                      colorDanger: "#ef4444",
                      fontFamily: "system-ui, sans-serif",
                      borderRadius: "8px",
                    },
                  },
                }}
              >
                <SetupIntentForm
                  onSaved={() => setStatus({ kind: "saved" })}
                />
              </Elements>
            </>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 px-1 text-xs text-[#6a6a7a]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Your card details go directly to Stripe&apos;s PCI-DSS vault —
            Garage never sees or stores the card number. You won&apos;t be
            charged now; the card is saved for future invoices.
          </p>
        </div>
      </div>
    </div>
  );
}

function SetupIntentForm({ onSaved }: { onSaved: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    if (result.error) {
      setError(result.error.message || "Failed to save card");
      setSubmitting(false);
      return;
    }
    onSaved();
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3">
        <PaymentElement onReady={() => setReady(true)} />
      </div>
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || !elements || !ready || submitting}
        className="flex h-11 w-full items-center justify-center rounded-md bg-brand font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Save card"
        )}
      </button>
    </form>
  );
}
