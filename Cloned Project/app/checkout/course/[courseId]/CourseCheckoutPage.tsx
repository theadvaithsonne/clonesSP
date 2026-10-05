"use client";

import { useState, useEffect } from "react";
import { sanitizeDescription } from "@/lib/sanitizeDescription";
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
  BookOpen,
  Users,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CouponInput, AppliedCoupon } from "@/components/ui/coupon-input";
import { toast } from "sonner";
import { saveToken, saveOrgId } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { useGstQuote } from "@/lib/hooks/useGstQuote";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";

interface Course {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  isPaid: boolean;
  isFree: boolean;
  price?: number;
  currency: string;
  // GST semantics for INR courses. true = listed already includes 18%.
  gstInclusive?: boolean;
  isSubscription?: boolean;
  subscriptionPeriod?: string;
  channelIds: string[];
  totalDuration: number;
  totalChapters: number;
  enrolledStudents: number;
}

interface Organization {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  coverPhoto?: string;
  description?: string;
}

type Step = "email" | "otp" | "name" | "processing" | "already_member" | "invoice_payment" | "success";

interface ReferrerInfo {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  affiliateCode?: string;
}

export function CourseCheckoutPage({ courseId }: { courseId: string }) {
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
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

  // Checkout state
  const [userId, setUserId] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);

  // Invoice state
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  // Coupon state
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  // Fetch course details on mount
  useEffect(() => {
    fetchCourseDetails();

    // Read referral ID from URL query params
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const ref = searchParams.get("ref");
      if (ref) {
        setReferralId(ref);
      }
    }
  }, [courseId]);

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

  const fetchCourseDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/checkout/course/${courseId}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Course not found");
        return;
      }

      setCourse(data.course);
      setOrganization(data.organization);
    } catch (err) {
      console.error("Error fetching course:", err);
      setError("Failed to load course details");
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
        `${API_URL}/checkout/course/${courseId}/request-otp`,
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
        `${API_URL}/checkout/course/${courseId}/verify-otp`,
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

        if (data.isMember) {
          setStep("already_member");
        } else if (data.needsProfile) {
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
        `${API_URL}/checkout/course/${courseId}/process-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            name: userName || name,
            referralId: referralId || undefined,
            couponCode: appliedCoupon?.code || undefined,
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Checkout failed");
        setStep("email");
        return;
      }

      if (data.isMember) {
        saveToken(data.token);
        saveOrgId(data.orgId);
        setStep("already_member");
        return;
      }

      setUserId(data.userId);

      // Handle free courses
      if (data.isFree) {
        saveToken(data.token);
        saveOrgId(data.orgId);
        setStep("success");
        toast.success("Enrolled successfully!");
        setTimeout(() => router.push("/workspace"), 2000);
        return;
      }

      // Store token/orgId for post-payment use
      if (data.token) localStorage.setItem("checkout_token", data.token);
      if (data.orgId) localStorage.setItem("checkout_org_id", data.orgId);

      // Invoice-based payment flow
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

  // GST is decided by the buyer's country, which only the server can resolve.
  // Must sit above the early returns below (hook order).
  const gstPriceNow = course?.price || 0;
  const gstIsFree = course?.isFree || gstPriceNow === 0;
  const { quote: gstQuote } = useGstQuote({
    itemType: "course",
    itemId: course?._id,
    email: email || undefined,
    subtotalMinor: appliedCoupon
      ? appliedCoupon.finalAmount
      : Math.round(gstPriceNow * 100),
    enabled: !gstIsFree && !!course,
  });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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
  if (error && !course) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            Course Not Found
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

  const displayPrice = course?.price || 0;
  const isFree = course?.isFree || displayPrice === 0;

  return (
    <div className="h-screen bg-[#0a0a0f] flex overflow-hidden">
      {/* Left Panel - Course Details */}
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

          {/* Course Info */}
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
                {course?.title}
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
                    {formatPrice(displayPrice, course?.currency)}
                  </span>
                  {course?.isSubscription && course?.subscriptionPeriod && (
                    <span className="text-[#9fa0b8] text-sm">
                      /{course.subscriptionPeriod}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Course Stats */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-[#2a2a35]">
              <div className="flex items-center gap-2 text-[#9fa0b8]">
                <BookOpen className="w-4 h-4" />
                <span className="text-sm">{course?.totalChapters} chapters</span>
              </div>
              {course?.totalDuration && course.totalDuration > 0 && (
                <div className="flex items-center gap-2 text-[#9fa0b8]">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{formatDuration(course.totalDuration)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[#9fa0b8]">
                <Users className="w-4 h-4" />
                <span className="text-sm">{course?.enrolledStudents || 0} enrolled</span>
              </div>
            </div>

            {/* Description — backend stores rich HTML (org founders author
                via a rich-text editor / paste from Notes/Word). Render as
                HTML, same pattern as ChannelCheckoutPage.tsx so the two
                checkout surfaces behave identically. The previous plain-text
                render was escaping the markup and showing literal
                `<ol class="ol1" style="...">` to buyers. */}
            {course?.description && (
              <div className="pt-4 border-t border-[#2a2a35]">
                {/* No line-clamp here — line-clamp relies on
                    `display:-webkit-box` and inline line counting, which
                    silently collapses to zero height when the content is
                    a block-level <ol>/<li> (the previous render rule was
                    why descriptions vanished even after sanitize).
                    max-h + overflow-y-auto truncates by visual height
                    and works with any HTML shape. */}
                <div
                  className="text-[#9fa0b8] text-sm leading-relaxed max-h-48 overflow-y-auto [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_p]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_b]:font-bold"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeDescription(course.description),
                  }}
                />
              </div>
            )}

            {/* Course Image */}
            {course?.coverImage && (
              <div className="pt-4">
                <img
                  src={course.coverImage}
                  alt={course.title}
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
            By enrolling, you agree to share information with {organization?.name}.
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

      {/* Right Panel - Enrollment Form */}
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
            <h1 className="text-2xl font-bold text-white mb-1">
              {course?.title}
            </h1>
            <div className="flex items-baseline gap-2">
              {isFree ? (
                <span className="text-2xl font-bold text-green-500">Free</span>
              ) : (
                <>
                  <span className="text-2xl font-bold text-brand">
                    {formatPrice(displayPrice, course?.currency)}
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

          {/* Enrollment Card */}
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-6 lg:p-8">
            <h2 className="text-xl font-bold text-white mb-2">
              {isFree ? "Enroll for Free" : "Enrollment details"}
            </h2>
            <p className="text-sm text-[#9fa0b8] mb-6">
              {isFree
                ? "Get instant access to this course."
                : "Complete your enrollment by providing your details."}
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
                  Processing your enrollment...
                </p>
                <p className="text-sm text-[#9fa0b8] mt-2">
                  Please don't close this window
                </p>
              </div>
            )}

            {/* Invoice Payment State */}
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
                  toast.success("Enrollment successful!");
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
                  Enrollment Complete!
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
                  courses from the Courses section in your workspace.
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

                {/* OTP Field - Animated Entry */}
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

                {/* Name Field - Animated Entry */}
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

                {/* Coupon Input - Only show for paid courses */}
                {!isFree && (
                  <div className="pt-4 border-t border-[#2a2a35]">
                    <CouponInput
                      itemType="course"
                      itemId={courseId}
                      amount={Math.round(displayPrice * 100)}
                      currency={course?.currency || "USD"}
                      onCouponApplied={(coupon) => setAppliedCoupon(coupon)}
                      onCouponRemoved={() => setAppliedCoupon(null)}
                      disabled={formLoading}
                    />
                  </div>
                )}

                {/* Order Summary */}
                <div className="pt-4 border-t border-[#2a2a35] space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9fa0b8]">Course</span>
                    <span className="text-white">{course?.title}</span>
                  </div>
                  {/* Coupon discount */}
                  {appliedCoupon && !isFree && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9fa0b8]">
                        Coupon ({appliedCoupon.code})
                      </span>
                      <span className="text-green-400">
                        -{formatPrice(appliedCoupon.discountAmount / 100, course?.currency)}
                      </span>
                    </div>
                  )}
                  {/* GST — server-decided (buyer's country), not currency.
                      Shared shape with workshop + channel checkout pages.
                      Inclusive shows a sub-line ("Includes GST"); exclusive
                      adds a "+₹X" line reflected in the total below. */}
                  {!isFree && gstQuote?.applies && (
                    gstQuote.inclusive ? (
                      <div className="flex justify-between text-xs text-[#9fa0b8]">
                        <span>Includes GST ({gstQuote.rate}%)</span>
                        <span>{formatPrice(gstQuote.tax / 100, course?.currency)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#9fa0b8]">GST ({gstQuote.rate}%)</span>
                        <span className="text-white">
                          +{formatPrice(gstQuote.tax / 100, course?.currency)}
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
                        return formatPrice(total, course?.currency);
                      })()}
                      {!isFree &&
                        course?.isSubscription &&
                        course?.subscriptionPeriod && (
                          <span className="text-sm font-normal text-[#9fa0b8]">
                            /{course.subscriptionPeriod}
                          </span>
                        )}
                    </span>
                  </div>
                </div>

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
                    (step === "name" && !name.trim())
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
                          ? "Enroll Now"
                          : `Proceed to pay ${formatPrice(
                              appliedCoupon
                                ? appliedCoupon.finalAmount / 100
                                : displayPrice,
                              course?.currency
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
              By enrolling, you agree to share information with{" "}
              {organization?.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
