# Crypto wallet top-up — APIs

Backend surface for the new "persistent per-user deposit address"
top-up flow. Powers the Add-Funds button on each crypto sub-wallet
(BTC, ETH, USDT) in the FE. Everything below is on `garagenew-backend`
(main); the crypto backend (`crypto.garage.app`) hosts the watchers
that credit the wallets — those don't expose HTTP.

Contents:
1. [Endpoint list](#endpoint-list)
2. [`GET /wallet/store/topup-address`](#get-walletstoretopup-address)
3. [`GET /wallet/store/topup-transactions`](#get-walletstoretopup-transactions)
4. [Existing endpoints the FE will reuse](#existing-endpoints-the-fe-will-reuse)
5. [Failure semantics](#failure-semantics)
6. [Data-flow diagram](#data-flow-diagram)

---

## Endpoint list

| Method | Path | Purpose |
|---|---|---|
| GET | `/wallet/store/topup-address` | Return the persistent deposit address for a user's crypto wallet + a QR-ready payload. |
| GET | `/wallet/store/topup-transactions` | Paginated list of top-ups that credited a specific wallet. |
| GET | `/wallet/store/balance` (existing) | Wallet balances including the new USDT wallet — no change to the endpoint. |
| GET | `/wallet/store/transactions` (existing) | General wallet ledger. Top-ups appear here too as `WalletTransaction` rows with `metadata.kind: "crypto_wallet_topup"`. |

All require `Authorization: Bearer <user JWT>`.

---

## `GET /wallet/store/topup-address`

Returns the persistent HD-derived deposit address bound to `(userId,
orgId, walletCurrency, chain)`. Addresses are provisioned at
office-join time by `ensureCryptobrandWallets` — this endpoint only
reads.

### Query parameters

| Name | Required | Type | Description |
|---|---|---|---|
| `walletId` | ✅ | ObjectId string | The `StoreWallet._id` for a crypto wallet the caller owns. Must be a BTC / ETH / USDT wallet — USD and INR wallets 400. |
| `chain` | Conditional | `"bitcoin" \| "ethereum" \| "polygon" \| "bsc" \| "tron"` | Required only for USDT wallets — one of `tron`, `polygon`, `bsc`. Ignored (may be omitted) for BTC and ETH wallets. |

### Response (200)

```json
{
  "success": true,
  "walletId": "6aab...",
  "currency": "USDT",
  "chain": "tron",
  "coin": "USDT",
  "address": "TQtND6vuwzFbFxrcAcWBLN5XpNuQGm63Yr",
  "qrData": "TQtND6vuwzFbFxrcAcWBLN5XpNuQGm63Yr"
}
```

- `qrData` is the raw string the FE should encode as a QR code. Same as `address` today — kept as a separate field so we can enrich later (e.g. `bitcoin:bc1q…?amount=0.01` URI scheme) without changing the FE contract.

### Errors

| Status | Body `error` | When |
|---|---|---|
| 400 | `"Invalid query"` | Missing / malformed `walletId` |
| 400 | `"Wallet currency USD does not support crypto top-up"` | Caller passed a USD/INR wallet |
| 400 | `"USDT wallets require ?chain= (tron \| polygon \| bsc)"` | USDT wallet but no chain |
| 400 | `"USDT not supported on chain X"` | USDT wallet with `chain=bitcoin` or `ethereum` |
| 401 | (no body) | Missing/invalid JWT |
| 404 | `"Wallet not found"` | walletId doesn't exist OR isn't owned by the caller |
| 404 | `"No deposit address provisioned yet. Ask an admin to run the backfill…"` | Backfill hasn't run for this user yet |
| 500 | `error.message` | Unexpected server error |

### Example calls

```bash
# BTC wallet — chain is inferred
curl -H "Authorization: Bearer $JWT" \
  "https://test.garage.app/wallet/store/topup-address?walletId=$BTC_WALLET_ID"

# ETH wallet — chain inferred
curl -H "Authorization: Bearer $JWT" \
  "https://test.garage.app/wallet/store/topup-address?walletId=$ETH_WALLET_ID"

# USDT wallet — chain required
curl -H "Authorization: Bearer $JWT" \
  "https://test.garage.app/wallet/store/topup-address?walletId=$USDT_WALLET_ID&chain=tron"
```

---

## `GET /wallet/store/topup-transactions`

Paginated list of `CryptoTopupTransaction` rows for a specific wallet,
newest first. Powers the "Top-up history" section of the wallet
detail page. Distinct from `/wallet/store/transactions` (which is the
general ledger with refunds, transfers, commission credits, etc).

### Query parameters

| Name | Required | Type | Default | Description |
|---|---|---|---|---|
| `walletId` | ✅ | ObjectId string | — | Must be owned by the caller. |
| `page` | ❌ | integer ≥ 1 | 1 | Pagination cursor. |
| `limit` | ❌ | integer 1..100 | 20 | Page size. |

### Response (200)

```json
{
  "success": true,
  "transactions": [
    {
      "_id": "6ab1...",
      "currency": "USDT",
      "chain": "tron",
      "coin": "USDT",
      "address": "TQtND6vuwzFbFxrcAcWBLN5XpNuQGm63Yr",
      "amount": 25,
      "amountAtomic": "25000000",
      "amountUsdAtDeposit": 25,
      "txHash": "2fb635e9b3812...",
      "fromAddress": "TAbc...",
      "blockNumber": 61234567,
      "receivedAt": "2026-09-18T09:12:03.000Z",
      "status": "credited"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasMore": true
  }
}
```

### Errors

| Status | Body `error` | When |
|---|---|---|
| 400 | `"Invalid query"` | Missing / malformed `walletId` |
| 401 | (no body) | Missing/invalid JWT |
| 404 | `"Wallet not found"` | walletId doesn't exist OR isn't owned by the caller |
| 500 | `error.message` | Unexpected server error |

---

## Existing endpoints the FE will reuse

These already exist and need **no backend changes** — they'll pick up
the new USDT wallet automatically because currency handling is
already data-driven.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/wallet/store/balance` | Returns the caller's wallets. Now includes the USDT wallet card after `ensureCryptobrandWallets` runs. |
| `GET` | `/wallet/store/transactions?currency=USDT` | Filter to USDT balance history — top-up credits show up here with `metadata.kind: "crypto_wallet_topup"`. |
| `GET` | `/wallet/store/rates` | Spot USD ↔ crypto rates. Already includes ETH, BTC. |
| `POST` | `/wallet/store/convert` | Convert BTC → USD, USDT → ETH, etc. USDT ↔ USD is 1:1 identity. |
| `POST` | `/wallet/store/transfer-multi` | Send crypto to another user's wallet in the same or converted currency. |

---

## Failure semantics

Watcher-side (not exposed as HTTP):

- **Deposit lands, watcher matches address, credit succeeds** — `CryptoTopupTransaction.status = "credited"`, wallet balance increments, `WalletTransaction` row written.
- **Deposit lands, watcher fires twice** (WS + reconciler race) — first credit wins, second insert throws E11000 on `metadata.dedupeKey`, watcher swallows silently, no double-credit.
- **Deposit lands, StoreWallet has vanished mid-op** — `CryptoTopupTransaction.status = "failed"` with `failureReason` set, wallet balance NOT incremented. Ops replays from tx hash after fixing the wallet.
- **Deposit at an unrecognised address** — watcher's address-cache fast-reject drops the event before any DB work. No row, no log noise.
- **User sends USDT on the wrong chain** (e.g. USDT-BEP20 to their USDT-TRC20 address) — the wrong-chain address is either not ours (drops in the watcher) OR belongs to a different user (that user gets credited). Same failure mode as any exchange; the FE MUST show a "you're on Tron — do not send from a Polygon wallet" warning next to the QR.

FE-side error surfacing:

- 404 with `"No deposit address provisioned yet…"` → show a "Wallet setup in progress" banner; the backfill script + `ensureCryptobrandWallets` on the next org touch will fix it.
- 400 with wallet-currency error → hide the "Add funds" button for USD/INR wallets entirely rather than rendering the button and hitting the error.

---

## Data-flow diagram

```
   FE (garage-web-app-nextjs-v1)
     │
     │  GET /wallet/store/balance
     │  GET /wallet/store/topup-address?walletId=X&chain=tron
     │  GET /wallet/store/topup-transactions?walletId=X
     ▼
   ┌────────────────────────────────────────────────┐
   │  garagenew-backend (main)                      │
   │  ─────────────────────────                     │
   │  routes/wallet.ts  ── read UserCryptoAddress   │
   │                  └─ read CryptoTopupTransaction│
   └────────────────────────────────────────────────┘
     │  (shared MongoDB cluster)
     ▼
   ┌────────────────────────────────────────────────┐
   │  Shared Mongo                                  │
   │    UserCryptoAddress ← written by              │
   │        allocateUserAddressesFor at office join │
   │    CryptoTopupTransaction ← written by         │
   │        creditUserWalletFromTopup on deposit    │
   │    StoreWallet.balance ← $inc'd by             │
   │        creditUserWalletFromTopup on deposit    │
   └────────────────────────────────────────────────┘
     ▲
     │  (same cluster)
   ┌────────────────────────────────────────────────┐
   │  garage-crypto-backend (crypto.garage.app)     │
   │  ─────────────────────────                     │
   │  cryptoAddressWatcher     (Polygon/BSC USDT)   │
   │  cryptoNativeEvmWatcher   (native ETH)         │
   │  cryptoBitcoinWatcher     (BTC)                │
   │  cryptoTronAddressPoller  (USDT-TRC20)         │
   │        each watches its chain's Transfer /     │
   │        block stream for deposits to any of the │
   │        UserCryptoAddress rows for that chain,  │
   │        and calls creditUserWalletFromTopup.    │
   └────────────────────────────────────────────────┘
             ▲
             │  actual on-chain deposit tx
   ┌────────────────────────────────────────────────┐
   │  Buyer's external wallet (MetaMask / Binance   │
   │  withdrawal / etc) sending BTC / ETH / USDT to │
   │  the persistent deposit address                │
   └────────────────────────────────────────────────┘
```

---

## Related config + env

**No new env vars** for this feature. The existing crypto envs on both
backends cover everything:
- `CRYPTO_WALLET_MNEMONIC` — the seed all deposit addresses derive
  from. Already set.
- `CRYPTO_HD_ENABLED_CHAINS` — must include `polygon`, `bsc`,
  `ethereum`, `tron`, `bitcoin` (all needed for the 5 top-up
  addresses). Already the case.
- `CRYPTO_INFURA_WSS_POLYGON / _BSC / _ETHEREUM` — needed on the
  crypto backend for the watcher stack. Already set.
- `CRYPTO_MEMPOOL_SPACE_WSS` — BTC watcher. Already set.
- `TRONGRID_API_KEY` — Tron poller. Already set.

**No new npm dependencies.**

---

## Migrations + rollout

- On main deploy: `ensureCryptobrandWallets` starts allocating 5
  addresses per new cryptobrand member (existing members are
  unaffected until backfilled).
- Optional one-shot backfill script for existing members:
  `npx tsx src/scripts/backfill-user-crypto-addresses.ts --dry-run`
  then live. See the script's docstring for `--org` scoping.
- After crypto-backend deploy: watchers start monitoring the
  UserCryptoAddress rows automatically (address cache picks them up
  on the next refresh tick — every 4 blocks / 30s / 60s depending on
  chain).
