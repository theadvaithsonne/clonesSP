"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, ChevronDown, ChevronUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Comment, type ReactionType, REACTION_EMOJIS, REACTION_LABELS } from "@/lib/feed-api";
import { CommentInput, CommentAttachment } from "./CommentInput";
import { VoiceMessagePlayer } from "@/components/ui/voice-message-player";
import { motion, AnimatePresence } from "framer-motion";
import { ReactionPicker } from "./ReactionPicker";

// Helper function to format relative time
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d`;
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks}w`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Comment node with nested replies (unlimited depth)
export interface CommentWithReplies extends Comment {
  replies?: CommentWithReplies[];
}

/** Total replies in a comment's whole subtree (all nested descendants), so the
 *  "N replies" label reflects everything inside — not just direct replies. */
function countReplies(comment: CommentWithReplies): number {
  const replies = comment.replies ?? [];
  let total = replies.length;
  for (const r of replies) total += countReplies(r);
  return total;
}

/** parentCommentId may arrive as a plain id string or a populated object — normalise to the id. */
function parentId(comment: Comment): string | undefined {
  const p = comment.parentCommentId as unknown;
  if (!p) return undefined;
  if (typeof p === "string") return p;
  return (p as { _id?: string })._id;
}

interface CommentItemProps {
  comment: CommentWithReplies;
  onReply: (parentCommentId: string, content: string, attachments: CommentAttachment[]) => Promise<void>;
  currentUser: {
    userId?: string;
    name: string;
    email?: string;
    profilePicture?: string;
  };
  /** Nesting depth — 0 for top-level comments. */
  depth?: number;
  onEditComment?: (commentId: string, newContent: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onReactComment?: (commentId: string, reactionType: ReactionType) => Promise<void>;
}

function CommentItem({ comment, onReply, currentUser, depth = 0, onEditComment, onDeleteComment, onReactComment }: CommentItemProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [editContent, setEditContent] = useState(comment.content || "");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [showCommentMenu, setShowCommentMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const commentMenuRef = useRef<HTMLDivElement>(null);

  const isReply = depth > 0;
  const replies = comment.replies ?? [];
  // Whole-subtree reply count (all nested descendants), for the "N replies" label.
  const totalReplies = countReplies(comment);

  // Click outside to close comment menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (commentMenuRef.current && !commentMenuRef.current.contains(event.target as Node)) {
        setShowCommentMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reply directly to THIS comment so the thread keeps nesting (unlimited depth)
  const handleReply = async (content: string, attachments: CommentAttachment[]) => {
    await onReply(comment._id, content, attachments);
    setShowReplyInput(false);
    setShowReplies(true);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !onEditComment) return;
    setIsSavingEdit(true);
    try {
      await onEditComment(comment._id, editContent.trim());
      setIsEditingComment(false);
    } catch (err) {
      console.error("Failed to edit comment", err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!onDeleteComment) return;
    try {
      await onDeleteComment(comment._id);
    } catch (err) {
      console.error("Failed to delete comment", err);
    }
  };

  const handleReactComment = async (reactionType: ReactionType) => {
    if (!onReactComment) return;
    try {
      await onReactComment(comment._id, reactionType);
    } catch (err) {
      console.error("Failed to react to comment", err);
    }
  };

  const commentAuthorId = typeof comment.userId === "string" ? comment.userId : comment.userId?._id;
  const isOwnComment = currentUser?.userId && commentAuthorId === currentUser.userId;

  return (
    <div className="flex flex-col">
      <div className="flex gap-2">
        {/* Avatar */}
        <div
          className="cursor-pointer hover:opacity-85 transition-opacity"
          onClick={() => {
            if (commentAuthorId) {
              window.dispatchEvent(
                new CustomEvent("affiliate-profile:open", {
                  detail: { userId: commentAuthorId },
                })
              );
            }
          }}
        >
          {comment.userId?.profilePicture ? (
            <img
              src={comment.userId.profilePicture}
              alt={comment.userId.name}
              className={cn("rounded-full object-cover flex-shrink-0", isReply ? "w-7 h-7" : "w-8 h-8")}
            />
          ) : (
            <div
              className={cn(
                "rounded-full bg-[#1a1a22] flex items-center justify-center text-brand font-semibold flex-shrink-0",
                isReply ? "w-7 h-7 text-[10px]" : "w-8 h-8 text-xs"
              )}
            >
              {comment.userId?.name?.charAt(0).toUpperCase() || "A"}
            </div>
          )}
        </div>

        {/* Comment Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#1a1a22] rounded-2xl px-3 py-2 inline-block min-w-[150px] max-w-full relative group">
            <div className="flex items-center justify-between gap-3">
              <p
                className="text-white text-[13px] font-semibold cursor-pointer hover:underline"
                onClick={() => {
                  if (commentAuthorId) {
                    window.dispatchEvent(
                      new CustomEvent("affiliate-profile:open", {
                        detail: { userId: commentAuthorId },
                      })
                    );
                  }
                }}
              >
                {comment.userId?.name || "Anonymous"}
              </p>
              
              {isOwnComment && !isEditingComment && (
                <div className="relative leading-none self-start" ref={commentMenuRef}>
                  <button
                    onClick={() => setShowCommentMenu(!showCommentMenu)}
                    className="p-0.5 rounded-full hover:bg-white/10 text-[#9fa0b8] hover:text-white transition-colors animate-fade-in"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                  
                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {showCommentMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        transition={{ duration: 0.1 }}
                        className="absolute right-0 top-full mt-1 w-24 bg-[#111115] border border-[#2a2a35] rounded-lg shadow-xl overflow-hidden z-50"
                      >
                        <button
                          onClick={() => {
                            setShowCommentMenu(false);
                            setEditContent(comment.content);
                            setIsEditingComment(true);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-[11px] text-white hover:bg-[#1a1a22] transition-colors text-left"
                        >
                          <Pencil className="w-3 h-3 text-[#9fa0b8]" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setShowCommentMenu(false);
                            setShowDeleteConfirm(true);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-[11px] text-red-400 hover:bg-[#1a1a22] transition-colors text-left"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {isEditingComment ? (
              <div className="mt-1 flex flex-col gap-2 min-w-[200px] sm:min-w-[300px]">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-[#0e0e12] border border-white/10 rounded-lg px-2 py-1 text-[13px] text-white focus:outline-none focus:border-brand resize-y min-h-[60px]"
                  placeholder="Edit your comment..."
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditingComment(false)}
                    className="px-2.5 py-1 text-[11px] text-[#9fa0b8] hover:text-white rounded border border-white/10 hover:bg-white/5 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit || !editContent.trim()}
                    className="px-2.5 py-1 text-[11px] bg-brand text-brand-foreground font-semibold rounded hover:bg-brand/90 disabled:opacity-50 transition-colors"
                  >
                    {isSavingEdit ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              comment.content && (
                <p className="text-[#e4e4e7] text-[13px] mt-0.5 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              )
            )}
            {/* Comment Attachments */}
            {comment.attachments && comment.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {comment.attachments.map((attachment, idx) => (
                  <div key={idx}>
                    {attachment.type === "audio" ? (
                      <div className="w-full max-w-[200px]">
                        <VoiceMessagePlayer src={attachment.url} isOwnMessage={false} />
                      </div>
                    ) : (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-[#0e0e12]">
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          className="w-full h-full object-cover"
                        />
                        {attachment.type === "gif" && (
                          <div className="absolute bottom-0.5 left-0.5 bg-black/70 px-1 py-0.5 rounded text-[8px] font-bold text-white">
                            GIF
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Comment Reactions pill inside bubble bottom right if count > 0 */}
            {comment.reactionsCount && comment.reactionsCount.total > 0 && (
              <div className="absolute right-2 -bottom-2 bg-[#202027] border border-[#2a2a35] rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-lg text-[10px] text-white font-medium select-none z-10">
                <div className="flex items-center -space-x-0.5">
                  {Object.entries(comment.reactionsCount)
                    .filter(([type, count]) => type !== "total" && count > 0)
                    .slice(0, 3)
                    .map(([type]) => (
                      <span key={type}>{REACTION_EMOJIS[type as ReactionType]}</span>
                    ))}
                </div>
                <span>{comment.reactionsCount.total}</span>
              </div>
            )}
          </div>

          {/* Actions Row */}
          <div className="flex items-center gap-3.5 mt-1 ml-3 select-none">
            <span className="text-[11px] text-[#9fa0b8]">
              {getRelativeTime(new Date(comment.createdAt))}
            </span>
            <div className="flex items-center gap-2">
              <ReactionPicker
                userReaction={comment.userReaction}
                onReact={handleReactComment}
              >
                <button
                  className={cn(
                    "text-[11px] font-semibold transition-colors",
                    comment.userReaction
                      ? "text-brand hover:text-brand/90"
                      : "text-[#9fa0b8] hover:text-white"
                  )}
                >
                  {comment.userReaction
                    ? REACTION_LABELS[comment.userReaction]
                    : "Like"}
                </button>
              </ReactionPicker>
            </div>
            <span className="text-[#3a3a45] text-xs leading-none">&middot;</span>
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="text-[11px] text-[#9fa0b8] hover:text-white font-semibold transition-colors"
            >
              Reply
            </button>
          </div>

          {/* Reply Input */}
          {showReplyInput && (
            <div className="mt-2">
              <CommentInput
                user={currentUser}
                onSubmit={handleReply}
                placeholder={`Reply to ${comment.userId?.name || "Anonymous"}...`}
                autoFocus
              />
            </div>
          )}
        </div>
      </div>

      {/* Modern Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111115] border border-[#2a2a35] rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl"
            >
              <h3 className="text-white font-semibold text-base mb-2">Delete Comment</h3>
              <p className="text-[#9fa0b8] text-sm mb-5 leading-relaxed">
                Are you sure you want to delete this comment? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm text-[#9fa0b8] hover:text-white rounded-lg border border-white/10 hover:bg-white/5 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    handleDeleteConfirm();
                  }}
                  className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-red-500/25"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Nested replies — recursive, each level indented with a thread line */}
      {replies.length > 0 && (
        <div className="ml-4 mt-2 border-l border-white/10 pl-3">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1.5 text-[12px] text-[#9fa0b8] hover:text-white font-semibold transition-colors mb-2"
          >
            {showReplies ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showReplies ? "Hide" : "View"} {totalReplies} {totalReplies === 1 ? "reply" : "replies"}
          </button>

          {showReplies && (
            <div className="space-y-3">
              {replies.map((reply) => (
                <CommentItem
                  key={reply._id}
                  comment={reply}
                  onReply={onReply}
                  currentUser={currentUser}
                  depth={depth + 1}
                  onEditComment={onEditComment}
                  onDeleteComment={onDeleteComment}
                  onReactComment={onReactComment}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CommentThreadProps {
  comment: CommentWithReplies;
  onReply: (parentCommentId: string, content: string, attachments: CommentAttachment[]) => Promise<void>;
  currentUser: {
    userId?: string;
    name: string;
    email?: string;
    profilePicture?: string;
  };
  onEditComment?: (commentId: string, newContent: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onReactComment?: (commentId: string, reactionType: ReactionType) => Promise<void>;
}

export function CommentThread({ comment, onReply, currentUser, onEditComment, onDeleteComment, onReactComment }: CommentThreadProps) {
  return (
    <CommentItem
      comment={comment}
      onReply={onReply}
      currentUser={currentUser}
      depth={0}
      onEditComment={onEditComment}
      onDeleteComment={onDeleteComment}
      onReactComment={onReactComment}
    />
  );
}

/**
 * Build a nested comment tree of unlimited depth from a flat list, linking each comment to its
 * parent via `parentCommentId`. Replies at every level are sorted oldest-first.
 */
export function groupCommentsIntoThreads(comments: Comment[]): CommentWithReplies[] {
  const nodes = new Map<string, CommentWithReplies>();
  comments.forEach((c) => nodes.set(c._id, { ...c, replies: [] }));

  const roots: CommentWithReplies[] = [];
  comments.forEach((c) => {
    const node = nodes.get(c._id)!;
    const pid = parentId(c);
    const parent = pid ? nodes.get(pid) : undefined;
    if (parent) {
      parent.replies!.push(node);
    } else {
      // Top-level comment (or parent not in this list → surface it rather than dropping it)
      roots.push(node);
    }
  });

  const sortTree = (node: CommentWithReplies) => {
    if (node.replies && node.replies.length > 0) {
      node.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      node.replies.forEach(sortTree);
    }
  };
  roots.forEach(sortTree);

  return roots;
}
