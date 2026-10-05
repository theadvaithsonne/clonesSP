# `server/bat246/services/bat246CardBack.util.ts`

> Pure formatters that build the `cardBack` snapshot stored on BAT246 `Bat246SalesCredit` records for Green, Gold (and Black/Brown) and NoCard cards.

**Kind:** BAT246 game module (backend) - service · **Lines:** 122

## Purpose
When a player earns a card, the system records a history row (`Bat246SalesCredit`) whose `cardBack` field is a frozen snapshot of "who earned it, from which position, because of whom". The frontend's card-history view shows this as the back of the card. Centralising the shape here keeps every call site consistent, and because the builders are synchronous and take data the caller already has, they add no database queries.

## How it works
- `displayName()` uses `nickname`, then `email`, then `""`. `firstBaseLetter()` extracts `A`-`D` from a `1stX` position key, otherwise `null`.
- **`buildGreenCardBack(input)`** returns `{ assignedTo: { playerName, playerIdNo, entryNo }, position, freePositionAssignedTo, freePosition: { playerName, playerIdNo, entryNo }, atBatPositionNo, firstBasePosition, issuedAt, boardTrackingNo }`. `assignedTo` is the earner; `freePosition*` is the newly placed (referred) player; `atBatPositionNo` is the referred player's raw position key (it can also be a 1st Base key).
- **`buildGoldCardBack(input)`** is the Green shape plus `stolenFrom` (`{ playerName, playerIdNo, entryNo, playerId }` or `null`) and `stolenFromPosition`, for the case where a 1st Base player's Gold "Approve" filled a slot another 1st Base player covered. It is also reused for Black/Brown cards from Dugout promotion.
- **`buildNoCardCardBack(input)`** describes the loser side: `stolenBy` (Gold earner, with `playerId`), `position` (earner's position), `cardEarned`, `stolenFrom`, `stolenFromPosition`, `issuedAt`, `boardTrackingNo`.

## Exports
- `buildGreenCardBack(input: BuildGreenCardBackInput)` - Green card snapshot.
- `buildGoldCardBack(input: BuildGoldCardBackInput)` - Green snapshot + "stolen from" details.
- `buildNoCardCardBack(input: BuildNoCardCardBackInput)` - NoCard snapshot.
- `interface BuildGreenCardBackInput` - `earner`, `earnerEntryNo`, `earnerPosition`, `referred`, `referredPlayerId`, `referredEntryNo`, `referredPosition`, `boardTrackingNo`, `issuedAt`.
- `interface BuildGoldCardBackInput extends BuildGreenCardBackInput` - adds optional `stolenFrom`, `stolenFromPlayerId`, `stolenFromEntryNo`, `stolenFromPosition`.
- `interface BuildNoCardCardBackInput` - `stolenBy`, `stolenByEntryNo`, `stolenByPlayerId?`, `stolenByPosition`, `cardEarned`, `stolenFrom`, `stolenFromEntryNo`, `stolenFromPlayerId?`, `stolenFromPosition`, `boardTrackingNo`, `issuedAt`.

## Dependencies
None (no imports).

## Used by
`server/bat246/services/bat246.service.ts`, `server/bat246/services/bat246Admin.service.ts`, `server/bat246/services/bat246Entry.service.ts`.

## Notes
The returned object shape is persisted in MongoDB; changing field names breaks older history rows on the frontend unless both shapes are handled.
