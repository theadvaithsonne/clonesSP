# `server/config/cryptoWallets.ts`

> The list of blockchain/coin pairs the platform can accept crypto invoice payments on, with token contracts, decimals and receiving addresses.

**Kind:** backend config · **Lines:** 251

## Purpose
Central configuration for in-house crypto payments. When a buyer chooses to pay an invoice in crypto, the payment-request service (`services/cryptoPaymentRequest.ts`) looks up the chosen chain and coin here to find the token contract, the decimal precision, and the platform receiving address to stamp on the new `CryptoPaymentRequest`. The picker on the invoice page also reads from here to show only the options that are actually configured.

## How it works
### `SupportedChainConfig`
Each entry carries `chain`, `coin`, a picker `label`, a `chainName` for warnings, on-chain `decimals`, optional `displayDecimals`, `contractAddress` (empty string for a native coin), optional `isNative`, `platformAddress` (from env) and an optional `qrScheme` (not set on any current entry).

`displayDecimals` matters: it is the most decimals a normal wallet app can show and accept as typed input. The unique "amount tail" used to match a payment to an invoice lives inside these decimals so a sender can type the full amount by hand. BEP-20 USDT is 18 decimals on-chain but displayed at 6, and the comments warn not to "fix" this back to 18.

### `SUPPORTED_CHAINS`
| chain | coin | decimals / display | contract | receiving address env |
|---|---|---|---|---|
| tron | USDT | 6 / 6 | TRC-20 USDT (mainnet) | `PLATFORM_USDT_TRC20_ADDRESS` |
| polygon | USDT | 6 / 6 | Tether USDT on Polygon | `PLATFORM_USDT_POLYGON_ADDRESS` |
| polygon | USDC | 6 / 6 | bridged USDC.e on Polygon | `PLATFORM_USDC_POLYGON_ADDRESS` |
| bsc | USDT | 18 / 6 | BEP-20 USDT | `PLATFORM_USDT_BEP20_ADDRESS` |
| polygon | POL (native) | 18 / 6 | none | `CRYPTO_HOT_WALLET_ADDRESS_POLYGON` |
| ethereum | ETH (native) | 18 / 6 | none | `CRYPTO_HOT_WALLET_ADDRESS_ETHEREUM` |
| bitcoin | BTC (native) | 8 / 8 | none | `CRYPTO_HOT_WALLET_ADDRESS_BITCOIN` |

Contract addresses are public mainnet token contracts written as constants. The USDC slot was re-added for the HiFi investment flow, where a product priced in USDC is paid through this pipeline instead of the store wallet. Native coins are priced in USD and converted at mint time with a live FX rate (`services/cryptoFxRate.ts`); the buyer gets a fixed quote. The EVM chains share one 0x address from one seed. BTC uses bech32 addresses and has no fallback, so its env var must be set explicitly (`server/config/env.ts` does give the ETH and POL addresses a fallback to the Polygon USDT address).

### Lookups
- `getChainConfig(chain, coin)` returns the matching entry, or `null` if the pair is unknown **or** its `platformAddress` is empty (a deployment misconfiguration the caller should turn into a friendly error).
- `getConfiguredChains()` returns entries with an address set, and additionally drops native coins (ETH, POL, BTC) unless their chain appears in the comma-separated `CRYPTO_HD_ENABLED_CHAINS`. Reason: native coins can only be detected by the HD-wallet watchers, not the legacy shared-address poller; without this check a buyer could pay in ETH and the invoice would never settle. Stablecoins always appear when their address is set. Unsetting an env var removes an option from the picker without a code change.

## Exports
- `interface SupportedChainConfig`
- `SUPPORTED_CHAINS: SupportedChainConfig[]`
- `getChainConfig(chain: string, coin: string): SupportedChainConfig | null`
- `getConfiguredChains(): SupportedChainConfig[]`

## Interfaces
- **Endpoints that use it:** `GET /backend/api/invoices/crypto/chains` (public, `routes/invoice.ts`) returns `getConfiguredChains()` for the picker; `routes/hifiInvoice.ts` (mounted at `/hifi`) checks `getChainConfig` for polygon/tron/bsc before minting a stablecoin invoice.
- **Environment variables (via `env`):** `PLATFORM_USDT_TRC20_ADDRESS`, `PLATFORM_USDT_POLYGON_ADDRESS`, `PLATFORM_USDC_POLYGON_ADDRESS`, `PLATFORM_USDT_BEP20_ADDRESS`, `CRYPTO_HOT_WALLET_ADDRESS_POLYGON`, `CRYPTO_HOT_WALLET_ADDRESS_ETHEREUM`, `CRYPTO_HOT_WALLET_ADDRESS_BITCOIN`, `CRYPTO_HD_ENABLED_CHAINS`.

## Dependencies
- **Internal:** `server/config/env.ts` - receiving addresses and enabled HD chains; `server/models/cryptoPaymentRequest.model.ts` - type-only `CryptoChain` / `CryptoCoin`.

## Used by
- `server/services/cryptoPaymentRequest.ts` - creates payment requests.
- `server/services/invoice.ts` - decides whether crypto is offered on an invoice.
- `server/routes/invoice.ts`, `server/routes/hifiInvoice.ts`.

## Notes
- The header and comments name `services/cryptoPaymentPoller.ts`, `cryptoNativeEvmWatcher` and `cryptoBitcoinWatcher`/`cryptoBitcoinSweeper`. None of these exist in this project: per `server/config/env.ts`, all watchers, pollers and sweepers moved to the separate garage-crypto-backend service (an external service). This repo only creates payment requests; settlement detection happens elsewhere.
- Adding a coin: extend `SUPPORTED_CHAINS`, add its address env var to `env.ts`, and add detection support in the crypto backend.
