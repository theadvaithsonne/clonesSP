# `server/realtime/mediasoupHandlers.ts`

> Module exporting `registerMediasoupHandlers`.

**Kind:** Socket.IO / realtime · **Lines:** 3405

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `registerMediasoupHandlers` | function | `registerMediasoupHandlers(io: Server, socket: Socket): void` | 750 |

## Interfaces

- **Socket.IO events:**
  - emits: `webinar:productUnpinned`, `webinar:peerLeft`, `webinar:peerJoined`, `webinar:replacedByDevice`, `webinar:joinDenied`, `webinar:joinRequest`, `webinar:newProducer`, `webinar:consumerClosed`, `webinar:screenShareStopped`, `webinar:newMessage`, `webinar:messageReaction`, `webinar:newQA`, `webinar:qaUpdated`, `webinar:newPoll`, `webinar:pollUpdated`, `webinar:forceMuted`, `webinar:removedFromRoom`, `webinar:roleChanged`, `webinar:peerRoleChanged`, `webinar:handRaised`, `webinar:peerMicState`, `webinar:peerCameraState`, `webinar:peerNameChanged`, `webinar:reaction`, `webinar:recordingStarted`, `webinar:recordingStopped`, `webinar:recordingReady`, `webinar:productPinned`, `webinar:auctionPing`, `webinar:productPurchased`, `webinar:webinarEnded`
  - listens for: `webinar:joinRoom`, `webinar:requestJoin`, `webinar:respondJoinRequest`, `webinar:cancelJoinRequest`, `webinar:createWebRtcTransport`, `webinar:connectTransport`, `webinar:produce`, `webinar:consume`, `webinar:closeProducer`, `webinar:resumeConsumer`, `webinar:getProducers`, `webinar:sendMessage`, `webinar:reactToMessage`, `webinar:sendQA`, `webinar:upvoteQA`, `webinar:answerQA`, `webinar:createPoll`, `webinar:submitVote`, `webinar:muteParticipant`, `webinar:removeParticipant`, `webinar:promoteToHost`, `webinar:demoteToAttendee`, `webinar:raiseHand`, `webinar:micState`, `webinar:cameraState`, `webinar:updateName`, `webinar:sendReaction`, `webinar:startRecording`, `webinar:stopRecording`, `webinar:pinProduct`, `webinar:unpinProduct`, `webinar:auctionPing`, `webinar:productPurchased`, `webinar:endWebinar`, `webinar:sync`, `webinar:leaveRoom`, `disconnect`
- **Database (Mongoose models used):**
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`; **writes:** `updateOne`, `findByIdAndUpdate`
  - `Meet` (server/models/meet.model.ts) — reads: `findById`; **writes:** `findByIdAndUpdate`, `create`
  - `WorkshopSessionOverride` (server/models/workshopSessionOverride.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`
  - `NoteSession` (server/note-taker/models/note-session.model.ts) — reads: `findById`, `findOne`; **writes:** `create`
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`; **writes:** `updateOne`
  - `WebinarMessage` (server/models/webinarMessage.model.ts) — reads: `find`, `findOne`, `findById`; **writes:** `create`, `updateOne`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`
- **Environment variables (`process.env`):** `WEBINAR_PEER_GRACE_MS`, `WEBINAR_HOST_ABSENT_MS`, `FRONTEND_URL`
- **Timers / queues:** `setTimeout` at L129, L239, L309, L575, L1764, …

## Dependencies

- **Internal:**
  - `server/services/mediasoup.ts` — `getOrCreateRoom`, `getRoom`, `removeRoom`, `createWebRtcTransport`, `rooms`
  - `server/services/webinarRecording.ts` — `startServerRecording`, `stopServerRecording`, `isRecording as isServerRecording`
  - `server/services/webinarLivekitRecording.ts` — `startWebinarLivekitRecording`, `stopWebinarLivekitRecording`, `isWebinarLivekitRecording`, `webinarRoomName`, `awaitWebinarRecordingFile`
  - `server/services/livekit.ts` — `countWebinarParticipants`, `getActiveEgress`
  - `server/services/livekit.ts` — `setParticipantPublishGrant`
  - `server/note-taker/agents/bot-manager.ts` — `BotManager as NoteTakerBotManager`
  - `server/note-taker/models/note-session.model.ts` — `NoteSession`
  - `server/note-taker/jobs/queue.ts` — `enqueueSummarize`
  - `server/models/webinarMessage.model.ts` — `WebinarMessage`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/meet.model.ts` — `Meet`
  - `server/models/user.model.ts` — `User`
  - `server/services/workshop.ts` — `hasSessionAccess`, `isBilledSpeaker`
  - `server/services/webinarHost.ts` — `claimSessionHost`, `isStreamStaff`, `releaseSessionHost`, `resolveSessionAnchor`
  - `server/services/webinarLiveState.ts` — `clearLiveState`, `loadLiveState`, `saveLiveState`
  - `server/realtime/webinarPresence.ts` — `DEFAULT_PEER_GRACE_MS`, `isSameDevice`, `markDisconnected`, `pickActiveSeat`, `removePeer`, `seatsOfUser`, `takeSeat`
  - `server/realtime/webinarPresence.ts` — `LeaveReason`, `PresenceHooks`, `(types only)`
  - `server/realtime/webinarEnd.ts` — `endWebinarSession`, `dropLivekitRoom`
  - `server/models/workshopSessionOverride.model.ts` — `WorkshopSessionOverride`
  - `server/utils/workshopStatus.ts` — `sessionDayKey`
  - `server/services/socket.ts` — `emitWorkshopPreviewUpdate`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/mediasoup.ts` — `PinnedProductSnapshot`, `WebinarPeer`, `WebinarRoom`, `(types only)`
  - `server/services/sellables.ts` — `getSellable`, `SellableItemType`
- **Packages:**
  - `socket.io` — `Server`, `Socket`
  - `mongoose`

## Used by

- `server/realtime/socket.ts`

## Notes

- Large file (3405 lines) — read it by section; line numbers above point into it.
