"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Settings,
  Calendar,
  UserPlus,
  Clock,
  Sparkles,
  Palette,
  Crown,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Save,
  Globe,
  Tag,
  UserRoundCog,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/auth";
import { notifyBrandingChanged } from "@/lib/brand-color-context";
import { toast } from "sonner";
import FounderLeaveDashboard from "./FounderLeaveDashboard";
import InvitesPage from "./InviteePage";
import PendingRequestsPage from "./PendingRequestsPage";
import AIProvidersPage from "./AIProvidersPage";
import OpenClawAgentPage from "./OpenClawAgentPage";
import FounderCouponsPage from "./FounderCouponsPage";
import FounderPlatformCouponsPage from "./FounderPlatformCouponsPage";
import DomainManagementPage from "./DomainManagementPage";
import {
  fetchWhitelabelStatus,
  type WhitelabelStatusResponse,
} from "@/lib/whitelabel-addon-api";
import WhitelabelGate from "./WhitelabelGate";
import TeamAccessPage from "./teamAccess/TeamAccessPage";
import FounderGuestsPage from "./FounderGuestsPage";
import { CouponInput, AppliedCoupon } from "@/components/ui/coupon-input";

// Preset color options for quick selection
const PRESET_COLORS = [
  { name: "Garage Yellow", value: "#FBD10D" },
  { name: "Ocean Blue", value: "#3B82F6" },
  { name: "Emerald", value: "#10B981" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Orange", value: "#F97316" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Indigo", value: "#6366F1" },
];

type ManagementTab =
  | "leave"
  | "invitees"
  | "pending-requests"
  | "guests"
  // | "ai-providers"
  // | "my-ai-agent"
  | "coupons"
  | "domain"
  | "branding"
  | "team-access";

const TABS: { id: ManagementTab; label: string; icon: React.ReactNode }[] = [
  // {
  //   id: "leave",
  //   label: "Leave Management",
  //   icon: <Calendar className="h-4 w-4" />,
  // },
  { id: "invitees", label: "Invitees", icon: <UserPlus className="h-4 w-4" /> },
  {
    id: "team-access",
    label: "Team & Access",
    icon: <UserRoundCog className="h-4 w-4" />,
  },
  {
    id: "pending-requests",
    label: "Pending Requests",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    id: "guests",
    label: "Guests",
    icon: <UserCheck className="h-4 w-4" />,
  },
  // {
  //   id: "ai-providers",
  //   label: "AI Providers",
  //   icon: <Sparkles className="h-4 w-4" />,
  // },
  // {
  //   id: "my-ai-agent",
  //   label: "My Ai Employees",
  //   icon: <Sparkles className="h-4 w-4" />,
  // },
  { id: "coupons", label: "Coupons", icon: <Tag className="h-4 w-4" /> },
  {
    id: "domain",
    label: "Domain Management",
    icon: <Globe className="h-4 w-4" />,
  },
  {
    id: "branding",
    label: "Branding",
    icon: <Palette className="h-4 w-4" />,
  },
];

// Interface for addon status from API
interface AddonStatus {
  _id: string;
  name: string;
  slug: string;
  description: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  period: string;
  features: string[];
  subscription: {
    _id: string;
    status: string;
    currentStart?: string;
    currentEnd?: string;
    chargeAt?: string;
    paidCount: number;
    shortUrl?: string;
    razorpaySubscriptionId: string;
    createdAt: string;
  } | null;
  isActive: boolean;
}

function BrandingPage() {
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [hasOfficeSubscription, setHasOfficeSubscription] = useState(false);
  const [whiteLabelAddon, setWhiteLabelAddon] = useState<AddonStatus | null>(
    null
  );
  // Branding state
  const [primaryColor, setPrimaryColor] = useState("#FBD10D");
  // Second brand colour. Real surfaces use it — the login button is a
  // primary→secondary gradient — so without it a branded site fades into
  // Garage yellow.
  const [secondaryColor, setSecondaryColor] = useState("#FBA70A");
  const [savedSecondary, setSavedSecondary] = useState("#FBA70A");
  const [savedColor, setSavedColor] = useState("#FBD10D");
  /**
   * Invoice-based white-label access — the same source Domains uses.
   *
   * This page previously read the older Razorpay addon flag, so an org
   * whose white-label invoice had lapsed could still edit colours here
   * while the Domains tab correctly told them to purchase. One source
   * of truth avoids the two disagreeing.
   */
  const [wlStatus, setWlStatus] = useState<WhitelabelStatusResponse | null>(
    null
  );
  const [wlStatusLoading, setWlStatusLoading] = useState(true);
  const [savingColor, setSavingColor] = useState(false);
  // Coupon state
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  // Fetch addon status
  const fetchAddonStatus = async (shouldSync = false) => {
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const orgId = localStorage.getItem("garage_org_id");

      if (!orgId) {
        setLoading(false);
        return;
      }

      // If shouldSync is true, sync with Razorpay first (for dev when webhooks don't work)
      if (shouldSync) {
        try {
          await fetch(`${apiUrl}/checkout/office-addon/${orgId}/sync`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (syncErr) {
          console.error("Error syncing addon status:", syncErr);
        }
      }

      const response = await fetch(
        `${apiUrl}/checkout/office-addon/${orgId}/status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch addon status");
      }

      const data = await response.json();
      setHasOfficeSubscription(data.hasOfficeSubscription);

      // Find white-label addon
      const whiteLabel = data.addons?.find(
        (addon: AddonStatus) => addon.slug === "white-label"
      );
      setWhiteLabelAddon(whiteLabel || null);
    } catch (err) {
      console.error("Error fetching addon status:", err);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to white-label addon
  const handleSubscribe = async () => {
    try {
      setSubscribing(true);
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const orgId = localStorage.getItem("garage_org_id");

      if (!orgId) {
        toast.error("Organization not found");
        return;
      }

      const response = await fetch(
        `${apiUrl}/checkout/office-addon/${orgId}/subscribe`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            addonSlug: "white-label",
            couponCode: appliedCoupon?.code || undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create subscription");
      }

      const data = await response.json();

      // Open Razorpay hosted page in new tab
      if (data.subscription?.shortUrl) {
        window.open(data.subscription.shortUrl, "_blank");
        toast.success("Complete your payment in the new tab");

        // Refresh status after a delay (user might come back)
        setTimeout(() => {
          fetchAddonStatus();
        }, 5000);
      }
    } catch (err: any) {
      console.error("Error subscribing:", err);
      toast.error(err.message || "Failed to subscribe");
    } finally {
      setSubscribing(false);
    }
  };

  // Fetch branding settings
  const fetchBranding = async () => {
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const orgId = localStorage.getItem("garage_org_id");

      if (!orgId) return;

      const response = await fetch(`${apiUrl}/org/${orgId}/branding`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const color = data.branding?.primaryColor || "#FBD10D";
        const second =
          data.branding?.secondaryColor || data.branding?.primaryColor || "#FBA70A";
        setSecondaryColor(second);
        setSavedSecondary(second);
        setPrimaryColor(color);
        setSavedColor(color);
      }
    } catch (err) {
      console.error("Error fetching branding:", err);
    }
  };

  // Save primary color
  const handleSaveColor = async () => {
    try {
      setSavingColor(true);
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const orgId = localStorage.getItem("garage_org_id");

      if (!orgId) {
        toast.error("Organization not found");
        return;
      }

      const response = await fetch(`${apiUrl}/org/${orgId}/branding`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ primaryColor, secondaryColor }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save branding");
      }

      setSavedColor(primaryColor);
      setSavedSecondary(secondaryColor);
      // Repaint the chrome (tab bar, sidebars, right panel) straight away
      // rather than leaving the old accent until the next reload.
      notifyBrandingChanged(orgId);
      toast.success("Primary color saved successfully");
    } catch (err: any) {
      console.error("Error saving branding:", err);
      toast.error(err.message || "Failed to save branding");
    } finally {
      setSavingColor(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchAddonStatus();
  }, []);

  // Fetch branding settings on mount (always available now)
  useEffect(() => {
    fetchBranding();
  }, []);

  const loadWhitelabelStatus = async () => {
    setWlStatusLoading(true);
    try {
      setWlStatus(await fetchWhitelabelStatus());
    } catch {
      // Treat a failed check as no access: better to show the purchase
      // prompt than to let someone edit branding they may not be paying for.
      setWlStatus({ success: true, hasAccess: false });
    } finally {
      setWlStatusLoading(false);
    }
  };

  useEffect(() => {
    loadWhitelabelStatus();
  }, []);

  // Listen for window focus to refresh status (e.g., after returning from Razorpay)
  useEffect(() => {
    const handleFocus = () => {
      // Only refresh and sync if we have a pending subscription
      if (
        whiteLabelAddon?.subscription?.status === "created" ||
        whiteLabelAddon?.subscription?.status === "authenticated"
      ) {
        setLoading(true);
        // Pass true to sync with Razorpay (needed when webhooks don't fire in dev)
        fetchAddonStatus(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [whiteLabelAddon?.subscription?.status]);

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Loader2 className="h-8 w-8 text-brand animate-spin" />
        <p className="text-[#6b6b80] text-sm mt-3">Loading...</p>
      </div>
    );
  }

  // Check if white-label is active
  const isWhiteLabelActive = whiteLabelAddon?.isActive;

  // Track if color has changed
  const hasColorChanged =
    primaryColor !== savedColor || secondaryColor !== savedSecondary;

  // Check if there's a pending subscription
  const hasPendingSubscription =
    whiteLabelAddon?.subscription &&
    ["created", "authenticated"].includes(whiteLabelAddon.subscription.status);

  // Render the upgrade banner for white-label tab
  const renderUpgradeBanner = () => (
    <div className="max-w-2xl mx-auto">
      {/* No office subscription warning */}
      {!hasOfficeSubscription && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-400">
            You need an active office plan (Basic or Pro) to purchase add-ons.
          </p>
        </div>
      )}

      {/* Upgrade banner - Modern design */}
      <div className="relative rounded-2xl overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a22] via-[#0e0e12] to-[#0a0a0c]" />

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-brand/10 via-brand/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-brand/5 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />

        {/* Border glow effect */}
        <div className="absolute inset-0 rounded-2xl border border-brand/10" />

        <div className="relative p-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span className="text-xs font-medium text-brand">
              Premium Add-on
            </span>
          </div>

          {/* Header */}
          <div className="flex items-start gap-4 mb-8">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/20 shadow-lg shadow-brand/5">
              <Crown className="h-8 w-8 text-brand" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Go White-Label
              </h2>
              <p className="text-[#9fa0b8]">
                Make your office truly yours — remove all Garage branding
              </p>
            </div>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {whiteLabelAddon?.features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5"
              >
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand" />
                </div>
                <span className="text-sm text-[#c4c4d4]">{feature}</span>
              </div>
            ))}
          </div>

          {/* Coupon Input */}
          {hasOfficeSubscription && whiteLabelAddon && !isWhiteLabelActive && !hasPendingSubscription && (
            <div className="mb-6">
              <CouponInput
                itemType="office_addon"
                itemId={whiteLabelAddon._id || "white-label"}
                amount={Math.round((whiteLabelAddon.amount || 299) * 100)}
                currency="USD"
                onCouponApplied={(coupon) => setAppliedCoupon(coupon)}
                onCouponRemoved={() => setAppliedCoupon(null)}
                disabled={subscribing}
              />
            </div>
          )}

          {/* Pricing and CTA */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 pt-6 border-t border-white/5">
            <div>
              <div className="flex items-baseline gap-2">
                {appliedCoupon ? (
                  <>
                    <span className="text-2xl font-bold text-[#6b6b80] line-through">
                      {whiteLabelAddon
                        ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(whiteLabelAddon.amount)
                        : "$299"}
                    </span>
                    <span className="text-4xl font-bold text-brand">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(appliedCoupon.finalAmount / 100)}
                    </span>
                  </>
                ) : (
                  <span className="text-4xl font-bold text-white">
                    {whiteLabelAddon
                      ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(whiteLabelAddon.amount)
                      : "$299"}
                  </span>
                )}
                <span className="text-[#6b6b80] text-base">/year</span>
              </div>
              <p className="text-xs text-[#6b6b80] mt-1">
                + {whiteLabelAddon?.taxRate || 18}% GST
              </p>
              {appliedCoupon && (
                <p className="text-xs text-green-400 mt-1">
                  {appliedCoupon.discountValue}% off with code {appliedCoupon.code}
                </p>
              )}
            </div>

            {/* CTA Button */}
            <div className="flex-shrink-0">
              {hasPendingSubscription ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-400">
                      Payment pending — complete to activate
                    </p>
                  </div>
                  <Button
                    onClick={() =>
                      window.open(
                        whiteLabelAddon?.subscription?.shortUrl,
                        "_blank"
                      )
                    }
                    className="w-full sm:w-auto bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground font-semibold h-12 px-8 rounded-xl shadow-lg shadow-brand/20 transition-all hover:shadow-brand/30 hover:scale-[1.02]"
                    disabled={!whiteLabelAddon?.subscription?.shortUrl}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Complete Payment
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleSubscribe}
                  disabled={!hasOfficeSubscription || subscribing}
                  className="w-full sm:w-auto bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground font-semibold h-12 px-8 rounded-xl shadow-lg shadow-brand/20 transition-all hover:shadow-brand/30 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100"
                >
                  {subscribing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade Now
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {!hasOfficeSubscription && (
            <p className="text-xs text-[#6b6b80] text-center mt-4">
              Requires an active office subscription (Basic or Pro)
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // Always show the tabs layout
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg border border-white/10"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <Crown className="h-4 w-4" style={{ color: primaryColor }} />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Branding</h2>
            </div>
          </div>
        </div>

        {/*
          Renewal line only. The access gate itself lives in
          WhitelabelGate one level up: an org without the add-on never
          reaches this page, it gets the WhitelabelPage pitch instead.
        */}
        {wlStatusLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#9fa0b8]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking whitelabel access…
          </div>
        ) : (
          wlStatus?.currentEnd && (
            <div className="flex items-center gap-2 text-xs text-[#9fa0b8]">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Whitelabel active — renews{" "}
              {new Date(wlStatus.currentEnd).toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          )
        )}

        {/* Color Content */}
        <div
          className={cn(
            "grid grid-cols-1 lg:grid-cols-3 gap-5",
            // Lapsed access: readable, but not editable.
            !wlStatusLoading &&
              !wlStatus?.hasAccess &&
              "opacity-50 pointer-events-none select-none"
          )}
          aria-disabled={!wlStatusLoading && !wlStatus?.hasAccess}
        >
          {/* Color Picker Card */}
          <div className="lg:col-span-2 bg-[#0e0e12] rounded-xl border border-[#1a1a22] p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-medium text-white">
                  Primary Color
                </h3>
                <p className="text-xs text-[#6b6b80] mt-0.5">
                  This color will be used throughout your branded experience
                </p>
              </div>
              <Button
                onClick={handleSaveColor}
                // pointer-events are already off on the wrapper; this also
                // blocks keyboard activation when access has lapsed.
                disabled={
                  !hasColorChanged || savingColor || !wlStatus?.hasAccess
                }
                size="sm"
                className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] text-brand-foreground font-medium h-8 px-4 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingColor ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {hasColorChanged ? "Save" : "Saved"}
                  </>
                )}
              </Button>
            </div>

            {/* Primary label — the two pickers now need telling apart. */}
            <p className="mb-2 text-[11px] uppercase tracking-wide text-[#6a6a7a]">
              Primary colour
            </p>

            {/* Color Selection Row */}
            <div className="flex items-start gap-5">
              {/* Color Picker & Input */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-[#2a2a35] bg-transparent"
                    style={{ padding: "2px" }}
                  />
                </div>
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                      setPrimaryColor(value);
                    }
                  }}
                  placeholder="#FBD10D"
                  className="w-24 h-12 px-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white font-mono text-sm focus:outline-none focus:border-[#3b3b4a] uppercase"
                  maxLength={7}
                />
              </div>

              {/* Preset Colors */}
              <div className="flex-1">
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setPrimaryColor(preset.value)}
                      className={cn(
                        "w-10 h-10 rounded-lg border-2 transition-all hover:scale-110",
                        primaryColor === preset.value
                          ? "border-white shadow-lg ring-2 ring-white/20"
                          : "border-transparent hover:border-white/30"
                      )}
                      style={{ backgroundColor: preset.value }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/*
              Secondary colour. Not decorative: surfaces such as the login
              button render a primary→secondary gradient, so an office that
              sets only a primary previously faded into Garage yellow.
              Defaults to the primary, which makes those gradients read as a
              flat fill for single-colour brands.
            */}
            <p className="mt-5 mb-2 text-[11px] uppercase tracking-wide text-[#6a6a7a]">
              Secondary colour
            </p>
            <div className="flex items-start gap-5">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-12 h-12 rounded-lg cursor-pointer border border-[#2a2a35] bg-transparent"
                  style={{ padding: "2px" }}
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                      setSecondaryColor(value);
                    }
                  }}
                  placeholder="#FBA70A"
                  className="w-24 h-12 px-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white font-mono text-sm focus:outline-none focus:border-[#3b3b4a] uppercase"
                  maxLength={7}
                />
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={`secondary-${preset.value}`}
                      onClick={() => setSecondaryColor(preset.value)}
                      className={cn(
                        "w-10 h-10 rounded-lg border-2 transition-all hover:scale-110",
                        secondaryColor === preset.value
                          ? "border-white shadow-lg ring-2 ring-white/20"
                          : "border-transparent hover:border-white/30"
                      )}
                      style={{ backgroundColor: preset.value }}
                      title={preset.name}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setSecondaryColor(primaryColor)}
                  className="mt-2 text-[11px] text-[#6a6a7a] underline hover:text-white"
                >
                  Match primary
                </button>
              </div>
            </div>
          </div>

          {/* Preview Card */}
          <div className="bg-[#0e0e12] rounded-xl border border-[#1a1a22] p-5">
            <h3 className="text-sm font-medium text-white mb-3">Preview</h3>
            <div className="space-y-3">
              {/* Color Swatch */}
              <div
                className="h-20 rounded-lg flex items-center justify-center transition-colors"
                style={{ backgroundColor: primaryColor }}
              >
                <span
                  className="text-sm font-semibold px-3 py-1 rounded-md"
                  style={{
                    color: primaryColor,
                    backgroundColor: "rgba(0,0,0,0.25)",
                  }}
                >
                  {primaryColor.toUpperCase()}
                </span>
              </div>

              {/* Sample Button */}
              <button
                className="w-full h-9 rounded-lg font-medium text-sm transition-colors"
                style={{ backgroundColor: primaryColor, color: "#000" }}
              >
                Sample Button
              </button>

              {/* Sample Text */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1a1a22]">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-xs" style={{ color: primaryColor }}>
                  Accent text color
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ManagementPageProps {
  activePopover?: string | null;
  setActivePopover?: (popover: string | null) => void;
}

export default function ManagementPage({ activePopover, setActivePopover }: ManagementPageProps = {}) {
  const [localActiveTab, setLocalActiveTab] = useState<ManagementTab>("invitees");

  const activeTab = activePopover && activePopover.startsWith("Office Settings:")
    ? (activePopover.split(":")[1] as ManagementTab)
    : localActiveTab;

  const setActiveTab = (tab: ManagementTab) => {
    if (setActivePopover) {
      setActivePopover(`Office Settings:${tab}`);
    } else {
      setLocalActiveTab(tab);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "leave":
        return <FounderLeaveDashboard />;
      case "invitees":
        return <InvitesPage />;
      case "pending-requests":
        return <PendingRequestsPage />;
      case "guests":
        return <FounderGuestsPage />;
      // case "ai-providers":
      //   return <AIProvidersPage />;
      // case "my-ai-agent":
      //   return <OpenClawAgentPage />;
      case "coupons":
        return <FounderPlatformCouponsPage />;
      // Both tabs are whitelabel-only: without the add-on the founder
      // sees the pitch page instead of the controls.
      case "domain":
        return (
          <WhitelabelGate>
            <DomainManagementPage />
          </WhitelabelGate>
        );
      case "branding":
        return (
          <WhitelabelGate>
            <BrandingPage />
          </WhitelabelGate>
        );
      case "team-access":
        return <TeamAccessPage />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header — Team & Access ships its own, so it opts out here */}
      {activeTab !== "team-access" && (
        <div className="sticky top-0 z-10 border-b border-[#2a2a35] bg-[#0a0a0d]">
          <div className="px-6 py-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-brand" />
              <h1 className="text-xl font-semibold text-white">Office Settings</h1>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1">{renderContent()}</div>
    </div>
  );
}
