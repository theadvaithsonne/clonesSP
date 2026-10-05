# Conversion fees — API reference

A founder of a **crypto office** sets a conversion fee per currency pair
(INR → USDT = 10%, INR → BTC = 20%). Garage charges it **inside** the
existing convert/transfer endpoints, and the fee lands in the founder's
wallet in the **same database transaction** as the conversion.

On a cross-org move, **the sending org's schedule applies and the sender
pays**. The receiver is never deducted.

The founder may also route **a percentage of that fee** through the
Unilevel Plus comp plan — the same engine founder products use. See §7.

**No environment variables.** Nothing to configure.

---

## Base URLs + Auth

- **Test**: `https://test.garage.app`
- **Prod**: `https://api.my.garage.app`

Bearer-JWT on every endpoint, same as the rest of the platform.

### Access

| Endpoint | Access |
|---|---|
| `GET /wallet/store/conversion-fees` | Any **member** of the org |
| `GET /wallet/store/conversion-fee` | Any **member** of the org |
| `PUT /wallet/store/conversion-fees` | **Founder** of the org |
| `GET /wallet/store/conversion-fees/earnings` | **Founder** of the org |
| `POST /wallet/store/convert/preview` | Any authenticated user |
| `POST /wallet/store/convert` · `transfer-multi` | Member of the funding org |
| `GET /wallet/store/transfer/:transferGroupId` | Any party to the transfer (payer, payee, **or fee beneficiary**) |

Founder checks do a real org-membership lookup, **not** the JWT `role`
claim — `requireFounder` in `middleware/roles.ts` only reads the token
and says nothing about *this* org. A fee is a price; it gets the real check.

---

## The fee math

Charged on the **sell side, in the currency being sold, before FX**:

```
gross  = amount the customer submits        (fromCurrency)
fee    = round8(gross × feeBps / 10000)     (fromCurrency)
net    = round8(gross − fee)                (fromCurrency)
credit = convertBetween(net, from, to)      (toCurrency)
```

Worked example — 100,000 INR → BTC at 20%:

| | |
|---|---|
| Debited from customer | **100,000 INR** (the gross) |
| Fee to the org's founder | **20,000 INR** |
| Converted | 80,000 INR worth of BTC |
| Credited | `convertBetween(80000, "INR", "BTC")` |

`fromWallet.amountDebited` stays **gross**, so
`balanceBefore − amountDebited === balanceAfter` still holds.

### The fee is DEDUCTED, not added on top

This is the single most misread part of the design, so plainly: the
amount the customer enters is the amount that **leaves their wallet**.
The fee comes out of it; the remainder is what converts.

| Founder sets 2%, customer enters 100,000 INR | |
|---|---|
| Leaves their wallet | **100,000 INR** (exactly what they typed) |
| Fee to the founder | 2,000 INR |
| Converted to BTC | **98,000 INR** worth |

It is **not** "100,000 converts and 102,000 is debited". Two consequences
worth knowing:

- **"Convert all" works.** A customer can enter their entire balance.
  Under an added-on-top model there would be no room for the fee and
  every max-amount conversion would fail `INSUFFICIENT_BALANCE`, forcing
  the client to solve backwards (`max = balance ÷ 1.02`).
- **The balance check is the number they typed**, which is the same
  number the client pre-checks against.

### The fee does not depend on the FX rate

2% of 100,000 INR is 2,000 INR whatever BTC is doing. The fee is
computed on the sell side **before** `convertBetween` is called, so it
is exact and quotable the moment an amount is typed — even if the rate
feed is slow — and it is guaranteed to match the receipt.

Charging the buy side instead (a slice of the received BTC) would make
the fee rate-dependent, so the figure quoted before a trade would never
be the figure on the receipt.

### Rounding and edge cases

- **`round8` everywhere**, identical to what `transferBetweenWallets`
  already does at every step.
- **`fee + net === gross`, asserted at 8dp.** Adding two exact 8dp
  floats can land outside 8dp (`1e-8 + 2e-8` is `3.0000000000000004e-8`
  in IEEE754), which is why the debit leg writes `gross` directly rather
  than recomputing `fee + net`.
- **Balance check runs against `gross`**, not net. `INSUFFICIENT_BALANCE`
  if the customer can't cover amount + fee. No partial fill.
- **A fee that rounds DOWN to zero charges nothing** rather than rounding up.
- **A fee that rounds UP to the whole amount also charges nothing.** The
  original spec assumed the 50% cap made `net <= 0` unreachable — it
  doesn't. 50% of one satoshi is `0.000000005`, which rounds to
  `0.00000001`, the entire amount. Charging there would debit the
  customer and deliver nothing, so dust is treated as dust. A rate
  `>= 10000` bps (≥100%) is a corrupt schedule, not rounding, and throws.
- **Same-currency is never charged.** `USD → USD` to another org is a
  relocation, not a conversion.
- **Stablecoin hops ARE chargeable.** `USD ↔ USDT ↔ USDC` price 1:1 in
  the FX layer, but moving between fiat and a stablecoin is a real OTC
  service. The founder prices it or doesn't.
- **Founders are exempt on their own org.** Paying yourself through a
  ledger round trip nets to zero and clutters the earnings report.

---

## 1. Read the schedule

### `GET /wallet/store/conversion-fees?orgId=<id>`

An org that has never saved a schedule returns `defaultFeeBps: 0,
pairs: []` — **not a 404**. The customer app calls this before quoting.

```json
{
  "success": true,
  "orgId": "66f0...",
  "defaultFeeBps": 0,
  "compPlanPercentage": 50,
  "pairs": [
    { "fromCurrency": "INR", "toCurrency": "USDT", "feeBps": 1000, "feePct": 10, "isActive": true },
    { "fromCurrency": "INR", "toCurrency": "BTC",  "feeBps": 2000, "feePct": 20, "isActive": true },
    { "fromCurrency": "USD", "toCurrency": "INR",  "feeBps": 50,   "feePct": 0.5, "isActive": false }
  ],
  "maxFeeBps": 5000,
  "feeBeneficiary": { "userId": "66ab...", "orgId": "66f0..." },
  "updatedAt": "2026-10-01T10:00:00.000Z",
  "updatedBy": "66ab..."
}
```

`maxFeeBps` is served so the UI enforces the same ceiling the server does.

### `GET /wallet/store/conversion-fee?orgId=&fromCurrency=&toCurrency=`

Single pair, for a rate card outside a live quote. Note the **singular**
path.

```json
{
  "success": true,
  "orgId": "66f0...", "fromCurrency": "INR", "toCurrency": "BTC",
  "feeBps": 2000, "feePct": 20,
  "source": "pair",
  "effectiveFrom": null
}
```

`source` is `"pair"` (explicit row), `"default"` (org default), or
`"none"` (nothing configured, or not a chargeable pair).

It deliberately returns **no fee amount** — only the server computes
that, at preview or conversion. A client computing its own would
eventually disagree with the receipt.

---

## 2. Write the schedule

### `PUT /wallet/store/conversion-fees` — founder only

Replaces the whole map. The founder edits a table and saves it; a
wholesale replace has no merge semantics to get wrong.

```json
{
  "orgId": "66f0...",
  "defaultFeeBps": 0,
  "pairs": [
    { "fromCurrency": "INR", "toCurrency": "USDT", "feeBps": 1000, "isActive": true },
    { "fromCurrency": "INR", "toCurrency": "BTC",  "feeBps": 2000, "isActive": true }
  ]
}
```

**Rates are basis points, integers.** 10% is exactly `1000`. No float
storage, so no rounding argument can start.

| Rule | Enforced |
|---|---|
| `0 ≤ feeBps ≤ 5000` (0–50%), integer | 400 `INVALID_FEE_CONFIG` |
| `0 ≤ compPlanPercentage ≤ 100` | 400 `INVALID_FEE_CONFIG` |
| Both currencies in `TRANSFERABLE_CURRENCIES` | 400 `INVALID_FEE_CONFIG` |
| `fromCurrency !== toCurrency` | 400 `INVALID_FEE_CONFIG` |
| One row per `(from, to)` — pairs are **directional** | 400 `INVALID_FEE_CONFIG` |
| Caller is founder of `orgId` | 403 `FORBIDDEN_NOT_FOUNDER` |

`INR → BTC` at 20% says nothing about `BTC → INR`. A founder who wants
both sets both rows.

`isActive: false` means **no fee for that pair** — it does *not* fall
back to `defaultFeeBps`.

Every write stamps `updatedBy` / `updatedAt`. A fee is a price; someone
will ask who changed it.

---

## 3. Quote with the fee

### `POST /wallet/store/convert/preview`

```json
{
  "fromCurrency": "INR", "toCurrency": "BTC", "amount": 100000,
  "fromOrgId": "66f0...", "toOrgId": "66f0..."
}
```

`fromOrgId` / `toOrgId` are **new**. They were previously stripped by the
zod schema even though clients were already sending them, which made a
fee-aware quote impossible. Without `fromOrgId` there is no schedule to
look up and the fee is 0.

```json
{
  "success": true,
  "fx": { "fromCurrency": "INR", "toCurrency": "BTC", "rate": 0.0000001,
          "path": ["INR","USD","BTC"], "capturedAt": "..." },
  "wouldDebit": 100000,
  "fee": {
    "feeBps": 2000, "currency": "INR", "amount": 20000,
    "sourceOrgId": "66f0...", "beneficiaryUserId": "66ab..."
  },
  "netConverted": 80000,
  "estimatedCredit": 0.008
}
```

`wouldDebit` is the **gross**. `estimatedCredit` is **after** the fee.
If those disagree with the receipt you get bug reports about a desk
stealing money.

Writes nothing. Every failure now carries a `code`.

---

## 4. Convert / transfer — the fee is charged here

### `POST /wallet/store/convert` · `POST /wallet/store/transfer-multi`

**No new request fields.** The fee is server state, not client input — a
client that could send `feeBps` could send `0`.

Both responses gain the same `fee` block plus a third transaction id:

```json
{
  "success": true,
  "fromWallet": { "amountDebited": 100000, "balanceBefore": 500000, "balanceAfter": 400000 },
  "toWallet":   { "amountCredited": 0.008 },
  "fee": {
    "feeBps": 2000, "currency": "INR", "amount": 20000,
    "netConverted": 80000,
    "sourceOrgId": "66f0...", "beneficiaryUserId": "66ab...", "beneficiaryOrgId": "66f0..."
  },
  "fx": { "...": "..." },
  "transactionIds": { "debit": "...", "credit": "...", "fee": "..." },
  "transferGroupId": "..."
}
```

`fee` is **always present**; `amount: 0` when none applied, and
`transactionIds.fee` is absent in that case (no zero-value row is written).

Backwards compatible — old clients ignore the block.

### Which schedule applies

| Flow | Endpoint | Schedule used |
|---|---|---|
| Convert inside one org | `/store/convert` | that org |
| Move your own funds to another org | `/store/convert` cross-org | **`fromOrgId`** |
| Pay another user, any org, any currency | `/store/transfer-multi` | **`fromOrgId`** |

All three funnel through `transferBetweenWallets()`, so there is exactly
one lookup site. The receiving org earns nothing on inbound flow.

---

## 5. The receipt

### `GET /wallet/store/transfer/:transferGroupId`

Returns the same `fee` block. This is what the client rebuilds after a
`409 DUPLICATE_DEDUPE_KEY`, so without the fee a retried receipt would
show a different total than the original.

> **Implementation note.** This endpoint used to pick legs with
> `rows.find(r => r.type === "debit" | "credit")`. The fee row is *also*
> `type: "credit"`, so that could return the fee as the credit leg and
> misreport the receipt. It now selects on `metadata.leg`, which has been
> stamped on both legs since before fees existed.

---

## 6. Fee revenue

### `GET /wallet/store/conversion-fees/earnings?orgId=&from=&to=&currency=` — founder only

Derived entirely from the ledger. Capped at 1000 rows.

```json
{
  "success": true,
  "totals": [ { "currency": "INR", "amount": 420000, "conversions": 37 } ],
  "rows": [
    { "transferGroupId": "...", "at": "2026-10-01T...", "pair": "INR/BTC",
      "feeBps": 2000, "grossAmount": 100000, "feeAmount": 20000,
      "currency": "INR", "payerUserId": "66cd..." }
  ]
}
```

---

## 7. Comp plan on the fee

A founder can send part of the fee they collect into the **Unilevel
Plus** tree. `compPlanPercentage` is a percentage **of the fee**, not of
the conversion:

| 2% fee, 50% comp plan, on a 100,000 INR conversion | |
|---|---|
| Fee collected | 2,000 INR |
| → Unilevel Plus tree | **1,000 INR** |
| → Founder keeps | **1,000 INR** |

Set it on the schedule:

```json
PUT /wallet/store/conversion-fees
{ "orgId": "66f0...", "compPlanPercentage": 50, "pairs": [ ... ] }
```

`0` (default) means the founder keeps the whole fee. The rounding
residue always goes to the **founder**, so
`founderShare + compPlanShare === fee` exactly.

### It runs after the conversion commits — on purpose

`distributeUnilevelPlusCommission` **starts and owns its own Mongo
transaction** and cannot join the conversion's session. Calling it from
inside would nest an independent transaction that commits even if the
conversion rolled back — paying commission on a trade that never
happened. Territory and franchise commissions already run post-commit
for exactly this reason.

Three things keep the gap safe:

1. **The plan is resolved *before* the transaction.** If the org has
   `compPlanPercentage` set but there is no active Unilevel Plus plan,
   no slice is carved out at all — the founder keeps the whole fee
   rather than a share going nowhere.
2. **Unplaced money is refunded.** With `sweepUnspent: "return"` the
   engine credits nobody for unfilled positions, so whatever the tree
   cannot place is credited back to the founder in the original
   currency (derived from the ratio, not a second FX call). Without
   this a payer with no upline would have money deducted that reached
   no one.
3. **It is idempotent.** `paymentId` is `convfee_<transferGroupId>`, so
   a replay cannot double-pay.

**Residual risk, stated plainly:** if the settlement call itself fails
hard (network, DB), the comp-plan slice has been withheld from the
founder but not yet distributed. It is logged with the exact replay
command and is safe to re-run. A reconcile sweep (mirroring
`reconcileThirdPartyCommissions`) is **not** built.

### Payouts are in USD

Unilevel Plus hard-codes USD on every credit path, so the slice is
converted at this boundary via `convertBetween`. Affiliates are paid in
USD exactly as they are for every other product on the platform.

### In the response

```json
"fee": {
  "feeBps": 200, "currency": "INR", "amount": 2000,
  "compPlanPercentage": 50,
  "founderShare": 1000,
  "compPlanShare": 1000,
  "compPlan": {
    "distributedUsd": 11.9,
    "recipients": 4,
    "unspentUsd": 0,
    "refundedToFounder": 0
  }
}
```

`compPlan` is `null` when there is no comp plan — or when settlement
failed, which is the signal to check the logs.

**The fee row credits `founderShare`, not the full fee.** Tree payouts
are separate `WalletTransaction` rows written by the Unilevel Plus
engine with its own metadata.

---

## 8. The ledger — three rows, one transaction

The fee credit is written inside the **same** `session.withTransaction()`
as the debit and credit. If it fails, the trade rolls back with it.

That atomicity is the entire reason this lives in Garage. A previous
attempt sequenced "convert, then move the fee" as two calls from a
caller; a failure in between meant the desk had converted for free with
no way to unwind the first leg.

| Row | Wallet | Type | `metadata.leg` | `metadata.kind` | `metadata.dedupeKey` |
|---|---|---|---|---|---|
| Debit | payer | `debit` | `debit` | `wallet_convert` / `wallet_transfer_multi` | `<key>_debit` |
| Credit | payee | `credit` | `credit` | same | `<key>_credit` |
| **Fee** | **founder** | `credit` | **`fee`** | **`wallet_conversion_fee`** | **`<key>_fee`** |

All three share one `transferGroupId`.

The fee row's metadata carries `fee: { feeBps, grossAmount, netAmount,
currency }`, `counterparty`, and the `fx` snapshot. **The payer's own
debit row also gets `metadata.fee`**, so their ledger can explain where
the difference went without joining to a row on a wallet they cannot read.

**Beneficiary wallet**: the founder's `StoreWallet` in `fromOrgId` and
`fromCurrency`, resolved via `findOrgFounderId`. Auto-created inside the
same transaction if missing — a missing fee wallet must never fail a
customer's conversion.

**Idempotency is unchanged.** A replay still collides on `<key>_debit`
first and surfaces `409 DUPLICATE_DEDUPE_KEY`.

---

## 9. Error codes

Existing, unchanged: `INVALID_AMOUNT`, `INSUFFICIENT_BALANCE` (now vs
**gross**), `IDENTICAL_ENDPOINTS`, `UNSUPPORTED_CURRENCY`,
`WALLET_NOT_FOUND`, `FX_FEED_UNAVAILABLE` (503),
`DUPLICATE_DEDUPE_KEY` (409).

New:

| Code | Status | When |
|---|---|---|
| `INVALID_FEE_CONFIG` | 400 | `PUT` fails validation — bps out of range, bad currency, `from === to`, duplicate pair |
| `FEE_WALLET_UNAVAILABLE` | 409 | The org charges a fee but has no founder to receive it. **Fails the whole conversion** rather than silently converting for free |
| `FORBIDDEN_NOT_FOUNDER` | 403 | Non-founder attempts `PUT` or reads earnings |
| `FORBIDDEN_NOT_MEMBER` | 403 | Non-member reads a schedule |
| `INVALID_REQUEST` / `PREVIEW_FAILED` | 400 | Preview validation / failure — preview now always returns a `code` |

---

## 10. Files

| File | Role |
|---|---|
| `src/models/orgConversionFee.model.ts` | Schedule, one doc per org, collection `org_conversion_fees` |
| `src/services/conversionFee.ts` | `resolveFee`, `computeFee`, `isChargeablePair`, `isFeeExempt`, `round8` |
| `src/services/wallet.ts` | Fee resolved before FX; third ledger row inside the transaction; `fee` on the result |
| `src/routes/wallet.ts` | 4 new endpoints; preview takes org ids; receipt returns the fee |
| `src/services/__tests__/conversionFee.test.ts` | 17 tests — math invariants, rounding, dust, exemption |

---

## 11. Not built

- **A reconcile sweep for failed comp-plan settlements.** See §7.
- **A `levels` comp plan on conversion fees.** Unilevel Plus only; the
  bonds work has the levels walker if it is ever wanted here.
- **A cut for the receiving org on inbound cross-org flow.** Would be a
  second fee, a second beneficiary and a fourth ledger row, and the
  receiver's credit would stop matching the FX.
- **Effective-dated / scheduled fees.** A change is immediate for
  everyone; a quote is indicative until commit.
- **Quote locking.** The fee is exact the moment an amount is typed, but
  the FX is not. A held rate would need `expiresAt` and a quote id.
- **An org-owned fee wallet.** Fees go to the founder's personal store
  wallet. `StoreWallet` is keyed `{userId, orgId, currency}` with no
  org-owned concept, so this would need a new model. `beneficiaryUserId`
  and `beneficiaryOrgId` are both returned so the destination can move
  later without breaking any client.
