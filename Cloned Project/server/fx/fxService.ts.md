# `server/fx/fxService.ts`

> The backend's multi-currency exchange-rate service. It fetches USD rate tables from two public providers, stores snapshots in MongoDB, caches them in memory, and serves tables in any base currency without ever throwing.

**Kind:** FX (currency) module · **Lines:** 235

## Purpose
This file is the single source of FX rates inside the backend. It powers the public currency API (`/backend/public/fx/*`), converts invoice amounts into USD (`server/utils/invoiceMoney.ts`), and supplies USD totals for genealogy and affiliate reports (`server/services/genealogy/data.ts`). It was ported from contacts-backend's `src/money/fxService.ts` and trimmed. The EarnGPT-specific `Money` helpers and the historical `asOf` lookup were dropped, and a second upstream provider (frankfurter.dev) was added between the primary provider and the static fallback.

## How it works

### Provider chain
| Step | Source | Persisted? | `source` value |
|---|---|---|---|
| 1 | `https://open.er-api.com/v6/latest/USD` | yes, as an `FxRateSnapshot` | `"live"` |
| 2 | `https://api.frankfurter.dev/v1/latest?base=USD` | yes | `"cached-alt"` |
| 3 | `FX_FALLBACK_RATES` from `fxFallback.ts` | **no** | `"fallback"` |

All tables use the providers' native direction (1 USD = N units of X).

### Validation: `validateRates(rates)` (L73-L83)
A provider table is used only if all of these hold:
- USD, INR, EUR and GBP are present, finite and positive.
- USD is within 0.01 of 1.
- INR is between 30 and 200.

This catches garbled provider responses without needing to compare against an earlier snapshot.

### Fetchers (L85-L114)
- `fetchLiveTable()` returns `null` on a non-2xx response, a validation failure or a network error.
- `fetchAltTable()` does the same. frankfurter leaves the base currency out of its `rates`, so the fetcher adds `USD: 1` back before validating.
- Neither fetcher sets a timeout. Each relies on the default behaviour of global `fetch`.

### Write path: `refreshRates()` (L123-L160)
1. Tries the live provider, then the alternate. The first valid table is written with `FxRateSnapshot.create({ base: "USD", rates, fetchedAt, source, provider })` and replaces the in-process memo.
2. If both fail, it logs a warning and returns `{ source: "fallback", count: 10 }` without writing anything. 10 is the number of fallback currencies.
3. Any unexpected error is caught and returns `{ source: "fallback", count: 0 }`. The function never throws, because its callers do not await it.

### Read path: `resolveUsdTable()` (L164-L195)
1. **Memo.** If the in-memory table is less than 60 seconds old (`MEMO_MS`), it is returned as is.
2. **MongoDB.** Otherwise the newest snapshot is loaded (`findOne().sort({ fetchedAt: -1 }).lean()`). It is used if it is at most 7 days old (`MAX_STALE_MS`). `mapToObj` turns the Mongoose `Map` into a plain object, and a missing `source` defaults to `"cached-alt"`.
3. **Static fallback.** If there is no snapshot, the snapshot is too old, or the database read throws, the static fallback table is used. Its `fetchedAt` is set to "now". That result is memoised as well, so the database is checked again after about a minute.

### Rebasing: `rebase()` and `getRateTable()` (L199-L234)
- `rebase(usdRates, base)` pivots through USD: `out[X] = usdRates[X] / usdRates[base]`, and `out[base] = 1`.
- `getRateTable(base = "USD")` upper-cases `base`. If the current table has no positive rate for it, it quietly uses USD instead. The returned `base` field always shows the base actually used.

## Exports
- `validateRates(rates): boolean` - sanity check for a USD rate table.
- `refreshRates(): Promise<{ source: FxSource; count: number }>` - fetches and stores a fresh snapshot. Never throws.
- `getRateTable(base?: string): Promise<RateTable>` - the current table in `base`. Never throws.
- `type FxSource = "live" | "cached-alt" | "fallback"`.
- `interface RateTable { base; rates; asOf: Date; source: FxSource }`.

## Interfaces
- **Database:** `FxRateSnapshot` (`server/models/fxRateSnapshot.model.ts`; Mongoose model "FxRateSnapshot", so by Mongoose's default naming the collection is `fxratesnapshots`). It is written once per successful refresh and read for the latest snapshot.
- **External services:** open.er-api.com (primary) and api.frankfurter.dev (secondary). Both are unauthenticated public endpoints.
- **Background work:** `server/index.ts` calls `refreshRates()` once during boot to warm the cache, then every hour through `setInterval`.

## Dependencies
- **Internal:** `server/models/fxRateSnapshot.model.ts` - snapshot storage; `server/fx/fxFallback.ts` - the static table.
- **Packages:** none (uses the global `fetch`).

## Used by
- `server/index.ts` - boot warm-up and the hourly refresh.
- `server/routes/publicFx.ts` - `GET /backend/public/fx/rates`, `/convert` and `/currencies`. `/convert` always asks for the USD table and pivots it itself.
- `server/services/genealogy/data.ts` - `getRateTable("USD")` for converting report figures to USD.
- `server/utils/invoiceMoney.ts` - `usdRates()` wraps `getRateTable("USD")`.

## Notes
- A new snapshot document is added every hour and nothing in this file deletes old ones, so the collection keeps growing (about 8,760 documents a year).
- The memo is per process. With several backend processes, each one may briefly serve a different table.
- Once the newest snapshot is more than 7 days old, reads silently move to the 10-currency static table. Every currency outside that table then becomes unconvertible until a refresh succeeds. Check the `source` field when diagnosing this.
- An unknown `base` produces a USD table rather than an error, so callers that care must compare the returned `base` with the one they asked for.
