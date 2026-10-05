"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { CryptoPaymentPanel } from "./CryptoPaymentPanel";
import { InvoicePreview, InvoiceData } from "./InvoicePreview";
import { PlatformCouponInput, PlatformProductType, couponProductTypeForItem } from "@/components/ui/platform-coupon-input";
import { getToken } from "@/lib/auth";
import {
  formatRazorpayContact,
  getRazorpayContactForCurrentUser,
} from "@/lib/razorpayPrefill";
import { CheckCircle2, Tag } from "lucide-react";

// ============ Types ============

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id?: string;
  name: string;
  description: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
  prefill?: { name?: string; email?: string; contact?: string };
  // ─── Save-card additions (phase 2) ─────────────────────────────────
  // Provided by BE `selectPaymentMethod` when save/reuse was requested.
  //   customer_id       → scopes Standard Checkout to this Razorpay
  //                       Customer. Popup pre-shows their saved cards.
  //   save              → 1 to tokenize the paid card at Razorpay
  //                       (`token.confirmed` webhook persists).
  //   remember_customer → ticks "Save my details" toggle by default.
  //   token             → id of a specific saved card to pre-select.
  customer_id?: string;
  save?: 0 | 1;
  remember_customer?: boolean;
  token?: string;
  // ─── UPI Autopay (mandate registration) ────────────────────────────
  // Razorpay requires this on any order carrying a `token` block. Paired
  // with `customer_id`; both come from the BE mandate branch.
  recurring?: 0 | 1;
}

interface RazorpayClass {
  new (options: RazorpayOptions): { open: () => void };
}

interface CheckoutPaymentStepProps {
  invoiceId: string;
  organizationName: string;
  userEmail: string;
  userName?: string;
  // Optional phone for Razorpay `prefill.contact`. Skips the "Enter mobile
  // number" popup step shown in the SDK by default. Accepts either bare
  // digits (defaults to +91) or international `+{country}{digits}` form.
  userPhone?: string;
  isSubscription?: boolean;
  country?: string;
  onSuccess: (data: {
    invoiceNumber: string;
    paymentId?: string;
    token?: string;
    orgId?: string;
  }) => void;
  onCancel?: () => void;
  onBack?: () => void;
  /**
   * The invoice document above the methods. Off for hosts that already show
   * the order beside the payment step, like the in-app event checkout.
   */
  showInvoicePreview?: boolean;
}

// ============ Component ============

export function CheckoutPaymentStep({
  invoiceId,
  organizationName,
  userEmail,
  userName,
  userPhone,
  isSubscription = false,
  country,
  onSuccess,
  onCancel,
  onBack,
  showInvoicePreview = true,
}: CheckoutPaymentStepProps) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [upiAutopayNotice, setUpiAutopayNotice] = useState<{
    firstAmount: number;
    renewalAmount: number | null;
    currency: string;
    renewalEvery: string;
    differsFromRenewal: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // True when the user has been sent to NowPayments and we're awaiting an IPN.
  // While set: poll invoice status, and require strong confirmation to cancel.
  const [cryptoPending, setCryptoPending] = useState(false);
  // In-house crypto payment request. Set by handlePaymentInitiated when
  // the BE returns { cryptoRequest }; drives the inline <CryptoPaymentPanel/>
  // render. Undefined = we're not in the in-house crypto flow (either not
  // paying with crypto, or legacy NOWPayments still in-flight).
  const [cryptoRequest, setCryptoRequest] = useState<{
    address: string;
    amount: string;
    coin: string;
    chain: string;
    chainName: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  // Detect crypto-pending state on initial load (handles page refresh case
  // where the user had already been sent to NowPayments before reload).
  useEffect(() => {
    if (!invoice) return;
    const meta = (invoice as unknown as { metadata?: Record<string, unknown>; paymentMethodCategory?: string }).metadata;
    const category = (invoice as unknown as { paymentMethodCategory?: string }).paymentMethodCategory;
    const isCryptoPending =
      invoice.status === "pending" &&
      category === "crypto" &&
      !!meta?.nowpaymentsInvoiceId;
    if (isCryptoPending) setCryptoPending(true);
  }, [invoice]);

  // Poll the invoice while a crypto payment is in flight. Adaptive backoff:
  // tighter early (the IPN usually arrives within a minute or two), looser
  // later. Auto-finalises if the invoice flips to "paid" — this catches both
  // the normal IPN-arrives case and the manual-reconciliation case.
  useEffect(() => {
    if (!cryptoPending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await fetch(`${API_URL}/api/invoices/${invoiceId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.invoice?.status === "paid") {
          setCryptoPending(false);
          setCryptoRequest(null);
          toast.success("Crypto payment confirmed!");
          onSuccess({ invoiceNumber: data.invoice.invoiceNumber });
          return;
        }
        if (
          data.success &&
          ["failed", "expired", "refunded", "cancelled"].includes(
            data.invoice?.status
          )
        ) {
          setCryptoPending(false);
          setCryptoRequest(null);
          setError(`Invoice is now ${data.invoice.status}.`);
          return;
        }
      } catch {
        // Transient — keep polling.
      }
      // < 30 attempts (~5 min @ 10s): 10s
      // < 80 attempts (~ 30 min total @ 30s): 30s
      // beyond that: 60s — webhook is unlikely to arrive late, but keep checking.
      const delay = attempts < 30 ? 10_000 : attempts < 80 ? 30_000 : 60_000;
      timer = setTimeout(tick, delay);
    };

    // First poll a few seconds out so we don't double-hit the API.
    timer = setTimeout(tick, 5_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [cryptoPending, invoiceId, onSuccess]);

  // Refresh / tab-close guard while a crypto payment is in flight.
  //
  // Losing this page mid-payment is unusually bad on crypto: the buyer
  // may have already sent funds on-chain, but they've lost the QR /
  // address they just sent to, so verifying the send-to-here address
  // matches the actual transfer becomes guesswork. The deposit is
  // still detectable via the reconciler (backend catches it whether
  // or not this tab is open), but the buyer's confidence drops
  // through the floor when the page they just paid on disappears.
  //
  // Modern browsers ignore custom text on `beforeunload` (they show a
  // generic "Leave site? Changes may not be saved" prompt) — but the
  // prompt itself is what matters, not the wording. Setting
  // returnValue on the event is what triggers it. Only armed while
  // cryptoPending is true, so the page can be closed freely before /
  // after payment.
  useEffect(() => {
    if (!cryptoPending) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy Chrome / Safari require returnValue to be assigned a
      // non-empty string. Modern Firefox / Edge only need
      // preventDefault. Doing both covers everything.
      e.returnValue =
        "A crypto payment is in progress. Leaving now may make it harder to confirm your transaction.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [cryptoPending]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/api/invoices/${invoiceId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch invoice");
      setInvoice(data.invoice);
      // Server-computed UPI autopay disclosure (null when paying this invoice
      // wouldn't establish a mandate). Rendered verbatim — the FE never
      // computes renewal prices of its own.
      setUpiAutopayNotice(data.upiAutopayNotice ?? null);
    } catch (err: any) {
      setError(err.message || "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpaySdk = async (): Promise<void> => {
    const windowWithRazorpay = window as { Razorpay?: unknown };
    if (windowWithRazorpay.Razorpay) return;

    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }

    await new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        if (windowWithRazorpay.Razorpay) resolve();
        else if (attempts >= 50) reject(new Error("Razorpay SDK timeout"));
        else { attempts++; setTimeout(check, 100); }
      };
      check();
    });
  };

  const handlePaymentInitiated = async (data: {
    razorpayOrderId?: string;
    razorpayKeyId?: string;
    // Save-card additions (phase 2) — see BE `selectPaymentMethod`.
    razorpayCustomerId?: string;
    razorpayPreferredTokenId?: string;
    razorpaySave?: boolean;
    /** BE minted a UPI Autopay mandate order — needs `recurring: 1`. */
    upiAutopay?: boolean;
    cryptoPaymentUrl?: string; // Legacy NOWPayments flow
    cryptoRequest?: {
      // In-house crypto flow
      requestId: string;
      chain: string;
      coin: string;
      chainName: string;
      address: string;
      amount: string;
      amountAtomic: string;
      decimals: number;
      expiresAt: string;
      contractAddress: string;
    };
    walletPaid?: boolean;
    stripePaid?: boolean;
    alreadyPaid?: boolean;
    amount: number;
    currency: string;
    invoiceId: string;
  }) => {
    // Wallet / Stripe / zero-amount coupon finalize — already complete server-side, skip gateway
    if (data.walletPaid || data.stripePaid || data.alreadyPaid) {
      toast.success("Payment complete!");
      onSuccess({
        invoiceNumber: invoice?.invoiceNumber || "",
      });
      return;
    }

    // Crypto payment — in-house flow.
    // BE returns { cryptoRequest } with address + amount + expiresAt.
    // We stash it in state and render <CryptoPaymentPanel/> inline
    // (no more redirect to a hosted page). The existing invoice-status
    // polling loop (see useEffect above gated on cryptoPending) is what
    // detects the poller-driven flip to paid → onSuccess.
    if (data.cryptoRequest) {
      setCryptoRequest({
        address: data.cryptoRequest.address,
        amount: data.cryptoRequest.amount,
        coin: data.cryptoRequest.coin,
        chain: data.cryptoRequest.chain,
        chainName: data.cryptoRequest.chainName,
        expiresAt: data.cryptoRequest.expiresAt,
      });
      setCryptoPending(true);
      return;
    }

    // Legacy NOWPayments flow — kept so any in-flight payment created
    // before deploy still resolves. Remove once /webhooks/nowpayments
    // traffic hits zero (~7 days after deploy).
    if (data.cryptoPaymentUrl) {
      window.open(data.cryptoPaymentUrl, "_blank");
      setCryptoPending(true);
      toast.info(
        "Complete your crypto payment in the new tab. This page will update automatically once confirmed."
      );
      return;
    }

    // Every checkout — new OR legacy razorpay-subscription-tagged — pays
    // via one-time Razorpay Order. The BE was updated to skip its own
    // subscription early-return so we always land here with
    // { razorpayOrderId, razorpayKeyId } for the current cycle's amount.
    if (data.razorpayOrderId && data.razorpayKeyId) {
      try {
        await loadRazorpaySdk();
        const RazorpayClass = (window as any).Razorpay as RazorpayClass;

        const rzp = new RazorpayClass({
          key: data.razorpayKeyId,
          amount: data.amount,
          currency: data.currency,
          order_id: data.razorpayOrderId,
          name: organizationName || "Payment",
          description: invoice?.lineItems[0]?.itemName || "Purchase",
          handler: async (response) => {
            await handlePaymentVerification(response);
          },
          modal: {
            ondismiss: () => {
              toast.info("Payment cancelled");
            },
          },
          theme: { color: "var(--brand)" },
          // ─── Save-card wiring (phase 2) ───────────────────────────
          // BE returns these when either the founder ticked
          // "Save for future" on a fresh card OR they picked a saved
          // token in the picker. Standard Checkout treats them as:
          //   customer_id       → scope saved cards to this Razorpay
          //                       Customer (unlocks the "Saved" tab)
          //   save              → tokenize this payment for reuse
          //   remember_customer → default-on the "save" toggle
          //   token             → pre-select this specific saved card
          ...(data.razorpayCustomerId
            ? { customer_id: data.razorpayCustomerId }
            : {}),
          //   recurring        → REQUIRED by Razorpay Standard Checkout for an
          //                      order carrying a `token` block (UPI Autopay
          //                      mandate registration). Without it checkout
          //                      rejects the order or silently drops the
          //                      mandate, so the buyer pays and autopay is
          //                      never established. `upiAutopay` is set by the
          //                      backend's mandate branch and only there, so
          //                      this can never attach to a plain payment.
          ...(data.upiAutopay ? { recurring: 1 as const } : {}),
          ...(data.razorpaySave ? { save: 1 as const } : {}),
          ...(data.razorpaySave ? { remember_customer: true } : {}),
          ...(data.razorpayPreferredTokenId
            ? { token: data.razorpayPreferredTokenId }
            : {}),
          // `contact` prefill removes the "Enter mobile" popup step shown
          // in the screenshot. Sourced from (in priority order):
          //   1. Caller-supplied `userPhone` prop (guest invoice-pay
          //      threads it from /verify-otp response).
          //   2. Fallback for authenticated users: lazy-fetch from
          //      /profile via the shared helper (cached per session).
          // If neither yields a phone, Razorpay's popup falls back to the
          // existing "Enter mobile" step.
          prefill: {
            name: userName,
            email: userEmail,
            contact:
              formatRazorpayContact(userPhone) ||
              (await getRazorpayContactForCurrentUser()),
          },
        });

        rzp.open();
        return;
      } catch (err: any) {
        setError(err.message || "Failed to open payment gateway");
        toast.error(err.message || "Failed to open payment gateway");
        return;
      }
    }

    // No branch matched — the BE returned a shape we don't know how to
    // handle. Fail LOUDLY instead of silently returning.
    const msg =
      "Payment could not be started. This checkout is missing gateway details — please contact support.";
    setError(msg);
    toast.error(msg);
    console.error(
      "[CheckoutPaymentStep] handlePaymentInitiated: no branch matched. Response:",
      data,
    );
  };

  const handlePaymentVerification = async (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    setVerifying(true);
    try {
      const res = await fetch(`${API_URL}/api/invoices/${invoiceId}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Payment verification failed");

      toast.success("Payment successful!");
      onSuccess({
        invoiceNumber: data.invoice.invoiceNumber,
        paymentId: response.razorpay_payment_id,
      });
    } catch (err: any) {
      setError(err.message || "Payment verification failed");
      toast.error(err.message || "Payment verification failed");
    } finally {
      setVerifying(false);
    }
  };

  // Dialog state for the destructive-cancel confirmation (used only when
  // a crypto payment may be in flight). Avoids window.confirm so we control
  // the styling and copy.
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const performCancel = async (force: boolean) => {
    try {
      const url = `${API_URL}/api/invoices/${invoiceId}/cancel${force ? "?force=true" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          data.error ||
            "Cannot cancel — possible in-flight crypto payment. Wait a few minutes or contact support."
        );
        return;
      }
    } catch {
      // Network error — fall through to onCancel so the user isn't stuck.
    }
    setCryptoPending(false);
    onCancel?.();
  };

  const handleCancel = () => {
    if (cryptoPending) {
      setCancelDialogOpen(true);
      return;
    }
    void performCancel(false);
  };

  // Loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-10 h-10 rounded-full border-2 border-[#2a2a35] border-t-brand animate-spin" />
        <p className="mt-3 text-sm text-[#6b6b80]">Loading invoice...</p>
      </div>
    );
  }

  // Error with no invoice
  if (error && !invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20 mb-3">
          <AlertCircle className="h-6 w-6 text-red-400" />
        </div>
        <p className="text-sm text-red-400 mb-4">{error}</p>
        <Button
          variant="outline"
          onClick={fetchInvoice}
          className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white"
        >
          Try Again
        </Button>
      </div>
    );
  }

  // Verifying
  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#2a2a35] border-t-emerald-400 animate-spin" />
          <CheckCircle className="w-5 h-5 text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="mt-3 text-sm text-white font-medium">Verifying payment...</p>
        <p className="mt-1 text-xs text-[#6b6b80]">Please do not close this page</p>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="space-y-5">
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-[#6b6b80] hover:text-[#9fa0b8] transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
      )}

      {/* Invoice Preview */}
      {showInvoicePreview && <InvoicePreview invoice={invoice} />}

      {/* Coupon input + auto-applied cashback badge (cashback is upline-configured
          and auto-attaches at invoice creation for whitelisted buyers — the buyer
          never enters a cashback code manually). */}
      {(() => {
        const primaryType = invoice.lineItems?.[0]?.itemType;
        // Map invoice itemType → coupon productType. `ecommerce_item` becomes
        // `ecommerce`; others are 1:1; unsupported types return undefined.
        const couponProductType = couponProductTypeForItem(primaryType);
        const isSupported = !!couponProductType;
        const alreadyHasCoupon = !!invoice.couponCode;
        const alreadyHasCashback = !!invoice.cashbackCodeId;
        const token = getToken();
        // Renewals accept coupons too. This used to require cycle 1, so a
        // subscriber staring at a due renewal saw no coupon input at all —
        // matching a BE guard that has been dropped alongside this. A coupon
        // redeemed here discounts this cycle only; a child that already
        // inherited a chain-level coupon is still excluded by
        // `alreadyHasCoupon` below.
        const canApply =
          isSupported &&
          !alreadyHasCoupon &&
          !alreadyHasCashback &&
          !!token &&
          // Match the API, which accepts draft OR pending. This used to be
          // draft-only, so the moment a buyer pressed Pay the invoice flipped
          // to `pending` and the coupon box vanished from the page — with no
          // way to get it back short of starting over. It also made the
          // server-side fix unreachable: the API now voids an unpaid Razorpay
          // order so a late coupon can still apply, but nothing could ever
          // trigger it while the input was hidden on exactly those invoices.
          ["draft", "pending"].includes(invoice.status);

        if (alreadyHasCoupon && invoice.discount > 0) {
          return (
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <div className="flex-1 text-xs text-emerald-400">
                Coupon{" "}
                <code className="font-mono font-semibold">
                  {invoice.couponCode}
                </code>{" "}
                applied
              </div>
            </div>
          );
        }

        if (alreadyHasCashback) {
          return (
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="flex-1 text-xs text-amber-400">
                Cashback applied — credit lands in your store wallet after
                purchase.
              </div>
            </div>
          );
        }

        if (!canApply) return null;

        return (
          <div className="rounded-xl bg-[#0e0e12] border border-[#2a2a35] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-3.5 w-3.5 text-brand" />
              <span className="text-xs font-medium text-white">
                Have a coupon?
              </span>
            </div>
            <PlatformCouponInput
              productType={couponProductType as PlatformProductType}
              amountCents={invoice.subtotal}
              invoiceCurrency={(invoice.itemCurrency as "USD" | "INR") || "USD"}
              authToken={token!}
              orgId={invoice.organizationId}
              itemId={invoice.lineItems[0]?.itemId}
              disabled={verifying}
              onApplied={async (applied) => {
                try {
                  const res = await fetch(
                    `${API_URL}/api/invoices/${invoiceId}/apply-platform-coupon`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ code: applied.code }),
                    }
                  );
                  const data = await res.json();
                  if (!res.ok || !data.success) {
                    // Throw, don't just toast — the coupon input keys its
                    // "applied" state off this promise. Returning quietly left
                    // it showing a discount the invoice never took.
                    throw new Error(data.error || "Failed to apply coupon");
                  }
                  toast.success("Coupon applied");
                  await fetchInvoice();
                } catch (e: any) {
                  toast.error(e?.message || "Failed to apply coupon");
                  throw e;
                }
              }}
            />
          </div>
        );
      })()}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Legacy NOWPayments fallback banner. Only when cryptoPending is
          set but we DON'T have an in-house cryptoRequest — i.e. the
          user is coming through the old hosted-page redirect flow.
          Remove once NOWPayments is fully decommissioned. */}
      {cryptoPending && !cryptoRequest && (
        <div className="flex items-start gap-3 p-3 bg-brand-2/10 border border-brand-2/30 rounded-xl">
          <Loader2 className="h-4 w-4 text-brand-2 shrink-0 mt-0.5 animate-spin" />
          <div className="text-sm">
            <p className="text-brand-2 font-medium">
              Waiting for crypto confirmation…
            </p>
            <p className="text-[11px] text-[#9fa0b8] mt-0.5">
              Once your payment lands on the blockchain we&apos;ll update this
              page automatically. This can take up to 30 minutes depending on
              network congestion. You can close this tab — you&apos;ll see the
              activated license in your account when it arrives.
            </p>
          </div>
        </div>
      )}

      {/* Payment method selection + free-invoice confirm button. Once
          crypto is pending (buyer picked a chain/coin and the BE minted
          a deposit address), we visually blur + freeze this block so
          the buyer can't accidentally start a second payment or change
          the chain mid-wait. The QR panel below stays fully interactive.
          Layout was previously QR-on-top / selector-below, which on
          mobile hid the selector under the fold — buyers didn't realize
          the QR belonged to the chain they picked. Now: selector on
          top, QR below. */}
      <div
        className={
          cryptoPending && cryptoRequest
            ? "relative pointer-events-none select-none opacity-40 blur-[1.5px] transition-all"
            : ""
        }
        aria-hidden={cryptoPending && cryptoRequest ? true : undefined}
      >
      {invoice.totalAmount === 0 ? (
        <Button
          onClick={async () => {
            setVerifying(true);
            try {
              const token = getToken();
              const headers: Record<string, string> = {
                "Content-Type": "application/json",
              };
              if (token) headers.Authorization = `Bearer ${token}`;
              const res = await fetch(
                `${API_URL}/api/invoices/${invoiceId}/select-payment`,
                {
                  method: "POST",
                  headers,
                  body: JSON.stringify({
                    paymentCurrency: invoice.itemCurrency,
                    // Stub method — backend short-circuits on totalAmount===0
                    // before it ever validates these.
                    paymentMethodCategory: "card",
                    paymentPlatform: "razorpay",
                  }),
                }
              );
              const data = await res.json();
              if (!data.success) {
                throw new Error(data.error || "Failed to confirm");
              }
              await handlePaymentInitiated({
                alreadyPaid: !!data.alreadyPaid,
                amount: 0,
                currency: invoice.itemCurrency,
                invoiceId,
              });
            } catch (err: any) {
              setError(err.message || "Failed to confirm");
              toast.error(err.message || "Failed to confirm");
            } finally {
              setVerifying(false);
            }
          }}
          disabled={verifying}
          className="w-full h-14 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-bold text-base rounded-xl shadow-lg shadow-brand/10 transition-all"
        >
          Confirm — Activate{isSubscription ? " subscription" : ""}
        </Button>
      ) : (
        /* Payment Method Selector — for non-zero invoices */
        <PaymentMethodSelector
          invoiceId={invoiceId}
          itemCurrency={invoice.itemCurrency}
          totalAmount={invoice.totalAmount}
          country={country}
          customerEmail={userEmail}
          // The disclosure AND its eligibility both come from the server, which
          // applies exactly the same test as the mandate-registration branch.
          // Deliberately not derived from `invoice.isRecurring` here: the combo
          // cart is typed one_time yet does register a mandate, so a local
          // guess would show no warning on the highest-volume path we have.
          upiAutopayNotice={upiAutopayNotice}
          // Force the crypto-only chooser when the backend marks the
          // invoice as crypto-channel (HiFi USDC/USDT investment
          // applications). Other paymentChannel values fall through to
          // the default multi-channel behavior.
          paymentChannel={
            ((invoice as unknown as { metadata?: { paymentChannel?: string } })
              .metadata?.paymentChannel === "crypto"
              ? "crypto"
              : "any") as "crypto" | "any"
          }
          // Wallet-currency lock: HiFi + cryptobrand-office invoices
          // set `metadata.allowedWalletCurrencies` on the BE. When
          // present, the FE hides fiat tabs the invoice can't accept
          // and short-circuits step 1 when only one currency is left,
          // so the buyer isn't asked to pick between USD/INR when the
          // seller already locked the invoice to one of them.
          walletCurrencyLock={
            (invoice as unknown as {
              metadata?: { allowedWalletCurrencies?: string[] };
            }).metadata?.allowedWalletCurrencies || undefined
          }
          onPaymentInitiated={handlePaymentInitiated}
          onError={(err) => {
            setError(err);
            toast.error(err);
          }}
          disabled={verifying || (cryptoPending && !!cryptoRequest)}
        />
      )}
      </div>

      {/* In-house crypto flow: full inline payment panel (QR + address +
          amount + timer + wrong-network warning). Renders when the BE
          returned a cryptoRequest.
          POSITION: intentionally BELOW the payment-method selector.
          Prior layout put the QR above the selector, which meant a
          mobile user opening the payment link had to guess that the
          QR they saw at the top belonged to whichever chain they were
          about to tap below. Confusing enough that some paid to the
          wrong chain. New order — selector first (choose chain →
          confirm), then the QR panel appears below with an obvious
          "scan or copy this" flow. The selector above is greyed out
          while this panel is active so a buyer can't accidentally
          start a second payment or switch chains mid-scan. */}
      {cryptoPending && cryptoRequest && (
        <div className="p-4 bg-[#0e0e12] border border-brand/30 rounded-2xl ring-1 ring-brand/20 shadow-lg shadow-brand/5">
          <CryptoPaymentPanel
            address={cryptoRequest.address}
            amount={cryptoRequest.amount}
            coin={cryptoRequest.coin}
            chain={cryptoRequest.chain}
            chainName={cryptoRequest.chainName}
            expiresAt={cryptoRequest.expiresAt}
            onRegenerate={async () => {
              // "Get new address" — re-hit /select-payment with the
              // SAME chain/coin. Server-side idempotency in
              // createHdDerivedRequest reuses a still-fresh pending
              // row and mints a new address only after the previous
              // one truly expired (addressExpiresAt < now). Native
              // coins get a fresh USD-quote at re-mint (ETH/POL/BTC
              // FX moves); stablecoin invoices get a fresh amount-
              // tail so the poller can tell the new attempt apart
              // from the old one.
              try {
                const token = getToken();
                const headers: Record<string, string> = {
                  "Content-Type": "application/json",
                };
                if (token) headers.Authorization = `Bearer ${token}`;
                const res = await fetch(
                  `${API_URL}/api/invoices/${invoiceId}/select-payment`,
                  {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                      paymentCurrency: invoice.itemCurrency,
                      paymentMethodCategory: "crypto",
                      paymentPlatform: "crypto_wallet",
                      chain: cryptoRequest.chain,
                      coin: cryptoRequest.coin,
                    }),
                  },
                );
                const data = await res.json();
                if (!data.success) {
                  throw new Error(data.error || "Failed to refresh address");
                }
                if (data.cryptoRequest) {
                  setCryptoRequest({
                    address: data.cryptoRequest.address,
                    amount: data.cryptoRequest.amount,
                    coin: data.cryptoRequest.coin,
                    chain: data.cryptoRequest.chain,
                    chainName: data.cryptoRequest.chainName,
                    expiresAt: data.cryptoRequest.expiresAt,
                  });
                  toast.success("New deposit address ready");
                }
              } catch (err: any) {
                toast.error(err?.message || "Failed to refresh address");
              }
            }}
          />
        </div>
      )}

      {/* Cancel */}
      {onCancel && (
        <div className="text-center">
          <button
            onClick={handleCancel}
            className="text-xs text-[#6b6b80] hover:text-[#9fa0b8] transition-colors"
          >
            Cancel payment
          </button>
        </div>
      )}

      {/* Crypto cancel confirmation — themed dialog instead of window.confirm.
          Only opens when cryptoPending is true. */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="bg-[#111116] border-[#2a2a35] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-brand-2" />
              Cancel crypto payment?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#9fa0b8]">
              If you have <span className="text-brand-2 font-semibold">already sent crypto</span>,
              do not cancel — your payment may still confirm shortly. Cancelling
              now will not refund crypto already sent on the blockchain.
              <br />
              <br />
              Continue only if you have <span className="text-white font-medium">not sent</span> any
              crypto yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1a22] border-[#2a2a35] text-white hover:bg-[#15151b]">
              Keep waiting
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setCancelDialogOpen(false);
                void performCancel(true);
              }}
              className="bg-red-500/90 text-white hover:bg-red-500 border-0"
            >
              Cancel anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
