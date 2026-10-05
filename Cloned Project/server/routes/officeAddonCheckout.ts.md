# `server/routes/officeAddonCheckout.ts`

> Express router with 6 endpoints, mounted at `/checkout/office-addon`.

**Kind:** Express router · **Lines:** 653 · **Mounted at:** `/checkout/office-addon` (browser: `/backend/checkout/office-addon`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/addons` | `/backend/checkout/office-addon/addons` | — | inline | 46 |
| GET | `/:orgId/status` | `/backend/checkout/office-addon/:orgId/status` | `requireAuth` | inline | 97 |
| POST | `/:orgId/subscribe` | `/backend/checkout/office-addon/:orgId/subscribe` | `requireAuth` | inline | 194 |
| GET | `/:orgId/verify` | `/backend/checkout/office-addon/:orgId/verify` | `requireAuth` | inline | 465 |
| POST | `/:orgId/sync` | `/backend/checkout/office-addon/:orgId/sync` | `requireAuth` | inline | 541 |
| GET | `/:orgId/check/:addonSlug` | `/backend/checkout/office-addon/:orgId/check/:addonSlug` | `requireAuth` | inline | 629 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 652 |

## Interfaces

- **Database (Mongoose models used):**
  - `OfficeAddonSubscription` (server/models/officeAddonSubscription.model.ts) — reads: `findOne`; **writes:** `findByIdAndUpdate`, `create`
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/services/officeAddonSubscription.ts` — `getOfficeAddons`, `getOfficeAddonBySlug`, `createOfficeAddonSubscription`, `getOfficeAddonSubscription`, `getOfficeAddonSubscriptions`, `getActiveOfficeAddonSubscription`, `hasActiveAddon`, `syncOfficeAddonSubscriptionStatus`
  - `server/services/officeSubscription.ts` — `hasActiveOfficeSubscription`
  - `server/services/razorpay.ts` — `fetchSubscription`, `createPlan as createRazorpayPlan`, `createSubscription as createRazorpaySubscription`
  - `server/models/officeAddon.model.ts` — `calculateAddonTaxAmounts`, `ADDON_GST_CONFIG`
  - `server/utils/gstTax.ts` — `applyGstToLine`
  - `server/utils/gstBuyerRegion.ts` — `resolveOrgGstRegion`
  - `server/models/officeAddonSubscription.model.ts` — `OfficeAddonSubscription`
  - `server/services/coupon.ts` — `validateCoupon`, `recordCouponUsage`, `markUsageApplied`, `markUsageFailed`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/checkout/office-addon`.
