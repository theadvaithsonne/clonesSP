# `components/bat246/hooks/useBoard.ts`

> React hook that loads one BAT246 board from the backend and re-polls it every 10 seconds.

**Kind:** React hook · **Lines:** 43

## Purpose
The BAT246 board page needs a near-live view of a single board (who sits on Home Plate, the bases, At Bat and the Dugout, the warp level and so on). There is no socket feed for board state, so this hook polls the board endpoint on an interval and exposes the latest `BoardData` with loading and error flags.

## How it works
- `fetchBoard` (memoised on `boardId`) does nothing when `boardId` is null. Otherwise it reads the JWT from `localStorage["garage_tok"]` (guarded for SSR) and calls `GET ${NEXT_PUBLIC_API_URL}/bat246/boards/:boardId` with a `Bearer` header.
- A non-2xx response throws `HTTP <status>`; the message lands in `error`. On success `data.board` goes into state and `error` is cleared. `loading` is set to false in `finally`.
- The effect sets `loading` to true, fetches immediately, then starts a `setInterval` at `POLL_MS = 10_000`. The interval is cleared on unmount or when `boardId` changes.
- After a failed poll the previous `board` value is kept, so the UI keeps showing stale data plus an error.

## Exports
- `useBoard(boardId: string | null)` - returns `{ board: BoardData | null, loading: boolean, error: string | null, refetch: () => Promise<void> }`.

## Interfaces
- **Backend endpoints called:** `GET /backend/bat246/boards/:id` - `requireAuth`; the controller (`getBoard` in `server/bat246/controllers/bat246.controller.ts`) may first auto-promote Dugout players when the Protection Period has expired, then returns `{ board }` or 404.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (falls back to `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage.garage_tok`.
- **Background work:** 10-second polling interval.

## Dependencies
- **Internal:** `components/bat246/types.ts` - `BoardData` type.
- **Packages:** `react` - `useState`, `useEffect`, `useCallback`.

## Used by
- `app/(dashboard)/games/bat246/[boardId]/page.tsx` (route `/games/bat246/[boardId]`).

## Notes
- Because the GET may trigger a server-side Dugout promotion, every poll can have a write side effect on the backend.
- The `http://localhost:4000` fallback only suits a standalone backend; in the combined app `NEXT_PUBLIC_API_URL` must point at `<origin>/backend`.
