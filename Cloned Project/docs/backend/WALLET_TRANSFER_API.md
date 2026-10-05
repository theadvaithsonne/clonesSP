# Wallet Transfer APIs

Two transfer endpoints, **different sources, same destinations** (a user's native
`StoreWallet` / `AffiliateWallet`). Every transfer writes linked audit records inside a
single Mongo transaction so balances and ledgers never drift.

| # | API | Source | Destination | Who calls it |
|---|---|---|---|---|
| **1** | [Earner self-transfer](#api-1--earner-self-transfer) | earner's **Content Rewards balance** (`NcWallet`) | own Store **or** Affiliate wallet | the earner (self) |
| **2** | [Campaign escrow transfer](#api-2--campaign-escrow-transfer) | a campaign's **escrow** (`CampaignWallet`) | a target user's Store **or** Affiliate wallet | founder / admin (see §Security) |

> **Status:** spec / to-build. Reuses existing models — no new collections.

---

## Money model & units (read first)

| Thing | Unit | Example |
|---|---|---|
| Request body `amountCents` | **integer cents** | `2500` = $25.00 |
| `NcWallet.balance` (content-rewards earnings) | **integer cents** | `2500` |
| `CampaignWallet.balance` | **float USD** | `25.00` |
| `StoreWallet.balance` / `AffiliateWallet.balance` | **float USD** | `25.00` |

Both APIs accept **cents** and convert at the destination boundary: `amountUsd = Math.round(amountCents) / 100`.
**V1 is USD-only.**

### Models

| Model | File | Role |
|---|---|---|
| `NcWallet` | `src/models/ncWallet.model.ts` | Earner earnings balance (the `wallets` collection). Source for API 1. Embedded `transactions[]` ledger. |
| `CampaignWallet` | `src/models/campaignWallet.model.ts` | Per-campaign escrow. Source for API 2. |
| `CampaignWalletTransaction` | `src/models/campaignWalletTransaction.model.ts` | Audit row on the campaign side. |
| `StoreWallet` | `src/models/storeWallet.model.ts` | Destination (per-user-per-org). |
| `AffiliateWallet` | `src/models/affiliateWallet.model.ts` | Destination (per-user). |
| `WalletTransaction` | `src/models/walletTransaction.model.ts` | Audit row on the destination side (polymorphic store/affiliate). `pre("validate")` requires **exactly one** of `storeWalletId`/`affiliateWalletId`, and `walletType` must match. |

---

## API 1 — Earner self-transfer

The earner moves their **own** content-rewards earnings into their **own** Store or
Affiliate wallet. Source and destination both key on `me.userId`, so there is **no theft
vector** — safe for any authenticated user.

### `POST /wallet/content-rewards/transfer`

**Auth:** `requireAuth` (self-only).

**Request body**

```jsonc
{
  "destination": "store",   // "store" | "affiliate"
  "amountCents": 2500,      // integer cents, > 0
  "note": "Move to store"   // optional, ≤ 1000 chars
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `destination` | enum | yes | `"store"` or `"affiliate"` |
| `amountCents` | integer | yes | `> 0`; `≤` the earner's content-rewards balance (in cents) |
| `note` | string | no | ≤ 1000 chars |

- Source: `NcWallet` for `{ userId: me.userId }`.
- Destination `store`: `StoreWallet` for `{ userId: me.userId, orgId: me.orgId }` (active-session org; lazy-created).
- Destination `affiliate`: `AffiliateWallet` for `{ userId: me.userId }` (lazy-created).

**Success — `200`**

```jsonc
{
  "success": true,
  "transfer": {
    "destination": "store",
    "amountCents": 2500,
    "amountUsd": 25.00,
    "contentRewardsBalanceAfter": 75.00,  // USD (NcWallet.balance / 100)
    "destinationBalanceAfter": 25.00,     // USD
    "walletTransactionId": "665f..."
  }
}
```

**Errors**

| Status | `error` | When |
|---|---|---|
| `400` | `Invalid transfer data` | body fails validation |
| `400` | `Amount must be greater than 0` | `amountCents <= 0` |
| `400` | `Insufficient content rewards balance. Available: $X` | NcWallet balance `< amountCents` |
| `404` | `Content rewards wallet not found` | no `NcWallet` for the user (zero lifetime earnings) |
| `500` | `Failed to transfer` | unexpected; transaction rolled back |

### Transaction recording (API 1)

Two records, one Mongo session:

**a) Source — `NcWallet` debit** (embedded ledger, mirrors the credit path)

```
balance -= amountCents          // pre-checked balance >= amountCents (see note)
$push transactions[0] = {
  type: "debit",
  amount: amountCents,          // cents, positive
  balanceAfter: <newBalanceCents>,
  description: "Transfer to <store|affiliate> wallet",
  createdAt: now
}                                // $slice: 200 to cap history
```

> **Negative-balance guard:** `NcWallet.balance` has `min: 0`, but `$inc` via `updateOne`
> **bypasses** validators. You **must** check `balance >= amountCents` *before* the `$inc`,
> or you can drive the balance negative.

**b) Destination — `WalletTransaction` credit**

| Field | store | affiliate |
|---|---|---|
| `storeWalletId` / `affiliateWalletId` | store `_id` | affiliate `_id` |
| `walletType` | `"store"` | `"affiliate"` |
| `userId` | `me.userId` | `me.userId` |
| `orgId` | `me.orgId` | *(omit)* |
| `type` | `"transfer"` | `"transfer"` |
| `amount` | `amountUsd` | `amountUsd` |
| `currency` | `"USD"` | `"USD"` |
| `balanceBefore` / `balanceAfter` | dest before / after | same |
| `description` | `"Transfer from Content Rewards"` | same |
| `note` | request `note` | request `note` |
| `metadata` | `{ source: "content_rewards", action: "earner_transfer" }` | same |
| `status` | `"completed"` | `"completed"` |

> Do **not** bump `AffiliateWallet.totalEarnings` on a transfer-in — it's a move, not new
> earnings (keeps lifetime-earned accurate).

### Read-view caveat (important)

After this transfer the earner's content-rewards **balance** drops correctly (it reads
`NcWallet.balance`). But `GET /wallet/content-rewards/transactions` currently reads from
`CampaignWalletTransaction` (campaign **payouts** only) — so the **outbound transfer won't
appear in that list**. It *is* recorded in `NcWallet.transactions[]` and on the
Store/Affiliate side.

Pick one when implementing:
- **(a) recommended)** extend `getContentRewardsWalletTransactions` to merge
  `NcWallet.transactions[]` (it already has `type: "debit"` rows), so the earner sees both
  earnings-in and transfers-out in one list; **or**
- **(b)** accept that outbound transfers only show on the Store/Affiliate transaction lists.

### Service function (API 1)

```ts
// add to src/services/contentRewardsWallet.ts (it now does one mutation)
export async function transferEarningsToUserWallet(params: {
  userId: string;                 // the earner (self)
  orgId: string;                  // for the store-wallet key
  destination: "store" | "affiliate";
  amountCents: number;
  note?: string;
  session: ClientSession;
}): Promise<{ ncWallet: any; destinationWallet: any; walletTransaction: any }>;
```

**Atomic steps:** load NcWallet → 404/400 guard → debit (balance + push ledger) →
lazy-load/create destination → credit → write `WalletTransaction` → return.

---

## API 2 — Campaign escrow transfer

Move funds **out of a campaign's escrow** into a **target user's** Store or Affiliate
wallet. Source is a shared pool the caller doesn't personally own — so this one needs an
ownership guard (see §Security).

### `POST /content-campaigns/:id/wallet/transfer`

**Auth:** `requireAuth` **+ ownership guard** (founder of the campaign, or admin).

**Path params:** `id` — campaign id (its `CampaignWallet` is the source).

**Request body**

```jsonc
{
  "targetUserId": "665f...",     // user receiving the funds
  "destination": "affiliate",    // "store" | "affiliate"
  "amountCents": 2500,
  "note": "Bonus payout"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `targetUserId` | string | yes | valid ObjectId; user must exist |
| `destination` | enum | yes | `"store"` or `"affiliate"` |
| `amountCents` | integer | yes | `> 0`; `≤` campaign wallet balance (cents) |
| `note` | string | no | ≤ 1000 chars |

- store → `StoreWallet` `{ userId: targetUserId, orgId: campaign.orgId }` (lazy).
- affiliate → `AffiliateWallet` `{ userId: targetUserId }` (lazy).

**Success — `200`**

```jsonc
{
  "success": true,
  "transfer": {
    "destination": "affiliate",
    "targetUserId": "665f...",
    "amountCents": 2500,
    "amountUsd": 25.00,
    "campaignWalletBalanceAfter": 75.00,
    "destinationBalanceAfter": 25.00,
    "campaignTransactionId": "665f...",
    "walletTransactionId": "665f..."
  }
}
```

**Errors**

| Status | `error` | When |
|---|---|---|
| `400` | `Invalid campaign ID` / `Invalid transfer data` | bad id / body |
| `400` | `Amount must be greater than 0` | `amountCents <= 0` |
| `400` | `Transfer blocked: campaign currency is INR. V1 supports USD only.` | non-USD campaign |
| `400` | `Insufficient campaign wallet balance. Available: $X` | balance `< amountUsd` |
| `400` | `Campaign wallet is closed` | wallet `status !== "active"` |
| `403` | `Only the campaign founder can transfer its funds` | ownership guard |
| `404` | `Campaign not found` / `Campaign wallet not found` / `Target user not found` | missing entities |
| `500` | `Failed to transfer from campaign wallet` | unexpected; rolled back |

### Transaction recording (API 2)

Two records, one Mongo session.

**a) Source — `CampaignWalletTransaction`**

| Field | Value |
|---|---|
| `campaignWalletId` | campaign wallet `_id` |
| `campaignId` | `:id` |
| `orgId` | `campaign.orgId` |
| `type` / `direction` | `"debit"` / `"out"` |
| `amount` | `amountUsd` |
| `currency` | `"USD"` |
| `balanceBefore` / `balanceAfter` | wallet before / after |
| `description` | `"Transfer to <name>'s <store|affiliate> wallet"` |
| `relatedUserId` | `targetUserId` |
| `relatedTransactionId` | the `WalletTransaction._id` (clean — this field has no `ref`) |
| `metadata` | `{ action: "campaign_transfer", destination, note }` |
| `status` | `"completed"` |

Also bump the wallet counters: `balance -= amountUsd`, `totalPaidOut += amountUsd`,
`lastTransactionAt = now`. (`totalRefunded` stays reserved for founder-refund-on-close.)

**b) Destination — `WalletTransaction`**

Same table as [API 1 §b](#transaction-recording-api-1), except:
- `type`: `"transfer"`
- `description`: `"Campaign transfer: <campaign title>"`
- `metadata`: `{ campaignId, campaignTransactionId, action: "campaign_transfer" }`

> **Linking:** put the `WalletTransaction._id` in
> `CampaignWalletTransaction.relatedTransactionId` (no ref → safe), and the
> `CampaignWalletTransaction._id` in `WalletTransaction.metadata.campaignTransactionId`
> (avoids the `ref: "WalletTransaction"` mismatch).

### Service function (API 2)

```ts
// add to src/services/campaignWallet.ts (mirrors payoutFromCampaignToAffiliate)
export async function transferCampaignToUserWallet(params: {
  campaignId: string;
  targetUserId: string;
  destination: "store" | "affiliate";
  amountCents: number;
  description: string;
  note?: string;
  actorUserId?: string;
  session: ClientSession;
}): Promise<{
  campaignWallet: any; destinationWallet: any;
  campaignTransaction: any; walletTransaction: any;
}>;
```

**Atomic steps:** load campaign (404 + USD guard) → load CampaignWallet (404 / active /
balance guard) → debit campaign wallet → lazy-load/create destination → credit → write
`WalletTransaction` → write `CampaignWalletTransaction` (`relatedTransactionId` = wallet tx)
→ backfill `walletTransaction.metadata.campaignTransactionId` → return.

---

## Reading transfer history

No new read endpoint needed — transfers surface through existing APIs:

- **Campaign side (API 2):** `GET /content-campaigns/:id/wallet` → `type: "debit"` rows with
  `metadata.action = "campaign_transfer"`, `relatedUserId` = recipient.
- **Recipient / earner side (both):** `GET /wallet/store/transactions?orgId=…` and
  `GET /wallet/affiliate/transactions` list the `type: "transfer"` credits.
- **Earner content-rewards balance:** `GET /wallet/content-rewards/balance` reflects the
  reduced `NcWallet.balance` after API 1. (Transaction list: see the
  [read-view caveat](#read-view-caveat-important).)

---

## Security

| API | Source ownership | Required guard |
|---|---|---|
| **1 — Earner self-transfer** | source & dest both = `me.userId` | none beyond `requireAuth` — **safe** |
| **2 — Campaign escrow** | shared pool owned by founder/org | **must** verify caller owns the campaign |

API 2 guard (drop-in, pick one):

```ts
// A) founder-of-this-campaign only
if (campaign.founderId.toString() !== me.userId) {
  return res.status(403).json({ error: "Only the campaign founder can transfer its funds" });
}
// B) founder OR org admin — gate the route with requireFounder (like GET /:id/wallet)
```

Without one of these, **any** logged-in user could drain **any** campaign's escrow into
their own wallet. API 1 has no such risk because a user can only move their own money.
