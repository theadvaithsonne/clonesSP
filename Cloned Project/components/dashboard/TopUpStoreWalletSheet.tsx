"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Loader2,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { topUpStoreWallet } from "@/lib/feed-api";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { API_URL } from "@/lib/api";
import { getBrandHex } from "@/lib/brand-color-context";

export interface TopUpStoreWalletSheetOrg {
  orgId: string;
  orgName: string;
  /** Optional — shown next to the org name as a context cue. */
  currentBalance?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Orgs the user can top up. */
  orgs: TopUpStoreWalletSheetOrg[];
  /** Defaults the org dropdown. Falls back to the first entry. */
  defaultOrgId?: string | null;
  /** Called after a successful credit so the parent can refresh balances. */
  onSuccess?: () => void;
}

const MIN_USD = 1;
const MAX_USD = 10_000;
const QUICK_AMOUNTS = [10, 25, 50, 100, 250, 500];

const INPUT_CLASS =
  "w-full h-10 px-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white text-sm focus:outline-none focus:border-brand/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed placeholder-[#6b6b80]";

// ── Razorpay loader (mirrors the pattern in ProductsPage) ─────────────────
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  modal?: { ondismiss?: () => void };
  theme?: { color: string };
}
interface RazorpayClass {
  new (options: RazorpayOptions): { open: () => void };
}

async function loadRazorpayScript(): Promise<boolean> {
  const w = window as { Razorpay?: unknown };
  if (w.Razorpay) return true;
  const existing = document.querySelector(
    'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
  );
  if (!existing) {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      if ((window as any).Razorpay) resolve(true);
      else if (attempts >= 50) resolve(false);
      else {
        attempts++;
        setTimeout(check, 100);
      }
    };
    check();
  });
}

// ── Component ─────────────────────────────────────────────────────────────

type Step = "form" | "payment";

interface InvoiceLite {
  _id: string;
  invoiceNumber: string;
  totalAmount: number;
  itemCurrency: string;
}

export function TopUpStoreWalletSheet({
  open,
  onOpenChange,
  orgs,
  defaultOrgId,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>("form");
  const [orgId, setOrgId] = useState<string>("");
  const [amountStr, setAmountStr] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceLite | null>(null);

  // Lock body scroll while open, restore on close. Same pattern as the
  // CreateProductModal in ProductsPage — keeps background pages from
  // double-scrolling behind the slide.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset when opening.
  useEffect(() => {
    if (!open) return;
    setStep("form");
    setError(null);
    setAmountStr("");
    setInvoice(null);
    const initial =
      defaultOrgId && orgs.find((o) => o.orgId === defaultOrgId)
        ? defaultOrgId
        : orgs[0]?.orgId || "";
    setOrgId(initial);
  }, [open, defaultOrgId, orgs]);

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.orgId === orgId) || null,
    [orgs, orgId]
  );

  const amountUsd = parseFloat(amountStr) || 0;
  const amountCents = Math.round(amountUsd * 100);
  const amountValid =
    Number.isFinite(amountUsd) &&
    amountUsd >= MIN_USD &&
    amountUsd <= MAX_USD &&
    amountCents >= 100;
  const canSubmit = !!orgId && amountValid && !submitting && !verifying;

  const livePreview = useMemo(() => {
    if (!selectedOrg) return "Pick a business to top up.";
    if (!amountValid) {
      return `Enter an amount between $${MIN_USD.toFixed(
        2
      )} and $${MAX_USD.toLocaleString()}.`;
    }
    return `$${amountUsd.toFixed(2)} will be added to your “${
      selectedOrg.orgName
    }” Store Wallet after payment.`;
  }, [selectedOrg, amountValid, amountUsd]);

  const handleContinue = async () => {
    if (!canSubmit || !selectedOrg) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await topUpStoreWallet({
        orgId: selectedOrg.orgId,
        amountCents,
      });
      if (!res.success) {
        throw new Error("Failed to create top-up invoice");
      }
      setInvoice({
        _id: res.invoice._id,
        invoiceNumber: res.invoice.invoiceNumber,
        totalAmount: res.invoice.totalAmount,
        itemCurrency: res.invoice.itemCurrency,
      });
      setStep("payment");
    } catch (e: any) {
      setError(e?.message || "Failed to create top-up invoice");
    } finally {
      setSubmitting(false);
    }
  };

  // Verify Razorpay payment with the standard invoice-verify endpoint, then
  // close + refresh. Same path the ProductDetailPage uses for invoice-backed
  // purchases.
  const verifyRazorpay = async (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    if (!invoice) return;
    setVerifying(true);
    try {
      const res = await fetch(
        `${API_URL}/api/invoices/${invoice._id}/verify-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }),
        }
      );
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Payment verification failed");
      }
      toast.success(
        `$${amountUsd.toFixed(2)} added to your ${
          selectedOrg?.orgName || "Store"
        } Wallet`
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || "Payment verification failed");
      toast.error(e?.message || "Payment verification failed");
    } finally {
      setVerifying(false);
    }
  };

  // PaymentMethodSelector hands back gateway details — open Razorpay popup,
  // surface wallet/stripe success directly, or open crypto in a new tab.
  // Same shape and branching as ProductsPage's handlePaymentInitiated.
  const handlePaymentInitiated = async (data: {
    razorpayOrderId?: string;
    razorpayKeyId?: string;
    shortUrl?: string;
    cryptoPaymentUrl?: string;
    walletPaid?: boolean;
    stripePaid?: boolean;
    amount: number;
    currency: string;
    invoiceId: string;
  }) => {
    setError(null);
    if (data.walletPaid || data.stripePaid) {
      toast.success(
        `$${amountUsd.toFixed(2)} added to your ${
          selectedOrg?.orgName || "Store"
        } Wallet`
      );
      onSuccess?.();
      onOpenChange(false);
      return;
    }
    if (data.cryptoPaymentUrl) {
      window.open(data.cryptoPaymentUrl, "_blank");
      toast.info(
        "Complete crypto payment in the new tab. Your wallet will update once confirmed."
      );
      return;
    }
    if (data.shortUrl) {
      window.open(data.shortUrl, "_blank");
      return;
    }
    if (data.razorpayOrderId && data.razorpayKeyId) {
      try {
        const ok = await loadRazorpayScript();
        if (!ok) throw new Error("Failed to load Razorpay");
        const Razorpay = (window as { Razorpay?: RazorpayClass }).Razorpay;
        if (!Razorpay) throw new Error("Razorpay not available");
        const { getRazorpayContactForCurrentUser } = await import("@/lib/razorpayPrefill");
        const rzp = new Razorpay({
          key: data.razorpayKeyId,
          amount: data.amount,
          currency: data.currency,
          order_id: data.razorpayOrderId,
          name: "Store Wallet Top-up",
          description: `Add $${amountUsd.toFixed(2)} to ${
            selectedOrg?.orgName || "Store Wallet"
          }`,
          handler: (resp) => {
            verifyRazorpay(resp);
          },
          modal: { ondismiss: () => toast.info("Payment cancelled") },
          theme: { color: getBrandHex() },
          prefill: { contact: await getRazorpayContactForCurrentUser() },
        });
        rzp.open();
      } catch (e: any) {
        setError(e?.message || "Failed to open payment gateway");
      }
    }
  };

  if (!open) return null;

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
          if (!submitting && !verifying) onOpenChange(false);
        }}
      />

      {/* Slide-in side panel — matches the right-side card look of the
          product checkout panel. Full width on mobile, narrow card on
          larger screens. */}
      <div
        className={cn(
          "relative ml-auto h-full w-full sm:max-w-md bg-[#0b0b0d] border-l border-[#2a2a35]",
          "shadow-2xl flex flex-col",
          "animate-in slide-in-from-right duration-300"
        )}
      >
        {/* Header — back arrow on payment step, X on form step */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-[#2a2a35] bg-[#0e0e12]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-brand/10 border border-brand/30 shrink-0">
                <Wallet className="w-4 h-4 text-brand" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">
                  {step === "form" ? "Top Up Store Wallet" : "Choose payment"}
                </h2>
                <p className="text-xs text-[#9fa0b8] mt-0.5">
                  {step === "form"
                    ? "Add funds to one of your Store Wallets."
                    : `Pay for invoice ${invoice?.invoiceNumber || ""}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {step === "payment" && (
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setInvoice(null);
                    setError(null);
                  }}
                  disabled={verifying}
                  className="p-1.5 rounded-md text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white transition-colors"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={submitting || verifying}
                className="p-1.5 rounded-md text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live preview only on form step */}
          {step === "form" && (
            <div className="mt-3 rounded-lg border border-brand/20 bg-brand/5 p-3 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-brand mt-0.5 shrink-0" />
              <p className="text-xs text-brand/90 leading-relaxed">
                {livePreview}
              </p>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === "form" ? (
            <div className="space-y-5">
              {/* Org picker */}
              <div>
                <label className="text-xs font-medium text-[#9fa0b8] mb-1.5 block">
                  Business
                </label>
                {orgs.length === 0 ? (
                  <div className="px-3 h-10 rounded-lg bg-[#1a1a22] border border-[#2a2a35] flex items-center text-sm text-[#9fa0b8]">
                    No organizations available.
                  </div>
                ) : (
                  <Select
                    value={orgId}
                    onValueChange={setOrgId}
                    disabled={submitting}
                  >
                    <SelectTrigger
                      className={cn(
                        "!h-10 bg-[#1a1a22] border-[#2a2a35] text-white text-sm hover:border-[#3a3a45]",
                        "focus:border-brand/40 focus:ring-0 data-[size=default]:h-10"
                      )}
                    >
                      <SelectValue placeholder="Choose a business" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
                      {orgs.map((o) => (
                        <SelectItem
                          key={o.orgId}
                          value={o.orgId}
                          className="text-sm focus:bg-[#1a1a22] focus:text-white"
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-brand" />
                            <span className="truncate">{o.orgName}</span>
                            {typeof o.currentBalance === "number" && (
                              <span className="text-[10px] text-[#6b6b80] ml-2">
                                ${o.currentBalance.toFixed(2)} now
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Amount */}
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#9fa0b8]">
                    Amount
                  </label>
                  <span className="text-[11px] text-[#6b6b80]">
                    ${MIN_USD.toFixed(2)} – ${MAX_USD.toLocaleString()}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6b6b80] font-medium pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={MIN_USD}
                    max={MAX_USD}
                    step={0.01}
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0.00"
                    disabled={submitting}
                    className={cn(INPUT_CLASS, "pl-7 font-mono text-base")}
                  />
                </div>

                {/* Quick-pick chips */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {QUICK_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAmountStr(String(a))}
                      disabled={submitting}
                      className={cn(
                        "h-7 px-2.5 rounded-md text-[11px] font-medium border transition-colors",
                        amountUsd === a
                          ? "border-brand/50 bg-brand/10 text-brand"
                          : "border-[#2a2a35] bg-[#0e0e12] text-[#9fa0b8] hover:border-[#3a3a45] hover:text-white"
                      )}
                    >
                      ${a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-[#6b6b80] leading-relaxed">
                Store Wallets are USD-denominated. If you pay in INR via
                Razorpay or in another currency, the gateway handles
                conversion at checkout — the USD amount above is what
                lands in your wallet on payment success.
              </div>
            </div>
          ) : (
            // ── Payment step — embed PaymentMethodSelector inline ──
            <div className="space-y-3">
              {invoice && (
                <div className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#9fa0b8]">Amount</span>
                    <span className="font-mono text-white font-semibold">
                      ${(invoice.totalAmount / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-[#6b6b80]">Destination</span>
                    <span className="text-[#9fa0b8] truncate ml-2">
                      {selectedOrg?.orgName || "Store Wallet"}
                    </span>
                  </div>
                </div>
              )}

              {invoice && (
                <PaymentMethodSelector
                  invoiceId={invoice._id}
                  itemCurrency={invoice.itemCurrency}
                  totalAmount={invoice.totalAmount}
                  onPaymentInitiated={handlePaymentInitiated}
                  onError={(msg) => setError(msg)}
                  disabled={verifying}
                />
              )}

              {verifying && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-[#9fa0b8]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying payment…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer (form step only — payment step has its own button) */}
        {step === "form" && (
          <div className="shrink-0 border-t border-[#2a2a35] bg-[#0e0e12] px-5 py-3 space-y-2">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="h-10 px-4 rounded-lg text-sm text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!canSubmit}
                className={cn(
                  "h-10 px-4 rounded-lg text-sm font-medium bg-brand text-brand-foreground",
                  "hover:bg-brand/90 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
                )}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue
              </button>
            </div>
          </div>
        )}

        {step === "payment" && error && (
          <div className="shrink-0 border-t border-[#2a2a35] bg-[#0e0e12] px-5 py-3">
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
