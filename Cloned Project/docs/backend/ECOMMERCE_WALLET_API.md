# Ecommerce Wallet API

Buyer-facing wallet reads for the external **Garage e-commerce storefront**. Given a logged-in buyer's Garage Bearer JWT, return their wallet for one storefront (typical case — the storefront they're shopping at) or every storefront they have activity in (dashboard / "my wallets" view).

Returns the same balance + transaction history + cashback the buyer sees inside the Garage Vault — no FE changes there; this surface is for the external storefront only.

---

## Table of contents

- [1. Concept — multi-wallet model](#1-concept--multi-wallet-model)
- [2. Auth — SSO Bearer JWT](#2-auth--sso-bearer-jwt)
- [3. Base URL](#3-base-url)
- [4. End-to-end flow](#4-end-to-end-flow)
- [5. Endpoint reference](#5-endpoint-reference)
  - [GET /ecommerce/wallet — single storefront snapshot](#get-ecommercewallet--single-storefront-snapshot)
  - [GET /ecommerce/wallets/me — all storefronts the buyer has activity in](#get-ecommercewalletsme--all-storefronts-the-buyer-has-activity-in)
  - [GET /wallet/store/balance — existing, balance only](#get-walletstorebalance--existing-balance-only)
  - [GET /wallet/store/transactions — existing, paginated history](#get-walletstoretransactions--existing-paginated-history)
  - [GET /wallet/store/all — existing, list of all StoreWallets](#get-walletstoreall--existing-list-of-all-storewallets)
  - [GET /cashback-codes/me/received — existing, cashback received history](#get-cashback-codesmereceived--existing-cashback-received-history)
- [6. Empty-state shapes](#6-empty-state-shapes)
- [7. Error codes](#7-error-codes)
- [8. TypeScript types](#8-typescript-types)
- [9. Worked example](#9-worked-example)
- [10. FAQ + edge cases](#10-faq--edge-cases)

---

## 1. Concept — multi-wallet model

A Garage buyer holds **one `StoreWallet` per `(userId, sellerOrgId)`** — i.e. one wallet per storefront they've ever transacted with. There is no single "ecommerce wallet" for a user; the balance always belongs to a specific storefront.

```
                  StoreWallet  (one per (buyer, storefront))
                  ──────────────────────────────────────
buyer = Ravi
  ├── orgId = X (Garage Beauty)   balance: $12.50
  ├── orgId = Y (Garage Fashion)  balance: $0.00
  └── orgId = Z (Garage Coffee)   balance: $4.20
```

**Cashback follows the same keying.** When a buyer applies a cashback code at checkout and pays, the credit lands in `StoreWallet[buyerId, code.orgId]` — where `code.orgId` was set at code-creation time from the bound StoreProduct's owning org. So cashback also belongs to a specific storefront, not a global pool.

**Two access patterns** match the two UI surfaces:

| Surface | Endpoint | Why |
|---|---|---|
| Storefront's "My Wallet" page | `GET /ecommerce/wallet?orgId=<X>` | The buyer is shopping at storefront X — show them their balance + recent activity at X. One round-trip. |
| "All my storefronts" dashboard | `GET /ecommerce/wallets/me` | Lists every storefront with non-zero activity (StoreWallet exists OR cashback received). One row per `(buyer, orgId)`. |

Both endpoints return the same per-org `EcommerceWalletSnapshot` shape.

---

## 2. Auth — SSO Bearer JWT

```
Authorization: Bearer <garage-jwt>
```

The external storefront forwards the **same Garage user JWT** it already uses for the rest of the Garage API (same SSO assumption as the Cashback Codes API). The buyer is identified from the token — endpoints never take a `userId` in the path.

If you need to read another user's wallet (admin/billing tools), use the internal-key surface in [`HQ_STORE_WALLET_API.md`](./HQ_STORE_WALLET_API.md) for the HQ org. There is no internal-key variant of these ecommerce endpoints by design — the buyer is always the caller.

| Failure | HTTP | Body |
|---|---|---|
| Missing / wrong JWT | `401` | `{ error: "Unauthorized" }` |
| Token belongs to a deactivated user | `401` | `{ error: "Unauthorized" }` |

---

## 3. Base URL

```
<API_URL>
```

Endpoints documented here live at:
- `/ecommerce/wallet` (new)
- `/ecommerce/wallets/me` (new)
- `/wallet/store/...` (existing)
- `/cashback-codes/me/received` (existing — also covered in `CASHBACK_CODES_API.md`)

---

## 4. End-to-end flow

Typical storefront "My Wallet" load:

```
external storefront                    Garage backend
       │
       │ buyer opens storefront X "My Wallet" page
       │
       │  ── GET /ecommerce/wallet?orgId=X
       │       Authorization: Bearer <jwt>
       │ ─────────────────────────────────►
       │ ◄─── 200 { orgId, orgName, balance, balanceCents,
       │            withdrawableBalanceCents, recentTransactions[10],
       │            cashback: { totalReceivedUsd, recent[5] } }
       │
       │ render the page from one response
       ▼
```

"All my storefronts" dashboard:

```
       │ buyer opens "My Wallets" dashboard
       │
       │  ── GET /ecommerce/wallets/me
       │       Authorization: Bearer <jwt>
       │ ─────────────────────────────────►
       │ ◄─── 200 { wallets: [
       │              { orgId, orgName: "Garage Beauty", balance, ... },
       │              { orgId, orgName: "Garage Fashion", balance, ... },
       │              ...
       │            ] }
       │
       │ render one card per storefront
       ▼
```

---

## 5. Endpoint reference

### GET /ecommerce/wallet — single storefront snapshot

Combined snapshot for ONE storefront — balance, transactions, cashback — in one round-trip.

**Query**

| Param | Type | Default | Notes |
|---|---|---|---|
| `orgId` | ObjectId | — | Required. The storefront's `Organization._id`. 400 if malformed, 404 if no such org. |
| `recent` | int | 10 | Number of recent `WalletTransaction` rows to include. Clamped to `[0, 50]`. |
| `cashbackRecent` | int | 5 | Number of recent `CashbackDistribution` rows (completed only) to include. Clamped to `[0, 50]`. |

**Response — `200`**

```json
{
  "success": true,
  "orgId": "65a1f8c0d2e4f5a6b7c8d9e0",
  "orgName": "Garage Beauty",
  "balance": 12.50,
  "balanceCents": 1250,
  "currency": "USD",
  "withdrawableBalanceCents": 1100,
  "lastTransactionAt": "2026-06-15T14:23:55.121Z",
  "exists": true,
  "recentTransactions": [
    {
      "_id": "660a1f8c...",
      "type": "credit",
      "amount": 2.70,
      "currency": "USD",
      "balanceBefore": 9.80,
      "balanceAfter": 12.50,
      "description": "Cashback (ASHA5) — invoice INV-2026-00123",
      "status": "completed",
      "createdAt": "2026-06-15T14:23:55.121Z"
    }
  ],
  "cashback": {
    "totalReceivedUsd": 2.70,
    "completedCount": 1,
    "recent": [
      {
        "_id": "660b2c9d...",
        "codeId": "660aabcd...",
        "cashbackAmount": 2.70,
        "productType": "ecommerce",
        "itemId": "65f8d2c1...",
        "saleAmountCents": 5400,
        "appliedRatePct": 5,
        "createdAt": "2026-06-15T14:23:55.000Z"
      }
    ]
  }
}
```

- `balance` — float USD. Use `balanceCents` for math (integer, derived).
- `withdrawableBalanceCents` — matured portion respecting the Sunday-night IST cutoff (existing maturity rule applied uniformly across Store, Affiliate, Content Rewards wallets).
- `exists` — `false` if the buyer has never had a `StoreWallet` row for this org AND has never received cashback here. `balance` is `0` either way.
- `recentTransactions` — newest first. Includes ALL types: credits (cashback, top-ups, founder credits, transfers-in), debits (purchases), transfers, withdrawals.
- `cashback.recent` — completed `CashbackDistribution` rows where the buyer was credited at THIS storefront. `cashback.recent` is a slice; the lifetime sum is in `cashback.totalReceivedUsd`.

**Example**

```bash
curl -sS "$API_URL/ecommerce/wallet?orgId=65a1f8c0d2e4f5a6b7c8d9e0" \
  -H "Authorization: Bearer $JWT"
```

---

### GET /ecommerce/wallets/me — all storefronts the buyer has activity in

Returns one `EcommerceWalletSnapshot` per storefront the buyer has any activity in (StoreWallet row exists OR has ever received cashback there). Sorted by `orgName`.

**Query**: none.

**Response — `200`**

```json
{
  "success": true,
  "wallets": [
    {
      "orgId": "65a1f8c0...",
      "orgName": "Garage Beauty",
      "balance": 12.50,
      "balanceCents": 1250,
      "currency": "USD",
      "withdrawableBalanceCents": 1100,
      "lastTransactionAt": "2026-06-15T14:23:55.121Z",
      "exists": true,
      "recentTransactions": [ /* up to 3 rows */ ],
      "cashback": {
        "totalReceivedUsd": 2.70,
        "completedCount": 1,
        "recent": [ /* up to 3 rows */ ]
      }
    },
    {
      "orgId": "65a1f8c0...",
      "orgName": "Garage Fashion",
      "balance": 0.00,
      "balanceCents": 0,
      "currency": "USD",
      "withdrawableBalanceCents": 0,
      "lastTransactionAt": null,
      "exists": false,
      "recentTransactions": [],
      "cashback": {
        "totalReceivedUsd": 8.40,
        "completedCount": 3,
        "recent": [ /* up to 3 rows */ ]
      }
    }
  ]
}
```

The `recentTransactions` / `cashback.recent` limits are smaller per row (3 each) than the single-storefront endpoint to keep this call cheap when the buyer has many storefronts. For deeper history at one storefront, call `GET /ecommerce/wallet?orgId=<X>` with explicit `recent` / `cashbackRecent` query params.

If the buyer has zero activity across every storefront, `wallets: []`.

**Example**

```bash
curl -sS "$API_URL/ecommerce/wallets/me" \
  -H "Authorization: Bearer $JWT"
```

---

### GET /wallet/store/balance — existing, balance only

Lightweight read when you only need the number.

**Query**: `orgId` (required).

**Response — `200`**

```json
{ "success": true, "balance": 12.50, "currency": "USD" }
```

Lazy-creates the wallet on first call (so a brand-new storefront visitor gets `{ balance: 0, currency: "USD" }` and a fresh wallet row).

```bash
curl -sS "$API_URL/wallet/store/balance?orgId=<X>" \
  -H "Authorization: Bearer $JWT"
```

---

### GET /wallet/store/transactions — existing, paginated history

Full paginated `WalletTransaction` history for one storefront. Use this for an infinite-scroll transactions list — `GET /ecommerce/wallet` returns only the first 10.

**Query**

| Param | Type | Default | Notes |
|---|---|---|---|
| `orgId` | string | — | Required. |
| `limit` | int | 20 | Per `getStoreWalletTransactions`. |
| `offset` | int | 0 | For pagination. |
| `type` | enum | (any) | One of `credit`, `debit`, `transfer`. |

**Response — `200`**

```json
{
  "success": true,
  "transactions": [ /* WalletTransaction rows, newest first */ ],
  "total": 47,
  "limit": 20,
  "offset": 0
}
```

```bash
curl -sS "$API_URL/wallet/store/transactions?orgId=<X>&limit=20&offset=0" \
  -H "Authorization: Bearer $JWT"
```

---

### GET /wallet/store/all — existing, list of all StoreWallets

Returns every `StoreWallet` row the caller has, with the org populated. **No cashback rollup** — use `/ecommerce/wallets/me` for that.

**Query**: none.

**Response — `200`**

```json
{
  "success": true,
  "wallets": [
    {
      "_id": "65f8d2c1...",
      "userId": "65f8d2c1...",
      "orgId": { "_id": "65a1f8c0...", "name": "Garage Beauty", "store": { "name": "...", "slug": "..." } },
      "balance": 12.50,
      "currency": "USD",
      "isActive": true,
      "lastTransactionAt": "2026-06-15T14:23:55.121Z"
    }
  ]
}
```

---

### GET /cashback-codes/me/received — existing, cashback received history

Lifetime cashback received by the caller, across **all** storefronts (not scoped to one orgId). Each row carries its own `sellerOrgId` so the caller can group by storefront client-side if needed.

Full reference in [`CASHBACK_CODES_API.md`](./CASHBACK_CODES_API.md). Short version:

**Query**: `limit` (default 50, max 200), `skip` (default 0).

**Response — `200`**

```json
{
  "success": true,
  "distributions": [ /* CashbackDistribution rows */ ],
  "total": 12,
  "totalReceived": 87.30
}
```

`totalReceived` is the lifetime sum across every storefront. The per-storefront totals live on `/ecommerce/wallet?orgId=<X>` → `cashback.totalReceivedUsd`.

---

## 6. Empty-state shapes

The combined endpoints **never 404** for a buyer who has no activity at a given storefront. They return a zeroed snapshot so the storefront's UI has one consistent rendering path.

| Scenario | Response |
|---|---|
| Buyer has never had a StoreWallet for org X AND no cashback at X | `200` with `balance: 0, balanceCents: 0, exists: false, recentTransactions: [], cashback: { totalReceivedUsd: 0, completedCount: 0, recent: [] }` |
| Buyer has received cashback at X but never spent there | `200` with `balance: <cashback_total>` (the credit landed in their StoreWallet), `exists: true`, populated `cashback`. |
| Buyer hits `/ecommerce/wallets/me` with zero activity anywhere | `200` with `{ wallets: [] }` |
| `orgId` doesn't exist as an `Organization` | `404 org_not_found` (single-org endpoint only — the list endpoint can't 404) |

---

## 7. Error codes

| HTTP | `error` | When |
|---|---|---|
| `400` | `invalid_query` | Malformed `orgId` / negative limit / etc. Zod issues in `details`. |
| `401` | (raw `Unauthorized`) | Missing / wrong / expired JWT. |
| `404` | `org_not_found` | `orgId` doesn't match any `Organization` row. Single-org endpoint only. |
| `500` | `internal_error` | Anything unexpected. `message` carries the underlying error. |

No `403` — the buyer doesn't need to be a member of the storefront's org to read THEIR OWN wallet at it. (They couldn't have a balance there if they hadn't done business with it.)

---

## 8. TypeScript types

```ts
export interface EcommerceWalletTransaction {
  _id: string;
  type: "credit" | "debit" | "transfer" | "withdrawal";
  amount: number;            // float USD
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  status: "completed" | "pending" | "failed" | "reversed";
  createdAt: string;
}

export interface CashbackReceivedItem {
  _id: string;
  codeId: string;
  cashbackAmount: number;    // float USD
  productType: string;       // "ecommerce" for storefront buys
  itemId: string | null;
  saleAmountCents: number;
  appliedRatePct: number;
  createdAt: string;
}

export interface EcommerceWalletSnapshot {
  orgId: string;
  orgName: string;
  balance: number;                       // float USD
  balanceCents: number;                  // integer, derived
  currency: "USD";
  withdrawableBalanceCents: number;
  lastTransactionAt: string | null;
  exists: boolean;
  recentTransactions: EcommerceWalletTransaction[];
  cashback: {
    totalReceivedUsd: number;
    completedCount: number;
    recent: CashbackReceivedItem[];
  };
}

export interface EcommerceWalletSingleResponse {
  success: true;
  // ...all EcommerceWalletSnapshot fields are flattened onto the top-level response
}

export interface EcommerceWalletListResponse {
  success: true;
  wallets: EcommerceWalletSnapshot[];
}
```

---

## 9. Worked example

**Setup** — Ravi has been shopping at Garage Beauty (orgId `X`) and recently applied Asha's `ASHA5` cashback code on a $54 Vitamin Serum purchase. Cashback fired and credited his StoreWallet at Garage Beauty.

**Ravi opens the Garage Beauty storefront → "My Wallet" page.** The storefront calls:

```bash
curl -sS "$API_URL/ecommerce/wallet?orgId=X&recent=20&cashbackRecent=5" \
  -H "Authorization: Bearer $RAVI_JWT"
```

Response:

```json
{
  "success": true,
  "orgId": "X",
  "orgName": "Garage Beauty",
  "balance": 2.70,
  "balanceCents": 270,
  "currency": "USD",
  "withdrawableBalanceCents": 0,
  "lastTransactionAt": "2026-06-15T14:23:55.121Z",
  "exists": true,
  "recentTransactions": [
    {
      "_id": "660a...",
      "type": "credit",
      "amount": 2.70,
      "currency": "USD",
      "balanceBefore": 0.00,
      "balanceAfter": 2.70,
      "description": "Cashback (ASHA5) — invoice INV-...",
      "status": "completed",
      "createdAt": "2026-06-15T14:23:55.121Z"
    }
  ],
  "cashback": {
    "totalReceivedUsd": 2.70,
    "completedCount": 1,
    "recent": [
      {
        "_id": "660b...",
        "codeId": "660aabcd...",
        "cashbackAmount": 2.70,
        "productType": "ecommerce",
        "itemId": "...",
        "saleAmountCents": 5400,
        "appliedRatePct": 5,
        "createdAt": "2026-06-15T14:23:55.000Z"
      }
    ]
  }
}
```

`withdrawableBalanceCents: 0` because the $2.70 was credited this week — it matures past the next Sunday-night IST cutoff (existing wallet maturity rule).

**Ravi later opens the Garage Coffee storefront** (a different org) for the first time:

```bash
curl -sS "$API_URL/ecommerce/wallet?orgId=Z" \
  -H "Authorization: Bearer $RAVI_JWT"
```

```json
{
  "success": true,
  "orgId": "Z",
  "orgName": "Garage Coffee",
  "balance": 0.00,
  "balanceCents": 0,
  "currency": "USD",
  "withdrawableBalanceCents": 0,
  "lastTransactionAt": null,
  "exists": false,
  "recentTransactions": [],
  "cashback": { "totalReceivedUsd": 0, "completedCount": 0, "recent": [] }
}
```

Empty state. No 404 — the storefront's UI uses one rendering path for both cases.

---

## 10. FAQ + edge cases

**Q: What if the buyer is new to this storefront?**
A: `GET /ecommerce/wallet?orgId=X` returns `200` with `exists: false`, `balance: 0`, empty arrays. Render an "empty wallet" state. The wallet row is **not** auto-created by this read endpoint — it'll be lazy-created the first time something credits or debits it (purchase, top-up, cashback). The lightweight `/wallet/store/balance?orgId=<X>` DOES lazy-create a row on read; the snapshot endpoint deliberately does not, to keep reads side-effect-free.

**Q: Is Garage HQ a separate wallet?**
A: Yes. Garage HQ is just another org (the one with `parent: true`). Query it with `orgId=<HQ-orgId>` on the same endpoint and you'll get the buyer's HQ Store Wallet. To find the HQ orgId, call `Organization.findOne({ parent: true })` from your backend, or use the dedicated [`HQ_STORE_WALLET_API.md`](./HQ_STORE_WALLET_API.md) for the internal-key surface.

**Q: Why isn't there a `?orgId=` filter on `GET /ecommerce/wallets/me`?**
A: That endpoint is intentionally the "all storefronts" view. For one storefront, use `GET /ecommerce/wallet?orgId=<X>`.

**Q: Can I see another buyer's wallet?**
A: No. These endpoints always resolve the caller from the JWT. For admin reads, use the internal-key surface on the HQ wallet (or a future per-org internal-key surface — out of scope here).

**Q: Does the snapshot include withdrawn transactions?**
A: Yes — `recentTransactions` includes all types (credit, debit, transfer, withdrawal). For filtering, use `/wallet/store/transactions?type=withdrawal`.

**Q: Currency?**
A: All Store Wallet balances are USD floats. The combined endpoints return `currency: "USD"` and a derived `balanceCents` integer for math. INR-denominated invoices convert to USD via the existing FX path before crediting.

**Q: Rate limits?**
A: Inherits the global Garage rate limit. No per-endpoint cap. The list endpoint runs `N+2` queries (N = orgs the buyer has activity in); fine for typical buyers with a handful of storefronts. If the buyer has hundreds of storefronts and you see slow responses, ping the backend team.

**Q: Does this need any new permissions for the buyer?**
A: No. It reads data the buyer can already read about themselves through the Vault. SSO JWT is enough.

**Q: Refunds / reversed cashback?**
A: Out of scope today — there's no refund flow on the platform. If/when refunds ship, this endpoint will surface them as new `WalletTransaction` rows (probably `type: "credit"` for a refund inbound).

---

## Changelog

| Version | Notes |
|---|---|
| 1.0 | Initial: `/ecommerce/wallet?orgId=<X>` snapshot + `/ecommerce/wallets/me` list. Documents the existing `/wallet/store/...` + `/cashback-codes/me/received` endpoints from the ecommerce/SSO angle. |
