# `lib/conv.ts`

> Tiny helpers that build stable conversation-ID strings for direct messages, group chats and global (cross-org) DMs.

**Kind:** frontend library · **Lines:** 11

## Purpose
Chat code on the client needs one canonical key per conversation, both to compare against the "currently open" conversation (so unread counters are not bumped for the chat you are looking at) and to match the room/conversation IDs the backend uses. Sorting the two participant IDs means both sides of a DM compute the same string no matter who is "a" and who is "b".

## How it works
- `dmConvId(a, b)` sorts the two user IDs lexicographically and returns `dm:<low>:<high>`.
- `groupConvId(groupId)` returns `g:<groupId>`.
- `globalDmConvId(a, b)` sorts the two user IDs and returns `global-dm:<low>:<high>`.

All three are pure string functions with no side effects.

## Exports
- `dmConvId(a: string, b: string): string` - org DM key, `dm:<sorted a>:<sorted b>`.
- `groupConvId(groupId: string): string` - group chat key, `g:<groupId>`.
- `globalDmConvId(a: string, b: string): string` - global DM key, `global-dm:<sorted a>:<sorted b>`.

## Used by
`app/(dashboard)/layout.tsx`, `components/dashboard/DMPage.tsx`, `components/dashboard/GlobalDMPage.tsx`, `components/dashboard/GroupChatPage.tsx`, `components/dashboard/MainSidebar.tsx`, `lib/chat-context.tsx`. In `lib/chat-context.tsx` the IDs are compared against `activeConvId` to decide whether an incoming DM, group or global-DM message should increment the unread count.

## Notes
- The DM and global-DM formats match the backend helpers `server/utils/conv.ts` (`dmConvId`) and `server/utils/globalConv.ts` (`globalDmConvId`); `server/models/globalMessage.model.ts` stores `convId` in the `global-dm:<a>:<b>` form.
- The group format does **not** match the backend: `server/models/conversationState.model.ts` builds group IDs as `group:<groupId>`, while this file uses `g:<groupId>`. The client-side value is only safe for client-side comparisons; do not send it to the server expecting it to equal a stored `ConversationState` ID.
