# `components/bat246/Bat246Branding.tsx`

> An invisible client component that switches the browser-tab favicon and title to "BAT 246" while the user is in the BAT 246 office or on the bat246.com domain.

**Kind:** React component · **Lines:** 85

## Purpose
The app has one global `app/favicon.ico` and one root metadata title. BAT 246 is a separately branded "office" within Garage, and it also has its own domain (bat246.com). This component edits the `<head>` tags that the root layout already emitted. It does this whenever the session is scoped to the BAT 246 office, or the page is on a bat246.com host (including the signed-out login pages). It renders nothing.

## How it works
- `active = useIsBat246Office() || useIsBat246Domain()`. Both hooks come from `lib/bat246Office.ts`.
- While `active` is true, an effect runs `apply()`:
  - It finds every `link[rel~="icon"]` and `link[rel="apple-touch-icon"]`, records each one's original `href` in a `Map`, and rewrites the `href` to `BAT246_FAVICON_SRC`.
  - If the page has no icon link at all, it appends one.
  - It saves the original `document.title`, then sets the title to `BAT246_DISPLAY_NAME`.
- **Why the observer.** Next.js streams its own metadata after hydration and again on client-side navigations, which would undo a one-time swap. A `MutationObserver` on `document.head` (child list, subtree, character data, `href` attributes) re-runs `apply()` on every change. `apply()` only writes when a value differs, so its own writes settle immediately instead of looping.
- **Cleanup.** When `active` becomes false or the component unmounts, it disconnects the observer, restores every original `href`, removes the link it added, and restores the original title.

## Exports
- `default Bat246Branding()`: renders `null`; side effects only.

## Interfaces
- **Browser storage / cookies:** none directly. Office scoping is decided inside `lib/bat246Office.ts`.

## Dependencies
- **Internal:** `lib/bat246Office.ts`: `BAT246_DISPLAY_NAME`, `BAT246_FAVICON_SRC`, `useIsBat246Domain` and `useIsBat246Office`.
- **Packages:** `react` (`useEffect`).

## Used by
- `app/layout.tsx`: mounted once in the root layout, so it covers every route, including the bat246.com login and verify pages.
