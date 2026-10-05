# `server/services/cryptoFxRate.ts`

> USD → crypto FX rate service for native-coin invoices (ETH, BTC).

**Kind:** backend service · **Lines:** 238

<!-- docgen:auto -->

## Purpose
USD → crypto FX rate service for native-coin invoices (ETH, BTC).

USDT/USDC invoices don't need this — they're USD-pegged 1:1 and
their atomic amount comes straight from the invoice's USD cents.
Native coins (ETH, BTC) need a live rate to translate "$50 USD" into
"0.0125 ETH at 1 ETH = $4,000".

Contract:
  getUsdPerCoin("ETH") → Promise<number>  // USD price of 1 ETH
  getUsdPerCoin("BTC") → Promise<number>  // USD price of 1 BTC

The rate we return is CAPTURED AT MINT time and locked onto the
CryptoPaymentRequest's `expectedAmountAtomic`. If the market moves
during the buyer's payment window, that's their exposure — same
model BitPay / Coinbase Commerce use. Never re-quote at settle time.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TRANSFERABLE_CURRENCIES` | const | `= [ "USD", "INR", "ETH", "BTC", "USDT", "USDC", ] as const` — Every currency the multi-currency store wallet + transfer/convert APIs know how to move money between. | 46 |
| `TransferableCurrency` | type |  | 54 |
| `getUsdPerCoin` | function | `async getUsdPerCoin(coin: SupportedFxCoin): Promise<number>` — Get the live USD-per-coin rate, cached for CACHE_TTL_MS. | 90 |
| `usdCentsToNativeAtomic` | function | `async usdCentsToNativeAtomic(usdCents: number, coin: SupportedFxCoin, decimals: number): Promise<{ atomic: bigint; usdPerCoin: number }>` — Convert a USD-cent amount to the coin's atomic (smallest) unit at the current live rate. | 139 |
| `convertBetween` | function | `async convertBetween(amount: number, from: TransferableCurrency, to: TransferableCurrency): Promise<{ converted: number; rate: number; path: …` — Convert a whole-unit amount between any two supported currencies at live spot rate. | 174 |

## Interfaces

- **External hosts mentioned in the code:** `api.coingecko.com`

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/models/orgConversionFee.model.ts`
- `server/routes/wallet.ts`
- `server/scripts/_convert-shorupan-hq-to-usd.ts`
- `server/services/bondCommission.ts`
- `server/services/bondPayoutEngine.ts`
- `server/services/bondView.ts`
- `server/services/conversionFee.ts`
- `server/services/cryptoPaymentRequest.ts`
- `server/services/wallet.ts`
