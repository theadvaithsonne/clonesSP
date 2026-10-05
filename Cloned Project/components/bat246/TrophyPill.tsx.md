# `components/bat246/TrophyPill.tsx`

> A small cream "pill" that shows a BAT246 player's permanently earned leaderboard trophies on a board slot, and opens a full-screen trophy viewer when clicked.

**Kind:** React component · **Lines:** 141

## Purpose
BAT246 players can earn three permanent leaderboard trophies: Grand Slam (G), Home Run (H) and Triple (T). On a board they appear as a row of tiny icons next to the player's card, using the same artwork as the leaderboard chips. This file draws that row and the larger trophy viewer. It also exports the canonical display scale, so every board position sizes its trophies the same way.

## How it works
- `TROPHY_ICONS` lists the three trophies in display order G, H, T. Each entry has an image path (`/images/bat246-lb-grandslam.svg`, `/images/bat246-lb-cap.svg`, `/images/bat246-lb-trophy.svg`), a label and an optional extra scale class, used to even out the artwork sizes.
- `TrophyPill` returns `null` when `trophies` is missing or none of G, H or T is truthy. Otherwise it filters `TROPHY_ICONS` down to the earned trophies and renders them in a rounded cream pill, nudged up 6px.
- When `scale !== 1`, the pill is wrapped in a span with `transform: scale(...)`, anchored at the top-right.
- A click on the pill opens the viewer at the first trophy. A click on one icon opens the viewer at that trophy. Both handlers call `stopPropagation()`, so the click doesn't also trigger the slot's own click handler.
- `TrophyModal` (internal) portals to `document.body` at z-index 10000. It shows one trophy at 300px with its label, and Prev / Next buttons with an "i / n" counter when more than one trophy is earned. Escape closes it, and so does a click on the backdrop. The left and right arrow keys page through trophies. The bottom bar copies the style of the card-back modals in `MiniCard.tsx`.

## Exports
- `HOME_PLATE_TROPHY_SCALE` (`1.53`) - the canonical trophy scale, i.e. the size trophies render at on the Home Plate card. Other positions pass this value so the whole board stays consistent.
- `TrophyPill({ trophies?, className?, scale? = 1 })` - renders the earned-trophy pill, or nothing. `trophies` is `SlotData["trophies"]`, i.e. `{ G?: boolean; H?: boolean; T?: boolean }`.

## Dependencies
- **Internal:** `components/bat246/types.ts` - the `SlotData` type for the `trophies` shape; `lib/utils.ts` - the `cn` class merger.
- **Packages:** `react` - `useState` / `useEffect`; `react-dom` - `createPortal` for the modal.

## Used by
- `components/bat246/BaseCard.tsx` and `components/bat246/BoardLayout.tsx` - import `TrophyPill` and `HOME_PLATE_TROPHY_SCALE`.
- `components/bat246/HomePlateCard.tsx` - imports `TrophyPill`.

These render on the BAT246 board page (`/games/bat246/:boardId`).

## Notes
- Two JSDoc blocks sit back to back above `HOME_PLATE_TROPHY_SCALE`. The first one actually describes `TrophyPill`.
- The component is display-only. Trophy data comes from the parent's slot data; this file does no fetching.
- `TrophyModal` takes its first index from `startIdx` only on mount. That is fine as written, because the modal unmounts on close.
