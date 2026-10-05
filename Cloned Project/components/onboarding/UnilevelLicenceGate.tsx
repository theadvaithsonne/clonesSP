"use client";

// Office-creation paywall.
//
// A Unilevel Plus licence is required to create an office. When the user
// doesn't hold one, this drawer covers the onboarding route and sells them
// whatever they're currently eligible for, paying INLINE — the buyer never
// leaves the page or opens a tab.
//
// The shell deliberately mirrors the webinar paywall at
// components/webinar/WebinarPreJoin.tsx ("invoice-payment" state): right-side
// slide-in, click-inert backdrop, <CheckoutPaymentStep> rendered directly.
// Every checkout surface in the app is meant to look the same, and that one is
// the reference.
//
// Pricing is NOT computed here. `resolveOffer` already encodes the rule that an
// in-window buyer pays the licence alone (first NetworkChain month included)
// while a past-window buyer must take the licence together with a subscription
// cycle — the backend refuses a licence-only purchase after the window with
// `409 combo_required`. Quoting our own number here would eventually disagree
// with what the invoice charges.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Check, AlertCircle, Building2 } from "lucide-react";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";
import {
  FreeMonthBanner,
  BundlePicker,
} from "@/components/dashboard/UnilevelPlusOfferPanel";
import {
  getUnilevelPlusProduct,
  resolveOffer,
  offerPrice,
  createComboInvoice,
  type UnilevelPlusProduct,
  type PlanOffer,
} from "@/lib/webinar/garage-store-plans";

type Stage = "loading" | "offer" | "paying" | "unlocked" | "error";

export default function UnilevelLicenceGate({
  userEmail,
  userName,
  onUnlocked,
}: {
  userEmail: string;
  userName?: string;
  /** Fired once a licence is confirmed, so the guard can drop the gate. */
  onUnlocked: () => void;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [product, setProduct] = useState<UnilevelPlusProduct | null>(null);
  const [offer, setOffer] = useState<PlanOffer>({ kind: "loading" });
  const [termMonths, setTermMonths] = useState(1);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await getUnilevelPlusProduct();
      setProduct(p);
      // Already licensed — nothing to sell. Covers the race where a user buys
      // in another tab, and the re-check after payment.
      if (p.purchased) {
        setStage("unlocked");
        onUnlocked();
        return;
      }
      // The gate isn't tied to a specific partner — it sells whatever the
      // catalog offers. Passing nothing here matched no group and every
      // unlicensed user saw "not available". Pick the first partner that
      // actually has sellable terms: the catalog also lists partners with a
      // productConfig but no active plans yet (GarageGo), which would render
      // an empty picker.
      const clientId = (p.comboTerms || []).find((g) => g.terms?.length > 0)
        ?.thirdPartyClientId;
      const o = clientId
        ? resolveOffer(p, clientId)
        : ({ kind: "unavailable", reason: "This plan isn't available right now." } as PlanOffer);
      setOffer(o);
      setStage(o.kind === "unavailable" ? "error" : "offer");
      if (o.kind === "unavailable") setErrorMsg(o.reason);
    } catch (e: any) {
      setErrorMsg(e?.message || "Couldn't load pricing");
      setStage("error");
    }
  }, [onUnlocked]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleBuy() {
    if (offer.kind !== "combo" && offer.kind !== "renew" && offer.kind !== "subscribe") {
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await createComboInvoice({
        thirdPartyClientId: offer.group.thirdPartyClientId,
        termMonths,
      });
      setInvoiceId(res.invoice._id);
      setStage("paying");
    } catch (e: any) {
      setErrorMsg(e?.message || "Couldn't start checkout");
    } finally {
      setBusy(false);
    }
  }

  // Re-verify with the server rather than trusting the payment callback: the
  // licence row is written by invoice fulfilment, not by the checkout widget,
  // so "payment succeeded" and "licence exists" are two different facts.
  async function handlePaid() {
    setStage("loading");
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const p = await getUnilevelPlusProduct();
        if (p.purchased) {
          setStage("unlocked");
          onUnlocked();
          return;
        }
      } catch {
        /* keep polling — a transient failure shouldn't strand a paid buyer */
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    // Paid but fulfilment hasn't landed. Never leave them on a spinner.
    setErrorMsg(
      "Payment received. Your licence is still activating — refresh in a moment."
    );
    setStage("error");
  }

  const price = offer.kind === "loading" || offer.kind === "unavailable"
    ? null
    : offerPrice(offer, termMonths);

  return (
    <div className="fixed inset-0 z-[9999] flex" role="dialog" aria-modal="true">
      {/* Backdrop is click-inert, matching the webinar drawer: someone who
          bails mid-payment must not land on an office form they cannot
          submit. The "Back to dashboard" link below is the deliberate exit. */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" />

      <div className="relative ml-auto flex h-full w-full flex-col border-l border-[#2a2a35] bg-[#0b0b0d] shadow-2xl animate-in slide-in-from-right duration-300 sm:max-w-md">
        {/* Header */}
        <div className="shrink-0 border-b border-[#2a2a35] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10">
              {stage === "unlocked" ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Lock className="h-4 w-4 text-brand" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-white">
                {stage === "unlocked"
                  ? "You're all set"
                  : "Activate to create your office"}
              </h2>
              <p className="mt-0.5 text-[12px] text-[#9fa0b8]">
                {stage === "unlocked"
                  ? "Your licence is active. Continuing…"
                  : "A Unilevel Plus licence is required before you can launch an office."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {stage === "loading" && (
            <div className="flex flex-col items-center gap-3 py-20">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
              <p className="text-[13px] text-[#9fa0b8]">One moment…</p>
            </div>
          )}

          {stage === "unlocked" && (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                <Check className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="text-[13px] text-[#9fa0b8]">
                Licence active — taking you to office setup.
              </p>
            </div>
          )}

          {stage === "error" && (
            <div className="px-5 py-8">
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-[13px] text-amber-200">{errorMsg}</p>
              </div>
              <button
                onClick={load}
                className="mt-4 w-full rounded-xl border border-[#2a2a35] bg-[#12121a] py-2.5 text-[13px] text-white transition hover:border-[#3a3a45]"
              >
                Try again
              </button>
            </div>
          )}

          {stage === "offer" && (
            <div className="px-5 py-5">
              {/* What the licence is for, in office terms — the buyer arrived
                  here trying to create an office, not to shop for a licence. */}
              <div className="rounded-xl border border-[#2a2a35] bg-[#12121a] p-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-brand" />
                  <span className="text-[13px] font-semibold text-white">
                    What this unlocks
                  </span>
                </div>
                <ul className="mt-2.5 space-y-1.5 text-[12px] text-[#9fa0b8]">
                  <li>• Create and run your own office</li>
                  <li>• Multi-level affiliate commissions on referrals</li>
                  <li>• Your own storefront and payout wallet</li>
                </ul>
              </div>

              {offer.kind === "combo" && offer.freeFirstMonth && (
                <FreeMonthBanner
                  clientName={offer.group.clientName}
                  secondsRemaining={
                    product?.freeMonthWindow?.secondsRemaining ?? 0
                  }
                  onExpire={load}
                />
              )}

              {/* Past the window the licence cannot be bought alone — the
                  backend returns 409 combo_required — so the picker is the
                  only honest way to show what it now costs. */}
              {offer.kind === "combo" && !offer.freeFirstMonth && (
                <BundlePicker
                  group={offer.group}
                  licenceUsd={offer.licenceUsd}
                  selectedTermMonths={termMonths}
                  onSelect={setTermMonths}
                  onBuy={handleBuy}
                  busy={busy}
                />
              )}

              {offer.kind === "combo" && offer.freeFirstMonth && (
                <button
                  onClick={handleBuy}
                  disabled={busy}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-[14px] font-semibold text-brand-foreground transition hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Activate — ${price ?? offer.licenceUsd}</>
                  )}
                </button>
              )}

              {errorMsg && (
                <p className="mt-3 text-[12px] text-rose-400">{errorMsg}</p>
              )}
            </div>
          )}

          {stage === "paying" && invoiceId && (
            <CheckoutPaymentStep
              invoiceId={invoiceId}
              organizationName="Unilevel Plus"
              userEmail={userEmail}
              userName={userName}
              onSuccess={handlePaid}
            />
          )}
        </div>

        {/* The one way out. The webinar drawer has none by design, but a buyer
            who lands here by accident would otherwise be stuck on a route with
            nothing behind it. */}
        {stage !== "unlocked" && (
          <div className="shrink-0 border-t border-[#2a2a35] px-5 py-3">
            <button
              onClick={() => router.push("/workspace")}
              className="w-full text-[12px] text-[#6b6b80] transition hover:text-[#9fa0b8]"
            >
              Back to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
