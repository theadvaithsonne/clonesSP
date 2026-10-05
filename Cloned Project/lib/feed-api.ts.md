# `lib/feed-api.ts`

> The frontend's largest typed API client: about 300 thin `fetch` wrappers and the TypeScript types for feed posts, communities (channels), live streams (workshops), courses, videos, playlists, products, wallets, commission plans, subscriptions, services, paid calls, Unilevel Plus, reserve licences, invoices and service Taskroom engagements.

**Kind:** frontend library · **Lines:** 9065

## Purpose
The file began as the client for the backend `/feed` routes (its header still says "Connects to our roam-backend /feed endpoints"). It has since become the main typed gateway from the browser to most of the Express API in `server/`. Each exported function builds one URL and sends one request through a shared helper that adds the bearer token and turns error responses into `Error`s. Each one returns the parsed JSON, or a picked subset of it. It holds no React state and no caching. The UI components that import it (102 files) own all state.

All URLs are built from `NEXT_PUBLIC_API_URL`, which in the combined project is `<app origin>/backend`. A call written as `` `${API_BASE}/feed/posts` `` therefore reaches the Express router mounted at `/feed` in `server/app.ts`, at the browser path `/backend/feed/posts`.

## How it works

### Core plumbing (L1-L334)
- `API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"` (L5).
- `getOrgId()` (L301, private) reads the current organisation from `localStorage["garage_org_id"]` and returns `null` during SSR. Older sections (channels, feed, workshops, founder tables) take `orgId` as an explicit argument. Newer sections (courses, videos, playlists, products, services, calls, study sessions, sellables, engagements) call `getOrgId()` themselves and append `?orgId=` only when it is set.
- `fetchFromBackend<T>(endpoint, options)` (L306, private) sends `fetch(API_BASE + endpoint)` with `Content-Type: application/json` and `Authorization: Bearer <getToken()>` when a token exists. Caller headers override these. On a non-2xx response it throws `new Error(error.error || error.message || error.details || "API Error: <status>")`. Otherwise it returns `response.json()`.
- Most wrappers return the raw backend body. Some unwrap it, for example `getOrgChannels` returns `{ channels }` and `getTeamMembers` returns just the array.
- A few functions skip the helper on purpose. Each is called out in its section and summarised under Notes.

### Reactions and core feed types (L7-L297)
- `REACTION_TYPES` (`like, love, fire, haha, wow, sad, angry`), the `ReactionType` union, and `REACTION_EMOJIS` / `REACTION_LABELS` lookup maps for the reaction picker.
- Types: `ReactionsCount`, `PostReaction`, `ChannelBenefit`, `ChannelReview`, `ChannelFaq`, `Channel`, `SubscribedChannel`, `PostAttachment`, `LinkPreviewData`, `PostAuthor`, `PostChannel`, `Post`, `PollOption`, `Poll`, `PollResult`, `PostRepost`, `QuotedPost`, `TrendingTag`, `CommentAttachment`, `Comment`, `Pagination`.
- `Post.likesCount` and `Post.hasLiked` are marked deprecated in favour of `reactionsCount.total` and `userReaction`.
- `SubscribedChannel.subscriptionStatus === "cancelled"` together with `accessUntil` drives the "Cancelling - access until X" badge.

### Channel (community) membership and purchase (L336-L580)
| Function | Request |
|---|---|
| `getOrgChannels(orgId)` | `GET /backend/feed/channels?orgId=` |
| `getSubscribedChannels(orgId)` | `GET /backend/feed/channels/subscribed?orgId=` (also returns `isFounder`, default false) |
| `subscribeToFreeChannel(channelId, orgId)` | `POST /backend/feed/channels/:id/subscribe` |
| `unsubscribeFromChannel(channelId, orgId)` | `DELETE /backend/feed/channels/:id/subscribe` and returns `UnsubscribeResponse` |
| `createChannelOrder(channelId, orgId, {quantity, forReserve})` | `POST /backend/feed/channels/:id/create-order` (Razorpay order plus optional `invoiceId`) |
| `verifyChannelPayment(channelId, orgId, razorpay ids)` | `POST /backend/feed/channels/:id/verify-payment` |
| `createChannelSubscription(channelId, orgId)` | `POST /backend/feed/channels/:id/create-subscription` (Razorpay mandate, `razorpayKeyId`) |
| `getChannelSubscriptionStatus(channelId, orgId)` | `GET /backend/feed/channels/:id/subscription-status` |
| `getChannelMembershipDetails(channelId, orgId)` | Same endpoint, normalised for the membership sidebar |

`UnsubscribeStatus` is one of three values: `cancelled_immediately` (free or one-time paid channels), `cancelling_at_cycle_end` (recurring paid channels, where access lasts until `accessUntil`) and `already_inactive` (an idempotent no-op).

`getChannelMembershipDetails` derives several fields itself:
- `isFree` means "a membership exists but no subscription does".
- `nextBillingDate` is `subscription.currentEnd`.
- `lastBillingDate` is `currentEnd` minus a fixed 30 days.
- `amount` is `plan.amount / 100`, converting paise or cents to major units.

### Posts, reactions, reposts, bookmarks, pins, shares, tags, polls, comments (L582-L1255)
| Function | Request |
|---|---|
| `getPosts(orgId, {channelId, postType, limit, offset})` | `GET /backend/feed/posts` |
| `getPost(postId, orgId)` | `GET /backend/feed/posts/:id` |
| `createPost({...})` | `POST /backend/feed/posts` (posts and articles: `postType`, `title`, `coverImage`, `linkPreviews`) |
| `updatePost(postId, data)` | `PUT /backend/feed/posts/:id` (no orgId) |
| `deletePost(postId, orgId)` | `DELETE /backend/feed/posts/:id` |
| `toggleLike` | `POST /backend/feed/posts/:id/like` (legacy) |
| `toggleReaction(postId, orgId, type)` | `POST /backend/feed/posts/:id/react`: adds the reaction, removes it if it is the same one, or switches to the new one |
| `removeReaction` | `DELETE /backend/feed/posts/:id/react` (maps `removed` to `success`) |
| `getPostReactions(postId, {reactionType, limit, offset})` | `GET /backend/feed/posts/:id/reactions` |
| `toggleRepost` / `getPostReposts` | `POST /backend/feed/posts/:id/repost` / `GET .../reposts` |
| `toggleBookmark` / `getBookmarkedPosts` | `POST /backend/feed/posts/:id/bookmark` / `GET /backend/feed/bookmarks` |
| `pinPost` / `unpinPost` | `POST` / `DELETE /backend/feed/posts/:id/pin` |
| `createQuotePost` | `POST /backend/feed/posts/quote` |
| `getPostShareLink` | `GET /backend/feed/posts/:id/share` |
| `getVideoShareLink(videoId, orgId, videoType, recordingId?)` | `GET /backend/feed/videos/:id/share?videoType=&recordingId=` |
| `getPlaylistShareLink` | `GET /backend/feed/playlists/:id/share` |
| `getTrendingTags(orgId, {limit, timeRange})` | `GET /backend/feed/trending/tags` |
| `searchPostsByTag(tag, orgId, …)` | `GET /backend/feed/search/tag/:tag` (URL-encoded) |
| `createPollPost` / `getPostPoll` | `POST /backend/feed/posts/poll` / `GET /backend/feed/posts/:id/poll` |
| `voteOnPoll(pollId, optionIds)` / `getPollResults` | `POST /backend/feed/polls/:id/vote` / `GET .../results` |
| `getComments(postId, {limit, offset, parentCommentId})` | `GET /backend/feed/posts/:id/comments` |
| `addComment(postId, orgId, content, parentCommentId?, attachments?)` | `POST /backend/feed/posts/:id/comments` (empty `attachments` is sent as undefined) |
| `updateComment` / `deleteComment` | `PUT` / `DELETE /backend/feed/comments/:id` |
| `toggleCommentReaction` / `removeCommentReaction` | `POST` / `DELETE /backend/feed/comments/:id/react` |

`getTopReactions(reactionsCount, max = 3)` is the only pure helper here. It returns the reaction types with a non-zero count, sorted by count.

`getVideoShareLink` has extra logic:
- It accepts compound recording-card ids (`workshopId__recordingId`) and splits them.
- For `videoType === "workshop"` with no recording id, it first calls `getWorkshopRecordings` and uses the newest recording. The backend links to the playable `/guest/:slug/recording/:recordingId` page only when it receives a recording id. Without one, the generic video page shows "Video unavailable".
- If that lookup fails, it logs the error and falls back to the plain link.

### Founder channel management and analytics (L1257-L2028)
- `createChannel`, `updateChannel`, `deleteChannel`, `getChannelWithStats` call `POST /backend/feed/channels`, then `PUT`, `DELETE` and `GET /backend/feed/channels/:id`. `setChannelDefault` calls `PUT /backend/feed/channels/:id/set-default`.
- In `updateChannel`, `thankYouPage` is tri-state: leave it undefined to keep the value, send `null` to clear it (the backend `$unset`s it), or send an object to write it.
- `getCustomers(orgId, {channelId, status, …})` calls `GET /backend/feed/customers`.
- `getChannelSubscribers(channelId, orgId, {membershipFilter, search, …})` calls `GET /backend/feed/channels/:id/subscribers`. Buckets are `active`, `cancelling`, `expired` and `all`. The response includes `counts` and a USD `lifetimeValueUsd` per member.
- `toggleMemberPosting(channelId, userId, orgId, canPost)` calls `PUT /backend/feed/channels/:id/members/:userId/posting`.
- `getFeedStats` calls `GET /backend/feed/stats`.
- `getChannelAnalytics` calls `GET /backend/feed/channels/analytics`. It powers `components/dashboard/ChannelsPage.tsx`. Money is already converted to USD by the backend. `monthlyRevenueUsd: null` means a one-time channel.
- `getFounderInvoices(orgId, itemType, filters)` calls `GET /backend/feed/founder/invoices`. `getFounderItemUsers` calls `GET /backend/feed/founder/item-users`. `getFounderUserDetail` calls `GET /backend/feed/founder/user-detail`. `itemType` is one of `channel`, `workshop`, `course`, `product`. Filters with undefined, null or empty values are dropped from the query string. Invoice `totalAmount` is in the smallest currency unit.
- `getFounderUnsubLog(orgId, itemKind, filters)` calls `GET /backend/feed/founder/unsub-log`. It covers channel and workshop unsubscribes and expiries, and defaults `workshops` to `[]`.
- `getFounderProductRefunds` calls `GET /backend/feed/founder/product-refunds`. It lists refunded or cancelled ProductOrders for the Digital Products "Refunds & Cancellations" log.
- Types: `ChannelWithStats`, `CustomerSubscription`, `Customer`, `ChannelSubscriber`, `ChannelMembershipBucket`, `ChannelSubscriberBucketCounts`, `ChannelSubscribersResponse`, `FeedStats`, `ChannelAnalyticsRow`, `ChannelAnalyticsHeaderStats`, `ChannelAnalyticsResponse`, `ChannelInvoiceStatus`, `FounderChannelInvoiceRow`, `FounderInvoiceItemType`, `FounderInvoicesFilters`, `FounderInvoicesResponse`, `FounderItemUserStatus`, `FounderItemUserRow`, `FounderItemUsersFilters`, `FounderItemUsersResponse`, `FounderUserDetailUser`, `FounderUserDetailChannelItem`, `FounderUserDetailPurchasedItem`, `FounderUserDetailInvoice`, `FounderUserDetailEvent`, `FounderUserDetailResponse`, `UnsubEventType`, `UnsubChannelKind`, `UnsubItemKind`, `FounderUnsubLogRow`, `FounderUnsubLogFilters`, `FounderUnsubLogCounts`, `FounderUnsubLogWorkshopOption`, `FounderUnsubLogResponse`, `FounderProductRefundRow`, `FounderProductRefundsFilters`, `FounderProductRefundsResponse`.

### Workshops / live streams (L2030-L3438)
**Types (L2030-L2450):** `WorkshopAgendaItem`, `WorkshopBonus`, `WorkshopReview`, `WorkshopFaq`, `WorkshopChannel`, `WorkshopCreator`, `RecurrencePattern`, `WorkshopSession`, `WorkshopSessionOverrideView`, `Workshop`, `WorkshopRegistration`, `FounderStreamStatus`, `FounderStreamView`, `FounderStreamRow`, `FounderStreamTotals`, `FounderRecurringSeries`, `FounderSeriesHeader`, `FounderStreamTableResponse`.
- Rules documented in comments:
  - `RecurrencePattern.daysOfWeek` / `daysOfMonth` take precedence over the singular fields, which are still written so that older readers keep working.
  - A session's identity is its canonical UTC-midnight `date` / `sessionDate`. Rescheduling sets `rescheduledDate`, and the key never changes.
  - `computedStatus` is derived by the backend.
  - `sessionHost` records who holds the single host seat. It lets the console offer Join instead of Start, so a second host does not get a 409.

**Founder console table:** `getFounderStreamTable(orgId, {view, seriesId, search, columnFilters, status, payment, page, limit, sortBy, sortOrder})` calls `GET /backend/workshops/founder-table`.
- Column filters are sent as `filter[<columnId>]=` because the table paginates on the server.
- `status=all` and `payment=all` are omitted from the query.

**CRUD and lifecycle:**
| Function | Request |
|---|---|
| `getWorkshops(orgId, {channelId, upcoming, enrolledOnly, limit, offset})` | `GET /backend/workshops` (`enrolledOnly` must be set by the Enrolled tab so the row limit applies after filtering) |
| `getWorkshop(id)` | `GET /backend/workshops/:id` |
| `createWorkshop(orgId, data)` / `updateWorkshop(id, orgId, data)` / `deleteWorkshop` | `POST /backend/workshops`, then `PUT` / `DELETE /backend/workshops/:id` |
| `softDeleteWorkshop` / `restoreWorkshop` | `PATCH /backend/workshops/:id/soft-delete` / `POST .../restore` |
| `trashWorkshopSession` / `restoreWorkshopSession` | `POST /backend/workshops/:id/sessions/:date/trash` / `.../restore` |
| `getWorkshopSessionDetail` | `GET /backend/workshops/:id/sessions/:date/detail` |
| `updateWorkshopSession(id, date, orgId, payload)` | `PUT /backend/workshops/:id/sessions/:date` (partial patch) |
| `revertWorkshopSession` | `POST /backend/workshops/:id/sessions/:date/revert` (drops per-session edits and keeps lifecycle history) |
| `getWorkshopRecordings(id)` | `GET /backend/webinar/:id/recordings` (newest first; recordings are cabinet `OrganizationFile` docs) |
| `deleteWorkshopRecording` / `updateWorkshopRecording` | `DELETE` / `PATCH /backend/webinar/:id/recordings/:recordingId` (display title, description and thumbnail overrides; an empty string clears one) |

- Per-session edit types: `WorkshopSessionEdit`, `WorkshopSessionSeriesDefaults`, `WorkshopSessionEditPayload`.
- In the payload, an omitted key leaves the field unchanged, while `null` removes the override and falls back to the series value.
- The soft-delete comment notes that the Trash page was removed. The restore functions still work against the backend, but no UI calls them.

**Registration, payment and meetings:**
- `registerForFreeWorkshop` calls `POST /backend/workshops/:id/register`.
- `createWorkshopOrder` / `verifyWorkshopPayment` call `POST .../create-order` and `.../verify-payment` (Razorpay).
- `cancelWorkshopRegistration(id, sessionDate?)` calls `DELETE .../register?sessionDate=`. The session date is required for `per_session` workshops.
- `getWorkshopRegistrations` calls `GET .../registrations`.
- `generateWorkshopMeeting` and `startWorkshopSession(id, orgId, sessionDate)` both call `POST .../generate-meeting`. The second sends `{ sessionDate }` so the backend moves `currentSessionDate` to that session.

**Recurring sessions:**
- `getWorkshopSessions(id, {limit, includePast})` calls `GET .../sessions`.
- `registerForSession`, `createSessionOrder` and `verifySessionPayment` call `.../sessions/:date/register`, `/create-order` and `/verify-payment`.
- `registerForFullEnrollment`, `createFullEnrollmentOrder` and `verifyFullEnrollmentPayment` call `.../register-full`, `/create-order-full` and `/verify-payment-full`.
- `checkSessionAccess` calls `GET .../sessions/:date/access`.

**Analytics (founder):**
- `getWorkshopAnalytics(id, orgId, sessionDate?)` calls `GET /backend/workshops/:id/analytics`. It returns enrolment stats.
- `getRecurringWorkshopAnalytics` calls `GET .../analytics/sessions`.
- `syncWorkshopAttendance` calls `POST .../sync-attendance`.
- `markUserAttended(id, userId, orgId, sessionDate?)` calls `POST .../mark-attended/:userId`.
- `getWebinarSessionAnalytics(id, sessionDate?)` calls `GET /backend/webinar/:id/analytics`. It reports what happened in the room: attendees, purchases, phone verifications, pinned products and chat. Here `summary.attendanceRecorded === false` means "not recorded", not zero attendees.
- `downloadWebinarAttendeesCsv(id, {sessionDate, includeChat})` fetches `GET /backend/webinar/:id/attendees.csv[?include=chat]` with the bearer token. It then saves the result through a temporary blob URL and a hidden `<a download>`. A plain link would arrive without auth and get a 403.
- Types: `WorkshopParticipantAnalytics`, `WorkshopAnalytics`, `SessionAnalytics`, `RecurringWorkshopAnalytics`, `WebinarSessionAnalytics`.

### Courses (L3440-L4688)
- Types: `QuizOption`, `QuizQuestion`, `Quiz`, `CourseChapterPdf`, `CourseChapter` (`video|link|text|quiz|pdf`), `CourseSection`, `CourseDigitalAsset`, `CourseCreator`, `CourseInclude`, `CourseReview`, `Course`, `ChapterProgress`, `QuizAttemptAnswer`, `QuizAttempt`, `CourseEnrollment`, `CourseStats`, `QuizSubmitResult`, `QuizAnalyticsData`.
- Management:
  - `createCourse` calls `POST /backend/courses`. `getManageCourses` calls `GET /backend/courses/manage`. `getCourse`, `updateCourse` and `deleteCourse` use `/backend/courses/:id` (`updateCourse` has the same tri-state `thankYouPage`). `cloneCourse` calls `POST .../clone`.
  - Sections: `addCourseSection`, `updateCourseSection`, `deleteCourseSection` and `reorderCourseSections` use `/backend/courses/:id/sections[/:sectionId|/reorder]`.
  - Chapters: `addCourseChapter`, `updateCourseChapter`, `deleteCourseChapter` and `reorderCourseChapters` use `.../sections/:sectionId/chapters[...]`.
- Video upload to S3:
  - `getCourseVideoUploadUrl` calls `POST /backend/courses/video/presigned-upload`. It is used for files under 100 MB, which the browser then PUTs directly to S3.
  - Larger files use `initiateCourseVideoMultipart`, `completeCourseVideoMultipart` and `abortCourseVideoMultipart`, which call `/backend/courses/video/multipart/{initiate,complete,abort}`.
  - `getCourseVideoStreamUrl(s3Key)` calls `GET /backend/courses/video/signed-url?key=`, which returns a 4-hour URL. `deleteCourseVideo` calls `DELETE /backend/courses/video/delete?key=`.
- Learner side:
  - `getCourses(channelIds?)` calls `GET /backend/courses?channelIds=a,b`.
  - `enrollInCourse` calls `POST .../enroll`. `createCourseRazorpayOrder` and `verifyCoursePayment` call `.../create-order` and `.../verify-payment`.
  - `getCourseEnrollment` calls `GET .../enrollment`. `getMyEnrollments` calls `GET /backend/courses/enrollments/me`.
  - `markChapterComplete`, `markChapterIncomplete` and `updateChapterProgress` call `POST .../chapters/:chapterId/{complete,incomplete,progress}`.
  - `submitQuizAttempt` calls `POST .../quiz/:chapterId/submit`. `getQuizAnalytics` calls `GET .../quiz-analytics`.
  - `addCourseAsset` / `removeCourseAsset` use `.../assets[/:assetId]`.
  - `getCourseStats` calls `GET .../stats`. `getAdminCourseEnrollments(courseId?)` calls `GET /backend/courses/admin/enrollments`.
- Study time tracking:
  - `startStudySession`, `endStudySession(sessionId?)`, `studySessionHeartbeat` (a `PATCH`) and `getStudyStats` use `/backend/study-sessions/{start,end,heartbeat,stats}`.
  - Types: `StudySession`, `StudyStats`.
- Consolidated Learn page:
  - `getLearnInit()` calls `GET /backend/learn/init`. `getLearnInitLivestream()` calls `GET /backend/learn/init/livestream` and is loaded lazily when the Livestream tab opens, with recording URLs already resolved (L8801-L8878).
  - Both use raw `fetch` with `cache: "no-store"` and throw "Not authenticated" when there is no token.
  - Types: `LearnInitResponse`, `LearnInitLivestreamResponse`.

### Standalone videos and playlists (L3945-L4358)
- `createStandaloneVideo`, `getStandaloneVideos`, `getStandaloneVideo`, `updateStandaloneVideo` and `deleteStandaloneVideo` use `/backend/standalone-videos[/:id]`.
- `getVideoLinkPreview(url)` calls `GET /backend/standalone-videos/link-preview?url=`, which returns YouTube or Vimeo oEmbed metadata.
- Upload functions mirror the course ones under `/backend/standalone-videos/presigned-upload`, `/multipart/{initiate,complete,abort}` and `/signed-url`. `deleteStandaloneVideoFile` calls `DELETE /backend/standalone-videos/video/delete?key=&orgId=`.
- Playlists:
  - `getPlaylists`, `getPlaylist`, `getPlaylistAvailableVideos` (founder only; returns livestream, uploaded and course videos), `createPlaylist`, `updatePlaylist` and `deletePlaylist` use `/backend/playlists[...]`.
  - `addVideosToPlaylist`, `removeVideoFromPlaylist(id, videoId, videoSource?)` and `reorderPlaylistVideos` use `/backend/playlists/:id/videos[...]`.
  - `quickAddToPlaylist(entry)` calls `POST /backend/playlists/quick-add`, which creates the learner's "My Playlist" if it does not exist yet.
- Types: `StandaloneVideo`, `VideoLinkPreview`, `PlaylistVideoEntry`, `PlaylistVideo`, `Playlist` (`videoIds` is legacy and replaced by `videoEntries`), `AvailableVideos`.

### Products, orders, purchase history (L4690-L5353)
- Types: `ProductDigitalAsset`, `ProductDigitalLink`, `ProductKeyFeature`, `ProductWhatsInsideGroup`, `ProductReview`, `ProductFaq`, `ThankYouPageSection`, `ThankYouPage`, deprecated aliases `ProductThankYouPageSection` / `ProductThankYouPage`, `ProductDetailEntry`, `FounderAlerts`, `ProductEmailAlerts`, `Product`, `ShippingAddress`, `OrderItem`, `ProductOrder`, `ProductOrderStats`, `DynamicLinkInfo`, `PurchaseItem`.
- Shared configuration types:
  - `FounderAlerts` is the founder's own new-sale alert (on/off plus CC recipients) and is shared by every sellable type.
  - `ProductEmailAlerts.templateHtml` is a stored snapshot of a Network Mail template. The comment explains that the mail service authenticates with the browser's JWT, so the backend cannot fetch the template itself.
  - A non-empty `Product.allowedUserIds` makes the product a private one-time offer.
- Catalogue and management:
  - `getProducts({status, categoryName, tags, isDigital, channelId, search, page, limit, sortBy, sortOrder})` calls `GET /backend/products`.
  - `getProduct`, `createProduct`, `updateProduct` and `deleteProduct` use `/backend/products[/:id]`.
- Per-buyer dynamic links:
  - `getMyProductLinks` and `setMyProductLink` call `GET` / `PUT /backend/products/:id/my-links`.
  - `deleteMyProductLink(id, label)` calls `DELETE .../my-links/:label`.
- Orders:
  - `createProductRazorpayOrder({items, forReserve})` calls `POST /backend/products/orders/create-razorpay-order`, which may return `isFree`. `verifyProductPayment` calls `POST .../orders/verify-payment`. `createProductOrder` calls `POST /backend/products/orders`.
  - `getMyProductOrders` calls `GET .../orders/my`. `getProductOrder` calls `GET .../orders/:id`.
  - Founder side: `getAllProductOrders` calls `GET .../orders/all`. `getProductOrderStats` calls `GET .../orders/stats`. `updateProductOrderStatus(id, status, tracking)` calls `PATCH .../orders/:id/status`. `updateProductPaymentStatus` calls `PATCH .../orders/:id/payment`.
- `getPurchaseHistory({limit, offset, type})` calls `GET /backend/wallet/purchases`.

### Commission (Comb) plans (L5355-L5522)
- Types: `CombPlanLevel`, `CombPlanCapType` (`perpetual` | `per_pair_capped`), `CombPlan`, `CombPlanKind` (`levels` | `unilevel_plus`).
- Comments: legacy plans with no `capType` are treated as perpetual and those with no `planKind` as `levels`. For `unilevel_plus`, any commission the tree does not pay out goes back to the seller.
- `createCombPlan`, `getCombPlans({itemType, isActive, …})`, `getCombPlan`, `updateCombPlan` and `deleteCombPlan` use `/backend/comb-plans[/:id]`. `getCombPlanForItem(itemType, itemId)` calls `GET /backend/comb-plans/item/:type/:id`.
- `getCombPlanForItemPublic` calls `GET /backend/comb-plans/public/item/:type/:id` with raw `fetch` and no auth header. Guest pages use it to show commission information.

### Wallets, transfers, payouts (L5524-L6247)
- Types: `StoreWalletData`, `AffiliateWalletData`, `WalletTransaction`, `StoreWalletCurrencyEntry`, `WalletTransferMultiResponse`, `CryptoTopupChain`, `CryptoTopupAddress`, `CryptoTopupTransaction`, `TransferTarget`, `BankAddress`, `BankDetailsData`, `WalletAccountWalletType`, `WalletAccountType`, `CryptoNetwork`, `WalletAccountData`, `BankAccountInput`, `CryptoAccountInput`, `MyWithdrawal`, `WithdrawalFrequency`, `AffiliateFeeTier`, `WithdrawalPreferenceData`, `AffiliateFeeMatrixCell`, `WithdrawalFeesResponse`.
- Balances and ledgers:
  - `getStoreWalletBalance(orgId)` calls `GET /backend/wallet/store/balance`. `getAllStoreWallets` calls `GET /backend/wallet/store/all`. `getAffiliateWalletBalance` calls `GET /backend/wallet/affiliate/balance`, which includes redeemable and locked balances and the Unilevel Plus purchase flag. `getAllWallets` calls `GET /backend/wallet/all`.
  - `getStoreWalletTransactions(orgId, {limit, offset, type, currency})` calls `GET /backend/wallet/store/transactions`. `getAffiliateWalletTransactions` calls `GET /backend/wallet/affiliate/transactions`.
- Multi-currency cryptobrand offices (each member has a USD parent wallet plus INR, ETH and BTC siblings):
  - `getStoreWalletCurrencies` calls `GET /backend/wallet/store/currencies`.
  - `convertStoreWallet` calls `POST /backend/wallet/store/convert` (moving funds between the caller's own wallets).
  - `transferStoreWalletMulti` calls `POST /backend/wallet/store/transfer-multi` (to another user, with optional FX and a `dedupeKey`).
- Transfers and top-ups:
  - `transferStoreCredits(toUserId, orgId, amount, description?, {destinationWalletType, destinationOrgId})` calls `POST /backend/wallet/store/transfer`.
  - `topUpStoreWallet({orgId, amountCents})` calls `POST /backend/wallet/store/topup`. It returns an invoice and a `payUrl`. The caller redirects there and the normal checkout credits the wallet. The amount is in USD cents, and the server enforces $1 to $10,000.
  - `getCryptoTopupAddress({orgId, currency, chain})` calls `GET /backend/wallet/store/topup-address`. It returns a persistent HD deposit address per user, currency and chain. `chain` is required for USDT. The backend returns 404 if the address was never provisioned.
  - `listCryptoTopupTransactions` calls `GET /backend/wallet/store/topup-transactions`.
  - `getTransferTargets(toUserId)` calls `GET /backend/wallet/store/transfer-targets`.
  - `transferAffiliateToStore` calls `POST /backend/wallet/affiliate/transfer-to-store`.
  - `searchUsersForTransfer(q)` calls `GET /backend/unilevel-plus/users/search?q=`.
- Payout details:
  - `getBankDetails` / `saveBankDetails` call `GET` / `POST /backend/wallet/bank-details`. This is the older single-account model.
  - `getWalletAccounts(walletType, orgId?)`, `saveWalletAccount` and `deleteWalletAccount(id)` use `/backend/wallet/accounts[/:id]`. They manage at most two bank or crypto accounts per wallet. `orgId` is sent only for `store` wallets.
  - `getMyWithdrawals` calls `GET /backend/wallet/withdrawals`. `getWithdrawableBalance` calls `GET /backend/wallet/withdrawable` and returns matured cents.
  - `getWithdrawalFees(walletType)` calls `GET /backend/wallet/withdrawal-fees`.
  - `getWithdrawalPreference` / `saveWithdrawalPreference` call `GET` / `PUT /backend/wallet/withdrawal-preference`. A preference is a standing instruction for the admin, and nothing pays out automatically. `keepAmountCents` is sent for both frequencies because keeping $50 back lowers the affiliate fee.

### Team and file upload (L6249-L6349)
- `getTeamMembers(orgId)` calls `GET /backend/team/list` and returns only `members`. Type: `TeamMember` (`guest` marks members who joined through the guest flow).
- `uploadFile(file, onProgress?)` sends a multipart `file` field to `POST /backend/upload` using `XMLHttpRequest`, so it can report upload progress as a percentage. It resolves with `UploadFileResponse` (`url`, `fileKey`, `expiresAt?`) and rejects on network error, abort or a non-2xx status. The mobile app uses the same endpoint.

### Razorpay subscriptions (L6351-L6774)
- Types: `SubscriptionItemType`, `SubscriptionStatus`, `SubscriptionPeriod`, `SubscriptionPlan`, `Subscription`, `SubscriptionPayment`, `CreateSubscriptionPlanParams`, `SubscribeParams`.
- Every function here uses raw `fetch` with `Authorization: Bearer ${token}`. The plan and single-subscription calls return just `data.plan` or `data.subscription`. The list, access and payments calls, and `subscribeToItem`, return the whole body:
  - `createSubscriptionPlan` calls `POST /backend/subscriptions/plans` and returns `plan`.
  - `getSubscriptionPlan(orgId, itemType, itemId)` calls `GET .../plans/:type/:id` and returns `null` on 404.
  - `subscribeToItem` calls `POST .../subscribe`.
  - `getMySubscriptions` calls `GET .../my`, sending `status` repeatedly when it is an array.
  - `getSubscription` calls `GET .../:id`.
  - `cancelSubscription(orgId, id, cancelAtCycleEnd = true)` calls `POST .../:id/cancel`.
  - `pauseSubscription` and `resumeSubscription` call `POST .../:id/pause` and `.../:id/resume`.
  - `checkSubscriptionAccess` calls `GET .../access/:type/:id`.
  - `getSubscriptionPayments` calls `GET .../:id/payments`.

### Services and Taskroom engagements (L6776-L7713, L8880-L9064)
- Types: `ServiceMilestoneAttachment`, `ServiceMilestone`, `ServiceMilestoneInput`, `ServiceWhyChooseUs`, `ServiceContactInfo`, `ServiceTaskAssignee`, `ServiceTaskTemplate`, `ServiceStageTemplate`, `ServiceClientAccess`, `ServiceTaskroomConfig`, `BillingModelType`, `BillingCycle`, `BillingStartDay`, `ServiceTeamMember`, `ServiceHourlyConfig`, `ServiceOptTaskroom`, `EngagementBoardCard`, `EngagementTeamMember`, `EngagementBoardStage`, `EngagementBoard`, `Service`, `ServiceMilestoneMessage`, `MilestoneProgress`, `ServiceOpt`, `ServiceReview`, `PendingPayment`, `ServiceStats`, `EngagementFile`, `EngagementRoomFile`, `EngagementFiles`, `EngagementActivityEntry`, `TaskroomLinkedService`.
- Constants: `DEFAULT_CLIENT_ACCESS` turns everything on except `revealTimelogSheet`. `DEFAULT_HOURLY_CONFIG` is hourly, monthly, starting on the 1st of the month, with timesheet approval required and an empty team.
- Pricing models:
  - A `pricingModel: "billable"` service has no milestones and is billed from hours logged in Taskroom.
  - `ServiceTeamMember.payRate` is the internal hourly cost, separate from the client's `hourlyRate`. The server strips it from every non-founder response.
  - The client-access flags only shape the UI. The board proxy enforces access on the server.
- Catalogue and management:
  - `getServices`, `getService` (returns `service`, `isFounder` and `optIn`), `createService`, `updateService` and `deleteService` use `/backend/services[/:id]`. Send `hourlyConfig: null` to clear it.
  - `addServiceMilestone`, `updateServiceMilestone`, `deleteServiceMilestone` and `reorderServiceMilestones` use `/backend/services/:id/milestones[...]`.
- Opt-ins:
  - `optInToService` calls `POST /backend/services/:id/opt-in`. `getServiceOptIn` calls `GET .../opt-in` and sends no orgId.
  - `getMyServiceOptIns` calls `GET /backend/services/opt-ins/my`. `cancelServiceOptIn` calls `DELETE /backend/services/opt-ins/:id`.
- Milestones within an opt-in (all under `/backend/services/opt-ins/:optInId/milestones/:milestoneId/`):
  - `startServiceMilestone` / `completeServiceMilestone` call `start` / `complete`.
  - `createServiceMilestonePaymentOrder` / `verifyServiceMilestonePayment` call `create-order` / `verify-payment`.
  - `addMilestoneAttachments` / `removeMilestoneAttachment` call `POST` / `DELETE attachments`. The `DELETE` sends a JSON body `{ url }`. Client uploads go into `clientAttachments` and founder uploads into `attachments`.
  - `getServiceMilestoneMessages` / `postServiceMilestoneMessage` call `GET` / `POST messages`.
- Payments, reviews and stats:
  - `getServicePendingPayments` calls `GET /backend/services/payments/pending`.
  - `createServiceReview` and `getServiceReviews` use `/backend/services/:id/reviews`. `updateServiceReview` and `deleteServiceReview` use `/backend/services/reviews/:reviewId`.
  - Founder dashboard: `getServiceOptIns` calls `GET /backend/services/:id/opt-ins`. `getServiceStats` calls `GET .../stats`.
- Taskroom integration (L8880-L9064):
  - `getEngagementBoard` calls `GET /backend/services/opt-ins/:id/board`. It returns `board: null` plus a `reason` (`not_configured`, `hidden`, `pending`, …) when there is nothing to show. Internal columns are removed on the server.
  - `getEngagementFiles` calls `.../files` and `getEngagementActivity` calls `.../activity`. Each returns `null` with `reason: "hidden"` when the founder has turned that tab off for clients.
  - `getEngagementTaskroom` calls `.../taskroom`. `provisionEngagementTaskroom` calls `POST .../taskroom/provision` to retry provisioning or to backfill a room.
  - `getServiceByTaskroom(roomId)` calls `GET /backend/services/by-taskroom/:roomId` with raw `fetch`. It returns `null` on 204 ("not a service room") and also on any other non-OK status.
  - `getServiceTaskroomTemplate` calls `GET /backend/services/:id/taskroom/template`. It returns the default board stages built from the milestones.

### Paid calls and bookings (L7715-L8271)
- Types: `IntakeQuestion`, `IntakeAnswer`, `CallTopic`, `CallHowItWorks`, `CallFaq`, `CallOffering`, `CallPurchase`, `CallBooking`, `CallStats`, `AvailableSlot`.
- Offerings:
  - `getCallOfferings` calls `GET /backend/calls`. `getCallOfferingsManage({includeArchived})` calls `GET /backend/calls/manage`.
  - `getCallOffering`, `createCallOffering`, `updateCallOffering` and `deleteCallOffering` use `/backend/calls[/:id]`.
  - Intake questions: `addIntakeQuestion`, `updateIntakeQuestion`, `deleteIntakeQuestion` and `reorderIntakeQuestions` use `/backend/calls/:id/questions[...]`. Reorder is a `PUT`.
- Purchases:
  - `createCallPurchaseOrder(callId, quantity)` and `verifyCallPayment` call `.../create-order` and `.../verify-payment`. `purchaseFreeCalls` calls `.../purchase-free`.
  - `getMyCallPurchases` calls `GET /backend/calls/purchases/me`. `getCallPurchases(callId)` calls `GET .../:id/purchases`. `getCallPurchase` calls `GET /backend/calls/purchases/:id`. `getCallOfferingStats` calls `GET .../:id/stats`.
- Bookings:
  - `getFounderAvailableSlots(founderId, callOfferingId, date)` calls `GET /backend/call-bookings/founder/slots`.
  - `createCallBooking` calls `POST /backend/call-bookings`. `getMyCallBookings` calls `GET .../me`. `getFounderCallBookings({status, startDate, endDate})` calls `GET .../founder`. `getCallBooking` calls `GET .../:id`.
  - `completeCallBooking`, `cancelCallBooking`, `rescheduleCallBooking` and `markCallNoShow` call `PATCH .../:id/{complete,cancel,reschedule,no-show}`. `rateCallBooking` calls `POST .../:id/rate`.

### Unilevel Plus and reserve licences (L8273-L8674)
- `getUnilevelPlusProduct` calls `GET /backend/unilevel-plus/product`. Type: `UnilevelPlusProduct`. The comments say to show `freeMonthWindow`, `comboEligible` and `comboTerms` exactly as the server sends them:
  - The 24-hour window comes from the backend's `comboWindowFor`. A missing `startsAt` means the window never opened, which is different from expired.
  - `cartTotal` is pre-tax. GST is added at checkout, and only for Indian buyers.
- `createUnilevelPlusOrder(quantity = 1)` / `verifyUnilevelPlusPayment` call `POST /backend/unilevel-plus/checkout/{create-order,verify-payment}`.
- UP reserve licences:
  - `getReserveLicenses` calls `GET /backend/unilevel-plus/reserve`. `getReserveStats` calls `GET .../reserve/stats`.
  - `assignReserveLicense(licenseId, userId)` calls `POST .../reserve/:id/assign`.
  - `searchUsersForAssignment` calls `GET /backend/unilevel-plus/users/search`. Type: `ReserveLicense`.
- Generic item reserves (course, channel, workshop, call, product):
  - `getItemReserves` calls `GET /backend/item-reserves`. `getItemReserveStats` calls `GET /backend/item-reserves/stats`.
  - `assignItemReserve(licenseId, {email, userId, priceUsd, orgId, message})` calls `POST /backend/item-reserves/:id/assign`. With no price it grants the licence immediately (`mode: "free"`). With `priceUsd > 0` it creates a pending offer (`mode: "paid"`, and `orgId` is required), which the recipient approves and pays for from a Store wallet.
  - Types: `ItemReserveType`, `ItemReserveStatus`, `ItemReserveLicense`, `ItemReserveStats`.
- Offers:
  - `listIncomingReserveOffers` / `listOutgoingReserveOffers` call `GET /backend/item-reserves/offers/{incoming,outgoing}`.
  - `approveReserveOffer(offerId, sourceOrgId)`, `rejectReserveOffer` and `cancelReserveOffer` call `POST .../offers/:id/{approve,reject,cancel}`.
  - Types: `ReserveOfferStatus`, `ReserveOfferUserRef`, `ReserveOfferOrgRef`, `ReserveOffer`.

### Sellables and invoices (L8676-L8799)
- `listOrgSellables(orgId?)` calls `GET /backend/api/invoices/sellables` and returns `sellables` or `[]`.
  - It is a unified list across every sellable type. `garage-store` is generated on the server from the ThirdPartyClient catalogue.
  - `storeSlug` drives storefront checkout.
  - Types: `SellableItemType`, `Sellable`.
- `generateInvoice(body)` calls `POST /backend/api/invoices/generate` for in-webinar Buy Now. Types: `GenerateInvoiceRequest`, `InvoiceReferrerInfo`, `GenerateInvoiceResponse`.
- `getInvoice(invoiceId)` calls `GET /backend/api/invoices/:id`. It is public: raw `fetch`, no auth header, `cache: "no-store"`, so it is safe to poll. Type: `InvoiceStatusResponse`.

## Exports
There is no default export. Every exported function is an `async` wrapper documented in the sections above, except `getTopReactions`, which is synchronous. Exported constants: `REACTION_TYPES`, `REACTION_EMOJIS`, `REACTION_LABELS`, `DEFAULT_CLIENT_ACCESS`, `DEFAULT_HOURLY_CONFIG`. All exported interfaces and type aliases are listed under their sections. The private helpers `getOrgId` and `fetchFromBackend` are not exported.

## Interfaces
- **Backend endpoints called:** Every request goes to the combined app's Express API under `/backend`. The routers involved, all mounted in `server/app.ts`:

  | Mount | Router |
  |---|---|
  | `/feed` | `feedRoutes` |
  | `/workshops` | `workshopRoutes` |
  | `/webinar` | `webinarRoutes` |
  | `/courses` | `courseRoutes` |
  | `/standalone-videos` | `standaloneVideoRoutes` |
  | `/playlists` | `playlistRoutes` |
  | `/study-sessions` | `studySessionRoutes` |
  | `/learn` | `learnInitRoutes` |
  | `/products` | `productRoutes` |
  | `/services` | `serviceRoutes` |
  | `/calls` | `callRoutes` |
  | `/call-bookings` | `callBookingRoutes` |
  | `/comb-plans` | `combPlanRoutes` |
  | `/unilevel-plus` | `unilevelPlusRoutes` |
  | `/item-reserves` | `itemReservesRoutes` |
  | `/subscriptions` | `subscriptionsRoutes` |
  | `/wallet` | `walletRoutes` |
  | `/team` | `teamRoutes` |
  | `/upload` | `uploadRoutes` |
  | `/api/invoices` | `invoiceRoutes` |

  The individual paths are listed per section above.
- **External services:** None are called directly. Presigned and multipart upload URLs returned by the backend point at AWS S3, but the browser `PUT` to those URLs happens in the calling components, not here.
- **Environment variables:** `NEXT_PUBLIC_API_URL` is the base URL for every call. It falls back to `http://localhost:4000`.
- **Browser storage / cookies:**
  - `localStorage["garage_org_id"]` supplies the implicit org id.
  - The bearer token comes from `getToken()` in `lib/auth.ts`, which reads `localStorage["garage_tok"]`.
  - `downloadWebinarAttendeesCsv` temporarily creates and revokes an object URL.

## Dependencies
- **Internal:** `lib/auth.ts` provides `getToken()` for the `Authorization` header.
- **Packages:** None. The file uses only browser globals (`fetch`, `XMLHttpRequest`, `FormData`, `URLSearchParams`, `localStorage`, `URL.createObjectURL`, `document`).

## Used by
102 files import it, including `app/(dashboard)/deals/leads/[id]/page.tsx`, `app/(dashboard)/deals/leads/page.tsx`, `app/(dashboard)/deals/page.tsx`, `app/(dashboard)/layout.tsx`, `app/(dashboard)/thoughts/components/NoteSharePopover.tsx`, `app/(dashboard)/workspace/WorkspaceClient.tsx`, `app/(dashboard)/workspace/components/CommunityDropdown.tsx`, `app/invoice/[invoiceId]/InvoicePayPage.tsx`, `app/webinar/[id]/WebinarRoomClient.tsx`, `components/checkout/ProductThankYouCard.tsx`, `components/crm/DealsNavbar.tsx`, `components/dashboard/AllVideosPage.tsx`, `ArticlesPage.tsx`, `BankDetailsSection.tsx`, `CallsPage.tsx`, `ChannelPaymentModalNew.tsx`, `ChannelsPage.tsx`, `CommissionPlanSection.tsx`, `ContentPage.tsx`, `ContentRewardsPage.tsx`, `CoursesPage.tsx`, `CustomersPage.tsx`, `DepositCryptoSheet.tsx`, `FeedComponents.tsx`, `FeedPageRedesigned.tsx`, and 77 more. It is a client-side library with no route of its own.

## Notes
- **Browser-only:** Token and org lookups read `localStorage`. During SSR they return `null`, so calls made from server components would go out unauthenticated and without an org.
- **Inconsistent error handling:**
  - `fetchFromBackend` falls back to `statusText` when the error body is not JSON.
  - The subscription functions call `res.json()` on errors with no `.catch`, so a non-JSON error body raises a parse error instead of the backend's message.
  - The subscription functions also send `Authorization: Bearer null` when the user is logged out.
  - `getServiceByTaskroom` swallows every non-OK response and returns `null`.
- **Functions that do not use `fetchFromBackend`:**
  - `downloadWebinarAttendeesCsv` saves a file through a blob URL.
  - `getCombPlanForItemPublic` and `getInvoice` are public calls with no auth header.
  - `uploadFile` uses `XMLHttpRequest` for upload progress.
  - The ten subscription functions use raw `fetch`.
  - `getLearnInit` and `getLearnInitLivestream` use raw `fetch` with `no-store`.
  - `getServiceByTaskroom` treats 204 and errors as `null`.
- **Approximations:** `getChannelMembershipDetails` sets `lastBillingDate` to `currentEnd` minus 30 days whatever the billing period, so the value is wrong for weekly, quarterly and yearly plans.
- **Duplicates:** `searchUsersForTransfer` and `searchUsersForAssignment` call the same endpoint, `/backend/unilevel-plus/users/search`.
- **Legacy and unused:**
  - `toggleLike` and `likesCount` / `hasLiked` are superseded by reactions.
  - `getBankDetails` / `saveBankDetails` are superseded by the per-wallet `/wallet/accounts` API.
  - `restoreWorkshop` and `restoreWorkshopSession` have no UI since the Trash page was removed.
- **Money units differ by endpoint:**
  - Founder invoice and item-user totals are in paise or cents.
  - `WebinarSessionAnalytics.purchases[].amount` is already in major units.
  - `topUpStoreWallet` takes cents.
  - Withdrawal amounts are in cents.
- **Request body on DELETE:** `removeMilestoneAttachment` sends a JSON body with a `DELETE` request. This works with the Express JSON parser but can be dropped by some proxies.
