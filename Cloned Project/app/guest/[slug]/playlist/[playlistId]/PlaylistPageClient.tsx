"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  getUserDataFromToken,
  isAuthenticated as checkWorkspaceAuth,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  User,
  AlertCircle,
  Clock,
  Video as VideoIcon,
  ListVideo,
  Play,
  Music,
  X,
  Loader2,
} from "lucide-react";
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

interface PlaylistVideo {
  _id: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  videoUrl?: string | null;
  videoS3Key?: string | null;
  streamUrl?: string | null;
  sourceType?: string;
  _videoSource: "workshop" | "standalone" | "courseVideo";
  courseTitle?: string;
  sectionTitle?: string;
  createdAt?: string;
  date?: string;
}

interface PlaylistData {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  type: "founder" | "learner";
  videoCount: number;
  videos: PlaylistVideo[];
  createdBy?: Author;
  createdAt: string;
  updatedAt: string;
}

interface ReferrerInfo {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getSourceBadge(source: string) {
  switch (source) {
    case "workshop":
      return { label: "Livestream", color: "bg-blue-500/20 text-blue-400" };
    case "standalone":
      return { label: "Video", color: "bg-green-500/20 text-green-400" };
    case "courseVideo":
      return { label: "Course", color: "bg-purple-500/20 text-purple-400" };
    default:
      return { label: "Video", color: "bg-zinc-500/20 text-zinc-400" };
  }
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

export default function PlaylistPageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const slug = params.slug as string;
  const playlistId = params.playlistId as string;
  const referCode = searchParams.get("referCode");
  const referSuffix = referCode ? `?referCode=${referCode}` : "";

  // Playlist & org state
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme] = useState<"light" | "dark">("dark");

  // Video player state
  const [playingVideo, setPlayingVideo] = useState<PlaylistVideo | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  // Auth state (minimal - for sidebar CTA only)
  const [isWorkspaceUser, setIsWorkspaceUser] = useState(false);
  const [workspaceOrgId, setWorkspaceOrgId] = useState<string | null>(null);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);

  // Join flow
  const [joinFlowOpen, setJoinFlowOpen] = useState(false);

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

  // Fetch org details (for membership check only — initial org data comes from playlist endpoint)
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

  // Fetch playlist
  useEffect(() => {
    if (!playlistId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await api<{
          success: boolean;
          playlist: PlaylistData;
          organization: Organization;
        }>(`/public/playlists/${playlistId}`, { method: "GET" });

        if (res.success && res.playlist) {
          setPlaylist(res.playlist);
          if (!organization && res.organization) {
            setOrganization(res.organization as Organization);
          }
        }
      } catch (err) {
        console.error("Error fetching playlist:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [playlistId]);

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

  // ── Video Player Handler ──────────────────────────────────────

  const handlePlayVideo = (video: PlaylistVideo) => {
    // Course videos are not playable on guest page
    if (video._videoSource === "courseVideo") {
      // If already a member, go straight to workspace
      if (isMember || (isWorkspaceUser && workspaceOrgId === organization?._id)) {
        router.push("/workspace");
        return;
      }
      // Otherwise open the join flow
      setJoinFlowOpen(true);
      return;
    }
    setPlayerLoading(true);
    setPlayingVideo(video);
    // Scroll to the player
    setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPlayerLoading(false);
    }, 100);
  };

  const closePlayer = () => {
    setPlayingVideo(null);
    setPlayerLoading(false);
  };

  // ── Video Player Renderer ─────────────────────────────────────

  function renderVideoPlayer(video: PlaylistVideo) {
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
          src={playbackUrl}
          controls
          autoPlay
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

  if (!playlist) {
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
          Playlist Not Found
        </h1>
        <p
          className={`mb-6 ${
            theme === "dark" ? "text-zinc-400" : "text-gray-600"
          }`}
        >
          The playlist you&apos;re looking for doesn&apos;t exist or has been
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
          {/* ─── Playlist (left 2 cols) ────────────────────────── */}
          <div className="lg:col-span-2">

            {/* Inline Video Player */}
            {playingVideo && (
              <div ref={playerRef} className="mb-6">
                <div
                  className={`rounded-xl border overflow-hidden ${
                    theme === "dark"
                      ? "bg-zinc-900 border-zinc-800"
                      : "bg-white border-gray-200"
                  }`}
                >
                  {/* Player */}
                  {playerLoading ? (
                    <div
                      className={`w-full aspect-video flex items-center justify-center ${
                        theme === "dark" ? "bg-zinc-800" : "bg-gray-200"
                      }`}
                    >
                      <Loader2
                        className="h-8 w-8 animate-spin"
                        style={{ color: brandColor }}
                      />
                    </div>
                  ) : (
                    renderVideoPlayer(playingVideo)
                  )}

                  {/* Now Playing bar */}
                  <div
                    className={`flex items-center justify-between px-4 py-3 border-t ${
                      theme === "dark"
                        ? "border-zinc-800"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `${brandColor}33` }}
                      >
                        <Play
                          className="w-3.5 h-3.5 ml-0.5"
                          style={{ color: brandColor }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            theme === "dark" ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {playingVideo.title}
                        </p>
                        <p
                          className={`text-xs truncate ${
                            theme === "dark" ? "text-zinc-500" : "text-gray-500"
                          }`}
                        >
                          Now playing
                          {playingVideo.duration
                            ? ` · ${formatDuration(playingVideo.duration)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={closePlayer}
                      className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                        theme === "dark"
                          ? "text-zinc-400 hover:text-white hover:bg-zinc-800"
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                      title="Close player"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Playlist card */}
            <div
              className={`rounded-xl border overflow-hidden ${
                theme === "dark"
                  ? "bg-zinc-900 border-zinc-800"
                  : "bg-white border-gray-200"
              }`}
            >
              {/* Playlist header */}
              <div
                className="h-40 relative flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${brandColor}33 0%, ${
                    theme === "dark" ? "#18181b" : "#f3f4f6"
                  } 50%, ${
                    theme === "dark" ? "#27272a" : "#e5e7eb"
                  } 100%)`,
                }}
              >
                <ListVideo
                  className="h-16 w-16"
                  style={{ color: `${brandColor}80` }}
                />
                <div
                  className={`absolute bottom-3 right-3 px-3 py-1 rounded-lg text-sm font-medium ${
                    theme === "dark"
                      ? "bg-black/60 text-white"
                      : "bg-white/80 text-gray-800"
                  }`}
                >
                  {playlist.videoCount} video
                  {playlist.videoCount !== 1 ? "s" : ""}
                </div>
              </div>

              <div className="p-6">
                {/* Author header */}
                {playlist.createdBy && (
                  <div className="flex items-center gap-3 mb-4">
                    {playlist.createdBy.profilePicture ? (
                      <img
                        src={playlist.createdBy.profilePicture}
                        alt={playlist.createdBy.name}
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
                          {playlist.createdBy.name
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
                        {playlist.createdBy.name}
                      </p>
                      <p
                        className={`text-sm ${
                          theme === "dark" ? "text-zinc-500" : "text-gray-500"
                        }`}
                      >
                        Playlist curator
                      </p>
                    </div>
                  </div>
                )}

                {/* Playlist title */}
                <h1
                  className={`text-xl font-bold mb-3 ${
                    theme === "dark" ? "text-white" : "text-gray-900"
                  }`}
                >
                  {playlist.title}
                </h1>

                {/* Playlist description */}
                {playlist.description && (
                  <p
                    className={`text-[15px] leading-relaxed mb-4 ${
                      theme === "dark" ? "text-zinc-300" : "text-gray-700"
                    }`}
                  >
                    {playlist.description}
                  </p>
                )}

                {/* Info bar */}
                <div
                  className={`flex items-center gap-4 pt-4 border-t text-sm ${
                    theme === "dark"
                      ? "border-zinc-800 text-zinc-500"
                      : "border-gray-200 text-gray-500"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <VideoIcon className="h-4 w-4" />
                    <span>
                      {playlist.videoCount} video
                      {playlist.videoCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>
                      {new Date(playlist.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Video list */}
              {playlist.videos && playlist.videos.length > 0 && (
                <div
                  className={`border-t ${
                    theme === "dark" ? "border-zinc-800" : "border-gray-200"
                  }`}
                >
                  <div className="px-6 py-4">
                    <h3
                      className={`text-sm font-semibold mb-3 ${
                        theme === "dark" ? "text-zinc-400" : "text-gray-500"
                      }`}
                    >
                      PLAYLIST CONTENTS
                    </h3>
                    <div className="space-y-1">
                      {playlist.videos.map((video, index) => {
                        const badge = getSourceBadge(video._videoSource);
                        const isPlaying = playingVideo?._id === video._id;
                        const isCourseVideo = video._videoSource === "courseVideo";
                        const hasPlayableUrl = !isCourseVideo && !!(video.streamUrl || video.videoUrl);

                        return (
                          <button
                            key={video._id}
                            onClick={() => (hasPlayableUrl || isCourseVideo) ? handlePlayVideo(video) : undefined}
                            disabled={!hasPlayableUrl && !isCourseVideo}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left group ${
                              isPlaying
                                ? theme === "dark"
                                  ? "bg-zinc-800 ring-1"
                                  : "bg-gray-100 ring-1"
                                : (hasPlayableUrl || isCourseVideo)
                                  ? theme === "dark"
                                    ? "hover:bg-zinc-800/50 cursor-pointer"
                                    : "hover:bg-gray-50 cursor-pointer"
                                  : "opacity-60 cursor-not-allowed"
                            }`}
                            style={isPlaying ? { ringColor: `${brandColor}66` } : undefined}
                          >
                            {/* Index / Playing indicator */}
                            <span
                              className={`text-sm font-medium w-6 text-center flex-shrink-0 ${
                                isPlaying
                                  ? ""
                                  : theme === "dark"
                                    ? "text-zinc-600 group-hover:hidden"
                                    : "text-gray-400 group-hover:hidden"
                              }`}
                              style={isPlaying ? { color: brandColor } : undefined}
                            >
                              {isPlaying ? (
                                <span className="flex justify-center items-center gap-[2px]">
                                  <span className="w-[3px] h-3 rounded-full animate-pulse" style={{ backgroundColor: brandColor }} />
                                  <span className="w-[3px] h-4 rounded-full animate-pulse" style={{ backgroundColor: brandColor, animationDelay: "0.2s" }} />
                                  <span className="w-[3px] h-2 rounded-full animate-pulse" style={{ backgroundColor: brandColor, animationDelay: "0.4s" }} />
                                </span>
                              ) : (
                                index + 1
                              )}
                            </span>
                            {/* Play icon on hover (replaces index) */}
                            {!isPlaying && hasPlayableUrl && (
                              <span
                                className={`w-6 text-center flex-shrink-0 hidden group-hover:block`}
                                style={{ color: brandColor }}
                              >
                                <Play className="w-4 h-4 mx-auto" />
                              </span>
                            )}

                            {/* Thumbnail */}
                            <div
                              className={`w-16 h-10 rounded overflow-hidden flex-shrink-0 flex items-center justify-center relative ${
                                theme === "dark" ? "bg-zinc-800" : "bg-gray-200"
                              }`}
                            >
                              {video.thumbnail ? (
                                <img
                                  src={video.thumbnail}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Play
                                  className={`w-4 h-4 ${
                                    theme === "dark"
                                      ? "text-zinc-600"
                                      : "text-gray-400"
                                  }`}
                                />
                              )}
                              {/* Duration overlay */}
                              {video.duration && video.duration > 0 && (
                                <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] px-1 rounded">
                                  {formatDuration(video.duration)}
                                </span>
                              )}
                            </div>

                            {/* Title & meta */}
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium truncate ${
                                  isPlaying
                                    ? ""
                                    : theme === "dark"
                                      ? "text-zinc-200"
                                      : "text-gray-800"
                                }`}
                                style={isPlaying ? { color: brandColor } : undefined}
                              >
                                {video.title}
                              </p>
                              <p
                                className={`text-xs truncate ${
                                  theme === "dark"
                                    ? "text-zinc-500"
                                    : "text-gray-500"
                                }`}
                              >
                                {video.courseTitle && `${video.courseTitle}`}
                                {video.sectionTitle &&
                                  ` · ${video.sectionTitle}`}
                              </p>
                            </div>

                            {/* Source badge + lock for course videos */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isCourseVideo && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  (isMember || (isWorkspaceUser && workspaceOrgId === organization?._id))
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-amber-500/20 text-amber-400"
                                }`}>
                                  {(isMember || (isWorkspaceUser && workspaceOrgId === organization?._id))
                                    ? "Open in workspace"
                                    : "Join to watch"}
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-medium ${badge.color}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Sidebar (right 1 col) ─────────────────────── */}
          <div className="lg:col-span-1 mt-8 lg:mt-0">
            <div className="lg:sticky lg:top-8">
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
