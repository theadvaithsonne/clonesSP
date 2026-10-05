# `server/services/feed.ts`

> Module exporting `createPost`, `createPostMentionNotifications`, `getPosts`, `getPostById` and 44 more.

**Kind:** backend service · **Lines:** 2781

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreatePostData` | interface |  | 23 |
| `createPost` | function | `async createPost(data: CreatePostData): Promise<IPost>` — Create a new post | 74 |
| `createPostMentionNotifications` | function | `async createPostMentionNotifications(postId: string, authorId: string, orgId: string, content: string, mentionedUserIds: string[], channelId?: string): Promise<void>` — Create notifications for mentioned users in a post Only notifies users who are members of the channel | 116 |
| `getPosts` | function | `async getPosts(userId: string, orgId: string, options: { channelId?: string; postType?: 'post' \| 'article…): Promise<{ posts: any[]; total: number; pagination…` — Get posts for a user based on their channel memberships Founders see all posts in the org | 251 |
| `getPostById` | function | `async getPostById(postId: string, userId: string): Promise<any \| null>` — Get a single post by ID | 449 |
| `updatePost` | function | `async updatePost(postId: string, authorId: string, data: { content?: string; channelIds?: string[]; tags?: str…): Promise<IPost \| null>` — Update a post | 537 |
| `deletePost` | function | `async deletePost(postId: string, authorId: string, isFounder: boolean = false): Promise<boolean>` — Delete a post (soft delete) | 609 |
| `likePost` | function | `async likePost(postId: string, userId: string, orgId: string): Promise<{ success: boolean; likesCount: number }>` — Like a post | 633 |
| `unlikePost` | function | `async unlikePost(postId: string, userId: string): Promise<{ success: boolean; likesCount: number }>` — Unlike a post | 666 |
| `toggleLike` | function | `async toggleLike(postId: string, userId: string, orgId: string): Promise<{ liked: boolean; likesCount: number }>` — Toggle like on a post | 692 |
| `toggleReaction` | function | `async toggleReaction(postId: string, userId: string, orgId: string, reactionType: ReactionType): Promise<{ reacted: boolean; reactionType: Reactio…` — Toggle reaction on a post (add, change, or remove) - If no existing reaction: adds the reaction - If same reaction exists: removes it - If different reaction exists: changes to new reaction | 736 |
| `removeReaction` | function | `async removeReaction(postId: string, userId: string): Promise<{ success: boolean; reactionsCount: IReac…` — Remove a user's reaction from a post | 836 |
| `getPostReactions` | function | `async getPostReactions(postId: string, options: { reactionType?: ReactionType; limit?: number; off…): Promise<{ reactions: Array<{ user: { _id: string;…` — Get users who reacted to a post | 880 |
| `toggleCommentReaction` | function | `async toggleCommentReaction(commentId: string, userId: string, orgId: string, reactionType: ReactionType): Promise<{ reacted: boolean; reactionType: Reactio…` — Same toggle-or-swap semantics as `toggleReaction`, but keyed to a single PostComment. | 959 |
| `removeCommentReaction` | function | `async removeCommentReaction(commentId: string, userId: string): Promise<{ reactionsCount: IReactionsCount }>` — Remove the current user's reaction on a comment (DELETE handler). | 1043 |
| `getUserReaction` | function | `async getUserReaction(postId: string, userId: string): Promise<ReactionType \| null>` — Get user's reaction on a post | 1070 |
| `addComment` | function | `async addComment(postId: string, userId: string, orgId: string, content: string, parentCommentId?: string, mentions?: string[], attachments?: { type: "image" \| "video" \| "document" \| "aud…)…` — Add a comment to a post | 1087 |
| `createCommentMentionNotifications` | function | `async createCommentMentionNotifications(commentId: string, postId: string, authorId: string, orgId: string, content: string, mentionedUserIds: string[]): Promise<void>` — Create notifications for mentioned users in a comment Only notifies users who are members of the post's channel | 1133 |
| `getComments` | function | `async getComments(postId: string, options: { limit?: number; offset?: number; parentCommentId…): Promise<{ comments: any[]; total: number }>` — Get comments for a post - If parentCommentId is undefined, returns ALL comments (both top-level and replies) - If parentCommentId is null, returns only top-level comments - If parentCommentId is a valid ID, returns only replies to that com… | 1273 |
| `deleteComment` | function | `async deleteComment(commentId: string, userId: string, isFounder: boolean = false): Promise<boolean>` — Delete a comment (soft delete) | 1314 |
| `updateComment` | function | `async updateComment(commentId: string, userId: string, content: string): Promise<any \| null>` — Edit a comment's content. | 1345 |
| `getUserChannels` | function | `async getUserChannels(userId: string, orgId: string): Promise<any[]>` — Get user's subscribed channels in an org | 1368 |
| `getOrgChannels` | function | `async getOrgChannels(orgId: string): Promise<any[]>` — Get all channels in an org | 1400 |
| `subscribeToFreeChannel` | function | `async subscribeToFreeChannel(userId: string, channelId: string, orgId: string): Promise<{ success: boolean; message: string }>` — Subscribe to a free channel | 1493 |
| `unsubscribeFromChannel` | function | `async unsubscribeFromChannel(userId: string, channelId: string): Promise<{ success: boolean; message: string; // O…` — Unsubscribe a user from a channel (community-style "leave"). | 1607 |
| `subscribeToPaidChannel` | function | `async subscribeToPaidChannel(userId: string, channelId: string, orgId: string, paymentDetails: { razorpayPaymentId: string; razorpayOrderI…): Promise<{ success: boolean; message: string }>` — Subscribe to a paid channel (after payment verification) NOTE: Wallet crediting is now handled by distributeCommissions() in the route This function only handles subscription/membership logic | 1831 |
| `canUserPostToChannels` | function | `async canUserPostToChannels(userId: string, orgId: string, channelIds: string[], isFounder: boolean): Promise<{ canPost: boolean; invalidChannels: stri…` — Check if user can post to channels Returns invalidChannels (not subscribed) and restrictedChannels (muted by founder) | 1879 |
| `canUserViewPost` | function | `async canUserViewPost(userId: string, orgId: string, postChannelIds: Types.ObjectId[], isFounder: boolean): Promise<boolean>` — Check if user can view a post (is member of at least one channel) | 1925 |
| `repostPost` | function | `async repostPost(postId: string, userId: string, orgId: string): Promise<{ success: boolean; repostsCount: number …` — Repost a post | 1947 |
| `unrepostPost` | function | `async unrepostPost(postId: string, userId: string): Promise<{ success: boolean; repostsCount: number …` — Remove repost | 1980 |
| `toggleRepost` | function | `async toggleRepost(postId: string, userId: string, orgId: string): Promise<{ reposted: boolean; repostsCount: number…` — Toggle repost on a post | 2006 |
| `hasUserReposted` | function | `async hasUserReposted(postId: string, userId: string): Promise<boolean>` — Check if user has reposted a post | 2028 |
| `getPostReposts` | function | `async getPostReposts(postId: string, options: { limit?: number; offset?: number } = {}): Promise<{ reposts: any[]; total: number }>` — Get users who reposted a post | 2042 |
| `bookmarkPost` | function | `async bookmarkPost(postId: string, userId: string, orgId: string): Promise<{ success: boolean; message: string }>` — Bookmark a post | 2066 |
| `unbookmarkPost` | function | `async unbookmarkPost(postId: string, userId: string): Promise<{ success: boolean; message: string }>` — Remove bookmark | 2091 |
| `toggleBookmark` | function | `async toggleBookmark(postId: string, userId: string, orgId: string): Promise<{ bookmarked: boolean; message: string }>` — Toggle bookmark on a post | 2110 |
| `getUserBookmarks` | function | `async getUserBookmarks(userId: string, orgId: string, options: { limit?: number; offset?: number } = {}): Promise<{ posts: any[]; total: number; pagination…` — Get user's bookmarked posts | 2132 |
| `hasUserBookmarked` | function | `async hasUserBookmarked(postId: string, userId: string): Promise<boolean>` — Check if user has bookmarked a post | 2208 |
| `CreateQuotePostData` | interface |  | 2221 |
| `createQuotePost` | function | `async createQuotePost(data: CreateQuotePostData): Promise<IPost>` — Create a quote post (post with quoted post) | 2247 |
| `getPostWithQuote` | function | `async getPostWithQuote(postId: string, userId: string): Promise<any \| null>` — Get a post with its quoted post populated | 2279 |
| `getTrendingTags` | function | `async getTrendingTags(orgId: string, options: { limit?: number; timeRange?: number } = {}): Promise<{ tag: string; count: number }[]>` — Get trending hashtags/tags in an organization | 2333 |
| `searchPostsByTag` | function | `async searchPostsByTag(orgId: string, tag: string, userId: string, options: { limit?: number; offset?: number; isFounder?: boo…): Promise<{ posts: any[]; total: number; pagination…` — Search posts by hashtag | 2380 |
| `CreatePollData` | interface |  | 2556 |
| `createPoll` | function | `async createPoll(data: CreatePollData): Promise<any>` — Create a poll attached to a post | 2568 |
| `votePoll` | function | `async votePoll(pollId: string, userId: string, optionIds: string[]): Promise<{ success: boolean; poll: any; message: s…` — Vote on a poll | 2591 |
| `getPollByPostId` | function | `async getPollByPostId(postId: string, userId: string): Promise<any \| null>` — Get poll by post ID | 2660 |
| `getPollResults` | function | `async getPollResults(pollId: string): Promise<{ poll: any; results: { optionId: string;…` — Get poll results (after voting or poll end) | 2689 |
| `generateShareLink` | function | `generateShareLink(postId: string, orgSlug: string, frontendUrl: string, affiliateId?: string, postType?: string): string` — Generate a shareable link for a post | 2722 |
| `pinPost` | function | `async pinPost(postId: string, orgId: string): Promise<any>` — Pin a post for the org. | 2745 |
| `unpinPost` | function | `async unpinPost(postId: string, orgId: string): Promise<void>` — Unpin a post. No-op if the post is not pinned. | 2772 |

## Interfaces

- **Socket.IO events:**
  - emits: `notification:new`
- **Database (Mongoose models used):**
  - `Post` (server/models/post.model.ts) — reads: `find`, `countDocuments`, `findById`, `aggregate`; **writes:** `create`, `findOneAndUpdate`, `findByIdAndUpdate`, `updateMany`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Channel` (server/models/channel.model.ts) — reads: `findById`, `find`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `find`, `aggregate`, `findOne`; **writes:** `create`
  - `Notification` (server/models/notification.model.ts) — **writes:** `create`
  - `UserNotification` (server/models/userNotification.model.ts) — **writes:** `create`
  - `Poll` (server/models/poll.model.ts) — reads: `find`, `findOne`, `findById`; **writes:** `create`, `updateOne`
  - `PostLike` (server/models/postLike.model.ts) — reads: `find`, `findOne`, `countDocuments`, `aggregate`; **writes:** `create`, `findOneAndDelete`, `findByIdAndDelete`
  - `PostBookmark` (server/models/postBookmark.model.ts) — reads: `find`, `aggregate`, `findOne`, `countDocuments`; **writes:** `create`, `findOneAndDelete`
  - `PostRepost` (server/models/postRepost.model.ts) — reads: `find`, `findOne`, `countDocuments`; **writes:** `create`, `findOneAndDelete`
  - `PollVote` (server/models/pollVote.model.ts) — reads: `find`, `findOne`; **writes:** `create`
  - `REACTION_TYPES` (server/models/postLike.model.ts) — referenced
  - `PostCommentLike` (server/models/postCommentLike.model.ts) — reads: `findOne`; **writes:** `findByIdAndDelete`, `create`
  - `PostComment` (server/models/postComment.model.ts) — reads: `findById`, `find`, `countDocuments`; **writes:** `findByIdAndUpdate`, `create`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/models/post.model.ts` — `Post`, `IPost`, `IReactionsCount`
  - `server/models/postLike.model.ts` — `PostLike`, `ReactionType`, `REACTION_TYPES`
  - `server/models/postComment.model.ts` — `PostComment`
  - `server/models/postCommentLike.model.ts` — `PostCommentLike`
  - `server/models/postRepost.model.ts` — `PostRepost`
  - `server/models/postBookmark.model.ts` — `PostBookmark`
  - `server/models/poll.model.ts` — `Poll`
  - `server/models/pollVote.model.ts` — `PollVote`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/user.model.ts` — `User`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/notification.model.ts` — `Notification`
  - `server/models/userNotification.model.ts` — `UserNotification`
  - `server/utils/mentions.ts` — `parseMentions`
  - `server/services/socket.ts` — `getSocketInstance`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/feed.ts`

## Notes

- Large file (2781 lines) — read it by section; line numbers above point into it.
