"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Mail,
  Shield,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { safeRedirectPath, safeAbsoluteRedirectUrl } from "@/lib/safe-redirect";
import {
  saveToken,
  saveOrgId,
  getToken,
  getUserIdFromToken,
  clearToken,
} from "@/lib/auth";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";
import {
  InvoiceDocument,
  InvoiceDocumentData,
  FromOrganization,
} from "@/components/checkout/InvoiceDocument";
import ProductThankYouCard from "@/components/checkout/ProductThankYouCard";
import type { ThankYouPage } from "@/lib/feed-api";
import { cn } from "@/lib/utils";

// ============ Types ============

type Step =
  | "loading"
  | "view"
  | "not_found"
  | "verify_email"
  | "otp"
  | "payment"
  | "success";

interface InvoicePayPageProps {
  invoiceId: string;
}

// ============ Helpers ============

function formatAmount(amount: number, currency: string): string {
  const value = amount / 100;
  if (currency === "INR") {
    return `\u20B9${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  }
  if (currency === "USD") {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }
  return `${currency} ${value.toFixed(2)}`;
}

// ============ Component ============

export function InvoicePayPage({ invoiceId }: InvoicePayPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Embedded mode — the page is rendered inside an iframe on another
  // page (e.g. /webinar/{id}). Suppresses the "success → /workspace"
  // redirect and instead emits window.parent.postMessage so the parent
  // can react (close the modal, transition to join, etc.).
  const isEmbedded = searchParams?.get("embed") === "1";
  // Where "done" leads. Signup funnels that started somewhere specific (the
  // whitelabel CTA, for one) forward `?redirect=` through org creation and the
  // plan picker to here; everyone else gets the plain workspace.
  //
  // `?redirect=` comes in two shapes and only one of them is a Next route:
  //   - same-origin path (`/workspace`, `/webinar/123`) → router.push
  //   - absolute URL, including a custom app scheme such as
  //     `networkchain://billing/paid` → window.location.href, because
  //     router.push cannot navigate off-origin. A native app passes this so
  //     the browser tab it opened bounces back into the app after payment.
  // Both are validated (see lib/safe-redirect) — an unvalidated value here
  // would be an open redirect at best and a `javascript:` sink at worst.
  const rawRedirect = searchParams?.get("redirect");
  const externalRedirect = safeAbsoluteRedirectUrl(rawRedirect);
  const doneHref = safeRedirectPath(rawRedirect) || "/workspace";
  // Short-lived handoff token minted by the mobile app (see handleHandoff).
  const handoffToken = searchParams?.get("t") || "";
  // One shot per page load — a failed exchange must not be retried on every
  // Pay tap, and a consumed one is single-use on the BE anyway.
  const handoffTriedRef = useRef(false);
  const [step, setStep] = useState<Step>("loading");
  const [invoice, setInvoice] = useState<InvoiceDocumentData | null>(null);
  const [fromOrganization, setFromOrganization] = useState<FromOrganization | null>(null);
  // Founder-configured post-payment page (only present when the invoice's
  // primary line item is a product AND the product has a `thankYouPage`
  // configured). Rendered on the invoice-success moment; never on refresh.
  // Renamed from productThankYouPage — same shape, may now be sourced
  // from either a Product or a Course line item on the invoice.
  const [thankYouPage, setThankYouPage] = useState<ThankYouPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // OTP state
  const [otp, setOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState<string>("");
  // Captured from /verify-otp response and threaded into CheckoutPaymentStep
  // so Razorpay's checkout popup gets `prefill.contact` populated.
  const [userPhone, setUserPhone] = useState<string>("");
  const [otpLoading, setOtpLoading] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      const res = await fetch(`${API_URL}/api/invoices/${invoiceId}`);
      const data = await res.json();

      if (!data.success || !data.invoice) {
        setStep("not_found");
        return;
      }

      setInvoice(data.invoice);
      setFromOrganization(data.fromOrganization);
      // BE now returns a generic `thankYouPage` field; falls back to the
      // legacy `productThankYouPage` alias for one release so a rollback
      // to an older BE doesn't wipe the config from the page.
      setThankYouPage(data.thankYouPage ?? data.productThankYouPage ?? null);
      setStep("view");
    } catch (err) {
      console.error("Failed to fetch invoice:", err);
      setStep("not_found");
    }
  };

  // `failed` is retryable — BE resets it to draft on the next /select-payment
  // call and wipes the prior attempt's gateway refs + failure trace. Only
  // truly terminal states (cancelled/expired) hide the pay UI.
  const isPending =
    invoice && ["draft", "pending", "failed"].includes(invoice.status);
  const isPaid = invoice?.status === "paid";
  const isUnavailable =
    invoice && ["cancelled", "expired"].includes(invoice.status);

  // Leaving the page when the payer is "done" (payment success, or the
  // success-screen button). Off-origin destinations need a real navigation.
  const goDone = () => {
    if (externalRedirect && typeof window !== "undefined") {
      window.location.href = externalRedirect;
      return;
    }
    router.push(doneHref);
  };

  /**
   * Native-app handoff (`?t=`).
   *
   * The mobile app already knows who the payer is, so making them re-do an
   * email OTP on the hosted checkout is pure friction. It cannot simply put
   * its session JWT in the link, though: a URL leaks into browser history,
   * the address bar, share sheets, referrers and screenshots, and that token
   * unlocks the whole account for its full lifetime. So the app asks the BE
   * for a *handoff* token instead — 5-minute TTL, scoped to this one invoice,
   * single use — and that is what travels in the URL. Here we trade it for a
   * real session token over POST, then strip `t` from the address bar so it
   * never reaches history or a share sheet.
   *
   * Fallback order is handoff → stored token → OTP. Every failure mode falls
   * through to the next rung, so a bad/expired/replayed handoff token costs
   * the payer an OTP, never a dead end.
   */
  const handleHandoff = async (token: string): Promise<boolean> => {
    try {
      const res = await fetch(
        `${API_URL}/api/invoices/${invoiceId}/handoff-exchange`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data?.success || !data.token) return false;

      // Same persistence as the /verify-otp success path — the response
      // shapes are identical by design.
      saveToken(data.token);
      saveOrgId(data.orgId);
      if (typeof data.phone === "string") {
        setUserPhone(data.phone);
      }
      stripHandoffParam();
      return true;
    } catch (err) {
      console.warn("[InvoicePayPage] handoff exchange failed:", err);
      return false;
    }
  };

  // Drop `t` from the address bar without a navigation, keeping every other
  // param (embed / native / redirect) intact.
  const stripHandoffParam = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("t")) return;
    url.searchParams.delete("t");
    const qs = url.searchParams.toString();
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`
    );
  };

  const handlePayClick = async () => {
    if (!invoice) return;
    // Rung 1: the native handoff token, tried before the stored token so an
    // app-initiated payer is never bounced to OTP by a stale local session.
    if (handoffToken && !handoffTriedRef.current) {
      handoffTriedRef.current = true;
      const handedOff = await handleHandoff(handoffToken);
      if (handedOff) {
        setStep("payment");
        return;
      }
    }
    // Rung 2: a stored JWT is only trustworthy for THIS invoice if its userId
    // matches invoice.userId. Otherwise the buyer is (a) logged into a
    // different account than the one the invoice was created for (common
    // on mobile — my.garage.app auto-restores the founder's session), or
    // (b) carrying a stale token from a prior test.
    //
    // Skipping OTP in those cases led to two contradictory-looking errors
    // downstream: "This invoice belongs to another user" on wallet-pay
    // (invoice.userId != JWT.userId) and "You already have an active
    // subscription" on channel-subscribe (the JWT user already had a
    // Subscription doc). Both were correct — they were just about the
    // wrong identity.
    //
    // Fix: only skip OTP when the token's userId matches the invoice
    // owner. On mismatch, clear the stale token and fall through to OTP
    // so the buyer re-authenticates as the invoice's customerEmail.
    const existingToken = getToken();
    if (existingToken) {
      // Defensive: if the BE didn't include invoice.userId (shouldn't
      // happen — GET /api/invoices/:id always returns it — but guard so
      // an older BE deploy doesn't lock everyone into OTP), fall back to
      // the legacy "any token works" behavior.
      if (!invoice.userId) {
        setStep("payment");
        return;
      }
      const tokenUserId = getUserIdFromToken();
      if (tokenUserId && tokenUserId === String(invoice.userId)) {
        setStep("payment");
        return;
      }
      // Wrong / stale identity — force re-auth against invoice.customerEmail.
      clearToken();
    }
    handleRequestOtp();
  };

  const handleRequestOtp = async () => {
    setOtpLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/invoices/${invoiceId}/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setMaskedEmail(data.maskedEmail || "");
      setStep("otp");
      toast.success("Verification code sent");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
    setOtpLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/invoices/${invoiceId}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otp }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Invalid code");
      }

      // Save token + orgId — user is now authenticated for payment
      saveToken(data.token);
      saveOrgId(data.orgId);
      // Capture phone so we can prefill Razorpay's `contact` field on the
      // next step (saves the user from re-entering it in the popup).
      if (typeof data.phone === "string") {
        setUserPhone(data.phone);
      }
      setStep("payment");
      toast.success("Verified");
    } catch (err: any) {
      setError(err.message || "Invalid or expired code");
      toast.error(err.message || "Invalid or expired code");
    } finally {
      setOtpLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    // When embedded in the mobile app WebView (?native=1), redirect to the
    // success path the app intercepts to detect completion and close, instead
    // of showing the in-page success screen.
    // An explicit off-origin `?redirect=` means the same thing without
    // `native=1`: whoever opened this tab wants it handed straight back
    // (a custom scheme re-opens the app), so there is no point rendering a
    // success screen the payer will never see.
    if (typeof window !== "undefined") {
      const isNative = new URLSearchParams(window.location.search).get("native") === "1";
      if (isNative || externalRedirect) {
        goDone();
        return;
      }
    }
    setStep("success");
    // On mobile the toast overlaps the system bottom-nav (screenshot from
    // founder), so suppress it there — the in-page "Payment complete!"
    // success step already confirms the payment. Desktop keeps the toast.
    const isMobile =
      typeof window !== "undefined" && window.innerWidth < 768;
    if (!isMobile) {
      toast.success("Payment complete!");
    }
    // Refresh invoice to show updated status
    setTimeout(fetchInvoice, 1500);
    // Embedded flow: signal the parent (e.g. /webinar/{id}) so it can
    // close the modal and transition to join. Same-origin check happens
    // on the parent side.
    if (isEmbedded && typeof window !== "undefined" && window.parent !== window) {
      try {
        window.parent.postMessage(
          { type: "invoice:paid", invoiceId },
          window.location.origin
        );
      } catch (postErr) {
        console.warn("[InvoicePayPage] postMessage failed:", postErr);
      }
    }
  };

  // ============ Render ============

  // Loading state
  if (step === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
          <p className="text-sm text-[#6b6b80]">Loading invoice...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (step === "not_found") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invoice Not Found</h1>
          <p className="text-sm text-[#9fa0b8] mb-6">
            This invoice doesn&apos;t exist or is no longer available.
          </p>
          <Button
            onClick={() => router.push("/")}
            className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-6 sm:py-10 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Back button (visible during OTP/payment flow) */}
        {(step === "verify_email" || step === "otp" || step === "payment") && (
          <button
            onClick={() => {
              if (step === "payment") {
                setStep("view");
              } else {
                setStep("view");
                setOtp("");
                setError(null);
              }
            }}
            className="mb-4 flex items-center gap-1.5 text-xs text-[#6b6b80] hover:text-[#9fa0b8] transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to invoice
          </button>
        )}

        {/* Invoice document (always visible except during payment step) */}
        {step !== "payment" && (
          <InvoiceDocument
            invoice={invoice}
            fromOrganization={fromOrganization}
            onDownload={
              invoice.invoiceShortUrl
                ? () => window.open(invoice.invoiceShortUrl, "_blank")
                : undefined
            }
          />
        )}

        {/* View state: show pay button or status message */}
        {step === "view" && (
          <div className="mt-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {isPending && (() => {
              // Note: coupons are NOT applied on this view step anymore — they
              // require a verified identity (real login or OTP). The customer
              // clicks Pay → goes through OTP if needed → enters the coupon on
              // the payment step. A small read-only banner is shown here if a
              // coupon was already applied previously (e.g. in another tab).
              const alreadyHasCoupon = !!invoice.couponCode;

              return (
                <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-5 sm:p-6 space-y-4">
                  {/* Read-only "already applied" notice */}
                  {alreadyHasCoupon && invoice.discount && invoice.discount > 0 ? (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div className="text-xs text-emerald-400">
                        Coupon <code className="font-mono font-semibold">{invoice.couponCode}</code> applied — you saved {formatAmount(invoice.discount, invoice.itemCurrency)}
                      </div>
                    </div>
                  ) : null}

                  <Button
                    onClick={handlePayClick}
                    className="w-full h-14 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-bold text-base rounded-xl shadow-lg shadow-brand/10 transition-all"
                  >
                    Pay {formatAmount(invoice.totalAmount, invoice.itemCurrency)}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <div className="flex items-center justify-center gap-1.5">
                    <Shield className="w-3 h-3 text-[#6b6b80]" />
                    <span className="text-[10px] text-[#6b6b80]">
                      Secured checkout. Verify with email to continue.
                    </span>
                  </div>
                </div>
              );
            })()}

            {isPaid && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/20 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-sm font-semibold text-emerald-300">
                  This invoice has been paid
                </div>
                {invoice.invoiceShortUrl && (
                  <a
                    href={invoice.invoiceShortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 mt-2"
                  >
                    View receipt
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {isUnavailable && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div className="text-sm font-semibold text-red-300">
                  This invoice is no longer available
                </div>
                <p className="text-xs text-red-400/70 mt-1 capitalize">
                  Status: {invoice.status}
                </p>
              </div>
            )}
          </div>
        )}

        {/* OTP Step */}
        {step === "otp" && (
          <div className="mt-5 bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-6 sm:p-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-5">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand/10 border border-brand/20 mb-3">
                <Mail className="w-5 h-5 text-brand" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">Verify your email</h2>
              <p className="text-sm text-[#9fa0b8]">
                We&apos;ve sent a 6-digit code to{" "}
                <span className="text-white font-medium">{maskedEmail}</span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#9fa0b8] mb-2 uppercase tracking-wider">
                  Verification code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b80]" />
                  <Input
                    type="text"
                    // Mobile keyboard hints: inputMode="numeric" is the modern
                    // signal that opens the digits-only pad on Android + iOS.
                    // pattern="[0-9]*" is the legacy iOS Safari fallback.
                    // autoComplete="one-time-code" lets iOS/Chrome surface
                    // the SMS OTP as a one-tap autofill above the keyboard.
                    // (Keep type="text" — type="number" adds unwanted spinner
                    // arrows on desktop and allows +/-/e/. characters.)
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    disabled={otpLoading}
                    onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && handleVerifyOtp()}
                    className="pl-10 h-12 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl text-center tracking-[0.5em] font-mono text-lg focus:border-brand focus:ring-brand/20"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <Button
                onClick={handleVerifyOtp}
                disabled={otp.length !== 6 || otpLoading}
                className={cn(
                  "w-full h-12 rounded-xl font-semibold transition-all",
                  otp.length === 6 && !otpLoading
                    ? "bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground shadow-lg shadow-brand/10"
                    : "bg-[#1a1a22] text-[#6b6b80]"
                )}
              >
                {otpLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Verify & continue
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>

              <button
                onClick={handleRequestOtp}
                disabled={otpLoading}
                className="w-full text-xs text-[#6b6b80] hover:text-[#9fa0b8] transition-colors"
              >
                Didn&apos;t receive the code? Resend
              </button>
            </div>
          </div>
        )}

        {/* Payment Step */}
        {step === "payment" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <CheckoutPaymentStep
              invoiceId={invoiceId}
              organizationName={fromOrganization?.name || ""}
              userEmail={invoice.customerEmail}
              userName={invoice.customerName}
              userPhone={userPhone || undefined}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setStep("view")}
            />
          </div>
        )}

        {/* Success State */}
        {step === "success" &&
          // Founder-configured post-purchase thank-you page — only rendered
          // on this in-session `success` step so it never re-fires on
          // refresh of an already-paid invoice. Source is Product or
          // Course (BE picks based on the invoice's line-item type).
          (thankYouPage && !isEmbedded ? (
            <ProductThankYouCard
              page={thankYouPage}
              fromOrganization={fromOrganization}
              invoiceNumber={invoice.invoiceNumber}
              onGoToWorkspace={goDone}
            />
          ) : (
            <div className="mt-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Payment complete!</h2>
              <p className="text-sm text-[#9fa0b8] mb-6">
                {isEmbedded
                  ? "Redirecting you back…"
                  : `Invoice ${invoice.invoiceNumber} has been paid successfully.`}
              </p>
              {!isEmbedded && (
                <Button
                  onClick={goDone}
                  className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold"
                >
                  Go to Workspace
                </Button>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
