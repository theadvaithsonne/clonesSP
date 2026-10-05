"use client";

// Shared saved-cards panel — used inside the Vault page's "Payment
// Methods" tab AND on the standalone /settings/payment-methods page.
// Contains: Stripe card list (add via SetupIntent), Razorpay INR token
// list (add via ₹1 auth + auto-refund), set-default / remove, and the
// add-card dialog with Stripe Elements. All logic and layout was moved
// verbatim from the settings page so both surfaces share behavior.

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, Plus, ShieldCheck, Star, Trash2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createRazorpaySaveCardOrder,
  createStripeSetupIntent,
  deleteRazorpayToken,
  deleteStripePaymentMethod,
  listPaymentMethods,
  setRazorpayDefaultToken,
  setStripeDefaultPaymentMethod,
  type SavedRazorpayToken,
  type SavedStripeMethod,
} from "@/lib/payment-methods-api";
import { getBrandHex } from "@/lib/brand-color-context";

const stripePromiseCache = new Map<string, Promise<Stripe | null>>();
function getStripePromise(publishableKey: string) {
  let p = stripePromiseCache.get(publishableKey);
  if (!p) {
    p = loadStripe(publishableKey);
    stripePromiseCache.set(publishableKey, p);
  }
  return p;
}

async function loadRazorpaySdk(): Promise<void> {
  if (typeof window === "undefined") return;
  if ((window as any).Razorpay) return;
  const existing = document.querySelector(
    'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
  );
  if (existing) {
    await new Promise<void>((resolve) => {
      const check = () => {
        if ((window as any).Razorpay) resolve();
        else setTimeout(check, 100);
      };
      check();
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}

/**
 * `showHeader` toggles the "Payment Methods" title + subhead. Off inside
 * WalletPage (which has its own header + tab context); on when rendered
 * as a standalone page.
 */
export function PaymentMethodsPanel({
  showHeader = true,
}: {
  showHeader?: boolean;
}) {
  const [methods, setMethods] = useState<SavedStripeMethod[]>([]);
  const [tokens, setTokens] = useState<SavedRazorpayToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addingRazorpay, setAddingRazorpay] = useState(false);
  const [pendingSetup, setPendingSetup] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPaymentMethods();
      setMethods(res.stripe.methods || []);
      setTokens(res.razorpay?.tokens || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load cards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = async () => {
    setAddOpen(true);
    setPendingSetup(null);
    try {
      const res = await createStripeSetupIntent();
      setPendingSetup({
        clientSecret: res.clientSecret,
        publishableKey: res.publishableKey,
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to start card save");
      setAddOpen(false);
    }
  };

  const handleRemove = async (pmId: string, label: string) => {
    const prev = methods;
    setMethods((m) => m.filter((x) => x.id !== pmId));
    try {
      await deleteStripePaymentMethod(pmId);
      toast.success(`Removed ${label}`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove card");
      setMethods(prev);
    }
  };

  const handleSetDefault = async (pmId: string) => {
    const prev = methods;
    setMethods((m) => m.map((x) => ({ ...x, isDefault: x.id === pmId })));
    try {
      await setStripeDefaultPaymentMethod(pmId);
      toast.success("Default card updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update default");
      setMethods(prev);
    }
  };

  const handleAddRazorpayCard = async () => {
    setAddingRazorpay(true);
    try {
      const [order] = await Promise.all([
        createRazorpaySaveCardOrder(),
        loadRazorpaySdk(),
      ]);
      const RazorpayCtor = (window as any).Razorpay;
      if (!RazorpayCtor) throw new Error("Razorpay SDK failed to load");

      const rzp = new RazorpayCtor({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Garage",
        description: "Save card (₹1 authorization, auto-refunded)",
        customer_id: order.customerId,
        save: 1,
        remember_customer: true,
        theme: { color: getBrandHex() },
        handler: async () => {
          toast.success(
            "Card saved. The ₹1 authorization will be refunded automatically.",
          );
          await refreshWithRetry(load);
          setAddingRazorpay(false);
        },
        modal: {
          ondismiss: () => {
            toast.info("Card save cancelled");
            setAddingRazorpay(false);
          },
        },
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err?.message || "Failed to start card save");
      setAddingRazorpay(false);
    }
  };

  const handleRemoveRazorpay = async (tokenId: string, label: string) => {
    const prev = tokens;
    // Revoking a UPI mandate is not the same as deleting a card — it ends a
    // standing debit authority, so say so plainly and warn that renewals stop
    // being automatic. The backend keeps the row (marked revoked) for the
    // audit trail; `load()` re-reads the real state either way.
    const isUpi = prev.find((t) => t.id === tokenId)?.method === "upi";
    if (isUpi) {
      const ok = window.confirm(
        `Revoke autopay for ${label}?\n\nFuture renewals will no longer be charged automatically — you'll need to pay each invoice manually until you set up autopay again.`,
      );
      if (!ok) return;
    }
    setTokens((t) => t.filter((x) => x.id !== tokenId));
    try {
      await deleteRazorpayToken(tokenId);
      toast.success(isUpi ? `Autopay revoked for ${label}` : `Removed ${label}`);
      await load();
    } catch (err: any) {
      toast.error(
        err?.message || (isUpi ? "Failed to revoke autopay" : "Failed to remove card"),
      );
      setTokens(prev);
    }
  };

  const handleSetDefaultRazorpay = async (tokenId: string) => {
    const prev = tokens;
    setTokens((t) => t.map((x) => ({ ...x, isDefault: x.id === tokenId })));
    try {
      await setRazorpayDefaultToken(tokenId);
      toast.success("Default card updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update default");
      setTokens(prev);
    }
  };

  return (
    <div className="space-y-6">
      {showHeader && (
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-brand" />
            Payment Methods
          </h1>
          <p className="text-sm text-[#9fa0b8] mt-1">
            Cards you save here appear as one-click options on future
            invoices. Card details never touch our servers — they live in
            the payment processor&apos;s vault.
          </p>
        </div>
      )}

      {/* Stripe (USD) section */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Stripe — USD invoices
          </h2>
          <p className="text-xs text-[#6a6a7a] mt-0.5">
            Save once, one-click reuse on future USD invoices.
          </p>
        </div>
        <Button
          onClick={openAdd}
          size="sm"
          className="bg-brand hover:opacity-90 text-brand-foreground font-medium"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add card
        </Button>
      </div>

      <div className="rounded-2xl border border-[#2a2a35] bg-[#0e0e12] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-[#9fa0b8]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : methods.length === 0 ? (
          <div className="text-center py-14 px-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center mb-3">
              <CreditCard className="w-6 h-6 text-[#6a6a7a]" />
            </div>
            <p className="text-sm text-white font-medium">No saved cards yet</p>
            <p className="text-xs text-[#6a6a7a] mt-1">
              Save one at checkout, or click Add card above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1a1a22]">
            {methods.map((card) => {
              const label = `${prettyBrand(card.brand)} •••• ${card.last4}`;
              return (
                <div
                  key={card.id}
                  className="p-4 flex items-center gap-4 hover:bg-[#131318] transition-colors"
                >
                  <div className="p-2.5 rounded-lg bg-[#1a1a22]">
                    <CreditCard className="w-5 h-5 text-[#9fa0b8]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium tabular-nums flex items-center gap-2">
                      {label}
                      {card.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand bg-brand/10 border border-brand/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#6a6a7a] mt-0.5">
                      Expires{" "}
                      {String(card.expMonth || "?").padStart(2, "0")}/
                      {String(card.expYear || "?").slice(-2)}
                      {" · "}Added{" "}
                      {new Date(card.addedAt).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!card.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetDefault(card.id)}
                        className="h-8 px-2 text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                      >
                        Make default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(card.id, label)}
                      className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Razorpay (INR) section */}
      <div className="flex items-center justify-between gap-3 pt-4">
        <div>
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Razorpay — INR invoices
          </h2>
          <p className="text-xs text-[#6a6a7a] mt-0.5">
            Save an Indian-issued card for one-tap reuse on INR invoices.
            Add runs a ₹1 authorization that&apos;s auto-refunded within
            5–7 business days.
          </p>
        </div>
        <Button
          onClick={handleAddRazorpayCard}
          disabled={addingRazorpay}
          size="sm"
          className="bg-brand hover:opacity-90 text-brand-foreground font-medium"
        >
          {addingRazorpay ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Opening…
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add card
            </>
          )}
        </Button>
      </div>

      <div className="rounded-2xl border border-[#2a2a35] bg-[#0e0e12] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-[#9fa0b8]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-14 px-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center mb-3">
              <CreditCard className="w-6 h-6 text-[#6a6a7a]" />
            </div>
            <p className="text-sm text-white font-medium">
              No saved INR cards yet
            </p>
            <p className="text-xs text-[#6a6a7a] mt-1">
              Save one at your next INR checkout, or click Add card above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1a1a22]">
            {tokens.map((token) => {
              // A UPI mandate has no card number, brand or expiry — rendering
              // the card row for one produced "undefined •••• null". Show the
              // payer's VPA and the standing authority instead.
              const isUpi = token.method === "upi";
              const label = isUpi
                ? token.vpa || "UPI Autopay"
                : `${prettyBrand(token.network)} •••• ${token.last4}`;
              const mandateActive = token.mandateStatus === "active";
              return (
                <div
                  key={token.id}
                  className="p-4 flex items-center gap-4 hover:bg-[#131318] transition-colors"
                >
                  <div className="p-2.5 rounded-lg bg-[#1a1a22]">
                    {isUpi ? (
                      <Smartphone className="w-5 h-5 text-[#9fa0b8]" />
                    ) : (
                      <CreditCard className="w-5 h-5 text-[#9fa0b8]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium tabular-nums flex items-center gap-2">
                      {label}
                      {token.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand bg-brand/10 border border-brand/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Default
                        </span>
                      )}
                    </div>
                    {isUpi ? (
                      <div className="text-xs text-[#6a6a7a] mt-0.5">
                        {mandateActive ? (
                          <>
                            <span className="text-emerald-400 font-medium">
                              Autopay active
                            </span>
                            {token.maxAmount
                              ? ` · up to ₹${(token.maxAmount / 100).toLocaleString("en-IN")} per charge`
                              : ""}
                            {token.mandateExpiresAt
                              ? ` · until ${new Date(token.mandateExpiresAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                              : ""}
                          </>
                        ) : token.mandateStatus === "pending" ? (
                          <span className="text-amber-400 font-medium">
                            Awaiting approval in your UPI app
                          </span>
                        ) : (
                          <>
                            <span className="text-red-400 font-medium">
                              Autopay {token.mandateStatus || "inactive"}
                            </span>
                            {" · renewals will not be charged automatically"}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-[#6a6a7a] mt-0.5">
                        {token.issuer ? `${token.issuer} · ` : ""}Expires{" "}
                        {String(token.expMonth || "?").padStart(2, "0")}/
                        {String(token.expYear || "?").slice(-2)}
                        {" · "}Added{" "}
                        {new Date(token.addedAt).toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!token.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetDefaultRazorpay(token.id)}
                        className="h-8 px-2 text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                      >
                        Make default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveRazorpay(token.id, label)}
                      title={
                        isUpi
                          ? "Revoke this autopay mandate — future renewals will need manual payment"
                          : "Remove this card"
                      }
                      className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      {isUpi ? (
                        <span className="text-xs font-medium">Revoke</span>
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="flex items-start gap-2 text-xs text-[#6a6a7a] px-1">
        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 text-[#6a6a7a] shrink-0" />
        <p>
          Cards are stored inside the payment processor&apos;s PCI-DSS
          vault. We only keep a reference + last 4 digits so you can pick
          the right card at checkout. Remove any card here anytime.
        </p>
      </div>

      {/* Add-card modal */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false);
            setPendingSetup(null);
          }
        }}
      >
        <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Add a new card</DialogTitle>
            <DialogDescription className="text-[#9fa0b8]">
              You won&apos;t be charged. The card will be saved for future
              invoices, and you can remove it anytime.
            </DialogDescription>
          </DialogHeader>
          {pendingSetup ? (
            <Elements
              stripe={getStripePromise(pendingSetup.publishableKey)}
              options={{
                clientSecret: pendingSetup.clientSecret,
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
              <SetupIntentForm
                onSaved={async () => {
                  setAddOpen(false);
                  setPendingSetup(null);
                  await refreshWithRetry(load);
                  toast.success("Card saved");
                }}
              />
            </Elements>
          ) : (
            <div className="py-8 flex items-center justify-center text-[#9fa0b8]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Preparing…
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SetupIntentForm({ onSaved }: { onSaved: () => void | Promise<void> }) {
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
    await onSaved();
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
      <DialogFooter>
        <Button
          type="submit"
          disabled={!stripe || !elements || !ready || submitting}
          className="bg-brand hover:opacity-90 text-brand-foreground w-full h-11 font-semibold"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              Saving…
            </>
          ) : (
            "Save card"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function prettyBrand(b: string | null) {
  if (!b) return "Card";
  return b.charAt(0).toUpperCase() + b.slice(1);
}

async function refreshWithRetry(load: () => Promise<void>) {
  for (let i = 0; i < 3; i++) {
    await load();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _wait = await new Promise((r) => setTimeout(r, 800));
  }
}
