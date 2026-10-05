"use client";

import { useState, useEffect } from "react";
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
  ChevronRight,
  Tv,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

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
  earngpt_data?: {
    store: {
      storeId: string;
      slug: string;
    };
  };
}

interface AffiliateData {
  name: string;
  email?: string;
  type?: string;
  profilePicture?: string;
}

interface Channel {
  _id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  coverImage?: string;
  shareLink?: string;
  isFree: boolean;
  isSubscription: boolean;
  allowPayWhatYouWant: boolean;
  createdAt: string;
}

type ViewStep =
  | "initial" // Show org info and "See Channels" button
  | "channels" // Show channel selection
  | "email" // Email input
  | "otp" // OTP verification
  | "details" // Profile details (if needed)
  | "processing"; // Processing acceptance

export default function OrgAffiliateInvite() {
  const [organization, setOrganization] = useState<OrganizationData | null>(
    null
  );
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // Form states
  const [step, setStep] = useState<ViewStep>("initial");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [needsProfile, setNeedsProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const orgSlug = params.orgSlug as string;
  const affiliateId = searchParams.get("ref");

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
      }>(
        `/affiliate/invite-details?orgSlug=${orgSlug}&affiliateId=${affiliateId}${affiliateClickParams()}`,
        {
          method: "GET",
        }
      );

      if (response.success) {
        setOrganization(response.organization);
        setAffiliate(response.affiliate);
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

  const handleSeeChannels = async () => {
    if (!organization?.earngpt_data?.store?.storeId) {
      toast.error("Store ID not found");
      return;
    }

    setLoadingChannels(true);
    try {
      const response = await api<{
        success: boolean;
        channels: Channel[];
        store: { _id: string; name: string; slug: string };
      }>(`/affiliate/org-channels/${organization.earngpt_data.store.storeId}`, {
        method: "GET",
      });

      if (response.success && response.channels) {
        setChannels(response.channels);
        setStep("channels");
      } else {
        toast.error("No channels found");
      }
    } catch (error) {
      console.error("Error fetching channels:", error);
      toast.error("Failed to load channels");
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
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

    if (!selectedChannel) {
      toast.error("Please select a channel");
      return;
    }

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
          channelId: selectedChannel._id,
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

      localStorage.setItem("garage_tok", response.token);
      localStorage.setItem("garage_org_id", response.orgId);

      toast.success("Welcome! Redirecting to workspace...");

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
            Exclusive Organization Invitation
          </span>
        </div>

        {/* INITIAL VIEW - Organization Info */}
        {step === "initial" && (
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
                          {affiliate.type === "admin"
                            ? "Founder"
                            : "Stakeholder"}
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
                    has invited you to join their organization.
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
                        <span className="text-xs truncate">
                          {locationString}
                        </span>
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
                  <div>
                    <p className="text-xs text-[#9fa0b8] leading-relaxed">
                      {organization.subHeadingText}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDE - Call to Action */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-[#10b981]/10 to-[#059669]/5 rounded-xl p-6 border border-[#10b981]/20 shadow-2xl">
              <div className="flex items-center justify-center mb-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#FBA70A]/30 blur-2xl rounded-full" />
                  <Sparkles className="relative h-12 w-12 text-[#FBA70A]" />
                </div>
              </div>

              <h2 className="text-xl font-bold text-center text-white mb-3">
                Explore Exclusive Channels
              </h2>

              <p className="text-sm text-center text-[#9fa0b8] mb-6 leading-relaxed">
                Browse available channels and join the conversation that
                interests you most.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0C0C0E]/40 border border-[#10b981]/10">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#10b981]/20 flex items-center justify-center">
                    <Tv className="h-4 w-4 text-[#10b981]" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">
                      Multiple Channels
                    </p>
                    <p className="text-xs text-[#9fa0b8]">
                      Choose the one that fits you
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0C0C0E]/40 border border-[#10b981]/10">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FBA70A]/20 flex items-center justify-center">
                    <Users className="h-4 w-4 text-[#FBA70A]" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">
                      Join Community
                    </p>
                    <p className="text-xs text-[#9fa0b8]">
                      Connect with like-minded people
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSeeChannels}
                disabled={loadingChannels}
                className="w-full bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-semibold py-5 rounded-lg shadow-lg transition-all duration-200"
              >
                {loadingChannels ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading Channels...
                  </>
                ) : (
                  <>
                    See Channels
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* CHANNEL SELECTION VIEW */}
        {step === "channels" && (
          <div className="max-w-4xl mx-auto">
            <div className="backdrop-blur-xl bg-[#0C0C0E]/60 rounded-xl p-6 border border-[#FBA70A]/20 shadow-2xl">
              <div className="flex items-center gap-2 mb-6">
                <Tv className="h-5 w-5 text-[#FBA70A]" />
                <h2 className="text-xl font-bold text-white">
                  Select a Channel
                </h2>
              </div>

              {channels.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#9fa0b8]">No channels available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {channels.map((channel) => (
                    <button
                      key={channel._id}
                      onClick={() => handleChannelSelect(channel)}
                      className="group text-left p-4 rounded-lg bg-[#0C0C0E]/40 border border-[#10b981]/10 hover:border-[#10b981]/40 hover:bg-[#0C0C0E]/60 transition-all duration-200"
                    >
                      {channel.coverImage && (
                        <div className="mb-3 rounded-lg overflow-hidden h-32">
                          <img
                            src={channel.coverImage}
                            alt={channel.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                      )}

                      <h3 className="text-base font-bold text-white mb-2 group-hover:text-[#10b981] transition-colors">
                        {channel.title}
                      </h3>

                      {channel.description && (
                         <p 
                           className="text-xs text-[#9fa0b8] mb-3 line-clamp-2 [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_a]:text-[#FBD10D] [&_a]:hover:underline"
                           dangerouslySetInnerHTML={{ __html: sanitizeDescription(channel.description) }}
                         />
                       )}

                      <div className="flex items-center justify-between">
                        {channel.isFree ? (
                          <span className="text-xs font-semibold text-[#10b981]">
                            Free
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-[#FBA70A]">
                            {channel.currency}{" "}
                            {channel.price}
                          </span>
                        )}

                        <ChevronRight className="h-4 w-4 text-[#10b981] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* EMAIL INPUT VIEW */}
        {step === "email" && selectedChannel && (
          <div className="max-w-md mx-auto">
            <div className="backdrop-blur-xl bg-[#0C0C0E]/60 rounded-xl p-6 border border-[#FBA70A]/20 shadow-2xl">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white mb-2">
                  Join {selectedChannel.title}
                </h2>
                <p className="text-sm text-[#9fa0b8]">
                  Enter your email to get started
                </p>
              </div>

              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white mb-2">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="bg-[#0C0C0E]/40 border-[#10b981]/20 focus:border-[#10b981] text-white"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting || !email}
                  className="w-full bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-semibold py-5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <button
                onClick={() => setStep("channels")}
                className="w-full mt-4 text-xs text-[#9fa0b8] hover:text-white transition-colors"
              >
                ← Back to channels
              </button>
            </div>
          </div>
        )}

        {/* OTP VERIFICATION VIEW */}
        {step === "otp" && (
          <div className="max-w-md mx-auto">
            <div className="backdrop-blur-xl bg-[#0C0C0E]/60 rounded-xl p-6 border border-[#FBA70A]/20 shadow-2xl">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white mb-2">
                  Verify Your Email
                </h2>
                <p className="text-sm text-[#9fa0b8]">
                  Enter the 6-digit code sent to {email}
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white mb-2">
                    OTP Code
                  </label>
                  <Input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    maxLength={6}
                    required
                    className="bg-[#0C0C0E]/40 border-[#10b981]/20 focus:border-[#10b981] text-white text-center text-2xl tracking-widest"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting || otp.length !== 6}
                  className="w-full bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-semibold py-5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify OTP
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* PROFILE DETAILS VIEW */}
        {step === "details" && (
          <div className="max-w-md mx-auto">
            <div className="backdrop-blur-xl bg-[#0C0C0E]/60 rounded-xl p-6 border border-[#FBA70A]/20 shadow-2xl">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white mb-2">
                  Complete Your Profile
                </h2>
                <p className="text-sm text-[#9fa0b8]">
                  Just a few more details to get started
                </p>
              </div>

              <form onSubmit={handleAcceptInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white mb-2">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className="bg-[#0C0C0E]/40 border-[#10b981]/20 focus:border-[#10b981] text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white mb-2">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      const value = e.target.value?.replace(/[^0-9]/g, "");
                      setPhone(value);
                    }}
                    placeholder="912XXXXXXX"
                    required
                    className="bg-[#0C0C0E]/40 border-[#10b981]/20 focus:border-[#10b981] text-white"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting || !name || !phone}
                  className="w-full bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-semibold py-5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Completing...
                    </>
                  ) : (
                    <>
                      Join Organization
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* PROCESSING VIEW */}
        {step === "processing" && (
          <div className="max-w-md mx-auto">
            <div className="backdrop-blur-xl bg-[#0C0C0E]/60 rounded-xl p-8 border border-[#FBA70A]/20 shadow-2xl text-center">
              <Loader2 className="h-12 w-12 animate-spin text-[#10b981] mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">
                Setting Up Your Account
              </h2>
              <p className="text-sm text-[#9fa0b8]">
                Please wait while we prepare your workspace...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
