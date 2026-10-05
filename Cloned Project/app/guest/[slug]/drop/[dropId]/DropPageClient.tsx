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
  ArrowRight,
  Building2,
  User,
  AlertCircle,
  Volume2,
  VolumeX,
  Play,
  Pause,
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
  avatar?: string;
}

interface DropData {
  _id: string;
  caption?: string;
  authorId?: Author;
  videoUrl?: string | null;
  streamUrl?: string | null;
  sourceType: string;
  duration: number;
  thumbnailUrl?: string;
  createdAt: string;
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

function getEmbedUrl(url: string): string | null {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch)
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1&enablejsapi=1`;

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch)
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=0&controls=0&title=0&byline=0&portrait=0`;

  return null;
}

// ── Component ───────────────────────────────────────────────────────

export default function DropPageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const slug = params.slug as string;
  const dropId = params.dropId as string;
  const referCode = searchParams.get("referCode");
  const referSuffix = referCode ? `?referCode=${referCode}` : "";

  const [drop, setDrop] = useState<DropData | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth state
  const [isWorkspaceUser, setIsWorkspaceUser] = useState(false);
  const [workspaceOrgId, setWorkspaceOrgId] = useState<string | null>(null);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);
  const [joinFlowOpen, setJoinFlowOpen] = useState(false);

  // Player state
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPlayFlash, setShowPlayFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Engagement tracker
  const trackerRef = useRef<ContentTracker | null>(null);

  const brandColor = organization?.branding?.primaryColor || "#FBA70A";
  const isMember = organization?.isMember || false;

  // ── Effects ─────────────────────────────────────────────────────

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
    if (storedUserId) setGuestUserId(storedUserId);
  }, []);

  // Fetch org for membership check
  useEffect(() => {
    if (!slug || !guestUserId) return;
    (async () => {
      try {
        const res = await api<{ ok: boolean; organization: Organization }>(
          `/guest-auth/hq-by-slug/${slug}?userId=${guestUserId}`,
          { method: "GET" }
        );
        if (res.ok && res.organization) setOrganization(res.organization);
      } catch {}
    })();
  }, [slug, guestUserId]);

  // Fetch drop
  useEffect(() => {
    if (!dropId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await api<{
          success: boolean;
          drop: DropData;
          organization: Organization;
        }>(`/drops/public/${dropId}`, { method: "GET" });

        if (res.success && res.drop) {
          setDrop(res.drop);
          if (!organization && res.organization) {
            setOrganization(res.organization as Organization);
          }
        }
      } catch (err) {
        console.error("Error fetching drop:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [dropId]);

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

  // Track view
  useEffect(() => {
    if (!dropId) return;
    const timer = setTimeout(() => {
      api(`/drops/${dropId}/view`, { method: "POST" }).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [dropId]);

  // ── Engagement Tracker ────────────────────────────────────────

  useEffect(() => {
    if (!drop || !organization?._id) return;
    const tracker = new ContentTracker({
      contentId: drop._id,
      contentType: "drop",
      orgId: organization._id,
      contentTitle: drop.caption || "Drop",
      affiliateId: referCode,
      userId: guestUserId,
      guestId: !guestUserId ? `anon_${Date.now().toString(36)}` : null,
      duration: drop.duration || 0,
    });
    trackerRef.current = tracker;

    // Bind native video events if available
    const v = videoRef.current;
    if (v) {
      v.addEventListener("play", () => tracker.onPlay(v.currentTime));
      v.addEventListener("pause", () => tracker.onPause(v.currentTime));
      v.addEventListener("ended", () => tracker.onEnded());
      v.addEventListener("timeupdate", () => tracker.onTimeUpdate(v.currentTime));
      v.addEventListener("seeking", () => tracker.onSeek(0, v.currentTime));
      v.addEventListener("volumechange", () => {
        if (v.muted) tracker.onMute(); else tracker.onUnmute();
      });
    }

    return () => {
      tracker.destroy();
      trackerRef.current = null;
    };
  }, [drop?._id, organization?._id]);

  // Video progress tracking for native video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handleTimeUpdate = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    v.addEventListener("timeupdate", handleTimeUpdate);
    return () => v.removeEventListener("timeupdate", handleTimeUpdate);
  }, [drop]);

  // YouTube iframe progress polling
  useEffect(() => {
    if (!drop || drop.sourceType === "upload") return;
    const playbackUrl = drop.streamUrl || drop.videoUrl;
    if (!playbackUrl) return;
    const embedUrl = getEmbedUrl(playbackUrl);
    if (!embedUrl) return;

    progressIntervalRef.current = setInterval(() => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          '{"event":"command","func":"getCurrentTime","args":[]}',
          "*"
        );
      } catch {}
    }, 500);

    const handleMsg = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data.info?.currentTime !== undefined && drop.duration) {
          setProgress((data.info.currentTime / drop.duration) * 100);
        }
      } catch {}
    };
    window.addEventListener("message", handleMsg);

    return () => {
      clearInterval(progressIntervalRef.current);
      window.removeEventListener("message", handleMsg);
    };
  }, [drop]);

  // ── Player controls ─────────────────────────────────────────────

  const ytCommand = (func: string) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args: [] }),
        "*"
      );
    } catch {}
  };

  const togglePlay = () => {
    if (drop?.sourceType === "upload") {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        v.play();
        setIsPlaying(true);
      } else {
        v.pause();
        setIsPlaying(false);
      }
    } else {
      if (isPlaying) {
        ytCommand("pauseVideo");
        setIsPlaying(false);
      } else {
        ytCommand("playVideo");
        setIsPlaying(true);
      }
    }
    setShowPlayFlash(true);
    setTimeout(() => setShowPlayFlash(false), 400);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (drop?.sourceType === "upload") {
      const v = videoRef.current;
      if (!v) return;
      v.muted = !v.muted;
      setIsMuted(v.muted);
    } else {
      if (isMuted) {
        ytCommand("unMute");
        setIsMuted(false);
      } else {
        ytCommand("mute");
        setIsMuted(true);
      }
    }
  };

  // ── Render ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: brandColor }}
        />
      </div>
    );
  }

  if (!drop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950">
        <AlertCircle className="h-16 w-16 mb-4 text-zinc-700" />
        <h1 className="text-2xl font-bold mb-2 text-white">Drop Not Found</h1>
        <p className="mb-6 text-zinc-400">
          This drop doesn&apos;t exist or has been removed.
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

  const playbackUrl = drop.streamUrl || drop.videoUrl;
  const embedUrl = playbackUrl ? getEmbedUrl(playbackUrl) : null;
  const isNativeVideo = drop.sourceType === "upload" || (!embedUrl && playbackUrl);

  return (
    <div className="min-h-screen bg-zinc-950">
      <style>{`
        @keyframes dropPlayFade { 0%{opacity:1;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1.4)} }
      `}</style>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* ─── Video Player (left 2 cols) ─────────────────── */}
          <div className="lg:col-span-2 flex justify-center">
            <div
              className="rounded-2xl overflow-hidden border border-zinc-800 bg-black relative"
              style={{
                width: "min(420px, 100%)",
                aspectRatio: "9/16",
                maxHeight: "80vh",
              }}
            >
              {/* Video layer */}
              {isNativeVideo && playbackUrl ? (
                <video
                  ref={videoRef}
                  src={playbackUrl}
                  autoPlay
                  loop
                  playsInline
                  poster={drop.thumbnailUrl || undefined}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : embedUrl ? (
                <iframe
                  ref={iframeRef}
                  src={embedUrl}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    pointerEvents: "none",
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  Video unavailable
                </div>
              )}

              {/* Click overlay for play/pause */}
              <div
                onClick={togglePlay}
                style={{
                  position: "absolute",
                  inset: 0,
                  cursor: "pointer",
                  zIndex: 10,
                }}
              />

              {/* Play/pause flash */}
              {showPlayFlash && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 20,
                    animation: "dropPlayFade 0.4s ease-out forwards",
                  }}
                >
                  {isPlaying ? (
                    <Play size={24} color="white" fill="white" />
                  ) : (
                    <Pause size={24} color="white" fill="white" />
                  )}
                </div>
              )}

              {/* Mute button */}
              <button
                onClick={toggleMute}
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.4)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 20,
                  color: "white",
                }}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>

              {/* Author + caption bottom overlay */}
              <div
                style={{
                  position: "absolute",
                  bottom: 20,
                  left: 14,
                  right: 14,
                  zIndex: 15,
                  pointerEvents: "none",
                }}
              >
                {drop.authorId && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "#333",
                        backgroundImage: `url(${
                          drop.authorId.profilePicture ||
                          drop.authorId.avatar ||
                          ""
                        })`,
                        backgroundSize: "cover",
                        border: "1.5px solid rgba(255,255,255,0.3)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        color: "white",
                        fontSize: 14,
                        fontWeight: 600,
                        textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                      }}
                    >
                      {drop.authorId.name || drop.authorId.email || "Unknown"}
                    </span>
                  </div>
                )}
                {drop.caption && (
                  <p
                    style={{
                      margin: 0,
                      color: "rgba(255,255,255,0.9)",
                      fontSize: 13,
                      lineHeight: 1.4,
                      textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                    }}
                  >
                    {drop.caption}
                  </p>
                )}
              </div>

              {/* Yellow progress bar */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: "rgba(255,255,255,0.15)",
                  zIndex: 20,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "#FBD10D",
                    borderRadius: 2,
                    transition: "width 0.3s linear",
                  }}
                />
              </div>
            </div>
          </div>

          {/* ─── Sidebar CTA (right 1 col) ──────────────────── */}
          <div className="lg:col-span-1 mt-8 lg:mt-0">
            <div className="lg:sticky lg:top-8">
              <div className="rounded-xl border overflow-hidden bg-zinc-900 border-zinc-800">
                <div className="p-6">
                  {/* Org info */}
                  <div className="flex items-center gap-3 mb-4">
                    {organization?.icon ? (
                      <img
                        src={organization.icon}
                        alt={organization.name}
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
                      <p className="font-semibold text-white">
                        {organization?.name}
                      </p>
                      <p className="text-sm text-zinc-500">on Garage</p>
                    </div>
                  </div>

                  <p className="text-sm mb-6 text-zinc-400">
                    Want to join{" "}
                    <span
                      className="font-medium"
                      style={{ color: brandColor }}
                    >
                      {organization?.name}
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

                  <div className="border-t border-zinc-800 my-6" />

                  <div className="text-center">
                    <p className="text-xs text-zinc-600">
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
          </div>
        </div>
      </section>

      {/* GuestJoinFlow */}
      {organization && (
        <GuestJoinFlow
          organization={organization}
          slug={slug}
          brandColor={brandColor}
          isOpen={joinFlowOpen}
          onClose={() => setJoinFlowOpen(false)}
        />
      )}
    </div>
  );
}
