# `server/bat246/services/bat246PlayerId.util.ts`

> Creates a `Bat246Player` with a unique sequential `playerIdNo` ("2000HI", "2001HI", ...), retrying on collisions.

**Kind:** BAT246 game module (backend) — service · **Lines:** 44

## Purpose
Every BAT246 player has a display id of the form `<number>HI`. This id used to come from `Bat246Player.countDocuments()` at each create site. After some player rows were deleted, the count fell behind and new ids collided with existing ones. The result was a duplicate-key error (E11000 on `playerIdNo_1`) that silently blocked new signups' first purchase or membership activation. This helper is the single fix, and every code path that creates a player uses it.

## How it works
`createBat246Player(fields)` makes up to 5 attempts:
1. Load every player whose `playerIdNo` matches `/^\d+HI$/` and find the highest numeric prefix. The floor is 1999, so the first id is `2000HI`.
2. `Bat246Player.create({ ...fields, playerIdNo: "<max+1>HI" })`.
3. If two concurrent requests pick the same id (Mongo error code 11000), retry. After 5 failures, throw `"createBat246Player: exhausted retries generating a unique playerIdNo"`. Any other error is rethrown immediately.

## Exports
- `createBat246Player(fields: { userId: Types.ObjectId; nickname: string; email: string; memberSince?: Date; countryResidence?: string | null })` — returns the created `Bat246Player` document.

## Interfaces
- **Database:** reads and creates `Bat246Player` (model `bat246Players`). The unique index on `playerIdNo` is the real collision guard.

## Dependencies
- **Internal:** `server/bat246/models/bat246Player.model.ts`.
- **Packages:** `mongoose` (`Types`).

## Used by
- `server/bat246/services/bat246.service.ts`
- `bat246Admin.service.ts`
- `bat246Entry.service.ts`
- `bat246MembershipBilling.service.ts`
- `bat246PodInvite.service.ts`
- `server/routes/invoice.ts`
- `server/routes/productCheckout.ts`
- `server/services/invoice.ts`

## Notes
- Each attempt loads every numbered player id, which costs more as the player count grows. A counter document would avoid that, but the current approach tolerates gaps left by deleted rows.
