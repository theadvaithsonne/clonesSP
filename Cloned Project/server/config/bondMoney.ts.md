# `server/config/bondMoney.ts`

> Exact integer money arithmetic for HiFi bonds: amounts are atomic-unit strings handled with BigInt, never floats.

**Kind:** backend config · **Lines:** 155

## Purpose
Every bond amount (instrument price, holding value, payout, commission) is an integer count of a currency's smallest unit, stored as a string and computed with `BigInt`. The header gives two reasons: `StoreWallet.balance` is a JS float and has drifted in production (a `$inc` produced a balance like 0.10000000000000142), and a bond paying out many times compounds that drift; and ETH in wei (1e18 per coin) cannot fit in a JS `number` (safe up to about 9e15). This module is the shared primitive layer under the bond models and services.

## How it works
- **Currencies:** `BOND_CURRENCIES = ["INR", "USD", "USDT", "BTC", "ETH"]` (the cryptobrand set). `MINOR_UNITS` gives decimal places: INR 2 (paise), USD 2 (cents), USDT 6, BTC 8 (satoshi), ETH 18 (wei).
- **Parsing without floats:** private `parseDecimalToScaled(value, dp)` accepts only non-negative decimals matching `^\d+(\.\d+)?$`, splits on the dot, pads the fraction, keeps `dp` digits and rounds half-up on the next digit. `"1.5"` at dp 2 gives `150n`. Negative numbers, exponent notation and anything non-numeric throw.
- **Rates:** percentages arrive as decimal strings (`"1"`, `"1.5"`, `"0.0125"`) and are scaled to 6 dp (`RATE_DP`) before any multiplication. `percentOf(atomic, ratePct)` computes `atomic * scaledRate / (100 * 10^6)` with private `divRoundHalfUp` (half away from zero; throws on a non-positive denominator or negative numerator).
- **Conversions:** `toAtomic` (decimal -> atomic string), `fromAtomic` (atomic -> exact decimal string, trailing zeros stripped).
- **The one float edge:** `toWalletAmount(atomic, currency)` hands a `number` to the float-based wallet services. If `Number(decimal)` does not round-trip exactly, it re-derives the atomic value from `n.toFixed(dp)` and **throws** if that differs, refusing to move money at reduced precision (mainly relevant for ETH).
- **Arithmetic:** `addAtomic`, `subAtomic` (throws on underflow below zero), `mulUnits(perUnitAtomic, units)` (units must be a non-negative integer). Per the spec quoted in the comments, callers must round per unit first and then multiply by the unit count, so two buyers with the same holding always get identical totals.
- `formatAtomic` returns `"<decimal> <CODE>"` for display.

## Exports
- `BOND_CURRENCIES`, `type BondCurrency`, `MINOR_UNITS`, `RATE_DP`.
- `isBondCurrency(c: string): c is BondCurrency`.
- `toAtomic(value: string | number, currency): string`.
- `fromAtomic(atomic: string, currency): string`.
- `toWalletAmount(atomic: string, currency): number` - the only sanctioned float conversion; may throw.
- `addAtomic(a, b)`, `subAtomic(a, b)`, `mulUnits(perUnitAtomic, units)`, `percentOf(atomic, ratePct)` - all return atomic strings.
- `formatAtomic(atomic, currency): string`.
- `__testing` - `{ divRoundHalfUp, parseDecimalToScaled, scaleOf }` exposed for unit tests.

## Dependencies
None (uses native `BigInt`).

## Used by
- Models: `server/models/bondHolding.model.ts`, `bondInstrument.model.ts`, `bondLedgerEntry.model.ts`, `bondPayoutEvent.model.ts`.
- `server/routes/bond.ts` (mounted at `/bonds`, browser `/backend/bonds`).
- Services: `bondCommission.ts`, `bondInvoiceFulfillment.ts`, `bondMath.ts`, `bondPayoutEngine.ts`, `bondValidation.ts`, `bondView.ts`.
- Tests: `bondMath.test.ts`, `bondValidation.test.ts`, `bondView.test.ts`.

## Notes
- The doc comment on `formatAtomic` shows `"₹1,919.00"`, but the function actually returns e.g. `"1919 INR"` (no symbol, no grouping, trailing zeros stripped).
- Passing a JS `number` that stringifies in exponent form (e.g. `1e-7`) to `toAtomic` or `percentOf` throws; pass strings.
- `scaleOf` is defined but only exposed via `__testing`.
