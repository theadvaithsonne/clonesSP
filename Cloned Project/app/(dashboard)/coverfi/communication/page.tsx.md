# `app/(dashboard)/coverfi/communication/page.tsx`

> Index route that immediately redirects `/coverfi/communication` to the Templates tab.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/communication`

## Purpose
The Communication area has no overview screen of its own. Visiting its root URL should open the first tab, so this file forwards the visitor there.

## How it works
`CommunicationIndex()` calls `redirect("/coverfi/communication/templates")` from `next/navigation`. In a server component this throws Next's redirect signal, so the page never renders anything. The browser receives a redirect (or a client-side navigation, if the visit started from in-app navigation).

## Exports
- `default CommunicationIndex()` - redirects and never returns JSX.

## Dependencies
- **Packages:** `next` (`redirect` from `next/navigation`).

## Used by
No file imports it. Next.js serves it when someone opens `/coverfi/communication` directly.
