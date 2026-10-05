# `lib/checkout-currencies.ts`

> The single table of fiat currencies a buyer can pay an invoice in at checkout, with how each one is labelled and formatted, plus lookup and minor-unit formatting helpers.

**Kind:** frontend library · **Lines:** 134

## Purpose
Checkout shows currency tiles, amount labels and an invoice preview/document. Invoices are priced in USD or INR; other currencies are card-only payment currencies charged through Stripe and converted at checkout. The backend's payment-options response (`GET /backend/api/invoices/payment-options`, `server/routes/invoice.ts`) decides which are actually offered; this file only says how each one **renders**. A currency the backend returns that is missing here is dropped by the tile builder, so an older frontend never shows an unlabelled tile.

## How it works
`CHECKOUT_FIAT_CURRENCIES` lists, in display order:

| Code | Label | Sublabel | Symbol | Locale |
|---|---|---|---|---|
| USD | `$ USD` | International cards | `$` | en-US |
| INR | `₹ INR` | UPI, cards, netbanking | `₹` | en-IN |
| CAD | `CA$ CAD` | International cards only | `CA$` | en-US |
| EUR | `€ EUR` | International cards only | `€` | en-US |
| GBP | `£ GBP` | International cards only | `£` | en-US |
| AED | `AED` | International cards only | `AED ` | en-US |
| PHP | `₱ PHP` | International cards only | `₱` | en-US |

Each entry also has a flag emoji and a Tailwind gradient class for its tile. "International cards only" is shown because Stripe India declines non-INR charges on Indian-issued cards. Dollar-family currencies get a prefix (`CA$`) so they are not confused with a `$` USD tile; currencies without a widely recognised glyph use their code.

Lookups go through a private `BY_CODE` map and upper-case the input, so `"cad"` works:
- `isFiatCurrency(code)` / `fiatCurrencyConfig(code)` - membership and config.
- `currencySymbol(code)` - the symbol, or `"<CODE> "` for unknown codes.
- `formatMinor(minor, code)` - converts minor units (1/100) to a display string with exactly two decimals using the currency's locale, for example `3478, "CAD"` -> `"CA$34.78"`; unknown codes render as `"XYZ 34.78"`. Non-numeric input is treated as 0.

## Exports
- `CHECKOUT_FIAT_CURRENCIES: readonly CheckoutFiatCurrency[]` - the table above.
- `FIAT_CURRENCY_CODES: string[]` - its codes in order.
- `isFiatCurrency(code: string): boolean`
- `fiatCurrencyConfig(code: string): CheckoutFiatCurrency | undefined`
- `currencySymbol(code: string): string`
- `formatMinor(minor: number, code: string): string`
- `CheckoutFiatCurrency` (type) - `{ code, label, sublabel, flag, gradient, symbol, locale }`.

## Dependencies
None.

## Used by
- `components/checkout/InvoiceDocument.tsx`
- `components/checkout/InvoicePreview.tsx`
- `components/checkout/PaymentMethodSelector.tsx`

## Notes
- **Keep in sync with the backend:** the table mirrors `SUPPORTED_FIAT_CURRENCIES` in `server/utils/exchangeRate.ts` (formerly `garagenew-backend/src/utils/exchangeRate.ts`). Add a currency in both places.
- Every listed currency is assumed to use 2-decimal minor units; the backend relies on the same assumption. A zero-decimal currency (for example JPY) could not be added without changing `formatMinor`.
