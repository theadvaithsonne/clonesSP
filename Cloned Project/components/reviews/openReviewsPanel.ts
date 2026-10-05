import { ReviewTargetType } from "@/lib/reviews-api";

export interface OpenReviewsPanelDetail {
  targetType: ReviewTargetType;
  targetId: string;
  /** Heading shown above the panel, e.g. the community name. */
  title?: string;
}

/**
 * Open the full reviews view in the right sidebar.
 *
 * Uses the same window-event convention as the panel's other entry points
 * (`right-panel:open-information`, `right-panel:open-video-player`), so a
 * caller anywhere in the tree can open it without prop drilling.
 */
export function openReviewsPanel(detail: OpenReviewsPanelDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("right-panel:open-reviews", { detail })
  );
}
