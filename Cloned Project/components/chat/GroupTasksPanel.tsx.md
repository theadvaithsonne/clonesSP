# `components/chat/GroupTasksPanel.tsx`

> The right-side "Tasks" panel of a group chat: lists the tasks on the group's linked Taskroom board, with a "This group" / "Assigned to me" toggle, live refresh and a remove action.

**Kind:** React component (client) · **Lines:** 449

## Purpose
A group chat can be linked to a Taskroom board (an external task-management service). Tasks reach that board either by AI capture from chat messages or by hand (`/taskroom` slash command, see `ManualTaskroomForm.tsx`). This panel gives members a read view of those tasks without leaving the chat. It is group-chat only: `GroupChatPage` mounts it only when a board is linked and enabled, and it talks exclusively to the backend's `/groups/:groupId/taskroom/...` endpoints, which in turn talk to Taskroom.

## How it works
**Loading.** An effect fetches `GET /backend/groups/:groupId/taskroom/tasks?scope=group|mine` through `api()` whenever `groupId`, `scope`, the host's `refreshKey` or the internal `socketBump` counter changes, with a `cancelled` guard against stale responses. The response carries `board` (`roomId`, `spaceId`, `workspaceId`, `roomName`), `live` (whether Taskroom answered live or a cache was used), `counts.group` / `counts.mine` for the toggle badges, and `tasks`.

**Live updates.** It subscribes to the Socket.IO event `group:message-task` and bumps `socketBump` when the payload's `groupId` matches, causing a refetch. The backend emits this event to the `group:<groupId>` room from `server/services/groupTaskAuto.ts` (AI capture) and `server/services/groupTaskRemoval.ts`.

**Removing a task.** The kebab menu on each card offers "Remove from Taskroom", which calls `DELETE /backend/groups/:groupId/taskroom/tasks/:taskId`. The backend allows only the task's reporter or a group admin; a 403-like error message is turned into the toast "Only the reporter or an admin can remove this". On success the list refetches quietly (no spinner) via `refetchQuiet`. Only one removal runs at a time. An outside click closes the open menu.

**Rendering.**
- Header: title, an "Open board" button (when the board has a `roomId`) that calls `onOpenBoard`, and a close button.
- Scope toggle (`SegButton` + `CountBadge`).
- Body: spinner, error with "Try again" (bumps the counter), an empty state that differs by scope, or a list of local `TaskCard`s.
- `TaskCard` shows the title (struck through when `isCompleted`), a priority chip (`urgent`/`high`/`normal`/`low`, unknown values styled as normal), the stage chip (coloured with `stageColor` when present), a source chip ("AI" with sparkle, or "Manual"), up to two assignee names plus "+N", and the reporter with a relative creation time (`formatRelativeTime`). Clicking the card calls `onOpenBoard` with that task's room/space/workspace so the host can open Taskroom.

## Exports
- `default GroupTasksPanel({ groupId, isMini?, refreshKey?, onOpenBoard, onClose })` - `refreshKey` is bumped by the host (e.g. after creating a manual task) to force a refetch; `onOpenBoard({ roomId, spaceId?, workspaceId? })` opens the board in Taskroom; `isMini` is accepted but not used.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/groups/:groupId/taskroom/tasks?scope=group|mine` - members only; returns `{ ok, board, live, counts, tasks }`.
  - `DELETE /backend/groups/:groupId/taskroom/tasks/:taskId` - reporter or group admin only.
- **Socket.IO events:** listens for `group:message-task` (payload `{ groupId, ... }`).
- **External services:** Taskroom, indirectly through the backend (`server/routes/groups.ts`, mounted at `/groups`). Support-chat groups are blocked from these routes (404).

## Dependencies
- **Internal:** `lib/api.ts` - authenticated fetch to the backend; `lib/socket.ts` - shared Socket.IO client (`getSocket`); `lib/utils/format.ts` - `formatRelativeTime`.
- **Packages:** `lucide-react` - icons; `sonner` - toasts; `react` - hooks.

## Used by
- `components/dashboard/GroupChatPage.tsx` - right-panel region of a group chat.

## Notes
- `load()` is only used by `refetchQuiet`; the main effect duplicates the fetch inline. A quiet refetch clears `error` but swallows its own failures silently.
- Remove errors are classified by regex on the message text (`403|not allowed|permission|reporter|admin`), so the friendly toast depends on the backend's wording.
