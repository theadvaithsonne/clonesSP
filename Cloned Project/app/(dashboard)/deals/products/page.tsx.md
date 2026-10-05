# `app/(dashboard)/deals/products/page.tsx`

> The Deals CRM "Products & Services" catalogue page. It lists, searches, filters, sorts, exports, adds, edits, views and deletes CRM products and services that are stored in the external Garage UAT API.

**Kind:** Next.js page · **Lines:** 3333 · **Route:** `/deals/products`

## Purpose
This client component is the product catalogue section of the Deals CRM. It can be shown in two ways:
- **Standalone** at the URL `/deals/products`, with the `DealsNavbar` header.
- **Inline** inside the BackOffice Deals app (`components/dashboard/inlineApps/deals/DealsApp.tsx`). That app loads the page with `next/dynamic` (`ssr: false`) and sets `window.__garageDealsInline = true` before the page renders.

Products and services sit in the same list. A record with a `productId` is a product; a record with a `serviceId` is a service. All data comes from the **external** CRM API at `https://uatapi.garage.app/api`, not from this repo's Express backend.

## How it works

### Rendering mode and theme (L74-L80, L1082-L1098)
- `isInlineDealsMode` is true when `window.__garageDealsInline` is set. `isFigma` is just another name for that flag. When it is true, the page uses the dark "Figma" BackOffice styling and renders the shared `ProductsDataTable`. When it is false, it renders its own shadcn `Table` with theme-dependent classes.
- `resolvedTheme` comes from `next-themes`. It is `"color"` for the colour theme. It is `"dark"` when the theme is dark or the page is inline. Otherwise it is `"light"`. Most of the JSX picks Tailwind class strings for one of these three themes.
- `DealsNavbar` appears only outside inline mode. A `CRMSidebar` import exists, but its usage is commented out.
- `<main>` picks one of several views. In practice only the list view can be reached (see Notes):
  1. `selectedProduct` set: product overview with Overview and Documents tabs (L1099-L1383).
  2. `!showListView`: a static mock-up with hardcoded demo data (L1384-L1652).
  3. `isAdd` / `isEditMode`: `ProductOnboardingFlow` in add or edit mode (L1655-L1666).
  4. Otherwise: the header bar, the count strip and the combined list (L1667-L2370).

### State (L81-L138, L292-L307)
- List data: `products`, `isLoadingProducts`, `totalProducts`. Paging: `currentPage`, `totalPages`, `limit` (default 50). Sorting: `productsSort` (a `SortState`). Search: `searchTerm`.
- Filters: `typeFilter` (`all | products | services`) and `statusFilter` (`all | active | pause | inactive`). The filter dialog edits `temp*` copies of these and writes them back only when the user clicks Apply.
- Row selection for bulk delete: `selectedProductIds`.
- Add/Edit modal form fields: `formType`, `formName`, `formCode`, `formCategory`, `formPrice`, `formUnit`, `formStatus`, `formDescription`, `formErrors`, `modalMode`, `editingProductId`.
- Overview, edit and document state: `selectedProduct`, `editableProduct`, `isProductEditMode`, `originalDocuments`, `documents`, `removedDocuments`, `productBrochure`, and related flags.
- View dialogs: `viewingProduct` / `isViewProductOpen` for products, and `viewingFunnel` / `isViewFunnelOpen` for funnels.
- A local `Product` type (L273-L290) defines these fields: `_id`, `productId?`, `serviceId?`, `name`, `status`, `category`, `pricing` (string or number), `unit?`, `maxDiscount`, `description`, `commissionType`, `commissionPercentage`, `productBrochure?`, `documents?`, `userId` and `updatedAt`.

### Loading and searching (L325-L434)
- `fetchProducts()` sends `GET /crm/products?skip=0&limit=1000` and gets the whole catalogue in one call. It accepts either `{ products, total }` or a bare array. The total comes from `data.total`, then `data.pagination.total`, then the array length. On failure the list is cleared.
- The page fetches on mount and again whenever `isAdd` changes. `useDealsInlineRefresh("products", ...)` also refetches when the BackOffice Deals header dispatches `deals:inline-refresh` for the `products` section. That hook only listens in inline mode.
- `handleSearch(term)` runs on every keystroke, with no debounce. It resets to page 1. A non-empty term calls `searchProducts`, which sends `GET /crm/searchproduct?q=<term>` and replaces `products` with the results. An empty term reloads the full list. If the search request fails, the page falls back to `fetchProducts(1)`.
- Paging is done in the browser. The list view filters `products` by type and status, sorts the whole filtered list with `sortProducts`, then takes `slice(startIndex, endIndex)`.

### Sorting, formatting and selection helpers (L718-L817)
- `sortProducts(rows)` sorts by `productsSort.by`, which can be `name`, `type`, `code`, `category`, `price`, `status` or `updated`. Text keys are lowercased and compared with `localeCompare`. Prices are compared as numbers. A row with no price sorts as `-Infinity`. A row with no date in `updated` sorts as `+Infinity`, so it goes to the bottom when sorting ascending and to the top when sorting descending (the code comment says the bottom for both).
- `formatProductPrice` shows `₹<price>` or `₹<price>/<unit>`, using `toLocaleString`. `getProductCode` returns `productId`, falling back to `serviceId`. `getProductUpdated` returns the ISO date part (`YYYY-MM-DD`).
- `handleToggleProductSelection` adds or removes a row ID. The select-all toggle covers only the rows on the current page.
- `renderProductRowActions` renders the Edit and Delete dropdown that `ProductsDataTable` shows on each row.

### List view UI (L1668-L2370)
- **Header bar.** Inline mode: a search box, a "Delete Selected (n)" button that appears only when rows are selected, a Filters button with a dot when a filter is active, Export, and Add (+). Standalone mode: search, Filters, Export and an "Add Product/Service" button. There is no bulk-delete button and no row checkboxes in standalone mode.
- **Count strip.** Standalone mode only. Shows "N Products/Services" for the filtered list.
- **Inline list.** `ProductsDataTable` gets the current page of rows, the field accessors, the sort state, selection callbacks, footer totals (the total count plus the selected count) and a pagination object with page sizes 25, 50, 100 and 200. Clicking a row opens the View Product dialog.
- **Standalone list.** A hand-built table with columns Type (Package or Briefcase icon), Name (a link that opens the View Product dialog), Code, Category, Price, Status badge (Active, Pause, or anything else shown as Inactive), Updated and an actions menu. A numbered pager shows up to 5 page buttons. It appears only when there is no search term and more than one page.

### Add/Edit modal (L140-L269, L2486-L2828)
- `openAddProductModal()` resets the form and opens the modal. The page also opens it when it receives the window event `deals:open-add-product`, which the dashboard layout's "add" action dispatches when the active Deals section is `products` (`app/(dashboard)/layout.tsx`).
- `openEditProductModal(product)` fills in the form. The type is `service` when `serviceId` is set. If `unit` exists, price and unit come straight from the record. Otherwise the code tries to split a legacy `"price/unit"` pricing string. Status is converted to title case.
- `handleSubmitProductModal()` validates the form. Name is required, category is required, and price must be a finite number greater than 0. The first error is also shown as a toast. The code field is labelled "Code *" but is not validated. The payload is `{ type, name, pricing, unit, category, status (lowercased), description }`, plus `serviceId` or `productId` set to the code. In add mode the page sends `POST /crm/products`. In edit mode it sends `PUT /crm/products/:id`. After either, it closes the modal and refetches.
- The modal ignores outside clicks and the Escape key. It closes only through its X button or Cancel. Unit options: monthly, hourly, daily, weekly, yearly, one-time, per-unit. Status options: Active, Pause, Inactive.

### Delete (L658-L716, L819-L848, L2375-L2484)
- `handleDeleteFromList(product)` remembers the product and opens the confirmation. `handleDeleteProduct()` deletes `selectedProduct || productToDelete` with `DELETE /crm/products/:id`, removes the ID from the selection, clears the overview state if needed, and refetches.
- In inline mode the confirmation uses `DeleteLeadsDialog`, a component borrowed from CRM Leads with product-specific title and description text. Standalone mode uses a themed `AlertDialog`.
- `confirmBulkDelete()` deletes each selected ID one after another with `DELETE /crm/products/:id`, counts failures, shows one toast for the whole batch, clears the selection and refetches. Bulk delete exists only in inline mode.

### Filters dialog (L2830-L3185)
- Inline mode: a two-pane dialog. The left pane picks the category (Type or Status). The right pane lists the options. Buttons: Cancel, Reset Filter (resets and applies right away) and Apply Filter.
- Standalone mode: a single-column dialog with Type and Status sections and Close / Apply Filters buttons. Its status choices are All, Active and Inactive. There is no "Pause" option, although `statusFilter` supports `pause`.

### Export (L860-L913)
`handleExport()` applies the current type and status filters to `products`, which is not limited to the current page and does not follow the current sort. It maps each row to the columns Type, Name, Code, Category, Price, Status and Updated. It then builds an `.xlsx` workbook (sheet "Products & Services") with `xlsx` and downloads it with `file-saver` as `products_services_export_<YYYY-MM-DD>.xlsx`.

### View dialogs (L436-L503, L3187-L3327)
- `handleViewProduct(id)` opens the "Product Details" dialog, sends `GET /crm/products/:id`, and shows read-only fields: name, type, category, price with unit, status and description. On failure it shows a toast and closes the dialog.
- `handleViewFunnel(id)` would load `GET /crm/funnels/:id` into `ViewFunnelDialog`. `ViewFunnelDialog` is always rendered, but nothing in this file calls `handleViewFunnel`.

### Product overview and documents (L505-L656, L997-L1080, L1099-L1383)
- `handleProductView(product)` reloads the product with `fetchProductData` (`GET /crm/products/:id`) and sets `selectedProduct`. That shows the overview: a status pill, a six-column grid (name, description, category, pricing, commission type, commissions), and a Documents tab listing the brochure and document download links.
- `handleEditModeToggle` and `handleFieldUpdate` support editing in place. `handleSaveChanges` sends `PUT /crm/products/:id` with name, status (lowercased), category, pricing, maxDiscount, description, commissionType and commissionPercentage. The editor's category dropdown offers fixed choices: Software, Service, Hardware, Subscription, Training, Consulting.
- `handleSaveDocuments` builds the document list as original plus new, minus removed, and sends `PUT /crm/products/:id` with `{ productBrochure, documents }`.
- The upload functions (`handleBrochureUpload`, `handleDocumentUpload`) that called UploadThing's `uploadFiles("imageUploader", ...)` are commented out (L922-L991).

## Exports
- `default ProductPage()` - the page component. It takes no props.

## Interfaces
- **Backend endpoints called.** None on this repo's `/backend`. Every call goes through `buildExternalUrl`, which builds URLs on the external API base `https://uatapi.garage.app/api`, and uses `authenticatedFetch`:
  - `GET /crm/products?skip=0&limit=1000` - load the full catalogue
  - `GET /crm/searchproduct?q=<term>` - search
  - `GET /crm/products/:id` - load one product (view dialog and overview)
  - `POST /crm/products` - create a product or service
  - `PUT /crm/products/:id` - update fields, or the brochure and documents
  - `DELETE /crm/products/:id` - delete one item (also used once per item for bulk delete)
  - `GET /crm/funnels/:id` - funnel details (handler exists but nothing calls it)
- **External services:** the Garage UAT CRM API (`uatapi.garage.app`). UploadThing is imported, but the code that used it is commented out.
- **Browser events:** listens for the window event `deals:open-add-product`, and for `deals:inline-refresh` (with `section: "products"`) through `useDealsInlineRefresh`. Reads the `window.__garageDealsInline` flag.
- **Browser storage / cookies:** nothing directly. `authenticatedFetch` reads the `auth-token` / `garage_tok` token from localStorage or cookies and sends it as a Bearer header. On a 401 it clears those values.

## Dependencies
- **Internal:**
  - `components/deals/products/ProductsDataTable.tsx` - the inline (BackOffice) list table, built on the shared DataTable
  - `components/ui/data-table/types.ts` - the `SortState` type
  - `components/crm/DealsNavbar.tsx` - header in standalone mode
  - `components/crm/CRMSidebar.tsx` - imported, but its usage is commented out
  - `components/crm/ViewFunnelDialog.tsx` - funnel details dialog
  - `components/crm/leads/DeleteLeadsDialog.tsx` - delete confirmation in inline mode
  - `components/deals/ProductOnboardingFlow.tsx` - add/edit wizard in a branch that cannot be reached
  - `components/ui/*` (alert-dialog, badge, button, checkbox, dialog, dropdown-menu, input, label, popover, select, table, tabs, textarea) - shadcn/Radix building blocks. `popover` is imported but not used.
  - `lib/api-config.ts` - `buildExternalUrl`, which builds the UAT API URL
  - `lib/deals-events.ts` - `useDealsInlineRefresh`
  - `utils/api.ts` - `authenticatedFetch` (Bearer auth, retries with backoff, handling of 401 and expired tokens)
  - `utils/uploadthing.ts` - `uploadFiles`, used only by the commented-out code
- **Packages:**
  - `react` - state and effects
  - `next-themes` - current theme
  - `lucide-react` - icons
  - `sonner` - toasts
  - `xlsx` - builds the Excel export
  - `file-saver` - downloads the export file

## Used by
- `components/dashboard/inlineApps/deals/DealsApp.tsx` - loads the page with `next/dynamic` for the "Products & Services" section of the inline Deals app.
- The Next.js route `/deals/products`. The `(dashboard)` route group does not appear in the URL.

## Notes
- **Unreachable code.** `showListView` starts as `true` and is never set to `false`. `setIsAdd(true)` and `setIsEditMode(true)` are never called. `handleProductView` is never called, so `selectedProduct` is never set. As a result, the static mock-up (with hardcoded demo text such as "Lamborghini" and placeholder contact details), both `ProductOnboardingFlow` branches, the overview/edit view, `handleSaveChanges`, `handleSaveDocuments` and the upload helpers never run. `handleViewFunnel` is never called either.
- **Hardcoded admin flag.** `isAdmin` is hardcoded to `true` (marked TODO, L556). There is no client-side role check for editing.
- **Leftover `activeTab` logic can reset the page.** The pagination effect (L371-L377) uses `filteredProducts`, which depends on the leftover `activeTab === "products"` state and so counts only rows that have a `productId`. It sets `totalPages` and can reset `currentPage` to 1 based on that count. With the type filter on Services, paging past the number of pages the products-only count allows can jump back to page 1.
- **Catalogue size cap.** The catalogue is fetched with `limit=1000`, so anything beyond 1,000 items is silently left out of the list, the filters and the export.
- **Search runs on every keystroke.** It fires one request per keystroke with no debounce or cancellation, so slow responses can arrive out of order.
- **Inconsistent status casing.** Status is sent lowercased, but the UI compares and displays it in different casings. The standalone filter dialog has no "Pause" option.
- **Debug logging.** `console.log` calls (for example "Total Products:" on every render) are left in.
- **Unused imports.** `useMemo`, `ChevronDown`, `Popover*` and `CRMSidebar` are imported but not used. `uploadFiles` is used only in commented-out code.
- **Hardcoded API base.** The API base URL is hardcoded in `lib/api-config.ts` to the UAT environment. This page does not use `NEXT_PUBLIC_API_URL`.
