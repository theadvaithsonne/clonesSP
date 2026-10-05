"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Video, Play, Clock, Share2, MoreVertical, ListVideo,
  X, Loader2, Check, Copy
} from "lucide-react";
import {
  getLearnInitLivestream, getPlaylists, getStandaloneVideos,
  getVideoShareLink, getPlaylistShareLink, getStandaloneVideoStreamUrl,
  getCourseVideoStreamUrl, type Workshop, type Playlist, type StandaloneVideo
} from "@/lib/feed-api";
import { api } from "@/lib/api";
import { getToken, getOrgId, getUserIdFromToken } from "@/lib/auth";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Drop {
  _id: string;
  caption: string;
  authorId: { _id: string; name?: string; email: string; profilePicture?: string; avatar?: string };
  videoUrl?: string;
  videoS3Key?: string;
  sourceType: "upload" | "link";
  duration: number;
  thumbnailUrl?: string;
  viewsCount: number;
  likesCount: number;
  sharesCount: number;
  streamUrl: string | null;
  createdAt: string;
}

export function AllVideosPage() {
  const [loading, setLoading] = useState(true);
  const [completedWorkshops, setCompletedWorkshops] = useState<Workshop[]>([]);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [standaloneVideos, setStandaloneVideos] = useState<StandaloneVideo[]>([]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    recorded: false,
    drops: false,
    playlists: false,
    longform: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };


  // Playlist detail modal state
  const [viewingPlaylist, setViewingPlaylist] = useState<Playlist | null>(null);
  const [playlistStreamUrl, setPlaylistStreamUrl] = useState<string | null>(null);
  const [playlistPlayingVideo, setPlaylistPlayingVideo] = useState<any | null>(null);

  // Loader flags
  const [openingVideoId, setOpeningVideoId] = useState<string | null>(null);
  const [shareStates, setShareStates] = useState<Record<string, "idle" | "loading" | "copied">>({});

  const orgId = getOrgId() || (typeof window !== "undefined" ? localStorage.getItem("garage_org_id") || "" : "");
  const meId = getUserIdFromToken() || "";

  // ── Data Fetching ───────────────────────────────────────────
  const loadAllContent = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // 1. Fetch Recorded Live Streams
      try {
        const liveRes = await getLearnInitLivestream();
        if (liveRes.success && liveRes.completedWorkshops) {
          setCompletedWorkshops(liveRes.completedWorkshops as unknown as Workshop[]);
        }
      } catch (err) {
        console.error("Error fetching live streams:", err);
      }

      // 2. Fetch Drops
      try {
        const dropsRes = await api<{ success: boolean; drops: Drop[] }>(
          `/drops?orgId=${orgId}&limit=15`,
          {},
          getToken()!
        );
        if (dropsRes.success && dropsRes.drops) {
          setDrops(dropsRes.drops);
        }
      } catch (err) {
        console.error("Error fetching drops:", err);
      }

      // 3. Fetch Playlists
      try {
        const playlistsRes = await getPlaylists();
        if (playlistsRes.success && playlistsRes.playlists) {
          setPlaylists(playlistsRes.playlists);
        }
      } catch (err) {
        console.error("Error fetching playlists:", err);
      }

      // 4. Fetch Standalone (Long Form) Videos
      try {
        const standaloneRes = await getStandaloneVideos({ limit: 15 });
        if (standaloneRes.videos) {
          setStandaloneVideos(standaloneRes.videos);
        }
      } catch (err) {
        console.error("Error fetching standalone videos:", err);
      }

    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadAllContent();
  }, [loadAllContent]);

  // ── Formatters ──────────────────────────────────────────────
  const fmtViews = (n: number) => {
    if (!n) return "0 Views";
    return n >= 1e6 ? (n / 1e6).toFixed(1) + "M Views" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K Views" : String(n) + " Views";
  };

  const timeAgo = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  };

  const fmtDur = (s: number) => {
    if (!s) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const formatVideoDate = (dateString: string) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = months[d.getMonth()];
    const day = d.getDate();
    let suffix = "th";
    if (day === 1 || day === 21 || day === 31) suffix = "st";
    else if (day === 2 || day === 22) suffix = "nd";
    else if (day === 3 || day === 23) suffix = "rd";
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${month} ${day}${suffix} ${year} at ${hours}:${minutes} ${ampm} EST`;
  };

  const formatWorkshopDuration = (duration: any) => {
    if (!duration) return "";
    const str = String(duration).trim();
    if (str.includes(":")) return str;
    const val = parseInt(str, 10);
    if (!isNaN(val)) {
      if (val < 600) {
        const h = Math.floor(val / 60);
        const m = val % 60;
        return h > 0 ? `${h}:${String(m).padStart(2, "0")}:00` : `${m}:00`;
      }
      return fmtDur(val);
    }
    return str;
  };

  // ── Handlers ────────────────────────────────────────────────

  // Open live stream recording in the right panel video player
  const playLiveStream = async (workshop: Workshop) => {
    setOpeningVideoId(workshop._id);
    try {
      const card = workshop as any;
      const realWorkshopId = card._workshopId || workshop._id;
      if (card?._recordingUrl) {
        window.dispatchEvent(new CustomEvent("right-panel:open-video-player", {
          detail: {
            url: card._recordingUrl,
            title: workshop.title || "Live Stream Recording",
            description: workshop.description || "",
            thumbnail: workshop.thumbnail || "",
            id: realWorkshopId,
            type: "workshop",
            recordingId: card._recordingFileId || "",
            date: workshop.date || "",
          }
        }));
        return;
      }
      const token = getToken() || "";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/webinar/${realWorkshopId}/recordings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        toast.error("No recordings found");
        return;
      }
      const data = await res.json();
      const rec = data.recordings?.[0];
      const openUrl = rec?.streamUrl || rec?.downloadUrl;
      if (!openUrl) {
        toast.error("No recordings available for this webinar");
        return;
      }
      window.dispatchEvent(new CustomEvent("right-panel:open-video-player", {
        detail: {
          url: openUrl,
          title: workshop.title || "Live Stream Recording",
          description: workshop.description || "",
          thumbnail: workshop.thumbnail || "",
          id: realWorkshopId,
          type: "workshop",
          recordingId: rec?._id || rec?.id || "",
          date: workshop.date || "",
        }
      }));
    } catch {
      toast.error("Failed to load recording");
    } finally {
      setOpeningVideoId(null);
    }
  };

  // Open standalone video in the right panel video player
  const playStandaloneVideo = async (video: StandaloneVideo) => {
    setOpeningVideoId(video._id);
    try {
      let streamUrl = "";
      if (video.videoS3Key) {
        const result = await getStandaloneVideoStreamUrl(video.videoS3Key);
        streamUrl = result.url;
      } else if ((video as any).videoUrl) {
        streamUrl = (video as any).videoUrl;
      }
      if (!streamUrl) {
        toast.error("Video is not available to stream");
        return;
      }
      window.dispatchEvent(new CustomEvent("right-panel:open-video-player", {
        detail: {
          url: streamUrl,
          title: video.title || "Video",
          description: video.description || "",
          thumbnail: video.thumbnail || "",
          id: video._id,
          type: "standalone",
          date: video.createdAt || "",
        }
      }));
    } catch {
      toast.error("Failed to load video");
    } finally {
      setOpeningVideoId(null);
    }
  };

  const handleShare = async (id: string, type: "workshop" | "standalone" | "playlist") => {
    if (shareStates[id] === "loading" || shareStates[id] === "copied") return;
    setShareStates((prev) => ({ ...prev, [id]: "loading" }));
    try {
      let shareLink = "";
      if (type === "playlist") {
        const playlist = playlists.find((p) => p._id === id);
        if (playlist && !playlist.isPublished) {
          toast.warning("Playlist not published yet.");
          setShareStates((prev) => ({ ...prev, [id]: "idle" }));
          return;
        }
        const res = await getPlaylistShareLink(id, orgId);
        shareLink = res.shareLink;
      } else {
        const realId = id.includes("__") ? id.split("__")[0] : id;
        const recordingId = id.includes("__") ? id.split("__")[1] : undefined;
        const res = await getVideoShareLink(realId, orgId, type, recordingId);
        shareLink = res.shareLink;
      }
      await navigator.clipboard.writeText(shareLink);
      setShareStates((prev) => ({ ...prev, [id]: "copied" }));
      toast.success("Share link copied! Anyone who joins through this link will be added to your network.");
      setTimeout(() => setShareStates((prev) => ({ ...prev, [id]: "idle" })), 2000);
    } catch {
      toast.error("Failed to copy share link");
      setShareStates((prev) => ({ ...prev, [id]: "idle" }));
    }
  };

  const openPlaylistDetails = async (playlist: Playlist) => {
    window.dispatchEvent(new CustomEvent("right-panel:open-playlist", {
      detail: {
        playlistId: playlist._id
      }
    }));
  };

  const playPlaylistVideo = async (video: any) => {
    try {
      if (video._videoSource === "workshop") {
        const token = getToken() || "";
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const res = await fetch(`${apiUrl}/webinar/${video._id}/recordings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          toast.error("No recordings found");
          return;
        }
        const data = await res.json();
        const rec = data.recordings?.[0];
        const openUrl = rec?.streamUrl || rec?.downloadUrl;
        if (!openUrl) {
          toast.error("No recordings available for this webinar");
          return;
        }
        setPlaylistStreamUrl(openUrl);
        setPlaylistPlayingVideo(video);
      } else if (video.videoS3Key) {
        const streamFn = video._videoSource === "standalone" ? getStandaloneVideoStreamUrl : getCourseVideoStreamUrl;
        const result = await streamFn(video.videoS3Key);
        setPlaylistStreamUrl(result.url);
        setPlaylistPlayingVideo(video);
      } else if (video.videoUrl) {
        setPlaylistStreamUrl(null);
        setPlaylistPlayingVideo(video);
      } else {
        toast.error("Video is not available to stream");
      }
    } catch {
      toast.error("Failed to play video");
    }
  };

  if (loading) {
    return (
      <div className="w-full flex-1 min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] text-white">
        <Loader2 className="h-8 w-8 text-brand animate-spin mb-4" />
        <p className="text-[#9fa0b8] text-sm">Loading all video contents...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 min-h-screen flex flex-col bg-[#0a0a0f] text-white overflow-y-auto pb-16">
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>
      <div className="w-full max-w-[100vw] px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 pt-6 space-y-8">

        {/* ─── SECTION 1: Recorded Live Streams ─────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              Recorded Live Streams
            </h2>
            {completedWorkshops.length > 0 && (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("layout:set-active-popover", { detail: "Live:Recording" }));
                }}
                className="border border-brand/30 text-brand hover:bg-brand/10 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              >
                See all
              </button>
            )}
          </div>
          {completedWorkshops.length === 0 ? (
            <div className="text-center py-10 bg-[#0e0e14] border border-[#1a1a24] rounded-2xl text-[#9fa0b8] text-sm">
              No live stream recordings found
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6 w-full">
              {completedWorkshops.slice(0, 4).map((workshop, index) => (
                <div
                  key={workshop._id}
                  onClick={() => playLiveStream(workshop)}
                  className={cn(
                    "w-full flex flex-col h-full group cursor-pointer",
                    index >= 3 && "hidden",
                    index === 3 && "2xl:flex"
                  )}
                >
                  <div className="aspect-video bg-[#1a1a22] relative overflow-hidden rounded-2xl">
                    {workshop.thumbnail ? (
                      <img src={workshop.thumbnail} alt={workshop.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#14141e]">
                        <Video className="h-10 w-10 text-[#5a5a6a]" />
                      </div>
                    )}
                    {/* Duration badge */}
                    {workshop.duration && (
                      <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md rounded px-1.5 py-0.5 text-[10px] text-white font-medium flex items-center gap-0.5 z-10">
                        <Clock size={9} /> {formatWorkshopDuration(workshop.duration)}
                      </div>
                    )}
                    {/* Hover Play Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center">
                      {openingVideoId === workshop._id ? (
                        <Loader2 className="w-12 h-12 text-brand animate-spin" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 shadow-[0_0_15px] shadow-brand/40">
                          <Play className="w-5 h-5 text-brand-foreground fill-current ml-0.5" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col flex-1">
                    <h3 className="text-white text-base font-semibold mt-3 mb-1 line-clamp-1 group-hover:text-brand transition-colors">{workshop.title}</h3>
                    {workshop.description && (
                      <p className="text-xs text-[#9fa0b8] line-clamp-2 mb-2 leading-relaxed [&_a]:pointer-events-none" dangerouslySetInnerHTML={{ __html: workshop.description }} />
                    )}
                    <div className="mt-auto text-[11px] text-[#5a5a6a] font-medium">
                      {formatVideoDate(workshop.date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── SECTION 2: Drops ─────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              Drops
            </h2>
            {drops.length > 0 && (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("layout:set-active-popover", { detail: "Drops:Feed" }));
                }}
                className="border border-brand/30 text-brand hover:bg-brand/10 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              >
                See all
              </button>
            )}
          </div>
          {drops.length === 0 ? (
            <div className="text-center py-10 bg-[#0e0e14] border border-[#1a1a24] rounded-2xl text-[#9fa0b8] text-sm">
              No Drops found
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-4 w-full">
              {drops.slice(0, 4).map((drop, dropIndex) => (
                <div
                  key={drop._id}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("right-panel:open-drops-feed", {
                      detail: { drops, startIndex: dropIndex }
                    }));
                  }}
                  className={cn(
                    "w-full overflow-hidden group transition-all duration-300 cursor-pointer flex flex-col h-full",
                    dropIndex >= 2 && "hidden",
                    dropIndex === 2 && "xs:flex",
                    dropIndex === 3 && "sm:flex"
                  )}
                >
                  <div className="aspect-[9/16] bg-[#1a1a22] relative overflow-hidden rounded-2xl">
                    {drop.thumbnailUrl ? (
                      <img src={drop.thumbnailUrl} alt={drop.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#14141e]">
                        <Video className="h-10 w-10 text-[#5a5a6a]" />
                      </div>
                    )}
                    {/* Duration badge */}
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md rounded px-1.5 py-0.5 text-[9px] text-white font-medium flex items-center gap-0.5 z-10">
                      <Clock size={8} /> {fmtDur(drop.duration)}
                    </div>
                    {/* Hover Play Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-all duration-300 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 shadow-lg">
                        <Play className="w-4 h-4 text-brand-foreground fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 mt-3">
                    <p className="text-white text-xs font-semibold line-clamp-2 mb-1 leading-snug group-hover:text-brand transition-colors">{drop.caption || "Untitled Drop"}</p>
                    <div className="text-[10px] text-[#5a5a6a] font-medium">
                      {fmtViews(drop.viewsCount || 0)} • {timeAgo(drop.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── SECTION 3: Playlist ──────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              Playlist
            </h2>
            {playlists.length > 0 && (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("layout:set-active-popover", { detail: "Content:Playlists" }));
                }}
                className="border border-brand/30 text-brand hover:bg-brand/10 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              >
                See all
              </button>
            )}
          </div>
          {playlists.length === 0 ? (
            <div className="text-center py-10 bg-[#0e0e14] border border-[#1a1a24] rounded-2xl text-[#9fa0b8] text-sm">
              No playlists found
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6 w-full pt-3">
              {playlists.slice(0, 4).map((playlist, index) => (
                <div
                  key={playlist._id}
                  onClick={() => openPlaylistDetails(playlist)}
                  className={cn(
                    "w-full group cursor-pointer h-full flex flex-col pt-3",
                    index >= 3 && "hidden",
                    index === 3 && "2xl:flex"
                  )}
                >
                  {/* Thumbnail and stack effect wrapper */}
                  <div className="relative aspect-video w-full">
                    {/* stacked folder visual look */}
                    <div className="absolute -top-1.5 left-2.5 right-2.5 w-[calc(100%-20px)] aspect-video bg-[#1a1a24]/60 border border-[#2a2a35]/40 rounded-2xl z-0 transform group-hover:-translate-y-1 transition-all duration-300 mx-auto" />
                    <div className="absolute -top-1 left-1.5 right-1.5 w-[calc(100%-12px)] aspect-video bg-[#12121a]/85 border border-[#2a2a35]/70 rounded-2xl z-10 transform group-hover:-translate-y-0.5 transition-all duration-300 mx-auto" />
                    
                    {/* main thumbnail */}
                    <div className="relative aspect-video bg-[#1a1a22] overflow-hidden rounded-2xl z-20">
                      {playlist.coverImage ? (
                        <img src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#14141e]">
                          <ListVideo className="w-12 h-12 text-[#5a5a6a]" />
                        </div>
                      )}
                      {/* Count Badge overlay */}
                      <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1 font-medium z-10">
                        <ListVideo className="w-3 h-3 text-brand" />
                        <span>{playlist.videoCount} Videos</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col flex-1 mt-3">
                    <h3 className="text-white text-base font-semibold line-clamp-1 group-hover:text-brand transition-colors">{playlist.title}</h3>
                    {playlist.description && (
                      <p className="text-xs text-[#9fa0b8] line-clamp-2 leading-relaxed mt-1 mb-2">{playlist.description}</p>
                    )}
                    <div className="mt-auto text-[11px] text-[#5a5a6a] font-medium">
                      By {playlist.createdBy?.name || "Unknown"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── SECTION 4: Long Form (Standalone Videos) ─────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              Long Form
            </h2>
            {standaloneVideos.length > 0 && (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("layout:set-active-popover", { detail: "Content:Videos" }));
                }}
                className="border border-brand/30 text-brand hover:bg-brand/10 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              >
                See all
              </button>
            )}
          </div>
          {standaloneVideos.length === 0 ? (
            <div className="text-center py-10 bg-[#0e0e14] border border-[#1a1a24] rounded-2xl text-[#9fa0b8] text-sm">
              No standalone videos found
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6 w-full">
              {standaloneVideos.slice(0, 4).map((video, index) => (
                <div
                  key={video._id}
                  onClick={() => playStandaloneVideo(video)}
                  className={cn(
                    "w-full flex flex-col h-full group cursor-pointer",
                    index >= 3 && "hidden",
                    index === 3 && "2xl:flex"
                  )}
                >
                  <div className="aspect-video bg-[#1a1a22] relative overflow-hidden rounded-2xl">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#14141e]">
                        <Video className="h-10 w-10 text-[#5a5a6a]" />
                      </div>
                    )}
                    {/* Duration badge */}
                    {video.duration && (
                      <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md rounded px-1.5 py-0.5 text-[10px] text-white font-medium flex items-center gap-0.5 z-10">
                        <Clock size={9} /> {fmtDur(video.duration)}
                      </div>
                    )}
                    {/* Hover Play Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center">
                      {openingVideoId === video._id ? (
                        <Loader2 className="w-12 h-12 text-brand animate-spin" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 shadow-[0_0_15px] shadow-brand/40">
                          <Play className="w-5 h-5 text-brand-foreground fill-current ml-0.5" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col flex-1">
                    <h3 className="text-white text-base font-semibold mt-3 mb-1 line-clamp-1 group-hover:text-brand transition-colors">{video.title}</h3>
                    {video.description && (
                      <p className="text-xs text-[#9fa0b8] line-clamp-2 mb-2 leading-relaxed">{video.description}</p>
                    )}
                    <div className="mt-auto text-[11px] text-[#5a5a6a] font-medium">
                      {formatVideoDate(video.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* ─── MODAL: Playlist Details & Playing ──────────────────── */}
      <Dialog open={!!viewingPlaylist} onOpenChange={(open) => { if (!open) { setViewingPlaylist(null); setPlaylistPlayingVideo(null); } }}>
        <DialogContent className="bg-[#0e0e14] border border-[#1a1a24] text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          {viewingPlaylist && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                  <ListVideo className="w-5 h-5 text-brand" />
                  {viewingPlaylist.title}
                </DialogTitle>
              </DialogHeader>

              {viewingPlaylist.description && (
                <p className="text-xs text-[#9fa0b8] leading-relaxed">{viewingPlaylist.description}</p>
              )}

              {/* Inline Playlist Video Player */}
              {playlistPlayingVideo && (
                <div className="border border-[#2a2a35] rounded-xl overflow-hidden bg-black/40">
                  <div className="aspect-video relative bg-black">
                    {playlistStreamUrl ? (
                      <video src={playlistStreamUrl} controls autoPlay className="w-full h-full" />
                    ) : playlistPlayingVideo.videoUrl ? (
                      <video src={playlistPlayingVideo.videoUrl} controls autoPlay className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#9fa0b8]">
                        <p className="text-xs">Streaming link not available</p>
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{playlistPlayingVideo.title}</h4>
                      {playlistPlayingVideo.description && (
                        <p className="text-xs text-[#9fa0b8] mt-1 line-clamp-1">{playlistPlayingVideo.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => { setPlaylistPlayingVideo(null); setPlaylistStreamUrl(null); }}
                      className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Videos list inside playlist */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[#9fa0b8] tracking-wider uppercase">Playlist Videos</h4>
                {viewingPlaylist.videos && viewingPlaylist.videos.length > 0 ? (
                  <div className="space-y-2.5 max-h-[35vh] overflow-y-auto pr-1">
                    {viewingPlaylist.videos.map((video: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-4 p-3 bg-[#15151e]/50 border border-[#232330] rounded-xl hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="text-[11px] font-mono text-[#5a5a6a] w-5 text-center">{idx + 1}</span>
                          <div className="w-16 h-10 rounded-md bg-[#232330] overflow-hidden flex-shrink-0 relative">
                            {video.thumbnail ? (
                              <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Video className="w-4 h-4 text-[#5a5a6a]" />
                              </div>
                            )}
                            {video.duration && (
                              <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.2 text-[8px] text-white font-medium z-10">
                                {fmtDur(video.duration)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-medium text-white truncate">{video.title}</h5>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#5a5a6a] mt-0.5">
                              <span className="px-1 py-0.2 bg-[#2a2a3b] text-[#9fa0b8] rounded text-[8px] uppercase font-bold">
                                {video._videoSource === "workshop" ? "Live" : video._videoSource === "standalone" ? "Video" : "Course"}
                              </span>
                              {video.duration && <span>• {fmtDur(video.duration)}</span>}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => playPlaylistVideo(video)}
                          className="px-3.5 py-1.5 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground text-xs font-semibold transition-colors flex items-center gap-1 flex-shrink-0"
                        >
                          <Play className="w-3 h-3 fill-current text-current" /> Watch
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#9fa0b8] text-center py-4 bg-[#15151e]/20 border border-dashed border-[#232330] rounded-xl">No videos in this playlist yet</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
