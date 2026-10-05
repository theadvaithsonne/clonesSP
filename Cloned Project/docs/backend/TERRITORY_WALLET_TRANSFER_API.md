# Territory (Franchise) Wallet Transfer API

> Move a user's franchise earnings from their **TerritoryWallet** into their per-org **StoreWallet**, so the balance becomes spendable through the normal store checkout flows (products, courses, workshops, subscriptions, etc.).

Extends the wallet-transfer family documented in [WALLET_TRANSFER_API.md](./WALLET_TRANSFER_API.md). Same shape, same atomicity guarantees, one new source-wallet type.

---

## Why this exists

Before this endpoint, `TerritoryWallet` was **credit-only**. Territory commission distributor (`services/territoryCommission.ts`) + founder-program distributor (`services/franchiseProgramCommission.ts`) both wrote credit rows against the aggregate wallet, but nothing consumed the balance. The `type: "withdrawal"` enum value on `TerritoryWalletTransaction` and the `totalWithdrawn` field on `TerritoryWallet` were placeholders that no code path exercised.

This API activates them.

---

## Endpoints

### `GET /territory-wallet`

Auth: `requireAuth` (bearer JWT).

Returns the caller's own aggregate franchise-earnings wallet. Empty wallet returns a zero-balance stub — FE doesn't need to special-case "no wallet yet".

**Response**
```json
{
  "wallet": {
    "userId": "6a…",
    "balance": 123.45,
    "currency": "USD",
    "totalEarnings": 500.0,
    "totalWithdrawn": 376.55,
    "isActive": true,
    "lastTransactionAt": "2026-08-06T12:03:11.129Z"
  }
}
```

---

### `POST /territory-wallet/transfer`

Auth: `requireAuth`. Self-transfer only — the source and destination user are always the caller, so no theft vector exists (mirrors `POST /wallet/content-rewards/transfer`).

**Request**
```json
{
  "amountCents": 5000,          // required, integer, > 0
  "orgId": "6a…",               // optional, defaults to JWT orgId
  "note": "moved to shop"       // optional, ≤ 1000 chars
}
```

- `amountCents` — cents, converted to USD at the boundary via `amountUsd = amountCents / 100`. Rejected if not a positive integer.
- `orgId` — destination StoreWallet is scoped `{userId, orgId}` (compound unique on `storeWallet.model.ts`). Omit to route to the caller's active org from the JWT.
- `note` — free-text audit trail; ends up on both audit rows' metadata.

**Response — 200**
```json
{
  "success": true,
  "transfer": {
    "amountCents": 5000,
    "amountUsd": 50.00,
    "territoryBalanceAfter": 73.45,
    "storeBalanceAfter": 285.32,
    "walletTransactionId": "6b…",
    "territoryTransactionId": "6b…"
  }
}
```

**Errors**

| HTTP | `error`                                                        | When                                              |
|------|----------------------------------------------------------------|---------------------------------------------------|
| 400  | `Invalid transfer data`                                        | Body doesn't match schema (missing/negative amount, etc.) |
| 400  | `orgId is required (destination StoreWallet)`                  | No `orgId` in body AND none on JWT                |
| 400  | `Insufficient territory wallet balance. Available: $X, required: $Y` | Balance < amount                            |
| 404  | `Territory wallet not found for this user`                     | No `TerritoryWallet` doc for this user            |
| 409  | `Territory wallet is inactive`                                 | `isActive: false`                                 |
| 400  | `Transfer blocked: territory wallet currency is <X>. V1 supports USD only.` | Non-USD wallet (defensive)         |

---

## Atomicity

Both sides of the transfer run inside a single `mongoose.startSession()` + `session.startTransaction()`. Any failure between steps aborts the transaction — balances and audit rows either **all** land or **none** do. No partial state.

Steps (same session):

1. **Debit `TerritoryWallet`** — `balance -= amountUsd`, `totalWithdrawn += amountUsd`, `lastTransactionAt = now`.
2. **Credit `StoreWallet`** — lazy-create on `{userId, orgId}` at `balance: 0`, then `balance += amountUsd`.
3. **Write `WalletTransaction`** (destination row) — `walletType: "store"`, `type: "transfer"`, `amount: amountUsd`, `metadata: { source: "territory_wallet", action: "territory_transfer" }`.
4. **Write `TerritoryWalletTransaction`** (source row) — `type: "withdrawal"`, `metadata: { action: "transfer_to_store_wallet", destination: "store", destinationOrgId, walletTransactionId, note }`.
5. **Reverse-link** the store-side row: `metadata.territoryTransactionId = territoryTransaction._id`. (`WalletTransaction.relatedTransactionId` is `ref: "WalletTransaction"` so we can't stash a cross-collection id there; metadata carries it.)

---

## Fee & tax policy

**No fee, no tax at transfer time.** Same rule as `NcWallet → Store` and `CampaignWallet → Store` (see [WALLET_TRANSFER_API.md](./WALLET_TRANSFER_API.md)):

> The 5% platform cut only fires on OUTFLOW paths (`AffiliateWallet → Store`, `Withdrawal` payouts). A single dollar is never charged both on the way in and again on the way out.

Franchise earnings entered `TerritoryWallet` as pre-cut net (the platform already carved its slice via `distributeCommissions` before crediting the wallet), so moving them into `StoreWallet` is a pure lift-and-shift.

---

## Currency

V1 USD only. Consistent with the rest of the wallet family. If a `TerritoryWallet` document is ever created with a non-USD currency, the transfer throws before any balance moves.

---

## Idempotency

**Not idempotent.** Two identical POSTs debit the source twice. Callers should:
- Disable the CTA immediately on click, re-enable after response.
- If a client-side timeout fires before the server responds, poll `GET /territory-wallet` to check the balance before retrying.

Adding an `Idempotency-Key` header is future work — none of the existing wallet-transfer endpoints support it either, so the pattern is symmetric.

---

## Schema changes

- `models/territoryWalletTransaction.model.ts` — `entityType`, `entityId`, `originalSliceLevel`, `relatedSplitPercentage` are now **conditionally required**: required only when `type !== "withdrawal"`. Withdrawals are aggregate — a single row represents pulling from the pool of many entities' credits and has no single entity attribution.

Existing credit/debit rows are unaffected (they still populate the entity fields as before).

---

## Files

| Purpose                          | File                                                                 |
|----------------------------------|----------------------------------------------------------------------|
| Route                            | `src/routes/territoryWallet.ts`                                      |
| Service (atomic transfer)        | `src/services/territoryWalletTransfer.ts`                            |
| Schema tweak                     | `src/models/territoryWalletTransaction.model.ts`                     |
| Mount                            | `src/app.ts` → `app.use("/territory-wallet", territoryWalletRoutes)` |

---

## Verification

1. **Balance read** — `GET /territory-wallet` with a bearer JWT returns the caller's wallet or a zero stub.
2. **Successful transfer** — `POST /territory-wallet/transfer {"amountCents": 500}`:
   - Response includes new `territoryBalanceAfter` = old − $5.
   - `storeBalanceAfter` = old + $5.
   - `WalletTransaction` created: `walletType: "store"`, `type: "transfer"`, `metadata.source: "territory_wallet"`, `metadata.territoryTransactionId: <id>`.
   - `TerritoryWalletTransaction` created: `type: "withdrawal"`, `metadata.destination: "store"`, `metadata.walletTransactionId: <id>`.
   - `TerritoryWallet.totalWithdrawn` incremented by $5.
3. **Insufficient balance** — request `amountCents` > 100 × current balance → 400 with the "Available / required" message.
4. **Missing wallet** — a user with no territory earnings hits `/transfer` → 404 (`Territory wallet not found for this user`).
5. **Cross-org routing** — a user who's a member of Org A and Org B can `POST` with `orgId: "<B>"` and the credit lands on Org B's StoreWallet; default is the JWT's active org.
6. **Atomicity** — kill the process between step 2 and step 3 (e.g. throw in a debugger). On restart, `TerritoryWallet.balance` should be unchanged (rollback held) — no orphan credit on StoreWallet, no orphan debit on TerritoryWallet.

---

## Related

- **NcWallet → Store/Affiliate**: `POST /wallet/content-rewards/transfer` — `src/routes/wallet.ts:937`.
- **CampaignWallet → Store/Affiliate**: `POST /content-campaigns/:id/wallet/transfer` — `src/routes/contentCampaign.ts:740`.
- **Affiliate → Store (5% fee)**: `POST /wallet/affiliate/transfer-to-store` — `src/services/wallet.ts:970+`.
- **Withdrawal (admin, 5% affiliate fee)**: `src/services/withdrawal.ts`.
- **Franchise-api read endpoints** (roam-admin-facing, API-key-gated): `src/routes/franchiseApi.ts` — `/wallet/user/:userId`, `/wallet/user/:userId/transactions`.
