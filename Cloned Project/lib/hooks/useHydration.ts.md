# `lib/hooks/useHydration.ts`

> A tiny hook that returns `false` during server rendering and the first client render, then `true` once the component has mounted in the browser.

**Kind:** React hook · **Lines:** 15

## Purpose
Some UI depends on browser-only state, such as zustand stores persisted to localStorage (for example `store/authStore.tsx`'s `auth-storage`), `window` or the session token. Rendering it during SSR, or before hydration, causes mismatches between server and client markup. Components use this flag to render a placeholder until hydration has finished.

## How it works
State starts as `false`; an effect with an empty dependency list sets it to `true` after the first client render. Effects never run on the server, so server output always sees `false`.

## Exports
- `useHydration(): boolean` - `true` once mounted on the client.

## Dependencies
- **Packages:** `react` - `useState`, `useEffect`.

## Used by
- `app/(dashboard)/layout.tsx` - the dashboard shell waits for hydration before rendering store-dependent UI.

## Notes
- The file begins with a blank line before `"use client"`. Next.js still accepts the directive there because only whitespace precedes it.
- Each component using the hook re-renders once after mount.
