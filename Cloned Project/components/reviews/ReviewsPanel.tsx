"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpDown, Loader2 } from "lucide-react";
import { RatingBreakdown } from "./RatingBreakdown";
import { ReviewCard } from "./ReviewCard";
import { WriteReviewDialog } from "./WriteReviewDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Review,
  ReviewSort,
  ReviewTargetType,
  RatingSummary,
  StarKey,
  emptySummary,
  listReviews,
  deleteReview,
  removeReviewComment,
} from "@/lib/reviews-api";

const PAGE_SIZE = 10;

// Short labels — the trigger sits in a narrow pinned slot, so "Most recent"
// would push the star chips out of the row.
const SORTS: { value: ReviewSort; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "helpful", label: "Helpful" },
  { value: "highest", label: "Highest" },
  { value: "lowest", label: "Lowest" },
];

const RATING_FILTERS: (StarKey | null)[] = [null, 5, 4, 3, 2, 1];

interface ReviewsPanelProps {
  targetType: ReviewTargetType;
  targetId: string;
  /** Hides the internal heading when the host already renders one. */
  showHeader?: boolean;
  className?: string;
  /**
   * Viewer is a founder of the org that owns this target — surfaces a delete
   * control on every review, not just their own. The backend enforces the same
   * rule, so passing this wrongly gets a 403 rather than an unauthorized delete.
   */
  canModerate?: boolean;
}

/**
 * The full reviews experience: summary breakdown, star/sort filters and the
 * paginated list.
 *
 * Read-only as far as *writing* goes — there is deliberately no
 * write-a-review button here. A review is written from the surface where the
 * viewer owns the thing (the order page for a product, the course view page
 * for a course, the community page for a channel), never from the browse-side
 * "See all". Editing your own review still works, from the card's own menu.
 */
export function ReviewsPanel({
  targetType,
  targetId,
  showHeader = true,
  className,
  canModerate = false,
}: ReviewsPanelProps) {
  const [summary, setSummary] = useState<RatingSummary>(() =>
    emptySummary(targetType, targetId)
  );
  const [reviews, setReviews] = useState<Review[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<ReviewSort>("recent");
  const [ratingFilter, setRatingFilter] = useState<StarKey | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Review | null>(null);

  const load = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (!targetId) return;
      replace ? setLoading(true) : setLoadingMore(true);
      setError(null);

      try {
        const result = await listReviews(targetType, targetId, {
          page: targetPage,
          limit: PAGE_SIZE,
          sort,
          rating: ratingFilter ?? undefined,
        });

        setSummary(result.summary);
        setTotalPages(result.totalPages);
        setPage(result.page);
        setReviews((prev) =>
          replace ? result.reviews : [...prev, ...result.reviews]
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't load reviews"
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [targetType, targetId, sort, ratingFilter]
  );

  // Reload from page 1 whenever the target or the filters change.
  useEffect(() => {
    load(1, true);
  }, [load]);

  // Every write path (edit here, write from an order/course page) moves the
  // average, so tell the cards elsewhere on screen to re-fetch their summary.
  function announceChange() {
    window.dispatchEvent(
      new CustomEvent("reviews:changed", { detail: { targetId } })
    );
  }

  function handleSubmitted() {
    setEditing(null);
    load(1, true);
    announceChange();
  }

  async function handleDelete(review: Review) {
    if (!window.confirm("Delete your review?")) return;
    try {
      await deleteReview(review._id);
      load(1, true);
      announceChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete review");
    }
  }

  /**
   * The founder's take-down. The rating survives, so the row is swapped in
   * place rather than reloaded — and no `announceChange()`, because no average
   * moved.
   */
  async function handleRemoveComment(review: Review) {
    if (
      !window.confirm(
        `Remove the comment and screenshots from ${review.reviewerName}'s review?\n\n` +
          `Their ${review.rating}-star rating stays and still counts toward the average. This can't be undone.`
      )
    ) {
      return;
    }

    try {
      const updated = await removeReviewComment(review._id);
      setReviews((prev) =>
        prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove comment");
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {showHeader && (
        <h2 className="text-lg font-bold text-white">Reviews</h2>
      )}

      <RatingBreakdown summary={summary} />

      {/* Filter + sort bar.
          Only the star chips scroll; the sort control is pinned to the right
          so it can never scroll out of reach in a narrow panel. A fade on the
          right edge signals there is more to scroll to. */}
      <div className="bg-[#111115] border border-[#2a2a35] rounded-xl p-1.5 flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1 w-max pr-5">
              {RATING_FILTERS.map((value) => (
                <button
                  key={value ?? "all"}
                  type="button"
                  onClick={() => setRatingFilter(value)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0",
                    ratingFilter === value
                      ? "bg-[#2a2a35] text-white"
                      : "text-[#8a8a9b] hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  {value === null ? "All" : `${value} Stars`}
                </button>
              ))}
            </div>
          </div>

          {/* Scroll affordance — matches the bar's own background. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#111115] to-transparent"
          />
        </div>

        <div className="w-px self-stretch bg-[#2a2a35] shrink-0" />

        <Select value={sort} onValueChange={(v) => setSort(v as ReviewSort)}>
          <SelectTrigger
            aria-label="Sort reviews"
            className="h-7 w-auto shrink-0 gap-1.5 border-0 bg-transparent px-2 text-xs text-[#8a8a9b] shadow-none hover:text-white focus:ring-0 focus:ring-offset-0 [&>svg]:opacity-60"
          >
            <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            align="end"
            className="bg-[#141419] border-transparent ring-1 ring-white/[0.06] text-white shadow-2xl shadow-black/60"
          >
            {SORTS.map((s) => (
              <SelectItem
                key={s.value}
                value={s.value}
                className="text-xs focus:bg-white/[0.06] focus:text-white"
              >
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 text-[#8a8a9b] animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 px-4">
          <p className="text-sm text-[#8a8a9b]">
            {ratingFilter
              ? `No ${ratingFilter}-star reviews yet.`
              : "No reviews yet be the first to share what you think."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review._id}
              review={review}
              canModerate={canModerate}
              onEdit={(r) => {
                setEditing(r);
                setDialogOpen(true);
              }}
              onDelete={handleDelete}
              onRemoveComment={handleRemoveComment}
              onVoteChange={(updated) =>
                setReviews((prev) =>
                  prev.map((r) => (r._id === updated._id ? updated : r))
                )
              }
            />
          ))}

          {page < totalPages && (
            <button
              type="button"
              onClick={() => load(page + 1, false)}
              disabled={loadingMore}
              className="w-full py-2.5 rounded-xl border border-[#2a2a35] bg-[#1a1a22] text-sm font-medium text-[#c4c4d4] hover:bg-[#2a2a35] transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Load more reviews
            </button>
          )}
        </div>
      )}

      <WriteReviewDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        targetType={targetType}
        targetId={targetId}
        existingReview={editing}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}
