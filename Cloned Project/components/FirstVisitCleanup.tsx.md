# `components/FirstVisitCleanup.tsx`

> Client component that, once per browser (per cleanup version), wipes every piece of client-side storage the site can reach, then records that it has done so.

**Kind:** React component · **Lines:** 102

## Purpose
Mounted in the root layout, this component exists to give every browser a clean slate the first time it loads the app after a cleanup version is introduced. It was designed to flush stale auth tokens, persisted stores (for example the `auth-storage` zustand cache) and old service-worker caches left behind by earlier builds. It renders nothing.

## How it works
- A single `useEffect` with an empty dependency array runs once on mount (client only).
- It reads `localStorage["garage_initial_cleanup_done"]`. If the value equals `CLEANUP_VERSION` (`"v1"`), it logs and stops.
- Otherwise it performs, in order:
  1. `localStorage.clear()`. A commented-out `itemsToPreserve` map shows how specific keys (such as `auth_token`) could be kept; currently nothing is preserved.
  2. Expires every cookie visible to `document.cookie` three ways: without a domain, with `domain=<hostname>`, and with `domain=.<last two labels of hostname>`. HttpOnly cookies cannot be cleared from JavaScript and survive.
  3. `sessionStorage.clear()`.
  4. Deletes every IndexedDB database returned by `indexedDB.databases()` (where the browser supports it).
  5. Deletes every Cache Storage entry (`caches.keys()`).
  6. Writes the marker `garage_initial_cleanup_done = "v1"`.
- On any thrown error it still tries to write the marker so the cleanup is not retried on every load.
- All steps log with a `[CLEANUP]` prefix.

## Exports
- `default FirstVisitCleanup()` - renders `null`; performs the one-time cleanup as a side effect.

## Interfaces
- **Browser storage / cookies:** clears all `localStorage`, `sessionStorage`, readable cookies, IndexedDB databases and Cache Storage; writes `localStorage` key `garage_initial_cleanup_done`.

## Dependencies
- **Packages:** `react` - `useEffect`.

## Used by
- `app/layout.tsx` (root layout), so it runs on every route of the Next.js app, including `/garage-admin`.

## Notes
- Bumping `CLEANUP_VERSION` forces a full wipe for every user on their next visit, logging everyone out (auth tokens, `garage_admin_token`, persisted stores) and discarding drafts and preferences. Treat it as a deliberate, user-visible action.
- The IndexedDB and Cache deletions are fire-and-forget; the marker is written before they finish.
- The "root domain" heuristic (last two hostname labels) is wrong for multi-part TLDs such as `.co.uk`; harmless here, but worth knowing.
