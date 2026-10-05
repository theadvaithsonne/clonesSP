# `app/(dashboard)/coverfi/roles/page.tsx`

> Next.js page for Coverfi role management; it only renders `RolesTable`.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/roles`

## Purpose
This is the route entry for the Coverfi "Roles" screen, where founders list, create, edit and delete Coverfi roles (`CoverfiRole` records).

## How it works
A server component with no logic: it returns `<RolesTable />`. Unlike the Products pages, there is no route-level layout that adds a header. `RolesTable` renders its own `PageHeader` and calls the Coverfi API through `lib/coverfi/roles-api.ts` (paths under `/v1/coverfi/roles`).

The parent `app/(dashboard)/coverfi/layout.tsx` still applies: non-founders are redirected to `/`, the `coverfi-skin` class is added to `<body>`, and the content is wrapped in `CoverfiPasswordGate`.

## Exports
- `default CoverfiRolesPage()` - the page component.

## Interfaces
- **External services:** the Coverfi API (base URL from `NEXT_PUBLIC_COVERFI_API_URL`, used through `lib/coverfi/api.ts`). It is not part of this repo's Express backend.

## Dependencies
- **Internal:** `components/coverfi/roles/RolesTable.tsx` - the roles table, its dialogs and its API calls.

## Used by
Nothing imports it. Next.js serves it at `/coverfi/roles`.
