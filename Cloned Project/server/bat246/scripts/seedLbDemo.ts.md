# `server/bat246/scripts/seedLbDemo.ts`

> Demo-data script that fills the G/H/T (Grand Slam / Home Run / Triple) leaderboard on three BAT246 boards by stamping three existing players on each board with qualifying card counts and earnings.

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 146

## Purpose
Each BAT246 board shows a leaderboard with three tiers - G, H and T - and progress bars based on a player's lifetime leaderboard earnings. This script makes those bars visible for UI work and demos without playing the game: it picks real players already sitting on boards `1-100`, `1-101 L` and `1-102 R` (the boards `seedBat246.ts` creates) and overwrites their stats with demo values.

## How it works
**Tier presets** (`TIER_CONFIG`, L19-L50):

| Tier | `totalBCs` | cards (gold/black/brown/green/gray) | LB field | `lbEarnings` | `earningsOnBoard` | crossed HP | countries (res/origin) |
|---|---|---|---|---|---|---|---|
| G | 7 | 1/3/1/2/0 | `grandSlam` | 45,000 | 4,500 | 30 days ago | CA / LK |
| H | 5 | 1/2/0/2/0 | `homeRun` | 35,000 | 2,800 | 15 days ago | US / US |
| T | 3 | 1/0/0/2/0 | `triple` | 12,000 | 1,200 | 5 days ago | AU / NG |

The comments relate the earnings to caps of $300k, $100k and $50k for the progress bars.

**Flow:**
1. `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **Production database in this project.**
2. Loads boards whose `trackingNumber` is one of `1-100`, `1-101 L`, `1-102 R`; exits with code 1 if none.
3. For each board, collects up to three **distinct** players from the slots in priority order: Home Plate, 3rd Base, 2nd Base A, 2nd Base B, 1st Base, AT BAT. Boards with fewer than three players are skipped with a warning.
4. Assigns the first player tier G, the second H, the third T. For each, `Bat246Player.findByIdAndUpdate` sets `minorLeague.crossedHp: true`, `minorLeague.crossedHpAt`, `minorLeague.totalBCs`, the five `minorLeague.cardsEarned.*` counts, `minorLeague.lbEarnings.<tier field>`, `countryResidence` and `countryOrigin`.
5. Replaces the board's `leaderBoard` array with three rows `{ tier, playerId, qualifiedAt, earningsOnBoard }`.
6. Disconnects; errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:**
  - `Bat246Board` (collection `bat246boards`) - read three boards; overwrite `leaderBoard`.
  - `Bat246Player` (collection `bat246players`) - overwrite stats on up to nine players.
- **Environment variables:** `MONGODB_URI` - connection string (production).

## Dependencies
- **Internal:** `server/bat246/models/bat246Board.model.ts`, `server/bat246/models/bat246Player.model.ts`.
- **Packages:** `mongoose`, `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/seedLbDemo.ts`.

## Notes
- "Safe to re-run" in the header means it only touches those three boards and their players. On real data it **overwrites real players' card counts, earnings and countries with fake values** and replaces the boards' real leaderboard. Do not run against production.
- The same player can sit on more than one of the three boards (for example a player duplicated onto both split children); they are then stamped once per board, and the last board processed wins.
