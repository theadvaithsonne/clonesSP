"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { parseDateLocal, formatTime12Hour } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  Users,
  Clock,
  Globe,
  Calendar,
  Monitor,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  Download,
  Video,
  Code,
  Gift,
  MessageSquare,
  Bell,
  Play,
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

interface WorkshopAgendaData {
  title: string;
  duration: string;
  topics?: string[];
}

interface WorkshopBonusData {
  icon: string;
  title: string;
  description: string;
}

interface WorkshopReviewData {
  _id?: string;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  rating: number;
  text: string;
  helpfulCount?: number;
  createdAt?: string;
}

interface WorkshopFaqData {
  question: string;
  answer: string;
}

interface Workshop {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isFree: boolean;
  price: number;
  currency: string;
  maxParticipants?: number;
  isRecurring: boolean;
  isSubscription?: boolean;
  subscriptionPeriod?: string;
  registeredParticipants?: number;
  meetingUrl?: string;
  creator?: Creator;
  organization?: Organization;
  // Detail page fields
  rating?: number;
  ratingCount?: number;
  aboutText?: string;
  learningPoints?: string[];
  agenda?: WorkshopAgendaData[];
  bonuses?: WorkshopBonusData[];
  reviews?: WorkshopReviewData[];
  faqs?: WorkshopFaqData[];
  requirements?: string[];
  whatsIncluded?: string[];
  hostRating?: number;
  hostStudents?: string;
  hostWebinars?: string;
  hostExperience?: string;
}

interface AgendaItem {
  id: string;
  title: string;
  duration: string;
  topics: string[];
}

interface Review {
  id: string;
  name: string;
  initials: string;
  role: string;
  rating: number;
  comment: string;
  source: string;
}

// Calculate duration in minutes from start and end time
function calculateDuration(startTime: string, endTime: string): number {
  const parseTime = (time: string) => {
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3]?.toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return end > start ? end - start : (24 * 60 - start) + end;
}

// Generate mock agenda based on webinar title
function generateMockAgenda(title: string): AgendaItem[] {
  return [
    {
      id: "1",
      title: "Introduction & Architecture Patterns",
      duration: "20 min",
      topics: [
        "Component composition strategies",
        "Separation of concerns in apps",
        "Building reusable component libraries",
      ],
    },
    {
      id: "2",
      title: "Performance Optimization",
      duration: "25 min",
      topics: [
        "Identifying performance bottlenecks",
        "Memoization and caching strategies",
        "Bundle optimization techniques",
      ],
    },
    {
      id: "3",
      title: "State Management at Scale",
      duration: "20 min",
      topics: [
        "Choosing the right state solution",
        "Global vs local state patterns",
        "Real-world implementation examples",
      ],
    },
    {
      id: "4",
      title: "Live Q&A Session",
      duration: "25 min",
      topics: [
        "Interactive questions from attendees",
        "Code review and feedback",
        "Best practices discussion",
      ],
    },
  ];
}

function generateMockReviews(): Review[] {
  return [
    {
      id: "1",
      name: "David Chen",
      initials: "DC",
      role: "Senior Developer at Amazon",
      rating: 5,
      comment: "The webinars are always packed with actionable insights. The real-world examples were incredibly valuable for our team.",
      source: "From previous webinar",
    },
    {
      id: "2",
      name: "Emily Rodriguez",
      initials: "ER",
      role: "Tech Lead at Stripe",
      rating: 5,
      comment: "Best webinar I've attended. The Q&A session alone was worth it. The host takes time to answer every question thoroughly.",
      source: "From previous webinar",
    },
    {
      id: "3",
      name: "James Wilson",
      initials: "JW",
      role: "Frontend Developer",
      rating: 5,
      comment: "Great content and presentation. Learned several new optimization techniques that I immediately applied to my projects.",
      source: "From previous webinar",
    },
  ];
}

function generateLearningPoints(title: string): string[] {
  return [
    "Advanced component architecture patterns",
    "Performance optimization techniques for large applications",
    "State management best practices",
    "Code splitting and lazy loading strategies",
    "Error boundaries and error handling",
    "Testing strategies for scalable apps",
    "Deployment and CI/CD workflows",
    "Real-world case studies and examples",
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
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

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

export default function WebinarDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const webinarId = params.webinarId as string;
  const referCode = searchParams.get("referCode");
  const referSuffix = referCode ? `?referCode=${referCode}` : "";
  const checkoutRef = referCode ? `?ref=${referCode}` : "";

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [webinar, setWebinar] = useState<Workshop | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAgenda, setExpandedAgenda] = useState<Set<string>>(new Set(["1"]));
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const brandColor = organization?.branding?.primaryColor || "#FBA70A";

  // Use API data with graceful fallbacks to mock data
  const agenda = webinar?.agenda && webinar.agenda.length > 0
    ? webinar.agenda.map((item, i) => ({ id: String(i + 1), title: item.title, duration: item.duration, topics: item.topics || [] }))
    : webinar ? generateMockAgenda(webinar.title) : [];
  const reviews = webinar?.reviews && webinar.reviews.length > 0
    ? webinar.reviews.map((r, i) => ({
        id: r._id || String(i + 1),
        name: r.reviewerName,
        initials: r.reviewerName.split(" ").map(w => w[0]).join("").slice(0, 2),
        role: r.reviewerRole || "",
        rating: r.rating,
        comment: r.text,
        source: r.createdAt ? `Reviewed ${new Date(r.createdAt).toLocaleDateString()}` : "From previous webinar",
      }))
    : generateMockReviews();
  const learningPoints = webinar?.learningPoints && webinar.learningPoints.length > 0
    ? webinar.learningPoints
    : webinar ? generateLearningPoints(webinar.title) : [];

  const displayRating = webinar?.rating || 4.8;
  const displayReviewCount = webinar?.ratingCount || 342;
  const registeredParticipants = webinar?.registeredParticipants || 0;
  const maxSpots = webinar?.maxParticipants || 500;
  const spotsLeft = maxSpots - registeredParticipants;
  const duration = webinar ? calculateDuration(webinar.startTime, webinar.endTime) : 90;
  const creator = webinar?.creator;

  useEffect(() => {
    fetchData();
  }, [slug, webinarId]);

  async function fetchData() {
    try {
      setLoading(true);

      // Try to fetch webinar from public endpoint first (includes organization data)
      try {
        const webinarResponse = await api<{
          success: boolean;
          workshop: Workshop;
        }>(`/public/workshops/${webinarId}`, { method: "GET" });

        if (webinarResponse.success && webinarResponse.workshop) {
          setWebinar(webinarResponse.workshop);
          // Organization is included in the workshop response
          if (webinarResponse.workshop.organization) {
            setOrganization(webinarResponse.workshop.organization);
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
        workshops: Workshop[];
      }>(`/guest-auth/hq-items/${slug}`, { method: "GET" });

      if (itemsResponse.ok && itemsResponse.workshops) {
        const found = itemsResponse.workshops.find((w) => w._id === webinarId);
        if (found) {
          setWebinar(found);
        }
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Failed to load webinar details");
    } finally {
      setLoading(false);
    }
  }

  function toggleAgenda(id: string) {
    setExpandedAgenda((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: brandColor }}
        />
      </div>
    );
  }

  if (!webinar || !organization) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <Video className={`h-16 w-16 mb-4 ${theme === "dark" ? "text-zinc-700" : "text-gray-300"}`} />
        <h1 className={`text-2xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Webinar Not Found</h1>
        <p className={`mb-6 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>The webinar you're looking for doesn't exist.</p>
        <Link href={`/guest/${slug}${referSuffix}`}>
          <Button style={{ backgroundColor: brandColor }} className="text-black">Back to Office</Button>
        </Link>
      </div>
    );
  }

  const defaultBonuses = [
    { icon: Download, title: "Webinar Recording", description: "Lifetime access to the full recording", iconEmoji: undefined as string | undefined },
    { icon: Code, title: "Code Samples & Templates", description: "Production-ready code examples and boilerplates", iconEmoji: undefined as string | undefined },
    { icon: Gift, title: "Exclusive Resources", description: "Curated list of tools and libraries", iconEmoji: undefined as string | undefined },
    { icon: MessageSquare, title: "Community Access", description: "Join our private channel for ongoing discussions", iconEmoji: undefined as string | undefined },
  ];

  const bonuses = webinar?.bonuses && webinar.bonuses.length > 0
    ? webinar.bonuses.map((b) => ({
        icon: Gift, // fallback Lucide icon
        title: b.title,
        description: b.description,
        iconEmoji: b.icon, // use the API icon as emoji/text
      }))
    : defaultBonuses;

  const webinarIncludes = webinar?.whatsIncluded && webinar.whatsIncluded.length > 0
    ? webinar.whatsIncluded
    : [
        `Live ${duration} minutes session`,
        "Interactive Q&A session",
        "Recording access",
        "Bonus resources",
        "Certificate of attendance",
        "Community access",
      ];

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-zinc-950" : "bg-gray-50"}`}>
      {/* Dynamic brand color styles */}
      <style>{`
        .brand-hover:hover { color: ${brandColor} !important; }
        .brand-text { color: ${brandColor}; }
        .brand-bg { background-color: ${brandColor}; }
      `}</style>

      {/* Header */}
      <GuestNavbar organization={organization} slug={slug} theme={theme} setTheme={setTheme} brandColor={brandColor} />

      {/* Hero Section */}
      <section
        className={theme === "dark" ? "bg-zinc-950" : "bg-gray-50"}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="lg:grid lg:grid-cols-5 lg:gap-8 items-start">
            {/* Left Content - 3 columns */}
            <div className="lg:col-span-3">
              {/* Live Badge */}
              <div className="mb-4">
                <span
                  className="inline-block px-3 py-1 text-sm font-semibold rounded text-black"
                  style={{ backgroundColor: brandColor }}
                >
                  Live Webinar
                </span>
              </div>

              {/* Title */}
              <h1 className={`text-3xl md:text-4xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {webinar.title}
              </h1>

              {/* Description with View More */}
              {webinar.description && (
                <div className="mb-6">
                  <p className={`text-lg ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                    {isDescriptionExpanded || webinar.description.length <= 200
                      ? webinar.description
                      : `${webinar.description.slice(0, 200)}...`}
                  </p>
                  {webinar.description.length > 200 && (
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

              {/* Rating & Registered */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span style={{ color: brandColor }} className="font-bold">{displayRating}</span>
                  <StarRating rating={Math.round(displayRating)} size="sm" brandColor={brandColor} />
                  <span style={{ color: brandColor }}>({displayReviewCount} reviews)</span>
                </div>
                <div className={`flex items-center gap-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                  <Users className="h-4 w-4" />
                  <span>{registeredParticipants} registered</span>
                </div>
              </div>

              {/* Host Info */}
              <p className={`mb-4 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                Hosted by <span style={{ color: brandColor }} className="hover:underline cursor-pointer">{creator?.name || organization.name}</span>
              </p>

              {/* Event Details */}
              <div className={`flex flex-wrap items-center gap-6 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {parseDateLocal(webinar.date).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime12Hour(webinar.startTime)} - {formatTime12Hour(webinar.endTime)} ({webinar.timezone})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  <span>{duration} minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>English</span>
                </div>
              </div>
            </div>

            {/* Right - Thumbnail - 2 columns */}
            <div className="lg:col-span-2 mt-6 lg:mt-0">
              <div className="relative rounded-xl overflow-hidden shadow-lg">
                {webinar.thumbnail ? (
                  <img
                    src={webinar.thumbnail}
                    alt={webinar.title}
                    className="w-full aspect-video object-cover"
                  />
                ) : (
                  <div
                    className="w-full aspect-video flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${brandColor}40, ${brandColor}20)` }}
                  >
                    <Video className="h-16 w-16 text-white/50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <button className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center hover:scale-105 transition-transform">
                    <Play className="h-6 w-6 text-gray-900 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Left Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* What You'll Learn */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>What You'll Learn</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {learningPoints.map((point, index) => (
                  <div key={index} className="flex gap-3">
                    <Check className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: brandColor }} />
                    <span className={theme === "dark" ? "text-zinc-300" : "text-gray-700"}>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Webinar Agenda */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Webinar Agenda</h2>
              <div className="space-y-3">
                {agenda.map((item, index) => (
                  <div key={item.id} className={`border rounded-xl overflow-hidden ${theme === "dark" ? "border-zinc-800" : "border-gray-200"}`}>
                    <button
                      onClick={() => toggleAgenda(item.id)}
                      className={`w-full flex items-center justify-between p-4 transition-colors ${
                        theme === "dark" ? "hover:bg-zinc-800/50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-black"
                          style={{ backgroundColor: brandColor }}
                        >
                          {index + 1}
                        </div>
                        <div className="text-left">
                          <h3 className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{item.title}</h3>
                          <p className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{item.duration}</p>
                        </div>
                      </div>
                      {expandedAgenda.has(item.id) ? (
                        <ChevronUp className={`h-5 w-5 ${theme === "dark" ? "text-zinc-400" : "text-gray-400"}`} />
                      ) : (
                        <ChevronDown className={`h-5 w-5 ${theme === "dark" ? "text-zinc-400" : "text-gray-400"}`} />
                      )}
                    </button>
                    {expandedAgenda.has(item.id) && (
                      <div className={`px-4 pb-4 pl-16 space-y-2 ${theme === "dark" ? "border-t border-zinc-800" : "border-t border-gray-100"}`}>
                        <div className="pt-4">
                          {item.topics.map((topic, i) => (
                            <div key={i} className="flex items-center gap-2 py-1">
                              <Zap className="h-4 w-4" style={{ color: brandColor }} />
                              <span className={theme === "dark" ? "text-zinc-400" : "text-gray-600"}>{topic}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Exclusive Bonuses */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Exclusive Bonuses Included</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {bonuses.map((bonus, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border ${theme === "dark" ? "bg-zinc-800/50 border-zinc-700" : "bg-gray-50 border-gray-200"}`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${brandColor}20` }}
                      >
                        {bonus.iconEmoji ? (
                          <span className="text-xl">{bonus.iconEmoji}</span>
                        ) : (
                          <bonus.icon className="h-6 w-6" style={{ color: brandColor }} />
                        )}
                      </div>
                      <div>
                        <h3 className={`font-semibold mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{bonus.title}</h3>
                        <p className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>{bonus.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Requirements</h2>
              <ul className="space-y-3">
                {(webinar?.requirements && webinar.requirements.length > 0
                  ? webinar.requirements
                  : [
                      "Basic understanding of programming concepts",
                      "Familiarity with web development fundamentals",
                      "A computer with internet connection",
                    ]
                ).map((req, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="h-5 w-5" style={{ color: brandColor }} />
                    <span className={theme === "dark" ? "text-zinc-300" : "text-gray-700"}>{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* About This Webinar */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>About This Webinar</h2>
              {webinar.aboutText ? (
                <div
                  className={theme === "dark" ? "text-zinc-400" : "text-gray-600"}
                  dangerouslySetInnerHTML={{ __html: webinar.aboutText }}
                />
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className={`font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Webinar Overview</h3>
                    <p className={theme === "dark" ? "text-zinc-400" : "text-gray-600"}>
                      Join {organization.name} for an exclusive deep dive into building production-ready applications.
                      This interactive session will cover advanced patterns, performance optimization, and real-world case studies.
                    </p>
                  </div>
                  <div>
                    <h3 className={`font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>What Makes This Webinar Special?</h3>
                    <p className={theme === "dark" ? "text-zinc-400" : "text-gray-600"}>
                      Get insider knowledge from industry experts. You'll receive practical insights, code examples, and get your questions answered live.
                      Plus, all attendees get access to exclusive resources and the webinar recording.
                    </p>
                  </div>
                  <div>
                    <h3 className={`font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Who Should Attend?</h3>
                    <ul className={`space-y-1 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>
                      <li>Developers looking to level up their skills</li>
                      <li>Engineering leads architecting large applications</li>
                      <li>Anyone building production applications</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Your Host */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Your Host</h2>
              <div className="flex items-start gap-6">
                {creator?.profilePicture ? (
                  <img
                    src={creator.profilePicture}
                    alt={creator.name}
                    className="w-24 h-24 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-black flex-shrink-0"
                    style={{ backgroundColor: brandColor }}
                  >
                    {(creator?.name || organization.name)?.split(" ").map(w => w[0]).join("").slice(0, 2) || "HO"}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className={`text-xl font-semibold mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    {creator?.name || organization.name}
                  </h3>
                  <p className="mb-3" style={{ color: brandColor }}>Webinar Host</p>
                  <div className={`flex flex-wrap items-center gap-6 text-sm mb-4 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4" style={{ color: brandColor, fill: brandColor }} />
                      <span>{webinar.hostRating || 4.9} Host Rating</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{webinar.hostStudents || "15,000"} Students</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Video className="h-4 w-4" />
                      <span>{webinar.hostWebinars || "24"} Webinars</span>
                    </div>
                  </div>
                  <p className={theme === "dark" ? "text-zinc-400" : "text-gray-600"}>
                    With {webinar.hostExperience || "12+ years of"} experience building large-scale web applications, {creator?.name || organization.name} has helped thousands of developers
                    level up their skills through courses and live webinars.
                  </p>
                </div>
              </div>
            </div>

            {/* Attendee Reviews */}
            <div className={`rounded-xl border p-6 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Attendee Reviews</h2>
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className={`pb-6 ${review.id !== "3" ? (theme === "dark" ? "border-b border-zinc-800" : "border-b border-gray-100") : ""}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-black"
                          style={{ backgroundColor: `${brandColor}40` }}
                        >
                          <span style={{ color: theme === "dark" ? "white" : brandColor }}>{review.initials}</span>
                        </div>
                        <div>
                          <h4 className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{review.name}</h4>
                          <p className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{review.role}</p>
                        </div>
                      </div>
                      <StarRating rating={review.rating} size="sm" brandColor={brandColor} />
                    </div>
                    <p className={`mb-2 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>{review.comment}</p>
                    <p className={`text-sm ${theme === "dark" ? "text-zinc-600" : "text-gray-400"}`}>{review.source}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Sticky */}
          <div className="lg:col-span-1 mt-8 lg:mt-0">
            <div className="lg:sticky lg:top-24">
              <div className={`rounded-xl border overflow-hidden shadow-lg ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                <div className="p-6">
                  {/* Price */}
                  <div className="mb-4">
                    {webinar.isFree ? (
                      <div className="text-4xl font-bold" style={{ color: "#10b981" }}>FREE</div>
                    ) : (
                      <div className="flex items-baseline gap-3">
                        <span className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                          {formatCurrency(webinar.price, webinar.currency)}
                        </span>
                      </div>
                    )}
                    <p className={`text-sm mt-1 ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>Limited spots available</p>
                  </div>

                  {/* Spots Left */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{spotsLeft} spots left</span>
                      <span className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{registeredParticipants}/{maxSpots}</span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${theme === "dark" ? "bg-zinc-800" : "bg-gray-200"}`}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(registeredParticipants / maxSpots) * 100}%`,
                          backgroundColor: "#10b981",
                        }}
                      />
                    </div>
                  </div>

                  {/* CTA Button */}
                  <Link href={`/checkout/workshop/${webinarId}${checkoutRef}`} target="_blank">
                    <Button
                      className="w-full h-12 text-white font-semibold mb-4 cursor-pointer"
                      style={{ backgroundColor: "#7c3aed" }}
                    >
                      <Bell className="h-5 w-5 mr-2" />
                      Reserve Your Spot
                    </Button>
                  </Link>

                  <p className={`text-center text-sm mb-6 ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>
                    Secure your spot now. You'll receive a confirmation email with the webinar link.
                  </p>

                  {/* Divider */}
                  <div className={`border-t ${theme === "dark" ? "border-zinc-800" : "border-gray-200"} my-6`} />

                  {/* This webinar includes */}
                  <div className="mb-6">
                    <h4 className={`font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>This webinar includes:</h4>
                    <ul className="space-y-3">
                      {webinarIncludes.map((item, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <Check className="h-4 w-4" style={{ color: "#10b981" }} />
                          <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Divider */}
                  <div className={`border-t ${theme === "dark" ? "border-zinc-800" : "border-gray-200"} my-6`} />

                  {/* Meta Info */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Globe className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-gray-400"}`} />
                      <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>English</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Monitor className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-gray-400"}`} />
                      <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>Live online via Zoom</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Download className={`h-4 w-4 ${theme === "dark" ? "text-zinc-500" : "text-gray-400"}`} />
                      <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>Downloadable resources</span>
                    </div>
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
