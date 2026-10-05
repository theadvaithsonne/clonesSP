# `app/(dashboard)/games/bat246/dashboard/page.tsx`

> Client page for the BAT 246 "Dashboard" hub: checks that the viewer holds a senior board seat, then shows a grid of navigation cards (Boards, Office Members, Distributors, Invite and Place, YourMoneyBack, B2 Coin Wallet) with live member and distributor counts.

**Kind:** Next.js page · **Lines:** 312 · **Route:** `/games/bat246/dashboard`

## Purpose
This is the older, position-gated landing hub of the BAT 246 back-office. Only players who sit in a Home Plate, 3rd Base, 2nd Base A/B or 1st Base slot on some board may stay on it; everyone else is bounced to the boards list. It is a thin launcher: it renders a header (title, referral invite button, notification bell, a static "Live" badge) and six link cards into other `/games/bat246/*` pages.

## How it works
- **Access gate (L132-L144).** After `useAmIFounder()` finishes loading, the effect calls `GET /backend/bat246/my-dashboard-access` with the `garage_tok` bearer token from `localStorage`. If the response has no `hasAccess` (or the request fails), it `router.replace("/games/bat246/boards")`. One hardcoded email (L135) bypasses the check entirely. While `checking` is true the page renders `null`, so unauthorised users never see the grid.
  - Server side, `hasAccess` comes from `hasDashboardAccess()` in `server/bat246/routes/bat246.routes.ts`: the user's `Bat246Player` must appear in `homePlate`, `thirdBase`, `secondBaseA`, `secondBaseB` or `firstBase` of any `Bat246Board`.
- **Counts (L146-L169).** In parallel it fetches `GET /backend/office/bat246/members` (whose `totalMembers` feeds the Office Members card, and whose full payload is handed to `setMembersCache()` so the members page can reuse it) and `GET /backend/bat246/distributors?page=1&limit=1` (only `total` is read, for the Distributors card). Results are memoised in module-level variables `_statsCache` / `_statsCacheAt` for 60 s (`STATS_TTL`), so navigating back to the dashboard within a minute skips the network. Errors are swallowed and counts stay 0.
- **Cards (L171-L245).** `CARDS` is a static config array of `CardCfg` objects (href, icon, label, sub-text, Tailwind accent classes, glow shadow, optional count). Cards with `count: null` show a "BAT 246" caption instead of a number.
- **`NavCard` (L64-L123).** Renders one card as a `next/link` with a gradient background, a hover box-shadow applied imperatively in `onMouseEnter/Leave`, a faint oversized watermark icon and the count footer. If `iconImage` is set (B2 Coin Wallet uses `/images/bat246-b2coin-logo.png`) an `<img>` replaces the lucide icon in both slots.
- **`YmbIcon` (L39-L62).** A tiny inline SVG "YMB" lettermark used as the YourMoneyBack card icon; it inherits `currentColor` so it takes the card's icon colour class.
- Layout is responsive: 1 column below `sm`, 2 at `sm`, 3 at `lg`.

## Exports
- `default Bat246DashboardPage()` - the page component.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/bat246/my-dashboard-access` - returns `{ hasAccess, canApprove, salesCredits, atBatFilledCount, myCardType }`; only `hasAccess` is used here.
  - `GET /backend/office/bat246/members` - members of the BAT246 office (resolved from the `bat246_entry` product's organisation); used for the count and to warm the members cache.
  - `GET /backend/bat246/distributors?page=1&limit=1` - only the `total` field is used.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (falls back to `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` for the bearer token.

## Dependencies
- **Internal:**
  - `lib/hooks/useAmIFounder.ts` - provides `userData.email` and the `loading` flag that gates the access check.
  - `lib/bat246MembersCache.ts` - `setMembersCache()` stores the members response for 60 s for other BAT246 pages.
  - `components/bat246/Bat246NotificationBell.tsx` - notification bell in the header.
  - `components/bat246/Bat246ReferralInviteButton.tsx` - referral invite button next to the title.
- **Packages:** `react` (state/effects), `next/navigation` (`useRouter`), `next/link`, `lucide-react` (card icons).

## Used by
Not imported by any file; reached directly as the Next.js route `/games/bat246/dashboard` (the `(dashboard)` route group is not part of the URL).

## Notes
- A specific email address is hardcoded at L135 as an access-check bypass; anyone logged in with that account skips the server check. The real enforcement for data still lives in the backend endpoints.
- The "Live" badge is purely decorative; nothing on the page polls.
- The card links include `/games/bat246/Inviteandplace` and `/games/bat246/B2CoinWallet` with capital letters; Next.js routes are case-sensitive, so these must match the folder names exactly.
- The module-level stats cache is per browser tab and is lost on a full reload.
