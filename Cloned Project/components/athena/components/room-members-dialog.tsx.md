# `components/athena/components/room-members-dialog.tsx`

> Manages the members of one Taskroom room: lists existing room members (with role changes and removal) and lets managers add people from the parent space, one at a time, in bulk, or all at once. It can be shown as a dialog or embedded inline.

**Kind:** React component · **Lines:** 688

## Purpose
Rooms sit inside spaces, and only people who already belong to the space can be added to one of its rooms. This component is the UI for that. It has two tabs:
- **"Existing Members"** - everyone in the room.
- **"Available Members"** - space members who are not yet in the room. Only managers see this tab.

It is opened as a dialog from the Taskroom sidebars, and is embedded inside the People dashboard tab (`embedded` prop). All calls go straight to the external Taskroom API with axios; no store is involved.

## How it works
**Configuration (L31-L75)**
- `BASE_URL` is `NEXT_PUBLIC_TASKROOM_URL` (default `https://uatapi.garage.app/taskroomv2/v2/`) with trailing slashes removed.
- `ROLES` are member, admin and observer.
- Page sizes: 20 for the room list, 10 for the space list.
- `hasMorePages(meta, page, rowCount, pageSize)` decides whether more pages exist:
  - first it checks `meta.nextPage`;
  - then `currentPage < totalPages`;
  - then `page < totalPages`;
  - and if there is no metadata, it assumes more pages when a full page came back.
- `canManageMembers(detail)` returns true when `role` is admin or owner, or `isOwner` is set.

**Permissions (L150-L160)**
- `canManage` is the `canManage` prop if one is given. Otherwise it is computed from `room.MemberDetail`, or from `room` itself when the room object carries `role` or `isOwner`.
- Non-managers are forced back to the room tab and see a read-only table with no actions column.

**Fetching with de-duplication (L162-L239)**
`runFetch(kind, page, append, q)` builds a key from `kind:roomId:spaceId:page:q`. A non-append request is skipped when the same key is already in flight. In-flight keys are tracked in a module-level `globalInFlightFetches` Set (shared by every instance) and in a per-instance ref. This stops React StrictMode double effects, or two mounted copies, from firing duplicate requests.
- **Room:** `GET {BASE}/room/members?roomId&page&size=20[&search]` returns rows from `data.data.data`. The user's avatar is normalised from several possible fields.
- **Space:** `GET {BASE}/room/members/unadded?spaceId&roomId&page&size=10[&search]` returns rows from `data.data`, reshaped into `{ userData: { _id, name, email, avatar } }`.
- Appended pages are de-duplicated by `_id`. On error, a non-append fetch empties its list.

**Initialisation (L241-L272)**
- The component is "active" when `open` or `embedded` is true.
- Whenever it becomes active, or the `roomId:spaceId` pair changes, it resets tabs, selection and pages, then loads page 1 of both lists.
- Switching tabs clears the selection and reloads that tab's page 1.

**Infinite scroll (L274-L305)**
- Each tab has an IntersectionObserver on a sentinel table row, with the table's scroll container as root and a 120px bottom margin. When the sentinel comes into view, it increments that tab's page and fetches with append.

**Actions (L307-L373)**
- `bulkAdd(ids?)` sends `POST {BASE}/room/members/bulk` with `{ spaceId, roomId, membersList: [{ userId, role: addRole.id }] }`. It is used for "Add N selected" and for the per-row quick-add button.
- `addAll()` sends `POST {BASE}/room/members/unadded` with `{ spaceId, roomId, defaultRole: "member" }`, after the local `ConfirmDialog`.
- `updateRole(memberId, role)` sends `PUT {BASE}/room/members/:memberId` with `{ role }`, then reloads room page 1.
- Remove: `requestRemoveMember` opens the shared `RemoveMemberConfirmDialog` (`scope="room"`). `confirmRemoveMember` then sends `DELETE {BASE}/room/members/:id`.
- After a successful add or remove, `refresh()` reloads both lists from page 1.
- Every call sends `Authorization: Bearer <localStorage.garage_tok>`. Errors are shown as a toast with the server's `message`.
- Selection is a `Set` of user ids. `toggleAll` selects or clears every loaded space member.

**Layout (L375-L578)**
- `panelContent` holds:
  - the room name (dialog mode only);
  - the `PeopleSubTabs` tab switcher;
  - for the space tab, the role selector for new members and the "Add N selected" / "Add all" control;
  - a `MembersTable` with skeleton rows, an empty state, `RoomRow` or `SpaceRow` rows, a sentinel and a load-more spinner;
  - a footer count, plus a Close button in dialog mode.
- In dialog mode it is wrapped in `Dialog` at 80vw × 80dvh.
- Room role colours: admin violet, observer amber, member blue.

**Sub-components (L580-L688)**
`Checkbox`, `RoomMemberActions` (dropdown with the role options and Remove), `RoomRow`, `SpaceRow` (the whole row toggles selection; the quick-add button stops propagation), `Empty` and `ConfirmDialog` (L78-L117). All are internal.

## Exports
- `RoomMembersDialog({ open, onOpenChange, room, spaceId, embedded?, canManage? })` - the room member manager. `room` must have `_id`, and may carry `name`, `MemberDetail`, `role` and `isOwner`.

## Interfaces
- **External services (Taskroom API at `NEXT_PUBLIC_TASKROOM_URL`, not part of this repo):**
  - `GET room/members`
  - `GET room/members/unadded`
  - `POST room/members/bulk`
  - `POST room/members/unadded`
  - `PUT room/members/:id`
  - `DELETE room/members/:id`
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base. Defaults to the UAT host.
- **Browser storage / cookies:** `localStorage.garage_tok` - Bearer token.

## Dependencies
- **Internal:** `components/athena/components/members-table.tsx` - table shell, row and cell components, skeleton rows, action trigger and quick-add button; `components/athena/components/members-view.tsx` - `PeopleSubTabs`; `components/athena/components/remove-member-confirm-dialog.tsx` - removal confirmation; `components/ui/dialog.tsx`, `components/ui/button.tsx`, `components/ui/dropdown-menu.tsx`; `lib/utils.ts` - `cn`.
- **Packages:** `react`; `axios` - HTTP; `sonner` - toasts; `lucide-react` - icons.

## Used by
- `components/athena/components/WorkspacePeopleDashboard.tsx` (embedded)
- `components/athena/components/workspacesidebar.tsx`
- `components/dashboard/taskroomSiderBar.tsx`

## Notes
- The search parameter `q` is supported by `runFetch`, but this UI never passes one: there is no search box.
- `DialogHeader` and `DialogTitle` are imported but unused. Without a `DialogTitle`, Radix may log an accessibility warning.
- The space tab requires a `spaceId`. Without one, the "Available" fetch is skipped.
