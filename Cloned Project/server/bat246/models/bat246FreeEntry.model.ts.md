# `server/bat246/models/bat246FreeEntry.model.ts`

> Mongoose model for a free board entry a BAT246 player has earned, with its trigger, lifecycle status and optional gray-card transfer.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 30

## Purpose
BAT246 has a free-entry mechanic. `Bat246Player` carries `freeEntriesEarned`, `freeEntriesUsed` and `freeEntryInterval` (default 3). This model was meant to track each earned free entry as its own record. No live service uses it today, so it is effectively a reserved schema.

## How it works
Fields (`timestamps: true`):
- `playerId` (→ `bat246Players`, required, indexed): the earner.
- `triggerType`: `"residualPayout"` or `"cpdSales"`, required. Why the entry was earned.
- `triggerBoardId` (→ `bat246Boards`, required): the board where it was earned.
- `assignedToBoardId` (→ `bat246Boards`, default `null`): the board where it was redeemed.
- `status`: `pending | active | used | expired`, default `pending`.
- `restrictionEndsAt` and `usedAt`: dates, default `null`.
- `grayCardTransfer`: `{ fromPlayerId, toPlayerId }`, both → `bat246Players`.
- `earnedAt` (Date, required).

## Exports
- `Bat246FreeEntry` - Mongoose model registered as `"bat246FreeEntries"`.

## Interfaces
- **Database:** collection `bat246freeentries`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/scripts/backupAndWipeBat246.ts` only. That manual maintenance script backs up and wipes the BAT246 collections, including this one, against the database in `MONGODB_URI` (the **production** database in this project). No service, route or controller creates or reads free-entry documents.

## Notes
- Appears unused by the running application. The free-entry counters actually live on `Bat246Player`.
