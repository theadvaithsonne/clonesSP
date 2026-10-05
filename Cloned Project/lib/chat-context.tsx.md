# `lib/chat-context.tsx`

> App-wide React context for chat: keeps unread counts, @-mention flags, last-message previews and timestamps for direct messages, group chats and cross-org "global" DMs, kept live over Socket.IO, plus per-conversation draft text and files.

**Kind:** frontend library · **Lines:** 432

## Purpose
The sidebar, tab bar, mini chat windows and the chat pages all need the same chat summary: how many unread messages each conversation has, what the latest message says and when it arrived, and whether a group has an unread @-mention. Rather than every component fetching and listening for itself, `ChatProvider` (mounted in the dashboard layout) loads the summary once, updates it from socket events, and exposes it through `useChat()`. It also holds unsent drafts so switching conversations does not lose what the user was typing or attaching.

## How it works
### State (all keyed by the other user's id for DMs, or by group id)
- Unread: `dmUnread`, `groupUnread`, `globalDmUnread` (counts); `groupMentioned` (true when an unread group message @-mentions me).
- Previews: `dmLastMessageTime/Text`, `groupLastMessageTime/Text`, `globalDmLastMessageTime/Text`. Text is `"Sent an attachment"` when the message has attachments; group previews are prefixed `"You: "` or `"<sender name>: "`.
- `activeConvId` - the conversation currently open; messages for it never increment unread counts.
- `draftTexts` / `draftFiles` - unsent text and files per conversation, with raw setters exposed.
- `seenRef` - set of message `_id`s already processed, so a message delivered twice (for example to both a conversation room and a user room) is counted once. It is trimmed by 100 ids once it exceeds 500.
- `meId` comes from the JWT via `getUserIdFromToken()`.

### Initial load (mount only)
With `orgId` from `localStorage.garage_org_id` added as a query parameter when present, it calls in sequence: DM unread, group unread (including `mentioned`), DM last messages, group last messages, then (separately, not org-scoped) global-DM unread and last messages. A global-DM failure is logged and does not discard the org-scoped data; any other failure logs `[ChatContext] Error loading chat data`.

### Org switch
On the `org:switched` window event (dispatched by `components/dashboard/OrganizationSidebar.tsx`) it clears the active conversation, DM and group unread/mention/preview state and the seen-set. Global-DM state is left alone because it is not org-scoped. It does not refetch by itself.

### Live updates (re-subscribed when `meId` or `activeConvId` changes)
Uses the shared socket from `connectSocket()`:
- `dm:message` - update the preview for the other party; if the message is to me and its conversation (`dmConvId(me, from)`) is not open, increment unread and call `requestBellRefresh()`.
- `group:message` - ignore `type: "system"` events (like "X added Y", which the server also excludes from previews and counts); update the preview; if not sent by me and the group (`groupConvId`) is not open, increment unread, request a bell refresh, and set `groupMentioned` if `mentions` includes me.
- `global-dm:message` - like DMs, using `globalDmConvId`, but with no bell refresh.
- `dm:read`, `group:read`, `global-dm:read` - the server says I read a conversation (possibly in another tab or device); remove its unread entry (and the mention flag for groups).

### Clearing locally
`clearDmUnread`, `clearGroupUnread` (also clears the mention flag) and `clearGlobalDmUnread` drop an entry immediately when the user opens a conversation. The context value is memoised.

## Exports
- `ChatProvider({ children })` - the provider.
- `useChat(): Ctx` - read the context; throws `"useChat must be used within ChatProvider"` outside a provider. Fields: `activeConvId`, `setActiveConvId`, `dmUnread`, `groupUnread`, `groupMentioned`, `globalDmUnread`, `dmLastMessageTime`, `groupLastMessageTime`, `globalDmLastMessageTime`, `dmLastMessageText`, `groupLastMessageText`, `globalDmLastMessageText`, `clearDmUnread`, `clearGroupUnread`, `clearGlobalDmUnread`, `draftTexts`, `setDraftTexts`, `draftFiles`, `setDraftFiles`.

## Interfaces
- **Backend endpoints called** (all `requireAuth`; `?orgId=` appended when an org is selected, except global DMs):
  - `GET /backend/dm/unread` - `{ unread: [{ otherId, count }] }` (`server/routes/dm.ts`, mounted at `/dm`).
  - `GET /backend/groups/unread/all` - `{ groups: [{ groupId, count, mentioned? }] }` (`server/routes/groups.ts`, mounted at `/groups`).
  - `GET /backend/dm/last-messages` - `{ conversations: [{ otherId, timestamp, text?, hasAttachments? }] }`.
  - `GET /backend/groups/last-messages` - `{ groups: [{ groupId, timestamp, text?, hasAttachments?, from?, fromName? }] }`.
  - `GET /backend/global-dm/unread` and `GET /backend/global-dm/last-messages` (`server/routes/globalDm.ts`, mounted at `/global-dm`).
- **Socket.IO events:** listens for `dm:message`, `group:message`, `global-dm:message`, `dm:read`, `group:read`, `global-dm:read` (emitted by `server/realtime/socket.ts` and the `dm`, `groups`, `globalDm` and `garageAdminSupportChats` routes). Emits nothing.
- **Browser storage:** reads `localStorage.garage_org_id` and the JWT (via `lib/auth.ts`).
- **Browser events:** listens for `org:switched`; indirectly dispatches `notifications:refresh` through `requestBellRefresh()`.

## Dependencies
- **Internal:** `lib/socket.ts` - shared Socket.IO client (`connectSocket`); `lib/conv.ts` - `dmConvId`, `groupConvId`, `globalDmConvId` to compare incoming messages with `activeConvId`; `lib/api.ts` - authenticated fetch; `lib/auth.ts` - `getToken`, `getUserIdFromToken`; `lib/bell-refresh.ts` - throttled bell refresh.
- **Packages:** `react` - context, state, refs, effects.

## Used by
- `app/(dashboard)/layout.tsx` - mounts `ChatProvider`.
- `components/dashboard/AppTabBar.tsx`, `DMPage.tsx`, `GlobalDMPage.tsx`, `GroupChatPage.tsx`, `MainSidebar.tsx`, `MiniChatWindow.tsx`, `RightPanel.tsx` (all in `components/dashboard/`).

## Notes
- The initial load runs once per mount. After `org:switched` the org-scoped maps are emptied and only refill from new socket traffic unless something remounts the provider or refetches.
- `meId` uses a non-null assertion; mounting the provider without a token makes every comparison with `meId` fail silently.
- The socket listeners are torn down and re-added every time `activeConvId` changes (it is captured in the handlers' closure).
- `seenRef` is shared across DMs, groups and global DMs, which is safe because message ids are unique ObjectIds.
