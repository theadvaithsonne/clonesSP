# `components/bat246/BoardLayout.tsx`

> The desktop BAT 246 game board: a stadium-styled baseball diamond with the leaderboard, POD gondola, 8-button toolbar, every board position, the Minor League dugout, the Hot Box and the Game Clock. It also exports shared constants and sub-components that the mobile board reuses.

**Kind:** React component · **Lines:** 1500

## Purpose
BAT 246 is a board-based placement game. Every board is a "diamond" with these positions:

| Position | Count |
|---|---|
| Home Plate | 1 |
| 3rd Base | 1 |
| 2nd Base A/B | 2 |
| 1st Base A-D | 4 |
| AT BAT slots | 8 |

Each board also has:
- an overflow "dugout" (the Minor League),
- a 3-seat POD,
- a G/H/T leaderboard,
- a "Hot Box" of recently earned cards,
- a protection-period (PP) countdown.

This file draws all of that from a single `BoardData` object. The page that hosts it fetches the board, so this component makes only a few small read calls of its own.

The page-level component `BoardMobileSections.tsx` replaces this layout on phones and portrait tablets. It imports this file's exported constants and helpers so both layouts stay consistent.

## How it works

### Shared helpers and constants (L25-L356)
- **Unused leftovers.** `CARD_BADGE`, `HOT_BOX_ROW`, `BC_SQ` and the `Badge` component are no longer used.
- **Formatters:**
  - `fmtDate` gives MM/DD/YYYY.
  - `fmtTime` gives a 12-hour time with seconds in `America/New_York`.
  - The private `fmtDateDMY` gives DD-MM-YYYY, used only in the POD windows.
  - All three return "—" for an empty value.
- **`Slot` (L78-L197).** The AT BAT position card:
  - The usual blue bezel, gray and trophy cluster in the top-right, flags, `firstName`, `Id: distributorId - entryNo`, and D/T.
  - Layaway, Plan and CPD badges.
  - Gold card pinned bottom-left at ×1.55, then green, black and brown `StackedCard`s.
  - An empty slot shows placeholder `Id:` and `D: T:` labels.
  - `mobileCompact` makes the text larger and hides the date and time.
- **`PosLabel`.** The small blue tab label above a card, e.g. "AB1".
- **`BUTTONS`.** The 8 toolbar actions, each with an icon, label, number and SVG image under `/public/images/bat246-btn-*.svg`:
  - `layaway`, `snapback`, `message` (shown as "Email"), `prepick`, `penciling`, `warp`, `speedup`, `giftcard`
  - The `ModalKey` union lists these keys (plus `null`).
- **Toolbar geometry.** `TOOLBAR_GRID_SCALE`, `TOOLBAR_GRID_PL`, `TOOLBAR_GRID_LEFT`, `TOOLBAR_GRID_W`, `TOOLBAR_ANCHOR` and `HEADER_GAP` fix the header's pixel design (about 1,900px wide in total).
- **Field design sizes.** `BODY_DESIGN_W` = 1904, `FIELD_DESIGN_W` = 1552, `BODY_DESIGN_H` = 820, `WINDOW_DESIGN_H` = 1000, `MAX_UPSCALE` = 1.5. These are the reference sizes for responsive scaling.
- **`fitRatio(wRatio, hRatio)`.** Shrinking is driven by width alone. Growing is capped by the height ratio and by `MAX_UPSCALE`, so a wide but short window doesn't push the diamond rows into the AT BAT row.
- **`fitStyle(f)`.** Lays a box out at `100/f %` width and applies `scale(f)`. Fixed-pixel content inside a percentage-width box then scales uniformly instead of re-wrapping.
- **POD artwork:**
  - `POD_ART_W` / `POD_ART_H` (1535×1365) and `POD_WINDOWS` give the four glass-pane rectangles in the gondola SVG, so labels can be positioned as percentages of the artwork.
  - `POD_W_PER_H` converts header height into the POD's rendered width.
- **`slotToPodOccupant(slot)`.** Turns a `board.pod` slot into `{ name, id, entry, date, time }`, or `null` for an empty seat.
- **Leaderboard constants:**
  - `LB_MAX` (G 300000 / H 100000 / T 50000): earnings caps, used in a percentage calculation that is never rendered.
  - `LB_CARD_MAX` (7 / 5 / 3): the most cards a tier can hold, shown as "(N)".
  - `LB_COLOR`: the tier letter colours.
  - `LB_ICON`: the tier artwork (Grand Slam trophy, Home Run cap, Triple trophy).
- **`boardSummaryCache`.** A module-level cache, kept for the whole session, that maps a board id to `{ boardNumber, trackingNumber }`. Tracking numbers never change once a board exists.

### Component state and effects (L357-L650)
- **State:**
  - `openModal`: which toolbar modal is open.
  - `dugoutHover`: the hover tooltip for a dugout row.
  - `podDetail`: the popover for a POD seat.
  - `showAllDugout` and `dugoutSearch`: the full dugout list.
  - `podTeamPopup`: the POD team member list.
  - `invitePos`: the AT BAT invite modal.
  - `hotBoxExpanded`
  - `relatedBoards`: tracking numbers of the parent and child boards.
- **`openPodTeamPopup(teamId)`.** Calls `GET /backend/bat246/pod-team/:teamId`. A dugout or AT BAT slot can carry a `podTeamId`, shared by all 4 members of a POD cycle. When it does, the slot shows the team id instead of a name, and clicking it opens this popup.
- **Header fit (L399-L430).** A `useLayoutEffect` with a `ResizeObserver` and a window resize listener:
  - Measures the header against `designW = TOOLBAR_GRID_LEFT + TOOLBAR_GRID_W + HEADER_GAP + POD_W_PER_H × contentHeight`.
  - Stores `{ scale, height }` in `headerFit`.
  - The inner wrapper is scaled as a whole: the leaderboard, board number and toolbar shrink together.
  - The header's own height is set to the scaled height, so the POD, which is sized as a percentage of the header height, shrinks with it.
  - `podS` scales the minimum and maximum pixel sizes of the POD label fonts.
  - Skipped when `readOnly`.
- **Field fit (L438-L460).** A second observer computes:
  - `fieldScale`: the diamond cards against the field width.
  - `bodyScale`: the AT BAT row, dugout, Hot Box, PLAYING FIELD label and clock against the body width.
- **Nav portals.** On mount it looks up `#bat246-nav-left` and `#bat246-nav-right` in the host page's "All Boards" bar. The child-board buttons are portaled into those elements.
- **Board summaries (L481-L513).**
  - Seeds the cache with the current board.
  - Collects `parentBoardId`, `leftChildBoardId` and `rightChildBoardId`.
  - Calls `GET /backend/bat246/boards/:id/summary` for any id not already cached.
  - Fills `relatedBoards`.
- **Admin siren (L515-L578).**
  - Runs only for `isAdmin`, never when `NODE_ENV === "development"`, and only when the dugout plus AT BAT slots hold fewer than 8 players.
  - Plays a 600/950 Hz Web Audio sine siren for 10 seconds.
  - Browsers keep audio suspended until a user gesture, so the context is resumed on the first `pointerdown` or `keydown`.
  - The `sirenActive` state is set but never read.
- **Derived values:**
  - `isPostPP`: the protection period has ended. Passed to `PencilingModal`.
  - `canShowInvite = !readOnly && canInvite`
  - `hasPrevBtn`
  - `familyPrefix`: the family number from the tracking number, e.g. "6" from "6-1002 L".
  - `hasAnyAtBatInvite`: nudges the vertical positions when an invite button is visible.
- **Invite rules (business logic):**
  - `hidePreservePosition`: true when the viewer sits on Home Plate, 3rd Base, 2nd Base A/B or an AT BAT slot. Those players can only generate "Without Position" links.
  - `disablePreservePosition`: true when `mySalesCredits === 0`. A 1st Base player must first earn a Green Card through a "Without Position" sale before generating a "Preserve Position" link.
- **`AtBatInviteBtn` (L607-L650).** The control under each AT BAT slot:
  - If `pendingPlacements` holds an entry for that position, it shows "Pending · <time left>" with a hover card (name, email, expiry).
  - Otherwise, an empty slot shows an "Invite" button that opens `InviteModal`.
  - AB4 and AB5 are nudged sideways when the Previous button sits between them.

### Overlays (L652-L804)
- `InviteModal`, opened for the chosen AT BAT position.
- The eight toolbar modals (`LayawayModal`, `SnapBackModal`, `MessageModal`, `PrePickModal`, `PencilingModal`, `WarpModal`, `SpeedUpModal`, `GiftCardModal`). Each receives `board`. None renders when `readOnly`.
- **Full dugout list:**
  - Searchable by name.
  - Shows the `podTeamId` link or the player's name, the entry number, and the joined date and time.
- **Dugout hover card:** name or team id, entry, joined time, "Referred by", and flags.
- **POD team popup:** for each member, the seat label ("POD seat N", "Dugout (waiting for PP)", or the raw position), the entry, the board tracking number, the date and the referrer.
- **POD seat popover:** enlarged ×2.288 and clamped to the viewport. Shows Id, D/T and `board.podTeamId`. A `mousedown` anywhere on the document closes it.

### Header (L821-L1153)
- **POD gondola** (`/images/Pod-New.svg`):
  - Anchored to the right edge.
  - Each `POD_WINDOWS` pane shows the occupant's name, id-entry, D and T in a white box that enlarges on hover, plus a numbered button that toggles the seat popover.
  - `board.podTeamId` appears under the windows.
  - Hidden when `readOnly`.
- **Leaderboard (L955-L1092).** Three gold bars, for tiers G, H and T. Each bar shows:
  - the tier badge with its artwork (the badge enlarges ×2 on hover through `.lb-trophy-hover-trigger`),
  - the flags,
  - a player label built as `<first name ≤10 chars>-<distributorId ≤8>-<entryNo ≤2>`,
  - the earned cards: one Gold first, then the green cards in a white box, then any extra Gold, Black and Brown with counts,
  - the static "(max)" watermark.

  A card-sum counter is commented out.
- **Board unit (L1109-L1150).** Positioned at `TOOLBAR_ANCHOR` and contains:
  - "Board <trackingNumber>", with any trailing " L" or " R" removed,
  - the BAT 246 logo,
  - a `WARP-<warpCount>` badge when `warpCount > 0`,
  - the 4×2 toolbar grid. Each button scales ×1.87 on hover and opens its modal.

### Body (L1155-L1494)
- **Child-board nav:** portaled `Link`s to `/games/bat246/<leftChildBoardId>` and `/games/bat246/<rightChildBoardId>`. A side that has not split yet shows a disabled placeholder, "`<family>` -      L" (or "R").
- **Diamond** (`fieldElRef`, absolutely positioned with percentage coordinates):
  - `HomePlateCard` in the upper left.
  - `BaseCard`s for 3rd, 2nd A/B and 1st A-D, each wrapped in `fitStyle(fieldScale)` with `cardsScale={1.55}`.
  - The vertical positions shift a little depending on whether invite buttons are showing.
  - 1st Base A moves right when its WARP tab is showing.
- **AT BAT row:** an 8-column grid of `PosLabel` + `Slot` + `AtBatInviteBtn`. On child boards, a red "Previous <parent tracking>" button links to the parent board.
- **Minor League dugout (L1277-L1424):**
  - Hidden when `readOnly`.
  - A quilted 8-row roster ordered 8 down to 1, with the letters "DUGOUT" as a watermark.
  - A siren GIF (loaded from tenor.com), hidden once `board.status === "split"`.
  - An "Overflow" pill. Once the dugout holds more than 8 players, the pill shows the overflow count and opens the full list.
  - A "door" bracket on row 1.
  - Rows with a POD team id open the team popup.
- **Hot Box (L1427-L1471):** rows for Gold, then Black, Brown and Gray cards (Green is excluded). The first 4 rows show, padded with blanks. "More (N)" and "Less" expand or collapse the list.
- **PLAYING FIELD:** the varsity-style label.
- **Game Clock:** counts down to `protectionPeriodEnd`.
  - On a split board, it is frozen at the time remaining at `splitAt` and passed `stopped`.
  - Otherwise it receives `ppPausedRemainingMs`.

## Exports
- `BoardLayout(props)`: the desktop board. Props:
  - `board: BoardData`
  - `highlightPosition?`: the position key to ring.
  - `readOnly?`: public invite and preview boards. Hides the POD, leaderboard, toolbar, modals, dugout, Previous button and nav.
  - `isAdmin?`: enables the siren.
  - `canInvite?`
  - `myPosition?`, `myUserId?`, `mySalesCredits?`: drive the invite rules above.
  - `pendingPlacements?: PendingPlacement[]`
- `Slot(props)`: the AT BAT card, also used by the mobile board.
- `PosLabel({ text })`: the tab label.
- `fmtDate(iso?)` and `fmtTime(iso?)`: date and time formatters.
- `slotToPodOccupant(slot)`: maps a pod slot to a `PodOccupant`.
- `BUTTONS`: the toolbar definitions. `ModalKey`: the modal key type.
- `POD_ART_W`, `POD_ART_H`, `POD_WINDOWS`: the POD artwork geometry.
- `LB_CARD_MAX`, `LB_COLOR`, `LB_ICON`: the leaderboard constants.
- Types:
  - `PendingPlacement`: `{ userId, userName, userEmail, position, purchasedAt, expiresAt }`.
  - `PodOccupant`
  - `PodTeamMember`: `{ playerId, playerName, entryNo, position, boardTrackingNumber, enteredAt, referredByName? }`.

## Interfaces
- **Backend endpoints called** (router `server/bat246/routes/bat246.routes.ts`, mounted at `/bat246`, all `requireAuth`):
  - `GET /backend/bat246/pod-team/:teamId`: members of one POD cycle (`getPodTeamDetails`).
  - `GET /backend/bat246/boards/:id/summary`: `{ boardNumber, trackingNumber }` for the parent and child nav buttons.
- **Environment variables:**
  - `NEXT_PUBLIC_API_URL`: backend base (falls back to `http://localhost:4000`).
  - `NODE_ENV`: the siren is disabled in development.
- **Browser storage / cookies:** reads `localStorage.garage_tok` for the bearer token.
- **External services:** the siren GIF loads from `media.tenor.com`.
- **Background work:** the 450ms siren frequency sweep and a 10-second stop timer (admins only). `ResizeObserver`s drive the scaling.

## Dependencies
- **Internal:**
  - `BaseCard.tsx`, `HomePlateCard.tsx`, `GameClock.tsx`, `InviteModal.tsx`: the board pieces.
  - `MiniCard.tsx`: card stacks, flags and the gray images.
  - `TrophyPill.tsx`: trophies.
  - `nameUtils.ts`: `firstName`.
  - `types.ts`: `BoardData`, `SlotData`, `CardType`, `PositionReservation`. `PositionReservation` is imported but not used.
  - The eight `modals/*Modal.tsx` files.
  - `lib/utils.ts`: `cn`.
- **Packages:**
  - `react`
  - `react-dom`: `createPortal`.
  - `next/link`
  - `lucide-react`

## Used by
- `app/(dashboard)/games/bat246/[boardId]/page.tsx`: the authenticated board page at `/games/bat246/[boardId]`, on desktop.
- `app/(dashboard)/games/bat246/components/BoardLayout.tsx`: a re-export kept for the board's old location.
- `app/games/bat246/join/[boardId]/[position]/page.tsx`: the public invite join page (`readOnly`).
- `app/games/bat246/preview/[boardId]/page.tsx`: the public preview page (`readOnly`).
- `components/bat246/BoardMobileSections.tsx`: imports only the exported constants and helpers.

## Notes
- Almost all positioning is hand-tuned pixel and percentage geometry matched to a reference design. The comments explain why each value exists, so read them before changing a number.
- Comments marked "Board 6-1002 only — display-only masking" sit above the tracking number and the POD team id, but the code shown renders both values unchanged.
- Fetch failures are swallowed: missing summaries show "…", and a failed POD team load shows "No members found".
