# `server/bat246/models/bat246Config.model.ts`

> Singleton Mongoose model that holds BAT246's global sequence counters (boards, families, distributor IDs, POD team IDs).

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 18

## Purpose
Several BAT246 identifiers must be globally sequential and never reused. This one-document collection is where they are issued. Callers increment atomically with `findOneAndUpdate({}, { $inc: ... }, { new: true, upsert: true })`, so concurrent requests never get the same number.

## How it works
Fields (`timestamps: true`):
- `boardCounter` (default 0): next board number.
- `familyCounter` (default 0): next board-family number.
- `familySequences` (Mixed, default `{}`): the last sequence number used within each family, keyed by family number. For example, `seedBat246.ts` seeds `{ "1": 102 }`. Callers update it with `$set` or `$max` on `familySequences.<n>`.
- `distributorIdCounter` (default 1000): `assignDistributorId()` increments it and formats the result as `<seq><first initial><last initial>` (for example `1001B1`).
- `podTeamCounter` (default 1000): source of POD team IDs such as `P-1001`. `placeUserInPod()` issues one per board the first time any player enters that board's POD cycle.

The callers that increment these counters are `bat246Admin.service.ts`, `bat246Entry.service.ts`, `bat246Split.service.ts`, `bat246PodInvite.service.ts` and `bat246DistributorId.util.ts`.

## Exports
- `Bat246Config` - Mongoose model registered as `"bat246Config"`.

## Interfaces
- **Database:** collection `bat246configs` (Mongoose pluralises the name), expected to hold exactly one document.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/bat246/scripts/backupAndWipeBat246.ts`, `server/bat246/scripts/migrateTrackingNumbers.ts`, `server/bat246/scripts/seedBat246.ts`, `server/bat246/services/bat246Admin.service.ts`, `server/bat246/services/bat246DistributorId.util.ts`, `server/bat246/services/bat246Entry.service.ts`, `server/bat246/services/bat246PodInvite.service.ts`, `server/bat246/services/bat246Split.service.ts`, `server/scripts/checkConfig.ts`, `server/scripts/deleteAllBoardsExceptOne.ts`, `server/scripts/fix-child-board-seq-numbers.ts`.

## Notes
- The singleton is not enforced: every query uses an empty filter `{}`. If a second document were ever inserted, counters would be read from an arbitrary one.
- Lowering or resetting a counter (several maintenance scripts write to this document) can cause duplicate-key errors on the unique `boardNumber`, `trackingNumber` and `distributorId` fields.
