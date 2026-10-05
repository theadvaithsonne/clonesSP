"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessagesSquare, ShieldAlert } from "lucide-react";
import { ReviewCard } from "./ReviewCard";
import { REVIEW_TARGET_ICONS } from "./targetIcons";
import { cn } from "@/lib/utils";
import {
  ModerationReview,
  ReviewTargetType,
  REVIEW_TARGET_LABELS,
  listOrgReviews,
  removeReviewComment,
} from "@/lib/reviews-api";

const PAGE_SIZE = 15;

/**
 * Filter chips. `null` is "everything", then one chip per reviewable thing so
 * a founder can go straight to, say, digital products.
 *
 * Workshops, services and 1:1 calls are deliberately absent: they're still
 * reviewable and their reviews still show under "All", there's just no chip to
 * narrow to them.
 */
const FILTERS: (ReviewTargetType | null)[] = [
  null,
  "office",
  "channel",
  "course",
  "product",
];

interface ReviewsModerationListProps {
  orgId: string;
  className?: string;
}

/** The type's icon, or nothing if the type is one this build doesn't know. */
function TargetIcon({
  targetType,
  className,
}: {
  targetType: ReviewTargetType;
  className?: string;
}) {
  const Icon = REVIEW_TARGET_ICONS[targetType];
  if (!Icon) return null;
  return <Icon className={className} aria-hidden="true" />;
}

/**
 * Every review across the org, newest first — the founder's cross-product view.
 *
 * The only action here is taking down a review's comment and screenshots. The
 * star rating survives and keeps counting toward the average, so moderating
 * what someone wrote can't quietly improve the score — and the review stays in
 * the list, marked as removed, rather than vanishing.
 *
 * Founders can't edit a review either: rewriting a member's words would make
 * the ratings worthless. `DELETE /reviews/:reviewId/comment` enforces the same
 * split server-side, so this UI is a convenience over the permission, not the
 * permission itself.
 */
export function ReviewsModerationList({
  orgId,
  className,
}: ReviewsModerationListProps) {
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [filter, setFilter] = useState<ReviewTargetType | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (!orgId) return;
      replace ? setLoading(true) : setLoadingMore(true);
      setError(null);

      try {
        const result = await listOrgReviews(orgId, {
          page: targetPage,
          limit: PAGE_SIZE,
          targetType: filter ?? undefined,
        });

        setTotal(result.total);
        setTotalPages(result.totalPages);
        setPage(result.page);
        setReviews((prev) =>
          replace ? result.reviews : [...prev, ...result.reviews]
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load reviews");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [orgId, filter]
  );

  // Reload from page 1 whenever the org or the type filter changes.
  useEffect(() => {
    load(1, true);
  }, [load]);

  async function handleRemoveComment(review: ModerationReview) {
    const what = review.targetName
      ? `on ${review.targetName}`
      : `on this ${review.targetLabel || "item"}`;
    if (
      !window.confirm(
        `Remove the comment and screenshots from ${review.reviewerName}'s review ${what}?\n\n` +
          `Their ${review.rating}-star rating stays and still counts toward the average. This can't be undone.`
      )
    ) {
      return;
    }

    setRemovingId(review._id);
    setError(null);
    try {
      const updated = await removeReviewComment(review._id);
      // Swap in place — the review is still there, it just lost its words, so
      // dropping the row would misrepresent what happened.
      setReviews((prev) =>
        prev.map((r) =>
          r._id === review._id ? { ...r, ...updated } : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove comment");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Type filter */}
      <div className="lg-panel rounded-2xl p-1.5">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 w-max">
            {FILTERS.map((value) => (
              <button
                key={value ?? "all"}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "lg-chip px-2.5 py-1 rounded-xl text-xs font-medium cursor-pointer whitespace-nowrap shrink-0",
                  filter === value
                    ? "lg-chip-active text-white"
                    : "text-[#9a9aab] hover:text-white"
                )}
              >
                {value === null ? "All" : REVIEW_TARGET_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!loading && (
        <p className="text-[11px] text-[#7a7a8a]">
          {total === 0
            ? "No reviews yet"
            : `${total.toLocaleString()} review${total === 1 ? "" : "s"}`}
        </p>
      )}

      {error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-400/25 rounded-xl px-3 py-2 backdrop-blur-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 text-[#9a9aab] animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="lg-panel rounded-2xl px-4 py-8 text-center">
          <MessagesSquare className="w-5 h-5 text-[#7a7a8a] mx-auto mb-2" />
          <p className="text-sm text-[#e2e2ea] font-medium">
            {filter
              ? `No reviews on your ${REVIEW_TARGET_LABELS[filter].toLowerCase()}s yet`
              : "No reviews yet"}
          </p>
          <p className="text-xs text-[#8a8a9b] mt-1">
            {filter
              ? "Try another type, or clear the filter to see everything."
              : "When members review anything in this office, it shows up here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review._id}
              className={cn(
                "transition-opacity",
                removingId === review._id && "opacity-50 pointer-events-none"
              )}
            >
              {/* What this review is attached to, as a strip joined to the card
                  below it — a founder scans this list by product, so the
                  context has to read as part of the review, not float above
                  it. */}
              <div className="lg-card-header flex items-center gap-2 px-3 py-1.5 rounded-t-2xl">
                <TargetIcon
                  targetType={review.targetType}
                  className="w-3.5 h-3.5 text-[#9a9aab] shrink-0"
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9a9aab] shrink-0">
                  {REVIEW_TARGET_LABELS[review.targetType] ||
                    review.targetLabel ||
                    review.targetType}
                </span>
                <span className="text-xs text-[#e2e2ea] truncate min-w-0 flex-1">
                  {review.targetName || (
                    <span className="text-[#8a8a9b] italic">Deleted item</span>
                  )}
                </span>
                {review.status !== "published" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300 shrink-0">
                    <ShieldAlert className="w-3 h-3" />
                    {review.status}
                  </span>
                )}
              </div>

              <ReviewCard
                review={review}
                canModerate
                showVotes={false}
                onRemoveComment={() => handleRemoveComment(review)}
                className="lg-card rounded-t-none"
              />
            </div>
          ))}

          {page < totalPages && (
            <button
              type="button"
              onClick={() => load(page + 1, false)}
              disabled={loadingMore}
              className="lg-btn w-full py-2.5 rounded-2xl text-sm font-medium text-[#e2e2ea] hover:text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
