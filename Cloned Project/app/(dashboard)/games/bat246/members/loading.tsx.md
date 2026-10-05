# `app/(dashboard)/games/bat246/members/loading.tsx`

> Next.js loading UI (skeleton screen) shown while the BAT246 "Office Members" page is loading.

**Kind:** Next.js loading · **Lines:** 56 · **Route:** `/games/bat246/members`

## Purpose
Next.js App Router automatically wraps a route segment's `page.tsx` in a Suspense boundary whose fallback is the segment's `loading.tsx`. This file provides that fallback for `/games/bat246/members`, so navigating to the members list shows a pulsing placeholder instead of a blank screen while the page's code loads.

## How it works
- Pure markup, no state, no data fetching.
- Draws grey `animate-pulse` blocks shaped like the real page: a back-link placeholder, a title and subtitle, a search box, and a table with a header row plus 12 rows.
- Each row uses a six-column grid (`1fr 120px 150px 100px 85px 180px`) that roughly matches the real table's columns (member with avatar, phone, location, role badge, joined date, upline with avatar).
- Dark background `#09090f`, matching the BAT246 back-office pages.

## Exports
- `default Bat246MembersLoading()` - the skeleton component.

## Used by
- Picked up automatically by Next.js for the `/games/bat246/members` route segment (no file imports it).

## Notes
- The column widths here (`120px 150px 100px 85px 180px`) differ slightly from those in `page.tsx` (`140px 180px 120px 100px 220px`), and `page.tsx` also renders its own in-page skeleton while its data request runs. The two skeletons therefore look a little different.
