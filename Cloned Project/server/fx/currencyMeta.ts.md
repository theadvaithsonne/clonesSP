# `server/fx/currencyMeta.ts`

> The canonical currency-code-to-display-symbol map that the public FX API sends to clients.

**Kind:** FX (currency) module · **Lines:** 48

## Purpose
`GET /backend/public/fx/currencies` sends this map to clients so they never keep a divergent copy of their own. According to the header comment, clients should format with `Intl.NumberFormat` and use these symbols only as a fallback when Intl cannot format a code. The code was ported from contacts-backend's `src/money/currencyMeta.ts`.

## How it works
- `CURRENCY_SYMBOL` lists 28 currencies, for example USD `$`, INR `₹`, EUR `€`, GBP `£`, JPY and CNY `¥`, AUD `A$`, KRW `₩`, NGN `₦`, IDR `Rp` and BDT `৳`. AED and SAR use the code plus a trailing space (`"AED "`, `"SAR "`). PKR and LKR both use `₨`.
- `currencySymbol(code)` upper-cases the code and returns its symbol. For an unlisted code it returns the code plus a space (for example `"CHF "`), so an amount never renders as a bare number. An empty or nullish code returns `""`.

## Exports
- `CURRENCY_SYMBOL: Record<string, string>` - code to symbol.
- `currencySymbol(code: string | null | undefined): string` - symbol with a safe fallback.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `server/routes/publicFx.ts` - `GET /public/fx/currencies` (browser `/backend/public/fx/currencies`). It builds its list from the keys of `CURRENCY_SYMBOL`, so this map also decides **which currencies that endpoint advertises**.

## Notes
- `currencySymbol()` is not imported anywhere. `server/services/invoiceEmail.ts` has its own private `currencySymbol` function instead, so the two copies can drift apart.
- If you add a code here, also make sure it exists in `server/fx/ccyExponent.ts`. `/currencies` otherwise silently falls back to 2 decimals for it.
