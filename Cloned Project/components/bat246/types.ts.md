# `components/bat246/types.ts`

> Shared TypeScript types describing a BAT246 game board, its slots, card types and leaderboard as returned by the backend `/bat246` API.

**Kind:** Type-only module (listed as React component) · **Lines:** 146

## Purpose
BAT246 is the baseball-themed board game inside Garage. Every board page, card component, modal and data hook on the frontend needs the same picture of what a board looks like. This file is that single source of truth on the client side; it contains no runtime code, only `type` and `interface` declarations that mirror the JSON the backend sends.

## How it works
The types model one board as a set of named positions (baseball "bases") that hold player slots:

- **`CardType`** - the reward card a slot holds: `"Gold" | "Black" | "Brown" | "Gray" | "Green" | "NoCard" | null`. (In user-facing copy "Green" is the "Green Card".)
- **`SlotData`** - one occupied position. Carries player identity (`playerId`, `entryNo`, `playerName`, `distributorId`, `playerEmail`), timestamps (`enteredAt`, `joinedBoardAt`), the held `cardType`, per-type card counters (`goldCards`, `blackCards`, `brownCards`, `grayCards`, `freeGrayCards`, `grayCard160`, `noCards`, plus legacy `salesCredits`), permanent leaderboard `trophies` (`G`/`H`/`T` booleans), `warpStatus`, referral info (`referredBy`, `referredByName`), flags (`isCPD`, `isCompanyInvitee`, `isLayaway`, `isLayawayPlan`, `layawayBalance`), countries, `totalEarning`, `hpReferralBonusCount`, and `podTeamId`. The doc comment on `podTeamId` explains that all four members of a POD cycle share an id such as `"P-1001"`; on a dugout/AT BAT slot the UI shows that id instead of the name and opens a team popup backed by `GET /bat246/pod-team/:teamId`.
- **`HotBoxEntry`** - a card waiting in the board's "hot box" (card type, optional player, `assignedAt`).
- **`LeaderBoardRow`** - one leaderboard tier row (`tier: "G" | "H" | "T"`), the qualifying player, `earnings`, `totalBCs`, a `cardsEarned` breakdown and `qualifiedAt`.
- **`PencilingEntry`** / **`PrePickEntry`** - a player's claim on a target AT BAT slot (`targetAbSlot`); penciling expires (`expiresAt`), pre-picks do not.
- **`BoardData`** - the full board: ids and numbering (`_id`, `boardNumber`, `trackingNumber`, `title`), lifecycle `status` (`pending | active | splitting | split | completed | stalled`), `hidden`, `inviteProductId`, split-tree links (`generation`, `side`, `parentBoardId`, `leftChildBoardId`, `rightChildBoardId`, `splitAt`), the protection period (`protectionPeriodEnd`, `ppPausedRemainingMs`), `warpCount` (0-4), money (`minorLeagueAmount`, `nextHomePlatePayout`), the positions (`homePlate`, `thirdBase`, `secondBaseA`, `secondBaseB`, arrays `firstBase`, `atBat`, `dugout`, `onDeckCircle`), the three POD gondola seats `pod` and the board's `podTeamId` (never copied to child boards on a split), plus `hotBox`, `penciling`, `prePick`, `leaderBoard` and `createdAt`.
- **`PositionReservation`** - a time-limited reservation of a board position by email (`active | used | expired`).
- **`PositionStatus`** - a compact per-position status (`filled | blank | reserved`) used in board lists.
- **`BoardSummary`** - the lighter board shape used by board listings; reuses `BoardData["status"]` and `BoardData["warpCount"]` and adds optional `positions`.

Array positions use `(SlotData | null)[]` so empty seats keep their index; `onDeckCircle` is a plain `SlotData[]` queue.

## Exports
- `type CardType` - card colour held by a slot.
- `interface SlotData` - one player's occupied position on a board.
- `interface HotBoxEntry` - card queued in the hot box.
- `interface LeaderBoardRow` - leaderboard tier row.
- `interface PencilingEntry` - expiring claim on an AT BAT slot.
- `interface PrePickEntry` - non-expiring pre-pick of an AT BAT slot.
- `interface BoardData` - complete board document.
- `interface PositionReservation` - reservation of a position by email.
- `interface PositionStatus` - filled/blank/reserved marker for one position key.
- `interface BoardSummary` - board list item.

## Dependencies
- **Internal:** none
- **Packages:** none

## Used by
`app/(dashboard)/games/bat246/boards/page.tsx` (URL `/games/bat246/boards`), `app/games/bat246/join/[boardId]/[position]/page.tsx`, `app/games/bat246/preview/[boardId]/page.tsx`, the board components `BaseCard.tsx`, `BoardLayout.tsx`, `BoardMobileSections.tsx`, `HomePlateCard.tsx`, `MiniCard.tsx`, `TrophyPill.tsx`, the hooks `hooks/useBoard.ts` and `hooks/useBoards.ts`, and the modals `GiftCardModal`, `LayawayModal`, `MessageModal`, `PencilingModal`, `PrePickModal`, `SnapBackModal`, `SpeedUpModal`, `WarpModal` (19 files in total, all under `components/bat246/` or the BAT246 routes).

## Notes
- These are hand-maintained mirrors of the backend board model; nothing enforces that they match. When the backend adds a board or slot field, add it here too.
- `salesCredits` is a legacy field name; the user-facing term is "Green Card".
