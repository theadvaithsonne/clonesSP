# `lib/money/format-money.ts`

> Pure display helpers that turn a backend-normalised `Money` (or a raw catalog price row) into strings such as `"$2.40 (₹200)"`, plus a price/commission helper and a safe USD summer.

**Kind:** frontend library · **Lines:** 187

## Purpose
The frontend never converts currency. The backend sends `Money` objects that already carry a USD figure (`usdCents`/`usdMicros`) next to the original amount, and this module only renders them. It also centralises the "price + level-1 commission" ladder that several EarnGPT product surfaces used to compute inline, so every product card shows the same numbers.

## How it works
**Display rule** (from the header comment, "design §6"):
- same currency (USD): `"$2.40"`
- converted with a fresh rate: `"$2.40 (₹200)"`
- converted with an approximate rate (`fxSource` is `stale`, `fallback` or `backfilled`): `"~$2.40 (₹200)"`
- sub-cent (`usdCents` 0 but `usdMicros` > 0): `"<$0.01 (...)"`
- unconverted: `"₹200 (unconverted)"`, or `"200 (unknown currency)"` when the original currency is null.

**Internal helpers (not exported):**
- `ccyExp(code)` reads a currency's decimal places from `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits` (JPY 0, KWD 3, ...), falling back to 2. This avoids a hardcoded exponent table that could drift from the backend.
- `formatMajor(minor, ccy)` divides minor units by `10^exp` and formats with `Intl` in `en-US`. If `Intl` rejects the code, it uses the `CURRENCY_SYMBOL` fallback map (about 28 currencies) or `"<CODE> "`.
- `formatUsd(usdCents, usdMicros)` returns `"<$0.01"` for sub-cent amounts, otherwise a USD currency string.
- `rawSymbol(currency)` returns `"<currency> "` or `"$"`, matching the old inline formatting used before `Money` existed.

**Catalog commercials:**
- `priceLabel(row)` prefers `row.money` (via `formatMoneyInline`), then raw `priceCents` shown as `rawSymbol + (cents/100).toFixed(2)`, otherwise an em-dash.
- `deriveProductCommercials(row)` returns the price label plus a level-1 commission: `round(priceCents * level1Pct / 100)` in the row's own currency (not USD), or `null` when either input is missing.

**Totals:** `sumUsdCents(items)` adds only numeric `usdCents` values and never mixes currencies. Null items, or items without numeric `usdCents`, are counted in `unconvertedCount` so a UI can show an honest footnote.

## Exports
- `interface FormattedMoney { primary; secondary?; approx }` - structured display result.
- `formatMoney(m: Money): FormattedMoney` - applies the display rule. `primary` is the USD figure (prefixed `~` when approximate), or the original amount when unconverted. `secondary` is the original amount or a marker.
- `formatMoneyInline(m: Money): string` - single string form, `primary (secondary)`.
- `interface ProductCommercialRow { money?; priceCents?; currency?; level1Pct? }` - the catalog-row fields the commercial helpers read.
- `priceLabel(row: ProductCommercialRow): string` - display price for a catalog row.
- `interface ProductCommercials { priceLabel; commissionAmount: string | null; commissionPct: number | null }`.
- `deriveProductCommercials(row: ProductCommercialRow): ProductCommercials` - price plus L1 commission.
- `sumUsdCents(items): { totalUsdCents; unconvertedCount }` - safe USD total.

## Dependencies
- **Internal:** `lib/money/types.ts` - the `Money` type.
- **Packages:** none (uses the built-in `Intl` API).

## Used by
- `components/shared/product-card.tsx` - imports `deriveProductCommercials` and `ProductCommercialRow` for the shared product card used across EarnGPT, Opportunities and Links surfaces.

## Notes
- Commission is computed from raw `priceCents` in the row's currency, even when `money` exists and the price label shows USD. The two figures can therefore be in different currencies. The header comment says this deliberately preserves the earlier per-surface maths.
- When `Intl` supports a code, `formatMajor` passes no fraction-digit options, so the currency's default decimals apply. Zero-decimal currencies render without decimals.
- All formatting is fixed to the `en-US` locale.
