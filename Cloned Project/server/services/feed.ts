import { Types } from "mongoose";
import mongoose from "mongoose";
import { Post, IPost, IReactionsCount } from "../models/post.model";
import { PostLike, ReactionType, REACTION_TYPES } from "../models/postLike.model";
import { PostComment } from "../models/postComment.model";
import { PostCommentLike } from "../models/postCommentLike.model";
import { PostRepost } from "../models/postRepost.model";
import { PostBookmark } from "../models/postBookmark.model";
import { Poll } from "../models/poll.model";
import { PollVote } from "../models/pollVote.model";
import { Channel } from "../models/channel.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { User } from "../models/user.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Notification } from "../models/notification.model";
import { UserNotification } from "../models/userNotification.model";
import { parseMentions } from "../utils/mentions";
import { getSocketInstance } from "./socket";

// ============= Post Functions =============

export interface CreatePostData {
  content: string;
  authorId: string;
  orgId: string;
  channelIds: string[];
  tags?: string[];
  mentions?: string[]; // Pre-parsed mention user IDs
  attachments?: {
    type: "image" | "video" | "document" | "audio";
    url: string;
    name: string;
    fileKey?: string;
  }[];
  linkPreviews?: {
    url: string;
    title?: string;
    description?: string;
    image?: string | null;
    siteName?: string;
    showThumbnail?: boolean;
  }[];
  // Article fields
  postType?: "post" | "article";
  title?: string;
  coverImage?: string;
}

/**
 * Generate a URL-friendly slug from a title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-word chars except spaces and hyphens
    .replace(/\s+/g, "-") // replace spaces with hyphens
    .replace(/-+/g, "-") // collapse consecutive hyphens
    .substring(0, 80); // limit length
}

/**
 * Calculate estimated reading time in minutes (based on ~200 wpm)
 */
function calculateReadingTime(content: string): number {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Create a new post
 */
export async function createPost(data: CreatePostData): Promise<IPost> {
  // Build post data - only include linkPreviews if explicitly provided (even if empty array)
  const postData: any = {
    content: data.content,
    authorId: new Types.ObjectId(data.authorId),
    orgId: new Types.ObjectId(data.orgId),
    channelIds: data.channelIds.map((id) => new Types.ObjectId(id)),
    tags: data.tags || [],
    mentions: (data.mentions || []).map((id) => new Types.ObjectId(id)),
    attachments: data.attachments || [],
    postType: data.postType || "post",
  };

  // Only add linkPreviews if it was explicitly provided (distinguishes from old posts without this field)
  if (data.linkPreviews !== undefined) {
    postData.linkPreviews = data.linkPreviews;
  }

  // Article-specific fields
  if (data.postType === "article") {
    if (data.title) {
      postData.title = data.title;
      // Generate slug with random suffix to avoid collisions
      const baseSlug = generateSlug(data.title);
      const suffix = Math.random().toString(36).substring(2, 6);
      postData.slug = `${baseSlug}-${suffix}`;
    }
    if (data.coverImage) {
      postData.coverImage = data.coverImage;
    }
    postData.readingTimeMinutes = calculateReadingTime(data.content);
  }

  const post = await Post.create(postData);

  return post;
}

/**
 * Create notifications for mentioned users in a post
 * Only notifies users who are members of the channel
 */
export async function createPostMentionNotifications(
  postId: string,
  authorId: string,
  orgId: string,
  content: string,
  mentionedUserIds: string[],
  channelId?: string
): Promise<void> {
  if (mentionedUserIds.length === 0) return;

  const io = getSocketInstance();

  // Get author info
  const author = await User.findById(authorId)
    .select("name email profilePicture")
    .lean();
  const authorName = author?.name || author?.email || "Someone";

  // Get channel info if provided
  let channelName = "a channel";
  if (channelId) {
    const channel = await Channel.findById(channelId).select("title").lean();
    channelName = (channel as any)?.title || "a channel";
  }

  // Filter mentioned users to only those who are members of the channel
  let eligibleUserIds = mentionedUserIds;
  if (channelId) {
    const channelMemberships = await ChannelMembership.find({
      channelId: new Types.ObjectId(channelId),
      userId: { $in: mentionedUserIds.map((id) => new Types.ObjectId(id)) },
      status: "active",
    })
      .select("userId")
      .lean();

    const memberUserIds = new Set(
      channelMemberships.map((m) => m.userId.toString())
    );
    eligibleUserIds = mentionedUserIds.filter((id) => memberUserIds.has(id));

    if (eligibleUserIds.length === 0) return;
  }

  const truncatedContent = content
    ? content.substring(0, 100) + (content.length > 100 ? "..." : "")
    : "Shared a post";

  for (const mentionedUserId of eligibleUserIds) {
    // Don't notify the author
    if (mentionedUserId === authorId) continue;

    try {
      // Create Notification record (high-priority notification hub)
      await Notification.create({
        userId: new Types.ObjectId(mentionedUserId),
        orgId: new Types.ObjectId(orgId),
        type: "post_mention",
        priority: "high",
        title: `${authorName} mentioned you in a post`,
        message: truncatedContent,
        data: {
          postId,
          channelId,
          channelName,
          authorId,
          authorName,
        },
        isRead: false,
      });

      // Create UserNotification record
      await UserNotification.create({
        userId: new Types.ObjectId(mentionedUserId),
        orgId: new Types.ObjectId(orgId),
        type: "post_mention",
        postId: new Types.ObjectId(postId),
        postAuthorId: new Types.ObjectId(authorId),
        postAuthorName: author?.name,
        postAuthorEmail: author?.email,
        postAuthorPicture: author?.profilePicture,
        postContent: truncatedContent,
        channelId: channelId ? new Types.ObjectId(channelId) : undefined,
        channelName,
        read: false,
        cleared: false,
      });

      // Emit real-time notification
      if (io) {
        io.to(`user:${mentionedUserId}`).emit("notification:new", {
          type: "post_mention",
          priority: "high",
          title: `${authorName} mentioned you in a post`,
          message: truncatedContent,
          data: {
            postId,
            channelId,
            channelName,
            authorId,
            authorName,
            authorPicture: author?.profilePicture,
          },
        });
      }

      // The socket emit above only lands if the app is already open. This is
      // what reaches a phone in a pocket — and until now nothing did, which is
      // why a feed mention was invisible outside a live session.
      const { sendFeedEngagementPushNotification } = await import(
        "./pushNotification"
      );
      await sendFeedEngagementPushNotification(
        mentionedUserId,
        {
          id: authorId,
          name: author?.name || author?.email,
          avatar: author?.profilePicture,
        },
        { id: postId, content },
        { kind: "mention", surface: "post", text: truncatedContent }
      );
    } catch (notifError) {
      console.error(
        `Failed to create notification for mentioned user ${mentionedUserId}:`,
        notifError
      );
    }
  }
}

/**
 * Get posts for a user based on their channel memberships
 * Founders see all posts in the org
 */
export async function getPosts(
  userId: string,
  orgId: string,
  options: {
    channelId?: string;
    postType?: 'post' | 'article';
    authorId?: string;
    limit?: number;
    offset?: number;
    isFounder?: boolean;
  } = {}
): Promise<{
  posts: any[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}> {
  const { channelId, postType, authorId, limit = 20, offset = 0, isFounder = false } = options;

  let channelFilter: Types.ObjectId[] = [];

  if (channelId) {
    // Filter by specific channel
    channelFilter = [new Types.ObjectId(channelId)];
  } else if (isFounder) {
    // Founders see all posts in the org - get all org channels
    const orgChannels = await Channel.find({ storeId: orgId, isActive: true })
      .select("_id")
      .lean();
    channelFilter = orgChannels.map((c) => c._id as Types.ObjectId);
  } else {
    // Get user's subscribed channels
    const memberships = await ChannelMembership.find({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      status: "active",
    })
      .select("channelId")
      .lean();
    channelFilter = memberships.map((m) => m.channelId as Types.ObjectId);
  }

  if (channelFilter.length === 0) {
    return {
      posts: [],
      total: 0,
      pagination: { limit, offset, hasMore: false },
    };
  }

  const filter: any = {
    orgId: new Types.ObjectId(orgId),
    channelIds: { $in: channelFilter },
    isActive: true,
  };
  if (postType) {
    filter.postType = postType;
  }
  if (authorId) {
    filter.authorId = new Types.ObjectId(authorId);
  }

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("authorId", "name email profilePicture")
      .populate("channelIds", "title")
      .populate({
        path: "quotedPostId",
        match: { isActive: true },
        populate: [
          { path: "authorId", select: "name email profilePicture" },
          { path: "channelIds", select: "title" },
        ],
      })
      .lean(),
    Post.countDocuments(filter),
  ]);

  // Check if current user has liked, bookmarked, or reposted each post
  const postIds = posts.map((p) => p._id);

  // Get posts with polls
  const postsWithPolls = posts.filter((p) => p.hasPoll);
  const pollPostIds = postsWithPolls.map((p) => p._id);

  // First fetch polls to get their actual IDs
  const polls: any[] =
    pollPostIds.length > 0
      ? await Poll.find({ postId: { $in: pollPostIds } }).lean()
      : [];

  const pollIds = polls.map((p) => p._id);

  const [userLikes, userBookmarks, userReposts, bookmarkCounts, userPollVotes] =
    await Promise.all([
      PostLike.find({
        postId: { $in: postIds },
        userId: new Types.ObjectId(userId),
      })
        .select("postId reactionType")
        .lean(),
      PostBookmark.find({
        postId: { $in: postIds },
        userId: new Types.ObjectId(userId),
      })
        .select("postId")
        .lean(),
      PostRepost.find({
        postId: { $in: postIds },
        userId: new Types.ObjectId(userId),
      })
        .select("postId")
        .lean(),
      PostBookmark.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: "$postId", count: { $sum: 1 } } },
      ]),
      // Fetch user's votes using actual poll IDs (not post IDs)
      pollIds.length > 0
        ? PollVote.find({
            pollId: { $in: pollIds },
            userId: new Types.ObjectId(userId),
          }).lean()
        : Promise.resolve([]),
    ]);

  const likedPostIds = new Set(userLikes.map((l) => l.postId.toString()));
  const bookmarkedPostIds = new Set(
    userBookmarks.map((b) => b.postId.toString())
  );
  const repostedPostIds = new Set(userReposts.map((r) => r.postId.toString()));
  const bookmarkCountMap = new Map(
    bookmarkCounts.map((b: any) => [b._id.toString(), b.count])
  );

  // Create poll map by postId
  const pollsByPostId = new Map(
    polls.map((poll: any) => [poll.postId.toString(), poll])
  );

  // Create user poll votes map by pollId
  const userVotesByPollId = new Map(
    userPollVotes.map((vote: any) => [vote.pollId.toString(), vote.optionIds])
  );

  // Create a map of postId -> reactionType for userReaction field
  const userReactionMap = new Map(
    userLikes.map((l) => [l.postId.toString(), l.reactionType])
  );

  const postsWithStatus = posts.map((post) => {
    const postIdStr = post._id.toString();
    const poll = pollsByPostId.get(postIdStr);

    let pollData = null;
    if (poll) {
      const isExpired = new Date() > poll.endsAt;
      const userVotedOptions = userVotesByPollId.get(poll._id.toString()) || [];
      pollData = {
        ...poll,
        hasVoted: userVotedOptions.length > 0,
        userVotedOptions,
        isExpired,
      };
    }

    return {
      ...post,
      isPinned: post.isPinned || false,
      hasLiked: likedPostIds.has(postIdStr),
      userReaction: userReactionMap.get(postIdStr) || null,
      hasBookmarked: bookmarkedPostIds.has(postIdStr),
      hasReposted: repostedPostIds.has(postIdStr),
      bookmarksCount: bookmarkCountMap.get(postIdStr) || 0,
      poll: pollData,
    };
  });

  return {
    posts: postsWithStatus,
    total,
    pagination: {
      limit,
      offset,
      hasMore: offset + posts.length < total,
    },
  };
}

/**
 * Get a single post by ID
 */
export async function getPostById(
  postId: string,
  userId: string
): Promise<any | null> {
  const post = await Post.findById(postId)
    .populate("authorId", "name email profilePicture")
    .populate("channelIds", "title")
    .populate({
      path: "quotedPostId",
      match: { isActive: true },
      populate: [
        { path: "authorId", select: "name email profilePicture" },
        { path: "channelIds", select: "title" },
      ],
    })
    .lean();

  if (!post) return null;

  // Check if user has liked, bookmarked, or reposted this post
  const [
    userLike,
    userBookmark,
    userRepost,
    bookmarksCount,
    poll,
    userPollVote,
  ] = await Promise.all([
    PostLike.findOne({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
    }).lean(),
    PostBookmark.findOne({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
    }).lean(),
    PostRepost.findOne({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
    }).lean(),
    PostBookmark.countDocuments({
      postId: new Types.ObjectId(postId),
    }),
    // Fetch poll if post has one
    post.hasPoll
      ? Poll.findOne({ postId: new Types.ObjectId(postId) }).lean()
      : Promise.resolve(null),
    // Fetch user's vote if post has a poll
    post.hasPoll
      ? PollVote.findOne({
          pollId: { $exists: true },
          userId: new Types.ObjectId(userId),
        }).lean()
      : Promise.resolve(null),
  ]);

  // Build poll data if exists
  let pollData = null;
  if (poll) {
    // Need to get user's vote for this specific poll
    const actualUserVote = await PollVote.findOne({
      pollId: poll._id,
      userId: new Types.ObjectId(userId),
    }).lean();

    const isExpired = new Date() > poll.endsAt;
    pollData = {
      ...poll,
      hasVoted: !!actualUserVote,
      userVotedOptions: actualUserVote?.optionIds || [],
      isExpired,
    };
  }

  return {
    ...post,
    hasLiked: !!userLike,
    userReaction: userLike?.reactionType || null,
    hasBookmarked: !!userBookmark,
    hasReposted: !!userRepost,
    bookmarksCount,
    poll: pollData,
  };
}

/**
 * Update a post
 */
export async function updatePost(
  postId: string,
  authorId: string,
  data: {
    content?: string;
    channelIds?: string[];
    tags?: string[];
    linkPreviews?: {
      url: string;
      title?: string;
      description?: string;
      image?: string | null;
      siteName?: string;
      showThumbnail?: boolean;
    }[];
    // Article fields
    title?: string;
    coverImage?: string;
  }
): Promise<IPost | null> {
  // Build update object - only include fields that are provided
  const updateData: any = {};
  if (data.content !== undefined) {
    updateData.content = data.content;
    // Recalculate reading time if content changed
    updateData.readingTimeMinutes = calculateReadingTime(data.content);
  }
  if (data.channelIds !== undefined) {
    updateData.channelIds = data.channelIds.map(
      (id: string) => new Types.ObjectId(id)
    );
  }
  if (data.tags !== undefined) {
    updateData.tags = data.tags;
  }
  if (data.linkPreviews !== undefined) {
    updateData.linkPreviews = data.linkPreviews;
  }
  // Article fields
  const unsetFields: Record<string, 1> = {};
  if (data.title !== undefined) {
    if (data.title) {
      updateData.title = data.title;
    } else {
      unsetFields.title = 1;
    }
  }
  if (data.coverImage !== undefined) {
    if (data.coverImage) {
      updateData.coverImage = data.coverImage;
    } else {
      unsetFields.coverImage = 1;
    }
  }

  const updateOps: any = { $set: updateData };
  if (Object.keys(unsetFields).length > 0) {
    updateOps.$unset = unsetFields;
  }

  const post = await Post.findOneAndUpdate(
    { _id: postId, authorId: new Types.ObjectId(authorId) },
    updateOps,
    { new: true }
  );

  return post;
}

/**
 * Delete a post (soft delete)
 */
export async function deletePost(
  postId: string,
  authorId: string,
  isFounder: boolean = false
): Promise<boolean> {
  const filter: any = { _id: postId };

  // Founders can delete any post in their org
  if (!isFounder) {
    filter.authorId = new Types.ObjectId(authorId);
  }

  const result = await Post.findOneAndUpdate(filter, {
    $set: { isActive: false },
  });

  return !!result;
}

// ============= Like Functions =============

/**
 * Like a post
 */
export async function likePost(
  postId: string,
  userId: string,
  orgId: string
): Promise<{ success: boolean; likesCount: number }> {
  try {
    await PostLike.create({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    });

    // Increment likes count
    const post = await Post.findByIdAndUpdate(
      postId,
      { $inc: { likesCount: 1 } },
      { new: true }
    );

    return { success: true, likesCount: post?.likesCount || 0 };
  } catch (error: any) {
    // Duplicate key error - user already liked
    if (error.code === 11000) {
      const post = await Post.findById(postId).select("likesCount").lean();
      return { success: false, likesCount: post?.likesCount || 0 };
    }
    throw error;
  }
}

/**
 * Unlike a post
 */
export async function unlikePost(
  postId: string,
  userId: string
): Promise<{ success: boolean; likesCount: number }> {
  const result = await PostLike.findOneAndDelete({
    postId: new Types.ObjectId(postId),
    userId: new Types.ObjectId(userId),
  });

  if (result) {
    // Decrement likes count
    const post = await Post.findByIdAndUpdate(
      postId,
      { $inc: { likesCount: -1 } },
      { new: true }
    );
    return { success: true, likesCount: post?.likesCount || 0 };
  }

  const post = await Post.findById(postId).select("likesCount").lean();
  return { success: false, likesCount: post?.likesCount || 0 };
}

/**
 * Toggle like on a post
 */
export async function toggleLike(
  postId: string,
  userId: string,
  orgId: string
): Promise<{ liked: boolean; likesCount: number }> {
  const existingLike = await PostLike.findOne({
    postId: new Types.ObjectId(postId),
    userId: new Types.ObjectId(userId),
  });

  if (existingLike) {
    const result = await unlikePost(postId, userId);
    return { liked: false, likesCount: result.likesCount };
  } else {
    const result = await likePost(postId, userId, orgId);
    return { liked: true, likesCount: result.likesCount };
  }
}

// ============= Reaction Functions =============

/**
 * Get default reactions count object
 */
function getDefaultReactionsCount(): IReactionsCount {
  return {
    like: 0,
    love: 0,
    haha: 0,
    wow: 0,
    sad: 0,
    angry: 0,
    fire: 0,
    money: 0,
    total: 0,
  };
}

/**
 * Toggle reaction on a post (add, change, or remove)
 * - If no existing reaction: adds the reaction
 * - If same reaction exists: removes it
 * - If different reaction exists: changes to new reaction
 */
export async function toggleReaction(
  postId: string,
  userId: string,
  orgId: string,
  reactionType: ReactionType
): Promise<{
  reacted: boolean;
  reactionType: ReactionType | null;
  reactionsCount: IReactionsCount;
  /**
   * True when the user SWAPPED one reaction for another rather than adding a
   * first one. Both cases return `reacted: true` with the new type, so without
   * this they are indistinguishable — and the push notifier would buzz the
   * post's author a second time over one person changing their mind.
   */
  changed?: boolean;
}> {
  const existingReaction = await PostLike.findOne({
    postId: new Types.ObjectId(postId),
    userId: new Types.ObjectId(userId),
  });

  if (existingReaction) {
    if (existingReaction.reactionType === reactionType) {
      // Same reaction - remove it
      await PostLike.findByIdAndDelete(existingReaction._id);

      // Update counts: decrement old reaction and total
      const updateQuery: any = {
        $inc: {
          [`reactionsCount.${reactionType}`]: -1,
          'reactionsCount.total': -1,
          likesCount: -1, // Keep backward compatibility
        },
      };

      await Post.findByIdAndUpdate(postId, updateQuery);

      const post = await Post.findById(postId).select('reactionsCount').lean();
      return {
        reacted: false,
        reactionType: null,
        reactionsCount: post?.reactionsCount || getDefaultReactionsCount(),
      };
    } else {
      // Different reaction - change it
      const oldReactionType = existingReaction.reactionType;
      existingReaction.reactionType = reactionType;
      await existingReaction.save();

      // Update counts: decrement old, increment new (total stays same)
      const updateQuery: any = {
        $inc: {
          [`reactionsCount.${oldReactionType}`]: -1,
          [`reactionsCount.${reactionType}`]: 1,
        },
      };

      await Post.findByIdAndUpdate(postId, updateQuery);

      const post = await Post.findById(postId).select('reactionsCount').lean();
      return {
        reacted: true,
        reactionType,
        reactionsCount: post?.reactionsCount || getDefaultReactionsCount(),
        changed: true,
      };
    }
  } else {
    // No existing reaction - add new one
    await PostLike.create({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      reactionType,
    });

    // Update counts: increment reaction type and total
    const updateQuery: any = {
      $inc: {
        [`reactionsCount.${reactionType}`]: 1,
        'reactionsCount.total': 1,
        likesCount: 1, // Keep backward compatibility
      },
    };

    await Post.findByIdAndUpdate(postId, updateQuery);

    const post = await Post.findById(postId).select('reactionsCount').lean();
    return {
      reacted: true,
      reactionType,
      reactionsCount: post?.reactionsCount || getDefaultReactionsCount(),
    };
  }
}

/**
 * Remove a user's reaction from a post
 */
export async function removeReaction(
  postId: string,
  userId: string
): Promise<{
  success: boolean;
  reactionsCount: IReactionsCount;
}> {
  const existingReaction = await PostLike.findOne({
    postId: new Types.ObjectId(postId),
    userId: new Types.ObjectId(userId),
  });

  if (!existingReaction) {
    const post = await Post.findById(postId).select('reactionsCount').lean();
    return {
      success: false,
      reactionsCount: post?.reactionsCount || getDefaultReactionsCount(),
    };
  }

  const reactionType = existingReaction.reactionType;
  await PostLike.findByIdAndDelete(existingReaction._id);

  // Update counts
  const updateQuery: any = {
    $inc: {
      [`reactionsCount.${reactionType}`]: -1,
      'reactionsCount.total': -1,
      likesCount: -1,
    },
  };

  await Post.findByIdAndUpdate(postId, updateQuery);

  const post = await Post.findById(postId).select('reactionsCount').lean();
  return {
    success: true,
    reactionsCount: post?.reactionsCount || getDefaultReactionsCount(),
  };
}

/**
 * Get users who reacted to a post
 */
export async function getPostReactions(
  postId: string,
  options: {
    reactionType?: ReactionType;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  reactions: Array<{
    user: { _id: string; name: string; email: string; profilePicture?: string };
    reactionType: ReactionType;
    createdAt: Date;
  }>;
  total: number;
  byType: Record<ReactionType, number>;
}> {
  const { reactionType, limit = 20, offset = 0 } = options;

  const filter: any = {
    postId: new Types.ObjectId(postId),
  };

  if (reactionType) {
    filter.reactionType = reactionType;
  }

  const [reactions, total, reactionCounts] = await Promise.all([
    PostLike.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('userId', 'name email profilePicture')
      .lean(),
    PostLike.countDocuments(filter),
    // Get counts by type
    PostLike.aggregate([
      { $match: { postId: new Types.ObjectId(postId) } },
      { $group: { _id: '$reactionType', count: { $sum: 1 } } },
    ]),
  ]);

  // Build byType map — keep every ReactionType (including the newly
  // added fire + money) so the response shape is stable for clients
  // that iterate over keys.
  const byType: Record<ReactionType, number> = {
    like: 0,
    love: 0,
    haha: 0,
    wow: 0,
    sad: 0,
    angry: 0,
    fire: 0,
    money: 0,
  };

  reactionCounts.forEach((r: any) => {
    if (r._id && REACTION_TYPES.includes(r._id)) {
      byType[r._id as ReactionType] = r.count;
    }
  });

  return {
    reactions: reactions.map((r: any) => ({
      user: r.userId,
      reactionType: r.reactionType,
      createdAt: r.createdAt,
    })),
    total,
    byType,
  };
}

/**
 * Same toggle-or-swap semantics as `toggleReaction`, but keyed to a
 * single PostComment. Mirrors the post surface 1:1 so mobile and Garage
 * web can call /feed/comments/:id/react with the same body shape and
 * read the same response. Denormalized counters live on
 * PostComment.reactionsCount (mirror of Post.reactionsCount).
 */
export async function toggleCommentReaction(
  commentId: string,
  userId: string,
  orgId: string,
  reactionType: ReactionType,
): Promise<{
  reacted: boolean;
  reactionType: ReactionType | null;
  reactionsCount: IReactionsCount;
  /**
   * True when the user SWAPPED one reaction for another rather than adding a
   * first one. Both cases return `reacted: true` with the new type, so without
   * this they are indistinguishable — and the push notifier would buzz the
   * comment's author a second time over one person changing their mind.
   * Mirrors `togglePostReaction`.
   */
  changed?: boolean;
}> {
  const existing = await PostCommentLike.findOne({
    commentId: new Types.ObjectId(commentId),
    userId: new Types.ObjectId(userId),
  });

  if (existing) {
    if (existing.reactionType === reactionType) {
      // Same reaction — remove it.
      await PostCommentLike.findByIdAndDelete(existing._id);
      await PostComment.findByIdAndUpdate(commentId, {
        $inc: {
          [`reactionsCount.${reactionType}`]: -1,
          "reactionsCount.total": -1,
        },
      });
      const c = await PostComment.findById(commentId).select("reactionsCount").lean();
      return {
        reacted: false,
        reactionType: null,
        reactionsCount: c?.reactionsCount || getDefaultReactionsCount(),
      };
    }
    // Different reaction — swap.
    const oldType = existing.reactionType;
    existing.reactionType = reactionType;
    await existing.save();
    await PostComment.findByIdAndUpdate(commentId, {
      $inc: {
        [`reactionsCount.${oldType}`]: -1,
        [`reactionsCount.${reactionType}`]: 1,
      },
    });
    const c = await PostComment.findById(commentId).select("reactionsCount").lean();
    return {
      reacted: true,
      reactionType,
      reactionsCount: c?.reactionsCount || getDefaultReactionsCount(),
      changed: true,
    };
  }

  // No existing reaction — insert.
  await PostCommentLike.create({
    commentId: new Types.ObjectId(commentId),
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
    reactionType,
  });
  await PostComment.findByIdAndUpdate(commentId, {
    $inc: {
      [`reactionsCount.${reactionType}`]: 1,
      "reactionsCount.total": 1,
    },
  });
  const c = await PostComment.findById(commentId).select("reactionsCount").lean();
  return {
    reacted: true,
    reactionType,
    reactionsCount: c?.reactionsCount || getDefaultReactionsCount(),
  };
}

/**
 * Remove the current user's reaction on a comment (DELETE handler).
 * No-op if no reaction exists.
 */
export async function removeCommentReaction(
  commentId: string,
  userId: string,
): Promise<{ reactionsCount: IReactionsCount }> {
  const existing = await PostCommentLike.findOne({
    commentId: new Types.ObjectId(commentId),
    userId: new Types.ObjectId(userId),
  });
  if (!existing) {
    const c = await PostComment.findById(commentId).select("reactionsCount").lean();
    return { reactionsCount: c?.reactionsCount || getDefaultReactionsCount() };
  }
  const oldType = existing.reactionType;
  await PostCommentLike.findByIdAndDelete(existing._id);
  await PostComment.findByIdAndUpdate(commentId, {
    $inc: {
      [`reactionsCount.${oldType}`]: -1,
      "reactionsCount.total": -1,
    },
  });
  const c = await PostComment.findById(commentId).select("reactionsCount").lean();
  return { reactionsCount: c?.reactionsCount || getDefaultReactionsCount() };
}

/**
 * Get user's reaction on a post
 */
export async function getUserReaction(
  postId: string,
  userId: string
): Promise<ReactionType | null> {
  const reaction = await PostLike.findOne({
    postId: new Types.ObjectId(postId),
    userId: new Types.ObjectId(userId),
  }).lean();

  return reaction?.reactionType || null;
}

// ============= Comment Functions =============

/**
 * Add a comment to a post
 */
export async function addComment(
  postId: string,
  userId: string,
  orgId: string,
  content: string,
  parentCommentId?: string,
  mentions?: string[],
  // Widened from `image | gif | audio` to match the FE union plus the
  // route Zod schema in routes/feed.ts. Adding video + document so
  // comment attachments stop 400'ing for those types. The Mongoose
  // PostComment schema doesn't enum-restrict `attachments[].type`, so
  // any string passes through to storage cleanly.
  attachments?: {
    type: "image" | "video" | "document" | "audio" | "gif";
    url: string;
    name: string;
    fileKey?: string;
  }[]
): Promise<any> {
  const comment = await PostComment.create({
    postId: new Types.ObjectId(postId),
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
    content: content || "",
    mentions: (mentions || []).map((id) => new Types.ObjectId(id)),
    attachments: attachments || [],
    parentCommentId: parentCommentId
      ? new Types.ObjectId(parentCommentId)
      : null,
  });

  // Increment comments count
  await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

  // Populate user data
  const populatedComment = await PostComment.findById(comment._id)
    .populate("userId", "name email profilePicture")
    .lean();

  return populatedComment;
}

/**
 * Create notifications for mentioned users in a comment
 * Only notifies users who are members of the post's channel
 */
export async function createCommentMentionNotifications(
  commentId: string,
  postId: string,
  authorId: string,
  orgId: string,
  content: string,
  mentionedUserIds: string[]
): Promise<void> {
  if (mentionedUserIds.length === 0) return;

  const io = getSocketInstance();

  // Get author info
  const author = await User.findById(authorId)
    .select("name email profilePicture")
    .lean();
  const authorName = author?.name || author?.email || "Someone";

  // Get post info for context
  const post = await Post.findById(postId)
    .select("channelIds content")
    .populate("channelIds", "title")
    .lean();
  const channelId = (post as any)?.channelIds?.[0]?._id?.toString();
  const channelName = (post as any)?.channelIds?.[0]?.title || "a channel";

  // Filter mentioned users to only those who are members of the channel
  let eligibleUserIds = mentionedUserIds;
  if (channelId) {
    const channelMemberships = await ChannelMembership.find({
      channelId: new Types.ObjectId(channelId),
      userId: { $in: mentionedUserIds.map((id) => new Types.ObjectId(id)) },
      status: "active",
    })
      .select("userId")
      .lean();

    const memberUserIds = new Set(
      channelMemberships.map((m) => m.userId.toString())
    );
    eligibleUserIds = mentionedUserIds.filter((id) => memberUserIds.has(id));

    if (eligibleUserIds.length === 0) return;
  }

  const truncatedContent = content
    ? content.substring(0, 100) + (content.length > 100 ? "..." : "")
    : "Commented on a post";

  for (const mentionedUserId of eligibleUserIds) {
    // Don't notify the author
    if (mentionedUserId === authorId) continue;

    try {
      // Create Notification record (high-priority notification hub)
      await Notification.create({
        userId: new Types.ObjectId(mentionedUserId),
        orgId: new Types.ObjectId(orgId),
        type: "comment_mention",
        priority: "high",
        title: `${authorName} mentioned you in a comment`,
        message: truncatedContent,
        data: {
          commentId,
          postId,
          channelId,
          channelName,
          authorId,
          authorName,
        },
        isRead: false,
      });

      // Create UserNotification record
      await UserNotification.create({
        userId: new Types.ObjectId(mentionedUserId),
        orgId: new Types.ObjectId(orgId),
        type: "comment_mention",
        postId: new Types.ObjectId(postId),
        commentId: new Types.ObjectId(commentId),
        commentAuthorId: new Types.ObjectId(authorId),
        commentAuthorName: author?.name,
        commentAuthorEmail: author?.email,
        commentAuthorPicture: author?.profilePicture,
        commentContent: truncatedContent,
        channelId: channelId ? new Types.ObjectId(channelId) : undefined,
        channelName,
        read: false,
        cleared: false,
      });

      // Emit real-time notification
      if (io) {
        io.to(`user:${mentionedUserId}`).emit("notification:new", {
          type: "comment_mention",
          priority: "high",
          title: `${authorName} mentioned you in a comment`,
          message: truncatedContent,
          data: {
            commentId,
            postId,
            channelId,
            channelName,
            authorId,
            authorName,
            authorPicture: author?.profilePicture,
          },
        });
      }

      // Same reasoning as the post-mention push: the socket emit only reaches
      // an open app, so without this a comment mention never reaches a phone.
      const { sendFeedEngagementPushNotification } = await import(
        "./pushNotification"
      );
      await sendFeedEngagementPushNotification(
        mentionedUserId,
        {
          id: authorId,
          name: author?.name || author?.email,
          avatar: author?.profilePicture,
        },
        { id: postId, content },
        { kind: "mention", surface: "comment", text: truncatedContent }
      );
    } catch (notifError) {
      console.error(
        `Failed to create notification for mentioned user ${mentionedUserId}:`,
        notifError
      );
    }
  }
}

/**
 * Get comments for a post
 * - If parentCommentId is undefined, returns ALL comments (both top-level and replies)
 * - If parentCommentId is null, returns only top-level comments
 * - If parentCommentId is a valid ID, returns only replies to that comment
 */
export async function getComments(
  postId: string,
  options: {
    limit?: number;
    offset?: number;
    parentCommentId?: string | null;
  } = {}
): Promise<{ comments: any[]; total: number }> {
  const { limit = 50, offset = 0, parentCommentId } = options;

  const filter: any = {
    postId: new Types.ObjectId(postId),
    isActive: true,
  };

  // Only filter by parentCommentId if explicitly provided
  // undefined = return all comments (for threaded view)
  // null = return only top-level comments
  // string = return replies to that specific comment
  if (parentCommentId !== undefined) {
    filter.parentCommentId = parentCommentId
      ? new Types.ObjectId(parentCommentId)
      : null;
  }

  const [comments, total] = await Promise.all([
    PostComment.find(filter)
      .sort({ createdAt: 1 })
      .skip(offset)
      .limit(limit)
      .populate("userId", "name email profilePicture")
      .lean(),
    PostComment.countDocuments(filter),
  ]);

  return { comments, total };
}

/**
 * Delete a comment (soft delete)
 */
export async function deleteComment(
  commentId: string,
  userId: string,
  isFounder: boolean = false
): Promise<boolean> {
  const filter: any = { _id: commentId };

  if (!isFounder) {
    filter.userId = new Types.ObjectId(userId);
  }

  const comment = await PostComment.findOneAndUpdate(filter, {
    $set: { isActive: false },
  });

  if (comment) {
    // Decrement comments count
    await Post.findByIdAndUpdate(comment.postId, {
      $inc: { commentsCount: -1 },
    });
    return true;
  }

  return false;
}

/**
 * Edit a comment's content. Author-only (a comment can only be edited by the
 * user who wrote it). Returns the updated comment (author populated) or null
 * when not found / not the author.
 */
export async function updateComment(
  commentId: string,
  userId: string,
  content: string
): Promise<any | null> {
  const comment = await PostComment.findOneAndUpdate(
    {
      _id: commentId,
      userId: new Types.ObjectId(userId),
      isActive: { $ne: false },
    },
    { $set: { content } },
    { new: true }
  ).populate("userId", "name email profilePicture");

  return comment;
}

// ============= Channel Membership Functions =============

/**
 * Get user's subscribed channels in an org
 */
export async function getUserChannels(
  userId: string,
  orgId: string
): Promise<any[]> {
  const memberships = await ChannelMembership.find({
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
    status: "active",
  })
    .populate("channelId", "title description price isFree coverImage isActive")
    .lean();

  return memberships
    .filter((m) => m.channelId)
    .map((m) => ({
      channelId: (m.channelId as any)._id,
      channelTitle: (m.channelId as any).title,
      status: m.status,
      joinedAt: m.joinedAt,
      canPost: (m as any).canPost !== false,
      subscriptionId: (m as any).subscriptionId,
      // Surface the cancelling-state fields so the FE "Cancelling —
      // access until X" badge persists across page loads (not just for
      // the click-cancel session that triggered the state update).
      subscriptionStatus: (m as any).subscriptionStatus || null,
      accessUntil: (m as any).nextPaymentDate || null,
    }));
}

/**
 * Get all channels in an org
 */
export async function getOrgChannels(orgId: string): Promise<any[]> {
  const channels = await Channel.find({
    storeId: new Types.ObjectId(orgId),
    isActive: true,
  })
    .select(
      // subscriptionPeriod + subscriptionInterval MUST be projected — the
      // FE channel cards and the Subscribe modal read `channel.subscriptionPeriod`
      // and default to "monthly" / "month" when it's missing, which makes
      // every recurring channel look monthly regardless of how it was set up.
      //
      // gstInclusive MUST be projected — ChannelPaymentModalNew reads it to
      // decide whether to display the GST-on-top breakdown and add 18% to
      // the Pay button label. When it was omitted, the FE fell back to
      // `undefined === false → false`, so a founder who toggled "No, add it
      // on top" saw the base price (₹100) on the buyer modal even though
      // Razorpay actually charged the gross (₹118). Bug: founder-reported
      // "GST not coming up on the buyer side even though I toggled it".
      "_id title description price currency isFree isSubscription subscriptionPeriod subscriptionInterval gstInclusive isActive coverImage galleryImages videoUrl videoFile shareLink isDefault createdAt"
    )
    .lean();

  // Get member counts + a small avatar preview (first 3 members) per channel
  // in a single aggregation.
  const channelIds = channels.map((c) => c._id);
  const memberStats = await ChannelMembership.aggregate([
    {
      $match: {
        channelId: { $in: channelIds },
        status: "active",
      },
    },
    { $sort: { joinedAt: -1 } },
    {
      $group: {
        _id: "$channelId",
        count: { $sum: 1 },
        memberUserIds: { $push: "$userId" },
      },
    },
    {
      $project: {
        count: 1,
        previewIds: { $slice: ["$memberUserIds", 3] },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "previewIds",
        foreignField: "_id",
        as: "previewUsers",
      },
    },
    {
      $project: {
        count: 1,
        memberPreview: {
          $map: {
            input: "$previewUsers",
            as: "u",
            in: {
              _id: "$$u._id",
              name: "$$u.name",
              profilePicture: "$$u.profilePicture",
            },
          },
        },
      },
    },
  ]);

  const memberStatMap = new Map(
    memberStats.map((m: any) => [
      m._id.toString(),
      { count: m.count, memberPreview: m.memberPreview || [] },
    ])
  );

  return channels.map((channel) => {
    const stat = memberStatMap.get(channel._id.toString());
    return {
      ...channel,
      logo: channel.coverImage || null,
      memberCount: stat?.count || 0,
      memberPreview: stat?.memberPreview || [],
    };
  });
}

/**
 * Subscribe to a free channel
 */
export async function subscribeToFreeChannel(
  userId: string,
  channelId: string,
  orgId: string
): Promise<{ success: boolean; message: string }> {
  // Check if channel exists and is free
  const channel = await Channel.findById(channelId).lean();
  if (!channel) {
    return { success: false, message: "Channel not found" };
  }

  if (!channel.isFree && channel.price > 0) {
    return { success: false, message: "This is a paid channel" };
  }

  // Check if already subscribed
  const existing = await ChannelMembership.findOne({
    userId: new Types.ObjectId(userId),
    channelId: new Types.ObjectId(channelId),
  });

  if (existing) {
    if (existing.status === "active") {
      // Already in. Still reconcile the invoice — this is the busiest free-join
      // path in the app and ran uninvoiced for a long time, so an active member
      // may well predate the mint. mintFreeItemInvoice is idempotent, so a
      // member who already has one is untouched.
      await mintFreeChannelSubscribeInvoice(userId, channel, orgId);
      return { success: false, message: "Already subscribed to this channel" };
    }
    // Reactivate
    existing.status = "active";
    await existing.save();
    await mintFreeChannelSubscribeInvoice(userId, channel, orgId);
    return { success: true, message: "Subscription reactivated" };
  }

  // Create new membership
  await ChannelMembership.create({
    userId: new Types.ObjectId(userId),
    channelId: new Types.ObjectId(channelId),
    orgId: new Types.ObjectId(orgId),
    status: "active",
    role: "member",
  });

  // Membership is the source of truth and is written first — the $0 invoice is
  // best-effort and never blocks the join.
  await mintFreeChannelSubscribeInvoice(userId, channel, orgId);

  return { success: true, message: "Successfully subscribed to channel" };
}

/**
 * $0 paper trail for the in-app "join community" button, matching what a free
 * `/checkout/channel/:id` produces. Same `channel_auto_join` metadata.type the
 * signup/invite auto-joins already use, so reports grouping on it see one
 * consistent value.
 */
async function mintFreeChannelSubscribeInvoice(
  userId: string,
  channel: any,
  orgId: string,
): Promise<void> {
  // Backgrounded: this is the in-app "join community" button — bookkeeping
  // must not sit between the click and the join.
  const { mintFreeItemInvoiceInBackground } = await import("./freeInvoice");
  mintFreeItemInvoiceInBackground({
    userId,
    orgId,
    sellerId: String(channel.createdBy),
    itemType: "channel",
    itemId: String(channel._id),
    itemName: channel.title,
    itemDescription: channel.description,
    itemImage: channel.coverImage,
    currency: channel.currency,
    metadataType: "channel_auto_join",
    source: "subscribe",
    // Deliberate join — the member clicked it, so the founder's order email
    // applies. Auto-joins (default community on signup, communities bundled
    // with a course or product) go through addUserToChannel and stay silent.
    notifyBuyer: true,
  });
}

/**
 * Unsubscribe a user from a channel (community-style "leave"). Flips the
 * ChannelMembership row to status: "inactive" rather than hard-deleting so
 * the join date / role survive a future re-subscribe (mirrors the
 * subscribeToFreeChannel reactivation path at line ~1426).
 *
 * Paid channels with an active Razorpay subscriptionId are rejected — the
 * caller must cancel the Razorpay subscription first via the existing
 * cancel-subscription route, otherwise we'd keep charging the user for a
 * channel they think they left. Free channels (the common case Aryan's
 * mobile hits) flow straight through.
 *
 * Unified cancel — one entry point for all three channel types:
 *   Free / one-time paid → instant leave.
 *   Recurring paid       → cancel-at-cycle-end. Parent invoice's
 *                         `cancelledAt` is stamped (via
 *                         cancelSubscription in services/invoice.ts),
 *                         any draft/pending child is force-cancelled so
 *                         the cron doesn't spawn cycle N+1, and the
 *                         membership enters the "active but cancelling"
 *                         batch until the sweeper flips it at
 *                         nextPaymentDate.
 *
 * Idempotent: missing or already-inactive membership returns success so
 * the mobile client can retry safely without seeing a spurious error.
 * Cancelling the same channel twice returns the same
 * cancelling_at_cycle_end payload (no 400).
 */
export async function unsubscribeFromChannel(
  userId: string,
  channelId: string
): Promise<{
  success: boolean;
  message: string;
  // One of "cancelled_immediately" | "cancelling_at_cycle_end" |
  // "already_inactive". FE drives its post-cancel UI on this field.
  status: string;
  accessUntil: Date | null;
  alreadyInactive?: boolean;
}> {
  const userObjectId = new Types.ObjectId(userId);
  const channelObjectId = new Types.ObjectId(channelId);
  const now = new Date();

  const membership = await ChannelMembership.findOne({
    userId: userObjectId,
    channelId: channelObjectId,
  });

  if (!membership) {
    return {
      success: true,
      message: "Not subscribed to this channel",
      status: "already_inactive",
      accessUntil: null,
      alreadyInactive: true,
    };
  }

  // Idempotent: already fully expired (post-sweeper) OR never active.
  if (membership.status !== "active") {
    return {
      success: true,
      message: "Subscription already inactive",
      status: "already_inactive",
      accessUntil: null,
      alreadyInactive: true,
    };
  }

  // Idempotent: already in the cancelling batch — same payload as the
  // first cancel would have returned.
  if (membership.subscriptionStatus === "cancelled") {
    return {
      success: true,
      message: "Subscription is already cancelling at cycle end",
      status: "cancelling_at_cycle_end",
      accessUntil: membership.nextPaymentDate || null,
    };
  }

  // Fetch the channel so we know whether this is free / one-time / recurring.
  const channel = await Channel.findById(channelObjectId).lean();

  // User snapshot for the Unsub Log — capture the name/email as they
  // read at cancel time so future rename/re-email edits don't rewrite
  // history. Populate optional — a missing user still logs an event.
  const userSnapshot = await User.findById(userObjectId)
    .select("name email")
    .lean();
  const { emitUnsubscribeEvent } = await import("./channelMembershipEvent");

  if (!channel) {
    // Defensive: the membership row exists but the channel was deleted.
    // Treat as a "leave" — flip status inactive, stamp cancelledAt.
    membership.status = "inactive";
    (membership as any).subscriptionStatus = "expired";
    (membership as any).cancelledAt = now;
    await membership.save();
    // Log even for the "channel deleted" edge case so the audit
    // trail explains why the membership disappeared.
    await emitUnsubscribeEvent({
      membership,
      channel: { _id: channelObjectId, isFree: true, isSubscription: false, storeId: (membership as any).orgId },
      user: userSnapshot,
      parentInvoiceId: null,
      accessUntil: now,
      occurredAt: now,
    });
    return {
      success: true,
      message: "Channel no longer exists — membership removed",
      status: "cancelled_immediately",
      accessUntil: now,
    };
  }

  // Free or one-time paid → instant leave. No invoice work required
  // (one-time invoices don't cycle, so there's nothing to cancel on the
  // Invoice side; the user just loses access now).
  if ((channel as any).isFree || !(channel as any).isSubscription) {
    membership.status = "inactive";
    (membership as any).subscriptionStatus = "expired";
    (membership as any).cancelledAt = now;
    await membership.save();
    await emitUnsubscribeEvent({
      membership,
      channel,
      user: userSnapshot,
      parentInvoiceId: null,
      // Free/one-time: no future window — the user loses access now.
      accessUntil: now,
      occurredAt: now,
    });
    return {
      success: true,
      message: "You've left the community",
      status: "cancelled_immediately",
      accessUntil: now,
    };
  }

  // Recurring paid — cancel-at-cycle-end.
  //
  // Find the active (paid, non-cancelled) parent invoice for this
  // (user, channel) so we can stop the cron cascade. Scoped by
  // organizationId to avoid picking up a stray invoice from another org
  // with the same channel id (belt-and-braces — channelId is unique
  // globally, but the org filter matches the on-payment fulfillment path).
  const { Invoice } = await import("../models/invoice.model");
  const parentInvoice = await Invoice.findOne({
    userId: userObjectId,
    organizationId: (channel as any).storeId,
    isRecurring: true,
    status: "paid",
    parentInvoiceId: { $exists: false },
    cancelledAt: null,
    "lineItems.itemType": "channel",
    "lineItems.itemId": channelObjectId,
  });

  if (parentInvoice) {
    // cancelSubscription() sets parent.cancelledAt (stops future cycle
    // generation via the guard at services/invoice.ts:2820), force-
    // cancels any draft/pending child (stops the FE from showing a "Pay
    // Now" for cycle N+1), and cancels active PlatformCouponRedemption.
    const { cancelSubscription: cancelInvoiceSubscription } = await import(
      "./invoice"
    );
    try {
      await cancelInvoiceSubscription(
        (parentInvoice as any)._id.toString(),
        userId
      );
    } catch (err: any) {
      // Already-cancelled is an OK state — swallow, we still want to
      // continue and mark the membership as cancelling.
      if (!/already cancelled/i.test(err?.message || "")) {
        throw err;
      }
    }
  }

  // If Razorpay was actually collecting this sub, tell them to stop at
  // cycle end. Wallet / manual / crypto paths don't touch Razorpay.
  const razorpaySubId = (parentInvoice as any)?.razorpaySubscriptionId;
  const paymentPlatform = (parentInvoice as any)?.paymentPlatform;
  if (razorpaySubId && paymentPlatform === "razorpay") {
    try {
      const { cancelSubscription: razorpayCancel } = await import(
        "./razorpay"
      );
      await razorpayCancel(razorpaySubId, /* cancelAtCycleEnd */ true);
    } catch (err: any) {
      // Log-and-continue — the parent invoice cancel above is what
      // stops OUR billing pipeline. If Razorpay's cancel fails, at
      // worst they'd attempt one more charge which the invoice guard
      // then rejects — surface via logs, don't fail the user's cancel.
      console.error(
        `[Channel cancel] Razorpay cancelSubscription failed for ${razorpaySubId}:`,
        err?.message
      );
    }
  }

  // Enter the "cancelling this cycle" batch — status stays "active" so
  // the user keeps access until the sweeper flips them at nextPaymentDate.
  //
  // Important: `subscribeToPaidChannel` currently only stamps
  // `lastPaymentDate` on the membership — `nextPaymentDate` was never
  // populated on the create/reactivate path. Without it, the expiry
  // sweeper (which filters `nextPaymentDate: { $lte: now, $ne: null }`)
  // would leave the user in cancelling-limbo forever. Backfill it here
  // from the parent invoice's `nextDueDate` (source of truth for the
  // end-of-cycle boundary — always kept in sync by fulfillInvoice's
  // advance-billing step).
  (membership as any).subscriptionStatus = "cancelled";
  (membership as any).cancelledAt = now;
  const parentNextDueDate = (parentInvoice as any)?.nextDueDate;
  if (parentNextDueDate && !(membership as any).nextPaymentDate) {
    (membership as any).nextPaymentDate = parentNextDueDate;
  }
  await membership.save();

  // accessUntil prefers the just-stamped nextPaymentDate; parent's
  // nextDueDate is the same value in the common path but kept as a
  // fallback for legacy records where the parent lookup came back empty.
  const accessUntil =
    (membership as any).nextPaymentDate || parentNextDueDate || null;

  await emitUnsubscribeEvent({
    membership,
    channel,
    user: userSnapshot,
    parentInvoiceId: (parentInvoice as any)?._id ?? null,
    accessUntil,
    occurredAt: now,
  });

  return {
    success: true,
    message: "Subscription will cancel at the end of the current billing cycle",
    status: "cancelling_at_cycle_end",
    accessUntil,
  };
}

/**
 * Subscribe to a paid channel (after payment verification)
 * NOTE: Wallet crediting is now handled by distributeCommissions() in the route
 * This function only handles subscription/membership logic
 */
export async function subscribeToPaidChannel(
  userId: string,
  channelId: string,
  orgId: string,
  paymentDetails: {
    razorpayPaymentId: string;
    razorpayOrderId: string;
    subscriptionId?: string;
    amount: number; // Amount in INR (not paise)
  }
): Promise<{ success: boolean; message: string }> {
  // Check if already subscribed
  const existing = await ChannelMembership.findOne({
    userId: new Types.ObjectId(userId),
    channelId: new Types.ObjectId(channelId),
  });

  if (existing && existing.status === "active") {
    return { success: false, message: "Already subscribed to this channel" };
  }

  // Create or reactivate membership
  if (existing) {
    existing.status = "active";
    existing.subscriptionId = paymentDetails.subscriptionId;
    existing.subscriptionStatus = "active";
    existing.lastPaymentDate = new Date();
    await existing.save();
  } else {
    await ChannelMembership.create({
      userId: new Types.ObjectId(userId),
      channelId: new Types.ObjectId(channelId),
      orgId: new Types.ObjectId(orgId),
      status: "active",
      role: "member",
      subscriptionId: paymentDetails.subscriptionId,
      subscriptionStatus: "active",
      lastPaymentDate: new Date(),
    });
  }

  return { success: true, message: "Successfully subscribed to channel" };
}

/**
 * Check if user can post to channels
 * Returns invalidChannels (not subscribed) and restrictedChannels (muted by founder)
 */
export async function canUserPostToChannels(
  userId: string,
  orgId: string,
  channelIds: string[],
  isFounder: boolean
): Promise<{ canPost: boolean; invalidChannels: string[]; restrictedChannels: string[] }> {
  // Founders can post to any channel in their org
  if (isFounder) {
    return { canPost: true, invalidChannels: [], restrictedChannels: [] };
  }

  // Check user's subscriptions (also fetch canPost in same query — zero extra DB calls)
  const memberships = await ChannelMembership.find({
    userId: new Types.ObjectId(userId),
    channelId: { $in: channelIds.map((id) => new Types.ObjectId(id)) },
    status: "active",
  })
    .select("channelId canPost")
    .lean();

  const subscribedIds = new Set(memberships.map((m) => m.channelId.toString()));
  const invalidChannels = channelIds.filter((id) => !subscribedIds.has(id));

  // Check for muted memberships (canPost === false)
  const restrictedChannels = memberships
    .filter((m) => (m as any).canPost === false)
    .map((m) => m.channelId.toString());

  if (restrictedChannels.length > 0) {
    return {
      canPost: false,
      invalidChannels,
      restrictedChannels,
    };
  }

  return {
    canPost: invalidChannels.length === 0,
    invalidChannels,
    restrictedChannels: [],
  };
}

/**
 * Check if user can view a post (is member of at least one channel)
 */
export async function canUserViewPost(
  userId: string,
  orgId: string,
  postChannelIds: Types.ObjectId[],
  isFounder: boolean
): Promise<boolean> {
  if (isFounder) return true;

  const membership = await ChannelMembership.findOne({
    userId: new Types.ObjectId(userId),
    channelId: { $in: postChannelIds },
    status: "active",
  });

  return !!membership;
}

// ============= Repost Functions =============

/**
 * Repost a post
 */
export async function repostPost(
  postId: string,
  userId: string,
  orgId: string
): Promise<{ success: boolean; repostsCount: number }> {
  try {
    await PostRepost.create({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    });

    // Increment reposts count
    const post = await Post.findByIdAndUpdate(
      postId,
      { $inc: { repostsCount: 1 } },
      { new: true }
    );

    return { success: true, repostsCount: post?.repostsCount || 0 };
  } catch (error: any) {
    // Duplicate key error - user already reposted
    if (error.code === 11000) {
      const post = await Post.findById(postId).select("repostsCount").lean();
      return { success: false, repostsCount: post?.repostsCount || 0 };
    }
    throw error;
  }
}

/**
 * Remove repost
 */
export async function unrepostPost(
  postId: string,
  userId: string
): Promise<{ success: boolean; repostsCount: number }> {
  const result = await PostRepost.findOneAndDelete({
    postId: new Types.ObjectId(postId),
    userId: new Types.ObjectId(userId),
  });

  if (result) {
    // Decrement reposts count
    const post = await Post.findByIdAndUpdate(
      postId,
      { $inc: { repostsCount: -1 } },
      { new: true }
    );
    return { success: true, repostsCount: post?.repostsCount || 0 };
  }

  const post = await Post.findById(postId).select("repostsCount").lean();
  return { success: false, repostsCount: post?.repostsCount || 0 };
}

/**
 * Toggle repost on a post
 */
export async function toggleRepost(
  postId: string,
  userId: string,
  orgId: string
): Promise<{ reposted: boolean; repostsCount: number }> {
  const existingRepost = await PostRepost.findOne({
    postId: new Types.ObjectId(postId),
    userId: new Types.ObjectId(userId),
  });

  if (existingRepost) {
    const result = await unrepostPost(postId, userId);
    return { reposted: false, repostsCount: result.repostsCount };
  } else {
    const result = await repostPost(postId, userId, orgId);
    return { reposted: true, repostsCount: result.repostsCount };
  }
}

/**
 * Check if user has reposted a post
 */
export async function hasUserReposted(
  postId: string,
  userId: string
): Promise<boolean> {
  const repost = await PostRepost.findOne({
    postId: new Types.ObjectId(postId),
    userId: new Types.ObjectId(userId),
  }).lean();
  return !!repost;
}

/**
 * Get users who reposted a post
 */
export async function getPostReposts(
  postId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ reposts: any[]; total: number }> {
  const { limit = 20, offset = 0 } = options;

  const [reposts, total] = await Promise.all([
    PostRepost.find({ postId: new Types.ObjectId(postId) })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("userId", "name email profilePicture")
      .lean(),
    PostRepost.countDocuments({ postId: new Types.ObjectId(postId) }),
  ]);

  return { reposts, total };
}

// ============= Bookmark Functions =============

/**
 * Bookmark a post
 */
export async function bookmarkPost(
  postId: string,
  userId: string,
  orgId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await PostBookmark.create({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    });

    return { success: true, message: "Post bookmarked" };
  } catch (error: any) {
    // Duplicate key error - already bookmarked
    if (error.code === 11000) {
      return { success: false, message: "Post already bookmarked" };
    }
    throw error;
  }
}

/**
 * Remove bookmark
 */
export async function unbookmarkPost(
  postId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const result = await PostBookmark.findOneAndDelete({
    postId: new Types.ObjectId(postId),
    userId: new Types.ObjectId(userId),
  });

  if (result) {
    return { success: true, message: "Bookmark removed" };
  }

  return { success: false, message: "Bookmark not found" };
}

/**
 * Toggle bookmark on a post
 */
export async function toggleBookmark(
  postId: string,
  userId: string,
  orgId: string
): Promise<{ bookmarked: boolean; message: string }> {
  const existingBookmark = await PostBookmark.findOne({
    postId: new Types.ObjectId(postId),
    userId: new Types.ObjectId(userId),
  });

  if (existingBookmark) {
    await unbookmarkPost(postId, userId);
    return { bookmarked: false, message: "Bookmark removed" };
  } else {
    await bookmarkPost(postId, userId, orgId);
    return { bookmarked: true, message: "Post bookmarked" };
  }
}

/**
 * Get user's bookmarked posts
 */
export async function getUserBookmarks(
  userId: string,
  orgId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{
  posts: any[];
  total: number;
  pagination: { limit: number; offset: number; hasMore: boolean };
}> {
  const { limit = 20, offset = 0 } = options;

  const [bookmarks, total] = await Promise.all([
    PostBookmark.find({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate({
        path: "postId",
        match: { isActive: true },
        populate: [
          { path: "authorId", select: "name email profilePicture" },
          { path: "channelIds", select: "title" },
        ],
      })
      .lean(),
    PostBookmark.countDocuments({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    }),
  ]);

  // Filter out null posts (deleted posts)
  const posts = bookmarks
    .filter((b) => b.postId !== null)
    .map((b) => ({
      ...(b.postId as any),
      bookmarkedAt: b.createdAt,
      hasBookmarked: true,
    }));

  // Add hasLiked and userReaction status
  const postIds = posts.map((p) => p._id);
  const userLikes = await PostLike.find({
    postId: { $in: postIds },
    userId: new Types.ObjectId(userId),
  })
    .select("postId reactionType")
    .lean();
  const likedPostIds = new Set(userLikes.map((l) => l.postId.toString()));
  const userReactionMap = new Map(
    userLikes.map((l) => [l.postId.toString(), l.reactionType])
  );

  const postsWithLikeStatus = posts.map((post) => ({
    ...post,
    hasLiked: likedPostIds.has(post._id.toString()),
    userReaction: userReactionMap.get(post._id.toString()) || null,
  }));

  return {
    posts: postsWithLikeStatus,
    total,
    pagination: {
      limit,
      offset,
      hasMore: offset + posts.length < total,
    },
  };
}

/**
 * Check if user has bookmarked a post
 */
export async function hasUserBookmarked(
  postId: string,
  userId: string
): Promise<boolean> {
  const bookmark = await PostBookmark.findOne({
    postId: new Types.ObjectId(postId),
    userId: new Types.ObjectId(userId),
  }).lean();
  return !!bookmark;
}

// ============= Quote Post Functions =============

export interface CreateQuotePostData {
  content: string;
  authorId: string;
  orgId: string;
  channelIds: string[];
  quotedPostId: string;
  tags?: string[];
  attachments?: {
    type: "image" | "video" | "document" | "audio";
    url: string;
    name: string;
    fileKey?: string;
  }[];
  linkPreviews?: {
    url: string;
    title?: string;
    description?: string;
    image?: string | null;
    siteName?: string;
    showThumbnail?: boolean;
  }[];
}

/**
 * Create a quote post (post with quoted post)
 */
export async function createQuotePost(
  data: CreateQuotePostData
): Promise<IPost> {
  // Verify the quoted post exists
  const quotedPost = await Post.findById(data.quotedPostId).lean();
  if (!quotedPost || !quotedPost.isActive) {
    throw new Error("Quoted post not found or has been deleted");
  }

  const postData: any = {
    content: data.content,
    authorId: new Types.ObjectId(data.authorId),
    orgId: new Types.ObjectId(data.orgId),
    channelIds: data.channelIds.map((id) => new Types.ObjectId(id)),
    quotedPostId: new Types.ObjectId(data.quotedPostId),
    tags: data.tags || [],
    attachments: data.attachments || [],
  };

  // Only add linkPreviews if it was explicitly provided
  if (data.linkPreviews !== undefined) {
    postData.linkPreviews = data.linkPreviews;
  }

  const post = await Post.create(postData);

  return post;
}

/**
 * Get a post with its quoted post populated
 */
export async function getPostWithQuote(
  postId: string,
  userId: string
): Promise<any | null> {
  const post = await Post.findById(postId)
    .populate("authorId", "name email profilePicture")
    .populate("channelIds", "title")
    .populate({
      path: "quotedPostId",
      match: { isActive: true },
      populate: [
        { path: "authorId", select: "name email profilePicture" },
        { path: "channelIds", select: "title" },
      ],
    })
    .lean();

  if (!post) return null;

  // Check if user has liked, bookmarked, or reposted this post
  const [userLike, userBookmark, userRepost, bookmarksCount] =
    await Promise.all([
      PostLike.findOne({
        postId: new Types.ObjectId(postId),
        userId: new Types.ObjectId(userId),
      }).lean(),
      PostBookmark.findOne({
        postId: new Types.ObjectId(postId),
        userId: new Types.ObjectId(userId),
      }).lean(),
      PostRepost.findOne({
        postId: new Types.ObjectId(postId),
        userId: new Types.ObjectId(userId),
      }).lean(),
      PostBookmark.countDocuments({
        postId: new Types.ObjectId(postId),
      }),
    ]);

  return {
    ...post,
    hasLiked: !!userLike,
    userReaction: userLike?.reactionType || null,
    hasBookmarked: !!userBookmark,
    hasReposted: !!userRepost,
    bookmarksCount,
  };
}

// ============= Trending Hashtags Functions =============

/**
 * Get trending hashtags/tags in an organization
 */
export async function getTrendingTags(
  orgId: string,
  options: { limit?: number; timeRange?: number } = {}
): Promise<{ tag: string; count: number }[]> {
  const { limit = 10, timeRange = 7 } = options; // Default 7 days

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const trending = await Post.aggregate([
    {
      $match: {
        orgId: new Types.ObjectId(orgId),
        isActive: true,
        createdAt: { $gte: startDate },
        tags: { $exists: true, $ne: [] },
      },
    },
    { $unwind: "$tags" },
    {
      $group: {
        _id: { $toLower: "$tags" },
        count: { $sum: 1 },
        // Weight by engagement
        engagement: {
          $sum: { $add: ["$likesCount", "$commentsCount", "$repostsCount"] },
        },
      },
    },
    {
      $project: {
        tag: "$_id",
        count: 1,
        score: { $add: ["$count", { $multiply: ["$engagement", 0.5] }] },
      },
    },
    { $sort: { score: -1 } },
    { $limit: limit },
    { $project: { _id: 0, tag: 1, count: 1 } },
  ]);

  return trending;
}

/**
 * Search posts by hashtag
 */
export async function searchPostsByTag(
  orgId: string,
  tag: string,
  userId: string,
  options: { limit?: number; offset?: number; isFounder?: boolean } = {}
): Promise<{
  posts: any[];
  total: number;
  pagination: { limit: number; offset: number; hasMore: boolean };
}> {
  const { limit = 20, offset = 0, isFounder = false } = options;

  let channelFilter: Types.ObjectId[] = [];

  if (isFounder) {
    const orgChannels = await Channel.find({ storeId: orgId, isActive: true })
      .select("_id")
      .lean();
    channelFilter = orgChannels.map((c) => c._id as Types.ObjectId);
  } else {
    const memberships = await ChannelMembership.find({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      status: "active",
    })
      .select("channelId")
      .lean();
    channelFilter = memberships.map((m) => m.channelId as Types.ObjectId);
  }

  if (channelFilter.length === 0) {
    return {
      posts: [],
      total: 0,
      pagination: { limit, offset, hasMore: false },
    };
  }

  const filter = {
    orgId: new Types.ObjectId(orgId),
    channelIds: { $in: channelFilter },
    isActive: true,
    tags: { $regex: new RegExp(`^${tag}$`, "i") },
  };

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("authorId", "name email profilePicture")
      .populate("channelIds", "title")
      .populate({
        path: "quotedPostId",
        match: { isActive: true },
        populate: [
          { path: "authorId", select: "name email profilePicture" },
          { path: "channelIds", select: "title" },
        ],
      })
      .lean(),
    Post.countDocuments(filter),
  ]);

  // Check if current user has liked, bookmarked, or reposted each post
  const postIds = posts.map((p) => p._id);

  // Get posts with polls
  const postsWithPolls = posts.filter((p) => p.hasPoll);
  const pollPostIds = postsWithPolls.map((p) => p._id);

  // First fetch polls to get their actual IDs
  const polls: any[] =
    pollPostIds.length > 0
      ? await Poll.find({ postId: { $in: pollPostIds } }).lean()
      : [];

  const pollIds = polls.map((p) => p._id);

  const [userLikes, userBookmarks, userReposts, bookmarkCounts, userPollVotes] =
    await Promise.all([
      PostLike.find({
        postId: { $in: postIds },
        userId: new Types.ObjectId(userId),
      })
        .select("postId reactionType")
        .lean(),
      PostBookmark.find({
        postId: { $in: postIds },
        userId: new Types.ObjectId(userId),
      })
        .select("postId")
        .lean(),
      PostRepost.find({
        postId: { $in: postIds },
        userId: new Types.ObjectId(userId),
      })
        .select("postId")
        .lean(),
      PostBookmark.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: "$postId", count: { $sum: 1 } } },
      ]),
      // Fetch user's votes using actual poll IDs (not post IDs)
      pollIds.length > 0
        ? PollVote.find({
            pollId: { $in: pollIds },
            userId: new Types.ObjectId(userId),
          }).lean()
        : Promise.resolve([]),
    ]);

  const likedPostIds = new Set(userLikes.map((l) => l.postId.toString()));
  const bookmarkedPostIds = new Set(
    userBookmarks.map((b) => b.postId.toString())
  );
  const repostedPostIds = new Set(userReposts.map((r) => r.postId.toString()));
  const bookmarkCountMap = new Map(
    bookmarkCounts.map((b: any) => [b._id.toString(), b.count])
  );

  // Create poll map by postId
  const pollsByPostId = new Map(
    polls.map((poll: any) => [poll.postId.toString(), poll])
  );

  // Create user poll votes map by pollId
  const userVotesByPollId = new Map(
    userPollVotes.map((vote: any) => [vote.pollId.toString(), vote.optionIds])
  );

  // Create a map of postId -> reactionType for userReaction field
  const userReactionMap = new Map(
    userLikes.map((l) => [l.postId.toString(), l.reactionType])
  );

  const postsWithStatus = posts.map((post) => {
    const postIdStr = post._id.toString();
    const poll = pollsByPostId.get(postIdStr);

    let pollData = null;
    if (poll) {
      const isExpired = new Date() > poll.endsAt;
      const userVotedOptions = userVotesByPollId.get(poll._id.toString()) || [];
      pollData = {
        ...poll,
        hasVoted: userVotedOptions.length > 0,
        userVotedOptions,
        isExpired,
      };
    }

    return {
      ...post,
      hasLiked: likedPostIds.has(postIdStr),
      userReaction: userReactionMap.get(postIdStr) || null,
      hasBookmarked: bookmarkedPostIds.has(postIdStr),
      hasReposted: repostedPostIds.has(postIdStr),
      bookmarksCount: bookmarkCountMap.get(postIdStr) || 0,
      poll: pollData,
    };
  });

  return {
    posts: postsWithStatus,
    total,
    pagination: {
      limit,
      offset,
      hasMore: offset + posts.length < total,
    },
  };
}

// ============= Poll Functions =============

export interface CreatePollData {
  postId: string;
  orgId: string;
  question: string;
  options: string[];
  durationHours: number;
  isMultipleChoice?: boolean;
}

/**
 * Create a poll attached to a post
 */
export async function createPoll(data: CreatePollData): Promise<any> {
  const endsAt = new Date();
  endsAt.setHours(endsAt.getHours() + data.durationHours);

  const poll = await Poll.create({
    postId: new Types.ObjectId(data.postId),
    orgId: new Types.ObjectId(data.orgId),
    question: data.question,
    options: data.options.map((text) => ({ text, votesCount: 0 })),
    endsAt,
    isMultipleChoice: data.isMultipleChoice || false,
    isActive: true,
  });

  // Update post to indicate it has a poll
  await Post.findByIdAndUpdate(data.postId, { hasPoll: true });

  return poll;
}

/**
 * Vote on a poll
 */
export async function votePoll(
  pollId: string,
  userId: string,
  optionIds: string[]
): Promise<{ success: boolean; poll: any; message: string }> {
  const poll = await Poll.findById(pollId);

  if (!poll) {
    return { success: false, poll: null, message: "Poll not found" };
  }

  if (!poll.isActive) {
    return { success: false, poll: null, message: "Poll is no longer active" };
  }

  if (new Date() > poll.endsAt) {
    return { success: false, poll: null, message: "Poll has ended" };
  }

  // Check if multiple choice is allowed
  if (!poll.isMultipleChoice && optionIds.length > 1) {
    return {
      success: false,
      poll: null,
      message: "This poll only allows single choice",
    };
  }

  // Validate option IDs
  const validOptionIds = poll.options.map((o) => o._id.toString());
  const invalidOptions = optionIds.filter((id) => !validOptionIds.includes(id));
  if (invalidOptions.length > 0) {
    return { success: false, poll: null, message: "Invalid option selected" };
  }

  // Check if user already voted
  const existingVote = await PollVote.findOne({
    pollId: new Types.ObjectId(pollId),
    userId: new Types.ObjectId(userId),
  });

  if (existingVote) {
    return { success: false, poll: null, message: "You have already voted" };
  }

  // Create vote
  await PollVote.create({
    pollId: new Types.ObjectId(pollId),
    userId: new Types.ObjectId(userId),
    optionIds: optionIds.map((id) => new Types.ObjectId(id)),
  });

  // Update vote counts
  for (const optionId of optionIds) {
    await Poll.updateOne(
      { _id: pollId, "options._id": new Types.ObjectId(optionId) },
      { $inc: { "options.$.votesCount": 1, totalVotes: 1 } }
    );
  }

  // Get updated poll
  const updatedPoll = await Poll.findById(pollId).lean();

  return { success: true, poll: updatedPoll, message: "Vote recorded" };
}

/**
 * Get poll by post ID
 */
export async function getPollByPostId(
  postId: string,
  userId: string
): Promise<any | null> {
  const poll = await Poll.findOne({
    postId: new Types.ObjectId(postId),
  }).lean();

  if (!poll) return null;

  // Check if user has voted
  const userVote = await PollVote.findOne({
    pollId: poll._id,
    userId: new Types.ObjectId(userId),
  }).lean();

  const isExpired = new Date() > poll.endsAt;

  return {
    ...poll,
    hasVoted: !!userVote,
    userVotedOptions: userVote?.optionIds || [],
    isExpired,
  };
}

/**
 * Get poll results (after voting or poll end)
 */
export async function getPollResults(pollId: string): Promise<{
  poll: any;
  results: {
    optionId: string;
    text: string;
    votes: number;
    percentage: number;
  }[];
}> {
  const poll = await Poll.findById(pollId).lean();

  if (!poll) {
    throw new Error("Poll not found");
  }

  const results = poll.options.map((option) => ({
    optionId: option._id.toString(),
    text: option.text,
    votes: option.votesCount,
    percentage:
      poll.totalVotes > 0
        ? Math.round((option.votesCount / poll.totalVotes) * 100)
        : 0,
  }));

  return { poll, results };
}

// ============= Share Link Functions =============

/**
 * Generate a shareable link for a post
 */
export function generateShareLink(
  postId: string,
  orgSlug: string,
  frontendUrl: string,
  affiliateId?: string,
  postType?: string
): string {
  // Articles get their own URL path for richer metadata/reading experience
  const pathSegment = postType === "article" ? "article" : "post";
  // Canonical deep-link shape: /hq/{orgSlug}/{type}/{id}. The mobile app
  // claims /hq/* via universal links and opens these directly; the web app's
  // /hq/[slug]/[[...rest]] fallback forwards everyone else to the /guest
  // experience. Keep in lockstep with garage-chat lib/link-intent.ts.
  const base = `${frontendUrl}/hq/${orgSlug}/${pathSegment}/${postId}`;
  return affiliateId ? `${base}?referCode=${affiliateId}` : base;
}

// ============= Pin Post Functions =============

/**
 * Pin a post for the org. Atomically unpins any previously pinned post first.
 * Only one post can be pinned per org at any time.
 */
export async function pinPost(
  postId: string,
  orgId: string
): Promise<any> {
  // Unpin any existing pinned post in this org
  await Post.updateMany(
    { orgId: new Types.ObjectId(orgId), isPinned: true },
    { $set: { isPinned: false } }
  );

  // Pin the requested post
  const post = await Post.findOneAndUpdate(
    { _id: new Types.ObjectId(postId), orgId: new Types.ObjectId(orgId), isActive: true },
    { $set: { isPinned: true } },
    { new: true }
  );

  if (!post) {
    throw new Error("Post not found");
  }

  return post;
}

/**
 * Unpin a post. No-op if the post is not pinned.
 */
export async function unpinPost(
  postId: string,
  orgId: string
): Promise<void> {
  await Post.findOneAndUpdate(
    { _id: new Types.ObjectId(postId), orgId: new Types.ObjectId(orgId) },
    { $set: { isPinned: false } }
  );
}
