# `server/fx/fxFallback.ts`

> A hand-maintained USD-based exchange-rate table that the FX service uses as its last resort when no usable rate snapshot exists.

**Kind:** FX (currency) module · **Lines:** 29

## Purpose
`server/fx/fxService.ts` normally serves rates from snapshots fetched from live providers and stored in MongoDB. On a fresh deploy with an empty cache, or when every upstream provider is down, it still has to answer. This file supplies the static table it falls back to. It was ported from contacts-backend's `src/money/fxFallback.ts`, and the header says the two tables should be kept in sync. The values were last set on 2026-06-05.

## How it works
- The rates use the providers' native direction: 1 USD = N units of X.
- `FX_FALLBACK_RATES` covers 10 currencies: USD 1, INR 85, EUR 0.92, GBP 0.79, AUD 1.52, CAD 1.37, JPY 157, AED 3.67, SGD 1.35, NGN 1480. The comment on INR notes that 85 replaces an earlier 85/88 inconsistency.
- The table is never written to the database. It is only a read-time safety net.

## Exports
- `FX_FALLBACK_BASE` - the literal `"USD"`.
- `FX_FALLBACK_RATES: Record<string, number>` - the fallback USD-to-X rates.
- `FX_FALLBACK_PROVIDER` - the label `"fallback-table@2026-06-05"`.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `server/fx/fxService.ts` - imports `FX_FALLBACK_RATES` for `resolveUsdTable()` (the read fallback) and for the count that `refreshRates()` returns when both providers fail.

## Notes
- `FX_FALLBACK_BASE` and `FX_FALLBACK_PROVIDER` are exported but not imported anywhere.
- When the service is on this table, only these 10 currencies can be converted. `/public/fx/convert` returns `UNSUPPORTED_CURRENCY` for any other code, even one listed in `ccyExponent.ts`.
- The rates go stale over time. Refresh them by hand now and then.
