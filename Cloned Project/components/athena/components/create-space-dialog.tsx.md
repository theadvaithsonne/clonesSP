# `components/athena/components/create-space-dialog.tsx`

> Taskroom dialog for creating or editing a space (a team or department container for rooms), including an optional uploaded icon and a privacy toggle.

**Kind:** React component · **Lines:** 709

## Purpose
In the Taskroom / Athena module, a workspace contains spaces and each space contains rooms. `CreateSpaceDialog` is the form for creating a new space in the current workspace or editing an existing one. It is opened from the Taskroom sidebars and the workspace view. The file also defines a small internal `AllMembersDialog` that lists a space's members.

## How it works
- **Workspace context.** If a `shareTask` query param is present, the workspace id comes from the `workspaceId` query param. Otherwise it comes from `useTaskroomWorkspacetore().currentWorkspace._id`. When the dialog opens with a workspace id, it calls `fetchMembers(workspaceId)` from `useWorkspaceMemberStore`.
- **Pre-fill on open (L203-L260).**
  - When `space` is passed (edit), the form is filled from its fields. `getBooleanValue` copes with an `isPrivate` value that may be a boolean or an object. `getIconUrl` accepts `image` as a string or as an object with `url`, `value` or `path`. The icon preview is shown only if it is an `http(s)` URL, because a non-URL value such as `"Layout"` is a lucide icon name.
  - Edit mode also fetches the current members with `GET ${NEXT_PUBLIC_TASKROOM_URL}space/members?spaceId=…` and maps them into `selectedUsers`.
  - When no `space` is passed (create), the form is reset.
- **Icon upload.** Images only. The file is previewed through `FileReader`. On save it is uploaded as multipart (`files`, `folder=space-icons`) to `https://uatapi.garage.app/api/s3upload/multiple` with the `garage_tok` bearer token, and the first returned URL is used.
- **Save (`handleCreate`, L262-L308).** Builds this payload:
  - `name`, `description`
  - `color` (default `#6366f1`, with no picker in the UI)
  - `image`: the uploaded URL, else the existing image, else `"Layout"`
  - `spaceCode`: the first 3 letters of the name, upper-cased
  - `isPrivate`, `workspaceId`
  - `setDefault: false`
  - `members: selectedUsers`

  It calls `updateSpace(space._id, payload)` when editing or `createSpace(payload)` when creating, both from `useSpaceStore`. On success it closes the dialog and, after a create, clears the form.
- **Member management.** `handleAddUser`, `handleUpdateRole` and `handleRemoveUser` manage `selectedUsers`. When editing, `handleRemoveUser` first sends `DELETE ${NEXT_PUBLIC_TASKROOM_URL}space/members/:memberRecordId` and stops if that call fails. The member picker popover and the role list that would call these helpers are commented out (L441-L620), so in practice none of them can be reached from the UI.
- **Rendered UI.** The dialog shows the title ("Create a Space" / "Edit Space"), the icon button and name input, the description, a "Make Private" switch, and a footer button ("Continue" / "Apply changes") that is disabled while `isCreating` is true or the name is empty.
- **`AllMembersDialog` (L653-L708).** A read-only list of members with avatar, name, email and role. It is controlled by `showAllMembers`, but the only button that opened it is inside the commented-out block.

## Exports
- `CreateSpaceDialog({ open, onOpenChange, space? })`: creates a space when `space` is absent and edits that space when it is given.

## Interfaces
- **External services:**
  - Taskroom API at `NEXT_PUBLIC_TASKROOM_URL`. This file calls `GET space/members` and `DELETE space/members/:id` directly. The stores call `POST spaces`, `PUT spaces/:id` and `GET workspace/members`.
  - S3 upload at `https://uatapi.garage.app/api/s3upload/multiple`.

  Neither service is part of this repo.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL`.
- **Browser storage / cookies:** `localStorage.garage_tok` (bearer token). The `TaskRoomUserDetails` cookie is parsed into `UserId`, which only the commented-out member filter used.

## Dependencies
- **Internal:**
  - `store/taskroom/spaceStore.ts`: `createSpace`, `updateSpace`, `isCreating`.
  - `store/taskroom/taskroomWorkspace.tsx`: the current workspace.
  - `store/taskroom/workspaceMemberStore.ts`: workspace member list.
  - `components/ui/*` (`avatar`, `button`, `command`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `switch`, `textarea`).
  - `lib/utils.ts`: `cn`.
- **Packages:** `axios`, `js-cookie`, `sonner`, `lucide-react` (many icons imported but unused), `next/navigation`, `react`.

## Used by
- `components/athena/components/workspacesidebar.tsx`
- `components/dashboard/TaskroomWorkspace.tsx`
- `components/dashboard/taskroomSiderBar.tsx`

## Notes
- The file contains leftover debug `console.log` calls with garbled labels (L175, L202, L232) that log selected users and the space object on every render.
- The S3 host is hardcoded to the UAT API.
- Much of the member-sharing UI is commented out, so the `members` field always sends whatever the edit fetch loaded, or `[]` on create.
