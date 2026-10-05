# Cryptobrand Office Wallet APIs

Complete reference for the multi-currency wallet system that powers **cryptobrand offices** — orgs where `Organization.officeCreatedFromCryptobrand === true`.

**Audience:** FE devs, integration partners, ops. Anyone who reads or moves money inside these orgs.

**Base URL:** `https://test.garage.app` (staging) · `https://my.garage.app` (prod)

**Auth:** every endpoint expects `Authorization: Bearer <JWT>` unless noted.

---

## Table of contents

1. [What a cryptobrand office is](#1-what-a-cryptobrand-office-is)
2. [The four-wallet model](#2-the-four-wallet-model)
3. [Read APIs — balances](#3-read-apis--balances)
4. [Read APIs — transactions](#4-read-apis--transactions)
5. [Pay an invoice from a wallet](#5-pay-an-invoice-from-a-wallet)
6. [Self-convert between currencies (new)](#6-self-convert-between-currencies-new)
7. [Peer transfer — USD-only same-org (legacy)](#7-peer-transfer--usd-only-same-org-legacy)
8. [Peer transfer — multi-currency (new)](#8-peer-transfer--multi-currency-new)
9. [FX rate behavior](#9-fx-rate-behavior)
10. [Idempotency + guardrails](#10-idempotency--guardrails)
11. [Error catalog](#11-error-catalog)
12. [End-to-end example](#12-end-to-end-example)

---

## 1. What a cryptobrand office is

An `Organization` doc where `officeCreatedFromCryptobrand: true`. Set by:

- Cryptobrand office bootstrap flow (`POST /org/create-first-time` → mints `Pro` + `Cryptosub` invoices).
- Upgrade flow (`POST /org/:orgId/cryptobrand-upgrade`).
- Legacy: some older orgs were manually flagged during migration.

The flag drives one thing: **when a user becomes a member of a cryptobrand org (or hits an API that lists their wallets on it), we auto-provision four sibling `StoreWallet` docs** — USD (parent) + INR + ETH + BTC. Non-cryptobrand orgs only ever have the USD wallet.

Check whether a given org is cryptobrand: the field is on the `Organization` doc; the FE reads it indirectly via `GET /wallet/store/currencies` which returns the flag and the roster in one call.

---

## 2. The four-wallet model

For a cryptobrand-member `(userId, orgId)` pair:

| Wallet | `currency` | `parentWalletId` | Notes |
|---|---|---|---|
| USD | `"USD"` | `null` | The parent. Every user in any org gets one. |
| INR | `"INR"` | USD wallet's `_id` | Sibling. Balance held in rupees. |
| ETH | `"ETH"` | USD wallet's `_id` | Sibling. Balance held in ETH. |
| BTC | `"BTC"` | USD wallet's `_id` | Sibling. Balance held in BTC. |

Each wallet has its own independent balance and its own transaction ledger. The `parentWalletId` link is structural metadata only — credits/debits land on whichever specific-currency wallet you target.

**Unique index:** `{userId: 1, orgId: 1, currency: 1}` is unique — a user has at most one wallet per (org, currency) pair.

**Where sibling creation fires:**
- `GET /wallet/all` — for every org in `user.organizations`.
- `GET /wallet/store/currencies?orgId=X` — for the specified org.
- `GET /wallet/all?invoiceId=X` — for the invoice's issuing org (even if the caller isn't yet a formal member — useful for HiFi buyers).
- HiFi invoice mint — for both the buyer and the seller founder.
- Transfer credit-leg — the destination wallet auto-materialises on cryptobrand orgs.
- One-shot backfill script for legacy accounts: `src/scripts/backfill-cryptobrand-sibling-wallets.ts`.

---

## 3. Read APIs — balances

### `GET /wallet/all`

Every wallet the caller has, across every org they're a member of. Also fires `ensureCryptobrandWallets` for each org, so cryptobrand siblings are created if missing.

**Query params:**
- `invoiceId` *(optional)* — if provided, also fires ensureCryptobrandWallets for the invoice's issuing org. Useful for the invoice-pay page to surface the sibling wallets even when the buyer isn't a member of the issuer's org.

**Response:**
```json
{
  "success": true,
  "storeWallets": [
    { "_id": "...", "userId": "...", "orgId": { "_id": "...", "name": "InstaCrypto" }, "currency": "USD", "balance": 100 },
    { "_id": "...", "userId": "...", "orgId": { "_id": "...", "name": "InstaCrypto" }, "currency": "INR", "balance": 5000 },
    { "_id": "...", "userId": "...", "orgId": { "_id": "...", "name": "InstaCrypto" }, "currency": "ETH", "balance": 0.0125 },
    { "_id": "...", "userId": "...", "orgId": { "_id": "...", "name": "InstaCrypto" }, "currency": "BTC", "balance": 0.00064 }
  ],
  "affiliateWallet": { ... }
}
```

**curl:**
```bash
curl 'https://test.garage.app/wallet/all?invoiceId=6a91...' \
  -H 'Authorization: Bearer <JWT>'
```

### `GET /wallet/store/balance?orgId=X&currency=Y`

One wallet's balance. `currency` defaults to `"USD"` when omitted (preserves legacy caller behavior).

**Response:**
```json
{ "success": true, "balance": 100, "currency": "USD" }
```

**curl:**
```bash
curl 'https://test.garage.app/wallet/store/balance?orgId=6a88...&currency=BTC' \
  -H 'Authorization: Bearer <JWT>'
```

### `GET /wallet/store/currencies?orgId=X` **(new)**

Roster of ALL currency wallets the caller has in one org, plus the cryptobrand flag. Auto-creates missing siblings on cryptobrand orgs before returning.

**Response:**
```json
{
  "success": true,
  "orgId": "6a884a7a0487687612320498",
  "isCryptobrand": true,
  "wallets": [
    { "currency": "USD", "balance": 100.00, "isParent": true },
    { "currency": "INR", "balance": 5000.00, "isParent": false },
    { "currency": "ETH", "balance": 0.0125,  "isParent": false },
    { "currency": "BTC", "balance": 0.00064, "isParent": false }
  ]
}
```

Non-cryptobrand orgs return `isCryptobrand: false` and a single-entry USD wallet array.

**curl:**
```bash
curl 'https://test.garage.app/wallet/store/currencies?orgId=6a884a7a0487687612320498' \
  -H 'Authorization: Bearer <JWT>'
```

---

## 4. Read APIs — transactions

### `GET /wallet/store/transactions?orgId=X&currency=Y&limit=N&offset=N&type=Z`

Ledger for ONE currency wallet. `currency` defaults to `"USD"` (legacy behavior).

**Query params:**
- `orgId` *(required)*
- `currency` *(optional, default USD)* — `USD | INR | ETH | BTC`. Case-insensitive.
- `limit` *(optional, default 20)*
- `offset` *(optional, default 0)*
- `type` *(optional)* — `credit | debit | transfer`

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "_id": "...",
      "storeWalletId": "...",
      "type": "credit",
      "amount": 100,
      "currency": "USD",
      "balanceBefore": 0,
      "balanceAfter": 100,
      "description": "Wallet convert USD → BTC",
      "metadata": { "fx": { "rate": ..., "path": ["USD", "BTC"] }, "transferGroupId": "..." },
      "status": "completed",
      "createdAt": "2026-09-01T12:00:00.000Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**curl:**
```bash
curl 'https://test.garage.app/wallet/store/transactions?orgId=6a88...&currency=BTC&limit=50' \
  -H 'Authorization: Bearer <JWT>'
```

---

## 5. Pay an invoice from a wallet

### `POST /api/invoices/:invoiceId/pay-with-wallet`

Atomically debits the specified wallet and marks the invoice paid. Cryptobrand invoices set `metadata.allowedWalletCurrencies` (single-entry array), which gates which currency wallets are acceptable.

**Body:**
```json
{
  "walletType": "store",              // or "affiliate"
  "orgId": "6a88...",                 // required for walletType: "store"
  "currency": "INR"                    // required when invoice sets allowedWalletCurrencies
}
```

**Behavior:**
- **Legacy USD-only invoices** (no `allowedWalletCurrencies` metadata): converts to USD internally and debits the USD wallet. `currency` param ignored.
- **Currency-locked invoices** (HiFi, cryptobrand-office invoices): `currency` MUST be in `allowedWalletCurrencies` or the request 400s. Debit happens at parity in that specific currency — no conversion.

**Response:**
```json
{
  "success": true,
  "invoice": { "status": "paid", "paidAt": "...", "paymentCurrency": "INR" }
}
```

**curl:**
```bash
curl -X POST 'https://test.garage.app/api/invoices/6a91.../pay-with-wallet' \
  -H 'Authorization: Bearer <JWT>' \
  -H 'Content-Type: application/json' \
  -d '{"walletType":"store","orgId":"6a88...","currency":"INR"}'
```

**Error when currency mismatch:**
```json
{
  "success": false,
  "error": "currency \"USD\" is not accepted by this invoice"
}
```

---

## 6. Self-convert between currencies **(new)**

### `POST /wallet/store/convert`

Atomic transfer between two currency wallets the caller controls. Cross-org allowed (both orgs must have caller as a member). Live FX at spot — no fees.

**Body:**
```json
{
  "fromOrgId": "6a88...",              // required, caller must be a member
  "fromCurrency": "USD",                // USD | INR | ETH | BTC
  "toOrgId": "6a88...",                // same or different org — caller must be a member
  "toCurrency": "BTC",
  "amount": 100,                         // in fromCurrency's major unit
  "note": "optional internal note",
  "dedupeKey": "optional-uuid"           // optional idempotency (200-char max)
}
```

**Response:**
```json
{
  "success": true,
  "fromWallet": {
    "userId": "...",
    "orgId": "6a88...",
    "currency": "USD",
    "balanceBefore": 500,
    "balanceAfter": 400,
    "amountDebited": 100
  },
  "toWallet": {
    "userId": "...",
    "orgId": "6a88...",
    "currency": "BTC",
    "balanceBefore": 0,
    "balanceAfter": 0.00129,
    "amountCredited": 0.00129
  },
  "fx": {
    "fromCurrency": "USD",
    "toCurrency": "BTC",
    "rate": 0.0000129,
    "path": ["USD", "BTC"],
    "capturedAt": "2026-09-01T12:00:00.000Z"
  },
  "transactionIds": { "debit": "...", "credit": "..." },
  "transferGroupId": "68b7..."
}
```

**curl:**
```bash
curl -X POST 'https://test.garage.app/wallet/store/convert' \
  -H 'Authorization: Bearer <JWT>' \
  -H 'Content-Type: application/json' \
  -d '{
    "fromOrgId": "6a884a7a0487687612320498",
    "fromCurrency": "USD",
    "toOrgId": "6a884a7a0487687612320498",
    "toCurrency": "BTC",
    "amount": 100
  }'
```

**Cross-currency semantics:**
- Same → same: 400 `IDENTICAL_ENDPOINTS` if src == dst wallet.
- USD ↔ INR: single-hop via existing `USD/INR` rate (1h cached).
- USD ↔ ETH / BTC: single-hop via CoinGecko (5min cached).
- INR ↔ ETH / BTC: two-hop internally through USD. Response `path` records the pivot: `["INR","USD","BTC"]`.

---

## 7. Peer transfer — USD-only same-org (legacy)

### `POST /wallet/store/transfer`

Existing endpoint. USD-only, same-org, cross-user. Kept unchanged for backward compat with every existing FE caller.

**Body:**
```json
{
  "toUserId": "6a42...",
  "orgId": "6a88...",                  // same org for sender + recipient
  "amount": 50,                          // in USD dollars
  "description": "Payment for design work"
}
```

**Use this only when** you need the legacy behavior. For anything multi-currency or cross-org, use `/wallet/store/transfer-multi` below.

---

## 8. Peer transfer — multi-currency **(new)**

### `POST /wallet/store/transfer-multi`

Atomic transfer from caller's wallet to another user's wallet. Cross-org allowed on both sides. Cross-currency allowed (converts at spot).

**Body:**
```json
{
  "toUserId": "6a42...",
  "fromOrgId": "6a88...",              // caller must be a member
  "fromCurrency": "USD",
  "toOrgId": "6a89...",                // recipient must be a member (may differ from fromOrgId)
  "toCurrency": "BTC",
  "amount": 100,                         // in fromCurrency's major unit
  "description": "Payment for design work",   // required
  "note": "optional internal note",
  "dedupeKey": "optional-uuid"
}
```

**Response:** identical shape to `/wallet/store/convert` above. The FX field records the live rate captured at debit time; `toWallet.amountCredited` is what actually landed.

**curl:**
```bash
curl -X POST 'https://test.garage.app/wallet/store/transfer-multi' \
  -H 'Authorization: Bearer <JWT>' \
  -H 'Content-Type: application/json' \
  -d '{
    "toUserId": "6a428280ef41a60b5c8d6143",
    "fromOrgId": "68f1fe05876fcc5fadb61951",
    "fromCurrency": "USD",
    "toOrgId": "6a884a7a0487687612320498",
    "toCurrency": "BTC",
    "amount": 50,
    "description": "Design work retainer"
  }'
```

**Membership rules:**
- Caller MUST be a member of `fromOrgId` → 403 otherwise.
- Recipient MUST be a member of `toOrgId` → 400 otherwise.

---

## 9. FX rate behavior

### Sources

| Pair | Source | Cache TTL |
|---|---|---|
| USD ↔ INR | `open.er-api.com/v6/latest/USD` | 1 hour |
| USD ↔ ETH | `api.coingecko.com/api/v3/simple/price?ids=ethereum` | 5 minutes |
| USD ↔ BTC | `api.coingecko.com/api/v3/simple/price?ids=bitcoin` | 5 minutes |

Both feeds are free tier — no API key required.

### Captured at debit time

The rate is quoted once at the moment the transfer executes, then stamped on both `WalletTransaction` rows via `metadata.fx = {rate, from, to, path, capturedAt}`. Reconciliation and audit can always reconstruct the exact rate applied.

### Slippage

Rates can move between the moment the caller reads a quote and the moment they submit. The rate applied is always the rate captured at submit — not the display rate. For most consumer flows a 5-min TTL means slippage is bounded to whatever the market moved in that window.

### Failure policy

If a required rate is unreachable AND has no fresh cache entry, the endpoint returns **503 `FX_FEED_UNAVAILABLE`**. No fallback rate — we'd rather refuse the transfer than lock in a stale-or-fabricated number.

---

## 10. Idempotency + guardrails

### Idempotency (`dedupeKey`)

Every convert/transfer accepts an optional `dedupeKey` string (1-200 chars). Both `WalletTransaction` rows (debit + credit) get it stamped in `metadata.dedupeKey`, and a partial-unique Mongo index catches replays as `409 DUPLICATE_DEDUPE_KEY`.

Best practice for integration partners:
- Generate a UUID per logical operation and pass it as the `dedupeKey`.
- On network timeout or unclear result, safely retry with the SAME `dedupeKey` — if the original went through, the retry surfaces `409 DUPLICATE_DEDUPE_KEY` and you know the money moved.

### Atomicity

`transferBetweenWallets` runs inside a single `mongoose.startSession()` + `withTransaction()`. Either both wallets update AND both ledger rows are inserted, or nothing changes. Never a half-transfer.

### Balance precision

Balances are rounded to 8 decimal places at write time. Amount ≤ balance is checked against the 8-decimal-rounded value, so a `0.00000001` float artefact doesn't nudge the check over.

### Membership

- Convert: caller must be a member of BOTH `fromOrgId` and `toOrgId`.
- Transfer-multi: caller in `fromOrgId`, recipient in `toOrgId`.
- Both are strict — 403 or 400 respectively.

### Wallet auto-create on destination

For cryptobrand orgs, the destination sibling wallet is auto-created if missing. For non-cryptobrand orgs, only USD gets auto-created — a non-USD credit target on a non-cryptobrand org returns `400 WALLET_NOT_FOUND`.

### Source wallet must exist

The source wallet MUST already exist — no auto-create on the debit leg. `400 WALLET_NOT_FOUND` if missing.

---

## 11. Error catalog

Every convert / transfer-multi failure returns:
```json
{ "success": false, "code": "ERROR_CODE", "error": "human-readable message" }
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `INVALID_AMOUNT` | `amount` non-positive or non-numeric |
| 400 | `UNSUPPORTED_CURRENCY` | Currency not in `[USD, INR, ETH, BTC]` |
| 400 | `IDENTICAL_ENDPOINTS` | Source and destination wallets are the same |
| 400 | `WALLET_NOT_FOUND` | Source wallet missing (or destination missing on non-cryptobrand org) |
| 400 | `INSUFFICIENT_BALANCE` | Source balance < requested amount |
| 400 | *(recipient membership)* | Recipient not a member of `toOrgId` |
| 403 | *(caller membership)* | Caller not a member of `fromOrgId` or `toOrgId` |
| 409 | `DUPLICATE_DEDUPE_KEY` | A prior request with the same `dedupeKey` already committed |
| 503 | `FX_FEED_UNAVAILABLE` | Live rate feed down + no fresh cache. Safe to retry. |
| 500 | *(unhandled)* | Unexpected server error. Full traceback in server logs. |

---

## 12. End-to-end example

**Scenario:** Camilla (member of `InstaCrypto`, a cryptobrand org) holds $500 USD. She wants to send Shorupan `~0.001 BTC` from her USD balance for design work. Shorupan is also a member of `InstaCrypto`.

### Step 1 — Read the roster to build the FE picker

```bash
curl 'https://test.garage.app/wallet/store/currencies?orgId=6a884a7a0487687612320498' \
  -H 'Authorization: Bearer <camilla_jwt>'
```

Response:
```json
{
  "success": true,
  "orgId": "6a884a7a0487687612320498",
  "isCryptobrand": true,
  "wallets": [
    { "currency": "USD", "balance": 500,     "isParent": true },
    { "currency": "INR", "balance": 0,       "isParent": false },
    { "currency": "ETH", "balance": 0,       "isParent": false },
    { "currency": "BTC", "balance": 0,       "isParent": false }
  ]
}
```

### Step 2 — Send

```bash
curl -X POST 'https://test.garage.app/wallet/store/transfer-multi' \
  -H 'Authorization: Bearer <camilla_jwt>' \
  -H 'Content-Type: application/json' \
  -d '{
    "toUserId": "<shorupan_user_id>",
    "fromOrgId": "6a884a7a0487687612320498",
    "fromCurrency": "USD",
    "toOrgId":   "6a884a7a0487687612320498",
    "toCurrency": "BTC",
    "amount": 100,
    "description": "Design work retainer",
    "dedupeKey": "camilla-2026-09-01-01"
  }'
```

Response:
```json
{
  "success": true,
  "fromWallet": {
    "userId": "6a428280ef41a60b5c8d6143",
    "orgId": "6a884a7a0487687612320498",
    "currency": "USD",
    "balanceBefore": 500,
    "balanceAfter":  400,
    "amountDebited": 100
  },
  "toWallet": {
    "userId": "<shorupan_user_id>",
    "orgId":  "6a884a7a0487687612320498",
    "currency": "BTC",
    "balanceBefore": 0,
    "balanceAfter":  0.00129,
    "amountCredited": 0.00129
  },
  "fx": {
    "fromCurrency": "USD",
    "toCurrency":   "BTC",
    "rate": 0.0000129,
    "path": ["USD", "BTC"],
    "capturedAt": "2026-09-01T12:00:00.000Z"
  },
  "transactionIds": { "debit": "...", "credit": "..." },
  "transferGroupId": "68b7..."
}
```

### Step 3 — What just happened in the DB

Two `WalletTransaction` docs written, linked by `metadata.transferGroupId`:

**Debit — on Camilla's USD wallet:**
```json
{
  "storeWalletId": "camilla_usd_wallet_id",
  "userId": "camilla_id",
  "type": "debit",
  "amount": 100,
  "currency": "USD",
  "balanceBefore": 500,
  "balanceAfter": 400,
  "description": "Design work retainer",
  "relatedUserId": "shorupan_id",
  "metadata": {
    "kind": "wallet_transfer_multi",
    "transferGroupId": "68b7...",
    "leg": "debit",
    "fx": { "rate": 0.0000129, "path": ["USD","BTC"], "capturedAt": "..." },
    "counterparty": { "userId": "shorupan_id", "orgId": "6a88...", "currency": "BTC" },
    "dedupeKey": "camilla-2026-09-01-01"
  }
}
```

**Credit — on Shorupan's BTC wallet** (auto-created if it didn't exist):
```json
{
  "storeWalletId": "shorupan_btc_wallet_id",
  "userId": "shorupan_id",
  "type": "credit",
  "amount": 0.00129,
  "currency": "BTC",
  "balanceBefore": 0,
  "balanceAfter": 0.00129,
  "description": "Design work retainer",
  "relatedUserId": "camilla_id",
  "metadata": {
    "kind": "wallet_transfer_multi",
    "transferGroupId": "68b7...",
    "leg": "credit",
    "fx": { ... },
    "counterparty": { "userId": "camilla_id", "orgId": "6a88...", "currency": "USD" },
    "dedupeKey": "camilla-2026-09-01-01"
  }
}
```

### Step 4 — Retry-safety

If Camilla's client times out and she retries with the same `dedupeKey`:
```json
{ "success": false, "code": "DUPLICATE_DEDUPE_KEY", "error": "A transfer with this dedupeKey already succeeded." }
```

No double-debit. She can render the previous success screen with confidence.

---

## Version history

- **2026-09-01** — Initial release. Adds `GET /wallet/store/currencies`, `POST /wallet/store/convert`, `POST /wallet/store/transfer-multi`. Extends `GET /wallet/store/transactions` with `currency` filter. Legacy `POST /wallet/store/transfer` untouched.
