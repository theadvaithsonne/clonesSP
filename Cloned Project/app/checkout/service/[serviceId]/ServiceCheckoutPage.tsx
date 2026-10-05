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
  Target,
  Briefcase,
  DollarSign,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { saveToken, saveOrgId } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { CheckoutPaymentStep } from "@/components/checkout/CheckoutPaymentStep";
import { CouponInput, AppliedCoupon } from "@/components/ui/coupon-input";

interface ServiceMilestone {
  _id: string;
  order: number;
  title: string;
  description?: string;
  duration?: string;
  paymentAmount: number;
  currency: string;
}

interface Service {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  longDescription?: string;
  icon?: string;
  iconBgColor?: string;
  coverImage?: string;
  tags: string[];
  features: string[];
  deliverables: string[];
  duration?: string;
  paymentTiming: "free" | "pay_before_milestone" | "pay_after_milestone";
  currency: string;
  totalPrice: number;
  milestones: ServiceMilestone[];
  status: string;
  projectsCompleted: number;
  activeOptIns: number;
}

interface Organization {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  coverPhoto?: string;
  description?: string;
}

type Step = "email" | "otp" | "name" | "processing" | "already_opted" | "invoice_payment" | "success";

interface ReferrerInfo {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  affiliateCode?: string;
}

export function ServiceCheckoutPage({ serviceId }: { serviceId: string }) {
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<Service | null>(null);
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
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  // Fetch service details on mount
  useEffect(() => {
    fetchServiceDetails();

    // Read referral ID from URL query params
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const ref = searchParams.get("ref");
      if (ref) {
        setReferralId(ref);
      }
    }
  }, [serviceId]);

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

  const fetchServiceDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/checkout/service/${serviceId}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Service not found");
        return;
      }

      setService(data.service);
      setOrganization(data.organization);
    } catch (err) {
      console.error("Error fetching service:", err);
      setError("Failed to load service details");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setFormLoading(true);
    try {
      const res = await fetch(`${API_URL}/checkout/service/${serviceId}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || "Failed to send OTP");
        return;
      }

      toast.success("OTP sent to your email!");
      setStep("otp");
    } catch (err) {
      console.error("Error sending OTP:", err);
      toast.error("Failed to send OTP");
    } finally {
      setFormLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;

    setFormLoading(true);
    try {
      const res = await fetch(`${API_URL}/checkout/service/${serviceId}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || "Invalid OTP");
        return;
      }

      setUserId(data.userId);
      setNeedsProfile(data.needsProfile);

      if (data.alreadyOptedIn) {
        // User already opted in to this service
        if (data.token) {
          saveToken(data.token);
          if (organization?._id) {
            saveOrgId(organization._id);
          }
        }
        setStep("already_opted");
        return;
      }

      if (data.needsProfile) {
        setStep("name");
      } else {
        // Directly proceed to opt-in
        await handleOptIn(data.userId, data.token);
      }
    } catch (err) {
      console.error("Error verifying OTP:", err);
      toast.error("Failed to verify OTP");
    } finally {
      setFormLoading(false);
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setFormLoading(true);
    try {
      // Update profile name first
      const profileRes = await fetch(`${API_URL}/checkout/service/${serviceId}/update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: name.trim() }),
      });

      const profileData = await profileRes.json();

      if (!profileData.success) {
        toast.error(profileData.error || "Failed to update profile");
        return;
      }

      // Now proceed to opt-in
      await handleOptIn(userId!, profileData.token);
    } catch (err) {
      console.error("Error updating profile:", err);
      toast.error("Failed to update profile");
    } finally {
      setFormLoading(false);
    }
  };

  const handleOptIn = async (userId: string, token?: string) => {
    setStep("processing");
    try {
      const res = await fetch(`${API_URL}/checkout/service/${serviceId}/opt-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          referralId,
          couponCode: appliedCoupon?.code,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || "Failed to opt-in");
        setStep("email");
        return;
      }

      // Save auth token and org ID
      const authToken = token || data.token;
      if (authToken) {
        saveToken(authToken);
        localStorage.setItem("checkout_token", authToken);
      }
      if (organization?._id) {
        saveOrgId(organization._id);
        localStorage.setItem("checkout_org_id", organization._id);
      }

      // Check if backend returned an invoice for immediate payment
      if (data.invoiceId) {
        setInvoiceId(data.invoiceId);
        setStep("invoice_payment");
        return;
      }

      setStep("success");
    } catch (err) {
      console.error("Error opting in:", err);
      toast.error("Failed to opt-in");
      setStep("email");
    }
  };

  const formatCurrency = (value: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value);
  };

  const getPaymentTimingText = () => {
    if (!service) return "";
    switch (service.paymentTiming) {
      case "free":
        return "This is a free service";
      case "pay_before_milestone":
        return "Pay before each milestone is started";
      case "pay_after_milestone":
        return "Pay after each milestone is completed";
      default:
        return "";
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0c] to-[#0e0e12] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  // Error state
  if (error || !service || !organization) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0c] to-[#0e0e12] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Service Not Found</h1>
          <p className="text-[#9fa0b8]">{error || "This service doesn't exist or is no longer available."}</p>
        </div>
      </div>
    );
  }

  // Already opted in state
  if (step === "already_opted") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0c] to-[#0e0e12] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-blue-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Already Opted In</h1>
          <p className="text-[#9fa0b8] mb-6">
            You've already opted in to this service. Go to your dashboard to view your progress.
          </p>
          <Button
            onClick={() => router.push("/")}
            className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground"
          >
            Go to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Success state
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0c] to-[#0e0e12] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Successfully Opted In!</h1>
          <p className="text-[#9fa0b8] mb-6">
            You've successfully opted in to <span className="text-white">{service.title}</span>.
            {service.paymentTiming !== "free" && " You'll be notified when milestones are ready for payment."}
          </p>
          <Button
            onClick={() => router.push("/")}
            className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground"
          >
            Go to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Processing state
  if (step === "processing") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0c] to-[#0e0e12] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-brand mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Processing...</h1>
          <p className="text-[#9fa0b8]">Please wait while we complete your opt-in.</p>
        </div>
      </div>
    );
  }

  // Invoice payment state
  if (step === "invoice_payment" && invoiceId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0c] to-[#0e0e12]">
        {/* Header */}
        <div className="border-b border-[#2a2a35] bg-[#0e0e12]/80 backdrop-blur-lg sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
            {organization.icon ? (
              <img
                src={organization.icon}
                alt={organization.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#1a1a22] flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-[#9fa0b8]" />
              </div>
            )}
            <div>
              <h2 className="text-white font-medium">{organization.name}</h2>
              <p className="text-xs text-[#9fa0b8]">Service Payment</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-8">
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
              toast.success("Payment successful!");
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
        </div>
      </div>
    );
  }

  const isFree = service.paymentTiming === "free";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0c] to-[#0e0e12]">
      {/* Header */}
      <div className="border-b border-[#2a2a35] bg-[#0e0e12]/80 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          {organization.icon ? (
            <img
              src={organization.icon}
              alt={organization.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#1a1a22] flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-[#9fa0b8]" />
            </div>
          )}
          <div>
            <h2 className="text-white font-medium">{organization.name}</h2>
            <p className="text-xs text-[#9fa0b8]">Service Checkout</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Service Info */}
          <div className="space-y-6">
            {/* Service Card */}
            <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl overflow-hidden">
              {service.coverImage ? (
                <img
                  src={service.coverImage}
                  alt={service.title}
                  className="w-full h-48 object-cover"
                />
              ) : service.icon ? (
                <div
                  className="w-full h-48 flex items-center justify-center text-6xl"
                  style={{ backgroundColor: service.iconBgColor || "#1a1a22" }}
                >
                  {service.icon}
                </div>
              ) : (
                <div className="w-full h-48 bg-[#1a1a22] flex items-center justify-center">
                  <Briefcase className="h-16 w-16 text-[#9fa0b8]" />
                </div>
              )}
              <div className="p-6 space-y-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">{service.title}</h1>
                  {service.description && (
                    <p className="text-[#9fa0b8] mt-2">{service.description}</p>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-3">
                  {service.duration && (
                    <div className="flex items-center gap-1.5 text-sm text-[#9fa0b8]">
                      <Clock className="h-4 w-4 text-brand" />
                      {service.duration}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-sm text-[#9fa0b8]">
                    <Target className="h-4 w-4 text-brand" />
                    {service.milestones?.length || 0} milestones
                  </div>
                </div>

                {/* Price */}
                <div className="pt-4 border-t border-[#2a2a35]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#9fa0b8]">Total Service Price</p>
                      <p className="text-3xl font-bold text-brand">
                        {isFree ? "Free" : formatCurrency(service.totalPrice, service.currency)}
                      </p>
                    </div>
                    {!isFree && (
                      <div className="text-right">
                        <span className="text-xs px-2 py-1 rounded-full bg-[#1a1a22] text-[#9fa0b8]">
                          {service.paymentTiming === "pay_before_milestone" ? "Pay Before" : "Pay After"}
                        </span>
                      </div>
                    )}
                  </div>
                  {!isFree && (
                    <p className="text-xs text-[#9fa0b8] mt-2">{getPaymentTimingText()}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Milestones */}
            {service.milestones && service.milestones.length > 0 && (
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Service Milestones</h3>
                <div className="space-y-3">
                  {service.milestones.map((milestone, idx) => (
                    <div key={milestone._id} className="flex items-start gap-3 p-3 bg-[#1a1a22] rounded-lg">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-brand text-brand-foreground font-semibold text-sm flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm">{milestone.title}</h4>
                        {milestone.description && (
                          <p className="text-xs text-[#9fa0b8] mt-0.5 line-clamp-2">{milestone.description}</p>
                        )}
                        {milestone.duration && (
                          <p className="text-xs text-[#9fa0b8] mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {milestone.duration}
                          </p>
                        )}
                      </div>
                      {!isFree && milestone.paymentAmount > 0 && (
                        <span className="text-sm text-brand font-medium flex-shrink-0">
                          {formatCurrency(milestone.paymentAmount, milestone.currency)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Features */}
            {service.features && service.features.length > 0 && (
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Features</h3>
                <div className="space-y-2">
                  {service.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span className="text-sm text-[#c7c7da]">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Referred By Card */}
            {referrerInfo && (
              <div className="flex items-center gap-3 p-4 bg-[#0e0e12] border border-[#2a2a35] rounded-2xl">
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
            )}
          </div>

          {/* Checkout Form */}
          <div className="space-y-6">
            <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                {step === "email" && "Enter your email"}
                {step === "otp" && "Verify your email"}
                {step === "name" && "Complete your profile"}
              </h2>

              {step === "email" && (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-[#9fa0b8]">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9fa0b8]" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-11 bg-[#1a1a22] border-[#2a2a35] text-white h-12"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={formLoading || !email.trim()}
                    className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground h-12"
                  >
                    {formLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              {step === "otp" && (
                <form onSubmit={handleOtpSubmit} className="space-y-4">
                  <p className="text-sm text-[#9fa0b8] mb-4">
                    We've sent a verification code to <span className="text-white">{email}</span>
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm text-[#9fa0b8]">Verification Code</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9fa0b8]" />
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="Enter 6-digit code"
                        className="pl-11 bg-[#1a1a22] border-[#2a2a35] text-white h-12 text-center tracking-widest text-lg"
                        required
                        maxLength={6}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={formLoading || otp.length !== 6}
                    className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground h-12"
                  >
                    {formLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Verify & Continue
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="w-full text-sm text-[#9fa0b8] hover:text-white transition-colors"
                  >
                    Use a different email
                  </button>
                </form>
              )}

              {step === "name" && (
                <form onSubmit={handleNameSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-[#9fa0b8]">Your Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9fa0b8]" />
                      <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className="pl-11 bg-[#1a1a22] border-[#2a2a35] text-white h-12"
                        required
                      />
                    </div>
                  </div>
                  {!isFree && service && (
                    <div className="pt-2">
                      <CouponInput
                        itemType="service"
                        itemId={serviceId}
                        amount={Math.round((service.totalPrice || 0) * 100)}
                        currency={service.currency || "USD"}
                        orgId={organization?._id}
                        userId={userId || undefined}
                        onCouponApplied={(c) => setAppliedCoupon(c)}
                        onCouponRemoved={() => setAppliedCoupon(null)}
                        disabled={formLoading}
                      />
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={formLoading || !name.trim()}
                    className="w-full bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground h-12"
                  >
                    {formLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Complete & Opt In
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>

            {/* Trust badges */}
            <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <Shield className="h-10 w-10 text-brand" />
                <div>
                  <h4 className="text-white font-medium">Secure Checkout</h4>
                  <p className="text-xs text-[#9fa0b8]">
                    Your information is protected. {!isFree && "Payments are processed securely via GaragePay."}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            {!isFree && (
              <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-10 w-10 text-green-400" />
                  <div>
                    <h4 className="text-white font-medium">Milestone-Based Payments</h4>
                    <p className="text-xs text-[#9fa0b8]">
                      {service.paymentTiming === "pay_before_milestone"
                        ? "You'll pay for each milestone before work begins."
                        : "You'll pay for each milestone after it's completed."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
