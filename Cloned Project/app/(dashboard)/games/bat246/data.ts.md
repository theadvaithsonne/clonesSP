# `app/(dashboard)/games/bat246/data.ts`

> Static TypeScript types and one hardcoded sample board (`BOARD_1`) describing the shape of a BAT 246 game board; mock data left over from the UI prototype.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 107

## Purpose
Early in BAT 246 development the board UI was built against fake data before the backend existed. This file holds those prototype types and a single filled-in board so the layout (At Bat, 1st Base, 2nd Base A/B, 3rd Base, Home Plate, Dugout, Hot Box, Leader Board) could be rendered. The live board pages now load real boards from the backend, and nothing imports this module any more.

## How it works
- `CardType` is the union of card colours `"Gold" | "Black" | "Brown" | "Gray"`.
- `PlayerSlot` is one seat on the board: entry number, player name/email, date/time strings, optional `salesCredits` (commented as 1st-base-only, 0-2) and optional earned `cards`.
- `HotBoxEntry` records a card award (card type, player, date).
- `LeaderBoardRow` is one leaderboard tier with id `"G" | "H" | "T"` (Grand Slam / Home Run / Triple), current and max earnings, and a colour.
- `BoardData` documents the board geometry in its comments: 8 At Bat slots (two under each of 1BA-1BD), 4 1st Base slots (1BA+1BB under 2nd Base A, 1BC+1BD under 2nd Base B), one slot each for 2nd Base A, 2nd Base B, 3rd Base and Home Plate, 8 dugout slots, plus the hot box and leader board.
- A private constant `PP_END` fixes the protection-period end at `2026-05-23T05:01:00Z`.
- `BOARD_1` fills every section with fictional players (gmail-style placeholder addresses), leaving one At Bat seat and five dugout seats `null` (empty).

## Exports
- `type CardType` - card colour union.
- `interface PlayerSlot` - one board seat.
- `interface HotBoxEntry` - one card award in the hot box.
- `interface LeaderBoardRow` - one leaderboard tier.
- `interface BoardData` - full board shape.
- `const BOARD_1: BoardData` - the sample board "1 of 4 Board Basics", tracking number `1-2000`, minor league amount 600.

## Dependencies
None.

## Used by
Appears unused: no file in the project imports it (a search for `BOARD_1` finds only this file).

## Notes
- Dead prototype code; safe to treat as historical reference for the board layout, not as a source of truth for the backend `Bat246Board` model.
- It still uses the old "salesCredits" field name in `PlayerSlot`; current product language calls these "Green Cards".
