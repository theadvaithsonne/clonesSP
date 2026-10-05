# `app/(dashboard)/deals/products/page-old.tsx`

> Retired, unrouted earlier version of the CRM "Products & Services" page: a card grid of products with search, a category dropdown, and add / edit / delete dialogs.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 754

## Purpose
This is the earlier implementation of the Deals > Products screen, left next to its replacement `page.tsx` in the same folder. Next.js only treats files named `page.tsx` as routes, so `page-old.tsx` is **not** served at any URL. The live page at `/deals/products` is `app/(dashboard)/deals/products/page.tsx` (about 3,300 lines, built on `ProductsDataTable`, `CRMSidebar`, `DealsNavbar` and `ProductOnboardingFlow`). Treat this file as reference or dead code.

## How it works
It is a single client component (`"use client"`), `ProductsPage`, that keeps all of its state in local `useState`.

**State**
- `products`, `loading`: the fetched product list and a loading flag.
- `searchTerm`, `selectedCategory`: the filters.
- `isAddDialogOpen`, `isEditDialogOpen`, `productToDelete`, `currentProduct`, `isCreating`: dialog and request state.
- `newProduct`: one shared form object (`name`, `description`, `price`, `sku`, `category`, `commissionPercentage`, `icon`). Both the Add and the Edit dialogs use it.

**Loading (L88-L104).** On mount, and again whenever `selectedCategory` changes, it calls `productsApi.getAll()` and stores the result. A failure shows a sonner toast. The category-filtered call (`productsApi.getAll(selectedCategory)`) is commented out, so changing the category only fetches the same full list again.

**Filtering (L106-L129).** `filteredProducts` matches `searchTerm` against the name or description, ignoring case. `categories` is the set of distinct `category` values in the loaded products, and it fills the "All Categories" dropdown. `selectedCategory` changes the button label and triggers a refetch, but it is **never applied to `filteredProducts`**. In practice the category filter does nothing.

**Create (L272-L329).** `handleCreateProduct` runs these checks: name is required, category is required, price must be greater than 0, and commission must be between 0 and 100. The same rules drive `isCreateFormValid`, which disables the Create button. If the checks pass, it calls `productsApi.create(...)`, appends the new product, resets the form, logs a `create` activity and shows a toast. The Add dialog has fields for name, category (fixed list: Software, Service, Hardware, Subscription, Training, Consulting), price, commission %, description and an `IconSelector`. Its SKU field is commented out.

**Edit (L158-L214).** `handleEditProduct` copies a product into `newProduct` and opens the Edit dialog. That dialog also shows SKU. `handleUpdateProduct` only requires a name. It calls `productsApi.update(id, newProduct)`, replaces the product in the list, resets the form and logs an `update` activity.

**Delete (L132-L155, L726-L750).** Choosing Delete from a card's menu sets `productToDelete`, which opens an `AlertDialog`. Confirming calls `productsApi.delete(_id)`, removes the product from the list and logs a `delete` activity.

**Rendering.** A card shows the product icon, name, category, an optional SKU badge, the description (clamped to two lines), the price and the commission %. `getProductIcon` (L217-L243) looks up `iconName` on the whole `lucide-react` namespace (`import * as Icons`). If there is no match, it falls back to a per-category emoji (📦 by default). `formatCurrency` always formats in USD (`en-US`).

**Input handling.** `handleInputChange` turns `price` and `commissionPercentage` into numbers with `parseFloat`, and an empty string becomes `undefined`. Other fields are stored as strings.

## Exports
- `default ProductsPage()`: the client page component. It takes no props.

## Interfaces
- **Backend endpoints called:** none directly. Product CRUD would go through `productsApi.getAll/create/update/delete` from `@/app/lib/crm/api-client`, but that module does not exist (see Notes).
- **External services:** `createActivity` from `lib/activity.ts` sends `POST https://uatapi.garage.app/api/crm/activities`. That external CRM API is not part of this repo; its URL comes from `buildExternalUrl` in `lib/api-config.ts`. Errors are swallowed and only logged.

## Dependencies
- **Internal:**
  - `components/ui/{button,input,card,badge,dropdown-menu,dialog,label,textarea,select,alert-dialog}.tsx`: shadcn/Radix UI primitives.
  - `lib/activity.ts`: `createActivity`, which writes the CRM audit log.
  - `@/app/lib/crm/api-client` and `@/components/ui/icon-selector`: imported, but **missing** from the project.
- **Packages:**
  - `react`: state and effects.
  - `lucide-react`: icons, plus dynamic icon lookup by name.
  - `sonner`: toasts.

## Used by
Nothing imports it, and its filename means Next.js never routes it. It appears unused.

## Notes
- **Would not compile if it were used.** It imports `productsApi`, `Product` and `CreateProductData` from `@/app/lib/crm/api-client`, and `IconSelector` from `@/components/ui/icon-selector`. Neither path exists (`@/*` maps to the repo root). The file is only harmless because nothing imports it. Moving it to `page.tsx`, or importing it, would break the build.
- The category dropdown is non-functional (see Filtering), and every category change triggers a needless refetch.
- Add and Edit share the single `newProduct` object. Opening Add after cancelling an Edit pre-fills the Add form with the edited product, because Cancel does not reset the form.
- Edit does not repeat the price and commission checks that Create enforces.
