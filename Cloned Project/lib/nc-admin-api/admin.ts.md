# `lib/nc-admin-api/admin.ts`

> The main NetworkChains super-admin API client used by the Garage admin's `/garage-admin/networkchains/*` pages. It covers AI usage and cost, Meet analytics, live LiveKit room moderation, EarnGPT suggestion feedback, the offerings explorer, subscription admin and a per-user explorer, all against the external NetworkChains contacts-backend.

**Kind:** frontend library · **Lines:** 1053

## Purpose
This file was ported from `networkchains-web-app` `lib/api/admin.ts` with an identical exported surface, so the ported pages import the same names. Only the transport changed: auth now comes from `./auth` (silent Garage→NC token elevation) instead of the NC OTP flow. The header says the NC contacts-backend's `/admin` routes stay the source of truth for behaviour. Nothing here calls this repo's own `server/`. Every path is relative to `NC_API_URL` (`NEXT_PUBLIC_NC_API_URL`, default `https://backend.networkchains.com`).

## How it works
Two transports from `auth.ts` are used:
- `ncAdminFetch` for routes that return the `{ ok, data }` envelope. The private helper `postAuthed(path, body)` is a JSON POST over `ncAdminFetch`.
- `ncAdminFetchRaw` for routes that return plain JSON (`/admin/meet-manage/*`, `/subscription/admin/users`).

### Re-exports and product enum (L11-L46)
- Aliases from `auth.ts` keep the NC names: `AdminUnauthorizedError` (= `NcAdminUnauthorizedError`), `AdminApiError` (= `NcAdminApiError`), `getAdminToken`, `clearAdminToken`.
- `AdminProduct` covers `earngpt`, `earngpt_live`, `note_taker`, `memo`, `clipper` and `dubbing`, with `ADMIN_PRODUCTS` (ordered list) and `PRODUCT_LABELS` (display names).

### AI usage and cost (L48-L133)
- Types: `UsageUserRow` (per-user total plus `byProduct` cost map), `UsageModelRow` (per model: tokens, audio seconds, characters, requests, cost), `UsageProductBlock`, `UsageUserDetailData`, `UsageSummaryData` (total, by product, top users).
- `getUsageUsers`, `getUsageUser` and `getUsageSummary` each take `from`/`to` date strings (URL-encoded by the private helper `q`).

### Meet analytics (L135-L217)
- `MeetAnalyticsData` holds the overall totals and averages (meetings, duration, joins, recordings, screen share, solo sessions), top participants and screen sharers, daily, hourly and weekday distributions, a guest/authed/host breakdown, `recentSessions` (`MeetSession` with `MeetParticipant` and `MeetScreenShareEvent`) and recording counts.
- `getMeetAnalytics(days)` loads them.

### Live call management (L219-L498)
These are moderation controls for live LiveKit rooms run by the NC backend.
- Types: `LiveRoomSummary` (kind `meet|office|webinar|other`, participant and publisher counts, host, recording flag), `LiveParticipant` (with mic, camera and screen track info and a `state` number), `LiveRoomDetail` (room session settings `allowUnmute`/`allowPresent`, current recording, organisation, host, `AdminMeetRecording[]`, `AdminMeetNoteSession`), `EndedRoomDetail` (participants with left-at times and durations), `LiveBan`, `RecentEndedSession`, `AdminScheduledMeet`.
- Reads: `listLiveRooms`, `getLiveRoom`, `getEndedRoom`, `listRoomBans`, `listScheduledMeets(daysAhead = 7)`, `listRecentEnded(minutes = 60, limit = 100)`. `minutes = 0` returns all sessions ever, capped by the server limit. `getAdminRecordingUrl(recordingId, inline)` returns `{ url }`.
- Actions (all POST): `muteLiveParticipant(roomName, identity, muted = true, source?)`, `kickLiveParticipant`, `endLiveRoom`, `muteAllInRoom(roomName, except = [])`, `banLiveParticipant(roomName, identity, reason?)`, `unbanLiveParticipant(roomName, userId)`, `broadcastToRoom(roomName, text)`, `updateRoomSettings(roomName, { allowUnmute?, allowPresent? })`, `startRoomRecording`, `stopRoomRecording(roomName, egressId?)`.

### EarnGPT suggestion feedback (L500-L518)
- Re-exports `AdminSuggestionFeedbackItem` and `AdminSuggestionFeedbackResponse` from `./earngpt-types`.
- `getSuggestionFeedback(page = 1, option?)` returns the newest-first learning timeline, filterable by `wrong|close|chosen`.

### Offerings explorer (L520-L629)
- `Offering` describes a catalog item across all users. It has a `category` (`OfferingCategory`: `digital|physical|office|offer|platform`), price in minor units, currency, commission %, an optional `offer` (coupon code, discount, linked items), opportunity stats (`OfferingOppStats`: total, to-reach, reached-out, snoozed, potential USD cents) and outcome counts (`OfferingOutcomeStats`).
- `getOfferings({ page, search, type, sort, order })` returns `OfferingsResponse`. A `type` of `"all"` is omitted, and `order` is sent as `sortOrder`.
- `getOfferingDetail(itemType, itemId, page)` returns `OfferingDetailResponse`, with paged opportunity rows and a feedback list.

### Subscription admin (L631-L703)
- `getSubscriptionUsers(params)` forwards every defined, non-empty query param (`search`, `view`, `role`, `payMin/Max`, `daysMin/Max`, `sortBy`, `sortOrder`, `page`, `limit`). It reads the raw body, throws `NcAdminApiError(..., 200)` on `ok:false`, and fills defaults for any missing fields (`limit` 20, `page` 1, and so on) into `SubscriptionUsersResult`. The result includes full-set active and expired counts plus role facets.
- `activateSubscription(userId, days = 30)` and `expireSubscription(userId)` POST through `postAuthed`.

### User explorer (L705-L1044)
This is a read-only drill-down into one NC user, apart from the wallet credit.
- `getAdminUsers({ search, page, limit, sortBy, sortOrder })` returns `AdminUsersListData`.
- `getAdminUserOverview(userId)` returns the user, synced platforms with contact counts, connected social accounts, and counts of contacts, conversations, meetings and note sessions.
- `getAdminUserWallet(userId)` returns `AdminUserWallet` (balance, debt and `AdminWalletTxn[]`, with cents and dollar strings).
- `creditAdminUserWallet(userId, amountDollars)` **writes**: it credits the user's NC wallet.
- `getAdminUserContacts(userId, { search, page })` and `getAdminUserConversations(userId, { search, page })` return paged lists. `getAdminUserConversation(userId, sessionId)` returns the full EarnGPT chat, with `AdminChatMessage` items and their attachments.
- `getAdminUserMeetings`, `getAdminUserNoteSessions`, `getAdminUserNoteSession(userId, id)` (transcript segments plus an AI summary with action items, decisions and questions) and `getAdminUserRecordings`.
- `getAdminUserActivity(userId, { limit, fromHours, event, before })` returns PostHog HogQL events (`AdminUserActivityEvent`, which includes `ip` and `audit_flag`), paginated with the `before` cursor.
- `getAdminUserSentryIssues(userId, { project, query, statsPeriod, cursor })` returns the Sentry issues tied to that user.

### Formatting (L1046-L1052)
- `formatCents(cents, dp = 4)` returns `$` plus `(cents/100).toFixed(dp)`. Four decimals is the default because AI costs are often fractional cents.

## Exports
- Re-exports: `AdminUnauthorizedError`, `AdminApiError`, `getAdminToken`, `clearAdminToken`, plus the types `AdminSuggestionFeedbackItem` and `AdminSuggestionFeedbackResponse`.
- Constants: `ADMIN_PRODUCTS`, `PRODUCT_LABELS`.
- Types: `AdminProduct`, `ProductCostMap`, `UsageUserRow`, `UsageUsersData`, `UsageModelRow`, `UsageProductBlock`, `UsageUserDetailData`, `UsageSummaryTopUser`, `UsageSummaryData`, `MeetAnalyticsData`, `MeetParticipant`, `MeetScreenShareEvent`, `MeetSession`, `LiveRoomSummary`, `LiveParticipant`, `AdminMeetRecording`, `AdminMeetNoteSession`, `AdminMeetOrganization`, `AdminMeetHost`, `LiveRoomDetail`, `EndedRoomParticipant`, `EndedRoomDetail`, `LiveBan`, `RecentEndedSession`, `AdminScheduledMeet`, `OfferingCategory`, `OfferingOppStats`, `OfferingOutcomeStats`, `OfferingLinkedItem`, `Offering`, `OfferingsResponse`, `OfferingOppRow`, `OfferingFeedbackRow`, `OfferingDetailResponse`, `SubUser`, `SubscriptionUsersQuery`, `SubscriptionUsersResult`, `AdminUserRow`, `AdminUsersListData`, `SyncedPlatform`, `ConnectedAccount`, `AdminUserOverview`, `AdminContact`, `AdminContactsData`, `AdminConversationRow`, `AdminConversationsData`, `AdminChatMessage`, `AdminConversationDetail`, `AdminMeeting`, `AdminNoteSession`, `AdminNoteSessionDetail`, `AdminRecording`, `AdminWalletTxn`, `AdminUserWallet`, `AdminUserActivityEvent`, `AdminUserActivityData`, `AdminUserSentryIssue`, `AdminUserSentryIssuesData`.
- Functions: `getUsageUsers`, `getUsageUser`, `getUsageSummary`, `getMeetAnalytics`, `listLiveRooms`, `getLiveRoom`, `getEndedRoom`, `getAdminRecordingUrl`, `muteLiveParticipant`, `kickLiveParticipant`, `endLiveRoom`, `listScheduledMeets`, `listRecentEnded`, `muteAllInRoom`, `banLiveParticipant`, `unbanLiveParticipant`, `listRoomBans`, `broadcastToRoom`, `updateRoomSettings`, `startRoomRecording`, `stopRoomRecording`, `getSuggestionFeedback`, `getOfferings`, `getOfferingDetail`, `getSubscriptionUsers`, `activateSubscription`, `expireSubscription`, `getAdminUsers`, `getAdminUserOverview`, `getAdminUserWallet`, `creditAdminUserWallet`, `getAdminUserContacts`, `getAdminUserConversations`, `getAdminUserConversation`, `getAdminUserMeetings`, `getAdminUserActivity`, `getAdminUserSentryIssues`, `getAdminUserNoteSessions`, `getAdminUserNoteSession`, `getAdminUserRecordings`, `formatCents`.

## Interfaces
- **Backend endpoints called** (all on the external NC contacts-backend at `NC_API_URL`, not `/backend`):
  - Usage: `GET /admin/usage/users?from&to`, `GET /admin/usage/users/:userId?from&to`, `GET /admin/usage/summary?from&to`
  - Meet: `GET /meet/analytics/overview?days=`
  - Live rooms: `GET /admin/meet-manage/live`, `GET /admin/meet-manage/live/:roomName`, `GET /admin/meet-manage/ended/:roomName`, `GET /admin/meet-manage/recording/:id/download[?inline=1]`, `GET /admin/meet-manage/scheduled?days=`, `GET /admin/meet-manage/recent-ended?minutes&limit`, `GET /admin/meet-manage/live/:roomName/bans`; `POST /admin/meet-manage/live/:roomName/{mute, kick, end, mute-all, ban, unban, broadcast, settings, recording/start, recording/stop}`
  - EarnGPT: `GET /earngpt/admin/suggestion-feedback?page&option`
  - Offerings: `GET /admin/offerings?page&search&type&sort&sortOrder`, `GET /admin/offerings/:itemType/:itemId?page=`
  - Subscriptions: `GET /subscription/admin/users?...`, `POST /subscription/admin/activate` `{ userId, days }`, `POST /subscription/admin/expire` `{ userId }`
  - Users: `GET /admin/users?...`, and `GET /admin/users/:userId/{overview, wallet, contacts, conversations, conversations/:sessionId, meetings, activity, sentry-issues, note-sessions, note-sessions/:id, recordings}`; `POST /admin/users/:userId/wallet/credit` `{ amountDollars }`
- **External services:** NetworkChains contacts-backend. Behind it, indirectly: LiveKit (room moderation and egress recordings), PostHog (activity) and Sentry (user issues).

## Dependencies
- **Internal:** `lib/nc-admin-api/auth.ts` - `ncAdminFetch`, `ncAdminFetchRaw`, `NcAdminApiError` and the re-exported auth helpers. `lib/nc-admin-api/earngpt-types.ts` - feedback types.
- **Packages:** none.

## Used by
19 importers, all under the `/garage-admin/networkchains/*` admin area:
- Pages: `ai-cost`, `axons`, `axons/[axonId]`, `earngpt-learning`, `meet`, `meet/live`, `offerings`, `posthog`, `sentry`, `sentry/[issueId]`, `subscriptions`, `users` and `users/[userId]` under `app/garage-admin/(admin-dashboard)/networkchains/`.
- Components: `components/nc-admin/axons/merge-dialog.tsx`, `components/nc-admin/axons/unmerge-dialog.tsx`, `components/nc-admin/users/earngpt-chat-viewer.tsx`, `components/nc-admin/users/meeting-detail.tsx`.
- Hooks: `lib/hooks/use-admin-funnels.ts`, `lib/hooks/use-admin-usage.ts`.

## Notes
- Several calls have real side effects on live NC production data: wallet credits, subscription activation and expiry, kicking, banning and muting participants, ending rooms, starting and stopping recordings, and broadcasting messages into rooms. Pages should confirm with the operator before calling them.
- The `/admin/meet-manage/*` routes are plain JSON, so errors only surface for non-2xx statuses. A 200 response with `ok:false` would not be caught there, unlike in `getSubscriptionUsers`.
- The responses carry heavy PII (emails, IPs, full chat transcripts, meeting transcripts), which is only appropriate for super-admin pages.
- The wallet credit is sent in dollars (`amountDollars`), not cents. Every other money field in this file is in cents.
