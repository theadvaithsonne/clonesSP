"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  X,
  Tag,
  Lock,
  Video,
  FileText,
  Play,
  Volume2,
  VolumeX,
  Youtube,
  MoreHorizontal,
  Pencil,
  Trash2,
  Maximize,
  Minimize,
  Pause,
  Repeat2,
  Bookmark,
  ExternalLink,
  Loader2,
  Check,
  Trash,
  Clock,
  Pin,
  Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import CustomVideoPlayer from "./CustomVideoPlayer";
import { cn } from "@/lib/utils";
import { sanitizeDescription } from "@/lib/sanitizeDescription";
import {
  getComments,
  addComment,
  deleteComment,
  updateComment,
  toggleCommentReaction,
  toggleReaction,
  type Comment,
  type QuotedPost,
  type PostAuthor,
  type PostChannel,
  type Poll,
  type ReactionType,
  type ReactionsCount,
  REACTION_EMOJIS,
  deletePost,
} from "@/lib/feed-api";
import { ReactionPicker } from "@/components/feed/ReactionPicker";
import { ReactionDisplay } from "@/components/feed/ReactionDisplay";
import { ReactionsModal } from "@/components/feed/ReactionsModal";
import { LinkPreview } from "@/components/ui/link-preview";
import { RepostMenu } from "@/components/feed/RepostMenu";
import { QuotedPostPreview } from "@/components/feed/QuotedPostPreview";
import { PollDisplay } from "@/components/feed/PollDisplay";
import { VoiceMessagePlayer } from "@/components/ui/voice-message-player";
import {
  CommentInput,
  CommentAttachment,
} from "@/components/feed/CommentInput";
import { getPostShareLink } from "@/lib/feed-api";
import { toast } from "sonner";
import {
  CommentThread,
  groupCommentsIntoThreads,
} from "@/components/feed/CommentThread";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";

// URL regex for detecting links in post content
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

// Extract first URL from text for link preview
const extractFirstUrl = (text: string): string | null => {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
};

// Clean a URL that may have HTML tags leaked into it
const cleanUrl = (url: string): string => {
  let clean = url.replace(/<[^>]*>/g, "");
  clean = clean.replace(/[>"']+$/, "");
  const urlMatch = clean.match(/^(https?:\/\/[^\s"'<>]+)/i);
  return urlMatch ? urlMatch[1] : clean.trim();
};

// Link preview data stored with post
interface StoredLinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string | null;
  siteName?: string;
  showThumbnail?: boolean;
}

// Local Post type for the component (different from feed-api Post)
export interface Post {
  _id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  authorAvatar?: string | null;
  channelIds: { _id: string; title: string }[];
  tags?: string[];
  attachments?: {
    type: "image" | "video" | "document" | "audio";
    url: string;
    name: string;
  }[];
  // Link preview metadata
  linkPreviews?: StoredLinkPreview[];
  likes: number;
  likesCount?: number;
  hasLiked?: boolean;
  // Reactions support
  reactionsCount?: ReactionsCount;
  userReaction?: ReactionType | null;
  comments: number;
  commentsCount?: number;
  reposts?: number;
  repostsCount?: number;
  hasReposted?: boolean;
  bookmarks?: number;
  bookmarksCount?: number;
  hasBookmarked?: boolean;
  shares: number;
  createdAt: Date;
  updatedAt: Date;
  // Quote post support
  quotedPostId?: string | QuotedPost;
  // Poll support
  hasPoll?: boolean;
  poll?: Poll;
  // Article support
  postType?: 'post' | 'article';
  title?: string;
  coverImage?: string;
  slug?: string;
  readingTimeMinutes?: number;
  // Pin support
  isPinned?: boolean;
}

// Create Post Component
export function CreatePostCard({
  channels,
  selectedChannelId,
  onCreatePost,
}: {
  channels: Array<{ _id: string; title: string }>;
  selectedChannelId: string | null;
  onCreatePost: (data: {
    content: string;
    channelIds: string[];
    tags: string[];
  }) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(
    selectedChannelId ? [selectedChannelId] : [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    if (!content.trim() || selectedChannels.length === 0) return;

    setIsSubmitting(true);
    try {
      await onCreatePost({
        content: content.trim(),
        channelIds: selectedChannels,
        tags,
      });
      setContent("");
      setTags([]);
      setSelectedChannels(selectedChannelId ? [selectedChannelId] : []);
    } catch (error) {
      console.error("Failed to create post:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-6 mb-4">
      <Textarea
        placeholder="What's on your mind?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="bg-transparent border-[#2a2a35] text-white placeholder:text-[#9fa0b8] resize-none min-h-[100px] mb-4"
      />

      {/* Tag Input */}
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <Input
            placeholder="Add tags..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
            className="bg-transparent border-[#2a2a35] text-white placeholder:text-[#9fa0b8] flex-1"
          />
          <Button
            size="sm"
            onClick={handleAddTag}
            className="bg-[#1a1a22] hover:bg-[#2a2a35] text-white"
          >
            <Tag className="h-4 w-4" />
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#1a1a22] text-brand text-sm"
              >
                #{tag}
                <button onClick={() => handleRemoveTag(tag)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Channel Selection */}
      <div className="mb-4">
        <p className="text-sm text-[#9fa0b8] mb-2">Post to channels:</p>
        <div className="flex flex-wrap gap-2">
          {channels.map((channel) => (
            <button
              key={channel._id}
              onClick={() => {
                if (selectedChannels.includes(channel._id)) {
                  setSelectedChannels(
                    selectedChannels.filter((id) => id !== channel._id),
                  );
                } else {
                  setSelectedChannels([...selectedChannels, channel._id]);
                }
              }}
              className={cn(
                "px-3 py-1 rounded-full text-sm transition-colors",
                selectedChannels.includes(channel._id)
                  ? "bg-brand text-brand-foreground"
                  : "bg-[#1a1a22] text-[#9fa0b8] hover:bg-[#2a2a35]",
              )}
            >
              {channel.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={
            isSubmitting || !content.trim() || selectedChannels.length === 0
          }
          className="bg-brand hover:opacity-90 text-brand-foreground"
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Post
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Helper function to extract YouTube video ID
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

// YouTube Player Component
function YouTubePlayer({ url }: { url: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoId = getYoutubeVideoId(url);

  if (!videoId) return null;

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => {
          setIsFullscreen(false);
        })
        .catch(() => {});
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  if (isPlaying) {
    return (
      <div
        ref={containerRef}
        className="relative w-full rounded-none overflow-hidden bg-black aspect-video group"
      >
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="w-full h-full"
        />
        {/* Fullscreen button */}
        <button
          onClick={toggleFullscreen}
          className="absolute bottom-3 right-3 p-2 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          {isFullscreen ? (
            <Minimize className="w-5 h-5" />
          ) : (
            <Maximize className="w-5 h-5" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-none overflow-hidden bg-black cursor-pointer group"
      onClick={() => setIsPlaying(true)}
    >
      <img
        src={thumbnailUrl}
        alt="YouTube video thumbnail"
        className="w-full max-h-[500px] object-cover"
        onError={(e) => {
          // Fallback to medium quality if maxresdefault doesn't exist
          (e.target as HTMLImageElement).src =
            `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
        <div className="w-20 h-14 bg-red-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
          <Play className="w-8 h-8 text-white ml-1" fill="white" />
        </div>
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/70 rounded-lg">
        <Youtube className="w-4 h-4 text-red-500" />
        <span className="text-white text-sm">YouTube</span>
      </div>
      {/* Fullscreen button on thumbnail */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsPlaying(true);
          // Small delay to let iframe render before fullscreen
          setTimeout(() => {
            containerRef.current?.requestFullscreen().catch(() => {});
          }, 100);
        }}
        className="absolute bottom-3 right-3 p-2 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Maximize className="w-5 h-5" />
      </button>
    </div>
  );
}

// Video Player Component
function VideoPlayer({ url, name }: { url: string; name: string }) {
  // Check if it's a YouTube URL
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return <YouTubePlayer url={url} />;
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black min-h-[260px] aspect-video">
      <CustomVideoPlayer
        src={url}
        autoPlay={false}
        className="w-full h-full"
      />
    </div>
  );
}

// ─── Skeleton Image ────────────────────────────────────────────────────────
// Wraps an <img> and shows an animated shimmer until the image loads, then
// cross-fades the real image in.  The container always occupies space so there
// is no layout shift.
function SkeletonImage({
  src,
  alt,
  className,
  style,
  onClick,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div
      className="relative max-w-full w-full h-full"
      style={style}
      onClick={onClick}
    >
      {/* Shimmer skeleton — visible until image loads */}
      {!loaded && !errored && (
        <div
          className="absolute inset-0 bg-[#1a1a22] overflow-hidden"
          aria-hidden
        >
          <div
            className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)",
            }}
          />
        </div>
      )}
      {/* Actual image — renders invisible until loaded, then fades in */}
      <img
        src={src}
        alt={alt}
        className={cn(
          className,
          "transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
        onError={() => { setLoaded(true); setErrored(true); }}
      />
    </div>
  );
}

// Image Grid Component - Twitter-like layout
export function ImageGrid({
  images,
  onImageClick,
}: {
  images: { url: string; name: string }[];
  onImageClick?: (index: number) => void;
}) {
  const count = images.length;

  if (count === 0) return null;

  if (count === 1) {
    return (
      <div className="w-full px-4 flex justify-start">
        <div
          className={cn(
            "relative max-w-full overflow-hidden rounded-xl border border-[#2a2a35]",
            onImageClick && "cursor-pointer"
          )}
        >
          <SkeletonImage
            src={images[0].url}
            alt={images[0].name}
            className={cn(
              "w-auto max-w-full h-auto max-h-[480px] object-contain block",
              onImageClick && "hover:opacity-90"
            )}
            style={{ minHeight: 180 }}
            onClick={onImageClick ? () => onImageClick(0) : undefined}
          />
        </div>
      </div>
    );
  }

  // Common container class for grid of images to keep consistency
  const gridContainerClass = cn(
    "w-full overflow-hidden rounded-none border border-[#2a2a35]",
    onImageClick && "cursor-pointer"
  );

  if (count === 2) {
    return (
      <div className={gridContainerClass}>
        <div className="grid grid-cols-2 gap-[2px]">
          {images.map((img, idx) => (
            <div
              key={idx}
              className="aspect-square overflow-hidden"
            >
              <SkeletonImage
                src={img.url}
                alt={img.name}
                className="w-full h-full object-cover hover:opacity-90"
                onClick={onImageClick ? () => onImageClick(idx) : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className={gridContainerClass}>
        <div className="grid grid-cols-2 gap-[2px]" style={{ height: 360 }}>
          <div className="row-span-2 overflow-hidden">
            <SkeletonImage
              src={images[0].url}
              alt={images[0].name}
              className="w-full h-full object-cover hover:opacity-90"
              onClick={onImageClick ? () => onImageClick(0) : undefined}
            />
          </div>
          {images.slice(1).map((img, idx) => (
            <div
              key={idx}
              className="overflow-hidden"
              style={{ height: 178 }}
            >
              <SkeletonImage
                src={img.url}
                alt={img.name}
                className="w-full h-full object-cover hover:opacity-90"
                onClick={onImageClick ? () => onImageClick(idx + 1) : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4+ images
  return (
    <div className={gridContainerClass}>
      <div className="grid grid-cols-2 gap-[2px]">
        {images.slice(0, 4).map((img, idx) => (
          <div
            key={idx}
            className="aspect-square relative overflow-hidden"
          >
            <SkeletonImage
              src={img.url}
              alt={img.name}
              className="w-full h-full object-cover hover:opacity-90"
              onClick={onImageClick ? () => onImageClick(idx) : undefined}
            />
            {idx === 3 && count > 4 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                <span className="text-white text-2xl font-semibold">
                  +{count - 4}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper function to format relative time (like X.com)
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  // For older posts, just show the date
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Helper function to format full date with time
function formatPostDateTime(date: Date): string {
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${time} · ${dateStr}`;
}

// Helper function to render content with highlighted mentions, hashtags, and URLs
function renderPostContent(
  content: string,
  onTagClick?: (tag: string) => void,
  onMentionClick?: (mention: string) => void,
) {
  // Helper to render inline formatting (mentions, hashtags, URLs) within a text segment
  const renderInline = (text: string, keyPrefix: string) => {
    const parts = text.split(/(@\w+|#\w+|https?:\/\/[^\s]+)/gi);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const mention = part.slice(1);
        return (
          <span
            key={`${keyPrefix}-${i}`}
            className="text-brand hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onMentionClick?.(mention);
            }}
          >
            {part}
          </span>
        );
      }
      if (part.startsWith("#")) {
        const tag = part.slice(1);
        return (
          <span
            key={`${keyPrefix}-${i}`}
            className="text-brand hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onTagClick?.(tag);
            }}
          >
            {part}
          </span>
        );
      }
      if (part.match(/^https?:\/\//i)) {
        return null;
      }
      return <span key={`${keyPrefix}-${i}`}>{part}</span>;
    });
  };

  // Collapse runs of 3+ consecutive blank lines to a maximum of 2
  const normalizedContent = content.replace(/(\n\s*){3,}/g, '\n\n');

  // Split content into lines and process headings
  const lines = normalizedContent.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check for markdown headings (# H1, ## H2, ### H3)
    const h3Match = line.match(/^###\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h1Match = line.match(/^#\s+(.+)/);

    if (h3Match) {
      elements.push(
        <h3 key={`line-${i}`} className="text-base font-bold text-white mt-4 mb-1">
          {renderInline(h3Match[1], `h3-${i}`)}
        </h3>
      );
    } else if (h2Match) {
      elements.push(
        <h2 key={`line-${i}`} className="text-lg font-bold text-white mt-5 mb-1.5">
          {renderInline(h2Match[1], `h2-${i}`)}
        </h2>
      );
    } else if (h1Match) {
      elements.push(
        <h1 key={`line-${i}`} className="text-xl font-bold text-white mt-6 mb-2">
          {renderInline(h1Match[1], `h1-${i}`)}
        </h1>
      );
    } else if (line.trim() === '') {
      // Empty line = paragraph break
      elements.push(<br key={`br-${i}`} />);
    } else {
      // Regular text line
      elements.push(
        <span key={`line-${i}`}>
          {renderInline(line, `line-${i}`)}
          {'\n'}
        </span>
      );
    }
    i++;
  }

  return elements;
}


// Expandable post content with Show More / Show Less for long posts
const FEED_COLLAPSE_LIMIT = 500;

function ExpandablePostContent({
  content,
  onTagClick,
  onMentionClick,
}: {
  content: string;
  onTagClick?: (tag: string) => void;
  onMentionClick?: (mention: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isLong = content.length > FEED_COLLAPSE_LIMIT;
  const displayContent =
    isLong && !expanded ? content.slice(0, FEED_COLLAPSE_LIMIT) : content;

  return (
    <div className="text-white whitespace-pre-wrap text-[15px] leading-relaxed">
      {renderPostContent(displayContent, onTagClick, onMentionClick)}
      {isLong && !expanded && (
        <span className="text-[#6E767D]">…</span>
      )}
      {isLong && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="block mt-1 text-brand hover:text-brand/80 text-[13px] font-semibold transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

// Post Card Component
export function PostCard({
  post,
  onLike,
  onReact,
  onComment,
  onRepost,
  onQuote,
  onBookmark,
  onPin,
  onUnpin,
  onClick,
  onImageClick,
  onEdit,
  onDelete,
  onTagClick,
  onMentionClick,
  currentUserId,
  currentUserEmail,
  currentUserName,
  currentUserAvatar,
  newComment,
  orgId,
  isHighlighted,
}: {
  post: Post;
  onLike: (postId: string) => void;
  onReact?: (
    postId: string,
    reactionType: ReactionType,
    result: {
      reacted: boolean;
      reactionType: ReactionType | null;
      reactionsCount: ReactionsCount;
    },
  ) => void;
  onComment: (
    postId: string,
    content: string,
    attachments?: CommentAttachment[],
    parentCommentId?: string,
  ) => void;
  onRepost?: (postId: string) => void;
  onQuote?: (postId: string) => void;
  onBookmark?: (postId: string) => void;
  onPin?: (postId: string) => void;
  onUnpin?: (postId: string) => void;
  onClick?: (postId: string) => void;
  onImageClick?: (post: Post, imageIndex: number) => void;
  onEdit?: (post: Post) => void;
  onDelete?: (postId: string) => void;
  onTagClick?: (tag: string) => void;
  onMentionClick?: (mention: string) => void;
  currentUserId?: string;
  currentUserEmail?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  newComment?: Comment; // Real-time comment received via socket
  orgId?: string | null;
  isHighlighted?: boolean; // Highlight post from notification click
}) {
  const { amIFounder } = useAmIFounder();
  const [showComments, setShowComments] = useState(false);
  const [isLiked, setIsLiked] = useState(post.hasLiked || false);
  const [likeCount, setLikeCount] = useState(post.likesCount || 0);
  // Reactions state
  const [userReaction, setUserReaction] = useState<ReactionType | null>(
    post.userReaction || null,
  );
  const [reactionsCount, setReactionsCount] = useState<
    ReactionsCount | undefined
  >(post.reactionsCount);
  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "loading" | "copied">(
    "idle",
  );
  const [isReposted, setIsReposted] = useState(post.hasReposted || false);
  const [repostCount, setRepostCount] = useState(post.repostsCount || 0);
  const [isBookmarked, setIsBookmarked] = useState(post.hasBookmarked || false);
  const [bookmarkCount, setBookmarkCount] = useState(post.bookmarksCount || 0);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [postComments, setPostComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check if current user owns this post
  const isOwnPost = currentUserId
    ? post.authorId === currentUserId
    : currentUserEmail
      ? post.authorEmail?.toLowerCase() === currentUserEmail.toLowerCase() ||
        post.authorName
          ?.toLowerCase()
          .includes(currentUserEmail.split("@")[0].toLowerCase())
      : false;

  // Helper to detect audio files by URL extension or name (for backward compatibility with old posts stored as 'document')
  const isAudioFile = (att: { url: string; name: string }) => {
    const audioExtensions = [
      ".webm",
      ".mp3",
      ".wav",
      ".ogg",
      ".m4a",
      ".aac",
      ".flac",
    ];
    const url = att.url.toLowerCase();
    const name = att.name.toLowerCase();
    return (
      audioExtensions.some((ext) => url.includes(ext)) ||
      name.startsWith("voice_note") ||
      name === "voice note"
    );
  };

  // Helper to detect image files by URL extension or name (for backward compatibility with old posts)
  const isImageFile = (att: { type?: string; url?: string; name?: string }) => {
    if (att.type === "image" || att.type === "photo") return true;
    const imageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".svg",
      ".avif",
      ".heic",
      ".bmp",
    ];
    const url = (att.url || "").toLowerCase();
    const name = (att.name || "").toLowerCase();
    return imageExtensions.some((ext) => url.includes(ext) || name.includes(ext));
  };

  // Separate attachments by type (supporting both new posts and legacy posts)
  const attachmentImages =
    post.attachments?.filter(
      (att) =>
        att.type === "image" ||
        att.type === "photo" ||
        ((!att.type || att.type === "document" || att.type === "file") &&
          isImageFile(att)),
    ) || [];

  // Extract legacy images array, single imageUrl, or media array if present on older post schemas
  const legacyImages: { type: "image"; url: string; name: string }[] = [];
  const rawPost = post as any;
  if (Array.isArray(rawPost.images)) {
    rawPost.images.forEach((img: any, idx: number) => {
      const url = typeof img === "string" ? img : img?.url;
      const name = (typeof img === "object" && img?.name) || `Image ${idx + 1}`;
      if (url && !attachmentImages.some((a) => a.url === url)) {
        legacyImages.push({ type: "image", url, name });
      }
    });
  }
  if (typeof rawPost.imageUrl === "string" && rawPost.imageUrl) {
    if (
      !attachmentImages.some((a) => a.url === rawPost.imageUrl) &&
      !legacyImages.some((a) => a.url === rawPost.imageUrl)
    ) {
      legacyImages.push({ type: "image", url: rawPost.imageUrl, name: "Image 1" });
    }
  }
  if (Array.isArray(rawPost.media)) {
    rawPost.media.forEach((item: any, idx: number) => {
      const mediaUrl = typeof item === "string" ? item : item?.url;
      const mediaType = typeof item === "object" ? item?.type : undefined;
      if (
        mediaUrl &&
        (mediaType === "image" || isImageFile({ url: mediaUrl }))
      ) {
        if (
          !attachmentImages.some((a) => a.url === mediaUrl) &&
          !legacyImages.some((a) => a.url === mediaUrl)
        ) {
          legacyImages.push({
            type: "image",
            url: mediaUrl,
            name: (typeof item === "object" && item?.name) || `Image ${idx + 1}`,
          });
        }
      }
    });
  }

  const images = [...attachmentImages, ...legacyImages];

  const videos = post.attachments?.filter((att) => att.type === "video") || [];
  // Audio files: native 'audio' type (new posts) OR 'document' type with audio extension (old posts)
  const audioFiles =
    post.attachments?.filter(
      (att) =>
        att.type === "audio" || (att.type === "document" && isAudioFile(att)),
    ) || [];
  // Documents: only actual documents, not audio or image files stored as 'document'
  const documents =
    post.attachments?.filter(
      (att) =>
        att.type === "document" &&
        !isAudioFile(att) &&
        !isImageFile(att),
    ) || [];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch comments function
  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const data = await getComments(post._id);
      console.log("Fetched comments for post", post._id, ":", data);
      setPostComments(data.comments || []);
    } catch (error) {
      console.error("Failed to fetch comments for post", post._id, ":", error);
    } finally {
      setLoadingComments(false);
    }
  }, [post._id]);

  // Fetch comments when comments section is opened
  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments, fetchComments]);

  // Handle real-time new comment
  useEffect(() => {
    if (newComment && showComments) {
      setPostComments((prev) => {
        // Avoid duplicates
        if (prev.some((c) => c._id === newComment._id)) return prev;
        setCommentsCount((prevCount) => prevCount + 1);
        return [...prev, newComment];
      });
    }
  }, [newComment, showComments]);

  // Sync state from props when post changes
  useEffect(() => {
    setIsLiked(post.hasLiked || false);
    setLikeCount(post.likesCount || 0);
    setUserReaction(post.userReaction || null);
    setReactionsCount(post.reactionsCount);
    setIsReposted(post.hasReposted || false);
    setRepostCount(post.repostsCount || 0);
    setIsBookmarked(post.hasBookmarked || false);
    setBookmarkCount(post.bookmarksCount || 0);
    setCommentsCount(post.commentsCount || 0);
  }, [
    post.hasLiked,
    post.likesCount,
    post.userReaction,
    post.reactionsCount,
    post.hasReposted,
    post.repostsCount,
    post.hasBookmarked,
    post.bookmarksCount,
    post.commentsCount,
  ]);

  const handleLike = () => {
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount((prev) => (newIsLiked ? prev + 1 : Math.max(prev - 1, 0)));
    onLike(post._id);
  };

  const handleDelete = useCallback(
    async (postId: string) => {
      if (!orgId) return;
      try {
        const result = await deletePost(postId, orgId);
      } catch (error) {
        console.error("Failed to toggle like:", error);
      }
    },
    [orgId],
  );
  // Handle reaction (new reactions system)
  const handleReaction = async (reactionType: ReactionType) => {
    if (!orgId) {
      // Fallback to old like system if no orgId
      handleLike();
      return;
    }

    // Optimistic update
    const wasReacted = userReaction !== null;
    const wasSameReaction = userReaction === reactionType;

    if (wasSameReaction) {
      // Removing reaction
      setUserReaction(null);
      setReactionsCount((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [reactionType]: Math.max(prev[reactionType] - 1, 0),
          total: Math.max(prev.total - 1, 0),
        };
      });
    } else if (wasReacted && userReaction) {
      // Changing reaction
      const oldReaction = userReaction;
      setUserReaction(reactionType);
      setReactionsCount((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [oldReaction]: Math.max(prev[oldReaction] - 1, 0),
          [reactionType]: prev[reactionType] + 1,
        };
      });
    } else {
      // Adding new reaction
      setUserReaction(reactionType);
      setReactionsCount((prev) => {
        if (!prev) {
          return {
            like: reactionType === "like" ? 1 : 0,
            love: reactionType === "love" ? 1 : 0,
            fire: reactionType === "fire" ? 1 : 0,
            haha: reactionType === "haha" ? 1 : 0,
            wow: reactionType === "wow" ? 1 : 0,
            sad: reactionType === "sad" ? 1 : 0,
            angry: reactionType === "angry" ? 1 : 0,
            total: 1,
          };
        }
        return {
          ...prev,
          [reactionType]: prev[reactionType] + 1,
          total: prev.total + 1,
        };
      });
    }

    try {
      const result = await toggleReaction(post._id, orgId, reactionType);
      // Update with server response
      setUserReaction(result.reactionType);
      setReactionsCount(result.reactionsCount);
      // Notify parent
      if (onReact) {
        onReact(post._id, reactionType, result);
      }
    } catch (error) {
      console.error("Failed to toggle reaction:", error);
      // Revert optimistic update on error
      setUserReaction(post.userReaction || null);
      setReactionsCount(post.reactionsCount);
    }
  };

  const handleRepost = () => {
    if (!onRepost) return;
    // Toggle repost state
    const newIsReposted = !isReposted;
    setIsReposted(newIsReposted);
    setRepostCount((prev) =>
      newIsReposted ? prev + 1 : Math.max(prev - 1, 0),
    );
    onRepost(post._id);
  };

  const handleUndoRepost = () => {
    if (!onRepost || !isReposted) return;
    setIsReposted(false);
    setRepostCount((prev) => Math.max(prev - 1, 0));
    onRepost(post._id);
  };

  const handleQuote = () => {
    if (onQuote) {
      onQuote(post._id);
    }
  };

  const handleBookmark = () => {
    if (!onBookmark) return;
    const newIsBookmarked = !isBookmarked;
    setIsBookmarked(newIsBookmarked);
    setBookmarkCount((prev) =>
      newIsBookmarked ? prev + 1 : Math.max(prev - 1, 0),
    );
    onBookmark(post._id);
  };

  const handleComment = async (
    content: string,
    attachments: CommentAttachment[],
  ) => {
    if (content.trim() || attachments.length > 0) {
      onComment(post._id, content.trim(), attachments);
      // Refresh comments after adding a new one
      setTimeout(() => fetchComments(), 500);
      setCommentsCount((prev) => prev + 1);
    }
  };

  const handleReply = async (
    parentCommentId: string,
    content: string,
    attachments: CommentAttachment[],
  ) => {
    if (content.trim() || attachments.length > 0) {
      onComment(post._id, content.trim(), attachments, parentCommentId);
      // Refresh comments after adding a reply
      setTimeout(() => fetchComments(), 500);
      setCommentsCount((prev) => prev + 1);
    }
  };

  const handleEditComment = async (commentId: string, newContent: string) => {
    if (!orgId) return;
    try {
      const result = await updateComment(commentId, orgId, newContent);
      if (result.success && result.comment) {
        setPostComments((prev) =>
          prev.map((c) => (c._id === commentId ? result.comment : c))
        );
        toast.success("Comment updated!");
      }
    } catch (err) {
      console.error("Failed to edit comment", err);
      toast.error("Failed to update comment");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!orgId) return;
    try {
      const result = await deleteComment(commentId, orgId);
      if (result.success) {
        setPostComments((prev) => prev.filter((c) => c._id !== commentId));
        setCommentsCount((prev) => Math.max(0, prev - 1));
        toast.success("Comment deleted!");
      }
    } catch (err) {
      console.error("Failed to delete comment", err);
      toast.error("Failed to delete comment");
    }
  };

  const handleReactComment = async (commentId: string, reactionType: ReactionType) => {
    if (!orgId) return;
    try {
      const result = await toggleCommentReaction(commentId, orgId, reactionType);
      setPostComments((prev) =>
        prev.map((c) => {
          if (c._id !== commentId) return c;
          return {
            ...c,
            userReaction: result.reactionType,
            reactionsCount: result.reactionsCount,
          };
        })
      );
    } catch (err) {
      console.error("Failed to react to comment:", err);
      toast.error("Failed to update reaction");
    }
  };

  const handleImageClickInternal = (index: number) => {
    if (onImageClick) {
      onImageClick(post, index);
    }
  };

  return (
    <motion.div
      id={`post-${post._id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "bg-[#111115] border border-[#2a2a35] rounded-2xl overflow-hidden mb-3 transition-all duration-500",
        isHighlighted && "ring-1 ring-orange-500/40 border-orange-500/30",
        post.isPinned && "border-brand/30 ring-1 ring-brand/20",
      )}
    >
      {/* Pinned Post Banner */}
      {post.isPinned && (
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-brand/10 via-brand/5 to-transparent border-b border-brand/20">
          <div className="flex items-center gap-2">
            <Pin className="w-3.5 h-3.5 text-brand fill-brand" />
            <span className="text-brand text-xs font-semibold tracking-wide uppercase">Pinned Post</span>
          </div>
          {amIFounder && onUnpin && (
            <button
              onClick={() => onUnpin(post._id)}
              className="text-[#9fa0b8] hover:text-white text-xs transition-colors flex items-center gap-1 hover:bg-white/5 px-2 py-0.5 rounded-full"
            >
              <X className="w-3 h-3" />
              Unpin
            </button>
          )}
        </div>
      )}
      <div className="flex items-start justify-between p-4 pb-3">
        <div
          className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
          onClick={() => {
            if (post.authorId) {
              window.dispatchEvent(
                new CustomEvent("affiliate-profile:open", {
                  detail: { userId: post.authorId },
                })
              );
            }
          }}
        >
          {post.authorAvatar ? (
            <img
              src={post.authorAvatar}
              alt={post.authorName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#1a1a22] flex items-center justify-center text-brand font-semibold text-lg">
              {post.authorName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-white font-semibold text-[15px]">{post.authorName}</p>
            <p className="text-xs text-[#9fa0b8]">
              {getRelativeTime(new Date(post.createdAt))}
            </p>
          </div>
        </div>

      {/* Edit/Delete/Pin Menu - Show for own posts (edit/delete) or for founders (pin) */}
        {(isOwnPost && (onEdit || onDelete)) || amIFounder ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full hover:bg-[#1a1a22] text-[#9fa0b8] hover:text-white transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 w-44 bg-[#1a1a22] border border-[#2a2a35] rounded-lg shadow-xl overflow-hidden z-50"
                >
                  {/* Pin / Unpin — founder only */}
                  {amIFounder && onPin && !post.isPinned && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onPin(post._id);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-brand hover:bg-[#2a2a35] transition-colors"
                    >
                      <Pin className="w-4 h-4" />
                      Pin post
                    </button>
                  )}
                  {amIFounder && onUnpin && post.isPinned && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onUnpin(post._id);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#9fa0b8] hover:bg-[#2a2a35] transition-colors"
                    >
                      <Pin className="w-4 h-4" />
                      Unpin post
                    </button>
                  )}
                  {isOwnPost && onEdit && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEdit(post);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-[#2a2a35] transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit post
                    </button>
                  )}
                  {isOwnPost && onDelete && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDelete(post._id);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-[#2a2a35] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete post
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : null}
      </div>

      {/* Article Card Layout or Regular Post Content */}
      <div className="px-4">
      {post.postType === 'article' ? (() => {
        const _orgSlug = typeof window !== 'undefined' ? localStorage.getItem('garage_org_slug') || '' : '';
        const _articleUrl = `/guest/${_orgSlug}/article/${post._id}`;
        return (
          <div className="mb-3">
            {/* Article Badge + Reading Time */}
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[11px] font-semibold uppercase tracking-wide">
                <FileText className="w-3 h-3" />
                Article
              </span>
              {post.readingTimeMinutes && (
                <span className="inline-flex items-center gap-1 text-[#9fa0b8] text-[11px]">
                  <Clock className="w-3 h-3" />
                  {post.readingTimeMinutes} min read
                </span>
              )}
            </div>
            {/* Title */}
            {post.title && (
              <a
                href={_articleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <h3 className="text-white text-xl font-bold leading-tight mb-3 hover:text-brand transition-colors">
                  {post.title}
                </h3>
              </a>
            )}
            {/* Cover Image */}
            {(() => {
              const articleCover =
                post.coverImage ||
                (post as any).cover_image ||
                (post as any).cover ||
                (post as any).headerImage ||
                (post as any).banner ||
                images[0]?.url;

              if (!articleCover) return null;

              return (
                <a
                  href={_articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex justify-start mb-3"
                >
                  <div className="relative max-w-full overflow-hidden rounded-xl border border-[#2a2a35]">
                    <SkeletonImage
                      src={articleCover}
                      alt={post.title || 'Article cover'}
                      className="w-auto max-w-full h-auto max-h-[480px] object-contain block hover:scale-[1.02] transition-transform duration-300"
                      style={{ minHeight: 180 }}
                    />
                  </div>
                </a>
              );
            })()}
            {/* Truncated Article Description */}
            {post.content && (() => {
              const plainText = post.content
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'")
                .replace(/\s+/g, ' ')
                .trim();
              const previewText = plainText.replace(/^#{1,3}\s+/gm, '').slice(0, 200);
              return (
                <div className="text-[#d1d1e0] text-[14px] leading-relaxed mb-3">
                  <p className="line-clamp-3">
                    {previewText}
                    {plainText.length > 200 ? '…' : ''}
                  </p>
                </div>
              );
            })()}
            {/* Read Full Article Link */}
            <a
              href={_articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-brand text-sm font-medium hover:text-brand/80 transition-colors"
            >
              Read full article →
            </a>
          </div>
        );
      })() : (
        <div className={cn("mb-3", onClick && "cursor-pointer")} onClick={onClick ? () => onClick(post._id) : undefined}>
          <ExpandablePostContent
            content={post.content}
            onTagClick={onTagClick}
            onMentionClick={onMentionClick}
          />
        </div>
      )}
      </div>

      {/* Poll Display */}
      {post.hasPoll && post.poll && (
        <div className="mb-3 px-4">
          <PollDisplay poll={post.poll} />
        </div>
      )}

      {/* Link Preview - Use stored metadata if available, otherwise fetch on-demand */}
      <div className="px-4">
      {(() => {
        // Check if linkPreviews is explicitly defined (even if empty array)
        // If defined but empty, user chose not to include previews - don't show any
        // If undefined, fall back to on-demand fetch for older posts
        if (post.linkPreviews !== undefined) {
          // linkPreviews is defined - respect user's choice
          if (post.linkPreviews.length === 0) {
            // User explicitly removed all previews - don't show any
            return null;
          }

          return (
            <div className="mb-3 space-y-2">
              {post.linkPreviews.map((preview, index) => {
                const previewUrl = cleanUrl(preview.url);
                const hostname = (() => {
                  try {
                    return new URL(previewUrl).hostname;
                  } catch {
                    return previewUrl;
                  }
                })();

                // YouTube-specific rich preview card
                const youtubeId = (() => {
                  const match = previewUrl.match(
                    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
                  );
                  return match ? match[1] : null;
                })();

                if (youtubeId && preview.showThumbnail !== false) {
                  const ytThumb = preview.image || `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
                  return (
                    <a
                      key={index}
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-[#2a2a35] bg-[#15151b] hover:bg-[#1a1a22] transition-colors overflow-hidden group"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-stretch min-h-24">
                        {/* Compact YouTube thumbnail with play button */}
                        <div className="w-40 flex-shrink-0 relative overflow-hidden bg-[#0e0e12]">
                          <img
                            src={ytThumb}
                            alt={preview.title || "YouTube video"}
                            className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${youtubeId}/default.jpg`;
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                            <div className="w-10 h-7 bg-red-600 rounded-md flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                              <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
                            </div>
                          </div>
                        </div>
                        {/* Video title + description */}
                        <div className="flex-1 p-3 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-1 mb-1 text-[#9fa0b8]">
                            <Youtube className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-[10px] uppercase tracking-wide">YouTube</span>
                          </div>
                          {preview.title ? (
                            <div className="text-sm font-semibold text-white mb-1 line-clamp-2 leading-snug group-hover:text-brand transition-colors underline decoration-white/25 underline-offset-2">
                              {preview.title}
                            </div>
                          ) : (
                            <div className="text-sm font-semibold text-white mb-1 line-clamp-2 leading-snug group-hover:text-brand transition-colors underline decoration-white/25 underline-offset-2">
                              {hostname}
                            </div>
                          )}
                          {preview.description && (
                            <div className="text-xs text-[#9fa0b8] line-clamp-2">
                              {preview.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </a>
                  );
                }

                // Generic link preview card (non-YouTube)
                return (
                  <a
                    key={index}
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-[#2a2a35] bg-[#15151b] hover:bg-[#1a1a22] transition-colors overflow-hidden group"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-stretch min-h-24">
                      {/* Thumbnail — falls back to the site favicon when the og:image is missing or blocked */}
                      {preview.showThumbnail !== false && (
                        <div className="w-24 flex-shrink-0 relative overflow-hidden bg-[#0e0e12]">
                          <img
                            src={
                              preview.image ||
                              `https://www.google.com/s2/favicons?sz=128&domain=${hostname}`
                            }
                            alt={preview.title || "Preview"}
                            // Many sites hotlink-block by Referer; sending none makes the og:image load.
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className={cn(
                              "absolute inset-0 w-full h-full",
                              preview.image ? "object-cover" : "object-contain p-6",
                            )}
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              const favicon = `https://www.google.com/s2/favicons?sz=128&domain=${hostname}`;
                              if (!img.src.startsWith(favicon)) {
                                // og:image failed — try the favicon before giving up.
                                img.src = favicon;
                                img.className =
                                  "absolute inset-0 w-full h-full object-contain p-6";
                                return;
                              }
                              // Favicon failed too — collapse the column so no empty block is left.
                              if (img.parentElement)
                                img.parentElement.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      {/* Content */}
                      <div className="flex-1 py-3 px-3.5 min-w-0 flex flex-col justify-center">
                        {preview.siteName && (
                          <div className="text-[10px] text-[#9fa0b8] uppercase tracking-wide mb-1">
                            {preview.siteName}
                          </div>
                        )}
                        {preview.title ? (
                          <div className="text-sm font-semibold text-white mb-1 line-clamp-2 leading-snug group-hover:text-brand transition-colors underline decoration-white/25 underline-offset-2">
                            {preview.title}
                          </div>
                        ) : (
                          <div className="text-sm font-semibold text-white mb-1 line-clamp-2 leading-snug group-hover:text-brand transition-colors underline decoration-white/25 underline-offset-2">
                            {hostname}
                          </div>
                        )}
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
        }

        // Fall back to on-demand fetch for older posts without linkPreviews field
        const firstUrl = extractFirstUrl(post.content);
        if (firstUrl) {
          return (
            <div className="mb-3">
              <LinkPreview url={firstUrl} />
            </div>
          );
        }
        return null;
      })()}
      </div>

      {/* Quoted Post Preview */}
      {post.quotedPostId && typeof post.quotedPostId === "object" && (
        <div className="mb-3 px-4">
          <QuotedPostPreview
            quotedPost={post.quotedPostId as QuotedPost}
            onClick={() => onClick?.((post.quotedPostId as QuotedPost)._id)}
          />
        </div>
      )}

      {/* Images - Full-width, no padding */}
      {images.length > 0 && (
        <div className="mt-1">
          <ImageGrid images={images} onImageClick={handleImageClickInternal} />
        </div>
      )}

      {/* Videos - Full-width */}
      {videos.length > 0 && (
        <div className="mt-1 space-y-3">
          {videos.map((video, idx) => (
            <VideoPlayer key={idx} url={video.url} name={video.name} />
          ))}
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <div className="px-4 mt-3 flex flex-wrap gap-2">
          {documents.map((doc, idx) => (
            <a
              key={idx}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 bg-[#1a1a22] rounded-none hover:bg-[#2a2a35] transition-colors border border-[#2a2a35]"
            >
              <FileText className="w-5 h-5 text-green-400" />
              <span className="text-sm text-white truncate max-w-[200px]">
                {doc.name}
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Audio / Voice Notes */}
      {audioFiles.length > 0 && (
        <div className="px-4 mt-3 space-y-2">
          {audioFiles.map((audio, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 px-4 py-3 bg-[#1a1a22] rounded-none border border-[#2a2a35]"
            >
              <VoiceMessagePlayer src={audio.url} isOwnMessage={isOwnPost} />
            </div>
          ))}
        </div>
      )}

      {/* Stats row: Reactions · Comments */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 text-sm text-[#8a8b9e]">
        <button
          onClick={() => setShowReactionsModal(true)}
          className="flex items-center gap-1.5 hover:text-white transition-colors"
        >
          {reactionsCount && reactionsCount.total > 0 && (
            <div className="flex items-center -space-x-1 mr-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1a1a2e] border border-[#111115] text-xs" style={{ zIndex: 3 }}>❤️</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1a1a2e] border border-[#111115] text-xs" style={{ zIndex: 2 }}>😆</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1a1a2e] border border-[#111115] text-xs" style={{ zIndex: 1 }}>👍</span>
            </div>
          )}
          <span>Reactions</span>
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#202027] text-white text-xs font-bold min-w-[20px]">
            {reactionsCount?.total || likeCount || 0}
          </span>
        </button>
        <span className="text-[#3a3a45] mx-1">&middot;</span>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <span>Comments</span>
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-brand text-brand-foreground text-xs font-bold min-w-[20px]">
            {commentsCount || 0}
          </span>
        </button>
        <div className="flex-1" />
        {amIFounder && (
          <button
            onClick={() => onDelete?.(post._id)}
            className="flex items-center gap-1.5 text-[#9fa0b8] hover:text-red-500 transition-colors"
          >
            <Trash className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[#2a2a35]" />

      {/* Post Actions Row */}
      <div className="flex items-center justify-between px-6 py-1 text-[#8a8b9e]">
        {/* React */}
        <ReactionPicker userReaction={userReaction} onReact={handleReaction}>
          <button
            className={cn(
              "flex items-center gap-2 py-3 px-3 text-sm font-medium hover:text-white transition-colors",
              userReaction ? "text-brand" : "",
            )}
          >
            {userReaction ? (
              <span className="text-base">{REACTION_EMOJIS[userReaction]}</span>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"></path></svg>
            )}
            React
          </button>
        </ReactionPicker>

        {/* Comment */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 py-3 px-3 text-sm font-medium hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
          Comment
        </button>

        {/* Share */}
        <button
          onClick={async () => {
            if (!orgId || shareState !== "idle") return;
            setShareState("loading");
            try {
              const { shareLink } = await getPostShareLink(post._id, orgId);
              await navigator.clipboard.writeText(shareLink);
              setShareState("copied");
              toast.success(
                "Share link copied! Anyone who joins through this link will be added to your network.",
              );
              setTimeout(() => setShareState("idle"), 2000);
            } catch {
              toast.error("Failed to copy share link");
              setShareState("idle");
            }
          }}
          className={cn(
            "flex items-center gap-2 py-3 px-3 text-sm font-medium transition-colors",
            shareState === "copied" ? "text-green-400 animate-pulse" : "hover:text-white",
          )}
          title="Copy share link"
        >
          {shareState === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : shareState === "copied" ? (
            <Check className="h-4 w-4" />
          ) : (
            <Share2 className="w-4.5 h-4.5" />
          )}
          Share
        </button>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-[#2a2a35] px-4 pt-4 pb-4 space-y-4"
          >
            {/* Existing Comments */}
            {loadingComments ? (
              <p className="text-[#9fa0b8] text-sm text-center py-4">
                Loading comments...
              </p>
            ) : postComments.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {groupCommentsIntoThreads(postComments).map((comment) => (
                  <CommentThread
                    key={comment._id}
                    comment={comment}
                    onReply={handleReply}
                    onEditComment={handleEditComment}
                    onDeleteComment={handleDeleteComment}
                    onReactComment={handleReactComment}
                    currentUser={{
                      userId: currentUserId,
                      name:
                        currentUserName ||
                        currentUserEmail?.split("@")[0] ||
                        "User",
                      email: currentUserEmail,
                      profilePicture: currentUserAvatar,
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[#9fa0b8] text-sm text-center py-2">
                No comments yet. Be the first to comment!
              </p>
            )}

            {/* Comment Input */}
            <CommentInput
              user={{
                name:
                  currentUserName || currentUserEmail?.split("@")[0] || "User",
                email: currentUserEmail,
                profilePicture: currentUserAvatar,
              }}
              onSubmit={handleComment}
              placeholder="Write a comment..."
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reactions Modal */}
      <ReactionsModal
        isOpen={showReactionsModal}
        onClose={() => setShowReactionsModal(false)}
        postId={post._id}
        initialByType={
          reactionsCount
            ? {
                like: reactionsCount.like,
                love: reactionsCount.love,
                haha: reactionsCount.haha,
                wow: reactionsCount.wow,
                sad: reactionsCount.sad,
                angry: reactionsCount.angry,
              }
            : undefined
        }
      />
    </motion.div>
  );
}

// Channel Access Gate Component
export function ChannelAccessGate({
  channel,
  onSubscribe,
}: {
  channel: {
    _id: string;
    title: string;
    description?: string;
    price: number;
    isFree: boolean;
  };
  onSubscribe: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center text-brand mb-4">
        <Lock className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{channel.title}</h3>
      {channel.description && (
        <div
          className="text-[#9fa0b8] text-sm mb-6 max-w-md [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
          dangerouslySetInnerHTML={{ __html: sanitizeDescription(channel.description) }}
        />
      )}
      <p className="text-white mb-6">
        {channel.isFree
          ? "Join this free channel to see posts"
          : `Subscribe for $${channel.price} to access this channel`}
      </p>
      <Button
        onClick={onSubscribe}
        className="bg-brand hover:opacity-90 text-brand-foreground px-8"
      >
        {channel.isFree ? "Join Channel" : "Subscribe Now"}
      </Button>
    </div>
  );
}
