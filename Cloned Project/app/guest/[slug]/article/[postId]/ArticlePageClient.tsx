"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ContentTracker } from "@/lib/content-tracker";
import { api } from "@/lib/api";
import {
  getUserDataFromToken,
  isAuthenticated as checkWorkspaceAuth,
} from "@/lib/auth";
import {
  Clock,
  FileText,
  Loader2,
  AlertCircle,
  Building2,
  ArrowRight,
  User,
  Play,
  Youtube,
  ExternalLink,
} from "lucide-react";
import DOMPurify from "dompurify";
import { buildOfficeJoinLoginUrl } from "@/lib/deeplink";
import "@/components/feed/article-editor.css";

// ── Interfaces ──────────────────────────────────────────────────────

interface Organization {
  _id: string;
  name: string;
  slug?: string;
  icon?: string;
  coverPhoto?: string;
  description?: string;
  branding?: {
    primaryColor?: string;
  };
  isMember?: boolean;
  requestStatus?: string | null;
}

interface ReferrerInfo {
  name: string;
  profilePicture?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Detect whether content is HTML (from Tiptap editor) or plain text (legacy)
function isHtmlContent(content: string): boolean {
  return /<(?:p|h[1-6]|ul|ol|blockquote|pre|hr|strong|em|a|code)[\s>]/i.test(content);
}

/**
 * Sanitize article HTML with DOMPurify, also stripping any HTML tags
 * that leaked into href attributes (e.g. from bold/italic applied to links).
 */
function sanitizeArticleHtml(html: string): string {
  // First pass: strip HTML tags from inside href attribute values
  const cleaned = html.replace(
    /href=(["'])([\s\S]*?)\1/gi,
    (_match: string, quote: string, rawValue: string) => {
      let decoded = rawValue
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&amp;/gi, "&");
      if (/<[a-z/!]/i.test(decoded)) {
        decoded = decoded.replace(/<[^>]*>/g, "");
        decoded = decoded.replace(/[>"']+$/, "");
        const urlMatch = decoded.match(/^(https?:\/\/[^\s"'<>]+)/i);
        if (urlMatch) decoded = urlMatch[1];
      }
      return `href=${quote}${decoded.trim()}${quote}`;
    }
  );

  // Second pass: DOMPurify sanitize with afterSanitizeAttributes hook
  // to catch anything the regex missed
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      let href = node.getAttribute('href') || '';
      if (/<[a-z/!]/i.test(href)) {
        href = href.replace(/<[^>]*>/g, '');
        href = href.replace(/[>"']+$/, '');
        const urlMatch = href.match(/^(https?:\/\/[^\s"'<>]+)/i);
        if (urlMatch) href = urlMatch[1];
        node.setAttribute('href', href.trim());
      }
    }
  });

  const result = DOMPurify.sanitize(cleaned, {
    ADD_ATTR: ['target', 'rel'],
  });

  DOMPurify.removeHook('afterSanitizeAttributes');
  return result;
}

// Extract YouTube video ID from URL
function getYoutubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Extract all YouTube URLs from content (HTML or plain text)
function extractYoutubeUrls(content: string): string[] {
  const urlRegex = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s"'<>]+/gi;
  const matches = content.match(urlRegex);
  if (!matches) return [];
  // Deduplicate
  return [...new Set(matches)];
}

// YouTube Preview Card component for guest article page
function YouTubePreviewCard({
  url,
  brandColor,
  metadata,
}: {
  url: string;
  brandColor: string;
  metadata?: { title?: string; description?: string; image?: string | null; siteName?: string };
}) {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;

  const thumbnailUrl = metadata?.image || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const fallbackThumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl overflow-hidden border border-[#1a1a22] hover:border-opacity-60 transition-all group"
      style={{ borderColor: `${brandColor}20` }}
    >
      {/* Thumbnail with play button overlay */}
      <div className="relative aspect-video bg-black">
        <img
          src={thumbnailUrl}
          alt={metadata?.title || "YouTube video"}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = fallbackThumbnail;
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <div className="w-16 h-11 bg-red-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
            <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
          </div>
        </div>
        {/* YouTube badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-lg">
          <Youtube className="w-3.5 h-3.5 text-red-500" />
          <span className="text-white text-xs font-medium">YouTube</span>
        </div>
      </div>
      {/* Video metadata */}
      {(metadata?.title || metadata?.description) && (
        <div className="p-4 bg-[#0e0e14]">
          {metadata?.title && (
            <h4 className="text-white font-semibold text-sm leading-snug mb-1 line-clamp-2 group-hover:opacity-90 transition-opacity">
              {metadata.title}
            </h4>
          )}
          {metadata?.description && (
            <p className="text-[#9fa0b8] text-xs line-clamp-2 leading-relaxed">
              {metadata.description}
            </p>
          )}
        </div>
      )}
    </a>
  );
}

function renderArticleContent(content: string, brandColor: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trimStart();

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3
          key={i}
          className="text-xl font-bold text-white mt-10 mb-4 tracking-tight"
        >
          {trimmed.slice(4)}
        </h3>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="text-2xl font-bold text-white mt-12 mb-4 tracking-tight"
        >
          {trimmed.slice(3)}
        </h2>
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h1
          key={i}
          className="text-3xl font-bold text-white mt-12 mb-5 tracking-tight"
        >
          {trimmed.slice(2)}
        </h1>
      );
    } else if (trimmed.startsWith("---") || trimmed.startsWith("***")) {
      elements.push(
        <hr
          key={i}
          className="my-10 border-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${brandColor}40, transparent)` }}
        />
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-3 mb-2 ml-1">
          <span className="mt-2.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: brandColor }} />
          <p className="text-[#c8c8db] text-[17px] sm:text-[18px] leading-[1.85]">
            {trimmed.slice(2)}
          </p>
        </div>
      );
    } else if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="my-6 pl-5 py-3 rounded-r-lg"
          style={{ borderLeft: `3px solid ${brandColor}` }}
        >
          <p className="text-[#b0b0c8] text-[17px] italic leading-[1.85]">
            {trimmed.slice(2)}
          </p>
        </blockquote>
      );
    } else if (trimmed === "") {
      elements.push(<div key={i} className="h-5" />);
    } else {
      // Bold text support: **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const rendered = parts.map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={j} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      elements.push(
        <p
          key={i}
          className="text-[#c8c8db] text-[17px] sm:text-[18px] leading-[1.85] mb-1"
        >
          {rendered}
        </p>
      );
    }
  });

  return elements;
}

// ── Component ────────────────────────────────────────────────────────

export default function ArticlePageClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const postId = params.postId as string;
  const referCode = searchParams.get("referCode");

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null);

  // Auth state
  const [isWorkspaceUser, setIsWorkspaceUser] = useState(false);
  const [workspaceOrgId, setWorkspaceOrgId] = useState<string | null>(null);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);

  const brandColor = organization?.branding?.primaryColor || "#FBD10D";
  const isMember = organization?.isMember || false;

  /**
   * Join CTA → `/login` deep link in this tab.
   *
   * This used to `window.open` the guest office page, which dropped the visitor
   * into a second in-page auth modal. /login (and /verify after OTP) runs
   * `guest-auth/public-join` itself and forwards to `redirect`, so a signed-in
   * visitor joins with no prompt at all. Before the org fetch lands there's no
   * orgId to join with, so fall back to the guest office page.
   */
  const handleJoinCommunity = () => {
    const orgId = organization?._id;
    const referSuffix = referCode
      ? `?referCode=${encodeURIComponent(referCode)}`
      : "";
    if (!orgId) {
      router.push(`/guest/${slug}${referSuffix}`);
      return;
    }
    router.push(
      buildOfficeJoinLoginUrl({
        orgId,
        orgSlug: organization?.slug || slug,
        referCode,
        redirect: "/workspace",
      })
    );
  };

  // Engagement tracker
  const trackerRef = useRef<ContentTracker | null>(null);
  const articleRef = useRef<HTMLDivElement | null>(null);

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

  // Fetch org details
  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const userId = guestUserId || "";
        const url = userId
          ? `/guest-auth/hq-by-slug/${slug}?userId=${userId}`
          : `/guest-auth/hq-by-slug/${slug}`;
        const res = await api<{ ok: boolean; organization: Organization }>(
          url,
          { method: "GET" }
        );
        if (res.ok && res.organization) {
          setOrganization(res.organization);
        }
      } catch {
        // non-critical
      }
    })();
  }, [slug, guestUserId]);

  // Fetch post
  useEffect(() => {
    if (!postId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await api<{ success: boolean; post: any }>(
          `/public/posts/${postId}`,
          { method: "GET" }
        );
        if (res.success && res.post) {
          setPost(res.post);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

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

  // ── Engagement Tracker ────────────────────────────────────────

  useEffect(() => {
    if (!post || !organization?._id) return;
    const tracker = new ContentTracker({
      contentId: post._id,
      contentType: "article",
      orgId: organization._id,
      contentTitle: post.title || "Article",
      affiliateId: referCode,
      userId: guestUserId,
      guestId: !guestUserId ? `anon_${Date.now().toString(36)}` : null,
    });
    trackerRef.current = tracker;
    tracker.startReading();

    // Scroll depth tracking
    const handleScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.scrollHeight;
      const scrolled = Math.max(0, -rect.top + window.innerHeight);
      const pct = Math.min(100, (scrolled / total) * 100);
      tracker.onScroll(pct);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Pause reading when tab hidden
    const handleVis = () => {
      if (document.hidden) tracker.stopReading();
      else tracker.startReading();
    };
    document.addEventListener("visibilitychange", handleVis);

    return () => {
      tracker.stopReading();
      tracker.destroy();
      trackerRef.current = null;
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("visibilitychange", handleVis);
    };
  }, [post?._id, organization?._id]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="animate-spin rounded-full h-10 w-10 border-b-2"
            style={{ borderColor: brandColor }}
          />
          <p className="text-[#9fa0b8] text-sm">Loading article…</p>
        </div>
      </div>
    );
  }

  // ── Error / Not found ──
  if (error || !post) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-center px-4">
        <AlertCircle className="w-14 h-14 text-[#2a2a35] mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Article Not Found</h1>
        <p className="text-[#9fa0b8] mb-6">
          The article you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
      </div>
    );
  }

  const authorName = post.author?.name || "Unknown Author";
  const authorPicture = post.author?.profilePicture;
  const authorInitials =
    authorName
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  const orgName = post.organization?.name || organization?.name || "";
  const orgIcon = post.organization?.icon || organization?.icon;
  const orgForDisplay = organization || post.organization;

  return (
    <div ref={articleRef} className="min-h-screen bg-[#0a0a0f]">
      <style>{`
        .brand-hover:hover { color: ${brandColor} !important; }
        .article-body a { color: ${brandColor}; text-decoration: underline; }
        .article-body a:hover { opacity: 0.8; }
      `}</style>

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/85 backdrop-blur-xl border-b border-[#1a1a22]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Left: Org branding */}
          <div className="flex items-center gap-3">
            {orgIcon ? (
              <img
                src={orgIcon}
                alt={orgName}
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : orgName ? (
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: brandColor }}
              >
                <Building2 className="h-4 w-4 text-black" />
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              {orgName && (
                <span className="text-white font-semibold text-sm">
                  {orgName}
                </span>
              )}
              <span className="text-[#9fa0b8] text-xs hidden sm:inline">
                on Garage
              </span>
            </div>
          </div>

          {/* Right: Article badge + reading time */}
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: `${brandColor}15`,
                color: brandColor,
              }}
            >
              <FileText className="w-3 h-3" />
              Article
            </span>
            {post.readingTimeMinutes && (
              <span className="inline-flex items-center gap-1 text-[#9fa0b8] text-xs">
                <Clock className="w-3 h-3" />
                {post.readingTimeMinutes} min read
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="lg:grid lg:grid-cols-3 lg:gap-10">
          {/* ── Article (left 2 cols) ──────────────────────── */}
          <article className="lg:col-span-2">
            {/* Title — on top */}
            {post.title && (
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-white leading-[1.15] tracking-tight mb-5">
                {post.title}
              </h1>
            )}

            {/* Author Byline — compact */}
            <div className="flex items-center gap-2.5 mb-6">
              {authorPicture ? (
                <img
                  src={authorPicture}
                  alt={authorName}
                  className="w-9 h-9 rounded-full object-cover ring-1 ring-[#1a1a22]"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: `${brandColor}25`,
                    color: brandColor,
                  }}
                >
                  {authorInitials}
                </div>
              )}
              <div>
                <p className="text-white font-medium text-[13px]">
                  {authorName}
                </p>
                <div className="flex items-center gap-1.5 text-[#9fa0b8] text-[11px]">
                  <span>{formatDate(post.createdAt)}</span>
                  {post.readingTimeMinutes && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {post.readingTimeMinutes} min read
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Cover Image — below title and author */}
            {post.coverImage && (
              <div className="mb-8 -mx-4 sm:mx-0 sm:rounded-2xl overflow-hidden">
                <img
                  src={post.coverImage}
                  alt={post.title || "Article cover"}
                  className="w-full h-auto"
                />
              </div>
            )}

            {/* Divider */}
            <div
              className="h-px mb-10"
              style={{
                background: `linear-gradient(90deg, ${brandColor}30, #1a1a22, transparent)`,
              }}
            />

            {/* Content Body */}
            <div className="article-body max-w-none">
              {post.content && (
                isHtmlContent(post.content) ? (
                  <div
                    className="article-prose-html"
                    style={{ '--brand-color': brandColor } as React.CSSProperties}
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        // Clean corrupted href attributes before sanitizing
                        let cleaned = post.content.replace(
                          /href=(["'])([\s\S]*?)\1/gi,
                          (_match: string, quote: string, rawValue: string) => {
                            // Decode HTML entities to detect embedded tags
                            let decoded = rawValue
                              .replace(/&lt;/gi, "<")
                              .replace(/&gt;/gi, ">")
                              .replace(/&quot;/gi, '"')
                              .replace(/&amp;/gi, "&");
                            // If the value contains HTML tags, truncate at the corruption point
                            const tagIndex = decoded.search(/<[a-z/]/i);
                            if (tagIndex !== -1) {
                              let cleanEnd = tagIndex;
                              while (cleanEnd > 0 && (decoded[cleanEnd - 1] === '"' || decoded[cleanEnd - 1] === '>')) {
                                cleanEnd--;
                              }
                              decoded = decoded.substring(0, cleanEnd);
                            }
                            return `href=${quote}${decoded.trim()}${quote}`;
                          }
                        );
                        // Also add target=_blank to links for the reader
                        const sanitized = DOMPurify.sanitize(cleaned, {
                          ADD_ATTR: ['target', 'rel'],
                        });
                        // Post-process: ensure all <a> tags open in new tab
                        return sanitized.replace(
                          /<a\s/gi,
                          '<a target="_blank" rel="noopener noreferrer" '
                        );
                      })(),
                    }}
                  />
                ) : (
                  renderArticleContent(post.content, brandColor)
                )
              )}
            </div>

            {/* YouTube Video Previews — show rich cards for any YouTube links in the article */}
            {post.content && (() => {
              const youtubeUrls = extractYoutubeUrls(post.content);
              if (youtubeUrls.length === 0) return null;

              // Match YouTube URLs with stored link preview metadata (if available)
              const linkPreviewMap = new Map<string, any>();
              if (post.linkPreviews && Array.isArray(post.linkPreviews)) {
                for (const lp of post.linkPreviews) {
                  linkPreviewMap.set(lp.url, lp);
                }
              }

              return (
                <div className="mt-8 space-y-4">
                  {youtubeUrls.map((ytUrl, idx) => (
                    <YouTubePreviewCard
                      key={idx}
                      url={ytUrl}
                      brandColor={brandColor}
                      metadata={linkPreviewMap.get(ytUrl)}
                    />
                  ))}
                </div>
              );
            })()}

            {/* Non-YouTube Link Previews — show stored metadata for other URLs */}
            {post.linkPreviews && Array.isArray(post.linkPreviews) && (() => {
              const nonYoutubePreviews = post.linkPreviews.filter(
                (lp: any) => !getYoutubeVideoId(lp.url)
              );
              if (nonYoutubePreviews.length === 0) return null;
              return (
                <div className="mt-6 space-y-3">
                  {nonYoutubePreviews.map((preview: any, idx: number) => {
                    // Clean URL to strip any leaked HTML tags
                    let previewUrl = (preview.url || '').replace(/<[^>]*>/g, '').replace(/[>"']+$/, '');
                    const urlMatch = previewUrl.match(/^(https?:\/\/[^\s"'<>]+)/i);
                    if (urlMatch) previewUrl = urlMatch[1];
                    const hostname = (() => {
                      try { return new URL(previewUrl).hostname; } catch { return previewUrl; }
                    })();
                    return (
                      <a
                        key={idx}
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl border overflow-hidden transition-all group h-32"
                        style={{ borderColor: `${brandColor}20`, backgroundColor: '#0e0e14' }}
                      >
                        <div className="flex h-full">
                          {preview.image && (
                            <div className="w-32 h-32 flex-shrink-0 relative overflow-hidden bg-[#0a0a0f]">
                              <img
                                src={preview.image}
                                alt={preview.title || "Preview"}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            </div>
                          )}
                          <div className="flex-1 p-3 min-w-0 flex flex-col justify-center">
                            {preview.siteName && (
                              <div className="text-[10px] text-[#9fa0b8] uppercase tracking-wide mb-1">
                                {preview.siteName}
                              </div>
                            )}
                            <div className="text-sm font-semibold text-white mb-1 line-clamp-2 group-hover:opacity-80 transition-opacity">
                              {preview.title || hostname}
                            </div>
                            {preview.description && (
                              <div className="text-xs text-[#9fa0b8] line-clamp-2">
                                {preview.description}
                              </div>
                            )}
                            <div className="flex items-center gap-1 mt-2 text-[10px] text-[#9fa0b8]">
                              <ExternalLink className="h-3 w-3" />
                              <span className="truncate">{hostname}</span>
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              );
            })()}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-[#1a1a22]">
                {post.tags.map((tag: string, i: number) => (
                  <span
                    key={i}
                    className="px-3.5 py-1.5 rounded-full text-sm border transition-colors hover:border-opacity-60"
                    style={{
                      backgroundColor: `${brandColor}08`,
                      borderColor: `${brandColor}25`,
                      color: "#b0b0c8",
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Author Footer Card */}
            <div className="mt-12 pt-8 border-t border-[#1a1a22]">
              <div
                className="p-5 rounded-2xl border border-[#1a1a22]"
                style={{ backgroundColor: "#0e0e14" }}
              >
                <div className="flex items-center gap-3">
                  {authorPicture ? (
                    <img
                      src={authorPicture}
                      alt={authorName}
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-[#1a1a22]"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{
                        backgroundColor: `${brandColor}25`,
                        color: brandColor,
                      }}
                    >
                      {authorInitials}
                    </div>
                  )}
                  <div>
                    <p className="text-white font-medium text-sm">
                      Written by {authorName}
                    </p>
                    <p className="text-[#9fa0b8] text-xs mt-0.5">
                      Published {formatDate(post.createdAt)}
                      {orgName && (
                        <> in <span style={{ color: brandColor }}>{orgName}</span></>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* ── Sidebar (right 1 col) ─────────────────────── */}
          <aside className="lg:col-span-1 mt-10 lg:mt-0">
            <div className="lg:sticky lg:top-20">
              {/* Org info card */}
              <div className="rounded-2xl border border-[#1a1a22] overflow-hidden bg-[#0e0e14]">
                <div className="p-6">
                  {/* Org branding */}
                  <div className="flex items-center gap-3 mb-4">
                    {orgIcon ? (
                      <img
                        src={orgIcon}
                        alt={orgName}
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
                      <p className="text-white font-semibold">{orgName}</p>
                      <p className="text-[#9fa0b8] text-sm">on Garage</p>
                    </div>
                  </div>

                  {orgForDisplay?.description && (
                    <p className="text-[#9fa0b8] text-sm leading-relaxed mb-5 line-clamp-3">
                      {orgForDisplay.description}
                    </p>
                  )}

                  <p className="text-[#9fa0b8] text-sm mb-6">
                    Want to join{" "}
                    <span className="font-medium" style={{ color: brandColor }}>
                      {orgName}
                    </span>
                    ? Become part of the community and access exclusive content.
                  </p>

                  {isMember ||
                  (isWorkspaceUser &&
                    workspaceOrgId === organization?._id) ? (
                    <button
                      className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: brandColor, color: "black" }}
                      onClick={() => router.push("/workspace")}
                    >
                      Go to Workspace
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: brandColor, color: "black" }}
                      onClick={handleJoinCommunity}
                    >
                      Join Community
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}

                  <div className="border-t border-[#1a1a22] my-6" />

                  <div className="text-center">
                    <p className="text-xs text-[#4a4a5a]">
                      Powered by{" "}
                      <span
                        style={{ color: brandColor }}
                        className="font-medium"
                      >
                        Garage
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Referrer banner */}
              {referrer && (
                <div className="flex justify-center mt-6">
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
                        <User
                          className="h-4 w-4"
                          style={{ color: brandColor }}
                        />
                      </div>
                    )}
                    <span className="text-sm truncate text-zinc-300">
                      <span
                        className="font-semibold"
                        style={{ color: brandColor }}
                      >
                        {referrer.name}
                      </span>{" "}
                      invited you
                    </span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
