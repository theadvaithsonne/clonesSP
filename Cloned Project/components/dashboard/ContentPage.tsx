"use client";

import { useState, useEffect, useRef } from "react";
import {
  BookOpen, Clock, Play, Search, X, ArrowLeft,
  Link as LinkIcon, CheckCircle2, CheckCircle, Loader2, Plus, Edit, Trash2,
  Upload, Video, Save, MoreVertical, DollarSign, ListPlus, Music, ListVideo, Send, Check,
  AlertTriangle, Eye, EyeOff, FileText, ImageIcon, GripVertical,
  Settings2, List, LayoutGrid, ChevronDown,
} from "lucide-react";
import {
  getPlaylists, getPlaylist, createPlaylist,
  updatePlaylist as updatePlaylistApi, deletePlaylist as deletePlaylistApi,
  addVideosToPlaylist, removeVideoFromPlaylist, quickAddToPlaylist,
  getPlaylistAvailableVideos,
  getStandaloneVideos, createStandaloneVideo, updateStandaloneVideo,
  deleteStandaloneVideo, getStandaloneVideoUploadUrl,
  initiateStandaloneVideoMultipart, completeStandaloneVideoMultipart,
  abortStandaloneVideoMultipart, getStandaloneVideoStreamUrl,
  deleteStandaloneVideoFile, getCourseVideoStreamUrl,
  getVideoLinkPreview, getVideoShareLink, getPlaylistShareLink,
  getLearnInit, enrollInCourse, getMyEnrollments, createCourseRazorpayOrder,
  verifyCoursePayment,
  type Playlist, type PlaylistVideoEntry, type PlaylistVideo, type AvailableVideos,
  type StandaloneVideo, type VideoLinkPreview,
  type Course, type CourseEnrollment,
} from "@/lib/feed-api";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Helpers ─────────────────────────────────────────────────────────
const getYouTubeEmbedUrl = (url: string): string => {
  if (url.includes("youtu.be/")) {
    const videoId = url.split("youtu.be/")[1].split("?")[0];
    return `https://www.youtube.com/embed/${videoId}`;
  } else if (url.includes("youtube.com/watch?v=")) {
    const videoId = url.split("v=")[1].split("&")[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  return url;
};

const getVimeoEmbedUrl = (url: string): string => {
  const vimeoRegex = /vimeo\.com\/(\d+)/;
  const match = url.match(vimeoRegex);
  if (match) return `https://player.vimeo.com/video/${match[1]}`;
  return url;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatPrice(val: number | string | undefined | null): string {
  if (val === undefined || val === null) return "";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return String(val);
  return num.toFixed(2);
}


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

// ── PlaylistFormContent ─────────────────────────────────────────────
function PlaylistFormContent({
  initialData,
  isFounder,
  onSubmit,
  onCancel,
}: {
  initialData: any | null;
  isFounder: boolean;
  onSubmit: (data: {
    title: string;
    description?: string;
    isPublished?: boolean;
    videoEntries?: PlaylistVideoEntry[];
    coverImage?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  // Track selected entries with a Map: key -> PlaylistVideoEntry
  const [selectedEntries, setSelectedEntries] = useState<Map<string, PlaylistVideoEntry>>(() => {
    const map = new Map<string, PlaylistVideoEntry>();
    // Initialize from existing playlist videoEntries
    if (initialData?.videoEntries) {
      for (const entry of initialData.videoEntries) {
        const key = `${entry.videoSource}:${entry.videoId}:${entry.chapterId || ""}`;
        map.set(key, entry);
      }
    } else if (initialData?.videoIds) {
      // Legacy: treat as workshop entries
      for (const id of initialData.videoIds) {
        const key = `workshop:${id}:`;
        map.set(key, { videoSource: "workshop", videoId: id });
      }
    }
    return map;
  });
  const [isPublished, setIsPublished] = useState(initialData?.isPublished || false);
  const [coverImage, setCoverImage] = useState<string | undefined>(initialData?.coverImage || undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeVideoTab, setActiveVideoTab] = useState<"livestream" | "uploaded" | "course">("livestream");
  const [availableVideos, setAvailableVideos] = useState<AvailableVideos | null>(null);
  const [loadingVideos, setLoadingVideos] = useState(true);

  // Fetch available videos on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingVideos(true);
    getPlaylistAvailableVideos()
      .then((data) => {
        if (!cancelled) setAvailableVideos(data);
      })
      .catch((err) => console.error("Error fetching available videos:", err))
      .finally(() => { if (!cancelled) setLoadingVideos(false); });
    return () => { cancelled = true; };
  }, []);

  const makeKey = (source: string, videoId: string, chapterId?: string) =>
    `${source}:${videoId}:${chapterId || ""}`;

  const toggleEntry = (entry: PlaylistVideoEntry) => {
    const key = makeKey(entry.videoSource, entry.videoId, entry.chapterId);
    setSelectedEntries((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, entry);
      return next;
    });
  };

  const isSelected = (source: string, videoId: string, chapterId?: string) =>
    selectedEntries.has(makeKey(source, videoId, chapterId));

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        isPublished: isFounder ? isPublished : undefined,
        videoEntries: Array.from(selectedEntries.values()),
        coverImage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter videos by search query
  const filterBySearch = <T extends { title: string }>(items: T[]) =>
    searchQuery.trim()
      ? items.filter((v) => v.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : items;

  const videoTabs = [
    { key: "livestream" as const, label: "Livestream", icon: Play, count: availableVideos?.livestream.length || 0 },
    { key: "uploaded" as const, label: "Videos", icon: Upload, count: availableVideos?.uploaded.length || 0 },
    { key: "course" as const, label: "Course Videos", icon: BookOpen, count: availableVideos?.courseVideos.length || 0 },
  ];

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-[#9fa0b8] mb-1.5">Playlist Name *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Getting Started Series"
            className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/50 focus:outline-none focus:border-brand/50 transition-colors text-sm"
            maxLength={200}
          />
        </div>
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[#9fa0b8] mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description for your playlist..."
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/50 focus:outline-none focus:border-brand/50 transition-colors text-sm resize-none"
            maxLength={2000}
          />
        </div>
        {/* Publish toggle (founder only) */}
        {isFounder && (
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35]">
            <div>
              <p className="text-sm text-white font-medium">Publish for learners</p>
              <p className="text-xs text-[#9fa0b8]">Make this playlist visible to all community members</p>
            </div>
            <button
              onClick={() => setIsPublished(!isPublished)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isPublished ? "bg-brand" : "bg-[#2a2a35]"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${isPublished ? "translate-x-5" : ""}`} />
            </button>
          </div>
        )}
        {/* Playlist Thumbnail Selection */}
        {isFounder && (
          <div>
            <label className="block text-sm font-medium text-[#9fa0b8] mb-1.5">Playlist Thumbnail</label>
            {coverImage ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35]">
                <div className="w-20 h-14 rounded-md overflow-hidden flex-shrink-0 bg-black">
                  <img src={coverImage} alt="Playlist thumbnail" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white">Thumbnail selected</p>
                  <p className="text-[10px] text-[#9fa0b8] mt-0.5">This image will be used as the playlist cover</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCoverImage(undefined)}
                  className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Remove thumbnail"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[#1a1a22] border border-dashed border-[#2a2a35]">
                {(() => {
                  // Gather thumbnails from selected videos
                  const thumbVideos: { id: string; title: string; thumbnail: string }[] = [];
                  if (availableVideos) {
                    for (const [, entry] of selectedEntries) {
                      if (entry.videoSource === "workshop") {
                        const v = availableVideos.livestream.find(lv => lv._id === entry.videoId);
                        if (v?.thumbnail) thumbVideos.push({ id: v._id, title: v.title, thumbnail: v.thumbnail });
                      } else if (entry.videoSource === "standalone") {
                        const v = availableVideos.uploaded.find(uv => uv._id === entry.videoId);
                        if (v?.thumbnail) thumbVideos.push({ id: v._id, title: v.title, thumbnail: v.thumbnail });
                      } else if (entry.videoSource === "courseVideo") {
                        const v = availableVideos.courseVideos.find(cv => cv._id === entry.videoId);
                        if (v?.thumbnail) thumbVideos.push({ id: v._id, title: v.title, thumbnail: v.thumbnail });
                      }
                    }
                  }
                  return thumbVideos.length > 0 ? (
                    <div>
                      <p className="text-xs text-[#9fa0b8] mb-2">Select a video thumbnail as the playlist cover:</p>
                      <div className="flex flex-wrap gap-2">
                        {thumbVideos.map((tv) => (
                          <button
                            key={tv.id}
                            type="button"
                            onClick={() => setCoverImage(tv.thumbnail)}
                            className="w-20 h-14 rounded-md overflow-hidden border-2 border-transparent hover:border-brand/60 transition-colors flex-shrink-0 relative group"
                            title={tv.title}
                          >
                            <img src={tv.thumbnail} alt={tv.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#9fa0b8] text-center py-2">
                      {selectedEntries.size > 0
                        ? "Selected videos have no thumbnails available"
                        : "Select videos below to choose a thumbnail"}
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
        )}
        {/* Categorized Video Selection */}
        <div>
          <label className="block text-sm font-medium text-[#9fa0b8] mb-1.5">
            Select Videos ({selectedEntries.size} selected)
          </label>
          {/* Category tabs */}
          <div className="flex gap-1 mb-3 bg-[#0a0a10] rounded-lg p-1 border border-[#2a2a35]">
            {videoTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveVideoTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    activeVideoTab === tab.key
                      ? "bg-brand text-brand-foreground"
                      : "text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeVideoTab === tab.key
                        ? "bg-black/20 text-current"
                        : "bg-[#2a2a35] text-[#9fa0b8]"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9fa0b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search videos..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/50 focus:outline-none focus:border-brand/50 transition-colors text-sm"
            />
          </div>
          {/* Video list */}
          <div className="max-h-60 overflow-y-auto space-y-1 border border-[#2a2a35] rounded-lg p-2 bg-[#0a0a10]">
            {loadingVideos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-brand animate-spin" />
              </div>
            ) : activeVideoTab === "livestream" ? (
              // Livestream (Workshop) videos
              (() => {
                const items = filterBySearch(availableVideos?.livestream || []);
                return items.length > 0 ? items.map((video) => {
                  const selected = isSelected("workshop", video._id);
                  return (
                    <button
                      key={video._id}
                      onClick={() => toggleEntry({ videoSource: "workshop", videoId: video._id })}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                        selected ? "bg-brand/10 border border-brand/30" : "hover:bg-[#1a1a22] border border-transparent"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                        selected ? "bg-brand border-brand" : "border-[#3a3a45]"
                      }`}>
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-brand-foreground" />}
                      </div>
                      <div className="w-16 h-10 bg-[#1a1a22] rounded overflow-hidden flex-shrink-0">
                        {video.thumbnail ? (
                          <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-4 h-4 text-[#9fa0b8]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{video.title}</p>
                        <p className="text-xs text-[#9fa0b8]">{new Date(video.date).toLocaleDateString()}</p>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 flex-shrink-0">Livestream</span>
                    </button>
                  );
                }) : (
                  <p className="text-sm text-[#9fa0b8] text-center py-4">
                    {searchQuery ? "No livestream videos match your search." : "No completed livestreams available."}
                  </p>
                );
              })()
            ) : activeVideoTab === "uploaded" ? (
              // Uploaded (Standalone) videos
              (() => {
                const items = filterBySearch(availableVideos?.uploaded || []);
                return items.length > 0 ? items.map((video) => {
                  const selected = isSelected("standalone", video._id);
                  return (
                    <button
                      key={video._id}
                      onClick={() => toggleEntry({ videoSource: "standalone", videoId: video._id })}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                        selected ? "bg-brand/10 border border-brand/30" : "hover:bg-[#1a1a22] border border-transparent"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                        selected ? "bg-brand border-brand" : "border-[#3a3a45]"
                      }`}>
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-brand-foreground" />}
                      </div>
                      <div className="w-16 h-10 bg-[#1a1a22] rounded overflow-hidden flex-shrink-0">
                        {video.thumbnail ? (
                          <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-4 h-4 text-[#9fa0b8]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{video.title}</p>
                        <p className="text-xs text-[#9fa0b8]">
                          {video.duration ? formatDuration(video.duration) : ""}
                          {video.duration ? " • " : ""}
                          {new Date(video.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 flex-shrink-0">Uploaded</span>
                    </button>
                  );
                }) : (
                  <p className="text-sm text-[#9fa0b8] text-center py-4">
                    {searchQuery ? "No uploaded videos match your search." : "No uploaded videos available."}
                  </p>
                );
              })()
            ) : (
              // Course Videos (chapters)
              (() => {
                const items = filterBySearch(availableVideos?.courseVideos || []);
                return items.length > 0 ? items.map((video) => {
                  const selected = isSelected("courseVideo", video._id, video._id);
                  return (
                    <button
                      key={`${video.courseId}-${video._id}`}
                      onClick={() => toggleEntry({
                        videoSource: "courseVideo",
                        videoId: video._id,
                        courseId: video.courseId,
                        sectionId: video.sectionId,
                        chapterId: video._id,
                      })}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                        selected ? "bg-brand/10 border border-brand/30" : "hover:bg-[#1a1a22] border border-transparent"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                        selected ? "bg-brand border-brand" : "border-[#3a3a45]"
                      }`}>
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-brand-foreground" />}
                      </div>
                      <div className="w-16 h-10 bg-[#1a1a22] rounded overflow-hidden flex-shrink-0">
                        {video.thumbnail ? (
                          <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-[#9fa0b8]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{video.title}</p>
                        <p className="text-xs text-[#9fa0b8] truncate">
                          {video.courseTitle} • {video.sectionTitle}
                          {video.duration ? ` • ${formatDuration(video.duration)}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400">Course</span>
                        {video.isPaid && (
                          <span className="text-[10px] text-[#9fa0b8]">
                            {video.currency === "INR" ? "₹" : "$"}{formatPrice(video.price)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                }) : (
                  <p className="text-sm text-[#9fa0b8] text-center py-4">
                    {searchQuery ? "No course videos match your search." : "No course videos available."}
                  </p>
                );
              })()
            )}
          </div>
        </div>
      </div>
      {/* Footer actions */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2a2a35]">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-[#9fa0b8] hover:text-white border border-[#2a2a35] hover:border-[#3a3a45] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || submitting}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm bg-brand text-brand-foreground font-medium hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {initialData ? "Update Playlist" : "Create Playlist"}
        </button>
      </div>
    </>
  );
}

// ── StandaloneVideoModal ────────────────────────────────────────────
// Standalone Video Upload/Edit Modal
function StandaloneVideoModal({
  isOpen,
  onClose,
  onSave,
  existingVideo,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description?: string;
    thumbnail?: string;
    videoUrl?: string;
    videoS3Key?: string;
    sourceType: "upload" | "link";
    duration?: number;
  }) => Promise<void>;
  existingVideo: StandaloneVideo | null;
}) {
  const [title, setTitle] = useState(existingVideo?.title || "");
  const [description, setDescription] = useState(existingVideo?.description || "");
  const [sourceType, setSourceType] = useState<"upload" | "link">(existingVideo?.sourceType || "upload");
  const [videoUrl, setVideoUrl] = useState(existingVideo?.videoUrl || "");
  const [videoS3Key, setVideoS3Key] = useState(existingVideo?.videoS3Key || "");
  const [duration, setDuration] = useState(existingVideo?.duration || 0);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string>(existingVideo?.thumbnail || "");
  const [saving, setSaving] = useState(false);

  // Upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);
  const [multipartState, setMultipartState] = useState<{ s3Key: string; uploadId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link preview state — single debounced API call
  const [linkPreview, setLinkPreview] = useState<VideoLinkPreview | null>(null);
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const [linkPreviewError, setLinkPreviewError] = useState<string | null>(null);
  const linkPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced link preview — fires ONE call 400ms after user stops typing
  useEffect(() => {
    // Clear previous timer
    if (linkPreviewTimerRef.current) {
      clearTimeout(linkPreviewTimerRef.current);
      linkPreviewTimerRef.current = null;
    }

    // Reset if not in link mode or URL is too short
    if (sourceType !== "link" || !videoUrl.trim() || videoUrl.trim().length < 10) {
      setLinkPreview(null);
      setLinkPreviewLoading(false);
      setLinkPreviewError(null);
      return;
    }

    // Basic URL validation before firing request
    try {
      new URL(videoUrl.trim());
    } catch {
      setLinkPreview(null);
      setLinkPreviewLoading(false);
      setLinkPreviewError(null);
      return;
    }

    setLinkPreviewLoading(true);
    setLinkPreviewError(null);

    linkPreviewTimerRef.current = setTimeout(async () => {
      try {
        const data = await getVideoLinkPreview(videoUrl.trim());
        if (!data.success) {
          setLinkPreviewError(data.error || "Could not verify this link");
          setLinkPreview(null);
        } else {
          setLinkPreview(data);
          setLinkPreviewError(null);
          // Auto-fill thumbnail
          if (data.thumbnail) {
            setThumbnailDataUrl(data.thumbnail);
          }
          // Auto-fill duration (if available and not already set)
          if (data.duration && data.duration > 0 && !duration) {
            setDuration(data.duration);
          }
        }
      } catch {
        setLinkPreviewError("Could not verify this link");
        setLinkPreview(null);
      } finally {
        setLinkPreviewLoading(false);
      }
    }, 400);

    return () => {
      if (linkPreviewTimerRef.current) {
        clearTimeout(linkPreviewTimerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, sourceType]);

  const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
  const MAX_VIDEO_SIZE = 5 * 1024 * 1024 * 1024;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Auto-detect duration AND generate thumbnail from video file
  const processVideoFile = (file: File): Promise<{ duration: number; thumbnail: string }> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      const objectUrl = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        const dur = Math.round(video.duration);
        // Seek to 2 seconds (or 25% if shorter) to get a good thumbnail frame
        const seekTime = Math.min(2, video.duration * 0.25);
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          // Use a reasonable thumbnail size
          const maxWidth = 640;
          const scale = Math.min(1, maxWidth / video.videoWidth);
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            URL.revokeObjectURL(objectUrl);
            resolve({ duration: Math.round(video.duration), thumbnail: dataUrl });
          } else {
            URL.revokeObjectURL(objectUrl);
            resolve({ duration: Math.round(video.duration), thumbnail: "" });
          }
        } catch {
          URL.revokeObjectURL(objectUrl);
          resolve({ duration: Math.round(video.duration), thumbnail: "" });
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ duration: 0, thumbnail: "" });
      };

      video.src = objectUrl;
    });
  };

  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setUploadError("Unsupported format. Use MP4, WebM, MOV, or MKV.");
      return;
    }
    if (file.size > MAX_VIDEO_SIZE) {
      setUploadError("File too large. Maximum size is 5GB.");
      return;
    }
    setVideoFile(file);
    const { duration: dur, thumbnail } = await processVideoFile(file);
    if (dur > 0) setDuration(dur);
    if (thumbnail) setThumbnailDataUrl(thumbnail);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const uploadVideo = async () => {
    if (!videoFile) return;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      if (videoFile.size < MULTIPART_THRESHOLD) {
        const { uploadUrl, s3Key } = await getStandaloneVideoUploadUrl({
          fileName: videoFile.name,
          fileSize: videoFile.size,
          contentType: videoFile.type,
        });

        const controller = new AbortController();
        setUploadAbortController(controller);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed with status ${xhr.status}`));
          });
          xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
          xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
          controller.signal.addEventListener("abort", () => xhr.abort());
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", videoFile.type);
          xhr.send(videoFile);
        });

        setVideoS3Key(s3Key);
        setVideoUrl("");
      } else {
        const { uploadId, s3Key, partSize, totalParts, partUrls } =
          await initiateStandaloneVideoMultipart({
            fileName: videoFile.name,
            fileSize: videoFile.size,
            contentType: videoFile.type,
          });

        setMultipartState({ s3Key, uploadId });
        const controller = new AbortController();
        setUploadAbortController(controller);

        const completedParts: { partNumber: number; etag: string }[] = [];
        let uploadedBytes = 0;
        const concurrency = 3;
        const queue = [...partUrls];
        const workers: Promise<void>[] = [];

        for (let w = 0; w < Math.min(concurrency, queue.length); w++) {
          workers.push(
            (async () => {
              while (queue.length > 0) {
                if (controller.signal.aborted) return;
                const part = queue.shift()!;
                const start = (part.partNumber - 1) * partSize;
                const end = Math.min(start + partSize, videoFile.size);
                const blob = videoFile.slice(start, end);
                const response = await fetch(part.url, { method: "PUT", body: blob, signal: controller.signal });
                if (!response.ok) throw new Error(`Part ${part.partNumber} upload failed`);
                const etag = response.headers.get("ETag") || "";
                completedParts.push({ partNumber: part.partNumber, etag });
                uploadedBytes += end - start;
                setUploadProgress(Math.round((uploadedBytes / videoFile.size) * 100));
              }
            })()
          );
        }

        await Promise.all(workers);
        if (controller.signal.aborted) return;

        await completeStandaloneVideoMultipart({ s3Key, uploadId, parts: completedParts });
        setVideoS3Key(s3Key);
        setVideoUrl("");
        setMultipartState(null);
      }

      setUploadProgress(100);
      toast.success("Video uploaded successfully");
    } catch (error: any) {
      if (error.message === "Upload cancelled") {
        toast.info("Upload cancelled");
      } else {
        console.error("Video upload error:", error);
        setUploadError(error.message || "Upload failed");
        toast.error("Video upload failed");
      }
      if (multipartState) {
        await abortStandaloneVideoMultipart(multipartState).catch(() => {});
        setMultipartState(null);
      }
    } finally {
      setIsUploading(false);
      setUploadAbortController(null);
    }
  };

  const cancelUpload = async () => {
    uploadAbortController?.abort();
    if (multipartState) {
      await abortStandaloneVideoMultipart(multipartState).catch(() => {});
      setMultipartState(null);
    }
    setIsUploading(false);
    setUploadProgress(0);
  };

  const removeUploadedVideo = () => {
    setVideoFile(null);
    setVideoS3Key("");
    setUploadProgress(0);
    setUploadError(null);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (sourceType === "upload" && videoFile && !videoS3Key) {
      toast.error("Please upload the video first");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        thumbnail: thumbnailDataUrl || undefined,
        videoUrl: sourceType === "link" ? videoUrl : undefined,
        videoS3Key: sourceType === "upload" ? videoS3Key : undefined,
        sourceType,
        duration,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[500]">
      <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a35]">
          <h2 className="text-lg font-semibold text-white">
            {existingVideo ? "Edit Video" : "Upload Video"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[#1a1a22] rounded-full transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#9fa0b8] mb-1.5">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Introduction to Marketing"
              className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/50 focus:outline-none focus:border-brand/50 transition-colors text-sm"
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#9fa0b8] mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your video..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/50 focus:outline-none focus:border-brand/50 transition-colors text-sm resize-none"
              maxLength={5000}
            />
          </div>

          {/* Source type toggle */}
          <div>
            <label className="block text-sm font-medium text-[#9fa0b8] mb-1.5">Video Source</label>
            <div className="flex rounded-lg border border-[#2a2a35] overflow-hidden">
              <button
                onClick={() => setSourceType("upload")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  sourceType === "upload"
                    ? "bg-brand text-brand-foreground"
                    : "bg-[#1a1a22] text-[#9fa0b8] hover:text-white"
                }`}
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
              <button
                onClick={() => setSourceType("link")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  sourceType === "link"
                    ? "bg-brand text-brand-foreground"
                    : "bg-[#1a1a22] text-[#9fa0b8] hover:text-white"
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                Paste Link
              </button>
            </div>
          </div>

          {/* Upload file section */}
          {sourceType === "upload" && (
            <div>
              {videoS3Key && !isUploading ? (
                /* Uploaded successfully */
                <div className="border border-green-500/30 bg-green-500/5 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{videoFile?.name || "Video uploaded"}</p>
                      <p className="text-xs text-green-400">Upload complete</p>
                    </div>
                    <button onClick={removeUploadedVideo} className="p-1.5 text-[#9fa0b8] hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : isUploading ? (
                /* Uploading */
                <div className="border border-[#2a2a35] rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="w-5 h-5 text-brand animate-spin" />
                    <div className="flex-1">
                      <p className="text-sm text-white">{videoFile?.name}</p>
                      <p className="text-xs text-[#9fa0b8]">{uploadProgress}% uploaded</p>
                    </div>
                    <button onClick={cancelUpload} className="p-1.5 text-[#9fa0b8] hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="w-full h-2 bg-[#1a1a22] rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : videoFile && !videoS3Key ? (
                /* File selected, not yet uploaded */
                <div className="border border-[#2a2a35] rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Video className="w-5 h-5 text-[#9fa0b8]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{videoFile.name}</p>
                      <p className="text-xs text-[#9fa0b8]">{formatFileSize(videoFile.size)}</p>
                    </div>
                    <button onClick={() => setVideoFile(null)} className="p-1.5 text-[#9fa0b8] hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={uploadVideo}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-brand-foreground text-sm font-medium hover:bg-brand/90 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload to Cloud
                  </button>
                </div>
              ) : (
                /* Drop zone */
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#2a2a35] hover:border-brand/40 rounded-lg p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors"
                >
                  <Upload className="w-8 h-8 text-[#9fa0b8]" />
                  <div className="text-center">
                    <p className="text-sm text-white font-medium">Drag & drop a video file</p>
                    <p className="text-xs text-[#9fa0b8] mt-1">or click to browse • MP4, WebM, MOV, MKV • Max 5GB</p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }}
                className="hidden"
              />
              {uploadError && (
                <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {uploadError}
                </p>
              )}
            </div>
          )}

          {/* Link section */}
          {sourceType === "link" && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#9fa0b8] mb-1.5">Video URL</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                  className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/50 focus:outline-none focus:border-brand/50 transition-colors text-sm"
                />
                <p className="text-xs text-[#9fa0b8] mt-1">YouTube, Vimeo, or any direct video URL</p>
              </div>

              {/* Link preview — loading state */}
              {linkPreviewLoading && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35]">
                  <Loader2 className="w-4 h-4 text-brand animate-spin flex-shrink-0" />
                  <span className="text-sm text-[#9fa0b8]">Checking link…</span>
                </div>
              )}

              {/* Link preview — error state */}
              {linkPreviewError && !linkPreviewLoading && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-sm text-red-400">{linkPreviewError}</span>
                </div>
              )}

              {/* Link preview — success state */}
              {linkPreview && !linkPreviewLoading && !linkPreviewError && (
                <div className="rounded-lg bg-[#1a1a22] border border-[#2a2a35] overflow-hidden">
                  <div className="flex gap-3 p-3">
                    {/* Thumbnail */}
                    {linkPreview.thumbnail ? (
                      <div className="w-28 h-20 rounded-md overflow-hidden flex-shrink-0 bg-black">
                        <img
                          src={linkPreview.thumbnail}
                          alt="Video thumbnail"
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    ) : (
                      <div className="w-28 h-20 rounded-md bg-[#0a0a10] flex items-center justify-center flex-shrink-0">
                        <Video className="w-6 h-6 text-[#9fa0b8]" />
                      </div>
                    )}
                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {linkPreview.title ? (
                            <p className="text-sm text-white font-medium line-clamp-2">{linkPreview.title}</p>
                          ) : (
                            <p className="text-sm text-[#9fa0b8] italic">No title available</p>
                          )}
                          {linkPreview.author && (
                            <p className="text-xs text-[#9fa0b8] mt-0.5">by {linkPreview.author}</p>
                          )}
                        </div>
                        {linkPreview.title && linkPreview.title !== title && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setTitle(linkPreview.title!);
                            }}
                            className="flex-shrink-0 text-xs font-medium bg-brand hover:bg-brand/90 text-brand-foreground px-2.5 py-1 rounded transition-colors"
                          >
                            Use Title
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          linkPreview.provider === "YouTube"
                            ? "bg-red-500/20 text-red-400"
                            : linkPreview.provider === "Vimeo"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-[#2a2a35] text-[#9fa0b8]"
                        }`}>
                          {linkPreview.provider}
                        </span>
                        {linkPreview.duration != null && linkPreview.duration > 0 && (
                          <span className="text-[10px] text-[#9fa0b8]">{formatDuration(linkPreview.duration)}</span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          Video found
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-[#9fa0b8] mb-1.5">Duration (seconds)</label>
            <input
              type="number"
              value={duration || ""}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              placeholder="Auto-detected for uploads"
              className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/50 focus:outline-none focus:border-brand/50 transition-colors text-sm"
              min={0}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2a2a35]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[#9fa0b8] hover:text-white border border-[#2a2a35] hover:border-[#3a3a45] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving || isUploading || (sourceType === "upload" && videoFile && !videoS3Key)}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm bg-brand text-brand-foreground font-medium hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {existingVideo ? "Update Video" : "Save Video"}
          </button>
        </div>
      </div>
    </div>
  );
}



// ── ContentPage ────────────────────────────────────────────────────
interface ContentPageProps {
  initialSection?: "videos" | "playlists";
  viewRole?: "founder" | "customer";
}

export function ContentPage({ initialSection = "videos", viewRole = "customer" }: ContentPageProps) {
  const [isFounder, setIsFounder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"videos" | "playlists">(initialSection);

  const hasEditPermissions = isFounder && viewRole === "founder";

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  // Video state
  const [standaloneVideos, setStandaloneVideos] = useState<StandaloneVideo[]>([]);
  const [standaloneVideosLoading, setStandaloneVideosLoading] = useState(false);
  const [showUploadVideoModal, setShowUploadVideoModal] = useState(false);
  const [editingStandaloneVideo, setEditingStandaloneVideo] = useState<StandaloneVideo | null>(null);
  const [showDeleteVideoConfirm, setShowDeleteVideoConfirm] = useState<string | null>(null);
  const [playingStandaloneVideo, setPlayingStandaloneVideo] = useState<StandaloneVideo | null>(null);
  const [standaloneStreamUrl, setStandaloneStreamUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lfv_viewMode") as "grid" | "list") || "grid";
    }
    return "grid";
  });
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "az" | "za" | "custom">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lfv_sortOrder") as any) || "newest";
    }
    return "newest";
  });
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("lfv_customOrder") || "[]"); } catch { return []; }
    }
    return [];
  });
  const [hiddenVideoIds, setHiddenVideoIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try { return new Set(JSON.parse(localStorage.getItem("lfv_hiddenIds") || "[]")); } catch { return new Set(); }
    }
    return new Set();
  });
  const [showManagePanel, setShowManagePanel] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);

  // Persist preferences
  useEffect(() => { localStorage.setItem("lfv_viewMode", viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem("lfv_sortOrder", sortOrder); }, [sortOrder]);
  useEffect(() => { localStorage.setItem("lfv_customOrder", JSON.stringify(customOrder)); }, [customOrder]);
  useEffect(() => { localStorage.setItem("lfv_hiddenIds", JSON.stringify([...hiddenVideoIds])); }, [hiddenVideoIds]);

  const toggleVideoVisibility = (id: string) => {
    setHiddenVideoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const moveVideo = (id: string, direction: "up" | "down") => {
    setSortOrder("custom");
    setCustomOrder(prev => {
      const order = prev.length > 0 ? [...prev] : standaloneVideos.map(v => v._id);
      const idx = order.indexOf(id);
      if (idx < 0) return order;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= order.length) return order;
      [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
      return order;
    });
  };

  // Sync custom order when videos load/change
  useEffect(() => {
    if (standaloneVideos.length > 0 && customOrder.length === 0) {
      setCustomOrder(standaloneVideos.map(v => v._id));
    } else if (standaloneVideos.length > 0) {
      const ids = new Set(standaloneVideos.map(v => v._id));
      const newIds = standaloneVideos.filter(v => !customOrder.includes(v._id)).map(v => v._id);
      const cleaned = customOrder.filter(id => ids.has(id));
      if (newIds.length > 0 || cleaned.length !== customOrder.length) {
        setCustomOrder([...cleaned, ...newIds]);
      }
    }
  }, [standaloneVideos]);

  // Sort + filter videos
  const sortedStandaloneVideos = (() => {
    let vids = standaloneVideos.filter(v => !hiddenVideoIds.has(v._id));
    if (sortOrder === "custom") {
      const orderMap = new Map(customOrder.map((id, i) => [id, i]));
      vids.sort((a, b) => (orderMap.get(a._id) ?? 999) - (orderMap.get(b._id) ?? 999));
    } else {
      vids.sort((a, b) => {
        switch (sortOrder) {
          case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "az": return a.title.localeCompare(b.title);
          case "za": return b.title.localeCompare(a.title);
          default: return 0;
        }
      });
    }
    return vids;
  })();

  // Playlist state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [viewingPlaylist, setViewingPlaylist] = useState<Playlist | null>(null);
  const [showDeletePlaylistConfirm, setShowDeletePlaylistConfirm] = useState<string | null>(null);
  const [addToPlaylistWorkshopId, setAddToPlaylistWorkshopId] = useState<string | null>(null);
  const [playlistPlayingVideo, setPlaylistPlayingVideo] = useState<PlaylistVideo | null>(null);
  const [playlistStreamUrl, setPlaylistStreamUrl] = useState<string | null>(null);
  const [showThumbnailPicker, setShowThumbnailPicker] = useState(false);

  // Share + enrollment state
  const [shareStates, setShareStates] = useState<Record<string, "idle" | "loading" | "copied">>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Map<string, CourseEnrollment>>(new Map());
  const [openingRecording, setOpeningRecording] = useState<string | null>(null);

  useEffect(() => {
    if (showUploadVideoModal || showCreatePlaylistModal || showManagePanel) {
      window.dispatchEvent(new CustomEvent("bottom-tab:hide"));
    } else {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    };
  }, [showUploadVideoModal, showCreatePlaylistModal, showManagePanel]);

  // Synchronize path changes with global dashboard breadcrumbs
  useEffect(() => {
    const items: { label: string; key: string }[] = [];

    if (playingStandaloneVideo) {
      items.push({
        label: playingStandaloneVideo.title,
        key: "standalone-video",
      });
    } else if (playlistPlayingVideo && viewingPlaylist) {
      items.push({
        label: viewingPlaylist.title,
        key: "playlist-detail",
      });
      items.push({
        label: playlistPlayingVideo.title,
        key: "playlist-video",
      });
    } else if (viewingPlaylist) {
      items.push({
        label: viewingPlaylist.title,
        key: "playlist-detail",
      });
    }

    window.dispatchEvent(
      new CustomEvent("workspace:set-breadcrumbs", {
        detail: { items },
      })
    );
  }, [playingStandaloneVideo, viewingPlaylist, playlistPlayingVideo]);

  // Handle breadcrumb clicks from the dashboard layout header
  useEffect(() => {
    const handleBreadcrumbClick = (event: Event) => {
      const customEvent = event as CustomEvent<{ label: string; key: string; index: number }>;
      const { key } = customEvent.detail;

      if (key === "root") {
        setPlayingStandaloneVideo(null);
        setStandaloneStreamUrl(null);
        setPlaylistPlayingVideo(null);
        setPlaylistStreamUrl(null);
        setViewingPlaylist(null);
      } else if (key === "playlist-detail") {
        setPlaylistPlayingVideo(null);
        setPlaylistStreamUrl(null);
      }
    };

    window.addEventListener("workspace:breadcrumb-click", handleBreadcrumbClick as EventListener);
    return () => {
      window.removeEventListener("workspace:breadcrumb-click", handleBreadcrumbClick as EventListener);
    };
  }, []);

  const playWorkshopRecording = async (id: string) => {
    setOpeningRecording(id);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") || "" : "";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/webinar/${id}/recordings`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast.error("No recordings found"); return; }
      const data = await res.json();
      const rec = data.recordings?.[0];
      const openUrl = rec?.streamUrl || rec?.downloadUrl;
      if (!openUrl) { toast.error("No recordings available"); return; }
      window.open(openUrl, "_blank");
    } catch { toast.error("Failed to load recording"); }
    finally { setOpeningRecording(null); }
  };

  const handleShare = async (id: string, type: "video" | "playlist", videoType?: "standalone" | "workshop") => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId || shareStates[id] === "loading" || shareStates[id] === "copied") return;
    if (type === "playlist") {
      const playlist = playlists.find((p) => p._id === id);
      if (playlist && !playlist.isPublished) { toast.warning("Playlist not published yet."); return; }
    }
    setShareStates(prev => ({ ...prev, [id]: "loading" }));
    try {
      const { shareLink } = type === "playlist" ? await getPlaylistShareLink(id, orgId) : await getVideoShareLink(id, orgId, videoType!);
      await navigator.clipboard.writeText(shareLink);
      setShareStates(prev => ({ ...prev, [id]: "copied" }));
      toast.success("Share link copied!");
      setTimeout(() => setShareStates(prev => ({ ...prev, [id]: "idle" })), 2000);
    } catch { toast.error("Failed to copy share link"); setShareStates(prev => ({ ...prev, [id]: "idle" })); }
  };

  // ── Data fetching ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const initData = await getLearnInit();
        if (cancelled) return;
        setIsFounder(initData.isFounder);
        setCourses(initData.courses || []);
        if (!initData.isFounder && initData.enrollments) {
          const map = new Map<string, CourseEnrollment>();
          initData.enrollments.forEach((e: any) => {
            const courseId = typeof e.courseId === "string" ? e.courseId : e.courseId._id;
            map.set(courseId, e);
          });
          setEnrollments(map);
        }
      } catch (error) { console.error("Error fetching init:", error); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch standalone videos eagerly on mount (don't wait for getLearnInit)
  const videosLoadedRef = useRef(false);
  useEffect(() => {
    if (!videosLoadedRef.current) {
      videosLoadedRef.current = true;
      setStandaloneVideosLoading(true);
      getStandaloneVideos()
        .then((data) => setStandaloneVideos(data.videos || []))
        .catch((err) => console.error("Error fetching videos:", err))
        .finally(() => setStandaloneVideosLoading(false));
    }
  }, []);

  const playlistsLoadedRef = useRef(false);
  useEffect(() => {
    if (activeSection === "playlists" && !loading && !playlistsLoadedRef.current) {
      playlistsLoadedRef.current = true;
      fetchPlaylists();
    }
  }, [activeSection, loading]);

  // Handle redirect to specific playlist
  useEffect(() => {
    const playlistId = localStorage.getItem("open_playlist_id");
    if (playlistId) {
      localStorage.removeItem("open_playlist_id");
      getPlaylist(playlistId)
        .then((res) => {
          if (res?.playlist) {
            setViewingPlaylist(res.playlist);
          }
        })
        .catch((err) => console.error("Failed to load redirected playlist details:", err));
    }
  }, [activeSection, loading]);

  // Handle redirect to specific standalone video
  useEffect(() => {
    const videoId = localStorage.getItem("target_video_id");
    if (videoId && standaloneVideos.length > 0) {
      localStorage.removeItem("target_video_id");
      const video = standaloneVideos.find((v) => v._id === videoId);
      if (video) {
        playVideoInRightPanel(video);
      }
    }
  }, [standaloneVideos]);



  const fetchPlaylists = async () => {
    setPlaylistsLoading(true);
    try { const data = await getPlaylists(); setPlaylists(data.playlists || []); }
    catch (error) { console.error("Error fetching playlists:", error); }
    finally { setPlaylistsLoading(false); }
  };

  const handleCreatePlaylist = async (data: { title: string; description?: string; isPublished?: boolean; videoEntries?: PlaylistVideoEntry[]; coverImage?: string }) => {
    try { const result = await createPlaylist(data); setPlaylists(prev => [result.playlist, ...prev]); setShowCreatePlaylistModal(false); setEditingPlaylist(null); toast.success("Playlist created!"); }
    catch (error: any) { toast.error(error.message || "Failed to create playlist"); }
  };

  const handleUpdatePlaylist = async (playlistId: string, data: Partial<{ title: string; description: string; isPublished: boolean; videoEntries: PlaylistVideoEntry[]; coverImage: string }>) => {
    try { const result = await updatePlaylistApi(playlistId, data); setPlaylists(prev => prev.map(p => p._id === playlistId ? result.playlist : p)); if (viewingPlaylist?._id === playlistId) setViewingPlaylist(result.playlist); setEditingPlaylist(null); toast.success("Playlist updated!"); }
    catch (error: any) { toast.error(error.message || "Failed to update playlist"); }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    try { await deletePlaylistApi(playlistId); setPlaylists(prev => prev.filter(p => p._id !== playlistId)); if (viewingPlaylist?._id === playlistId) setViewingPlaylist(null); setShowDeletePlaylistConfirm(null); toast.success("Playlist deleted!"); }
    catch (error: any) { toast.error(error.message || "Failed to delete playlist"); }
  };

  const handleAddVideoToPlaylist = async (playlistId: string, videoEntry: PlaylistVideoEntry) => {
    try { const result = await addVideosToPlaylist(playlistId, [videoEntry]); setPlaylists(prev => prev.map(p => p._id === playlistId ? result.playlist : p)); setAddToPlaylistWorkshopId(null); toast.success("Video added!"); }
    catch (error: any) { toast.error(error.message || "Failed to add video"); }
  };

  const handleLearnerQuickAdd = async (videoEntry: PlaylistVideoEntry) => {
    try { const result = await quickAddToPlaylist(videoEntry); if (result.playlist) { setPlaylists(prev => { const idx = prev.findIndex(p => p._id === result.playlist._id); if (idx >= 0) return prev.map(p => p._id === result.playlist._id ? result.playlist : p); return [result.playlist, ...prev]; }); } toast.success("Added to My Playlist!"); }
    catch (error: any) { toast.error(error.message || "Failed to add"); }
  };

  const handleRemoveVideoFromPlaylist = async (playlistId: string, videoId: string, videoSource?: string) => {
    try { const result = await removeVideoFromPlaylist(playlistId, videoId, videoSource); setPlaylists(prev => prev.map(p => p._id === playlistId ? result.playlist : p)); if (viewingPlaylist?._id === playlistId) setViewingPlaylist(result.playlist); toast.success("Video removed!"); }
    catch (error: any) { toast.error(error.message || "Failed to remove video"); }
  };

  const openPlaylistDetail = async (playlist: Playlist) => {
    try { const data = await getPlaylist(playlist._id); setViewingPlaylist(data.playlist); }
    catch { toast.error("Failed to load playlist"); }
  };

  const playVideoInRightPanel = async (video: StandaloneVideo) => {
    try {
      let url = video.videoUrl;
      if (video.sourceType === "upload" && video.videoS3Key) {
        toast.info("Resolving streaming link...");
        const res = await getStandaloneVideoStreamUrl(video.videoS3Key);
        url = res.url;
      }
      if (!url) {
        toast.error("Video URL not available");
        return;
      }
      window.dispatchEvent(new CustomEvent("right-panel:open-video-player", {
        detail: {
          url: url,
          title: video.title,
          description: video.description || "",
          thumbnail: video.thumbnail || "",
          id: video._id,
          type: "standalone"
        }
      }));
    } catch (err) {
      toast.error("Failed to load video stream");
    }
  };

  const handlePaidEnroll = async (course: Course) => {
    // Simplified enrollment for course videos in playlists
    try {
      const enrollment = await enrollInCourse(course._id);
      setEnrollments(prev => new Map(prev).set(course._id, enrollment));
      toast.success("Enrolled!");
    } catch (error: any) { toast.error(error.message || "Failed to enroll"); }
  };

  const ShareButton = ({ id, onClick, variant = "default" }: { id: string; onClick: (e: React.MouseEvent) => void; variant?: "default" | "small" }) => {
    const state = shareStates[id];
    const iconSize = variant === "small" ? "w-3.5 h-3.5" : "w-3.5 h-3.5 @xs:w-4 @xs:h-4";
    const btnClass = variant === "small"
      ? `p-1.5 rounded transition-colors ${state === "copied" ? "text-green-400" : "text-[#9fa0b8] hover:text-brand hover:bg-[#1a1a22]"}`
      : `w-8 h-8 @xs:w-9 @xs:h-9 flex items-center justify-center rounded-full border border-[#2a2a35] transition-all duration-200 ${state === "copied" ? "text-green-400 border-green-400/30" : "text-[#9fa0b8] hover:text-brand hover:border-brand/30 hover:bg-brand/5"}`;
    return (
      <button onClick={onClick} className={btnClass} title="Copy share link">
        {state === "loading" ? <Loader2 className={`${iconSize} animate-spin`} /> : state === "copied" ? <Check className={iconSize} /> : <Send className={iconSize} />}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col bg-[#0b0b0d]">
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[#0e0e12] border border-[#2a2a35] p-4 animate-pulse space-y-3">
              <div className="h-32 bg-[#1a1a22] rounded-lg" />
              <div className="h-4 bg-[#1a1a22] rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 min-h-screen flex flex-col bg-[#0e0e12]">
      {/* ── Manage Modal ── */}
      {showManagePanel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowManagePanel(false)}>
          <div
            className="w-full max-w-lg mx-4 bg-[#12121a] border border-[#2a2a35] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a35]">
              <div>
                <h2 className="text-base font-semibold text-white">Manage Videos</h2>
                <p className="text-xs text-[#9fa0b8] mt-0.5">Choose which videos to show &amp; arrange their order</p>
              </div>
              <button onClick={() => setShowManagePanel(false)} className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode + Sort */}
            <div className="px-5 py-3 border-b border-[#2a2a35]/60 flex flex-wrap gap-4">
              {/* View Mode */}
              <div>
                <p className="text-[11px] font-semibold text-[#9fa0b8]/70 uppercase tracking-wider mb-2">View</p>
                <div className="flex gap-1.5">
                  {([{ k: "grid" as const, icon: LayoutGrid, label: "Grid" }, { k: "list" as const, icon: List, label: "List" }]).map((m) => (
                    <button key={m.k} onClick={() => setViewMode(m.k)} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all", viewMode === m.k ? "bg-brand text-brand-foreground" : "bg-[#1a1a22] text-[#9fa0b8] hover:text-white")}>
                      <m.icon className="w-3.5 h-3.5" /> {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Sort */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#9fa0b8]/70 uppercase tracking-wider mb-2">Sort</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "newest" as const, label: "Newest" },
                    { key: "oldest" as const, label: "Oldest" },
                    { key: "az" as const, label: "A→Z" },
                    { key: "za" as const, label: "Z→A" },
                    { key: "custom" as const, label: "Custom" },
                  ].map((opt) => (
                    <button key={opt.key} onClick={() => setSortOrder(opt.key)} className={cn("px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all", sortOrder === opt.key ? "bg-brand text-brand-foreground" : "bg-[#1a1a22] text-[#9fa0b8] hover:text-white")}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Video List */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {(sortOrder === "custom"
                ? customOrder.map(id => standaloneVideos.find(v => v._id === id)).filter(Boolean) as StandaloneVideo[]
                : [...standaloneVideos].sort((a, b) => {
                    switch (sortOrder) {
                      case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                      case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                      case "az": return a.title.localeCompare(b.title);
                      case "za": return b.title.localeCompare(a.title);
                      default: return 0;
                    }
                  })
              ).map((video, idx, arr) => {
                const isHidden = hiddenVideoIds.has(video._id);
                return (
                  <div
                    key={video._id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150",
                      isHidden ? "opacity-40" : "",
                      dragOverId === video._id ? "bg-brand/10 border border-brand/30" : "hover:bg-[#1a1a22] border border-transparent"
                    )}
                    draggable={sortOrder === "custom"}
                    onDragStart={() => { dragItemRef.current = video._id; }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverId(video._id); }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverId(null);
                      if (dragItemRef.current && dragItemRef.current !== video._id) {
                        setSortOrder("custom");
                        setCustomOrder(prev => {
                          const order = prev.length > 0 ? [...prev] : standaloneVideos.map(v => v._id);
                          const fromIdx = order.indexOf(dragItemRef.current!);
                          const toIdx = order.indexOf(video._id);
                          if (fromIdx < 0 || toIdx < 0) return order;
                          order.splice(fromIdx, 1);
                          order.splice(toIdx, 0, dragItemRef.current!);
                          return order;
                        });
                      }
                      dragItemRef.current = null;
                    }}
                  >
                    {/* Drag handle (only in custom mode) */}
                    {sortOrder === "custom" && (
                      <div className="cursor-grab active:cursor-grabbing text-[#9fa0b8]/50 hover:text-[#9fa0b8]">
                        <GripVertical className="w-4 h-4" />
                      </div>
                    )}
                    {/* Thumbnail */}
                    <div className="w-14 h-9 rounded-md overflow-hidden flex-shrink-0 bg-[#1a1a22]">
                      {video.thumbnail ? (
                        <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#14141e]">
                          <Video className="w-6 h-6 text-[#5a5a6a]" />
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{video.title}</p>
                      <p className="text-[10px] text-[#5a5a6a] truncate">{new Date(video.createdAt).toLocaleDateString()}</p>
                    </div>
                    {/* Hide toggle */}
                    <button
                      onClick={() => toggleVideoVisibility(video._id)}
                      className={cn(
                        "p-1.5 rounded-lg border transition-all duration-150 flex items-center gap-1 text-[10px] font-medium",
                        isHidden
                          ? "border-brand/20 text-brand hover:bg-brand/5 bg-brand/5"
                          : "border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-[#3a3a45]"
                      )}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span className="hidden xs:inline">{isHidden ? "Hidden" : "Visible"}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-[#2a2a35] flex items-center justify-between bg-[#0b0b0f]">
              <p className="text-[11px] text-[#5a5a6a]">
                {sortOrder === "custom" ? "Drag to reorder" : "Sorting by: " + sortOrder}
              </p>
              <button onClick={() => setShowManagePanel(false)} className="px-4 py-2 rounded-lg text-sm bg-brand text-brand-foreground font-medium hover:bg-brand/90 transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== VIDEOS TAB ===== */}
      {activeSection === "videos" && (
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 pt-6 flex-1">


            {/* Header with Upload Button (founder only) */}
            {hasEditPermissions && (
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">Your Videos</h2>
                  <p className="text-sm text-[#9fa0b8]">Upload and manage videos for your community</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowManagePanel(true)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 bg-[#1a1a22] text-[#9fa0b8] border border-[#2a2a35] hover:text-white hover:border-[#3a3a45] hover:bg-[#1e1e28]"
                  >
                    <Settings2 className="w-4 h-4" />
                    <span>Manage</span>
                  </button>
                  <button
                    onClick={() => { setEditingStandaloneVideo(null); setShowUploadVideoModal(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-brand-foreground text-sm font-medium hover:bg-brand/90 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Video
                  </button>
                </div>
              </div>
            )}



            {/* Loading state */}
            {standaloneVideosLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-brand animate-spin mb-4" />
                <p className="text-[#9fa0b8]">Loading videos...</p>
              </div>
            ) : standaloneVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Video className="h-12 w-12 text-[#9fa0b8] mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Videos</h3>
                <p className="text-[#9fa0b8]">
                  {isFounder ? "No videos uploaded yet. Click 'Upload Video' to get started." : "No videos available yet."}
                </p>
              </div>
            ) : (
              <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 min-[1800px]:grid-cols-5 gap-6 w-full" : "space-y-3 sm:space-y-4"}>
                {sortedStandaloneVideos.map((video) => (
                  <div
                    key={video._id}
                    onClick={() => playVideoInRightPanel(video)}
                    className={viewMode === "grid"
                      ? "w-full flex flex-col h-full group cursor-pointer @container"
                      : "bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-4 @container"
                    }
                  >
                    {viewMode === "grid" ? (
                      <>
                        {/* Thumbnail / Play area */}
                        <div className="aspect-video bg-[#1a1a22] relative overflow-hidden rounded-2xl flex-shrink-0">
                          {video.thumbnail ? (
                            <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#14141e]">
                              <Video className="h-10 w-10 text-[#5a5a6a]" />
                            </div>
                          )}
                          {hasEditPermissions && video.sourceType === "upload" && (
                            <div className="absolute top-2.5 left-2.5 bg-brand/80 text-brand-foreground text-[10px] px-2 py-0.5 rounded-full font-medium z-10">Uploaded</div>
                          )}
                          {hasEditPermissions && video.sourceType === "link" && (
                            <div className="absolute top-2.5 left-2.5 bg-blue-500/80 text-white text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 z-10">
                              <LinkIcon className="w-2.5 h-2.5" />Link
                            </div>
                          )}
                          {video.duration && video.duration > 0 && (
                            <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md rounded px-1.5 py-0.5 text-[10px] text-white font-medium flex items-center gap-0.5 z-10">
                              <Clock size={9} /> {formatDuration(video.duration)}
                            </div>
                          )}
                          {/* Hover Play Overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 shadow-[0_0_15px] shadow-brand/40">
                              <Play className="w-5 h-5 text-brand-foreground fill-current ml-0.5" />
                            </div>
                          </div>
                        </div>

                        {/* Title, description, and date info */}
                        <div className="flex flex-col flex-1 mt-2">
                          <h3 className="text-white text-sm font-semibold mb-0.5 line-clamp-1 group-hover:text-brand transition-colors">{video.title}</h3>
                          {video.description && (
                            <p className="text-[11px] text-[#9fa0b8] line-clamp-2 mb-1 leading-relaxed">{video.description}</p>
                          )}
                          <div className="mt-auto pt-1 flex items-center justify-between gap-2 text-sm text-[#9fa0b8]">
                            <div className="text-[10px] text-[#5a5a6a] font-medium flex-shrink-0">
                              {formatVideoDate(video.createdAt)}
                            </div>
                            
                            {hasEditPermissions && (
                              <div className="flex items-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="w-7 h-7 flex items-center justify-center rounded-full text-[#9fa0b8] hover:text-white hover:bg-white/5 transition-all duration-200 flex-shrink-0">
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-[#1a1a22] border-[#2a2a35] text-white">
                                    <DropdownMenuItem onClick={() => { setEditingStandaloneVideo(video); setShowUploadVideoModal(true); }}>
                                      <Edit className="w-4 h-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setShowDeleteVideoConfirm(video._id)} className="text-red-400 focus:text-red-400">
                                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      /* List view */
                      <div className="flex flex-col @sm:flex-row gap-3 @sm:gap-4">
                        <button
                          onClick={() => playVideoInRightPanel(video)}
                          className="w-full @sm:w-48 aspect-video @sm:h-28 bg-[#1a1a22] rounded-lg relative overflow-hidden flex-shrink-0 group"
                        >
                          {video.thumbnail ? (
                            <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="h-8 w-8 text-[#9fa0b8]" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                            <Play className="w-12 h-12 @sm:w-8 @sm:h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                        <div className="flex-1 flex flex-col">
                          <h3 className="text-white font-medium mb-1">{video.title}</h3>
                          {video.description && (
                            <p className="text-sm text-[#9fa0b8] line-clamp-2">{video.description}</p>
                          )}
                          <div className="mt-auto pt-2 flex items-center justify-between gap-2 @xs:gap-4 text-sm text-[#9fa0b8]">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span className="text-xs @xs:text-sm">{new Date(video.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5 @xs:gap-2">
                              <ShareButton id={video._id} onClick={(e) => { e.stopPropagation(); handleShare(video._id, "video", "standalone"); }} />
                              {!isFounder && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleLearnerQuickAdd({ videoSource: "standalone", videoId: video._id }); }}
                                  className="w-8 h-8 @xs:w-9 @xs:h-9 flex items-center justify-center rounded-full border border-[#2a2a35] text-[#9fa0b8] hover:text-brand hover:border-brand/30 hover:bg-brand/5 transition-all duration-200 flex-shrink-0"
                                  title="Add to My Playlist"
                                >
                                  <ListPlus className="w-3.5 h-3.5 @xs:w-4 @xs:h-4" />
                                </button>
                              )}
                              {hasEditPermissions && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="w-8 h-8 @xs:w-9 @xs:h-9 flex items-center justify-center rounded-full border border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-[#3a3a45] hover:bg-white/5 transition-all duration-200 flex-shrink-0">
                                      <MoreVertical className="w-3.5 h-3.5 @xs:w-4 @xs:h-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-[#1a1a22] border-[#2a2a35] text-white">
                                    <DropdownMenuItem onClick={() => { setEditingStandaloneVideo(video); setShowUploadVideoModal(true); }}>
                                      <Edit className="w-4 h-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setShowDeleteVideoConfirm(video._id)} className="text-red-400 focus:text-red-400">
                                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              <button
                                onClick={() => playVideoInRightPanel(video)}
                                className="w-8 h-8 @xs:w-auto @xs:h-9 @xs:px-4 flex items-center justify-center gap-1.5 rounded-full bg-brand text-brand-foreground text-xs font-semibold hover:bg-brand/90 transition-all duration-200 flex-shrink-0"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span className="hidden @xs:inline">Watch</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Delete standalone video confirm dialog */}
      <AlertDialog open={!!showDeleteVideoConfirm} onOpenChange={() => setShowDeleteVideoConfirm(null)}>
        <AlertDialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video</AlertDialogTitle>
            <AlertDialogDescription className="text-[#9fa0b8]">
              Are you sure you want to delete this video? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1a22] border-[#2a2a35] text-white hover:bg-[#2a2a35]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (showDeleteVideoConfirm) {
                  try {
                    await deleteStandaloneVideo(showDeleteVideoConfirm);
                    setStandaloneVideos((prev) => prev.filter((v) => v._id !== showDeleteVideoConfirm));
                    toast.success("Video deleted!");
                  } catch (error: any) {
                    toast.error(error.message || "Failed to delete video");
                  }
                  setShowDeleteVideoConfirm(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== PLAYLISTS TAB ===== */}
      {activeSection === "playlists" && (
        <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6">
          {/* Playlist Detail View */}
          {viewingPlaylist ? (
            <div>
              <button
                onClick={() => setViewingPlaylist(null)}
                className="flex items-center gap-2 text-[#9fa0b8] hover:text-white mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Playlists
              </button>
              <div className="mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4 flex-1 min-w-0">
                    {/* Playlist Thumbnail Preview + Picker */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-28 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                          hasEditPermissions && viewingPlaylist.type === "founder"
                            ? "border-[#2a2a35] hover:border-brand/50 cursor-pointer"
                            : "border-[#2a2a35]"
                        }`}
                        onClick={() => {
                          if (hasEditPermissions && viewingPlaylist.type === "founder") {
                            setShowThumbnailPicker(!showThumbnailPicker);
                          }
                        }}
                        title={hasEditPermissions && viewingPlaylist.type === "founder" ? "Click to change thumbnail" : undefined}
                      >
                        {viewingPlaylist.coverImage ? (
                          <img src={viewingPlaylist.coverImage} alt={viewingPlaylist.title} className="w-full h-full object-cover" />
                        ) : viewingPlaylist.videos?.length > 0 && viewingPlaylist.videos[0].thumbnail ? (
                          <img src={viewingPlaylist.videos[0].thumbnail} alt={viewingPlaylist.title} className="w-full h-full object-cover opacity-60" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#1a1a22] to-[#2a2a35] flex items-center justify-center">
                            <ListVideo className="w-8 h-8 text-[#9fa0b8]/40" />
                          </div>
                        )}
                        {hasEditPermissions && viewingPlaylist.type === "founder" && (
                          <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-white opacity-0 hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </div>
                      {/* Thumbnail Picker Dropdown */}
                      {showThumbnailPicker && hasEditPermissions && viewingPlaylist.type === "founder" && viewingPlaylist.videos && (
                        <div className="absolute top-full left-0 mt-2 z-50 w-72 bg-[#0e0e12] border border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden">
                          <div className="px-3 py-2.5 border-b border-[#2a2a35] flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">Choose Thumbnail</span>
                            <button onClick={() => setShowThumbnailPicker(false)} className="p-1 rounded text-[#9fa0b8] hover:text-white transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="max-h-56 overflow-y-auto p-2 space-y-1">
                            {viewingPlaylist.videos.filter((v: any) => v.thumbnail).length === 0 ? (
                              <p className="text-xs text-[#9fa0b8] text-center py-4">No video thumbnails available</p>
                            ) : (
                              viewingPlaylist.videos.filter((v: any) => v.thumbnail).map((video: any, idx: number) => (
                                <button
                                  key={`thumb-${video._id}-${idx}`}
                                  onClick={async () => {
                                    try {
                                      await handleUpdatePlaylist(viewingPlaylist._id, { coverImage: video.thumbnail });
                                      setShowThumbnailPicker(false);
                                    } catch {}
                                  }}
                                  className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${
                                    viewingPlaylist.coverImage === video.thumbnail
                                      ? "bg-brand/10 border border-brand/30"
                                      : "hover:bg-[#1a1a22] border border-transparent"
                                  }`}
                                >
                                  <div className="w-16 h-10 rounded-md overflow-hidden flex-shrink-0 bg-[#1a1a22]">
                                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white truncate">{video.title}</p>
                                    {viewingPlaylist.coverImage === video.thumbnail && (
                                      <span className="text-[10px] text-brand">Current thumbnail</span>
                                    )}
                                  </div>
                                  {viewingPlaylist.coverImage === video.thumbnail && (
                                    <CheckCircle2 className="w-4 h-4 text-brand flex-shrink-0" />
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-white mb-1">{viewingPlaylist.title}</h2>
                      {viewingPlaylist.description && (
                        <p className="text-sm text-[#9fa0b8] mb-2">{viewingPlaylist.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-[#9fa0b8]">
                        <span className="flex items-center gap-1">
                          <Video className="w-3.5 h-3.5" />
                          {viewingPlaylist.videoCount} video{viewingPlaylist.videoCount !== 1 ? "s" : ""}
                        </span>
                        {viewingPlaylist.type === "founder" && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${viewingPlaylist.isPublished ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                            {viewingPlaylist.isPublished ? "Published" : "Draft"}
                          </span>
                        )}
                        <span>by {viewingPlaylist.createdBy?.name || "Unknown"}</span>
                      </div>
                    </div>
                  </div>
                  {/* Play / Edit / Delete for owners */}
                  <div className="flex items-center gap-2">
                    {viewingPlaylist.videos && viewingPlaylist.videos.length > 0 && (
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("right-panel:open-playlist", {
                            detail: {
                              playlistId: viewingPlaylist._id,
                              startIndex: 0
                            }
                          }));
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-brand-foreground text-xs font-semibold hover:bg-brand/90 transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-black" />
                        Play Playlist
                      </button>
                    )}
                    {((viewingPlaylist.type === "founder" && hasEditPermissions) || viewingPlaylist.type === "learner") && (
                      <>
                        <button
                          onClick={() => { setEditingPlaylist(viewingPlaylist); setShowCreatePlaylistModal(true); }}
                          className="p-2 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-[#3a3a45] transition-colors cursor-pointer"
                          title="Edit playlist"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {viewingPlaylist.type === "founder" && hasEditPermissions && (
                          <button
                            onClick={() => handleUpdatePlaylist(viewingPlaylist._id, { isPublished: !viewingPlaylist.isPublished })}
                            className="p-2 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-[#3a3a45] transition-colors cursor-pointer"
                            title={viewingPlaylist.isPublished ? "Unpublish" : "Publish"}
                          >
                            {viewingPlaylist.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => setShowDeletePlaylistConfirm(viewingPlaylist._id)}
                          className="p-2 rounded-lg bg-[#1a1a22] border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete playlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* Videos in playlist */}
              {viewingPlaylist.videos && viewingPlaylist.videos.length > 0 ? (
                <div className="space-y-3">
                  {viewingPlaylist.videos.map((video: any, index: number) => {
                    const isCourseVideo = video._videoSource === "courseVideo";
                    const isEnrolled = isCourseVideo && video.courseId ? enrollments.has(video.courseId.toString()) : true;
                    const needsPayment = isCourseVideo && !isEnrolled && video.isPaid;
                    const needsEnroll = isCourseVideo && !isEnrolled && !video.isPaid;

                    return (
                      <div
                        key={`${video._videoSource || "video"}-${video._id}-${index}`}
                        className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-3 flex items-center gap-4 group hover:border-[#3a3a45] transition-colors"
                      >
                        <span className="text-[#9fa0b8] text-sm font-mono w-6 text-center flex-shrink-0">{index + 1}</span>
                        <div className="w-24 h-14 bg-[#1a1a22] rounded-md overflow-hidden flex-shrink-0 relative">
                          {video.thumbnail ? (
                            <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {isCourseVideo ? <BookOpen className="w-5 h-5 text-[#9fa0b8]" /> : <Video className="w-5 h-5 text-[#9fa0b8]" />}
                            </div>
                          )}
                          {video.duration && (
                            <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.2 text-[8px] text-white font-medium z-10">
                              {formatDuration(video.duration)}
                            </div>
                          )}
                          {/* Source badge on thumbnail */}
                          <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                            video._videoSource === "workshop" ? "bg-blue-500/80 text-white" :
                            video._videoSource === "standalone" ? "bg-green-500/80 text-white" :
                            "bg-purple-500/80 text-white"
                          }`}>
                            {video._videoSource === "workshop" ? "Live" : video._videoSource === "standalone" ? "Video" : "Course"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white text-sm font-medium truncate">{video.title}</h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            {video.date && (
                              <span className="text-xs text-[#9fa0b8]">{new Date(video.date).toLocaleDateString()}</span>
                            )}
                            {video.duration && (
                              <span className="text-xs text-[#9fa0b8]">{formatDuration(video.duration)}</span>
                            )}
                            {isCourseVideo && video.courseTitle && (
                              <span className="text-xs text-purple-400">From: {video.courseTitle}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Access-gated actions for learners */}
                          {!isFounder && isCourseVideo && !isEnrolled ? (
                            // Learner not enrolled → show enrollment prompt
                            needsPayment ? (
                              <button
                                onClick={() => {
                                  // Find the course and trigger payment flow
                                  const course = courses.find((c) => c._id === video.courseId);
                                  if (course) {
                                    handlePaidEnroll(course);
                                  }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-brand-foreground text-xs font-medium hover:bg-brand/90 transition-colors"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                Purchase ({video.currency === "INR" ? "₹" : "$"}{formatPrice(video.price)})
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  try {
                                    await enrollInCourse(video.courseId);
                                    // Refresh enrollments
                                    const enrollmentsData = await getMyEnrollments();
                                    const enrollmentMap = new Map<string, any>();
                                    enrollmentsData.forEach((e) => {
                                      const courseId = typeof e.courseId === "string" ? e.courseId : e.courseId._id;
                                      enrollmentMap.set(courseId, e);
                                    });
                                    setEnrollments(enrollmentMap);
                                    // Refresh playlist
                                    const data = await getPlaylist(viewingPlaylist._id);
                                    setViewingPlaylist(data.playlist);
                                    toast.success("Enrolled! You can now watch this video.");
                                  } catch (error: any) {
                                    toast.error(error.message || "Failed to enroll");
                                  }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                Enroll to Watch
                              </button>
                            )
                          ) : (
                            // Founder, or enrolled learner, or non-course video → show Watch button
                            <button
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent("right-panel:open-playlist", {
                                  detail: {
                                    playlistId: viewingPlaylist._id,
                                    startIndex: index
                                  }
                                }));
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-brand-foreground text-xs font-medium hover:bg-brand/90 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Watch
                            </button>
                          )}
                          {/* Remove button for owners */}
                          {((viewingPlaylist.type === "founder" && hasEditPermissions) || viewingPlaylist.type === "learner") && (
                            <button
                              onClick={() => handleRemoveVideoFromPlaylist(viewingPlaylist._id, video._id, video._videoSource)}
                              className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove from playlist"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          {/* Set as Thumbnail button for founders */}
                          {hasEditPermissions && viewingPlaylist.type === "founder" && video.thumbnail && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await handleUpdatePlaylist(viewingPlaylist._id, { coverImage: video.thumbnail });
                                  toast.success("Playlist thumbnail updated!");
                                } catch {
                                  toast.error("Failed to update thumbnail");
                                }
                              }}
                              className={`p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${
                                viewingPlaylist.coverImage === video.thumbnail
                                  ? "text-brand bg-brand/10"
                                  : "text-[#9fa0b8] hover:text-brand hover:bg-brand/10"
                              }`}
                              title={viewingPlaylist.coverImage === video.thumbnail ? "Current thumbnail" : "Set as playlist thumbnail"}
                            >
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Video className="h-12 w-12 text-[#9fa0b8] mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No videos yet</h3>
                  <p className="text-[#9fa0b8] text-sm">Add videos to this playlist to get started.</p>
                </div>
              )}
            </div>
          ) : playlistsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-brand animate-spin" />
            </div>
          ) : (
            <div>
              {/* Header with Create button */}
              {hasEditPermissions && (
                <div className="flex justify-end mb-6">
                  <button
                    onClick={() => { setEditingPlaylist(null); setShowCreatePlaylistModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-brand-foreground text-sm font-medium hover:bg-brand/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Playlist
                  </button>
                </div>
              )}

              {/* Founder: all founder playlists */}
              {hasEditPermissions && (() => {
                const founderPlaylists = playlists.filter((p) => p.type === "founder");
                return founderPlaylists.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {founderPlaylists.map((playlist) => (
                      <div
                        key={playlist._id}
                        className="w-full group cursor-pointer flex flex-col h-full pt-4"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("right-panel:open-playlist", {
                            detail: {
                              playlistId: playlist._id
                            }
                          }));
                        }}
                      >
                        {/* Thumbnail and stack effect wrapper */}
                        <div className="relative aspect-video w-full">
                          {/* stacked folder visual look */}
                          <div className="absolute -top-3 left-2.5 right-2.5 w-[calc(100%-20px)] aspect-video bg-[#1a1a24] border border-[#2a2a35] rounded-2xl z-0 transform group-hover:-translate-y-1.5 transition-all duration-300 mx-auto" />
                          <div className="absolute -top-1.5 left-1.5 right-1.5 w-[calc(100%-12px)] aspect-video bg-[#12121a] border border-[#2a2a35]/80 rounded-2xl z-10 transform group-hover:-translate-y-0.75 transition-all duration-300 mx-auto" />
                          
                          {/* main thumbnail */}
                          <div className="relative aspect-video bg-[#1a1a22] overflow-hidden rounded-2xl z-20">
                            {playlist.coverImage ? (
                              <img src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#14141e]">
                                <ListVideo className="w-12 h-12 text-[#9fa0b8]/40" />
                              </div>
                            )}
                            {/* Publish Status Badge */}
                            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-30">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${playlist.isPublished ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"}`}>
                                {playlist.isPublished ? "Published" : "Draft"}
                              </span>
                            </div>
                            {/* Count Badge overlay */}
                            <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1 font-medium z-35">
                              <ListVideo className="w-3 h-3 text-brand" />
                              <span>{playlist.videoCount} Videos</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col flex-1 mt-3">
                          <h3 className="text-white text-base font-semibold line-clamp-1 group-hover:text-brand transition-colors mb-1">{playlist.title}</h3>
                          {playlist.description && (
                            <p className="text-xs text-[#9fa0b8] line-clamp-2 leading-relaxed mb-2">{playlist.description}</p>
                          )}
                          <div className="mt-auto flex items-center justify-between text-[11px] text-[#5a5a6a] font-medium">
                            <span>By {playlist.createdBy?.name || "Unknown"}</span>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <ShareButton id={playlist._id} onClick={() => handleShare(playlist._id, "playlist")} variant="small" />
                              <button
                                onClick={() => { setEditingPlaylist(playlist); setShowCreatePlaylistModal(true); }}
                                className="p-1.5 rounded text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setShowDeletePlaylistConfirm(playlist._id)}
                                className="p-1.5 rounded text-[#9fa0b8] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-[#2a2a35] rounded-lg mb-8">
                    <ListVideo className="h-12 w-12 text-[#9fa0b8] mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No playlists yet</h3>
                    <p className="text-[#9fa0b8] text-sm mb-4">Create your first playlist to curate videos for your community.</p>
                    <button
                      onClick={() => { setEditingPlaylist(null); setShowCreatePlaylistModal(true); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-brand-foreground text-sm font-medium hover:bg-brand/90 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Playlist
                    </button>
                  </div>
                );
              })()}

              {/* Learner: My Playlists + Curated Playlists */}
              {!hasEditPermissions && (() => {
                const myPlaylists = playlists.filter((p) => p.type === "learner");
                const curatedPlaylists = playlists.filter((p) => p.type === "founder" && p.isPublished);
                return (
                  <>
                    {/* My Playlists */}
                    <div className="mb-8">
                      <h3 className="text-sm font-semibold text-[#9fa0b8] uppercase tracking-wider mb-4">My Playlist</h3>
                      {myPlaylists.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {myPlaylists.map((playlist) => (
                            <div
                              key={playlist._id}
                              className="w-full group cursor-pointer flex flex-col h-full pt-4"
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent("right-panel:open-playlist", {
                                  detail: {
                                    playlistId: playlist._id
                                  }
                                }));
                              }}
                            >
                              {/* Thumbnail and stack effect wrapper */}
                              <div className="relative aspect-video w-full">
                                {/* stacked folder visual look */}
                                <div className="absolute -top-3 left-2.5 right-2.5 w-[calc(100%-20px)] aspect-video bg-[#1a1a24] border border-[#2a2a35] rounded-2xl z-0 transform group-hover:-translate-y-1.5 transition-all duration-300 mx-auto" />
                                <div className="absolute -top-1.5 left-1.5 right-1.5 w-[calc(100%-12px)] aspect-video bg-[#12121a] border border-[#2a2a35]/80 rounded-2xl z-10 transform group-hover:-translate-y-0.75 transition-all duration-300 mx-auto" />
                                
                                {/* main thumbnail */}
                                <div className="relative aspect-video bg-[#1a1a22] overflow-hidden rounded-2xl z-20">
                                  {playlist.coverImage ? (
                                    <img src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#14141e]">
                                      <Music className="w-10 h-10 text-[#9fa0b8]/40" />
                                    </div>
                                  )}
                                  {/* Count Badge overlay */}
                                  <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1 font-medium z-30">
                                    <ListVideo className="w-3 h-3 text-brand" />
                                    <span>{playlist.videoCount} Videos</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col flex-1 mt-3">
                                <h3 className="text-white text-base font-semibold line-clamp-1 group-hover:text-brand transition-colors mb-1">{playlist.title}</h3>
                                {playlist.description && (
                                  <p className="text-xs text-[#9fa0b8] line-clamp-2 leading-relaxed mb-2">{playlist.description}</p>
                                )}
                                <div className="mt-auto text-[11px] text-[#5a5a6a] font-medium">
                                  By {playlist.createdBy?.name || "Unknown"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 border border-dashed border-[#2a2a35] rounded-lg">
                          <Music className="h-8 w-8 text-[#9fa0b8] mx-auto mb-2" />
                          <p className="text-sm text-[#9fa0b8]">Your playlist is empty. Use the <ListPlus className="w-3.5 h-3.5 inline-block mx-0.5" /> button on videos to add them!</p>
                        </div>
                      )}
                    </div>
                    {/* Curated Playlists (from founder) */}
                    {curatedPlaylists.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-[#9fa0b8] uppercase tracking-wider mb-4">Curated Playlists</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {curatedPlaylists.map((playlist) => (
                            <div
                              key={playlist._id}
                              className="w-full group cursor-pointer flex flex-col h-full pt-4"
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent("right-panel:open-playlist", {
                                  detail: {
                                    playlistId: playlist._id
                                  }
                                }));
                              }}
                            >
                              {/* Thumbnail and stack effect wrapper */}
                              <div className="relative aspect-video w-full">
                                {/* stacked folder visual look */}
                                <div className="absolute -top-3 left-2.5 right-2.5 w-[calc(100%-20px)] aspect-video bg-[#1a1a24] border border-[#2a2a35] rounded-2xl z-0 transform group-hover:-translate-y-1.5 transition-all duration-300 mx-auto" />
                                <div className="absolute -top-1.5 left-1.5 right-1.5 w-[calc(100%-12px)] aspect-video bg-[#12121a] border border-[#2a2a35]/80 rounded-2xl z-10 transform group-hover:-translate-y-0.75 transition-all duration-300 mx-auto" />
                                
                                {/* main thumbnail */}
                                <div className="relative aspect-video bg-[#1a1a22] overflow-hidden rounded-2xl z-20">
                                  {playlist.coverImage ? (
                                    <img src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#14141e]">
                                      <ListVideo className="w-10 h-10 text-[#9fa0b8]/40" />
                                    </div>
                                  )}
                                  {/* Count Badge overlay */}
                                  <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1 font-medium z-30">
                                    <ListVideo className="w-3 h-3 text-brand" />
                                    <span>{playlist.videoCount} Videos</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col flex-1 mt-3">
                                <h3 className="text-white text-base font-semibold line-clamp-1 group-hover:text-brand transition-colors mb-1">{playlist.title}</h3>
                                {playlist.description && (
                                  <p className="text-xs text-[#9fa0b8] line-clamp-2 leading-relaxed mb-2">{playlist.description}</p>
                                )}
                                <div className="mt-auto text-[11px] text-[#5a5a6a] font-medium">
                                  By {playlist.createdBy?.name || "Unknown"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Playlist Modal */}
      {/* Create/Edit Playlist Modal */}
      {showCreatePlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowCreatePlaylistModal(false); setEditingPlaylist(null); }} />
          <div className="relative bg-[#0e0e12] border border-[#2a2a35] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a35]">
              <h2 className="text-lg font-semibold text-white">
                {editingPlaylist ? "Edit Playlist" : "Create Playlist"}
              </h2>
              <button
                onClick={() => { setShowCreatePlaylistModal(false); setEditingPlaylist(null); }}
                className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Modal body rendered via PlaylistFormContent */}
            <PlaylistFormContent
              initialData={editingPlaylist}
              isFounder={isFounder}
              onSubmit={async (data) => {
                if (editingPlaylist) {
                  await handleUpdatePlaylist(editingPlaylist._id, data);
                } else {
                  await handleCreatePlaylist(data);
                }
              }}
              onCancel={() => { setShowCreatePlaylistModal(false); setEditingPlaylist(null); }}
            />
          </div>
        </div>
      )}

      {/* Delete Playlist Confirmation */}
      {/* Delete Playlist Confirmation */}
      {showDeletePlaylistConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeletePlaylistConfirm(null)} />
          <div className="relative bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Playlist?</h3>
            <p className="text-sm text-[#9fa0b8] mb-6">This action cannot be undone. All videos will be removed from this playlist.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeletePlaylistConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm text-[#9fa0b8] hover:text-white border border-[#2a2a35] hover:border-[#3a3a45] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePlaylist(showDeletePlaylistConfirm)}
                className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Playlist Dropdown */}
      {/* Add to Playlist Dropdown (for video cards) */}
      {addToPlaylistWorkshopId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAddToPlaylistWorkshopId(null)} />
          <div className="relative bg-[#0e0e12] border border-[#2a2a35] rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a35]">
              <h3 className="text-sm font-semibold text-white">Add to Playlist</h3>
              <button
                onClick={() => setAddToPlaylistWorkshopId(null)}
                className="p-1 rounded text-[#9fa0b8] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto">
              {playlists.length > 0 ? (
                <div className="space-y-1">
                  {playlists
                    .filter((p) => (hasEditPermissions ? p.type === "founder" : p.type === "learner"))
                    .map((playlist) => {
                      const alreadyAdded = playlist.videoEntries?.some((e) => e.videoId === addToPlaylistWorkshopId) || playlist.videoIds?.includes(addToPlaylistWorkshopId);
                      return (
                        <button
                          key={playlist._id}
                          onClick={() => !alreadyAdded && handleAddVideoToPlaylist(playlist._id, { videoSource: "workshop", videoId: addToPlaylistWorkshopId })}
                          disabled={alreadyAdded}
                          className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 transition-colors ${
                            alreadyAdded
                              ? "bg-green-500/10 text-green-400 cursor-default"
                              : "hover:bg-[#1a1a22] text-white"
                          }`}
                        >
                          <span className="text-sm truncate">{playlist.title}</span>
                          {alreadyAdded ? (
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-400" />
                          ) : (
                            <Plus className="w-4 h-4 flex-shrink-0 text-[#9fa0b8]" />
                          )}
                        </button>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-[#9fa0b8] text-center py-4">No playlists yet.</p>
              )}
            </div>
            <div className="px-3 pb-3 pt-1 border-t border-[#2a2a35]">
              <button
                onClick={() => {
                  setAddToPlaylistWorkshopId(null);
                  setEditingPlaylist(null);
                  setShowCreatePlaylistModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-brand hover:bg-brand/10 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create New Playlist
              </button>
            </div>
          </div>
        </div>
      )}


      {showUploadVideoModal && (
        <StandaloneVideoModal
          isOpen={showUploadVideoModal}
          onClose={() => { setShowUploadVideoModal(false); setEditingStandaloneVideo(null); }}
          onSave={async (data) => {
            try {
              if (editingStandaloneVideo) {
                const result = await updateStandaloneVideo(editingStandaloneVideo._id, data);
                setStandaloneVideos((prev) => prev.map((v) => v._id === editingStandaloneVideo._id ? result.video : v));
                toast.success("Video updated!");
              } else {
                const result = await createStandaloneVideo(data as any);
                setStandaloneVideos((prev) => [result.video, ...prev]);
                toast.success("Video created!");
              }
              setShowUploadVideoModal(false);
              setEditingStandaloneVideo(null);
            } catch (error: any) { toast.error(error.message || "Failed to save video"); }
          }}
          existingVideo={editingStandaloneVideo}
        />
      )}
    </div>
  );
}