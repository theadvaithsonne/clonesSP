# `server/models/officePlan.model.ts`

> Mongoose model `OfficePlan` (collection `officeplans`) with 17 top-level fields.

**Kind:** Mongoose model · **Lines:** 262

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `OfficePlan`

- **Collection:** `officeplans` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `name` | `String` | required |
| `slug` | `String` | required, unique, lowercase |
| `description` | `String` | — |
| `amount` | `Number` | required |
| `currency` | `String` | default "USD" |
| `period` | `String` | default "monthly", enum ["monthly", "yearly"] |
| `interval` | `Number` | default 1 |
| `features` | `[String]` | default [] |
| `canInviteStakeholders` | `Boolean` | required, default false |
| `maxStakeholders` | `Number` | default null |
| `razorpayPlanId` | `String` | index |
| `isActive` | `Boolean` | default true |
| `isDefault` | `Boolean` | default false |
| `taxRate` | `Number` | default 18 |
| `taxInclusive` | `Boolean` | default false |
| `sacCode` | `String` | default "998314" |
| `platformFeeOverride` | `Number` | default null |

### Indexes

- `{ isActive: 1, slug: 1 }` (L114)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IOfficePlan` | interface |  | 3 |
| `OfficePlan` | model | `mongoose.model<IOfficePlan>( "OfficePlan", OfficePlanSchema, )` | 116 |
| `GST_CONFIG` | const | `= _GST_CONFIG` | 131 |
| `calculateTaxAmounts` | const | `= _calculateTaxAmounts` | 132 |
| `extractBaseFromTotal` | const | `= _extractBaseFromTotal` | 133 |
| `OFFICE_PLAN_IDS` | const | `= { basic: "695b96bda3149ec5949aa92a", // Fixed ID for Basic plan pro: "695b96bea3149ec59…` | 139 |
| `OFFICE_PLANS_CONFIG` | const | `= { // basic: { // _id: OFFICE_PLAN_IDS.basic, // Fixed ID to prevent orphaned subscripti…` | 154 |
| `OFFICE_COMMISSION_STRUCTURE` | const | `= { level1Percentage: 15, // 15% to L1 referrer level2Percentage: 10, // 10% to L2 referr…` | 255 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/utils/gstTax.ts` — `GST_CONFIG as _GST_CONFIG`, `calculateTaxAmounts as _calculateTaxAmounts`, `extractBaseFromTotal as _extractBaseFromTotal`
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/controllers/garageAdmin.controller.ts`
- `server/routes/adminCouponRules.ts`
- `server/routes/affiliate.ts`
- `server/routes/garageAdminDailyReports.ts`
- `server/routes/garageAdminSavedCards.ts`
- `server/routes/guestAuth.ts`
- `server/routes/internal-catalog.ts`
- `server/routes/joinRequests.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/officeSubscriptionAdmin.ts`
- `server/services/adminPlatformBilling.ts`
- `server/services/affiliateAnalyticsDetail.ts`
- `server/services/commission.ts`
- `server/services/conferenceRoomBilling.ts`
- `server/services/coupon.ts`
- `server/services/couponRule.ts`
- `server/services/cryptobrandOfficeBootstrap.ts`
- `server/services/founderSubMonthlyBonus/qualify.ts`
- `server/services/officePlanStatus.ts`
- `server/services/officeProInvoiceCommission.ts`
- `server/services/officeSubscription.ts`
- `server/services/sellables.ts`
- `server/utils/cabinetStorage.ts`
