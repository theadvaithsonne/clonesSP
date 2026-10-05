# `app/(dashboard)/games/bat246/documentation/board-button-details/page.tsx`

> Static, print-ready client page that explains the eight action buttons on a BAT 246 board, styled to look like a PDF in a browser PDF viewer, with Share and Print actions.

**Kind:** Next.js page · **Lines:** 326 · **Route:** `/games/bat246/documentation/board-button-details`

## Purpose
BAT 246 players and distributors need a plain-language explanation of what each board button does and why it exists. This page is that handout. It is reached from the Documentation hub (`/games/bat246/documentation`) and is deliberately designed so that what you see on screen is exactly what prints, so it can be printed or saved as a PDF and passed around.

## How it works
**Content (L17-L97).** `BUTTON_DOCS` is a hardcoded array of `ButtonDoc` entries, each with a number, label, illustration path, a "Description" (the problem) and a "BAT 246 Solution" (what the button does), optionally a sub-heading and bullet list. The eight buttons:
1. **Layaway - Reserve** - reserve a product and have it paid out of future board earnings; bullets list the layaway amount available per collecting position (Baseball Card at Home Plate / Hot Box, Gray Card, Leader Board tiers Triple/Home Run/Grand Slam, Matching Bonus).
2. **Snap-Back Loans** - lend part of a recruit's purchase and be repaid automatically from their next BAT 246 earnings.
3. **Messaging** - message other team members.
4. **Pre-Pick** - pre-select the At Bat position, entry and board for an incoming distributor.
5. **Penciling** - lock an At Bat seat for a named prospect for up to 24 hours, with precedence and removal rules (one penciled name per member; only 1st Base may pencil during the Protection Period).
6. **Warp Speed** - a 1st Base entry gives up the rest of the 120-hour Protection Period; the clock stops once all four 1st Base entries have two sales or pressed Warp.
7. **Speed The Board Up** - tips for filling the board faster.
8. **Gift Card** - buy someone any BAT 246 product without knowing which.
Illustrations are `/images/bat246-doc-*.svg` files in `public/images/`.

**Toolbar (L192-L227).** A sticky dark bar imitating a PDF viewer: back link to the Documentation hub, fake filename "Board Buttons.pdf", and two buttons:
- `handleShare` uses the Web Share API (`navigator.share`) when present; otherwise copies `window.location.href` to the clipboard and shows "Copied!" for 2 s. A cancelled share sheet is ignored.
- `handlePrint` calls `window.print()`.

**Print engineering (L122-L190).** An inline `<style>` block sets `@page` margins and, under `@media print`:
- forces `print-color-adjust: exact` so badges and fills print even when "Background graphics" is off;
- hides the toolbar and every other element via the visibility trick, then lifts `.bat246-doc-print-root` out with `position: absolute` (fixed elements would not paginate in Chrome);
- uses `:has(.bat246-doc-print-root)` to reset `overflow`, height utilities and `position` only on ancestors of this page, because the dashboard shell clips to the viewport height and would otherwise truncate printing to one page or leave a blank gap at the top.

**Layout (L229-L322).** A white "paper" sheet on a grey background. Each entry is a `flow-root` block with the image floated left (stacked full width below `sm`), a numbered badge, title, description and solution. Print-only page breaks after items 2 and 5 give a 2/3/3 split across three pages; extra top margins compensate for uneven space per page; `break-inside-avoid` keeps an entry on one page.

## Exports
- `default Bat246BoardButtonDetailsPage()` - the page component.

## Interfaces
- **Browser storage / cookies:** none; uses the clipboard (fallback share) and the Web Share API.

## Dependencies
- **Internal:** none (static assets under `public/images/`).
- **Packages:** `react` (`useState` for the "Copied" state), `next/link`, `lucide-react` (`ChevronLeft`, `Printer`, `Share2`, `Check`).

## Used by
Not imported by any file; reached as the Next.js route `/games/bat246/documentation/board-button-details`, linked from `app/(dashboard)/games/bat246/documentation/page.tsx`.

## Notes
- All copy is hardcoded in this file; dollar amounts in the Layaway bullets are marketing text and are not read from the backend's actual layaway rules, so they can drift from real behaviour.
- The print CSS relies on the `:has()` selector and on class names used by the dashboard shell (`overflow-hidden`, `h-dvh`, `h-full`, `h-screen`); renaming those wrappers could break multi-page printing.
