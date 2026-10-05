# `server/routes/product.ts`

> Express router with 19 endpoints, mounted at `/products`.

**Kind:** Express router · **Lines:** 1514 · **Mounted at:** `/products` (browser: `/backend/products`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (19)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/products` | `requireAuth` | inline | 80 |
| GET | `/:productId` | `/backend/products/:productId` | `requireAuth` | inline | 129 |
| POST | `/` | `/backend/products` | `requireAuth` | inline | 194 |
| PUT | `/:productId` | `/backend/products/:productId` | `requireAuth` | inline | 358 |
| DELETE | `/:productId` | `/backend/products/:productId` | `requireAuth` | inline | 405 |
| GET | `/:productId/my-links` | `/backend/products/:productId/my-links` | `requireAuth` | inline | 442 |
| PUT | `/:productId/my-links` | `/backend/products/:productId/my-links` | `requireAuth` | inline | 502 |
| DELETE | `/:productId/my-links/:digitalLinkLabel` | `/backend/products/:productId/my-links/:digitalLinkLabel` | `requireAuth` | inline | 573 |
| POST | `/:productId/create-subscription` | `/backend/products/:productId/create-subscription` | `requireAuth` | inline | 605 |
| GET | `/:productId/subscription-status` | `/backend/products/:productId/subscription-status` | `requireAuth` | inline | 707 |
| POST | `/orders` | `/backend/products/orders` | `requireAuth` | inline | 789 |
| POST | `/orders/create-razorpay-order` | `/backend/products/orders/create-razorpay-order` | `requireAuth` | inline | 826 |
| POST | `/orders/verify-payment` | `/backend/products/orders/verify-payment` | `requireAuth` | inline | 1137 |
| GET | `/orders/my` | `/backend/products/orders/my` | `requireAuth` | inline | 1310 |
| GET | `/orders/all` | `/backend/products/orders/all` | `requireAuth` | inline | 1332 |
| GET | `/orders/stats` | `/backend/products/orders/stats` | `requireAuth` | inline | 1362 |
| GET | `/orders/:orderId` | `/backend/products/orders/:orderId` | `requireAuth` | inline | 1389 |
| PATCH | `/orders/:orderId/status` | `/backend/products/orders/:orderId/status` | `requireAuth` | inline | 1420 |
| PATCH | `/orders/:orderId/payment` | `/backend/products/orders/:orderId/payment` | `requireAuth` | inline | 1470 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1513 |

## Interfaces

- **Database (Mongoose models used):**
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `find`
  - `ProductOrder` (server/models/productOrder.model.ts) — reads: `exists`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `Product` (server/models/product.model.ts) — reads: `findOne`, `findById`
  - `UserProductLink` (server/models/userProductLink.model.ts) — reads: `find`; **writes:** `findOneAndUpdate`, `deleteOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/rbac.ts` — `isFounderOrModuleAdmin`
  - `server/models/user.model.ts` — `User`
  - `server/models/product.model.ts` — `Product`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/productOrder.model.ts` — `ProductOrder`
  - `server/models/userProductLink.model.ts` — `UserProductLink`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/bulkEmail.ts` — `notifyNewProductCreated`
  - `server/services/product.ts` — `createProduct`, `updateProduct`, `deleteProduct`, `getProductById`, `getProducts`, `getAvailableProducts`, `createOrder as createProductOrder`, `getOrderById`, … +8
  - `server/services/razorpay.ts` — `createOrder as createRazorpayOrder`, `verifyPaymentSignature`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/utils/gstTax.ts` — `getCommissionBase`, `applyGstToLine`
  - `server/utils/gstBuyerRegion.ts` — `isBuyerInIndia`
  - `server/services/subscription.ts` — `createSubscriptionPlan`, `getSubscriptionPlanForItem`, `createUserSubscription`, `hasSubscriptionAccess`, `getUserActiveSubscription`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/products`.

## Notes

- Large file (1514 lines) — read it by section; line numbers above point into it.
