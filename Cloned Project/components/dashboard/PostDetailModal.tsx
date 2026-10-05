"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share,
  ArrowLeft,
  MoreHorizontal,
  Send,
  Loader2,
  Check,
  X,
} from "lucide-react";
import {
  getPost,
  getComments,
  addComment,
  toggleReaction,
  toggleRepost,
  toggleBookmark,
  type Post,
  type Comment,
  type ReactionType,
  type ReactionsCount,
  REACTION_EMOJIS,
} from "@/lib/feed-api";
import { LinkPreview } from "@/components/ui/link-preview";
import { PollDisplay } from "@/components/feed/PollDisplay";
import { ReactionPicker } from "@/components/feed/ReactionPicker";
import { ReactionDisplay } from "@/components/feed/ReactionDisplay";
import { ReactionsModal } from "@/components/feed/ReactionsModal";
import { getPostShareLink } from "@/lib/feed-api";
import { toast } from "sonner";
import { ImageGrid } from "./FeedComponents";

// URL regex for detecting links in post content
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

// Extract first URL from text for link preview
const extractFirstUrl = (text: string): string | null => {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
};

// Helper function to render content with highlighted mentions, hashtags, and URLs
function renderPostContent(
  content: string,
  onTagClick?: (tag: string) => void,
  onMentionClick?: (mention: string) => void
) {
  // Split content by @mentions, #hashtags, and URLs
  const parts = content.split(/(@\w+|#\w+|https?:\/\/[^\s]+)/gi);

  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const mention = part.slice(1); // Remove @ prefix
      return (
        <span
          key={i}
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
      const tag = part.slice(1); // Remove # prefix
      return (
        <span
          key={i}
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
    return <span key={i}>{part}</span>;
  });
}

interface PostDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string | null;
  orgId: string;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  onPostUpdate?: (post: Post) => void;
  onTagClick?: (tag: string) => void;
  onMentionClick?: (mention: string) => void;
}

export function PostDetailModal({
  isOpen,
  onClose,
  postId,
  orgId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onPostUpdate,
  onTagClick,
  onMentionClick,
}: PostDetailModalProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Interaction states
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [reactionsCount, setReactionsCount] = useState<ReactionsCount | undefined>();
  const [isReposted, setIsReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "loading" | "copied">("idle");

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
    if (isOpen && postId) {
      loadPost();
    } else {
      // Reset state when closing
      setPost(null);
      setComments([]);
      setCommentText("");
    }
  }, [isOpen, postId, loadPost]);

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

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !postId || isSubmittingComment) return;

    try {
      setIsSubmittingComment(true);
      const result = await addComment(postId, orgId, commentText.trim());

      if (result.comment) {
        setComments((prev) => [...prev, result.comment]);
        setCommentText("");
        // Scroll to bottom
        setTimeout(() => {
          commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } catch (error) {
      console.error("Failed to submit comment:", error);
    } finally {
      setIsSubmittingComment(false);
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

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-[#2a2a35] sticky top-0 bg-[#0e0e12] z-10">
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#2a2a35] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold">Post</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand" />
          </div>
        ) : !post ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#9fa0b8]">
            <p>Post not found</p>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(90vh-60px)]">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Author Section */}
              <div className="flex items-start gap-3 p-4">
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
                      <p className="text-sm text-[#9fa0b8]">
                        {formatFullDate(post.createdAt)} · {formatDate(post.createdAt)}
                      </p>
                    </div>
                    {currentUserId && post.authorId?._id === currentUserId && (
                      <button className="p-2 hover:bg-[#2a2a35] rounded-full transition-colors">
                        <MoreHorizontal className="w-5 h-5 text-[#9fa0b8]" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Post Content */}
              {post.content && (
                <div className="px-4 pb-4">
                  <div className="text-white text-lg leading-relaxed whitespace-pre-wrap">
                    {renderPostContent(post.content, onTagClick, onMentionClick)}
                  </div>
                </div>
              )}

              {/* Poll Display */}
              {post.hasPoll && post.poll && (
                <div className="px-4 pb-4">
                  <PollDisplay poll={post.poll} />
                </div>
              )}

              {/* Link Preview */}
              {(() => {
                const firstUrl = extractFirstUrl(post.content);
                if (firstUrl) {
                  return (
                    <div className="px-4 pb-4">
                      <LinkPreview url={firstUrl} />
                    </div>
                  );
                }
                return null;
              })()}

              {/* Images */}
              {post.attachments && post.attachments.filter((att) => att.type === "image").length > 0 && (
                <div className="px-4 pb-4">
                  <ImageGrid
                    images={post.attachments
                      .filter((att) => att.type === "image")
                      .map((att) => ({ url: att.url, name: att.name || "" }))}
                  />
                </div>
              )}

              {/* Channel Tags */}
              {post.channelIds && post.channelIds.length > 0 && (
                <div className="px-4 pb-3 flex flex-wrap gap-2">
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

              {/* Action Buttons - Single row like PostCard */}
              <div className="flex items-center gap-6 px-4 py-3 border-t border-b border-[#2a2a35] text-[#9fa0b8]">
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
                    if (!postId || shareState !== "idle") return;
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

              {/* Comments Section */}
              <div className="px-4 py-3">
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
                    {comments.map((comment) => (
                      <div key={comment._id} className="flex gap-3">
                        {comment.userId?.profilePicture ? (
                          <img
                            src={comment.userId.profilePicture}
                            alt={comment.userId.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#1a1a22] flex items-center justify-center text-brand text-sm font-semibold flex-shrink-0">
                            {comment.userId?.name?.charAt(0).toUpperCase() || "A"}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">
                              {comment.userId?.name || "Anonymous"}
                            </span>
                            <span className="text-xs text-[#9fa0b8]">
                              {formatFullDate(comment.createdAt)} · {formatDate(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-white text-sm mt-1">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={commentsEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Comment Input - Fixed at bottom */}
            <div className="border-t border-[#2a2a35] p-4 bg-[#0e0e12]">
              <div className="flex items-center gap-3">
                {currentUserAvatar ? (
                  <img
                    src={currentUserAvatar}
                    alt={currentUserName || "User"}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#1a1a22] flex items-center justify-center text-brand font-semibold flex-shrink-0">
                    {currentUserName?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                <Input
                  placeholder="Post your reply..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSubmitComment()}
                  className="flex-1 bg-[#1a1a22] border-[#2a2a35] text-white placeholder:text-[#9fa0b8] rounded-full"
                />
                <Button
                  size="sm"
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || isSubmittingComment}
                  className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground rounded-full px-4"
                >
                  {isSubmittingComment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reactions Modal */}
        {postId && (
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
        )}

      </DialogContent>
    </Dialog>
  );
}
