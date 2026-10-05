"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Mail,
  KeyRound,
  User,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Shield,
  Clock,
  Calendar,
  Users,
  Video,
  Repeat,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CouponInput, AppliedCoupon } from "@/components/ui/coupon-input";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";
import { toast } from "sonner";
import { saveToken, saveOrgId } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { useGstQuote } from "@/lib/hooks/useGstQuote";
import { formatTime12Hour } from "@/lib/utils";
import { sanitizeDescription } from "@/lib/sanitizeDescription";

interface Workshop {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  maxParticipants?: number;
  isFree: boolean;
  price?: number;
  currency: string;
  isSubscription?: boolean;
  subscriptionPeriod?: string;
  isRecurring?: boolean;
  recurrencePattern?: {
    type: string;
    excludedDays?: number[];
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  recurrenceStartDate?: string;
  // GST for INR workshops. true = listed price already includes 18%;
  // false = 18% added on top at checkout. USD workshops ignore.
  gstInclusive?: boolean;
  // Founder-configured enrolment mode. `once` = one buy covers every
  // future session in the series; `per_session` = the user picks a
  // specific session date at checkout and buys just that one.
  enrollmentType?: "once" | "per_session";
  // Precomputed upcoming sessions (sent alongside workshop in the
  // /checkout/workshop/:id response). Each `dateString` is the ISO
  // date used as the `sessionDate` filter downstream.
  upcomingSessions?: {
    date: string;
    dateString: string;
    startDateTime: string;
    endDateTime: string;
    isPast?: boolean;
    isToday?: boolean;
    // Session-level values, already resolved over the series template by the
    // server. Identical to the series unless the founder edited that session,
    // and absent on responses from a backend that predates the feature — so
    // every read below falls back to the workshop's own field.
    title?: string;
    isFree?: boolean;
    price?: number;
    rescheduled?: boolean;
  }[];
  channelIds: string[];
  host?: {
    name: string;
    profilePicture?: string;
  };
}

interface Organization {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  coverPhoto?: string;
  description?: string;
}

type Step = "email" | "otp" | "name" | "processing" | "invoice_payment" | "already_member" | "success";

interface ReferrerInfo {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  affiliateCode?: string;
}

export function WorkshopCheckoutPage({ workshopId }: { workshopId: string }) {
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referralId, setReferralId] = useState<string | null>(null);
  const [referrerInfo, setReferrerInfo] = useState<ReferrerInfo | null>(null);

  // Form state
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  // For per_session workshops: which session date the buyer picked.
  // The `dateString` (YYYY-MM-DD) from the BE-precomputed sessions —
  // used as the sessionDate value posted to process-checkout +
  // verify-payment. `null` blocks the CTA until a session is picked.
  const [selectedSessionDate, setSelectedSessionDate] = useState<string | null>(null);
  // Founder's per-session share URL puts sessionDate in the query string.
  // We stash it here until the workshop loads (so we know enrollmentType
  // and can validate against upcomingSessions), then apply as the buyer's
  // pre-selection. Only honored for per_session workshops.
  const [pendingSessionDate, setPendingSessionDate] = useState<string | null>(null);
  // True when the session was pre-chosen via ?sessionDate (mobile native picker).
  // In that case we hide the on-page session list — the buyer already picked, so
  // this page shows only the payment step, matching the app/web dashboard flow.
  const [sessionLockedFromUrl, setSessionLockedFromUrl] = useState(false);

  // Checkout state
  const [userId, setUserId] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);

  // Coupon state
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  // Invoice state
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  // Fetch workshop details on mount
  useEffect(() => {
    fetchWorkshopDetails();

    // Read referral ID + optional session date from URL query params.
    // sessionDate is stashed and later applied once the workshop loads —
    // only if enrollmentType === "per_session". The mobile app opens this
    // page with ?enrollmentType=session&sessionDate=… after the user picks
    // a session in the native picker, so payment is scoped to that session
    // even if the on-page session list is empty. See the useEffect below.
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const ref = searchParams.get("ref");
      if (ref) {
        setReferralId(ref);
      }
      const sd = searchParams.get("sessionDate");
      if (sd) {
        setPendingSessionDate(sd);
      }
    }
  }, [workshopId]);

  // Apply the ?sessionDate stash once the workshop has loaded. Ignore
  // silently for once workshops or invalid dates — the buyer just sees
  // the picker as if no URL hint was given.
  useEffect(() => {
    if (!workshop || !pendingSessionDate) return;
    if (workshop.enrollmentType !== "per_session") {
      setPendingSessionDate(null);
      return;
    }
    const sessions = workshop.upcomingSessions;
    if (!sessions || sessions.length === 0) {
      // Mobile app opens checkout with a session already picked in the
      // native picker — trust the URL date so payment stays scoped to
      // that session even when no session list is available here.
      setSelectedSessionDate(pendingSessionDate);
      setSessionLockedFromUrl(true);
    } else {
      const match = sessions.find(
        (s) => s.dateString === pendingSessionDate && !s.isPast
      );
      if (match) {
        setSelectedSessionDate(match.dateString);
        setSessionLockedFromUrl(true);
      }
    }
    setPendingSessionDate(null);
  }, [workshop, pendingSessionDate]);

  // Fetch referrer info when referralId is available
  useEffect(() => {
    const fetchReferrerInfo = async () => {
      if (!referralId) return;

      try {
        const res = await fetch(`${API_URL}/affiliate/referrer-info?affiliateId=${referralId}`);
        const data = await res.json();

        if (data.success && data.referrer) {
          setReferrerInfo(data.referrer);
        }
      } catch (err) {
        console.error("Error fetching referrer info:", err);
      }
    };

    fetchReferrerInfo();
  }, [referralId]);

  const fetchWorkshopDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/checkout/workshop/${workshopId}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Workshop not found");
        return;
      }

      setWorkshop(data.workshop);
      setOrganization(data.organization);
    } catch (err) {
      console.error("Error fetching workshop:", err);
      setError("Failed to load workshop details");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setFormLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/checkout/workshop/${workshopId}/request-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      const data = await res.json();

      if (data.success) {
        toast.success("OTP sent to your email");
        setStep("otp");
      } else {
        setError(data.error || "Failed to send OTP");
      }
    } catch (err) {
      console.error("OTP request error:", err);
      setError("Failed to send OTP");
    } finally {
      setFormLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }

    setFormLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/checkout/workshop/${workshopId}/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: otp }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setUserId(data.userId);
        setNeedsProfile(data.needsProfile);

        // Existing members still flow through process-checkout so per-session
        // enrolments are recorded (the invoice + registration row happen
        // there, regardless of membership). We only route to the name step
        // for brand-new users who need to fill in profile data.
        if (data.needsProfile) {
          if (data.user?.name) setName(data.user.name);
          setStep("name");
        } else {
          processCheckout(data.user?.name);
        }
      } else {
        setError(data.error || "Invalid OTP");
      }
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("Failed to verify OTP");
    } finally {
      setFormLoading(false);
    }
  };

  const processCheckout = async (userName?: string) => {
    setFormLoading(true);
    setStep("processing");
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/checkout/workshop/${workshopId}/process-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            name: userName || name,
            referralId: referralId || undefined,
            couponCode: appliedCoupon?.code || undefined,
            // Per-session workshops: pass the picked session date through
            // as an ISO string. The BE validates against calculateSessions
            // and rejects invalid dates before any invoice is created.
            sessionDate:
              workshop?.enrollmentType === "per_session" && selectedSessionDate
                ? selectedSessionDate
                : undefined,
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Checkout failed");
        setStep("email");
        return;
      }

      setUserId(data.userId);

      // Free workshops: BE created + auto-paid the invoice and registered
      // the user (mode-aware — per-session rows carry sessionDate).
      // Handles both new buyers and existing members uniformly.
      if (data.isFree) {
        saveToken(data.token);
        saveOrgId(data.orgId);
        setStep("success");
        toast.success(
          data.isMember
            ? "You're registered — redirecting to workspace"
            : "Registered successfully!"
        );
        setTimeout(() => router.push("/workspace"), 2000);
        return;
      }

      // Paid workshop with no invoice returned = member of a legacy flow
      // where the workshop is free-for-members. Send them to workspace.
      if (data.isMember && !data.invoiceId) {
        saveToken(data.token);
        saveOrgId(data.orgId);
        setStep("already_member");
        return;
      }

      // Store token/orgId for later use
      if (data.token) localStorage.setItem("checkout_token", data.token);
      if (data.orgId) localStorage.setItem("checkout_org_id", data.orgId);

      // Invoice-based payment flow — same path for members and non-members.
      // Members still need to pay for per-session enrolments; their org
      // membership doesn't grant free workshop access.
      setInvoiceId(data.invoiceId);
      setStep("invoice_payment");
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Checkout failed");
      setStep("email");
    } finally {
      setFormLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  /**
   * The session the buyer picked, when this is a per-session workshop.
   *
   * Its price is what checkout must quote: in `per_session` mode each session
   * is bought separately, so a session the founder repriced is charged at its
   * own amount (the server resolves the same way at order time — see
   * utils/sessionOverlay.ts). Falls back to the series price for `once` mode,
   * for an unedited session, and for a backend that doesn't send the field.
   */
  const selectedSession =
    workshop?.enrollmentType === "per_session" && selectedSessionDate
      ? workshop.upcomingSessions?.find(
          (s) => s.dateString === selectedSessionDate,
        )
      : undefined;

  // GST is decided by the buyer's country, which only the server can resolve.
  // Must sit above the early returns below (hook order).
  const gstPriceNow = selectedSession?.price ?? workshop?.price ?? 0;
  const gstIsFree =
    (selectedSession?.isFree ?? workshop?.isFree) || gstPriceNow === 0;
  const { quote: gstQuote } = useGstQuote({
    itemType: "workshop",
    itemId: workshop?._id,
    email: email || undefined,
    subtotalMinor: appliedCoupon
      ? appliedCoupon.finalAmount
      : Math.round(gstPriceNow * 100),
    enabled: !gstIsFree && !!workshop,
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };


  // Loading state
  if (loading) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  // Error state
  if (error && !workshop) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            Workshop Not Found
          </h2>
          <p className="text-[#9fa0b8] mb-4">{error}</p>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="border-[#2a2a35]"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const displayPrice = selectedSession?.price ?? workshop?.price ?? 0;
  const isFree =
    (selectedSession?.isFree ?? workshop?.isFree) || displayPrice === 0;

  return (
    <div className="h-screen bg-[#0a0a0f] flex overflow-hidden">
      {/* Left Panel - Workshop Details */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0e0e12] flex-col p-8 lg:p-12 overflow-y-auto">
        <div className="flex-1">
          {/* Organization Logo */}
          <div className="flex items-center gap-3 mb-8">
            {organization?.icon ? (
              <img
                src={organization.icon}
                alt={organization.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center">
                <span className="text-brand font-bold text-lg">
                  {organization?.name?.charAt(0) || "O"}
                </span>
              </div>
            )}
          </div>

          {/* Workshop Info */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-brand" />
                <span className="text-brand text-sm font-medium">
                  {workshop?.isRecurring ? "Recurring Workshop" : "Live Workshop"}
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
                {workshop?.title}
              </h1>
              <p className="text-[#9fa0b8] text-sm">By {organization?.name}</p>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              {isFree ? (
                <span className="text-3xl lg:text-4xl font-bold text-green-500">
                  Free
                </span>
              ) : (
                <>
                  <span className="text-3xl lg:text-4xl font-bold text-white">
                    {formatPrice(displayPrice, workshop?.currency)}
                  </span>
                  {workshop?.isSubscription && workshop?.subscriptionPeriod && (
                    <span className="text-[#9fa0b8] text-sm">
                      /{workshop.subscriptionPeriod}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Workshop Details */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-[#2a2a35]">
              <div className="flex items-center gap-2 text-[#9fa0b8]">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{formatDate(workshop?.date || "")}</span>
              </div>
              <div className="flex items-center gap-2 text-[#9fa0b8]">
                <Clock className="w-4 h-4" />
                <span className="text-sm">
                  {formatTime12Hour(workshop?.startTime || "00:00")} - {formatTime12Hour(workshop?.endTime || "00:00")}{workshop?.timezone ? ` (${workshop.timezone})` : ""}
                </span>
              </div>
              {workshop?.isRecurring && (
                <div className="flex items-center gap-2 text-[#9fa0b8]">
                  <Repeat className="w-4 h-4" />
                  <span className="text-sm capitalize">
                    {workshop.recurrencePattern?.type || "Recurring"}
                  </span>
                </div>
              )}
              {workshop?.maxParticipants && (
                <div className="flex items-center gap-2 text-[#9fa0b8]">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Max {workshop.maxParticipants} participants</span>
                </div>
              )}
            </div>

            {/* Host Info */}
            {workshop?.host && (
              <div className="flex items-center gap-3 pt-4 border-t border-[#2a2a35]">
                {workshop.host.profilePicture ? (
                  <img
                    src={workshop.host.profilePicture}
                    alt={workshop.host.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center">
                    <span className="text-brand font-bold">
                      {workshop.host.name?.charAt(0) || "H"}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-white text-sm font-medium">{workshop.host.name}</p>
                  <p className="text-[#9fa0b8] text-xs">Host</p>
                </div>
              </div>
            )}

            {/* Description */}
            {workshop?.description && (
              <div className="pt-4 border-t border-[#2a2a35]">
                <div 
                  className="text-[#9fa0b8] text-sm leading-relaxed line-clamp-6 [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_a]:text-brand [&_a]:hover:underline"
                  dangerouslySetInnerHTML={{ __html: sanitizeDescription(workshop.description) }}
                />
              </div>
            )}

            {/* Workshop Thumbnail */}
            {workshop?.thumbnail && (
              <div className="pt-4">
                <img
                  src={workshop.thumbnail}
                  alt={workshop.title}
                  className="w-full max-w-sm rounded-2xl object-cover shadow-2xl max-h-[40vh]"
                />
              </div>
            )}

            {/* Referred By Card */}
            {referrerInfo && (
              <div className="pt-4 border-t border-[#2a2a35]">
                <div className="flex items-center gap-3 p-3 bg-[#1a1a22] rounded-xl border border-[#2a2a35]">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shrink-0">
                    {referrerInfo.profilePicture ? (
                      <img
                        src={referrerInfo.profilePicture}
                        alt={referrerInfo.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-semibold text-sm">
                        {referrerInfo.name?.charAt(0) || "?"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-[#9fa0b8] mb-0.5">
                      Referred by
                    </p>
                    <p className="text-white text-sm font-medium truncate">
                      {referrerInfo.name}
                    </p>
                  </div>
                  <UserPlus className="w-4 h-4 text-purple-400 shrink-0" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#2a2a35] flex-shrink-0">
          <p className="text-xs text-[#9fa0b8]">
            By registering, you agree to share information with {organization?.name}.
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-[#9fa0b8]">
            <span>
              {organization?.name} {new Date().getFullYear()}
            </span>
            <a href="#" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>

      {/* Right Panel - Registration Form */}
      <div className="w-full lg:w-1/2 flex flex-col p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">
          {/* Mobile Header */}
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-3 mb-6">
              {organization?.icon ? (
                <img
                  src={organization.icon}
                  alt={organization.name}
                  className="w-10 h-10 rounded-xl object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center">
                  <span className="text-brand font-bold">
                    {organization?.name?.charAt(0) || "O"}
                  </span>
                </div>
              )}
              <span className="text-white font-medium">
                {organization?.name}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Video className="w-4 h-4 text-brand" />
              <span className="text-brand text-xs font-medium">
                {workshop?.isRecurring ? "Recurring Workshop" : "Live Workshop"}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {workshop?.title}
            </h1>
            <div className="flex items-baseline gap-2">
              {isFree ? (
                <span className="text-2xl font-bold text-green-500">Free</span>
              ) : (
                <>
                  <span className="text-2xl font-bold text-brand">
                    {formatPrice(displayPrice, workshop?.currency)}
                  </span>
                </>
              )}
            </div>

            {/* Referred By Card - Mobile */}
            {referrerInfo && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-[#1a1a22] rounded-xl border border-[#2a2a35]">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shrink-0">
                  {referrerInfo.profilePicture ? (
                    <img
                      src={referrerInfo.profilePicture}
                      alt={referrerInfo.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-semibold text-xs">
                      {referrerInfo.name?.charAt(0) || "?"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-[#9fa0b8]">
                    Referred by
                  </p>
                  <p className="text-white text-sm font-medium truncate">
                    {referrerInfo.name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Registration Card */}
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-6 lg:p-8">
            <h2 className="text-xl font-bold text-white mb-2">
              {isFree ? "Register for Free" : "Registration details"}
            </h2>
            <p className="text-sm text-[#9fa0b8] mb-6">
              {isFree
                ? "Get instant access to this workshop."
                : "Complete your registration by providing your details."}
            </p>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Processing State */}
            {step === "processing" && (
              <div className="py-12 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-brand mx-auto mb-4" />
                <p className="text-white font-medium">
                  Processing your registration...
                </p>
                <p className="text-sm text-[#9fa0b8] mt-2">
                  Please don't close this window
                </p>
              </div>
            )}

            {/* Invoice Payment Step */}
            {step === "invoice_payment" && invoiceId && (
              <CheckoutPaymentStep
                invoiceId={invoiceId}
                organizationName={organization?.name || ""}
                userEmail={email}
                userName={name}
                onSuccess={(data) => {
                  const token = localStorage.getItem("checkout_token");
                  const orgId = localStorage.getItem("checkout_org_id");
                  if (token) saveToken(token);
                  if (orgId) saveOrgId(orgId);
                  setStep("success");
                  toast.success("Registered successfully!");
                  setTimeout(() => router.push("/workspace"), 2000);
                }}
                onCancel={() => {
                  setStep("email");
                  setInvoiceId(null);
                }}
                onBack={() => {
                  setStep("email");
                  setInvoiceId(null);
                }}
              />
            )}

            {/* Success State */}
            {step === "success" && (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Registration Complete!
                </h3>
                <p className="text-sm text-[#9fa0b8] mb-4">
                  Welcome to {organization?.name}! Redirecting you to your
                  workspace...
                </p>
                <Loader2 className="w-5 h-5 animate-spin text-brand mx-auto" />
              </div>
            )}

            {/* Already Member State */}
            {step === "already_member" && (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-brand" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  You're Already a Member!
                </h3>
                <p className="text-sm text-[#9fa0b8] mb-6">
                  You're already part of {organization?.name}. You can access
                  workshops from the Webinars section in your workspace.
                </p>
                <Button
                  onClick={() => router.push("/workspace")}
                  className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold h-12 rounded-xl"
                >
                  Go to Workspace
                </Button>
              </div>
            )}

            {/* Form Steps */}
            {(step === "email" || step === "otp" || step === "name") && (
              <div className="space-y-6">
                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9fa0b8]" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      disabled={step !== "email"}
                      className={`pl-12 h-12 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand focus:ring-brand/20 transition-all ${
                        step !== "email" ? "opacity-60" : ""
                      }`}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        step === "email" &&
                        handleRequestOtp()
                      }
                    />
                    {step !== "email" && (
                      <button
                        onClick={() => {
                          setStep("email");
                          setOtp("");
                          setName("");
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-brand text-sm hover:underline"
                      >
                        Change
                      </button>
                    )}
                  </div>
                </div>

                {/* OTP Field */}
                <div
                  className={`space-y-2 overflow-hidden transition-all duration-300 ease-out ${
                    step === "otp" || step === "name"
                      ? "max-h-32 opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <label className="text-sm font-medium text-white">
                    Verification Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9fa0b8]" />
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="Enter 6-digit code"
                      disabled={step !== "otp"}
                      maxLength={6}
                      className={`pl-12 h-12 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] text-center tracking-[0.5em] font-mono focus:border-brand focus:ring-brand/20 transition-all ${
                        step !== "otp" ? "opacity-60" : ""
                      }`}
                      onKeyDown={(e) =>
                        e.key === "Enter" && step === "otp" && handleVerifyOtp()
                      }
                    />
                    {step === "otp" && (
                      <button
                        onClick={handleRequestOtp}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-brand text-sm hover:underline"
                      >
                        Resend
                      </button>
                    )}
                  </div>
                  {step === "otp" && (
                    <p className="text-xs text-[#9fa0b8]">
                      We sent a code to {email}
                    </p>
                  )}
                </div>

                {/* Name Field */}
                <div
                  className={`space-y-2 overflow-hidden transition-all duration-300 ease-out ${
                    step === "name"
                      ? "max-h-24 opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <label className="text-sm font-medium text-white">Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9fa0b8]" />
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="pl-12 h-12 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand focus:ring-brand/20 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && step === "name") {
                          processCheckout();
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Coupon Input - Only show for paid workshops */}
                {!isFree && (
                  <div className="pt-4 border-t border-[#2a2a35]">
                    <CouponInput
                      itemType="workshop"
                      itemId={workshopId}
                      amount={Math.round(displayPrice * 100)}
                      currency={workshop?.currency || "USD"}
                      onCouponApplied={(coupon) => setAppliedCoupon(coupon)}
                      onCouponRemoved={() => setAppliedCoupon(null)}
                      disabled={formLoading}
                    />
                  </div>
                )}

                {/* Order Summary */}
                <div className="pt-4 border-t border-[#2a2a35] space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9fa0b8]">Workshop</span>
                    <span className="text-white">{workshop?.title}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9fa0b8]">Date</span>
                    <span className="text-white">{formatDate(workshop?.date || "")}</span>
                  </div>
                  {/* Coupon discount */}
                  {appliedCoupon && !isFree && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9fa0b8]">
                        Coupon ({appliedCoupon.code})
                      </span>
                      <span className="text-green-400">
                        -{formatPrice(appliedCoupon.discountAmount / 100, workshop?.currency)}
                      </span>
                    </div>
                  )}
                  {/* GST — server-decided (buyer's country), not currency.
                      Same shape as the channel checkout page. Inclusive tax
                      is shown as informational (already baked into the
                      subtotal); exclusive is added to the total. */}
                  {!isFree && gstQuote?.applies && (
                    gstQuote.inclusive ? (
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>Includes GST ({gstQuote.rate}%)</span>
                        <span>{formatPrice(gstQuote.tax / 100, workshop?.currency)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#9fa0b8]">GST ({gstQuote.rate}%)</span>
                        <span className="text-white">
                          +{formatPrice(gstQuote.tax / 100, workshop?.currency)}
                        </span>
                      </div>
                    )
                  )}
                  <div className="flex justify-between text-base font-semibold pt-3 border-t border-[#2a2a35]">
                    <span className="text-white">
                      {isFree ? "Price" : "Amount to be paid"}
                    </span>
                    <span className={isFree ? "text-green-500" : "text-brand"}>
                      {(() => {
                        if (isFree) return "Free";
                        const subtotal = appliedCoupon
                          ? appliedCoupon.finalAmount / 100
                          : displayPrice;
                        const total = gstQuote ? gstQuote.total / 100 : subtotal;
                        return formatPrice(total, workshop?.currency);
                      })()}
                      {!isFree &&
                        workshop?.isSubscription &&
                        workshop?.subscriptionPeriod && (
                          <span className="text-sm font-normal text-[#9fa0b8]">
                            /{workshop.subscriptionPeriod}
                          </span>
                        )}
                    </span>
                  </div>
                </div>

                {/* Session picker — per_session workshops only. Rendered
                    ABOVE the CTA so the buyer sees the date list before
                    they act. Selection stores the session's `dateString`
                    which the POST body forwards to the BE. */}
                {workshop?.enrollmentType === "per_session" &&
                  !sessionLockedFromUrl &&
                  workshop?.upcomingSessions &&
                  workshop.upcomingSessions.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#9fa0b8] mb-2">
                        Pick a session
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                        {workshop.upcomingSessions
                          .filter((s) => !s.isPast)
                          .map((s) => {
                            const active = selectedSessionDate === s.dateString;
                            const startDate = new Date(s.startDateTime);
                            const dayLabel = startDate.toLocaleDateString(
                              undefined,
                              { weekday: "short", month: "short", day: "numeric" },
                            );
                            const timeLabel = startDate.toLocaleTimeString(
                              undefined,
                              { hour: "numeric", minute: "2-digit" },
                            );
                            return (
                              <button
                                key={s.dateString}
                                type="button"
                                onClick={() =>
                                  setSelectedSessionDate(s.dateString)
                                }
                                className={
                                  "text-left rounded-xl p-3 transition-colors ring-1 ring-inset " +
                                  (active
                                    ? "bg-brand/10 ring-brand/40 text-white"
                                    : "bg-[#151519] ring-white/[0.05] text-[#c7c7da] hover:bg-[#1c1c21] hover:ring-white/[0.1]")
                                }
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold">
                                      {dayLabel}
                                    </div>
                                    {/* Only when this session was named
                                        separately — the series title is on the
                                        page already. */}
                                    {s.title && s.title !== workshop.title && (
                                      <div className="truncate text-[11px] text-white/70">
                                        {s.title}
                                      </div>
                                    )}
                                    <div className="text-[11px] text-[#8a8aa0]">
                                      {timeLabel}
                                      {s.isToday && (
                                        <span className="ml-2 text-[10px] font-semibold text-brand">
                                          TODAY
                                        </span>
                                      )}
                                    </div>
                                    {/* Sessions are bought one at a time here,
                                        so a repriced one has to say so before
                                        the buyer commits. */}
                                    {s.price !== undefined && (
                                      <div className="mt-0.5 text-[11px] font-semibold text-brand">
                                        {s.isFree
                                          ? "Free"
                                          : formatPrice(
                                              s.price,
                                              workshop.currency,
                                            )}
                                      </div>
                                    )}
                                  </div>
                                  {active && (
                                    <span className="shrink-0 text-[10px] font-bold text-brand uppercase tracking-wide">
                                      Selected
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                {/* Action Button */}
                <Button
                  onClick={() => {
                    if (step === "email") handleRequestOtp();
                    else if (step === "otp") handleVerifyOtp();
                    else if (step === "name") processCheckout();
                  }}
                  disabled={
                    formLoading ||
                    (step === "email" && !email) ||
                    (step === "otp" && otp.length !== 6) ||
                    (step === "name" && !name.trim()) ||
                    // Gate CTA on session selection for per_session
                    // workshops — matches the BE's 400 for missing
                    // sessionDate so the user can't submit and bounce.
                    (workshop?.enrollmentType === "per_session" &&
                      !selectedSessionDate)
                  }
                  className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold h-14 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {formLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {step === "email" && "Continue"}
                      {step === "otp" && "Verify & Continue"}
                      {step === "name" &&
                        (isFree
                          ? "Register Now"
                          : `Proceed to pay ${formatPrice(
                              appliedCoupon
                                ? appliedCoupon.finalAmount / 100
                                : displayPrice,
                              workshop?.currency
                            )}`)}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                {/* Security Badge */}
                {!isFree && (
                  <div className="flex items-center justify-center gap-2 text-xs text-[#9fa0b8]">
                    <Shield className="w-4 h-4" />
                    <span>Secured by GaragePay</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Footer */}
          <div className="lg:hidden mt-6 text-center">
            <p className="text-xs text-[#9fa0b8]">
              By registering, you agree to share information with{" "}
              {organization?.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
