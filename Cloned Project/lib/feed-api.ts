// Feed API Client - Connects to our roam-backend /feed endpoints

import { getToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ============= Reaction Types =============

export const REACTION_TYPES = [
  "like",
  "love",
  "fire",
  "haha",
  "wow",
  "sad",
  "angry",
] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: "👍",
  love: "❤️",
  fire: "🔥",
  haha: "😆",
  wow: "😮",
  sad: "😢",
  angry: "😠",
};

export const REACTION_LABELS: Record<ReactionType, string> = {
  like: "Like",
  love: "Love",
  fire: "Fire",
  haha: "Haha",
  wow: "Wow",
  sad: "Sad",
  angry: "Angry",
};

export interface ReactionsCount {
  like: number;
  love: number;
  fire: number;
  haha: number;
  wow: number;
  sad: number;
  angry: number;
  total: number;
}

export interface PostReaction {
  user: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
  reactionType: ReactionType;
  createdAt: string;
}

// ============= Types =============

export interface ChannelBenefit {
  icon: string;
  title: string;
  description: string;
}

export interface ChannelReview {
  _id?: string;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  rating: number;
  text: string;
  helpfulCount?: number;
  createdAt?: string;
}

export interface ChannelFaq {
  question: string;
  answer: string;
}

export interface Channel {
  _id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  coverImage?: string;
  logo?: string | null;
  memberCount?: number;
  isFree: boolean;
  isSubscription: boolean;
  subscriptionPeriod: "weekly" | "monthly" | "quarterly" | "yearly";
  // Channel detail page fields
  rating?: number;
  ratingCount?: number;
  aboutText?: string;
  whatsIncluded?: string[];
  benefits?: ChannelBenefit[];
  reviews?: ChannelReview[];
  faqs?: ChannelFaq[];
  isDefault?: boolean;
  // New form fields
  galleryImages?: string[];
  videoUrl?: string;
  videoFile?: string;
  whoCanPost?: "everyone" | "admins_only";
  gstInclusive?: boolean;
  requireIosPayment?: boolean;
  appleFeeInclusive?: boolean;
  emailAlerts?: ProductEmailAlerts;
  founderAlerts?: FounderAlerts;
  // Founder-configurable post-payment page — same shape Product and
  // Course use. Rendered by InvoicePayPage on the invoice success step.
  thankYouPage?: ThankYouPage;
  createdAt?: string;
  isActive?: boolean;
}

export interface SubscribedChannel {
  channelId: string;
  channelTitle: string;
  status: string;
  joinedAt: Date;
  canPost?: boolean;
  logo?: string | null;
  memberCount?: number;
  subscriptionId?: string;
  // Set to "cancelled" when the user cancels a recurring sub; they keep
  // access until `accessUntil`. Powers the "Cancelling — access until X"
  // badge on the subscribed-channel card.
  subscriptionStatus?: "active" | "cancelled" | "expired" | null;
  accessUntil?: string | null;
}

export interface PostAttachment {
  type: "image" | "video" | "document" | "audio";
  url: string;
  name: string;
  fileKey?: string;
}

// Note: "audio" type is now natively supported by backend

// Link preview metadata stored with post
export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string | null;
  siteName?: string;
  showThumbnail?: boolean;
}

export interface PostAuthor {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

export interface PostChannel {
  _id: string;
  title: string;
}

export interface Post {
  _id: string;
  content: string;
  authorId: PostAuthor;
  channelIds: PostChannel[];
  tags?: string[];
  attachments?: PostAttachment[];
  // Link preview metadata
  linkPreviews?: LinkPreviewData[];
  likesCount: number; // Deprecated - use reactionsCount.total
  reactionsCount?: ReactionsCount;
  userReaction?: ReactionType | null;
  commentsCount: number;
  repostsCount: number;
  bookmarksCount: number;
  hasLiked?: boolean; // Deprecated - use userReaction
  hasReposted?: boolean;
  hasBookmarked?: boolean;
  // Poll support
  hasPoll?: boolean;
  poll?: Poll;
  // Quote post support
  quotedPostId?: string | QuotedPost;
  // Article support
  postType?: "post" | "article";
  title?: string;
  coverImage?: string;
  slug?: string;
  readingTimeMinutes?: number;
  // Pin support
  isPinned?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============= Poll Types =============

export interface PollOption {
  _id: string;
  text: string;
  votesCount: number;
}

export interface Poll {
  _id: string;
  postId: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  endsAt: string;
  isMultipleChoice: boolean;
  isActive: boolean;
  hasVoted?: boolean;
  userVotedOptions?: string[];
  isExpired?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PollResult {
  optionId: string;
  text: string;
  votes: number;
  percentage: number;
}

// ============= Repost Types =============

export interface PostRepost {
  _id: string;
  postId: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
  createdAt: string;
}

// ============= Quote Post Types =============

export interface QuotedPost {
  _id: string;
  content: string;
  authorId: PostAuthor;
  channelIds: PostChannel[];
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

// ============= Trending Types =============

export interface TrendingTag {
  tag: string;
  count: number;
}

export interface CommentAttachment {
  type: "image" | "gif" | "audio";
  url: string;
  name: string;
  fileKey?: string;
}

export interface Comment {
  _id: string;
  content: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
  attachments?: CommentAttachment[];
  createdAt: Date;
  parentCommentId?: string;
  reactionsCount?: ReactionsCount;
  userReaction?: ReactionType | null;
}

export interface Pagination {
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============= Helper =============

function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

async function fetchFromBackend<T>(
  endpoint: string,
  options?: RequestInit,
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
      error.error ||
        error.message ||
        error.details ||
        `API Error: ${response.status}`,
    );
  }

  return response.json();
}

// ============= Channel APIs =============

export async function getOrgChannels(
  orgId: string,
): Promise<{ channels: Channel[] }> {
  const result = await fetchFromBackend<{
    success: boolean;
    channels: Channel[];
  }>(`/feed/channels?orgId=${orgId}`);
  return { channels: result.channels };
}

export async function getSubscribedChannels(
  orgId: string,
): Promise<{ channels: SubscribedChannel[]; isFounder: boolean }> {
  const result = await fetchFromBackend<{
    success: boolean;
    channels: SubscribedChannel[];
    isFounder?: boolean;
  }>(`/feed/channels/subscribed?orgId=${orgId}`);
  return { channels: result.channels, isFounder: result.isFounder || false };
}

export async function subscribeToFreeChannel(
  channelId: string,
  orgId: string,
): Promise<{ success: boolean; message: string }> {
  return fetchFromBackend(
    `/feed/channels/${channelId}/subscribe?orgId=${orgId}`,
    {
      method: "POST",
    },
  );
}

// One `status` value drives the FE's post-cancel UI:
//   "cancelled_immediately"     free / one-time paid — user out now
//   "cancelling_at_cycle_end"   recurring paid — user keeps access until
//                               `accessUntil`, no future charge
//   "already_inactive"          idempotent no-op — user was never in or
//                               already left
export type UnsubscribeStatus =
  | "cancelled_immediately"
  | "cancelling_at_cycle_end"
  | "already_inactive";

export interface UnsubscribeResponse {
  success: boolean;
  message: string;
  status: UnsubscribeStatus;
  // ISO date string from the BE (or null if never active). FE parses via
  // `new Date(accessUntil)` for the "access until Jul 12" badge.
  accessUntil: string | null;
  alreadyInactive?: boolean;
}

export async function unsubscribeFromChannel(
  channelId: string,
  orgId: string,
): Promise<UnsubscribeResponse> {
  return fetchFromBackend(
    `/feed/channels/${channelId}/subscribe?orgId=${orgId}`,
    {
      method: "DELETE",
    },
  );
}

export async function createChannelOrder(
  channelId: string,
  orgId: string,
  opts?: { quantity?: number; forReserve?: boolean },
): Promise<{
  success: boolean;
  order: { id: string; amount: number; currency: string };
  channel: {
    id: string;
    title: string;
    price: number;
  };
  invoiceId?: string;
}> {
  return fetchFromBackend(
    `/feed/channels/${channelId}/create-order?orgId=${orgId}`,
    {
      method: "POST",
      body: JSON.stringify({
        quantity: opts?.quantity,
        forReserve: opts?.forReserve,
      }),
    },
  );
}

export async function verifyChannelPayment(
  channelId: string,
  orgId: string,
  paymentData: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
): Promise<{ success: boolean; message: string }> {
  return fetchFromBackend(
    `/feed/channels/${channelId}/verify-payment?orgId=${orgId}`,
    {
      method: "POST",
      body: JSON.stringify(paymentData),
    },
  );
}

/**
 * Create a subscription for a subscription-based channel
 * Returns Razorpay subscription details for mandate setup
 */
export async function createChannelSubscription(
  channelId: string,
  orgId: string,
): Promise<{
  success: boolean;
  subscription: {
    id: string;
    razorpaySubscriptionId: string;
    shortUrl: string;
    status: string;
  };
  plan: {
    id: string;
    name: string;
    amount: number;
    period: string;
    currency: string;
  };
  razorpayKeyId: string;
}> {
  return fetchFromBackend(
    `/feed/channels/${channelId}/create-subscription?orgId=${orgId}`,
    {
      method: "POST",
    },
  );
}

/**
 * Get subscription status for a channel
 */
export async function getChannelSubscriptionStatus(
  channelId: string,
  orgId: string,
): Promise<{
  success: boolean;
  isSubscriptionChannel: boolean;
  hasAccess: boolean;
  subscription?: {
    id: string;
    status: string;
    currentEnd?: string;
    chargeAt?: string;
    paidCount?: number;
  };
  plan?: {
    id: string;
    name: string;
    amount: number;
    period: string;
    currency: string;
  };
}> {
  return fetchFromBackend(
    `/feed/channels/${channelId}/subscription-status?orgId=${orgId}`,
  );
}

/**
 * Get full membership details for a channel (for the membership details sidebar)
 * Wraps subscription-status and returns normalized membership info
 */
export async function getChannelMembershipDetails(
  channelId: string,
  orgId: string,
): Promise<{
  success: boolean;
  isFree: boolean;
  status: string;
  hasAccess: boolean;
  joinedAt?: string;
  lastBillingDate?: string;
  nextBillingDate?: string;
  amount?: number;
  currency?: string;
  period?: string;
  invoices?: {
    invoiceNumber: string;
    date: string;
    amount: number;
    currency: string;
  }[];
}> {
  const data = await fetchFromBackend<{
    success: boolean;
    hasAccess: boolean;
    subscription?: {
      id: string;
      status: string;
      currentEnd?: string;
      chargeAt?: string;
      paidCount?: number;
    };
    membership?: {
      status: string;
      joinedAt: string;
    };
    plan?: {
      id: string;
      name: string;
      amount: number;
      period: string;
      currency: string;
    };
  }>(`/feed/channels/${channelId}/subscription-status?orgId=${orgId}`);

  const isFree = !data.subscription && !!data.membership;

  return {
    success: data.success,
    isFree,
    status:
      data.subscription?.status ||
      data.membership?.status ||
      (data.hasAccess ? "active" : "inactive"),
    hasAccess: data.hasAccess ?? false,
    joinedAt: data.membership?.joinedAt || undefined,
    lastBillingDate: data.subscription?.currentEnd
      ? new Date(
          new Date(data.subscription.currentEnd).getTime() -
            30 * 24 * 60 * 60 * 1000,
        ).toISOString()
      : undefined,
    nextBillingDate: data.subscription?.currentEnd || undefined,
    amount: data.plan?.amount ? data.plan.amount / 100 : undefined,
    currency: data.plan?.currency,
    period: data.plan?.period,
  };
}

// ============= Post APIs =============

export async function getPosts(
  orgId: string,
  options?: {
    channelId?: string;
    postType?: "post" | "article";
    limit?: number;
    offset?: number;
  },
): Promise<{
  posts: Post[];
  total: number;
  pagination: Pagination;
}> {
  const params = new URLSearchParams({ orgId });
  if (options?.channelId) params.append("channelId", options.channelId);
  if (options?.postType) params.append("postType", options.postType);
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());

  const result = await fetchFromBackend<{
    success: boolean;
    posts: Post[];
    total: number;
    pagination: Pagination;
  }>(`/feed/posts?${params.toString()}`);

  return {
    posts: result.posts,
    total: result.total,
    pagination: result.pagination,
  };
}

export async function getPost(
  postId: string,
  orgId: string,
): Promise<{ post: Post }> {
  const result = await fetchFromBackend<{ success: boolean; post: Post }>(
    `/feed/posts/${postId}?orgId=${orgId}`,
  );
  return { post: result.post };
}

export async function createPost(data: {
  orgId: string;
  content: string;
  channelIds: string[];
  tags?: string[];
  attachments?: PostAttachment[];
  linkPreviews?: LinkPreviewData[];
  // Article fields
  postType?: "post" | "article";
  title?: string;
  coverImage?: string;
}): Promise<{ post: Post }> {
  const result = await fetchFromBackend<{ success: boolean; post: Post }>(
    `/feed/posts?orgId=${data.orgId}`,
    {
      method: "POST",
      body: JSON.stringify({
        content: data.content,
        channelIds: data.channelIds,
        tags: data.tags,
        attachments: data.attachments,
        linkPreviews: data.linkPreviews,
        postType: data.postType,
        title: data.title,
        coverImage: data.coverImage,
      }),
    },
  );
  return { post: result.post };
}

export async function updatePost(
  postId: string,
  data: {
    content?: string;
    channelIds?: string[];
    tags?: string[];
    linkPreviews?: LinkPreviewData[];
    // Article fields
    title?: string;
    coverImage?: string;
  },
): Promise<{ post: Post }> {
  const result = await fetchFromBackend<{ success: boolean; post: Post }>(
    `/feed/posts/${postId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
  return { post: result.post };
}

export async function deletePost(
  postId: string,
  orgId: string,
): Promise<{ success: boolean }> {
  return fetchFromBackend(`/feed/posts/${postId}?orgId=${orgId}`, {
    method: "DELETE",
  });
}

// ============= Like APIs =============

export async function toggleLike(
  postId: string,
  orgId: string,
): Promise<{ liked: boolean; likesCount: number }> {
  const result = await fetchFromBackend<{
    success: boolean;
    liked: boolean;
    likesCount: number;
  }>(`/feed/posts/${postId}/like?orgId=${orgId}`, {
    method: "POST",
  });
  return { liked: result.liked, likesCount: result.likesCount };
}

// ============= Reaction APIs =============

/**
 * Toggle a reaction on a post (add, change, or remove)
 * - If no reaction exists: adds the reaction
 * - If same reaction exists: removes it
 * - If different reaction exists: changes to new reaction
 */
export async function toggleReaction(
  postId: string,
  orgId: string,
  reactionType: ReactionType,
): Promise<{
  reacted: boolean;
  reactionType: ReactionType | null;
  reactionsCount: ReactionsCount;
}> {
  const result = await fetchFromBackend<{
    success: boolean;
    reacted: boolean;
    reactionType: ReactionType | null;
    reactionsCount: ReactionsCount;
  }>(`/feed/posts/${postId}/react?orgId=${orgId}`, {
    method: "POST",
    body: JSON.stringify({ reactionType }),
  });
  return {
    reacted: result.reacted,
    reactionType: result.reactionType,
    reactionsCount: result.reactionsCount,
  };
}

/**
 * Remove a reaction from a post
 */
export async function removeReaction(
  postId: string,
  orgId: string,
): Promise<{
  success: boolean;
  reactionsCount: ReactionsCount;
}> {
  const result = await fetchFromBackend<{
    success: boolean;
    removed: boolean;
    reactionsCount: ReactionsCount;
  }>(`/feed/posts/${postId}/react?orgId=${orgId}`, {
    method: "DELETE",
  });
  return {
    success: result.removed,
    reactionsCount: result.reactionsCount,
  };
}

/**
 * Get users who reacted to a post
 */
export async function getPostReactions(
  postId: string,
  options?: {
    reactionType?: ReactionType;
    limit?: number;
    offset?: number;
  },
): Promise<{
  reactions: PostReaction[];
  total: number;
  byType: Record<ReactionType, number>;
}> {
  const params = new URLSearchParams();
  if (options?.reactionType)
    params.append("reactionType", options.reactionType);
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());

  const query = params.toString();
  const result = await fetchFromBackend<{
    success: boolean;
    reactions: PostReaction[];
    total: number;
    byType: Record<ReactionType, number>;
  }>(`/feed/posts/${postId}/reactions${query ? `?${query}` : ""}`);

  return {
    reactions: result.reactions,
    total: result.total,
    byType: result.byType,
  };
}

/**
 * Helper to get the top reaction types for display (sorted by count, max 3)
 */
export function getTopReactions(
  reactionsCount: ReactionsCount | undefined,
  maxCount: number = 3,
): ReactionType[] {
  if (!reactionsCount) return [];

  const types: ReactionType[] = [
    "like",
    "love",
    "fire",
    "haha",
    "wow",
    "sad",
    "angry",
  ];
  return types
    .filter((type) => reactionsCount[type] > 0)
    .sort((a, b) => reactionsCount[b] - reactionsCount[a])
    .slice(0, maxCount);
}

// ============= Repost APIs =============

export async function toggleRepost(
  postId: string,
  orgId: string,
): Promise<{ reposted: boolean; repostsCount: number }> {
  const result = await fetchFromBackend<{
    success: boolean;
    reposted: boolean;
    repostsCount: number;
  }>(`/feed/posts/${postId}/repost?orgId=${orgId}`, {
    method: "POST",
  });
  return { reposted: result.reposted, repostsCount: result.repostsCount };
}

// ============= Bookmark APIs =============

export async function toggleBookmark(
  postId: string,
  orgId: string,
): Promise<{ bookmarked: boolean; bookmarksCount: number }> {
  const result = await fetchFromBackend<{
    success: boolean;
    bookmarked: boolean;
    bookmarksCount: number;
  }>(`/feed/posts/${postId}/bookmark?orgId=${orgId}`, {
    method: "POST",
  });
  return {
    bookmarked: result.bookmarked,
    bookmarksCount: result.bookmarksCount,
  };
}

export async function getBookmarkedPosts(
  orgId: string,
  options?: { limit?: number; offset?: number },
): Promise<{ posts: Post[]; total: number; pagination?: Pagination }> {
  const params = new URLSearchParams({ orgId });
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());

  const result = await fetchFromBackend<{
    success: boolean;
    posts: Post[];
    total: number;
    pagination?: Pagination;
  }>(`/feed/bookmarks?${params.toString()}`);
  return {
    posts: result.posts,
    total: result.total,
    pagination: result.pagination,
  };
}

// ============= Pin Post APIs =============

export async function pinPost(
  postId: string,
  orgId: string,
): Promise<{ success: boolean; message: string }> {
  return fetchFromBackend(`/feed/posts/${postId}/pin?orgId=${orgId}`, {
    method: "POST",
  });
}

export async function unpinPost(
  postId: string,
  orgId: string,
): Promise<{ success: boolean; message: string }> {
  return fetchFromBackend(`/feed/posts/${postId}/pin?orgId=${orgId}`, {
    method: "DELETE",
  });
}

// ============= Reposts APIs (Get users who reposted) =============

export async function getPostReposts(
  postId: string,
  options?: { limit?: number; offset?: number },
): Promise<{ reposts: PostRepost[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());

  const query = params.toString();
  const result = await fetchFromBackend<{
    success: boolean;
    reposts: PostRepost[];
    total: number;
  }>(`/feed/posts/${postId}/reposts${query ? `?${query}` : ""}`);
  return { reposts: result.reposts, total: result.total };
}

// ============= Quote Post APIs =============

export async function createQuotePost(data: {
  orgId: string;
  content: string;
  channelIds: string[];
  quotedPostId: string;
  tags?: string[];
  attachments?: PostAttachment[];
}): Promise<{ post: Post }> {
  const result = await fetchFromBackend<{
    success: boolean;
    message: string;
    post: Post;
  }>(`/feed/posts/quote?orgId=${data.orgId}`, {
    method: "POST",
    body: JSON.stringify({
      content: data.content,
      channelIds: data.channelIds,
      quotedPostId: data.quotedPostId,
      tags: data.tags,
      attachments: data.attachments,
    }),
  });
  return { post: result.post };
}

// ============= Share Link APIs =============

export async function getPostShareLink(
  postId: string,
  orgId: string,
): Promise<{ shareLink: string; postId: string }> {
  const result = await fetchFromBackend<{
    success: boolean;
    shareLink: string;
    postId: string;
  }>(`/feed/posts/${postId}/share?orgId=${orgId}`);
  return { shareLink: result.shareLink, postId: result.postId };
}

export async function getVideoShareLink(
  videoId: string,
  orgId: string,
  videoType: "standalone" | "workshop",
  recordingId?: string,
): Promise<{ shareLink: string; videoId: string }> {
  // Recording cards use compound ids (`workshopId__recordingId`). Accept either
  // form so callers can pass the card id straight through.
  let realVideoId = videoId;
  let resolvedRecordingId = recordingId;
  if (videoId.includes("__")) {
    const [workshopPart, recordingPart] = videoId.split("__");
    realVideoId = workshopPart;
    resolvedRecordingId = resolvedRecordingId || recordingPart;
  }

  // A webinar's recording is an OrganizationFile in the cabinet, not a field on
  // the Workshop doc — so the generic /guest/:slug/video/:workshopId page has
  // nothing to stream and renders "Video unavailable". The backend only routes
  // to the playable /guest/:slug/recording/:recordingId page when it gets a
  // recordingId, so resolve the newest recording here whenever the caller
  // didn't supply one. Failure is non-fatal: we fall back to the plain link.
  if (!resolvedRecordingId && videoType === "workshop") {
    try {
      const recs = await getWorkshopRecordings(realVideoId);
      resolvedRecordingId = recs.recordings?.[0]?.id || undefined;
    } catch (err) {
      console.error("Error resolving workshop recording for share link:", err);
    }
  }

  const params = new URLSearchParams({ orgId, videoType });
  if (resolvedRecordingId) params.append("recordingId", resolvedRecordingId);
  const result = await fetchFromBackend<{
    success: boolean;
    shareLink: string;
    videoId: string;
  }>(`/feed/videos/${realVideoId}/share?${params.toString()}`);
  return { shareLink: result.shareLink, videoId: result.videoId };
}

export async function getPlaylistShareLink(
  playlistId: string,
  orgId: string,
): Promise<{ shareLink: string; playlistId: string }> {
  const result = await fetchFromBackend<{
    success: boolean;
    shareLink: string;
    playlistId: string;
  }>(`/feed/playlists/${playlistId}/share?orgId=${orgId}`);
  return { shareLink: result.shareLink, playlistId: result.playlistId };
}

// ============= Trending Hashtags APIs =============

export async function getTrendingTags(
  orgId: string,
  options?: { limit?: number; timeRange?: number },
): Promise<{ trending: TrendingTag[] }> {
  const params = new URLSearchParams({ orgId });
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.timeRange)
    params.append("timeRange", options.timeRange.toString());

  const result = await fetchFromBackend<{
    success: boolean;
    trending: TrendingTag[];
  }>(`/feed/trending/tags?${params.toString()}`);
  return { trending: result.trending };
}

export async function searchPostsByTag(
  tag: string,
  orgId: string,
  options?: { limit?: number; offset?: number },
): Promise<{
  tag: string;
  posts: Post[];
  total: number;
  pagination: Pagination;
}> {
  const params = new URLSearchParams({ orgId });
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());

  const result = await fetchFromBackend<{
    success: boolean;
    tag: string;
    posts: Post[];
    total: number;
    pagination: Pagination;
  }>(`/feed/search/tag/${encodeURIComponent(tag)}?${params.toString()}`);
  return {
    tag: result.tag,
    posts: result.posts,
    total: result.total,
    pagination: result.pagination,
  };
}

// ============= Poll APIs =============

export async function createPollPost(data: {
  orgId: string;
  content?: string;
  channelIds: string[];
  tags?: string[];
  poll: {
    question: string;
    options: string[];
    durationHours: number;
    isMultipleChoice?: boolean;
  };
}): Promise<{ post: Post; poll: Poll }> {
  const result = await fetchFromBackend<{
    success: boolean;
    message: string;
    post: Post;
    poll: Poll;
  }>(`/feed/posts/poll?orgId=${data.orgId}`, {
    method: "POST",
    body: JSON.stringify({
      content: data.content,
      channelIds: data.channelIds,
      tags: data.tags,
      poll: data.poll,
    }),
  });
  return { post: result.post, poll: result.poll };
}

export async function getPostPoll(postId: string): Promise<{ poll: Poll }> {
  const result = await fetchFromBackend<{
    success: boolean;
    poll: Poll;
  }>(`/feed/posts/${postId}/poll`);
  return { poll: result.poll };
}

export async function voteOnPoll(
  pollId: string,
  optionIds: string[],
): Promise<{ poll: Poll }> {
  const result = await fetchFromBackend<{
    success: boolean;
    message: string;
    poll: Poll;
  }>(`/feed/polls/${pollId}/vote`, {
    method: "POST",
    body: JSON.stringify({ optionIds }),
  });
  return { poll: result.poll };
}

export async function getPollResults(pollId: string): Promise<{
  poll: Pick<
    Poll,
    | "_id"
    | "postId"
    | "question"
    | "totalVotes"
    | "endsAt"
    | "isMultipleChoice"
    | "isActive"
  >;
  results: PollResult[];
}> {
  const result = await fetchFromBackend<{
    success: boolean;
    poll: Pick<
      Poll,
      | "_id"
      | "postId"
      | "question"
      | "totalVotes"
      | "endsAt"
      | "isMultipleChoice"
      | "isActive"
    >;
    results: PollResult[];
  }>(`/feed/polls/${pollId}/results`);
  return { poll: result.poll, results: result.results };
}

// ============= Comment APIs =============

export async function getComments(
  postId: string,
  options?: {
    limit?: number;
    offset?: number;
    parentCommentId?: string;
  },
): Promise<{ comments: Comment[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());
  if (options?.parentCommentId)
    params.append("parentCommentId", options.parentCommentId);

  const query = params.toString();
  const result = await fetchFromBackend<{
    success: boolean;
    comments: Comment[];
    total: number;
  }>(`/feed/posts/${postId}/comments${query ? `?${query}` : ""}`);

  return { comments: result.comments, total: result.total };
}

export async function addComment(
  postId: string,
  orgId: string,
  content: string,
  parentCommentId?: string,
  attachments?: CommentAttachment[],
): Promise<{ comment: Comment }> {
  const result = await fetchFromBackend<{ success: boolean; comment: Comment }>(
    `/feed/posts/${postId}/comments?orgId=${orgId}`,
    {
      method: "POST",
      body: JSON.stringify({
        content,
        parentCommentId,
        attachments:
          attachments && attachments.length > 0 ? attachments : undefined,
      }),
    },
  );
  return { comment: result.comment };
}

export async function deleteComment(
  commentId: string,
  orgId: string,
): Promise<{ success: boolean }> {
  return fetchFromBackend(`/feed/comments/${commentId}?orgId=${orgId}`, {
    method: "DELETE",
  });
}

export async function updateComment(
  commentId: string,
  orgId: string,
  content: string,
): Promise<{ success: boolean; comment: Comment }> {
  return fetchFromBackend<{ success: boolean; comment: Comment }>(
    `/feed/comments/${commentId}?orgId=${orgId}`,
    {
      method: "PUT",
      body: JSON.stringify({ content }),
    },
  );
}

export async function toggleCommentReaction(
  commentId: string,
  orgId: string,
  reactionType: ReactionType,
): Promise<{
  reacted: boolean;
  reactionType: ReactionType | null;
  reactionsCount: ReactionsCount;
}> {
  const result = await fetchFromBackend<{
    success: boolean;
    reacted: boolean;
    reactionType: ReactionType | null;
    reactionsCount: ReactionsCount;
  }>(`/feed/comments/${commentId}/react?orgId=${orgId}`, {
    method: "POST",
    body: JSON.stringify({ reactionType }),
  });
  return {
    reacted: result.reacted,
    reactionType: result.reactionType,
    reactionsCount: result.reactionsCount,
  };
}

export async function removeCommentReaction(
  commentId: string,
  orgId: string,
): Promise<{
  success: boolean;
  reactionsCount: ReactionsCount;
}> {
  const result = await fetchFromBackend<{
    success: boolean;
    removed: boolean;
    reactionsCount: ReactionsCount;
  }>(`/feed/comments/${commentId}/react?orgId=${orgId}`, {
    method: "DELETE",
  });
  return {
    success: result.removed,
    reactionsCount: result.reactionsCount,
  };
}

// ============= Channel Management (Founder Only) =============

export interface ChannelWithStats extends Channel {
  subscriberCount?: number;
}

export async function createChannel(
  orgId: string,
  data: {
    title: string;
    description?: string;
    price?: number;
    currency?: string;
    coverImage?: string;
    isFree?: boolean;
    isSubscription?: boolean;
    subscriptionPeriod?: "weekly" | "monthly" | "quarterly" | "yearly";
    rating?: number;
    ratingCount?: number;
    aboutText?: string;
    whatsIncluded?: string[];
    benefits?: ChannelBenefit[];
    reviews?: ChannelReview[];
    faqs?: ChannelFaq[];
    isDefault?: boolean;
    galleryImages?: string[];
    videoUrl?: string;
    videoFile?: string;
    whoCanPost?: "everyone" | "admins_only";
    gstInclusive?: boolean;
    requireIosPayment?: boolean;
    appleFeeInclusive?: boolean;
    emailAlerts?: ProductEmailAlerts;
    founderAlerts?: FounderAlerts;
    thankYouPage?: ThankYouPage;
  },
): Promise<{ channel: Channel }> {
  const result = await fetchFromBackend<{ success: boolean; channel: Channel }>(
    `/feed/channels?orgId=${orgId}`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
  return { channel: result.channel };
}

export async function updateChannel(
  channelId: string,
  orgId: string,
  data: {
    title?: string;
    description?: string;
    price?: number;
    currency?: string;
    coverImage?: string;
    isFree?: boolean;
    isActive?: boolean;
    isSubscription?: boolean;
    subscriptionPeriod?: "weekly" | "monthly" | "quarterly" | "yearly" | null;
    rating?: number | null;
    ratingCount?: number | null;
    aboutText?: string | null;
    whatsIncluded?: string[] | null;
    benefits?: ChannelBenefit[] | null;
    reviews?: ChannelReview[] | null;
    faqs?: ChannelFaq[] | null;
    isDefault?: boolean;
    galleryImages?: string[] | null;
    videoUrl?: string | null;
    videoFile?: string | null;
    whoCanPost?: "everyone" | "admins_only";
    gstInclusive?: boolean;
    requireIosPayment?: boolean;
    appleFeeInclusive?: boolean;
    emailAlerts?: ProductEmailAlerts;
    founderAlerts?: FounderAlerts;
    // Tri-state: undefined leaves it, null clears (BE $unset), object writes.
    thankYouPage?: ThankYouPage | null;
  },
): Promise<{ channel: Channel }> {
  const result = await fetchFromBackend<{ success: boolean; channel: Channel }>(
    `/feed/channels/${channelId}?orgId=${orgId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
  return { channel: result.channel };
}

export async function deleteChannel(
  channelId: string,
  orgId: string,
): Promise<{ success: boolean }> {
  return fetchFromBackend(`/feed/channels/${channelId}?orgId=${orgId}`, {
    method: "DELETE",
  });
}

export async function setChannelDefault(
  channelId: string,
  orgId: string,
  isDefault: boolean,
): Promise<{ success: boolean; message?: string; error?: string }> {
  return fetchFromBackend(
    `/feed/channels/${channelId}/set-default?orgId=${orgId}`,
    {
      method: "PUT",
      body: JSON.stringify({ isDefault }),
    },
  );
}

export async function getChannelWithStats(
  channelId: string,
  orgId: string,
): Promise<{ channel: ChannelWithStats }> {
  const result = await fetchFromBackend<{
    success: boolean;
    channel: ChannelWithStats;
  }>(`/feed/channels/${channelId}?orgId=${orgId}`);
  return { channel: result.channel };
}

// ============= Customers/Subscribers Management (Founder Only) =============

export interface CustomerSubscription {
  channelId: string;
  channelTitle: string;
  price: number;
  isFree: boolean;
  isSubscription: boolean;
  status: string;
  joinedAt: string;
  lastPaymentDate?: string;
  nextPaymentDate?: string;
  subscriptionStatus?: string;
}

export interface Customer {
  user: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
  subscriptions: CustomerSubscription[];
  totalSpent: number;
  joinedAt: string;
}

export async function getCustomers(
  orgId: string,
  options?: {
    channelId?: string;
    status?: "active" | "inactive" | "all";
    limit?: number;
    offset?: number;
  },
): Promise<{
  customers: Customer[];
  total: number;
  pagination: { limit: number; offset: number; hasMore: boolean };
}> {
  const params = new URLSearchParams({ orgId });
  if (options?.channelId) params.append("channelId", options.channelId);
  if (options?.status) params.append("status", options.status);
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());

  return fetchFromBackend(`/feed/customers?${params.toString()}`);
}

export interface ChannelSubscriber {
  user: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
  joinedAt: string;
  status: string;
  canPost: boolean;
  lastPaymentDate?: string;
  nextPaymentDate?: string;
  subscriptionStatus?: string;
  // Stamped when the member cancels. Combined with subscriptionStatus
  // === "cancelled" this identifies the "still active, ends on X" batch.
  cancelledAt?: string | null;
  // Sum of every paid channel invoice this user paid for this channel,
  // converted to USD via convertToUsd on the BE.
  lifetimeValueUsd: number;
}

// Bucket filter for the founder Members view. Matches the BE's
// membershipFilter query param.
export type ChannelMembershipBucket =
  | "active"
  | "cancelling"
  | "expired"
  | "all";

export interface ChannelSubscriberBucketCounts {
  active: number;
  cancelling: number;
  expired: number;
  all: number;
}

export interface ChannelSubscribersResponse {
  channel: {
    _id: string;
    title: string;
    price: number;
    isFree: boolean;
    currency: string;
    isSubscription: boolean;
    subscriptionPeriod: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  };
  counts: ChannelSubscriberBucketCounts;
  subscribers: ChannelSubscriber[];
  total: number;
  pagination: { limit: number; offset: number; hasMore: boolean };
}

export async function getChannelSubscribers(
  channelId: string,
  orgId: string,
  options?: {
    limit?: number;
    offset?: number;
    membershipFilter?: ChannelMembershipBucket;
    search?: string;
  },
): Promise<ChannelSubscribersResponse> {
  const params = new URLSearchParams({ orgId });
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());
  if (options?.membershipFilter)
    params.append("membershipFilter", options.membershipFilter);
  if (options?.search) params.append("search", options.search);

  return fetchFromBackend(
    `/feed/channels/${channelId}/subscribers?${params.toString()}`,
  );
}

/**
 * Toggle a member's posting permission in a channel (founder only)
 */
export async function toggleMemberPosting(
  channelId: string,
  userId: string,
  orgId: string,
  canPost: boolean,
): Promise<{ success: boolean; canPost: boolean; message: string }> {
  return fetchFromBackend(
    `/feed/channels/${channelId}/members/${userId}/posting?orgId=${orgId}`,
    {
      method: "PUT",
      body: JSON.stringify({ canPost }),
    },
  );
}

export interface FeedStats {
  totalChannels: number;
  activeChannels: number;
  totalSubscribers: number;
  totalPosts: number;
  totalRevenueUsd: number;
}

export async function getFeedStats(
  orgId: string,
): Promise<{ stats: FeedStats }> {
  const result = await fetchFromBackend<{ success: boolean; stats: FeedStats }>(
    `/feed/stats?orgId=${orgId}`,
  );
  return { stats: result.stats };
}

// ============= Channels analytics (Communities page) =============
// Per-channel real numbers powering the founder-facing Communities view
// in components/dashboard/ChannelsPage.tsx. All monetary figures are
// USD-normalised on the BE via convertToUsd, so the FE never has to do
// exchange-rate math.

export interface ChannelAnalyticsRow {
  _id: string;
  title: string;
  coverImage: string | null;
  isFree: boolean;
  isSubscription: boolean;
  subscriptionPeriod: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  isActive: boolean;
  isDefault: boolean;
  price: number;
  currency: string;
  createdAt: string;
  totalMembers: number;
  activeMembers: number;
  // "Unsubscribed but still active" batch — members who cancelled a
  // recurring sub but haven't hit nextPaymentDate yet. Excluded from MRR
  // (see monthlyRevenueUsd). Rendered as a dedicated table column on the
  // founder's Communities view.
  cancellingMembers: number;
  // Every historical unsubscribe on this channel — sum of ChannelMembership
  // "unsubscribed" events. Includes members who already fully expired
  // (their access ended after the sweeper flipped them). Read the diff
  // against `cancellingMembers` as "how many have already lost access."
  totalUnsubs: number;
  referredMembers: number;
  totalRevenueUsd: number;
  // null → one-time channel (FE renders "—"). 0 → free or no active subs.
  monthlyRevenueUsd: number | null;
}

export interface ChannelAnalyticsHeaderStats {
  totalCommunities: number;
  totalMembers: number;
  // Org-wide rollup of the per-channel `cancellingMembers` counts.
  totalCancellingMembers: number;
  // Org-wide rollup of the per-channel `totalUnsubs` counts.
  totalUnsubs: number;
  uniqueMembers: number;
  highestReferredChannel: {
    channelId: string;
    title: string;
    referredCount: number;
    // true = fell back to argmax(totalMembers) because no AffiliateConversion
    // rows exist for this org yet. FE can hide/relabel if it wants to.
    fallback: boolean;
  } | null;
  totalRevenueUsd: number;
}

export interface ChannelAnalyticsResponse {
  headerStats: ChannelAnalyticsHeaderStats;
  channels: ChannelAnalyticsRow[];
}

export async function getChannelAnalytics(
  orgId: string,
): Promise<ChannelAnalyticsResponse> {
  const result = await fetchFromBackend<{
    success: boolean;
    headerStats: ChannelAnalyticsHeaderStats;
    channels: ChannelAnalyticsRow[];
  }>(`/feed/channels/analytics?orgId=${orgId}`);
  return { headerStats: result.headerStats, channels: result.channels };
}

// ============= Founder Channel Invoices (Founder:Communities:Orders) =====

export type ChannelInvoiceStatus =
  | "draft"
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "expired";

// One row on the founder's Communities > Invoices table.
// `totalAmount` is in the item's smallest currency unit (paise/cents) —
// display code divides by 100.
export interface FounderChannelInvoiceRow {
  _id: string;
  invoiceNumber: string;
  invoiceType: string | null;
  status: ChannelInvoiceStatus;
  totalAmount: number;
  itemCurrency: string;
  paymentCurrency: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerId: string | null;
  channelId: string | null;
  channelTitle: string | null;
  isRecurring: boolean;
  recurringPeriod: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  recurringPaymentNumber: number | null;
  parentInvoiceId: string | null;
  paymentPlatform: string | null;
  createdAt: string;
  paidAt: string | null;
  nextDueDate: string | null;
  cancelledAt: string | null;
}

// Invoice item types the per-type Orders pages support.
export type FounderInvoiceItemType =
  | "channel"
  | "workshop"
  | "course"
  | "product";

export interface FounderInvoicesFilters {
  status?: ChannelInvoiceStatus;
  // Comma-separated list of item IDs (channels/workshops/courses/products
  // depending on itemType). Filtered against org ownership on the BE.
  itemId?: string;
  search?: string;
  currency?: "USD" | "INR";
  // "true" | "false" — send undefined for "all"
  isRecurring?: "true" | "false";
  // ISO date strings
  from?: string;
  to?: string;
  limit?: number;
  skip?: number;
}

export interface FounderInvoicesResponse {
  invoices: FounderChannelInvoiceRow[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
  itemType: FounderInvoiceItemType;
  // Flat list of the org's items of this type — populates the FE filter
  // dropdown without a separate call. Same shape regardless of itemType.
  items: { _id: string; title: string }[];
}

export async function getFounderInvoices(
  orgId: string,
  itemType: FounderInvoiceItemType,
  filters: FounderInvoicesFilters = {},
): Promise<FounderInvoicesResponse> {
  const sp = new URLSearchParams({ orgId, itemType });
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const result = await fetchFromBackend<
    { success: boolean } & FounderInvoicesResponse
  >(`/feed/founder/invoices?${sp.toString()}`);
  return {
    invoices: result.invoices,
    total: result.total,
    limit: result.limit,
    skip: result.skip,
    hasMore: result.hasMore,
    itemType: result.itemType,
    items: result.items,
  };
}

// ============= Founder Item Users (Users tab on each Orders page) ========

// Status buckets vary by itemType. Channels use membership-driven
// active/cancelling/expired; the other three types roll up invoice
// status → paid/refunded/pending. Send undefined for "any".
export type FounderItemUserStatus =
  | "paid"
  | "refunded"
  | "pending"
  | "active"
  | "cancelling"
  | "expired";

export interface FounderItemUserRow {
  userId: string;
  name: string | null;
  email: string | null;
  profilePicture: string | null;
  itemIds: string[];
  itemCount: number;
  // Sum of paid-invoice totalAmount in `currency` smallest unit (paise/cents).
  totalPaid: number;
  invoiceCount: number;
  currency: string | null;
  lastActivityAt: string | null;
  firstActivityAt: string | null;
  status: "paid" | "pending" | "active" | "cancelling" | "expired" | "refunded";
}

export interface FounderItemUsersFilters {
  status?: FounderItemUserStatus;
  itemId?: string; // comma-separated
  q?: string;
  currency?: "USD" | "INR";
  from?: string;
  to?: string;
  limit?: number;
  skip?: number;
}

export interface FounderItemUsersResponse {
  users: FounderItemUserRow[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
  itemType: FounderInvoiceItemType;
  items: { _id: string; title: string }[];
}

export async function getFounderItemUsers(
  orgId: string,
  itemType: FounderInvoiceItemType,
  filters: FounderItemUsersFilters = {},
): Promise<FounderItemUsersResponse> {
  const sp = new URLSearchParams({ orgId, itemType });
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const result = await fetchFromBackend<
    { success: boolean } & FounderItemUsersResponse
  >(`/feed/founder/item-users?${sp.toString()}`);
  return {
    users: result.users,
    total: result.total,
    limit: result.limit,
    skip: result.skip,
    hasMore: result.hasMore,
    itemType: result.itemType,
    items: result.items,
  };
}

export interface FounderUserDetailUser {
  _id: string;
  name: string | null;
  email: string | null;
  profilePicture: string | null;
  createdAt: string | null;
}

// Channel-only Items shape.
export interface FounderUserDetailChannelItem {
  itemId: string;
  itemTitle: string | null;
  joinedAt: string | null;
  status: "active" | "inactive" | "suspended" | null;
  subscriptionStatus: "active" | "cancelled" | "expired" | null;
  lastPaymentDate: string | null;
  nextPaymentDate: string | null;
  cancelledAt: string | null;
  lastActivityAt: string | null;
}

// Non-channel Items shape — derived from grouped invoices.
export interface FounderUserDetailPurchasedItem {
  itemId: string;
  itemTitle: string | null;
  firstPurchasedAt: string;
  lastPurchasedAt: string;
  totalPaid: number;
  currency: string | null;
  invoiceCount: number;
  hasActivePaid: boolean;
}

export interface FounderUserDetailInvoice {
  _id: string;
  invoiceNumber: string;
  status: ChannelInvoiceStatus;
  totalAmount: number;
  itemCurrency: string;
  paymentCurrency: string | null;
  itemId: string | null;
  itemTitle: string | null;
  isRecurring: boolean;
  recurringPeriod: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  recurringPaymentNumber: number | null;
  parentInvoiceId: string | null;
  createdAt: string;
  paidAt: string | null;
  nextDueDate: string | null;
  cancelledAt: string | null;
}

export interface FounderUserDetailEvent {
  _id: string;
  channelId: string | null;
  channelTitle: string | null;
  eventType: "unsubscribed" | "expired";
  occurredAt: string;
  subscriptionPeriod: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  accessUntil: string | null;
}

export interface FounderUserDetailResponse {
  user: FounderUserDetailUser | null;
  items: FounderUserDetailChannelItem[] | FounderUserDetailPurchasedItem[];
  invoices: FounderUserDetailInvoice[];
  events: FounderUserDetailEvent[];
  itemType: FounderInvoiceItemType;
}

export async function getFounderUserDetail(
  orgId: string,
  itemType: FounderInvoiceItemType,
  userId: string,
): Promise<FounderUserDetailResponse> {
  const sp = new URLSearchParams({ orgId, itemType, userId });
  const result = await fetchFromBackend<
    { success: boolean } & FounderUserDetailResponse
  >(`/feed/founder/user-detail?${sp.toString()}`);
  return {
    user: result.user,
    items: result.items,
    invoices: result.invoices,
    events: result.events,
    itemType: result.itemType,
  };
}

// ============= Founder Unsub Log (Founder:Communities:UnsubLog) ==========

export type UnsubEventType = "unsubscribed" | "expired";
export type UnsubChannelKind = "free" | "one_time" | "recurring";
// Discriminator between channel and workshop events. FE renders a
// Kind badge column + Kind filter chip based on this.
export type UnsubItemKind = "channel" | "workshop";

export interface FounderUnsubLogRow {
  _id: string;
  userId: string | null;
  itemKind: UnsubItemKind;
  // channelId/channelTitle populate on channel events; workshopId/
  // workshopTitle populate on workshop events. The FE renders whichever
  // is present in the "Community / Workshop" column.
  channelId: string | null;
  channelTitle: string | null;
  workshopId: string | null;
  workshopTitle: string | null;
  // Only populated for per-session workshop cancels — identifies which
  // specific session in the recurrence the user walked away from.
  sessionDate: string | null;
  eventType: UnsubEventType;
  occurredAt: string;
  channelKind: UnsubChannelKind;
  subscriptionPeriod: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  accessUntil: string | null;
  activeDaysUsed: number | null;
  activeDaysLeftAtCancel: number | null;
  lifetimeValueUsdSnapshot: number;
  parentInvoiceId: string | null;
  customerName: string | null;
  customerEmail: string | null;
}

export interface FounderUnsubLogFilters {
  channelId?: string;
  // Per-workshop filter (comma-separated) — mirrors channelId.
  workshopId?: string;
  // Narrow the log to a single kind. Omit for both.
  itemKind?: UnsubItemKind;
  eventType?: UnsubEventType;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  skip?: number;
}

export interface FounderUnsubLogCounts {
  unsubscribed: number;
  expired: number;
  // Kind split — powers the Channel / Workshop / All chips.
  channel: number;
  workshop: number;
  all: number;
}

export interface FounderUnsubLogWorkshopOption {
  _id: string;
  title: string;
  enrollmentType: "once" | "per_session";
}

export interface FounderUnsubLogResponse {
  events: FounderUnsubLogRow[];
  counts: FounderUnsubLogCounts;
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
  channels: { _id: string; title: string }[];
  workshops: FounderUnsubLogWorkshopOption[];
}

export async function getFounderUnsubLog(
  orgId: string,
  itemKind: UnsubItemKind,
  filters: FounderUnsubLogFilters = {},
): Promise<FounderUnsubLogResponse> {
  const sp = new URLSearchParams({ orgId, itemKind });
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "" || k === "itemKind") continue;
    sp.set(k, String(v));
  }
  const result = await fetchFromBackend<
    { success: boolean } & FounderUnsubLogResponse
  >(`/feed/founder/unsub-log?${sp.toString()}`);
  return {
    events: result.events,
    counts: result.counts,
    total: result.total,
    limit: result.limit,
    skip: result.skip,
    hasMore: result.hasMore,
    channels: result.channels,
    workshops: result.workshops || [],
  };
}

// ============= Founder Product Refunds =============
// Digital Products don't have subscriptions, but they do have refunded
// / cancelled ProductOrder rows. The Digital Products Unsub Log ("Refunds
// & Cancellations") reads them via this endpoint.

export interface FounderProductRefundRow {
  _id: string;
  userId: string | null;
  itemKind: "product";
  productId: string | null;
  productTitle: string | null;
  eventType: "refunded" | "cancelled";
  occurredAt: string;
  orderNumber: string;
  totalAmount: number;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
}

export interface FounderProductRefundsFilters {
  productId?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  skip?: number;
}

export interface FounderProductRefundsResponse {
  events: FounderProductRefundRow[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
  products: { _id: string; title: string }[];
}

export async function getFounderProductRefunds(
  orgId: string,
  filters: FounderProductRefundsFilters = {},
): Promise<FounderProductRefundsResponse> {
  const sp = new URLSearchParams({ orgId });
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const result = await fetchFromBackend<
    { success: boolean } & FounderProductRefundsResponse
  >(`/feed/founder/product-refunds?${sp.toString()}`);
  return {
    events: result.events,
    total: result.total,
    limit: result.limit,
    skip: result.skip,
    hasMore: result.hasMore,
    products: result.products,
  };
}

// ============= Workshop Types =============

export interface WorkshopAgendaItem {
  title: string;
  duration: string;
  topics?: string[];
}

export interface WorkshopBonus {
  icon: string;
  title: string;
  description: string;
}

export interface WorkshopReview {
  _id?: string;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  rating: number;
  text: string;
  helpfulCount?: number;
  createdAt?: string;
}

export interface WorkshopFaq {
  question: string;
  answer: string;
}

export interface WorkshopChannel {
  _id: string;
  title: string;
}

export interface WorkshopCreator {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

export interface RecurrencePattern {
  type: "daily" | "weekly" | "monthly";
  excludedDays?: number[]; // For daily: days to exclude (0=Sunday, 6=Saturday)
  dayOfWeek?: number; // For weekly: which day (0-6)
  dayOfMonth?: number; // For monthly: which date (1-31)
  /**
   * Multi-day selection, both optional and both winning over the singular
   * field above when present. The singular fields are still written alongside
   * (earliest selected day) so any consumer that predates multi-day still
   * resolves to a real session day.
   */
  daysOfWeek?: number[]; // For weekly: every day it runs on (0-6)
  daysOfMonth?: number[]; // For monthly: every date it runs on (1-31)
}

export interface WorkshopSession {
  /** Canonical UTC-midnight slot key. Unchanged by any per-session edit — it
   *  is what register / order / access calls send back. */
  date: string;
  startDateTime: string;
  endDateTime: string;
  isPast: boolean;
  isToday: boolean;
  dateString: string;
  registeredCount?: number;
  hasAccess?: boolean;
  isFull?: boolean;
  /* ── Session-level values, resolved server-side over the series template.
   *    Present on every session; identical to the series unless edited. ── */
  title?: string;
  description?: string;
  thumbnail?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  isFree?: boolean;
  price?: number;
  currency?: string;
  speakerName?: string;
  speakerBio?: string;
  speakerAvatar?: string;
  agenda?: Array<{ title: string; duration: string; topics: string[] }>;
  /** Set only when the session was moved off its slot. */
  rescheduledDate?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
}

/**
 * One edited session of a recurring series, as returned alongside the workshop
 * on the Enrolled view. Only sessions that actually differ from the series are
 * sent — an unedited series omits the list entirely.
 */
export interface WorkshopSessionOverrideView {
  /** Canonical slot key. Match a selected day against THIS, not displayDate. */
  sessionDate: string;
  /** Where it runs, when it has been moved. Equals sessionDate otherwise. */
  displayDate: string;
  isRescheduled: boolean;
  title: string;
  description?: string;
  thumbnail?: string;
  startTime: string;
  endTime: string;
  timezone: string;
  startDateTime: string;
  endDateTime: string;
  speakerName?: string;
  speakerAvatar?: string;
  isFree: boolean;
  price: number;
}

export interface Workshop {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  meetingUrl?: string;
  meetingId?: string;
  meetingPassword?: string;
  maxParticipants?: number;
  channelIds: WorkshopChannel[];
  orgId: string;
  createdBy: WorkshopCreator;
  isFree: boolean;
  price: number;
  currency: string;
  /** Post-registration email the host opted into. Same config as products. */
  emailAlerts?: ProductEmailAlerts;
  founderAlerts?: FounderAlerts;
  isActive: boolean;
  registeredParticipantsCount: number;
  registeredParticipantAvatars?: string[];
  attendeesCount?: number;
  // Distinct user IDs across all non-cancelled registrations. For
  // per_session workshops this is the "Enrolees" tile — separate from
  // `registeredParticipantsCount` which counts total session-buys.
  enrolleesCount?: number;
  // Distinct user IDs among attended registrations — powers "Unique
  // Attendees" tile for recurring workshops.
  uniqueAttendeesCount?: number;
  // Sum of MeetParticipant join events across the workshop's meeting.
  // For one-time workshops this equals attendeesCount (only 1 session).
  attendanceEventsCount?: number;
  // Full bounded session count (from calculateSessions inside the
  // recurrenceEndDate range). Drives the "# Sessions" tile — different
  // from `activeSessionsCount` which counts only PAST sessions.
  totalSessionsCount?: number;
  totalRevenueUSD?: number;
  monthlyRevenueUSD?: number;
  // Total percentage from the workshop's active CombPlan (0 if none).
  // Powers the "Aff Com %" tile.
  affiliateCommissionPercent?: number;
  // Sum of CommissionDistribution.totalCommissionAmount (USD) for this
  // workshop. Powers the "Aff Com $" tile.
  affiliateCommissionPaidUsd?: number;
  isRegistered: boolean;
  hasPaid: boolean;
  meetingStatus?: "scheduled" | "live" | "ended" | "cancelled";
  activeSessionsCount?: number;
  // Recurrence fields
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceStartDate?: string;
  isRecurrenceActive?: boolean;
  enrollmentType?: "once" | "per_session";
  // Bound for per_session recurring workshops — sessions stop after this
  // date. Set at workshop creation for per_session mode; undefined for
  // enrol-once + non-recurring + legacy per_session workshops.
  recurrenceEndDate?: string;
  // For per_session enrolees, the specific ISO sessionDates the user has
  // paid for. Drives the Enrolled tab's calendar dots + the mode-aware
  // unsub scope. Undefined for enrol-once (full access to every session)
  // or workshops the user isn't enrolled in.
  enrolledSessions?: string[];
  recordingMode?: "manual" | "automatic";
  nextSession?: WorkshopSession | null;
  // Which session the founder most recently started streaming. Rotates
  // each time the founder picks a new session from the picker; read by
  // the FE to render a LIVE badge.
  currentSessionDate?: string;
  // ISO datetimes of sessions where the founder pressed End early.
  // Calendar / accordion views use this to flip a session to Completed
  // even when the scheduled window hasn't started yet.
  manuallyEndedSessionDates?: string[];
  // Sessions of this series the founder has edited. Absent when none are —
  // which is every series created before per-session editing shipped, and the
  // reason views can fall back to the workshop's own fields unconditionally.
  sessionOverrides?: WorkshopSessionOverrideView[];
  // Workshop detail page fields
  rating?: number;
  ratingCount?: number;
  aboutText?: string;
  /** Office members billed as speakers; populated on the detail endpoint. */
  speakers?: { _id: string; name: string; profilePicture?: string | null; designation?: string | null }[];
  learningPoints?: string[];
  agenda?: WorkshopAgendaItem[];
  bonuses?: WorkshopBonus[];
  reviews?: WorkshopReview[];
  faqs?: WorkshopFaq[];
  requirements?: string[];
  whatsIncluded?: string[];
  hostRating?: number;
  hostStudents?: string;
  hostWebinars?: string;
  hostExperience?: string;
  galleryImages?: string[];
  videoUrl?: string;
  videoFile?: string;
  gstInclusive?: boolean;
  requireIosPayment?: boolean;
  appleFeeInclusive?: boolean;
  // Trash / soft-delete state. When both are absent the workshop is live.
  // deletedAt with either no restoredAt or restoredAt < deletedAt ⇒ Trashed.
  deletedAt?: string;
  restoredAt?: string;
  // Derived by the backend list endpoint using the same ladder the session
  // rows use (manual End → completed, manual Start → live, scheduled end
  // passed → completed, scheduled start passed → live, else not_started).
  // Deleted never surfaces here because trashed workshops are filtered from
  // the main list.
  // "active" = recurring series under way but nothing on air right now
  // (between sessions). "live" = a session is actually running.
  computedStatus?: "not_started" | "active" | "live" | "completed";
  /**
   * Who currently holds this session's host seat, or null when it's open.
   *
   * Only one person can run a session — the creator or a delegated
   * `live_streams` admin, whoever entered first. This is what lets the console
   * say "Hosted by X" and offer Join instead of Start, rather than letting a
   * second person click Start and collect a 409.
   */
  sessionHost?: {
    id: string;
    name: string;
    email: string;
    profilePicture?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopRegistration {
  _id: string;
  workshopId: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
  status: "registered" | "attended" | "cancelled";
  hasPaid: boolean;
  paymentId?: string;
  amountPaid?: number;
  registeredAt: string;
  createdAt: string;
}

// ============= Founder Live Streams table =============

/**
 * The four series-level statuses the founder console renders.
 *
 * `active` means "under way right now". `deleted` is a soft delete: the row
 * stays in this table wearing a Deleted badge (there is no separate Trash
 * page), and applies both to a deleted stream and to a single deleted session
 * of a recurring series.
 */
export type FounderStreamStatus =
  | "active"
  | "completed"
  | "deleted"
  | "not_started";

export type FounderStreamView = "one-time" | "recurring";

export interface FounderStreamRow {
  /** Workshop id for a One Time row; `<workshopId>:<sessionISO>` for a
   *  recurring session row, so row keys stay unique. */
  _id: string;
  /** Always the underlying workshop — what a row click needs to open. */
  workshopId: string;
  title: string;
  thumbnail?: string;
  isRecurring: boolean;
  /** Recurring session rows only. */
  sessionNumber?: number;
  /** The canonical UTC-midnight slot key. Does NOT move when a session is
   *  rescheduled — `schedule.date` is where it now runs. */
  sessionDate?: string;
  /** This session carries per-session edits. */
  isEdited?: boolean;
  /** Set when the session was moved off its slot; value is the ORIGINAL key. */
  rescheduledFrom?: string;
  /** Per-session speaker override. `host` stays the series host regardless. */
  sessionSpeaker?: { name: string; avatar?: string; bio?: string };
  host: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    country?: string;
    profilePicture?: string;
  } | null;
  communities: Array<{ id: string; title: string; icon?: string }>;
  schedule: {
    date: string;
    startTime: string;
    endTime: string;
    timezone: string;
    nextSessionDate: string | null;
    recurrenceLabel?: string;
    totalSessions?: number;
    completedSessions?: number;
  };
  status: FounderStreamStatus;
  sessionHost: { id: string; name: string; email: string } | null;
  payment: { isFree: boolean; price: number; currency: string; country?: string };
  totalEnrollments: number;
  totalAttendees: number;
  garageTvViews: number;
  enrollmentRevenue: { amountUsd: number; transactions: number };
  enrollmentAffiliate: {
    amountUsd: number;
    affiliates: number;
    payments: number;
  };
  liveSellingProducts: { products: number; customers: number };
  liveSellingStats: {
    revenueUsd: number;
    auctions: number;
    standardSales: number;
  };
  liveSellingAffiliates: {
    amountUsd: number;
    affiliates: number;
    payments: number;
  };
}

/**
 * The footer strip.
 *
 * `unique*` are only populated on the RECURRING view: a series double-counts
 * by design (one person in six sessions is six enrolments and one human), and
 * both readings matter. Across unrelated One Time streams "unique" means
 * nothing, so they come back 0 there and the footer omits them.
 */
export interface FounderStreamTotals {
  /** One Time: streams. Recurring: sessions of the selected series. */
  streams: number;
  enrollments: number;
  uniqueEnrollments: number;
  attendees: number;
  uniqueAttendees: number;
  garageTvViews: number;
  uniqueGarageTvViews: number;
  enrollmentRevenueUsd: number;
  enrollmentAffiliateUsd: number;
  liveSellingRevenueUsd: number;
}

/** One entry in the "Recurring Live Streams" drill-down. */
export interface FounderRecurringSeries {
  _id: string;
  title: string;
  thumbnail?: string;
  host: { id: string; name: string; profilePicture?: string } | null;
  totalSessions: number;
  enrollmentType: "once" | "per_session";
}

/**
 * The block the recurring view renders ABOVE its table.
 *
 * Every session row in that view belongs to one series, so the facts that
 * don't vary session to session — host, communities, and (for enrol-once
 * series) the price and affiliate split — are printed once up here instead of
 * being repeated down a column.
 */
export interface FounderSeriesHeader {
  _id: string;
  title: string;
  thumbnail?: string;
  host: {
    id: string;
    name: string;
    email: string;
    profilePicture?: string;
  } | null;
  enrollmentType: "once" | "per_session";
  status: FounderStreamStatus;
  communities: Array<{ id: string; title: string; icon?: string }>;
  payment: { isFree: boolean; price: number; currency: string; country?: string };
  /** Active CombPlan share and what it pays on one enrolment. `null` when the
   *  series has no plan — not the same as a plan paying 0%. */
  commission: { percent: number; amount: number } | null;
  totalSessions: number;
}

export interface FounderStreamTableResponse {
  success: boolean;
  rows: FounderStreamRow[];
  /** Rows matching the filters — what the footer counts, not the page. */
  total: number;
  totals: FounderStreamTotals;
  counts: { oneTime: number; recurring: number };
  /** Populated on the recurring view. */
  series: FounderRecurringSeries[];
  selectedSeriesId: string | null;
  /** Recurring view only; null on One Time and when no series exists. */
  selectedSeries: FounderSeriesHeader | null;
}

/**
 * Founder console → Live Streams grid.
 *
 * One request serves the page of rows, the totals for the WHOLE filtered set,
 * both view counts, and (on the recurring view) the series picker's list — so
 * switching views or drilling into a series never needs a second endpoint.
 */
export async function getFounderStreamTable(
  orgId: string,
  options: {
    view?: FounderStreamView;
    seriesId?: string;
    search?: string;
    /** Per-column header filters keyed by column id (`name`, `host`,
     *  `communities`). Sent to the server because the table paginates —
     *  filtering in the browser would search one page out of many. */
    columnFilters?: Record<string, string>;
    status?: FounderStreamStatus | "all" | "draft";
    payment?: "all" | "free" | "paid";
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {},
): Promise<FounderStreamTableResponse> {
  const params = new URLSearchParams({ orgId });
  if (options.view) params.set("view", options.view);
  if (options.seriesId) params.set("seriesId", options.seriesId);
  if (options.search) params.set("search", options.search);
  for (const [id, value] of Object.entries(options.columnFilters || {})) {
    if (value.trim()) params.set(`filter[${id}]`, value.trim());
  }
  if (options.status && options.status !== "all")
    params.set("status", options.status);
  if (options.payment && options.payment !== "all")
    params.set("payment", options.payment);
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.sortBy) params.set("sortBy", options.sortBy);
  if (options.sortOrder) params.set("sortOrder", options.sortOrder);

  return fetchFromBackend(`/workshops/founder-table?${params.toString()}`);
}

// ============= Workshop APIs =============

export async function getWorkshops(
  orgId: string,
  options?: {
    channelId?: string;
    upcoming?: boolean;
    limit?: number;
    offset?: number;
    /** Narrow to the caller's own registrations on the server. The Enrolled
     *  tab must set this: without it the row limit bounds every accessible
     *  workshop and the filtering happens after the page is already chosen,
     *  so an enrolment past the limit never arrives. */
    enrolledOnly?: boolean;
  },
): Promise<{
  workshops: Workshop[];
  total: number;
  isFounder: boolean;
}> {
  const params = new URLSearchParams({ orgId });
  if (options?.channelId) params.append("channelId", options.channelId);
  if (options?.upcoming !== undefined)
    params.append("upcoming", String(options.upcoming));
  if (options?.enrolledOnly) params.append("enrolledOnly", "true");
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());

  return fetchFromBackend(`/workshops?${params.toString()}`);
}

export async function getWorkshop(
  workshopId: string,
): Promise<{ workshop: Workshop }> {
  return fetchFromBackend(`/workshops/${workshopId}`);
}

export async function createWorkshop(
  orgId: string,
  data: {
    title: string;
    description?: string;
    thumbnail?: string;
    galleryImages?: string[];
    videoUrl?: string;
    videoFile?: string;
    date: string;
    startTime: string;
    endTime: string;
    timezone?: string;
    maxParticipants?: number;
    channelIds?: string[];
    isFree?: boolean;
    price?: number;
    currency?: string;
    gstInclusive?: boolean;
    requireIosPayment?: boolean;
    appleFeeInclusive?: boolean;
    isActive?: boolean;
    recordingMode?: "manual" | "automatic";
    // Recurrence fields
    isRecurring?: boolean;
    recurrencePattern?: RecurrencePattern;
    recurrenceStartDate?: string;
    enrollmentType?: "once" | "per_session";
    // Workshop detail page fields
    rating?: number;
    ratingCount?: number;
    aboutText?: string;
    /** User ids of office members billed as speakers. */
    speakerIds?: string[];
    learningPoints?: string[];
    agenda?: WorkshopAgendaItem[];
    bonuses?: WorkshopBonus[];
    reviews?: WorkshopReview[];
    faqs?: WorkshopFaq[];
    requirements?: string[];
    whatsIncluded?: string[];
    hostRating?: number;
    hostStudents?: string;
    hostWebinars?: string;
    hostExperience?: string;
    emailAlerts?: ProductEmailAlerts;
    founderAlerts?: FounderAlerts;
  },
): Promise<{ workshop: Workshop }> {
  return fetchFromBackend(`/workshops?orgId=${orgId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateWorkshop(
  workshopId: string,
  orgId: string,
  data: {
    title?: string;
    description?: string;
    thumbnail?: string;
    galleryImages?: string[];
    videoUrl?: string;
    videoFile?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    timezone?: string;
    meetingUrl?: string;
    meetingId?: string;
    meetingPassword?: string;
    maxParticipants?: number;
    channelIds?: string[];
    isFree?: boolean;
    price?: number;
    currency?: string;
    gstInclusive?: boolean;
    requireIosPayment?: boolean;
    appleFeeInclusive?: boolean;
    isActive?: boolean;
    // Recurrence fields
    isRecurring?: boolean;
    recurrencePattern?: RecurrencePattern;
    recurrenceStartDate?: string;
    isRecurrenceActive?: boolean;
    enrollmentType?: "once" | "per_session";
    // Workshop detail page fields
    rating?: number | null;
    ratingCount?: number | null;
    aboutText?: string | null;
    /** User ids of office members billed as speakers; [] clears. */
    speakerIds?: string[];
    learningPoints?: string[] | null;
    agenda?: WorkshopAgendaItem[] | null;
    bonuses?: WorkshopBonus[] | null;
    reviews?: WorkshopReview[] | null;
    faqs?: WorkshopFaq[] | null;
    requirements?: string[] | null;
    whatsIncluded?: string[] | null;
    hostRating?: number | null;
    hostStudents?: string | null;
    hostWebinars?: string | null;
    hostExperience?: string | null;
    emailAlerts?: ProductEmailAlerts;
    founderAlerts?: FounderAlerts;
  },
): Promise<{ workshop: Workshop }> {
  return fetchFromBackend(`/workshops/${workshopId}?orgId=${orgId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteWorkshop(
  workshopId: string,
  orgId: string,
): Promise<{ success: boolean }> {
  return fetchFromBackend(`/workshops/${workshopId}?orgId=${orgId}`, {
    method: "DELETE",
  });
}

// Soft-delete API. Nothing is destroyed — a deleted stream or session keeps
// its registrations and revenue and stays visible in the founder table with a
// "Deleted" status. `restoreWorkshop` / `restoreWorkshopSession` still work
// against the backend; there is just no UI wired to them since the Trash page
// was removed.
export async function softDeleteWorkshop(
  workshopId: string,
  orgId: string,
): Promise<{ success: boolean; workshop?: any }> {
  return fetchFromBackend(
    `/workshops/${workshopId}/soft-delete?orgId=${orgId}`,
    { method: "PATCH" },
  );
}

export async function restoreWorkshop(
  workshopId: string,
  orgId: string,
): Promise<{ success: boolean; workshop?: any }> {
  return fetchFromBackend(`/workshops/${workshopId}/restore?orgId=${orgId}`, {
    method: "POST",
  });
}

export async function trashWorkshopSession(
  workshopId: string,
  sessionDate: string,
  orgId: string,
): Promise<{ success: boolean }> {
  return fetchFromBackend(
    `/workshops/${workshopId}/sessions/${sessionDate}/trash?orgId=${orgId}`,
    { method: "POST" },
  );
}

export async function restoreWorkshopSession(
  workshopId: string,
  sessionDate: string,
  orgId: string,
): Promise<{ success: boolean }> {
  return fetchFromBackend(
    `/workshops/${workshopId}/sessions/${sessionDate}/restore?orgId=${orgId}`,
    { method: "POST" },
  );
}

/* ── Per-session editing ─────────────────────────────────────────────────
 *
 * A recurring stream's sessions are computed from its recurrence rule, so
 * they have no id of their own — `sessionDate` (the UTC-midnight day the rule
 * produced) identifies one. That key never changes: moving a session to
 * another day sets `rescheduledDate` and leaves the key alone, because every
 * registration, order and room join is filed against it.
 */

/** One session as it currently reads, with its series fallbacks. */
export interface WorkshopSessionEdit {
  sessionDate: string;
  displayDate: string;
  title: string;
  description?: string;
  thumbnail?: string;
  startTime: string;
  endTime: string;
  timezone: string;
  startDateTime: string;
  endDateTime: string;
  isFree: boolean;
  price: number;
  currency: string;
  speakerName?: string;
  speakerBio?: string;
  speakerAvatar?: string;
  agenda?: Array<{ title: string; duration: string; topics: string[] }>;
  isRescheduled: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  enrollmentType: "once" | "per_session";
}

export interface WorkshopSessionSeriesDefaults {
  title: string;
  description?: string;
  thumbnail?: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isFree: boolean;
  price: number;
  currency: string;
  agenda?: Array<{ title: string; duration: string; topics: string[] }>;
}

/**
 * Fields a per-session edit may set.
 *
 * Omit a key to leave it as-is; send `null` to drop that override and fall
 * back to the series value. That distinction is the whole contract — an
 * omitted key and a null one mean different things.
 */
export interface WorkshopSessionEditPayload {
  title?: string | null;
  description?: string | null;
  thumbnail?: string | null;
  /** ISO date. Moves when the session RUNS, never its identity. */
  rescheduledDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  timezone?: string | null;
  isFree?: boolean | null;
  price?: number | null;
  speakerName?: string | null;
  speakerBio?: string | null;
  speakerAvatar?: string | null;
  agenda?: Array<{ title: string; duration: string; topics: string[] }> | null;
}

export async function getWorkshopSessionDetail(
  workshopId: string,
  sessionDate: string,
  orgId: string,
): Promise<{
  success: boolean;
  sessionDate: string;
  session: WorkshopSessionEdit;
  seriesDefaults: WorkshopSessionSeriesDefaults;
}> {
  return fetchFromBackend(
    `/workshops/${workshopId}/sessions/${encodeURIComponent(
      sessionDate,
    )}/detail?orgId=${orgId}`,
  );
}

export async function updateWorkshopSession(
  workshopId: string,
  sessionDate: string,
  orgId: string,
  payload: WorkshopSessionEditPayload,
): Promise<{ success: boolean; session: WorkshopSessionEdit }> {
  return fetchFromBackend(
    `/workshops/${workshopId}/sessions/${encodeURIComponent(
      sessionDate,
    )}?orgId=${orgId}`,
    // PUT, though the body is a partial patch — the backend registers both
    // verbs on this handler, and PUT is the documented one.
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

/** Drop every per-session edit. Lifecycle history (trashed / started / ended /
 *  viewers) is untouched — this reverts what the session SAYS, not what
 *  happened to it. */
export async function revertWorkshopSession(
  workshopId: string,
  sessionDate: string,
  orgId: string,
): Promise<{ success: boolean; session: WorkshopSessionEdit }> {
  return fetchFromBackend(
    `/workshops/${workshopId}/sessions/${encodeURIComponent(
      sessionDate,
    )}/revert?orgId=${orgId}`,
    { method: "POST" },
  );
}

/**
 * List a webinar's recordings (newest first). Recordings live in the cabinet as
 * OrganizationFile docs, not on the Workshop doc, so this is the only way to
 * resolve a recording id from a workshop id — needed for share links, which
 * must point at /guest/:slug/recording/:recordingId to be playable.
 */
export async function getWorkshopRecordings(workshopId: string): Promise<{
  success: boolean;
  recordings: Array<{
    id: string;
    name: string;
    size?: number;
    createdAt?: string;
    downloadUrl?: string;
    streamUrl?: string;
    isSegmented?: boolean;
    playUrl?: string;
  }>;
}> {
  return fetchFromBackend(`/webinar/${workshopId}/recordings`);
}

export async function deleteWorkshopRecording(
  workshopId: string,
  recordingId: string,
): Promise<{ success: boolean; message?: string }> {
  return fetchFromBackend(`/webinar/${workshopId}/recordings/${recordingId}`, {
    method: "DELETE",
  });
}

/**
 * Update the display title / description / thumbnail for a single webinar
 * recording. Pass an empty string for any field to clear that override.
 */
export async function updateWorkshopRecording(
  workshopId: string,
  recordingId: string,
  body: {
    displayTitle?: string;
    displayDescription?: string;
    displayThumbnail?: string;
  },
): Promise<{
  success: boolean;
  recording?: {
    _id: string;
    displayTitle: string;
    displayDescription: string;
    displayThumbnail: string;
  };
  error?: string;
}> {
  return fetchFromBackend(`/webinar/${workshopId}/recordings/${recordingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ============= Workshop Registration APIs =============

export async function registerForFreeWorkshop(
  workshopId: string,
  orgId: string,
): Promise<{ success: boolean; message: string; alreadyRegistered?: boolean }> {
  return fetchFromBackend(`/workshops/${workshopId}/register?orgId=${orgId}`, {
    method: "POST",
  });
}

export async function createWorkshopOrder(
  workshopId: string,
  orgId: string,
  opts?: { quantity?: number; forReserve?: boolean },
): Promise<{
  success: boolean;
  order: { id: string; amount: number; currency: string };
  workshop: {
    id: string;
    title: string;
    price: number;
  };
  invoiceId?: string;
}> {
  return fetchFromBackend(
    `/workshops/${workshopId}/create-order?orgId=${orgId}`,
    {
      method: "POST",
      body: JSON.stringify({
        quantity: opts?.quantity,
        forReserve: opts?.forReserve,
      }),
    },
  );
}

export async function verifyWorkshopPayment(
  workshopId: string,
  orgId: string,
  paymentData: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
): Promise<{ success: boolean; message: string }> {
  return fetchFromBackend(
    `/workshops/${workshopId}/verify-payment?orgId=${orgId}`,
    {
      method: "POST",
      body: JSON.stringify(paymentData),
    },
  );
}

export async function cancelWorkshopRegistration(
  workshopId: string,
  // For per_session workshops, the specific session to cancel. BE
  // dispatches on workshop.enrollmentType — omit for enrol-once (BE
  // cancels the single full row); required for per_session (else BE
  // rejects with 400).
  sessionDate?: string,
): Promise<{
  success: boolean;
  mode?: "once" | "per_session";
  sessionDate?: string;
}> {
  const qs = sessionDate
    ? `?sessionDate=${encodeURIComponent(sessionDate)}`
    : "";
  return fetchFromBackend(`/workshops/${workshopId}/register${qs}`, {
    method: "DELETE",
  });
}

export async function getWorkshopRegistrations(
  workshopId: string,
  orgId: string,
  options?: {
    limit?: number;
    offset?: number;
  },
): Promise<{
  registrations: WorkshopRegistration[];
  total: number;
}> {
  const params = new URLSearchParams({ orgId });
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());

  return fetchFromBackend(
    `/workshops/${workshopId}/registrations?${params.toString()}`,
  );
}

// ============= Workshop Meeting APIs =============

export async function generateWorkshopMeeting(
  workshopId: string,
  orgId: string,
): Promise<{
  success: boolean;
  meeting: { meetId: string; joinCode: string; joinLink: string };
}> {
  return fetchFromBackend(
    `/workshops/${workshopId}/generate-meeting?orgId=${orgId}`,
    {
      method: "POST",
    },
  );
}

// Founder starts a specific session of a recurring workshop. Extends
// generate-meeting with a sessionDate — BE rotates workshop.currentSessionDate
// to that value so the per-session join gate reads the right session.
export async function startWorkshopSession(
  workshopId: string,
  orgId: string,
  sessionDate: string,
): Promise<{
  success: boolean;
  meeting: { meetId: string; joinCode: string; joinLink: string };
  sessionDate?: string;
}> {
  return fetchFromBackend(
    `/workshops/${workshopId}/generate-meeting?orgId=${orgId}`,
    {
      method: "POST",
      body: JSON.stringify({ sessionDate }),
    },
  );
}

// ============= Recurring Workshop Session APIs =============

export async function getWorkshopSessions(
  workshopId: string,
  options?: {
    limit?: number;
    includePast?: boolean;
  },
): Promise<{
  success: boolean;
  sessions: WorkshopSession[];
  workshop: {
    _id: string;
    title: string;
    enrollmentType: "once" | "per_session";
    meetingUrl?: string;
    isFree: boolean;
    price: number;
  };
}> {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.includePast) params.append("includePast", "true");

  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchFromBackend(`/workshops/${workshopId}/sessions${query}`);
}

export async function registerForSession(
  workshopId: string,
  sessionDate: string,
  orgId: string,
): Promise<{ success: boolean; message: string; alreadyRegistered?: boolean }> {
  return fetchFromBackend(
    `/workshops/${workshopId}/sessions/${sessionDate}/register?orgId=${orgId}`,
    { method: "POST" },
  );
}

export async function createSessionOrder(
  workshopId: string,
  sessionDate: string,
  orgId: string,
): Promise<{
  success: boolean;
  order: { id: string; amount: number; currency: string };
  workshop: {
    id: string;
    title: string;
    price: number;
  };
  sessionDate: string;
}> {
  return fetchFromBackend(
    `/workshops/${workshopId}/sessions/${sessionDate}/create-order?orgId=${orgId}`,
    { method: "POST" },
  );
}

export async function verifySessionPayment(
  workshopId: string,
  sessionDate: string,
  orgId: string,
  paymentData: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
): Promise<{ success: boolean; message: string }> {
  return fetchFromBackend(
    `/workshops/${workshopId}/sessions/${sessionDate}/verify-payment?orgId=${orgId}`,
    {
      method: "POST",
      body: JSON.stringify(paymentData),
    },
  );
}

export async function registerForFullEnrollment(
  workshopId: string,
  orgId: string,
): Promise<{ success: boolean; message: string; alreadyRegistered?: boolean }> {
  return fetchFromBackend(
    `/workshops/${workshopId}/register-full?orgId=${orgId}`,
    {
      method: "POST",
    },
  );
}

export async function createFullEnrollmentOrder(
  workshopId: string,
  orgId: string,
): Promise<{
  success: boolean;
  order: { id: string; amount: number; currency: string };
  workshop: {
    id: string;
    title: string;
    price: number;
  };
}> {
  return fetchFromBackend(
    `/workshops/${workshopId}/create-order-full?orgId=${orgId}`,
    {
      method: "POST",
    },
  );
}

export async function verifyFullEnrollmentPayment(
  workshopId: string,
  orgId: string,
  paymentData: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
): Promise<{ success: boolean; message: string }> {
  return fetchFromBackend(
    `/workshops/${workshopId}/verify-payment-full?orgId=${orgId}`,
    {
      method: "POST",
      body: JSON.stringify(paymentData),
    },
  );
}

export async function checkSessionAccess(
  workshopId: string,
  sessionDate: string,
): Promise<{ success: boolean; hasAccess: boolean; sessionDate: string }> {
  return fetchFromBackend(
    `/workshops/${workshopId}/sessions/${sessionDate}/access`,
  );
}

// ============= Workshop Analytics Types & APIs (Founder Only) =============

export interface WorkshopParticipantAnalytics {
  userId: string;
  name: string;
  email: string;
  profilePicture?: string;
  registeredAt: string;
  enrolledBeforeStart: boolean;
  attended: boolean;
  attendedAt?: string;
  joinedMeetingAt?: string;
  leftMeetingAt?: string;
  durationInMeeting?: number; // in minutes
  hasPaid: boolean;
  amountPaid?: number;
}

export interface WorkshopAnalytics {
  workshopId: string;
  workshopTitle: string;
  workshopDate: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  // Enrollment stats
  totalEnrollments: number;
  enrolledBeforeStart: number;
  enrolledAfterStart: number;
  cancelledEnrollments: number;
  // Attendance stats
  totalAttended: number;
  noShows: number;
  attendanceRate: number; // percentage
  // Revenue
  totalRevenue: number;
  currency: string;
  // Participants
  participants: WorkshopParticipantAnalytics[];
}

export interface SessionAnalytics extends WorkshopAnalytics {
  sessionDate: string;
  // 1-indexed sequence within the workshop's bounded range.
  sessionNumber: number;
  // Time-derived status at read time.
  status: "completed" | "live" | "not_started";
  // Total percentage from the workshop's active CombPlan (0 if none).
  affiliateCommissionPercent: number;
  // Dollars paid out to affiliates for this session. Undefined for
  // enrol-once workshops (revenue isn't split per session; FE renders
  // "—").
  affiliateCommissionPaidUsd?: number;
}

export interface RecurringWorkshopAnalytics {
  workshop: {
    _id: string;
    title: string;
    isRecurring: boolean;
    enrollmentType: "once" | "per_session";
  };
  sessions: SessionAnalytics[];
  aggregated: {
    totalSessions: number;
    totalEnrollments: number;
    totalAttended: number;
    averageAttendanceRate: number;
    totalRevenue: number;
  };
}

/**
 * Get comprehensive analytics for a workshop (founder only)
 */
export async function getWorkshopAnalytics(
  workshopId: string,
  orgId: string,
  sessionDate?: string,
): Promise<{ success: boolean; analytics: WorkshopAnalytics }> {
  const params = new URLSearchParams({ orgId });
  if (sessionDate) params.append("sessionDate", sessionDate);

  return fetchFromBackend(
    `/workshops/${workshopId}/analytics?${params.toString()}`,
  );
}

/**
 * What actually happened during the live session — who was in the room, what
 * they bought, who verified a phone number to buy it, and the chat.
 *
 * Distinct from `getWorkshopAnalytics`, which reports on enrolment: that one
 * counts registrations, and its "attended" figure reads a status nothing in
 * the codebase ever writes. This reads the room itself.
 */
export interface WebinarSessionAnalytics {
  success: boolean;
  workshopId: string;
  sessionDate: string | null;
  summary: {
    attendees: number;
    /** False means nothing was recorded for this session, NOT zero attendees. */
    attendanceRecorded: boolean;
    messages: number;
    chatParticipants: number;
    phoneVerifications: number;
    comboWindowsStarted: number;
    productsPinned: number;
    purchases: number;
    purchasesPaid: number;
    /** Keyed by currency — a session can sell in more than one. */
    revenuePaid: Record<string, number>;
  };
  attendees: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    role: "host" | "panelist" | "attendee";
    sessionDate: string;
    firstJoinedAt: string;
    lastLeftAt: string | null;
    totalSeconds: number;
    minutes: number;
    joinCount: number;
  }>;
  purchases: Array<{
    invoiceId: string;
    invoiceNumber: string | null;
    status: string;
    paid: boolean;
    buyerUserId: string | null;
    buyerEmail: string | null;
    buyerName: string | null;
    itemType: string | null;
    itemId: string | null;
    itemName: string | null;
    itemImage: string | null;
    quantity: number;
    /** Major units — the backend converts from the stored paise/cents. */
    amount: number;
    currency: string;
    sessionDate: string | null;
    purchasedAt: string;
  }>;
  phoneVerifications: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    phone: string;
    itemType: string | null;
    itemId: string | null;
    itemName: string | null;
    source: string;
    startedComboWindow: boolean;
    verifiedAt: string;
  }>;
  pinnedProducts: Array<{
    itemType: string;
    itemId: string;
    name: string | null;
    price: number;
    currency: string;
    firstPinnedAt: string;
    lastPinnedAt: string;
    pinCount: number;
  }>;
  messages: Array<{
    id: string;
    userId: string;
    name: string;
    text: string;
    timestamp: string;
  }>;
}

export async function getWebinarSessionAnalytics(
  workshopId: string,
  sessionDate?: string,
): Promise<WebinarSessionAnalytics> {
  const qs = sessionDate
    ? `?sessionDate=${encodeURIComponent(sessionDate)}`
    : "";
  return fetchFromBackend(`/webinar/${workshopId}/analytics${qs}`);
}

/**
 * Download the attendee list as a CSV file.
 *
 * Fetched into a Blob rather than pointing the browser at the URL: the export
 * is host-only and the token is attached per request, so a plain link or
 * window.open would arrive unauthenticated and 403.
 */
export async function downloadWebinarAttendeesCsv(
  workshopId: string,
  opts?: { sessionDate?: string; includeChat?: boolean },
): Promise<void> {
  const params = new URLSearchParams();
  if (opts?.sessionDate) params.append("sessionDate", opts.sessionDate);
  if (opts?.includeChat) params.append("include", "chat");
  const qs = params.toString() ? `?${params.toString()}` : "";

  const token = getToken();
  const res = await fetch(
    `${API_BASE}/webinar/${workshopId}/attendees.csv${qs}`,
    { headers: { ...(token && { Authorization: `Bearer ${token}` }) } },
  );
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || "Export failed");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendees-${workshopId}${
    opts?.sessionDate ? `-${opts.sessionDate}` : ""
  }.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Get analytics for all sessions of a recurring workshop (founder only)
 */
export async function getRecurringWorkshopAnalytics(
  workshopId: string,
  orgId: string,
  options?: {
    limit?: number;
    offset?: number;
    includePast?: boolean;
  },
): Promise<{ success: boolean } & RecurringWorkshopAnalytics> {
  const params = new URLSearchParams({ orgId });
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset !== undefined)
    params.append("offset", options.offset.toString());
  if (options?.includePast) params.append("includePast", "true");

  return fetchFromBackend(
    `/workshops/${workshopId}/analytics/sessions?${params.toString()}`,
  );
}

/**
 * Sync attendance from meeting participants (founder only)
 */
export async function syncWorkshopAttendance(
  workshopId: string,
  orgId: string,
): Promise<{
  success: boolean;
  message: string;
  synced: number;
  errors: string[];
}> {
  return fetchFromBackend(
    `/workshops/${workshopId}/sync-attendance?orgId=${orgId}`,
    {
      method: "POST",
    },
  );
}

/**
 * Manually mark a user as attended (founder only)
 */
export async function markUserAttended(
  workshopId: string,
  userId: string,
  orgId: string,
  sessionDate?: string,
): Promise<{ success: boolean; message: string }> {
  const params = new URLSearchParams({ orgId });
  if (sessionDate) params.append("sessionDate", sessionDate);

  return fetchFromBackend(
    `/workshops/${workshopId}/mark-attended/${userId}?${params.toString()}`,
    {
      method: "POST",
    },
  );
}

// ============= Course Types =============

export interface QuizOption {
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  _id: string;
  questionText: string;
  questionType: "mcq_single" | "mcq_multi" | "true_false";
  options: QuizOption[];
  explanation?: string;
  points: number;
  relatedChapterId?: string;
}

export interface Quiz {
  questions: QuizQuestion[];
  passingScore: number;
  isRequired: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export interface CourseChapterPdf {
  _id?: string;
  name: string;
  url: string;
  s3Key?: string;
  fileSize?: number;
}

export interface CourseChapter {
  _id: string;
  title: string;
  order: number;
  contentType: "video" | "link" | "text" | "quiz" | "pdf";
  videoUrl?: string;
  videoS3Key?: string;
  linkUrl?: string;
  content?: string;
  duration?: number;
  quiz?: Quiz;
  pdfUrl?: string;
  pdfS3Key?: string;
  pdfs?: CourseChapterPdf[];
}

export interface CourseSection {
  _id: string;
  title: string;
  order: number;
  chapters: CourseChapter[];
}

export interface CourseDigitalAsset {
  _id: string;
  name: string;
  url: string;
  fileType: string;
  fileSize?: number;
}

export interface CourseCreator {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface CourseInclude {
  icon: string;
  text: string;
}

export interface CourseReview {
  _id?: string;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  rating: number;
  text: string;
  helpfulCount?: number;
  createdAt?: string;
}

export interface Course {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  galleryImages?: string[];
  videoUrl?: string;
  videoFile?: string;
  status: "draft" | "published" | "archived";
  organizationId: string;
  createdBy: CourseCreator;
  channelIds: string[];
  isPaid: boolean;
  isFree: boolean;
  price: number;
  currency: string;
  // GST semantics for INR courses. true = listed price already includes
  // 18% GST; false = 18% added on top at checkout. USD courses ignore.
  gstInclusive?: boolean;
  // iOS payment surcharge fields (dormant until iOS wiring lands).
  requireIosPayment?: boolean;
  appleFeeInclusive?: boolean;
  sections: CourseSection[];
  digitalAssets: CourseDigitalAsset[];
  totalDuration: number;
  totalChapters: number;
  enrolledStudents: number;
  // Detail page fields
  rating?: number;
  ratingCount?: number;
  whatYouWillLearn?: string[];
  requirements?: string[];
  courseIncludes?: CourseInclude[];
  reviews?: CourseReview[];
  emailAlerts?: ProductEmailAlerts;
  founderAlerts?: FounderAlerts;
  // Founder-configurable post-payment page — same shape Product uses.
  thankYouPage?: ThankYouPage;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterProgress {
  chapterId: string;
  sectionId: string;
  completed: boolean;
  completedAt?: string;
  watchTime?: number;
  lastPosition?: number;
}

export interface QuizAttemptAnswer {
  questionId: string;
  selectedOptions: number[];
  isCorrect: boolean;
}

export interface QuizAttempt {
  chapterId: string;
  sectionId: string;
  attemptNumber: number;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  answers: QuizAttemptAnswer[];
  completedAt: string;
}

export interface CourseEnrollment {
  _id: string;
  courseId: string | Course;
  userId: string;
  organizationId: string;
  status: "enrolled" | "completed" | "dropped";
  enrolledAt: string;
  completedAt?: string;
  isPaid: boolean;
  amountPaid?: number;
  currency?: string;
  paymentId?: string;
  paymentStatus?: "pending" | "completed" | "failed" | "refunded";
  chaptersProgress: ChapterProgress[];
  completedChapters: number;
  totalChapters: number;
  progressPercentage: number;
  lastAccessedAt: string;
  lastChapterId?: string;
  lastSectionId?: string;
  quizAttempts?: QuizAttempt[];
}

export interface CourseStats {
  totalEnrollments: number;
  completedCount: number;
  averageProgress: number;
}

// ============= Course APIs (Founder - Management) =============

export async function createCourse(data: {
  title: string;
  description?: string;
  coverImage?: string;
  galleryImages?: string[];
  videoUrl?: string;
  videoFile?: string;
  channelIds?: string[];
  isPaid?: boolean;
  price?: number;
  currency?: string;
  rating?: number;
  ratingCount?: number;
  whatYouWillLearn?: string[];
  requirements?: string[];
  courseIncludes?: CourseInclude[];
  reviews?: CourseReview[];
  emailAlerts?: ProductEmailAlerts;
  founderAlerts?: FounderAlerts;
}): Promise<Course> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/courses${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getManageCourses(options?: {
  status?: "draft" | "published" | "archived";
  limit?: number;
  skip?: number;
}): Promise<Course[]> {
  const params = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) params.append("orgId", orgId);
  if (options?.status) params.append("status", options.status);
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.skip) params.append("skip", options.skip.toString());

  const query = params.toString();
  return fetchFromBackend(`/courses/manage${query ? `?${query}` : ""}`);
}

export async function getCourse(courseId: string): Promise<Course> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/courses/${courseId}${query}`);
}

export async function updateCourse(
  courseId: string,
  data: {
    title?: string;
    description?: string;
    coverImage?: string;
    galleryImages?: string[];
    videoUrl?: string;
    videoFile?: string;
    status?: "draft" | "published" | "archived";
    channelIds?: string[];
    isPaid?: boolean;
    price?: number;
    currency?: string;
    rating?: number;
    ratingCount?: number;
    whatYouWillLearn?: string[];
    requirements?: string[];
    courseIncludes?: CourseInclude[];
    reviews?: CourseReview[];
    emailAlerts?: ProductEmailAlerts;
    founderAlerts?: FounderAlerts;
    // Tri-state: undefined leaves it, null clears (BE unsets), object writes.
    thankYouPage?: ThankYouPage | null;
  },
): Promise<Course> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/courses/${courseId}${query}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCourse(
  courseId: string,
): Promise<{ success: boolean }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/courses/${courseId}${query}`, {
    method: "DELETE",
  });
}

export async function cloneCourse(courseId: string): Promise<Course> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/courses/${courseId}/clone${query}`, {
    method: "POST",
  });
}

// ============= Course Section APIs =============

export async function addCourseSection(
  courseId: string,
  title: string,
): Promise<Course> {
  return fetchFromBackend(`/courses/${courseId}/sections`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function updateCourseSection(
  courseId: string,
  sectionId: string,
  title: string,
): Promise<Course> {
  return fetchFromBackend(`/courses/${courseId}/sections/${sectionId}`, {
    method: "PUT",
    body: JSON.stringify({ title }),
  });
}

export async function deleteCourseSection(
  courseId: string,
  sectionId: string,
): Promise<Course> {
  return fetchFromBackend(`/courses/${courseId}/sections/${sectionId}`, {
    method: "DELETE",
  });
}

export async function reorderCourseSections(
  courseId: string,
  sectionIds: string[],
): Promise<Course> {
  return fetchFromBackend(`/courses/${courseId}/sections/reorder`, {
    method: "POST",
    body: JSON.stringify({ sectionIds }),
  });
}

// ============= Course Chapter APIs =============

export async function addCourseChapter(
  courseId: string,
  sectionId: string,
  data: {
    title: string;
    contentType?: "video" | "link" | "text" | "quiz" | "pdf";
    videoUrl?: string;
    videoS3Key?: string;
    linkUrl?: string;
    content?: string;
    duration?: number;
    quiz?: any;
    pdfUrl?: string;
    pdfS3Key?: string;
    pdfs?: CourseChapterPdf[];
  },
): Promise<Course> {
  return fetchFromBackend(
    `/courses/${courseId}/sections/${sectionId}/chapters`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function updateCourseChapter(
  courseId: string,
  sectionId: string,
  chapterId: string,
  data: {
    title?: string;
    contentType?: "video" | "link" | "text" | "quiz" | "pdf";
    videoUrl?: string;
    videoS3Key?: string;
    linkUrl?: string;
    content?: string;
    duration?: number;
    quiz?: any;
    pdfUrl?: string;
    pdfS3Key?: string;
    pdfs?: CourseChapterPdf[];
  },
): Promise<Course> {
  return fetchFromBackend(
    `/courses/${courseId}/sections/${sectionId}/chapters/${chapterId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}

export async function deleteCourseChapter(
  courseId: string,
  sectionId: string,
  chapterId: string,
): Promise<Course> {
  return fetchFromBackend(
    `/courses/${courseId}/sections/${sectionId}/chapters/${chapterId}`,
    {
      method: "DELETE",
    },
  );
}

export async function reorderCourseChapters(
  courseId: string,
  sectionId: string,
  chapterIds: string[],
): Promise<Course> {
  return fetchFromBackend(
    `/courses/${courseId}/sections/${sectionId}/chapters/reorder`,
    {
      method: "POST",
      body: JSON.stringify({ chapterIds }),
    },
  );
}

// ============= Course Video Upload APIs =============

/**
 * Get a presigned URL for small video uploads (<100MB).
 * Browser uploads directly to S3 using this URL.
 */
export async function getCourseVideoUploadUrl(data: {
  courseId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
  return fetchFromBackend("/courses/video/presigned-upload", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Initiate a multipart upload for large videos (>=100MB).
 * Returns uploadId and presigned URLs for each part.
 */
export async function initiateCourseVideoMultipart(data: {
  courseId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}): Promise<{
  uploadId: string;
  s3Key: string;
  partSize: number;
  totalParts: number;
  partUrls: { partNumber: number; url: string }[];
  expiresIn: number;
}> {
  return fetchFromBackend("/courses/video/multipart/initiate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Complete a multipart upload after all parts have been uploaded.
 */
export async function completeCourseVideoMultipart(data: {
  s3Key: string;
  uploadId: string;
  parts: { partNumber: number; etag: string }[];
}): Promise<{ success: boolean; s3Key: string }> {
  return fetchFromBackend("/courses/video/multipart/complete", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Abort a multipart upload and clean up uploaded parts.
 */
export async function abortCourseVideoMultipart(data: {
  s3Key: string;
  uploadId: string;
}): Promise<{ success: boolean }> {
  return fetchFromBackend("/courses/video/multipart/abort", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get a signed streaming URL for video playback.
 * Returns a time-limited URL (4 hours) for the native video player.
 */
export async function getCourseVideoStreamUrl(
  s3Key: string,
): Promise<{ url: string; expiresAt: string }> {
  return fetchFromBackend(
    `/courses/video/signed-url?key=${encodeURIComponent(s3Key)}`,
  );
}

/**
 * Delete a video from S3.
 */
export async function deleteCourseVideo(
  s3Key: string,
): Promise<{ success: boolean }> {
  return fetchFromBackend(
    `/courses/video/delete?key=${encodeURIComponent(s3Key)}`,
    { method: "DELETE" },
  );
}

// ============= Standalone Video Types =============

export interface StandaloneVideo {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  videoUrl?: string;
  videoS3Key?: string;
  sourceType: "upload" | "link";
  duration?: number;
  orgId: string;
  createdBy: {
    _id: string;
    name: string;
    email?: string;
    avatar?: string;
    profilePicture?: string;
  };
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============= Standalone Video APIs =============

export async function createStandaloneVideo(data: {
  title: string;
  description?: string;
  thumbnail?: string;
  videoUrl?: string;
  videoS3Key?: string;
  sourceType: "upload" | "link";
  duration?: number;
}): Promise<{ success: boolean; video: StandaloneVideo }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/standalone-videos${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getStandaloneVideos(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ videos: StandaloneVideo[]; total: number; isFounder: boolean }> {
  const params = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) params.append("orgId", orgId);
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());
  const query = params.toString();
  return fetchFromBackend(`/standalone-videos${query ? `?${query}` : ""}`);
}

export async function getStandaloneVideo(
  id: string,
): Promise<{ video: StandaloneVideo }> {
  return fetchFromBackend(`/standalone-videos/${id}`);
}

export async function updateStandaloneVideo(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    thumbnail: string;
    videoUrl: string;
    videoS3Key: string;
    sourceType: "upload" | "link";
    duration: number;
    isPublished: boolean;
  }>,
): Promise<{ success: boolean; video: StandaloneVideo }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/standalone-videos/${id}${query}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteStandaloneVideo(
  id: string,
): Promise<{ success: boolean }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/standalone-videos/${id}${query}`, {
    method: "DELETE",
  });
}

// ============= Video Link Preview API =============

export interface VideoLinkPreview {
  success: boolean;
  title?: string;
  author?: string;
  thumbnail?: string;
  provider?: string;
  duration?: number;
  error?: string;
}

/**
 * Fetch oEmbed metadata for a YouTube/Vimeo link in a single backend call.
 * Returns title, author, thumbnail, provider, duration.
 */
export async function getVideoLinkPreview(
  url: string,
): Promise<VideoLinkPreview> {
  return fetchFromBackend(
    `/standalone-videos/link-preview?url=${encodeURIComponent(url)}`,
  );
}

// ============= Standalone Video Upload APIs =============

export async function getStandaloneVideoUploadUrl(data: {
  fileName: string;
  fileSize: number;
  contentType: string;
}): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/standalone-videos/presigned-upload${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function initiateStandaloneVideoMultipart(data: {
  fileName: string;
  fileSize: number;
  contentType: string;
}): Promise<{
  uploadId: string;
  s3Key: string;
  partSize: number;
  totalParts: number;
  partUrls: { partNumber: number; url: string }[];
  expiresIn: number;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/standalone-videos/multipart/initiate${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function completeStandaloneVideoMultipart(data: {
  s3Key: string;
  uploadId: string;
  parts: { partNumber: number; etag: string }[];
}): Promise<{ success: boolean; s3Key: string }> {
  return fetchFromBackend("/standalone-videos/multipart/complete", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function abortStandaloneVideoMultipart(data: {
  s3Key: string;
  uploadId: string;
}): Promise<{ success: boolean }> {
  return fetchFromBackend("/standalone-videos/multipart/abort", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getStandaloneVideoStreamUrl(
  s3Key: string,
): Promise<{ url: string; expiresAt: string }> {
  return fetchFromBackend(
    `/standalone-videos/signed-url?key=${encodeURIComponent(s3Key)}`,
  );
}

export async function deleteStandaloneVideoFile(
  s3Key: string,
): Promise<{ success: boolean }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/standalone-videos/video/delete?key=${encodeURIComponent(s3Key)}${query ? `&${query.replace("?", "")}` : ""}`,
    { method: "DELETE" },
  );
}

// ============= Playlist Types =============

export interface PlaylistVideoEntry {
  videoSource: "workshop" | "standalone" | "courseVideo";
  videoId: string;
  courseId?: string;
  sectionId?: string;
  chapterId?: string;
}

export interface PlaylistVideo {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  date?: string;
  duration?: number;
  videoUrl?: string;
  videoS3Key?: string;
  sourceType?: string;
  contentType?: string;
  _videoSource: "workshop" | "standalone" | "courseVideo";
  // Course video specific fields
  courseId?: string;
  courseTitle?: string;
  sectionTitle?: string;
  isPaid?: boolean;
  isFree?: boolean;
  price?: number;
  currency?: string;
}

export interface Playlist {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  organizationId: string;
  createdBy: {
    _id: string;
    name: string;
    email?: string;
    avatar?: string;
    profilePicture?: string;
  };
  type: "founder" | "learner";
  isPublished: boolean;
  videoEntries?: PlaylistVideoEntry[];
  videoIds: string[]; // Legacy
  videos?: PlaylistVideo[]; // Populated when fetching single playlist
  videoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableVideos {
  livestream: {
    _id: string;
    title: string;
    description?: string;
    thumbnail?: string;
    date: string;
    startTime: string;
    endTime: string;
    createdAt: string;
  }[];
  uploaded: {
    _id: string;
    title: string;
    description?: string;
    thumbnail?: string;
    videoUrl?: string;
    videoS3Key?: string;
    sourceType: string;
    duration?: number;
    createdAt: string;
  }[];
  courseVideos: {
    _id: string;
    title: string;
    thumbnail?: string;
    duration?: number;
    videoUrl?: string;
    videoS3Key?: string;
    courseId: string;
    courseTitle: string;
    sectionId: string;
    sectionTitle: string;
    isPaid: boolean;
    isFree: boolean;
    price?: number;
    currency?: string;
  }[];
}

// ============= Playlist APIs =============

export async function getPlaylists(): Promise<{
  playlists: Playlist[];
  isFounder: boolean;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/playlists${query}`);
}

export async function getPlaylist(
  playlistId: string,
): Promise<{ playlist: Playlist }> {
  return fetchFromBackend(`/playlists/${playlistId}`);
}

/**
 * Get all available videos categorized by source (founder only).
 */
export async function getPlaylistAvailableVideos(): Promise<AvailableVideos> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/playlists/available-videos${query}`);
}

export async function createPlaylist(data: {
  title: string;
  description?: string;
  coverImage?: string;
  isPublished?: boolean;
  videoEntries?: PlaylistVideoEntry[];
  videoIds?: string[];
}): Promise<{ playlist: Playlist }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/playlists${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePlaylist(
  playlistId: string,
  data: Partial<{
    title: string;
    description: string;
    coverImage: string;
    isPublished: boolean;
    videoEntries: PlaylistVideoEntry[];
    videoIds: string[];
  }>,
): Promise<{ playlist: Playlist }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/playlists/${playlistId}${query}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePlaylist(
  playlistId: string,
): Promise<{ success: boolean }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/playlists/${playlistId}${query}`, {
    method: "DELETE",
  });
}

export async function addVideosToPlaylist(
  playlistId: string,
  videoEntries: PlaylistVideoEntry[],
): Promise<{ playlist: Playlist }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/playlists/${playlistId}/videos${query}`, {
    method: "POST",
    body: JSON.stringify({ videoEntries }),
  });
}

export async function removeVideoFromPlaylist(
  playlistId: string,
  videoId: string,
  videoSource?: string,
): Promise<{ playlist: Playlist }> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);
  if (videoSource) params.append("videoSource", videoSource);
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchFromBackend(
    `/playlists/${playlistId}/videos/${videoId}${query}`,
    {
      method: "DELETE",
    },
  );
}

export async function reorderPlaylistVideos(
  playlistId: string,
  videoEntries: PlaylistVideoEntry[],
): Promise<{ playlist: Playlist }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/playlists/${playlistId}/videos/reorder${query}`, {
    method: "POST",
    body: JSON.stringify({ videoEntries }),
  });
}

/**
 * Learner quick-add: auto-creates "My Playlist" if needed, adds video to it.
 * Supports both legacy workshopId and new videoEntry format.
 */
export async function quickAddToPlaylist(
  videoEntry: PlaylistVideoEntry,
): Promise<{ playlist: Playlist }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/playlists/quick-add${query}`, {
    method: "POST",
    body: JSON.stringify({ videoEntry }),
  });
}

// ============= Quiz APIs =============

export interface QuizSubmitResult {
  success: boolean;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  attemptNumber: number;
  results: {
    questionId: string;
    isCorrect: boolean;
    correctOptions: number[];
    explanation?: string;
    relatedChapterId?: string;
  }[];
}

export async function submitQuizAttempt(
  courseId: string,
  chapterId: string,
  sectionId: string,
  answers: { questionId: string; selectedOptions: number[] }[],
): Promise<QuizSubmitResult> {
  return fetchFromBackend(`/courses/${courseId}/quiz/${chapterId}/submit`, {
    method: "POST",
    body: JSON.stringify({ sectionId, answers }),
  });
}

export interface QuizAnalyticsData {
  success: boolean;
  quizzes: {
    chapterId: string;
    chapterTitle: string;
    sectionId: string;
    sectionTitle: string;
    totalAttempts: number;
    uniqueStudents: number;
    passRate: number;
    averageScore: number;
    questionStats: {
      questionId: string;
      questionText: string;
      correctRate: number;
      totalAnswered: number;
    }[];
  }[];
}

export async function getQuizAnalytics(
  courseId: string,
): Promise<QuizAnalyticsData> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/courses/${courseId}/quiz-analytics${query}`);
}

// ============= Study Session Types =============

export interface StudySession {
  _id: string;
  userId: string;
  organizationId: string;
  courseId: string;
  chapterId?: string;
  sectionId?: string;
  startedAt: string;
  endedAt?: string;
  duration: number;
  lastHeartbeat: string;
  courseTitle: string;
  chapterTitle?: string;
}

export interface StudyStats {
  weeklyTime: number[]; // minutes per day [Mon..Sun]
  totalTimeToday: number; // minutes
  streakDays: number;
  streakDates: string[];
  recentSessions: {
    courseTitle: string;
    chapterTitle: string;
    startedAt: string;
    endedAt: string;
    duration: number;
  }[];
  activeSession: {
    sessionId: string;
    courseTitle: string;
    chapterTitle: string;
    startedAt: string;
    elapsedSeconds: number;
  } | null;
}

// ============= Study Session APIs =============

export async function startStudySession(data: {
  courseId: string;
  chapterId?: string;
  sectionId?: string;
  courseTitle: string;
  chapterTitle?: string;
}): Promise<StudySession> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/study-sessions/start${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function endStudySession(
  sessionId?: string,
): Promise<StudySession> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/study-sessions/end${query}`, {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function studySessionHeartbeat(data?: {
  chapterId?: string;
  sectionId?: string;
  chapterTitle?: string;
}): Promise<{ ok: boolean; sessionId: string }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/study-sessions/heartbeat${query}`, {
    method: "PATCH",
    body: JSON.stringify(data || {}),
  });
}

export async function getStudyStats(): Promise<StudyStats> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/study-sessions/stats${query}`);
}

// ============= Course APIs (Main - Returns courses + founder status) =============

export async function getCourses(channelIds?: string[]): Promise<{
  courses: Course[];
  isFounder: boolean;
}> {
  const params = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) {
    params.append("orgId", orgId);
  }
  if (channelIds && channelIds.length > 0) {
    params.append("channelIds", channelIds.join(","));
  }
  const query = params.toString();
  return fetchFromBackend(`/courses${query ? `?${query}` : ""}`);
}

// ============= Course Enrollment APIs =============

export async function enrollInCourse(
  courseId: string,
  data?: {
    isPaid?: boolean;
    amountPaid?: number;
    currency?: string;
    paymentId?: string;
  },
): Promise<CourseEnrollment> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/courses/${courseId}/enroll${query}`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  });
}

// Create Razorpay order for course enrollment
export async function createCourseRazorpayOrder(
  courseId: string,
  opts?: { quantity?: number; forReserve?: boolean },
): Promise<{
  success: boolean;
  order: { id: string; amount: number; currency: string };
  course: {
    id: string;
    title: string;
    price: number;
  };
  invoiceId?: string;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/courses/${courseId}/create-order${query}`, {
    method: "POST",
    body: JSON.stringify({
      quantity: opts?.quantity,
      forReserve: opts?.forReserve,
    }),
  });
}

// Verify payment and complete course enrollment
export async function verifyCoursePayment(
  courseId: string,
  data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
): Promise<{
  success: boolean;
  message: string;
  enrollment: CourseEnrollment;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/courses/${courseId}/verify-payment${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getCourseEnrollment(
  courseId: string,
): Promise<CourseEnrollment | null> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/courses/${courseId}/enrollment${query}`);
}

export async function getMyEnrollments(): Promise<CourseEnrollment[]> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/courses/enrollments/me${query}`);
}

// ============= Course Progress APIs =============

export async function markChapterComplete(
  courseId: string,
  chapterId: string,
  sectionId: string,
): Promise<CourseEnrollment> {
  return fetchFromBackend(
    `/courses/${courseId}/chapters/${chapterId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({ sectionId }),
    },
  );
}

export async function markChapterIncomplete(
  courseId: string,
  chapterId: string,
): Promise<CourseEnrollment> {
  return fetchFromBackend(
    `/courses/${courseId}/chapters/${chapterId}/incomplete`,
    {
      method: "POST",
    },
  );
}

export async function updateChapterProgress(
  courseId: string,
  chapterId: string,
  sectionId: string,
  watchTime: number,
  lastPosition: number,
): Promise<CourseEnrollment> {
  return fetchFromBackend(
    `/courses/${courseId}/chapters/${chapterId}/progress`,
    {
      method: "POST",
      body: JSON.stringify({ sectionId, watchTime, lastPosition }),
    },
  );
}

// ============= Course Digital Asset APIs =============

export async function addCourseAsset(
  courseId: string,
  data: {
    name: string;
    url: string;
    fileType: string;
    fileSize?: number;
  },
): Promise<Course> {
  return fetchFromBackend(`/courses/${courseId}/assets`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function removeCourseAsset(
  courseId: string,
  assetId: string,
): Promise<Course> {
  return fetchFromBackend(`/courses/${courseId}/assets/${assetId}`, {
    method: "DELETE",
  });
}

// ============= Course Stats APIs =============

export async function getCourseStats(courseId: string): Promise<CourseStats> {
  return fetchFromBackend(`/courses/${courseId}/stats`);
}

export async function getAdminCourseEnrollments(courseId?: string): Promise<{
  success: boolean;
  enrollments: CourseEnrollment[];
}> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);
  if (courseId) params.append("courseId", courseId);
  const query = params.toString();
  return fetchFromBackend(
    `/courses/admin/enrollments${query ? `?${query}` : ""}`,
  );
}

// ============= Product Types =============

export interface ProductDigitalAsset {
  _id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
}

export interface ProductDigitalLink {
  _id?: string;
  label: string;
  url: string;
  description?: string;
  linkType?: "static" | "dynamic";
}

export interface ProductKeyFeature {
  icon: string;
  title: string;
  description: string;
}

export interface ProductWhatsInsideGroup {
  icon: string;
  title: string;
  items: string[];
}

export interface ProductReview {
  _id?: string;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  rating: number;
  text: string;
  helpfulCount?: number;
  createdAt?: string;
}

export interface ProductFaq {
  question: string;
  answer: string;
}

// Generic post-purchase thank-you page — same shape on Product AND
// Course. Prefer these names for any new code; the `Product…` aliases
// below are kept as re-exports so existing imports don't break.
export interface ThankYouPageSection {
  heading: string;
  buttonLabel: string;
  buttonUrl: string;
}

export interface ThankYouPage {
  autoRedirect: boolean;
  redirectUrl?: string;
  title?: string;
  message?: string;
  sections?: ThankYouPageSection[];
}

/** @deprecated Use `ThankYouPageSection` — shape is identical. */
export type ProductThankYouPageSection = ThankYouPageSection;
/** @deprecated Use `ThankYouPage` — shape is identical. */
export type ProductThankYouPage = ThankYouPage;

export interface ProductDetailEntry {
  label: string;
  value: string;
}

/**
 * Post-purchase order email config. `templateHtml` is a rendered snapshot of the
 * chosen Network Mail template — that service is separate and authenticated with
 * the browser's JWT, so the backend can't fetch the template itself and sends
 * this stored copy instead (re-synced on every product save).
 */
/**
 * The founder's own "someone joined / enrolled / bought" alert. Deliberately
 * has no template: it goes to the founder, not a customer, so the only
 * choices are on/off and who else gets a copy. Carried by communities,
 * courses, products, live streams, services and events — see the backend's
 * models/founderAlerts.schema.ts.
 */
export interface FounderAlerts {
  enabled: boolean;
  /** Extra addresses CC'd alongside the owner, who is always notified. */
  recipients?: string[];
}

export interface ProductEmailAlerts {
  enabled: boolean;
  templateId: string;
  templateName?: string;
  templateHtml?: string;
  syncedAt?: string;
}

export interface Product {
  _id: string;
  organizationId: string;
  createdBy: any;
  name: string;
  slug: string;
  description?: string;
  sku: string;
  price: number;
  currency: string;
  // GST semantics for INR products (per-unit; scales by quantity).
  gstInclusive?: boolean;
  // iOS payment surcharge fields (dormant until iOS wiring lands).
  requireIosPayment?: boolean;
  appleFeeInclusive?: boolean;
  trackQuantity: boolean;
  quantity?: number;
  lowStockThreshold?: number;
  images: string[];
  videos?: string[];
  youtubeLink?: string;
  categoryName?: string;
  tags: string[];
  isDigital: boolean;
  requiresShipping: boolean;
  deliveryMethod: "physical" | "digital" | "both";
  digitalAssets: ProductDigitalAsset[];
  digitalLinks: ProductDigitalLink[];
  channelIds: string[];
  // Private one-time offer. Non-empty = only these users see the product
  // and each can buy it only once (product disappears from their catalog
  // after they pay). Rejected on the backend when combined with a
  // subscription product.
  allowedUserIds?: string[];
  status: "active" | "draft" | "archived";
  // Product detail page fields
  rating?: number;
  ratingCount?: number;
  downloadCount?: number;
  whatsIncluded?: string[];
  keyFeatures?: ProductKeyFeature[];
  whatsInside?: ProductWhatsInsideGroup[];
  reviews?: ProductReview[];
  faqs?: ProductFaq[];
  productDetails?: ProductDetailEntry[];
  thankYouPage?: ProductThankYouPage;
  emailAlerts?: ProductEmailAlerts;
  founderAlerts?: FounderAlerts;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isDigital: boolean;
  digitalAssets?: Array<{
    name: string;
    fileUrl: string;
    fileType: string;
  }>;
  digitalLinks?: Array<{
    label: string;
    url: string;
    description?: string;
    linkType?: "static" | "dynamic";
    isCustomLink?: boolean;
    customLinkSetBy?: string;
  }>;
}

export interface ProductOrder {
  _id: string;
  orderNumber: string;
  organizationId: string;
  userId:
    | string
    | {
        _id: string;
        name: string;
        email: string;
        profilePicture?: string;
      };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  currency: string;
  status:
    | "pending"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refunded";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentMethod?: string;
  paymentId?: string;
  shippingAddress?: ShippingAddress;
  requiresShipping: boolean;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductOrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
}

// ============= Product APIs (Main - Returns products + founder status) =============

export async function getProducts(options?: {
  status?: "active" | "draft" | "archived" | "all";
  categoryName?: string;
  tags?: string[];
  isDigital?: boolean;
  channelId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "name" | "price";
  sortOrder?: "asc" | "desc";
}): Promise<{
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  isFounder: boolean;
}> {
  const params = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) params.append("orgId", orgId);
  if (options?.status) params.append("status", options.status);
  if (options?.categoryName)
    params.append("categoryName", options.categoryName);
  if (options?.tags && options.tags.length > 0)
    params.append("tags", options.tags.join(","));
  if (options?.isDigital !== undefined)
    params.append("isDigital", String(options.isDigital));
  if (options?.channelId) params.append("channelId", options.channelId);
  if (options?.search) params.append("search", options.search);
  if (options?.page) params.append("page", options.page.toString());
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.sortBy) params.append("sortBy", options.sortBy);
  if (options?.sortOrder) params.append("sortOrder", options.sortOrder);

  const query = params.toString();
  return fetchFromBackend(`/products${query ? `?${query}` : ""}`);
}

export async function getProduct(productId: string): Promise<{
  product: Product;
  isFounder: boolean;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products/${productId}${query}`);
}

// ============= Product APIs (Founder - Management) =============

export async function createProduct(data: {
  name: string;
  description?: string;
  sku?: string;
  price: number;
  currency?: string;
  isSubscription?: boolean;
  subscriptionPeriod?: "weekly" | "monthly" | "quarterly" | "yearly";
  trackQuantity?: boolean;
  quantity?: number;
  lowStockThreshold?: number;
  images?: string[];
  videos?: string[];
  youtubeLink?: string;
  categoryName?: string;
  tags?: string[];
  isDigital?: boolean;
  requiresShipping?: boolean;
  deliveryMethod?: "physical" | "digital" | "both";
  digitalAssets?: Array<{
    name: string;
    fileUrl: string;
    fileType: string;
    fileSize?: number;
  }>;
  digitalLinks?: Array<{
    label: string;
    url: string;
    description?: string;
  }>;
  channelIds?: string[];
  // Non-empty = private one-time offer. See Product.allowedUserIds.
  allowedUserIds?: string[];
  status?: "active" | "draft" | "archived";
  // Product detail page fields
  rating?: number;
  ratingCount?: number;
  downloadCount?: number;
  whatsIncluded?: string[];
  keyFeatures?: ProductKeyFeature[];
  whatsInside?: ProductWhatsInsideGroup[];
  reviews?: ProductReview[];
  faqs?: ProductFaq[];
  productDetails?: ProductDetailEntry[];
  emailAlerts?: ProductEmailAlerts;
  founderAlerts?: FounderAlerts;
}): Promise<{ product: Product }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProduct(
  productId: string,
  data: {
    name?: string;
    description?: string;
    sku?: string;
    price?: number;
    currency?: string;
    trackQuantity?: boolean;
    quantity?: number;
    lowStockThreshold?: number;
    images?: string[];
    videos?: string[];
    youtubeLink?: string;
    categoryName?: string;
    tags?: string[];
    isDigital?: boolean;
    requiresShipping?: boolean;
    deliveryMethod?: "physical" | "digital" | "both";
    digitalAssets?: Array<{
      _id?: string;
      name: string;
      fileUrl: string;
      fileType: string;
      fileSize?: number;
    }>;
    digitalLinks?: Array<{
      _id?: string;
      label: string;
      url: string;
      description?: string;
    }>;
    channelIds?: string[];
    // Non-empty = private one-time offer. Pass `[]` to explicitly clear.
    allowedUserIds?: string[];
    status?: "active" | "draft" | "archived";
    // Product detail page fields
    rating?: number;
    ratingCount?: number;
    downloadCount?: number;
    whatsIncluded?: string[];
    keyFeatures?: ProductKeyFeature[];
    whatsInside?: ProductWhatsInsideGroup[];
    reviews?: ProductReview[];
    faqs?: ProductFaq[];
    productDetails?: ProductDetailEntry[];
    emailAlerts?: ProductEmailAlerts;
    founderAlerts?: FounderAlerts;
  },
): Promise<{ product: Product }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products/${productId}${query}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(
  productId: string,
): Promise<{ success: boolean }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products/${productId}${query}`, {
    method: "DELETE",
  });
}

// ============= Custom Dynamic Link APIs =============

export interface DynamicLinkInfo {
  label: string;
  originalUrl: string;
  description?: string;
  linkType: "static" | "dynamic";
  customLink: {
    _id: string;
    url: string;
    label?: string;
    description?: string;
  } | null;
}

export async function getMyProductLinks(
  productId: string,
): Promise<{ dynamicLinks: DynamicLinkInfo[]; customLinks: any[] }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products/${productId}/my-links${query}`);
}

export async function setMyProductLink(
  productId: string,
  data: {
    digitalLinkLabel: string;
    url: string;
    label?: string;
    description?: string;
  },
): Promise<{ success: boolean; customLink: any }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products/${productId}/my-links${query}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteMyProductLink(
  productId: string,
  digitalLinkLabel: string,
): Promise<{ success: boolean }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/products/${productId}/my-links/${encodeURIComponent(digitalLinkLabel)}${query}`,
    { method: "DELETE" },
  );
}

// ============= Product Order APIs (User) =============

// Create Razorpay order for product purchase
export async function createProductRazorpayOrder(data: {
  items: Array<{ productId: string; quantity: number }>;
  /** When true, purchased units become reserve licenses to assign to others. */
  forReserve?: boolean;
}): Promise<{
  isFree?: boolean;
  invoiceId?: string;
  order: { id: string; amount: number; currency: string };
  products: Array<{
    _id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products/orders/create-razorpay-order${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Verify payment and create product order
export async function verifyProductPayment(data: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  items: Array<{ productId: string; quantity: number }>;
  shippingAddress?: ShippingAddress;
  notes?: string;
}): Promise<{ success: boolean; message: string; order: ProductOrder }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products/orders/verify-payment${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createProductOrder(data: {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress?: ShippingAddress;
  paymentMethod?: string;
  paymentId?: string;
  notes?: string;
}): Promise<{ order: ProductOrder }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products/orders${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMyProductOrders(options?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{
  orders: ProductOrder[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) params.append("orgId", orgId);
  if (options?.page) params.append("page", options.page.toString());
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.status) params.append("status", options.status);

  const query = params.toString();
  return fetchFromBackend(`/products/orders/my${query ? `?${query}` : ""}`);
}

export async function getProductOrder(
  orderId: string,
): Promise<{ order: ProductOrder }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products/orders/${orderId}${query}`);
}

// ============= Product Order APIs (Founder - Management) =============

export async function getAllProductOrders(options?: {
  page?: number;
  limit?: number;
  status?: string;
  paymentStatus?: string;
}): Promise<{
  orders: ProductOrder[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) params.append("orgId", orgId);
  if (options?.page) params.append("page", options.page.toString());
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.status) params.append("status", options.status);
  if (options?.paymentStatus)
    params.append("paymentStatus", options.paymentStatus);

  const query = params.toString();
  return fetchFromBackend(`/products/orders/all${query ? `?${query}` : ""}`);
}

export async function getProductOrderStats(): Promise<ProductOrderStats> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products/orders/stats${query}`);
}

export async function updateProductOrderStatus(
  orderId: string,
  status: ProductOrder["status"],
  trackingInfo?: { trackingNumber?: string; trackingUrl?: string },
): Promise<{ order: ProductOrder }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products/orders/${orderId}/status${query}`, {
    method: "PATCH",
    body: JSON.stringify({ status, ...trackingInfo }),
  });
}

export async function updateProductPaymentStatus(
  orderId: string,
  paymentStatus: ProductOrder["paymentStatus"],
  paymentId?: string,
): Promise<{ order: ProductOrder }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/products/orders/${orderId}/payment${query}`, {
    method: "PATCH",
    body: JSON.stringify({ paymentStatus, paymentId }),
  });
}

// ============= Purchase History Types =============

export interface PurchaseItem {
  _id: string;
  type: "course" | "product";
  itemId?: string;
  itemName: string;
  itemImage?: string;
  orderNumber?: string;
  items?: OrderItem[];
  amount: number;
  currency: string;
  status: string;
  paymentStatus?: string;
  paymentId?: string;
  seller?: {
    _id: string;
    name: string;
    profilePicture?: string;
  };
  createdAt: string;
  metadata?: {
    enrollmentStatus?: string;
    progressPercentage?: number;
    subtotal?: number;
    discount?: number;
    tax?: number;
    shippingCost?: number;
    requiresShipping?: boolean;
    trackingNumber?: string;
    trackingUrl?: string;
  };
}

// ============= Purchase History APIs =============

export async function getPurchaseHistory(options?: {
  limit?: number;
  offset?: number;
  type?: "all" | "course" | "product";
}): Promise<{
  purchases: PurchaseItem[];
  total: number;
  limit: number;
  offset: number;
}> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined)
    params.append("limit", options.limit.toString());
  if (options?.offset !== undefined)
    params.append("offset", options.offset.toString());
  if (options?.type) params.append("type", options.type);

  const query = params.toString();
  return fetchFromBackend(`/wallet/purchases${query ? `?${query}` : ""}`);
}

// ============= Comb Plan (Commission Plan) Types =============

export interface CombPlanLevel {
  level: number;
  percentage: number;
  description?: string;
}

/**
 * How the plan caps commission distributions:
 *   - "perpetual" — every purchase pays commission every time (default;
 *     matches every legacy plan created before this field existed).
 *   - "per_pair_capped" — each affiliate earns commission on at most
 *     `capCount` distributions per unique customer under this plan.
 *     A specific affiliate's future commissions from that same
 *     customer are silently skipped once the cap is hit; other levels
 *     in the same distribution are unaffected.
 */
export type CombPlanCapType = "perpetual" | "per_pair_capped";

export interface CombPlan {
  _id: string;
  orgId: string;
  name: string;
  description?: string;
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event";
  itemId: string;
  levels: CombPlanLevel[];
  totalPercentage: number;
  platformPercentage: number;
  isActive: boolean;
  /** Missing on legacy docs — treat as "perpetual". */
  capType?: CombPlanCapType;
  /** Only meaningful when capType === "per_pair_capped". */
  capCount?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Absent on legacy docs — treat as "levels". */
  planKind?: CombPlanKind;
  /** Only meaningful when planKind === "unilevel_plus". */
  unilevelPlusPercentage?: number;
}

// ============= Comb Plan APIs =============

/**
 * Which comp engine a plan drives.
 *   "levels"        — fixed L1/L2/L3… percentages (the historical behaviour)
 *   "unilevel_plus" — one percentage handed to the Unilevel Plus tree, which
 *                     distributes it by its own rules. Anything the tree does
 *                     not pay out returns to the SELLER, never the platform.
 * Absent on every plan created before this existed, and the backend defaults
 * it to "levels".
 */
export type CombPlanKind = "levels" | "unilevel_plus";

export async function createCombPlan(data: {
  name: string;
  description?: string;
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event";
  itemId: string;
  levels?: CombPlanLevel[];
  capType?: CombPlanCapType;
  capCount?: number;
  planKind?: CombPlanKind;
  /** Only valid when planKind === "unilevel_plus". 0–90. */
  unilevelPlusPercentage?: number;
}): Promise<{ success: boolean; plan: CombPlan }> {
  return fetchFromBackend("/comb-plans", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getCombPlans(options?: {
  itemType?: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event";
  isActive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  plans: CombPlan[];
  total: number;
  limit: number;
  offset: number;
}> {
  const params = new URLSearchParams();
  if (options?.itemType) params.append("itemType", options.itemType);
  if (options?.isActive !== undefined)
    params.append("isActive", String(options.isActive));
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());

  const query = params.toString();
  return fetchFromBackend(`/comb-plans${query ? `?${query}` : ""}`);
}

export async function getCombPlan(
  planId: string,
): Promise<{ success: boolean; plan: CombPlan }> {
  return fetchFromBackend(`/comb-plans/${planId}`);
}

export async function getCombPlanForItem(
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event",
  itemId: string,
): Promise<{ success: boolean; plan: CombPlan | null }> {
  return fetchFromBackend(`/comb-plans/item/${itemType}/${itemId}`);
}

/**
 * Public version of getCombPlanForItem - no auth required
 * Used by guest pages to display affiliate commission info
 */
export async function getCombPlanForItemPublic(
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event",
  itemId: string,
): Promise<{ success: boolean; plan: CombPlan | null }> {
  const response = await fetch(
    `${API_BASE}/comb-plans/public/item/${itemType}/${itemId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      error.error || error.details || `API Error: ${response.status}`,
    );
  }

  return response.json();
}

export async function updateCombPlan(
  planId: string,
  data: {
    name?: string;
    description?: string;
    levels?: CombPlanLevel[];
    isActive?: boolean;
    capType?: CombPlanCapType;
    capCount?: number;
    planKind?: CombPlanKind;
    /** Only valid when planKind === "unilevel_plus". 0–90. */
    unilevelPlusPercentage?: number;
  },
): Promise<{ success: boolean; plan: CombPlan }> {
  return fetchFromBackend(`/comb-plans/${planId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCombPlan(
  planId: string,
): Promise<{ success: boolean }> {
  return fetchFromBackend(`/comb-plans/${planId}`, {
    method: "DELETE",
  });
}

// ============= Wallet APIs =============

export interface StoreWalletData {
  _id: string;
  userId: string;
  orgId:
    | string
    | {
        _id: string;
        name: string;
        icon?: string;
        store?: { name: string; slug: string };
      };
  balance: number;
  currency: string;
  isActive: boolean;
  lastTransactionAt?: string;
}

export interface AffiliateWalletData {
  _id: string;
  userId: string;
  balance: number;
  totalEarnings: number;
  currency: string;
  isActive: boolean;
  lastTransactionAt?: string;
}

export interface WalletTransaction {
  _id: string;
  walletType: "store" | "affiliate";
  type: "credit" | "debit" | "commission" | "transfer" | "withdrawal";
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  note?: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
  relatedUserId?: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
}

/**
 * Get store wallet balance for a specific organization
 */
export async function getStoreWalletBalance(orgId: string): Promise<{
  success: boolean;
  balance: number;
  currency: string;
}> {
  return fetchFromBackend(`/wallet/store/balance?orgId=${orgId}`);
}

/**
 * Get all store wallets for current user across all organizations
 */
export async function getAllStoreWallets(): Promise<{
  success: boolean;
  wallets: StoreWalletData[];
}> {
  return fetchFromBackend("/wallet/store/all");
}

/**
 * Get affiliate wallet balance
 */
export async function getAffiliateWalletBalance(): Promise<{
  success: boolean;
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  currency: string;
  hasPurchasedUnilevelPlus: boolean;
  purchasedAt: string | null;
  redeemableBalance: number;
  lockedBalance: number;
}> {
  return fetchFromBackend("/wallet/affiliate/balance");
}

/**
 * Get all wallets (store + affiliate) for current user
 */
export async function getAllWallets(): Promise<{
  success: boolean;
  storeWallets: StoreWalletData[];
  affiliateWallet: AffiliateWalletData | null;
}> {
  return fetchFromBackend("/wallet/all");
}

/**
 * Get store wallet transactions
 */
export async function getStoreWalletTransactions(
  orgId: string,
  options?: {
    limit?: number;
    offset?: number;
    type?: string;
    /** Cryptobrand orgs hold one wallet per currency (USD parent +
     *  INR/ETH/BTC siblings). Pass explicitly to read a specific
     *  sibling's ledger; omit for the USD parent. */
    currency?: string;
  },
): Promise<{
  success: boolean;
  transactions: WalletTransaction[];
  total: number;
}> {
  const params = new URLSearchParams({ orgId });
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());
  if (options?.type) params.append("type", options.type);
  if (options?.currency) params.append("currency", options.currency);
  return fetchFromBackend(`/wallet/store/transactions?${params.toString()}`);
}

// ─── Multi-currency wallet APIs (cryptobrand offices) ─────────────
//
// Cryptobrand orgs (officeCreatedFromCryptobrand: true) auto-provision
// four sibling wallets per member: USD parent + INR/ETH/BTC. These
// three functions plus the existing `getStoreWalletTransactions` above
// (with `currency`) are the full FE surface for that model.
//
// Non-cryptobrand orgs: `getStoreWalletCurrencies` returns only USD;
// `convertStoreWallet` and `transferStoreWalletMulti` still work but
// only USD → USD is possible on those.

export interface StoreWalletCurrencyEntry {
  currency: string;
  balance: number;
  isParent: boolean;
}

/** GET /wallet/store/currencies?orgId=X — roster of my wallets in one org. */
export async function getStoreWalletCurrencies(orgId: string): Promise<{
  success: boolean;
  orgId: string;
  isCryptobrand: boolean;
  wallets: StoreWalletCurrencyEntry[];
}> {
  return fetchFromBackend(
    `/wallet/store/currencies?orgId=${encodeURIComponent(orgId)}`,
  );
}

export interface WalletTransferMultiResponse {
  success: boolean;
  fromWallet: {
    userId: string;
    orgId: string;
    currency: string;
    balanceBefore: number;
    balanceAfter: number;
    amountDebited: number;
  };
  toWallet: {
    userId: string;
    orgId: string;
    currency: string;
    balanceBefore: number;
    balanceAfter: number;
    amountCredited: number;
  };
  fx: {
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    path: string[];
    capturedAt: string;
  };
  transactionIds: { debit: string; credit: string };
  transferGroupId: string;
}

/** POST /wallet/store/convert — self-transfer between my currency wallets. */
export async function convertStoreWallet(params: {
  fromOrgId: string;
  fromCurrency: string;
  toOrgId: string;
  toCurrency: string;
  amount: number;
  note?: string;
  dedupeKey?: string;
}): Promise<WalletTransferMultiResponse> {
  return fetchFromBackend(`/wallet/store/convert`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** POST /wallet/store/transfer-multi — cross-user transfer with optional FX. */
export async function transferStoreWalletMulti(params: {
  toUserId: string;
  fromOrgId: string;
  fromCurrency: string;
  toOrgId: string;
  toCurrency: string;
  amount: number;
  description: string;
  note?: string;
  dedupeKey?: string;
}): Promise<WalletTransferMultiResponse> {
  return fetchFromBackend(`/wallet/store/transfer-multi`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Get affiliate wallet transactions
 */
export async function getAffiliateWalletTransactions(options?: {
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  transactions: WalletTransaction[];
  total: number;
}> {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());
  return fetchFromBackend(
    `/wallet/affiliate/transactions?${params.toString()}`,
  );
}

// ============= Wallet Transfer APIs =============

/**
 * Transfer credits from current user's store wallet to another user's store wallet
 */
export async function transferStoreCredits(
  toUserId: string,
  orgId: string,
  amount: number,
  description?: string,
  options?: {
    destinationWalletType?: "store" | "content_rewards";
    destinationOrgId?: string;
  },
): Promise<{
  success: boolean;
  message: string;
  newBalance: number;
  senderTransaction: any;
  recipientTransaction?: any;
}> {
  return fetchFromBackend("/wallet/store/transfer", {
    method: "POST",
    body: JSON.stringify({
      toUserId,
      orgId,
      amount,
      description,
      destinationWalletType: options?.destinationWalletType,
      destinationOrgId: options?.destinationOrgId,
    }),
  });
}

/**
 * Self-funded Store Wallet top-up via the existing invoice + payment system.
 * Returns the created invoice + `payUrl` — the caller should redirect to
 * `payUrl` and the standard checkout flow takes over. On successful payment,
 * `fulfillInvoice` credits the caller's StoreWallet for the chosen org.
 *
 * Amount is in **cents** (USD). Server enforces [$1, $10,000].
 */
export async function topUpStoreWallet(body: {
  orgId: string;
  amountCents: number;
}): Promise<{
  success: boolean;
  invoice: {
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    itemCurrency: string;
    status: string;
  };
  payUrl: string;
}> {
  return fetchFromBackend("/wallet/store/topup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ═════════════════════════════════════════════════════════════════════
//   Crypto wallet top-up by persistent address (per-user, per-chain)
// ═════════════════════════════════════════════════════════════════════
//
// Distinct from `topUpStoreWallet` above (invoice + Razorpay/Stripe).
// Backing the "Deposit Crypto" flow on cryptobrand-office wallets:
// each user has one persistent HD deposit address per (currency,
// chain), and sending crypto to it credits their native-currency
// StoreWallet directly (no invoice, no CryptoPaymentRequest).
//
// See garagenew-backend `routes/wallet.ts` for the endpoint contract.

export type CryptoTopupChain =
  | "bitcoin"
  | "ethereum"
  | "polygon"
  | "bsc"
  | "tron";

export interface CryptoTopupAddress {
  currency: "BTC" | "ETH" | "USDT";
  chain: CryptoTopupChain;
  coin: "BTC" | "ETH" | "USDT";
  address: string;
  /** String the FE encodes as a QR. Same as `address` today. */
  qrData: string;
}

/**
 * Persistent per-user deposit address bound to (orgId, currency, chain).
 * For BTC/ETH wallets `chain` is optional (one supported chain each).
 * For USDT wallets `chain` is REQUIRED — one of tron/polygon/bsc.
 * 404 if the user hasn't been provisioned (backfill missing).
 */
export async function getCryptoTopupAddress(params: {
  orgId: string;
  currency: "BTC" | "ETH" | "USDT";
  chain?: CryptoTopupChain;
}): Promise<{ success: true } & CryptoTopupAddress> {
  const q = new URLSearchParams({
    orgId: params.orgId,
    currency: params.currency,
  });
  if (params.chain) q.set("chain", params.chain);
  return fetchFromBackend(`/wallet/store/topup-address?${q.toString()}`);
}

export interface CryptoTopupTransaction {
  _id: string;
  currency: "BTC" | "ETH" | "USDT";
  chain: CryptoTopupChain;
  coin: "BTC" | "ETH" | "USDT";
  address: string;
  amount: number;
  amountAtomic: string;
  amountUsdAtDeposit: number;
  txHash: string;
  fromAddress: string;
  blockNumber: number;
  receivedAt: string;
  status: "credited" | "failed";
}

/**
 * Paginated top-up history for one wallet, newest first. Powers the
 * "Deposits" filter on the transactions section AND the "Recent
 * deposits" strip inside the DepositCryptoSheet.
 */
export async function listCryptoTopupTransactions(params: {
  orgId: string;
  currency: "BTC" | "ETH" | "USDT";
  page?: number;
  limit?: number;
}): Promise<{
  success: true;
  transactions: CryptoTopupTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}> {
  const q = new URLSearchParams({
    orgId: params.orgId,
    currency: params.currency,
  });
  if (params.page !== undefined) q.set("page", String(params.page));
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  return fetchFromBackend(
    `/wallet/store/topup-transactions?${q.toString()}`,
  );
}

/**
 * Wallets a sender may transfer INTO for a given recipient — the recipient's
 * Store wallet per org plus their Content Rewards balance (Affiliate excluded).
 */
export interface TransferTarget {
  walletType: "store" | "content_rewards";
  orgId: string | null;
  orgName: string | null;
}

export async function getTransferTargets(toUserId: string): Promise<{
  success: boolean;
  recipient?: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string | null;
  };
  targets: TransferTarget[];
}> {
  return fetchFromBackend(
    `/wallet/store/transfer-targets?toUserId=${encodeURIComponent(toUserId)}`,
  );
}

/**
 * Transfer redeemable affiliate balance to user's own store wallet
 */
export async function transferAffiliateToStore(
  orgId: string,
  amount: number,
  description?: string,
): Promise<{
  success: boolean;
  message: string;
  affiliateBalance: number;
  storeBalance: number;
}> {
  return fetchFromBackend("/wallet/affiliate/transfer-to-store", {
    method: "POST",
    body: JSON.stringify({ orgId, amount, description }),
  });
}

/**
 * Search users for wallet transfer recipient selection
 */
export async function searchUsersForTransfer(query: string): Promise<{
  success: boolean;
  users: Array<{
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
    hasUnilevelPlus: boolean;
  }>;
}> {
  return fetchFromBackend(
    `/unilevel-plus/users/search?q=${encodeURIComponent(query)}`,
  );
}

// ============= Bank Details APIs =============

export interface BankAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface BankDetailsData {
  _id: string;
  userId: string;
  country: string;
  bankName: string;
  branchAddress: BankAddress;
  routingNumber: string;
  accountNumber: string;
  swiftCode: string;
  ibanNumber: string;
  beneficiaryName: string;
  beneficiaryAddress: BankAddress;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get the current user's bank details
 */
export async function getBankDetails(): Promise<{
  success: boolean;
  bankDetails: BankDetailsData | null;
}> {
  return fetchFromBackend("/wallet/bank-details");
}

/**
 * Create or update bank details
 */
export async function saveBankDetails(
  data: Omit<BankDetailsData, "_id" | "userId" | "createdAt" | "updatedAt">,
): Promise<{ success: boolean; bankDetails: BankDetailsData }> {
  return fetchFromBackend("/wallet/bank-details", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============= Per-Wallet Payout Accounts (bank + crypto) =============

export type WalletAccountWalletType = "store" | "affiliate" | "content_rewards";
export type WalletAccountType = "bank" | "crypto";
export type CryptoNetwork =
  | "ethereum"
  | "tron"
  | "bitcoin"
  | "solana"
  | "bsc"
  | "polygon";

export interface WalletAccountData {
  _id: string;
  userId: string;
  walletType: WalletAccountWalletType;
  orgId: string | null;
  accountType: WalletAccountType;
  label: string;
  // bank
  country: string;
  bankName: string;
  branchAddress: BankAddress;
  routingNumber: string;
  accountNumber: string;
  swiftCode: string;
  ibanNumber: string;
  beneficiaryName: string;
  beneficiaryAddress: BankAddress;
  // crypto
  cryptoNetwork: string;
  cryptoAddress: string;
  cryptoMemo: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Bank-account payload sent to POST /wallet/accounts (account.accountType = "bank"). */
export interface BankAccountInput {
  accountType: "bank";
  label?: string;
  country: string;
  bankName: string;
  branchAddress: BankAddress;
  routingNumber?: string;
  accountNumber: string;
  swiftCode: string;
  ibanNumber?: string;
  beneficiaryName: string;
  beneficiaryAddress: BankAddress;
}

/** Crypto-account payload (account.accountType = "crypto"). */
export interface CryptoAccountInput {
  accountType: "crypto";
  label?: string;
  cryptoNetwork: CryptoNetwork;
  cryptoAddress: string;
  cryptoMemo?: string;
}

/** List the (≤2) payout accounts for one of the current user's wallets. */
export async function getWalletAccounts(
  walletType: WalletAccountWalletType,
  orgId?: string | null,
): Promise<{ success: boolean; accounts: WalletAccountData[] }> {
  const params = new URLSearchParams({ walletType });
  if (walletType === "store" && orgId) params.set("orgId", orgId);
  return fetchFromBackend(`/wallet/accounts?${params.toString()}`);
}

/** Upsert one account (bank or crypto) for a wallet slot. */
export async function saveWalletAccount(payload: {
  walletType: WalletAccountWalletType;
  orgId?: string | null;
  account: BankAccountInput | CryptoAccountInput;
}): Promise<{ success: boolean; account: WalletAccountData }> {
  return fetchFromBackend("/wallet/accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Delete one of the current user's accounts. */
export async function deleteWalletAccount(
  id: string,
): Promise<{ success: boolean }> {
  return fetchFromBackend(`/wallet/accounts/${id}`, { method: "DELETE" });
}

// ============= Withdrawals (user side, read-only) =============

export interface MyWithdrawal {
  _id: string;
  walletType: WalletAccountWalletType;
  orgId: string | null;
  grossAmount: number; // cents
  feeAmount: number; // cents
  feePercent: number;
  taxes: { label: string; amount: number }[];
  taxTotal: number; // cents
  netAmount: number; // cents
  status: "initiated" | "completed" | "rejected";
  receiptUrl: string;
  rejectionReason: string;
  accountType: "bank" | "crypto";
  createdAt: string;
  processedAt: string | null;
}

/** The current user's withdrawals for one wallet (for the transaction-feed merge). */
export async function getMyWithdrawals(
  walletType: WalletAccountWalletType,
  orgId?: string | null,
): Promise<{ success: boolean; withdrawals: MyWithdrawal[] }> {
  const params = new URLSearchParams({ walletType });
  if (walletType === "store" && orgId) params.set("orgId", orgId);
  return fetchFromBackend(`/wallet/withdrawals?${params.toString()}`);
}

/** The current user's withdrawable (matured) balance for one wallet, in cents. */
export async function getWithdrawableBalance(
  walletType: WalletAccountWalletType,
  orgId?: string | null,
): Promise<{ success: boolean; withdrawableCents: number }> {
  const params = new URLSearchParams({ walletType });
  if (walletType === "store" && orgId) params.set("orgId", orgId);
  return fetchFromBackend(`/wallet/withdrawable?${params.toString()}`);
}

// ── Withdrawal preference (per wallet) ─────────────────────────────────
// How often the user wants this wallet paid out and how much to leave in it.
// A standing instruction the admin reads; nothing is automated.

export type WithdrawalFrequency = "weekly" | "daily";

export interface AffiliateFeeTier {
  frequency: WithdrawalFrequency;
  keepAmountCents: number;
  /** Does the kept amount clear the $50 bar? */
  meetsKeepThreshold: boolean;
  /** Garage processing fee, percent of gross. */
  feePercent: number;
  /** False when nothing is saved — they are on the default 5%. */
  configured: boolean;
}

export interface WithdrawalPreferenceData {
  frequency: WithdrawalFrequency;
  /** Cents to keep in the wallet each payout; null = withdraw everything. */
  keepAmountCents: number | null;
  /** False when the user has never saved one — the default applies. */
  isSet: boolean;
  updatedAt: string | null;
  /** Affiliate wallet only — the fee this preference earns. */
  feeTier?: AffiliateFeeTier | null;
}

export interface AffiliateFeeMatrixCell {
  frequency: WithdrawalFrequency;
  keepsFifty: boolean;
  feePercent: number;
  methods: {
    method: "crypto" | "bank";
    feePercent: number;
    bankFeeApplies: boolean;
    label: string;
  }[];
}

export interface WithdrawalFeesResponse {
  success: boolean;
  /** False for store / content-rewards — those carry no Garage fee. */
  applies: boolean;
  walletType: string;
  feePercent?: number;
  note?: string;
  keepThresholdCents?: number;
  defaultFeePercent?: number;
  current?: AffiliateFeeTier;
  matrix?: AffiliateFeeMatrixCell[];
  accounts?: { id: string; accountType: "bank" | "crypto"; label: string }[];
}

/** The fee grid + this user's current tier. Read-only. */
export async function getWithdrawalFees(
  walletType: WalletAccountWalletType,
): Promise<WithdrawalFeesResponse> {
  return fetchFromBackend(`/wallet/withdrawal-fees?walletType=${walletType}`);
}

export async function getWithdrawalPreference(
  walletType: WalletAccountWalletType,
  orgId?: string | null,
): Promise<{ success: boolean; preference: WithdrawalPreferenceData }> {
  const params = new URLSearchParams({ walletType });
  if (walletType === "store" && orgId) params.set("orgId", orgId);
  return fetchFromBackend(`/wallet/withdrawal-preference?${params.toString()}`);
}

export async function saveWithdrawalPreference(input: {
  walletType: WalletAccountWalletType;
  orgId?: string | null;
  frequency: WithdrawalFrequency;
  keepAmountCents?: number | null;
}): Promise<{ success: boolean; preference: WithdrawalPreferenceData }> {
  return fetchFromBackend(`/wallet/withdrawal-preference`, {
    method: "PUT",
    body: JSON.stringify({
      walletType: input.walletType,
      ...(input.walletType === "store" && input.orgId ? { orgId: input.orgId } : {}),
      frequency: input.frequency,
      // Sent on BOTH frequencies now: keeping $50 back lowers the affiliate
      // fee on daily payouts too, so stripping it on daily would quietly
      // cost the user the cheaper tier.
      keepAmountCents: input.keepAmountCents ?? null,
    }),
  });
}

// ============= Team APIs =============

export interface TeamMember {
  _id: string;
  name: string;
  email: string;
  role?: string;
  profilePicture?: string;
  /** True when they joined the org through the guest flow, not as staff. */
  guest?: boolean;
}

/**
 * Get team members for an organization
 */
export async function getTeamMembers(orgId: string): Promise<TeamMember[]> {
  const result = await fetchFromBackend<{
    members: TeamMember[];
  }>(`/team/list?orgId=${orgId}`);
  return result.members;
}

// ============= File Upload APIs =============

export interface UploadFileResponse {
  url: string;
  fileKey: string;
  expiresAt?: string;
}

/**
 * Upload a file to S3 via backend API
 * This is the same API used by the mobile app for consistency
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadFileResponse> {
  const token = getToken();

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data as UploadFileResponse);
        } catch (error) {
          console.error("Failed to parse upload response:", xhr.responseText);
          reject(new Error("Invalid response from server"));
        }
      } else {
        console.error(
          "Upload failed with status:",
          xhr.status,
          xhr.responseText,
        );
        try {
          const data = JSON.parse(xhr.responseText);
          reject(
            new Error(
              data.error || data.message || `Upload failed (${xhr.status})`,
            ),
          );
        } catch {
          reject(
            new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`),
          );
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled"));
    });

    xhr.open("POST", `${API_BASE}/upload`);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.send(formData);
  });
}

// ============= Subscription Types =============

export type SubscriptionItemType =
  | "channel"
  | "course"
  | "workshop"
  | "product";
export type SubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "paused"
  | "expired";
export type SubscriptionPeriod = "weekly" | "monthly" | "quarterly" | "yearly";

export interface SubscriptionPlan {
  _id: string;
  razorpayPlanId: string;
  itemType: SubscriptionItemType;
  itemId: string;
  orgId: string;
  sellerId: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  period: SubscriptionPeriod;
  interval: number;
  totalCount?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  _id: string;
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  planId: string | SubscriptionPlan;
  userId: string;
  orgId: string;
  itemType: SubscriptionItemType;
  itemId: string;
  sellerId: string;
  status: SubscriptionStatus;
  currentStart?: string;
  currentEnd?: string;
  chargeAt?: string;
  startedAt?: string;
  endedAt?: string;
  cancelledAt?: string;
  pausedAt?: string;
  totalCount?: number;
  paidCount: number;
  remainingCount?: number;
  shortUrl?: string;
  paymentMethod?: "card" | "upi" | "emandate" | "nach" | "wallet";
  razorpayCustomerId?: string;
  notes?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  itemDetails?: {
    name: string;
    description?: string;
    image?: string;
  };
  planDetails?: SubscriptionPlan;
}

export interface SubscriptionPayment {
  _id: string;
  subscriptionId: string;
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  razorpayOrderId?: string;
  razorpayInvoiceId?: string;
  userId: string;
  orgId: string;
  sellerId: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "failed" | "refunded";
  paymentNumber: number;
  method?: string;
  paidAt?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionPlanParams {
  itemType: SubscriptionItemType;
  itemId: string;
  name: string;
  description?: string;
  amount: number;
  currency?: string;
  period: SubscriptionPeriod;
  interval?: number;
  totalCount?: number;
}

export interface SubscribeParams {
  planId: string;
  totalCount?: number;
  notes?: Record<string, string>;
}

// ============= Subscription APIs =============

/**
 * Create a subscription plan for a content item (seller only)
 */
export async function createSubscriptionPlan(
  orgId: string,
  params: CreateSubscriptionPlanParams,
): Promise<SubscriptionPlan> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/subscriptions/plans?orgId=${orgId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to create subscription plan");
  }

  const data = await res.json();
  return data.plan;
}

/**
 * Get subscription plan for a content item
 */
export async function getSubscriptionPlan(
  orgId: string,
  itemType: SubscriptionItemType,
  itemId: string,
): Promise<SubscriptionPlan | null> {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/subscriptions/plans/${itemType}/${itemId}?orgId=${orgId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    if (res.status === 404) return null;
    const error = await res.json();
    throw new Error(error.error || "Failed to get subscription plan");
  }

  const data = await res.json();
  return data.plan;
}

/**
 * Subscribe to a plan - returns Razorpay subscription details for checkout
 */
export async function subscribeToItem(
  orgId: string,
  params: SubscribeParams,
): Promise<{
  subscription: Subscription;
  razorpaySubscriptionId: string;
  razorpayKeyId: string;
  shortUrl?: string;
}> {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/subscriptions/subscribe?orgId=${orgId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    },
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to create subscription");
  }

  return res.json();
}

/**
 * Get user's active subscriptions
 */
export async function getMySubscriptions(
  orgId: string,
  options?: {
    status?: SubscriptionStatus | SubscriptionStatus[];
    itemType?: SubscriptionItemType;
    page?: number;
    limit?: number;
  },
): Promise<{
  subscriptions: Subscription[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const token = getToken();
  const params = new URLSearchParams({ orgId });

  if (options?.status) {
    if (Array.isArray(options.status)) {
      options.status.forEach((s) => params.append("status", s));
    } else {
      params.set("status", options.status);
    }
  }
  if (options?.itemType) params.set("itemType", options.itemType);
  if (options?.page) params.set("page", options.page.toString());
  if (options?.limit) params.set("limit", options.limit.toString());

  const res = await fetch(`${API_BASE}/subscriptions/my?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to get subscriptions");
  }

  return res.json();
}

/**
 * Get a specific subscription
 */
export async function getSubscription(
  orgId: string,
  subscriptionId: string,
): Promise<Subscription> {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/subscriptions/${subscriptionId}?orgId=${orgId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to get subscription");
  }

  const data = await res.json();
  return data.subscription;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  orgId: string,
  subscriptionId: string,
  cancelAtCycleEnd: boolean = true,
): Promise<Subscription> {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/subscriptions/${subscriptionId}/cancel?orgId=${orgId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cancelAtCycleEnd }),
    },
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to cancel subscription");
  }

  const data = await res.json();
  return data.subscription;
}

/**
 * Pause a subscription
 */
export async function pauseSubscription(
  orgId: string,
  subscriptionId: string,
): Promise<Subscription> {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/subscriptions/${subscriptionId}/pause?orgId=${orgId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to pause subscription");
  }

  const data = await res.json();
  return data.subscription;
}

/**
 * Resume a paused subscription
 */
export async function resumeSubscription(
  orgId: string,
  subscriptionId: string,
): Promise<Subscription> {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/subscriptions/${subscriptionId}/resume?orgId=${orgId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to resume subscription");
  }

  const data = await res.json();
  return data.subscription;
}

/**
 * Check if user has active subscription for an item
 */
export async function checkSubscriptionAccess(
  orgId: string,
  itemType: SubscriptionItemType,
  itemId: string,
): Promise<{
  hasAccess: boolean;
  subscription?: Subscription;
  expiresAt?: string;
}> {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/subscriptions/access/${itemType}/${itemId}?orgId=${orgId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to check subscription access");
  }

  return res.json();
}

/**
 * Get subscription payment history
 */
export async function getSubscriptionPayments(
  orgId: string,
  subscriptionId: string,
  options?: {
    page?: number;
    limit?: number;
  },
): Promise<{
  payments: SubscriptionPayment[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const token = getToken();
  const params = new URLSearchParams({ orgId });
  if (options?.page) params.set("page", options.page.toString());
  if (options?.limit) params.set("limit", options.limit.toString());

  const res = await fetch(
    `${API_BASE}/subscriptions/${subscriptionId}/payments?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to get subscription payments");
  }

  return res.json();
}

// ============= Service Types =============

export interface ServiceMilestoneAttachment {
  name: string;
  url: string;
  size?: number;
  contentType?: string;
  uploadedAt?: string;
}

export interface ServiceMilestone {
  _id: string;
  order: number;
  title: string;
  description?: string;
  duration?: string;
  deliverables?: string[];
  attachments?: ServiceMilestoneAttachment[];
  paymentAmount: number;
  currency: string;
  /** Undefined on legacy milestones — the service-level paymentTiming applies. */
  paymentTiming?: "advance" | "on_completion";
}

/** Milestone payload for create/update. Send `_id` to keep an existing milestone. */
export interface ServiceMilestoneInput {
  _id?: string;
  order?: number;
  title: string;
  description?: string;
  duration?: string;
  deliverables?: string[];
  attachments?: ServiceMilestoneAttachment[];
  paymentAmount: number;
  currency?: string;
  paymentTiming?: "advance" | "on_completion";
}

export interface ServiceWhyChooseUs {
  icon: string;
  title: string;
  description: string;
}

export interface ServiceContactInfo {
  phone?: string;
  email?: string;
  whatsapp?: string;
}

/**
 * The person a seeded card is assigned to. Provisioning adds them to the
 * engagement room and puts the card in their name, so an assignment made in the
 * wizard survives into Taskroom without anyone re-doing it by hand.
 */
export interface ServiceTaskAssignee {
  /** Garage user id — resolved to a Taskroom user at provision time. */
  userId: string;
  name: string;
  email: string;
  image?: string;
}

/** A default task seeded into a provisioned engagement room. */
export interface ServiceTaskTemplate {
  title: string;
  description?: string;
  /** `internal` tasks are never shown to the client. */
  kind: "required" | "task" | "internal";
  priority?: "low" | "medium" | "high";
  /**
   * Cloned as Taskroom subtasks of this card. A milestone column carries one
   * card — the milestone — with its deliverables in here.
   */
  subtasks?: string[];
  /** Who owns this card. Added to the room automatically on provisioning. */
  assignee?: ServiceTaskAssignee;
}

/**
 * A Kanban column seeded into a provisioned engagement room. Columns generated
 * from milestones carry `milestoneIndex`; standalone ones (Internal Notes,
 * Backlog) leave it undefined.
 */
export interface ServiceStageTemplate {
  name: string;
  color?: string;
  /** Taskroom v2 stage types. */
  stageType: "tostart" | "active" | "done" | "closed";
  isInternal: boolean;
  milestoneIndex?: number;
  tasks: ServiceTaskTemplate[];
}

/**
 * Client Access Permissions from Section 6 of the wizard. Enforced server-side
 * by the board proxy — these flags shape the UI, they are not the boundary.
 */
export interface ServiceClientAccess {
  showTaskroomBoard: boolean;
  showActivityLogs: boolean;
  enableFilesTab: boolean;
  revealTimelogSheet: boolean;
  showProgressStatusGauge: boolean;
}

/** Blueprint copied into a fresh Taskroom room on every opt-in. */
export interface ServiceTaskroomConfig {
  enabled: boolean;
  stages: ServiceStageTemplate[];
  clientAccess: ServiceClientAccess;
  workspaceId?: string;
  spaceId?: string;
  /**
   * Optional master room for the service itself. Seeded with the configured
   * board when the service is published; client engagements still get their own
   * private room, so no buyer ever sees another buyer's board.
   */
  roomId?: string;
}

export const DEFAULT_CLIENT_ACCESS: ServiceClientAccess = {
  showTaskroomBoard: true,
  showActivityLogs: true,
  enableFilesTab: true,
  revealTimelogSheet: false,
  showProgressStatusGauge: true,
};

/**
 * Hourly / retainer setup from Section 3 of the wizard, used when
 * `pricingModel` is "billable". A billable service carries no milestones — the
 * engagement is billed from the hours logged against its Taskroom room.
 */
export type BillingModelType = "hourly" | "retainer";
export type BillingCycle = "weekly" | "bi_weekly" | "monthly";
export type BillingStartDay =
  | "1st_of_month"
  | "15th_of_month"
  | "contract_start"
  | "monday";

/**
 * A person delivering a billable engagement, and what they cost.
 *
 * `payRate` is the internal cost of an hour of their time, which is not the
 * rate the client is billed (`hourlyRate`) — the gap between the two is the
 * margin. Nobody is paid the same, so the rate lives per person rather than on
 * the service. The server strips `payRate` from every non-founder response.
 */
export interface ServiceTeamMember {
  /** Garage user id — resolved to a Taskroom user at provision time. */
  userId: string;
  name: string;
  email: string;
  image?: string;
  /** Cost per hour in the service's currency. Internal — never shown to clients. */
  payRate: number;
  /** What they do on this engagement, e.g. "Senior Engineer". */
  role?: string;
}

export interface ServiceHourlyConfig {
  billingModelType: BillingModelType;
  /** Rate per hour, in the service's currency. */
  hourlyRate: number;
  /** What the founder expects to bill in a month — a projection, not a floor. */
  estimatedMonthlyHours: number;
  /** When true, the client is not held to the estimate. */
  noMinimumCommitment: boolean;
  billingCycle: BillingCycle;
  billingStartDay: BillingStartDay;
  /** Hard ceiling on billable hours per cycle. */
  hardCapEnabled: boolean;
  maxHoursPerMonth?: number;
  /** Hours must be approved on the timesheet before they can be invoiced. */
  timesheetApprovalRequired: boolean;
  securityDepositEnabled: boolean;
  securityDepositAmount?: number;
  /**
   * Who delivers the engagement, and what each of them is paid per hour. Every
   * member is added to the provisioned Taskroom room.
   */
  team?: ServiceTeamMember[];
}

export const DEFAULT_HOURLY_CONFIG: ServiceHourlyConfig = {
  billingModelType: "hourly",
  hourlyRate: 0,
  estimatedMonthlyHours: 0,
  noMinimumCommitment: false,
  billingCycle: "monthly",
  billingStartDay: "1st_of_month",
  hardCapEnabled: false,
  timesheetApprovalRequired: true,
  securityDepositEnabled: false,
  team: [],
};

/** Provisioning state of an engagement's Taskroom room. */
export interface ServiceOptTaskroom {
  status: "pending" | "provisioning" | "ready" | "failed" | "skipped";
  /** Only ever populated for founders — clients never receive room handles. */
  workspaceId?: string;
  spaceId?: string;
  roomId?: string;
  error?: string;
}

/** A card on the client-visible board. Internal columns never appear here. */
export interface EngagementBoardCard {
  _id: string;
  name?: string;
  title?: string;
  description?: string;
  stageId: string;
  priority?: string;
  isCompleted?: boolean;
  startDate?: number | string;
  dueDate?: number | string;
  assignedToIds?: unknown[];
  members?: unknown[];
  attachments?: unknown[];
  timeEstimate?: number;
  timeLogged?: number;
  /** Deliverables live inside their milestone card as Taskroom subtasks. */
  subTaskCount?: number;
  /**
   * Who is working on this card. Names and avatars only — pay rates are
   * stripped server-side and never reach an engagement response.
   */
  assignees?: EngagementTeamMember[];
}

/** A delivery-team member as the client sees them: no rate, no email. */
export interface EngagementTeamMember {
  name: string;
  image?: string;
  role?: string;
}

export interface EngagementBoardStage {
  _id: string;
  name: string;
  color?: string;
  stageType?: string;
  orderId?: number;
  cards: EngagementBoardCard[];
}

export interface EngagementBoard {
  roomId: string;
  stages: EngagementBoardStage[];
  access: ServiceClientAccess;
  /** The people delivering this engagement, for the "Your team" strip. */
  team?: EngagementTeamMember[];
  progress: {
    /** The contract number — what the client is billed against. */
    milestonePercentage: number;
    completedMilestones: number;
    totalMilestones: number;
    /** Secondary, derived from visible cards only. */
    taskPercentage: number;
    completedTasks: number;
    totalTasks: number;
  };
}

export interface Service {
  _id: string;
  organizationId: string;
  createdBy: string;
  title: string;
  slug: string;
  description?: string;
  longDescription?: string;
  icon?: string;
  iconBgColor?: string;
  coverImage?: string;
  tags: string[];
  features: string[];
  deliverables: string[];
  images?: string[];
  videos?: string[];
  youtubeUrl?: string;
  category?: string;
  duration?: string;
  pricingModel?: "milestone" | "billable";
  /** Present only on billable services. */
  hourlyConfig?: ServiceHourlyConfig;
  paymentTiming: "free" | "pay_before_milestone" | "pay_after_milestone";
  currency: string;
  taxMode?: "inclusive" | "exclusive";
  bookingAdvanceFeeEnabled?: boolean;
  bookingAdvanceFee?: number;
  cancellationPolicy?: string;
  totalPrice: number;
  milestones: ServiceMilestone[];
  channelIds: string[];
  allowedUserIds: string[];
  status: "draft" | "active" | "archived";
  projectsCompleted: number;
  activeOptIns: number;
  whyChooseUs?: ServiceWhyChooseUs[];
  contactInfo?: ServiceContactInfo;
  taskroomConfig?: ServiceTaskroomConfig;
  founderAlerts?: FounderAlerts;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceMilestoneMessage {
  _id: string;
  serviceOptId: string;
  serviceId: string;
  milestoneId: string;
  authorRole: "client" | "founder";
  message: string;
  createdAt: string;
  userId:
    | string
    | {
        _id: string;
        name: string;
        email: string;
        profilePicture?: string;
      };
}

export interface MilestoneProgress {
  milestoneId: string;
  order: number;
  title: string;
  status: "pending" | "in_progress" | "completed";
  paymentAmount: number;
  currency: string;
  paymentTiming?: "advance" | "on_completion";
  paymentRequired: boolean;
  paymentStatus: "not_required" | "pending" | "paid";
  paymentId?: string;
  paidAt?: string;
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;
  /** Files the founder submitted as deliverable proof. */
  attachments?: ServiceMilestoneAttachment[];
  /** Files the client uploaded for this milestone. */
  clientAttachments?: ServiceMilestoneAttachment[];
}

export interface ServiceOpt {
  _id: string;
  serviceId: string | Service;
  userId:
    | string
    | {
        _id: string;
        name: string;
        email: string;
        profilePicture?: string;
      };
  organizationId: string;
  status: "opted" | "in_progress" | "completed" | "cancelled";
  optedAt: string;
  completedAt?: string;
  cancelledAt?: string;
  totalAmount: number;
  amountPaid: number;
  amountPending: number;
  currency: string;
  milestonesProgress: MilestoneProgress[];
  completedMilestones: number;
  totalMilestones: number;
  progressPercentage: number;
  taskroom?: ServiceOptTaskroom;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceReview {
  _id: string;
  serviceId: string;
  serviceOptId: string;
  userId: string;
  organizationId: string;
  rating: number;
  comment: string;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  isApproved: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PendingPayment {
  serviceOptId: string;
  serviceId: string;
  serviceTitle: string;
  milestoneId: string;
  milestoneTitle: string;
  milestoneOrder: number;
  amount: number;
  currency: string;
  paymentTiming: string;
  completedAt?: string;
}

export interface ServiceStats {
  totalOptIns: number;
  activeOptIns: number;
  completedOptIns: number;
  cancelledOptIns: number;
  totalRevenue: number;
  averageRating: number;
  reviewCount: number;
}

// ============= Service APIs (Main) =============

export async function getServices(options?: {
  status?: "active" | "draft" | "archived" | "all";
  channelId?: string;
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "title" | "totalPrice";
  sortOrder?: "asc" | "desc";
}): Promise<{
  services: Service[];
  total: number;
  page: number;
  totalPages: number;
  isFounder: boolean;
}> {
  const params = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) params.append("orgId", orgId);
  if (options?.status) params.append("status", options.status);
  if (options?.channelId) params.append("channelId", options.channelId);
  if (options?.search) params.append("search", options.search);
  if (options?.tags && options.tags.length > 0)
    params.append("tags", options.tags.join(","));
  if (options?.page) params.append("page", options.page.toString());
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.sortBy) params.append("sortBy", options.sortBy);
  if (options?.sortOrder) params.append("sortOrder", options.sortOrder);

  const query = params.toString();
  return fetchFromBackend(`/services${query ? `?${query}` : ""}`);
}

export async function getService(serviceId: string): Promise<{
  service: Service;
  isFounder: boolean;
  optIn: ServiceOpt | null;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/${serviceId}${query}`);
}

// ============= Service APIs (Founder - Management) =============

export async function createService(data: {
  title: string;
  description?: string;
  longDescription?: string;
  icon?: string;
  iconBgColor?: string;
  coverImage?: string;
  tags?: string[];
  features?: string[];
  deliverables?: string[];
  images?: string[];
  videos?: string[];
  youtubeUrl?: string;
  category?: string;
  duration?: string;
  pricingModel?: "milestone" | "billable";
  paymentTiming?: "free" | "pay_before_milestone" | "pay_after_milestone";
  currency?: string;
  taxMode?: "inclusive" | "exclusive";
  bookingAdvanceFeeEnabled?: boolean;
  bookingAdvanceFee?: number;
  cancellationPolicy?: string;
  milestones?: ServiceMilestoneInput[];
  /** Sent as `null` to clear it when a service moves back to milestones. */
  hourlyConfig?: ServiceHourlyConfig | null;
  channelIds?: string[];
  allowedUserIds?: string[];
  status?: "draft" | "active" | "archived";
  whyChooseUs?: ServiceWhyChooseUs[];
  contactInfo?: ServiceContactInfo;
  taskroomConfig?: ServiceTaskroomConfig;
  founderAlerts?: FounderAlerts;
}): Promise<{ service: Service }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateService(
  serviceId: string,
  data: {
    title?: string;
    description?: string;
    longDescription?: string;
    icon?: string;
    iconBgColor?: string;
    coverImage?: string;
    tags?: string[];
    features?: string[];
    deliverables?: string[];
    images?: string[];
    videos?: string[];
    youtubeUrl?: string;
    category?: string;
    duration?: string;
    pricingModel?: "milestone" | "billable";
    paymentTiming?: "free" | "pay_before_milestone" | "pay_after_milestone";
    currency?: string;
    taxMode?: "inclusive" | "exclusive";
    bookingAdvanceFeeEnabled?: boolean;
    bookingAdvanceFee?: number;
    cancellationPolicy?: string;
    milestones?: ServiceMilestoneInput[];
    /** Sent as `null` to clear it when a service moves back to milestones. */
    hourlyConfig?: ServiceHourlyConfig | null;
    channelIds?: string[];
    allowedUserIds?: string[];
    status?: "draft" | "active" | "archived";
    whyChooseUs?: ServiceWhyChooseUs[];
    contactInfo?: ServiceContactInfo;
    taskroomConfig?: ServiceTaskroomConfig;
    founderAlerts?: FounderAlerts;
  },
): Promise<{ service: Service }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/${serviceId}${query}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteService(
  serviceId: string,
): Promise<{ success: boolean }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/${serviceId}${query}`, {
    method: "DELETE",
  });
}

// ============= Service Milestone APIs (Founder) =============

export async function addServiceMilestone(
  serviceId: string,
  data: {
    title: string;
    description?: string;
    duration?: string;
    deliverables?: string[];
    attachments?: ServiceMilestoneAttachment[];
    paymentAmount: number;
    currency?: string;
    paymentTiming?: "advance" | "on_completion";
  },
): Promise<{ service: Service }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/${serviceId}/milestones${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateServiceMilestone(
  serviceId: string,
  milestoneId: string,
  data: {
    title?: string;
    description?: string;
    duration?: string;
    deliverables?: string[];
    attachments?: ServiceMilestoneAttachment[];
    paymentAmount?: number;
    currency?: string;
    paymentTiming?: "advance" | "on_completion";
  },
): Promise<{ service: Service }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/services/${serviceId}/milestones/${milestoneId}${query}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}

export async function deleteServiceMilestone(
  serviceId: string,
  milestoneId: string,
): Promise<{ service: Service }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/services/${serviceId}/milestones/${milestoneId}${query}`,
    {
      method: "DELETE",
    },
  );
}

export async function reorderServiceMilestones(
  serviceId: string,
  milestoneIds: string[],
): Promise<{ service: Service }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/${serviceId}/milestones/reorder${query}`, {
    method: "POST",
    body: JSON.stringify({ milestoneIds }),
  });
}

// ============= Service Opt-in APIs =============

export async function optInToService(
  serviceId: string,
): Promise<{ optIn: ServiceOpt }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/${serviceId}/opt-in${query}`, {
    method: "POST",
  });
}

export async function getServiceOptIn(
  serviceId: string,
): Promise<{ optIn: ServiceOpt | null }> {
  return fetchFromBackend(`/services/${serviceId}/opt-in`);
}

export async function getMyServiceOptIns(options?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{
  optIns: ServiceOpt[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) params.append("orgId", orgId);
  if (options?.status) params.append("status", options.status);
  if (options?.page) params.append("page", options.page.toString());
  if (options?.limit) params.append("limit", options.limit.toString());

  const query = params.toString();
  return fetchFromBackend(`/services/opt-ins/my${query ? `?${query}` : ""}`);
}

export async function cancelServiceOptIn(
  optInId: string,
): Promise<{ optIn: ServiceOpt }> {
  return fetchFromBackend(`/services/opt-ins/${optInId}`, {
    method: "DELETE",
  });
}

// ============= Service Milestone Progress APIs (Founder) =============

export async function startServiceMilestone(
  optInId: string,
  milestoneId: string,
): Promise<{ optIn: ServiceOpt }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/services/opt-ins/${optInId}/milestones/${milestoneId}/start${query}`,
    {
      method: "POST",
    },
  );
}

export async function completeServiceMilestone(
  optInId: string,
  milestoneId: string,
): Promise<{ optIn: ServiceOpt }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/services/opt-ins/${optInId}/milestones/${milestoneId}/complete${query}`,
    {
      method: "POST",
    },
  );
}

// ============= Service Payment APIs =============

export async function getServicePendingPayments(): Promise<{
  pendingPayments: PendingPayment[];
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/payments/pending${query}`);
}

export async function createServiceMilestonePaymentOrder(
  optInId: string,
  milestoneId: string,
): Promise<{
  success: boolean;
  order: {
    id: string;
    amount: number;
    currency: string;
  };
  milestone: {
    id: string;
    title: string;
    amount: number;
    currency: string;
  };
  service: {
    id: string;
    title: string;
  };
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/services/opt-ins/${optInId}/milestones/${milestoneId}/create-order${query}`,
    {
      method: "POST",
    },
  );
}

export async function verifyServiceMilestonePayment(
  optInId: string,
  milestoneId: string,
  data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
): Promise<{
  success: boolean;
  message: string;
  optIn: ServiceOpt;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/services/opt-ins/${optInId}/milestones/${milestoneId}/verify-payment${query}`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

// ============= Service Review APIs =============

/** Attach files to one milestone of an engagement. Client uploads land in
 *  `clientAttachments`; founder uploads land in `attachments`. */
export async function addMilestoneAttachments(
  optInId: string,
  milestoneId: string,
  attachments: ServiceMilestoneAttachment[],
): Promise<{ optIn: ServiceOpt }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/services/opt-ins/${optInId}/milestones/${milestoneId}/attachments${query}`,
    {
      method: "POST",
      body: JSON.stringify({ attachments }),
    },
  );
}

/** Remove a file the caller uploaded to a milestone. */
export async function removeMilestoneAttachment(
  optInId: string,
  milestoneId: string,
  url: string,
): Promise<{ optIn: ServiceOpt }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/services/opt-ins/${optInId}/milestones/${milestoneId}/attachments${query}`,
    {
      method: "DELETE",
      body: JSON.stringify({ url }),
    },
  );
}

export async function createServiceReview(
  serviceId: string,
  data: {
    serviceOptId: string;
    rating: number;
    comment: string;
  },
): Promise<{ review: ServiceReview }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/${serviceId}/reviews${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getServiceReviews(
  serviceId: string,
  options?: {
    publicOnly?: boolean;
    page?: number;
    limit?: number;
  },
): Promise<{
  reviews: ServiceReview[];
  total: number;
  page: number;
  totalPages: number;
  averageRating: number;
}> {
  const params = new URLSearchParams();
  if (options?.publicOnly) params.append("publicOnly", "true");
  if (options?.page) params.append("page", options.page.toString());
  if (options?.limit) params.append("limit", options.limit.toString());

  const query = params.toString();
  return fetchFromBackend(
    `/services/${serviceId}/reviews${query ? `?${query}` : ""}`,
  );
}

export async function updateServiceReview(
  reviewId: string,
  data: {
    rating?: number;
    comment?: string;
  },
): Promise<{ review: ServiceReview }> {
  return fetchFromBackend(`/services/reviews/${reviewId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteServiceReview(
  reviewId: string,
): Promise<{ success: boolean }> {
  return fetchFromBackend(`/services/reviews/${reviewId}`, {
    method: "DELETE",
  });
}

// ============= Service Founder Dashboard APIs =============

export async function getServiceOptIns(
  serviceId: string,
  options?: {
    status?: string;
    page?: number;
    limit?: number;
  },
): Promise<{
  optIns: ServiceOpt[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) params.append("orgId", orgId);
  if (options?.status) params.append("status", options.status);
  if (options?.page) params.append("page", options.page.toString());
  if (options?.limit) params.append("limit", options.limit.toString());

  const query = params.toString();
  return fetchFromBackend(
    `/services/${serviceId}/opt-ins${query ? `?${query}` : ""}`,
  );
}

export async function getServiceMilestoneMessages(
  optInId: string,
  milestoneId: string,
): Promise<{ messages: ServiceMilestoneMessage[] }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/services/opt-ins/${optInId}/milestones/${milestoneId}/messages${query}`,
  );
}

export async function postServiceMilestoneMessage(
  optInId: string,
  milestoneId: string,
  message: string,
): Promise<{ message: ServiceMilestoneMessage }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/services/opt-ins/${optInId}/milestones/${milestoneId}/messages${query}`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    },
  );
}

export async function getServiceStats(
  serviceId: string,
): Promise<ServiceStats> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/${serviceId}/stats${query}`);
}

// ============= Call Types =============

export interface IntakeQuestion {
  _id: string;
  question: string;
  answerType: "text" | "file";
  isRequired: boolean;
  order: number;
}

export interface IntakeAnswer {
  questionId: string;
  question: string;
  answerType: "text" | "file";
  textAnswer?: string;
  fileUrl?: string;
  fileName?: string;
}

export interface CallTopic {
  title: string;
  description: string;
}

export interface CallHowItWorks {
  icon: string;
  title: string;
  description: string;
}

export interface CallFaq {
  question: string;
  answer: string;
}

export interface CallOffering {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  pricePerCall: number;
  currency: string;
  isFree: boolean;
  duration: number;
  organizationId: string;
  createdBy:
    | string
    | {
        _id: string;
        name: string;
        email: string;
        profilePicture?: string;
      };
  channelIds: string[];
  intakeQuestions: IntakeQuestion[];
  status: "draft" | "published" | "archived";
  totalPurchased: number;
  totalUsed: number;
  totalScheduled: number;
  purchaseCount: number;
  averageRating?: number;
  reviewCount: number;
  // Detail page fields
  whatsIncluded?: string[];
  topicsWeCover?: CallTopic[];
  howItWorks?: CallHowItWorks[];
  faqs?: CallFaq[];
  createdAt: string;
  updatedAt: string;
}

export interface CallPurchase {
  _id: string;
  callOfferingId: string | CallOffering;
  userId:
    | string
    | {
        _id: string;
        name: string;
        email: string;
        profilePicture?: string;
      };
  organizationId: string;
  quantityPurchased: number;
  quantityUsed: number;
  quantityScheduled: number;
  quantityRemaining: number;
  intakeAnswers: IntakeAnswer[];
  isPaid: boolean;
  totalAmount: number;
  currency: string;
  paymentId?: string;
  paymentStatus: "pending" | "completed" | "failed" | "refunded";
  invoiceShortUrl?: string;
  purchasedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallBooking {
  _id: string;
  callOfferingId: string | CallOffering;
  callPurchaseId: string | CallPurchase;
  organizationId: string;
  founderId:
    | string
    | {
        _id: string;
        name: string;
        email: string;
        profilePicture?: string;
      };
  bookerId:
    | string
    | {
        _id: string;
        name: string;
        email: string;
        profilePicture?: string;
      };
  startTime: string;
  endTime: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  founderNotes?: string;
  bookingNotes?: string;
  completedAt?: string;
  completedBy?: string;
  rating?: number;
  review?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallStats {
  totalPurchases: number;
  totalRevenue: number;
  totalCallsPurchased: number;
  totalCallsUsed: number;
  totalCallsScheduled: number;
  averageRating: number | null;
  reviewCount: number;
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
}

// ============= Call Offering APIs (Main) =============

export async function getCallOfferings(options?: {
  status?: "draft" | "published" | "archived" | "all";
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  callOfferings: CallOffering[];
  isFounder: boolean;
}> {
  const params = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) params.append("orgId", orgId);
  if (options?.status) params.append("status", options.status);
  if (options?.search) params.append("search", options.search);
  if (options?.page) params.append("page", options.page.toString());
  if (options?.limit) params.append("limit", options.limit.toString());

  const query = params.toString();
  return fetchFromBackend(`/calls${query ? `?${query}` : ""}`);
}

export async function getCallOfferingsManage(options?: {
  includeArchived?: boolean;
}): Promise<{
  success: boolean;
  callOfferings: CallOffering[];
  isFounder: boolean;
}> {
  const params = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) params.append("orgId", orgId);
  if (options?.includeArchived) params.append("includeArchived", "true");

  const query = params.toString();
  return fetchFromBackend(`/calls/manage${query ? `?${query}` : ""}`);
}

export async function getCallOffering(callId: string): Promise<{
  success: boolean;
  callOffering: CallOffering;
  isFounder: boolean;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/${callId}${query}`);
}

// ============= Call Offering APIs (Founder - Management) =============

export async function createCallOffering(data: {
  title: string;
  description?: string;
  coverImage?: string;
  pricePerCall?: number;
  currency?: string;
  duration?: number;
  channelIds?: string[];
  status?: "draft" | "published" | "archived";
  intakeQuestions?: Array<{
    question: string;
    answerType: "text" | "file";
    isRequired: boolean;
  }>;
  whatsIncluded?: string[];
  topicsWeCover?: CallTopic[];
  howItWorks?: CallHowItWorks[];
  faqs?: CallFaq[];
}): Promise<{ success: boolean; callOffering: CallOffering }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCallOffering(
  callId: string,
  data: {
    title?: string;
    description?: string;
    coverImage?: string;
    pricePerCall?: number;
    currency?: string;
    duration?: number;
    channelIds?: string[];
    status?: "draft" | "published" | "archived";
    whatsIncluded?: string[];
    topicsWeCover?: CallTopic[];
    howItWorks?: CallHowItWorks[];
    faqs?: CallFaq[];
  },
): Promise<{ success: boolean; callOffering: CallOffering }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/${callId}${query}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCallOffering(
  callId: string,
): Promise<{ success: boolean; message: string }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/${callId}${query}`, {
    method: "DELETE",
  });
}

// ============= Intake Question APIs (Founder) =============

export async function addIntakeQuestion(
  callId: string,
  data: {
    question: string;
    answerType: "text" | "file";
    isRequired?: boolean;
  },
): Promise<{ success: boolean; callOffering: CallOffering }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/${callId}/questions${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateIntakeQuestion(
  callId: string,
  questionId: string,
  data: {
    question?: string;
    answerType?: "text" | "file";
    isRequired?: boolean;
  },
): Promise<{ success: boolean; callOffering: CallOffering }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/${callId}/questions/${questionId}${query}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteIntakeQuestion(
  callId: string,
  questionId: string,
): Promise<{ success: boolean; callOffering: CallOffering }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/${callId}/questions/${questionId}${query}`, {
    method: "DELETE",
  });
}

export async function reorderIntakeQuestions(
  callId: string,
  questionIds: string[],
): Promise<{ success: boolean; callOffering: CallOffering }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/${callId}/questions/reorder${query}`, {
    method: "PUT",
    body: JSON.stringify({ questionIds }),
  });
}

// ============= Call Purchase APIs =============

export async function createCallPurchaseOrder(
  callId: string,
  quantity: number,
): Promise<{
  success: boolean;
  order: { id: string; amount: number; currency: string };
  call: { id: string; title: string; pricePerCall: number };
  quantity: number;
  totalPrice: number;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/${callId}/create-order${query}`, {
    method: "POST",
    body: JSON.stringify({ quantity }),
  });
}

export async function verifyCallPayment(
  callId: string,
  data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    quantity: number;
    intakeAnswers?: IntakeAnswer[];
  },
): Promise<{ success: boolean; message: string; purchase: CallPurchase }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/${callId}/verify-payment${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function purchaseFreeCalls(
  callId: string,
  data: {
    quantity: number;
    intakeAnswers?: IntakeAnswer[];
  },
): Promise<{ success: boolean; message: string; purchase: CallPurchase }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/${callId}/purchase-free${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMyCallPurchases(): Promise<{
  success: boolean;
  purchases: CallPurchase[];
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/purchases/me${query}`);
}

export async function getCallPurchases(callId: string): Promise<{
  success: boolean;
  purchases: CallPurchase[];
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/${callId}/purchases${query}`);
}

export async function getCallPurchase(purchaseId: string): Promise<{
  success: boolean;
  purchase: CallPurchase;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/purchases/${purchaseId}${query}`);
}

export async function getCallOfferingStats(callId: string): Promise<{
  success: boolean;
  stats: CallStats;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/calls/${callId}/stats${query}`);
}

// ============= Call Booking APIs =============

export async function getFounderAvailableSlots(
  founderId: string,
  callOfferingId: string,
  date: string,
): Promise<{
  success: boolean;
  slots: AvailableSlot[];
}> {
  const orgId = getOrgId();
  const params = new URLSearchParams();
  if (orgId) params.append("orgId", orgId);
  params.append("founderId", founderId);
  params.append("callOfferingId", callOfferingId);
  params.append("date", date);
  return fetchFromBackend(`/call-bookings/founder/slots?${params.toString()}`);
}

export async function createCallBooking(data: {
  callPurchaseId: string;
  startTime: string;
  bookingNotes?: string;
}): Promise<{
  success: boolean;
  message: string;
  booking: CallBooking;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/call-bookings${query}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMyCallBookings(): Promise<{
  success: boolean;
  bookings: CallBooking[];
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/call-bookings/me${query}`);
}

export async function getFounderCallBookings(filters?: {
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  success: boolean;
  bookings: CallBooking[];
}> {
  const params = new URLSearchParams();
  const orgId = getOrgId();
  if (orgId) params.append("orgId", orgId);
  if (filters?.status) params.append("status", filters.status);
  if (filters?.startDate) params.append("startDate", filters.startDate);
  if (filters?.endDate) params.append("endDate", filters.endDate);
  const query = params.toString();
  return fetchFromBackend(`/call-bookings/founder${query ? `?${query}` : ""}`);
}

export async function getCallBooking(bookingId: string): Promise<{
  success: boolean;
  booking: CallBooking;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/call-bookings/${bookingId}${query}`);
}

export async function completeCallBooking(
  bookingId: string,
  founderNotes?: string,
): Promise<{
  success: boolean;
  message: string;
  booking: CallBooking;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/call-bookings/${bookingId}/complete${query}`, {
    method: "PATCH",
    body: JSON.stringify({ founderNotes }),
  });
}

export async function cancelCallBooking(
  bookingId: string,
  reason?: string,
): Promise<{
  success: boolean;
  message: string;
  booking: CallBooking;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/call-bookings/${bookingId}/cancel${query}`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export async function rescheduleCallBooking(
  bookingId: string,
  newStartTime: string,
): Promise<{
  success: boolean;
  message: string;
  booking: CallBooking;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/call-bookings/${bookingId}/reschedule${query}`, {
    method: "PATCH",
    body: JSON.stringify({ newStartTime }),
  });
}

export async function rateCallBooking(
  bookingId: string,
  rating: number,
  review?: string,
): Promise<{
  success: boolean;
  message: string;
  booking: CallBooking;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/call-bookings/${bookingId}/rate${query}`, {
    method: "POST",
    body: JSON.stringify({ rating, review }),
  });
}

export async function markCallNoShow(bookingId: string): Promise<{
  success: boolean;
  message: string;
  booking: CallBooking;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/call-bookings/${bookingId}/no-show${query}`, {
    method: "PATCH",
  });
}

// ============= Unilevel Plus APIs =============

export interface UnilevelPlusProduct {
  plan: {
    _id: string;
    name: string;
    description?: string;
    productPrice: number;
    currency: string;
    maxLevels: number;
    pointValue: number;
    legMultipliers: number[];
    directBonusPercentage: number;
    levelBonusPercentage: number;
  } | null;
  purchased: boolean;
  purchase: {
    _id: string;
    userId: string;
    planId: string;
    paymentId: string;
    amount: number;
    currency: string;
    status: string;
    purchasedAt: string;
    metadata?: {
      source?: string;
      assignedBy?: string;
      reserveLicenseId?: string;
    };
  } | null;
  assignedBy?: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  } | null;
  /**
   * The 24-hour free-first-month offer window, straight from the backend's
   * `comboWindowFor` (services/comboWindow.ts). It opens at
   * `profileCompletedAt` and can be extended by an admin. Never recompute it
   * client-side — a missing `startsAt` means it never opened, which is not the
   * same as expired.
   */
  freeMonthWindow?: {
    open: boolean;
    startsAt: string | null;
    expiresAt: string | null;
    secondsRemaining: number;
    windowHours: number;
  };
  /** True when the buyer has already redeemed the free month once. */
  comboUsed?: boolean;
  /** `!comboUsed && freeMonthWindow.open` — computed server-side. */
  comboEligible?: boolean;
  /**
   * Purchasable licence+subscription bundles, one group per partner.
   *
   * Already priced for THIS buyer's window state by the backend
   * (routes/unilevel-plus.ts:307): closed → standalone list, which includes
   * the 1-month row; open → bundle list, which deliberately omits it because
   * month one is free. `cartTotal` is pre-tax; GST is added at checkout and
   * only for Indian buyers, so never multiply it here.
   */
  comboTerms?: Array<{
    thirdPartyClientId: string;
    clientName: string;
    productCode: string;
    defaultTermMonths: number;
    freeFirstMonth: boolean;
    terms: Array<{
      termMonths: number;
      label: string;
      cartTotal: number;
      cartTotalCents: number;
      subscriptionUsd: number;
      standaloneUsd: number;
      savingUsd: number;
      monthsOfAccess: number;
    }>;
  }>;
}

export async function getUnilevelPlusProduct(): Promise<
  {
    success: boolean;
  } & UnilevelPlusProduct
> {
  return fetchFromBackend("/unilevel-plus/product");
}

export async function createUnilevelPlusOrder(quantity: number = 1): Promise<{
  success: boolean;
  razorpayOrder: {
    id: string;
    amount: number;
    currency: string;
  };
  invoiceId?: string;
  plan: {
    name: string;
    productPrice: number;
    currency: string;
  };
  razorpayKeyId: string;
}> {
  return fetchFromBackend("/unilevel-plus/checkout/create-order", {
    method: "POST",
    body: JSON.stringify({ quantity }),
  });
}

export async function verifyUnilevelPlusPayment(data: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<{
  success: boolean;
  message: string;
  activated: boolean;
}> {
  return fetchFromBackend("/unilevel-plus/checkout/verify-payment", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============ Reserve License APIs ============

export interface ReserveLicense {
  _id: string;
  userId: string;
  invoiceNumber: string;
  purchasePaymentId: string;
  status: "available" | "assigned" | "expired";
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  } | null;
  assignedAt?: string;
  amount: number;
  currency: string;
  createdAt: string;
}

export async function getReserveLicenses(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  licenses: ReserveLicense[];
  total: number;
}> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  return fetchFromBackend(`/unilevel-plus/reserve?${query.toString()}`);
}

export async function getReserveStats(): Promise<{
  success: boolean;
  available: number;
  assigned: number;
  total: number;
}> {
  return fetchFromBackend("/unilevel-plus/reserve/stats");
}

export async function assignReserveLicense(
  licenseId: string,
  userId: string,
): Promise<{
  success: boolean;
  license: ReserveLicense;
  assignedTo: { _id: string; name: string; email: string };
}> {
  return fetchFromBackend(`/unilevel-plus/reserve/${licenseId}/assign`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function searchUsersForAssignment(query: string): Promise<{
  success: boolean;
  users: Array<{
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
    hasUnilevelPlus: boolean;
  }>;
}> {
  return fetchFromBackend(
    `/unilevel-plus/users/search?q=${encodeURIComponent(query)}`,
  );
}

// ============ Item Reserve Licenses (course / channel / workshop / call) ============
// Generic reserve-and-assign pattern for the four non-UP sellable items.
// Backed by the `/item-reserves/*` endpoints. UP keeps its own dedicated API
// surface above; these never overlap.

export type ItemReserveType =
  | "course"
  | "channel"
  | "workshop"
  | "call"
  | "product";
export type ItemReserveStatus = "available" | "assigned" | "expired";

export interface ItemReserveLicense {
  _id: string;
  buyerId: string;
  itemType: ItemReserveType;
  itemId: string;
  itemName: string;
  itemImage?: string;
  organizationId: string;
  invoiceId: string;
  invoiceNumber: string;
  paymentId: string;
  seq: number;
  status: ItemReserveStatus;
  assignedTo?: {
    _id: string;
    name?: string;
    email: string;
  } | null;
  assignedAt?: string;
  assignedArtifactRef?: {
    type:
      | "courseEnrollment"
      | "channelMembership"
      | "workshopEnrollment"
      | "callPurchase";
    id: string;
  };
  unitPrice: number;
  currency: string;
  // Set when a paid PendingReserveAssignment is live for this license — the
  // assign button should reflect a "Pending offer" state until the recipient
  // approves/rejects or the sender cancels.
  pendingAssignmentId?: string | null;
  createdAt: string;
}

export interface ItemReserveStats {
  total: number;
  available: number;
  assigned: number;
  expired: number;
  byItemType: Record<
    string,
    { available: number; assigned: number; total: number }
  >;
}

export async function getItemReserves(params?: {
  itemType?: ItemReserveType;
  status?: ItemReserveStatus;
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  licenses: ItemReserveLicense[];
  total: number;
}> {
  const query = new URLSearchParams();
  if (params?.itemType) query.set("itemType", params.itemType);
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  const qs = query.toString();
  return fetchFromBackend(`/item-reserves${qs ? `?${qs}` : ""}`);
}

export async function getItemReserveStats(): Promise<
  { success: boolean } & ItemReserveStats
> {
  return fetchFromBackend("/item-reserves/stats");
}

/**
 * Assign a reserve to another user.
 *
 * Two modes:
 *   - **Free** (no `priceUsd`): instant grant, returns `{ mode: "free", license, recipient, artifact }`.
 *   - **Paid** (`priceUsd > 0`): creates a pending offer. The recipient must
 *     approve and pick a Store wallet to pay from. Returns
 *     `{ mode: "paid", offer }`. `orgId` (sender's current org — credit
 *     destination) is required in this mode.
 */
export async function assignItemReserve(
  licenseId: string,
  recipient: {
    email?: string;
    userId?: string;
    priceUsd?: number;
    orgId?: string;
    message?: string;
  },
): Promise<{
  success: boolean;
  mode?: "free" | "paid";
  license?: ItemReserveLicense;
  recipient?: { _id: string; email: string; name?: string };
  artifact?: { type: string; id: string };
  offer?: ReserveOffer;
}> {
  return fetchFromBackend(`/item-reserves/${licenseId}/assign`, {
    method: "POST",
    body: JSON.stringify(recipient),
  });
}

// ============= Paid Reserve Offer APIs =============

export type ReserveOfferStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

/**
 * Embedded user snippet present when the offer list endpoints populate
 * `fromUserId` / `toUserId`. The bare-string form is what the raw model
 * stores; the populated form is what the inbox / outbox responses return.
 */
export type ReserveOfferUserRef =
  | string
  | {
      _id: string;
      name?: string;
      email?: string;
      profilePicture?: string;
    };

export type ReserveOfferOrgRef = string | { _id: string; name?: string };

export interface ReserveOffer {
  _id: string;
  fromUserId: ReserveOfferUserRef;
  toUserId: ReserveOfferUserRef;
  fromLicenseId: string;
  itemType: "course" | "channel" | "workshop" | "call" | "product";
  itemId: string;
  itemName: string;
  itemImage?: string;
  unitPrice: number;
  orgId: ReserveOfferOrgRef;
  priceUsd: number;
  currency: string;
  message?: string;
  status: ReserveOfferStatus;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export async function listIncomingReserveOffers(): Promise<{
  success: boolean;
  offers: ReserveOffer[];
}> {
  return fetchFromBackend("/item-reserves/offers/incoming");
}

export async function listOutgoingReserveOffers(): Promise<{
  success: boolean;
  offers: ReserveOffer[];
}> {
  return fetchFromBackend("/item-reserves/offers/outgoing");
}

export async function approveReserveOffer(
  offerId: string,
  sourceOrgId: string,
): Promise<{ success: boolean; offer: ReserveOffer }> {
  return fetchFromBackend(`/item-reserves/offers/${offerId}/approve`, {
    method: "POST",
    body: JSON.stringify({ sourceOrgId }),
  });
}

export async function rejectReserveOffer(
  offerId: string,
): Promise<{ success: boolean; offer: ReserveOffer }> {
  return fetchFromBackend(`/item-reserves/offers/${offerId}/reject`, {
    method: "POST",
  });
}

export async function cancelReserveOffer(
  offerId: string,
): Promise<{ success: boolean; offer: ReserveOffer }> {
  return fetchFromBackend(`/item-reserves/offers/${offerId}/cancel`, {
    method: "POST",
  });
}

// ============= Sellables (unified listing across all item types) =============

export type SellableItemType =
  | "product"
  | "store-product"
  | "channel"
  | "course"
  | "service"
  | "workshop"
  // Partner subscription sold through Garage Store (the $25 UP combo).
  // Synthesised server-side from the ThirdPartyClient catalog — there is
  // no row for it in any sellables collection.
  | "garage-store";

export interface Sellable {
  itemType: SellableItemType;
  itemId: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  image?: string;
  isSubscription?: boolean;
  subscriptionPeriod?: string;
  /** True for storefront merch + any legacy product flagged !isDigital.
   *  Drives the Physical / Digital tabs on the webinar pin picker. */
  isPhysical?: boolean;
  sellerId?: string;
  organizationId: string;
  /** Garage storefront slug — present on store-product items. Acts as
   *  the canonical store identity for the Store multi-select filter
   *  and is required to drive /storefront/:slug/cart/checkout from
   *  the in-overlay buy form. */
  storeSlug?: string;
  /** Human-readable storefront name — rendered on the picker card
   *  for store-product items. Falls back to slug if absent. */
  storeName?: string;
}

export async function listOrgSellables(orgId?: string): Promise<Sellable[]> {
  const id = orgId || getOrgId();
  const query = id ? `?orgId=${id}` : "";
  const res = await fetchFromBackend<{
    success: boolean;
    sellables: Sellable[];
  }>(`/api/invoices/sellables${query}`);
  return res.sellables || [];
}

// ============= Invoice APIs (for in-webinar Buy Now) =============

export interface GenerateInvoiceRequest {
  orgId: string;
  // New-style sellable reference:
  itemType?: SellableItemType;
  itemId?: string;
  // Legacy: productId shorthand for itemType="product"
  productId?: string;
  quantity?: number;
  customer: {
    email: string;
    name?: string;
    phone?: string;
  };
  couponCode?: string;
  notes?: string;
}

export interface InvoiceReferrerInfo {
  affiliateId: string | null;
  name: string;
}

export interface GenerateInvoiceResponse {
  success: boolean;
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  invoiceShortUrl: string;
  referrer: InvoiceReferrerInfo | null;
}

export async function generateInvoice(
  body: GenerateInvoiceRequest,
): Promise<GenerateInvoiceResponse> {
  return fetchFromBackend(`/api/invoices/generate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface InvoiceStatusResponse {
  success: boolean;
  invoice: {
    _id: string;
    invoiceNumber: string;
    status: "draft" | "pending" | "paid" | "cancelled" | "failed";
    totalAmount: number;
    paymentCurrency?: string;
    paidAt: string | null;
    invoiceShortUrl?: string;
  };
  fromOrganization?: {
    name?: string;
    icon?: string;
  };
}

// Public endpoint — no auth header required. Uses plain fetch so a missing
// token doesn't skip the call, and so we can safely poll without refreshing auth.
export async function getInvoice(
  invoiceId: string,
): Promise<InvoiceStatusResponse> {
  const res = await fetch(`${API_BASE}/api/invoices/${invoiceId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API Error: ${res.status}`);
  }
  return res.json();
}

// ============= Learn Page Consolidated Init =============

export interface LearnInitResponse {
  success: boolean;
  isFounder: boolean;
  courses: Course[];
  enrollments: CourseEnrollment[];
}

export interface LearnInitLivestreamResponse {
  success: boolean;
  completedWorkshops: Workshop[];
}

/**
 * Lightweight consolidated endpoint for the initial Courses/Learn page load.
 * Returns course summaries (no sections/chapters) and enrollments.
 *
 * Workshop/recording data is loaded separately via getLearnInitLivestream()
 * only when the Livestream tab is activated.
 */
export async function getLearnInit(): Promise<LearnInitResponse> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("garage_org_id")
      : null;
  const params = orgId ? `?orgId=${orgId}` : "";

  const res = await fetch(`${API_BASE}/learn/init${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API Error: ${res.status}`);
  }

  return res.json();
}

/**
 * Lazy-loaded endpoint for the Livestream tab. Returns completed workshops
 * with recording URLs already resolved (eliminates N+1 recording fetches).
 *
 * Called only when the user clicks the Livestream tab.
 */
export async function getLearnInitLivestream(): Promise<LearnInitLivestreamResponse> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("garage_org_id")
      : null;
  const params = orgId ? `?orgId=${orgId}` : "";

  const res = await fetch(`${API_BASE}/learn/init/livestream${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API Error: ${res.status}`);
  }

  return res.json();
}

// ============= Service Taskroom Integration =============

/**
 * Fetch the client-visible board for an engagement.
 *
 * Returns `board: null` with a reason when there is nothing to show — the
 * service has no taskroom configured, provisioning has not finished, or the
 * founder switched the board off for clients. Internal columns are stripped
 * server-side, so whatever comes back here is safe to render.
 */
export async function getEngagementBoard(optInId: string): Promise<{
  board: EngagementBoard | null;
  reason?: "not_configured" | "hidden" | "pending" | "provisioning" | "failed" | "skipped";
  /** Present only for founders. */
  taskroom?: { roomId?: string; spaceId?: string; workspaceId?: string };
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/opt-ins/${optInId}/board${query}`);
}

/** A file on the engagement, tagged with the milestone it belongs to. */
export interface EngagementFile {
  name: string;
  url: string;
  size?: number;
  contentType?: string;
  uploadedAt?: string;
  milestoneId: string;
  milestoneTitle: string;
  milestoneOrder: number;
  /** `brief` = attached to the milestone definition, `deliverable` = submitted on completion. */
  source?: "brief" | "deliverable";
}

/** A file attached to a card in the engagement room. */
export interface EngagementRoomFile {
  _id: string;
  name: string;
  url: string;
  fileType?: string;
  uploadedAt?: string;
}

export interface EngagementFiles {
  shared: EngagementFile[];
  uploaded: EngagementFile[];
  room: EngagementRoomFile[];
  /** Milestones the client may still attach files to — locked ones are absent. */
  uploadTargets: { milestoneId: string; title: string; order: number }[];
}

/**
 * Every file on an engagement, for the Files tab.
 *
 * Returns `files: null` with `reason: "hidden"` when the founder switched the
 * files tab off for clients. Files on locked milestones are dropped server-side.
 */
export async function getEngagementFiles(optInId: string): Promise<{
  files: EngagementFiles | null;
  reason?: "hidden";
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/opt-ins/${optInId}/files${query}`);
}

export interface EngagementActivityEntry {
  type:
    | "milestone_started"
    | "milestone_completed"
    | "payment"
    | "file"
    | "message"
    | "task";
  at: string;
  title: string;
  detail?: string;
  actor?: string;
  milestoneId?: string;
}

/**
 * The engagement timeline: milestone transitions, payments, files, comments and
 * board movement, merged and sorted newest first.
 *
 * Returns `activity: null` with `reason: "hidden"` when the founder switched
 * activity logs off for clients.
 */
export async function getEngagementActivity(optInId: string): Promise<{
  activity: EngagementActivityEntry[] | null;
  reason?: "hidden";
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/opt-ins/${optInId}/activity${query}`);
}

/** Founder-only deep-link handles for the "Take to Taskroom" action. */
export async function getEngagementTaskroom(optInId: string): Promise<{
  taskroom: ServiceOptTaskroom;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/opt-ins/${optInId}/taskroom${query}`);
}

/**
 * Retry provisioning. Also builds a room for engagements that predate the
 * service having a taskroom config.
 */
export async function provisionEngagementTaskroom(optInId: string): Promise<{
  taskroom: ServiceOptTaskroom;
}> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(
    `/services/opt-ins/${optInId}/taskroom/provision${query}`,
    { method: "POST" },
  );
}

export interface TaskroomLinkedService {
  service: {
    _id: string;
    title: string;
    slug: string;
    icon?: string;
    iconBgColor?: string;
    currency: string;
    totalPrice: number;
  };
  optIn: {
    _id: string;
    status: ServiceOpt["status"];
    progressPercentage: number;
    completedMilestones: number;
    totalMilestones: number;
    totalAmount: number;
    amountPaid: number;
    amountPending: number;
    currency: string;
    milestonesProgress: MilestoneProgress[];
  };
  client?: { _id: string; name?: string; email?: string; profilePicture?: string };
  viewerRole: "founder" | "client";
}

/**
 * Reverse lookup used by the additive Service tab inside Taskroom.
 *
 * Resolves to `null` for ordinary rooms (the backend answers 204), which is
 * what keeps the tab from rendering on taskrooms that have nothing to do with
 * services.
 */
export async function getServiceByTaskroom(
  roomId: string,
): Promise<TaskroomLinkedService | null> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  const token = getToken();

  const res = await fetch(
    `${API_BASE}/services/by-taskroom/${roomId}${query}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  // 204 = this room is not a service engagement. Not an error.
  if (res.status === 204 || !res.ok) return null;
  return res.json();
}

/**
 * Default board layout derived from a saved service's milestones. Used to
 * pre-fill Section 6 when the founder has not customised it yet.
 */
export async function getServiceTaskroomTemplate(
  serviceId: string,
): Promise<{ stages: ServiceStageTemplate[] }> {
  const orgId = getOrgId();
  const query = orgId ? `?orgId=${orgId}` : "";
  return fetchFromBackend(`/services/${serviceId}/taskroom/template${query}`);
}
