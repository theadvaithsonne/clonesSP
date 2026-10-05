"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Clock,
  User,
  Play,
  CheckCircle2,
  ExternalLink,
  Search,
  Filter,
  Grid,
  List,
  X,
  ArrowLeft,
  ArrowRight,
  FileText,
  Link as LinkIcon,
  Link2,
  CheckCircle,
  Circle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Users,
  Loader2,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  GripVertical,
  Video,
  FileType,
  Save,
  MoreVertical,
  DollarSign,
  Star,
  Image,
  ImageIcon,
  CreditCard,
  Briefcase,
  Layers,
  ClipboardList,
  HelpCircle,
  BarChart3,
  RotateCcw,
  AlertTriangle,
  Percent,
  Flame,
  Timer,
  TrendingUp,
  Calendar,
  ListPlus,
  Music,
  ListVideo,
  Send,
  Check,
  Pencil,
  Gift,
  FileDown,
  Maximize2,
  Minimize2,
  Lock,
  Award,
  Infinity,
  Shield,
  Monitor,
  CloudUpload,
  PlusCircle,
  Apple,
  Smartphone,
  Info,
  FileCode,
  Copy,
  Sparkles,
} from "lucide-react";
import {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  cloneCourse,
  addCourseSection,
  updateCourseSection,
  deleteCourseSection,
  addCourseChapter,
  updateCourseChapter,
  deleteCourseChapter,
  enrollInCourse,
  getMyEnrollments,
  getCourseEnrollment,
  getAdminCourseEnrollments,
  markChapterComplete,
  markChapterIncomplete,
  createCourseRazorpayOrder,
  verifyCoursePayment,
  getOrgChannels,
  type Channel,
  type Course,
  type CourseChapter,
  type CourseEnrollment,
  type CourseInclude,
  type CourseReview,

  type Workshop,
  submitQuizAttempt,
  getQuizAnalytics,
  type QuizSubmitResult,
  type QuizAnalyticsData,
  type Quiz,
  type QuizQuestion,
  type QuizOption,
  startStudySession,
  endStudySession,
  studySessionHeartbeat,
  getStudyStats,
  type StudyStats,
  getCourseVideoUploadUrl,
  initiateCourseVideoMultipart,
  completeCourseVideoMultipart,
  abortCourseVideoMultipart,
  getCourseVideoStreamUrl,
  deleteCourseVideo,
  getPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist as updatePlaylistApi,
  deletePlaylist as deletePlaylistApi,
  addVideosToPlaylist,
  removeVideoFromPlaylist,
  quickAddToPlaylist,
  getPlaylistAvailableVideos,
  type Playlist,
  type PlaylistVideoEntry,
  type PlaylistVideo,
  type AvailableVideos,
  getStandaloneVideos,
  createStandaloneVideo,
  updateStandaloneVideo,
  deleteStandaloneVideo,
  getStandaloneVideoUploadUrl,
  initiateStandaloneVideoMultipart,
  completeStandaloneVideoMultipart,
  abortStandaloneVideoMultipart,
  getStandaloneVideoStreamUrl,
  deleteStandaloneVideoFile,
  type StandaloneVideo,
  getVideoLinkPreview,
  type VideoLinkPreview,
  getVideoShareLink,
  getPlaylistShareLink,
  getLearnInit,
  getLearnInitLivestream,
  deleteWorkshopRecording,
  updateWorkshopRecording,
  uploadFile,
  getCombPlanForItem,
  type CombPlan,
} from "@/lib/feed-api";
import { ProductEmailAlertsSection } from "@/components/dashboard/products/ProductEmailAlertsSection";
import { FounderAlertsSection } from "@/components/dashboard/products/FounderAlertsSection";
import { useFounderAlerts } from "@/components/dashboard/products/useFounderAlerts";
import { useEmailAlerts } from "@/components/dashboard/products/useEmailAlerts";
// Reused editor drawer — same component Products use. `itemType` gates
// which BE endpoint the save calls.
import ProductThankYouPageEditor from "@/components/dashboard/ProductThankYouPageEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { CurrencyDropdown } from "./WorkshopsPage";
import { ChannelMultiSelect } from "@/components/shared/ChannelMultiSelect";
import { PlatformCouponInput } from "@/components/ui/platform-coupon-input";
import { Tag } from "lucide-react";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ReservesPanel } from "./ReservesPanel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// useAmIFounder removed — founder status is now derived from /learn/init response
// to eliminate the /auth/me waterfall (~400ms saved on page load)
import {
  CommissionPlanSection,
  saveCommissionPlan,
  CompPlanDisplay,
  CompPlanBadge,
} from "./CommissionPlanSection";
import { api, API_URL } from "@/lib/api";
import { getPageCache, setPageCache, invalidatePageCache } from "@/lib/revenue-network-cache";
import {
  getYouTubeEmbedUrl,
  getVimeoEmbedUrl,
  getYouTubeThumbnail,
  isYouTubeUrl,
  fetchYouTubeOEmbed,
  type YouTubeOEmbed,
} from "@/lib/videoUrl";
import DescriptionEditor from "./DescriptionEditor";
import CustomVideoPlayer from "./CustomVideoPlayer";
import { sanitizeDescription } from "@/lib/sanitizeDescription";
import { CardRatingRow, RatingsReviewsCard } from "@/components/reviews";
import { useRatingSummaries } from "@/lib/hooks/useRatingSummaries";
import type { RatingSummary } from "@/lib/reviews-api";
import { MAX_LEARNING_POINTS, limitReachedLabel } from "@/lib/form-limits";
import { getBrandHex } from "@/lib/brand-color-context";
import {
  formatSellablePrice,
  garageStorefrontUrl,
  showSellablePublished,
} from "@/components/shared/SellablePublishedModal";

/** The share popup for a course that was just created or published. */
function announceCourse(course: Course, draft: boolean) {
  const sections = course.sections?.length || 0;
  const lessons =
    course.totalChapters ||
    (course.sections || []).reduce((n, s) => n + (s.chapters?.length || 0), 0);
  showSellablePublished({
    kind: "course",
    title: course.title,
    image: course.coverImage,
    url: garageStorefrontUrl("course", course._id),
    price: formatSellablePrice(course.isPaid ? course.price : 0, course.currency),
    facts: [
      lessons > 0 && `${lessons} lesson${lessons === 1 ? "" : "s"}`,
      sections > 0 && `${sections} section${sections === 1 ? "" : "s"}`,
    ],
    draft,
  });
}

// JsonSyntaxHighlight: lightweight zero-dependency JSON syntax highlighter
function JsonSyntaxHighlight({ code }: { code: string }) {
  const tokens: React.ReactNode[] = [];
  // [ \t]* instead of \s* — critical: prevents eating newlines when a string
  // value has no colon after it, which caused blank lines in the viewer.
  const regex = /("(?:[^"\\]|\\.)*")[ \t]*(:)?|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([\{\}\[\],])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(<span key={`ws-${i++}`}>{code.slice(lastIndex, match.index)}</span>);
    }
    const [full, strToken, colon, keyword, number, punct] = match;
    if (strToken !== undefined) {
      if (colon !== undefined) {
        tokens.push(<span key={`k-${i++}`} style={{ color: "#79c0ff" }}>{strToken}</span>);
        tokens.push(<span key={`c-${i++}`} style={{ color: "#c9d1d9" }}>:</span>);
      } else {
        tokens.push(<span key={`s-${i++}`} style={{ color: "#a5d6ff" }}>{strToken}</span>);
      }
    } else if (keyword !== undefined) {
      tokens.push(<span key={`kw-${i++}`} style={{ color: keyword === "null" ? "#ff7b72" : "#f47067" }}>{keyword}</span>);
    } else if (number !== undefined) {
      tokens.push(<span key={`n-${i++}`} style={{ color: "#ffa657" }}>{number}</span>);
    } else if (punct !== undefined) {
      tokens.push(<span key={`p-${i++}`} style={{ color: "#8b949e" }}>{punct}</span>);
    } else {
      tokens.push(<span key={`o-${i++}`}>{full}</span>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < code.length) {
    tokens.push(<span key={`tail-${i++}`}>{code.slice(lastIndex)}</span>);
  }
  return <>{tokens}</>;
}

// Helper: format minutes to display string
function formatMinutes(mins: number): string {
  if (mins < 1) return "0m";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Helper: format seconds to HH:MM:SS
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


// LiveTimer: counts up from a startedAt timestamp
function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <>{formatDuration(elapsed)}</>;
}

// PlaylistFormContent: Form for creating/editing playlists (used inside modal)
// Categorized video picker with 3 tabs: Livestream, Uploaded Videos, Course Videos
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

interface CoursesPageProps {
  initialSection?: "courses" | "analytics" | "enrolled" | "reserves" | "students";
  viewRole?: "customer" | "founder";
}

export function CoursesPage({ initialSection = "courses", viewRole }: CoursesPageProps = {}) {
  // Founder status derived from /learn/init response — no separate /auth/me call needed
  const [isFounder, setIsFounder] = useState(false);
  const isFounderMode = viewRole === "founder";
  const [courses, setCourses] = useState<Course[]>([]);
  // One batched request for every visible course card's rating.
  const ratingSummaries = useRatingSummaries(
    "course",
    courses.map((c) => c._id)
  );
  const [enrollments, setEnrollments] = useState<Map<string, CourseEnrollment>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [openingRecording, setOpeningRecording] = useState<string | null>(null);


  const [affiliateId, setAffiliateId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "enrolled" | "available" | "draft" | "published"
  >("all");
  const [activeSection, setActiveSection] = useState<"courses" | "playlists" | "reserves" | "analytics" | "enrolled" | "students">(initialSection);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
      setViewingCourse(null);
      setSelectedChapter(null);
    }
  }, [initialSection]);

  useEffect(() => {
    const handleTabClickEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetValue = customEvent.detail?.value;
      
      setViewingCourse(null);
      setSelectedChapter(null);
      
      if (targetValue === "Learn" || targetValue === "Courses") {
        setActiveSection("courses");
      } else if (targetValue === "Courses:Enrolled") {
        setActiveSection("enrolled");
      } else if (targetValue === "Courses:Analytics") {
        setActiveSection("analytics");
      } else if (targetValue === "Courses:Reserves") {
        setActiveSection("reserves");
      }
    };

    window.addEventListener("courses:tab-clicked", handleTabClickEvent);
    return () => {
      window.removeEventListener("courses:tab-clicked", handleTabClickEvent);
    };
  }, []);

  // Deep-link support: layout.tsx dispatches this after ?openApp=course&
  // courseId=... routes here. Fires after courses:tab-clicked (above) has
  // already reset viewingCourse, so it always wins the race.
  useEffect(() => {
    const handleOpenCourseEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        courseId?: string;
        goToLearning?: boolean;
      }>;
      const courseId = customEvent.detail?.courseId;
      // Learn view by default — that's the "Continue learning" deep link this
      // was built for. The Discover deep link passes false: it's for a course
      // the buyer hasn't paid for yet, where jumping to the player would be
      // asking for lessons they don't have access to.
      if (courseId)
        openCourseDetail(
          { _id: courseId } as Course,
          customEvent.detail?.goToLearning !== false
        );
    };

    window.addEventListener("courses:open-course", handleOpenCourseEvent);
    return () => {
      window.removeEventListener("courses:open-course", handleOpenCourseEvent);
    };
  }, []);

  // Standalone video state
  const [standaloneVideos, setStandaloneVideos] = useState<StandaloneVideo[]>([]);
  const [standaloneVideosLoading, setStandaloneVideosLoading] = useState(false);
  const [showUploadVideoModal, setShowUploadVideoModal] = useState(false);
  const [editingStandaloneVideo, setEditingStandaloneVideo] = useState<StandaloneVideo | null>(null);
  const [showDeleteVideoConfirm, setShowDeleteVideoConfirm] = useState<string | null>(null);
  const [playingStandaloneVideo, setPlayingStandaloneVideo] = useState<StandaloneVideo | null>(null);
  const [standaloneStreamUrl, setStandaloneStreamUrl] = useState<string | null>(null);

  // Playlist state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [viewingPlaylist, setViewingPlaylist] = useState<Playlist | null>(null);
  const [showDeletePlaylistConfirm, setShowDeletePlaylistConfirm] = useState<string | null>(null);
  const [showDeleteWorkshopConfirm, setShowDeleteWorkshopConfirm] = useState<string | null>(null);
  const [deletingWorkshop, setDeletingWorkshop] = useState(false);
  // Founder-only "edit recording details" dialog. Holds the card id
  // (`workshopId__recordingId`) being edited plus the in-progress field
  // values; null when closed.
  const [editingRecording, setEditingRecording] = useState<{
    cardId: string;
    title: string;
    description: string;
    /** Currently-saved-or-in-progress thumbnail URL. */
    thumbnail: string;
  } | null>(null);
  const [savingRecordingEdit, setSavingRecordingEdit] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [addToPlaylistWorkshopId, setAddToPlaylistWorkshopId] = useState<string | null>(null);
  const [playlistPlayingVideo, setPlaylistPlayingVideo] = useState<PlaylistVideo | null>(null);
  const [playlistStreamUrl, setPlaylistStreamUrl] = useState<string | null>(null);

  // Unified share state — tracks loading/copied for videos, workshops, and playlists
  const [shareStates, setShareStates] = useState<Record<string, "idle" | "loading" | "copied">>({});

  // Students tab state
  const [adminEnrollments, setAdminEnrollments] = useState<any[]>([]);
  const [loadingAdminEnrollments, setLoadingAdminEnrollments] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  const handleShare = async (
    id: string,
    type: "video" | "playlist",
    videoType?: "standalone" | "workshop"
  ) => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId || shareStates[id] === "loading" || shareStates[id] === "copied") return;

    // Playlist-specific: warn if not published
    if (type === "playlist") {
      const playlist = playlists.find((p) => p._id === id);
      if (playlist && !playlist.isPublished) {
        toast.warning("This playlist is not published yet. Enable 'Publish for Learners' first so others can view it.");
        return;
      }
    }

    setShareStates(prev => ({ ...prev, [id]: "loading" }));
    try {
      const { shareLink } = type === "playlist"
        ? await getPlaylistShareLink(id, orgId)
        : await getVideoShareLink(id, orgId, videoType!);
      await navigator.clipboard.writeText(shareLink);
      setShareStates(prev => ({ ...prev, [id]: "copied" }));
      toast.success("Share link copied! Anyone who joins through this link will be added to your network.");
      setTimeout(() => setShareStates(prev => ({ ...prev, [id]: "idle" })), 2000);
    } catch {
      toast.error("Failed to copy share link");
      setShareStates(prev => ({ ...prev, [id]: "idle" }));
    }
  };

  // Course detail/edit view state
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<{
    sectionId: string;
    chapterId: string;
  } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  const pageRef = useRef<HTMLDivElement>(null);
  // Remember which tab the user was on before opening a course detail view
  const previousSectionRef = useRef<typeof activeSection>(activeSection);

  // Reset scroll container to top when viewing course details opens
  useEffect(() => {
    if (viewingCourse && pageRef.current) {
      let parent = pageRef.current.parentElement;
      while (parent) {
        if (parent.scrollHeight > parent.clientHeight) {
          parent.scrollTop = 0;
        }
        parent = parent.parentElement;
      }
    }
  }, [viewingCourse]);

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
    } else if (viewingCourse) {
      items.push({
        label: viewingCourse.title,
        key: "course-detail",
      });
      if (selectedChapter) {
        const currentSection = viewingCourse.sections?.find(s => s._id === selectedChapter.sectionId);
        const currentChapter = currentSection?.chapters?.find(c => c._id === selectedChapter.chapterId);
        if (currentChapter) {
          items.push({
            label: currentChapter.title,
            key: "course-chapter",
          });
        }
      }
    }

    window.dispatchEvent(
      new CustomEvent("workspace:set-breadcrumbs", {
        detail: { items },
      })
    );
  }, [playingStandaloneVideo, viewingPlaylist, playlistPlayingVideo, viewingCourse, selectedChapter]);

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
        setViewingCourse(null);
        setEditingCourse(null);
        setSelectedChapter(null);
        setExpandedSections(new Set());
      } else if (key === "playlist-detail") {
        setPlaylistPlayingVideo(null);
        setPlaylistStreamUrl(null);
      } else if (key === "course-detail") {
        setSelectedChapter(null);
      }
    };

    window.addEventListener("workspace:breadcrumb-click", handleBreadcrumbClick as EventListener);
    return () => {
      window.removeEventListener("workspace:breadcrumb-click", handleBreadcrumbClick as EventListener);
    };
  }, []);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const handleOpenCreate = () => {
      setShowCreateModal(true);
      setEditingCourse(null);
    };
    window.addEventListener("courses:open-create-modal", handleOpenCreate);
    return () => {
      window.removeEventListener("courses:open-create-modal", handleOpenCreate);
    };
  }, []);

  useEffect(() => {
    const isFormVisible = showCreateModal || !!editingCourse || showCreatePlaylistModal || !!editingRecording || !!viewingCourse;
    if (isFormVisible) {
      window.dispatchEvent(new CustomEvent("bottom-tab:hide"));
    } else {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("bottom-tab:show"));
    };
  }, [showCreateModal, editingCourse, showCreatePlaylistModal, editingRecording, viewingCourse]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [purchasingCourseId, setPurchasingCourseId] = useState<string | null>(
    null
  );
  // Checkout state. `showPaymentSelector` toggles the right-side drawer
  // that hosts <PaymentMethodSelector> inline. The iframe branch of this
  // modal (previously togglable via ?checkout=iframe) was removed in
  // favor of the unified drawer pattern used by ChannelPaymentModalNew,
  // WebinarPreJoin, WorkshopsPage, and ProductsPage.
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [paymentOrderData, setPaymentOrderData] = useState<{ key?: string; currency?: string } | null>(null);
  const [paymentCourse, setPaymentCourse] = useState<Course | null>(null);
  const [discountedTotalCents, setDiscountedTotalCents] = useState<number | null>(null);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);

  // Fetch all page data via consolidated endpoint — fires IMMEDIATELY on mount.
  // The backend resolves founder status and returns isFounder in the response.
  // Cache pre-fills state so the skeleton→UI transition is instant, but we
  // NEVER show role-dependent UI until the API confirms isFounder.
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Pre-fill state from cache so data is ready when loading completes.
      // We do NOT set loading=false here — the skeleton stays until the API
      // returns with the confirmed isFounder to prevent role-flash.
      const cachedFounder = getPageCache<{ courses: typeof courses; enrollments: [string, CourseEnrollment][] }>("courses:founder");
      const cachedStakeholder = getPageCache<{ courses: typeof courses; enrollments: [string, CourseEnrollment][] }>("courses:stakeholder");
      const cached = cachedFounder || cachedStakeholder;
      if (cached) {
        setCourses(cached.courses);
        if (cached.enrollments) setEnrollments(new Map(cached.enrollments));
      }

      try {
        // Lightweight API call — returns course summaries + isFounder.
        const initData = await getLearnInit();

        // Set founder status from API response — this is the ONLY source of truth
        setIsFounder(initData.isFounder);
        setCourses(initData.courses);

        const cacheKey = `courses:${initData.isFounder ? "founder" : "stakeholder"}`;

        // Build enrollment map for quick lookup (only for learners)
        if (!initData.isFounder && initData.enrollments) {
          const enrollmentMap = new Map<string, CourseEnrollment>();
          initData.enrollments.forEach((e: any) => {
            const courseId =
              typeof e.courseId === "string" ? e.courseId : e.courseId._id;
            enrollmentMap.set(courseId, e);
          });
          setEnrollments(enrollmentMap);
          setPageCache(cacheKey, {
            courses: initData.courses,
            enrollments: [...enrollmentMap.entries()],
          });
        } else {
          setPageCache(cacheKey, {
            courses: initData.courses,
            enrollments: [],
          });
        }
      } catch (error) {
        console.error("Error fetching courses:", error);
        if (!cached) toast.error("Failed to load courses");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch admin enrollments when section is "students"
  useEffect(() => {
    if (activeSection !== "students") return;

    const fetchAdminEnrollments = async () => {
      setLoadingAdminEnrollments(true);
      try {
        const res = await getAdminCourseEnrollments(selectedCourseId === "all" ? undefined : selectedCourseId);
        if (res.success) {
          setAdminEnrollments(res.enrollments);
        } else {
          toast.error("Failed to load enrolled students");
        }
      } catch (error) {
        console.error("Error fetching admin enrollments:", error);
        toast.error("Failed to load enrolled students");
      } finally {
        setLoadingAdminEnrollments(false);
      }
    };

    fetchAdminEnrollments();
  }, [activeSection, selectedCourseId]);

  // Study stats for learner dashboard
  const [studyStats, setStudyStats] = useState<StudyStats | null>(null);

  // Fetch study stats when founder status is known (from /learn/init response)
  useEffect(() => {
    if (!loading && !isFounderMode) {
      getStudyStats()
        .then(setStudyStats)
        .catch((err) => console.error("Error fetching study stats:", err));
    }
  }, [loading, isFounderMode]);

  // Fetch affiliate ID on mount (independent, no founder gating needed)
  useEffect(() => {
    const fetchAffiliateId = async () => {
      try {
        const response = await api<{
          success: boolean;
          affiliateId: string | null;
          hasAffiliateId: boolean;
        }>("/affiliate/my-affiliate-id", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });

        if (response.success && response.affiliateId) {
          setAffiliateId(response.affiliateId);
        }
      } catch (error) {
        console.error("Error fetching affiliate ID:", error);
      }
    };

    fetchAffiliateId();
  }, []);



  // Fetch playlists when playlists tab is activated
  const fetchPlaylists = async () => {
    setPlaylistsLoading(true);
    try {
      const data = await getPlaylists();
      setPlaylists(data.playlists || []);
    } catch (error) {
      console.error("Error fetching playlists:", error);
    } finally {
      setPlaylistsLoading(false);
    }
  };


  // Note: Video and Playlist tabs have been moved to ContentPage

  // Handle creating a new playlist
  const handleCreatePlaylist = async (data: {
    title: string;
    description?: string;
    isPublished?: boolean;
    videoEntries?: PlaylistVideoEntry[];
  }) => {
    try {
      const result = await createPlaylist(data);
      setPlaylists((prev) => [result.playlist, ...prev]);
      setShowCreatePlaylistModal(false);
      setEditingPlaylist(null);
      toast.success("Playlist created successfully!");
    } catch (error: any) {
      console.error("Error creating playlist:", error);
      toast.error(error.message || "Failed to create playlist");
    }
  };

  // Handle updating a playlist
  const handleUpdatePlaylist = async (
    playlistId: string,
    data: Partial<{
      title: string;
      description: string;
      isPublished: boolean;
      videoEntries: PlaylistVideoEntry[];
    }>
  ) => {
    try {
      const result = await updatePlaylistApi(playlistId, data);
      setPlaylists((prev) =>
        prev.map((p) => (p._id === playlistId ? result.playlist : p))
      );
      if (viewingPlaylist?._id === playlistId) {
        setViewingPlaylist(result.playlist);
      }
      setEditingPlaylist(null);
      toast.success("Playlist updated!");
    } catch (error: any) {
      console.error("Error updating playlist:", error);
      toast.error(error.message || "Failed to update playlist");
    }
  };

  // Handle deleting a playlist
  const handleDeletePlaylist = async (playlistId: string) => {
    try {
      await deletePlaylistApi(playlistId);
      setPlaylists((prev) => prev.filter((p) => p._id !== playlistId));
      if (viewingPlaylist?._id === playlistId) {
        setViewingPlaylist(null);
      }
      setShowDeletePlaylistConfirm(null);
      toast.success("Playlist deleted!");
    } catch (error: any) {
      console.error("Error deleting playlist:", error);
      toast.error(error.message || "Failed to delete playlist");
    }
  };

  // Handle deleting a Live Stream recording card.
  // Backend returns compound IDs shaped as `${workshopId}__${recordingId}`;
  // we pass both to the DELETE endpoint so it can verify + clean up S3.
  const handleDeleteWorkshopRecording = async (compoundId: string) => {
    const parts = compoundId.split("__");
    if (parts.length !== 2) {
      toast.error("Cannot delete: invalid recording id");
      return;
    }
    const [workshopId, recordingId] = parts;
    setDeletingWorkshop(true);
    try {
      await deleteWorkshopRecording(workshopId, recordingId);
      setCompletedWorkshops((prev) => prev.filter((w) => w._id !== compoundId));
      setShowDeleteWorkshopConfirm(null);
      toast.success("Recording deleted");
    } catch (error: any) {
      console.error("Error deleting recording:", error);
      toast.error(error.message || "Failed to delete recording");
    } finally {
      setDeletingWorkshop(false);
    }
  };

  // Save a founder's per-recording display title / description / thumbnail
  // override. Mirrors the delete handler — the live-stream card uses a
  // compound `${workshopId}__${recordingId}` id so we can split + call the
  // PATCH endpoint, then patch the local state in place.
  const handleSaveRecordingEdit = async () => {
    if (!editingRecording) return;
    const parts = editingRecording.cardId.split("__");
    if (parts.length !== 2) {
      toast.error("Cannot save: invalid recording id");
      return;
    }
    const [workshopId, recordingId] = parts;
    setSavingRecordingEdit(true);
    try {
      const res = await updateWorkshopRecording(workshopId, recordingId, {
        displayTitle: editingRecording.title,
        displayDescription: editingRecording.description,
        displayThumbnail: editingRecording.thumbnail,
      });
      if (!res.success) {
        toast.error(res.error || "Failed to save");
        return;
      }
      setCompletedWorkshops((prev) =>
        prev.map((w) =>
          w._id === editingRecording.cardId
            ? {
                ...w,
                title: editingRecording.title.trim() || w.title,
                description:
                  editingRecording.description.trim() || w.description,
                thumbnail:
                  editingRecording.thumbnail.trim() || w.thumbnail,
              }
            : w
        )
      );
      setEditingRecording(null);
      toast.success("Recording updated");
    } catch (err: any) {
      console.error("Error updating recording:", err);
      toast.error(err.message || "Failed to update recording");
    } finally {
      setSavingRecordingEdit(false);
    }
  };

  // Upload a new thumbnail image and store its URL on the in-progress
  // edit state. The save button then PATCHes it onto the recording.
  const handleThumbnailUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    setUploadingThumbnail(true);
    try {
      const res = await uploadFile(file);
      if (!res?.url) {
        toast.error("Upload failed");
        return;
      }
      setEditingRecording((prev) =>
        prev ? { ...prev, thumbnail: res.url } : prev
      );
      toast.success("Thumbnail uploaded");
    } catch (err: any) {
      console.error("Thumbnail upload error:", err);
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingThumbnail(false);
    }
  };

  // Handle adding a video to a playlist (founder flow with dropdown)
  const handleAddVideoToPlaylist = async (
    playlistId: string,
    videoEntry: PlaylistVideoEntry
  ) => {
    try {
      const result = await addVideosToPlaylist(playlistId, [videoEntry]);
      setPlaylists((prev) =>
        prev.map((p) => (p._id === playlistId ? result.playlist : p))
      );

      toast.success("Video added to playlist!");
    } catch (error: any) {
      console.error("Error adding video to playlist:", error);
      toast.error(error.message || "Failed to add video");
    }
  };

  // Learner one-click: auto-creates "My Playlist" and adds video
  const handleLearnerQuickAdd = async (videoEntry: PlaylistVideoEntry) => {
    try {
      const result = await quickAddToPlaylist(videoEntry);
      // Update playlists state with the returned playlist
      if (result.playlist) {
        setPlaylists((prev) => {
          const idx = prev.findIndex((p) => p._id === result.playlist._id);
          if (idx >= 0) {
            return prev.map((p) => (p._id === result.playlist._id ? result.playlist : p));
          }
          return [result.playlist, ...prev];
        });
      }
      toast.success("Added to My Playlist!");
    } catch (error: any) {
      console.error("Error adding to playlist:", error);
      toast.error(error.message || "Failed to add to playlist");
    }
  };

  // Handle removing a video from a playlist
  const handleRemoveVideoFromPlaylist = async (
    playlistId: string,
    videoId: string,
    videoSource?: string
  ) => {
    try {
      const result = await removeVideoFromPlaylist(playlistId, videoId, videoSource);
      setPlaylists((prev) =>
        prev.map((p) => (p._id === playlistId ? result.playlist : p))
      );
      if (viewingPlaylist?._id === playlistId) {
        setViewingPlaylist(result.playlist);
      }
      toast.success("Video removed from playlist!");
    } catch (error: any) {
      console.error("Error removing video:", error);
      toast.error(error.message || "Failed to remove video");
    }
  };

  // Open playlist detail view with populated videos
  const openPlaylistDetail = async (playlist: Playlist) => {
    try {
      const data = await getPlaylist(playlist._id);
      setViewingPlaylist(data.playlist);
    } catch (error) {
      console.error("Error fetching playlist:", error);
      toast.error("Failed to load playlist");
    }
  };

  // Filter courses
  const filteredCourses = courses.filter((course) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        course.title.toLowerCase().includes(query) ||
        course.description?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Status filter for founder
    if (isFounderMode) {
      if (selectedFilter === "draft" && course.status !== "draft") return false;
      if (selectedFilter === "published" && course.status !== "published")
        return false;
    } else {
      // Enrollment filter for stakeholder
      const enrollment = enrollments.get(course._id);
      if (selectedFilter === "enrolled" && !enrollment) return false;
      if (selectedFilter === "available" && enrollment) return false;
    }

    return true;
  });

  // Open course detail view.
  // goToLearning=true → immediately opens the player and jumps to the next
  // lesson the user needs to watch (first incomplete chapter).
  // goToLearning=false → shows the product info/detail page (no chapter auto-selected).
  const openCourseDetail = async (course: Course, goToLearning = false) => {
    // Remember which tab we came from so Back can restore it
    previousSectionRef.current = activeSection;

    try {
      // Fetch full course + fresh enrollment in parallel for accuracy
      const [fullCourse, freshEnrollment] = await Promise.all([
        getCourse(course._id),
        goToLearning ? getCourseEnrollment(course._id).catch(() => null) : Promise.resolve(null),
      ]);

      // Keep the enrollment map up-to-date if we fetched a fresh copy
      if (freshEnrollment) {
        setEnrollments((prev) => new Map(prev).set(course._id, freshEnrollment));
      }

      setViewingCourse(fullCourse);

      // Expand all sections in the sidebar
      if (fullCourse.sections) {
        setExpandedSections(new Set(fullCourse.sections.map((s) => s._id)));

        if (goToLearning && fullCourse.sections.length > 0) {
          // Use the freshly-fetched enrollment (most accurate chaptersProgress)
          // falling back to the cached map value
          const enrollment = freshEnrollment ?? enrollments.get(course._id);

          if (enrollment) {
            // Flat ordered list of every chapter across all sections
            const allChapters = fullCourse.sections.flatMap((s) =>
              (s.chapters || []).map((c) => ({
                sectionId: s._id,
                chapterId: c._id,
              }))
            );

            // Returns true if a chapter has been marked complete
            const isCompleted = (chapterId: string) =>
              enrollment.chaptersProgress?.some(
                (p) => p.chapterId === chapterId && p.completed
              ) ?? false;

            const lastSectionId = enrollment.lastSectionId;
            const lastChapterId = enrollment.lastChapterId;

            // Check whether the stored last-accessed chapter still exists
            const lastChapterExists =
              lastSectionId &&
              lastChapterId &&
              fullCourse.sections
                .find((s) => s._id === lastSectionId)
                ?.chapters?.some((c) => c._id === lastChapterId);

            if (lastChapterExists && lastSectionId && lastChapterId) {
              if (isCompleted(lastChapterId)) {
                // Last chapter was already finished → jump to first incomplete after it
                const lastIdx = allChapters.findIndex((c) => c.chapterId === lastChapterId);
                const nextIncomplete = allChapters
                  .slice(lastIdx + 1)
                  .find((c) => !isCompleted(c.chapterId));

                setSelectedChapter(
                  nextIncomplete ?? { sectionId: lastSectionId, chapterId: lastChapterId }
                );
              } else {
                // Resume from where they stopped
                setSelectedChapter({ sectionId: lastSectionId, chapterId: lastChapterId });
              }
            } else {
              // No last-accessed chapter → pick the first incomplete one
              const firstIncomplete = allChapters.find((c) => !isCompleted(c.chapterId));
              const fallback = allChapters[0];
              if (firstIncomplete ?? fallback) {
                setSelectedChapter((firstIncomplete ?? fallback)!);
              }
            }
          } else if (
            fullCourse.sections[0]?.chapters?.length
          ) {
            // No enrollment data at all → start from chapter 1
            setSelectedChapter({
              sectionId: fullCourse.sections[0]._id,
              chapterId: fullCourse.sections[0].chapters[0]._id,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error fetching course:", error);
      toast.error("Failed to load course details");
    }
  };

  // Close course detail view — restore the section the user came from
  const closeCourseDetail = () => {
    setViewingCourse(null);
    setEditingCourse(null);
    setSelectedChapter(null);
    setExpandedSections(new Set());
    // Restore the tab the user was on before entering the course detail
    setActiveSection(previousSectionRef.current);
  };

  // Handle course enrollment (free courses)
  const handleEnroll = async (course: Course) => {
    try {
      const enrollment = await enrollInCourse(course._id);
      setEnrollments((prev) => new Map(prev).set(course._id, enrollment));
      toast.success("Successfully enrolled in course!");
      openCourseDetail(course, true);
    } catch (error: any) {
      console.error("Error enrolling:", error);
      toast.error(error.message || "Failed to enroll in course");
    }
  };

  // Load Razorpay SDK
  const loadRazorpayScript = async (): Promise<boolean> => {
    const windowWithRazorpay = window as { Razorpay?: unknown };
    if (windowWithRazorpay.Razorpay) return true;

    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }

    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        if (windowWithRazorpay.Razorpay) resolve(true);
        else if (attempts >= 50) resolve(false);
        else {
          attempts++;
          setTimeout(check, 100);
        }
      };
      check();
    });
  };

  // Handle paid course purchase — opens the inline right-side checkout
  // drawer that hosts <PaymentMethodSelector> + <PlatformCouponInput>
  // and dispatches to handlePaymentInitiated → verifyCoursePayment on
  // Razorpay success.
  //
  // `opts.forReserve` + `opts.quantity` support the buy-to-assign flow:
  // founder pays for N seats up-front and each becomes an unassigned
  // ItemReserveLicense. Fulfillment at services/invoice.ts:2145 mints the
  // licenses when qty > 1 (buyer is NOT auto-enrolled in that case).
  const handlePaidEnroll = async (
    course: Course,
    opts?: { quantity?: number; forReserve?: boolean },
  ) => {
    setPurchasingCourseId(course._id);
    try {
      // 1. Create invoice + Razorpay order.
      const orderData = await createCourseRazorpayOrder(course._id, opts);

      // Preferred path — BE returned an invoiceId → open the shared invoice
      // iframe. Every one-time course purchase reaches this branch today.
      if (orderData.invoiceId) {
        setInvoiceId(orderData.invoiceId);
        setPaymentOrderData({
          key: orderData.key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          currency: orderData.currency || orderData.order?.currency || "INR",
        });
        setPaymentCourse(course);
        setShowPaymentSelector(true);
        setPurchasingCourseId(null);
        return;
      }
      // Fallback (defensive) — if a future flow returns no invoiceId
      // (e.g. subscription-course path that doesn't create an Invoice
      // document), keep the legacy inline Razorpay open so users are not
      // stranded. This branch will disappear once every course purchase
      // route is invoice-backed.

      // 2. Load Razorpay SDK
      const razorpayLoaded = await loadRazorpayScript();
      if (!razorpayLoaded) {
        throw new Error("Failed to load payment gateway");
      }

      const windowWithRazorpay = window as { Razorpay?: any };
      if (!windowWithRazorpay.Razorpay) {
        throw new Error("Payment gateway not available");
      }

      // 3. Open Razorpay checkout
      const rzp = new windowWithRazorpay.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        order_id: orderData.order.id,
        name: "Course Enrollment",
        description: `Enroll in: ${course.title}`,
        image: course.coverImage,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // 4. Verify payment
            const verifyResult = await verifyCoursePayment(course._id, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            if (verifyResult.success) {
              setEnrollments((prev) =>
                new Map(prev).set(course._id, verifyResult.enrollment)
              );
              toast.success("Successfully enrolled in course!");
              setActiveSection("enrolled");
              openCourseDetail(course, true);
            } else {
              toast.error("Payment verification failed");
            }
          } catch (error) {
            console.error("Payment verification error:", error);
            toast.error("Payment verification failed. Please contact support.");
          } finally {
            setPurchasingCourseId(null);
          }
        },
        modal: {
          ondismiss: () => {
            setPurchasingCourseId(null);
          },
        },
        theme: { color: getBrandHex() },
      });

      rzp.open();
    } catch (error: any) {
      console.error("Purchase failed:", error);
      toast.error(error.message || "Failed to process purchase");
      setPurchasingCourseId(null);
    }
  };

  // Full reset of every drawer-scoped piece of state. Used by both success
  // paths (wallet/stripe/razorpay-verify) AND the cancel/close handlers so
  // a completed purchase doesn't leak coupon or invoice state into the
  // NEXT purchase drawer opened in the same session (previously the
  // "Coupon X applied" banner would still render and PaymentMethodSelector
  // received the previous course's discountedTotalCents).
  const resetCheckoutDrawerState = () => {
    setShowPaymentSelector(false);
    setInvoiceId(null);
    setPaymentOrderData(null);
    setPaymentCourse(null);
    setDiscountedTotalCents(null);
    setAppliedCouponCode(null);
    setPurchasingCourseId(null);
  };

  // Called by PaymentMethodSelector after user selects currency + method
  const handlePaymentInitiated = async (data: {
    razorpayOrderId?: string;
    razorpayKeyId?: string;
    razorpaySubscriptionId?: string;
    shortUrl?: string;
    cryptoPaymentUrl?: string;
    walletPaid?: boolean;
    stripePaid?: boolean;
    amount: number;
    currency: string;
    invoiceId: string;
  }) => {
    if (data.walletPaid || data.stripePaid) {
      toast.success("Successfully enrolled in course!");
      resetCheckoutDrawerState();
      return;
    }
    if (data.cryptoPaymentUrl) {
      window.open(data.cryptoPaymentUrl, "_blank");
      toast.info("Complete your crypto payment in the new tab. The invoice will update automatically once confirmed.");
      setPurchasingCourseId(null);
      return;
    }

    const course = paymentCourse;
    if (!course) return;

    try {
      setPurchasingCourseId(course._id);

      // If we got a short URL (e.g. for crypto), redirect
      if (data.shortUrl) {
        window.open(data.shortUrl, "_blank");
        setPurchasingCourseId(null);
        return;
      }

      const key = data.razorpayKeyId || paymentOrderData?.key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!key) throw new Error("Missing Razorpay key");

      // Load Razorpay SDK
      const razorpayLoaded = await loadRazorpayScript();
      if (!razorpayLoaded) throw new Error("Failed to load payment gateway");

      const windowWithRazorpay = window as { Razorpay?: any };
      if (!windowWithRazorpay.Razorpay) throw new Error("Payment gateway not available");

      const rzp = new windowWithRazorpay.Razorpay({
        key,
        amount: data.amount,
        currency: data.currency,
        order_id: data.razorpayOrderId || "",
        subscription_id: data.razorpaySubscriptionId,
        name: "Course Enrollment",
        description: `Enroll in: ${course.title}`,
        image: course.coverImage,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyResult = await verifyCoursePayment(course._id, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            if (verifyResult.success) {
              setEnrollments((prev) =>
                new Map(prev).set(course._id, verifyResult.enrollment)
              );
              toast.success("Successfully enrolled in course!");
              resetCheckoutDrawerState();
              setActiveSection("enrolled");
              openCourseDetail(course, true);
            } else {
              toast.error("Payment verification failed");
            }
          } catch (error) {
            console.error("Payment verification error:", error);
            toast.error("Payment verification failed. Please contact support.");
          } finally {
            setPurchasingCourseId(null);
          }
        },
        modal: {
          ondismiss: () => {
            setPurchasingCourseId(null);
          },
        },
        theme: { color: getBrandHex() },
      });

      rzp.open();
    } catch (error: any) {
      console.error("Payment initiation failed:", error);
      toast.error(error.message || "Payment initiation failed");
      setPurchasingCourseId(null);
    }
  };

  // Handle course card action
  const handleCourseAction = (course: Course) => {
    if (isFounderMode) {
      openCourseEdit(course);
    } else {
      // Always open the product info page when clicking from the discover section.
      // Only switch to the enrolled section (learning page) when the user is
      // already viewing the enrolled tab — clicking from discover should show
      // the product info page regardless of enrollment status.
      openCourseDetail(course);
    }
  };

  // Open course edit view (founder)
  const openCourseEdit = async (course: Course) => {
    try {
      const fullCourse = await getCourse(course._id);
      setEditingCourse(fullCourse);

      if (fullCourse.sections) {
        const allSectionIds = fullCourse.sections.map((s) => s._id);
        setExpandedSections(new Set(allSectionIds));
      }
    } catch (error) {
      console.error("Error fetching course:", error);
      toast.error("Failed to load course details");
    }
  };

  // Handle delete course
  const handleDeleteCourse = async (courseId: string) => {
    try {
      await deleteCourse(courseId);
      invalidatePageCache("courses:");
      setCourses((prev) => prev.filter((c) => c._id !== courseId));
      toast.success("Course deleted successfully");
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting course:", error);
      toast.error("Failed to delete course");
    }
  };

  // Handle clone course
  const handleCloneCourse = async (courseId: string) => {
    const loadingToast = toast.loading("Cloning course...");
    try {
      await cloneCourse(courseId);
      invalidatePageCache("courses:");
      await refreshCourses();
      toast.success("Course cloned successfully", { id: loadingToast });
    } catch (error) {
      console.error("Error cloning course:", error);
      toast.error("Failed to clone course", { id: loadingToast });
    }
  };

  // Refresh courses after create/update
  const refreshCourses = async () => {
    try {
      invalidatePageCache("courses:");
      const coursesData = await getCourses();
      setCourses(coursesData.courses);
      setPageCache(`courses:${isFounder ? "founder" : "stakeholder"}`, { courses: coursesData.courses, enrollments: [] });
    } catch (error) {
      console.error("Error refreshing courses:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full flex-1 w-full flex flex-col bg-[#0a0a0d]">
        <div className="border-b border-[#2a2a35] bg-[#0e0e12] px-6 py-4 animate-pulse">
          <div className="h-6 w-32 bg-[#1a1a22] rounded mb-2" />
          <div className="h-4 w-52 bg-[#1a1a22] rounded" />
        </div>
        <div className="p-6 grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[#0e0e12] border border-[#2a2a35] p-4 animate-pulse space-y-3">
              <div className="h-32 bg-[#1a1a22] rounded-lg" />
              <div className="h-4 bg-[#1a1a22] rounded w-3/4" />
              <div className="h-3 bg-[#1a1a22] rounded w-1/2" />
              <div className="flex justify-between items-center">
                <div className="h-5 bg-[#1a1a22] rounded w-14" />
                <div className="h-8 bg-[#1a1a22] rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }



  // Course Edit View (Founder)
  if (editingCourse && isFounderMode) {
    return (
      <CourseEditView
        course={editingCourse}
        onBack={() => {
          closeCourseDetail();
          refreshCourses();
        }}
        onUpdate={(updated) => setEditingCourse(updated)}
      />
    );
  }

  // ── Reusable Share Button ────────────────────────────────────────
  // Two variants: "default" for video/workshop cards, "small" for playlist cards
  const ShareButton = ({ id, onClick, variant = "default" }: {
    id: string;
    onClick: (e: React.MouseEvent) => void;
    variant?: "default" | "small";
  }) => {
    const state = shareStates[id];
    const iconSize = variant === "small" ? "w-3.5 h-3.5" : "w-4 h-4";
    const btnClass = variant === "small"
      ? `p-1.5 rounded transition-colors ${state === "copied" ? "text-green-400" : "text-[#9fa0b8] hover:text-[#1D9BF0] hover:bg-[#1a1a22]"}`
      : `p-1.5 rounded-lg border border-[#2a2a35] transition-colors ${state === "copied" ? "text-green-400 border-green-400/30" : "text-[#9fa0b8] hover:text-[#1D9BF0] hover:border-[#1D9BF0]/30"}`;
    return (
      <button onClick={onClick} className={btnClass} title="Copy share link">
        {state === "loading" ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : state === "copied" ? (
          <Check className={iconSize} />
        ) : (
          <Send className={iconSize} />
        )}
      </button>
    );
  };

  // Course List View
  return (
    <div 
      ref={pageRef}
      className={cn(
        "w-full min-h-full flex-1 flex flex-col bg-[#0a0a0d]",
        (viewingCourse && !isFounderMode && enrollments.get(viewingCourse._id) && (activeSection === "enrolled" || !!selectedChapter))
          ? "h-[calc(100vh-60px)] overflow-hidden"
          : ""
      )}
    >
      {viewingCourse && !isFounderMode ? (
        <CourseDetailView
          course={viewingCourse}
          enrollment={enrollments.get(viewingCourse._id) || null}
          selectedChapter={selectedChapter}
          setSelectedChapter={setSelectedChapter}
          expandedSections={expandedSections}
          setExpandedSections={setExpandedSections}
          onBack={closeCourseDetail}
          onEnrollmentUpdate={(enrollment) => {
            setEnrollments((prev) =>
              new Map(prev).set(viewingCourse._id, enrollment)
            );
          }}
          onAction={(opts) => {
            const isBuyToAssign = opts?.forReserve;
            if ((viewingCourse.isFree || isFounder) && !isBuyToAssign) {
              handleEnroll(viewingCourse);
            } else {
              handlePaidEnroll(viewingCourse, opts);
            }
          }}
          affiliateId={affiliateId}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          isActualFounder={isFounder}
        />
      ) : (
        <>
      {/* Header Bar Removed */}
      {/* Reserves Section */}
      {activeSection === "reserves" && (
        <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6">
          <div className="max-w-7xl mx-auto">
            <ReservesPanel itemType="course" />
          </div>
        </div>
      )}

      {/* ===== DISCOVER TAB (All Courses) ===== */}
      {activeSection === "courses" && (
        <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto">
          {filteredCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center px-4">
              <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-[#9fa0b8] mb-3 sm:mb-4" />
              <p className="text-sm sm:text-base text-[#9fa0b8]">
                {searchQuery || selectedFilter !== "all"
                  ? "No courses found"
                  : "No courses available"}
              </p>
              {isFounderMode && !searchQuery && selectedFilter === "all" && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-3 sm:mt-4 bg-brand hover:opacity-90 text-brand-foreground text-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Course
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-4 sm:gap-6">
              {filteredCourses.map((course) => (
                <CourseCard
                  key={course._id}
                  course={course}
                  ratingSummary={ratingSummaries[course._id]}
                  enrollment={enrollments.get(course._id)}
                  isFounder={isFounderMode}
                  affiliateId={affiliateId}
                  onAction={() => handleCourseAction(course)}
                  onEdit={() => openCourseEdit(course)}
                  onDelete={() => setShowDeleteConfirm(course._id)}
                  onClone={() => handleCloneCourse(course._id)}
                  purchasing={purchasingCourseId === course._id}
                  isActualFounder={isFounder}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredCourses.map((course) => (
                <CourseCard
                  key={course._id}
                  course={course}
                  ratingSummary={ratingSummaries[course._id]}
                  enrollment={enrollments.get(course._id)}
                  isFounder={isFounderMode}
                  affiliateId={affiliateId}
                  onAction={() => handleCourseAction(course)}
                  onEdit={() => openCourseEdit(course)}
                  onDelete={() => setShowDeleteConfirm(course._id)}
                  onClone={() => handleCloneCourse(course._id)}
                  isListView
                  purchasing={purchasingCourseId === course._id}
                  isActualFounder={isFounder}
                />
              ))}
            </div>
          )}
        </div>
        </div>
      )}

      {/* ===== ANALYTICS TAB (Learner Dashboard) ===== */}
      {activeSection === "analytics" && (
        <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6">
          <div className="max-w-7xl mx-auto">
            {!isFounderMode ? (
              <div className="space-y-6">
                {/* Row 1: Stats Cards + Time Tracker */}
                <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-4 gap-4">
                  {/* Courses Enrolled */}
                  <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-4">
                    <div className="flex items-center gap-2 text-[#9fa0b8] mb-3">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-xs font-medium">Courses Enrolled</span>
                    </div>
                    <p className="text-3xl font-bold text-white">
                      {Array.from(enrollments.values()).filter((e) => e.status !== "dropped").length}
                    </p>
                    <p className="text-xs text-[#9fa0b8] mt-1">Keep learning!</p>
                  </div>

                  {/* Courses Completed */}
                  <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-4">
                    <div className="flex items-center gap-2 text-[#9fa0b8] mb-3">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-medium">Courses Completed</span>
                    </div>
                    <p className="text-3xl font-bold text-white">
                      {Array.from(enrollments.values()).filter((e) => e.status === "completed").length}
                    </p>
                    <p className="text-xs text-[#9fa0b8] mt-1">Great progress!</p>
                  </div>

                  {/* Quizzes Taken */}
                  <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-4">
                    <div className="flex items-center gap-2 text-[#9fa0b8] mb-3">
                      <ClipboardList className="w-4 h-4 text-brand" />
                      <span className="text-xs font-medium">Quizzes Taken</span>
                    </div>
                    <p className="text-3xl font-bold text-white">
                      {(() => {
                        const uniqueQuizzes = new Set<string>();
                        Array.from(enrollments.values()).forEach((e) => {
                          e.quizAttempts?.forEach((a) => {
                            uniqueQuizzes.add(a.chapterId);
                          });
                        });
                        return uniqueQuizzes.size;
                      })()}
                    </p>
                    <p className="text-xs text-[#9fa0b8] mt-1">Keep sharpening!</p>
                  </div>

                  {/* Time Tracker */}
                  <div className="bg-gradient-to-br from-brand/10 to-[#0e0e12] border border-brand/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-brand mb-3">
                      <Timer className="w-4 h-4" />
                      <span className="text-xs font-medium">Time Tracker</span>
                    </div>
                    {studyStats?.activeSession && viewingCourse ? (
                      <div>
                        <p className="text-2xl font-bold text-brand font-mono">
                          <LiveTimer startedAt={studyStats.activeSession.startedAt} />
                        </p>
                        <p className="text-xs text-[#9fa0b8] mt-1 truncate">
                          Studying: {studyStats.activeSession.courseTitle}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-2xl font-bold text-white font-mono">
                          {formatMinutes(studyStats?.totalTimeToday || 0)}
                        </p>
                        <p className="text-xs text-[#9fa0b8] mt-1">Today&apos;s study time</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Continue Learning */}
                {(() => {
                  const recentEnrollments = Array.from(enrollments.values())
                    .filter(
                      (e) =>
                        e.status === "enrolled" &&
                        e.progressPercentage > 0 &&
                        e.progressPercentage < 100
                    )
                    .sort(
                      (a, b) =>
                        new Date(b.lastAccessedAt).getTime() -
                        new Date(a.lastAccessedAt).getTime()
                    )
                    .slice(0, 4);

                  if (recentEnrollments.length === 0) return null;

                  return (
                    <div>
                      <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                        <Play className="w-4 h-4 text-brand" />
                        Continue Learning
                      </h3>
                      <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-4 gap-3">
                        {recentEnrollments.map((enrollment) => {
                          const course = courses.find(
                            (c) =>
                              c._id ===
                              (typeof enrollment.courseId === "string"
                                ? enrollment.courseId
                                : enrollment.courseId._id)
                          );
                          if (!course) return null;
                          return (
                            <button
                              key={enrollment._id}
                              onClick={() => {
                                openCourseDetail(course, true);
                              }}
                              className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-3 text-left hover:border-brand/30 transition-colors group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#1a1a22] flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {course.coverImage ? (
                                    <img
                                      src={course.coverImage}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <BookOpen className="w-5 h-5 text-[#9fa0b8]" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white truncate group-hover:text-brand transition-colors">
                                    {course.title}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 bg-[#1a1a22] rounded-full h-1.5">
                                      <div
                                        className="bg-brand h-1.5 rounded-full transition-all"
                                        style={{
                                          width: `${enrollment.progressPercentage}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-[#9fa0b8]">
                                      {enrollment.progressPercentage}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Row 3: Recently Studied + Time Chart + Streak */}
                <div className="grid grid-cols-1 @4xl:grid-cols-3 gap-4">
                  {/* Recently Studied */}
                  <div className="@4xl:col-span-2 bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-4">
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#9fa0b8]" />
                      Recently Studied
                    </h3>
                    {studyStats?.recentSessions && studyStats.recentSessions.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[#9fa0b8] text-xs border-b border-[#2a2a35]">
                              <th className="text-left pb-2 font-medium">Course</th>
                              <th className="text-left pb-2 font-medium">Start</th>
                              <th className="text-left pb-2 font-medium">End</th>
                              <th className="text-right pb-2 font-medium">Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studyStats.recentSessions.map((s, i) => (
                              <tr key={i} className="border-b border-[#2a2a35] last:border-b-0">
                                <td className="py-2.5 text-white pr-4 max-w-[200px] truncate">
                                  {s.courseTitle}
                                </td>
                                <td className="py-2.5 text-[#9fa0b8]">
                                  {new Date(s.startedAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </td>
                                <td className="py-2.5 text-[#9fa0b8]">
                                  {new Date(s.endedAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </td>
                                <td className="py-2.5 text-right text-white font-mono text-xs">
                                  {formatDuration(s.duration)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-[#9fa0b8] py-4 text-center">
                        No study sessions yet. Open a course to start tracking!
                      </p>
                    )}
                  </div>

                  {/* Right Column: Time Chart + Streak */}
                  <div className="space-y-4">
                    {/* Time Spent Learning */}
                    <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-4">
                      <h3 className="text-sm font-medium text-white mb-1 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[#9fa0b8]" />
                        Time Spent Learning
                      </h3>
                      <p className="text-2xl font-bold text-white mb-3">
                        {formatMinutes(
                          (studyStats?.weeklyTime || []).reduce((a, b) => a + b, 0)
                        )}
                      </p>
                      {/* Bar chart */}
                      <div className="flex items-end gap-1.5 h-20">
                        {(studyStats?.weeklyTime || [0, 0, 0, 0, 0, 0, 0]).map(
                          (mins, i) => {
                            const max = Math.max(
                              ...(studyStats?.weeklyTime || [1]),
                              1
                            );
                            const height = Math.max((mins / max) * 100, 4);
                            const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
                            const isToday = i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                  className={`w-full rounded-sm transition-all ${
                                    isToday
                                      ? "bg-brand"
                                      : mins > 0
                                      ? "bg-brand/50"
                                      : "bg-[#2a2a35]"
                                  }`}
                                  style={{ height: `${height}%` }}
                                />
                                <span className={`text-[10px] ${isToday ? "text-brand" : "text-[#9fa0b8]"}`}>
                                  {days[i]}
                                </span>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {/* Streak Tracker */}
                    <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-4">
                      <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-400" />
                        Streak Tracker
                      </h3>
                      <p className="text-2xl font-bold text-white">
                        {studyStats?.streakDays || 0}-day
                        <span className="text-sm font-normal text-[#9fa0b8] ml-2">streak</span>
                      </p>
                      {(studyStats?.streakDays || 0) > 0 && (
                        <p className="text-xs text-orange-400 mt-1">🔥 Keep going!</p>
                      )}
                      {/* Streak dots - last 14 days */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {Array.from({ length: 14 }).map((_, i) => {
                          const date = new Date();
                          date.setDate(date.getDate() - (13 - i));
                          const dateStr = date.toISOString().split("T")[0];
                          const isActive = studyStats?.streakDates?.includes(dateStr);
                          const isToday = i === 13;
                          return (
                            <div
                              key={i}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                                isActive
                                  ? "bg-brand text-brand-foreground"
                                  : isToday
                                  ? "border border-brand/50 text-[#9fa0b8]"
                                  : "bg-[#1a1a22] text-[#9fa0b8]"
                              }`}
                              title={dateStr}
                            >
                              {date.getDate()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Founder analytics placeholder */
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 className="h-12 w-12 text-[#9fa0b8] mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Course Analytics</h3>
                <p className="text-sm text-[#9fa0b8] max-w-sm">
                  Open a course and check the Quiz Analytics section to see detailed learner performance data.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== ENROLLED COURSES TAB ===== */}
      {activeSection === "enrolled" && (
        <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6">
          <div className="max-w-7xl mx-auto">

            {(() => {
              const enrolledCourses = courses.filter((course) => {
                const enrollment = enrollments.get(course._id);
                return enrollment && enrollment.status !== "dropped";
              });

              if (enrolledCourses.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <BookOpen className="h-12 w-12 text-[#9fa0b8] mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">No Enrolled Courses</h3>
                    <p className="text-sm text-[#9fa0b8] max-w-sm">
                      You haven&apos;t enrolled in any courses yet. Head to Discover to find courses to join.
                    </p>
                  </div>
                );
              }

              return viewMode === "grid" ? (
                <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-4 sm:gap-6">
                  {enrolledCourses.map((course) => (
                    <CourseCard
                      key={course._id}
                      course={course}
                      ratingSummary={ratingSummaries[course._id]}
                      enrollment={enrollments.get(course._id)}
                      isFounder={isFounderMode}
                      affiliateId={affiliateId}
                      onAction={() => {
                        openCourseDetail(course, true);
                      }}
                      onEdit={() => openCourseEdit(course)}
                      onDelete={() => setShowDeleteConfirm(course._id)}
                      onClone={() => handleCloneCourse(course._id)}
                      purchasing={purchasingCourseId === course._id}
                      isActualFounder={isFounder}
                      hideRating
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {enrolledCourses.map((course) => (
                    <CourseCard
                      key={course._id}
                      course={course}
                      ratingSummary={ratingSummaries[course._id]}
                      enrollment={enrollments.get(course._id)}
                      isFounder={isFounderMode}
                      affiliateId={affiliateId}
                      onAction={() => {
                        openCourseDetail(course, true);
                      }}
                      onEdit={() => openCourseEdit(course)}
                      onDelete={() => setShowDeleteConfirm(course._id)}
                      onClone={() => handleCloneCourse(course._id)}
                      isListView
                      purchasing={purchasingCourseId === course._id}
                      isActualFounder={isFounder}
                      hideRating
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===== STUDENTS TAB (Founder Only) ===== */}
      {activeSection === "students" && (
        <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Filter and Search controls */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-4">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="flex flex-col gap-1.5 min-w-[200px]">
                  <span className="text-[10px] uppercase font-semibold text-[#9fa0b8] tracking-wider">Filter by Course</span>
                  <Select
                    value={selectedCourseId}
                    onValueChange={setSelectedCourseId}
                  >
                    <SelectTrigger className="bg-[#1a1a22] border-[#2a2a35] text-white text-sm h-9">
                      <SelectValue placeholder="All Courses" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a22] border-[#2a2a35] text-white">
                      <SelectItem value="all">All Courses</SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course._id} value={course._id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 w-full sm:w-80">
                <span className="text-[10px] uppercase font-semibold text-[#9fa0b8] tracking-wider">Search Student</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9fa0b8]" />
                  <Input
                    placeholder="Search name or email..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="pl-9 bg-[#1a1a22] border-[#2a2a35] text-white h-9 placeholder:text-[#9fa0b8]/50"
                  />
                </div>
              </div>
            </div>

            {/* Students List Table */}
            <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl overflow-hidden">
              {loadingAdminEnrollments ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-brand animate-spin mb-4" />
                  <p className="text-sm text-[#9fa0b8]">Loading students directory...</p>
                </div>
              ) : (() => {
                // Client-side search filtering
                const filteredEnrollments = adminEnrollments.filter((enrollment) => {
                  const user = enrollment.userId;
                  if (!user) return false;
                  
                  const name = user.name || "";
                  const email = user.email || "";
                  const query = studentSearchQuery.toLowerCase().trim();
                  
                  return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
                });

                if (filteredEnrollments.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Users className="w-12 h-12 text-[#9fa0b8] mb-3" />
                      <h3 className="text-base font-semibold text-white mb-1">No Students Found</h3>
                      <p className="text-xs text-[#9fa0b8] max-w-xs">
                        {studentSearchQuery 
                          ? "No enrolled students match your search criteria." 
                          : "No students have enrolled in this course yet."}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-[#2a2a35] text-[#9fa0b8] text-xs font-semibold uppercase tracking-wider bg-[#0a0a0d]">
                          <th className="px-6 py-4">Student</th>
                          <th className="px-6 py-4">Course Enrolled</th>
                          <th className="px-6 py-4">Enrollment Date</th>
                          <th className="px-6 py-4">Progress</th>
                          <th className="px-6 py-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2a35]/40">
                        {filteredEnrollments.map((enrollment) => {
                          const user = enrollment.userId;
                          const course = enrollment.courseId;
                          if (!user || !course) return null;

                          return (
                            <tr 
                              key={enrollment._id} 
                              className="hover:bg-[#1a1a22]/20 transition-colors"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-[#1a1a22] flex items-center justify-center overflow-hidden border border-[#2a2a35]">
                                    {user.avatar || user.profilePicture ? (
                                      <img 
                                        src={user.avatar || user.profilePicture} 
                                        alt={user.name || "Student"} 
                                        className="w-full h-full object-cover animate-in fade-in duration-200"
                                      />
                                    ) : (
                                      <User className="w-4 h-4 text-[#9fa0b8]" />
                                    )}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-medium text-white">{user.name || "Anonymous Learner"}</span>
                                    <span className="text-xs text-[#9fa0b8]">{user.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2 max-w-xs">
                                  <div className="w-8 h-8 rounded bg-[#1a1a22] overflow-hidden flex-shrink-0 border border-[#2a2a35]">
                                    {course.coverImage ? (
                                      <img 
                                        src={course.coverImage} 
                                        alt="" 
                                        className="w-full h-full object-cover animate-in fade-in duration-200"
                                      />
                                    ) : (
                                      <BookOpen className="w-4 h-4 m-2 text-[#9fa0b8]" />
                                    )}
                                  </div>
                                  <span className="font-medium text-white truncate" title={course.title}>
                                    {course.title}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-[#9fa0b8]">
                                {new Date(enrollment.enrolledAt).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1.5 min-w-[150px]">
                                  <div className="flex items-center justify-between text-xs text-[#9fa0b8]">
                                    <span>
                                      {enrollment.completedChapters} / {course.totalChapters || enrollment.totalChapters || 0} chapters
                                    </span>
                                    <span className="font-mono">{enrollment.progressPercentage}%</span>
                                  </div>
                                  <div className="w-full bg-[#1a1a22] h-1.5 rounded-full overflow-hidden border border-[#2a2a35]/40">
                                    <div 
                                      className="bg-brand h-full rounded-full transition-all duration-300"
                                      style={{ width: `${enrollment.progressPercentage}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className={cn(
                                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                  enrollment.status === "completed" 
                                    ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                                    : enrollment.status === "dropped"
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                )}>
                                  {enrollment.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}
        </>
      )}

      {/* Create Course Modal */}

      <CreateCourseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(course) => {
          setCourses((prev) => {
            const exists = prev.some((c) => c._id === course._id);
            return exists ? prev.map((c) => c._id === course._id ? course : c) : [course, ...prev];
          });
          setShowCreateModal(false);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!showDeleteConfirm}
        onOpenChange={() => setShowDeleteConfirm(null)}
      >
        <AlertDialogContent className="bg-[#0e0e12] border-[#2a2a35] z-[600]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Delete Course
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#9fa0b8]">
              Are you sure you want to delete this course? This action cannot be
              undone. All enrollments and progress will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1a22] border-[#2a2a35] text-white hover:bg-[#2a2a35]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                showDeleteConfirm && handleDeleteCourse(showDeleteConfirm)
              }
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inline course checkout — right-side slide-in drawer, matching
          ChannelPaymentModalNew / WebinarPreJoin / WorkshopsPage /
          ProductsPage. Replaced the legacy iframe branch (previously
          togglable via ?checkout=iframe) with the unified drawer pattern.
          Body: course summary + coupon input + <PaymentMethodSelector>
          inline. Course-specific verify path preserved via
          handlePaymentInitiated → verifyCoursePayment. */}
      {showPaymentSelector && invoiceId && paymentCourse && (
        <div
          className="fixed inset-0 z-[9999] flex"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop — clicking cancels. */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={resetCheckoutDrawerState}
          />

          {/* Slide-in drawer panel */}
          <div className="relative ml-auto h-full w-full sm:max-w-md bg-[#0b0b0d] border-l border-[#2a2a35] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-[#2a2a35]">
              <h2 className="text-lg font-semibold text-white">Purchase Course</h2>
              <button
                onClick={resetCheckoutDrawerState}
                className="p-1.5 hover:bg-[#1a1a22] rounded-full transition-colors"
                aria-label="Close payment"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* Course Info */}
              <div className="mb-6 p-4 bg-[#1a1a22] border border-[#2a2a35] rounded-lg">
                <h3 className="font-semibold text-white mb-2">{paymentCourse.title}</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold text-brand">
                    {paymentCourse.currency || "₹"}{formatPrice(paymentCourse.price)}
                  </span>
                </div>
              </div>

              {!appliedCouponCode ? (
                <div className="mb-4">
                  <PlatformCouponInput
                    productType="course"
                    amountCents={(paymentCourse.price || 0) * 100}
                    orgId={paymentCourse.organizationId}
                    itemId={paymentCourse._id}
                    invoiceCurrency={(paymentOrderData?.currency as "USD" | "INR") || (paymentCourse.currency as "USD" | "INR") || "USD"}
                    authToken={getToken() || undefined}
                    onApplied={async (ap) => {
                      try {
                        const res = await fetch(`${API_URL}/api/invoices/${invoiceId}/apply-platform-coupon`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${getToken() || ""}`,
                          },
                          body: JSON.stringify({ code: ap.code }),
                        });
                        const data = await res.json();
                        if (!res.ok || !data.success) {
                          // Throw so the coupon input rolls back instead of showing a
                          // discount the invoice never took.
                          throw new Error(data.error || "Failed to apply coupon");
                        }
                        setDiscountedTotalCents(data.invoice.totalAmount);
                        setAppliedCouponCode(data.invoice.couponCode);
                        toast.success("Coupon applied");
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to apply coupon");
                        throw err;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">
                    Coupon {appliedCouponCode} applied
                  </span>
                </div>
              )}

              <PaymentMethodSelector
                invoiceId={invoiceId}
                itemCurrency={paymentOrderData?.currency || paymentCourse.currency || "INR"}
                totalAmount={discountedTotalCents ?? ((paymentCourse.price || 0) * 100)}
                onPaymentInitiated={handlePaymentInitiated}
                onError={(errMsg) => toast.error(errMsg)}
                disabled={!!purchasingCourseId}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

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

// Course Card Component
function CourseCard({
  course,
  enrollment,
  isFounder,
  affiliateId,
  onAction,
  onEdit,
  onDelete,
  onClone,
  isListView = false,
  purchasing = false,
  isActualFounder = false,
  ratingSummary,
  hideRating = false,
}: {
  course: Course;
  enrollment?: CourseEnrollment;
  isFounder: boolean;
  affiliateId: string;
  onAction: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClone?: () => void;
  isListView?: boolean;
  purchasing?: boolean;
  isActualFounder?: boolean;
  /** Undefined while the batched rating summaries are still loading. */
  ratingSummary?: RatingSummary;
  /** Set on the Enrolled tab — those cards carry no ratings row. */
  hideRating?: boolean;
}) {
  const [plan, setPlan] = useState<CombPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  useEffect(() => {
    const loadPlan = async () => {
      try {
        const result = await getCombPlanForItem("course", course._id);
        if (result?.plan) {
          setPlan(result.plan);
        }
      } catch (err) {
        console.error("Error loading plan:", err);
      } finally {
        setLoadingPlan(false);
      }
    };
    loadPlan();
  }, [course._id]);

  const getButtonText = () => {
    if (purchasing) return "Processing...";
    if (isFounder) return "Edit Course";
    if (enrollment) {
      return enrollment.status === "completed"
        ? "Review Course"
        : "Continue Learning";
    }
    if (course.isFree) return "Enroll Free";
    if (isActualFounder) return "Enroll Free (Founder)";
    return `Buy Now - ${course.currency || "₹"}${formatPrice(course.price)}`;
  };

  const getButtonIcon = () => {
    if (purchasing) return <Loader2 className="h-4 w-4 mr-2 animate-spin" />;
    if (isFounder) return <Edit className="h-4 w-4 mr-2" />;
    if (enrollment) {
      return enrollment.status === "completed" ? (
        <CheckCircle2 className="h-4 w-4 mr-2" />
      ) : (
        <Play className="h-4 w-4 mr-2" />
      );
    }
    return <ExternalLink className="h-4 w-4 mr-2" />;
  };

  if (isListView) {
    return (
      <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-lg p-4 hover:border-brand transition-colors">
        <div className="flex gap-4">
          <div className="w-48 h-28 bg-[#1a1a22] rounded-lg flex-shrink-0 relative overflow-hidden">
            {course.coverImage ? (
              <img
                src={course.coverImage}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-[#9fa0b8]" />
              </div>
            )}
            {isFounder && (
              <div
                className={cn(
                  "absolute top-2 left-2 text-xs px-2 py-1 rounded-full",
                  course.status === "published"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-yellow-500/20 text-yellow-400"
                )}
              >
                {course.status}
              </div>
            )}
            {course.isPaid && (
              <div className="absolute bottom-2 left-2">
                <CompPlanBadge
                  itemType="course"
                  itemId={course._id}
                  price={course.price}
                  currency={course.currency || "₹"}
                  isFounder={isFounder}
                />
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-white font-medium">{course.title}</h3>
                {course.description && (
                  <p
                    className="text-sm text-[#9fa0b8] mt-2 line-clamp-2 [&_a]:pointer-events-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeDescription(course.description) }}
                  />
                )}
                <div className="flex items-center gap-4 mt-3 text-sm text-[#9fa0b8]">
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    <span>{course.totalChapters} chapters</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{course.enrolledStudents} enrolled</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {enrollment && (
                  <div className="text-sm text-[#9fa0b8]">
                    {enrollment.progressPercentage}% complete
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={onAction}
                    disabled={purchasing}
                    title={isActualFounder && !course.isFree && !enrollment ? "Founder Access: You can enroll in this paid course for free." : undefined}
                    className="bg-brand hover:opacity-90 text-brand-foreground disabled:opacity-50"
                  >
                    {getButtonIcon()}
                    {getButtonText()}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 text-[#9fa0b8] hover:text-brand"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                        detail: {
                          type: "affiliate",
                          course: course,
                          itemType: "course",
                          affiliateId: affiliateId
                        }
                      }));
                    }}
                    title="Affiliate Link"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  {isFounder && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2 text-[#9fa0b8] hover:text-white"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-[#1a1a22] border-[#2a2a35]"
                      >
                        <DropdownMenuItem
                          onClick={onEdit}
                          className="text-white hover:bg-[#2a2a35]"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={onClone}
                          className="text-white hover:bg-[#2a2a35] cursor-pointer"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Clone
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={onDelete}
                          className="text-red-400 hover:bg-[#2a2a35]"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onAction}
      title={isActualFounder && !course.isFree && !enrollment ? "Founder Access: You can enroll in this paid course for free." : undefined}
      className="group cursor-pointer bg-[#0c0c0e] border border-[#2a2a35]/60 hover:border-brand hover:shadow-lg transition-all duration-300 rounded-2xl overflow-hidden flex flex-col h-full relative"
    >
      {/* Top Image Portion */}
      <div className="p-3 pb-0 relative">
        <div className="h-44 bg-[#16161a] relative overflow-hidden rounded-xl">
          {course.coverImage ? (
            <img
              src={course.coverImage}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="h-12 w-12 text-[#9fa0b8]" />
            </div>
          )}

          {/* Overlaid Badges */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
            {course.isFree ? (
              <span className="bg-[#45a85c] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                Free
              </span>
            ) : (
              <span className="bg-[#FE2954] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                Paid
              </span>
            )}
            <span className="bg-[#1a1a20]/90 border border-[#2a2a30]/30 text-white/90 text-[10px] font-medium px-2 py-0.5 rounded shadow-sm">
              {course.totalChapters} {course.totalChapters === 1 ? "Chapter" : "Chapters"}
            </span>
            {isFounder && (
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded shadow-sm",
                course.status === "published"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-yellow-500/20 text-yellow-400"
              )}>
                {course.status}
              </span>
            )}
          </div>

          {/* Enrolled Completed Badge */}
          {enrollment?.status === "completed" && (
            <div className="absolute top-3 right-3 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 z-10 shadow-sm">
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </div>
          )}

          {/* Founder Dropdown Menu options (atop card) */}
          {isFounder && (
            <div
              className="absolute top-3 right-3 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 bg-black/60 hover:bg-black text-[#9fa0b8] hover:text-white rounded-full border border-white/10"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-[#1a1a22] border-[#2a2a35]"
                >
                  <DropdownMenuItem
                    onClick={onEdit}
                    className="text-white hover:bg-[#2a2a35] cursor-pointer"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onClone}
                    className="text-white hover:bg-[#2a2a35] cursor-pointer"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Clone
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-red-400 hover:bg-[#2a2a35] cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* Card Content Section */}
      <div className="p-4 pt-3 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5 min-h-[84px] flex flex-col justify-start overflow-hidden">
          <h3
            title={course.title}
            className={cn(
              "text-white font-bold group-hover:text-brand transition-colors leading-tight",
              course.title.length > 70
                ? "text-xs sm:text-sm"
                : course.title.length > 40
                ? "text-sm sm:text-[15px]"
                : "text-base"
            )}
          >
            {course.title}
          </h3>
          {course.description && (
            <p
              className={cn(
                "text-xs text-[#9fa0b8]/80 leading-relaxed [&_a]:pointer-events-none",
                course.title.length > 60 ? "line-clamp-1" : "line-clamp-2"
              )}
              dangerouslySetInnerHTML={{ __html: sanitizeDescription(course.description) }}
            />
          )}
        </div>



        {/* Pricing and Affiliate Button Row */}
        <div className="flex items-center justify-between pt-1 mt-auto">
          {/* Real Price display */}
          <div>
            {course.isFree ? (
              <span className="text-sm font-bold text-white font-inter">Free to join</span>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-white font-inter">
                  {course.currency === "INR" ? "₹" : "$"}{formatPrice(course.price)}
                </span>
              </div>
            )}
          </div>

          {/* Affiliate Link Pill button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                detail: {
                  type: "affiliate",
                  course: course,
                  itemType: "course",
                  affiliateId: affiliateId
                }
              }));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:border-brand/60 hover:bg-brand/5 bg-[#16161a] text-[11px] text-[#9fa0b8] hover:text-white transition-all cursor-pointer select-none font-medium leading-none"
            title="Open affiliate sharing details"
          >
            <Link2 className="w-3.5 h-3.5 text-[#9fa0b8] group-hover:text-white transition-colors" />
            <span>Affiliate Link</span>
          </button>
        </div>

        {/* Ratings row — no extra x-padding, the card body already has p-4;
            the stars line up with the title and price above them.
            Hidden on enrolled cards: a learner rates from the course view
            page, so the card here would only be noise. */}
        {!hideRating && (
          <div onClick={(e) => e.stopPropagation()}>
            <CardRatingRow
              targetType="course"
              targetId={course._id}
              targetName={course.title}
              summary={ratingSummary}
            />
          </div>
        )}
      </div>

      {/* Bottom Yellow/Grey Banner */}
      <div className="w-full flex-shrink-0 mt-auto border-t border-[#2a2a35]/40" onClick={(e) => e.stopPropagation()}>
        {plan ? (
          <div
            onClick={() => {
              window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                detail: {
                  type: "affiliate",
                  course: course,
                  itemType: "course",
                  affiliateId: affiliateId
                }
              }));
            }}
            className="bg-brand hover:opacity-90 text-brand-foreground text-[11.5px] font-bold py-2.5 text-center w-full transition-all cursor-pointer select-none"
            title="Click to see affiliate earning levels"
          >
            Find out how much you can Earn
          </div>
        ) : (
          <div className="bg-[#44444c] text-white/70 text-[11.5px] font-bold py-2.5 text-center w-full select-none cursor-default">
            No commissions paid for this course
          </div>
        )}
      </div>
    </div>
  );
}

// Create Course Modal - Compact Single Form
function CreateCourseModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (course: Course) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState<number>(0);
  const [currency, setCurrency] = useState("USD");
  // Tax + iOS surcharges. Default to inclusive so INR sellers don't
  // accidentally start adding 18% on top without their consent.
  const [gstInclusive, setGstInclusive] = useState<boolean>(true);
  const [requireIosPayment, setRequireIosPayment] = useState<boolean>(false);
  const [appleFeeInclusive, setAppleFeeInclusive] = useState<boolean>(false);
  const [whatYouWillLearn, setWhatYouWillLearn] = useState<string[]>([""]);
  const [requirements, setRequirements] = useState<string[]>([""]);
  // Audience gating — course visible only to members of these channels
  // (empty = visible to every stakeholder). Enforced BE-side in
  // services/course.ts::getPublishedCourses + routes/course.ts single-item
  // access check (mirrors Workshops + Products behavior).
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [showPriceBreakdownModal, setShowPriceBreakdownModal] = useState(false);
  // Post-purchase order email — shared with the product and community forms.
  const emailAlertsForm = useEmailAlerts();
  const founderAlertsForm = useFounderAlerts();

  const getAffiliateInfo = () => {
    if (typeof window !== "undefined" && (window as any).__commissionPlanInfo) {
      return (window as any).__commissionPlanInfo;
    }
    return { enabled: false, levels: [], totalCommission: 0 };
  };

  const getPriceDetails = () => {
    const p = price || 0;
    const symbol = currency === "INR" ? "₹" : "$";
    let baseWeb = p;
    let gstWeb = 0;
    let totalWeb = p;
    if (p > 0) {
      if (gstInclusive) {
        baseWeb = p / 1.18;
        gstWeb = p - baseWeb;
        totalWeb = p;
      } else {
        baseWeb = p;
        gstWeb = p * 0.18;
        totalWeb = p + gstWeb;
      }
    }
    let totalIos = totalWeb;
    let appleCut = 0;
    if (requireIosPayment && p > 0) {
      if (appleFeeInclusive) {
        totalIos = totalWeb;
        appleCut = totalWeb * 0.3;
      } else {
        totalIos = totalWeb / 0.7;
        appleCut = totalIos * 0.3;
      }
    }
    return { currency: symbol, baseWeb, gstWeb, totalWeb, totalIos, appleCut };
  };

  const getDetailedPriceBreakdown = () => {
    const priceVal = price || 0;
    const isInclusive = gstInclusive;
    const affInfo = getAffiliateInfo();
    const affPercent = affInfo.enabled ? affInfo.totalCommission : 0;
    
    const basePrice = isInclusive ? priceVal / 1.18 : priceVal;
    
    const nonIosAppleFee = 0;
    const nonIosGst = basePrice * 0.18;
    const nonIosCustomerPays = isInclusive ? priceVal : basePrice + nonIosGst;
    
    const nonIosGovGst = nonIosGst;
    const nonIosAppleDist = 0;
    const nonIosPlatformFee = basePrice * 0.05;
    const nonIosAffiliateCut = basePrice * (affPercent / 100);
    const nonIosYouReceive = basePrice - nonIosPlatformFee - nonIosAffiliateCut;
    
    const iosAppleFee = basePrice * 0.30;
    const iosGst = (basePrice + iosAppleFee) * 0.18;
    const iosCustomerPays = basePrice + iosAppleFee + iosGst;
    
    const iosGovGst = iosGst;
    const iosAppleDist = iosAppleFee;
    const iosPlatformFee = basePrice * 0.05;
    const iosAffiliateCut = basePrice * (affPercent / 100);
    const iosYouReceive = basePrice - iosPlatformFee - iosAffiliateCut;

    return {
      basePrice,
      affPercent,
      nonIos: {
        appleFee: nonIosAppleFee,
        gst: nonIosGst,
        customerPays: nonIosCustomerPays,
        govGst: nonIosGovGst,
        appleDist: nonIosAppleDist,
        platformFee: nonIosPlatformFee,
        affiliateCut: nonIosAffiliateCut,
        youReceive: nonIosYouReceive
      },
      ios: {
        appleFee: iosAppleFee,
        gst: iosGst,
        customerPays: iosCustomerPays,
        govGst: iosGovGst,
        appleDist: iosAppleDist,
        platformFee: iosPlatformFee,
        affiliateCut: iosAffiliateCut,
        youReceive: iosYouReceive
      }
    };
  };

  // Fetch the org's channels when the modal opens so the picker has
  // something to show. Not fetched at CoursesPage root because the modal
  // is only mounted when the founder clicks "Create Course".
  useEffect(() => {
    if (!isOpen) return;
    const orgId = typeof window !== "undefined"
      ? localStorage.getItem("garage_org_id")
      : null;
    if (!orgId) return;
    let cancelled = false;
    getOrgChannels(orgId)
      .then((res) => {
        if (!cancelled) setChannels(res.channels || []);
      })
      .catch((err) => {
        console.error("Failed to fetch channels for course picker:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // ── Local sections state (no server calls until Save) ──────────────────────
  // Each section has a temp _id (uuid-like string), a title, and local chapters.
  type LocalChapter = {
    _id: string;
    title: string;
    contentType: string;
    contentUrl?: string;
    content?: string;
    duration?: number;
    isFree?: boolean;
    questions?: any[];
    [key: string]: any;
  };
  type LocalSection = {
    _id: string;
    title: string;
    chapters: LocalChapter[];
  };
  const [localSections, setLocalSections] = useState<LocalSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState<{ sectionId: string; chapter?: LocalChapter } | null>(null);

  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Generate a simple temp ID for local sections/chapters
  const tempId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCoverImage("");
    setGalleryImages([]);
    setVideoUrl("");
    setVideoFile("");
    setIsPaid(false);
    setPrice(0);
    setCurrency("USD");
    setWhatYouWillLearn([""]);
    setRequirements([""]);
    setChannelIds([]);
    setUploadingImage(false);
    setUploadingGallery(false);
    setUploadingVideo(false);
    setLocalSections([]);
    setExpandedSections(new Set());
    setEditingSectionId(null);
    setNewSectionTitle("");
    setShowAddSection(false);
    setShowChapterModal(null);
    setError("");
    emailAlertsForm.reset();
    founderAlertsForm.reset();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const buildPayload = (status: "draft" | "published" = "draft") => ({
    title: title.trim(),
    description: description || undefined,
    coverImage: coverImage || undefined,
    galleryImages,
    videoUrl: videoUrl || undefined,
    videoFile: videoFile || undefined,
    isPaid,
    price: isPaid ? price : 0,
    currency,
    gstInclusive,
    requireIosPayment,
    appleFeeInclusive,
    whatYouWillLearn: whatYouWillLearn.filter((s) => s.trim()).length > 0 ? whatYouWillLearn.filter((s) => s.trim()) : undefined,
    requirements: requirements.filter((s) => s.trim()).length > 0 ? requirements.filter((s) => s.trim()) : undefined,
    channelIds,
    status,
    emailAlerts: emailAlertsForm.buildPayload(),
    founderAlerts: founderAlertsForm.buildPayload(),
  });

  // ── Save handler — creates course then persists all local sections/chapters ─
  const handleSave = async (publish: boolean) => {
    if (!title.trim()) { toast.error("Please enter a course title"); return; }
    if (channelIds.length === 0) { toast.error("Please select at least one community"); return; }
    const validLearn = whatYouWillLearn.filter((s) => s.trim());
    if (validLearn.length === 0) { toast.error("Please add at least one 'What you'll learn' point"); return; }
    const validReqs = requirements.filter((s) => s.trim());
    if (validReqs.length === 0) { toast.error("Please add at least one requirement"); return; }
    if (isPaid && price <= 0) { toast.error("Please enter a valid price for paid course"); return; }
    const emailAlertsMsg = emailAlertsForm.validate();
    if (emailAlertsMsg) { toast.error(emailAlertsMsg); return; }
    if (publish) { setLoading(true); } else { setSavingDraft(true); }
    try {
      // 1. Create or update the course
      const newCourse = await createCourse(buildPayload(publish ? "published" : "draft"));
      const id = newCourse._id;

      // 2. Persist all local sections + their chapters in order
      let finalCourse = newCourse;
      for (const sec of localSections) {
        const afterSection = await addCourseSection(id, sec.title);
        const savedSection = afterSection.sections[afterSection.sections.length - 1];
        for (const ch of sec.chapters) {
          const { _id: _ignore, ...chapterData } = ch;
          const afterChapter = await addCourseChapter(id, savedSection._id, chapterData as any);
          finalCourse = afterChapter;
        }
        if (sec.chapters.length === 0) finalCourse = afterSection;
      }

      // 3. Save commission plan (non-fatal)
      if (isPaid) {
        try { await saveCommissionPlan(id); } catch { /* non-fatal */ }
      }
      emailAlertsForm.noteTemplateUse();

      onSuccess(finalCourse);
      announceCourse(finalCourse, !publish);
      if (publish) handleClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to save course");
    } finally {
      setLoading(false);
      setSavingDraft(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be less than 5MB"); return; }
    setUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      const token = getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formDataUpload,
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setCoverImage(data.url);
      toast.success("Image uploaded successfully");
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentCount = galleryImages.length;
    if (currentCount >= 3) {
      toast.error("You can upload a maximum of 3 gallery images");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be less than 5MB"); return; }
    setUploadingGallery(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      const token = getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formDataUpload,
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setGalleryImages((prev) => [...prev, data.url]);
      toast.success("Gallery image uploaded successfully");
    } catch {
      toast.error("Failed to upload gallery image");
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file (MP4 etc.)");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error("Video must be less than 500MB");
      return;
    }
    setUploadingVideo(true);
    try {
      const token = getToken();
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formDataUpload,
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setVideoFile(data.url);
      setVideoUrl("");
      toast.success("Video uploaded successfully");
    } catch {
      toast.error("Failed to upload video");
    } finally {
      setUploadingVideo(false);
      if (videoFileInputRef.current) videoFileInputRef.current.value = "";
    }
  };

  const removeUploadedVideo = () => {
    setVideoFile("");
  };

  // ── Local section handlers (no API calls) ───────────────────────────────────
  const handleAddSection = () => {
    if (!newSectionTitle.trim()) { toast.error("Please enter a section title"); return; }
    const id = tempId();
    setLocalSections((prev) => [...prev, { _id: id, title: newSectionTitle.trim(), chapters: [] }]);
    setExpandedSections((prev) => new Set([...prev, id]));
    setNewSectionTitle("");
    setShowAddSection(false);
  };

  const handleUpdateSection = (sectionId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setLocalSections((prev) => prev.map((s) => s._id === sectionId ? { ...s, title: newTitle.trim() } : s));
    setEditingSectionId(null);
  };

  const handleDeleteSection = (sectionId: string) => {
    setLocalSections((prev) => prev.filter((s) => s._id !== sectionId));
    setExpandedSections((prev) => { const n = new Set(prev); n.delete(sectionId); return n; });
  };

  const handleSaveChapter = (sectionId: string, chapterData: any, chapterId?: string) => {
    setLocalSections((prev) => prev.map((sec) => {
      if (sec._id !== sectionId) return sec;
      if (chapterId) {
        // Update existing chapter
        return { ...sec, chapters: sec.chapters.map((ch) => ch._id === chapterId ? { ...ch, ...chapterData } : ch) };
      } else {
        // Add new chapter
        return { ...sec, chapters: [...sec.chapters, { _id: tempId(), ...chapterData }] };
      }
    }));
    setShowChapterModal(null);
    toast.success(chapterId ? "Chapter updated" : "Chapter added");
  };

  const handleDeleteChapter = (sectionId: string, chapterId: string) => {
    setLocalSections((prev) => prev.map((sec) =>
      sec._id === sectionId ? { ...sec, chapters: sec.chapters.filter((ch) => ch._id !== chapterId) } : sec
    ));
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-[640px] max-h-[92vh] flex flex-col bg-[#111114] border border-[#2a2a35] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a35] shrink-0">
          <h2 className="text-base font-semibold text-white">Create Course</h2>
          <button type="button" onClick={handleClose} className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6" style={{ scrollbarWidth: "none" }}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleGalleryUpload} className="hidden" />
          <input ref={videoFileInputRef} type="file" accept="video/mp4" onChange={handleVideoUpload} className="hidden" />

          {/* Course Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#9fa0b8]">Course Title <span className="text-brand font-bold">*</span></label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder="e.g. Complete Web Development Bootcamp"
              maxLength={100}
              className="w-full bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:border-brand/60 transition-colors placeholder:text-[#4a4a5a]"
            />
            <p className="text-xs text-[#6b6b7b] text-right">{title.length}/100 characters</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#9fa0b8]">Description</label>
            <DescriptionEditor value={description} onChange={setDescription} placeholder="Enter a brief summary of what this course is about..." />
          </div>

          {/* Audience — select mandatory community */}
          <ChannelMultiSelect
            channels={channels}
            selectedIds={channelIds}
            onChange={setChannelIds}
            required={true}
            hint="Select at least one community that will have access to this course."
          />

          {/* Cover Image & Gallery */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
              Upload Images
            </label>
            {/* Main Cover Box */}
            {coverImage ? (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-[#2a2a35] bg-[#131316]">
                <img src={coverImage} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImage("")}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                className="border border-dashed border-[#2a2a35] rounded-xl w-full flex items-center hover:border-brand/50 transition-colors cursor-pointer bg-[#131316]/60 hover:bg-[#131316]/80"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingImage ? (
                  <div className="w-full py-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-brand animate-spin" />
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-5 w-full">
                    <div className="w-12 h-12 rounded-xl bg-[#131316] flex items-center justify-center border border-[#2a2a35] shrink-0">
                      <ImageIcon className="w-5 h-5 text-[#9fa0b8]" />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-semibold text-white block">Upload cover image</span>
                      <p className="text-xs text-[#6b6b7b] mt-0.5">
                        Images should be horizontal, at least 1280×720px. PNG or JPG, up to 5mb
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3 Gallery slots below cover image */}
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, index) => {
                const imgUrl = galleryImages[index];
                return (
                  <div key={index} className="aspect-video w-full">
                    {imgUrl ? (
                      <div className="relative w-full h-full rounded-xl overflow-hidden border border-[#2a2a35] bg-[#131316]">
                        <img src={imgUrl} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setGalleryImages(prev => prev.filter((_, i) => i !== index))}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          galleryInputRef.current?.click();
                        }}
                        className="border border-dashed border-[#2a2a35] rounded-xl w-full h-full flex flex-col items-center justify-center hover:border-brand/50 transition-colors cursor-pointer bg-[#131316]/60 hover:bg-[#131316]/80"
                      >
                        {uploadingGallery && index === galleryImages.length ? (
                          <Loader2 className="w-5 h-5 text-brand animate-spin" />
                        ) : (
                          <Plus className="w-5 h-5 text-[#9fa0b8]" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Introduction Video */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
              Introduction Video
            </label>
            <div className="space-y-4">
              {/* YouTube Paste Input */}
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-[#9fa0b8]/60">
                  <Video className="w-4 h-4" />
                </span>
                <input
                  value={videoUrl}
                  onChange={(e) => {
                    setVideoUrl(e.target.value);
                    setVideoFile(""); // clear uploaded file if link is provided
                  }}
                  placeholder="Paste YouTube link..."
                  className="bg-[#131316] border border-[#2a2a35] text-white pl-10 h-10 text-sm rounded-lg focus:ring-brand/50 focus:border-brand/50 w-full"
                />
              </div>

              {videoUrl && (() => {
                const getYouTubeEmbedUrl = (url: string) => {
                  if (url.includes("youtu.be/")) {
                    const parts = url.split("youtu.be/");
                    if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                  } else if (url.includes("youtube.com/watch?v=")) {
                    const parts = url.split("v=");
                    if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("&")[0]}`;
                  } else if (url.includes("youtube.com/embed/")) {
                    const parts = url.split("embed/");
                    if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                  }
                  return "";
                };
                const embedUrl = getYouTubeEmbedUrl(videoUrl);
                if (!embedUrl) return null;
                return (
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-[#2a2a35] bg-black">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                );
              })()}

              {/* Divider OR */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[#2a2a35]/40"></div>
                <span className="flex-shrink mx-4 text-xs font-semibold text-[#6b6b7b]">OR</span>
                <div className="flex-grow border-t border-[#2a2a35]/40"></div>
              </div>

              {/* Video Upload Box */}
              <div>
                {videoFile ? (
                  <div className="border border-green-500/30 bg-green-500/5 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Video uploaded</p>
                        <p className="text-xs text-green-400">Ready to save</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeUploadedVideo}
                      className="text-[#9fa0b8] hover:text-red-400 transition-colors p-1.5 rounded-lg border border-[#2a2a35] hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : uploadingVideo ? (
                  <div className="border border-[#2a2a35] rounded-xl p-5 flex flex-col items-center justify-center gap-2 bg-[#13131a]/40">
                    <Loader2 className="w-6 h-6 text-brand animate-spin" />
                    <span className="text-xs text-[#9fa0b8]">Uploading video...</span>
                  </div>
                ) : (
                  <div
                    onClick={() => videoFileInputRef.current?.click()}
                    className="border border-dashed border-[#2a2a35] hover:border-brand/50 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer bg-[#131316]/60 hover:bg-[#131316]/80 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#131316] flex items-center justify-center border border-[#2a2a35]">
                      <Upload className="w-4 h-4 text-[#9fa0b8]" />
                    </div>
                    <span className="text-sm font-semibold text-white">Upload MP4 video</span>
                    <p className="text-xs text-[#6b6b7b]">Max 500MB • .mp4 format</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* What You'll Learn */}
          <div className="space-y-3 pb-4 border-b border-[#2a2a35]/40">
            <label className="text-xs font-semibold text-[#9fa0b8]">
              {"What You'll Learn"} <span className="text-brand font-bold">*</span>
            </label>
            {whatYouWillLearn.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input value={item} onChange={(e) => { const u = [...whatYouWillLearn]; u[idx] = e.target.value; setWhatYouWillLearn(u); }}
                  placeholder="Market analysis fundamentals"
                  className="flex-1 bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-brand/60 transition-colors placeholder:text-[#4a4a5a]" />
                {whatYouWillLearn.length > 1 && (
                  <button type="button" onClick={() => setWhatYouWillLearn(whatYouWillLearn.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-lg text-[#6b6b7b] hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setWhatYouWillLearn([...whatYouWillLearn, ""])}
                disabled={whatYouWillLearn.length >= MAX_LEARNING_POINTS}
                className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:opacity-80 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                <PlusCircle className="w-4 h-4" /> Add item
              </button>
              {whatYouWillLearn.length >= MAX_LEARNING_POINTS && (
                <span className="text-[11px] text-[#6b6b7b]">
                  {limitReachedLabel(MAX_LEARNING_POINTS, "items")}
                </span>
              )}
            </div>
          </div>

          {/* Requirements */}
          <div className="space-y-3 pb-4 border-b border-[#2a2a35]/40">
            <label className="text-xs font-semibold text-[#9fa0b8]">
              Requirements <span className="text-brand font-bold">*</span>
            </label>
            {requirements.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input value={item} onChange={(e) => { const u = [...requirements]; u[idx] = e.target.value; setRequirements(u); }}
                  placeholder="Basic understanding of finance"
                  className="flex-1 bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-brand/60 transition-colors placeholder:text-[#4a4a5a]" />
                {requirements.length > 1 && (
                  <button type="button" onClick={() => setRequirements(requirements.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-lg text-[#6b6b7b] hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setRequirements([...requirements, ""])}
                disabled={requirements.length >= MAX_LEARNING_POINTS}
                className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:opacity-80 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                <PlusCircle className="w-4 h-4" /> Add item
              </button>
              {requirements.length >= MAX_LEARNING_POINTS && (
                <span className="text-[11px] text-[#6b6b7b]">
                  {limitReachedLabel(MAX_LEARNING_POINTS, "items")}
                </span>
              )}
            </div>
          </div>

          {/* Course Type */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#9fa0b8]">Course Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setIsPaid(false)}
                className={cn("flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition-all text-left",
                  !isPaid ? "border-brand bg-brand/10 text-brand" : "border-[#2a2a35] bg-[#131316] text-[#9fa0b8] hover:border-[#3a3a45]")}>
                <BookOpen className="w-5 h-5" />
                <span className="text-sm font-semibold">Free Course</span>
                <span className="text-xs opacity-70">No payment required</span>
              </button>
              <button type="button" onClick={() => setIsPaid(true)}
                className={cn("flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition-all text-left",
                  isPaid ? "border-brand bg-brand/10 text-brand" : "border-[#2a2a35] bg-[#131316] text-[#9fa0b8] hover:border-[#3a3a45]")}>
                <DollarSign className="w-5 h-5" />
                <span className="text-sm font-semibold">Paid Course</span>
                <span className="text-xs opacity-70">Set your price</span>
              </button>
            </div>
          </div>

          {/* Pricing */}
          {isPaid && (
            <div className="space-y-3 pb-4 border-b border-[#2a2a35]/40">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#9fa0b8]">Regular Price <span className="text-brand">*</span></label>
                <div className="flex gap-2">
                  <div className="w-36 shrink-0">
                    <CurrencyDropdown value={currency} onChange={setCurrency} />
                  </div>
                  <input type="number" value={price || ""} onChange={(e) => setPrice(Number(e.target.value))} onWheel={(e) => e.currentTarget.blur()} placeholder="100" min={0}
                    className="flex-1 bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:border-brand/60 transition-colors placeholder:text-[#4a4a5a]" />
                </div>
              </div>

              {/* GST / Tax toggle — affects invoices for INR sales only.
                  Render the toggle regardless of currency so switching
                  to INR later doesn't require re-editing. */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-[#9fa0b8]">
                  GST / Tax
                </label>
                <p className="text-[11px] text-[#6b6b7b] leading-relaxed">
                  18.00% GST (Goods &amp; Services Tax) applies to buyers in
                  India, whatever currency you price in. Does the price above
                  already include it?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGstInclusive(true)}
                    className={cn(
                      "text-left p-3 rounded-xl border transition-all",
                      gstInclusive
                        ? "bg-brand/5 border-brand"
                        : "bg-[#131316] border-[#2a2a35] hover:border-[#3a3a45]"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {gstInclusive && (
                        <span className="w-2 h-2 rounded-full bg-brand" />
                      )}
                      <span className="text-sm font-semibold text-white">
                        Yes, I&apos;ll cover it in the above price
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9fa0b8]">
                      Listed price already includes 18% GST.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGstInclusive(false)}
                    className={cn(
                      "text-left p-3 rounded-xl border transition-all",
                      !gstInclusive
                        ? "bg-brand/5 border-brand"
                        : "bg-[#131316] border-[#2a2a35] hover:border-[#3a3a45]"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {!gstInclusive && (
                        <span className="w-2 h-2 rounded-full bg-brand" />
                      )}
                      <span className="text-sm font-semibold text-white">
                        No, add it on top
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9fa0b8]">
                      18% GST added to the total at checkout.
                    </p>
                  </button>
                </div>
              </div>

              {/* iOS App Purchases */}
              <div className="space-y-2 pt-2">
                <span className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                  iOS App Purchases
                </span>
                <p className="text-xs text-[#9fa0b8] leading-normal">
                  Do you require your customers to be able to pay for this course on the iOS app?
                </p>
                <div className="flex rounded-lg border border-[#2a2a35] bg-[#131316] p-1 w-full gap-1">
                  <button
                    type="button"
                    className="flex-1 py-2 text-xs font-bold rounded-md transition-all text-center bg-brand text-brand-foreground"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.info("iOS app purchases coming soon!")}
                    className="flex-1 py-2 text-xs font-medium rounded-md transition-all text-center text-[#8b8c9d] bg-transparent hover:bg-[#1a1a22] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Yes <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2a2a35] text-brand font-medium">Coming Soon</span>
                  </button>
                </div>
              </div>

              {/* Affiliate Commission */}
              <div className="pt-2">
                <CommissionPlanSection itemType="course" itemId={undefined} itemName={title || "New Course"} isPaid={isPaid} />
              </div>
            </div>
          )}

          {/* Post-purchase order email */}
          <ProductEmailAlertsSection
            {...emailAlertsForm.sectionProps}
            product={{
              productName: title,
              price: price,
              currency,
              isFree: !isPaid,
            }}
          />

          {/* Founder's own "someone enrolled" alert */}
          <FounderAlertsSection
            {...founderAlertsForm.sectionProps}
            context="course"
          />

          {/* Course Content */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Course Content</span>
              <button type="button" onClick={() => setShowAddSection(true)}
                className="text-xs font-semibold text-white border border-[#2a2a35] rounded-xl px-3 py-1.5 hover:bg-[#1a1a22] transition-colors flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            </div>

            {showAddSection && (
              <div className="flex items-center gap-2 p-3 bg-[#131316] border border-[#2a2a35] rounded-xl">
                <input value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddSection(); if (e.key === "Escape") { setShowAddSection(false); setNewSectionTitle(""); } }}
                  placeholder="Section title e.g. Introduction" autoFocus
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[#4a4a5a]" />
                <button type="button" onClick={handleAddSection}
                  className="text-xs font-bold bg-brand text-brand-foreground rounded-lg px-3 py-1.5 hover:opacity-90 transition-colors flex items-center gap-1">
                  Add
                </button>
                <button type="button" onClick={() => { setShowAddSection(false); setNewSectionTitle(""); }}
                  className="text-xs text-[#9fa0b8] hover:text-white px-2 py-1.5 transition-colors">Cancel</button>
              </div>
            )}

            {localSections.length > 0 ? (
              <div className="space-y-2">
                {localSections.map((section) => (
                  <div key={section._id} className="border border-[#2a2a35] rounded-xl overflow-hidden bg-[#131316]">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button type="button" onClick={() => toggleSection(section._id)} className="text-[#9fa0b8] hover:text-white transition-colors">
                        {expandedSections.has(section._id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      {editingSectionId === section._id ? (
                        <input defaultValue={section.title} autoFocus
                          onBlur={(e) => handleUpdateSection(section._id, e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleUpdateSection(section._id, (e.target as HTMLInputElement).value); if (e.key === "Escape") setEditingSectionId(null); }}
                          className="flex-1 bg-transparent text-white text-sm outline-none border-b border-brand/40" />
                      ) : (
                        <span className="flex-1 text-white text-sm font-medium">{section.title}</span>
                      )}
                      <span className="text-xs text-[#6b6b7b]">{section.chapters.length} chapters</span>
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => setShowChapterModal({ sectionId: section._id })}
                          className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => setEditingSectionId(section._id)}
                          className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => handleDeleteSection(section._id)}
                          className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    {expandedSections.has(section._id) && (
                      <div className="border-t border-[#2a2a35]">
                        {section.chapters.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-[#6b6b7b]">
                            No chapters yet.{" "}
                            <button type="button" onClick={() => setShowChapterModal({ sectionId: section._id })}
                              className="text-brand font-semibold hover:underline">Add one</button>
                          </div>
                        ) : (
                          section.chapters.map((chapter, chapterIndex) => (
                            <div key={chapter._id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a2a35] last:border-b-0 hover:bg-[#1a1a22] transition-colors">
                              <span className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-brand-foreground text-xs font-bold shrink-0">{chapterIndex + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{chapter.title}</p>
                                <span className="text-xs text-[#9fa0b8] capitalize flex items-center gap-1 mt-0.5">
                                  {chapter.contentType === "video" && <Video className="w-3 h-3" />}
                                  {chapter.contentType === "link" && <LinkIcon className="w-3 h-3" />}
                                  {chapter.contentType === "text" && <FileText className="w-3 h-3" />}
                                  {chapter.contentType === "quiz" && <ClipboardList className="w-3 h-3 text-brand" />}
                                  {chapter.contentType === "pdf" && <FileText className="w-3 h-3 text-red-400" />}
                                  {chapter.contentType === "pdf" ? "PDF" : chapter.contentType}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <button type="button" onClick={() => setShowChapterModal({ sectionId: section._id, chapter })}
                                  className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                <button type="button" onClick={() => handleDeleteChapter(section._id, chapter._id)}
                                  className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : !showAddSection ? (
              <div className="border border-dashed border-[#2a2a35] rounded-xl py-8 text-center text-[#6b6b7b] text-sm">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No sections yet.</p>
                <button type="button" onClick={() => setShowAddSection(true)} className="text-brand font-semibold hover:underline mt-1">Add your first section</button>
              </div>
            ) : null}
          </div>

          <div className="h-2" />
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#2a2a35] shrink-0 bg-[#111114]">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={handleClose} className="text-sm font-semibold text-[#9fa0b8] hover:text-white transition-colors px-2.5 py-1.5 rounded-xl hover:bg-[#131316]">Cancel</button>
            {isPaid && price > 0 && (() => {
              const priceDetails = getPriceDetails();
              return (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-6 w-px bg-[#2a2a35]" />
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-[#8b8c9d] uppercase tracking-wide leading-none">iOS</span>
                        <span className="text-[#9fa0b8] font-bold text-sm mt-0.5">
                          N/A
                        </span>
                      </div>
                      <div className="h-5 w-px bg-[#2a2a35]" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-[#8b8c9d] uppercase tracking-wide leading-none">Non-iOS</span>
                        {/* Both figures: what the buyer is charged, and the
                            pre-tax base. Showing only one made it impossible
                            to tell whether GST was already inside the price. */}
                        <span className="text-brand font-bold text-sm mt-0.5 leading-none">
                          {priceDetails.currency}{priceDetails.totalWeb.toFixed(2)}
                          <span className="text-[9px] font-medium text-[#6b6b7b] ml-1">incl. GST</span>
                        </span>
                        <span className="text-[9px] text-[#8b8c9d] mt-0.5 leading-none">
                          {priceDetails.currency}{priceDetails.baseWeb.toFixed(2)} excl. GST
                          {priceDetails.gstWeb > 0 && (
                            <span className="text-[#6b6b7b]"> · GST {priceDetails.currency}{priceDetails.gstWeb.toFixed(2)}</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPriceBreakdownModal(true)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#131316] border border-[#2a2a35] text-[10px] font-bold text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] transition-colors ml-1"
                    >
                      <Info className="w-3.5 h-3.5" />
                      Price Breakdown
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => handleSave(false)} disabled={savingDraft || loading}
              className="text-sm font-semibold text-white border border-[#2a2a35] rounded-xl px-3.5 py-2 hover:bg-[#131316] transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
              {savingDraft && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save as Draft
            </button>
            <button type="button" onClick={() => handleSave(true)} disabled={loading || savingDraft}
              className="text-sm font-bold bg-brand text-brand-foreground rounded-xl px-4 py-2 hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Publish Course
            </button>
          </div>
        </div>
      </div>

      {showChapterModal && (
        <ChapterModal
          isOpen={true}
          onClose={() => setShowChapterModal(null)}
          onSave={(data) => handleSaveChapter(showChapterModal.sectionId, data, showChapterModal.chapter?._id)}
          chapter={showChapterModal.chapter as any}
          course={undefined}
        />
      )}

      {showPriceBreakdownModal && (() => {
        const breakdown = getDetailedPriceBreakdown();
        const formatTablePrice = (amount: number, isMinusOrPlus?: "minus" | "plus" | "none") => {
          const symbol = currency === "INR" ? "₹" : "$";
          if (amount === 0 && isMinusOrPlus === "none") return "-";
          const prefix = isMinusOrPlus === "plus" ? "+" : isMinusOrPlus === "minus" ? "-" : "";
          return `${prefix}${symbol}${amount.toFixed(2)}`;
        };
        const formatCardPrice = (amount: number, curr: string) => {
          const symbol = curr === "INR" ? "₹" : "$";
          return `${symbol}${amount.toFixed(2)}`;
        };

        return (
          <Dialog open={showPriceBreakdownModal} onOpenChange={setShowPriceBreakdownModal}>
            <DialogContent className="bg-[#0e0e12] border-[#2a2a35] z-[1200] max-w-2xl text-white p-6 rounded-2xl" showCloseButton={false}>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold text-white">Price Preview</DialogTitle>
                  <span className="w-2 h-2 rounded-full bg-brand" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPriceBreakdownModal(false)}
                  className="w-7 h-7 rounded-full border border-[#2a2a35] bg-[#1a1a22] flex items-center justify-center text-[#9fa0b8] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* GST only applies to buyers in India — this preview shows
                  that case. Without saying so the numbers read as universal. */}
              <p className="text-[11px] text-[#6b6b7b] leading-relaxed -mt-3 mb-5">
                Figures below are for a buyer <span className="text-[#9fa0b8]">in India</span>, where 18% GST applies.
                Buyers outside India pay no GST: they pay the listed price and
                the full amount counts as your base.
              </p>

              {/* Cards Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* iOS Customers Card */}
                <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-4 flex flex-col space-y-2">
                  <div className="flex items-center gap-1.5 self-start px-2 py-0.5 rounded bg-[#1a1a22] border border-[#2a2a35]/60 text-[10px] font-semibold text-[#9fa0b8]">
                    <Apple className="w-3 h-3 text-[#9fa0b8]" />
                    iOS Customers
                  </div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {formatCardPrice(breakdown.ios.customerPays, currency)}
                  </div>
                  <div className="text-xs text-[#6b6b7b]">
                    one-time payment
                  </div>
                </div>

                {/* Non-iOS Customers Card */}
                <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-4 flex flex-col space-y-2">
                  <div className="flex items-center gap-1.5 self-start px-2 py-0.5 rounded bg-[#1a1a22] border border-[#2a2a35]/60 text-[10px] font-semibold text-[#9fa0b8]">
                    <Smartphone className="w-3 h-3 text-[#9fa0b8]" />
                    Non-iOS Customers
                  </div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {formatCardPrice(breakdown.nonIos.customerPays, currency)}
                  </div>
                  <div className="text-xs text-[#6b6b7b]">
                    one-time payment
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white mb-2">Price Breakdown</h3>
                
                <div className="grid grid-cols-2 gap-8">
                  {/* iOS Column */}
                  <div className="space-y-2">
                    <div className="text-xs text-[#9fa0b8] font-semibold mb-3">iOS Customers</div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>Base price</span>
                      <span className="text-white">{formatTablePrice(breakdown.basePrice)}</span>
                    </div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>Apple fee (30%)</span>
                      <span className="text-[#f43f5e] font-medium">{formatTablePrice(breakdown.ios.appleFee, "plus")}</span>
                    </div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>GST (18%)</span>
                      <span className="text-[#f43f5e] font-medium">{formatTablePrice(breakdown.ios.gst, "plus")}</span>
                    </div>
                    
                    <div className="border-t border-[#2a2a35]/60 my-1 pt-1.5 flex justify-between text-xs font-semibold text-white">
                      <span>Customer pays</span>
                      <span>{formatTablePrice(breakdown.ios.customerPays)}</span>
                    </div>
                    
                    {/* Distribution */}
                    <div className="pt-2">
                      <div className="text-[10px] text-[#6b6b7b] uppercase tracking-wider font-semibold mb-2">DISTRIBUTION</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Government (GST)</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.govGst)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Apple</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.appleDist)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Platform (5%)</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.platformFee)}</span>
                        </div>
                        {breakdown.affPercent > 0 && (
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>→ Affiliate ({breakdown.affPercent}%)</span>
                            <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.affiliateCut)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="border-t border-[#2a2a35]/60 mt-2 pt-2 flex justify-between text-xs font-bold">
                      <span className="text-brand">You receive</span>
                      <span className="text-brand">{formatTablePrice(breakdown.ios.youReceive)}</span>
                    </div>
                  </div>

                  {/* Non-iOS Column */}
                  <div className="space-y-2">
                    <div className="text-xs text-[#9fa0b8] font-semibold mb-3">Non-iOS Customers</div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>Base price</span>
                      <span className="text-white">{formatTablePrice(breakdown.basePrice)}</span>
                    </div>
                    
                    <div className="flex justify-between text-xs text-[#6b6b7b]">
                      <span>Apple fee (30%)</span>
                      <span>-</span>
                    </div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>GST (18%)</span>
                      <span className="text-[#f43f5e] font-medium">{formatTablePrice(breakdown.nonIos.gst, "plus")}</span>
                    </div>
                    
                    <div className="border-t border-[#2a2a35]/60 my-1 pt-1.5 flex justify-between text-xs font-semibold text-white">
                      <span>Customer pays</span>
                      <span>{formatTablePrice(breakdown.nonIos.customerPays)}</span>
                    </div>
                    
                    {/* Distribution */}
                    <div className="pt-2">
                      <div className="text-[10px] text-[#6b6b7b] uppercase tracking-wider font-semibold mb-2">DISTRIBUTION</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Government (GST)</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.nonIos.govGst)}</span>
                        </div>
                        
                        <div className="h-[16px] w-full" />
                        
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Platform (5%)</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.nonIos.platformFee)}</span>
                        </div>
                        {breakdown.affPercent > 0 && (
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>→ Affiliate ({breakdown.affPercent}%)</span>
                            <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.nonIos.affiliateCut)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="border-t border-[#2a2a35]/60 mt-2 pt-2 flex justify-between text-xs font-bold">
                      <span className="text-brand">You receive</span>
                      <span className="text-brand">{formatTablePrice(breakdown.nonIos.youReceive)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}

// Course Edit Modal (Founder) — same design as CreateCourseModal
function CourseEditView({
  course,
  onBack,
  onUpdate,
}: {
  course: Course;
  onBack: () => void;
  onUpdate: (course: Course) => void;
}) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description || "");
  const [coverImage, setCoverImage] = useState(course.coverImage || "");
  const [galleryImages, setGalleryImages] = useState<string[]>(course.galleryImages || []);
  const [videoUrl, setVideoUrl] = useState(course.videoUrl || "");
  const [videoFile, setVideoFile] = useState(course.videoFile || "");
  const [isPaid, setIsPaid] = useState(course.isPaid);
  const [price, setPrice] = useState<number>(course.price || 0);
  const [currency, setCurrency] = useState(course.currency || "USD");
  // Tax + iOS surcharges. Parity with channels/workshops. Default
  // gstInclusive to true so INR sellers who never touch the toggle
  // don't accidentally start charging 18% on top.
  const [gstInclusive, setGstInclusive] = useState<boolean>(
    (course as any).gstInclusive !== undefined
      ? !!(course as any).gstInclusive
      : true
  );
  const [requireIosPayment, setRequireIosPayment] = useState<boolean>(
    !!(course as any).requireIosPayment
  );
  const [appleFeeInclusive, setAppleFeeInclusive] = useState<boolean>(
    !!(course as any).appleFeeInclusive
  );
  const [whatYouWillLearn, setWhatYouWillLearn] = useState<string[]>(
    course.whatYouWillLearn && course.whatYouWillLearn.length > 0 ? course.whatYouWillLearn : [""]
  );
  const [requirements, setRequirements] = useState<string[]>(
    course.requirements && course.requirements.length > 0 ? course.requirements : [""]
  );
  // Audience gating (same behavior as CreateCourseModal). Prefill from
  // whatever the course was previously bound to. If `course.channelIds`
  // comes populated (e.g. as `[{_id,title}]`), unwrap to raw ids.
  const [channelIds, setChannelIds] = useState<string[]>(
    ((course as any).channelIds || []).map((c: any) =>
      typeof c === "object" && c?._id ? c._id : String(c),
    ),
  );
  const [channels, setChannels] = useState<Channel[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [showPriceBreakdownModal, setShowPriceBreakdownModal] = useState(false);
  // Post-purchase order email — prefilled from the saved course.
  const emailAlertsForm = useEmailAlerts(course.emailAlerts);
  const founderAlertsForm = useFounderAlerts((course as any).founderAlerts);
  // Post-purchase thank-you page drawer — same reusable editor Products
  // use. Local mirror of the course so the "· configured" badge updates
  // instantly on save without waiting for the parent to refetch.
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const [thankYouSnapshot, setThankYouSnapshot] = useState(course.thankYouPage);
  useEffect(() => {
    setThankYouSnapshot(course.thankYouPage);
  }, [course._id, course.thankYouPage]);

  const getAffiliateInfo = () => {
    if (typeof window !== "undefined" && (window as any).__commissionPlanInfo) {
      return (window as any).__commissionPlanInfo;
    }
    return { enabled: false, levels: [], totalCommission: 0 };
  };

  const getPriceDetails = () => {
    const p = price || 0;
    const symbol = currency === "INR" ? "₹" : "$";
    let baseWeb = p;
    let gstWeb = 0;
    let totalWeb = p;
    if (p > 0) {
      if (gstInclusive) {
        baseWeb = p / 1.18;
        gstWeb = p - baseWeb;
        totalWeb = p;
      } else {
        baseWeb = p;
        gstWeb = p * 0.18;
        totalWeb = p + gstWeb;
      }
    }
    let totalIos = totalWeb;
    let appleCut = 0;
    if (requireIosPayment && p > 0) {
      if (appleFeeInclusive) {
        totalIos = totalWeb;
        appleCut = totalWeb * 0.3;
      } else {
        totalIos = totalWeb / 0.7;
        appleCut = totalIos * 0.3;
      }
    }
    return { currency: symbol, baseWeb, gstWeb, totalWeb, totalIos, appleCut };
  };

  const getDetailedPriceBreakdown = () => {
    const priceVal = price || 0;
    const isInclusive = gstInclusive;
    const affInfo = getAffiliateInfo();
    const affPercent = affInfo.enabled ? affInfo.totalCommission : 0;
    
    const basePrice = isInclusive ? priceVal / 1.18 : priceVal;
    
    const nonIosAppleFee = 0;
    const nonIosGst = basePrice * 0.18;
    const nonIosCustomerPays = isInclusive ? priceVal : basePrice + nonIosGst;
    
    const nonIosGovGst = nonIosGst;
    const nonIosAppleDist = 0;
    const nonIosPlatformFee = basePrice * 0.05;
    const nonIosAffiliateCut = basePrice * (affPercent / 100);
    const nonIosYouReceive = basePrice - nonIosPlatformFee - nonIosAffiliateCut;
    
    const iosAppleFee = basePrice * 0.30;
    const iosGst = (basePrice + iosAppleFee) * 0.18;
    const iosCustomerPays = basePrice + iosAppleFee + iosGst;
    
    const iosGovGst = iosGst;
    const iosAppleDist = iosAppleFee;
    const iosPlatformFee = basePrice * 0.05;
    const iosAffiliateCut = basePrice * (affPercent / 100);
    const iosYouReceive = basePrice - iosPlatformFee - iosAffiliateCut;

    return {
      basePrice,
      affPercent,
      nonIos: {
        appleFee: nonIosAppleFee,
        gst: nonIosGst,
        customerPays: nonIosCustomerPays,
        govGst: nonIosGovGst,
        appleDist: nonIosAppleDist,
        platformFee: nonIosPlatformFee,
        affiliateCut: nonIosAffiliateCut,
        youReceive: nonIosYouReceive
      },
      ios: {
        appleFee: iosAppleFee,
        gst: iosGst,
        customerPays: iosCustomerPays,
        govGst: iosGovGst,
        appleDist: iosAppleDist,
        platformFee: iosPlatformFee,
        affiliateCut: iosAffiliateCut,
        youReceive: iosYouReceive
      }
    };
  };

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fetch the org's channels on mount so the picker has options to show.
  useEffect(() => {
    const orgId = typeof window !== "undefined"
      ? localStorage.getItem("garage_org_id")
      : null;
    if (!orgId) return;
    let cancelled = false;
    getOrgChannels(orgId)
      .then((res) => {
        if (!cancelled) setChannels(res.channels || []);
      })
      .catch((err) => {
        console.error("Failed to fetch channels for course edit picker:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Section/chapter state (live – backed by server immediately)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(course.sections.map((s) => s._id))
  );
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState<{ sectionId: string; chapter?: CourseChapter } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // ── Save course metadata ──────────────────────────────────────────────────
  const handleSave = async (publish?: boolean) => {
    if (!title.trim()) { toast.error("Please enter a course title"); return; }
    if (channelIds.length === 0) { toast.error("Please select at least one community"); return; }
    const validLearn = whatYouWillLearn.filter((s) => s.trim());
    if (validLearn.length === 0) { toast.error("Please add at least one 'What you'll learn' point"); return; }
    const validReqs = requirements.filter((s) => s.trim());
    if (validReqs.length === 0) { toast.error("Please add at least one requirement"); return; }
    if (isPaid && price <= 0) { toast.error("Please enter a valid price"); return; }
    const emailAlertsMsg = emailAlertsForm.validate();
    if (emailAlertsMsg) { toast.error(emailAlertsMsg); return; }
    setSaving(true);
    try {
      const updated = await updateCourse(course._id, {
        title: title.trim(),
        description: description || undefined,
        coverImage: coverImage || undefined,
        galleryImages,
        videoUrl: videoUrl || undefined,
        videoFile: videoFile || undefined,
        isPaid,
        price: isPaid ? price : 0,
        currency,
        gstInclusive,
        requireIosPayment,
        appleFeeInclusive,
        whatYouWillLearn: whatYouWillLearn.filter((s) => s.trim()),
        requirements: requirements.filter((s) => s.trim()),
        channelIds,
        emailAlerts: emailAlertsForm.buildPayload(),
        founderAlerts: founderAlertsForm.buildPayload(),
        ...(publish ? { status: "published" } : {}),
      } as any);
      emailAlertsForm.noteTemplateUse();
      onUpdate(updated);
      if (publish) announceCourse(updated, false);
      else toast.success("Course saved successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save course");
    } finally {
      setSaving(false);
    }
  };

  // ── Image upload ─────────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be less than 5MB"); return; }
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setCoverImage(data.url);
      toast.success("Image uploaded");
    } catch { toast.error("Failed to upload image"); }
    finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentCount = galleryImages.length;
    if (currentCount >= 3) {
      toast.error("You can upload a maximum of 3 gallery images");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be less than 5MB"); return; }
    setUploadingGallery(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      const token = getToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formDataUpload,
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setGalleryImages((prev) => [...prev, data.url]);
      toast.success("Gallery image uploaded successfully");
    } catch {
      toast.error("Failed to upload gallery image");
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file (MP4 etc.)");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error("Video must be less than 500MB");
      return;
    }
    setUploadingVideo(true);
    try {
      const token = getToken();
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formDataUpload,
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setVideoFile(data.url);
      setVideoUrl("");
      toast.success("Video uploaded successfully");
    } catch {
      toast.error("Failed to upload video");
    } finally {
      setUploadingVideo(false);
      if (videoFileInputRef.current) videoFileInputRef.current.value = "";
    }
  };

  const removeUploadedVideo = () => {
    setVideoFile("");
  };

  // ── Section handlers (immediate API) ────────────────────────────────────
  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) { toast.error("Please enter a section title"); return; }
    try {
      const updated = await addCourseSection(course._id, newSectionTitle.trim());
      onUpdate(updated);
      setNewSectionTitle(""); setShowAddSection(false);
      const newSec = updated.sections[updated.sections.length - 1];
      setExpandedSections((prev) => new Set([...prev, newSec._id]));
      toast.success("Section added");
    } catch { toast.error("Failed to add section"); }
  };

  const handleUpdateSection = async (sectionId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const updated = await updateCourseSection(course._id, sectionId, newTitle.trim());
      onUpdate(updated); setEditingSectionId(null);
    } catch { toast.error("Failed to update section"); }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      const updated = await deleteCourseSection(course._id, sectionId);
      onUpdate(updated);
    } catch { toast.error("Failed to delete section"); }
  };

  const handleSaveChapter = async (sectionId: string, chapterData: any, chapterId?: string) => {
    try {
      let updated: Course;
      if (chapterId) {
        updated = await updateCourseChapter(course._id, sectionId, chapterId, chapterData);
      } else {
        updated = await addCourseChapter(course._id, sectionId, chapterData);
      }
      onUpdate(updated); setShowChapterModal(null);
      toast.success(chapterId ? "Chapter updated" : "Chapter added");
    } catch { toast.error("Failed to save chapter"); }
  };

  const handleDeleteChapter = async (sectionId: string, chapterId: string) => {
    try {
      const updated = await deleteCourseChapter(course._id, sectionId, chapterId);
      onUpdate(updated);
    } catch { toast.error("Failed to delete chapter"); }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const n = new Set(prev);
      n.has(sectionId) ? n.delete(sectionId) : n.add(sectionId);
      return n;
    });
  };

  return (
    <div className="w-full min-h-full flex-1 bg-[#0a0a0d] flex flex-col">
      {/* Sleek Page Header */}
      <div className="border-b border-[#2a2a35] bg-[#0e0e12] px-6 py-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center text-[#9fa0b8] hover:text-white transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Courses
            </button>
            <div className="h-6 w-px bg-[#2a2a35] hidden md:block" />
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-white truncate max-w-md leading-none pt-0.5">
                {course.title}
              </h1>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                course.status === "published" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400")}>
                {course.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-8 space-y-6">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleGalleryUpload} className="hidden" />
          <input ref={videoFileInputRef} type="file" accept="video/mp4" onChange={handleVideoUpload} className="hidden" />

          {/* Course Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#9fa0b8]">Course Title <span className="text-brand font-bold">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 100))} placeholder="e.g. Complete Web Development Bootcamp" maxLength={100}
              className="w-full bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:border-brand/60 transition-colors placeholder:text-[#4a4a5a]" />
            <p className="text-xs text-[#6b6b7b] text-right">{title.length}/100 characters</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#9fa0b8]">Description</label>
            <DescriptionEditor value={description} onChange={setDescription} placeholder="Enter a brief summary of what this course is about..." />
          </div>

          {/* Audience — select mandatory community */}
          <ChannelMultiSelect
            channels={channels}
            selectedIds={channelIds}
            onChange={setChannelIds}
            required={true}
            hint="Select at least one community that will have access to this course."
          />

          {/* Cover Image & Gallery */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
              Upload Images
            </label>
            {/* Main Cover Box */}
            {coverImage ? (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-[#2a2a35] bg-[#131316]">
                <img src={coverImage} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImage("")}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                className="border border-dashed border-[#2a2a35] rounded-xl w-full flex items-center hover:border-brand/50 transition-colors cursor-pointer bg-[#131316]/60 hover:bg-[#131316]/80"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingImage ? (
                  <div className="w-full py-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-brand animate-spin" />
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-5 w-full">
                    <div className="w-12 h-12 rounded-xl bg-[#131316] flex items-center justify-center border border-[#2a2a35] shrink-0">
                      <ImageIcon className="w-5 h-5 text-[#9fa0b8]" />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-semibold text-white block">Upload cover image</span>
                      <p className="text-xs text-[#6b6b7b] mt-0.5">
                        Images should be horizontal, at least 1280×720px. PNG or JPG, up to 5mb
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3 Gallery slots below cover image */}
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, index) => {
                const imgUrl = galleryImages[index];
                return (
                  <div key={index} className="aspect-video w-full">
                    {imgUrl ? (
                      <div className="relative w-full h-full rounded-xl overflow-hidden border border-[#2a2a35] bg-[#131316]">
                        <img src={imgUrl} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setGalleryImages(prev => prev.filter((_, i) => i !== index))}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          galleryInputRef.current?.click();
                        }}
                        className="border border-dashed border-[#2a2a35] rounded-xl w-full h-full flex flex-col items-center justify-center hover:border-brand/50 transition-colors cursor-pointer bg-[#131316]/60 hover:bg-[#131316]/80"
                      >
                        {uploadingGallery && index === galleryImages.length ? (
                          <Loader2 className="w-5 h-5 text-brand animate-spin" />
                        ) : (
                          <Plus className="w-5 h-5 text-[#9fa0b8]" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Introduction Video */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
              Introduction Video
            </label>
            <div className="space-y-4">
              {/* YouTube Paste Input */}
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-[#9fa0b8]/60">
                  <Video className="w-4 h-4" />
                </span>
                <input
                  value={videoUrl}
                  onChange={(e) => {
                    setVideoUrl(e.target.value);
                    setVideoFile(""); // clear uploaded file if link is provided
                  }}
                  placeholder="Paste YouTube link..."
                  className="bg-[#131316] border border-[#2a2a35] text-white pl-10 h-10 text-sm rounded-lg focus:ring-brand/50 focus:border-brand/50 w-full"
                />
              </div>

              {videoUrl && (() => {
                const getYouTubeEmbedUrl = (url: string) => {
                  if (url.includes("youtu.be/")) {
                    const parts = url.split("youtu.be/");
                    if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                  } else if (url.includes("youtube.com/watch?v=")) {
                    const parts = url.split("v=");
                    if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("&")[0]}`;
                  } else if (url.includes("youtube.com/embed/")) {
                    const parts = url.split("embed/");
                    if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                  }
                  return "";
                };
                const embedUrl = getYouTubeEmbedUrl(videoUrl);
                if (!embedUrl) return null;
                return (
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-[#2a2a35] bg-black">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                );
              })()}

              {/* Divider OR */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[#2a2a35]/40"></div>
                <span className="flex-shrink mx-4 text-xs font-semibold text-[#6b6b7b]">OR</span>
                <div className="flex-grow border-t border-[#2a2a35]/40"></div>
              </div>

              {/* Video Upload Box */}
              <div>
                {videoFile ? (
                  <div className="border border-green-500/30 bg-green-500/5 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Video uploaded</p>
                        <p className="text-xs text-green-400">Ready to save</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeUploadedVideo}
                      className="text-[#9fa0b8] hover:text-red-400 transition-colors p-1.5 rounded-lg border border-[#2a2a35] hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : uploadingVideo ? (
                  <div className="border border-[#2a2a35] rounded-xl p-5 flex flex-col items-center justify-center gap-2 bg-[#13131a]/40">
                    <Loader2 className="w-6 h-6 text-brand animate-spin" />
                    <span className="text-xs text-[#9fa0b8]">Uploading video...</span>
                  </div>
                ) : (
                  <div
                    onClick={() => videoFileInputRef.current?.click()}
                    className="border border-dashed border-[#2a2a35] hover:border-brand/50 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer bg-[#131316]/60 hover:bg-[#131316]/80 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#131316] flex items-center justify-center border border-[#2a2a35]">
                      <Upload className="w-4 h-4 text-[#9fa0b8]" />
                    </div>
                    <span className="text-sm font-semibold text-white">Upload MP4 video</span>
                    <p className="text-xs text-[#6b6b7b]">Max 500MB • .mp4 format</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* What You'll Learn */}
          <div className="space-y-3 pb-4 border-b border-[#2a2a35]/40">
            <label className="text-xs font-semibold text-[#9fa0b8]">
              {"What You'll Learn"} <span className="text-brand font-bold">*</span>
            </label>
            {whatYouWillLearn.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input value={item} onChange={(e) => { const u = [...whatYouWillLearn]; u[idx] = e.target.value; setWhatYouWillLearn(u); }}
                  placeholder="What students will learn"
                  className="flex-1 bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-brand/60 transition-colors placeholder:text-[#4a4a5a]" />
                {whatYouWillLearn.length > 1 && (
                  <button type="button" onClick={() => setWhatYouWillLearn(whatYouWillLearn.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-lg text-[#6b6b7b] hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setWhatYouWillLearn([...whatYouWillLearn, ""])}
                disabled={whatYouWillLearn.length >= MAX_LEARNING_POINTS}
                className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:opacity-80 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                <PlusCircle className="w-4 h-4" /> Add item
              </button>
              {whatYouWillLearn.length >= MAX_LEARNING_POINTS && (
                <span className="text-[11px] text-[#6b6b7b]">
                  {limitReachedLabel(MAX_LEARNING_POINTS, "items")}
                </span>
              )}
            </div>
          </div>

          {/* Requirements */}
          <div className="space-y-3 pb-4 border-b border-[#2a2a35]/40">
            <label className="text-xs font-semibold text-[#9fa0b8]">
              Requirements <span className="text-brand font-bold">*</span>
            </label>
            {requirements.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input value={item} onChange={(e) => { const u = [...requirements]; u[idx] = e.target.value; setRequirements(u); }}
                  placeholder="Course requirement"
                  className="flex-1 bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-brand/60 transition-colors placeholder:text-[#4a4a5a]" />
                {requirements.length > 1 && (
                  <button type="button" onClick={() => setRequirements(requirements.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-lg text-[#6b6b7b] hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setRequirements([...requirements, ""])}
                disabled={requirements.length >= MAX_LEARNING_POINTS}
                className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:opacity-80 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                <PlusCircle className="w-4 h-4" /> Add item
              </button>
              {requirements.length >= MAX_LEARNING_POINTS && (
                <span className="text-[11px] text-[#6b6b7b]">
                  {limitReachedLabel(MAX_LEARNING_POINTS, "items")}
                </span>
              )}
            </div>
          </div>

          {/* Course Type */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#9fa0b8]">Course Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setIsPaid(false)}
                className={cn("flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition-all text-left",
                  !isPaid ? "border-brand bg-brand/10 text-brand" : "border-[#2a2a35] bg-[#131316] text-[#9fa0b8] hover:border-[#3a3a45]")}>
                <BookOpen className="w-5 h-5" />
                <span className="text-sm font-semibold">Free Course</span>
                <span className="text-xs opacity-70">No payment required</span>
              </button>
              <button type="button" onClick={() => setIsPaid(true)}
                className={cn("flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition-all text-left",
                  isPaid ? "border-brand bg-brand/10 text-brand" : "border-[#2a2a35] bg-[#131316] text-[#9fa0b8] hover:border-[#3a3a45]")}>
                <DollarSign className="w-5 h-5" />
                <span className="text-sm font-semibold">Paid Course</span>
                <span className="text-xs opacity-70">Set your price</span>
              </button>
            </div>
          </div>

          {/* Pricing */}
          {isPaid && (
            <div className="space-y-3 pb-4 border-b border-[#2a2a35]/40">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#9fa0b8]">Regular Price <span className="text-brand">*</span></label>
                <div className="flex gap-2">
                  <div className="w-36 shrink-0">
                    <CurrencyDropdown value={currency} onChange={setCurrency} />
                  </div>
                  <input type="number" value={price || ""} onChange={(e) => setPrice(Number(e.target.value))} onWheel={(e) => e.currentTarget.blur()} placeholder="100" min={0}
                    className="flex-1 bg-[#131316] border border-[#2a2a35] text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:border-brand/60 transition-colors placeholder:text-[#4a4a5a]" />
                </div>
              </div>

              {/* GST / Tax toggle — affects invoices for INR sales only.
                  Render the toggle regardless of currency so switching
                  to INR later doesn't require re-editing. */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-[#9fa0b8]">
                  GST / Tax
                </label>
                <p className="text-[11px] text-[#6b6b7b] leading-relaxed">
                  18.00% GST (Goods &amp; Services Tax) applies to buyers in
                  India, whatever currency you price in. Does the price above
                  already include it?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGstInclusive(true)}
                    className={cn(
                      "text-left p-3 rounded-xl border transition-all",
                      gstInclusive
                        ? "bg-brand/5 border-brand"
                        : "bg-[#131316] border-[#2a2a35] hover:border-[#3a3a45]"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {gstInclusive && (
                        <span className="w-2 h-2 rounded-full bg-brand" />
                      )}
                      <span className="text-sm font-semibold text-white">
                        Yes, I&apos;ll cover it in the above price
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9fa0b8]">
                      Listed price already includes 18% GST.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGstInclusive(false)}
                    className={cn(
                      "text-left p-3 rounded-xl border transition-all",
                      !gstInclusive
                        ? "bg-brand/5 border-brand"
                        : "bg-[#131316] border-[#2a2a35] hover:border-[#3a3a45]"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {!gstInclusive && (
                        <span className="w-2 h-2 rounded-full bg-brand" />
                      )}
                      <span className="text-sm font-semibold text-white">
                        No, add it on top
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9fa0b8]">
                      18% GST added to the total at checkout.
                    </p>
                  </button>
                </div>
              </div>

              {/* iOS App Purchases */}
              <div className="space-y-2 pt-2">
                <span className="block text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
                  iOS App Purchases
                </span>
                <p className="text-xs text-[#9fa0b8] leading-normal">
                  Do you require your customers to be able to pay for this course on the iOS app?
                </p>
                <div className="flex rounded-lg border border-[#2a2a35] bg-[#131316] p-1 w-full gap-1">
                  <button
                    type="button"
                    className="flex-1 py-2 text-xs font-bold rounded-md transition-all text-center bg-brand text-brand-foreground"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.info("iOS app purchases coming soon!")}
                    className="flex-1 py-2 text-xs font-medium rounded-md transition-all text-center text-[#8b8c9d] bg-transparent hover:bg-[#1a1a22] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Yes <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2a2a35] text-brand font-medium">Coming Soon</span>
                  </button>
                </div>
              </div>

              {/* Affiliate Commission */}
              <div className="pt-2">
                <CommissionPlanSection itemType="course" itemId={course._id} itemName={title || "Course"} isPaid={isPaid} />
              </div>
            </div>
          )}

          {/* Post-purchase order email */}
          <ProductEmailAlertsSection
            {...emailAlertsForm.sectionProps}
            product={{
              productName: title,
              price: price,
              currency,
              isFree: !isPaid,
            }}
          />

          {/* Founder's own "someone enrolled" alert */}
          <FounderAlertsSection
            {...founderAlertsForm.sectionProps}
            context="course"
          />

          {/* Post-purchase thank-you page trigger (opens the same drawer
              Products use). No digital gate — every course is digital. */}
          <button
            type="button"
            onClick={() => setThankYouOpen(true)}
            className="w-full text-left rounded-xl border border-[#2a2a35] hover:border-brand/40 bg-[#0e0e12] hover:bg-[#111114] transition-colors px-4 py-3 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">
                Post-purchase page
                {thankYouSnapshot ? (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    · configured
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-[#9fa0b8] mt-0.5">
                Redirect buyers, or show a custom message and CTAs after
                they pay.
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#9fa0b8] shrink-0" />
          </button>

          {/* Course Content */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Course Content</span>
              <button type="button" onClick={() => setShowAddSection(true)}
                className="text-xs font-semibold text-white border border-[#2a2a35] rounded-xl px-3 py-1.5 hover:bg-[#1a1a22] transition-colors flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            </div>

            {showAddSection && (
              <div className="flex items-center gap-2 p-3 bg-[#131316] border border-[#2a2a35] rounded-xl">
                <input value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddSection(); if (e.key === "Escape") { setShowAddSection(false); setNewSectionTitle(""); } }}
                  placeholder="Section title e.g. Introduction" autoFocus
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[#4a4a5a]" />
                <button type="button" onClick={handleAddSection}
                  className="text-xs font-bold bg-brand text-brand-foreground rounded-lg px-3 py-1.5 hover:opacity-90 transition-colors">
                  Add
                </button>
                <button type="button" onClick={() => { setShowAddSection(false); setNewSectionTitle(""); }}
                  className="text-xs text-[#9fa0b8] hover:text-white px-2 py-1.5 transition-colors">Cancel</button>
              </div>
            )}

            {course.sections.length > 0 ? (
              <div className="space-y-2">
                {course.sections.map((section) => (
                  <div key={section._id} className="border border-[#2a2a35] rounded-xl overflow-hidden bg-[#131316]">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button type="button" onClick={() => toggleSection(section._id)} className="text-[#9fa0b8] hover:text-white transition-colors">
                        {expandedSections.has(section._id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      {editingSectionId === section._id ? (
                        <input defaultValue={section.title} autoFocus
                          onBlur={(e) => handleUpdateSection(section._id, e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleUpdateSection(section._id, (e.target as HTMLInputElement).value); if (e.key === "Escape") setEditingSectionId(null); }}
                          className="flex-1 bg-transparent text-white text-sm outline-none border-b border-brand/40" />
                      ) : (
                        <span className="flex-1 text-white text-sm font-medium">{section.title}</span>
                      )}
                      <span className="text-xs text-[#6b6b7b]">{section.chapters.length} chapters</span>
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => setShowChapterModal({ sectionId: section._id })}
                          className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => setEditingSectionId(section._id)}
                          className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => handleDeleteSection(section._id)}
                          className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    {expandedSections.has(section._id) && (
                      <div className="border-t border-[#2a2a35]">
                        {section.chapters.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-[#6b6b7b]">
                            No chapters yet.{" "}
                            <button type="button" onClick={() => setShowChapterModal({ sectionId: section._id })}
                              className="text-brand font-semibold hover:underline">Add one</button>
                          </div>
                        ) : (
                          section.chapters.map((chapter, chapterIndex) => (
                            <div key={chapter._id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a2a35] last:border-b-0 hover:bg-[#1a1a22] transition-colors">
                              <span className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-brand-foreground text-xs font-bold shrink-0">{chapterIndex + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{chapter.title}</p>
                                <span className="text-xs text-[#9fa0b8] capitalize flex items-center gap-1 mt-0.5">
                                  {chapter.contentType === "video" && <Video className="w-3 h-3" />}
                                  {chapter.contentType === "link" && <LinkIcon className="w-3 h-3" />}
                                  {chapter.contentType === "text" && <FileText className="w-3 h-3" />}
                                  {chapter.contentType === "quiz" && <ClipboardList className="w-3 h-3 text-brand" />}
                                  {chapter.contentType === "pdf" && <FileText className="w-3 h-3 text-red-400" />}
                                  {chapter.contentType === "pdf" ? "PDF" : chapter.contentType}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <button type="button" onClick={() => setShowChapterModal({ sectionId: section._id, chapter })}
                                  className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                <button type="button" onClick={() => handleDeleteChapter(section._id, chapter._id)}
                                  className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : !showAddSection ? (
              <div className="border border-dashed border-[#2a2a35] rounded-xl py-8 text-center text-[#6b6b7b] text-sm">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No sections yet.</p>
                <button type="button" onClick={() => setShowAddSection(true)} className="text-brand font-semibold hover:underline mt-1">
                  Add your first section
                </button>
              </div>
            ) : null}
          </div>

          <div className="h-2" />
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 bg-[#0e0e12]/95 backdrop-blur-sm border-t border-[#2a2a35] py-3.5 px-6 z-10 shrink-0 mt-auto">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={onBack}
              className="text-sm font-semibold text-[#9fa0b8] hover:text-white transition-colors px-2.5 py-1.5 rounded-xl hover:bg-[#131316]">
              Close
            </button>
            {isPaid && price > 0 && (() => {
              const priceDetails = getPriceDetails();
              return (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-6 w-px bg-[#2a2a35]" />
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-[#8b8c9d] uppercase tracking-wide leading-none">iOS</span>
                        <span className="text-[#9fa0b8] font-bold text-sm mt-0.5">
                          N/A
                        </span>
                      </div>
                      <div className="h-5 w-px bg-[#2a2a35]" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-[#8b8c9d] uppercase tracking-wide leading-none">Non-iOS</span>
                        {/* Both figures: what the buyer is charged, and the
                            pre-tax base. Showing only one made it impossible
                            to tell whether GST was already inside the price. */}
                        <span className="text-brand font-bold text-sm mt-0.5 leading-none">
                          {priceDetails.currency}{priceDetails.totalWeb.toFixed(2)}
                          <span className="text-[9px] font-medium text-[#6b6b7b] ml-1">incl. GST</span>
                        </span>
                        <span className="text-[9px] text-[#8b8c9d] mt-0.5 leading-none">
                          {priceDetails.currency}{priceDetails.baseWeb.toFixed(2)} excl. GST
                          {priceDetails.gstWeb > 0 && (
                            <span className="text-[#6b6b7b]"> · GST {priceDetails.currency}{priceDetails.gstWeb.toFixed(2)}</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPriceBreakdownModal(true)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#131316] border border-[#2a2a35] text-[10px] font-bold text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] transition-colors ml-1"
                    >
                      <Info className="w-3.5 h-3.5" />
                      Price Breakdown
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => handleSave()} disabled={saving}
              className="text-sm font-semibold text-white border border-[#2a2a35] rounded-xl px-3.5 py-2 hover:bg-[#131316] transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Changes
            </button>
            {course.status !== "published" && (
              <button type="button" onClick={() => handleSave(true)} disabled={saving}
                className="text-sm font-bold bg-brand text-brand-foreground rounded-xl px-4 py-2 hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Publish Course
              </button>
            )}
          </div>
        </div>
      </div>

      {showChapterModal && (
        <ChapterModal
          isOpen={true}
          onClose={() => setShowChapterModal(null)}
          onSave={(data) => handleSaveChapter(showChapterModal.sectionId, data, showChapterModal.chapter?._id)}
          chapter={showChapterModal.chapter}
          course={course}
        />
      )}

      {showPriceBreakdownModal && (() => {
        const breakdown = getDetailedPriceBreakdown();
        const formatTablePrice = (amount: number, isMinusOrPlus?: "minus" | "plus" | "none") => {
          const symbol = currency === "INR" ? "₹" : "$";
          if (amount === 0 && isMinusOrPlus === "none") return "-";
          const prefix = isMinusOrPlus === "plus" ? "+" : isMinusOrPlus === "minus" ? "-" : "";
          return `${prefix}${symbol}${amount.toFixed(2)}`;
        };
        const formatCardPrice = (amount: number, curr: string) => {
          const symbol = curr === "INR" ? "₹" : "$";
          return `${symbol}${amount.toFixed(2)}`;
        };

        return (
          <Dialog open={showPriceBreakdownModal} onOpenChange={setShowPriceBreakdownModal}>
            <DialogContent className="bg-[#0e0e12] border-[#2a2a35] z-[1200] max-w-2xl text-white p-6 rounded-2xl" showCloseButton={false}>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold text-white">Price Preview</DialogTitle>
                  <span className="w-2 h-2 rounded-full bg-brand" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPriceBreakdownModal(false)}
                  className="w-7 h-7 rounded-full border border-[#2a2a35] bg-[#1a1a22] flex items-center justify-center text-[#9fa0b8] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* GST only applies to buyers in India — this preview shows
                  that case. Without saying so the numbers read as universal. */}
              <p className="text-[11px] text-[#6b6b7b] leading-relaxed -mt-3 mb-5">
                Figures below are for a buyer <span className="text-[#9fa0b8]">in India</span>, where 18% GST applies.
                Buyers outside India pay no GST: they pay the listed price and
                the full amount counts as your base.
              </p>

              {/* Cards Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* iOS Customers Card */}
                <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-4 flex flex-col space-y-2">
                  <div className="flex items-center gap-1.5 self-start px-2 py-0.5 rounded bg-[#1a1a22] border border-[#2a2a35]/60 text-[10px] font-semibold text-[#9fa0b8]">
                    <Apple className="w-3 h-3 text-[#9fa0b8]" />
                    iOS Customers
                  </div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {formatCardPrice(breakdown.ios.customerPays, currency)}
                  </div>
                  <div className="text-xs text-[#6b6b7b]">
                    one-time payment
                  </div>
                </div>

                {/* Non-iOS Customers Card */}
                <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-4 flex flex-col space-y-2">
                  <div className="flex items-center gap-1.5 self-start px-2 py-0.5 rounded bg-[#1a1a22] border border-[#2a2a35]/60 text-[10px] font-semibold text-[#9fa0b8]">
                    <Smartphone className="w-3 h-3 text-[#9fa0b8]" />
                    Non-iOS Customers
                  </div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {formatCardPrice(breakdown.nonIos.customerPays, currency)}
                  </div>
                  <div className="text-xs text-[#6b6b7b]">
                    one-time payment
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="bg-[#13131a] border border-[#2a2a35] rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white mb-2">Price Breakdown</h3>
                
                <div className="grid grid-cols-2 gap-8">
                  {/* iOS Column */}
                  <div className="space-y-2">
                    <div className="text-xs text-[#9fa0b8] font-semibold mb-3">iOS Customers</div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>Base price</span>
                      <span className="text-white">{formatTablePrice(breakdown.basePrice)}</span>
                    </div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>Apple fee (30%)</span>
                      <span className="text-[#f43f5e] font-medium">{formatTablePrice(breakdown.ios.appleFee, "plus")}</span>
                    </div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>GST (18%)</span>
                      <span className="text-[#f43f5e] font-medium">{formatTablePrice(breakdown.ios.gst, "plus")}</span>
                    </div>
                    
                    <div className="border-t border-[#2a2a35]/60 my-1 pt-1.5 flex justify-between text-xs font-semibold text-white">
                      <span>Customer pays</span>
                      <span>{formatTablePrice(breakdown.ios.customerPays)}</span>
                    </div>
                    
                    {/* Distribution */}
                    <div className="pt-2">
                      <div className="text-[10px] text-[#6b6b7b] uppercase tracking-wider font-semibold mb-2">DISTRIBUTION</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Government (GST)</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.govGst)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Apple</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.appleDist)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Platform (5%)</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.platformFee)}</span>
                        </div>
                        {breakdown.affPercent > 0 && (
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>→ Affiliate ({breakdown.affPercent}%)</span>
                            <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.ios.affiliateCut)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="border-t border-[#2a2a35]/60 mt-2 pt-2 flex justify-between text-xs font-bold">
                      <span className="text-brand">You receive</span>
                      <span className="text-brand">{formatTablePrice(breakdown.ios.youReceive)}</span>
                    </div>
                  </div>

                  {/* Non-iOS Column */}
                  <div className="space-y-2">
                    <div className="text-xs text-[#9fa0b8] font-semibold mb-3">Non-iOS Customers</div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>Base price</span>
                      <span className="text-white">{formatTablePrice(breakdown.basePrice)}</span>
                    </div>
                    
                    <div className="flex justify-between text-xs text-[#6b6b7b]">
                      <span>Apple fee (30%)</span>
                      <span>-</span>
                    </div>
                    
                    <div className="flex justify-between text-xs text-[#9fa0b8]">
                      <span>GST (18%)</span>
                      <span className="text-[#f43f5e] font-medium">{formatTablePrice(breakdown.nonIos.gst, "plus")}</span>
                    </div>
                    
                    <div className="border-t border-[#2a2a35]/60 my-1 pt-1.5 flex justify-between text-xs font-semibold text-white">
                      <span>Customer pays</span>
                      <span>{formatTablePrice(breakdown.nonIos.customerPays)}</span>
                    </div>
                    
                    {/* Distribution */}
                    <div className="pt-2">
                      <div className="text-[10px] text-[#6b6b7b] uppercase tracking-wider font-semibold mb-2">DISTRIBUTION</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Government (GST)</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.nonIos.govGst)}</span>
                        </div>
                        
                        <div className="h-[16px] w-full" />
                        
                        <div className="flex justify-between text-xs text-[#9fa0b8]">
                          <span>→ Platform (5%)</span>
                          <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.nonIos.platformFee)}</span>
                        </div>
                        {breakdown.affPercent > 0 && (
                          <div className="flex justify-between text-xs text-[#9fa0b8]">
                            <span>→ Affiliate ({breakdown.affPercent}%)</span>
                            <span className="text-[#9fa0b8]">{formatTablePrice(breakdown.nonIos.affiliateCut)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="border-t border-[#2a2a35]/60 mt-2 pt-2 flex justify-between text-xs font-bold">
                      <span className="text-brand">You receive</span>
                      <span className="text-brand">{formatTablePrice(breakdown.nonIos.youReceive)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Post-purchase thank-you page editor drawer (founder-only).
          Same reusable component Products use. itemType="course" wires
          save through updateCourse; the drawer renders nothing until
          `open`, so mounting here is free. */}
      <ProductThankYouPageEditor
        item={{ ...course, thankYouPage: thankYouSnapshot }}
        itemType="course"
        open={thankYouOpen}
        onClose={() => setThankYouOpen(false)}
        onSaved={(updated) => {
          // itemType="course" always returns a Course here.
          const c = updated as Course;
          setThankYouSnapshot(c.thankYouPage);
          onUpdate({ ...course, thankYouPage: c.thankYouPage });
        }}
      />
    </div>
  );
}

// Quiz Analytics Section (for founders in CourseEditView)
function QuizAnalyticsSection({ courseId }: { courseId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState<QuizAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAnalytics = async () => {
    if (analytics) { setExpanded(!expanded); return; }
    setLoading(true);
    setExpanded(true);
    try {
      const data = await getQuizAnalytics(courseId);
      setAnalytics(data);
    } catch (error) {
      console.error("Error loading quiz analytics:", error);
      toast.error("Failed to load quiz analytics");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-[#2a2a35] bg-[#0e0e12]">
      <button
        onClick={loadAnalytics}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#1a1a22] transition-colors"
      >
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-brand" />
          <span className="text-white font-medium">Quiz Analytics</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-[#9fa0b8]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#9fa0b8]" />
        )}
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-brand" />
            </div>
          ) : analytics && analytics.quizzes.length > 0 ? (
            <div className="space-y-4">
              {analytics.quizzes.map((q) => (
                <div key={q.chapterId} className="bg-[#1a1a22] rounded-lg p-4 border border-[#2a2a35]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-white font-medium text-sm">{q.chapterTitle}</h4>
                      <p className="text-xs text-[#9fa0b8]">{q.sectionTitle}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-[#9fa0b8]">
                        <Users className="w-3 h-3 inline mr-1" />{q.uniqueStudents} students
                      </span>
                      <span className="text-[#9fa0b8]">
                        {q.totalAttempts} attempts
                      </span>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-[#0e0e12] rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold" style={{ color: q.passRate >= 70 ? "#4ade80" : q.passRate >= 40 ? "#FBD10D" : "#f87171" }}>
                        {q.passRate}%
                      </div>
                      <div className="text-xs text-[#9fa0b8]">Pass Rate</div>
                    </div>
                    <div className="bg-[#0e0e12] rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-brand">{q.averageScore}%</div>
                      <div className="text-xs text-[#9fa0b8]">Avg Score</div>
                    </div>
                  </div>

                  {/* Per-question stats */}
                  {q.questionStats.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-medium text-[#9fa0b8] uppercase">Per-question correctness</h5>
                      {q.questionStats.map((qs, idx) => (
                        <div key={qs.questionId} className="flex items-center gap-3">
                          <span className="text-xs text-[#9fa0b8] w-6 flex-shrink-0">Q{idx + 1}</span>
                          <div className="flex-1 bg-[#0e0e12] rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${qs.correctRate}%`,
                                backgroundColor: qs.correctRate >= 70 ? "#4ade80" : qs.correctRate >= 40 ? "#FBD10D" : "#f87171",
                              }}
                            />
                          </div>
                          <span className="text-xs text-[#9fa0b8] w-10 text-right">{qs.correctRate}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[#9fa0b8]">
              <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No quiz data yet. Add quiz chapters and wait for students to take them.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Chapter Modal
function ChapterModal({
  isOpen,
  onClose,
  onSave,
  chapter,
  course,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  chapter?: CourseChapter;
  course?: Course;
}) {
  const [formData, setFormData] = useState<{
    title: string;
    contentType: "video" | "link" | "text" | "quiz" | "pdf" | "json";
    videoUrl: string;
    videoS3Key: string;
    linkUrl: string;
    content: string;
    duration: number;
    pdfUrl: string;
    pdfS3Key: string;
    pdfs: any[];
    jsonFiles: any[];
  }>({
    title: chapter?.title || "",
    contentType: chapter?.contentType || ("video" as "video" | "link" | "text" | "quiz" | "pdf" | "json"),
    videoUrl: chapter?.videoUrl || "",
    videoS3Key: chapter?.videoS3Key || "",
    linkUrl: chapter?.linkUrl || "",
    content: chapter?.content || "",
    duration: chapter?.duration || 0,
    pdfUrl: (chapter as any)?.pdfUrl || "",
    pdfS3Key: (chapter as any)?.pdfS3Key || "",
    pdfs: (chapter as any)?.pdfs || (
      ((chapter as any)?.pdfUrl)
        ? [{ name: "PDF Document", url: (chapter as any).pdfUrl, s3Key: (chapter as any).pdfS3Key || "" }]
        : []
    ),
    jsonFiles: (chapter as any)?.jsonFiles || [],
  });

  // Video upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);
  const [multipartState, setMultipartState] = useState<{ s3Key: string; uploadId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF upload state
  const [uploadingPdfs, setUploadingPdfs] = useState<Record<string, number>>({});
  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // JSON upload state
  const [uploadingJsons, setUploadingJsons] = useState<Record<string, number>>({});
  const [isJsonUploading, setIsJsonUploading] = useState(false);
  const [jsonUploadError, setJsonUploadError] = useState<string | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [copiedJsonIndex, setCopiedJsonIndex] = useState<number | null>(null);

  // YouTube link preview state
  const [ytMeta, setYtMeta] = useState<YouTubeOEmbed | null>(null);
  const [ytMetaLoading, setYtMetaLoading] = useState(false);

  const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB
  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
  const MAX_VIDEO_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

  // Debounced YouTube oEmbed lookup whenever the pasted URL changes.
  useEffect(() => {
    const url = formData.videoUrl;
    if (!url || !isYouTubeUrl(url)) {
      setYtMeta(null);
      setYtMetaLoading(false);
      return;
    }
    const controller = new AbortController();
    setYtMetaLoading(true);
    const timer = setTimeout(async () => {
      const meta = await fetchYouTubeOEmbed(url, controller.signal);
      if (!controller.signal.aborted) {
        setYtMeta(meta);
        setYtMetaLoading(false);
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [formData.videoUrl]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Auto-detect video duration from file
  const detectVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(Math.round(video.duration));
      };
      video.onerror = () => resolve(0);
      video.src = URL.createObjectURL(file);
    });
  };

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setUploadError("Unsupported format. Use MP4, WebM, MOV, or MKV.");
      return;
    }
    if (file.size > MAX_VIDEO_SIZE) {
      setUploadError(`File too large. Maximum size is 5GB.`);
      return;
    }
    setVideoFile(file);
    // Auto-detect duration
    const duration = await detectVideoDuration(file);
    if (duration > 0) {
      setFormData((prev) => ({ ...prev, duration }));
    }
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  // Upload video to S3
  const uploadVideo = async () => {
    if (!videoFile) return;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const courseId = course?._id || "new";

    try {
      if (videoFile.size < MULTIPART_THRESHOLD) {
        // Small file: single presigned PUT upload
        const { uploadUrl, s3Key } = await getCourseVideoUploadUrl({
          courseId,
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

        setFormData((prev) => ({ ...prev, videoS3Key: s3Key, videoUrl: "" }));

      } else {
        // Large file: multipart upload
        const { uploadId, s3Key, partSize, totalParts, partUrls } =
          await initiateCourseVideoMultipart({
            courseId,
            fileName: videoFile.name,
            fileSize: videoFile.size,
            contentType: videoFile.type,
          });

        setMultipartState({ s3Key, uploadId });
        const controller = new AbortController();
        setUploadAbortController(controller);

        const completedParts: { partNumber: number; etag: string }[] = [];
        let uploadedBytes = 0;

        // Upload parts with concurrency limit of 3
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

                const response = await fetch(part.url, {
                  method: "PUT",
                  body: blob,
                  signal: controller.signal,
                });

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

        // Complete multipart
        await completeCourseVideoMultipart({ s3Key, uploadId, parts: completedParts });
        setFormData((prev) => ({ ...prev, videoS3Key: s3Key, videoUrl: "" }));
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
      // Cleanup multipart on error
      if (multipartState) {
        await abortCourseVideoMultipart(multipartState).catch(() => {});
        setMultipartState(null);
      }
    } finally {
      setIsUploading(false);
      setUploadAbortController(null);
    }
  };

  // Cancel upload
  const cancelUpload = async () => {
    uploadAbortController?.abort();
    if (multipartState) {
      await abortCourseVideoMultipart(multipartState).catch(() => {});
      setMultipartState(null);
    }
    setIsUploading(false);
    setUploadProgress(0);
  };

  // Remove uploaded video
  const removeUploadedVideo = () => {
    setVideoFile(null);
    setFormData((prev) => ({ ...prev, videoS3Key: "", videoUrl: "" }));
    setUploadProgress(0);
    setUploadError(null);
  };

  // Handle PDF selection
  const handlePdfSelect = async (files: FileList) => {
    setPdfUploadError(null);
    const selectedFiles = Array.from(files);
    
    const currentCount = formData.pdfs?.length || 0;
    if (currentCount + selectedFiles.length > 5) {
      setPdfUploadError(`You can upload at most 5 PDFs. You currently have ${currentCount} and tried to add ${selectedFiles.length}.`);
      toast.error("Maximum 5 PDFs allowed per chapter");
      return;
    }

    const validFiles: File[] = [];
    const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB

    for (const file of selectedFiles) {
      if (file.type !== "application/pdf") {
        toast.error(`"${file.name}" is not a PDF file`);
        continue;
      }
      if (file.size > MAX_PDF_SIZE) {
        toast.error(`"${file.name}" is too large (max 50MB)`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setIsPdfUploading(true);
    
    const newUploadingPdfs = { ...uploadingPdfs };
    validFiles.forEach(file => {
      newUploadingPdfs[file.name] = 0;
    });
    setUploadingPdfs(newUploadingPdfs);

    const uploadPromises = validFiles.map(async (file) => {
      try {
        const res = await uploadFile(file, (progress) => {
          setUploadingPdfs(prev => ({
            ...prev,
            [file.name]: Math.round(progress)
          }));
        });

        if (!res?.url) {
          throw new Error("Upload failed");
        }

        setFormData(prev => {
          const updatedPdfs = [
            ...(prev.pdfs || []),
            {
              name: file.name,
              url: res.url,
              s3Key: res.key || "",
              fileSize: file.size
            }
          ];
          return {
            ...prev,
            pdfs: updatedPdfs,
            pdfUrl: updatedPdfs[0]?.url || "",
            pdfS3Key: updatedPdfs[0]?.s3Key || ""
          };
        });

        toast.success(`"${file.name}" uploaded successfully`);
      } catch (error: any) {
        console.error(`Error uploading "${file.name}":`, error);
        toast.error(`Failed to upload "${file.name}"`);
      } finally {
        setUploadingPdfs(prev => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
      }
    });

    await Promise.all(uploadPromises);
    setIsPdfUploading(false);
  };

  // Remove uploaded PDF
  const removeUploadedPdf = (index: number) => {
    setFormData((prev) => {
      const updatedPdfs = (prev.pdfs || []).filter((_, i) => i !== index);
      return {
        ...prev,
        pdfs: updatedPdfs,
        pdfUrl: updatedPdfs[0]?.url || "",
        pdfS3Key: updatedPdfs[0]?.s3Key || ""
      };
    });
  };

  // Handle JSON file selection
  const handleJsonSelect = async (files: FileList) => {
    setJsonUploadError(null);
    const selectedFiles = Array.from(files);

    const currentCount = formData.jsonFiles?.length || 0;
    if (currentCount + selectedFiles.length > 10) {
      setJsonUploadError(`You can upload at most 10 JSON files. You currently have ${currentCount}.`);
      toast.error("Maximum 10 JSON files allowed per chapter");
      return;
    }

    const validFiles: File[] = [];
    const MAX_JSON_SIZE = 10 * 1024 * 1024; // 10MB

    for (const file of selectedFiles) {
      if (file.type !== "application/json" && !file.name.endsWith(".json")) {
        toast.error(`"${file.name}" is not a JSON file`);
        continue;
      }
      if (file.size > MAX_JSON_SIZE) {
        toast.error(`"${file.name}" is too large (max 10MB)`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setIsJsonUploading(true);

    const newUploadingJsons = { ...uploadingJsons };
    validFiles.forEach(file => { newUploadingJsons[file.name] = 0; });
    setUploadingJsons(newUploadingJsons);

    const uploadPromises = validFiles.map(async (file) => {
      try {
        const res = await uploadFile(file, (progress) => {
          setUploadingJsons(prev => ({ ...prev, [file.name]: Math.round(progress) }));
        });

        if (!res?.url) throw new Error("Upload failed");

        setFormData(prev => ({
          ...prev,
          jsonFiles: [
            ...(prev.jsonFiles || []),
            { name: file.name, url: res.url, s3Key: res.key || "", fileSize: file.size }
          ]
        }));

        toast.success(`"${file.name}" uploaded successfully`);
      } catch (error: any) {
        console.error(`Error uploading "${file.name}":`, error);
        toast.error(`Failed to upload "${file.name}"`);
      } finally {
        setUploadingJsons(prev => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
      }
    });

    await Promise.all(uploadPromises);
    setIsJsonUploading(false);
  };

  // Remove uploaded JSON file
  const removeUploadedJson = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      jsonFiles: (prev.jsonFiles || []).filter((_, i) => i !== index)
    }));
  };

  // Copy JSON content to clipboard
  const copyJsonContent = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const text = await response.text();
      // Pretty-print if valid JSON
      try {
        const parsed = JSON.parse(text);
        await navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
      } catch {
        await navigator.clipboard.writeText(text);
      }
      setCopiedJsonIndex(index);
      toast.success("JSON content copied to clipboard!");
      setTimeout(() => setCopiedJsonIndex(null), 2000);
    } catch (error) {
      toast.error("Failed to copy content");
    }
  };

  const [quizData, setQuizData] = useState<{
    questions: {
      _id?: string;
      questionText: string;
      questionType: "mcq_single" | "mcq_multi" | "true_false";
      options: { text: string; isCorrect: boolean }[];
      explanation: string;
      points: number;
      relatedChapterId: string;
    }[];
    passingScore: number;
    isRequired: boolean;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  }>({
    questions: chapter?.quiz?.questions?.map((q) => ({
      _id: q._id,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
      explanation: q.explanation || "",
      points: q.points || 1,
      relatedChapterId: q.relatedChapterId || "",
    })) || [],
    passingScore: chapter?.quiz?.passingScore ?? 70,
    isRequired: chapter?.quiz?.isRequired ?? false,
    shuffleQuestions: chapter?.quiz?.shuffleQuestions ?? false,
    shuffleOptions: chapter?.quiz?.shuffleOptions ?? false,
  });

  const [saving, setSaving] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  // Collect all non-quiz chapters for relatedChapterId dropdown
  const availableChapters: { id: string; title: string; sectionTitle: string }[] = [];
  if (course?.sections) {
    for (const section of course.sections) {
      for (const ch of section.chapters || []) {
        if (ch.contentType !== "quiz" && ch._id !== chapter?._id) {
          availableChapters.push({ id: ch._id, title: ch.title, sectionTitle: section.title });
        }
      }
    }
  }

  const addQuestion = () => {
    setQuizData((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        { questionText: "", questionType: "mcq_single", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }], explanation: "", points: 1, relatedChapterId: "" },
      ],
    }));
    setExpandedQuestion(quizData.questions.length);
  };

  const removeQuestion = (index: number) => {
    setQuizData((prev) => ({ ...prev, questions: prev.questions.filter((_, i) => i !== index) }));
    if (expandedQuestion === index) setExpandedQuestion(null);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    setQuizData((prev) => {
      const updated = [...prev.questions];
      (updated[index] as any)[field] = value;
      if (field === "questionType" && value === "true_false") {
        updated[index].options = [{ text: "True", isCorrect: false }, { text: "False", isCorrect: false }];
      }
      return { ...prev, questions: updated };
    });
  };

  const updateOption = (qIndex: number, oIndex: number, field: string, value: any) => {
    setQuizData((prev) => {
      const updated = [...prev.questions];
      const q = { ...updated[qIndex] };
      const opts = [...q.options];
      if (field === "isCorrect" && value === true && (q.questionType === "mcq_single" || q.questionType === "true_false")) {
        opts.forEach((o, i) => { opts[i] = { ...o, isCorrect: i === oIndex }; });
      } else {
        opts[oIndex] = { ...opts[oIndex], [field]: value };
      }
      q.options = opts;
      updated[qIndex] = q;
      return { ...prev, questions: updated };
    });
  };

  const addOption = (qIndex: number) => {
    setQuizData((prev) => {
      const updated = [...prev.questions];
      updated[qIndex] = { ...updated[qIndex], options: [...updated[qIndex].options, { text: "", isCorrect: false }] };
      return { ...prev, questions: updated };
    });
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    setQuizData((prev) => {
      const updated = [...prev.questions];
      updated[qIndex] = { ...updated[qIndex], options: updated[qIndex].options.filter((_, i) => i !== oIndex) };
      return { ...prev, questions: updated };
    });
  };

  const handleSave = async () => {
    if (!formData.title.trim()) { toast.error("Please enter a chapter title"); return; }
    
    if (formData.contentType === "video") {
      if (isUploading) {
        toast.error("Please wait for the video to finish uploading");
        return;
      }
      if (videoFile && !formData.videoS3Key) {
        toast.error("Please upload the selected video before saving");
        return;
      }
    }

    if (formData.contentType === "pdf") {
      if (isPdfUploading || Object.keys(uploadingPdfs).length > 0) {
        toast.error("Please wait for all PDF documents to finish uploading");
        return;
      }
      if (!formData.pdfs || formData.pdfs.length === 0) {
        toast.error("Please upload at least one PDF document for this chapter");
        return;
      }
    }

    if (formData.contentType === "json") {
      if (isJsonUploading || Object.keys(uploadingJsons).length > 0) {
        toast.error("Please wait for all JSON files to finish uploading");
        return;
      }
      if (!formData.jsonFiles || formData.jsonFiles.length === 0) {
        toast.error("Please upload at least one JSON file for this chapter");
        return;
      }
    }

    if (formData.contentType === "quiz") {
      if (quizData.questions.length === 0) { toast.error("Please add at least one question"); return; }
      for (let i = 0; i < quizData.questions.length; i++) {
        const q = quizData.questions[i];
        if (!q.questionText.trim()) { toast.error(`Question ${i + 1} text is empty`); return; }
        if (q.options.some((o) => !o.text.trim())) { toast.error(`Question ${i + 1} has empty options`); return; }
        if (!q.options.some((o) => o.isCorrect)) { toast.error(`Question ${i + 1} needs at least one correct answer`); return; }
      }
    }
    setSaving(true);
    try {
      const data: any = { ...formData };
      if (formData.contentType === "quiz") { data.quiz = quizData; }
      await onSave(data);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`bg-[#0e0e12] border-[#2a2a35] max-h-[90vh] overflow-y-auto ${formData.contentType === "quiz" ? "max-w-3xl" : "max-w-lg"}`}>
        <DialogHeader>
          <DialogTitle className="text-white">{chapter ? "Edit Chapter" : "Add Chapter"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 min-w-0">
          <div>
            <Label className="text-[#c7c7da]">Title</Label>
            <Input value={formData.title} onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))} placeholder="Chapter title" className="mt-2 bg-[#1a1a22] border-[#2a2a35] text-white" />
          </div>
          <div>
            <Label className="text-[#c7c7da]">Content Type</Label>
            <Select value={formData.contentType} onValueChange={(value: "video" | "link" | "text" | "quiz" | "pdf" | "json") => setFormData((prev) => ({ ...prev, contentType: value }))}>
              <SelectTrigger className="mt-2 bg-[#1a1a22] border-[#2a2a35] text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a22] border-[#2a2a35]">
                <SelectItem value="video" className="text-white"><div className="flex items-center gap-2"><Video className="w-4 h-4" />Video</div></SelectItem>
                <SelectItem value="link" className="text-white"><div className="flex items-center gap-2"><LinkIcon className="w-4 h-4" />External Link</div></SelectItem>
                <SelectItem value="text" className="text-white"><div className="flex items-center gap-2"><FileText className="w-4 h-4" />Text Content</div></SelectItem>
                <SelectItem value="quiz" className="text-white"><div className="flex items-center gap-2"><ClipboardList className="w-4 h-4" />Quiz</div></SelectItem>
                <SelectItem value="pdf" className="text-white"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-red-400" />PDF Document</div></SelectItem>
                <SelectItem value="json" className="text-white"><div className="flex items-center gap-2"><FileCode className="w-4 h-4 text-yellow-400" />JSON Document</div></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.contentType === "video" && (
            <>
              {/* Video Upload Zone */}
              <div>
                <Label className="text-[#c7c7da] mb-2 block">Upload Video</Label>

                {/* Already uploaded (existing S3 key or just-uploaded) */}
                {formData.videoS3Key && !isUploading ? (
                  <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {videoFile?.name || "Video uploaded"}
                          </p>
                          <p className="text-xs text-[#9fa0b8]">
                            {videoFile ? formatFileSize(videoFile.size) : "Ready to play"}
                            {formData.duration > 0 && ` • ${formatDuration(formData.duration)}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeUploadedVideo}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : isUploading ? (
                  /* Upload in progress */
                  <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-brand animate-spin" />
                        <div>
                          <p className="text-sm font-medium text-white">
                            {videoFile?.name || "Uploading..."}
                          </p>
                          <p className="text-xs text-[#9fa0b8]">
                            {videoFile ? formatFileSize(videoFile.size) : ""} • {uploadProgress}%
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelUpload}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="w-full bg-[#2a2a35] rounded-full h-2">
                      <div
                        className="bg-brand h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : videoFile && !formData.videoS3Key ? (
                  /* File selected, ready to upload */
                  <div className="bg-[#1a1a22] border border-[#2a2a35] rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand/20 flex items-center justify-center">
                          <Video className="w-5 h-5 text-brand" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{videoFile.name}</p>
                          <p className="text-xs text-[#9fa0b8]">
                            {formatFileSize(videoFile.size)}
                            {formData.duration > 0 && ` • ${formatDuration(formData.duration)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setVideoFile(null); setUploadError(null); }}
                          className="text-[#9fa0b8] hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={uploadVideo}
                          className="bg-brand hover:opacity-90 text-brand-foreground"
                        >
                          <Upload className="w-4 h-4 mr-1" /> Upload
                        </Button>
                      </div>
                    </div>
                    {uploadError && (
                      <p className="text-xs text-red-400 mt-2">{uploadError}</p>
                    )}
                  </div>
                ) : (
                  /* Drag and drop zone */
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#2a2a35] rounded-lg p-6 text-center cursor-pointer hover:border-brand/50 hover:bg-brand/5 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-[#9fa0b8] mx-auto mb-2" />
                    <p className="text-sm text-[#c7c7da] mb-1">
                      Drag and drop your video or{" "}
                      <span className="text-brand font-medium">browse</span>
                    </p>
                    <p className="text-xs text-[#9fa0b8]">
                      MP4, WebM, MOV, MKV • Up to 5GB
                    </p>
                    {uploadError && (
                      <p className="text-xs text-red-400 mt-2">{uploadError}</p>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Or paste external URL (backward compat) */}
              {!formData.videoS3Key && !videoFile && !isUploading && (
                <div>
                  <Label className="text-[#9fa0b8] text-xs">Or paste a video URL (YouTube, Vimeo)</Label>
                  <Input value={formData.videoUrl} onChange={(e) => setFormData((prev) => ({ ...prev, videoUrl: e.target.value }))} placeholder="https://youtube.com/watch?v=..." className="mt-1 bg-[#1a1a22] border-[#2a2a35] text-white text-sm h-8" />
                  {(() => {
                    if (!formData.videoUrl) return null;
                    if (isYouTubeUrl(formData.videoUrl)) {
                      const thumb = ytMeta?.thumbnail_url || getYouTubeThumbnail(formData.videoUrl, "maxres");
                      if (!thumb && !ytMetaLoading) return null;
                      return (
                        <div className="mt-2 flex gap-3 rounded-md border border-[#2a2a35] bg-[#0e0e12] p-2">
                          <div className="relative aspect-video w-40 flex-shrink-0 overflow-hidden rounded bg-black">
                            {thumb && (
                              <img
                                src={thumb}
                                alt="YouTube thumbnail preview"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  const img = e.currentTarget as HTMLImageElement;
                                  const fallback = getYouTubeThumbnail(formData.videoUrl, "hq");
                                  if (fallback && img.src !== fallback) img.src = fallback;
                                  else img.style.display = "none";
                                }}
                              />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="rounded-full bg-black/60 p-2">
                                <Play className="h-4 w-4 text-white" fill="white" />
                              </div>
                            </div>
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                            <div className="min-w-0">
                              <div className="line-clamp-2 text-sm font-medium text-white">
                                {ytMetaLoading && !ytMeta
                                  ? "Loading…"
                                  : ytMeta?.title || "YouTube video"}
                              </div>
                              {ytMeta?.author_name && (
                                <div className="mt-0.5 truncate text-xs text-[#9fa0b8]">
                                  {ytMeta.author_name}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-[#6b6c84]">
                              <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-medium text-red-400">
                                YouTube
                              </span>
                              <a
                                href={formData.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate text-[#1D9BF0] hover:underline"
                              >
                                Open on YouTube
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-2 aspect-video w-full max-w-xs overflow-hidden rounded-md border border-[#2a2a35] bg-black">
                        <iframe
                          src={getVimeoEmbedUrl(formData.videoUrl)}
                          className="h-full w-full"
                          allowFullScreen
                        />
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <Label className="text-[#c7c7da]">Description</Label>
                <RichTextEditor value={formData.content} onChange={(value) => setFormData((prev) => ({ ...prev, content: value }))} placeholder="Add a description for this video lesson..." className="mt-2" minHeight="120px" />
              </div>
            </>
          )}

          {formData.contentType === "pdf" && (
            <div className="space-y-4">
              {/* Uploaded Documents List */}
              {formData.pdfs && formData.pdfs.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[#9fa0b8] text-xs">Uploaded Documents</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {formData.pdfs.map((pdf: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[#141419] border border-[#2a2a35] hover:border-[#3a3a4b] transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center flex-shrink-0 border border-red-500/20">
                            <FileText className="w-4 h-4 text-red-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate max-w-[220px]">
                              {pdf.name || `Document ${idx + 1}`}
                            </p>
                            {pdf.fileSize && (
                              <p className="text-xs text-[#9fa0b8]">
                                {formatFileSize(pdf.fileSize)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <a
                            href={pdf.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded text-[#9fa0b8] hover:text-white hover:bg-white/5 transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => removeUploadedPdf(idx)}
                            className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Uploading Progress list */}
              {Object.keys(uploadingPdfs).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[#9fa0b8] text-xs">Uploading Documents</Label>
                  <div className="space-y-2">
                    {Object.entries(uploadingPdfs).map(([fileName, progress]) => (
                      <div key={fileName} className="bg-[#141419] border border-[#2a2a35] rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <Loader2 className="w-4 h-4 text-brand animate-spin flex-shrink-0" />
                            <p className="text-sm font-medium text-white truncate max-w-[240px]">
                              {fileName}
                            </p>
                          </div>
                          <span className="text-xs text-brand font-semibold">{progress}%</span>
                        </div>
                        <div className="w-full bg-[#2a2a35] rounded-full h-1.5">
                          <div
                            className="bg-brand h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Drag and Drop Zone */}
              {formData.pdfs.length < 5 && (
                <div>
                  <Label className="text-[#c7c7da] mb-2 block">Upload PDF Documents</Label>
                  <div
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files) handlePdfSelect(e.dataTransfer.files);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => pdfInputRef.current?.click()}
                    className="border-2 border-dashed border-[#2a2a35] rounded-lg p-6 text-center cursor-pointer hover:border-brand/50 hover:bg-brand/5 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-[#9fa0b8] mx-auto mb-2" />
                    <p className="text-sm text-[#c7c7da] mb-1">
                      Drag and drop PDF files or{" "}
                      <span className="text-brand font-medium">browse</span>
                    </p>
                    <p className="text-xs text-[#9fa0b8]">
                      PDF files only • Up to 5 PDFs (Max 50MB each)
                    </p>
                    <p className="text-xs text-[#6b6c84] mt-1">
                      Uploaded: {formData.pdfs.length} / 5
                    </p>
                    {pdfUploadError && (
                      <p className="text-xs text-red-400 mt-2">{pdfUploadError}</p>
                    )}
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) handlePdfSelect(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ===== JSON DOCUMENT UPLOAD ===== */}
          {formData.contentType === "json" && (
            <div className="space-y-4">
              {/* Uploaded JSON files list */}
              {formData.jsonFiles && formData.jsonFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[#9fa0b8] text-xs">Uploaded JSON Files</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {formData.jsonFiles.map((jf: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[#141419] border border-[#2a2a35] hover:border-[#3a3a4b] transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded bg-yellow-500/10 flex items-center justify-center flex-shrink-0 border border-yellow-500/20">
                            <FileCode className="w-4 h-4 text-yellow-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate max-w-[200px]">{jf.name || `json_${idx + 1}.json`}</p>
                            {jf.fileSize && <p className="text-xs text-[#9fa0b8]">{formatFileSize(jf.fileSize)}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => window.open(jf.url, "_blank")}
                            className="p-1.5 rounded text-[#9fa0b8] hover:text-white hover:bg-white/5 transition-colors"
                            title="Preview raw JSON"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeUploadedJson(idx)}
                            className="p-1.5 rounded text-[#9fa0b8] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* In-progress JSON uploads */}
              {Object.keys(uploadingJsons).length > 0 && (
                <div className="space-y-2">
                  {Object.entries(uploadingJsons).map(([name, progress]) => (
                    <div key={name} className="p-3 rounded-lg bg-[#141419] border border-[#2a2a35] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-yellow-400" />
                          <p className="text-sm text-white truncate max-w-[200px]">{name}</p>
                        </div>
                        <span className="text-xs text-brand font-semibold">{progress}%</span>
                      </div>
                      <div className="w-full bg-[#2a2a35] rounded-full h-1.5">
                        <div className="bg-brand h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Drag-and-drop upload zone */}
              {(formData.jsonFiles?.length || 0) < 10 && (
                <div>
                  <Label className="text-[#c7c7da] mb-2 block">Upload JSON Files</Label>
                  <div
                    onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) handleJsonSelect(e.dataTransfer.files); }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => jsonInputRef.current?.click()}
                    className="border-2 border-dashed border-[#2a2a35] rounded-lg p-6 text-center cursor-pointer hover:border-brand/50 hover:bg-brand/5 transition-colors"
                  >
                    <FileCode className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                    <p className="text-sm text-[#c7c7da] mb-1">
                      Drag and drop JSON files or{" "}
                      <span className="text-brand font-medium">browse</span>
                    </p>
                    <p className="text-xs text-[#9fa0b8]">JSON files only • Up to 10 files (Max 10MB each)</p>
                    <p className="text-xs text-[#6b6c84] mt-1">Uploaded: {formData.jsonFiles?.length || 0} / 10</p>
                    {jsonUploadError && <p className="text-xs text-red-400 mt-2">{jsonUploadError}</p>}
                    <input
                      ref={jsonInputRef}
                      type="file"
                      accept="application/json,.json"
                      multiple
                      className="hidden"
                      onChange={(e) => { if (e.target.files) handleJsonSelect(e.target.files); e.target.value = ""; }}
                    />
                  </div>
                </div>
              )}

            </div>
          )}

          {formData.contentType === "link" && (
            <div>
              <Label className="text-[#c7c7da]">External Link URL</Label>
              <Input value={formData.linkUrl} onChange={(e) => setFormData((prev) => ({ ...prev, linkUrl: e.target.value }))} placeholder="https://example.com" className="mt-2 bg-[#1a1a22] border-[#2a2a35] text-white" />
            </div>
          )}
          {formData.contentType === "text" && (
            <div>
              <Label className="text-[#c7c7da]">Content</Label>
              <RichTextEditor value={formData.content} onChange={(value) => setFormData((prev) => ({ ...prev, content: value }))} placeholder="Add chapter content..." className="mt-2" minHeight="200px" />
            </div>
          )}

          {/* ===== QUIZ BUILDER ===== */}
          {formData.contentType === "quiz" && (
            <div className="space-y-4">
              {/* Quiz Settings */}
              <div className="bg-[#1a1a22] rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium text-brand flex items-center gap-2"><ClipboardList className="w-4 h-4" />Quiz Settings</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-[#9fa0b8]">Passing Score (%)</Label>
                    <Input type="number" min={0} max={100} value={quizData.passingScore} onChange={(e) => setQuizData((prev) => ({ ...prev, passingScore: parseInt(e.target.value) || 0 }))} className="mt-1 bg-[#0e0e12] border-[#2a2a35] text-white h-8 text-sm" />
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm text-[#c7c7da] cursor-pointer">
                      <input type="checkbox" checked={quizData.isRequired} onChange={(e) => setQuizData((prev) => ({ ...prev, isRequired: e.target.checked }))} className="rounded border-[#2a2a35] bg-[#0e0e12]" />
                      Required
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[#c7c7da] cursor-pointer">
                      <input type="checkbox" checked={quizData.shuffleQuestions} onChange={(e) => setQuizData((prev) => ({ ...prev, shuffleQuestions: e.target.checked }))} className="rounded border-[#2a2a35] bg-[#0e0e12]" />
                      Shuffle
                    </label>
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[#c7c7da]">Questions ({quizData.questions.length})</Label>
                  <Button size="sm" onClick={addQuestion} className="bg-brand hover:opacity-90 text-brand-foreground h-7 text-xs"><Plus className="w-3 h-3 mr-1" />Add Question</Button>
                </div>

                {quizData.questions.map((q, qIndex) => (
                  <div key={qIndex} className="bg-[#1a1a22] border border-[#2a2a35] rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#222230]" onClick={() => setExpandedQuestion(expandedQuestion === qIndex ? null : qIndex)}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="flex-shrink-0 w-6 h-6 rounded bg-brand/20 text-brand flex items-center justify-center text-xs font-bold">{qIndex + 1}</span>
                        <span className="text-sm text-white truncate min-w-0">{q.questionText || "Untitled question"}</span>
                        <span className="text-xs text-[#9fa0b8] flex-shrink-0">({q.questionType === "mcq_single" ? "Single" : q.questionType === "mcq_multi" ? "Multi" : "T/F"})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); removeQuestion(qIndex); }} className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-3 h-3" /></Button>
                        {expandedQuestion === qIndex ? <ChevronDown className="w-4 h-4 text-[#9fa0b8]" /> : <ChevronRight className="w-4 h-4 text-[#9fa0b8]" />}
                      </div>
                    </div>

                    {expandedQuestion === qIndex && (
                      <div className="border-t border-[#2a2a35] p-3 space-y-3">
                        <div>
                          <Label className="text-xs text-[#9fa0b8]">Question Type</Label>
                          <Select value={q.questionType} onValueChange={(val) => updateQuestion(qIndex, "questionType", val)}>
                            <SelectTrigger className="mt-1 bg-[#0e0e12] border-[#2a2a35] text-white h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#1a1a22] border-[#2a2a35]">
                              <SelectItem value="mcq_single" className="text-white text-sm">Multiple Choice (Single Answer)</SelectItem>
                              <SelectItem value="mcq_multi" className="text-white text-sm">Multiple Choice (Multiple Answers)</SelectItem>
                              <SelectItem value="true_false" className="text-white text-sm">True / False</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-[#9fa0b8]">Question</Label>
                          <Textarea value={q.questionText} onChange={(e) => updateQuestion(qIndex, "questionText", e.target.value)} placeholder="Enter your question..." rows={2} className="mt-1 w-full min-w-0 bg-[#0e0e12] border-[#2a2a35] text-white text-sm min-h-[2.25rem] max-h-40 resize-y overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]" />
                        </div>
                        <div>
                          <Label className="text-xs text-[#9fa0b8]">Options {q.questionType === "mcq_multi" ? "(select all correct)" : "(select one correct)"}</Label>
                          <div className="mt-1 space-y-2">
                            {q.options.map((opt, oIndex) => (
                              <div key={oIndex} className="flex items-center gap-2">
                                <button onClick={() => updateOption(qIndex, oIndex, "isCorrect", !opt.isCorrect)} className={`flex-shrink-0 w-5 h-5 rounded${q.questionType === "mcq_multi" ? "" : "-full"} border-2 flex items-center justify-center transition-colors ${opt.isCorrect ? "border-green-500 bg-green-500/20" : "border-[#2a2a35] hover:border-[#9fa0b8]"}`}>
                                  {opt.isCorrect && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                </button>
                                <Input value={opt.text} onChange={(e) => updateOption(qIndex, oIndex, "text", e.target.value)} placeholder={`Option ${oIndex + 1}`} className="flex-1 bg-[#0e0e12] border-[#2a2a35] text-white h-8 text-sm" disabled={q.questionType === "true_false"} />
                                {q.questionType !== "true_false" && q.options.length > 2 && (
                                  <Button size="sm" variant="ghost" onClick={() => removeOption(qIndex, oIndex)} className="h-6 w-6 p-0 text-red-400 hover:text-red-300"><X className="w-3 h-3" /></Button>
                                )}
                              </div>
                            ))}
                          </div>
                          {q.questionType !== "true_false" && (
                            <Button size="sm" variant="ghost" onClick={() => addOption(qIndex)} className="mt-2 text-brand hover:opacity-80 text-xs h-7"><Plus className="w-3 h-3 mr-1" />Add Option</Button>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-[#9fa0b8]">Explanation (shown after answering)</Label>
                          <Input value={q.explanation} onChange={(e) => updateQuestion(qIndex, "explanation", e.target.value)} placeholder="Why this answer is correct..." className="mt-1 bg-[#0e0e12] border-[#2a2a35] text-white h-8 text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-[#9fa0b8]">Related Topic (for review)</Label>
                            <Select value={q.relatedChapterId || "__none__"} onValueChange={(val) => updateQuestion(qIndex, "relatedChapterId", val === "__none__" ? "" : val)}>
                              <SelectTrigger className="mt-1 bg-[#0e0e12] border-[#2a2a35] text-white h-8 text-sm"><SelectValue placeholder="Select chapter..." /></SelectTrigger>
                              <SelectContent className="bg-[#1a1a22] border-[#2a2a35] max-h-48">
                                <SelectItem value="__none__" className="text-[#9fa0b8] text-sm">None</SelectItem>
                                {availableChapters.map((ch) => (
                                  <SelectItem key={ch.id} value={ch.id} className="text-white text-sm">{ch.sectionTitle} → {ch.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-[#9fa0b8]">Points</Label>
                            <Input type="number" min={1} value={q.points} onChange={(e) => updateQuestion(qIndex, "points", parseInt(e.target.value) || 1)} className="mt-1 bg-[#0e0e12] border-[#2a2a35] text-white h-8 text-sm" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {quizData.questions.length === 0 && (
                  <div className="text-center py-8 text-[#9fa0b8]">
                    <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No questions yet. Click &quot;Add Question&quot; to get started.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#2a2a35] text-[#9fa0b8]">Cancel</Button>
          <Button onClick={handleSave} disabled={saving || isUploading || isPdfUploading} className="bg-brand hover:opacity-90 text-brand-foreground disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {chapter ? "Update" : "Add"} Chapter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// QuizPlayer Component - used inside CourseDetailView for quiz chapters
function QuizPlayer({
  chapter,
  course,
  enrollment,
  selectedChapter,
  onEnrollmentUpdate,
  onNavigateToChapter,
}: {
  chapter: CourseChapter;
  course: Course;
  enrollment: CourseEnrollment | null;
  selectedChapter: { sectionId: string; chapterId: string } | null;
  onEnrollmentUpdate: (enrollment: CourseEnrollment) => void;
  onNavigateToChapter: (sectionId: string, chapterId: string) => void;
}) {
  const quiz = chapter.quiz;

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Map<string, number[]>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [showingResults, setShowingResults] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    setCurrentQ(0);
    setAnswers(new Map());
    setResult(null);
    setShowingResults(false);
    setShowExplanation(false);
  }, [chapter._id]);

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-[#1a1a22] rounded-lg">
        <div className="text-center">
          <ClipboardList className="w-16 h-16 mx-auto mb-4 text-[#9fa0b8]" />
          <p className="text-[#9fa0b8] font-medium">This quiz has no questions yet.</p>
        </div>
      </div>
    );
  }


  const questions = quiz.questions;
  const question = questions[currentQ];

  const toggleOption = (questionId: string, optionIndex: number, questionType: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      const current = next.get(questionId) || [];
      if (questionType === "mcq_single" || questionType === "true_false") {
        next.set(questionId, [optionIndex]);
      } else {
        if (current.includes(optionIndex)) {
          next.set(questionId, current.filter((i) => i !== optionIndex));
        } else {
          next.set(questionId, [...current, optionIndex]);
        }
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedChapter || !enrollment) return;
    setSubmitting(true);
    try {
      const answerPayload = questions.map((q) => ({
        questionId: q._id,
        selectedOptions: answers.get(q._id) || [],
      }));
      const res = await submitQuizAttempt(
        course._id,
        chapter._id,
        selectedChapter.sectionId,
        answerPayload
      );
      setResult(res);
      setShowingResults(true);
      // Refresh enrollment data
      const { getMyEnrollments } = await import("@/lib/feed-api");
      const enrollments = await getMyEnrollments();
      const updated = enrollments.find(
        (e: any) => (typeof e.courseId === "string" ? e.courseId : e.courseId?._id) === course._id
      );
      if (updated) onEnrollmentUpdate(updated);
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast.error("Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setCurrentQ(0);
    setAnswers(new Map());
    setResult(null);
    setShowingResults(false);
    setShowExplanation(false);
  };

  const findChapterLocation = (chapterId: string): { sectionId: string; chapterId: string } | null => {
    for (const section of course.sections) {
      const ch = section.chapters?.find((c) => c._id === chapterId);
      if (ch) return { sectionId: section._id, chapterId: ch._id };
    }
    return null;
  };

  // Results Screen
  if (showingResults && result) {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Score Card */}
        <div className={`rounded-xl p-8 text-center mb-6 ${result.passed ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
          <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${result.passed ? "bg-green-500/20" : "bg-red-500/20"}`}>
            {result.passed ? (
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            ) : (
              <AlertTriangle className="w-10 h-10 text-red-400" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {result.passed ? "Quiz Passed!" : "Quiz Not Passed"}
          </h2>
          <div className="text-4xl font-bold mb-2" style={{ color: result.passed ? "#4ade80" : "#f87171" }}>
            {result.percentage}%
          </div>
          <p className="text-[#9fa0b8]">
            {result.score} / {result.totalPoints} points • Attempt #{result.attemptNumber}
          </p>
          <p className="text-sm text-[#9fa0b8] mt-1">
            Passing score: {quiz.passingScore}%
          </p>
        </div>

        {/* Per-question breakdown */}
        <div className="space-y-3 mb-6">
          <h3 className="text-lg font-semibold text-white">Question Breakdown</h3>
          {result.results.map((r, idx) => {
            const q = questions[idx];
            return (
              <div key={r.questionId} className={`rounded-lg p-4 border ${r.isCorrect ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${r.isCorrect ? "bg-green-500/20" : "bg-red-500/20"}`}>
                    {r.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <X className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{q?.questionText}</p>
                    {!r.isCorrect && (
                      <p className="text-xs text-green-400 mt-1">
                        Correct: {r.correctOptions.map((i) => q?.options[i]?.text).join(", ")}
                      </p>
                    )}
                    {r.explanation && (
                      <p className="text-xs text-[#9fa0b8] mt-1 italic">{r.explanation}</p>
                    )}
                    {!r.isCorrect && r.relatedChapterId && (
                      <button
                        onClick={() => {
                          const loc = findChapterLocation(r.relatedChapterId!);
                          if (loc) onNavigateToChapter(loc.sectionId, loc.chapterId);
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Review this topic
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          {!result.passed && (
            <Button onClick={handleRetry} className="bg-brand hover:opacity-90 text-brand-foreground">
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry Quiz
            </Button>
          )}
          {result.passed && (
            <div className="text-center text-green-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Quiz completed and marked as done!
            </div>
          )}
        </div>
      </div>
    );
  }

  // Quiz Taking Screen
  const selectedOpts = answers.get(question._id) || [];

  const isQuestionCorrect = () => {
    const selected = selectedOpts;
    const correctIndices = question.options
      .map((o, idx) => (o.isCorrect ? idx : -1))
      .filter((i) => i !== -1);

    if (selected.length !== correctIndices.length) return false;
    return selected.every((i) => correctIndices.includes(i));
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[#9fa0b8]">Question {currentQ + 1} of {questions.length}</span>
          <span className="text-sm text-brand">{chapter.title}</span>
        </div>
        <div className="w-full bg-[#1a1a22] rounded-full h-2">
          <div
            className="bg-brand h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-[#1a1a22] rounded-xl p-6 mb-6 border border-[#2a2a35]">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2 py-1 bg-brand/20 text-brand rounded text-xs font-medium">
            {question.questionType === "mcq_single" ? "Single Answer" : question.questionType === "mcq_multi" ? "Multiple Answers" : "True / False"}
          </span>
          <span className="text-xs text-[#9fa0b8]">{question.points} {question.points === 1 ? "point" : "points"}</span>
        </div>
        <h3 className="text-lg font-semibold text-white mb-6">{question.questionText}</h3>

        {/* Options */}
        <div className="space-y-3">
          {question.options.map((opt, oIndex) => {
            const isSelected = selectedOpts.includes(oIndex);
            const isActuallyCorrect = opt.isCorrect;

            let borderClass = isSelected
              ? "border-brand bg-brand/10"
              : "border-[#2a2a35] hover:border-[#9fa0b8] bg-[#0e0e12]";
            let textClass = isSelected ? "text-white" : "text-[#c7c7da]";
            let boxClass = isSelected ? "border-brand bg-brand/20" : "border-[#2a2a35]";
            let boxInnerColor = "bg-brand";

            if (showExplanation) {
               if (isActuallyCorrect) {
                 borderClass = "border-green-500 bg-green-500/10";
                 textClass = "text-green-400 font-medium";
                 boxClass = "border-green-500 bg-green-500/20";
                 if (isSelected) boxInnerColor = "bg-green-400";
               } else if (isSelected && !isActuallyCorrect) {
                 borderClass = "border-red-500 bg-red-500/10";
                 textClass = "text-red-400 font-medium";
                 boxClass = "border-red-500 bg-red-500/20";
                 boxInnerColor = "bg-red-400";
               } else {
                 borderClass = "border-[#2a2a35] opacity-50 bg-[#0e0e12]";
               }
            }

            return (
              <button
                key={oIndex}
                disabled={showExplanation}
                onClick={() => {
                  if (!showExplanation) {
                    toggleOption(question._id, oIndex, question.questionType);
                  }
                }}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  showExplanation ? "cursor-default" : "cursor-pointer"
                } ${borderClass}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded${question.questionType === "mcq_multi" ? "" : "-full"} border-2 flex items-center justify-center flex-shrink-0 ${boxClass}`}>
                    {isSelected && <div className={`w-2.5 h-2.5 rounded${question.questionType === "mcq_multi" ? "" : "-full"} ${boxInnerColor}`} />}
                  </div>
                  <span className={`text-sm ${textClass}`}>{opt.text}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation & Review Topic */}
        {showExplanation && (
          <div className={`mt-6 p-4 rounded-lg border ${
            isQuestionCorrect() 
              ? "bg-green-500/10 border-green-500/20" 
              : "bg-red-500/10 border-red-500/20"
          }`}>
            <div className="flex items-center gap-2 font-medium mb-2">
              {isQuestionCorrect() ? (
                <><CheckCircle2 className="w-5 h-5 text-green-400" /> <span className="text-green-400">Correct!</span></>
              ) : (
                <><X className="w-5 h-5 text-red-400" /> <span className="text-red-400">Incorrect</span></>
              )}
            </div>
            
            {question.explanation && (
              <p className="text-sm text-[#c7c7da] mb-3">{question.explanation}</p>
            )}

            {!isQuestionCorrect() && question.relatedChapterId && (
              <button
                onClick={() => {
                  const loc = findChapterLocation(question.relatedChapterId!);
                  if (loc) onNavigateToChapter(loc.sectionId, loc.chapterId);
                }}
                className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                Review this topic
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-4 mt-6">
        {!showExplanation ? (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentQ((prev) => Math.max(0, prev - 1))}
              disabled={currentQ === 0}
              className="border-[#2a2a35] text-[#9fa0b8]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={() => setShowExplanation(true)}
              disabled={selectedOpts.length === 0}
              className="bg-brand hover:opacity-90 text-brand-foreground"
            >
              Check Answer
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end">
            {currentQ < questions.length - 1 ? (
              <Button
                onClick={() => {
                  setCurrentQ((prev) => prev + 1);
                  setShowExplanation(false);
                }}
                className="bg-brand hover:opacity-90 text-brand-foreground"
              >
                Next Question
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-brand hover:opacity-90 text-brand-foreground"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</>
                ) : (
                  <>Submit Quiz<CheckCircle2 className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CourseDetailView({
  course,
  enrollment,
  selectedChapter,
  setSelectedChapter,
  expandedSections,
  setExpandedSections,
  onBack,
  onEnrollmentUpdate,
  onAction,
  affiliateId,
  activeSection,
  setActiveSection,
  isActualFounder = false,
}: {
  course: Course;
  enrollment: CourseEnrollment | null;
  selectedChapter: { sectionId: string; chapterId: string } | null;
  setSelectedChapter: (
    chapter: { sectionId: string; chapterId: string } | null
  ) => void;
  expandedSections: Set<string>;
  setExpandedSections: (sections: Set<string>) => void;
  onBack: () => void;
  onEnrollmentUpdate: (enrollment: CourseEnrollment) => void;
  onAction?: (opts?: { quantity?: number; forReserve?: boolean }) => void;
  affiliateId: string;
  activeSection: string;
  setActiveSection: (sec: "courses" | "playlists" | "reserves" | "analytics" | "enrolled" | "students") => void;
  isActualFounder?: boolean;
}) {
  const getNextChapter = () => {
    if (!selectedChapter || !course.sections) return null;
    const allChapters = course.sections.flatMap((s) =>
      (s.chapters || []).map((c) => ({
        sectionId: s._id,
        chapterId: c._id,
      }))
    );
    const currentIdx = allChapters.findIndex(
      (c) => c.chapterId === selectedChapter.chapterId
    );
    if (currentIdx !== -1 && currentIdx < allChapters.length - 1) {
      return allChapters[currentIdx + 1];
    }
    return null;
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePreviewVideo, setActivePreviewVideo] = useState<CourseChapter | null>(null);
  const [previewSignedUrl, setPreviewSignedUrl] = useState<string | null>(null);
  const [loadingPreviewVideo, setLoadingPreviewVideo] = useState(false);

  // Buy-to-assign state — founder buys N seats, each becomes an
  // ItemReserveLicense that can be handed to a specific downline via
  // ReservesPanel. Only meaningful for paid, non-subscription courses.
  const [buyToAssign, setBuyToAssign] = useState(false);
  const [reserveQty, setReserveQty] = useState(1);
  const canReserve = !course.isFree && !(course as any).isSubscription;

  // Unenrolled view accordion state
  const [expandedSectionsUnenrolled, setExpandedSectionsUnenrolled] = useState<Set<string>>(() => {
    return new Set(course.sections?.[0] ? [course.sections[0]._id] : []);
  });

  const mediaItems = useMemo(() => {
    const items: Array<{ type: "image" | "video"; url: string; isYoutube?: boolean }> = [];
    
    // Add cover image
    if (course.coverImage) {
      items.push({ type: "image", url: course.coverImage });
    }

    // Add gallery images
    if (course.galleryImages && course.galleryImages.length > 0) {
      course.galleryImages.forEach(img => {
        if (img) items.push({ type: "image", url: img });
      });
    }

    // Add video if present
    if (course.videoUrl) {
      items.push({ type: "video", url: course.videoUrl, isYoutube: true });
    } else if (course.videoFile) {
      items.push({ type: "video", url: course.videoFile, isYoutube: false });
    }

    return items;
  }, [course.coverImage, course.galleryImages, course.videoUrl, course.videoFile]);

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  useEffect(() => {
    setActiveMediaIndex(0);
  }, [course._id]);

  const getCurrentChapter = (): CourseChapter | null => {
    if (!selectedChapter || !course.sections) return null;
    const section = course.sections.find(
      (s) => s._id === selectedChapter.sectionId
    );
    if (!section?.chapters) return null;
    return (
      section.chapters.find((c) => c._id === selectedChapter.chapterId) || null
    );
  };

  // Fetch preview signed S3 URL if needed
  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!activePreviewVideo) return;
      if (activePreviewVideo.videoS3Key) {
        setLoadingPreviewVideo(true);
        try {
          const { url } = await getCourseVideoStreamUrl(activePreviewVideo.videoS3Key);
          setPreviewSignedUrl(url);
        } catch (error) {
          console.error("Failed to load preview video:", error);
          toast.error("Failed to load preview video");
        } finally {
          setLoadingPreviewVideo(false);
        }
      } else {
        setPreviewSignedUrl(activePreviewVideo.videoUrl || null);
      }
    };
    fetchSignedUrl();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreviewVideo?._id]);

  // ===== Study Session Tracking =====
  const activeSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (!enrollment || !selectedChapter) return;

    const currentChapter = getCurrentChapter();
    if (!currentChapter) return;

    if (currentChapter.contentType === "quiz") return;

    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const startTracking = async () => {
      try {
        const session = await startStudySession({
          courseId: course._id,
          chapterId: selectedChapter.chapterId,
          sectionId: selectedChapter.sectionId,
          courseTitle: course.title,
          chapterTitle: currentChapter.title,
        });
        activeSessionId.current = session._id;

        heartbeatInterval = setInterval(async () => {
          try {
            await studySessionHeartbeat({
              chapterId: selectedChapter.chapterId,
              sectionId: selectedChapter.sectionId,
              chapterTitle: currentChapter.title,
            });
          } catch {
            // Silently ignore heartbeat failures
          }
        }, 60 * 1000);
      } catch {
        // Silently ignore session start failures
      }
    };

    startTracking();

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (activeSessionId.current) {
        endStudySession(activeSessionId.current).catch(() => {});
        activeSessionId.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapter?.chapterId, enrollment?._id]);

  useEffect(() => {
    return () => {
      if (activeSessionId.current) {
        endStudySession(activeSessionId.current).catch(() => {});
        activeSessionId.current = null;
      }
    };
  }, []);
  // ===== End Study Session Tracking =====

  // ===== S3 Video Streaming =====
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      const currentChapter = getCurrentChapter();
      if (!currentChapter) return;

      if (currentChapter.contentType === "video" && currentChapter.videoS3Key) {
        setIsLoadingVideo(true);
        try {
          const { url } = await getCourseVideoStreamUrl(currentChapter.videoS3Key);
          setSignedVideoUrl(url);
        } catch (error) {
          console.error("Failed to load video:", error);
          toast.error("Failed to load embedded video");
        } finally {
          setIsLoadingVideo(false);
        }
      } else {
        setSignedVideoUrl(null);
      }
    };

    fetchSignedUrl();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapter?.chapterId]);
  // ===== End S3 Video Streaming =====

  const [isPdfFullScreen, setIsPdfFullScreen] = useState(false);
  const [activePdfIndex, setActivePdfIndex] = useState(0);
  const [activePlayerTab, setActivePlayerTab] = useState<"overview" | "downloads">("overview");
  const [copiedJsonViewerIndex, setCopiedJsonViewerIndex] = useState<number | null>(null);

  // JSON viewer state
  const [activeJsonIndex, setActiveJsonIndex] = useState(0);
  const [jsonViewerContent, setJsonViewerContent] = useState<string | null>(null);
  const [jsonViewerLoading, setJsonViewerLoading] = useState(false);
  const [jsonViewerError, setJsonViewerError] = useState<string | null>(null);
  const [jsonViewerCopied, setJsonViewerCopied] = useState(false);

  useEffect(() => {
    setActivePdfIndex(0);
    setActiveJsonIndex(0);
    setJsonViewerContent(null);
    setJsonViewerError(null);
  }, [selectedChapter?.chapterId]);

  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedChapter?.chapterId) {
      setExpandedChapters(prev => {
        const next = new Set(prev);
        next.add(selectedChapter.chapterId);
        return next;
      });
    }
  }, [selectedChapter?.chapterId]);

  useEffect(() => {
    if (selectedChapter?.sectionId) {
      setExpandedSections(new Set([selectedChapter.sectionId]));
    }
  }, [selectedChapter?.sectionId, setExpandedSections]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const toggleSectionUnenrolled = (sectionId: string) => {
    setExpandedSectionsUnenrolled(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleChapterSelect = (sectionId: string, chapterId: string) => {
    if (!enrollment) {
      toast.error("You need to enroll in this course first");
      return;
    }
    setSelectedChapter({ sectionId, chapterId });
  };

  const isChapterCompleted = (chapterId: string) => {
    return (
      enrollment?.chaptersProgress.some(
        (p) => p.chapterId === chapterId && p.completed
      ) || false
    );
  };

  const handleMarkComplete = async (chapterId: string, sectionId: string) => {
    if (!enrollment) return;

    try {
      const updated = await markChapterComplete(
        course._id,
        chapterId,
        sectionId
      );
      onEnrollmentUpdate(updated);
      toast.success("Chapter completed!");
    } catch (error) {
      console.error("Error marking chapter complete:", error);
      toast.error("Failed to update progress");
    }
  };

  const handleMarkIncomplete = async (chapterId: string) => {
    if (!enrollment) return;

    try {
      const updated = await markChapterIncomplete(course._id, chapterId);
      onEnrollmentUpdate(updated);
      toast.success("Marked as incomplete");
    } catch (error) {
      console.error("Error marking chapter incomplete:", error);
      toast.error("Failed to update progress");
    }
  };

  const renderChapterContent = (chapter: CourseChapter | null) => {
    if (!chapter) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px] bg-[#1a1a22] rounded-lg">
          <div className="text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-[#9fa0b8]" />
            <p className="text-[#9fa0b8] font-medium">
              Select a chapter to view its content
            </p>
          </div>
        </div>
      );
    }

    switch (chapter.contentType) {
      case "video":
        if (!chapter.videoUrl && !chapter.videoS3Key) {
          return (
            <div className="flex items-center justify-center h-96 bg-[#1a1a22] rounded-lg">
              <p className="text-[#9fa0b8]">No video URL provided</p>
            </div>
          );
        }
        return (
          <div
            className="relative w-full bg-black rounded-xl overflow-hidden ring-1 ring-[#2a2a35] shadow-2xl"
            style={{ aspectRatio: "16/9", maxHeight: "70vh" }}
          >
            {chapter.videoS3Key ? (
              isLoadingVideo ? (
                <div className="flex flex-col items-center justify-center w-full h-full text-[#9fa0b8]">
                  <Loader2 className="w-8 h-8 animate-spin text-brand mb-4" />
                  <p>Loading secure video stream...</p>
                </div>
              ) : signedVideoUrl ? (
                <CustomVideoPlayer
                  src={signedVideoUrl}
                  className="w-full h-full"
                  onEnded={() => {
                    if (selectedChapter && !isChapterCompleted(chapter._id)) {
                      handleMarkComplete(chapter._id, selectedChapter.sectionId);
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-red-500">
                  <p>Failed to load video stream.</p>
                </div>
              )
            ) : (
              <CustomVideoPlayer
                src={chapter.videoUrl || ""}
                className="w-full h-full"
                onEnded={() => {
                  if (selectedChapter && !isChapterCompleted(chapter._id)) {
                    handleMarkComplete(chapter._id, selectedChapter.sectionId);
                  }
                }}
              />
            )}
          </div>
        );

      case "link":
        return (
          <div className="bg-[#1a1a22] rounded-lg p-8 text-center">
            <LinkIcon className="w-16 h-16 mx-auto mb-4 text-brand" />
            <h3 className="text-xl font-semibold mb-4 text-white">
              External Resource
            </h3>
            <p className="text-[#9fa0b8] mb-6">
              {chapter.content ||
                "Click the button below to access the external resource."}
            </p>
            {chapter.linkUrl && (
              <a
                href={chapter.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 bg-brand text-brand-foreground rounded-lg hover:opacity-90"
              >
                <LinkIcon className="w-5 h-5 mr-2" />
                Open Resource
              </a>
            )}
          </div>
        );

      case "pdf":
        const pdfsList = (chapter as any).pdfs && (chapter as any).pdfs.length > 0 
          ? (chapter as any).pdfs 
          : (chapter.pdfUrl ? [{ name: "PDF Document", url: chapter.pdfUrl, s3Key: chapter.pdfS3Key }] : []);

        if (pdfsList.length === 0) {
          return (
            <div className="flex items-center justify-center h-96 bg-[#1a1a22] rounded-lg">
              <p className="text-[#9fa0b8]">No PDF file provided</p>
            </div>
          );
        }

        const activePdf = pdfsList[activePdfIndex] || pdfsList[0];
        if (!activePdf) return null;

        return (
          <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
            <div className="flex flex-col rounded-xl overflow-hidden bg-black border border-[#2a2a35] shadow-2xl min-h-[500px]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#141419] to-[#0e0e12] border-b border-[#2a2a35] px-4 py-2.5 flex-shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate max-w-md leading-tight">
                      {pdfsList.length > 1 ? `${chapter.title} - ${activePdf.name}` : chapter.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-auto md:ml-0">
                  <button
                    onClick={() => setIsPdfFullScreen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#2a2a35] text-[#c7c7da] hover:text-white hover:bg-white/5 transition-all text-[11px] font-semibold"
                    title="Full Screen"
                  >
                    <Maximize2 className="w-3 h-3" />
                    Full Screen
                  </button>
                  <a
                    href={activePdf.url}
                    download={activePdf.name || chapter.title}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-brand hover:opacity-90 text-brand-foreground transition-all text-[11px] font-bold shadow-lg shadow-brand/10"
                    title="Download document"
                  >
                    <FileDown className="w-3 h-3" />
                    Download
                  </a>
                </div>
              </div>

              <div className="flex-1 bg-black relative">
                <iframe
                  src={`${activePdf.url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                  className="w-full h-full min-h-[600px] border-0 block"
                  style={{ height: "calc(100vh - 240px)" }}
                  title={activePdf.name || chapter.title}
                />
              </div>
            </div>
          </div>
        );

      case "json":
        const jsonFilesList = (chapter as any).jsonFiles && (chapter as any).jsonFiles.length > 0
          ? (chapter as any).jsonFiles
          : [];

        if (jsonFilesList.length === 0) {
          return (
            <div className="flex items-center justify-center h-96 bg-[#1a1a22] rounded-lg">
              <p className="text-[#9fa0b8]">No JSON files provided</p>
            </div>
          );
        }

        const activeJsonFile = jsonFilesList[activeJsonIndex] || jsonFilesList[0];

        const loadJsonForViewer = async (url: string) => {
          setJsonViewerLoading(true);
          setJsonViewerError(null);
          setJsonViewerContent(null);
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            try {
              const parsed = JSON.parse(text);
              setJsonViewerContent(JSON.stringify(parsed, null, 2));
            } catch {
              setJsonViewerContent(text);
            }
          } catch (err: any) {
            setJsonViewerError(err.message || "Failed to load JSON");
          } finally {
            setJsonViewerLoading(false);
          }
        };

        const downloadJsonFile = async (jf: any, idx: number) => {
          try {
            const res = await fetch(jf.url);
            const text = await res.text();
            let content = text;
            try {
              const parsed = JSON.parse(text);
              content = JSON.stringify(parsed, null, 2);
            } catch { /* use raw text */ }
            const blob = new Blob([content], { type: "application/json" });
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = jf.name || `resource_${idx + 1}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            toast.success(`"${jf.name || `resource_${idx + 1}.json`}" downloaded`);
          } catch {
            toast.error("Download failed");
          }
        };

        return (
          <div className="flex flex-col gap-0 w-full max-w-5xl mx-auto rounded-xl overflow-hidden border border-[#2a2a35] shadow-2xl bg-[#0e0e12]">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#141419] to-[#0e0e12] border-b border-[#2a2a35] px-4 py-2.5 flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <FileCode className="w-3.5 h-3.5 text-yellow-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate max-w-sm leading-tight">
                    {activeJsonFile?.name || chapter.title}
                  </h3>
                  <p className="text-[10px] text-[#9fa0b8]">
                    {jsonFilesList.length} {jsonFilesList.length === 1 ? "file" : "files"}
                    {activeJsonFile?.fileSize ? ` • ${Math.round(activeJsonFile.fileSize / 1024)} KB` : ""}
                    {" • JSON"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Copy button — always copies the FULL file, not just the visible preview */}
                <button
                  onClick={async () => {
                    try {
                      // Always fetch the source URL directly — guarantees full file regardless of preview cap
                      const res = await fetch(activeJsonFile.url);
                      const text = await res.text();
                      let toCopy = text;
                      try { toCopy = JSON.stringify(JSON.parse(text), null, 2); } catch {}
                      await navigator.clipboard.writeText(toCopy);
                      setJsonViewerCopied(true);
                      toast.success("Full JSON copied to clipboard!");
                      setTimeout(() => setJsonViewerCopied(false), 2000);
                    } catch { toast.error("Failed to copy"); }
                  }}
                  title="Copies the complete JSON file to clipboard"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#2a2a35] text-[#c7c7da] hover:text-white hover:bg-white/5 transition-all text-[11px] font-medium"
                >
                  {jsonViewerCopied ? (
                    <><CheckCircle className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied!</span></>
                  ) : (
                    <><Copy className="w-3 h-3" />Copy full JSON</>
                  )}
                </button>
                {/* Download button */}
                <button
                  onClick={() => downloadJsonFile(activeJsonFile, activeJsonIndex)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-brand hover:opacity-90 text-brand-foreground transition-all text-[11px] font-bold shadow-lg shadow-brand/10"
                >
                  <FileDown className="w-3 h-3" />
                  Download
                </button>
              </div>
            </div>

            {/* File tabs (shown only if multiple files) */}
            {jsonFilesList.length > 1 && (
              <div className="flex items-center gap-0 bg-[#0a0a10] border-b border-[#2a2a35] px-3 overflow-x-auto">
                {jsonFilesList.map((jf: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (idx === activeJsonIndex) return;
                      setActiveJsonIndex(idx);
                      setJsonViewerContent(null);
                      setJsonViewerError(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-all whitespace-nowrap ${
                      idx === activeJsonIndex
                        ? "border-brand text-brand bg-brand/5"
                        : "border-transparent text-[#9fa0b8] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <FileCode className="w-3 h-3" />
                    {jf.name || `file_${idx + 1}.json`}
                  </button>
                ))}
              </div>
            )}

            {/* JSON Viewer */}
            <div className="relative bg-[#0a0a10] min-h-[420px] flex flex-col">
              {/* Load viewer trigger */}
              {jsonViewerContent === null && !jsonViewerLoading && !jsonViewerError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={() => loadJsonForViewer(activeJsonFile.url)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand hover:opacity-90 text-brand-foreground text-sm font-bold transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    View JSON
                  </button>
                </div>
              )}
              {jsonViewerLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2.5 text-[#9fa0b8]">
                    <Loader2 className="w-5 h-5 animate-spin text-brand" />
                    <span className="text-sm">Loading JSON…</span>
                  </div>
                </div>
              )}
              {jsonViewerError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-red-400 text-sm mb-3">{jsonViewerError}</p>
                    <button
                      onClick={() => loadJsonForViewer(activeJsonFile.url)}
                      className="text-xs text-brand hover:underline"
                    >Retry</button>
                  </div>
                </div>
              )}
              {jsonViewerContent !== null && !jsonViewerLoading && (() => {
                const allLines = jsonViewerContent.split("\n");
                const MAX_PREVIEW_LINES = 1500;
                const isTruncated = allLines.length > MAX_PREVIEW_LINES;
                const previewCode = isTruncated
                  ? allLines.slice(0, MAX_PREVIEW_LINES).join("\n")
                  : jsonViewerContent;
                return (
                  <>
                    <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 320px)", minHeight: 420 }}>
                      <div className="flex">
                        {/* Line numbers */}
                        <div
                          className="select-none text-right pr-4 pl-3 py-4 text-[11px] font-mono leading-[1.7] text-[#4a4a5a] bg-[#0a0a10] border-r border-[#1a1a22] flex-shrink-0"
                          style={{ minWidth: "3rem" }}
                          aria-hidden="true"
                        >
                          {(isTruncated ? allLines.slice(0, MAX_PREVIEW_LINES) : allLines).map((_, i) => (
                            <div key={i}>{i + 1}</div>
                          ))}
                        </div>
                        {/* Syntax-highlighted preview (capped for performance) */}
                        <pre
                          className="flex-1 py-4 px-4 text-[12px] font-mono leading-[1.7] text-[#c7c7da] overflow-x-auto whitespace-pre"
                          style={{ margin: 0, background: "transparent" }}
                        >
                          <JsonSyntaxHighlight code={previewCode} />
                        </pre>
                      </div>
                    </div>
                    {/* Truncation banner */}
                    {isTruncated && (
                      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#0f0f08] border-t border-yellow-500/20 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                          <p className="text-[11px] text-yellow-300">
                            Preview shows first {MAX_PREVIEW_LINES.toLocaleString()} of {allLines.length.toLocaleString()} lines.
                            {" "}Copy full JSON or download to access the complete file.
                          </p>
                        </div>
                        <button
                          onClick={() => downloadJsonFile(activeJsonFile, activeJsonIndex)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/20 text-[10px] font-medium transition-colors whitespace-nowrap"
                        >
                          <FileDown className="w-3 h-3" />
                          Download full file
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        );

      case "quiz":
        return (
          <QuizPlayer
            chapter={chapter}
            course={course}
            enrollment={enrollment}
            selectedChapter={selectedChapter}
            onEnrollmentUpdate={onEnrollmentUpdate}
            onNavigateToChapter={(sectionId: string, chapterId: string) => {
              setSelectedChapter({ sectionId, chapterId });
            }}
          />
        );

      default:
        return (
          <div className="bg-[#1a1a22] rounded-lg p-8">
            <div
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: chapter.content || "No content available",
              }}
            />
          </div>
        );
    }
  };

  // Show the learning player whenever the user is enrolled and has selected a chapter
  // to play — regardless of which tab (analytics, enrolled, etc.) they navigated from.
  const isEnrolled = !!enrollment && (activeSection === "enrolled" || !!selectedChapter);

  // Total duration calculations
  const totalDurationSeconds = course.sections?.reduce((sum, s) => {
    return sum + (s.chapters?.reduce((sumC, c) => sumC + (c.duration || 0), 0) || 0);
  }, 0) || 0;

  const totalSectionsCount = course.sections?.length || 0;
  const totalChaptersCount = course.totalChapters || course.sections?.reduce((sum, s) => sum + (s.chapters?.length || 0), 0) || 0;

  const formatTotalDuration = (seconds: number) => {
    if (seconds <= 0) return "0h 0m total length";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m total length`;
    }
    return `${minutes}m total length`;
  };

  const formatChapterDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Find previewable chapters (first 2 chapters of the first section)
  const firstSection = course.sections?.[0];
  const previewChapters = firstSection?.chapters?.slice(0, 2).filter(c => c.contentType === "video") || [];

  const handlePlayFirstPreview = () => {
    if (previewChapters.length > 0) {
      setActivePreviewVideo(previewChapters[0]);
    } else {
      toast.info("No preview is available for this course.");
    }
  };

  // Load plan to check if commission plan exists
  const [detailPlan, setDetailPlan] = useState<CombPlan | null>(null);
  useEffect(() => {
    const loadPlan = async () => {
      try {
        const result = await getCombPlanForItem("course", course._id);
        if (result?.plan) {
          setDetailPlan(result.plan);
        }
      } catch (err) {
        console.error("Error loading detail plan:", err);
      }
    };
    loadPlan();
  }, [course._id]);

  // Count resources (PDFs, links, JSON, text chapters)
  const resourceCount = course.sections?.reduce((sum, s) => {
    return sum + (s.chapters?.filter(c =>
      c.contentType === "pdf" ||
      c.contentType === "link" ||
      c.contentType === "json" ||
      c.contentType === "text"
    ).length || 0);
  }, 0) || 0;

  // Star rendering helper
  const renderStars = (rating: number, sizeClass = "w-4.5 h-4.5") => {
    return (
      <div className="flex gap-0.5 text-yellow-400">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < Math.round(rating);
          return (
            <Star
              key={i}
              className={cn(
                sizeClass,
                filled ? "fill-yellow-400 text-yellow-400" : "text-[#2a2a35] fill-none"
              )}
            />
          );
        })}
      </div>
    );
  };

  // Reviews aggregations
  const reviews = course.reviews || [];
  const totalReviews = reviews.length;
  const avgRating = course.rating || (totalReviews > 0 ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10 : 0);

  const barPercentages = [0, 0, 0, 0, 0];
  if (totalReviews > 0) {
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach(r => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      counts[5 - star]++;
    });
    for (let i = 0; i < 5; i++) {
      barPercentages[i] = Math.round((counts[i] / totalReviews) * 100);
    }
  }

  // Current active chapter inside standard enrolled player
  const currentChapter = getCurrentChapter();

  return (
    <div className={cn(
      "w-full min-h-full flex-1 flex flex-col bg-[#0a0a0d]",
      isEnrolled ? "overflow-hidden" : ""
    )}>
      {/* Detail View Header */}
      {!isEnrolled && (
        <div className="border-b border-[#2a2a35] bg-[#0e0e12] px-6 py-4 flex-shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center text-[#9fa0b8] hover:text-white transition-colors text-sm font-medium"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Courses
              </button>
              <div className="h-6 w-px bg-[#2a2a35] hidden md:block" />
              <h1 className="text-lg font-semibold text-white truncate max-w-md leading-none pt-0.5">
                {course.title}
              </h1>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={cn(
        "flex",
        isEnrolled ? "flex-1 overflow-hidden p-6 bg-[#0b0b0d]" : "flex-col md:flex-row pb-20 md:pb-0"
      )}>
        {isEnrolled ? (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 w-full overflow-y-auto lg:overflow-hidden">
            {/* LEFT: Main player area */}
            <div className="flex-1 flex flex-col lg:overflow-y-auto bg-transparent [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-1 min-h-0">
              {/* Back Button */}
              <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                <button
                  onClick={onBack}
                  className="flex items-center gap-1.5 text-xs text-[#9fa0b8] hover:text-white transition-colors font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Courses</span>
                </button>
              </div>

              {/* Video Area */}
              <div className="w-full mb-6 flex-shrink-0">
                {renderChapterContent(currentChapter)}
              </div>

              {/* Chapter title + section info */}
              {currentChapter && (
                <div className="px-5 pt-5 pb-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight leading-tight">
                    {currentChapter.title}
                  </h2>
                  <p className="text-sm text-[#9fa0b8] mt-1.5 font-medium">
                    {(() => {
                      const secIdx = course.sections?.findIndex(s => s._id === selectedChapter?.sectionId);
                      const sec = course.sections?.[secIdx !== undefined ? secIdx : -1];
                      if (!sec) return "";
                      const sectionLabel = secIdx !== undefined && secIdx !== -1 ? `Section ${secIdx + 1}: ${sec.title}` : sec.title;
                      return `${sectionLabel}${currentChapter.duration ? ` • ${formatChapterDuration(currentChapter.duration)}` : ""}`;
                    })()}
                  </p>
                </div>
              )}

              {/* Tabs: Overview | Downloads */}
              <div className="px-5 pt-2 flex gap-6 flex-shrink-0">
                {(["overview", "downloads"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActivePlayerTab(tab)}
                    className={cn(
                      "pb-3 text-sm font-medium capitalize border-b-2 transition-colors",
                      activePlayerTab === tab
                        ? "border-brand text-brand"
                        : "border-transparent text-[#9fa0b8] hover:text-white"
                    )}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="px-5 py-4 flex-1">
                {activePlayerTab === "overview" && currentChapter && (
                  <div>
                    <h3 className="text-sm font-bold text-white mb-2">About this lesson</h3>
                    {currentChapter.contentType === "text" ? (
                      <p className="text-[#9fa0b8] text-sm italic">This is a text lesson. The content is displayed in the main container above.</p>
                    ) : currentChapter.content ? (
                      <div
                        className="text-[#c7c7da] text-sm leading-relaxed prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: currentChapter.content }}
                      />
                    ) : (
                      <p className="text-[#9fa0b8] text-sm italic">No description provided for this lesson.</p>
                    )}
                  </div>
                )}

                {activePlayerTab === "overview" && !currentChapter && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <BookOpen className="w-12 h-12 text-[#9fa0b8] mb-3" />
                    <p className="text-[#9fa0b8]">Select a chapter from the course content to get started</p>
                  </div>
                )}

                {activePlayerTab === "downloads" && (
                  <div>
                    <h3 className="text-sm font-bold text-white mb-3">Downloads</h3>
                    {(() => {
                      // Collect all downloadable PDFs from the current chapter or all chapters
                      const downloadables: { name: string; url: string }[] = [];
                      if (currentChapter?.contentType === "pdf") {
                        const pdfs = (currentChapter as any).pdfs;
                        if (pdfs && pdfs.length > 0) {
                          pdfs.forEach((pdf: any) => {
                            if (pdf.url) downloadables.push({ name: pdf.name || "Document", url: pdf.url });
                          });
                        } else if (currentChapter.pdfUrl) {
                          downloadables.push({ name: currentChapter.title, url: currentChapter.pdfUrl });
                        }
                      }
                      // Also collect PDFs from all sections
                      course.sections?.forEach(sec => {
                        sec.chapters?.forEach(ch => {
                          if (ch.contentType === "pdf") {
                            const pdfs = (ch as any).pdfs;
                            if (pdfs && pdfs.length > 0) {
                              pdfs.forEach((pdf: any) => {
                                if (pdf.url && !downloadables.find(d => d.url === pdf.url)) {
                                  downloadables.push({ name: `${ch.title} - ${pdf.name || "Document"}`, url: pdf.url });
                                }
                              });
                            } else if (ch.pdfUrl && !downloadables.find(d => d.url === ch.pdfUrl)) {
                              downloadables.push({ name: ch.title, url: ch.pdfUrl });
                            }
                          }
                        });
                      });

                      if (downloadables.length === 0) {
                        return <p className="text-[#9fa0b8] text-sm italic">No downloadable resources available for this course.</p>;
                      }
                      return (
                        <div className="space-y-2">
                          {downloadables.map((item, i) => (
                            <a
                              key={i}
                              href={item.url}
                              download={item.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a22] border border-[#2a2a35] hover:border-brand/40 hover:bg-[#1a1a22]/80 transition-colors group"
                            >
                              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-red-400" />
                              </div>
                              <span className="flex-1 text-sm text-white truncate group-hover:text-brand transition-colors">{item.name}</span>
                              <FileDown className="w-4 h-4 text-[#9fa0b8] group-hover:text-brand flex-shrink-0 transition-colors" />
                            </a>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: course content, then the reviews card below it */}
            <div
              className={cn(
                "flex flex-col gap-4 w-full shrink-0 mt-6 lg:mt-0 lg:h-full lg:min-h-0",
                sidebarCollapsed ? "lg:w-[44px]" : "lg:w-[360px]"
              )}
            >
            {/* Course content sidebar */}
            <div
              className={cn(
                "flex flex-col bg-[#0e0e12] border border-[#2a2a35]/60 rounded-2xl overflow-hidden transition-all duration-300 w-full",
                "h-[500px] lg:h-auto lg:flex-1 lg:min-h-0"
              )}
            >
              {/* Sidebar header */}
              <div className="px-4 py-4 border-b border-[#2a2a35] flex-shrink-0 flex items-center justify-between gap-2">
                {!sidebarCollapsed ? (
                  <>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white whitespace-nowrap">Course content</p>
                      <p className="text-xs text-[#9fa0b8] mt-0.5 whitespace-nowrap">
                        {enrollment?.chaptersProgress?.filter(p => p.completed).length || 0} of{" "}
                        {totalChaptersCount} chapters complete
                      </p>
                    </div>
                    <button
                      onClick={() => setSidebarCollapsed(true)}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#2a2a35] transition-colors text-[#9fa0b8] hover:text-white shrink-0"
                      title="Collapse sidebar"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#2a2a35] transition-colors text-[#9fa0b8] hover:text-white mx-auto shrink-0"
                    title="Expand sidebar"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!sidebarCollapsed && (
                <>
                  {/* Sidebar controls (Completion status badge & action buttons) */}
                  {currentChapter && (
                    <div className="px-4 py-3 border-b border-[#2a2a35] bg-[#14141a] flex items-center justify-between gap-2 flex-shrink-0">
                      {isChapterCompleted(currentChapter._id) ? (
                        <button
                          onClick={() => handleMarkIncomplete(currentChapter._id)}
                          className="flex-1 flex items-center justify-center gap-1 text-xs text-green-400 hover:text-green-500 bg-green-500/10 hover:bg-green-500/20 py-2 rounded-lg border border-green-500/20 transition-colors font-semibold"
                          title="Click to mark incomplete"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Completed</span>
                        </button>
                      ) : currentChapter.contentType === "quiz" ? (
                        <span className="flex-1 text-xs text-[#9fa0b8] flex items-center justify-center gap-1.5 bg-[#1a1a22] py-2 rounded-lg border border-[#2a2a35]">
                          <ClipboardList className="w-3.5 h-3.5 text-brand" />
                          <span>Pass quiz to complete</span>
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleMarkComplete(currentChapter._id, selectedChapter!.sectionId)}
                          className="flex-1 h-8 text-xs bg-brand text-brand-foreground hover:opacity-90 font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Circle className="w-3.5 h-3.5" />
                          <span>Mark Complete</span>
                        </Button>
                      )}

                      {isChapterCompleted(currentChapter._id) && (() => {
                        const nextChapter = getNextChapter();
                        return nextChapter ? (
                          <Button
                            size="sm"
                            onClick={() => setSelectedChapter(nextChapter)}
                            className="flex-1 h-8 text-xs bg-brand text-brand-foreground hover:opacity-90 font-semibold flex items-center justify-center gap-1.5"
                          >
                            <span>Next Lesson</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        ) : null;
                      })()}
                    </div>
                  )}

                  {/* Sections list */}
                  <div className="flex-1 overflow-y-auto">
                    {course.sections?.map((section) => {
                      const sectionChapterCount = section.chapters?.length || 0;
                      const sectionDuration = section.chapters?.reduce((sum, c) => sum + (c.duration || 0), 0) || 0;
                      const isExpanded = expandedSections.has(section._id);

                      return (
                        <div key={section._id} className="border-b border-[#2a2a35]">
                          {/* Section header */}
                          <button
                            onClick={() => toggleSection(section._id)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#1a1a22]/30 transition-colors bg-[#0e0e12]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-[#9fa0b8] flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-[#9fa0b8] flex-shrink-0" />
                              )}
                              <span className="text-sm font-bold text-white truncate">{section.title}</span>
                            </div>
                            <span className="text-[11px] text-[#9fa0b8] shrink-0">
                              {sectionChapterCount} {sectionChapterCount === 1 ? "chapter" : "chapters"}
                              {sectionDuration > 0 ? ` • ${formatChapterDuration(sectionDuration)}` : ""}
                            </span>
                          </button>

                          {/* Chapter list */}
                          {isExpanded && section.chapters?.map((chapter, idx) => {
                            const isActive = selectedChapter?.chapterId === chapter._id;
                            const isCompleted = isChapterCompleted(chapter._id);

                            return (
                              <div key={chapter._id} className="flex flex-col">
                                <button
                                  onClick={() => {
                                    if (!isActive) {
                                      handleChapterSelect(section._id, chapter._id);
                                      setActivePdfIndex(0);
                                      setExpandedChapters(prev => {
                                        const next = new Set(prev);
                                        next.add(chapter._id);
                                        return next;
                                      });
                                    } else {
                                      setExpandedChapters(prev => {
                                        const next = new Set(prev);
                                        if (next.has(chapter._id)) next.delete(chapter._id);
                                        else next.add(chapter._id);
                                        return next;
                                      });
                                    }
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#1a1a22] bg-[#08080a]",
                                    isActive
                                      ? "bg-brand/5 border-l-2 border-l-brand pl-[14px]"
                                      : "hover:bg-[#1a1a22]/40"
                                  )}
                                >
                                  {/* Status icon */}
                                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                                    {isCompleted ? (
                                      <div className="w-4.5 h-4.5 rounded-full bg-[#10b981] flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-white stroke-[3px]" />
                                      </div>
                                    ) : isActive ? (
                                      <div className="w-4.5 h-4.5 rounded-full bg-brand flex items-center justify-center shrink-0">
                                        <Play className="w-2.5 h-2.5 text-brand-foreground fill-current" />
                                      </div>
                                    ) : (
                                      <div className="w-4.5 h-4.5 rounded-full border border-[#3a3a45] bg-transparent shrink-0" />
                                    )}
                                  </div>

                                  {/* Chapter title + type icon */}
                                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                    <span className={cn(
                                      "text-xs truncate",
                                      isActive ? "text-brand font-semibold" : "text-[#c7c7da]"
                                    )}>
                                      {chapter.title}
                                    </span>
                                    {chapter.contentType === "video" && (
                                      <Video className={cn("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-brand" : "text-[#8888a0]")} />
                                    )}
                                    {chapter.contentType === "pdf" && (
                                      <FileText className={cn("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-brand" : "text-[#8888a0]")} />
                                    )}
                                    {chapter.contentType === "link" && (
                                      <ExternalLink className={cn("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-brand" : "text-[#8888a0]")} />
                                    )}
                                    {chapter.contentType === "quiz" && (
                                      <ClipboardList className={cn("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-brand" : "text-[#8888a0]")} />
                                    )}
                                  </div>

                                  {/* Duration + checkbox */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {(chapter.duration ?? 0) > 0 && (
                                      <span className={cn("text-[11px] font-medium tabular-nums", isActive ? "text-brand" : "text-[#8888a0]")}>
                                        {formatChapterDuration(chapter.duration)}
                                      </span>
                                    )}
                                    <div className={cn(
                                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                      isCompleted
                                        ? "bg-[#10b981] border-[#10b981]"
                                        : "border-[#3a3a45] bg-transparent"
                                    )}>
                                      {isCompleted && <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />}
                                    </div>
                                  </div>
                                </button>

                                {/* PDF sub-items */}
                                {chapter.contentType === "pdf" && expandedChapters.has(chapter._id) && (chapter as any).pdfs && (chapter as any).pdfs.length > 1 && (
                                  <div className="bg-[#050507] border-t border-[#1a1a25] py-1 space-y-0.5">
                                    {(chapter as any).pdfs.map((pdf: any, pdfIdx: number) => {
                                      const isPdfActive = activePdfIndex === pdfIdx;
                                      return (
                                        <button
                                          key={pdfIdx}
                                          onClick={() => setActivePdfIndex(pdfIdx)}
                                          className={cn(
                                            "w-full flex items-center pl-12 pr-4 py-2 text-left hover:bg-[#1a1a22]/60 transition-colors text-xs font-medium border-l border-transparent",
                                            isPdfActive ? "text-brand bg-brand/5 border-l-brand" : "text-[#9fa0b8]"
                                          )}
                                        >
                                          <FileText className={cn("w-3.5 h-3.5 mr-2", isPdfActive ? "text-red-400" : "text-[#9fa0b8]")} />
                                          <span className="truncate flex-1">{pdf.name || `Document ${pdfIdx + 1}`}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress bar at the bottom */}
                  <div className="p-4 border-t border-[#2a2a35] bg-[#0e0e12] flex-shrink-0">
                    <div className="w-full bg-[#1a1a22] rounded-full h-1.5 mb-2">
                      <div
                        className="bg-brand h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${enrollment?.progressPercentage || 0}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-brand font-bold tracking-wide">
                      {enrollment?.progressPercentage || 0}% complete
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Reviews & Ratings — sits directly below Course content. This
                is where an enrolled learner writes their course review; the
                Discover card and the "See all" panel are read-only.
                Stars and the write button only — "See all" opens the full
                breakdown in the right sidebar. */}
            {!sidebarCollapsed && (
              <RatingsReviewsCard
                targetType="course"
                targetId={course._id}
                targetName={course.title}
                className="bg-[#0e0e12] border-[#2a2a35]/60 rounded-2xl p-4 shadow-none"
              />
            )}
            </div>
          </div>
        ) : (
          /* Custom Figma unenrolled layout */
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8 flex flex-col lg:flex-row gap-8 items-start w-full">
            {/* Left Column (Main details) */}
            <div className="space-y-6 w-full min-w-0 flex-[2]">
              
              {/* Top Card: Cover Image, Title, Description */}
              <div className="bg-[#16161c] border border-[#2a2a35]/60 rounded-2xl p-6 space-y-6">
                {/* Cover Image & Media Gallery */}
                <div className="space-y-4">
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#2a2a35] shadow-2xl bg-[#0e0e12] flex-shrink-0 flex items-center justify-center">
                    {mediaItems.length > 0 ? (
                      (() => {
                        const activeMedia = mediaItems[activeMediaIndex];
                        if (!activeMedia) return null;
                        if (activeMedia.type === "video") {
                          if (activeMedia.isYoutube) {
                            const getYouTubeEmbedUrl = (url: string) => {
                              if (url.includes("youtu.be/")) {
                                const parts = url.split("youtu.be/");
                                if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                              } else if (url.includes("youtube.com/watch?v=")) {
                                const parts = url.split("v=");
                                if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("&")[0]}`;
                              } else if (url.includes("youtube.com/embed/")) {
                                const parts = url.split("embed/");
                                if (parts[1]) return `https://www.youtube.com/embed/${parts[1].split("?")[0]}`;
                              }
                              return url;
                            };
                            return (
                              <iframe
                                src={getYouTubeEmbedUrl(activeMedia.url)}
                                className="w-full h-full border-none"
                                allowFullScreen
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              />
                            );
                          } else {
                            return (
                              <video
                                src={activeMedia.url}
                                controls
                                className="w-full h-full object-contain"
                              />
                            );
                          }
                        }
                        return (
                          <img
                            src={activeMedia.url}
                            alt={course.title}
                            className="w-full h-full object-cover"
                          />
                        );
                      })()
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-[#16161a] text-[#9fa0b8]/40 gap-3">
                        <BookOpen className="h-14 w-14" />
                        <span className="text-xs font-semibold uppercase tracking-wider">No Cover Image</span>
                      </div>
                    )}
                    
                    {mediaItems.length > 1 && (
                      <>
                        <button
                          onClick={() => setActiveMediaIndex((prev) => prev === 0 ? mediaItems.length - 1 : prev - 1)}
                          className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors cursor-pointer z-10"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setActiveMediaIndex((prev) => prev === mediaItems.length - 1 ? 0 : prev + 1)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors cursor-pointer z-10"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Thumbnails Row */}
                  {mediaItems.length > 1 && (
                    <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {mediaItems.map((item, idx) => {
                        const isVideo = item.type === "video";
                        let thumbUrl = item.url;
                        if (isVideo && item.isYoutube) {
                          const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                          const match = item.url.match(regExp);
                          if (match && match[2].length === 11) {
                            thumbUrl = `https://img.youtube.com/vi/${match[2]}/mqdefault.jpg`;
                          }
                        }
                        return (
                          <button
                            key={idx}
                            onClick={() => setActiveMediaIndex(idx)}
                            className={cn(
                              "w-20 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer shadow-md relative bg-[#131316] flex items-center justify-center",
                              activeMediaIndex === idx ? "border-brand scale-102" : "border-[#2a2a35] opacity-70 hover:opacity-100"
                            )}
                          >
                            {isVideo ? (
                              <>
                                {item.isYoutube ? (
                                  <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-black/40">
                                    <Video className="w-5 h-5 text-white/80" />
                                  </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <Play className="w-4 h-4 text-white fill-white" />
                                </div>
                              </>
                            ) : (
                              <img src={thumbUrl} alt={`${course.title} ${idx + 1}`} className="w-full h-full object-cover" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Title & Description */}
                <div className="space-y-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight font-geist">
                    {course.title}
                  </h1>
                  {course.description && (
                    <div
                      className="text-sm text-[#9fa0b8] leading-relaxed prose prose-invert max-w-none [&_a]:text-brand [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: sanitizeDescription(course.description) }}
                    />
                  )}
                </div>
              </div>

              {/* What you'll learn */}
              {course.whatYouWillLearn && course.whatYouWillLearn.filter(Boolean).length > 0 && (
                <div className="bg-[#16161c] border border-[#2a2a35]/60 rounded-2xl p-6">
                  <h2 className="text-base font-bold text-white mb-4">What you&apos;ll learn</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
                    {course.whatYouWillLearn.filter(Boolean).map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                        <span className="text-xs text-[#c7c7da] leading-normal font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements */}
              {course.requirements && course.requirements.filter(Boolean).length > 0 && (
                <div className="bg-[#16161c] border border-[#2a2a35]/60 rounded-2xl p-6">
                  <h2 className="text-base font-bold text-white mb-4">Requirements</h2>
                  <div className="space-y-3.5">
                    {course.requirements.filter(Boolean).map((req, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-3.5 h-3.5 rounded-full border border-[#9fa0b8]/40 flex items-center justify-center shrink-0 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#9fa0b8]/40" />
                        </div>
                        <span className="text-xs text-[#c7c7da] leading-normal font-medium">{req}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Course Content Accordion */}
              <div className="space-y-4">
                <div className="flex items-baseline justify-between border-b border-[#2a2a35]/40 pb-2">
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-base font-bold text-white">Course content</h2>
                    <span className="text-[10px] text-[#6b6b7b] font-medium leading-none">(Reviews enabled)</span>
                  </div>
                  <span className="text-xs text-[#9fa0b8] font-medium">
                    {totalSectionsCount} sections • {totalChaptersCount} chapters • {formatTotalDuration(totalDurationSeconds)}
                  </span>
                </div>

                <div className="space-y-3">
                  {course.sections?.map((section, secIdx) => {
                    const isExpanded = expandedSectionsUnenrolled.has(section._id);
                    const sectionDuration = section.chapters?.reduce((sum, c) => sum + (c.duration || 0), 0) || 0;
                    return (
                      <div
                        key={section._id}
                        className="border border-[#2a2a35]/60 bg-[#16161c] rounded-xl overflow-hidden"
                      >
                        {/* Section Accordion Trigger Header */}
                        <button
                          onClick={() => toggleSectionUnenrolled(section._id)}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-[#202028] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-4">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[#9fa0b8] shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-[#9fa0b8] shrink-0" />
                            )}
                            <span className="font-bold text-white text-sm truncate">
                              {section.title}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#9fa0b8] font-semibold flex-shrink-0">
                            {section.chapters?.length || 0} chapters • {formatTotalDuration(sectionDuration)}
                          </span>
                        </button>

                        {/* Section Chapters List */}
                        {isExpanded && section.chapters && (
                          <div className="border-t border-[#2a2a35]/40 bg-[#0d0d11]">
                            {section.chapters.map((chapter) => {
                              const isUserEnrolled = !!enrollment;
                              return (
                                <div
                                  key={chapter._id}
                                  onClick={() => {
                                    if (isUserEnrolled) {
                                      setSelectedChapter({ sectionId: section._id, chapterId: chapter._id });
                                      setActiveSection("enrolled");
                                    } else {
                                      toast.info("Please enroll in this course to access this content.");
                                    }
                                  }}
                                  className={cn(
                                    "flex items-center justify-between px-5 py-3 border-b border-[#2a2a35]/40 last:border-0 hover:bg-[#16161c]/60 transition-colors",
                                    isUserEnrolled ? "cursor-pointer" : "cursor-default"
                                  )}
                                >
                                  <div className="flex items-center gap-3 min-w-0 pr-4">
                                    <Play className="w-3.5 h-3.5 text-[#9fa0b8] shrink-0" />
                                    <span className="text-xs text-[#c7c7da] truncate font-medium">
                                      {chapter.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    {chapter.duration ? (
                                      <span className="text-[11px] text-[#6b6b7b] font-medium">
                                        {formatChapterDuration(chapter.duration)}
                                      </span>
                                    ) : null}
                                    {!isUserEnrolled && <Lock className="w-3 h-3 text-[#6b6b7b]" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ratings & Reviews — live, user-submitted. Rendered above the
                  founder-curated "Student Reviews" block below, which is
                  separate content and left untouched. */}
              <div className="pt-2">
                <RatingsReviewsCard
                  targetType="course"
                  targetId={course._id}
                  targetName={course.title}
                  showWriteButton={false}
                />
              </div>

              {/* Student Reviews list */}
              {reviews.length > 0 && (
                <div className="space-y-6 pt-2">
                  <div className="flex items-baseline gap-3 border-b border-[#2a2a35]/40 pb-2">
                    <h2 className="text-base font-bold text-white">Student Reviews</h2>
                    <span className="text-[10px] text-[#6b6b7b] font-medium leading-none">(Reviews enabled)</span>
                  </div>
                  
                  {/* Reviews Summary panel */}
                  <div className="flex flex-col md:flex-row gap-6 p-6 bg-[#16161c] border border-[#2a2a35]/60 rounded-2xl items-center md:items-start">
                    {/* Big Score Card */}
                    <div className="flex flex-col items-center justify-center text-center pr-0 md:pr-6 md:border-r border-[#2a2a35]/40 flex-shrink-0">
                      <span className="text-5xl font-black text-brand font-mono leading-none mb-2">
                        {avgRating}
                      </span>
                      {renderStars(avgRating, "w-4.5 h-4.5")}
                      <span className="text-[10px] text-[#9fa0b8] font-bold mt-2 uppercase tracking-wide">
                        ({totalReviews} ratings)
                      </span>
                    </div>

                    {/* Star Breakdown bars */}
                    <div className="flex-1 w-full space-y-2.5">
                      {barPercentages.map((percent, idx) => {
                        const starsCount = 5 - idx;
                        return (
                          <div key={idx} className="flex items-center gap-3 text-xs">
                            <span className="text-[#9fa0b8] font-bold w-4 flex-shrink-0 text-right">{starsCount}★</span>
                            <div className="flex-1 bg-[#1e1e24] h-2 rounded-full overflow-hidden border border-white/5">
                              <div
                                className="bg-brand h-full rounded-full transition-all duration-300"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-[#9fa0b8] font-semibold w-8 flex-shrink-0 text-left">{percent}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Write a Review Button */}
                  <button
                    onClick={() => toast.info("Review creation is managed by course administration.")}
                    className="w-full border border-brand text-brand bg-transparent hover:bg-brand/5 active:scale-[0.99] font-bold py-3 rounded-xl text-xs transition-all text-center block cursor-pointer select-none"
                  >
                    Write a Review
                  </button>

                  {/* Review Cards list */}
                  <div className="space-y-4">
                    {reviews.map((rev, i) => (
                      <div key={i} className="bg-[#16161c] border border-[#2a2a35]/60 p-5 rounded-2xl space-y-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9 border border-brand/30">
                              {rev.reviewerAvatar ? (
                                <AvatarImage src={rev.reviewerAvatar} />
                              ) : null}
                              <AvatarFallback className="bg-[#1a1a22] text-brand font-bold text-xs uppercase border border-brand/30">
                                {rev.reviewerName?.substring(0, 2) || "ST"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white leading-tight truncate">
                                {rev.reviewerName || "Learner"}
                              </h4>
                              {rev.reviewerRole && (
                                <p className="text-[10px] text-[#9fa0b8] font-medium leading-none mt-0.5 truncate">
                                  {rev.reviewerRole}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {renderStars(rev.rating, "w-3 h-3")}
                            {rev.createdAt && (
                              <span className="text-[9px] text-[#6b6b7b] font-semibold block mt-1">
                                {new Date(rev.createdAt).toLocaleDateString([], {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-[#c7c7da] leading-relaxed">
                          {rev.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column (Sidebar Pricing Card Widget) */}
            <div className="w-full lg:w-[360px] bg-[#16161c] border border-[#2a2a35]/60 rounded-2xl overflow-hidden sticky top-6 flex-shrink-0 shadow-2xl flex flex-col">
              
              <div className="p-6 space-y-6 flex-1">
                {/* Pricing Display Row */}
                <div className="flex items-center justify-between">
                  {course.isFree ? (
                    <div className="text-2xl font-black text-white font-inter leading-none">Free to join</div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <div className="space-y-1.5 flex flex-col">
                        <span className="text-2xl font-black text-brand font-inter leading-none">
                          {course.currency === "INR" ? "₹" : "$"}{formatPrice(course.price)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enroll/Buy Action Button */}
                {enrollment ? (
                  <button
                    onClick={() => {
                      setActiveSection("enrolled");
                      // Auto-select the next chapter to watch when resuming
                      if (course.sections && course.sections.length > 0 && !selectedChapter) {
                        // Build a flat ordered list of all chapters
                        const allChapters = course.sections.flatMap((s) =>
                          (s.chapters || []).map((c) => ({
                            sectionId: s._id,
                            chapterId: c._id,
                          }))
                        );

                        // Helper: check if a chapterId is completed
                        const isCompleted = (chapterId: string) =>
                          enrollment.chaptersProgress?.some(
                            (p) => p.chapterId === chapterId && p.completed
                          ) || false;

                        const targetSectionId = enrollment.lastSectionId;
                        const targetChapterId = enrollment.lastChapterId;

                        let hasLastAccessed = false;
                        if (targetSectionId && targetChapterId) {
                          const section = course.sections.find((s) => s._id === targetSectionId);
                          if (section && section.chapters) {
                            const chapter = section.chapters.find((c) => c._id === targetChapterId);
                            if (chapter) hasLastAccessed = true;
                          }
                        }

                        if (hasLastAccessed && targetSectionId && targetChapterId) {
                          // If the last-accessed chapter is already completed,
                          // find the first incomplete chapter that comes after it.
                          if (isCompleted(targetChapterId)) {
                            const lastIdx = allChapters.findIndex(
                              (c) => c.chapterId === targetChapterId
                            );
                            // Look for the first incomplete chapter after the last accessed one
                            const nextIncomplete = allChapters
                              .slice(lastIdx + 1)
                              .find((c) => !isCompleted(c.chapterId));

                            if (nextIncomplete) {
                              setSelectedChapter(nextIncomplete);
                            } else {
                              // All chapters after it are also complete — fallback to last accessed
                              setSelectedChapter({
                                sectionId: targetSectionId,
                                chapterId: targetChapterId,
                              });
                            }
                          } else {
                            // Chapter is not completed — resume it directly
                            setSelectedChapter({
                              sectionId: targetSectionId,
                              chapterId: targetChapterId,
                            });
                          }
                        } else if (course.sections[0].chapters && course.sections[0].chapters.length > 0) {
                          // No last-accessed chapter — start from the beginning
                          const firstIncomplete = allChapters.find((c) => !isCompleted(c.chapterId));
                          if (firstIncomplete) {
                            setSelectedChapter(firstIncomplete);
                          } else {
                            setSelectedChapter({
                              sectionId: course.sections[0]._id,
                              chapterId: course.sections[0].chapters[0]._id,
                            });
                          }
                        }
                      }
                    }}
                    className="w-full bg-brand hover:opacity-90 active:scale-[0.98] text-brand-foreground font-bold py-3.5 rounded-xl text-xs transition-all shadow-lg shadow-brand/10 hover:shadow-brand/20 cursor-pointer text-center block border-none font-inter select-none uppercase tracking-wide"
                  >
                    Resume Course
                  </button>
                ) : (
                  <div className="space-y-3">
                    {/* Buy-to-assign toggle — mirrors ProductsPage:3760 shape */}
                    {canReserve && (
                      <div className="rounded-xl border border-[#2a2a35] bg-[#1a1a22]/30 p-3.5 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white leading-none">Buy to assign</p>
                            <p className="text-[9px] text-[#8888a0] mt-1 leading-normal">Purchase seats as reserves to assign later.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBuyToAssign((v) => !v)}
                            className="relative shrink-0 rounded-full transition-colors duration-200 cursor-pointer"
                            style={{ width: "44px", height: "24px", backgroundColor: buyToAssign ? "var(--brand)" : "#2a2a35" }}
                            aria-pressed={buyToAssign}
                          >
                            <span
                              className="absolute rounded-full bg-white transition-transform duration-200"
                              style={{ top: "2px", left: "2px", width: "20px", height: "20px", transform: buyToAssign ? "translateX(20px)" : "translateX(0px)" }}
                            />
                          </button>
                        </div>
                        {buyToAssign && (
                          <div className="flex items-center justify-between border-t border-[#2a2a35]/30 pt-3">
                            <span className="text-[10px] font-bold text-[#8888a0] uppercase tracking-wider">Quantity</span>
                            <div className="flex items-center gap-2 bg-[#0e0e12] rounded-lg border border-[#2a2a35] p-1 select-none">
                              <button type="button" onClick={() => setReserveQty((q) => Math.max(1, q - 1))}
                                className="h-6 w-6 rounded flex items-center justify-center text-white hover:bg-[#1a1a22] transition-colors text-xs cursor-pointer font-bold">−</button>
                              <span className="w-8 text-center text-xs font-bold text-white tabular-nums">{reserveQty}</span>
                              <button type="button" onClick={() => setReserveQty((q) => Math.min(99, q + 1))}
                                className="h-6 w-6 rounded flex items-center justify-center text-white hover:bg-[#1a1a22] transition-colors text-xs cursor-pointer font-bold">+</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {isActualFounder && !course.isFree && !buyToAssign && (
                      <div 
                        className="text-[11px] font-medium text-brand bg-brand/10 border border-brand/20 px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-help"
                        title="This course requires payment for customers, but organization founders can enroll for free."
                      >
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>Founder Access: Free for you</span>
                      </div>
                    )}
                    <button
                      onClick={() =>
                        onAction?.(
                          buyToAssign
                            ? { quantity: Math.max(1, reserveQty), forReserve: true }
                            : undefined,
                        )
                      }
                      title={isActualFounder && !course.isFree && !buyToAssign ? "Founder Access: You can enroll in this paid course for free." : undefined}
                      className="w-full bg-brand hover:opacity-90 active:scale-[0.98] text-brand-foreground font-bold py-3.5 rounded-xl text-xs transition-all shadow-lg shadow-brand/10 hover:shadow-brand/20 cursor-pointer text-center block border-none font-inter select-none uppercase tracking-wide"
                    >
                      {buyToAssign ? `Buy ${reserveQty} to assign` : (isActualFounder && !course.isFree ? "Enroll Free (Founder Access)" : "Enroll Now")}
                    </button>
                  </div>
                )}

                {/* Features bullet list */}
                <div className="space-y-3.5 text-xs text-[#c7c7da]">
                  {totalDurationSeconds > 0 && (
                    <div className="flex items-center gap-2.5">
                      <Monitor className="w-4 h-4 text-[#8888a0] shrink-0" />
                      <span>{Math.round(totalDurationSeconds / 3600)} hours video</span>
                    </div>
                  )}
                  {resourceCount > 0 && (
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-[#8888a0] shrink-0" />
                      <span>{resourceCount} {resourceCount === 1 ? "resource" : "resources"}</span>
                    </div>
                  )}
                  {course.courseIncludes?.map((inc, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      {inc.icon ? (
                        <img src={inc.icon} alt="" className="w-4 h-4 object-contain shrink-0" />
                      ) : (
                        <Check className="w-4 h-4 text-[#8888a0] shrink-0" />
                      )}
                      <span>{inc.text}</span>
                    </div>
                  ))}
                </div>


                {/* Affiliate Share Row */}
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] text-[#6b6b7b] uppercase font-bold tracking-wider block">Share this course:</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                        detail: {
                          type: "affiliate",
                          course: course,
                          itemType: "course",
                          affiliateId: affiliateId
                        }
                      }));
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-white/10 hover:border-brand/60 hover:bg-brand/5 bg-transparent text-xs text-white rounded-lg transition-all cursor-pointer select-none font-medium leading-none h-11"
                    title="Copy affiliate link"
                  >
                    <Link2 className="w-3.5 h-3.5 text-[#8888a0]" />
                    <span>Affiliate Link</span>
                  </button>
                </div>
              </div>

              {/* Bottom Yellow/Grey Earning Commission Banner (Stretches full width) */}
              <div onClick={(e) => e.stopPropagation()} className="w-full mt-auto">
                {detailPlan ? (
                  <div
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("right-panel:open-information", {
                        detail: {
                          type: "commission",
                          course: course,
                          itemType: "course",
                          affiliateId: affiliateId
                        }
                      }));
                    }}
                    className="bg-brand hover:opacity-90 text-brand-foreground text-[10px] font-bold py-3.5 text-center w-full transition-all cursor-pointer select-none uppercase tracking-wider font-inter border-none"
                    title="Click to see earning details"
                  >
                    Find out how much you can Earn
                  </div>
                ) : (
                  <div className="bg-[#1a1a22] text-[#8888a0]/80 text-[10px] font-bold py-3.5 text-center w-full select-none cursor-default font-inter border-none uppercase tracking-wider">
                    No commissions paid
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isPdfFullScreen && currentChapter && currentChapter.contentType === "pdf" && (() => {
        const pdfsList = (currentChapter as any).pdfs && (currentChapter as any).pdfs.length > 0 
          ? (currentChapter as any).pdfs 
          : (currentChapter.pdfUrl ? [{ name: "PDF Document", url: currentChapter.pdfUrl, s3Key: currentChapter.pdfS3Key }] : []);
        
        const activePdf = pdfsList[activePdfIndex] || pdfsList[0];
        if (!activePdf) return null;

        return (
          <div className="fixed inset-0 z-50 bg-[#0b0b0d] flex flex-col w-screen h-screen">
            <div className="flex items-center justify-between bg-[#0e0e12] border-b border-[#2a2a35] px-4 py-2.5 flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-red-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate max-w-xl leading-tight">
                    {pdfsList.length > 1 ? `${currentChapter.title} - ${activePdf.name}` : currentChapter.title}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={activePdf.url}
                  download={activePdf.name || currentChapter.title}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-brand hover:opacity-90 text-brand-foreground text-[11px] font-bold shadow-lg shadow-brand/10 transition-colors"
                >
                  <FileDown className="w-3 h-3" />
                  Download
                </a>
                <button
                  onClick={() => setIsPdfFullScreen(false)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:bg-white/5 text-[11px] font-semibold transition-colors"
                >
                  <Minimize2 className="w-3 h-3" />
                  Exit Full Screen
                </button>
              </div>
            </div>

            <div className="flex-1 bg-black overflow-hidden relative">
              <iframe
                src={`${activePdf.url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                className="w-full h-full border-0 block"
                title={activePdf.name || currentChapter.title}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
