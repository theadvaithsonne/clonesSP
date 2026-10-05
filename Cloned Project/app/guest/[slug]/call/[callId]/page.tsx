"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import {
  Star,
  Users,
  Clock,
  Check,
  Building2,
  Phone,
  Mail,
  ArrowRight,
  Award,
  Shield,
  Video,
  Calendar,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import GuestNavbar from "../../components/GuestNavbar";

interface Organization {
  _id: string;
  name: string;
  slug?: string;
  icon?: string;
  branding?: {
    primaryColor?: string;
  };
  description?: string;
  founders?: Founder[];
}

interface Founder {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
  role?: string;
}

interface IntakeQuestion {
  _id?: string;
  question: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  required: boolean;
}

interface CallReview {
  _id: string;
  rating: number;
  comment: string;
  reviewer: {
    _id: string;
    name: string;
    profilePicture?: string;
  };
  createdAt: string;
}

interface CallTopic {
  title: string;
  description: string;
}

interface CallHowItWorks {
  icon: string;
  title: string;
  description: string;
}

interface CallFaq {
  question: string;
  answer: string;
}

interface CallOffering {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  duration: number;
  pricePerCall: number;
  currency: string;
  isFree: boolean;
  intakeQuestions?: IntakeQuestion[];
  totalPurchased?: number;
  totalUsed?: number;
  totalScheduled?: number;
  purchaseCount?: number;
  averageRating?: number;
  reviewCount?: number;
  creator?: {
    _id: string;
    name: string;
    profilePicture?: string;
    email?: string;
    role?: string;
    country?: string;
    state?: string;
    city?: string;
  };
  organization?: Organization;
  channels?: { _id: string; title: string }[];
  reviews?: CallReview[];
  whatsIncluded?: string[];
  topicsWeCover?: CallTopic[];
  howItWorks?: CallHowItWorks[];
  faqs?: CallFaq[];
  createdAt?: string;
  updatedAt?: string;
}

function isLightColor(color: string): boolean {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

function getContrastTextColor(bgColor: string): string {
  return isLightColor(bgColor) ? "text-zinc-900" : "text-white";
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
          style={{
            color: star <= rating ? starColor : "#d1d5db",
            fill: star <= rating ? starColor : "#d1d5db",
          }}
        />
      ))}
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  return `${minutes} minutes`;
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", INR: "₹", JPY: "¥", AUD: "A$", CAD: "C$",
  };
  return symbols[currency?.toUpperCase()] || currency || "$";
}

export default function CallDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const callId = params.callId as string;
  const referCode = searchParams.get("referCode");
  const referSuffix = referCode ? `?referCode=${referCode}` : "";
  const checkoutRef = referCode ? `?ref=${referCode}` : "";

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [call, setCall] = useState<CallOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const brandColor = organization?.branding?.primaryColor || "#FBA70A";

  useEffect(() => {
    fetchData();
  }, [slug, callId]);

  async function fetchData() {
    try {
      setLoading(true);

      let orgId: string | null = null;
      try {
        const orgResponse = await api<{
          ok: boolean;
          organization: Organization;
        }>(`/guest-auth/hq-by-slug/${slug}`, { method: "GET" });

        if (orgResponse.ok && orgResponse.organization) {
          setOrganization(orgResponse.organization);
          orgId = orgResponse.organization._id;
        }
      } catch {
        // Organization fetch failed
      }

      if (orgId) {
        try {
          const callResponse = await api<{
            success?: boolean;
            call?: CallOffering;
            callOffering?: CallOffering;
            organization?: Organization;
            founders?: Founder[];
          }>(`/public/calls/${orgId}/${callId}`, { method: "GET" });

          const callData = callResponse.call || callResponse.callOffering;
          if (callData) {
            setCall(callData);
            if (callData.organization) {
              setOrganization(callData.organization);
            } else if (callResponse.organization) {
              setOrganization(callResponse.organization);
            }
          }
        } catch {
          // Call fetch failed
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load call details");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: brandColor }}></div>
      </div>
    );
  }

  if (!call) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <h1 className={`text-2xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>Call not found</h1>
        <Link href={`/guest/${slug}${referSuffix}`}>
          <Button variant="outline">Back to Organization</Button>
        </Link>
      </div>
    );
  }

  const reviews = call.reviews || [];
  const averageRating = call.averageRating || 0;
  const reviewCount = call.reviewCount || 0;
  const totalCompleted = call.totalPurchased || 0;
  const currencySymbol = getCurrencySymbol(call.currency);

  // What's Included - only show when data exists
  const whatsIncluded = call.whatsIncluded && call.whatsIncluded.length > 0
    ? call.whatsIncluded
    : null;

  // Topics We Cover - only show when data exists
  const topics = call.topicsWeCover && call.topicsWeCover.length > 0
    ? call.topicsWeCover.map((t) => ({ title: t.title, desc: t.description }))
    : null;

  // How It Works - only show when data exists
  const howItWorks = call.howItWorks && call.howItWorks.length > 0 ? call.howItWorks : null;

  // FAQs - only show when data exists
  const faqList = call.faqs && call.faqs.length > 0
    ? call.faqs.map((f) => ({ q: f.question, a: f.answer }))
    : null;

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-zinc-950" : "bg-zinc-50"}`}>
      {/* Brand Color CSS */}
      <style>{`
        .brand-hover:hover { color: ${brandColor} !important; }
      `}</style>

      {organization && (
        <GuestNavbar organization={organization} slug={slug} theme={theme} setTheme={setTheme} brandColor={brandColor} />
      )}

      {/* Hero Section */}
      <section
        className={`relative pt-10 pb-16 md:pt-14 md:pb-24 ${theme === "dark" ? "bg-zinc-950" : "bg-zinc-50"}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Hero Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left Content */}
            <div>
              {/* Category Badge */}
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-6"
                style={{ backgroundColor: `${brandColor}1A`, color: brandColor }}
              >
                1-on-1 Coaching
              </span>

              {/* Title */}
              <h1 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                {call.title}
              </h1>

              {/* Short Description */}
              {call.description && (
                <p className={`text-lg mb-8 ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                  {call.description.length > 120 ? call.description.slice(0, 120) + "..." : call.description}
                </p>
              )}

              {/* Stat Cards */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {/* Rating Card */}
                <div className={`p-5 rounded-xl border ${
                  theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="h-5 w-5" style={{ color: "#f59e0b", fill: "#f59e0b" }} />
                    <span className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                      {averageRating > 0 ? averageRating.toFixed(1) : "5.0"}
                    </span>
                  </div>
                  <p className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>
                    {reviewCount > 0 ? `${reviewCount} ratings` : "New"}
                  </p>
                </div>

                {/* Calls Completed Card */}
                <div className={`p-5 rounded-xl border ${
                  theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Users className={`h-5 w-5 ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`} />
                    <span className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                      {totalCompleted > 0 ? `${totalCompleted}+` : "0"}
                    </span>
                  </div>
                  <p className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>
                    Calls completed
                  </p>
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Clock className={`h-5 w-5 flex-shrink-0 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`} />
                  <span className={theme === "dark" ? "text-zinc-300" : "text-zinc-700"}>
                    <strong>Duration:</strong> {formatDuration(call.duration)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Video className={`h-5 w-5 flex-shrink-0 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`} />
                  <span className={theme === "dark" ? "text-zinc-300" : "text-zinc-700"}>
                    <strong>Format:</strong> Video Call
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Users className={`h-5 w-5 flex-shrink-0 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`} />
                  <span className={theme === "dark" ? "text-zinc-300" : "text-zinc-700"}>
                    <strong>Participants:</strong> 1-on-1 Private Session
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className={`h-5 w-5 flex-shrink-0 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`} />
                  <span className={theme === "dark" ? "text-zinc-300" : "text-zinc-700"}>
                    <strong>Next Available:</strong> This Week - Multiple slots available
                  </span>
                </div>
              </div>
            </div>

            {/* Right - Cover Image */}
            <div className="flex justify-center lg:justify-end">
              {call.coverImage ? (
                <img
                  src={call.coverImage}
                  alt={call.title}
                  className="w-full max-w-lg rounded-2xl object-cover shadow-lg"
                  style={{ maxHeight: "520px" }}
                />
              ) : (
                <div
                  className={`w-full max-w-lg rounded-2xl flex items-center justify-center ${
                    theme === "dark" ? "bg-zinc-900" : "bg-zinc-200"
                  }`}
                  style={{ height: "520px" }}
                >
                  <Phone className={`h-24 w-24 ${theme === "dark" ? "text-zinc-700" : "text-zinc-400"}`} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content + Sticky Sidebar */}
      <section className={`py-16 ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Left Content - 2 cols */}
            <div className="lg:col-span-2 space-y-16">

              {/* About This Call */}
              {call.description && (
                <div>
                  <h2 className={`text-3xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                    About This Call
                  </h2>
                  <div className={`prose max-w-none ${theme === "dark" ? "text-zinc-300" : "text-zinc-700"}`}>
                    <p className="whitespace-pre-line text-base leading-relaxed">{call.description}</p>
                  </div>
                </div>
              )}

              {/* What's Included */}
              {whatsIncluded && (
                <div>
                  <h2 className={`text-3xl font-bold mb-8 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                    What&apos;s Included
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {whatsIncluded.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className={theme === "dark" ? "text-zinc-300" : "text-zinc-700"}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics We Cover */}
              {topics && (
                <div>
                  <h2 className={`text-3xl font-bold mb-8 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                    Topics We Cover
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {topics.map((topic, i) => (
                      <div
                        key={i}
                        className={`p-5 rounded-xl border ${
                          theme === "dark"
                            ? "bg-zinc-900 border-zinc-800"
                            : "bg-white border-zinc-200"
                        }`}
                      >
                        <h4 className={`font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                          {topic.title}
                        </h4>
                        <p className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                          {topic.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* How It Works */}
              {howItWorks && (
                <div>
                  <h2 className={`text-3xl font-bold mb-8 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                    How It Works
                  </h2>
                  <div className="space-y-6">
                    {howItWorks.map((step, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                          style={{ backgroundColor: `${brandColor}1A` }}
                        >
                          {step.icon ? (
                            <img src={step.icon} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg font-bold" style={{ color: brandColor }}>{i + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <h4 className={`font-semibold mb-1 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                            {i + 1}. {step.title}
                          </h4>
                          <p className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                            {step.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What People Say - Reviews */}
              {reviews.length > 0 && (
                <div>
                  <h2 className={`text-3xl font-bold mb-8 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                    What People Say
                  </h2>
                  <div className="space-y-6">
                    {reviews.map((review) => {
                      const initials = review.reviewer?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "?";
                      return (
                        <div
                          key={review._id}
                          className={`p-6 rounded-xl border ${
                            theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-4">
                            {review.reviewer?.profilePicture ? (
                              <img
                                src={review.reviewer.profilePicture}
                                alt={review.reviewer.name}
                                className="w-11 h-11 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white"
                                style={{ backgroundColor: brandColor }}
                              >
                                {initials}
                              </div>
                            )}
                            <div>
                              <h4 className={`font-semibold text-sm ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                                {review.reviewer?.name || "Anonymous"}
                              </h4>
                              <StarRating rating={review.rating} size="sm" brandColor="#f59e0b" />
                            </div>
                          </div>
                          <p className={`italic text-sm leading-relaxed ${theme === "dark" ? "text-zinc-300" : "text-zinc-700"}`}>
                            &ldquo;{review.comment}&rdquo;
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* FAQ */}
              {faqList && (
                <div>
                  <h2 className={`text-3xl font-bold mb-8 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                    Frequently Asked Questions
                  </h2>
                  <div className="space-y-3">
                    {faqList.map((faq, i) => (
                      <div
                        key={i}
                        className={`rounded-xl border overflow-hidden ${
                          theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                        }`}
                      >
                        <button
                          onClick={() => setExpandedFAQ(expandedFAQ === i ? null : i)}
                          className="w-full flex items-center justify-between px-6 py-4 text-left"
                        >
                          <span className={`font-medium ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                            {faq.q}
                          </span>
                          {expandedFAQ === i ? (
                            <ChevronUp className={`h-5 w-5 shrink-0 ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`} />
                          ) : (
                            <ChevronDown className={`h-5 w-5 shrink-0 ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`} />
                          )}
                        </button>
                        {expandedFAQ === i && (
                          <div className={`px-6 pb-4 ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                            <p className="text-sm leading-relaxed">{faq.a}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Sticky Sidebar - 1 col */}
            <div className="lg:col-span-1">
              <div className={`sticky top-24 rounded-2xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
                {/* Price */}
                <div className="text-center mb-6">
                  {call.isFree ? (
                    <p className="text-4xl font-bold text-emerald-500">Free</p>
                  ) : (
                    <p className={`text-4xl font-bold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                      {currencySymbol}{call.pricePerCall.toLocaleString()}
                    </p>
                  )}
                  <p className={`text-sm mt-1 ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>
                    {call.isFree ? "No payment required" : "One-time investment"}
                  </p>
                </div>

                {/* Book Now Button */}
                <Link href={`/checkout/call/${callId}${checkoutRef}`} target="_blank">
                  <Button
                    className={`w-full h-12 text-base font-semibold mb-6 cursor-pointer ${getContrastTextColor(brandColor)}`}
                    style={{
                      background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}CC 100%)`,
                    }}
                  >
                    Book Now
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>

                {/* Guarantees */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span className={`text-sm ${theme === "dark" ? "text-zinc-300" : "text-zinc-700"}`}>Instant booking confirmation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span className={`text-sm ${theme === "dark" ? "text-zinc-300" : "text-zinc-700"}`}>Flexible rescheduling</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span className={`text-sm ${theme === "dark" ? "text-zinc-300" : "text-zinc-700"}`}>100% satisfaction guarantee</span>
                  </div>
                </div>

                {/* Contact Us */}
                <div className={`pt-6 border-t ${theme === "dark" ? "border-zinc-800" : "border-zinc-200"}`}>
                  <p className={`text-sm text-center mb-3 ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                    Have questions? Want to discuss your needs first?
                  </p>
                  <Button
                    variant="outline"
                    className={`w-full ${theme === "dark" ? "border-zinc-700 text-white hover:bg-zinc-800" : "border-zinc-200 text-zinc-900 hover:bg-zinc-50"}`}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Us
                  </Button>
                </div>

                {/* Trust Badges */}
                <div className={`mt-6 pt-6 border-t space-y-3 ${theme === "dark" ? "border-zinc-800" : "border-zinc-200"}`}>
                  <div className="flex items-center gap-2">
                    <Shield className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`} />
                    <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>Secure payment processing</span>
                  </div>
                  {totalCompleted > 0 && (
                    <div className="flex items-center gap-2">
                      <Award className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`} />
                      <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>{totalCompleted}+ successful calls</span>
                    </div>
                  )}
                  {averageRating > 0 && (
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4" style={{ color: "#f59e0b", fill: "#f59e0b" }} />
                      <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>{averageRating.toFixed(1)} average rating</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-8 border-t ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {organization?.icon ? (
                <img src={organization.icon} alt={organization.name} className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"}`}>
                  <Building2 className="h-4 w-4 text-zinc-400" />
                </div>
              )}
              <span className={`font-semibold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                {organization?.name}
              </span>
            </div>
            <p className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>
              &copy; {new Date().getFullYear()} {organization?.name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
