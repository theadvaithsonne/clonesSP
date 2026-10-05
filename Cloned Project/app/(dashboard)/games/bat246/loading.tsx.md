# `app/(dashboard)/games/bat246/loading.tsx`

> Next.js loading UI (pulsing skeleton of a header and four cards) shown while any `/games/bat246` route segment loads.

**Kind:** Next.js loading · **Lines:** 37 · **Route:** `/games/bat246`

## Purpose
In the App Router, a `loading.tsx` file is wrapped around its segment as a Suspense fallback. Because this one sits at the root of the BAT 246 section, it is the default placeholder for `/games/bat246` and for every nested BAT 246 page that has no closer `loading.tsx` of its own (for example the dashboard or documentation pages; the distributors section has its own).

## How it works
A stateless server component that renders, with Tailwind `animate-pulse` on the whole tree:
- a header block (small pill, large title bar, subtitle bar) and a row of three stat placeholders separated by thin vertical dividers;
- a fixed two-column grid of four 176px-tall (`h-44`) card placeholders with the same dark gradient background the BAT 246 hub cards use.

## Exports
- `default Bat246Loading()` - the skeleton component.

## Dependencies
None (plain JSX and Tailwind classes).

## Used by
Not imported directly; Next.js renders it automatically for the `/games/bat246` segment and descendants without their own loading file.

## Notes
- The grid is always two columns, even on narrow phones, unlike the real hub pages which collapse to one column below `sm`.
