# `components/affiliate/globe/hooks/useAffiliateGlobe.ts`

> React hook that loads and navigates the logged-in user's referral (downline) tree for the affiliate globe: focused user, paginated direct referrals, breadcrumb history, server-side search, email deep search and map markers.

**Kind:** React hook · **Lines:** 459

## Purpose
The affiliate globe lets a user start at themselves and "drill down" through their downline one level at a time, seeing each level's direct referrals on a globe and in a list. This hook holds all of that state and talks to the backend `/affiliate` API so that `AffiliateGlobeView` and its children stay presentational.

## How it works
### State
- `focusedUser` - the user whose direct referrals are being shown.
- `directChildren` - that user's direct referrals (with fallback coordinates assigned).
- `navigationHistory` - breadcrumb path from the root (the logged-in user) to `focusedUser`.
- `isLoading`, `isLoadingMore`, `error`.
- Pagination: `currentPage`, `hasMore`, `totalCount`.
- `searchQuery` (name/email/location filter on the current level), `isEmailSearching`, `emailSearchError`.
- `currentUserIdRef` - mirrors the focused id; written but not read anywhere.

### Initial load (`initializeWithCurrentUser`, L45-L86)
On mount it calls `GET /backend/affiliate/user-info/me` (adding `?orgId=` from `localStorage.garage_org_id` when present). The backend treats `me` as the caller's id from the JWT. The returned user is normalised:
- offices with an empty name or a name of "unknown" / "unknown organization" are dropped, and `officesJoined` is recomputed from the survivors;
- `hasChildren` is derived from `directReferrals > 0`.
The user becomes both `focusedUser` and the single entry of `navigationHistory`, then its first page of children is loaded. Failure sets `error = "Failed to load affiliate network"`. This function is also returned as `refresh`.

### Loading children (`fetchDirectChildren`, L88-L132)
`GET /backend/affiliate/direct-children/:userId?page=&limit=50[&search=][&orgId=]`. Every child is passed through `assignFallbackCoordinates` so it can be placed on the globe. With `append` the page is concatenated (infinite scroll); otherwise it replaces the list. Pagination state comes from `response.pagination`. Errors set `error = "Failed to fetch referrals"`, which makes the view show its full-screen error.

### Navigation
- `selectUser(userId)` - clears search, fetches `user-info/:userId`, normalises it the same way, pushes it onto `navigationHistory`, makes it focused and loads its first page of children.
- `goBack()` - pops the last history entry and refocuses the previous user (re-fetching children; user info is reused from history).
- `goToRoot()` - collapses history to the first entry.
- `navigateToHistoryIndex(index)` - truncates history to `index` (breadcrumb click); ignored for the current (last) index.
- `loadMoreChildren()` - fetches `currentPage + 1` with the current search and appends; no-op while loading or when `hasMore` is false.
- `searchChildren(query)` - sets `searchQuery` and reloads page 1 server-side with `search`.

### Email deep search (`searchByEmail`, L274-L351)
Calls `GET /backend/affiliate/search-downline-by-email/:rootUserId?email=[&orgId=]`, where `rootUserId` is the first history entry. The backend finds the user by exact (lower-cased) email, walks up its `referredBy` chain and only reports it as found if the chain reaches the root. Results:
- not `success` -> "Search failed";
- not `found` -> the server message or "Not found in your network";
- `isSelf` -> jump back to the root;
- `navigationPath` -> the whole path becomes the new `navigationHistory`, the last entry is focused and its children are loaded.
Returns `{ success: true }` or `{ error }` so the sidebar can clear its input on success.

### Markers (`markersData`, L355-L411)
A memo that turns the focused user (`isFocused: true`) and every direct child into `GlobeMarkerData`, skipping anyone whose coordinates are still invalid after `assignFallbackCoordinates`.

### Profile overlay
`openProfileOverlay(userId)` and `closeProfileOverlay()` do not hold state; they dispatch a window `CustomEvent("affiliate-profile:open", { detail: { userId } })` (with `userId: null` to close). `app/(dashboard)/layout.tsx` listens for it and mounts `AffiliateProfileOverlay`.

## Exports
- `useAffiliateGlobe()` - returns `{ focusedUser, directChildren, markersData, navigationHistory, isLoading, isLoadingMore, error, selectUser, goBack, goToRoot, navigateToHistoryIndex, refresh, hasMore, totalCount, loadMoreChildren, searchQuery, searchChildren, searchByEmail, isEmailSearching, emailSearchError, openProfileOverlay, closeProfileOverlay }`.

## Interfaces
- **Backend endpoints called** (all in `server/routes/affiliate.ts`, mounted at `/affiliate` in `server/app.ts`):
  - `GET /backend/affiliate/user-info/:userId` (or `me`) - `requireUserOrGarageAdmin`; user profile, offices, purchases, referral counts, referrer.
  - `GET /backend/affiliate/direct-children/:userId` - `requireAuth`; users whose `referredBy` is `:userId`, paginated (server caps `limit` at 100) and searchable.
  - `GET /backend/affiliate/search-downline-by-email/:userId` - `requireAuth`; exact-email lookup constrained to the `:userId` subtree.
- **Browser events:** dispatches `affiliate-profile:open`.
- **Browser storage:** reads `garage_org_id` from localStorage (sent as `orgId`); the JWT is attached by `api()` from `lib/api.ts`.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` fetch wrapper (base `NEXT_PUBLIC_API_URL`, bearer token); `../types` - types, `assignFallbackCoordinates`, `isValidCoordinate`.
- **Packages:** `react` - `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`.

## Used by
- `components/affiliate/globe/AffiliateGlobeView.tsx`
- `components/affiliate/globe/index.ts` (re-export)

## Notes
- **Authorisation lives on the server, and is loose.** The `:userId` in `direct-children` and the root id in `search-downline-by-email` come from the client. From reading those handlers, neither compares the id against the caller's own id, so the "your network" boundary is enforced only by the client starting at `me`. Worth reviewing before exposing more data through these endpoints.
- `selectUser` is memoised with an empty dependency list; it only uses setters and `fetchDirectChildren`, so this works, but `fetchDirectChildren` is a plain function recreated each render.
- Any error from a children fetch sets the global `error`, which replaces the whole view; there is no per-action error display except for the email search.
- The same "filter out unknown offices" block is duplicated in `initializeWithCurrentUser`, `selectUser` and `AffiliateProfileOverlay.tsx`.
