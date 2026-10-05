"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Loader2,
  Star,
  Quote,
  ChevronRight,
  Share2,
  Check,
} from "lucide-react";
import {
  getPublicTestimonials,
  type TestimonialListItem,
  type OrganizationInfo,
  type FounderInfo,
} from "@/lib/testimonials-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { getToken } from "@/lib/auth";

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

// Category chip component
function CategoryChip({
  category,
  isActive,
  onClick,
}: {
  category: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
        isActive
          ? "bg-[#FBD10D] text-black"
          : "bg-[#1e1e2d] text-[#9fa0b8] hover:bg-[#2a2a35] hover:text-white border border-[#2a2a35]"
      )}
    >
      {category}
    </button>
  );
}

// Robust clipboard copy with fallback for production environments
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

// Testimonial Card Component
function TestimonialCard({
  testimonial,
  orgSlug,
  isFeatured = false,
  shareState,
  onShare,
}: {
  testimonial: TestimonialListItem;
  orgSlug: string;
  isFeatured?: boolean;
  shareState?: "idle" | "loading" | "copied";
  onShare?: (slug: string, id: string) => void;
}) {
  const router = useRouter();

  return (
    <motion.div
      variants={fadeInUp}
      layout
      className={cn(
        "group bg-[#1e1e2d] rounded-xl border border-[#2a2a35] overflow-hidden cursor-pointer",
        "hover:border-[#FBD10D]/30 transition-all duration-300 hover:shadow-lg hover:shadow-black/20",
        isFeatured && "md:col-span-2 ring-1 ring-[#FBD10D]/30"
      )}
      onClick={() => router.push(`/guest/${orgSlug}/testimonials/${testimonial.slug}`)}
      whileHover={{ y: -4 }}
    >
      {/* Cover Image with Dot Pattern Overlay */}
      <div className={cn("relative overflow-hidden", isFeatured ? "h-64" : "h-48")}>
        {testimonial.coverImage ? (
          <>
            <img
              src={testimonial.coverImage}
              alt={testimonial.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 dot-pattern-dense opacity-30" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1e1e2d] to-[#0c0c0e] dot-pattern-bg" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e2d] via-transparent to-transparent" />

        {/* Featured Badge */}
        {testimonial.isFeatured && (
          <div className="absolute top-4 left-4 px-3 py-1 bg-[#FBD10D] text-black text-xs font-bold rounded uppercase tracking-wider">
            Featured
          </div>
        )}
      </div>

      <div className="p-5">
        {/* Client Info */}
        <div className="flex items-center gap-3 mb-4">
          {testimonial.clientLogo ? (
            <img
              src={testimonial.clientLogo}
              alt={testimonial.clientName}
              className="w-12 h-12 rounded-lg object-cover bg-white p-1"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#2a2a35] flex items-center justify-center">
              <Building2 className="h-6 w-6 text-[#9fa0b8]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-semibold text-white truncate">
              {testimonial.clientName}
            </h4>
            {testimonial.clientIndustry && (
              <p className="text-xs text-[#9fa0b8]">{testimonial.clientIndustry}</p>
            )}
          </div>
        </div>

        {/* Categories */}
        {testimonial.categories && testimonial.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {testimonial.categories.slice(0, 2).map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 bg-[#FBD10D]/10 text-[#FBD10D] text-xs font-medium rounded"
              >
                {cat}
              </span>
            ))}
            {testimonial.categories.length > 2 && (
              <span className="px-2 py-0.5 bg-[#2a2a35] text-[#9fa0b8] text-xs rounded">
                +{testimonial.categories.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <h3 className={cn(
          "font-bold text-white mb-2 line-clamp-2 group-hover:text-[#FBD10D] transition-colors",
          isFeatured ? "text-xl" : "text-lg"
        )}>
          {testimonial.title}
        </h3>

        {/* Description */}
        <p className={cn(
          "text-[#9fa0b8] mb-4",
          isFeatured ? "text-base line-clamp-3" : "text-sm line-clamp-2"
        )}>
          {testimonial.shortDescription}
        </p>

        {/* Quote Preview (for featured) */}
        {isFeatured && testimonial.primaryQuote && (
          <div className="mb-4 p-4 bg-[#0c0c0e]/50 rounded-lg border-l-2 border-[#FBD10D]">
            <p className="text-sm text-[#d1d5db] italic line-clamp-2">
              "{testimonial.primaryQuote}"
            </p>
            {testimonial.primaryQuoteAuthor && (
              <p className="text-xs text-[#9fa0b8] mt-2">
                — {testimonial.primaryQuoteAuthor}
                {testimonial.primaryQuoteAuthorRole && `, ${testimonial.primaryQuoteAuthorRole}`}
              </p>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-[#2a2a35]">
          <span className="text-sm font-medium text-[#FBD10D] group-hover:underline flex items-center gap-1">
            Read Case Study
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </span>
          <div className="flex items-center gap-2">
            {onShare && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(testimonial.slug, testimonial._id);
                }}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  shareState === "copied"
                    ? "bg-green-500/20 text-green-400"
                    : "text-[#6b6b7b] hover:text-[#FBD10D] hover:bg-[#FBD10D]/10"
                )}
                title="Copy share link"
              >
                {shareState === "loading" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : shareState === "copied" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            {testimonial.publishedAt && (
              <span className="text-xs text-[#6b6b7b]">
                {new Date(testimonial.publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function TestimonialsShowcasePage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.slug as string;

  const [testimonials, setTestimonials] = useState<TestimonialListItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const [founders, setFounders] = useState<FounderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [shareStates, setShareStates] = useState<Record<string, "idle" | "loading" | "copied">>({});
  const [affiliateId, setAffiliateId] = useState<string | null>(null);

  // Fetch affiliate ID for share links (works for any logged-in user)
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/affiliate/my-affiliate-id`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.success && data.affiliateId) {
          setAffiliateId(data.affiliateId);
        }
      } catch {
        // non-critical — share links will work without referCode
      }
    })();
  }, []);

  // Handle share for a specific testimonial
  const handleShareTestimonial = async (testimonialSlug: string, testimonialId: string) => {
    if (shareStates[testimonialId] === "loading" || shareStates[testimonialId] === "copied") return;

    setShareStates(prev => ({ ...prev, [testimonialId]: "loading" }));
    const baseUrl = window.location.origin;
    const base = `${baseUrl}/guest/${orgSlug}/testimonials/${testimonialSlug}`;
    const shareLink = affiliateId ? `${base}?referCode=${affiliateId}` : base;

    const success = await copyToClipboard(shareLink);
    if (success) {
      setShareStates(prev => ({ ...prev, [testimonialId]: "copied" }));
      toast.success("Share link copied!");
      setTimeout(() => setShareStates(prev => ({ ...prev, [testimonialId]: "idle" })), 2000);
    } else {
      toast.error("Failed to copy link");
      setShareStates(prev => ({ ...prev, [testimonialId]: "idle" }));
    }
  };

  // Fetch testimonials
  useEffect(() => {
    const fetchData = async () => {
      if (!orgSlug) return;

      setLoading(true);
      setError(null);
      try {
        const data = await getPublicTestimonials(orgSlug, {
          category: selectedCategory === "ALL" ? undefined : selectedCategory,
        });
        setTestimonials(data.testimonials);
        setCategories(data.categories);
        setOrganization(data.organization);
        setFounders(data.founders);
      } catch (err: any) {
        console.error("Error fetching testimonials:", err);
        setError(err.message || "Failed to load testimonials");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgSlug, selectedCategory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-12 h-12 rounded-full border-2 border-[#FBD10D] border-t-transparent" />
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <Star className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Unable to Load Testimonials</h2>
        <p className="text-[#9fa0b8] mb-4">{error}</p>
        <Button
          onClick={() => router.push(`/guest/${orgSlug}`)}
          className="bg-[#FBD10D] hover:bg-[#e6c00d] text-black"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Office
        </Button>
      </div>
    );
  }

  // Separate featured testimonials
  const featuredTestimonials = testimonials.filter((t) => t.isFeatured);
  const regularTestimonials = testimonials.filter((t) => !t.isFeatured);

  return (
    <div className="min-h-screen bg-[#0c0c0e]">
      {/* Hero Section with Dot Pattern */}
      <div className="relative overflow-hidden">
        {/* Dot Pattern Background */}
        <div className="absolute inset-0 dot-pattern-bg opacity-40" />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0c0c0e]/50 to-[#0c0c0e]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
          {/* Back Navigation */}
          <div className="mb-8">
            <Link
              href={`/guest/${orgSlug}`}
              className="inline-flex items-center gap-2 text-[#9fa0b8] hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {organization?.name || "Office"}
            </Link>
          </div>

          {/* Hero Content */}
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-block mb-6"
            >
              <span className="px-4 py-1.5 bg-[#FBD10D]/10 border border-[#FBD10D]/30 text-[#FBD10D] text-xs font-bold uppercase tracking-widest rounded">
                Clients
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6"
              style={{ fontFamily: "serif" }}
            >
              Client Showcase
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-[#9fa0b8] mb-8"
            >
              {organization?.description ||
                "Trusted by leading companies and innovative startups."}
            </motion.p>

            {/* Organization Info */}
            {organization && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-center gap-4"
              >
                {organization.icon && (
                  <img
                    src={organization.icon}
                    alt={organization.name}
                    className="w-10 h-10 rounded-lg"
                  />
                )}
                <span className="text-white font-medium">{organization.name}</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="border-y border-[#2a2a35] bg-[#0e0e12]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#6b6b7b] mr-2 whitespace-nowrap">
              Filter by category:
            </span>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
              <CategoryChip
                category="ALL"
                isActive={selectedCategory === "ALL"}
                onClick={() => setSelectedCategory("ALL")}
              />
              {categories.map((category) => (
                <CategoryChip
                  key={category}
                  category={category}
                  isActive={selectedCategory === category}
                  onClick={() => setSelectedCategory(category)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {testimonials.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-[#1e1e2d] flex items-center justify-center mx-auto mb-4">
              <Star className="h-8 w-8 text-[#6b6b7b]" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No testimonials yet</h3>
            <p className="text-[#9fa0b8]">
              {selectedCategory !== "ALL"
                ? `No testimonials found in the "${selectedCategory}" category.`
                : "Check back soon for client success stories."}
            </p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {/* Featured Testimonials First */}
            {featuredTestimonials.map((testimonial) => (
              <TestimonialCard
                key={testimonial._id}
                testimonial={testimonial}
                orgSlug={orgSlug}
                isFeatured
                shareState={shareStates[testimonial._id] || "idle"}
                onShare={handleShareTestimonial}
              />
            ))}

            {/* Regular Testimonials */}
            {regularTestimonials.map((testimonial) => (
              <TestimonialCard
                key={testimonial._id}
                testimonial={testimonial}
                orgSlug={orgSlug}
                shareState={shareStates[testimonial._id] || "idle"}
                onShare={handleShareTestimonial}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* Footer CTA */}
      {organization && (
        <div className="border-t border-[#2a2a35] bg-[#0e0e12]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Ready to become our next success story?
            </h2>
            <p className="text-[#9fa0b8] mb-6 max-w-lg mx-auto">
              Join the growing list of companies achieving exceptional results.
            </p>
            <Button
              onClick={() => router.push(`/guest/${orgSlug}`)}
              className="bg-gradient-to-r from-[#FBD10D] to-[#e6c00d] hover:from-[#e6c00d] hover:to-[#d4b00c] text-black font-semibold px-8 py-3 h-auto"
            >
              Visit {organization.name}
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
