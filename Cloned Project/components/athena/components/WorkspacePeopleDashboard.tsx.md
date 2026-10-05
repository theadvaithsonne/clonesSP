# `components/athena/components/WorkspacePeopleDashboard.tsx`

> The Athena/Taskroom "People" screen: tabbed member management for the current workspace, space and room, including an invite-to-workspace dialog backed by the external Taskroom API.

**Kind:** React component · **Lines:** 838

## Purpose
Athena is the project-management (Taskroom) module of Garage. Its data lives in an external Taskroom service (`NEXT_PUBLIC_TASKROOM_URL`, defaulting to `https://uatapi.garage.app/taskroomv2/v2/`), not in this repo's Express backend. This component is the People view rendered inside the project-management shell: it shows who belongs to the selected workspace, space and room, lets admins/owners invite people from the Garage organisation, change workspace roles and remove members.

## How it works

### Scope and permissions (L654-L712)
- The workspace, space and room come from the `useTaskroomWorkspacetore` zustand store (`currentWorkspace`, `spaceData`, `activeSpaceId`, `currentRoomDetail`). When the URL has `?shareTask=...`, the IDs are read from the `workspaceId` / `spaceId` query parameters instead (shared-task links).
- `canManageMembers` grants management when the user's member detail has role `admin` or `owner`, or `isOwner`. `memberDetailFrom` reads that detail from an entity's `MemberDetail` field or from the entity itself. Permission is evaluated separately for workspace, space and room.
- Three scope tabs (`PeopleScopeTabs` from `members-view`) show label, entity name and member count; a tab is disabled when its entity is not selected.

### Data loading
- Workspace members: on workspace change, calls the store's `fetchMembers(workspaceId, 1, "", true, false)` and resets to the workspace tab. The count comes from store `metadata.count`.
- Space and room counts: separate `GET .../space/members` and `GET .../room/members` calls with `page: 1, size: 1`, reading `metadata.count` (fallback: length of `data.data.data`).
- A window event `taskroom:open-invite-people` opens the invite dialog, but only if the user can manage the workspace. This lets other parts of the shell (e.g. a sidebar button) trigger the dialog.

### Workspace members tab (L509-L650)
- Renders a `MembersTable` (name, email, role, status, plus actions column for managers) using row/cell components from `members-table`.
- Infinite scroll: an `IntersectionObserver` on a sentinel row inside the table's scroll container loads the next page (`PAGE_SIZE = 50`) via `fetchMembers(..., append = true)`. `hasMorePages` decides from API metadata (`nextPage`, `totalPages`/`currentPage`) or, without metadata, from whether every loaded page is full.
- Role change: `PUT {TASKROOM}workspace/members/:memberId` with `{ role }`, then `updateMemberRole` in the store. Roles: `member`, `observer`, `admin` (`WORKSPACE_ROLES`). Owners cannot be edited (no actions menu).
- Remove: opens `RemoveMemberConfirmDialog`; on confirm calls the store's `removeMember` (which issues `DELETE {TASKROOM}workspace/members/:memberId`).
- Footer shows the total member count.

### Invite dialog (L125-L395)
- On open, fetches all current members (`GET .../workspace/members/all?workspaceId=`) to build a set of existing emails to exclude.
- Search is debounced 300ms and calls `https://test.garage.app/public/organizations/:garage_org_id/users?search=` (org ID from `localStorage.garage_org_id`), filtering out already-selected users and existing members.
- Selected people are listed with a per-person role dropdown (default Member) and remove button.
- Send: `POST {TASKROOM}workspace/members/bulk` with `{ membersList: [{ memberUserId, email, name, image, role }], workspaceId, orgId }`. On success each returned item is merged into the store with `addMemberToState`, a toast is shown, and the parent refetches page 1.

### Space and room tabs
Delegated to `SpaceMembersDialog` and `RoomMembersDialog` rendered in `embedded` mode (always open, no-op close), keyed so they remount when the workspace/space changes. Empty-state messages appear when nothing is selected.

## Exports
- `default WorkspacePeopleDashboard()` - the People screen, no props; all context comes from stores and the URL.

## Interfaces
- **External services (Taskroom API, `NEXT_PUBLIC_TASKROOM_URL`):** `GET workspace/members/all`, `GET space/members`, `GET room/members`, `POST workspace/members/bulk`, `PUT workspace/members/:id`; via the store `GET workspace/members` and `DELETE workspace/members/:id`.
- **External services:** `GET https://test.garage.app/public/organizations/:orgId/users?search=` - organisation user search (hardcoded host).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base.
- **Browser storage:** `localStorage.garage_tok` (Bearer token sent on every call), `localStorage.garage_org_id`.
- **Window events:** listens for `taskroom:open-invite-people`.

## Dependencies
- **Internal:** `store/taskroom/taskroomWorkspace.tsx` (current workspace/space/room), `store/taskroom/workspaceMemberStore.ts` (paged member list, role update, removal), `./members-table` (table primitives, `getInitials`, `OwnerBadge`), `./members-view` (`PeopleScopeTabs`), `./space-members-dialog`, `./room-members-dialog`, `./remove-member-confirm-dialog`, `components/ui/*` (button, avatar, dialog, dropdown-menu), `lib/utils.ts` (`cn`).
- **Packages:** `axios` (HTTP), `next/navigation` (`useSearchParams`), `sonner` (toasts), `lucide-react` (icons), `react`.

## Used by
- `components/athena/ProjectMangement.tsx`
- `components/athena/projectmangerbacku.tsx`

## Notes
- `MEMBERS_API_BASE` strips trailing slashes and has a fallback, but several calls use `${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/...` directly with no fallback; if the env var is unset those URLs start with `undefined`.
- The org-user search is hardcoded to `test.garage.app`, a test host, regardless of environment.
- `roles`, `cn`, `UserPlus`, `Users`/`Plus` icons partly unused; `roles` is only used as the default role for newly selected users.
- The invite search interpolates the raw query into the URL without encoding.
