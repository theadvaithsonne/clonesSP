"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { affiliateClickParams } from "@/lib/affiliate-click";
import { sanitizeDescription } from "@/lib/sanitizeDescription";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Building2,
  MapPin,
  Sparkles,
  UserCheck,
  ArrowRight,
  Mail,
  Award,
  Users,
  Loader2,
  Phone,
  User as UserIcon,
  CreditCard,
  Crown,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

interface OrganizationData {
  _id: string;
  name: string;
  description?: string;
  headingText?: string;
  subHeadingText?: string;
  icon?: string;
  coverPhoto?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  earngpt_data?: any;
}

interface AffiliateData {
  name: string;
  email?: string;
  type?: string;
  profilePicture?: string;
}

interface ChannelData {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  price: number;
  currency: string;
  isFree: boolean;
  isSubscription: boolean;
  subscriptionPeriod?: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function AffiliateInvite() {
  const [organization, setOrganization] = useState<OrganizationData | null>(
    null
  );
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  // Form states
  const [step, setStep] = useState<
    "view" | "email" | "otp" | "details" | "processing" | "payment"
  >("view");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [needsProfile, setNeedsProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [tempOrgId, setTempOrgId] = useState<string | null>(null);

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const orgSlug = params.orgSlug as string;
  const channelId = params.channelId as string;
  const affiliateId = searchParams.get("ref");

  // Check if channel is paid
  const isPaidChannel = channel && !channel.isFree && channel.price > 0;
  const displayPrice = channel?.price || 0;

  useEffect(() => {
    if (!orgSlug || !affiliateId) {
      toast.error("Invalid invite link");
      setLoading(false);
      return;
    }

    fetchInviteDetails();
  }, [orgSlug, affiliateId]);

  const fetchInviteDetails = async () => {
    try {
      setLoading(true);
      const response = await api<{
        success: boolean;
        organization: OrganizationData;
        affiliate: AffiliateData;
        channel: ChannelData | null;
      }>(
        `/affiliate/invite-details?orgSlug=${orgSlug}&affiliateId=${affiliateId}&channelId=${channelId}${affiliateClickParams()}`,
        {
          method: "GET",
        }
      );

      if (response.success) {
        setOrganization(response.organization);
        setAffiliate(response.affiliate);
        if (response.channel) {
          setChannel(response.channel);
        }
      } else {
        toast.error("Could not load invite details");
      }
    } catch (error) {
      console.error("Error fetching invite details:", error);
      toast.error("Failed to load invitation");
    } finally {
      setLoading(false);
    }
  };

  // Load Razorpay script
  const loadRazorpayScript = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  // Handle payment for paid channels
  const handleChannelPayment = async (token: string, orgId: string) => {
    setProcessingPayment(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Failed to load payment gateway");
        setProcessingPayment(false);
        return;
      }

      // Create Razorpay order
      const orderResponse = await api<{
        success: boolean;
        order: { id: string; amount: number; currency: string };
        channel: { id: string; title: string; price: number };
      }>(
        `/feed/channels/${channelId}/create-order?orgId=${orgId}`,
        { method: "POST" },
        token
      );

      if (!orderResponse.success) {
        toast.error("Failed to create payment order");
        setProcessingPayment(false);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderResponse.order.amount,
        currency: orderResponse.order.currency,
        name: organization?.name || "Channel Subscription",
        description: `Subscribe to ${channel?.title}`,
        order_id: orderResponse.order.id,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // Verify payment
            const verifyResponse = await api<{ success: boolean; message: string }>(
              `/feed/channels/${channelId}/verify-payment?orgId=${orgId}`,
              {
                method: "POST",
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              },
              token
            );

            if (verifyResponse.success) {
              // Save token and redirect
              localStorage.setItem("garage_tok", token);
              localStorage.setItem("garage_org_id", orgId);
              toast.success("Payment successful! Welcome to the channel!");
              setTimeout(() => router.push("/workspace"), 1000);
            } else {
              toast.error("Payment verification failed");
            }
          } catch (error) {
            console.error("Payment verification error:", error);
            toast.error("Payment verification failed");
          }
          setProcessingPayment(false);
        },
        modal: {
          ondismiss: () => {
            setProcessingPayment(false);
            toast.error("Payment cancelled");
          },
        },
        prefill: {
          email: email,
          contact: phone,
        },
        theme: {
          color: "#FBA70A",
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to process payment");
      setProcessingPayment(false);
    }
  };

  const handleJoinOrganization = () => {
    setStep("email");
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    try {
      await api("/affiliate/request-otp", {
        method: "POST",
        body: JSON.stringify({ email, orgSlug }),
      });
      toast.success("OTP sent to your email!");
      setStep("otp");
    } catch (error) {
      toast.error("Failed to send OTP");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    setSubmitting(true);
    try {
      const response = await api<{
        success: boolean;
        needsProfile: boolean;
        user?: { email: string; name?: string; phone?: string };
        error?: string;
      }>("/affiliate/check-user", {
        method: "POST",
        body: JSON.stringify({ email, code: otp }),
      });

      if (!response.success) {
        toast.error(response.error || "Failed to verify OTP");
        return;
      }

      setNeedsProfile(response.needsProfile);
      if (response.user) {
        setName(response.user.name || "");
        setPhone(response.user.phone || "");
      }

      if (response.needsProfile) {
        setStep("details");
      } else {
        // User exists with profile, proceed to accept
        await handleAcceptInvite();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to verify OTP");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptInvite = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (needsProfile && (!name || !phone)) {
      toast.error("Please fill in all required fields");
      return;
    }

    setStep("processing");
    setSubmitting(true);

    try {
      const response = await api<{
        success: boolean;
        token: string;
        orgId: string;
        user: { id: string; email: string; name: string };
        error?: string;
      }>("/affiliate/accept-invite", {
        method: "POST",
        body: JSON.stringify({
          email,
          code: otp,
          orgSlug,
          channelId: isPaidChannel ? undefined : channelId, // Don't auto-join paid channels
          affiliateId,
          name: needsProfile ? name : undefined,
          phone: needsProfile ? phone : undefined,
        }),
      });

      if (!response.success) {
        toast.error(response.error || "Failed to accept invite");
        setStep(needsProfile ? "details" : "otp");
        return;
      }

      // If it's a paid channel, trigger payment flow
      if (isPaidChannel) {
        setTempToken(response.token);
        setTempOrgId(response.orgId);
        setStep("payment");
        setSubmitting(false);
        // Start payment process
        await handleChannelPayment(response.token, response.orgId);
        return;
      }

      // For free channels, save token and redirect
      localStorage.setItem("garage_tok", response.token);
      localStorage.setItem("garage_org_id", response.orgId);

      toast.success("Welcome! Redirecting to workspace...");

      // Redirect to workspace
      setTimeout(() => {
        router.push("/workspace");
      }, 1000);
    } catch (error: any) {
      toast.error(error.message || "Failed to accept invite");
      setStep(needsProfile ? "details" : "otp");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0C0C0E] via-[#1a1a1f] to-[#0C0C0E]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#FBA70A]" />
          <p className="text-[#9fa0b8]">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (!organization || !affiliate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0C0C0E] via-[#1a1a1f] to-[#0C0C0E] px-6">
        <Card className="max-w-md border-border/10 backdrop-blur-xl bg-[#0C0C0E]/80">
          <CardHeader>
            <CardTitle className="text-red-400">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button variant="outline" className="w-full">
                Go to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const locationString = [
    organization.city,
    organization.state,
    organization.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="relative min-h-screen flex justify-center px-4 py-6 bg-gradient-to-br from-[#0C0C0E] via-[#1a1a1f] to-[#0C0C0E]">
      {/* Animated background effects */}
      <div
        className="pointer-events-none absolute inset-0
        bg-[radial-gradient(1200px_600px_at_70%_-10%,rgba(251, 169, 10, 0.15),transparent_60%),radial-gradient(700px_400px_at_20%_110%,rgba(251, 169, 10, 0.15),transparent_60%)]
        animate-pulse"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/50" />

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-2 h-2 bg-[#FBA70A]/30 rounded-full animate-bounce"
          style={{ animationDelay: "0s", animationDuration: "3s" }}
        />
        <div
          className="absolute top-1/3 right-1/3 w-1 h-1 bg-[#FBA70A]/40 rounded-full animate-bounce"
          style={{ animationDelay: "1s", animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-[#FBA70A]/20 rounded-full animate-bounce"
          style={{ animationDelay: "2s", animationDuration: "3.5s" }}
        />
        <div
          className="absolute top-2/3 right-1/4 w-1 h-1 bg-[#10b981]/30 rounded-full animate-bounce"
          style={{ animationDelay: "0.5s", animationDuration: "3.8s" }}
        />
      </div>

      <div className="relative w-full max-w-7xl mx-auto">
        {/* Header Badge */}
        <div className="flex justify-center mb-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#10b981] to-[#059669] px-4 py-1.5 text-xs font-medium text-white shadow-lg">
            <Award className="h-3.5 w-3.5" />
            Exclusive Invitation
          </span>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start">
          {/* LEFT SIDE - Invitation Details */}
          <div className="space-y-4">
            {/* Invited By Section */}
            <div className="backdrop-blur-xl bg-[#0C0C0E]/60 rounded-xl p-5 border border-[#10b981]/20 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <UserCheck className="h-4 w-4 text-[#10b981]" />
                <h2 className="text-sm font-semibold text-[#10b981] uppercase tracking-wide">
                  Invited By
                </h2>
              </div>

              <div className="flex items-start gap-4 mb-4">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-[#10b981]/40 blur-lg rounded-full" />
                  {affiliate.profilePicture ? (
                    <img
                      src={affiliate.profilePicture}
                      alt={affiliate.name}
                      className="relative h-16 w-16 rounded-full border-2 border-[#10b981] object-cover"
                    />
                  ) : (
                    <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center text-white font-bold text-xl border-2 border-[#10b981]">
                      {affiliate.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white mb-1 truncate">
                    {affiliate.name}
                  </h3>
                  {affiliate.email && (
                    <div className="flex items-center gap-1.5 text-[#9fa0b8] mb-2">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-xs truncate">
                        {affiliate.email}
                      </span>
                    </div>
                  )}
                  {affiliate.type && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                      <span className="text-xs font-medium text-[#10b981]">
                        {affiliate.type === "admin" ? "Founder" : "Stakeholder"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#10b981]/10">
                <p className="text-xs text-[#9fa0b8] leading-relaxed">
                  <span className="text-white font-medium">
                    {affiliate.name}
                  </span>{" "}
                  has invited you to join an exclusive community.
                </p>
              </div>
            </div>

            {/* Organization Section */}
            <div className="backdrop-blur-xl bg-[#0C0C0E]/60 rounded-xl p-5 border border-[#FBA70A]/20 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-[#FBA70A]" />
                <h2 className="text-sm font-semibold text-[#FBA70A] uppercase tracking-wide">
                  Organization
                </h2>
              </div>

              <div className="flex items-start gap-4 mb-4">
                {organization.icon && (
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-[#FBA70A]/30 blur-lg rounded-xl" />
                    <img
                      src={organization.icon}
                      alt={organization.name}
                      className="relative h-16 w-16 rounded-xl border-2 border-[#FBA70A] shadow-xl object-cover"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white mb-2 truncate">
                    {organization.name}
                  </h3>
                  {locationString && (
                    <div className="flex items-center gap-1.5 text-[#9fa0b8]">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-[#FBA70A]" />
                      <span className="text-xs truncate">{locationString}</span>
                    </div>
                  )}
                </div>
              </div>

              {organization.headingText && (
                <div className="mb-3">
                  <p className="text-xs text-white leading-relaxed font-medium">
                    {organization.headingText}
                  </p>
                </div>
              )}

              {organization.subHeadingText && (
                <div className="mb-3">
                  <p className="text-xs text-[#e5e7eb] leading-relaxed">
                    {organization.subHeadingText}
                  </p>
                </div>
              )}

              {organization.description && (
                <div className="">
                  <p className="text-xs text-[#9fa0b8] leading-relaxed">
                    {organization.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE - Gamified Experience */}
          <div className="space-y-4 w-full h-full">
            {step === "view" && (
              <>
                {/* Cover Photo */}
                {organization.coverPhoto && (
                  <div className="relative h-48 rounded-xl overflow-hidden shadow-2xl">
                    <img
                      src={organization.coverPhoto}
                      alt={organization.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C0E] via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h1 className="text-2xl font-bold text-white mb-1 drop-shadow-lg">
                        You're Invited!
                      </h1>
                      <p className="text-[#e5e7eb] text-xs drop-shadow-md">
                        Join an exclusive community of professionals
                      </p>
                    </div>
                  </div>
                )}

                {!organization.coverPhoto && (
                  <div className="backdrop-blur-xl bg-gradient-to-br from-[#FBA70A]/20 to-[#10b981]/20 rounded-xl p-8 border border-[#FBA70A]/30 shadow-2xl text-center">
                    <Sparkles className="h-12 w-12 mx-auto mb-3 text-[#FBA70A]" />
                    <h1 className="text-2xl font-bold text-white mb-2">
                      You're Invited!
                    </h1>
                    <p className="text-[#e5e7eb] text-sm">
                      Join an exclusive community of professionals
                    </p>
                  </div>
                )}

                {/* Benefits Grid */}
                <div className="backdrop-blur-xl bg-[#0C0C0E]/60 rounded-xl p-5 border border-border/10 shadow-2xl">
                  <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#FBA70A]" />
                    What You'll Get
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gradient-to-br from-[#FBA70A]/10 to-transparent rounded-lg border border-[#FBA70A]/20 hover:border-[#FBA70A]/40 transition-all duration-300">
                      <div className="flex items-center h-full gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#FBA70A] to-[#f59e0b] flex items-center justify-center flex-shrink-0">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-[#FBA70A] mb-0.5">
                            Vibrant Community
                          </h4>
                          <p className="text-xs text-[#9fa0b8]">
                            Connect with like-minded professionals
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-gradient-to-br from-[#10b981]/10 to-transparent rounded-lg border border-[#10b981]/20 hover:border-[#10b981]/40 transition-all duration-300">
                      <div className="flex items-center h-full gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center flex-shrink-0">
                          <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-[#10b981] mb-0.5">
                            Exclusive Access
                          </h4>
                          <p className="text-xs text-[#9fa0b8]">
                            Members-only features and opportunities
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-gradient-to-br from-purple-500/10 to-transparent rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300">
                      <div className="flex items-center h-full gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Award className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-purple-400 mb-0.5">
                            Growth & Learning
                          </h4>
                          <p className="text-xs text-[#9fa0b8]">
                            Resources and mentorship to accelerate
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            {/* Channel Info for Paid Channels */}
            {channel && (
              <div className="backdrop-blur-xl bg-[#0C0C0E]/60 rounded-xl p-5 border border-purple-500/20 shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="h-4 w-4 text-purple-400" />
                  <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wide">
                    {isPaidChannel ? "Premium Channel" : "Channel"}
                  </h2>
                </div>

                <div className="flex items-start gap-4 mb-4">
                  {channel.coverImage && (
                    <div className="relative flex-shrink-0">
                      <img
                        src={channel.coverImage}
                        alt={channel.title}
                        className="h-16 w-16 rounded-xl border-2 border-purple-500/30 object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white mb-1 truncate">
                      {channel.title}
                    </h3>
                    {channel.description && (
                      <p 
                        className="text-xs text-[#9fa0b8] line-clamp-2 [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_a]:text-[#FBD10D] [&_a]:hover:underline"
                        dangerouslySetInnerHTML={{ __html: sanitizeDescription(channel.description) }}
                      />
                    )}
                  </div>
                </div>

                {isPaidChannel && (
                  <div className="pt-3 border-t border-purple-500/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#9fa0b8]">
                        {channel.isSubscription
                          ? `${channel.subscriptionPeriod} subscription`
                          : "One-time payment"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-[#FBA70A]">
                          ₹{displayPrice}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {!isPaidChannel && (
                  <div className="pt-3 border-t border-purple-500/10">
                    <div className="flex items-center gap-2 text-[#10b981]">
                      <Check className="h-4 w-4" />
                      <span className="text-sm font-medium">Free Access</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CTA Section */}
            <div className="flex items-center w-full">
              <div className="backdrop-blur-xl w-full bg-gradient-to-br from-[#FBA70A]/10 via-[#0C0C0E]/80 to-[#10b981]/10 rounded-xl p-5 border border-[#FBA70A]/30 shadow-2xl">
                {step === "view" && (
                  <>
                    <Button
                      className="w-full h-12 text-base font-bold bg-gradient-to-r from-[#FBA70A] via-[#f59e0b] to-[#FBA70A] hover:from-[#f59e0b] hover:via-[#FBA70A] hover:to-[#f59e0b] text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                      onClick={handleJoinOrganization}
                    >
                      {isPaidChannel ? (
                        <>
                          <CreditCard className="h-5 w-5 mr-2" />
                          Join & Pay ₹{displayPrice}
                        </>
                      ) : (
                        <>
                          Accept Invitation & Join
                          <ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-center text-[#9fa0b8] mt-3">
                      {isPaidChannel
                        ? "Secure payment powered by Razorpay"
                        : "By joining, you agree to the organization's terms"}
                    </p>
                  </>
                )}

                {step === "email" && (
                  <form onSubmit={handleRequestOTP} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-white mb-2 block">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                        <Input
                          type="email"
                          placeholder="you@company.com"
                          className="pl-10 bg-[#1a1a1f]/50 border-border/10"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-[#FBA70A] to-[#f59e0b] text-white font-bold"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>Send OTP</>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setStep("view")}
                    >
                      Back
                    </Button>
                  </form>
                )}

                {step === "otp" && (
                  <form onSubmit={handleVerifyOTP} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-white mb-2 block">
                        Enter OTP
                      </label>
                      <p className="text-xs text-[#9fa0b8] mb-3">
                        We sent a 6-digit code to {email}
                      </p>
                      <Input
                        type="text"
                        placeholder="000000"
                        className="text-center text-2xl tracking-widest font-bold bg-[#1a1a1f]/50 border-border/10"
                        maxLength={6}
                        value={otp}
                        onChange={(e) =>
                          setOtp(e.target.value.replace(/\D/g, ""))
                        }
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-[#FBA70A] to-[#f59e0b] text-white font-bold"
                      disabled={submitting || otp.length !== 6}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>Verify OTP</>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setStep("email");
                        setOtp("");
                      }}
                    >
                      Back
                    </Button>
                  </form>
                )}

                {step === "details" && (
                  <form onSubmit={handleAcceptInvite} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-white mb-2 block">
                        Full Name
                      </label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                        <Input
                          type="text"
                          placeholder="John Doe"
                          className="pl-10 bg-[#1a1a1f]/50 border-border/10"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-white mb-2 block">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                        <Input
                          type="tel"
                          placeholder="923XXXXXXXX"
                          className="pl-10 bg-[#1a1a1f]/50 border-border/10"
                          value={phone}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, "");
                            setPhone(value);
                          }}
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-[#FBA70A] to-[#f59e0b] text-white font-bold"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>Complete & Join</>
                      )}
                    </Button>

                    <p className="text-xs text-center text-[#9fa0b8]">
                      By joining, you agree to the organization's terms
                    </p>
                  </form>
                )}

                {step === "processing" && (
                  <div className="text-center py-8">
                    <Loader2 className="h-12 w-12 animate-spin text-[#FBA70A] mx-auto mb-4" />
                    <p className="text-white font-semibold mb-2">
                      Setting up your account...
                    </p>
                    <p className="text-sm text-[#9fa0b8]">
                      You'll be redirected shortly
                    </p>
                  </div>
                )}

                {step === "payment" && (
                  <div className="text-center py-8">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#FBA70A] to-[#f59e0b] flex items-center justify-center">
                      <CreditCard className="h-8 w-8 text-white" />
                    </div>
                    {processingPayment ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-[#FBA70A] mx-auto mb-4" />
                        <p className="text-white font-semibold mb-2">
                          Processing payment...
                        </p>
                        <p className="text-sm text-[#9fa0b8]">
                          Please complete the payment in the popup
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-white font-semibold mb-2">
                          Complete Your Payment
                        </p>
                        <p className="text-sm text-[#9fa0b8] mb-4">
                          Pay ₹{displayPrice} to access {channel?.title}
                        </p>
                        <Button
                          className="w-full h-12 bg-gradient-to-r from-[#FBA70A] to-[#f59e0b] text-white font-bold"
                          onClick={() => {
                            if (tempToken && tempOrgId) {
                              handleChannelPayment(tempToken, tempOrgId);
                            }
                          }}
                        >
                          <CreditCard className="h-5 w-5 mr-2" />
                          Pay Now
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
