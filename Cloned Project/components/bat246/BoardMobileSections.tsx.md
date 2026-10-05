# `components/bat246/BoardMobileSections.tsx`

> The phone version of the BAT 246 game board. It splits the desktop board into four full-screen sections (A, B, C, D) arranged 2×2, which the user swipes between or opens from an overview, with tap-to-enlarge popups for every piece.

**Kind:** React component · **Lines:** 1137

## Purpose
The desktop `BoardLayout` is a fixed-pixel design about 1,900px wide and is unreadable on a phone. The board page (`app/(dashboard)/games/bat246/[boardId]/page.tsx`) renders this component instead whenever `useIsMobileBoard()` reports a phone or portrait tablet. It reuses the desktop pieces so the phone board looks the same:
- the cards: `HomePlateCard`, `BaseCard`, the AT BAT `Slot` and `GameClock`;
- the desktop constants from `BoardLayout.tsx`;
- every desktop modal.

Each card is laid out at its desktop width and scaled down. Nothing in this file is shared back into `BoardLayout`.

## How it works

### Layout model (header comment, L42-L79)
The sections sit in the same 2×2 arrangement as the desktop board:

```
A ⇄ B
⇅   ⇅
C ⇄ D
```

| Section | Contents |
|---|---|
| A | L child chip · "Boards" pill · "Leaderboard" heading (landscape only) · BAT 246 pill · R child chip; the leaderboard; Home Plate |
| B | "Board N" + logo + 8 action tiles; 3rd Base; the POD (to the right in landscape) |
| C | Dugout + 2nd Base A; 1st Base A/B; AT BAT 1-4; "Previous" parent-board link |
| D | 2nd Base B + Hot Box; 1st Base C/D + Game Clock; AT BAT 5-8 |

### Fitting helpers (L84-L227)
- **`DESIGN`.** The desktop pixel width of each card, worked out from the 1552px field, plus fixed widths for AT BAT (220), the clock (176) and the Hot Box (208). `FIELD_CARDS_SCALE` = 1.55 matches the desktop.
- **`FitCard`.** Lays out its child at `designWidth`, scales it to the space available (never above `maxScale`), and reserves the scaled height so the next element doesn't overlap or leave a gap.
- **`FitSection`.** Fits a section to the screen height so it never scrolls. If the content is taller than the screen, it lays the content out at `100/f %` width and scales it by `f`, so the section still spans edge to edge. Spare space is split evenly above and below to centre it vertically. A 1% tolerance stops the measurement oscillating.
- **`FitFill`.** Scales the Game Clock to fill the box it is given (both width and height), pinned to the top-right corner.
- **`useRelatedTracking(board)`.** Caches parent and child tracking numbers in `summaryCache` for the session and fetches missing ones from `GET /backend/bat246/boards/:id/summary`.
- **Small pieces:**
  - `Varsity`: the stroked heading font.
  - `Arrow`: a white chevron button in a 34px (`GUTTER`) strip along the section edge, with an optional `shift` along that edge.
  - `Sheet`: a bottom sheet in portrait, or a centred card in landscape.

### Component state (L331-L425)
- **State:**
  - `openModal` and `invitePos`.
  - `dugoutDetail`, `showAllDugout`, `dugoutSearch`.
  - `podDetail`, `podTeamPopup`.
  - `showHotBox`, `hotBoxAll`, `hotBoxDetail`.
  - `slotPopup`: the enlarged card for a tapped position.
  - `showClock`.
  - `lbPopup`: the enlarged leaderboard tier.
  - `view`: `"overview"` or `"sections"`.
- **Orientation:**
  - On mount it tries `screen.orientation.lock("landscape")`. This only succeeds on Android Chrome in fullscreen or an installed app; failure is expected.
  - In portrait, a fixed "Rotate your phone" cover hides the board. The layout is effectively landscape-first.
- **Opening a board.** Each new `board._id` opens on the **overview**: the full 2×2 grid laid out at 200% size and scaled ×0.5, with large translucent A/B/C/D buttons and a close (X) button.
  - `closeBoard()` calls `router.back()` when the browser has history, otherwise it pushes `/games/bat246/boards`.
  - Tapping a letter calls `openSection(col, row)`: it switches to `"sections"` and jumps, without animation, to that cell of the scroll-snap grid.
  - In sections view, a grid icon (bottom-left) returns to the overview.
- **Moving between sections.** Native swipe on a `snap-both snap-mandatory` scroller, or the gutter arrows, which call `goTo()` with smooth scrolling. Each section has two arrows (A: right + down, B: left + down, C: up + right, D: up + left), each with a hand-placed `shift`.
- **Invite rules.** `hidePreservePosition` and `disablePreservePosition` work exactly as on the desktop: Home Plate, 3rd Base, 2nd Base and AT BAT players get "Without Position" links only, and `mySalesCredits === 0` disables "Preserve Position".

### Pieces (L427-L787)
- **`childChip(id, side)`.** A green chip that links to a child board, or a disabled "`<family>` -      L/R" placeholder for a side that has not split.
- **`tap(label, slot, node, big)`.** Wraps a card so that tapping it opens `slotPopup` with an enlarged desktop rendering, which does include the date and time. Taps on inner buttons or links (green cards, Invite) are ignored, and so are clicks that bubble up from portaled card modals.
- **`field(...)`.** A `BaseCard` with `mobileCompact`, wrapped in `FitCard` and `tap`.
- **`atBat(i)`.** The AT BAT `Slot` with `mobileCompact`. Below it:
  - a "Pending · time left" chip with the buyer's name when a `pendingPlacements` entry exists, or
  - an Invite button when the slot is empty and `canInvite` is set.
- **`lbRow(tier, big)`.** One leaderboard bar coloured by tier (red, orange, purple), with the same name and card rules as the desktop.
  - The G/H/T block is a raised button that opens `lbPopup`.
  - The popup shows the bar enlarged plus written details: Player, Id, a card breakdown (Gold, Green, Black, Brown, Gray), Qualified date and Max cards.
- **`tiles`.** "Board N" heading, logo, a WARP badge, and the 8 `BUTTONS` images in a 4-column grid that opens the modals.
- **`pod`.** The POD artwork with occupant boxes and numbered seat buttons; tapping a seat opens `podDetail`. Shows `podTeamId`.
- **`dugout`.** Minor League heading, siren GIF (hidden once the board has split), an Overflow pill ("+N more" opens the searchable full list), and 8 rows with DUGOUT letters.
  - Rows show `firstNameInitial` or the POD team id.
  - Tapping a row opens a detail sheet: entry, joined time, referrer, flags, and "See all 4 POD team members".
- **`hotBoxPanel`.** Gold, Black, Brown and Gray rows (first 4 on the board). "More" opens a popup with More/Less, and tapping a row opens a detail sheet with the card and its assigned time.
- **Clock variants:**
  - `clock`: inside `FitCard`.
  - `clockPlain`: fitted by `FitFill` in landscape D.
  - `clockEl(4)`: the enlarged popup.
  - On a split board, the clock is frozen at the time remaining at `splitAt`.

### Sections and rendering (L789-L1136)
- The `sections` array holds the A-D layouts. Most use separate portrait and landscape arrangements via Tailwind `landscape:` and `landscape:hidden` variants.
- Each section's content box leaves room for its arrow gutters, with exceptions tuned by the founder (A uses the full height and right edge).
- All overlays render at `z-[9999]`. The rotate cover is at `z-[20000]`.

## Exports
- `BoardMobileSections(props)`: the phone board. Props:
  - `board: BoardData`
  - `highlightPosition?`
  - `isAdmin?`: accepted but not used.
  - `canInvite?`
  - `myPosition?`, `myUserId?`, `mySalesCredits?`
  - `pendingPlacements?: PendingPlacement[]`

## Interfaces
- **Backend endpoints called** (router `server/bat246/routes/bat246.routes.ts` at `/bat246`, `requireAuth`):
  - `GET /backend/bat246/boards/:id/summary`: tracking numbers for the child chips and the Previous link.
  - `GET /backend/bat246/pod-team/:teamId`: the POD team member list.
- **Environment variables:** `NEXT_PUBLIC_API_URL` (falls back to `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage.garage_tok`.
- **External services:** the siren GIF loads from `media.tenor.com`.
- **Browser APIs:** `screen.orientation.lock`/`unlock`, `window.history`, `ResizeObserver`.

## Dependencies
- **Internal:**
  - `BoardLayout.tsx`: `BUTTONS`, the LB constants, the POD geometry, `Slot`, `PosLabel`, `fmtDate`/`fmtTime`, `slotToPodOccupant` and the shared types.
  - `BaseCard.tsx`, `HomePlateCard.tsx`, `GameClock.tsx`, `InviteModal.tsx`
  - `MiniCard.tsx`: `CardCase`, `StackedCard`, `FlagIcon`. `earnedCards` and `ppbGreenCards` are imported but not used.
  - `nameUtils.ts`: `firstNameInitial`.
  - `types.ts`: `BoardData`, `HotBoxEntry`, `SlotData`.
  - The eight `modals/*Modal.tsx` files.
  - `lib/utils.ts`
- **Packages:**
  - `react`
  - `next/link`, `next/navigation` (`useRouter`)
  - `lucide-react`

## Used by
- `app/(dashboard)/games/bat246/[boardId]/page.tsx`: rendered instead of `BoardLayout` when `useIsMobileBoard()` is true, at `/games/bat246/[boardId]`.

## Notes
- The header comment says "Opening a board shows Section A". The code now opens the overview first; Section A is only the cell scrolled to.
- Unlike the desktop, the toolbar modals are not gated on `readOnly`, because this component has no `readOnly` prop. It is only used on the authenticated board page.
- The pixel offsets and `shift` values are hand-placed to the founder's specification, as the comments say.
