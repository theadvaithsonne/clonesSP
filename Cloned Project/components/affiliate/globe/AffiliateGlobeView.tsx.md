# `components/affiliate/globe/AffiliateGlobeView.tsx`

> Top-level screen of the affiliate network explorer: wires the `useAffiliateGlobe` hook to a Mapbox globe and a referral sidebar in a responsive two-pane layout.

**Kind:** React component · **Lines:** 111

## Purpose
This is the component other pages drop in to show "my referral network on a globe". It owns no data logic itself; it calls `useAffiliateGlobe()` and passes the relevant state and callbacks to `AffiliateGlobeMap` (left, three quarters on desktop) and `AffiliateAccordionSidebar` (right, one quarter on desktop).

## How it works
- **Data:** destructures from `useAffiliateGlobe()` the focused user, direct children, marker data, navigation history, loading flags, error, navigation actions (`selectUser`, `goBack`, `navigateToHistoryIndex`, `refresh`), pagination (`hasMore`, `totalCount`, `loadMoreChildren`), name search (`searchQuery`, `searchChildren`), email deep search (`searchByEmail`, `isEmailSearching`, `emailSearchError`) and `openProfileOverlay`.
- **Error state:** if the hook reports an `error`, the whole view is replaced by the message and a "Try Again" button that calls `refresh` (re-initialises from the logged-in user).
- **Layout:**
  - Desktop (`md` and up): map on the left (`md:w-3/4`), sidebar on the right (`md:w-1/4`) with a left border.
  - Mobile: CSS `order` flips them so the sidebar comes first and the map sits below at a fixed 200px (250px on `sm`) height. A mobile-only button toggles `mapExpanded`, which makes the map container `fixed inset-0 z-50` (full screen) and swaps the `Maximize2`/`Minimize2` icon.
- **Wiring:** clicking a marker's "View Network" (`onMarkerClick`) or a sidebar row (`onSelectUser`) both call `selectUser`, which drills into that user's downline. "View Profile" anywhere calls `openProfileOverlay`, which broadcasts a window event handled by the dashboard layout.

## Exports
- `AffiliateGlobeView()` - no props; renders the full explorer for the current user.

## Interfaces
- **Backend endpoints called (indirectly via the hook):** `GET /backend/affiliate/user-info/:userId`, `GET /backend/affiliate/direct-children/:userId`, `GET /backend/affiliate/search-downline-by-email/:userId`.
- **Browser events:** profile opens are dispatched as `affiliate-profile:open` by the hook.

## Dependencies
- **Internal:** `./hooks/useAffiliateGlobe` - state and data; `./AffiliateGlobeMap` - globe; `./AffiliateAccordionSidebar` - list, search, breadcrumbs.
- **Packages:** `react` (`useState`), `lucide-react` (`Maximize2`, `Minimize2`).

## Used by
- `components/affiliate/globe/index.ts` (re-export), consumed by `components/dashboard/AffiliatePageNew.tsx`, which renders `<AffiliateGlobeView />` in two places.

## Notes
- `closeProfileOverlay` is destructured from the hook but never used here, and the hook's `goToRoot` is not used at all.
- `isLoadingMore` is passed to the sidebar only; the map receives only `isLoading`.
