# `components/coverfi/office-locations/OfficeLocationsTable.tsx`

> Client component that lists Coverfi office locations and handles create, edit and delete through an inline dialog.

**Kind:** React component · **Lines:** 292

## Purpose
This is the whole UI of the Coverfi "Office Locations" settings page. These locations belong to Coverfi only, and the page header says they are separate from the brokerage locations on the My Brokerage page. Unlike the insurance-companies page, the add/edit form is built into this same component instead of a separate dialog file.

## How it works
- **State:** `rows` (`OfficeLocation[]`), `loading`, `open` (dialog), `editing` (the row being edited, or `null`), `data` (the form fields) and `saving`.
- **Form template (`empty`):** `location_name`, `full_address`, `city`, `state`, `country`, `pincode`. All are strings while being edited.
- **Loading:** `refresh()` calls `listOfficeLocations()` on mount and after each save or delete. Errors show a toast ("Failed to load" by default).
- **Add / edit:**
  - `openAdd()` clears `editing`, resets `data` and opens the dialog.
  - `openEdit(r)` copies the row into `data`. The numeric `pincode` is converted to a string, and missing optional fields become `""`.
- **Save (`onSave`):**
  - `location_name` is required.
  - Builds a payload in which every empty optional field becomes `undefined`, so `JSON.stringify` leaves it out of the body.
  - `pincode` is converted back to a `Number`.
  - Calls `updateOfficeLocation(editing._id, payload)` or `createOfficeLocation(payload)`, then shows a "Saved" toast, closes the dialog and refreshes.
- **Pincode input:** removes any non-digit and caps the value at 6 characters (Indian PIN code format).
- **Delete (`onDelete`):** confirms with the native `confirm()`, calls `deleteOfficeLocation(r._id)` and refreshes. Unlike the insurance table, it shows no success toast.
- **Table:** columns are Name, Address (truncated), City, State, Pincode, and edit/delete icon buttons. It shows "Loading…" while fetching and "No office locations yet." when empty. Country can be edited in the dialog but has no table column.
- **`Field`:** a local, unexported label wrapper with a red `*` for required fields. It is the same helper as in `InsuranceCompanyFormDialog.tsx`, duplicated.

## Exports
- `default OfficeLocationsTable()` - the page body. Takes no props.

## Interfaces
- **External services:** the Coverfi API (`NEXT_PUBLIC_COVERFI_API_URL`, default `http://localhost:4100`), called through `lib/coverfi/office-locations-api.ts` with a bearer token from `getToken()`. It is not part of this repo's Express server.
  - `GET /v1/coverfi/locations/list` - list locations
  - `POST /v1/coverfi/locations/create` - create a location
  - `PATCH /v1/coverfi/locations/:id` - update a location
  - `DELETE /v1/coverfi/locations/:id` - delete a location

## Dependencies
- **Internal:**
  - `components/coverfi/PageHeader.tsx` - the header (eyebrow "Coverfi · Settings", map-pin icon, "Add location" action)
  - `components/ui/dialog.tsx`, `button.tsx`, `input.tsx`, `label.tsx`, `table.tsx` - shadcn primitives
  - `lib/coverfi/office-locations-api.ts` - the four CRUD helpers
  - `lib/coverfi/types.ts` - the `OfficeLocation` type (`pincode?: number`)
- **Packages:** `react`, `lucide-react` (icons), `sonner` (toasts)

## Used by
- `app/(dashboard)/coverfi/office-locations/page.tsx`, which renders it at the URL `/coverfi/office-locations`.

## Notes
- On update, a field the user cleared is sent as `undefined` and so left out of the PATCH body. Clearing an optional field in the form may therefore leave the old value on the server, depending on how the Coverfi API handles a missing key.
- The 6-digit pincode limit assumes Indian addresses, even though a free-text country field exists.
