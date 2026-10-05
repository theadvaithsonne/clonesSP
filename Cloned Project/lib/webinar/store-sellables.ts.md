# `lib/webinar/store-sellables.ts`

> Bridge between the Garage Store backend (`storeproducts` collection) and the webinar pin picker's `Sellable` shape.

**Kind:** frontend library · **Lines:** 238

<!-- docgen:auto -->

## Purpose
Bridge between the Garage Store backend (`storeproducts` collection)
and the webinar pin picker's `Sellable` shape. The roam-backend's
/api/invoices/sellables endpoint doesn't include storeproducts yet,
so the Physical chip would otherwise stay empty — we fetch them
here and merge client-side.

Strategy:
  1. GET /api/public/stores → list every storefront the customer-app
     knows about. The Store doc *may* carry `orgId`; we use it when
     present so we only fetch the founder's own stores' products.
  2. If no store doc exposes the host's `orgId` (the public list
     sometimes omits it), we fall back to fetching products from
     *every* store in parallel and then filtering on the product's
     own `orgId` — every `storeproducts` row carries `orgId`, so
     this still honors the "founder's stores only" rule.
  3. Map each product to the Sellable shape, copying `storeSlug` […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `listOrgStoreProducts` | function | `async listOrgStoreProducts(orgId: string \| null \| undefined): Promise<Sellable[]>` — Returns the host's storefront sellables (one per `storeproducts` row), already shaped for the webinar pin picker. | 161 |

## Interfaces

- **External HTTP calls:**
  - `GET app.revenue.network${path}` (L36)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_CUSTOMER_APP_URL`, `NEXT_PUBLIC_EXTERNAL_API_KEY`
- **External hosts mentioned in the code:** `app.revenue.network`

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `Sellable`, `(types only)`
- **Packages:** none

## Used by

- `components/webinar/ProductPickerDialog.tsx`
- `components/webinar/ShopPanel.tsx`
