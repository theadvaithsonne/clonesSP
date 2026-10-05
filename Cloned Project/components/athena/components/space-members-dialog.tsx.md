# `components/athena/components/space-members-dialog.tsx`

> Dialog (or embedded panel) that lists the members of a Taskroom "space" and lets admins add workspace members to it, change their roles or remove them, all against the external Taskroom API.

**Kind:** React component · **Lines:** 680

## Purpose
Taskroom/Athena organises work as Workspace -> Space -> Room. This component manages the membership of one space. It has two tabs: **Existing Members** (people already in the space) and **Available Members** (workspace members not yet added; only shown to managers). It is used both as a modal from the workspace sidebars and, with `embedded`, inline inside the People dashboard. All data lives in the external Taskroom service (`NEXT_PUBLIC_TASKROOM_URL`, default `https://uatapi.garage.app/taskroomv2/v2/`), not in this repo's backend.

## How it works

### Permissions (L44-L48, L153-L162)
`canManageMembers()` returns true when the caller's role is `admin` or `owner`, or `isOwner` is set. The component uses the `canManage` prop if given, otherwise derives it from `space.MemberDetail` (or from `space.role` / `space.isOwner`). Without manage rights the Available tab is hidden, the role/remove action column is dropped, and an effect forces the tab back to `space`.

### Roles (L50-L55)
Four roles: `member`, `admin`, `observer`, `commenter`, each with a short description. The role chosen in the header dropdown (`addRole`, default `member`) is applied to every bulk add. `roleBadgeClass` colours the role cell per role.

### Fetching and pagination (L164-L241)
`runFetch(kind, page, append, q)` serves both tabs:
- `space` -> `GET {TASKROOM}/space/members?spaceId&page&size=20[&search]`; rows read from `data.data.data`.
- `workspace` -> `GET {TASKROOM}/space/members/unadded?spaceId&workspaceId&page&size=10[&search]`; rows read from `data.data` and reshaped into a `userData` object.
Avatars are normalised from `userData.avatar`, `userData.image`, `image` or `avatar`. Appended pages are de-duplicated by `_id`. `hasMorePages()` decides whether more pages exist from `metadata.nextPage`, `totalPages`/`currentPage`, or (as a fallback) whether a full page came back.

Duplicate requests are suppressed with a fetch key (`kind:spaceId:workspaceId:page:q`) stored in both a module-level `globalInFlightFetches` set (shared across all mounted instances) and a per-instance ref. This matters because several sidebars can mount the dialog for the same space. The `q` (search) parameter is supported by `runFetch` but nothing in this file passes a search string.

### Lifecycle (L243-L274)
When the panel becomes active (`open || embedded`) or the space/workspace pair changes, it resets to the Space tab, clears selections and lists, and fetches page 1 of both lists. Switching tabs clears the selection and refetches page 1 of that tab.

### Infinite scroll (L276-L295)
Each list ends with a sentinel `<div>` inside a table row. An `IntersectionObserver` (threshold 0.1) loads the next page when the sentinel is visible and more pages exist.

### Actions (L297-L366)
- `bulkAdd(ids?)` -> `POST {TASKROOM}/space/members/bulk` with `{ spaceId, workspaceId, membersList: [{ userId, role }] }`. Used for "Add N selected" and for the per-row quick-add button.
- `addAll()` -> `POST {TASKROOM}/space/members/unadded` with `{ spaceId, workspaceId, defaultRole: "member" }`, after the local `ConfirmDialog`.
- `updateRole(memberId, role)` -> `PUT {TASKROOM}/space/members/{memberId}` with `{ role }`, then refetches page 1 of the space list.
- Remove: `requestRemoveMember` stores the target, `RemoveMemberConfirmDialog` asks for confirmation, then `confirmRemoveMember` -> `DELETE {TASKROOM}/space/members/{id}`.
Every call sends `Authorization: Bearer <localStorage.garage_tok>`. Success and failure are reported with `sonner` toasts (the server `message` is shown on errors). After adds and removes, `refresh()` reloads both lists from page 1.

Selection is a `Set` of user ids (`userData._id || _id`). Clicking a workspace row toggles it. `toggleAll` exists but is never wired to the UI.

### Rendering (L368-L571)
`panelContent` holds the header (space name when not embedded, `PeopleSubTabs`, role dropdown and add buttons), the list (shared `MembersTable` with skeleton rows, empty states or rows), and a footer showing a member/selected/available count plus a Close button (modal only). Not embedded, it is wrapped in a `Dialog` sized 80vw x 80dvh. `ConfirmDialog` and `RemoveMemberConfirmDialog` are always rendered next to it.

### Private sub-components (L573-L679)
`ConfirmDialog` (add-all confirmation), `Checkbox`, `SpaceMemberActions` (role list plus Remove in a dropdown), `SpaceRow`, `WorkspaceRow` (selectable row with quick add), `Empty`.

## Exports
- `SpaceMembersDialog({ open, onOpenChange, space, workspaceId, embedded?, canManage? })` - the members manager. `space` must have `_id` (and ideally `name`, `MemberDetail`). `embedded` renders without the dialog shell.

## Interfaces
- **Backend endpoints called (external Taskroom service, `NEXT_PUBLIC_TASKROOM_URL`):**
  - `GET /space/members` - list space members
  - `GET /space/members/unadded` - list workspace members not in the space
  - `POST /space/members/bulk` - add selected users with a role
  - `POST /space/members/unadded` - add all unadded users as `member`
  - `PUT /space/members/{memberId}` - change role
  - `DELETE /space/members/{memberId}` - remove from space
- **External services:** Taskroom v2 API (default `https://uatapi.garage.app/taskroomv2/v2/`).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base; trailing slashes are stripped.
- **Browser storage / cookies:** reads the `garage_tok` JWT from `localStorage`.

## Dependencies
- **Internal:** `components/athena/components/members-table.tsx` - shared table, rows, cells, skeletons and action buttons; `components/athena/components/members-view.tsx` - `PeopleSubTabs`; `components/athena/components/remove-member-confirm-dialog.tsx` - remove confirmation; `components/ui/dialog.tsx`, `components/ui/button.tsx`, `components/ui/dropdown-menu.tsx` - shadcn primitives; `lib/utils.ts` - `cn`.
- **Packages:** `axios` - HTTP; `lucide-react` - icons; `react` - state/effects; `sonner` - toasts.

## Used by
`components/athena/components/WorkspacePeopleDashboard.tsx` (embedded mode), `components/athena/components/workspacesidebar.tsx` and `components/dashboard/taskroomSiderBar.tsx` (modal mode).

## Notes
- `DialogHeader` and `DialogTitle` are imported but unused, so the modal has no accessible title.
- Roles are enforced only in the UI; the Taskroom API must do the real authorisation.
- `globalInFlightFetches` is module state: a stuck request blocks the same key for every instance until it settles.
