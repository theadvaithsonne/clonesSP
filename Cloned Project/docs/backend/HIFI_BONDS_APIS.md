# HiFi Bonds — API reference

Fixed-income bond instruments issued by **crypto-office founders**. A
founder defines a bond in units; an investor buys N units straight from
their store wallet; the platform pays interest on a fixed schedule and
returns principal at maturity.

Design decisions and rationale: `HIFI_BONDS_PLAN.md`.
**Public bond page, bond hash, owner check and enriched purchase
history:** `HIFI_BONDS_PUBLIC_APIS.md`.
Source spec: `hifi-bonds-logic.md`.

**No environment variables.** Nothing to configure — deploy and it works.

---

## Base URLs + Auth

- **Test**: `https://test.garage.app`
- **Prod**: `https://api.my.garage.app`

All endpoints are Bearer-JWT authenticated (the same JWT as the rest of
the platform). Route prefix: `/bonds/*`.

### Access model

| Endpoint | Access rule |
|---|---|
| `POST /bonds/instruments*`, `PATCH`, `publish`, `close`, `obligations`, `ledger` | **Founder** of a **crypto office** (`officeCreatedFromCryptobrand === true`) |
| `GET /bonds/instruments` | Anyone authenticated. Non-founders see only `published` / `fully_subscribed` |
| `GET /bonds/instruments/:id`, `/quote` | Anyone authenticated |
| `POST /bonds/instruments/:id/purchase` | Any authenticated buyer with sufficient wallet balance |
| `GET /bonds/holdings*`, `POST /holdings/:id/redeem` | The holding's owner (founders may also read a holding) |

Non-crypto offices get **403 `"Bonds are only available to crypto offices"`**.

---

## Money representation — read this first

Every bond amount is an **integer count of the currency's smallest
unit, carried as a string** (`"100000"` = ₹1,000.00). Two reasons:

1. `StoreWallet.balance` is a JS float and drifts — a `$inc` produced a
   balance of `0.10000000000000142` in production. A 90-payout daily
   bond compounds that.
2. ETH cannot be an integer in a JS number: 1 ETH = 10¹⁸ wei and
   `Number.MAX_SAFE_INTEGER` ≈ 9×10¹⁵, so even 0.01 ETH overflows.

| Currency | Decimals | 1 whole unit |
|---|---|---|
| INR | 2 | `"100"` |
| USD | 2 | `"100"` |
| USDT | 6 | `"1000000"` |
| BTC | 8 | `"100000000"` |
| ETH | 18 | `"1000000000000000000"` |

**Requests take human decimals** (`"1000"`, `"0.05"`). **Responses carry
both**: `atomic` (authoritative) and `display` (human).

### Crypto unit-price limit
The invoice layer stores `Math.round(amount × 100)` for every currency,
so a 0.005 ETH unit price would appear on its own receipt as 0.01 ETH.
Rather than misstate the receipt, a unit price must be **exactly
representable at 2 decimal places** — `0.25 BTC` and `1.5 ETH` are fine,
`0.005 ETH` is rejected with `UNIT_PRICE_PRECISION`.

---

## Flow overview

```
1. Founder previews terms  → POST /bonds/instruments/preview
     Returns the total they will pay out. No write. Call on every edit.

2. Founder creates a draft → POST /bonds/instruments

3. Founder publishes       → POST /bonds/instruments/:id/publish
     MUST echo back the exact total-outflow figure they were shown.

4. Investor quotes         → GET  /bonds/instruments/:id/quote?units=N

5. Investor buys           → POST /bonds/instruments/:id/purchase
     One request: mints an invoice, debits the buyer's wallet, credits
     the founder, creates the holding, pre-creates every payout event,
     distributes principal commission. Returns an ALREADY-PAID invoice.
     There is no checkout page.

6. Hourly engine pays out  → automatic
     Settles due interest, retries failures with backoff, auto-redeems
     matured holdings.

7. Investor redeems        → POST /bonds/holdings/:id/redeem
     Only at/after maturity, and only once all payouts have cleared.
     Auto-redeem does this anyway.
```

---

## 1. Preview terms (the obligation panel)

### `POST /bonds/instruments/preview`

No write. Call it on every keystroke in the builder — this is the
number a founder must see before publishing.

```json
{
  "orgId": "68f1fe05876fcc5fadb61951",
  "name": "90-day daily income bond",
  "unitPrice": "1000",
  "currency": "INR",
  "durationDays": 90,
  "payoutFrequency": "daily",
  "ratePerPayoutPeriod": "1",
  "totalUnits": 500,
  "minUnits": 1,
  "commissionBasis": "both",
  "principalCommissionRate": "1",
  "payoutCommissionRate": "1"
}
```

`payoutFrequency`: `daily` | `monthly` | `quarterly` | `half_yearly` | `yearly`
`commissionBasis`: `principal` | `payout` | `both` | `none`

**`ratePerPayoutPeriod` is per payout EVENT, not per annum.** 1% daily
over 90 days is 90 payouts of 1%. Never call it IRR.

```json
{
  "success": true,
  "issues": [],
  "publishable": true,
  "atomic": { "payoutAmountPerUnitAtomic": "1000", "payoutCount": 90, "...": "..." },
  "display": {
    "currency": "INR",
    "payoutAmountPerUnit": "10",
    "payoutCount": 90,
    "totalInterestPerUnit": "900",
    "totalCommissionPerUnit": "19",
    "totalOutflowPerUnit": "1919",
    "sellerNetPerUnit": "-919",
    "totalRaise": "500000",
    "totalInterestAtFull": "450000",
    "totalCommissionAtFull": "9500",
    "totalOutflowAtFull": "959500",
    "sellerNetAtFull": "-459500",
    "annualisedRatePct": "360",
    "stubDays": 0
  }
}
```

Preview returns `issues` rather than a 400, so the builder can show
problems live while the founder is still typing.

> **Read `sellerNetPerUnit`.** On these inputs the founder takes ₹1,000
> and pays out ₹1,919 — a net loss of ₹919 per unit. That is arithmetic,
> not a bug: 1% *daily* is 360%/yr. This endpoint exists so nobody
> publishes that by accident.

---

## 2. Create / edit / publish

### `POST /bonds/instruments` → `201`
Same body as preview. Creates a `draft`. Returns `400 { issues }` if invalid.

### `PATCH /bonds/instruments/:id`
**Drafts only.** A published bond returns `409 NOT_EDITABLE` — investors
hold positions priced on its current terms (spec §9). Editing voids any
prior acknowledgement.

### `POST /bonds/instruments/:id/publish`
```json
{ "acknowledgedOutflow": "1919" }
```
Must equal `display.totalOutflowPerUnit` exactly, or `400 ACK_MISMATCH`.
This is the spec's hard confirmation — not a generic "I agree" — and it
proves which number the founder saw.

If a `levels` comb plan is attached, its level percentages must sum to
the bond's commission rate, else `400 LEVELS_TOTAL_MISMATCH`.

### `POST /bonds/instruments/:id/close`
Stops new purchases. **Existing holdings keep paying out.**

### `GET /bonds/instruments?orgId=&status=`
### `GET /bonds/instruments/:id` → adds `unitsRemaining`

---

## 3. Quote

### `GET /bonds/instruments/:id/quote?units=10`

```json
{
  "success": true,
  "quote": {
    "units": 10, "currency": "INR",
    "principal": "10000",
    "payoutPerDate": "100", "payoutCount": 90,
    "totalInterest": "9000", "totalReturn": "19000",
    "durationDays": 90, "payoutFrequency": "daily",
    "annualisedRatePct": "360",
    "atomic": { "principalAtomic": "1000000", "...": "..." }
  }
}
```

---

## 4. Purchase — one request, no checkout

### `POST /bonds/instruments/:id/purchase`

```json
{ "units": 10 }
```

Server-side, in order: validate supply and `minUnits` → check wallet
balance → mint the invoice → debit the buyer → mark the invoice paid →
`fulfillInvoice` → create the holding → pre-create all payout events →
credit the founder → distribute principal commission.

```json
{
  "success": true,
  "invoice": {
    "id": "6ab7…", "invoiceNumber": "INV-…",
    "status": "paid", "paidAt": "2026-09-29T…",
    "currency": "INR", "amountPaid": "10000"
  },
  "holding": { "_id": "…", "status": "active", "payoutCount": 90, "...": "..." },
  "fulfilment": { "type": "hifi_bond", "status": "fulfilled", "payoutEventsCreated": 90 }
}
```

**Errors**

| Code | HTTP | Meaning |
|---|---|---|
| `NOT_PURCHASABLE` | 409 | Bond is draft / closed / fully subscribed |
| `BELOW_MIN_UNITS` | 400 | Under the per-buyer minimum |
| `INSUFFICIENT_SUPPLY` | 409 | Fewer units remain than requested |
| `INSUFFICIENT_BALANCE` | 400 | Buyer's wallet in that currency is short |
| `DEBIT_FAILED` | 400 | Wallet debit refused; the invoice stays `pending` as evidence |

The buyer's wallet must be in the **bond's currency**. Crypto-office
members get USD/INR/ETH/BTC/USDT wallets automatically; the route
ensures them before reading the balance.

---

## 5. Holdings + redemption

### `GET /bonds/holdings?orgId=`
### `GET /bonds/holdings/:id`
Returns the holding, a summary, and the **full payout schedule** with
per-event `status`, `attempts`, `lastError` and `paidAt`.

### `POST /bonds/holdings/:id/redeem`

| Code | HTTP | Meaning |
|---|---|---|
| `not_matured` | 409 | Before maturity. **Early redemption is not supported.** |
| `payouts_outstanding` | 409 | Interest still owed; principal returns once it clears |
| `insufficient_founder_balance` | 409 | Issuer cannot cover principal right now |

Redemption is automatic at maturity, so this is a convenience.

---

## 6. Founder monitoring

### `GET /bonds/instruments/:id/obligations`

```json
{
  "success": true, "currency": "INR",
  "walletBalance": 12000,
  "outstandingInterest": "81000",
  "interestDueNext30Days": "27000",
  "principalOwedAtMaturity": "90000",
  "failedPayouts": 0,
  "shortfallNext30Days": 15000,
  "funded": false
}
```

**Principal is NOT escrowed.** It lands in the founder's spendable
wallet, so they can spend money they owe investors. This endpoint is the
warning; `funded: false` means payouts will start failing.

### `GET /bonds/organizations/:orgId/ledger?page=&limit=&kind=&instrumentId=`

Ledger kinds: `purchase_credit`, `principal_commission`, `payout_credit`,
`payout_commission`, `redemption_credit`, `reversal`.

---

## 7. The payout engine

Hourly tick registered in `src/index.ts`. **Live on deploy — no env
flag.** Safe because it only acts on `bond_payout_events`, which exist
only after a bond is published *and* bought. No bonds ⇒ every tick is a
no-op.

Per due event, in its own transaction: debit founder → credit investor →
write ledger → distribute payout commission → mark paid → advance the
holding's `nextPayoutAt`.

**On insufficient founder balance** the holding flips to `payout_failed`
(buyer-visible and honest, per spec §8) and the event retries with
backoff **1h → 6h → 24h → 24h → 24h**. After **5 attempts** it becomes
`failed` and stops being picked up, so a late-funding founder is not
silently skipped forever. One failure never cascades to another holding.

**Concurrency.** This backend has no cron library and no leader
election — `setInterval` runs on every instance. Correctness comes from
each event being pre-created with a **unique `dedupeKey`**
(`bond_payout_<holdingId>_<sequenceNo>`) and claimed with a conditional
update before money moves. That index is not optional.

---

## 8. Commission

The bond engine computes a **pool** and hands it to the comp-plan
service; it never decides who gets paid (spec §6).

Two independent, separately-rated bases:
- **`principal`** — % of unit price, charged once at purchase.
- **`payout`** — % of **the payout amount**, charged each payout date.

> Deliberately two fields. A single `commission_rate` reads two ways
> that differ by **100×**: on the worked example, 1% of the ₹1,000 unit
> price is ₹10/day (₹900 total) while 1% of the ₹10 payout is ₹0.10/day
> (₹9 total).

Split by the attached `CombPlan`:
- **`levels`** — founder enters a percentage per level; the total must
  equal the bond's commission rate. Each level takes its proportional
  share of the pool.
- **`unilevel_plus`** — founder enters one percentage; the whole pool
  goes to the Unilevel Plus engine. Unspent remainder returns to the
  founder rather than being swept to the platform — they funded it.

**Affiliates are paid in USD.** Commission distribution is USD-only
platform-wide, so the pool is converted at the bond boundary using
`cryptoFxRate.convertBetween` (which supports all five currencies) and
the FX rate is stamped on the ledger row. A crypto-denominated bond
therefore pays the investor a fixed amount in its own currency while the
affiliate's USD value moves with the market.

---

## 9. Collections

| Collection | Contents |
|---|---|
| `bond_instruments` | Founder-defined terms + `derived` figures snapshotted at publish |
| `bond_holdings` | One row per purchase. One invoice ⇒ one holding (unique index) |
| `bond_payout_events` | Every scheduled payment, created up front. Unique `dedupeKey` |
| `bond_ledger_entries` | Append-only audit; reversals reference the original |

Also written: `Invoice` (`itemType: "hifi_bond"`), `StoreWallet`,
`WalletTransaction`.

---

## 10. Not implemented

- **Early redemption** — needs interest-forfeiture rules and commission
  clawback across the upline.
- **Partial redemption** — a holding is one row; supporting this is a
  migration to unit-level rows, not a new field.
- **Pro-rata stub periods** — `durationDays` must be a whole multiple of
  the payout period; otherwise `DURATION_NOT_WHOLE_PERIODS`.
- **Principal escrow** — decision D5 is pass-through. See §6.
- **Sub-2dp crypto unit prices** — see the money section.
