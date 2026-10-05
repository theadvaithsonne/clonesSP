import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { isFounderOrModuleAdmin } from "../utils/rbac";
import { User } from "../models/user.model";
import { Channel } from "../models/channel.model";
import {
  emailAlertsZodSchema,
  normalizeEmailAlerts,
} from "../models/emailAlerts.schema";
import {
  founderAlertsZodSchema,
  normalizeFounderAlerts,
} from "../models/founderAlerts.schema";
import { normalizeThankYouPage } from "../services/thankYouPage";

// Loose Zod shape for the founder-supplied thankYouPage payload. Deep
// validation (URL well-formedness, section count, trimmed strings) lives
// in `normalizeThankYouPage` and is called after `schema.parse` returns.
// `null` clears the config on update; `undefined` leaves it alone.
const thankYouPageZodSchema = z
  .object({
    autoRedirect: z.boolean(),
    redirectUrl: z.string().optional(),
    title: z.string().optional(),
    message: z.string().optional(),
    sections: z
      .array(
        z.object({
          heading: z.string(),
          buttonLabel: z.string(),
          buttonUrl: z.string(),
        }),
      )
      .optional(),
  })
  .nullable();
import { ChannelMembership } from "../models/channelMembership.model";
import { PostComment } from "../models/postComment.model";
import { PostCommentLike } from "../models/postCommentLike.model";
import { getSocketInstance } from "../services/socket";
import {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  toggleLike,
  addComment,
  updateComment,
  getComments,
  deleteComment,
  getUserChannels,
  getOrgChannels,
  subscribeToFreeChannel,
  subscribeToPaidChannel,
  unsubscribeFromChannel,
  canUserPostToChannels,
  // Repost functions
  toggleRepost,
  getPostReposts,
  // Bookmark functions
  toggleBookmark,
  getUserBookmarks,
  // Quote post functions
  createQuotePost,
  getPostWithQuote,
  // Trending functions
  getTrendingTags,
  searchPostsByTag,
  // Poll functions
  createPoll,
  votePoll,
  getPollByPostId,
  getPollResults,
  // Share link
  generateShareLink,
  // Reaction functions
  toggleReaction,
  removeReaction,
  toggleCommentReaction,
  removeCommentReaction,
  getPostReactions,
  // Mention notification functions
  createPostMentionNotifications,
  createCommentMentionNotifications,
  // Pin post functions
  pinPost,
  unpinPost,
} from "../services/feed";
import {
  FEED_ACTIVITY_TYPES,
  type FeedActivityType,
  getFeedActivity,
  getUnreadActivityCount,
  markActivityRead,
} from "../services/feedActivity";
import { parseMentions } from "../utils/mentions";
import {
  sendFeedEngagementPushNotification,
  type FeedEngagement,
} from "../services/pushNotification";
import { REACTION_TYPES, ReactionType } from "../models/postLike.model";
import {
  createChannelSubscriptionOrder,
  verifyPaymentSignature,
} from "../services/razorpay";
import { Organization } from "../models/organization.model";
import { notifyNewChannelCreated, notifyNewFeedPostCreated } from "../services/bulkEmail";
import { distributeCommissions } from "../services/commission";
import { convertToUsd } from "../utils/exchangeRate";
import { Invoice } from "../models/invoice.model";
import { Workshop } from "../models/workshop.model";
import { Course } from "../models/course.model";
import { Product } from "../models/product.model";
import { ProductOrder } from "../models/productOrder.model";
import { AffiliateConversion } from "../models/affiliateConversion.model";
import {
  setDefaultChannel,
  clearDefaultChannel,
  setChannelMandatory,
  clearMandatoryIfPaid,
} from "../services/channel";
import {
  createSubscriptionPlan,
  getSubscriptionPlanForItem,
  createUserSubscription,
  hasSubscriptionAccess,
  getUserActiveSubscription,
} from "../services/subscription";
import { SubscriptionPlan } from "../models/subscriptionPlan.model";
import { Subscription } from "../models/subscription.model";

const router = Router();

/**
 * Tell a post's author that someone engaged with it.
 *
 * Fire-and-forget on purpose, and deliberately NOT awaited by any caller: a
 * push that fails must never turn a successful like into a 500. Every error is
 * swallowed after logging, matching how this file already treats mention
 * notifications.
 *
 * The author and the actor are looked up here because none of the engagement
 * handlers load either — the toggles only `$inc` a counter on the post and
 * return the new count. Two lean queries per engagement is the cost of that;
 * they run after the response is already on its way out.
 *
 * Self-engagement and blocks are NOT filtered here — `sendFeedEngagement-
 * PushNotification` owns both, so they hold for every call site including ones
 * added later.
 */
function notifyFeedEngagement(
  postId: string,
  actorId: string,
  engagement: FeedEngagement,
  /** Who to tell. Omit for the post's author — the usual case. A reply passes
   *  the parent comment's author instead. */
  recipientId?: string
): void {
  void (async () => {
    const { Post } = await import("../models/post.model");
    const [post, actor] = await Promise.all([
      Post.findById(postId).select("authorId content").lean(),
      User.findById(actorId).select("name email profilePicture").lean(),
    ]);
    if (!post) return;

    await sendFeedEngagementPushNotification(
      recipientId ?? String((post as any).authorId),
      {
        id: actorId,
        name: (actor as any)?.name || (actor as any)?.email,
        avatar: (actor as any)?.profilePicture,
      },
      { id: postId, content: (post as any).content },
      engagement
    );
  })().catch((err) =>
    console.error(`[FEED PUSH] ${engagement.kind} on ${postId} failed:`, err)
  );
}

/**
 * Strip HTML tags/entities that leaked into href attribute values.
 * Used to sanitize article content before saving to the database.
 */
function cleanHrefsInHtml(html: string): string {
  return html.replace(
    /href=(["'])([\s\S]*?)\1/gi,
    (_match: string, quote: string, rawValue: string) => {
      let decoded = rawValue
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&amp;/gi, "&");
      if (/<[a-z/!]/i.test(decoded)) {
        decoded = decoded.replace(/<[^>]*>/g, "");
        decoded = decoded.replace(/[>"']+$/, "");
        const urlMatch = decoded.match(/^(https?:\/\/[^\s"'<>]+)/i);
        if (urlMatch) decoded = urlMatch[1];
      }
      return `href=${quote}${decoded.trim()}${quote}`;
    }
  );
}

/**
 * Can this user manage the community in this org?
 *
 * Founders, legacy single-org admins and `fullAccess` holders — plus members a
 * founder granted the "community" module via /rbac. A superset of the founder
 * check this previously performed, so nobody loses access.
 */
async function isUserFounder(userId: string, orgId: string): Promise<boolean> {
  return isFounderOrModuleAdmin(userId, orgId, "community");
}

// ============= Post Endpoints =============

/**
 * POST /feed/posts/:postId/pin
 * Pin a post (founder only). Automatically unpins any previously pinned post in the org.
 */
router.post("/posts/:postId/pin", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { postId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({ success: false, error: "Only founders can pin posts" });
    }

    await pinPost(postId, orgId);

    const io = getSocketInstance();
    if (io) {
      io.to(`org:${orgId}:feed`).emit("feed:post-pinned", { postId, orgId });
    }

    return res.json({ success: true, message: "Post pinned" });
  } catch (error) {
    console.error("Error pinning post:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to pin post",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /feed/posts/:postId/pin
 * Unpin a post (founder only).
 */
router.delete("/posts/:postId/pin", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { postId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({ success: false, error: "Only founders can unpin posts" });
    }

    await unpinPost(postId, orgId);

    const io = getSocketInstance();
    if (io) {
      io.to(`org:${orgId}:feed`).emit("feed:post-unpinned", { postId, orgId });
    }

    return res.json({ success: true, message: "Post unpinned" });
  } catch (error) {
    console.error("Error unpinning post:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to unpin post",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/posts
 * Get posts for the current user (filtered by channel memberships)
 */
router.get("/posts", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      channelId: z.string().optional(),
      postType: z.enum(["post", "article"]).optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });
    const { orgId, channelId, postType, limit, offset } = schema.parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);

    const result = await getPosts(me.userId, orgId, {
      channelId,
      postType,
      limit,
      offset,
      isFounder,
    });

    res.json({
      success: true,
      posts: result.posts,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error getting posts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get posts",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/posts/:postId
 * Get a single post
 */
router.get("/posts/:postId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { postId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const post = await getPostById(postId, me.userId);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    // Check if user can view this post
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      const { canUserViewPost } = await import("../services/feed");
      const canView = await canUserViewPost(
        me.userId,
        orgId,
        post.channelIds,
        false
      );
      if (!canView) {
        return res.status(403).json({
          success: false,
          error: "You don't have access to this post",
        });
      }
    }

    res.json({ success: true, post });
  } catch (error) {
    console.error("Error getting post:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get post",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /feed/posts
 * Create a new post
 */
router.post("/posts", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Max content length depends on postType. We parse the body first with
    // a permissive schema and then enforce the per-type limit below.
    const POST_CONTENT_MAX = 3000;
    const ARTICLE_CONTENT_MAX = 1_100_000;
    const schema = z.object({
      content: z.string().min(1).max(ARTICLE_CONTENT_MAX),
      channelIds: z.array(z.string()).min(1),
      tags: z.array(z.string().max(50)).optional(),
      attachments: z
        .array(
          z.object({
            type: z.enum(["image", "video", "document", "audio"]),
            url: z.string(),
            name: z.string(),
            fileKey: z.string().optional(),
          })
        )
        .optional(),
      linkPreviews: z
        .array(
          z.object({
            url: z.string(),
            title: z.string().optional(),
            description: z.string().optional(),
            image: z.string().nullable().optional(),
            siteName: z.string().optional(),
            showThumbnail: z.boolean().optional(),
          })
        )
        .optional(),
      // Article fields
      postType: z.enum(["post", "article"]).optional().default("post"),
      title: z.string().max(200).optional(),
      coverImage: z.string().optional(),
    });
    const { content, channelIds, tags, attachments, linkPreviews, postType, title: articleTitle, coverImage } = schema.parse(req.body);

    // Enforce per-type content length limit
    const effectiveMax = postType === "article" ? ARTICLE_CONTENT_MAX : POST_CONTENT_MAX;
    if (content.length > effectiveMax) {
      return res.status(400).json({
        success: false,
        error: postType === "article"
          ? `Article content is too long (max ${ARTICLE_CONTENT_MAX.toLocaleString()} characters)`
          : `Post content is too long (max ${POST_CONTENT_MAX.toLocaleString()} characters)`,
      });
    }

    // Validate article: title is required
    if (postType === "article" && (!articleTitle || !articleTitle.trim())) {
      return res.status(400).json({
        success: false,
        error: "Article title is required",
      });
    }

    // Check if user can post to these channels
    const isFounder = await isUserFounder(me.userId, orgId);
    const { canPost, invalidChannels, restrictedChannels } = await canUserPostToChannels(
      me.userId,
      orgId,
      channelIds,
      isFounder
    );

    if (!canPost) {
      const isRestricted = restrictedChannels && restrictedChannels.length > 0;
      return res.status(403).json({
        success: false,
        error: isRestricted
          ? "You are restricted from posting in this community"
          : "You are not subscribed to some channels",
        invalidChannels,
        restrictedChannels,
      });
    }

    // Get potential users for mention parsing (org members who can see the channels)
    const channelMemberships = await ChannelMembership.find({
      channelId: { $in: channelIds.map((id) => new Types.ObjectId(id)) },
      orgId: new Types.ObjectId(orgId),
      status: "active",
    })
      .select("userId")
      .lean();
    const memberUserIds = [
      ...new Set(channelMemberships.map((m) => m.userId.toString())),
    ];
    const potentialUsers = await User.find({
      _id: { $in: memberUserIds },
    })
      .select("_id name email")
      .lean();

    // Parse mentions from content (exclude the author from mentions)
    const mentionedUserIds = parseMentions(content, potentialUsers, me.userId);

    const post = await createPost({
      content: postType === 'article' ? cleanHrefsInHtml(content) : content,
      authorId: me.userId,
      orgId,
      channelIds,
      tags,
      mentions: mentionedUserIds,
      attachments,
      linkPreviews,
      postType,
      title: articleTitle,
      coverImage,
    });

    // Populate the post for response
    const populatedPost = await getPostById(post._id.toString(), me.userId);

    // Emit real-time event to channel rooms
    const io = getSocketInstance();
    if (io) {
      channelIds.forEach((channelId) => {
        io.to(`channel:${channelId}`).emit("feed:new-post", {
          post: populatedPost,
        });
      });
      // Also emit to org room for founders
      io.to(`org:${orgId}:feed`).emit("feed:new-post", {
        post: populatedPost,
      });
    }

    // Create notifications for mentioned users (async, don't block response)
    if (mentionedUserIds.length > 0) {
      createPostMentionNotifications(
        post._id.toString(),
        me.userId,
        orgId,
        content,
        mentionedUserIds,
        channelIds[0] // Use first channel for notification context
      ).catch((err) =>
        console.error("Failed to create post mention notifications:", err)
      );
    }

    // Send HQ-level email notification to org members (fire-and-forget)
    (async () => {
      try {
        const [author, org] = await Promise.all([
          User.findById(me.userId).select("email name").lean(),
          Organization.findById(orgId).select("name slug").lean(),
        ]);
        if (author?.email && org?.name && org?.slug) {
          notifyNewFeedPostCreated(
            { _id: post._id.toString(), content, postType, title: articleTitle },
            { email: author.email, name: author.name || "" },
            { _id: orgId, name: org.name, slug: org.slug }
          );
        }
      } catch (err) {
        console.error("Failed to send feed post email notification:", err);
      }
    })();

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: populatedPost,
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create post",
      details: (error as Error).message,
    });
  }
});

/**
 * PUT /feed/posts/:postId
 * Update a post
 */
router.put("/posts/:postId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { postId } = req.params;

    const POST_CONTENT_MAX = 3000;
    const ARTICLE_CONTENT_MAX = 1_100_000;
    const schema = z.object({
      content: z.string().min(1).max(ARTICLE_CONTENT_MAX).optional(),
      channelIds: z.array(z.string()).optional(),
      tags: z.array(z.string().max(50)).optional(),
      postType: z.enum(["post", "article"]).optional(),
      linkPreviews: z
        .array(
          z.object({
            url: z.string(),
            title: z.string().optional(),
            description: z.string().optional(),
            image: z.string().nullable().optional(),
            siteName: z.string().optional(),
            showThumbnail: z.boolean().optional(),
          })
        )
        .optional(),
      // Article fields
      title: z.string().max(200).optional(),
      coverImage: z.string().optional(),
    });
    const data = schema.parse(req.body);

    // Enforce per-type content length limit on updates
    if (data.content) {
      const effectiveMax = data.postType === "article" ? ARTICLE_CONTENT_MAX : POST_CONTENT_MAX;
      if (data.content.length > effectiveMax) {
        return res.status(400).json({
          success: false,
          error: data.postType === "article"
            ? `Article content is too long (max ${ARTICLE_CONTENT_MAX.toLocaleString()} characters)`
            : `Post content is too long (max ${POST_CONTENT_MAX.toLocaleString()} characters)`,
        });
      }
    }

    // Sanitize article content before saving
    if (data.content) {
      data.content = cleanHrefsInHtml(data.content);
    }

    const updatedPost = await updatePost(postId, me.userId, data);

    if (!updatedPost) {
      return res.status(404).json({
        success: false,
        error: "Post not found or you don't have permission to edit",
      });
    }

    const populatedPost = await getPostById(postId, me.userId);

    res.json({
      success: true,
      message: "Post updated successfully",
      post: populatedPost,
    });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update post",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /feed/posts/:postId
 * Delete a post
 */
router.delete("/posts/:postId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { postId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);
    const deleted = await deletePost(postId, me.userId, isFounder);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Post not found or you don't have permission to delete",
      });
    }

    res.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete post",
      details: (error as Error).message,
    });
  }
});

// ============= Like Endpoints =============

/**
 * POST /feed/posts/:postId/like
 * Toggle like on a post
 */
router.post("/posts/:postId/like", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { postId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const result = await toggleLike(postId, me.userId, orgId);

    // Emit real-time update
    const io = getSocketInstance();
    if (io) {
      io.to(`post:${postId}`).emit("feed:post-liked", {
        postId,
        likesCount: result.likesCount,
        userId: me.userId,
        liked: result.liked,
      });
    }

    // Only the like half of the toggle is news — un-liking is not.
    if (result.liked) {
      notifyFeedEngagement(postId, me.userId, {
        kind: "reaction",
        reactionType: "like",
      });
    }

    res.json({
      success: true,
      liked: result.liked,
      likesCount: result.likesCount,
    });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle like",
      details: (error as Error).message,
    });
  }
});

// ============= Reaction Endpoints =============

/**
 * POST /feed/posts/:postId/react
 * Toggle reaction on a post (add, change, or remove)
 */
router.post("/posts/:postId/react", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { postId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const schema = z.object({
      reactionType: z.enum(REACTION_TYPES as unknown as [string, ...string[]]),
    });
    const { reactionType } = schema.parse(req.body);

    const result = await toggleReaction(postId, me.userId, orgId, reactionType as ReactionType);

    // Emit real-time update
    const io = getSocketInstance();
    if (io) {
      io.to(`post:${postId}`).emit("feed:post-reacted", {
        postId,
        userId: me.userId,
        reacted: result.reacted,
        reactionType: result.reactionType,
        reactionsCount: result.reactionsCount,
      });
    }

    // Only a FIRST reaction is news. `reacted` is also true when someone swaps
    // 👍 for 🔥, which is one person's one opinion and must not buzz the author
    // twice — hence `changed`. Removing a reaction returns `reacted: false` and
    // is silent on its own.
    if (result.reacted && !result.changed) {
      notifyFeedEngagement(postId, me.userId, {
        kind: "reaction",
        reactionType: result.reactionType ?? reactionType,
      });
    }

    res.json({
      success: true,
      reacted: result.reacted,
      reactionType: result.reactionType,
      reactionsCount: result.reactionsCount,
    });
  } catch (error) {
    console.error("Error toggling reaction:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle reaction",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /feed/posts/:postId/react
 * Remove reaction from a post
 */
router.delete("/posts/:postId/react", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { postId } = req.params;

    const result = await removeReaction(postId, me.userId);

    // Emit real-time update
    const io = getSocketInstance();
    if (io) {
      io.to(`post:${postId}`).emit("feed:post-reacted", {
        postId,
        userId: me.userId,
        reacted: false,
        reactionType: null,
        reactionsCount: result.reactionsCount,
      });
    }

    res.json({
      success: true,
      removed: result.success,
      reactionsCount: result.reactionsCount,
    });
  } catch (error) {
    console.error("Error removing reaction:", error);
    res.status(500).json({
      success: false,
      error: "Failed to remove reaction",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/posts/:postId/reactions
 * Get users who reacted to a post
 */
router.get("/posts/:postId/reactions", requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const schema = z.object({
      reactionType: z.enum(REACTION_TYPES as unknown as [string, ...string[]]).optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });
    const { reactionType, limit, offset } = schema.parse(req.query);

    const result = await getPostReactions(postId, {
      reactionType: reactionType as ReactionType | undefined,
      limit,
      offset,
    });

    res.json({
      success: true,
      reactions: result.reactions,
      total: result.total,
      byType: result.byType,
    });
  } catch (error) {
    console.error("Error getting reactions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get reactions",
      details: (error as Error).message,
    });
  }
});

// ============= Comment Endpoints =============

/**
 * GET /feed/posts/:postId/comments
 * Get comments for a post
 */
router.get("/posts/:postId/comments", requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const schema = z.object({
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
      parentCommentId: z.string().optional(),
    });
    const { limit, offset, parentCommentId } = schema.parse(req.query);

    const result = await getComments(postId, {
      limit,
      offset,
      // Only pass parentCommentId if explicitly provided in query
      // undefined = return all comments for threaded view
      ...(parentCommentId !== undefined && { parentCommentId: parentCommentId || null }),
    });

    const me = (req as any).user as { userId: string };
    const commentIds = result.comments.map((c) => c._id);
    const userLikes = await PostCommentLike.find({
      commentId: { $in: commentIds },
      userId: new Types.ObjectId(me.userId),
    }).lean();

    const userReactionMap = new Map<string, string>(
      userLikes.map((l) => [l.commentId.toString(), l.reactionType])
    );

    const commentsWithReactions = result.comments.map((c) => ({
      ...c,
      userReaction: userReactionMap.get(c._id.toString()) || null,
    }));

    res.json({
      success: true,
      comments: commentsWithReactions,
      total: result.total,
    });
  } catch (error) {
    console.error("Error getting comments:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get comments",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /feed/posts/:postId/comments
 * Add a comment to a post
 */
router.post("/posts/:postId/comments", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { postId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Frontend (FeedComponents.tsx:107) types attachments as
    // image | video | document | audio. Backend was previously
    // accepting only image | gif | audio — so any video or document
    // attachment failed Zod with a generic "Failed to add comment"
    // toast and no clue why. Aligning the accepted set to the full
    // FE union plus `gif` (which the composer also produces via the
    // GIF picker, even though the union doesn't list it).
    const attachmentSchema = z.object({
      type: z.enum(["image", "video", "document", "audio", "gif"]),
      url: z.string().url(),
      name: z.string(),
      fileKey: z.string().optional(),
    });
    const schema = z.object({
      content: z.string().max(1000).optional().default(""),
      parentCommentId: z.string().optional(),
      attachments: z.array(attachmentSchema).optional(),
    });
    const { content, parentCommentId, attachments } = schema.parse(req.body);

    // Require either content or attachments
    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({
        success: false,
        error: "Comment must have content or attachments",
      });
    }

    // Check if user is restricted from posting/commenting in the post's channels
    const postDoc = await getPostById(postId, me.userId);
    if (postDoc) {
      const isFounder = await isUserFounder(me.userId, orgId);
      const postChannelIds = (postDoc.channelIds || []).map(
        (ch: any) => ch._id?.toString() || ch.toString()
      );
      const { restrictedChannels } = await canUserPostToChannels(
        me.userId,
        orgId,
        postChannelIds,
        isFounder
      );
      if (restrictedChannels && restrictedChannels.length > 0) {
        return res.status(403).json({
          success: false,
          error: "You are restricted from commenting in this community",
        });
      }
    }

    // Get potential users for mention parsing (org members)
    const orgUsers = await User.find({
      $or: [
        { organization: new Types.ObjectId(orgId) },
        { "organizations.organization": new Types.ObjectId(orgId) },
      ],
    })
      .select("_id name email")
      .lean();

    // Parse mentions from content (exclude the author from mentions)
    const mentionedUserIds = parseMentions(content, orgUsers, me.userId);

    const comment = await addComment(
      postId,
      me.userId,
      orgId,
      content,
      parentCommentId,
      mentionedUserIds,
      attachments
    );

    // Emit real-time update
    const io = getSocketInstance();
    if (io) {
      io.to(`post:${postId}`).emit("feed:new-comment", {
        postId,
        comment,
      });
    }

    // Create notifications for mentioned users (async, don't block response)
    if (mentionedUserIds.length > 0) {
      createCommentMentionNotifications(
        comment._id.toString(),
        postId,
        me.userId,
        orgId,
        content,
        mentionedUserIds
      ).catch((err) =>
        console.error("Failed to create comment mention notifications:", err)
      );
    }

    // Push the comment at the people it concerns. Anyone @mentioned is skipped
    // here — `createCommentMentionNotifications` already pushes them, and being
    // both mentioned and the post's author should still be one buzz, not two.
    {
      const mentioned = new Set(mentionedUserIds.map(String));
      const postAuthorId = postDoc
        ? String((postDoc as any).authorId?._id ?? (postDoc as any).authorId)
        : null;

      if (parentCommentId) {
        // A reply concerns the replied-to comment's author first.
        const parent = await PostComment.findById(parentCommentId)
          .select("userId")
          .lean();
        const parentAuthorId = parent ? String((parent as any).userId) : null;

        if (parentAuthorId && !mentioned.has(parentAuthorId)) {
          notifyFeedEngagement(
            postId,
            me.userId,
            { kind: "reply", commentId: comment._id.toString(), text: content },
            parentAuthorId
          );
        }
        // The post's author still hears about activity under their post —
        // unless they ARE the person replied to, in which case they have
        // already been told once.
        if (
          postAuthorId &&
          postAuthorId !== parentAuthorId &&
          !mentioned.has(postAuthorId)
        ) {
          notifyFeedEngagement(postId, me.userId, {
            kind: "comment",
            commentId: comment._id.toString(),
            text: content,
          });
        }
      } else if (postAuthorId && !mentioned.has(postAuthorId)) {
        notifyFeedEngagement(postId, me.userId, {
          kind: "comment",
          commentId: comment._id.toString(),
          text: content,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment,
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add comment",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /feed/comments/:commentId/react
 * Toggle a reaction on a comment. Same shape as the post-react surface:
 *   body  { reactionType }
 *   reply { success, reacted, reactionType, reactionsCount }
 * Mirrored 1:1 so mobile + Garage web call /feed/comments/:id/react the
 * same way they call /feed/posts/:id/react.
 */
router.post("/comments/:commentId/react", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { commentId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const schema = z.object({
      reactionType: z.enum(REACTION_TYPES as unknown as [string, ...string[]]),
    });
    const { reactionType } = schema.parse(req.body);

    const result = await toggleCommentReaction(
      commentId,
      me.userId,
      orgId,
      reactionType as ReactionType,
    );

    // Re-use the post room — every comment lives under a single post,
    // and the feed clients already subscribe to `post:<postId>` for
    // realtime comment updates.
    //
    // `userId`/`content` come along for the push below: the recipient is the
    // COMMENT's author, not the post's, and the body quotes the comment.
    const comment = await PostComment.findById(commentId)
      .select("postId userId content")
      .lean();
    if (comment) {
      const io = getSocketInstance();
      if (io) {
        io.to(`post:${comment.postId.toString()}`).emit("feed:comment-reacted", {
          postId: comment.postId.toString(),
          commentId,
          userId: me.userId,
          reacted: result.reacted,
          reactionType: result.reactionType,
          reactionsCount: result.reactionsCount,
        });
      }

      // Only a FIRST reaction is news, exactly as on the post surface: a swap
      // (👍 → 🔥) is one person's one opinion and must not buzz the comment's
      // author twice, and removing a reaction is silent. Self-reactions and
      // blocks are filtered inside the notifier.
      if (result.reacted && !result.changed) {
        notifyFeedEngagement(
          comment.postId.toString(),
          me.userId,
          {
            kind: "comment_reaction",
            commentId,
            reactionType: result.reactionType ?? reactionType,
            text: (comment as any).content,
          },
          String((comment as any).userId)
        );
      }
    }

    res.json({
      success: true,
      reacted: result.reacted,
      reactionType: result.reactionType,
      reactionsCount: result.reactionsCount,
    });
  } catch (error) {
    console.error("Error toggling comment reaction:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle comment reaction",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /feed/comments/:commentId/react
 * Remove the caller's reaction on a comment.
 */
router.delete("/comments/:commentId/react", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { commentId } = req.params;

    const result = await removeCommentReaction(commentId, me.userId);

    const comment = await PostComment.findById(commentId).select("postId").lean();
    if (comment) {
      const io = getSocketInstance();
      if (io) {
        io.to(`post:${comment.postId.toString()}`).emit("feed:comment-reacted", {
          postId: comment.postId.toString(),
          commentId,
          userId: me.userId,
          reacted: false,
          reactionType: null,
          reactionsCount: result.reactionsCount,
        });
      }
    }

    res.json({
      success: true,
      reacted: false,
      reactionType: null,
      reactionsCount: result.reactionsCount,
    });
  } catch (error) {
    console.error("Error removing comment reaction:", error);
    res.status(500).json({
      success: false,
      error: "Failed to remove comment reaction",
      details: (error as Error).message,
    });
  }
});

/**
 * PUT /feed/comments/:commentId
 * Edit a comment (author only)
 */
router.put("/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { commentId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
    const { content } = z
      .object({ content: z.string().min(1).max(2000) })
      .parse(req.body);

    const updated = await updateComment(commentId, me.userId, content);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Comment not found or you don't have permission to edit",
      });
    }

    res.json({
      success: true,
      comment: updated,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update comment",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /feed/comments/:commentId
 * Delete a comment
 */
router.delete("/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { commentId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);
    const deleted = await deleteComment(commentId, me.userId, isFounder);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Comment not found or you don't have permission to delete",
      });
    }

    res.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete comment",
      details: (error as Error).message,
    });
  }
});

// ============= Channel Endpoints =============

/**
 * GET /feed/channels
 * Get all channels in an organization
 */
router.get("/channels", requireAuth, async (req, res) => {
  try {
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const channels = await getOrgChannels(orgId);

    res.json({
      success: true,
      channels,
    });
  } catch (error) {
    console.error("Error getting channels:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get channels",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/channels/subscribed
 * Get user's subscribed channels
 * Founders get all channels in the org
 */
router.get("/channels/subscribed", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);

    if (isFounder) {
      // Founders have access to all channels - return all org channels as "subscribed"
      const allChannels = await getOrgChannels(orgId);
      const channelsAsSubscribed = allChannels.map((ch: any) => ({
        channelId: ch._id.toString(),
        channelTitle: ch.title,
        status: "active",
        joinedAt: new Date(), // Founders are implicitly always subscribed
      }));

      return res.json({
        success: true,
        channels: channelsAsSubscribed,
        isFounder: true,
      });
    }

    const channels = await getUserChannels(me.userId, orgId);

    res.json({
      success: true,
      channels,
      isFounder: false,
    });
  } catch (error) {
    console.error("Error getting subscribed channels:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get subscribed channels",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /feed/channels/:channelId/subscribe
 * Subscribe to a free channel
 */
router.post("/channels/:channelId/subscribe", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { channelId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const result = await subscribeToFreeChannel(me.userId, channelId, orgId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Join the channel room for real-time updates
    const io = getSocketInstance();
    if (io) {
      // Note: User would need to emit 'feed:join-channel' to actually join the room
    }

    res.json(result);
  } catch (error) {
    console.error("Error subscribing to channel:", error);
    res.status(500).json({
      success: false,
      error: "Failed to subscribe to channel",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /feed/channels/:channelId/subscribe?orgId=<orgId>
 *
 * Unified cancel — the single cancel entry point for every channel type.
 * Same path/verb as the "leave community" call the mobile client already
 * uses; the service function branches on the channel's isFree /
 * isSubscription internally.
 *
 * Response payload: `{ success, status, accessUntil, message }` where
 * `status` is one of:
 *   - `cancelled_immediately`     free / one-time paid → membership
 *                                 flipped to inactive right away.
 *   - `cancelling_at_cycle_end`   recurring paid → membership stays
 *                                 active until nextPaymentDate, then a
 *                                 sweeper cron (index.ts) flips it to
 *                                 expired. Parent invoice's cancelledAt
 *                                 stamped so no future cycle spawns.
 *   - `already_inactive`          idempotent no-op — user was never
 *                                 subscribed or already left.
 *
 * `accessUntil` is a Date when access ends, or `null` if the user was
 * never active. Powers the FE "access until Jul 12" badge.
 */
router.delete("/channels/:channelId/subscribe", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { channelId } = req.params;
    // orgId is accepted for symmetry with the POST route + future
    // audit logging, but the unsubscribe service doesn't need it
    // (membership is uniquely keyed on userId + channelId).
    z.object({ orgId: z.string() }).parse(req.query);

    const result = await unsubscribeFromChannel(me.userId, channelId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Error unsubscribing from channel:", error);
    res.status(500).json({
      success: false,
      error: "Failed to unsubscribe from channel",
      details: (error as Error).message,
    });
  }
});

// ============= Paid Channel Subscription Endpoints =============

/**
 * POST /feed/channels/:channelId/create-order
 * Create Razorpay order for channel subscription (one-time payment)
 * For recurring subscriptions, use /create-subscription endpoint instead
 */
router.post(
  "/channels/:channelId/create-order",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { channelId } = req.params;
      const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

      // Bulk-buy-to-assign flow — founder pays for N seats up-front and
      // assigns each later via ReservesPanel. Fulfillment at
      // services/invoice.ts:2187-2211 keys off `quantity > 1` to mint
      // ItemReserveLicense rows instead of upserting membership for the buyer.
      const { quantity: rawQty, forReserve } = z
        .object({
          quantity: z.number().int().min(1).max(100).optional(),
          forReserve: z.boolean().optional(),
        })
        .parse(req.body || {});
      const quantity = Math.max(1, rawQty ?? 1);

      // Get channel details
      const channel = await Channel.findById(channelId).lean();
      if (!channel) {
        return res.status(404).json({
          success: false,
          error: "Channel not found",
        });
      }

      if (channel.isFree || channel.price === 0) {
        return res.status(400).json({
          success: false,
          error: "This is a free channel. Use /subscribe endpoint instead.",
        });
      }

      // If this is a subscription channel, redirect to subscription endpoint
      if (channel.isSubscription) {
        return res.status(400).json({
          success: false,
          error: "This is a subscription channel. Use /create-subscription endpoint instead.",
          isSubscription: true,
          subscriptionPeriod: channel.subscriptionPeriod,
        });
      }

      // Use discounted price if available
      const amount = channel.price;

      const order = await createChannelSubscriptionOrder(
        channelId,
        channel.title,
        amount * quantity,
        me.userId,
        orgId,
        channel.currency || "USD"
      );

      // Create invoice
      let invoiceId: string | undefined;
      try {
        const { createInvoice } = require("../services/invoice");
        // Pull `name` too so the invoice's Bill-To section shows the
        // buyer's actual name instead of the "Customer" placeholder the
        // FE falls back to when customerName is null. The other checkout
        // paths (courseCheckout/workshopCheckout/productCheckout/
        // channelCheckout) get `name` from the OTP form body; this
        // in-workspace path has no such body, so we read the User doc.
        const userDoc = await User.findById(me.userId)
          .select("email name")
          .lean();
        const invoice = await createInvoice({
          organizationId: orgId,
          sellerId: channel.createdBy,
          userId: me.userId,
          customerEmail: userDoc?.email || "",
          customerName: (userDoc as any)?.name || undefined,
          lineItems: [{
            itemType: "channel",
            itemId: channelId,
            itemName: channel.title,
            itemDescription: `Channel subscription: ${channel.title}`,
            quantity,
            unitPrice: Math.round(amount * 100),
            originalCurrency: channel.currency || "USD",
          }],
          itemCurrency: channel.currency || "USD",
          metadata: {
            type: "channel_purchase",
            ...(quantity > 1 || forReserve
              ? { forReserve: true, reserveCount: quantity }
              : {}),
          },
        });
        invoiceId = invoice._id.toString();
      } catch (invoiceError) {
        console.error("[Channel] Invoice creation error (non-blocking):", invoiceError);
      }

      res.json({
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        channel: {
          id: channelId,
          title: channel.title,
          price: channel.price,
        },
        invoiceId,
      });
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create order",
        details: (error as Error).message,
      });
    }
  }
);

/**
 * POST /feed/channels/:channelId/create-subscription
 * Create Razorpay subscription for recurring channel access
 */
router.post(
  "/channels/:channelId/create-subscription",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { channelId } = req.params;
      const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
      // Optional paymentSource (defaults to "web"). iOS app callers pass
      // "ios" so Apple's 30% is reflected at fulfillment.
      const { paymentSource } = z
        .object({
          paymentSource: z.enum(["web", "ios", "android"]).optional().default("web"),
        })
        .parse(req.body || {});

      // Get channel details
      const channel = await Channel.findById(channelId).lean();
      if (!channel) {
        return res.status(404).json({
          success: false,
          error: "Channel not found",
        });
      }

      if (channel.isFree || channel.price === 0) {
        return res.status(400).json({
          success: false,
          error: "This is a free channel. Use /subscribe endpoint instead.",
        });
      }

      if (!channel.isSubscription) {
        return res.status(400).json({
          success: false,
          error: "This is not a subscription channel. Use /create-order endpoint instead.",
        });
      }

      // ── Does the buyer already have access? ─────────────────────────
      // Two sources, because the two billing systems record it differently:
      //
      //   - ChannelMembership: what a PAID invoice materialises
      //     (services/invoice.ts fulfilment). This is the real answer under
      //     our invoice cascade, and it was missing here — a paying member
      //     could re-subscribe and start a duplicate billing chain, because
      //     the Razorpay-side check below never fires for invoice-billed
      //     subscriptions (their Subscription doc never leaves "created").
      //   - hasSubscriptionAccess: only meaningful if Razorpay subscriptions
      //     are ever switched on. Kept for that path.
      const activeMembership = await ChannelMembership.findOne({
        userId: new Types.ObjectId(me.userId),
        channelId: new Types.ObjectId(channelId),
        status: "active",
      }).lean();
      const existingAccess =
        !!activeMembership ||
        (await hasSubscriptionAccess(me.userId, "channel", channelId));
      if (existingAccess) {
        return res.status(400).json({
          success: false,
          error: "You already have an active subscription to this channel",
        });
      }

      // ── Tax-aware Razorpay plan amount ───────────────────────────────
      // IMPORTANT: this amount goes into a Razorpay PLAN, which is keyed on
      // (itemType, itemId) and shared by every subscriber — its amount is
      // frozen by whoever subscribes first. It therefore CANNOT carry the
      // buyer-location GST rule the rest of this file uses; doing so would
      // bake one buyer's region into everyone else's charge.
      //
      // So the plan amount stays on the item-level rule (INR ⇒ GST), while
      // the invoice below (which is per-buyer) uses the real buyer-location
      // rule. In practice this path is dormant — billing runs through our
      // own invoice cascade, not Razorpay subscriptions. If Razorpay
      // subscriptions are ever switched on, plans must be split per tax
      // region before this divergence becomes real.
      const {
        shouldApplyGstForChannel,
        calculateTaxAmounts,
      } = await import("../utils/gstTax");
      const listedPriceCents =
        (channel.price) * 100;
      const gstInclusive = !!(channel as any).gstInclusive;
      const planGstApplies =
        shouldApplyGstForChannel(channel as any) || gstInclusive === false;
      const razorpayChargeCents =
        planGstApplies && !gstInclusive
          ? calculateTaxAmounts(listedPriceCents).totalAmount
          : listedPriceCents;

      // Get or create subscription plan
      let plan = await getSubscriptionPlanForItem("channel", channelId);

      if (!plan) {
        // Auto-create plan if it doesn't exist
        plan = await createSubscriptionPlan({
          itemType: "channel",
          itemId: channelId,
          orgId,
          sellerId: channel.createdBy.toString(),
          name: `${channel.title} - ${channel.subscriptionPeriod || "monthly"} subscription`,
          description: channel.description || undefined,
          amount: razorpayChargeCents,
          currency: channel.currency || "USD",
          period: channel.subscriptionPeriod || "monthly",
          // Always taxInclusive when we send amounts to Razorpay — we want
          // them to charge exactly what we specified, regardless of whether
          // GST is rolled into the listed price or added on top.
          taxInclusive: true,
        });
      }

      if (!plan || !plan.isActive) {
        return res.status(400).json({
          success: false,
          error: "No active subscription plan available for this channel",
        });
      }

      // Stale `created` Subscription stubs from abandoned attempts are
      // superseded inside `createUserSubscription` — it cancels them for every
      // item type instead of the 10-minute, channel-only sweep that used to
      // live here (which left a window where a buyer who retried promptly was
      // told they were "already subscribed").

      // Create subscription for user
      const subscription = await createUserSubscription({
        planId: plan._id.toString(),
        userId: me.userId,
        orgId,
      });

      // Issue a GaragePay Invoice for the first billing cycle so the FE
      // can show PaymentMethodSelector inline instead of redirecting to
      // Razorpay's hosted page. Mirrors the invoice block used by
      // /create-order above. Non-blocking — if invoice creation fails,
      // the response omits `invoiceId` and the FE falls back to the
      // legacy `shortUrl` flow so a paying user is never stranded.
      let invoiceId: string | undefined;
      try {
        const { createInvoice } = require("../services/invoice");
        const {
          extractBaseFromTotal,
          calculateTaxAmounts: calcTax,
          extractAppleFeeFromTotal,
          shouldApplyAppleFee,
          GST_CONFIG,
          APPLE_FEE_RATE,
        } = await import("../utils/gstTax");
        // See note above at /create-order — read `name` too so the
        // subscription invoice's Bill-To shows the buyer's name instead
        // of the "Customer" fallback. Children created by the cron cascade
        // inherit this via services/invoice.ts:3201.
        const userDoc = await User.findById(me.userId)
          .select("email name")
          .lean();

        // Split the per-cycle amount into line-item subtotal + invoice-level
        // tax. Unlike the Razorpay plan above, the invoice is per-buyer, so
        // this uses the real buyer-location rule. Children generated by the
        // recurring cron inherit this tax + metadata verbatim, which means a
        // buyer keeps their cycle-1 GST treatment for the life of the
        // subscription.
        const { applyGstToLine } = await import("../utils/gstTax");
        const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
          "../utils/gstBuyerRegion"
        );
        const gstRegion = await resolveBuyerGstRegion({
          buyerUserId: me.userId,
          paymentCurrency: channel.currency || "USD",
        });
        const gstLine = applyGstToLine({
          listedAmountMinor: listedPriceCents,
          gstInclusive,
          buyerInIndia: gstRegion.inIndia,
        });
        const lineItemUnitPrice = gstLine.lineUnitPrice;
        const invoiceTaxCents = gstLine.taxTotal;
        const gstMetadata = gstLine.gstMetadata
          ? {
              ...gstLine.gstMetadata,
              buyerCountry: gstRegion.country,
              buyerRegion: "IN" as const,
              regionSource: gstRegion.source,
            }
          : undefined;
        const gstSkipped = gstLine.gstMetadata
          ? undefined
          : gstSkippedMetadata(gstRegion, "buyer_outside_india");

        // Apple iOS fee — infra-only until iOS payment source exists.
        let appleFeeMetadata: any = undefined;
        if (
          shouldApplyAppleFee(paymentSource) &&
          (channel as any).appleFeeInclusive
        ) {
          const { feeAmount } = extractAppleFeeFromTotal(lineItemUnitPrice);
          appleFeeMetadata = {
            rate: APPLE_FEE_RATE,
            amount: feeAmount,
            inclusive: true,
          };
        }

        // The previous attempt's unpaid invoice is handled by createInvoice
        // itself (services/invoice.ts) — it reuses a draft/pending invoice for
        // the same user+item when the total, currency, coupon and cashback all
        // still match, and cancels it as stale otherwise. So an abandoned
        // attempt neither strands a payable invoice at an old price nor mints
        // a duplicate on retry; nothing extra is needed here.
        const { createInvoice: _createInv, getNextChargeDate } = require(
          "../services/invoice"
        );
        const invoice = await _createInv({
          organizationId: orgId,
          sellerId: channel.createdBy,
          userId: me.userId,
          customerEmail: userDoc?.email || "",
          customerName: (userDoc as any)?.name || undefined,
          lineItems: [
            {
              itemType: "channel",
              itemId: channelId,
              itemName: channel.title,
              itemDescription: `Channel subscription: ${channel.title} (${plan.period})`,
              quantity: 1,
              unitPrice: lineItemUnitPrice,
              originalCurrency: channel.currency || "USD",
            },
          ],
          itemCurrency: channel.currency || "USD",
          isRecurring: true,
          recurringPeriod: plan.period as
            | "weekly"
            | "monthly"
            | "quarterly"
            | "yearly",
          tax: invoiceTaxCents || undefined,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          subscriptionRef: subscription._id.toString(),
          paymentSource,
          metadata: {
            type: "channel_subscription",
            // Marker the recurring cron reads to mirror the GST split on
            // each child cycle invoice.
            gstAppliedToEachCycle: !!gstMetadata,
            ...(gstMetadata ? { gst: gstMetadata } : {}),
            ...(gstSkipped ? { gstSkipped } : {}),
            ...(appleFeeMetadata ? { appleFee: appleFeeMetadata } : {}),
          },
        });

        // Mirror what routes/channelCheckout.ts does for recurring channel
        // invoices — set nextDueDate + recurringPaymentNumber so
        // `generateNextChildInvoice` has something to compute cycle 2 from.
        // Historical bug: this file omitted this block entirely, so every
        // paid channel_subscription invoice ended up with `nextDueDate:
        // undefined` and the cron couldn't chain off it (in addition to the
        // razorpaySubscriptionId issue also fixed on the cron side).
        invoice.nextDueDate = getNextChargeDate(new Date(), plan.period);
        invoice.recurringPaymentNumber = 1;
        await invoice.save();

        invoiceId = invoice._id.toString();
      } catch (invoiceError) {
        console.error(
          "[Channel] Subscription invoice creation error (non-blocking):",
          invoiceError
        );
      }

      res.json({
        success: true,
        subscription: {
          id: subscription._id,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          shortUrl: subscription.shortUrl,
          status: subscription.status,
        },
        plan: {
          id: plan._id,
          name: plan.name,
          amount: plan.amount,
          currency: plan.currency,
          period: plan.period,
        },
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        invoiceId,
      });
    } catch (error: any) {
      // Log the FULL object so backend logs always have the real reason,
      // even if we can't surface every shape to the FE.
      console.error("Error creating subscription:", error);

      // Razorpay's Node SDK throws plain objects shaped like
      //   { statusCode, error: { code, description, source, step, reason } }
      // — NOT Error instances. So `(error as Error).message` is undefined
      // and any naive catch silently falls back to a generic string. Walk
      // the most likely places where the real human-readable reason lives.
      const message: string =
        error?.error?.description ||                // Razorpay SDK rejection
        error?.error?.code ||                       // Razorpay code-only fallback
        (typeof error?.message === "string" && error.message) ||
        (typeof error === "string" && error) ||
        "Failed to create subscription";

      const isUserError =
        /already has an active subscription|already have|plan is not active|plan not found|not active|minimum amount|amount.*too|international.*not enabled/i.test(
          message
        );

      res.status(isUserError ? 400 : 500).json({
        success: false,
        error: message,
        details: message,
        // Razorpay context for the FE devtools (won't be shown to users —
        // ChannelPaymentModal only reads `error`).
        razorpay:
          error?.statusCode || error?.error
            ? {
              statusCode: error?.statusCode,
              code: error?.error?.code,
              description: error?.error?.description,
            }
            : undefined,
      });
    }
  }
);

/**
 * GET /feed/channels/:channelId/subscription-status
 * Check user's subscription status for a channel
 */
router.get(
  "/channels/:channelId/subscription-status",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { channelId } = req.params;

      // Check subscription access
      const hasAccess = await hasSubscriptionAccess(me.userId, "channel", channelId);
      const activeSubscription = await getUserActiveSubscription(me.userId, "channel", channelId);

      // Also check channel membership (for one-time purchases)
      const membership = await ChannelMembership.findOne({
        userId: me.userId,
        channelId,
        status: "active",
      }).lean();

      res.json({
        success: true,
        hasAccess: hasAccess || !!membership,
        subscription: activeSubscription ? {
          id: activeSubscription._id,
          status: activeSubscription.status,
          currentEnd: activeSubscription.currentEnd,
          paidCount: activeSubscription.paidCount,
        } : null,
        membership: membership ? {
          status: membership.status,
          joinedAt: membership.joinedAt,
        } : null,
      });
    } catch (error) {
      console.error("Error checking subscription status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check subscription status",
      });
    }
  }
);

/**
 * POST /feed/channels/:channelId/verify-payment
 * Verify payment and complete subscription
 */
router.post(
  "/channels/:channelId/verify-payment",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { channelId } = req.params;
      const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

      const schema = z.object({
        razorpayOrderId: z.string(),
        razorpayPaymentId: z.string(),
        razorpaySignature: z.string(),
      });
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
        schema.parse(req.body);

      // Verify signature
      const isValid = verifyPaymentSignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: "Payment verification failed",
        });
      }

      // Get channel to determine the payment amount
      const channel = await Channel.findById(channelId).lean();
      if (!channel) {
        return res.status(404).json({
          success: false,
          error: "Channel not found",
        });
      }

      // Use discounted price if available, otherwise regular price
      const amount = channel.price;

      // Complete subscription and credit founder's wallet
      const result = await subscribeToPaidChannel(me.userId, channelId, orgId, {
        razorpayPaymentId,
        razorpayOrderId,
        amount,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Distribute commissions if amount > 0
      if (amount && amount > 0) {
        try {
          await distributeCommissions({
            orgId,
            sellerId: channel.createdBy.toString(),
            customerId: me.userId,
            itemType: "channel",
            itemId: channelId,
            itemName: channel.title,
            saleAmount: amount,
            currency: channel.currency || "USD",
            paymentId: razorpayPaymentId,
            isRecurringPayment: channel.isSubscription || false,
          });
        } catch (commissionError) {
          // Log but don't fail the subscription
          console.error("Error distributing commissions:", commissionError);
        }
      }

      res.json({
        success: true,
        message: "Payment verified and subscription activated",
      });
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(500).json({
        success: false,
        error: "Failed to verify payment",
        details: (error as Error).message,
      });
    }
  }
);

// ============= Channel Management (Founder Only) =============

/**
 * POST /feed/channels
 * Create a new channel (founder only)
 */
router.post("/channels", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can create channels",
      });
    }

    const schema = z.object({
      title: z.string().min(1).max(100),
      // 5000 chars — the frontend Description field is a RichTextEditor
      // that emits HTML, and tags inflate the string length far past
      // the visible text. 5000 gives enough room for rich formatting
      // while still preventing abuse.
      description: z.string().max(5000).optional(),
      price: z.number().min(0).default(0),
      currency: z.string().default("USD"),
      coverImage: z.string().optional(),
      galleryImages: z.array(z.string()).optional(),
      videoUrl: z.string().optional(),
      videoFile: z.string().optional(),
      whoCanPost: z.enum(["everyone", "admins_only"]).optional(),
      gstInclusive: z.boolean().optional(),
      requireIosPayment: z.boolean().optional(),
      appleFeeInclusive: z.boolean().optional(),
      isFree: z.boolean().default(true),
      isSubscription: z.boolean().default(false),
      subscriptionPeriod: z
        .enum(["weekly", "monthly", "quarterly", "yearly"])
        .optional(),
      // Channel detail page fields
      rating: z.number().min(0).max(5).optional(),
      ratingCount: z.number().min(0).optional(),
      aboutText: z.string().max(5000).optional(),
      whatsIncluded: z.array(z.string()).optional(),
      benefits: z
        .array(
          z.object({
            icon: z.string(),
            title: z.string(),
            description: z.string(),
          })
        )
        .optional(),
      reviews: z
        .array(
          z.object({
            reviewerName: z.string(),
            reviewerRole: z.string().optional(),
            reviewerAvatar: z.string().optional(),
            rating: z.number().min(1).max(5),
            text: z.string(),
            helpfulCount: z.number().optional(),
          })
        )
        .optional(),
      faqs: z
        .array(
          z.object({
            question: z.string(),
            answer: z.string(),
          })
        )
        .optional(),
      // Default community flag
      isDefault: z.boolean().optional(),
      // Zod STRIPS unknown keys, so omitting this would silently drop the
      // founder's toggle with no error anywhere.
      mandatoryOnJoin: z.boolean().optional(),
      // Post-purchase order email — the founder's Network Mail template,
      // snapshotted by the form. Same contract as products and courses.
      emailAlerts: emailAlertsZodSchema.optional(),
      // "Notify me when someone joins" — the founder's own alert, separate
      // from the buyer's order email above.
      founderAlerts: founderAlertsZodSchema.optional(),
      // Founder-configurable post-payment page. Same normaliser
      // (services/thankYouPage.ts) products + courses use — undefined =
      // leave unchanged, null = clear (no-op on create), object =
      // validated write. Deep validation throws → mapped to 400 below.
      thankYouPage: thankYouPageZodSchema.optional(),
    });

    const data = schema.parse(req.body);

    // If price > 0, it's not free
    if (data.price > 0) {
      data.isFree = false;
    }

    // Extract isDefault before creating (handle separately)
    const wantsDefault = data.isDefault || false;
    const wantsMandatory = (data as any).mandatoryOnJoin || false;
    const {
      isDefault: _isDefault,
      mandatoryOnJoin: _mandatoryOnJoin,
      emailAlerts,
      founderAlerts,
      thankYouPage,
      ...channelData
    } = data;

    const normalisedTy =
      thankYouPage !== undefined
        ? normalizeThankYouPage(thankYouPage)
        : undefined;

    const channel = await Channel.create({
      ...channelData,
      ...(emailAlerts ? { emailAlerts: normalizeEmailAlerts(emailAlerts) } : {}),
      ...(founderAlerts
        ? { founderAlerts: normalizeFounderAlerts(founderAlerts) }
        : {}),
      ...(normalisedTy ? { thankYouPage: normalisedTy } : {}),
      storeId: orgId,
      createdBy: me.userId,
      isActive: true,
    });

    // If founder wants this as default, set it (only free channels allowed)
    if (wantsDefault) {
      const result = await setDefaultChannel(channel._id.toString(), orgId);
      if (!result.success) {
        console.warn(`[Channel] Could not set as default: ${result.error}`);
      }
    }

    // Mandatory-on-join. Also free-only, but unlike the default there can be
    // any number of them. Routed through the service so the price check lives
    // in exactly one place.
    if (wantsMandatory) {
      const result = await setChannelMandatory(
        channel._id.toString(),
        orgId,
        true
      );
      if (!result.success) {
        console.warn(`[Channel] Could not set mandatory: ${result.error}`);
      }
    }

    // Notify org members about the new channel. Scoped to this office so
    // members of unrelated orgs aren't spammed.
    {
      const org = await Organization.findById(orgId).select("name").lean();
      notifyNewChannelCreated(
        {
          _id: channel._id.toString(),
          name: channel.title,
          price: channel.price,
          currency: channel.currency,
          description: channel.description || undefined,
          coverImage: channel.coverImage || undefined,
        },
        (org as any)?.name || "an organization",
        orgId
      );
    }

    // Auto-create subscription plan if isSubscription is true and has price
    let subscriptionPlan = null;
    if (data.isSubscription && data.price > 0 && data.subscriptionPeriod) {
      try {
        subscriptionPlan = await createSubscriptionPlan({
          itemType: "channel",
          itemId: channel._id.toString(),
          orgId,
          sellerId: me.userId,
          name: `${data.title} - ${data.subscriptionPeriod} subscription`,
          description: data.description || undefined,
          amount: (data.price) * 100,
          currency: data.currency || "USD",
          period: data.subscriptionPeriod,
        });
        console.log(`[Channel] Auto-created subscription plan for channel ${channel._id}`);
      } catch (planError) {
        console.error("[Channel] Failed to auto-create subscription plan:", planError);
        // Don't fail channel creation if plan creation fails
      }
    }

    res.status(201).json({
      success: true,
      message: "Channel created successfully",
      channel,
      subscriptionPlan: subscriptionPlan ? {
        id: subscriptionPlan._id,
        razorpayPlanId: subscriptionPlan.razorpayPlanId,
      } : null,
    });
  } catch (error: any) {
    console.error("Error creating channel:", error);

    // Surface Zod validation errors as 400 with human-readable details
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((e) => {
        const field = e.path.join(".");
        return `${field}: ${e.message}`;
      });
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${fieldErrors.join("; ")}`,
        details: (error as Error).message,
      });
    }
    // Deep-validation throws from normalizeThankYouPage — mirror the 400
    // mapping products/courses use so the founder sees the actual reason.
    const msg = String(error?.message || "");
    if (/URL|thank-you|Section|required/i.test(msg)) {
      return res.status(400).json({ success: false, error: msg });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create channel",
      details: (error as Error).message,
    });
  }
});

/**
 * PUT /feed/channels/:channelId
 * Update a channel (founder only)
 */
router.put("/channels/:channelId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { channelId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can update channels",
      });
    }

    const schema = z.object({
      title: z.string().min(1).max(100).optional(),
      // 5000 chars — the frontend Description field is a RichTextEditor
      // that emits HTML, and tags inflate the string length far past
      // the visible text. 5000 gives enough room for rich formatting
      // while still preventing abuse.
      description: z.string().max(5000).optional(),
      price: z.number().min(0).optional(),
      currency: z.string().optional(),
      coverImage: z.string().optional(),
      galleryImages: z.array(z.string()).optional().nullable(),
      videoUrl: z.string().optional().nullable(),
      videoFile: z.string().optional().nullable(),
      whoCanPost: z.enum(["everyone", "admins_only"]).optional().nullable(),
      gstInclusive: z.boolean().optional(),
      requireIosPayment: z.boolean().optional(),
      appleFeeInclusive: z.boolean().optional(),
      isFree: z.boolean().optional(),
      isActive: z.boolean().optional(),
      isSubscription: z.boolean().optional(),
      subscriptionPeriod: z
        .enum(["weekly", "monthly", "quarterly", "yearly"])
        .optional()
        .nullable(),
      // Channel detail page fields
      rating: z.number().min(0).max(5).optional().nullable(),
      ratingCount: z.number().min(0).optional().nullable(),
      aboutText: z.string().max(5000).optional().nullable(),
      whatsIncluded: z.array(z.string()).optional().nullable(),
      benefits: z
        .array(
          z.object({
            icon: z.string(),
            title: z.string(),
            description: z.string(),
          })
        )
        .optional()
        .nullable(),
      reviews: z
        .array(
          z.object({
            reviewerName: z.string(),
            reviewerRole: z.string().optional(),
            reviewerAvatar: z.string().optional(),
            rating: z.number().min(1).max(5),
            text: z.string(),
            helpfulCount: z.number().optional(),
          })
        )
        .optional()
        .nullable(),
      faqs: z
        .array(
          z.object({
            question: z.string(),
            answer: z.string(),
          })
        )
        .optional()
        .nullable(),
      // Default community flag
      isDefault: z.boolean().optional(),
      // Zod STRIPS unknown keys, so omitting this would silently drop the
      // founder's toggle with no error anywhere.
      mandatoryOnJoin: z.boolean().optional(),
      // Post-purchase order email — see the create route above.
      emailAlerts: emailAlertsZodSchema.optional(),
      // "Notify me when someone joins" — see the create route above.
      founderAlerts: founderAlertsZodSchema.optional(),
      // Post-purchase page — tri-state (undefined leave / null clear /
      // object write). Deep validation via normalizeThankYouPage below.
      thankYouPage: thankYouPageZodSchema.optional(),
    });

    const data = schema.parse(req.body);

    // If price > 0, it's not free
    if (data.price !== undefined && data.price > 0) {
      data.isFree = false;
    } else if (data.price === 0) {
      data.isFree = true;
    }

    // Handle isDefault separately from normal update
    const wantsDefault = data.isDefault;
    const wantsMandatory = (data as any).mandatoryOnJoin;
    const {
      isDefault: _isDefault,
      mandatoryOnJoin: _mandatoryOnJoin,
      emailAlerts,
      founderAlerts,
      thankYouPage,
      ...rest
    } = data;
    const normalisedTy =
      thankYouPage !== undefined
        ? normalizeThankYouPage(thankYouPage)
        : undefined;
    const updateData: any = {
      ...rest,
      ...(emailAlerts ? { emailAlerts: normalizeEmailAlerts(emailAlerts) } : {}),
      ...(founderAlerts
        ? { founderAlerts: normalizeFounderAlerts(founderAlerts) }
        : {}),
      // Only write the field when the caller actually sent something.
      // Object → set; null (translated by normaliser to null) → $unset.
      ...(normalisedTy !== undefined && normalisedTy !== null
        ? { thankYouPage: normalisedTy }
        : {}),
    };

    // Explicit clear: normaliser returns null when the caller passed null.
    const channel = await Channel.findOneAndUpdate(
      { _id: channelId, storeId: orgId },
      normalisedTy === null
        ? { $set: updateData, $unset: { thankYouPage: "" } }
        : { $set: updateData },
      { new: true }
    );

    // Handle default community toggle
    if (channel && wantsDefault === true) {
      const result = await setDefaultChannel(channelId, orgId);
      if (!result.success) {
        console.warn(`[Channel] Could not set as default: ${result.error}`);
      }
    } else if (channel && wantsDefault === false) {
      // Only unset if this channel was actually the default
      if ((channel as any).isDefault) {
        await clearDefaultChannel(orgId);
      }
    }

    // Mandatory-on-join toggle
    let mandatoryError: string | undefined;
    if (channel && wantsMandatory === true) {
      const result = await setChannelMandatory(channelId, orgId, true);
      if (!result.success) mandatoryError = result.error;
    } else if (channel && wantsMandatory === false) {
      await setChannelMandatory(channelId, orgId, false);
    }

    // Pricing wins over the mandate. If this update made the community paid,
    // clear the flag rather than leaving new members auto-enrolled into
    // something they should have bought. Reported back so the founder learns
    // why their toggle turned itself off instead of finding out later.
    const mandateClearedByPricing = channel
      ? await clearMandatoryIfPaid(channelId)
      : false;

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: "Channel not found",
      });
    }

    res.json({
      success: true,
      message: "Channel updated successfully",
      // Re-read so the response reflects mandatoryOnJoin after the service
      // calls above — `channel` was fetched before them and would report a
      // stale toggle, which the FE then renders.
      channel: await Channel.findById(channelId).lean(),
      // The founder's toggle can turn itself off: pricing a mandated community
      // clears it. Surfaced so the UI can say why instead of the founder
      // noticing later that it silently flipped.
      ...(mandateClearedByPricing
        ? {
            mandateCleared:
              "Mandatory join was turned off because this community is no longer free",
          }
        : {}),
      ...(mandatoryError ? { mandatoryError } : {}),
    });
  } catch (error: any) {
    console.error("Error updating channel:", error);

    // Surface Zod validation errors as 400 with human-readable details
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((e) => {
        const field = e.path.join(".");
        return `${field}: ${e.message}`;
      });
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${fieldErrors.join("; ")}`,
        details: (error as Error).message,
      });
    }
    // Deep-validation throws from normalizeThankYouPage — 400 with the
    // actual reason instead of the generic 500.
    const msg = String(error?.message || "");
    if (/URL|thank-you|Section|required/i.test(msg)) {
      return res.status(400).json({ success: false, error: msg });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update channel",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /feed/channels/:channelId
 * Delete a channel (founder only) - soft delete
 */
router.delete("/channels/:channelId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { channelId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can delete channels",
      });
    }

    const channel = await Channel.findOneAndUpdate(
      { _id: channelId, storeId: orgId },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: "Channel not found",
      });
    }

    res.json({
      success: true,
      message: "Channel deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting channel:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete channel",
      details: (error as Error).message,
    });
  }
});

/**
 * PUT /feed/channels/:channelId/set-default
 * Set or unset a channel as the default community (founder only)
 * New members who join the org will automatically be added to the default community
 */
router.put("/channels/:channelId/set-default", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { channelId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can set the default community",
      });
    }

    const { isDefault } = z.object({ isDefault: z.boolean() }).parse(req.body);

    if (isDefault) {
      const result = await setDefaultChannel(channelId, orgId);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
      res.json({
        success: true,
        message: "Channel set as default community",
      });
    } else {
      await clearDefaultChannel(orgId);
      res.json({
        success: true,
        message: "Default community cleared",
      });
    }
  } catch (error) {
    console.error("Error setting default channel:", error);
    res.status(500).json({
      success: false,
      error: "Failed to set default channel",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/channels/:channelId
 * Get a single channel with subscriber count
 */
router.get("/channels/:channelId", requireAuth, async (req, res, next) => {
  try {
    const { channelId } = req.params;
    // Express matches routes in registration order — this parametric
    // route sits ABOVE the more specific /channels/analytics and
    // /channels/invoices below. Falling through on non-ObjectId values
    // lets those specific string routes still be reachable without
    // moving huge blocks of registration around. Any real channel
    // request has an ObjectId here; anything else (reserved keywords,
    // typos) should either 404 downstream or hit a specific route.
    if (!Types.ObjectId.isValid(channelId)) {
      return next();
    }
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const channel = await Channel.findOne({
      _id: channelId,
      storeId: orgId,
    }).lean();

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: "Channel not found",
      });
    }

    // Get subscriber count
    const subscriberCount = await ChannelMembership.countDocuments({
      channelId,
      status: "active",
    });

    res.json({
      success: true,
      channel: {
        ...channel,
        subscriberCount,
      },
    });
  } catch (error) {
    console.error("Error getting channel:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get channel",
      details: (error as Error).message,
    });
  }
});

// ============= Customers/Subscribers Management (Founder Only) =============

/**
 * GET /feed/customers
 * Get all customers (subscribers) for an organization
 */
router.get("/customers", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      channelId: z.string().optional(),
      status: z.enum(["active", "inactive", "all"]).optional(),
      limit: z.coerce.number().min(1).max(100).optional(),
      offset: z.coerce.number().min(0).optional(),
    });
    const {
      orgId,
      channelId,
      status,
      limit = 50,
      offset = 0,
    } = schema.parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can view customers",
      });
    }

    // Get all founder IDs for this org to exclude them from customers
    const founders = await User.find({
      $or: [
        // Legacy single org
        { organization: orgId, role: { $in: ["founder", "admin"] } },
        // New multi-org
        {
          "organizations.organization": orgId,
          "organizations.role": "founder",
        },
      ],
    })
      .select("_id")
      .lean();
    const founderIds = new Set(founders.map((f) => f._id.toString()));

    // Build filter
    const filter: any = { orgId };
    if (channelId) {
      filter.channelId = channelId;
    }
    if (status && status !== "all") {
      filter.status = status;
    }

    // Get memberships with user and channel details
    const [memberships, total] = await Promise.all([
      ChannelMembership.find(filter)
        .populate("userId", "name email profilePicture")
        .populate("channelId", "title price isFree isSubscription")
        .sort({ joinedAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      ChannelMembership.countDocuments(filter),
    ]);

    // Group by user for better display
    const customersMap = new Map<
      string,
      {
        user: any;
        subscriptions: any[];
        totalSpent: number;
        joinedAt: Date;
      }
    >();

    for (const m of memberships) {
      if (!m.userId) continue;

      const userId = (m.userId as any)._id.toString();

      // Skip founders - they shouldn't appear as customers
      if (founderIds.has(userId)) continue;

      if (!customersMap.has(userId)) {
        customersMap.set(userId, {
          user: m.userId,
          subscriptions: [],
          totalSpent: 0,
          joinedAt: m.joinedAt || m.createdAt,
        });
      }

      const customer = customersMap.get(userId)!;
      const channel = m.channelId as any;

      customer.subscriptions.push({
        channelId: channel?._id,
        channelTitle: channel?.title,
        price: channel?.price || 0,
        isFree: channel?.isFree,
        isSubscription: channel?.isSubscription,
        status: m.status,
        joinedAt: m.joinedAt,
        lastPaymentDate: m.lastPaymentDate,
        nextPaymentDate: m.nextPaymentDate,
        subscriptionStatus: m.subscriptionStatus,
      });

      // Calculate total spent (only for paid channels)
      if (!channel?.isFree && channel?.price > 0) {
        customer.totalSpent += channel.price;
      }
    }

    const customers = Array.from(customersMap.values());

    res.json({
      success: true,
      customers,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + memberships.length < total,
      },
    });
  } catch (error) {
    console.error("Error getting customers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get customers",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/channels/:channelId/subscribers
 * Get subscribers for a specific channel
 * Founders can view all channel subscribers
 * Non-founders can view subscribers if they are subscribed to the channel
 */
router.get(
  "/channels/:channelId/subscribers",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { channelId } = req.params;
      const schema = z.object({
        orgId: z.string(),
        limit: z.coerce.number().min(1).max(100).optional(),
        offset: z.coerce.number().min(0).optional(),
        // Bucket filter — matches the FE filter chips.
        //   active     healthy paying member (or free)
        //   cancelling cancelled this cycle, still has access
        //   expired    inactive (post-sweeper OR instant unsub)
        //   all        no filter — default for the founder view
        membershipFilter: z
          .enum(["active", "cancelling", "expired", "all"])
          .optional(),
        // Server-side search on populated user name/email so filtering
        // + paginating stay consistent (previously the FE did this on the
        // sliced page, which meant "search" only saw the current page).
        search: z.string().optional(),
      });
      const {
        orgId,
        limit = 50,
        offset = 0,
        membershipFilter = "active",
        search,
      } = schema.parse(req.query);

      // Channel subscribers are visible to any authenticated user. Was
      // previously gated to active ChannelMembership rows, which worked
      // for founders but broke for regular members whose membership lived
      // in a different model (legacy joins) or never had status='active'
      // set — the Members drawer rendered empty for them. Subscriber lists
      // aren't sensitive: this is the same data the channel already
      // publishes to anyone who can read its feed.

      // Verify channel belongs to org
      const channel = await Channel.findOne({
        _id: channelId,
        storeId: orgId,
      }).lean();

      if (!channel) {
        return res.status(404).json({
          success: false,
          error: "Channel not found",
        });
      }

      // Build the membership query based on the filter bucket.
      // `subscriptionStatus: null` cases treated as "active" — legacy
      // memberships that never got the new field stamped.
      const membershipQuery: Record<string, any> = { channelId };
      if (membershipFilter === "active") {
        membershipQuery.status = "active";
        membershipQuery.$or = [
          { subscriptionStatus: "active" },
          { subscriptionStatus: null },
          { subscriptionStatus: { $exists: false } },
        ];
      } else if (membershipFilter === "cancelling") {
        membershipQuery.status = "active";
        membershipQuery.subscriptionStatus = "cancelled";
      } else if (membershipFilter === "expired") {
        membershipQuery.status = { $in: ["inactive", "suspended"] };
      }
      // "all" → no additional filter beyond channelId

      // Search — apply against populated user's name/email. We resolve
      // matching users first, then narrow the membership query. Cheap
      // because user is indexed on email and we're only searching one
      // org's roster (users linked via memberships already exist).
      if (search && search.trim()) {
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rx = new RegExp(escaped, "i");
        const { User: UserModel } = await import("../models/user.model");
        const matchedUsers = await UserModel.find({
          $or: [{ name: rx }, { email: rx }, { phone: rx }],
        })
          .select("_id")
          .lean();
        membershipQuery.userId = { $in: matchedUsers.map((u: any) => u._id) };
      }

      const [subscribers, total] = await Promise.all([
        ChannelMembership.find(membershipQuery)
          .populate("userId", "name email profilePicture")
          .sort({ joinedAt: -1 })
          .skip(offset)
          .limit(limit)
          .lean(),
        ChannelMembership.countDocuments(membershipQuery),
      ]);

      // Bucket counts across the WHOLE channel roster so the FE filter
      // chips can render "Active 12 · Cancelling 3 · Expired 8" without
      // three additional round-trips. Cheap — same collection, one agg.
      const bucketAgg = await ChannelMembership.aggregate([
        { $match: { channelId: new Types.ObjectId(channelId) } },
        {
          $group: {
            _id: null,
            active: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "active"] },
                      {
                        $or: [
                          { $eq: ["$subscriptionStatus", "active"] },
                          { $eq: ["$subscriptionStatus", null] },
                          { $not: ["$subscriptionStatus"] },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            cancelling: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "active"] },
                      { $eq: ["$subscriptionStatus", "cancelled"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            expired: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["inactive", "suspended"]] },
                  1,
                  0,
                ],
              },
            },
            all: { $sum: 1 },
          },
        },
      ]);
      const bucketCounts = bucketAgg[0] || {
        active: 0,
        cancelling: 0,
        expired: 0,
        all: 0,
      };
      delete (bucketCounts as any)._id;

      // Lifetime value per subscriber — sum of paid invoices for
      // (userId, channelId), grouped by currency so each bucket can be
      // converted to USD once. `totalPrice` on lineItems is in cents/
      // paise ([invoice.model.ts:113]).
      const subscriberUserIds = subscribers
        .map((s: any) => s.userId?._id)
        .filter(Boolean);
      const ltvUsdByUser = new Map<string, number>();
      if (subscriberUserIds.length > 0) {
        const { Invoice: InvoiceModel } = await import(
          "../models/invoice.model"
        );
        const ltvAgg = await InvoiceModel.aggregate([
          {
            $match: {
              userId: { $in: subscriberUserIds },
              organizationId: new Types.ObjectId(orgId),
              status: "paid",
            },
          },
          { $unwind: "$lineItems" },
          {
            $match: {
              "lineItems.itemType": "channel",
              "lineItems.itemId": new Types.ObjectId(channelId),
            },
          },
          {
            $group: {
              _id: {
                userId: "$userId",
                currency: {
                  $ifNull: ["$lineItems.originalCurrency", "$itemCurrency"],
                },
              },
              totalMinor: { $sum: "$lineItems.totalPrice" },
            },
          },
        ]);
        for (const bucket of ltvAgg) {
          const uid = bucket._id.userId.toString();
          const currency = bucket._id.currency || "USD";
          const native = (bucket.totalMinor || 0) / 100;
          if (native <= 0) continue;
          const { usdAmount } = await convertToUsd(native, currency);
          ltvUsdByUser.set(uid, (ltvUsdByUser.get(uid) || 0) + usdAmount);
        }
      }

      res.json({
        success: true,
        channel: {
          _id: channel._id,
          title: channel.title,
          price: channel.price,
          isFree: channel.isFree,
          currency: (channel as any).currency || "USD",
          isSubscription: (channel as any).isSubscription || false,
          subscriptionPeriod: (channel as any).subscriptionPeriod || null,
        },
        counts: bucketCounts,
        subscribers: subscribers.map((s) => {
          const uid = (s.userId as any)?._id?.toString?.() ?? null;
          const ltvUsd = uid ? ltvUsdByUser.get(uid) || 0 : 0;
          return {
            user: s.userId,
            joinedAt: s.joinedAt,
            status: s.status,
            canPost: (s as any).canPost !== false,
            lastPaymentDate: s.lastPaymentDate,
            nextPaymentDate: s.nextPaymentDate,
            subscriptionStatus: s.subscriptionStatus,
            cancelledAt: (s as any).cancelledAt || null,
            lifetimeValueUsd: Math.round(ltvUsd * 100) / 100,
          };
        }),
        total,
        pagination: {
          limit,
          offset,
          hasMore: offset + subscribers.length < total,
        },
      });
    } catch (error) {
      console.error("Error getting channel subscribers:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get subscribers",
        details: (error as Error).message,
      });
    }
  }
);

/**
 * PUT /feed/channels/:channelId/members/:userId/posting
 * Toggle a user's posting permission in a channel (founder only)
 */
router.put(
  "/channels/:channelId/members/:userId/posting",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { channelId, userId } = req.params;
      const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
      const { canPost } = z.object({ canPost: z.boolean() }).parse(req.body);

      // Only founders can manage posting permissions
      const isFounder = await isUserFounder(me.userId, orgId);
      if (!isFounder) {
        return res.status(403).json({
          success: false,
          error: "Only founders can manage posting permissions",
        });
      }

      // Verify channel belongs to org
      const channel = await Channel.findOne({
        _id: channelId,
        storeId: orgId,
      }).lean();
      if (!channel) {
        return res.status(404).json({
          success: false,
          error: "Channel not found",
        });
      }

      // Update the membership
      const membership = await ChannelMembership.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          channelId: new Types.ObjectId(channelId),
          status: "active",
        },
        { $set: { canPost } },
        { new: true }
      );

      if (!membership) {
        return res.status(404).json({
          success: false,
          error: "User is not a member of this channel",
        });
      }

      res.json({
        success: true,
        message: canPost
          ? "User can now post in this community"
          : "User has been muted in this community",
        canPost,
      });
    } catch (error) {
      console.error("Error toggling posting permission:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update posting permission",
        details: (error as Error).message,
      });
    }
  }
);
/**
 * GET /feed/stats
 * Get feed statistics for founders
 */
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can view stats",
      });
    }

    // Get all founder IDs for this org to exclude them from subscriber count
    const founders = await User.find({
      $or: [
        { organization: orgId, role: { $in: ["founder", "admin"] } },
        {
          "organizations.organization": orgId,
          "organizations.role": "founder",
        },
      ],
    })
      .select("_id")
      .lean();
    const founderIds = founders.map((f) => f._id);

    const [totalChannels, activeChannels, totalSubscribers, totalPosts] =
      await Promise.all([
        Channel.countDocuments({ storeId: orgId }),
        Channel.countDocuments({ storeId: orgId, isActive: true }),
        ChannelMembership.countDocuments({
          orgId,
          status: "active",
          userId: { $nin: founderIds },
        }),
        (
          await import("../models/post.model")
        ).Post.countDocuments({
          orgId,
          isActive: true,
        }),
      ]);

    // Get revenue from paid subscriptions, grouped by currency for proper USD conversion
    const revenueAggregation = await ChannelMembership.aggregate([
      {
        $match: {
          orgId: new (await import("mongoose")).Types.ObjectId(orgId),
          status: "active",
        },
      },
      {
        $lookup: {
          from: "channels",
          localField: "channelId",
          foreignField: "_id",
          as: "channel",
        },
      },
      { $unwind: "$channel" },
      { $match: { "channel.isFree": false } },
      {
        $group: {
          _id: { $ifNull: ["$channel.currency", "USD"] },
          total: {
            $sum: "$channel.price",
          },
        },
      },
    ]);

    // Convert each currency group to USD and sum
    let totalRevenueUsd = 0;
    for (const bucket of revenueAggregation) {
      const currency = bucket._id || "USD";
      const amount = bucket.total || 0;
      if (amount <= 0) continue;
      const { usdAmount } = await convertToUsd(amount, currency);
      totalRevenueUsd += usdAmount;
    }
    totalRevenueUsd = Math.round(totalRevenueUsd * 100) / 100;

    res.json({
      success: true,
      stats: {
        totalChannels,
        activeChannels,
        totalSubscribers,
        totalPosts,
        totalRevenueUsd,
      },
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get stats",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/channels/analytics?orgId=<id>
 *
 * Per-channel analytics that powers the founder-facing Communities view in
 * ChannelsPage.tsx: real member counts, USD-normalised historical revenue
 * (from paid Invoice lineItems), MRR from active members, and the
 * highest-referred channel from AffiliateConversion.
 *
 * Replaces the current pseudo-random `activeMembers` and the naive
 * `memberCount × price` revenue math the FE was computing. Free channels
 * and one-time channels are handled explicitly (MRR = null for one-time,
 * 0 for free).
 *
 * Mirrors GET /feed/stats above for auth (founder-only) and reuses the
 * same convertToUsd helper for mixed-currency roll-ups.
 */
router.get("/channels/analytics", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res
        .status(403)
        .json({ success: false, error: "Only founders can view analytics" });
    }

    const orgObjectId = new Types.ObjectId(orgId);

    // 1. All channels for the org — the base set we roll up against.
    const channels = await Channel.find({ storeId: orgObjectId })
      .select(
        "title coverImage price currency isSubscription subscriptionPeriod isActive isFree isDefault createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    const channelIds = channels.map((c: any) => c._id);
    const channelIdStrings = channelIds.map((id: any) => id.toString());

    // 2. Member counts (total + active + cancelling) per channel — one
    // aggregation, three conditional sums.
    //   activeMembers    = status:"active" AND (subscriptionStatus:"active"
    //                      OR null) — healthy paying members. Feeds MRR.
    //   cancellingMembers = status:"active" AND subscriptionStatus:
    //                      "cancelled" — the "unsubscribed but still
    //                      active this cycle" batch. Excluded from MRR
    //                      because their next invoice was cancelled.
    //   totalMembers      = all rows regardless of status.
    const memberAgg = await ChannelMembership.aggregate([
      { $match: { orgId: orgObjectId, channelId: { $in: channelIds } } },
      {
        $group: {
          _id: "$channelId",
          totalMembers: { $sum: 1 },
          activeMembers: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "active"] },
                    {
                      $or: [
                        { $eq: ["$subscriptionStatus", "active"] },
                        { $eq: ["$subscriptionStatus", null] },
                        { $not: ["$subscriptionStatus"] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          cancellingMembers: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "active"] },
                    { $eq: ["$subscriptionStatus", "cancelled"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const memberByChannel = new Map<
      string,
      {
        totalMembers: number;
        activeMembers: number;
        cancellingMembers: number;
      }
    >();
    for (const row of memberAgg) {
      memberByChannel.set(row._id.toString(), {
        totalMembers: row.totalMembers || 0,
        activeMembers: row.activeMembers || 0,
        cancellingMembers: row.cancellingMembers || 0,
      });
    }

    // 3. Historical revenue per channel — sum paid Invoice line items,
    // grouped by (channelId, currency) so we can convert each currency
    // bucket to USD via convertToUsd. Amounts on lineItems.totalPrice are
    // in cents/paise (invoice.model.ts:113 comment).
    const revenueAgg = await Invoice.aggregate([
      {
        $match: {
          organizationId: orgObjectId,
          status: "paid",
        },
      },
      { $unwind: "$lineItems" },
      {
        $match: {
          "lineItems.itemType": "channel",
          "lineItems.itemId": { $in: channelIds },
        },
      },
      {
        $group: {
          _id: {
            channelId: "$lineItems.itemId",
            currency: {
              $ifNull: ["$lineItems.originalCurrency", "$itemCurrency"],
            },
          },
          totalMinor: { $sum: "$lineItems.totalPrice" },
        },
      },
    ]);

    // Convert each (channel, currency) bucket to USD. Uses convertToUsd
    // which handles the fetch+cache; USD passes through unchanged.
    const revenueByChannel = new Map<string, number>();
    for (const bucket of revenueAgg) {
      const cid = bucket._id.channelId.toString();
      const currency = bucket._id.currency || "USD";
      const minor = bucket.totalMinor || 0;
      if (minor <= 0) continue;
      const native = minor / 100;
      const { usdAmount } = await convertToUsd(native, currency);
      revenueByChannel.set(cid, (revenueByChannel.get(cid) || 0) + usdAmount);
    }

    // 4. Referred conversions per channel. itemId is stored as a string
    // (see AffiliateConversion schema), so match against string channel
    // ids rather than ObjectIds.
    const refAgg = await AffiliateConversion.aggregate([
      {
        $match: {
          orgId: orgObjectId,
          itemType: "channel",
          itemId: { $in: channelIdStrings },
        },
      },
      { $group: { _id: "$itemId", count: { $sum: 1 } } },
    ]);
    const referredByChannel = new Map<string, number>();
    for (const row of refAgg) {
      referredByChannel.set(String(row._id), row.count || 0);
    }

    // 5. Unique members across the org (headline stat separate from
    // "sum of memberships"). $addToSet inside a single group.
    const uniqueAgg = await ChannelMembership.aggregate([
      { $match: { orgId: orgObjectId, channelId: { $in: channelIds } } },
      { $group: { _id: null, uniqueUsers: { $addToSet: "$userId" } } },
      { $project: { count: { $size: "$uniqueUsers" } } },
    ]);
    const uniqueMembers = uniqueAgg[0]?.count || 0;

    // 5b. Total historical unsubs per channel — every "unsubscribed"
    // event we've ever logged for that channel. Includes both currently-
    // cancelling members (whose access hasn't ended yet) AND members
    // who already fully expired. Rendered as the "Unsubbed" column
    // alongside "Unsubbed (still active)" so the founder sees both
    // "how many are churning right now" and "how many total lost."
    const { ChannelMembershipEvent } = await import(
      "../models/channelMembershipEvent.model"
    );
    const unsubAgg = await ChannelMembershipEvent.aggregate([
      {
        $match: {
          orgId: orgObjectId,
          channelId: { $in: channelIds },
          eventType: "unsubscribed",
        },
      },
      { $group: { _id: "$channelId", count: { $sum: 1 } } },
    ]);
    const unsubsByChannel = new Map<string, number>();
    for (const row of unsubAgg) {
      unsubsByChannel.set(row._id.toString(), row.count || 0);
    }

    // MRR multiplier by billing period. Weekly uses 52/12 to match the
    // long-standing FE formula and the screenshot's $21.67 for a $5/wk sub.
    const mrrMultiplier = (period?: string | null) => {
      switch (period) {
        case "weekly":
          return 52 / 12;
        case "monthly":
          return 1;
        case "quarterly":
          return 1 / 3;
        case "yearly":
          return 1 / 12;
        default:
          return 1;
      }
    };

    // 6. Fold everything into per-channel rows.
    let totalMembersSum = 0;
    let totalCancellingMembersSum = 0;
    let totalUnsubsSum = 0;
    let totalRevenueUsdSum = 0;

    const channelRows = await Promise.all(
      channels.map(async (c: any) => {
        const cid = c._id.toString();
        const mem = memberByChannel.get(cid) || {
          totalMembers: 0,
          activeMembers: 0,
          cancellingMembers: 0,
        };
        const referredMembers = referredByChannel.get(cid) || 0;
        const totalUnsubs = unsubsByChannel.get(cid) || 0;
        const totalRevenueUsdRaw = revenueByChannel.get(cid) || 0;
        const totalRevenueUsd = Math.round(totalRevenueUsdRaw * 100) / 100;

        // MRR: only for paid subscription channels. Uses ACTIVE members
        // (not total) so cancelled subs stop contributing to MRR — that's
        // the semantic upgrade over the old FE formula.
        //
        // For free channels and one-time paid channels, MRR is null (FE
        // renders "—"). Returning 0 here would print "$0.00" in the
        // column, which reads as "we tried to compute this and got
        // nothing" when the truth is "MRR is not a defined metric for
        // this channel type at all." Only recurring subs have a
        // meaningful monthly recurring revenue.
        let monthlyRevenueUsd: number | null;
        if (c.isFree || (c.price ?? 0) === 0 || !c.isSubscription) {
          monthlyRevenueUsd = null;
        } else {
          const p = c.price ?? 0;
          const perMemberNative = p * mrrMultiplier(c.subscriptionPeriod);
          const native = perMemberNative * mem.activeMembers;
          if (native <= 0) {
            // Recurring channel with zero active subs — MRR is a real
            // metric here, it just happens to be $0 this instant.
            monthlyRevenueUsd = 0;
          } else {
            const { usdAmount } = await convertToUsd(
              native,
              c.currency || "USD"
            );
            monthlyRevenueUsd = Math.round(usdAmount * 100) / 100;
          }
        }

        totalMembersSum += mem.totalMembers;
        totalCancellingMembersSum += mem.cancellingMembers;
        totalUnsubsSum += totalUnsubs;
        totalRevenueUsdSum += totalRevenueUsd;

        return {
          _id: cid,
          title: c.title,
          coverImage: c.coverImage || null,
          isFree: !!c.isFree,
          isSubscription: !!c.isSubscription,
          subscriptionPeriod: c.subscriptionPeriod || null,
          isActive: c.isActive !== false,
          isDefault: !!c.isDefault,
          price: c.price ?? 0,
          currency: c.currency || "USD",
          createdAt: c.createdAt,
          totalMembers: mem.totalMembers,
          activeMembers: mem.activeMembers,
          cancellingMembers: mem.cancellingMembers,
          totalUnsubs,
          referredMembers,
          totalRevenueUsd,
          monthlyRevenueUsd,
        };
      })
    );

    // 7. Highest-referred channel. Argmax on referredMembers; if every
    // channel has 0 referrals, fall back to argmax(totalMembers) so the
    // header card still shows something meaningful. `fallback: true` lets
    // the FE relabel or hide the "referred" wording if desired.
    let highestReferredChannel: {
      channelId: string;
      title: string;
      referredCount: number;
      fallback: boolean;
    } | null = null;
    const withReferrals = channelRows.filter((c) => c.referredMembers > 0);
    if (withReferrals.length > 0) {
      const top = withReferrals.reduce((best, c) =>
        c.referredMembers > best.referredMembers ? c : best
      );
      highestReferredChannel = {
        channelId: top._id,
        title: top.title,
        referredCount: top.referredMembers,
        fallback: false,
      };
    } else if (channelRows.length > 0) {
      const top = channelRows.reduce((best, c) =>
        c.totalMembers > best.totalMembers ? c : best
      );
      if (top.totalMembers > 0) {
        highestReferredChannel = {
          channelId: top._id,
          title: top.title,
          referredCount: 0,
          fallback: true,
        };
      }
    }

    // Distinct titles instead of raw channel-row count. Duplicates
    // exist in the DB from the earlier mobile "USD $" currency bug
    // where each broken create attempt inserted a fresh row with the
    // same title. The founder mental model of "how many communities do
    // I have?" matches unique names, not row count. Per-row analytics
    // still show every channel (including dupes) — the header is the
    // only place we collapse them.
    const distinctTitles = new Set(
      channels.map((c: any) => (c.title || "").trim().toLowerCase())
    );

    res.json({
      success: true,
      headerStats: {
        totalCommunities: distinctTitles.size,
        totalMembers: totalMembersSum,
        totalCancellingMembers: totalCancellingMembersSum,
        totalUnsubs: totalUnsubsSum,
        uniqueMembers,
        highestReferredChannel,
        totalRevenueUsd: Math.round(totalRevenueUsdSum * 100) / 100,
      },
      channels: channelRows,
    });
  } catch (error) {
    console.error("Error getting channel analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get channel analytics",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/channels/invoices?orgId=<id>&status=&channelId=&search=&currency=&isRecurring=&from=&to=&limit=&skip=
 *
 * Founder-facing paginated list of ALL channel invoices for the org.
 * Powers the new founder Communities "Invoices" tab — replaces the
 * customer-only <OrdersPage initialType="channel" /> view that used to
 * live at Founder:Communities:Orders and only showed the FOUNDER's own
 * channel orders (misleading label).
 *
 * Same auth model as /feed/stats — requireAuth + isUserFounder gate.
 * Non-founders get a 403.
 *
 * Filters (all optional):
 *   status       enum: draft|pending|paid|failed|cancelled|refunded|expired
 *   channelId    single channel to scope to
 *   search       case-insensitive match on customer name/email OR
 *                invoice number
 *   currency     itemCurrency filter (USD|INR)
 *   isRecurring  "true"|"false" — one-time vs recurring only
 *   from         ISO date, filters createdAt >= from
 *   to           ISO date, filters createdAt <= to
 *   limit        default 25, capped at 100
 *   skip         default 0
 *
 * Response also includes a flat `channels: [{ _id, title }]` list so the
 * FE's channel-filter dropdown doesn't need a separate call.
 */
// Founder invoice list — generalized across item types. Reads the
// `Invoice` collection filtered to a single itemType and constrained to
// the org's items of that type. Reference implementation for the four
// per-type Orders pages (community/live/course/product).
//
// Legacy path `/channels/invoices` is preserved as an alias below.
router.get("/founder/invoices", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      // Which item type to scope the invoice list to. Only paid-item
      // types with founder-managed catalogs are supported; ecommerce /
      // office / franchise etc. would need their own founder gates.
      itemType: z
        .enum(["channel", "workshop", "course", "product"])
        .default("channel"),
      status: z
        .enum([
          "draft",
          "pending",
          "paid",
          "failed",
          "cancelled",
          "refunded",
          "expired",
        ])
        .optional(),
      // Filter to a specific item within the type. Comma-separated to
      // support the FE's dedupe-by-title UX — when duplicate titles
      // exist, all their IDs are sent so the invoice list stays complete.
      itemId: z.string().optional(),
      // Legacy alias — community FE historically sent `channelId`.
      channelId: z.string().optional(),
      search: z.string().optional(),
      currency: z.enum(["USD", "INR"]).optional(),
      isRecurring: z.enum(["true", "false"]).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => Math.min(Math.max(v ? parseInt(v, 10) : 25, 1), 100)),
      skip: z
        .string()
        .optional()
        .transform((v) => Math.max(v ? parseInt(v, 10) : 0, 0)),
    });
    const parsed = schema.parse(req.query);
    const {
      orgId,
      itemType,
      status,
      search,
      currency,
      isRecurring,
      from,
      to,
      limit,
      skip,
    } = parsed;
    const rawItemId = parsed.itemId || parsed.channelId || undefined;

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res
        .status(403)
        .json({ success: false, error: "Only founders can view org invoices" });
    }

    const orgObjectId = new Types.ObjectId(orgId);

    // Pre-fetch the org's items of the target type once so we can:
    //   (a) constrain Invoice queries to line items pointing at THIS
    //       org's items (prevents cross-org invoice leakage from the
    //       shared multi-HQ ecommerce invoice format),
    //   (b) surface `itemTitle` on each row without a per-invoice lookup,
    //   (c) return the same list to the FE for the filter dropdown.
    let orgItems: Array<{ _id: any; title: string }> = [];
    if (itemType === "channel") {
      orgItems = (await Channel.find({ storeId: orgObjectId })
        .select("title")
        .sort({ title: 1 })
        .lean()) as any[];
    } else if (itemType === "workshop") {
      orgItems = (await Workshop.find({ orgId: orgObjectId })
        .select("title")
        .sort({ title: 1 })
        .lean()) as any[];
    } else if (itemType === "course") {
      // Course model uses `organizationId` (Workshop uses `orgId`, Channel
      // uses `storeId` — the three item types disagree on org field name).
      orgItems = (await Course.find({ organizationId: orgObjectId })
        .select("title")
        .sort({ title: 1 })
        .lean()) as any[];
    } else if (itemType === "product") {
      // Product uses `organizationId` AND its display field is `name`
      // (unlike Course/Workshop/Channel which use `title`). Normalize
      // to `title` below when building the id→label map.
      orgItems = (await Product.find({ organizationId: orgObjectId })
        .select("name")
        .sort({ name: 1 })
        .lean()) as any[];
    }
    const orgItemIds = orgItems.map((i: any) => i._id);
    const titleById = new Map<string, string>();
    for (const it of orgItems as any[]) {
      // Product carries `name`; everything else carries `title`.
      titleById.set(it._id.toString(), it.title || it.name);
    }

    // Build the Invoice query. We filter by organizationId (top-level)
    // AND require at least one line item with the target itemType
    // pointing at one of THIS org's items — this excludes cross-org
    // ecommerce invoices that also live under the same organizationId
    // for the multi-HQ line-item flow.
    const query: Record<string, any> = {
      organizationId: orgObjectId,
      "lineItems.itemType": itemType,
    };

    // itemId filter: intersect the requested itemId(s) with the org's
    // items so a founder can't peek at another org's invoice history
    // by guessing an itemId.
    if (rawItemId) {
      const rawIds = rawItemId
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const iids: Types.ObjectId[] = [];
      for (const raw of rawIds) {
        if (!Types.ObjectId.isValid(raw)) {
          return res
            .status(400)
            .json({ success: false, error: "itemId must be a valid ObjectId" });
        }
        const iid = new Types.ObjectId(raw);
        const isOwn = orgItemIds.some((id: any) => id.equals(iid));
        if (!isOwn) {
          return res
            .status(400)
            .json({ success: false, error: "itemId is not in this org" });
        }
        iids.push(iid);
      }
      query["lineItems.itemId"] = iids.length === 1 ? iids[0] : { $in: iids };
    } else {
      // No specific item — still constrain to the org's items so stray
      // ecommerce line items don't pollute the results.
      query["lineItems.itemId"] = { $in: orgItemIds };
    }

    // "pending" from the FE chip is UX for "awaiting payment" and
    // covers both the `draft` and `pending` DB states (which are
    // semantically identical from a founder's POV). Everything else
    // maps 1:1.
    if (status === "pending") {
      query.status = { $in: ["draft", "pending"] };
    } else if (status) {
      query.status = status;
    }
    if (currency) query.itemCurrency = currency;
    if (isRecurring === "true") query.isRecurring = true;
    if (isRecurring === "false") query.isRecurring = false;

    if (from || to) {
      query.createdAt = {} as Record<string, Date>;
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      query.$or = [
        { customerName: rx },
        { customerEmail: rx },
        { invoiceNumber: rx },
      ];
    }

    const [rows, total] = await Promise.all([
      Invoice.find(query)
        .select(
          "invoiceNumber invoiceType status totalAmount itemCurrency paymentCurrency " +
          "isRecurring recurringPeriod recurringPaymentNumber parentInvoiceId " +
          "customerName customerEmail userId lineItems paymentPlatform " +
          "createdAt paidAt nextDueDate cancelledAt"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(query),
    ]);

    // For invoices that don't have a customerName snapshot, fall back to
    // looking up the user's name from the User collection using userId.
    const missingNameUserIds = [
      ...new Set(
        rows
          .filter((inv: any) => !inv.customerName && inv.userId)
          .map((inv: any) => inv.userId.toString())
      ),
    ];
    const userNameById = new Map<string, string>();
    if (missingNameUserIds.length > 0) {
      const userDocs = await User.find({
        _id: { $in: missingNameUserIds.map((id) => new Types.ObjectId(id)) },
      })
        .select("name")
        .lean();
      for (const u of userDocs as any[]) {
        if (u.name) userNameById.set(u._id.toString(), u.name);
      }
    }

    const invoices = rows.map((inv: any) => {
      // Pick the target-type line item. The query already required at
      // least one line item of this itemType, so this find() will hit.
      const targetLine =
        inv.lineItems?.find((li: any) => li.itemType === itemType) ??
        inv.lineItems?.[0];
      const itemIdStr = targetLine?.itemId?.toString?.() ?? null;
      const itemTitle =
        (itemIdStr && titleById.get(itemIdStr)) ||
        targetLine?.itemName ||
        null;
      return {
        _id: (inv._id as any).toString(),
        invoiceNumber: inv.invoiceNumber,
        invoiceType: inv.invoiceType || null,
        status: inv.status,
        totalAmount: inv.totalAmount,
        itemCurrency: inv.itemCurrency,
        paymentCurrency: inv.paymentCurrency || null,
        customerName:
          inv.customerName ||
          (inv.userId ? userNameById.get(inv.userId.toString()) || null : null),
        customerEmail: inv.customerEmail || null,
        customerId: inv.userId ? inv.userId.toString() : null,
        // Generic + legacy channel-named fields. Legacy aliases keep
        // the pre-existing FE community page rendering without a
        // simultaneous type-name migration.
        itemId: itemIdStr,
        itemTitle,
        channelId: itemIdStr,
        channelTitle: itemTitle,
        isRecurring: !!inv.isRecurring,
        recurringPeriod: inv.recurringPeriod || null,
        recurringPaymentNumber: inv.recurringPaymentNumber || null,
        parentInvoiceId: inv.parentInvoiceId
          ? (inv.parentInvoiceId as any).toString()
          : null,
        paymentPlatform: inv.paymentPlatform || null,
        createdAt: inv.createdAt,
        paidAt: inv.paidAt || null,
        nextDueDate: inv.nextDueDate || null,
        cancelledAt: inv.cancelledAt || null,
      };
    });


    const itemDropdown = orgItems.map((c: any) => ({
      _id: c._id.toString(),
      title: c.title,
    }));

    res.json({
      success: true,
      invoices,
      total,
      limit,
      skip,
      hasMore: skip + invoices.length < total,
      itemType,
      items: itemDropdown,
      // Legacy alias so the current community FE keeps its `channels`
      // reference until it's migrated to `items`.
      channels: itemType === "channel" ? itemDropdown : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, error: error.issues[0]?.message || "Invalid query" });
    }
    console.error("Error listing founder invoices:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list invoices",
      details: (error as Error).message,
    });
  }
});

// Note: the old `/channels/invoices` route was removed here. The
// community Orders FE (FounderCommunityOrdersPage) now hits
// `/founder/invoices?itemType=channel` alongside the other three types.

/**
 * GET /feed/founder/item-users?orgId=&itemType=&...
 *
 * Founder-facing user list — one row per unique buyer that has at least
 * one paid invoice for THIS item type against THIS org. Powers the
 * "Users" tab on the four Orders pages (Communities / Live / Courses /
 * Products). Same auth + org-scoping pattern as /founder/invoices above.
 *
 * Filters (all optional):
 *   status     paid|refunded|pending  (invoice status roll-up)
 *              For itemType=channel: active|cancelling|expired maps to
 *              ChannelMembership.subscriptionStatus AFTER the base
 *              invoice roll-up.
 *   itemId     comma-separated item IDs (org-scoped, same as invoices)
 *   q          case-insensitive name/email substring (post-lookup)
 *   currency   itemCurrency filter
 *   from/to    lastPaidAt date range
 *   limit/skip pagination (default 25, cap 100)
 *
 * Response also echoes the org's items[] so the FE can populate the
 * item Select without a second call.
 */
router.get("/founder/item-users", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      itemType: z
        .enum(["channel", "workshop", "course", "product"])
        .default("channel"),
      // For non-channel types: paid|refunded|pending (invoice roll-up).
      // For channel: active|cancelling|expired (membership status).
      status: z
        .enum([
          "paid",
          "refunded",
          "pending",
          "active",
          "cancelling",
          "expired",
        ])
        .optional(),
      itemId: z.string().optional(),
      q: z.string().optional(),
      currency: z.enum(["USD", "INR"]).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => Math.min(Math.max(v ? parseInt(v, 10) : 25, 1), 100)),
      skip: z
        .string()
        .optional()
        .transform((v) => Math.max(v ? parseInt(v, 10) : 0, 0)),
    });
    const parsed = schema.parse(req.query);
    const { orgId, itemType, status, q, currency, from, to, limit, skip } =
      parsed;

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res
        .status(403)
        .json({ success: false, error: "Only founders can view org users" });
    }

    const orgObjectId = new Types.ObjectId(orgId);

    // Resolve orgItemIds + title map — same shape as /founder/invoices.
    let orgItems: Array<{ _id: any; title: string }> = [];
    if (itemType === "channel") {
      orgItems = (await Channel.find({ storeId: orgObjectId })
        .select("title")
        .sort({ title: 1 })
        .lean()) as any[];
    } else if (itemType === "workshop") {
      orgItems = (await Workshop.find({ orgId: orgObjectId })
        .select("title")
        .sort({ title: 1 })
        .lean()) as any[];
    } else if (itemType === "course") {
      orgItems = (await Course.find({ organizationId: orgObjectId })
        .select("title")
        .sort({ title: 1 })
        .lean()) as any[];
    } else if (itemType === "product") {
      orgItems = (await Product.find({ organizationId: orgObjectId })
        .select("name")
        .sort({ name: 1 })
        .lean()) as any[];
    }
    const orgItemIds = orgItems.map((i: any) => i._id);

    // itemId scope — reuse the same validation shape as invoices route.
    let itemIdScope: Types.ObjectId[] | null = null;
    if (parsed.itemId) {
      const rawIds = parsed.itemId
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      itemIdScope = [];
      for (const raw of rawIds) {
        if (!Types.ObjectId.isValid(raw)) {
          return res
            .status(400)
            .json({ success: false, error: "itemId must be a valid ObjectId" });
        }
        const iid = new Types.ObjectId(raw);
        const isOwn = orgItemIds.some((id: any) => id.equals(iid));
        if (!isOwn) {
          return res
            .status(400)
            .json({ success: false, error: "itemId is not in this org" });
        }
        itemIdScope.push(iid);
      }
    }

    // Base $match on Invoice.
    const invoiceMatch: Record<string, any> = {
      organizationId: orgObjectId,
      "lineItems.itemType": itemType,
      userId: { $ne: null },
    };
    invoiceMatch["lineItems.itemId"] = itemIdScope
      ? itemIdScope.length === 1
        ? itemIdScope[0]
        : { $in: itemIdScope }
      : { $in: orgItemIds };

    // Invoice-status filter: only applies for non-channel item types
    // (channel uses membership status instead).
    if (itemType !== "channel" && status) {
      if (status === "pending") {
        invoiceMatch.status = { $in: ["draft", "pending"] };
      } else if (status === "paid" || status === "refunded") {
        invoiceMatch.status = status;
      }
    }
    if (currency) invoiceMatch.itemCurrency = currency;
    if (from || to) {
      invoiceMatch.createdAt = {} as Record<string, Date>;
      if (from) invoiceMatch.createdAt.$gte = new Date(from);
      if (to) invoiceMatch.createdAt.$lte = new Date(to);
    }

    // Aggregation pipeline. $facet gives us total + rows in one round-trip.
    const escapedQ = q?.trim()
      ? q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      : null;

    const basePipeline: any[] = [
      { $match: invoiceMatch },
      {
        $group: {
          _id: "$userId",
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$totalAmount", 0],
            },
          },
          invoiceCount: { $sum: 1 },
          paidInvoiceCount: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
          },
          itemIds: { $addToSet: { $first: "$lineItems.itemId" } },
          lastActivityAt: { $max: "$createdAt" },
          firstActivityAt: { $min: "$createdAt" },
          currency: { $first: "$itemCurrency" },
          customerName: { $first: "$customerName" },
          customerEmail: { $first: "$customerEmail" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ];

    if (escapedQ) {
      basePipeline.push({
        $match: {
          $or: [
            { "user.name": { $regex: escapedQ, $options: "i" } },
            { "user.email": { $regex: escapedQ, $options: "i" } },
            { customerName: { $regex: escapedQ, $options: "i" } },
            { customerEmail: { $regex: escapedQ, $options: "i" } },
          ],
        },
      });
    }

    // For channel: after the invoice roll-up, join in ChannelMembership so
    // we can filter/badge by subscriptionStatus. `hasActive` = at least one
    // active membership in this org; `hasCancelling` = at least one row
    // with subscriptionStatus="cancelled" but access not yet expired.
    if (itemType === "channel") {
      basePipeline.push({
        $lookup: {
          from: "channelmemberships",
          let: { uid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", "$$uid"] },
                    { $eq: ["$orgId", orgObjectId] },
                    { $in: ["$channelId", orgItemIds] },
                  ],
                },
              },
            },
            {
              $project: {
                subscriptionStatus: 1,
                status: 1,
                lastActivityAt: 1,
              },
            },
          ],
          as: "memberships",
        },
      });
      basePipeline.push({
        $addFields: {
          hasActive: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$memberships",
                    as: "m",
                    cond: {
                      $or: [
                        { $eq: ["$$m.subscriptionStatus", "active"] },
                        { $eq: ["$$m.status", "active"] },
                      ],
                    },
                  },
                },
              },
              0,
            ],
          },
          hasCancelling: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$memberships",
                    as: "m",
                    cond: { $eq: ["$$m.subscriptionStatus", "cancelled"] },
                  },
                },
              },
              0,
            ],
          },
          membershipCount: { $size: "$memberships" },
        },
      });
      basePipeline.push({
        $addFields: {
          derivedStatus: {
            $cond: [
              "$hasActive",
              "active",
              { $cond: ["$hasCancelling", "cancelling", "expired"] },
            ],
          },
        },
      });
      if (status === "active" || status === "cancelling" || status === "expired") {
        basePipeline.push({ $match: { derivedStatus: status } });
      }
    } else {
      basePipeline.push({
        $addFields: {
          derivedStatus: {
            $cond: [
              { $gt: ["$paidInvoiceCount", 0] },
              "paid",
              { $literal: "pending" },
            ],
          },
        },
      });
    }

    const pipeline: any[] = [
      ...basePipeline,
      {
        $facet: {
          rows: [
            { $sort: { lastActivityAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                userId: { $toString: "$_id" },
                name: {
                  $ifNull: ["$user.name", { $ifNull: ["$customerName", null] }],
                },
                email: {
                  $ifNull: [
                    "$user.email",
                    { $ifNull: ["$customerEmail", null] },
                  ],
                },
                profilePicture: { $ifNull: ["$user.profilePicture", null] },
                itemIds: {
                  $map: {
                    input: "$itemIds",
                    as: "id",
                    in: { $toString: "$$id" },
                  },
                },
                itemCount: { $size: "$itemIds" },
                totalPaid: 1,
                invoiceCount: 1,
                currency: 1,
                lastActivityAt: 1,
                firstActivityAt: 1,
                status: "$derivedStatus",
              },
            },
          ],
          totalArr: [{ $count: "n" }],
        },
      },
    ];

    const [aggResult] = await Invoice.aggregate(pipeline);
    const users = (aggResult?.rows ?? []) as any[];
    const total = aggResult?.totalArr?.[0]?.n ?? 0;

    const itemDropdown = orgItems.map((c: any) => ({
      _id: c._id.toString(),
      title: c.title || (c as any).name,
    }));

    res.json({
      success: true,
      users,
      total,
      limit,
      skip,
      hasMore: skip + users.length < total,
      itemType,
      items: itemDropdown,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, error: error.issues[0]?.message || "Invalid query" });
    }
    console.error("Error listing founder item-users:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list users",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/founder/user-detail?orgId=&itemType=&userId=
 *
 * Per-user detail for the Users-tab overlay. Returns the user profile,
 * their items (memberships for channels; grouped-invoice items for other
 * types), every matching invoice, and (channel only) the membership
 * event log. All queries are scoped to the founder's org.
 */
router.get("/founder/user-detail", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      itemType: z.enum(["channel", "workshop", "course", "product"]),
      userId: z.string(),
    });
    const { orgId, itemType, userId } = schema.parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res
        .status(403)
        .json({ success: false, error: "Only founders can view user detail" });
    }
    if (!Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, error: "userId must be a valid ObjectId" });
    }

    const orgObjectId = new Types.ObjectId(orgId);
    const userObjectId = new Types.ObjectId(userId);

    // Resolve org items + title map (same pattern as invoices route).
    let orgItems: Array<{ _id: any; title: string }> = [];
    if (itemType === "channel") {
      orgItems = (await Channel.find({ storeId: orgObjectId })
        .select("title")
        .sort({ title: 1 })
        .lean()) as any[];
    } else if (itemType === "workshop") {
      orgItems = (await Workshop.find({ orgId: orgObjectId })
        .select("title")
        .sort({ title: 1 })
        .lean()) as any[];
    } else if (itemType === "course") {
      orgItems = (await Course.find({ organizationId: orgObjectId })
        .select("title")
        .sort({ title: 1 })
        .lean()) as any[];
    } else if (itemType === "product") {
      orgItems = (await Product.find({ organizationId: orgObjectId })
        .select("name")
        .sort({ name: 1 })
        .lean()) as any[];
    }
    const orgItemIds = orgItems.map((i: any) => i._id);
    const titleById = new Map<string, string>();
    for (const it of orgItems as any[]) {
      titleById.set(it._id.toString(), (it as any).title || (it as any).name);
    }

    const [userDoc, invoiceRows] = await Promise.all([
      User.findById(userObjectId)
        .select("name email profilePicture createdAt")
        .lean(),
      Invoice.find({
        organizationId: orgObjectId,
        userId: userObjectId,
        "lineItems.itemType": itemType,
        "lineItems.itemId": { $in: orgItemIds },
      })
        .select(
          "invoiceNumber status totalAmount itemCurrency paymentCurrency " +
          "isRecurring recurringPeriod recurringPaymentNumber parentInvoiceId " +
          "customerName customerEmail lineItems " +
          "createdAt paidAt nextDueDate cancelledAt"
        )
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
    ]);

    const invoices = invoiceRows.map((inv: any) => {
      const targetLine =
        inv.lineItems?.find((li: any) => li.itemType === itemType) ??
        inv.lineItems?.[0];
      const itemIdStr = targetLine?.itemId?.toString?.() ?? null;
      const itemTitle =
        (itemIdStr && titleById.get(itemIdStr)) ||
        targetLine?.itemName ||
        null;
      return {
        _id: (inv._id as any).toString(),
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        totalAmount: inv.totalAmount,
        itemCurrency: inv.itemCurrency,
        paymentCurrency: inv.paymentCurrency || null,
        itemId: itemIdStr,
        itemTitle,
        isRecurring: !!inv.isRecurring,
        recurringPeriod: inv.recurringPeriod || null,
        recurringPaymentNumber: inv.recurringPaymentNumber || null,
        parentInvoiceId: inv.parentInvoiceId
          ? (inv.parentInvoiceId as any).toString()
          : null,
        createdAt: inv.createdAt,
        paidAt: inv.paidAt || null,
        nextDueDate: inv.nextDueDate || null,
        cancelledAt: inv.cancelledAt || null,
      };
    });

    // Items list — for channels, join ChannelMembership; for the other
    // types, group invoices by itemId.
    let items: any[] = [];
    let events: any[] = [];
    if (itemType === "channel") {
      const memberships = await ChannelMembership.find({
        userId: userObjectId,
        orgId: orgObjectId,
        channelId: { $in: orgItemIds },
      }).lean();
      items = memberships.map((m: any) => ({
        itemId: m.channelId.toString(),
        itemTitle: titleById.get(m.channelId.toString()) || null,
        joinedAt: m.joinedAt || null,
        status: m.status,
        subscriptionStatus: m.subscriptionStatus || null,
        lastPaymentDate: m.lastPaymentDate || null,
        nextPaymentDate: m.nextPaymentDate || null,
        cancelledAt: m.cancelledAt || null,
        lastActivityAt: m.lastActivityAt || null,
      }));

      const { ChannelMembershipEvent } = await import(
        "../models/channelMembershipEvent.model"
      );
      const eventRows = await ChannelMembershipEvent.find({
        userId: userObjectId,
        orgId: orgObjectId,
        channelId: { $in: orgItemIds },
      })
        .sort({ occurredAt: -1 })
        .limit(200)
        .lean();
      events = eventRows.map((e: any) => ({
        _id: e._id.toString(),
        channelId: e.channelId?.toString?.() || null,
        channelTitle: e.channelId
          ? titleById.get(e.channelId.toString()) || null
          : null,
        eventType: e.eventType,
        occurredAt: e.occurredAt,
        subscriptionPeriod: e.subscriptionPeriod || null,
        accessUntil: e.accessUntil || null,
      }));
    } else {
      // Group invoices by itemId for the Items tab.
      const groups = new Map<
        string,
        {
          itemId: string;
          itemTitle: string | null;
          firstPurchasedAt: Date;
          lastPurchasedAt: Date;
          totalPaid: number;
          currency: string | null;
          invoiceCount: number;
          hasActivePaid: boolean;
        }
      >();
      for (const inv of invoices) {
        if (!inv.itemId) continue;
        const existing = groups.get(inv.itemId);
        const created = new Date(inv.createdAt);
        if (!existing) {
          groups.set(inv.itemId, {
            itemId: inv.itemId,
            itemTitle: inv.itemTitle,
            firstPurchasedAt: created,
            lastPurchasedAt: created,
            totalPaid: inv.status === "paid" ? inv.totalAmount : 0,
            currency: inv.itemCurrency,
            invoiceCount: 1,
            hasActivePaid: inv.status === "paid" && !inv.cancelledAt,
          });
        } else {
          if (created < existing.firstPurchasedAt)
            existing.firstPurchasedAt = created;
          if (created > existing.lastPurchasedAt)
            existing.lastPurchasedAt = created;
          if (inv.status === "paid") existing.totalPaid += inv.totalAmount;
          existing.invoiceCount += 1;
          if (inv.status === "paid" && !inv.cancelledAt)
            existing.hasActivePaid = true;
        }
      }
      items = Array.from(groups.values()).sort(
        (a, b) => b.lastPurchasedAt.getTime() - a.lastPurchasedAt.getTime()
      );
    }

    res.json({
      success: true,
      user: userDoc
        ? {
          _id: (userDoc._id as any).toString(),
          name: (userDoc as any).name || null,
          email: (userDoc as any).email || null,
          profilePicture: (userDoc as any).profilePicture || null,
          createdAt: (userDoc as any).createdAt || null,
        }
        : null,
      items,
      invoices,
      events,
      itemType,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, error: error.issues[0]?.message || "Invalid query" });
    }
    console.error("Error loading founder user detail:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load user detail",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/channels/unsub-log?orgId=&...
 *
 * Founder-facing paginated log of every ChannelMembershipEvent
 * ("unsubscribed" + "expired" + "payment_defaulted") across the org's
 * community channels. Powers the Founder:Communities:UnsubLog tab. Same
 * auth pattern as the other founder endpoints on this router.
 *
 * Filters (all optional):
 *   channelId    comma-separated ObjectIds (dedupe-by-title UX)
 *   eventType    "unsubscribed" | "expired" | "payment_defaulted"
 *   search       matches customerName / customerEmail snapshot fields
 *                (case-insensitive)
 *   from / to    ISO date range on `occurredAt`
 *   limit / skip pagination — default 25, capped at 100
 *
 * Response also carries the org's channel list so the FE filter
 * dropdown works with a single call.
 */
router.get("/founder/unsub-log", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      channelId: z.string().optional(),
      // Per-workshop scoping (comma-separated). Same shape as
      // channelId — union-validated against org.workshops so a founder
      // can't reach into another org's log by guessing an ID.
      workshopId: z.string().optional(),
      // Which kind of unsub-log to return. REQUIRED now that the
      // per-type Unsub pages each pin one kind (Communities → channel,
      // Live Streams → workshop). Course + Product live on separate
      // routes (empty-state / product-refunds).
      itemKind: z.enum(["channel", "workshop"]),
      eventType: z
        .enum(["unsubscribed", "expired", "payment_defaulted"])
        .optional(),
      search: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => Math.min(Math.max(v ? parseInt(v, 10) : 25, 1), 100)),
      skip: z
        .string()
        .optional()
        .transform((v) => Math.max(v ? parseInt(v, 10) : 0, 0)),
    });
    const {
      orgId,
      channelId,
      workshopId,
      itemKind,
      eventType,
      search,
      from,
      to,
      limit,
      skip,
    } = schema.parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res
        .status(403)
        .json({ success: false, error: "Only founders can view the unsub log" });
    }

    const orgObjectId = new Types.ObjectId(orgId);

    // Pre-fetch the org's channel + workshop lists so we can:
    //   (a) scope the log query to just this org's items (defensive
    //       against orphan events in a shared collection),
    //   (b) return both dropdown lists to the FE without extra calls.
    const [orgChannels, orgWorkshops] = await Promise.all([
      Channel.find({ storeId: orgObjectId })
        .select("title")
        .sort({ title: 1 })
        .lean(),
      (async () => {
        const { Workshop } = await import("../models/workshop.model");
        return Workshop.find({ orgId: orgObjectId })
          .select("title enrollmentType date")
          .sort({ title: 1 })
          .lean();
      })(),
    ]);
    const orgChannelIds = orgChannels.map((c: any) => c._id);
    const orgWorkshopIds = orgWorkshops.map((w: any) => w._id);
    const channelTitleById = new Map<string, string>();
    for (const c of orgChannels as any[]) {
      channelTitleById.set(c._id.toString(), c.title);
    }
    const workshopTitleById = new Map<string, string>();
    for (const w of orgWorkshops as any[]) {
      workshopTitleById.set(w._id.toString(), w.title);
    }

    const { ChannelMembershipEvent } = await import(
      "../models/channelMembershipEvent.model"
    );

    const query: Record<string, any> = { orgId: orgObjectId };

    // Parse + validate the channelId list. Same shape as before —
    // just built up separately so the workshopId list can share the
    // pattern below.
    const channelIdFilter: Types.ObjectId[] = [];
    if (channelId) {
      const rawIds = channelId
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const raw of rawIds) {
        if (!Types.ObjectId.isValid(raw)) {
          return res
            .status(400)
            .json({ success: false, error: "channelId must be a valid ObjectId" });
        }
        const cid = new Types.ObjectId(raw);
        const isOwn = orgChannelIds.some((id: any) => id.equals(cid));
        if (!isOwn) {
          return res
            .status(400)
            .json({ success: false, error: "channelId is not in this org" });
        }
        channelIdFilter.push(cid);
      }
    }

    // Same pattern for workshopId.
    const workshopIdFilter: Types.ObjectId[] = [];
    if (workshopId) {
      const rawIds = workshopId
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const raw of rawIds) {
        if (!Types.ObjectId.isValid(raw)) {
          return res
            .status(400)
            .json({ success: false, error: "workshopId must be a valid ObjectId" });
        }
        const wid = new Types.ObjectId(raw);
        const isOwn = orgWorkshopIds.some((id: any) => id.equals(wid));
        if (!isOwn) {
          return res
            .status(400)
            .json({ success: false, error: "workshopId is not in this org" });
        }
        workshopIdFilter.push(wid);
      }
    }

    // Item scoping. itemKind is now required, so we only build the one
    // clause that matches. Legacy rows created before the itemKind
    // migration lack the field entirely — treat them as "channel"
    // (matches the model's default at channelMembershipEvent.model.ts:32).
    if (itemKind === "channel") {
      query.$or = [{ itemKind: "channel" }, { itemKind: { $exists: false } }];
      query.channelId = {
        $in: channelIdFilter.length > 0 ? channelIdFilter : orgChannelIds,
      };
    } else {
      query.itemKind = "workshop";
      query.workshopId = {
        $in:
          workshopIdFilter.length > 0 ? workshopIdFilter : orgWorkshopIds,
      };
    }

    if (eventType) query.eventType = eventType;
    if (from || to) {
      query.occurredAt = {} as Record<string, Date>;
      if (from) query.occurredAt.$gte = new Date(from);
      if (to) query.occurredAt.$lte = new Date(to);
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      // The itemKind scoping above may have already occupied `query.$or`.
      // If so, move both into $and so the two OR groups compose
      // correctly (Mongo doesn't allow two top-level $or keys).
      const existingKindOr = query.$or as any[] | undefined;
      if (existingKindOr) {
        delete query.$or;
        query.$and = [
          { $or: existingKindOr },
          {
            $or: [
              { customerNameSnapshot: rx },
              { customerEmailSnapshot: rx },
            ],
          },
        ];
      } else {
        query.$or = [
          { customerNameSnapshot: rx },
          { customerEmailSnapshot: rx },
        ];
      }
    }

    const [rows, total] = await Promise.all([
      ChannelMembershipEvent.find(query)
        .sort({ occurredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ChannelMembershipEvent.countDocuments(query),
    ]);

    const events = rows.map((r: any) => {
      const kind: "channel" | "workshop" =
        r.itemKind === "workshop" ? "workshop" : "channel";
      const wid = r.workshopId ? r.workshopId.toString() : null;
      const cid = r.channelId ? r.channelId.toString() : null;
      return {
        _id: r._id.toString(),
        userId: r.userId ? r.userId.toString() : null,
        itemKind: kind,
        channelId: cid,
        channelTitle: cid ? channelTitleById.get(cid) || null : null,
        workshopId: wid,
        workshopTitle: wid ? workshopTitleById.get(wid) || null : null,
        sessionDate: r.sessionDate || null,
        eventType: r.eventType,
        occurredAt: r.occurredAt,
        channelKind: r.channelKind,
        subscriptionPeriod: r.subscriptionPeriod || null,
        accessUntil: r.accessUntil || null,
        activeDaysUsed: r.activeDaysUsed,
        activeDaysLeftAtCancel: r.activeDaysLeftAtCancel,
        lifetimeValueUsdSnapshot: r.lifetimeValueUsdSnapshot || 0,
        parentInvoiceId: r.parentInvoiceId ? r.parentInvoiceId.toString() : null,
        customerName: r.customerNameSnapshot,
        customerEmail: r.customerEmailSnapshot,
      };
    });

    // Bucket counts across the whole org. Extended with a kind split
    // so the FE Kind chips render "Channel N · Workshop M · All O"
    // in addition to the existing eventType breakdown.
    const bucketAgg = await ChannelMembershipEvent.aggregate([
      {
        $match: {
          orgId: orgObjectId,
          $or: [
            { channelId: { $in: orgChannelIds } },
            { workshopId: { $in: orgWorkshopIds } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          unsubscribed: {
            $sum: { $cond: [{ $eq: ["$eventType", "unsubscribed"] }, 1, 0] },
          },
          expired: {
            $sum: { $cond: [{ $eq: ["$eventType", "expired"] }, 1, 0] },
          },
          channelKindCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$itemKind", "channel"] },
                    { $not: ["$itemKind"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          workshopKindCount: {
            $sum: { $cond: [{ $eq: ["$itemKind", "workshop"] }, 1, 0] },
          },
          all: { $sum: 1 },
        },
      },
    ]);
    const counts = bucketAgg[0]
      ? {
        unsubscribed: bucketAgg[0].unsubscribed || 0,
        expired: bucketAgg[0].expired || 0,
        channel: bucketAgg[0].channelKindCount || 0,
        workshop: bucketAgg[0].workshopKindCount || 0,
        all: bucketAgg[0].all || 0,
      }
      : { unsubscribed: 0, expired: 0, channel: 0, workshop: 0, all: 0 };

    res.json({
      success: true,
      events,
      counts,
      total,
      limit,
      skip,
      hasMore: skip + events.length < total,
      channels: orgChannels.map((c: any) => ({
        _id: c._id.toString(),
        title: c.title,
      })),
      // Workshop dropdown data — parity with channels. `enrollmentType`
      // ships along so the FE knows whether to prompt for a sessionDate
      // on filter selection.
      workshops: orgWorkshops.map((w: any) => ({
        _id: w._id.toString(),
        title: w.title,
        enrollmentType: (w as any).enrollmentType || "once",
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, error: error.issues[0]?.message || "Invalid query" });
    }
    console.error("Error listing unsub log for founder:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list unsub log",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/founder/product-refunds?orgId=&...
 *
 * Founder-facing paginated log of refunded + cancelled ProductOrder rows.
 * Powers the Digital Products Unsub Log (labelled "Refunds &
 * Cancellations" on the FE) — Products don't have a
 * subscription/unsubscribe concept but they do have refunds, so we
 * repurpose that here for parity with Communities + Live Streams.
 *
 * Response shape matches the unsub-log rows so the same FE component
 * can render both.
 */
router.get("/founder/product-refunds", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      productId: z.string().optional(),
      search: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => Math.min(Math.max(v ? parseInt(v, 10) : 25, 1), 100)),
      skip: z
        .string()
        .optional()
        .transform((v) => Math.max(v ? parseInt(v, 10) : 0, 0)),
    });
    const { orgId, productId, search, from, to, limit, skip } = schema.parse(
      req.query
    );

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can view product refunds",
      });
    }

    const orgObjectId = new Types.ObjectId(orgId);

    // Fetch the org's products up-front to (a) serve the filter
    // dropdown, (b) resolve product titles without an N+1 lookup,
    // (c) validate the productId param against org ownership.
    // Product uses `organizationId` (not `orgId`) and its display field
    // is `name` (not `title`) — see models/product.model.ts:57,105.
    const orgProducts = await Product.find({ organizationId: orgObjectId })
      .select("name")
      .sort({ name: 1 })
      .lean();
    const orgProductIds = orgProducts.map((p: any) => p._id);
    const titleById = new Map<string, string>();
    for (const p of orgProducts as any[]) {
      titleById.set(p._id.toString(), p.title || p.name);
    }

    const query: Record<string, any> = {
      organizationId: orgObjectId,
      status: { $in: ["refunded", "cancelled"] },
    };

    // productId filter — comma-separated, intersected with org ownership
    // so a founder can't peek at another org's refund log.
    if (productId) {
      const rawIds = productId
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const pids: Types.ObjectId[] = [];
      for (const raw of rawIds) {
        if (!Types.ObjectId.isValid(raw)) {
          return res.status(400).json({
            success: false,
            error: "productId must be a valid ObjectId",
          });
        }
        const pid = new Types.ObjectId(raw);
        const isOwn = orgProductIds.some((id: any) => id.equals(pid));
        if (!isOwn) {
          return res
            .status(400)
            .json({ success: false, error: "productId is not in this org" });
        }
        pids.push(pid);
      }
      query["items.productId"] = pids.length === 1 ? pids[0] : { $in: pids };
    } else {
      query["items.productId"] = { $in: orgProductIds };
    }

    if (from || to) {
      // ProductOrder doesn't have a dedicated refundedAt/cancelledAt
      // column, so filter on updatedAt (which the status transition
      // wrote). Best available signal without a schema change.
      query.updatedAt = {} as Record<string, Date>;
      if (from) query.updatedAt.$gte = new Date(from);
      if (to) query.updatedAt.$lte = new Date(to);
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      query.$or = [
        { orderNumber: rx },
        { "items.productName": rx },
      ];
    }

    const [rows, total] = await Promise.all([
      ProductOrder.find(query)
        .populate("userId", "name email")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductOrder.countDocuments(query),
    ]);

    const events = rows.map((r: any) => {
      const firstItem = r.items?.[0];
      const pidStr = firstItem?.productId?.toString?.() ?? null;
      const user = r.userId as any;
      return {
        _id: r._id.toString(),
        userId: user?._id ? user._id.toString() : null,
        // Match the unsub-log shape so the FE component can render both.
        itemKind: "product" as const,
        productId: pidStr,
        productTitle: pidStr
          ? titleById.get(pidStr) || firstItem?.productName || null
          : firstItem?.productName || null,
        eventType: r.status === "cancelled" ? "cancelled" : "refunded",
        occurredAt: r.updatedAt,
        orderNumber: r.orderNumber,
        totalAmount: r.total,
        currency: r.currency,
        customerName: user?.name || null,
        customerEmail: user?.email || null,
      };
    });

    res.json({
      success: true,
      events,
      total,
      limit,
      skip,
      hasMore: skip + events.length < total,
      products: orgProducts.map((p: any) => ({
        _id: p._id.toString(),
        title: p.title,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues[0]?.message || "Invalid query",
      });
    }
    console.error("Error listing product refunds for founder:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list product refunds",
      details: (error as Error).message,
    });
  }
});

// ============= Repost Endpoints =============

/**
 * POST /feed/posts/:postId/repost
 * Toggle repost on a post
 */
router.post("/posts/:postId/repost", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { postId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const result = await toggleRepost(postId, me.userId, orgId);

    // Emit real-time update
    const io = getSocketInstance();
    if (io) {
      io.to(`post:${postId}`).emit("feed:post-reposted", {
        postId,
        repostsCount: result.repostsCount,
        userId: me.userId,
        reposted: result.reposted,
      });
    }

    // Un-reposting is silent, same as un-liking.
    if (result.reposted) {
      notifyFeedEngagement(postId, me.userId, { kind: "repost" });
    }

    res.json({
      success: true,
      reposted: result.reposted,
      repostsCount: result.repostsCount,
    });
  } catch (error) {
    console.error("Error toggling repost:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle repost",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/posts/:postId/reposts
 * Get users who reposted a post
 */
router.get("/posts/:postId/reposts", requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const schema = z.object({
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });
    const { limit, offset } = schema.parse(req.query);

    const result = await getPostReposts(postId, { limit, offset });

    res.json({
      success: true,
      reposts: result.reposts,
      total: result.total,
    });
  } catch (error) {
    console.error("Error getting reposts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get reposts",
      details: (error as Error).message,
    });
  }
});

// ============= Bookmark Endpoints =============

/**
 * POST /feed/posts/:postId/bookmark
 * Toggle bookmark on a post
 */
router.post("/posts/:postId/bookmark", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { postId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const result = await toggleBookmark(postId, me.userId, orgId);

    res.json({
      success: true,
      bookmarked: result.bookmarked,
      message: result.message,
    });
  } catch (error) {
    console.error("Error toggling bookmark:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle bookmark",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/bookmarks
 * Get user's bookmarked posts
 */
router.get("/bookmarks", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });
    const { orgId, limit, offset } = schema.parse(req.query);

    const result = await getUserBookmarks(me.userId, orgId, { limit, offset });

    res.json({
      success: true,
      posts: result.posts,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error getting bookmarks:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get bookmarks",
      details: (error as Error).message,
    });
  }
});

// ============= Quote Post Endpoints =============

/**
 * POST /feed/posts/quote
 * Create a quote post (post that quotes another post)
 */
router.post("/posts/quote", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const schema = z.object({
      content: z.string().min(1),
      channelIds: z.array(z.string()).min(1),
      quotedPostId: z.string(),
      tags: z.array(z.string().max(50)).optional(),
      attachments: z
        .array(
          z.object({
            type: z.enum(["image", "video", "document", "audio"]),
            url: z.string(),
            name: z.string(),
            fileKey: z.string().optional(),
          })
        )
        .optional(),
      linkPreviews: z
        .array(
          z.object({
            url: z.string(),
            title: z.string().optional(),
            description: z.string().optional(),
            image: z.string().nullable().optional(),
            siteName: z.string().optional(),
            showThumbnail: z.boolean().optional(),
          })
        )
        .optional(),
    });
    const { content, channelIds, quotedPostId, tags, attachments, linkPreviews } =
      schema.parse(req.body);

    // Check if user can post to these channels
    const isFounder = await isUserFounder(me.userId, orgId);
    const { canPost, invalidChannels, restrictedChannels } = await canUserPostToChannels(
      me.userId,
      orgId,
      channelIds,
      isFounder
    );

    if (!canPost) {
      const isRestricted = restrictedChannels && restrictedChannels.length > 0;
      return res.status(403).json({
        success: false,
        error: isRestricted
          ? "You are restricted from posting in this community"
          : "You are not subscribed to some channels",
        invalidChannels,
        restrictedChannels,
      });
    }

    const post = await createQuotePost({
      content,
      authorId: me.userId,
      orgId,
      channelIds,
      quotedPostId,
      tags,
      attachments,
      linkPreviews,
    });

    // Populate the post for response (including quoted post)
    const populatedPost = await getPostWithQuote(
      post._id.toString(),
      me.userId
    );

    // Emit real-time event
    const io = getSocketInstance();
    if (io) {
      channelIds.forEach((channelId) => {
        io.to(`channel:${channelId}`).emit("feed:new-post", {
          post: populatedPost,
        });
      });
      io.to(`org:${orgId}:feed`).emit("feed:new-post", {
        post: populatedPost,
      });
    }

    // Tell the quoted post's author. The deep link points at the NEW post
    // rather than at `quotedPostId`, because what they want to see is the
    // quote, not their own post again — so the recipient is passed explicitly
    // instead of being resolved from the post in the link.
    {
      const quotedAuthor = (populatedPost as any)?.quotedPostId?.authorId;
      const quotedAuthorId = quotedAuthor
        ? String(quotedAuthor._id ?? quotedAuthor)
        : null;
      if (quotedAuthorId) {
        notifyFeedEngagement(
          post._id.toString(),
          me.userId,
          { kind: "quote", text: content },
          quotedAuthorId
        );
      }
    }

    res.status(201).json({
      success: true,
      message: "Quote post created successfully",
      post: populatedPost,
    });
  } catch (error) {
    console.error("Error creating quote post:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create quote post",
      details: (error as Error).message,
    });
  }
});

// ============= Share Link Endpoint =============

/**
 * GET /feed/posts/:postId/share
 * Get a shareable link for a post
 */
router.get("/posts/:postId/share", requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
    const userId = (req as any).user.userId;

    // Verify post exists
    const post = await getPostById(postId, userId);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    // Check if post is an article to generate the correct share path
    const postType = (post as any).postType || "post";

    // Fetch org slug and user's affiliateId in parallel
    const [org, user] = await Promise.all([
      Organization.findById(orgId).select("slug").lean(),
      User.findById(userId).select("affiliateId").lean(),
    ]);

    const orgSlug = (org as any)?.slug || orgId;
    const affiliateId = (user as any)?.affiliateId;

    const frontendUrl = process.env.FRONTEND_URL || "https://app.roam.com";
    const shareLink = generateShareLink(postId, orgSlug, frontendUrl, affiliateId, postType);

    res.json({
      success: true,
      shareLink,
      postId,
    });
  } catch (error) {
    console.error("Error generating share link:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate share link",
      details: (error as Error).message,
    });
  }
});

// ============= Video Share Link Endpoint =============

/**
 * GET /feed/videos/:videoId/share
 * Get a shareable link for a video (standalone or workshop)
 * Includes affiliate referral code for "join community" flow
 */
router.get("/videos/:videoId/share", requireAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { orgId, videoType, recordingId } = z
      .object({
        orgId: z.string(),
        videoType: z.enum(["standalone", "workshop"]),
        recordingId: z.string().optional(),
      })
      .parse(req.query);
    const userId = (req as any).user.userId;

    // Verify video exists based on type
    if (videoType === "standalone") {
      const { StandaloneVideo } = await import(
        "../models/standaloneVideo.model"
      );
      const video = await StandaloneVideo.findById(videoId).lean();
      if (!video) {
        return res
          .status(404)
          .json({ success: false, error: "Video not found" });
      }
    } else {
      const { Workshop } = await import("../models/workshop.model");
      const video = await Workshop.findById(videoId).lean();
      if (!video) {
        return res
          .status(404)
          .json({ success: false, error: "Livestream not found" });
      }
    }

    // Fetch org slug and user's affiliateId in parallel
    const [org, user] = await Promise.all([
      Organization.findById(orgId).select("slug").lean(),
      User.findById(userId).select("affiliateId").lean(),
    ]);

    const orgSlug = (org as any)?.slug || orgId;
    const affiliateId = (user as any)?.affiliateId;

    const frontendUrl = process.env.FRONTEND_URL || "https://app.roam.com";
    // Canonical deep-link shape (/hq/…?src=) so the mobile app opens video
    // links directly; ?src tells it standalone vs workshop. Compound
    // workshop__recording cards add ?rec=<recordingId>: the app plays that
    // exact recording, and the web /hq fallback forwards to the dedicated
    // /guest/{slug}/recording/{rec} page.
    const base = recordingId
      ? `${frontendUrl}/hq/${orgSlug}/video/${videoId}?src=workshop&rec=${recordingId}`
      : `${frontendUrl}/hq/${orgSlug}/video/${videoId}?src=${videoType}`;
    const shareLink = affiliateId
      ? `${base}${base.includes("?") ? "&" : "?"}referCode=${affiliateId}`
      : base;

    res.json({
      success: true,
      shareLink,
      videoId,
    });
  } catch (error) {
    console.error("Error generating video share link:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate video share link",
      details: (error as Error).message,
    });
  }
});

// ============= Trending Hashtags Endpoints =============

// ============= Playlist Share Link Endpoint =============

/**
 * GET /feed/playlists/:playlistId/share
 * Get a shareable link for a playlist
 * Includes affiliate referral code for "join community" flow
 */
router.get("/playlists/:playlistId/share", requireAuth, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { orgId } = z
      .object({
        orgId: z.string(),
      })
      .parse(req.query);
    const userId = (req as any).user.userId;

    // Verify playlist exists
    const { Playlist } = await import("../models/playlist.model");
    const playlist = await Playlist.findById(playlistId).lean();
    if (!playlist) {
      return res
        .status(404)
        .json({ success: false, error: "Playlist not found" });
    }

    // Fetch org slug and user's affiliateId in parallel
    const [org, user] = await Promise.all([
      Organization.findById(orgId).select("slug").lean(),
      User.findById(userId).select("affiliateId").lean(),
    ]);

    const orgSlug = (org as any)?.slug || orgId;
    const affiliateId = (user as any)?.affiliateId;

    const frontendUrl = process.env.FRONTEND_URL || "https://app.roam.com";
    // Canonical deep-link shape — see the post share endpoint above.
    const base = `${frontendUrl}/hq/${orgSlug}/playlist/${playlistId}`;
    const shareLink = affiliateId
      ? `${base}?referCode=${affiliateId}`
      : base;

    res.json({
      success: true,
      shareLink,
      playlistId,
    });
  } catch (error) {
    console.error("Error generating playlist share link:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate playlist share link",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/trending/tags
 * Get trending hashtags in the organization
 */
router.get("/trending/tags", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 10)),
      timeRange: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 7)),
    });
    const { orgId, limit, timeRange } = schema.parse(req.query);

    const trending = await getTrendingTags(orgId, { limit, timeRange });

    res.json({
      success: true,
      trending,
    });
  } catch (error) {
    console.error("Error getting trending tags:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get trending tags",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/search/tag/:tag
 * Search posts by hashtag
 */
router.get("/search/tag/:tag", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { tag } = req.params;
    const schema = z.object({
      orgId: z.string(),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });
    const { orgId, limit, offset } = schema.parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);

    const result = await searchPostsByTag(orgId, tag, me.userId, {
      limit,
      offset,
      isFounder,
    });

    res.json({
      success: true,
      tag,
      posts: result.posts,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error searching posts by tag:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search posts",
      details: (error as Error).message,
    });
  }
});

// ============= Poll Endpoints =============

/**
 * POST /feed/posts/poll
 * Create a post with a poll
 */
router.post("/posts/poll", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const schema = z.object({
      content: z.string().max(5000).optional().default(""),
      channelIds: z.array(z.string()).min(1),
      tags: z.array(z.string().max(50)).optional(),
      poll: z.object({
        question: z.string().min(1).max(280),
        options: z.array(z.string().min(1).max(100)).min(2).max(4),
        durationHours: z.number().min(1).max(168), // Max 7 days
        isMultipleChoice: z.boolean().optional(),
      }),
    });
    const {
      content,
      channelIds,
      tags,
      poll: pollData,
    } = schema.parse(req.body);

    // Check if user can post to these channels
    const isFounder = await isUserFounder(me.userId, orgId);
    const { canPost, invalidChannels, restrictedChannels } = await canUserPostToChannels(
      me.userId,
      orgId,
      channelIds,
      isFounder
    );

    if (!canPost) {
      const isRestricted = restrictedChannels && restrictedChannels.length > 0;
      return res.status(403).json({
        success: false,
        error: isRestricted
          ? "You are restricted from posting in this community"
          : "You are not subscribed to some channels",
        invalidChannels,
        restrictedChannels,
      });
    }

    // Get potential users for mention parsing
    const channelMemberships = await ChannelMembership.find({
      channelId: { $in: channelIds.map((id) => new Types.ObjectId(id)) },
      orgId: new Types.ObjectId(orgId),
      status: "active",
    })
      .select("userId")
      .lean();
    const memberUserIds = [
      ...new Set(channelMemberships.map((m) => m.userId.toString())),
    ];
    const potentialUsers = await User.find({
      _id: { $in: memberUserIds },
    })
      .select("_id name email")
      .lean();

    const postContent = content || pollData.question;
    // Parse mentions (exclude the author from mentions)
    const mentionedUserIds = parseMentions(postContent, potentialUsers, me.userId);

    // Create the post first
    const { createPost: createPostFn } = await import("../services/feed");
    const post = await createPostFn({
      content: postContent,
      authorId: me.userId,
      orgId,
      channelIds,
      tags,
      mentions: mentionedUserIds,
    });

    // Create the poll
    const poll = await createPoll({
      postId: post._id.toString(),
      orgId,
      question: pollData.question,
      options: pollData.options,
      durationHours: pollData.durationHours,
      isMultipleChoice: pollData.isMultipleChoice,
    });

    // Get populated post
    const populatedPost = await getPostById(post._id.toString(), me.userId);

    // Emit real-time event
    const io = getSocketInstance();
    if (io) {
      channelIds.forEach((channelId) => {
        io.to(`channel:${channelId}`).emit("feed:new-post", {
          post: { ...populatedPost, poll },
        });
      });
      io.to(`org:${orgId}:feed`).emit("feed:new-post", {
        post: { ...populatedPost, poll },
      });
    }

    // Create notifications for mentioned users
    if (mentionedUserIds.length > 0) {
      createPostMentionNotifications(
        post._id.toString(),
        me.userId,
        orgId,
        postContent,
        mentionedUserIds,
        channelIds[0]
      ).catch((err) =>
        console.error("Failed to create poll post mention notifications:", err)
      );
    }

    res.status(201).json({
      success: true,
      message: "Poll created successfully",
      post: populatedPost,
      poll,
    });
  } catch (error) {
    console.error("Error creating poll:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create poll",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/posts/:postId/poll
 * Get poll for a post
 */
router.get("/posts/:postId/poll", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { postId } = req.params;

    const poll = await getPollByPostId(postId, me.userId);

    if (!poll) {
      return res.status(404).json({
        success: false,
        error: "Poll not found for this post",
      });
    }

    res.json({
      success: true,
      poll,
    });
  } catch (error) {
    console.error("Error getting poll:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get poll",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /feed/polls/:pollId/vote
 * Vote on a poll
 */
router.post("/polls/:pollId/vote", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { pollId } = req.params;

    const schema = z.object({
      optionIds: z.array(z.string()).min(1),
    });
    const { optionIds } = schema.parse(req.body);

    const result = await votePoll(pollId, me.userId, optionIds);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }

    // Emit real-time update
    const io = getSocketInstance();
    if (io && result.poll) {
      io.to(`post:${result.poll.postId}`).emit("feed:poll-voted", {
        pollId,
        poll: result.poll,
      });
    }

    res.json({
      success: true,
      message: result.message,
      poll: result.poll,
    });
  } catch (error) {
    console.error("Error voting on poll:", error);
    res.status(500).json({
      success: false,
      error: "Failed to vote on poll",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/polls/:pollId/results
 * Get poll results
 */
router.get("/polls/:pollId/results", requireAuth, async (req, res) => {
  try {
    const { pollId } = req.params;

    const { poll, results } = await getPollResults(pollId);

    res.json({
      success: true,
      poll,
      results,
    });
  } catch (error) {
    console.error("Error getting poll results:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get poll results",
      details: (error as Error).message,
    });
  }
});

// ============= Admin: Clean corrupted article hrefs =============

/**
 * POST /feed/admin/clean-article-hrefs
 * One-time migration endpoint to fix existing articles that have HTML tags
 * leaked into their link href attributes (from bold/italic applied to links).
 * Founder-only access.
 */
router.post("/admin/clean-article-hrefs", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.body);

    // Only founders can run this
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can run this cleanup",
      });
    }

    const { Post } = await import("../models/post.model");

    // Helper to clean a single URL that may have HTML tags in it
    function cleanUrl(url: string): string {
      let clean = url.replace(/<[^>]*>/g, "");
      clean = clean.replace(/[>"']+$/, "");
      const urlMatch = clean.match(/^(https?:\/\/[^\s"'<>]+)/i);
      return urlMatch ? urlMatch[1] : clean.trim();
    }

    // Find all posts in this org that might have corrupted content or linkPreviews
    const posts = await Post.find({
      orgId: new Types.ObjectId(orgId),
      isActive: true,
      $or: [
        { postType: "article", content: { $regex: /href=/i } },
        { "linkPreviews.url": { $regex: /</ } },
      ],
    }).select("_id content postType linkPreviews");

    let cleanedContent = 0;
    let cleanedPreviews = 0;
    let skipped = 0;

    for (const post of posts) {
      const updates: Record<string, any> = {};

      // Clean href attributes in article content
      if (post.postType === "article" && post.content) {
        const fixedContent = cleanHrefsInHtml(post.content);
        if (fixedContent !== post.content) {
          updates.content = fixedContent;
          cleanedContent++;
        }
      }

      // Clean linkPreviews URLs
      if (post.linkPreviews && post.linkPreviews.length > 0) {
        let previewsChanged = false;
        const fixedPreviews = (post.linkPreviews as any[]).map((lp: any) => {
          const fixedUrl = cleanUrl(lp.url);
          if (fixedUrl !== lp.url) {
            previewsChanged = true;
            return { ...lp, url: fixedUrl };
          }
          return lp;
        });
        if (previewsChanged) {
          updates.linkPreviews = fixedPreviews;
          cleanedPreviews++;
        }
      }

      if (Object.keys(updates).length > 0) {
        await Post.updateOne(
          { _id: post._id },
          { $set: updates }
        );
        console.log(`[clean-article-hrefs] Fixed post ${post._id} (content: ${!!updates.content}, previews: ${!!updates.linkPreviews})`);
      } else {
        skipped++;
      }
    }

    console.log(
      `[clean-article-hrefs] Done. Scanned: ${posts.length}, Content fixed: ${cleanedContent}, Previews fixed: ${cleanedPreviews}, Skipped: ${skipped}`
    );

    res.json({
      success: true,
      message: `Scanned ${posts.length} post(s). Fixed ${cleanedContent} article content(s) and ${cleanedPreviews} link preview URL(s). ${skipped} were already clean.`,
      stats: {
        scanned: posts.length,
        cleanedContent,
        cleanedPreviews,
        skipped,
      },
    });
  } catch (error) {
    console.error("Error cleaning article hrefs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clean article hrefs",
      details: (error as Error).message,
    });
  }
});

// ============================================
// FEED ACTIVITY
// ============================================
// Engagement on the caller's OWN content — the Activity screen. Mounted under
// the existing /feed router, so app.ts needs no change. These sit below every
// /posts/* route and collide with nothing: there is no root-level /:param here.

/**
 * GET /feed/activity
 * Likes, comments, mentions, saves and reposts on the caller's own posts.
 *
 * `total` is opt-in via `withTotal=1` — counting means five countDocuments, and
 * the scrolling path does not need it. With `type` set, the total is for that
 * type only.
 */
router.get("/activity", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      // Derived from the service's own list rather than restated here — the
      // hardcoded copy had already drifted, and a filter the service happily
      // serves was being rejected at the door with a 400.
      type: z
        .enum(FEED_ACTIVITY_TYPES as [FeedActivityType, ...FeedActivityType[]])
        .optional(),
      withTotal: z
        .string()
        .optional()
        .transform((v) => v === "1" || v === "true"),
      limit: z
        .string()
        .optional()
        .transform((v) => Math.min(v ? parseInt(v, 10) : 30, 50)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });
    const { orgId, type, withTotal, limit, offset } = schema.parse(req.query);

    const result = await getFeedActivity(me.userId, orgId, {
      limit,
      offset,
      type,
      withTotal,
    });

    res.json({
      success: true,
      activity: result.activity,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching feed activity:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch activity",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /feed/activity/unread-count
 * Badge count. Cached ~30s per {user, org} — mobile polls this hard and the
 * uncached path is five countDocuments.
 */
router.get("/activity/unread-count", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
    const count = await getUnreadActivityCount(me.userId, orgId);
    res.json({ success: true, count });
  } catch (error) {
    console.error("Error fetching activity unread count:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch unread count",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /feed/activity/read-all
 * Marks everything up to now as read, PER ORG — reading activity in one office
 * must not clear the badge in another.
 */
router.post("/activity/read-all", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
    await markActivityRead(me.userId, orgId);
    res.json({ success: true, ok: true });
  } catch (error) {
    console.error("Error marking activity read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark activity read",
      details: (error as Error).message,
    });
  }
});

export default router;
