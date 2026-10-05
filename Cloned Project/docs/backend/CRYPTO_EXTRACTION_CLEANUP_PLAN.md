# Crypto extraction — cleanup plan

**Status:** planned, not executed. Backup exists at
`origin/crypto-backup` (created 2026-09-11 from commit `95700ee`).

Rollback at any point:
```bash
git reset --hard origin/crypto-backup
git push --force-with-lease origin main
```

---

## Context

The crypto detection layer (watchers, pollers, sweepers, reconciler,
gas-float, admin sweeper endpoints) was extracted to a sibling
service `garage-crypto-backend` deployed at `https://crypto.garage.app`.
Main proxies the admin sweeper endpoints to it and receives a
service-to-service webhook back for fulfilment.

This document lists what CAN and CANNOT be removed from main now.

---

## What still runs on main (narrow-scope extraction)

Under the current scope, these three code paths still execute LOCALLY
on main and are load-bearing:

1. **Payment REQUEST creation** — `POST /invoices/:id/select-payment`
   calls `services/cryptoPaymentRequest.createRequest`, which allocates
   a new HD deposit address and writes the `CryptoPaymentRequest` row.
2. **Payment options gate** — `services/invoice.ts:getPaymentOptions`
   calls `config/cryptoWallets.getConfiguredChains()` to decide
   whether to show the crypto tab.
3. **Invoice cancel in-flight check** — cancel-invoice queries
   `CryptoPaymentRequest` locally.

So the whole "createRequest" call chain is still needed:
```
createRequest
 └─ allocateAddress
     └─ deriveEvmAddress / deriveTronAddress / deriveBitcoinAddress
     └─ getChainConfig  (reads PLATFORM_*_ADDRESS env)
     └─ usdCentsToNativeAtomic  (only ETH/BTC — CoinGecko lookup)
```

Everything else in the crypto layer is safe to strip.

---

## Phases (execute in order)

### Phase 1 — Delete boot-side code

Already guarded by `CRYPTO_LOCAL_WATCHERS=false`; safe to delete
outright now that the guard is proven.

- Delete the crypto block at `src/index.ts:733-918` (seven boot hooks
  + the `cryptoLocalWatchersDisabled` flag). Everything between
  `[cryptoPoller]` and the closing brace of the `checkGasFloatHealth`
  try/catch goes.

Files that become dead after Phase 1 (delete them too):
- `src/services/cryptoPaymentPoller.ts`
- `src/services/cryptoAddressWatcher.ts`
- `src/services/cryptoNativeEvmWatcher.ts`
- `src/services/cryptoBitcoinWatcher.ts`
- `src/services/cryptoTronAddressPoller.ts`
- `src/services/cryptoAddressExpirySweeper.ts`
- `src/services/cryptoHdAddressReconciler.ts`
- `src/services/cryptoGasFloat.ts`

### Phase 2 — Delete admin-sweeper route (proxied to crypto.garage.app)

The proxy block at `src/app.ts:~258` (`if (process.env.CRYPTO_BACKEND_URL)`)
is now the authority for `/garage-admin/sweeper/*`.

- Delete `src/routes/garageAdminSweeper.ts`
- Remove the import at `src/app.ts:115`
- Remove `app.use("/garage-admin/sweeper", garageAdminSweeperRoutes);`
  at `src/app.ts:~537`

Files that become dead after Phase 2:
- `src/services/cryptoFundsSweeper.ts`
- `src/services/cryptoBitcoinSweeper.ts`
- `src/services/cryptoTronSweeper.ts`

### Phase 3 — Prune env vars

Remove from `.env` (and from `src/config/env.ts`) — every one of these
is now only read by services deleted in Phase 1 / 2:

```
POLYGONSCAN_API_KEY
BSCSCAN_API_KEY
TRONGRID_API_KEY
TRONSCAN_API_KEY
CRYPTO_INFURA_WSS_POLYGON
CRYPTO_INFURA_WSS_BSC
CRYPTO_INFURA_WSS_ETHEREUM
CRYPTO_MEMPOOL_SPACE_API
CRYPTO_MEMPOOL_SPACE_WSS
CRYPTO_HOT_WALLET_ADDRESS_POLYGON
CRYPTO_HOT_WALLET_ADDRESS_POLYGON_USDT
CRYPTO_HOT_WALLET_ADDRESS_POLYGON_USDC
CRYPTO_HOT_WALLET_ADDRESS_BSC
CRYPTO_HOT_WALLET_ADDRESS_ETHEREUM
CRYPTO_HOT_WALLET_ADDRESS_TRON
CRYPTO_HOT_WALLET_ADDRESS_BITCOIN
CRYPTO_POLYGON_GAS_FLOAT
CRYPTO_BSC_GAS_FLOAT
CRYPTO_TRON_GAS_FLOAT_TRX
CRYPTO_UNSWEPT_ALERT_USD
CRYPTO_LOCAL_WATCHERS
```

`CRYPTO_LOCAL_WATCHERS` goes in Phase 3 too — once the boot block is
deleted, the flag no longer does anything.

---

## Do NOT touch (still needed)

### Files
- `src/config/cryptoWallets.ts` — read by `getPaymentOptions →
  getConfiguredChains`
- `src/services/cryptoWallet.ts` — HD address derivation
- `src/services/cryptoAddressAllocator.ts` — called by `createRequest`
- `src/services/cryptoPaymentRequest.ts` — `createRequest` runs on main
- `src/services/cryptoFxRate.ts` — `usdCentsToNativeAtomic` for ETH/BTC
- `src/models/cryptoPaymentRequest.model.ts`
- `src/models/cryptoAddressCounter.model.ts`
- `src/routes/hifiInvoice.ts` and `src/config/hifiInvoice.ts` — never
  moved; stay on main under narrow scope
- `src/services/cryptobrandWallets.ts`, `cryptobrandCheckoutStatus.ts`,
  `cryptobrandOfficeBootstrap.ts`, `src/config/cryptobrandCurrencies.ts`
  — never moved; stay on main
- `src/routes/internalCrypto.ts` + `src/middleware/internalService.ts`
  — receives the fulfil-paid webhook from crypto backend
- The proxy block at `src/app.ts:~258` — routes admin sweeper traffic

### Env vars

```
PLATFORM_USDT_TRC20_ADDRESS
PLATFORM_USDT_POLYGON_ADDRESS
PLATFORM_USDT_BEP20_ADDRESS
PLATFORM_USDC_POLYGON_ADDRESS
CRYPTO_WALLET_MNEMONIC          # HD derivation for new addresses
CRYPTO_HD_ENABLED_CHAINS        # getConfiguredChains gate
CRYPTO_INVOICE_TTL_MINUTES      # allocateAddress reads it
CRYPTO_BACKEND_URL              # proxy target for admin sweeper
INTERNAL_SERVICE_TOKEN          # /internal/invoices/:id/fulfill-paid auth
```

### npm deps — DO NOT remove yet

`ethers`, `tronweb`, `bitcoinjs-lib`, `tiny-secp256k1`, `ecpair`,
`bs58check` — `cryptoWallet.ts` + `cryptoAddressAllocator.ts` still
need them for HD derivation.

These only go once the FULL createRequest call moves to crypto backend
via HTTP — that's a separate strangler step, not part of this
cleanup.

---

## Verification after each phase

**After Phase 1:**
- `npm run build` clean
- Boot main → tail logs → confirm NO `[cryptoPoller]`, `[cryptoAddressWatcher]`,
  `[cryptoNativeEvmWatcher]`, `[cryptoBitcoinWatcher]`,
  `[cryptoTronAddressPoller]`, `[cryptoAddressExpirySweeper]`,
  `[cryptoHdAddressReconciler]`, `[cryptoGasFloat]` lines
- `curl https://crypto.garage.app/health` still green (those crons must
  still be firing on the sibling)

**After Phase 2:**
- `npm run build` clean
- Hit `/garage-admin/sweeper/pending` with an admin token — request
  reaches `crypto.garage.app` (check its access log), returns the
  pending sweeps as before

**After Phase 3:**
- `grep -R "POLYGONSCAN_API_KEY\|CRYPTO_INFURA_WSS\|CRYPTO_HOT_WALLET\|CRYPTO_.*_GAS_FLOAT\|CRYPTO_UNSWEPT_ALERT\|CRYPTO_LOCAL_WATCHERS" src/`
  on main → zero hits
- `npm run build` clean
- End-to-end: a non-India buyer picks crypto on a test invoice → the
  crypto tab still appears (`getConfiguredChains` still returns the
  PLATFORM_*_ADDRESS pairs) → deposit address rendered → real payment →
  invoice flips to `paid` via the crypto backend's webhook

---

## PR structure

Cleanest split:

- **PR 1** — Phase 1 (delete boot hooks + dead watcher/poller services).
  Low risk. No user-visible change.
- **PR 2** — Phase 2 (delete local admin sweeper route + its sweeper
  service dependencies). Test the admin sweeper page thoroughly before
  merging.
- **PR 3** — Phase 3 (prune env vars from `.env` example / config).
  Coordinate with ops so prod `.env` is trimmed at the same time as
  the deploy.

Or a single PR if you'd rather move fast — nothing between the phases
depends on the previous one going out first.

---

## Rollback plan

For any phase:
```bash
git reset --hard origin/crypto-backup
git push --force-with-lease origin main
```
Then `pm2 reload garage-prod`. Main resumes running everything locally,
`crypto.garage.app` continues running in parallel (double-write hazard
is tiny — both write CryptoPaymentRequest atomically via
`findOneAndUpdate`).

The backup branch stays until you're confident. Delete only when
`main` has been running the cleaned-up code for a week without
incident:
```bash
git push origin --delete crypto-backup
git branch -D crypto-backup
```
