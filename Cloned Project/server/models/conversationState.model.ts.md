# `server/models/conversationState.model.ts`

> Mongoose model storing each user's private inbox state (archived, manually marked unread) for a DM or group conversation.

**Kind:** Mongoose model · **Lines:** 52

## Purpose
Archiving a chat or marking it unread is a per-user decision: archiving a DM for yourself must not archive it for the other person, and group documents are shared by all members. Instead of adding flags to messages or groups, the app keeps one `ConversationState` row per (user, conversation). No row means the default state: in the inbox and not marked unread.

## How it works
- `userId` (ref `User`, required) and `convId` (string, required) identify the row; `kind` is `"dm"` or `"group"`.
- `convId` encoding: DM `dm:<userId1>:<userId2>` with the two ids sorted alphabetically (built by `dmConvId` in `server/utils/conv.ts`); group `group:<groupId>` (built by `groupConvId` here).
- `archivedAt` - null means in the main inbox; a timestamp means archived, and the archived tab sorts newest archive first.
- `markedUnreadAt` - manual "mark as unread", independent of message read receipts. The inbox treats the conversation as unread until it is opened again; the chat's `/read` endpoint clears it.
- `timestamps: true`.
- Indexes: unique `{userId, convId}` (one row per pair), `{userId, archivedAt:-1}` for the archived tab, `{userId, markedUnreadAt}` for the unread badge.
- The model is registered with the `models.ConversationState || model(...)` guard so re-importing (e.g. hot reload) does not throw `OverwriteModelError`.

## Exports
- `ConversationState` - Mongoose model (`"ConversationState"`, collection `conversationstates`). Untyped (no TS interface).
- `groupConvId(groupId: string | Types.ObjectId): string` - returns `group:<groupId>`.

## Interfaces
- **Database:** `ConversationState` (collection `conversationstates`) - read/write.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/conversationState.ts` (mounted at `/conv-state`, browser `/backend/conv-state`: `GET /`, `POST /archive`, `/unarchive`, `/mark-unread` and their `-bulk` variants), `server/routes/dm.ts` and `server/routes/groups.ts` (inbox listing and clearing unread state).

## Notes
- DM ids must be built with the shared `dmConvId` helper so both users' rows use the same sorted order; a hand-built id in the wrong order will not match.
