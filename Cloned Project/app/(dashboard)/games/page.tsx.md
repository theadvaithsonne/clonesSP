# `app/(dashboard)/games/page.tsx`

> Server-side redirect page: visiting `/games` sends the user straight to the BAT246 game area at `/games/bat246`.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/games`

## Purpose
BAT246 is currently the only game under `/games`, so there is no games index to show. This page makes the bare `/games` URL useful by forwarding it to the BAT246 landing page.

## How it works
- A server component whose body calls `redirect("/games/bat246")` from `next/navigation`. `redirect` throws internally, so nothing renders; Next.js answers with a redirect to the BAT246 page.
- No auth check happens here; access control is handled by the destination page (`app/(dashboard)/games/bat246/page.tsx`) and the dashboard layout.

## Exports
- `default GamesPage()` - performs the redirect; never returns markup.

## Dependencies
- **Packages:** `next` (`redirect` from `next/navigation`).

## Used by
- Reached by the Next.js route `/games` (the `(dashboard)` route group does not appear in the URL). No file imports it.

## Notes
- If more games are added later, this redirect is the place to replace with a real games index.
