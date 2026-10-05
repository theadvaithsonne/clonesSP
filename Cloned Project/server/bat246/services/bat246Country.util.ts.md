# `server/bat246/services/bat246Country.util.ts`

> Decides which country flag ("country of origin") is stamped on a BAT246 board slot.

**Kind:** BAT246 game module (backend) - service · **Lines:** 24

## Purpose
Each board slot shows a country-of-origin flag next to the player. The rule is shared by every placement path, so it lives in one small helper.

## How it works
- `pickCountryOrigin(explicitOrigin, countryOfBirth, residence)` returns the first non-empty value in this order: an explicit origin passed by the caller, the trimmed Country of Birth the player entered in Complete Profile, then their country of residence; otherwise `null`. Synchronous, no I/O.
- `resolveCountryOrigin(userId, explicitOrigin?, residence?)` short-circuits on an explicit origin; otherwise loads `countryOfBirth` from the user's `Bat246Distributor` record and applies `pickCountryOrigin`.

## Exports
- `pickCountryOrigin(explicitOrigin, countryOfBirth, residence): string | null`
- `resolveCountryOrigin(userId: Types.ObjectId | string, explicitOrigin?, residence?): Promise<string | null>`

## Interfaces
- **Database:** `Bat246Distributor` - reads `countryOfBirth`.

## Dependencies
- **Internal:** `server/bat246/models/bat246Distributor.model.ts` - source of `countryOfBirth`.
- **Packages:** `mongoose` - `Types.ObjectId` cast.

## Used by
`server/bat246/services/bat246.service.ts`, `bat246Admin.service.ts`, `bat246Entry.service.ts` (`resolveCountryOrigin`) and `bat246PodInvite.service.ts` (`pickCountryOrigin`, with a distributor record it already loaded).

## Notes
`new Types.ObjectId(String(userId))` throws for a malformed id, so callers must pass a valid ObjectId.
