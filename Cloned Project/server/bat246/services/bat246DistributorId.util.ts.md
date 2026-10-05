# `server/bat246/services/bat246DistributorId.util.ts`

> Generates the permanent human-readable BAT246 distributor id (sequence number + initials) when a distributor first qualifies, and builds the cached user snapshot stored alongside it.

**Kind:** BAT246 game module (backend) - service · **Lines:** 73

## Purpose
Qualified BAT246 distributors are shown everywhere (board slots, leaderboards, Distributors page) by a short id rather than a Mongo id. This util issues that id exactly once, from a global counter, and at the same moment writes the first `userSnapshot` on the `Bat246Distributor` record so the distributor's contact details remain available even if the `User` document later changes or disappears.

## How it works
- `splitDistributorName(rawName)` - splits on whitespace (first and last word), else on hyphens; a single word is used as both first and last name; empty input yields empty strings.
- `buildDistributorId(seq, firstName, lastName)` - `${seq}${firstInitial}${lastInitial}`, uppercase, with `X` for a missing initial (e.g. sequence 1001 and "Jane Doe" -> `1001JD`).
- `buildUserSnapshot(user)` - copies `name, email, phone, profilePicture, country, state, city, postalCode`, each defaulting to `null`.
- `assignDistributorId(userId)` - no-op if the distributor record is missing or already has a `distributorId`. Otherwise loads the user, atomically increments `distributorIdCounter` on the singleton `Bat246Config` (upserted), and writes `firstName`, `lastName`, `distributorId` and `userSnapshot` with a filter of `distributorId: null`, so a concurrent second call cannot overwrite the first id (it only burns a counter value).

## Exports
- `splitDistributorName(rawName): { firstName: string; lastName: string }`
- `buildDistributorId(seq: number, firstName: string, lastName: string): string`
- `buildUserSnapshot(user: any)` - snapshot sub-document.
- `assignDistributorId(userId: Types.ObjectId | string): Promise<void>` - idempotent id assignment.

## Interfaces
- **Database:** `Bat246Distributor` (read/write), `Bat246Config` (`distributorIdCounter` increment), `User` (read).

## Dependencies
- **Internal:** `server/bat246/models/bat246Distributor.model.ts`, `server/bat246/models/bat246Config.model.ts`, `server/models/user.model.ts`.
- **Packages:** `mongoose` - types.

## Used by
`server/bat246/controllers/bat246.controller.ts` (`buildUserSnapshot` to refresh snapshots in the distributor list), `server/bat246/routes/bat246.routes.ts`, `server/bat246/services/bat246.service.ts` (`finalizePlacement`), `bat246Entry.service.ts`, `bat246MembershipBilling.service.ts`, `server/routes/invoice.ts`, `server/routes/productCheckout.ts`, `server/routes/unilevel-plus.ts`, `server/services/invoice.ts`, and the script `server/bat246/scripts/test-activate-garage-affiliate-boifeyaddequeu.ts` (10 importers).

## Notes
The id is derived from the user's name at qualification time and is never regenerated if the name changes later.
