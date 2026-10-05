# `app/(dashboard)/games/bat246/[boardId]/page.tsx`

> The BAT246 single-board page: loads one board, works out the viewer's role on it, and renders either the desktop `BoardLayout` (with a custom page frame and WARP progress header) or the mobile `BoardMobileSections`.

**Kind:** Next.js page · **Lines:** 426 · **Route:** `/games/bat246/[boardId]`

## Purpose
In the BAT246 game every "board" is a baseball-diamond-shaped tree of player slots (Home Plate, 3rd Base, 2nd Base A/B, four 1st Base slots, eight At Bat slots, a dugout and a POD). This page is where a player or the admin looks at one board by its Mongo `_id`. It is a client component (`"use client"`) under the `(dashboard)` route group, so the URL is `/games/bat246/<boardId>`. Most of the board drawing lives in `components/bat246/BoardLayout.tsx`; this page fetches the viewer-specific data that layout needs, decides desktop vs mobile, and draws the page chrome around the board.

## How it works

### Data loading (L20-L81)
- `boardId` comes from the async `params` promise, unwrapped with React's `use()`.
- `useBoard(boardId)` fetches `GET /backend/bat246/boards/:id` and re-polls it every 10 seconds, returning `{ board, loading, error }`.
- `useAmIFounder()` supplies `userData` (email, orgName) from `/auth/me`.
- **Admin check:** `isAdmin` is true only when the logged-in email (lower-cased) equals the hardcoded `ALAN_K_EMAIL` constant (L16). There is no role lookup; this one email is the board admin.
- **My role (L40-L55):** calls `GET /backend/bat246/boards/:id/my-role`. The backend finds the caller's `Bat246Player` and checks every slot on the board; it returns `canInvite: true` and the slot name (`homePlate`, `thirdBase`, `secondBaseA/B`, `1stA`-`1stD`, `atBat-0`..`atBat-7`) when the player sits on this board. The page then decodes the JWT payload with `atob` (no verification, display only) to get `myUserId`.
- **Green Cards (L58-L64):** `GET /backend/bat246/my-dashboard-access` returns `salesCredits`, stored as `mySalesCredits`. The comment explains it gates the "Preserve Position" option in the invite modal for 1st Base users. (In the UI these are called "Green Cards"; the field name is still `salesCredits`.)
- **Pending placements (L67-L74):** only when the viewer is the admin or is on the board, calls `GET /backend/bat246/boards/:id/pending-placements`. The backend returns unplaced, unexpired `Bat246PendingPlacement` rows (user name/email, position, referrer, purchase and expiry dates) that `BoardLayout` shows as At Bat tooltips.
- **Org gate (L76-L81):** once auth has loaded, if the user's current org name is not one of `BAT246_ORGS` (`"TestCompany XYZ"`, `"Bat246"`, `"BAT 246"`) the page redirects to `/workspace`. If `orgName` is empty the redirect does not fire.

All requests send `Authorization: Bearer <garage_tok>` read from `localStorage`. Fetch errors are swallowed silently; the related state just stays at its default.

### Render states (L197-L234)
- `loading` shows a spinner ("Loading board…").
- `error` or no board shows "Board not found" with a link back to `/games/bat246`.
- `useIsMobileBoard()` (true below 1024px, via `matchMedia`) returns early with `<BoardMobileSections>`, the board as four swipeable screens, passing the same props the desktop layout gets. All the measuring effects below no-op on mobile because the elements they look for exist only in the desktop markup.

### Desktop layout measurements (L83-L195)
Three effects measure the DOM with `getBoundingClientRect`, re-measure on `ResizeObserver` and `window.resize`, and re-run whenever `board` changes. Each one only updates state when the value actually moves, which avoids render loops.
- **WARP bar centring (L109-L147):** measures the header, the blue Bat246 button (`bat246BtnRef`) and `#bat246-nav-right-btn` (portaled in by `BoardLayout`). It centres the WARP bar between the two buttons and caps its width (`maxWidth`, minimum 320px, 12px gap) so it never slides over the Bat246 button on narrow screens. Without a right nav button it falls back to a 48% centre.
- **POD edges (L148-L171):** measures `#bat246-pod-art` (relative to the scroll host `frameHostRef`) so the frame can notch around the POD artwork in the top-right corner.
- **Dugout edges (L172-L195):** measures `#bat246-dugout-panel` so the frame's left bar leaves a gap where the dugout panel sits.

### Page frame overlay (L250-L316)
A full-size, `pointer-events-none` overlay at `z-[9999]` draws an 8px border (black bars with a 1.1px white line on top) around the page. It is drawn as two layers, all black bars first and then all white lines, so corners render as clean mitres. The frame skips the top and right edges behind the POD and instead follows the POD's left and bottom edges (falling back to `80%` / `23%` when the POD is not measured). The left bar is split around the dugout panel, with a 23px buffer above (`DUGOUT_GAP_TOP_BUFFER`) because the panel's background bleeds above its measured box. The vertical notch line is deliberately reversed (white facing away from the POD).

### Header (L317-L410)
- A white background strip that covers 84% of the header width, kept as a separate layer so percentage maths elsewhere stays relative to the full header.
- `#bat246-nav-left` and `#bat246-nav-right`: empty placeholder divs that `BoardLayout` fills with child-board navigation arrows using `createPortal`.
- A yellow "Boards" pill linking to `/games/bat246/boards`, and a blue Bat246 logo pill linking to `/games/bat246`, which does the role-based redirect itself.
- **WARP 1-4 progress chevrons:** the count is `board.firstBase.filter(slot => ppbGreens(slot) >= 2).length`, the number of 1st Base slots holding both green PPB cards. This is the same rule `BaseCard` uses to show the WARP tab, so the bar matches the board even when the stored `warpCount` was never backfilled. Active chevrons get a blue-to-green gradient; each chevron is a `clip-path` polygon over a white stroke copy.

### Board (L412-L422)
`<BoardLayout>` inside a `min-w-[860px]` container, with `board`, `isAdmin`, `canInvite`, `myPosition`, `myUserId`, `mySalesCredits` and `pendingPlacements`.

## Exports
- `default BoardPage({ params }: { params: Promise<{ boardId: string }> })` - the page component.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/bat246/boards/:id` - board data (via `useBoard`, polled every 10s).
  - `GET /backend/bat246/boards/:id/my-role` - `{ canInvite, position }` for the caller.
  - `GET /backend/bat246/my-dashboard-access` - `{ hasAccess, canApprove, salesCredits, atBatFilledCount, myCardType }`; only `salesCredits` is used here.
  - `GET /backend/bat246/boards/:id/pending-placements` - `{ placements }`.
  - `GET /backend/auth/me` - via `useAmIFounder`, for email and org name.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (default `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` (JWT).

## Dependencies
- **Internal:**
  - `components/bat246/hooks/useBoard.ts` - board fetch and polling.
  - `components/bat246/BoardLayout.tsx` - desktop board renderer; also the `PendingPlacement` type.
  - `components/bat246/BoardMobileSections.tsx` - mobile board.
  - `components/bat246/hooks/useIsMobileBoard.ts` - `(max-width: 1023px)` media query.
  - `components/bat246/MiniCard.tsx` - `ppbGreens(slot)` (clamps `salesCredits` to 0-2).
  - `lib/hooks/useAmIFounder.ts` - current user email and org.
- **Packages:** `next` (`Link`, `useRouter`), `react` (`use`, hooks, `CSSProperties`).

## Used by
Not imported by any module. It is reached as the Next.js route `/games/bat246/<boardId>`, linked from the boards list (`/games/bat246/boards`), from the child-board nav arrows inside `BoardLayout`, and from other BAT246 pages.

## Notes
- **Hardcoded admin identity:** the admin is decided client-side by comparing against one email address. Real authorisation has to happen on the backend; here it only changes what the UI shows.
- The JWT payload is decoded without verification. That is fine for display, but never trust `myUserId` for anything security-sensitive.
- The org allow-list is duplicated in `boards/page.tsx` (the comment on L14 points there); keep the two in sync.
- The `my-role` endpoint returns only the first slot the player holds on the board.
- The DOM element ids `bat246-pod-art`, `bat246-dugout-panel`, `bat246-nav-left`, `bat246-nav-right` and `bat246-nav-right-btn` are a contract with `BoardLayout`. Renaming them there silently breaks the frame and WARP alignment here.
