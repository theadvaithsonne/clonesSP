# `server/bat246/models/bat246SalesCredit.model.ts`

> Mongoose model for BAT246 card-earning records: one row each time a player earns (or loses) a card on a board, with a frozen "card back" snapshot of who was involved.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 80

## Purpose
In the BAT246 board game, players earn coloured cards (Gold, Black, Brown, Gray, Green) for referrals and placements; the in-app terminology for the green circle is "Green Card". Despite the historical name "SalesCredit", each document in this collection is a card-earning history entry. The board services write one whenever a card is awarded, and the board UI reads them to show a hover tooltip with the card's history and "back of card" details. Rows flagged `countsForLB` feed leaderboard counts.

## How it works
Three schemas:

- **`CardBackSchema`** (embedded, no `_id`) — a snapshot taken at earn time so the tooltip never has to rebuild history:
  - `assignedTo` — the earner's `playerName` / `playerIdNo` / `entryNo`.
  - `stolenBy` — for `NoCard` rows: the Gold earner who took this player's Green Card (`playerId` refs `bat246Players`).
  - `stolenFrom` + `stolenFromPosition` — for Gold rows: the 1st Base player whose Green Card was skipped.
  - `freePosition` / `freePositionAssignedTo` — the referred player who was placed.
  - `cardEarned`, `position`, `homePlateSide` (`"L"`/`"R"`/null), `atBatPositionNo`, `firstBasePosition` (`"A"`-`"D"`/null), `issuedAt`, `boardTrackingNo`.
- **`GrayDistributionSchema`** (embedded, no `_id`) — `share1PlayerId`, `share2PlayerId`, `share3PlayerId` and an optional `allStarPlayerId`, all refs to `bat246Players`. Holds the recipients of a Gray card's shares.
- **`Bat246SalesCreditSchema`** (top level):
  - `boardId` (required, indexed, ref `bat246Boards`), `playerId` (required, ref `bat246Players`), `playerName`, `position` (e.g. `atBat-3`, a 1st Base key).
  - `cardType` (required): `Gold | Black | Brown | Gray | Green | NoCard`. `NoCard` records a player losing a Green Card to someone else's Gold.
  - `countsForLB` (required boolean): whether the row counts toward the leaderboard. The services set it to true for Gold and Green and false for NoCard.
  - `isPostPP`, `isLayaway` (booleans, default false), `saleAmount` (default 0).
  - `grayDistribution`, `cardBack` (both default null).
  - `earnedAt` (required), `referredUserId` / `referredUserName` (the player whose placement produced the card), `boardTrackingNumber`.
  - `timestamps: false`, so `earnedAt` is the only time field.
- Compound indexes: `{playerId, countsForLB}`, `{playerId, cardType}`, `{playerId, earnedAt}`. These support per-player history and leaderboard queries.

## Exports
- `Bat246SalesCredit` — Mongoose model `bat246SalesCredits`.

## Interfaces
- **Database:** `Bat246SalesCredit` (collection `bat246salescredits`, Mongoose's default lower-cased plural). Rows reference `bat246Players` and `bat246Boards`.

## Dependencies
- **Packages:** `mongoose` - schema, model, `Types.ObjectId`.

## Used by
- `server/bat246/services/bat246.service.ts`, `bat246Entry.service.ts` and `bat246Admin.service.ts` call `create(...)` whenever a card is awarded (or lost, for `NoCard`). They build the card back with helpers such as `buildGoldCardBack` / `buildGreenCardBack` / `buildNoCardCardBack`.
- `server/bat246/routes/bat246.routes.ts`: `GET /backend/bat246/players/:playerId/card-history` reads rows sorted by `earnedAt`.
- Scripts that work on the production database: `server/bat246/scripts/seedBat246.ts` (deletes all rows, then inserts), `server/bat246/scripts/backupAndWipeBat246.ts`, `server/scripts/bat246-test-board-create.ts` / `bat246-test-board-delete.ts` (insert or delete by `boardId`), `server/scripts/fix-1101R-wrong-green-cards.ts`.

## Notes
- Nothing in `server/` currently writes `isPostPP`, `isLayaway` or `grayDistribution`, so they keep their defaults. Most `create` calls write a literal `Gold`, `Green` or `NoCard`. `bat246Admin.service.ts` instead writes a computed `cardTypeCap`, which is how the other card types reach this collection.
- The card back is a snapshot frozen at earn time. Fields that change later, such as a referred user's distributor ID, are not stored here. The card-history route joins them in live.
- The model is still named "SalesCredit", but in the product UI these are "Green Card"/card records. A separate counter, `firstBase.N.salesCredits` on the board document, tracks Green Card counts per 1st Base slot (0-2). Do not confuse the two.
