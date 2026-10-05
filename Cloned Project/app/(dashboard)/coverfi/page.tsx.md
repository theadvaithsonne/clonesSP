# `app/(dashboard)/coverfi/page.tsx`

> Landing dashboard of the Coverfi insurance-brokerage back office: four count tiles, four quick-action cards and the brokerage id from the Coverfi health check.

**Kind:** Next.js page · **Lines:** 200 · **Route:** `/coverfi`

## Purpose
Coverfi is an insurance-brokerage back office inside the dashboard. Founders use it to manage insurance products, customer companies, insurers, email communication and their brokerage profile. This page is the section's home screen. It renders inside `app/(dashboard)/coverfi/layout.tsx`, which applies the founder check and the password gate. The page gives an overview and links into the sub-sections.

## How it works
- **Client component.** On mount, one `useEffect` starts two independent loads:
  1. **Health:** `coverfiApi<CoverfiHealth>("/v1/coverfi/health")` stores `{ ok, orgId, brokerageId, phase }` in `health`. Errors are swallowed silently.
  2. **Counts:** a `Promise.all` over `listProducts()`, `listCompanies()`, `listInsuranceCompanies()` and `listTemplates()`. Each call has its own `.catch` that falls back to an empty array, so one failing service never blanks the others. The result is stored as `counts`:
     - `products` - only products with `is_active` true.
     - `companies`, `insurers`, `templates` - raw array lengths.
- **Rendering:**
  - A `PageHeader` with the eyebrow "Coverfi · Overview" and an umbrella icon.
  - **Stat tiles** (`StatCard`): Active products → `/coverfi/products`, Customer companies → `/coverfi/companies`, Insurance providers → `/coverfi/insurance-companies`, Email templates → `/coverfi/communication/templates`. Until the counts arrive, each tile shows a muted "—".
  - **Action cards** (`ActionCard`): Set up your brokerage → `/coverfi/brokerage`, Create a product → `/coverfi/products/new`, Add a customer company → `/coverfi/companies/new`, Craft email templates → `/coverfi/communication/templates`.
  - The footer shows the brokerage id with a pulsing dot, but only when the health call succeeded.
- `StatCard` and `ActionCard` are local presentational `next/link` cards styled with the dark Coverfi palette and `cn()` class merging.

## Exports
- `default CoverfiDashboardPage()` - the page. `StatCard` and `ActionCard` are file-private.

## Interfaces
- **External services:** the Coverfi API, a separate service that is **not** part of this repo. It is reached through `coverfiApi()` at `NEXT_PUBLIC_COVERFI_API_URL` (default `http://localhost:4100`) with the Garage bearer token. Calls made:
  - `GET /v1/coverfi/health`
  - `GET /v1/coverfi/products`
  - `GET /v1/coverfi/company/all`
  - `GET /v1/coverfi/insurance`
  - `GET /v1/coverfi/templates`
- **Environment variables:** `NEXT_PUBLIC_COVERFI_API_URL`, indirectly through `lib/coverfi/api.ts`.

## Dependencies
- **Internal:**
  - `components/coverfi/PageHeader.tsx` - the section header.
  - `lib/coverfi/api.ts` - `coverfiApi`.
  - `lib/coverfi/products-api.ts`, `companies-api.ts`, `insurance-api.ts`, `communication-api.ts` - the list functions.
  - `lib/coverfi/types.ts` - the `CoverfiHealth`, `Company`, `InsuranceCompany` and `Product` types.
  - `lib/utils.ts` - `cn`.
- **Packages:** `react`, `next` (`Link`), `lucide-react`.

## Used by
No file imports it. It is the Next.js route `/coverfi`, linked from the dashboard sidebars (`components/dashboard/MainSidebar.tsx`, `backOfficeAppSideBar.tsx`, `SidebarContextMenu.tsx` reference `/coverfi`).

## Notes
- There is no `app/(dashboard)/coverfi/products/new` folder, so the "Create a product" link resolves to the dynamic `products/[id]` route with `id = "new"`. That route renders `ProductWizard productId="new"`, which calls `getProduct("new")`. Check that this flow works as intended before relying on the link.
- The counts load the full lists just to count them. That is fine at small scale but grows with the data.
