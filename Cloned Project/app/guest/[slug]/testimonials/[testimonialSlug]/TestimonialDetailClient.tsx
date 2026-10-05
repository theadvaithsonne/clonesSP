"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ExternalLink,
  Globe,
  Loader2,
  Star,
  Quote,
  BarChart3,
  Link2,
  ChevronRight,
  Play,
  User,
} from "lucide-react";
import {
  getPublicTestimonialDetail,
  type Testimonial,
  type TestimonialListItem,
  type OrganizationInfo,
  type FounderInfo,
  type ContentBlock,
} from "@/lib/testimonials-api";
import { api } from "@/lib/api";
import {
  getUserDataFromToken,
  isAuthenticated as checkWorkspaceAuth,
} from "@/lib/auth";
import { ContentTracker } from "@/lib/content-tracker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import GuestJoinFlow from "../../components/GuestJoinFlow";

// ── Interfaces ──────────────────────────────────────────────────────

interface GuestOrganization {
  _id: string;
  name: string;
  slug?: string;
  icon?: string;
  coverPhoto?: string;
  description?: string;
  office_public?: boolean;
  branding?: {
    primaryColor?: string;
  };
  isMember?: boolean;
  requestStatus?: string | null;
}

interface ReferrerInfo {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

// Content Block Renderer Component
function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "text":
      return (
        <div
          className="content-block-text prose prose-invert prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: block.content || "" }}
        />
      );
    case "image":
      return (
        <figure className="my-8">
          <img
            src={block.imageUrl}
            alt={block.imageAlt || block.imageCaption || ""}
            className="w-full rounded-xl"
          />
          {block.imageCaption && (
            <figcaption className="text-center text-sm text-[#9fa0b8] mt-3">
              {block.imageCaption}
            </figcaption>
          )}
        </figure>
      );
    case "video":
      return (
        <div className="my-8">
          <video
            src={block.videoUrl}
            poster={block.videoThumbnail}
            controls
            className="w-full rounded-xl"
          />
        </div>
      );
    case "youtube":
      return (
        <div className="my-8 relative aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${block.youtubeId}`}
            className="absolute inset-0 w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      );
    case "quote":
      return (
        <blockquote className="my-8 relative pl-6 border-l-4 border-[#FBD10D]">
          <p className="text-xl text-[#d1d5db] italic mb-3">
            &ldquo;{block.quoteText}&rdquo;
          </p>
          {block.quoteAuthor && (
            <footer className="text-sm text-[#9fa0b8]">
              — <span className="font-medium text-white">{block.quoteAuthor}</span>
              {block.quoteRole && <span>, {block.quoteRole}</span>}
            </footer>
          )}
        </blockquote>
      );
    case "gallery":
      return (
        <div className="my-8 grid grid-cols-2 md:grid-cols-3 gap-4">
          {block.galleryImages?.map((img, index) => (
            <img
              key={index}
              src={img.url}
              alt={img.alt || img.caption || `Gallery image ${index + 1}`}
              className="w-full h-48 object-cover rounded-lg"
            />
          ))}
        </div>
      );
    default:
      return null;
  }
}

// Related Testimonial Card
function RelatedTestimonialCard({
  testimonial,
  orgSlug,
}: {
  testimonial: TestimonialListItem;
  orgSlug: string;
}) {
  const router = useRouter();

  return (
    <div
      className="group bg-[#1e1e2d] rounded-xl border border-[#2a2a35] overflow-hidden cursor-pointer hover:border-[#FBD10D]/30 transition-all"
      onClick={() => router.push(`/guest/${orgSlug}/testimonials/${testimonial.slug}`)}
    >
      {testimonial.coverImage && (
        <div className="h-32 overflow-hidden">
          <img
            src={testimonial.coverImage}
            alt={testimonial.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {testimonial.clientLogo ? (
            <img
              src={testimonial.clientLogo}
              alt={testimonial.clientName}
              className="w-6 h-6 rounded object-cover"
            />
          ) : (
            <Building2 className="w-6 h-6 text-[#6b6b7b]" />
          )}
          <span className="text-xs text-[#9fa0b8]">{testimonial.clientName}</span>
        </div>
        <h4 className="text-sm font-medium text-white line-clamp-2 group-hover:text-[#FBD10D] transition-colors">
          {testimonial.title}
        </h4>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export default function TestimonialDetailClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgSlug = params.slug as string;
  const testimonialSlug = params.testimonialSlug as string;
  const referCode = searchParams.get("referCode");

  const [testimonial, setTestimonial] = useState<Testimonial | null>(null);
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const [guestOrganization, setGuestOrganization] = useState<GuestOrganization | null>(null);
  const [founders, setFounders] = useState<FounderInfo[]>([]);
  const [relatedTestimonials, setRelatedTestimonials] = useState<TestimonialListItem[]>([]);
  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth state (for sidebar CTA)
  const [isWorkspaceUser, setIsWorkspaceUser] = useState(false);
  const [workspaceOrgId, setWorkspaceOrgId] = useState<string | null>(null);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);

  // Join flow
  const [joinFlowOpen, setJoinFlowOpen] = useState(false);

  const brandColor = guestOrganization?.branding?.primaryColor || "#FBD10D";
  const isMember = guestOrganization?.isMember || false;

  // Auth check on mount
  useEffect(() => {
    if (checkWorkspaceAuth()) {
      const userData = getUserDataFromToken();
      if (userData.userId && userData.email) {
        setIsWorkspaceUser(true);
        setWorkspaceOrgId(userData.orgId);
        setGuestUserId(userData.userId);
        return;
      }
    }
    const storedUserId = localStorage.getItem("guest_user_id");
    if (storedUserId) {
      setGuestUserId(storedUserId);
    }
  }, []);

  // Fetch org details (for membership check + branding)
  useEffect(() => {
    if (!orgSlug) return;
    (async () => {
      try {
        const userId = guestUserId;
        const url = userId
          ? `/guest-auth/hq-by-slug/${orgSlug}?userId=${userId}`
          : `/guest-auth/hq-by-slug/${orgSlug}`;
        const res = await api<{ ok: boolean; organization: GuestOrganization }>(
          url,
          { method: "GET" }
        );
        if (res.ok && res.organization) {
          setGuestOrganization(res.organization);
        }
      } catch {
        // non-critical
      }
    })();
  }, [orgSlug, guestUserId]);

  // Fetch referrer
  useEffect(() => {
    if (!referCode) return;
    (async () => {
      try {
        const res = await api<{
          success: boolean;
          referrer: ReferrerInfo;
        }>(`/affiliate/referrer-info?affiliateId=${referCode}`, {
          method: "GET",
        });
        if (res.success && res.referrer) setReferrer(res.referrer);
      } catch {}
    })();
  }, [referCode]);

  // Fetch testimonial detail
  useEffect(() => {
    const fetchData = async () => {
      if (!orgSlug || !testimonialSlug) return;

      setLoading(true);
      setError(null);
      try {
        const data = await getPublicTestimonialDetail(orgSlug, testimonialSlug);
        setTestimonial(data.testimonial);
        setOrganization(data.organization);
        setFounders(data.founders);
        setRelatedTestimonials(data.relatedTestimonials);
      } catch (err: any) {
        console.error("Error fetching testimonial:", err);
        setError(err.message || "Failed to load testimonial");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgSlug, testimonialSlug]);

  // ── Content Tracker for analytics ─────────────────────────────
  const trackerRef = useRef<ContentTracker | null>(null);

  useEffect(() => {
    if (!testimonial || !guestOrganization?._id) return;

    const tracker = new ContentTracker({
      contentId: testimonial._id,
      contentType: "testimonial",
      orgId: guestOrganization._id,
      contentTitle: testimonial.title,
      affiliateId: referCode || null,
      userId: isWorkspaceUser ? guestUserId : null,
      guestId: !isWorkspaceUser ? (guestUserId || localStorage.getItem("guest_user_id")) : null,
    });

    trackerRef.current = tracker;
    tracker.startReading();

    return () => {
      tracker.stopReading();
      tracker.destroy();
      trackerRef.current = null;
    };
  }, [testimonial?._id, guestOrganization?._id, referCode, guestUserId, isWorkspaceUser]);

  // Track scroll depth
  const handleScroll = useCallback(() => {
    if (!trackerRef.current) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
      const pct = (scrollTop / docHeight) * 100;
      trackerRef.current.onScroll(pct);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

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

  if (error || !testimonial) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <Star className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Testimonial Not Found</h2>
        <p className="text-[#9fa0b8] mb-4">{error || "The requested testimonial could not be found."}</p>
        <Button
          onClick={() => router.push(`/guest/${orgSlug}/testimonials`)}
          className="bg-[#FBD10D] hover:bg-[#e6c00d] text-black"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Testimonials
        </Button>
      </div>
    );
  }

  const sortedContentBlocks = [...(testimonial.contentBlocks || [])].sort(
    (a, b) => a.order - b.order
  );

  const orgForDisplay = guestOrganization || organization;

  return (
    <div className="min-h-screen bg-[#0c0c0e]">
      {/* Back Navigation */}
      <div className="border-b border-[#2a2a35] bg-[#0e0e12]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href={`/guest/${orgSlug}/testimonials`}
            className="inline-flex items-center gap-2 text-[#9fa0b8] hover:text-[#FBD10D] transition-colors text-sm font-medium uppercase tracking-wider"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Clients
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content Column */}
          <div className="lg:col-span-2">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              {/* Client Info */}
              <div className="flex items-center gap-4 mb-6">
                {testimonial.clientLogo ? (
                  <img
                    src={testimonial.clientLogo}
                    alt={testimonial.clientName}
                    className="w-16 h-16 rounded-xl object-cover bg-white p-1"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#2a2a35] flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-[#9fa0b8]" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-white">{testimonial.clientName}</h2>
                  {testimonial.clientIndustry && (
                    <p className="text-sm text-[#9fa0b8]">{testimonial.clientIndustry}</p>
                  )}
                </div>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
                {testimonial.title}
              </h1>

              {/* Progress Line */}
              <div className="progress-line w-32 rounded-full mb-6" />

              {/* Categories */}
              {testimonial.categories && testimonial.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {testimonial.categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-3 py-1 bg-[#FBD10D]/10 text-[#FBD10D] text-sm font-medium rounded"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Cover Image */}
            {testimonial.coverImage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-12"
              >
                <img
                  src={testimonial.coverImage}
                  alt={testimonial.title}
                  className="w-full rounded-2xl"
                />
              </motion.div>
            )}

            {/* Primary Quote */}
            {testimonial.primaryQuote && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-12 p-8 bg-[#1e1e2d] rounded-2xl border border-[#2a2a35]"
              >
                <Quote className="h-10 w-10 text-[#FBD10D] mb-4" />
                <p className="text-xl sm:text-2xl text-[#d1d5db] italic leading-relaxed mb-6">
                  &ldquo;{testimonial.primaryQuote}&rdquo;
                </p>
                {testimonial.primaryQuoteAuthor && (
                  <div className="flex items-center gap-4">
                    {testimonial.primaryQuoteAuthorImage && (
                      <img
                        src={testimonial.primaryQuoteAuthorImage}
                        alt={testimonial.primaryQuoteAuthor}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-white">
                        {testimonial.primaryQuoteAuthor}
                      </p>
                      {testimonial.primaryQuoteAuthorRole && (
                        <p className="text-sm text-[#9fa0b8]">
                          {testimonial.primaryQuoteAuthorRole}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Content Blocks */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-8"
            >
              {sortedContentBlocks.map((block) => (
                <ContentBlockRenderer key={block._id} block={block} />
              ))}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* CTA Card */}
              {orgForDisplay && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-xl border overflow-hidden bg-[#1e1e2d] border-[#2a2a35]"
                >
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      {orgForDisplay?.icon ? (
                        <img
                          src={orgForDisplay.icon}
                          alt={orgForDisplay.name}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div
                          className="h-12 w-12 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: brandColor }}
                        >
                          <Building2 className="h-6 w-6 text-black" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-white">{orgForDisplay?.name}</p>
                        <p className="text-sm text-[#6b6b7b]">on Garage</p>
                      </div>
                    </div>

                    <p className="text-sm mb-6 text-[#9fa0b8]">
                      Want to join{" "}
                      <span className="font-medium" style={{ color: brandColor }}>
                        {orgForDisplay?.name}
                      </span>
                      ? Become part of the community and access exclusive content.
                    </p>

                    {isMember ||
                    (isWorkspaceUser && workspaceOrgId === guestOrganization?._id) ? (
                      <Button
                        className="w-full h-12 font-semibold"
                        style={{ backgroundColor: brandColor, color: "black" }}
                        onClick={() => router.push("/workspace")}
                      >
                        Get Started For Free
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </Button>
                    ) : (
                      <Button
                        className="w-full h-12 font-semibold"
                        style={{ backgroundColor: brandColor, color: "black" }}
                        onClick={() => setJoinFlowOpen(true)}
                      >
                        Join Community
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </Button>
                    )}

                    <div className="border-t border-[#2a2a35] my-6" />

                    <div className="text-center">
                      <p className="text-xs text-[#6b6b7b]">
                        Powered by{" "}
                        <span style={{ color: brandColor }} className="font-medium">
                          Garage
                        </span>
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Referrer banner */}
              {referrer && (
                <div className="flex justify-center">
                  <div
                    className="inline-flex items-center gap-3 px-5 py-3 rounded-full border w-full justify-center"
                    style={{
                      backgroundColor: `${brandColor}1A`,
                      borderColor: `${brandColor}33`,
                    }}
                  >
                    {referrer.profilePicture ? (
                      <img
                        src={referrer.profilePicture}
                        alt={referrer.name}
                        className="h-8 w-8 rounded-full object-cover border-2 shrink-0"
                        style={{ borderColor: `${brandColor}4D` }}
                      />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center border-2 shrink-0"
                        style={{
                          backgroundColor: `${brandColor}33`,
                          borderColor: `${brandColor}4D`,
                        }}
                      >
                        <User className="h-4 w-4" style={{ color: brandColor }} />
                      </div>
                    )}
                    <span className="text-sm truncate text-zinc-300">
                      <span className="font-semibold" style={{ color: brandColor }}>
                        {referrer.name}
                      </span>{" "}
                      invited you
                    </span>
                  </div>
                </div>
              )}

              {/* Info Sheet */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="info-sheet"
              >
                <h3 className="text-xs text-[#6b6b7b] uppercase tracking-wider mb-4">
                  Info Sheet
                </h3>

                {/* Company */}
                <div className="info-sheet-item">
                  <div className="info-sheet-icon">
                    <Building2 className="h-4 w-4 text-[#9fa0b8]" />
                  </div>
                  <div>
                    <p className="info-sheet-label">Company</p>
                    <p className="info-sheet-value">{testimonial.clientName}</p>
                  </div>
                </div>

                {/* Website */}
                {testimonial.clientWebsite && (
                  <div className="info-sheet-item">
                    <div className="info-sheet-icon">
                      <Globe className="h-4 w-4 text-[#9fa0b8]" />
                    </div>
                    <div>
                      <p className="info-sheet-label">Website</p>
                      <a
                        href={testimonial.clientWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="info-sheet-value text-[#FBD10D] hover:underline flex items-center gap-1"
                      >
                        Visit Site
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Industry */}
                {testimonial.clientIndustry && (
                  <div className="info-sheet-item">
                    <div className="info-sheet-icon">
                      <Star className="h-4 w-4 text-[#9fa0b8]" />
                    </div>
                    <div>
                      <p className="info-sheet-label">Industry</p>
                      <p className="info-sheet-value">{testimonial.clientIndustry}</p>
                    </div>
                  </div>
                )}

                {/* Live Artifact */}
                {testimonial.artifactUrl && (
                  <div className="info-sheet-item">
                    <div className="info-sheet-icon">
                      <Link2 className="h-4 w-4 text-[#9fa0b8]" />
                    </div>
                    <div>
                      <p className="info-sheet-label">Live Artifact</p>
                      <a
                        href={testimonial.artifactUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="info-sheet-value text-[#FBD10D] hover:underline flex items-center gap-1"
                      >
                        {testimonial.artifactLabel || "View"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Metrics */}
              {testimonial.metrics && testimonial.metrics.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="info-sheet"
                >
                  <h3 className="text-xs text-[#6b6b7b] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Results
                  </h3>

                  <div className="space-y-4">
                    {testimonial.metrics.map((metric, index) => (
                      <div key={index} className="text-center p-4 bg-[#0c0c0e] rounded-lg">
                        <p className="text-2xl font-bold text-[#FBD10D] mb-1">
                          {metric.value}
                        </p>
                        <p className="text-sm text-[#9fa0b8]">{metric.label}</p>
                        {metric.description && (
                          <p className="text-xs text-[#6b6b7b] mt-1">{metric.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Related Testimonials */}
              {relatedTestimonials.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <h3 className="text-xs text-[#6b6b7b] uppercase tracking-wider mb-4">
                    Related Stories
                  </h3>
                  <div className="space-y-4">
                    {relatedTestimonials.map((related) => (
                      <RelatedTestimonialCard
                        key={related._id}
                        testimonial={related}
                        orgSlug={orgSlug}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="border-t border-[#2a2a35] bg-[#0e0e12]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                Ready to achieve similar results?
              </h3>
              <p className="text-[#9fa0b8]">
                Learn how we can help you transform your business.
              </p>
            </div>
            <Button
              onClick={() => setJoinFlowOpen(true)}
              className="bg-gradient-to-r from-[#FBD10D] to-[#e6c00d] hover:from-[#e6c00d] hover:to-[#d4b00c] text-black font-semibold px-8 py-3 h-auto whitespace-nowrap"
            >
              Get Started
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      {/* GuestJoinFlow */}
      {orgForDisplay && (
        <GuestJoinFlow
          organization={orgForDisplay as any}
          slug={orgSlug}
          brandColor={brandColor}
          isOpen={joinFlowOpen}
          onClose={() => setJoinFlowOpen(false)}
        />
      )}
    </div>
  );
}
