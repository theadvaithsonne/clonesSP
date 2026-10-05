# `lib/hooks/use-debounced-value.ts`

> A generic hook that returns a copy of a value that only updates after the value has stopped changing for a delay (250 ms by default).

**Kind:** frontend library · **Lines:** 20

## Purpose
Search boxes should not fire a request on every keystroke. This hook replaces a `useState` + `useEffect(setTimeout)` pattern that, per its comment, had been copied into several places (EarnGPT product grid, product-browser dialog, contact picker) with drifting delays of 200 and 250 ms. 250 ms is the standard default.

## How it works
It keeps its own state, initialised to `value`. Whenever `value` or `delay` changes it starts a timer that copies the new value into state after `delay` ms; the effect cleanup clears the pending timer, so only the last change in a burst is applied.

Side effects that should follow a new search term (for example `setPage(1)`) belong in the caller, in a `useEffect` that depends on the debounced value.

## Exports
- `useDebouncedValue<T>(value: T, delay = 250): T` - returns the debounced value.

## Dependencies
- **Packages:** `react` - `useState`, `useEffect`.

## Used by
- `app/garage-admin/(admin-dashboard)/networkchains/subscriptions/page.tsx`

## Notes
- The first render returns the initial value immediately; only later changes are delayed.
