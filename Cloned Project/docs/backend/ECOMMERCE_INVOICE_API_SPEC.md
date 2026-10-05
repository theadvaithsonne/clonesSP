# Ecommerce Invoice API — Required Changes

Spec for the `garagenew-backend` developer who owns `POST /api/ecommerce/invoices` (the endpoint at `my.garage.app` / `test.garage.app`).

## Why this matters

The storefront (`garage-store`) collects a full shipping address at checkout, but the current invoice API drops it before persistence. Without that data:

- Seller dashboard can't ship orders (no recipient address).
- Shiprocket integration rejects every order with `Order is missing shipping address fields: line1, city, zip, phone`.
- Packing slips, delivery emails, and tracking pages are incomplete.
- `productorders.requiresShipping` is being written as `false` even for physical products, so the storefront stops asking for an address — a related bug to fix in the same change.

## 1. `POST /api/ecommerce/invoices` — Request body

Add `shippingAddress`, `billingAddress` (optional), and `paymentMode`. Optional B2B fields: `gstin`, `companyName`.

```json
{
  "items": [{ "productId": "...", "quantity": 1 }],
  "displayCurrency": "INR",
  "customerEmail": "buyer@example.com",
  "customerName": "Jane Doe",

  "shippingAddress": {
    "fullName": "Jane Doe",
    "addressLine1": "123 MG Road",
    "addressLine2": "",
    "city": "Bangalore",
    "state": "Karnataka",
    "postalCode": "560001",
    "country": "India",
    "phone": "+919876543210"
  },
  "billingAddress": {
    "fullName": "Jane Doe",
    "addressLine1": "...",
    "addressLine2": "",
    "city": "...",
    "state": "...",
    "postalCode": "...",
    "country": "...",
    "phone": "..."
  },
  "paymentMode": "Prepaid",
  "gstin": "29ABCDE1234F1Z5",
  "companyName": "Acme Pvt Ltd",
  "customerNote": "Leave at security"
}
```

### Validation rules

| Field | Rule |
|---|---|
| `shippingAddress.addressLine1` | Required, 3–250 chars |
| `shippingAddress.city` | Required, 1–80 chars |
| `shippingAddress.state` | Required, 1–80 chars |
| `shippingAddress.postalCode` | Required; for `country=India` must match `^\d{6}$` |
| `shippingAddress.country` | Required |
| `shippingAddress.phone` | Required, digits + optional leading `+`, 8–15 digits |
| `paymentMode` | One of `"Prepaid"`, `"COD"` (default `"Prepaid"`) |
| `shippingAddress` | Required when **any** line item's product has `requiresShipping: true`. Optional only for fully-digital carts. |

On failure return `400 INVALID_INPUT` with a `missingFields` array. Do not silently drop unknown address fields.

## 2. Persisted `invoices` document — exact shape

Field names below match the `ExternalInvoice` schema in `garage-store-backend-nodejs-v1` (`src/models/external/invoice.model.ts`). Keeping them identical means our mirror needs no changes.

```js
{
  // ...existing invoice fields unchanged...

  shippingAddress: {
    fullName: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    phone: String
  },
  billingAddress: {
    fullName: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    phone: String
  },
  paymentMode: String,   // "Prepaid" | "COD"
  gstin: String,         // optional
  companyName: String    // optional
}
```

## 3. Fanout to `productorders`

When an invoice creates child `productorders`, propagate the same fields. Currently `productorders.shippingAddress` is `undefined` and `requiresShipping` is being set incorrectly. Fix:

```js
productOrder.shippingAddress  = invoice.shippingAddress;
productOrder.billingAddress   = invoice.billingAddress ?? invoice.shippingAddress;
productOrder.paymentMode      = invoice.paymentMode ?? "Prepaid";
productOrder.requiresShipping =
  lineItems.some(li => productMap[li.productId]?.requiresShipping === true);
```

`requiresShipping` must be derived from the actual `Product.requiresShipping` flag, not defaulted to `false`.

## 4. `POST /api/ecommerce/invoices` — Response

Echo the persisted address back so the frontend can render the confirmation screen without an extra GET:

```json
{
  "success": true,
  "invoice": {
    "_id": "...",
    "invoiceNumber": "INV-XXXX-YYYY",
    "status": "pending_payment",
    "totalAmount": 287,
    "itemCurrency": "INR",
    "expiresAt": "2026-05-16T15:00:00Z",

    "shippingAddress": { "fullName": "...", "addressLine1": "...", "...": "..." },
    "billingAddress":  { "fullName": "...", "addressLine1": "...", "...": "..." },
    "paymentMode": "Prepaid"
  },
  "payUrl": "https://my.garage.app/pay/..."
}
```

## 5. `GET /api/invoices/:invoiceId` — Response

Same additions. This endpoint backs the "order confirmation" page after the payment redirect, so it must include the address fields.

## 6. Backwards compatibility

- Pre-existing invoices that have no `shippingAddress` must still GET successfully — return `null` (don't 500).
- The mirror in `garage-store-backend-nodejs-v1` already handles `null` gracefully (produces an Order with no address), so no coordinated rollout is required.
- Unknown extra fields in the request should be ignored (`strict: false`-style behaviour), not 400'd, so the frontend can evolve independently.

## 7. End-to-end test contract

After the change, this should pass:

```bash
curl -X POST 'https://test.garage.app/api/ecommerce/invoices' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{
    "items": [{ "productId": "<physicalProductId>", "quantity": 1 }],
    "displayCurrency": "INR",
    "customerEmail": "buyer@example.com",
    "customerName": "Jane Doe",
    "shippingAddress": {
      "fullName": "Jane Doe",
      "addressLine1": "123 MG Road",
      "city": "Bangalore",
      "state": "Karnataka",
      "postalCode": "560001",
      "country": "India",
      "phone": "+919876543210"
    },
    "paymentMode": "Prepaid"
  }'
```

Expected:

1. Response `invoice.shippingAddress` is present and matches what was sent.
2. `productorders` row(s) created from this invoice carry the same `shippingAddress` and `requiresShipping: true` (since the product is physical).
3. Within one mirror tick (~30 seconds), `GET http://localhost:4005/orders/<localOrderId>` on the seller dashboard backend returns the order with `shippingAddress` populated.
4. `POST http://localhost:4005/shiprocket/orders/<localOrderId>/create` succeeds without a `missing_address` error.

## 8. Naming choice — why `addressLine1` / `postalCode`

The seller dashboard backend uses `line1` / `zip` internally, but the mirror's `mapAddress()` (`src/services/ecommerceMirror.ts:104`) translates `addressLine1 → line1` and `postalCode → zip`. Keeping the invoice doc on the `addressLine1` / `postalCode` convention preserves that mapping and avoids touching the mirror.
