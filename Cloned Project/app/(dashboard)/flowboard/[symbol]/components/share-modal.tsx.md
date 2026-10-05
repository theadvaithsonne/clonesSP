# `app/(dashboard)/flowboard/[symbol]/components/share-modal.tsx`

> The Flowboard "Board Members" modal: invite organisation users to a board with a role, list and search current members with infinite scroll, change their roles and remove them.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 544

## Purpose

Board access in Flowboard is managed per board through members with one of three roles: `admin`, `member` or `observer` (observers are read-only on the board). The board's **Invite Member** button opens this modal. It is a thin UI over `store/flowboard/memberStore.ts`:
- Member records are stored in the external Flowboard API (`https://uatapi.garage.app/flowboard/v1/members`).
- The list of people who can be invited comes from this app's own backend: the users of the current Garage organisation.

## How it works

### Inviting (L170-L223, L287-L365)
- An "Email address or name" input calls `searchUsers(query)` on every keystroke. The store resolves the org from `localStorage.garage_org_id` and requests `GET /backend/public/organizations/:orgId/users?search=...`. That route is served by `server/routes/public.ts`, mounted at `/public` in `server/app.ts`. It is unauthenticated and does a case-insensitive regex search on name, email and phone among the org's users.
- `searchUsers("")` is also called once on mount.
- Results appear in a dropdown (avatar or initial, name, email). A full-screen transparent overlay closes the dropdown when the user clicks outside it.
- Choosing a user calls `handleSelectUser`, which runs `addMember({ boardId, orgId, role: inviteRole, memberUserId, email, name, image: "", boardSocketId, notificationSocketId, newBoardMember: true }, payload)`. The second argument is a member-shaped object the store uses to update its list optimistically. The store sends `POST https://uatapi.garage.app/flowboard/v1/members`.
- **Role picker:** Member and Observer are always offered. Admin is offered only when the viewer's `role` is `admin` and they are also the board owner (`userId === currentBoard.userId`).
- The invite controls are hidden when the viewer's `role` is `"member"`.

### Member list (L151-L168, L375-L519)
- On open, the modal calls `fetchMembers(boardId, 1, "")`, which sends `GET .../flowboard/v1/members?boardId&size=50&page=1`.
- A "Search members..." box refetches page 1 with the query after a 500ms debounce.
- **Infinite scroll:** an `IntersectionObserver` is attached to the last member row (`lastMemberElementRef`) and calls `loadMoreMembers(boardId, memberSearchQuery)`. A skeleton row shows while more members load, and skeleton rows show during the first load.
- The count badge shows `pagination.count`, or the number of loaded members.
- Each row shows the member's initial, name (with "(you)" for the current user), email and role.
- **Row controls (only when the viewer's role is not `"member"`):**
  - A role `<select>` that calls `updateMember(member._id, role)` (`PUT .../members/:id`). It is disabled for the board owner. Admin appears as an option only if the viewer is the admin owner or the member is already an admin.
  - A trash button, for anyone except the board owner. It opens an `AlertDialog` ("Are you absolutely sure?"). Confirming calls `deleteMember(member._id)` (`DELETE .../members/:id`) and shows a "Deleting..." state.

### Sockets (L99-L122)
- The modal subscribes to `member:created` on `boardSocketService`, but the handler only logs the payload.
- The current board and notification socket ids are read once and sent with `addMember`, so the API can avoid echoing the event back to this client.

## Exports
- `ShareModal: React.FC<ShareModalProps>` with these props:
  - `onClose()`
  - `boardId`
  - `orgId`
  - `userId`: the current user
  - `role`: the viewer's board role, `"admin" | "member" | "observer" | undefined`
  - `currentBoard`: the board object, used for its owner `userId`

## Interfaces
- **Backend endpoints called:** `GET /backend/public/organizations/:orgId/users?search=...` (through `memberStore.searchUsers`), which lists invitable organisation users.
- **External services:** Flowboard API `GET/POST https://uatapi.garage.app/flowboard/v1/members`, plus `PUT` and `DELETE .../members/:id`, all called through the member store.
- **Socket.IO events:** listens for `member:created` on the external Flowboard `/boards` namespace (log only).
- **Browser storage / cookies:** the store reads `localStorage.garage_org_id` for user search.

## Dependencies
- **Internal:**
  - `store/flowboard/memberStore`: all member data and actions
  - `../../lib/board-socket-service` and `../../lib/notification-socket-service`: socket ids and events
  - `components/ui/alert-dialog`: the delete confirmation
  - `components/ui/skeleton`: loading placeholders
  - `components/ui/button`: imported but unused
- **Packages:** `react`, `lucide-react` (icons).

## Used by
- `kanban-board.tsx`, through the Invite Member button, which observers cannot use.
- `kanban-board-list-view.tsx`.

Both render on the route `/flowboard/<boardId>`.

## Notes
- **Observers see the invite controls.** The check is `role != "member"`, so an observer passes it. Only the parent's `blockIfReadOnly` stops observers from opening the modal from the board view. Whether the API enforces roles is up to the external service.
- **Load-more can use a stale query.** The `useCallback` deps of `lastMemberElementRef` leave out `memberSearchQuery`, so after a new search, load-more may still send the previous query.
- **No unique React keys.** Rows are wrapped in a key-less fragment (`<>`), and the inner `key={member.id}` sits on the wrong element.
- **Dead code:**
  - `handleCopy` and `handleCopyLink` copy a hardcoded `https://flowboard-new-garage-app.vercel.app/flowboard/<boardId>` link, but no button calls them.
  - The `ShareLinkProps` interface and the `copied` state are unused.
  - So are the `avatarColors` array and several icon imports.
- Debug `console.log` calls print the member list on every render.
