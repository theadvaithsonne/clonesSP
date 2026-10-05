# Products & Invoice-Payment API

Internal integration guide for Garage frontend engineers.

This document covers the minimal set of APIs needed to:

1. Show a list of an org's products.
2. Let a user click **Buy Now**, generate an invoice, and redirect them to a hosted payment page in a new tab.
3. Detect when the invoice is paid.

The user pays on a hosted invoice page (Razorpay under the hood). You do **not** need to integrate the Razorpay SDK on your side.

---

## 1. Overview

### Flow

```
Frontend                         Backend                   Hosted pay page
   |                                 |                            |
   | GET /products?orgId=... ------->|                            |
   |<-- { data.products[] } ---------|                            |
   |                                                              |
   |  [user clicks Buy Now on a product]                          |
   |                                                              |
   | POST /api/invoices/generate --->|                            |
   |<-- { invoiceId, invoiceShortUrl }|                           |
   |                                                              |
   | window.open(invoiceShortUrl, '_blank') -------------------->  |
   |                                              (user pays here, Razorpay)
   |                                                              |
   | GET /api/invoices/:invoiceId (poll every 3s) ->|             |
   |<-- { invoice.status: "paid" } -----------------|             |
```

### Base URL

- Development: `http://localhost:4000`
- Production: same as `NEXT_PUBLIC_API_URL`.

### Auth

- **Product list** and **invoice generate** require a JWT Bearer token in the `Authorization` header.
- **Invoice read** (`GET /api/invoices/:invoiceId`) is public — safe to poll without a token.
- The hosted pay page is public — the end user does not need a Garage session there.

Use the existing [`lib/api.ts`](../garage-web-app-nextjs-v1/lib/api.ts) wrapper from the frontend repo; it injects the token automatically.

---

## 2. List products for an org

`GET /products`

Returns all products belonging to an org.

### Query parameters

| Param          | Type    | Required | Notes                                       |
| -------------- | ------- | -------- | ------------------------------------------- |
| `orgId`        | string  | yes      | Organization ID                             |
| `search`       | string  | no       | Matches name / description                  |
| `status`       | string  | no       | e.g. `active`, `draft`                      |
| `categoryName` | string  | no       |                                             |
| `tags`         | string  | no       | Comma-separated                             |
| `isDigital`    | boolean | no       |                                             |
| `channelId`    | string  | no       |                                             |
| `page`         | number  | no       | Default `1`                                 |
| `limit`        | number  | no       | Default `20`                                |
| `sortBy`       | string  | no       | e.g. `createdAt`, `price`                   |
| `sortOrder`    | string  | no       | `asc` \| `desc`                             |

### Response

```json
{
  "data": {
    "products": [
      {
        "_id": "65f0a1b2c3d4e5f6a7b8c9d0",
        "name": "Starter Plan",
        "description": "Monthly access",
        "price": 999,
        "currency": "INR",
        "images": ["https://..."],
        "isDigital": true,
        "status": "active",
        "inventory": 100,
        "tags": ["plan"],
        "categoryName": "Subscriptions"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20,
    "pages": 3
  },
  "isFounder": true
}
```

### Example

```bash
curl -H "Authorization: Bearer <jwt>" \
  "$API/products?orgId=<orgId>&limit=20"
```

```ts
const { data } = await api<ProductsResponse>(
  `/products?orgId=${orgId}&limit=20`,
  {},
  token,
);
// render data.products
```

---

## 3. Generate an invoice + short URL

> **Status:** proposed — to be implemented. Contract is frozen; backend will wrap the existing invoice-creation logic in [`services/invoice.ts`](src/services/invoice.ts) and populate `invoiceShortUrl` the same way [`services/subscription.ts`](src/services/subscription.ts) already does for recurring flows.

`POST /api/invoices/generate`

Creates a pending invoice for the given product and returns a public URL the user can open to pay.

### Auth

JWT required.

### Request body

```json
{
  "orgId": "65f0a1b2c3d4e5f6a7b8c9d0",
  "productId": "65f0a1b2c3d4e5f6a7b8c9d1",
  "quantity": 1,
  "customer": {
    "email": "buyer@example.com",
    "name": "Jane Doe",
    "phone": "+91..."
  },
  "couponCode": "LAUNCH20",
  "notes": "Renewal for April"
}
```

| Field              | Type   | Required | Notes                                                 |
| ------------------ | ------ | -------- | ----------------------------------------------------- |
| `orgId`            | string | yes      | Org that owns the product                             |
| `productId`        | string | yes      | Product being purchased                               |
| `quantity`         | number | no       | Default `1`                                           |
| `customer.email`   | string | yes      | Invoice is sent here; also used for login-on-pay OTP  |
| `customer.name`    | string | no       |                                                       |
| `customer.phone`   | string | no       |                                                       |
| `couponCode`       | string | no       |                                                       |
| `notes`            | string | no       | Shown on the invoice                                  |

### Response

```json
{
  "success": true,
  "invoiceId": "65f0a1b2c3d4e5f6a7b8c9d2",
  "invoiceNumber": "INV-2026-0001",
  "status": "pending",
  "totalAmount": 999,
  "currency": "INR",
  "invoiceShortUrl": "https://app.garage.app/invoice/65f0a1b2c3d4e5f6a7b8c9d2"
}
```

### Usage

```ts
const { invoiceShortUrl, invoiceId } = await api<GenerateInvoiceResponse>(
  '/api/invoices/generate',
  {
    method: 'POST',
    body: JSON.stringify({
      orgId,
      productId,
      quantity: 1,
      customer: { email, name },
    }),
  },
  token,
);

window.open(invoiceShortUrl, '_blank');
// then start polling invoiceId (see §4)
```

---

## 4. Check invoice status (polling)

`GET /api/invoices/:invoiceId`

Public — no auth required. Safe to call from the frontend while the user is paying in the other tab.

### Response (fields you need)

```json
{
  "success": true,
  "invoice": {
    "_id": "65f0a1b2c3d4e5f6a7b8c9d2",
    "invoiceNumber": "INV-2026-0001",
    "status": "pending",
    "totalAmount": 999,
    "paymentCurrency": "INR",
    "paidAt": null,
    "invoiceShortUrl": "https://app.garage.app/invoice/65f0a1b2c3d4e5f6a7b8c9d2"
  },
  "fromOrganization": {
    "name": "Garage",
    "icon": "https://..."
  }
}
```

### Status values

| Status      | Meaning                            |
| ----------- | ---------------------------------- |
| `draft`     | Not yet presentable (rare)         |
| `pending`   | Generated, awaiting payment        |
| `paid`      | Payment verified                   |
| `cancelled` | User or system cancelled           |

### Poll pattern

```ts
useEffect(() => {
  let stopped = false;
  const poll = setInterval(async () => {
    const { invoice } = await api<InvoiceResponse>(`/api/invoices/${invoiceId}`);
    if (stopped) return;
    if (invoice.status === 'paid') {
      clearInterval(poll);
      onPaid(invoice);
    } else if (invoice.status === 'cancelled') {
      clearInterval(poll);
      onCancelled();
    }
  }, 3000);
  return () => {
    stopped = true;
    clearInterval(poll);
  };
}, [invoiceId]);
```

Stop polling on component unmount. Three seconds is a good default; the webhook usually flips the status within a second of payment.

---

## 5. What happens on the hosted pay page (FYI)

You do not need to implement any of this. When the user opens `invoiceShortUrl` they land on [`app/invoice/[invoiceId]/InvoicePayPage.tsx`](../garage-web-app-nextjs-v1/app/invoice/[invoiceId]/InvoicePayPage.tsx), which:

1. Calls `POST /api/invoices/:invoiceId/select-payment` to create a Razorpay order.
2. Opens Razorpay Checkout for the user to pay.
3. Calls `POST /api/invoices/:invoiceId/verify-payment` to verify the signature and mark the invoice `paid`.
4. A Razorpay webhook (`POST /webhooks/razorpay`) is a safety net — the invoice can flip to `paid` asynchronously even if the user closes the tab after paying.

All you have to do on your side is poll `GET /api/invoices/:invoiceId`.

---

## 6. Errors

All errors return an HTTP 4xx/5xx status with:

```json
{ "error": "Human-readable message" }
```

| Status | When                                                        |
| ------ | ----------------------------------------------------------- |
| 400    | Invalid body, out-of-stock product, invalid coupon          |
| 401    | Missing or invalid JWT                                      |
| 404    | Org, product, or invoice not found                          |
| 409    | Invoice already paid (re-generate if you need a fresh one)  |
| 500    | Server error                                                |

---

## 7. End-to-end test plan

1. `curl -H "Authorization: Bearer <jwt>" "$API/products?orgId=<orgId>"` → non-empty `data.products`.
2. `POST /api/invoices/generate` with a real `productId` → response contains a non-empty `invoiceShortUrl`.
3. Open `invoiceShortUrl` in a browser → hosted pay page loads with the product summary.
4. Complete a test payment with Razorpay test card `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`.
5. `GET /api/invoices/:invoiceId` → `invoice.status === "paid"` and `paidAt` populated within ~3 seconds.
6. Frontend poll loop should detect the transition and call your `onPaid` handler.

---

## 8. Reference files

Backend:

- [`src/routes/product.ts`](src/routes/product.ts) — product list endpoint.
- [`src/routes/invoice.ts`](src/routes/invoice.ts) — invoice read + payment endpoints.
- [`src/services/invoice.ts`](src/services/invoice.ts) — invoice creation logic (to be wrapped by the new `generate` endpoint).
- [`src/models/invoice.model.ts`](src/models/invoice.model.ts) — `invoiceShortUrl` lives here.

Frontend:

- [`app/invoice/[invoiceId]/InvoicePayPage.tsx`](../garage-web-app-nextjs-v1/app/invoice/[invoiceId]/InvoicePayPage.tsx) — hosted pay page.
- [`lib/api.ts`](../garage-web-app-nextjs-v1/lib/api.ts) — authenticated fetch wrapper.
