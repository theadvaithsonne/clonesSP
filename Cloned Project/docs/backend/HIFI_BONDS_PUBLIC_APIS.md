# HiFi Bonds — public bond page & purchase history APIs

Every purchased bond has a **bond hash**: a public identifier anyone can
use to look the bond up, like a block explorer for bonds. The public page
shows the bond's value, interest paid, remaining payments, payout log and
terms. The owner, when logged in, can confirm it is theirs and act on it.
The owner's purchase history carries exactly the same figures.

Builds on `HIFI_BONDS_APIS.md` (instruments, purchase, payouts).

**Crypto offices only.** Bonds can only be issued by founders of crypto
offices (`officeCreatedFromCryptobrand === true`). The public page looks
bonds up by hash, so every bond it can show is a crypto-office bond.

**No environment variables.**

---

## Contents

1. [The bond hash](#1-the-bond-hash)
2. [Public bond page](#2-public-bond-page) — `GET /public/bonds/:bondHash`
3. ["I'm the owner"](#3-im-the-owner) — `GET /bonds/holdings/by-hash/:bondHash`
4. [Purchase history](#4-purchase-history) — `GET /bonds/holdings`
5. [Holding detail](#5-holding-detail) — `GET /bonds/holdings/:id`
6. [Purchase receipt](#6-purchase-receipt) — `POST /bonds/instruments/:id/purchase`
7. [The view object, field by field](#7-the-view-object-field-by-field)
8. [USD values](#8-usd-values)
9. [Privacy — what is never public](#9-privacy--what-is-never-public)
10. [Errors](#10-errors)
11. [Design screen → API field map](#11-design-screen--api-field-map)
12. [Deployment notes](#12-deployment-notes)

---

## 1. The bond hash

| | |
|---|---|
| Format | **12 digits**, never starting with `0` — e.g. `482913057361` |
| Assigned | At purchase, on the `bond_holdings` row (`bondHash`) |
| Uniqueness | Unique index `bondHash_1` (partial on string) |
| Guessability | Random, ~3.9 × 10¹¹ values. Not sequential, so bonds can't be enumerated |

A short or sequential id would let anyone step through every bond on the
platform and scrape what each one holds. That's why the id is random.

**It is not an on-chain hash.** Bonds are wallet-ledger records; the id
cannot be checked on a blockchain explorer. Don't word the UI as if it can.

Search input is forgiving: `4829 1305 7361`, `4829-1305-7361` and
`#482913057361` all resolve. A Mongo `_id` is rejected.

---

## 2. Public bond page

### `GET /public/bonds/:bondHash` — no login

```
GET /public/bonds/482913057361?logLimit=50&logOffset=0
```

| Query | Default | Notes |
|---|---|---|
| `logLimit` | 50 | Interest-log page size, max 200 |
| `logOffset` | 0 | For paging long logs (a daily bond can have thousands) |

```json
{
  "success": true,
  "bond": {
    "bondHash": "482913057361",
    "name": "Bitcoin Bond",
    "description": "",
    "issuer": { "name": "Satoshi Capital" },
    "currency": "BTC",
    "status": "active",

    "value": { "atomic": "25000000", "amount": "0.25", "usdNow": 15250.4 },

    "issuance": {
      "purchasedAt": "2026-09-01T10:00:00.000Z",
      "bondPublishedAt": "2026-08-28T09:00:00.000Z",
      "units": 1,
      "unitPrice": { "atomic": "25000000", "amount": "0.25", "usdNow": 15250.4 },
      "principal": { "atomic": "25000000", "amount": "0.25", "usdNow": 15250.4 }
    },

    "redemption": {
      "maturesAt": "2026-10-15T10:00:00.000Z",
      "redeemed": false,
      "redeemedAt": null,
      "autoRedeemed": false,
      "principalReturn": { "atomic": "25000000", "amount": "0.25", "usdNow": 15250.4 }
    },

    "mechanics": {
      "rateType": "fixed",
      "payoutFrequency": "daily",
      "periodDays": 1,
      "ratePerPayoutPeriodPct": "0.08",
      "annualisedRatePct": "28.8",
      "durationDays": 44,
      "payoutCount": 44
    },

    "earningPower": {
      "perPayout": { "atomic": "20000",  "amount": "0.0002", "usdNow": 12.2 },
      "daily":     { "atomic": "20000",  "amount": "0.0002", "usdNow": 12.2 },
      "term":      { "atomic": "880000", "amount": "0.0088", "usdNow": 536.81 }
    },

    "progress": {
      "paymentsTillDate": 22,
      "paymentsRemaining": 22,
      "paymentsTotal": 44,
      "failedPayments": 0,
      "totalPaidInterest":      { "atomic": "440000", "amount": "0.0044", "usdNow": 268.41 },
      "totalRemainingInterest": { "atomic": "440000", "amount": "0.0044", "usdNow": 268.41 },
      "nextPayoutAt": "2026-09-24T10:00:00.000Z"
    },

    "fees": {
      "atomic": "0", "amount": "0", "usdNow": 0,
      "note": "Investors pay no fees on this bond. Any commission is paid by the issuer."
    },

    "netRoi": {
      "pct": "3.52",
      "interest": { "atomic": "880000", "amount": "0.0088", "usdNow": 536.81 }
    },

    "interestLog": {
      "items": [
        {
          "sequenceNo": 22, "status": "paid",
          "dueAt": "2026-09-23T10:00:00.000Z", "paidAt": "2026-09-23T10:04:11.000Z",
          "atomic": "20000", "amount": "0.0002", "usdNow": 12.2,
          "usdAtPayment": 11.87
        }
      ],
      "total": 22, "limit": 50, "offset": 0
    },

    "upcoming": [
      {
        "sequenceNo": 23, "status": "scheduled",
        "dueAt": "2026-09-24T10:00:00.000Z", "paidAt": null,
        "atomic": "20000", "amount": "0.0002", "usdNow": 12.2,
        "usdAtPayment": null
      }
    ],

    "pricing": {
      "usdPerUnit": 61001.6,
      "source": "live",
      "note": "usdNow uses the current rate. usdAtPayment is the value when each payment was made (null for payments made before this was recorded)."
    }
  }
}
```

- **`interestLog`** is history, newest first: paid, failed, skipped, and
  scheduled-but-overdue payouts. Group by day on the client for
  "Today / Yesterday".
- **`upcoming`** holds the next 5 scheduled payouts, soonest first.
- A bond still `pending_payment` or `cancelled` returns **404** — it was
  never a real bond, and the page shouldn't reveal the hash exists.
- Response is `Cache-Control: public, max-age=60`. It only changes when a
  payout lands (the engine runs hourly).

### Rate limit

**60 lookups per minute per client IP**, then `429 RATE_LIMITED` with a
`Retry-After` header.

The app doesn't set Express `trust proxy`, so the limiter reads the
client IP from the first `X-Forwarded-For` entry; otherwise every visitor
would share the proxy's address. That header can be spoofed, so treat
this as abuse damping, not a security boundary. What actually protects
bond data is the hash being unguessable. The counter is in-memory and
per instance.

---

## 3. "I'm the owner"

### `GET /bonds/holdings/by-hash/:bondHash` — login required

Tells a logged-in viewer whether the bond is theirs. Only the owner gets
what's needed to act on it.

**Owner:**
```json
{
  "success": true,
  "isOwner": true,
  "isIssuer": false,
  "holdingId": "6abe3f89895c3683325d6d6c",
  "invoice": { "id": "6abe3f…", "invoiceNumber": "INV-…" },
  "canRedeem": false,
  "bond": { "...": "same object as the public page" }
}
```

**Anyone else:**
```json
{ "success": true, "isOwner": false, "isIssuer": false, "bond": { "...": "public view" } }
```

A non-owner gets **no** `holdingId` and **no** `invoice`.

`canRedeem` follows the same rules as `POST /bonds/holdings/:id/redeem`:
the bond has matured, isn't already redeemed, and has no outstanding
payouts. A button driven by it never offers an action the server would
refuse. Redemption also happens automatically at maturity.

`isIssuer` is true for the founder of the issuing office.

---

## 4. Purchase history

### `GET /bonds/holdings?orgId=` — login required

**Unchanged rows, plus two new fields per row.** Every existing field is
still there.

```json
{
  "success": true,
  "items": [
    {
      "_id": "6abe3f89895c3683325d6d6c",
      "status": "active",
      "units": 1,
      "currency": "INR",
      "principalAtomic": "10000",
      "...": "every existing holding field, unchanged",

      "bondHash": "413693293985",
      "publicPath": "/public/bonds/413693293985",
      "bond": {
        "bondHash": "413693293985",
        "name": "Bonds Pool",
        "issuer": { "name": "…" },
        "payoutFrequency": "monthly",
        "annualisedRatePct": "12",
        "value":                  { "atomic": "10000", "amount": "100", "usdNow": 1.2 },
        "totalPaidInterest":      { "atomic": "100",   "amount": "1",   "usdNow": 0.01 },
        "totalRemainingInterest": { "atomic": "400",   "amount": "4",   "usdNow": 0.05 },
        "paymentsTillDate": 1,
        "paymentsRemaining": 4,
        "paymentsTotal": 5,
        "failedPayments": 0,
        "nextPayoutAt": "2026-11-01T…",
        "netRoi": { "pct": "5", "interest": { "...": "..." } }
      }
    }
  ]
}
```

The list and the public page are built by the **same function**, so their
figures are guaranteed to match. The data loads in a fixed number of
queries however many holdings there are (instruments, issuer names,
payout events, plus one cached rate per currency).

---

## 5. Holding detail

### `GET /bonds/holdings/:id` — owner or issuing founder

Existing response unchanged (`holding`, `summary`, `schedule`), plus:

| Field | |
|---|---|
| `bondHash` | The bond's public id |
| `publicPath` | `/public/bonds/<hash>` |
| `isOwner` | Whether the caller is the owner (versus the issuing founder) |
| `bond` | The full view object (§7), with up to 200 log rows |

---

## 6. Purchase receipt

### `POST /bonds/instruments/:id/purchase`

Existing response unchanged, plus `bondHash` and `publicPath`, so the
receipt can show the bond's identity and offer a share link immediately.

---

## 7. The view object, field by field

Every money field is a **Money** object:

```json
{ "atomic": "440000", "amount": "0.0044", "usdNow": 268.41 }
```

| | |
|---|---|
| `atomic` | Exact integer in the currency's smallest unit, as a string. **Authoritative.** |
| `amount` | Exact decimal string in whole units |
| `usdNow` | At the current rate, 2dp. **`null` when the price feed is down.** |

| Field | Meaning |
|---|---|
| `value` | Principal: units × unit price |
| `earningPower.perPayout` | What each payout pays this holding |
| `earningPower.daily` | `perPayout` ÷ period length in days (30-day month basis) |
| `earningPower.term` | Total interest over the full term |
| `progress.paymentsTillDate` | Payouts already paid |
| `progress.paymentsRemaining` | Scheduled **plus failed**. A failed payout ran out of retries but is still owed, and the issuer can be made to retry it |
| `progress.failedPayments` | How many of the remaining ones are failed |
| `progress.totalPaidInterest` / `totalRemainingInterest` | Exact sums of the payout events |
| `fees` | Always `0`. Investors pay no fees; commission is the issuer's cost |
| `netRoi.pct` | Term interest ÷ principal × 100, 4dp max. Net equals gross because there are no investor fees |
| `mechanics.rateType` | Always `"fixed"`. The rate is locked when the bond is published |

**About "interest rate logs":** these bonds are fixed-rate, so a rate log
would show the same rate on every line. `interestLog` is the payment log,
and the rate itself is in `mechanics`. A variable-rate bond would be a
different instrument, not a display change.

---

## 8. USD values

Two figures, answering two different questions:

| Field | Question it answers | Source |
|---|---|---|
| `usdNow` | What is this worth today? | Live rate, 5-minute cache |
| `usdAtPayment` (log rows only) | What was this payment worth when it landed? | Recorded by the payout engine at payment time |

- `usdAtPayment` is recorded for every payout **from this release on**.
  Payouts made earlier show `null`; they can't be reconstructed
  accurately.
- Recording it is **best-effort and never blocks a payout**. If the price
  feed is down when a payout runs, the investor is paid and the field
  stays `null`.
- If the feed is down when the page loads, every `usdNow` is `null` and
  `pricing.source` is `"unavailable"`. The crypto figures are unaffected
  and the page still loads.

---

## 9. Privacy — what is never public

The public page and the non-owner by-hash response **never** include:

- the owner's identity (user id, email, name);
- the internal holding `_id`;
- the invoice id or number;
- wallet transaction ids;
- the issuer's commission, affiliate payouts or founder identity.

They do include the issuer office's **name** (the bond's issuer is public
information) and the full financial picture of the bond itself.

---

## 10. Errors

| Code | Status | When |
|---|---|---|
| `INVALID_BOND_HASH` | 400 | Not 12 digits (after stripping spaces / dashes / `#`) |
| `BOND_NOT_FOUND` | 404 | No such hash, or the bond is unpaid / cancelled |
| `RATE_LIMITED` | 429 | More than 60 public lookups per minute from one IP |
| `BOND_LOOKUP_FAILED` | 500 | Unexpected server error |
| — | 401 | Missing or invalid token on a login-required route |

---

## 11. Design screen → API field map

| On the design | Field |
|---|---|
| **Bitcoin Bond – 23416167** | `name` – `bondHash` |
| Search Any Asset Hash | `GET /public/bonds/:bondHash` |
| Payments Till Date | `progress.paymentsTillDate` |
| Total Paid Interest (BTC \| USD) | `progress.totalPaidInterest.amount` \| `.usdNow` |
| Total Remaining Interest | `progress.totalRemainingInterest` |
| Interest Rate Logs (Today / Yesterday, credits) | `interestLog.items[]`, grouped by `paidAt` day |
| Expand on a log row | the same item: `status`, `dueAt`, `paidAt`, `usdAtPayment` |
| Value Of Bond | `value` |
| Issuance Details | `issuance` |
| Redemption Details | `redemption` |
| Earning Power | `earningPower.perPayout` |
| Interest Rate Mechanics | `mechanics` |
| Daily Earning Power | `earningPower.daily` |
| Term Earning Power | `earningPower.term` |
| Fees | `fees` (always 0) |
| Net ROI | `netRoi.pct` |
| Share | link to `publicPath` / the bond hash |
| I'm The Owner | `GET /bonds/holdings/by-hash/:bondHash` → `isOwner`, `canRedeem` |

---

## 12. Deployment notes

- **`autoIndex` is off in production** (`src/db/mongo.ts`), so the
  `bondHash_1` index is **not** created on deploy. It has already been
  created in production along with the backfill below. For any other
  environment, run:
  ```
  ./node_modules/.bin/tsx -r dotenv/config src/scripts/backfill-bond-hashes.ts --apply
  ```
  It's idempotent: it creates the index if missing, gives a hash to every
  holding without one, and leaves the rest alone. `npm run indexes:sync --
  BondHolding` also creates the index.
- **Production backfill already done:** all 4 existing holdings have a
  hash.
- No new dependencies. The rate limiter is built in.

### Files

| File | Change |
|---|---|
| `src/services/bondHash.ts` | **New** — generate and normalise bond hashes |
| `src/services/bondView.ts` | **New** — the one place bond figures are computed (pure `computeBondSummary`, plus audience-specific views and a batched loader) |
| `src/routes/publicBond.ts` | **New** — `GET /public/bonds/:bondHash` + rate limiter |
| `src/scripts/backfill-bond-hashes.ts` | **New** — idempotent hash backfill + index |
| `src/models/bondHolding.model.ts` | `bondHash` field + unique index |
| `src/models/bondPayoutEvent.model.ts` | `usdAtPayment`, `usdRateAtPayment` |
| `src/services/bondInvoiceFulfillment.ts` | Assigns the hash at purchase; retries on a hash collision instead of misreading it as "already fulfilled" |
| `src/services/bondPayoutEngine.ts` | Records USD at payment time, outside the transaction, never blocking |
| `src/routes/bond.ts` | by-hash owner route; enriched history, detail and receipt |
| `src/app.ts` | Mounts `/public/bonds` |
| `src/services/__tests__/bondView.test.ts` | **New** — 13 tests, including the design's exact figures |
