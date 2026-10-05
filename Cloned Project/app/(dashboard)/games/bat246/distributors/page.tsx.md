# `app/(dashboard)/games/bat246/distributors/page.tsx`

> Client page listing every qualified BAT 246 distributor in a paginated, searchable table, with each person's nearest qualified upline and, for 1st Base players, an "Approve" action that places the distributor on a board.

**Kind:** Next.js page · **Lines:** 678 · **Route:** `/games/bat246/distributors`

## Purpose
"Distributors" are BAT 246 office members who have met the qualification rules (office member, Garage affiliate, BAT 246 membership, product purchased) and been assigned a distributor ID. This page is the read view of that list for BAT 246 back-office users, and it doubles as the place where a 1st Base player approves a referral and drops them into an open seat on their board. The POD / Board invite columns that used to live here moved to `/games/bat246/Inviteandplace` (comment at L29-L31); the API still returns the POD fields, but this page no longer renders them.

## How it works

### Viewer role (L147-L173)
- `useBat246CardAccess("distributors")` gives `isAdmin`: true for the hardcoded BAT 246 owner account or anyone granted the "distributors" card on the Permissions page.
- For non-admins, `GET /backend/bat246/my-dashboard-access` sets `hasDashboardAccess` (senior board seat), `isFirstBase` (from `canApprove`), `salesCredits` (Green Card count 0-2), `atBatFilledCount` and `myCardType`.
- Derived gates:
  - `canApprove` / `canPlaceUsers` = 1st Base player only. Admins, 2nd Base, 3rd Base and Home Plate do **not** get the Action column.
  - `boardNearlyFull` = exactly 6 of 8 At Bat seats filled; approvals pause.
  - `canClickApprove` = 1st Base, board not nearly full, `salesCredits === 2` and no Gold card yet (`myCardType === null`). This is the one-time "Gold Approve": after both Green Cards, the 1st Base player manually places their third referral; once Gold is earned, later referrals go to the Dugout automatically.
- The back link goes to `/games/bat246` (admin), `/games/bat246/dashboard` (dashboard access) or `/games/bat246/boards`.

### Data loading
- Members (L175-L183): cached copy from `getMembersCache()` or `GET /backend/office/bat246/members` (then `setMembersCache()`), for upline lookup.
- All distributor IDs (L185-L196): `GET /backend/bat246/distributors?page=1&limit=50` once, to build `allDistIds` for the upline search.
- Current page (L198-L208): `GET /backend/bat246/distributors?page=<page>&limit=15` (`PAGE_SIZE`). Response shape `{ distributors, total, page, pages }`. The backend (`listDistributors` in `server/bat246/controllers/bat246.controller.ts`) returns only `isQualified: true` records, newest qualification first, and replaces deleted users with a stored snapshot or `null`.

### Nearby upline (L105-L126)
`findNearbyUpline()` walks the office-member upline chain (up to 20 hops, cycle-safe) and returns the first ancestor whose id is in `allDistIds`, i.e. the nearest qualified distributor above this person, preferring the richer member record.

### Search (L216-L240)
Free-text, case-insensitive match on name, email, phone, "city, state, country" and the nearby upline's name/email. Changing the search resets `page` to 1.

### Table (L425-L602)
Columns: Distributor (avatar, name linked to `/games/bat246/distributors/<userId>`, distributor ID badge, email with copy-to-clipboard and a 1.5 s "Copied" hint), Nearby Upline, Phone, Location, Qualified (month + year), and Action when `canApprove`. Grid templates `GRID_9` / `GRID_10` are applied via inline `gridTemplateColumns`, because dynamically built Tailwind arbitrary-value classes would be purged by the JIT scanner. Rows whose `userId` is `null` (orphaned distributor records) are skipped. Loading skeleton, error banner, empty state and Previous/Next pagination are included.

Action cell states:
- "Approved" (disabled) if approved in this session, `isApproved` or `isOnBoard`.
- Active "Approve" if `canClickApprove`.
- Disabled "Approve" with an explanatory tooltip otherwise (board nearly full, 0 or 1 Green Cards, Gold already earned, or both 1st Base positions filled).

### Approve and place flow (L242-L319, modal L606-L674)
1. `handleApprove(userId)` fetches `GET /backend/bat246/distributors/:userId/placement-info` and opens the modal. The response (`PlacementInfo`) holds `boardId`, `boardTrackingNo`, the user's `reservedPosition` with status (`filled` / `blank`) and `reservedPositionStale`, `availablePositions` and `dugoutAvailable`. For a Gold Approve the backend restricts choices to open At Bat seats.
2. `defaultSelection()` pre-selects the reserved seat if it is still open, valid and not stale, otherwise the first available seat.
3. The modal shows the board number, reservation status and a `<select>` of seats labelled by `positionLabel()` ("3rd Base", "2nd Base A", "1st Base C", "At Bat 3", "Dugout").
4. `handleConfirmPlacement()` posts `POST /backend/bat246/distributors/:userId/approve` with `{ boardId, position }` (or `{ boardId, toDugout: true }` for the `__dugout__` sentinel). On failure it re-fetches placement info so the user can pick again with the error shown; on success the row turns "Approved". Server side, this places the user from their reservation, marks the distributor `isApproved`, suppresses the Green Card for non-admin approvers, and may award Gold to the approving 1st Base player.

## Exports
- `default Bat246DistributorsPage()` - the page component.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/bat246/my-dashboard-access` - role and Green Card state of the viewer.
  - `GET /backend/office/bat246/members` - office members with upline (cached 60 s).
  - `GET /backend/bat246/distributors?page=&limit=` - qualified distributors (limit capped at 50 server side).
  - `GET /backend/bat246/distributors/:userId/placement-info` - board seat choices for the approve modal (admin-card holders or 1st Base only).
  - `POST /backend/bat246/distributors/:userId/approve` - place the distributor and mark them approved.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (default `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` as the bearer token; writes to the clipboard for "Copy email".

## Dependencies
- **Internal:**
  - `lib/bat246MembersCache.ts` - shared 60 s cache of the members response, plus types.
  - `lib/hooks/useAmIFounder.ts` - auth loading flag.
  - `lib/hooks/useBat246CardAccess.ts` - whether the viewer is a BAT 246 admin for the "distributors" card (calls `GET /backend/bat246/permissions/mine`).
- **Packages:** `react`, `next/link`, `lucide-react` (icons), `sonner` (`toast.error` on placement-info failures).

## Used by
Not imported by any file; reached as the Next.js route `/games/bat246/distributors` (linked from the BAT 246 dashboard and admin hub). Its loading skeleton is `distributors/loading.tsx`.

## Notes
- **Search only covers the current page.** `filtered` filters `data.distributors`, which holds just the 15 rows of the current page; matches on other pages are not found. The pagination footer then mixes server page bounds (`start`-`end`) with `filtered.length`, so the "of N" figure is the filtered page size, not the grand total.
- `allDistIds` is built from at most 50 distributors (the backend cap), so "Nearby Upline" can skip an older qualified ancestor and show a more distant one or "—".
- The modal comment says Dugout is excluded for 1st Base; the dugout option only appears if the backend includes the `__dugout__` key in `availablePositions`.
- Approval permissions are enforced by the backend; the UI gates are convenience only.
