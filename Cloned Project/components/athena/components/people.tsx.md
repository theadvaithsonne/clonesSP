# `components/athena/components/people.tsx`

> An older full-page "Manage People" screen for a Taskroom workspace: a paginated member table with search, an invite dialog that searches organisation users, a role editor and member removal.

**Kind:** React component · **Lines:** 949

## Purpose
This was the people-management page for the Taskroom workspace currently selected in `useTaskroomWorkspacetore`, or for the workspace given in the URL when the page is opened from a shared task link. It combines the workspace member store (`useWorkspaceMemberStore`) with direct axios calls to the external Taskroom API and an organisation-user search API. No file imports it any more. The newer `WorkspacePeopleDashboard.tsx` with `members-view.tsx` and `members-table.tsx` appears to have replaced it.

## How it works
**Shared bits (L66-L114)**
- `roles` is a fixed list of Member, Observer and Admin, each with a description.
- `getInitials` returns the first two letters of a name, upper-cased.
- `MemberAvatar` shows the image from `profilePicture`, `image` or `avatar`, falling back to initials.

**Workspace id resolution (L135, L651)**
If the URL has `shareTask`, the workspace id comes from the `workspaceId` search parameter. Otherwise it is `currentWorkspace._id` from the taskroom store.

**`InvitePeopleDialog` (L116-L451)**
1. **Opening:** loads every existing member with `GET {TASKROOM_API_URL}workspace/members/all?workspaceId=...` and builds a set of their lower-cased emails, so people who are already members are hidden from search. Closing the dialog resets all state.
2. **Searching:** typing, debounced by 300ms, calls `GET https://test.garage.app/public/organizations/<garage_org_id>/users?search=<query>`. The org id is read from `localStorage.garage_org_id`. Users who are already selected or already members are filtered out. A dropdown lists the results, and a `mousedown` outside it closes it.
3. **Selecting:** each picked user gets a per-user role dropdown (default Member) and can be removed from the list.
4. **Inviting:** `POST {NEXT_PUBLIC_TASKROOM_URL}workspace/members/bulk` with `{ membersList: [{ memberUserId, email, name, image, role }], workspaceId, orgId }`. On success, each returned row is pushed into the store with `addMemberToState`; the code pairs returned rows with the selected users by array index. Then a success toast is shown and the dialog closes.

**`EditPermissionDialog` (L453-L576)**
- Preselects the member's current role.
- On save it sends `PUT {NEXT_PUBLIC_TASKROOM_URL}workspace/members/:memberId` with `{ role }`, then calls `updateMemberRole` on the store.

**`RemoveMemberDialog` (L578-L646)**
- Calls the store's `removeMember(member._id)`. The store sends `DELETE {TASKROOM}workspace/members/:id`.
- On success it shows a toast and closes.

**`PeoplePage` (default export, L648-L949)**
- `loadMembers(page, search)` calls the store's `fetchMembers(workspaceId, page, search)`. The store requests `GET {TASKROOM}workspace/members?workspaceId&page&size=50&search`.
- It reloads page 1 when the workspace changes.
- Search is debounced by 500ms and resets to page 1.
- The table columns are Name (with an "Owner" badge when `role === "owner"` or `isOwner`), Email, Role, Invited on (`invitedOn` or `createdAt`), Status (green when `active`) and a row menu with "Edit Permissions" and "Remove from Workspace".
- An "Invite people" row and button open the invite dialog.
- Previous/Next pagination appears when `metadata.totalPages > 1`.

## Exports
- `default PeoplePage()` - the page component. It takes no props.

## Interfaces
- **External services:**
  - Taskroom API (`NEXT_PUBLIC_TASKROOM_URL`, default `https://uatapi.garage.app/taskroomv2/v2/`): `workspace/members/all`, `workspace/members/bulk`, `workspace/members/:id` (PUT), plus the store's list and delete calls.
  - Organisation user search: `https://test.garage.app/public/organizations/:orgId/users` (hard-coded host).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base.
- **Browser storage / cookies:** `localStorage.garage_tok` (Bearer token) and `localStorage.garage_org_id` (organisation id).

## Dependencies
- **Internal:**
  - `store/taskroom/taskroomWorkspace.tsx` - `currentWorkspace`;
  - `store/taskroom/workspaceMemberStore.ts` - `members`, `metadata`, `isLoading`, `fetchMembers`, `addMemberToState`, `updateMemberRole` and `removeMember`;
  - `store/taskroom/spaceStore.ts` - imported but unused;
  - `components/ui/avatar.tsx`, `badge.tsx`, `button.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `table.tsx`;
  - `lib/utils.ts` - `cn`.
- **Packages:** `react`; `next/navigation` - `useSearchParams` (`useParams` is imported but unused); `axios`; `sonner`; `lucide-react`; `js-cookie` (imported, unused).

## Used by
Nothing imports it, so it appears unused. No route file renders it.

## Notes
- **Mixed base URLs:** existing members are read through `TASKROOM_API_URL`, which has a UAT fallback, but the bulk-invite and role-update calls use `process.env.NEXT_PUBLIC_TASKROOM_URL` directly. If that variable is unset, those requests go to a URL starting with `undefined`.
- The user search goes to `test.garage.app` regardless of environment, and interpolates the query without URL-encoding it.
- Invite results are matched to selected users by array position, which assumes the server returns rows in the same order.
- `Input` and many icons are imported but unused. The header breadcrumb is commented out.
