"use client";

import { useCallback, useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { StarRating } from "./StarRating";
import { WriteReviewDialog } from "./WriteReviewDialog";
import { openReviewsPanel } from "./openReviewsPanel";
import { cn } from "@/lib/utils";
import {
  RatingSummary,
  MyReviewResult,
  ReviewTargetType,
  emptySummary,
  formatReviewCount,
  getMyReview,
  getRatingSummary,
  NO_REVIEW_ACCESS,
} from "@/lib/reviews-api";

interface RatingsReviewsCardProps {
  targetType: ReviewTargetType;
  targetId: string;
  /** Shown as the sidebar heading when "See all" is clicked. */
  targetName?: string;
  /**
   * Set false on browse-side surfaces (product detail, course detail) where
   * the write entry point has been moved to the surface the buyer owns — the
   * order page for a product, the course view page for a course. The card
   * still shows the average and "See all".
   */
  showWriteButton?: boolean;
  className?: string;
}

/**
 * The compact "Ratings & Reviews" card that sits under the About card on a
 * community page: average, stars, review count, a "See all" link that opens
 * the full panel in the right sidebar, and the write-a-review entry point.
 */
export function RatingsReviewsCard({
  targetType,
  targetId,
  targetName,
  showWriteButton = true,
  className,
}: RatingsReviewsCardProps) {
  const [summary, setSummary] = useState<RatingSummary>(() =>
    emptySummary(targetType, targetId)
  );
  const [mine, setMine] = useState<MyReviewResult>(NO_REVIEW_ACCESS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const myReview = mine.review;

  const refresh = useCallback(() => {
    if (!targetId) return;

    getRatingSummary(targetType, targetId)
      .then(setSummary)
      .catch(() => setSummary(emptySummary(targetType, targetId)));

    // Only needed to decide whether to offer the write button — skip the
    // round trip on the surfaces that don't show one.
    if (!showWriteButton) return;

    // A signed-out viewer 401s here — expected, they just get no write button.
    getMyReview(targetType, targetId)
      .then(setMine)
      .catch(() => setMine(NO_REVIEW_ACCESS));
  }, [targetType, targetId, showWriteButton]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep the card in step when a review is submitted from the sidebar panel.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ targetId?: string }>).detail;
      if (!detail?.targetId || detail.targetId === targetId) refresh();
    };
    window.addEventListener("reviews:changed", onChanged);
    return () => window.removeEventListener("reviews:changed", onChanged);
  }, [targetId, refresh]);

  if (!targetId) return null;

  const hasReviews = summary.count > 0;

  return (
    <div
      className={cn(
        // Matches the feed post card surface (FeedComponents.tsx PostCard).
        "bg-[#111115] border border-[#2a2a35] rounded-2xl p-5 shadow-lg space-y-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Ratings &amp; Reviews</h2>
        <button
          type="button"
          onClick={() =>
            openReviewsPanel({ targetType, targetId, title: targetName })
          }
          className="text-brand hover:underline font-semibold text-sm cursor-pointer bg-transparent border-0 p-0 shrink-0"
        >
          See all
        </button>
      </div>

      {hasReviews ? (
        <div className="flex items-center gap-3 flex-wrap">
          <StarRating value={summary.average} size={15} />
          <span className="text-2xl font-bold text-white leading-none">
            {summary.average.toFixed(1)}
          </span>
          <span className="text-xs text-[#8a8a9b]">out of 5</span>
          <span className="text-xs text-[#8a8a9b] ml-auto">
            Based on {formatReviewCount(summary.count)} review
            {summary.count === 1 ? "" : "s"}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <StarRating value={0} size={15} />
          <span className="text-xs text-[#8a8a9b]">No reviews yet</span>
        </div>
      )}

      {showWriteButton && mine.canReview && (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-brand/40 bg-brand/[0.07] text-brand text-sm font-semibold hover:bg-brand/[0.13] transition-colors cursor-pointer"
        >
          <PenLine className="w-4 h-4" />
          {myReview ? "Edit your review" : "Write a Review"}
        </button>
      )}

      <WriteReviewDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        targetType={targetType}
        targetId={targetId}
        existingReview={myReview}
        onSubmitted={() => {
          refresh();
          window.dispatchEvent(
            new CustomEvent("reviews:changed", { detail: { targetId } })
          );
        }}
      />
    </div>
  );
}
