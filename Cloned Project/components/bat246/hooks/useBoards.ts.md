# `components/bat246/hooks/useBoards.ts`

> React hook that lists BAT246 boards (active and completed), polls every 15 seconds and seeds itself from a sessionStorage cache.

**Kind:** React hook · **Lines:** 62

## Purpose
Feeds the BAT246 boards list page. It returns both in-progress boards and completed boards, optionally limited to the caller's own boards, and avoids a loading spinner on revisits by caching the last response in `sessionStorage`.

## How it works
- Cache key: `bat246_boards`, or `bat246_boards_mine` when `mine` is true. `readCache` / `writeCache` wrap `sessionStorage` in try/catch so private windows or blocked storage just disable caching.
- On first render the cached `{ boards, completed }` (if any) seeds state, and `loading` starts as `false` when the cache hit, `true` otherwise.
- `fetchBoards` reads the JWT from `localStorage["garage_tok"]`, calls `GET ${API}/bat246/boards` (adding `?mine=true` when requested), sets both lists (defaulting to `[]`), rewrites the cache and clears `error`. Failures put the message into `error` and keep the old lists.
- The effect fetches immediately and then every `POLL_MS = 15_000` ms; the interval is cleared on unmount or when `mine` changes.

## Exports
- `useBoards(mine = false)` - returns `{ boards: BoardSummary[], completed: BoardSummary[], loading, error, refetch }`.

## Interfaces
- **Backend endpoints called:** `GET /backend/bat246/boards[?mine=true]` - `requireAuth`; `listBoards` returns `{ boards, completed }`. With `mine=true` the server filters by the caller's email; hidden boards are only included for the BAT246 admin account, and test-mode boards only for requests from a local frontend.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (fallback `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage.garage_tok`; reads/writes `sessionStorage.bat246_boards` and `sessionStorage.bat246_boards_mine`.
- **Background work:** 15-second polling interval.

## Dependencies
- **Internal:** `components/bat246/types.ts` - `BoardSummary` type.
- **Packages:** `react` - `useState`, `useEffect`, `useCallback`, `useMemo`.

## Used by
- `app/(dashboard)/games/bat246/boards/page.tsx` (route `/games/bat246/boards`), which calls `useBoards(effectiveMine)`.

## Notes
- The cache is per tab and per session; it is never invalidated except by the next successful fetch, so a cached list may briefly show boards from a previous account in the same tab after a logout/login.
