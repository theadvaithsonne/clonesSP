"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Copy,
  X,
  Share2,
  Check,
  Crown,
  Building2,
  TrendingUp,
  Users,
  AlertCircle,
} from "lucide-react";
import { cn, slugify } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

// Office plans with commission structure
const OFFICE_PLANS = [
  {
    name: "Basic",
    slug: "basic",
    description: "Perfect for solo founders",
    amount: 10, // $10
    features: [
      "Virtual workspace access",
      "Real-time messaging",
      "File storage (Cabinet)",
      "Store & products",
    ],
    isRecommended: false,
  },
  {
    name: "Pro",
    slug: "pro",
    description: "For teams that collaborate",
    amount: 65, // $65
    features: [
      "Everything in Basic",
      "Unlimited stakeholder invites",
      "Team collaboration",
      "Priority support",
    ],
    isRecommended: true,
  },
];

// Commission structure for office subscriptions
const COMMISSION_STRUCTURE = {
  level1: { percentage: 15, label: "Direct Referral" },
  level2: { percentage: 10, label: "Level 2" },
  level3: { percentage: 2.5, label: "Level 3" },
  level4: { percentage: 2.5, label: "Level 4" },
};

interface InviteAlertProps {
  isOpen: boolean;
  onClose: () => void;
  affiliateId: string;
  orgName?: string | null;
  orgSlug?: string | null;
  orgId?: string | null;
}

export function InviteAlert({
  isOpen,
  onClose,
  affiliateId,
  orgName,
  orgSlug,
  orgId,
}: InviteAlertProps) {
  const [copiedPlan, setCopiedPlan] = useState<string | null>(null);
  const [copiedGuest, setCopiedGuest] = useState(false);
  const [guestLimitReached, setGuestLimitReached] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [guestLimit, setGuestLimit] = useState(25);

  // Check guest limit status when modal opens
  useEffect(() => {
    if (!isOpen || !orgId) return;

    async function checkGuestLimit() {
      try {
        const response = await api<{
          ok: boolean;
          guestCount: number;
          guestLimit: number;
          limitReached: boolean;
        }>(`/guest-auth/guest-limit-status?orgId=${orgId}`);

        if (response.ok) {
          setGuestLimitReached(response.limitReached);
          setGuestCount(response.guestCount);
          setGuestLimit(response.guestLimit);
        }
      } catch (err) {
        console.error("Error checking guest limit:", err);
      }
    }

    checkGuestLimit();
  }, [isOpen, orgId]);

  console.log("InviteAlert props:", { isOpen, affiliateId });

  const referralUrl = `${window.location.origin}/login?referCode=${affiliateId}`;

  // Generate guest page URL using slug or slugified org name
  const guestSlug = orgSlug || (orgName ? slugify(orgName) : null);
  const guestPageUrl = guestSlug
    ? `${window.location.origin}/guest/${guestSlug}?referCode=${affiliateId}`
    : null;

  const handleCopyUrl = async (planSlug: string) => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopiedPlan(planSlug);
      toast.success("Referral link copied to clipboard!");

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedPlan(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy link");
    }
  };

  const handleCopyGuestUrl = async () => {
    if (!guestPageUrl) return;
    try {
      await navigator.clipboard.writeText(guestPageUrl);
      setCopiedGuest(true);
      toast.success("Guest page link copied to clipboard!");

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedGuest(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy link");
    }
  };

  // Calculate potential earnings for a plan
  const calculateEarnings = (planAmount: number) => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return {
      level1: round2(
        planAmount * (COMMISSION_STRUCTURE.level1.percentage / 100)
      ),
      level2: round2(
        planAmount * (COMMISSION_STRUCTURE.level2.percentage / 100)
      ),
      level3: round2(
        planAmount * (COMMISSION_STRUCTURE.level3.percentage / 100)
      ),
      level4: round2(
        planAmount * (COMMISSION_STRUCTURE.level4.percentage / 100)
      ),
      total: round2(planAmount * 0.3), // 30% total (15 + 10 + 2.5 + 2.5)
    };
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[700]"
            onClick={onClose}
          />

          {/* Invite Alert */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[750] w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0e0e12]/98 border border-[#2a2a35] backdrop-blur-xl rounded-xl shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#0e0e12]/98 p-4 border-b border-[#2a2a35] z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-2/20 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)]/20 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-brand-2" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Earn with Referrals
                    </h3>
                    <p className="text-sm text-[#9fa0b8]">
                      Invite founders and earn recurring commissions
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-[#1a1a22] hover:bg-[#2a2a35] flex items-center justify-center transition-all duration-200 hover:scale-105"
                >
                  <X className="h-4 w-4 text-[#6a6a7a]" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Commission Structure Overview */}
              <div className="p-4 bg-gradient-to-r from-brand-2/10 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)]/5 border border-brand-2/20 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-brand-2" />
                  <h4 className="text-sm font-semibold text-brand-2">
                    Multi-Level Commission Structure
                  </h4>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(COMMISSION_STRUCTURE).map(([key, value]) => (
                    <div
                      key={key}
                      className="text-center p-2 bg-[#1a1a22]/50 rounded-lg"
                    >
                      <div className="text-lg font-bold text-white">
                        {value.percentage}%
                      </div>
                      <div className="text-xs text-[#9fa0b8]">
                        {value.label}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[#9fa0b8] mt-3">
                  Earn up to 30% commission on every subscription - recurring
                  monthly!
                </p>
              </div>

              {/* Office Plans Grid */}
              <div className="grid md:grid-cols-1 gap-4">
                {OFFICE_PLANS.map((plan) => {
                  const earnings = calculateEarnings(plan.amount);
                  const isCopied = copiedPlan === plan.slug;

                  return (
                    <div
                      key={plan.slug}
                      className={cn(
                        "relative p-5 rounded-xl border-2 transition-all duration-200",
                        "bg-[#0e0e12] hover:bg-[#111116]",
                        plan.isRecommended
                          ? "border-brand-2/50 shadow-[0_0_20px_color-mix(in_srgb,_var(--brand-2)_10%,_transparent)]"
                          : "border-[#2a2a35] hover:border-[#3a3a45]"
                      )}
                    >
                      {/* Recommended badge */}
                      {plan.isRecommended && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="px-3 py-1 bg-brand-2 text-brand-foreground text-xs font-semibold rounded-full flex items-center gap-1">
                            <Crown className="h-3 w-3" />
                            Best Value
                          </span>
                        </div>
                      )}

                      {/* Plan Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-brand-2" />
                                <h4 className="text-lg font-bold text-white">
                                  {plan.name}
                                </h4>
                              </div>
                              <p className="text-sm text-[#6b6b80] mt-0.5">
                                {plan.description}
                              </p>
                            </div>
                          </div>

                          {/* Price */}
                          <div className="mb-4">
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold text-white">
                                ${plan.amount}
                              </span>
                              <span className="text-sm text-[#6b6b80]">
                                /month
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Features */}
                        <div className="space-y-2 mb-4">
                          {plan.features.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              </div>
                              <span className="text-xs text-[#c7c7da]">
                                {feature}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Earnings Breakdown */}
                      <div className="p-3 bg-[#1a1a22] rounded-lg mb-4">
                        <div className="text-xs font-medium text-[#9fa0b8] mb-2">
                          Your Earnings Per Referral
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-[#6b6b80]">
                              Direct (L1 - 15%)
                            </span>
                            <span className="text-emerald-400 font-medium">
                              ${earnings.level1}/mo
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-[#6b6b80]">L2 (10%)</span>
                            <span className="text-emerald-400 font-medium">
                              ${earnings.level2}/mo
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-[#6b6b80]">L3 (2.5%)</span>
                            <span className="text-emerald-400 font-medium">
                              ${earnings.level3}/mo
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-[#6b6b80]">L4 (2.5%)</span>
                            <span className="text-emerald-400 font-medium">
                              ${earnings.level4}/mo
                            </span>
                          </div>
                          <div className="border-t border-[#2a2a35] pt-1.5 mt-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-white font-medium">
                                Total (30%)
                              </span>
                              <span className="text-brand-2 font-bold">
                                ${earnings.total}/mo
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Copy Link Button */}
                      <Button
                        onClick={() => handleCopyUrl(plan.slug)}
                        className={cn(
                          "w-full h-10 transition-all duration-200 font-semibold",
                          isCopied
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                            : "bg-gradient-to-r from-brand-2 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)] hover:from-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] hover:to-[color:color-mix(in_srgb,var(--brand-2)_93%,black)] text-brand-foreground"
                        )}
                      >
                        {isCopied ? (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4" />
                            Copied!
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Copy className="h-4 w-4" />
                            Copy Referral Link
                          </div>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Referral Link Display */}
              {/*
              <div className="p-4 bg-[#1a1a22]/50 border border-[#2a2a35] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Share2 className="h-4 w-4 text-brand-2" />
                  <span className="text-sm font-medium text-white">Your Referral Link</span>
                </div>
                <div className="p-3 bg-[#0e0e12] border border-[#2a2a35] rounded-lg">
                  <code className="text-xs text-[#c7c7da] break-all">
                    {referralUrl}
                  </code>
                </div>
                <p className="text-xs text-[#6a6a7a] mt-2">
                  When someone signs up using your link and subscribes, you earn commissions on their monthly payments.
                </p>
              </div>
*/}
              {/* Guest Page URL */}
              {guestPageUrl && (
                <div className={cn(
                  "p-4 border rounded-lg",
                  guestLimitReached
                    ? "bg-red-500/5 border-red-500/20"
                    : "bg-[#1a1a22]/50 border-[#2a2a35]"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className={cn("h-4 w-4", guestLimitReached ? "text-red-400" : "text-brand-2")} />
                      <span className="text-sm font-medium text-white">
                        Your Office Guest Page
                      </span>
                    </div>
                    {/* Guest count indicator */}
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      guestLimitReached
                        ? "bg-red-500/20 text-red-400"
                        : "bg-[#2a2a35] text-[#9fa0b8]"
                    )}>
                      {guestCount}/{guestLimit} guests
                    </span>
                  </div>

                  {guestLimitReached ? (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-red-300 font-medium">Guest limit reached</p>
                          <p className="text-xs text-red-400/80 mt-1">
                            Your organization has reached the maximum of {guestLimit} guests on the Basic plan.
                            Upgrade to Pro for unlimited guests.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <div className="flex-1 p-3 bg-[#0e0e12] border border-[#2a2a35] rounded-lg">
                          <code className="text-xs text-[#c7c7da] break-all">
                            {guestPageUrl}
                          </code>
                        </div>
                        <Button
                          onClick={handleCopyGuestUrl}
                          size="sm"
                          className={cn(
                            "px-3 bg-gradient-to-r from-brand-2 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)] hover:from-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] hover:to-[color:color-mix(in_srgb,var(--brand-2)_93%,black)] text-brand-foreground font-semibold transition-all duration-200",
                            copiedGuest &&
                              "bg-emerald-500 hover:bg-emerald-600 text-white"
                          )}
                        >
                          {copiedGuest ? (
                            <div className="flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              Copied!
                            </div>
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-[#6a6a7a] mt-2">
                        Share this link with guests to let them view and request to
                        join your HQ.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-[#0e0e12]/98 p-4 border-t border-[#2a2a35]">
              <div className="flex gap-3 justify-end">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="w-fit h-9 border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] hover:border-[#3a3a45] transition-all duration-200 font-medium"
                >
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
