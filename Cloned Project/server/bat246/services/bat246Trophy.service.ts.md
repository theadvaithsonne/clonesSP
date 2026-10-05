# `server/bat246/services/bat246Trophy.service.ts`

> Awards permanent BAT246 leaderboard trophies (tiers T, H and G) to players. Each tier can be awarded once and is never removed.

**Kind:** BAT246 game module (backend) — service · **Lines:** 121

## Purpose
In BAT246 a player earns a permanent trophy badge the first time they qualify for a leaderboard tier: T, H or G. The trophy stays even after the paid leaderboard slot is vacated, for example when an earnings cap is hit. This file is the only place trophies are written. There are three award paths:
1. When a leaderboard slot is filled.
2. Whenever a card count goes up.
3. A backfill sweep.

## How it works
- **`awardTrophy`** runs one conditional `updateOne` on `Bat246Player`. The update only matches when `trophies.<tier>` is null or missing, and it sets `{ earnedAt, boardId, boardTrackingNo }`. Because the condition is evaluated atomically by MongoDB, duplicate or concurrent calls cannot double-award. It returns `true` only when it modified the document, and logs the award.
- **`checkAndAwardTrophiesByCards`** reads `minorLeague.cardsEarned` and checks each tier on its own, so a player can earn several tiers at once. Here `total` = gold + black + brown + green; gray cards are excluded, the same as `tierFor()` in `bat246Leaderboard.service.ts`.

  | Tier | Qualifies when |
  |------|----------------|
  | **T** | gold ≥ 1 and green ≥ 2 |
  | **H** | gold ≥ 1 and total ≥ 5 |
  | **G** | gold ≥ 1 and total ≥ 7 |

  This ignores `crossedHp`, slot occupancy and earnings caps; those only gate the paid leaderboard slot. It returns the tiers newly awarded.
- **`distributeTrophies`** loads every board that has a `leaderBoard.playerId`. For each row with a T, H or G tier and a player, it calls `awardTrophy`. It is idempotent and returns `{ scannedBoards, awarded }`.

## Exports
- `type TrophyTier = "T" | "H" | "G"`
- `awardTrophy(playerId, tier, boardId?, boardTrackingNo?): Promise<boolean>` — awards one trophy if it is not already held.
- `checkAndAwardTrophiesByCards(playerId, boardId?, boardTrackingNo?): Promise<TrophyTier[]>` — awards every tier the player's cards qualify for.
- `distributeTrophies(): Promise<{ scannedBoards: number; awarded: number }>` — backfill sweep over every board's leaderboard rows.

## Interfaces
- **Database:**
  - Reads and writes `Bat246Player.trophies` (model `bat246Players`).
  - Reads `Bat246Board` (`leaderBoard`, `trackingNumber`, `status`).

## Dependencies
- **Internal:** `server/bat246/models/bat246Board.model.ts`, `server/bat246/models/bat246Player.model.ts`.
- **Packages:** `mongoose` (`Types.ObjectId`).

## Used by
- **Leaderboard:** `bat246Leaderboard.service.ts` calls `awardTrophy` from its slot assignment.
- **Card increments:** `bat246.service.ts`, `bat246Admin.service.ts` and `bat246Entry.service.ts` call `checkAndAwardTrophiesByCards` with fire-and-forget at the points where cards are earned.
- **Manual scripts:** `server/scripts/bat246-distribute-trophies.ts` (runs `distributeTrophies`) and `server/scripts/bat246-test-award-trophies.ts` (calls `awardTrophy`). Both are run by hand with tsx against the database in `MONGODB_URI`, which is production in this project.
