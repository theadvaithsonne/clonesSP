"use client";

import { useState } from "react";
import { BadgeCheck, MessageSquareX, Pencil, Trash2 } from "lucide-react";
import { StarRating } from "./StarRating";
import { cn } from "@/lib/utils";
import {
  Review,
  ReviewVoteValue,
  voteOnReview,
  formatRelativeTime,
} from "@/lib/reviews-api";

interface ReviewCardProps {
  review: Review;
  onEdit?: (review: Review) => void;
  onDelete?: (review: Review) => void;
  /**
   * Take down the comment text and attachments, keeping the star rating.
   * Offered to founders; the author gets the fuller `onDelete` instead.
   */
  onRemoveComment?: (review: Review) => void;
  /** Lets the parent keep its copy in sync after a vote. */
  onVoteChange?: (review: Review) => void;
  /**
   * Viewer is a founder of the org that owns this review's target.
   *
   * A founder's moderation power is removing a review's words and screenshots,
   * never editing them and never removing the rating — someone who rated the
   * office 2 stars still rated it 2 stars, and taking down what they wrote must
   * not quietly improve the average. The backend enforces the same split.
   */
  canModerate?: boolean;
  /**
   * Hides the Helpful / Unhelpful pair. Off in the founder's moderation queue,
   * where the question isn't "was this useful to me" and a stray click would
   * record a real vote.
   */
  showVotes?: boolean;
  /** Lets a host join the card to a header strip above it. */
  className?: string;
}

export function ReviewCard({
  review,
  onEdit,
  onDelete,
  onRemoveComment,
  onVoteChange,
  canModerate = false,
  showVotes = true,
  className,
}: ReviewCardProps) {
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount);
  const [notHelpfulCount, setNotHelpfulCount] = useState(review.notHelpfulCount);
  const [myVote, setMyVote] = useState<ReviewVoteValue | null>(
    review.viewerVote ?? null
  );
  const [voting, setVoting] = useState(false);

  // A take-down clears the text and the screenshots together; `commentRemovedAt`
  // is what tells "moderated" apart from "hasn't loaded".
  const commentRemoved = Boolean(review.commentRemovedAt);

  const initials = (review.reviewerName || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleVote(vote: ReviewVoteValue) {
    if (voting) return;

    // Tapping the active button clears the vote.
    const next = myVote === vote ? null : vote;

    // Optimistic — the server is authoritative and we reconcile below.
    const prevState = { myVote, helpfulCount, notHelpfulCount };
    setMyVote(next);
    setHelpfulCount(
      (c) =>
        c + (next === "helpful" ? 1 : 0) - (myVote === "helpful" ? 1 : 0)
    );
    setNotHelpfulCount(
      (c) =>
        c + (next === "unhelpful" ? 1 : 0) - (myVote === "unhelpful" ? 1 : 0)
    );
    setVoting(true);

    try {
      const result = await voteOnReview(review._id, next);
      setHelpfulCount(result.helpfulCount);
      setNotHelpfulCount(result.notHelpfulCount);
      setMyVote(result.viewerVote);
      onVoteChange?.({
        ...review,
        helpfulCount: result.helpfulCount,
        notHelpfulCount: result.notHelpfulCount,
        viewerVote: result.viewerVote,
      });
    } catch {
      // Roll the optimistic update back rather than leaving a wrong count.
      setMyVote(prevState.myVote);
      setHelpfulCount(prevState.helpfulCount);
      setNotHelpfulCount(prevState.notHelpfulCount);
    } finally {
      setVoting(false);
    }
  }

  return (
    <div
      className={cn(
        "bg-[#111115] border border-[#2a2a35] rounded-2xl p-4 space-y-3",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {review.reviewerAvatar ? (
            <img
              src={review.reviewerAvatar}
              alt={review.reviewerName}
              className="w-9 h-9 rounded-full object-cover bg-[#2a2a35] shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#2a2a35] text-[#c4c4d4] text-xs font-semibold flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-white truncate">
                {review.reviewerName}
              </span>
              {review.isVerifiedPurchase && (
                <span
                  title="Verified purchase"
                  className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-400"
                >
                  <BadgeCheck className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>
            <div className="text-xs text-[#8a8a9b] mt-0.5">
              {formatRelativeTime(review.createdAt)}
              {review.editedAt ? " · edited" : ""}
            </div>
          </div>
        </div>

        <StarRating value={review.rating} size={13} className="shrink-0 mt-1" />
      </div>

      {/* Body. A moderated review keeps its stars but loses its words, so say
          so rather than rendering an unexplained gap under the rating. */}
      <div className="space-y-1.5">
        {review.title && !commentRemoved && (
          <h4 className="text-sm font-semibold text-white">{review.title}</h4>
        )}
        {commentRemoved ? (
          <p className="text-sm text-[#6a6a7a] italic">
            This comment was removed. The rating still counts.
          </p>
        ) : (
          /* Stored as plain text server-side — rendered as text, never HTML. */
          <p className="text-sm text-[#b8b8c8] leading-relaxed whitespace-pre-line break-words">
            {review.body}
          </p>
        )}
      </div>

      {/* Attachments */}
      {review.images?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.images.map((url) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              <img
                src={url}
                alt="Review attachment"
                className="w-16 h-16 rounded-lg object-cover border border-[#2a2a35] hover:border-brand/50 transition-colors"
              />
            </a>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <div
          className={cn(
            "flex items-center gap-2 flex-wrap",
            !showVotes && "hidden"
          )}
        >
          <span className="text-xs text-[#8a8a9b]">Was this helpful?</span>

          <button
            type="button"
            onClick={() => handleVote("helpful")}
            disabled={voting}
            aria-pressed={myVote === "helpful"}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border disabled:opacity-60 disabled:cursor-not-allowed",
              myVote === "helpful"
                ? "bg-brand/15 text-brand border-brand/40"
                : "bg-[#1a1a22] text-[#c4c4d4] border-[#2a2a35] hover:bg-[#2a2a35]"
            )}
          >
            Helpful{helpfulCount > 0 ? ` (${helpfulCount})` : ""}
          </button>

          <button
            type="button"
            onClick={() => handleVote("unhelpful")}
            disabled={voting}
            aria-pressed={myVote === "unhelpful"}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border",
              myVote === "unhelpful"
                ? "bg-brand/15 text-brand border-brand/40"
                : "bg-transparent text-[#8a8a9b] border-transparent hover:text-[#c4c4d4]"
            )}
          >
            Unhelpful{notHelpfulCount > 0 ? ` (${notHelpfulCount})` : ""}
          </button>
        </div>

        {(review.isMine || canModerate) && (
          <div className="flex items-center gap-1">
            {/* Editing is the author's alone, even for a moderating founder. */}
            {onEdit && review.isMine && (
              <button
                type="button"
                onClick={() => onEdit(review)}
                className="p-1.5 rounded-md text-[#8a8a9b] hover:text-white hover:bg-[#2a2a35] transition-colors cursor-pointer"
                title="Edit your review"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}

            {/* The founder's take-down: the words and screenshots go, the star
                stays. Pointless once there's nothing left to remove. */}
            {onRemoveComment && !review.isMine && !commentRemoved && (
              <button
                type="button"
                onClick={() => onRemoveComment(review)}
                className="p-1.5 rounded-md text-[#8a8a9b] hover:text-red-400 hover:bg-[#2a2a35] transition-colors cursor-pointer"
                title="Remove the comment and screenshots (the rating stays)"
              >
                <MessageSquareX className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Deleting the whole review — rating and all — stays the author's
                call. A founder moderates content, not someone's score. */}
            {onDelete && review.isMine && (
              <button
                type="button"
                onClick={() => onDelete(review)}
                className="p-1.5 rounded-md text-[#8a8a9b] hover:text-red-400 hover:bg-[#2a2a35] transition-colors cursor-pointer"
                title="Delete your review"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
