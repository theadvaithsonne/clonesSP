# `components/chat/TaskroomLinkPicker.tsx`

> Radio-card picker for choosing which Taskroom workspace/board a group chat feeds, plus two shared helpers: ensuring the viewer has a Taskroom account and opening a board in the Taskroom panel.

**Kind:** React component · **Lines:** 532

## Purpose
A Garage group chat can be linked to a board in Taskroom (an external task-management service). This picker is shared by the Create Group dialog and the group's Admin Controls. It only **chooses**: the resulting `LinkChoice` becomes the body of `PUT /backend/groups/:groupId/taskroom`, and the backend creates the workspace/board as needed and syncs the members. The lists are read with the viewer's own token, so the picker only offers workspaces and boards the viewer already belongs to.

## How it works

### Taskroom access (L46-L115)
- Base URL is `NEXT_PUBLIC_TASKROOM_URL` (empty string if unset); paths are appended without a slash, so the value must end with `/`.
- `taskroomToken()` reads the Garage JWT straight from localStorage key `garage_tok`.
- `taskroomList(path)` performs a `no-store` GET, throws on a non-OK response or `status: false`, and accepts `{ data: [...] }` or one extra `{ data: { data: [...] } }` wrapper. Items without a string `_id` are dropped. It throws `"Taskroom is not configured"` when the env var is missing.
- `LIST_SIZE = 500`: Taskroom returns oldest first, so a small page would hide the newest workspaces and boards.
- `ensureTaskroomAccount()`: Taskroom creates a user's account on the first `GET users/profile`; before that other routes return 401 and the backend link route returns 409. The promise is cached per token in the module-level `accountReady` map, and only a success is kept (a failure is removed so the next call retries).

### Opening a board (L117-L154)
`openTaskroomBoard(board)` guards against double clicks with a module flag, shows a loading toast, ensures the account, calls `useTaskroomWorkspacetore.getState().navigateToServiceRoom(board)` to select the room in the Taskroom store, then dispatches the window event `service:open-taskroom` with `{ roomId }`. The dashboard layout (`app/(dashboard)/layout.tsx`) listens for that event and switches to the Taskroom container (Taskroom is popover-driven, not routed). Errors are toasted, so callers can fire and forget. Same two steps as "Take to Taskroom" in `ServiceEngagementView`.

### The picker component (L156-L531)
- Two radio cards (`ChoiceCard`): "Create automatically" (`{ mode: "new-workspace" }`, a new workspace and board named after the group) and "Use an existing workspace".
- On mount it ensures the account and loads `workspaces/me?size=500`. A request counter makes Retry safe against a slow earlier attempt.
- When an existing workspace is selected, `loadBoards()` lists `spaces/me?workspaceId=...` and then `rooms/me?spaceId=...` for every space in parallel, labelling boards `"<space> › <board>"`. It is all-or-nothing: any failure marks the whole list as an error with Retry, so a partial list never hides the board the admin wants. Results are cached per workspace in `boardLists`.
- The board select offers "+ New board for this group" (sentinel value `__new__`, giving `{ mode: "new-board", workspaceId }`) and each existing board (`{ mode: "existing-board", workspaceId, roomId }`). Changing workspace always resets to `new-board`.
- Self-correcting effect (L322-L351): the picker always represents a valid choice. A `null` value becomes `new-workspace`; a workspace-load error falls back to `new-workspace`; a workspace that is no longer listed becomes `new-board` in the first workspace (or `new-workspace` if none); a board that is no longer listed becomes `new-board` in the same workspace.
- `lastExistingRef` remembers the last existing-workspace choice so toggling to "automatic" and back restores it. `onChange` is read through a ref so parents can pass inline callbacks without re-running effects.
- States shown: loading spinner, "Couldn't reach Taskroom" with Retry (only the automatic option remains), and "You aren't in any Taskroom workspace yet" when the list is empty. Helper text explains that linking an existing board adds group members without removing anyone, while a new board goes into a "Group Chats" space.

## Exports
- `default TaskroomLinkPicker({ groupName?, value: LinkChoice | null, onChange(v), disabled? })` - the picker; `groupName` is used in the hint text.
- `ensureTaskroomAccount(): Promise<boolean>` - makes sure Taskroom knows the current user (cached per token).
- `openTaskroomBoard(board: TaskroomBoardRef): Promise<boolean>` - opens a board in the dashboard's Taskroom panel.
- `LinkChoice` (type) - `{ mode: "new-workspace" } | { mode: "new-board"; workspaceId } | { mode: "existing-board"; workspaceId; roomId }`.
- `TaskroomBoardRef` (type) - `{ roomId, spaceId?, workspaceId? }`.

## Interfaces
- **External services:** Taskroom API at `NEXT_PUBLIC_TASKROOM_URL`: `GET users/profile`, `GET workspaces/me`, `GET spaces/me`, `GET rooms/me`, called with the Garage bearer token.
- **Backend endpoints called:** none directly; the chosen `LinkChoice` is sent by the parent to `PUT /backend/groups/:groupId/taskroom`.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base (must end in `/`).
- **Browser storage / cookies:** reads localStorage `garage_tok`.
- **Browser events:** dispatches `service:open-taskroom` on `window`.

## Dependencies
- **Internal:** `store/taskroom/taskroomWorkspace.tsx` - `useTaskroomWorkspacetore` (`navigateToServiceRoom`); `components/ui/radio-group.tsx`, `components/ui/select.tsx` - UI; `lib/utils.ts` - `cn`.
- **Packages:** `react`, `sonner` (toasts), `lucide-react` (icons).

## Used by
- `components/chat/GroupAdminPanel.tsx` - picker, `ensureTaskroomAccount`, `openTaskroomBoard`.
- `components/dashboard/CreateGroupDialog.tsx` - picker and `ensureTaskroomAccount`.
- `components/dashboard/GroupChatPage.tsx`

## Notes
- If `NEXT_PUBLIC_TASKROOM_URL` is unset, `ensureTaskroomAccount` resolves `false` and the lists show the error state, leaving only "Create automatically".
- The module-level `openingBoard` flag and `accountReady` cache are shared by every importer in the tab.
