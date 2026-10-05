# `server/models/pincodeData.model.ts`

> Mongoose model for a local lookup table of Indian PIN codes mapped to city and state, with 3- and 4-digit prefixes for fuzzy fallback.

**Kind:** Mongoose model · **Lines:** 20

## Purpose
Address forms and geocoding need to turn an Indian postal PIN code into a city and state. The primary source is the external India Post lookup; this collection is Garage's own fallback dataset so a lookup still works when that service fails or does not know a code.

## How it works
- Fields (all required strings, trimmed): `code` (full 6-digit PIN), `prefix4` (first 4 digits), `prefix3` (first 3 digits), `city`, `state`, `country` (default `"India"`).
- `timestamps: false` - static reference data.
- Indexes: unique `{ code: 1 }`, plus `{ prefix4: 1 }` and `{ prefix3: 1 }` so a caller can fall back from an exact match to the nearest region when the exact code is missing.

## Exports
- `PincodeData` - the Mongoose model.

## Interfaces
- **Database:** `PincodeData` (collection `pincodedata`, Mongoose's pluralisation leaves "data" unchanged).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/utils/geocoding.ts` - India-only lookup: tries India Post first, then `PincodeData.findOne({ code })`, then `{ prefix4 }`, and further fallbacks (dynamic import).
- `server/scripts/seedPincodes.ts` - one-time, hand-run seed that populates the collection (it checks `countDocuments()` first). It connects to `MONGODB_URI`, which is the production database.
