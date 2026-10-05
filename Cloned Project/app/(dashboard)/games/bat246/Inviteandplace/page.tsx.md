# `app/(dashboard)/games/bat246/Inviteandplace/page.tsx`

> The BAT246 "Invite and Place" page: a paginated grid of qualified BAT246 distributors where members invite people to the $160 POD and the $650 Board Entry, place buyers onto boards, let 1st Base players approve and place their referrals, and let admins permanently delete distributor records.

**Kind:** Next.js page · **Lines:** 1254 · **Route:** `/games/bat246/Inviteandplace`

## Purpose
A BAT246 "distributor" is a user who has qualified to take part in the game, tracked by the backend `Bat246Distributor` document. The page began as a copy of `/games/bat246/distributors` (L18-L26). When that page was cut back to a plain list, this one kept the invite and placement tools and later gained "Invite To Board" / "Board Invite Status" columns and an admin-only delete. It is the operational hub for moving people from "qualified" to "invited", then "purchased/qualified", then "placed" on a board or in a POD. It is a client component in the `(dashboard)` route group.

## How it works

### Viewer permissions (L180-L217)
- `useBat246CardAccess("inviteandplace")` gives `isAdmin`: the hardcoded BAT246 admin, or anyone granted the `inviteandplace` card on the Permissions page.
- For non-admins, `GET /backend/bat246/my-dashboard-access` fills `hasDashboardAccess`, `isFirstBase` (the backend's `canApprove`), `salesCredits` (Green Cards), `atBatFilledCount` and `myCardType`.
- `GET /backend/bat246/my-active-board-membership` sets `canAccessPod` (`isPartOfActiveBoard`). This one gate enables or disables every POD and Board invite, remind and place button, because a viewer who is not on any active board has nowhere to place anyone.
- **Approve rules (L190-L200):**
  - The Approve column is shown only to 1st Base players (`canApprove = isFirstBase`), never to admins or to other positions.
  - It is clickable only when the board is not nearly full (`atBatFilledCount !== 6`), the player holds exactly 2 Green Cards, and has not yet earned Gold (`myCardType === null`).
  - Once Gold is earned, further referrals go to the Dugout automatically. A disabled Approve button explains which rule blocks it (L933-L943).

### Loading and search (L219-L249, L568-L580)
- `GET /backend/bat246/distributors?page=N&limit=15` loads one server page (`PAGE_SIZE = 15`) and is re-fetched when `page` changes.
- Search filters only the rows already loaded (name, email, phone, or "city, state, country") and resets `page` to 1 when it changes. It does not search the whole dataset.
- Columns use fixed pixel widths set inline (`BASE_COLUMN_WIDTHS`, plus `APPROVE_COLUMN_WIDTH` and `DELETE_COLUMN_WIDTH` when shown) inside a horizontal-scroll wrapper. The comment at L31-L41 explains why: dynamically built Tailwind `grid-cols-[...]` classes get purged, and a `1fr` name column collapsed to zero once 8 fixed columns existed.

### Grid columns (L711-L966)
1. **Distributor:** avatar or initial, name linking to `/games/bat246/distributors/:userId`, a `distributorId` chip, and the email with a copy-to-clipboard button ("Copied" shows for 1.5s).
2. **Phone**, 3. **Location**, 4. **Qualified** (`qualifiedAt` as "Mon YYYY").
5. **Invite To POD:** shows an "Invite" button when `podStatus === "not_invited"`, otherwise "Invited" plus "by <podInvitedByName>".
6. **POD Invite Status:**
   - `placed` shows "Placed — <tracking no>".
   - `purchased` shows a "Ready to be placed in pod" button that opens the POD placement modal.
   - `invited` shows a "Remind" button that re-sends the invite.
   - Otherwise it shows "Yet to invite".
7. **Invite To Board:** shows "Invited" when `boardInviteSentAt` is set or `boardStatus` is `qualified` or `placed`, even if no invite was ever sent through this button (for example, approved the old way or bought organically). The "by" name falls back from `boardInvitedByName` to `podInvitedByName` to `referredByName`. Otherwise it shows an "Invite" button.
8. **Board Invite Status:**
   - `placed` shows "Placed — <tracking no>".
   - `qualified` (a verified paid $650 invoice) shows a "Ready to be placed on board" button that opens the board placement modal.
   - `invited` shows "Remind".
   - Otherwise it shows "Yet to invite".
9. **Action (1st Base only):**
   - "Approved" (disabled) when the row is already approved or on a board, or was approved in this session (tracked in the local `approved` set).
   - An active "Approve" button when the distributor `isQualified` and `canClickApprove`.
   - A disabled "Approve" with an explanatory tooltip otherwise.
10. **Delete (admin only):** a trash icon that opens the delete confirmation.

Pagination shows "Showing start–end of N". Note that N is the length of the filtered array for the current page, while start and end come from the server total.

### Flows and handlers
- **POD invite / remind**, `handlePodInvite` (L286-L314): `POST /backend/bat246/distributors/:userId/invite-pod`. On success the row's status changes to `invited` locally, and the toast reads "Reminder sent" when the response has `type === "remind"`. Every click sends a real email; the backend has no cooldown.
- **POD placement** (L316-L366): `GET /backend/bat246/boards/my-active-pod-boards` lists the caller's boards that have open POD seats (four per board). `handleConfirmPodPlace` then posts `{ boardId }` to `POST /backend/bat246/distributors/:userId/place-pod` and marks the row `placed` with the returned `boardTrackingNumber`.
- **Board Entry invite / remind**, `handleBoardInvite` (L368-L398): `POST /backend/bat246/distributors/:userId/invite-board`. It sets `boardStatus` to `invited` (only if it was `not_invited`) and stamps `boardInviteSentAt`.
- **Board placement, open path** (L400-L491):
  - `handleOpenBoardPlaceModal` gets `GET /backend/bat246/distributors/:userId/board-placement-info`, opens the modal, then fetches `GET /backend/bat246/boards/open-for-placement` for a board picker. The picker appears only when there is more than one option, and the backend scopes that list by caller.
  - `handleBoardPlaceModalBoardChange` re-fetches the placement info with `?boardId=`.
  - `handleConfirmBoardPlace` posts `{ boardId, position }` to `POST /backend/bat246/distributors/:userId/place-on-board` and marks the row placed, approved and on-board.
- **Approve and place, 1st Base path** (L264-L284, L524-L566):
  - `handleApprove` gets `GET /backend/bat246/distributors/:userId/placement-info`, which the backend restricts to card admins or 1st Base players.
  - `handleConfirmPlacement` posts `{ boardId, position }`, or `{ boardId, toDugout: true }` for the `__dugout__` sentinel, to `POST /backend/bat246/distributors/:userId/approve`.
  - If the chosen position is no longer valid, the handler re-fetches placement info (`refreshPlacementInfo`) and re-opens the choice with the error. Server-side, a non-admin approve skips the slot owner's Green Card and may award Gold to the approver.
- **Default selection**, `defaultSelection(info)`: pre-selects the reserved position if it is still blank, not stale and available; otherwise the first available position.
- **Delete**, `handleDeleteDistributor` (L493-L522): `DELETE /backend/bat246/distributors/:userId` (backend: card admin only). It removes the row and decrements `total`. The confirmation text matches the backend: only the `Bat246Distributor` record is deleted, and the user's account, any board placement and their game history are kept. This cannot be undone.

### Modals (L1008-L1250)
These are inline fixed overlays, not portals:
- "Approve & Place on Board" - shows the reserved position as open, now filled or stale, plus a position `<select>`.
- "Place in POD" - a board `<select>` showing how many POD seats are open.
- "Place on Board" - an optional board picker plus the reserved-position info and a position `<select>`.
- "Delete Distributor" - confirmation.

`positionLabel(key)` turns slot keys (`thirdBase`, `secondBaseA`, `1stA`, `atBat-3`, `__dugout__`) into labels such as "3rd Base", "1st Base A" and "At Bat 4".

### Header
- The back link adapts to the viewer: admins go to `/games/bat246` ("Admin Board"), users with dashboard access go to `/games/bat246/dashboard`, and everyone else goes to `/games/bat246/boards`.
- "+ Invite to become BAT 246 Distributor" opens `InviteNewDistributorModal`.

## Exports
- `default Bat246InviteAndPlacePage()` - the page component. Interfaces, constants and helpers are module-private.

## Interfaces
- **Backend endpoints called:** all are in `server/bat246/routes/bat246.routes.ts` behind `requireAuth`.
  - `GET /backend/bat246/distributors?page&limit` - qualified distributor list.
  - `GET /backend/bat246/my-dashboard-access` - Green Cards, 1st Base flag and similar.
  - `GET /backend/bat246/my-active-board-membership` - `isPartOfActiveBoard`.
  - `POST /backend/bat246/distributors/:userId/invite-pod` - send or remind a POD invite (sends an email).
  - `GET /backend/bat246/boards/my-active-pod-boards` - boards with open POD seats.
  - `POST /backend/bat246/distributors/:userId/place-pod` - place in a POD.
  - `POST /backend/bat246/distributors/:userId/invite-board` - send or remind a $650 Board Entry invite (sends an email).
  - `GET /backend/bat246/distributors/:userId/board-placement-info[?boardId]` - open-path placement options.
  - `GET /backend/bat246/boards/open-for-placement` - board picker.
  - `POST /backend/bat246/distributors/:userId/place-on-board` - open-path placement.
  - `GET /backend/bat246/distributors/:userId/placement-info` - 1st Base / admin approve options.
  - `POST /backend/bat246/distributors/:userId/approve` - approve and place (or Dugout).
  - `DELETE /backend/bat246/distributors/:userId` - permanently delete the `Bat246Distributor` record.
  - Indirectly: `GET /backend/bat246/permissions/mine` and `GET /backend/auth/me` through the hooks.
- **Database (via backend):** `Bat246Distributor` is read, updated and deleted; board slot data is written by the placement services.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (default `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage["garage_tok"]`; writes to the clipboard on "copy email".

## Dependencies
- **Internal:**
  - `lib/hooks/useAmIFounder.ts` - only its `loading` flag, to wait for auth.
  - `lib/hooks/useBat246CardAccess.ts` - `useBat246CardAccess("inviteandplace")` for admin status.
  - `components/bat246/InviteNewDistributorModal.tsx` - the "Invite to become BAT 246 Distributor" dialog.
- **Packages:** `react`, `next` (`Link`), `sonner` (toasts), `lucide-react` (icons).

## Used by
Not imported by any module. It is reached as the Next.js route `/games/bat246/Inviteandplace` (case-sensitive), normally from the "Invite and Place" card on the BAT246 dashboard.

## Notes
- **Two placement paths reach the same board tree.**
  - The 1st Base / admin Approve path is gated by the backend to card admins or 1st Base players, and carries the Green Card / Gold rules.
  - The open "Ready to be placed on board" path is available to any active-board member. Both set `isApproved` on the distributor.
- Invite and Remind buttons send a real email on every click, with no rate limit on either the client or the server.
- The search is client-side over the current page only. A user on page 2 will not find someone listed on page 1.
- The Approve button rules are enforced only in the UI. The backend re-checks admin or 1st Base status, but the Green Card count and "nearly full" rules shown here are not visible in the approve route's own guard.
- A file comment refers to `"md files/Distributors.md"` for the logic this page shares with the distributors page.
