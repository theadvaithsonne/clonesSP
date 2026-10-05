# `components/coverfi/roles/RolesTable.tsx`

> Client component that lists, creates, edits and deletes Coverfi roles (free-text labels for stakeholders and customer-company employees) through the external Coverfi API.

**Kind:** React component · **Lines:** 241

## Purpose
Coverfi is the insurance-brokerage module of Garage. A "Coverfi role" is only a label (for example "Sales Agent" or "Underwriter") that can be attached to people inside Coverfi; the page header says plainly that these roles grant no Garage permissions. This component is the whole UI of the `/coverfi/roles` page: a table of roles plus a modal dialog for adding or editing one.

## How it works
**`RolesTable` (default export)**
- State: `rows` (the `CoverfiRole[]` list), `loading`, `dialogOpen`, and `editing` (the role being edited, or `null` when adding).
- `refresh()` calls `listRoles()` on mount and after every save or delete. A failure shows a `sonner` error toast with the server message.
- Renders the shared Coverfi `PageHeader` (eyebrow "Coverfi · People", title "Coverfi Roles", user-circle icon) with an "Add role" button. The button clears `editing` and opens the dialog.
- The table has three columns: Name, Description (shows "—" when empty) and an action column with pencil (edit) and trash (delete) icon buttons. While loading it shows a "Loading…" row. With no rows it shows a hint that suggests example labels.
- `onDelete(r)` asks with a native `confirm()` dialog, then calls `deleteRole(r._id)`, shows a toast and refreshes.

**`RoleDialog` (internal, not exported)**
- Props: `open`, `onClose`, `onSaved`, `existing`.
- Keeps a local `{ name, description }` form. An effect keyed on `existing` and `open` resets the form each time the dialog opens: it is prefilled from `existing` when editing and blank when adding.
- `onSave()` requires a non-empty `name` (error toast otherwise). It calls `updateRole(existing._id, data)` or `createRole(data)`, shows "Updated" or "Added", then calls `onSaved()` (which refreshes the parent list) and `onClose()`. A `saving` flag disables the submit button and changes its label to "Saving…".
- Closing through the dialog's overlay or Escape key goes through `onOpenChange` and calls `onClose`.

Styling uses hard-coded dark colours (`#0c0c12`, `#222230`, `#9fa0b8`), in line with the rest of the Coverfi module.

## Exports
- `default RolesTable()` - the roles management screen. It takes no props.

## Interfaces
- **Backend endpoints called** (through `lib/coverfi/roles-api.ts` -> `coverfiApi`, on the external Coverfi service at `NEXT_PUBLIC_COVERFI_API_URL`, default `http://localhost:4100`; these are not routes of this repo's Express server):
  - `GET /v1/coverfi/roles` - list roles
  - `POST /v1/coverfi/roles` - create `{ name, description }`
  - `PATCH /v1/coverfi/roles/:id` - update
  - `DELETE /v1/coverfi/roles/:id` - delete
- **External services:** Coverfi API. `coverfiApi` sends `Authorization: Bearer <token>` using `getToken()` from `lib/auth.ts`, which is the user's Garage session token from localStorage.

## Dependencies
- **Internal:** `components/coverfi/PageHeader.tsx` - page title bar with action slot; `components/ui/button`, `dialog`, `input`, `label`, `table`, `textarea` - shadcn primitives; `lib/coverfi/roles-api.ts` - `listRoles`, `createRole`, `updateRole`, `deleteRole`; `lib/coverfi/types.ts` - `CoverfiRole` type (`_id`, `brokerageId`, `orgId`, `name`, `description?`, timestamps).
- **Packages:** `react` - state and effects; `lucide-react` - icons (`Plus`, `Pencil`, `Trash2`, `UserCircle`); `sonner` - toasts.

## Used by
- `app/(dashboard)/coverfi/roles/page.tsx`, which renders only `<RolesTable />`. Route: `/coverfi/roles`.

## Notes
- The role list is not paginated or searchable. It loads every role the API returns.
- Deletion uses a blocking browser `confirm()` rather than a styled dialog.
- `updateRole` sends the whole form (`name` and `description`), not a diff.
