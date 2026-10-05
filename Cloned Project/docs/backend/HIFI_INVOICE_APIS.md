# HiFi Investment — Invoice + Wallet Payment APIs

Bridge between the **garage-seller-hifi** Next app's investor
application flow and this backend's invoice + multi-currency store
wallet system. The HiFi seller app owns products (`hifi_products`),
KYC (`hifi_investment_kyc`), the multi-step application flow
(`hifi_investment_applications`), subscriptions
(`hifi_investment_subscriptions`), and payout runs
(`hifi_payout_runs`). This backend adds:

- Invoice minting + fulfillment for an application's pay step (wallet
  path OR crypto-invoice path).
- Server-authoritative cryptobrand onboarding status.
- Bulk payout distribution from founder escrow to investor wallets.
- Org-scoped ledger view of every hifi-related wallet transaction.

Product creation, KYC, founder-side review of steps, and payout-run
authoring remain in the seller app — this repo exposes no CRUD for
hifi_*.

**Same DB** — `roam-admin-prod`. This repo reads/writes the hifi_*
collections directly (raw driver access, no mongoose schemas mirrored)
so schema drift on the seller side doesn't require a code deploy here.

---

## Base URLs + Auth

- **Test**: `https://test.garage.app`
- **Prod**: `https://api.my.garage.app` (env-dependent)

All endpoints below are Bearer-JWT authenticated (same JWT as the rest
of the platform). **CORS is fully open** — no origin whitelist needed
on this backend.

Route prefixes:
- `/hifi/*` — hifi-specific bridge routes (this document)
- `/org/*` — the cryptobrand-checkout status route (co-located with
  other per-org reads)
- `/api/invoices/*` — the shared invoice-pay endpoints (`GET`,
  `pay-with-wallet`, `select-payment-method`)
- `/wallet/*` — the shared wallet balance + transactions endpoints

---

## Flow overview

```
1. HiFi seller FE walks the investor through steps 1..6 (KYC,
   founder review, custom form, etc.). Application status stays
   `pending` until the pay step.

2. Investor reaches the "Pay" step. Seller FE calls:
     POST /hifi/applications/:applicationId/invoice
   Returns { invoice: { id, redirectUrl, paymentChannel, … } }.

3. Seller FE opens redirectUrl (= /invoice/<id>).

4. Investor pays. Two channels are possible per invoice:
     • paymentChannel="wallet" — POST /api/invoices/:id/pay-with-wallet
       with { walletType: "store", orgId, currency }. Currency must be
       one of the allowedWalletCurrencies list on the invoice.
     • paymentChannel="crypto" — invoice is billed in USDC/USDT; the
       investor picks the matching chain+coin on the crypto tab and
       sends on-chain. The in-house poller matches by amount tail.

5. fulfillInvoice("hifi_investment") fires (both channels):
     • Updates hifi_investment_application
         paymentStatus="success", status="completed", paidAt,
         paymentPayload, stepStatuses.<activeStepId>="success"
     • Upserts hifi_investment_subscription (idempotent on applicationId)
     • Credits founder-org StoreWallet with principal (escrow)
     • Emits socket `hifi:application:paid` to org + user rooms

6. Later — HiFi seller runs a payout. Creates hifi_payout_runs, then
   calls POST /hifi/payouts/distribute to actually move money to
   investors from the founder's escrow wallet.
```

---

## Access model

| Endpoint | Access rule |
|---|---|
| `POST /hifi/applications/:id/invoice` | Requester must be the application's `userId`. |
| `GET  /hifi/applications/:id/invoice` | Requester must be the application's `userId`. |
| `POST /hifi/payouts/distribute` | Founder of `organizationId`. |
| `GET  /hifi/organizations/:orgId/transactions` | Founder of `orgId`. |
| `GET  /org/:orgId/cryptobrand-checkout` | Founder of `orgId`; org must be cryptobrand (`officeCreatedFromCryptobrand === true`). |

---

## 1. Mint (or reuse) an investment invoice

### `POST /hifi/applications/:applicationId/invoice`

Called by the seller FE at the pay step. `:applicationId` accepts either
the hifi UUID `id` or the Mongo `_id`.

```json
// Request (both fields optional)
{
  "currency": "USDC"     // Override the normalized application.currency.
                         // Omit to use the application's own currency.
}
```

**Currency resolution** (via `normalizeHifiCurrency` in
`config/hifiInvoice.ts`) produces a tagged result:

| Application `currency` | Normalized | Channel |
|---|---|---|
| `"USD ($)"` / `"USD"` | `USD` | wallet |
| `"INR (₹)"` / `"INR"` | `INR` | wallet |
| `"ETH"` | `ETH` | wallet |
| `"BTC"` | `BTC` | wallet |
| `"USDC"` (any form) | `USDC` | **crypto** |
| `"USDT"` (any form) | `USDT` | **crypto** |
| anything else | `null` (400) | — |

For **crypto** currencies the route ALSO checks that at least one
matching `(chain, coin)` is configured in `SUPPORTED_CHAINS` with a
populated platform address (else 400 with the missing-env message).

**Amount resolution** (unchanged from previous version):
- `INR` → `application.payableInr` (whole rupees).
- Everything else → `application.walletCurrency + walletAmount` if
  present (recommended: seller pre-stamps at pay step), else falls back
  to `units × product.amountPerUnit`.

**Idempotency**: if the app is already `paymentStatus:"success"` with
an `invoiceId` in paymentPayload OR any draft/pending invoice already
exists for this application, the existing invoice is returned with
`reused: true`. Mint is idempotent.

```json
// 200 Response
{
  "success": true,
  "reused": false,
  "invoice": {
    "id": "6a8992b6…",
    "invoiceNumber": "INV-…",
    "status": "pending",
    "totalAmount": 50500000,                       // smallest-unit
    "itemCurrency": "INR",
    "paymentChannel": "wallet",                    // "wallet" | "crypto"
    "allowedWalletCurrencies": ["INR"],            // set only for wallet channel
    "redirectUrl": "/invoice/6a8992b6…",
    "application": {
      "id": "fda379d0-ca24-4f8a-9004-10398782b385",
      "productId": "prod-93650186",
      "units": 10,
      "payableInr": 505000,
      "currency": "USDC"                           // original application field
    }
  }
}
```

### `GET /hifi/applications/:applicationId/invoice`

Fetch the most-recent invoice for an application, if any. Same shape
as above. Returns `{ success: true, invoice: null }` when nothing has
been minted yet.

---

## 2. Pay the invoice — wallet path

Uses the existing `POST /api/invoices/:invoiceId/pay-with-wallet` route.
For invoices with `metadata.allowedWalletCurrencies` set (which every
wallet-channel HiFi invoice does), `currency` is REQUIRED in the body:

```json
{
  "walletType": "store",
  "orgId": "6a884a7a…",       // The hifi application's orgId
  "currency": "INR"            // Must be in allowedWalletCurrencies
}
```

- Debits `StoreWallet {userId, orgId, currency}` at parity — no USD
  conversion.
- Marks invoice paid; `invoice.paymentCurrency = <currency>`.
- Fulfillment (`services/hifiInvoiceFulfillment.ts`) runs.

**New**: the debit's `WalletTransaction.metadata` now carries a `kind`
field for hifi invoices — see §5 metadata reference.

**Error envelopes** (all `{ success: false, error: "…" }`):
| HTTP | When |
|---|---|
| 400 | invoice not draft/pending; missing `orgId` for store; missing `currency` on multi-currency invoice; currency not in `allowedWalletCurrencies`; insufficient balance |
| 403 | invoice belongs to another user |
| 404 | invoice not found |

Retrying a `pay-with-wallet` call on an already-paid invoice returns
400 `Invoice cannot be paid (current status: paid)` — safe as a
poll-and-give-up signal.

---

## 3. Pay the invoice — crypto path (USDC / USDT)

When the invoice's `paymentChannel === "crypto"`, the wallet chooser is
hidden (FE forces the crypto tab). Investor uses the existing crypto
pay flow:

1. `GET /api/invoices/crypto/chains` — returns the configured
   `(chain, coin)` list. USDC-Polygon is included when
   `PLATFORM_USDC_POLYGON_ADDRESS` is set; USDT variants (Tron,
   Polygon, BSC) when their respective platform addresses are set.
2. `POST /api/invoices/:id/select-payment-method` with
   `{ paymentMethodCategory: "crypto", paymentPlatform: "crypto_wallet", chain, coin }`.
3. Backend creates a `CryptoPaymentRequest` with a unique amount tail;
   returns the deposit address + exact amount + QR.
4. Investor sends the token on-chain. The in-house poller
   (`services/cryptoPaymentPoller.ts`) matches the incoming tx by
   exact atomic amount, flips the invoice to `paid`, and runs
   `fulfillInvoice("hifi_investment")` — same code path as the wallet
   channel.

Chain configuration lives in `config/cryptoWallets.ts` — currently:
- USDT-TRC20 (Tron)
- USDT-Polygon
- USDT-BEP20 (BSC)
- **USDC-Polygon** (new — bridged USDC.e by default)

USDC on other chains and additional stablecoins can be added by
appending a `SUPPORTED_CHAINS` entry + a corresponding platform-address
env var.

---

## 4. Fulfillment — what happens on payment

Handled by `services/hifiInvoiceFulfillment.ts`. Fires from
`fulfillInvoice`'s `case "hifi_investment"` regardless of payment
channel.

### 4a. Update the hifi_investment_application

```js
db.hifi_investment_applications.updateOne(
  { _id: <application._id> },
  { $set: {
      paymentStatus: "success",
      status: "completed",
      paidAt: <now>,
      paymentPayload: {
        method: "garage_wallet",           // "garage_crypto" for crypto channel
        walletCurrency: "INR",
        referenceId: "INV-…",
        invoiceId: "6a8992b6…",
        status: "success",
        paidAt: "<iso>"
      },
      updatedAt: <now>,
      "stepStatuses.<activeStepId>": "success",
      "stepPayloads.<activeStepId>":  <paymentPayload>
    }
  }
)
```

### 4b. Upsert `hifi_investment_subscriptions`

Idempotent on `applicationId`. Skipped if a subscription already
exists.

```js
{
  id: <uuid>,
  applicationId, productId, orgId, userId, units, payableInr, currency,
  paymentMethod: "garage_wallet" | "garage_crypto",
  paymentNetwork: "store_wallet_<currency>" |
                  "<chain>_<coin>",              // e.g. "polygon_USDC"
  status: "settled",
  txReference: <invoiceNumber> | <cryptoTxHash>,
  invoiceId, walletCurrency, walletAmount, paidAt, createdAt, updatedAt
}
```

### 4c. Escrow into the founder-org StoreWallet

Credits `StoreWallet {userId: <founder>, orgId, currency}` by the
principal. Wallet auto-created if missing. Written with `metadata.kind
= "hifi_investment_escrow_credit"`, `metadata.dedupeKey =
"hifi_investment_escrow_<applicationId>"`.

### 4d. Sockets

| Event | Room | Payload |
|---|---|---|
| `hifi:application:paid` | `org:<orgId>` | `{ applicationId, subscriptionId, productId, userId, units, currency, principal }` |
| `hifi:application:paid` | `user:<investorId>` | `{ applicationId, subscriptionId }` |

---

## 5. Buyer debit metadata

When `pay-with-wallet` runs against a `hifi_investment` invoice, the
buyer-side debit `WalletTransaction` now carries a `metadata.kind`
stamp (previously debits had no metadata at all, so filtering by
"HiFi payments" was impossible). For hifi invoices:

```json
{
  "kind": "hifi_investment_payment",
  "invoiceId": "6a8992b6…",
  "invoiceNumber": "INV-…",
  "hifiApplicationId": "fda379d0-…",
  "hifiProductId": "prod-93650186"
}
```

Non-hifi debits still carry no metadata (unchanged behavior for
whitelabel, office_plan, cryptosub, etc.).

---

## 6. Cryptobrand checkout status

### `GET /org/:orgId/cryptobrand-checkout`

Server-authoritative "does this cryptobrand org still owe Pro ($96) or
Cryptosub ($600) from its bootstrap?" Replaces session-storage tracking
so the seller FE's existing-org select flow + new-login-session flow
can gate correctly.

Returns pending invoices for JUST the missing pieces (reuses existing
draft/pending rows from the original `create-first-time` bootstrap;
never mints for already-paid sides).

- **Pro-paid** = the cryptobrand-bootstrap `office_plan` invoice for
  this org is `status = "paid"`. Orgs that got Pro via the standard
  Razorpay office checkout are out of scope for this endpoint.
- **Cryptosub-paid** = `hasActiveAddon(orgId, "cryptosub") === true`.

```json
// 200 Response
{
  "success": true,
  "cryptobrandCheckout": {
    "needsCheckout": true,
    "officePaid": false,
    "cryptosubPaid": true,
    "officeInvoice": {
      "id": "…",
      "number": "INV-…",
      "totalAmountUsdCents": 9600,
      "currency": "USD",
      "redirectUrl": "/invoice/…"
    },
    "cryptosubInvoice": null
  }
}
```

**Errors**: 400 (invalid orgId), 403 (not founder OR org not
cryptobrand), 404 (org not found).

Cost note: this route is NOT on the login/select-org hot path —
opt-in per call. Founder FE should call it on org-switch and on
`/checkout` mount.

---

## 7. Payout distribution — bulk

### `POST /hifi/payouts/distribute`

HiFi seller creates a `hifi_payout_runs` row when it's time to
distribute yields to investors, then calls this endpoint to actually
move money.

**Request:**
```json
{
  "payoutRunId": "PR-2026-001",
  "organizationId": "6a884a7a…",
  "productId": "prod-93650186",
  "currency": "INR",
  "lineItems": [
    { "userId": "buyer-user-id", "subscriptionId": "sub-uuid", "netAmount": 12500 }
  ]
}
```

Max 500 line items per call.

**Per line item** — one MongoDB transaction; a failure on one line
doesn't cascade:
- `dedupeKey = "hifi_payout_" + payoutRunId + "_" + userId` — one credit
  per (run, buyer).
- Layer-1: cheap `findOne` on the dedupeKey.
- Debits the founder's own `StoreWallet(orgId, currency)` — where
  `hifiInvoiceFulfillment.ts` deposits the escrow. If insufficient
  balance, that line surfaces `error: "Insufficient balance"`, other
  lines still process.
- Credits the buyer's `StoreWallet(orgId, currency)` (creates if
  missing).
- Layer-2 (race safety): E11000 on the partial-unique dedupeKey index
  → treated as success (idempotent).
- If the buyer credit fails after the founder debit succeeded, the
  debit is auto-reversed with `kind = "hifi_payout_debit_reversal"` so
  the founder's ledger doesn't leak.

**Response:**
```json
{
  "success": true,
  "results": [
    { "userId": "…", "subscriptionId": "…", "walletTransactionId": "…", "alreadyPaid": false },
    { "userId": "…", "subscriptionId": "…", "walletTransactionId": "…", "alreadyPaid": true },
    { "userId": "…", "subscriptionId": "…", "walletTransactionId": null,  "alreadyPaid": false, "error": "Insufficient balance" }
  ],
  "summary": {
    "attempted": 20,
    "paid": 17,
    "alreadyPaid": 2,
    "failed": 1,
    "totalPaidAmount": 210000,
    "currency": "INR"
  }
}
```

The HiFi backend can use each `walletTransactionId` as evidence to
mark its own `hifi_payout_runs.lineItems[].status` as `Paid`. This
endpoint does NOT touch `hifi_payout_runs`.

---

## 8. Org-scoped ledger

### `GET /hifi/organizations/:orgId/transactions`

Founder-scoped ledger of every hifi-related `WalletTransaction` for
the org. Combines buyer-debit + escrow-credit + payout-debit +
payout-credit + payout-reversal rows in one view.

**Query params:**
```
?page=1&limit=20&type=credit|debit|transfer&productId=…&from=YYYY-MM-DD&to=YYYY-MM-DD
```

Default `page=1, limit=20`. `limit` capped at 200.

**Filter kinds** (fixed on the server — this endpoint only returns
these):
- `hifi_investment_payment` — buyer debit at pay-with-wallet
- `hifi_investment_escrow_credit` — founder credit at fulfillment
- `hifi_payout_debit` — founder debit at payout
- `hifi_payout_credit` — buyer credit at payout
- `hifi_payout_debit_reversal` — auto-reversal when a payout credit failed

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [ /* WalletTransaction docs with populated relatedUserId */ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "pages": 3
    }
  }
}
```

---

## 9. Buyer's own wallet + transaction reads (unchanged, corrections)

**Corrections to earlier HiFi doc:**
- The wallet-transactions route is `GET /wallet/store/transactions`,
  NOT `GET /wallet/transactions`. Query: `?orgId=&limit=&offset=&type=`.
  Response: `{ success, transactions, total, limit, offset }`. Type
  filter: `credit | debit | transfer`.
- `GET /wallet/all` — unchanged, returns `{ success, storeWallets,
  affiliateWallet }`. For cryptobrand orgs it eager-provisions
  INR/ETH/BTC sibling wallets on read.

---

## 10. Complete `metadata.kind` reference

All `metadata.kind` strings that appear on `WalletTransaction` for the
HiFi flow:

| kind | Side | When |
|---|---|---|
| `hifi_investment_payment` | Buyer debit | pay-with-wallet on hifi_investment invoice (§5) |
| `hifi_investment_escrow_credit` | Founder credit | fulfillment (§4c) — dedupeKey `hifi_investment_escrow_<applicationId>` |
| `hifi_payout_debit` | Founder debit | payout distribute (§7) — dedupeKey `hifi_payout_<runId>_<userId>_debit` |
| `hifi_payout_credit` | Buyer credit | payout distribute (§7) — dedupeKey `hifi_payout_<runId>_<userId>` |
| `hifi_payout_debit_reversal` | Founder credit | auto-reversal when buyer credit failed (§7) |

---

## 11. Collections written

- **Read + updated**: `hifi_investment_applications` — set
  `paymentStatus`, `status`, `paidAt`, `paymentPayload`,
  `stepStatuses`, `stepPayloads`, `updatedAt`.
- **Read**: `hifi_products` — for name + `amountPerUnit` fallback.
- **Inserted**: `hifi_investment_subscriptions` — one settled row per
  paid application (idempotent).
- **Not touched**: `hifi_investment_kyc`, `hifi_payout_runs`,
  `hifi_activities` — all owned by the seller app.

---

## 12. Files (backend)

**Config / models:**
- `src/config/hifiInvoice.ts`
- `src/config/cryptoWallets.ts` — USDC-Polygon reactivated

**Services:**
- `src/services/hifiInvoiceFulfillment.ts`
- `src/services/cryptobrandCheckoutStatus.ts`
- `src/services/cryptobrandOfficeBootstrap.ts` — exports
  `mintProOfficeInvoice`, `mintCryptosubInvoice` helpers

**Routes:**
- `src/routes/hifiInvoice.ts` — invoice mint/fetch + payouts + org
  transactions
- `src/routes/cryptobrandCheckout.ts` — checkout status

**Wallet primitives:**
- `src/services/wallet.ts::debitStoreWallet` — accepts optional
  `currency` + `metadata`
- `src/routes/invoice.ts` — pay-with-wallet accepts `currency`; stamps
  `hifi_investment_payment` on the debit for hifi invoices

---

## 13. Not yet implemented (intentionally deferred)

- **BTC / ETH native crypto payments** on invoices. Needs live
  CoinGecko pricing + quote-expiry + amount-tail redesign (the current
  scheme assumes stablecoin 1:1 with USD).
- **Payout confirmation cron** — the payout endpoint moves money on
  demand; there's no scheduled cron that walks `hifi_payout_runs`.
  HiFi seller owns the scheduling.
