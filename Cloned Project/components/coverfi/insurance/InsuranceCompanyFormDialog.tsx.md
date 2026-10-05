# `components/coverfi/insurance/InsuranceCompanyFormDialog.tsx`

> Modal form for creating or editing a Coverfi insurance company: name, description, website, country, product types, logo and icon.

**Kind:** React component · **Lines:** 280

## Purpose
This is the add/edit dialog for the Coverfi "Insurance Companies" catalog. The parent table (`InsuranceCompaniesTable`) controls whether it is open and passes the row to edit. The dialog validates the input, saves it to the external Coverfi API, and then tells the parent to reload.

## How it works
- **Form state:** `data` holds the fields from the `empty` template (`name`, `description`, `website`, `country`, `product_type: string[]`, `logo`, `icon`). It also tracks `productDraft` (the custom product-type text input) and `saving`.
- **Reset on open:** an effect that runs when `existing` or `open` changes fills `data` from `existing`, using `""` or `[]` for missing optional fields. When there is no `existing` row, it resets `data` to `empty`. Either way it clears `productDraft`. Reopening the dialog for "add" therefore always starts with a blank form.
- **Country picker:** `Country.getAllCountries()` from `country-state-city` (memoised) fills a shadcn `Select`. Each item's value is the country's **ISO code** (`c.isoCode`), so that code is what gets saved, while the visible label is the country name.
- **Product types:**
  - `COMMON_PRODUCT_TYPES` (`Health`, `Life`, `Motor`, `Travel`, `Home`, `Business`) appear as clickable outline badges. A badge disappears once its type is added.
  - Custom types can be typed in the input and added with Enter (the default action is prevented so the form is not submitted) or with the "+" button.
  - `addProductType` trims the value and ignores empty strings and duplicates. `removeProductType(idx)` removes a type by its index.
  - Selected types show as solid badges, each with an X button.
- **Images:** two `ImageUpload` widgets, Logo and Icon. Each uploads the picked file through Garage's `/upload` endpoint and stores the returned URL in `data.logo` / `data.icon`. "Clear" sets the field to `""`.
- **Save (`onSave`):** `name` is required (error toast otherwise). With `existing`, it calls `updateInsuranceCompany(existing._id, data)`. Otherwise it calls `createInsuranceCompany(data)`. On success it shows a toast, calls `onSaved()` and then `onClose()`. On failure it shows the error message in a toast. The button reads "Saving…" while the request is in flight.
- **Close:** the dialog's `onOpenChange` calls `onClose` when it closes (overlay click or Escape), and so does the Cancel button.
- **`Field`:** a local, unexported helper that renders a small label (with a red `*` when `required`) above its children.

## Exports
- `default InsuranceCompanyFormDialog({ open, onClose, onSaved, existing? })` - `open: boolean` controls visibility. `onClose()` hides the dialog. `onSaved()` is called after a successful create or update. `existing?: InsuranceCompany | null` is the row to edit, or null/undefined for add mode.

## Interfaces
- **External services:** the Coverfi API (`NEXT_PUBLIC_COVERFI_API_URL`, default `http://localhost:4100`), called through `lib/coverfi/insurance-api.ts`. It is not part of this repo.
  - `POST /v1/coverfi/insurance/create` - create a company
  - `PATCH /v1/coverfi/insurance/update/:id` - update a company
- **Backend endpoints called (indirectly, via `ImageUpload` -> `lib/coverfi/uploadFile.ts`):** `POST /backend/upload` - multipart image upload that returns `{ url }`.

## Dependencies
- **Internal:**
  - `components/coverfi/brokerage/ImageUpload.tsx` - the logo and icon uploaders
  - `components/ui/dialog.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx`, `select.tsx`, `button.tsx`, `badge.tsx` - shadcn primitives
  - `lib/coverfi/insurance-api.ts` - `createInsuranceCompany`, `updateInsuranceCompany`
  - `lib/coverfi/types.ts` - the `InsuranceCompany` type
- **Packages:** `country-state-city` (the country list), `react`, `lucide-react` (Plus and X icons), `sonner` (toasts)

## Used by
- `components/coverfi/insurance/InsuranceCompaniesTable.tsx` (the only importer), on the page `/coverfi/insurance-companies`.

## Notes
- The whole `data` object, including empty strings, is sent on update. The form does not compute a diff.
- Website is free text with no URL validation or normalisation.
- Product-type badges in the selected list use the array index as their React key. This is fine here because duplicates are rejected.
