# `server/routes/feed.ts`

> Express router with 58 endpoints, mounted at `/feed`.

**Kind:** Express router · **Lines:** 6043 · **Mounted at:** `/feed` (browser: `/backend/feed`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (58)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/posts/:postId/pin` | `/backend/feed/posts/:postId/pin` | `requireAuth` | inline | 226 |
| DELETE | `/posts/:postId/pin` | `/backend/feed/posts/:postId/pin` | `requireAuth` | inline | 259 |
| GET | `/posts` | `/backend/feed/posts` | `requireAuth` | inline | 292 |
| GET | `/posts/:postId` | `/backend/feed/posts/:postId` | `requireAuth` | inline | 340 |
| POST | `/posts` | `/backend/feed/posts` | `requireAuth` | inline | 384 |
| PUT | `/posts/:postId` | `/backend/feed/posts/:postId` | `requireAuth` | inline | 569 |
| DELETE | `/posts/:postId` | `/backend/feed/posts/:postId` | `requireAuth` | inline | 647 |
| POST | `/posts/:postId/like` | `/backend/feed/posts/:postId/like` | `requireAuth` | inline | 683 |
| POST | `/posts/:postId/react` | `/backend/feed/posts/:postId/react` | `requireAuth` | inline | 731 |
| DELETE | `/posts/:postId/react` | `/backend/feed/posts/:postId/react` | `requireAuth` | inline | 787 |
| GET | `/posts/:postId/reactions` | `/backend/feed/posts/:postId/reactions` | `requireAuth` | inline | 825 |
| GET | `/posts/:postId/comments` | `/backend/feed/posts/:postId/comments` | `requireAuth` | inline | 869 |
| POST | `/posts/:postId/comments` | `/backend/feed/posts/:postId/comments` | `requireAuth` | inline | 928 |
| POST | `/comments/:commentId/react` | `/backend/feed/comments/:commentId/react` | `requireAuth` | inline | 1099 |
| DELETE | `/comments/:commentId/react` | `/backend/feed/comments/:commentId/react` | `requireAuth` | inline | 1178 |
| PUT | `/comments/:commentId` | `/backend/feed/comments/:commentId` | `requireAuth` | inline | 1220 |
| DELETE | `/comments/:commentId` | `/backend/feed/comments/:commentId` | `requireAuth` | inline | 1256 |
| GET | `/channels` | `/backend/feed/channels` | `requireAuth` | inline | 1292 |
| GET | `/channels/subscribed` | `/backend/feed/channels/subscribed` | `requireAuth` | inline | 1317 |
| POST | `/channels/:channelId/subscribe` | `/backend/feed/channels/:channelId/subscribe` | `requireAuth` | inline | 1362 |
| DELETE | `/channels/:channelId/subscribe` | `/backend/feed/channels/:channelId/subscribe` | `requireAuth` | inline | 1414 |
| POST | `/channels/:channelId/create-order` | `/backend/feed/channels/:channelId/create-order` | `requireAuth` | inline | 1447 |
| POST | `/channels/:channelId/create-subscription` | `/backend/feed/channels/:channelId/create-subscription` | `requireAuth` | inline | 1576 |
| GET | `/channels/:channelId/subscription-status` | `/backend/feed/channels/:channelId/subscription-status` | `requireAuth` | inline | 1912 |
| POST | `/channels/:channelId/verify-payment` | `/backend/feed/channels/:channelId/verify-payment` | `requireAuth` | inline | 1959 |
| POST | `/channels` | `/backend/feed/channels` | `requireAuth` | inline | 2055 |
| PUT | `/channels/:channelId` | `/backend/feed/channels/:channelId` | `requireAuth` | inline | 2284 |
| DELETE | `/channels/:channelId` | `/backend/feed/channels/:channelId` | `requireAuth` | inline | 2509 |
| PUT | `/channels/:channelId/set-default` | `/backend/feed/channels/:channelId/set-default` | `requireAuth` | inline | 2556 |
| GET | `/channels/:channelId` | `/backend/feed/channels/:channelId` | `requireAuth` | inline | 2606 |
| GET | `/customers` | `/backend/feed/customers` | `requireAuth` | inline | 2662 |
| GET | `/channels/:channelId/subscribers` | `/backend/feed/channels/:channelId/subscribers` | `requireAuth` | inline | 2804 |
| PUT | `/channels/:channelId/members/:userId/posting` | `/backend/feed/channels/:channelId/members/:userId/posting` | `requireAuth` | inline | 3063 |
| GET | `/stats` | `/backend/feed/stats` | `requireAuth` | inline | 3133 |
| GET | `/channels/analytics` | `/backend/feed/channels/analytics` | `requireAuth` | inline | 3253 |
| GET | `/founder/invoices` | `/backend/feed/founder/invoices` | `requireAuth` | inline | 3637 |
| GET | `/founder/item-users` | `/backend/feed/founder/item-users` | `requireAuth` | inline | 3954 |
| GET | `/founder/user-detail` | `/backend/feed/founder/user-detail` | `requireAuth` | inline | 4314 |
| GET | `/founder/unsub-log` | `/backend/feed/founder/unsub-log` | `requireAuth` | inline | 4560 |
| GET | `/founder/product-refunds` | `/backend/feed/founder/product-refunds` | `requireAuth` | inline | 4884 |
| POST | `/posts/:postId/repost` | `/backend/feed/posts/:postId/repost` | `requireAuth` | inline | 5050 |
| GET | `/posts/:postId/reposts` | `/backend/feed/posts/:postId/reposts` | `requireAuth` | inline | 5093 |
| POST | `/posts/:postId/bookmark` | `/backend/feed/posts/:postId/bookmark` | `requireAuth` | inline | 5131 |
| GET | `/bookmarks` | `/backend/feed/bookmarks` | `requireAuth` | inline | 5158 |
| POST | `/posts/quote` | `/backend/feed/posts/quote` | `requireAuth` | inline | 5198 |
| GET | `/posts/:postId/share` | `/backend/feed/posts/:postId/share` | `requireAuth` | inline | 5325 |
| GET | `/videos/:videoId/share` | `/backend/feed/videos/:videoId/share` | `requireAuth` | inline | 5374 |
| GET | `/playlists/:playlistId/share` | `/backend/feed/playlists/:playlistId/share` | `requireAuth` | inline | 5453 |
| GET | `/trending/tags` | `/backend/feed/trending/tags` | `requireAuth` | inline | 5507 |
| GET | `/search/tag/:tag` | `/backend/feed/search/tag/:tag` | `requireAuth` | inline | 5542 |
| POST | `/posts/poll` | `/backend/feed/posts/poll` | `requireAuth` | inline | 5590 |
| GET | `/posts/:postId/poll` | `/backend/feed/posts/:postId/poll` | `requireAuth` | inline | 5726 |
| POST | `/polls/:pollId/vote` | `/backend/feed/polls/:pollId/vote` | `requireAuth` | inline | 5758 |
| GET | `/polls/:pollId/results` | `/backend/feed/polls/:pollId/results` | `requireAuth` | inline | 5805 |
| POST | `/admin/clean-article-hrefs` | `/backend/feed/admin/clean-article-hrefs` | `requireAuth` | inline | 5834 |
| GET | `/activity` | `/backend/feed/activity` | `requireAuth` | inline | 5951 |
| GET | `/activity/unread-count` | `/backend/feed/activity/unread-count` | `requireAuth` | inline | 6005 |
| POST | `/activity/read-all` | `/backend/feed/activity/read-all` | `requireAuth` | inline | 6026 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 6042 |

## Interfaces

- **Socket.IO events:**
  - emits: `feed:post-pinned`, `feed:post-unpinned`, `feed:new-post`, `feed:post-liked`, `feed:post-reacted`, `feed:new-comment`, `feed:comment-reacted`, `feed:post-reposted`, `feed:poll-voted`
- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `find`, `findOne`, `countDocuments`, `aggregate`; **writes:** `findOneAndUpdate`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `PostCommentLike` (server/models/postCommentLike.model.ts) — reads: `find`
  - `PostComment` (server/models/postComment.model.ts) — reads: `findById`
  - `Channel` (server/models/channel.model.ts) — reads: `findById`, `findOne`, `countDocuments`, `find`; **writes:** `create`, `findOneAndUpdate`
  - `emailAlertsZodSchema` (server/models/emailAlerts.schema.ts) — referenced
  - `founderAlertsZodSchema` (server/models/founderAlerts.schema.ts) — referenced
  - `Invoice` (server/models/invoice.model.ts) — reads: `aggregate`, `find`, `countDocuments`
  - `AffiliateConversion` (server/models/affiliateConversion.model.ts) — reads: `aggregate`
  - `Workshop` (server/models/workshop.model.ts) — reads: `find`, `findById`
  - `Course` (server/models/course.model.ts) — reads: `find`
  - `Product` (server/models/product.model.ts) — reads: `find`
  - `ProductOrder` (server/models/productOrder.model.ts) — reads: `find`, `countDocuments`
- **Environment variables (`process.env`):** `RAZORPAY_KEY_ID`, `FRONTEND_URL`
- **External hosts mentioned in the code:** `app.roam.com`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/rbac.ts` — `isFounderOrModuleAdmin`
  - `server/models/user.model.ts` — `User`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/emailAlerts.schema.ts` — `emailAlertsZodSchema`, `normalizeEmailAlerts`
  - `server/models/founderAlerts.schema.ts` — `founderAlertsZodSchema`, `normalizeFounderAlerts`
  - `server/services/thankYouPage.ts` — `normalizeThankYouPage`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/postComment.model.ts` — `PostComment`
  - `server/models/postCommentLike.model.ts` — `PostCommentLike`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/services/feed.ts` — `createPost`, `getPosts`, `getPostById`, `updatePost`, `deletePost`, `toggleLike`, `addComment`, `updateComment`, … +30
  - `server/services/feedActivity.ts` — `FEED_ACTIVITY_TYPES`, `FeedActivityType`, `getFeedActivity`, `getUnreadActivityCount`, `markActivityRead`
  - `server/utils/mentions.ts` — `parseMentions`
  - `server/services/pushNotification.ts` — `sendFeedEngagementPushNotification`, `FeedEngagement`
  - `server/models/postLike.model.ts` — `REACTION_TYPES`, `ReactionType`
  - `server/services/razorpay.ts` — `createChannelSubscriptionOrder`, `verifyPaymentSignature`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/bulkEmail.ts` — `notifyNewChannelCreated`, `notifyNewFeedPostCreated`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/utils/exchangeRate.ts` — `convertToUsd`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/course.model.ts` — `Course`
  - `server/models/product.model.ts` — `Product`
  - `server/models/productOrder.model.ts` — `ProductOrder`
  - `server/models/affiliateConversion.model.ts` — `AffiliateConversion`
  - `server/services/channel.ts` — `setDefaultChannel`, `clearDefaultChannel`, `setChannelMandatory`, `clearMandatoryIfPaid`
  - `server/services/subscription.ts` — `createSubscriptionPlan`, `getSubscriptionPlanForItem`, `createUserSubscription`, `hasSubscriptionAccess`, `getUserActiveSubscription`
  - `server/models/subscriptionPlan.model.ts` — `SubscriptionPlan`
  - `server/models/subscription.model.ts` — `Subscription`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/feed`.

## Notes

- Large file (6043 lines) — read it by section; line numbers above point into it.
