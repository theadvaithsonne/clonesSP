# `server/services/product.ts`

> Module exporting `createProduct`, `updateProduct`, `deleteProduct`, `getProductById` and 10 more.

**Kind:** backend service · **Lines:** 1208

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreateProductData` | interface |  | 38 |
| `ProductEmailAlertsInput` | type | Order-alert config as it arrives from the product form. | 124 |
| `normalizeThankYouPage` | re-export | `from ./thankYouPage` | 131 |
| `MAX_THANK_YOU_SECTIONS` | re-export | `from ./thankYouPage` | 132 |
| `ThankYouPageInput` | re-export | `from ./thankYouPage` | 134 |
| `createProduct` | function | `async createProduct(data: CreateProductData): Promise<IProduct>` | 140 |
| `UpdateProductData` | interface |  | 255 |
| `updateProduct` | function | `async updateProduct(productId: string, organizationId: string, data: UpdateProductData): Promise<IProduct \| null>` | 334 |
| `deleteProduct` | function | `async deleteProduct(productId: string, organizationId: string): Promise<boolean>` | 491 |
| `getProductById` | function | `async getProductById(productId: string, organizationId: string): Promise<IProduct \| null>` | 507 |
| `getProductBySlug` | function | `async getProductBySlug(slug: string, organizationId: string): Promise<IProduct \| null>` | 517 |
| `GetProductsOptions` | interface |  | 527 |
| `getProducts` | function | `async getProducts(organizationId: string, options: GetProductsOptions = {}): Promise<{ products: IProduct[]; total: number; pa…` | 540 |
| `getAvailableProducts` | function | `async getAvailableProducts(organizationId: string, userChannelIds: string[], options: GetProductsOptions = {}, userId?: string): Promise<{ products: IProduct[]; total: number; pa…` | 610 |
| `CreateOrderData` | interface |  | 722 |
| `createOrder` | function | `async createOrder(data: CreateOrderData): Promise<IProductOrder>` | 781 |
| `getOrderById` | function | `async getOrderById(orderId: string, organizationId: string): Promise<IProductOrder \| null>` | 1052 |
| `getUserOrders` | function | `async getUserOrders(userId: string, organizationId: string, options: { page?: number; limit?: number; status?: string }…): Promise<{ orders: IProductOrder[]; total: number;…` | 1064 |
| `getOrganizationOrders` | function | `async getOrganizationOrders(organizationId: string, options: { page?: number; limit?: number; status?: string; …): Promise<{ orders: IProductOrder[]; total: number;…` | 1093 |
| `updateOrderStatus` | function | `async updateOrderStatus(orderId: string, organizationId: string, status: IProductOrder["status"], trackingInfo?: { trackingNumber?: string; trackingUrl?: str…): Promise<IProductOrder \| null>` | 1125 |
| `updatePaymentStatus` | function | `async updatePaymentStatus(orderId: string, organizationId: string, paymentStatus: IProductOrder["paymentStatus"], paymentId?: string): Promise<IProductOrder \| null>` | 1153 |
| `getOrderStats` | function | `async getOrderStats(organizationId: string): Promise<{ totalOrders: number; totalRevenue: numb…` | 1183 |

## Interfaces

- **Database (Mongoose models used):**
  - `Product` (server/models/product.model.ts) — reads: `findOne`, `countDocuments`, `find`; **writes:** `new + save`, `deleteOne`, `updateOne`
  - `UserProductLink` (server/models/userProductLink.model.ts) — reads: `find`; **writes:** `deleteMany`
  - `ProductOrder` (server/models/productOrder.model.ts) — reads: `distinct`, `findOne`, `countDocuments`, `find`, `aggregate`; **writes:** `new + save`, `findOneAndUpdate`
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/product.model.ts` — `Product`, `IProduct`, `IDigitalAsset`, `IDigitalLink`, `IKeyFeature`, `IWhatsInsideGroup`, `IProductReview`, `IFaq`, … +2
  - `server/models/productOrder.model.ts` — `ProductOrder`, `IProductOrder`, `IOrderItem`, `IShippingAddress`
  - `server/models/userProductLink.model.ts` — `UserProductLink`
  - `server/models/user.model.ts` — `User`
  - `server/models/emailAlerts.schema.ts` — `normalizeEmailAlerts`, `EmailAlertsInput`
  - `server/models/founderAlerts.schema.ts` — `normalizeFounderAlerts`, `FounderAlertsInput`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/services/thankYouPage.ts` — `normalizeThankYouPage`, `ThankYouPageInput`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/product.ts`
- `server/routes/productCheckout.ts`
- `server/services/invoice.ts`
- `server/services/itemReserveLicense.ts`
