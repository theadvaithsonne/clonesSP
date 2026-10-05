// Reviews & Ratings API client — connects to the backend /reviews endpoints.
// See garagenew-backend/REVIEWS_RATINGS_API.md for the full contract.

import { getToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ============= Types =============

export const REVIEW_TARGET_TYPES = [
  "channel",
  "course",
  "product",
  "workshop",
  "service",
  "call",
  "office",
] as const;
export type ReviewTargetType = (typeof REVIEW_TARGET_TYPES)[number];

/** Plural labels for the moderation filter chips and row captions. */
export const REVIEW_TARGET_LABELS: Record<ReviewTargetType, string> = {
  channel: "Community",
  course: "Course",
  product: "Digital Product",
  workshop: "Workshop",
  service: "Service",
  call: "1:1 Call",
  office: "Office",
};

export type ReviewStatus = "published" | "pending" | "hidden";
export type ReviewVoteValue = "helpful" | "unhelpful";
export type ReviewSort = "recent" | "helpful" | "highest" | "lowest";

export type StarKey = 1 | 2 | 3 | 4 | 5;

export interface RatingSummary {
  targetType: ReviewTargetType;
  targetId: string;
  /** Mean rating, 2dp. 0 when there are no reviews. */
  average: number;
  /** Reviews behind `average`. */
  count: number;
  /** Raw count per star. */
  distribution: Record<StarKey, number>;
  /** Share per star, 0-100 to 1dp. Derived server-side from the counts. */
  distributionPercent: Record<StarKey, number>;
  verifiedCount: number;
  ownerReviewCount: number;
  lastReviewAt: string | null;
}

export interface Review {
  _id: string;
  targetType: ReviewTargetType;
  targetId: string;
  organizationId: string;
  userId: string;
  rating: number;
  title?: string;
  body: string;
  images: string[];
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  isVerifiedPurchase: boolean;
  isOwnerReview: boolean;
  helpfulCount: number;
  notHelpfulCount: number;
  status: ReviewStatus;
  editedAt?: string | null;
  /**
   * Set when the comment text and attachments were taken down and the rating
   * kept. Lets the card say "comment removed" instead of rendering a blank
   * where the review used to be.
   */
  commentRemovedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on list responses when the caller is signed in. */
  isMine?: boolean;
  viewerVote?: ReviewVoteValue | null;
}

export interface ReviewListResult {
  reviews: Review[];
  total: number;
  page: number;
  totalPages: number;
  summary: RatingSummary;
}

/** A zeroed summary — used before the first load and for targets with no reviews. */
export function emptySummary(
  targetType: ReviewTargetType,
  targetId: string
): RatingSummary {
  return {
    targetType,
    targetId,
    average: 0,
    count: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    distributionPercent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    verifiedCount: 0,
    ownerReviewCount: 0,
    lastReviewAt: null,
  };
}

// ============= Transport =============

async function fetchFromBackend<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      error.error || error.message || error.details || `API Error: ${response.status}`
    );
  }

  return response.json();
}

// ============= Summaries =============

/**
 * Batched summaries for a grid of cards — one round trip for the whole
 * Discover page instead of one request per card. Ids with no reviews come
 * back zeroed, so callers can index the result directly.
 */
export async function getRatingSummaries(
  targetType: ReviewTargetType,
  targetIds: string[]
): Promise<Record<string, RatingSummary>> {
  if (targetIds.length === 0) return {};

  const result = await fetchFromBackend<{
    success: boolean;
    summaries: Record<string, RatingSummary>;
  }>("/reviews/summaries", {
    method: "POST",
    body: JSON.stringify({ targetType, targetIds }),
  });

  return result.summaries || {};
}

export async function getRatingSummary(
  targetType: ReviewTargetType,
  targetId: string
): Promise<RatingSummary> {
  const result = await fetchFromBackend<{
    success: boolean;
    summary: RatingSummary;
  }>(`/reviews/targets/${targetType}/${targetId}/summary`);
  return result.summary;
}

// ============= Reviews =============

export interface ListReviewsParams {
  page?: number;
  limit?: number;
  sort?: ReviewSort;
  /** Filter to one star value — powers the "5 Stars" / "4 Stars" chips. */
  rating?: StarKey;
  verifiedOnly?: boolean;
}

export async function listReviews(
  targetType: ReviewTargetType,
  targetId: string,
  params: ListReviewsParams = {}
): Promise<ReviewListResult> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.sort) qs.set("sort", params.sort);
  if (params.rating) qs.set("rating", String(params.rating));
  if (params.verifiedOnly) qs.set("verifiedOnly", "true");

  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  const result = await fetchFromBackend<{ success: boolean } & ReviewListResult>(
    `/reviews/targets/${targetType}/${targetId}${suffix}`
  );

  return {
    reviews: result.reviews || [],
    total: result.total || 0,
    page: result.page || 1,
    totalPages: result.totalPages || 1,
    summary: result.summary,
  };
}

export type ReviewIneligibleReason =
  | "ok"
  | "target_missing"
  | "no_access"
  | "owner";

export interface ReviewEligibility {
  canReview: boolean;
  hasAccess: boolean;
  isOwner: boolean;
  isVerifiedPurchase: boolean;
  reason: ReviewIneligibleReason;
}

export interface MyReviewResult {
  review: Review | null;
  /**
   * Whether to show a write-a-review entry point at all.
   *
   * Comes from the server because it depends on membership in THIS community
   * — a viewer browsing Discover sees communities they haven't joined, and an
   * org-level role tells you nothing about access to a specific one.
   */
  canReview: boolean;
  eligibility: ReviewEligibility;
}

const DENIED_ELIGIBILITY: ReviewEligibility = {
  canReview: false,
  hasAccess: false,
  isOwner: false,
  isVerifiedPurchase: false,
  reason: "no_access",
};

/** The signed-in user's own review plus whether they may write one. */
export async function getMyReview(
  targetType: ReviewTargetType,
  targetId: string
): Promise<MyReviewResult> {
  const result = await fetchFromBackend<{
    success: boolean;
    review: Review | null;
    canReview: boolean;
    eligibility: ReviewEligibility;
  }>(`/reviews/targets/${targetType}/${targetId}/mine`);

  return {
    review: result.review,
    canReview: Boolean(result.canReview),
    eligibility: result.eligibility || DENIED_ELIGIBILITY,
  };
}

/** Signed-out / errored callers get a safe "cannot review" result. */
export const NO_REVIEW_ACCESS: MyReviewResult = {
  review: null,
  canReview: false,
  eligibility: DENIED_ELIGIBILITY,
};

export interface SubmitReviewInput {
  rating: number;
  body: string;
  title?: string;
  images?: string[];
}

export async function createReview(
  targetType: ReviewTargetType,
  targetId: string,
  input: SubmitReviewInput
): Promise<Review> {
  const result = await fetchFromBackend<{ success: boolean; review: Review }>(
    `/reviews/targets/${targetType}/${targetId}`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return result.review;
}

export async function updateReview(
  reviewId: string,
  input: Partial<SubmitReviewInput>
): Promise<Review> {
  const result = await fetchFromBackend<{ success: boolean; review: Review }>(
    `/reviews/${reviewId}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return result.review;
}

export async function deleteReview(reviewId: string): Promise<void> {
  await fetchFromBackend<{ success: boolean }>(`/reviews/${reviewId}`, {
    method: "DELETE",
  });
}

/**
 * Take down a review's comment text and every attached screenshot, keeping the
 * star rating — the founder's moderation action, and the author's own "unsay
 * it but keep my score" path.
 *
 * Narrower than `deleteReview` on purpose: the rating stays in the average, so
 * removing what someone wrote can't quietly improve the score. Returns the
 * updated review so the caller can swap it in place rather than refetching.
 */
export async function removeReviewComment(reviewId: string): Promise<Review> {
  const result = await fetchFromBackend<{ success: boolean; review: Review }>(
    `/reviews/${reviewId}/comment`,
    { method: "DELETE" }
  );
  return result.review;
}

// ============= Founder moderation =============

/**
 * A moderation-queue row: a review plus what it's attached to.
 *
 * `targetName` is resolved server-side so the founder can tell one review from
 * another without a lookup per row. It's null when the reviewed thing has since
 * been deleted — render `targetLabel` alone in that case.
 */
export interface ModerationReview extends Review {
  targetName: string | null;
  targetLabel?: string;
}

export interface ListOrgReviewsParams {
  page?: number;
  limit?: number;
  /** Narrow to one product type — powers the moderation filter chips. */
  targetType?: ReviewTargetType;
  status?: ReviewStatus;
}

export interface OrgReviewsResult {
  reviews: ModerationReview[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Every review across one org, newest first — the founder's cross-product view.
 *
 * Founder-only: the backend 403s anyone else, so callers should gate the entry
 * point on the founder check rather than relying on an empty list.
 */
export async function listOrgReviews(
  orgId: string,
  params: ListOrgReviewsParams = {}
): Promise<OrgReviewsResult> {
  const qs = new URLSearchParams({ orgId });
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.targetType) qs.set("targetType", params.targetType);
  if (params.status) qs.set("status", params.status);

  const result = await fetchFromBackend<
    { success: boolean } & OrgReviewsResult
  >(`/reviews/moderation?${qs.toString()}`);

  return {
    reviews: result.reviews || [],
    total: result.total || 0,
    page: result.page || 1,
    totalPages: result.totalPages || 1,
  };
}

// ============= Votes =============

export interface VoteResult {
  helpfulCount: number;
  notHelpfulCount: number;
  viewerVote: ReviewVoteValue | null;
}

/**
 * Set, switch or clear the caller's Helpful / Unhelpful vote.
 * Pass `null` to clear — that's what tapping the active button does.
 */
export async function voteOnReview(
  reviewId: string,
  vote: ReviewVoteValue | null
): Promise<VoteResult> {
  const result = await fetchFromBackend<{ success: boolean } & VoteResult>(
    `/reviews/${reviewId}/vote`,
    { method: "PUT", body: JSON.stringify({ vote }) }
  );
  return {
    helpfulCount: result.helpfulCount,
    notHelpfulCount: result.notHelpfulCount,
    viewerVote: result.viewerVote,
  };
}

// ============= Display helpers =============

/** Label beside the stars in the write-review modal: "Excellent (5/5)". */
export const RATING_LABELS: Record<StarKey, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

/** "2 hours ago" / "3 days ago" — the timestamp under a reviewer's name. */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";

  const units: [number, string][] = [
    [60, "minute"],
    [60, "hour"],
    [24, "day"],
    [7, "week"],
    [4.345, "month"],
    [12, "year"],
  ];

  let value = seconds;
  let label = "second";
  for (const [factor, name] of units) {
    if (value < factor) break;
    value = Math.floor(value / factor);
    label = name;
  }

  return `${value} ${label}${value === 1 ? "" : "s"} ago`;
}

/** "1,284 reviews" */
export function formatReviewCount(count: number): string {
  return count.toLocaleString();
}
