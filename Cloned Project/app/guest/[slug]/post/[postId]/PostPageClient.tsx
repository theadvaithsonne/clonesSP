"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  getUserDataFromToken,
  isAuthenticated as checkWorkspaceAuth,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  User,
  Heart,
  MessageCircle,
  Repeat2,
  Image,
  FileText,
  Play,
  Music,
  AlertCircle,
} from "lucide-react";
import GuestNavbar from "../../components/GuestNavbar";
import { buildOfficeJoinLoginUrl } from "@/lib/deeplink";
import { cn } from "@/lib/utils";

// ── Interfaces ──────────────────────────────────────────────────────

interface Organization {
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

interface Author {
  _id: string;
  name: string;
  email?: string;
  profilePicture?: string;
}

interface Attachment {
  type: "image" | "video" | "document" | "audio";
  url: string;
  name: string;
  fileKey?: string;
}

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string | null;
  siteName?: string;
  showThumbnail?: boolean;
}

interface ReactionsCount {
  like: number;
  love: number;
  haha: number;
  wow: number;
  sad: number;
  angry: number;
  total: number;
}

interface PollOption {
  text: string;
  votes: number;
  percentage: number;
}

interface Poll {
  _id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  expiresAt?: string;
  isExpired: boolean;
}

interface QuotedPost {
  _id: string;
  content: string;
  authorId: Author;
  channelIds: { _id: string; title: string }[];
  createdAt: string;
  attachments?: Attachment[];
}

interface FeedPost {
  _id: string;
  content: string;
  author: Author;
  organization: Organization;
  channels: { _id: string; title: string }[];
  tags?: string[];
  attachments?: Attachment[];
  linkPreviews?: LinkPreview[];
  reactionsCount: ReactionsCount;
  commentsCount: number;
  repostsCount: number;
  quotedPost?: QuotedPost | null;
  hasPoll: boolean;
  poll?: Poll | null;
  createdAt: string;
  updatedAt: string;
}

interface ReferrerInfo {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

// ── Helpers  -─────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const REACTION_ICONS: Record<string, { label: string; emoji: string }> = {
  like: { label: "Like", emoji: "👍" },
  love: { label: "Love", emoji: "❤️" },
  haha: { label: "Haha", emoji: "😂" },
  wow: { label: "Wow", emoji: "😮" },
  sad: { label: "Sad", emoji: "😢" },
  angry: { label: "Angry", emoji: "😡" },
};

function AttachmentIcon({ type }: { type: string }) {
  switch (type) {
    case "image":
      return <Image className="h-4 w-4" />;
    case "video":
      return <Play className="h-4 w-4" />;
    case "audio":
      return <Music className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

// ── Component ───────────────────────────────────────────────────────

export default function PostPageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const slug = params.slug as string;
  const postId = params.postId as string;
  const referCode = searchParams.get("referCode");
  const referSuffix = referCode ? `?referCode=${referCode}` : "";

  // Post & org state
  const [post, setPost] = useState<FeedPost | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Auth state (minimal - for sidebar CTA only)
  const [isWorkspaceUser, setIsWorkspaceUser] = useState(false);
  const [workspaceOrgId, setWorkspaceOrgId] = useState<string | null>(null);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);

  const brandColor = organization?.branding?.primaryColor || "#FBA70A";
  const isMember = organization?.isMember || false;

  /**
   * Join CTA → `/login` deep link, not an in-page auth modal.
   *
   * /login (and /verify after OTP) runs `guest-auth/public-join` and forwards to
   * `redirect`, so an already-signed-in visitor joins without being asked for
   * anything. Before the org fetch lands there's no orgId to join with, so fall
   * back to the guest office page.
   */
  const handleJoinCommunity = () => {
    const orgId = organization?._id;
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

  // ── Effects ─────────────────────────────────────────────────────

  // Auth check on mount (minimal - for sidebar display)
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

  // Fetch org details (with membership check)
  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const userId = guestUserId;
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
        const res = await api<{ success: boolean; post: FeedPost & { postType?: string } }>(
          `/public/posts/${postId}`,
          { method: "GET" }
        );
        if (res.success && res.post) {
          // If this is an article, redirect to the dedicated article page
          if (res.post.postType === "article") {
            router.replace(`/guest/${slug}/article/${postId}${referSuffix}`);
            return;
          }
          setPost(res.post);
          // Use post's embedded org data as fallback if org not yet loaded
          if (!organization && res.post.organization) {
            setOrganization(res.post.organization as Organization);
          }
        }
      } catch (err) {
        console.error("Error fetching post:", err);
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

  // ── Loading state ─────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: brandColor }}
        />
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────

  if (!post) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center ${theme === "dark" ? "bg-zinc-950" : "bg-white"}`}
      >
        <AlertCircle
          className={`h-16 w-16 mb-4 ${theme === "dark" ? "text-zinc-700" : "text-gray-300"}`}
        />
        <h1
          className={`text-2xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
        >
          Post Not Found
        </h1>
        <p
          className={`mb-6 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}
        >
          The post you&apos;re looking for doesn&apos;t exist or has been
          removed.
        </p>
        <Link href={`/guest/${slug}${referSuffix}`}>
          <Button
            style={{ backgroundColor: brandColor }}
            className="text-black"
          >
            Back to Office
          </Button>
        </Link>
      </div>
    );
  }

  const orgForDisplay = organization || post.organization;

  // ── Main render ───────────────────────────────────────────────

  return (
    <div
      className={`min-h-screen ${theme === "dark" ? "bg-zinc-950" : "bg-gray-50"}`}
    >
      <style>{`
        .brand-hover:hover { color: ${brandColor} !important; }
        .brand-focus:focus { border-color: ${brandColor} !important; box-shadow: 0 0 0 1px ${brandColor} !important; }
      `}</style>

      {/* ─── Header ───────────────────────────────────────── */}
      {/* <GuestNavbar organization={orgForDisplay} slug={slug} theme={theme} setTheme={setTheme} brandColor={brandColor} /> */}

      {/* ─── Content ──────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        {/* <Link
          href={`/guest/${slug}${referSuffix}`}
          className="inline-flex items-center gap-2 transition-colors mb-6"
          style={{ color: brandColor }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to office
        </Link> */}

        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* ─── Post (left 2 cols) ────────────────────────── */}
          <div className="lg:col-span-2">


            {/* Post card */}
            <div
              className={`rounded-xl border overflow-hidden ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}
            >
              <div className="p-6">
                {/* Author header */}
                <div className="flex items-center gap-3 mb-4">
                  {post.author.profilePicture ? (
                    <img
                      src={post.author.profilePicture}
                      alt={post.author.name}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-11 w-11 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${brandColor}33` }}
                    >
                      <span
                        className="font-semibold text-sm"
                        style={{ color: brandColor }}
                      >
                        {post.author.name
                          ?.split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || "?"}
                      </span>
                    </div>
                  )}
                  <div>
                    <p
                      className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      {post.author.name}
                    </p>
                    <p
                      className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}
                    >
                      {timeAgo(post.createdAt)}
                      {post.channels?.length > 0 && (
                        <>
                          {" "}&middot; in{" "}
                          <span style={{ color: brandColor }}>
                            {post.channels.map((c) => c.title).join(", ")}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Post content */}
                <div
                  className={`text-[15px] leading-relaxed mb-4 whitespace-pre-wrap break-words ${theme === "dark" ? "text-zinc-200" : "text-gray-800"}`}
                >
                  {post.content.replace(/(https?:\/\/[^\s]+)/gi, '').trim()}
                </div>

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag, i) => (
                      <span
                        key={i}
                        className={`text-sm px-2.5 py-0.5 rounded-full ${theme === "dark" ? "bg-zinc-800 text-zinc-400" : "bg-gray-100 text-gray-600"}`}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Attachments */}
                {post.attachments && post.attachments.length > 0 && (
                  <div className="mb-4 space-y-3">
                    {post.attachments.filter((a) => a.type === "image").length > 0 && (
                      <div
                        className={cn(
                          "grid gap-[2px] overflow-hidden rounded-xl border border-[#2a2a35]",
                          post.attachments.filter((a) => a.type === "image").length === 1
                            ? "grid-cols-1 border-none"
                            : "grid-cols-2"
                        )}
                      >
                        {post.attachments
                          .filter((a) => a.type === "image")
                          .map((att, i) => (
                            <img
                              key={i}
                              src={att.url}
                              alt={att.name}
                              className={cn(
                                "w-full transition-opacity",
                                post.attachments.filter((a) => a.type === "image").length === 1
                                  ? "h-auto max-h-[600px] object-contain block rounded-xl border border-[#2a2a35]"
                                  : "aspect-square object-cover"
                              )}
                            />
                          ))}
                      </div>
                    )}
                    {post.attachments
                      .filter((a) => a.type === "video")
                      .map((att, i) => (
                        <video key={i} src={att.url} controls className="w-full rounded-lg max-h-96" />
                      ))}
                    {post.attachments
                      .filter((a) => a.type !== "image" && a.type !== "video")
                      .map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-3 p-3 rounded-lg border ${theme === "dark" ? "bg-zinc-800 border-zinc-700 hover:bg-zinc-750" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}
                        >
                          <AttachmentIcon type={att.type} />
                          <span className={`text-sm truncate ${theme === "dark" ? "text-zinc-300" : "text-gray-700"}`}>{att.name}</span>
                        </a>
                      ))}
                  </div>
                )}

                {/* Link previews */}
                {post.linkPreviews && post.linkPreviews.length > 0 && (
                  <div className="mb-4 space-y-3">
                    {post.linkPreviews.map((lp, i) => {
                      // Clean URL to strip any leaked HTML tags
                      let lpUrl = lp.url.replace(/<[^>]*>/g, "").replace(/[>"']+$/, "");
                      const urlMatch = lpUrl.match(/^(https?:\/\/[^\s"'<>]+)/i);
                      if (urlMatch) lpUrl = urlMatch[1];
                      return (
                      <a
                        key={i}
                        href={lpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block rounded-lg border overflow-hidden ${theme === "dark" ? "bg-zinc-800 border-zinc-700 hover:border-zinc-600" : "bg-gray-50 border-gray-200 hover:border-gray-300"} transition-colors`}
                      >
                        {lp.image && lp.showThumbnail !== false && (
                          <img src={lp.image} alt={lp.title || ""} className="w-full h-48 object-cover" />
                        )}
                        <div className="p-3">
                          {lp.siteName && <p className={`text-xs mb-1 ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{lp.siteName}</p>}
                          {lp.title && <p className={`text-sm font-medium ${theme === "dark" ? "text-zinc-200" : "text-gray-900"}`}>{lp.title}</p>}
                          {lp.description && <p className={`text-xs mt-1 line-clamp-2 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>{lp.description}</p>}
                        </div>
                      </a>
                      );
                    })}
                  </div>
                )}

                {/* Quoted post */}
                {post.quotedPost && (
                  <div className={`rounded-lg border p-4 mb-4 ${theme === "dark" ? "bg-zinc-800/50 border-zinc-700" : "bg-gray-50 border-gray-200"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {post.quotedPost.authorId?.profilePicture ? (
                        <img src={post.quotedPost.authorId?.profilePicture} alt={post.quotedPost.authorId?.name} className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}33` }}>
                          <span className="text-xs font-semibold" style={{ color: brandColor }}>{post.quotedPost.authorId?.name?.[0]?.toUpperCase() || "?"}</span>
                        </div>
                      )}
                      <span className={`text-sm font-medium ${theme === "dark" ? "text-zinc-300" : "text-gray-700"}`}>{post.quotedPost.authorId?.name}</span>
                      <span className={`text-xs ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>{timeAgo(post.quotedPost.createdAt)}</span>
                    </div>
                    <p className={`text-sm line-clamp-3 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>
                      {post.quotedPost.content.replace(/(https?:\/\/[^\s]+)/gi, '').trim()}
                    </p>
                  </div>
                )}

                {/* Poll (read-only) */}
                {post.hasPoll && post.poll && (
                  <div className={`rounded-lg border p-4 mb-4 ${theme === "dark" ? "bg-zinc-800/50 border-zinc-700" : "bg-gray-50 border-gray-200"}`}>
                    <p className={`font-medium mb-3 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{post.poll.question}</p>
                    <div className="space-y-2">
                      {post.poll.options.map((opt, i) => (
                        <div key={i} className="relative">
                          <div className={`rounded-lg overflow-hidden ${theme === "dark" ? "bg-zinc-700" : "bg-gray-200"}`}>
                            <div className="h-10 rounded-lg transition-all" style={{ width: `${opt.percentage}%`, backgroundColor: `${brandColor}40` }} />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-between px-3">
                            <span className={`text-sm ${theme === "dark" ? "text-zinc-200" : "text-gray-800"}`}>{opt.text}</span>
                            <span className={`text-sm font-medium ${theme === "dark" ? "text-zinc-300" : "text-gray-700"}`}>{opt.percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className={`text-xs mt-3 ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>
                      {post.poll.totalVotes} vote{post.poll.totalVotes !== 1 ? "s" : ""}{post.poll.isExpired ? " · Poll ended" : ""}
                    </p>
                  </div>
                )}

                {/* Reactions & stats bar */}
                <div className={`flex items-center justify-between pt-4 border-t ${theme === "dark" ? "border-zinc-800" : "border-gray-200"}`}>
                  <div className="flex items-center gap-1.5">
                    {post.reactionsCount && post.reactionsCount.total > 0 && (
                      <>
                        <div className="flex -space-x-1">
                          {(Object.entries(REACTION_ICONS) as [string, { label: string; emoji: string }][])
                            .filter(([key]) => (post.reactionsCount as any)[key] > 0)
                            .slice(0, 3)
                            .map(([key, val]) => (
                              <span key={key} className="text-sm" title={val.label}>{val.emoji}</span>
                            ))}
                        </div>
                        <span className={`text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-500"}`}>{post.reactionsCount.total}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {post.commentsCount > 0 && (
                      <span className={`flex items-center gap-1.5 text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-500"}`}>
                        <MessageCircle className="h-4 w-4" />{post.commentsCount}
                      </span>
                    )}
                    {post.repostsCount > 0 && (
                      <span className={`flex items-center gap-1.5 text-sm ${theme === "dark" ? "text-zinc-400" : "text-gray-500"}`}>
                        <Repeat2 className="h-4 w-4" />{post.repostsCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Sidebar (right 1 col) ─────────────────────── */}
          <div className="lg:col-span-1 mt-8 lg:mt-0">
            <div className="lg:sticky lg:top-0">
              <div className={`rounded-xl border overflow-hidden ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
                <div className="p-6">
                  {/* Org info */}
                  <div className="flex items-center gap-3 mb-4">
                    {orgForDisplay?.icon ? (
                      <img src={orgForDisplay.icon} alt={orgForDisplay.name} className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: brandColor }}>
                        <Building2 className="h-6 w-6 text-black" />
                      </div>
                    )}
                    <div>
                      <p className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{orgForDisplay?.name}</p>
                      <p className={`text-sm ${theme === "dark" ? "text-zinc-500" : "text-gray-500"}`}>on Garage</p>
                    </div>
                  </div>

                  <p className={`text-sm mb-6 ${theme === "dark" ? "text-zinc-400" : "text-gray-600"}`}>
                    Want to join{" "}
                    <span className="font-medium" style={{ color: brandColor }}>{orgForDisplay?.name}</span>
                    ? Become part of the community and access exclusive content.
                  </p>

                  {isMember || (isWorkspaceUser && workspaceOrgId === organization?._id) ? (
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
                      onClick={handleJoinCommunity}
                    >
                      Join Community
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  )}

                  <div className={`border-t ${theme === "dark" ? "border-zinc-800" : "border-gray-200"} my-6`} />

                  <div className="text-center">
                    <p className={`text-xs ${theme === "dark" ? "text-zinc-600" : "text-gray-400"}`}>
                      Powered by <span style={{ color: brandColor }} className="font-medium">Garage</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Referrer banner moved below the card */}
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
                    <span
                      className={`text-sm truncate ${
                        theme === "dark" ? "text-zinc-300" : "text-zinc-700"
                      }`}
                    >
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
          </div>
        </div>
      </section>

    </div>
  );
}
