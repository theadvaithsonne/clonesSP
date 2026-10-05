# `server/note-taker/agents/bot-manager.ts`

> Process-wide singleton that attaches and detaches the hidden "Note Taker" LiveKit bot to webinar and conference rooms, and wires each bot to a transcription pipeline.

**Kind:** Note-Taker module — agents · **Lines:** 126

## Purpose
The note-taker feature records meetings by putting an invisible, subscribe-only participant into a LiveKit room, streaming every speaker's audio to Deepgram, and later summarising and emailing the result. `BotManager` is the single entry point the rest of the backend uses to start and stop that bot. It mints the bot's LiveKit token, creates a `BotSession` (the actual LiveKit connection), optionally attaches a `TranscriptionManager` to it, and keeps a map of active bots so the same room never gets two bots.

## How it works
- **Singleton.** `BotManager.getInstance()` lazily creates one instance per Node process. All callers (webinar start, conference socket handlers, the `/note-taker/sessions` REST router, recording routes) share the same maps, so state lives only in memory: a server restart loses track of running bots.
- **State.** Two maps keyed by the caller-supplied `webinarId` string: `sessions` (`BotSession`) and `transcriptionManagers` (`TranscriptionManager`). The key is just a handle; for webinars it is usually the workshopId or the LiveKit room name, for conferences the room name.
- **`join(opts)`**
  1. Throws `Bot already attached: <key>` if the key is already in `sessions` (callers check `hasBot()` first to stay idempotent).
  2. Resolves the room: `opts.roomName` if given, otherwise `webinarRoomName(opts.webinarId)` (which yields `toLivekitRoomName("webinar-<id>")`).
  3. Mints a token via `createParticipantToken(roomName, {...})` with identity `opts.botIdentity || "notetaker-bot"`, display name `opts.botName || "Note Taker"`, `canPublish: false`, `isOwner: false`, a 4-hour expiry, and metadata `{"isBot":true,"botType":"note-taker"}`. The metadata is what lets the frontend (e.g. `components/office/MeetSidebar.tsx`, `VideoGrid.tsx`'s `isBotParticipant`) and other bots hide this participant. An empty token (LiveKit credentials missing) throws `Failed to mint LiveKit bot token`.
  4. Creates a `BotSession` with `getLivekitUrl()` and stores it.
  5. Registers a `disconnected` listener that removes both map entries and emits `session-ended`.
  6. If `opts.sessionId` (a `NoteSession._id`) is given, creates a `TranscriptionManager(session, sessionId, language)` **before** connecting, so participants already in the room are captured when `connect()` replays them.
  7. Awaits `session.connect()`, emits `session-started`, returns the session.
- **`leave(key)`** throws `No bot in webinar: <key>` if unknown, otherwise disconnects the session; map cleanup then happens through the `disconnected` listener.
- **`disconnectAll()`** disconnects every session with `Promise.allSettled` and clears `sessions` (note: it does not clear `transcriptionManagers` directly; the per-session `disconnected` listener does).

The manager does **not** update `NoteSession` status or enqueue the summarise job when a bot leaves. Callers attach their own `session.once("disconnected", ...)` handler for that (see `server/routes/webinarRoutes.ts` and `server/realtime/socket.ts`).

## Exports
- `class BotManager extends EventEmitter`
  - `static getInstance(): BotManager` - the shared instance.
  - `hasBot(webinarId: string): boolean` - whether a bot is attached under that key.
  - `getSession(webinarId: string): BotSession | undefined` - the session for a key.
  - `getActiveSessions(): Map<string, BotSession>` - the live map (not a copy).
  - `join(opts: BotJoinOptions): Promise<BotSession>` - attach a bot (see above).
  - `leave(webinarId: string): Promise<void>` - detach a bot.
  - `disconnectAll(): Promise<void>` - detach every bot.
  - Events emitted: `session-started` (key, session), `session-ended` (key).
- `interface BotJoinOptions` - `{ webinarId: string; roomName?: string; botIdentity?: string; botName?: string; sessionId?: Types.ObjectId; language?: string }`.

## Interfaces
- **External services:** LiveKit server (the bot joins via the URL from `getLivekitUrl()`); Deepgram indirectly through `TranscriptionManager`.
- **Database:** none directly; `TranscriptionManager` writes `NoteSession` and the transcript.

## Dependencies
- **Internal:** `server/note-taker/agents/bot-session.ts` - LiveKit connection and audio events; `server/note-taker/transcription/transcription-manager.ts` - per-session Deepgram transcription; `server/services/livekit.ts` - `createParticipantToken`, `getLivekitUrl`; `server/services/webinarLivekitRecording.ts` - `webinarRoomName` default room naming.
- **Packages:** `events` - `EventEmitter` base; `mongoose` - `Types.ObjectId` type for `sessionId`.

## Used by
`server/note-taker/routes/sessions.ts` (`POST /backend/note-taker/sessions/join` and leave), `server/realtime/mediasoupHandlers.ts` (as `NoteTakerBotManager`, webinar auto-start/stop), `server/realtime/socket.ts` and `server/routes/livekitRecording.ts` (as `ConferenceBotManager`, conference note-taking), `server/realtime/webinarEnd.ts` (stop on webinar end), `server/routes/webinarRoutes.ts` (start on webinar go-live).

## Notes
- **Room-name pitfall.** When `roomName` is omitted, the key is passed through `webinarRoomName()`, which prepends `webinar-`. The conference caller in `socket.ts` passes `roomName` explicitly, as the JSDoc demands. However, `server/routes/webinarRoutes.ts` passes `webinarId: webinarRoomName(workshopId)` with no `roomName`, and `note-taker/routes/sessions.ts` passes `webinarId: roomName` with no `roomName`. Going by this file, those bots would join `webinar-webinar-<id>` and `webinar-<roomName>` respectively, which would be rooms nobody else is in. Check this before relying on those paths.
- `getSession`, `getActiveSessions`, `disconnectAll` and the `session-started`/`session-ended` events have no callers elsewhere in `server/`.
- State is in-memory only. With more than one backend process, `hasBot()` would only see that process's bots.
