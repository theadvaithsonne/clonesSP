# `lib/hooks/useCountdown.ts`

> A hydration-safe hook that ticks once a second towards a target date, returns days/hours/minutes/seconds plus a compact label, and calls an optional `onExpire` callback exactly once when the time runs out.

**Kind:** React hook · **Lines:** 101

## Purpose
Event detail pages and the webinar "session not started yet" card show a live countdown to a start time. A live clock differs between server render and client hydration, so this hook deliberately returns `null` until it runs on the client, and callers render a placeholder meanwhile.

## How it works
- **Target normalisation.** Accepts a `Date`, a millisecond number, a date string, or `null`/`undefined`. Non-finite results (for example an unparseable string) are treated as "no target", and the hook returns `null`.
- **`computeParts(target)`** clamps remaining ms at 0 and splits it into `days`, `hours`, `minutes`, `seconds`. `label` drops empty leading units: `"2d 04h 13m"` (no seconds once days are shown), `"4h 13m 09s"`, `"13m 09s"`, `"09s"`.
- **Ticking.** An effect keyed only on the numeric target ticks immediately, then every 1000 ms via `setInterval`, and clears the interval on change or unmount.
- **`onExpire`.** Kept in a ref so passing an inline arrow does not reset the interval on every parent render. `firedForRef` records which target already fired, so the callback runs once per target. A target already in the past fires on mount, and changing the target re-arms it.

## Exports
- `default useCountdown` - same function as the named export.
- `useCountdown(targetDate: Date | string | number | null | undefined, onExpire?: () => void): CountdownParts | null`.
- `interface CountdownParts` - `{ total, days, hours, minutes, seconds, isExpired, label }`; `total` is the remaining ms, clamped at 0.

## Dependencies
- **Packages:** `react` - `useState`, `useEffect`, `useRef`.

## Used by
- `components/dashboard/inlineApps/events/EventDetailView.tsx`
- `components/webinar/SessionNotStartedCard.tsx`

## Notes
- Remaining time uses the client clock (`Date.now()`); a skewed device clock shows a skewed countdown.
- After expiry the interval keeps running (each tick returns all zeros) until the target changes or the component unmounts.
