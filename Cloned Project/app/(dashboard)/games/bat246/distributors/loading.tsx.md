# `app/(dashboard)/games/bat246/distributors/loading.tsx`

> Next.js loading UI (skeleton table) shown while the BAT 246 Distributors route segment loads.

**Kind:** Next.js loading · **Lines:** 59 · **Route:** `/games/bat246/distributors`

## Purpose
Next.js App Router automatically wraps a route segment in a Suspense boundary and renders `loading.tsx` while the segment's page (and any children such as `distributors/[userId]`) is being fetched or streamed. This file gives the Distributors pages an instant placeholder in the same dark theme instead of a blank screen.

## How it works
A purely presentational server component with no state, data or props:
- A short bar standing in for the back link, then a header block (title and subtitle bars).
- A table card whose header row and eight body rows use the CSS grid template `1fr 110px 150px 44px 44px 44px 44px 100px`, mirroring an older column layout of the distributors table: avatar + name/email, phone, location, four circular flag columns, and a qualified-date column.
- All bars use Tailwind `animate-pulse`; each row sets an `animationDelay` of `i * 40ms` inline.

## Exports
- `default DistributorsLoading()` - the skeleton component.

## Dependencies
None (plain JSX and Tailwind classes).

## Used by
Not imported directly; Next.js uses it automatically for the `/games/bat246/distributors` segment and nested segments beneath it.

## Notes
- The skeleton's columns are hardcoded and do not necessarily match the current columns of `distributors/page.tsx`; update both together if the table layout changes and visual consistency matters.
