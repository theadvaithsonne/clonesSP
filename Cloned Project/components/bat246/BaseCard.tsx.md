# `components/bat246/BaseCard.tsx`

> Renders one rectangular "base" position card (3rd Base, 2nd Base A/B, 1st Base A-D) on the BAT 246 game board, with the player's flags, name, ID, entry time and earned card stacks.

**Kind:** React component · **Lines:** 301

## Purpose
The BAT 246 board is drawn as a baseball diamond. Every non-Home-Plate base on the diamond uses this card. It is shared by the desktop board (`BoardLayout.tsx`) and the phone board (`BoardMobileSections.tsx`), so both layouts show the same card. The file only displays data: it makes no network calls. The board page fetches the data and passes it in as a `SlotData`.

## How it works
- **Card buckets.** It calls `ppbGreenCards(slot)` and `earnedCards(slot)` from `MiniCard.tsx`, then sorts the cards into groups:
  - Only the **first** Gold card is shown on its own, to the left of the green "PPB" box. It is never stacked into a ×N badge.
  - Any **extra** Gold cards join the Black and Brown cards in the right-hand "earned" case.
  - **Gray** cards go in the top-right corner instead. They are split into free gray (`freeGrayCards`, image `GRAY_FREE_IMAGE`), 160 gray (`grayCard160`, image `GRAY_160_IMAGE`) and legacy `grayCards`. Legacy cards show only when neither of the newer counts is set.
  - `slot.noCards` adds "noCard" placeholders into the PPB box.
- **PPB box.** This box always renders with `minSlots={2}`, even when the slot is empty, so an unoccupied base still shows two dashed placeholders.
- **WARP tab.** On a 1st Base card whose two PPB green slots are both filled, a vertical "WARP" tab is attached to the card's left edge.
- **Trophies.** `TrophyPill` sits above the gray stack. It is counter-scaled by `HOME_PLATE_TROPHY_SCALE / cardsScale` so it always renders at the same size as the Home Plate trophy.
- **Header.** Shows the residence and origin `FlagIcon`s, `firstName(playerName)`, and `Id: <distributorId> - <entryNo>`.
- **Date/Time.** `D:` and `T:` are formatted in US format, with the time in `America/New_York`.
  - 1st Base puts D and T on separate lines. Other bases put them on one row that wraps.
  - The block reserves right padding (40px per gray stack) so the gray cards never cover the time.
  - The block is hidden when `mobileCompact` is set.
- **Status badges.** `$ LAYAWAY`, `$ PLAN` and `CPD` appear when `isLayaway`, `isLayawayPlan` or `isCPD` is set.
- **Auto-fit (two `useLayoutEffect` + `ResizeObserver` loops):**
  1. **Card row.** It adds up the children's `offsetWidth`, compares the total with the card body's width, and lowers `rowScale` from `cardsScale` (down to 0.6 at most) so the stacks don't spill onto neighbouring cards. `offsetWidth` ignores CSS transforms, so the scaling cannot feed back into the measurement.
  2. **Name.** It shrinks the name's font (from 16px down to 9px; from 27px down to 13px in mobile mode) before falling back to truncation with an ellipsis.
- **Position quirks:**
  - "3rd Base" with gray cards gets 6% extra minimum height.
  - On 2nd Base A/B, an occupied slot with no Gold card gets a blank spacer the width of a Gold card, so its row lines up with slots that do have one.
  - Rows on 2nd and 3rd Base are left-aligned when they have earned cards. Rows on 1st Base stay centred.

## Exports
- `BaseCard(props)`: the card component. Props:
  - `label`: the position name. Its text decides layout quirks, e.g. `startsWith("1st")`, `=== "3rd Base"`.
  - `slot: SlotData | null`
  - `isHighlighted`: draws a yellow ring.
  - `className`
  - `minHeight`: default 92.
  - `cardsScale`: default 1; the diamond passes 1.55.
  - `mobileCompact`: larger text and no Date/Time lines.
  - `showCredits`: accepted but not used.

## Dependencies
- **Internal:**
  - `components/bat246/MiniCard.tsx`: `CardCase`, `StackedCard`, `FlagIcon`, the card-bucket helpers and the gray image constants.
  - `components/bat246/TrophyPill.tsx`: `TrophyPill` and `HOME_PLATE_TROPHY_SCALE`.
  - `components/bat246/nameUtils.ts`: `firstName`.
  - `components/bat246/types.ts`: `CardType` and `SlotData`.
  - `lib/utils.ts`: `cn`.
- **Packages:** `react` (`useLayoutEffect`, `useRef`, `useState`).

## Used by
- `components/bat246/BoardLayout.tsx`: the desktop diamond.
- `components/bat246/BoardMobileSections.tsx`: the phone sections and the enlarged tap popups.

Both are rendered from the board page at `/games/bat246/[boardId]`.

## Notes
- The `CARD_BADGE` constant is defined but never used.
- Many pixel offsets and transforms are hand-tuned to a reference design. Small edits can visibly break the alignment between positions.
