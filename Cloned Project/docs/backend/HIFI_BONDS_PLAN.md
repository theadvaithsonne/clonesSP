# HiFi Bonds — implementation plan

Fixed-income bond instrument for **crypto offices only**. A founder issues
a bond in units; an investor buys N units from their wallet; the engine pays
interest on a schedule and returns principal at maturity.

Source spec: `hifi-bonds-logic.md`. This document reconciles that spec with
what already exists in this backend and records the decisions taken.

Status: **backend complete, untested against a live DB.** Steps 1-3 and 5-6
of §8 are built (14 routes, payout engine, 46 unit tests). Step 4 (builder UI)
is out of scope by instruction — APIs only. Steps 7-8 remain.

---

## 0. Decisions locked

| # | Decision | Chosen |
|---|---|---|
| D1 | Where the module lives | **Full module in `garagenew-backend`** — own collections, own CRUD APIs, own scheduler |
| D2 | Commission base | **Separate rate per basis** — `principalCommissionRate` on unit price at purchase; `payoutCommissionRate` on the payout amount, per payout |
| D3 | Commission split | Reuse **`CombPlan`**: `levels` (L1/L2/L3, percentages must sum ≤ 90) or `unilevel_plus` (one percentage, engine handles the rest) |
| D4 | Currency scope | **All cryptobrand currencies** — INR, USD, ETH, BTC, USDT |
| D5 | Principal custody | **Pass through to the founder's wallet** (no escrow lock) |
| D6 | Purchase flow | **One-click from wallet** — mint invoice, pay it server-side, show the paid invoice as a receipt |
| D7 | Money precision | **Integer minor units** in all bond tables; convert to decimal only at the wallet edge |
| D8 | Maturity | **Auto-redeem** on day `durationDays + 1` |

## 0b. Open — confirm before build

These were not selected in the redemption question, so they are currently
read as **allowed**. Each one costs real complexity; say the word and they
become "blocked" instead.

| # | Item | If allowed (current reading) | Recommendation |
|---|---|---|---|
| O1 | **Early redemption** | **BUILT AS BLOCKED.** `redeemHolding` refuses with `not_matured` before `maturesAt`. Flipping this needs forfeiture rules + commission clawback across the upline. | Confirm blocked. |
| O2 | **Partial redemption** | **BUILT AS BLOCKED.** One `bond_holdings` row per purchase, redeemed whole. Flipping this is a model migration to unit-level rows, not a field. | Confirm blocked. |
| O3 | **Frequency/duration mismatch** | **BUILT AS BLOCKED.** `validateInstrument` rejects `DURATION_NOT_WHOLE_PERIODS`. The payout engine implements no pro-rata stub, so allowing one would silently drop the remainder. | Confirm blocked. |
| O4 | **Commission currency** | **RESOLVED.** The pool converts to USD at the bond boundary via `cryptoFxRate.convertBetween`, which supports all five currencies. The commission engines are untouched, and all five currencies ship together — no INR-only phase needed. | Affiliates are paid in **USD**. |
| O5 | **Crypto unit-price granularity** | NEW. The invoice layer stores `Math.round(amount * 100)` for every currency, so a 0.005 ETH unit price would be recorded as 0.01 ETH. v1 rejects prices finer than 2dp rather than misstating the receipt. | Lift by widening the invoice amount representation. |

---

## 1. Correction to the spec's worked example

§5 of the spec is labelled "the one to test against". Under **D2** its
numbers change, because payout commission is now 1% of the ₹10 payout
rather than 1% of the ₹1,000 unit price:

| When | From → To | Spec (§5) | Under D2 |
|---|---|---|---|
| Day 0 | buyer → seller | +₹1,000 | +₹1,000 |
| Day 0 | seller → affiliates | −₹10 | −₹10 |
| Day 1..90 | seller → buyer | −₹900 | −₹900 |
| Day 1..90 | seller → affiliates | −₹900 | **−₹9** |
| Day 90 | seller → buyer | −₹1,000 | −₹1,000 |
| **Seller net / unit** | | **−₹1,810** | **−₹919** |

The obligation preview in §7 must be built against the right-hand column.

---

## 2. What already exists (reuse, do not rebuild)

There is a production HiFi investment system already. Products, KYC, the
6-step application flow and payout runs live in **`garage-seller-hifi`**
(a separate Next app, same DB, not in this repo). This backend owns the
money layer only. Bonds reuse that money layer wholesale.

| Need | Already exists | Where |
|---|---|---|
| Pay an invoice silently from a wallet | `POST /api/invoices/:id/pay-with-wallet` | `src/routes/invoice.ts` |
| Debit a specific-currency wallet | `debitStoreWallet(userId, orgId, amount, desc, relatedUserId, note, currency)` | `src/services/wallet.ts:462` |
| Idempotent credit | `creditStoreWalletExternal({…, dedupeKey})` — unique partial index makes at-most-once a DB guarantee | `src/services/wallet.ts:355` |
| Affiliate/platform credit inside a txn | `creditAffiliateOrPlatform({…, session})` — the real comp-plan seam | `src/services/wallet.ts:1500` |
| Unilevel split | `distributeUnilevelPlusCommission({buyerId, planId, saleAmount, paymentId})` | `src/services/unilevelPlusCommission.ts:499` |
| Levels split | `distributeCommissions(…)` (sale-shaped, see §5) | `src/services/commission.ts:556` |
| Fulfillment hook | `fulfillInvoice` switch on `itemType` | `src/services/invoice.ts` |
| Crypto-office gate | `Organization.officeCreatedFromCryptobrand` | `src/models/organization.model.ts:67` |
| Multi-currency wallets | `ensureCryptobrandWallets` → USD parent + INR/ETH/BTC/USDT siblings | `src/services/cryptobrandWallets.ts:36` |
| Multi-currency FX | `convertBetween(amount, from, to)` | `src/services/cryptoFxRate.ts` |
| Bulk idempotent payouts | `POST /hifi/payouts/distribute` — dedupeKey per (run, buyer), auto-reverses a debit whose credit failed | `src/routes/hifiInvoice.ts` |

**Pattern to copy for the scheduler:** there is no cron library and no leader
election — every job is a `setInterval` registered in `src/index.ts`, and
safety comes *only* from per-row unique `dedupeKey`s. Money-moving ticks are
additionally gated behind an `*_ENABLED === "true"` env so they run
dry until switched on. The bond engine must inherit both properties.

---

## 3. Corrections to the spec's assumptions

1. **`comp_plan: unilevel | rtps` — RTPS does not exist.** Zero hits across
   this repo and the crypto backend. The two real engines are `levels` and
   `unilevel_plus` (`CombPlanKind`, `src/models/combPlan.model.ts:36`). Use
   those names.
2. **`InvoiceItemType` has no investment member.** Adding `hifi_bond` means
   extending the union plus a `case` in `fulfillInvoice`.
3. **`CombPlan.itemType` is a closed union of 7 values** with no bond member —
   also needs extending for a bond to carry a comp plan.
4. **`COMB_PLAN_MAX_PERCENTAGE = 90`** already enforces the spec's "each
   percentage and the total percentage should match" rule for the levels path.
5. **Wallet balances are floats.** A `$inc` produced `0.10000000000000142` in
   production this week. This is why D7 exists.
6. **ETH cannot be held as an integer in a JS `Number`.** 1 ETH = 1e18 wei;
   `Number.MAX_SAFE_INTEGER` ≈ 9.0e15, so even 0.01 ETH overflows. Atomic
   amounts must be **strings manipulated with `BigInt`** (the crypto backend
   already stores `expectedAmountAtomic` this way), not numbers.

---

## 4. Data model

Four new collections. All amounts are **atomic integer strings**; a
`MINOR_UNITS` table gives the scale per currency (INR 2, USD 2, USDT 6,
BTC 8, ETH 18).

### `bond_instruments`
Seller-defined (spec §2) plus derived (§3), denormalised at publish so a
later plan edit cannot retroactively change live obligations.

```
orgId, createdBy, status: draft|published|fully_subscribed|closed
unitPriceAtomic: string, currency
durationDays: int, payoutFrequency: daily|monthly|quarterly|half_yearly|yearly
ratePerPayoutPeriod: decimal        // NOT annualised — see spec §8
totalUnits, minUnits, unitsSold
commissionBasis: principal|payout|both|none
principalCommissionRate, payoutCommissionRate   // D2: two fields
combPlanId                                       // levels | unilevel_plus
derived: {
  // per unit (spec §3)
  payoutAmountPerUnitAtomic, payoutCount,
  totalInterestPerUnitAtomic, totalCommissionPerUnitAtomic,
  totalOutflowPerUnitAtomic,
  // at full subscription — spec §7 requires all five again × totalUnits
  totalRaiseAtomic, totalInterestAtFullAtomic,
  totalCommissionAtFullAtomic, totalOutflowAtFullAtomic,
  effectiveAnnualisedRate }
publishedAt, closedAt
```
Indexes: `{orgId, status}`, `{status, payoutFrequency}`.

### `bond_holdings`
One row per purchase (O2 = blocked keeps it one row).

```
instrumentId, buyerUserId, orgId, units, currency
principalAtomic, invoiceId
status: pending_payment|active|payout_failed|matured|redeemed|cancelled
purchasedAt, maturesAt, nextPayoutAt, payoutsCompleted
redeemedAt, redemptionTxId
```
Indexes: `{status, nextPayoutAt}` ← the scheduler's only query;
`{buyerUserId, orgId}`; `{instrumentId}`.

### `bond_payout_events`
Pre-scheduled, one row per (holding, sequence). **Written before the wallet
call** so a retry cannot double-pay — spec §8.

```
holdingId, instrumentId, sequenceNo, dueAt
interestAtomic, commissionAtomic, currency
status: scheduled|paid|failed|skipped
attempts, lastError, paidAt
walletTransactionId, commissionDistributionId
dedupeKey: "bond_payout_<holdingId>_<sequenceNo>"   // UNIQUE
```
Indexes: unique `{dedupeKey}`; `{status, dueAt}`.

### `bond_ledger_entries`
Append-only audit of every movement (purchase, payout, commission,
redemption, reversal), mirroring the `hifi_*` ledger so the existing
org-transactions view pattern can be reused.

---

## 5. Commission — the biggest work item

**The problem.** D4 puts bonds in INR/USD/ETH/BTC/USDT. But:

- `distributeCommissions` calls `convertToUsd`, which handles **only USD and
  INR** and **throws** on anything else (`src/utils/exchangeRate.ts:160`).
- It then does `const currency = "USD"` — every downstream write is USD.
- `distributeUnilevelPlusCommission` accepts a `currency` argument, stores it
  on the distribution row, and then hard-codes `currency: "USD"` on all six
  credit paths. Passing `"INR"` silently mislabels rather than erroring.

**Proposal (O4 — needs sign-off).** Do *not* widen the commission engines.
Instead, at the bond boundary:

1. Compute the commission pool in the bond's own currency, in atomic units.
2. Convert that pool to USD with `cryptoFxRate.convertBetween` (which already
   supports all five currencies), stamping the rate used on the ledger row.
3. Hand the USD figure to the existing splitter.

Affiliates are then paid in USD, exactly as they are for every other product
on the platform. This avoids touching two engines with ~28 callers between
them, and keeps commission accounting in one currency.

**Splitter dispatch.** There is no generic `(amount, plan, buyer)` entrypoint
today — `distributeCommissions` is sale-shaped and demands `itemType`,
`itemId`, `sellerId`, `customerId`. So add one:

```ts
splitBondCommissionPool({ amountUsd, combPlanId, buyerId, paymentId, session })
  → switch (plan.planKind)
      "unilevel_plus" → distributeUnilevelPlusCommission({ … })   // already generic
      "levels"        → new walker built on the extracted referral chain
```
The `levels` branch needs `getReferralChain` / `getQualifiedReferralChain`
exported from `commission.ts` (currently module-private).

`commissionBasis: "none"` short-circuits before step 1 at both hook points
(purchase and payout) — no pool computed, no ledger row, no splitter call.

---

## 6. APIs

Namespace `/bonds/*`, mirroring the existing `/hifi/*` bridge. Every route
asserts `officeCreatedFromCryptobrand === true`.

**Founder — instrument CRUD**
```
POST   /bonds/instruments              draft; validates O3 multiple rule
POST   /bonds/instruments/preview      derived figures, no write — powers §7 panel
GET    /bonds/instruments?orgId=       list
GET    /bonds/instruments/:id
PATCH  /bonds/instruments/:id          draft only; 409 once published
POST   /bonds/instruments/:id/publish  requires acknowledged total-outflow figure
POST   /bonds/instruments/:id/close    stops new purchases; live holdings unaffected
```

**Investor**
```
GET    /bonds/instruments/:id/quote?units=N    price, schedule, total return
POST   /bonds/instruments/:id/purchase         ← one-click (D6)
GET    /bonds/holdings?orgId=                  my holdings + accrued
GET    /bonds/holdings/:id                     full payout schedule
POST   /bonds/holdings/:id/redeem              manual; auto-redeem also runs (D8)
```

**Founder — monitoring**
```
GET    /bonds/instruments/:id/obligations      upcoming outflow, funding shortfall
GET    /bonds/organizations/:orgId/ledger      reuses the hifi ledger shape
```

### The one-click purchase (D6)
```
1. Assert crypto office, instrument published, units ≤ available, ≥ minUnits.
2. Assert buyer wallet balance ≥ N × unitPrice in the bond currency.
3. Mint Invoice (itemType "hifi_bond", currency = bond currency).
4. Pay it server-side via the same path pay-with-wallet uses — no redirect.
5. fulfillInvoice → case "hifi_bond":
     • debit buyer, credit founder (D5 pass-through)
     • create bond_holding (status active)
     • pre-create all payout_count bond_payout_events
     • if basis includes principal → commission pool → §5 splitter
     • $inc instrument.unitsSold, flip to fully_subscribed at cap
6. Return the PAID invoice as a receipt.
```
Idempotency: `dedupeKey = "bond_purchase_<invoiceId>"`.

---

## 7. Payout engine

A `setInterval` tick in `src/index.ts`, gated behind
`BOND_PAYOUTS_ENABLED === "true"` (dry-run until flipped), hourly.

```
1. Find bond_payout_events {status:"scheduled", dueAt:{$lte:now}}, capped batch.
2. Per event, own mongo session:
     a. Re-assert dedupeKey unclaimed (E11000 later = success, idempotent).
     b. Debit founder wallet by interestAtomic.
        Insufficient → event.attempts++, holding.status="payout_failed",
        notify founder. Retried on later ticks up to BOND_PAYOUT_MAX_ATTEMPTS
        (default 5, backing off 1h/6h/24h/24h/24h); on exhaustion the event
        goes status="failed" and stops being picked up — it then needs an
        explicit founder-triggered retry, so a funded-late seller is not
        silently skipped forever. Does NOT cascade to other holdings.
     c. Credit buyer wallet.
     d. If credit fails after debit succeeded → auto-reverse the debit
        (the existing hifi payout endpoint already does exactly this).
     e. If basis includes payout → commission pool → §5 splitter.
     f. event.status="paid"; holding.payoutsCompleted++; recompute nextPayoutAt.
3. Holdings past maturity with all payouts done → auto-redeem (D8):
   return principal, holding.status="redeemed".
```

Rounding (spec §8): compute **per unit**, round to the currency's minor unit,
*then* multiply by N — never the reverse, or two identical holdings diverge.

`payout_failed` is buyer-visible and honest, per the spec.

---

## 8. Rollout

1. Models + `MINOR_UNITS` + BigInt money helpers + unit tests on the §1 table.
2. Extend `InvoiceItemType` and `CombPlan.itemType`; add the `fulfillInvoice` case.
3. Instrument CRUD + preview endpoint (no money moves yet).
4. Builder panel (§7 of the spec) + the hard confirmation step.
5. Purchase flow end-to-end in **INR only**, on a test office.
6. Payout engine with `BOND_PAYOUTS_ENABLED=false` — verify scheduled rows
   and computed amounts against the §1 table before any money moves.
7. Flip the flag on one short-duration test bond; verify daily payouts.
8. Widen to the remaining currencies once the USD-conversion path (§5) is proven.

## 9. Risks

- **Seller insolvency is now a live failure mode** (D5, no escrow). The
  obligations endpoint and founder notifications are the only mitigation.
  Recommend surfacing a funding-shortfall warning in the founder UI.
- **Scheduler fan-out**: daily × 90 days × N holdings. 1,000 holdings = 90,000
  pre-created rows per instrument. Indexed on `{status, dueAt}` and batched,
  but worth a load check before a daily-frequency bond goes live.
- **No leader election** — correctness rests entirely on the unique dedupeKey
  index. That index is not optional.
- **FX drift** (§5): commission converts to USD at payout time, so the
  affiliate's USD amount varies across a crypto-denominated bond's term even
  though the investor's payout is fixed in the bond currency.
- **Regulatory** (spec §10): multi-level commission paid from the same wallet
  that funds investor returns. Spec recommends Garage, not the seller, caps
  `commissionRate`. `COMB_PLAN_MAX_PERCENTAGE = 90` is far too loose for this.
