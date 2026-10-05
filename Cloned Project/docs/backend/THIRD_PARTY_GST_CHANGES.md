# Third-Party Subscription API — 18% GST Rollout

> **Audience**: NetworkChain (and any other third-party partner integrating
> with `/thirdPartyInvoice/*`). Read this before your next production
> deploy against our API.

## TL;DR

Starting on the deploy date, every **subscription invoice** we create for
your partner account carries **18% GST added on top** of your configured
`productConfig.totalAmount`. A $36/mo product becomes a **$42.48** monthly
invoice. Nothing about endpoints, auth, or webhook signing changes — only
the numeric `amount` field on responses and webhooks shifts up, plus a new
`metadata.gst` block appears.

**Two paths are exempt** and behave exactly as before:

- `mode: "topup"` invoices (buyer-facing exact amount preserved).
- Combo `freeFirstCycle` parent invoices (buyer still pays $0 for the
  first cycle; GST kicks in from cycle 2 onward).

## What actually changed in the response

### `POST /thirdPartyInvoice/invoices` (and every other endpoint returning an invoice)

| Field | Before | After |
|---|---|---|
| `amount` (top-level, from `invoice.totalAmount`, in cents) | `3600` | **`4248`** |
| `metadata.gst` | — (absent) | **`{ rate: 18, amount: 648, inclusive: false, sacCode: "998314" }`** |
| `lineItems[0].unitPrice` (cents) | `3600` | `3600` (unchanged — line item is still the pre-tax base) |
| `lineItems[0].totalPrice` (cents) | `3600` | `3600` (unchanged) |
| `currency` | `"USD"` | `"USD"` |
| `isRecurring`, `recurringPeriod`, `parentInvoiceId`, `nextDueDate`, `thirdPartyExternalId`, all other fields | — | Unchanged |

The identity is: `amount === lineItems[0].totalPrice + metadata.gst.amount`
(when GST is present; formerly `amount === lineItems[0].totalPrice`).

### Webhook `invoice.paid`

Delivered to your `webhookUrl` with the same signing headers
(`x-gu-signature`, `x-gu-timestamp`, `x-gu-event`). Body:

```json
{
  "event": "invoice.paid",
  "invoiceId": "...",
  "invoiceNumber": "INV-...",
  "status": "paid",
  "amount": 4248,
  "currency": "USD",
  "customerEmail": "buyer@example.com",
  "paidAt": "2026-07-03T10:12:00.000Z",
  "thirdPartyExternalId": "your-external-id-here",
  "metadata": {
    "thirdPartyClientName": "NetworkChain",
    "productCode": "networkchain-monthly",
    "source": "third_party_api",
    "gst": {
      "rate": 18,
      "amount": 648,
      "inclusive": false,
      "sacCode": "998314"
    }
  }
}
```

The `amount` field is now GST-inclusive. Update any reconciliation that
compared it to your `productConfig.totalAmount * 100`.

### Recurring child invoices

Cycle 2, 3, 4, … of every **new** subscription created after this deploy
automatically inherits the GST amount. You'll see subsequent monthly
`invoice.paid` webhooks at `amount: 4248` without any action from your
side.

**Subscriptions that were already recurring before this deploy** keep
spawning `amount: 3600` children until they're cancelled. We are not
retroactively migrating in-flight subscriptions.

## What is unchanged

- All endpoint paths (`/thirdPartyInvoice/invoices`, `/invoices/:id`,
  `/invoices/customers/:email`, etc.)
- Auth headers (`Authorization: Bearer <api key>`)
- Request bodies / required fields on any endpoint
- HMAC signing algorithm and header names
- Webhook retry policy (exponential backoff, same attempt cap)
- Rate limits
- Your `productConfig.totalAmount` on your `ThirdPartyClient` record
  (still $36 — GST is applied on top at invoice-creation time; there is
  **no need to change your config**)
- `mode: "topup"` invoices — no GST, `amount` equals the `amountCents`
  you sent, exactly like before
- `freeFirstCycle` combo parent invoices — `amount` is still `0`, so
  your first-month-free promise is preserved
- Line item `unitPrice` and `totalPrice` — these remain the pre-tax base

## What you likely need to update on your side

1. **Any hard-coded expectation that `amount === 3600`.** Read the value
   from the response/webhook instead of assuming your configured price.
   If you need the base separately, use `lineItems[0].totalPrice` (still
   `3600`) or `amount - metadata.gst.amount`.
2. **Reconciliation logic** that matches your accounting records to our
   invoices. The number you'll see settle in Razorpay/Stripe is now the
   GST-inclusive total; keep the `productCode` / `thirdPartyExternalId`
   as the join key, not `amount`.
3. **User-facing price displays.** If your app shows the monthly cost
   anywhere, it should now read $42.48 (or show the breakdown from
   `metadata.gst`).
4. **Fulfillment gating.** If you check "did the buyer pay for the
   correct tier?" — gate on `metadata.productCode` (or
   `lineItems[0].unitPrice`), not on `amount`. This is future-proof for
   any future tax rate change.
5. **Optional — tax-invoice display.** If you produce your own
   customer-facing receipts, the metadata gives you everything you need:
   - `gst.rate` — the percentage (currently 18)
   - `gst.amount` — the tax paid, in cents
   - `gst.sacCode` — SAC code `998314` (IT/SaaS services), suitable for
     Indian tax-invoice line items

## Nothing you need to update

- Webhook signature verification — same algorithm, same secret
- API key rotation policy
- Idempotency behavior
- Error response shapes
- Cancellation flow (`DELETE /invoices/:id`)

## Quick verification snippet

Once we deploy, you can validate the new behavior against your existing
staging setup with:

```bash
# Create an invoice
curl -X POST https://<api-host>/thirdPartyInvoice/invoices \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"customerEmail":"test+gst@yourdomain.com"}'

# Expected in response:
#   amount               = <productConfig.totalAmount * 100> + <18% of same>
#   metadata.gst.amount  = 18% of (productConfig.totalAmount * 100)
#   lineItems[0].unitPrice = productConfig.totalAmount * 100  (unchanged)
```

For a $36 product: `amount: 4248`, `metadata.gst.amount: 648`,
`lineItems[0].unitPrice: 3600`.

## Questions

Reach out through the same channel you use for API-integration issues.
Include the `invoiceId` or `invoiceNumber` from any invoice you're
inspecting so we can look it up quickly.
