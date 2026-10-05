# `components/coverfi/products/CategoryFormDialog.tsx`

> Modal form that creates a new Coverfi product category or edits an existing one.

**Kind:** React component · **Lines:** 118

## Purpose
A reusable dialog with two fields, name and description. It is used in two places: the Categories management table, and step 2 of the product wizard, where a user can make a category without leaving the wizard.

## How it works
- **Props:** `open`, `onClose()`, `onSaved(created?)` and an optional `existing` category.
- **Form state:** `{ category_name, category_description }`. An effect keyed on `[existing, open]` resets the form each time the dialog opens: it is filled from `existing` in edit mode and blank in add mode.
- **Save (`onSave`):**
  1. Rejects an empty name with a toast.
  2. In edit mode, calls `updateCategory(existing._id, data)`. Otherwise calls `createCategory(data)`.
  3. Shows a success toast and calls `onSaved` with the category the server returned. `ProductWizard` uses it to auto-select the new category.
  4. Calls `onClose()`. On error it shows a toast and leaves the dialog open.
- Closing through the Radix `onOpenChange` (overlay click, Esc) or the Cancel button calls `onClose`.
- The title and button label switch between "Add" and "Edit"/"Update". The button shows "Saving…" while the request runs.

## Exports
- `default CategoryFormDialog({ open, onClose, onSaved, existing }: Props)`: the dialog. `Props` is a local type and is not exported.

## Interfaces
- **External services:** Coverfi API (`NEXT_PUBLIC_COVERFI_API_URL`) via `coverfiApi`:
  - `POST /v1/coverfi/categories`: create, with body `{ category_name, category_description }`
  - `PATCH /v1/coverfi/categories/:id`: update

## Dependencies
- **Internal:** `lib/coverfi/products-api.ts` (`createCategory`, `updateCategory`); `lib/coverfi/types.ts` (`ProductCategory`); `components/ui/dialog`, `input`, `label`, `textarea`, `button`.
- **Packages:** `react`, `sonner`.

## Used by
- `components/coverfi/products/CategoriesTable.tsx`: add and edit from the Categories tab.
- `components/coverfi/products/ProductWizard.tsx`: the "New category" button in the wizard's Category step.
