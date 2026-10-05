"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ContentTracker } from "@/lib/content-tracker";
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
  Play,
  AlertCircle,
  Clock,
  Video as VideoIcon,
  ExternalLink,
} from "lucide-react";
import GuestNavbar from "../../components/GuestNavbar";
import GuestJoinFlow from "../../components/GuestJoinFlow";

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

interface VideoData {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  videoUrl?: string | null;
  streamUrl?: string | null;
  sourceType: string;
  duration: number;
  createdAt: string;
  videoType: string;
  author?: Author;
}

interface ReferrerInfo {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

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

// Convert YouTube/Vimeo URLs to embed format
function getEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]+)/
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
}

// ── Component ───────────────────────────────────────────────────────

export default function VideoPageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const slug = params.slug as string;
  const videoId = params.videoId as string;
  const referCode = searchParams.get("referCode");
  const referSuffix = referCode ? `?referCode=${referCode}` : "";

  // Video & org state
  const [video, setVideo] = useState<VideoData | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Auth state (minimal - for sidebar CTA only)
  const [isWorkspaceUser, setIsWorkspaceUser] = useState(false);
  const [workspaceOrgId, setWorkspaceOrgId] = useState<string | null>(null);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);

  // Join flow
  const [joinFlowOpen, setJoinFlowOpen] = useState(false);

  // Engagement tracker
  const trackerRef = useRef<ContentTracker | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const lastSeekTime = useRef(0);

  const brandColor = organization?.branding?.primaryColor || "#FBA70A";
  const isMember = organization?.isMember || false;

  // ── Effects ─────────────────────────────────────────────────────

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

  // Fetch org details (for membership check only — initial org data comes from video endpoint)
  useEffect(() => {
    if (!slug || !guestUserId) return; // Only needed when user is authenticated
    (async () => {
      try {
        const url = `/guest-auth/hq-by-slug/${slug}?userId=${guestUserId}`;
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

  // Fetch video
  useEffect(() => {
    if (!videoId) return;
    (async () => {
      try {
        setLoading(true);
        // Try standalone first, then workshop
        let res = await api<{
          success: boolean;
          video: VideoData;
          organization: Organization;
        }>(`/public/videos/${videoId}?videoType=standalone`, { method: "GET" });

        if (!res.success || !res.video) {
          // Try workshop type
          res = await api<{
            success: boolean;
            video: VideoData;
            organization: Organization;
          }>(`/public/videos/${videoId}?videoType=workshop`, { method: "GET" });
        }

        if (res.success && res.video) {
          setVideo(res.video);
          if (!organization && res.organization) {
            setOrganization(res.organization as Organization);
          }
        }
      } catch (err) {
        console.error("Error fetching video:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [videoId]);

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
    if (!video || !organization?._id) return;
    // Create tracker once video + org are loaded
    const tracker = new ContentTracker({
      contentId: video._id,
      contentType: "video",
      orgId: organization._id,
      contentTitle: video.title,
      affiliateId: referCode,
      userId: guestUserId,
      guestId: !guestUserId ? `anon_${Date.now().toString(36)}` : null,
      duration: video.duration || 0,
    });
    trackerRef.current = tracker;

    return () => {
      tracker.destroy();
      trackerRef.current = null;
    };
  }, [video?._id, organization?._id]);

  // Bind native video element events
  const bindVideoEl = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    if (!el) return;

    const t = () => trackerRef.current;

    el.addEventListener("play", () => t()?.onPlay(el.currentTime));
    el.addEventListener("pause", () => t()?.onPause(el.currentTime));
    el.addEventListener("ended", () => t()?.onEnded());
    el.addEventListener("timeupdate", () => t()?.onTimeUpdate(el.currentTime));
    el.addEventListener("ratechange", () => t()?.onPlaybackRateChange(el.playbackRate));
    el.addEventListener("seeking", () => {
      const from = lastSeekTime.current;
      lastSeekTime.current = el.currentTime;
      t()?.onSeek(from, el.currentTime);
    });
    el.addEventListener("volumechange", () => {
      if (el.muted) t()?.onMute(); else t()?.onUnmute();
    });
    el.addEventListener("fullscreenchange", () => t()?.onFullscreen());
  }, []);

  // ── Video Player Renderer ─────────────────────────────────────

  function renderVideoPlayer() {
    if (!video) return null;

    // Priority: streamUrl (S3 signed URL) > videoUrl
    const playbackUrl = video.streamUrl || video.videoUrl;

    if (!playbackUrl) {
      return (
        <div
          className={`w-full aspect-video rounded-xl flex items-center justify-center ${
            theme === "dark" ? "bg-zinc-800" : "bg-gray-200"
          }`}
        >
          <div className="text-center">
            <VideoIcon
              className={`h-16 w-16 mx-auto mb-3 ${
                theme === "dark" ? "text-zinc-600" : "text-gray-400"
              }`}
            />
            <p
              className={`text-sm ${
                theme === "dark" ? "text-zinc-500" : "text-gray-500"
              }`}
            >
              Video unavailable
            </p>
          </div>
        </div>
      );
    }

    // Check if it's an embeddable URL (YouTube/Vimeo)
    const embedUrl = getEmbedUrl(playbackUrl);

    if (embedUrl) {
      return (
        <div className="w-full aspect-video rounded-xl overflow-hidden">
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title={video.title}
          />
        </div>
      );
    }

    // Direct video URL (S3 signed URL or direct link)
    return (
      <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
        <video
          ref={bindVideoEl}
          src={playbackUrl}
          controls
          autoPlay={false}
          className="w-full h-full"
          poster={video.thumbnail || undefined}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          theme === "dark" ? "bg-zinc-950" : "bg-white"
        }`}
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: brandColor }}
        />
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────

  if (!video) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center ${
          theme === "dark" ? "bg-zinc-950" : "bg-white"
        }`}
      >
        <AlertCircle
          className={`h-16 w-16 mb-4 ${
            theme === "dark" ? "text-zinc-700" : "text-gray-300"
          }`}
        />
        <h1
          className={`text-2xl font-bold mb-2 ${
            theme === "dark" ? "text-white" : "text-gray-900"
          }`}
        >
          Video Not Found
        </h1>
        <p
          className={`mb-6 ${
            theme === "dark" ? "text-zinc-400" : "text-gray-600"
          }`}
        >
          The video you&apos;re looking for doesn&apos;t exist or has been
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

  const orgForDisplay = organization;

  // ── Main render ───────────────────────────────────────────────

  return (
    <div
      className={`min-h-screen ${
        theme === "dark" ? "bg-zinc-950" : "bg-gray-50"
      }`}
    >
      <style>{`
        .brand-hover:hover { color: ${brandColor} !important; }
      `}</style>

      {/* ─── Content ──────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* ─── Video (left 2 cols) ────────────────────────── */}
          <div className="lg:col-span-2">

            {/* Video card */}
            <div
              className={`rounded-xl border overflow-hidden ${
                theme === "dark"
                  ? "bg-zinc-900 border-zinc-800"
                  : "bg-white border-gray-200"
              }`}
            >
              {/* Video Player */}
              <div className="p-4 pb-0">{renderVideoPlayer()}</div>

              <div className="p-6">
                {/* Author header */}
                {video.author && (
                  <div className="flex items-center gap-3 mb-4">
                    {video.author.profilePicture ? (
                      <img
                        src={video.author.profilePicture}
                        alt={video.author.name}
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
                          {video.author.name
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
                        className={`font-semibold ${
                          theme === "dark" ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {video.author.name}
                      </p>
                      <p
                        className={`text-sm ${
                          theme === "dark" ? "text-zinc-500" : "text-gray-500"
                        }`}
                      >
                        {timeAgo(video.createdAt)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Video title */}
                <h1
                  className={`text-xl font-bold mb-3 ${
                    theme === "dark" ? "text-white" : "text-gray-900"
                  }`}
                >
                  {video.title}
                </h1>

                {/* Video description */}
                {video.description && (
                  <div
                    className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words ${
                      theme === "dark" ? "text-zinc-300" : "text-gray-700"
                    }`}
                    dangerouslySetInnerHTML={{ __html: video.description }}
                  />
                )}

                {/* Video info bar */}
                <div
                  className={`flex items-center gap-4 mt-4 pt-4 border-t text-sm ${
                    theme === "dark"
                      ? "border-zinc-800 text-zinc-500"
                      : "border-gray-200 text-gray-500"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>
                      {new Date(video.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <VideoIcon className="h-4 w-4" />
                    <span className="capitalize">{video.videoType}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Sidebar (right 1 col) ─────────────────────── */}
          <div className="lg:col-span-1 mt-8 lg:mt-0">
            <div className="lg:sticky lg:top-0">
              <div
                className={`rounded-xl border overflow-hidden ${
                  theme === "dark"
                    ? "bg-zinc-900 border-zinc-800"
                    : "bg-white border-gray-200"
                }`}
              >
                <div className="p-6">
                  {/* Org info */}
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
                      <p
                        className={`font-semibold ${
                          theme === "dark" ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {orgForDisplay?.name}
                      </p>
                      <p
                        className={`text-sm ${
                          theme === "dark" ? "text-zinc-500" : "text-gray-500"
                        }`}
                      >
                        on Garage
                      </p>
                    </div>
                  </div>

                  <p
                    className={`text-sm mb-6 ${
                      theme === "dark" ? "text-zinc-400" : "text-gray-600"
                    }`}
                  >
                    Want to join{" "}
                    <span
                      className="font-medium"
                      style={{ color: brandColor }}
                    >
                      {orgForDisplay?.name}
                    </span>
                    ? Become part of the community and access exclusive content.
                  </p>

                  {isMember ||
                  (isWorkspaceUser &&
                    workspaceOrgId === organization?._id) ? (
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

                  <div
                    className={`border-t ${
                      theme === "dark" ? "border-zinc-800" : "border-gray-200"
                    } my-6`}
                  />

                  <div className="text-center">
                    <p
                      className={`text-xs ${
                        theme === "dark" ? "text-zinc-600" : "text-gray-400"
                      }`}
                    >
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

      {/* GuestJoinFlow for sidebar CTA */}
      {orgForDisplay && (
        <GuestJoinFlow
          organization={orgForDisplay}
          slug={slug}
          brandColor={brandColor}
          isOpen={joinFlowOpen}
          onClose={() => setJoinFlowOpen(false)}
        />
      )}
    </div>
  );
}
