# `components/bat246/GameClock.tsx`

> An LED-style "GAME CLOCK" panel that counts down a BAT 246 board's protection period (PP) in hours, minutes and seconds, and shows whether the PP is active, paused, expired or stopped.

**Kind:** React component · **Lines:** 96

## Purpose
Each BAT 246 board has a protection-period deadline (`board.protectionPeriodEnd`). This widget renders that countdown on both the desktop and mobile boards. It can also show a frozen value, for when the backend has paused the PP or the board has already split.

## How it works
- **Paused or frozen.** When `pausedRemainingMs` is not null, it shows that fixed duration once and does not tick.
- **Live.** Otherwise it ticks every second against `targetDate - Date.now()`. When the difference reaches zero or less, it switches to `expired`.
- **Display:**
  - Hours are padded to 3 digits, minutes and seconds to 2.
  - The "GAME CLOCK" header is spread letter by letter across the panel and glows yellow, or red once expired.
  - The digits use the `--font-bat-led` CSS font variable.
- **Status line (first match wins):**
  1. `stopped` gives "PP Stopped".
  2. `expired` gives "PP Expired".
  3. `paused` gives "PP Paused".
  4. Otherwise "PP Active".
- **Split boards.** For a board that has split, callers pass the time remaining at `splitAt` as `pausedRemainingMs` together with `stopped`.

## Exports
- `GameClock({ targetDate, pausedRemainingMs?, stopped? })`:
  - `targetDate: Date`: when the PP ends.
  - `pausedRemainingMs?: number | null`: freezes the display at this value.
  - `stopped?: boolean`: default false; marks a board that has split.

## Interfaces
- **Background work:** a 1-second `setInterval`, cleared on unmount or when a prop changes.

## Dependencies
- **Internal:** `lib/utils.ts`: `cn` is imported but not used.
- **Packages:** `react` (`useEffect`, `useState`).

## Used by
- `components/bat246/BoardLayout.tsx`
- `components/bat246/BoardMobileSections.tsx`
- `app/(dashboard)/games/bat246/components/GameClock.tsx`: a re-export kept for the component's old location.

## Notes
- The inner `Cell` component is redefined on every render. It is harmless here, but it remounts each tick.
