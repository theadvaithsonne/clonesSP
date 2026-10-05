# `server/models/fxRateSnapshot.model.ts`

> Mongoose model storing point-in-time snapshots of the full USD-to-currency exchange-rate table behind the public FX service.

**Kind:** Mongoose model · **Lines:** 54

## Purpose
`server/fx/fxService.ts` serves currency conversion (`/public/fx/*`, browser `/backend/public/fx/*`). Rates are persisted rather than only memoised in process so a freshly booted server can serve rates without first calling the upstream provider, and so conversions can be reproduced against a historical snapshot. Ported from contacts-backend's `fxRate.model.ts`, renamed to avoid confusion with per-transaction FX fields, and widened with a `"cached-alt"` source for the frankfurter.dev fallback.

## How it works
- `base` - always `"USD"` (default).
- `rates` - Mongoose `Map` of currency code to number, in the provider's native direction (1 USD = `rates[X]` units of X). Using a Map means new currencies need no schema migration. `fxService.getRateTable()` pivots to a non-USD base on read.
- `fetchedAt` (required, indexed) - when the provider data was fetched.
- `source` - `"live" | "cached-alt" | "fallback"`.
- `provider` - provider name string.
- Timestamps on. An extra `{ fetchedAt: -1 }` index serves "latest snapshot" lookups.

`fxService` writes rows with `FxRateSnapshot.create(...)` and reads the latest with `findOne().sort({ fetchedAt: -1 }).lean()`.

## Exports
- `FxRateSnapshot` - model `"FxRateSnapshot"` (no explicit collection, so Mongoose's default pluralised name `fxratesnapshots`).
- `IFxRateSnapshot` - document interface.

## Interfaces
- **Database:** collection `fxratesnapshots` (read/write).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/fx/fxService.ts` only.

## Notes
- The interface types `rates` as `Record<string, number>`, but a hydrated document returns a `Map`; `.lean()` reads return a plain object.
- `fetchedAt` is indexed twice (field-level `index: true` ascending and the explicit descending index); harmless but redundant.
- No TTL: snapshots accumulate indefinitely.
