# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/right-side-panel.tsx`

> Collapsible "Project Panel" sidebar for a Taskroom board that lists the room's team members with infinite scroll and lets the user bulk-add employees or remove a member (unassigning their tasks).

**Kind:** Next.js app-directory module (colocated) · **Lines:** 554

## Purpose
A Taskroom (kanban project) has a membership list stored in the external Taskroom API (`https://uatapi.garage.app/taskroom`). The kanban board renders this panel on the right side so users can see who is on the project and manage membership. The parent board owns the member list, the paging state and the column/task state; this component renders them and performs the add/remove calls, then patches the parent's state.

## How it works

### Local helpers (L74-L149)
- `StatusDot` - coloured dot for `"online" | "busy" | "offline"` (defined but not rendered anywhere in the file).
- `initialsFromName(name)` - first letters of the first two words, upper-cased.
- `MemberItem` - one row: avatar initial and name resolved by looking the member's `userId` up in the `employees` prop (falls back to "Unassigned"), plus a "..." dropdown with "Remove from project" (shows "Removing..." while that member is being removed).

### Member list and infinite scroll (L187-L207, L449-L472)
Members are de-duplicated by `userId` before rendering. When `observerHasMore` is true a sentinel div is rendered; an `IntersectionObserver` (threshold 0.1) on it calls the parent's `fetchMembers(observerPage + 1, true)` when it scrolls into view and nothing is already loading. A skeleton avatar shows while `observerLoading`.

### Bulk add (L214-L285, L480-L551)
The "+" button opens the "Add team members" dialog. `filteredEmployees` lists the `employees` prop minus anyone already a member, filtered by a case-insensitive name search. Checkboxes build `selectedIds`. `addSelectedMembers`:
1. Reads the Garage token `garage_tok` and org id `garage_org_id` from `localStorage`.
2. Verifies the token with `GET /backend/auth/me` (Bearer token); aborts if not OK.
3. Sends `POST https://uatapi.garage.app/taskroom/v1/users/roles/bulk` with `{ userIds, roomId, role: "view", orgId }` and the Bearer token.
4. On success appends the returned members (`result.data.data` or `result.data`) to the parent list, sets `newCountMenmbers` to the number selected, toasts, clears the selection and closes the dialog.

A step that would add the new members to the room's chat conversation is commented out; the helper `addMembersToTaskroomChatBulk` (POST `https://uatapi.garage.app/api/chat/conversations/{convId}/participants`) exists but is never called.

### Remove (L305-L388)
`removeMember(m)`: if the member has no `_id` it is just dropped from local state. Otherwise it verifies the token via `GET /backend/auth/me`, then sends `DELETE https://uatapi.garage.app/taskroom/v1/users/roles/{_id}`. On success it removes the member, decrements `newCountMenmbers`, and clears `assignedToId` on every task assigned to that user in both the parent's stage task list (`setStagecolumns`) and every column's `tasks` and `paginatedTaskRecords` (`setColumns`). Note this unassignment is local only; no task update request is sent.

## Exports
- `default RightSidePanel(props: Props)` - the panel. Props: `onClose`, `roomId` (the Taskroom id), `conversationId`, `workspaceUserId`, `userId`, `observerPage`, `observerHasMore`, `observerLoading`, `newCountMenmbers`, `setnewCountMenmbers`, `members`, `setMembers`, `fetchMembers(page, append)`, `employees`, `columns`, `setColumns`, `setStagecolumns`.

## Interfaces
- **Backend endpoints called:** `GET /backend/auth/me` - token sanity check before each add/remove (served by `server/routes/auth.ts`, `requireAuth`).
- **External services:** Taskroom API (`https://uatapi.garage.app/taskroom`): `POST /v1/users/roles/bulk` (add members with role `view`), `DELETE /v1/users/roles/{id}` (remove a membership). Unused: `POST https://uatapi.garage.app/api/chat/conversations/{id}/participants`.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - base URL of this app's backend.
- **Browser storage / cookies:** reads `localStorage` `garage_tok` (auth token) and `garage_org_id`.

## Dependencies
- **Internal:** `../types/kanban` (`Column`, `Task`, `Member`, `Employee`); shadcn UI `button`, `card`, `separator`, `avatar`, `scroll-area`, `input`, `dropdown-menu`, `dialog`, `skeleton`.
- **Packages:** `react`; `lucide-react` (icons); `sonner` (toasts); `js-cookie` (imported but unused).

## Used by
Rendered by `componentsSymbol/kanban-board.tsx` on the `/taskroom/all-taskrooms` page.

## Notes
- `conversationId`, `workspaceUserId`, `userId` and `columns` are accepted but effectively unused (the chat add is commented out).
- `setnewCountMenmbers(selectedIds.length)` overwrites the counter rather than adding to it, unlike removal which decrements.
- `handleObserver`'s `useCallback` dependency list omits `fetchMembers`, so it uses whichever `fetchMembers` existed when the deps last changed.
- Employee lookup matches `Employee.id`, while some other Taskroom files match on `_id`; a mismatch shows "Unassigned".
- A leftover `console.log('employeeswer', ...)` runs on every render.
