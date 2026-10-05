"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share,
  Send,
  ArrowLeft,
  MoreHorizontal,
  Loader2,
  Check,
  FileText,
  Clock,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  getPost,
  getComments,
  addComment,
  deleteComment,
  updateComment,
  toggleCommentReaction,
  toggleReaction,
  toggleRepost,
  toggleBookmark,
  type Post,
  type Comment,
  type CommentAttachment as ApiCommentAttachment,
  type ReactionType,
  type ReactionsCount,
  REACTION_EMOJIS,
} from "@/lib/feed-api";
import { ReactionPicker } from "@/components/feed/ReactionPicker";
import { ReactionDisplay } from "@/components/feed/ReactionDisplay";
import { ReactionsModal } from "@/components/feed/ReactionsModal";
import { LinkPreview } from "@/components/ui/link-preview";
import { PollDisplay } from "@/components/feed/PollDisplay";
import { CommentInput, CommentAttachment } from "@/components/feed/CommentInput";
import { CommentThread, groupCommentsIntoThreads } from "@/components/feed/CommentThread";
import { getPostShareLink } from "@/lib/feed-api";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import "@/components/feed/article-editor.css";
import { ImageGrid } from "./FeedComponents";

// URL regex for detecting links in post content
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

// Extract first URL from text for link preview
const extractFirstUrl = (text: string): string | null => {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
};

// Detect whether content is HTML (from Tiptap editor) or plain text (legacy)
function isHtmlContent(content: string): boolean {
  return /<(?:p|h[1-6]|ul|ol|blockquote|pre|hr|strong|em|a|code)[\s>]/i.test(content);
}

/**
 * Sanitize article HTML with DOMPurify, also stripping any HTML tags
 * that leaked into href attributes (e.g. from bold/italic applied to links).
 */
function sanitizeArticleHtml(html: string): string {
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

// Helper function to render content with highlighted mentions, hashtags, URLs, and headings
function renderPostContent(
  content: string,
  onTagClick?: (tag: string) => void,
  onMentionClick?: (mention: string) => void
) {
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

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
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
      elements.push(<br key={`br-${i}`} />);
    } else {
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

interface PostDetailViewProps {
  postId: string;
  orgId: string;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  onBack: () => void;
  onPostUpdate?: (post: Post) => void;
  onTagClick?: (tag: string) => void;
  onMentionClick?: (mention: string) => void;
  onEdit?: (post: Post) => void;
  onDelete?: (postId: string) => void;
}

export function PostDetailView({
  postId,
  orgId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onBack,
  onPostUpdate,
  onTagClick,
  onMentionClick,
  onEdit,
  onDelete,
}: PostDetailViewProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Mobile keyboard inset. On Android, focusing the CommentInput
  // textarea opens the soft keyboard which shrinks the *visual*
  // viewport but NOT the layout viewport - so the h-full column
  // doesn't get smaller and the comment bar sits *behind* the
  // keyboard, invisible. Same pattern as MeetSidebar: subscribe to
  // window.visualViewport and pad the panel bottom by the overlap
  // so the input rides just above the keyboard.
  const [kbInset, setKbInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const onChange = () => {
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      // 80 px threshold ignores the Chrome address-bar collapse
      // (typically ~56 px on Android) so scrolling doesn't add
      // phantom padding.
      setKbInset(isMobile && overlap > 80 ? overlap : 0);
    };
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    onChange();
    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
    };
  }, []);

  // Interaction states
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [reactionsCount, setReactionsCount] = useState<ReactionsCount | undefined>();
  const [isReposted, setIsReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "loading" | "copied">("idle");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadPost = useCallback(async () => {
    if (!postId || !orgId) return;

    try {
      setIsLoading(true);
      const { post: fetchedPost } = await getPost(postId, orgId);

      if (fetchedPost) {
        setPost(fetchedPost);
        setUserReaction(fetchedPost.userReaction || null);
        setReactionsCount(fetchedPost.reactionsCount);
        setIsReposted(fetchedPost.hasReposted || false);
        setRepostCount(fetchedPost.repostsCount || 0);
        setIsBookmarked(fetchedPost.hasBookmarked || false);
        setBookmarkCount(fetchedPost.bookmarksCount || 0);

        // Load comments
        try {
          const commentsData = await getComments(postId);
          setComments(commentsData.comments || []);
        } catch (err) {
          console.log("Could not load comments:", err);
          setComments([]);
        }
      }
    } catch (error) {
      console.error("Failed to load post:", error);
    } finally {
      setIsLoading(false);
    }
  }, [postId, orgId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const handleReaction = async (reactionType: ReactionType) => {
    if (!postId) return;

    // Optimistic update
    const prevReaction = userReaction;
    const prevReactionsCount = reactionsCount;

    // Determine new state
    if (userReaction === reactionType) {
      // Same reaction - remove it
      setUserReaction(null);
      if (reactionsCount) {
        setReactionsCount({
          ...reactionsCount,
          [reactionType]: Math.max(0, reactionsCount[reactionType] - 1),
          total: Math.max(0, reactionsCount.total - 1),
        });
      }
    } else if (userReaction) {
      // Different reaction - change it
      setUserReaction(reactionType);
      if (reactionsCount) {
        setReactionsCount({
          ...reactionsCount,
          [userReaction]: Math.max(0, reactionsCount[userReaction] - 1),
          [reactionType]: reactionsCount[reactionType] + 1,
        });
      }
    } else {
      // No previous reaction - add new one
      setUserReaction(reactionType);
      if (reactionsCount) {
        setReactionsCount({
          ...reactionsCount,
          [reactionType]: reactionsCount[reactionType] + 1,
          total: reactionsCount.total + 1,
        });
      }
    }

    try {
      const result = await toggleReaction(postId, orgId, reactionType);
      setUserReaction(result.reactionType);
      setReactionsCount(result.reactionsCount);
      if (post && onPostUpdate) {
        onPostUpdate({
          ...post,
          userReaction: result.reactionType,
          reactionsCount: result.reactionsCount,
        });
      }
    } catch (error) {
      // Rollback on error
      setUserReaction(prevReaction);
      setReactionsCount(prevReactionsCount);
      console.error("Failed to toggle reaction:", error);
    }
  };

  const handleRepost = async () => {
    if (!postId) return;

    const newIsReposted = !isReposted;
    setIsReposted(newIsReposted);
    setRepostCount((prev) => (newIsReposted ? prev + 1 : Math.max(prev - 1, 0)));

    try {
      const result = await toggleRepost(postId, orgId);
      setIsReposted(result.reposted);
      setRepostCount(result.repostsCount);
      if (post && onPostUpdate) {
        onPostUpdate({ ...post, hasReposted: result.reposted, repostsCount: result.repostsCount });
      }
    } catch (error) {
      setIsReposted(!newIsReposted);
      setRepostCount((prev) => (newIsReposted ? prev - 1 : prev + 1));
      console.error("Failed to toggle repost:", error);
    }
  };

  const handleBookmark = async () => {
    if (!postId) return;

    const newIsBookmarked = !isBookmarked;
    setIsBookmarked(newIsBookmarked);
    setBookmarkCount((prev) => (newIsBookmarked ? prev + 1 : Math.max(prev - 1, 0)));

    try {
      const result = await toggleBookmark(postId, orgId);
      setIsBookmarked(result.bookmarked);
      setBookmarkCount(result.bookmarksCount);
      if (post && onPostUpdate) {
        onPostUpdate({ ...post, hasBookmarked: result.bookmarked, bookmarksCount: result.bookmarksCount });
      }
    } catch (error) {
      setIsBookmarked(!newIsBookmarked);
      setBookmarkCount((prev) => (newIsBookmarked ? prev - 1 : prev + 1));
      console.error("Failed to toggle bookmark:", error);
    }
  };

  const handleSubmitComment = async (content: string, attachments: CommentAttachment[]) => {
    if (!postId) return;
    if (!content.trim() && attachments.length === 0) return;

    // Convert attachments to API format
    const apiAttachments: ApiCommentAttachment[] = attachments.map((att) => ({
      type: att.type,
      url: att.url,
      name: att.name,
      fileKey: att.fileKey,
    }));

    const result = await addComment(
      postId,
      orgId,
      content.trim(),
      undefined,
      apiAttachments.length > 0 ? apiAttachments : undefined
    );

    if (result.comment) {
      setComments((prev) => [...prev, result.comment]);
      if (post) {
        setPost({
          ...post,
          commentsCount: (post.commentsCount || 0) + 1,
        });
      }
      // Scroll to bottom
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const handleReply = async (parentCommentId: string, content: string, attachments: CommentAttachment[]) => {
    if (!postId) return;
    if (!content.trim() && attachments.length === 0) return;

    // Convert attachments to API format
    const apiAttachments: ApiCommentAttachment[] = attachments.map((att) => ({
      type: att.type,
      url: att.url,
      name: att.name,
      fileKey: att.fileKey,
    }));

    const result = await addComment(
      postId,
      orgId,
      content.trim(),
      parentCommentId,
      apiAttachments.length > 0 ? apiAttachments : undefined
    );

    if (result.comment) {
      setComments((prev) => [...prev, result.comment]);
      if (post) {
        setPost({
          ...post,
          commentsCount: (post.commentsCount || 0) + 1,
        });
      }
    }
  };

  const handleEditComment = async (commentId: string, newContent: string) => {
    if (!orgId) return;
    try {
      const result = await updateComment(commentId, orgId, newContent);
      if (result.success && result.comment) {
        setComments((prev) =>
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
        setComments((prev) => prev.filter((c) => c._id !== commentId));
        if (post) {
          setPost({
            ...post,
            commentsCount: Math.max(0, (post.commentsCount || 0) - 1),
          });
        }
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
      setComments((prev) =>
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

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const formatFullDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#9fa0b8]">
        <p>Post not found</p>
        <Button
          variant="ghost"
          onClick={onBack}
          className="mt-4 text-brand hover:text-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Feed
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ paddingBottom: kbInset || undefined }}
    >
      {/* Header */}
      <div className="border-b border-[#2a2a35] sticky top-0 bg-[#0b0b0d] z-10">
        <div className="flex items-center gap-4 px-6 py-3.5">
          <button
            onClick={onBack}
            className="p-2 hover:bg-[#2a2a35] rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-lg font-bold text-white">
            {post?.postType === 'article' ? 'Article' : 'Post'}
          </h2>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Author Section */}
        <div className="flex items-start gap-3 p-6">
          {post.authorId?.profilePicture ? (
            <img
              src={post.authorId?.profilePicture}
              alt={post.authorId?.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#1a1a22] flex items-center justify-center text-brand font-semibold text-lg">
              {(post.authorId?.name?.charAt(0).toUpperCase() ?? '?')}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{post.authorId?.name}</p>
                <div className="flex items-center gap-2 text-sm text-[#9fa0b8]">
                  <span>{formatFullDate(post.createdAt)} · {formatDate(post.createdAt)}</span>
                  {post.postType === 'article' && post.readingTimeMinutes && (
                    <span className="inline-flex items-center gap-1">
                      · <Clock className="w-3 h-3" /> {post.readingTimeMinutes} min read
                    </span>
                  )}
                </div>
              </div>
              {currentUserId && post.authorId?._id === currentUserId && (onEdit || onDelete) && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 hover:bg-[#2a2a35] rounded-full transition-colors"
                  >
                    <MoreHorizontal className="w-5 h-5 text-[#9fa0b8]" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-[#1a1a22] border border-[#2a2a35] rounded-lg shadow-xl overflow-hidden z-50">
                      {onEdit && (
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
                      {onDelete && (
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Article Title (above image) */}
        {post.postType === 'article' && (
          <div className="px-6 pb-2">
            {post.title && (
              <h1 className="text-2xl font-bold text-white leading-tight mb-2">
                {post.title}
              </h1>
            )}
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[11px] font-semibold uppercase tracking-wide">
                <FileText className="w-3 h-3" />
                Article
              </span>
            </div>
          </div>
        )}

        {/* Article Cover Image (between title and content) */}
        {(() => {
          const articleCover =
            post.coverImage ||
            (post as any).cover_image ||
            (post as any).cover ||
            (post as any).headerImage ||
            (post as any).banner ||
            post.attachments?.find((att: any) => att.type === "image" || att.type === "photo")?.url;

          if (post.postType === 'article' && articleCover) {
            return (
              <div className="px-6 pb-4 flex justify-start">
                <div className="relative max-w-full overflow-hidden rounded-xl border border-[#2a2a35]">
                  <img
                    src={articleCover}
                    alt={post.title || 'Article cover'}
                    className="w-auto max-w-full h-auto max-h-[480px] object-contain block"
                  />
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Post Content */}
        {post.content && (
          <div className="px-6 pb-4">
            {post.postType === 'article' && isHtmlContent(post.content) ? (
              <div
                className="article-prose-html"
                dangerouslySetInnerHTML={{
                  __html: sanitizeArticleHtml(post.content),
                }}
              />
            ) : (
              <div className={cn(
                "text-white leading-relaxed whitespace-pre-wrap",
                post.postType === 'article' ? "text-[16px] leading-[1.8]" : "text-lg"
              )}>
                {renderPostContent(post.content, onTagClick, onMentionClick)}
              </div>
            )}
          </div>
        )}

        {/* Poll Display */}
        {post.hasPoll && post.poll && (
          <div className="px-6 pb-4">
            <PollDisplay poll={post.poll} />
          </div>
        )}

        {/* Link Preview */}
        {(() => {
          const firstUrl = extractFirstUrl(post.content);
          if (firstUrl) {
            return (
              <div className="px-6 pb-4">
                <LinkPreview url={firstUrl} />
              </div>
            );
          }
          return null;
        })()}

        {/* Images */}
        {post.attachments && post.attachments.filter((att) => att.type === "image").length > 0 && (
          <div className="px-6 pb-4">
            <ImageGrid
              images={post.attachments
                .filter((att) => att.type === "image")
                .map((att) => ({ url: att.url, name: att.name || "" }))}
            />
          </div>
        )}

        {/* Videos */}
        {post.attachments && post.attachments.filter((att) => att.type === "video").length > 0 && (
          <div className="px-6 pb-4">
            <div className="grid gap-2 rounded-xl overflow-hidden">
              {post.attachments
                .filter((att) => att.type === "video")
                .map((vid, idx) => {
                  const isYoutube = vid.url.includes("youtube.com") || vid.url.includes("youtu.be");
                  if (isYoutube) {
                    const videoId = vid.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
                    return (
                      <div key={idx} className="aspect-video rounded-xl overflow-hidden">
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}`}
                          className="w-full h-full"
                          allowFullScreen
                        />
                      </div>
                    );
                  }
                  return (
                    <video
                      key={idx}
                      src={vid.url}
                      controls
                      className="w-full rounded-xl max-h-96"
                    />
                  );
                })}
            </div>
          </div>
        )}

        {/* Channel Tags */}
        {post.channelIds && post.channelIds.length > 0 && (
          <div className="px-6 pb-3 flex flex-wrap gap-2">
            {post.channelIds.map((channel) => (
              <span
                key={channel._id}
                className="px-2 py-1 bg-brand/10 text-brand text-xs font-medium rounded-md"
              >
                {channel.title}
              </span>
            ))}
          </div>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="px-6 pb-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-[#1a1a22] text-[#9fa0b8] text-xs font-medium rounded-md"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Action Buttons - Single row like PostCard */}
        <div className="border-t border-b border-[#2a2a35]">
          <div className="flex items-center gap-6 px-6 py-3 text-[#9fa0b8]">
            {/* Reaction button with picker */}
            <ReactionPicker
              userReaction={userReaction}
              onReact={handleReaction}
            >
              <button
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  userReaction ? "text-brand" : "hover:text-brand"
                )}
              >
                {userReaction ? (
                  <span className="text-lg">{REACTION_EMOJIS[userReaction]}</span>
                ) : (
                  <Heart className="h-5 w-5" />
                )}
                <span
                  className="text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReactionsModal(true);
                  }}
                >
                  {reactionsCount?.total || post?.likesCount || 0}
                </span>
              </button>
            </ReactionPicker>

            {/* Comment button */}
            <button className="flex items-center gap-2 hover:text-blue-400 transition-colors">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">{post?.commentsCount || 0}</span>
            </button>

            {/* Repost button */}
            <button
              onClick={handleRepost}
              className={cn(
                "flex items-center gap-2 transition-colors",
                isReposted ? "text-green-400" : "hover:text-green-400"
              )}
            >
              <Repeat2 className="h-5 w-5" />
              <span className="text-sm">{repostCount}</span>
            </button>

            {/* Bookmark button */}
            <button
              onClick={handleBookmark}
              className={cn(
                "flex items-center gap-2 transition-colors",
                isBookmarked ? "text-yellow-400" : "hover:text-yellow-400"
              )}
            >
              <Bookmark className={cn("h-5 w-5", isBookmarked && "fill-current")} />
              <span className="text-sm">{bookmarkCount}</span>
            </button>
            <button
              onClick={async () => {
                if (shareState !== "idle") return;
                setShareState("loading");
                try {
                  const { shareLink } = await getPostShareLink(postId, orgId);
                  await navigator.clipboard.writeText(shareLink);
                  setShareState("copied");
                  toast.success("Share link copied! Anyone who joins through this link will be added to your network.");
                  setTimeout(() => setShareState("idle"), 2000);
                } catch {
                  toast.error("Failed to copy share link");
                  setShareState("idle");
                }
              }}
              className={cn(
                "flex items-center gap-2 transition-colors",
                shareState === "copied" ? "text-green-400" : "hover:text-blue-400"
              )}
              title="Copy share link"
            >
              {shareState === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : shareState === "copied" ? (
                <Check className="h-5 w-5" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Static overlapping reaction emojis */}
            {reactionsCount && reactionsCount.total > 0 && (
              <button
                onClick={() => setShowReactionsModal(true)}
                className="flex items-center hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center -space-x-1.5">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#1a1a2e] border border-[#0f0f1a] text-sm" style={{ zIndex: 3 }}>❤️</span>
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#1a1a2e] border border-[#0f0f1a] text-sm" style={{ zIndex: 2 }}>😆</span>
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#1a1a2e] border border-[#0f0f1a] text-sm" style={{ zIndex: 1 }}>👍</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <div className="px-6 py-3">
          <h3 className="font-semibold text-white mb-4">
            Replies {comments.length > 0 && `(${comments.length})`}
          </h3>

          {comments.length === 0 ? (
            <div className="text-center py-8 text-[#9fa0b8]">
              <p>No replies yet</p>
              <p className="text-sm mt-1">Be the first to reply!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupCommentsIntoThreads(comments).map((comment) => (
                <CommentThread
                  key={comment._id}
                  comment={comment}
                  onReply={handleReply}
                  onEditComment={handleEditComment}
                  onDeleteComment={handleDeleteComment}
                  onReactComment={handleReactComment}
                  currentUser={{
                    userId: currentUserId,
                    name: currentUserName || "User",
                    profilePicture: currentUserAvatar,
                  }}
                />
              ))}
              <div ref={commentsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Comment Input - Fixed at bottom */}
      <div className="border-t border-[#2a2a35] bg-[#0b0b0d] px-6 py-4">
        <CommentInput
          user={{
            name: currentUserName || "User",
            profilePicture: currentUserAvatar,
          }}
          onSubmit={handleSubmitComment}
          placeholder="Post your reply..."
        />
      </div>

      {/* Reactions Modal */}
      <ReactionsModal
        isOpen={showReactionsModal}
        onClose={() => setShowReactionsModal(false)}
        postId={postId}
        initialByType={reactionsCount ? {
          like: reactionsCount.like,
          love: reactionsCount.love,
          haha: reactionsCount.haha,
          wow: reactionsCount.wow,
          sad: reactionsCount.sad,
          angry: reactionsCount.angry,
        } : undefined}
      />

    </div>
  );
}
