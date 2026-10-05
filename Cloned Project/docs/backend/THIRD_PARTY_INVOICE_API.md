# Third-Party Invoice API

A REST API for third-party applications to issue invoices, collect recurring subscription payments, and receive payment notifications through the Garage Universe billing system.

- **Base URL:** `{API_BASE_URL}/api/v1/third-party`
- **Auth:** API key per client, sent as `x-api-key` header.
- **Content-Type:** `application/json`

---

## 1. Overview

The third-party app sells its own product (e.g. the **$36/month GU_SUB_36 subscription**). Each paid invoice produces a server-side distribution:

| Portion | Amount (for $36 product) | Destination |
|---|---|---|
| Unilevel Plus distribution | **$12.00** | Runs through the UP commission tree (company 4%, direct 36%, level 43.2%, infinity tiers, manager bonus) — scaled linearly from the UP $25 default. |
| Platform share | **$24.00** | Credited directly to Shorupan's store wallet (`shorupan@gmail.com` in The Network Economy org). |
| **Total** | **$36.00** | |

Break-down of the $12 UP portion: company $0.48, direct $4.32, level pool $5.184, infinity T1 $0.864, infinity T2 $0.864, manager $0.288 — sum $12.00.

The split amounts and product code are stored on the `ThirdPartyClient` record created for each third-party app, so future integrations can define their own $ / split.

**Third-party users must already exist in the Garage Universe database.** Invoice creation for an unknown email returns `404 CUSTOMER_NOT_FOUND`. Invite flow or manual provisioning must run first.

---

## 2. Authentication

Each third-party integration is represented by a `ThirdPartyClient` record with:

- `apiKey` — format `gu_tp_<prefix>_<64-hex-chars>`. Returned **once** at create/rotate. Bcrypt-hashed at rest.
- `webhookSecret` — 32-byte hex, used to sign outgoing webhooks.
- `productConfig` — fixed pricing and split for this client.
- `scopes` — `invoices:read`, `invoices:write`.

All calls to `/api/v1/third-party/*` must send:
```
x-api-key: gu_tp_<prefix>_<secret>
```

Errors:
- `401 MISSING_API_KEY` — header missing
- `401 INVALID_API_KEY` — bad or revoked key
- `403 MISSING_SCOPE` — key lacks required scope

---

## 3. Admin: managing third-party clients

These endpoints live under `/garage-admin/third-party-clients` and require founder JWT (`Authorization: Bearer <token>`).

### Create a client
```bash
curl -X POST $API/garage-admin/third-party-clients/clients \
  -H "Authorization: Bearer $FOUNDER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Integrations",
    "webhookUrl": "https://acme.example.com/hooks/gu",
    "productConfig": {
      "productCode": "GU_SUB_36",
      "totalAmount": 36,
      "upPortion": 12,
      "platformPortion": 24,
      "platformUserEmail": "shorupan@gmail.com",
      "platformOrgId": "68f1fe05876fcc5fadb61951",
      "recurringPeriod": "monthly"
    }
  }'
```

Response contains the raw `apiKey` and `webhookSecret`. **Save them — they are never returned again.**

Other admin endpoints:
- `GET /clients` — list all
- `GET /clients/:id` — fetch one
- `POST /clients/:id/rotate-key` — invalidate old key, return new one
- `PATCH /clients/:id` — update `webhookUrl`, `isActive`, `productConfig`, `scopes`, `rateLimits`
- `DELETE /clients/:id` — soft-delete (sets `isActive=false`)

---

## 4. Invoice endpoints

All paths below are relative to `/api/v1/third-party`.

### 4.1 Create invoice — `POST /invoices`

Issues a draft recurring invoice for a customer.

**Body:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `customerEmail` | string | yes | Must match an existing user. |
| `productCode` | string | no | If sent, must match `client.productConfig.productCode`. |
| `externalId` | string | no | Your own idempotency key. Re-sending returns the original invoice. |
| `metadata` | object | no | Arbitrary JSON stored on the invoice. |

```bash
curl -X POST $API/api/v1/third-party/invoices \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "jane@example.com",
    "externalId": "acme-sub-2026-01-jane",
    "metadata": { "planId": "pro-monthly", "campaign": "launch" }
  }'
```

**201 response:**
```json
{
  "invoice": {
    "id": "66f0...",
    "invoiceNumber": "INV-L1A2B3-X9YZ",
    "status": "draft",
    "customerEmail": "jane@example.com",
    "amount": 3600,
    "currency": "USD",
    "isRecurring": true,
    "recurringPeriod": "monthly",
    "thirdPartyExternalId": "acme-sub-2026-01-jane",
    "expiresAt": "2026-04-16T12:00:00.000Z",
    "lineItems": [ ... ]
  },
  "paymentUrl": "https://app.example.com/invoice/66f0..."
}
```

**Errors:**
- `404 CUSTOMER_NOT_FOUND` — email not in our DB
- `400 PRODUCT_MISMATCH` — `productCode` doesn't match the client config
- `400 INVALID_INPUT` — Zod validation failed

### 4.2 List invoices — `GET /invoices`

Query params: `status`, `customerEmail`, `from`, `to` (ISO 8601), `limit` (1-100, default 20), `offset` (default 0).

```bash
curl -H "x-api-key: $API_KEY" \
  "$API/api/v1/third-party/invoices?status=paid&limit=50"
```

Response:
```json
{
  "total": 120,
  "invoices": [ { "id": "...", "status": "paid", ... } ]
}
```

### 4.3 Get invoice — `GET /invoices/:id`

`:id` can be the invoice ObjectId or the human `invoiceNumber`.

```bash
curl -H "x-api-key: $API_KEY" $API/api/v1/third-party/invoices/66f0...
```

### 4.4 Status (lightweight) — `GET /invoices/:id/status`

Returns minimal fields — use this for polling.

```json
{
  "invoiceId": "66f0...",
  "invoiceNumber": "INV-L1A2B3-X9YZ",
  "status": "paid",
  "paidAt": "2026-04-15T10:44:23.000Z",
  "amount": 3600,
  "currency": "USD"
}
```

### 4.5 Payment link — `GET /invoices/:id/payment-link`

Returns the hosted payment URL the customer should open to complete payment (OTP-gated by the customer's email).

```json
{
  "paymentUrl": "https://app.example.com/invoice/66f0...",
  "expiresAt": "2026-04-16T12:00:00.000Z"
}
```

### 4.6 Cancel — `POST /invoices/:id/cancel`

Only valid when `status` is `draft` or `pending`. Returns `409 INVOICE_NOT_CANCELLABLE` otherwise.

### 4.7 Receipt — `GET /invoices/:id/receipt`

Returns a structured receipt. Only available when `status == "paid"`, otherwise `409 RECEIPT_UNAVAILABLE`.

```json
{
  "invoice": { ... },
  "receipt": {
    "invoiceNumber": "INV-L1A2B3-X9YZ",
    "status": "paid",
    "paidAt": "2026-04-15T10:44:23.000Z",
    "amount": 3600,
    "currency": "USD",
    "paymentMethod": "card",
    "paymentPlatform": "razorpay",
    "razorpayPaymentId": "pay_Nx...",
    "customerEmail": "jane@example.com",
    "customerName": "Jane Doe",
    "lineItems": [
      { "itemName": "Acme Integrations subscription", "quantity": 1, "unitPrice": 3600, "totalPrice": 3600 }
    ]
  }
}
```

### 4.8 Resend webhook — `POST /invoices/:id/resend-webhook`

Re-dispatches the webhook for a paid/cancelled/failed invoice. Useful when our in-process retries exhausted or your endpoint was down.

- `400 NO_WEBHOOK_URL` if the client has no `webhookUrl`.
- `409 NO_WEBHOOK_EVENT` for statuses that don't correspond to a webhook (`draft`, `pending`, `expired`, `refunded`).

```json
{ "dispatched": true, "invoice": { ... } }
```

### 4.9 Per-customer invoice list — `GET /customers/:email/invoices`

Shortcut for listing all invoices this client has created for one customer.

Query params: `status`, `limit` (1-100, default 20), `offset` (default 0).

```bash
curl -H "x-api-key: $API_KEY" \
  "$API/api/v1/third-party/customers/jane@example.com/invoices?status=paid"
```

```json
{
  "total": 4,
  "customerEmail": "jane@example.com",
  "invoices": [ ... ]
}
```

### 4.10 Self-introspection — `GET /clients/me`

Lets the third-party app fetch its own config without admin JWT. Returns the same shape as the admin `GET /clients/:id` (minus `apiKeyHash` — key material is never exposed).

```json
{
  "id": "66f...",
  "name": "Acme Integrations",
  "apiKeyPrefix": "ab12cd34",
  "scopes": ["invoices:read","invoices:write"],
  "isActive": true,
  "webhookUrl": "https://acme.example.com/hooks/gu",
  "productConfig": {
    "productCode": "GU_SUB_36",
    "totalAmount": 36,
    "upPortion": 12,
    "platformPortion": 24,
    "recurringPeriod": "monthly",
    ...
  },
  "lastUsedAt": "2026-04-15T10:44:23.000Z",
  "createdAt": "..."
}
```

---

## 5. Webhook events

Set `webhookUrl` on your client record to receive notifications. We `POST` JSON to that URL on:
- `invoice.paid`
- `invoice.cancelled`
- `invoice.failed`

**Headers:**
- `x-gu-event` — event name
- `x-gu-timestamp` — unix seconds
- `x-gu-signature` — `HMAC_SHA256(webhookSecret, `${timestamp}.${rawBody}`)` as hex

**Body:**
```json
{
  "event": "invoice.paid",
  "invoiceId": "66f0...",
  "invoiceNumber": "INV-L1A2B3-X9YZ",
  "status": "paid",
  "amount": 3600,
  "currency": "USD",
  "customerEmail": "jane@example.com",
  "paidAt": "2026-04-15T10:44:23.000Z",
  "thirdPartyExternalId": "acme-sub-2026-01-jane",
  "metadata": { ... }
}
```

**Verification (Node.js):**
```js
const crypto = require("crypto");

function verify(req, secret) {
  const ts = req.headers["x-gu-timestamp"];
  const sig = req.headers["x-gu-signature"];
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${req.rawBody}`)
    .digest("hex");
  // Recommended: reject if Math.abs(Date.now()/1000 - Number(ts)) > 300
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
```

**Retry policy:** in-process retries at 5s, 30s, 120s (4 total attempts). Retries are lost if the backend restarts — this is a known limitation; for durable delivery, we will migrate to a queue in a follow-up. Use the `GET /invoices/:id/status` endpoint for reconciliation.

---

## 6. Recurring subscriptions

Invoices created via this API are always `isRecurring: true`. On a successful payment the server schedules the next due date and a cron job generates the next draft invoice 5 days before it's due. You will receive an `invoice.paid` webhook on each renewal — the recurring cycle is identified by `recurringPaymentNumber`.

### 6.1 Multi-month terms

A subscription can be billed 1, 3, 6, or 12 months at a time. `GET /terms` lists what this product offers:

```http
GET /api/v1/third-party/terms
```
```json
{
  "productCode": "nc_sub",
  "currency": "USD",
  "defaultTermMonths": 1,
  "terms": [
    { "termMonths": 1,  "label": "Monthly",   "totalAmount": 36,  "totalAmountCents": 3600,  "monthlyEquivalent": 36.00, "savingsPercent": 0,   "isActive": true },
    { "termMonths": 3,  "label": "3 months",  "totalAmount": 100, "totalAmountCents": 10000, "monthlyEquivalent": 33.33, "savingsPercent": 7.4, "isActive": true },
    { "termMonths": 6,  "label": "6 months",  "totalAmount": 200, "totalAmountCents": 20000, "monthlyEquivalent": 33.33, "savingsPercent": 7.4, "isActive": true },
    { "termMonths": 12, "label": "12 months", "totalAmount": 396, "totalAmountCents": 39600, "monthlyEquivalent": 33.00, "savingsPercent": 8.3, "isActive": true }
  ]
}
```

These are the **standalone** prices — what this API always charges. (Garage's own checkout offers a cheaper bundled rate when a term is bought together with a `$25` Unilevel Plus licence; that is not reachable through the partner API.)

`defaultTermMonths` is always `1`. Omitting `termMonths` bills one month — a multi-month term is never inferred, and there is no configuration that can change the default.

```json
POST /api/v1/third-party/invoices
{ "customerEmail": "a@b.com", "termMonths": 6 }
```

Renewals auto-renew on the **same** term. To change the term of a live subscription:

```json
PATCH /api/v1/third-party/subscriptions/:parentInvoiceId/term
{ "termMonths": 12 }
```

The response's `status` says what happened: `applied` (the next unpaid invoice was repriced), `queued` (it takes effect the cycle after — e.g. the next invoice is already being paid), or `noop`. `effectiveFrom` is always the date the new term starts billing.

`GET /customers/:email/subscriptions` returns the current term, any queued change, and the pending invoice.

**Error codes:** an unknown or disabled term returns `INVALID_TERM`. Reposting an `externalId` that already exists with a *different* `termMonths` returns `409 IDEMPOTENCY_CONFLICT` rather than silently returning the old price.

> **Coupons are supported on the monthly plan only.** Coupon redemptions are counted in *cycles*, so a 3-cycle discount on a 6-month term would run for 18 months against a 6× larger base. Creating a multi-month invoice with a coupon returns `COUPON_NOT_ALLOWED_FOR_TERM`.

> **Affiliate commission is list-based on multi-month terms.** Regardless of the discount, the comp tree is paid the full list rate for every month covered — a 12-month invoice pays 12 separate distributions, so prepaying never reduces what the upline earns. The discount is absorbed entirely on our side. Nothing about this is visible in the API; it's noted so the amounts in your reporting reconcile.

### 6.2 ⚠️ Required integration change

The `invoice.paid` payload now carries the service period:

```json
{
  "event": "invoice.paid",
  "amount": 21600,
  "termMonths": 6,
  "recurringIntervalMonths": 6,
  "periodStart": "2026-08-07T00:00:00.000Z",
  "periodEnd":   "2027-02-07T00:00:00.000Z",
  "recurringPaymentNumber": 2
}
```

**You must extend the customer's access by `termMonths`, not by one month.** Recommended:

```js
const periodEnd = payload.periodEnd
  ? new Date(payload.periodEnd)
  : addMonths(max(now, sub.currentPeriodEnd), payload.termMonths ?? 1);
```

Extending from `max(now, currentPeriodEnd)` rather than `now` means an early renewal doesn't lose the customer time.

Multi-month terms stay disabled (`isActive: false`) until you confirm this is live — a 12-month payment against a handler that adds one month would lock the customer out after 30 days. `termMonths` is always present and is `1` for existing monthly subscriptions, so shipping this ahead of the switch is safe.

---

## 7. Error codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `INVALID_INPUT` | Zod validation failed on body or query. |
| 400 | `PRODUCT_MISMATCH` | `productCode` doesn't match client config. |
| 401 | `MISSING_API_KEY` | No `x-api-key` header. |
| 401 | `INVALID_API_KEY` | Key not recognized or revoked. |
| 403 | `MISSING_SCOPE` | API key lacks `invoices:read` / `invoices:write`. |
| 404 | `CUSTOMER_NOT_FOUND` | Email is not registered in Garage Universe. |
| 404 | `INVOICE_NOT_FOUND` | Invoice does not belong to this client or does not exist. |
| 404 | `CLIENT_NOT_FOUND` | Client record missing (only surfaces during webhook retry). |
| 409 | `INVOICE_NOT_CANCELLABLE` | Invoice already paid / expired / cancelled. |
| 409 | `RECEIPT_UNAVAILABLE` | Receipt requested for a non-paid invoice. |
| 409 | `NO_WEBHOOK_EVENT` | Invoice status has no corresponding webhook event. |
| 400 | `NO_WEBHOOK_URL` | Resend requested but client has no `webhookUrl` set. |
| 500 | `PLATFORM_USER_NOT_FOUND` | Misconfiguration — platform user missing. |
| 500 | `INTERNAL_ERROR` | Unexpected failure. |

---

## 8. Testing the pricing math

After a paid $36 invoice, verify:

1. Mongo: `db.unilevelplusdistributions.findOne({ paymentId: /^tp_<invoiceId>_/ })` — should show the scaled-to-$12 breakdown.
2. Mongo: Shorupan's `StoreWallet` in org `68f1fe05876fcc5fadb61951` balance increased by exactly `$24.00`.
3. Mongo: `WalletTransaction` with `description: "Third-party subscription platform share: <clientName>"` and amount 24.
4. Webhook delivered to `webhookUrl` with valid signature.

A quick sandbox loop:
```bash
# 1. Create invoice
curl -X POST $API/api/v1/third-party/invoices -H "x-api-key: $KEY" \
  -d '{"customerEmail":"test@garageuniversity.app"}'

# 2. Open paymentUrl in browser, complete OTP + payment

# 3. Poll for status
curl -H "x-api-key: $KEY" $API/api/v1/third-party/invoices/$ID/status
```

---

## 9. Known limitations

- **Webhook durability:** retries are in-process only (`setTimeout`) and lost on restart. Reconcile via polling `/invoices/:id/status` for critical events.
- **Rate limiting:** `rateLimits.perMinute` / `perDay` are stored but not enforced yet. Planned follow-up.
- **Currency:** only USD at this time. The pricing split is defined in USD.
- **Quantity:** invoices are created with `quantity: 1`. Multi-seat is not supported.
