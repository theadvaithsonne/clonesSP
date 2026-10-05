# `server/routes/officeCheckout.ts`

> Express router with 13 endpoints, mounted at `/checkout/office`.

**Kind:** Express router · **Lines:** 1530 · **Mounted at:** `/checkout/office` (browser: `/backend/checkout/office`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (13)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/plans` | `/backend/checkout/office/plans` | — | inline | 63 |
| GET | `/:orgId` | `/backend/checkout/office/:orgId` | `requireAuth` | inline | 115 |
| POST | `/:orgId/start-trial` | `/backend/checkout/office/:orgId/start-trial` | `requireAuth` | inline | 222 |
| POST | `/:orgId/subscribe` | `/backend/checkout/office/:orgId/subscribe` | `requireAuth` | inline | 536 |
| POST | `/:orgId/verify` | `/backend/checkout/office/:orgId/verify` | `requireAuth` | inline | 1052 |
| GET | `/:orgId/status` | `/backend/checkout/office/:orgId/status` | `requireAuth` | inline | 1126 |
| GET | `/:orgId/upgrade/preview` | `/backend/checkout/office/:orgId/upgrade/preview` | `requireAuth` | inline | 1168 |
| POST | `/:orgId/upgrade/initiate` | `/backend/checkout/office/:orgId/upgrade/initiate` | `requireAuth` | inline | 1205 |
| GET | `/:orgId/upgrade/history` | `/backend/checkout/office/:orgId/upgrade/history` | `requireAuth` | inline | 1309 |
| GET | `/:orgId/downgrade/preview` | `/backend/checkout/office/:orgId/downgrade/preview` | `requireAuth` | inline | 1346 |
| POST | `/:orgId/downgrade/initiate` | `/backend/checkout/office/:orgId/downgrade/initiate` | `requireAuth` | inline | 1377 |
| GET | `/:orgId/recovery` | `/backend/checkout/office/:orgId/recovery` | `requireAuth` | inline | 1411 |
| POST | `/:orgId/refresh-status` | `/backend/checkout/office/:orgId/refresh-status` | `requireAuth` | inline | 1468 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 1529 |

## Interfaces

- **Socket.IO events:**
  - emits: `office:subscription:update`
- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findById`; **writes:** `findByIdAndUpdate`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `OfficeSubscription` (server/models/officeSubscription.model.ts) — reads: `findOne`; **writes:** `findByIdAndDelete`, `create`
  - `CouponUsage` (server/models/couponUsage.model.ts) — **writes:** `updateMany`
  - `ConferenceRoom` (server/models/conferenceRoom.model.ts) — reads: `countDocuments`; **writes:** `create`
  - `OfficePlan` (server/models/officePlan.model.ts) — reads: `findById`
  - `Invoice` (server/models/invoice.model.ts) — **writes:** `updateMany`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/downlineTree.ts` — `refreshTypeFlags`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/services/officeSubscription.ts` — `getOfficePlans`, `getOfficePlanBySlug`, `createOfficeSubscription`, `getOfficeSubscription`, `hasActiveOfficeSubscription`, `syncOfficeSubscriptionStatus`, `calculateUpgradePreview`, `initiateOfficeUpgrade`, … +5
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/services/razorpay.ts` — `fetchSubscription`, `createPlan as createRazorpayPlan`, `createSubscription as createRazorpaySubscription`, `cancelSubscription`
  - `server/models/officePlan.model.ts` — `calculateTaxAmounts`, `GST_CONFIG`, `OfficePlan`
  - `server/utils/gstTax.ts` — `applyGstToLine`
  - `server/utils/gstBuyerRegion.ts` — `resolveOrgGstRegion`, `gstSkippedMetadata`
  - `server/services/invoice.ts` — `createInvoice`, `getNextChargeDate`
  - `server/models/officeSubscription.model.ts` — `OfficeSubscription`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/conferenceRoom.model.ts` — `ConferenceRoom`
  - `server/models/couponUsage.model.ts` — `CouponUsage`
  - `server/services/coupon.ts` — `validateCoupon`, `recordCouponUsage`, `markUsageApplied`, `markUsageFailed`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/checkout/office`.

## Notes

- Large file (1530 lines) — read it by section; line numbers above point into it.
