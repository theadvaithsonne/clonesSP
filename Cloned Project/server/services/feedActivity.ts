import { Types } from "mongoose";
import { Post } from "../models/post.model";
import { PostLike } from "../models/postLike.model";
import { PostComment } from "../models/postComment.model";
import { PostBookmark } from "../models/postBookmark.model";
import { PostRepost } from "../models/postRepost.model";
import { PostCommentLike } from "../models/postCommentLike.model";
import { FeedActivityRead } from "../models/feedActivityRead.model";

/**
 * Feed activity — engagement on the caller's own content.
 *
 * Kept out of services/feed.ts on purpose: that file is already 2700 lines and
 * owns posting, channels and commerce. This reads five engagement collections
 * plus mentions and merges them; it shares no state with the rest.
 *
 * "Own content" is both halves of what the caller wrote: their POSTS (likes,
 * comments, saves, reposts) and their COMMENTS (replies, reactions) — plus
 * anywhere they were @mentioned, in a post or in a comment.
 */

/**
 * How many of the caller's own posts feed into an `$in` before we stop.
 *
 * `{ postId: 1, createdAt: -1 }` can serve a sorted `$in` via explode-for-sort
 * (one index scan per id, merged in order), but the planner abandons that once
 * the list grows and falls back to a blocking in-memory sort, which fails at
 * 32MB. Past this bound we consider only the author's most recent posts, which
 * is both predictable and what the screen actually shows. Deliberately a
 * constant rather than a judgement call at the call site.
 */
const ACTIVITY_POST_SCAN_LIMIT = 300;

/**
 * The same bound, for the caller's own COMMENTS.
 *
 * Identical reasoning to ACTIVITY_POST_SCAN_LIMIT and identical failure mode:
 * `reply` and `comment_like` both drive a sorted `$in` on a comment id list
 * (`parentCommentId`/`commentId`), so once that list outgrows what the planner
 * will serve by explode-for-sort it becomes a blocking in-memory sort and dies
 * at 32MB. Separate constant because people comment far more often than they
 * post, so the two bounds will not stay equal forever.
 */
const ACTIVITY_COMMENT_SCAN_LIMIT = 300;

export type FeedActivityType =
  | "like"
  | "comment"
  | "mention"
  | "save"
  | "repost"
  | "reply"
  | "comment_mention"
  | "comment_like";

export const FEED_ACTIVITY_TYPES: FeedActivityType[] = [
  "like",
  "comment",
  "mention",
  "save",
  "repost",
  "reply",
  "comment_mention",
  "comment_like",
];

export interface FeedActivityActor {
  _id: any;
  name?: string;
  profilePicture?: string | null;
}

export interface FeedActivityPost {
  _id: any;
  content?: string;
  coverImage?: string | null;
  attachmentPreview?: string | null;
}

export interface FeedActivityRow {
  type: FeedActivityType;
  createdAt: Date;
  actor: FeedActivityActor | null;
  post: FeedActivityPost | null;
  /** `like` and `comment_like` rows only. */
  reactionType?: string;
  /**
   * The comment this row is about: the new comment/reply, the comment that
   * mentioned the caller, or the caller's comment that was reacted to. Set on
   * `comment`, `reply`, `comment_mention` and `comment_like` rows.
   */
  comment?: { _id: any; content: string };
}

/**
 * The thumbnail an activity row shows: the first image or video on the post,
 * falling back to an article cover, else null. Defined explicitly because
 * `attachments` is an array and "which one" is otherwise ambiguous.
 */
function attachmentPreviewOf(post: any): string | null {
  const first = (post?.attachments ?? []).find(
    (a: any) => a?.type === "image" || a?.type === "video"
  );
  return first?.url ?? post?.coverImage ?? null;
}

function shapePost(post: any): FeedActivityPost | null {
  if (!post) return null;
  return {
    _id: post._id,
    content: post.content,
    coverImage: post.coverImage ?? null,
    attachmentPreview: attachmentPreviewOf(post),
  };
}

function shapeActor(user: any): FeedActivityActor | null {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    profilePicture: user.profilePicture ?? null,
  };
}

/**
 * Ids of posts the caller authored, newest first and bounded.
 *
 * See ACTIVITY_POST_SCAN_LIMIT: a prolific author gets activity on their recent
 * posts rather than a query that degrades silently as they write more.
 */
async function recentAuthoredPostIds(
  userId: string,
  orgId: string
): Promise<Types.ObjectId[]> {
  const rows = await Post.find({
    authorId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .limit(ACTIVITY_POST_SCAN_LIMIT)
    .select("_id")
    .lean();
  return rows.map((r: any) => r._id);
}

/**
 * Ids of comments the caller wrote, newest first and bounded.
 *
 * See ACTIVITY_COMMENT_SCAN_LIMIT: replies and comment reactions are looked up
 * by an `$in` over this list, so it has to stay small enough for the planner to
 * keep serving the sort from the index instead of buffering it. A heavy
 * commenter therefore gets notified about their recent comments, not all of
 * them — which is what the screen scrolls anyway.
 */
async function recentAuthoredCommentIds(
  userId: string,
  orgId: string
): Promise<Types.ObjectId[]> {
  const rows = await PostComment.find({
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
    isActive: { $ne: false },
  })
    .sort({ createdAt: -1 })
    .limit(ACTIVITY_COMMENT_SCAN_LIMIT)
    .select("_id")
    .lean();
  return rows.map((r: any) => r._id);
}

const ACTOR_SELECT = "name profilePicture";
const POST_SELECT = "content coverImage attachments";

/**
 * A comment reaction stores only `commentId` — the post it belongs to is one
 * hop further out, so `post` has to be populated THROUGH the comment.
 */
const COMMENT_WITH_POST_POPULATE = {
  path: "commentId",
  select: "content postId",
  populate: { path: "postId", select: POST_SELECT },
};

/**
 * Activity on the caller's content: reactions, comments, saves and reposts on
 * their posts, replies and reactions on their comments, plus posts and comments
 * that mention them.
 *
 * The caller's OWN actions are excluded throughout — "you liked your own post"
 * and "you replied to yourself" are noise, not activity.
 *
 * Each stream is queried separately and merged in memory rather than with a
 * `$unionWith`: the collections have different shapes and would need this
 * per-type projection anyway, and each stream is capped at `offset + limit`.
 */
export async function getFeedActivity(
  userId: string,
  orgId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: FeedActivityType;
    withTotal?: boolean;
  } = {}
): Promise<{
  activity: FeedActivityRow[];
  total: number | null;
  pagination: { limit: number; offset: number; hasMore: boolean };
}> {
  const { limit = 30, offset = 0, type, withTotal = false } = options;

  const me = new Types.ObjectId(userId);
  const org = new Types.ObjectId(orgId);
  const wants = (t: FeedActivityType) => !type || type === t;

  // Only `reply` and `comment_like` are keyed off the caller's own comments, so
  // a `type` filter that excludes both should not pay for the scan.
  const [postIds, commentIds] = await Promise.all([
    recentAuthoredPostIds(userId, orgId),
    wants("reply") || wants("comment_like")
      ? recentAuthoredCommentIds(userId, orgId)
      : Promise.resolve([] as Types.ObjectId[]),
  ]);

  // How deep each stream must reach for the merged slice to be correct: the
  // worst case is every row on this page coming from a single stream.
  const reach = offset + limit;
  const hasPosts = postIds.length > 0;
  const hasComments = commentIds.length > 0;

  const engagement = { postId: { $in: postIds }, userId: { $ne: me } };

  const [
    likes,
    comments,
    saves,
    reposts,
    mentions,
    replies,
    commentMentions,
    commentLikes,
  ] = await Promise.all([
    wants("like") && hasPosts
      ? PostLike.find(engagement)
          .sort({ createdAt: -1 })
          .limit(reach)
          .populate("userId", ACTOR_SELECT)
          .populate("postId", POST_SELECT)
          .lean()
      : Promise.resolve([] as any[]),
    wants("comment") && hasPosts
      ? PostComment.find({ ...engagement, isActive: { $ne: false } })
          .sort({ createdAt: -1 })
          .limit(reach)
          .populate("userId", ACTOR_SELECT)
          .populate("postId", POST_SELECT)
          .lean()
      : Promise.resolve([] as any[]),
    wants("save") && hasPosts
      ? PostBookmark.find(engagement)
          .sort({ createdAt: -1 })
          .limit(reach)
          .populate("userId", ACTOR_SELECT)
          .populate("postId", POST_SELECT)
          .lean()
      : Promise.resolve([] as any[]),
    wants("repost") && hasPosts
      ? PostRepost.find(engagement)
          .sort({ createdAt: -1 })
          .limit(reach)
          .populate("userId", ACTOR_SELECT)
          .populate("postId", POST_SELECT)
          .lean()
      : Promise.resolve([] as any[]),
    // Mentions are not an engagement row: the actor is the post's author, and
    // the post IS the subject.
    wants("mention")
      ? Post.find({
          mentions: me,
          orgId: org,
          isActive: true,
          authorId: { $ne: me },
        })
          .sort({ createdAt: -1 })
          .limit(reach)
          .populate("authorId", ACTOR_SELECT)
          .select("content coverImage attachments authorId createdAt")
          .lean()
      : Promise.resolve([] as any[]),
    // A reply is a comment whose parent is one of MINE — note this fires on
    // anyone's post, including posts the caller never wrote, which is exactly
    // why it cannot ride on the `postId` engagement filter above.
    wants("reply") && hasComments
      ? PostComment.find({
          parentCommentId: { $in: commentIds },
          userId: { $ne: me },
          isActive: { $ne: false },
        })
          .sort({ createdAt: -1 })
          .limit(reach)
          .populate("userId", ACTOR_SELECT)
          .populate("postId", POST_SELECT)
          .lean()
      : Promise.resolve([] as any[]),
    // Same idea as the post `mention` stream, one level down: the subject is
    // the comment, and the actor is whoever wrote it. Org-scoped because a
    // user id is global while activity is per-org.
    wants("comment_mention")
      ? PostComment.find({
          mentions: me,
          orgId: org,
          userId: { $ne: me },
          isActive: { $ne: false },
        })
          .sort({ createdAt: -1 })
          .limit(reach)
          .populate("userId", ACTOR_SELECT)
          .populate("postId", POST_SELECT)
          .lean()
      : Promise.resolve([] as any[]),
    wants("comment_like") && hasComments
      ? PostCommentLike.find({
          commentId: { $in: commentIds },
          userId: { $ne: me },
        })
          .sort({ createdAt: -1 })
          .limit(reach)
          .populate("userId", ACTOR_SELECT)
          .populate(COMMENT_WITH_POST_POPULATE)
          .lean()
      : Promise.resolve([] as any[]),
  ]);

  const rows: FeedActivityRow[] = [
    ...(likes as any[]).map((r) => ({
      type: "like" as const,
      createdAt: r.createdAt,
      actor: shapeActor(r.userId),
      post: shapePost(r.postId),
      reactionType: r.reactionType,
    })),
    ...(comments as any[]).map((r) => ({
      type: "comment" as const,
      createdAt: r.createdAt,
      actor: shapeActor(r.userId),
      post: shapePost(r.postId),
      comment: { _id: r._id, content: r.content },
    })),
    ...(saves as any[]).map((r) => ({
      type: "save" as const,
      createdAt: r.createdAt,
      actor: shapeActor(r.userId),
      post: shapePost(r.postId),
    })),
    ...(reposts as any[]).map((r) => ({
      type: "repost" as const,
      createdAt: r.createdAt,
      actor: shapeActor(r.userId),
      post: shapePost(r.postId),
    })),
    ...(mentions as any[]).map((r) => ({
      type: "mention" as const,
      createdAt: r.createdAt,
      actor: shapeActor(r.authorId),
      post: shapePost(r),
    })),
    ...(replies as any[]).map((r) => ({
      type: "reply" as const,
      createdAt: r.createdAt,
      actor: shapeActor(r.userId),
      post: shapePost(r.postId),
      // The reply itself, not the parent: it is the new thing to read.
      comment: { _id: r._id, content: r.content },
    })),
    ...(commentMentions as any[]).map((r) => ({
      type: "comment_mention" as const,
      createdAt: r.createdAt,
      actor: shapeActor(r.userId),
      post: shapePost(r.postId),
      comment: { _id: r._id, content: r.content },
    })),
    ...(commentLikes as any[]).map((r) => ({
      type: "comment_like" as const,
      createdAt: r.createdAt,
      actor: shapeActor(r.userId),
      // Both the post and the comment come off the populated comment; a
      // hard-deleted comment leaves `post` null and the row is dropped below.
      post: shapePost(r.commentId?.postId),
      comment: r.commentId
        ? { _id: r.commentId._id, content: r.commentId.content }
        : undefined,
      reactionType: r.reactionType,
    })),
  ]
    // A populated ref is null when the referenced document was deleted; such a
    // row has nothing to render. The actor may still be null (deleted user) and
    // is kept, so counts and list length do not disagree.
    .filter((r) => r.post !== null)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  return {
    activity: rows.slice(offset, offset + limit),
    // Counting is the expensive half of this endpoint, so it is opt-in. With a
    // `type` filter set, the total is for THAT type only.
    total: withTotal
      ? await countFeedActivity(userId, orgId, { type })
      : null,
    pagination: {
      limit,
      offset,
      // Derived from what we actually fetched. Exact while the merged set is
      // smaller than `reach`; a lower bound beyond that, which is the right way
      // round for an infinite list.
      hasMore: rows.length > offset + limit,
    },
  };
}

/**
 * How many activity rows exist, optionally of one type and/or since an instant.
 *
 * Eight `countDocuments` calls — which is why the feed endpoint makes it opt-in
 * and the badge route caches it.
 */
export async function countFeedActivity(
  userId: string,
  orgId: string,
  options: { type?: FeedActivityType; since?: Date | null } = {}
): Promise<number> {
  const { type, since } = options;
  const me = new Types.ObjectId(userId);
  const org = new Types.ObjectId(orgId);
  const wants = (t: FeedActivityType) => !type || type === t;

  const [postIds, commentIds] = await Promise.all([
    recentAuthoredPostIds(userId, orgId),
    wants("reply") || wants("comment_like")
      ? recentAuthoredCommentIds(userId, orgId)
      : Promise.resolve([] as Types.ObjectId[]),
  ]);

  const hasPosts = postIds.length > 0;
  const hasComments = commentIds.length > 0;

  const engagement: any = { postId: { $in: postIds }, userId: { $ne: me } };
  if (since) engagement.createdAt = { $gt: since };

  const mentionFilter: any = {
    mentions: me,
    orgId: org,
    isActive: true,
    authorId: { $ne: me },
  };
  if (since) mentionFilter.createdAt = { $gt: since };

  const replyFilter: any = {
    parentCommentId: { $in: commentIds },
    userId: { $ne: me },
    isActive: { $ne: false },
  };
  if (since) replyFilter.createdAt = { $gt: since };

  const commentMentionFilter: any = {
    mentions: me,
    orgId: org,
    userId: { $ne: me },
    isActive: { $ne: false },
  };
  if (since) commentMentionFilter.createdAt = { $gt: since };

  const commentLikeFilter: any = {
    commentId: { $in: commentIds },
    userId: { $ne: me },
  };
  if (since) commentLikeFilter.createdAt = { $gt: since };

  const counts = await Promise.all([
    wants("like") && hasPosts
      ? PostLike.countDocuments(engagement)
      : Promise.resolve(0),
    wants("comment") && hasPosts
      ? PostComment.countDocuments({ ...engagement, isActive: { $ne: false } })
      : Promise.resolve(0),
    wants("save") && hasPosts
      ? PostBookmark.countDocuments(engagement)
      : Promise.resolve(0),
    wants("repost") && hasPosts
      ? PostRepost.countDocuments(engagement)
      : Promise.resolve(0),
    wants("mention") ? Post.countDocuments(mentionFilter) : Promise.resolve(0),
    wants("reply") && hasComments
      ? PostComment.countDocuments(replyFilter)
      : Promise.resolve(0),
    wants("comment_mention")
      ? PostComment.countDocuments(commentMentionFilter)
      : Promise.resolve(0),
    wants("comment_like") && hasComments
      ? PostCommentLike.countDocuments(commentLikeFilter)
      : Promise.resolve(0),
  ]);

  return counts.reduce((sum, n) => sum + (Number(n) || 0), 0);
}

/**
 * Unread count for the badge, cached briefly.
 *
 * Mobile polls badges hard, and the uncached path is eight `countDocuments`.
 * A short in-process TTL keeps a burst of polls to one round of queries; the
 * cost of being up to 30s stale on a badge is nil.
 *
 * It has no query set of its own — every type, new ones included, is counted
 * through `countFeedActivity`, so the two can never drift apart.
 *
 * In-process on purpose — a shared cache would need invalidation on every like,
 * which is a far larger change than the badge is worth.
 */
const UNREAD_CACHE_TTL_MS = 30_000;
const unreadCache = new Map<string, { value: number; at: number }>();

export async function getUnreadActivityCount(
  userId: string,
  orgId: string
): Promise<number> {
  const key = `${userId}:${orgId}`;
  const hit = unreadCache.get(key);
  if (hit && Date.now() - hit.at < UNREAD_CACHE_TTL_MS) return hit.value;

  const marker = await FeedActivityRead.findOne({
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
  }).lean();

  // No marker means the user has never opened Activity: everything is unread.
  const value = await countFeedActivity(userId, orgId, {
    since: (marker as any)?.lastReadAt ?? null,
  });

  unreadCache.set(key, { value, at: Date.now() });
  return value;
}

/** Mark everything up to now as read, and drop the cached count. */
export async function markActivityRead(
  userId: string,
  orgId: string
): Promise<void> {
  await FeedActivityRead.findOneAndUpdate(
    { userId: new Types.ObjectId(userId), orgId: new Types.ObjectId(orgId) },
    { $set: { lastReadAt: new Date() } },
    { upsert: true }
  );
  unreadCache.delete(`${userId}:${orgId}`);
}
