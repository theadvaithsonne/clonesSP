# `app/(dashboard)/coverfi/products/[id]/page.tsx`

> Dynamic route that unwraps a product id and renders the Coverfi product wizard for that product.

**Kind:** Next.js page · **Lines:** 14 · **Route:** `/coverfi/products/[id]`

## Purpose
Coverfi insurance products are configured in a multi-step wizard. This page binds `/coverfi/products/<id>` to `ProductWizard`. The wizard loads the product with `getProduct(productId)` (→ `GET /v1/coverfi/products/:id` on the external Coverfi API) and opens at the next unfinished step: `step_completed + 1`, clamped between steps 2 and 5. Active products open at step 5.

## How it works
- A client component.
- `params: Promise<{ id: string }>` is unwrapped with React's `use(params)`. The page renders `<ProductWizard productId={id} />`.
- It renders inside `app/(dashboard)/coverfi/products/layout.tsx` and `coverfi/layout.tsx` (access control).

## Exports
- `default ProductEditPage({ params })` - `params: Promise<{ id: string }>`.

## Dependencies
- **Internal:** `components/coverfi/products/ProductWizard.tsx` - the product configuration wizard.
- **Packages:** `react` (`use`).

## Used by
No file imports it. It is reached at `/coverfi/products/<id>`, from the products list.

## Notes
There is no static `products/new` route. The `/coverfi/products/new` link on the Coverfi dashboard (`app/(dashboard)/coverfi/page.tsx`) therefore lands here with `id = "new"`, and the wizard calls `getProduct("new")`. Unless the Coverfi API or wizard handles that value, the link shows a "Failed to load product" toast.
