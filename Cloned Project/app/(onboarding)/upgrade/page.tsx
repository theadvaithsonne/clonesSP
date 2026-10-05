"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Crown,
  Check,
  Loader2,
  Wallet,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";

interface UpgradePreview {
  canUpgrade: boolean;
  reason?: string;
  currentPlan: {
    name: string;
    slug: string;
    amount: number;
    amountWithGst: number;
  };
  targetPlan: {
    name: string;
    slug: string;
    amount: number;
    amountWithGst: number;
  };
  creditToWallet: {
    daysRemaining: number;
    totalDaysInCycle: number;
    unusedBasicCredit: number;
  };
  nextBillingDate: string;
  nextBillingAmount: number;
}

interface UpgradeResult {
  success: boolean;
  creditedAmount: number;
  invoiceId?: string;
  walletBalance: number;
  subscription: {
    _id: string;
    status: string;
    shortUrl: string;
    planName: string;
  };
}

export default function UpgradeCheckoutPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<UpgradePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [showPaymentStep, setShowPaymentStep] = useState(false);

  // Load upgrade preview on mount
  useEffect(() => {
    loadUpgradePreview();
  }, []);

  const loadUpgradePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const tokenPayload = JSON.parse(atob(token.split(".")[1]));

      // Only founders can access upgrade page
      if (tokenPayload.role !== "founder") {
        toast.error("Only founders can upgrade the plan");
        router.push("/workspace");
        return;
      }

      const orgId = localStorage.getItem("garage_org_id") || tokenPayload.orgId;

      const res = await api<UpgradePreview>(
        `/checkout/office/${orgId}/upgrade/preview`,
        {},
        token
      );
      setPreview(res);
      if (!res.canUpgrade && res.reason) {
        setError(res.reason);
      }
    } catch (err: any) {
      console.error("Failed to load upgrade preview:", err);
      setError(err.message || "Failed to load upgrade details");
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = useCallback(async () => {
    if (!preview?.canUpgrade) return;

    setUpgrading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const tokenPayload = JSON.parse(atob(token.split(".")[1]));
      const orgId = localStorage.getItem("garage_org_id") || tokenPayload.orgId;

      // Two upgrade paths from this page:
      //  - Basic  → POST /upgrade/initiate (credits wallet for unused
      //             paid time, cancels Basic Razorpay sub, then invoices
      //             the founder for the new Pro sub).
      //  - Starter → POST /subscribe { planSlug: "pro" } (starter is
      //             free so nothing to credit; /subscribe's plan-switch
      //             code path cancels the starter parent invoice,
      //             restores the pre-starter platform-fee %, and mints
      //             the Pro invoice).
      const isStarterSource = preview?.currentPlan?.slug === "starter";
      const result = isStarterSource
        ? await api<{ success: boolean; invoiceId?: string }>(
            `/checkout/office/${orgId}/subscribe`,
            {
              method: "POST",
              body: JSON.stringify({ planSlug: "pro" }),
            },
            token,
          ).then((r) => ({
            success: r.success,
            creditedAmount: 0,
            invoiceId: r.invoiceId,
            walletBalance: 0,
            subscription: {
              _id: "",
              status: "created",
              shortUrl: "",
              planName: "Pro",
            },
          }))
        : await api<UpgradeResult>(
            `/checkout/office/${orgId}/upgrade/initiate`,
            { method: "POST" },
            token,
          );

      if (result.success) {
        // Dispatch event to refresh subscription status
        window.dispatchEvent(new CustomEvent("subscription:upgraded"));

        // Show success message with credit info
        if (result.creditedAmount > 0) {
          toast.success(
            `$${result.creditedAmount.toFixed(2)} credited to your wallet!`
          );
        }

        // Use invoice-based payment flow
        if (result.invoiceId) {
          setInvoiceId(result.invoiceId);
          setShowPaymentStep(true);
          setUpgrading(false);
        } else {
          // Fallback: redirect to workspace (payment may be handled elsewhere)
          toast.success("Upgrade initiated!");
          router.push("/workspace");
        }
      }
    } catch (err: any) {
      console.error("Upgrade failed:", err);
      setError(err.message || "Failed to upgrade");
      toast.error(err.message || "Failed to upgrade");
      setUpgrading(false);
    }
  }, [preview, router]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b0d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-brand" />
          <p className="text-[#9fa0b8]">Loading upgrade details...</p>
        </div>
      </div>
    );
  }

  if (error && !preview?.canUpgrade) {
    return (
      <div className="min-h-screen bg-[#0b0b0d] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30">
            <Crown className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Cannot Upgrade</h1>
          <p className="text-[#9fa0b8] mb-6">{error}</p>
          <Button
            onClick={() => router.push("/workspace")}
            className="bg-[#1a1a22] hover:bg-[#2a2a35] text-white border border-[#2a2a35]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Workspace
          </Button>
        </div>
      </div>
    );
  }

  // Invoice payment step for upgrade
  if (showPaymentStep && invoiceId) {
    return (
      <div className="min-h-screen bg-[#0b0b0d] py-8 sm:py-16 px-4 sm:px-6">
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl font-bold text-white mb-2 text-center">
            Complete Pro Plan Payment
          </h2>
          <p className="text-sm text-[#9fa0b8] mb-6 text-center">
            {preview?.creditToWallet?.unusedBasicCredit
              ? `$${(preview.creditToWallet.unusedBasicCredit / 100).toFixed(2)} has been credited to your wallet`
              : "Upgrade to Pro"}
          </p>
          <CheckoutPaymentStep
            invoiceId={invoiceId}
            organizationName="Garage"
            userEmail=""
            isSubscription={true}
            onSuccess={() => {
              toast.success("Pro plan activated!");
              router.push("/workspace");
            }}
            onCancel={() => {
              setShowPaymentStep(false);
              setInvoiceId(null);
            }}
            onBack={() => {
              setShowPaymentStep(false);
              setInvoiceId(null);
            }}
          />
        </div>
      </div>
    );
  }

  // Pricing pieces for the billing summary. `amount` is ex-GST,
  // `amountWithGst` is the charged total — the delta is the tax row.
  const proBaseUsd = preview?.targetPlan?.amount ?? 0;
  const proTotalUsd = preview?.targetPlan?.amountWithGst ?? 0;
  const proTaxUsd = Math.round((proTotalUsd - proBaseUsd) * 100) / 100;

  return (
    <div className="relative min-h-screen w-full bg-[#0b0b0d] flex items-center justify-center p-4 overflow-hidden">
      {/* Glassmorphic background — mirrors the Create Office screen */}
      <style>{`
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0); opacity: 0.2; }
          50% { transform: translateY(-20px); opacity: 0.8; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_30%_20%,color-mix(in_srgb,_var(--brand-2)_25%,_transparent),transparent_50%),radial-gradient(600px_300px_at_70%_80%,rgba(255,183,32,0.2),transparent_60%),radial-gradient(400px_200px_at_50%_50%,rgba(255,193,7,0.15),transparent_70%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60" />
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full"
              style={{
                left: `${10 + (i * 4.2) % 80}%`,
                top: `${5 + (i * 4.7) % 90}%`,
                animation: `floatParticle ${3 + (i % 3)}s ease-in-out ${(i % 5) * 0.4}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-[640px] max-h-[92vh] flex flex-col bg-[#111114]/80 backdrop-blur-xl border border-[#2a2a35] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a35] shrink-0 bg-[#111114]">
          <h1 className="text-[17px] font-semibold text-white">Upgrade Plan</h1>
          <button
            onClick={() => router.push("/workspace")}
            className="bg-[#1a1a22] border border-[#2a2a35] text-white hover:bg-[#2a2a35] h-8 px-4 rounded-lg font-semibold text-xs transition-colors"
          >
            Back
          </button>
        </div>

        {/* Scrollable Body */}
        {preview && (
          <div
            className="flex-1 overflow-y-auto px-5 py-4 space-y-5 animate-in fade-in duration-300"
            style={{ scrollbarWidth: "none" }}
          >
            {/* Plan card — Pro details */}
            <div className="rounded-2xl border border-brand-2/40 bg-gradient-to-br from-[#0e0e12] to-[#1a1a22] p-5 md:p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 px-3 py-1 bg-brand-2 text-brand-foreground text-[10px] font-semibold uppercase tracking-wider rounded-bl-lg">
                Pro Plan
              </div>

              <div className="flex items-baseline gap-3 mb-1">
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  {preview.targetPlan.name || "Pro Plan"}
                </h2>
              </div>
              <p className="text-sm text-[#9fa0b8] mb-5">
                Unlock unlimited stakeholder invites and premium features.
              </p>

              {/* Pricing block */}
              <div className="rounded-xl bg-black/40 border border-[#2a2a35] p-4 mb-5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-4xl font-bold text-white tracking-tight tabular-nums">
                    ${proBaseUsd.toFixed(0)}
                  </span>
                  <span className="text-sm text-[#c7c7da]">/month</span>
                  {proTaxUsd > 0 && (
                    <span className="text-[#6b6b80] text-xs">
                      + ${proTaxUsd.toFixed(2)} GST
                    </span>
                  )}
                </div>
                {proTaxUsd > 0 && (
                  <div className="mt-2 text-[11px] text-[#9fa0b8] tabular-nums">
                    Total{" "}
                    <span className="text-white font-medium">
                      ${proTotalUsd.toFixed(2)}
                    </span>
                    /month
                  </div>
                )}
              </div>

              {/* Feature list */}
              <ul className="space-y-2">
                {[
                  "Unlimited stakeholder invites",
                  "Advanced collaboration tools",
                  "Priority support",
                  "All future Pro features",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-[#c7c7da]"
                  >
                    <Check className="w-3.5 h-3.5 text-brand-2 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Wallet credit — only when there's unused paid time to refund */}
            {preview.creditToWallet.unusedBasicCredit > 0 && (
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Wallet credit
                  </h3>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-[#9fa0b8]">Current plan</span>
                    <span className="text-white font-medium">
                      {preview.currentPlan.name}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-[#9fa0b8]">
                      Days remaining in cycle
                    </span>
                    <span className="text-white font-medium tabular-nums">
                      {preview.creditToWallet.daysRemaining} days
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-3 border-t border-[#2a2a35]">
                    <span className="text-sm text-[#c7c7da] font-medium">
                      Credit to your wallet
                    </span>
                    <span className="text-emerald-400 font-bold text-xl tabular-nums">
                      {formatCurrency(preview.creditToWallet.unusedBasicCredit)}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[#6b6b80] leading-relaxed mt-3">
                  Your unused {preview.currentPlan.name} balance is credited to
                  your Store Wallet — spend it anywhere in the marketplace.
                </p>
              </div>
            )}

            {/* Billing summary — Pro bills from day 1 */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6b6b80] px-1">
                Billing summary
              </h3>

              <div className="rounded-2xl border border-brand-2/30 bg-gradient-to-br from-brand-2/5 to-transparent p-5">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-brand-2/20">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-2/20 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-brand-2" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        Due today
                      </div>
                      <div className="text-[10px] text-brand-2/80 uppercase tracking-wider">
                        First monthly cycle
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-brand-2 font-semibold bg-brand-2/10 px-2 py-1 rounded-md">
                    Recurring monthly
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="text-white">
                        {preview.targetPlan.name || "Pro Plan"}
                      </span>
                      <span className="text-[10px] text-[#6b6b80] uppercase tracking-wider">
                        plan
                      </span>
                    </div>
                    <span className="text-white font-medium tabular-nums">
                      ${proBaseUsd.toFixed(2)}
                    </span>
                  </div>

                  {proTaxUsd > 0 && (
                    <>
                      <div className="flex items-baseline justify-between text-xs pt-2 border-t border-[#2a2a35]">
                        <span className="text-[#9fa0b8]">Subtotal</span>
                        <span className="text-[#c7c7da] tabular-nums">
                          ${proBaseUsd.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-[#9fa0b8]">GST</span>
                        <span className="text-[#c7c7da] tabular-nums">
                          ${proTaxUsd.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-brand-2/20 flex items-baseline justify-between">
                  <div className="text-sm text-[#c7c7da] font-medium">
                    Total due today
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white tabular-nums">
                      ${proTotalUsd.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-[#6b6b80] mt-0.5">
                      /month {proTaxUsd > 0 ? "(GST included)" : ""}
                    </div>
                  </div>
                </div>
              </div>

              {/* Next billing */}
              <div className="flex items-center gap-3 rounded-xl bg-black/40 border border-[#2a2a35] p-3.5">
                <div className="w-8 h-8 rounded-full bg-[#1a1a22] flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-[#9fa0b8]" />
                </div>
                <div className="text-[11px] text-[#9fa0b8] leading-relaxed">
                  Next billing on{" "}
                  <span className="text-white font-medium">
                    {formatDate(preview.nextBillingDate)}
                  </span>{" "}
                  for{" "}
                  <span className="text-white font-medium">
                    {formatCurrency(preview.nextBillingAmount)}
                  </span>{" "}
                  (Pro monthly).
                </div>
              </div>

              <p className="text-[11px] text-[#6b6b80] leading-relaxed px-1 pt-1">
                {preview.creditToWallet.unusedBasicCredit > 0
                  ? "Your unused balance is credited to your wallet, then you authorize the new Pro subscription via GaragePay. Pay by card, UPI, wallet, or crypto. Cancel anytime."
                  : "You'll authorize your new Pro subscription via GaragePay. Pay by card, UPI, wallet, or crypto. Cancel anytime."}
              </p>
            </div>
          </div>
        )}

        {/* Sticky Footer */}
        <div className="shrink-0 flex items-center justify-end border-t border-[#2a2a35] px-6 py-4 bg-[#0e0e12] rounded-b-2xl">
          <Button
            onClick={handleUpgrade}
            disabled={upgrading || !preview?.canUpgrade}
            className={cn(
              "bg-brand text-brand-foreground font-semibold hover:bg-[#fde047] transition-colors px-6 h-10 rounded-lg text-sm",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {upgrading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Upgrading…
              </>
            ) : (
              "Continue to payment"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
