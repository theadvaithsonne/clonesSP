# `app/(dashboard)/games/bat246/documentation/page.tsx`

> Client page for the BAT 246 Documentation hub: a back link to the admin board and a single card linking to the Board Button Details handout.

**Kind:** Next.js page · **Lines:** 64 · **Route:** `/games/bat246/documentation`

## Purpose
This is the landing page of the BAT 246 "Documentation" card in the BAT 246 back-office. Right now it holds only one document, but it is laid out as a two-column card grid so more documents can be added as further cards.

## How it works
- A "Admin Board" back link to `/games/bat246`.
- A responsive grid (1 column, 2 from `sm`) with one `next/link` card pointing to `/games/bat246/documentation/board-button-details`. The card uses the theme's `brand` colour (Tailwind `brand` utilities and the `--brand` CSS variable), a faint oversized `FileText` watermark, and an imperative hover glow set in `onMouseEnter` / `onMouseLeave` using `color-mix()` on `var(--brand)`.
- No state, data fetching or access check in this file.

## Exports
- `default Bat246DocumentationPage()` - the page component.

## Dependencies
- **Packages:** `next/link`; `lucide-react` (`FileText`, `ArrowUpRight`, `ChevronLeft`).

## Used by
Not imported by any file; reached as the Next.js route `/games/bat246/documentation` (the `(dashboard)` group is not part of the URL).

## Notes
- It is marked `"use client"` only because of the inline mouse handlers.
- Access to the "documentation" card is a grantable BAT 246 permission key (`useBat246CardAccess.ts`), but this page itself does not enforce it; any logged-in user who knows the URL can open it.
