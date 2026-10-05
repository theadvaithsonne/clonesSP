# `app/(dashboard)/games/bat246/lostmoney/page.tsx`

> Client page for the BAT 246 "Lost Money" hub: three numbered tiles linking to the public YourMoneyBack website, the claims/testimonials back-office and the Paid List.

**Kind:** Next.js page · **Lines:** 101 · **Route:** `/games/bat246/lostmoney`

## Purpose
"Lost Money" is the internal name of the YourMoneyBack.info programme run alongside BAT 246 (people who lost money in other schemes submit claims and may be repaid from BAT 246 sales). This page is the launcher for its three parts and is reached from the BAT 246 admin hub and the BAT 246 dashboard's "YourMoneyBack" card. A header comment notes it was restyled on 2026-08-26 to match the BAT 246 admin home page, with no functional change.

## How it works
- A back link "Admin Board" to `/games/bat246`, a "Lost Money" title and "BAT 246" subtitle.
- `CARDS` is a static array of three `CardCfg` entries rendered by `NavTile` in a grid (1 column on phones, 3 from `sm`). Each tile shows a white numbered disc (1-3), the label, a coloured icon badge and a sub-line:
  1. **Lost Money Website** -> `/games/bat246/lostmoney/index` (the public site rendered inside the app; see `lostmoney/website/*`).
  2. **Lost Money Backoffice** -> `/games/bat246/lostmoney/admin` (claims, testimonials, gallery).
  3. **View Paid List** -> `/games/bat246/lostmoney/paidlist` (Paid List management).
- No state, data fetching or access check here.

## Exports
- `default Bat246LostMoneyPage()` - the page component.

## Dependencies
- **Packages:** `next/link`; `lucide-react` (`ChevronLeft`, `Globe`, `ClipboardList`, `DollarSign`).

## Used by
Not imported by any file; reached as the Next.js route `/games/bat246/lostmoney`.

## Notes
- The page itself is open to any logged-in user; the admin and paid-list pages behind it perform their own "lostmoney" card-access checks, and the backend enforces them.
- `/games/bat246/lostmoney/index` is not inside the `(dashboard)` group; it lives at `app/games/bat246/lostmoney/index/` so it renders without the dashboard shell.
