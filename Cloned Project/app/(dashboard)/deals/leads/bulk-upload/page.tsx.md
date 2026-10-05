# `app/(dashboard)/deals/leads/bulk-upload/page.tsx`

> Next.js page that renders the CRM "Bulk Upload Leads" flow full-screen by mounting `BulkUploadLeadsFlow` in page mode.

**Kind:** Next.js page · **Lines:** 7 · **Route:** `/deals/leads/bulk-upload`

## Purpose
A thin route wrapper. All of the bulk-import logic (file parsing, sheet selection, column mapping, review and upload) lives in the shared component `components/crm/leads/BulkUploadLeadsFlow.tsx`. That component can also be shown inside a dialog. This page exists so the flow has its own URL, which the leads list (`app/(dashboard)/deals/leads/page.tsx`) opens with `router.push("/deals/leads/bulk-upload")`.

## How it works
- Marked `"use client"` because the flow it renders is fully client-side (file input, XLSX parsing, local state).
- Renders `<BulkUploadLeadsFlow mode="page" />` and passes no `onClose` or `onUploadComplete` callbacks. In `"page"` mode the component draws its own full-height layout (`min-h-screen bg-gray-50`) with a header bar: a back arrow linking to `/leads` and the title "Bulk Upload Leads".
- The page itself does no data fetching. The component calls the external CRM API (`https://uatapi.garage.app/api/crm/...` via `buildExternalUrl`) for products, funnels, the upload template, the upload itself (`/crm/leads/bulk-upload`) and upload progress polling.

## Exports
- `default BulkUploadLeadsPage()` - the page component; returns `BulkUploadLeadsFlow` in page mode.

## Interfaces
- **External services:** indirectly, through `BulkUploadLeadsFlow`: the external CRM API at `https://uatapi.garage.app/api` (not part of this repo): `crm/leads/bulk-upload`, `crm/leads/bulk-upload/progress/:sessionId`, `crm/leads/bulk-upload/template`, `crm/products`, `crm/funnels`.

## Dependencies
- **Internal:** `components/crm/leads/BulkUploadLeadsFlow.tsx` - the complete multi-step bulk lead import UI and upload logic.

## Used by
Nothing imports this file. Next.js serves it at `/deals/leads/bulk-upload` (the `(dashboard)` route group does not appear in the URL, so it gets the dashboard layout). The leads page at `/deals/leads` links to it.

## Notes
- The back arrow inside the component points to `/leads`, not `/deals/leads`. Whether `/leads` resolves depends on the routing elsewhere in the app, so this may be a stale link.
