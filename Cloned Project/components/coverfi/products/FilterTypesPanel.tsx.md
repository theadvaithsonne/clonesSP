# `components/coverfi/products/FilterTypesPanel.tsx`

> Two-pane manager for Coverfi product filter types (for example "Age Group") and their items (for example "18-25"), with an inline dialog for creating and editing filter types.

**Kind:** React component · **Lines:** 355

## Purpose
Coverfi products can be tagged with filter types, and each filter type holds a list of items that customers see when browsing. This component is the "Filters" tab of the Products section (`/coverfi/products/filters`). Filter types are listed on the left; the items of the selected type can be added and removed on the right. The filter types chosen here are later attached to products in step 3 of `ProductWizard`.

## How it works

### Main component `FilterTypesPanel` (L29-L257)
- **State:** `types`, `items` (for the selected type only), `selectedTypeId`, `loading`, `typeDialogOpen`, `editingType` and `itemDraft` (text of the new item).
- **`refreshTypes()`** calls `listFilterTypes()`. If there are types and none is selected yet, it auto-selects the first. If there are none, it clears the selection and the items. On mount it runs inside a loading wrapper, and errors show a toast.
- **`refreshItems(typeId)`** calls `listFilterItemsForType(typeId)`. An effect on `selectedTypeId` reloads items when the selection changes, or clears them when nothing is selected. Errors here only go to `console.error`, not to a toast.
- **Delete type (`onDeleteType`):** the `confirm()` prompt warns that the type's items "will also be deleted". It then calls `deleteFilterType`, clears the selection if the deleted type was selected, and refreshes. The cascade is promised in the UI but carried out by the Coverfi API.
- **Add item (`onAddItem`):** the draft is trimmed and ignored if empty. Then `createFilterItem({ filter_type_id, filter_item_name })` is called, the draft is cleared and the items reload. The Enter key and the Plus button both add.
- **Remove item (`onRemoveItem`):** calls `deleteFilterItem(it._id)` with **no confirmation**, then reloads the items.
- **Layout:** a 12-column grid. On the left (4 columns) is the clickable list of types with edit and delete buttons; these use `stopPropagation` so a click on them does not also select the row. On the right (8 columns) is the item editor, or a hint to pick a type first.

### Inner `FilterTypeDialog` (L259-L354)
This is not exported. It mirrors `CategoryFormDialog`: form state `{ filter_type_name, filter_type_description }` is reset whenever `existing` or `open` changes. Saving requires a name, then calls `updateFilterType(existing._id, data)` or `createFilterType(data)`, shows a toast, and calls `onSaved()` (which runs `refreshTypes`) and `onClose()`.

## Exports
- `default FilterTypesPanel()`: the filters management screen. It takes no props.

## Interfaces
- **External services:** Coverfi API (`NEXT_PUBLIC_COVERFI_API_URL`, default `http://localhost:4100`) via `coverfiApi` in `lib/coverfi/api.ts`. It is not part of this repo.
  - `GET /v1/coverfi/filter/types`: list filter types
  - `GET /v1/coverfi/filter/types/:id/items`: list the items of one type
  - `POST /v1/coverfi/filter/types`: create a type
  - `PATCH /v1/coverfi/filter/types/:id`: update a type
  - `DELETE /v1/coverfi/filter/types/:id`: delete a type
  - `POST /v1/coverfi/filter/items`: create an item
  - `DELETE /v1/coverfi/filter/items/:id`: delete an item

## Dependencies
- **Internal:** `lib/coverfi/products-api.ts` (filter CRUD helpers); `lib/coverfi/types.ts` (`FilterType`, `FilterItem`); `lib/utils.ts` (`cn`); `components/ui/button`, `input`, `label`, `dialog`, `textarea`.
- **Packages:** `react`, `lucide-react` (Plus/Pencil/Trash2/X), `sonner`.

## Used by
- `app/(dashboard)/coverfi/products/filters/page.tsx`, which serves the URL `/coverfi/products/filters`, inside the Products layout with `ProductsTabs`.

## Notes
- `updateFilterItem` exists in `products-api.ts` but is not used here. Items can only be added or removed, not renamed.
- `refreshTypes` reads `selectedTypeId` from the closure of the first render, which is why the mount effect has its exhaustive-deps lint rule switched off.
- The page does not stop you from deleting a filter type that products still reference.
