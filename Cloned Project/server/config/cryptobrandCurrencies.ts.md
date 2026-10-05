# `server/config/cryptobrandCurrencies.ts`

> Declares which extra (non-USD) wallet currencies every member of a cryptobrand office gets, plus the full list including USD.

**Kind:** backend config · **Lines:** 24

## Purpose
Organisations flagged `Organization.officeCreatedFromCryptobrand === true` give their members multi-currency store wallets. The USD wallet is the "parent" (see `StoreWallet.parentWalletId`) and is created for every user in every org; this file lists only the sibling currencies added on top for cryptobrand orgs. It is a module constant for now, and the comment notes it could later become a per-org setting.

## How it works
- `CRYPTOBRAND_EXTRA_CURRENCIES = ["INR", "ETH", "BTC", "USDT"]` (readonly tuple).
- `CRYPTOBRAND_ALL_CURRENCIES = ["USD", ...extras]`, with USD first because it is the parent wallet.

## Exports
- `CRYPTOBRAND_EXTRA_CURRENCIES` - sibling currencies only.
- `type CryptobrandExtraCurrency` - union of those codes.
- `CRYPTOBRAND_ALL_CURRENCIES` - USD plus the extras; used by eager wallet creation and the wallet-fetch safety-net top-up.

## Dependencies
None.

## Used by
- `server/services/cryptobrandWallets.ts` - creates one store wallet per currency for cryptobrand-org members.
- `server/routes/wallet.ts` - ordering and top-up of the currency set when wallets are fetched (`/backend/wallet/...`).

## Notes
- `server/config/hifiInvoice.ts` keeps its own wallet-currency list (`HIFI_WALLET_CURRENCIES`) and asks for the two lists to be extended together.
