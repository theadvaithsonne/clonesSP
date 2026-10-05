"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Loader2,
  CreditCard,
  Rss,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
  Tag,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createChannelOrder, verifyChannelPayment, getChannelSubscriptionStatus, Channel } from "@/lib/feed-api";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { PlatformCouponInput } from "@/components/ui/platform-coupon-input";
import { getToken } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { useGstQuote } from "@/lib/hooks/useGstQuote";
import { getRazorpayContactForCurrentUser } from "@/lib/razorpayPrefill";
import { sanitizeDescription } from "@/lib/sanitizeDescription";
import { getBrandHex } from "@/lib/brand-color-context";

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  modal: {
    ondismiss: () => void;
  };
  theme: {
    color: string;
  };
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  image?: string;
}

interface RazorpayClass {
  new (options: RazorpayOptions): {
    open: () => void;
  };
}

interface ChannelPaymentModalNewProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  orgId: string;
  userData: {
    name: string;
    email: string;
  };
  onSuccess: () => void;
}

export function ChannelPaymentModalNew({
  isOpen,
  onClose,
  channel,
  orgId,
  userData,
  onSuccess,
}: ChannelPaymentModalNewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [discountedTotalCents, setDiscountedTotalCents] = useState<number | null>(null);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<{ key?: string; currency?: string } | null>(null);
  const [pendingSubscription, setPendingSubscription] = useState<{
    shortUrl: string;
    subscriptionId: string;
  } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  // Buy-to-assign — founder buys N memberships as reserves that can be
  // assigned to specific downlines later via ReservesPanel. Only for
  // one-time (non-subscription) channels — subscription channels don't
  // have a reserve model. BE fulfillment at services/invoice.ts:2187
  // keys off `quantity > 1`.
  const [buyToAssign, setBuyToAssign] = useState(false);
  const [reserveQty, setReserveQty] = useState(1);
  const canReserve = !channel.isSubscription && (channel.price ?? 0) > 0;

  const finalPrice = channel.price ?? 0;
  // Preview GST that the BE will actually charge — see routes/channelCheckout.ts:501
  // and routes/feed.ts:1345 (subscription) for equivalent server-side math.
  // GST depends on the BUYER's country, which only the server can resolve —
  // this used to key off `gstInclusive === false` alone, so it both charged
  // foreign buyers and never surfaced the inclusive case.
  const { quote: gstQuote } = useGstQuote({
    itemType: "channel",
    itemId: channel._id,
    email: userData.email || undefined,
    subtotalMinor: Math.round(finalPrice * 100),
    enabled: finalPrice > 0,
  });
  // Only the "added on top" case changes what the buyer pays.
  const gstAddOnTop = !!gstQuote?.applies && !gstQuote.inclusive;
  const gstPreviewAmount = gstAddOnTop ? gstQuote!.tax / 100 : 0;
  const finalPriceWithGst = finalPrice + gstPreviewAmount;

  // Check subscription status
  const checkSubscriptionStatus = useCallback(async () => {
    if (!pendingSubscription) return;

    setCheckingStatus(true);
    try {
      const statusResponse = await getChannelSubscriptionStatus(channel._id, orgId);

      if (statusResponse.success && statusResponse.hasAccess) {
        toast.success(`Successfully subscribed to ${channel.title}!`);
        setPendingSubscription(null);
        onSuccess();
        onClose();
      } else if (statusResponse.subscription?.status === "active" || statusResponse.subscription?.status === "authenticated") {
        toast.success(`Successfully subscribed to ${channel.title}!`);
        setPendingSubscription(null);
        onSuccess();
        onClose();
      } else {
        toast.info("Payment not yet confirmed. Please complete the payment in the opened tab.");
      }
    } catch (err) {
      console.error("Error checking subscription status:", err);
      toast.error("Failed to check subscription status");
    } finally {
      setCheckingStatus(false);
    }
  }, [channel._id, channel.title, orgId, onSuccess, onClose, pendingSubscription]);

  // Auto-check status when window regains focus (user comes back from Razorpay tab)
  useEffect(() => {
    if (!pendingSubscription) return;

    const handleFocus = () => {
      checkSubscriptionStatus();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [pendingSubscription, checkSubscriptionStatus]);

  // Reset pending state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPendingSubscription(null);
      setInvoiceId(null);
      setShowPaymentSelector(false);
      setOrderData(null);
    }
  }, [isOpen]);

  // Body-scroll-lock while the slide-in is open. Matches the convention
  // used by CreateProductModal / TopUpStoreWalletSheet so background
  // pages don't double-scroll behind the panel.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Load Razorpay SDK
  const loadRazorpaySDK = async () => {
    const windowWithRazorpay = window as { Razorpay?: unknown };
    if (!windowWithRazorpay.Razorpay) {
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);
      }

      await new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;
        const checkRazorpay = () => {
          if (windowWithRazorpay.Razorpay) {
            resolve(true);
          } else if (attempts >= maxAttempts) {
            reject(new Error("Razorpay SDK loading timeout"));
          } else {
            attempts++;
            setTimeout(checkRazorpay, 100);
          }
        };
        checkRazorpay();
      });
    }
    return windowWithRazorpay;
  };

  // Handle subscription-based channel payment (recurring).
  //
  // Redirects the user to the public /checkout/channel/:id page, which
  // runs the Garage-owned recurring flow (`POST /checkout/channel/:id/process-checkout`)
  // — plain recurring invoice, no Razorpay Subscription, no
  // `razorpaySubscriptionId` stamped anywhere. Each cycle is paid one-time
  // via a Razorpay Order (or Stripe/UPI/wallet) at renewal time. This
  // replaces the legacy `createChannelSubscription` call that hit
  // `POST /feed/channels/:id/create-subscription` and always created a
  // Razorpay Subscription — that path is being retired.
  const handleSubscriptionPayment = () => {
    const url = `/checkout/channel/${channel._id}`;
    window.location.href = url;
  };

  // Handle one-time payment
  const handleOneTimePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create order using our backend. Passes qty + forReserve so the
      // BE mints N ItemReserveLicense rows instead of upserting one
      // ChannelMembership for the buyer.
      const orderResponse = await createChannelOrder(
        channel._id,
        orgId,
        buyToAssign
          ? { quantity: Math.max(1, reserveQty), forReserve: true }
          : undefined,
      );

      if (!orderResponse.success) {
        throw new Error("Failed to create order");
      }

      const { order } = orderResponse;

      // If backend returns an invoiceId, show payment method selector
      if (orderResponse.invoiceId) {
        setInvoiceId(orderResponse.invoiceId);
        setOrderData({ key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, currency: order.currency || channel.currency || "INR" });
        setShowPaymentSelector(true);
        setLoading(false);
        return;
      }

      // Load Razorpay SDK
      const windowWithRazorpay = await loadRazorpaySDK();

      if (!windowWithRazorpay.Razorpay) {
        throw new Error("Razorpay SDK failed to load");
      }

      // Get Razorpay key from env
      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        throw new Error("Razorpay key not configured");
      }

      // Initialize Razorpay checkout
      const options: RazorpayOptions = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Channel Subscription",
        description: `Subscribe to: ${channel.title}`,
        image: channel.coverImage,
        handler: async (response) => {
          try {
            // Verify payment with our backend
            const verifyResponse = await verifyChannelPayment(
              channel._id,
              orgId,
              {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }
            );

            if (verifyResponse.success) {
              toast.success(`Successfully subscribed to ${channel.title}!`);
              onSuccess();
              onClose();
            } else {
              setError("Payment verification failed");
              toast.error("Payment verification failed");
            }
          } catch (err) {
            console.error("Payment verification error:", err);
            setError("Payment verification failed");
            toast.error("Payment verification failed");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        theme: {
          color: getBrandHex(),
        },
        prefill: {
          name: userData.name,
          email: userData.email,
          contact: await getRazorpayContactForCurrentUser(),
        },
        notes: {
          channel_id: channel._id,
          org_id: orgId,
          channel_title: channel.title,
        },
      };

      const rzp = new (windowWithRazorpay.Razorpay as RazorpayClass)(options);
      rzp.open();
    } catch (err) {
      console.error("Payment failed:", err);
      setError(err instanceof Error ? err.message : "Payment failed");
      toast.error(err instanceof Error ? err.message : "Payment failed");
      setLoading(false);
    }
  };

  const resetModalState = () => {
    setInvoiceId(null);
    setShowPaymentSelector(false);
    setOrderData(null);
    setError(null);
    setDiscountedTotalCents(null);
    setAppliedCouponCode(null);
  };

  // Called by PaymentMethodSelector after user selects currency + method
  const handlePaymentInitiated = async (data: {
    razorpayOrderId?: string;
    razorpayKeyId?: string;
    razorpaySubscriptionId?: string;
    shortUrl?: string;
    cryptoPaymentUrl?: string;
    walletPaid?: boolean;
    stripePaid?: boolean;
    amount: number;
    currency: string;
    invoiceId: string;
  }) => {
    if (data.walletPaid || data.stripePaid) {
      toast.success("Payment successful!");
      resetModalState();
      onSuccess();
      onClose();
      return;
    }
    if (data.cryptoPaymentUrl) {
      window.open(data.cryptoPaymentUrl, "_blank");
      toast.info("Complete your crypto payment in the new tab. The invoice will update automatically once confirmed.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // If we got a short URL (e.g. for crypto), redirect
      if (data.shortUrl) {
        window.open(data.shortUrl, "_blank");
        setLoading(false);
        return;
      }

      // Open Razorpay with the details from select-payment
      const key = data.razorpayKeyId || orderData?.key;
      if (!key) throw new Error("Missing Razorpay key");

      const windowWithRazorpay = await loadRazorpaySDK();
      if (!windowWithRazorpay.Razorpay) throw new Error("Razorpay SDK failed to load");

      const razorpayKey = key;

      const options: RazorpayOptions = {
        key: razorpayKey,
        amount: data.amount,
        currency: data.currency,
        order_id: data.razorpayOrderId || "",
        name: "Channel Subscription",
        description: `Subscribe to: ${channel.title}`,
        image: channel.coverImage,
        handler: async (response) => {
          try {
            const verifyResponse = await verifyChannelPayment(
              channel._id,
              orgId,
              {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }
            );

            if (verifyResponse.success) {
              toast.success(`Successfully subscribed to ${channel.title}!`);
              resetModalState();
              onSuccess();
              onClose();
            } else {
              setError("Payment verification failed");
              toast.error("Payment verification failed");
            }
          } catch (err) {
            console.error("Payment verification error:", err);
            setError("Payment verification failed");
            toast.error("Payment verification failed");
          } finally {
            setLoading(false);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
        theme: { color: getBrandHex() },
        prefill: {
          name: userData.name,
          email: userData.email,
          contact: await getRazorpayContactForCurrentUser(),
        },
        notes: { channel_id: channel._id, org_id: orgId, channel_title: channel.title },
      };

      const rzp = new (windowWithRazorpay.Razorpay as RazorpayClass)(options);
      rzp.open();
    } catch (error) {
      console.error("Payment initiation failed:", error);
      setError(error instanceof Error ? error.message : "Payment initiation failed");
      toast.error(error instanceof Error ? error.message : "Payment initiation failed");
      setLoading(false);
    }
  };

  const handleSubscribeChannel = async () => {
    if (channel.isSubscription) {
      await handleSubscriptionPayment();
    } else {
      await handleOneTimePayment();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: channel.currency || "USD",
    }).format(value);
  };

  if (!isOpen) return null;

  // Two-step rendering: "form" shows the channel hero + benefits + Subscribe
  // CTA; "payment" replaces the lower body with PaymentMethodSelector inline.
  // The pending state (waiting for the legacy Razorpay tab) is a third
  // branch — only reached when the backend's invoice creation fell back to
  // the shortUrl path. The new GaragePay invoice flow skips it entirely.
  const inPaymentStep = !!(showPaymentSelector && invoiceId);
  const inPendingStep = !!pendingSubscription;

  const benefits = [
    "Full access to channel content",
    "Exclusive posts and updates",
    "Access to channel products",
    "Access to channel courses",
    "Access to channel workshops",
    ...(channel.isSubscription
      ? ["Recurring billing", "Cancel anytime"]
      : ["One-time payment, lifetime access"]),
  ];

  return (
    <div
      className="fixed inset-0 z-[1000] flex"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => {
          if (!loading && !checkingStatus) {
            resetModalState();
            onClose();
          }
        }}
      />

      {/* Slide-in side panel — same shell as TopUpStoreWalletSheet so the
          paid-channel checkout looks at home next to the rest of the
          GaragePay surfaces. */}
      <div
        className={cn(
          "relative ml-auto h-full w-full sm:max-w-md bg-[#0b0b0d] border-l border-[#2a2a35]",
          "shadow-2xl flex flex-col",
          "animate-in slide-in-from-right duration-300"
        )}
      >
        {/* Sticky header */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-[#2a2a35] bg-[#0e0e12]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-brand/10 border border-brand/30 shrink-0">
                <Rss className="w-4 h-4 text-brand" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">
                  {inPaymentStep
                    ? "Choose payment"
                    : inPendingStep
                    ? "Waiting for payment"
                    : channel.isSubscription
                    ? "Subscribe to channel"
                    : "Unlock channel"}
                </h2>
                <p className="text-xs text-[#9fa0b8] mt-0.5 truncate">
                  {channel.title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {inPaymentStep && (
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentSelector(false);
                    setInvoiceId(null);
                    setOrderData(null);
                    setDiscountedTotalCents(null);
                    setAppliedCouponCode(null);
                                  }}
                  disabled={loading}
                  className="p-1.5 rounded-md text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white transition-colors"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  resetModalState();
                  onClose();
                }}
                disabled={loading || checkingStatus}
                className="p-1.5 rounded-md text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Channel hero — image + price chip + description */}
          <div className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] overflow-hidden">
            {channel.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.coverImage}
                alt={channel.title}
                className="w-full h-32 object-cover"
              />
            )}
            <div className="p-3.5">
              <div className="flex items-start gap-2 mb-1.5">
                <h3 className="font-semibold text-white text-sm flex-1 min-w-0">
                  {channel.title}
                </h3>
                {channel.isSubscription && channel.subscriptionPeriod && (
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-full">
                    {channel.subscriptionPeriod}
                  </span>
                )}
              </div>
              {channel.description && (
                <p 
                  className="text-xs text-[#9fa0b8] leading-relaxed line-clamp-3 mb-2.5 [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_a]:text-brand [&_a]:hover:underline"
                  dangerouslySetInnerHTML={{ __html: sanitizeDescription(channel.description) }}
                />
              )}

              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-bold text-brand font-mono">
                  {formatCurrency(finalPriceWithGst)}
                </span>
                {channel.isSubscription && channel.subscriptionPeriod && (
                  <span className="text-xs text-[#9fa0b8]">
                    / {channel.subscriptionPeriod}
                  </span>
                )}
              </div>
              {gstAddOnTop && (
                <div className="mt-2 text-[11px] text-[#9fa0b8] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(finalPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (18%)</span>
                    <span>{formatCurrency(gstPreviewAmount)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* ── Pending state ── (only when backend fell back to legacy shortUrl) */}
          {inPendingStep && (
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span className="text-sm text-blue-300 font-medium">
                    Waiting for payment confirmation
                  </span>
                </div>
                <p className="text-xs text-[#9fa0b8]">
                  Complete the payment in the Razorpay tab. We&apos;ll check
                  the status automatically when you return.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={checkSubscriptionStatus}
                  disabled={checkingStatus}
                  className="flex-1 h-10 bg-brand hover:opacity-90 text-brand-foreground disabled:opacity-50"
                >
                  {checkingStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Checking…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh status
                    </>
                  )}
                </Button>
                <Button
                  onClick={() =>
                    window.open(pendingSubscription!.shortUrl, "_blank")
                  }
                  variant="outline"
                  className="h-10 border-[#2a2a35] text-white hover:bg-[#1a1a22]"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Reopen
                </Button>
              </div>
            </div>
          )}

          {/* ── Payment step — coupon input + PaymentMethodSelector inline ── */}
          {inPaymentStep && !inPendingStep && (
            <div className="space-y-3">
              {!appliedCouponCode ? (
                <div className="rounded-xl bg-[#0e0e12] border border-[#2a2a35] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-3.5 w-3.5 text-brand" />
                    <span className="text-xs font-medium text-white">
                      Have a coupon?
                    </span>
                  </div>
                  <PlatformCouponInput
                    productType="channel"
                    amountCents={finalPrice * 100}
                    itemId={channel._id}
                    invoiceCurrency={
                      (channel.currency as "USD" | "INR") || "USD"
                    }
                    authToken={getToken() || undefined}
                    disabled={loading}
                    onApplied={async (applied) => {
                      try {
                        const token = getToken();
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
                          // Throw so the coupon input rolls back instead of showing a
                          // discount the invoice never took.
                          throw new Error(data.error || "Failed to apply coupon");
                        }
                        toast.success("Coupon applied");
                        setAppliedCouponCode(
                          data.invoice.couponCode || applied.code
                        );
                        setDiscountedTotalCents(data.invoice.totalAmount);
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to apply coupon");
                        throw e;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 text-xs text-emerald-400">
                    Coupon{" "}
                    <code className="font-mono font-semibold">
                      {appliedCouponCode}
                    </code>{" "}
                    applied
                  </div>
                </div>
              )}

              <PaymentMethodSelector
                invoiceId={invoiceId!}
                itemCurrency={orderData?.currency || channel.currency || "INR"}
                totalAmount={discountedTotalCents ?? Math.round(finalPriceWithGst * 100)}
                onPaymentInitiated={handlePaymentInitiated}
                onError={(errMsg) => {
                  setError(errMsg);
                  toast.error(errMsg);
                }}
                disabled={loading}
              />
            </div>
          )}

          {/* ── Benefits — always visible ── */}
          <div className="rounded-xl border border-brand/20 bg-brand/[0.04] p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <h4 className="text-xs font-semibold text-brand uppercase tracking-wide">
                What you get
              </h4>
            </div>
            <ul className="space-y-1.5">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-xs text-[#c7c7da]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sticky footer — Subscribe CTA on the form step. Payment step has
            its own CTA inside PaymentMethodSelector, so no double-button.
            Trust + multi-gateway note replaces the old "Powered by Razorpay" text. */}
        {!inPaymentStep && !inPendingStep && (
          <div className="shrink-0 border-t border-[#2a2a35] bg-[#0e0e12] px-5 py-3 space-y-2">
            {/* Buy-to-assign toggle — reserves for one-time channels only.
                Mirrors ProductsPage:3760 shape. */}
            {canReserve && (
              <div className="rounded-xl border border-[#2a2a35] bg-[#1a1a22]/30 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white leading-none">Buy to assign</p>
                    <p className="text-[9px] text-[#8888a0] mt-1 leading-normal">Purchase seats as reserves to assign later.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBuyToAssign((v) => !v)}
                    className="relative shrink-0 rounded-full transition-colors duration-200 cursor-pointer"
                    style={{ width: "44px", height: "24px", backgroundColor: buyToAssign ? "var(--brand)" : "#2a2a35" }}
                    aria-pressed={buyToAssign}
                  >
                    <span
                      className="absolute rounded-full bg-white transition-transform duration-200"
                      style={{ top: "2px", left: "2px", width: "20px", height: "20px", transform: buyToAssign ? "translateX(20px)" : "translateX(0px)" }}
                    />
                  </button>
                </div>
                {buyToAssign && (
                  <div className="flex items-center justify-between border-t border-[#2a2a35]/30 pt-2">
                    <span className="text-[10px] font-bold text-[#8888a0] uppercase tracking-wider">Quantity</span>
                    <div className="flex items-center gap-2 bg-[#0e0e12] rounded-lg border border-[#2a2a35] p-1 select-none">
                      <button type="button" onClick={() => setReserveQty((q) => Math.max(1, q - 1))}
                        className="h-6 w-6 rounded flex items-center justify-center text-white hover:bg-[#1a1a22] transition-colors text-xs cursor-pointer font-bold">−</button>
                      <span className="w-8 text-center text-xs font-bold text-white tabular-nums">{reserveQty}</span>
                      <button type="button" onClick={() => setReserveQty((q) => Math.min(99, q + 1))}
                        className="h-6 w-6 rounded flex items-center justify-center text-white hover:bg-[#1a1a22] transition-colors text-xs cursor-pointer font-bold">+</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <Button
              onClick={handleSubscribeChannel}
              disabled={loading}
              className="w-full h-11 bg-brand hover:opacity-90 text-brand-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing…
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  {buyToAssign
                    ? `Buy ${reserveQty} to assign`
                    : channel.isSubscription && channel.subscriptionPeriod
                    ? `Subscribe for ${formatCurrency(finalPriceWithGst)} / ${channel.subscriptionPeriod}`
                    : channel.isSubscription
                    ? `Subscribe for ${formatCurrency(finalPriceWithGst)}`
                    : `Pay ${formatCurrency(finalPriceWithGst)}`}
                </>
              )}
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6b6b80]">
              <ShieldCheck className="w-3 h-3" />
              <span>
                Secure checkout · Razorpay · Stripe · UPI · Crypto · Wallet
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
