"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  Users,
  Check,
  ChevronDown,
  ChevronUp,
  Hash,
  MessageCircle,
  Shield,
  Zap,
  Crown,
  Globe,
  Calendar,
  Lock,
  Unlock,
  TrendingUp,
  Award,
  Heart,
} from "lucide-react";
import GuestNavbar from "../../components/GuestNavbar";
import { cn } from "@/lib/utils";

interface Organization {
  _id: string;
  name: string;
  slug?: string;
  icon?: string;
  branding?: {
    primaryColor?: string;
  };
  description?: string;
  headingText?: string;
  subHeadingText?: string;
  coverPhoto?: string;
  founders?: Creator[];
}

interface Creator {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
  country?: string;
  state?: string;
  city?: string;
}

interface CommissionLevel {
  level: number;
  percentage: number;
  description: string;
}

interface CommissionPlan {
  _id: string;
  name: string;
  levels: CommissionLevel[];
  totalPercentage: number;
  platformPercentage: number;
}

interface ChannelBenefitData {
  icon: string;
  title: string;
  description: string;
}

interface ChannelReviewData {
  _id?: string;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  rating: number;
  text: string;
  helpfulCount?: number;
  createdAt?: string;
}

interface ChannelFaqData {
  question: string;
  answer: string;
}

interface Channel {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  isActive: boolean;
  isFree: boolean;
  price: number;
  currency: string;
  allowPayWhatYouWant?: boolean;
  isSubscription?: boolean;
  subscriptionPeriod?: string;
  memberCount?: number;
  creator?: Creator;
  organization?: Organization;
  combPlan?: CommissionPlan;
  createdAt?: string;
  updatedAt?: string;
  // Channel detail page fields
  rating?: number;
  ratingCount?: number;
  aboutText?: string;
  whatsIncluded?: string[];
  benefits?: ChannelBenefitData[];
  reviews?: ChannelReviewData[];
  faqs?: ChannelFaqData[];
  galleryImages?: string[];
  videoUrl?: string;
  videoFile?: string;
}

interface Review {
  id: string;
  name: string;
  initials: string;
  rating: number;
  comment: string;
  date: string;
}

interface Benefit {
  icon: typeof Check;
  title: string;
  description: string;
  iconEmoji?: string;
}

interface FAQ {
  question: string;
  answer: string;
}

function generateMockReviews(): Review[] {
  return [
    {
      id: "1",
      name: "Alex Thompson",
      initials: "AT",
      rating: 5,
      comment: "This community has been incredibly valuable for my growth. The discussions are insightful and the members are supportive.",
      date: "2 weeks ago",
    },
    {
      id: "2",
      name: "Maria Garcia",
      initials: "MG",
      rating: 5,
      comment: "Best decision I made was joining this channel. The exclusive content and networking opportunities are worth every penny.",
      date: "1 month ago",
    },
    {
      id: "3",
      name: "James Wilson",
      initials: "JW",
      rating: 4,
      comment: "Great community with active discussions. Would love to see more live events, but overall very satisfied.",
      date: "3 weeks ago",
    },
  ];
}

function generateBenefits(isFree: boolean): Benefit[] {
  if (isFree) {
    return [
      { icon: MessageCircle, title: "Community Access", description: "Join discussions with like-minded members" },
      { icon: Users, title: "Networking", description: "Connect with professionals in your field" },
      { icon: Globe, title: "Public Resources", description: "Access shared resources and materials" },
      { icon: Heart, title: "Support Network", description: "Get help and support from the community" },
    ];
  }
  return [
    { icon: Crown, title: "Premium Access", description: "Exclusive content and resources only for members" },
    { icon: MessageCircle, title: "Private Discussions", description: "Engage in members-only conversations" },
    { icon: Zap, title: "Priority Support", description: "Get faster responses and dedicated help" },
    { icon: TrendingUp, title: "Revenue Sharing", description: "Earn commissions by referring new members" },
    { icon: Award, title: "Exclusive Events", description: "Access to members-only webinars and meetups" },
    { icon: Shield, title: "Early Access", description: "Be first to access new features and content" },
  ];
}

function generateFAQs(channelTitle: string, isFree: boolean): FAQ[] {
  if (isFree) {
    return [
      {
        question: "Is this channel really free?",
        answer: "Yes! This channel is completely free to join. You'll have access to community discussions and shared resources at no cost.",
      },
      {
        question: "What can I do in this channel?",
        answer: "You can participate in discussions, connect with other members, share resources, and get support from the community.",
      },
      {
        question: "Can I upgrade later?",
        answer: "Yes, if premium channels are available, you can upgrade anytime to access exclusive content and additional benefits.",
      },
    ];
  }
  return [
    {
      question: "What do I get with my membership?",
      answer: `Your ${channelTitle} membership includes access to exclusive content, private discussions, priority support, and networking opportunities with other members.`,
    },
    {
      question: "Can I cancel anytime?",
      answer: "Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.",
    },
    {
      question: "Is there a refund policy?",
      answer: "We offer a 7-day money-back guarantee. If you're not satisfied within the first week, contact us for a full refund.",
    },
    {
      question: "How does the referral program work?",
      answer: "When you refer new members who join, you earn a commission on their subscription. Check the commission structure for detailed percentages.",
    },
  ];
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function StarRating({ rating, size = "sm", brandColor }: { rating: number; size?: "sm" | "md" | "lg"; brandColor?: string }) {
  const sizeClasses = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" };
  const starColor = brandColor || "#f59e0b";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={sizeClasses[size]}
          style={{ color: star <= rating ? starColor : "#d1d5db", fill: star <= rating ? starColor : "#d1d5db" }}
        />
      ))}
    </div>
  );
}

export default function ChannelDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const channelId = params.channelId as string;
  const referCode = searchParams.get("referCode");
  const referSuffix = referCode ? `?referCode=${referCode}` : "";
  const checkoutRef = referCode ? `?ref=${referCode}` : "";

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedFAQ, setExpandedFAQ] = useState<Set<number>>(new Set([0]));
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [activeGalleryImage, setActiveGalleryImage] = useState<string | null>(null);

  const brandColor = organization?.branding?.primaryColor || "#FBA70A";

  // Use API data with graceful fallback to hardcoded defaults
  const hasApiReviews = channel?.reviews && channel.reviews.length > 0;
  const reviews: Review[] = hasApiReviews
    ? channel!.reviews!.map((r, i) => ({
        id: r._id || String(i),
        name: r.reviewerName,
        initials: r.reviewerName
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        rating: r.rating,
        comment: r.text,
        date: r.createdAt
          ? new Date(r.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "",
      }))
    : generateMockReviews();

  const hasApiBenefits = channel?.benefits && channel.benefits.length > 0;
  const benefits: Benefit[] = hasApiBenefits
    ? channel!.benefits!.map((b) => ({
        icon: Check,
        title: b.title,
        description: b.description,
        iconEmoji: b.icon,
      }))
    : channel
      ? generateBenefits(channel.isFree)
      : [];

  const hasApiFaqs = channel?.faqs && channel.faqs.length > 0;
  const faqs: FAQ[] = hasApiFaqs
    ? channel!.faqs!
    : channel
      ? generateFAQs(channel.title, channel.isFree)
      : [];

  const creator = channel?.creator;

  const displayRating = channel?.rating || 4.8;
  const displayReviewCount = channel?.ratingCount || 156;

  useEffect(() => {
    fetchData();
  }, [slug, channelId]);

  async function fetchData() {
    try {
      setLoading(true);

      // Try to fetch channel from public endpoint first (includes organization data)
      try {
        const channelResponse = await api<{
          success: boolean;
          channel: Channel;
        }>(`/public/channels/${channelId}`, { method: "GET" });

        if (channelResponse.success && channelResponse.channel) {
          setChannel(channelResponse.channel);
          // Organization is included in the channel response
          if (channelResponse.channel.organization) {
            setOrganization(channelResponse.channel.organization);
          }
          return;
        }
      } catch {
        // Public endpoint failed, try fallback
      }

      // Fallback: Fetch organization separately
      const orgResponse = await api<{
        ok: boolean;
        organization: Organization;
      }>(`/guest-auth/hq-by-slug/${slug}`, { method: "GET" });

      if (orgResponse.ok && orgResponse.organization) {
        setOrganization(orgResponse.organization);
      }

      // Fallback: Fetch from hq-items
      const itemsResponse = await api<{
        ok: boolean;
        channels: Channel[];
      }>(`/guest-auth/hq-items/${slug}`, { method: "GET" });

      if (itemsResponse.ok && itemsResponse.channels) {
        const found = itemsResponse.channels.find((c) => c._id === channelId);
        if (found) {
          setChannel(found);
        }
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Failed to load channel details");
    } finally {
      setLoading(false);
    }
  }

  function toggleFAQ(index: number) {
    setExpandedFAQ((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: brandColor }} />
      </div>
    );
  }

  if (!channel || !organization) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <Hash className={`h-16 w-16 mb-4 ${theme === "dark" ? "text-zinc-700" : "text-gray-300"}`} />
        <h1 className={`text-2xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Channel Not Found</h1>
        <p className={`mb-6 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>The channel you're looking for doesn't exist.</p>
        <Link href={`/guest/${slug}${referSuffix}`}>
          <Button style={{ backgroundColor: brandColor }} className="text-black">Back to Office</Button>
        </Link>
      </div>
    );
  }

  const galleryImages = channel?.galleryImages || [];
  const images = [channel?.coverImage, ...galleryImages].filter(Boolean) as string[];
  const activeImg = activeGalleryImage || images[0] || "";

  // Helper: extract YouTube embed URL
  const getYTEmbedUrl = (url: string): string => {
    if (!url) return "";
    if (url.includes("youtu.be/")) {
      const parts = url.split("youtu.be/");
      if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
    } else if (url.includes("youtube.com/watch?v=")) {
      const parts = url.split("v=");
      if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("&")[0]}`;
    } else if (url.includes("youtube.com/embed/")) {
      const parts = url.split("embed/");
      if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
    }
    return "";
  };

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-zinc-950" : "bg-gray-50"}`}>
      <style>{`
        .brand-hover:hover { color: ${brandColor} !important; }
      `}</style>

      <GuestNavbar organization={organization} slug={slug} theme={theme} setTheme={setTheme} brandColor={brandColor} />

      {/* Hero Section */}
      <section
        className={theme === "dark" ? "bg-zinc-950" : "bg-gray-50"}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="lg:grid lg:grid-cols-5 lg:gap-8 items-start">
            {/* Left Content - 3 columns */}
            <div className="lg:col-span-3">
              {/* Badge */}
              <div className="mb-4 flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold rounded text-black"
                  style={{ backgroundColor: brandColor }}
                >
                  {channel.isFree ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {channel.isFree ? "Free Channel" : "Premium Channel"}
                </span>
                {channel.isSubscription && channel.subscriptionPeriod && (
                  <span className={`px-3 py-1 text-sm font-medium rounded capitalize ${theme === "dark" ? "bg-zinc-800 text-zinc-300" : "bg-zinc-200 text-zinc-700"}`}>
                    {channel.subscriptionPeriod}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className={`text-3xl md:text-4xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {channel.title}
              </h1>

              {/* Description with View More */}
              {channel.description && (
                <div className="mb-6">
                  <div
                    className={`text-lg [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_p]:mb-1 ${theme === "dark" ? "text-gray-300" : "text-gray-700"} ${!isDescriptionExpanded && channel.description.length > 200 ? "line-clamp-3" : ""}`}
                    dangerouslySetInnerHTML={{
                      __html: isDescriptionExpanded || channel.description.length <= 200
                        ? channel.description
                        : channel.description
                    }}
                  />
                  {channel.description.length > 200 && (
                    <button
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="mt-2 text-sm font-medium hover:underline"
                      style={{ color: brandColor }}
                    >
                      {isDescriptionExpanded ? "View less" : "View more"}
                    </button>
                  )}
                </div>
              )}

              {/* Rating & Members */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span style={{ color: brandColor }} className="font-bold">{displayRating}</span>
                  <StarRating rating={Math.round(displayRating)} size="sm" brandColor={brandColor} />
                  <span style={{ color: brandColor }}>({displayReviewCount} reviews)</span>
                </div>
                <div className={`flex items-center gap-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                  <Users className="h-4 w-4" />
                  <span>{(channel.memberCount || 0).toLocaleString()} members</span>
                </div>
              </div>

              {/* Creator */}
              <p className={`mb-4 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                Created by <span style={{ color: brandColor }} className="hover:underline cursor-pointer">{creator?.name || organization.name}</span>
              </p>

              {/* Meta Info */}
              <div className={`flex flex-wrap items-center gap-6 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Created {new Date(channel.createdAt || Date.now()).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>English</span>
                </div>
              </div>
            </div>

            {/* Right - Cover Image/Gallery + Video - 2 columns */}
            <div className="lg:col-span-2 mt-6 lg:mt-0 space-y-6">
              {/* Image Gallery */}
              {images.length > 0 ? (
                <div className="space-y-3">
                  {/* Active Image */}
                  <div className="relative rounded-xl overflow-hidden shadow-lg aspect-video border border-zinc-800">
                    <img
                      src={activeImg}
                      alt={channel.title}
                      className="w-full h-full object-cover"
                    />
                    {!channel.isFree && (
                      <div className="absolute top-3 right-3">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-black/60 text-white flex items-center gap-1">
                          <Crown className="h-3 w-3" style={{ color: brandColor }} />
                          Premium
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Thumbnails Row */}
                  {images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0">
                      {images.map((img, idx) => (
                        <button
                          key={img}
                          onClick={() => setActiveGalleryImage(img)}
                          className={cn(
                            "w-[64px] h-[44px] rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0",
                            activeImg === img
                              ? "border-[#FBD10D] scale-95"
                              : "border-transparent opacity-60 hover:opacity-100"
                          )}
                          style={{ borderColor: activeImg === img ? brandColor : "transparent" }}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden shadow-lg">
                  <div
                    className="w-full aspect-video flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${brandColor}40, ${brandColor}20)` }}
                  >
                    <Hash className="h-16 w-16 text-white/50" />
                  </div>
                  {!channel.isFree && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-black/60 text-white flex items-center gap-1">
                        <Crown className="h-3 w-3" style={{ color: brandColor }} />
                        Premium
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Introduction Video */}
              {(channel.videoUrl || channel.videoFile) && (() => {
                const embedUrl = channel.videoUrl ? getYTEmbedUrl(channel.videoUrl) : "";
                return (
                  <div className={`rounded-xl border p-4 shadow-lg ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 ${theme === "dark" ? "text-[#FBD10D]" : "text-gray-900"}`} style={{ color: theme === "dark" ? brandColor : undefined }}>
                      Introduction Video
                    </h3>
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-zinc-850 bg-black shadow-inner">
                      {embedUrl ? (
                        <iframe
                          src={embedUrl}
                          className="w-full h-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          title="Community Introduction Video"
                        />
                      ) : channel.videoFile ? (
                        <video
                          src={channel.videoFile}
                          controls
                          className="w-full h-full object-contain"
                          preload="metadata"
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Left Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Benefits */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {channel.isFree ? "What You Get" : "Membership Benefits"}
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className={`p-4 rounded-xl border ${theme === "dark" ? "bg-zinc-800/50 border-zinc-700" : "bg-gray-50 border-gray-200"}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${brandColor}20` }}>
                        {benefit.iconEmoji ? (
                          <span className="text-lg">{benefit.iconEmoji}</span>
                        ) : (
                          <benefit.icon className="h-5 w-5" style={{ color: brandColor }} />
                        )}
                      </div>
                      <div>
                        <h3 className={`font-semibold mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{benefit.title}</h3>
                        <p className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>{benefit.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Commission Plan (if available) */}
            {channel.combPlan && (
              <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                <h2 className={`text-xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Referral Commission</h2>
                <p className={`mb-6 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>
                  Earn up to {channel.combPlan.totalPercentage}% commission by referring new members
                </p>
                <div className="space-y-3">
                  {channel.combPlan.levels.map((level) => (
                    <div
                      key={level.level}
                      className={`flex items-center justify-between p-4 rounded-lg ${theme === "dark" ? "bg-zinc-800" : "bg-gray-50"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-black"
                          style={{ backgroundColor: brandColor }}
                        >
                          {level.level}
                        </div>
                        <span className={theme === "dark" ? "text-white" : "text-gray-900"}>{level.description}</span>
                      </div>
                      <span className="font-bold" style={{ color: brandColor }}>{level.percentage}%</span>
                    </div>
                  ))}
                </div>
                <div className={`mt-4 pt-4 border-t ${theme === "dark" ? "border-zinc-800" : "border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Total Commission</span>
                    <span className="text-lg font-bold" style={{ color: brandColor }}>{channel.combPlan.totalPercentage}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* About the Channel */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>About This Channel</h2>
              <div className="space-y-4">
                {channel.aboutText ? (
                  <div
                    className={`[&_strong]:font-bold [&_em]:italic [&_u]:underline [&_p]:mb-2 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}
                    dangerouslySetInnerHTML={{ __html: channel.aboutText }}
                  />
                ) : (
                  <>
                    <p className={theme === "dark" ? "text-zinc-400" : "text-gray-600"}>
                      {channel.title} is a {channel.isFree ? "free" : "premium"} community channel hosted by {organization.name}.
                      {channel.isFree
                        ? " Join for free to connect with other members, participate in discussions, and access shared resources."
                        : " As a member, you'll get exclusive access to premium content, private discussions, and special perks."}
                    </p>
                    <p className={theme === "dark" ? "text-zinc-400" : "text-gray-600"}>
                      With {(channel.memberCount || 0).toLocaleString()} members and growing, this is an active community
                      where you can learn, network, and grow together with like-minded individuals.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Channel Host */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Channel Host</h2>
              <div className="flex items-start gap-4">
                {creator?.profilePicture ? (
                  <img
                    src={creator.profilePicture}
                    alt={creator.name}
                    className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-black flex-shrink-0"
                    style={{ backgroundColor: brandColor }}
                  >
                    {(creator?.name || organization.name)?.split(" ").map(w => w[0]).join("").slice(0, 2) || "CH"}
                  </div>
                )}
                <div>
                  <h3 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    {creator?.name || organization.name}
                  </h3>
                  <p className={`mb-3 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>Community Host</p>
                  <div className={`flex flex-wrap items-center gap-6 text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4" style={{ color: brandColor, fill: brandColor }} />
                      <span>4.9 Host Rating</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{(channel.memberCount || 0).toLocaleString()} Members</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Member Reviews */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Member Reviews</h2>
              <div className="space-y-6">
                {reviews.map((review, idx) => (
                  <div key={review.id} className={`pb-6 ${idx !== reviews.length - 1 ? (theme === "dark" ? "border-b border-zinc-800" : "border-b border-gray-100") : ""}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold" style={{ backgroundColor: `${brandColor}30`, color: theme === "dark" ? "white" : brandColor }}>
                          {review.initials}
                        </div>
                        <div>
                          <h4 className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{review.name}</h4>
                          <p className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{review.date}</p>
                        </div>
                      </div>
                      <StarRating rating={review.rating} size="sm" brandColor={brandColor} />
                    </div>
                    <p className={theme === "dark" ? "text-zinc-400" : "text-gray-600"}>{review.comment}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Frequently Asked Questions</h2>
              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <div key={index} className={`border rounded-xl overflow-hidden ${theme === "dark" ? "border-zinc-800" : "border-gray-200"}`}>
                    <button
                      onClick={() => toggleFAQ(index)}
                      className={`w-full flex items-center justify-between p-4 transition-colors ${theme === "dark" ? "hover:bg-zinc-800/50" : "hover:bg-gray-50"}`}
                    >
                      <span className={`font-semibold text-left ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{faq.question}</span>
                      {expandedFAQ.has(index) ? (
                        <ChevronUp className={`h-5 w-5 flex-shrink-0 ${theme === "dark" ? "text-zinc-400" : "text-gray-400"}`} />
                      ) : (
                        <ChevronDown className={`h-5 w-5 flex-shrink-0 ${theme === "dark" ? "text-zinc-400" : "text-gray-400"}`} />
                      )}
                    </button>
                    {expandedFAQ.has(index) && (
                      <div className={`px-4 pb-4 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 mt-8 lg:mt-0">
            <div className="lg:sticky lg:top-24">
              <div className={`rounded-xl border overflow-hidden shadow-lg ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                <div className="p-6">
                  {/* Price */}
                  {!channel.isFree && (
                    <div className="mb-6">
                      <div className="text-4xl font-bold" style={{ color: brandColor }}>
                        {formatCurrency(channel.price, channel.currency)}
                      </div>
                      {channel.isSubscription && channel.subscriptionPeriod && (
                        <p className={`text-sm mt-1 ${theme === "dark" ? "text-zinc-400" : "text-gray-500"}`}>
                          per {channel.subscriptionPeriod}
                        </p>
                      )}
                    </div>
                  )}

                  {/* CTA */}
                  <Link href={`/checkout/channel/${channelId}${checkoutRef}`} target="_blank">
                    <Button
                      className="w-full h-12 font-semibold mb-4 cursor-pointer"
                      style={{ backgroundColor: brandColor, color: "black" }}
                    >
                      {channel.isFree ? (
                        <>
                          <Unlock className="h-5 w-5 mr-2" />
                          Join Free
                        </>
                      ) : (
                        <>
                          <Crown className="h-5 w-5 mr-2" />
                          Join Channel
                        </>
                      )}
                    </Button>
                  </Link>

                  <p className={`text-center text-sm mb-6 ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>
                    {channel.isFree ? "No credit card required" : "Cancel anytime. 7-day money-back guarantee."}
                  </p>

                  <div className={`border-t ${theme === "dark" ? "border-zinc-800" : "border-gray-200"} my-6`} />

                  {/* Channel includes */}
                  <div className="mb-6">
                    <h4 className={`font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>This channel includes:</h4>
                    <ul className="space-y-3">
                      {(channel.whatsIncluded && channel.whatsIncluded.length > 0
                        ? channel.whatsIncluded
                        : [
                            "Community discussions",
                            "Member directory",
                            channel.isFree ? "Public resources" : "Exclusive content",
                            channel.isFree ? "Basic support" : "Priority support",
                            !channel.isFree && channel.combPlan ? "Referral commissions" : null,
                          ].filter(Boolean)
                      ).map((item, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <Check className="h-4 w-4" style={{ color: "#10b981" }} />
                          <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={`border-t ${theme === "dark" ? "border-zinc-800" : "border-gray-200"} my-6`} />

                  {/* Channel Stats */}
                  <div className="space-y-3 text-sm">
                    {[
                      { label: "Members", value: (channel.memberCount || 0).toLocaleString() },
                      { label: "Created", value: new Date(channel.createdAt || Date.now()).toLocaleDateString("en-US", { month: "short", year: "numeric" }) },
                      { label: "Type", value: channel.isFree ? "Free" : "Premium" },
                      channel.isSubscription ? { label: "Billing", value: channel.subscriptionPeriod || "Monthly" } : null,
                    ].filter(Boolean).map((detail, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className={theme === "dark" ? "text-zinc-500" : "text-gray-500"}>{detail!.label}</span>
                        <span className={`font-medium capitalize ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{detail!.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className={`border-t ${theme === "dark" ? "border-zinc-800" : "border-gray-200"} my-6`} />

                  {/* Trust Badges */}
                  <div className="flex items-center justify-around">
                    {[
                      { icon: Shield, label: "Secure" },
                      { icon: Users, label: "Active" },
                      { icon: Heart, label: "Supportive" },
                    ].map((badge, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <badge.icon className={`h-5 w-5 ${theme === "dark" ? "text-zinc-500" : "text-gray-400"}`} />
                        <span className={`text-xs ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{badge.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
