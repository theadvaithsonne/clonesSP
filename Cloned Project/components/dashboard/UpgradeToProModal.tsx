"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Rocket,
  Crown,
  Check,
  ArrowRight,
  Loader2,
  Sparkles,
  Calendar,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  walletBalance: number;
  subscription: {
    _id: string;
    status: string;
    shortUrl: string;
    planName: string;
  };
}

export default function UpgradeToProModal({
  onUpgraded,
  children,
}: {
  onUpgraded?: () => void;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<UpgradePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load upgrade preview when dialog opens
  useEffect(() => {
    if (!open) return;
    loadUpgradePreview();
  }, [open]);

  const loadUpgradePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<UpgradePreview>(
        `/checkout/office/${orgId}/upgrade/preview`,
        {},
        getToken()!
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
      const orgId = localStorage.getItem("garage_org_id");

      // Single API call to perform the upgrade
      const result = await api<UpgradeResult>(
        `/checkout/office/${orgId}/upgrade/initiate`,
        { method: "POST" },
        getToken()!
      );

      if (result.success) {
        // Show success message with credit info
        if (result.creditedAmount > 0) {
          toast.success(
            `$${result.creditedAmount.toFixed(2)} credited to your wallet!`
          );
        }

        setOpen(false);
        onUpgraded?.();

        // Open Razorpay in a popup window (same pattern as office-payment)
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          result.subscription.shortUrl,
          "razorpay_payment",
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );

        if (popup) {
          toast.info("Complete Pro subscription authorization in the popup. You'll be redirected once done.");

          // Monitor popup and redirect when closed
          const checkPopup = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkPopup);
              // Dispatch event to refresh subscription status across the app
              window.dispatchEvent(new CustomEvent("subscription:upgraded"));
              // Navigate to workspace
              window.location.href = "/workspace";
            }
          }, 500);
        } else {
          // Popup blocked - fallback to new tab
          window.open(result.subscription.shortUrl, "_blank");
          toast.info("Complete Pro authorization in the new tab, then refresh.");
        }
      }
    } catch (err: any) {
      console.error("Upgrade failed:", err);
      setError(err.message || "Failed to upgrade");
      toast.error(err.message || "Failed to upgrade");
      setUpgrading(false);
    }
  }, [preview, onUpgraded]);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button className="bg-gradient-to-r from-brand to-[#f59e0b] hover:from-[color:color-mix(in_srgb,var(--brand)_91%,black)] hover:to-[color:color-mix(in_srgb,var(--brand-2)_90%,black)] text-brand-foreground">
            <Rocket className="h-4 w-4 mr-1.5" />
            Upgrade to Pro
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className={cn(
          "!max-w-[520px] !w-full border border-[#2a2a35] bg-[#0e0e12]/95 backdrop-blur-xl",
          "shadow-[0_10px_40px_rgba(0,0,0,0.45)]"
        )}
      >
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full px-2.5 py-1 text-[11px] bg-gradient-to-r from-brand/20 to-[#f59e0b]/20 border border-brand/30 text-brand">
            <Crown className="h-3.5 w-3.5" />
            Upgrade Plan
          </div>
          <DialogTitle className="mt-3 text-white text-xl">
            Upgrade to Pro
          </DialogTitle>
          <p className="text-sm text-[#9fa0b8]">
            Unlock unlimited stakeholder invites and premium features.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : error && !preview?.canUpgrade ? (
          <div className="py-6 text-center">
            <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30">
              <Sparkles className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-red-400">{error}</p>
          </div>
        ) : preview ? (
          <div className="space-y-5 pt-2">
            {/* Pro Features */}
            <div className="rounded-lg border border-[#2a2a35] bg-[#0f0f13] p-4">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Crown className="h-4 w-4 text-brand" />
                Pro Plan Features
              </h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-[#c7c7da]">
                  <Check className="h-4 w-4 text-green-400" />
                  <span><strong>Unlimited</strong> stakeholder invites</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-[#c7c7da]">
                  <Check className="h-4 w-4 text-green-400" />
                  <span>Advanced collaboration tools</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-[#c7c7da]">
                  <Check className="h-4 w-4 text-green-400" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-[#c7c7da]">
                  <Check className="h-4 w-4 text-green-400" />
                  <span>All future Pro features</span>
                </li>
              </ul>
            </div>

            {/* Wallet Credit Info */}
            {preview.creditToWallet.unusedBasicCredit > 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  Wallet Credit
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-[#9fa0b8]">
                    <span>Days remaining in billing cycle</span>
                    <span className="text-white">{preview.creditToWallet.daysRemaining} days</span>
                  </div>
                  <div className="border-t border-[#2a2a35] pt-2">
                    <div className="flex justify-between font-semibold">
                      <span className="text-white">Credit to your wallet</span>
                      <span className="text-emerald-400 text-lg">{formatCurrency(preview.creditToWallet.unusedBasicCredit)}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[#9fa0b8] mt-2">
                  Your unused Basic plan balance will be added to your Store Wallet.
                </p>
              </div>
            )}

            {/* Pro Subscription Info */}
            <div className="rounded-lg border border-brand/30 bg-brand/5 p-4">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand" />
                New Pro Subscription
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-[#9fa0b8]">
                  <span>Pro Plan (Monthly)</span>
                  <span className="text-white font-medium">{formatCurrency(preview.targetPlan.amountWithGst)}</span>
                </div>
                <p className="text-xs text-[#9fa0b8]">
                  You&apos;ll be redirected to authorize your new Pro subscription.
                </p>
              </div>
            </div>

            {/* Next Billing Info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0f0f13] border border-[#2a2a35]">
              <Calendar className="h-5 w-5 text-[#9fa0b8]" />
              <div className="text-sm">
                <span className="text-[#9fa0b8]">Next billing on </span>
                <span className="text-white font-medium">{formatDate(preview.nextBillingDate)}</span>
                <span className="text-[#9fa0b8]"> for </span>
                <span className="text-white font-medium">{formatCurrency(preview.nextBillingAmount)}</span>
              </div>
            </div>

            {/* CTA Button */}
            <Button
              onClick={handleUpgrade}
              disabled={upgrading || !preview.canUpgrade}
              className={cn(
                "w-full h-12 text-base font-semibold bg-gradient-to-r from-brand to-[#f59e0b] hover:from-[color:color-mix(in_srgb,var(--brand)_91%,black)] hover:to-[color:color-mix(in_srgb,var(--brand-2)_90%,black)] text-brand-foreground rounded-lg transition-all",
                (upgrading || !preview.canUpgrade) && "opacity-70 cursor-not-allowed"
              )}
            >
              {upgrading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Upgrading...
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5 mr-2" />
                  {preview.creditToWallet.unusedBasicCredit > 0
                    ? `Get ${formatCurrency(preview.creditToWallet.unusedBasicCredit)} Credit & Upgrade`
                    : "Upgrade to Pro"}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>

            <p className="text-xs text-center text-[#6b6b80]">
              Your unused Basic balance will be credited to your wallet.
              You&apos;ll then authorize your new Pro subscription via Razorpay.
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// Hook to check if user can upgrade (is on Basic plan) or downgrade
// (is on Pro plan). Also drives the sidebar plan-switch hyperlink.
export function useCanUpgrade() {
  const [canUpgrade, setCanUpgrade] = useState(false);
  const [canDowngrade, setCanDowngrade] = useState(false);
  const [downgradeScheduledAt, setDowngradeScheduledAt] =
    useState<string | null>(null);
  const [planSlug, setPlanSlug] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTrial, setIsTrial] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  // Where the upgrade CTA points — depends on whether there's a live
  // Basic/Starter sub to credit, or whether this is a fresh purchase.
  const [upgradeHref, setUpgradeHref] = useState("/office-payment");

  useEffect(() => {
    const checkUpgradeStatus = async () => {
      try {
        const token = getToken();
        if (!token) {
          setLoading(false);
          return;
        }

        const tokenPayload = JSON.parse(atob(token.split(".")[1]));

        // Only founders can upgrade
        if (tokenPayload.role !== "founder") {
          setLoading(false);
          return;
        }

        const orgId = localStorage.getItem("garage_org_id") || tokenPayload.orgId;
        if (!orgId) {
          setLoading(false);
          return;
        }

        const response = await api<{
          hasActiveSubscription: boolean;
          canInviteStakeholders: boolean;
          subscription: {
            _id: string;
            status: string;
            planId?: {
              name: string;
              slug: string;
            };
            isTrial?: boolean;
            daysRemaining?: number;
            trialExpired?: boolean;
            // Already returned by /office-subscription/status — needed to
            // tell a paid Pro from a trial or an unpaid one.
            paidCount?: number;
            scheduledDowngrade?: {
              toSlug: "starter";
              effectiveAt: string;
              requestedAt: string | null;
            } | null;
          } | null;
        }>(
          `/office-subscription/status?orgId=${orgId}`,
          {},
          token
        );

        const slug = response.subscription?.planId?.slug || null;
        const name = response.subscription?.planId?.name || null;
        setPlanSlug(slug);
        setPlanName(name);

        // Check trial status
        if (response.subscription?.isTrial) {
          setIsTrial(true);
          setTrialDaysRemaining(response.subscription.daysRemaining ?? null);
        } else {
          setIsTrial(false);
          setTrialDaysRemaining(null);
        }

        // Anyone WITHOUT a paid, active Pro can still pay us — so they get a
        // CTA. The old test was `slug === "basic" || slug === "starter"` AND
        // active, which silently stranded every founder who most needed to
        // pay: no subscription at all (slug null), an unpaid Pro sitting in
        // "created", a "halted" Pro whose payment failed, and all 12 Pro
        // trials with no way to convert. 23 orgs had no button at all.
        //
        // paidCount > 0 is the "have they actually paid for this" test —
        // status alone can't distinguish a live Pro from a trial or an
        // unpaid one.
        const isPaidPro =
          slug === "pro" &&
          ["active", "authenticated"].includes(response.subscription?.status || "") &&
          (response.subscription?.paidCount ?? 0) > 0;
        const isUpgradeSource = !isPaidPro;
        // Can downgrade only from Pro non-trial. And only if a downgrade
        // isn't already scheduled — a scheduled sub shows the pending
        // state instead of the CTA.
        const scheduledDown =
          response.subscription?.scheduledDowngrade?.effectiveAt || null;
        setDowngradeScheduledAt(scheduledDown);

        const isDowngradeSource =
          slug === "pro" &&
          !response.subscription?.isTrial &&
          !scheduledDown;
        const isActive = response.hasActiveSubscription ||
          (response.subscription && ["authenticated", "active", "trial"].includes(response.subscription.status));

        // NOT gated on `isActive`: an inactive/absent subscription is exactly
        // the state that needs a way to pay. Requiring active was why an org
        // with no subscription saw nothing at all.
        setCanUpgrade(isUpgradeSource);
        // Downgrade still requires a live Pro — you can't step down from a
        // plan you aren't on.
        setCanDowngrade(isDowngradeSource && !!isActive);

        // Where the CTA should point. `/upgrade` runs the credit-aware
        // Basic/Starter→Pro flow, but its preview endpoint returns
        // canUpgrade:false ("No active subscription found" / "Already on Pro
        // plan") for everyone else and disables the button — so sending them
        // there would swap a missing button for a broken page.
        // `/office-payment` POSTs /subscribe {planSlug:"pro"} directly and
        // hands back a fresh invoice, which works from any state.
        const hasCreditableSub =
          (slug === "basic" || slug === "starter") && !!isActive;
        setUpgradeHref(hasCreditableSub ? "/upgrade" : "/office-payment");
      } catch (error) {
        console.error("Error checking upgrade status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkUpgradeStatus();

    // Listen for upgrade or downgrade completed events to refresh status
    const handlePlanChange = () => {
      checkUpgradeStatus();
    };
    window.addEventListener("subscription:upgraded", handlePlanChange);
    window.addEventListener("subscription:downgraded", handlePlanChange);

    return () => {
      window.removeEventListener("subscription:upgraded", handlePlanChange);
      window.removeEventListener("subscription:downgraded", handlePlanChange);
    };
  }, []);

  return {
    canUpgrade,
    canDowngrade,
    downgradeScheduledAt,
    planSlug,
    planName,
    loading,
    isTrial,
    trialDaysRemaining,
    upgradeHref,
  };
}
