# `server/models/productOrder.model.ts`

> Mongoose model for an order of one or more `Product` items: line items (with snapshotted digital deliverables), money totals, order/payment status, shipping and billing addresses, GST details and tracking info.

**Kind:** Mongoose model · **Lines:** 298

## Purpose
When a buyer checks out founder products, a `ProductOrder` document records what was bought and how it was paid. It is the source of truth for "has this user paid for this product?" checks (digital delivery, private one-time offers, reviews, commission eligibility), for founder/admin order lists and dashboards, and for invoice generation. The model has no hooks or methods - all business logic lives in the routes and services that use it.

## How it works

### Line items (`OrderItemSchema`, no `_id`)
- `productId` (ref `Product`, required), optional `variantId` (ref `ProductVariant`).
- `productName` (required) and `productImage` - snapshots taken at order time so the order still renders if the product changes.
- `quantity` (>= 1), `unitPrice`, `totalPrice` (>= 0, all required), `isDigital` (default `false`).
- `digitalAssets[]` (`name`, `fileUrl`, `fileType`) and `digitalLinks[]` (`label`, `url`, `description`, `linkType` `"static"`/`"dynamic"` default `"static"`, `isCustomLink` default `false`, `customLinkSetBy` ref `User`). Digital deliverables are copied into the order so the buyer keeps access; `isCustomLink`/`customLinkSetBy` record a per-buyer link set by someone (for "dynamic" links).

### Addresses (`ShippingAddressSchema`, no `_id`)
`fullName`, `addressLine1`, `city`, `state`, `postalCode`, `country` (required), optional `addressLine2`, `phone`. Used for both `shippingAddress` and `billingAddress`.

### Order fields (`ProductOrderSchema`, `timestamps: true`)
- `orderNumber` - unique; default generated as `ORD-<base36 timestamp>-<4 random base36 chars>`, upper-cased.
- `organizationId` (ref `Organization`) and `userId` (ref `User`, the buyer) - both required and indexed.
- `items` - required, validated to contain at least one item ("Order must have at least one item").
- Money: `subtotal` and `total` (required, >= 0), `discount`, `tax`, `shippingCost` (default 0, >= 0), `currency` (default `"INR"`).
- `status`: `pending` (default) | `confirmed` | `processing` | `shipped` | `delivered` | `cancelled` | `refunded`.
- `paymentStatus`: `pending` (default) | `paid` | `failed` | `refunded`.
- `paymentMethod`, `paymentId` (gateway payment id), `invoiceShortUrl` (public Razorpay invoice URL).
- `paymentMode`: `"Prepaid"` | `"COD"`; `gstin`, `companyName` (B2B invoice details); `customerNote` (max 1000 chars).
- `requiresShipping` (default `false`), `trackingNumber`, `trackingUrl`, `notes`, and free-form `metadata` (Mixed).

### Indexes
- `{ orderNumber: 1 }` - order-number lookup.
- `{ userId: 1, createdAt: -1 }` - a user's order history.
- `{ organizationId: 1, status: 1, createdAt: -1 }` - founder order lists filtered by status.
- `{ paymentId: 1 }` unique + sparse - prevents creating two orders from the same payment while allowing legacy orders without a `paymentId`.
- `{ userId: 1, "items.productId": 1, paymentStatus: 1 }` - the hide-after-purchase filter in `getAvailableProducts` for private one-time offers.
- `{ userId: 1, organizationId: 1, paymentStatus: 1 }` - the offline-store commission gate ("which of these uplines has ever paid for anything from this org?"), run on the payment hot path.

## Exports
- `ProductOrder` - the Mongoose model `"ProductOrder"` (collection `productorders`).
- `IProductOrder` - document interface.
- `IOrderItem` - line-item interface.
- `IShippingAddress` - address interface (used for shipping and billing).

## Interfaces
- **Database:** `ProductOrder` (collection `productorders`) - schema definition only.
- **External services:** stores Razorpay references (`paymentId`, `invoiceShortUrl`); the gateway calls happen elsewhere.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
`server/routes/product.ts`, `server/routes/productCheckout.ts`, `server/routes/unifiedOrders.ts`, `server/routes/feed.ts`, `server/controllers/garageAdmin.controller.ts`, `server/services/product.ts`, `server/services/commission.ts`, `server/services/invoice.ts`, `server/services/review.ts`, `server/services/wallet.ts`, `server/services/workshop.ts`, `server/services/downlineMemberLiveStreams.ts`, `server/services/downlineMemberPurchases.ts`, `server/services/founderStreamTable.ts`, and the manual script `server/scripts/diagnoseAuctionSettlement.ts` (15 importers).

## Notes
- `orderNumber` is declared `unique: true` on the field and also gets a separate `{ orderNumber: 1 }` index, so Mongoose may log a duplicate-index warning at startup.
- The random part of `orderNumber` is only 4 base36 characters appended to a millisecond timestamp; collisions are unlikely but are caught by the unique index rather than retried here.
- Unlike `Product`, the default currency here is `"INR"`; callers are expected to set `currency` explicitly.
