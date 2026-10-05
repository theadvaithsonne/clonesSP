# `components/bat246/Bat246NotificationBell.tsx`

> A bell button with a dropdown that polls and lists a BAT 246 member's "Recruit Activity" notifications. Each notification can be marked read, cleared, placed, or approved/denied.

**Kind:** React component · **Lines:** 372

## Purpose
BAT 246 distributors get notified when a recruit:
- qualifies and is ready to be placed on a board,
- buys a membership or affiliate product, or
- asks them for B2 Coins (Layaway) or a Snap Back Loan.

This component is the inbox for those events. It sits in the header of the BAT 246 home, dashboard and boards pages.

## How it works
- **Polling.** `fetchNotifications()` calls `GET /backend/bat246/notifications` on mount and every 30 seconds. The bearer token is read from `localStorage.garage_tok`. Errors are swallowed.
- **Unread badge.** The bell shows a red counter for unread items, capped at 9.
- **Read state:**
  - `markRead(id)` updates the item locally right away, then POSTs `/notifications/:id/read`.
  - `markAllRead()` POSTs read for every unread id. It runs when the dropdown closes, either by clicking the bell again or by clicking outside it (a `mousedown` listener on `document`).
- **Clear.** `clearNotif(id)` removes the item locally, then POSTs `/notifications/:id/clear`.
- **Notification types.** `notificationType` decides the icon, colours and label:

  | Type | Label |
  |---|---|
  | `placement` (default) | Ready to Place |
  | `placement_unassigned` | Qualified, Awaiting Placement |
  | `membership` | Purchased $20 Annual Membership |
  | `affiliate` | Purchased $25 Unilevel Plus |
  | `layaway_request` | B2 Coins Request |
  | `snapbackloan_request` | Snap Back Loan Request |

  - `placement` items also show a "Board <trackingNo>" chip and a position chip. Position keys are mapped through `POSITION_LABELS`, e.g. `atBat-0` becomes "AT BAT 1".
- **Place Now.** Shown only on `placement` items that have a `boardId`, and only when the parent passed `onPlaceNow`. The callback is awaited, the item is removed on success, and a spinner shows while it runs. `placing` stops a second click from running in parallel.
- **Approve / Deny (requests):**
  - `layaway_request` items POST `{ approve }` to `/bat246/layaway/requests/:layawayRequestId/respond`.
  - `snapbackloan_request` items POST `{ approve }` to `/bat246/snapbackloans/requests/:snapBackLoanRequestId/respond`.
  - On success the item is removed and cleared on the server. On failure the server's `error` text appears under the buttons. The error state (`respondError`) is shared by all items.
  - For these two types the list shows the server-written `summary` instead of the recruit's name and email.

## Exports
- `Bat246NotificationBell({ onPlaceNow? })`: the bell and dropdown. `onPlaceNow(notification)` is an async handler that places the recruit.
- `PlacementNotification` (interface): the notification row shape:
  - `_id`, `notificationType`, `boardId`, `boardTrackingNo`, `position`
  - `qualifiedUserId`, `qualifiedUserEmail`, `qualifiedUserName`, `uplinePosition`
  - `layawayRequestId`, `snapBackLoanRequestId`
  - `summary`, `isRead`, `createdAt`

## Interfaces
- **Backend endpoints called** (all use `requireAuth`; mounted at `/bat246`, `/bat246/layaway` and `/bat246/snapbackloans` in `server/app.ts`):
  - `GET /backend/bat246/notifications`: list notifications.
  - `POST /backend/bat246/notifications/:id/read`: mark one read.
  - `POST /backend/bat246/notifications/:id/clear`: remove one.
  - `POST /backend/bat246/layaway/requests/:id/respond`: approve or deny a B2 Coins request.
  - `POST /backend/bat246/snapbackloans/requests/:id/respond`: approve or deny a Snap Back Loan request.
- **Environment variables:** `NEXT_PUBLIC_API_URL`: backend base (falls back to `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage.garage_tok`.
- **Background work:** a 30-second `setInterval` poll, cleared on unmount.

## Dependencies
- **Packages:**
  - `react`
  - `lucide-react`: icons (Bell, UserPlus, Shield, Star, DollarSign, Landmark, and others).

## Used by
- `app/(dashboard)/games/bat246/boards/page.tsx`: passes `onPlaceNow={handlePlaceNow}`, so Place Now is available.
- `app/(dashboard)/games/bat246/dashboard/page.tsx`: no `onPlaceNow`.
- `app/(dashboard)/games/bat246/page.tsx`: no `onPlaceNow`.

These pages are served at `/games/bat246/boards`, `/games/bat246/dashboard` and `/games/bat246`.

## Notes
- Read and clear calls are fire-and-forget. If one fails, the local state no longer matches the server until the next poll.
- `markAllRead` sends one POST per unread id; the server has no bulk endpoint.
