"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getToken, getUserDataFromToken } from "@/lib/auth";
import { ProfilePopover } from "@/components/shared/ProfilePopover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  Crown,
  Sparkles,
  Minus,
  Plus,
  Info,
  Lock,
} from "lucide-react";


// $5/month per extra room. Mirrors CONFERENCE_ROOM_PRICE_CENTS in
// garagenew-backend/src/routes/officeCheckout.ts. When we extract a
// shared pricing module on the BE + a GET endpoint, replace this with
// a fetch + sessionStorage cache.
const CONFERENCE_ROOM_PRICE_USD = 5;

interface OfficePlan {
  _id: string;
  name: string;
  slug: string;
  description: string;
  // All monetary fields are returned by the BE in DOLLARS (not cents).
  // The BE divides cents → dollars in /checkout/office/:orgId before
  // sending, so do NOT divide here again or you'll get $0.96 for a
  // $96 plan.
  amount: number; // BASE amount in dollars
  taxRate: number; // e.g. 18 for 18% GST
  taxInclusive: boolean;
  taxAmount: number; // GST in dollars
  totalAmount: number; // amount + taxAmount, in dollars
  currency: string;
  period: string;
  features: string[];
  canInviteStakeholders: boolean;
  maxStakeholders: number | null;
  isDefault: boolean;
  platformFeeOverride?: number | null;
}

interface Subscription {
  _id: string;
  status: string;
  shortUrl?: string;
  isTrial?: boolean;
  daysRemaining?: number;
  trialEndsAt?: string;
}

function OfficePaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?newOffice=true` mode lands here for users who don't have an org yet;
  // we bounce them to the create-office form first.
  const isNewOffice = searchParams.get("newOffice") === "true";

  const [plans, setPlans] = useState<OfficePlan[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<"starter" | "pro">("pro");
  // Whether GST applies to THIS org (India only). Server-decided.
  const [gstApplies, setGstApplies] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [startingTrial, setStartingTrial] = useState(false);

  // Trial state — for users coming back to convert later.
  const [isOnTrial, setIsOnTrial] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(
    null
  );

  // Room stepper. Starts at 1 (the free included room). Founder can bump
  // it; each extra room is $5/month, billed on a SEPARATE invoice from the
  // office plan and charged from day 1 even though the office is on trial.
  // Rooms are Pro-only; the Starter path skips this entirely.
  const [totalRoomCount, setTotalRoomCount] = useState(1);
  const extraRoomCount = Math.max(0, totalRoomCount - 1);
  const extraRoomsMonthlyUsd = extraRoomCount * CONFERENCE_ROOM_PRICE_USD;

  // Profile gate for the create-office path. A founder-to-be arrives here
  // straight from OTP with nothing on file but an email, and the office they
  // are about to create is billed to that profile — so it gets completed
  // before a plan is picked, not after.
  const [profileUser, setProfileUser] = useState<{
    id: string;
    email: string;
    name?: string;
  } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isNewOffice) return;
    const { userId, email, name } = getUserDataFromToken();
    if (!userId || !email) return;
    setProfileUser({ id: userId, email, name: name || undefined });
    api<{ profileComplete: boolean }>(
      `/profile/status?userId=${userId}`,
      {},
      getToken()!
    )
      .then((res) => setProfileOpen(!res.profileComplete))
      .catch(() => setProfileOpen(true));
  }, [isNewOffice]);

  const fetchPlans = async () => {
    try {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      // No office exists yet in newOffice mode, so the org-scoped route has
      // nothing to read: fall back to the public plan list. GST can't be
      // resolved without a country either — the invoice after create-office
      // quotes the real total.
      if (isNewOffice) {
        const response = await api<{ plans: OfficePlan[] }>(
          "/checkout/office/plans",
        );
        const active = (response.plans || []).filter(
          (p) => p.slug === "pro" || p.slug === "starter",
        );
        active.sort((a, b) =>
          a.slug === "starter" ? -1 : b.slug === "starter" ? 1 : 0,
        );
        setGstApplies(false);
        setPlans(active);
        setSelectedSlug(active.some((p) => p.slug === "pro") ? "pro" : "starter");
        return;
      }

      const tokenPayload = JSON.parse(atob(token.split(".")[1]));
      const currentOrgId = tokenPayload.orgId;

      const response = await api<{
        organization: any;
        subscription: Subscription | null;
        plans: OfficePlan[];
        // GST applies only to orgs in India. The BE resolves this from the
        // org's country and returns plan figures that already reflect it.
        gst?: { applies: boolean; buyerCountry: string | null };
      }>(`/checkout/office/${currentOrgId}`, {}, token);

      setGstApplies(response.gst?.applies ?? true);

      const active = (response.plans || []).filter(
        (p) => p.slug === "pro" || p.slug === "starter",
      );
      // Order: Starter first (free), Pro second (paid). Guarantees the
      // free-tier card leads visually even if the BE returns them in a
      // different order.
      active.sort((a, b) =>
        a.slug === "starter" ? -1 : b.slug === "starter" ? 1 : 0,
      );
      setPlans(active);
      // Default select Pro (higher-value plan) so the existing trial flow
      // stays the happy path for new signups; founder can toggle to
      // Starter explicitly.
      const hasPro = active.some((p) => p.slug === "pro");
      setSelectedSlug(hasPro ? "pro" : "starter");

      if (response.subscription?.status === "trial") {
        setIsOnTrial(true);
        setTrialDaysRemaining(response.subscription.daysRemaining ?? null);
        return;
      }

      // Active paid sub → straight to workspace.
      if (
        !isNewOffice &&
        response.subscription &&
        ["authenticated", "active"].includes(response.subscription.status)
      ) {
        router.push(searchParams.get("redirect") || "/workspace");
        return;
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast.error("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const proPlan = useMemo(
    () => plans.find((p) => p.slug === "pro") || null,
    [plans],
  );
  const starterPlan = useMemo(
    () => plans.find((p) => p.slug === "starter") || null,
    [plans],
  );
  const selectedPlan =
    selectedSlug === "starter" ? starterPlan : proPlan;

  // The "Start Office" submit. Branches by selected plan:
  //   - starter: POST /subscribe { planSlug: "starter" } → straight to
  //              workspace (no invoice / no Razorpay).
  //   - pro: POST /start-trial (legacy URL — no longer a trial) mints a
  //          real $96 Pro invoice + rooms invoice; FE redirects to the Pro
  //          invoice for payment. Pro activates only after payment.
  const handleStart = async () => {
    if (isNewOffice) {
      // Founder hit /office-payment first (via "Launch An Office" / "Create
      // New Office" sidebar). Send them to create-office AND forward the
      // plan they just picked so /organization can auto-subscribe them
      // to that plan right after create — no second trip to this picker.
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }
      const { userId } = JSON.parse(atob(token.split(".")[1]));
      const params = new URLSearchParams({ userId, plan: selectedSlug });
      const redirect = searchParams.get("redirect");
      if (redirect) params.set("redirect", redirect);
      router.push(`/organization?${params.toString()}`);
      return;
    }
    setStartingTrial(true);
    try {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }
      const tokenPayload = JSON.parse(atob(token.split(".")[1]));
      const currentOrgId = tokenPayload.orgId;

      if (selectedSlug === "starter") {
        const response = await api<{
          success: boolean;
          requiresPayment: boolean;
          invoiceId?: string;
        }>(
          `/checkout/office/${currentOrgId}/subscribe`,
          {
            method: "POST",
            body: JSON.stringify({ planSlug: "starter" }),
          },
          token,
        );
        if (response.success) {
          toast.success(
            "Starters Offer activated — you're all set.",
          );
          router.push(searchParams.get("redirect") || "/workspace");
        }
        return;
      }

      // Pro — no trial. Bootstraps a pending subscription + real recurring
      // Pro invoice ($96 + GST) + optional rooms invoice. Founder pays the
      // Pro invoice first to activate; rooms invoice follows.
      const response = await api<{
        success: boolean;
        officeInvoiceId: string | null;
        roomsInvoiceId: string | null;
        subscription: {
          _id: string;
          status: string;
        };
      }>(
        `/checkout/office/${currentOrgId}/start-trial`,
        {
          method: "POST",
          body: JSON.stringify({
            planSlug: "pro",
            totalRoomCount,
          }),
        },
        token
      );

      if (response.success) {
        // Prefer the office invoice — that's the one that activates access.
        // Rooms invoice waits until after Pro is paid.
        const nextInvoiceId = response.officeInvoiceId || response.roomsInvoiceId;
        if (nextInvoiceId) {
          toast.success(
            "Almost there — complete payment to activate your office.",
          );
          // Carry the funnel's destination across the payment step. Without
          // this a founder who came here to buy whitelabel pays for the office
          // and lands on a bare workspace, with nothing to say why they came.
          const redirect = searchParams.get("redirect");
          router.push(
            redirect
              ? `/invoice/${nextInvoiceId}?redirect=${encodeURIComponent(redirect)}`
              : `/invoice/${nextInvoiceId}`,
          );
        } else {
          // Both invoice creations failed — surface an error rather than
          // silently sending the founder to workspace they can't access.
          toast.error("Could not create invoice. Please try again.");
        }
        return;
      }

    } catch (error: any) {
      console.error("Error starting office:", error);
      toast.error(error.message || "Failed to start your office");
    } finally {
      setStartingTrial(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  // BE returns prices in DOLLARS (already divided by 100 server-side).
  // Just pass through — dividing again gives the $0.96-for-$96 bug.
  const proBaseUsd = proPlan?.amount ?? 0;
  const proTaxUsd = proPlan?.taxAmount ?? 0;
  const proTotalUsd = proPlan?.totalAmount ?? 0;

  // Order-summary math. We mirror the BE's tax shape (`taxAmount` is
  // computed as `base × taxRate%` and added on top of base) so the
  // founder sees the same numbers here as on the invoice that lands
  // post-submit. Rooms get the same taxRate AND the same applicability as
  // the office plan — the BE bills both lines off one org-region decision,
  // so a foreign org must not see GST added to rooms here either.
  const taxRate = proPlan?.taxRate ?? 0;
  const extraRoomsTaxUsd = gstApplies
    ? Math.round(((extraRoomsMonthlyUsd * taxRate) / 100) * 100) / 100
    : 0;
  const extraRoomsTotalUsd =
    Math.round((extraRoomsMonthlyUsd + extraRoomsTaxUsd) * 100) / 100;

  const orderSummary = useMemo(() => {
    return {
      // First 60 days: office trial covers the office plan only. Rooms
      // (if any) still get charged from day 1.
      officeTrialBaseUsd: 0,
      officeTrialTaxUsd: 0,
      officeTrialTotalUsd: 0,
      dueTodaySubtotalUsd: extraRoomsMonthlyUsd,
      dueTodayTaxUsd: extraRoomsTaxUsd,
      dueTodayTotalUsd: extraRoomsTotalUsd,
      // Starting day 61: office + rooms, both with GST when the org is in
      // India, both without when it isn't.
      monthlySubtotalUsd: proBaseUsd + extraRoomsMonthlyUsd,
      monthlyTaxUsd:
        Math.round((proTaxUsd + extraRoomsTaxUsd) * 100) / 100,
      monthlyTotalUsd:
        Math.round((proTotalUsd + extraRoomsTotalUsd) * 100) / 100,
    };
  }, [
    proBaseUsd,
    proTaxUsd,
    proTotalUsd,
    extraRoomsMonthlyUsd,
    extraRoomsTaxUsd,
    extraRoomsTotalUsd,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-2" />
      </div>
    );
  }

  const starterFeeOverride = starterPlan?.platformFeeOverride ?? 10;

  return (
    <div className="relative min-h-screen w-full bg-[#0b0b0d] flex items-center justify-center p-4 overflow-hidden">
      {profileUser && (
        <ProfilePopover
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={profileUser}
          isFirstTimeUser
          onProfileComplete={() => setProfileOpen(false)}
        />
      )}

      {/* Glassmorphic background — mirrors select-organization */}
      <style>{`
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0); opacity: 0.2; }
          50% { transform: translateY(-20px); opacity: 0.8; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_30%_20%,color-mix(in_srgb,_var(--brand-2)_25%,_transparent),transparent_50%),radial-gradient(600px_300px_at_70%_80%,rgba(255,183,32,0.2),transparent_60%),radial-gradient(400px_200px_at_50%_50%,rgba(255,193,7,0.15),transparent_70%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60" />
        {/* Floating particles */}
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
          <h1 className="text-[17px] font-semibold text-white">Create Office</h1>
          <button
            onClick={handleGoBack}
            className="bg-[#1a1a22] border border-[#2a2a35] text-white hover:bg-[#2a2a35] h-8 px-4 rounded-lg font-semibold text-xs transition-colors"
          >
            Back
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 animate-in fade-in duration-300" style={{ scrollbarWidth: "none" }}>
          {/* Legacy-trial banner: still surfaced for orgs whose subscription
              predates the trial removal. New signups never hit this. */}
          {isOnTrial && trialDaysRemaining !== null && (
            <div className="rounded-xl border border-brand-2/30 bg-brand-2/5 p-4 flex items-start gap-3">
              <Crown className="w-5 h-5 text-brand-2 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-white">
                  You're on a Pro trial — {trialDaysRemaining} days remaining.
                </div>
                <div className="text-xs text-[#9fa0b8] mt-0.5">
                  Trial covers the Pro office plan. Extra conference rooms are
                  billed separately.
                </div>
              </div>
            </div>
          )}

          {/* Two-plan chooser */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Starter card */}
            <button
              type="button"
              onClick={() => setSelectedSlug("starter")}
              className={cn(
                "text-left rounded-2xl border p-4 transition-all",
                selectedSlug === "starter"
                  ? "border-emerald-500/60 bg-gradient-to-br from-emerald-500/5 to-transparent shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
                  : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a4a]",
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    Free forever
                  </div>
                  <div className="text-lg font-semibold text-white">
                    {starterPlan?.name || "Starters Offer"}
                  </div>
                </div>
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 shrink-0 mt-1",
                    selectedSlug === "starter"
                      ? "border-emerald-400 bg-emerald-400"
                      : "border-[#3a3a4a]",
                  )}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 mb-2">
                <span className="text-2xl font-bold text-white">$0</span>
                <span className="text-xs text-[#9fa0b8]">/month</span>
                {/* The free office is only available to members who hold the
                    licence; the (onboarding) layout and the backend both
                    enforce it, this just says so up front. */}
                <span className="ml-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                  <Lock className="w-2.5 h-2.5" />
                  Requires 1Network $25 License
                </span>
              </div>
              <div className="text-[11px] text-[#c7c7da] leading-snug space-y-1">
                <div>
                  {starterFeeOverride}% platform fee on your sales.
                </div>
                <div className="text-[#9fa0b8] flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  BackOffice tab locked
                </div>
              </div>
            </button>

            {/* Pro card */}
            <button
              type="button"
              onClick={() => setSelectedSlug("pro")}
              className={cn(
                "text-left rounded-2xl border p-4 transition-all relative overflow-hidden",
                selectedSlug === "pro"
                  ? "border-brand-2/60 bg-gradient-to-br from-brand-2/8 to-transparent shadow-[0_0_0_1px_color-mix(in_srgb,_var(--brand-2)_35%,_transparent)]"
                  : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a4a]",
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-2">
                    Full features
                  </div>
                  <div className="text-lg font-semibold text-white">
                    {proPlan?.name || "Founders Office"}
                  </div>
                </div>
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 shrink-0 mt-1",
                    selectedSlug === "pro"
                      ? "border-brand-2 bg-brand-2"
                      : "border-[#3a3a4a]",
                  )}
                />
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl font-bold text-white">
                  ${proBaseUsd.toFixed(0)}
                </span>
                <span className="text-xs text-[#9fa0b8]">/month</span>
              </div>
              <div className="text-[11px] text-[#c7c7da] leading-snug space-y-1">
                <div>5% platform fee on your sales.</div>
                <div className="text-[#9fa0b8]">
                  Includes BackOffice + conference rooms.
                </div>
              </div>
            </button>
          </div>

          {selectedSlug === "starter" ? (
            /* Starter: single explanatory card, no room stepper, no billing summary */
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent p-5">
              <div className="flex items-baseline gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  What's included
                </h3>
              </div>
              <ul className="space-y-2 mb-5">
                {(starterPlan?.features || []).map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-[#c7c7da]"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
                <li className="flex items-start gap-2 text-sm text-[#9fa0b8] pt-1 border-t border-[#2a2a35]">
                  <Lock className="w-3.5 h-3.5 text-[#9fa0b8] shrink-0 mt-0.5" />
                  <span>
                    BackOffice locked — upgrade to {proPlan?.name || "Pro"} to unlock.
                  </span>
                </li>
              </ul>
              <div className="rounded-xl bg-black/40 border border-[#2a2a35] p-3.5 flex items-start gap-2 text-xs text-[#c7c7da]">
                <Info className="w-3.5 h-3.5 text-emerald-400/80 shrink-0 mt-0.5" />
                <span>
                  Your team pays $0/month. In exchange, Garage takes a{" "}
                  <span className="text-white font-medium">
                    {starterFeeOverride}% platform fee
                  </span>{" "}
                  on every sale (courses, products, workshops, etc.) instead of
                  the 5% we charge on Pro. You can upgrade to Pro anytime.
                  <span className="block mt-1.5 text-brand">
                    Free offices are only available once you have activated the
                    1Network $25 License.
                  </span>
                </span>
              </div>
            </div>
          ) : (
            /* Pro: existing rooms + billing summary flow */
            <>
              {/* Plan card — Pro details */}
              <div className="rounded-2xl border border-brand-2/40 bg-gradient-to-br from-[#0e0e12] to-[#1a1a22] p-5 md:p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 px-3 py-1 bg-brand-2 text-brand-foreground text-[10px] font-semibold uppercase tracking-wider rounded-bl-lg">
                  Founders Office
                </div>

                <div className="flex items-baseline gap-3 mb-1">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {proPlan?.name || "Founders Office"}
                  </h2>
                </div>
                <p className="text-sm text-[#9fa0b8] mb-5">
                  {proPlan?.description ||
                    "Scale your team — unlimited everything"}
                </p>

                {/* Pricing block — Pro bills from day 1. */}
                <div className="rounded-xl bg-black/40 border border-[#2a2a35] p-4 mb-5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-4xl font-bold text-white tracking-tight tabular-nums">
                      ${proBaseUsd.toFixed(0)}
                    </span>
                    <span className="text-sm text-[#c7c7da]">/month</span>
                    {proPlan && proTaxUsd > 0 && (
                      <span className="text-[#6b6b80] text-xs">
                        + ${proTaxUsd.toFixed(2)} GST
                      </span>
                    )}
                  </div>
                  {proPlan && proTaxUsd > 0 && (
                    <div className="mt-2 text-[11px] text-[#9fa0b8] tabular-nums">
                      Total <span className="text-white font-medium">${proTotalUsd.toFixed(2)}</span>/month
                    </div>
                  )}
                </div>

                {/* Feature list */}
                {proPlan?.features && proPlan.features.length > 0 && (
                  <ul className="space-y-2 mb-5">
                    {proPlan.features.slice(0, 6).map((f, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-[#c7c7da]"
                      >
                        <Check className="w-3.5 h-3.5 text-brand-2 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Conference rooms picker — DISABLED during office creation.
                  Founders start with the 1 included free room and can add
                  extras from the workspace later via POST /conference-rooms
                  (which mints its own prorated invoice on the fly).
                  `totalRoomCount` state stays at its initial `1`, so
                  `extraRoomCount` is always 0 below → the billing summary
                  automatically hides every room-related row without further
                  edits, and `handleStart` sends `totalRoomCount: 1` (no
                  rooms invoice minted server-side).
                  TODO re-enable rooms billing: restore the block below. */}
              {/*
              <div className="rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-5 md:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Conference Rooms
                    </h3>
                    <p className="text-xs text-[#9fa0b8] mt-0.5">
                      1 room included free with your office.
                    </p>
                  </div>
                  <div className="flex items-center rounded-lg border border-[#2a2a35] bg-[#1a1a22] overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setTotalRoomCount((c) => Math.max(1, c - 1))
                      }
                      disabled={totalRoomCount <= 1 || startingTrial}
                      className="w-9 h-9 flex items-center justify-center text-white disabled:text-[#6b6b80] disabled:cursor-not-allowed hover:bg-[#2a2a35] transition-colors bg-transparent border-none outline-none"
                      aria-label="Decrease rooms"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-12 h-9 flex items-center justify-center text-sm text-white border-x border-[#2a2a35] tabular-nums">
                      {totalRoomCount}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTotalRoomCount((c) => c + 1)}
                      disabled={startingTrial}
                      className="w-9 h-9 flex items-center justify-center text-white disabled:text-[#6b6b80] disabled:cursor-not-allowed hover:bg-[#2a2a35] transition-colors bg-transparent border-none outline-none"
                      aria-label="Increase rooms"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {extraRoomCount > 0 && (
                  <div className="rounded-xl bg-black/40 border border-[#2a2a35] p-3.5 space-y-2">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-[#9fa0b8]">
                        +{extraRoomCount} extra room{extraRoomCount > 1 ? "s" : ""}
                        <span className="text-[#6b6b80] ml-1.5">
                          × ${CONFERENCE_ROOM_PRICE_USD}/mo
                        </span>
                      </span>
                      <span className="text-white font-semibold tabular-nums">
                        ${extraRoomsMonthlyUsd}/mo
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[10px] text-[#6b6b80] leading-snug pt-1.5 border-t border-[#2a2a35]">
                      <Info className="w-3 h-3 text-brand-2/70 shrink-0 mt-0.5" />
                      <span>
                        Extra conference rooms are billed on a separate
                        invoice from the office plan.
                      </span>
                    </div>
                  </div>
                )}
              </div>
              */}

              {/* Order summary — Pro bills from day 1, single "Due today"
                  block combining plan + rooms + GST. */}
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
                          {proPlan?.name || "Founders Office"}
                        </span>
                        <span className="text-[10px] text-[#6b6b80] uppercase tracking-wider">
                          office
                        </span>
                      </div>
                      <span className="text-white font-medium tabular-nums">
                        ${proBaseUsd.toFixed(2)}
                      </span>
                    </div>

                    {extraRoomCount > 0 && (
                      <div className="flex items-baseline justify-between text-sm">
                        <div className="flex items-baseline gap-2">
                          <span className="text-white">
                            {extraRoomCount} × Conference Room
                          </span>
                          <span className="text-[10px] text-[#6b6b80] uppercase tracking-wider">
                            add-on
                          </span>
                        </div>
                        <span className="text-white font-medium tabular-nums">
                          ${extraRoomsMonthlyUsd.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {orderSummary.monthlyTaxUsd > 0 && (
                      <>
                        <div className="flex items-baseline justify-between text-xs pt-2 border-t border-[#2a2a35]">
                          <span className="text-[#9fa0b8]">Subtotal</span>
                          <span className="text-[#c7c7da] tabular-nums">
                            ${orderSummary.monthlySubtotalUsd.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-[#9fa0b8]">
                            GST ({proPlan?.taxRate ?? 0}%)
                          </span>
                          <span className="text-[#c7c7da] tabular-nums">
                            ${orderSummary.monthlyTaxUsd.toFixed(2)}
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
                        ${orderSummary.monthlyTotalUsd.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-[#6b6b80] mt-0.5">
                        /month {orderSummary.monthlyTaxUsd > 0 ? "(GST included)" : ""}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-[#6b6b80] leading-relaxed px-1 pt-1">
                  {extraRoomCount > 0
                    ? "Office plan and conference rooms bill on separate invoices. Pay by card, UPI, wallet, or crypto. Cancel anytime."
                    : "Pay by card, UPI, wallet, or crypto. Cancel anytime."}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="shrink-0 flex items-center justify-end border-t border-[#2a2a35] px-6 py-4 bg-[#0e0e12] rounded-b-2xl">
          <Button
            onClick={handleStart}
            disabled={startingTrial || !selectedPlan}
            className={cn(
              "bg-brand text-brand-foreground font-semibold hover:bg-[#fde047] transition-colors px-6 h-10 rounded-lg text-sm",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {startingTrial ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {selectedSlug === "starter" ? "Activating…" : "Preparing…"}
              </>
            ) : selectedSlug === "starter" ? (
              "Activate Free Plan"
            ) : (
              "Continue to payment"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OfficePaymentPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-black" />}
    >
      <OfficePaymentPageContent />
    </Suspense>
  );
}
