"use client";

import { StarRating } from "./StarRating";
import {
  RatingSummary,
  StarKey,
  formatReviewCount,
} from "@/lib/reviews-api";

const STARS: StarKey[] = [5, 4, 3, 2, 1];

/**
 * The summary block at the top of the reviews panel: the large average on the
 * left, then a divider, then one bar per star value with its percentage.
 *
 * Every number here comes from the server's RatingSummary — the percentages
 * are derived there from the raw counts, so the bar widths and the labels
 * beside them can never disagree.
 */
export function RatingBreakdown({ summary }: { summary: RatingSummary }) {
  const hasReviews = summary.count > 0;

  return (
    <div className="bg-[#111115] border border-[#2a2a35] rounded-2xl p-4 sm:p-5">
      <div className="flex items-stretch gap-4 sm:gap-5">
        {/* Average */}
        <div className="flex flex-col items-center justify-center text-center shrink-0 w-[96px] sm:w-[112px]">
          <div className="text-4xl sm:text-5xl font-bold text-white leading-none tracking-tight">
            {summary.average.toFixed(1)}
          </div>
          <StarRating value={summary.average} size={15} className="mt-2.5" />
          <div className="text-[11px] text-[#8a8a9b] mt-2">Out of 5 stars</div>
          <div className="text-[11px] text-[#8a8a9b] mt-0.5">
            {hasReviews
              ? `${formatReviewCount(summary.count)} total review${
                  summary.count === 1 ? "" : "s"
                }`
              : "No reviews yet"}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-[#2a2a35] shrink-0" aria-hidden="true" />

        {/* Per-star bars */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
          {STARS.map((star) => {
            const percent = summary.distributionPercent[star] ?? 0;
            const count = summary.distribution[star] ?? 0;

            return (
              <div key={star} className="flex items-center gap-2 sm:gap-3">
                <span className="text-[11px] text-[#c4c4d4] w-[46px] shrink-0 whitespace-nowrap">
                  {star} star{star === 1 ? "" : "s"}
                </span>

                <div
                  className="flex-1 h-2 rounded-full bg-[#2f2f3a] overflow-hidden min-w-0"
                  role="meter"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${star} star: ${count} review${
                    count === 1 ? "" : "s"
                  }`}
                >
                  <div
                    className="h-full bg-brand rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <span className="text-[11px] text-[#8a8a9b] w-[34px] text-right shrink-0 tabular-nums">
                  {/* Whole numbers read cleaner than "82.0%" */}
                  {Number.isInteger(percent) ? percent : percent.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
