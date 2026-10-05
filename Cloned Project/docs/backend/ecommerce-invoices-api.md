# Ecommerce Invoices API

Internal API for the multi-product / multi-HQ checkout flow.

The cart lives entirely on the frontend (no `Cart` model in this backend).
The backend's job begins at "preview totals" and "create invoice". Once an
invoice is created, payment is handled by the existing public invoice routes
documented under `/api/invoices/:invoiceId/...`.

All endpoints below require a logged-in user via the standard
`Authorization: Bearer <jwt>` header.

---

## Models referenced

| Collection | Owner | What we use it for |
|---|---|---|
| `storeproducts` | Storefront backend (read-only here) | Source of truth for product catalog, price, inventory. |
| `stores` | Storefront backend (read-only here) | Per-store currency + branding metadata. |
| `invoices` | This backend | The invoice we create at checkout. |
| `productorders` | This backend | One per orgId at fulfillment time, holds the line items the store needs to fulfill. |
| `combplans` | This backend | Looked up at fulfillment for commission distribution. |
| `platformcoupons` | This backend | New `productType: "ecommerce"` for coupons that apply to this flow. |

---

## POST /api/ecommerce/cart/preview

Preview totals for a cart in the user's chosen display currency. Pure read —
does not create an invoice or reserve inventory. Always run this immediately
before showing a subtotal to the user.

### Request

```json
{
  "items": [
    { "productId": "69ef66be81a847f270fc48af", "quantity": 2 },
    { "productId": "69ef66be81a847f270fc48b9", "quantity": 1 }
  ],
  "displayCurrency": "USD",
  "couponCode": "SUMMER10"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `items` | array | yes | 1–50 items. Duplicates merged by quantity. |
| `items[].productId` | string | yes | ObjectId of a `storeproducts` doc. Product must be `status: "active"`. |
| `items[].quantity` | number | yes | Integer ≥ 1. |
| `items[].variantId` | string | no | Reserved for v2 (variants not in v1). |
| `displayCurrency` | string | yes | `"USD"` or `"INR"`. |
| `couponCode` | string | no | Platform coupon. Must be of `productType: "ecommerce"`. |

### Response 200

```json
{
  "success": true,
  "displayCurrency": "USD",
  "exchangeRate": 84.21,
  "lineItems": [
    {
      "productId": "69ef66be81a847f270fc48af",
      "title": "Hydrating Face Cream",
      "image": "https://...",
      "vendor": "Garage Beauty",
      "storeId": "69ecbb0aa3a12f4dd3d16931",
      "storeName": "Garage App",
      "organizationId": "68f1fe05876fcc5fadb61951",
      "quantity": 2,
      "nativeCurrency": "USD",
      "nativeUnitPrice": 2999,
      "convertedUnitPrice": 2999,
      "convertedTotalPrice": 5998
    }
  ],
  "subtotal": 5998,
  "discount": 599,
  "discountReason": "Coupon SUMMER10 (10% off)",
  "total": 5399,
  "currency": "USD",
  "inventoryIssues": []
}
```

All money fields are in the **smallest unit of `displayCurrency`** (cents for
USD, paise for INR). `exchangeRate` is `null` when no conversion was needed
(every product was already priced in `displayCurrency`).

`inventoryIssues` is always returned as an array. If non-empty, the UI should
warn the user — but the preview itself still succeeds with a 200 so the cart
page can render the issue inline. Hard 409 only happens at the create-invoice
step.

### Errors

| Status | Code | Meaning |
|---|---|---|
| 400 | `INVALID_INPUT` | Bad payload, missing fields, quantity < 1, > 50 items. |
| 400 | `PRODUCT_NOT_FOUND` | A productId wasn't found or is archived. Body includes `missingProductIds: string[]`. |
| 400 | `INVALID_COUPON` | Coupon doesn't exist, expired, or wrong product type. |

---

## POST /api/ecommerce/invoices

Create a new ecommerce invoice. Inventory is **strictly checked here** — the
endpoint returns `409 OUT_OF_STOCK` if any item is short, and **no invoice is
created**.

### Request

```json
{
  "items": [
    { "productId": "69ef66be81a847f270fc48af", "quantity": 2 }
  ],
  "displayCurrency": "USD",
  "couponCode": "SUMMER10",
  "customerEmail": "buyer@example.com",
  "customerName": "Jane Doe"
}
```

`customerEmail` defaults to the logged-in user's email; `customerName`
defaults to their stored name. Override only if the buyer wants a different
billing email (e.g. company invoicing).

### Response 200

```json
{
  "success": true,
  "invoice": {
    "_id": "69fa1234567890abcdef1234",
    "invoiceNumber": "INV-MNZ4U2KX-3JA9",
    "status": "draft",
    "totalAmount": 5399,
    "itemCurrency": "USD",
    "expiresAt": "2026-05-09T18:30:00.000Z"
  },
  "payUrl": "/invoice/69fa1234567890abcdef1234"
}
```

Frontend redirects the user to `payUrl`. From there `CheckoutPaymentStep`
handles payment method selection, currency conversion at pay time,
Razorpay/Stripe/NowPayments/wallet, and webhook reconciliation — all
existing code paths.

### Errors

| Status | Code | Meaning |
|---|---|---|
| 400 | `INVALID_INPUT` | Bad payload. |
| 400 | `PRODUCT_NOT_FOUND` | A productId wasn't found. |
| 400 | `INVALID_COUPON` | Coupon invalid for this cart. |
| 409 | `OUT_OF_STOCK` | Inventory short for one or more items. Body includes `inventoryIssues: [{ productId, requested, available }]`. Invoice is **not** created. |

---

## What stays the same

These existing endpoints handle the rest of the flow. **No changes** for
ecommerce invoices — the existing public-pay page (`/invoice/[invoiceId]`)
just works.

| Endpoint | Notes |
|---|---|
| `GET /api/invoices/:invoiceId` | Public read. Returns the ecommerce invoice including per-line `storeId`, `vendor`, `organizationId`. |
| `POST /api/invoices/:invoiceId/select-payment` | Public. Records `paymentCurrency` + method + platform, creates Razorpay/Stripe/NP order. |
| `POST /api/invoices/:invoiceId/verify-payment` | Public. Razorpay verification path. |
| `POST /api/invoices/:invoiceId/confirm-stripe-payment` | Public. Stripe synchronous confirmation. |
| `POST /api/invoices/:invoiceId/cancel` | Public, with `?force=true` for crypto-in-flight (see crypto-payment safety doc). |
| `POST /api/invoices/:invoiceId/pay-with-wallet` | Authenticated. Affiliate or store wallet. |
| `POST /api/invoices/:invoiceId/apply-platform-coupon` | Authenticated. Apply or replace coupon after invoice creation. |
| `/webhooks/stripe`, `/webhooks/nowpayments`, `/webhooks/razorpay` | Existing webhooks. `fulfillInvoice` will dispatch the new `ecommerce_item` branch. |

---

## Fulfillment (server-internal)

Triggered automatically when an invoice flips to `paid` (via webhook or the
synchronous Stripe-confirm endpoint). For each line item with
`itemType === "ecommerce_item"`:

1. **Inventory decrement** — atomic `findOneAndUpdate({ _id, quantity: { $gte: lineQty } }, { $inc: { quantity: -lineQty } })` on `storeproducts` (only when `trackInventory: true`). If the conditional update returns null (item went out of stock between create and fulfillment), log it and continue — the invoice is already paid, refusing fulfillment would mean we owe the customer money for nothing.
2. **Order record** — group line items by `organizationId`, create one `productorders` doc per group. Each store sees its own order with its own line items.
3. **Commission distribution** — call `distributeCommissions({ itemType: "product", itemId, orgId, sellerId, saleAmount, currency, paymentId })` per line item. Looks up `combplans` by `(itemType, itemId, orgId)`; missing plan = no distribution (graceful no-op).

Idempotency: replaying a fulfillment (e.g. via the manual reconciliation
script) won't double-decrement inventory or double-distribute commissions.
The dedup keys are `paymentId` (combined with the invoice's `paid` status
guard) and the conditional inventory decrement.

---

## Currency conversion

The cart preview converts every line item's price from its **store's native
currency** to the customer's **chosen display currency**.

- `nativeCurrency` is read from `stores.currency` for the store that owns the product.
- `displayCurrency` is whatever the user picked.
- If they match, `convertedUnitPrice == nativeUnitPrice` and `exchangeRate: null`.
- If they differ, we use the existing `convertToUsd` / `convertUsdToInr` /
  `convertInrToUsd` utilities — same code that powers payment-time conversion
  for the existing single-product invoices.

The exchange rate at preview time is the same rate stored on the invoice when
it's created (we record it in `invoice.currencyConversion` so receipts show
the rate applied).

---

## Out of scope for v1

- **Variants** (`hasVariants: true`) — schema-aware but defer pricing & inventory dispatch to v2.
- **Server-persisted Cart** — cart stays client-only.
- **Partial fulfillment** — we reject the whole invoice on stock shortage.
- **Per-HQ shipping rules** — `shippingOverride` on storeproducts ignored for v1.
- **Refunds / order edits** post-payment — handled out-of-band.
- **Tax computation** — `taxable` / `taxCode` ignored.
- **Cart abandonment emails** — no Cart model means no abandonment to track.
