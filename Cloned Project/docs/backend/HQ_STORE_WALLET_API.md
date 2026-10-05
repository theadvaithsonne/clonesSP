# Garage HQ Store Wallet API

Programmatic, server-to-server access to a user's **Garage HQ Store Wallet** — the `StoreWallet` row scoped to the org with `parent: true` (one row, exactly). Read balance, list transactions, and debit the wallet for service charges, all by `userId`.

These endpoints are designed for an internal billing / metering service. They mirror the existing `/wallet/internal/*` pattern Agent-Manager uses and write standard `WalletTransaction` rows so every debit shows up natively in the user's Vault feed — no FE changes required.

---

## Table of contents

- [1. Concept](#1-concept)
- [2. Auth](#2-auth)
- [3. Base URL](#3-base-url)
- [4. End-to-end flow](#4-end-to-end-flow)
- [5. Endpoint reference](#5-endpoint-reference)
  - [GET /wallet/hq/users/:userId/balance](#get-wallethqusersuseridbalance)
  - [GET /wallet/hq/users/:userId/transactions](#get-wallethqusersuseridtransactions)
  - [GET /wallet/hq/users/:userId/summary](#get-wallethqusersuseridsummary)
  - [POST /wallet/hq/users/:userId/debit](#post-wallethqusersuseriddebit)
- [6. Idempotency](#6-idempotency)
- [7. Error codes](#7-error-codes)
- [8. TypeScript types](#8-typescript-types)
- [9. Worked example — charge $5 for service usage](#9-worked-example--charge-5-for-service-usage)
- [10. FAQ + edge cases](#10-faq--edge-cases)

---

## 1. Concept

**Garage HQ** is the single organization with `parent: true` in the `organizations` collection (canonical lookup: `Organization.findOne({ parent: true })`). Every Garage user can hold a `StoreWallet` row keyed `{ userId, orgId: <HQ> }` that stores their HQ-scoped balance in USD float. The wallet is **lazy-created** — it doesn't exist until a credit or top-up runs.

This API gives an internal system the four operations it needs to charge against that wallet:

1. **Check** the balance (is the user good for $X?).
2. **List** transactions for audit/dashboard surfaces.
3. **Snapshot** balance + counts + recent rows in one round-trip.
4. **Debit** a specific amount with a description that lands in the user's Vault history.

There is **no credit endpoint** in this surface — credits enter through the existing invoice / top-up / commission-distribution paths so money-in attribution stays honest.

---

## 2. Auth

Every request requires the `X-Internal-Api-Key` header set to the value of the `INTERNAL_API_KEY` env. No user identity — the caller IS the platform. Same gate as `/wallet/internal/balance` and `/wallet/internal/deduct`.

```
X-Internal-Api-Key: <INTERNAL_API_KEY>
```

Responses to a missing / wrong / unconfigured key:

| HTTP | Body | When |
|---|---|---|
| `401` | `{ error: "Invalid internal API key" }` | Header missing or doesn't match `INTERNAL_API_KEY`. |
| `503` | `{ error: "Internal API not configured" }` | `INTERNAL_API_KEY` env not set on the server. |

> **Server-to-server only.** Don't ship this key to a browser — no CORS for these routes; the gate is meant for backend-to-backend traffic. For user-facing wallet reads, use the existing `/wallet/store/balance` route under `requireAuth`.

---

## 3. Base URL

```
<API_URL>/wallet/hq
```

`<API_URL>` is the Garage backend host. All paths in this doc are relative to that base.

---

## 4. End-to-end flow

Typical "meter and charge" loop:

```
external billing service                Garage backend
       │
       │  ── GET  /wallet/hq/users/<userId>/balance
       │       X-Internal-Api-Key: ...
       │ ───────────────────────────────►
       │ ◄─── 200 { balanceCents: 1500, ... }
       │
       │  decide: 500¢ ≤ 1500¢ → ok to charge
       │
       │  ── POST /wallet/hq/users/<userId>/debit
       │       X-Internal-Api-Key: ...
       │       Idempotency-Key: charge-2026-06-17-svc-9912
       │       { amountCents: 500, description: "GPU minute · session sess_123" }
       │ ───────────────────────────────►
       │ ◄─── 200 { balanceCents: 1000, transaction: { _id, balanceAfter, ... } }
       │
       │  on 402:
       │    ◄── 402 { error: "insufficient_balance", balanceCents: 200, requestedCents: 500 }
       │    → tell user to top up via Vault → retry on success
       │
       ▼
```

After a successful debit, the corresponding `WalletTransaction` row appears at the top of the user's Vault → Store wallet feed with the supplied `description`.

---

## 5. Endpoint reference

> All non-trivial responses are `application/json`. Successful responses include `success: true`. Errors include `success: false`, `error: <code>`, and `message: <string>`.

### `GET /wallet/hq/users/:userId/balance`

Returns the user's HQ Store Wallet balance, the matured (withdrawable) portion in cents, and the timestamp of the last balance change.

**Path params**
| Param | Notes |
|---|---|
| `userId` | Valid Mongo ObjectId. 400 if malformed. |

**Response — `200`**

```json
{
  "success": true,
  "userId": "65f8d2c1a3b4e5d6f7a8b900",
  "orgId": "68f1fe05876fcc5fadb61951",
  "balance": 12.50,
  "balanceCents": 1250,
  "currency": "USD",
  "withdrawableBalanceCents": 1100,
  "lastTransactionAt": "2026-06-15T14:23:55.121Z",
  "exists": true
}
```

- `balance` — float USD (same unit `StoreWallet.balance` stores).
- `balanceCents` — integer cents, derived. Use this for math; avoids float drift.
- `withdrawableBalanceCents` — the slice that has matured past the most recent Sunday-night IST cutoff (existing maturity rule). Newer credits stay locked until the next boundary.
- `exists` — `false` if the user has no HQ wallet yet (returns `balance: 0`, `currency: "USD"` defaults).

**Example**

```bash
curl -sS "$API_URL/wallet/hq/users/65f8d2c1a3b4e5d6f7a8b900/balance" \
  -H "X-Internal-Api-Key: $INTERNAL_API_KEY"
```

---

### `GET /wallet/hq/users/:userId/transactions`

Paginated list of `WalletTransaction` rows for the user's HQ wallet, newest first. Mirrors what the Vault feed renders.

**Query**

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | int | 20 | Clamped to `[1, 200]`. |
| `offset` | int | 0 | For pagination. |
| `type` | enum | (any) | One of `credit`, `debit`, `transfer`, `withdrawal`. |

**Response — `200`**

```json
{
  "success": true,
  "userId": "65f8d2c1a3b4e5d6f7a8b900",
  "orgId": "68f1fe05876fcc5fadb61951",
  "limit": 20,
  "offset": 0,
  "total": 47,
  "transactions": [
    {
      "_id": "660a1f8c...",
      "storeWalletId": "65f8d2c1...",
      "walletType": "store",
      "userId": "65f8d2c1a3b4e5d6f7a8b900",
      "orgId": "68f1fe05876fcc5fadb61951",
      "type": "debit",
      "amount": 5.0,
      "currency": "USD",
      "balanceBefore": 12.50,
      "balanceAfter": 7.50,
      "description": "GPU minute · session sess_123",
      "relatedUserId": null,
      "metadata": { "source": "hq_internal_debit", "idempotencyKey": "charge-..." },
      "status": "completed",
      "createdAt": "2026-06-17T11:02:14.000Z"
    }
  ]
}
```

Returns `total: 0, transactions: []` when the wallet doesn't exist (lazy-create on first credit).

---

### `GET /wallet/hq/users/:userId/summary`

One-shot snapshot for a dashboard card: balance + cumulative counts/totals per `type` + the N most recent transactions. Cheaper than three separate calls.

**Query**

| Param | Type | Default | Notes |
|---|---|---|---|
| `recent` | int | 5 | Clamped to `[0, 50]`. Number of recent rows to include. |

**Response — `200`**

```json
{
  "success": true,
  "userId": "65f8d2c1a3b4e5d6f7a8b900",
  "orgId": "68f1fe05876fcc5fadb61951",
  "balance": 12.50,
  "balanceCents": 1250,
  "currency": "USD",
  "withdrawableBalanceCents": 1100,
  "lastTransactionAt": "2026-06-15T14:23:55.121Z",
  "totalTransactions": 47,
  "countsByType": {
    "credit":   { "count": 12, "total": 280.00 },
    "debit":    { "count": 30, "total": 245.50 },
    "transfer": { "count":  3, "total":  22.00 },
    "withdrawal": { "count": 2, "total": 0.00 }
  },
  "recentTransactions": [ /* same shape as transactions[] above */ ],
  "exists": true
}
```

`countsByType.<type>.total` is summed `amount` (float USD) across all transactions of that type — useful for cumulative spend/earn charts.

---

### `POST /wallet/hq/users/:userId/debit`

Deducts USD from the user's HQ Store Wallet and writes a `debit` `WalletTransaction`. Hard-rejects when the wallet is short — no overdraft, no partial debit.

**Headers**

| Header | Required | Notes |
|---|---|---|
| `X-Internal-Api-Key` | yes | Auth. |
| `Idempotency-Key` | no | Free-form string (recommended ≤ 128 chars). Within 24h, a repeat key with same `userId` returns the original transaction unchanged. See [§6 Idempotency](#6-idempotency). |

**Body**

```json
{
  "amountCents": 500,
  "description": "GPU minute · session sess_123"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `amountCents` | int | ✓ | `100 ≤ amountCents ≤ 1_000_000` (i.e. $1.00 – $10,000.00). |
| `description` | string | ✓ | 3–500 chars. Becomes `WalletTransaction.description` — visible in the user's Vault history. |

**Response — `200` (success)**

```json
{
  "success": true,
  "replay": false,
  "balanceBefore": 12.50,
  "balanceAfter": 7.50,
  "balanceCents": 750,
  "transaction": {
    "_id": "660a1f8c...",
    "userId": "65f8d2c1a3b4e5d6f7a8b900",
    "orgId": "68f1fe05876fcc5fadb61951",
    "type": "debit",
    "amount": 5.0,
    "currency": "USD",
    "balanceBefore": 12.50,
    "balanceAfter": 7.50,
    "description": "GPU minute · session sess_123",
    "status": "completed",
    "createdAt": "2026-06-17T11:02:14.000Z"
  }
}
```

**Response — `200` (idempotent replay)**

```json
{
  "success": true,
  "replay": true,
  "balanceCents": 750,
  "balanceBefore": 12.50,
  "balanceAfter": 7.50,
  "transaction": { /* original transaction unchanged */ }
}
```

**Response — `402` (insufficient balance)**

```json
{
  "success": false,
  "error": "insufficient_balance",
  "message": "Insufficient HQ wallet balance for user 65f8d2c1a3b4e5d6f7a8b900",
  "balanceCents": 200,
  "requestedCents": 500
}
```

Also returned when the user has no HQ wallet yet (wallet not found = balance is 0 = insufficient for any positive amount).

**Response — `400` (invalid input)**

```json
{
  "success": false,
  "error": "invalid_body",
  "message": "Invalid request payload",
  "details": [ /* Zod issues array */ ]
}
```

**Example**

```bash
curl -sS -X POST "$API_URL/wallet/hq/users/65f8d2c1a3b4e5d6f7a8b900/debit" \
  -H "X-Internal-Api-Key: $INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: charge-2026-06-17-svc-9912" \
  -d '{ "amountCents": 500, "description": "GPU minute · session sess_123" }'
```

---

## 6. Idempotency

Pass an `Idempotency-Key` header on every debit request and you get **exactly-once charging** for free.

- **Window**: 24 hours. After that, the same key on the same user can charge again (treated as a new request).
- **Scope**: `(userId, orgId=HQ, walletType="store", type="debit", metadata.idempotencyKey)` — keys never collide across users.
- **Replay shape**: `200` with `replay: true` and the original `transaction` object. Balance is **not** decremented again.
- **Storage**: persisted on `WalletTransaction.metadata.idempotencyKey`. No separate index — Mongo's free-text match on a populated field is fast at this scale; revisit if the debit volume grows by 100x.

**When to use it.** Any retry-prone path — webhook handlers, cron-driven billing sweeps, network-failure retries. Skip it for one-shot admin tools where a retry would be intentional.

**Key format suggestion**: `<purpose>-<isoDate>-<scope>-<nonce>` — e.g. `gpu-charge-2026-06-17-sess_123-9912`. Anything ≤ 128 chars works.

---

## 7. Error codes

| HTTP | `error` | When | Notes |
|---|---|---|---|
| `400` | `invalid_user_id` | `:userId` isn't a valid Mongo ObjectId. | Hard fail before any DB lookup. |
| `400` | `invalid_body` | Zod validation failed on the debit body. | `details` carries the issues array. |
| `401` | (raw `{ error: "Invalid internal API key" }`) | Missing / wrong `X-Internal-Api-Key`. | Set on every endpoint. |
| `402` | `insufficient_balance` | Wallet missing OR shortfall on debit. | Returns `balanceCents` + `requestedCents`. |
| `500` | `internal_error` | Anything unexpected (DB down, etc.). | Includes `message`. |
| `503` | (raw `{ error: "Internal API not configured" }`) | `INTERNAL_API_KEY` env not set on the server. | Operational; fix the env. |

`404` is intentionally NOT used for "wallet missing" — the wallet is lazy-created, so "no wallet yet" is functionally `$0`, and a debit against $0 is `402 insufficient_balance`.

---

## 8. TypeScript types

```ts
export interface HqWalletBalance {
  success: true;
  userId: string;
  orgId: string;
  balance: number;             // float USD
  balanceCents: number;        // integer cents, derived
  currency: "USD";
  withdrawableBalanceCents: number;
  lastTransactionAt: string | null;
  exists: boolean;
}

export interface HqWalletTransaction {
  _id: string;
  storeWalletId: string;
  walletType: "store";
  userId: string;
  orgId: string;
  type: "credit" | "debit" | "transfer" | "withdrawal";
  amount: number;              // float USD
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  relatedUserId: string | null;
  metadata: Record<string, unknown> | null;
  status: "completed" | "pending" | "failed" | "reversed";
  createdAt: string;
}

export interface HqWalletTransactionsResponse {
  success: true;
  userId: string;
  orgId: string;
  limit: number;
  offset: number;
  total: number;
  transactions: HqWalletTransaction[];
}

export interface HqWalletSummary {
  success: true;
  userId: string;
  orgId: string;
  balance: number;
  balanceCents: number;
  currency: "USD";
  withdrawableBalanceCents: number;
  lastTransactionAt: string | null;
  totalTransactions: number;
  countsByType: Record<
    "credit" | "debit" | "transfer" | "withdrawal",
    { count: number; total: number }
  >;
  recentTransactions: HqWalletTransaction[];
  exists: boolean;
}

export interface DebitRequest {
  amountCents: number;         // integer, 100 ≤ x ≤ 1_000_000
  description: string;         // 3 – 500 chars
}

export interface DebitSuccess {
  success: true;
  replay: boolean;
  balanceBefore: number;
  balanceAfter: number;
  balanceCents: number;
  transaction: HqWalletTransaction;
}

export interface InsufficientBalanceError {
  success: false;
  error: "insufficient_balance";
  message: string;
  balanceCents: number;
  requestedCents: number;
}
```

---

## 9. Worked example — charge $5 for service usage

**1) Check balance.**

```bash
curl -sS "$API_URL/wallet/hq/users/USER_ID/balance" \
  -H "X-Internal-Api-Key: $INTERNAL_API_KEY"
```

```json
{ "balanceCents": 1250, "exists": true, ... }
```

**2) Debit $5 with an idempotency key.**

```bash
curl -sS -X POST "$API_URL/wallet/hq/users/USER_ID/debit" \
  -H "X-Internal-Api-Key: $INTERNAL_API_KEY" \
  -H "Idempotency-Key: gpu-charge-2026-06-17-sess_123" \
  -H "Content-Type: application/json" \
  -d '{ "amountCents": 500, "description": "GPU minute · session sess_123" }'
```

```json
{
  "success": true,
  "replay": false,
  "balanceBefore": 12.50,
  "balanceAfter": 7.50,
  "balanceCents": 750,
  "transaction": { "_id": "660a...", "type": "debit", "amount": 5.0, ... }
}
```

**3) Retry with same key (network glitch).** Same response shape but `replay: true` and the original `transaction._id`. Balance still `750`.

**4) User opens the Vault → Store tab.** The debit appears at the top of their feed:

```
GPU minute · session sess_123                              −$5.00
2 minutes ago                                          balance: $7.50
```

---

## 10. FAQ + edge cases

**Q: What if the user has no HQ wallet yet?**
A: Reads return `balance: 0`, `currency: "USD"`, `exists: false`. Debit returns `402 insufficient_balance` with `balanceCents: 0`. The wallet is lazy-created on the first **credit** (invoice fulfillment, top-up, transfer-in) — not by these read/debit endpoints. This is deliberate: a debit against a never-existed wallet is logically the same as a debit against $0, and the caller should treat both identically.

**Q: Can I credit a wallet through this surface?**
A: No. Credits are intentionally absent so money-in attribution stays auditable. Use:
- the buyer-driven **top-up flow** (`POST /wallet/store/topup` → existing invoice + payment),
- commission distribution (automatic on invoice paid),
- founder credit (`POST /wallet/store/credit`, `requireAuth + requireOrgAdmin`).

**Q: What if the description contains user-supplied content?**
A: It's stored verbatim. No HTML escaping, no length truncation beyond the 500-char cap. The FE Vault already escapes when rendering — but if your description sources from user input, sanitize before sending.

**Q: Is there a webhook on successful debit?**
A: No. The caller has the response synchronously. The user's Vault picks it up the next time they open the page (no realtime push — by design).

**Q: Rate limits?**
A: Inherits the global Garage rate limit. No per-endpoint cap. Idempotency makes safe retries cheap.

**Q: Currency conversion?**
A: Out of scope. HQ Store Wallets are USD-only. If you want to charge in INR / EUR, convert at your end and submit `amountCents` in USD.

**Q: Refunds?**
A: No refund endpoint. To reverse a debit, issue a manual founder credit via `POST /wallet/store/credit` (separate auth model). Out of scope here.

**Q: Can I query a different org's wallet through this surface?**
A: No — every endpoint resolves the HQ org server-side (`parent: true`). For other orgs, use the existing org-scoped endpoints under `requireAuth` / `requireFounder`.

---

## Changelog

| Version | Notes |
|---|---|
| 1.0 | Initial: 3 GET endpoints (balance, transactions, summary) + 1 POST (debit) under `/wallet/hq`. Internal-key auth. Hard-reject on insufficient. 24h idempotency window. |
