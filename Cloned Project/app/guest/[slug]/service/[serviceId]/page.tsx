"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import {
  Star,
  Clock,
  Check,
  Building2,
  Code2,
  Palette,
  TrendingUp,
  Briefcase,
  MessageSquare,
  Phone,
  Mail,
  ArrowRight,
  Shield,
  Target,
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
  founders?: TeamMember[];
}

interface TeamMember {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
  country?: string;
  state?: string;
  city?: string;
  role?: string;
}

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
  projectsCompleted: number;
  activeOptIns: number;
  status: "draft" | "active" | "archived";
  organization?: Organization;
  whyChooseUs?: Array<{ icon: string; title: string; description: string }>;
  contactInfo?: { phone?: string; email?: string; whatsapp?: string };
}

interface ServiceReview {
  _id: string;
  serviceId: string;
  userId: string;
  rating: number;
  comment: string;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  isPublic: boolean;
  createdAt: string;
}

// Helper function to determine if a color is light or dark
function isLightColor(color: string): boolean {
  // Remove # if present
  const hex = color.replace("#", "");

  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate relative luminance using sRGB formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return true if light (luminance > 0.5)
  return luminance > 0.5;
}

// Get contrast text color based on background
function getContrastTextColor(bgColor: string): string {
  return isLightColor(bgColor) ? "text-zinc-900" : "text-white";
}

const MILESTONE_PREVIEW_COUNT = 4;

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

export default function ServiceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const serviceId = params.serviceId as string;
  const referCode = searchParams.get("referCode");
  const referSuffix = referCode ? `?referCode=${referCode}` : "";
  const checkoutRef = referCode ? `?ref=${referCode}` : "";

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [showAllMilestones, setShowAllMilestones] = useState(false);

  const brandColor = organization?.branding?.primaryColor || "#FBA70A";

  // Calculate average rating from reviews
  const averageRating = reviews.length > 0
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : 0;
  const reviewCount = reviews.length;

  // Escrow split shown on the checkout card: paid now vs released on approval
  const milestoneList = service?.milestones || [];
  const firstMilestoneAmount = milestoneList[0]?.paymentAmount || 0;
  const dueToday =
    service?.paymentTiming === "pay_before_milestone" ? firstMilestoneAmount : 0;
  const dueLater = Math.max((service?.totalPrice || 0) - dueToday, 0);

  const founder = organization?.founders?.[0] || null;
  const messageHref = service?.contactInfo?.whatsapp
    ? `https://wa.me/${service.contactInfo.whatsapp.replace(/[^0-9]/g, "")}`
    : service?.contactInfo?.email
      ? `mailto:${service.contactInfo.email}`
      : founder?.email
        ? `mailto:${founder.email}`
        : null;

  useEffect(() => {
    fetchData();
  }, [slug, serviceId]);


  async function fetchData() {
    try {
      setLoading(true);

      // Fetch organization
      try {
        const orgResponse = await api<{
          ok: boolean;
          organization: Organization;
        }>(`/guest-auth/hq-by-slug/${slug}`, { method: "GET" });

        if (orgResponse.ok && orgResponse.organization) {
          setOrganization(orgResponse.organization);
        }
      } catch {
        // Organization fetch failed, continue with mock data
      }

      // Try to fetch service from public endpoint first
      let fetchedService: Service | null = null;

      try {
        const serviceResponse = await api<{
          success: boolean;
          service: Service;
        }>(`/public/services/${serviceId}`, { method: "GET" });

        if (serviceResponse.success && serviceResponse.service) {
          fetchedService = serviceResponse.service;
          setService(serviceResponse.service);
          if (serviceResponse.service.organization) {
            setOrganization(serviceResponse.service.organization);
          }
        }
      } catch {
        // Public endpoint failed, try fallback
      }

      // Fetch service from items if not found
      if (!fetchedService) {
        try {
          const itemsResponse = await api<{
            ok: boolean;
            services?: Service[];
          }>(`/guest-auth/hq-items/${slug}`, { method: "GET" });

          if (itemsResponse.ok && itemsResponse.services) {
            // Support lookup by both _id and slug
            const foundService = itemsResponse.services.find(
              (s) => s._id === serviceId || s.slug === serviceId
            );
            if (foundService) {
              fetchedService = foundService;
              setService(foundService);
            }
          }
        } catch {
          // Items fetch failed
        }
      }

      // Fetch reviews for the service
      if (fetchedService) {
        try {
          const reviewsResponse = await api<{
            success: boolean;
            reviews: ServiceReview[];
          }>(`/public/services/${serviceId}/reviews`, { method: "GET" });

          if (reviewsResponse.success && reviewsResponse.reviews) {
            // Only show public reviews
            setReviews(reviewsResponse.reviews.filter(r => r.isPublic));
          }
        } catch {
          // Reviews fetch failed, continue without reviews
        }
      }

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load service details");
    } finally {
      setLoading(false);
    }
  }

  const getServiceIcon = (iconName?: string, bgColor?: string) => {
    const iconColorClass = bgColor ? getContrastTextColor(bgColor) : "text-white";
    switch (iconName) {
      case "code":
        return <Code2 className={`h-8 w-8 ${iconColorClass}`} />;
      case "design":
        return <Palette className={`h-8 w-8 ${iconColorClass}`} />;
      case "marketing":
        return <TrendingUp className={`h-8 w-8 ${iconColorClass}`} />;
      default:
        return <Briefcase className={`h-8 w-8 ${iconColorClass}`} />;
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: brandColor }}></div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}>
        <h1 className={`text-2xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>Service not found</h1>
        <Link href={`/guest/${slug}${referSuffix}`}>
          <Button variant="outline">Back to Organization</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-[#0B0C0E]" : "bg-zinc-50"}`}>
      {/* Brand Color CSS */}
      <style jsx global>{`
        .brand-hover:hover {
          color: ${brandColor} !important;
        }
        .brand-text {
          color: ${brandColor};
        }
        .brand-bg {
          background-color: ${brandColor};
        }
        .brand-border {
          border-color: ${brandColor};
        }
      `}</style>

      {organization && (
        <GuestNavbar organization={organization} slug={slug} theme={theme} setTheme={setTheme} brandColor={brandColor} />
      )}

      {/* Service detail */}
      <section className={`py-10 ${theme === "dark" ? "bg-[#0B0C0E]" : "bg-zinc-50"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Hero image and checkout card share the first row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              {/* Hero image */}
              <div
                className={`overflow-hidden rounded-2xl border ${
                  theme === "dark" ? "border-[#1E222B] bg-[#0F1116]" : "border-zinc-200 bg-zinc-100"
                }`}
              >
                {service.coverImage ? (
                  <img
                    src={service.coverImage}
                    alt={service.title}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex aspect-video w-full items-center justify-center"
                    style={{ backgroundColor: service.iconBgColor || brandColor }}
                  >
                    {getServiceIcon(service.icon, service.iconBgColor || brandColor)}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div
                className={`rounded-2xl border p-5 ${
                  theme === "dark" ? "border-[#1E222B] bg-[#141414]" : "border-zinc-200 bg-white"
                }`}
              >
                <p className={`text-[11px] font-medium uppercase tracking-wider ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>
                  {service.paymentTiming === "free" ? "Price" : "Total fixed contract price"}
                </p>
                <p className={`mt-1 text-3xl font-bold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                  {service.paymentTiming === "free"
                    ? "Free"
                    : formatCurrency(service.totalPrice, service.currency)}
                </p>

                {service.paymentTiming !== "free" && (
                  <div
                    className={`mt-4 flex items-start justify-between gap-4 rounded-xl border p-3 ${
                      theme === "dark" ? "border-[#1E222B] bg-[#1F1F1F]" : "border-zinc-200 bg-zinc-50"
                    }`}
                  >
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                        Due today
                      </p>
                      <p className={`mt-1 text-sm font-semibold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                        {formatCurrency(dueToday, service.currency)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                        Due later (on approval)
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: brandColor }}>
                        {formatCurrency(dueLater, service.currency)}
                      </p>
                    </div>
                  </div>
                )}

                <div className={`mt-4 space-y-2 text-xs ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                  {service.duration && (
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-zinc-500" />
                      Delivery duration:{" "}
                      <span className={`font-semibold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                        {service.duration}
                      </span>
                    </p>
                  )}
                  {founder && (
                    <p className="flex items-center gap-2">
                      {founder.profilePicture ? (
                        <img
                          src={founder.profilePicture}
                          alt={founder.name}
                          className="h-5 w-5 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[9px] font-semibold text-white">
                          {founder.name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                      Founder:{" "}
                      <span className={`font-semibold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                        {founder.name}
                      </span>
                      {reviewCount > 0 && (
                        <span className="text-zinc-500">({averageRating.toFixed(1)} rating)</span>
                      )}
                    </p>
                  )}
                </div>

                <Link
                  href={`/checkout/service/${service._id}${checkoutRef}`}
                  target="_blank"
                  className="mt-5 block"
                >
                  <Button
                    className={`h-11 w-full rounded-lg text-sm font-semibold cursor-pointer ${getContrastTextColor(brandColor)}`}
                    style={{ backgroundColor: brandColor }}
                  >
                    {service.paymentTiming === "free" ? "Get Service" : "Buy Service"}
                  </Button>
                </Link>

                {messageHref && (
                  <a
                    href={messageHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-2 flex h-11 w-full items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                      theme === "dark"
                        ? "border-[#1E222B] bg-[#1F1F1F] text-white hover:bg-[#2a2a35]"
                        : "border-zinc-200 bg-zinc-50 text-zinc-900 hover:bg-zinc-100"
                    }`}
                  >
                    Message founder
                  </a>
                )}

                <div
                  className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-[11px] ${
                    theme === "dark"
                      ? "border-[#1E222B] bg-[#1F1F1F] text-zinc-500"
                      : "border-zinc-200 bg-zinc-50 text-zinc-500"
                  }`}
                >
                  <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: brandColor }} />
                  <span>
                    Garage Pay Escrow • Approve before you pay
                    {service.projectsCompleted > 0
                      ? ` • ${service.projectsCompleted} delivered successfully`
                      : ""}
                  </span>
                </div>

                {service.contactInfo &&
                  (service.contactInfo.phone ||
                    service.contactInfo.email ||
                    service.contactInfo.whatsapp) && (
                    <div className={`mt-4 border-t pt-4 ${theme === "dark" ? "border-[#1E222B]" : "border-zinc-200"}`}>
                      <p className="text-[11px] text-zinc-500">Have questions? Reach out to us</p>
                      <div className="mt-2 flex items-center gap-2">
                        {service.contactInfo.phone && (
                          <a
                            href={`tel:${service.contactInfo.phone}`}
                            className={`rounded-lg p-2 transition-colors ${
                              theme === "dark" ? "bg-[#1B1E25] hover:bg-[#22262F]" : "bg-zinc-100 hover:bg-zinc-200"
                            }`}
                          >
                            <Phone className="h-4 w-4" style={{ color: brandColor }} />
                          </a>
                        )}
                        {service.contactInfo.email && (
                          <a
                            href={`mailto:${service.contactInfo.email}`}
                            className={`rounded-lg p-2 transition-colors ${
                              theme === "dark" ? "bg-[#1B1E25] hover:bg-[#22262F]" : "bg-zinc-100 hover:bg-zinc-200"
                            }`}
                          >
                            <Mail className="h-4 w-4" style={{ color: brandColor }} />
                          </a>
                        )}
                        {service.contactInfo.whatsapp && (
                          <a
                            href={`https://wa.me/${service.contactInfo.whatsapp.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`rounded-lg p-2 transition-colors ${
                              theme === "dark" ? "bg-[#1B1E25] hover:bg-[#22262F]" : "bg-zinc-100 hover:bg-zinc-200"
                            }`}
                          >
                            <MessageSquare className="h-4 w-4" style={{ color: brandColor }} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                <Link
                  href={`/guest/${slug}${referSuffix}#services`}
                  className={`mt-4 flex items-center justify-center gap-1 text-xs font-medium ${
                    theme === "dark" ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  View all services
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Title block */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {service.milestones && service.milestones.length > 0 && (
                <span
                  className="rounded-md border px-2 py-1 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${brandColor}1A`,
                    borderColor: `${brandColor}33`,
                    color: brandColor,
                  }}
                >
                  Milestone-based
                </span>
              )}
              {service.tags?.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className={`rounded-md border px-2 py-1 text-[10px] font-medium ${
                    theme === "dark"
                      ? "border-zinc-700 bg-zinc-800/70 text-zinc-300"
                      : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>

            <h1
              className={`mt-3 text-2xl sm:text-3xl font-bold tracking-tight ${
                theme === "dark" ? "text-white" : "text-zinc-900"
              }`}
            >
              {service.title}
            </h1>

            {reviewCount > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <StarRating rating={Math.round(averageRating)} brandColor={brandColor} />
                <span className={`font-semibold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                  {averageRating.toFixed(1)}
                </span>
                <span className={theme === "dark" ? "text-zinc-400" : "text-zinc-500"}>
                  ({reviewCount})
                </span>
              </div>
            )}
          </div>

          {/* Milestone stepper */}
          {service.milestones && service.milestones.length > 0 && (
            <div>
              <h2 className={`mb-4 text-lg font-bold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                How this works (Milestone Stepper)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[...service.milestones]
                  .sort((a, b) => a.order - b.order)
                  .slice(0, showAllMilestones ? undefined : MILESTONE_PREVIEW_COUNT)
                  .map((milestone, index) => (
                    <div
                      key={milestone._id}
                      className={`flex flex-col rounded-xl border p-4 ${
                        theme === "dark"
                          ? "border-[#1E222B] bg-[#13151A]"
                          : "border-zinc-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold"
                          style={{ backgroundColor: `${brandColor}26`, color: brandColor }}
                        >
                          {index + 1}
                        </span>
                        {milestone.duration && (
                          <span className={`text-[11px] ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>
                            {milestone.duration}
                          </span>
                        )}
                      </div>

                      <h3 className={`mt-4 line-clamp-2 min-h-[40px] text-sm font-semibold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                        {milestone.title}
                      </h3>

                      {/* Pinned to the bottom so price and badge line up across cards */}
                      <div className="mt-auto pt-3">
                        <div className="flex min-h-[18px] items-end justify-between gap-2">
                          <p className={`line-clamp-1 text-[11px] ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>
                            {milestone.description || ""}
                          </p>
                          {service.paymentTiming !== "free" && milestone.paymentAmount > 0 && (
                            <span className={`shrink-0 text-sm font-semibold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                              {formatCurrency(milestone.paymentAmount, milestone.currency || service.currency)}
                            </span>
                          )}
                        </div>

                        {service.paymentTiming !== "free" && (
                          <span
                            className={`mt-3 inline-flex rounded-md border px-2 py-1 text-[10px] font-medium ${
                              service.paymentTiming === "pay_before_milestone"
                                ? "border-amber-500/20 bg-amber-500/10 text-amber-500"
                                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                            }`}
                          >
                            {service.paymentTiming === "pay_before_milestone"
                              ? "Paid upfront"
                              : "Paid after approval"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              {service.milestones.length > MILESTONE_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllMilestones((prev) => !prev)}
                  className="mt-4 text-xs font-medium hover:underline"
                  style={{ color: brandColor }}
                >
                  {showAllMilestones
                    ? "Show less"
                    : `See all ${service.milestones.length} milestones`}
                </button>
              )}

              <p className={`mt-4 flex items-start gap-2 text-[11px] ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: brandColor }} />
                All payments remain safely secured in Garage Pay escrow and are only released
                to the founder upon your direct approval of deliverables.
              </p>
            </div>
          )}

          {/* What's Included */}
          {(service.features?.length > 0 || service.deliverables?.length > 0) && (
            <div>
              <h2 className={`mb-4 text-lg font-bold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                What&apos;s Included
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {[...(service.features || []), ...(service.deliverables || [])].map(
                  (item, index) => (
                    <div key={`${item}-${index}`} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                        <Check className="h-3 w-3 text-emerald-500" />
                      </span>
                      <span className={`text-sm ${theme === "dark" ? "text-zinc-300" : "text-zinc-700"}`}>
                        {item}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {(service.longDescription || service.description) && (
            <div>
              <h2 className={`mb-3 text-lg font-bold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                Description
              </h2>
              <p className={`whitespace-pre-wrap text-sm leading-relaxed ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                {service.longDescription || service.description}
              </p>
            </div>
          )}

          {/* Why Choose Us */}
          {service.whyChooseUs && service.whyChooseUs.length > 0 && (
            <div>
              <h2 className={`mb-4 text-lg font-bold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                Why choose us
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {service.whyChooseUs.map((card, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-4 ${
                      theme === "dark" ? "border-[#1E222B] bg-[#13151A]" : "border-zinc-200 bg-white"
                    }`}
                  >
                    {card.icon ? (
                      <img src={card.icon} alt="" className="mb-3 h-8 w-8 rounded-md object-cover" />
                    ) : (
                      <Target className="mb-3 h-8 w-8" style={{ color: brandColor }} />
                    )}
                    <h3 className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                      {card.title}
                    </h3>
                    {card.description && (
                      <p className={`mt-1 text-xs ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                        {card.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <div>
              <h2 className={`mb-4 text-lg font-bold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                Client Reviews
              </h2>
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review._id}
                    className={`rounded-xl border p-5 ${
                      theme === "dark" ? "border-[#1E222B] bg-[#13151A]" : "border-zinc-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {review.reviewerAvatar ? (
                        <img
                          src={review.reviewerAvatar}
                          alt={review.reviewerName}
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getContrastTextColor(brandColor)}`}
                          style={{ backgroundColor: brandColor }}
                        >
                          {review.reviewerName.split(" ").map((n) => n[0]).join("")}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <h4 className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                            {review.reviewerName}
                          </h4>
                          <StarRating rating={review.rating} size="sm" brandColor={brandColor} />
                        </div>
                        {review.reviewerRole && (
                          <p className={`mb-2 text-xs ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>
                            {review.reviewerRole}
                          </p>
                        )}
                        <p className={`text-sm ${theme === "dark" ? "text-zinc-300" : "text-zinc-700"}`}>
                          &ldquo;{review.comment}&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      {/* Footer */}
      <footer className={`py-8 border-t ${theme === "dark" ? "bg-[#0B0C0E] border-[#1E222B]" : "bg-white border-zinc-200"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {organization?.icon ? (
                <img src={organization.icon} alt={organization.name} className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center">
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
