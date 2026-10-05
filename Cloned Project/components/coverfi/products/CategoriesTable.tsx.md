# `components/coverfi/products/CategoriesTable.tsx`

> Table of Coverfi product categories with add, edit and delete actions, backed by the external Coverfi API.

**Kind:** React component · **Lines:** 141

## Purpose
Coverfi products are grouped under categories such as Health, Life or Motor. This component is the content of the "Categories" tab in the Coverfi Products section (`/coverfi/products/categories`). It lists every category for the brokerage and opens `CategoryFormDialog` to create or edit one.

## How it works
- **State:** `rows` (`ProductCategory[]`), `loading`, `open` (dialog visibility) and `editing` (the category being edited, or `null` when adding).
- **Load:** `refresh()` runs on mount and calls `listCategories()`. Failures show a `sonner` toast.
- **Add:** the "Add category" button sets `editing = null` and opens the dialog.
- **Edit:** the pencil button sets `editing` to that row and opens the dialog.
- **Delete:** the trash button asks for `confirm()`, then calls `deleteCategory(row._id)` and refreshes the list.
- **After a save** the dialog's `onSaved` calls `refresh()`. The dialog closes itself.
- **Rendering:** the table shows Name and Description (`—` when there is no description), plus loading and empty-state rows.

## Exports
- `default CategoriesTable()`: the categories list and its management controls. It takes no props.

## Interfaces
- **External services:** Coverfi API (`NEXT_PUBLIC_COVERFI_API_URL`, default `http://localhost:4100`) via `coverfiApi`. It is not part of this repo.
  - `GET /v1/coverfi/categories`: list categories
  - `DELETE /v1/coverfi/categories/:id`: delete a category
  - Create and update calls (`POST` / `PATCH /v1/coverfi/categories[/:id]`) are made by `CategoryFormDialog`.

## Dependencies
- **Internal:** `components/coverfi/products/CategoryFormDialog.tsx` (add/edit modal); `lib/coverfi/products-api.ts` (`listCategories`, `deleteCategory`); `lib/coverfi/types.ts` (`ProductCategory`); `components/ui/button`, `table`.
- **Packages:** `react`, `lucide-react` (Plus/Pencil/Trash2 icons), `sonner`.

## Used by
- `app/(dashboard)/coverfi/products/categories/page.tsx`, which serves the URL `/coverfi/products/categories`, inside the Products layout with `ProductsTabs`.

## Notes
- The UI does not check whether products still use a category before deleting it. Any such check is up to the Coverfi API.
