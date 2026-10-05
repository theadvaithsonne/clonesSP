import { useEffect, useState } from "react";
import {
  getRatingSummaries,
  type RatingSummary,
  type ReviewTargetType,
} from "@/lib/reviews-api";

/**
 * Rating summaries for a grid of cards, fetched in ONE batched request rather
 * than one per card.
 *
 * Returns a map keyed by target id. Ids that have no reviews yet come back as
 * zeroed summaries from the server, and ids still in flight are simply absent
 * — `CardRatingRow` renders a placeholder for `undefined`, so the grid doesn't
 * reflow as results arrive.
 *
 * A failure resolves to an empty map rather than throwing: a ratings outage
 * should cost you the star row, not the whole page of cards.
 */
export function useRatingSummaries(
  targetType: ReviewTargetType,
  ids: string[]
): Record<string, RatingSummary> {
  const [summaries, setSummaries] = useState<Record<string, RatingSummary>>({});

  // Compare by value, not identity — callers almost always pass a freshly
  // mapped array, which would re-run the effect on every render.
  const key = ids.join(",");

  useEffect(() => {
    const targetIds = key ? key.split(",") : [];
    if (targetIds.length === 0) {
      setSummaries({});
      return;
    }

    let cancelled = false;
    getRatingSummaries(targetType, targetIds)
      .then((result) => {
        if (!cancelled) setSummaries(result);
      })
      .catch(() => {
        if (!cancelled) setSummaries({});
      });

    return () => {
      cancelled = true;
    };
  }, [targetType, key]);

  return summaries;
}
