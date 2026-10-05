# `server/services/pushNotification.ts`

> Module exporting `sendPushToUser`, `sendPushToUsers`, `sendDMPushNotification`, `sendGroupPushNotification` and 8 more.

**Kind:** backend service · **Lines:** 1073

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `sendPushToUser` | function | `async sendPushToUser(userId: string, payload: PushNotificationPayload): Promise<SendPushResult>` — Send push notification to a single user (all their devices) | 337 |
| `sendPushToUsers` | function | `async sendPushToUsers(userIds: string[], payload: PushNotificationPayload): Promise<Map<string, SendPushResult>>` — Send push notifications to multiple users | 476 |
| `sendDMPushNotification` | function | `async sendDMPushNotification(recipientId: string, senderId: string, senderName: string, messageText: string, convId: string, messageId: string, senderAvatar?: string \| null): Promise<SendPu…` — Send DM push notification | 498 |
| `sendGroupPushNotification` | function | `async sendGroupPushNotification(recipientIds: string[], senderId: string, senderName: string, groupId: string, groupName: string, messageText: string, messageId: string, senderAvatar?: stri…` — Send group message push notification | 547 |
| `sendKnockPushNotification` | function | `async sendKnockPushNotification(recipientId: string, knockerId: string, knockerName: string): Promise<SendPushResult>` — Send knock request push notification | 611 |
| `sendNetworkchainCallPush` | function | `async sendNetworkchainCallPush(recipientId: string, caller: { id: string; name: string; picture?: string }, excludeDeviceIds?: Set<string>): Promise<SendPushResult>` — Ring a 1:1 call on the recipient's NetworkChains devices. | 637 |
| `sendNetworkchainCallCancelPush` | function | `async sendNetworkchainCallCancelPush(recipientId: string, callerId: string, excludeDeviceIds?: Set<string>): Promise<SendPushResult>` — Stop a NetworkChains call ringing: answered elsewhere, declined, cancelled or rung out. | 660 |
| `sendCallPushNotification` | function | `async sendCallPushNotification(recipientId: string, callerId: string, callerName: string, callType: "video" \| "audio" = "video"): Promise<SendPushResult>` — Send incoming call push notification | 678 |
| `sendMentionPushNotification` | function | `async sendMentionPushNotification(recipientId: string, senderId: string, senderName: string, groupId: string, groupName: string, messageText: string, messageId: string, senderAvatar?: strin…` — Send group mention push notification | 701 |
| `sendCommissionEarnedPushNotification` | function | `async sendCommissionEarnedPushNotification(recipientId: string, params: { amount: number; currency: string; description?: s…): Promise<SendPushResult>` — Push an affiliate-commission earning to the recipient. | 765 |
| `sendTransferReceivedPushNotification` | function | `async sendTransferReceivedPushNotification(recipientId: string, params: { /** Whole currency units (dollars), matching stor…): Promise<SendPushResult>` — Push a peer wallet transfer to the recipient. | 855 |
| `FeedEngagement` | type | What someone did to your post. | 937 |
| `sendFeedEngagementPushNotification` | function | `async sendFeedEngagementPushNotification(recipientId: string, actor: { id: string; name?: string \| null; avatar?: string …, post: { id: string; content?: string \| null }, engagement: FeedEn…` — Push a feed engagement to the author of the post (or of the parent comment). | 1026 |

## Interfaces

- **Database (Mongoose models used):**
  - `DeviceToken` (server/models/deviceToken.model.ts) — reads: `find`; **writes:** `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/models/deviceToken.model.ts` — `DeviceToken`
  - `server/models/chatMute.model.ts` — `mutedUserIds`
  - `server/models/chatBlock.model.ts` — `hasBlocked`, `blockersOf`
- **Packages:**
  - `expo-server-sdk` — `ExpoPushMessage`, `ExpoPushTicket`, `ExpoPushSuccessTicket`, `ExpoPushErrorTicket`

## Used by

- `scripts/test-commission-push.ts`
- `scripts/test-transfer-push.ts`
- `server/realtime/socket.ts`
- `server/routes/feed.ts`
- `server/routes/internalPush.ts`
- `server/services/__tests__/pushNotification.audience.test.ts`
- `server/services/feed.ts`
- `server/services/supportChat.ts`
- `server/services/wallet.ts`
