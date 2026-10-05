# `components/bat246/HomePlateCard.tsx`

> Renders the pentagon-shaped "Home Plate" position card on the BAT 246 board, showing the occupant's flags, name, ID, entry time and earned card stacks.

**Kind:** React component · **Lines:** 235

## Purpose
Home Plate is the top position of a BAT 246 board diamond. It gets its own card shape, an SVG home-plate pentagon, instead of the rectangle that `BaseCard` draws for the other bases. It is shared by the desktop board (`BoardLayout`) and the phone board (`BoardMobileSections`). It only displays data; it makes no network calls.

## How it works
- **Shape.** An absolutely positioned SVG (`viewBox 0 0 280 300`, `preserveAspectRatio="none"`) draws a blue gradient bezel (`hpBezel`) and a light inner fill (`hpFill`), plus a "roof sheen" overlay. `isHighlighted` adds a yellow ring. The minimum height is 215px, which fits a filled slot, so the card stays the same size whether it is occupied or empty.
- **Card buckets.** These follow the same rules as `BaseCard`:
  - The first Gold card is shown alone to the left of the green PPB box. Extra Gold cards join Black and Brown in the right-hand case.
  - Gray cards sit in a top-right cluster, split into free (`freeGrayCards`), 160 (`grayCard160`) and legacy (`grayCards`).
  - `TrophyPill` sits above the gray cluster, scaled ×1.53.
- **Text:**
  - The heading "Home Plate".
  - The flags with `firstName(playerName)`.
  - `Id: distributorId - entryNo`.
  - `D:` and `T:` lines, with the time in `America/New_York`. These are hidden when `mobileCompact` is set.
  - `$ LAYAWAY`, `$ PLAN` and `CPD` badges.
- **PPB green box:**
  - On an occupied slot, a hand-built box always shows at least two places: real green `StackedCard`s, then dashed placeholders. The first card is drawn larger than the second.
  - On an empty slot, it renders `CardCase cards={[]} frame="ppb" minSlots={2}` at ×1.55, the same as every other empty base.
  - The bottom row is shifted -5.5% when the slot is occupied and has no Brown card. The trailing earned case gets its own offsets depending on whether an extra Gold card is present.

## Exports
- `HomePlateCard(props)`: props:
  - `slot: SlotData | null`
  - `isHighlighted?`
  - `className?`
  - `mobileCompact?`: larger text and no date/time.
  - `totalEarning?` and `showCredits?`: accepted but not used.

## Dependencies
- **Internal:**
  - `components/bat246/MiniCard.tsx`: `CardCase`, `StackedCard`, `FlagIcon`, `ppbGreenCards`, `earnedCards` and the gray image constants.
  - `components/bat246/TrophyPill.tsx`: `TrophyPill`.
  - `components/bat246/nameUtils.ts`: `firstName`.
  - `components/bat246/types.ts`: `CardType` and `SlotData`.
  - `lib/utils.ts`: `cn`.
- **Packages:** none (relies on JSX only).

## Used by
- `components/bat246/BoardLayout.tsx`: the desktop diamond, upper left.
- `components/bat246/BoardMobileSections.tsx`: Section A and the enlarged tap popup.

## Notes
- The `CARD_BADGE` constant is unused.
- The SVG gradient ids `hpBezel` and `hpFill` are global to the document. With several Home Plate cards on one page (for example the board plus the enlarged popup), they share one definition, which is harmless because the definitions are identical.
