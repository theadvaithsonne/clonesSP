# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/chat-view.tsx`

> A legacy real-time group chat panel for a taskroom: it loads a conversation and its messages over REST, streams new messages over a Socket.IO `/chat` namespace on the external Garage UAT API, and shows a team-member sidebar.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 538

## Purpose
Each taskroom has an associated chat conversation (`conversationId`). This component was the board's "Chat" tab. `kanban-board.tsx` still imports it, but the `<ChatView ... />` line there is commented out and the tab now renders `TaskroomGroupChat` instead, so `ChatView` is not currently on screen. It talks only to the external service at `https://uatapi.garage.app`, not to this project's `/backend` Express app.

## How it works

### Loading and paging (L110-L195)
- When `conversationId` changes, all state is reset and `loadInitialChat` fetches the conversation (`getConversation`) and the newest 10 messages (`getMessages(conversationId, 10)`) in parallel. `hasMore` comes from `pagination.hasMore`. If `conversationId` becomes empty, the view is cleared and the socket is disconnected.
- **Infinite scroll upward:** when the user scrolls within 50 px of the top, `limit` grows by 10. An effect then re-fetches the **whole** latest page with the larger limit (`getMessages(conversationId, limit)`) and replaces `messages`. Paging is limit-based, not cursor-based, so every step downloads all earlier messages again.
- An effect keeps the scroll position stable while older messages load: on the first load it jumps to the bottom; later it offsets `scrollTop` by the growth in `scrollHeight`.

### Real-time (L197-L236)
Uses `useChat()` (which wraps the `socketService` singleton in `services/chat-service.ts`, connected to `https://uatapi.garage.app/chat`).
- On mount (per conversation) it emits `join_conversation { conversationId }`. On cleanup it emits `leave_conversation`.
- `new_message`: messages for other conversations are ignored. Otherwise the message is appended, and the view auto-scrolls if the user was already near the bottom or sent it.
- `conversation_error` and `access_denied`: shown as an error banner plus a toast, cleared after 5 seconds.

### Sending (L238-L264)
Enter (without Shift) or the send button. When the socket is connected it emits `send_message { conversationId, content, type: "text" }`. When it is not, it falls back to REST `sendMessage(...)`, shows "Message sent (offline)" and tries to reconnect. A message sent over REST is not added to the list locally.

### Rendering (L287-L537)
- `system` messages show as centred grey notices. Other messages are bubbles: right-aligned blue for the current user, left-aligned dark with avatar, name and time for others. Names and colours come from the `employees` prop.
- `SidebarContent` lists "Team Members": the current user (tagged "You") then `conversationData.participants`, each with an online dot from `onlineUsers` and a trash button behind a confirm `AlertDialog`. On wide screens it is a fixed right column; below `lg` it opens in a `Sheet`.
- The header shows the conversation name and member count, a search box (a toggle on mobile), and phone, video and menu buttons.

## Exports
- `ChatView({ users, currentUser, onlineUsers, employees, conversationId }: ChatViewProps)` - the chat panel. `currentUser` is a user id; `users` is accepted but never used.

## Interfaces
- **External services:** Garage UAT chat API (`https://uatapi.garage.app`), through `services/chat-api.ts`: `GET /api/chat/conversations/:id`, `GET /api/chat/conversations/:id/messages?limit=N`, `POST /api/chat/conversations/:id/messages`. This file also defines `removeMemberFromTaskroomChat`, which would call `DELETE /api/chat/conversations/:id/participants/:userId`, but it is never called.
- **Socket.IO events:** (namespace `/chat` on uatapi) emits `join_conversation`, `leave_conversation`, `send_message`; listens for `new_message`, `conversation_error`, `access_denied`.
- **Browser storage / cookies:** `localStorage.garage_tok` is the bearer token, read by `removeMemberFromTaskroomChat` here and by the `authedFetch` helper in `services/chat-api.ts` for the other calls.

## Dependencies
- **Internal:** `./hooks/use-chat` - socket connection state and `emit`; `./services/chat-api` - REST helpers (`getConversation`, `getMessages`, `sendMessage`); `components/ui/button`, `input`, `avatar`, `alert-dialog`, `sheet`.
- **Packages:** `react`; `lucide-react` - icons; `sonner` - toasts; `js-cookie` - imported but unused.

## Used by
- Imported by `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx`, but its usage there is commented out (replaced by `TaskroomGroupChat`). In practice it is not rendered.

## Notes
- **Misleading remove:** `handleRemoveMember` has the real API call commented out. It just re-fetches the conversation and still toasts "Member removed", so nobody is actually removed.
- The search input updates `searchQuery`, but nothing filters by it. The phone, video and more buttons have no handlers.
- `getEmployeeName(currentUser)[0]` falls back to the raw id when the user is not in `employees`, so the avatar shows the first character of the id.
- The external base URL is hard-coded to the UAT environment in this file and in its service modules.
