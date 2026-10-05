"use client";

import { StarRating } from "./StarRating";
import { openReviewsPanel } from "./openReviewsPanel";
import { cn } from "@/lib/utils";
import {
  RatingSummary,
  ReviewTargetType,
  formatReviewCount,
} from "@/lib/reviews-api";

interface CardRatingRowProps {
  targetType: ReviewTargetType;
  targetId: string;
  /** Undefined while the batched summaries are still loading. */
  summary?: RatingSummary;
  /** Heading for the sidebar when "See all" is clicked. */
  targetName?: string;
  className?: string;
}

/**
 * The one-line rating row on a Discover card:
 *
 *   ★★★★★  4.8  (128 reviews)                              See all
 *
 * Reserves its height even with no reviews and while loading, so cards in a
 * grid don't jump as summaries arrive.
 */
export function CardRatingRow({
  targetType,
  targetId,
  summary,
  targetName,
  className,
}: CardRatingRowProps) {
  const loading = summary === undefined;
  const count = summary?.count ?? 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 min-h-[20px] w-full",
        className
      )}
    >
      {loading ? (
        <div className="h-3 w-32 rounded bg-white/[0.06] animate-pulse" />
      ) : count === 0 ? (
        <>
          <StarRating value={0} size={13} />
          <span className="text-xs text-[#6b6b7b]">No reviews</span>
        </>
      ) : (
        <>
          <StarRating value={summary!.average} size={13} />
          <span className="text-sm font-semibold text-white leading-none">
            {summary!.average.toFixed(1)}
          </span>
          <span className="text-xs text-[#8a8a9b]">
            ({formatReviewCount(count)} review{count === 1 ? "" : "s"})
          </span>
        </>
      )}

      {!loading && (
        <button
          type="button"
          onClick={(e) => {
            // Cards are clickable — don't trigger the card's own navigation.
            e.stopPropagation();
            openReviewsPanel({ targetType, targetId, title: targetName });
          }}
          className="ml-auto text-xs font-medium text-[#4d9fff] hover:underline cursor-pointer bg-transparent border-0 p-0 shrink-0"
        >
          See all
        </button>
      )}
    </div>
  );
}
