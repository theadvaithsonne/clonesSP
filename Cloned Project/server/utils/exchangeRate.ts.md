# `server/utils/exchangeRate.ts`

> Live USD-based exchange rates with in-memory caching.

**Kind:** backend utility · **Lines:** 179

<!-- docgen:auto -->

## Purpose
Live USD-based exchange rates with in-memory caching.

Uses the free exchangerate-api (no API key required). One call returns
every rate against USD; the whole table is cached for 1 hour. Falls back
to hardcoded rates if the API is unreachable.

USD ↔ INR are the currencies invoices are denominated in. CAD / EUR / GBP
are PAYMENT currencies only — a buyer may settle a USD- or INR-priced
invoice in one of them by card (Stripe), and the conversion is captured on
the invoice. Nothing is ever priced in them.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EXTRA_PAYMENT_CURRENCIES` | const | `= ["CAD", "EUR", "GBP", "AED", "PHP"] as const` — Currencies a buyer may pay an invoice in, besides the two it can be priced in. | 15 |
| `ExtraPaymentCurrency` | type |  | 16 |
| `SUPPORTED_FIAT_CURRENCIES` | const | `= [ "USD", "INR", ...EXTRA_PAYMENT_CURRENCIES, ] as const` — Every currency the rate table must be able to answer for. | 28 |
| `SupportedFiatCurrency` | type |  | 33 |
| `isSupportedFiatCurrency` | function | `isSupportedFiatCurrency(c: string): c is SupportedFiatCurrency` | 35 |
| `getUsdToRate` | function | `async getUsdToRate(currency: string): Promise<number>` — Current USD → <currency> rate. | 101 |
| `getUsdToInrRate` | function | `async getUsdToInrRate(): Promise<number>` — Fetch the current USD → INR exchange rate. | 119 |
| `convertUsdToInr` | function | `async convertUsdToInr(usdAmount: number): Promise<{ inrAmount: number; exchangeRate: number…` — Convert a USD amount to INR using the live exchange rate. | 131 |
| `convertInrToUsd` | function | `async convertInrToUsd(inrAmount: number): Promise<{ usdAmount: number; exchangeRate: number…` — Convert an INR amount to USD using the live exchange rate. | 145 |
| `convertToUsd` | function | `async convertToUsd(amount: number, fromCurrency: string): Promise<{ usdAmount: number; exchangeRate: number…` — Convert any supported currency amount to USD. | 160 |

## Interfaces

- **External HTTP calls:**
  - `GET https://open.er-api.com/v6/latest/USD` (L69)
- **External hosts mentioned in the code:** `open.er-api.com`

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/models/invoice.model.ts`
- `server/routes/feed.ts`
- `server/routes/franchiseApi.ts`
- `server/routes/garageAdminSavedCards.ts`
- `server/routes/invoice.ts`
- `server/scripts/_convert-shorupan-hq-to-usd.ts`
- `server/scripts/check-payment-currencies.ts`
- `server/services/cashbackCode.ts`
- `server/services/channelMembershipEvent.ts`
- `server/services/commission.ts`
- `server/services/cryptoFxRate.ts`
- `server/services/deals.ts`
- `server/services/ecommerceInvoice.ts`
- `server/services/founderStreamTable.ts`
- `server/services/invoice.ts`
- `server/services/officeAddonSubscription.ts`
- `server/services/officeSubscription.ts`
- `server/services/platformCoupon.ts`
- `server/services/workshop.ts`
