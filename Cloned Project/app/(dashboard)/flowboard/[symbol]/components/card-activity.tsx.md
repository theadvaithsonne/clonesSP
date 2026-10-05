# `app/(dashboard)/flowboard/[symbol]/components/card-activity.tsx`

> The "Activity" (comments) section of a Flowboard card: loads, posts, edits and deletes card comments against the external Flowboard API and keeps them in sync live over the Flowboard board socket.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 525

## Purpose
Every Flowboard card modal (`card-modal.tsx`) ends with a comment thread. This component owns that thread: its list state, the composer, the author's inline edit and delete controls, and real-time updates from other viewers. Comments live in the external Flowboard service (`https://uatapi.garage.app/flowboard`), not in this repo's backend. The component also reports comment count changes upward, so the card tile on the board can show an updated badge.

## How it works

### State
- `comments` (`CommentItem[]`, newest first), `isLoading`, `error`, `newComment` (composer text), and `editingId` / `editingText` for the comment being edited inline.
- `UserData` holds the current user's name, decoded from the JWT in `localStorage.garage_tok` with `jwtDecode`. It is only used by commented-out avatar markup.
- The `baseUrlComments` constant is hardcoded to `https://uatapi.garage.app/flowboard`.

### Loading
- `fetchComments()` runs whenever `boardId` or `cardId` changes. It sends `GET /v1/comments?boardId&cardId&page=1&size=50` with a Bearer token when one exists, and replaces `comments` with `data.data`.
- Errors go to `error` and the console. `error` is never rendered.
- There is no paging beyond the first 50 comments.

### Real-time sync (board socket)
These listeners are registered through `boardSocketService.on`. The service forwards every server event via `onAny`. Handlers are removed on unmount and re-registered whenever `onCommentCountChange` changes identity.
- `comment:created` - prepends the payload to the list.
- `comment:updated` - replaces the `comment` text of the matching `_id`.
- `comment:deleted` - removes the comment. It accepts either a bare id string or an object with `_id`, `commentId` or `id`.

Socket events do not change the card's comment count; only this user's own actions do.

### Writing
Every write reads `localStorage.garage_tok` and stops with a toast if it is missing. Every write also sends `boardSocketService.socketId`, so the Flowboard server can skip echoing the event back to this tab.
- **Post** (`handlePost`; Enter without Shift, or the "Add Comment" button):
  - Trims the text and clears the composer straight away.
  - Sends `POST /v1/comments` with `{ boardId, cardId, comment, socketId }`.
  - On success it prepends the returned comment and calls `onCommentCountChange(1)`.
  - On failure it shows a toast. The typed text is lost.
- **Edit** (`handleSaveEdit`):
  - An empty edit just closes the editor.
  - Otherwise it sends `PUT /v1/comments/:id` with `{ comment, socketId }` and updates the text locally on success.
- **Delete** (`handleDelete`):
  - Sends `DELETE /v1/comments/:id?socketId=…`.
  - On success it removes the comment, calls `onCommentCountChange(-1)` and shows a "Comment deleted" toast.
  - It sets `isLoading` while the call runs, which also disables the Add button.

### Rendering
- The composer textarea sits above the list.
- While the first load runs, three pulsing skeleton rows appear.
- Each comment shows an initials avatar, `userId.name`, a relative time (`formatDistanceToNow`) and the text.
- Edit and Delete links appear on hover, only when `c.userId._id === userId`, so only the author sees them. The Flowboard server is expected to enforce this as well.

## Exports
- `CardActivity({ boardId, cardId, userId?, connected, className?, onCommentCountChange?, setColumns })` - the comment thread component.
  - `onCommentCountChange(diff)` is called with +1 or -1 after this user's own post or delete.
  - `connected` and `setColumns` are accepted but not used.

## Interfaces
- **External services:** Flowboard API (`https://uatapi.garage.app/flowboard`), all calls with `Authorization: Bearer <garage_tok>`:
  - `GET /v1/comments?boardId=…&cardId=…&page=1&size=50` - list comments
  - `POST /v1/comments` - create a comment
  - `PUT /v1/comments/:id` - edit a comment
  - `DELETE /v1/comments/:id?socketId=…` - delete a comment
- **Socket.IO events:** listens for `comment:created`, `comment:updated` and `comment:deleted` on the Flowboard `/boards` namespace, through `boardSocketService`. Nothing is emitted.
- **Browser storage / cookies:** reads `localStorage.garage_tok`, the app's session JWT.

## Dependencies
- **Internal:**
  - `app/(dashboard)/flowboard/lib/board-socket-service.ts` - singleton Flowboard socket: `on`/`off` and `socketId`.
  - `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx` - the `Column` type only.
  - `components/ui/avatar.tsx`, `button.tsx`, `textarea.tsx` - UI primitives.
  - `components/ui/input.tsx`, `popover.tsx` - imported but unused.
  - `lib/utils.ts` - `cn` class merging.
- **Packages:**
  - `date-fns` - relative timestamps.
  - `jwt-decode` - reading the user's name from the token.
  - `sonner` - toasts.
  - `lucide-react` - icons.
  - `react` - hooks.
  - `js-cookie` - imported but unused.

## Used by
- `app/(dashboard)/flowboard/[symbol]/components/card-modal.tsx`, which renders it at the bottom of the card modal's left column. In the browser that is `/flowboard/[symbol]`.

## Notes
- Several `console.log` calls with nonsense labels run on every render and on every socket event.
- Duplicate risk: `handlePost` prepends the server's response. If the Flowboard server also broadcasts `comment:created` to the sender, ignoring `socketId`, the comment appears twice. The code relies on the server excluding the sender's `socketId`.
- `getEmployeeName` is a leftover mock and is never called.
- The token is never checked for expiry here, unlike the session-expiry checks in `card-modal.tsx`.
