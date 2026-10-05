# `server/fx/ccyExponent.ts`

> The backend's ISO-4217 minor-unit table: how many decimal places each supported currency has, used to round FX conversion results correctly.

**Kind:** FX (currency) module · **Lines:** 67

## Purpose
Converting money between currencies needs the correct precision for the target currency. JPY has 0 decimals, KWD has 3, and most currencies have 2. This module is the single source of truth for that. The code was ported from contacts-backend's `src/money/ccyExponent.ts`, with the function renamed from `exp` to `ccyExponent` and the `CurrencyCode` type dropped.

## How it works
- `CCY_EXPONENT` (private) maps upper-case currency codes to exponents:
  - **0 decimals:** BIF, CLP, DJF, GNF, ISK, JPY, KMF, KRW, PYG, RWF, UGX, VND, VUV, XAF, XOF, XPF.
  - **3 decimals:** BHD, IQD, JOD, KWD, LYD, OMR, TND.
  - **2 decimals:** about 120 other codes (AED through ZMW, including USD, INR, EUR, GBP).
- Lookups upper-case the code and check `hasOwnProperty`, so inherited keys such as `"constructor"` never match.
- An unknown code returns `null`, never a default of 2. The header comment explains why: a 0-decimal currency scaled with 2 is 100x wrong, and a 3-decimal one is 10x wrong. Callers must treat `null` as "unsupported".

## Exports
- `ccyExponent(code: string | null | undefined): number | null` - the exponent, or `null` for an empty or unknown code.
- `isSupportedCurrency(code): boolean` - `true` when `ccyExponent(code) !== null`.
- `SUPPORTED_CURRENCIES: string[]` - every known code, sorted alphabetically.
- `currencyExponentTable(): Record<string, number>` - a shallow copy of the full map.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `server/routes/publicFx.ts` (mounted at `/public/fx`, browser `/backend/public/fx`):
  - `GET /convert` rejects an unknown `from` or `to` with `UNKNOWN_CURRENCY` and rounds the result to `ccyExponent(to)` decimals.
  - `GET /currencies` reports `decimals` for each listed currency.

## Notes
- Only `ccyExponent` is imported anywhere. `isSupportedCurrency`, `SUPPORTED_CURRENCIES` and `currencyExponentTable` are currently unused.
- `publicFx.ts`'s `/currencies` handler writes `ccyExponent(code) ?? 2`, which goes against this file's "never assume 2" rule. It is harmless today only because every code in `CURRENCY_SYMBOL` is also in this table.
- The exponent table may contain codes that the live rate providers do not return. Conversion still fails safely in that case, because `publicFx` checks that both rates exist.
