"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Send,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type Post, getPostComments } from "@/lib/revenue-network-api";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  initialImageIndex?: number;
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string) => void;
}

export function ImageModal({
  isOpen,
  onClose,
  post,
  initialImageIndex = 0,
  onLike,
  onComment,
}: ImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialImageIndex);
  const [isLiked, setIsLiked] = useState(post.hasLiked || false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Get only image attachments
  const images = post.attachments?.filter((att) => att.type === "image") || [];

  // Reset index when modal opens with new post
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialImageIndex);
      setIsLiked(post.hasLiked || false);
      setLikeCount(post.likes);
      fetchComments();
    }
  }, [isOpen, initialImageIndex, post._id]);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const data = await getPostComments(post._id);
      setComments(data.comments || []);
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handlePrevious, handleNext]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleLike = () => {
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount((prev) => (newIsLiked ? prev + 1 : Math.max(prev - 1, 0)));
    onLike(post._id);
  };

  const handleComment = async () => {
    if (commentText.trim()) {
      onComment(post._id, commentText.trim());
      setCommentText("");
      // Refresh comments after adding a new one
      setTimeout(() => fetchComments(), 500);
    }
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/95" />

          {/* Content Container */}
          <div
            className="relative flex flex-col md:flex-row w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-3 left-3 md:top-4 md:left-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            >
              <X className="h-5 w-5 md:h-6 md:w-6" />
            </button>

            {/* Left Side - Image Viewer (hidden on mobile when no images, takes partial height on mobile) */}
            <div className="flex-shrink-0 h-[45vh] md:h-full md:flex-1 flex items-center justify-center relative">
              {/* Previous Arrow */}
              {images.length > 1 && (
                <button
                  onClick={handlePrevious}
                  className="absolute left-2 md:left-4 z-40 p-2 md:p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                >
                  <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
                </button>
              )}

              {/* Image */}
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="max-w-full max-h-full p-4 md:p-8"
              >
                <img
                  src={images[currentIndex]?.url}
                  alt={
                    images[currentIndex]?.name || `Image ${currentIndex + 1}`
                  }
                  className="max-w-full max-h-[40vh] md:max-h-[90vh] object-contain"
                />
              </motion.div>

              {/* Next Arrow */}
              {images.length > 1 && (
                <button
                  onClick={handleNext}
                  className="absolute right-2 md:right-4 z-40 p-2 md:p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                >
                  <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
                </button>
              )}

              {/* Image Counter */}
              {images.length > 1 && (
                <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 md:px-4 md:py-2 rounded-full bg-black/50 text-white text-xs md:text-sm">
                  {currentIndex + 1} / {images.length}
                </div>
              )}
            </div>

            {/* Right Side - Comments Panel (Twitter-like) */}
            <div className="flex-1 md:flex-none md:w-[400px] bg-[#0e0e12] border-t md:border-t-0 md:border-l border-[#2a2a35] flex flex-col min-h-0">
              {/* Post Header */}
              <div className="p-4 border-b border-[#2a2a35]">
                <div className="flex items-start gap-3">
                  {post.authorAvatar ? (
                    <img
                      src={post.authorAvatar}
                      alt={post.authorName}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#1a1a22] flex items-center justify-center text-brand font-semibold flex-shrink-0">
                      {/* {post.authorName.charAt(0).toUpperCase()} */}
                      {post.authorName?.charAt(0)?.toUpperCase() ?? '?'}

                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold">
                      {post.authorName}
                    </p>
                    <p className="text-xs text-[#9fa0b8]">
                      {new Date(post.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Post Content */}
                <p className="text-white mt-3 whitespace-pre-wrap">
                  {post.content}
                </p>

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-brand text-sm hover:underline cursor-pointer"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[#2a2a35]">
                  <button
                    onClick={handleLike}
                    className={cn(
                      "flex items-center gap-2 transition-colors",
                      isLiked
                        ? "text-red-400"
                        : "text-[#9fa0b8] hover:text-red-400",
                    )}
                  >
                    <Heart
                      className={cn("h-5 w-5", isLiked && "fill-current")}
                    />
                    <span className="text-sm">{likeCount}</span>
                  </button>
                  <div className="flex items-center gap-2 text-[#9fa0b8]">
                    <MessageCircle className="h-5 w-5" />
                    <span className="text-sm">{post.comments}</span>
                  </div>
                </div>
              </div>

              {/* Comments Section */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingComments ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand"></div>
                  </div>
                ) : comments.length > 0 ? (
                  comments.map((comment: any) => (
                    <div key={comment._id} className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1a1a22] flex items-center justify-center text-brand text-sm font-semibold flex-shrink-0">
                        {/* {comment.userName?.charAt(0).toUpperCase() || 'A'} */}
                        {comment.userName?.charAt(0)?.toUpperCase() ?? 'A'}
                        </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-semibold text-sm">
                            {comment.userName || "Anonymous"}
                          </p>
                          <span className="text-xs text-[#9fa0b8]">
                            {new Date(comment.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                        </div>
                        <p className="text-[#e4e4e7] text-sm mt-1">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-[#9fa0b8]">No comments yet</p>
                    <p className="text-[#9fa0b8] text-sm mt-1">
                      Be the first to comment!
                    </p>
                  </div>
                )}
              </div>

              {/* Comment Input */}
              <div className="p-4 border-t border-[#2a2a35]">
                <div className="flex gap-2">
                  <Input
                    placeholder="Post your reply..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleComment()}
                    className="bg-[#1a1a22] border-[#2a2a35] text-white placeholder:text-[#9fa0b8] flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleComment}
                    disabled={!commentText.trim()}
                    className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
