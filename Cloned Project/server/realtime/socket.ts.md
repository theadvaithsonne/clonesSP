# `server/realtime/socket.ts`

> Module exporting `ensureConferenceNoteTaker`, `getPreviewWatcherCount`, `getOnlineUserIds`, `initSocket`.

**Kind:** Socket.IO / realtime · **Lines:** 4987

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ensureConferenceNoteTaker` | function | `async ensureConferenceNoteTaker(io: Server, channelName: string, orgId: string, ownerUserId: string): Promise<void>` — Auto-attach the note-taker bot to a conference (hq-room) when its owner joins. | 174 |
| `getPreviewWatcherCount` | function | `getPreviewWatcherCount(webinarId: string): number` — Count distinct users watching the preview card for a given webinarId. | 288 |
| `getOnlineUserIds` | function | `getOnlineUserIds(): Set<string>` | 297 |
| `initSocket` | function | `initSocket(httpServer: HttpServer, origin: string)` | 307 |

## Interfaces

- **Socket.IO events:**
  - emits: `workspace:user-joined`, `workspace:user-status-changed`, `workspace:user-moved-space`, `workspace:screen-share-state`, `workspace:user-recording-changed`, `workspace:user-left`, `workspace:presence-sync`, `livekit:leave-call`, `room-booking:auto-kick`, `room-booking:ended`, `workspace:knock-handled`, `missed-call:new`, `workspace:knock-cancelled`, `workspace:knock-unreachable`, `livekit:call-answered-elsewhere`, `dm:typing`, `dm:stopTyping`, `group:typing`, `group:stopTyping`, `dm:delivered`, `dm:message`, `dm:message-reactions`, `global-dm:message-reactions`, `global-dm:typing`, `global-dm:stopTyping`, `global-dm:message`, `group:message-rejected`, `group:thread-reply`, `group:thread-update`, `notification:new`, `group:message`, `group:message-reactions`, `video:incoming-call`, `video:call-accepted`, `video:ice-candidate`, `video:call-ended`, `video:call-declined`, `audio:incoming-call`, `audio:call-accepted`, `audio:ice-candidate`, `audio:call-ended`, `audio:call-declined`, `renegotiation-needed`, `renegotiation-accepted`, `workspace:users`, `workspace:join-confirmed`, `livekit:participants-update`, `workspace:heartbeat-ack`, `workspace:full-sync`, `workspace:presence-status`, `workspace:rejoin-result`, `livekit:screen-share-state`, `community-stream:user-left`, `livekit:join-error`, `livekit:join-call`, `livekit:init-call`, `community-stream:positions-sync`, `community-stream:position-changed`, `workspace:signal`, `workspace:knock-request`, … +9 more
  - listens for: `connection`, `packet`, `dm:join`, `dm:typing`, `dm:stopTyping`, `group:typing`, `group:stopTyping`, `dm:delivered`, `dm:message`, `dm:react`, `global-dm:join`, `global-dm:leave`, `global-dm:react`, `global-dm:typing`, `global-dm:stopTyping`, `global-dm:message`, `group:join`, `group:message`, `group:react`, `video:call-user`, `video:call-answered`, `video:ice-candidate`, `video:call-ended`, `video:call-declined`, `audio:call-user`, `audio:call-answered`, `audio:ice-candidate`, `audio:call-ended`, `audio:call-declined`, `renegotiation-needed`, `renegotiation-accepted`, `workspace:join`, `call:check-state`, `call:leave`, `livekit:leave-call`, `workspace:leave`, `workspace:heartbeat`, `workspace:request-sync`, `workspace:check-presence`, `workspace:rejoin`, `workspace:move-to-space`, `community-stream:position-update`, `workspace:recording-state`, `workspace:status-change`, `workspace:signal`, `workspace:screen-share-state`, `livekit:screen-share-state`, `workspace:knock`, `workspace:knock-accept`, `call:signal`, `call:p2p-fallback`, `call:end`, `workspace:knock-decline`, `workspace:knock-cancel`, `workspace:end-meeting`, `feed:join-channel`, `feed:leave-channel`, `feed:join-channels`, `feed:join-org`, `feed:leave-org`, … +15 more
- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`, `findById`; **writes:** `updateOne`
  - `ConferenceNoteSession` (server/note-taker/models/note-session.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
  - `DeviceToken` (server/models/deviceToken.model.ts) — reads: `distinct`, `exists`
  - `VoIPToken` (server/models/voipToken.model.ts) — reads: `distinct`, `exists`
  - `MissedCall` (server/models/missedCall.model.ts) — **writes:** `create`
  - `UserActivity` (server/models/userActivity.model.ts) — **writes:** `create`
  - `Message` (server/models/message.model.ts) — reads: `findById`; **writes:** `updateMany`
  - `UserNotification` (server/models/userNotification.model.ts) — **writes:** `create`, `insertMany`
  - `GlobalMessage` (server/models/globalMessage.model.ts) — reads: `findById`
  - `Group` (server/models/group.model.ts) — reads: `findById`, `findOne`
  - `GroupMessage` (server/models/groupMessage.model.ts) — reads: `findById`; **writes:** `findOneAndUpdate`
  - `Notification` (server/models/notification.model.ts) — **writes:** `insertMany`
  - `CallBooking` (server/models/callBooking.model.ts) — reads: `findById`
  - `Event` (server/models/event.model.ts) — reads: `findById`
  - `Workshop` (server/models/workshop.model.ts) — **writes:** `updateOne`
  - `FCMToken` (server/models/fcmToken.model.ts) — reads: `exists`
- **Environment variables (`process.env`):** `P2P_CALLS_ENABLED`
- **Timers / queues:** `setTimeout` at L231, L3735, L3747, L3848, L4735, …; `setInterval` at L389, L403, L474, L494

## Dependencies

- **Internal:**
  - `server/services/jwt.ts` — `verifyJwt`
  - `server/models/message.model.ts` — `Message`
  - `server/models/globalMessage.model.ts` — `GlobalMessage`
  - `server/utils/conv.ts` — `dmConvId`
  - `server/utils/globalConv.ts` — `globalDmConvId`
  - `server/models/group.model.ts` — `Group`
  - `server/models/groupMessage.model.ts` — `GroupMessage`
  - `server/realtime/idempotentSend.ts` — `createOnce`, `markPendingDMsDelivered`, `validClientMsgId`
  - `server/realtime/p2pCalls.ts` — `P2P_PROTOCOL`, `getIceServers`, `hasTurnRelay`, `newCallId`, `noteCallSocket`, `p2pCalls`, `peerOf`, `registerP2PCall`, … +1
  - `server/models/user.model.ts` — `User`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/userActivity.model.ts` — `UserActivity`
  - `server/models/notification.model.ts` — `Notification`
  - `server/models/userNotification.model.ts` — `UserNotification`
  - `server/models/missedCall.model.ts` — `MissedCall`
  - `server/models/voipToken.model.ts` — `VoIPToken`
  - `server/models/deviceToken.model.ts` — `DeviceToken`
  - `server/models/fcmToken.model.ts` — `FCMToken`
  - `server/services/socket.ts` — `setSocketInstance`
  - `server/services/livekit.ts` — `createRoom`, `createParticipantToken`, `deleteRoom`, `toLivekitRoomName`, `setRecordingContext`, `getLivekitUrl`, `getConferencePolicy`, `policyToSources`
  - `server/note-taker/agents/bot-manager.ts` — `BotManager as ConferenceBotManager`
  - `server/note-taker/models/note-session.model.ts` — `NoteSession as ConferenceNoteSession`
  - `server/realtime/mediasoupHandlers.ts` — `registerMediasoupHandlers`
  - `server/services/groupTypingPresence.ts` — `markTyping as markGroupTyping`, `clearTyping as clearGroupTyping`
  - `server/services/redis-presence.ts` — `WorkspacePresenceService`, `initRedisClients`, `getRedisSub`, `isRedisAvailable`
  - `server/services/pushNotification.ts` — `sendDMPushNotification`, `sendGroupPushNotification`, `sendKnockPushNotification`, `sendCallPushNotification`, `sendNetworkchainCallPush`, `sendNetworkchainCallCancelPush`, `sendMentionPushNotification`
  - `server/models/chatBlock.model.ts` — `hasBlocked`
  - `server/utils/attachmentMeta.ts` — `processAttachmentMeta`
  - `server/services/supportChat.ts` — `recordSupportMessage`
  - `server/services/voipPushNotification.ts` — `sendKnockVoIPPush`, `sendKnockVoIPCancelPush`
  - `server/services/fcmPushNotification.ts` — `sendKnockFCMPush`, `sendKnockCancelFCMPush`
  - `server/services/call-state.ts` — `callStateService`
  - `server/models/event.model.ts` — `Event`
  - `server/models/callBooking.model.ts` — `CallBooking`
- **Packages:**
  - `socket.io` — `Server`, `Socket`
  - `http` — `Server as HttpServer`
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/routes/betty.ts`
- `server/routes/livekitRecording.ts`
- `server/routes/workshopPreview.ts`

## Notes

- Large file (4987 lines) — read it by section; line numbers above point into it.
