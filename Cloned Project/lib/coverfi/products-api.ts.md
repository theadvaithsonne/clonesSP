# `lib/coverfi/products-api.ts`

> Client functions for the Coverfi product catalogue: product categories, filter types and their items, and insurance products built through a five-step wizard. Served by the external Coverfi backend.

**Kind:** frontend library · **Lines:** 139

## Purpose
Insurance products are what companies and corporates enrol in. Each product belongs to a category, is tagged with filter items (for example coverage tiers or plan attributes, grouped under filter types), names an insurer and carries billing and waiver terms. This module is the data layer for the categories table, the filter-types panel, the product wizard and the products list, and the company and corporate screens use it to list available products. All calls go through `coverfiApi`.

## How it works
Every function unwraps `ApiResult.data` except the deletes, which return the raw `ApiResult<null>`.

**Categories** (`/v1/coverfi/categories`)
- `listCategories()` - `GET`.
- `createCategory({ category_name, category_description? })` - `POST`.
- `updateCategory(id, body)` - `PATCH /:id`.
- `deleteCategory(id)` - `DELETE /:id`.

**Filter types and items** (`/v1/coverfi/filter`)
- `listFilterTypes()` - `GET /types`.
- `listFilterItemsForType(filterTypeId)` - `GET /types/:filterTypeId/items`.
- `createFilterType({ filter_type_name, filter_type_description? })` - `POST /types`.
- `updateFilterType(id, body)` and `deleteFilterType(id)` - `PATCH` and `DELETE /types/:id`.
- `createFilterItem({ filter_type_id, filter_item_name, filter_item_description? })` - `POST /items`.
- `updateFilterItem(id, body)` and `deleteFilterItem(id)` - `PATCH` and `DELETE /items/:id`.

**Products** (`/v1/coverfi/products`)
- `listProducts()` - `GET`.
- `getProduct(id)` - `GET /:id`.
- The wizard, where each step advances `Product.step_completed`:
  1. `createDraftProduct()` - `POST /create/step1` with body `{}`. Creates an empty draft and returns its `_id`.
  2. `stepCategory(id, category)` - `POST /create/step2/:id` with `{ category }`.
  3. `stepFilters(id, filters)` - `POST /create/step3/:id` with `{ filters }` (a list of filter item ids).
  4. `stepInfo(id, { name, insurance_provider, description?, type?, logo?, product_document? })` - `POST /create/step4/:id`. `logo` and `product_document` are URLs, typically from `uploadFile`.
  5. `stepBilling(id, Partial<Product>)` - `POST /create/step5/:id`. Sets billing type, payment frequency, waiver type, text and terms, coverage type, and coverage.
- `deleteProduct(id)` - `DELETE /:id`.

## Exports
`listCategories`, `createCategory`, `updateCategory`, `deleteCategory`, `listFilterTypes`, `listFilterItemsForType`, `createFilterType`, `updateFilterType`, `deleteFilterType`, `createFilterItem`, `updateFilterItem`, `deleteFilterItem`, `listProducts`, `getProduct`, `createDraftProduct`, `stepCategory`, `stepFilters`, `stepInfo`, `stepBilling`, `deleteProduct`.

## Interfaces
- **External services:** the Coverfi backend at `NEXT_PUBLIC_COVERFI_API_URL`.

## Dependencies
- **Internal:** `lib/coverfi/api.ts` - `coverfiApi`; `lib/coverfi/types.ts` - `ApiResult`, `FilterItem`, `FilterType`, `Product`, `ProductCategory`.

## Used by
`app/(dashboard)/coverfi/page.tsx`, `components/coverfi/companies/CompanyDetail.tsx`, `CompanyWizard.tsx`, `components/coverfi/corporate/CorporateProductsTab.tsx`, `CorporateStep4Products.tsx`, `MappingFormDialog.tsx`, `components/coverfi/products/CategoriesTable.tsx`, `CategoryFormDialog.tsx`, `FilterTypesPanel.tsx`, `ProductWizard.tsx` and `ProductsList.tsx`.

## Notes
- There is no client function to update a product after the wizard. Edits are made by calling the step functions again for an existing id.
- An abandoned wizard leaves a draft product with a low `step_completed`.
