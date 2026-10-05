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
  ArrowLeft,
  Shield,
  Clock,
  Phone,
  Video,
  Star,
  Users,
  UserPlus,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { saveToken, saveOrgId } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";
import { CouponInput, AppliedCoupon } from "@/components/ui/coupon-input";

interface IntakeQuestion {
  _id: string;
  question: string;
  answerType: "text" | "file";
  isRequired: boolean;
  order: number;
}

interface CallOffering {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  pricePerCall: number;
  currency: string;
  isFree: boolean;
  duration: number;
  intakeQuestions?: IntakeQuestion[];
  averageRating?: number;
  reviewCount?: number;
  totalPurchased?: number;
  createdBy?: {
    _id: string;
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

type Step = "email" | "otp" | "name" | "questions" | "confirm" | "processing" | "already_member" | "invoice_payment" | "success";

interface ReferrerInfo {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  affiliateCode?: string;
}

export function CallCheckoutPage({ callId }: { callId: string }) {
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [callOffering, setCallOffering] = useState<CallOffering | null>(null);
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
  const [quantity, setQuantity] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Checkout state
  const [userId, setUserId] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  // Fetch call details on mount
  useEffect(() => {
    fetchCallDetails();

    // Read referral ID from URL query params
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const ref = searchParams.get("ref");
      if (ref) {
        setReferralId(ref);
      }
    }
  }, [callId]);

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

  const fetchCallDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/checkout/call/${callId}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Call not found");
        return;
      }

      setCallOffering(data.callOffering);
      setOrganization(data.organization);
    } catch (err) {
      console.error("Error fetching call:", err);
      setError("Failed to load call details");
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
      const res = await fetch(`${API_URL}/checkout/call/${callId}/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

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
      const res = await fetch(`${API_URL}/checkout/call/${callId}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      });

      const data = await res.json();

      if (data.success) {
        setUserId(data.userId);

        if (data.isMember) {
          setStep("already_member");
        } else if (data.needsProfileUpdate || !data.userId) {
          setStep("name");
        } else {
          // Skip to questions if they exist, otherwise confirm
          if (callOffering?.intakeQuestions && callOffering.intakeQuestions.length > 0) {
            setStep("questions");
          } else {
            setStep("confirm");
          }
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

  const handleNameSubmit = () => {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (callOffering?.intakeQuestions && callOffering.intakeQuestions.length > 0) {
      setStep("questions");
    } else {
      setStep("confirm");
    }
  };

  const handleQuestionsSubmit = () => {
    // Validate required questions
    const missingRequired = callOffering?.intakeQuestions?.filter(
      (q) => q.isRequired && !answers[q._id]?.trim()
    );
    if (missingRequired && missingRequired.length > 0) {
      toast.error("Please answer all required questions");
      return;
    }
    setStep("confirm");
  };

  const processCheckout = async () => {
    setFormLoading(true);
    setStep("processing");
    setError(null);

    try {
      const intakeAnswers = callOffering?.intakeQuestions?.map((q) => ({
        questionId: q._id,
        question: q.question,
        answerType: q.answerType,
        textAnswer: answers[q._id] || "",
      }));

      const res = await fetch(`${API_URL}/checkout/call/${callId}/process-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          quantity,
          intakeAnswers,
          referralId: referralId || undefined,
          couponCode: appliedCoupon?.code,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Checkout failed");
        setStep("confirm");
        return;
      }

      setUserId(data.user._id);

      // Handle free calls
      if (data.isFree) {
        saveToken(data.token);
        saveOrgId(organization?._id || "");
        setStep("success");
        toast.success("Calls acquired successfully!");
        setTimeout(() => router.push("/workspace"), 2000);
        return;
      }

      // Store token and orgId for post-payment use
      if (data.token) localStorage.setItem("checkout_token", data.token);
      if (organization?._id) localStorage.setItem("checkout_org_id", organization._id);

      // Invoice-based payment flow
      setInvoiceId(data.invoiceId);
      setStep("invoice_payment");
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Checkout failed");
      setStep("confirm");
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

  const isFree = callOffering?.isFree || callOffering?.pricePerCall === 0;
  const totalPrice = (callOffering?.pricePerCall || 0) * quantity;

  // Loading state
  if (loading) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  // Error state
  if (error && !callOffering) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Call Not Found</h2>
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

  return (
    <div className="h-screen bg-[#0a0a0f] flex overflow-hidden">
      {/* Left Panel - Call Details */}
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

          {/* Call Info */}
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
                {callOffering?.title}
              </h1>
              <p className="text-[#9fa0b8] text-sm">By {organization?.name}</p>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              {isFree ? (
                <span className="text-3xl lg:text-4xl font-bold text-green-500">Free</span>
              ) : (
                <>
                  <span className="text-3xl lg:text-4xl font-bold text-white">
                    {formatPrice(callOffering?.pricePerCall || 0, callOffering?.currency)}
                  </span>
                  <span className="text-[#9fa0b8] text-sm">per call</span>
                </>
              )}
            </div>

            {/* Call Stats */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-[#2a2a35]">
              <div className="flex items-center gap-2 text-[#9fa0b8]">
                <Video className="w-4 h-4" />
                <span className="text-sm">Video meeting</span>
              </div>
              <div className="flex items-center gap-2 text-[#9fa0b8]">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{callOffering?.duration} minutes</span>
              </div>
              {callOffering?.averageRating && (
                <div className="flex items-center gap-2 text-amber-400">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span className="text-sm">
                    {callOffering.averageRating.toFixed(1)} ({callOffering.reviewCount} reviews)
                  </span>
                </div>
              )}
              {callOffering?.totalPurchased && callOffering.totalPurchased > 0 && (
                <div className="flex items-center gap-2 text-[#9fa0b8]">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{callOffering.totalPurchased} purchased</span>
                </div>
              )}
            </div>

            {/* Description */}
            {callOffering?.description && (
              <div className="pt-4 border-t border-[#2a2a35]">
                <p className="text-[#9fa0b8] text-sm leading-relaxed whitespace-pre-line line-clamp-6">
                  {callOffering.description}
                </p>
              </div>
            )}

            {/* Host Info */}
            {callOffering?.createdBy && (
              <div className="pt-4 border-t border-[#2a2a35]">
                <p className="text-xs uppercase tracking-wider text-[#6b6b7b] mb-3">Your Host</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] flex items-center justify-center overflow-hidden">
                    {callOffering.createdBy.profilePicture ? (
                      <img
                        src={callOffering.createdBy.profilePicture}
                        alt={callOffering.createdBy.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-black font-bold">
                        {callOffering.createdBy.name?.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">{callOffering.createdBy.name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Cover Image */}
            {callOffering?.coverImage && (
              <div className="pt-4">
                <img
                  src={callOffering.coverImage}
                  alt={callOffering.title}
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
            By purchasing, you agree to share information with {organization?.name}.
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-[#9fa0b8]">
            <span>
              {organization?.name} {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </div>

      {/* Right Panel - Purchase Form */}
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
              <span className="text-white font-medium">{organization?.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{callOffering?.title}</h1>
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-2">
                {isFree ? (
                  <span className="text-2xl font-bold text-green-500">Free</span>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-brand">
                      {formatPrice(callOffering?.pricePerCall || 0, callOffering?.currency)}
                    </span>
                    <span className="text-sm text-[#9fa0b8]">per call</span>
                  </>
                )}
              </div>
              <span className="text-[#6b6b7b]">·</span>
              <span className="text-sm text-[#9fa0b8]">{callOffering?.duration} mins</span>
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

          {/* Purchase Card */}
          <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-6 lg:p-8">
            <h2 className="text-xl font-bold text-white mb-2">
              {isFree ? "Get Free Calls" : "Purchase Details"}
            </h2>
            <p className="text-sm text-[#9fa0b8] mb-6">
              {step === "email" || step === "otp" || step === "name"
                ? "Enter your details to continue"
                : step === "questions"
                ? "Answer the following questions"
                : step === "confirm"
                ? "Review and confirm your purchase"
                : ""}
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
                <p className="text-white font-medium">Processing your purchase...</p>
                <p className="text-sm text-[#9fa0b8] mt-2">Please don't close this window</p>
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
                  toast.success("Purchase successful!");
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
                <h3 className="text-xl font-bold text-white mb-2">Purchase Complete!</h3>
                <p className="text-sm text-[#9fa0b8] mb-4">
                  Welcome to {organization?.name}! Redirecting you to your workspace...
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
                <h3 className="text-xl font-bold text-white mb-2">You're Already a Member!</h3>
                <p className="text-sm text-[#9fa0b8] mb-6">
                  You're already part of {organization?.name}. Access calls from your workspace.
                </p>
                <Button
                  onClick={() => router.push("/workspace")}
                  className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold h-12 rounded-xl"
                >
                  Go to Workspace
                </Button>
              </div>
            )}

            {/* Email/OTP/Name Steps */}
            {(step === "email" || step === "otp" || step === "name") && (
              <div className="space-y-6">
                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9fa0b8]" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      disabled={step !== "email"}
                      className={cn(
                        "pl-12 h-12 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] focus:border-brand focus:ring-brand/20 transition-all",
                        step !== "email" && "opacity-60"
                      )}
                      onKeyDown={(e) => e.key === "Enter" && step === "email" && handleRequestOtp()}
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
                  className={cn(
                    "space-y-2 overflow-hidden transition-all duration-300 ease-out",
                    step === "otp" || step === "name" ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <label className="text-sm font-medium text-white">Verification Code</label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9fa0b8]" />
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      disabled={step !== "otp"}
                      maxLength={6}
                      className={cn(
                        "pl-12 h-12 bg-[#1a1a22] border-[#2a2a35] text-white rounded-xl placeholder:text-[#6b6b7b] text-center tracking-[0.5em] font-mono focus:border-brand focus:ring-brand/20 transition-all",
                        step !== "otp" && "opacity-60"
                      )}
                      onKeyDown={(e) => e.key === "Enter" && step === "otp" && handleVerifyOtp()}
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
                  {step === "otp" && <p className="text-xs text-[#9fa0b8]">We sent a code to {email}</p>}
                </div>

                {/* Name Field */}
                <div
                  className={cn(
                    "space-y-2 overflow-hidden transition-all duration-300 ease-out",
                    step === "name" ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
                  )}
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
                      onKeyDown={(e) => e.key === "Enter" && step === "name" && handleNameSubmit()}
                    />
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  onClick={() => {
                    if (step === "email") handleRequestOtp();
                    else if (step === "otp") handleVerifyOtp();
                    else if (step === "name") handleNameSubmit();
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
                      {step === "name" && "Continue"}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Questions Step */}
            {step === "questions" && callOffering?.intakeQuestions && (
              <div className="space-y-6">
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {callOffering.intakeQuestions.map((q, idx) => (
                    <div key={q._id || `q-${idx}`}>
                      <Label className="text-[#9fa0b8] text-sm">
                        {q.question}
                        {q.isRequired && <span className="text-red-400 ml-1">*</span>}
                      </Label>
                      <Textarea
                        placeholder="Your answer..."
                        value={answers[q._id] || ""}
                        onChange={(e) => setAnswers({ ...answers, [q._id]: e.target.value })}
                        className="mt-2 bg-[#1a1a22] border-[#2a2a35] text-white min-h-[80px]"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-4 border-t border-[#2a2a35]">
                  <Button
                    variant="outline"
                    onClick={() => setStep("name")}
                    className="flex-1 border-[#2a2a35]"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleQuestionsSubmit}
                    className="flex-1 bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Confirm Step */}
            {step === "confirm" && (
              <div className="space-y-6">
                {/* Quantity Selector */}
                <div>
                  <Label className="text-[#9fa0b8] text-sm mb-3 block">Number of Calls</Label>
                  <div className="flex items-center justify-center gap-4 p-3 bg-[#1a1a22] rounded-xl border border-[#2a2a35]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="h-10 w-10 rounded-lg"
                    >
                      -
                    </Button>
                    <span className="text-2xl font-bold text-white w-16 text-center">{quantity}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuantity(quantity + 1)}
                      className="h-10 w-10 rounded-lg"
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Coupon input (only for paid calls) */}
                {!isFree && callOffering && (
                  <CouponInput
                    itemType="call"
                    itemId={callId as string}
                    amount={Math.round(totalPrice * 100)}
                    currency={callOffering.currency || "USD"}
                    orgId={organization?._id}
                    userId={userId || undefined}
                    onCouponApplied={(c) => setAppliedCoupon(c)}
                    onCouponRemoved={() => setAppliedCoupon(null)}
                    disabled={formLoading}
                  />
                )}

                {/* Order Summary */}
                <div className="bg-[#1a1a22] rounded-xl p-4 space-y-3 border border-[#2a2a35]">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b6b7b]">Call</span>
                    <span className="text-white font-medium truncate max-w-[60%] text-right">
                      {callOffering?.title}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b6b7b]">Duration</span>
                    <span className="text-white">{callOffering?.duration} mins each</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b6b7b]">Quantity</span>
                    <span className="text-white">{quantity} call(s)</span>
                  </div>
                  {appliedCoupon && !isFree && (
                    <div className="flex justify-between text-sm text-emerald-400">
                      <span>Coupon ({appliedCoupon.code})</span>
                      <span>-{formatPrice(appliedCoupon.discountAmount / 100, callOffering?.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t border-[#2a2a35]">
                    <span className="text-[#9fa0b8] font-medium">Total</span>
                    <span className={cn("text-2xl font-bold", isFree ? "text-green-500" : "text-brand")}>
                      {isFree ? "Free" : formatPrice((appliedCoupon ? appliedCoupon.finalAmount / 100 : totalPrice), callOffering?.currency)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setStep(
                        callOffering?.intakeQuestions && callOffering.intakeQuestions.length > 0
                          ? "questions"
                          : "name"
                      )
                    }
                    className="flex-1 border-[#2a2a35]"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={processCheckout}
                    disabled={formLoading}
                    className="flex-1 bg-gradient-to-r from-brand to-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground hover:opacity-90"
                  >
                    {formLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isFree ? (
                      "Get Free Calls"
                    ) : (
                      `Pay ${formatPrice(totalPrice, callOffering?.currency)}`
                    )}
                  </Button>
                </div>

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
              By purchasing, you agree to share information with {organization?.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
